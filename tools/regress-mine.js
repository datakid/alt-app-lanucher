'use strict';
var fs = require('fs');
var path = require('path');
var assert = require('assert');
var loader = require('./loader');

function env() { return loader.loadCore(null, { url: true, scripts: ['js/xlsx.js', 'js/mine-core.js'] }).F; }
function bytes(file) { return new Uint8Array(fs.readFileSync(path.join(loader.root, file))); }

var tests = [];
function same(a, b, msg) { assert.strictEqual(JSON.stringify(a), JSON.stringify(b), msg); }
function T(name, fn) { tests.push({ name: name, fn: fn }); }

function run(quiet) {
  var bad = 0;
  tests.forEach(function (t) {
    try { t.fn(env()); } catch (e) { bad++; if (!quiet) console.error('FAIL ' + t.name + ': ' + e.message); }
  });
  if (!quiet) console.log((bad ? 'FAIL ' : 'ok ') + (tests.length - bad) + '/' + tests.length + ' personal-links checks');
  return bad === 0;
}

function importBytes(F, name, data, payload, mode, taken) {
  var src = F.mineio.sheetsFromBytes(name, data), mapped = src.json ? F.mineio.fromJSON(src.json) : F.mineio.mapSheets(src.sheets);
  return { mapped: mapped, plan: F.mineio.plan(mapped.drafts, payload || F.mineBlank(), mode || 'merge', taken) };
}
function summary(plan) {
  return plan.rows.map(function (r) { return r.group + ':' + (r.tool.en || r.tool.ar) + (r.tool.variants ? '[' + r.tool.variants.map(function (v) { return v.en; }).join('|') + ']' : ''); }).sort();
}

T('xlsx template round trip gives exactly the example links', function (F) {
  var r = importBytes(F, 'fihrist-links-template.xlsx', bytes('templates/fihrist-links-template.xlsx'));
  assert.strictEqual(r.plan.new, 6);
  assert.strictEqual(r.mapped.skipped.length, 0);
  var s = summary(r.plan).join('\n');
  assert.ok(/Calendar/.test(s) && /Docs\[Docs\|Sheets\]/.test(s) && /GitHub/.test(s) && /Hacker News/.test(s) && /Wikipedia/.test(s));
  assert.ok(r.plan.rows.some(function (x) { return x.tool.ar === 'دليل الموظف' && !x.tool.en; }), 'arabic only row');
  assert.strictEqual(Object.keys(r.plan.groups).length, 2);
});
T('csv template round trip matches the xlsx result', function (F) {
  var x = importBytes(F, 'a.xlsx', bytes('templates/fihrist-links-template.xlsx'));
  var c = importBytes(F, 'a.csv', bytes('templates/fihrist-links-template.csv'));
  same(summary(c.plan), summary(x.plan));
  assert.strictEqual(c.plan.new, 6);
});
T('imported payload validates as personal links', function (F) {
  var r = importBytes(F, 'a.xlsx', bytes('templates/fihrist-links-template.xlsx'));
  var doc = F.mineDoc(r.plan.payload);
  assert.strictEqual(doc.tools.length, 6);
  assert.strictEqual(doc.groups.length, 2);
  doc.tools.forEach(function (t) { assert.ok(/^u-/.test(t.id)); assert.ok(t.mine); });
});
T('second import is all unchanged and ids are stable', function (F) {
  var a = importBytes(F, 'a.csv', bytes('templates/fihrist-links-template.csv'));
  var b = importBytes(F, 'a.csv', bytes('templates/fihrist-links-template.csv'), a.plan.payload);
  assert.strictEqual(b.plan.unchanged, 6); assert.strictEqual(b.plan.new, 0); assert.strictEqual(b.plan.updated, 0);
  same(b.plan.payload.tools.map(function (t) { return t.id; }), a.plan.payload.tools.map(function (t) { return t.id; }));
});
T('merge updates by url, keeps the id, deletes nothing', function (F) {
  var a = importBytes(F, 'a.csv', bytes('templates/fihrist-links-template.csv'));
  var csv = 'url,name_en,description_en\nhttps://github.com,GitHub Renamed,New text\nhttps://brand-new.example.com,Fresh,\n';
  var b = importBytes(F, 'b.csv', new TextEncoder().encode(csv), a.plan.payload);
  assert.strictEqual(b.plan.updated, 1); assert.strictEqual(b.plan.new, 1);
  assert.strictEqual(b.plan.payload.tools.length, 7);
  var gh = b.plan.payload.tools.find(function (t) { return t.url === 'https://github.com'; });
  assert.strictEqual(gh.en, 'GitHub Renamed');
  assert.strictEqual(gh.id, a.plan.payload.tools.find(function (t) { return t.url === 'https://github.com'; }).id);
});
T('replace keeps matching ids and drops the rest', function (F) {
  var a = importBytes(F, 'a.csv', bytes('templates/fihrist-links-template.csv'));
  var b = importBytes(F, 'b.csv', new TextEncoder().encode('url,name_en\nhttps://github.com,GitHub\n'), a.plan.payload, 'replace');
  assert.strictEqual(b.plan.payload.tools.length, 1);
  assert.strictEqual(b.plan.payload.tools[0].id, a.plan.payload.tools.find(function (t) { return t.url === 'https://github.com'; }).id);
});
T('csv handles BOM, semicolons, quoted commas and newlines', function (F) {
  var csv = '\uFEFFurl;name_en;description_en\r\nhttps://a.io;"Name; with semi";"line one\nline two"\r\nhttps://b.io;"He said ""hi""";x\r\n';
  var r = importBytes(F, 'x.csv', new TextEncoder().encode(csv));
  assert.strictEqual(r.plan.new, 2);
  assert.strictEqual(r.plan.rows[0].tool.en, 'Name; with semi');
  assert.strictEqual(r.plan.rows[0].tool.den, 'line one\nline two');
  assert.strictEqual(r.plan.rows[1].tool.en, 'He said "hi"');
});
T('windows-1256 bytes decode as Arabic', function (F) {
  assert.strictEqual(F.mineio.decodeBytes(new Uint8Array([0xC7, 0xD3, 0xE3])), 'اسم');
  assert.strictEqual(F.mineio.decodeBytes(new Uint8Array([0xEF, 0xBB, 0xBF, 0x61])), 'a');
});
T('header-less files are detected by content', function (F) {
  var csv = 'https://a.io,مثال عربي,Example,A longer english description of the thing\nhttps://b.io,آخر,Other,Another longer english description here\n';
  var r = importBytes(F, 'x.csv', new TextEncoder().encode(csv));
  assert.strictEqual(r.plan.new, 2);
  var t = r.plan.rows[0].tool;
  assert.strictEqual(t.ar, 'مثال عربي'); assert.strictEqual(t.en, 'Example'); assert.ok(/longer english/.test(t.den));
});
T('header synonyms in Arabic and English map correctly', function (F) {
  var csv = 'الرابط,الاسم,Name,اللون,المجموعة\nhttps://a.io,أداة,Tool,lapis,أدواتي\n';
  var r = importBytes(F, 'x.csv', new TextEncoder().encode(csv));
  var t = r.plan.rows[0].tool;
  assert.strictEqual(t.ar, 'أداة'); assert.strictEqual(t.en, 'Tool'); assert.strictEqual(t.pigment, 'lapis');
  assert.ok(/^u-/.test(t.group));
});
T('bad and missing urls are skipped with reasons; duplicates merge', function (F) {
  var csv = 'url,name_en\nnot a url,One\n,Two\nhttps://ok.io,Three\nhttps://ok.io/,Dup\nftp://x.io,Four\njavascript:alert(1),Five\n';
  var r = importBytes(F, 'x.csv', new TextEncoder().encode(csv));
  assert.strictEqual(r.plan.new, 1);
  assert.ok(r.mapped.skipped.some(function (s) { return s.reason === 'bad-url'; }));
  assert.ok(r.mapped.skipped.some(function (s) { return s.reason === 'no-url'; }));
  assert.ok(r.mapped.warnings.some(function (s) { return s.reason === 'duplicate-url'; }));
  assert.strictEqual(r.mapped.skipped.length, 4);
});
T('domain-like urls get https and bad pigment gets a default', function (F) {
  var r = importBytes(F, 'x.csv', new TextEncoder().encode('url,name_en,pigment\nexample.com/path,Ex,notacolour\n'));
  var t = r.plan.rows[0].tool;
  assert.strictEqual(t.url, 'https://example.com/path');
  assert.ok(F.PIGMENTS.indexOf(t.pigment) !== -1);
});
T('taken shortcut keys are dropped with a warning', function (F) {
  var r = importBytes(F, 'x.csv', new TextEncoder().encode('url,name_en,key\nhttps://a.io,A,p\nhttps://b.io,B,q\n'), null, 'merge', { p: 1 });
  assert.ok(r.plan.warnings.some(function (w) { return w.reason === 'key-taken' && w.value === 'p'; }));
  assert.strictEqual(r.plan.rows[0].tool.kbd, undefined);
  assert.strictEqual(r.plan.rows[1].tool.kbd, 'q');
});
T('hidden and instruction sheets are skipped unless they are the only sheet', function (F) {
  var sheets = [
    { name: 'README', hidden: false, rows: [['url'], ['https://readme.io']] },
    { name: 'Secret', hidden: true, rows: [['url'], ['https://secret.io']] },
    { name: 'Real', hidden: false, rows: [['url', 'name'], ['https://real.io', 'Real']] }
  ];
  var m = F.mineio.mapSheets(sheets);
  assert.strictEqual(m.count, 1);
  var only = F.mineio.mapSheets([{ name: 'Instructions', hidden: false, rows: [['url'], ['https://only.io']] }]);
  assert.strictEqual(only.count, 1);
});
T('variants come from repeated names, with host labels as fallback', function (F) {
  var csv = 'url,name_en,variant\nhttps://one.vercel.app,Tool,Main\nhttps://two.netlify.app,Tool,\nhttps://three.io,Other,\n';
  var r = importBytes(F, 'x.csv', new TextEncoder().encode(csv));
  assert.strictEqual(r.plan.new, 2);
  var t = r.plan.rows.find(function (x) { return x.tool.en === 'Tool'; }).tool;
  same(t.variants.map(function (v) { return v.en; }), ['Main', 'Two']);
});
T('sheet names with two scripts split into Arabic and English group names', function (F) {
  var m = F.mineio.mapSheets([{ name: 'محركات البحث · Search', hidden: false, rows: [['url'], ['https://a.io']] }]);
  assert.strictEqual(m.drafts[0].group.ar, 'محركات البحث'); assert.strictEqual(m.drafts[0].group.en, 'Search');
});
T('export then import returns the same links', function (F) {
  var a = importBytes(F, 'a.xlsx', bytes('templates/fihrist-links-template.xlsx'));
  var xl = F.xlsx.write(F.mineio.exportSheets(a.plan.payload));
  var b = importBytes(F, 'out.xlsx', xl);
  same(summary(b.plan), summary(a.plan));
  var csv = F.mineio.exportCSV(a.plan.payload);
  var c = importBytes(F, 'out.csv', new TextEncoder().encode(csv));
  same(summary(c.plan), summary(a.plan));
  var j = importBytes(F, 'out.json', new TextEncoder().encode(JSON.stringify(a.plan.payload)));
  same(summary(j.plan), summary(a.plan));
});
T('fihrist.json files import as links', function (F) {
  var doc = JSON.parse(fs.readFileSync(path.join(loader.root, 'fihrist.json'), 'utf8'));
  var r = importBytes(F, 'fihrist.json', new TextEncoder().encode(JSON.stringify(doc)));
  assert.ok(r.plan.new >= 30);
  assert.ok(F.mineDoc(r.plan.payload).tools.length >= 30);
});
T('storage guard refuses payloads over the size cap and keeps the old one', function (F) {
  var p = F.mineBlank(); p.groups.push({ id: 'u-g', ar: 'g', en: 'g', icon: 'star' });
  p.tools.push({ id: 'u-a-1234', group: 'u-g', pigment: 'bone', ar: 'a', en: 'a', url: 'https://a.io' });
  assert.ok(F.mineSave(p).ok);
  var big = JSON.parse(JSON.stringify(p));
  big.tools[0].den = new Array(1600000).join('x');
  var res = F.mineSave(big);
  assert.ok(!res.ok && res.reason === 'size');
  assert.strictEqual(F.mineRead().tools[0].den, undefined);
});
T('corrupt personal data is ignored without throwing', function (F) {
  var mem = { 'fihrist:mine:v1': '{not json' };
  var G = loader.loadCore(mem, { url: true, scripts: ['js/xlsx.js', 'js/mine-core.js'] }).F;
  assert.strictEqual(G.mineDoc().tools.length, 0);
});
T('one bad personal tool does not hide the good ones', function (F) {
  var p = { v: 1, groups: [{ id: 'u-g', ar: 'g', en: 'g', icon: 'star' }], tools: [{ id: 'u-ok-aaaa', group: 'u-g', pigment: 'bone', en: 'ok', url: 'https://ok.io' }, { id: 'BAD ID', group: 'u-g', en: 'bad', url: 'https://bad.io' }], updated: '' };
  assert.strictEqual(F.mineDoc(p).tools.length, 1);
});

T('600-link fixture imports within budget', function (F) {
  var file = path.join(loader.root, 'tools', 'fixtures', 'mine-600.xlsx');
  if (!fs.existsSync(file)) require('./fixtures/make-big');
  var data = new Uint8Array(fs.readFileSync(file)), t0 = Date.now();
  var r = importBytes(F, 'mine-600.xlsx', data);
  var parse = Date.now() - t0;
  assert.strictEqual(r.plan.rows.length >= 380 && r.plan.rows.length <= 600, true, 'tool count ' + r.plan.rows.length);
  assert.strictEqual(Object.keys(r.plan.groups).length, 12);
  assert.ok(parse <= 400, 'parse+plan ' + parse + 'ms');
  var t1 = Date.now(), res = F.mineSave(r.plan.payload), commit = Date.now() - t1;
  assert.ok(res.ok && commit <= 100, 'commit ' + commit + 'ms');
  var doc = F.mineDoc();
  assert.ok(doc.tools.length === r.plan.rows.length);
});

module.exports = { run: run };

if (require.main === module) process.exit(run(false) ? 0 : 1);
