'use strict';
var fs = require('fs');
var path = require('path');
var loader = require('./loader');

var SNAP = path.join(__dirname, 'regress.snap.json');
var QUERIES = [
  'parser alt', 'drug list full', 'qarar 460', 'paid 2', 'خارجي', 'الخارجي', 'kharegy', 'lhv', 'مار', 'roi quick',
  'typing', 'tebaa', 'بيان', 'roshetta', 'font', 'contacts', 'raqm qawmy', 'veritas', 'harvest', 'planner alt',
  'p', 'ا', '460', 'daftar', 'parsre', 'drug lsit', 'ledger folio', 'adad pdf'
];

function r3(n) { return Math.round(n * 1000) / 1000; }

function capture() {
  var core = loader.loadCore();
  var F = core.F;
  var doc = JSON.parse(fs.readFileSync(path.join(loader.root, 'fihrist.json'), 'utf8'));
  var data = F.validate(doc);
  F.prepare(data.tools, data.groups);
  data.tools.forEach(function (d, i) { d.folio = i + 1; });
  var out = {};
  ['ar', 'en'].forEach(function (lang) {
    var ctx = {
      lang: lang,
      isPinned: function () { return false; },
      frecency: F.frecency,
      isClosed: function (d, v) {
        var cv = v || (d.variants ? d.variants[d.def || 0] : null);
        return !!(d.closed || (cv && cv.closed));
      },
      curVariantId: function (d) { return d.variants ? d.variants[d.def || 0].id : null; }
    };
    QUERIES.forEach(function (q) {
      var res = F.search(q, data.tools, ctx);
      function pack(list) {
        return list.map(function (x) {
          return {
            id: x.d.id,
            vid: x.vid,
            score: r3(x.score),
            marks: x.marks.map(function (m) { return [m.kind, m.lang, m.vid, m.ranges]; })
          };
        });
      }
      (out[q] = out[q] || {})[lang] = { full: pack(res.full), partial: pack(res.partial), missed: res.missed };
    });
  });
  return out;
}

function run(write) {
  var now = capture();
  if (write) {
    fs.writeFileSync(SNAP, JSON.stringify(now) + '\n', 'utf8');
    console.log('snapshot written: ' + QUERIES.length + ' queries');
    return true;
  }
  if (!fs.existsSync(SNAP)) {
    console.error('missing tools/regress.snap.json');
    return false;
  }
  var base = JSON.parse(fs.readFileSync(SNAP, 'utf8'));
  var ok = 0, bad = [];
  QUERIES.forEach(function (q) {
    if (JSON.stringify(now[q]) === JSON.stringify(base[q])) ok++; else bad.push(q);
  });
  bad.forEach(function (q) { console.error('differs: ' + q); });
  console.log((bad.length ? 'FAIL ' : 'ok ') + ok + '/' + QUERIES.length);
  return !bad.length;
}

module.exports = { run: run, QUERIES: QUERIES };

if (require.main === module) {
  var good = run(process.argv.indexOf('--snap') !== -1);
  process.exit(good ? 0 : 1);
}
