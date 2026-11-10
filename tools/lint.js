'use strict';
var fs = require('fs');
var path = require('path');
var root = path.join(__dirname, '..');

var KEYWORDS_BEFORE_REGEX = { 'return': 1, 'typeof': 1, 'case': 1, 'in': 1, 'of': 1, 'delete': 1, 'void': 1, 'throw': 1, 'new': 1, 'else': 1, 'do': 1, 'instanceof': 1, 'yield': 1, 'await': 1 };

function lineOf(src, index) {
  var n = 1;
  for (var i = 0; i < index; i++) if (src.charCodeAt(i) === 10) n++;
  return n;
}

function lintJS(src, baseLine) {
  var found = [];
  var i = 0;
  var n = src.length;
  var lastSig = '';
  var lastWord = '';

  function report(at, kind) {
    found.push({ line: lineOf(src, at) + (baseLine || 0), kind: kind });
  }

  function skipString(q) {
    i++;
    while (i < n && src[i] !== q) {
      if (src[i] === '\\') i++;
      i++;
    }
    i++;
  }

  function skipRegex() {
    var inClass = false;
    i++;
    while (i < n) {
      var c = src[i];
      if (c === '\\') { i += 2; continue; }
      if (c === '[') inClass = true;
      else if (c === ']') inClass = false;
      else if (c === '/' && !inClass) break;
      else if (c === '\n') return;
      i++;
    }
    i++;
    while (i < n && /[a-z]/i.test(src[i])) i++;
  }

  function scanTemplate() {
    i++;
    while (i < n && src[i] !== '`') {
      if (src[i] === '\\') { i += 2; continue; }
      if (src[i] === '$' && src[i + 1] === '{') {
        i += 2;
        scanCode(true);
        continue;
      }
      i++;
    }
    i++;
  }

  function regexAllowed() {
    if (lastSig === '') return true;
    if (/[(,=:\[!&|?{};+\-*%<>~^]/.test(lastSig)) return true;
    if (/[A-Za-z0-9_$]/.test(lastSig)) return !!KEYWORDS_BEFORE_REGEX[lastWord];
    return false;
  }

  function scanCode(inTemplate) {
    var depth = 0;
    while (i < n) {
      var c = src[i];
      if (c === '/' && src[i + 1] === '/') { report(i, 'line comment'); while (i < n && src[i] !== '\n') i++; continue; }
      if (c === '/' && src[i + 1] === '*') { report(i, 'block comment'); i += 2; while (i < n && !(src[i] === '*' && src[i + 1] === '/')) i++; i += 2; continue; }
      if (c === '"' || c === "'") { skipString(c); lastSig = '"'; lastWord = ''; continue; }
      if (c === '`') { scanTemplate(); lastSig = '`'; lastWord = ''; continue; }
      if (c === '/') {
        if (regexAllowed()) { skipRegex(); lastSig = '/'; lastWord = ''; continue; }
        lastSig = '/'; i++; continue;
      }
      if (inTemplate) {
        if (c === '{') depth++;
        else if (c === '}') { if (depth === 0) { i++; return; } depth--; }
      }
      if (/\s/.test(c)) { i++; continue; }
      if (/[A-Za-z0-9_$]/.test(c)) {
        var s = i;
        while (i < n && /[A-Za-z0-9_$]/.test(src[i])) i++;
        lastWord = src.slice(s, i);
        lastSig = src[i - 1];
        continue;
      }
      lastSig = c;
      lastWord = '';
      i++;
    }
  }

  if (src.slice(0, 2) === '#!') while (i < n && src[i] !== '\n') i++;
  scanCode(false);
  return found;
}

function lintCSS(src, baseLine) {
  var found = [];
  var i = 0;
  var n = src.length;
  while (i < n) {
    var c = src[i];
    if (c === '/' && src[i + 1] === '*') {
      found.push({ line: lineOf(src, i) + (baseLine || 0), kind: 'block comment' });
      i += 2;
      while (i < n && !(src[i] === '*' && src[i + 1] === '/')) i++;
      i += 2;
      continue;
    }
    if (c === '"' || c === "'") {
      i++;
      while (i < n && src[i] !== c) { if (src[i] === '\\') i++; i++; }
      i++;
      continue;
    }
    if (c === 'u' && src.substr(i, 4).toLowerCase() === 'url(') {
      i += 4;
      while (i < n && /\s/.test(src[i])) i++;
      if (src[i] === '"' || src[i] === "'") continue;
      while (i < n && src[i] !== ')') i++;
      continue;
    }
    i++;
  }
  return found;
}

function lintHTML(src) {
  var found = [];
  var re = /<!--|<script\b[^>]*>|<style\b[^>]*>/gi;
  var m;
  while ((m = re.exec(src))) {
    if (m[0] === '<!--') {
      found.push({ line: lineOf(src, m.index), kind: 'html comment' });
      var end = src.indexOf('-->', m.index + 4);
      re.lastIndex = end === -1 ? src.length : end + 3;
      continue;
    }
    var isScript = /^<script/i.test(m[0]);
    var close = src.toLowerCase().indexOf(isScript ? '</script' : '</style', re.lastIndex);
    if (close === -1) close = src.length;
    var body = src.slice(re.lastIndex, close);
    var base = lineOf(src, re.lastIndex) - 1;
    var typeAttr = /type\s*=\s*["']([^"']*)["']/i.exec(m[0]);
    var isJs = isScript && (!typeAttr || /javascript|module/i.test(typeAttr[1]));
    if (isScript && isJs) found = found.concat(lintJS(body, base));
    else if (!isScript) found = found.concat(lintCSS(body, base));
    re.lastIndex = close;
  }
  return found;
}

function files() {
  var out = [];
  function add(dir, ext, skip) {
    var abs = path.join(root, dir);
    if (!fs.existsSync(abs)) return;
    fs.readdirSync(abs).forEach(function (f) {
      var full = path.join(abs, f);
      if (fs.statSync(full).isFile() && ext.test(f) && !(skip && skip.test(f))) out.push(path.join(dir, f));
    });
  }
  add('js', /\.js$/);
  add('css', /\.css$/);
  add('tools', /\.js$/);
  add('tools/fixtures', /\.js$/);
  add('qa', /\.mjs$/);
  ['index.html', 'sw.js'].forEach(function (f) { if (fs.existsSync(path.join(root, f))) out.push(f); });
  return out;
}

function run(quiet) {
  var problems = [];
  files().forEach(function (rel) {
    var src = fs.readFileSync(path.join(root, rel), 'utf8').replace(/\r\n/g, '\n');
    var list = /\.css$/.test(rel) ? lintCSS(src, 0) : /\.html$/.test(rel) ? lintHTML(src) : lintJS(src, 0);
    list.forEach(function (p) { problems.push(rel + ':' + p.line + ': ' + p.kind); });
    if (/^js\/.*\.js$/.test(rel) && rel !== 'js/data.js') {
      src.split('\n').forEach(function (line, k) {
        if (/\bconsole\.log\b/.test(line) && !/F\.perf/.test(line)) problems.push(rel + ':' + (k + 1) + ': console.log outside an F.perf branch');
        if (/\bdebugger\b/.test(line)) problems.push(rel + ':' + (k + 1) + ': debugger statement');
      });
    }
  });
  if (!quiet) {
    if (problems.length) console.error(problems.join('\n'));
    else console.log('lint ok (' + files().length + ' files)');
  }
  return problems.length === 0;
}

module.exports = { run: run, lintJS: lintJS, lintCSS: lintCSS, lintHTML: lintHTML };

if (require.main === module) process.exit(run(false) ? 0 : 1);
