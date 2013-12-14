var test = require("tap").test
var newCache = require("../")
var levelmem = require('level-mem')
var ASQ = require('asynquence')

test("encoding JSON objects", function(t) {
	var db = levelmem('no location', {valueEncoding: 'json'})

	var source = {
		source1: { wat: "hello" },
		source2: ["two", "three"],
		source3: "what number am I",
		source4: [{ thing: "stuff" }]
	}

	var getter = function(key, cb) {
		setTimeout(function() {
			cb(false, source[key])
		}, 5)
	}

	var cache = newCache(db, getter)

	ASQ().gate(function(done) {
		cache.get('source1', function(err, value) {
			t.notOk(err, "no error")
			t.ok(value, "value is truthy")
			t.equal("hello", value.wat, "value.wat is correct")

			done()
		})
	}, function(done) {
		cache.get('source2', function(err, value) {
			t.notOk(err, "no error")
			t.ok(value, "value is truthy")
			t.equal(value.length, 2, "value has length 2")
			t.equal("two", value[0], "value index 0 is correct")
			done()
		})
	}, function(done) {
		cache.get('source3', function(err, value) {
			t.notOk(err, "no error")
			t.equal("what number am I", value, "value is correct")
			done()
		})
	}, function(done) {
		cache.get('source4', function(err, value) {
			t.notOk(err, "no error")
			t.ok(value, "value is truthy")
			t.equal(1, value.length, "value has length 1")
			t.ok(value[0].thing, "value[0].thing is truthy")
			t.equal(value[0].thing, "stuff", "value[0].thing is correct")
			done()
		})
	}).then(function(done) {
		cache.stop()

		var cache2 = newCache(db, getter)

		ASQ().gate(function(done) {
			cache2.get('source1', function(err, value) {
				console.log(value)
				t.notOk(err, "no error")
				t.ok(value, "value is truthy")
				t.equal("hello", value.wat, "value.wat is correct")

				done()
			})
		}, function(done) {
			cache2.get('source2', function(err, value) {
				t.notOk(err, "no error")
				t.ok(value, "value is truthy")
				t.equal(value.length, 2, "value has length 2")
				t.equal("two", value[0], "value index 0 is correct")
				done()
			})
		}, function(done) {
			cache2.get('source3', function(err, value) {
				t.notOk(err, "no error")
				t.equal("what number am I", value, "value is correct")
				done()
			})
		}, function(done) {
			cache2.get('source4', function(err, value) {
				t.notOk(err, "no error")
				console.log(value)
				t.ok(value, "value is truthy")
				t.equal(1, value.length, "value has length 1")
				t.ok(value[0].thing, "value[0].thing is truthy")
				t.equal(value[0].thing, "stuff", "value[0].thing is correct")
				done()
			})
		}).then(function(done) {
			cache2.stop()
			t.end()
			done()
		})
		done()
	})
})
