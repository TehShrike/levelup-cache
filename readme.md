Use your LevelUP database to cache remote data from somewhere else - data that may change at some point.

Just provide a getter function and lookup all keys with a single get call.

# Priorities/features

- Return a value as quickly as possible, no matter how old it is
- Retrieve values with a getter function supplied when the class is instantiated
- Automatically call the getter function to check for new values every so often
- Emit events when remote values are reloaded

# Todo, maybe if somebody feels like it and it seems like it would pay off
- Add a getLocal function (taking a string or array)
- Update this readme with examples and actual documentation :-x
