(function () {
'use strict';
var F = window.F, store = F.store, svg = F.svg, el = F.el, $ = F.$, T = F.T, L = F.L, num = F.num, M = F.motion, P = F.palette;
var root = document.documentElement, seekEl = $('seek'), listEl = $('listbox'), shelfTrack = $('shelf-track');
var sheetEl = $('sheet'), sheetPanel = $('sheet-panel'), sheetBody = $('sheet-body'), scrimEl = $('sheet-scrim'), flagEl = $('sheet-flag');
var NS = 'http://www.w3.org/2000/svg';
var sheetRow = null, sheetReturn = null, closing = false;
var PIGS = ['indigo', 'verdigris', 'madder', 'orpiment', 'lapis', 'malachite', 'tyrian', 'bone'];

function mobile() { return innerWidth < 700; }
function act(parent, label, icon, fn, cls, kbd, disabled) {
  var b = el('button', 'act' + (cls ? ' ' + cls : ''), parent, svg(icon, icon === 'go' && root.dir === 'rtl' ? 'flip' : '')); b.type = 'button';
  el('span', '', b).textContent = label;
  if (kbd) el('span', 'kbd', b).textContent = kbd;
  if (disabled) b.disabled = true;
  b.addEventListener('click', fn);
  return b;
}
function tile(parent, label, icon, fn) {
  var b = el('button', 'tile', parent, svg(icon)); b.type = 'button';
  el('span', '', b).textContent = label;
  b.addEventListener('click', fn);
  return b;
}
function head(title, sub, pig, flag) {
  sheetPanel.style.setProperty('--pigment', pig || 'var(--seal)');
  $('sheet-title').textContent = title;
  $('sheet-host').textContent = sub || '';
  flagEl.hidden = !flag; flagEl.textContent = flag || '';
  sheetBody.textContent = '';
}
function slideSegs() {
  sheetBody.querySelectorAll('.seg').forEach(function (g) {
    var ink = g.querySelector('.seg__ink'), cur = g.querySelector('[aria-pressed="true"], [aria-current="true"]');
    M.slide(ink, cur, 'xy');
  });
}
function animateIn() {
  sheetPanel.scrollTop = 0;
  if (!M.ok()) return;
  scrimEl.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 200, easing: 'ease-out' });
  if (mobile()) sheetPanel.animate([{ transform: 'translateY(100%)' }, { transform: 'translateY(0)' }], { duration: 420, easing: M.SPRING });
  else sheetPanel.animate([{ opacity: 0, transform: 'translateY(12px) scale(.97)' }, { opacity: 1, transform: 'none' }], { duration: 280, easing: M.EASE_OUT });
}
function show(focusEl) {
  if (!sheetEl.open) {
    if (!sheetReturn) sheetReturn = document.activeElement;
    closing = false;
    sheetPanel.style.transform = ''; scrimEl.style.opacity = '';
    sheetEl.showModal();
    root.style.overflow = 'hidden';
    animateIn();
  } else sheetPanel.scrollTop = 0;
  slideSegs();
  if (F.canHover) setTimeout(function () { var f = focusEl || sheetBody.querySelector('button:not([disabled])') || sheetPanel; f.focus({ preventScroll: true }); }, 30);
}
function finishClose(silent) {
  if (sheetEl.open) sheetEl.close();
  root.style.overflow = '';
  sheetPanel.style.transform = ''; scrimEl.style.opacity = '';
  closing = false;
  if (!silent && sheetReturn && sheetReturn.focus && F.canHover) sheetReturn.focus({ preventScroll: true });
  sheetRow = null; sheetReturn = null;
}
F.closeSheet = function (silent) {
  if (!sheetEl.open || closing) return;
  if (silent === true || !M.ok()) { finishClose(silent === true); return; }
  closing = true;
  M.cancel(sheetPanel);
  scrimEl.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 160, fill: 'forwards' });
  var a = mobile()
    ? sheetPanel.animate([{ transform: 'translateY(0)' }, { transform: 'translateY(100%)' }], { duration: 160, easing: 'ease-in', fill: 'forwards' })
    : sheetPanel.animate([{ opacity: 1, transform: 'none' }, { opacity: 0, transform: 'translateY(8px) scale(.98)' }], { duration: 160, easing: 'ease-in', fill: 'forwards' });
  a.finished.then(function () { sheetPanel.getAnimations().forEach(function (x) { x.cancel(); }); scrimEl.getAnimations().forEach(function (x) { x.cancel(); }); finishClose(false); }, function () { finishClose(false); });
};
F.sheetOpen = function () { return sheetEl.open; };
sheetEl.addEventListener('cancel', function (e) { e.preventDefault(); F.closeSheet(); });
sheetEl.addEventListener('click', function (e) { if (e.target === sheetEl || e.target === scrimEl) F.closeSheet(); });
sheetEl.addEventListener('keydown', function (e) {
  if (sheetRow && e.key === 'Enter' && !e.target.closest('button')) { e.preventDefault(); F.openTool(sheetRow, null, (e.metaKey || e.ctrlKey) ? 'tab' : 'here'); }
});
sheetEl.addEventListener('close', function () { root.style.overflow = ''; });

(function () {
  var y0 = 0, dy = 0, dragging = false, hist = [], h = 0;
  function paint(x) { sheetPanel.style.transform = 'translateY(' + x + 'px)'; scrimEl.style.opacity = String(Math.max(0, 1 - x / (h || 1))); }
  sheetPanel.addEventListener('pointerdown', function (e) {
    if (!mobile() || e.pointerType === 'mouse' || closing) return;
    if (sheetPanel.scrollTop > 0 && !e.target.closest('.sheet__grip, .sheet__head')) return;
    M.cancel(sheetPanel);
    y0 = e.clientY; dy = 0; dragging = true; h = sheetPanel.offsetHeight; hist = [{ t: performance.now(), y: e.clientY }];
  }, { passive: true });
  addEventListener('pointermove', function (e) {
    if (!dragging) return;
    dy = Math.max(0, e.clientY - y0);
    hist.push({ t: performance.now(), y: e.clientY }); if (hist.length > 6) hist.shift();
    if (dy > 4) paint(dy);
  }, { passive: true });
  function up() {
    if (!dragging) return; dragging = false;
    var a = hist[0], b = hist[hist.length - 1], v = b.t > a.t ? (b.y - a.y) / (b.t - a.t) : 0;
    if (dy > 10) { var eat = function (ev) { ev.stopPropagation(); ev.preventDefault(); }; sheetPanel.addEventListener('click', eat, { capture: true, once: true }); setTimeout(function () { sheetPanel.removeEventListener('click', eat, true); }, 350); }
    if (dy > 120 || v > .5) {
      closing = true;
      M.spring(sheetPanel, dy, h, { velocity: v * 1000, onUpdate: paint, onDone: function () { finishClose(false); } });
    } else if (dy > 0) {
      M.spring(sheetPanel, dy, 0, { velocity: v * 1000, onUpdate: paint, onDone: function () { sheetPanel.style.transform = ''; scrimEl.style.opacity = ''; } });
    }
  }
  addEventListener('pointerup', up); addEventListener('pointercancel', up);
})();

function relTime(t) {
  var d = Math.round((Date.now() - t) / 6e4), rtf;
  try { rtf = new Intl.RelativeTimeFormat(store.lang, { numeric: 'auto' }); } catch (e) { return new Date(t).toLocaleDateString(); }
  if (d < 60) return rtf.format(-d, 'minute');
  if (d < 1440) return rtf.format(-Math.round(d / 60), 'hour');
  return rtf.format(-Math.round(d / 1440), 'day');
}
function spark(d, parent) {
  var x = (store.visits[d.id] || {}).d || {}, now = Date.now(), vals = [], mx = 0, i, v;
  for (i = 13; i >= 0; i--) { v = x[F.dayKey(now - i * 864e5)] || 0; vals.push(v); if (v > mx) mx = v; }
  var wrap = el('span', 'spark', parent), s = document.createElementNS(NS, 'svg'), pl = document.createElementNS(NS, 'polyline');
  s.setAttribute('viewBox', '0 0 120 24'); s.setAttribute('width', '120'); s.setAttribute('height', '24'); s.setAttribute('role', 'img');
  s.setAttribute('aria-label', T().last14 + ': ' + vals.map(function (n) { return num(n); }).join(' '));
  pl.setAttribute('points', vals.map(function (n, k) { return (k * 120 / 13).toFixed(1) + ',' + (22 - (mx ? n / mx * 20 : 0)).toFixed(1); }).join(' '));
  pl.setAttribute('fill', 'none'); pl.setAttribute('stroke', 'currentColor'); pl.setAttribute('stroke-width', '1.6'); pl.setAttribute('stroke-linecap', 'round'); pl.setAttribute('stroke-linejoin', 'round');
  if (!mx) pl.setAttribute('opacity', '.35');
  s.appendChild(pl); wrap.appendChild(s);
  el('small', '', wrap).textContent = T().last14;
}
function toolSheet(r) {
  var d = r.d, s = T(), tg = F.target(d, r.matchV);
  sheetRow = r;
  head(L(d), tg.closed ? s.closed : tg.host, d.pig, tg.closed ? s.closed : (d.isNew ? s.isNew : ''));
  flagEl.classList.toggle('flag--closed', tg.closed);
  var desc = el('p', 'sheet__desc', sheetBody); desc.textContent = store.lang === 'ar' ? d.dar : d.den;
  if (d.variants) {
    el('div', 'sheet__label', sheetBody).textContent = s.versions;
    if (d.variants.length <= 4) {
      var vl = el('div', 'seg seg--v', sheetBody); vl.setAttribute('role', 'group'); vl.setAttribute('aria-label', s.versions);
      el('span', 'seg__ink', vl).setAttribute('aria-hidden', 'true');
      d.variants.forEach(function (v) {
        var b = el('button', 'seg__b' + (v.closed ? ' is-closed' : ''), vl); b.type = 'button';
        b.setAttribute('aria-current', tg.v === v ? 'true' : 'false');
        el('b', '', b).textContent = L(v); el('small', '', b).textContent = v.host;
        b.addEventListener('click', function () { pickVariant(r, v, vl, b); });
        b.addEventListener('dblclick', function () { F.openTool(r, v); });
      });
    } else {
      var grid = el('div', 'variants', sheetBody);
      d.variants.forEach(function (v) {
        var b = el('button', 'sv' + (v.closed ? ' is-closed' : ''), grid); b.type = 'button';
        b.setAttribute('aria-current', tg.v === v ? 'true' : 'false');
        el('b', '', b).textContent = L(v); el('small', '', b).textContent = v.host;
        b.addEventListener('click', function () { pickVariant(r, v, grid, b); });
        b.addEventListener('dblclick', function () { F.openTool(r, v); });
      });
    }
  }
  var acts = el('div', 'actions', sheetBody);
  var first = act(acts, s.open, 'go', function () { F.openTool(r, null, 'here'); }, 'act--primary', '↵', tg.closed);
  var tiles = el('div', 'tiles', sheetBody);
  tile(tiles, s.newTab, 'ext', function () { F.closeSheet(); F.openTool(r, null, 'tab'); }).disabled = tg.closed;
  tile(tiles, F.isPinned(d.id) ? s.unpin : s.pin, 'pin', function () { F.closeSheet(); F.togglePin(r); });
  tile(tiles, s.copy, 'copy', function () { F.closeSheet(); F.copyUrl(r); });
  tile(tiles, s.deep, 'link', function () { F.closeSheet(); F.copyText(location.href.split('#')[0].split('?')[0] + '#' + d.id); });
  if (navigator.share) tile(tiles, s.share, 'share', function () { F.closeSheet(); navigator.share({ title: L(d), url: F.target(d, r.matchV).url }).catch(function () {}); });
  if (F.qr) tile(tiles, s.qr, 'qr', function () { qrView(r); }).disabled = tg.closed;
  var v = store.visits[d.id], st = el('div', 'stat', sheetBody);
  if (v) {
    var t1 = el('span', '', st); t1.append(s.opened + ' '); el('b', '', t1).textContent = num(v.n); t1.append(' ' + s.times);
    var t2 = el('span', '', st); t2.append(s.lastUsed + ' '); el('b', '', t2).textContent = relTime(v.t);
    spark(d, st);
  } else st.textContent = s.never;
  return first;
}
function pickVariant(r, v, group, btn) {
  store.lastVariant[r.d.id] = v.id; r.matchV = seekEl.value.trim() ? v : null; F.persist(); F.paintRow(r); F.buzz();
  group.querySelectorAll('button').forEach(function (x) { x.setAttribute('aria-current', x === btn ? 'true' : 'false'); });
  $('sheet-host').textContent = v.host;
  if (group.classList.contains('seg')) M.slide(group.querySelector('.seg__ink'), btn, 'xy');
}
function qrView(r) {
  var s = T(), tg = F.target(r.d, r.matchV), svgEl = F.qr.svg(tg.url);
  if (!svgEl) { F.toast(s.qrLong); return; }
  head(L(r.d), s.qr, r.d.pig);
  flagEl.hidden = true;
  var back = act(el('div', 'actions actions--back', sheetBody), s.back, 'back', function () { toolSheet(r); slideSegs(); var f = sheetBody.querySelector('.act--primary'); if (f && F.canHover) f.focus({ preventScroll: true }); }, 'act--wide');
  back.classList.toggle('flip-icon', root.dir === 'rtl');
  var box = el('div', 'qr', sheetBody); box.appendChild(svgEl);
  el('p', 'qr__cap', sheetBody).textContent = s.qrScan;
  el('p', 'qr__url', sheetBody).textContent = tg.url;
  sheetPanel.scrollTop = 0;
  if (F.canHover) back.focus({ preventScroll: true });
}
F.openSheet = function (r) {
  if (!sheetEl.open) sheetReturn = document.activeElement;
  var first = toolSheet(r);
  show(F.target(r.d, r.matchV).closed ? null : first);
};

F.openKeys = function () {
  var s = T();
  if (!sheetEl.open) sheetReturn = document.activeElement;
  sheetRow = null;
  head(s.keys, 'FIHRIST · KEYBOARD');
  var dl = el('dl', 'keys', sheetBody);
  s.k.forEach(function (k) {
    var dt = el('dt', '', dl); el('span', 'kbd', dt).textContent = k[0]; if (k[1]) el('span', 'kbd', dt).textContent = k[1];
    el('dd', '', dl).textContent = k[2];
  });
  show();
};
F.openWhatsNew = function () {
  var s = T();
  if (!sheetEl.open) sheetReturn = document.activeElement;
  sheetRow = null;
  head(s.whatsNewTitle, 'FIHRIST · v5.0');
  var ul = el('ul', 'news', sheetBody);
  s.whatsNew.forEach(function (line, i) {
    var li = el('li', '', ul); li.style.setProperty('--pigment', 'var(--p-' + PIGS[(i * 3) % PIGS.length] + ')');
    el('i', '', li).setAttribute('aria-hidden', 'true');
    el('span', '', li).textContent = line;
  });
  show();
};

function seg(parent, label, opts, cur, fn, quiet) {
  if (!quiet) el('div', 'sheet__label', parent).textContent = label;
  var g = el('div', 'seg', parent); g.setAttribute('role', 'group'); g.setAttribute('aria-label', label);
  el('span', 'seg__ink', g).setAttribute('aria-hidden', 'true');
  opts.forEach(function (o) {
    var b = el('button', 'seg__b', g); b.type = 'button'; b.textContent = o[1]; b.setAttribute('aria-pressed', o[0] === cur ? 'true' : 'false');
    b.addEventListener('click', function () {
      g.querySelectorAll('.seg__b').forEach(function (x) { x.setAttribute('aria-pressed', x === b ? 'true' : 'false'); });
      M.slide(g.querySelector('.seg__ink'), b, 'xy');
      fn(o[0]);
    });
  });
}
function card(title) {
  var c = el('section', 'card-group', sheetBody);
  el('h3', 'card-group__t', c).textContent = title;
  return c;
}
function toggle(parent, label, on, fn) {
  var b = el('button', 'tog', parent); b.type = 'button'; b.setAttribute('role', 'switch'); b.setAttribute('aria-checked', on ? 'true' : 'false');
  el('span', '', b).textContent = label; el('i', 'tog__knob', b).setAttribute('aria-hidden', 'true');
  b.addEventListener('click', function () { var nv = b.getAttribute('aria-checked') !== 'true'; b.setAttribute('aria-checked', nv ? 'true' : 'false'); fn(nv); });
  return b;
}
F.openSettings = function () {
  var s = T();
  if (!sheetEl.open) sheetReturn = document.activeElement;
  sheetRow = null;
  head(s.settings, 'FIHRIST · v5.0 · R' + F.doc.revision + ' · ' + s.source[F.docSrc]);
  var a = card(s.appearance);
  seg(a, s.appearance, [['system', s.theme.system], ['light', s.theme.light], ['dark', s.theme.dark]], store.theme, function (v) { A.setTheme(v); }, true);
  seg(a, s.density, [['cozy', s.cozy], ['compact', s.compact]], store.density, function (v) { A.setDensity(v); });
  seg(a, s.motion, [['auto', s.motionAuto], ['reduced', s.motionReduced]], store.motion, function (v) { A.setMotion(v); });
  var b = card(s.behaviour);
  seg(b, s.openIn, [['0', s.sameTab], ['1', s.otherTab]], store.newTab ? '1' : '0', function (v) { A.setOpenIn(v === '1'); });
  var tw = el('div', 'tog-row', b);
  toggle(tw, s.shelfShow, store.shelf, function (v) { store.shelf = v; F.persist(); F.renderShelf(); });
  var c = card(s.data), ca = el('div', 'actions', c); ca.style.marginBlockStart = '0';
  act(ca, s.checkUpdate, 'sync', function () { A.checkUpdate(true); }, 'act--wide', null, !F.canFetch);
  act(ca, s.importFile, 'up', function () { A.importData(); });
  act(ca, s.exportData, 'down', function () { A.exportData(); });
  act(ca, s.resetData, 'reset', function () { A.revertData(); }, 'act--wide', null, F.docSrc === 'seed');
  var e = card(s.prefs), ea = el('div', 'actions', e); ea.style.marginBlockStart = '0';
  act(ea, s.exportPrefs, 'down', function () { A.exportPrefs(); });
  act(ea, s.importPrefs, 'up', function () { A.importPrefs(); });
  act(ea, s.clearHistory, 'erase', function () { A.clearHistory(); }, 'act--wide', null, !Object.keys(store.visits).length);
  if (!F.canFetch) el('p', 'sheet__desc', sheetBody).textContent = s.noHttp;
  show();
};

function download(name, obj) {
  var blob = new Blob([typeof obj === 'string' ? obj : JSON.stringify(obj, null, 2) + '\n'], { type: 'application/json' });
  var a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name;
  document.body.appendChild(a); a.click(); a.remove(); setTimeout(function () { URL.revokeObjectURL(a.href); }, 2000);
}
function pickFile(fn) {
  var i = document.createElement('input'); i.type = 'file'; i.accept = '.json,application/json';
  i.addEventListener('change', function () { if (i.files[0]) readFile(i.files[0], fn); });
  i.click();
}
function readFile(file, fn) {
  var fr = new FileReader();
  fr.onload = function () { var j; try { j = JSON.parse(fr.result); } catch (e) { F.toast(T().badFile + ' — ' + e.message, null, null, 4000); return; } fn(j); };
  fr.readAsText(file);
}
function importDoc(j) {
  if (j && j.format === 'fihrist-prefs/1') { importPrefsData(j); return; }
  var doc; try { doc = F.validate(j); } catch (e) { F.toast(T().badFile + ' — ' + e.message, null, null, 5000); return; }
  F.saveDoc(doc, 'file', true); applyDoc(doc, 'file'); F.closeSheet(true); F.toast(T().imported + ' · ' + num(doc.tools.length) + ' ' + T().tools);
}
function importPrefsData(j) {
  if (!j || j.format !== 'fihrist-prefs/1' || !j.prefs) { importDoc(j); return; }
  var p = j.prefs;
  ['theme', 'lang', 'density', 'tab'].forEach(function (k) { if (typeof p[k] === 'string') store[k] = p[k]; });
  if (typeof p.newTab === 'boolean') store.newTab = p.newTab;
  if (typeof p.shelf === 'boolean') store.shelf = p.shelf;
  if (p.motion === 'auto' || p.motion === 'reduced') store.motion = p.motion;
  if (typeof p.seenWhatsNew === 'string') store.seenWhatsNew = p.seenWhatsNew;
  if (Array.isArray(p.pins)) store.pins = p.pins.filter(function (x) { return typeof x === 'string'; });
  if (p.visits && typeof p.visits === 'object') store.visits = p.visits;
  if (p.lastVariant && typeof p.lastVariant === 'object') store.lastVariant = p.lastVariant;
  F.persist(); F.closeSheet(true); M.apply(); F.refreshAll(); F.toast(T().prefsLoaded);
}
function applyDoc(doc, src) {
  var keep = F.getActive() && F.getActive().d && F.getActive().d.id;
  F.setDoc(doc, src); F.paintChrome();
  F.render({ instant: true });
  if (keep && F.rows[keep] && F.order().indexOf(F.rows[keep]) !== -1) F.setActive(F.rows[keep], { noScroll: true });
}
F.checkUpdate = function (manual) {
  var s = T();
  if (!F.canFetch) { if (manual) F.toast(s.noHttp, null, null, 3500); return; }
  F.fetchRemote().then(function (doc) {
    if (doc.revision > F.doc.revision || (manual && F.docSrc === 'file' && doc.revision >= F.doc.revision)) {
      F.saveDoc(doc, 'remote');
      if (manual) { applyDoc(doc, 'remote'); F.closeSheet(true); F.toast(s.updated + ' ' + num(doc.revision)); }
      else F.toast(s.newData + ' · ' + s.revision + ' ' + num(doc.revision), s.apply, function () { applyDoc(doc, 'remote'); }, 8000);
    } else if (manual) F.toast(s.upToDate);
  }).catch(function (e) { if (manual) F.toast(s.fetchFail + ' — ' + e.message, null, null, 3500); });
};

var A = F.actions = {
  setTheme: function (v) { store.theme = v; F.persist(); F.themeSwitch(F.paintTheme, null); },
  cycleTheme: function () { store.theme = store.theme === 'system' ? 'light' : store.theme === 'light' ? 'dark' : 'system'; F.persist(); F.themeSwitch(F.paintTheme, $('theme-btn')); },
  toggleLang: function () {
    store.lang = store.lang === 'ar' ? 'en' : 'ar';
    if (store.lang === 'en') ensureLatin();
    F.persist(); F.fadeSwap(function () { F.paintChrome(); F.render({ instant: true }); });
  },
  setDensity: function (v) { store.density = v; F.persist(); root.setAttribute('data-density', v); requestAnimationFrame(F.recaret); },
  setMotion: function (v) { store.motion = v; F.persist(); M.apply(); },
  setOpenIn: function (b) { store.newTab = !!b; F.persist(); },
  toggleShelf: function () { store.shelf = !store.shelf; F.persist(); F.renderShelf(); F.toast(store.shelf ? T().shelfShow : T().shelfHidden); },
  checkUpdate: function (m) { F.checkUpdate(m); },
  importData: function () { pickFile(importDoc); },
  exportData: function () { download('fihrist.json', F.serialize(F.doc)); },
  revertData: function () { F.dropDoc(); applyDoc(F.seed, 'seed'); F.toast(T().reset); F.closeSheet(); },
  exportPrefs: function () { download('fihrist-prefs.json', { format: 'fihrist-prefs/1', prefs: store }); F.toast(T().prefsSaved); },
  importPrefs: function () { pickFile(importPrefsData); },
  clearHistory: function () {
    var s = T(), bak = store.visits; store.visits = {}; F.persist(); F.renderTabs(); F.render({});
    F.toast(s.historyCleared, s.undo, function () { store.visits = bak; F.persist(); F.renderTabs(); F.render({}); }); F.closeSheet();
  },
  openKeys: function () { F.openKeys(); },
  openWhatsNew: function () { F.openWhatsNew(); }
};

function rowOf(node) {
  var li = node && node.closest && node.closest('.row');
  if (!li) return null;
  return F.rows[li.dataset.id] || (P && P.row(li.dataset.id)) || null;
}
F.bindPress = function (host, pick, onLong) {
  var press = null;
  host._suppress = false;
  function cancel() { if (!press) return; clearTimeout(press.timer); clearTimeout(press.vis); press.el.classList.remove('is-pressing'); press = null; }
  host.addEventListener('pointerdown', function (e) {
    if (e.button !== 0) return; host._suppress = false;
    var hit = pick(e.target); if (!hit || e.pointerType === 'mouse') return;
    var rc = hit.el.getBoundingClientRect();
    hit.el.style.setProperty('--px', (e.clientX - rc.left) + 'px'); hit.el.style.setProperty('--py', (e.clientY - rc.top) + 'px');
    press = { el: hit.el, x: e.clientX, y: e.clientY, timer: setTimeout(function () { if (!press) return; host._suppress = true; hit.el.classList.remove('is-pressing'); F.buzz(); var p = press; press = null; onLong(hit.obj, p.el); }, 460) };
    press.vis = setTimeout(function () { if (press) hit.el.classList.add('is-pressing'); }, 120);
  }, { passive: true });
  host.addEventListener('pointermove', function (e) { if (press && (Math.abs(e.clientX - press.x) > 9 || Math.abs(e.clientY - press.y) > 9)) cancel(); }, { passive: true });
  host.addEventListener('pointerup', cancel);
  host.addEventListener('pointercancel', cancel);
  addEventListener('scroll', cancel, { passive: true });
  host.addEventListener('contextmenu', function (e) {
    var hit = pick(e.target); if (!hit) return;
    e.preventDefault(); cancel();
    if (!F.sheetOpen()) onLong(hit.obj, hit.el);
  });
};
F.bindPress(listEl, function (t) { var r = rowOf(t); if (!r || r.cmd || t.closest('.more')) return null; return { obj: r, el: r.li }; }, function (r) { F.setActive(r, { noScroll: true }); F.openSheet(r); });
F.bindPress(shelfTrack, function (t) { var c = t.closest('.card'); return c ? { obj: F.rows[c.dataset.id], el: c } : null; }, function (r) { F.openSheet(r); });
listEl.addEventListener('pointerover', function (e) {
  if (e.pointerType !== 'mouse') return;
  var r = rowOf(e.target);
  if (r && !r.cmd) F.preconnect(F.target(r.d, r.matchV).url);
});
listEl.addEventListener('click', function (e) {
  if (listEl._suppress) { listEl._suppress = false; e.preventDefault(); return; }
  var r = rowOf(e.target); if (!r) return;
  if (r.cmd) { e.preventDefault(); F.setActive(r, { noScroll: true }); P.run(r); return; }
  var mod = e.metaKey || e.ctrlKey || e.shiftKey, plain = !e.target.closest('.more, .chip');
  if (mod && plain && r.link.getAttribute('href')) { F.setActive(r, { noScroll: true }); F.noteVisit(r); return; }
  e.preventDefault();
  F.setActive(r, { noScroll: true });
  if (e.target.closest('.more')) { F.openSheet(r); return; }
  var chip = e.target.closest('.chip'), v = null;
  if (chip) v = r.d.variants.filter(function (x) { return x.id === chip.dataset.v; })[0];
  F.openTool(r, v, mod ? 'tab' : null);
});
listEl.addEventListener('auxclick', function (e) {
  if (e.button !== 1) return;
  var r = rowOf(e.target); if (!r || r.cmd) return;
  if (!e.target.closest('.more, .chip') && r.link.getAttribute('href')) { F.noteVisit(r); return; }
  e.preventDefault();
  var ch = e.target.closest('.chip');
  F.openTool(r, ch ? r.d.variants.filter(function (x) { return x.id === ch.dataset.v; })[0] : null, 'tab');
});
shelfTrack.addEventListener('click', function (e) {
  if (shelfTrack._suppress) { shelfTrack._suppress = false; e.preventDefault(); return; }
  var c = e.target.closest('.card'); if (!c) return;
  var r = F.rows[c.dataset.id]; if (!r) return;
  F.openTool(r, null, (e.metaKey || e.ctrlKey || e.shiftKey) ? 'tab' : null, c);
});
shelfTrack.addEventListener('auxclick', function (e) {
  if (e.button !== 1) return;
  var c = e.target.closest('.card'); if (!c || !F.rows[c.dataset.id]) return;
  e.preventDefault(); F.openTool(F.rows[c.dataset.id], null, 'tab');
});
shelfTrack.addEventListener('keydown', function (e) {
  if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
  var cards = Array.prototype.slice.call(shelfTrack.querySelectorAll('.card')), i = cards.indexOf(document.activeElement);
  if (i === -1) return;
  e.preventDefault(); e.stopPropagation();
  var fwd = (e.key === 'ArrowLeft') === (root.dir === 'rtl'), n = cards[Math.min(cards.length - 1, Math.max(0, i + (fwd ? 1 : -1)))];
  n.focus(); n.scrollIntoView({ inline: 'nearest', block: 'nearest', behavior: M.ok() ? 'smooth' : 'auto' });
});
$('shelf-hide').addEventListener('click', function () {
  store.shelf = false; F.persist(); F.renderShelf();
  F.toast(T().shelfHidden, T().undo, function () { store.shelf = true; F.persist(); F.renderShelf(); });
});

function step(dir) {
  var order = F.order(), a = F.getActive(); if (!order.length) return;
  var i = a ? order.indexOf(a) : -1;
  i = i === -1 ? (dir > 0 ? 0 : order.length - 1) : (Math.abs(dir) === 1 ? (i + dir + order.length) % order.length : Math.min(order.length - 1, Math.max(0, i + dir)));
  F.setActive(order[i], {});
}
var folioBuf = '', folioT = null;
function folioKey(k) {
  folioBuf += k; clearTimeout(folioT); folioT = setTimeout(function () { folioBuf = ''; }, 700);
  var d = F.DATA[Number(folioBuf) - 1];
  if (d && F.order().indexOf(F.rows[d.id]) !== -1) F.setActive(F.rows[d.id], {});
}
var composing = false, inputRaf = null;
seekEl.addEventListener('compositionstart', function () { composing = true; });
seekEl.addEventListener('compositionend', function () { composing = false; F.render({ resetActive: true }); });
seekEl.addEventListener('input', function () {
  if (composing) return;
  if (inputRaf) cancelAnimationFrame(inputRaf);
  inputRaf = requestAnimationFrame(function () { inputRaf = null; F.render({ resetActive: true }); });
});
$('seek-clear').addEventListener('click', function (e) { e.preventDefault(); seekEl.value = ''; F.render({ animate: true }); seekEl.focus(); });

var lastPX = 0, lastPY = 0, anchor = null;
root.setAttribute('data-input', 'keys');
addEventListener('pointermove', function (e) {
  if (e.pointerType !== 'mouse') return;
  lastPX = e.clientX; lastPY = e.clientY;
  if (anchor && root.getAttribute('data-input') === 'keys' && Math.hypot(e.clientX - anchor.x, e.clientY - anchor.y) > 4) root.setAttribute('data-input', 'mouse');
}, { passive: true });

addEventListener('keydown', function (e) {
  if (F.sheetOpen() || e.defaultPrevented) return;
  var k = e.key, inSeek = document.activeElement === seekEl, mod = e.metaKey || e.ctrlKey, a = F.getActive();
  if (root.getAttribute('data-input') !== 'keys') root.setAttribute('data-input', 'keys');
  anchor = { x: lastPX, y: lastPY };
  if (e.target.closest && e.target.closest('.controls, .tabs, .foot, .shelf') && (k === 'Enter' || k === ' ')) return;
  if (P.armed()) {
    var hit = !mod && !e.altKey && P.byKbd(k);
    P.disarm();
    if (hit) { e.preventDefault(); F.openTool(F.rows[hit.id], null, e.shiftKey ? 'tab' : null); return; }
  }
  if (mod && (e.code === 'KeyK' || k === 'k')) { e.preventDefault(); seekEl.focus(); seekEl.select(); return; }
  if (e.altKey && !mod) {
    if (e.code === 'KeyP' && a && a.d) { e.preventDefault(); F.togglePin(a); return; }
    if (e.code === 'KeyC' && a && a.d) { e.preventDefault(); F.copyUrl(a); return; }
    if (e.code === 'KeyS') { e.preventDefault(); A.toggleShelf(); return; }
    if (e.code === 'KeyT') { e.preventDefault(); A.cycleTheme(); return; }
    if (e.code === 'KeyL') { e.preventDefault(); A.toggleLang(); return; }
    if (/^Digit[1-9]$/.test(e.code)) { e.preventDefault(); F.tabAt(Number(e.code.slice(5)) - 1); return; }
    if ((k === 'ArrowUp' || k === 'ArrowDown') && a && a.d && F.isPinned(a.d.id) && store.tab === 'pinned') { e.preventDefault(); F.movePin(a, k === 'ArrowUp' ? -1 : 1); return; }
  }
  switch (k) {
    case 'ArrowDown': e.preventDefault(); step(1); return;
    case 'ArrowUp': e.preventDefault(); step(-1); return;
    case 'PageDown': e.preventDefault(); step(5); return;
    case 'PageUp': e.preventDefault(); step(-5); return;
    case 'Home': if (inSeek && seekEl.value) break; e.preventDefault(); if (F.order()[0]) F.setActive(F.order()[0], {}); return;
    case 'End': if (inSeek && seekEl.value) break; e.preventDefault(); if (F.order().length) F.setActive(F.order()[F.order().length - 1], {}); return;
    case 'ArrowLeft': case 'ArrowRight':
      if (a && a.d && a.d.variants && (!inSeek || !seekEl.value || e.altKey)) { e.preventDefault(); F.cycleVariant(a, ((k === 'ArrowLeft') === (root.dir === 'rtl')) ? 1 : -1); }
      return;
    case 'Enter':
      if (!a) { if (F.order().length && (inSeek || F.order().length === 1)) { a = F.order()[0]; F.setActive(a, {}); } else return; }
      e.preventDefault();
      if (a.cmd) { P.run(a); return; }
      if (e.shiftKey) { F.openSheet(a); return; }
      F.openTool(a, null, mod ? 'tab' : null); return;
    case 'Escape':
      if (seekEl.value) { e.preventDefault(); seekEl.value = ''; F.render({ animate: true }); seekEl.focus(); }
      else if (store.tab !== 'all') { e.preventDefault(); F.setTab('all'); }
      else if (a) F.setActive(null);
      else seekEl.blur();
      return;
  }
  if (mod || e.altKey) return;
  if (k === '?' && !inSeek) { e.preventDefault(); F.openKeys(); return; }
  if (k === 'g' && !inSeek && !seekEl.value && P.hasKbd()) { e.preventDefault(); P.arm(); return; }
  if (/^[0-9]$/.test(k) && !seekEl.value) { e.preventDefault(); folioKey(k); return; }
  if (!inSeek && (k === '/' || e.code === 'Slash')) { e.preventDefault(); seekEl.focus(); return; }
  if (!inSeek && k.length === 1 && k !== ' ') seekEl.focus();
});

var themeBtn = $('theme-btn'), langBtn = $('lang-btn'), themeMeta = $('theme-color-meta'), mq = matchMedia('(prefers-color-scheme: dark)');
F.paintTheme = function () {
  root.setAttribute('data-theme', store.theme);
  var dark = store.theme === 'dark' || (store.theme === 'system' && mq.matches);
  themeMeta.setAttribute('content', dark ? '#0d1113' : '#f1f2ec');
  themeBtn.innerHTML = svg(store.theme === 'system' ? 'system' : store.theme === 'dark' ? 'moon' : 'sun');
  el('span', '', themeBtn).textContent = T().theme[store.theme];
  themeBtn.setAttribute('aria-label', T().appearance + ': ' + T().theme[store.theme]);
};
if (mq.addEventListener) mq.addEventListener('change', function () { if (store.theme === 'system') F.paintTheme(); });
themeBtn.addEventListener('click', A.cycleTheme);
var latin = false;
function ensureLatin() {
  if (latin) return; latin = true;
  var href = 'https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght,WONK@9..144,400..620,1&family=Newsreader:opsz,wght@6..72,300..700&display=swap';
  var l = document.createElement('link'); l.rel = 'preload'; l.as = 'style';
  l.onload = function () { l.onload = null; l.rel = 'stylesheet'; };
  l.href = href;
  document.head.appendChild(l);
  var ns = document.createElement('noscript'), nl = document.createElement('link'); nl.rel = 'stylesheet'; nl.href = href; ns.appendChild(nl); document.head.appendChild(ns);
}
F.paintChrome = function () {
  var s = T();
  root.lang = store.lang; root.dir = store.lang === 'ar' ? 'rtl' : 'ltr';
  root.setAttribute('data-density', store.density);
  document.title = store.lang === 'ar' ? 'فهرست — Fihrist' : 'Fihrist — فهرست';
  $('wordmark-text').textContent = s.wordmark;
  $('brand-sub').textContent = (store.lang === 'ar' ? 'FIHRIST' : 'فهرست\u200E') + ' · ' + F.DATA.length + ' TOOLS · R' + F.doc.revision;
  langBtn.textContent = s.lang; langBtn.setAttribute('aria-label', s.lang + ' — ' + s.langAria);
  $('settings-btn').setAttribute('aria-label', s.settings); $('settings-btn').title = s.settings;
  seekEl.placeholder = s.placeholder; seekEl.title = s.cmdHint; $('seek-clear').setAttribute('aria-label', s.clear);
  $('tabs').setAttribute('aria-label', store.lang === 'ar' ? 'التصنيفات' : 'Sections');
  $('foot-keys').textContent = s.keys + ' ?'; $('foot-settings').textContent = s.settings;
  $('foot-data').textContent = 'v5.0 · ' + s.revision + ' ' + F.doc.revision + (F.doc.updated ? ' · ' + F.doc.updated : '') + ' · ' + s.source[F.docSrc];
  $('drop').textContent = s.dropHere;
  F.paintTheme(); F.renderTabs();
};
langBtn.addEventListener('click', A.toggleLang);
$('settings-btn').addEventListener('click', F.openSettings);
$('foot-settings').addEventListener('click', F.openSettings);
$('foot-keys').addEventListener('click', F.openKeys);
F.refreshAll = function () { if (store.lang === 'en') ensureLatin(); F.setDoc(F.doc, F.docSrc); F.paintChrome(); F.render({ instant: true }); };
F.onExternal = function () { if (!F.sheetOpen()) F.refreshAll(); };

var dropEl = $('drop'), dragN = 0;
function hasFile(e) { return e.dataTransfer && Array.prototype.indexOf.call(e.dataTransfer.types || [], 'Files') !== -1; }
addEventListener('dragenter', function (e) { if (!hasFile(e)) return; dragN++; dropEl.classList.add('is-on'); });
addEventListener('dragleave', function () { if (--dragN <= 0) { dragN = 0; dropEl.classList.remove('is-on'); } });
addEventListener('dragover', function (e) { if (hasFile(e)) e.preventDefault(); });
addEventListener('drop', function (e) {
  if (!hasFile(e)) return; e.preventDefault(); dragN = 0; dropEl.classList.remove('is-on');
  var f = e.dataTransfer.files[0]; if (f) readFile(f, importDoc);
});
addEventListener('offline', function () { F.toast(T().offline); });
addEventListener('online', function () { F.toast(T().online); });

if ('IntersectionObserver' in window) new IntersectionObserver(function (en) { $('seek-wrap').classList.toggle('is-stuck', !en[0].isIntersecting); }).observe($('stick-sentinel'));
if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { F.recaret(); F.slideTabs(); });

var init = F.loadInitial();
if (store.lang === 'en') ensureLatin();
F.setDoc(init.doc, init.src);
F.paintChrome();
try {
  var qs0 = new URLSearchParams(location.search), q0 = qs0.get('q'), t0 = qs0.get('tab');
  if (t0 && F.tabList().some(function (x) { return x.id === t0; })) { store.tab = t0; F.renderTabs(); }
  if (q0) seekEl.value = q0;
} catch (e) {}
F.render({ instant: true, animate: M.ok() });
document.body.classList.remove('is-booting');
if (location.hash) { try { var h = F.rows[decodeURIComponent(location.hash.slice(1)).split(':')[0]]; if (h && F.order().indexOf(h) !== -1) F.setActive(h, {}); } catch (e) {} }
if (F.canHover && !location.hash) seekEl.focus({ preventScroll: true });
var idle = window.requestIdleCallback || function (fn) { return setTimeout(fn, 1200); };
idle(function () {
  F.checkUpdate(false);
  if (store.seenWhatsNew !== '5.0') {
    F.toast(T().whatsNewToast, T().see, function () { F.openWhatsNew(); }, 7000);
    store.seenWhatsNew = '5.0'; F.persist();
  }
});
var warmQ = ['d', 'dr', 'par al', 'خا', 'roi', 'qarar 460', 'drug list', 'م'], warmN = 0;
function warmSearch() {
  if (warmN >= warmQ.length * 2) return;
  var q = warmQ[warmN++ % warmQ.length];
  var next = function () { try { F.search(q, F.DATA, F.searchCtx()); } catch (e) {} warmSearch(); };
  if (window.requestIdleCallback) window.requestIdleCallback(next, { timeout: 1500 }); else setTimeout(next, 300);
}
idle(warmSearch);
if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol)) {
  var hadController = !!navigator.serviceWorker.controller, reloaded = false;
  navigator.serviceWorker.addEventListener('controllerchange', function () { if (!hadController || reloaded) return; reloaded = true; location.reload(); });
  window.addEventListener('load', function () {
    navigator.serviceWorker.register('sw.js').then(function (reg) {
      function offer(w) { hadController = true; F.toast(T().swNew, T().reload, function () { w.postMessage({ type: 'SKIP_WAITING' }); }, 12000); }
      if (reg.waiting && navigator.serviceWorker.controller) offer(reg.waiting);
      reg.addEventListener('updatefound', function () {
        var w = reg.installing; if (!w) return;
        w.addEventListener('statechange', function () { if (w.state === 'installed' && navigator.serviceWorker.controller) offer(w); });
      });
    }).catch(function () {});
  });
}
})();
