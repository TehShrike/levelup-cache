var test = require('tape')
var newCache = require("../")
var levelmem = require('level-mem')
var ASQ = require('asynquence')

test("Getting cached value", function(t) {
	var db = levelmem()

	var source = {
		source1: "one",
		source2: "two"
	}

	t.plan(5)

	var calledAlready = false
	function getter(key, cb) {
		t.notOk(calledAlready, 'Getter should only be called once')
		calledAlready = true
		setTimeout(function() {
			cb(!calledAlready, source[key])
		}, 10)
	}

	var cache = newCache(db, getter, { refreshEvery: 10000, checkToSeeIfItemsNeedToBeRefreshedEvery: 1000 })

	cache.get('source2', function(err, value) {
		t.notOk(err, "No error while fetching source2")
		source.source2 = 'something else'
		cache.getLocal('source2', function(err, value) {
			t.equal('two', value, 'getLocal returns the cached value')

			cache.getLocal('source1', function(err, value) {
				t.ok(err, 'getLocal fails on a non-cached value')
				t.ok(err.notFound, 'getLocal on a non-cached value returns an error with a truthy notFound property')
				cache.stop()
			})

		})
	})
})

test("Don't release Zalgo on getLocal calls", function(t) {
	var db = levelmem()

	function getter(key, cb) {
		setTimeout(function() {
			cb(null, "yup")
		}, 10)
	}

	var cache = newCache(db, getter, { refreshEvery: 10000, checkToSeeIfItemsNeedToBeRefreshedEvery: 1000 })

	cache.get('source', function(err, value) {
		var getLocalHasReturned = false
		cache.getLocal('source', function(err, value) {
			t.equal('yup', value, 'getLocal returns the cached value')
			t.ok(getLocalHasReturned, "the getLocal call has returned")
			t.end()
			cache.stop()
		})
		getLocalHasReturned = true
	})
})
