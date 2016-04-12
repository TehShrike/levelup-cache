var sub = require('subleveldown')
var EventEmitter = require('events').EventEmitter
var Expirer = require('expire-unused-keys')
var extend = require('xtend')

module.exports = function turnLevelUPDatabaseIntoACache(levelUpDb, getter, options) {
	var stopped = false
	options = options || {}

	options = extend({
		refreshEvery: 12 * 60 * 60 * 1000,
		checkToSeeIfItemsNeedToBeRefreshedEvery: 1000,
		ttl: 7 * 24 * 60 * 60 * 1000, // SEVEN DAYS OH MAN
		comparison: function defaultComparison(a, b) { return a === b }
	}, options)

	var items = levelUpDb
	var itemExpirer = new Expirer({
		db: sub(levelUpDb, 'item-expirations', { valueEncoding: 'utf8' }),
		timeoutMs: options.ttl,
		checkIntervalMs: options.checkToSeeIfItemsNeedToBeRefreshedEvery
	})
	var refreshTimestamps = new Expirer({
		db: sub(levelUpDb, 'refresh', { valueEncoding: 'utf8' }),
		timeoutMs: options.refreshEvery,
		checkIntervalMs: options.checkToSeeIfItemsNeedToBeRefreshedEvery,
		repeatExpirations: true
	})
	var currentlyRefreshing = {}
	var cache = new EventEmitter()

	refreshTimestamps.on('expire', getRemoteValue)
	itemExpirer.on('expire', expireItem)

	function stop() {
		refreshTimestamps.stop()
		itemExpirer.stop()
		stopped = true
	}

	function expireItem(key) {
		items.del(key)
		refreshTimestamps.forget(key)
		var inTheMidstOfRefreshing = currentlyRefreshing[key]
		if (inTheMidstOfRefreshing) {
			delete currentlyRefreshing[key]
		}
	}

	// A getRemoteValue call without a callback function refreshes the cached value
	function getRemoteValue(key, cb) {
		refreshTimestamps.touch(key)

		if (!currentlyRefreshing[key]) {
			currentlyRefreshing[key] = []

			function complete(err, value) {
				if (currentlyRefreshing[key] && !stopped) {
					currentlyRefreshing[key].forEach(function(cb) {
						process.nextTick(function() {
							cb(err, value)
						})
					})
				}
				delete currentlyRefreshing[key]
			}

			getter(key, function(err, value) {

				items.get(key, function(localError, previousValue) {
					if (err) {
						return complete(err)
					}

					if (!err && currentlyRefreshing[key] && !stopped) {
						items.put(key, value, function() {
							if (currentlyRefreshing[key] && !stopped) {
								cache.emit('load', key, value)

								if ((localError && localError.notFound) || !options.comparison(previousValue, value)) {
									cache.emit('change', key, value, previousValue)
								}
								complete(err, value)
							}
						})
					}
				})

			})
		}

		if (typeof cb === 'function') {
			currentlyRefreshing[key].push(cb)
		}
	}

	function wrapCallbackWithAnExpirationTouch(key, cb) {
		return function(err, value) {
			if (!err) {
				refreshTimestamps.createIfNotExists(key)
				itemExpirer.touch(key)
			}
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
