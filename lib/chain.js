/*global setTimeout: false, console: false */
(function () {

    var chain = {};

    // global on the server, window in the browser
    var root = this,
        previous_chain = root.chain;

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = chain;
    }
    else {
        root.chain = chain;
    }

    chain.noConflict = function () {
        root.chain = previous_chain;
        return chain;
    };

    //// cross-browser compatiblity functions ////

    var _forEach = function (arr, iterator) {
        if (arr.forEach) {
            return arr.forEach(iterator);
        }
        for (var i = 0; i < arr.length; i += 1) {
            iterator(arr[i], i, arr);
        }
    };

    var _map = function (arr, iterator) {
        if (arr.map) {
            return arr.map(iterator);
        }
        var results = [];
        _forEach(arr, function (x, i, a) {
            results.push(iterator(x, i, a));
        });
        return results;
    };

    var _keys = function (obj) {
        if (Object.keys) {
            return Object.keys(obj);
        }
        var keys = [];
        for (var k in obj) {
            if (obj.hasOwnProperty(k)) {
                keys.push(k);
            }
        }
        return keys;
    };

    //// exported chain module functions ////

    //// nextTick implementation with browser-compatible fallback ////
    if (typeof process === 'undefined' || !(process.nextTick)) {
        chain.nextTick = function (fn) {
            setTimeout(fn, 0);
        };
    }
    else {
        chain.nextTick = process.nextTick;
    }

    chain.forEach = function (arr, iterator, callback) {
        callback = callback || function () {};
        if (!arr.length) {
            return callback();
        }
        var completed = 0;
        _forEach(arr, function (x) {
            iterator(x, function (err) {
                completed += 1;
                if (completed === arr.length) {
                    callback(null);
                }
            });
        });
    };

    chain.forEachSeries = function (arr, iterator, callback) {
        callback = callback || function () {};
        if (!arr.length) {
            return callback();
        }
        var completed = 0;
        var iterate = function () {
            iterator(arr[completed], function (err) {
                completed += 1;
                if (completed === arr.length) {
                    callback(null);
                }
                else {
                    iterate();
                }
            });
        };
        iterate();
    };

    var doParallel = function (fn) {
        return function () {
            var args = Array.prototype.slice.call(arguments);
            return fn.apply(null, [chain.forEach].concat(args));
        };
    };
    var doSeries = function (fn) {
        return function () {
            var args = Array.prototype.slice.call(arguments);
            return fn.apply(null, [chain.forEachSeries].concat(args));
        };
    };

    var _chainMap = function (eachfn, arr, iterator, callback) {
        var results = [];
        var errors = [];
        arr = _map(arr, function (x, i) {
            return {index: i, value: x};
        });
        eachfn(arr, function (x, callback) {
            iterator(x.value, function (err, v) {
                errors[x.index] = err;
                results[x.index] = v;
                callback();
            });
        }, function () {
            callback(errors, results);
        });
    };
    chain.map = doParallel(_chainMap);
    chain.mapSeries = doSeries(_chainMap);

    chain.parallel = function (tasks, callback) {
        callback = callback || function () {};
        if (tasks.constructor === Array) {
            chain.map(tasks, function (fn, callback) {
                if (fn) {
                    fn(function (err) {
                        var args = Array.prototype.slice.call(arguments, 1);
                        if (args.length <= 1) {
                            args = args[0];
                        }
                        callback.call(null, err, args);
                    });
                }
            }, callback);
        }
        else {
            var results = {};
            var errors = {};
            chain.forEach(_keys(tasks), function (k, callback) {
                tasks[k](function (err) {
                    var args = Array.prototype.slice.call(arguments, 1);
                    if (args.length <= 1) {
                        args = args[0];
                    }
                    results[k] = args;
                    errors[k] = err;
                    callback(err);
                });
            }, function (err) {
                callback(errors, results);
            });
        }
    };

    chain.series = function (tasks, callback) {
        callback = callback || function () {};
        if (tasks.constructor === Array) {
            chain.mapSeries(tasks, function (fn, callback) {
                if (fn) {
                    fn(function (err) {
                        var args = Array.prototype.slice.call(arguments, 1);
                        if (args.length <= 1) {
                            args = args[0];
                        }
                        callback.call(null, err, args);
                    });
                }
            }, callback);
        }
        else {
            var results = {};
            var errors = {};
            chain.forEachSeries(_keys(tasks), function (k, callback) {
                tasks[k](function (err) {
                    var args = Array.prototype.slice.call(arguments, 1);
                    if (args.length <= 1) {
                        args = args[0];
                    }
                    results[k] = args;
                    errors[k] = err;
                    callback(err);
                });
            }, function (err) {
                callback(errors, results);
            });
        }
    };

}());
