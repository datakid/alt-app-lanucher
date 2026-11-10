(function () {
'use strict';
var F = window.F = {};
F.VERSION = '5.5';
F.NEWS_ID = '5.5';
var KEY = 'fihrist:v5', DKEY = 'fihrist:data:v5', LEGACY_KEYS = ['fihrist:v4', 'fihrist:v3', 'fihrist:v2'], LEGACY_DKEY = 'fihrist:data:v4';
var PIGMENTS = ['indigo', 'verdigris', 'madder', 'orpiment', 'lapis', 'malachite', 'tyrian', 'bone'];
var ICONS_OK = { layers: 1, calc: 1, flask: 1, printer: 1, star: 1, box: 1, pill: 1, chart: 1, doc: 1 };

var store = { v: 5, theme: 'system', lang: 'ar', tab: 'all', density: 'cozy', newTab: false, pins: [], visits: {}, lastVariant: {}, shelf: true, motion: 'auto', seenWhatsNew: '' };
var THEMES = ['system', 'light', 'dark'], LANGS = ['ar', 'en'], DENSITIES = ['cozy', 'compact'], MOTIONS = ['auto', 'reduced'];
function isObj(o) { return !!o && typeof o === 'object' && !Array.isArray(o); }
function finite(n) { return typeof n === 'number' && isFinite(n); }
function cleanPins(list) {
  var seen = Object.create(null), out = [];
  list.forEach(function (id) { if (typeof id === 'string' && id && !seen[id]) { seen[id] = 1; out.push(id); } });
  return out;
}
function cleanVisits(src) {
  var out = {};
  Object.keys(src).forEach(function (id) {
    var x = src[id];
    if (id === '__proto__' || !isObj(x) || !finite(x.n) || !finite(x.t)) return;
    var o = { n: x.n, t: x.t };
    if (isObj(x.d)) {
      o.d = {};
      Object.keys(x.d).forEach(function (k) { if (k !== '__proto__' && finite(x.d[k])) o.d[k] = x.d[k]; });
    }
    out[id] = o;
  });
  return out;
}
function cleanVariants(src) {
  var out = {};
  Object.keys(src).forEach(function (id) { if (id !== '__proto__' && typeof src[id] === 'string') out[id] = src[id]; });
  return out;
}
function sanitize(src) {
  var out = {};
  if (!isObj(src)) return out;
  if (LANGS.indexOf(src.lang) !== -1) out.lang = src.lang;
  if (THEMES.indexOf(src.theme) !== -1) out.theme = src.theme;
  if (DENSITIES.indexOf(src.density) !== -1) out.density = src.density;
  if (MOTIONS.indexOf(src.motion) !== -1) out.motion = src.motion;
  if (typeof src.tab === 'string') out.tab = src.tab;
  if (typeof src.newTab === 'boolean') out.newTab = src.newTab;
  if (typeof src.shelf === 'boolean') out.shelf = src.shelf;
  if (typeof src.seenWhatsNew === 'string') out.seenWhatsNew = src.seenWhatsNew;
  if (Array.isArray(src.pins)) out.pins = cleanPins(src.pins);
  if (isObj(src.visits)) out.visits = cleanVisits(src.visits);
  if (isObj(src.lastVariant)) out.lastVariant = cleanVariants(src.lastVariant);
  return out;
}
F.sanitizePrefs = sanitize;
function hydrate(src, external) {
  F.cacheStamp++;
  var clean = sanitize(src);
  Object.keys(clean).forEach(function (k) { if (!(external && k === 'tab')) store[k] = clean[k]; });
}
function readJSON(key) { try { return JSON.parse(localStorage.getItem(key) || 'null'); } catch (e) { return null; } }
F.fresh = false;
try {
  var cur = readJSON(KEY), legacy = null, li;
  if (!cur) for (li = 0; li < LEGACY_KEYS.length && !legacy; li++) legacy = readJSON(LEGACY_KEYS[li]);
  hydrate(cur || legacy);
  if (!cur && legacy && Array.isArray(legacy.recents)) legacy.recents.forEach(function (id, i) { if (typeof id !== 'string' || id === '__proto__') return; store.visits[id] = { n: 3 - Math.min(i, 2), t: Date.now() - i * 864e5 }; });
  if (!cur && !legacy) { F.fresh = true; store.seenWhatsNew = F.NEWS_ID; }
  if (!cur) localStorage.setItem(KEY, JSON.stringify(store));
} catch (e) {}
var persistT = null, idleH = null, dirty = false;
function writeStore() { dirty = false; try { localStorage.setItem(KEY, JSON.stringify(store)); } catch (e) {} }
F.store = store;
F.flush = function () {
  clearTimeout(persistT); persistT = null;
  if (idleH != null && window.cancelIdleCallback) window.cancelIdleCallback(idleH);
  idleH = null;
  if (dirty) writeStore();
};
F.persist = function () {
  F.cacheStamp++;
  dirty = true; clearTimeout(persistT);
  persistT = setTimeout(function () {
    persistT = null;
    if (window.requestIdleCallback) idleH = window.requestIdleCallback(function () { idleH = null; if (dirty) writeStore(); }, { timeout: 800 });
    else if (dirty) writeStore();
  }, 60);
};
F.onExternal = null;
addEventListener('storage', function (e) {
  if (e.key !== KEY || !e.newValue) return;
  try { hydrate(JSON.parse(e.newValue), true); if (F.onExternal) F.onExternal(); } catch (x) {}
});
addEventListener('pagehide', F.flush);
document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'hidden') F.flush(); });

function str(x) { return typeof x === 'string' ? x.trim() : ''; }
function isUrl(u) { return /^https?:\/\/[^\s]+$/i.test(u); }
function cleanLexicon(src) {
  if (!src || typeof src !== 'object' || Array.isArray(src)) return null;
  var out = {}, n = 0;
  Object.keys(src).forEach(function (k) {
    if (n >= 200 || k === '__proto__' || !str(k) || !Array.isArray(src[k])) return;
    var list = src[k].filter(function (x) { return typeof x === 'string' && x.trim(); }).map(function (x) { return x.trim(); }).slice(0, 10);
    if (!list.length) return;
    out[str(k)] = list;
    n++;
  });
  return n ? out : null;
}
var ID_RE = /^[a-z0-9][a-z0-9-]*$/, RESERVED_GROUPS = ['all', 'pinned', 'recent', 'elsewhere', 'partial', 'cmd'];
F.validate = function (doc) {
  if (!doc || typeof doc !== 'object') throw new Error('Not an object');
  if (!Array.isArray(doc.tools) || !doc.tools.length) throw new Error('"tools" must be a non-empty array');
  var groups = Array.isArray(doc.groups) && doc.groups.length ? doc.groups : null;
  if (!groups) throw new Error('"groups" must be a non-empty array');
  if (doc.format != null && doc.format !== 'fihrist/4' && doc.format !== 'fihrist/5') throw new Error('Unsupported format "' + doc.format + '"');
  var gids = Object.create(null), kbds = Object.create(null), out = { format: 'fihrist/5', revision: Number(doc.revision) || 0, updated: str(doc.updated), groups: [], tools: [] };
  groups.forEach(function (g, i) {
    var id = str(g && g.id); if (!id || gids[id]) throw new Error('Group #' + (i + 1) + ' has a missing or duplicate id');
    if (RESERVED_GROUPS.indexOf(id) !== -1) throw new Error('Group #' + (i + 1) + ' uses a reserved id "' + id + '"');
    if (!ID_RE.test(id)) throw new Error('Group #' + (i + 1) + ' has an invalid id "' + id + '" (use a-z, 0-9 and -)');
    gids[id] = 1;
    out.groups.push({ id: id, ar: str(g.ar), en: str(g.en), icon: ICONS_OK[g.icon] ? g.icon : '' });
  });
  var lex = cleanLexicon(doc.lexicon);
  if (lex) out.lexicon = lex;
  var tids = Object.create(null);
  doc.tools.forEach(function (t, i) {
    var where = 'Tool #' + (i + 1) + (t && t.id ? ' (' + t.id + ')' : '');
    var id = str(t && t.id), gid = str(t && t.group);
    if (!id || tids[id]) throw new Error(where + ': missing or duplicate id');
    if (!ID_RE.test(id) || id in Object.prototype) throw new Error(where + ': invalid id (use a-z, 0-9 and -)');
    if (!gids[gid]) throw new Error(where + ': unknown group "' + gid + '"');
    if (!str(t.ar) && !str(t.en)) throw new Error(where + ': needs "ar" or "en"');
    tids[id] = 1;
    var o = { id: id, group: gid, pigment: PIGMENTS.indexOf(t.pigment) !== -1 ? t.pigment : 'indigo',
      ar: str(t.ar), en: str(t.en), dar: str(t.dar), den: str(t.den),
      aliases: Array.isArray(t.aliases) ? t.aliases.filter(function (a) { return typeof a === 'string' && a.trim(); }) : [],
      tags: Array.isArray(t.tags) ? t.tags.filter(function (a) { return typeof a === 'string' && a.trim(); }) : [],
      closed: !!t.closed, since: /^\d{4}-\d{2}-\d{2}$/.test(t.since || '') ? t.since : '' };
    var kb = str(t.kbd).toLowerCase();
    if (/^[a-z0-9]$/.test(kb) && !kbds[kb]) { kbds[kb] = 1; o.kbd = kb; }
    if (Array.isArray(t.variants) && t.variants.length) {
      var vids = Object.create(null);
      o.variants = t.variants.map(function (v, j) {
        if (!v || typeof v !== 'object') throw new Error(where + ': variant #' + (j + 1) + ' is not an object');
        var vid = str(v.id) || 'v' + j;
        if (vids[vid]) throw new Error(where + ': duplicate variant id "' + vid + '"');
        if (!isUrl(str(v.url))) throw new Error(where + ': variant "' + vid + '" has an invalid url');
        vids[vid] = 1;
        return { id: vid, ar: str(v.ar), en: str(v.en), url: str(v.url), dar: str(v.dar), den: str(v.den),
          aliases: Array.isArray(v.aliases) ? v.aliases.filter(function (a) { return typeof a === 'string' && a.trim(); }) : [], closed: !!v.closed };
      });
      var di = Math.floor(Number(t.def));
      o.def = di >= 0 && di < o.variants.length ? di : 0;
    } else {
      if (!isUrl(str(t.url))) throw new Error(where + ': needs a valid "url" or "variants"');
      o.url = str(t.url);
    }
    out.tools.push(o);
  });
  return out;
};

F.SCHEMA_REF = './fihrist.schema.json';
function lexText(lex) {
  if (!lex || !Object.keys(lex).length) return '';
  return ',\n  "lexicon": {\n' + Object.keys(lex).map(function (k) { return '    ' + JSON.stringify(k) + ': [' + lex[k].map(function (x) { return JSON.stringify(x); }).join(', ') + ']'; }).join(',\n') + '\n  }';
}
F.serialize = function (doc) {
  function has(v) { return v !== '' && v != null && v !== false && !(Array.isArray(v) && !v.length); }
  function pick(o, keys) { var r = {}; keys.forEach(function (k) { if (has(o[k])) r[k] = o[k]; }); return r; }
  function val(v) { return Array.isArray(v) ? '[' + v.map(function (x) { return JSON.stringify(x); }).join(', ') + ']' : JSON.stringify(v); }
  function line(o) { return '{ ' + Object.keys(o).map(function (k) { return JSON.stringify(k) + ': ' + val(o[k]); }).join(', ') + ' }'; }
  var groups = doc.groups.map(function (g) { return '    ' + line(pick(g, ['id', 'ar', 'en', 'icon'])); });
  var tools = doc.tools.map(function (t) {
    var o = pick(t, ['id', 'group', 'pigment', 'closed', 'url', 'since', 'kbd', 'ar', 'en', 'dar', 'den', 'aliases', 'tags']);
    if (!t.variants) return '    ' + line(o);
    o.def = t.def || 0;
    var vs = t.variants.map(function (v) { return '        ' + line(pick(v, ['id', 'ar', 'en', 'dar', 'den', 'aliases', 'closed', 'url'])); });
    return '    ' + line(o).slice(0, -2) + ',\n      "variants": [\n' + vs.join(',\n') + '\n      ] }';
  });
  return '{\n' +
    '  "$schema": ' + JSON.stringify(F.SCHEMA_REF) + ',\n' +
    '  "format": "fihrist/5",\n' +
    '  "revision": ' + (doc.revision | 0) + ',\n' +
    '  "updated": ' + JSON.stringify(doc.updated) + ',\n' +
    '  "groups": [\n' + groups.join(',\n') + '\n  ],\n' +
    '  "tools": [\n' + tools.join(',\n') + '\n  ]' + lexText(doc.lexicon) + '\n}\n';
};

F.loadInitial = function () {
  var seed = F.validate(window.FIHRIST_SEED), pick = { doc: seed, src: 'seed' };
  try {
    var raw = localStorage.getItem(DKEY);
    if (raw == null) { raw = localStorage.getItem(LEGACY_DKEY); if (raw != null) localStorage.setItem(DKEY, raw); }
    var c = JSON.parse(raw || 'null');
    if (c && c.doc && (c.forced || c.doc.revision > seed.revision)) pick = { doc: F.validate(c.doc), src: c.src || 'cache' };
  } catch (e) {}
  F.seed = seed;
  return pick;
};
F.saveDoc = function (doc, src, forced) {
  try { localStorage.setItem(DKEY, JSON.stringify({ doc: doc, src: src, forced: !!forced, at: Date.now() })); return true; } catch (e) { return false; }
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

var HOST_FAST = /^https?:\/\/([a-z0-9][a-z0-9.-]*)(?:[\/?#]|$)/i;
F.hostOf = function (u) {
  if (typeof URL === 'undefined') return u;
  var m = HOST_FAST.exec(u);
  if (m) return m[1].toLowerCase().replace(/^www\./, '');
  try { return new URL(u).host.replace(/^www\./, ''); } catch (e) { return u; }
};

var TASHKEEL = {}; for (var t = 0x064B; t <= 0x0652; t++) TASHKEEL[t] = 1;
TASHKEEL[0x0670] = TASHKEEL[0x0640] = TASHKEEL[0x200C] = TASHKEEL[0x200D] = 1;
var ALEF = { 0x0622: 1, 0x0623: 1, 0x0625: 1, 0x0627: 1, 0x0671: 1 };
var PERSIAN = { 0x06A9: '\u0643', 0x06CC: '\u064A', 0x06F0: '0', 0x06F1: '1', 0x06F2: '2', 0x06F3: '3', 0x06F4: '4', 0x06F5: '5', 0x06F6: '6', 0x06F7: '7', 0x06F8: '8', 0x06F9: '9' };
var ASCII_ONLY = /^[\x00-\x7f]*$/, FRANCO_DIGIT = /[0235-9]/, ASCII_SEP = /[-_\/]/g, FRANCO_STRIP = /[0235-9]/g;
function normChar(ch, c, franco) {
  if (TASHKEEL[c]) return '';
  if (ALEF[c]) return '\u0627';
  if (PERSIAN[c]) return PERSIAN[c];
  if (c === 0x0629) return '\u0647';
  if (c === 0x0649 || c === 0x0626) return '\u064A';
  if (c === 0x0624) return '\u0648';
  if (c === 0x0621) return '';
  if (c >= 0x0660 && c <= 0x0669) return String(c - 0x0660);
  if (franco && FRANCO_DIGIT.test(ch)) return '';
  if (ch === '-' || ch === '_' || ch === '/') return ' ';
  return ch.toLowerCase();
}
function norm(s, franco) {
  var out = '', map = [];
  for (var i = 0; i < s.length; i++) {
    var m = normChar(s[i], s.charCodeAt(i), franco);
    for (var j = 0; j < m.length; j++) { out += m[j]; map.push(i); }
  }
  return { text: out, map: map };
}
var NORM_TAB = null;
function normTab() {
  var t = new Array(0x700), c;
  for (c = 0; c < 0x80; c++) t[c] = normChar(String.fromCharCode(c), c, false);
  for (c = 0x600; c < 0x700; c++) t[c] = normChar(String.fromCharCode(c), c, false);
  NORM_TAB = t;
  return t;
}
function normText(s, franco) {
  if (ASCII_ONLY.test(s)) {
    var t = s.toLowerCase().replace(ASCII_SEP, ' ');
    return franco ? t.replace(FRANCO_STRIP, '') : t;
  }
  var tab = NORM_TAB || normTab(), out = '', i, c;
  for (i = 0; i < s.length; i++) {
    c = s.charCodeAt(i);
    out += !franco && (c < 0x80 || (c >= 0x600 && c < 0x700)) ? tab[c] : normChar(s[i], c, franco);
  }
  return out;
}
var LAYOUT = { 'q': 'ض', 'w': 'ص', 'e': 'ث', 'r': 'ق', 't': 'ف', 'y': 'غ', 'u': 'ع', 'i': 'ه', 'o': 'خ', 'p': 'ح', '[': 'ج', ']': 'د', 'a': 'ش', 's': 'س', 'd': 'ي', 'f': 'ب', 'g': 'ل', 'h': 'ا', 'j': 'ت', 'k': 'ن', 'l': 'م', ';': 'ك', "'": 'ط', 'z': 'ئ', 'x': 'ء', 'c': 'ؤ', 'v': 'ر', 'b': 'لا', 'n': 'ى', 'm': 'ة', ',': 'و', '.': 'ز', '/': 'ظ', '`': 'ذ' };
var LAYOUT_R = {}; Object.keys(LAYOUT).forEach(function (k) { if (LAYOUT[k].length === 1) LAYOUT_R[LAYOUT[k]] = k; });
F.swapLayout = function (q) {
  var lat = /[a-z;'\[\],.\/`]/i.test(q) && !/[\u0600-\u06FF]/.test(q), out = '';
  for (var i = 0; i < q.length; i++) { var ch = q[i].toLowerCase(); out += lat ? (LAYOUT[ch] || q[i]) : (LAYOUT_R[q[i]] || q[i]); }
  return out;
};

var QSPLIT = /[\s\-_\/.:,>\u203a|\u060c]+/;
var ARPRE = ['\u0628\u0627\u0644', '\u0648\u0627\u0644', '\u0641\u0627\u0644', '\u0643\u0627\u0644', '\u0627\u0644', '\u0644\u0644'];
var STOPS = ['el', 'al', '\u0627\u0644', 'the', 'of', '\u0648'];
var HID = { alias: 1, valias: 1, vsyn: 1, vid: 1, group: 1 };
var EQK = { title: 1, alias: 1, valias: 1, variant: 1 };
var VSYN = {
  alt: ['alternative', 'alternate', 'backup', 'badil', 'badeel', 'bdeel', '\u0628\u062F\u064A\u0644', '\u0627\u062D\u062A\u064A\u0627\u0637\u064A'],
  main: ['primary', 'default', 'original', 'raeesy', 'raisy', 'asasy', '\u0627\u0644\u0631\u0626\u064A\u0633\u064A', '\u0627\u0633\u0627\u0633\u064A', '\u0627\u0635\u0644\u064A'],
  full: ['complete', 'kamel', '\u0643\u0627\u0645\u0644'],
  express: ['quick', 'fast', 'sare3', '\u0633\u0631\u064A\u0639'],
  free: ['magany', 'majani', '\u0645\u062C\u0627\u0646\u064A']
};
var SEPT = new Uint8Array(0x2100);
[32, 44, 46, 58, 62, 124, 0x203A, 0x060C].forEach(function (c) { SEPT[c] = 1; });
var SEP_OTHER = /[,.:>|\u203A\u060C]/;
function sep(c) { return c < 0x2100 && SEPT[c] === 1; }
var IDXPICK = { s: 60, bs: 60, c: 60, f: null };
var MAXT = 8, stamp = 0, ws0 = 0, wl0 = 0, hF = 0, hS = 0, hE = 0, R0 = [], R1 = [], R2 = [];
var IX = { tools: null, nF: 0, nO: 0, fields: [], da: [], db: [], ja: [], jb: [] };
var FS, FC, FM, FA, FB, OSt, OS, OBS, OI, TS;

function popc(x) { var n = 0; while (x) { x &= x - 1; n++; } return n; }
function maskOf(s) { var m = 0; for (var i = 0; i < s.length; i++) m |= 1 << (s.charCodeAt(i) & 31); return m; }
function artLen(w) {
  var c = w.charCodeAt(0), i, p;
  if (w.length < 4 || c < 0x0600 || c > 0x06FF) return 0;
  for (i = 0; i < ARPRE.length; i++) { p = ARPRE[i]; if (w.indexOf(p) === 0 && w.length - p.length >= 2) return p.length; }
  return 0;
}
function wordsOf(text) {
  var out = [], n = text.length, i = 0, s, t, p;
  while (i < n) {
    while (i < n && sep(text.charCodeAt(i))) i++;
    if (i >= n) break;
    s = i;
    while (i < n && !sep(text.charCodeAt(i))) i++;
    t = text.slice(s, i);
    out.push({ t: t, s: s, x: 0 });
    p = artLen(t);
    if (p) out.push({ t: t.slice(p), s: s + p, x: 1 });
  }
  return out;
}
function formOf(text, raw, fr, mask) {
  var ws = wordsOf(text), sq = [], i, w;
  for (i = 0; i < ws.length; i++) {
    w = ws[i]; if (w.x) continue;
    sq.push(w.t);
  }
  return { text: text, raw: raw, fr: fr, map: null, words: ws, mask: mask === undefined ? maskOf(text) : mask, sq: sq.join(' '), multi: sq.length > 1, sqw: sq, jt: null, jm: null };
}
function joined(form) {
  if (form.jt !== null) return form;
  var jt = '', jm = [], ws = form.words, i, j, w;
  for (i = 0; i < ws.length; i++) {
    w = ws[i]; if (w.x) continue;
    for (j = 0; j < w.t.length; j++) { jt += w.t[j]; jm.push(w.s + j); }
  }
  form.jt = jt; form.jm = jm;
  return form;
}
function fmask(f) { return f.mask === null ? (f.mask = maskOf(f.text)) : f.mask; }
function frd(f) { return f.frD === null ? (f.frD = FRANCO_DIGIT.test(f.raw)) : f.frD; }
function fa(f) { return f.a || (f.a = formOf(f.text, f.raw, false, fmask(f))); }
function fb(f) { return frd(f) ? (f.b || (f.b = formOf(normText(f.raw, true), f.raw, true))) : fa(f); }
function mapOf(form) { return form.map || (form.map = norm(form.raw, form.fr).map); }
function mergeRanges(rg) {
  var out = [], i, l;
  rg = rg.slice().sort(function (x, y) { return x[0] - y[0]; });
  for (i = 0; i < rg.length; i++) {
    l = out[out.length - 1];
    if (l && rg[i][0] <= l[1]) { if (rg[i][1] > l[1]) l[1] = rg[i][1]; } else out.push([rg[i][0], rg[i][1]]);
  }
  return out;
}
F.mergeRanges = mergeRanges;
function vById(d, id) {
  if (!d.variants || id == null) return null;
  for (var i = 0; i < d.variants.length; i++) if (d.variants[i].id === id) return d.variants[i];
  return null;
}

var W_TA = [1, .88], W_TE = [.88, 1], W_DA = [.45, .4], W_DE = [.4, .45], W_AL = [.9, .9], W_TG = [.7, .7], W_GR = [.55, .55], W_HO = [.5, .5], W_VA = [.95, .84], W_VE = [.84, .95], W_VL = [.92, .92], W_VI = [.85, .85], W_VS = [.8, .8];
F.buildIdx = function (d, g) {
  var f = [];
  function push(kind, lang, raw, w, vid) {
    if (!raw) return;
    var text = normText(raw, false);
    f.push({ kind: kind, lang: lang, raw: raw, w: w, bw: w[0] > w[1] ? w[0] : w[1], vid: vid || null, text: text, mask: null, frD: null, a: null, b: null, id: 0, ti: 0, ow: 0 });
  }
  push('title', 'ar', d.ar, W_TA); push('title', 'en', d.en, W_TE);
  push('desc', 'ar', d.dar, W_DA); push('desc', 'en', d.den, W_DE);
  d.aliases.forEach(function (a) { push('alias', null, a, W_AL); });
  (d.tags || []).forEach(function (a) { push('tag', null, a, W_TG); });
  if (g) { push('group', 'ar', g.ar, W_GR); push('group', 'en', g.en, W_GR); }
  if (d.host) push('host', null, d.host, W_HO);
  (d.variants || []).forEach(function (v) {
    push('variant', 'ar', v.ar, W_VA, v.id); push('variant', 'en', v.en, W_VE, v.id);
    (v.aliases || []).forEach(function (a) { push('valias', null, a, W_VL, v.id); });
    if (!/^v\d+$/.test(v.id) && v.id.replace(/-/g, ' ') !== v.en.toLowerCase()) push('vid', null, v.id, W_VI, v.id);
    if (v.en.toLowerCase() === v.id && VSYN.hasOwnProperty(v.id)) VSYN[v.id].forEach(function (s) { push('vsyn', null, s, W_VS, v.id); });
    push('host', null, String(v.host || '').split('.')[0], W_HO, v.id);
    push('desc', 'ar', v.dar, W_DA, v.id); push('desc', 'en', v.den, W_DE, v.id);
  });
  return f;
};
F.prepare = function (tools, groups) {
  var gm = Object.create(null);
  GRP.set(tools, groups || []);
  (groups || []).forEach(function (g) { gm[g.id] = g; });
  PREP.set(tools, gm);
  tools.forEach(function (d) {
    (d.variants || []).forEach(function (v) { v.host = F.hostOf(v.url); });
    if (d.url) d.host = F.hostOf(d.url);
    d.gmeta = gm[d.group] || null;
  });
};
var BSTATE = new WeakMap();
function advance(tools, until) {
  var b = BSTATE.get(tools), gm = PREP.get(tools) || Object.create(null), d;
  if (!b) { b = { stage: 0, i: 0, ix: null, st: null, ms: 0 }; BSTATE.set(tools, b); }
  var t0 = F.perf ? performance.now() : 0;
  if (b.stage === 0) {
    while (b.i < tools.length) {
      d = tools[b.i++];
      d.idx = F.buildIdx(d, gm[d.group]);
      d.tf = []; d.vf = Object.create(null);
      d.idx.forEach(function (f) { if (f.vid) (d.vf[f.vid] = d.vf[f.vid] || []).push(f); else d.tf.push(f); });
      if (until && (b.i & 7) === 0 && until()) { if (F.perf) b.ms += performance.now() - t0; return false; }
    }
    b.stage = 1;
  }
  if (b.stage === 1) { b.ix = startIndex(tools); b.st = newSide(); b.stage = 2; }
  if (b.stage === 2) {
    if (!scanSide(b.ix, b.st, 0, until)) { if (F.perf) b.ms += performance.now() - t0; return false; }
    b.stage = 3;
  }
  if (b.stage === 3) {
    finishSide(b.ix, 0, b.st);
    allocIndex(b.ix);
    IXMAP.set(tools, b.ix);
    b.stage = 4;
    if (F.perf) { b.ms += performance.now() - t0; (F.perfLog = F.perfLog || []).push(['index', tools.length, b.ms]); }
  }
  return true;
}
function ensureTools(tools) {
  if (IXMAP.get(tools)) return;
  advance(tools, null);
}
F.warmIndex = function (tools, done) {
  var sched = window.requestIdleCallback ? function (fn) { window.requestIdleCallback(fn, { timeout: 1200 }); } : function (fn) { setTimeout(fn, 30); };
  function step(deadline) {
    if (IXMAP.get(tools)) { if (done) done(); return; }
    var t0 = typeof performance !== 'undefined' ? performance.now() : 0;
    var finished = advance(tools, function () { return deadline && deadline.timeRemaining ? deadline.timeRemaining() < 2 : (typeof performance !== 'undefined' && performance.now() - t0 > 8); });
    if (finished) { if (done) done(); } else sched(step);
  }
  sched(step);
};
F.ensureIndex = function (tools) { ensureTools(tools); };

var IXMAP = new WeakMap(), GRP = new WeakMap(), PREP = new WeakMap(), MARK_CAP = 60;
function bucketize(list) {
  var byLen = [], byChar = Object.create(null), i, e, n, c;
  for (i = 0; i < list.length; i++) {
    e = list[i]; e.o = i; n = e.t.length; c = e.t.charCodeAt(0);
    (byLen[n] || (byLen[n] = [])).push(e);
    (byChar[c] || (byChar[c] = [])).push(e);
  }
  return { len: byLen, chr: byChar };
}
function allocIndex(ix) {
  var nF = ix.nF, nO = ix.nO;
  ix.FS = new Int32Array(MAXT * nF); ix.FC = new Float64Array(MAXT * nF); ix.FM = new Uint8Array(MAXT * nF);
  ix.FA = new Int32Array(MAXT * nF); ix.FB = new Int32Array(MAXT * nF);
  ix.OSt = new Int32Array(MAXT * nO); ix.OS = new Float64Array(MAXT * nO); ix.OBS = new Float64Array(MAXT * nO); ix.OI = new Int32Array(MAXT * nO);
  ix.TS = new Int32Array(ix.tools.length);
}
function useIndex(ix) {
  IX = ix; FS = ix.FS; FC = ix.FC; FM = ix.FM; FA = ix.FA; FB = ix.FB; OSt = ix.OSt; OS = ix.OS; OBS = ix.OBS; OI = ix.OI; TS = ix.TS;
}
function newSide() { return { i: 0, map: new Map(), list: [], jl: [] }; }
function scanSide(ix, st, m, until) {
  var map = st.map, list = st.list, jl = st.jl, fields = ix.fields, nf = fields.length, i = st.i, f, text, n, k, s, t, p, multi, fid;
  function add(w, at) {
    var e = map.get(w);
    if (e === undefined) { e = { t: w, mask: maskOf(w), post: [], o: 0 }; map.set(w, e); list.push(e); }
    e.post.push(fid, at);
  }
  while (i < nf) {
    f = fields[i++]; fid = f.id;
    text = m && frd(f) ? normText(f.raw, true) : f.text;
    n = text.length; k = 0; multi = 0;
    if (!SEP_OTHER.test(text)) {
      while (k < n) {
        s = text.indexOf(' ', k);
        if (s < 0) s = n;
        if (s > k) {
          t = text.slice(k, s);
          add(t, k);
          multi++;
          p = artLen(t);
          if (p) add(t.slice(p), k + p);
        }
        k = s + 1;
      }
    } else {
      while (k < n) {
        while (k < n && sep(text.charCodeAt(k))) k++;
        if (k >= n) break;
        s = k;
        while (k < n && !sep(text.charCodeAt(k))) k++;
        t = text.slice(s, k);
        add(t, s);
        multi++;
        p = artLen(t);
        if (p) add(t.slice(p), s + p);
      }
    }
    if (multi > 1) jl.push(f);
    if (until !== null && (i & 31) === 0 && until()) { st.i = i; return false; }
  }
  st.i = i;
  return true;
}
function finishSide(ix, m, st) {
  var bk = bucketize(st.list);
  if (m) { ix.db = st.list; ix.jb = st.jl; ix.dbK = bk; ix.bReady = true; } else { ix.da = st.list; ix.ja = st.jl; ix.daK = bk; }
}
function addSide(ix, m) {
  var st = newSide();
  scanSide(ix, st, m, null);
  finishSide(ix, m, st);
}
function startIndex(tools) {
  var fields = [], nO = 0, ix = { tools: tools, fields: fields, da: [], db: [], ja: [], jb: [], nF: 0, nO: 0, bReady: false, cache: Object.create(null), cacheKeys: [] };
  tools.forEach(function (d, ti) {
    var vo = Object.create(null);
    d.ti = ti; d.ow = nO++; d.vow = [];
    (d.variants || []).forEach(function (v) { vo[v.id] = nO; d.vow.push(nO); nO++; });
    d.idx.forEach(function (f) { f.id = fields.length; f.ti = ti; fields.push(f); f.ow = f.vid ? vo[f.vid] : d.ow; });
  });
  ix.nF = fields.length; ix.nO = nO;
  return ix;
}
function ensureB() { if (!IX.bReady) addSide(IX, 1); }
var CW = [], CS = [], CA = [], CB = [];
function scanWords(e, open, side) {
  var n = 0, tl = e.t.length, lst, bk, len, j, w, x, mc, sc;
  if (tl === 1) {
    lst = (side.chr[e.t.charCodeAt(0)]) || [];
    for (j = 0; j < lst.length; j++) {
      w = lst[j]; x = e.mask & ~w.mask; mc = x ? popc(x) : 0;
      if (mc > e.ed) continue;
      sc = wordScore(e.t, w.t, open, e.ed, mc);
      if (sc) { CW[n] = w; CS[n] = sc; CA[n] = ws0; CB[n] = wl0; n++; }
    }
    return n;
  }
  bk = side.len;
  for (len = tl - e.ed > 1 ? tl - e.ed : 1; len < bk.length; len++) {
    lst = bk[len]; if (!lst) continue;
    for (j = 0; j < lst.length; j++) {
      w = lst[j]; x = e.mask & ~w.mask; mc = x ? popc(x) : 0;
      if (mc > e.ed) continue;
      sc = wordScore(e.t, w.t, open, e.ed, mc);
      if (sc) { CW[n] = w; CS[n] = sc; CA[n] = ws0; CB[n] = wl0; n++; }
    }
  }
  return n;
}
function collect(q, li) {
  var fl = IX.fields, T = q.t, nt = T.length, nF = IX.nF, nO = IX.nO, found = [], k, i, j, p, e, l, w, tok, sc, f, g, o, idx, form, pos, post, touched, c, s, tl, n, ord, a0, b0;
  stamp++;
  for (k = 0; k < nt; k++) {
    tok = T[k]; touched = [];
    for (i = 0; i < tok.e.length; i++) {
      e = tok.e[i]; tl = e.t.length;
      if (e.m) ensureB();
      n = scanWords(e, tok.open, e.m ? IX.dbK : IX.daK);
      ord = [];
      for (j = 0; j < n; j++) ord.push(j);
      ord.sort(function (x, y) { return CW[x].o - CW[y].o; });
      for (j = 0; j < n; j++) {
        g = ord[j]; w = CW[g]; sc = CS[g]; a0 = CA[g]; b0 = CB[g];
        post = w.post;
        for (p = 0; p < post.length; p += 2) {
          f = fl[post[p]]; idx = k * nF + f.id;
          if (FS[idx] !== stamp) { FS[idx] = stamp; FC[idx] = 0; touched.push(f); }
          if (sc > FC[idx]) { FC[idx] = sc; FM[idx] = e.m; FA[idx] = post[p + 1] + a0; FB[idx] = FA[idx] + b0; }
        }
      }
      if (tl >= 3) {
        l = e.m ? IX.jb : IX.ja;
        for (j = 0; j < l.length; j++) {
          f = l[j];
          if (e.mask & ~(e.m && frd(f) ? fb(f).mask : fmask(f))) continue;
          idx = k * nF + f.id;
          if (FS[idx] === stamp && FC[idx] >= 40) continue;
          form = joined(e.m ? fb(f) : fa(f));
          pos = form.jt.indexOf(e.t);
          if (pos === -1) continue;
          if (FS[idx] !== stamp) { FS[idx] = stamp; FC[idx] = 0; touched.push(f); }
          FC[idx] = 40; FM[idx] = e.m; FA[idx] = form.jm[pos]; FB[idx] = form.jm[pos + tl - 1] + 1;
        }
      }
    }
    for (i = 0; i < touched.length; i++) {
      f = touched[i]; idx = k * nF + f.id; c = FC[idx]; s = c * f.w[li]; o = k * nO + f.ow;
      if (OSt[o] !== stamp || s > OS[o]) { OSt[o] = stamp; OS[o] = s; OBS[o] = c * f.bw; OI[o] = idx; }
      if (TS[f.ti] !== stamp) { TS[f.ti] = stamp; found.push(f.ti); }
    }
  }
  return found;
}
function rec(k, o) {
  var j = k * IX.nO + o, i;
  if (OSt[j] !== stamp) return null;
  i = OI[j];
  return { s: OS[j], bs: OBS[j], c: FC[i], f: IX.fields[i - k * IX.nF], m: FM[i], a: FA[i], b: FB[i] };
}

function ent(s, m) { return { t: s, m: m, mask: maskOf(s), ed: s.length >= 7 ? 2 : s.length >= 4 ? 1 : 0 }; }
function addEnts(tok, s, m) { var p = artLen(s); tok.e.push(ent(s, m)); if (p) tok.e.push(ent(s.slice(p), m)); }
function parseQuery(q) {
  var pieces = q.split(QSPLIT), keep = [], seen = {}, out = [], last = pieces.length - 1, stop = 0, i, p, a, tok;
  for (i = 0; i < pieces.length; i++) {
    p = pieces[i]; if (!p) continue;
    a = norm(p, false).text; if (!a) continue;
    keep.push({ raw: p, a: a, b: norm(p, true).text, i: i });
    if (STOPS.indexOf(a) === -1) stop++;
  }
  for (i = 0; i < keep.length; i++) {
    a = keep[i].a;
    if (stop && STOPS.indexOf(a) !== -1) continue;
    if (seen[' ' + a]) continue;
    seen[' ' + a] = 1;
    tok = { raw: keep[i].raw, a: a, b: keep[i].b || a, num: /^\d+$/.test(a), open: keep[i].i === last, e: [] };
    addEnts(tok, a, 0);
    if (!tok.num && keep[i].b && keep[i].b !== a) { addEnts(tok, keep[i].b, 1); }
    else tok.b = a;
    out.push(tok);
    if (out.length >= MAXT) break;
  }
  return { t: out, s: out.map(function (t) { return t.a; }).join(' '), sb: out.map(function (t) { return t.num ? t.a : t.b; }).join(' ') };
}

function dist(a, b, max) {
  var al = a.length, bl = b.length, p2 = R0, p1 = R1, cu = R2, i, j, t, v, c, mn;
  if (al > 40 || bl > 40 || Math.abs(al - bl) > max) return max + 1;
  for (j = 0; j <= bl; j++) p1[j] = j;
  for (i = 1; i <= al; i++) {
    cu[0] = i; mn = i;
    for (j = 1; j <= bl; j++) {
      c = a.charCodeAt(i - 1) === b.charCodeAt(j - 1) ? 0 : 1;
      v = p1[j] + 1; t = cu[j - 1] + 1; if (t < v) v = t; t = p1[j - 1] + c; if (t < v) v = t;
      if (c && i > 1 && j > 1 && a.charCodeAt(i - 1) === b.charCodeAt(j - 2) && a.charCodeAt(i - 2) === b.charCodeAt(j - 1)) { t = p2[j - 2] + 1; if (t < v) v = t; }
      cu[j] = v; if (v < mn) mn = v;
    }
    if (mn > max) return max + 1;
    t = p2; p2 = p1; p1 = cu; cu = t;
  }
  return p1[bl];
}
function tailEq(a, i, b, j) {
  var al = a.length;
  if (al - i !== b.length - j) return false;
  for (; i < al; i++, j++) if (a.charCodeAt(i) !== b.charCodeAt(j)) return false;
  return true;
}
function near1(a, b) {
  var al = a.length, bl = b.length, i = 0, m = al < bl ? al : bl;
  if (al - bl > 1 || bl - al > 1) return false;
  while (i < m && a.charCodeAt(i) === b.charCodeAt(i)) i++;
  if (i === m) return true;
  if (al === bl) return tailEq(a, i + 1, b, i + 1) || (i + 1 < al && a.charCodeAt(i) === b.charCodeAt(i + 1) && a.charCodeAt(i + 1) === b.charCodeAt(i) && tailEq(a, i + 2, b, i + 2));
  return al > bl ? tailEq(a, i + 1, b, i) : tailEq(a, i, b, i + 1);
}
function near(a, b, ed) {
  if (near1(a, b)) return 1;
  return ed > 1 ? dist(a, b, ed) : ed + 1;
}
function wordScore(t, w, open, ed, miss) {
  var tl = t.length, wl = w.length, sc = 0, k, d, x, q, p;
  if (tl === 1) {
    if (miss) return 0;
    if (w === t) { ws0 = 0; wl0 = 1; return 100; }
    if (w.charCodeAt(0) !== t.charCodeAt(0)) return 0;
    ws0 = 0; wl0 = 1; sc = 78 + 22 / wl;
    return open ? sc : sc * .85;
  }
  if (!miss) {
    if (w === t) { ws0 = 0; wl0 = wl; return 100; }
    if (wl > tl && w.charCodeAt(0) === t.charCodeAt(0) && w.indexOf(t) === 0) { sc = 78 + 22 * tl / wl; if (!open) sc *= .85; ws0 = 0; wl0 = tl; }
    else if (tl >= 3 && (k = w.indexOf(t)) > 0) { sc = 45; ws0 = k; wl0 = tl; }
  }
  if (sc < 55 && ed) {
    if (Math.abs(wl - tl) <= ed) {
      d = near(t, w, ed);
      if (d <= ed) { x = d <= 1 ? 55 : 40; if (x > sc) { sc = x; ws0 = 0; wl0 = wl; } }
    }
    if (open && wl > tl && sc < 55) {
      d = near(t, w.slice(0, tl), ed);
      if (d <= ed) { x = d <= 1 ? 55 : 40; if (x > sc) { sc = x; ws0 = 0; wl0 = tl; } }
    }
  }
  if (sc < 30 && !miss && tl >= 3 && wl > tl && w.charCodeAt(0) === t.charCodeAt(0)) {
    q = 0;
    for (p = 0; p < wl && q < tl; p++) if (w.charCodeAt(p) === t.charCodeAt(q)) q++;
    if (q === tl) { sc = 30; ws0 = 0; wl0 = wl; }
  }
  return sc;
}
function tokField(tok, f) {
  var best = 0, n = tok.e.length, i, j, e, fm, miss, ws, sc, k, tl;
  for (i = 0; i < n; i++) {
    e = tok.e[i]; fm = e.m ? fb(f) : fa(f);
    miss = popc(e.mask & ~fm.mask);
    if (miss > e.ed) continue;
    ws = fm.words;
    for (j = 0; j < ws.length; j++) {
      sc = wordScore(e.t, ws[j].t, tok.open, e.ed, miss);
      if (sc > best) { best = sc; hF = e.m; hS = ws[j].s + ws0; hE = hS + wl0; }
    }
    tl = e.t.length;
    if (best < 40 && !miss && tl >= 3 && fm.multi && (k = joined(fm).jt.indexOf(e.t)) !== -1) { best = 40; hF = e.m; hS = fm.jm[k]; hE = fm.jm[k + tl - 1] + 1; }
  }
  return best;
}
function shown(f, d, v, sv, lang) {
  if (f.kind === 'title') return f.lang === lang;
  if (f.kind === 'variant') return f.lang === lang && !!v && f.vid === v.id;
  if (f.kind === 'host') return f.vid ? !!v && f.vid === v.id : !d.variants;
  if (f.kind === 'desc') {
    if (f.lang !== lang) return false;
    if (f.vid) return !!v && f.vid === v.id;
    return !(sv && (lang === 'ar' ? sv.dar : sv.den));
  }
  return false;
}
function bestVis(tok, fields, d, v, sv, lang, li) {
  var best = null, i, f, c, s;
  for (i = 0; i < fields.length; i++) {
    f = fields[i]; if (!shown(f, d, v, sv, lang)) continue;
    c = tokField(tok, f); if (!c) continue;
    s = c * f.w[li];
    if (!best || s > best.s) best = { s: s, bs: c * f.bw, c: c, f: f, m: hF, a: hS, b: hE };
  }
  return best;
}
function rangeOf(p) { var mp = mapOf(p.m ? fb(p.f) : fa(p.f)); return [mp[p.a], mp[p.b - 1] + 1]; }

function evalCand(vi, nt, tb, vb, dk) {
  var cov = 0, sum = 0, strict = 0, last = -1, picks = [], k, p, tp, vp, win;
  for (k = 0; k < nt; k++) {
    tp = tb[k]; vp = vi >= 0 ? vb[vi][k] : null; p = tp; win = false;
    if (vp && (!tp || vp.bs > tp.bs)) { p = vp; win = true; }
    if (vi >= 0 && dk[k] === vi && (!p || p.s < 60)) { p = IDXPICK; win = true; }
    if (win) { strict++; last = k; }
    picks[k] = p;
    if (p) { cov++; sum += tp && tp.s > p.s ? tp.s : p.s; }
  }
  return { vi: vi, cov: cov, sum: sum, strict: strict, last: last, picks: picks };
}
function beats(c, b, vs, cur, def) {
  var cc, bc;
  if (c.cov !== b.cov) return c.cov > b.cov;
  if (Math.abs(c.sum - b.sum) > .01) return c.sum > b.sum;
  if (c.last !== b.last) return c.last > b.last;
  cc = vs[c.vi].id === cur; bc = b.vi >= 0 && vs[b.vi].id === cur;
  if (cc !== bc) return cc;
  return c.vi === def && b.vi !== def;
}
function bonus(d, vid, q, picks, li) {
  var fields = vid ? d.tf.concat(d.vf[vid] || []) : d.tf, qs = q.s, qb = q.sb, sub = 0, eq = false, add = 0, i, j, f, w;
  for (i = 0; i < fields.length; i++) {
    f = fields[i];
    if (qs.length >= 3 && (fa(f).sq.indexOf(qs) !== -1 || fb(f).sq.indexOf(qb) !== -1)) { w = f.w[li]; if (w > sub) sub = w; }
    if (qs.length >= 2 && EQK[f.kind] && (fa(f).sq === qs || (qb && fb(f).sq === qb))) eq = true;
  }
  add = 40 * sub + (eq ? 120 : 0);
  loop: for (i = 0; i < picks.length; i++) {
    if (!picks[i] || !picks[i].f) continue;
    for (j = i + 1; j < picks.length; j++) {
      if (picks[j] && picks[j].f === picks[i].f && picks[j].a > picks[i].a) { add += 15; break loop; }
    }
  }
  return add;
}
function resolve(d, q, li, ctx) {
  var T = q.t, nt = T.length, vs = d.variants || [], tb = [], vb = [], dk = [], lit = [], any = false, k, vi, row, b, o, n, cur, best, c, missed, vid;
  for (k = 0; k < nt; k++) { tb[k] = rec(k, d.ow); lit[k] = tb[k] ? tb[k].s : 0; if (tb[k]) any = true; }
  for (vi = 0; vi < vs.length; vi++) {
    row = [];
    for (k = 0; k < nt; k++) { b = rec(k, d.vow[vi]); row[k] = b; if (b) { any = true; if (b.s > lit[k]) lit[k] = b.s; } }
    vb[vi] = row;
  }
  if (!any) return null;
  for (k = 0; k < nt; k++) {
    dk[k] = -1;
    if (!T[k].num || vs.length < 2 || lit[k] >= 60) continue;
    n = Number(T[k].a);
    if (n < 1 || n > vs.length) continue;
    for (o = 0; o < nt; o++) if (o !== k && tb[o]) { dk[k] = n - 1; break; }
  }
  cur = ctx.curVariantId(d);
  best = evalCand(-1, nt, tb, vb, dk);
  for (vi = 0; vi < vs.length; vi++) {
    c = evalCand(vi, nt, tb, vb, dk);
    if (c.strict && beats(c, best, vs, cur, d.def || 0)) best = c;
  }
  if (!best.cov || (best.cov < nt && nt < 2)) return null;
  vid = best.vi >= 0 ? vs[best.vi].id : null;
  missed = [];
  for (k = 0; k < nt; k++) if (!best.picks[k]) missed.push(T[k].raw);
  return { d: d, rel: best.sum + bonus(d, vid, q, best.picks, li), vid: vid, picks: best.picks, cov: best.cov, full: best.cov === nt, missed: missed };
}
function buildMarks(r, T, ctx, li) {
  var d = r.d, v = r.vid ? vById(d, r.vid) : null, sv = v || vById(d, ctx.curVariantId(d)), fields = v ? d.tf.concat(d.vf[v.id] || []) : d.tf;
  var marks = [], fs = [], why = null, k, p, pv, i;
  function mark(x) {
    var j = fs.indexOf(x.f);
    if (j === -1) { fs.push(x.f); marks.push({ kind: x.f.kind, lang: x.f.lang, vid: x.f.vid, raw: x.f.raw, ranges: [] }); j = marks.length - 1; }
    marks[j].ranges.push(rangeOf(x));
  }
  for (k = 0; k < r.picks.length; k++) {
    p = r.picks[k]; if (!p || !p.f) continue;
    pv = bestVis(T[k], fields, d, v, sv, ctx.lang, li);
    if (pv && pv.c >= 40) mark(pv);
    mark(p);
    if (!why && HID[p.f.kind] && !(pv && (pv.c >= 78 || pv.c >= p.c))) why = p.f.raw;
  }
  for (i = 0; i < marks.length; i++) marks[i].ranges = mergeRanges(marks[i].ranges);
  r.marks = marks; r.why = why;
}

function searchV5(q, tools, ctx) {
  var pq = parseQuery(q), li = ctx.lang === 'ar' ? 0 : 1, out = { tokens: pq.t.map(function (t) { return t.raw; }), full: [], partial: [], missed: [] };
  var full = [], part = [], top = 0, found, i, r;
  if (!pq.t.length) return out;
  if (IX.tools !== tools) { ensureTools(tools); useIndex(IXMAP.get(tools)); }
  found = collect(pq, li);
  for (i = 0; i < found.length; i++) {
    r = resolve(tools[found[i]], pq, li, ctx);
    if (r) (r.full ? full : part).push(r);
  }
  full.forEach(function (x) { if (x.rel > top) top = x.rel; });
  if (top >= 150) full = full.filter(function (x) { return x.rel >= top * .3; });
  function fin(x, marks) {
    var v = x.vid ? vById(x.d, x.vid) : null;
    x.score = x.rel + (ctx.isPinned(x.d.id) ? 8 : 0) + Math.min(12, 4 * Math.log(1 + ctx.frecency(x.d.id)) / Math.LN2) - (ctx.isClosed(x.d, v) ? 25 : 0);
    if (marks) buildMarks(x, pq.t, ctx, li); else { x.marks = []; x.why = null; }
    return x;
  }
  function byScore(x, y) { return (y.score - x.score) || (x.d.folio - y.d.folio); }
  out.full = full.map(function (x) { return fin(x, false); }).sort(byScore);
  out.partial = part.map(function (x) { return fin(x, false); }).sort(function (x, y) { return (y.cov - x.cov) || byScore(x, y); });
  var shownList = out.full.length ? out.full : out.partial;
  for (i = 0; i < shownList.length && i < MARK_CAP; i++) buildMarks(shownList[i], pq.t, ctx, li);
  if (!out.full.length && out.partial.length) out.missed = out.partial[0].missed;
  return out;
}
var DSTOP_EN = 'a an the to of for in on at by with from and or that which who this these those is are be it its my me i want need tool tools app apps site page link something thing open find show give make get use using can do does how what where'.split(' ');
var DSTOP_AR = 'في من الى على عن مع ان او ثم هذا هذه ذلك التي الذي اداه ادوات برنامج تطبيق موقع رابط عايز اريد ابغي لـ ل ب و'.split(' ');
var DSTOP_FR = 'fe men ela 3ala 3an ma3 aw da di elly 3ayez'.split(' ');
var DSTOP = Object.create(null);
DSTOP_EN.concat(DSTOP_FR).forEach(function (w) { DSTOP[w] = 1; });
DSTOP_AR.forEach(function (w) { DSTOP[normText(w, false)] = 1; });
F.isStop = function (w) { return !!DSTOP[normText(w, false).trim()]; };

var CONCEPTS = [
  ['font', 'خط', 'khat'], ['handwriting', 'خط اليد', 'khat yad'], ['revenue', 'ايرادات', 'عوائد'], ['split', 'قسمه', 'qisma'],
  ['shareholder', 'مساهم'], ['prescription', 'روشته', 'وصفه'], ['excel', 'xlsx', 'اكسل'], ['pdf', 'كشف'], ['calculator', 'حاسبه'],
  ['price', 'سعر', 'اسعار'], ['list', 'قائمه', 'لسته'], ['drug', 'دواء', 'ادويه'], ['insurance', 'تامين'], ['contacts', 'جهات اتصال'],
  ['phone', 'هاتف'], ['date', 'تاريخ'], ['chart', 'رسم بياني'], ['clean', 'تنظيف', 'تنقيه'], ['convert', 'تحويل', 'محول'],
  ['unit', 'وحده'], ['visit', 'زياره', 'مرور'], ['task', 'مهام'], ['report', 'تقرير'], ['letter', 'خطاب', 'جواب'], ['print', 'طباعه'],
  ['id', 'رقم قومي', 'هويه'], ['equation', 'معادله'], ['plan', 'خطه'], ['keyboard', 'لوحه المفاتيح'], ['typing', 'كتابه'],
  ['icon', 'ايقونه'], ['github', 'جيتهب']
];
F.lexicon = null;

function stemEn(w) {
  var n = w.length, s;
  if (n < 4 || !/^[a-z]+$/.test(w)) return w;
  if (w.slice(-3) === 'ing' && n - 3 >= 3) return w.slice(0, -3);
  if (w.slice(-2) === 'ed' && n - 2 >= 3) return w.slice(0, -2);
  if (w.slice(-2) === 'es' && n - 2 >= 3 && /(s|x|z|ch|sh)$/.test(w.slice(0, -2))) return w.slice(0, -2);
  if (w.slice(-2) === 'ly' && n - 2 >= 3) return w.slice(0, -2);
  if (w.charAt(n - 1) === 's' && w.charAt(n - 2) !== 's' && n - 1 >= 3) return w.slice(0, -1);
  return w;
}
var AR_SUFFIX = ['\u0627\u062A', '\u0648\u0646', '\u064A\u0646', '\u064A\u0647'];
function stemAr(w) {
  var p = artLen(w), i, s;
  if (p) w = w.slice(p);
  for (i = 0; i < AR_SUFFIX.length; i++) {
    s = AR_SUFFIX[i];
    if (w.length - 2 >= 2 && w.slice(-2) === s) return w.slice(0, -2);
  }
  return w;
}
function stemOf(w) { return /[\u0600-\u06FF]/.test(w) ? stemAr(w) : stemEn(w); }
function termsOf(text, keepStops) {
  var t = normText(text, false), out = [], i = 0, n = t.length, s, w;
  while (i < n) {
    while (i < n && sep(t.charCodeAt(i))) i++;
    if (i >= n) break;
    s = i;
    while (i < n && !sep(t.charCodeAt(i))) i++;
    w = t.slice(s, i);
    if (!keepStops && DSTOP[w]) continue;
    out.push(stemOf(w));
  }
  return out;
}

function conceptMap() {
  var groups = CONCEPTS.slice(), map = Object.create(null);
  if (F.lexicon) Object.keys(F.lexicon).forEach(function (k) { groups.push([k].concat(F.lexicon[k])); });
  groups.forEach(function (g) {
    var members = g.map(function (m) { return termsOf(m, true); });
    members.forEach(function (mine, mi) {
      var others = [];
      members.forEach(function (m, oi) { if (oi !== mi) others = others.concat(m); });
      mine.forEach(function (w) {
        var cur = map[w] || (map[w] = []);
        others.forEach(function (o) { if (o !== w && cur.indexOf(o) === -1) cur.push(o); });
      });
    });
  });
  return map;
}

function buildDocs(ix) {
  var tools = ix.tools, N = tools.length, df = Object.create(null), post = Object.create(null), docs = [], tot = 0, byLen = [];
  tools.forEach(function (d, di) {
    var tf = Object.create(null), vt = Object.create(null), len = 0;
    function add(text, wgt, vid) {
      if (!text) return;
      var ts = termsOf(text, false), i, t;
      for (i = 0; i < ts.length; i++) {
        t = ts[i];
        tf[t] = (tf[t] || 0) + wgt; len += wgt;
        if (vid) { if (!vt[vid]) vt[vid] = Object.create(null); vt[vid][t] = (vt[vid][t] || 0) + wgt; }
      }
    }
    add(d.ar, 3); add(d.en, 3);
    d.aliases.forEach(function (a) { add(a, 2); });
    (d.tags || []).forEach(function (a) { add(a, 2); });
    add(d.dar, 1); add(d.den, 1);
    if (d.gmeta) { add(d.gmeta.ar, .5); add(d.gmeta.en, .5); }
    (d.variants || []).forEach(function (v) {
      add(v.ar, 2, v.id); add(v.en, 2, v.id);
      (v.aliases || []).forEach(function (a) { add(a, 1.5, v.id); });
      add(v.dar, 1, v.id); add(v.den, 1, v.id);
    });
    docs[di] = { tf: tf, vt: vt, len: len || 1 };
    tot += len || 1;
    Object.keys(tf).forEach(function (t) { df[t] = (df[t] || 0) + 1; (post[t] || (post[t] = [])).push(di); });
  });
  var idf = Object.create(null);
  Object.keys(df).forEach(function (t) {
    idf[t] = Math.log(1 + (N - df[t] + .5) / (df[t] + .5));
    (byLen[t.length] || (byLen[t.length] = [])).push(t);
  });
  ix.docs = { docs: docs, df: df, idf: idf, post: post, avg: tot / (N || 1), byLen: byLen, cmap: conceptMap(), N: N };
}

function queryCands(term, D) {
  var out = [], i, c, e, bl, j, w;
  if (D.df[term]) out.push([term, 1]);
  c = D.cmap[term];
  if (c) for (i = 0; i < c.length; i++) if (D.df[c[i]] && c[i] !== term) out.push([c[i], .8]);
  if (!D.df[term] && term.length >= 5) {
    for (bl = term.length - 1; bl <= term.length + 1; bl++) {
      e = D.byLen[bl]; if (!e) continue;
      for (j = 0; j < e.length; j++) { w = e[j]; if (near1(term, w)) out.push([w, .7]); }
    }
  }
  return out;
}

function termMarks(raw, set) {
  var n = norm(raw, false), t = n.text, out = [], i = 0, len = t.length, s, w;
  while (i < len) {
    while (i < len && sep(t.charCodeAt(i))) i++;
    if (i >= len) break;
    s = i;
    while (i < len && !sep(t.charCodeAt(i))) i++;
    w = t.slice(s, i);
    if (set[stemOf(w)] || set[w]) out.push([n.map[s], n.map[i - 1] + 1]);
  }
  return mergeRanges(out);
}

function describe(q, tools, ctx) {
  var ix = IX;
  if (!ix.docs) buildDocs(ix);
  var D = ix.docs, raw = termsOf(q, false), uniq = [], seen = Object.create(null), k1 = 1.2, b = .6, i, j, t, scores = Object.create(null), cand, qs = [], res = [];
  for (i = 0; i < raw.length; i++) if (!seen[raw[i]]) { seen[raw[i]] = 1; uniq.push(raw[i]); }
  if (uniq.length < 2) return [];
  uniq.forEach(function (term) { qs.push({ term: term, cands: queryCands(term, D) }); });
  var touched = Object.create(null), hit = [];
  qs.forEach(function (q1, qi) {
    q1.cands.forEach(function (c) {
      var p = D.post[c[0]], x;
      for (x = 0; x < p.length; x++) if (!touched[p[x]]) { touched[p[x]] = 1; hit.push(p[x]); }
    });
  });
  hit.forEach(function (di) {
    var doc = D.docs[di], sum = 0, matched = 0, topIdf = 0, used = Object.create(null), qi, ci, c, tf, v, best, bestIdf;
    for (qi = 0; qi < qs.length; qi++) {
      best = 0; bestIdf = 0; var bestTerm = null;
      for (ci = 0; ci < qs[qi].cands.length; ci++) {
        c = qs[qi].cands[ci]; tf = doc.tf[c[0]]; if (!tf) continue;
        v = c[1] * D.idf[c[0]] * (tf * (k1 + 1)) / (tf + k1 * (1 - b + b * doc.len / D.avg));
        if (v > best) { best = v; bestIdf = D.idf[c[0]]; bestTerm = c[0]; }
      }
      if (best > 0) { sum += best; matched++; if (bestIdf > topIdf) topIdf = bestIdf; used[bestTerm] = 1; }
    }
    if (!matched) return;
    scores[di] = { di: di, sum: sum, matched: matched, topIdf: topIdf, used: used };
  });
  var list = Object.keys(scores).map(function (x) { return scores[x]; });
  list.forEach(function (x) { x.rel = 10 * x.sum + 25 * x.matched / qs.length; });
  list.sort(function (x, y) { return (y.rel - x.rel) || (x.di - y.di); });
  list = list.slice(0, 12);
  list.forEach(function (x) {
    var d = tools[x.di], doc = D.docs[x.di], bestV = null, bestW = 0, vid;
    (d.variants || []).forEach(function (v) {
      var vt = doc.vt[v.id], w = 0, tm;
      if (!vt) return;
      for (tm in x.used) if (vt[tm]) w += vt[tm];
      if (w > bestW) { bestW = w; bestV = v; }
    });
    x.vid = bestV ? bestV.id : null;
    var v = bestV, set = x.used, marks = [];
    [['ar', d.ar], ['en', d.en]].forEach(function (p) { var rg = p[1] ? termMarks(p[1], set) : []; if (rg.length) marks.push({ kind: 'title', lang: p[0], vid: null, raw: p[1], ranges: rg }); });
    [['ar', d.dar], ['en', d.den]].forEach(function (p) { var rg = p[1] ? termMarks(p[1], set) : []; if (rg.length) marks.push({ kind: 'desc', lang: p[0], vid: null, raw: p[1], ranges: rg }); });
    (d.variants || []).forEach(function (vv) {
      [['ar', vv.ar], ['en', vv.en]].forEach(function (p) { var rg = p[1] ? termMarks(p[1], set) : []; if (rg.length) marks.push({ kind: 'variant', lang: p[0], vid: vv.id, raw: p[1], ranges: rg }); });
      if (v && vv.id === v.id) [['ar', vv.dar], ['en', vv.den]].forEach(function (p) { var rg = p[1] ? termMarks(p[1], set) : []; if (rg.length) marks.push({ kind: 'desc', lang: p[0], vid: vv.id, raw: p[1], ranges: rg }); });
    });
    x.d = d; x.marks = marks; x.why = null; x.picks = []; x.cov = x.matched; x.full = true; x.missed = [];
    var vv2 = v;
    x.score = x.rel + (ctx.isPinned(d.id) ? 8 : 0) + Math.min(12, 4 * Math.log(1 + ctx.frecency(d.id)) / Math.LN2) - (ctx.isClosed(d, vv2) ? 25 : 0);
  });
  list.sort(function (x, y) { return (y.score - x.score) || (x.d.folio - y.d.folio); });
  if (!list.length) return [];
  var top = list[0], lowIdf = top.topIdf < .4 * Math.log(D.N + 1);
  if (top.matched * 2 < qs.length && lowIdf) return [];
  res = list.filter(function (x) { return x.score >= .35 * top.score; }).slice(0, 6);
  return res;
}

var URL_FULL = /^[a-z][a-z0-9+.-]*:\/\//i, URL_BARE = /^[a-z0-9-]+(\.[a-z0-9-]+)+(\/\S*)?$/i;
function normUrl(s) {
  s = String(s).trim().toLowerCase().replace(URL_FULL, '').replace(/^www\./, '').replace(/[?#].*$/, '').replace(/\/+$/, '');
  return s;
}
F.normUrl = normUrl;
function urlTrigger(q) {
  if (q.charAt(0) === '@') return q.length > 1 ? 'host' : null;
  if (/\s/.test(q)) return null;
  if (URL_FULL.test(q) || /^www\./i.test(q)) return 'url';
  if (URL_BARE.test(q)) return 'url';
  return null;
}
function urlParts(u) { return u.split(/[.\-\/]/).filter(Boolean); }
function urlTargets(ix) {
  if (ix.targets) return ix.targets;
  var out = [];
  ix.tools.forEach(function (d, di) {
    if (d.url) { var u = normUrl(d.url); out.push({ di: di, vid: null, u: u, label: u.split(/[.\/]/)[0], parts: urlParts(u), host: u.split('/')[0] }); }
    (d.variants || []).forEach(function (v) { var u = normUrl(v.url); out.push({ di: di, vid: v.id, u: u, label: u.split(/[.\/]/)[0], parts: urlParts(u), host: u.split('/')[0] }); });
  });
  ix.targets = out;
  return out;
}
function urlScore(nq, qparts, t) {
  var u = t.u, i, k, ok, cov;
  if (u === nq) return [1000, 0, nq.length];
  if (u.indexOf(nq) === 0) return [800 + 100 * (nq.length / u.length), 0, nq.length];
  if (t.label.indexOf(nq) === 0) return [700, 0, nq.length];
  i = u.indexOf(nq);
  if (i !== -1) return [500 - Math.min(200, i), i, i + nq.length];
  if (qparts.length) {
    ok = true;
    for (k = 0; k < qparts.length && ok; k++) {
      ok = false;
      for (i = 0; i < t.parts.length; i++) if (t.parts[i].indexOf(qparts[k]) === 0) { ok = true; break; }
    }
    if (ok) { cov = qparts.length / t.parts.length; return [300 + 100 * cov, -1, -1]; }
  }
  return null;
}
function urlSearch(q, mode, tools, ctx) {
  var ix = IX, targets = urlTargets(ix), nq = normUrl(mode === 'host' ? q.slice(1) : q), qparts = urlParts(nq), best = Object.create(null), found = [], i, t, s, d, prev;
  if (!nq) return null;
  for (i = 0; i < targets.length; i++) {
    t = targets[i];
    s = urlScore(nq, qparts, t);
    if (!s) continue;
    prev = best[t.di];
    if (!prev || s[0] > prev.sc[0]) best[t.di] = { t: t, sc: s };
  }
  Object.keys(best).forEach(function (di) {
    var b = best[di], d = tools[di], v = b.t.vid ? vById(d, b.t.vid) : null, ranges = b.sc[1] >= 0 && b.sc[2] > b.sc[1] ? [[b.sc[1], b.sc[2]]] : [];
    var x = { d: d, rel: b.sc[0], vid: b.t.vid, picks: [], cov: 1, full: true, missed: [], why: null, url: b.t.u, marks: ranges.length ? [{ kind: 'url', lang: null, vid: b.t.vid, raw: b.t.u, ranges: ranges }] : [] };
    x.score = x.rel + (ctx.isPinned(d.id) ? 8 : 0) + Math.min(12, 4 * Math.log(1 + ctx.frecency(d.id)) / Math.LN2) - (ctx.isClosed(d, v) ? 25 : 0);
    found.push(x);
  });
  found.sort(function (x, y) { return (y.score - x.score) || (x.d.folio - y.d.folio); });
  return found;
}

function groupScope(q, tools) {
  var m = /^#(\S*)\s*(.*)$/.exec(q), gs = GRP.get(tools) || [], first, i, g, hay, rest;
  if (!m || !m[1]) return null;
  first = normText(m[1], false);
  if (!first) return null;
  for (i = 0; i < gs.length; i++) {
    g = gs[i];
    hay = [g.id, normText(g.ar || '', false), normText(g.en || '', false)];
    if (hay.some(function (h) { return h.indexOf(first) === 0 || normText(h, false).indexOf(first) === 0; })) return { id: g.id, group: g, rest: m[2] };
  }
  return null;
}

function emptyOut() { return { tokens: [], full: [], partial: [], missed: [] }; }
function plainResult(d, ctx) {
  var x = { d: d, rel: 0, vid: null, picks: [], cov: 0, full: true, missed: [], marks: [], why: null };
  x.score = (ctx.isPinned(d.id) ? 8 : 0) + Math.min(12, 4 * Math.log(1 + ctx.frecency(d.id)) / Math.LN2);
  return x;
}

function searchAny(q, tools, ctx) {
  var trimmed = q.trim(), out, sc, mode, found, full, g, hold, i;
  if (trimmed.charAt(0) === '#') {
    sc = groupScope(trimmed, tools);
    if (sc) {
      g = sc.group;
      if (sc.rest.trim()) out = searchV5(sc.rest, tools, ctx); else out = emptyOut();
      if (sc.rest.trim()) {
        out.full = out.full.filter(function (x) { return x.d.group === sc.id; });
        out.partial = [];
        out.missed = [];
      } else {
        out.full = tools.filter(function (d) { return d.group === sc.id; }).map(function (d) { return plainResult(d, ctx); }).sort(function (x, y) { return (y.score - x.score) || (x.d.folio - y.d.folio); });
      }
      out.scope = { id: sc.id, ar: g.ar, en: g.en };
      out.mode = 'group';
      return out;
    }
  }
  mode = urlTrigger(trimmed);
  if (mode) {
    found = urlSearch(trimmed, mode, tools, ctx);
    if (found && found.length) { out = emptyOut(); out.tokens = [trimmed]; out.full = found; out.mode = 'url'; return out; }
    if (mode === 'host') { out = emptyOut(); out.tokens = [trimmed]; out.mode = 'url'; return out; }
  }
  out = searchV5(q, tools, ctx);
  if (!out.full.length) {
    var guess = describe(q, tools, ctx);
    if (guess.length) { out.guess = guess; out.mode = 'desc'; }
    if (!guess.length) out.missedShown = out.missed.filter(function (w) { return !F.isStop(w); });
  }
  if (mode === 'url' && !out.full.length) {
    out.partial = []; out.missed = []; out.guess = null;
    out.url = true;
    out.href = /^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed) ? trimmed : 'https://' + trimmed.replace(/^\/+/, '');
  }
  return out;
}


var MKEY = 'fihrist:mine:v1', MINE_MAX = 1572864;
F.MINE_KEY = MKEY;
function hash36(s) {
  var h = 0x811c9dc5, i;
  for (i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
  var t = h.toString(36);
  while (t.length < 4) t = '0' + t;
  return t.slice(-4);
}
F.hash36 = hash36;
function slugOf(s) { return String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 30).replace(/-+$/g, ''); }
F.slugOf = slugOf;
F.mineToolId = function (name, url) { return 'u-' + (slugOf(name) || 'link') + '-' + hash36(normUrl(url)); };
F.mineGroupId = function (name) { var s = slugOf(name); return 'u-' + (s || 'g' + hash36(String(name))); };
F.pigmentFor = function (key) { var n = parseInt(hash36(String(key)), 36); return PIGMENTS[n % PIGMENTS.length]; };
F.norm = function (s) { return normText(String(s == null ? '' : s), false).trim(); };
F.PIGMENTS = PIGMENTS;

function emptyMine() { return { v: 1, groups: [], tools: [], updated: '' }; }
F.mineBlank = emptyMine;
F.mineRead = function () {
  var raw = null, j;
  try { raw = localStorage.getItem(MKEY); } catch (e) {}
  if (!raw) return emptyMine();
  try { j = JSON.parse(raw); } catch (e) { return emptyMine(); }
  if (!isObj(j) || !Array.isArray(j.groups) || !Array.isArray(j.tools)) return emptyMine();
  return { v: 1, groups: j.groups, tools: j.tools, updated: typeof j.updated === 'string' ? j.updated : '' };
};
F.mineSave = function (payload) {
  var text;
  payload.updated = new Date().toISOString().slice(0, 10);
  try { text = JSON.stringify(payload); } catch (e) { return { ok: false, reason: 'error' }; }
  if (text.length > MINE_MAX) return { ok: false, reason: 'size' };
  try { localStorage.setItem(MKEY, text); } catch (e) { return { ok: false, reason: 'error' }; }
  F.cacheStamp++;
  return { ok: true };
};
F.mineDoc = function (payload) {
  var m = payload || F.mineRead(), out = { groups: [], tools: [] }, doc, i, only;
  if (!m.tools.length || !m.groups.length) return out;
  try { doc = F.validate({ format: 'fihrist/5', revision: 1, updated: '', groups: m.groups, tools: m.tools }); }
  catch (e) {
    doc = null;
    var good = [];
    for (i = 0; i < m.tools.length; i++) {
      try { only = F.validate({ format: 'fihrist/5', revision: 1, updated: '', groups: m.groups, tools: [m.tools[i]] }); good.push(m.tools[i]); } catch (x) {}
    }
    if (good.length) { try { doc = F.validate({ format: 'fihrist/5', revision: 1, updated: '', groups: m.groups, tools: good }); } catch (y) { doc = null; } }
  }
  if (!doc) return out;
  var used = Object.create(null);
  doc.tools.forEach(function (t) { used[t.group] = 1; });
  out.groups = doc.groups.filter(function (g) { return used[g.id]; });
  out.tools = doc.tools;
  out.tools.forEach(function (t) { t.mine = true; });
  return out;
};
window.addEventListener('storage', function (e) { if (e.key === MKEY && F.onMineExternal) { F.cacheStamp++; F.onMineExternal(); } });

var TPL_RE = /\{q\}|%s/;
F.isTemplate = function (u) { return TPL_RE.test(u || ''); };
F.fillTemplate = function (u, arg) { return String(u).replace(/\{q\}|%s/g, function () { return encodeURIComponent(arg || ''); }); };

F.cacheStamp = 0;
F.search = function (q, tools, ctx) {
  var ix, key, hit;
  if (IX.tools !== tools) { ensureTools(tools); useIndex(IXMAP.get(tools)); }
  ix = IX;
  key = q + '\u0001' + ctx.lang + '\u0001' + F.cacheStamp;
  hit = ix.cache[key];
  if (hit) return hit;
  hit = searchAny(q, tools, ctx);
  ix.cache[key] = hit;
  ix.cacheKeys.push(key);
  if (ix.cacheKeys.length > 32) delete ix.cache[ix.cacheKeys.shift()];
  return hit;
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
  pen: '<path d="M4 20l4-1 11-11-3-3L5 16l-1 4zM14 6l4 4"/>',
  layers: '<path d="m12 3 9 5-9 5-9-5z"/><path d="m3 13 9 5 9-5"/>',
  calc: '<rect x="5" y="3" width="14" height="18" rx="2.5"/><path d="M8.5 7.5h7M8.5 12h.01M12 12h.01M15.5 12h.01M8.5 16h.01M12 16h.01M15.5 16h.01"/>',
  printer: '<path d="M6 9V3h12v6"/><rect x="3" y="9" width="18" height="8" rx="2"/><path d="M7 14h10v7H7z"/>',
  flask: '<path d="M9 3h6M10 3v6l-5.4 9.4A2 2 0 0 0 6.3 21.5h11.4a2 2 0 0 0 1.7-3.1L14 9V3"/><path d="M7.5 15h9"/>',
  star: '<path d="m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z"/>',
  box: '<rect x="4" y="4" width="16" height="16" rx="3"/>',
  pill: '<g transform="rotate(-45 12 12)"><rect x="2.5" y="8" width="19" height="8" rx="4"/><path d="M12 8v8"/></g>',
  chart: '<path d="M4 4v16h16"/><path d="M8 16v-4M12 16V8M16 16v-6"/>',
  doc: '<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5"/><path d="M9 13h6M9 17h4"/>',
  x: '<path d="M18 6 6 18M6 6l12 12"/>',
  globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18"/><path d="M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/>',
  dens1: '<path d="M4 6h16M4 12h16M4 18h16"/>',
  dens2: '<path d="M4 5h16M4 9.5h16M4 14h16M4 18.5h16"/>',
  shelf: '<rect x="3" y="4" width="18" height="7" rx="2"/><path d="M3 15h18M3 19h12"/>',
  motion: '<path d="M3 12h4l3-7 4 14 3-7h4"/>',
  qr: '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><path d="M14 14h3v3M21 14v.01M14 21h3M21 17v4"/>',
  back: '<path d="M19 12H5"/><path d="m11 6-6 6 6 6"/>',
  check: '<path d="m5 12.5 4.5 4.5L19 7.5"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.8-3.8"/>'
};
F.svg = function (name, cls) {
  return '<svg class="' + (cls || '') + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + (F.ICON[name] || '') + '</svg>';
};
})();
