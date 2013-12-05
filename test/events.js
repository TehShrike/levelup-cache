var test = require("tap").test
var newCache = require("../")
var levelup = require('levelup')

test("Events are emitted when values are reloaded", function(t) {
	var db = levelup('/does/not/matter', { db: require('memdown') })

	var source = {
		source1: "one",
		source2: "two"
	}

	function getter(key, cb) {
		setTimeout(function() {
			cb(false, source[key])
		}, 100)
	}

	var cache = newCache(db, getter, { refreshEvery: 1 })

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
	}, 2200) // The values should have been reloaded after the second check around ~2000 ms
})

test("Only expired values are reloaded", function(t) {
	var db = levelup('/does/not/matter', { db: require('memdown') })

	var source = {
		source1: "one",
		source2: "two"
	}

	function getter(key, cb) {
		setTimeout(function() {
			cb(false, source[key])
		}, 100)
	}

	var cache = newCache(db, getter, { refreshEvery: 1 })
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

	}, 1100)

	setTimeout(function() {
		cache.stop()
		t.end()
	}, 2500)
})
