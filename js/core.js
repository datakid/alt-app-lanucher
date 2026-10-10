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
var SEP = {};
[32, 44, 46, 58, 62, 124, 0x203A, 0x060C].forEach(function (c) { SEP[c] = 1; });
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
    while (i < n && SEP[text.charCodeAt(i)]) i++;
    if (i >= n) break;
    s = i;
    while (i < n && !SEP[text.charCodeAt(i)]) i++;
    t = text.slice(s, i);
    out.push({ t: t, s: s, x: 0 });
    p = artLen(t);
    if (p) out.push({ t: t.slice(p), s: s + p, x: 1 });
  }
  return out;
}
function formOf(n) {
  var ws = wordsOf(n.text), sq = [], jt = '', jm = [], i, j, w;
  for (i = 0; i < ws.length; i++) {
    w = ws[i]; if (w.x) continue;
    sq.push(w.t);
    for (j = 0; j < w.t.length; j++) { jt += w.t[j]; jm.push(w.s + j); }
  }
  return { text: n.text, map: n.map, words: ws, mask: maskOf(n.text), sq: sq.join(' '), jt: sq.length > 1 ? jt : '', jm: jm };
}
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

F.buildIdx = function (d, g) {
  var f = [];
  function push(kind, lang, raw, w, vid) { if (raw) f.push({ kind: kind, lang: lang, raw: raw, w: w, bw: Math.max(w[0], w[1]), vid: vid || null, a: formOf(norm(raw, false)), b: formOf(norm(raw, true)) }); }
  push('title', 'ar', d.ar, [1, .88]); push('title', 'en', d.en, [.88, 1]);
  push('desc', 'ar', d.dar, [.45, .4]); push('desc', 'en', d.den, [.4, .45]);
  d.aliases.forEach(function (a) { push('alias', null, a, [.9, .9]); });
  if (g) { push('group', 'ar', g.ar, [.55, .55]); push('group', 'en', g.en, [.55, .55]); }
  if (d.host) push('host', null, d.host, [.5, .5]);
  (d.variants || []).forEach(function (v) {
    push('variant', 'ar', v.ar, [.95, .84], v.id); push('variant', 'en', v.en, [.84, .95], v.id);
    (v.aliases || []).forEach(function (a) { push('valias', null, a, [.92, .92], v.id); });
    if (!/^v\d+$/.test(v.id) && v.id.replace(/-/g, ' ') !== v.en.toLowerCase()) push('vid', null, v.id, [.85, .85], v.id);
    if (v.en.toLowerCase() === v.id && VSYN.hasOwnProperty(v.id)) VSYN[v.id].forEach(function (s) { push('vsyn', null, s, [.8, .8], v.id); });
    push('host', null, String(v.host || '').split('.')[0], [.5, .5], v.id);
    push('desc', 'ar', v.dar, [.45, .4], v.id); push('desc', 'en', v.den, [.4, .45], v.id);
  });
  return f;
};
F.prepare = function (tools, groups) {
  var gm = {};
  (groups || []).forEach(function (g) { gm[g.id] = g; });
  tools.forEach(function (d) {
    (d.variants || []).forEach(function (v) { v.host = F.hostOf(v.url); });
    if (d.url) d.host = F.hostOf(d.url);
    d.idx = F.buildIdx(d, gm[d.group]);
    d.tf = []; d.vf = {};
    d.idx.forEach(function (f) { if (f.vid) (d.vf[f.vid] = d.vf[f.vid] || []).push(f); else d.tf.push(f); });
  });
  buildIndex(tools);
};

function buildIndex(tools) {
  var maps = [{}, {}], fields = [], nO = 0, ix = { tools: tools, fields: fields, da: [], db: [], ja: [], jb: [], nF: 0, nO: 0 };
  tools.forEach(function (d, ti) {
    var vo = {};
    d.ti = ti; d.ow = nO++; d.vow = [];
    (d.variants || []).forEach(function (v) { vo[v.id] = nO; d.vow.push(nO); nO++; });
    d.idx.forEach(function (f) {
      f.id = fields.length; f.ti = ti; fields.push(f); f.ow = f.vid ? vo[f.vid] : d.ow;
      [f.a, f.b].forEach(function (form, m) {
        form.words.forEach(function (w) {
          var key = ' ' + w.t, e = maps[m][key];
          if (!e) { e = maps[m][key] = { t: w.t, mask: maskOf(w.t), post: [] }; (m ? ix.db : ix.da).push(e); }
          e.post.push({ f: f, s: w.s });
        });
        if (form.jt) (m ? ix.jb : ix.ja).push(f);
      });
    });
  });
  ix.nF = fields.length; ix.nO = nO;
  FS = new Int32Array(MAXT * ix.nF); FC = new Float64Array(MAXT * ix.nF); FM = new Uint8Array(MAXT * ix.nF);
  FA = new Int32Array(MAXT * ix.nF); FB = new Int32Array(MAXT * ix.nF);
  OSt = new Int32Array(MAXT * nO); OS = new Float64Array(MAXT * nO); OBS = new Float64Array(MAXT * nO); OI = new Int32Array(MAXT * nO);
  TS = new Int32Array(tools.length);
  IX = ix;
}
function collect(q, li) {
  var T = q.t, nt = T.length, nF = IX.nF, nO = IX.nO, found = [], k, i, j, p, e, l, w, tok, mc, sc, f, g, o, x, idx, fid, form, pos, post, touched, c, s, tl;
  stamp++;
  for (k = 0; k < nt; k++) {
    tok = T[k]; touched = [];
    for (i = 0; i < tok.e.length; i++) {
      e = tok.e[i]; l = e.m ? IX.db : IX.da; tl = e.t.length;
      for (j = 0; j < l.length; j++) {
        w = l[j]; x = e.mask & ~w.mask; mc = x ? popc(x) : 0;
        if (mc > e.ed) continue;
        sc = wordScore(e.t, w.t, tok.open, e.ed, mc);
        if (!sc) continue;
        post = w.post;
        for (p = 0; p < post.length; p++) {
          f = post[p].f; idx = k * nF + f.id;
          if (FS[idx] !== stamp) { FS[idx] = stamp; FC[idx] = 0; touched.push(f); }
          if (sc > FC[idx]) { FC[idx] = sc; FM[idx] = e.m; FA[idx] = post[p].s + ws0; FB[idx] = FA[idx] + wl0; }
        }
      }
      if (tl >= 3) {
        l = e.m ? IX.jb : IX.ja;
        for (j = 0; j < l.length; j++) {
          f = l[j]; form = e.m ? f.b : f.a;
          if (e.mask & ~form.mask) continue;
          idx = k * nF + f.id;
          if (FS[idx] === stamp && FC[idx] >= 40) continue;
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
    e = tok.e[i]; fm = e.m ? f.b : f.a;
    miss = popc(e.mask & ~fm.mask);
    if (miss > e.ed) continue;
    ws = fm.words;
    for (j = 0; j < ws.length; j++) {
      sc = wordScore(e.t, ws[j].t, tok.open, e.ed, miss);
      if (sc > best) { best = sc; hF = e.m; hS = ws[j].s + ws0; hE = hS + wl0; }
    }
    tl = e.t.length;
    if (best < 40 && !miss && tl >= 3 && fm.jt && (k = fm.jt.indexOf(e.t)) !== -1) { best = 40; hF = e.m; hS = fm.jm[k]; hE = fm.jm[k + tl - 1] + 1; }
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
function rangeOf(p) { var mp = (p.m ? p.f.b : p.f.a).map; return [mp[p.a], mp[p.b - 1] + 1]; }

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
    if (qs.length >= 3 && (f.a.sq.indexOf(qs) !== -1 || f.b.sq.indexOf(qb) !== -1)) { w = f.w[li]; if (w > sub) sub = w; }
    if (qs.length >= 2 && EQK[f.kind] && (f.a.sq === qs || (qb && f.b.sq === qb))) eq = true;
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

F.search = function (q, tools, ctx) {
  var pq = parseQuery(q), li = ctx.lang === 'ar' ? 0 : 1, out = { tokens: pq.t.map(function (t) { return t.raw; }), full: [], partial: [], missed: [] };
  var full = [], part = [], top = 0, found, i, r;
  if (!pq.t.length) return out;
  if (IX.tools !== tools) buildIndex(tools);
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
  out.full = full.map(function (x) { return fin(x, true); }).sort(byScore);
  out.partial = part.map(function (x) { return fin(x, !full.length); }).sort(function (x, y) { return (y.cov - x.cov) || byScore(x, y); });
  if (!out.full.length && out.partial.length) out.missed = out.partial[0].missed;
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
