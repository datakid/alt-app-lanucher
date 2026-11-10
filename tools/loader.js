'use strict';
var fs = require('fs');
var path = require('path');
var vm = require('vm');

var root = path.join(__dirname, '..');

function loadCore(seedStore, opts) {
  var mem = seedStore || {};
  var store = {
    getItem: function (k) { return Object.prototype.hasOwnProperty.call(mem, k) ? mem[k] : null; },
    setItem: function (k, v) { mem[k] = String(v); },
    removeItem: function (k) { delete mem[k]; }
  };
  var noop = function () {};
  var win = {
    localStorage: store,
    location: { protocol: 'file:', hash: '', search: '', href: 'file:///' },
    addEventListener: noop,
    removeEventListener: noop,
    requestIdleCallback: function (fn) { fn(); return 0; },
    matchMedia: function () { return { matches: false, addEventListener: noop }; }
  };
  win.window = win;
  var ctx = vm.createContext(Object.assign(win, {
    document: { documentElement: { dataset: {}, style: {} }, addEventListener: noop, visibilityState: 'visible' },
    navigator: {},
    location: win.location,
    console: console
  }));
  if (opts && opts.url) ctx.URL = URL;
  vm.runInContext(fs.readFileSync((opts && opts.corePath) || path.join(root, 'js', 'core.js'), 'utf8'), ctx, { filename: 'core.js' });
  if (opts && opts.scripts) {
    ctx.TextEncoder = TextEncoder; ctx.TextDecoder = TextDecoder; ctx.Uint8Array = Uint8Array; ctx.Uint16Array = Uint16Array; ctx.Uint32Array = Uint32Array;
    opts.scripts.forEach(function (s) { vm.runInContext(fs.readFileSync(path.join(root, s), 'utf8'), ctx, { filename: s }); });
  }
  return { F: win.F, mem: mem };
}

module.exports = { root: root, loadCore: loadCore };
