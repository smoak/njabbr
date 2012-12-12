/*
 * A collection of utility functions, mostly ported from jQuery
 */
(function(exports) {

  var class2type = {}, // [[Class]] -> type pairs
      core_hasOwn = class2type.hasOwnProperty,
      core_toString = class2type.toString;

  var isArray = Array.isArray || function(obj) {
    return type(obj) === "array";
  };
  exports.isArray = isArray;
      
  /**
   * Determine the internal JavaScript [[Class]] of an object.
   * 
   * @param obj Object to get the internal JavaScript [[Class]] of.
   */
  var type = function(obj) {
    return obj == null ?
      String(obj) : class2type[core_toString.call(obj)] || "object";
  };
  exports.type = type;

  /**
   * Check to see if an object is empty (contains no properties).
   *
   * Taken from jquery:
   * https://github.com/jquery/jquery/blob/master/src/core.js#L463
   *
   * @param obj The object that will be checked to see if it's empty.
   * @return boolean true if empty, false otherwise
   */
  exports.isEmptyObject = function(obj) {
    var name;
    for (name in obj) {
      return false;
    }
    return true;
  };

  String.prototype.fromJsonDate = function() {
    return eval(this.replace(/\/Date\((\d+)(\+|\-)?.*\)\//gi, "new Date($1)"));
  };
  
  /**
   * Check to see if an object is a plain object (created using "{}" or "new Object").
   *
   * Taken from jquery with a few modifications
   *
   * @param obj The object that will be checked to see if it's a plain object.
   * @return boolean
   */
  var isPlainObject = function(obj) {
    // Must be an Object.
    //
    if ( !obj || type(obj) !== "object" || obj.nodeType) {
      return false;
    }

    try {
      if (obj.constructor &&
          !core_hasOwn.call(obj, "constructor") &&
          !core_hasOwn.call(obj.constructor.prototype, "isPrototypeOf")) {
        return false;
      }
    } catch ( e ) {
      return false;
    }

    // Own properties are enumerated firstly, so to speed up,
    // if last one is own, then all properties are own.
    var key;
    for ( key in obj ) {}

    return key === undefined || hasOwn.call( obj, key );
  };
  module.exports.isPlainObject = isPlainObject;

  /**
   * Merge the contents of two or more objects together into the first object.
   *
   * Taken from jquery:
   * https://github.com/jquery/jquery/blob/master/src/core.js#L286
   *
   * @return 
   */
  exports.extend = function() {
    var options, name, src, copy, copyIsArray, clone,
        target = arguments[0] || {},
        i = 1,
        length = arguments.length,
        deep = false;

    // handle a deep copy
    if ( typeof target === "boolean" ) {
      deep = target;
      target = arguments[1] || {};
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
        // Extend the base object
        for ( name in options ) {
          src = target[ name ];
          copy = options[ name ];
          // Prevent never-ending loop
          if ( target === copy ) {
            continue;
          }

          // Recurse if we're merging plain objects or arrays
          if ( deep && copy && (isPlainObject(copy) || (copyIsArray = isArray(copy)) ) ) {
            if ( copyIsArray ) {
              copyIsArrayay = false;
              clone = src && isArray(src) ? src : [];
            } else {
              clone = src && isPlainObject(src) ? src : {};
            }
            // Never move original objects, clone them
            target[ name ] = extend( deep, clone, copy );
          } else if (copy !== undefined) { // Don't bring in undefined values
            target[name] = copy;
          }
        }
      }
    }
    // Return the modified object
    return target;
  };

  /**
   * Determine if the argument passed is a Javascript function object. 
   *
   * @param obj Object to test whether or not it is a function.
   */
  var isFunction = function(obj) {
    return type(obj) === "function";
  };
  exports.isFunction = isFunction;

  /**
   * A generic iterator function, which can be used to seamlessly iterate over both objects and arrays.
   * Arrays and array-like objects with a length property (such as a function's arguments object) are iterated by numeric index, from 0 to length-1.
   * Other objects are iterated via their named properties.
   *
   * @param object The object or array to iterate over.
   * @param callback(indexInArray, valueOfElement) The function that will be executed on every object.
   */
  exports.each = function(object, callback, args) {
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
  };

  /**
   * Creates a new Guid
   */
  exports.newId = function() {
    var S4 = function () {
      return (((1 + Math.random()) * 0x10000) | 0).toString(16).substring(1);
    };
    return (S4() + S4() + "-" + S4() + "-" + S4() + "-" + S4() + "-" + S4() + S4() + S4());
  };

  /**
   * Search for a specified value within an array and return its index (or -1 if not found).
   *
   * @param elem The value to search for.
   * @param array An array through which to search.
   * @param i The index of the array at which to begin the search. The default is 0, which will search the whole array.
   */
  exports.inArray = function(elem, array, i) {
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
  };

  /**
   * Merge the contents of two arrays together into the first array.
   *
   * @param first The first array to merge, the elements of second added.
   * @param second The second array to merge into the first, unaltered.
   */
  exports.merge = function(first, second) {
    var l = second.length,
        i = first.length,
        j = 0;
    if (typeof(l) === "number") {
      for ( ; j < l; j++ ) {
        first[i++] = second[j];
      }
    } else {
      while (second[j] !== undefined) {
        first[i++] = second[j++];
      }
    }
    first.length = i;
    return first;
  };

  /**
   * Convert an array-like object into a true JavaScript array.
   *
   * @param arr Any object to turn into a native Array.
   */
  exports.makeArray = function(arr, results) {
    var type,
        ret = results || [];
    if (arr != null) {
      type = exports.type(arr);
      if (arr.length == null || type === "string" || type === "function" || type === "regexp") {
        core_push.call(ret, arr);
      } else {
        exports.merge(ret, arr);
      }
    }
    return ret;
  };

  exports.each("Boolean Number String Function Array Date RegExp Object Error".split(" "), function(i, name) {
      class2type[ "[object " + name + "]" ] = name.toLowerCase();
  });

})(module.exports)
