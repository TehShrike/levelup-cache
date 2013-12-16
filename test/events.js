var test = require("tap").test
var newCache = require("../")
var levelmem = require('level-mem')

test("Events are emitted when values are reloaded", function(t) {
	var db = levelmem()

	var source = {
		source1: "one",
		source2: "two"
	}

	function getter(key, cb) {
		setTimeout(function() {
			cb(false, source[key])
		}, 10)
	}

	var cache = newCache(db, getter, { refreshEvery: 1000, checkToSeeIfItemsNeedToBeRefreshedEvery: 10 })

	var eventCalls = 2 * 2 * 2 // Each event triggers 2 tests. There are 2 keys, and each one should be loaded twice (once on the original load, and once automatically after 1 second)
	var responseCalls = 3
	t.plan(eventCalls + responseCalls)

	var responsesReceived = 0
	var eventsEmitted = 0
	cache.on('loaded', function(key, newValue) {
		t.ok(key === 'source1' || key === 'source2', "The reload event key was an acceptable string")
		t.ok(newValue === 'one' || newValue === 'two', "The reload value was an acceptable string")
	})

	function testResponse(expected) {
		return function(err, value) {
			t.equal(expected, value, 'The got value is ' + expected + ' as expected')
		}
	}
	cache.get('source1', testResponse('one'))
	cache.get('source2', testResponse('two'))
	cache.get('source1', testResponse('one'))

	setTimeout(function() {
		cache.stop()
		t.end()
	}, 2100) // The values should have been reloaded after the second check around ~2020 ms
})

test("Only expired values are reloaded", function(t) {
	var db = levelmem()

	var source = {
		source1: "one",
		source2: "two"
	}

	function getter(key, cb) {
		setTimeout(function() {
			cb(false, source[key])
		}, 10)
	}

	var cache = newCache(db, getter, { refreshEvery: 1000, checkToSeeIfItemsNeedToBeRefreshedEvery: 10 })
	// Won't refresh the first time, because there won't be anything older than a second when the cache
	// has only been around for a second

	t.plan(3)

	cache.get('source1')

	setTimeout(function() {
		cache.get('source2', function(err, value) {
			t.equal('two', value, "source2's value was retrieved correctly")
			source.source1 = "a new value!"

			cache.on('loaded', function(key, newValue) {
				t.equal('source1', key, 'key is source1')
				t.equal("a new value!", newValue, 'value is the new updated value')
			})
		})

	}, 900)

	setTimeout(function() {
		cache.stop()
		t.end()
	}, 1500)
})

test("'Changed' events fired once for new values", function(t) {
	var source = {
		source1: "one",
		source2: "two"
	}

	function getter(key, cb) {
		setTimeout(function() {
			cb(false, source[key])
		}, 1)
	}

	var cache = newCache(levelmem(), getter, { refreshEvery: 100, checkToSeeIfItemsNeedToBeRefreshedEvery: 5 })

	t.plan(7)

	cache.once('changed', function(key, newValue, oldValue) {
		t.equal('source2', key, "key was source2")
		t.equal('two', newValue, "value is one")
		t.equal(undefined, oldValue, "value was undefined")

		var eventEmitted = false
		cache.on('changed', function(key, newValue, oldValue) {
			t.notOk(eventEmitted, "Event was not emitted before")
			eventEmitted = true
			t.equal('source2', key, "key is correct: " + key)
			t.equal('three', newValue, "new value is correct: " + newValue)
			t.equal('two', oldValue, "old value is correct:" + oldValue)
		})
	})

	cache.refresh('source2')

	setTimeout(function() {
		source.source2 = 'three'
	}, 350)

	setTimeout(function() {
		cache.stop()
		t.end()
	}, 900)
})

test("'Changed' events firing with custom comparison function", function(t) {
	var source = {
		source1: { id: 1, name: "one" },
		source2: { id: 2, name: "two" }
	}

	function getter(key, cb) {
		setTimeout(function() {
			cb(false, source[key])
		}, 1)
	}

	var cache = newCache(levelmem('no location', { valueEncoding: 'json' }), getter, {
		refreshEvery: 100,
		checkToSeeIfItemsNeedToBeRefreshedEvery: 5,
		comparison: function testComparison(a, b) {
			return a.id === b.id && a.name === b.name
		}
	})

	t.plan(4)

	cache.get('source1', function() {
		var happenedAlready = false
		cache.on('changed', function(key, newValue, oldValue) {
			t.notOk(happenedAlready)
			happenedAlready = true
			t.equal('source1', key, 'Key is source1')
			t.equal("something different", newValue.name, "New value's name is correct")
			t.equal(1, newValue.id, "New value's id is 1")
		})
	})

	setTimeout(function() {
		source.source1.name = "something different"
	}, 250)

	setTimeout(function() {
		cache.stop()
		t.end()
	}, 350)
})
