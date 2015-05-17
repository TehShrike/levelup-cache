var test = require('tape')
var Cache = require("../")
var levelmem = require('level-mem')
var ASQ = require('asynquence')


test("All callbacks called when getter returns", function(t) {
	var levelUpDb = levelmem()

	var source = {
		'some key': { id: 1, content: 'sup dawg' },
		'some other key': { id: 2, content: 'sup doge' }
	}

	function fetchFromSomewhere(key, cb) {
		setTimeout(function() {
			cb(false, source[key])
		}, 100)
	}

	t.plan(5)

	// Cache implementation example \\

	var options = {
		refreshEvery: 10 * 1000,
		checkToSeeIfItemsNeedToBeRefreshedEvery: 5 * 1000,
		ttl: 24 * 60 * 60 * 1000, // Defaults to 7 days
		comparison: function defaultComparison(a, b) { // Defaults to a === b
			return a.id === b.id && a.content === b.content
		}
	}

	var cache = new Cache(levelUpDb, function(key, cb) {
		fetchFromSomewhere(key, cb)
	}, options)

	cache.get('some key', function(err, value) {
		t.equal(1, value.id)
		t.equal('sup dawg', value.content)
	})

	cache.once('change', function(key, value) {
		t.equal('sup dawg', value.content)

		andThenDoThisThing()
	})

	function andThenDoThisThing() {
		cache.once('change', function(key, value) {
			t.equal(2, value.id)
			t.equal('sup doge', value.content)

			cache.stop()
		})

		cache.refresh('some other key')
	}
})
