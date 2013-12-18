var test = require("tap").test
var newCache = require("../")
var levelmem = require('level-mem')

test('items are dropped from the cache after being fetched', function(t) {
	var db = levelmem()

	var source = {
		source1: "one",
		source2: "two"
	}

	function getter(key, cb) {
		process.nextTick(function() {
			cb(false, source[key])
		})
	}

	var cache = newCache(db, getter, {
		refreshEvery: 5,
		checkToSeeIfItemsNeedToBeRefreshedEvery: 5,
		ttl: 20
	})

	setTimeout(function() {
		source.source1 = "it's different now"

		cache.get('source1', function(err, value) {
			t.notOk(err, "no error")
			// Normally it would return the cached value, but in this case it's been dropped out of the cache and needs to be gotten
			t.equal("it's different now", value, 'value for source1 is one')
			cache.stop()
			t.end()
		})
	}, 30)
})

test('race condition: dropping an item from the cache while it is still being refreshed', function(t) {
	var db = levelmem()

	var start = new Date().getTime()

	var key = "key"
	var value = "first"

	function getter(key, cb) {
		setTimeout(function() {
			cb(false, value)
		}, 1000)
	}

	var cache = newCache(db, getter, {
		refreshEvery: 100,
		checkToSeeIfItemsNeedToBeRefreshedEvery: 5,
		ttl: 200
	})

	// The first refresh will still be running when the ttl expires

	cache.get(key, function(err, value1) {
		t.notOk(err, "no error")
		t.equal('first', value1, "correct value1 for first check")

		cache.once('load', function(key, value2) {
			t.notOk(true, "The item should never finish loading")
		})

		setTimeout(function() {
			cache.removeAllListeners('load')

			value = "second"

			cache.once('load', function(key, value3) {
				t.equal('key', key, 'blurgh key')
				t.equal('second', value3, "correct value3 for second check")
				cache.on('load', function() {
					t.notOk(true, "Shouldn't be fired again!")
				})
			})

			cache.get(key, function(err, value4) {
				t.notOk(err, 'no error')
				t.equal('second', value4, "correct value4 for second check")
			})

			setTimeout(function() {
				cache.stop()
				t.end()
			}, 1050) // The above tests should succeed in ~1000ms, and another refresh should fire ~100ms after that
		}, 2000)
	})
})

test('items are dropped from the cache even if refreshed recently', function(t) {
	var db = levelmem()

	var source = {
		source1: "one",
		source2: "two"
	}

	var timesAccessed = 0
	function getter(key, cb) {
		timesAccessed = timesAccessed + 1
		process.nextTick(function() {
			cb(false, source[key])
		})
	}

	var cache = newCache(db, getter, {
		refreshEvery: 5,
		checkToSeeIfItemsNeedToBeRefreshedEvery: 5,
		ttl: 200
	})

	cache.refresh('source1')

	setTimeout(function() {
		timesAccessed = 0
	}, 210)

	setTimeout(function() {
		// The value should have only been accessed once since we reset the counter at 220ms
		// since the key should have been dropped from the cache at around 200ms
		cache.get('source1', function(err, value) {
			t.equal(timesAccessed, 1, 'Getter was called once since the reset')
			cache.stop()
			t.end()
		})

	}, 300)
})
