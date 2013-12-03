Use your LevelUP database to cache remote data from somewhere else - data that may change at some point.

Just provide a getter function and lookup all keys with a single get call.

# Priorities/features

- Retrieve values by a getter function supplied when the class is instantiated
- Return a value as quickly as possible, no matter how old
- Automatically call the getter function to check for new values every so often
- Emit events when value changes are detected

# Todo
- Tests to make sure that all callbacks get called when a remote value is returned
- Test to make sure values/expirations persist across instantiations
- Add events, and tests to go with 'em
