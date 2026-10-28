'use strict';
var fs = require('fs');
var path = require('path');
var crypto = require('crypto');
var loader = require('./loader');
var regress = require('./regress');

var root = loader.root;
var src = path.join(root, 'fihrist.json');
var out = path.join(root, 'js', 'data.js');
var swPath = path.join(root, 'sw.js');
var manifestPath = path.join(root, 'manifest.webmanifest');
var check = process.argv.indexOf('--check') !== -1;

function fail(msg) {
  console.error(msg);
  process.exit(1);
}

var text = fs.readFileSync(src, 'utf8').replace(/\r\n/g, '\n');
var doc;
try { doc = JSON.parse(text); } catch (e) { fail('fihrist.json is not valid JSON: ' + e.message); }
try { loader.loadCore().F.validate(doc); } catch (e) { fail('fihrist.json failed validation: ' + e.message); }

var body = text.split('\n').filter(function (line) { return !/^\s*"\$schema"\s*:/.test(line); }).join('\n').replace(/\s+$/, '');
var built = 'window.FIHRIST_SEED = ' + body + ';\n';

function readText(file) {
  return fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n');
}

var pending = [];

var currentData = fs.existsSync(out) ? readText(out) : '';
if (currentData !== built) pending.push({ file: out, text: built, name: 'js/data.js' });

var sw = readText(swPath);
var shellMatch = /var SHELL = \[([^\]]*)\];/.exec(sw);
if (!shellMatch) fail('sw.js is missing its SHELL list');
var shell = shellMatch[1].split(',').map(function (s) { return s.trim().replace(/^'|'$/g, ''); }).filter(Boolean);

if (fs.existsSync(manifestPath)) {
  var manifest;
  try { manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8')); } catch (e) { fail('manifest.webmanifest is not valid JSON: ' + e.message); }
  (manifest.icons || []).forEach(function (icon) {
    if (!fs.existsSync(path.join(root, icon.src))) fail('manifest.webmanifest lists a missing icon: ' + icon.src);
  });
  if (shell.indexOf('manifest.webmanifest') === -1) fail('sw.js SHELL must list manifest.webmanifest');
}

var hash = crypto.createHash('sha256');
shell.forEach(function (rel) {
  var file = path.join(root, rel);
  if (!fs.existsSync(file)) fail('sw.js lists a missing file: ' + rel);
  hash.update(rel + '\n');
  if (/\.(png|ico|woff2?)$/i.test(rel)) hash.update(fs.readFileSync(file));
  else hash.update(file === out ? built : readText(file));
  hash.update('\n');
});
var version = 'fihrist-shell-' + hash.digest('hex').slice(0, 10);
var builtSw = sw.replace(/var VERSION = '[^']*';/, "var VERSION = '" + version + "';");
if (builtSw !== sw) pending.push({ file: swPath, text: builtSw, name: 'sw.js' });

var summary = 'revision ' + doc.revision + ', ' + doc.tools.length + ' tools, ' + version;

if (check) {
  if (pending.length) fail(pending.map(function (p) { return p.name; }).join(', ') + ' out of date. Run: node tools/build.js');
  if (!regress.run(false)) fail('search regression failed');
  console.log('in sync (' + summary + ')');
} else if (!pending.length) {
  console.log('already up to date (' + summary + ')');
} else {
  pending.forEach(function (p) { fs.writeFileSync(p.file, p.text, 'utf8'); });
  console.log('written: ' + pending.map(function (p) { return p.name; }).join(', ') + ' (' + summary + ')');
}
