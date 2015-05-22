[![Build Status](https://travis-ci.org/TehShrike/levelup-cache.svg)](https://travis-ci.org/TehShrike/levelup-cache)

Use a [LevelUP](https://github.com/rvagg/node-levelup) database to cache remote data from somewhere else - data that you'll want to automatically reload every so often.

Just provide a getter function and a LevelUP store, and you're good to go.

Tests are welcome, as are small features.  Add a Github issue or something with thoughts.

**Breaking version change:** levelup-cache 2.0.0 uses [subleveldown](https://www.npmjs.com/package/subleveldown) instead of [sublevel 5.x](https://www.npmjs.com/package/sublevel).

# Priorities/features

Why use this library instead of something else like [level-ttl-cache](https://github.com/rvagg/level-ttl-cache)?  This module has a few specific priorities in mind not met by any module I stumbled on while I was looking:

- Return a value as quickly as possible, no matter how old it is
- Automatically call the getter function to check for new values every so often (regardless of when the key was last accessed)
- Emit events when changes are detected
- Drop items from the cache after they go long enough without being requested (regardless of when the key's value was last refreshed/changed)

# Example

```js

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
		ttl: 24 * 60 * 60 * 1000,
		comparison: function defaultComparison(a, b) {
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

```

# Usage

The module returns a constructor function (call it with or without new, I don't care):

## (levelUpDb, getter, [options])

The getter function should accept two parameters: the first being the key, a string, and the second being the callback to call once you've fetched your value (passing in error, value arguments of course).

## options

### refreshEvery

How often the cache will wait before it goes out to see if there is a new value for a given key, in ms.

Defaults to 12 hours.

### checkToSeeIfItemsNeedToBeRefreshedEvery

I'm awesome at naming variables, aren't I?  This value determines how often the cache will check to see if it ought to be going out and looking for new values (if any keys have exceeded their refreshEvery time), in ms.  This is how much "wiggle room" there is in the timing - if you have the cache set to refresh every ten seconds, but this option is set to two seconds, you could go as long as twelve seconds before the value was actually reloaded.  Gasp.

Defaults to 1 second.

### ttl

How long to let a key sit around in the cache (with its value being automatically refreshed whenever refreshEvery has elapsed) before dropping it.  This time-to-live is counted from the last time that a value was passed back to the user via a get or refresh call.

Defaults to 7 days.

### comparison

A function that determines whether or not two values are the same.  If a value is loaded via the getter function, and it is different from the value that it is replacing, a "change" event is emitted with the key, value, and previous value as arguments.

Defaults to function(a, b) { a === b }

## Functions on the object returned by the constructor function

### get(key, callback)

Calls the callback function with the cached value from the local db.  If no cached value is found, the getter is called to grab the current value.  The callback function is called with (error, value) arguments.

### getLocal(key, callback)

About the same as that last function, except that if the value isn't in the local db, it doesn't bother going out to get a value with the getter function, it just calls the callback with an error object having the traditional notFound property.

### refresh(key, [cb])

Causes the cache to call the getter and store the found value, no matter how fresh the currently stored value is (or if there was a currently stored value for that key at all).

### stop

Stops any timeouts currently floating around, so that your process can exit without you having to get all kill-happy on it.

## Events

### load (key, newValue)

Emitted whenever the getter function returns with a value.

### change (key, newValue, previousValue)

Emitted whenever the getter function returns with a value, and that value is different from the value that had been previously stored in the cache (using the comparison function from the options to determine whether or not the values are different).

# License
[WTFPL](http://wtfpl2.com)
