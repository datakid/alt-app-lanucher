'use strict';
var fs = require('fs');
var path = require('path');

function mulberry32(seed) {
  var a = seed >>> 0;
  return function () {
    a = (a + 0x6D2B79F5) >>> 0;
    var t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

var NOUNS = [
  ['دواء', 'drug', 'dawa'], ['قائمة', 'list', 'qayma'], ['فاتورة', 'invoice', 'fatora'], ['تقرير', 'report', 'taqrir'],
  ['حاسبة', 'calculator', 'hasba'], ['جدول', 'sheet', 'gadwal'], ['مخزون', 'stock', 'makhzoun'], ['عميل', 'client', 'amil'],
  ['موعد', 'booking', 'maw3ed'], ['روشتة', 'prescription', 'roshetta'], ['تأمين', 'insurance', 'tamin'], ['خطاب', 'letter', 'khitab'],
  ['مهام', 'tasks', 'mohem'], ['ملف', 'file', 'malaf'], ['رسم', 'chart', 'rasm'], ['خريطة', 'map', 'khareta'],
  ['سجل', 'log', 'segel'], ['كشف', 'statement', 'kashf'], ['بيان', 'summary', 'bayan'], ['مرتب', 'payroll', 'mortab'],
  ['وردية', 'shift', 'wardeya'], ['فرع', 'branch', 'far3'], ['مورد', 'supplier', 'mowarred'], ['طلب', 'order', 'talab'],
  ['شحنة', 'shipment', 'shehna'], ['سعر', 'price', 'se3r'], ['خصم', 'discount', 'khasm'], ['ضريبة', 'tax', 'dariba'],
  ['ملاحظة', 'note', 'molahza'], ['قالب', 'template', 'qaleb'], ['محول', 'converter', 'mohawwel'], ['منسق', 'formatter', 'monassek'],
  ['متتبع', 'tracker', 'motatabbe3'], ['مولد', 'generator', 'mowalled'], ['فاحص', 'checker', 'fahes'], ['مقارن', 'comparer', 'moqaren']
];
var VERBS = [
  ['يحسب', 'calculates'], ['يحول', 'converts'], ['ينظف', 'cleans'], ['يستخرج', 'extracts'], ['يقارن', 'compares'],
  ['يرتب', 'sorts'], ['ينشئ', 'creates'], ['يتتبع', 'tracks'], ['يطبع', 'prints'], ['يقسم', 'splits'], ['يدمج', 'merges'], ['يراجع', 'reviews']
];
var OBJECTS = [
  ['الأسعار', 'prices'], ['الفواتير', 'invoices'], ['البيانات', 'data'], ['الجداول', 'tables'], ['المبيعات', 'sales'],
  ['الأرصدة', 'balances'], ['الطلبات', 'orders'], ['الكشوف', 'statements'], ['الأسماء', 'names'], ['التواريخ', 'dates'], ['المبالغ', 'amounts'], ['الملفات', 'files']
];
var GROUP_NAMES = [
  ['الأساسية', 'Core', 'core'], ['المبيعات', 'Sales', 'sales'], ['المخازن', 'Stock', 'stock'], ['الحسابات', 'Accounts', 'accounts'],
  ['الطباعة', 'Print', 'print'], ['العملاء', 'Clients', 'clients'], ['التقارير', 'Reports', 'reports'], ['الموارد', 'People', 'people'],
  ['التجريبية', 'Labs', 'labs'], ['الأدوات', 'Utilities', 'utils'], ['التأمين', 'Cover', 'cover'], ['المشتريات', 'Buying', 'buying']
];
var ICONS = ['layers', 'calc', 'flask', 'printer', 'star', 'box', 'pill', 'chart', 'doc'];
var PIGMENTS = ['indigo', 'verdigris', 'madder', 'orpiment', 'lapis', 'malachite', 'tyrian', 'bone'];
var HOSTS = ['vercel.app', 'netlify.app', 'github.io'];
var VARIANTS = [['main', 'الرئيسي', 'Main'], ['alt', 'بديل', 'Alt'], ['full', 'الكامل', 'Full'], ['express', 'سريع', 'Express']];

function build(count, seed) {
  var rnd = mulberry32(seed);
  function pick(list) { return list[Math.floor(rnd() * list.length)]; }
  var used = {};
  function slug(s) { return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, ''); }
  function host(slugText) {
    var kind = pick(HOSTS), base = slugText + '-' + Math.floor(rnd() * 36 * 36 * 36).toString(36);
    if (kind === 'github.io') return 'https://' + base.split('-')[0] + '.github.io/' + slugText + '/';
    return 'https://' + base + '.' + kind + (rnd() < .2 ? '/app' : '/');
  }
  var groups = GROUP_NAMES.map(function (g, i) { return { id: g[2], ar: g[0], en: g[1], icon: ICONS[i % ICONS.length] }; });
  var tools = [];
  for (var i = 0; i < count; i++) {
    var noun = pick(NOUNS), qual = pick(NOUNS), verb = pick(VERBS), obj = pick(OBJECTS);
    var en = noun[1].charAt(0).toUpperCase() + noun[1].slice(1) + ' ' + qual[1];
    var ar = noun[0] + ' ' + qual[0];
    var id = slug(en) + '-' + String(i + 1).padStart(4, '0');
    if (used[id]) id += 'x';
    used[id] = 1;
    var t = { id: id, group: groups[i % groups.length].id, pigment: pick(PIGMENTS), ar: ar, en: en };
    var o2 = pick(OBJECTS), n2 = pick(NOUNS), v2 = pick(VERBS), shape = Math.floor(rnd() * 6);
    t.dar = [
      verb[0] + ' ' + obj[0] + ' ' + noun[0] + ' ' + qual[0],
      noun[0] + ' ' + qual[0] + ' ' + v2[0] + ' ' + o2[0] + ' بسرعة',
      'أداة ' + verb[0] + ' ' + obj[0] + ' و' + o2[0],
      v2[0] + ' ' + n2[0] + ' ' + obj[0],
      'لوحة ' + noun[0] + ' ' + verb[0] + ' ' + o2[0],
      'ملف ' + qual[0] + ' ' + v2[0] + ' ' + obj[0] + ' من ' + n2[0]
    ][shape];
    t.den = [
      verb[1].charAt(0).toUpperCase() + verb[1].slice(1) + ' ' + obj[1] + ' for ' + noun[1] + ' ' + qual[1],
      noun[1].charAt(0).toUpperCase() + noun[1].slice(1) + ' ' + qual[1] + ' that ' + v2[1] + ' ' + o2[1],
      'Quick ' + n2[1] + ' ' + qual[1] + ' for ' + o2[1] + ' and ' + obj[1],
      v2[1].charAt(0).toUpperCase() + v2[1].slice(1) + ' ' + n2[1] + ' ' + obj[1],
      'A ' + noun[1] + ' board that ' + verb[1] + ' ' + o2[1],
      qual[1].charAt(0).toUpperCase() + qual[1].slice(1) + ' file ' + v2[1] + ' ' + obj[1] + ' from ' + n2[1]
    ][shape];
    t.aliases = [noun[2], noun[2] + ' ' + qual[2], noun[1], qual[1] + ' ' + noun[1]];
    if (rnd() < .5) t.aliases.push(noun[0], qual[0]);
    if (rnd() < .4) t.since = '2026-' + String(8 + Math.floor(rnd() * 3)).padStart(2, '0') + '-' + String(1 + Math.floor(rnd() * 28)).padStart(2, '0');
    var s = slug(en);
    if (rnd() < .3) {
      var nv = 2 + Math.floor(rnd() * 3), vs = [];
      for (var j = 0; j < nv; j++) {
        var v = VARIANTS[j];
        vs.push({ id: v[0], ar: v[1], en: v[2], url: host(s + '-' + v[0]), dar: rnd() < .5 ? verb[0] + ' ' + obj[0] + ' ' + v[1] : '', den: rnd() < .5 ? verb[1] + ' ' + obj[1] + ' ' + v[2].toLowerCase() : '' });
      }
      t.variants = vs.map(function (x) { var o = { id: x.id, ar: x.ar, en: x.en, url: x.url }; if (x.dar) o.dar = x.dar; if (x.den) o.den = x.den; return o; });
      t.def = 0;
    } else t.url = host(s);
    tools.push(t);
  }
  return { format: 'fihrist/5', revision: 1, updated: '2026-11-04', groups: groups, tools: tools };
}

function buildMine(seed) {
  var rnd = mulberry32(seed + 1), sheets = [], total = 0;
  function pick(list) { return list[Math.floor(rnd() * list.length)]; }
  GROUP_NAMES.forEach(function (g, gi) {
    var head = ['url', 'name_ar', 'name_en', 'description_ar', 'description_en', 'variant', 'aliases', 'pigment', 'key'], rows = [head], n = 0, i = 0;
    while (n < 50) {
      var noun = pick(NOUNS), qual = pick(NOUNS), name = noun[1].charAt(0).toUpperCase() + noun[1].slice(1) + ' ' + qual[1] + ' ' + (gi * 100 + i);
      var variants = rnd() < .15 ? 2 + Math.floor(rnd() * 2) : 1, v;
      for (v = 0; v < variants && n < 50; v++, n++) {
        var host = 'https://m' + gi + '-' + i + '-' + v + '.example' + (v % 2 ? '.netlify.app' : '.vercel.app') + '/';
        rows.push([host, noun[0] + ' ' + qual[0] + ' ' + (gi * 100 + i), name, 'وصف ' + noun[0], 'About ' + noun[1], variants > 1 ? VARIANTS[v][2] : '', noun[2] + ', ' + qual[2], pick(PIGMENTS), '']);
      }
      i++;
    }
    total += rows.length - 1;
    sheets.push({ name: g[0] + ' · ' + g[1], rows: rows, header: true, widths: [44, 22, 22, 36, 36, 14, 26, 12, 8] });
  });
  return sheets;
}

module.exports = { build: build, buildMine: buildMine };

if (require.main === module) {
  var dir = __dirname;
  var mine = buildMine(55), loaderMod = require('../loader'), FF = loaderMod.loadCore(null, { url: true, scripts: ['js/xlsx.js', 'js/mine-core.js'] }).F;
  fs.writeFileSync(path.join(dir, 'mine-600.xlsx'), Buffer.from(FF.xlsx.write(mine)));
  var csvRows = [['url', 'name_ar', 'name_en', 'description_ar', 'description_en', 'group', 'variant', 'aliases', 'pigment', 'key']];
  mine.forEach(function (s) { s.rows.slice(1).forEach(function (r) { csvRows.push([r[0], r[1], r[2], r[3], r[4], s.name, r[5], r[6], r[7], r[8]]); }); });
  fs.writeFileSync(path.join(dir, 'mine-600.csv'), '\uFEFF' + FF.mineio.toCSV(csvRows));
  console.log('wrote tools/fixtures/mine-600.xlsx and mine-600.csv');
  [[500, 'big-500.json'], [1500, 'big-1500.json']].forEach(function (x) {
    fs.writeFileSync(path.join(dir, x[1]), JSON.stringify(build(x[0], 55), null, 1) + '\n');
    console.log('wrote tools/fixtures/' + x[1]);
  });
}
