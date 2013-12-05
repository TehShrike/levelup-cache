Use your LevelUP database to cache remote data from somewhere else - data that may change at some point.

Just provide a getter function and lookup all keys with a single get call.

# Priorities/features

- Return a value as quickly as possible, no matter how old it is
- Retrieve values with a getter function supplied when the class is instantiated
- Automatically call the getter function to check for new values every so often
- Emit events when remote values are reloaded

# Todo, maybe if somebody feels like it and it seems like it would pay off
- Work on the [first hard thing](http://martinfowler.com/bliki/TwoHardThings.html) - right now the library just checks all keys at once every so often to see if they're past their expiration value.  This leads to clumping a lot of remote refreshes together at the same time.  If this library ever sees heavy use, this could be detrimental - it would be nice if it could space out the cache refreshes a bit.
- Add an expiration option that will remove values from the levelUP cache after a certain amount of time
- Update this readme with examples and actual documentation :-x
