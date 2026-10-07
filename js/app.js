(function () {
'use strict';
var F = window.F, store = F.store, svg = F.svg;
var $ = F.$ = function (id) { return document.getElementById(id); };
var root = document.documentElement, indexEl = $('index'), listEl = $('listbox'), caretEl = $('caret');
var seekEl = $('seek'), seekFieldEl = $('seek-field'), countEl = $('seek-count'), tabsEl = $('tabs');
var liveEl = $('live'), toastEl = $('toast'), toastBody = $('toast-body'), plateEl = $('plate'), plateTitle = $('plate-title');
var reduceMotion = F.reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
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

var DATA = [], BY_ID = {}, GROUPS = [], GMETA = {}, rows = {}, bands = {}, NEW_WINDOW = 21 * 864e5;
F.rows = rows; F.byId = BY_ID;
F.setDoc = function (doc, src) {
  F.doc = doc; F.docSrc = src;
  DATA = F.DATA = doc.tools; GROUPS = doc.groups.map(function (g) { return g.id; });
  GMETA = { pinned: { ar: F.STR.ar.pinnedG, en: F.STR.en.pinnedG, icon: 'pinF' }, recent: { ar: F.STR.ar.recent, en: F.STR.en.recent, icon: 'clock' } };
  doc.groups.forEach(function (g) { GMETA[g.id] = g; });
  Object.keys(BY_ID).forEach(function (k) { delete BY_ID[k]; });
  var now = Date.now();
  DATA.forEach(function (d, i) {
    d.folio = i + 1; BY_ID[d.id] = d; d.pig = 'var(--p-' + d.pigment + ')';
    d.isNew = !!d.since && (now - Date.parse(d.since)) < NEW_WINDOW;
    (d.variants || []).forEach(function (v) { v.host = F.hostOf(v.url); });
    if (d.url) d.host = F.hostOf(d.url);
    d.idx = F.buildIdx(d);
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
F.target = function (d, v) {
  v = v || F.curVariant(d);
  return v ? { url: v.url, host: v.host, v: v, closed: !!(d.closed || v.closed) } : { url: d.url, host: d.host, v: null, closed: !!d.closed };
};
var target = F.target;

function buildRow(d) {
  var li = el('li', 'row'); li.setAttribute('role', 'presentation'); li.dataset.id = d.id; li.style.setProperty('--pigment', d.pig);
  var a = el('div', 'row-link', li); a.id = 'opt-' + d.id; a.setAttribute('role', 'option'); a.setAttribute('aria-selected', 'false');
  var folio = el('span', 'folio', a); el('span', 'mark', a).setAttribute('aria-hidden', 'true');
  var body = el('span', 'body', a), tl = el('span', 'title-line', body);
  var title = el('span', 'title', tl), flag = el('span', 'flag', tl);
  tl.insertAdjacentHTML('beforeend', svg('pinF', 'pinmark'));
  var meta = el('span', 'meta', body), desc = el('span', 'desc', meta), host = el('span', 'host', meta);
  var r = { d: d, li: li, link: a, folio: folio, title: title, flag: flag, desc: desc, host: host, chips: {} };
  if (d.variants) {
    var chips = el('span', 'chips', body); chips.setAttribute('role', 'group');
    d.variants.forEach(function (v) { var c = el('button', 'chip', chips); c.type = 'button'; c.tabIndex = -1; c.dataset.v = v.id; r.chips[v.id] = c; });
  }
  r.more = el('button', 'more', a, svg('more')); r.more.type = 'button'; r.more.tabIndex = -1;
  return r;
}
function buildAll() {
  Object.keys(rows).forEach(function (k) { delete rows[k]; });
  Object.keys(bands).forEach(function (k) { delete bands[k]; });
  ['pinned', 'recent'].concat(GROUPS).forEach(function (g) {
    var b = el('li', 'band'); b.setAttribute('role', 'presentation'); b.dataset.g = g;
    b.innerHTML = svg(GMETA[g].icon, 'band__icon');
    bands[g] = { li: b, text: el('span', 'band__text', b), count: el('span', 'band__count', b) };
  });
  DATA.forEach(function (d) { rows[d.id] = buildRow(d); });
  active = null;
}
F.paintRow = paintRow;
function paintRow(r) {
  var d = r.d, s = T(), tg = target(d, r.matchV);
  r.folio.textContent = num(d.folio, 2);
  r.title.textContent = L(d);
  r.desc.textContent = store.lang === 'ar' ? (tg.v && tg.v.dar) || d.dar : (tg.v && tg.v.den) || d.den;
  r.host.textContent = tg.closed ? '' : tg.host; r.host.hidden = tg.closed;
  r.flag.hidden = !(tg.closed || d.isNew); r.flag.textContent = tg.closed ? s.closed : s.isNew;
  r.flag.classList.toggle('flag--closed', tg.closed);
  r.li.classList.toggle('is-closed', tg.closed);
  r.li.classList.toggle('is-pinned', isPinned(d.id));
  r.more.setAttribute('aria-label', L(d) + ' — ' + s.more);
  r.link.setAttribute('aria-label', L(d) + (tg.v ? ' — ' + L(tg.v) : '') + ' — ' + (tg.closed ? s.closed : tg.host));
  if (d.variants) d.variants.forEach(function (v) {
    var c = r.chips[v.id]; c.textContent = L(v);
    c.setAttribute('aria-current', tg.v === v ? 'true' : 'false');
    c.setAttribute('aria-label', L(d) + ' — ' + L(v));
  });
}

function recentIds() {
  return Object.keys(store.visits).filter(function (id) { return BY_ID[id]; })
    .sort(function (a, b) { return store.visits[b].t - store.visits[a].t; }).slice(0, 8);
}
var TAB_LIST = [];
F.renderTabs = function () {
  var s = T(), list = [{ id: 'all', label: s.all, n: DATA.length }];
  if (store.pins.length) list.push({ id: 'pinned', label: L(GMETA.pinned), n: store.pins.length });
  var rc = recentIds().length; if (rc) list.push({ id: 'recent', label: L(GMETA.recent), n: rc });
  GROUPS.forEach(function (g) { list.push({ id: g, label: L(GMETA[g]), n: DATA.filter(function (d) { return d.group === g; }).length }); });
  if (!list.some(function (x) { return x.id === store.tab; })) store.tab = 'all';
  TAB_LIST = list; tabsEl.textContent = '';
  list.forEach(function (x) {
    var b = el('button', 'tab', tabsEl); b.type = 'button'; b.setAttribute('role', 'tab'); b.dataset.tab = x.id; b.id = 'tab-' + x.id;
    b.setAttribute('aria-selected', x.id === store.tab ? 'true' : 'false'); b.tabIndex = x.id === store.tab ? 0 : -1;
    el('span', '', b).textContent = x.label; el('span', 'tab__n', b).textContent = num(x.n);
  });
};
F.setTab = function (id) {
  if (!TAB_LIST.some(function (x) { return x.id === id; })) return;
  store.tab = id; F.persist();
  tabsEl.querySelectorAll('.tab').forEach(function (t) { var on = t.dataset.tab === id; t.setAttribute('aria-selected', on ? 'true' : 'false'); t.tabIndex = on ? 0 : -1; if (on) t.scrollIntoView({ inline: 'nearest', block: 'nearest', behavior: reduceMotion ? 'auto' : 'smooth' }); });
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

var active = null, order = [];
F.getActive = function () { return active; };
F.order = function () { return order; };
F.render = function (opts) {
  opts = opts || {};
  if (HL) HL.clear();
  var s = T(), q = seekEl.value.trim(), hasQ = q.length > 0, tab = store.tab;
  seekFieldEl.classList.toggle('has-value', seekEl.value.length > 0);
  var rec = recentIds();
  var inTab = function (d) { return tab === 'all' || (tab === 'pinned' ? isPinned(d.id) : tab === 'recent' ? rec.indexOf(d.id) !== -1 : d.group === tab); };
  DATA.forEach(function (d) { rows[d.id].matchV = null; paintRow(rows[d.id]); });
  var seq = [];
  if (hasQ) {
    var qq = F.query(q), res = [];
    DATA.forEach(function (d) { if (!inTab(d)) return; var m = F.match(d, qq); if (m) res.push({ d: d, m: m }); });
    var sc = function (x) { return x.m.w + (isPinned(x.d.id) ? 12 : 0) + F.frecency(x.d.id) * 3 - (x.d.closed ? 30 : 0); };
    res.sort(function (x, y) { return (sc(y) - sc(x)) || x.d.folio - y.d.folio; });
    res.forEach(function (x) { seq.push({ row: rows[x.d.id] }); annotate(x.d, x.m); });
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
  var frag = document.createDocumentFragment(), shown = {}, i = 0, anim = opts.animate && !reduceMotion;
  frag.appendChild(caretEl);
  seq.forEach(function (x) {
    if (x.band) { var b = bands[x.band]; b.text.textContent = L(GMETA[x.band]); b.count.textContent = num(x.n); frag.appendChild(b.li); return; }
    if (anim) { x.row.li.classList.remove('is-entering'); x.row.li.style.setProperty('--i', Math.min(i, 14)); }
    frag.appendChild(x.row.li); shown[x.row.d.id] = 1; i++;
  });
  listEl.textContent = ''; listEl.appendChild(frag);
  if (anim) {
    void listEl.offsetWidth;
    listEl.querySelectorAll('.row').forEach(function (r) { r.classList.add('is-entering'); });
    clearTimeout(F.render.t); F.render.t = setTimeout(function () { listEl.querySelectorAll('.is-entering').forEach(function (r) { r.classList.remove('is-entering'); }); }, 700);
  }
  order = seq.filter(function (x) { return x.row; }).map(function (x) { return x.row; });
  var n = order.length;
  document.body.classList.toggle('is-empty', n === 0);
  if (n === 0) F.paintEmpty(q);
  countEl.textContent = hasQ || tab !== 'all' ? num(n) + ' / ' + num(DATA.length) : num(DATA.length);
  liveEl.textContent = hasQ ? n + ' ' + s.of + ' ' + DATA.length : '';
  var keep = !opts.resetActive && active && shown[active.d.id] ? active : null;
  setActive(keep || (hasQ ? order[0] : null), { noScroll: true, instant: !!opts.instant });
  syncURL();
};
function paintHL(node, text, rg) {
  node.textContent = text;
  if (!rg || !rg.length) return;
  if (HL) { var tn = node.firstChild; rg.forEach(function (p) { try { var r = new Range(); r.setStart(tn, p[0]); r.setEnd(tn, Math.min(tn.length, p[1])); HL.add(r); } catch (e) {} }); return; }
  var frag = document.createDocumentFragment(), c = 0;
  rg.forEach(function (p) {
    if (p[0] > c) frag.appendChild(document.createTextNode(text.slice(c, p[0])));
    var m = document.createElement('mark'); m.className = 'hl'; m.textContent = text.slice(p[0], p[1]); frag.appendChild(m); c = p[1];
  });
  if (c < text.length) frag.appendChild(document.createTextNode(text.slice(c)));
  node.textContent = ''; node.appendChild(frag);
}
function annotate(d, m) {
  var r = rows[d.id], f = m.f, rg = F.ranges(m.hits, m.fr ? f.b.map : f.a.map), lang = store.lang;
  if (f.vid) {
    var v = d.variants.filter(function (x) { return x.id === f.vid; })[0];
    if (v && !v.closed && m.w > 40) { r.matchV = v; paintRow(r); }
    if (f.kind === 'variant' && f.lang === lang) paintHL(r.chips[f.vid], f.raw, rg);
    else if (f.kind === 'desc' && f.lang === lang && r.desc.textContent === f.raw) paintHL(r.desc, f.raw, rg);
    else if (f.kind === 'host' && r.host.textContent === f.raw) paintHL(r.host, f.raw, rg);
    return;
  }
  if (f.kind === 'title' && f.lang === lang) paintHL(r.title, f.raw, rg);
  else if (f.kind === 'desc' && f.lang === lang && r.desc.textContent === f.raw) paintHL(r.desc, f.raw, rg);
  else if (f.kind === 'host' && r.host.textContent === f.raw) paintHL(r.host, f.raw, rg);
}

function setActive(r, opts) {
  opts = opts || {};
  if (active && active !== r) { active.li.classList.remove('is-active'); active.link.setAttribute('aria-selected', 'false'); }
  active = r || null;
  if (!active) { seekEl.setAttribute('aria-activedescendant', ''); caretTo(null); return; }
  active.li.classList.add('is-active'); active.link.setAttribute('aria-selected', 'true');
  seekEl.setAttribute('aria-activedescendant', active.link.id);
  caretTo(active.link, opts.instant);
  if (!opts.noScroll) active.link.scrollIntoView({ block: 'nearest', behavior: reduceMotion ? 'auto' : 'smooth' });
  preconnect(target(active.d, active.matchV).url);
  if (!opts.noURL) syncURL();
}
F.setActive = setActive;
var caretShown = false;
function caretTo(link, instant) {
  if (!link) { caretEl.classList.remove('is-visible'); caretShown = false; return; }
  var jump = instant || !caretShown;
  if (jump) caretEl.classList.add('is-instant');
  caretEl.style.transform = 'translateY(' + (link.parentNode.offsetTop + link.offsetTop) + 'px)';
  caretEl.style.height = link.offsetHeight + 'px';
  caretEl.style.setProperty('--caret', link.parentNode.style.getPropertyValue('--pigment'));
  caretEl.classList.add('is-visible'); caretShown = true;
  if (jump) { void caretEl.offsetWidth; caretEl.classList.remove('is-instant'); }
}
F.recaret = function () { if (active) caretTo(active.link, true); };
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
      if (q) p.set('q', q); else p.delete('q');
      var qs = p.toString();
      history.replaceState(null, '', location.pathname + (qs ? '?' + qs : '') + (active ? '#' + active.d.id : ''));
    } catch (e) {}
  }, 250);
}

function remember(d, v) {
  if (v) store.lastVariant[d.id] = v.id;
  var x = store.visits[d.id] || { n: 0, t: 0 }; x.n = Math.min(x.n + 1, 99); x.t = Date.now(); store.visits[d.id] = x;
  try { localStorage.setItem('fihrist:v4', JSON.stringify(store)); } catch (e) {}
}
var committing = false, lastRect = null;
F.openTool = function (r, v, mode) {
  var d = r.d, tg = target(d, v || r.matchV);
  if (tg.closed) { F.toast(T().closedToast); return; }
  if (mode !== 'here' && (mode === 'tab' || store.newTab)) { remember(d, tg.v); window.open(tg.url, '_blank', 'noopener'); F.renderTabs(); return; }
  if (committing) return;
  remember(d, tg.v); committing = true;
  F.closeSheet(true);
  plateTitle.textContent = L(d) + (tg.v ? ' — ' + L(tg.v) : '');
  plateEl.style.setProperty('--plate', d.pig);
  if (reduceMotion) { location.href = tg.url; return; }
  var rc = r.link.getBoundingClientRect();
  lastRect = 'translate(' + rc.left + 'px,' + rc.top + 'px) scale(' + rc.width / innerWidth + ',' + rc.height / innerHeight + ')';
  var items = Array.prototype.slice.call(listEl.querySelectorAll('.row-link, .band'));
  var pivot = items.indexOf(r.link), st = items.length > 1 ? 110 / (items.length - 1) : 0;
  items.forEach(function (n, i) { n.style.setProperty('--stagger', Math.abs(i - pivot) * st); });
  indexEl.classList.add('is-committing');
  plateEl.classList.add('is-live'); plateEl.style.transition = 'none'; plateEl.style.transform = lastRect;
  void plateEl.offsetWidth;
  requestAnimationFrame(function () {
    plateEl.style.transition = 'transform 300ms var(--pop)'; plateEl.style.transform = 'none'; plateEl.classList.add('is-open');
    var gone = false, go = function () { if (gone) return; gone = true; location.href = tg.url; };
    plateEl.addEventListener('transitionend', go, { once: true }); setTimeout(go, 360);
  });
};
function resetPlate() {
  plateEl.classList.remove('is-live', 'is-open'); plateEl.style.transition = 'none'; plateEl.style.transform = 'none';
  indexEl.classList.remove('is-committing');
  listEl.querySelectorAll('.row-link, .band').forEach(function (n) { n.style.removeProperty('--stagger'); });
  committing = false;
}
addEventListener('pageshow', function (e) {
  if (!e.persisted || !lastRect || reduceMotion || !plateEl.classList.contains('is-live')) { resetPlate(); return; }
  indexEl.classList.remove('is-committing'); plateEl.classList.remove('is-open');
  requestAnimationFrame(function () { plateEl.style.transition = 'transform 260ms var(--ease)'; plateEl.style.transform = lastRect; setTimeout(resetPlate, 280); });
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
  F.withTransition(function () { F.render({}); });
  if (!silent) F.toast(was ? T().unpinned : T().pinned, T().undo, function () {
    var j = store.pins.indexOf(id);
    if (was && j === -1) store.pins.splice(Math.min(i, store.pins.length), 0, id); else if (!was && j !== -1) store.pins.splice(j, 1);
    F.persist(); F.renderTabs(); F.withTransition(function () { F.render({}); });
  });
};
F.movePin = function (r, dir) {
  var i = store.pins.indexOf(r.d.id), j = i + dir;
  if (i === -1 || j < 0 || j >= store.pins.length) return;
  store.pins.splice(i, 1); store.pins.splice(j, 0, r.d.id); F.persist();
  F.withTransition(function () { F.render({}); });
};
F.cycleVariant = function (r, dir) {
  var d = r.d; if (!d.variants) return;
  var i = d.variants.indexOf(target(d, r.matchV).v), nv = d.variants[(i + dir + d.variants.length) % d.variants.length];
  store.lastVariant[d.id] = nv.id; r.matchV = null; F.persist(); paintRow(r); preconnect(nv.url); F.buzz();
};
F.withTransition = function (fn) { if (document.startViewTransition && !reduceMotion) document.startViewTransition(fn); else fn(); };
F.buzz = function () { try { if (navigator.vibrate) navigator.vibrate(8); } catch (e) {} };
var toastT = null;
F.toast = function (msg, actLabel, actFn, ms) {
  toastBody.textContent = '';
  el('span', '', toastBody).textContent = msg;
  if (actLabel) { var b = el('button', '', toastBody); b.type = 'button'; b.textContent = actLabel; b.addEventListener('click', function () { toastEl.classList.remove('is-visible'); actFn(); }, { once: true }); }
  toastEl.classList.add('is-visible');
  clearTimeout(toastT); toastT = setTimeout(function () { toastEl.classList.remove('is-visible'); }, ms || (actLabel ? 4200 : 1600));
};

F.paintEmpty = function (q) {
  var s = T(), box = $('empty-body'); box.textContent = '';
  el('strong', '', box).textContent = s.empty;
  el('div', '', box).textContent = s.emptyHint;
  if (q) {
    var alt = F.swapLayout(q);
    if (alt !== q) {
      var qq = F.query(alt), hit = DATA.some(function (d) { return F.match(d, qq); });
      if (hit) { var b = el('button', 'empty__btn', box); b.type = 'button'; b.textContent = s.swapTry + ' «' + alt + '»'; b.addEventListener('click', function () { seekEl.value = alt; F.render({ animate: true }); seekEl.focus(); }); return; }
    }
  }
  var c = el('button', 'empty__btn', box); c.type = 'button'; c.textContent = s.clearAll;
  c.addEventListener('click', function () { seekEl.value = ''; store.tab = 'all'; F.renderTabs(); F.render({ animate: true }); seekEl.focus(); });
};
})();
