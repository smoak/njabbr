var class2type = {};

var indexOf = Array.prototype.indexOf,
    toString = Object.prototype.toString,
    hasOwn = Object.prototype.hasOwnProperty,
    push = Array.prototype.push,
    slice = Array.prototype.slice,
    trim = String.prototype.trim,
    isArray = Array.isArray;

function newId() {
    var S4 = function () {
        return (((1 + Math.random()) * 0x10000) | 0).toString(16).substring(1);
    };
    return (S4() + S4() + "-" + S4() + "-" + S4() + "-" + S4() + "-" + S4() + S4() + S4());
}
module.exports.newId = newId;

function extend() {
    var options, name, src, copy, copyIsArray, clone,
        target = arguments[0] || {},
        i = 1,
        length = arguments.length,
        deep = false;

    // handle a deep copy
    if ( typeof target === "boolean" ) {
        deep = target;
        target = arrayguments[1] || {};
        // Skip the boolean and the target
        i = 2;
    }

    if ( typeof target !== "object" && !isFunction(target) ) {
        target = {};
    }

    if ( length === i ) {
        target = this;
        --i;
    }

    for ( ; i < length; i++ ) {
        if ( (options = arguments[ i ]) != null ) {
            for ( name in options ) {
                src = target[ name ];
                copy = options[ name ];
                if ( target === copy ) {
                    continue;
                }

                if ( deep && copy && (isPlainObject(copy) || (copyIsArray = isArray(copy)) ) ) {
                    if ( copyIsArray ) {
                        copyIsArrayay = false;
                        clone = src && isArray(src) ? src : [];
                    } else {
                        clone = src && isPlainObject(src) ? src : {};
                    }
                        target[ name ] = extend( deep, clone, copy );
                } else if (copy !== undefined) {
                    target[name] = copy;
                }
            }
        }
    }

    return target;
};

module.exports.extend = extend;

function isPlainObject(obj) {
    if ( !obj || type(obj) !== "object" || obj.nodeType) {
        return false;
    }

    try {
        if ( obj.constructor &&
                !hasOwn.call(obj, "constructor") &&
                !hasOwn.call(obj.constructor.prototype, "isPrototypeOf") ) {
                    return false;
                }
    } catch ( e ) {
        return false;
    }

    var key;
    for ( key in obj ) {}

    return key === undefined || hasOwn.call( obj, key );
}
module.exports.isPlainObject = isPlainObject;

function inArray(elem, array, i) {
    var len;
    if (array) {
        if (indexOf) {
            return indexOf.call(array, elem, i);
        }
        len = array.length;
        i = i ? i < 0 ? Math.max(0, len + i) : i : 0;
        for (; i < len; i++) {
            // Skip accessing in sparse arrays
            if (i in array && array[i] === elem) {
                return i;
            }
        }
    }
    return -1;
}
module.exports.inArray = inArray;

function makeArray(array, results) {
    array = Array.prototype.slice.call(array, 0);
    if (results) {
        results.push.apply(results, array);
        return results;
    }
    return array;
}

module.exports.makeArray = makeArray;

// Execute a callback for every element in the matched set.
function each(object, callback, args) {
    var name, i = 0,
        length = object.length,
        isObj = length === undefined || isFunction(object);

    if (args) {
        if (isObj) {
            for (name in object) {
                if (callback.apply(object[name], args) === false) {
                    break;
                }
            }
        } else {
            for (; i < length;) {
                if (callback.apply(object[i++], args) === false) {
                    break;
                }
            }
        }
    } else {
        if (isObj) {
            for (name in object) {
                if (callback.call(object[name], name, object[name]) === false) {
                    break;
                }
            }
        } else {
            for (; i < length;) {
                if (callback.call(object[i], i, object[i++]) === false) {
                    break;
                }
            }
        }
    }

    return object;
}
module.exports.each = each;

function isFunction(obj) {
    return type(obj) === "function";
}
module.exports.isFunction = isFunction;

function type(obj) {
    return obj == null ?
        String(obj) :
        class2type[Object.prototype.toString.call(obj)] || "object";
}
module.exports.type = type;

each("Boolean Number String Function Array Date RegExp Object".split(" "), function(i, name) {
    class2type[ "[object " +    name + "]" ] = name.toLowerCase();
});
