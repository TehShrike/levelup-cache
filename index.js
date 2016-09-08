const sub = require('subleveldown')
const EventEmitter = require('events').EventEmitter
const Expirer = require('expire-unused-keys')
const extend = require('xtend')
const each = require('async-each')
const gateKeeper = require('gate-keeper')
const makeMap = require('key-master')

function noop() {}
function run(fn, cb) { fn(cb) }

module.exports = function turnLevelUPDatabaseIntoACache(levelUpDb, getter, options = {}) {
	let stopped = false

	options = extend({
		refreshEvery: 12 * 60 * 60 * 1000,
		checkToSeeIfItemsNeedToBeRefreshedEvery: 1000,
		ttl: 7 * 24 * 60 * 60 * 1000, // SEVEN DAYS OH MAN
		comparison: function defaultComparison(a, b) { return a === b }
	}, options)

	const items = levelUpDb
	const itemExpirer = new Expirer({
		db: sub(levelUpDb, 'item-expirations', { valueEncoding: 'utf8' }),
		timeoutMs: options.ttl,
		checkIntervalMs: options.checkToSeeIfItemsNeedToBeRefreshedEvery
	})
	const refreshTimestamps = new Expirer({
		db: sub(levelUpDb, 'refresh', { valueEncoding: 'utf8' }),
		timeoutMs: options.refreshEvery,
		checkIntervalMs: options.checkToSeeIfItemsNeedToBeRefreshedEvery,
		repeatExpirations: true
	})
	const refreshers = makeMap(function(key) {
		return gateKeeper(function(cb) {
			refreshTimestamps.touch(key)
			getter(key, function(err, value) {
				items.get(key, function(localError, previousValue) {
					if (err) {
						return cb(err)
					} else if (!stopped && !cb.isCancelled()) {
						items.put(key, value, function() {
							if (!stopped && !cb.isCancelled()) {
								cache.emit('load', key, value)

								if ((localError && localError.notFound) || !options.comparison(previousValue, value)) {
									cache.emit('change', key, value, previousValue)
								}
								refreshers.delete(key)
								cb(err, value)
							}
						})
					}
				})
			})
		})
	})
	const cache = new EventEmitter()

	refreshTimestamps.on('expire', getRemoteValue)
	itemExpirer.on('expire', expireItem)

	function stop() {
		refreshTimestamps.stop()
		itemExpirer.stop()
		stopped = true
	}

	function expireItem(key, cb) {
		refreshers.get(key).cancel()
		refreshers.delete(key)

		each([
			items.del.bind(items, key),
			refreshTimestamps.forget.bind(refreshTimestamps, key)
		], run, cb || noop)
	}

	// A getRemoteValue call without a callback function still refreshes the cached value
	function getRemoteValue(key, cb) {
		const get = refreshers.get(key)

		get(function complete(err, value) {
			if (typeof cb === 'function') {
				cb(err, value)
			}
		})
	}

	function wrapCallbackWithAnExpirationTouch(key, cb) {
		return function(err, value) {
			refreshTimestamps.createIfNotExists(key)
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
	cache.clearKey = expireItem

	return cache
}
