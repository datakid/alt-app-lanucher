(function () {
'use strict';
var F = window.F, store = F.store, svg = F.svg, M = F.motion;
var $ = F.$ = function (id) { return document.getElementById(id); };
var root = document.documentElement, indexEl = $('index'), listEl = $('listbox'), caretEl = $('caret');
var seekEl = $('seek'), seekFieldEl = $('seek-field'), countEl = $('seek-count'), tabsEl = $('tabs'), scopeEl = $('seek-scope'), tabsInk = $('tabs-ink');
var liveEl = $('live'), toastEl = $('toast'), toastBody = $('toast-body'), plateEl = $('plate'), plateFill = $('plate-fill'), plateTitle = $('plate-title');
var shelfEl = $('shelf'), shelfTrack = $('shelf-track'), shelfTitle = $('shelf-title'), shelfHide = $('shelf-hide');
F.perf = /[?&]perf=1/.test(location.search);
Object.defineProperty(F, 'reduceMotion', { get: function () { return !M.ok(); } });
F.canHover = matchMedia('(hover: hover)').matches;
var HL = null;
if (typeof Highlight !== 'undefined' && window.CSS && CSS.highlights) { HL = new Highlight(); CSS.highlights.set('seek', HL); }

F.T = function () { return F.STR[store.lang]; };
F.L = function (o) { return store.lang === 'ar' ? o.ar : o.en; };
var T = F.T, L = F.L;
var AR = '٠١٢٣٤٥٦٧٨٩';
F.num = function (n, pad) { var s = pad ? String(n).padStart(pad, '0') : String(n); return store.lang === 'ar' ? s.replace(/\d/g, function (d) { return AR[d]; }) : s; };
var num = F.num;
F.el = function (tag, cls, parent, html) { var n = document.createElement(tag); if (cls) n.className = cls; if (html != null) n.innerHTML = html; if (parent) parent.appendChild(n); return n; };
var el = F.el;
function setText(node, text) {
  var c = node.firstChild;
  if (c && c === node.lastChild && c.nodeType === 3) { if (c.data !== text) c.data = text; }
  else node.textContent = text;
}
F.setText = setText;

var DATA = [], BY_ID = {}, GROUPS = [], GMETA = {}, rows = {}, bands = {}, NEW_WINDOW = 21 * 864e5;
F.rows = rows; F.byId = BY_ID;
F.setDoc = function (doc, src) {
  F.doc = doc; F.docSrc = src;
  DATA = F.DATA = doc.tools; GROUPS = doc.groups.map(function (g) { return g.id; });
  GMETA = { pinned: { ar: F.STR.ar.pinnedG, en: F.STR.en.pinnedG, icon: 'pinF' }, recent: { ar: F.STR.ar.recent, en: F.STR.en.recent, icon: 'clock' },
    elsewhere: { ar: F.STR.ar.elsewhere, en: F.STR.en.elsewhere, icon: 'ext' }, partial: { ar: F.STR.ar.partial, en: F.STR.en.partial, icon: 'search' } };
  doc.groups.forEach(function (g) { GMETA[g.id] = g; });
  F.GMETA = GMETA;
  Object.keys(BY_ID).forEach(function (k) { delete BY_ID[k]; });
  var now = Date.now();
  F.prepare(DATA, doc.groups);
  DATA.forEach(function (d, i) {
    d.folio = i + 1; BY_ID[d.id] = d; d.pig = 'var(--p-' + d.pigment + ')';
    d.isNew = !!d.since && (now - Date.parse(d.since)) < NEW_WINDOW;
  });
  store.pins = store.pins.filter(function (id) { return BY_ID[id]; });
  buildAll();
};
function isPinned(id) { return store.pins.indexOf(id) !== -1; }
F.isPinned = isPinned;

F.curVariant = function (d) {
  if (!d.variants) return null;
  var last = store.lastVariant[d.id];
  for (var i = 0; i < d.variants.length; i++) if (d.variants[i].id === last) return d.variants[i];
  return d.variants[d.def || 0];
};
F.vOf = function (d, id) {
  if (!d.variants) return null;
  for (var i = 0; i < d.variants.length; i++) if (d.variants[i].id === id) return d.variants[i];
  return null;
};
F.target = function (d, v) {
  v = v || F.curVariant(d);
  return v ? { url: v.url, host: v.host, v: v, closed: !!(d.closed || v.closed) } : { url: d.url, host: d.host, v: null, closed: !!d.closed };
};
var target = F.target;

var inkRO = 'ResizeObserver' in window ? new ResizeObserver(function (entries) {
  var list = [];
  entries.forEach(function (e) { var r = e.target._r; if (r && r.ink) { var tg = target(r.d, r.matchV); list.push([r.ink, tg.v ? r.chips[tg.v.id] : null]); } });
  M.slideMany(list, 'xy');
}) : null;

function buildRow(d) {
  var li = el('li', 'row'); li.setAttribute('role', 'presentation'); li.dataset.id = d.id; li.style.setProperty('--pigment', d.pig);
  var a = el('a', 'row-link', li); a.id = 'opt-' + d.id; a.tabIndex = -1; a.draggable = false; a.rel = 'noopener'; a.setAttribute('role', 'option'); a.setAttribute('aria-selected', 'false');
  var folio = el('span', 'folio', a); folio.setAttribute('aria-hidden', 'true'); el('span', 'mark', a).setAttribute('aria-hidden', 'true');
  var body = el('span', 'body', a), tl = el('span', 'title-line', body);
  var title = el('span', 'title', tl), vtag = d.variants ? el('span', 'vtag', tl) : null, flag = el('span', 'flag', tl);
  if (vtag) { vtag.hidden = true; vtag.setAttribute('aria-hidden', 'true'); }
  tl.insertAdjacentHTML('beforeend', svg('pinF', 'pinmark'));
  var meta = el('span', 'meta', body), why = el('span', 'why', meta), desc = el('span', 'desc', meta), host = el('span', 'host', meta);
  why.hidden = true;
  var r = { d: d, li: li, link: a, folio: folio, title: title, vtag: vtag, flag: flag, why: why, desc: desc, host: host, chips: {}, sig: null, jobs: [], matchV: null, anim: null };
  li._r = r;
  if (d.variants) {
    var chips = el('span', 'chips', body); chips.setAttribute('role', 'group');
    r.ink = el('span', 'chips__ink', chips); r.ink.setAttribute('aria-hidden', 'true');
    d.variants.forEach(function (v) { var c = el('button', 'chip', chips); c.type = 'button'; c.tabIndex = -1; c.dataset.v = v.id; r.chips[v.id] = c; });
    chips._r = r; if (inkRO) inkRO.observe(chips);
  }
  r.more = el('button', 'more', a, svg('more')); r.more.type = 'button'; r.more.tabIndex = -1;
  return r;
}
function buildAll() {
  if (inkRO) inkRO.disconnect();
  Object.keys(rows).forEach(function (k) { delete rows[k]; });
  Object.keys(bands).forEach(function (k) { delete bands[k]; });
  while (listEl.lastChild && listEl.lastChild !== caretEl) listEl.removeChild(listEl.lastChild);
  ['pinned', 'recent', 'elsewhere', 'partial'].concat(GROUPS).forEach(function (g) {
    var b = el('li', 'band'); b.setAttribute('role', 'presentation'); b.dataset.g = g;
    b.innerHTML = svg(GMETA[g].icon, 'band__icon');
    var bd = bands[g] = { li: b, text: el('span', 'band__text', b), count: el('span', 'band__count', b), anim: null };
    b._r = bd;
  });
  DATA.forEach(function (d) { rows[d.id] = buildRow(d); });
  active = null; lastKey = null; geoDirty = true; shelfSig = '';
}
function descOf(d, tg) { return store.lang === 'ar' ? (tg.v && tg.v.dar) || d.dar : (tg.v && tg.v.den) || d.den; }
F.paintRow = paintRow;
function paintRow(r) {
  var d = r.d, s = T(), tg = target(d, r.matchV);
  setText(r.folio, num(d.folio, 2));
  r.why.hidden = true; setText(r.why, '');
  setText(r.title, L(d));
  setText(r.desc, descOf(d, tg));
  setText(r.host, tg.closed ? '' : tg.host); r.host.hidden = tg.closed;
  r.flag.hidden = !(tg.closed || d.isNew); setText(r.flag, tg.closed ? s.closed : s.isNew);
  r.flag.classList.toggle('flag--closed', tg.closed);
  r.li.classList.toggle('is-closed', tg.closed);
  r.li.classList.toggle('is-pinned', isPinned(d.id));
  r.more.setAttribute('aria-label', L(d) + ' — ' + s.more);
  if (tg.closed) r.link.removeAttribute('href'); else r.link.setAttribute('href', tg.url);
  if (d.variants) d.variants.forEach(function (v) {
    var c = r.chips[v.id]; setText(c, L(v));
    c.setAttribute('aria-current', tg.v === v ? 'true' : 'false');
    c.setAttribute('aria-label', L(d) + ' — ' + L(v));
    c.classList.toggle('is-hit', r.matchV === v);
  });
  if (r.vtag) { var on = !!(r.matchV && d.variants.length > 1); r.vtag.hidden = !on; setText(r.vtag, on ? L(r.matchV) : ''); }
  r.sig = null;
  if (r.ink) placeInk(r);
}
function placeInk(r, now) {
  if (!r.ink) return;
  var tg = target(r.d, r.matchV);
  M.slide(r.ink, tg.v ? r.chips[tg.v.id] : null, 'xy', now);
}
function sigOf(r, hlKey) {
  var tg = target(r.d, r.matchV);
  return store.lang + '|' + (tg.v ? tg.v.id : '') + '|' + (r.matchV ? r.matchV.id : '') + '|' + (tg.closed ? 1 : 0) + '|' + (isPinned(r.d.id) ? 1 : 0) + '|' + (r.d.isNew ? 1 : 0) + '|' + hlKey;
}

function recentIds() {
  return Object.keys(store.visits).filter(function (id) { return BY_ID[id]; })
    .sort(function (a, b) { return store.visits[b].t - store.visits[a].t; }).slice(0, 8);
}
F.recentIds = recentIds;
var TAB_LIST = [];
F.tabList = function () { return TAB_LIST; };
F.renderTabs = function () {
  var s = T(), list = [{ id: 'all', label: s.all, n: DATA.length }];
  if (store.pins.length) list.push({ id: 'pinned', label: L(GMETA.pinned), n: store.pins.length });
  var rc = recentIds().length; if (rc) list.push({ id: 'recent', label: L(GMETA.recent), n: rc });
  GROUPS.forEach(function (g) { list.push({ id: g, label: L(GMETA[g]), n: DATA.filter(function (d) { return d.group === g; }).length }); });
  if (!list.some(function (x) { return x.id === store.tab; })) store.tab = 'all';
  TAB_LIST = list;
  Array.prototype.slice.call(tabsEl.querySelectorAll('.tab')).forEach(function (t) { t.remove(); });
  list.forEach(function (x) {
    var b = el('button', 'tab', tabsEl); b.type = 'button'; b.setAttribute('role', 'tab'); b.dataset.tab = x.id; b.id = 'tab-' + x.id;
    b.setAttribute('aria-selected', x.id === store.tab ? 'true' : 'false'); b.tabIndex = x.id === store.tab ? 0 : -1;
    el('span', 'tab__t', b).textContent = x.label; el('sup', 'tab__n', b).textContent = num(x.n);
  });
  slideTabs();
};
function slideTabs() { M.slide(tabsInk, $('tab-' + store.tab), 'xy'); }
F.slideTabs = slideTabs;
F.setTab = function (id) {
  if (!TAB_LIST.some(function (x) { return x.id === id; })) return;
  store.tab = id; F.persist();
  tabsEl.querySelectorAll('.tab').forEach(function (t) { var on = t.dataset.tab === id; t.setAttribute('aria-selected', on ? 'true' : 'false'); t.tabIndex = on ? 0 : -1; if (on) t.scrollIntoView({ inline: 'nearest', block: 'nearest', behavior: M.ok() ? 'smooth' : 'auto' }); });
  slideTabs();
  F.render({ animate: true, resetActive: true });
};
F.tabAt = function (i) { if (TAB_LIST[i]) F.setTab(TAB_LIST[i].id); };
tabsEl.addEventListener('click', function (e) { var b = e.target.closest('.tab'); if (b && b.dataset.tab !== store.tab) F.setTab(b.dataset.tab); });
tabsEl.addEventListener('keydown', function (e) {
  if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
  e.preventDefault(); e.stopPropagation();
  var i = TAB_LIST.findIndex(function (x) { return x.id === store.tab; });
  var fwd = (e.key === 'ArrowLeft') === (root.dir === 'rtl');
  var n = TAB_LIST[(i + (fwd ? 1 : -1) + TAB_LIST.length) % TAB_LIST.length];
  F.setTab(n.id); var t = $('tab-' + n.id); if (t) t.focus();
});
scopeEl.addEventListener('click', function () {
  if (F.palette && F.palette.test(seekEl.value)) { seekEl.value = ''; F.render({ animate: true }); seekEl.focus(); return; }
  if (store.tab !== 'all') F.setTab('all');
});

var active = null, order = [], lastKey = null;
F.getActive = function () { return active; };
F.order = function () { return order; };

function buildSeq(q, hasQ, tab, rec) {
  var s = T(), seq = [], inTab = function (d) { return tab === 'all' || (tab === 'pinned' ? isPinned(d.id) : tab === 'recent' ? rec.indexOf(d.id) !== -1 : d.group === tab); };
  if (hasQ) {
    var out = F.search(seekEl.value, DATA, searchCtx()), list = out.full.length ? out.full : out.partial, here = [], away = [];
    list.forEach(function (x) { (inTab(x.d) ? here : away).push(x); });
    if (!out.full.length && list.length) seq.push({ band: 'partial', n: list.length, label: s.partial + ' ' + out.missed.map(function (m) { return '«' + m + '»'; }).join(' ') });
    here.forEach(function (x) { seq.push({ row: rows[x.d.id], res: x }); });
    if (away.length) { seq.push({ band: 'elsewhere', n: away.length }); away.forEach(function (x) { seq.push({ row: rows[x.d.id], res: x }); }); }
  } else if (tab === 'pinned' || tab === 'recent') {
    (tab === 'pinned' ? store.pins : rec).forEach(function (id) { if (BY_ID[id]) seq.push({ row: rows[id] }); });
  } else {
    var pinned = store.pins.map(function (id) { return BY_ID[id]; }).filter(Boolean);
    if (tab === 'all' && pinned.length) { seq.push({ band: 'pinned', n: pinned.length }); pinned.forEach(function (d) { seq.push({ row: rows[d.id] }); }); }
    GROUPS.forEach(function (g) {
      if (tab !== 'all' && tab !== g) return;
      var ds = DATA.filter(function (d) { return d.group === g && !(tab === 'all' && isPinned(d.id)); });
      if (!ds.length) return;
      seq.push({ band: g, n: ds.length }); ds.forEach(function (d) { seq.push({ row: rows[d.id] }); });
    });
  }
  return seq;
}

function reconcile(nodes) {
  var cur = listEl.firstElementChild, i, n, nx;
  if (cur === caretEl) cur = cur.nextElementSibling;
  for (i = 0; i < nodes.length; i++) {
    n = nodes[i];
    if (cur === n) { cur = cur.nextElementSibling; continue; }
    listEl.insertBefore(n, cur);
  }
  while (cur) { nx = cur.nextElementSibling; if (cur !== caretEl) listEl.removeChild(cur); cur = nx; }
}
function holder(n) { return n._r || n; }
function idOf(row) { return row.d ? row.d.id : row.id; }

F.render = function (opts) {
  opts = opts || {};
  var t0 = F.perf ? performance.now() : 0;
  var snap = null;
  if (M.ok() && !opts.noFlip) { var cur = [], cn = listEl.firstElementChild; while (cn) { if (cn !== caretEl) cur.push(cn); cn = cn.nextElementSibling; } snap = { nodes: cur, map: cur.length ? M.snap(listEl, cur) : new Map() }; }
  if (HL) HL.clear();
  var s = T(), raw = seekEl.value, q = raw.trim(), hasQ = q.length > 0, tab = store.tab, cmd = !!(F.palette && F.palette.test(raw));
  seekFieldEl.classList.toggle('has-value', raw.length > 0);
  var rec = recentIds(), seq, i, x, r;
  if (cmd) {
    seq = F.palette.seq(raw.slice(1).trim());
  } else {
    seq = buildSeq(q, hasQ, tab, rec);
    for (i = 0; i < seq.length; i++) {
      x = seq[i];
      if (!x.row) continue;
      x.row.matchV = null; x.row.jobs = [];
      if (x.res) annotate(x.res);
    }
    for (i = 0; i < seq.length; i++) {
      x = seq[i];
      if (!x.row) continue;
      r = x.row;
      var hk = r.jobs.map(function (j) { return j.k + ':' + j.rg.join(','); }).join('|');
      var sg = sigOf(r, hk), fresh = sg !== r.sig;
      if (fresh) { paintRow(r); r.sig = sg; }
      applyJobs(r, fresh);
    }
  }
  var nodes = [], shown = {};
  seq.forEach(function (y) {
    if (y.band) { var b = bands[y.band]; setText(b.text, y.label || L(GMETA[y.band])); setText(b.count, num(y.n)); nodes.push(b.li); return; }
    nodes.push(y.row.li); shown[idOf(y.row)] = 1;
  });
  var key = nodes.map(function (n) { return n.dataset.id || ('g:' + n.dataset.g); }).join(',') + (cmd ? '#c' : '');
  if (key !== lastKey) {
    var mutate = function () { reconcile(nodes); };
    if (snap) M.flip(snap.nodes, mutate, { holder: holder, list: listEl, next: nodes, snap: snap.map, stagger: opts.animate ? 12 : 0, cap: 10 });
    else mutate();
    lastKey = key; geoDirty = true;
  }
  order = seq.filter(function (y) { return y.row; }).map(function (y) { return y.row; });
  var n = order.length;
  document.body.classList.toggle('is-empty', n === 0);
  document.body.classList.toggle('is-cmd', cmd);
  if (n === 0) F.paintEmpty(q);
  var label = cmd ? s.commands : (tab !== 'all' ? (TAB_LIST.filter(function (z) { return z.id === tab; })[0] || {}).label : '');
  scopeEl.hidden = !label; if (label) setText(scopeEl, (cmd ? '⌘ ' : '') + label);
  scopeEl.setAttribute('aria-label', label ? label + ' — ' + s.scopeAll : '');
  var total = cmd ? F.palette.total() : DATA.length;
  setText(countEl, hasQ || tab !== 'all' ? num(n) + ' / ' + num(total) : num(total));
  var lead = order[0];
  liveEl.textContent = hasQ ? n + ' ' + s.of + ' ' + total + (lead && lead.d ? ' · ' + L(lead.d) + (lead.matchV && lead.d.variants.length > 1 ? ' — ' + L(lead.matchV) : '') : '') : '';
  var keep = !opts.resetActive && active && shown[idOf(active)] ? active : null;
  setActive(keep || (hasQ ? order[0] : null), { noScroll: true, instant: !!opts.instant });
  renderShelf();
  syncURL();
  if (F.perf) { var dt = performance.now() - t0; performance.measure('render', { start: t0, end: t0 + dt }); console.log('render ' + dt.toFixed(2) + 'ms rows=' + n); }
};

function annotate(res) {
  var d = res.d, r = rows[d.id], lang = store.lang, v = res.vid ? F.vOf(d, res.vid) : null, acc = [], keys = [], hid = null, painted = 0, i;
  r.matchV = v;
  var tg = target(d, v), descT = descOf(d, tg), hostT = tg.closed ? '' : tg.host, vtagOn = !!(v && d.variants.length > 1);
  function put(k, node, text, rg) {
    var j = keys.indexOf(k);
    if (j === -1) { j = keys.push(k) - 1; acc[j] = { k: k, node: node, text: text, rg: [] }; }
    for (var m = 0; m < rg.length; m++) acc[j].rg.push(rg[m]);
  }
  res.marks.forEach(function (m) {
    if (!m.ranges.length) return;
    if (m.kind === 'title') { if (m.lang === lang) put('title', r.title, m.raw, m.ranges); }
    else if (m.kind === 'variant') { if (v && m.vid === v.id && m.lang === lang) { put('chip', r.chips[v.id], m.raw, m.ranges); if (vtagOn) put('vtag', r.vtag, m.raw, m.ranges); } }
    else if (m.kind === 'desc') { if (m.lang === lang && descT === m.raw) put('desc', r.desc, m.raw, m.ranges); }
    else if (m.kind === 'host') { if (hostT && hostT.indexOf(m.raw) === 0) put('host', r.host, hostT, m.ranges); }
    else if (res.why && m.raw === res.why && !hid) hid = m;
  });
  for (i = 0; i < acc.length; i++) painted += acc[i].rg.length;
  if (!painted && hid) put('why', r.why, hid.raw, hid.ranges);
  r.jobs = acc.map(function (a) { return { k: a.k, node: a.node, text: a.text, rg: F.mergeRanges(a.rg) }; });
}
function applyJobs(r, fresh) {
  r.jobs.forEach(function (j) {
    if (j.k === 'why') { r.why.hidden = false; setText(r.why, j.text); }
    if (HL) {
      setText(j.node, j.text);
      var tn = j.node.firstChild; if (!tn) return;
      j.rg.forEach(function (p) { try { var g = new Range(); g.setStart(tn, p[0]); g.setEnd(tn, Math.min(tn.length, p[1])); HL.add(g); } catch (e) {} });
    } else if (fresh) paintMarks(j.node, j.text, j.rg);
  });
}
function paintMarks(node, text, rg) {
  var frag = document.createDocumentFragment(), c = 0;
  rg.forEach(function (p) {
    if (p[0] > c) frag.appendChild(document.createTextNode(text.slice(c, p[0])));
    var m = document.createElement('mark'); m.className = 'hl'; m.textContent = text.slice(p[0], p[1]); frag.appendChild(m); c = p[1];
  });
  if (c < text.length) frag.appendChild(document.createTextNode(text.slice(c)));
  node.textContent = ''; node.appendChild(frag);
}
F.hlNode = function (node, text, rg) {
  if (HL) {
    setText(node, text);
    var tn = node.firstChild; if (!tn) return;
    rg.forEach(function (p) { try { var g = new Range(); g.setStart(tn, p[0]); g.setEnd(tn, Math.min(tn.length, p[1])); HL.add(g); } catch (e) {} });
  } else paintMarks(node, text, rg);
};
function searchCtx() {
  return { lang: store.lang, isPinned: isPinned, frecency: F.frecency,
    isClosed: function (d, v) { return target(d, v).closed; },
    curVariantId: function (d) { var v = F.curVariant(d); return v ? v.id : null; } };
}
F.searchCtx = searchCtx;

var geo = new Map(), geoDirty = true, caretWant = null, caretInstant = false, caretShown = false, caretAnim = null;
function measureGeo() {
  geo.clear();
  for (var i = 0; i < order.length; i++) { var r = order[i]; geo.set(r, { y: r.li.offsetTop + r.link.offsetTop, h: r.link.offsetHeight }); }
  geoDirty = false;
}
var caretAt = null;
function placeCaret() {
  var r = caretWant;
  if (!r) { caretEl.classList.remove('is-visible'); caretShown = false; return; }
  var g = geo.get(r);
  if (!g) return;
  var to = { y: g.y, s: g.h / 100 }, jump = caretInstant || !caretShown || !M.ok(), from = caretAt;
  caretEl.style.setProperty('--caret', r.li.style.getPropertyValue('--pigment'));
  if (caretAnim) {
    if (from && caretAnim.playState === 'running') {
      var pr = caretAnim.effect.getComputedTiming().progress;
      if (typeof pr === 'number') from = { y: from.y0 + (from.y - from.y0) * pr, s: from.s0 + (from.s - from.s0) * pr, y0: 0, s0: 0 };
    }
    caretAnim.cancel(); caretAnim = null;
  }
  var next = 'translate3d(0,' + to.y + 'px,0) scaleY(' + to.s + ')';
  caretEl.style.transform = next;
  if (!jump && from) {
    caretAnim = caretEl.animate([{ transform: 'translate3d(0,' + from.y + 'px,0) scaleY(' + from.s + ')' }, { transform: next }], { duration: 380, easing: M.SPRING });
    caretAt = { y0: from.y, s0: from.s, y: to.y, s: to.s };
  } else caretAt = { y0: to.y, s0: to.s, y: to.y, s: to.s };
  caretEl.classList.add('is-visible'); caretShown = true;
}
function caretTo(r, instant) {
  caretWant = r; caretInstant = !!instant;
  if (!r) { placeCaret(); return; }
  if (geoDirty || !geo.has(r)) M.frame(function () { if (geoDirty || (caretWant && !geo.has(caretWant))) measureGeo(); }, placeCaret);
  else placeCaret();
}
F.recaret = function () { geoDirty = true; if (active) caretTo(active, true); };
if ('ResizeObserver' in window) new ResizeObserver(function () { F.recaret(); }).observe(listEl);

function setActive(r, opts) {
  opts = opts || {};
  if (active && active !== r) { active.li.classList.remove('is-active'); active.link.setAttribute('aria-selected', 'false'); }
  active = r || null;
  if (!active) { seekEl.setAttribute('aria-activedescendant', ''); caretTo(null); return; }
  active.li.classList.add('is-active'); active.link.setAttribute('aria-selected', 'true');
  seekEl.setAttribute('aria-activedescendant', active.link.id);
  caretTo(active, opts.instant);
  if (!opts.noScroll) active.link.scrollIntoView({ block: 'nearest', behavior: M.ok() ? 'smooth' : 'auto' });
  if (!active.cmd) preconnect(target(active.d, active.matchV).url);
  if (!opts.noURL) syncURL();
}
F.setActive = setActive;

var warmed = {};
function preconnect(url) {
  var o; try { o = new URL(url).origin; } catch (e) { return; }
  if (warmed[o] || !F.canFetch) return; warmed[o] = 1;
  var l = document.createElement('link'); l.rel = 'preconnect'; l.href = o; document.head.appendChild(l);
}
F.preconnect = preconnect;
var urlT = null;
function syncURL() {
  clearTimeout(urlT);
  urlT = setTimeout(function () {
    try {
      var p = new URLSearchParams(location.search), q = seekEl.value.trim();
      p.delete('tab');
      if (q) p.set('q', q); else p.delete('q');
      var qs = p.toString();
      history.replaceState(null, '', location.pathname + (qs ? '?' + qs : '') + (active && active.d ? '#' + active.d.id : ''));
    } catch (e) {}
  }, 250);
}

function dayKey(t) { var d = new Date(t), m = d.getMonth() + 1, dd = d.getDate(); return d.getFullYear() + '-' + (m < 10 ? '0' : '') + m + '-' + (dd < 10 ? '0' : '') + dd; }
F.dayKey = dayKey;
function remember(d, v) {
  if (v) store.lastVariant[d.id] = v.id;
  var x = store.visits[d.id] || { n: 0, t: 0 }; x.n = Math.min(x.n + 1, 99); x.t = Date.now();
  var dk = dayKey(x.t), days = x.d || {}, keys;
  days[dk] = (days[dk] || 0) + 1;
  keys = Object.keys(days).sort();
  while (keys.length > 30) delete days[keys.shift()];
  x.d = days; store.visits[d.id] = x;
  F.persist(); F.flush();
}
var committing = false, lastFrom = null;
F.noteVisit = function (r) {
  var tg = target(r.d, r.matchV);
  remember(r.d, tg.v); F.renderTabs(); F.toast(T().newTabToast);
};
function insetFor(rc) {
  var pr = plateEl.getBoundingClientRect();
  return 'inset(' + (rc.top - pr.top) + 'px ' + (pr.right - rc.right) + 'px ' + (pr.bottom - rc.bottom) + 'px ' + (rc.left - pr.left) + 'px round 14px)';
}
var FULL = 'inset(0px 0px 0px 0px round 0px)';
F.openTool = function (r, v, mode, fromEl) {
  var d = r.d, tg = target(d, v || r.matchV);
  if (tg.closed) { F.toast(T().closedToast); return; }
  if (mode !== 'here' && (mode === 'tab' || store.newTab)) { remember(d, tg.v); window.open(tg.url, '_blank', 'noopener'); F.renderTabs(); F.toast(T().newTabToast); return; }
  if (committing) return;
  remember(d, tg.v); committing = true;
  F.closeSheet(true);
  setText(plateTitle, L(d) + (tg.v ? ' — ' + L(tg.v) : ''));
  plateEl.style.setProperty('--plate', d.pig);
  if (!M.ok()) { location.href = tg.url; return; }
  lastFrom = insetFor((fromEl || r.link).getBoundingClientRect());
  var items = Array.prototype.slice.call(listEl.querySelectorAll('.row-link, .band'));
  var pivot = items.indexOf(r.link), st = items.length > 1 ? 110 / (items.length - 1) : 0;
  items.forEach(function (n, i) { n.style.setProperty('--stagger', Math.abs(i - (pivot < 0 ? 0 : pivot)) * st); });
  indexEl.classList.add('is-committing');
  plateFill.style.clipPath = lastFrom;
  plateEl.classList.add('is-live');
  var gone = false, go = function () { if (gone) return; gone = true; location.href = tg.url; };
  var a = plateFill.animate([{ clipPath: lastFrom }, { clipPath: FULL }], { duration: 320, easing: M.EASE_OUT, fill: 'forwards' });
  plateTitle.animate([{ opacity: 0, transform: 'translateY(8px)' }, { opacity: 1, transform: 'none' }], { duration: 240, delay: 120, easing: M.EASE_OUT, fill: 'both' });
  a.finished.then(go, go);
  setTimeout(go, 380);
};
function resetPlate() {
  plateEl.classList.remove('is-live');
  plateFill.getAnimations().forEach(function (a) { a.cancel(); });
  plateTitle.getAnimations().forEach(function (a) { a.cancel(); });
  plateFill.style.clipPath = '';
  indexEl.classList.remove('is-committing');
  listEl.querySelectorAll('.row-link, .band').forEach(function (n) { n.style.removeProperty('--stagger'); });
  committing = false;
}
addEventListener('pageshow', function (e) {
  if (!e.persisted || !lastFrom || !M.ok() || !plateEl.classList.contains('is-live')) { resetPlate(); return; }
  indexEl.classList.remove('is-committing');
  plateTitle.getAnimations().forEach(function (a) { a.cancel(); });
  plateTitle.style.opacity = '0';
  var back = plateFill.animate([{ clipPath: FULL }, { clipPath: lastFrom }], { duration: 260, easing: M.EASE_OUT, fill: 'forwards' });
  var fin = function () { plateTitle.style.opacity = ''; resetPlate(); };
  back.finished.then(fin, fin);
  F.renderTabs(); F.render({ instant: true });
});

F.copyText = function (text, msg) {
  var ok = function () { F.toast(msg || T().copied); };
  var fb = function () {
    var ta = document.createElement('textarea'); ta.value = text; ta.setAttribute('readonly', ''); ta.style.cssText = 'position:fixed;opacity:0';
    document.body.appendChild(ta); ta.select(); try { document.execCommand('copy'); } catch (e) {} ta.remove(); ok();
  };
  if (navigator.clipboard && window.isSecureContext) navigator.clipboard.writeText(text).then(ok, fb); else fb();
};
F.copyUrl = function (r) { F.copyText(target(r.d, r.matchV).url); };
F.togglePin = function (r, silent) {
  var id = r.d.id, i = store.pins.indexOf(id), was = i !== -1;
  if (!was) store.pins.push(id); else store.pins.splice(i, 1);
  F.persist(); F.buzz(); F.renderTabs();
  F.render({});
  if (!silent) F.toast(was ? T().unpinned : T().pinned, T().undo, function () {
    var j = store.pins.indexOf(id);
    if (was && j === -1) store.pins.splice(Math.min(i, store.pins.length), 0, id); else if (!was && j !== -1) store.pins.splice(j, 1);
    F.persist(); F.renderTabs(); F.render({});
  });
};
F.movePin = function (r, dir) {
  var i = store.pins.indexOf(r.d.id), j = i + dir;
  if (i === -1 || j < 0 || j >= store.pins.length) return;
  store.pins.splice(i, 1); store.pins.splice(j, 0, r.d.id); F.persist();
  F.render({});
};
F.cycleVariant = function (r, dir) {
  var d = r.d; if (!d.variants) return;
  var i = d.variants.indexOf(target(d, r.matchV).v), nv = d.variants[(i + dir + d.variants.length) % d.variants.length];
  store.lastVariant[d.id] = nv.id; r.matchV = seekEl.value.trim() ? nv : null; F.persist(); paintRow(r); preconnect(nv.url); F.buzz();
};
F.buzz = function () { try { if (navigator.vibrate) navigator.vibrate(8); } catch (e) {} };

F.themeSwitch = function (fn, origin) {
  if (!document.startViewTransition || !M.ok()) { fn(); return; }
  var rc = origin ? origin.getBoundingClientRect() : { left: innerWidth / 2, top: 0, width: 0, height: 0 };
  var x = rc.left + rc.width / 2, y = rc.top + rc.height / 2;
  var rad = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y));
  var t = document.startViewTransition(fn);
  t.ready.then(function () {
    root.animate({ clipPath: ['circle(0px at ' + x + 'px ' + y + 'px)', 'circle(' + rad + 'px at ' + x + 'px ' + y + 'px)'] }, { duration: 420, easing: M.EASE_OUT, pseudoElement: '::view-transition-new(root)' });
  }, function () {});
};
F.fadeSwap = function (fn) {
  if (!M.ok()) { fn(); return; }
  var out = indexEl.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 120, fill: 'forwards' });
  out.finished.then(function () {
    fn();
    out.cancel();
    indexEl.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 160, easing: 'ease-out' });
  }, function () { fn(); });
};

var toastT = null, toastShown = false, toastAnim = null;
function toastHide() {
  toastShown = false;
  if (toastAnim) { toastAnim.cancel(); toastAnim = null; }
  if (!M.ok()) { toastEl.classList.remove('is-visible'); return; }
  var a = toastAnim = toastBody.animate([{ opacity: 1, transform: 'none' }, { opacity: 0, transform: 'translateY(8px) scale(.98)' }], { duration: 160, fill: 'forwards' });
  a.finished.then(function () { if (toastAnim === a) { toastEl.classList.remove('is-visible'); a.cancel(); toastAnim = null; } }, function () {});
}
F.toast = function (msg, actLabel, actFn, ms) {
  var dur = ms || (actLabel ? 4200 : 1600);
  function build() {
    toastBody.textContent = '';
    el('span', '', toastBody).textContent = msg;
    if (actLabel) {
      var b = el('button', '', toastBody); b.type = 'button'; b.textContent = actLabel;
      b.addEventListener('click', function () { clearTimeout(toastT); toastHide(); actFn(); }, { once: true });
      var bar = el('i', 'toast__bar', toastBody); bar.setAttribute('aria-hidden', 'true');
      if (M.ok()) bar.animate([{ transform: 'scaleX(1)' }, { transform: 'scaleX(0)' }], { duration: dur, easing: 'linear', fill: 'forwards' });
    }
  }
  clearTimeout(toastT);
  if (toastShown && M.ok()) {
    if (toastAnim) { toastAnim.cancel(); toastAnim = null; }
    var o = toastBody.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 80, fill: 'forwards' });
    o.finished.then(function () { build(); o.cancel(); toastBody.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 80 }); }, function () { build(); });
  } else {
    if (toastAnim) { toastAnim.cancel(); toastAnim = null; }
    build();
    toastEl.classList.add('is-visible');
    if (M.ok()) toastAnim = toastBody.animate([{ opacity: 0, transform: 'translateY(16px) scale(.96)' }, { opacity: 1, transform: 'none' }], { duration: 420, easing: M.SPRING });
    toastShown = true;
  }
  toastT = setTimeout(toastHide, dur);
};

F.paintEmpty = function (q) {
  var s = T(), box = $('empty-body'); box.textContent = '';
  el('strong', '', box).textContent = s.empty;
  el('div', '', box).textContent = s.emptyHint;
  if (q && !(F.palette && F.palette.test(q))) {
    var alt = F.swapLayout(q);
    if (alt !== q) {
      var o = F.search(alt, DATA, searchCtx()), hit = o.full.length || o.partial.length;
      if (hit) { var b = el('button', 'empty__btn', box); b.type = 'button'; b.textContent = s.swapTry + ' «' + alt + '»'; b.addEventListener('click', function () { seekEl.value = alt; F.render({ animate: true }); seekEl.focus(); }); return; }
    }
  }
  var c = el('button', 'empty__btn', box); c.type = 'button'; c.textContent = s.clearAll;
  c.addEventListener('click', function () { seekEl.value = ''; store.tab = 'all'; F.renderTabs(); F.render({ animate: true }); seekEl.focus(); });
};

var shelfSig = '';
function shelfCandidates() {
  var ids = [], seen = {};
  function add(id) { var d = BY_ID[id]; if (!d || seen[id] || target(d).closed) return; seen[id] = 1; ids.push(id); }
  store.pins.forEach(add);
  recentIds().sort(function (a, b) { return F.frecency(b) - F.frecency(a); }).forEach(add);
  return ids.slice(0, 6);
}
function renderShelf() {
  var raw = seekEl.value.trim(), want = store.shelf && !raw && store.tab === 'all', ids = want ? shelfCandidates() : [];
  var vis = want && ids.length >= 2;
  if (shelfEl.hidden === vis) shelfEl.hidden = !vis;
  if (!vis) { shelfSig = ''; return; }
  var sig = store.lang + '|' + ids.map(function (id) { var v = F.curVariant(BY_ID[id]); return id + ':' + (v ? v.id : '') + ':' + (isPinned(id) ? 1 : 0); }).join(',');
  if (sig === shelfSig) return;
  shelfSig = sig;
  var s = T();
  setText(shelfTitle, s.shelfTitle); setText(shelfHide, s.shelfHide);
  shelfTrack.textContent = '';
  ids.forEach(function (id) {
    var d = BY_ID[id], tg = target(d), cell = el('div', 'shelf__cell', shelfTrack); cell.setAttribute('role', 'listitem');
    var b = el('button', 'card', cell); b.type = 'button'; b.dataset.id = id; b.style.setProperty('--pigment', d.pig);
    el('span', 'card__sw', b, svg((GMETA[d.group] || {}).icon || 'box')).setAttribute('aria-hidden', 'true');
    if (isPinned(id)) el('span', 'card__pin', b, svg('pinF')).setAttribute('aria-hidden', 'true');
    el('span', 'card__title', b).textContent = L(d);
    var vl = el('span', 'card__v', b); if (tg.v) vl.textContent = L(tg.v); else vl.hidden = true;
    el('span', 'card__host', b).textContent = tg.host;
  });
}
F.renderShelf = function () { shelfSig = ''; renderShelf(); };
})();
