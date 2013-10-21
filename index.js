var kind = require('kind')

var StringMap = require('stringmap')

module.exports = function turnLevelUPDatabaseIntoACache(db, getter, options) {
	var refreshesSinceLastAccess = new StringMap()
	var refreshTimeouts = new StringMap()

	options = options || {}
	options.refreshEvery = options.refreshEvery || 60 * 60 * 12

	var clearRefresh = function(key) {
		var timeout = refreshTimeouts.get(key)
		if (typeof timeout !== 'undefined') {
			clearTimeout(timeout)
		}		
	}

	var resetAutoRefresh = function(key, cb) {
		clearRefresh(key)
		refreshTimeouts.set(key, setTimeout(cb))
	}

	var setUpAutoRefresh = function(key) {

		setTimeout(function() {
			refreshes = refreshesSinceLastAccess.get(key) || 0
			refreshesSinceLastAccess.set(key, refreshes + 1)
			getRemoteValue(key)
			scheduleAutoRefresh(key)
		}, refreshEvery * 1000)
	}

	var getRemoteValue = function(key, cb) {
		var canCallBack = kind(cb) === 'Function'

		getter(key, function(err, value) {
			if (!err) {
				db.put(key, value)
				setUpAutoRefresh()
			}

			if (kind(cb) === 'Function') {
				cb(err, value)
			}
		})
	}

	return function getFromCache(key, cb) {
		db.get(key, function(err, value) {
			refreshesSinceLastAccess.set(key, 0)
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