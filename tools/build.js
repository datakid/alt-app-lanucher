'use strict';
var fs = require('fs');
var path = require('path');
var vm = require('vm');

var root = path.join(__dirname, '..');
var src = path.join(root, 'fihrist.json');
var out = path.join(root, 'js', 'data.js');
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

var current = fs.existsSync(out) ? fs.readFileSync(out, 'utf8').replace(/\r\n/g, '\n') : '';

if (check) {
  if (current !== built) fail('js/data.js is out of date. Run: node tools/build.js');
  console.log('js/data.js is in sync with fihrist.json (revision ' + doc.revision + ', ' + doc.tools.length + ' tools)');
} else if (current === built) {
  console.log('js/data.js already up to date (revision ' + doc.revision + ', ' + doc.tools.length + ' tools)');
} else {
  fs.writeFileSync(out, built, 'utf8');
  console.log('js/data.js written (revision ' + doc.revision + ', ' + doc.tools.length + ' tools)');
}
