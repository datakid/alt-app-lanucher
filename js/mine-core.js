(function (root) {
'use strict';
var F = root.F;
var IO = F.mineio = {};

var FIELDS = {
  url: ['url', 'link', 'href', 'address', 'website', 'رابط', 'الرابط', 'لينك', 'عنوان'],
  name_ar: ['name_ar', 'arabic', 'الاسم', 'اسم', 'الاسم بالعربي'],
  name_en: ['name_en', 'name', 'title', 'english', 'الاسم بالانجليزي'],
  desc_ar: ['description_ar', 'الوصف', 'وصف'],
  desc_en: ['description_en', 'description', 'desc', 'notes'],
  group: ['group', 'section', 'category', 'folder', 'القسم', 'المجموعة', 'تصنيف'],
  variant: ['variant', 'version', 'النسخة', 'نسخة'],
  aliases: ['aliases', 'keywords', 'tags', 'كلمات', 'كلمات البحث'],
  pigment: ['pigment', 'color', 'colour', 'اللون'],
  key: ['key', 'kbd', 'shortcut', 'اختصار']
};
var COLUMNS = ['url', 'name_ar', 'name_en', 'desc_ar', 'desc_en', 'group', 'variant', 'aliases', 'pigment', 'key'];
var SKIP_SHEET = /instructions|readme|تعليمات|اقرأ|examples?|أمثلة/i;
var AR_RE = /[\u0600-\u06FF]/;
var URLISH = /^(https?:\/\/\S+|[a-z0-9-]+(\.[a-z0-9-]+)+(\/\S*)?)$/i;
var SYN = null;
function syn() {
  if (SYN) return SYN;
  SYN = Object.create(null);
  Object.keys(FIELDS).forEach(function (k) { FIELDS[k].forEach(function (w) { SYN[F.norm(w)] = k; }); });
  return SYN;
}

IO.decodeBytes = function (bytes) {
  var b = bytes;
  if (b.length >= 3 && b[0] === 0xEF && b[1] === 0xBB && b[2] === 0xBF) b = b.subarray(3);
  try { return new TextDecoder('utf-8', { fatal: true }).decode(b); }
  catch (e) { return new TextDecoder('windows-1256').decode(b); }
};

function sniff(text) {
  var lines = text.split(/\r?\n/).slice(0, 5), best = ',', bestN = -1;
  [',', ';', '\t'].forEach(function (d) {
    var n = 0;
    lines.forEach(function (ln) { var q = false, i; for (i = 0; i < ln.length; i++) { if (ln[i] === '"') q = !q; else if (!q && ln[i] === d) n++; } });
    if (n > bestN) { bestN = n; best = d; }
  });
  return best;
}
IO.parseCSV = function (text) {
  if (text.charCodeAt(0) === 0xFEFF) text = text.slice(1);
  var d = sniff(text), rows = [], row = [], cell = '', q = false, i, c;
  for (i = 0; i < text.length; i++) {
    c = text[i];
    if (q) {
      if (c === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else q = false; }
      else cell += c;
    } else if (c === '"' && cell === '') q = true;
    else if (c === d) { row.push(cell); cell = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(cell); cell = '';
      rows.push(row); row = [];
    } else cell += c;
  }
  if (cell !== '' || row.length) { row.push(cell); rows.push(row); }
  return rows;
};
IO.toCSV = function (rows) {
  return rows.map(function (r) {
    return r.map(function (v) {
      v = v == null ? '' : String(v);
      return /[",\r\n;]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v;
    }).join(',');
  }).join('\r\n') + '\r\n';
};

IO.sheetsFromBytes = function (name, bytes) {
  var isZip = bytes.length > 3 && bytes[0] === 0x50 && bytes[1] === 0x4B;
  if (isZip) {
    if (!F.xlsx) throw new Error('xlsx-missing');
    return { sheets: F.xlsx.read(bytes).sheets };
  }
  var text = IO.decodeBytes(bytes);
  if (/\.json$/i.test(name) || /^\s*[\[{]/.test(text)) {
    var j = JSON.parse(text);
    return { json: j };
  }
  return { sheets: [{ name: '', hidden: false, rows: IO.parseCSV(text) }] };
};

function cellText(v) { return v == null ? '' : String(v).trim(); }
function headerMap(row) {
  var map = {}, hits = 0, s = syn();
  row.forEach(function (c, i) {
    var f = s[F.norm(cellText(c))];
    if (f && map[f] === undefined) { map[f] = i; hits++; }
  });
  return { map: map, hits: hits };
}
function detectColumns(rows) {
  var i, found = null;
  for (i = 0; i < Math.min(5, rows.length); i++) {
    var h = headerMap(rows[i]);
    if (h.hits >= 2 || (h.hits >= 1 && h.map.url !== undefined)) { found = { row: i, map: h.map }; break; }
  }
  if (found) return found;
  var width = 0, stats = [], sample = rows.filter(function (r) { return r.some(function (c) { return cellText(c); }); }).slice(0, 50);
  sample.forEach(function (r) { if (r.length > width) width = r.length; });
  var c, k;
  for (c = 0; c < width; c++) {
    var st = { url: 0, ar: 0, lat: 0, latLen: 0 };
    sample.forEach(function (r) {
      var v = cellText(r[c]);
      if (!v) return;
      if (URLISH.test(v)) st.url++;
      else if (AR_RE.test(v)) st.ar++;
      else { st.lat++; st.latLen += v.length; }
    });
    stats.push(st);
  }
  var map = {}, urlCol = -1, best = 0;
  stats.forEach(function (st, ci) { if (st.url > best) { best = st.url; urlCol = ci; } });
  if (urlCol < 0) return { row: -1, map: {} };
  map.url = urlCol;
  var arCol = -1;
  best = 0;
  stats.forEach(function (st, ci) { if (ci !== urlCol && st.ar > best) { best = st.ar; arCol = ci; } });
  if (arCol >= 0) map.name_ar = arCol;
  var lat = [];
  stats.forEach(function (st, ci) { if (ci !== urlCol && ci !== arCol && st.lat) lat.push({ ci: ci, avg: st.latLen / st.lat }); });
  lat.sort(function (a, b) { return a.avg - b.avg; });
  if (lat.length === 1) map.name_en = lat[0].ci;
  else if (lat.length > 1) { map.name_en = lat[0].ci; map.desc_en = lat[lat.length - 1].ci; }
  return { row: -1, map: map };
}

function hostOf(u) { var m = /^https?:\/\/([^\/?#]+)/i.exec(u); return m ? m[1].toLowerCase().replace(/^www\./, '') : ''; }
IO.prettyHost = function (u) {
  var h = hostOf(u).split('.')[0] || u;
  return h.replace(/[-_]+/g, ' ').replace(/\b[a-z]/g, function (m) { return m.toUpperCase(); }).trim();
};
function fixUrl(v) {
  v = cellText(v);
  if (!v) return null;
  if (!/^[a-z][a-z0-9+.-]*:\/\//i.test(v)) { if (!URLISH.test(v) || /\s/.test(v)) return null; v = 'https://' + v; }
  return /^https?:\/\/[^\s]+$/i.test(v) ? v : null;
}
function splitGroupName(name) {
  var parts = name.split(/\s*[·\/|]\s*/), ar = '', en = '', p;
  if (parts.length === 2) {
    parts.forEach(function (x) { if (AR_RE.test(x)) ar = ar || x.trim(); else en = en || x.trim(); });
    if (ar && en) return { ar: ar, en: en };
  }
  p = name.trim();
  return AR_RE.test(p) ? { ar: p, en: p } : { ar: p, en: p };
}
IO.fixUrl = fixUrl;
IO.groupFor = function (name) { return groupFor(name); };
IO.defaultGroup = function () { return { id: 'u-my-links', ar: 'روابطي', en: 'My links', icon: 'star' }; };
function groupFor(name) {
  var n = cellText(name);
  if (!n) return IO.defaultGroup();
  var g = splitGroupName(n);
  return { id: F.mineGroupId(g.en || g.ar), ar: g.ar, en: g.en, icon: 'star' };
}
function aliasesOf(v) { return cellText(v).split(/[,;،]/).map(function (x) { return x.trim(); }).filter(Boolean).slice(0, 12); }

IO.mapSheets = function (sheets, opts) {
  opts = opts || {};
  var items = [], skipped = [], warnings = [], seenUrl = Object.create(null), usable = sheets.filter(function (s) { return !s.hidden; });
  var only = usable.length === 1;
  usable.forEach(function (sh) {
    if (!only && sh.name && SKIP_SHEET.test(sh.name)) return;
    var rows = sh.rows || [], det = detectColumns(rows), map = det.map;
    if (map.url === undefined) { if (rows.length) skipped.push({ sheet: sh.name, row: 0, reason: 'no-url-column' }); return; }
    var sheetGroup = sh.name ? groupFor(sh.name) : IO.defaultGroup(), r;
    for (r = det.row + 1; r < rows.length; r++) {
      var row = rows[r] || [];
      if (!row.some(function (c) { return cellText(c); })) continue;
      var get = function (f) { return map[f] === undefined ? '' : cellText(row[map[f]]); };
      var raw = get('url'), url = fixUrl(raw);
      if (!raw) { skipped.push({ sheet: sh.name, row: r + 1, reason: 'no-url' }); continue; }
      if (!url) { skipped.push({ sheet: sh.name, row: r + 1, reason: 'bad-url', value: raw.slice(0, 60) }); continue; }
      var key = F.normUrl(url);
      if (seenUrl[key]) { warnings.push({ sheet: sh.name, row: r + 1, reason: 'duplicate-url' }); continue; }
      seenUrl[key] = 1;
      var g = map.group !== undefined && get('group') ? groupFor(get('group')) : sheetGroup;
      var pig = get('pigment').toLowerCase();
      var kb = get('key').toLowerCase();
      items.push({
        sheet: sh.name, row: r + 1, group: g, url: url, nameAr: get('name_ar'), nameEn: get('name_en'), descAr: get('desc_ar'), descEn: get('desc_en'),
        variant: get('variant'), aliases: aliasesOf(get('aliases')), pigment: F.PIGMENTS.indexOf(pig) !== -1 ? pig : '', kbd: /^[a-z0-9]$/.test(kb) ? kb : '', badKey: kb && !/^[a-z0-9]$/.test(kb) ? kb : ''
      });
    }
  });
  return { drafts: IO.group(items), skipped: skipped, warnings: warnings, count: items.length };
};

IO.group = function (items) {
  var map = Object.create(null), out = [];
  items.forEach(function (it) {
    var name = F.norm(it.nameAr || it.nameEn || IO.prettyHost(it.url)), key = it.group.id + '|' + name, d = map[key];
    if (!d) {
      d = map[key] = { group: it.group, nameAr: it.nameAr, nameEn: it.nameEn, descAr: it.descAr, descEn: it.descEn, aliases: it.aliases.slice(), pigment: it.pigment, kbd: it.kbd, badKey: it.badKey, rows: [], urls: [] };
      if (!d.nameAr && !d.nameEn) d.nameEn = IO.prettyHost(it.url);
      out.push(d);
    } else {
      if (!d.descAr) d.descAr = it.descAr;
      if (!d.descEn) d.descEn = it.descEn;
      if (!d.pigment) d.pigment = it.pigment;
      it.aliases.forEach(function (a) { if (d.aliases.indexOf(a) === -1) d.aliases.push(a); });
    }
    d.rows.push({ sheet: it.sheet, row: it.row });
    d.urls.push({ url: it.url, variant: it.variant });
  });
  return out;
};

function variantsOf(d, existing) {
  var used = Object.create(null), out = [];
  d.urls.forEach(function (u, i) {
    var found = existing && existing.find(function (v) { return F.normUrl(v.url) === F.normUrl(u.url); });
    var label = u.variant || (found && (found.en || found.ar)) || IO.prettyHost(u.url) || 'v' + (i + 1);
    var id = found ? found.id : (F.slugOf(label) || 'v' + (i + 1));
    var base = id, n = 2;
    while (used[id]) id = base + '-' + n++;
    used[id] = 1;
    out.push({ id: id, ar: AR_RE.test(label) ? label : (found && found.ar) || label, en: AR_RE.test(label) ? (found && found.en) || label : label, url: u.url });
  });
  return out;
}

function buildTool(d, id) {
  var first = d.urls[0].url, t = { id: id || F.mineToolId(d.nameEn || d.nameAr, first), group: d.group.id, pigment: d.pigment || F.pigmentFor(hostOf(first)), ar: d.nameAr, en: d.nameEn };
  if (d.descAr) t.dar = d.descAr;
  if (d.descEn) t.den = d.descEn;
  if (d.aliases.length) t.aliases = d.aliases;
  if (d.kbd) t.kbd = d.kbd;
  if (d.urls.length > 1) { t.variants = variantsOf(d, null); t.def = 0; } else t.url = first;
  return t;
}
function urlsOf(t) { return t.variants ? t.variants.map(function (v) { return v.url; }) : [t.url]; }
function same(a, b) { return JSON.stringify(a) === JSON.stringify(b); }

IO.plan = function (drafts, payload, mode, takenKeys) {
  var cur = JSON.parse(JSON.stringify(payload || F.mineBlank())), byUrl = Object.create(null), res = { new: 0, updated: 0, unchanged: 0, rows: [], groups: Object.create(null), warnings: [] };
  var next = mode === 'replace' ? { v: 1, groups: [], tools: [], updated: '' } : cur;
  cur.tools.forEach(function (t, i) { urlsOf(t).forEach(function (u) { byUrl[F.normUrl(u)] = i; }); });
  var taken = Object.create(null);
  Object.keys(takenKeys || {}).forEach(function (k) { taken[k] = 1; });
  function ensureGroup(g) { if (!next.groups.some(function (x) { return x.id === g.id; })) next.groups.push({ id: g.id, ar: g.ar, en: g.en, icon: g.icon || 'star' }); }
  var kept = [];
  drafts.forEach(function (d) {
    if (d.kbd) { if (taken[d.kbd]) { res.warnings.push({ reason: 'key-taken', value: d.kbd, name: d.nameEn || d.nameAr }); d.kbd = ''; } else taken[d.kbd] = 1; }
    if (d.badKey) res.warnings.push({ reason: 'key-invalid', value: d.badKey, name: d.nameEn || d.nameAr });
    var hit = null, i;
    for (i = 0; i < d.urls.length && hit === null; i++) { var k = byUrl[F.normUrl(d.urls[i].url)]; if (k !== undefined) hit = k; }
    var tool, status;
    if (hit !== null) {
      var old = cur.tools[hit];
      tool = buildTool(d, old.id);
      if (d.urls.length > 1 || old.variants) {
        var merged = d.urls.slice();
        (old.variants || [{ url: old.url, id: 'main', en: 'main', ar: 'main' }]).forEach(function (v) { if (!merged.some(function (m) { return F.normUrl(m.url) === F.normUrl(v.url); })) merged.push({ url: v.url, variant: v.en || v.ar }); });
        var dd = Object.assign({}, d, { urls: merged });
        tool = buildTool(dd, old.id);
        if (merged.length > 1) { tool.variants = variantsOf(dd, old.variants); tool.def = old.def || 0; delete tool.url; }
      }
      if (!d.pigment) tool.pigment = old.pigment;
      if (!d.kbd && old.kbd) tool.kbd = old.kbd;
      status = same(tool, old) ? 'unchanged' : 'updated';
      if (mode !== 'replace') cur.tools[hit] = tool;
    } else {
      tool = buildTool(d, null);
      var n = 2, base = tool.id;
      while (next.tools.some(function (x) { return x.id === tool.id; }) || kept.some(function (x) { return x.id === tool.id; })) tool.id = base + '-' + n++;
      status = 'new';
    }
    res[status]++;
    ensureGroup(d.group);
    res.groups[d.group.id] = res.groups[d.group.id] || { id: d.group.id, ar: d.group.ar, en: d.group.en, n: 0 };
    res.groups[d.group.id].n++;
    res.rows.push({ status: status, tool: tool, group: d.group.id });
    if (mode === 'replace' || status === 'new') { next.tools.push(tool); kept.push(tool); }
  });
  next.groups = next.groups.filter(function (g) { return next.tools.some(function (t) { return t.group === g.id; }); });
  res.payload = next;
  return res;
};

IO.exportSheets = function (payload) {
  var head = ['url', 'name_ar', 'name_en', 'description_ar', 'description_en', 'variant', 'aliases', 'pigment', 'key'], out = [];
  payload.groups.forEach(function (g) {
    var rows = [head];
    payload.tools.filter(function (t) { return t.group === g.id; }).forEach(function (t) {
      var vs = t.variants || [{ url: t.url, en: '', ar: '' }];
      vs.forEach(function (v) { rows.push([v.url, t.ar || '', t.en || '', t.dar || '', t.den || '', t.variants ? (v.en || v.ar || '') : '', (t.aliases || []).join(', '), t.pigment || '', t.kbd || '']); });
    });
    out.push({ name: g.ar === g.en || !AR_RE.test(g.ar) || !g.en ? (g.en || g.ar) : g.ar + ' · ' + g.en, rows: rows, header: true, widths: [44, 22, 22, 36, 36, 14, 26, 12, 8], validations: [{ col: 'H', values: F.PIGMENTS }] });
  });
  return out;
};
IO.exportCSV = function (payload) {
  var rows = [['url', 'name_ar', 'name_en', 'description_ar', 'description_en', 'group', 'variant', 'aliases', 'pigment', 'key']];
  payload.groups.forEach(function (g) {
    var gname = g.ar === g.en ? g.en : (AR_RE.test(g.ar) && g.en ? g.ar + ' · ' + g.en : g.en || g.ar);
    payload.tools.filter(function (t) { return t.group === g.id; }).forEach(function (t) {
      (t.variants || [{ url: t.url }]).forEach(function (v) { rows.push([v.url, t.ar || '', t.en || '', t.dar || '', t.den || '', gname, t.variants ? (v.en || v.ar || '') : '', (t.aliases || []).join(', '), t.pigment || '', t.kbd || '']); });
    });
  });
  return '\uFEFF' + IO.toCSV(rows);
};

IO.templateSheets = function () {
  var head = ['url', 'name_ar', 'name_en', 'description_ar', 'description_en', 'variant', 'aliases', 'pigment', 'key'];
  var widths = [44, 22, 22, 36, 36, 14, 26, 12, 8];
  var pig = [{ col: 'H', values: F.PIGMENTS }];
  var instr = [
    ['تعليمات · Instructions'],
    ['كل ورقة = مجموعة. · One sheet = one group.'],
    ['العمود url مطلوب، والباقي اختياري. · Only the url column is required.'],
    ['ضع اسمًا بالعربية أو الإنجليزية أو الاثنين. · Give an Arabic name, an English name, or both.'],
    ['لإضافة نسخ: كرّر الاسم نفسه في صفوف بروابط مختلفة. · For variants, repeat the same name on rows with different urls.'],
    ['اسم النسخة في العمود variant، وإلا يُؤخذ من الموقع. · The variant name goes in the variant column, otherwise it comes from the host.'],
    ['كلمات البحث في aliases مفصولة بفاصلة. · Search words go in aliases, separated by commas.'],
    ['اللون من: ' + F.PIGMENTS.join(', ') + ' · Colour is one of: ' + F.PIGMENTS.join(', ')],
    ['اختصار الحرف: حرف أو رقم واحد في key. · A shortcut is one letter or digit in key.'],
    ['احذف الصفوف الأمثلة قبل الاستيراد أو اتركها. · Delete the example rows before importing, or keep them.']
  ];
  return [
    { name: 'تعليمات · Instructions', rows: instr, widths: [110], wrap: true },
    { name: 'أدوات العمل', rows: [head,
      ['https://calendar.google.com', 'التقويم', 'Calendar', 'جدول المواعيد والاجتماعات', 'Meetings and schedule', '', 'مواعيد, calendar', 'lapis', ''],
      ['https://docs.google.com', 'المستندات', 'Docs', 'كتابة المستندات', 'Write documents', 'Docs', 'word, كتابة', 'indigo', ''],
      ['https://docs.google.com/spreadsheets', 'المستندات', 'Docs', '', '', 'Sheets', 'excel, جداول', 'verdigris', ''],
      ['https://example.com/ar-only', 'دليل الموظف', '', 'دليل داخلي للموظفين', '', '', 'دليل', 'madder', '']
    ], header: true, widths: widths, validations: pig },
    { name: 'Personal', rows: [head,
      ['https://news.ycombinator.com', '', 'Hacker News', '', 'Tech news', '', 'news, hn', 'orpiment', ''],
      ['https://github.com', '', 'GitHub', '', 'Code hosting', '', 'git, repos', 'bone', ''],
      ['https://wikipedia.org', '', 'Wikipedia', '', 'The free encyclopedia', '', 'encyclopedia, wiki', 'tyrian', '']
    ], header: true, widths: widths, validations: pig }
  ];
};
IO.templateCSV = function () {
  var rows = [['url', 'name_ar', 'name_en', 'description_ar', 'description_en', 'group', 'variant', 'aliases', 'pigment', 'key']];
  IO.templateSheets().slice(1).forEach(function (s) {
    s.rows.slice(1).forEach(function (r) { rows.push([r[0], r[1], r[2], r[3], r[4], s.name, r[5], r[6], r[7], r[8]]); });
  });
  return '\uFEFF' + IO.toCSV(rows);
};

IO.fromJSON = function (j) {
  var drafts = [];
  if (j && j.v === 1 && Array.isArray(j.tools) && Array.isArray(j.groups)) {
    var gmap = Object.create(null);
    j.groups.forEach(function (g) { gmap[g.id] = g; });
    j.tools.forEach(function (t) {
      var g = gmap[t.group] || IO.defaultGroup();
      var gg = { id: String(g.id).indexOf('u-') === 0 ? g.id : F.mineGroupId(g.en || g.ar), ar: g.ar, en: g.en, icon: g.icon || 'star' };
      var urls = t.variants ? t.variants.map(function (v) { return { url: v.url, variant: v.en || v.ar || '' }; }) : [{ url: t.url, variant: '' }];
      drafts.push({ group: gg, nameAr: t.ar || '', nameEn: t.en || '', descAr: t.dar || '', descEn: t.den || '', aliases: t.aliases || [], pigment: t.pigment || '', kbd: t.kbd || '', badKey: '', rows: [], urls: urls });
    });
    return { drafts: drafts, skipped: [], warnings: [], count: drafts.length };
  }
  if (j && Array.isArray(j.tools) && Array.isArray(j.groups)) {
    var doc = F.validate(j), gm = Object.create(null);
    doc.groups.forEach(function (g) { gm[g.id] = g; });
    doc.tools.forEach(function (t) {
      var g = gm[t.group];
      var gg = { id: F.mineGroupId(g.en || g.ar), ar: g.ar, en: g.en, icon: g.icon || 'star' };
      var urls = t.variants ? t.variants.map(function (v) { return { url: v.url, variant: v.en || v.ar || '' }; }) : [{ url: t.url, variant: '' }];
      if (t.closed) return;
      drafts.push({ group: gg, nameAr: t.ar, nameEn: t.en, descAr: t.dar, descEn: t.den, aliases: (t.aliases || []).slice(0, 12), pigment: t.pigment, kbd: '', badKey: '', rows: [], urls: urls });
    });
    return { drafts: drafts, skipped: [], warnings: [], count: drafts.length };
  }
  throw new Error('bad-json');
};
})(typeof window !== 'undefined' ? window : globalThis);
