'use strict';
var fs = require('fs');
var path = require('path');
var vm = require('vm');
var crypto = require('crypto');

var root = path.join(__dirname, '..');
var src = path.join(root, 'fihrist.json');
var out = path.join(root, 'js', 'data.js');
var swPath = path.join(root, 'sw.js');
var check = process.argv.indexOf('--check') !== -1;

function loadValidator() {
  var store = { getItem: function () { return null; }, setItem: function () {}, removeItem: function () {} };
  var win = {
    localStorage: store,
    location: { protocol: 'file:', hash: '', search: '', href: 'file:///' },
    addEventListener: function () {},
    matchMedia: function () { return { matches: false, addEventListener: function () {} }; }
  };
  win.window = win;
  var ctx = vm.createContext(Object.assign(win, {
    document: { documentElement: { dataset: {}, style: {} }, addEventListener: function () {} },
    navigator: {},
    location: win.location,
    console: console
  }));
  vm.runInContext(fs.readFileSync(path.join(root, 'js', 'core.js'), 'utf8'), ctx, { filename: 'core.js' });
  return win.F.validate;
}

function fail(msg) {
  console.error(msg);
  process.exit(1);
}

var text = fs.readFileSync(src, 'utf8').replace(/\r\n/g, '\n');
var doc;
try { doc = JSON.parse(text); } catch (e) { fail('fihrist.json is not valid JSON: ' + e.message); }
try { loadValidator()(doc); } catch (e) { fail('fihrist.json failed validation: ' + e.message); }

var body = text.split('\n').filter(function (line) { return !/^\s*"\$schema"\s*:/.test(line); }).join('\n').replace(/\s+$/, '');
var built = 'window.FIHRIST_SEED = ' + body + ';\n';

function read(file) {
  return fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n');
}

var pending = [];

var currentData = fs.existsSync(out) ? read(out) : '';
if (currentData !== built) pending.push({ file: out, text: built, name: 'js/data.js' });

var sw = read(swPath);
var shellMatch = /var SHELL = \[([^\]]*)\];/.exec(sw);
if (!shellMatch) fail('sw.js is missing its SHELL list');
var shell = shellMatch[1].split(',').map(function (s) { return s.trim().replace(/^'|'$/g, ''); }).filter(Boolean);
var hash = crypto.createHash('sha256');
shell.forEach(function (rel) {
  var file = path.join(root, rel);
  if (!fs.existsSync(file)) fail('sw.js lists a missing file: ' + rel);
  hash.update(rel + '\n' + (file === out ? built : read(file)) + '\n');
});
var version = 'fihrist-shell-' + hash.digest('hex').slice(0, 10);
var builtSw = sw.replace(/var VERSION = '[^']*';/, "var VERSION = '" + version + "';");
if (builtSw !== sw) pending.push({ file: swPath, text: builtSw, name: 'sw.js' });

var summary = 'revision ' + doc.revision + ', ' + doc.tools.length + ' tools, ' + version;

if (check) {
  if (pending.length) fail(pending.map(function (p) { return p.name; }).join(', ') + ' out of date. Run: node tools/build.js');
  console.log('in sync (' + summary + ')');
} else if (!pending.length) {
  console.log('already up to date (' + summary + ')');
} else {
  pending.forEach(function (p) { fs.writeFileSync(p.file, p.text, 'utf8'); });
  console.log('written: ' + pending.map(function (p) { return p.name; }).join(', ') + ' (' + summary + ')');
}
