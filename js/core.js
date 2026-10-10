(function () {
'use strict';
var F = window.F = {};
var KEY = 'fihrist:v4', DKEY = 'fihrist:data:v4';
var PIGMENTS = ['indigo', 'verdigris', 'madder', 'orpiment', 'lapis', 'malachite', 'tyrian', 'bone'];
var ICONS_OK = { layers: 1, calc: 1, flask: 1, printer: 1, star: 1, box: 1 };

var store = { theme: 'system', lang: 'ar', tab: 'all', density: 'cozy', newTab: false, pins: [], visits: {}, lastVariant: {} };
function hydrate(src) {
  if (!src || typeof src !== 'object') return;
  Object.keys(store).forEach(function (k) {
    var a = store[k], b = src[k];
    if (b == null || typeof a !== typeof b || Array.isArray(a) !== Array.isArray(b)) return;
    store[k] = b;
  });
}
try {
  var cur = JSON.parse(localStorage.getItem(KEY) || 'null');
  var legacy = JSON.parse(localStorage.getItem('fihrist:v3') || 'null') || JSON.parse(localStorage.getItem('fihrist:v2') || 'null');
  hydrate(cur || legacy);
  if (!cur && legacy && Array.isArray(legacy.recents)) legacy.recents.forEach(function (id, i) { store.visits[id] = { n: 3 - Math.min(i, 2), t: Date.now() - i * 864e5 }; });
} catch (e) {}
var persistT = null;
F.store = store;
F.persist = function () {
  clearTimeout(persistT);
  persistT = setTimeout(function () { try { localStorage.setItem(KEY, JSON.stringify(store)); } catch (e) {} }, 60);
};
F.onExternal = null;
addEventListener('storage', function (e) {
  if (e.key !== KEY || !e.newValue) return;
  try { hydrate(JSON.parse(e.newValue)); if (F.onExternal) F.onExternal(); } catch (x) {}
});

function str(x) { return typeof x === 'string' ? x.trim() : ''; }
function isUrl(u) { return /^https?:\/\/[^\s]+$/i.test(u); }
F.validate = function (doc) {
  if (!doc || typeof doc !== 'object') throw new Error('Not an object');
  if (!Array.isArray(doc.tools) || !doc.tools.length) throw new Error('"tools" must be a non-empty array');
  var groups = Array.isArray(doc.groups) && doc.groups.length ? doc.groups : null;
  if (!groups) throw new Error('"groups" must be a non-empty array');
  var gids = {}, out = { format: 'fihrist/4', revision: Number(doc.revision) || 0, updated: str(doc.updated), groups: [], tools: [] };
  groups.forEach(function (g, i) {
    var id = str(g.id); if (!id || gids[id]) throw new Error('Group #' + (i + 1) + ' has a missing or duplicate id');
    gids[id] = 1;
    out.groups.push({ id: id, ar: str(g.ar) || str(g.en) || id, en: str(g.en) || str(g.ar) || id, icon: ICONS_OK[g.icon] ? g.icon : 'box' });
  });
  var tids = {};
  doc.tools.forEach(function (t, i) {
    var where = 'Tool #' + (i + 1) + (t && t.id ? ' (' + t.id + ')' : '');
    var id = str(t && t.id);
    if (!id || tids[id]) throw new Error(where + ': missing or duplicate id');
    if (!gids[t.group]) throw new Error(where + ': unknown group "' + t.group + '"');
    if (!str(t.ar) && !str(t.en)) throw new Error(where + ': needs "ar" or "en"');
    tids[id] = 1;
    var o = { id: id, group: t.group, pigment: PIGMENTS.indexOf(t.pigment) !== -1 ? t.pigment : 'indigo',
      ar: str(t.ar) || str(t.en), en: str(t.en) || str(t.ar), dar: str(t.dar) || str(t.den), den: str(t.den) || str(t.dar),
      aliases: Array.isArray(t.aliases) ? t.aliases.filter(function (a) { return typeof a === 'string' && a.trim(); }) : [],
      closed: !!t.closed, since: /^\d{4}-\d{2}-\d{2}$/.test(t.since || '') ? t.since : '' };
    if (Array.isArray(t.variants) && t.variants.length) {
      var vids = {};
      o.variants = t.variants.map(function (v, j) {
        var vid = str(v && v.id) || 'v' + j;
        if (vids[vid]) throw new Error(where + ': duplicate variant id "' + vid + '"');
        if (!isUrl(str(v.url))) throw new Error(where + ': variant "' + vid + '" has an invalid url');
        vids[vid] = 1;
        return { id: vid, ar: str(v.ar) || str(v.en) || vid, en: str(v.en) || str(v.ar) || vid, url: str(v.url), dar: str(v.dar), den: str(v.den),
          aliases: Array.isArray(v.aliases) ? v.aliases.filter(function (a) { return typeof a === 'string' && a.trim(); }) : [], closed: !!v.closed };
      });
      o.def = Math.min(Math.max(0, Number(t.def) || 0), o.variants.length - 1);
    } else {
      if (!isUrl(str(t.url))) throw new Error(where + ': needs a valid "url" or "variants"');
      o.url = str(t.url);
    }
    out.tools.push(o);
  });
  return out;
};

F.SCHEMA_REF = './fihrist.schema.json';
F.serialize = function (doc) {
  function has(v) { return v !== '' && v != null && v !== false && !(Array.isArray(v) && !v.length); }
  function pick(o, keys) { var r = {}; keys.forEach(function (k) { if (has(o[k])) r[k] = o[k]; }); return r; }
  function val(v) { return Array.isArray(v) ? '[' + v.map(function (x) { return JSON.stringify(x); }).join(', ') + ']' : JSON.stringify(v); }
  function line(o) { return '{ ' + Object.keys(o).map(function (k) { return JSON.stringify(k) + ': ' + val(o[k]); }).join(', ') + ' }'; }
  var groups = doc.groups.map(function (g) { return '    ' + line(pick(g, ['id', 'ar', 'en', 'icon'])); });
  var tools = doc.tools.map(function (t) {
    var o = pick(t, ['id', 'group', 'pigment', 'closed', 'url', 'since', 'ar', 'en', 'dar', 'den', 'aliases']);
    if (!t.variants) return '    ' + line(o);
    o.def = t.def || 0;
    var vs = t.variants.map(function (v) { return '        ' + line(pick(v, ['id', 'ar', 'en', 'dar', 'den', 'aliases', 'closed', 'url'])); });
    return '    ' + line(o).slice(0, -2) + ',\n      "variants": [\n' + vs.join(',\n') + '\n      ] }';
  });
  return '{\n' +
    '  "$schema": ' + JSON.stringify(F.SCHEMA_REF) + ',\n' +
    '  "format": "fihrist/4",\n' +
    '  "revision": ' + Math.max(1, doc.revision | 0) + ',\n' +
    '  "updated": ' + JSON.stringify(doc.updated) + ',\n' +
    '  "groups": [\n' + groups.join(',\n') + '\n  ],\n' +
    '  "tools": [\n' + tools.join(',\n') + '\n  ]\n}\n';
};

F.loadInitial = function () {
  var seed = F.validate(window.FIHRIST_SEED), pick = { doc: seed, src: 'seed' };
  try {
    var c = JSON.parse(localStorage.getItem(DKEY) || 'null');
    if (c && c.doc && (c.forced || c.doc.revision > seed.revision)) pick = { doc: F.validate(c.doc), src: c.src || 'cache' };
  } catch (e) {}
  F.seed = seed;
  return pick;
};
F.saveDoc = function (doc, src, forced) {
  try { localStorage.setItem(DKEY, JSON.stringify({ doc: doc, src: src, forced: !!forced, at: Date.now() })); } catch (e) {}
};
F.dropDoc = function () { try { localStorage.removeItem(DKEY); } catch (e) {} };
F.canFetch = /^https?:$/.test(location.protocol);
F.fetchRemote = function () {
  if (!F.canFetch || !window.fetch) return Promise.reject(new Error('offline-file'));
  return fetch('fihrist.json', { cache: 'no-cache' }).then(function (r) {
    if (!r.ok) throw new Error('HTTP ' + r.status);
    return r.json();
  }).then(F.validate);
};

F.hostOf = function (u) { try { return new URL(u).host.replace(/^www\./, ''); } catch (e) { return u; } };

var TASHKEEL = {}; for (var t = 0x064B; t <= 0x0652; t++) TASHKEEL[t] = 1;
TASHKEEL[0x0670] = TASHKEEL[0x0640] = TASHKEEL[0x200C] = TASHKEEL[0x200D] = 1;
var ALEF = { 0x0622: 1, 0x0623: 1, 0x0625: 1, 0x0627: 1, 0x0671: 1 };
var PERSIAN = { 0x06A9: '\u0643', 0x06CC: '\u064A', 0x06F0: '0', 0x06F1: '1', 0x06F2: '2', 0x06F3: '3', 0x06F4: '4', 0x06F5: '5', 0x06F6: '6', 0x06F7: '7', 0x06F8: '8', 0x06F9: '9' };
function norm(s, franco) {
  var out = '', map = [];
  for (var i = 0; i < s.length; i++) {
    var ch = s[i], c = s.charCodeAt(i), m;
    if (TASHKEEL[c]) m = '';
    else if (ALEF[c]) m = '\u0627';
    else if (PERSIAN[c]) m = PERSIAN[c];
    else if (c === 0x0629) m = '\u0647';
    else if (c === 0x0649 || c === 0x0626) m = '\u064A';
    else if (c === 0x0624) m = '\u0648';
    else if (c === 0x0621) m = '';
    else if (c >= 0x0660 && c <= 0x0669) m = String(c - 0x0660);
    else if (franco && /[0235-9]/.test(ch)) m = '';
    else if (ch === '-' || ch === '_' || ch === '/') m = ' ';
    else m = ch.toLowerCase();
    for (var j = 0; j < m.length; j++) { out += m[j]; map.push(i); }
  }
  return { text: out, map: map };
}
var LAYOUT = { 'q': 'ض', 'w': 'ص', 'e': 'ث', 'r': 'ق', 't': 'ف', 'y': 'غ', 'u': 'ع', 'i': 'ه', 'o': 'خ', 'p': 'ح', '[': 'ج', ']': 'د', 'a': 'ش', 's': 'س', 'd': 'ي', 'f': 'ب', 'g': 'ل', 'h': 'ا', 'j': 'ت', 'k': 'ن', 'l': 'م', ';': 'ك', "'": 'ط', 'z': 'ئ', 'x': 'ء', 'c': 'ؤ', 'v': 'ر', 'b': 'لا', 'n': 'ى', 'm': 'ة', ',': 'و', '.': 'ز', '/': 'ظ', '`': 'ذ' };
var LAYOUT_R = {}; Object.keys(LAYOUT).forEach(function (k) { if (LAYOUT[k].length === 1) LAYOUT_R[LAYOUT[k]] = k; });
F.swapLayout = function (q) {
  var lat = /[a-z;'\[\],.\/`]/i.test(q) && !/[\u0600-\u06FF]/.test(q), out = '';
  for (var i = 0; i < q.length; i++) { var ch = q[i].toLowerCase(); out += lat ? (LAYOUT[ch] || q[i]) : (LAYOUT_R[q[i]] || q[i]); }
  return out;
};

function fuzzy(q, s) {
  if (!q) return null;
  var sub = s.indexOf(q);
  if (sub !== -1) {
    var hits = []; for (var h = 0; h < q.length; h++) hits.push(sub + h);
    var sc = 100 + q.length * 6;
    if (sub === 0) sc += 60; else if (s[sub - 1] === ' ' || s[sub - 1] === '.') sc += 40;
    if (s === q) sc += 100;
    return { score: sc - Math.min(sub, 12), hits: hits, sub: true };
  }
  var qi = 0, hits2 = [], score = 0, last = -1;
  for (var ti = 0; ti < s.length && qi < q.length; ti++) {
    if (q[qi] === ' ') { qi++; ti--; continue; }
    if (q[qi] === s[ti]) {
      if (last !== -1) { var gap = ti - last - 1; score += gap ? -Math.min(gap * 2, 16) : 8; }
      if (ti === 0 || s[ti - 1] === ' ') score += 10;
      hits2.push(ti); last = ti; qi++;
    }
  }
  if (qi < q.length || !hits2.length) return null;
  score -= Math.min(hits2[0], 10);
  return score > -8 ? { score: 20 + score, hits: hits2, sub: false } : null;
}
F.buildIdx = function (d) {
  var f = [];
  function push(kind, lang, raw, w, vid) { if (raw) f.push({ kind: kind, lang: lang, raw: raw, w: w, vid: vid || null, a: norm(raw, false), b: norm(raw, true) }); }
  push('title', 'ar', d.ar, [1, .85]); push('title', 'en', d.en, [.85, 1]);
  push('desc', 'ar', d.dar, [.45, .4]); push('desc', 'en', d.den, [.4, .45]);
  d.aliases.forEach(function (a) { push('alias', null, a, [.8, .8]); });
  if (d.host) push('host', null, d.host, [.5, .5]);
  (d.variants || []).forEach(function (v) {
    push('variant', 'ar', v.ar, [.7, .7], v.id); push('variant', 'en', v.en, [.7, .7], v.id);
    (v.aliases || []).forEach(function (a) { push('valias', null, a, [.8, .8], v.id); });
    if (!/^v\d+$/.test(v.id) && v.id.replace(/-/g, ' ') !== v.en.toLowerCase()) push('vid', null, v.id, [.6, .6], v.id);
    push('host', null, String(v.host || '').split('.')[0], [.5, .5], v.id);
    push('desc', 'ar', v.dar, [.45, .4], v.id); push('desc', 'en', v.den, [.4, .45], v.id);
  });
  return f;
};
F.query = function (q) { return { a: norm(q, false).text.trim(), b: norm(q, true).text.trim() || norm(q, false).text.trim() }; };
var STRONG_V = { variant: 1, valias: 1, vid: 1 };
F.match = function (d, qq) {
  var best = null, tBest = null, vBest = null, li = store.lang === 'ar' ? 0 : 1;
  for (var i = 0; i < d.idx.length; i++) {
    var f = d.idx[i], x = fuzzy(qq.a, f.a.text), y = fuzzy(qq.b, f.b.text), pick = x, fr = false;
    if (y && (!x || y.score > x.score)) { pick = y; fr = true; }
    if (!pick) continue;
    var hit = { w: pick.score * f.w[li], raw: pick.score, sub: pick.sub, f: f, hits: pick.hits, fr: fr };
    if (!best || hit.w > best.w) best = hit;
    if (f.vid) { if (pick.sub && (!vBest || hit.raw > vBest.raw || (hit.raw === vBest.raw && hit.w > vBest.w))) vBest = hit; }
    else if (!tBest || hit.raw > tBest.raw) tBest = hit;
  }
  if (!best) return null;
  best.vhit = null;
  if (vBest && d.variants && d.variants.length > 1 && qq.a.length >= 2) {
    var t = tBest ? tBest.raw : -Infinity;
    if (STRONG_V[vBest.f.kind] ? vBest.raw >= t : vBest.raw > t) best.vhit = vBest;
  }
  return best;
};
F.ranges = function (hits, map) {
  var out = [], s = null, e = null;
  hits.forEach(function (n) { var o = map[n]; if (o == null) return; if (s === null) { s = o; e = o + 1; } else if (o === e) e = o + 1; else if (o > e) { out.push([s, e]); s = o; e = o + 1; } });
  if (s !== null) out.push([s, e]);
  return out;
};
F.frecency = function (id) {
  var v = store.visits[id]; if (!v) return 0;
  var days = (Date.now() - v.t) / 864e5;
  return v.n * (days < 1 ? 4 : days < 7 ? 2 : days < 30 ? 1 : .4);
};

F.ICON = {
  more: '<circle cx="5" cy="12" r="1.5" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="1.5" fill="currentColor" stroke="none"/><circle cx="19" cy="12" r="1.5" fill="currentColor" stroke="none"/>',
  pin: '<path d="M12 17v5"/><path d="M9 10.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24V16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V7a1 1 0 0 1 1-1 2 2 0 0 0 0-4H8a2 2 0 0 0 0 4 1 1 0 0 1 1 1z"/>',
  pinF: '<path fill="currentColor" stroke="none" d="M8 2h8a1.6 1.6 0 0 1 .3 3.17V10l2.9 2.9c.5.5.8 1.1.8 1.8V16a1 1 0 0 1-1 1h-6v5l-1 1-1-1v-5H5a1 1 0 0 1-1-1v-1.3c0-.7.3-1.3.8-1.8L7.7 10V5.17A1.6 1.6 0 0 1 8 2z"/>',
  copy: '<rect x="9" y="9" width="12" height="12" rx="2.5"/><path d="M5 15H4.5A1.5 1.5 0 0 1 3 13.5v-9A1.5 1.5 0 0 1 4.5 3h9A1.5 1.5 0 0 1 15 4.5V5"/>',
  share: '<path d="M12 3v12"/><path d="m7 8 5-5 5 5"/><path d="M5 13v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6"/>',
  ext: '<path d="M15 3h6v6"/><path d="M10 14 21 3"/><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>',
  go: '<path d="M5 12h14"/><path d="m13 6 6 6-6 6"/>',
  link: '<path d="M10 14a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1 1"/><path d="M14 10a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1-1"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
  moon: '<path d="M20 14.5A8 8 0 0 1 9.5 4 8 8 0 1 0 20 14.5z"/>',
  system: '<circle cx="12" cy="12" r="9"/><path d="M12 3a9 9 0 0 0 0 18z" fill="currentColor"/>',
  gear: '<path d="M4 7h10M18 7h2M4 17h4M12 17h8"/><circle cx="16" cy="7" r="2.2"/><circle cx="10" cy="17" r="2.2"/>',
  keys: '<rect x="2.5" y="6" width="19" height="12" rx="2.5"/><path d="M6.5 10h.01M10 10h.01M13.5 10h.01M17 10h.01M8 14h8"/>',
  up: '<path d="M12 15V3"/><path d="m7 8 5-5 5 5"/><path d="M4 15v4a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-4"/>',
  down: '<path d="M12 3v12"/><path d="m7 10 5 5 5-5"/><path d="M4 15v4a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-4"/>',
  reset: '<path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/>',
  sync: '<path d="M20 11a8 8 0 0 0-14.3-4.9L4 8"/><path d="M4 3v5h5"/><path d="M4 13a8 8 0 0 0 14.3 4.9L20 16"/><path d="M20 21v-5h-5"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  erase: '<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/>',
  layers: '<path d="m12 3 9 5-9 5-9-5z"/><path d="m3 13 9 5 9-5"/>',
  calc: '<rect x="5" y="3" width="14" height="18" rx="2.5"/><path d="M8.5 7.5h7M8.5 12h.01M12 12h.01M15.5 12h.01M8.5 16h.01M12 16h.01M15.5 16h.01"/>',
  printer: '<path d="M6 9V3h12v6"/><rect x="3" y="9" width="18" height="8" rx="2"/><path d="M7 14h10v7H7z"/>',
  flask: '<path d="M9 3h6M10 3v6l-5.4 9.4A2 2 0 0 0 6.3 21.5h11.4a2 2 0 0 0 1.7-3.1L14 9V3"/><path d="M7.5 15h9"/>',
  star: '<path d="m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z"/>',
  box: '<rect x="4" y="4" width="16" height="16" rx="3"/>',
  x: '<path d="M18 6 6 18M6 6l12 12"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.8-3.8"/>'
};
F.svg = function (name, cls) {
  return '<svg class="' + (cls || '') + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + (F.ICON[name] || '') + '</svg>';
};
})();
