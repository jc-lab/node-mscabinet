
var Module = (function() {
  var _scriptDir = typeof document !== 'undefined' && document.currentScript ? document.currentScript.src : undefined;
  if (typeof __filename !== 'undefined') _scriptDir = _scriptDir || __filename;
  return (
function(Module) {
  Module = Module || {};

// Copyright 2010 The Emscripten Authors.  All rights reserved.
// Emscripten is available under two separate licenses, the MIT license and the
// University of Illinois/NCSA Open Source License.  Both these licenses can be
// found in the LICENSE file.

// The Module object: Our interface to the outside world. We import
// and export values on it. There are various ways Module can be used:
// 1. Not defined. We create it here
// 2. A function parameter, function(Module) { ..generated code.. }
// 3. pre-run appended it, var Module = {}; ..generated code..
// 4. External script tag defines var Module.
// We need to check if Module already exists (e.g. case 3 above).
// Substitution will be replaced with actual code on later stage of the build,
// this way Closure Compiler will not mangle it (e.g. case 4. above).
// Note that if you want to run closure, and also to use Module
// after the generated code, you will need to define   var Module = {};
// before the code. Then that object will be used in the code, and you
// can continue to use Module afterwards as well.
var Module = typeof Module !== 'undefined' ? Module : {};

// --pre-jses are emitted after the Module integration code, so that they can
// refer to Module (if they choose; they can also define Module)
// {{PRE_JSES}}

// Sometimes an existing Module object exists with properties
// meant to overwrite the default module functionality. Here
// we collect those properties and reapply _after_ we configure
// the current environment's defaults to avoid having to be so
// defensive during initialization.
var moduleOverrides = {};
var key;
for (key in Module) {
  if (Module.hasOwnProperty(key)) {
    moduleOverrides[key] = Module[key];
  }
}

var arguments_ = [];
var thisProgram = './this.program';
var quit_ = function(status, toThrow) {
  throw toThrow;
};

// Determine the runtime environment we are in. You can customize this by
// setting the ENVIRONMENT setting at compile time (see settings.js).

var ENVIRONMENT_IS_WEB = false;
var ENVIRONMENT_IS_WORKER = false;
var ENVIRONMENT_IS_NODE = false;
var ENVIRONMENT_HAS_NODE = false;
var ENVIRONMENT_IS_SHELL = false;
ENVIRONMENT_IS_WEB = typeof window === 'object';
ENVIRONMENT_IS_WORKER = typeof importScripts === 'function';
// A web environment like Electron.js can have Node enabled, so we must
// distinguish between Node-enabled environments and Node environments per se.
// This will allow the former to do things like mount NODEFS.
// Extended check using process.versions fixes issue #8816.
// (Also makes redundant the original check that 'require' is a function.)
ENVIRONMENT_HAS_NODE = typeof process === 'object' && typeof process.versions === 'object' && typeof process.versions.node === 'string';
ENVIRONMENT_IS_NODE = ENVIRONMENT_HAS_NODE && !ENVIRONMENT_IS_WEB && !ENVIRONMENT_IS_WORKER;
ENVIRONMENT_IS_SHELL = !ENVIRONMENT_IS_WEB && !ENVIRONMENT_IS_NODE && !ENVIRONMENT_IS_WORKER;

if (Module['ENVIRONMENT']) {
  throw new Error('Module.ENVIRONMENT has been deprecated. To force the environment, use the ENVIRONMENT compile-time option (for example, -s ENVIRONMENT=web or -s ENVIRONMENT=node)');
}



// `/` should be present at the end if `scriptDirectory` is not empty
var scriptDirectory = '';
function locateFile(path) {
  if (Module['locateFile']) {
    return Module['locateFile'](path, scriptDirectory);
  }
  return scriptDirectory + path;
}

// Hooks that are implemented differently in different runtime environments.
var read_,
    readAsync,
    readBinary,
    setWindowTitle;

var nodeFS;
var nodePath;

if (ENVIRONMENT_IS_NODE) {
  scriptDirectory = __dirname + '/';


  read_ = function shell_read(filename, binary) {
    var ret = tryParseAsDataURI(filename);
    if (ret) {
      return binary ? ret : ret.toString();
    }
    if (!nodeFS) nodeFS = require('fs');
    if (!nodePath) nodePath = require('path');
    filename = nodePath['normalize'](filename);
    return nodeFS['readFileSync'](filename, binary ? null : 'utf8');
  };

  readBinary = function readBinary(filename) {
    var ret = read_(filename, true);
    if (!ret.buffer) {
      ret = new Uint8Array(ret);
    }
    assert(ret.buffer);
    return ret;
  };




  if (process['argv'].length > 1) {
    thisProgram = process['argv'][1].replace(/\\/g, '/');
  }

  arguments_ = process['argv'].slice(2);

  // MODULARIZE will export the module in the proper place outside, we don't need to export here

  process['on']('uncaughtException', function(ex) {
    // suppress ExitStatus exceptions from showing an error
    if (!(ex instanceof ExitStatus)) {
      throw ex;
    }
  });

  process['on']('unhandledRejection', abort);

  quit_ = function(status) {
    process['exit'](status);
  };

  Module['inspect'] = function () { return '[Emscripten Module object]'; };


} else
if (ENVIRONMENT_IS_SHELL) {


  if (typeof read != 'undefined') {
    read_ = function shell_read(f) {
      var data = tryParseAsDataURI(f);
      if (data) {
        return intArrayToString(data);
      }
      return read(f);
    };
  }

  readBinary = function readBinary(f) {
    var data;
    data = tryParseAsDataURI(f);
    if (data) {
      return data;
    }
    if (typeof readbuffer === 'function') {
      return new Uint8Array(readbuffer(f));
    }
    data = read(f, 'binary');
    assert(typeof data === 'object');
    return data;
  };

  if (typeof scriptArgs != 'undefined') {
    arguments_ = scriptArgs;
  } else if (typeof arguments != 'undefined') {
    arguments_ = arguments;
  }

  if (typeof quit === 'function') {
    quit_ = function(status) {
      quit(status);
    };
  }

  if (typeof print !== 'undefined') {
    // Prefer to use print/printErr where they exist, as they usually work better.
    if (typeof console === 'undefined') console = {};
    console.log = print;
    console.warn = console.error = typeof printErr !== 'undefined' ? printErr : print;
  }
} else

// Note that this includes Node.js workers when relevant (pthreads is enabled).
// Node.js workers are detected as a combination of ENVIRONMENT_IS_WORKER and
// ENVIRONMENT_HAS_NODE.
if (ENVIRONMENT_IS_WEB || ENVIRONMENT_IS_WORKER) {
  if (ENVIRONMENT_IS_WORKER) { // Check worker, not web, since window could be polyfilled
    scriptDirectory = self.location.href;
  } else if (document.currentScript) { // web
    scriptDirectory = document.currentScript.src;
  }
  // When MODULARIZE (and not _INSTANCE), this JS may be executed later, after document.currentScript
  // is gone, so we saved it, and we use it here instead of any other info.
  if (_scriptDir) {
    scriptDirectory = _scriptDir;
  }
  // blob urls look like blob:http://site.com/etc/etc and we cannot infer anything from them.
  // otherwise, slice off the final part of the url to find the script directory.
  // if scriptDirectory does not contain a slash, lastIndexOf will return -1,
  // and scriptDirectory will correctly be replaced with an empty string.
  if (scriptDirectory.indexOf('blob:') !== 0) {
    scriptDirectory = scriptDirectory.substr(0, scriptDirectory.lastIndexOf('/')+1);
  } else {
    scriptDirectory = '';
  }


  // Differentiate the Web Worker from the Node Worker case, as reading must
  // be done differently.
  {


  read_ = function shell_read(url) {
    try {
      var xhr = new XMLHttpRequest();
      xhr.open('GET', url, false);
      xhr.send(null);
      return xhr.responseText;
    } catch (err) {
      var data = tryParseAsDataURI(url);
      if (data) {
        return intArrayToString(data);
      }
      throw err;
    }
  };

  if (ENVIRONMENT_IS_WORKER) {
    readBinary = function readBinary(url) {
      try {
        var xhr = new XMLHttpRequest();
        xhr.open('GET', url, false);
        xhr.responseType = 'arraybuffer';
        xhr.send(null);
        return new Uint8Array(xhr.response);
      } catch (err) {
        var data = tryParseAsDataURI(url);
        if (data) {
          return data;
        }
        throw err;
      }
    };
  }

  readAsync = function readAsync(url, onload, onerror) {
    var xhr = new XMLHttpRequest();
    xhr.open('GET', url, true);
    xhr.responseType = 'arraybuffer';
    xhr.onload = function xhr_onload() {
      if (xhr.status == 200 || (xhr.status == 0 && xhr.response)) { // file URLs can return 0
        onload(xhr.response);
        return;
      }
      var data = tryParseAsDataURI(url);
      if (data) {
        onload(data.buffer);
        return;
      }
      onerror();
    };
    xhr.onerror = onerror;
    xhr.send(null);
  };




  }

  setWindowTitle = function(title) { document.title = title };
} else
{
  throw new Error('environment detection error');
}


// Set up the out() and err() hooks, which are how we can print to stdout or
// stderr, respectively.
var out = Module['print'] || console.log.bind(console);
var err = Module['printErr'] || console.warn.bind(console);

// Merge back in the overrides
for (key in moduleOverrides) {
  if (moduleOverrides.hasOwnProperty(key)) {
    Module[key] = moduleOverrides[key];
  }
}
// Free the object hierarchy contained in the overrides, this lets the GC
// reclaim data used e.g. in memoryInitializerRequest, which is a large typed array.
moduleOverrides = null;

// Emit code to handle expected values on the Module object. This applies Module.x
// to the proper local x. This has two benefits: first, we only emit it if it is
// expected to arrive, and second, by using a local everywhere else that can be
// minified.
if (Module['arguments']) arguments_ = Module['arguments'];if (!Object.getOwnPropertyDescriptor(Module, 'arguments')) Object.defineProperty(Module, 'arguments', { configurable: true, get: function() { abort('Module.arguments has been replaced with plain arguments_') } });
if (Module['thisProgram']) thisProgram = Module['thisProgram'];if (!Object.getOwnPropertyDescriptor(Module, 'thisProgram')) Object.defineProperty(Module, 'thisProgram', { configurable: true, get: function() { abort('Module.thisProgram has been replaced with plain thisProgram') } });
if (Module['quit']) quit_ = Module['quit'];if (!Object.getOwnPropertyDescriptor(Module, 'quit')) Object.defineProperty(Module, 'quit', { configurable: true, get: function() { abort('Module.quit has been replaced with plain quit_') } });

// perform assertions in shell.js after we set up out() and err(), as otherwise if an assertion fails it cannot print the message
// Assertions on removed incoming Module JS APIs.
assert(typeof Module['memoryInitializerPrefixURL'] === 'undefined', 'Module.memoryInitializerPrefixURL option was removed, use Module.locateFile instead');
assert(typeof Module['pthreadMainPrefixURL'] === 'undefined', 'Module.pthreadMainPrefixURL option was removed, use Module.locateFile instead');
assert(typeof Module['cdInitializerPrefixURL'] === 'undefined', 'Module.cdInitializerPrefixURL option was removed, use Module.locateFile instead');
assert(typeof Module['filePackagePrefixURL'] === 'undefined', 'Module.filePackagePrefixURL option was removed, use Module.locateFile instead');
assert(typeof Module['read'] === 'undefined', 'Module.read option was removed (modify read_ in JS)');
assert(typeof Module['readAsync'] === 'undefined', 'Module.readAsync option was removed (modify readAsync in JS)');
assert(typeof Module['readBinary'] === 'undefined', 'Module.readBinary option was removed (modify readBinary in JS)');
assert(typeof Module['setWindowTitle'] === 'undefined', 'Module.setWindowTitle option was removed (modify setWindowTitle in JS)');
if (!Object.getOwnPropertyDescriptor(Module, 'read')) Object.defineProperty(Module, 'read', { configurable: true, get: function() { abort('Module.read has been replaced with plain read_') } });
if (!Object.getOwnPropertyDescriptor(Module, 'readAsync')) Object.defineProperty(Module, 'readAsync', { configurable: true, get: function() { abort('Module.readAsync has been replaced with plain readAsync') } });
if (!Object.getOwnPropertyDescriptor(Module, 'readBinary')) Object.defineProperty(Module, 'readBinary', { configurable: true, get: function() { abort('Module.readBinary has been replaced with plain readBinary') } });
// TODO: add when SDL2 is fixed if (!Object.getOwnPropertyDescriptor(Module, 'setWindowTitle')) Object.defineProperty(Module, 'setWindowTitle', { configurable: true, get: function() { abort('Module.setWindowTitle has been replaced with plain setWindowTitle') } });
var IDBFS = 'IDBFS is no longer included by default; build with -lidbfs.js';
var PROXYFS = 'PROXYFS is no longer included by default; build with -lproxyfs.js';
var WORKERFS = 'WORKERFS is no longer included by default; build with -lworkerfs.js';
var NODEFS = 'NODEFS is no longer included by default; build with -lnodefs.js';


// TODO remove when SDL2 is fixed (also see above)



// Copyright 2017 The Emscripten Authors.  All rights reserved.
// Emscripten is available under two separate licenses, the MIT license and the
// University of Illinois/NCSA Open Source License.  Both these licenses can be
// found in the LICENSE file.

// {{PREAMBLE_ADDITIONS}}

var STACK_ALIGN = 16;

// stack management, and other functionality that is provided by the compiled code,
// should not be used before it is ready
stackSave = stackRestore = stackAlloc = function() {
  abort('cannot use the stack before compiled code is ready to run, and has provided stack access');
};

function staticAlloc(size) {
  abort('staticAlloc is no longer available at runtime; instead, perform static allocations at compile time (using makeStaticAlloc)');
}

function dynamicAlloc(size) {
  assert(DYNAMICTOP_PTR);
  var ret = HEAP32[DYNAMICTOP_PTR>>2];
  var end = (ret + size + 15) & -16;
  if (end > _emscripten_get_heap_size()) {
    abort('failure to dynamicAlloc - memory growth etc. is not supported there, call malloc/sbrk directly');
  }
  HEAP32[DYNAMICTOP_PTR>>2] = end;
  return ret;
}

function alignMemory(size, factor) {
  if (!factor) factor = STACK_ALIGN; // stack alignment (16-byte) by default
  return Math.ceil(size / factor) * factor;
}

function getNativeTypeSize(type) {
  switch (type) {
    case 'i1': case 'i8': return 1;
    case 'i16': return 2;
    case 'i32': return 4;
    case 'i64': return 8;
    case 'float': return 4;
    case 'double': return 8;
    default: {
      if (type[type.length-1] === '*') {
        return 4; // A pointer
      } else if (type[0] === 'i') {
        var bits = parseInt(type.substr(1));
        assert(bits % 8 === 0, 'getNativeTypeSize invalid bits ' + bits + ', type ' + type);
        return bits / 8;
      } else {
        return 0;
      }
    }
  }
}

function warnOnce(text) {
  if (!warnOnce.shown) warnOnce.shown = {};
  if (!warnOnce.shown[text]) {
    warnOnce.shown[text] = 1;
    err(text);
  }
}

var asm2wasmImports = { // special asm2wasm imports
    "f64-rem": function(x, y) {
        return x % y;
    },
    "debugger": function() {
        debugger;
    }
};




// Wraps a JS function as a wasm function with a given signature.
function convertJsFunctionToWasm(func, sig) {
  return func;
}

// Add a wasm function to the table.
function addFunctionWasm(func, sig) {
  var table = wasmTable;
  var ret = table.length;

  // Grow the table
  try {
    table.grow(1);
  } catch (err) {
    if (!err instanceof RangeError) {
      throw err;
    }
    throw 'Unable to grow wasm table. Use a higher value for RESERVED_FUNCTION_POINTERS or set ALLOW_TABLE_GROWTH.';
  }

  // Insert new element
  try {
    // Attempting to call this with JS function will cause of table.set() to fail
    table.set(ret, func);
  } catch (err) {
    if (!err instanceof TypeError) {
      throw err;
    }
    assert(typeof sig !== 'undefined', 'Missing signature argument to addFunction');
    var wrapped = convertJsFunctionToWasm(func, sig);
    table.set(ret, wrapped);
  }

  return ret;
}

function removeFunctionWasm(index) {
  // TODO(sbc): Look into implementing this to allow re-using of table slots
}

// 'sig' parameter is required for the llvm backend but only when func is not
// already a WebAssembly function.
function addFunction(func, sig) {
  assert(typeof func !== 'undefined');

  return addFunctionWasm(func, sig);
}

function removeFunction(index) {
  removeFunctionWasm(index);
}

var funcWrappers = {};

function getFuncWrapper(func, sig) {
  if (!func) return; // on null pointer, return undefined
  assert(sig);
  if (!funcWrappers[sig]) {
    funcWrappers[sig] = {};
  }
  var sigCache = funcWrappers[sig];
  if (!sigCache[func]) {
    // optimize away arguments usage in common cases
    if (sig.length === 1) {
      sigCache[func] = function dynCall_wrapper() {
        return dynCall(sig, func);
      };
    } else if (sig.length === 2) {
      sigCache[func] = function dynCall_wrapper(arg) {
        return dynCall(sig, func, [arg]);
      };
    } else {
      // general case
      sigCache[func] = function dynCall_wrapper() {
        return dynCall(sig, func, Array.prototype.slice.call(arguments));
      };
    }
  }
  return sigCache[func];
}


function makeBigInt(low, high, unsigned) {
  return unsigned ? ((+((low>>>0)))+((+((high>>>0)))*4294967296.0)) : ((+((low>>>0)))+((+((high|0)))*4294967296.0));
}

function dynCall(sig, ptr, args) {
  if (args && args.length) {
    assert(args.length == sig.length-1);
    assert(('dynCall_' + sig) in Module, 'bad function pointer type - no table for sig \'' + sig + '\'');
    return Module['dynCall_' + sig].apply(null, [ptr].concat(args));
  } else {
    assert(sig.length == 1);
    assert(('dynCall_' + sig) in Module, 'bad function pointer type - no table for sig \'' + sig + '\'');
    return Module['dynCall_' + sig].call(null, ptr);
  }
}

var tempRet0 = 0;

var setTempRet0 = function(value) {
  tempRet0 = value;
};

var getTempRet0 = function() {
  return tempRet0;
};

function getCompilerSetting(name) {
  throw 'You must build with -s RETAIN_COMPILER_SETTINGS=1 for getCompilerSetting or emscripten_get_compiler_setting to work';
}

var Runtime = {
  // helpful errors
  getTempRet0: function() { abort('getTempRet0() is now a top-level function, after removing the Runtime object. Remove "Runtime."') },
  staticAlloc: function() { abort('staticAlloc() is now a top-level function, after removing the Runtime object. Remove "Runtime."') },
  stackAlloc: function() { abort('stackAlloc() is now a top-level function, after removing the Runtime object. Remove "Runtime."') },
};

// The address globals begin at. Very low in memory, for code size and optimization opportunities.
// Above 0 is static memory, starting with globals.
// Then the stack.
// Then 'dynamic' memory for sbrk.
var GLOBAL_BASE = 1024;




// === Preamble library stuff ===

// Documentation for the public APIs defined in this file must be updated in:
//    site/source/docs/api_reference/preamble.js.rst
// A prebuilt local version of the documentation is available at:
//    site/build/text/docs/api_reference/preamble.js.txt
// You can also build docs locally as HTML or other formats in site/
// An online HTML version (which may be of a different version of Emscripten)
//    is up at http://kripken.github.io/emscripten-site/docs/api_reference/preamble.js.html


var wasmBinary;if (Module['wasmBinary']) wasmBinary = Module['wasmBinary'];if (!Object.getOwnPropertyDescriptor(Module, 'wasmBinary')) Object.defineProperty(Module, 'wasmBinary', { configurable: true, get: function() { abort('Module.wasmBinary has been replaced with plain wasmBinary') } });
var noExitRuntime;if (Module['noExitRuntime']) noExitRuntime = Module['noExitRuntime'];if (!Object.getOwnPropertyDescriptor(Module, 'noExitRuntime')) Object.defineProperty(Module, 'noExitRuntime', { configurable: true, get: function() { abort('Module.noExitRuntime has been replaced with plain noExitRuntime') } });


// wasm2js.js - enough of a polyfill for the WebAssembly object so that we can load
// wasm2js code that way.

// Emit "var WebAssembly" if definitely using wasm2js. Otherwise, in MAYBE_WASM2JS
// mode, we can't use a "var" since it would prevent normal wasm from working.
var
WebAssembly = {
  Memory: function(opts) {
    return {
      buffer: new ArrayBuffer(opts['initial'] * 65536),
      grow: function(amount) {
        var oldBuffer = this.buffer;
        var ret = __growWasmMemory(amount);
        assert(this.buffer !== oldBuffer); // the call should have updated us
        return ret;
      }
    };
  },

  Table: function(opts) {
    var ret = new Array(opts['initial']);
    ret.grow = function(by) {
      if (ret.length >= 58 + 0) {
        abort('Unable to grow wasm table. Use a higher value for RESERVED_FUNCTION_POINTERS or set ALLOW_TABLE_GROWTH.')
      }
      ret.push(null);
    };
    ret.set = function(i, func) {
      ret[i] = func;
    };
    ret.get = function(i) {
      return ret[i];
    };
    return ret;
  },

  Module: function(binary) {
    // TODO: use the binary and info somehow - right now the wasm2js output is embedded in
    // the main JS
    return {};
  },

  Instance: function(module, info) {
    // TODO: use the module and info somehow - right now the wasm2js output is embedded in
    // the main JS
    // XXX hack to get an atob implementation

// Copied from https://github.com/strophe/strophejs/blob/e06d027/src/polyfills.js#L149

// This code was written by Tyler Akins and has been placed in the
// public domain.  It would be nice if you left this header intact.
// Base64 code from Tyler Akins -- http://rumkin.com

/**
 * Decodes a base64 string.
 * @param {String} input The string to decode.
 */
var decodeBase64 = typeof atob === 'function' ? atob : function (input) {
  var keyStr = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=';

  var output = '';
  var chr1, chr2, chr3;
  var enc1, enc2, enc3, enc4;
  var i = 0;
  // remove all characters that are not A-Z, a-z, 0-9, +, /, or =
  input = input.replace(/[^A-Za-z0-9\+\/\=]/g, '');
  do {
    enc1 = keyStr.indexOf(input.charAt(i++));
    enc2 = keyStr.indexOf(input.charAt(i++));
    enc3 = keyStr.indexOf(input.charAt(i++));
    enc4 = keyStr.indexOf(input.charAt(i++));

    chr1 = (enc1 << 2) | (enc2 >> 4);
    chr2 = ((enc2 & 15) << 4) | (enc3 >> 2);
    chr3 = ((enc3 & 3) << 6) | enc4;

    output = output + String.fromCharCode(chr1);

    if (enc3 !== 64) {
      output = output + String.fromCharCode(chr2);
    }
    if (enc4 !== 64) {
      output = output + String.fromCharCode(chr3);
    }
  } while (i < input.length);
  return output;
};

// Converts a string of base64 into a byte array.
// Throws error on invalid input.
function intArrayFromBase64(s) {
  if (typeof ENVIRONMENT_IS_NODE === 'boolean' && ENVIRONMENT_IS_NODE) {
    var buf;
    try {
      buf = Buffer.from(s, 'base64');
    } catch (_) {
      buf = new Buffer(s, 'base64');
    }
    return new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength);
  }

  try {
    var decoded = decodeBase64(s);
    var bytes = new Uint8Array(decoded.length);
    for (var i = 0 ; i < decoded.length ; ++i) {
      bytes[i] = decoded.charCodeAt(i);
    }
    return bytes;
  } catch (_) {
    throw new Error('Converting base64 string to bytes failed.');
  }
}

// If filename is a base64 data URI, parses and returns data (Buffer on node,
// Uint8Array otherwise). If filename is not a base64 data URI, returns undefined.
function tryParseAsDataURI(filename) {
  if (!isDataURI(filename)) {
    return;
  }

  return intArrayFromBase64(filename.slice(dataURIPrefix.length));
}


    var atob = decodeBase64;
    // This will be replaced by the actual wasm2js code.
    var exports = (
// EMSCRIPTEN_START_ASM
function instantiate(asmLibraryArg, wasmMemory, wasmTable) {

function asmFunc(global, env, buffer) {
 var memory = env.memory;
 var FUNCTION_TABLE = wasmTable;
 var HEAP8 = new global.Int8Array(buffer);
 var HEAP16 = new global.Int16Array(buffer);
 var HEAP32 = new global.Int32Array(buffer);
 var HEAPU8 = new global.Uint8Array(buffer);
 var HEAPU16 = new global.Uint16Array(buffer);
 var HEAPU32 = new global.Uint32Array(buffer);
 var HEAPF32 = new global.Float32Array(buffer);
 var HEAPF64 = new global.Float64Array(buffer);
 var Math_imul = global.Math.imul;
 var Math_fround = global.Math.fround;
 var Math_abs = global.Math.abs;
 var Math_clz32 = global.Math.clz32;
 var Math_min = global.Math.min;
 var Math_max = global.Math.max;
 var Math_floor = global.Math.floor;
 var Math_ceil = global.Math.ceil;
 var Math_sqrt = global.Math.sqrt;
 var abort = env.abort;
 var nan = global.NaN;
 var infinity = global.Infinity;
 var _embind_register_function = env._embind_register_function;
 var _embind_register_class = env._embind_register_class;
 var _embind_register_class_constructor = env._embind_register_class_constructor;
 var _embind_register_class_function = env._embind_register_class_function;
 var _embind_register_class_property = env._embind_register_class_property;
 var _embind_register_value_object = env._embind_register_value_object;
 var _embind_register_value_object_field = env._embind_register_value_object_field;
 var _embind_finalize_value_object = env._embind_finalize_value_object;
 var _emval_take_value = env._emval_take_value;
 var _emval_incref = env._emval_incref;
 var _emval_decref = env._emval_decref;
 var _emval_as = env._emval_as;
 var _emval_run_destructors = env._emval_run_destructors;
 var _emval_is_number = env._emval_is_number;
 var abort = env.abort;
 var __lock = env.__lock;
 var __unlock = env.__unlock;
 var _embind_register_void = env._embind_register_void;
 var _embind_register_bool = env._embind_register_bool;
 var _embind_register_std_string = env._embind_register_std_string;
 var _embind_register_std_wstring = env._embind_register_std_wstring;
 var _embind_register_emval = env._embind_register_emval;
 var _embind_register_integer = env._embind_register_integer;
 var _embind_register_float = env._embind_register_float;
 var _embind_register_memory_view = env._embind_register_memory_view;
 var emscripten_resize_heap = env.emscripten_resize_heap;
 var emscripten_memcpy_big = env.emscripten_memcpy_big;
 var __handle_stack_overflow = env.__handle_stack_overflow;
 var setTempRet0 = env.setTempRet0;
 var global$0 = 5247872;
 var global$1 = 4988;
 var global$2 = 0;
 var i64toi32_i32$HIGH_BITS = 0;
 // EMSCRIPTEN_START_FUNCS
function lzx_decode_28lzx_stream__2c_20int_29($0, $1) {
 var $2 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $20 = 0, $21 = 0, $22 = 0, $23 = 0, $24 = 0, $25 = 0, $26 = 0, $27 = 0, $28 = 0, $29 = 0, $30 = 0, $31 = 0, $32 = 0, $33 = 0, $34 = 0, $35 = 0, $36 = 0, $37 = 0, $38 = 0, $39 = 0, $40 = 0, $41 = 0, $42 = 0, $43 = 0, $44 = 0, $45 = 0, $46 = 0;
 $11 = global$0 - 16 | 0;
 $4 = $11;
 if ($4 >>> 0 < global$2 >>> 0) {
  __handle_stack_overflow();
 }
 global$0 = $4;
 $4 = HEAP32[$0 + 48 >> 2];
 $8 = HEAP32[$4 + 468 >> 2];
 if (!$8) {
  $28 = HEAP32[$0 + 8 >> 2];
  $29 = HEAP32[$0 + 12 >> 2];
  label$3 : {
   if (!HEAPU8[$4 + 93 | 0] | (($29 | 0) < 0 ? 1 : ($29 | 0) <= 0 ? $28 >>> 0 >= 1 ? 0 : 1 : 0)) {
    break label$3;
   }
   $10 = HEAP32[$4 + 88 >> 2];
   if ((64 - $10 | 0) < 16) {
    break label$3;
   }
   $12 = HEAP32[$0 >> 2];
   $5 = HEAPU8[$12 | 0];
   $6 = $5 >>> 24;
   $7 = $5 << 8;
   $5 = $6;
   $3 = $4;
   $2 = HEAP32[$3 + 80 >> 2];
   $6 = HEAP32[$3 + 84 >> 2] << 16 | $2 >>> 16;
   HEAP32[$3 + 80 >> 2] = HEAPU8[$3 + 92 | 0] | ($2 << 16 | $7);
   HEAP32[$3 + 84 >> 2] = $6 | $5;
   $3 = $29 + -1 | 0;
   $5 = $28 + -1 | 0;
   if ($5 >>> 0 < 4294967295) {
    $3 = $3 + 1 | 0;
   }
   $6 = $0;
   HEAP32[$6 + 8 >> 2] = $5;
   HEAP32[$6 + 12 >> 2] = $3;
   HEAP32[$6 >> 2] = $12 + 1;
   HEAP8[$4 + 93 | 0] = 0;
   HEAP32[$4 + 88 >> 2] = $10 + 16;
  }
  label$4 : {
   label$5 : {
    label$6 : {
     label$7 : {
      label$8 : {
       label$9 : {
        $7 = HEAP32[$4 >> 2];
        if (($7 | 0) <= 17) {
         $2 = $4;
         while (1) {
          $5 = $2 + 80 | 0;
          label$12 : {
           label$13 : {
            label$14 : {
             label$15 : {
              label$16 : {
               label$17 : {
                label$18 : {
                 label$19 : {
                  label$20 : {
                   label$21 : {
                    label$22 : {
                     label$23 : {
                      label$24 : {
                       while (1) {
                        if ($7 >>> 0 > 17) {
                         continue;
                        }
                        label$26 : {
                         label$27 : {
                          label$28 : {
                           label$29 : {
                            label$30 : {
                             label$31 : {
                              label$32 : {
                               label$33 : {
                                label$34 : {
                                 label$35 : {
                                  label$36 : {
                                   switch ($7 - 1 | 0) {
                                   case 2:
                                    $7 = HEAP32[$2 + 88 >> 2];
                                    break label$32;
                                   case 0:
                                    $7 = HEAPU8[$2 + 32 | 0];
                                    break label$35;
                                   case 16:
                                    break label$14;
                                   case 15:
                                    break label$15;
                                   case 14:
                                    break label$18;
                                   case 13:
                                    break label$19;
                                   case 12:
                                    break label$22;
                                   case 11:
                                    break label$23;
                                   case 10:
                                    break label$24;
                                   case 9:
                                    break label$29;
                                   case 3:
                                    break label$31;
                                   case 1:
                                    break label$34;
                                   case 8:
                                    break label$6;
                                   case 7:
                                    break label$7;
                                   case 4:
                                   case 5:
                                   case 6:
                                    break label$8;
                                   default:
                                    break label$36;
                                   }
                                  }
                                  label$39 : {
                                   $7 = HEAP32[$2 + 88 >> 2];
                                   if (($7 | 0) > 0) {
                                    break label$39;
                                   }
                                   $3 = lzx_br_fillup_28lzx_stream__2c_20lzx_br__29($0, $5);
                                   $7 = HEAP32[$2 + 88 >> 2];
                                   if ($3 | ($7 | 0) > 0) {
                                    break label$39;
                                   }
                                   $8 = 0;
                                   HEAP32[$2 >> 2] = 0;
                                   if ($1) {
                                    break label$5;
                                   }
                                   break label$4;
                                  }
                                  $3 = $7 + -1 | 0;
                                  HEAP32[$2 + 88 >> 2] = $3;
                                  $10 = HEAP32[$2 + 84 >> 2];
                                  $6 = $3 & 31;
                                  $7 = (32 <= ($3 & 63) >>> 0 ? $10 >>> $6 : ((1 << $6) - 1 & $10) << 32 - $6 | HEAP32[$2 + 80 >> 2] >>> $6) & 1;
                                  HEAP8[$2 + 32 | 0] = $7;
                                 }
                                 if (!($7 & 255)) {
                                  break label$34;
                                 }
                                 label$40 : {
                                  $9 = HEAP32[$2 + 88 >> 2];
                                  if (($9 | 0) > 31) {
                                   break label$40;
                                  }
                                  $3 = lzx_br_fillup_28lzx_stream__2c_20lzx_br__29($0, $5);
                                  $9 = HEAP32[$2 + 88 >> 2];
                                  if ($3 | ($9 | 0) > 31) {
                                   break label$40;
                                  }
                                  HEAP32[$2 >> 2] = 1;
                                  if ($1) {
                                   break label$5;
                                  }
                                  $8 = 0;
                                  break label$4;
                                 }
                                 $7 = $9 + -32 | 0;
                                 HEAP32[$2 + 88 >> 2] = $7;
                                 $3 = HEAP32[$2 + 84 >> 2];
                                 $9 = $9 + -16 | 0;
                                 $6 = $9 & 31;
                                 $12 = HEAP32[$2 + 80 >> 2];
                                 $8 = (32 <= ($9 & 63) >>> 0 ? $3 >>> $6 : ((1 << $6) - 1 & $3) << 32 - $6 | $12 >>> $6) << 16;
                                 $6 = $7;
                                 $10 = $6 & 31;
                                 HEAP32[$2 + 28 >> 2] = $8 | (32 <= ($6 & 63) >>> 0 ? $3 >>> $10 : ((1 << $10) - 1 & $3) << 32 - $10 | $12 >>> $10) & 65535;
                                 break label$33;
                                }
                                $7 = HEAP32[$2 + 88 >> 2];
                               }
                               label$41 : {
                                if (($7 | 0) > 2) {
                                 break label$41;
                                }
                                $3 = lzx_br_fillup_28lzx_stream__2c_20lzx_br__29($0, $5);
                                $7 = HEAP32[$2 + 88 >> 2];
                                if ($3 | ($7 | 0) > 2) {
                                 break label$41;
                                }
                                HEAP32[$2 >> 2] = 2;
                                if ($1) {
                                 break label$5;
                                }
                                $8 = 0;
                                break label$4;
                               }
                               $7 = $7 + -3 | 0;
                               HEAP32[$2 + 88 >> 2] = $7;
                               $10 = HEAP32[$2 + 84 >> 2];
                               $3 = $7;
                               $6 = $3 & 31;
                               $3 = (32 <= ($3 & 63) >>> 0 ? $10 >>> $6 : ((1 << $6) - 1 & $10) << 32 - $6 | HEAP32[$2 + 80 >> 2] >>> $6) & 7;
                               HEAP8[$2 + 33 | 0] = $3;
                               if ($3 + -1 >>> 0 > 2) {
                                break label$5;
                               }
                              }
                              label$42 : {
                               if (($7 | 0) > 23) {
                                break label$42;
                               }
                               $3 = lzx_br_fillup_28lzx_stream__2c_20lzx_br__29($0, $5);
                               $7 = HEAP32[$2 + 88 >> 2];
                               if ($3 | ($7 | 0) > 23) {
                                break label$42;
                               }
                               HEAP32[$2 >> 2] = 3;
                               if ($1) {
                                break label$5;
                               }
                               $8 = 0;
                               break label$4;
                              }
                              $9 = $7 + -24 | 0;
                              HEAP32[$2 + 88 >> 2] = $9;
                              $3 = HEAP32[$2 + 84 >> 2];
                              $7 = $7 + -8 | 0;
                              $6 = $7 & 31;
                              $12 = HEAP32[$2 + 80 >> 2];
                              $8 = (32 <= ($7 & 63) >>> 0 ? $3 >>> $6 : ((1 << $6) - 1 & $3) << 32 - $6 | $12 >>> $6) << 16 & 16711680;
                              $6 = $9;
                              $10 = $6 & 31;
                              $3 = $8 | (32 <= ($6 & 63) >>> 0 ? $3 >>> $10 : ((1 << $10) - 1 & $3) << 32 - $10 | $12 >>> $10) & 65535;
                              HEAP32[$2 + 36 >> 2] = $3;
                              if (!$3) {
                               break label$5;
                              }
                              HEAP32[$2 + 40 >> 2] = $3;
                              $3 = HEAPU8[$2 + 33 | 0] + -1 | 0;
                              if ($3 >>> 0 > 2) {
                               break label$28;
                              }
                              $7 = 11;
                              switch ($3 - 1 | 0) {
                              case 0:
                               break label$28;
                              case 1:
                               break label$30;
                              default:
                               break label$27;
                              }
                             }
                             $9 = HEAP32[$2 + 88 >> 2];
                            }
                            if ($9 & 15) {
                             $7 = $9 & -16;
                             break label$9;
                            }
                            label$44 : {
                             label$45 : {
                              if (($9 | 0) > 15) {
                               break label$45;
                              }
                              $4 = lzx_br_fillup_28lzx_stream__2c_20lzx_br__29($0, $5);
                              $9 = HEAP32[$2 + 88 >> 2];
                              if ($4) {
                               break label$45;
                              }
                              if (($9 | 0) < 16) {
                               break label$44;
                              }
                             }
                             $7 = $9 + -16 | 0;
                             break label$9;
                            }
                            HEAP32[$2 >> 2] = 4;
                            if ($1) {
                             break label$5;
                            }
                            $8 = 0;
                            break label$4;
                           }
                           $6 = $2 + 96 | 0;
                           $7 = HEAP32[$2 + 96 >> 2];
                           if (HEAP32[$2 + 88 >> 2] >= (Math_imul($7, 3) | 0)) {
                            break label$26;
                           }
                           if (lzx_br_fillup_28lzx_stream__2c_20lzx_br__29($0, $5)) {
                            $7 = HEAP32[$6 >> 2];
                            break label$26;
                           }
                           $7 = HEAP32[$2 + 96 >> 2];
                           if (HEAP32[$2 + 88 >> 2] >= (Math_imul($7, 3) | 0)) {
                            break label$26;
                           }
                           HEAP32[$2 >> 2] = 10;
                           if ($1) {
                            break label$5;
                           }
                           $8 = 0;
                           break label$4;
                          }
                          $7 = 10;
                         }
                         HEAP32[$2 >> 2] = $7;
                         continue;
                        }
                        break;
                       }
                       memset($2 + 100 | 0, 68);
                       if (($7 | 0) >= 1) {
                        $8 = HEAP32[$2 + 168 >> 2];
                        $9 = HEAP32[$2 + 88 >> 2];
                        $7 = 0;
                        while (1) {
                         $5 = HEAP32[$2 + 84 >> 2];
                         $12 = $9 + -3 | 0;
                         $3 = $12 & 31;
                         HEAP8[$7 + $8 | 0] = (32 <= ($12 & 63) >>> 0 ? $5 >>> $3 : ((1 << $3) - 1 & $5) << 32 - $3 | HEAP32[$2 + 80 >> 2] >>> $3) & 7;
                         $8 = HEAP32[$2 + 168 >> 2];
                         $3 = $6 + (HEAPU8[$7 + $8 | 0] << 2) | 0;
                         HEAP32[$3 + 4 >> 2] = HEAP32[$3 + 4 >> 2] + 1;
                         $9 = HEAP32[$2 + 88 >> 2] + -3 | 0;
                         HEAP32[$2 + 88 >> 2] = $9;
                         $7 = $7 + 1 | 0;
                         if (($7 | 0) < HEAP32[$2 + 96 >> 2]) {
                          continue;
                         }
                         break;
                        }
                       }
                       if (!lzx_make_huffman_table_28huffman__29($6)) {
                        break label$5;
                       }
                      }
                      HEAP32[$2 + 464 >> 2] = 0;
                     }
                     $3 = HEAP32[$0 + 48 >> 2];
                     $8 = HEAP32[$3 + 464 >> 2];
                     if (!$8) {
                      memset($3 + 376 | 0, 68);
                     }
                     if (($8 | 0) < HEAP32[$3 + 372 >> 2]) {
                      $10 = $3 + 80 | 0;
                      $9 = HEAP32[$3 + 88 >> 2];
                      while (1) {
                       label$52 : {
                        if (($9 | 0) > 3) {
                         break label$52;
                        }
                        $6 = lzx_br_fillup_28lzx_stream__2c_20lzx_br__29($0, $10);
                        $9 = HEAP32[$3 + 88 >> 2];
                        if ($6) {
                         break label$52;
                        }
                        if (($9 | 0) < 4) {
                         break label$21;
                        }
                       }
                       $5 = HEAP32[$3 + 84 >> 2];
                       $7 = $9 + -4 | 0;
                       $6 = $7 & 31;
                       HEAP8[HEAP32[$3 + 444 >> 2] + $8 | 0] = (32 <= ($7 & 63) >>> 0 ? $5 >>> $6 : ((1 << $6) - 1 & $5) << 32 - $6 | HEAP32[$3 + 80 >> 2] >>> $6) & 15;
                       $6 = $3 + (HEAPU8[HEAP32[$3 + 444 >> 2] + $8 | 0] << 2) | 0;
                       HEAP32[$6 + 376 >> 2] = HEAP32[$6 + 376 >> 2] + 1;
                       $9 = HEAP32[$3 + 88 >> 2] + -4 | 0;
                       HEAP32[$3 + 88 >> 2] = $9;
                       $8 = $8 + 1 | 0;
                       if (($8 | 0) < HEAP32[$3 + 372 >> 2]) {
                        continue;
                       }
                       break;
                      }
                     }
                     HEAP32[$3 + 464 >> 2] = $8;
                     if (!lzx_make_huffman_table_28huffman__29($2 + 372 | 0)) {
                      break label$5;
                     }
                     HEAP32[$2 + 464 >> 2] = 0;
                    }
                    $3 = lzx_read_bitlen_28lzx_stream__2c_20huffman__2c_20int_29($0, $2 + 280 | 0, 256);
                    if (($3 | 0) < 0) {
                     break label$5;
                    }
                    if ($3) {
                     break label$20;
                    }
                    HEAP32[$2 >> 2] = 13;
                    if ($1) {
                     break label$5;
                    }
                    $8 = 0;
                    break label$4;
                   }
                   HEAP32[$3 + 464 >> 2] = $8;
                   HEAP32[$2 >> 2] = 12;
                   if ($1) {
                    break label$5;
                   }
                   $8 = 0;
                   break label$4;
                  }
                  HEAP32[$2 + 464 >> 2] = 0;
                 }
                 $3 = HEAP32[$0 + 48 >> 2];
                 $8 = HEAP32[$3 + 464 >> 2];
                 if (!$8) {
                  memset($3 + 376 | 0, 68);
                 }
                 if (($8 | 0) < HEAP32[$3 + 372 >> 2]) {
                  $10 = $3 + 80 | 0;
                  $9 = HEAP32[$3 + 88 >> 2];
                  while (1) {
                   label$56 : {
                    if (($9 | 0) > 3) {
                     break label$56;
                    }
                    $6 = lzx_br_fillup_28lzx_stream__2c_20lzx_br__29($0, $10);
                    $9 = HEAP32[$3 + 88 >> 2];
                    if ($6) {
                     break label$56;
                    }
                    if (($9 | 0) < 4) {
                     break label$17;
                    }
                   }
                   $5 = HEAP32[$3 + 84 >> 2];
                   $7 = $9 + -4 | 0;
                   $6 = $7 & 31;
                   HEAP8[HEAP32[$3 + 444 >> 2] + $8 | 0] = (32 <= ($7 & 63) >>> 0 ? $5 >>> $6 : ((1 << $6) - 1 & $5) << 32 - $6 | HEAP32[$3 + 80 >> 2] >>> $6) & 15;
                   $6 = $3 + (HEAPU8[HEAP32[$3 + 444 >> 2] + $8 | 0] << 2) | 0;
                   HEAP32[$6 + 376 >> 2] = HEAP32[$6 + 376 >> 2] + 1;
                   $9 = HEAP32[$3 + 88 >> 2] + -4 | 0;
                   HEAP32[$3 + 88 >> 2] = $9;
                   $8 = $8 + 1 | 0;
                   if (($8 | 0) < HEAP32[$3 + 372 >> 2]) {
                    continue;
                   }
                   break;
                  }
                 }
                 HEAP32[$3 + 464 >> 2] = $8;
                 if (!lzx_make_huffman_table_28huffman__29($2 + 372 | 0)) {
                  break label$5;
                 }
                 HEAP32[$2 + 464 >> 2] = 256;
                }
                $3 = $2 + 280 | 0;
                $6 = lzx_read_bitlen_28lzx_stream__2c_20huffman__2c_20int_29($0, $3, -1);
                if (($6 | 0) < 0) {
                 break label$5;
                }
                if ($6) {
                 break label$16;
                }
                HEAP32[$2 >> 2] = 15;
                if ($1) {
                 break label$5;
                }
                $8 = 0;
                break label$4;
               }
               HEAP32[$3 + 464 >> 2] = $8;
               HEAP32[$2 >> 2] = 14;
               if ($1) {
                break label$5;
               }
               $8 = 0;
               break label$4;
              }
              if (!lzx_make_huffman_table_28huffman__29($3)) {
               break label$5;
              }
              HEAP32[$2 + 464 >> 2] = 0;
             }
             $3 = HEAP32[$0 + 48 >> 2];
             $8 = HEAP32[$3 + 464 >> 2];
             if (!$8) {
              memset($3 + 376 | 0, 68);
             }
             if (($8 | 0) < HEAP32[$3 + 372 >> 2]) {
              $10 = $3 + 80 | 0;
              $9 = HEAP32[$3 + 88 >> 2];
              while (1) {
               label$60 : {
                if (($9 | 0) > 3) {
                 break label$60;
                }
                $6 = lzx_br_fillup_28lzx_stream__2c_20lzx_br__29($0, $10);
                $9 = HEAP32[$3 + 88 >> 2];
                if ($6) {
                 break label$60;
                }
                if (($9 | 0) < 4) {
                 break label$13;
                }
               }
               $5 = HEAP32[$3 + 84 >> 2];
               $7 = $9 + -4 | 0;
               $6 = $7 & 31;
               HEAP8[HEAP32[$3 + 444 >> 2] + $8 | 0] = (32 <= ($7 & 63) >>> 0 ? $5 >>> $6 : ((1 << $6) - 1 & $5) << 32 - $6 | HEAP32[$3 + 80 >> 2] >>> $6) & 15;
               $6 = $3 + (HEAPU8[HEAP32[$3 + 444 >> 2] + $8 | 0] << 2) | 0;
               HEAP32[$6 + 376 >> 2] = HEAP32[$6 + 376 >> 2] + 1;
               $9 = HEAP32[$3 + 88 >> 2] + -4 | 0;
               HEAP32[$3 + 88 >> 2] = $9;
               $8 = $8 + 1 | 0;
               if (($8 | 0) < HEAP32[$3 + 372 >> 2]) {
                continue;
               }
               break;
              }
             }
             HEAP32[$3 + 464 >> 2] = $8;
             if (!lzx_make_huffman_table_28huffman__29($2 + 372 | 0)) {
              break label$5;
             }
             HEAP32[$2 + 464 >> 2] = 0;
            }
            $3 = $2 + 188 | 0;
            $6 = lzx_read_bitlen_28lzx_stream__2c_20huffman__2c_20int_29($0, $3, -1);
            if (($6 | 0) < 0) {
             break label$5;
            }
            if ($6) {
             break label$12;
            }
            HEAP32[$2 >> 2] = 17;
            if ($1) {
             break label$5;
            }
            $8 = 0;
            break label$4;
           }
           HEAP32[$3 + 464 >> 2] = $8;
           HEAP32[$2 >> 2] = 16;
           if ($1) {
            break label$5;
           }
           $8 = 0;
           break label$4;
          }
          if (!lzx_make_huffman_table_28huffman__29($3)) {
           break label$5;
          }
          HEAP32[$2 >> 2] = 18;
          $2 = HEAP32[$0 + 48 >> 2];
          if (HEAP32[$4 >> 2] > 17) {
           $4 = $2;
          } else {
           $7 = HEAP32[$2 >> 2];
           continue;
          }
          break;
         }
        }
        $31 = HEAP32[$0 + 32 >> 2];
        $45 = HEAP32[$0 + 36 >> 2];
        $3 = HEAP32[$4 + 92 >> 2];
        HEAP32[$11 + 8 >> 2] = HEAP32[$4 + 88 >> 2];
        HEAP32[$11 + 12 >> 2] = $3;
        $3 = HEAP32[$4 + 84 >> 2];
        HEAP32[$11 >> 2] = HEAP32[$4 + 80 >> 2];
        HEAP32[$11 + 4 >> 2] = $3;
        $7 = HEAP32[$0 + 24 >> 2];
        $20 = $31 + $7 | 0;
        $17 = $4;
        $30 = HEAP32[$4 + 172 >> 2];
        $36 = ($30 << 2) + 1072 | 0;
        $24 = HEAP32[$4 + 264 >> 2];
        $37 = ($24 << 2) + 1072 | 0;
        $18 = HEAP32[$4 + 356 >> 2];
        $32 = ($18 << 2) + 1072 | 0;
        $33 = HEAP32[$4 + 352 >> 2];
        $38 = HEAP32[$4 + 260 >> 2];
        $39 = HEAP32[$4 + 168 >> 2];
        $9 = HEAP32[$4 >> 2];
        $5 = HEAP32[$4 + 52 >> 2];
        $6 = HEAP32[$4 + 48 >> 2];
        $10 = HEAP32[$4 + 44 >> 2];
        $21 = HEAP32[$4 + 68 >> 2];
        $19 = HEAP32[$4 + 72 >> 2];
        $25 = HEAP32[$4 + 64 >> 2];
        $40 = HEAP32[$4 + 4 >> 2];
        $26 = HEAP32[$4 + 8 >> 2];
        $14 = HEAP32[$4 + 16 >> 2];
        $12 = HEAP32[$4 + 20 >> 2];
        $16 = HEAP32[$4 + 24 >> 2];
        $15 = HEAP32[$4 + 40 >> 2];
        $27 = HEAP32[$4 + 12 >> 2];
        $41 = HEAP32[$4 + 76 >> 2];
        $34 = $4;
        $35 = $4;
        $42 = $4;
        $43 = $4;
        $46 = HEAPU8[$4 + 33 | 0] != 2;
        $44 = $4;
        $13 = $4;
        label$63 : {
         label$64 : {
          label$65 : {
           label$66 : {
            label$67 : {
             label$68 : {
              while (1) {
               $4 = $6;
               label$70 : {
                label$71 : {
                 label$72 : {
                  label$73 : {
                   label$74 : while (1) {
                    $6 = $4;
                    $2 = $12;
                    $8 = $10;
                    $3 = $5;
                    while (1) {
                     $4 = $8;
                     while (1) {
                      $12 = $2;
                      $22 = $9;
                      $5 = $9 + -18 | 0;
                      if ($5 >>> 0 > 4) {
                       $10 = $4;
                       $4 = $6;
                       $5 = $3;
                       continue label$74;
                      }
                      label$78 : {
                       switch ($5 - 1 | 0) {
                       default:
                        if (!$15) {
                         break label$66;
                        }
                        label$80 : {
                         if (!$1) {
                          while (1) {
                           if ($7 >>> 0 >= $20 >>> 0) {
                            break label$65;
                           }
                           $9 = HEAP32[$11 + 8 >> 2];
                           label$83 : {
                            if (($9 | 0) >= ($18 | 0)) {
                             break label$83;
                            }
                            $5 = lzx_br_fillup_28lzx_stream__2c_20lzx_br__29($0, $11);
                            $9 = HEAP32[$11 + 8 >> 2];
                            if ($5) {
                             break label$83;
                            }
                            if (($18 | 0) > ($9 | 0)) {
                             break label$65;
                            }
                           }
                           $2 = HEAP32[$11 + 4 >> 2];
                           $8 = $9 - $18 | 0;
                           $5 = $8 & 31;
                           $2 = HEAPU16[HEAP32[$34 + 368 >> 2] + ((HEAP32[$32 >> 2] & (32 <= ($8 & 63) >>> 0 ? $2 >>> $5 : ((1 << $5) - 1 & $2) << 32 - $5 | HEAP32[$11 >> 2] >>> $5)) << 1) >> 1];
                           $5 = HEAP32[$35 + 280 >> 2] > ($2 | 0) ? $2 : 0;
                           HEAP32[$11 + 8 >> 2] = $9 - HEAPU8[$5 + $33 | 0];
                           if ($5 >>> 0 > 255) {
                            break label$80;
                           }
                           HEAP8[$14 + $27 | 0] = $5;
                           HEAP8[$7 | 0] = $5;
                           $7 = $7 + 1 | 0;
                           $14 = $14 + 1 & $26;
                           $15 = $15 + -1 | 0;
                           if ($15) {
                            continue;
                           }
                           break label$66;
                          }
                         }
                         while (1) {
                          $5 = 18;
                          if ($7 >>> 0 >= $20 >>> 0) {
                           break label$67;
                          }
                          label$85 : {
                           label$86 : {
                            $8 = HEAP32[$11 + 8 >> 2];
                            if (($8 | 0) >= ($18 | 0)) {
                             break label$86;
                            }
                            $5 = lzx_br_fillup_28lzx_stream__2c_20lzx_br__29($0, $11);
                            $8 = HEAP32[$11 + 8 >> 2];
                            if ($5 | ($18 | 0) <= ($8 | 0)) {
                             break label$86;
                            }
                            $10 = $18 - $8 | 0;
                            $2 = HEAPU16[HEAP32[$34 + 368 >> 2] + ((HEAP32[$32 >> 2] & (32 <= ($10 & 63) >>> 0 ? 0 : HEAP32[$11 >> 2] << ($10 & 31))) << 1) >> 1];
                            $2 = HEAP32[$35 + 280 >> 2] > ($2 | 0) ? $2 : 0;
                            $5 = $8 - HEAPU8[$33 + $2 | 0] | 0;
                            HEAP32[$11 + 8 >> 2] = $5;
                            if (($5 | 0) > -1) {
                             break label$85;
                            }
                            break label$70;
                           }
                           $5 = $8;
                           $10 = HEAP32[$11 + 4 >> 2];
                           $8 = $8 - $18 | 0;
                           $2 = $8 & 31;
                           $2 = HEAPU16[HEAP32[$34 + 368 >> 2] + ((HEAP32[$32 >> 2] & (32 <= ($8 & 63) >>> 0 ? $10 >>> $2 : ((1 << $2) - 1 & $10) << 32 - $2 | HEAP32[$11 >> 2] >>> $2)) << 1) >> 1];
                           $2 = HEAP32[$35 + 280 >> 2] > ($2 | 0) ? $2 : 0;
                           HEAP32[$11 + 8 >> 2] = $5 - HEAPU8[$33 + $2 | 0];
                          }
                          if (($2 | 0) > 255) {
                           break label$80;
                          }
                          HEAP8[$14 + $27 | 0] = $2;
                          HEAP8[$7 | 0] = $2;
                          $7 = $7 + 1 | 0;
                          $14 = $14 + 1 & $26;
                          $15 = $15 + -1 | 0;
                          if ($15) {
                           continue;
                          }
                          break;
                         }
                         break label$66;
                        }
                        $5 = $2 + -256 | 0;
                        $21 = $5 >> 3;
                        $25 = $5 & 7;
                        break;
                       case 3:
                        break label$71;
                       case 2:
                        break label$72;
                       case 1:
                        break label$73;
                       case 0:
                        break label$78;
                       }
                      }
                      $5 = $25;
                      if (($5 | 0) == 7) {
                       label$88 : {
                        label$89 : {
                         label$90 : {
                          $2 = HEAP32[$11 + 8 >> 2];
                          if (($2 | 0) >= ($24 | 0)) {
                           break label$90;
                          }
                          $5 = lzx_br_fillup_28lzx_stream__2c_20lzx_br__29($0, $11);
                          $2 = HEAP32[$11 + 8 >> 2];
                          if ($5 | ($24 | 0) <= ($2 | 0)) {
                           break label$90;
                          }
                          if ($1) {
                           break label$89;
                          }
                          $25 = 7;
                          $5 = 19;
                          break label$67;
                         }
                         $5 = $2;
                         $10 = HEAP32[$11 + 4 >> 2];
                         $9 = $2 - $24 | 0;
                         $2 = $9 & 31;
                         $2 = HEAPU16[HEAP32[$42 + 276 >> 2] + ((HEAP32[$37 >> 2] & (32 <= ($9 & 63) >>> 0 ? $10 >>> $2 : ((1 << $2) - 1 & $10) << 32 - $2 | HEAP32[$11 >> 2] >>> $2)) << 1) >> 1];
                         $8 = HEAP32[$43 + 188 >> 2] > ($2 | 0) ? $2 : 0;
                         HEAP32[$11 + 8 >> 2] = $5 - HEAPU8[$38 + $8 | 0];
                         break label$88;
                        }
                        $5 = $2;
                        $2 = $24 - $2 | 0;
                        $2 = HEAPU16[HEAP32[$42 + 276 >> 2] + ((HEAP32[$37 >> 2] & (32 <= ($2 & 63) >>> 0 ? 0 : HEAP32[$11 >> 2] << ($2 & 31))) << 1) >> 1];
                        $8 = HEAP32[$43 + 188 >> 2] > ($2 | 0) ? $2 : 0;
                        $5 = $5 - HEAPU8[$38 + $8 | 0] | 0;
                        HEAP32[$11 + 8 >> 2] = $5;
                        if (($5 | 0) <= -1) {
                         break label$70;
                        }
                       }
                       $5 = $8 + 7 | 0;
                      }
                      $16 = $5 + 2 | 0;
                      if ($16 >>> 0 > $15 >>> 0) {
                       break label$70;
                      }
                      $9 = 21;
                      $2 = $4;
                      if (!$21) {
                       continue;
                      }
                      break;
                     }
                     $23 = $21 + -1 | 0;
                     if ($23 >>> 0 <= 1) {
                      $12 = $6;
                      $10 = $6;
                      $5 = $3;
                      $2 = $3;
                      $8 = $2;
                      $3 = $4;
                      if ($23 - 1) {
                       continue label$74;
                      }
                      continue;
                     }
                     break;
                    }
                    break;
                   }
                   $19 = HEAP32[(($21 << 3) + $41 | 0) + 4 >> 2];
                  }
                  label$93 : {
                   if (!(($19 | 0) < 3 | $46)) {
                    label$95 : {
                     $8 = HEAP32[$11 + 8 >> 2];
                     $2 = $19 + -3 | 0;
                     if (($8 | 0) >= ($2 | 0)) {
                      break label$95;
                     }
                     $5 = lzx_br_fillup_28lzx_stream__2c_20lzx_br__29($0, $11);
                     $8 = HEAP32[$11 + 8 >> 2];
                     if ($5 | ($8 | 0) >= ($2 | 0)) {
                      break label$95;
                     }
                     if ($1) {
                      break label$70;
                     }
                     break label$68;
                    }
                    $5 = HEAP32[$11 + 4 >> 2];
                    $9 = $8 - $2 | 0;
                    $10 = $9 & 31;
                    $23 = HEAP32[$11 >> 2];
                    $12 = (HEAP32[($2 << 2) + 1072 >> 2] & (32 <= ($9 & 63) >>> 0 ? $5 >>> $10 : ((1 << $10) - 1 & $5) << 32 - $10 | $23 >>> $10)) << 3;
                    label$96 : {
                     $10 = $8;
                     $8 = $2 + $30 | 0;
                     if (($10 | 0) < ($8 | 0)) {
                      $5 = !lzx_br_fillup_28lzx_stream__2c_20lzx_br__29($0, $11);
                      $10 = HEAP32[$11 + 8 >> 2];
                      if (($10 | 0) < ($8 | 0) ? $5 : 0) {
                       break label$96;
                      }
                      $23 = HEAP32[$11 >> 2];
                      $9 = $10 - $2 | 0;
                      $5 = HEAP32[$11 + 4 >> 2];
                     }
                     HEAP32[$11 + 8 >> 2] = $9;
                     $10 = $9 - $30 | 0;
                     $3 = $10 & 31;
                     $3 = HEAPU16[HEAP32[$44 + 184 >> 2] + ((HEAP32[$36 >> 2] & (32 <= ($10 & 63) >>> 0 ? $5 >>> $3 : ((1 << $3) - 1 & $5) << 32 - $3 | $23 >>> $3)) << 1) >> 1];
                     $3 = HEAP32[$13 + 96 >> 2] > ($3 | 0) ? $3 : 0;
                     HEAP32[$11 + 8 >> 2] = $9 - HEAPU8[$3 + $39 | 0];
                     $2 = $3 + $12 | 0;
                     break label$93;
                    }
                    if (!$1) {
                     break label$68;
                    }
                    $3 = $10 - $2 | 0;
                    HEAP32[$11 + 8 >> 2] = $3;
                    $5 = $3;
                    $3 = $30 - $3 | 0;
                    $3 = HEAPU16[HEAP32[$44 + 184 >> 2] + ((HEAP32[$36 >> 2] & (32 <= ($3 & 63) >>> 0 ? 0 : HEAP32[$11 >> 2] << ($3 & 31))) << 1) >> 1];
                    $3 = HEAP32[$13 + 96 >> 2] > ($3 | 0) ? $3 : 0;
                    $5 = $5 - HEAPU8[$3 + $39 | 0] | 0;
                    HEAP32[$11 + 8 >> 2] = $5;
                    if (($5 | 0) <= -1) {
                     break label$70;
                    }
                    $2 = $3 + $12 | 0;
                    break label$93;
                   }
                   label$98 : {
                    $2 = HEAP32[$11 + 8 >> 2];
                    if (($2 | 0) >= ($19 | 0)) {
                     break label$98;
                    }
                    $5 = lzx_br_fillup_28lzx_stream__2c_20lzx_br__29($0, $11);
                    $2 = HEAP32[$11 + 8 >> 2];
                    if ($5 | ($2 | 0) >= ($19 | 0)) {
                     break label$98;
                    }
                    if (!$1) {
                     break label$68;
                    }
                    break label$70;
                   }
                   $3 = $2 - $19 | 0;
                   HEAP32[$11 + 8 >> 2] = $3;
                   $2 = HEAP32[$11 + 4 >> 2];
                   $5 = $3 & 31;
                   $2 = HEAP32[($19 << 2) + 1072 >> 2] & (32 <= ($3 & 63) >>> 0 ? $2 >>> $5 : ((1 << $5) - 1 & $2) << 32 - $5 | HEAP32[$11 >> 2] >>> $5);
                  }
                  $5 = $4;
                  $3 = $6;
                  $12 = ($2 + HEAP32[($21 << 3) + $41 >> 2] | 0) + -2 | 0;
                  $4 = $12;
                  $6 = $5;
                 }
                 $12 = $14 - $12 & $26;
                }
                $5 = $3;
                $10 = $4;
                while (1) {
                 $3 = $12 + $27 | 0;
                 $4 = ($12 | 0) > ($14 | 0) ? $40 - $12 | 0 : $40 - $14 | 0;
                 $4 = ($16 | 0) > ($4 | 0) ? $4 : $16;
                 $4 = $4 + $7 >>> 0 < $20 >>> 0 ? $4 : $20 - $7 | 0;
                 label$100 : {
                  label$101 : {
                   if (($4 | 0) >= 8) {
                    if (($4 + $14 | 0) >= ($12 | 0) ? ($4 + $12 | 0) >= ($14 | 0) : 0) {
                     break label$101;
                    }
                    memcpy($14 + $27 | 0, $3, $4);
                    memcpy($7, $3, $4);
                    break label$100;
                   }
                   if (($4 | 0) < 1) {
                    break label$100;
                   }
                  }
                  $8 = $14 + $27 | 0;
                  $2 = 0;
                  while (1) {
                   $9 = HEAPU8[$2 + $3 | 0];
                   HEAP8[$2 + $8 | 0] = $9;
                   HEAP8[$2 + $7 | 0] = $9;
                   $2 = $2 + 1 | 0;
                   if (($4 | 0) != ($2 | 0)) {
                    continue;
                   }
                   break;
                  }
                 }
                 $7 = $4 + $7 | 0;
                 $8 = $7 >>> 0 < $20 >>> 0;
                 $3 = ($16 | 0) > ($4 | 0);
                 $22 = $3 ? $8 ? $22 : 22 : $22;
                 $15 = $15 - $4 | 0;
                 $14 = $4 + $14 & $26;
                 $12 = $4 + $12 & $26;
                 $16 = $16 - ($3 ? $4 : 0) | 0;
                 $4 = $3 ? $8 ? 0 : 7 : 10;
                 if (!$4) {
                  continue;
                 }
                 break;
                }
                $4 = $4 + -7 | 0;
                if ($4 >>> 0 > 3) {
                 break label$63;
                }
                $9 = 18;
                switch ($4 - 1 | 0) {
                case 0:
                case 1:
                 break label$63;
                case 2:
                 continue;
                default:
                 break label$64;
                }
               }
               break;
              }
              $8 = -25;
              HEAP32[$13 + 468 >> 2] = -25;
              break label$63;
             }
             $5 = 20;
            }
            $22 = $5;
            $10 = $4;
            $5 = $3;
            break label$64;
           }
           HEAP32[$13 >> 2] = 2;
           $1 = HEAP32[$11 + 12 >> 2];
           HEAP32[$17 + 88 >> 2] = HEAP32[$11 + 8 >> 2];
           HEAP32[$17 + 92 >> 2] = $1;
           $1 = HEAP32[$11 + 4 >> 2];
           HEAP32[$17 + 80 >> 2] = HEAP32[$11 >> 2];
           HEAP32[$17 + 84 >> 2] = $1;
           HEAP32[$13 + 24 >> 2] = $16;
           HEAP32[$13 + 40 >> 2] = 0;
           HEAP32[$13 + 68 >> 2] = $21;
           HEAP32[$13 + 64 >> 2] = $25;
           HEAP32[$13 + 20 >> 2] = $12;
           HEAP32[$13 + 52 >> 2] = $3;
           HEAP32[$13 + 48 >> 2] = $6;
           HEAP32[$13 + 44 >> 2] = $4;
           HEAP32[$13 + 16 >> 2] = $14;
           $1 = $20 - $7 | 0;
           HEAP32[$0 + 32 >> 2] = $1;
           HEAP32[$0 + 36 >> 2] = $1 >> 31;
           $8 = 1;
           break label$63;
          }
          $10 = $4;
          $5 = $3;
          $22 = 18;
         }
         $1 = HEAP32[$11 + 4 >> 2];
         HEAP32[$17 + 80 >> 2] = HEAP32[$11 >> 2];
         HEAP32[$17 + 84 >> 2] = $1;
         $1 = HEAP32[$11 + 12 >> 2];
         HEAP32[$17 + 88 >> 2] = HEAP32[$11 + 8 >> 2];
         HEAP32[$17 + 92 >> 2] = $1;
         HEAP32[$13 + 24 >> 2] = $16;
         HEAP32[$13 + 40 >> 2] = $15;
         HEAP32[$13 + 72 >> 2] = $19;
         HEAP32[$13 + 64 >> 2] = $25;
         HEAP32[$13 + 20 >> 2] = $12;
         HEAP32[$13 + 68 >> 2] = $21;
         HEAP32[$13 + 52 >> 2] = $5;
         HEAP32[$13 + 48 >> 2] = $6;
         HEAP32[$13 + 44 >> 2] = $10;
         HEAP32[$13 + 16 >> 2] = $14;
         HEAP32[$13 >> 2] = $22;
         $1 = $20 - $7 | 0;
         HEAP32[$0 + 32 >> 2] = $1;
         HEAP32[$0 + 36 >> 2] = $1 >> 31;
         $8 = 0;
        }
        $3 = HEAP32[$0 + 32 >> 2];
        $5 = $31 - $3 | 0;
        $2 = HEAP32[$0 + 40 >> 2];
        $4 = $5 + $2 | 0;
        $6 = HEAP32[$0 + 44 >> 2] + ($45 - (HEAP32[$0 + 36 >> 2] + ($31 >>> 0 < $3 >>> 0) | 0) | 0) | 0;
        HEAP32[$0 + 40 >> 2] = $4;
        HEAP32[$0 + 44 >> 2] = $4 >>> 0 < $2 >>> 0 ? $6 + 1 | 0 : $6;
        HEAP32[$0 + 24 >> 2] = $5 + HEAP32[$0 + 24 >> 2];
        break label$4;
       }
       HEAP32[$2 + 60 >> 2] = 0;
       HEAP32[$2 + 88 >> 2] = $7;
       HEAP32[$2 >> 2] = 5;
      }
      while (1) {
       $6 = HEAP32[$2 + 88 >> 2];
       label$105 : {
        if (($6 | 0) >= 32) {
         HEAP32[$2 + 60 >> 2] = 4;
         $3 = $6 + -32 | 0;
         HEAP32[$2 + 88 >> 2] = $3;
         $4 = HEAP32[$2 + 84 >> 2];
         $10 = HEAP32[$2 + 80 >> 2];
         $7 = $6 + -16 | 0;
         $6 = $7 & 31;
         $5 = 32 <= ($7 & 63) >>> 0 ? $4 >>> $6 : ((1 << $6) - 1 & $4) << 32 - $6 | $10 >>> $6;
         HEAP8[$2 + 56 | 0] = $5;
         $6 = $3 & 31;
         $4 = 32 <= ($3 & 63) >>> 0 ? $4 >>> $6 : ((1 << $6) - 1 & $4) << 32 - $6 | $10 >>> $6;
         HEAP8[$2 + 58 | 0] = $4;
         HEAP8[$2 + 57 | 0] = $5 >>> 8;
         HEAP8[$2 + 59 | 0] = $4 >>> 8;
         break label$105;
        }
        label$107 : {
         if (($6 | 0) >= 16) {
          $7 = 2;
          HEAP32[$2 + 60 >> 2] = 2;
          $4 = $6 + -16 | 0;
          HEAP32[$2 + 88 >> 2] = $4;
          $6 = HEAP32[$2 + 84 >> 2];
          $3 = $4 & 31;
          $4 = 32 <= ($4 & 63) >>> 0 ? $6 >>> $3 : ((1 << $3) - 1 & $6) << 32 - $3 | HEAP32[$2 + 80 >> 2] >>> $3;
          HEAP8[$2 + 56 | 0] = $4;
          HEAP8[$2 + 57 | 0] = $4 >>> 8;
          break label$107;
         }
         $7 = HEAP32[$2 + 60 >> 2];
         if (($7 | 0) > 3) {
          break label$105;
         }
        }
        if (HEAPU8[$2 + 93 | 0]) {
         HEAP32[$2 + 60 >> 2] = $7 + 1;
         HEAP8[($2 + $7 | 0) + 56 | 0] = HEAPU8[$2 + 92 | 0];
         HEAP8[$2 + 93 | 0] = 0;
         $7 = HEAP32[$2 + 60 >> 2];
         if (($7 | 0) > 3) {
          break label$105;
         }
        }
        $12 = HEAP32[$0 + 8 >> 2];
        $3 = HEAP32[$0 + 12 >> 2];
        while (1) {
         if (($3 | 0) < 0 ? 1 : ($3 | 0) <= 0 ? $12 >>> 0 > 0 ? 0 : 1 : 0) {
          if ($1) {
           break label$5;
          }
          $8 = 0;
          break label$4;
         }
         $4 = HEAP32[$0 >> 2];
         HEAP32[$0 >> 2] = $4 + 1;
         $4 = HEAPU8[$4 | 0];
         HEAP32[$2 + 60 >> 2] = $7 + 1;
         HEAP8[($2 + $7 | 0) + 56 | 0] = $4;
         $4 = $0;
         $5 = $4;
         $3 = HEAP32[$4 + 12 >> 2] + -1 | 0;
         $6 = HEAP32[$4 + 8 >> 2] + -1 | 0;
         if ($6 >>> 0 < 4294967295) {
          $3 = $3 + 1 | 0;
         }
         $12 = $6;
         HEAP32[$5 + 8 >> 2] = $6;
         HEAP32[$4 + 12 >> 2] = $3;
         $7 = HEAP32[$2 + 60 >> 2];
         if (($7 | 0) < 4) {
          continue;
         }
         break;
        }
       }
       HEAP32[$2 + 60 >> 2] = 0;
       $7 = HEAP32[$2 >> 2];
       $4 = $7 + -5 | 0;
       if ($4 >>> 0 <= 2) {
        label$113 : {
         label$114 : {
          switch ($4 - 1 | 0) {
          case 1:
           $4 = HEAPU8[$2 + 56 | 0] | HEAPU8[$2 + 57 | 0] << 8 | (HEAPU8[$2 + 58 | 0] << 16 | HEAPU8[$2 + 59 | 0] << 24);
           HEAP32[$2 + 52 >> 2] = $4;
           if (($4 | 0) < 0) {
            break label$5;
           }
           HEAP32[$2 >> 2] = 8;
           break label$7;
          case 0:
           $4 = HEAPU8[$2 + 56 | 0] | HEAPU8[$2 + 57 | 0] << 8 | (HEAPU8[$2 + 58 | 0] << 16 | HEAPU8[$2 + 59 | 0] << 24);
           HEAP32[$2 + 48 >> 2] = $4;
           $7 = 7;
           break label$113;
          default:
           break label$114;
          }
         }
         $4 = HEAPU8[$2 + 56 | 0] | HEAPU8[$2 + 57 | 0] << 8 | (HEAPU8[$2 + 58 | 0] << 16 | HEAPU8[$2 + 59 | 0] << 24);
         HEAP32[$2 + 44 >> 2] = $4;
         $7 = 6;
        }
        if (($4 | 0) < 0) {
         break label$5;
        }
        HEAP32[$2 >> 2] = $7;
       }
       if (($7 | 0) != 8) {
        continue;
       }
       break;
      }
     }
     $9 = HEAP32[$2 + 40 >> 2];
     if (!$9) {
      break label$6;
     }
     $12 = HEAP32[$0 + 32 >> 2];
     $3 = HEAP32[$0 + 36 >> 2];
     while (1) {
      $8 = 0;
      if (($3 | 0) < 0 ? 1 : ($3 | 0) <= 0 ? $12 >>> 0 >= 1 ? 0 : 1 : 0) {
       break label$4;
      }
      $6 = HEAP32[$0 + 8 >> 2];
      $4 = HEAP32[$0 + 12 >> 2];
      if (($4 | 0) < 0 ? 1 : ($4 | 0) <= 0 ? $6 >>> 0 > 0 ? 0 : 1 : 0) {
       if ($1) {
        break label$5;
       }
       break label$4;
      }
      $5 = HEAP32[$2 + 4 >> 2] - HEAP32[$2 + 16 >> 2] | 0;
      $5 = ($9 | 0) > ($5 | 0) ? $5 : $9;
      $7 = $5;
      $5 = $5 >> 31;
      $3 = (($3 | 0) < ($5 | 0) ? 1 : ($3 | 0) <= ($5 | 0) ? $12 >>> 0 >= $7 >>> 0 ? 0 : 1 : 0) ? $12 : $7;
      $5 = $3;
      $3 = $3 >> 31;
      $5 = (($4 | 0) < ($3 | 0) ? 1 : ($4 | 0) <= ($3 | 0) ? $6 >>> 0 >= $5 >>> 0 ? 0 : 1 : 0) ? $6 : $5;
      memcpy(HEAP32[$0 + 24 >> 2], HEAP32[$0 >> 2], $5);
      memcpy(HEAP32[$2 + 12 >> 2] + HEAP32[$2 + 16 >> 2] | 0, HEAP32[$0 >> 2], $5);
      HEAP32[$0 >> 2] = $5 + HEAP32[$0 >> 2];
      $6 = $5 >> 31;
      $3 = HEAP32[$0 + 8 >> 2];
      $4 = $5;
      $12 = HEAP32[$0 + 12 >> 2] - ($6 + ($3 >>> 0 < $4 >>> 0) | 0) | 0;
      HEAP32[$0 + 8 >> 2] = $3 - $4;
      HEAP32[$0 + 12 >> 2] = $12;
      HEAP32[$0 + 24 >> 2] = $4 + HEAP32[$0 + 24 >> 2];
      $10 = HEAP32[$0 + 32 >> 2];
      $3 = $4;
      $12 = $10 - $3 | 0;
      $10 = HEAP32[$0 + 36 >> 2] - (($10 >>> 0 < $3 >>> 0) + $6 | 0) | 0;
      $3 = $10;
      HEAP32[$0 + 32 >> 2] = $12;
      HEAP32[$0 + 36 >> 2] = $3;
      $6 = $6 + HEAP32[$0 + 44 >> 2] | 0;
      $7 = $4 + HEAP32[$0 + 40 >> 2] | 0;
      if ($7 >>> 0 < $4 >>> 0) {
       $6 = $6 + 1 | 0;
      }
      HEAP32[$0 + 40 >> 2] = $7;
      HEAP32[$0 + 44 >> 2] = $6;
      $9 = HEAP32[$2 + 40 >> 2] - $5 | 0;
      HEAP32[$2 + 40 >> 2] = $9;
      HEAP32[$2 + 16 >> 2] = HEAP32[$2 + 8 >> 2] & $5 + HEAP32[$2 + 16 >> 2];
      if ($9) {
       continue;
      }
      break;
     }
    }
    $8 = 1;
    if (HEAP8[$2 + 36 | 0] & 1) {
     $4 = HEAP32[$0 + 12 >> 2];
     $3 = $4;
     $6 = HEAP32[$0 + 8 >> 2];
     if (($3 | 0) < 0 ? 1 : ($3 | 0) <= 0 ? $6 >>> 0 > 0 ? 0 : 1 : 0) {
      HEAP32[$2 >> 2] = 9;
      if ($1) {
       break label$5;
      }
      $8 = 0;
      break label$4;
     }
     $4 = $3 + -1 | 0;
     $3 = $6 + -1 | 0;
     if ($3 >>> 0 < 4294967295) {
      $4 = $4 + 1 | 0;
     }
     HEAP32[$0 + 8 >> 2] = $3;
     HEAP32[$0 + 12 >> 2] = $4;
     HEAP32[$0 >> 2] = HEAP32[$0 >> 2] + 1;
    }
    HEAP32[$2 >> 2] = 2;
    break label$4;
   }
   $8 = -25;
   HEAP32[$2 + 468 >> 2] = -25;
  }
  $1 = $0;
  $3 = HEAP32[$0 + 8 >> 2];
  $6 = $28 - $3 | 0;
  $4 = $6 + HEAP32[$0 + 16 >> 2] | 0;
  $0 = HEAP32[$0 + 20 >> 2] + ($29 - (HEAP32[$0 + 12 >> 2] + ($28 >>> 0 < $3 >>> 0) | 0) | 0) | 0;
  HEAP32[$1 + 16 >> 2] = $4;
  HEAP32[$1 + 20 >> 2] = $4 >>> 0 < $6 >>> 0 ? $0 + 1 | 0 : $0;
 }
 $0 = $11 + 16 | 0;
 if ($0 >>> 0 < global$2 >>> 0) {
  __handle_stack_overflow();
 }
 global$0 = $0;
 return $8;
}
function dlmalloc($0) {
 $0 = $0 | 0;
 var $1 = 0, $2 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0;
 $12 = global$0 - 16 | 0;
 $1 = $12;
 if ($1 >>> 0 < global$2 >>> 0) {
  __handle_stack_overflow();
 }
 global$0 = $1;
 label$2 : {
  label$3 : {
   label$4 : {
    label$5 : {
     if ($0 >>> 0 <= 244) {
      $4 = HEAP32[1121];
      $6 = $0 >>> 0 < 11 ? 16 : $0 + 11 & -8;
      $0 = $6 >>> 3;
      $1 = $4 >>> $0;
      if ($1 & 3) {
       $2 = $0 + (($1 ^ -1) & 1) | 0;
       $3 = $2 << 3;
       $1 = HEAP32[$3 + 4532 >> 2];
       $0 = HEAP32[$1 + 8 >> 2];
       $3 = $3 + 4524 | 0;
       label$8 : {
        if (($0 | 0) == ($3 | 0)) {
         HEAP32[1121] = __wasm_rotl_i32($2) & $4;
         break label$8;
        }
        if (($1 | 0) != HEAP32[$0 + 12 >> 2] | HEAPU32[1125] > $0 >>> 0) {
         break label$4;
        }
        HEAP32[$0 + 12 >> 2] = $3;
        HEAP32[$3 + 8 >> 2] = $0;
       }
       $0 = $1 + 8 | 0;
       $2 = $2 << 3;
       HEAP32[$1 + 4 >> 2] = $2 | 3;
       $1 = $1 + $2 | 0;
       HEAP32[$1 + 4 >> 2] = HEAP32[$1 + 4 >> 2] | 1;
       break label$2;
      }
      $9 = HEAP32[1123];
      if ($6 >>> 0 <= $9 >>> 0) {
       break label$5;
      }
      if ($1) {
       $2 = 2 << $0;
       $0 = (0 - $2 | $2) & $1 << $0;
       $0 = (0 - $0 & $0) + -1 | 0;
       $1 = $0 >>> 12 & 16;
       $2 = $1;
       $0 = $0 >>> $1;
       $1 = $0 >>> 5 & 8;
       $2 = $2 | $1;
       $0 = $0 >>> $1;
       $1 = $0 >>> 2 & 4;
       $2 = $2 | $1;
       $0 = $0 >>> $1;
       $1 = $0 >>> 1 & 2;
       $2 = $2 | $1;
       $0 = $0 >>> $1;
       $1 = $0 >>> 1 & 1;
       $2 = ($2 | $1) + ($0 >>> $1) | 0;
       $3 = $2 << 3;
       $1 = HEAP32[$3 + 4532 >> 2];
       $0 = HEAP32[$1 + 8 >> 2];
       $3 = $3 + 4524 | 0;
       label$11 : {
        if (($0 | 0) == ($3 | 0)) {
         $4 = __wasm_rotl_i32($2) & $4;
         HEAP32[1121] = $4;
         break label$11;
        }
        if (($1 | 0) != HEAP32[$0 + 12 >> 2] | HEAPU32[1125] > $0 >>> 0) {
         break label$4;
        }
        HEAP32[$0 + 12 >> 2] = $3;
        HEAP32[$3 + 8 >> 2] = $0;
       }
       HEAP32[$1 + 4 >> 2] = $6 | 3;
       $7 = $1 + $6 | 0;
       $0 = $2 << 3;
       $3 = $0 - $6 | 0;
       HEAP32[$7 + 4 >> 2] = $3 | 1;
       HEAP32[$0 + $1 >> 2] = $3;
       if ($9) {
        $5 = $9 >>> 3;
        $0 = ($5 << 3) + 4524 | 0;
        $2 = HEAP32[1126];
        $5 = 1 << $5;
        label$14 : {
         if (!($5 & $4)) {
          HEAP32[1121] = $5 | $4;
          $5 = $0;
          break label$14;
         }
         $5 = HEAP32[$0 + 8 >> 2];
         if (HEAPU32[1125] > $5 >>> 0) {
          break label$4;
         }
        }
        HEAP32[$0 + 8 >> 2] = $2;
        HEAP32[$5 + 12 >> 2] = $2;
        HEAP32[$2 + 12 >> 2] = $0;
        HEAP32[$2 + 8 >> 2] = $5;
       }
       $0 = $1 + 8 | 0;
       HEAP32[1126] = $7;
       HEAP32[1123] = $3;
       break label$2;
      }
      $10 = HEAP32[1122];
      if (!$10) {
       break label$5;
      }
      $0 = ($10 & 0 - $10) + -1 | 0;
      $1 = $0 >>> 12 & 16;
      $2 = $1;
      $0 = $0 >>> $1;
      $1 = $0 >>> 5 & 8;
      $2 = $2 | $1;
      $0 = $0 >>> $1;
      $1 = $0 >>> 2 & 4;
      $2 = $2 | $1;
      $0 = $0 >>> $1;
      $1 = $0 >>> 1 & 2;
      $2 = $2 | $1;
      $0 = $0 >>> $1;
      $1 = $0 >>> 1 & 1;
      $1 = HEAP32[(($2 | $1) + ($0 >>> $1) << 2) + 4788 >> 2];
      $3 = (HEAP32[$1 + 4 >> 2] & -8) - $6 | 0;
      $2 = $1;
      while (1) {
       label$17 : {
        $0 = HEAP32[$2 + 16 >> 2];
        if (!$0) {
         $0 = HEAP32[$2 + 20 >> 2];
         if (!$0) {
          break label$17;
         }
        }
        $5 = (HEAP32[$0 + 4 >> 2] & -8) - $6 | 0;
        $2 = $5 >>> 0 < $3 >>> 0;
        $3 = $2 ? $5 : $3;
        $1 = $2 ? $0 : $1;
        $2 = $0;
        continue;
       }
       break;
      }
      $13 = HEAP32[1125];
      if ($13 >>> 0 > $1 >>> 0) {
       break label$4;
      }
      $11 = $1 + $6 | 0;
      if ($11 >>> 0 <= $1 >>> 0) {
       break label$4;
      }
      $8 = HEAP32[$1 + 24 >> 2];
      $5 = HEAP32[$1 + 12 >> 2];
      label$19 : {
       if (($5 | 0) != ($1 | 0)) {
        $0 = HEAP32[$1 + 8 >> 2];
        if ($13 >>> 0 > $0 >>> 0 | HEAP32[$0 + 12 >> 2] != ($1 | 0) | HEAP32[$5 + 8 >> 2] != ($1 | 0)) {
         break label$4;
        }
        HEAP32[$0 + 12 >> 2] = $5;
        HEAP32[$5 + 8 >> 2] = $0;
        break label$19;
       }
       label$21 : {
        $2 = $1 + 20 | 0;
        $0 = HEAP32[$2 >> 2];
        if (!$0) {
         $0 = HEAP32[$1 + 16 >> 2];
         if (!$0) {
          break label$21;
         }
         $2 = $1 + 16 | 0;
        }
        while (1) {
         $7 = $2;
         $5 = $0;
         $2 = $0 + 20 | 0;
         $0 = HEAP32[$2 >> 2];
         if ($0) {
          continue;
         }
         $2 = $5 + 16 | 0;
         $0 = HEAP32[$5 + 16 >> 2];
         if ($0) {
          continue;
         }
         break;
        }
        if ($13 >>> 0 > $7 >>> 0) {
         break label$4;
        }
        HEAP32[$7 >> 2] = 0;
        break label$19;
       }
       $5 = 0;
      }
      label$24 : {
       if (!$8) {
        break label$24;
       }
       $0 = HEAP32[$1 + 28 >> 2];
       $2 = ($0 << 2) + 4788 | 0;
       label$25 : {
        if (HEAP32[$2 >> 2] == ($1 | 0)) {
         HEAP32[$2 >> 2] = $5;
         if ($5) {
          break label$25;
         }
         HEAP32[1122] = __wasm_rotl_i32($0) & $10;
         break label$24;
        }
        if (HEAPU32[1125] > $8 >>> 0) {
         break label$4;
        }
        HEAP32[$8 + (HEAP32[$8 + 16 >> 2] == ($1 | 0) ? 16 : 20) >> 2] = $5;
        if (!$5) {
         break label$24;
        }
       }
       $2 = HEAP32[1125];
       if ($2 >>> 0 > $5 >>> 0) {
        break label$4;
       }
       HEAP32[$5 + 24 >> 2] = $8;
       $0 = HEAP32[$1 + 16 >> 2];
       if ($0) {
        if ($2 >>> 0 > $0 >>> 0) {
         break label$4;
        }
        HEAP32[$5 + 16 >> 2] = $0;
        HEAP32[$0 + 24 >> 2] = $5;
       }
       $0 = HEAP32[$1 + 20 >> 2];
       if (!$0) {
        break label$24;
       }
       if (HEAPU32[1125] > $0 >>> 0) {
        break label$4;
       }
       HEAP32[$5 + 20 >> 2] = $0;
       HEAP32[$0 + 24 >> 2] = $5;
      }
      label$28 : {
       if ($3 >>> 0 <= 15) {
        $0 = $3 + $6 | 0;
        HEAP32[$1 + 4 >> 2] = $0 | 3;
        $0 = $0 + $1 | 0;
        HEAP32[$0 + 4 >> 2] = HEAP32[$0 + 4 >> 2] | 1;
        break label$28;
       }
       HEAP32[$1 + 4 >> 2] = $6 | 3;
       HEAP32[$11 + 4 >> 2] = $3 | 1;
       HEAP32[$3 + $11 >> 2] = $3;
       if ($9) {
        $5 = $9 >>> 3;
        $0 = ($5 << 3) + 4524 | 0;
        $2 = HEAP32[1126];
        $5 = 1 << $5;
        label$31 : {
         if (!($5 & $4)) {
          HEAP32[1121] = $5 | $4;
          $6 = $0;
          break label$31;
         }
         $6 = HEAP32[$0 + 8 >> 2];
         if (HEAPU32[1125] > $6 >>> 0) {
          break label$4;
         }
        }
        HEAP32[$0 + 8 >> 2] = $2;
        HEAP32[$6 + 12 >> 2] = $2;
        HEAP32[$2 + 12 >> 2] = $0;
        HEAP32[$2 + 8 >> 2] = $6;
       }
       HEAP32[1126] = $11;
       HEAP32[1123] = $3;
      }
      $0 = $1 + 8 | 0;
      break label$2;
     }
     $6 = -1;
     if ($0 >>> 0 > 4294967231) {
      break label$5;
     }
     $1 = $0 + 11 | 0;
     $6 = $1 & -8;
     $8 = HEAP32[1122];
     if (!$8) {
      break label$5;
     }
     $2 = 0 - $6 | 0;
     $1 = $1 >>> 8;
     $4 = 0;
     label$36 : {
      if (!$1) {
       break label$36;
      }
      $4 = 31;
      if ($6 >>> 0 > 16777215) {
       break label$36;
      }
      $3 = $1 + 1048320 >>> 16 & 8;
      $1 = $1 << $3;
      $0 = $1 + 520192 >>> 16 & 4;
      $4 = $1 << $0;
      $1 = $4 + 245760 >>> 16 & 2;
      $0 = ($4 << $1 >>> 15) - ($1 | ($0 | $3)) | 0;
      $4 = ($0 << 1 | $6 >>> $0 + 21 & 1) + 28 | 0;
     }
     $3 = HEAP32[($4 << 2) + 4788 >> 2];
     label$33 : {
      label$34 : {
       label$35 : {
        if (!$3) {
         $0 = 0;
         break label$35;
        }
        $1 = $6 << (($4 | 0) == 31 ? 0 : 25 - ($4 >>> 1) | 0);
        $0 = 0;
        while (1) {
         label$39 : {
          $7 = (HEAP32[$3 + 4 >> 2] & -8) - $6 | 0;
          if ($7 >>> 0 >= $2 >>> 0) {
           break label$39;
          }
          $5 = $3;
          $2 = $7;
          if ($2) {
           break label$39;
          }
          $2 = 0;
          $0 = $3;
          break label$34;
         }
         $7 = HEAP32[$3 + 20 >> 2];
         $3 = HEAP32[(($1 >>> 29 & 4) + $3 | 0) + 16 >> 2];
         $0 = $7 ? ($7 | 0) == ($3 | 0) ? $0 : $7 : $0;
         $1 = $1 << (($3 | 0) != 0);
         if ($3) {
          continue;
         }
         break;
        }
       }
       if (!($0 | $5)) {
        $0 = 2 << $4;
        $0 = (0 - $0 | $0) & $8;
        if (!$0) {
         break label$5;
        }
        $0 = ($0 & 0 - $0) + -1 | 0;
        $1 = $0 >>> 12 & 16;
        $3 = $1;
        $0 = $0 >>> $1;
        $1 = $0 >>> 5 & 8;
        $3 = $3 | $1;
        $0 = $0 >>> $1;
        $1 = $0 >>> 2 & 4;
        $3 = $3 | $1;
        $0 = $0 >>> $1;
        $1 = $0 >>> 1 & 2;
        $3 = $3 | $1;
        $0 = $0 >>> $1;
        $1 = $0 >>> 1 & 1;
        $0 = HEAP32[(($3 | $1) + ($0 >>> $1) << 2) + 4788 >> 2];
       }
       if (!$0) {
        break label$33;
       }
      }
      while (1) {
       $3 = (HEAP32[$0 + 4 >> 2] & -8) - $6 | 0;
       $1 = $3 >>> 0 < $2 >>> 0;
       $2 = $1 ? $3 : $2;
       $5 = $1 ? $0 : $5;
       $1 = HEAP32[$0 + 16 >> 2];
       if ($1) {
        $0 = $1;
       } else {
        $0 = HEAP32[$0 + 20 >> 2];
       }
       if ($0) {
        continue;
       }
       break;
      }
     }
     if (!$5 | $2 >>> 0 >= HEAP32[1123] - $6 >>> 0) {
      break label$5;
     }
     $10 = HEAP32[1125];
     if ($10 >>> 0 > $5 >>> 0) {
      break label$4;
     }
     $4 = $5 + $6 | 0;
     if ($4 >>> 0 <= $5 >>> 0) {
      break label$4;
     }
     $9 = HEAP32[$5 + 24 >> 2];
     $1 = HEAP32[$5 + 12 >> 2];
     label$44 : {
      if (($5 | 0) != ($1 | 0)) {
       $0 = HEAP32[$5 + 8 >> 2];
       if ($10 >>> 0 > $0 >>> 0 | HEAP32[$0 + 12 >> 2] != ($5 | 0) | HEAP32[$1 + 8 >> 2] != ($5 | 0)) {
        break label$4;
       }
       HEAP32[$0 + 12 >> 2] = $1;
       HEAP32[$1 + 8 >> 2] = $0;
       break label$44;
      }
      label$46 : {
       $3 = $5 + 20 | 0;
       $0 = HEAP32[$3 >> 2];
       if (!$0) {
        $0 = HEAP32[$5 + 16 >> 2];
        if (!$0) {
         break label$46;
        }
        $3 = $5 + 16 | 0;
       }
       while (1) {
        $7 = $3;
        $1 = $0;
        $3 = $0 + 20 | 0;
        $0 = HEAP32[$3 >> 2];
        if ($0) {
         continue;
        }
        $3 = $1 + 16 | 0;
        $0 = HEAP32[$1 + 16 >> 2];
        if ($0) {
         continue;
        }
        break;
       }
       if ($10 >>> 0 > $7 >>> 0) {
        break label$4;
       }
       HEAP32[$7 >> 2] = 0;
       break label$44;
      }
      $1 = 0;
     }
     label$49 : {
      if (!$9) {
       break label$49;
      }
      $0 = HEAP32[$5 + 28 >> 2];
      $3 = ($0 << 2) + 4788 | 0;
      label$50 : {
       if (HEAP32[$3 >> 2] == ($5 | 0)) {
        HEAP32[$3 >> 2] = $1;
        if ($1) {
         break label$50;
        }
        $8 = __wasm_rotl_i32($0) & $8;
        HEAP32[1122] = $8;
        break label$49;
       }
       if (HEAPU32[1125] > $9 >>> 0) {
        break label$4;
       }
       HEAP32[$9 + (HEAP32[$9 + 16 >> 2] == ($5 | 0) ? 16 : 20) >> 2] = $1;
       if (!$1) {
        break label$49;
       }
      }
      $3 = HEAP32[1125];
      if ($3 >>> 0 > $1 >>> 0) {
       break label$4;
      }
      HEAP32[$1 + 24 >> 2] = $9;
      $0 = HEAP32[$5 + 16 >> 2];
      if ($0) {
       if ($3 >>> 0 > $0 >>> 0) {
        break label$4;
       }
       HEAP32[$1 + 16 >> 2] = $0;
       HEAP32[$0 + 24 >> 2] = $1;
      }
      $0 = HEAP32[$5 + 20 >> 2];
      if (!$0) {
       break label$49;
      }
      if (HEAPU32[1125] > $0 >>> 0) {
       break label$4;
      }
      HEAP32[$1 + 20 >> 2] = $0;
      HEAP32[$0 + 24 >> 2] = $1;
     }
     label$53 : {
      if ($2 >>> 0 <= 15) {
       $0 = $2 + $6 | 0;
       HEAP32[$5 + 4 >> 2] = $0 | 3;
       $0 = $0 + $5 | 0;
       HEAP32[$0 + 4 >> 2] = HEAP32[$0 + 4 >> 2] | 1;
       break label$53;
      }
      HEAP32[$5 + 4 >> 2] = $6 | 3;
      HEAP32[$4 + 4 >> 2] = $2 | 1;
      HEAP32[$2 + $4 >> 2] = $2;
      if ($2 >>> 0 <= 255) {
       $1 = $2 >>> 3;
       $0 = ($1 << 3) + 4524 | 0;
       $2 = HEAP32[1121];
       $1 = 1 << $1;
       label$56 : {
        if (!($2 & $1)) {
         HEAP32[1121] = $1 | $2;
         $3 = $0;
         break label$56;
        }
        $3 = HEAP32[$0 + 8 >> 2];
        if (HEAPU32[1125] > $3 >>> 0) {
         break label$4;
        }
       }
       HEAP32[$0 + 8 >> 2] = $4;
       HEAP32[$3 + 12 >> 2] = $4;
       HEAP32[$4 + 12 >> 2] = $0;
       HEAP32[$4 + 8 >> 2] = $3;
       break label$53;
      }
      $1 = $4;
      $3 = $2 >>> 8;
      $0 = 0;
      label$58 : {
       if (!$3) {
        break label$58;
       }
       $0 = 31;
       if ($2 >>> 0 > 16777215) {
        break label$58;
       }
       $6 = $3 + 1048320 >>> 16 & 8;
       $3 = $3 << $6;
       $0 = $3 + 520192 >>> 16 & 4;
       $7 = $3 << $0;
       $3 = $7 + 245760 >>> 16 & 2;
       $0 = ($7 << $3 >>> 15) - ($3 | ($0 | $6)) | 0;
       $0 = ($0 << 1 | $2 >>> $0 + 21 & 1) + 28 | 0;
      }
      HEAP32[$1 + 28 >> 2] = $0;
      HEAP32[$4 + 16 >> 2] = 0;
      HEAP32[$4 + 20 >> 2] = 0;
      $1 = ($0 << 2) + 4788 | 0;
      label$59 : {
       $3 = 1 << $0;
       label$60 : {
        if (!($3 & $8)) {
         HEAP32[1122] = $3 | $8;
         HEAP32[$1 >> 2] = $4;
         break label$60;
        }
        $0 = $2 << (($0 | 0) == 31 ? 0 : 25 - ($0 >>> 1) | 0);
        $6 = HEAP32[$1 >> 2];
        while (1) {
         $1 = $6;
         if ((HEAP32[$1 + 4 >> 2] & -8) == ($2 | 0)) {
          break label$59;
         }
         $3 = $0 >>> 29;
         $0 = $0 << 1;
         $3 = (($3 & 4) + $1 | 0) + 16 | 0;
         $6 = HEAP32[$3 >> 2];
         if ($6) {
          continue;
         }
         break;
        }
        if (HEAPU32[1125] > $3 >>> 0) {
         break label$4;
        }
        HEAP32[$3 >> 2] = $4;
       }
       HEAP32[$4 + 24 >> 2] = $1;
       HEAP32[$4 + 12 >> 2] = $4;
       HEAP32[$4 + 8 >> 2] = $4;
       break label$53;
      }
      $2 = HEAP32[1125];
      $0 = HEAP32[$1 + 8 >> 2];
      if ($2 >>> 0 > $0 >>> 0 | $2 >>> 0 > $1 >>> 0) {
       break label$4;
      }
      HEAP32[$0 + 12 >> 2] = $4;
      HEAP32[$1 + 8 >> 2] = $4;
      HEAP32[$4 + 24 >> 2] = 0;
      HEAP32[$4 + 12 >> 2] = $1;
      HEAP32[$4 + 8 >> 2] = $0;
     }
     $0 = $5 + 8 | 0;
     break label$2;
    }
    $1 = HEAP32[1123];
    if ($1 >>> 0 >= $6 >>> 0) {
     $0 = HEAP32[1126];
     $2 = $1 - $6 | 0;
     label$64 : {
      if ($2 >>> 0 >= 16) {
       HEAP32[1123] = $2;
       $3 = $0 + $6 | 0;
       HEAP32[1126] = $3;
       HEAP32[$3 + 4 >> 2] = $2 | 1;
       HEAP32[$0 + $1 >> 2] = $2;
       HEAP32[$0 + 4 >> 2] = $6 | 3;
       break label$64;
      }
      HEAP32[1126] = 0;
      HEAP32[1123] = 0;
      HEAP32[$0 + 4 >> 2] = $1 | 3;
      $1 = $0 + $1 | 0;
      HEAP32[$1 + 4 >> 2] = HEAP32[$1 + 4 >> 2] | 1;
     }
     $0 = $0 + 8 | 0;
     break label$2;
    }
    $3 = HEAP32[1124];
    if ($3 >>> 0 > $6 >>> 0) {
     $1 = $3 - $6 | 0;
     HEAP32[1124] = $1;
     $0 = HEAP32[1127];
     $2 = $0 + $6 | 0;
     HEAP32[1127] = $2;
     HEAP32[$2 + 4 >> 2] = $1 | 1;
     HEAP32[$0 + 4 >> 2] = $6 | 3;
     $0 = $0 + 8 | 0;
     break label$2;
    }
    $0 = 0;
    $5 = $6 + 47 | 0;
    $2 = $5;
    if (HEAP32[1239]) {
     $1 = HEAP32[1241];
    } else {
     HEAP32[1242] = -1;
     HEAP32[1243] = -1;
     HEAP32[1240] = 4096;
     HEAP32[1241] = 4096;
     HEAP32[1239] = $12 + 12 & -16 ^ 1431655768;
     HEAP32[1244] = 0;
     HEAP32[1232] = 0;
     $1 = 4096;
    }
    $4 = $2 + $1 | 0;
    $7 = 0 - $1 | 0;
    $2 = $4 & $7;
    if ($2 >>> 0 <= $6 >>> 0) {
     break label$2;
    }
    $1 = HEAP32[1231];
    if ($1) {
     $8 = HEAP32[1229];
     $9 = $8 + $2 | 0;
     if ($9 >>> 0 <= $8 >>> 0 | $9 >>> 0 > $1 >>> 0) {
      break label$2;
     }
    }
    label$70 : {
     if (!(HEAPU8[4928] & 4)) {
      label$72 : {
       label$73 : {
        label$74 : {
         label$75 : {
          $1 = HEAP32[1127];
          if ($1) {
           $0 = 4932;
           while (1) {
            $8 = HEAP32[$0 >> 2];
            if ($8 + HEAP32[$0 + 4 >> 2] >>> 0 > $1 >>> 0 ? $8 >>> 0 <= $1 >>> 0 : 0) {
             break label$75;
            }
            $0 = HEAP32[$0 + 8 >> 2];
            if ($0) {
             continue;
            }
            break;
           }
          }
          $1 = sbrk(0);
          if (($1 | 0) == -1) {
           break label$72;
          }
          $4 = $2;
          $0 = HEAP32[1240];
          $3 = $0 + -1 | 0;
          if ($3 & $1) {
           $4 = ($2 - $1 | 0) + ($1 + $3 & 0 - $0) | 0;
          }
          if ($4 >>> 0 <= $6 >>> 0 | $4 >>> 0 > 2147483646) {
           break label$72;
          }
          $0 = HEAP32[1231];
          if ($0) {
           $3 = HEAP32[1229];
           $7 = $3 + $4 | 0;
           if ($7 >>> 0 <= $3 >>> 0 | $7 >>> 0 > $0 >>> 0) {
            break label$72;
           }
          }
          $0 = sbrk($4);
          if (($1 | 0) != ($0 | 0)) {
           break label$74;
          }
          break label$70;
         }
         $4 = $7 & $4 - $3;
         if ($4 >>> 0 > 2147483646) {
          break label$72;
         }
         $1 = sbrk($4);
         if (($1 | 0) == (HEAP32[$0 >> 2] + HEAP32[$0 + 4 >> 2] | 0)) {
          break label$73;
         }
         $0 = $1;
        }
        $1 = $0;
        if (!($6 + 48 >>> 0 <= $4 >>> 0 | $4 >>> 0 > 2147483646 | ($0 | 0) == -1)) {
         $0 = HEAP32[1241];
         $0 = $0 + ($5 - $4 | 0) & 0 - $0;
         if ($0 >>> 0 > 2147483646) {
          break label$70;
         }
         if ((sbrk($0) | 0) != -1) {
          $4 = $0 + $4 | 0;
          break label$70;
         }
         sbrk(0 - $4 | 0);
         break label$72;
        }
        if (($1 | 0) != -1) {
         break label$70;
        }
        break label$72;
       }
       if (($1 | 0) != -1) {
        break label$70;
       }
      }
      HEAP32[1232] = HEAP32[1232] | 4;
     }
     if ($2 >>> 0 > 2147483646) {
      break label$3;
     }
     $1 = sbrk($2);
     $0 = sbrk(0);
     if ($1 >>> 0 >= $0 >>> 0 | ($1 | 0) == -1 | ($0 | 0) == -1) {
      break label$3;
     }
     $4 = $0 - $1 | 0;
     if ($4 >>> 0 <= $6 + 40 >>> 0) {
      break label$3;
     }
    }
    $0 = HEAP32[1229] + $4 | 0;
    HEAP32[1229] = $0;
    if ($0 >>> 0 > HEAPU32[1230]) {
     HEAP32[1230] = $0;
    }
    label$84 : {
     label$85 : {
      label$86 : {
       $3 = HEAP32[1127];
       if ($3) {
        $0 = 4932;
        while (1) {
         $2 = HEAP32[$0 >> 2];
         $5 = HEAP32[$0 + 4 >> 2];
         if (($2 + $5 | 0) == ($1 | 0)) {
          break label$86;
         }
         $0 = HEAP32[$0 + 8 >> 2];
         if ($0) {
          continue;
         }
         break;
        }
        break label$85;
       }
       $0 = HEAP32[1125];
       if (!($1 >>> 0 >= $0 >>> 0 ? $0 : 0)) {
        HEAP32[1125] = $1;
       }
       $0 = 0;
       HEAP32[1234] = $4;
       HEAP32[1233] = $1;
       HEAP32[1129] = -1;
       HEAP32[1130] = HEAP32[1239];
       HEAP32[1236] = 0;
       while (1) {
        $2 = $0 << 3;
        $3 = $2 + 4524 | 0;
        HEAP32[$2 + 4532 >> 2] = $3;
        HEAP32[$2 + 4536 >> 2] = $3;
        $0 = $0 + 1 | 0;
        if (($0 | 0) != 32) {
         continue;
        }
        break;
       }
       $0 = $4 + -40 | 0;
       $2 = $1 + 8 & 7 ? -8 - $1 & 7 : 0;
       $3 = $0 - $2 | 0;
       HEAP32[1124] = $3;
       $2 = $1 + $2 | 0;
       HEAP32[1127] = $2;
       HEAP32[$2 + 4 >> 2] = $3 | 1;
       HEAP32[($0 + $1 | 0) + 4 >> 2] = 40;
       HEAP32[1128] = HEAP32[1243];
       break label$84;
      }
      if (HEAPU8[$0 + 12 | 0] & 8 | $1 >>> 0 <= $3 >>> 0 | $2 >>> 0 > $3 >>> 0) {
       break label$85;
      }
      HEAP32[$0 + 4 >> 2] = $5 + $4;
      $0 = $3 + 8 & 7 ? -8 - $3 & 7 : 0;
      $1 = $0 + $3 | 0;
      HEAP32[1127] = $1;
      $2 = HEAP32[1124] + $4 | 0;
      $0 = $2 - $0 | 0;
      HEAP32[1124] = $0;
      HEAP32[$1 + 4 >> 2] = $0 | 1;
      HEAP32[($2 + $3 | 0) + 4 >> 2] = 40;
      HEAP32[1128] = HEAP32[1243];
      break label$84;
     }
     $5 = HEAP32[1125];
     if ($1 >>> 0 < $5 >>> 0) {
      HEAP32[1125] = $1;
      $5 = $1;
     }
     $2 = $1 + $4 | 0;
     $0 = 4932;
     label$92 : {
      label$93 : {
       label$94 : {
        while (1) {
         if (($2 | 0) != HEAP32[$0 >> 2]) {
          $0 = HEAP32[$0 + 8 >> 2];
          if ($0) {
           continue;
          }
          break label$94;
         }
         break;
        }
        if (!(HEAPU8[$0 + 12 | 0] & 8)) {
         break label$93;
        }
       }
       $0 = 4932;
       while (1) {
        $2 = HEAP32[$0 >> 2];
        if ($2 >>> 0 <= $3 >>> 0) {
         $5 = $2 + HEAP32[$0 + 4 >> 2] | 0;
         if ($5 >>> 0 > $3 >>> 0) {
          break label$92;
         }
        }
        $0 = HEAP32[$0 + 8 >> 2];
        continue;
       }
      }
      HEAP32[$0 >> 2] = $1;
      HEAP32[$0 + 4 >> 2] = HEAP32[$0 + 4 >> 2] + $4;
      $9 = ($1 + 8 & 7 ? -8 - $1 & 7 : 0) + $1 | 0;
      HEAP32[$9 + 4 >> 2] = $6 | 3;
      $1 = $2 + ($2 + 8 & 7 ? -8 - $2 & 7 : 0) | 0;
      $0 = ($1 - $9 | 0) - $6 | 0;
      $7 = $6 + $9 | 0;
      label$99 : {
       if (($1 | 0) == ($3 | 0)) {
        HEAP32[1127] = $7;
        $0 = HEAP32[1124] + $0 | 0;
        HEAP32[1124] = $0;
        HEAP32[$7 + 4 >> 2] = $0 | 1;
        break label$99;
       }
       if (HEAP32[1126] == ($1 | 0)) {
        HEAP32[1126] = $7;
        $0 = HEAP32[1123] + $0 | 0;
        HEAP32[1123] = $0;
        HEAP32[$7 + 4 >> 2] = $0 | 1;
        HEAP32[$0 + $7 >> 2] = $0;
        break label$99;
       }
       $10 = HEAP32[$1 + 4 >> 2];
       if (($10 & 3) == 1) {
        label$103 : {
         if ($10 >>> 0 <= 255) {
          $2 = HEAP32[$1 + 12 >> 2];
          $3 = HEAP32[$1 + 8 >> 2];
          $6 = $10 >>> 3;
          $4 = ($6 << 3) + 4524 | 0;
          if (HEAP32[$3 + 12 >> 2] != ($1 | 0) | $5 >>> 0 > $3 >>> 0 ? ($3 | 0) != ($4 | 0) : 0) {
           break label$4;
          }
          if (($2 | 0) == ($3 | 0)) {
           HEAP32[1121] = HEAP32[1121] & __wasm_rotl_i32($6);
           break label$103;
          }
          if (HEAP32[$2 + 8 >> 2] != ($1 | 0) | $5 >>> 0 > $2 >>> 0 ? ($2 | 0) != ($4 | 0) : 0) {
           break label$4;
          }
          HEAP32[$3 + 12 >> 2] = $2;
          HEAP32[$2 + 8 >> 2] = $3;
          break label$103;
         }
         $8 = HEAP32[$1 + 24 >> 2];
         $4 = HEAP32[$1 + 12 >> 2];
         label$108 : {
          if (($4 | 0) != ($1 | 0)) {
           $2 = HEAP32[$1 + 8 >> 2];
           if ($5 >>> 0 > $2 >>> 0 | HEAP32[$2 + 12 >> 2] != ($1 | 0) | HEAP32[$4 + 8 >> 2] != ($1 | 0)) {
            break label$4;
           }
           HEAP32[$2 + 12 >> 2] = $4;
           HEAP32[$4 + 8 >> 2] = $2;
           break label$108;
          }
          label$110 : {
           $3 = $1 + 20 | 0;
           $6 = HEAP32[$3 >> 2];
           if ($6) {
            break label$110;
           }
           $3 = $1 + 16 | 0;
           $6 = HEAP32[$3 >> 2];
           if ($6) {
            break label$110;
           }
           $4 = 0;
           break label$108;
          }
          while (1) {
           $2 = $3;
           $4 = $6;
           $3 = $4 + 20 | 0;
           $6 = HEAP32[$3 >> 2];
           if ($6) {
            continue;
           }
           $3 = $4 + 16 | 0;
           $6 = HEAP32[$4 + 16 >> 2];
           if ($6) {
            continue;
           }
           break;
          }
          if ($5 >>> 0 > $2 >>> 0) {
           break label$4;
          }
          HEAP32[$2 >> 2] = 0;
         }
         if (!$8) {
          break label$103;
         }
         $2 = HEAP32[$1 + 28 >> 2];
         $3 = ($2 << 2) + 4788 | 0;
         label$112 : {
          if (HEAP32[$3 >> 2] == ($1 | 0)) {
           HEAP32[$3 >> 2] = $4;
           if ($4) {
            break label$112;
           }
           HEAP32[1122] = HEAP32[1122] & __wasm_rotl_i32($2);
           break label$103;
          }
          if (HEAPU32[1125] > $8 >>> 0) {
           break label$4;
          }
          HEAP32[$8 + (HEAP32[$8 + 16 >> 2] == ($1 | 0) ? 16 : 20) >> 2] = $4;
          if (!$4) {
           break label$103;
          }
         }
         $3 = HEAP32[1125];
         if ($3 >>> 0 > $4 >>> 0) {
          break label$4;
         }
         HEAP32[$4 + 24 >> 2] = $8;
         $2 = HEAP32[$1 + 16 >> 2];
         if ($2) {
          if ($3 >>> 0 > $2 >>> 0) {
           break label$4;
          }
          HEAP32[$4 + 16 >> 2] = $2;
          HEAP32[$2 + 24 >> 2] = $4;
         }
         $2 = HEAP32[$1 + 20 >> 2];
         if (!$2) {
          break label$103;
         }
         if (HEAPU32[1125] > $2 >>> 0) {
          break label$4;
         }
         HEAP32[$4 + 20 >> 2] = $2;
         HEAP32[$2 + 24 >> 2] = $4;
        }
        $2 = $10 & -8;
        $0 = $2 + $0 | 0;
        $1 = $1 + $2 | 0;
       }
       HEAP32[$1 + 4 >> 2] = HEAP32[$1 + 4 >> 2] & -2;
       HEAP32[$7 + 4 >> 2] = $0 | 1;
       HEAP32[$0 + $7 >> 2] = $0;
       if ($0 >>> 0 <= 255) {
        $1 = $0 >>> 3;
        $0 = ($1 << 3) + 4524 | 0;
        $2 = HEAP32[1121];
        $1 = 1 << $1;
        label$116 : {
         if (!($2 & $1)) {
          HEAP32[1121] = $1 | $2;
          $3 = $0;
          break label$116;
         }
         $3 = HEAP32[$0 + 8 >> 2];
         if (HEAPU32[1125] > $3 >>> 0) {
          break label$4;
         }
        }
        HEAP32[$0 + 8 >> 2] = $7;
        HEAP32[$3 + 12 >> 2] = $7;
        HEAP32[$7 + 12 >> 2] = $0;
        HEAP32[$7 + 8 >> 2] = $3;
        break label$99;
       }
       $2 = $7;
       $3 = $0 >>> 8;
       $1 = 0;
       label$118 : {
        if (!$3) {
         break label$118;
        }
        $1 = 31;
        if ($0 >>> 0 > 16777215) {
         break label$118;
        }
        $5 = $3 + 1048320 >>> 16 & 8;
        $3 = $3 << $5;
        $1 = $3 + 520192 >>> 16 & 4;
        $6 = $3 << $1;
        $3 = $6 + 245760 >>> 16 & 2;
        $1 = ($6 << $3 >>> 15) - ($3 | ($1 | $5)) | 0;
        $1 = ($1 << 1 | $0 >>> $1 + 21 & 1) + 28 | 0;
       }
       HEAP32[$2 + 28 >> 2] = $1;
       HEAP32[$7 + 16 >> 2] = 0;
       HEAP32[$7 + 20 >> 2] = 0;
       $2 = ($1 << 2) + 4788 | 0;
       label$119 : {
        $3 = HEAP32[1122];
        $5 = 1 << $1;
        label$120 : {
         if (!($3 & $5)) {
          HEAP32[1122] = $3 | $5;
          HEAP32[$2 >> 2] = $7;
          break label$120;
         }
         $3 = $0 << (($1 | 0) == 31 ? 0 : 25 - ($1 >>> 1) | 0);
         $1 = HEAP32[$2 >> 2];
         while (1) {
          $2 = $1;
          if ((HEAP32[$1 + 4 >> 2] & -8) == ($0 | 0)) {
           break label$119;
          }
          $1 = $3 >>> 29;
          $3 = $3 << 1;
          $5 = (($1 & 4) + $2 | 0) + 16 | 0;
          $1 = HEAP32[$5 >> 2];
          if ($1) {
           continue;
          }
          break;
         }
         if (HEAPU32[1125] > $5 >>> 0) {
          break label$4;
         }
         HEAP32[$5 >> 2] = $7;
        }
        HEAP32[$7 + 24 >> 2] = $2;
        HEAP32[$7 + 12 >> 2] = $7;
        HEAP32[$7 + 8 >> 2] = $7;
        break label$99;
       }
       $1 = HEAP32[1125];
       $0 = HEAP32[$2 + 8 >> 2];
       if ($1 >>> 0 > $0 >>> 0 | $1 >>> 0 > $2 >>> 0) {
        break label$4;
       }
       HEAP32[$0 + 12 >> 2] = $7;
       HEAP32[$2 + 8 >> 2] = $7;
       HEAP32[$7 + 24 >> 2] = 0;
       HEAP32[$7 + 12 >> 2] = $2;
       HEAP32[$7 + 8 >> 2] = $0;
      }
      $0 = $9 + 8 | 0;
      break label$2;
     }
     $0 = $4 + -40 | 0;
     $2 = $1 + 8 & 7 ? -8 - $1 & 7 : 0;
     $7 = $0 - $2 | 0;
     HEAP32[1124] = $7;
     $2 = $1 + $2 | 0;
     HEAP32[1127] = $2;
     HEAP32[$2 + 4 >> 2] = $7 | 1;
     HEAP32[($0 + $1 | 0) + 4 >> 2] = 40;
     HEAP32[1128] = HEAP32[1243];
     $0 = ($5 + ($5 + -39 & 7 ? 39 - $5 & 7 : 0) | 0) + -47 | 0;
     $2 = $0 >>> 0 < $3 + 16 >>> 0 ? $3 : $0;
     HEAP32[$2 + 4 >> 2] = 27;
     $0 = HEAP32[1236];
     HEAP32[$2 + 16 >> 2] = HEAP32[1235];
     HEAP32[$2 + 20 >> 2] = $0;
     $0 = HEAP32[1234];
     HEAP32[$2 + 8 >> 2] = HEAP32[1233];
     HEAP32[$2 + 12 >> 2] = $0;
     HEAP32[1235] = $2 + 8;
     HEAP32[1234] = $4;
     HEAP32[1233] = $1;
     HEAP32[1236] = 0;
     $0 = $2 + 24 | 0;
     while (1) {
      HEAP32[$0 + 4 >> 2] = 7;
      $1 = $0 + 8 | 0;
      $0 = $0 + 4 | 0;
      if ($1 >>> 0 < $5 >>> 0) {
       continue;
      }
      break;
     }
     if (($2 | 0) == ($3 | 0)) {
      break label$84;
     }
     HEAP32[$2 + 4 >> 2] = HEAP32[$2 + 4 >> 2] & -2;
     $5 = $2 - $3 | 0;
     HEAP32[$3 + 4 >> 2] = $5 | 1;
     HEAP32[$2 >> 2] = $5;
     if ($5 >>> 0 <= 255) {
      $1 = $5 >>> 3;
      $0 = ($1 << 3) + 4524 | 0;
      $2 = HEAP32[1121];
      $1 = 1 << $1;
      label$125 : {
       if (!($2 & $1)) {
        HEAP32[1121] = $1 | $2;
        $2 = $0;
        break label$125;
       }
       $2 = HEAP32[$0 + 8 >> 2];
       if (HEAPU32[1125] > $2 >>> 0) {
        break label$4;
       }
      }
      HEAP32[$0 + 8 >> 2] = $3;
      HEAP32[$2 + 12 >> 2] = $3;
      HEAP32[$3 + 12 >> 2] = $0;
      HEAP32[$3 + 8 >> 2] = $2;
      break label$84;
     }
     HEAP32[$3 + 16 >> 2] = 0;
     HEAP32[$3 + 20 >> 2] = 0;
     $1 = $3;
     $2 = $5 >>> 8;
     $0 = 0;
     label$127 : {
      if (!$2) {
       break label$127;
      }
      $0 = 31;
      if ($5 >>> 0 > 16777215) {
       break label$127;
      }
      $4 = $2 + 1048320 >>> 16 & 8;
      $2 = $2 << $4;
      $0 = $2 + 520192 >>> 16 & 4;
      $7 = $2 << $0;
      $2 = $7 + 245760 >>> 16 & 2;
      $0 = ($7 << $2 >>> 15) - ($2 | ($0 | $4)) | 0;
      $0 = ($0 << 1 | $5 >>> $0 + 21 & 1) + 28 | 0;
     }
     HEAP32[$1 + 28 >> 2] = $0;
     $1 = ($0 << 2) + 4788 | 0;
     label$128 : {
      $2 = HEAP32[1122];
      $4 = 1 << $0;
      label$129 : {
       if (!($2 & $4)) {
        HEAP32[1122] = $2 | $4;
        HEAP32[$1 >> 2] = $3;
        HEAP32[$3 + 24 >> 2] = $1;
        break label$129;
       }
       $0 = $5 << (($0 | 0) == 31 ? 0 : 25 - ($0 >>> 1) | 0);
       $1 = HEAP32[$1 >> 2];
       while (1) {
        $2 = $1;
        if (($5 | 0) == (HEAP32[$1 + 4 >> 2] & -8)) {
         break label$128;
        }
        $1 = $0 >>> 29;
        $0 = $0 << 1;
        $4 = ($2 + ($1 & 4) | 0) + 16 | 0;
        $1 = HEAP32[$4 >> 2];
        if ($1) {
         continue;
        }
        break;
       }
       if (HEAPU32[1125] > $4 >>> 0) {
        break label$4;
       }
       HEAP32[$4 >> 2] = $3;
       HEAP32[$3 + 24 >> 2] = $2;
      }
      HEAP32[$3 + 12 >> 2] = $3;
      HEAP32[$3 + 8 >> 2] = $3;
      break label$84;
     }
     $1 = HEAP32[1125];
     $0 = HEAP32[$2 + 8 >> 2];
     if ($1 >>> 0 > $0 >>> 0 | $1 >>> 0 > $2 >>> 0) {
      break label$4;
     }
     HEAP32[$0 + 12 >> 2] = $3;
     HEAP32[$2 + 8 >> 2] = $3;
     HEAP32[$3 + 24 >> 2] = 0;
     HEAP32[$3 + 12 >> 2] = $2;
     HEAP32[$3 + 8 >> 2] = $0;
    }
    $0 = HEAP32[1124];
    if ($0 >>> 0 <= $6 >>> 0) {
     break label$3;
    }
    $1 = $0 - $6 | 0;
    HEAP32[1124] = $1;
    $0 = HEAP32[1127];
    $2 = $0 + $6 | 0;
    HEAP32[1127] = $2;
    HEAP32[$2 + 4 >> 2] = $1 | 1;
    HEAP32[$0 + 4 >> 2] = $6 | 3;
    $0 = $0 + 8 | 0;
    break label$2;
   }
   abort();
   abort();
  }
  HEAP32[1114] = 48;
  $0 = 0;
 }
 $1 = $12 + 16 | 0;
 if ($1 >>> 0 < global$2 >>> 0) {
  __handle_stack_overflow();
 }
 global$0 = $1;
 return $0 | 0;
}
function dlfree($0) {
 $0 = $0 | 0;
 var $1 = 0, $2 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0;
 label$1 : {
  label$2 : {
   if (!$0) {
    break label$2;
   }
   $3 = $0 + -8 | 0;
   $8 = HEAP32[1125];
   if ($3 >>> 0 < $8 >>> 0) {
    break label$1;
   }
   $2 = HEAP32[$0 + -4 >> 2];
   $1 = $2 & 3;
   if (($1 | 0) == 1) {
    break label$1;
   }
   $0 = $2 & -8;
   $6 = $3 + $0 | 0;
   label$3 : {
    if ($2 & 1) {
     break label$3;
    }
    if (!$1) {
     break label$2;
    }
    $1 = HEAP32[$3 >> 2];
    $3 = $3 - $1 | 0;
    if ($3 >>> 0 < $8 >>> 0) {
     break label$1;
    }
    $0 = $0 + $1 | 0;
    if (HEAP32[1126] != ($3 | 0)) {
     if ($1 >>> 0 <= 255) {
      $5 = HEAP32[$3 + 12 >> 2];
      $4 = HEAP32[$3 + 8 >> 2];
      $2 = $1 >>> 3;
      $1 = ($2 << 3) + 4524 | 0;
      if (HEAP32[$4 + 12 >> 2] != ($3 | 0) | $8 >>> 0 > $4 >>> 0 ? ($4 | 0) != ($1 | 0) : 0) {
       break label$1;
      }
      if (($4 | 0) == ($5 | 0)) {
       HEAP32[1121] = HEAP32[1121] & __wasm_rotl_i32($2);
       break label$3;
      }
      if (HEAP32[$5 + 8 >> 2] != ($3 | 0) | $8 >>> 0 > $5 >>> 0 ? ($1 | 0) != ($5 | 0) : 0) {
       break label$1;
      }
      HEAP32[$4 + 12 >> 2] = $5;
      HEAP32[$5 + 8 >> 2] = $4;
      break label$3;
     }
     $7 = HEAP32[$3 + 24 >> 2];
     $2 = HEAP32[$3 + 12 >> 2];
     label$9 : {
      if (($3 | 0) != ($2 | 0)) {
       $1 = HEAP32[$3 + 8 >> 2];
       if ($8 >>> 0 > $1 >>> 0 | HEAP32[$1 + 12 >> 2] != ($3 | 0) | HEAP32[$2 + 8 >> 2] != ($3 | 0)) {
        break label$1;
       }
       HEAP32[$1 + 12 >> 2] = $2;
       HEAP32[$2 + 8 >> 2] = $1;
       break label$9;
      }
      label$11 : {
       $1 = $3 + 20 | 0;
       $4 = HEAP32[$1 >> 2];
       if ($4) {
        break label$11;
       }
       $1 = $3 + 16 | 0;
       $4 = HEAP32[$1 >> 2];
       if ($4) {
        break label$11;
       }
       $2 = 0;
       break label$9;
      }
      while (1) {
       $5 = $1;
       $2 = $4;
       $1 = $2 + 20 | 0;
       $4 = HEAP32[$1 >> 2];
       if ($4) {
        continue;
       }
       $1 = $2 + 16 | 0;
       $4 = HEAP32[$2 + 16 >> 2];
       if ($4) {
        continue;
       }
       break;
      }
      if ($8 >>> 0 > $5 >>> 0) {
       break label$1;
      }
      HEAP32[$5 >> 2] = 0;
     }
     if (!$7) {
      break label$3;
     }
     $4 = HEAP32[$3 + 28 >> 2];
     $1 = ($4 << 2) + 4788 | 0;
     label$13 : {
      if (HEAP32[$1 >> 2] == ($3 | 0)) {
       HEAP32[$1 >> 2] = $2;
       if ($2) {
        break label$13;
       }
       HEAP32[1122] = HEAP32[1122] & __wasm_rotl_i32($4);
       break label$3;
      }
      if (HEAPU32[1125] > $7 >>> 0) {
       break label$1;
      }
      HEAP32[$7 + (HEAP32[$7 + 16 >> 2] == ($3 | 0) ? 16 : 20) >> 2] = $2;
      if (!$2) {
       break label$3;
      }
     }
     $1 = HEAP32[1125];
     if ($1 >>> 0 > $2 >>> 0) {
      break label$1;
     }
     HEAP32[$2 + 24 >> 2] = $7;
     $4 = HEAP32[$3 + 16 >> 2];
     if ($4) {
      if ($1 >>> 0 > $4 >>> 0) {
       break label$1;
      }
      HEAP32[$2 + 16 >> 2] = $4;
      HEAP32[$4 + 24 >> 2] = $2;
     }
     $1 = HEAP32[$3 + 20 >> 2];
     if (!$1) {
      break label$3;
     }
     if (HEAPU32[1125] > $1 >>> 0) {
      break label$1;
     }
     HEAP32[$2 + 20 >> 2] = $1;
     HEAP32[$1 + 24 >> 2] = $2;
     break label$3;
    }
    $1 = HEAP32[$6 + 4 >> 2];
    if (($1 & 3) != 3) {
     break label$3;
    }
    HEAP32[1123] = $0;
    HEAP32[$6 + 4 >> 2] = $1 & -2;
    HEAP32[$3 + 4 >> 2] = $0 | 1;
    HEAP32[$0 + $3 >> 2] = $0;
    return;
   }
   if ($6 >>> 0 <= $3 >>> 0) {
    break label$1;
   }
   $8 = HEAP32[$6 + 4 >> 2];
   if (!($8 & 1)) {
    break label$1;
   }
   label$16 : {
    if (!($8 & 2)) {
     if (HEAP32[1127] == ($6 | 0)) {
      HEAP32[1127] = $3;
      $0 = HEAP32[1124] + $0 | 0;
      HEAP32[1124] = $0;
      HEAP32[$3 + 4 >> 2] = $0 | 1;
      if (HEAP32[1126] != ($3 | 0)) {
       break label$2;
      }
      HEAP32[1123] = 0;
      HEAP32[1126] = 0;
      return;
     }
     if (HEAP32[1126] == ($6 | 0)) {
      HEAP32[1126] = $3;
      $0 = HEAP32[1123] + $0 | 0;
      HEAP32[1123] = $0;
      HEAP32[$3 + 4 >> 2] = $0 | 1;
      HEAP32[$0 + $3 >> 2] = $0;
      return;
     }
     label$20 : {
      if ($8 >>> 0 <= 255) {
       $5 = HEAP32[$6 + 12 >> 2];
       $4 = HEAP32[$6 + 8 >> 2];
       $2 = $8 >>> 3;
       $1 = ($2 << 3) + 4524 | 0;
       if (HEAP32[$4 + 12 >> 2] != ($6 | 0) | HEAPU32[1125] > $4 >>> 0 ? ($4 | 0) != ($1 | 0) : 0) {
        break label$1;
       }
       if (($4 | 0) == ($5 | 0)) {
        HEAP32[1121] = HEAP32[1121] & __wasm_rotl_i32($2);
        break label$20;
       }
       if (HEAP32[$5 + 8 >> 2] != ($6 | 0) | HEAPU32[1125] > $5 >>> 0 ? ($1 | 0) != ($5 | 0) : 0) {
        break label$1;
       }
       HEAP32[$4 + 12 >> 2] = $5;
       HEAP32[$5 + 8 >> 2] = $4;
       break label$20;
      }
      $7 = HEAP32[$6 + 24 >> 2];
      $2 = HEAP32[$6 + 12 >> 2];
      label$25 : {
       if (($6 | 0) != ($2 | 0)) {
        $1 = HEAP32[$6 + 8 >> 2];
        if (HEAPU32[1125] > $1 >>> 0 | HEAP32[$1 + 12 >> 2] != ($6 | 0) | HEAP32[$2 + 8 >> 2] != ($6 | 0)) {
         break label$1;
        }
        HEAP32[$1 + 12 >> 2] = $2;
        HEAP32[$2 + 8 >> 2] = $1;
        break label$25;
       }
       label$27 : {
        $1 = $6 + 20 | 0;
        $4 = HEAP32[$1 >> 2];
        if ($4) {
         break label$27;
        }
        $1 = $6 + 16 | 0;
        $4 = HEAP32[$1 >> 2];
        if ($4) {
         break label$27;
        }
        $2 = 0;
        break label$25;
       }
       while (1) {
        $5 = $1;
        $2 = $4;
        $1 = $2 + 20 | 0;
        $4 = HEAP32[$1 >> 2];
        if ($4) {
         continue;
        }
        $1 = $2 + 16 | 0;
        $4 = HEAP32[$2 + 16 >> 2];
        if ($4) {
         continue;
        }
        break;
       }
       if (HEAPU32[1125] > $5 >>> 0) {
        break label$1;
       }
       HEAP32[$5 >> 2] = 0;
      }
      if (!$7) {
       break label$20;
      }
      $4 = HEAP32[$6 + 28 >> 2];
      $1 = ($4 << 2) + 4788 | 0;
      label$29 : {
       if (HEAP32[$1 >> 2] == ($6 | 0)) {
        HEAP32[$1 >> 2] = $2;
        if ($2) {
         break label$29;
        }
        HEAP32[1122] = HEAP32[1122] & __wasm_rotl_i32($4);
        break label$20;
       }
       if (HEAPU32[1125] > $7 >>> 0) {
        break label$1;
       }
       HEAP32[$7 + (HEAP32[$7 + 16 >> 2] == ($6 | 0) ? 16 : 20) >> 2] = $2;
       if (!$2) {
        break label$20;
       }
      }
      $1 = HEAP32[1125];
      if ($1 >>> 0 > $2 >>> 0) {
       break label$1;
      }
      HEAP32[$2 + 24 >> 2] = $7;
      $4 = HEAP32[$6 + 16 >> 2];
      if ($4) {
       if ($1 >>> 0 > $4 >>> 0) {
        break label$1;
       }
       HEAP32[$2 + 16 >> 2] = $4;
       HEAP32[$4 + 24 >> 2] = $2;
      }
      $1 = HEAP32[$6 + 20 >> 2];
      if (!$1) {
       break label$20;
      }
      if (HEAPU32[1125] > $1 >>> 0) {
       break label$1;
      }
      HEAP32[$2 + 20 >> 2] = $1;
      HEAP32[$1 + 24 >> 2] = $2;
     }
     $0 = ($8 & -8) + $0 | 0;
     HEAP32[$3 + 4 >> 2] = $0 | 1;
     HEAP32[$0 + $3 >> 2] = $0;
     if (HEAP32[1126] != ($3 | 0)) {
      break label$16;
     }
     HEAP32[1123] = $0;
     return;
    }
    HEAP32[$6 + 4 >> 2] = $8 & -2;
    HEAP32[$3 + 4 >> 2] = $0 | 1;
    HEAP32[$0 + $3 >> 2] = $0;
   }
   if ($0 >>> 0 <= 255) {
    $1 = $0 >>> 3;
    $0 = ($1 << 3) + 4524 | 0;
    $2 = HEAP32[1121];
    $1 = 1 << $1;
    label$33 : {
     if (!($2 & $1)) {
      HEAP32[1121] = $1 | $2;
      $1 = $0;
      break label$33;
     }
     $1 = HEAP32[$0 + 8 >> 2];
     if (HEAPU32[1125] > $1 >>> 0) {
      break label$1;
     }
    }
    HEAP32[$0 + 8 >> 2] = $3;
    HEAP32[$1 + 12 >> 2] = $3;
    HEAP32[$3 + 12 >> 2] = $0;
    HEAP32[$3 + 8 >> 2] = $1;
    return;
   }
   HEAP32[$3 + 16 >> 2] = 0;
   HEAP32[$3 + 20 >> 2] = 0;
   $1 = $3;
   $4 = $0 >>> 8;
   $2 = 0;
   label$35 : {
    if (!$4) {
     break label$35;
    }
    $2 = 31;
    if ($0 >>> 0 > 16777215) {
     break label$35;
    }
    $2 = $4;
    $4 = $4 + 1048320 >>> 16 & 8;
    $2 = $2 << $4;
    $7 = $2 + 520192 >>> 16 & 4;
    $2 = $2 << $7;
    $5 = $2 + 245760 >>> 16 & 2;
    $2 = ($2 << $5 >>> 15) - ($5 | ($4 | $7)) | 0;
    $2 = ($2 << 1 | $0 >>> $2 + 21 & 1) + 28 | 0;
   }
   HEAP32[$1 + 28 >> 2] = $2;
   $5 = ($2 << 2) + 4788 | 0;
   $4 = HEAP32[1122];
   $1 = 1 << $2;
   label$36 : {
    if (!($4 & $1)) {
     HEAP32[1122] = $1 | $4;
     HEAP32[$5 >> 2] = $3;
     HEAP32[$3 + 12 >> 2] = $3;
     HEAP32[$3 + 24 >> 2] = $5;
     HEAP32[$3 + 8 >> 2] = $3;
     break label$36;
    }
    $1 = $0 << (($2 | 0) == 31 ? 0 : 25 - ($2 >>> 1) | 0);
    $2 = HEAP32[$5 >> 2];
    label$38 : {
     while (1) {
      $4 = $2;
      if ((HEAP32[$2 + 4 >> 2] & -8) == ($0 | 0)) {
       break label$38;
      }
      $2 = $1 >>> 29;
      $1 = $1 << 1;
      $5 = ($4 + ($2 & 4) | 0) + 16 | 0;
      $2 = HEAP32[$5 >> 2];
      if ($2) {
       continue;
      }
      break;
     }
     if (HEAPU32[1125] > $5 >>> 0) {
      break label$1;
     }
     HEAP32[$5 >> 2] = $3;
     HEAP32[$3 + 12 >> 2] = $3;
     HEAP32[$3 + 24 >> 2] = $4;
     HEAP32[$3 + 8 >> 2] = $3;
     break label$36;
    }
    $0 = HEAP32[1125];
    $1 = HEAP32[$4 + 8 >> 2];
    if ($0 >>> 0 > $1 >>> 0 | $0 >>> 0 > $4 >>> 0) {
     break label$1;
    }
    HEAP32[$1 + 12 >> 2] = $3;
    HEAP32[$4 + 8 >> 2] = $3;
    HEAP32[$3 + 24 >> 2] = 0;
    HEAP32[$3 + 12 >> 2] = $4;
    HEAP32[$3 + 8 >> 2] = $1;
   }
   $0 = HEAP32[1129] + -1 | 0;
   HEAP32[1129] = $0;
   if ($0) {
    break label$2;
   }
   $3 = 4940;
   while (1) {
    $0 = HEAP32[$3 >> 2];
    $3 = $0 + 8 | 0;
    if ($0) {
     continue;
    }
    break;
   }
   HEAP32[1129] = -1;
  }
  return;
 }
 abort();
 abort();
}
function lzx_read_bitlen_28lzx_stream__2c_20huffman__2c_20int_29($0, $1, $2) {
 var $3 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0;
 $5 = HEAP32[$0 + 48 >> 2];
 $8 = HEAP32[$5 + 464 >> 2];
 if (!$8) {
  memset($1 + 4 | 0, 68);
 }
 $2 = ($2 | 0) <= -1 ? HEAP32[$1 >> 2] : $2;
 $3 = 1;
 label$2 : {
  label$3 : {
   if (($8 | 0) >= ($2 | 0)) {
    break label$3;
   }
   $11 = $5 + 80 | 0;
   while (1) {
    HEAP32[$5 + 464 >> 2] = $8;
    label$6 : {
     $4 = HEAP32[$5 + 88 >> 2];
     $3 = HEAP32[$5 + 448 >> 2];
     if (($4 | 0) >= ($3 | 0)) {
      break label$6;
     }
     $9 = lzx_br_fillup_28lzx_stream__2c_20lzx_br__29($0, $11);
     $4 = HEAP32[$5 + 88 >> 2];
     $3 = HEAP32[$5 + 448 >> 2];
     if ($9 | ($4 | 0) >= ($3 | 0)) {
      break label$6;
     }
     $3 = 0;
     break label$3;
    }
    label$7 : {
     label$8 : {
      label$9 : {
       label$10 : {
        $7 = HEAP32[$5 + 84 >> 2];
        $10 = $4 - $3 | 0;
        $6 = $10 & 31;
        $6 = HEAPU16[HEAP32[$5 + 460 >> 2] + ((HEAP32[($3 << 2) + 1072 >> 2] & (32 <= ($10 & 63) >>> 0 ? $7 >>> $6 : ((1 << $6) - 1 & $7) << 32 - $6 | HEAP32[$5 + 80 >> 2] >>> $6)) << 1) >> 1];
        $6 = HEAP32[$5 + 372 >> 2] > ($6 | 0) ? $6 : 0;
        $7 = $6 + -17 | 0;
        if ($7 >>> 0 <= 2) {
         label$12 : {
          switch ($7 - 1 | 0) {
          default:
           $3 = HEAPU8[$6 + HEAP32[$5 + 444 >> 2] | 0];
           if (($4 | 0) >= ($3 + 4 | 0)) {
            break label$8;
           }
           if (lzx_br_fillup_28lzx_stream__2c_20lzx_br__29($0, $11)) {
            $3 = HEAPU8[$6 + HEAP32[$5 + 444 >> 2] | 0];
            $4 = HEAP32[$5 + 88 >> 2];
            break label$8;
           }
           $4 = HEAP32[$5 + 88 >> 2];
           $3 = HEAPU8[$6 + HEAP32[$5 + 444 >> 2] | 0];
           if (($4 | 0) >= ($3 + 4 | 0)) {
            break label$8;
           }
           $3 = 0;
           break label$3;
          case 0:
           $3 = HEAPU8[$6 + HEAP32[$5 + 444 >> 2] | 0];
           if (($4 | 0) >= ($3 + 5 | 0)) {
            break label$9;
           }
           if (lzx_br_fillup_28lzx_stream__2c_20lzx_br__29($0, $11)) {
            $3 = HEAPU8[$6 + HEAP32[$5 + 444 >> 2] | 0];
            $4 = HEAP32[$5 + 88 >> 2];
            break label$9;
           }
           $4 = HEAP32[$5 + 88 >> 2];
           $3 = HEAPU8[$6 + HEAP32[$5 + 444 >> 2] | 0];
           if (($4 | 0) >= ($3 + 5 | 0)) {
            break label$9;
           }
           $3 = 0;
           break label$3;
          case 1:
           break label$12;
          }
         }
         $9 = $3;
         $7 = HEAP32[$5 + 444 >> 2];
         $3 = HEAPU8[$6 + $7 | 0];
         if (($4 | 0) >= (($9 + $3 | 0) + 1 | 0)) {
          break label$10;
         }
         if (lzx_br_fillup_28lzx_stream__2c_20lzx_br__29($0, $11)) {
          $7 = HEAP32[$5 + 444 >> 2];
          $3 = HEAPU8[$6 + $7 | 0];
          $4 = HEAP32[$5 + 88 >> 2];
          break label$10;
         }
         $4 = HEAP32[$5 + 88 >> 2];
         $7 = HEAP32[$5 + 444 >> 2];
         $3 = HEAPU8[$6 + $7 | 0];
         if (($4 | 0) >= (($3 + HEAP32[$5 + 448 >> 2] | 0) + 1 | 0)) {
          break label$10;
         }
         $3 = 0;
         break label$3;
        }
        HEAP32[$5 + 88 >> 2] = $4 - HEAPU8[$6 + HEAP32[$5 + 444 >> 2] | 0];
        $4 = HEAP32[$1 + 72 >> 2] + $8 | 0;
        $3 = ((HEAPU8[$4 | 0] - $6 | 0) + 17 | 0) % 17 | 0;
        if (($3 | 0) < 0) {
         return -1;
        }
        $6 = ($3 << 2) + $1 | 0;
        HEAP32[$6 + 4 >> 2] = HEAP32[$6 + 4 >> 2] + 1;
        HEAP8[$4 | 0] = $3;
        $8 = $8 + 1 | 0;
        break label$7;
       }
       $6 = $4 - $3 | 0;
       HEAP32[$5 + 88 >> 2] = $6;
       $3 = -1;
       $4 = HEAP32[$5 + 84 >> 2];
       $9 = $6 + -1 | 0;
       $6 = $9 & 31;
       $12 = HEAP32[$5 + 80 >> 2];
       $10 = (32 <= ($9 & 63) >>> 0 ? $4 >>> $6 : ((1 << $6) - 1 & $4) << 32 - $6 | $12 >>> $6) & 1 | 4;
       if (($10 + $8 | 0) > ($2 | 0)) {
        break label$2;
       }
       HEAP32[$5 + 88 >> 2] = $9;
       $13 = $9;
       $6 = HEAP32[$5 + 448 >> 2];
       $14 = HEAP32[($6 << 2) + 1072 >> 2];
       $9 = $9 - $6 | 0;
       $6 = $9 & 31;
       $4 = HEAPU16[HEAP32[$5 + 460 >> 2] + (($14 & (32 <= ($9 & 63) >>> 0 ? $4 >>> $6 : ((1 << $6) - 1 & $4) << 32 - $6 | $12 >>> $6)) << 1) >> 1];
       $4 = HEAP32[$5 + 372 >> 2] > ($4 | 0) ? $4 : 0;
       HEAP32[$5 + 88 >> 2] = $13 - HEAPU8[$4 + $7 | 0];
       $7 = HEAP32[$1 + 72 >> 2] + $8 | 0;
       $6 = ((HEAPU8[$7 | 0] - $4 | 0) + 17 | 0) % 17 | 0;
       if (($6 | 0) < 0) {
        break label$2;
       }
       HEAP8[$7 | 0] = $6;
       $4 = 1;
       $8 = $8 + 1 | 0;
       while (1) {
        HEAP8[HEAP32[$1 + 72 >> 2] + $8 | 0] = $6;
        $8 = $8 + 1 | 0;
        $4 = $4 + 1 | 0;
        if (($10 | 0) != ($4 | 0)) {
         continue;
        }
        break;
       }
       $3 = ($6 << 2) + $1 | 0;
       HEAP32[$3 + 4 >> 2] = $10 + HEAP32[$3 + 4 >> 2];
       break label$7;
      }
      $3 = $4 - $3 | 0;
      HEAP32[$5 + 88 >> 2] = $3;
      $4 = HEAP32[$5 + 84 >> 2];
      $7 = $3 + -5 | 0;
      $3 = $7 & 31;
      $4 = ((32 <= ($7 & 63) >>> 0 ? $4 >>> $3 : ((1 << $3) - 1 & $4) << 32 - $3 | HEAP32[$5 + 80 >> 2] >>> $3) & 31) + 20 | 0;
      $3 = $4 + $8 | 0;
      if (($3 | 0) > ($2 | 0)) {
       return -1;
      }
      HEAP32[$5 + 88 >> 2] = $7;
      memset(HEAP32[$1 + 72 >> 2] + $8 | 0, $4);
      $8 = $3;
      break label$7;
     }
     $3 = $4 - $3 | 0;
     HEAP32[$5 + 88 >> 2] = $3;
     $4 = HEAP32[$5 + 84 >> 2];
     $7 = $3 + -4 | 0;
     $3 = $7 & 31;
     $3 = ((32 <= ($7 & 63) >>> 0 ? $4 >>> $3 : ((1 << $3) - 1 & $4) << 32 - $3 | HEAP32[$5 + 80 >> 2] >>> $3) & 15) + 4 | 0;
     if (($3 + $8 | 0) > ($2 | 0)) {
      return -1;
     }
     HEAP32[$5 + 88 >> 2] = $7;
     $4 = 0;
     while (1) {
      HEAP8[HEAP32[$1 + 72 >> 2] + $8 | 0] = 0;
      $8 = $8 + 1 | 0;
      $4 = $4 + 1 | 0;
      if (($3 | 0) != ($4 | 0)) {
       continue;
      }
      break;
     }
    }
    if (($8 | 0) < ($2 | 0)) {
     continue;
    }
    break;
   }
   $3 = 1;
  }
  HEAP32[$5 + 464 >> 2] = $8;
 }
 return $3;
}
function lzx_decode_init_28lzx_stream__2c_20int_29($0, $1) {
 var $2 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0;
 $5 = global$0 - 80 | 0;
 $3 = $5;
 if ($3 >>> 0 < global$2 >>> 0) {
  __handle_stack_overflow();
 }
 global$0 = $3;
 label$2 : {
  label$3 : {
   $2 = HEAP32[$0 + 48 >> 2];
   if ($2) {
    break label$3;
   }
   $2 = dlcalloc(1, 472);
   HEAP32[$0 + 48 >> 2] = $2;
   if ($2) {
    break label$3;
   }
   $6 = -30;
   break label$2;
  }
  $6 = -25;
  HEAP32[$2 + 468 >> 2] = -25;
  $3 = $1 + -15 | 0;
  if ($3 >>> 0 > 6) {
   break label$2;
  }
  $6 = -30;
  HEAP32[$2 + 468 >> 2] = -30;
  $4 = HEAP32[$2 + 4 >> 2];
  $0 = 1 << $1;
  HEAP32[$2 + 4 >> 2] = $0;
  HEAP32[$2 + 8 >> 2] = $0 + -1;
  $7 = HEAP32[($3 << 2) + 1024 >> 2];
  $1 = ($0 | 0) == ($4 | 0);
  $0 = HEAP32[$2 + 12 >> 2];
  if (!($0 ? $1 : 0)) {
   dlfree($0);
   $0 = dlmalloc(HEAP32[$2 + 4 >> 2]);
   HEAP32[$2 + 12 >> 2] = $0;
   if (!$0) {
    break label$2;
   }
   dlfree(HEAP32[$2 + 76 >> 2]);
   $0 = dlmalloc($7 << 3);
   HEAP32[$2 + 76 >> 2] = $0;
   if (!$0) {
    break label$2;
   }
   dlfree(HEAP32[$2 + 352 >> 2]);
   dlfree(HEAP32[$2 + 368 >> 2]);
  }
  $0 = $5;
  HEAP32[$0 + 64 >> 2] = 65536;
  HEAP32[$0 + 68 >> 2] = 131072;
  HEAP32[$0 + 56 >> 2] = 16384;
  HEAP32[$0 + 60 >> 2] = 32768;
  HEAP32[$0 + 48 >> 2] = 4096;
  HEAP32[$0 + 52 >> 2] = 8192;
  HEAP32[$0 + 40 >> 2] = 1024;
  HEAP32[$0 + 44 >> 2] = 2048;
  HEAP32[$0 + 32 >> 2] = 256;
  HEAP32[$0 + 36 >> 2] = 512;
  HEAP32[$0 + 24 >> 2] = 64;
  HEAP32[$0 + 28 >> 2] = 128;
  HEAP32[$0 + 16 >> 2] = 16;
  HEAP32[$0 + 20 >> 2] = 32;
  HEAP32[$0 + 8 >> 2] = 4;
  HEAP32[$0 + 12 >> 2] = 8;
  HEAP32[$0 >> 2] = 1;
  HEAP32[$0 + 4 >> 2] = 2;
  $8 = HEAP32[$2 + 76 >> 2];
  $0 = 0;
  $1 = 0;
  $4 = 0;
  while (1) {
   $3 = $4;
   label$6 : {
    if ($0) {
     $3 = HEAP32[($0 << 2) + $5 >> 2] + $1 | 0;
     $1 = $3;
     if (($0 | 0) > 16) {
      break label$6;
     }
    }
    $0 = -2;
    $1 = $3;
    if (!$1) {
     $0 = 0;
     $1 = 0;
     break label$6;
    }
    while (1) {
     $9 = $0;
     $0 = $0 + 1 | 0;
     $1 = $1 >> 1;
     if ($1) {
      continue;
     }
     break;
    }
    $0 = ($9 | 0) < 0 ? 0 : $0;
    $1 = $3;
   }
   $3 = ($4 << 3) + $8 | 0;
   HEAP32[$3 + 4 >> 2] = $0;
   HEAP32[$3 >> 2] = $1;
   $4 = $4 + 1 | 0;
   if (($4 | 0) < ($7 | 0)) {
    continue;
   }
   break;
  }
  HEAP32[$2 + 80 >> 2] = 0;
  HEAP32[$2 + 84 >> 2] = 0;
  HEAP32[$2 >> 2] = 0;
  HEAP32[$2 + 16 >> 2] = 0;
  HEAP32[$2 + 52 >> 2] = 1;
  HEAP32[$2 + 44 >> 2] = 1;
  HEAP32[$2 + 48 >> 2] = 1;
  HEAP32[$2 + 88 >> 2] = 0;
  $0 = HEAP32[$2 + 168 >> 2];
  label$10 : {
   if (!(HEAP32[$2 + 96 >> 2] == 8 ? $0 : 0)) {
    dlfree($0);
    $0 = dlcalloc(8, 1);
    HEAP32[$2 + 168 >> 2] = $0;
    if (!$0) {
     break label$2;
    }
    HEAP32[$2 + 96 >> 2] = 8;
    break label$10;
   }
   HEAP8[$0 | 0] = 0;
   HEAP8[$0 + 1 | 0] = 0;
   HEAP8[$0 + 2 | 0] = 0;
   HEAP8[$0 + 3 | 0] = 0;
   HEAP8[$0 + 4 | 0] = 0;
   HEAP8[$0 + 5 | 0] = 0;
   HEAP8[$0 + 6 | 0] = 0;
   HEAP8[$0 + 7 | 0] = 0;
  }
  if (!HEAP32[$2 + 184 >> 2]) {
   $0 = dlmalloc(512);
   HEAP32[$2 + 184 >> 2] = $0;
   if (!$0) {
    break label$2;
   }
   HEAP32[$2 + 176 >> 2] = 8;
  }
  $0 = HEAP32[$2 + 444 >> 2];
  label$14 : {
   if (!(HEAP32[$2 + 372 >> 2] == 20 ? $0 : 0)) {
    dlfree($0);
    $0 = dlcalloc(20, 1);
    HEAP32[$2 + 444 >> 2] = $0;
    if (!$0) {
     break label$2;
    }
    HEAP32[$2 + 372 >> 2] = 20;
    break label$14;
   }
   HEAP8[$0 | 0] = 0;
   HEAP8[$0 + 1 | 0] = 0;
   HEAP8[$0 + 2 | 0] = 0;
   HEAP8[$0 + 3 | 0] = 0;
   HEAP8[$0 + 4 | 0] = 0;
   HEAP8[$0 + 5 | 0] = 0;
   HEAP8[$0 + 6 | 0] = 0;
   HEAP8[$0 + 7 | 0] = 0;
   HEAP8[$0 + 16 | 0] = 0;
   HEAP8[$0 + 17 | 0] = 0;
   HEAP8[$0 + 18 | 0] = 0;
   HEAP8[$0 + 19 | 0] = 0;
   HEAP8[$0 + 8 | 0] = 0;
   HEAP8[$0 + 9 | 0] = 0;
   HEAP8[$0 + 10 | 0] = 0;
   HEAP8[$0 + 11 | 0] = 0;
   HEAP8[$0 + 12 | 0] = 0;
   HEAP8[$0 + 13 | 0] = 0;
   HEAP8[$0 + 14 | 0] = 0;
   HEAP8[$0 + 15 | 0] = 0;
  }
  if (!HEAP32[$2 + 460 >> 2]) {
   $0 = dlmalloc(2048);
   HEAP32[$2 + 460 >> 2] = $0;
   if (!$0) {
    break label$2;
   }
   HEAP32[$2 + 452 >> 2] = 10;
  }
  $1 = HEAP32[$2 + 352 >> 2];
  $0 = ($7 << 3) + 256 | 0;
  label$18 : {
   if (!(($0 | 0) == HEAP32[$2 + 280 >> 2] ? $1 : 0)) {
    dlfree($1);
    $1 = dlcalloc($0, 1);
    HEAP32[$2 + 352 >> 2] = $1;
    if (!$1) {
     break label$2;
    }
    HEAP32[$2 + 280 >> 2] = $0;
    break label$18;
   }
   memset($1, $0);
  }
  if (!HEAP32[$2 + 368 >> 2]) {
   $0 = dlmalloc(131072);
   HEAP32[$2 + 368 >> 2] = $0;
   if (!$0) {
    break label$2;
   }
   HEAP32[$2 + 360 >> 2] = 16;
  }
  $0 = HEAP32[$2 + 260 >> 2];
  label$22 : {
   if (!(HEAP32[$2 + 188 >> 2] == 249 ? $0 : 0)) {
    dlfree($0);
    $0 = dlcalloc(249, 1);
    HEAP32[$2 + 260 >> 2] = $0;
    if (!$0) {
     break label$2;
    }
    HEAP32[$2 + 188 >> 2] = 249;
    break label$22;
   }
   memset($0, 249);
  }
  if (!HEAP32[$2 + 276 >> 2]) {
   $0 = dlmalloc(131072);
   HEAP32[$2 + 276 >> 2] = $0;
   if (!$0) {
    break label$2;
   }
   HEAP32[$2 + 268 >> 2] = 16;
  }
  $6 = 0;
  HEAP32[$2 + 468 >> 2] = 0;
 }
 $0 = $5 + 80 | 0;
 if ($0 >>> 0 < global$2 >>> 0) {
  __handle_stack_overflow();
 }
 global$0 = $0;
 return $6;
}
function lzx_make_huffman_table_28huffman__29($0) {
 var $1 = 0, $2 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0;
 $1 = global$0 - 160 | 0;
 $4 = $1;
 if ($1 >>> 0 < global$2 >>> 0) {
  __handle_stack_overflow();
 }
 global$0 = $4;
 $4 = 0;
 HEAP32[$1 + 84 >> 2] = 0;
 HEAP32[$1 + 4 >> 2] = 32768;
 $3 = HEAP32[$0 + 8 >> 2];
 HEAP32[$1 + 8 >> 2] = 16384;
 $6 = $3 << 15;
 HEAP32[$1 + 88 >> 2] = $6;
 $10 = HEAP32[$0 + 12 >> 2];
 HEAP32[$1 + 12 >> 2] = 8192;
 $2 = $6 + ($10 << 14) | 0;
 HEAP32[$1 + 92 >> 2] = $2;
 $6 = HEAP32[$0 + 16 >> 2];
 HEAP32[$1 + 16 >> 2] = 4096;
 $7 = $2 + ($6 << 13) | 0;
 HEAP32[$1 + 96 >> 2] = $7;
 $2 = HEAP32[$0 + 20 >> 2];
 HEAP32[$1 + 20 >> 2] = 2048;
 $5 = $7 + ($2 << 12) | 0;
 HEAP32[$1 + 100 >> 2] = $5;
 $7 = HEAP32[$0 + 24 >> 2];
 HEAP32[$1 + 24 >> 2] = 1024;
 $8 = $5 + ($7 << 11) | 0;
 HEAP32[$1 + 104 >> 2] = $8;
 $5 = HEAP32[$0 + 28 >> 2];
 HEAP32[$1 + 28 >> 2] = 512;
 $12 = $8 + ($5 << 10) | 0;
 HEAP32[$1 + 108 >> 2] = $12;
 $8 = HEAP32[$0 + 32 >> 2];
 HEAP32[$1 + 32 >> 2] = 256;
 $11 = $12 + ($8 << 9) | 0;
 HEAP32[$1 + 112 >> 2] = $11;
 $12 = HEAP32[$0 + 36 >> 2];
 HEAP32[$1 + 36 >> 2] = 128;
 $11 = $11 + ($12 << 8) | 0;
 HEAP32[$1 + 116 >> 2] = $11;
 $18 = HEAP32[$0 + 40 >> 2];
 $13 = $11 + ($18 << 7) | 0;
 HEAP32[$1 + 120 >> 2] = $13;
 HEAP32[$1 + 40 >> 2] = 64;
 $11 = HEAP32[$0 + 44 >> 2];
 HEAP32[$1 + 44 >> 2] = 32;
 $14 = $13 + ($11 << 6) | 0;
 HEAP32[$1 + 124 >> 2] = $14;
 $13 = HEAP32[$0 + 48 >> 2];
 HEAP32[$1 + 48 >> 2] = 16;
 $15 = $14 + ($13 << 5) | 0;
 HEAP32[$1 + 128 >> 2] = $15;
 $14 = HEAP32[$0 + 52 >> 2];
 HEAP32[$1 + 52 >> 2] = 8;
 $16 = $15 + ($14 << 4) | 0;
 HEAP32[$1 + 132 >> 2] = $16;
 $15 = HEAP32[$0 + 56 >> 2];
 HEAP32[$1 + 56 >> 2] = 4;
 $17 = $16 + ($15 << 3) | 0;
 HEAP32[$1 + 136 >> 2] = $17;
 $16 = HEAP32[$0 + 60 >> 2];
 HEAP32[$1 + 60 >> 2] = 2;
 $9 = $17 + ($16 << 2) | 0;
 HEAP32[$1 + 140 >> 2] = $9;
 $17 = HEAP32[$0 - -64 >> 2];
 HEAP32[$1 + 64 >> 2] = 1;
 $9 = $9 + ($17 << 1) | 0;
 HEAP32[$1 + 144 >> 2] = $9;
 $19 = $9;
 $9 = HEAP32[$0 + 68 >> 2];
 label$2 : {
  if ($19 + $9 & 65535) {
   break label$2;
  }
  $3 = $9 ? 16 : $17 ? 15 : $16 ? 14 : $15 ? 13 : $14 ? 12 : $13 ? 11 : $11 ? 10 : $18 ? 9 : $12 ? 8 : $8 ? 7 : $5 ? 6 : $7 ? 5 : $2 ? 4 : $6 ? 3 : $10 ? 2 : ($3 | 0) != 0;
  $6 = HEAP32[$0 + 80 >> 2];
  if (($3 | 0) > ($6 | 0)) {
   break label$2;
  }
  HEAP32[$0 + 76 >> 2] = $3;
  label$3 : {
   if (($3 | 0) > 15) {
    break label$3;
   }
   $4 = 1;
   if (($3 | 0) < 1) {
    break label$3;
   }
   $10 = 16 - $3 | 0;
   while (1) {
    $2 = $4 << 2;
    $7 = $2 + ($1 + 80 | 0) | 0;
    HEAP32[$7 >> 2] = HEAP32[$7 >> 2] >> $10;
    $2 = $1 + $2 | 0;
    HEAP32[$2 >> 2] = HEAP32[$2 >> 2] >> $10;
    $2 = ($4 | 0) != ($3 | 0);
    $4 = $4 + 1 | 0;
    if ($2) {
     continue;
    }
    break;
   }
  }
  $3 = 0;
  HEAP32[$0 + 84 >> 2] = 0;
  $4 = 1;
  $2 = HEAP32[$0 >> 2];
  if (($2 | 0) < 1) {
   break label$2;
  }
  $10 = 1 << $6;
  $6 = HEAP32[$0 + 72 >> 2];
  $7 = HEAP32[$0 + 88 >> 2];
  while (1) {
   $0 = HEAPU8[$3 + $6 | 0];
   label$6 : {
    if (!$0) {
     break label$6;
    }
    $4 = 0;
    if (($10 | 0) < ($0 | 0)) {
     break label$2;
    }
    $0 = $0 << 2;
    $5 = $0 + ($1 + 80 | 0) | 0;
    $9 = $5;
    $0 = HEAP32[$0 + $1 >> 2];
    $5 = HEAP32[$5 >> 2];
    $8 = $0 + $5 | 0;
    HEAP32[$9 >> 2] = $8;
    if (($8 | 0) > ($10 | 0)) {
     break label$2;
    }
    if (($0 | 0) < 1) {
     break label$6;
    }
    $5 = $7 + ($5 << 1) | 0;
    while (1) {
     $4 = $0 + -1 | 0;
     HEAP16[$5 + ($4 << 1) >> 1] = $3;
     $8 = ($0 | 0) > 1;
     $0 = $4;
     if ($8) {
      continue;
     }
     break;
    }
   }
   $4 = 1;
   $3 = $3 + 1 | 0;
   if (($2 | 0) != ($3 | 0)) {
    continue;
   }
   break;
  }
 }
 $0 = $1 + 160 | 0;
 if ($0 >>> 0 < global$2 >>> 0) {
  __handle_stack_overflow();
 }
 global$0 = $0;
 return $4;
}
function __cxxabiv1____vmi_class_type_info__search_below_dst_28__cxxabiv1____dynamic_cast_info__2c_20void_20const__2c_20int_2c_20bool_29_20const($0, $1, $2, $3, $4) {
 $0 = $0 | 0;
 $1 = $1 | 0;
 $2 = $2 | 0;
 $3 = $3 | 0;
 $4 = $4 | 0;
 var $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0;
 if (is_equal_28std__type_info_20const__2c_20std__type_info_20const__2c_20bool_29($0, HEAP32[$1 + 8 >> 2], $4)) {
  if (!(HEAP32[$1 + 28 >> 2] == 1 | HEAP32[$1 + 4 >> 2] != ($2 | 0))) {
   HEAP32[$1 + 28 >> 2] = $3;
  }
  return;
 }
 label$3 : {
  if (is_equal_28std__type_info_20const__2c_20std__type_info_20const__2c_20bool_29($0, HEAP32[$1 >> 2], $4)) {
   if (!(HEAP32[$1 + 20 >> 2] != ($2 | 0) ? HEAP32[$1 + 16 >> 2] != ($2 | 0) : 0)) {
    if (($3 | 0) != 1) {
     break label$3;
    }
    HEAP32[$1 + 32 >> 2] = 1;
    return;
   }
   HEAP32[$1 + 32 >> 2] = $3;
   if (HEAP32[$1 + 44 >> 2] != 4) {
    $5 = $0 + 16 | 0;
    $8 = $5 + (HEAP32[$0 + 12 >> 2] << 3) | 0;
    $9 = $1;
    label$8 : {
     label$9 : {
      while (1) {
       label$11 : {
        if ($5 >>> 0 >= $8 >>> 0) {
         break label$11;
        }
        HEAP16[$1 + 52 >> 1] = 0;
        __cxxabiv1____base_class_type_info__search_above_dst_28__cxxabiv1____dynamic_cast_info__2c_20void_20const__2c_20void_20const__2c_20int_2c_20bool_29_20const($5, $1, $2, $2, 1, $4);
        if (HEAPU8[$1 + 54 | 0]) {
         break label$11;
        }
        label$12 : {
         if (!HEAPU8[$1 + 53 | 0]) {
          break label$12;
         }
         if (HEAPU8[$1 + 52 | 0]) {
          $3 = 1;
          if (HEAP32[$1 + 24 >> 2] == 1) {
           break label$9;
          }
          $7 = 1;
          $6 = 1;
          if (HEAPU8[$0 + 8 | 0] & 2) {
           break label$12;
          }
          break label$9;
         }
         $7 = 1;
         $3 = $6;
         if (!(HEAP8[$0 + 8 | 0] & 1)) {
          break label$9;
         }
        }
        $5 = $5 + 8 | 0;
        continue;
       }
       break;
      }
      $3 = $6;
      $0 = 4;
      if (!$7) {
       break label$8;
      }
     }
     $0 = 3;
    }
    HEAP32[$9 + 44 >> 2] = $0;
    if ($3 & 1) {
     break label$3;
    }
   }
   HEAP32[$1 + 20 >> 2] = $2;
   HEAP32[$1 + 40 >> 2] = HEAP32[$1 + 40 >> 2] + 1;
   if (HEAP32[$1 + 36 >> 2] != 1 | HEAP32[$1 + 24 >> 2] != 2) {
    break label$3;
   }
   HEAP8[$1 + 54 | 0] = 1;
   return;
  }
  $6 = HEAP32[$0 + 12 >> 2];
  $5 = $0 + 16 | 0;
  __cxxabiv1____base_class_type_info__search_below_dst_28__cxxabiv1____dynamic_cast_info__2c_20void_20const__2c_20int_2c_20bool_29_20const($5, $1, $2, $3, $4);
  if (($6 | 0) < 2) {
   break label$3;
  }
  $6 = $5 + ($6 << 3) | 0;
  $5 = $0 + 24 | 0;
  $0 = HEAP32[$0 + 8 >> 2];
  if (!(HEAP32[$1 + 36 >> 2] != 1 ? !($0 & 2) : 0)) {
   while (1) {
    if (HEAPU8[$1 + 54 | 0]) {
     break label$3;
    }
    __cxxabiv1____base_class_type_info__search_below_dst_28__cxxabiv1____dynamic_cast_info__2c_20void_20const__2c_20int_2c_20bool_29_20const($5, $1, $2, $3, $4);
    $5 = $5 + 8 | 0;
    if ($5 >>> 0 < $6 >>> 0) {
     continue;
    }
    break;
   }
   break label$3;
  }
  if (!($0 & 1)) {
   while (1) {
    if (HEAPU8[$1 + 54 | 0] | HEAP32[$1 + 36 >> 2] == 1) {
     break label$3;
    }
    __cxxabiv1____base_class_type_info__search_below_dst_28__cxxabiv1____dynamic_cast_info__2c_20void_20const__2c_20int_2c_20bool_29_20const($5, $1, $2, $3, $4);
    $5 = $5 + 8 | 0;
    if ($5 >>> 0 < $6 >>> 0) {
     continue;
    }
    break label$3;
   }
  }
  while (1) {
   if (HEAPU8[$1 + 54 | 0] | (HEAP32[$1 + 24 >> 2] == 1 ? HEAP32[$1 + 36 >> 2] == 1 : 0)) {
    break label$3;
   }
   __cxxabiv1____base_class_type_info__search_below_dst_28__cxxabiv1____dynamic_cast_info__2c_20void_20const__2c_20int_2c_20bool_29_20const($5, $1, $2, $3, $4);
   $5 = $5 + 8 | 0;
   if ($5 >>> 0 < $6 >>> 0) {
    continue;
   }
   break;
  }
 }
}
function lzx_br_fillup_28lzx_stream__2c_20lzx_br__29($0, $1) {
 var $2 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, $10 = 0, $11 = 0;
 $9 = HEAP32[$1 + 8 >> 2];
 $5 = 64 - $9 | 0;
 $7 = 1;
 while (1) {
  label$2 : {
   label$3 : {
    label$4 : {
     label$5 : {
      $3 = $5 >> 4;
      if ($3 >>> 0 > 4) {
       break label$5;
      }
      label$6 : {
       switch ($3 - 1 | 0) {
       case 3:
        $8 = HEAP32[$0 + 8 >> 2];
        $4 = HEAP32[$0 + 12 >> 2];
        if (($4 | 0) < 0 ? 1 : ($4 | 0) <= 0 ? $8 >>> 0 >= 8 ? 0 : 1 : 0) {
         break label$4;
        }
        $5 = HEAP32[$0 >> 2];
        $6 = HEAPU8[$5 | 0] << 16 | HEAPU8[$5 + 1 | 0] << 24 | HEAPU8[$5 + 3 | 0] << 8 | HEAPU8[$5 + 2 | 0];
        $3 = HEAPU8[$5 + 5 | 0];
        $2 = $3 >>> 8;
        $3 = $3 << 24;
        $7 = $2 | $6;
        $6 = $3;
        $2 = HEAPU8[$5 + 4 | 0];
        $3 = $2 >>> 16;
        $2 = $6 | $2 << 16;
        $7 = $3 | $7;
        $6 = $2;
        $3 = HEAPU8[$5 + 7 | 0];
        $2 = $3 >>> 24;
        HEAP32[$1 >> 2] = HEAPU8[$5 + 6 | 0] | ($6 | $3 << 8);
        HEAP32[$1 + 4 >> 2] = $2 | $7;
        $4 = $4 + -1 | 0;
        $2 = $8 + -8 | 0;
        if ($2 >>> 0 < 4294967288) {
         $4 = $4 + 1 | 0;
        }
        $3 = $0;
        HEAP32[$3 + 8 >> 2] = $2;
        HEAP32[$3 + 12 >> 2] = $4;
        HEAP32[$3 >> 2] = $5 + 8;
        HEAP32[$1 + 8 >> 2] = $9 - -64;
        return 1;
       case 0:
       case 1:
        break label$5;
       case 2:
        break label$6;
       default:
        break label$3;
       }
      }
      $8 = HEAP32[$0 + 8 >> 2];
      $4 = HEAP32[$0 + 12 >> 2];
      if (($4 | 0) < 0 ? 1 : ($4 | 0) <= 0 ? $8 >>> 0 >= 6 ? 0 : 1 : 0) {
       break label$4;
      }
      $5 = HEAP32[$0 >> 2];
      $6 = HEAPU8[$5 + 1 | 0] << 8 | HEAP32[$1 >> 2] << 16 | HEAPU8[$5 | 0];
      $2 = HEAPU8[$5 + 3 | 0];
      $3 = $2 >>> 8;
      $2 = $2 << 24;
      $7 = $3 | $6;
      $6 = $2;
      $2 = HEAPU8[$5 + 2 | 0];
      $3 = $2 >>> 16;
      $2 = $6 | $2 << 16;
      $7 = $3 | $7;
      $6 = $2;
      $2 = HEAPU8[$5 + 5 | 0];
      $3 = $2 >>> 24;
      HEAP32[$1 >> 2] = HEAPU8[$5 + 4 | 0] | ($6 | $2 << 8);
      HEAP32[$1 + 4 >> 2] = $3 | $7;
      $2 = $4 + -1 | 0;
      $4 = $8 + -6 | 0;
      if ($4 >>> 0 < 4294967290) {
       $2 = $2 + 1 | 0;
      }
      $3 = $0;
      HEAP32[$3 + 8 >> 2] = $4;
      HEAP32[$3 + 12 >> 2] = $2;
      HEAP32[$3 >> 2] = $5 + 6;
      HEAP32[$1 + 8 >> 2] = $9 + 48;
      return 1;
     }
     $8 = HEAP32[$0 + 8 >> 2];
     $4 = HEAP32[$0 + 12 >> 2];
    }
    if (($4 | 0) > 0 ? 1 : ($4 | 0) >= 0 ? $8 >>> 0 <= 1 ? 0 : 1 : 0) {
     break label$2;
    }
    $7 = 0;
    if (($8 | 0) != 1 | $4) {
     break label$3;
    }
    $3 = HEAP32[$0 >> 2];
    HEAP32[$0 >> 2] = $3 + 1;
    HEAP8[$1 + 12 | 0] = HEAPU8[$3 | 0];
    HEAP32[$0 + 8 >> 2] = 0;
    HEAP32[$0 + 12 >> 2] = 0;
    HEAP8[$1 + 13 | 0] = 1;
   }
   return $7;
  }
  $2 = HEAP32[$1 >> 2];
  $3 = HEAP32[$1 + 4 >> 2] << 16 | $2 >>> 16;
  $6 = HEAP32[$0 >> 2];
  $11 = HEAPU8[$6 | 0] | $2 << 16;
  $10 = HEAPU8[$6 + 1 | 0];
  $2 = $10 >>> 24;
  HEAP32[$1 >> 2] = $11 | $10 << 8;
  HEAP32[$1 + 4 >> 2] = $2 | $3;
  $2 = $4 + -1 | 0;
  $4 = $8 + -2 | 0;
  if ($4 >>> 0 < 4294967294) {
   $2 = $2 + 1 | 0;
  }
  $3 = $0;
  HEAP32[$3 + 8 >> 2] = $4;
  HEAP32[$3 + 12 >> 2] = $2;
  HEAP32[$3 >> 2] = $6 + 2;
  $9 = $9 + 16 | 0;
  HEAP32[$1 + 8 >> 2] = $9;
  $5 = $5 + -16 | 0;
  continue;
 }
}
function __cxxabiv1____pointer_type_info__can_catch_28__cxxabiv1____shim_type_info_20const__2c_20void___29_20const($0, $1, $2) {
 $0 = $0 | 0;
 $1 = $1 | 0;
 $2 = $2 | 0;
 var $3 = 0, $4 = 0, $5 = 0, $6 = 0;
 $4 = global$0 + -64 | 0;
 $5 = $4;
 if ($4 >>> 0 < global$2 >>> 0) {
  __handle_stack_overflow();
 }
 global$0 = $5;
 label$2 : {
  label$3 : {
   label$4 : {
    if (is_equal_28std__type_info_20const__2c_20std__type_info_20const__2c_20bool_29($1, 2700, 0)) {
     HEAP32[$2 >> 2] = 0;
     break label$4;
    }
    if (__cxxabiv1____pbase_type_info__can_catch_28__cxxabiv1____shim_type_info_20const__2c_20void___29_20const($0, $1)) {
     $5 = 1;
     $0 = HEAP32[$2 >> 2];
     if (!$0) {
      break label$2;
     }
     HEAP32[$2 >> 2] = HEAP32[$0 >> 2];
     break label$2;
    }
    if (!$1) {
     break label$3;
    }
    $5 = 0;
    $1 = __dynamic_cast($1, 2480);
    if (!$1) {
     break label$2;
    }
    $3 = HEAP32[$2 >> 2];
    if ($3) {
     HEAP32[$2 >> 2] = HEAP32[$3 >> 2];
    }
    $6 = HEAP32[$1 + 8 >> 2];
    $3 = HEAP32[$0 + 8 >> 2];
    if ($6 & ($3 ^ -1) & 7 | ($6 ^ -1) & $3 & 96) {
     break label$2;
    }
    $5 = 1;
    if (is_equal_28std__type_info_20const__2c_20std__type_info_20const__2c_20bool_29(HEAP32[$0 + 12 >> 2], HEAP32[$1 + 12 >> 2], 0)) {
     break label$2;
    }
    if (is_equal_28std__type_info_20const__2c_20std__type_info_20const__2c_20bool_29(HEAP32[$0 + 12 >> 2], 2688, 0)) {
     $0 = HEAP32[$1 + 12 >> 2];
     if (!$0) {
      break label$2;
     }
     $5 = !__dynamic_cast($0, 2532);
     break label$2;
    }
    $3 = HEAP32[$0 + 12 >> 2];
    if (!$3) {
     break label$3;
    }
    $5 = 0;
    $3 = __dynamic_cast($3, 2480);
    if ($3) {
     if (!(HEAP8[$0 + 8 | 0] & 1)) {
      break label$2;
     }
     $5 = __cxxabiv1____pointer_type_info__can_catch_nested_28__cxxabiv1____shim_type_info_20const__29_20const($3, HEAP32[$1 + 12 >> 2]);
     break label$2;
    }
    $3 = HEAP32[$0 + 12 >> 2];
    if (!$3) {
     break label$2;
    }
    $3 = __dynamic_cast($3, 2592);
    if ($3) {
     if (!(HEAP8[$0 + 8 | 0] & 1)) {
      break label$2;
     }
     $5 = __cxxabiv1____pointer_to_member_type_info__can_catch_nested_28__cxxabiv1____shim_type_info_20const__29_20const($3, HEAP32[$1 + 12 >> 2]);
     break label$2;
    }
    $0 = HEAP32[$0 + 12 >> 2];
    if (!$0) {
     break label$2;
    }
    $3 = __dynamic_cast($0, 2384);
    if (!$3) {
     break label$2;
    }
    $0 = HEAP32[$1 + 12 >> 2];
    if (!$0) {
     break label$2;
    }
    $0 = __dynamic_cast($0, 2384);
    if (!$0) {
     break label$2;
    }
    HEAP32[$4 + 20 >> 2] = -1;
    HEAP32[$4 + 16 >> 2] = $3;
    HEAP32[$4 + 12 >> 2] = 0;
    HEAP32[$4 + 8 >> 2] = $0;
    memset($4 + 24 | 0, 39);
    HEAP32[$4 + 56 >> 2] = 1;
    FUNCTION_TABLE[HEAP32[HEAP32[$0 >> 2] + 28 >> 2]]($0, $4 + 8 | 0, HEAP32[$2 >> 2], 1);
    if (HEAP32[$4 + 32 >> 2] != 1) {
     break label$2;
    }
    if (!HEAP32[$2 >> 2]) {
     break label$4;
    }
    HEAP32[$2 >> 2] = HEAP32[$4 + 24 >> 2];
   }
   $5 = 1;
   break label$2;
  }
  $5 = 0;
 }
 $0 = $4 - -64 | 0;
 if ($0 >>> 0 < global$2 >>> 0) {
  __handle_stack_overflow();
 }
 global$0 = $0;
 return $5 | 0;
}
function __embind_register_native_and_builtin_types() {
 _embind_register_void(2688, 3116);
 _embind_register_bool(2712, 3121, 1, 1, 0);
 void_20_28anonymous_20namespace_29__register_integer_char__28char_20const__29();
 void_20_28anonymous_20namespace_29__register_integer_signed_20char__28char_20const__29();
 void_20_28anonymous_20namespace_29__register_integer_unsigned_20char__28char_20const__29();
 void_20_28anonymous_20namespace_29__register_integer_short__28char_20const__29();
 void_20_28anonymous_20namespace_29__register_integer_unsigned_20short__28char_20const__29();
 void_20_28anonymous_20namespace_29__register_integer_int__28char_20const__29();
 void_20_28anonymous_20namespace_29__register_integer_unsigned_20int__28char_20const__29();
 void_20_28anonymous_20namespace_29__register_integer_long__28char_20const__29();
 void_20_28anonymous_20namespace_29__register_integer_unsigned_20long__28char_20const__29();
 void_20_28anonymous_20namespace_29__register_float_float__28char_20const__29();
 void_20_28anonymous_20namespace_29__register_float_double__28char_20const__29();
 _embind_register_std_string(2100, 3227);
 _embind_register_std_string(3940, 3239);
 _embind_register_std_wstring(4028, 4, 3272);
 _embind_register_emval(1812, 3285);
 void_20_28anonymous_20namespace_29__register_memory_view_char__28char_20const__29();
 void_20_28anonymous_20namespace_29__register_memory_view_signed_20char__28char_20const__29(3331);
 void_20_28anonymous_20namespace_29__register_memory_view_unsigned_20char__28char_20const__29(3368);
 void_20_28anonymous_20namespace_29__register_memory_view_short__28char_20const__29(3407);
 void_20_28anonymous_20namespace_29__register_memory_view_unsigned_20short__28char_20const__29(3438);
 void_20_28anonymous_20namespace_29__register_memory_view_int__28char_20const__29(3478);
 void_20_28anonymous_20namespace_29__register_memory_view_unsigned_20int__28char_20const__29(3507);
 void_20_28anonymous_20namespace_29__register_memory_view_long__28char_20const__29();
 void_20_28anonymous_20namespace_29__register_memory_view_unsigned_20long__28char_20const__29();
 void_20_28anonymous_20namespace_29__register_memory_view_signed_20char__28char_20const__29(3614);
 void_20_28anonymous_20namespace_29__register_memory_view_unsigned_20char__28char_20const__29(3646);
 void_20_28anonymous_20namespace_29__register_memory_view_short__28char_20const__29(3679);
 void_20_28anonymous_20namespace_29__register_memory_view_unsigned_20short__28char_20const__29(3712);
 void_20_28anonymous_20namespace_29__register_memory_view_int__28char_20const__29(3746);
 void_20_28anonymous_20namespace_29__register_memory_view_unsigned_20int__28char_20const__29(3779);
 void_20_28anonymous_20namespace_29__register_memory_view_float__28char_20const__29();
 void_20_28anonymous_20namespace_29__register_memory_view_double__28char_20const__29();
}
function memcpy($0, $1, $2) {
 var $3 = 0, $4 = 0, $5 = 0;
 if ($2 >>> 0 >= 8192) {
  emscripten_memcpy_big($0 | 0, $1 | 0, $2 | 0) | 0;
  return $0;
 }
 $4 = $0 + $2 | 0;
 label$2 : {
  if (!(($0 ^ $1) & 3)) {
   label$4 : {
    if (($2 | 0) < 1) {
     $2 = $0;
     break label$4;
    }
    if (!($0 & 3)) {
     $2 = $0;
     break label$4;
    }
    $2 = $0;
    while (1) {
     HEAP8[$2 | 0] = HEAPU8[$1 | 0];
     $1 = $1 + 1 | 0;
     $2 = $2 + 1 | 0;
     if ($2 >>> 0 >= $4 >>> 0) {
      break label$4;
     }
     if ($2 & 3) {
      continue;
     }
     break;
    }
   }
   $3 = $4 & -4;
   label$8 : {
    if ($3 >>> 0 < 64) {
     break label$8;
    }
    $5 = $3 + -64 | 0;
    if ($2 >>> 0 > $5 >>> 0) {
     break label$8;
    }
    while (1) {
     HEAP32[$2 >> 2] = HEAP32[$1 >> 2];
     HEAP32[$2 + 4 >> 2] = HEAP32[$1 + 4 >> 2];
     HEAP32[$2 + 8 >> 2] = HEAP32[$1 + 8 >> 2];
     HEAP32[$2 + 12 >> 2] = HEAP32[$1 + 12 >> 2];
     HEAP32[$2 + 16 >> 2] = HEAP32[$1 + 16 >> 2];
     HEAP32[$2 + 20 >> 2] = HEAP32[$1 + 20 >> 2];
     HEAP32[$2 + 24 >> 2] = HEAP32[$1 + 24 >> 2];
     HEAP32[$2 + 28 >> 2] = HEAP32[$1 + 28 >> 2];
     HEAP32[$2 + 32 >> 2] = HEAP32[$1 + 32 >> 2];
     HEAP32[$2 + 36 >> 2] = HEAP32[$1 + 36 >> 2];
     HEAP32[$2 + 40 >> 2] = HEAP32[$1 + 40 >> 2];
     HEAP32[$2 + 44 >> 2] = HEAP32[$1 + 44 >> 2];
     HEAP32[$2 + 48 >> 2] = HEAP32[$1 + 48 >> 2];
     HEAP32[$2 + 52 >> 2] = HEAP32[$1 + 52 >> 2];
     HEAP32[$2 + 56 >> 2] = HEAP32[$1 + 56 >> 2];
     HEAP32[$2 + 60 >> 2] = HEAP32[$1 + 60 >> 2];
     $1 = $1 - -64 | 0;
     $2 = $2 - -64 | 0;
     if ($2 >>> 0 <= $5 >>> 0) {
      continue;
     }
     break;
    }
   }
   if ($2 >>> 0 >= $3 >>> 0) {
    break label$2;
   }
   while (1) {
    HEAP32[$2 >> 2] = HEAP32[$1 >> 2];
    $1 = $1 + 4 | 0;
    $2 = $2 + 4 | 0;
    if ($2 >>> 0 < $3 >>> 0) {
     continue;
    }
    break;
   }
   break label$2;
  }
  if ($4 >>> 0 < 4) {
   $2 = $0;
   break label$2;
  }
  $3 = $4 + -4 | 0;
  if ($3 >>> 0 < $0 >>> 0) {
   $2 = $0;
   break label$2;
  }
  $2 = $0;
  while (1) {
   HEAP8[$2 | 0] = HEAPU8[$1 | 0];
   HEAP8[$2 + 1 | 0] = HEAPU8[$1 + 1 | 0];
   HEAP8[$2 + 2 | 0] = HEAPU8[$1 + 2 | 0];
   HEAP8[$2 + 3 | 0] = HEAPU8[$1 + 3 | 0];
   $1 = $1 + 4 | 0;
   $2 = $2 + 4 | 0;
   if ($2 >>> 0 <= $3 >>> 0) {
    continue;
   }
   break;
  }
 }
 if ($2 >>> 0 < $4 >>> 0) {
  while (1) {
   HEAP8[$2 | 0] = HEAPU8[$1 | 0];
   $1 = $1 + 1 | 0;
   $2 = $2 + 1 | 0;
   if (($4 | 0) != ($2 | 0)) {
    continue;
   }
   break;
  }
 }
 return $0;
}
function EmscriptenBindingInitializer_lzx_decoder_class__EmscriptenBindingInitializer_lzx_decoder_class_28_29() {
 var $0 = 0, $1 = 0;
 _embind_register_class(1888, 1912, 1944, 0, 1700, 15, 1703, 0, 1703, 0, 1243, 1705, 16);
 _embind_register_class_constructor(1888, 1, 1960, 1700, 17, 18);
 $0 = operator_20new_28unsigned_20long_29(8);
 HEAP32[$0 >> 2] = 19;
 HEAP32[$0 + 4 >> 2] = 0;
 _embind_register_class_function(1888, 1254, 2, 1964, 1972, 20, $0 | 0, 0);
 $0 = operator_20new_28unsigned_20long_29(8);
 HEAP32[$0 >> 2] = 21;
 HEAP32[$0 + 4 >> 2] = 0;
 _embind_register_class_function(1888, 1271, 3, 1976, 1820, 22, $0 | 0, 0);
 $0 = operator_20new_28unsigned_20long_29(4);
 HEAP32[$0 >> 2] = 23;
 _embind_register_class_function(1888, 1276, 4, 2128, 1856, 24, $0 | 0, 0);
 $0 = operator_20new_28unsigned_20long_29(4);
 HEAP32[$0 >> 2] = 25;
 _embind_register_class_function(1888, 1283, 3, 2224, 1820, 26, $0 | 0, 0);
 $0 = operator_20new_28unsigned_20long_29(8);
 HEAP32[$0 >> 2] = 27;
 HEAP32[$0 + 4 >> 2] = 0;
 _embind_register_class_function(1888, 1299, 4, 2240, 1760, 28, $0 | 0, 0);
 $0 = operator_20new_28unsigned_20long_29(8);
 HEAP32[$0 >> 2] = 29;
 HEAP32[$0 + 4 >> 2] = 0;
 _embind_register_class_property(1888, 1323, 2832, 1776, 30, $0 | 0, 0, 0, 0, 0);
 _embind_register_value_object(2176, 1332, 2256, 31, 1705, 32);
 $0 = operator_20new_28unsigned_20long_29(4);
 HEAP32[$0 >> 2] = 0;
 $1 = operator_20new_28unsigned_20long_29(4);
 HEAP32[$1 >> 2] = 0;
 _embind_register_value_object_field(2176, 1357, 2784, 1776, 33, $0 | 0, 2784, 1724, 34, $1 | 0);
 $0 = operator_20new_28unsigned_20long_29(4);
 HEAP32[$0 >> 2] = 4;
 $1 = operator_20new_28unsigned_20long_29(4);
 HEAP32[$1 >> 2] = 4;
 _embind_register_value_object_field(2176, 1364, 2784, 1776, 33, $0 | 0, 2784, 1724, 34, $1 | 0);
 $0 = operator_20new_28unsigned_20long_29(4);
 HEAP32[$0 >> 2] = 8;
 $1 = operator_20new_28unsigned_20long_29(4);
 HEAP32[$1 >> 2] = 8;
 _embind_register_value_object_field(2176, 1373, 2784, 1776, 33, $0 | 0, 2784, 1724, 34, $1 | 0);
 _embind_finalize_value_object(2176);
}
function __cxxabiv1____vmi_class_type_info__search_above_dst_28__cxxabiv1____dynamic_cast_info__2c_20void_20const__2c_20void_20const__2c_20int_2c_20bool_29_20const($0, $1, $2, $3, $4, $5) {
 $0 = $0 | 0;
 $1 = $1 | 0;
 $2 = $2 | 0;
 $3 = $3 | 0;
 $4 = $4 | 0;
 $5 = $5 | 0;
 var $6 = 0, $7 = 0, $8 = 0, $9 = 0, $10 = 0, $11 = 0;
 if (is_equal_28std__type_info_20const__2c_20std__type_info_20const__2c_20bool_29($0, HEAP32[$1 + 8 >> 2], $5)) {
  __cxxabiv1____class_type_info__process_static_type_above_dst_28__cxxabiv1____dynamic_cast_info__2c_20void_20const__2c_20void_20const__2c_20int_29_20const($1, $2, $3, $4);
  return;
 }
 $7 = HEAPU8[$1 + 53 | 0];
 $6 = HEAP32[$0 + 12 >> 2];
 HEAP8[$1 + 53 | 0] = 0;
 $8 = HEAPU8[$1 + 52 | 0];
 HEAP8[$1 + 52 | 0] = 0;
 $9 = $0 + 16 | 0;
 __cxxabiv1____base_class_type_info__search_above_dst_28__cxxabiv1____dynamic_cast_info__2c_20void_20const__2c_20void_20const__2c_20int_2c_20bool_29_20const($9, $1, $2, $3, $4, $5);
 $10 = HEAPU8[$1 + 53 | 0];
 $7 = $7 | $10;
 $11 = HEAPU8[$1 + 52 | 0];
 $8 = $8 | $11;
 label$2 : {
  if (($6 | 0) < 2) {
   break label$2;
  }
  $9 = $9 + ($6 << 3) | 0;
  $6 = $0 + 24 | 0;
  while (1) {
   if (HEAPU8[$1 + 54 | 0]) {
    break label$2;
   }
   label$4 : {
    if ($11) {
     if (HEAP32[$1 + 24 >> 2] == 1) {
      break label$2;
     }
     if (HEAPU8[$0 + 8 | 0] & 2) {
      break label$4;
     }
     break label$2;
    }
    if (!$10) {
     break label$4;
    }
    if (!(HEAP8[$0 + 8 | 0] & 1)) {
     break label$2;
    }
   }
   HEAP16[$1 + 52 >> 1] = 0;
   __cxxabiv1____base_class_type_info__search_above_dst_28__cxxabiv1____dynamic_cast_info__2c_20void_20const__2c_20void_20const__2c_20int_2c_20bool_29_20const($6, $1, $2, $3, $4, $5);
   $10 = HEAPU8[$1 + 53 | 0];
   $7 = $10 | $7;
   $11 = HEAPU8[$1 + 52 | 0];
   $8 = $11 | $8;
   $6 = $6 + 8 | 0;
   if ($6 >>> 0 < $9 >>> 0) {
    continue;
   }
   break;
  }
 }
 HEAP8[$1 + 53 | 0] = ($7 & 255) != 0;
 HEAP8[$1 + 52 | 0] = ($8 & 255) != 0;
}
function EmscriptenBindingInitializer_lzx_decoder_class__EmscriptenBindingInitializer_lzx_decoder_class_28_29__$_0____invoke_28LzxDecoder__2c_20emscripten__val_20const__2c_20int_29($0, $1, $2, $3) {
 $0 = $0 | 0;
 $1 = $1 | 0;
 $2 = $2 | 0;
 $3 = $3 | 0;
 var $4 = 0, $5 = 0;
 $4 = global$0 - 32 | 0;
 $5 = $4;
 if ($4 >>> 0 < global$2 >>> 0) {
  __handle_stack_overflow();
 }
 global$0 = $5;
 $5 = HEAP32[$2 >> 2];
 label$2 : {
  if (!($5 >>> 0 > 4 | !(1 << $5 & 22))) {
   HEAP32[$4 + 24 >> 2] = 0;
   HEAP32[$4 + 16 >> 2] = 0;
   HEAP32[$4 + 20 >> 2] = 0;
   LzxDecoder__decode_28std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20__20const__2c_20int_29($4, $1, $4 + 16 | 0, $3);
   HEAP32[$0 + 8 >> 2] = HEAP32[$4 + 8 >> 2];
   $1 = HEAP32[$4 + 4 >> 2];
   HEAP32[$0 >> 2] = HEAP32[$4 >> 2];
   HEAP32[$0 + 4 >> 2] = $1;
   if (HEAP8[$4 + 27 | 0] > -1) {
    break label$2;
   }
   dlfree(HEAP32[$4 + 16 >> 2]);
   break label$2;
  }
  std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20__20emscripten__val__as_std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20__20__28_29_20const($4, $2);
  LzxDecoder__decode_28std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20__20const__2c_20int_29($4 + 16 | 0, $1, $4, $3);
  HEAP32[$0 + 8 >> 2] = HEAP32[$4 + 24 >> 2];
  $1 = HEAP32[$4 + 20 >> 2];
  HEAP32[$0 >> 2] = HEAP32[$4 + 16 >> 2];
  HEAP32[$0 + 4 >> 2] = $1;
  if (HEAP8[$4 + 11 | 0] > -1) {
   break label$2;
  }
  dlfree(HEAP32[$4 >> 2]);
 }
 $0 = $4 + 32 | 0;
 if ($0 >>> 0 < global$2 >>> 0) {
  __handle_stack_overflow();
 }
 global$0 = $0;
}
function __cxxabiv1____si_class_type_info__search_below_dst_28__cxxabiv1____dynamic_cast_info__2c_20void_20const__2c_20int_2c_20bool_29_20const($0, $1, $2, $3, $4) {
 $0 = $0 | 0;
 $1 = $1 | 0;
 $2 = $2 | 0;
 $3 = $3 | 0;
 $4 = $4 | 0;
 if (is_equal_28std__type_info_20const__2c_20std__type_info_20const__2c_20bool_29($0, HEAP32[$1 + 8 >> 2], $4)) {
  if (!(HEAP32[$1 + 28 >> 2] == 1 | HEAP32[$1 + 4 >> 2] != ($2 | 0))) {
   HEAP32[$1 + 28 >> 2] = $3;
  }
  return;
 }
 label$3 : {
  if (is_equal_28std__type_info_20const__2c_20std__type_info_20const__2c_20bool_29($0, HEAP32[$1 >> 2], $4)) {
   if (!(HEAP32[$1 + 20 >> 2] != ($2 | 0) ? HEAP32[$1 + 16 >> 2] != ($2 | 0) : 0)) {
    if (($3 | 0) != 1) {
     break label$3;
    }
    HEAP32[$1 + 32 >> 2] = 1;
    return;
   }
   HEAP32[$1 + 32 >> 2] = $3;
   label$7 : {
    if (HEAP32[$1 + 44 >> 2] == 4) {
     break label$7;
    }
    HEAP16[$1 + 52 >> 1] = 0;
    $0 = HEAP32[$0 + 8 >> 2];
    FUNCTION_TABLE[HEAP32[HEAP32[$0 >> 2] + 20 >> 2]]($0, $1, $2, $2, 1, $4);
    if (HEAPU8[$1 + 53 | 0]) {
     HEAP32[$1 + 44 >> 2] = 3;
     if (!HEAPU8[$1 + 52 | 0]) {
      break label$7;
     }
     break label$3;
    }
    HEAP32[$1 + 44 >> 2] = 4;
   }
   HEAP32[$1 + 20 >> 2] = $2;
   HEAP32[$1 + 40 >> 2] = HEAP32[$1 + 40 >> 2] + 1;
   if (HEAP32[$1 + 36 >> 2] != 1 | HEAP32[$1 + 24 >> 2] != 2) {
    break label$3;
   }
   HEAP8[$1 + 54 | 0] = 1;
   return;
  }
  $0 = HEAP32[$0 + 8 >> 2];
  FUNCTION_TABLE[HEAP32[HEAP32[$0 >> 2] + 24 >> 2]]($0, $1, $2, $3, $4);
 }
}
function std____2__vector_unsigned_20char_2c_20std____2__allocator_unsigned_20char__20_____append_28unsigned_20long_2c_20unsigned_20char_20const__29($0, $1, $2) {
 var $3 = 0, $4 = 0, $5 = 0, $6 = 0;
 label$1 : {
  $5 = HEAP32[$0 + 8 >> 2];
  $3 = HEAP32[$0 + 4 >> 2];
  label$2 : {
   if ($5 - $3 >>> 0 >= $1 >>> 0) {
    while (1) {
     HEAP8[$3 | 0] = HEAPU8[$2 | 0];
     $3 = HEAP32[$0 + 4 >> 2] + 1 | 0;
     HEAP32[$0 + 4 >> 2] = $3;
     $1 = $1 + -1 | 0;
     if ($1) {
      continue;
     }
     break label$2;
    }
   }
   $4 = $3;
   $3 = HEAP32[$0 >> 2];
   $6 = $4 - $3 | 0;
   $4 = $6 + $1 | 0;
   if (($4 | 0) <= -1) {
    break label$1;
   }
   $5 = $5 - $3 | 0;
   $3 = $5 << 1;
   $4 = $5 >>> 0 < 1073741823 ? $3 >>> 0 < $4 >>> 0 ? $4 : $3 : 2147483647;
   $3 = 0;
   label$5 : {
    if (!$4) {
     break label$5;
    }
    $3 = operator_20new_28unsigned_20long_29($4);
   }
   $5 = $3 + $4 | 0;
   $4 = $3 + $6 | 0;
   $3 = $4;
   while (1) {
    HEAP8[$3 | 0] = HEAPU8[$2 | 0];
    $3 = $3 + 1 | 0;
    $1 = $1 + -1 | 0;
    if ($1) {
     continue;
    }
    break;
   }
   $1 = HEAP32[$0 >> 2];
   $2 = HEAP32[$0 + 4 >> 2] - $1 | 0;
   $4 = $4 - $2 | 0;
   if (($2 | 0) >= 1) {
    memcpy($4, $1, $2);
   }
   HEAP32[$0 >> 2] = $4;
   HEAP32[$0 + 8 >> 2] = $5;
   HEAP32[$0 + 4 >> 2] = $3;
   if (!$1) {
    break label$2;
   }
   dlfree($1);
  }
  return;
 }
 std____2____vector_base_common_true_____throw_length_error_28_29_20const();
 abort();
}
function memset($0, $1) {
 var $2 = 0;
 label$1 : {
  if (!$1) {
   break label$1;
  }
  $2 = $0 + $1 | 0;
  HEAP8[$2 + -1 | 0] = 0;
  HEAP8[$0 | 0] = 0;
  if ($1 >>> 0 < 3) {
   break label$1;
  }
  HEAP8[$2 + -2 | 0] = 0;
  HEAP8[$0 + 1 | 0] = 0;
  HEAP8[$2 + -3 | 0] = 0;
  HEAP8[$0 + 2 | 0] = 0;
  if ($1 >>> 0 < 7) {
   break label$1;
  }
  HEAP8[$2 + -4 | 0] = 0;
  HEAP8[$0 + 3 | 0] = 0;
  if ($1 >>> 0 < 9) {
   break label$1;
  }
  $2 = 0 - $0 & 3;
  $0 = $2 + $0 | 0;
  HEAP32[$0 >> 2] = 0;
  $2 = $1 - $2 & -4;
  $1 = $2 + $0 | 0;
  HEAP32[$1 + -4 >> 2] = 0;
  if ($2 >>> 0 < 9) {
   break label$1;
  }
  HEAP32[$0 + 8 >> 2] = 0;
  HEAP32[$0 + 4 >> 2] = 0;
  HEAP32[$1 + -8 >> 2] = 0;
  HEAP32[$1 + -12 >> 2] = 0;
  if ($2 >>> 0 < 25) {
   break label$1;
  }
  HEAP32[$0 + 24 >> 2] = 0;
  HEAP32[$0 + 20 >> 2] = 0;
  HEAP32[$0 + 16 >> 2] = 0;
  HEAP32[$0 + 12 >> 2] = 0;
  HEAP32[$1 + -16 >> 2] = 0;
  HEAP32[$1 + -20 >> 2] = 0;
  HEAP32[$1 + -24 >> 2] = 0;
  HEAP32[$1 + -28 >> 2] = 0;
  $1 = $2;
  $2 = $0 & 4 | 24;
  $1 = $1 - $2 | 0;
  if ($1 >>> 0 < 32) {
   break label$1;
  }
  $0 = $0 + $2 | 0;
  while (1) {
   HEAP32[$0 + 24 >> 2] = 0;
   HEAP32[$0 + 28 >> 2] = 0;
   HEAP32[$0 + 16 >> 2] = 0;
   HEAP32[$0 + 20 >> 2] = 0;
   HEAP32[$0 + 8 >> 2] = 0;
   HEAP32[$0 + 12 >> 2] = 0;
   HEAP32[$0 >> 2] = 0;
   HEAP32[$0 + 4 >> 2] = 0;
   $0 = $0 + 32 | 0;
   $1 = $1 + -32 | 0;
   if ($1 >>> 0 > 31) {
    continue;
   }
   break;
  }
 }
}
function std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20__20emscripten__val__as_std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20__20__28_29_20const($0, $1) {
 var $2 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0;
 $3 = global$0 - 16 | 0;
 $4 = $3;
 if ($3 >>> 0 < global$2 >>> 0) {
  __handle_stack_overflow();
 }
 global$0 = $4;
 $5 = +_emval_as(HEAP32[$1 >> 2], 2100, $3 + 12 | 0);
 label$2 : {
  if ($5 < 4294967296 & $5 >= 0) {
   $1 = ~~$5 >>> 0;
   break label$2;
  }
  $1 = 0;
 }
 $2 = HEAP32[$1 >> 2];
 $7 = HEAP32[$3 + 12 >> 2];
 HEAP32[$0 + 8 >> 2] = 0;
 HEAP32[$0 >> 2] = 0;
 HEAP32[$0 + 4 >> 2] = 0;
 if ($2 >>> 0 < 4294967280) {
  label$5 : {
   label$6 : {
    if ($2 >>> 0 >= 11) {
     $6 = $2 + 16 & -16;
     $4 = operator_20new_28unsigned_20long_29($6);
     HEAP32[$0 + 8 >> 2] = $6 | -2147483648;
     HEAP32[$0 >> 2] = $4;
     HEAP32[$0 + 4 >> 2] = $2;
     $0 = $4;
     break label$6;
    }
    HEAP8[$0 + 11 | 0] = $2;
    if (!$2) {
     break label$5;
    }
   }
   memcpy($0, $1 + 4 | 0, $2);
  }
  HEAP8[$0 + $2 | 0] = 0;
  _emval_run_destructors($7 | 0);
  $0 = $3 + 16 | 0;
  if ($0 >>> 0 < global$2 >>> 0) {
   __handle_stack_overflow();
  }
  global$0 = $0;
  return;
 }
 std____2____throw_length_error_28char_20const__29();
 abort();
}
function __dynamic_cast($0, $1) {
 var $2 = 0, $3 = 0, $4 = 0, $5 = 0;
 $2 = global$0 + -64 | 0;
 $3 = $2;
 if ($2 >>> 0 < global$2 >>> 0) {
  __handle_stack_overflow();
 }
 global$0 = $3;
 $3 = HEAP32[$0 >> 2];
 $5 = HEAP32[$3 + -8 >> 2];
 $3 = HEAP32[$3 + -4 >> 2];
 HEAP32[$2 + 20 >> 2] = 0;
 HEAP32[$2 + 16 >> 2] = 2336;
 HEAP32[$2 + 12 >> 2] = $0;
 HEAP32[$2 + 8 >> 2] = $1;
 memset($2 + 24 | 0, 39);
 $0 = $0 + $5 | 0;
 label$2 : {
  if (is_equal_28std__type_info_20const__2c_20std__type_info_20const__2c_20bool_29($3, $1, 0)) {
   HEAP32[$2 + 56 >> 2] = 1;
   FUNCTION_TABLE[HEAP32[HEAP32[$3 >> 2] + 20 >> 2]]($3, $2 + 8 | 0, $0, $0, 1, 0);
   $4 = HEAP32[$2 + 32 >> 2] == 1 ? $0 : 0;
   break label$2;
  }
  FUNCTION_TABLE[HEAP32[HEAP32[$3 >> 2] + 24 >> 2]]($3, $2 + 8 | 0, $0, 1, 0);
  $0 = HEAP32[$2 + 44 >> 2];
  if ($0 >>> 0 > 1) {
   break label$2;
  }
  if ($0 - 1) {
   $4 = HEAP32[$2 + 48 >> 2] == 1 ? HEAP32[$2 + 36 >> 2] == 1 ? HEAP32[$2 + 40 >> 2] == 1 ? HEAP32[$2 + 28 >> 2] : 0 : 0 : 0;
   break label$2;
  }
  if (HEAP32[$2 + 32 >> 2] != 1) {
   if (HEAP32[$2 + 48 >> 2] | HEAP32[$2 + 36 >> 2] != 1 | HEAP32[$2 + 40 >> 2] != 1) {
    break label$2;
   }
  }
  $4 = HEAP32[$2 + 24 >> 2];
 }
 $0 = $2 - -64 | 0;
 if ($0 >>> 0 < global$2 >>> 0) {
  __handle_stack_overflow();
 }
 global$0 = $0;
 return $4;
}
function std____2__vector_unsigned_20char_2c_20std____2__allocator_unsigned_20char__20_____append_28unsigned_20long_29($0, $1) {
 var $2 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0;
 label$1 : {
  $3 = HEAP32[$0 + 8 >> 2];
  $2 = HEAP32[$0 + 4 >> 2];
  label$2 : {
   if ($3 - $2 >>> 0 >= $1 >>> 0) {
    while (1) {
     HEAP8[$2 | 0] = 0;
     $2 = HEAP32[$0 + 4 >> 2] + 1 | 0;
     HEAP32[$0 + 4 >> 2] = $2;
     $1 = $1 + -1 | 0;
     if ($1) {
      continue;
     }
     break label$2;
    }
   }
   $4 = HEAP32[$0 >> 2];
   $5 = $2 - $4 | 0;
   $2 = $5 + $1 | 0;
   if (($2 | 0) <= -1) {
    break label$1;
   }
   $3 = $3 - $4 | 0;
   $7 = $3 << 1;
   $3 = $3 >>> 0 < 1073741823 ? $7 >>> 0 < $2 >>> 0 ? $2 : $7 : 2147483647;
   if ($3) {
    $6 = operator_20new_28unsigned_20long_29($3);
   }
   $2 = $6 + $5 | 0;
   memset($2, $1);
   while (1) {
    $2 = $2 + 1 | 0;
    $1 = $1 + -1 | 0;
    if ($1) {
     continue;
    }
    break;
   }
   if (($5 | 0) >= 1) {
    memcpy($6, $4, $5);
   }
   HEAP32[$0 >> 2] = $6;
   HEAP32[$0 + 8 >> 2] = $3 + $6;
   HEAP32[$0 + 4 >> 2] = $2;
   if (!$4) {
    break label$2;
   }
   dlfree($4);
  }
  return;
 }
 std____2____vector_base_common_true_____throw_length_error_28_29_20const();
 abort();
}
function memchr($0, $1) {
 var $2 = 0, $3 = 0, $4 = 0;
 $2 = ($1 | 0) != 0;
 label$1 : {
  label$2 : {
   label$3 : {
    label$4 : {
     if (!$1 | !($0 & 3)) {
      break label$4;
     }
     while (1) {
      if (HEAPU8[$0 | 0] == 232) {
       break label$3;
      }
      $0 = $0 + 1 | 0;
      $1 = $1 + -1 | 0;
      $2 = ($1 | 0) != 0;
      if (!$1) {
       break label$4;
      }
      if ($0 & 3) {
       continue;
      }
      break;
     }
    }
    if (!$2) {
     break label$2;
    }
   }
   if (HEAPU8[$0 | 0] == 232) {
    break label$1;
   }
   label$6 : {
    if ($1 >>> 0 >= 4) {
     $2 = $1 + -4 | 0;
     $3 = $2 & -4;
     $2 = $2 - $3 | 0;
     $3 = ($0 + $3 | 0) + 4 | 0;
     while (1) {
      $4 = HEAP32[$0 >> 2] ^ -387389208;
      if (($4 ^ -1) & $4 + -16843009 & -2139062144) {
       break label$6;
      }
      $0 = $0 + 4 | 0;
      $1 = $1 + -4 | 0;
      if ($1 >>> 0 > 3) {
       continue;
      }
      break;
     }
     $1 = $2;
     $0 = $3;
    }
    if (!$1) {
     break label$2;
    }
   }
   while (1) {
    if (HEAPU8[$0 | 0] == 232) {
     break label$1;
    }
    $0 = $0 + 1 | 0;
    $1 = $1 + -1 | 0;
    if ($1) {
     continue;
    }
    break;
   }
  }
  return 0;
 }
 return $0;
}
function emscripten__class__std____2__vector_unsigned_20char_2c_20std____2__allocator_unsigned_20char__20__2c_20emscripten__internal__NoBaseClass__20emscripten__register_vector_unsigned_20char__28char_20const__29() {
 var $0 = 0;
 _embind_register_class(1564, 1628, 1684, 0, 1700, 1, 1703, 0, 1703, 0, 1216, 1705, 2);
 _embind_register_class_constructor(1564, 1, 1708, 1700, 3, 4);
 $0 = operator_20new_28unsigned_20long_29(8);
 HEAP32[$0 >> 2] = 5;
 HEAP32[$0 + 4 >> 2] = 0;
 _embind_register_class_function(1564, 1383, 3, 1712, 1724, 6, $0 | 0, 0);
 $0 = operator_20new_28unsigned_20long_29(8);
 HEAP32[$0 >> 2] = 7;
 HEAP32[$0 + 4 >> 2] = 0;
 _embind_register_class_function(1564, 1393, 4, 1744, 1760, 8, $0 | 0, 0);
 $0 = operator_20new_28unsigned_20long_29(8);
 HEAP32[$0 >> 2] = 9;
 HEAP32[$0 + 4 >> 2] = 0;
 _embind_register_class_function(1564, 1400, 2, 1768, 1776, 10, $0 | 0, 0);
 $0 = operator_20new_28unsigned_20long_29(4);
 HEAP32[$0 >> 2] = 11;
 _embind_register_class_function(1564, 1405, 3, 1780, 1820, 12, $0 | 0, 0);
 $0 = operator_20new_28unsigned_20long_29(4);
 HEAP32[$0 >> 2] = 13;
 _embind_register_class_function(1564, 1409, 4, 1840, 1856, 14, $0 | 0, 0);
}
function emscripten__internal__MethodInvoker_void_20_28std____2__vector_unsigned_20char_2c_20std____2__allocator_unsigned_20char__20_____29_28unsigned_20long_2c_20unsigned_20char_20const__29_2c_20void_2c_20std____2__vector_unsigned_20char_2c_20std____2__allocator_unsigned_20char__20___2c_20unsigned_20long_2c_20unsigned_20char_20const____invoke_28void_20_28std____2__vector_unsigned_20char_2c_20std____2__allocator_unsigned_20char__20_____20const__29_28unsigned_20long_2c_20unsigned_20char_20const__29_2c_20std____2__vector_unsigned_20char_2c_20std____2__allocator_unsigned_20char__20___2c_20unsigned_20long_2c_20unsigned_20char_29($0, $1, $2, $3) {
 $0 = $0 | 0;
 $1 = $1 | 0;
 $2 = $2 | 0;
 $3 = $3 | 0;
 var $4 = 0, $5 = 0;
 $4 = global$0 - 16 | 0;
 $5 = $4;
 if ($4 >>> 0 < global$2 >>> 0) {
  __handle_stack_overflow();
 }
 global$0 = $5;
 $5 = HEAP32[$0 + 4 >> 2];
 $1 = ($5 >> 1) + $1 | 0;
 $0 = HEAP32[$0 >> 2];
 $0 = $5 & 1 ? HEAP32[HEAP32[$1 >> 2] + $0 >> 2] : $0;
 HEAP8[$4 + 15 | 0] = $3;
 FUNCTION_TABLE[$0]($1, $2, $4 + 15 | 0);
 $0 = $4 + 16 | 0;
 if ($0 >>> 0 < global$2 >>> 0) {
  __handle_stack_overflow();
 }
 global$0 = $0;
}
function LzxDecoder__outputBufferTranslation_28unsigned_20int_2c_20unsigned_20int_29($0, $1, $2) {
 $0 = $0 | 0;
 $1 = $1 | 0;
 $2 = $2 | 0;
 var $3 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0;
 label$1 : {
  if ($1 >>> 0 < 11) {
   break label$1;
  }
  $5 = HEAP32[$0 + 48 >> 2];
  if (!HEAPU8[$5 + 32 | 0]) {
   break label$1;
  }
  $0 = HEAP32[$0 + 56 >> 2];
  $4 = ($0 + $1 | 0) + -10 | 0;
  if ($4 >>> 0 <= $0 >>> 0) {
   break label$1;
  }
  $1 = $0;
  while (1) {
   $1 = memchr($1, $4 - $1 | 0);
   if (!$1) {
    break label$1;
   }
   $3 = HEAPU8[$1 + 1 | 0] | HEAPU8[$1 + 2 | 0] << 8 | (HEAPU8[$1 + 3 | 0] << 16 | HEAPU8[$1 + 4 | 0] << 24);
   $6 = 0 - (($1 - $0 | 0) + $2 | 0) | 0;
   label$3 : {
    if (($3 | 0) < ($6 | 0)) {
     break label$3;
    }
    $7 = HEAP32[$5 + 28 >> 2];
    if (($3 | 0) >= ($7 | 0)) {
     break label$3;
    }
    $3 = (($3 | 0) > -1 ? $6 : $7) + $3 | 0;
    HEAP8[$1 + 1 | 0] = $3;
    HEAP8[$1 + 2 | 0] = $3 >>> 8;
    HEAP8[$1 + 3 | 0] = $3 >>> 16;
    HEAP8[$1 + 4 | 0] = $3 >>> 24;
   }
   $1 = $1 + 5 | 0;
   if ($1 >>> 0 < $4 >>> 0) {
    continue;
   }
   break;
  }
 }
}
function __cxxabiv1____vmi_class_type_info__has_unambiguous_public_base_28__cxxabiv1____dynamic_cast_info__2c_20void__2c_20int_29_20const($0, $1, $2, $3) {
 $0 = $0 | 0;
 $1 = $1 | 0;
 $2 = $2 | 0;
 $3 = $3 | 0;
 var $4 = 0, $5 = 0;
 if (is_equal_28std__type_info_20const__2c_20std__type_info_20const__2c_20bool_29($0, HEAP32[$1 + 8 >> 2], 0)) {
  __cxxabiv1____class_type_info__process_found_base_class_28__cxxabiv1____dynamic_cast_info__2c_20void__2c_20int_29_20const($1, $2, $3);
  return;
 }
 $4 = HEAP32[$0 + 12 >> 2];
 $5 = $0 + 16 | 0;
 __cxxabiv1____base_class_type_info__has_unambiguous_public_base_28__cxxabiv1____dynamic_cast_info__2c_20void__2c_20int_29_20const($5, $1, $2, $3);
 label$2 : {
  if (($4 | 0) < 2) {
   break label$2;
  }
  $4 = ($4 << 3) + $5 | 0;
  $0 = $0 + 24 | 0;
  while (1) {
   __cxxabiv1____base_class_type_info__has_unambiguous_public_base_28__cxxabiv1____dynamic_cast_info__2c_20void__2c_20int_29_20const($0, $1, $2, $3);
   if (HEAPU8[$1 + 54 | 0]) {
    break label$2;
   }
   $0 = $0 + 8 | 0;
   if ($0 >>> 0 < $4 >>> 0) {
    continue;
   }
   break;
  }
 }
}
function emscripten__internal__FunctionInvoker_bool_20_28__29_28std____2__vector_unsigned_20char_2c_20std____2__allocator_unsigned_20char__20___2c_20unsigned_20long_2c_20unsigned_20char_20const__29_2c_20bool_2c_20std____2__vector_unsigned_20char_2c_20std____2__allocator_unsigned_20char__20___2c_20unsigned_20long_2c_20unsigned_20char_20const____invoke_28bool_20_28___29_28std____2__vector_unsigned_20char_2c_20std____2__allocator_unsigned_20char__20___2c_20unsigned_20long_2c_20unsigned_20char_20const__29_2c_20std____2__vector_unsigned_20char_2c_20std____2__allocator_unsigned_20char__20___2c_20unsigned_20long_2c_20unsigned_20char_29($0, $1, $2, $3) {
 $0 = $0 | 0;
 $1 = $1 | 0;
 $2 = $2 | 0;
 $3 = $3 | 0;
 var $4 = 0, $5 = 0;
 $4 = global$0 - 16 | 0;
 $5 = $4;
 if ($4 >>> 0 < global$2 >>> 0) {
  __handle_stack_overflow();
 }
 global$0 = $5;
 $0 = HEAP32[$0 >> 2];
 HEAP8[$4 + 15 | 0] = $3;
 $0 = FUNCTION_TABLE[$0]($1, $2, $4 + 15 | 0) | 0;
 $1 = $4 + 16 | 0;
 if ($1 >>> 0 < global$2 >>> 0) {
  __handle_stack_overflow();
 }
 global$0 = $1;
 return $0 | 0;
}
function emscripten__internal__FunctionInvoker_LzxDecoder__DecodeOutput_20_28__29_28LzxDecoder__2c_20emscripten__val_20const__2c_20int_29_2c_20LzxDecoder__DecodeOutput_2c_20LzxDecoder__2c_20emscripten__val_20const__2c_20int___invoke_28LzxDecoder__DecodeOutput_20_28___29_28LzxDecoder__2c_20emscripten__val_20const__2c_20int_29_2c_20LzxDecoder__2c_20emscripten__internal___EM_VAL__2c_20int_29($0, $1, $2, $3) {
 $0 = $0 | 0;
 $1 = $1 | 0;
 $2 = $2 | 0;
 $3 = $3 | 0;
 var $4 = 0, $5 = 0;
 $4 = global$0 - 32 | 0;
 $5 = $4;
 if ($4 >>> 0 < global$2 >>> 0) {
  __handle_stack_overflow();
 }
 global$0 = $5;
 $0 = HEAP32[$0 >> 2];
 HEAP32[$4 + 8 >> 2] = $2;
 FUNCTION_TABLE[$0]($4 + 16 | 0, $1, $4 + 8 | 0, $3);
 $0 = operator_20new_28unsigned_20long_29(12);
 HEAP32[$0 + 8 >> 2] = HEAP32[$4 + 24 >> 2];
 $1 = HEAP32[$4 + 20 >> 2];
 HEAP32[$0 >> 2] = HEAP32[$4 + 16 >> 2];
 HEAP32[$0 + 4 >> 2] = $1;
 _emval_decref(HEAP32[$4 + 8 >> 2]);
 $1 = $4 + 32 | 0;
 if ($1 >>> 0 < global$2 >>> 0) {
  __handle_stack_overflow();
 }
 global$0 = $1;
 return $0 | 0;
}
function __cxxabiv1____class_type_info__can_catch_28__cxxabiv1____shim_type_info_20const__2c_20void___29_20const($0, $1, $2) {
 $0 = $0 | 0;
 $1 = $1 | 0;
 $2 = $2 | 0;
 var $3 = 0, $4 = 0;
 $3 = global$0 + -64 | 0;
 $4 = $3;
 if ($3 >>> 0 < global$2 >>> 0) {
  __handle_stack_overflow();
 }
 global$0 = $4;
 $4 = 1;
 label$2 : {
  if (is_equal_28std__type_info_20const__2c_20std__type_info_20const__2c_20bool_29($0, $1, 0)) {
   break label$2;
  }
  $4 = 0;
  if (!$1) {
   break label$2;
  }
  $1 = __dynamic_cast($1, 2384);
  if (!$1) {
   break label$2;
  }
  HEAP32[$3 + 20 >> 2] = -1;
  HEAP32[$3 + 16 >> 2] = $0;
  HEAP32[$3 + 12 >> 2] = 0;
  HEAP32[$3 + 8 >> 2] = $1;
  memset($3 + 24 | 0, 39);
  HEAP32[$3 + 56 >> 2] = 1;
  FUNCTION_TABLE[HEAP32[HEAP32[$1 >> 2] + 28 >> 2]]($1, $3 + 8 | 0, HEAP32[$2 >> 2], 1);
  if (HEAP32[$3 + 32 >> 2] != 1) {
   break label$2;
  }
  HEAP32[$2 >> 2] = HEAP32[$3 + 24 >> 2];
  $4 = 1;
 }
 $0 = $3 - -64 | 0;
 if ($0 >>> 0 < global$2 >>> 0) {
  __handle_stack_overflow();
 }
 global$0 = $0;
 return $4 | 0;
}
function emscripten__internal__MethodInvoker_void_20_28std____2__vector_unsigned_20char_2c_20std____2__allocator_unsigned_20char__20_____29_28unsigned_20char_20const__29_2c_20void_2c_20std____2__vector_unsigned_20char_2c_20std____2__allocator_unsigned_20char__20___2c_20unsigned_20char_20const____invoke_28void_20_28std____2__vector_unsigned_20char_2c_20std____2__allocator_unsigned_20char__20_____20const__29_28unsigned_20char_20const__29_2c_20std____2__vector_unsigned_20char_2c_20std____2__allocator_unsigned_20char__20___2c_20unsigned_20char_29($0, $1, $2) {
 $0 = $0 | 0;
 $1 = $1 | 0;
 $2 = $2 | 0;
 var $3 = 0, $4 = 0;
 $3 = global$0 - 16 | 0;
 $4 = $3;
 if ($3 >>> 0 < global$2 >>> 0) {
  __handle_stack_overflow();
 }
 global$0 = $4;
 $4 = HEAP32[$0 + 4 >> 2];
 $1 = ($4 >> 1) + $1 | 0;
 $0 = HEAP32[$0 >> 2];
 $0 = $4 & 1 ? HEAP32[HEAP32[$1 >> 2] + $0 >> 2] : $0;
 HEAP8[$3 + 15 | 0] = $2;
 FUNCTION_TABLE[$0]($1, $3 + 15 | 0);
 $0 = $3 + 16 | 0;
 if ($0 >>> 0 < global$2 >>> 0) {
  __handle_stack_overflow();
 }
 global$0 = $0;
}
function emscripten__internal__FunctionInvoker_emscripten__val_20_28__29_28std____2__vector_unsigned_20char_2c_20std____2__allocator_unsigned_20char__20__20const__2c_20unsigned_20long_29_2c_20emscripten__val_2c_20std____2__vector_unsigned_20char_2c_20std____2__allocator_unsigned_20char__20__20const__2c_20unsigned_20long___invoke_28emscripten__val_20_28___29_28std____2__vector_unsigned_20char_2c_20std____2__allocator_unsigned_20char__20__20const__2c_20unsigned_20long_29_2c_20std____2__vector_unsigned_20char_2c_20std____2__allocator_unsigned_20char__20___2c_20unsigned_20long_29($0, $1, $2) {
 $0 = $0 | 0;
 $1 = $1 | 0;
 $2 = $2 | 0;
 var $3 = 0, $4 = 0;
 $3 = global$0 - 16 | 0;
 $4 = $3;
 if ($3 >>> 0 < global$2 >>> 0) {
  __handle_stack_overflow();
 }
 global$0 = $4;
 FUNCTION_TABLE[HEAP32[$0 >> 2]]($3 + 8 | 0, $1, $2);
 _emval_incref(HEAP32[$3 + 8 >> 2]);
 $0 = HEAP32[$3 + 8 >> 2];
 _emval_decref($0 | 0);
 $1 = $3 + 16 | 0;
 if ($1 >>> 0 < global$2 >>> 0) {
  __handle_stack_overflow();
 }
 global$0 = $1;
 return $0 | 0;
}
function __cxxabiv1____class_type_info__search_below_dst_28__cxxabiv1____dynamic_cast_info__2c_20void_20const__2c_20int_2c_20bool_29_20const($0, $1, $2, $3, $4) {
 $0 = $0 | 0;
 $1 = $1 | 0;
 $2 = $2 | 0;
 $3 = $3 | 0;
 $4 = $4 | 0;
 if (is_equal_28std__type_info_20const__2c_20std__type_info_20const__2c_20bool_29($0, HEAP32[$1 + 8 >> 2], $4)) {
  if (!(HEAP32[$1 + 28 >> 2] == 1 | HEAP32[$1 + 4 >> 2] != ($2 | 0))) {
   HEAP32[$1 + 28 >> 2] = $3;
  }
  return;
 }
 label$3 : {
  if (!is_equal_28std__type_info_20const__2c_20std__type_info_20const__2c_20bool_29($0, HEAP32[$1 >> 2], $4)) {
   break label$3;
  }
  if (!(HEAP32[$1 + 20 >> 2] != ($2 | 0) ? HEAP32[$1 + 16 >> 2] != ($2 | 0) : 0)) {
   if (($3 | 0) != 1) {
    break label$3;
   }
   HEAP32[$1 + 32 >> 2] = 1;
   return;
  }
  HEAP32[$1 + 20 >> 2] = $2;
  HEAP32[$1 + 32 >> 2] = $3;
  HEAP32[$1 + 40 >> 2] = HEAP32[$1 + 40 >> 2] + 1;
  if (!(HEAP32[$1 + 36 >> 2] != 1 | HEAP32[$1 + 24 >> 2] != 2)) {
   HEAP8[$1 + 54 | 0] = 1;
  }
  HEAP32[$1 + 44 >> 2] = 4;
 }
}
function std____2__vector_unsigned_20char_2c_20std____2__allocator_unsigned_20char__20___push_back_28unsigned_20char_20const__29($0, $1) {
 $0 = $0 | 0;
 $1 = $1 | 0;
 var $2 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0;
 $3 = HEAP32[$0 + 4 >> 2];
 $2 = HEAP32[$0 + 8 >> 2];
 if (($3 | 0) != ($2 | 0)) {
  HEAP8[$3 | 0] = HEAPU8[$1 | 0];
  HEAP32[$0 + 4 >> 2] = HEAP32[$0 + 4 >> 2] + 1;
  return;
 }
 $5 = HEAP32[$0 >> 2];
 $3 = $3 - $5 | 0;
 $4 = $3 + 1 | 0;
 if (($4 | 0) > -1) {
  $2 = $2 - $5 | 0;
  $6 = $2 << 1;
  $4 = $2 >>> 0 < 1073741823 ? $6 >>> 0 < $4 >>> 0 ? $4 : $6 : 2147483647;
  $2 = 0;
  label$3 : {
   if (!$4) {
    break label$3;
   }
   $2 = operator_20new_28unsigned_20long_29($4);
  }
  $6 = $2 + $3 | 0;
  HEAP8[$6 | 0] = HEAPU8[$1 | 0];
  if (($3 | 0) >= 1) {
   memcpy($2, $5, $3);
  }
  HEAP32[$0 >> 2] = $2;
  HEAP32[$0 + 8 >> 2] = $2 + $4;
  HEAP32[$0 + 4 >> 2] = $6 + 1;
  if ($5) {
   dlfree($5);
  }
  return;
 }
 std____2____vector_base_common_true_____throw_length_error_28_29_20const();
 abort();
}
function __cxxabiv1____pointer_type_info__can_catch_nested_28__cxxabiv1____shim_type_info_20const__29_20const($0, $1) {
 var $2 = 0, $3 = 0;
 label$1 : {
  while (1) {
   if (!$1) {
    return 0;
   }
   $2 = __dynamic_cast($1, 2480);
   if (!$2 | HEAP32[$2 + 8 >> 2] & (HEAP32[$0 + 8 >> 2] ^ -1)) {
    break label$1;
   }
   $1 = $0;
   if (is_equal_28std__type_info_20const__2c_20std__type_info_20const__2c_20bool_29(HEAP32[$0 + 12 >> 2], HEAP32[$2 + 12 >> 2], 0)) {
    return 1;
   }
   if (!(HEAP8[$0 + 8 | 0] & 1)) {
    break label$1;
   }
   $0 = HEAP32[$1 + 12 >> 2];
   if (!$0) {
    break label$1;
   }
   $0 = __dynamic_cast($0, 2480);
   if ($0) {
    $1 = HEAP32[$2 + 12 >> 2];
    continue;
   }
   break;
  }
  $0 = HEAP32[$1 + 12 >> 2];
  if (!$0) {
   break label$1;
  }
  $0 = __dynamic_cast($0, 2592);
  if (!$0) {
   break label$1;
  }
  $3 = __cxxabiv1____pointer_to_member_type_info__can_catch_nested_28__cxxabiv1____shim_type_info_20const__29_20const($0, HEAP32[$2 + 12 >> 2]);
 }
 return $3;
}
function EmscriptenBindingInitializer_lzx_decoder_class__EmscriptenBindingInitializer_lzx_decoder_class_28_29__$_1____invoke_28LzxDecoder__2c_20emscripten__val_20const__29($0, $1, $2) {
 $0 = $0 | 0;
 $1 = $1 | 0;
 $2 = $2 | 0;
 var $3 = 0, $4 = 0, $5 = 0;
 $3 = global$0 - 16 | 0;
 $4 = $3;
 if ($3 >>> 0 < global$2 >>> 0) {
  __handle_stack_overflow();
 }
 global$0 = $4;
 $4 = HEAP32[$1 + 60 >> 2] - HEAP32[$1 + 56 >> 2] | 0;
 label$2 : {
  if (!_emval_is_number(HEAP32[$2 >> 2])) {
   break label$2;
  }
  $5 = +_emval_as(HEAP32[$2 >> 2], 2796, $3 + 12 | 0);
  _emval_run_destructors(HEAP32[$3 + 12 >> 2]);
  if ($5 < 4294967296 & $5 >= 0) {
   $4 = ~~$5 >>> 0;
   break label$2;
  }
  $4 = 0;
 }
 HEAP32[$3 + 4 >> 2] = HEAP32[$1 + 56 >> 2];
 HEAP32[$3 >> 2] = $4;
 HEAP32[$0 >> 2] = _emval_take_value(2216, $3 | 0);
 $0 = $3 + 16 | 0;
 if ($0 >>> 0 < global$2 >>> 0) {
  __handle_stack_overflow();
 }
 global$0 = $0;
}
function __cxxabiv1____class_type_info__process_static_type_above_dst_28__cxxabiv1____dynamic_cast_info__2c_20void_20const__2c_20void_20const__2c_20int_29_20const($0, $1, $2, $3) {
 HEAP8[$0 + 53 | 0] = 1;
 label$1 : {
  if (HEAP32[$0 + 4 >> 2] != ($2 | 0)) {
   break label$1;
  }
  HEAP8[$0 + 52 | 0] = 1;
  $2 = HEAP32[$0 + 16 >> 2];
  if (!$2) {
   HEAP32[$0 + 36 >> 2] = 1;
   HEAP32[$0 + 24 >> 2] = $3;
   HEAP32[$0 + 16 >> 2] = $1;
   if (($3 | 0) != 1 | HEAP32[$0 + 48 >> 2] != 1) {
    break label$1;
   }
   HEAP8[$0 + 54 | 0] = 1;
   return;
  }
  if (($1 | 0) == ($2 | 0)) {
   $2 = HEAP32[$0 + 24 >> 2];
   if (($2 | 0) == 2) {
    HEAP32[$0 + 24 >> 2] = $3;
    $2 = $3;
   }
   if (HEAP32[$0 + 48 >> 2] != 1 | ($2 | 0) != 1) {
    break label$1;
   }
   HEAP8[$0 + 54 | 0] = 1;
   return;
  }
  HEAP8[$0 + 54 | 0] = 1;
  HEAP32[$0 + 36 >> 2] = HEAP32[$0 + 36 >> 2] + 1;
 }
}
function emscripten__internal__FunctionInvoker_emscripten__val_20_28__29_28LzxDecoder__2c_20emscripten__val_20const__29_2c_20emscripten__val_2c_20LzxDecoder__2c_20emscripten__val_20const____invoke_28emscripten__val_20_28___29_28LzxDecoder__2c_20emscripten__val_20const__29_2c_20LzxDecoder__2c_20emscripten__internal___EM_VAL__29($0, $1, $2) {
 $0 = $0 | 0;
 $1 = $1 | 0;
 $2 = $2 | 0;
 var $3 = 0, $4 = 0;
 $3 = global$0 - 16 | 0;
 $4 = $3;
 if ($3 >>> 0 < global$2 >>> 0) {
  __handle_stack_overflow();
 }
 global$0 = $4;
 $0 = HEAP32[$0 >> 2];
 HEAP32[$3 >> 2] = $2;
 FUNCTION_TABLE[$0]($3 + 8 | 0, $1, $3);
 _emval_incref(HEAP32[$3 + 8 >> 2]);
 $0 = HEAP32[$3 + 8 >> 2];
 _emval_decref($0 | 0);
 _emval_decref(HEAP32[$3 >> 2]);
 $1 = $3 + 16 | 0;
 if ($1 >>> 0 < global$2 >>> 0) {
  __handle_stack_overflow();
 }
 global$0 = $1;
 return $0 | 0;
}
function LzxDecoder__decode_28std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20__20const__2c_20int_29($0, $1, $2, $3) {
 var $4 = 0;
 $4 = HEAP32[$1 + 56 >> 2];
 HEAP32[$1 + 24 >> 2] = $4;
 HEAP32[$1 + 32 >> 2] = HEAP32[$1 + 60 >> 2] - $4;
 HEAP32[$1 + 36 >> 2] = 0;
 HEAP32[$1 >> 2] = HEAP8[$2 + 11 | 0] < 0 ? HEAP32[$2 >> 2] : $2;
 $4 = HEAPU8[$2 + 11 | 0];
 HEAP32[$1 + 8 >> 2] = $4 << 24 >> 24 < 0 ? HEAP32[$2 + 4 >> 2] : $4;
 HEAP32[$1 + 12 >> 2] = 0;
 HEAP32[$0 >> 2] = lzx_decode_28lzx_stream__2c_20int_29($1, $3);
 $3 = HEAP32[$2 + 4 >> 2];
 $2 = HEAPU8[$2 + 11 | 0];
 HEAP32[$0 + 4 >> 2] = ($2 << 24 >> 24 < 0 ? $3 : $2) - HEAP32[$1 + 8 >> 2];
 HEAP32[$0 + 8 >> 2] = (HEAP32[$1 + 60 >> 2] - HEAP32[$1 + 56 >> 2] | 0) - HEAP32[$1 + 32 >> 2];
}
function emscripten__internal__VectorAccess_std____2__vector_unsigned_20char_2c_20std____2__allocator_unsigned_20char__20__20___get_28std____2__vector_unsigned_20char_2c_20std____2__allocator_unsigned_20char__20__20const__2c_20unsigned_20long_29($0, $1, $2) {
 $0 = $0 | 0;
 $1 = $1 | 0;
 $2 = $2 | 0;
 var $3 = 0, $4 = 0;
 $3 = global$0 - 16 | 0;
 $4 = $3;
 if ($3 >>> 0 < global$2 >>> 0) {
  __handle_stack_overflow();
 }
 global$0 = $4;
 $4 = HEAP32[$1 + 4 >> 2];
 $1 = HEAP32[$1 >> 2];
 if ($4 - $1 >>> 0 > $2 >>> 0) {
  HEAP32[$3 + 8 >> 2] = HEAPU8[$1 + $2 | 0];
  $1 = _emval_take_value(2736, $3 + 8 | 0) | 0;
 } else {
  $1 = 1;
 }
 HEAP32[$0 >> 2] = $1;
 $0 = $3 + 16 | 0;
 if ($0 >>> 0 < global$2 >>> 0) {
  __handle_stack_overflow();
 }
 global$0 = $0;
}
function emscripten__internal__MethodInvoker_unsigned_20long_20_28std____2__vector_unsigned_20char_2c_20std____2__allocator_unsigned_20char__20_____29_28_29_20const_2c_20unsigned_20long_2c_20std____2__vector_unsigned_20char_2c_20std____2__allocator_unsigned_20char__20__20const____invoke_28unsigned_20long_20_28std____2__vector_unsigned_20char_2c_20std____2__allocator_unsigned_20char__20_____20const__29_28_29_20const_2c_20std____2__vector_unsigned_20char_2c_20std____2__allocator_unsigned_20char__20__20const__29($0, $1) {
 $0 = $0 | 0;
 $1 = $1 | 0;
 var $2 = 0, $3 = 0;
 $2 = HEAP32[$0 >> 2];
 $0 = HEAP32[$0 + 4 >> 2];
 $1 = ($0 >> 1) + $1 | 0;
 $3 = $1;
 if ($0 & 1) {
  $2 = HEAP32[$2 + HEAP32[$1 >> 2] >> 2];
 }
 return FUNCTION_TABLE[$2]($3) | 0;
}
function emscripten__internal__Invoker_std____2__vector_unsigned_20char_2c_20std____2__allocator_unsigned_20char__20__2c_20int___invoke_28std____2__vector_unsigned_20char_2c_20std____2__allocator_unsigned_20char__20__20_28__29_28int_29_2c_20int_29($0, $1) {
 $0 = $0 | 0;
 $1 = $1 | 0;
 var $2 = 0, $3 = 0;
 $2 = global$0 - 16 | 0;
 $3 = $2;
 if ($2 >>> 0 < global$2 >>> 0) {
  __handle_stack_overflow();
 }
 global$0 = $3;
 FUNCTION_TABLE[$0]($2, $1);
 $0 = operator_20new_28unsigned_20long_29(12);
 HEAP32[$0 >> 2] = HEAP32[$2 >> 2];
 HEAP32[$0 + 4 >> 2] = HEAP32[$2 + 4 >> 2];
 HEAP32[$0 + 8 >> 2] = HEAP32[$2 + 8 >> 2];
 $1 = $2 + 16 | 0;
 if ($1 >>> 0 < global$2 >>> 0) {
  __handle_stack_overflow();
 }
 global$0 = $1;
 return $0 | 0;
}
function strlen($0) {
 var $1 = 0, $2 = 0, $3 = 0;
 label$1 : {
  label$2 : {
   $1 = $0;
   if (!($1 & 3)) {
    break label$2;
   }
   if (!HEAPU8[$0 | 0]) {
    break label$1;
   }
   while (1) {
    $1 = $1 + 1 | 0;
    if (!($1 & 3)) {
     break label$2;
    }
    if (HEAPU8[$1 | 0]) {
     continue;
    }
    break;
   }
   break label$1;
  }
  while (1) {
   $2 = $1;
   $1 = $1 + 4 | 0;
   $3 = HEAP32[$2 >> 2];
   if (!(($3 ^ -1) & $3 + -16843009 & -2139062144)) {
    continue;
   }
   break;
  }
  if (!($3 & 255)) {
   $1 = $2;
   break label$1;
  }
  while (1) {
   $3 = HEAPU8[$2 + 1 | 0];
   $1 = $2 + 1 | 0;
   $2 = $1;
   if ($3) {
    continue;
   }
   break;
  }
 }
 return $1 - $0 | 0;
}
function __cxxabiv1____si_class_type_info__search_above_dst_28__cxxabiv1____dynamic_cast_info__2c_20void_20const__2c_20void_20const__2c_20int_2c_20bool_29_20const($0, $1, $2, $3, $4, $5) {
 $0 = $0 | 0;
 $1 = $1 | 0;
 $2 = $2 | 0;
 $3 = $3 | 0;
 $4 = $4 | 0;
 $5 = $5 | 0;
 if (is_equal_28std__type_info_20const__2c_20std__type_info_20const__2c_20bool_29($0, HEAP32[$1 + 8 >> 2], $5)) {
  __cxxabiv1____class_type_info__process_static_type_above_dst_28__cxxabiv1____dynamic_cast_info__2c_20void_20const__2c_20void_20const__2c_20int_29_20const($1, $2, $3, $4);
  return;
 }
 $0 = HEAP32[$0 + 8 >> 2];
 FUNCTION_TABLE[HEAP32[HEAP32[$0 >> 2] + 20 >> 2]]($0, $1, $2, $3, $4, $5);
}
function lzx_decode_free_28lzx_stream__29($0) {
 var $1 = 0;
 $1 = HEAP32[$0 + 48 >> 2];
 if ($1) {
  dlfree(HEAP32[$1 + 12 >> 2]);
  dlfree(HEAP32[HEAP32[$0 + 48 >> 2] + 76 >> 2]);
  $1 = HEAP32[$0 + 48 >> 2];
  dlfree(HEAP32[$1 + 168 >> 2]);
  dlfree(HEAP32[$1 + 184 >> 2]);
  $1 = HEAP32[$0 + 48 >> 2];
  dlfree(HEAP32[$1 + 444 >> 2]);
  dlfree(HEAP32[$1 + 460 >> 2]);
  $1 = HEAP32[$0 + 48 >> 2];
  dlfree(HEAP32[$1 + 352 >> 2]);
  dlfree(HEAP32[$1 + 368 >> 2]);
  $1 = HEAP32[$0 + 48 >> 2];
  dlfree(HEAP32[$1 + 260 >> 2]);
  dlfree(HEAP32[$1 + 276 >> 2]);
  dlfree(HEAP32[$0 + 48 >> 2]);
  HEAP32[$0 + 48 >> 2] = 0;
 }
}
function __cxxabiv1____pointer_to_member_type_info__can_catch_nested_28__cxxabiv1____shim_type_info_20const__29_20const($0, $1) {
 var $2 = 0;
 label$1 : {
  if (!$1) {
   break label$1;
  }
  $1 = __dynamic_cast($1, 2592);
  if (!$1 | HEAP32[$1 + 8 >> 2] & (HEAP32[$0 + 8 >> 2] ^ -1)) {
   break label$1;
  }
  if (!is_equal_28std__type_info_20const__2c_20std__type_info_20const__2c_20bool_29(HEAP32[$0 + 12 >> 2], HEAP32[$1 + 12 >> 2], 0)) {
   break label$1;
  }
  $2 = is_equal_28std__type_info_20const__2c_20std__type_info_20const__2c_20bool_29(HEAP32[$0 + 16 >> 2], HEAP32[$1 + 16 >> 2], 0);
 }
 return $2;
}
function long_20long__20emscripten__internal__GetterPolicy_long_20long_20_28LzxDecoder____29_28_29_20const___get_LzxDecoder__28long_20long_20_28LzxDecoder____20const__29_28_29_20const_2c_20LzxDecoder_20const__29($0, $1) {
 $0 = $0 | 0;
 $1 = $1 | 0;
 var $2 = 0, $3 = 0;
 $2 = HEAP32[$0 >> 2];
 $0 = HEAP32[$0 + 4 >> 2];
 $1 = ($0 >> 1) + $1 | 0;
 $3 = $1;
 if ($0 & 1) {
  $2 = HEAP32[$2 + HEAP32[$1 >> 2] >> 2];
 }
 $0 = FUNCTION_TABLE[$2]($3) | 0;
 $1 = i64toi32_i32$HIGH_BITS;
 $2 = $0;
 $0 = operator_20new_28unsigned_20long_29(8);
 HEAP32[$0 >> 2] = $2;
 HEAP32[$0 + 4 >> 2] = $1;
 return $0 | 0;
}
function emscripten__internal__MethodInvoker_void_20_28LzxDecoder____29_28unsigned_20int_2c_20unsigned_20int_29_2c_20void_2c_20LzxDecoder__2c_20unsigned_20int_2c_20unsigned_20int___invoke_28void_20_28LzxDecoder____20const__29_28unsigned_20int_2c_20unsigned_20int_29_2c_20LzxDecoder__2c_20unsigned_20int_2c_20unsigned_20int_29($0, $1, $2, $3) {
 $0 = $0 | 0;
 $1 = $1 | 0;
 $2 = $2 | 0;
 $3 = $3 | 0;
 var $4 = 0, $5 = 0;
 $4 = HEAP32[$0 >> 2];
 $0 = HEAP32[$0 + 4 >> 2];
 $1 = ($0 >> 1) + $1 | 0;
 $5 = $1;
 if ($0 & 1) {
  $4 = HEAP32[$4 + HEAP32[$1 >> 2] >> 2];
 }
 FUNCTION_TABLE[$4]($5, $2, $3);
}
function __fflush_unlocked($0) {
 var $1 = 0, $2 = 0;
 label$1 : {
  if (HEAPU32[$0 + 20 >> 2] <= HEAPU32[$0 + 28 >> 2]) {
   break label$1;
  }
  FUNCTION_TABLE[HEAP32[$0 + 36 >> 2]]($0, 0, 0) | 0;
  if (HEAP32[$0 + 20 >> 2]) {
   break label$1;
  }
  return -1;
 }
 $1 = HEAP32[$0 + 4 >> 2];
 $2 = HEAP32[$0 + 8 >> 2];
 if ($1 >>> 0 < $2 >>> 0) {
  $1 = $1 - $2 | 0;
  FUNCTION_TABLE[HEAP32[$0 + 40 >> 2]]($0, $1, $1 >> 31, 1) | 0;
 }
 HEAP32[$0 + 28 >> 2] = 0;
 HEAP32[$0 + 16 >> 2] = 0;
 HEAP32[$0 + 20 >> 2] = 0;
 HEAP32[$0 + 4 >> 2] = 0;
 HEAP32[$0 + 8 >> 2] = 0;
 return 0;
}
function __cxxabiv1____si_class_type_info__has_unambiguous_public_base_28__cxxabiv1____dynamic_cast_info__2c_20void__2c_20int_29_20const($0, $1, $2, $3) {
 $0 = $0 | 0;
 $1 = $1 | 0;
 $2 = $2 | 0;
 $3 = $3 | 0;
 if (is_equal_28std__type_info_20const__2c_20std__type_info_20const__2c_20bool_29($0, HEAP32[$1 + 8 >> 2], 0)) {
  __cxxabiv1____class_type_info__process_found_base_class_28__cxxabiv1____dynamic_cast_info__2c_20void__2c_20int_29_20const($1, $2, $3);
  return;
 }
 $0 = HEAP32[$0 + 8 >> 2];
 FUNCTION_TABLE[HEAP32[HEAP32[$0 >> 2] + 28 >> 2]]($0, $1, $2, $3);
}
function LzxDecoder__LzxDecoder_28_29($0) {
 HEAP32[$0 + 56 >> 2] = 0;
 HEAP32[$0 + 60 >> 2] = 0;
 HEAP32[$0 >> 2] = 0;
 HEAP32[$0 + 8 >> 2] = 0;
 HEAP32[$0 + 12 >> 2] = 0;
 HEAP32[$0 + 32 >> 2] = 0;
 HEAP32[$0 + 36 >> 2] = 0;
 HEAP32[$0 - -64 >> 2] = 0;
 HEAP32[$0 + 16 >> 2] = 0;
 HEAP32[$0 + 20 >> 2] = 0;
 HEAP32[$0 + 24 >> 2] = 0;
 HEAP32[$0 + 40 >> 2] = 0;
 HEAP32[$0 + 44 >> 2] = 0;
 HEAP32[$0 + 48 >> 2] = 0;
 std____2__vector_unsigned_20char_2c_20std____2__allocator_unsigned_20char__20_____append_28unsigned_20long_29($0 + 56 | 0, 32768);
 return $0;
}
function __cxxabiv1____class_type_info__search_above_dst_28__cxxabiv1____dynamic_cast_info__2c_20void_20const__2c_20void_20const__2c_20int_2c_20bool_29_20const($0, $1, $2, $3, $4, $5) {
 $0 = $0 | 0;
 $1 = $1 | 0;
 $2 = $2 | 0;
 $3 = $3 | 0;
 $4 = $4 | 0;
 $5 = $5 | 0;
 if (is_equal_28std__type_info_20const__2c_20std__type_info_20const__2c_20bool_29($0, HEAP32[$1 + 8 >> 2], $5)) {
  __cxxabiv1____class_type_info__process_static_type_above_dst_28__cxxabiv1____dynamic_cast_info__2c_20void_20const__2c_20void_20const__2c_20int_29_20const($1, $2, $3, $4);
 }
}
function __cxxabiv1____class_type_info__process_found_base_class_28__cxxabiv1____dynamic_cast_info__2c_20void__2c_20int_29_20const($0, $1, $2) {
 var $3 = 0;
 $3 = HEAP32[$0 + 16 >> 2];
 if (!$3) {
  HEAP32[$0 + 36 >> 2] = 1;
  HEAP32[$0 + 24 >> 2] = $2;
  HEAP32[$0 + 16 >> 2] = $1;
  return;
 }
 label$2 : {
  if (($1 | 0) == ($3 | 0)) {
   if (HEAP32[$0 + 24 >> 2] != 2) {
    break label$2;
   }
   HEAP32[$0 + 24 >> 2] = $2;
   return;
  }
  HEAP8[$0 + 54 | 0] = 1;
  HEAP32[$0 + 24 >> 2] = 2;
  HEAP32[$0 + 36 >> 2] = HEAP32[$0 + 36 >> 2] + 1;
 }
}
function std____2__vector_unsigned_20char_2c_20std____2__allocator_unsigned_20char__20___resize_28unsigned_20long_2c_20unsigned_20char_20const__29($0, $1, $2) {
 $0 = $0 | 0;
 $1 = $1 | 0;
 $2 = $2 | 0;
 var $3 = 0, $4 = 0;
 $4 = HEAP32[$0 >> 2];
 $3 = HEAP32[$0 + 4 >> 2] - $4 | 0;
 if ($3 >>> 0 < $1 >>> 0) {
  std____2__vector_unsigned_20char_2c_20std____2__allocator_unsigned_20char__20_____append_28unsigned_20long_2c_20unsigned_20char_20const__29($0, $1 - $3 | 0, $2);
  return;
 }
 if ($3 >>> 0 > $1 >>> 0) {
  HEAP32[$0 + 4 >> 2] = $1 + $4;
 }
}
function __cxxabiv1____base_class_type_info__has_unambiguous_public_base_28__cxxabiv1____dynamic_cast_info__2c_20void__2c_20int_29_20const($0, $1, $2, $3) {
 var $4 = 0, $5 = 0, $6 = 0, $7 = 0;
 $5 = HEAP32[$0 + 4 >> 2];
 $0 = HEAP32[$0 >> 2];
 $6 = $0;
 $7 = $1;
 $4 = 0;
 label$1 : {
  if (!$2) {
   break label$1;
  }
  $1 = $5 >> 8;
  $4 = $1;
  if (!($5 & 1)) {
   break label$1;
  }
  $4 = HEAP32[$1 + HEAP32[$2 >> 2] >> 2];
 }
 FUNCTION_TABLE[HEAP32[HEAP32[$0 >> 2] + 28 >> 2]]($6, $7, $4 + $2 | 0, $5 & 2 ? $3 : 2);
}
function __cxxabiv1____pbase_type_info__can_catch_28__cxxabiv1____shim_type_info_20const__2c_20void___29_20const($0, $1) {
 var $2 = 0, $3 = 0;
 $2 = $0;
 $3 = $1;
 label$1 : {
  if (HEAPU8[$0 + 8 | 0] & 24) {
   $0 = 1;
  } else {
   $0 = 0;
   if (!$1) {
    break label$1;
   }
   $1 = __dynamic_cast($1, 2432);
   if (!$1) {
    break label$1;
   }
   $0 = (HEAPU8[$1 + 8 | 0] & 24) != 0;
  }
  $0 = is_equal_28std__type_info_20const__2c_20std__type_info_20const__2c_20bool_29($2, $3, $0);
 }
 return $0;
}
function EmscriptenBindingInitializer_native_and_builtin_types__EmscriptenBindingInitializer_native_and_builtin_types_28_29($0) {
 $0 = $0 | 0;
 var $1 = 0, $2 = 0;
 $1 = global$0 - 16 | 0;
 $2 = $1;
 if ($1 >>> 0 < global$2 >>> 0) {
  __handle_stack_overflow();
 }
 global$0 = $2;
 HEAP32[$1 + 12 >> 2] = $0;
 $0 = HEAP32[$1 + 12 >> 2];
 __embind_register_native_and_builtin_types();
 $1 = $1 + 16 | 0;
 if ($1 >>> 0 < global$2 >>> 0) {
  __handle_stack_overflow();
 }
 global$0 = $1;
 return $0 | 0;
}
function fflush($0) {
 $0 = $0 | 0;
 var $1 = 0;
 if ($0) {
  if (HEAP32[$0 + 76 >> 2] <= -1) {
   return __fflush_unlocked($0) | 0;
  }
  return __fflush_unlocked($0) | 0;
 }
 if (HEAP32[1118]) {
  $1 = fflush(HEAP32[1118]);
 }
 __lock(4460);
 $0 = HEAP32[1117];
 if ($0) {
  while (1) {
   if (HEAPU32[$0 + 20 >> 2] > HEAPU32[$0 + 28 >> 2]) {
    $1 = __fflush_unlocked($0) | $1;
   }
   $0 = HEAP32[$0 + 56 >> 2];
   if ($0) {
    continue;
   }
   break;
  }
 }
 __unlock(4460);
 return $1 | 0;
}
function emscripten__internal__MethodInvoker_int_20_28LzxDecoder____29_28int_29_2c_20int_2c_20LzxDecoder__2c_20int___invoke_28int_20_28LzxDecoder____20const__29_28int_29_2c_20LzxDecoder__2c_20int_29($0, $1, $2) {
 $0 = $0 | 0;
 $1 = $1 | 0;
 $2 = $2 | 0;
 var $3 = 0, $4 = 0;
 $3 = HEAP32[$0 >> 2];
 $0 = HEAP32[$0 + 4 >> 2];
 $1 = ($0 >> 1) + $1 | 0;
 $4 = $1;
 if ($0 & 1) {
  $3 = HEAP32[$3 + HEAP32[$1 >> 2] >> 2];
 }
 return FUNCTION_TABLE[$3]($4, $2) | 0;
}
function __cxxabiv1____class_type_info__has_unambiguous_public_base_28__cxxabiv1____dynamic_cast_info__2c_20void__2c_20int_29_20const($0, $1, $2, $3) {
 $0 = $0 | 0;
 $1 = $1 | 0;
 $2 = $2 | 0;
 $3 = $3 | 0;
 if (is_equal_28std__type_info_20const__2c_20std__type_info_20const__2c_20bool_29($0, HEAP32[$1 + 8 >> 2], 0)) {
  __cxxabiv1____class_type_info__process_found_base_class_28__cxxabiv1____dynamic_cast_info__2c_20void__2c_20int_29_20const($1, $2, $3);
 }
}
function __cxxabiv1____base_class_type_info__search_above_dst_28__cxxabiv1____dynamic_cast_info__2c_20void_20const__2c_20void_20const__2c_20int_2c_20bool_29_20const($0, $1, $2, $3, $4, $5) {
 var $6 = 0, $7 = 0, $8 = 0;
 $6 = HEAP32[$0 + 4 >> 2];
 $7 = $6 >> 8;
 $0 = HEAP32[$0 >> 2];
 $8 = $0;
 if ($6 & 1) {
  $7 = HEAP32[HEAP32[$3 >> 2] + $7 >> 2];
 }
 FUNCTION_TABLE[HEAP32[HEAP32[$0 >> 2] + 20 >> 2]]($8, $1, $2, $3 + $7 | 0, $6 & 2 ? $4 : 2, $5);
}
function void_20_28anonymous_20namespace_29__register_integer_long__28char_20const__29() {
 var $0 = 0, $1 = 0;
 $0 = global$0 - 16 | 0;
 $1 = $0;
 if ($0 >>> 0 < global$2 >>> 0) {
  __handle_stack_overflow();
 }
 global$0 = $1;
 HEAP32[$0 + 12 >> 2] = 3195;
 _embind_register_integer(2808, HEAP32[$0 + 12 >> 2], 4, -2147483648, 2147483647);
 $0 = $0 + 16 | 0;
 if ($0 >>> 0 < global$2 >>> 0) {
  __handle_stack_overflow();
 }
 global$0 = $0;
}
function void_20_28anonymous_20namespace_29__register_integer_int__28char_20const__29() {
 var $0 = 0, $1 = 0;
 $0 = global$0 - 16 | 0;
 $1 = $0;
 if ($0 >>> 0 < global$2 >>> 0) {
  __handle_stack_overflow();
 }
 global$0 = $1;
 HEAP32[$0 + 12 >> 2] = 3178;
 _embind_register_integer(2784, HEAP32[$0 + 12 >> 2], 4, -2147483648, 2147483647);
 $0 = $0 + 16 | 0;
 if ($0 >>> 0 < global$2 >>> 0) {
  __handle_stack_overflow();
 }
 global$0 = $0;
}
function void_20_28anonymous_20namespace_29__register_integer_unsigned_20short__28char_20const__29() {
 var $0 = 0, $1 = 0;
 $0 = global$0 - 16 | 0;
 $1 = $0;
 if ($0 >>> 0 < global$2 >>> 0) {
  __handle_stack_overflow();
 }
 global$0 = $1;
 HEAP32[$0 + 12 >> 2] = 3163;
 _embind_register_integer(2772, HEAP32[$0 + 12 >> 2], 2, 0, 65535);
 $0 = $0 + 16 | 0;
 if ($0 >>> 0 < global$2 >>> 0) {
  __handle_stack_overflow();
 }
 global$0 = $0;
}
function void_20_28anonymous_20namespace_29__register_memory_view_unsigned_20short__28char_20const__29($0) {
 var $1 = 0, $2 = 0;
 $1 = global$0 - 16 | 0;
 $2 = $1;
 if ($1 >>> 0 < global$2 >>> 0) {
  __handle_stack_overflow();
 }
 global$0 = $2;
 HEAP32[$1 + 12 >> 2] = $0;
 _embind_register_memory_view(4204, 3, HEAP32[$1 + 12 >> 2]);
 $0 = $1 + 16 | 0;
 if ($0 >>> 0 < global$2 >>> 0) {
  __handle_stack_overflow();
 }
 global$0 = $0;
}
function void_20_28anonymous_20namespace_29__register_integer_signed_20char__28char_20const__29() {
 var $0 = 0, $1 = 0;
 $0 = global$0 - 16 | 0;
 $1 = $0;
 if ($0 >>> 0 < global$2 >>> 0) {
  __handle_stack_overflow();
 }
 global$0 = $1;
 HEAP32[$0 + 12 >> 2] = 3131;
 _embind_register_integer(2748, HEAP32[$0 + 12 >> 2], 1, -128, 127);
 $0 = $0 + 16 | 0;
 if ($0 >>> 0 < global$2 >>> 0) {
  __handle_stack_overflow();
 }
 global$0 = $0;
}
function void_20_28anonymous_20namespace_29__register_memory_view_unsigned_20long__28char_20const__29() {
 var $0 = 0, $1 = 0;
 $0 = global$0 - 16 | 0;
 $1 = $0;
 if ($0 >>> 0 < global$2 >>> 0) {
  __handle_stack_overflow();
 }
 global$0 = $1;
 HEAP32[$0 + 12 >> 2] = 3575;
 _embind_register_memory_view(4364, 5, HEAP32[$0 + 12 >> 2]);
 $0 = $0 + 16 | 0;
 if ($0 >>> 0 < global$2 >>> 0) {
  __handle_stack_overflow();
 }
 global$0 = $0;
}
function void_20_28anonymous_20namespace_29__register_memory_view_unsigned_20char__28char_20const__29($0) {
 var $1 = 0, $2 = 0;
 $1 = global$0 - 16 | 0;
 $2 = $1;
 if ($1 >>> 0 < global$2 >>> 0) {
  __handle_stack_overflow();
 }
 global$0 = $2;
 HEAP32[$1 + 12 >> 2] = $0;
 _embind_register_memory_view(2216, 1, HEAP32[$1 + 12 >> 2]);
 $0 = $1 + 16 | 0;
 if ($0 >>> 0 < global$2 >>> 0) {
  __handle_stack_overflow();
 }
 global$0 = $0;
}
function void_20_28anonymous_20namespace_29__register_integer_unsigned_20char__28char_20const__29() {
 var $0 = 0, $1 = 0;
 $0 = global$0 - 16 | 0;
 $1 = $0;
 if ($0 >>> 0 < global$2 >>> 0) {
  __handle_stack_overflow();
 }
 global$0 = $1;
 HEAP32[$0 + 12 >> 2] = 3143;
 _embind_register_integer(2736, HEAP32[$0 + 12 >> 2], 1, 0, 255);
 $0 = $0 + 16 | 0;
 if ($0 >>> 0 < global$2 >>> 0) {
  __handle_stack_overflow();
 }
 global$0 = $0;
}
function void_20_28anonymous_20namespace_29__register_memory_view_unsigned_20int__28char_20const__29($0) {
 var $1 = 0, $2 = 0;
 $1 = global$0 - 16 | 0;
 $2 = $1;
 if ($1 >>> 0 < global$2 >>> 0) {
  __handle_stack_overflow();
 }
 global$0 = $2;
 HEAP32[$1 + 12 >> 2] = $0;
 _embind_register_memory_view(4284, 5, HEAP32[$1 + 12 >> 2]);
 $0 = $1 + 16 | 0;
 if ($0 >>> 0 < global$2 >>> 0) {
  __handle_stack_overflow();
 }
 global$0 = $0;
}
function void_20_28anonymous_20namespace_29__register_integer_unsigned_20long__28char_20const__29() {
 var $0 = 0, $1 = 0;
 $0 = global$0 - 16 | 0;
 $1 = $0;
 if ($0 >>> 0 < global$2 >>> 0) {
  __handle_stack_overflow();
 }
 global$0 = $1;
 HEAP32[$0 + 12 >> 2] = 3200;
 _embind_register_integer(2820, HEAP32[$0 + 12 >> 2], 4, 0, -1);
 $0 = $0 + 16 | 0;
 if ($0 >>> 0 < global$2 >>> 0) {
  __handle_stack_overflow();
 }
 global$0 = $0;
}
function void_20_28anonymous_20namespace_29__register_memory_view_signed_20char__28char_20const__29($0) {
 var $1 = 0, $2 = 0;
 $1 = global$0 - 16 | 0;
 $2 = $1;
 if ($1 >>> 0 < global$2 >>> 0) {
  __handle_stack_overflow();
 }
 global$0 = $2;
 HEAP32[$1 + 12 >> 2] = $0;
 _embind_register_memory_view(4124, 0, HEAP32[$1 + 12 >> 2]);
 $0 = $1 + 16 | 0;
 if ($0 >>> 0 < global$2 >>> 0) {
  __handle_stack_overflow();
 }
 global$0 = $0;
}
function void_20_28anonymous_20namespace_29__register_integer_unsigned_20int__28char_20const__29() {
 var $0 = 0, $1 = 0;
 $0 = global$0 - 16 | 0;
 $1 = $0;
 if ($0 >>> 0 < global$2 >>> 0) {
  __handle_stack_overflow();
 }
 global$0 = $1;
 HEAP32[$0 + 12 >> 2] = 3182;
 _embind_register_integer(2796, HEAP32[$0 + 12 >> 2], 4, 0, -1);
 $0 = $0 + 16 | 0;
 if ($0 >>> 0 < global$2 >>> 0) {
  __handle_stack_overflow();
 }
 global$0 = $0;
}
function void_20_28anonymous_20namespace_29__register_integer_short__28char_20const__29() {
 var $0 = 0, $1 = 0;
 $0 = global$0 - 16 | 0;
 $1 = $0;
 if ($0 >>> 0 < global$2 >>> 0) {
  __handle_stack_overflow();
 }
 global$0 = $1;
 HEAP32[$0 + 12 >> 2] = 3157;
 _embind_register_integer(2760, HEAP32[$0 + 12 >> 2], 2, -32768, 32767);
 $0 = $0 + 16 | 0;
 if ($0 >>> 0 < global$2 >>> 0) {
  __handle_stack_overflow();
 }
 global$0 = $0;
}
function __wasm_call_ctors() {
 emscripten__class__std____2__vector_unsigned_20char_2c_20std____2__allocator_unsigned_20char__20__2c_20emscripten__internal__NoBaseClass__20emscripten__register_vector_unsigned_20char__28char_20const__29();
 _embind_register_function(1227, 2, 1864, 1776, 35, 36);
 EmscriptenBindingInitializer_lzx_decoder_class__EmscriptenBindingInitializer_lzx_decoder_class_28_29();
 FUNCTION_TABLE[57](4480) | 0;
}
function void_20_28anonymous_20namespace_29__register_integer_char__28char_20const__29() {
 var $0 = 0, $1 = 0;
 $0 = global$0 - 16 | 0;
 $1 = $0;
 if ($0 >>> 0 < global$2 >>> 0) {
  __handle_stack_overflow();
 }
 global$0 = $1;
 HEAP32[$0 + 12 >> 2] = 3126;
 _embind_register_integer(2724, HEAP32[$0 + 12 >> 2], 1, -128, 127);
 $0 = $0 + 16 | 0;
 if ($0 >>> 0 < global$2 >>> 0) {
  __handle_stack_overflow();
 }
 global$0 = $0;
}
function void_20_28anonymous_20namespace_29__register_memory_view_double__28char_20const__29() {
 var $0 = 0, $1 = 0;
 $0 = global$0 - 16 | 0;
 $1 = $0;
 if ($0 >>> 0 < global$2 >>> 0) {
  __handle_stack_overflow();
 }
 global$0 = $1;
 HEAP32[$0 + 12 >> 2] = 3844;
 _embind_register_memory_view(4444, 7, HEAP32[$0 + 12 >> 2]);
 $0 = $0 + 16 | 0;
 if ($0 >>> 0 < global$2 >>> 0) {
  __handle_stack_overflow();
 }
 global$0 = $0;
}
function void_20_28anonymous_20namespace_29__register_memory_view_short__28char_20const__29($0) {
 var $1 = 0, $2 = 0;
 $1 = global$0 - 16 | 0;
 $2 = $1;
 if ($1 >>> 0 < global$2 >>> 0) {
  __handle_stack_overflow();
 }
 global$0 = $2;
 HEAP32[$1 + 12 >> 2] = $0;
 _embind_register_memory_view(4164, 2, HEAP32[$1 + 12 >> 2]);
 $0 = $1 + 16 | 0;
 if ($0 >>> 0 < global$2 >>> 0) {
  __handle_stack_overflow();
 }
 global$0 = $0;
}
function void_20_28anonymous_20namespace_29__register_memory_view_float__28char_20const__29() {
 var $0 = 0, $1 = 0;
 $0 = global$0 - 16 | 0;
 $1 = $0;
 if ($0 >>> 0 < global$2 >>> 0) {
  __handle_stack_overflow();
 }
 global$0 = $1;
 HEAP32[$0 + 12 >> 2] = 3813;
 _embind_register_memory_view(4404, 6, HEAP32[$0 + 12 >> 2]);
 $0 = $0 + 16 | 0;
 if ($0 >>> 0 < global$2 >>> 0) {
  __handle_stack_overflow();
 }
 global$0 = $0;
}
function void_20_28anonymous_20namespace_29__register_memory_view_long__28char_20const__29() {
 var $0 = 0, $1 = 0;
 $0 = global$0 - 16 | 0;
 $1 = $0;
 if ($0 >>> 0 < global$2 >>> 0) {
  __handle_stack_overflow();
 }
 global$0 = $1;
 HEAP32[$0 + 12 >> 2] = 3545;
 _embind_register_memory_view(4324, 4, HEAP32[$0 + 12 >> 2]);
 $0 = $0 + 16 | 0;
 if ($0 >>> 0 < global$2 >>> 0) {
  __handle_stack_overflow();
 }
 global$0 = $0;
}
function void_20_28anonymous_20namespace_29__register_memory_view_char__28char_20const__29() {
 var $0 = 0, $1 = 0;
 $0 = global$0 - 16 | 0;
 $1 = $0;
 if ($0 >>> 0 < global$2 >>> 0) {
  __handle_stack_overflow();
 }
 global$0 = $1;
 HEAP32[$0 + 12 >> 2] = 3301;
 _embind_register_memory_view(4084, 0, HEAP32[$0 + 12 >> 2]);
 $0 = $0 + 16 | 0;
 if ($0 >>> 0 < global$2 >>> 0) {
  __handle_stack_overflow();
 }
 global$0 = $0;
}
function __cxxabiv1____base_class_type_info__search_below_dst_28__cxxabiv1____dynamic_cast_info__2c_20void_20const__2c_20int_2c_20bool_29_20const($0, $1, $2, $3, $4) {
 var $5 = 0, $6 = 0, $7 = 0;
 $5 = HEAP32[$0 + 4 >> 2];
 $6 = $5 >> 8;
 $0 = HEAP32[$0 >> 2];
 $7 = $0;
 if ($5 & 1) {
  $6 = HEAP32[HEAP32[$2 >> 2] + $6 >> 2];
 }
 FUNCTION_TABLE[HEAP32[HEAP32[$0 >> 2] + 24 >> 2]]($7, $1, $2 + $6 | 0, $5 & 2 ? $3 : 2, $4);
}
function void_20_28anonymous_20namespace_29__register_memory_view_int__28char_20const__29($0) {
 var $1 = 0, $2 = 0;
 $1 = global$0 - 16 | 0;
 $2 = $1;
 if ($1 >>> 0 < global$2 >>> 0) {
  __handle_stack_overflow();
 }
 global$0 = $2;
 HEAP32[$1 + 12 >> 2] = $0;
 _embind_register_memory_view(4244, 4, HEAP32[$1 + 12 >> 2]);
 $0 = $1 + 16 | 0;
 if ($0 >>> 0 < global$2 >>> 0) {
  __handle_stack_overflow();
 }
 global$0 = $0;
}
function void_20_28anonymous_20namespace_29__register_float_double__28char_20const__29() {
 var $0 = 0, $1 = 0;
 $0 = global$0 - 16 | 0;
 $1 = $0;
 if ($0 >>> 0 < global$2 >>> 0) {
  __handle_stack_overflow();
 }
 global$0 = $1;
 HEAP32[$0 + 12 >> 2] = 3220;
 _embind_register_float(2856, HEAP32[$0 + 12 >> 2], 8);
 $0 = $0 + 16 | 0;
 if ($0 >>> 0 < global$2 >>> 0) {
  __handle_stack_overflow();
 }
 global$0 = $0;
}
function void_20_28anonymous_20namespace_29__register_float_float__28char_20const__29() {
 var $0 = 0, $1 = 0;
 $0 = global$0 - 16 | 0;
 $1 = $0;
 if ($0 >>> 0 < global$2 >>> 0) {
  __handle_stack_overflow();
 }
 global$0 = $1;
 HEAP32[$0 + 12 >> 2] = 3214;
 _embind_register_float(2844, HEAP32[$0 + 12 >> 2], 4);
 $0 = $0 + 16 | 0;
 if ($0 >>> 0 < global$2 >>> 0) {
  __handle_stack_overflow();
 }
 global$0 = $0;
}
function emscripten__internal__MethodInvoker_void_20_28LzxDecoder____29_28_29_2c_20void_2c_20LzxDecoder____invoke_28void_20_28LzxDecoder____20const__29_28_29_2c_20LzxDecoder__29($0, $1) {
 $0 = $0 | 0;
 $1 = $1 | 0;
 var $2 = 0, $3 = 0;
 $2 = HEAP32[$0 >> 2];
 $0 = HEAP32[$0 + 4 >> 2];
 $1 = ($0 >> 1) + $1 | 0;
 $3 = $1;
 if ($0 & 1) {
  $2 = HEAP32[$2 + HEAP32[$1 >> 2] >> 2];
 }
 FUNCTION_TABLE[$2]($3);
}
function _ZN17compiler_builtins3int3mul3Mul3mul17h070e9a1c69faec5bE($0, $1) {
 var $2 = 0, $3 = 0, $4 = 0;
 $2 = $1 >>> 16;
 $3 = $0 >>> 16;
 $1 = $1 & 65535;
 $0 = $0 & 65535;
 $4 = Math_imul($1, $0);
 $1 = ($4 >>> 16) + Math_imul($1, $3) | 0;
 $0 = ($1 & 65535) + Math_imul($0, $2) | 0;
 i64toi32_i32$HIGH_BITS = (Math_imul($2, $3) + ($1 >>> 16) | 0) + ($0 >>> 16) | 0;
 return $4 & 65535 | $0 << 16;
}
function strcmp($0, $1) {
 var $2 = 0, $3 = 0;
 $2 = HEAPU8[$0 | 0];
 $3 = HEAPU8[$1 | 0];
 label$1 : {
  if (!$2 | ($2 | 0) != ($3 | 0)) {
   break label$1;
  }
  while (1) {
   $3 = HEAPU8[$1 + 1 | 0];
   $2 = HEAPU8[$0 + 1 | 0];
   if (!$2) {
    break label$1;
   }
   $1 = $1 + 1 | 0;
   $0 = $0 + 1 | 0;
   if (($2 | 0) == ($3 | 0)) {
    continue;
   }
   break;
  }
 }
 return $2 - $3 | 0;
}
function dlcalloc($0, $1) {
 var $2 = 0, $3 = 0;
 $2 = 0;
 label$2 : {
  if (!$0) {
   break label$2;
  }
  $3 = _ZN17compiler_builtins3int3mul3Mul3mul17h070e9a1c69faec5bE($0, $1);
  $2 = $3;
  if (($0 | $1) >>> 0 < 65536) {
   break label$2;
  }
  $2 = i64toi32_i32$HIGH_BITS ? -1 : $3;
 }
 $1 = $2;
 $0 = dlmalloc($1);
 if (!(!$0 | !(HEAPU8[$0 + -4 | 0] & 3))) {
  memset($0, $1);
 }
 return $0;
}
function emscripten__internal__VectorAccess_std____2__vector_unsigned_20char_2c_20std____2__allocator_unsigned_20char__20__20___set_28std____2__vector_unsigned_20char_2c_20std____2__allocator_unsigned_20char__20___2c_20unsigned_20long_2c_20unsigned_20char_20const__29($0, $1, $2) {
 $0 = $0 | 0;
 $1 = $1 | 0;
 $2 = $2 | 0;
 HEAP8[HEAP32[$0 >> 2] + $1 | 0] = HEAPU8[$2 | 0];
 return 1;
}
function __getTypeName($0) {
 $0 = $0 | 0;
 var $1 = 0, $2 = 0;
 $1 = global$0 - 16 | 0;
 $2 = $1;
 if ($1 >>> 0 < global$2 >>> 0) {
  __handle_stack_overflow();
 }
 global$0 = $2;
 HEAP32[$1 + 12 >> 2] = $0;
 $0 = __strdup(HEAP32[HEAP32[$1 + 12 >> 2] + 4 >> 2]);
 $1 = $1 + 16 | 0;
 if ($1 >>> 0 < global$2 >>> 0) {
  __handle_stack_overflow();
 }
 global$0 = $1;
 return $0 | 0;
}
function std____2__vector_unsigned_20char_2c_20std____2__allocator_unsigned_20char__20___20emscripten__internal__operator_new_std____2__vector_unsigned_20char_2c_20std____2__allocator_unsigned_20char__20__20__28_29() {
 var $0 = 0;
 $0 = operator_20new_28unsigned_20long_29(12);
 HEAP32[$0 >> 2] = 0;
 HEAP32[$0 + 4 >> 2] = 0;
 HEAP32[$0 + 8 >> 2] = 0;
 return $0 | 0;
}
function void_20emscripten__internal__raw_destructor_std____2__vector_unsigned_20char_2c_20std____2__allocator_unsigned_20char__20__20__28std____2__vector_unsigned_20char_2c_20std____2__allocator_unsigned_20char__20___29($0) {
 $0 = $0 | 0;
 var $1 = 0;
 if ($0) {
  $1 = HEAP32[$0 >> 2];
  if ($1) {
   HEAP32[$0 + 4 >> 2] = $1;
   dlfree($1);
  }
  dlfree($0);
 }
}
function sbrk($0) {
 var $1 = 0;
 $1 = HEAP32[1248];
 $0 = $1 + $0 | 0;
 if (($0 | 0) <= -1) {
  HEAP32[1114] = 48;
  return -1;
 }
 label$2 : {
  if ($0 >>> 0 <= __wasm_memory_size() << 16 >>> 0) {
   break label$2;
  }
  if (emscripten_resize_heap($0 | 0)) {
   break label$2;
  }
  HEAP32[1114] = 48;
  return -1;
 }
 HEAP32[1248] = $0;
 return $1;
}
function void_20emscripten__internal__MemberAccess_LzxDecoder__DecodeOutput_2c_20int___setWire_LzxDecoder__DecodeOutput__28int_20LzxDecoder__DecodeOutput____20const__2c_20LzxDecoder__DecodeOutput__2c_20int_29($0, $1, $2) {
 $0 = $0 | 0;
 $1 = $1 | 0;
 $2 = $2 | 0;
 HEAP32[HEAP32[$0 >> 2] + $1 >> 2] = $2;
}
function operator_20new_28unsigned_20long_29($0) {
 var $1 = 0, $2 = 0;
 $0 = $0 ? $0 : 1;
 while (1) {
  label$2 : {
   $1 = dlmalloc($0);
   if ($1) {
    break label$2;
   }
   $2 = HEAP32[1119];
   if (!$2) {
    break label$2;
   }
   FUNCTION_TABLE[$2]();
   continue;
  }
  break;
 }
 return $1;
}
function int_20emscripten__internal__MemberAccess_LzxDecoder__DecodeOutput_2c_20int___getWire_LzxDecoder__DecodeOutput__28int_20LzxDecoder__DecodeOutput____20const__2c_20LzxDecoder__DecodeOutput_20const__29($0, $1) {
 $0 = $0 | 0;
 $1 = $1 | 0;
 return HEAP32[HEAP32[$0 >> 2] + $1 >> 2];
}
function emscripten__internal__Invoker_std____2__vector_unsigned_20char_2c_20std____2__allocator_unsigned_20char__20_____invoke_28std____2__vector_unsigned_20char_2c_20std____2__allocator_unsigned_20char__20___20_28__29_28_29_29($0) {
 $0 = $0 | 0;
 return FUNCTION_TABLE[$0]() | 0;
}
function allocVectorBYTE_28int_29($0, $1) {
 $0 = $0 | 0;
 $1 = $1 | 0;
 HEAP32[$0 >> 2] = 0;
 HEAP32[$0 + 4 >> 2] = 0;
 HEAP32[$0 + 8 >> 2] = 0;
 if ($1) {
  std____2__vector_unsigned_20char_2c_20std____2__allocator_unsigned_20char__20_____append_28unsigned_20long_29($0, $1);
 }
}
function __cxxabiv1____fundamental_type_info__can_catch_28__cxxabiv1____shim_type_info_20const__2c_20void___29_20const($0, $1, $2) {
 $0 = $0 | 0;
 $1 = $1 | 0;
 $2 = $2 | 0;
 return is_equal_28std__type_info_20const__2c_20std__type_info_20const__2c_20bool_29($0, $1, 0) | 0;
}
function void_20emscripten__internal__raw_destructor_LzxDecoder__28LzxDecoder__29($0) {
 $0 = $0 | 0;
 var $1 = 0;
 if ($0) {
  lzx_decode_free_28lzx_stream__29($0);
  $1 = HEAP32[$0 + 56 >> 2];
  if ($1) {
   HEAP32[$0 + 60 >> 2] = $1;
   dlfree($1);
  }
  dlfree($0);
 }
}
function void_20const__20emscripten__internal__getActualType_std____2__vector_unsigned_20char_2c_20std____2__allocator_unsigned_20char__20__20__28std____2__vector_unsigned_20char_2c_20std____2__allocator_unsigned_20char__20___29($0) {
 $0 = $0 | 0;
 return 1564;
}
function is_equal_28std__type_info_20const__2c_20std__type_info_20const__2c_20bool_29($0, $1, $2) {
 if (!$2) {
  return ($0 | 0) == ($1 | 0);
 }
 return !strcmp(HEAP32[$0 + 4 >> 2], HEAP32[$1 + 4 >> 2]);
}
function dynCall_viiiiii($0, $1, $2, $3, $4, $5, $6) {
 $0 = $0 | 0;
 $1 = $1 | 0;
 $2 = $2 | 0;
 $3 = $3 | 0;
 $4 = $4 | 0;
 $5 = $5 | 0;
 $6 = $6 | 0;
 FUNCTION_TABLE[$0]($1, $2, $3, $4, $5, $6);
}
function stackAlloc($0) {
 $0 = $0 | 0;
 var $1 = 0;
 $0 = global$0 - $0 & -16;
 $1 = $0;
 if ($0 >>> 0 < global$2 >>> 0) {
  __handle_stack_overflow();
 }
 global$0 = $1;
 return $0 | 0;
}
function std____2__vector_unsigned_20char_2c_20std____2__allocator_unsigned_20char__20___size_28_29_20const($0) {
 $0 = $0 | 0;
 return HEAP32[$0 + 4 >> 2] - HEAP32[$0 >> 2] | 0;
}
function dynCall_viiiii($0, $1, $2, $3, $4, $5) {
 $0 = $0 | 0;
 $1 = $1 | 0;
 $2 = $2 | 0;
 $3 = $3 | 0;
 $4 = $4 | 0;
 $5 = $5 | 0;
 FUNCTION_TABLE[$0]($1, $2, $3, $4, $5);
}
function dynCall_iiiii($0, $1, $2, $3, $4) {
 $0 = $0 | 0;
 $1 = $1 | 0;
 $2 = $2 | 0;
 $3 = $3 | 0;
 $4 = $4 | 0;
 return FUNCTION_TABLE[$0]($1, $2, $3, $4) | 0;
}
function LzxDecoder__20emscripten__internal__operator_new_LzxDecoder__28_29() {
 return LzxDecoder__LzxDecoder_28_29(operator_20new_28unsigned_20long_29(72)) | 0;
}
function legalstub$dynCall_ji($0, $1) {
 $0 = $0 | 0;
 $1 = $1 | 0;
 $0 = FUNCTION_TABLE[$0]($1) | 0;
 setTempRet0(i64toi32_i32$HIGH_BITS | 0);
 return $0 | 0;
}
function void_20emscripten__internal__raw_destructor_LzxDecoder__DecodeOutput__28LzxDecoder__DecodeOutput__29($0) {
 $0 = $0 | 0;
 if ($0) {
  dlfree($0);
 }
}
function dynCall_viiii($0, $1, $2, $3, $4) {
 $0 = $0 | 0;
 $1 = $1 | 0;
 $2 = $2 | 0;
 $3 = $3 | 0;
 $4 = $4 | 0;
 FUNCTION_TABLE[$0]($1, $2, $3, $4);
}
function std____2____vector_base_common_true_____throw_length_error_28_29_20const() {
 std____2____throw_length_error_28char_20const__29();
 abort();
}
function __strdup($0) {
 var $1 = 0, $2 = 0;
 $1 = strlen($0) + 1 | 0;
 $2 = dlmalloc($1);
 if (!$2) {
  return 0;
 }
 return memcpy($2, $0, $1);
}
function LzxDecoder__getTotalOut_28_29_20const($0) {
 $0 = $0 | 0;
 i64toi32_i32$HIGH_BITS = HEAP32[$0 + 44 >> 2];
 return HEAP32[$0 + 40 >> 2];
}
function LzxDecoder__cleanupBitstream_28_29($0) {
 $0 = $0 | 0;
 $0 = HEAP32[$0 + 48 >> 2];
 HEAP8[$0 + 93 | 0] = 0;
 HEAP32[$0 + 88 >> 2] = 0;
}
function dynCall_iiii($0, $1, $2, $3) {
 $0 = $0 | 0;
 $1 = $1 | 0;
 $2 = $2 | 0;
 $3 = $3 | 0;
 return FUNCTION_TABLE[$0]($1, $2, $3) | 0;
}
function LzxDecoder__init_28int_29($0, $1) {
 $0 = $0 | 0;
 $1 = $1 | 0;
 return lzx_decode_init_28lzx_stream__2c_20int_29($0, $1) | 0;
}
function __wasm_rotl_i32($0) {
 var $1 = 0;
 $1 = $0 & 31;
 $0 = 0 - $0 & 31;
 return (-1 >>> $1 & -2) << $1 | (-1 << $0 & -2) >>> $0;
}
function dynCall_viii($0, $1, $2, $3) {
 $0 = $0 | 0;
 $1 = $1 | 0;
 $2 = $2 | 0;
 $3 = $3 | 0;
 FUNCTION_TABLE[$0]($1, $2, $3);
}
function void_20const__20emscripten__internal__getActualType_LzxDecoder__28LzxDecoder__29($0) {
 $0 = $0 | 0;
 return 1888;
}
function stackRestore($0) {
 $0 = $0 | 0;
 if ($0 >>> 0 < global$2 >>> 0) {
  __handle_stack_overflow();
 }
 global$0 = $0;
}
function setThrew($0, $1) {
 $0 = $0 | 0;
 $1 = $1 | 0;
 if (!HEAP32[1245]) {
  HEAP32[1246] = $1;
  HEAP32[1245] = $0;
 }
}
function dynCall_iii($0, $1, $2) {
 $0 = $0 | 0;
 $1 = $1 | 0;
 $2 = $2 | 0;
 return FUNCTION_TABLE[$0]($1, $2) | 0;
}
function __cxxabiv1____fundamental_type_info_____fundamental_type_info_28_29($0) {
 $0 = $0 | 0;
 dlfree($0);
}
function dynCall_vii($0, $1, $2) {
 $0 = $0 | 0;
 $1 = $1 | 0;
 $2 = $2 | 0;
 FUNCTION_TABLE[$0]($1, $2);
}
function __cxxabiv1____shim_type_info_____shim_type_info_28_29($0) {
 $0 = $0 | 0;
 return $0 | 0;
}
function dynCall_ii($0, $1) {
 $0 = $0 | 0;
 $1 = $1 | 0;
 return FUNCTION_TABLE[$0]($1) | 0;
}
function std____2____throw_length_error_28char_20const__29() {
 abort();
 abort();
}
function dynCall_vi($0, $1) {
 $0 = $0 | 0;
 $1 = $1 | 0;
 FUNCTION_TABLE[$0]($1);
}
function __growWasmMemory($0) {
 $0 = $0 | 0;
 return abort() | 0;
}
function __set_stack_limit($0) {
 $0 = $0 | 0;
 global$2 = $0;
}
function std__uncaught_exception_28_29() {
 return 0;
}
function stackSave() {
 return global$0 | 0;
}
function __errno_location() {
 return 4456;
}
function __unlockfile($0) {
 $0 = $0 | 0;
}

// EMSCRIPTEN_END_FUNCS

 FUNCTION_TABLE[1] = void_20const__20emscripten__internal__getActualType_std____2__vector_unsigned_20char_2c_20std____2__allocator_unsigned_20char__20__20__28std____2__vector_unsigned_20char_2c_20std____2__allocator_unsigned_20char__20___29;
 FUNCTION_TABLE[2] = void_20emscripten__internal__raw_destructor_std____2__vector_unsigned_20char_2c_20std____2__allocator_unsigned_20char__20__20__28std____2__vector_unsigned_20char_2c_20std____2__allocator_unsigned_20char__20___29;
 FUNCTION_TABLE[3] = emscripten__internal__Invoker_std____2__vector_unsigned_20char_2c_20std____2__allocator_unsigned_20char__20_____invoke_28std____2__vector_unsigned_20char_2c_20std____2__allocator_unsigned_20char__20___20_28__29_28_29_29;
 FUNCTION_TABLE[4] = std____2__vector_unsigned_20char_2c_20std____2__allocator_unsigned_20char__20___20emscripten__internal__operator_new_std____2__vector_unsigned_20char_2c_20std____2__allocator_unsigned_20char__20__20__28_29;
 FUNCTION_TABLE[5] = std____2__vector_unsigned_20char_2c_20std____2__allocator_unsigned_20char__20___push_back_28unsigned_20char_20const__29;
 FUNCTION_TABLE[6] = emscripten__internal__MethodInvoker_void_20_28std____2__vector_unsigned_20char_2c_20std____2__allocator_unsigned_20char__20_____29_28unsigned_20char_20const__29_2c_20void_2c_20std____2__vector_unsigned_20char_2c_20std____2__allocator_unsigned_20char__20___2c_20unsigned_20char_20const____invoke_28void_20_28std____2__vector_unsigned_20char_2c_20std____2__allocator_unsigned_20char__20_____20const__29_28unsigned_20char_20const__29_2c_20std____2__vector_unsigned_20char_2c_20std____2__allocator_unsigned_20char__20___2c_20unsigned_20char_29;
 FUNCTION_TABLE[7] = std____2__vector_unsigned_20char_2c_20std____2__allocator_unsigned_20char__20___resize_28unsigned_20long_2c_20unsigned_20char_20const__29;
 FUNCTION_TABLE[8] = emscripten__internal__MethodInvoker_void_20_28std____2__vector_unsigned_20char_2c_20std____2__allocator_unsigned_20char__20_____29_28unsigned_20long_2c_20unsigned_20char_20const__29_2c_20void_2c_20std____2__vector_unsigned_20char_2c_20std____2__allocator_unsigned_20char__20___2c_20unsigned_20long_2c_20unsigned_20char_20const____invoke_28void_20_28std____2__vector_unsigned_20char_2c_20std____2__allocator_unsigned_20char__20_____20const__29_28unsigned_20long_2c_20unsigned_20char_20const__29_2c_20std____2__vector_unsigned_20char_2c_20std____2__allocator_unsigned_20char__20___2c_20unsigned_20long_2c_20unsigned_20char_29;
 FUNCTION_TABLE[9] = std____2__vector_unsigned_20char_2c_20std____2__allocator_unsigned_20char__20___size_28_29_20const;
 FUNCTION_TABLE[10] = emscripten__internal__MethodInvoker_unsigned_20long_20_28std____2__vector_unsigned_20char_2c_20std____2__allocator_unsigned_20char__20_____29_28_29_20const_2c_20unsigned_20long_2c_20std____2__vector_unsigned_20char_2c_20std____2__allocator_unsigned_20char__20__20const____invoke_28unsigned_20long_20_28std____2__vector_unsigned_20char_2c_20std____2__allocator_unsigned_20char__20_____20const__29_28_29_20const_2c_20std____2__vector_unsigned_20char_2c_20std____2__allocator_unsigned_20char__20__20const__29;
 FUNCTION_TABLE[11] = emscripten__internal__VectorAccess_std____2__vector_unsigned_20char_2c_20std____2__allocator_unsigned_20char__20__20___get_28std____2__vector_unsigned_20char_2c_20std____2__allocator_unsigned_20char__20__20const__2c_20unsigned_20long_29;
 FUNCTION_TABLE[12] = emscripten__internal__FunctionInvoker_emscripten__val_20_28__29_28std____2__vector_unsigned_20char_2c_20std____2__allocator_unsigned_20char__20__20const__2c_20unsigned_20long_29_2c_20emscripten__val_2c_20std____2__vector_unsigned_20char_2c_20std____2__allocator_unsigned_20char__20__20const__2c_20unsigned_20long___invoke_28emscripten__val_20_28___29_28std____2__vector_unsigned_20char_2c_20std____2__allocator_unsigned_20char__20__20const__2c_20unsigned_20long_29_2c_20std____2__vector_unsigned_20char_2c_20std____2__allocator_unsigned_20char__20___2c_20unsigned_20long_29;
 FUNCTION_TABLE[13] = emscripten__internal__VectorAccess_std____2__vector_unsigned_20char_2c_20std____2__allocator_unsigned_20char__20__20___set_28std____2__vector_unsigned_20char_2c_20std____2__allocator_unsigned_20char__20___2c_20unsigned_20long_2c_20unsigned_20char_20const__29;
 FUNCTION_TABLE[14] = emscripten__internal__FunctionInvoker_bool_20_28__29_28std____2__vector_unsigned_20char_2c_20std____2__allocator_unsigned_20char__20___2c_20unsigned_20long_2c_20unsigned_20char_20const__29_2c_20bool_2c_20std____2__vector_unsigned_20char_2c_20std____2__allocator_unsigned_20char__20___2c_20unsigned_20long_2c_20unsigned_20char_20const____invoke_28bool_20_28___29_28std____2__vector_unsigned_20char_2c_20std____2__allocator_unsigned_20char__20___2c_20unsigned_20long_2c_20unsigned_20char_20const__29_2c_20std____2__vector_unsigned_20char_2c_20std____2__allocator_unsigned_20char__20___2c_20unsigned_20long_2c_20unsigned_20char_29;
 FUNCTION_TABLE[15] = void_20const__20emscripten__internal__getActualType_LzxDecoder__28LzxDecoder__29;
 FUNCTION_TABLE[16] = void_20emscripten__internal__raw_destructor_LzxDecoder__28LzxDecoder__29;
 FUNCTION_TABLE[17] = emscripten__internal__Invoker_std____2__vector_unsigned_20char_2c_20std____2__allocator_unsigned_20char__20_____invoke_28std____2__vector_unsigned_20char_2c_20std____2__allocator_unsigned_20char__20___20_28__29_28_29_29;
 FUNCTION_TABLE[18] = LzxDecoder__20emscripten__internal__operator_new_LzxDecoder__28_29;
 FUNCTION_TABLE[19] = LzxDecoder__cleanupBitstream_28_29;
 FUNCTION_TABLE[20] = emscripten__internal__MethodInvoker_void_20_28LzxDecoder____29_28_29_2c_20void_2c_20LzxDecoder____invoke_28void_20_28LzxDecoder____20const__29_28_29_2c_20LzxDecoder__29;
 FUNCTION_TABLE[21] = LzxDecoder__init_28int_29;
 FUNCTION_TABLE[22] = emscripten__internal__MethodInvoker_int_20_28LzxDecoder____29_28int_29_2c_20int_2c_20LzxDecoder__2c_20int___invoke_28int_20_28LzxDecoder____20const__29_28int_29_2c_20LzxDecoder__2c_20int_29;
 FUNCTION_TABLE[23] = EmscriptenBindingInitializer_lzx_decoder_class__EmscriptenBindingInitializer_lzx_decoder_class_28_29__$_0____invoke_28LzxDecoder__2c_20emscripten__val_20const__2c_20int_29;
 FUNCTION_TABLE[24] = emscripten__internal__FunctionInvoker_LzxDecoder__DecodeOutput_20_28__29_28LzxDecoder__2c_20emscripten__val_20const__2c_20int_29_2c_20LzxDecoder__DecodeOutput_2c_20LzxDecoder__2c_20emscripten__val_20const__2c_20int___invoke_28LzxDecoder__DecodeOutput_20_28___29_28LzxDecoder__2c_20emscripten__val_20const__2c_20int_29_2c_20LzxDecoder__2c_20emscripten__internal___EM_VAL__2c_20int_29;
 FUNCTION_TABLE[25] = EmscriptenBindingInitializer_lzx_decoder_class__EmscriptenBindingInitializer_lzx_decoder_class_28_29__$_1____invoke_28LzxDecoder__2c_20emscripten__val_20const__29;
 FUNCTION_TABLE[26] = emscripten__internal__FunctionInvoker_emscripten__val_20_28__29_28LzxDecoder__2c_20emscripten__val_20const__29_2c_20emscripten__val_2c_20LzxDecoder__2c_20emscripten__val_20const____invoke_28emscripten__val_20_28___29_28LzxDecoder__2c_20emscripten__val_20const__29_2c_20LzxDecoder__2c_20emscripten__internal___EM_VAL__29;
 FUNCTION_TABLE[27] = LzxDecoder__outputBufferTranslation_28unsigned_20int_2c_20unsigned_20int_29;
 FUNCTION_TABLE[28] = emscripten__internal__MethodInvoker_void_20_28LzxDecoder____29_28unsigned_20int_2c_20unsigned_20int_29_2c_20void_2c_20LzxDecoder__2c_20unsigned_20int_2c_20unsigned_20int___invoke_28void_20_28LzxDecoder____20const__29_28unsigned_20int_2c_20unsigned_20int_29_2c_20LzxDecoder__2c_20unsigned_20int_2c_20unsigned_20int_29;
 FUNCTION_TABLE[29] = LzxDecoder__getTotalOut_28_29_20const;
 FUNCTION_TABLE[30] = long_20long__20emscripten__internal__GetterPolicy_long_20long_20_28LzxDecoder____29_28_29_20const___get_LzxDecoder__28long_20long_20_28LzxDecoder____20const__29_28_29_20const_2c_20LzxDecoder_20const__29;
 FUNCTION_TABLE[31] = std____2__vector_unsigned_20char_2c_20std____2__allocator_unsigned_20char__20___20emscripten__internal__operator_new_std____2__vector_unsigned_20char_2c_20std____2__allocator_unsigned_20char__20__20__28_29;
 FUNCTION_TABLE[32] = void_20emscripten__internal__raw_destructor_LzxDecoder__DecodeOutput__28LzxDecoder__DecodeOutput__29;
 FUNCTION_TABLE[33] = int_20emscripten__internal__MemberAccess_LzxDecoder__DecodeOutput_2c_20int___getWire_LzxDecoder__DecodeOutput__28int_20LzxDecoder__DecodeOutput____20const__2c_20LzxDecoder__DecodeOutput_20const__29;
 FUNCTION_TABLE[34] = void_20emscripten__internal__MemberAccess_LzxDecoder__DecodeOutput_2c_20int___setWire_LzxDecoder__DecodeOutput__28int_20LzxDecoder__DecodeOutput____20const__2c_20LzxDecoder__DecodeOutput__2c_20int_29;
 FUNCTION_TABLE[35] = emscripten__internal__Invoker_std____2__vector_unsigned_20char_2c_20std____2__allocator_unsigned_20char__20__2c_20int___invoke_28std____2__vector_unsigned_20char_2c_20std____2__allocator_unsigned_20char__20__20_28__29_28int_29_2c_20int_29;
 FUNCTION_TABLE[36] = allocVectorBYTE_28int_29;
 FUNCTION_TABLE[37] = __cxxabiv1____shim_type_info_____shim_type_info_28_29;
 FUNCTION_TABLE[38] = __cxxabiv1____fundamental_type_info_____fundamental_type_info_28_29;
 FUNCTION_TABLE[39] = __unlockfile;
 FUNCTION_TABLE[40] = __unlockfile;
 FUNCTION_TABLE[41] = __cxxabiv1____fundamental_type_info__can_catch_28__cxxabiv1____shim_type_info_20const__2c_20void___29_20const;
 FUNCTION_TABLE[42] = __cxxabiv1____fundamental_type_info_____fundamental_type_info_28_29;
 FUNCTION_TABLE[43] = __cxxabiv1____class_type_info__can_catch_28__cxxabiv1____shim_type_info_20const__2c_20void___29_20const;
 FUNCTION_TABLE[44] = __cxxabiv1____class_type_info__search_above_dst_28__cxxabiv1____dynamic_cast_info__2c_20void_20const__2c_20void_20const__2c_20int_2c_20bool_29_20const;
 FUNCTION_TABLE[45] = __cxxabiv1____class_type_info__search_below_dst_28__cxxabiv1____dynamic_cast_info__2c_20void_20const__2c_20int_2c_20bool_29_20const;
 FUNCTION_TABLE[46] = __cxxabiv1____class_type_info__has_unambiguous_public_base_28__cxxabiv1____dynamic_cast_info__2c_20void__2c_20int_29_20const;
 FUNCTION_TABLE[47] = __cxxabiv1____fundamental_type_info_____fundamental_type_info_28_29;
 FUNCTION_TABLE[48] = __cxxabiv1____si_class_type_info__search_above_dst_28__cxxabiv1____dynamic_cast_info__2c_20void_20const__2c_20void_20const__2c_20int_2c_20bool_29_20const;
 FUNCTION_TABLE[49] = __cxxabiv1____si_class_type_info__search_below_dst_28__cxxabiv1____dynamic_cast_info__2c_20void_20const__2c_20int_2c_20bool_29_20const;
 FUNCTION_TABLE[50] = __cxxabiv1____si_class_type_info__has_unambiguous_public_base_28__cxxabiv1____dynamic_cast_info__2c_20void__2c_20int_29_20const;
 FUNCTION_TABLE[51] = __cxxabiv1____fundamental_type_info_____fundamental_type_info_28_29;
 FUNCTION_TABLE[52] = __cxxabiv1____vmi_class_type_info__search_above_dst_28__cxxabiv1____dynamic_cast_info__2c_20void_20const__2c_20void_20const__2c_20int_2c_20bool_29_20const;
 FUNCTION_TABLE[53] = __cxxabiv1____vmi_class_type_info__search_below_dst_28__cxxabiv1____dynamic_cast_info__2c_20void_20const__2c_20int_2c_20bool_29_20const;
 FUNCTION_TABLE[54] = __cxxabiv1____vmi_class_type_info__has_unambiguous_public_base_28__cxxabiv1____dynamic_cast_info__2c_20void__2c_20int_29_20const;
 FUNCTION_TABLE[55] = __cxxabiv1____fundamental_type_info_____fundamental_type_info_28_29;
 FUNCTION_TABLE[56] = __cxxabiv1____pointer_type_info__can_catch_28__cxxabiv1____shim_type_info_20const__2c_20void___29_20const;
 FUNCTION_TABLE[57] = EmscriptenBindingInitializer_native_and_builtin_types__EmscriptenBindingInitializer_native_and_builtin_types_28_29;
 function __wasm_memory_size() {
  return buffer.byteLength / 65536 | 0;
}
 
 return {
  "__wasm_call_ctors": __wasm_call_ctors, 
  "free": dlfree, 
  "malloc": dlmalloc, 
  "fflush": fflush, 
  "__errno_location": __errno_location, 
  "setThrew": setThrew, 
  "_ZSt18uncaught_exceptionv": std__uncaught_exception_28_29, 
  "__getTypeName": __getTypeName, 
  "__embind_register_native_and_builtin_types": __embind_register_native_and_builtin_types, 
  "__set_stack_limit": __set_stack_limit, 
  "stackSave": stackSave, 
  "stackAlloc": stackAlloc, 
  "stackRestore": stackRestore, 
  "__growWasmMemory": __growWasmMemory, 
  "dynCall_ii": dynCall_ii, 
  "dynCall_vi": dynCall_vi, 
  "dynCall_i": emscripten__internal__Invoker_std____2__vector_unsigned_20char_2c_20std____2__allocator_unsigned_20char__20_____invoke_28std____2__vector_unsigned_20char_2c_20std____2__allocator_unsigned_20char__20___20_28__29_28_29_29, 
  "dynCall_vii": dynCall_vii, 
  "dynCall_viii": dynCall_viii, 
  "dynCall_viiii": dynCall_viiii, 
  "dynCall_iii": dynCall_iii, 
  "dynCall_iiii": dynCall_iiii, 
  "dynCall_iiiii": dynCall_iiiii, 
  "dynCall_ji": legalstub$dynCall_ji, 
  "dynCall_viiiiii": dynCall_viiiiii, 
  "dynCall_viiiii": dynCall_viiiii
};
}

var writeSegment = (
    function(mem) {
      var _mem = new Uint8Array(mem);
      return function(offset, s) {
        var bytes, i;
        if (typeof Buffer === 'undefined') {
          bytes = atob(s);
          for (i = 0; i < bytes.length; i++)
            _mem[offset + i] = bytes.charCodeAt(i);
        } else {
          bytes = Buffer.from(s, 'base64');
          for (i = 0; i < bytes.length; i++)
            _mem[offset + i] = bytes[i];
        }
      }
    }
  )(wasmMemory.buffer);
writeSegment(1024, "HgAAACAAAAAiAAAAJAAAACYAAAAqAAAAMgAAAEIAAABiAAAAogAAACIB");
writeSegment(1076, "AQAAAAMAAAAHAAAADwAAAB8AAAA/AAAAfwAAAP8AAAD/AQAA/wMAAP8HAAD/DwAA/x8AAP8/AAD/fwAA//8AAP//AQD//wMA//8HAP//DwD//x8A//8/AP//fwD///8A////Af///wP///8H////D////x////8/////f/////////////////////9WZWN0b3JCWVRFAGFsbG9jVmVjdG9yQllURQBMenhEZWNvZGVyAGNsZWFudXBCaXRzdHJlYW0AaW5pdABkZWNvZGUAZ2V0T3V0cHV0QnVmZmVyAG91dHB1dEJ1ZmZlclRyYW5zbGF0aW9uAHRvdGFsT3V0AEx6eERlY29kZXI6OkRlY29kZU91dHB1dAByZXN1bHQAaW5fYnl0ZXMAb3V0X2J5dGVzAHB1c2hfYmFjawByZXNpemUAc2l6ZQBnZXQAc2V0AE5TdDNfXzI2dmVjdG9ySWhOU185YWxsb2NhdG9ySWhFRUVFAE5TdDNfXzIxM19fdmVjdG9yX2Jhc2VJaE5TXzlhbGxvY2F0b3JJaEVFRUUATlN0M19fMjIwX192ZWN0b3JfYmFzZV9jb21tb25JTGIxRUVFAAAAOAsAANUFAAC8CwAAqQUAAAAAAAABAAAA/AUAAAAAAAC8CwAAhQUAAAAAAAABAAAABAYAAAAAAABQTlN0M19fMjZ2ZWN0b3JJaE5TXzlhbGxvY2F0b3JJaEVFRUUAAAAAGAwAADQGAAAAAAAAHAYAAFBLTlN0M19fMjZ2ZWN0b3JJaE5TXzlhbGxvY2F0b3JJaEVFRUUAAAAYDAAAbAYAAAEAAAAcBgAAaWkAdgB2aQBcBgAAgAoAAFwGAACwCgAAdmlpaQ==");
writeSegment(1744, "gAoAAFwGAAAECwAAsAoAAHZpaWlpAAAABAsAAJQGAABpaWkAFAcAABwGAAAECwAATjEwZW1zY3JpcHRlbjN2YWxFAAA4CwAAAAcAAGlpaWk=");
writeSegment(1840, "mAoAABwGAAAECwAAsAoAAGlpaWlpAAAAHAYAAOAKAAAxMEx6eERlY29kZXIAAAAAOAsAAFAHAABQMTBMenhEZWNvZGVyAAAAGAwAAGgHAAAAAAAAYAcAAFBLMTBMenhEZWNvZGVyAAAYDAAAiAcAAAEAAABgBwAAeAcAAIAKAAB4BwAAdmlpAOAKAAB4BwAA4AoAAE5TdDNfXzIxMmJhc2ljX3N0cmluZ0ljTlNfMTFjaGFyX3RyYWl0c0ljRUVOU185YWxsb2NhdG9ySWNFRUVFAE5TdDNfXzIyMV9fYmFzaWNfc3RyaW5nX2NvbW1vbklMYjFFRUUAAAAAOAsAAAMIAAC8CwAAxAcAAAAAAAABAAAALAg=");
writeSegment(2128, "gAgAAGAHAAAUBwAA4AoAAE4xMEx6eERlY29kZXIxMkRlY29kZU91dHB1dEUAAAAAOAsAAGAIAABOMTBlbXNjcmlwdGVuMTFtZW1vcnlfdmlld0loRUUAADgLAACICAAAFAcAAGAHAAAUBwAAAAAAAIAKAAB4BwAA7AoAAOwKAABpAGJhc2ljX3N0cmluZwB2ZWN0b3IAU3Q5dHlwZV9pbmZvAAA4CwAA5ggAAE4xMF9fY3h4YWJpdjExNl9fc2hpbV90eXBlX2luZm9FAAAAAGALAAD8CAAA9AgAAE4xMF9fY3h4YWJpdjExN19fY2xhc3NfdHlwZV9pbmZvRQAAAGALAAAsCQAAIAkAAE4xMF9fY3h4YWJpdjExN19fcGJhc2VfdHlwZV9pbmZvRQAAAGALAABcCQAAIAkAAE4xMF9fY3h4YWJpdjExOV9fcG9pbnRlcl90eXBlX2luZm9FAGALAACMCQAAgAkAAE4xMF9fY3h4YWJpdjEyMF9fZnVuY3Rpb25fdHlwZV9pbmZvRQAAAABgCwAAvAkAACAJAABOMTBfX2N4eGFiaXYxMjlfX3BvaW50ZXJfdG9fbWVtYmVyX3R5cGVfaW5mb0UAAABgCwAA8AkAAIAJAAAAAAAAcAoAACUAAAAmAAAAJwAAACgAAAApAAAATjEwX19jeHhhYml2MTIzX19mdW5kYW1lbnRhbF90eXBlX2luZm9FAGALAABICgAAIAkAAHYAAAA0CgAAfAoAAERuAAA0CgAAiAoAAGIAAAA0CgAAlAoAAGMAAAA0CgAAoAoAAGgAAAA0CgAArAoAAGEAAAA0CgAAuAoAAHMAAAA0CgAAxAoAAHQAAAA0CgAA0AoAAGkAAAA0CgAA3AoAAGoAAAA0CgAA6AoAAGwAAAA0CgAA9AoAAG0AAAA0CgAAAAsAAHgAAAA0CgAADAsAAGYAAAA0CgAAGAsAAGQAAAA0CgAAJAsAAAAAAABQCQAAJQAAACoAAAAnAAAAKAAAACsAAAAsAAAALQAAAC4AAAAAAAAAqAsAACUAAAAvAAAAJwAAACgAAAArAAAAMAAAADEAAAAyAAAATjEwX19jeHhhYml2MTIwX19zaV9jbGFzc190eXBlX2luZm9FAAAAAGALAACACwAAUAkAAAAAAAAEDAAAJQAAADMAAAAnAAAAKAAAACsAAAA0AAAANQAAADYAAABOMTBfX2N4eGFiaXYxMjFfX3ZtaV9jbGFzc190eXBlX2luZm9FAAAAYAsAANwLAABQCQAAAAAAALAJAAAlAAAANwAAACcAAAAoAAAAOAAAAHZvaWQAYm9vbABjaGFyAHNpZ25lZCBjaGFyAHVuc2lnbmVkIGNoYXIAc2hvcnQAdW5zaWduZWQgc2hvcnQAaW50AHVuc2lnbmVkIGludABsb25nAHVuc2lnbmVkIGxvbmcAZmxvYXQAZG91YmxlAHN0ZDo6c3RyaW5nAHN0ZDo6YmFzaWNfc3RyaW5nPHVuc2lnbmVkIGNoYXI+AHN0ZDo6d3N0cmluZwBlbXNjcmlwdGVuOjp2YWwAZW1zY3JpcHRlbjo6bWVtb3J5X3ZpZXc8Y2hhcj4AZW1zY3JpcHRlbjo6bWVtb3J5X3ZpZXc8c2lnbmVkIGNoYXI+AGVtc2NyaXB0ZW46Om1lbW9yeV92aWV3PHVuc2lnbmVkIGNoYXI+AGVtc2NyaXB0ZW46Om1lbW9yeV92aWV3PHNob3J0PgBlbXNjcmlwdGVuOjptZW1vcnlfdmlldzx1bnNpZ25lZCBzaG9ydD4AZW1zY3JpcHRlbjo6bWVtb3J5X3ZpZXc8aW50PgBlbXNjcmlwdGVuOjptZW1vcnlfdmlldzx1bnNpZ25lZCBpbnQ+AGVtc2NyaXB0ZW46Om1lbW9yeV92aWV3PGxvbmc+AGVtc2NyaXB0ZW46Om1lbW9yeV92aWV3PHVuc2lnbmVkIGxvbmc+AGVtc2NyaXB0ZW46Om1lbW9yeV92aWV3PGludDhfdD4AZW1zY3JpcHRlbjo6bWVtb3J5X3ZpZXc8dWludDhfdD4AZW1zY3JpcHRlbjo6bWVtb3J5X3ZpZXc8aW50MTZfdD4AZW1zY3JpcHRlbjo6bWVtb3J5X3ZpZXc8dWludDE2X3Q+AGVtc2NyaXB0ZW46Om1lbW9yeV92aWV3PGludDMyX3Q+AGVtc2NyaXB0ZW46Om1lbW9yeV92aWV3PHVpbnQzMl90PgBlbXNjcmlwdGVuOjptZW1vcnlfdmlldzxmbG9hdD4AZW1zY3JpcHRlbjo6bWVtb3J5X3ZpZXc8ZG91YmxlPgBOU3QzX18yMTJiYXNpY19zdHJpbmdJaE5TXzExY2hhcl90cmFpdHNJaEVFTlNfOWFsbG9jYXRvckloRUVFRQAAvAsAACQPAAAAAAAAAQAAACwIAAAAAAAATlN0M19fMjEyYmFzaWNfc3RyaW5nSXdOU18xMWNoYXJfdHJhaXRzSXdFRU5TXzlhbGxvY2F0b3JJd0VFRUUAALwLAAB8DwAAAAAAAAEAAAAsCAAAAAAAAE4xMGVtc2NyaXB0ZW4xMW1lbW9yeV92aWV3SWNFRQAAOAsAANQPAABOMTBlbXNjcmlwdGVuMTFtZW1vcnlfdmlld0lhRUUAADgLAAD8DwAATjEwZW1zY3JpcHRlbjExbWVtb3J5X3ZpZXdJc0VFAAA4CwAAJBAAAE4xMGVtc2NyaXB0ZW4xMW1lbW9yeV92aWV3SXRFRQAAOAsAAEwQAABOMTBlbXNjcmlwdGVuMTFtZW1vcnlfdmlld0lpRUUAADgLAAB0EAAATjEwZW1zY3JpcHRlbjExbWVtb3J5X3ZpZXdJakVFAAA4CwAAnBAAAE4xMGVtc2NyaXB0ZW4xMW1lbW9yeV92aWV3SWxFRQAAOAsAAMQQAABOMTBlbXNjcmlwdGVuMTFtZW1vcnlfdmlld0ltRUUAADgLAADsEAAATjEwZW1zY3JpcHRlbjExbWVtb3J5X3ZpZXdJZkVFAAA4CwAAFBEAAE4xMGVtc2NyaXB0ZW4xMW1lbW9yeV92aWV3SWRFRQAAOAsAADwR");
return asmFunc({
    'Int8Array': Int8Array,
    'Int16Array': Int16Array,
    'Int32Array': Int32Array,
    'Uint8Array': Uint8Array,
    'Uint16Array': Uint16Array,
    'Uint32Array': Uint32Array,
    'Float32Array': Float32Array,
    'Float64Array': Float64Array,
    'NaN': NaN,
    'Infinity': Infinity,
    'Math': Math
  },
  asmLibraryArg,
  wasmMemory.buffer
)

}// EMSCRIPTEN_END_ASM




)(asmLibraryArg, wasmMemory, wasmTable);
    return {
      'exports': exports
    };
  },

  instantiate: function(binary, info) {
    return {
      then: function(ok, err) {
        ok({
          'instance': new WebAssembly.Instance(new WebAssembly.Module(binary, info))
        });
      }
    };
  },

  RuntimeError: Error
};

// We don't need to actually download a wasm binary, mark it as present but empty.
wasmBinary = [];




if (typeof WebAssembly !== 'object') {
  abort('No WebAssembly support found. Build with -s WASM=0 to target JavaScript instead.');
}


// In MINIMAL_RUNTIME, setValue() and getValue() are only available when building with safe heap enabled, for heap safety checking.
// In traditional runtime, setValue() and getValue() are always available (although their use is highly discouraged due to perf penalties)

/** @type {function(number, number, string, boolean=)} */
function setValue(ptr, value, type, noSafe) {
  type = type || 'i8';
  if (type.charAt(type.length-1) === '*') type = 'i32'; // pointers are 32-bit
    switch(type) {
      case 'i1': HEAP8[((ptr)>>0)]=value; break;
      case 'i8': HEAP8[((ptr)>>0)]=value; break;
      case 'i16': HEAP16[((ptr)>>1)]=value; break;
      case 'i32': HEAP32[((ptr)>>2)]=value; break;
      case 'i64': (tempI64 = [value>>>0,(tempDouble=value,(+(Math_abs(tempDouble))) >= 1.0 ? (tempDouble > 0.0 ? ((Math_min((+(Math_floor((tempDouble)/4294967296.0))), 4294967295.0))|0)>>>0 : (~~((+(Math_ceil((tempDouble - +(((~~(tempDouble)))>>>0))/4294967296.0)))))>>>0) : 0)],HEAP32[((ptr)>>2)]=tempI64[0],HEAP32[(((ptr)+(4))>>2)]=tempI64[1]); break;
      case 'float': HEAPF32[((ptr)>>2)]=value; break;
      case 'double': HEAPF64[((ptr)>>3)]=value; break;
      default: abort('invalid type for setValue: ' + type);
    }
}

/** @type {function(number, string, boolean=)} */
function getValue(ptr, type, noSafe) {
  type = type || 'i8';
  if (type.charAt(type.length-1) === '*') type = 'i32'; // pointers are 32-bit
    switch(type) {
      case 'i1': return HEAP8[((ptr)>>0)];
      case 'i8': return HEAP8[((ptr)>>0)];
      case 'i16': return HEAP16[((ptr)>>1)];
      case 'i32': return HEAP32[((ptr)>>2)];
      case 'i64': return HEAP32[((ptr)>>2)];
      case 'float': return HEAPF32[((ptr)>>2)];
      case 'double': return HEAPF64[((ptr)>>3)];
      default: abort('invalid type for getValue: ' + type);
    }
  return null;
}





// Wasm globals

var wasmMemory;

// In fastcomp asm.js, we don't need a wasm Table at all.
// In the wasm backend, we polyfill the WebAssembly object,
// so this creates a (non-native-wasm) table for us.
var wasmTable = new WebAssembly.Table({
  'initial': 58,
  'maximum': 58 + 0,
  'element': 'anyfunc'
});


//========================================
// Runtime essentials
//========================================

// whether we are quitting the application. no code should run after this.
// set in exit() and abort()
var ABORT = false;

// set by exit() and abort().  Passed to 'onExit' handler.
// NOTE: This is also used as the process return code code in shell environments
// but only when noExitRuntime is false.
var EXITSTATUS = 0;

/** @type {function(*, string=)} */
function assert(condition, text) {
  if (!condition) {
    abort('Assertion failed: ' + text);
  }
}

// Returns the C function with a specified identifier (for C++, you need to do manual name mangling)
function getCFunc(ident) {
  var func = Module['_' + ident]; // closure exported function
  assert(func, 'Cannot call unknown function ' + ident + ', make sure it is exported');
  return func;
}

// C calling interface.
function ccall(ident, returnType, argTypes, args, opts) {
  // For fast lookup of conversion functions
  var toC = {
    'string': function(str) {
      var ret = 0;
      if (str !== null && str !== undefined && str !== 0) { // null string
        // at most 4 bytes per UTF-8 code point, +1 for the trailing '\0'
        var len = (str.length << 2) + 1;
        ret = stackAlloc(len);
        stringToUTF8(str, ret, len);
      }
      return ret;
    },
    'array': function(arr) {
      var ret = stackAlloc(arr.length);
      writeArrayToMemory(arr, ret);
      return ret;
    }
  };

  function convertReturnValue(ret) {
    if (returnType === 'string') return UTF8ToString(ret);
    if (returnType === 'boolean') return Boolean(ret);
    return ret;
  }

  var func = getCFunc(ident);
  var cArgs = [];
  var stack = 0;
  assert(returnType !== 'array', 'Return type should not be "array".');
  if (args) {
    for (var i = 0; i < args.length; i++) {
      var converter = toC[argTypes[i]];
      if (converter) {
        if (stack === 0) stack = stackSave();
        cArgs[i] = converter(args[i]);
      } else {
        cArgs[i] = args[i];
      }
    }
  }
  var ret = func.apply(null, cArgs);

  ret = convertReturnValue(ret);
  if (stack !== 0) stackRestore(stack);
  return ret;
}

function cwrap(ident, returnType, argTypes, opts) {
  return function() {
    return ccall(ident, returnType, argTypes, arguments, opts);
  }
}

var ALLOC_NORMAL = 0; // Tries to use _malloc()
var ALLOC_STACK = 1; // Lives for the duration of the current function call
var ALLOC_DYNAMIC = 2; // Cannot be freed except through sbrk
var ALLOC_NONE = 3; // Do not allocate

// allocate(): This is for internal use. You can use it yourself as well, but the interface
//             is a little tricky (see docs right below). The reason is that it is optimized
//             for multiple syntaxes to save space in generated code. So you should
//             normally not use allocate(), and instead allocate memory using _malloc(),
//             initialize it with setValue(), and so forth.
// @slab: An array of data, or a number. If a number, then the size of the block to allocate,
//        in *bytes* (note that this is sometimes confusing: the next parameter does not
//        affect this!)
// @types: Either an array of types, one for each byte (or 0 if no type at that position),
//         or a single type which is used for the entire block. This only matters if there
//         is initial data - if @slab is a number, then this does not matter at all and is
//         ignored.
// @allocator: How to allocate memory, see ALLOC_*
/** @type {function((TypedArray|Array<number>|number), string, number, number=)} */
function allocate(slab, types, allocator, ptr) {
  var zeroinit, size;
  if (typeof slab === 'number') {
    zeroinit = true;
    size = slab;
  } else {
    zeroinit = false;
    size = slab.length;
  }

  var singleType = typeof types === 'string' ? types : null;

  var ret;
  if (allocator == ALLOC_NONE) {
    ret = ptr;
  } else {
    ret = [_malloc,
    stackAlloc,
    dynamicAlloc][allocator](Math.max(size, singleType ? 1 : types.length));
  }

  if (zeroinit) {
    var stop;
    ptr = ret;
    assert((ret & 3) == 0);
    stop = ret + (size & ~3);
    for (; ptr < stop; ptr += 4) {
      HEAP32[((ptr)>>2)]=0;
    }
    stop = ret + size;
    while (ptr < stop) {
      HEAP8[((ptr++)>>0)]=0;
    }
    return ret;
  }

  if (singleType === 'i8') {
    if (slab.subarray || slab.slice) {
      HEAPU8.set(/** @type {!Uint8Array} */ (slab), ret);
    } else {
      HEAPU8.set(new Uint8Array(slab), ret);
    }
    return ret;
  }

  var i = 0, type, typeSize, previousType;
  while (i < size) {
    var curr = slab[i];

    type = singleType || types[i];
    if (type === 0) {
      i++;
      continue;
    }
    assert(type, 'Must know what type to store in allocate!');

    if (type == 'i64') type = 'i32'; // special case: we have one i32 here, and one i32 later

    setValue(ret+i, curr, type);

    // no need to look up size unless type changes, so cache it
    if (previousType !== type) {
      typeSize = getNativeTypeSize(type);
      previousType = type;
    }
    i += typeSize;
  }

  return ret;
}

// Allocate memory during any stage of startup - static memory early on, dynamic memory later, malloc when ready
function getMemory(size) {
  if (!runtimeInitialized) return dynamicAlloc(size);
  return _malloc(size);
}




/** @type {function(number, number=)} */
function Pointer_stringify(ptr, length) {
  abort("this function has been removed - you should use UTF8ToString(ptr, maxBytesToRead) instead!");
}

// Given a pointer 'ptr' to a null-terminated ASCII-encoded string in the emscripten HEAP, returns
// a copy of that string as a Javascript String object.

function AsciiToString(ptr) {
  var str = '';
  while (1) {
    var ch = HEAPU8[((ptr++)>>0)];
    if (!ch) return str;
    str += String.fromCharCode(ch);
  }
}

// Copies the given Javascript String object 'str' to the emscripten HEAP at address 'outPtr',
// null-terminated and encoded in ASCII form. The copy will require at most str.length+1 bytes of space in the HEAP.

function stringToAscii(str, outPtr) {
  return writeAsciiToMemory(str, outPtr, false);
}


// Given a pointer 'ptr' to a null-terminated UTF8-encoded string in the given array that contains uint8 values, returns
// a copy of that string as a Javascript String object.

var UTF8Decoder = typeof TextDecoder !== 'undefined' ? new TextDecoder('utf8') : undefined;

/**
 * @param {number} idx
 * @param {number=} maxBytesToRead
 * @return {string}
 */
function UTF8ArrayToString(u8Array, idx, maxBytesToRead) {
  var endIdx = idx + maxBytesToRead;
  var endPtr = idx;
  // TextDecoder needs to know the byte length in advance, it doesn't stop on null terminator by itself.
  // Also, use the length info to avoid running tiny strings through TextDecoder, since .subarray() allocates garbage.
  // (As a tiny code save trick, compare endPtr against endIdx using a negation, so that undefined means Infinity)
  while (u8Array[endPtr] && !(endPtr >= endIdx)) ++endPtr;

  if (endPtr - idx > 16 && u8Array.subarray && UTF8Decoder) {
    return UTF8Decoder.decode(u8Array.subarray(idx, endPtr));
  } else {
    var str = '';
    // If building with TextDecoder, we have already computed the string length above, so test loop end condition against that
    while (idx < endPtr) {
      // For UTF8 byte structure, see:
      // http://en.wikipedia.org/wiki/UTF-8#Description
      // https://www.ietf.org/rfc/rfc2279.txt
      // https://tools.ietf.org/html/rfc3629
      var u0 = u8Array[idx++];
      if (!(u0 & 0x80)) { str += String.fromCharCode(u0); continue; }
      var u1 = u8Array[idx++] & 63;
      if ((u0 & 0xE0) == 0xC0) { str += String.fromCharCode(((u0 & 31) << 6) | u1); continue; }
      var u2 = u8Array[idx++] & 63;
      if ((u0 & 0xF0) == 0xE0) {
        u0 = ((u0 & 15) << 12) | (u1 << 6) | u2;
      } else {
        if ((u0 & 0xF8) != 0xF0) warnOnce('Invalid UTF-8 leading byte 0x' + u0.toString(16) + ' encountered when deserializing a UTF-8 string on the asm.js/wasm heap to a JS string!');
        u0 = ((u0 & 7) << 18) | (u1 << 12) | (u2 << 6) | (u8Array[idx++] & 63);
      }

      if (u0 < 0x10000) {
        str += String.fromCharCode(u0);
      } else {
        var ch = u0 - 0x10000;
        str += String.fromCharCode(0xD800 | (ch >> 10), 0xDC00 | (ch & 0x3FF));
      }
    }
  }
  return str;
}

// Given a pointer 'ptr' to a null-terminated UTF8-encoded string in the emscripten HEAP, returns a
// copy of that string as a Javascript String object.
// maxBytesToRead: an optional length that specifies the maximum number of bytes to read. You can omit
//                 this parameter to scan the string until the first \0 byte. If maxBytesToRead is
//                 passed, and the string at [ptr, ptr+maxBytesToReadr[ contains a null byte in the
//                 middle, then the string will cut short at that byte index (i.e. maxBytesToRead will
//                 not produce a string of exact length [ptr, ptr+maxBytesToRead[)
//                 N.B. mixing frequent uses of UTF8ToString() with and without maxBytesToRead may
//                 throw JS JIT optimizations off, so it is worth to consider consistently using one
//                 style or the other.
/**
 * @param {number} ptr
 * @param {number=} maxBytesToRead
 * @return {string}
 */
function UTF8ToString(ptr, maxBytesToRead) {
  return ptr ? UTF8ArrayToString(HEAPU8, ptr, maxBytesToRead) : '';
}

// Copies the given Javascript String object 'str' to the given byte array at address 'outIdx',
// encoded in UTF8 form and null-terminated. The copy will require at most str.length*4+1 bytes of space in the HEAP.
// Use the function lengthBytesUTF8 to compute the exact number of bytes (excluding null terminator) that this function will write.
// Parameters:
//   str: the Javascript string to copy.
//   outU8Array: the array to copy to. Each index in this array is assumed to be one 8-byte element.
//   outIdx: The starting offset in the array to begin the copying.
//   maxBytesToWrite: The maximum number of bytes this function can write to the array.
//                    This count should include the null terminator,
//                    i.e. if maxBytesToWrite=1, only the null terminator will be written and nothing else.
//                    maxBytesToWrite=0 does not write any bytes to the output, not even the null terminator.
// Returns the number of bytes written, EXCLUDING the null terminator.

function stringToUTF8Array(str, outU8Array, outIdx, maxBytesToWrite) {
  if (!(maxBytesToWrite > 0)) // Parameter maxBytesToWrite is not optional. Negative values, 0, null, undefined and false each don't write out any bytes.
    return 0;

  var startIdx = outIdx;
  var endIdx = outIdx + maxBytesToWrite - 1; // -1 for string null terminator.
  for (var i = 0; i < str.length; ++i) {
    // Gotcha: charCodeAt returns a 16-bit word that is a UTF-16 encoded code unit, not a Unicode code point of the character! So decode UTF16->UTF32->UTF8.
    // See http://unicode.org/faq/utf_bom.html#utf16-3
    // For UTF8 byte structure, see http://en.wikipedia.org/wiki/UTF-8#Description and https://www.ietf.org/rfc/rfc2279.txt and https://tools.ietf.org/html/rfc3629
    var u = str.charCodeAt(i); // possibly a lead surrogate
    if (u >= 0xD800 && u <= 0xDFFF) {
      var u1 = str.charCodeAt(++i);
      u = 0x10000 + ((u & 0x3FF) << 10) | (u1 & 0x3FF);
    }
    if (u <= 0x7F) {
      if (outIdx >= endIdx) break;
      outU8Array[outIdx++] = u;
    } else if (u <= 0x7FF) {
      if (outIdx + 1 >= endIdx) break;
      outU8Array[outIdx++] = 0xC0 | (u >> 6);
      outU8Array[outIdx++] = 0x80 | (u & 63);
    } else if (u <= 0xFFFF) {
      if (outIdx + 2 >= endIdx) break;
      outU8Array[outIdx++] = 0xE0 | (u >> 12);
      outU8Array[outIdx++] = 0x80 | ((u >> 6) & 63);
      outU8Array[outIdx++] = 0x80 | (u & 63);
    } else {
      if (outIdx + 3 >= endIdx) break;
      if (u >= 0x200000) warnOnce('Invalid Unicode code point 0x' + u.toString(16) + ' encountered when serializing a JS string to an UTF-8 string on the asm.js/wasm heap! (Valid unicode code points should be in range 0-0x1FFFFF).');
      outU8Array[outIdx++] = 0xF0 | (u >> 18);
      outU8Array[outIdx++] = 0x80 | ((u >> 12) & 63);
      outU8Array[outIdx++] = 0x80 | ((u >> 6) & 63);
      outU8Array[outIdx++] = 0x80 | (u & 63);
    }
  }
  // Null-terminate the pointer to the buffer.
  outU8Array[outIdx] = 0;
  return outIdx - startIdx;
}

// Copies the given Javascript String object 'str' to the emscripten HEAP at address 'outPtr',
// null-terminated and encoded in UTF8 form. The copy will require at most str.length*4+1 bytes of space in the HEAP.
// Use the function lengthBytesUTF8 to compute the exact number of bytes (excluding null terminator) that this function will write.
// Returns the number of bytes written, EXCLUDING the null terminator.

function stringToUTF8(str, outPtr, maxBytesToWrite) {
  assert(typeof maxBytesToWrite == 'number', 'stringToUTF8(str, outPtr, maxBytesToWrite) is missing the third parameter that specifies the length of the output buffer!');
  return stringToUTF8Array(str, HEAPU8,outPtr, maxBytesToWrite);
}

// Returns the number of bytes the given Javascript string takes if encoded as a UTF8 byte array, EXCLUDING the null terminator byte.
function lengthBytesUTF8(str) {
  var len = 0;
  for (var i = 0; i < str.length; ++i) {
    // Gotcha: charCodeAt returns a 16-bit word that is a UTF-16 encoded code unit, not a Unicode code point of the character! So decode UTF16->UTF32->UTF8.
    // See http://unicode.org/faq/utf_bom.html#utf16-3
    var u = str.charCodeAt(i); // possibly a lead surrogate
    if (u >= 0xD800 && u <= 0xDFFF) u = 0x10000 + ((u & 0x3FF) << 10) | (str.charCodeAt(++i) & 0x3FF);
    if (u <= 0x7F) ++len;
    else if (u <= 0x7FF) len += 2;
    else if (u <= 0xFFFF) len += 3;
    else len += 4;
  }
  return len;
}


// Given a pointer 'ptr' to a null-terminated UTF16LE-encoded string in the emscripten HEAP, returns
// a copy of that string as a Javascript String object.

var UTF16Decoder = typeof TextDecoder !== 'undefined' ? new TextDecoder('utf-16le') : undefined;
function UTF16ToString(ptr) {
  assert(ptr % 2 == 0, 'Pointer passed to UTF16ToString must be aligned to two bytes!');
  var endPtr = ptr;
  // TextDecoder needs to know the byte length in advance, it doesn't stop on null terminator by itself.
  // Also, use the length info to avoid running tiny strings through TextDecoder, since .subarray() allocates garbage.
  var idx = endPtr >> 1;
  while (HEAP16[idx]) ++idx;
  endPtr = idx << 1;

  if (endPtr - ptr > 32 && UTF16Decoder) {
    return UTF16Decoder.decode(HEAPU8.subarray(ptr, endPtr));
  } else {
    var i = 0;

    var str = '';
    while (1) {
      var codeUnit = HEAP16[(((ptr)+(i*2))>>1)];
      if (codeUnit == 0) return str;
      ++i;
      // fromCharCode constructs a character from a UTF-16 code unit, so we can pass the UTF16 string right through.
      str += String.fromCharCode(codeUnit);
    }
  }
}

// Copies the given Javascript String object 'str' to the emscripten HEAP at address 'outPtr',
// null-terminated and encoded in UTF16 form. The copy will require at most str.length*4+2 bytes of space in the HEAP.
// Use the function lengthBytesUTF16() to compute the exact number of bytes (excluding null terminator) that this function will write.
// Parameters:
//   str: the Javascript string to copy.
//   outPtr: Byte address in Emscripten HEAP where to write the string to.
//   maxBytesToWrite: The maximum number of bytes this function can write to the array. This count should include the null
//                    terminator, i.e. if maxBytesToWrite=2, only the null terminator will be written and nothing else.
//                    maxBytesToWrite<2 does not write any bytes to the output, not even the null terminator.
// Returns the number of bytes written, EXCLUDING the null terminator.

function stringToUTF16(str, outPtr, maxBytesToWrite) {
  assert(outPtr % 2 == 0, 'Pointer passed to stringToUTF16 must be aligned to two bytes!');
  assert(typeof maxBytesToWrite == 'number', 'stringToUTF16(str, outPtr, maxBytesToWrite) is missing the third parameter that specifies the length of the output buffer!');
  // Backwards compatibility: if max bytes is not specified, assume unsafe unbounded write is allowed.
  if (maxBytesToWrite === undefined) {
    maxBytesToWrite = 0x7FFFFFFF;
  }
  if (maxBytesToWrite < 2) return 0;
  maxBytesToWrite -= 2; // Null terminator.
  var startPtr = outPtr;
  var numCharsToWrite = (maxBytesToWrite < str.length*2) ? (maxBytesToWrite / 2) : str.length;
  for (var i = 0; i < numCharsToWrite; ++i) {
    // charCodeAt returns a UTF-16 encoded code unit, so it can be directly written to the HEAP.
    var codeUnit = str.charCodeAt(i); // possibly a lead surrogate
    HEAP16[((outPtr)>>1)]=codeUnit;
    outPtr += 2;
  }
  // Null-terminate the pointer to the HEAP.
  HEAP16[((outPtr)>>1)]=0;
  return outPtr - startPtr;
}

// Returns the number of bytes the given Javascript string takes if encoded as a UTF16 byte array, EXCLUDING the null terminator byte.

function lengthBytesUTF16(str) {
  return str.length*2;
}

function UTF32ToString(ptr) {
  assert(ptr % 4 == 0, 'Pointer passed to UTF32ToString must be aligned to four bytes!');
  var i = 0;

  var str = '';
  while (1) {
    var utf32 = HEAP32[(((ptr)+(i*4))>>2)];
    if (utf32 == 0)
      return str;
    ++i;
    // Gotcha: fromCharCode constructs a character from a UTF-16 encoded code (pair), not from a Unicode code point! So encode the code point to UTF-16 for constructing.
    // See http://unicode.org/faq/utf_bom.html#utf16-3
    if (utf32 >= 0x10000) {
      var ch = utf32 - 0x10000;
      str += String.fromCharCode(0xD800 | (ch >> 10), 0xDC00 | (ch & 0x3FF));
    } else {
      str += String.fromCharCode(utf32);
    }
  }
}

// Copies the given Javascript String object 'str' to the emscripten HEAP at address 'outPtr',
// null-terminated and encoded in UTF32 form. The copy will require at most str.length*4+4 bytes of space in the HEAP.
// Use the function lengthBytesUTF32() to compute the exact number of bytes (excluding null terminator) that this function will write.
// Parameters:
//   str: the Javascript string to copy.
//   outPtr: Byte address in Emscripten HEAP where to write the string to.
//   maxBytesToWrite: The maximum number of bytes this function can write to the array. This count should include the null
//                    terminator, i.e. if maxBytesToWrite=4, only the null terminator will be written and nothing else.
//                    maxBytesToWrite<4 does not write any bytes to the output, not even the null terminator.
// Returns the number of bytes written, EXCLUDING the null terminator.

function stringToUTF32(str, outPtr, maxBytesToWrite) {
  assert(outPtr % 4 == 0, 'Pointer passed to stringToUTF32 must be aligned to four bytes!');
  assert(typeof maxBytesToWrite == 'number', 'stringToUTF32(str, outPtr, maxBytesToWrite) is missing the third parameter that specifies the length of the output buffer!');
  // Backwards compatibility: if max bytes is not specified, assume unsafe unbounded write is allowed.
  if (maxBytesToWrite === undefined) {
    maxBytesToWrite = 0x7FFFFFFF;
  }
  if (maxBytesToWrite < 4) return 0;
  var startPtr = outPtr;
  var endPtr = startPtr + maxBytesToWrite - 4;
  for (var i = 0; i < str.length; ++i) {
    // Gotcha: charCodeAt returns a 16-bit word that is a UTF-16 encoded code unit, not a Unicode code point of the character! We must decode the string to UTF-32 to the heap.
    // See http://unicode.org/faq/utf_bom.html#utf16-3
    var codeUnit = str.charCodeAt(i); // possibly a lead surrogate
    if (codeUnit >= 0xD800 && codeUnit <= 0xDFFF) {
      var trailSurrogate = str.charCodeAt(++i);
      codeUnit = 0x10000 + ((codeUnit & 0x3FF) << 10) | (trailSurrogate & 0x3FF);
    }
    HEAP32[((outPtr)>>2)]=codeUnit;
    outPtr += 4;
    if (outPtr + 4 > endPtr) break;
  }
  // Null-terminate the pointer to the HEAP.
  HEAP32[((outPtr)>>2)]=0;
  return outPtr - startPtr;
}

// Returns the number of bytes the given Javascript string takes if encoded as a UTF16 byte array, EXCLUDING the null terminator byte.

function lengthBytesUTF32(str) {
  var len = 0;
  for (var i = 0; i < str.length; ++i) {
    // Gotcha: charCodeAt returns a 16-bit word that is a UTF-16 encoded code unit, not a Unicode code point of the character! We must decode the string to UTF-32 to the heap.
    // See http://unicode.org/faq/utf_bom.html#utf16-3
    var codeUnit = str.charCodeAt(i);
    if (codeUnit >= 0xD800 && codeUnit <= 0xDFFF) ++i; // possibly a lead surrogate, so skip over the tail surrogate.
    len += 4;
  }

  return len;
}

// Allocate heap space for a JS string, and write it there.
// It is the responsibility of the caller to free() that memory.
function allocateUTF8(str) {
  var size = lengthBytesUTF8(str) + 1;
  var ret = _malloc(size);
  if (ret) stringToUTF8Array(str, HEAP8, ret, size);
  return ret;
}

// Allocate stack space for a JS string, and write it there.
function allocateUTF8OnStack(str) {
  var size = lengthBytesUTF8(str) + 1;
  var ret = stackAlloc(size);
  stringToUTF8Array(str, HEAP8, ret, size);
  return ret;
}

// Deprecated: This function should not be called because it is unsafe and does not provide
// a maximum length limit of how many bytes it is allowed to write. Prefer calling the
// function stringToUTF8Array() instead, which takes in a maximum length that can be used
// to be secure from out of bounds writes.
/** @deprecated */
function writeStringToMemory(string, buffer, dontAddNull) {
  warnOnce('writeStringToMemory is deprecated and should not be called! Use stringToUTF8() instead!');

  var /** @type {number} */ lastChar, /** @type {number} */ end;
  if (dontAddNull) {
    // stringToUTF8Array always appends null. If we don't want to do that, remember the
    // character that existed at the location where the null will be placed, and restore
    // that after the write (below).
    end = buffer + lengthBytesUTF8(string);
    lastChar = HEAP8[end];
  }
  stringToUTF8(string, buffer, Infinity);
  if (dontAddNull) HEAP8[end] = lastChar; // Restore the value under the null character.
}

function writeArrayToMemory(array, buffer) {
  assert(array.length >= 0, 'writeArrayToMemory array must have a length (should be an array or typed array)')
  HEAP8.set(array, buffer);
}

function writeAsciiToMemory(str, buffer, dontAddNull) {
  for (var i = 0; i < str.length; ++i) {
    assert(str.charCodeAt(i) === str.charCodeAt(i)&0xff);
    HEAP8[((buffer++)>>0)]=str.charCodeAt(i);
  }
  // Null-terminate the pointer to the HEAP.
  if (!dontAddNull) HEAP8[((buffer)>>0)]=0;
}




// Memory management

var PAGE_SIZE = 16384;
var WASM_PAGE_SIZE = 65536;
var ASMJS_PAGE_SIZE = 16777216;

function alignUp(x, multiple) {
  if (x % multiple > 0) {
    x += multiple - (x % multiple);
  }
  return x;
}

var HEAP,
/** @type {ArrayBuffer} */
  buffer,
/** @type {Int8Array} */
  HEAP8,
/** @type {Uint8Array} */
  HEAPU8,
/** @type {Int16Array} */
  HEAP16,
/** @type {Uint16Array} */
  HEAPU16,
/** @type {Int32Array} */
  HEAP32,
/** @type {Uint32Array} */
  HEAPU32,
/** @type {Float32Array} */
  HEAPF32,
/** @type {Float64Array} */
  HEAPF64;

function updateGlobalBufferAndViews(buf) {
  buffer = buf;
  Module['HEAP8'] = HEAP8 = new Int8Array(buf);
  Module['HEAP16'] = HEAP16 = new Int16Array(buf);
  Module['HEAP32'] = HEAP32 = new Int32Array(buf);
  Module['HEAPU8'] = HEAPU8 = new Uint8Array(buf);
  Module['HEAPU16'] = HEAPU16 = new Uint16Array(buf);
  Module['HEAPU32'] = HEAPU32 = new Uint32Array(buf);
  Module['HEAPF32'] = HEAPF32 = new Float32Array(buf);
  Module['HEAPF64'] = HEAPF64 = new Float64Array(buf);
}

var STATIC_BASE = 1024,
    STACK_BASE = 5248032,
    STACKTOP = STACK_BASE,
    STACK_MAX = 5152,
    DYNAMIC_BASE = 5248032,
    DYNAMICTOP_PTR = 4992;

assert(STACK_BASE % 16 === 0, 'stack must start aligned');
assert(DYNAMIC_BASE % 16 === 0, 'heap must start aligned');



var TOTAL_STACK = 5242880;
if (Module['TOTAL_STACK']) assert(TOTAL_STACK === Module['TOTAL_STACK'], 'the stack size can no longer be determined at runtime')

var INITIAL_TOTAL_MEMORY = Module['TOTAL_MEMORY'] || 16777216;if (!Object.getOwnPropertyDescriptor(Module, 'TOTAL_MEMORY')) Object.defineProperty(Module, 'TOTAL_MEMORY', { configurable: true, get: function() { abort('Module.TOTAL_MEMORY has been replaced with plain INITIAL_TOTAL_MEMORY') } });

assert(INITIAL_TOTAL_MEMORY >= TOTAL_STACK, 'TOTAL_MEMORY should be larger than TOTAL_STACK, was ' + INITIAL_TOTAL_MEMORY + '! (TOTAL_STACK=' + TOTAL_STACK + ')');

// check for full engine support (use string 'subarray' to avoid closure compiler confusion)
assert(typeof Int32Array !== 'undefined' && typeof Float64Array !== 'undefined' && Int32Array.prototype.subarray !== undefined && Int32Array.prototype.set !== undefined,
       'JS engine does not provide full typed array support');






// In standalone mode, the wasm creates the memory, and the user can't provide it.
// In non-standalone/normal mode, we create the memory here.

// Create the main memory. (Note: this isn't used in STANDALONE_WASM mode since the wasm
// memory is created in the wasm, not in JS.)

  if (Module['wasmMemory']) {
    wasmMemory = Module['wasmMemory'];
  } else
  {
    wasmMemory = new WebAssembly.Memory({
      'initial': INITIAL_TOTAL_MEMORY / WASM_PAGE_SIZE
      ,
      'maximum': INITIAL_TOTAL_MEMORY / WASM_PAGE_SIZE
    });
  }


if (wasmMemory) {
  buffer = wasmMemory.buffer;
}

// If the user provides an incorrect length, just use that length instead rather than providing the user to
// specifically provide the memory length with Module['TOTAL_MEMORY'].
INITIAL_TOTAL_MEMORY = buffer.byteLength;
assert(INITIAL_TOTAL_MEMORY % WASM_PAGE_SIZE === 0);
updateGlobalBufferAndViews(buffer);

HEAP32[DYNAMICTOP_PTR>>2] = DYNAMIC_BASE;




// Initializes the stack cookie. Called at the startup of main and at the startup of each thread in pthreads mode.
function writeStackCookie() {
  assert((STACK_MAX & 3) == 0);
  // The stack grows downwards
  HEAPU32[(STACK_MAX >> 2)+1] = 0x02135467;
  HEAPU32[(STACK_MAX >> 2)+2] = 0x89BACDFE;
  // Also test the global address 0 for integrity.
  // We don't do this with ASan because ASan does its own checks for this.
  HEAP32[0] = 0x63736d65; /* 'emsc' */
}

function checkStackCookie() {
  var cookie1 = HEAPU32[(STACK_MAX >> 2)+1];
  var cookie2 = HEAPU32[(STACK_MAX >> 2)+2];
  if (cookie1 != 0x02135467 || cookie2 != 0x89BACDFE) {
    abort('Stack overflow! Stack cookie has been overwritten, expected hex dwords 0x89BACDFE and 0x02135467, but received 0x' + cookie2.toString(16) + ' ' + cookie1.toString(16));
  }
  // Also test the global address 0 for integrity.
  // We don't do this with ASan because ASan does its own checks for this.
  if (HEAP32[0] !== 0x63736d65 /* 'emsc' */) abort('Runtime error: The application has corrupted its heap memory area (address zero)!');
}

function abortStackOverflow(allocSize) {
  abort('Stack overflow! Attempted to allocate ' + allocSize + ' bytes on the stack, but stack has only ' + (STACK_MAX - stackSave() + allocSize) + ' bytes available!');
}




// Endianness check (note: assumes compiler arch was little-endian)
(function() {
  var h16 = new Int16Array(1);
  var h8 = new Int8Array(h16.buffer);
  h16[0] = 0x6373;
  if (h8[0] !== 0x73 || h8[1] !== 0x63) throw 'Runtime error: expected the system to be little-endian!';
})();

function abortFnPtrError(ptr, sig) {
	abort("Invalid function pointer " + ptr + " called with signature '" + sig + "'. Perhaps this is an invalid value (e.g. caused by calling a virtual method on a NULL pointer)? Or calling a function with an incorrect type, which will fail? (it is worth building your source files with -Werror (warnings are errors), as warnings can indicate undefined behavior which can cause this). Build with ASSERTIONS=2 for more info.");
}



function callRuntimeCallbacks(callbacks) {
  while(callbacks.length > 0) {
    var callback = callbacks.shift();
    if (typeof callback == 'function') {
      callback();
      continue;
    }
    var func = callback.func;
    if (typeof func === 'number') {
      if (callback.arg === undefined) {
        Module['dynCall_v'](func);
      } else {
        Module['dynCall_vi'](func, callback.arg);
      }
    } else {
      func(callback.arg === undefined ? null : callback.arg);
    }
  }
}

var __ATPRERUN__  = []; // functions called before the runtime is initialized
var __ATINIT__    = []; // functions called during startup
var __ATMAIN__    = []; // functions called when main() is to be run
var __ATEXIT__    = []; // functions called during shutdown
var __ATPOSTRUN__ = []; // functions called after the main() is called

var runtimeInitialized = false;
var runtimeExited = false;


function preRun() {

  if (Module['preRun']) {
    if (typeof Module['preRun'] == 'function') Module['preRun'] = [Module['preRun']];
    while (Module['preRun'].length) {
      addOnPreRun(Module['preRun'].shift());
    }
  }

  callRuntimeCallbacks(__ATPRERUN__);
}

function initRuntime() {
  checkStackCookie();
  assert(!runtimeInitialized);
  runtimeInitialized = true;
  
  callRuntimeCallbacks(__ATINIT__);
}

function preMain() {
  checkStackCookie();
  
  callRuntimeCallbacks(__ATMAIN__);
}

function exitRuntime() {
  checkStackCookie();
  runtimeExited = true;
}

function postRun() {
  checkStackCookie();

  if (Module['postRun']) {
    if (typeof Module['postRun'] == 'function') Module['postRun'] = [Module['postRun']];
    while (Module['postRun'].length) {
      addOnPostRun(Module['postRun'].shift());
    }
  }

  callRuntimeCallbacks(__ATPOSTRUN__);
}

function addOnPreRun(cb) {
  __ATPRERUN__.unshift(cb);
}

function addOnInit(cb) {
  __ATINIT__.unshift(cb);
}

function addOnPreMain(cb) {
  __ATMAIN__.unshift(cb);
}

function addOnExit(cb) {
}

function addOnPostRun(cb) {
  __ATPOSTRUN__.unshift(cb);
}

function unSign(value, bits, ignore) {
  if (value >= 0) {
    return value;
  }
  return bits <= 32 ? 2*Math.abs(1 << (bits-1)) + value // Need some trickery, since if bits == 32, we are right at the limit of the bits JS uses in bitshifts
                    : Math.pow(2, bits)         + value;
}
function reSign(value, bits, ignore) {
  if (value <= 0) {
    return value;
  }
  var half = bits <= 32 ? Math.abs(1 << (bits-1)) // abs is needed if bits == 32
                        : Math.pow(2, bits-1);
  if (value >= half && (bits <= 32 || value > half)) { // for huge values, we can hit the precision limit and always get true here. so don't do that
                                                       // but, in general there is no perfect solution here. With 64-bit ints, we get rounding and errors
                                                       // TODO: In i64 mode 1, resign the two parts separately and safely
    value = -2*half + value; // Cannot bitshift half, as it may be at the limit of the bits JS uses in bitshifts
  }
  return value;
}


assert(Math.imul, 'This browser does not support Math.imul(), build with LEGACY_VM_SUPPORT or POLYFILL_OLD_MATH_FUNCTIONS to add in a polyfill');
assert(Math.fround, 'This browser does not support Math.fround(), build with LEGACY_VM_SUPPORT or POLYFILL_OLD_MATH_FUNCTIONS to add in a polyfill');
assert(Math.clz32, 'This browser does not support Math.clz32(), build with LEGACY_VM_SUPPORT or POLYFILL_OLD_MATH_FUNCTIONS to add in a polyfill');
assert(Math.trunc, 'This browser does not support Math.trunc(), build with LEGACY_VM_SUPPORT or POLYFILL_OLD_MATH_FUNCTIONS to add in a polyfill');

var Math_abs = Math.abs;
var Math_cos = Math.cos;
var Math_sin = Math.sin;
var Math_tan = Math.tan;
var Math_acos = Math.acos;
var Math_asin = Math.asin;
var Math_atan = Math.atan;
var Math_atan2 = Math.atan2;
var Math_exp = Math.exp;
var Math_log = Math.log;
var Math_sqrt = Math.sqrt;
var Math_ceil = Math.ceil;
var Math_floor = Math.floor;
var Math_pow = Math.pow;
var Math_imul = Math.imul;
var Math_fround = Math.fround;
var Math_round = Math.round;
var Math_min = Math.min;
var Math_max = Math.max;
var Math_clz32 = Math.clz32;
var Math_trunc = Math.trunc;



// A counter of dependencies for calling run(). If we need to
// do asynchronous work before running, increment this and
// decrement it. Incrementing must happen in a place like
// Module.preRun (used by emcc to add file preloading).
// Note that you can add dependencies in preRun, even though
// it happens right before run - run will be postponed until
// the dependencies are met.
var runDependencies = 0;
var runDependencyWatcher = null;
var dependenciesFulfilled = null; // overridden to take different actions when all run dependencies are fulfilled
var runDependencyTracking = {};

function getUniqueRunDependency(id) {
  var orig = id;
  while (1) {
    if (!runDependencyTracking[id]) return id;
    id = orig + Math.random();
  }
  return id;
}

function addRunDependency(id) {
  runDependencies++;

  if (Module['monitorRunDependencies']) {
    Module['monitorRunDependencies'](runDependencies);
  }

  if (id) {
    assert(!runDependencyTracking[id]);
    runDependencyTracking[id] = 1;
    if (runDependencyWatcher === null && typeof setInterval !== 'undefined') {
      // Check for missing dependencies every few seconds
      runDependencyWatcher = setInterval(function() {
        if (ABORT) {
          clearInterval(runDependencyWatcher);
          runDependencyWatcher = null;
          return;
        }
        var shown = false;
        for (var dep in runDependencyTracking) {
          if (!shown) {
            shown = true;
            err('still waiting on run dependencies:');
          }
          err('dependency: ' + dep);
        }
        if (shown) {
          err('(end of list)');
        }
      }, 10000);
    }
  } else {
    err('warning: run dependency added without ID');
  }
}

function removeRunDependency(id) {
  runDependencies--;

  if (Module['monitorRunDependencies']) {
    Module['monitorRunDependencies'](runDependencies);
  }

  if (id) {
    assert(runDependencyTracking[id]);
    delete runDependencyTracking[id];
  } else {
    err('warning: run dependency removed without ID');
  }
  if (runDependencies == 0) {
    if (runDependencyWatcher !== null) {
      clearInterval(runDependencyWatcher);
      runDependencyWatcher = null;
    }
    if (dependenciesFulfilled) {
      var callback = dependenciesFulfilled;
      dependenciesFulfilled = null;
      callback(); // can add another dependenciesFulfilled
    }
  }
}

Module["preloadedImages"] = {}; // maps url to image data
Module["preloadedAudios"] = {}; // maps url to audio data


function abort(what) {
  if (Module['onAbort']) {
    Module['onAbort'](what);
  }

  what += '';
  out(what);
  err(what);

  ABORT = true;
  EXITSTATUS = 1;

  var output = 'abort(' + what + ') at ' + stackTrace();
  what = output;

  // Throw a wasm runtime error, because a JS error might be seen as a foreign
  // exception, which means we'd run destructors on it. We need the error to
  // simply make the program stop.
  throw new WebAssembly.RuntimeError(what);
}


var memoryInitializer = null;




// show errors on likely calls to FS when it was not included
var FS = {
  error: function() {
    abort('Filesystem support (FS) was not included. The problem is that you are using files from JS, but files were not used from C/C++, so filesystem support was not auto-included. You can force-include filesystem support with  -s FORCE_FILESYSTEM=1');
  },
  init: function() { FS.error() },
  createDataFile: function() { FS.error() },
  createPreloadedFile: function() { FS.error() },
  createLazyFile: function() { FS.error() },
  open: function() { FS.error() },
  mkdev: function() { FS.error() },
  registerDevice: function() { FS.error() },
  analyzePath: function() { FS.error() },
  loadFilesFromDB: function() { FS.error() },

  ErrnoError: function ErrnoError() { FS.error() },
};
Module['FS_createDataFile'] = FS.createDataFile;
Module['FS_createPreloadedFile'] = FS.createPreloadedFile;



// Copyright 2017 The Emscripten Authors.  All rights reserved.
// Emscripten is available under two separate licenses, the MIT license and the
// University of Illinois/NCSA Open Source License.  Both these licenses can be
// found in the LICENSE file.

// Prefix of data URIs emitted by SINGLE_FILE and related options.
var dataURIPrefix = 'data:application/octet-stream;base64,';

// Indicates whether filename is a base64 data URI.
function isDataURI(filename) {
  return String.prototype.startsWith ?
      filename.startsWith(dataURIPrefix) :
      filename.indexOf(dataURIPrefix) === 0;
}




var wasmBinaryFile = '';
if (!isDataURI(wasmBinaryFile)) {
  wasmBinaryFile = locateFile(wasmBinaryFile);
}

function getBinary() {
  try {
    if (wasmBinary) {
      return new Uint8Array(wasmBinary);
    }

    var binary = tryParseAsDataURI(wasmBinaryFile);
    if (binary) {
      return binary;
    }
    if (readBinary) {
      return readBinary(wasmBinaryFile);
    } else {
      throw "both async and sync fetching of the wasm failed";
    }
  }
  catch (err) {
    abort(err);
  }
}

function getBinaryPromise() {
  // if we don't have the binary yet, and have the Fetch api, use that
  // in some environments, like Electron's render process, Fetch api may be present, but have a different context than expected, let's only use it on the Web
  if (!wasmBinary && (ENVIRONMENT_IS_WEB || ENVIRONMENT_IS_WORKER) && typeof fetch === 'function') {
    return fetch(wasmBinaryFile, { credentials: 'same-origin' }).then(function(response) {
      if (!response['ok']) {
        throw "failed to load wasm binary file at '" + wasmBinaryFile + "'";
      }
      return response['arrayBuffer']();
    }).catch(function () {
      return getBinary();
    });
  }
  // Otherwise, getBinary should be able to get it synchronously
  return new Promise(function(resolve, reject) {
    resolve(getBinary());
  });
}



// Create the wasm instance.
// Receives the wasm imports, returns the exports.
function createWasm() {
  // prepare imports
  var info = {
    'env': asmLibraryArg,
    'wasi_snapshot_preview1': asmLibraryArg
  };
  // Load the wasm module and create an instance of using native support in the JS engine.
  // handle a generated wasm instance, receiving its exports and
  // performing other necessary setup
  function receiveInstance(instance, module) {
    var exports = instance.exports;
    Module['asm'] = exports;
    removeRunDependency('wasm-instantiate');
  }
   // we can't run yet (except in a pthread, where we have a custom sync instantiator)
  addRunDependency('wasm-instantiate');


  // Async compilation can be confusing when an error on the page overwrites Module
  // (for example, if the order of elements is wrong, and the one defining Module is
  // later), so we save Module and check it later.
  var trueModule = Module;
  function receiveInstantiatedSource(output) {
    // 'output' is a WebAssemblyInstantiatedSource object which has both the module and instance.
    // receiveInstance() will swap in the exports (to Module.asm) so they can be called
    assert(Module === trueModule, 'the Module object should not be replaced during async compilation - perhaps the order of HTML elements is wrong?');
    trueModule = null;
      // TODO: Due to Closure regression https://github.com/google/closure-compiler/issues/3193, the above line no longer optimizes out down to the following line.
      // When the regression is fixed, can restore the above USE_PTHREADS-enabled path.
    receiveInstance(output['instance']);
  }


  function instantiateArrayBuffer(receiver) {
    return getBinaryPromise().then(function(binary) {
      return WebAssembly.instantiate(binary, info);
    }).then(receiver, function(reason) {
      err('failed to asynchronously prepare wasm: ' + reason);
      abort(reason);
    });
  }

  // Prefer streaming instantiation if available.
  function instantiateAsync() {
    if (!wasmBinary &&
        typeof WebAssembly.instantiateStreaming === 'function' &&
        !isDataURI(wasmBinaryFile) &&
        typeof fetch === 'function') {
      fetch(wasmBinaryFile, { credentials: 'same-origin' }).then(function (response) {
        var result = WebAssembly.instantiateStreaming(response, info);
        return result.then(receiveInstantiatedSource, function(reason) {
            // We expect the most common failure cause to be a bad MIME type for the binary,
            // in which case falling back to ArrayBuffer instantiation should work.
            err('wasm streaming compile failed: ' + reason);
            err('falling back to ArrayBuffer instantiation');
            instantiateArrayBuffer(receiveInstantiatedSource);
          });
      });
    } else {
      return instantiateArrayBuffer(receiveInstantiatedSource);
    }
  }
  // User shell pages can write their own Module.instantiateWasm = function(imports, successCallback) callback
  // to manually instantiate the Wasm module themselves. This allows pages to run the instantiation parallel
  // to any other async startup actions they are performing.
  if (Module['instantiateWasm']) {
    try {
      var exports = Module['instantiateWasm'](info, receiveInstance);
      return exports;
    } catch(e) {
      err('Module.instantiateWasm callback failed with error: ' + e);
      return false;
    }
  }

  instantiateAsync();
  return {}; // no exports yet; we'll fill them in later
}


// Globals used by JS i64 conversions
var tempDouble;
var tempI64;

// === Body ===

var ASM_CONSTS = {
  
};




// STATICTOP = STATIC_BASE + 4128;
/* global initializers */  __ATINIT__.push({ func: function() { ___wasm_call_ctors() } });




/* no memory initializer */
// {{PRE_LIBRARY}}


  function demangle(func) {
      warnOnce('warning: build with  -s DEMANGLE_SUPPORT=1  to link in libcxxabi demangling');
      return func;
    }

  function demangleAll(text) {
      var regex =
        /\b_Z[\w\d_]+/g;
      return text.replace(regex,
        function(x) {
          var y = demangle(x);
          return x === y ? x : (y + ' [' + x + ']');
        });
    }

  function jsStackTrace() {
      var err = new Error();
      if (!err.stack) {
        // IE10+ special cases: It does have callstack info, but it is only populated if an Error object is thrown,
        // so try that as a special-case.
        try {
          throw new Error(0);
        } catch(e) {
          err = e;
        }
        if (!err.stack) {
          return '(no stack trace available)';
        }
      }
      return err.stack.toString();
    }

  function stackTrace() {
      var js = jsStackTrace();
      if (Module['extraStackTrace']) js += '\n' + Module['extraStackTrace']();
      return demangleAll(js);
    }

  function ___handle_stack_overflow() {
      abort('stack overflow')
    }

  function ___lock() {}

  function ___unlock() {}

  
  var structRegistrations={};
  
  function runDestructors(destructors) {
      while (destructors.length) {
          var ptr = destructors.pop();
          var del = destructors.pop();
          del(ptr);
      }
    }
  
  function simpleReadValueFromPointer(pointer) {
      return this['fromWireType'](HEAPU32[pointer >> 2]);
    }
  
  
  var awaitingDependencies={};
  
  var registeredTypes={};
  
  var typeDependencies={};
  
  
  
  
  
  
  var char_0=48;
  
  var char_9=57;function makeLegalFunctionName(name) {
      if (undefined === name) {
          return '_unknown';
      }
      name = name.replace(/[^a-zA-Z0-9_]/g, '$');
      var f = name.charCodeAt(0);
      if (f >= char_0 && f <= char_9) {
          return '_' + name;
      } else {
          return name;
      }
    }function createNamedFunction(name, body) {
      name = makeLegalFunctionName(name);
      /*jshint evil:true*/
      return new Function(
          "body",
          "return function " + name + "() {\n" +
          "    \"use strict\";" +
          "    return body.apply(this, arguments);\n" +
          "};\n"
      )(body);
    }function extendError(baseErrorType, errorName) {
      var errorClass = createNamedFunction(errorName, function(message) {
          this.name = errorName;
          this.message = message;
  
          var stack = (new Error(message)).stack;
          if (stack !== undefined) {
              this.stack = this.toString() + '\n' +
                  stack.replace(/^Error(:[^\n]*)?\n/, '');
          }
      });
      errorClass.prototype = Object.create(baseErrorType.prototype);
      errorClass.prototype.constructor = errorClass;
      errorClass.prototype.toString = function() {
          if (this.message === undefined) {
              return this.name;
          } else {
              return this.name + ': ' + this.message;
          }
      };
  
      return errorClass;
    }var InternalError=undefined;function throwInternalError(message) {
      throw new InternalError(message);
    }function whenDependentTypesAreResolved(myTypes, dependentTypes, getTypeConverters) {
      myTypes.forEach(function(type) {
          typeDependencies[type] = dependentTypes;
      });
  
      function onComplete(typeConverters) {
          var myTypeConverters = getTypeConverters(typeConverters);
          if (myTypeConverters.length !== myTypes.length) {
              throwInternalError('Mismatched type converter count');
          }
          for (var i = 0; i < myTypes.length; ++i) {
              registerType(myTypes[i], myTypeConverters[i]);
          }
      }
  
      var typeConverters = new Array(dependentTypes.length);
      var unregisteredTypes = [];
      var registered = 0;
      dependentTypes.forEach(function(dt, i) {
          if (registeredTypes.hasOwnProperty(dt)) {
              typeConverters[i] = registeredTypes[dt];
          } else {
              unregisteredTypes.push(dt);
              if (!awaitingDependencies.hasOwnProperty(dt)) {
                  awaitingDependencies[dt] = [];
              }
              awaitingDependencies[dt].push(function() {
                  typeConverters[i] = registeredTypes[dt];
                  ++registered;
                  if (registered === unregisteredTypes.length) {
                      onComplete(typeConverters);
                  }
              });
          }
      });
      if (0 === unregisteredTypes.length) {
          onComplete(typeConverters);
      }
    }function __embind_finalize_value_object(structType) {
      var reg = structRegistrations[structType];
      delete structRegistrations[structType];
  
      var rawConstructor = reg.rawConstructor;
      var rawDestructor = reg.rawDestructor;
      var fieldRecords = reg.fields;
      var fieldTypes = fieldRecords.map(function(field) { return field.getterReturnType; }).
                concat(fieldRecords.map(function(field) { return field.setterArgumentType; }));
      whenDependentTypesAreResolved([structType], fieldTypes, function(fieldTypes) {
          var fields = {};
          fieldRecords.forEach(function(field, i) {
              var fieldName = field.fieldName;
              var getterReturnType = fieldTypes[i];
              var getter = field.getter;
              var getterContext = field.getterContext;
              var setterArgumentType = fieldTypes[i + fieldRecords.length];
              var setter = field.setter;
              var setterContext = field.setterContext;
              fields[fieldName] = {
                  read: function(ptr) {
                      return getterReturnType['fromWireType'](
                          getter(getterContext, ptr));
                  },
                  write: function(ptr, o) {
                      var destructors = [];
                      setter(setterContext, ptr, setterArgumentType['toWireType'](destructors, o));
                      runDestructors(destructors);
                  }
              };
          });
  
          return [{
              name: reg.name,
              'fromWireType': function(ptr) {
                  var rv = {};
                  for (var i in fields) {
                      rv[i] = fields[i].read(ptr);
                  }
                  rawDestructor(ptr);
                  return rv;
              },
              'toWireType': function(destructors, o) {
                  // todo: Here we have an opportunity for -O3 level "unsafe" optimizations:
                  // assume all fields are present without checking.
                  for (var fieldName in fields) {
                      if (!(fieldName in o)) {
                          throw new TypeError('Missing field');
                      }
                  }
                  var ptr = rawConstructor();
                  for (fieldName in fields) {
                      fields[fieldName].write(ptr, o[fieldName]);
                  }
                  if (destructors !== null) {
                      destructors.push(rawDestructor, ptr);
                  }
                  return ptr;
              },
              'argPackAdvance': 8,
              'readValueFromPointer': simpleReadValueFromPointer,
              destructorFunction: rawDestructor,
          }];
      });
    }

  
  function getShiftFromSize(size) {
      switch (size) {
          case 1: return 0;
          case 2: return 1;
          case 4: return 2;
          case 8: return 3;
          default:
              throw new TypeError('Unknown type size: ' + size);
      }
    }
  
  
  
  function embind_init_charCodes() {
      var codes = new Array(256);
      for (var i = 0; i < 256; ++i) {
          codes[i] = String.fromCharCode(i);
      }
      embind_charCodes = codes;
    }var embind_charCodes=undefined;function readLatin1String(ptr) {
      var ret = "";
      var c = ptr;
      while (HEAPU8[c]) {
          ret += embind_charCodes[HEAPU8[c++]];
      }
      return ret;
    }
  
  
  
  var BindingError=undefined;function throwBindingError(message) {
      throw new BindingError(message);
    }function registerType(rawType, registeredInstance, options) {
      options = options || {};
  
      if (!('argPackAdvance' in registeredInstance)) {
          throw new TypeError('registerType registeredInstance requires argPackAdvance');
      }
  
      var name = registeredInstance.name;
      if (!rawType) {
          throwBindingError('type "' + name + '" must have a positive integer typeid pointer');
      }
      if (registeredTypes.hasOwnProperty(rawType)) {
          if (options.ignoreDuplicateRegistrations) {
              return;
          } else {
              throwBindingError("Cannot register type '" + name + "' twice");
          }
      }
  
      registeredTypes[rawType] = registeredInstance;
      delete typeDependencies[rawType];
  
      if (awaitingDependencies.hasOwnProperty(rawType)) {
          var callbacks = awaitingDependencies[rawType];
          delete awaitingDependencies[rawType];
          callbacks.forEach(function(cb) {
              cb();
          });
      }
    }function __embind_register_bool(rawType, name, size, trueValue, falseValue) {
      var shift = getShiftFromSize(size);
  
      name = readLatin1String(name);
      registerType(rawType, {
          name: name,
          'fromWireType': function(wt) {
              // ambiguous emscripten ABI: sometimes return values are
              // true or false, and sometimes integers (0 or 1)
              return !!wt;
          },
          'toWireType': function(destructors, o) {
              return o ? trueValue : falseValue;
          },
          'argPackAdvance': 8,
          'readValueFromPointer': function(pointer) {
              // TODO: if heap is fixed (like in asm.js) this could be executed outside
              var heap;
              if (size === 1) {
                  heap = HEAP8;
              } else if (size === 2) {
                  heap = HEAP16;
              } else if (size === 4) {
                  heap = HEAP32;
              } else {
                  throw new TypeError("Unknown boolean type size: " + name);
              }
              return this['fromWireType'](heap[pointer >> shift]);
          },
          destructorFunction: null, // This type does not need a destructor
      });
    }

  
  
  
  function ClassHandle_isAliasOf(other) {
      if (!(this instanceof ClassHandle)) {
          return false;
      }
      if (!(other instanceof ClassHandle)) {
          return false;
      }
  
      var leftClass = this.$$.ptrType.registeredClass;
      var left = this.$$.ptr;
      var rightClass = other.$$.ptrType.registeredClass;
      var right = other.$$.ptr;
  
      while (leftClass.baseClass) {
          left = leftClass.upcast(left);
          leftClass = leftClass.baseClass;
      }
  
      while (rightClass.baseClass) {
          right = rightClass.upcast(right);
          rightClass = rightClass.baseClass;
      }
  
      return leftClass === rightClass && left === right;
    }
  
  
  function shallowCopyInternalPointer(o) {
      return {
          count: o.count,
          deleteScheduled: o.deleteScheduled,
          preservePointerOnDelete: o.preservePointerOnDelete,
          ptr: o.ptr,
          ptrType: o.ptrType,
          smartPtr: o.smartPtr,
          smartPtrType: o.smartPtrType,
      };
    }
  
  function throwInstanceAlreadyDeleted(obj) {
      function getInstanceTypeName(handle) {
        return handle.$$.ptrType.registeredClass.name;
      }
      throwBindingError(getInstanceTypeName(obj) + ' instance already deleted');
    }
  
  
  var finalizationGroup=false;
  
  function detachFinalizer(handle) {}
  
  
  function runDestructor($$) {
      if ($$.smartPtr) {
          $$.smartPtrType.rawDestructor($$.smartPtr);
      } else {
          $$.ptrType.registeredClass.rawDestructor($$.ptr);
      }
    }function releaseClassHandle($$) {
      $$.count.value -= 1;
      var toDelete = 0 === $$.count.value;
      if (toDelete) {
          runDestructor($$);
      }
    }function attachFinalizer(handle) {
      if ('undefined' === typeof FinalizationGroup) {
          attachFinalizer = function (handle) { return handle; };
          return handle;
      }
      // If the running environment has a FinalizationGroup (see
      // https://github.com/tc39/proposal-weakrefs), then attach finalizers
      // for class handles.  We check for the presence of FinalizationGroup
      // at run-time, not build-time.
      finalizationGroup = new FinalizationGroup(function (iter) {
          for (var result = iter.next(); !result.done; result = iter.next()) {
              var $$ = result.value;
              if (!$$.ptr) {
                  console.warn('object already deleted: ' + $$.ptr);
              } else {
                  releaseClassHandle($$);
              }
          }
      });
      attachFinalizer = function(handle) {
          finalizationGroup.register(handle, handle.$$, handle.$$);
          return handle;
      };
      detachFinalizer = function(handle) {
          finalizationGroup.unregister(handle.$$);
      };
      return attachFinalizer(handle);
    }function ClassHandle_clone() {
      if (!this.$$.ptr) {
          throwInstanceAlreadyDeleted(this);
      }
  
      if (this.$$.preservePointerOnDelete) {
          this.$$.count.value += 1;
          return this;
      } else {
          var clone = attachFinalizer(Object.create(Object.getPrototypeOf(this), {
              $$: {
                  value: shallowCopyInternalPointer(this.$$),
              }
          }));
  
          clone.$$.count.value += 1;
          clone.$$.deleteScheduled = false;
          return clone;
      }
    }
  
  function ClassHandle_delete() {
      if (!this.$$.ptr) {
          throwInstanceAlreadyDeleted(this);
      }
  
      if (this.$$.deleteScheduled && !this.$$.preservePointerOnDelete) {
          throwBindingError('Object already scheduled for deletion');
      }
  
      detachFinalizer(this);
      releaseClassHandle(this.$$);
  
      if (!this.$$.preservePointerOnDelete) {
          this.$$.smartPtr = undefined;
          this.$$.ptr = undefined;
      }
    }
  
  function ClassHandle_isDeleted() {
      return !this.$$.ptr;
    }
  
  
  var delayFunction=undefined;
  
  var deletionQueue=[];
  
  function flushPendingDeletes() {
      while (deletionQueue.length) {
          var obj = deletionQueue.pop();
          obj.$$.deleteScheduled = false;
          obj['delete']();
      }
    }function ClassHandle_deleteLater() {
      if (!this.$$.ptr) {
          throwInstanceAlreadyDeleted(this);
      }
      if (this.$$.deleteScheduled && !this.$$.preservePointerOnDelete) {
          throwBindingError('Object already scheduled for deletion');
      }
      deletionQueue.push(this);
      if (deletionQueue.length === 1 && delayFunction) {
          delayFunction(flushPendingDeletes);
      }
      this.$$.deleteScheduled = true;
      return this;
    }function init_ClassHandle() {
      ClassHandle.prototype['isAliasOf'] = ClassHandle_isAliasOf;
      ClassHandle.prototype['clone'] = ClassHandle_clone;
      ClassHandle.prototype['delete'] = ClassHandle_delete;
      ClassHandle.prototype['isDeleted'] = ClassHandle_isDeleted;
      ClassHandle.prototype['deleteLater'] = ClassHandle_deleteLater;
    }function ClassHandle() {
    }
  
  var registeredPointers={};
  
  
  function ensureOverloadTable(proto, methodName, humanName) {
      if (undefined === proto[methodName].overloadTable) {
          var prevFunc = proto[methodName];
          // Inject an overload resolver function that routes to the appropriate overload based on the number of arguments.
          proto[methodName] = function() {
              // TODO This check can be removed in -O3 level "unsafe" optimizations.
              if (!proto[methodName].overloadTable.hasOwnProperty(arguments.length)) {
                  throwBindingError("Function '" + humanName + "' called with an invalid number of arguments (" + arguments.length + ") - expects one of (" + proto[methodName].overloadTable + ")!");
              }
              return proto[methodName].overloadTable[arguments.length].apply(this, arguments);
          };
          // Move the previous function into the overload table.
          proto[methodName].overloadTable = [];
          proto[methodName].overloadTable[prevFunc.argCount] = prevFunc;
      }
    }function exposePublicSymbol(name, value, numArguments) {
      if (Module.hasOwnProperty(name)) {
          if (undefined === numArguments || (undefined !== Module[name].overloadTable && undefined !== Module[name].overloadTable[numArguments])) {
              throwBindingError("Cannot register public name '" + name + "' twice");
          }
  
          // We are exposing a function with the same name as an existing function. Create an overload table and a function selector
          // that routes between the two.
          ensureOverloadTable(Module, name, name);
          if (Module.hasOwnProperty(numArguments)) {
              throwBindingError("Cannot register multiple overloads of a function with the same number of arguments (" + numArguments + ")!");
          }
          // Add the new function into the overload table.
          Module[name].overloadTable[numArguments] = value;
      }
      else {
          Module[name] = value;
          if (undefined !== numArguments) {
              Module[name].numArguments = numArguments;
          }
      }
    }
  
  function RegisteredClass(
      name,
      constructor,
      instancePrototype,
      rawDestructor,
      baseClass,
      getActualType,
      upcast,
      downcast
    ) {
      this.name = name;
      this.constructor = constructor;
      this.instancePrototype = instancePrototype;
      this.rawDestructor = rawDestructor;
      this.baseClass = baseClass;
      this.getActualType = getActualType;
      this.upcast = upcast;
      this.downcast = downcast;
      this.pureVirtualFunctions = [];
    }
  
  
  
  function upcastPointer(ptr, ptrClass, desiredClass) {
      while (ptrClass !== desiredClass) {
          if (!ptrClass.upcast) {
              throwBindingError("Expected null or instance of " + desiredClass.name + ", got an instance of " + ptrClass.name);
          }
          ptr = ptrClass.upcast(ptr);
          ptrClass = ptrClass.baseClass;
      }
      return ptr;
    }function constNoSmartPtrRawPointerToWireType(destructors, handle) {
      if (handle === null) {
          if (this.isReference) {
              throwBindingError('null is not a valid ' + this.name);
          }
          return 0;
      }
  
      if (!handle.$$) {
          throwBindingError('Cannot pass "' + _embind_repr(handle) + '" as a ' + this.name);
      }
      if (!handle.$$.ptr) {
          throwBindingError('Cannot pass deleted object as a pointer of type ' + this.name);
      }
      var handleClass = handle.$$.ptrType.registeredClass;
      var ptr = upcastPointer(handle.$$.ptr, handleClass, this.registeredClass);
      return ptr;
    }
  
  function genericPointerToWireType(destructors, handle) {
      var ptr;
      if (handle === null) {
          if (this.isReference) {
              throwBindingError('null is not a valid ' + this.name);
          }
  
          if (this.isSmartPointer) {
              ptr = this.rawConstructor();
              if (destructors !== null) {
                  destructors.push(this.rawDestructor, ptr);
              }
              return ptr;
          } else {
              return 0;
          }
      }
  
      if (!handle.$$) {
          throwBindingError('Cannot pass "' + _embind_repr(handle) + '" as a ' + this.name);
      }
      if (!handle.$$.ptr) {
          throwBindingError('Cannot pass deleted object as a pointer of type ' + this.name);
      }
      if (!this.isConst && handle.$$.ptrType.isConst) {
          throwBindingError('Cannot convert argument of type ' + (handle.$$.smartPtrType ? handle.$$.smartPtrType.name : handle.$$.ptrType.name) + ' to parameter type ' + this.name);
      }
      var handleClass = handle.$$.ptrType.registeredClass;
      ptr = upcastPointer(handle.$$.ptr, handleClass, this.registeredClass);
  
      if (this.isSmartPointer) {
          // TODO: this is not strictly true
          // We could support BY_EMVAL conversions from raw pointers to smart pointers
          // because the smart pointer can hold a reference to the handle
          if (undefined === handle.$$.smartPtr) {
              throwBindingError('Passing raw pointer to smart pointer is illegal');
          }
  
          switch (this.sharingPolicy) {
              case 0: // NONE
                  // no upcasting
                  if (handle.$$.smartPtrType === this) {
                      ptr = handle.$$.smartPtr;
                  } else {
                      throwBindingError('Cannot convert argument of type ' + (handle.$$.smartPtrType ? handle.$$.smartPtrType.name : handle.$$.ptrType.name) + ' to parameter type ' + this.name);
                  }
                  break;
  
              case 1: // INTRUSIVE
                  ptr = handle.$$.smartPtr;
                  break;
  
              case 2: // BY_EMVAL
                  if (handle.$$.smartPtrType === this) {
                      ptr = handle.$$.smartPtr;
                  } else {
                      var clonedHandle = handle['clone']();
                      ptr = this.rawShare(
                          ptr,
                          __emval_register(function() {
                              clonedHandle['delete']();
                          })
                      );
                      if (destructors !== null) {
                          destructors.push(this.rawDestructor, ptr);
                      }
                  }
                  break;
  
              default:
                  throwBindingError('Unsupporting sharing policy');
          }
      }
      return ptr;
    }
  
  function nonConstNoSmartPtrRawPointerToWireType(destructors, handle) {
      if (handle === null) {
          if (this.isReference) {
              throwBindingError('null is not a valid ' + this.name);
          }
          return 0;
      }
  
      if (!handle.$$) {
          throwBindingError('Cannot pass "' + _embind_repr(handle) + '" as a ' + this.name);
      }
      if (!handle.$$.ptr) {
          throwBindingError('Cannot pass deleted object as a pointer of type ' + this.name);
      }
      if (handle.$$.ptrType.isConst) {
          throwBindingError('Cannot convert argument of type ' + handle.$$.ptrType.name + ' to parameter type ' + this.name);
      }
      var handleClass = handle.$$.ptrType.registeredClass;
      var ptr = upcastPointer(handle.$$.ptr, handleClass, this.registeredClass);
      return ptr;
    }
  
  
  function RegisteredPointer_getPointee(ptr) {
      if (this.rawGetPointee) {
          ptr = this.rawGetPointee(ptr);
      }
      return ptr;
    }
  
  function RegisteredPointer_destructor(ptr) {
      if (this.rawDestructor) {
          this.rawDestructor(ptr);
      }
    }
  
  function RegisteredPointer_deleteObject(handle) {
      if (handle !== null) {
          handle['delete']();
      }
    }
  
  
  function downcastPointer(ptr, ptrClass, desiredClass) {
      if (ptrClass === desiredClass) {
          return ptr;
      }
      if (undefined === desiredClass.baseClass) {
          return null; // no conversion
      }
  
      var rv = downcastPointer(ptr, ptrClass, desiredClass.baseClass);
      if (rv === null) {
          return null;
      }
      return desiredClass.downcast(rv);
    }
  
  
  
  
  function getInheritedInstanceCount() {
      return Object.keys(registeredInstances).length;
    }
  
  function getLiveInheritedInstances() {
      var rv = [];
      for (var k in registeredInstances) {
          if (registeredInstances.hasOwnProperty(k)) {
              rv.push(registeredInstances[k]);
          }
      }
      return rv;
    }
  
  function setDelayFunction(fn) {
      delayFunction = fn;
      if (deletionQueue.length && delayFunction) {
          delayFunction(flushPendingDeletes);
      }
    }function init_embind() {
      Module['getInheritedInstanceCount'] = getInheritedInstanceCount;
      Module['getLiveInheritedInstances'] = getLiveInheritedInstances;
      Module['flushPendingDeletes'] = flushPendingDeletes;
      Module['setDelayFunction'] = setDelayFunction;
    }var registeredInstances={};
  
  function getBasestPointer(class_, ptr) {
      if (ptr === undefined) {
          throwBindingError('ptr should not be undefined');
      }
      while (class_.baseClass) {
          ptr = class_.upcast(ptr);
          class_ = class_.baseClass;
      }
      return ptr;
    }function getInheritedInstance(class_, ptr) {
      ptr = getBasestPointer(class_, ptr);
      return registeredInstances[ptr];
    }
  
  function makeClassHandle(prototype, record) {
      if (!record.ptrType || !record.ptr) {
          throwInternalError('makeClassHandle requires ptr and ptrType');
      }
      var hasSmartPtrType = !!record.smartPtrType;
      var hasSmartPtr = !!record.smartPtr;
      if (hasSmartPtrType !== hasSmartPtr) {
          throwInternalError('Both smartPtrType and smartPtr must be specified');
      }
      record.count = { value: 1 };
      return attachFinalizer(Object.create(prototype, {
          $$: {
              value: record,
          },
      }));
    }function RegisteredPointer_fromWireType(ptr) {
      // ptr is a raw pointer (or a raw smartpointer)
  
      // rawPointer is a maybe-null raw pointer
      var rawPointer = this.getPointee(ptr);
      if (!rawPointer) {
          this.destructor(ptr);
          return null;
      }
  
      var registeredInstance = getInheritedInstance(this.registeredClass, rawPointer);
      if (undefined !== registeredInstance) {
          // JS object has been neutered, time to repopulate it
          if (0 === registeredInstance.$$.count.value) {
              registeredInstance.$$.ptr = rawPointer;
              registeredInstance.$$.smartPtr = ptr;
              return registeredInstance['clone']();
          } else {
              // else, just increment reference count on existing object
              // it already has a reference to the smart pointer
              var rv = registeredInstance['clone']();
              this.destructor(ptr);
              return rv;
          }
      }
  
      function makeDefaultHandle() {
          if (this.isSmartPointer) {
              return makeClassHandle(this.registeredClass.instancePrototype, {
                  ptrType: this.pointeeType,
                  ptr: rawPointer,
                  smartPtrType: this,
                  smartPtr: ptr,
              });
          } else {
              return makeClassHandle(this.registeredClass.instancePrototype, {
                  ptrType: this,
                  ptr: ptr,
              });
          }
      }
  
      var actualType = this.registeredClass.getActualType(rawPointer);
      var registeredPointerRecord = registeredPointers[actualType];
      if (!registeredPointerRecord) {
          return makeDefaultHandle.call(this);
      }
  
      var toType;
      if (this.isConst) {
          toType = registeredPointerRecord.constPointerType;
      } else {
          toType = registeredPointerRecord.pointerType;
      }
      var dp = downcastPointer(
          rawPointer,
          this.registeredClass,
          toType.registeredClass);
      if (dp === null) {
          return makeDefaultHandle.call(this);
      }
      if (this.isSmartPointer) {
          return makeClassHandle(toType.registeredClass.instancePrototype, {
              ptrType: toType,
              ptr: dp,
              smartPtrType: this,
              smartPtr: ptr,
          });
      } else {
          return makeClassHandle(toType.registeredClass.instancePrototype, {
              ptrType: toType,
              ptr: dp,
          });
      }
    }function init_RegisteredPointer() {
      RegisteredPointer.prototype.getPointee = RegisteredPointer_getPointee;
      RegisteredPointer.prototype.destructor = RegisteredPointer_destructor;
      RegisteredPointer.prototype['argPackAdvance'] = 8;
      RegisteredPointer.prototype['readValueFromPointer'] = simpleReadValueFromPointer;
      RegisteredPointer.prototype['deleteObject'] = RegisteredPointer_deleteObject;
      RegisteredPointer.prototype['fromWireType'] = RegisteredPointer_fromWireType;
    }function RegisteredPointer(
      name,
      registeredClass,
      isReference,
      isConst,
  
      // smart pointer properties
      isSmartPointer,
      pointeeType,
      sharingPolicy,
      rawGetPointee,
      rawConstructor,
      rawShare,
      rawDestructor
    ) {
      this.name = name;
      this.registeredClass = registeredClass;
      this.isReference = isReference;
      this.isConst = isConst;
  
      // smart pointer properties
      this.isSmartPointer = isSmartPointer;
      this.pointeeType = pointeeType;
      this.sharingPolicy = sharingPolicy;
      this.rawGetPointee = rawGetPointee;
      this.rawConstructor = rawConstructor;
      this.rawShare = rawShare;
      this.rawDestructor = rawDestructor;
  
      if (!isSmartPointer && registeredClass.baseClass === undefined) {
          if (isConst) {
              this['toWireType'] = constNoSmartPtrRawPointerToWireType;
              this.destructorFunction = null;
          } else {
              this['toWireType'] = nonConstNoSmartPtrRawPointerToWireType;
              this.destructorFunction = null;
          }
      } else {
          this['toWireType'] = genericPointerToWireType;
          // Here we must leave this.destructorFunction undefined, since whether genericPointerToWireType returns
          // a pointer that needs to be freed up is runtime-dependent, and cannot be evaluated at registration time.
          // TODO: Create an alternative mechanism that allows removing the use of var destructors = []; array in
          //       craftInvokerFunction altogether.
      }
    }
  
  function replacePublicSymbol(name, value, numArguments) {
      if (!Module.hasOwnProperty(name)) {
          throwInternalError('Replacing nonexistant public symbol');
      }
      // If there's an overload table for this symbol, replace the symbol in the overload table instead.
      if (undefined !== Module[name].overloadTable && undefined !== numArguments) {
          Module[name].overloadTable[numArguments] = value;
      }
      else {
          Module[name] = value;
          Module[name].argCount = numArguments;
      }
    }
  
  function embind__requireFunction(signature, rawFunction) {
      signature = readLatin1String(signature);
  
      function makeDynCaller(dynCall) {
          var args = [];
          for (var i = 1; i < signature.length; ++i) {
              args.push('a' + i);
          }
  
          var name = 'dynCall_' + signature + '_' + rawFunction;
          var body = 'return function ' + name + '(' + args.join(', ') + ') {\n';
          body    += '    return dynCall(rawFunction' + (args.length ? ', ' : '') + args.join(', ') + ');\n';
          body    += '};\n';
  
          return (new Function('dynCall', 'rawFunction', body))(dynCall, rawFunction);
      }
  
      var fp;
      if (Module['FUNCTION_TABLE_' + signature] !== undefined) {
          fp = Module['FUNCTION_TABLE_' + signature][rawFunction];
      } else if (typeof FUNCTION_TABLE !== "undefined") {
          fp = FUNCTION_TABLE[rawFunction];
      } else {
          // asm.js does not give direct access to the function tables,
          // and thus we must go through the dynCall interface which allows
          // calling into a signature's function table by pointer value.
          //
          // https://github.com/dherman/asm.js/issues/83
          //
          // This has three main penalties:
          // - dynCall is another function call in the path from JavaScript to C++.
          // - JITs may not predict through the function table indirection at runtime.
          var dc = Module['dynCall_' + signature];
          if (dc === undefined) {
              // We will always enter this branch if the signature
              // contains 'f' and PRECISE_F32 is not enabled.
              //
              // Try again, replacing 'f' with 'd'.
              dc = Module['dynCall_' + signature.replace(/f/g, 'd')];
              if (dc === undefined) {
                  throwBindingError("No dynCall invoker for signature: " + signature);
              }
          }
          fp = makeDynCaller(dc);
      }
  
      if (typeof fp !== "function") {
          throwBindingError("unknown function pointer with signature " + signature + ": " + rawFunction);
      }
      return fp;
    }
  
  
  var UnboundTypeError=undefined;
  
  function getTypeName(type) {
      var ptr = ___getTypeName(type);
      var rv = readLatin1String(ptr);
      _free(ptr);
      return rv;
    }function throwUnboundTypeError(message, types) {
      var unboundTypes = [];
      var seen = {};
      function visit(type) {
          if (seen[type]) {
              return;
          }
          if (registeredTypes[type]) {
              return;
          }
          if (typeDependencies[type]) {
              typeDependencies[type].forEach(visit);
              return;
          }
          unboundTypes.push(type);
          seen[type] = true;
      }
      types.forEach(visit);
  
      throw new UnboundTypeError(message + ': ' + unboundTypes.map(getTypeName).join([', ']));
    }function __embind_register_class(
      rawType,
      rawPointerType,
      rawConstPointerType,
      baseClassRawType,
      getActualTypeSignature,
      getActualType,
      upcastSignature,
      upcast,
      downcastSignature,
      downcast,
      name,
      destructorSignature,
      rawDestructor
    ) {
      name = readLatin1String(name);
      getActualType = embind__requireFunction(getActualTypeSignature, getActualType);
      if (upcast) {
          upcast = embind__requireFunction(upcastSignature, upcast);
      }
      if (downcast) {
          downcast = embind__requireFunction(downcastSignature, downcast);
      }
      rawDestructor = embind__requireFunction(destructorSignature, rawDestructor);
      var legalFunctionName = makeLegalFunctionName(name);
  
      exposePublicSymbol(legalFunctionName, function() {
          // this code cannot run if baseClassRawType is zero
          throwUnboundTypeError('Cannot construct ' + name + ' due to unbound types', [baseClassRawType]);
      });
  
      whenDependentTypesAreResolved(
          [rawType, rawPointerType, rawConstPointerType],
          baseClassRawType ? [baseClassRawType] : [],
          function(base) {
              base = base[0];
  
              var baseClass;
              var basePrototype;
              if (baseClassRawType) {
                  baseClass = base.registeredClass;
                  basePrototype = baseClass.instancePrototype;
              } else {
                  basePrototype = ClassHandle.prototype;
              }
  
              var constructor = createNamedFunction(legalFunctionName, function() {
                  if (Object.getPrototypeOf(this) !== instancePrototype) {
                      throw new BindingError("Use 'new' to construct " + name);
                  }
                  if (undefined === registeredClass.constructor_body) {
                      throw new BindingError(name + " has no accessible constructor");
                  }
                  var body = registeredClass.constructor_body[arguments.length];
                  if (undefined === body) {
                      throw new BindingError("Tried to invoke ctor of " + name + " with invalid number of parameters (" + arguments.length + ") - expected (" + Object.keys(registeredClass.constructor_body).toString() + ") parameters instead!");
                  }
                  return body.apply(this, arguments);
              });
  
              var instancePrototype = Object.create(basePrototype, {
                  constructor: { value: constructor },
              });
  
              constructor.prototype = instancePrototype;
  
              var registeredClass = new RegisteredClass(
                  name,
                  constructor,
                  instancePrototype,
                  rawDestructor,
                  baseClass,
                  getActualType,
                  upcast,
                  downcast);
  
              var referenceConverter = new RegisteredPointer(
                  name,
                  registeredClass,
                  true,
                  false,
                  false);
  
              var pointerConverter = new RegisteredPointer(
                  name + '*',
                  registeredClass,
                  false,
                  false,
                  false);
  
              var constPointerConverter = new RegisteredPointer(
                  name + ' const*',
                  registeredClass,
                  false,
                  true,
                  false);
  
              registeredPointers[rawType] = {
                  pointerType: pointerConverter,
                  constPointerType: constPointerConverter
              };
  
              replacePublicSymbol(legalFunctionName, constructor);
  
              return [referenceConverter, pointerConverter, constPointerConverter];
          }
      );
    }

  
  function heap32VectorToArray(count, firstElement) {
      var array = [];
      for (var i = 0; i < count; i++) {
          array.push(HEAP32[(firstElement >> 2) + i]);
      }
      return array;
    }function __embind_register_class_constructor(
      rawClassType,
      argCount,
      rawArgTypesAddr,
      invokerSignature,
      invoker,
      rawConstructor
    ) {
      assert(argCount > 0);
      var rawArgTypes = heap32VectorToArray(argCount, rawArgTypesAddr);
      invoker = embind__requireFunction(invokerSignature, invoker);
      var args = [rawConstructor];
      var destructors = [];
  
      whenDependentTypesAreResolved([], [rawClassType], function(classType) {
          classType = classType[0];
          var humanName = 'constructor ' + classType.name;
  
          if (undefined === classType.registeredClass.constructor_body) {
              classType.registeredClass.constructor_body = [];
          }
          if (undefined !== classType.registeredClass.constructor_body[argCount - 1]) {
              throw new BindingError("Cannot register multiple constructors with identical number of parameters (" + (argCount-1) + ") for class '" + classType.name + "'! Overload resolution is currently only performed using the parameter count, not actual type info!");
          }
          classType.registeredClass.constructor_body[argCount - 1] = function unboundTypeHandler() {
              throwUnboundTypeError('Cannot construct ' + classType.name + ' due to unbound types', rawArgTypes);
          };
  
          whenDependentTypesAreResolved([], rawArgTypes, function(argTypes) {
              classType.registeredClass.constructor_body[argCount - 1] = function constructor_body() {
                  if (arguments.length !== argCount - 1) {
                      throwBindingError(humanName + ' called with ' + arguments.length + ' arguments, expected ' + (argCount-1));
                  }
                  destructors.length = 0;
                  args.length = argCount;
                  for (var i = 1; i < argCount; ++i) {
                      args[i] = argTypes[i]['toWireType'](destructors, arguments[i - 1]);
                  }
  
                  var ptr = invoker.apply(null, args);
                  runDestructors(destructors);
  
                  return argTypes[0]['fromWireType'](ptr);
              };
              return [];
          });
          return [];
      });
    }

  
  
  function new_(constructor, argumentList) {
      if (!(constructor instanceof Function)) {
          throw new TypeError('new_ called with constructor type ' + typeof(constructor) + " which is not a function");
      }
  
      /*
       * Previously, the following line was just:
  
       function dummy() {};
  
       * Unfortunately, Chrome was preserving 'dummy' as the object's name, even though at creation, the 'dummy' has the
       * correct constructor name.  Thus, objects created with IMVU.new would show up in the debugger as 'dummy', which
       * isn't very helpful.  Using IMVU.createNamedFunction addresses the issue.  Doublely-unfortunately, there's no way
       * to write a test for this behavior.  -NRD 2013.02.22
       */
      var dummy = createNamedFunction(constructor.name || 'unknownFunctionName', function(){});
      dummy.prototype = constructor.prototype;
      var obj = new dummy;
  
      var r = constructor.apply(obj, argumentList);
      return (r instanceof Object) ? r : obj;
    }function craftInvokerFunction(humanName, argTypes, classType, cppInvokerFunc, cppTargetFunc) {
      // humanName: a human-readable string name for the function to be generated.
      // argTypes: An array that contains the embind type objects for all types in the function signature.
      //    argTypes[0] is the type object for the function return value.
      //    argTypes[1] is the type object for function this object/class type, or null if not crafting an invoker for a class method.
      //    argTypes[2...] are the actual function parameters.
      // classType: The embind type object for the class to be bound, or null if this is not a method of a class.
      // cppInvokerFunc: JS Function object to the C++-side function that interops into C++ code.
      // cppTargetFunc: Function pointer (an integer to FUNCTION_TABLE) to the target C++ function the cppInvokerFunc will end up calling.
      var argCount = argTypes.length;
  
      if (argCount < 2) {
          throwBindingError("argTypes array size mismatch! Must at least get return value and 'this' types!");
      }
  
      var isClassMethodFunc = (argTypes[1] !== null && classType !== null);
  
      // Free functions with signature "void function()" do not need an invoker that marshalls between wire types.
  // TODO: This omits argument count check - enable only at -O3 or similar.
  //    if (ENABLE_UNSAFE_OPTS && argCount == 2 && argTypes[0].name == "void" && !isClassMethodFunc) {
  //       return FUNCTION_TABLE[fn];
  //    }
  
  
      // Determine if we need to use a dynamic stack to store the destructors for the function parameters.
      // TODO: Remove this completely once all function invokers are being dynamically generated.
      var needsDestructorStack = false;
  
      for(var i = 1; i < argTypes.length; ++i) { // Skip return value at index 0 - it's not deleted here.
          if (argTypes[i] !== null && argTypes[i].destructorFunction === undefined) { // The type does not define a destructor function - must use dynamic stack
              needsDestructorStack = true;
              break;
          }
      }
  
      var returns = (argTypes[0].name !== "void");
  
      var argsList = "";
      var argsListWired = "";
      for(var i = 0; i < argCount - 2; ++i) {
          argsList += (i!==0?", ":"")+"arg"+i;
          argsListWired += (i!==0?", ":"")+"arg"+i+"Wired";
      }
  
      var invokerFnBody =
          "return function "+makeLegalFunctionName(humanName)+"("+argsList+") {\n" +
          "if (arguments.length !== "+(argCount - 2)+") {\n" +
              "throwBindingError('function "+humanName+" called with ' + arguments.length + ' arguments, expected "+(argCount - 2)+" args!');\n" +
          "}\n";
  
  
      if (needsDestructorStack) {
          invokerFnBody +=
              "var destructors = [];\n";
      }
  
      var dtorStack = needsDestructorStack ? "destructors" : "null";
      var args1 = ["throwBindingError", "invoker", "fn", "runDestructors", "retType", "classParam"];
      var args2 = [throwBindingError, cppInvokerFunc, cppTargetFunc, runDestructors, argTypes[0], argTypes[1]];
  
  
      if (isClassMethodFunc) {
          invokerFnBody += "var thisWired = classParam.toWireType("+dtorStack+", this);\n";
      }
  
      for(var i = 0; i < argCount - 2; ++i) {
          invokerFnBody += "var arg"+i+"Wired = argType"+i+".toWireType("+dtorStack+", arg"+i+"); // "+argTypes[i+2].name+"\n";
          args1.push("argType"+i);
          args2.push(argTypes[i+2]);
      }
  
      if (isClassMethodFunc) {
          argsListWired = "thisWired" + (argsListWired.length > 0 ? ", " : "") + argsListWired;
      }
  
      invokerFnBody +=
          (returns?"var rv = ":"") + "invoker(fn"+(argsListWired.length>0?", ":"")+argsListWired+");\n";
  
      if (needsDestructorStack) {
          invokerFnBody += "runDestructors(destructors);\n";
      } else {
          for(var i = isClassMethodFunc?1:2; i < argTypes.length; ++i) { // Skip return value at index 0 - it's not deleted here. Also skip class type if not a method.
              var paramName = (i === 1 ? "thisWired" : ("arg"+(i - 2)+"Wired"));
              if (argTypes[i].destructorFunction !== null) {
                  invokerFnBody += paramName+"_dtor("+paramName+"); // "+argTypes[i].name+"\n";
                  args1.push(paramName+"_dtor");
                  args2.push(argTypes[i].destructorFunction);
              }
          }
      }
  
      if (returns) {
          invokerFnBody += "var ret = retType.fromWireType(rv);\n" +
                           "return ret;\n";
      } else {
      }
      invokerFnBody += "}\n";
  
      args1.push(invokerFnBody);
  
      var invokerFunction = new_(Function, args1).apply(null, args2);
      return invokerFunction;
    }function __embind_register_class_function(
      rawClassType,
      methodName,
      argCount,
      rawArgTypesAddr, // [ReturnType, ThisType, Args...]
      invokerSignature,
      rawInvoker,
      context,
      isPureVirtual
    ) {
      var rawArgTypes = heap32VectorToArray(argCount, rawArgTypesAddr);
      methodName = readLatin1String(methodName);
      rawInvoker = embind__requireFunction(invokerSignature, rawInvoker);
  
      whenDependentTypesAreResolved([], [rawClassType], function(classType) {
          classType = classType[0];
          var humanName = classType.name + '.' + methodName;
  
          if (isPureVirtual) {
              classType.registeredClass.pureVirtualFunctions.push(methodName);
          }
  
          function unboundTypesHandler() {
              throwUnboundTypeError('Cannot call ' + humanName + ' due to unbound types', rawArgTypes);
          }
  
          var proto = classType.registeredClass.instancePrototype;
          var method = proto[methodName];
          if (undefined === method || (undefined === method.overloadTable && method.className !== classType.name && method.argCount === argCount - 2)) {
              // This is the first overload to be registered, OR we are replacing a function in the base class with a function in the derived class.
              unboundTypesHandler.argCount = argCount - 2;
              unboundTypesHandler.className = classType.name;
              proto[methodName] = unboundTypesHandler;
          } else {
              // There was an existing function with the same name registered. Set up a function overload routing table.
              ensureOverloadTable(proto, methodName, humanName);
              proto[methodName].overloadTable[argCount - 2] = unboundTypesHandler;
          }
  
          whenDependentTypesAreResolved([], rawArgTypes, function(argTypes) {
  
              var memberFunction = craftInvokerFunction(humanName, argTypes, classType, rawInvoker, context);
  
              // Replace the initial unbound-handler-stub function with the appropriate member function, now that all types
              // are resolved. If multiple overloads are registered for this function, the function goes into an overload table.
              if (undefined === proto[methodName].overloadTable) {
                  // Set argCount in case an overload is registered later
                  memberFunction.argCount = argCount - 2;
                  proto[methodName] = memberFunction;
              } else {
                  proto[methodName].overloadTable[argCount - 2] = memberFunction;
              }
  
              return [];
          });
          return [];
      });
    }

  
  function validateThis(this_, classType, humanName) {
      if (!(this_ instanceof Object)) {
          throwBindingError(humanName + ' with invalid "this": ' + this_);
      }
      if (!(this_ instanceof classType.registeredClass.constructor)) {
          throwBindingError(humanName + ' incompatible with "this" of type ' + this_.constructor.name);
      }
      if (!this_.$$.ptr) {
          throwBindingError('cannot call emscripten binding method ' + humanName + ' on deleted object');
      }
  
      // todo: kill this
      return upcastPointer(
          this_.$$.ptr,
          this_.$$.ptrType.registeredClass,
          classType.registeredClass);
    }function __embind_register_class_property(
      classType,
      fieldName,
      getterReturnType,
      getterSignature,
      getter,
      getterContext,
      setterArgumentType,
      setterSignature,
      setter,
      setterContext
    ) {
      fieldName = readLatin1String(fieldName);
      getter = embind__requireFunction(getterSignature, getter);
  
      whenDependentTypesAreResolved([], [classType], function(classType) {
          classType = classType[0];
          var humanName = classType.name + '.' + fieldName;
          var desc = {
              get: function() {
                  throwUnboundTypeError('Cannot access ' + humanName + ' due to unbound types', [getterReturnType, setterArgumentType]);
              },
              enumerable: true,
              configurable: true
          };
          if (setter) {
              desc.set = function() {
                  throwUnboundTypeError('Cannot access ' + humanName + ' due to unbound types', [getterReturnType, setterArgumentType]);
              };
          } else {
              desc.set = function(v) {
                  throwBindingError(humanName + ' is a read-only property');
              };
          }
  
          Object.defineProperty(classType.registeredClass.instancePrototype, fieldName, desc);
  
          whenDependentTypesAreResolved(
              [],
              (setter ? [getterReturnType, setterArgumentType] : [getterReturnType]),
          function(types) {
              var getterReturnType = types[0];
              var desc = {
                  get: function() {
                      var ptr = validateThis(this, classType, humanName + ' getter');
                      return getterReturnType['fromWireType'](getter(getterContext, ptr));
                  },
                  enumerable: true
              };
  
              if (setter) {
                  setter = embind__requireFunction(setterSignature, setter);
                  var setterArgumentType = types[1];
                  desc.set = function(v) {
                      var ptr = validateThis(this, classType, humanName + ' setter');
                      var destructors = [];
                      setter(setterContext, ptr, setterArgumentType['toWireType'](destructors, v));
                      runDestructors(destructors);
                  };
              }
  
              Object.defineProperty(classType.registeredClass.instancePrototype, fieldName, desc);
              return [];
          });
  
          return [];
      });
    }

  
  
  var emval_free_list=[];
  
  var emval_handle_array=[{},{value:undefined},{value:null},{value:true},{value:false}];function __emval_decref(handle) {
      if (handle > 4 && 0 === --emval_handle_array[handle].refcount) {
          emval_handle_array[handle] = undefined;
          emval_free_list.push(handle);
      }
    }
  
  
  
  function count_emval_handles() {
      var count = 0;
      for (var i = 5; i < emval_handle_array.length; ++i) {
          if (emval_handle_array[i] !== undefined) {
              ++count;
          }
      }
      return count;
    }
  
  function get_first_emval() {
      for (var i = 5; i < emval_handle_array.length; ++i) {
          if (emval_handle_array[i] !== undefined) {
              return emval_handle_array[i];
          }
      }
      return null;
    }function init_emval() {
      Module['count_emval_handles'] = count_emval_handles;
      Module['get_first_emval'] = get_first_emval;
    }function __emval_register(value) {
  
      switch(value){
        case undefined :{ return 1; }
        case null :{ return 2; }
        case true :{ return 3; }
        case false :{ return 4; }
        default:{
          var handle = emval_free_list.length ?
              emval_free_list.pop() :
              emval_handle_array.length;
  
          emval_handle_array[handle] = {refcount: 1, value: value};
          return handle;
          }
        }
    }function __embind_register_emval(rawType, name) {
      name = readLatin1String(name);
      registerType(rawType, {
          name: name,
          'fromWireType': function(handle) {
              var rv = emval_handle_array[handle].value;
              __emval_decref(handle);
              return rv;
          },
          'toWireType': function(destructors, value) {
              return __emval_register(value);
          },
          'argPackAdvance': 8,
          'readValueFromPointer': simpleReadValueFromPointer,
          destructorFunction: null, // This type does not need a destructor
  
          // TODO: do we need a deleteObject here?  write a test where
          // emval is passed into JS via an interface
      });
    }

  
  function _embind_repr(v) {
      if (v === null) {
          return 'null';
      }
      var t = typeof v;
      if (t === 'object' || t === 'array' || t === 'function') {
          return v.toString();
      } else {
          return '' + v;
      }
    }
  
  function floatReadValueFromPointer(name, shift) {
      switch (shift) {
          case 2: return function(pointer) {
              return this['fromWireType'](HEAPF32[pointer >> 2]);
          };
          case 3: return function(pointer) {
              return this['fromWireType'](HEAPF64[pointer >> 3]);
          };
          default:
              throw new TypeError("Unknown float type: " + name);
      }
    }function __embind_register_float(rawType, name, size) {
      var shift = getShiftFromSize(size);
      name = readLatin1String(name);
      registerType(rawType, {
          name: name,
          'fromWireType': function(value) {
              return value;
          },
          'toWireType': function(destructors, value) {
              // todo: Here we have an opportunity for -O3 level "unsafe" optimizations: we could
              // avoid the following if() and assume value is of proper type.
              if (typeof value !== "number" && typeof value !== "boolean") {
                  throw new TypeError('Cannot convert "' + _embind_repr(value) + '" to ' + this.name);
              }
              return value;
          },
          'argPackAdvance': 8,
          'readValueFromPointer': floatReadValueFromPointer(name, shift),
          destructorFunction: null, // This type does not need a destructor
      });
    }

  function __embind_register_function(name, argCount, rawArgTypesAddr, signature, rawInvoker, fn) {
      var argTypes = heap32VectorToArray(argCount, rawArgTypesAddr);
      name = readLatin1String(name);
  
      rawInvoker = embind__requireFunction(signature, rawInvoker);
  
      exposePublicSymbol(name, function() {
          throwUnboundTypeError('Cannot call ' + name + ' due to unbound types', argTypes);
      }, argCount - 1);
  
      whenDependentTypesAreResolved([], argTypes, function(argTypes) {
          var invokerArgsArray = [argTypes[0] /* return value */, null /* no class 'this'*/].concat(argTypes.slice(1) /* actual params */);
          replacePublicSymbol(name, craftInvokerFunction(name, invokerArgsArray, null /* no class 'this'*/, rawInvoker, fn), argCount - 1);
          return [];
      });
    }

  
  function integerReadValueFromPointer(name, shift, signed) {
      // integers are quite common, so generate very specialized functions
      switch (shift) {
          case 0: return signed ?
              function readS8FromPointer(pointer) { return HEAP8[pointer]; } :
              function readU8FromPointer(pointer) { return HEAPU8[pointer]; };
          case 1: return signed ?
              function readS16FromPointer(pointer) { return HEAP16[pointer >> 1]; } :
              function readU16FromPointer(pointer) { return HEAPU16[pointer >> 1]; };
          case 2: return signed ?
              function readS32FromPointer(pointer) { return HEAP32[pointer >> 2]; } :
              function readU32FromPointer(pointer) { return HEAPU32[pointer >> 2]; };
          default:
              throw new TypeError("Unknown integer type: " + name);
      }
    }function __embind_register_integer(primitiveType, name, size, minRange, maxRange) {
      name = readLatin1String(name);
      if (maxRange === -1) { // LLVM doesn't have signed and unsigned 32-bit types, so u32 literals come out as 'i32 -1'. Always treat those as max u32.
          maxRange = 4294967295;
      }
  
      var shift = getShiftFromSize(size);
  
      var fromWireType = function(value) {
          return value;
      };
  
      if (minRange === 0) {
          var bitshift = 32 - 8*size;
          fromWireType = function(value) {
              return (value << bitshift) >>> bitshift;
          };
      }
  
      var isUnsignedType = (name.indexOf('unsigned') != -1);
  
      registerType(primitiveType, {
          name: name,
          'fromWireType': fromWireType,
          'toWireType': function(destructors, value) {
              // todo: Here we have an opportunity for -O3 level "unsafe" optimizations: we could
              // avoid the following two if()s and assume value is of proper type.
              if (typeof value !== "number" && typeof value !== "boolean") {
                  throw new TypeError('Cannot convert "' + _embind_repr(value) + '" to ' + this.name);
              }
              if (value < minRange || value > maxRange) {
                  throw new TypeError('Passing a number "' + _embind_repr(value) + '" from JS side to C/C++ side to an argument of type "' + name + '", which is outside the valid range [' + minRange + ', ' + maxRange + ']!');
              }
              return isUnsignedType ? (value >>> 0) : (value | 0);
          },
          'argPackAdvance': 8,
          'readValueFromPointer': integerReadValueFromPointer(name, shift, minRange !== 0),
          destructorFunction: null, // This type does not need a destructor
      });
    }

  function __embind_register_memory_view(rawType, dataTypeIndex, name) {
      var typeMapping = [
          Int8Array,
          Uint8Array,
          Int16Array,
          Uint16Array,
          Int32Array,
          Uint32Array,
          Float32Array,
          Float64Array,
      ];
  
      var TA = typeMapping[dataTypeIndex];
  
      function decodeMemoryView(handle) {
          handle = handle >> 2;
          var heap = HEAPU32;
          var size = heap[handle]; // in elements
          var data = heap[handle + 1]; // byte offset into emscripten heap
          return new TA(heap['buffer'], data, size);
      }
  
      name = readLatin1String(name);
      registerType(rawType, {
          name: name,
          'fromWireType': decodeMemoryView,
          'argPackAdvance': 8,
          'readValueFromPointer': decodeMemoryView,
      }, {
          ignoreDuplicateRegistrations: true,
      });
    }

  function __embind_register_std_string(rawType, name) {
      name = readLatin1String(name);
      var stdStringIsUTF8
      //process only std::string bindings with UTF8 support, in contrast to e.g. std::basic_string<unsigned char>
      = (name === "std::string");
  
      registerType(rawType, {
          name: name,
          'fromWireType': function(value) {
              var length = HEAPU32[value >> 2];
  
              var str;
              if(stdStringIsUTF8) {
                  //ensure null termination at one-past-end byte if not present yet
                  var endChar = HEAPU8[value + 4 + length];
                  var endCharSwap = 0;
                  if(endChar != 0)
                  {
                    endCharSwap = endChar;
                    HEAPU8[value + 4 + length] = 0;
                  }
  
                  var decodeStartPtr = value + 4;
                  //looping here to support possible embedded '0' bytes
                  for (var i = 0; i <= length; ++i) {
                    var currentBytePtr = value + 4 + i;
                    if(HEAPU8[currentBytePtr] == 0)
                    {
                      var stringSegment = UTF8ToString(decodeStartPtr);
                      if(str === undefined)
                        str = stringSegment;
                      else
                      {
                        str += String.fromCharCode(0);
                        str += stringSegment;
                      }
                      decodeStartPtr = currentBytePtr + 1;
                    }
                  }
  
                  if(endCharSwap != 0)
                    HEAPU8[value + 4 + length] = endCharSwap;
              } else {
                  var a = new Array(length);
                  for (var i = 0; i < length; ++i) {
                      a[i] = String.fromCharCode(HEAPU8[value + 4 + i]);
                  }
                  str = a.join('');
              }
  
              _free(value);
  
              return str;
          },
          'toWireType': function(destructors, value) {
              if (value instanceof ArrayBuffer) {
                  value = new Uint8Array(value);
              }
  
              var getLength;
              var valueIsOfTypeString = (typeof value === 'string');
  
              if (!(valueIsOfTypeString || value instanceof Uint8Array || value instanceof Uint8ClampedArray || value instanceof Int8Array)) {
                  throwBindingError('Cannot pass non-string to std::string');
              }
              if (stdStringIsUTF8 && valueIsOfTypeString) {
                  getLength = function() {return lengthBytesUTF8(value);};
              } else {
                  getLength = function() {return value.length;};
              }
  
              // assumes 4-byte alignment
              var length = getLength();
              var ptr = _malloc(4 + length + 1);
              HEAPU32[ptr >> 2] = length;
  
              if (stdStringIsUTF8 && valueIsOfTypeString) {
                  stringToUTF8(value, ptr + 4, length + 1);
              } else {
                  if(valueIsOfTypeString) {
                      for (var i = 0; i < length; ++i) {
                          var charCode = value.charCodeAt(i);
                          if (charCode > 255) {
                              _free(ptr);
                              throwBindingError('String has UTF-16 code units that do not fit in 8 bits');
                          }
                          HEAPU8[ptr + 4 + i] = charCode;
                      }
                  } else {
                      for (var i = 0; i < length; ++i) {
                          HEAPU8[ptr + 4 + i] = value[i];
                      }
                  }
              }
  
              if (destructors !== null) {
                  destructors.push(_free, ptr);
              }
              return ptr;
          },
          'argPackAdvance': 8,
          'readValueFromPointer': simpleReadValueFromPointer,
          destructorFunction: function(ptr) { _free(ptr); },
      });
    }

  function __embind_register_std_wstring(rawType, charSize, name) {
      // nb. do not cache HEAPU16 and HEAPU32, they may be destroyed by emscripten_resize_heap().
      name = readLatin1String(name);
      var getHeap, shift;
      if (charSize === 2) {
          getHeap = function() { return HEAPU16; };
          shift = 1;
      } else if (charSize === 4) {
          getHeap = function() { return HEAPU32; };
          shift = 2;
      }
      registerType(rawType, {
          name: name,
          'fromWireType': function(value) {
              var HEAP = getHeap();
              var length = HEAPU32[value >> 2];
              var a = new Array(length);
              var start = (value + 4) >> shift;
              for (var i = 0; i < length; ++i) {
                  a[i] = String.fromCharCode(HEAP[start + i]);
              }
              _free(value);
              return a.join('');
          },
          'toWireType': function(destructors, value) {
              // assumes 4-byte alignment
              var length = value.length;
              var ptr = _malloc(4 + length * charSize);
              var HEAP = getHeap();
              HEAPU32[ptr >> 2] = length;
              var start = (ptr + 4) >> shift;
              for (var i = 0; i < length; ++i) {
                  HEAP[start + i] = value.charCodeAt(i);
              }
              if (destructors !== null) {
                  destructors.push(_free, ptr);
              }
              return ptr;
          },
          'argPackAdvance': 8,
          'readValueFromPointer': simpleReadValueFromPointer,
          destructorFunction: function(ptr) { _free(ptr); },
      });
    }

  function __embind_register_value_object(
      rawType,
      name,
      constructorSignature,
      rawConstructor,
      destructorSignature,
      rawDestructor
    ) {
      structRegistrations[rawType] = {
          name: readLatin1String(name),
          rawConstructor: embind__requireFunction(constructorSignature, rawConstructor),
          rawDestructor: embind__requireFunction(destructorSignature, rawDestructor),
          fields: [],
      };
    }

  function __embind_register_value_object_field(
      structType,
      fieldName,
      getterReturnType,
      getterSignature,
      getter,
      getterContext,
      setterArgumentType,
      setterSignature,
      setter,
      setterContext
    ) {
      structRegistrations[structType].fields.push({
          fieldName: readLatin1String(fieldName),
          getterReturnType: getterReturnType,
          getter: embind__requireFunction(getterSignature, getter),
          getterContext: getterContext,
          setterArgumentType: setterArgumentType,
          setter: embind__requireFunction(setterSignature, setter),
          setterContext: setterContext,
      });
    }

  function __embind_register_void(rawType, name) {
      name = readLatin1String(name);
      registerType(rawType, {
          isVoid: true, // void return values can be optimized out sometimes
          name: name,
          'argPackAdvance': 0,
          'fromWireType': function() {
              return undefined;
          },
          'toWireType': function(destructors, o) {
              // TODO: assert if anything else is given?
              return undefined;
          },
      });
    }

  
  function requireHandle(handle) {
      if (!handle) {
          throwBindingError('Cannot use deleted val. handle = ' + handle);
      }
      return emval_handle_array[handle].value;
    }
  
  function requireRegisteredType(rawType, humanName) {
      var impl = registeredTypes[rawType];
      if (undefined === impl) {
          throwBindingError(humanName + " has unknown type " + getTypeName(rawType));
      }
      return impl;
    }function __emval_as(handle, returnType, destructorsRef) {
      handle = requireHandle(handle);
      returnType = requireRegisteredType(returnType, 'emval::as');
      var destructors = [];
      var rd = __emval_register(destructors);
      HEAP32[destructorsRef >> 2] = rd;
      return returnType['toWireType'](destructors, handle);
    }


  function __emval_incref(handle) {
      if (handle > 4) {
          emval_handle_array[handle].refcount += 1;
      }
    }

  function __emval_is_number(handle) {
      handle = requireHandle(handle);
      return typeof handle === 'number';
    }

  function __emval_run_destructors(handle) {
      var destructors = emval_handle_array[handle].value;
      runDestructors(destructors);
      __emval_decref(handle);
    }

  function __emval_take_value(type, argv) {
      type = requireRegisteredType(type, '_emval_take_value');
      var v = type['readValueFromPointer'](argv);
      return __emval_register(v);
    }

  function _abort() {
      abort();
    }

  function _emscripten_get_heap_size() {
      return HEAP8.length;
    }

  function _emscripten_get_sbrk_ptr() {
      return 4992;
    }

  function _emscripten_memcpy_big(dest, src, num) {
      HEAPU8.set(HEAPU8.subarray(src, src+num), dest);
    }

  
  function abortOnCannotGrowMemory(requestedSize) {
      abort('Cannot enlarge memory arrays to size ' + requestedSize + ' bytes (OOM). Either (1) compile with  -s TOTAL_MEMORY=X  with X higher than the current value ' + HEAP8.length + ', (2) compile with  -s ALLOW_MEMORY_GROWTH=1  which allows increasing the size at runtime, or (3) if you want malloc to return NULL (0) instead of this abort, compile with  -s ABORTING_MALLOC=0 ');
    }function _emscripten_resize_heap(requestedSize) {
      abortOnCannotGrowMemory(requestedSize);
    }

  
  function _memcpy(dest, src, num) {
      dest = dest|0; src = src|0; num = num|0;
      var ret = 0;
      var aligned_dest_end = 0;
      var block_aligned_dest_end = 0;
      var dest_end = 0;
      // Test against a benchmarked cutoff limit for when HEAPU8.set() becomes faster to use.
      if ((num|0) >= 8192) {
        _emscripten_memcpy_big(dest|0, src|0, num|0)|0;
        return dest|0;
      }
  
      ret = dest|0;
      dest_end = (dest + num)|0;
      if ((dest&3) == (src&3)) {
        // The initial unaligned < 4-byte front.
        while (dest & 3) {
          if ((num|0) == 0) return ret|0;
          HEAP8[((dest)>>0)]=((HEAP8[((src)>>0)])|0);
          dest = (dest+1)|0;
          src = (src+1)|0;
          num = (num-1)|0;
        }
        aligned_dest_end = (dest_end & -4)|0;
        block_aligned_dest_end = (aligned_dest_end - 64)|0;
        while ((dest|0) <= (block_aligned_dest_end|0) ) {
          HEAP32[((dest)>>2)]=((HEAP32[((src)>>2)])|0);
          HEAP32[(((dest)+(4))>>2)]=((HEAP32[(((src)+(4))>>2)])|0);
          HEAP32[(((dest)+(8))>>2)]=((HEAP32[(((src)+(8))>>2)])|0);
          HEAP32[(((dest)+(12))>>2)]=((HEAP32[(((src)+(12))>>2)])|0);
          HEAP32[(((dest)+(16))>>2)]=((HEAP32[(((src)+(16))>>2)])|0);
          HEAP32[(((dest)+(20))>>2)]=((HEAP32[(((src)+(20))>>2)])|0);
          HEAP32[(((dest)+(24))>>2)]=((HEAP32[(((src)+(24))>>2)])|0);
          HEAP32[(((dest)+(28))>>2)]=((HEAP32[(((src)+(28))>>2)])|0);
          HEAP32[(((dest)+(32))>>2)]=((HEAP32[(((src)+(32))>>2)])|0);
          HEAP32[(((dest)+(36))>>2)]=((HEAP32[(((src)+(36))>>2)])|0);
          HEAP32[(((dest)+(40))>>2)]=((HEAP32[(((src)+(40))>>2)])|0);
          HEAP32[(((dest)+(44))>>2)]=((HEAP32[(((src)+(44))>>2)])|0);
          HEAP32[(((dest)+(48))>>2)]=((HEAP32[(((src)+(48))>>2)])|0);
          HEAP32[(((dest)+(52))>>2)]=((HEAP32[(((src)+(52))>>2)])|0);
          HEAP32[(((dest)+(56))>>2)]=((HEAP32[(((src)+(56))>>2)])|0);
          HEAP32[(((dest)+(60))>>2)]=((HEAP32[(((src)+(60))>>2)])|0);
          dest = (dest+64)|0;
          src = (src+64)|0;
        }
        while ((dest|0) < (aligned_dest_end|0) ) {
          HEAP32[((dest)>>2)]=((HEAP32[((src)>>2)])|0);
          dest = (dest+4)|0;
          src = (src+4)|0;
        }
      } else {
        // In the unaligned copy case, unroll a bit as well.
        aligned_dest_end = (dest_end - 4)|0;
        while ((dest|0) < (aligned_dest_end|0) ) {
          HEAP8[((dest)>>0)]=((HEAP8[((src)>>0)])|0);
          HEAP8[(((dest)+(1))>>0)]=((HEAP8[(((src)+(1))>>0)])|0);
          HEAP8[(((dest)+(2))>>0)]=((HEAP8[(((src)+(2))>>0)])|0);
          HEAP8[(((dest)+(3))>>0)]=((HEAP8[(((src)+(3))>>0)])|0);
          dest = (dest+4)|0;
          src = (src+4)|0;
        }
      }
      // The remaining unaligned < 4 byte tail.
      while ((dest|0) < (dest_end|0)) {
        HEAP8[((dest)>>0)]=((HEAP8[((src)>>0)])|0);
        dest = (dest+1)|0;
        src = (src+1)|0;
      }
      return ret|0;
    }

  function _memset(ptr, value, num) {
      ptr = ptr|0; value = value|0; num = num|0;
      var end = 0, aligned_end = 0, block_aligned_end = 0, value4 = 0;
      end = (ptr + num)|0;
  
      value = value & 0xff;
      if ((num|0) >= 67 /* 64 bytes for an unrolled loop + 3 bytes for unaligned head*/) {
        while ((ptr&3) != 0) {
          HEAP8[((ptr)>>0)]=value;
          ptr = (ptr+1)|0;
        }
  
        aligned_end = (end & -4)|0;
        value4 = value | (value << 8) | (value << 16) | (value << 24);
  
        block_aligned_end = (aligned_end - 64)|0;
  
        while((ptr|0) <= (block_aligned_end|0)) {
          HEAP32[((ptr)>>2)]=value4;
          HEAP32[(((ptr)+(4))>>2)]=value4;
          HEAP32[(((ptr)+(8))>>2)]=value4;
          HEAP32[(((ptr)+(12))>>2)]=value4;
          HEAP32[(((ptr)+(16))>>2)]=value4;
          HEAP32[(((ptr)+(20))>>2)]=value4;
          HEAP32[(((ptr)+(24))>>2)]=value4;
          HEAP32[(((ptr)+(28))>>2)]=value4;
          HEAP32[(((ptr)+(32))>>2)]=value4;
          HEAP32[(((ptr)+(36))>>2)]=value4;
          HEAP32[(((ptr)+(40))>>2)]=value4;
          HEAP32[(((ptr)+(44))>>2)]=value4;
          HEAP32[(((ptr)+(48))>>2)]=value4;
          HEAP32[(((ptr)+(52))>>2)]=value4;
          HEAP32[(((ptr)+(56))>>2)]=value4;
          HEAP32[(((ptr)+(60))>>2)]=value4;
          ptr = (ptr + 64)|0;
        }
  
        while ((ptr|0) < (aligned_end|0) ) {
          HEAP32[((ptr)>>2)]=value4;
          ptr = (ptr+4)|0;
        }
      }
      // The remaining bytes.
      while ((ptr|0) < (end|0)) {
        HEAP8[((ptr)>>0)]=value;
        ptr = (ptr+1)|0;
      }
      return (end-num)|0;
    }

  function _setTempRet0($i) {
      setTempRet0(($i) | 0);
    }
InternalError = Module['InternalError'] = extendError(Error, 'InternalError');;
embind_init_charCodes();
BindingError = Module['BindingError'] = extendError(Error, 'BindingError');;
init_ClassHandle();
init_RegisteredPointer();
init_embind();;
UnboundTypeError = Module['UnboundTypeError'] = extendError(Error, 'UnboundTypeError');;
init_emval();;
var ASSERTIONS = true;

// Copyright 2017 The Emscripten Authors.  All rights reserved.
// Emscripten is available under two separate licenses, the MIT license and the
// University of Illinois/NCSA Open Source License.  Both these licenses can be
// found in the LICENSE file.

/** @type {function(string, boolean=, number=)} */
function intArrayFromString(stringy, dontAddNull, length) {
  var len = length > 0 ? length : lengthBytesUTF8(stringy)+1;
  var u8array = new Array(len);
  var numBytesWritten = stringToUTF8Array(stringy, u8array, 0, u8array.length);
  if (dontAddNull) u8array.length = numBytesWritten;
  return u8array;
}

function intArrayToString(array) {
  var ret = [];
  for (var i = 0; i < array.length; i++) {
    var chr = array[i];
    if (chr > 0xFF) {
      if (ASSERTIONS) {
        assert(false, 'Character code ' + chr + ' (' + String.fromCharCode(chr) + ')  at offset ' + i + ' not in 0x00-0xFF.');
      }
      chr &= 0xFF;
    }
    ret.push(String.fromCharCode(chr));
  }
  return ret.join('');
}


// Copied from https://github.com/strophe/strophejs/blob/e06d027/src/polyfills.js#L149

// This code was written by Tyler Akins and has been placed in the
// public domain.  It would be nice if you left this header intact.
// Base64 code from Tyler Akins -- http://rumkin.com

/**
 * Decodes a base64 string.
 * @param {String} input The string to decode.
 */
var decodeBase64 = typeof atob === 'function' ? atob : function (input) {
  var keyStr = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=';

  var output = '';
  var chr1, chr2, chr3;
  var enc1, enc2, enc3, enc4;
  var i = 0;
  // remove all characters that are not A-Z, a-z, 0-9, +, /, or =
  input = input.replace(/[^A-Za-z0-9\+\/\=]/g, '');
  do {
    enc1 = keyStr.indexOf(input.charAt(i++));
    enc2 = keyStr.indexOf(input.charAt(i++));
    enc3 = keyStr.indexOf(input.charAt(i++));
    enc4 = keyStr.indexOf(input.charAt(i++));

    chr1 = (enc1 << 2) | (enc2 >> 4);
    chr2 = ((enc2 & 15) << 4) | (enc3 >> 2);
    chr3 = ((enc3 & 3) << 6) | enc4;

    output = output + String.fromCharCode(chr1);

    if (enc3 !== 64) {
      output = output + String.fromCharCode(chr2);
    }
    if (enc4 !== 64) {
      output = output + String.fromCharCode(chr3);
    }
  } while (i < input.length);
  return output;
};

// Converts a string of base64 into a byte array.
// Throws error on invalid input.
function intArrayFromBase64(s) {
  if (typeof ENVIRONMENT_IS_NODE === 'boolean' && ENVIRONMENT_IS_NODE) {
    var buf;
    try {
      buf = Buffer.from(s, 'base64');
    } catch (_) {
      buf = new Buffer(s, 'base64');
    }
    return new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength);
  }

  try {
    var decoded = decodeBase64(s);
    var bytes = new Uint8Array(decoded.length);
    for (var i = 0 ; i < decoded.length ; ++i) {
      bytes[i] = decoded.charCodeAt(i);
    }
    return bytes;
  } catch (_) {
    throw new Error('Converting base64 string to bytes failed.');
  }
}

// If filename is a base64 data URI, parses and returns data (Buffer on node,
// Uint8Array otherwise). If filename is not a base64 data URI, returns undefined.
function tryParseAsDataURI(filename) {
  if (!isDataURI(filename)) {
    return;
  }

  return intArrayFromBase64(filename.slice(dataURIPrefix.length));
}


// ASM_LIBRARY EXTERN PRIMITIVES: Int8Array,Int32Array

var asmGlobalArg = {};
var asmLibraryArg = { "__handle_stack_overflow": ___handle_stack_overflow, "__lock": ___lock, "__unlock": ___unlock, "_embind_finalize_value_object": __embind_finalize_value_object, "_embind_register_bool": __embind_register_bool, "_embind_register_class": __embind_register_class, "_embind_register_class_constructor": __embind_register_class_constructor, "_embind_register_class_function": __embind_register_class_function, "_embind_register_class_property": __embind_register_class_property, "_embind_register_emval": __embind_register_emval, "_embind_register_float": __embind_register_float, "_embind_register_function": __embind_register_function, "_embind_register_integer": __embind_register_integer, "_embind_register_memory_view": __embind_register_memory_view, "_embind_register_std_string": __embind_register_std_string, "_embind_register_std_wstring": __embind_register_std_wstring, "_embind_register_value_object": __embind_register_value_object, "_embind_register_value_object_field": __embind_register_value_object_field, "_embind_register_void": __embind_register_void, "_emval_as": __emval_as, "_emval_decref": __emval_decref, "_emval_incref": __emval_incref, "_emval_is_number": __emval_is_number, "_emval_run_destructors": __emval_run_destructors, "_emval_take_value": __emval_take_value, "abort": _abort, "emscripten_get_sbrk_ptr": _emscripten_get_sbrk_ptr, "emscripten_memcpy_big": _emscripten_memcpy_big, "emscripten_resize_heap": _emscripten_resize_heap, "getTempRet0": getTempRet0, "memory": wasmMemory, "setTempRet0": setTempRet0, "table": wasmTable };
var asm = createWasm();
var real____wasm_call_ctors = asm["__wasm_call_ctors"];
asm["__wasm_call_ctors"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real____wasm_call_ctors.apply(null, arguments);
};

var real__free = asm["free"];
asm["free"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__free.apply(null, arguments);
};

var real__malloc = asm["malloc"];
asm["malloc"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__malloc.apply(null, arguments);
};

var real__fflush = asm["fflush"];
asm["fflush"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__fflush.apply(null, arguments);
};

var real____errno_location = asm["__errno_location"];
asm["__errno_location"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real____errno_location.apply(null, arguments);
};

var real__setThrew = asm["setThrew"];
asm["setThrew"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__setThrew.apply(null, arguments);
};

var real___ZSt18uncaught_exceptionv = asm["_ZSt18uncaught_exceptionv"];
asm["_ZSt18uncaught_exceptionv"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real___ZSt18uncaught_exceptionv.apply(null, arguments);
};

var real____getTypeName = asm["__getTypeName"];
asm["__getTypeName"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real____getTypeName.apply(null, arguments);
};

var real____embind_register_native_and_builtin_types = asm["__embind_register_native_and_builtin_types"];
asm["__embind_register_native_and_builtin_types"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real____embind_register_native_and_builtin_types.apply(null, arguments);
};

var real____set_stack_limit = asm["__set_stack_limit"];
asm["__set_stack_limit"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real____set_stack_limit.apply(null, arguments);
};

var real_stackSave = asm["stackSave"];
asm["stackSave"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real_stackSave.apply(null, arguments);
};

var real_stackAlloc = asm["stackAlloc"];
asm["stackAlloc"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real_stackAlloc.apply(null, arguments);
};

var real_stackRestore = asm["stackRestore"];
asm["stackRestore"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real_stackRestore.apply(null, arguments);
};

var real___growWasmMemory = asm["__growWasmMemory"];
asm["__growWasmMemory"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real___growWasmMemory.apply(null, arguments);
};

var real_dynCall_ii = asm["dynCall_ii"];
asm["dynCall_ii"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real_dynCall_ii.apply(null, arguments);
};

var real_dynCall_vi = asm["dynCall_vi"];
asm["dynCall_vi"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real_dynCall_vi.apply(null, arguments);
};

var real_dynCall_i = asm["dynCall_i"];
asm["dynCall_i"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real_dynCall_i.apply(null, arguments);
};

var real_dynCall_vii = asm["dynCall_vii"];
asm["dynCall_vii"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real_dynCall_vii.apply(null, arguments);
};

var real_dynCall_viii = asm["dynCall_viii"];
asm["dynCall_viii"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real_dynCall_viii.apply(null, arguments);
};

var real_dynCall_viiii = asm["dynCall_viiii"];
asm["dynCall_viiii"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real_dynCall_viiii.apply(null, arguments);
};

var real_dynCall_iii = asm["dynCall_iii"];
asm["dynCall_iii"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real_dynCall_iii.apply(null, arguments);
};

var real_dynCall_iiii = asm["dynCall_iiii"];
asm["dynCall_iiii"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real_dynCall_iiii.apply(null, arguments);
};

var real_dynCall_iiiii = asm["dynCall_iiiii"];
asm["dynCall_iiiii"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real_dynCall_iiiii.apply(null, arguments);
};

var real_dynCall_ji = asm["dynCall_ji"];
asm["dynCall_ji"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real_dynCall_ji.apply(null, arguments);
};

var real_dynCall_viiiiii = asm["dynCall_viiiiii"];
asm["dynCall_viiiiii"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real_dynCall_viiiiii.apply(null, arguments);
};

var real_dynCall_viiiii = asm["dynCall_viiiii"];
asm["dynCall_viiiii"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real_dynCall_viiiii.apply(null, arguments);
};

Module["asm"] = asm;
var ___wasm_call_ctors = Module["___wasm_call_ctors"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__wasm_call_ctors"].apply(null, arguments)
};

var _free = Module["_free"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["free"].apply(null, arguments)
};

var _malloc = Module["_malloc"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["malloc"].apply(null, arguments)
};

var _fflush = Module["_fflush"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["fflush"].apply(null, arguments)
};

var ___errno_location = Module["___errno_location"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__errno_location"].apply(null, arguments)
};

var _setThrew = Module["_setThrew"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["setThrew"].apply(null, arguments)
};

var __ZSt18uncaught_exceptionv = Module["__ZSt18uncaught_exceptionv"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_ZSt18uncaught_exceptionv"].apply(null, arguments)
};

var ___getTypeName = Module["___getTypeName"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__getTypeName"].apply(null, arguments)
};

var ___embind_register_native_and_builtin_types = Module["___embind_register_native_and_builtin_types"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__embind_register_native_and_builtin_types"].apply(null, arguments)
};

var ___set_stack_limit = Module["___set_stack_limit"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__set_stack_limit"].apply(null, arguments)
};

var stackSave = Module["stackSave"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["stackSave"].apply(null, arguments)
};

var stackAlloc = Module["stackAlloc"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["stackAlloc"].apply(null, arguments)
};

var stackRestore = Module["stackRestore"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["stackRestore"].apply(null, arguments)
};

var __growWasmMemory = Module["__growWasmMemory"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__growWasmMemory"].apply(null, arguments)
};

var dynCall_ii = Module["dynCall_ii"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["dynCall_ii"].apply(null, arguments)
};

var dynCall_vi = Module["dynCall_vi"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["dynCall_vi"].apply(null, arguments)
};

var dynCall_i = Module["dynCall_i"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["dynCall_i"].apply(null, arguments)
};

var dynCall_vii = Module["dynCall_vii"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["dynCall_vii"].apply(null, arguments)
};

var dynCall_viii = Module["dynCall_viii"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["dynCall_viii"].apply(null, arguments)
};

var dynCall_viiii = Module["dynCall_viiii"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["dynCall_viiii"].apply(null, arguments)
};

var dynCall_iii = Module["dynCall_iii"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["dynCall_iii"].apply(null, arguments)
};

var dynCall_iiii = Module["dynCall_iiii"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["dynCall_iiii"].apply(null, arguments)
};

var dynCall_iiiii = Module["dynCall_iiiii"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["dynCall_iiiii"].apply(null, arguments)
};

var dynCall_ji = Module["dynCall_ji"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["dynCall_ji"].apply(null, arguments)
};

var dynCall_viiiiii = Module["dynCall_viiiiii"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["dynCall_viiiiii"].apply(null, arguments)
};

var dynCall_viiiii = Module["dynCall_viiiii"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["dynCall_viiiii"].apply(null, arguments)
};




// === Auto-generated postamble setup entry stuff ===

Module['asm'] = asm;

if (!Object.getOwnPropertyDescriptor(Module, "intArrayFromString")) Module["intArrayFromString"] = function() { abort("'intArrayFromString' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "intArrayToString")) Module["intArrayToString"] = function() { abort("'intArrayToString' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "ccall")) Module["ccall"] = function() { abort("'ccall' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "cwrap")) Module["cwrap"] = function() { abort("'cwrap' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "setValue")) Module["setValue"] = function() { abort("'setValue' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "getValue")) Module["getValue"] = function() { abort("'getValue' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "allocate")) Module["allocate"] = function() { abort("'allocate' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "getMemory")) Module["getMemory"] = function() { abort("'getMemory' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ). Alternatively, forcing filesystem support (-s FORCE_FILESYSTEM=1) can export this for you") };
if (!Object.getOwnPropertyDescriptor(Module, "AsciiToString")) Module["AsciiToString"] = function() { abort("'AsciiToString' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "stringToAscii")) Module["stringToAscii"] = function() { abort("'stringToAscii' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "UTF8ArrayToString")) Module["UTF8ArrayToString"] = function() { abort("'UTF8ArrayToString' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "UTF8ToString")) Module["UTF8ToString"] = function() { abort("'UTF8ToString' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "stringToUTF8Array")) Module["stringToUTF8Array"] = function() { abort("'stringToUTF8Array' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "stringToUTF8")) Module["stringToUTF8"] = function() { abort("'stringToUTF8' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "lengthBytesUTF8")) Module["lengthBytesUTF8"] = function() { abort("'lengthBytesUTF8' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "UTF16ToString")) Module["UTF16ToString"] = function() { abort("'UTF16ToString' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "stringToUTF16")) Module["stringToUTF16"] = function() { abort("'stringToUTF16' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "lengthBytesUTF16")) Module["lengthBytesUTF16"] = function() { abort("'lengthBytesUTF16' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "UTF32ToString")) Module["UTF32ToString"] = function() { abort("'UTF32ToString' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "stringToUTF32")) Module["stringToUTF32"] = function() { abort("'stringToUTF32' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "lengthBytesUTF32")) Module["lengthBytesUTF32"] = function() { abort("'lengthBytesUTF32' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "allocateUTF8")) Module["allocateUTF8"] = function() { abort("'allocateUTF8' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "stackTrace")) Module["stackTrace"] = function() { abort("'stackTrace' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "addOnPreRun")) Module["addOnPreRun"] = function() { abort("'addOnPreRun' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "addOnInit")) Module["addOnInit"] = function() { abort("'addOnInit' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "addOnPreMain")) Module["addOnPreMain"] = function() { abort("'addOnPreMain' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "addOnExit")) Module["addOnExit"] = function() { abort("'addOnExit' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "addOnPostRun")) Module["addOnPostRun"] = function() { abort("'addOnPostRun' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "writeStringToMemory")) Module["writeStringToMemory"] = function() { abort("'writeStringToMemory' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "writeArrayToMemory")) Module["writeArrayToMemory"] = function() { abort("'writeArrayToMemory' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "writeAsciiToMemory")) Module["writeAsciiToMemory"] = function() { abort("'writeAsciiToMemory' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "addRunDependency")) Module["addRunDependency"] = function() { abort("'addRunDependency' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ). Alternatively, forcing filesystem support (-s FORCE_FILESYSTEM=1) can export this for you") };
if (!Object.getOwnPropertyDescriptor(Module, "removeRunDependency")) Module["removeRunDependency"] = function() { abort("'removeRunDependency' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ). Alternatively, forcing filesystem support (-s FORCE_FILESYSTEM=1) can export this for you") };
if (!Object.getOwnPropertyDescriptor(Module, "ENV")) Module["ENV"] = function() { abort("'ENV' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "FS")) Module["FS"] = function() { abort("'FS' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "FS_createFolder")) Module["FS_createFolder"] = function() { abort("'FS_createFolder' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ). Alternatively, forcing filesystem support (-s FORCE_FILESYSTEM=1) can export this for you") };
if (!Object.getOwnPropertyDescriptor(Module, "FS_createPath")) Module["FS_createPath"] = function() { abort("'FS_createPath' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ). Alternatively, forcing filesystem support (-s FORCE_FILESYSTEM=1) can export this for you") };
if (!Object.getOwnPropertyDescriptor(Module, "FS_createDataFile")) Module["FS_createDataFile"] = function() { abort("'FS_createDataFile' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ). Alternatively, forcing filesystem support (-s FORCE_FILESYSTEM=1) can export this for you") };
if (!Object.getOwnPropertyDescriptor(Module, "FS_createPreloadedFile")) Module["FS_createPreloadedFile"] = function() { abort("'FS_createPreloadedFile' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ). Alternatively, forcing filesystem support (-s FORCE_FILESYSTEM=1) can export this for you") };
if (!Object.getOwnPropertyDescriptor(Module, "FS_createLazyFile")) Module["FS_createLazyFile"] = function() { abort("'FS_createLazyFile' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ). Alternatively, forcing filesystem support (-s FORCE_FILESYSTEM=1) can export this for you") };
if (!Object.getOwnPropertyDescriptor(Module, "FS_createLink")) Module["FS_createLink"] = function() { abort("'FS_createLink' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ). Alternatively, forcing filesystem support (-s FORCE_FILESYSTEM=1) can export this for you") };
if (!Object.getOwnPropertyDescriptor(Module, "FS_createDevice")) Module["FS_createDevice"] = function() { abort("'FS_createDevice' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ). Alternatively, forcing filesystem support (-s FORCE_FILESYSTEM=1) can export this for you") };
if (!Object.getOwnPropertyDescriptor(Module, "FS_unlink")) Module["FS_unlink"] = function() { abort("'FS_unlink' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ). Alternatively, forcing filesystem support (-s FORCE_FILESYSTEM=1) can export this for you") };
if (!Object.getOwnPropertyDescriptor(Module, "GL")) Module["GL"] = function() { abort("'GL' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "dynamicAlloc")) Module["dynamicAlloc"] = function() { abort("'dynamicAlloc' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "loadDynamicLibrary")) Module["loadDynamicLibrary"] = function() { abort("'loadDynamicLibrary' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "loadWebAssemblyModule")) Module["loadWebAssemblyModule"] = function() { abort("'loadWebAssemblyModule' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "getLEB")) Module["getLEB"] = function() { abort("'getLEB' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "getFunctionTables")) Module["getFunctionTables"] = function() { abort("'getFunctionTables' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "alignFunctionTables")) Module["alignFunctionTables"] = function() { abort("'alignFunctionTables' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "registerFunctions")) Module["registerFunctions"] = function() { abort("'registerFunctions' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "addFunction")) Module["addFunction"] = function() { abort("'addFunction' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "removeFunction")) Module["removeFunction"] = function() { abort("'removeFunction' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "getFuncWrapper")) Module["getFuncWrapper"] = function() { abort("'getFuncWrapper' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "prettyPrint")) Module["prettyPrint"] = function() { abort("'prettyPrint' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "makeBigInt")) Module["makeBigInt"] = function() { abort("'makeBigInt' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "dynCall")) Module["dynCall"] = function() { abort("'dynCall' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "getCompilerSetting")) Module["getCompilerSetting"] = function() { abort("'getCompilerSetting' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "print")) Module["print"] = function() { abort("'print' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "printErr")) Module["printErr"] = function() { abort("'printErr' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "getTempRet0")) Module["getTempRet0"] = function() { abort("'getTempRet0' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "setTempRet0")) Module["setTempRet0"] = function() { abort("'setTempRet0' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "callMain")) Module["callMain"] = function() { abort("'callMain' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "abort")) Module["abort"] = function() { abort("'abort' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "Pointer_stringify")) Module["Pointer_stringify"] = function() { abort("'Pointer_stringify' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "warnOnce")) Module["warnOnce"] = function() { abort("'warnOnce' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "stackSave")) Module["stackSave"] = function() { abort("'stackSave' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "stackRestore")) Module["stackRestore"] = function() { abort("'stackRestore' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "stackAlloc")) Module["stackAlloc"] = function() { abort("'stackAlloc' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "establishStackSpace")) Module["establishStackSpace"] = function() { abort("'establishStackSpace' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
Module["writeStackCookie"] = writeStackCookie;
Module["checkStackCookie"] = checkStackCookie;
Module["abortStackOverflow"] = abortStackOverflow;
if (!Object.getOwnPropertyDescriptor(Module, "intArrayFromBase64")) Module["intArrayFromBase64"] = function() { abort("'intArrayFromBase64' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "tryParseAsDataURI")) Module["tryParseAsDataURI"] = function() { abort("'tryParseAsDataURI' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };if (!Object.getOwnPropertyDescriptor(Module, "ALLOC_NORMAL")) Object.defineProperty(Module, "ALLOC_NORMAL", { configurable: true, get: function() { abort("'ALLOC_NORMAL' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") } });
if (!Object.getOwnPropertyDescriptor(Module, "ALLOC_STACK")) Object.defineProperty(Module, "ALLOC_STACK", { configurable: true, get: function() { abort("'ALLOC_STACK' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") } });
if (!Object.getOwnPropertyDescriptor(Module, "ALLOC_DYNAMIC")) Object.defineProperty(Module, "ALLOC_DYNAMIC", { configurable: true, get: function() { abort("'ALLOC_DYNAMIC' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") } });
if (!Object.getOwnPropertyDescriptor(Module, "ALLOC_NONE")) Object.defineProperty(Module, "ALLOC_NONE", { configurable: true, get: function() { abort("'ALLOC_NONE' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") } });
if (!Object.getOwnPropertyDescriptor(Module, "calledRun")) Object.defineProperty(Module, "calledRun", { configurable: true, get: function() { abort("'calledRun' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ). Alternatively, forcing filesystem support (-s FORCE_FILESYSTEM=1) can export this for you") } });



var calledRun;

// Modularize mode returns a function, which can be called to
// create instances. The instances provide a then() method,
// must like a Promise, that receives a callback. The callback
// is called when the module is ready to run, with the module
// as a parameter. (Like a Promise, it also returns the module
// so you can use the output of .then(..)).
Module['then'] = function(func) {
  // We may already be ready to run code at this time. if
  // so, just queue a call to the callback.
  if (calledRun) {
    func(Module);
  } else {
    // we are not ready to call then() yet. we must call it
    // at the same time we would call onRuntimeInitialized.
    var old = Module['onRuntimeInitialized'];
    Module['onRuntimeInitialized'] = function() {
      if (old) old();
      func(Module);
    };
  }
  return Module;
};

/**
 * @constructor
 * @this {ExitStatus}
 */
function ExitStatus(status) {
  this.name = "ExitStatus";
  this.message = "Program terminated with exit(" + status + ")";
  this.status = status;
}

var calledMain = false;


dependenciesFulfilled = function runCaller() {
  // If run has never been called, and we should call run (INVOKE_RUN is true, and Module.noInitialRun is not false)
  if (!calledRun) run();
  if (!calledRun) dependenciesFulfilled = runCaller; // try this again later, after new deps are fulfilled
};





/** @type {function(Array=)} */
function run(args) {
  args = args || arguments_;

  if (runDependencies > 0) {
    return;
  }

  writeStackCookie();

  preRun();

  if (runDependencies > 0) return; // a preRun added a dependency, run will be called later

  function doRun() {
    // run may have just been called through dependencies being fulfilled just in this very frame,
    // or while the async setStatus time below was happening
    if (calledRun) return;
    calledRun = true;

    if (ABORT) return;

    initRuntime();

    preMain();

    if (Module['onRuntimeInitialized']) Module['onRuntimeInitialized']();

    assert(!Module['_main'], 'compiled without a main, but one is present. if you added it from JS, use Module["onRuntimeInitialized"]');

    postRun();
  }

  if (Module['setStatus']) {
    Module['setStatus']('Running...');
    setTimeout(function() {
      setTimeout(function() {
        Module['setStatus']('');
      }, 1);
      doRun();
    }, 1);
  } else
  {
    doRun();
  }
  checkStackCookie();
}
Module['run'] = run;

function checkUnflushedContent() {
  // Compiler settings do not allow exiting the runtime, so flushing
  // the streams is not possible. but in ASSERTIONS mode we check
  // if there was something to flush, and if so tell the user they
  // should request that the runtime be exitable.
  // Normally we would not even include flush() at all, but in ASSERTIONS
  // builds we do so just for this check, and here we see if there is any
  // content to flush, that is, we check if there would have been
  // something a non-ASSERTIONS build would have not seen.
  // How we flush the streams depends on whether we are in SYSCALLS_REQUIRE_FILESYSTEM=0
  // mode (which has its own special function for this; otherwise, all
  // the code is inside libc)
  var print = out;
  var printErr = err;
  var has = false;
  out = err = function(x) {
    has = true;
  }
  try { // it doesn't matter if it fails
    var flush = null;
    if (flush) flush(0);
  } catch(e) {}
  out = print;
  err = printErr;
  if (has) {
    warnOnce('stdio streams had content in them that was not flushed. you should set EXIT_RUNTIME to 1 (see the FAQ), or make sure to emit a newline when you printf etc.');
    warnOnce('(this may also be due to not including full filesystem support - try building with -s FORCE_FILESYSTEM=1)');
  }
}

function exit(status, implicit) {
  checkUnflushedContent();

  // if this is just main exit-ing implicitly, and the status is 0, then we
  // don't need to do anything here and can just leave. if the status is
  // non-zero, though, then we need to report it.
  // (we may have warned about this earlier, if a situation justifies doing so)
  if (implicit && noExitRuntime && status === 0) {
    return;
  }

  if (noExitRuntime) {
    // if exit() was called, we may warn the user if the runtime isn't actually being shut down
    if (!implicit) {
      err('program exited (with status: ' + status + '), but EXIT_RUNTIME is not set, so halting execution but not exiting the runtime or preventing further async execution (build with EXIT_RUNTIME=1, if you want a true shutdown)');
    }
  } else {

    ABORT = true;
    EXITSTATUS = status;

    exitRuntime();

    if (Module['onExit']) Module['onExit'](status);
  }

  quit_(status, new ExitStatus(status));
}

if (Module['preInit']) {
  if (typeof Module['preInit'] == 'function') Module['preInit'] = [Module['preInit']];
  while (Module['preInit'].length > 0) {
    Module['preInit'].pop()();
  }
}


  noExitRuntime = true;

run();





// {{MODULE_ADDITIONS}}





  return Module
}
);
})();
if (typeof exports === 'object' && typeof module === 'object')
      module.exports = Module;
    else if (typeof define === 'function' && define['amd'])
      define([], function() { return Module; });
    else if (typeof exports === 'object')
      exports["Module"] = Module;
    