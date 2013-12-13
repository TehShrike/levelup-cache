var StringMap = require('stringmap')
var sublevel = require('level-sublevel')
var ASQ = require('asynquence')
var EventEmitter = require('events').EventEmitter
var Expirer = require('expire-unused-keys')

module.exports = function turnLevelUPDatabaseIntoACache(levelUpDb, getter, options) {
	"use strict"

	options = options || {}

	options = {
		refreshEvery: options.refreshEvery || 12 * 60 * 60 * 1000,
		checkToSeeIfItemsNeedToBeRefreshedEvery: options.checkToSeeIfItemsNeedToBeRefreshedEvery || 1000,
		ttl: (options.ttl || 7 * 24 * 60 * 60 * 1000) // SEVEN DAYS OH MAN
	}

	var db = sublevel(levelUpDb)
	var items = db.sublevel('items')
	var itemExpirer = new Expirer(options.ttl, db.sublevel('item-expirations'), options.checkToSeeIfItemsNeedToBeRefreshedEvery)
	var refreshTimestamps = new Expirer(options.refreshEvery, db.sublevel('refresh'), options.checkToSeeIfItemsNeedToBeRefreshedEvery)
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
				getter(key, function(err, value) {
					// Make sure the sequence wasn't pulled out from under us
					if (!err && currentlyRefreshing.has(key)) {
						items.put(key, value)
						itemExpirer.touch(key)
						refreshTimestamps.touch(key)

						cache.emit('loaded', key, value)
					}
					done(err, value)
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

	cache.stop = stop
	cache.get = function get(key, cb) {
		items.get(key, function(err, value) {
			if (err && err.notFound) {
				getRemoteValue(key, cb)
			} else if (cb) {
				itemExpirer.touch(key)
				cb(err, value)
			}
		})
	}
	cache.getLocal = function getLocal(key, cb) {
		items.get(key, cb)
	}
	cache.refresh = getRemoteValue

	return cache
}
