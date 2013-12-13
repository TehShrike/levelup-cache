var test = require("tap").test
var newCache = require("../")
var levelup = require('levelup')

test('refresh should cause a remote get', function(t) {
	var db = levelup('/does/not/matter', { db: require('memdown') })

	var source = {
		source1: "one",
		source2: "two"
	}

	function getter(key, cb) {
		setTimeout(function() {
			cb(false, source[key])
		}, 10)
	}

	var cache = newCache(db, getter, { refreshEvery: 10000, checkToSeeIfItemsNeedToBeRefreshedEvery: 1000 })

	cache.get('source1', function(err, value) {
		t.notOk(err, "no err")
		t.equal('one', value, 'value was one, correctly')

		source.source1 = 'huh'
		cache.refresh('source1', function(err, value) {
			t.notOk(err, "no err")
			t.equal('huh', value, 'value was huh, correctly')

			cache.get('source1', function(err, value) {
				t.notOk(err, "no err")
				t.equal('huh', value, 'value was huh, correctly')
				cache.stop()
				t.end()
			})
		})
	})
})
