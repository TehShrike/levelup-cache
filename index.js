var StringMap = require('stringmap')
var sublevel = require('level-sublevel')
var ASQ = require('asynquence')
var EventEmitter = require('events').EventEmitter

module.exports = function turnLevelUPDatabaseIntoACache(levelUpDb, getter, options) {
	"use strict"
	var db = sublevel(levelUpDb)
	var items = db.sublevel('items')
	var refreshTimestamps = db.sublevel('expirations')
	var currentlyRefreshing = new StringMap()
	var refreshTimer = null
	var cache = new EventEmitter()

	options = options || {}

	options = {
		refreshEvery: options.refreshEvery || 60 * 60 * 12
	}

	var refreshMs = options.refreshEvery * 1000

	function refreshValueIfNecessary(key, lastRefreshed) {
		if (typeof lastRefreshed === 'undefined') {
			refreshTimestamps.get(key, function(err, value) {
				if (!err) {
					refreshValueIfNecessary(key, value)
				}
			})
		} else {
			var now = new Date().getTime()
			lastRefreshed = parseInt(lastRefreshed)
			var refreshAfter = lastRefreshed + refreshMs
			var needToRefresh = refreshAfter <= now
			if (needToRefresh) {
				getRemoteValue(key)
			}
		}
	}

	function refresh() {
		refreshTimestamps.createReadStream().on('data', function(data) {
			refreshValueIfNecessary(data.key, data.value)
		})
	}

	function start() {
		if (!refreshTimer) {
			refresh()
			refreshTimer = setInterval(refresh, refreshMs)
		}
	}

	function stop() {
		if (refreshTimer) {
			clearInterval(refreshTimer)
			refreshTimer = null
		}
	}

	start()

	function getRemoteValue(key, cb) {
		var sequence = currentlyRefreshing.get(key)

		if (!sequence) {
			sequence = ASQ(function(done) {
				getter(key, function(err, value) {
					if (!err) {
						items.put(key, value)
						cache.emit('loaded', key, value)
						refreshTimestamps.put(key, new Date().getTime())
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

	cache.start = start
	cache.stop = stop
	cache.get = function getFromCache(key, cb) {
		cb = cb || function noop() {}
		items.get(key, function(err, value) {
			if (err && err.notFound) {
				getRemoteValue(key, cb)
			} else if (err) {
				cb(err)
			} else {
				refreshValueIfNecessary(key)
				cb(null, value)
			}
		})
	}

	return cache
}
