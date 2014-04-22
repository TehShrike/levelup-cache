var StringMap = require('stringmap')
var sublevel = require('level-sublevel')
var ASQ = require('asynquence')
var EventEmitter = require('events').EventEmitter
var Expirer = require('expire-unused-keys')
var extend = require('extend')

module.exports = function turnLevelUPDatabaseIntoACache(levelUpDb, getter, options) {
	options = options || {}

	options = extend({
		refreshEvery: 12 * 60 * 60 * 1000,
		checkToSeeIfItemsNeedToBeRefreshedEvery: 1000,
		ttl: 7 * 24 * 60 * 60 * 1000, // SEVEN DAYS OH MAN
		comparison: function defaultComparison(a, b) { return a === b }
	}, options)

	var db = sublevel(levelUpDb)
	var items = db.sublevel('items')
	var itemExpirer = new Expirer(options.ttl, db.sublevel('item-expirations', { valueEncoding: 'utf8' }), options.checkToSeeIfItemsNeedToBeRefreshedEvery)
	var refreshTimestamps = new Expirer(options.refreshEvery, db.sublevel('refresh', { valueEncoding: 'utf8' }), options.checkToSeeIfItemsNeedToBeRefreshedEvery)
	var currentlyRefreshing = new StringMap()
	var cache = new EventEmitter()

	refreshTimestamps.on('expire', getRemoteValue)
	itemExpirer.on('expire', expireItem)

	function stop() {
		refreshTimestamps.stop()
		itemExpirer.stop()
	}

	function expireItem(key) {
		items.del(key)
		refreshTimestamps.forget(key)
		var inTheMidstOfRefreshing = currentlyRefreshing.get(key)
		if (inTheMidstOfRefreshing) {
			inTheMidstOfRefreshing.abort()
			currentlyRefreshing.remove(key)
		}
	}

	// A getRemoteValue call without a callback function refreshes the cached value
	function getRemoteValue(key, cb) {
		var sequence = currentlyRefreshing.get(key)

		if (!sequence) {
			sequence = ASQ(function(done) {
				getter(key, function(remoteError, value) {
					items.get(key, function(localError, previousValue) {
						// Make sure the sequence wasn't pulled out from under us
						if (!remoteError && currentlyRefreshing.has(key)) {
							items.put(key, value)
							refreshTimestamps.touch(key)

							cache.emit('load', key, value)

							if ((localError && localError.notFound) || !options.comparison(previousValue, value)) {
								cache.emit('change', key, value, previousValue)
							}
						}
						done(remoteError, value)
					})
				})
			})
			currentlyRefreshing.set(key, sequence)
			sequence.then(function(done, err, value) {
				currentlyRefreshing.remove(key)
				done(err, value)
			})
		}

		if (typeof cb === 'function') {
			sequence.then(function(done, err, value) {
				cb(err, value)
				done(err, value)
			})
		}
	}

	function wrapCallbackWithAnExpirationTouch(key, cb) {
		return function(err, value) {
			itemExpirer.touch(key)
			if (typeof cb === 'function') {
				cb(err, value)
			}
		}
	}

	cache.stop = stop
	cache.get = function get(key, cb) {
		items.get(key, function(err, value) {
			if (err && err.notFound) {
				getRemoteValue(key, wrapCallbackWithAnExpirationTouch(key, cb))
			} else if (cb) {
				wrapCallbackWithAnExpirationTouch(key, cb)(err, value)
			}
		})
	}
	cache.getLocal = function getLocal(key, cb) {
		items.get(key, wrapCallbackWithAnExpirationTouch(key, cb))
	}
	cache.refresh = function refresh(key, cb) {
		getRemoteValue(key, wrapCallbackWithAnExpirationTouch(key, cb))
	}

	return cache
}
