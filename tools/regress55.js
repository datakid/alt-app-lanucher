'use strict';
var fs = require('fs');
var path = require('path');
var loader = require('./loader');

function setup() {
  var F = loader.loadCore(null, { url: true }).F;
  var doc = JSON.parse(fs.readFileSync(path.join(__dirname, 'regress.fixture.json'), 'utf8'));
  var data = F.validate(doc);
  F.prepare(data.tools, data.groups);
  data.tools.forEach(function (d, i) { d.folio = i + 1; });
  return { F: F, data: data };
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

function listOf(out) {
  if (out.full.length) return out.full;
  if (out.guess && out.guess.length) return out.guess;
  return out.partial;
}

function ids(list) { return list.map(function (x) { return x.d.id; }); }
function sameSet(a, b) { return a.length === b.length && a.every(function (x) { return b.indexOf(x) !== -1; }); }

var CASES = [
  { q: 'https://lx-parser.vercel.app/', top: 'parser', vid: 'main' },
  { q: 'lx-parser.vercel', top: 'parser', vid: 'main' },
  { q: 'simpledashboard21', top: 'parser', vid: 'alt' },
  { q: 'netlify.app', has: ['protocols', 'paper', 'thread', 'parser'] },
  { q: '@netlify', exact: ['protocols', 'paper', 'thread', 'parser'] },
  { q: '460-prices', top: 'paid-calculator', vid: 'alt' },
  { q: 'https://ag-search.vercel.app', top: 'drug-list', vid: 'alt' },
  { q: 'www.bugvert.vercel.app', top: 'pillbug', vid: 'bugvert' },
  { q: 'https://example.org/x', none: true, url: true },
  { q: 'converts handwriting to font', top: 'font-maker' },
  { q: 'tool that splits shareholders revenue', top: 'qisma-mizan', vid: 'qisma' },
  { q: 'pdf statements from excel', top: 'adad' },
  { q: 'extract prescription data', top: 'bayan' },
  { q: 'equation solver tool', top: 'solver' },
  { q: 'تحويل خط اليد', top: 'font-maker' },
  { q: 'أداة لحساب نسبة التحمل', top: 'paid-calculator' },
  { q: 'github followers', top: 'gitlink' },
  { q: 'keyboard typing practice', top: 'typing-practice' },
  { q: 'clean text tables', top: 'text-tools' },
  { q: 'unit price converter', top: 'pillbug', vid: 'bugvert' },
  { q: '#print font', exact: ['font-maker'] },
  { q: '#طباعة', groupAll: 'print' },
  { q: 'the', shape: true },
  { q: 'في', shape: true },
  { q: 'pharmacy ledger entry', top: 'ledger-form' },
  { q: 'monthly movement ledger', top: 'dafter' },
  { q: 'drug group workspace', top: 'workspace' },
  { q: 'dispensing protocol reference', top: 'protocols' },
  { q: 'survival curve estimate', top: 'survival-mirror' },
  { q: 'recurring visit schedule', top: 'plan-maker' },
  { q: 'scoring ranking criteria', top: 'criteria-builder' },
  { q: 'keyboard first web launcher', top: 'tacit' },
  { q: 'favicons glyph tracing', top: 'harvest-studio' },
  { q: 'task and report tracker', top: 'to-do' },
  { q: 'contracted entities tracker', top: 'entity-tracker' },
  { q: 'prepare sift datasets', top: 'prep' },
  { q: 'charts diagram', top: 'draw' },
  { q: 'letters analysis by entity', top: 'letters' },
  { q: 'visit analysis by member', top: 'masar' },
  { q: 'khat yad', top: 'font-maker' }
];

var LIVE = [
  { q: 'power query', top: 'power-query-manager' },
  { q: 'power query viewer', top: 'power-query-manager' },
  { q: 'javascript', top: 'platen' },
  { q: 'golang', top: 'platen' },
  { q: 'rust', top: 'platen' },
  { q: 'sql', top: 'platen' },
  { q: 'جافاسكريبت', top: 'platen' },
  { q: 'coding practice', top: 'platen' },
  { q: 'باور كويري', top: 'power-query-manager' },
  { q: 'python practice', top: 'platen' },
  { q: 'بايثون', top: 'platen' },
  { q: 'reaction time', top: 'reaction-time' },
  { q: 'زمن رد الفعل', top: 'reaction-time' },
  { q: 'cover cards print', top: 'basic-cover' },
  { q: 'الغلاف', top: 'basic-cover' },
  { q: 'waymark', top: 'criteria-builder', vid: 'waymark' },
  { q: 'clinic flow', top: 'criteria-builder', vid: 'waymark' },
  { q: 'entity viewer', top: 'entity-tracker', vid: 'alt' },
  { q: 'contracted entities xlsx csv', top: 'entity-tracker', vid: 'alt' },
  { q: 'https://entity-viewer.vercel.app/', top: 'entity-tracker', vid: 'alt' },
  { q: 'https://waymark-hazel.vercel.app/#route', top: 'criteria-builder', vid: 'waymark' },
  { q: 'platen-2zj1', top: 'platen' },
  { q: '#practice', exact: ['typing-practice', 'platen', 'reaction-time'] },
  { q: '#التدريب', exact: ['typing-practice', 'platen', 'reaction-time'] },
  { q: 'typing', top: 'typing-practice' },
  { q: 'meridian', top: 'criteria-builder', vid: 'meridian' }
];

function check(F, data, c, lang) {
  var out = F.search(c.q, data.tools, ctxFor(F, lang)), list = listOf(out), got = ids(list), top = list[0], fails = [];
  if (c.top && (!top || top.d.id !== c.top)) fails.push('top1 ' + (top ? top.d.id : 'none') + ' expected ' + c.top);
  if (c.vid && (!top || top.vid !== c.vid)) fails.push('variant ' + (top ? top.vid : 'none') + ' expected ' + c.vid);
  if (c.has && !c.has.every(function (x) { return got.indexOf(x) !== -1; })) fails.push('missing from ' + got.join(','));
  if (c.exact && !sameSet(got, c.exact)) fails.push('set ' + got.join(',') + ' expected exactly ' + c.exact.join(','));
  if (c.none && got.length) fails.push('expected no results, got ' + got.join(','));
  if (c.url && !out.url) fails.push('out.url missing');
  if (c.groupAll) {
    var want = data.tools.filter(function (d) { return d.group === c.groupAll; }).map(function (d) { return d.id; });
    if (!sameSet(got, want)) fails.push('group set ' + got.join(',') + ' expected ' + want.join(','));
  }
  if (c.shape && !(Array.isArray(out.full) && Array.isArray(out.partial) && Array.isArray(out.missed))) fails.push('bad result shape');
  return fails;
}

function setupLive() {
  var F = loader.loadCore(null, { url: true }).F;
  var data = F.validate(JSON.parse(fs.readFileSync(path.join(loader.root, 'fihrist.json'), 'utf8')));
  F.prepare(data.tools, data.groups);
  data.tools.forEach(function (d, i) { d.folio = i + 1; });
  return { F: F, data: data };
}

function run(quiet) {
  var live = setupLive(), env = setup(), bad = 0, total = 0;
  LIVE.forEach(function (c) {
    ['ar', 'en'].forEach(function (lang) {
      total++;
      var fails;
      try { fails = check(live.F, live.data, c, lang); } catch (e) { fails = ['threw ' + e.message]; }
      if (fails.length) { bad++; if (!quiet) console.error('FAIL live [' + lang + '] ' + JSON.stringify(c.q) + ': ' + fails.join('; ')); }
    });
  });
  CASES.forEach(function (c) {
    ['ar', 'en'].forEach(function (lang) {
      total++;
      var fails;
      try { fails = check(env.F, env.data, c, lang); } catch (e) { fails = ['threw ' + e.message]; }
      if (fails.length) { bad++; if (!quiet) console.error('FAIL [' + lang + '] ' + JSON.stringify(c.q) + ': ' + fails.join('; ')); }
    });
  });
  var cmd = env.F.search('>theme', env.data.tools, ctxFor(env.F, 'en'));
  if (!quiet) console.log((bad ? 'FAIL ' : 'ok ') + (total - bad) + '/' + total + ' expectations (' + (CASES.length + LIVE.length) + ' queries x 2 languages, ' + LIVE.length + ' on the live data)');
  return bad === 0;
}

module.exports = { run: run, CASES: CASES };

if (require.main === module) process.exit(run(false) ? 0 : 1);
