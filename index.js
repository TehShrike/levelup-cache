var StringMap = require('stringmap')
var sublevel = require('level-sublevel')
var ASQ = require('asynquence')

module.exports = function turnLevelUPDatabaseIntoACache(levelUpDb, getter, options) {
	"use strict"
	var db = sublevel(levelUpDb)
	var items = db.sublevel('items')
	var refreshTimestamps = db.sublevel('expirations')
	var currentlyRefreshing = new StringMap()
	var refreshTimer = null

	options = options || {}

	options = {
		refreshEvery: options.refreshEvery || 60 * 60 * 12
	}

	var refreshMs = options.refreshEvery * 1000

	function refresh() {
		var now = new Date().getTime()
		refreshTimestamps.createReadStream().on('data', function(data) {
			var refreshAfter = data.value
			if (refreshAfter <= now) {
				getRemoteValue(data.key)
			}
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

	return {
		start: start,
		stop: stop,
		get: function getFromCache(key, cb) {
			items.get(key, function(err, value) {
				if (err && err.notFound) {
					getRemoteValue(key, cb)
				} else if (err) {
					cb(err)
				} else {
					cb(null, value)
				}
			})
		}
	}
}