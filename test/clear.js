var test = require('tape')
var newCache = require("../")
var levelmem = require('level-mem')

test('clearing should cause a remote fetch on next get', function(t) {
	var db = levelmem()

	var testKey = 'TEST KEY'
	var getterCalled = 0

	function getter(key, cb) {
		getterCalled++
		setTimeout(function() {
			cb(null, getterCalled)
		}, 10)
	}

	var cache = newCache(db, getter, { refreshEvery: 10000, checkToSeeIfItemsNeedToBeRefreshedEvery: 1000 })

	cache.get(testKey, function(err, value) {
		t.equal(getterCalled, 1, 'Getter called once')
		t.error(err)
		t.equal(value, 1)

		cache.clearKey(testKey, function(err) {
			t.error(err)
			t.equal(getterCalled, 1, 'Getter still only been called once')

			cache.get(testKey, function(err, value) {
				t.error(err)
				t.equal(getterCalled, 2, 'Getter called twice')
				t.equal(value, 2)

				cache.stop()
				t.end()
			})

		})
	})
})
