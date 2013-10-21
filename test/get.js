var test = require("tap").test
var newCache = require("../")

var db = require('levelup')('/does/not/matter', { 
	db: require('memdown') 
})

var TestingCache = function(source, options) {
	source = source || {
		source1: "one",
		source2: "two"
	}

	var getter = function(key, cb) {
		console.log("getter called for " + key)
		cb(false, source[key])
	}

	this.source = source
	this.get = newCache(db, getter, options)
}

test("getting", function(t) {
	t.plan(2)

	var cache = new TestingCache()
	cache.get("source1", function(err, value) {
		t.equal(value, "one", "The first get (requiring calling the get function) succeeds")

		cache.get("source1", function(err, value) {
			t.equal(value, "one", "The second get (returning the cached value) succeeds")
		})
	})
})

test("getting updated value", function(t) {
	t.plan(3)
	var cache = new TestingCache(false, { refreshEvery: 5 })

	cache.get("source1", function(err, value) {
		t.equal(value, "one", "The first get (requiring calling the get function) succeeds")
		cache.source.source1 = "haha it's different now"

		cache.get("source1", function(err, value) {
			t.equal(value, "one", "The second get after the value has changed - should still return the old cached value")
		})

		setTimeout(function() {
			cache.get("source1", function(err, value) {
				t.equal(value, "haha it's different now", "the second get call after the remote value was changed")
			})
		}, 6000)
	})
})
