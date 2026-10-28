'use strict';
var fs = require('fs');
var path = require('path');
var vm = require('vm');

var root = path.join(__dirname, '..');

function loadCore(seedStore) {
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
  vm.runInContext(fs.readFileSync(path.join(root, 'js', 'core.js'), 'utf8'), ctx, { filename: 'core.js' });
  return { F: win.F, mem: mem };
}

module.exports = { root: root, loadCore: loadCore };
