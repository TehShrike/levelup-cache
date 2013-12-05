var test = require("tap").test
var newCache = require("../")
var levelup = require('levelup')

test("a get will prompt a reload without waiting for the refresh timer", function(t) {
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

	var cache = newCache(db, getter, { refreshEvery: 1 })

	t.plan(4)

	setTimeout(function() {
		cache.get('source1', function(err, value) {
			t.equal('one', value, "source1 was one the first time it was checked")
			source.source1 = 'oh hey a new value'

			cache.once('loaded', function(key, value) {
				t.equal('source1', key, 'reload happened for source1')
				t.equal('oh hey a new value', value, 'reload loaded the new value "oh hey a new value"')
				cache.on('loaded', function(key, value) {
					t.notOk(true, "No more reloads should happen")
				})
			})

			// After the first refresh has happened (and found nothing that needed refreshing),
			// and after the source1 value has expired (so that this get will cause it to be refreshed)
			setTimeout(function() {
				cache.get('source1', function(err, value) {
					t.equal('one', value, "source1 was one the second time it was checked")
				})
			}, 1100)

		})
	}, 100)

	// Kill it before the second auto-refresh has time to happen
	setTimeout(function() {
		cache.stop()
		t.end()
	}, 1800)
})
