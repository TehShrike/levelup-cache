# Priorities/features

- Retrieve values by a getter function supplied when the class is instantiated
- Discard least-recently used items after enough time passes since the previous use
- Return a value as quickly as possible, no matter how old
- Automatically call the getter function to check for new values every so often
- Emit events when values change
