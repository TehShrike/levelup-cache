var test = require("tap").test
var newCache = require("../")
var levelup = require('levelup')
var ASQ = require('asynquence')

var TestingCache = function(source, options) {
	var db = levelup('/does/not/matter', {
		db: require('memdown')
	})

	var delay = options ? (options.delay || 10) : 10

	source = source || {
		source1: "one",
		source2: "two"
	}

	var getter = function(key, cb) {
		setTimeout(function() {
			cb(false, source[key])
		}, delay)
	}

	var cache = newCache(db, getter, options)
	cache.source = source

	return cache
}

test("getting", function(t) {
	t.plan(2)

	var cache = new TestingCache()
	cache.get("source1", function(err, value) {
		t.equal(value, "one", "The first get (requiring calling the get function) succeeds")

		cache.get("source1", function(err, value) {
			t.equal(value, "one", "The second get (returning the cached value) succeeds")
			cache.stop()
		})
	})
})

test("getting updated value", function(t) {
	t.plan(3)
	var cache = new TestingCache(false, { refreshEvery: 1000, checkToSeeIfItemsNeedToBeRefreshedEvery: 10 })

	cache.get("source1", function(err, value) {
		t.equal(value, "one", "The first get (requiring calling the get function) succeeds")
		cache.source.source1 = "haha it's different now"

		cache.get("source1", function(err, value) {
			t.equal(value, "one", "The second get after the value has changed - should still return the old cached value")
		})

		setTimeout(function() {
			cache.get("source1", function(err, value) {
				t.equal(value, "haha it's different now", "the second get call after the remote value was changed")
				cache.stop()
			})
		}, 3000)
	})
})

test("All callbacks called when getter returns", function(t) {
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

	var cache = newCache(db, getter)

	t.plan(3)

	var soFar = 0
	function testResponse(expected) {
		return function(err, value) {
			t.equal(expected, value, 'The got value is ' + expected + ' as expected')

			soFar = soFar + 1
			if (soFar === 3) {
				cache.stop()
				t.end()
			}
		}
	}
	cache.get('source1', testResponse('one'))
	cache.get('source2', testResponse('two'))
	cache.get('source1', testResponse('one'))
})

test("Remote get only happens once for many gets", function(t) {
	var db = levelup('/does/not/matter', { db: require('memdown') })

	var source = {
		source1: "one",
		source2: "two"
	}

	var getterCalled = false
	function getter(key, cb) {
		t.notOk(getterCalled, 'Getter has not been called before')
		getterCalled = true
		setTimeout(function() {
			cb(!getterCalled, source[key])
		}, 400)
	}

	var cache = newCache(db, getter, { refreshEvery: 5000, checkToSeeIfItemsNeedToBeRefreshedEvery: 10 })

	function makeRequest(key, expected) {
		return function(done) {
			cache.get(key, function(err, value) {
				t.notOk(err, "no error")
				t.equal(expected, value, "value was " + expected + " as expected")
				done()
			})
		}
	}

	ASQ().gate(makeRequest('source2', 'two'),
		makeRequest('source2', 'two'),
		makeRequest('source2', 'two'),
		makeRequest('source2', 'two')).then(function(done) {
			cache.stop()
			t.end()
			done()
		})
})
