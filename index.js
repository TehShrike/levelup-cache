module.exports = function turnLevelUPDatabaseIntoACache(db, getter) {

	var getRemoteValue = function(key, cb) {
		getter(key, function(err, value) {
			if (err) {
				cb(err)
			} else {
				db.put(key, value)
				cb(null, value)
			}
		})
	}

	return function getFromCache(key, cb) {
		db.get(key, function(err, value) {
			if (err && err.notFound) {
				getRemoteValue(key, cb)
			} else if (err) {
				cb(err)
			} else {
				cb(null, value)
			}
		})
	}
}