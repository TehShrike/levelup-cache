Use your LevelUP database to cache remote data from somewhere else - data that may change at some point.

Just provide a getter function and lookup all keys with a single get call.

# Priorities/features

- Retrieve values by a getter function supplied when the class is instantiated
- Return a value as quickly as possible, no matter how old
- Automatically call the getter function to check for new values every so often
- Emit events when value changes are detected
- Browser compatability via [Browserify](https://github.com/substack/node-browserify)

