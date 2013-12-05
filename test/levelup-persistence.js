var test = require("tap").test
var newCache = require("../")
var levelup = require('levelup')
var ASQ = require('asynquence')

// Similar to events.js "Only expired values are reloaded" but with multiple cache instantiations
test("Values and expirations persist across instantiations via levelup", function(t) {
	var db = levelup('/does/not/matter', { db: require('memdown') })

	ASQ(function(done) {
		var source = {
			source1: "one",
			source2: "two"
		}

		function getter(key, cb) {
			setTimeout(function() {
				cb(false, source[key])
			}, 10)
		}

		var cache = newCache(db, getter, { refreshEvery: 1 })

		cache.get('source1')

		setTimeout(function() {
			cache.get('source2', function() {
				cache.stop()
				setTimeout(done, 200)  // We'll let source2 sit around in the cash for a few hundred ms before moving on
			})
		}, 900)
	}).then(function(done) {
		function getter(key, cb) {
			setTimeout(function() {
				cb(false, "HAHA NEW VALUE")
			}, 10)
		}
		var cache = newCache(db, getter, { refreshEvery: 1 })
		t.plan(4)

		// source1 will need to be loaded from the server, but source2 was just loaded, it should be grabbed from the levelup store
		cache.once('loaded', function(key, value) {
			t.equal('source1', key, 'event fired for source1')
			t.equal("HAHA NEW VALUE", value, 'The new value was found')

			cache.on('loaded', function(key, value) {
				t.notOk(true, 'The loaded event should not be fired again, all further lookups should come from the cache.  (fired for ' + key + ' with ' + value + ')')
			})
			done(cache)
		})
	}).then(function(done, cache) {
		cache.get('source2', function(err, value) {
			t.equal('two', value, "source2 value is two")
			done(cache)
		})
	}).then(function(done, cache) {
		cache.get('source1', function(err, value) {
			t.equal('HAHA NEW VALUE', value, 'source1 value is HAHA NEW VALUE')
			done(cache)
		})
	}).then(function(done, cache) {
		cache.stop()
		t.end()
	})
})
