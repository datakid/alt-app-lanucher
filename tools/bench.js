'use strict';
var fs = require('fs');
var path = require('path');
var loader = require('./loader');
var queries = require('./queries');

var RUNS = 50, COLD_RUNS = 7;
var BUDGETS = {
  real: { build: 5, median: 0.3, p95: 1 },
  'big-500': { build: 40, median: 2, p95: 5 },
  'big-1500': { build: 120, median: 5, p95: 12 }
};
var enforce = process.argv.indexOf('--enforce') !== -1;

function now() { var t = process.hrtime(); return t[0] * 1e3 + t[1] / 1e6; }
function pct(sorted, p) { return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * p))]; }
function fmt(n) { return n.toFixed(n < 10 ? 2 : 1); }

function datasets() {
  var list = [{ name: 'real', doc: JSON.parse(fs.readFileSync(path.join(loader.root, 'fihrist.json'), 'utf8')) }];
  ['big-500', 'big-1500'].forEach(function (n) {
    var file = path.join(__dirname, 'fixtures', n + '.json');
    if (!fs.existsSync(file)) require('./fixtures/make-big');
    if (!fs.existsSync(file)) {
      var make = require('./fixtures/make-big');
      fs.writeFileSync(file, JSON.stringify(make.build(n === 'big-500' ? 500 : 1500, 55), null, 1) + '\n');
    }
    list.push({ name: n, doc: JSON.parse(fs.readFileSync(file, 'utf8')) });
  });
  return list;
}

function ctxFor(F, lang) {
  return {
    lang: lang,
    isPinned: function () { return false; },
    frecency: F.frecency,
    isClosed: function (d, v) { var cv = v || (d.variants ? d.variants[d.def || 0] : null); return !!(d.closed || (cv && cv.closed)); },
    curVariantId: function (d) { return d.variants ? d.variants[d.def || 0].id : null; }
  };
}

function benchOne(ds) {
  var builds = [];
  for (var b = 0; b < COLD_RUNS; b++) {
    var G = loader.loadCore(null, { url: true, corePath: process.env.BENCH_CORE || null }).F;
    var copy = G.validate(ds.doc);
    var t0 = now();
    G.prepare(copy.tools, copy.groups);
    if (G.ensureIndex) G.ensureIndex(copy.tools);
    builds.push(now() - t0);
  }
  builds.sort(function (a, c) { return a - c; });
  var F = loader.loadCore(null, { url: true, corePath: process.env.BENCH_CORE || null }).F;
  var data = F.validate(ds.doc);
  F.prepare(data.tools, data.groups);
  if (F.ensureIndex) F.ensureIndex(data.tools);
  data.tools.forEach(function (d, i) { d.folio = i + 1; });
  var qs = queries.V4.concat(queries.PLAN);
  var samples = [];
  var worst = { q: '', ms: 0 };
  ['ar', 'en'].forEach(function (lang) {
    var ctx = ctxFor(F, lang);
    qs.forEach(function (q) {
      try { F.search(q, data.tools, ctx); } catch (e) { return; }
      for (var r = 0; r < RUNS; r++) {
        F.cacheStamp++;
        var t1 = now();
        F.search(q, data.tools, ctx);
        var dt = now() - t1;
        samples.push(dt);
        if (dt > worst.ms) worst = { q: q, ms: dt };
      }
    });
  });
  samples.sort(function (a, c) { return a - c; });
  return { name: ds.name, tools: data.tools.length, build: builds[builds.length - 1], buildMedian: builds[3], median: pct(samples, .5), p95: pct(samples, .95), worst: worst, n: samples.length };
}

function main() {
  var rows = datasets().map(benchOne);
  var out = [];
  out.push('index = slowest of ' + COLD_RUNS + ' cold first builds in fresh contexts (what a user pays once)');
  out.push('dataset    tools  index(ms)  median  budget   median(ms)  budget   p95(ms)  budget   worst');
  var ok = true;
  rows.forEach(function (r) {
    var bud = BUDGETS[r.name];
    var pass = r.build <= bud.build && r.median <= bud.median && r.p95 <= bud.p95;
    if (!pass) ok = false;
    out.push([
      r.name.padEnd(10), String(r.tools).padStart(5), fmt(r.build).padStart(10), fmt(r.buildMedian).padStart(7), ('<=' + bud.build).padStart(7),
      fmt(r.median).padStart(12), ('<=' + bud.median).padStart(7), fmt(r.p95).padStart(10), ('<=' + bud.p95).padStart(7),
      '  ' + fmt(r.worst.ms) + 'ms "' + r.worst.q + '"', pass ? '' : '  OVER'
    ].join(' '));
  });
  console.log(out.join('\n'));
  if (enforce && !ok) { console.error('bench budgets missed'); return false; }
  return true;
}

module.exports = { main: main, BUDGETS: BUDGETS };

if (require.main === module) process.exit(main() ? 0 : 1);
