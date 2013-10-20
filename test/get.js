var test = require("tap").test
var newCache = require("../")

var db = require('levelup')('/does/not/matter', { 
	db: require('memdown') 
})

var TestingCache = function(source) {
	source = source || {
		source1: "one",
		source2: "two"
	}

	var getter = function(key, cb) {
		cb(source[key])
	}

	this.source = source
	this.get = newCache(db, getter)
}

test("getting", function(t) {
	t.plan(2)

	cache = new TestingCache()
	cache.get("source1", function(value) {
		t.equal(value, "one", "The first get (requiring calling the get function) succeeds")

		cache.get("source1", function(value) {
			t.equal(value, "one", "The second get (returning the cached value) succeeds")
		})
	})
})

