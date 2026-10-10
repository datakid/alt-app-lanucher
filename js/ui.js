(function () {
'use strict';
var F = window.F, store = F.store, svg = F.svg, el = F.el, $ = F.$, T = F.T, L = F.L, num = F.num;
var root = document.documentElement, seekEl = $('seek'), listEl = $('listbox');
var sheetEl = $('sheet'), sheetPanel = $('sheet-panel'), sheetBody = $('sheet-body');
var sheetRow = null, sheetReturn = null;
sheetPanel.tabIndex = -1;

function act(parent, label, icon, fn, cls, kbd, disabled) {
  var b = el('button', 'act' + (cls ? ' ' + cls : ''), parent, svg(icon, icon === 'go' && root.dir === 'rtl' ? 'flip' : '')); b.type = 'button';
  el('span', '', b).textContent = label;
  if (kbd) el('span', 'kbd', b).textContent = kbd;
  if (disabled) b.disabled = true;
  b.addEventListener('click', fn);
  return b;
}
function head(title, sub, pig) {
  sheetPanel.style.setProperty('--pigment', pig || 'var(--seal)');
  $('sheet-title').textContent = title;
  $('sheet-host').textContent = sub || '';
  sheetBody.textContent = '';
}
function show(focusEl) {
  sheetReturn = sheetReturn || document.activeElement;
  sheetEl.setAttribute('aria-hidden', 'false'); sheetPanel.style.removeProperty('--drag'); sheetPanel.scrollTop = 0;
  sheetEl.classList.add('is-open'); document.body.style.overflow = 'hidden';
  if (F.canHover) setTimeout(function () { var f = focusEl || sheetBody.querySelector('button:not([disabled])') || sheetPanel; f.focus({ preventScroll: true }); }, 30);
}
function relTime(t) {
  var d = Math.round((Date.now() - t) / 6e4), rtf;
  try { rtf = new Intl.RelativeTimeFormat(store.lang, { numeric: 'auto' }); } catch (e) { return new Date(t).toLocaleDateString(); }
  if (d < 60) return rtf.format(-d, 'minute');
  if (d < 1440) return rtf.format(-Math.round(d / 60), 'hour');
  return rtf.format(-Math.round(d / 1440), 'day');
}
F.openSheet = function (r) {
  var d = r.d, s = T(), tg = F.target(d, r.matchV);
  sheetRow = r; sheetReturn = document.activeElement;
  head(L(d), tg.closed ? s.closed : tg.host, d.pig);
  var desc = el('p', 'sheet__desc', sheetBody); desc.textContent = store.lang === 'ar' ? d.dar : d.den;
  if (d.variants) {
    el('div', 'sheet__label', sheetBody).textContent = s.versions;
    var vl = el('div', 'variants', sheetBody);
    d.variants.forEach(function (v) {
      var b = el('button', 'sv' + (v.closed ? ' is-closed' : ''), vl); b.type = 'button';
      b.setAttribute('aria-current', tg.v === v ? 'true' : 'false');
      el('b', '', b).textContent = L(v); el('small', '', b).textContent = v.host;
      b.addEventListener('click', function () {
        store.lastVariant[d.id] = v.id; r.matchV = seekEl.value.trim() ? v : null; F.persist(); F.paintRow(r); F.buzz();
        vl.querySelectorAll('.sv').forEach(function (x) { x.setAttribute('aria-current', x === b ? 'true' : 'false'); });
        $('sheet-host').textContent = v.host;
      });
      b.addEventListener('dblclick', function () { F.openTool(r, v); });
    });
  }
  var acts = el('div', 'actions', sheetBody);
  var first = act(acts, s.open, 'go', function () { F.openTool(r, null, 'here'); }, 'act--primary', '↵', tg.closed);
  act(acts, s.newTab, 'ext', function () { F.closeSheet(); F.openTool(r, null, 'tab'); }, '', '⌘↵', tg.closed);
  act(acts, F.isPinned(d.id) ? s.unpin : s.pin, 'pin', function () { F.closeSheet(); F.togglePin(r); }, '', '⌥P');
  act(acts, s.copy, 'copy', function () { F.closeSheet(); F.copyUrl(r); }, '', '⌥C');
  act(acts, s.deep, 'link', function () { F.closeSheet(); F.copyText(location.href.split('#')[0].split('?')[0] + '#' + d.id); });
  if (navigator.share) act(acts, s.share, 'share', function () { F.closeSheet(); navigator.share({ title: L(d), url: F.target(d, r.matchV).url }).catch(function () {}); }, 'act--wide');
  var v = store.visits[d.id], st = el('div', 'stat', sheetBody);
  if (v) { st.innerHTML = '<span>' + s.opened + ' <b></b> ' + s.times + '</span><span>' + s.lastUsed + ' <b></b></span>'; var bs = st.querySelectorAll('b'); bs[0].textContent = num(v.n); bs[1].textContent = relTime(v.t); }
  else st.textContent = s.never;
  show(tg.closed ? null : first);
};
F.closeSheet = function (silent) {
  if (!sheetEl.classList.contains('is-open')) return;
  sheetEl.classList.remove('is-open', 'is-dragging'); sheetEl.setAttribute('aria-hidden', 'true');
  document.body.style.overflow = ''; sheetPanel.style.removeProperty('--drag');
  if (!silent && sheetReturn && sheetReturn.focus && F.canHover) sheetReturn.focus({ preventScroll: true });
  sheetRow = null; sheetReturn = null;
};
F.sheetOpen = function () { return sheetEl.classList.contains('is-open'); };

F.openKeys = function () {
  var s = T(); sheetReturn = document.activeElement;
  head(s.keys, 'FIHRIST · KEYBOARD');
  var dl = el('dl', 'keys', sheetBody);
  s.k.forEach(function (k) {
    var dt = el('dt', '', dl); el('span', 'kbd', dt).textContent = k[0]; if (k[1]) el('span', 'kbd', dt).textContent = k[1];
    el('dd', '', dl).textContent = k[2];
  });
  show();
};

function seg(parent, label, opts, cur, fn) {
  el('div', 'sheet__label', parent).textContent = label;
  var g = el('div', 'seg', parent); g.setAttribute('role', 'group'); g.setAttribute('aria-label', label);
  opts.forEach(function (o) {
    var b = el('button', '', g); b.type = 'button'; b.textContent = o[1]; b.setAttribute('aria-pressed', o[0] === cur ? 'true' : 'false');
    b.addEventListener('click', function () { g.querySelectorAll('button').forEach(function (x) { x.setAttribute('aria-pressed', x === b ? 'true' : 'false'); }); fn(o[0]); });
  });
}
F.openSettings = function () {
  var s = T(); sheetReturn = document.activeElement;
  head(s.settings, 'FIHRIST · v4 · ' + s.revision + ' ' + num(F.doc.revision) + ' · ' + s.source[F.docSrc]);
  seg(sheetBody, s.appearance, [['system', s.theme.system], ['light', s.theme.light], ['dark', s.theme.dark]], store.theme, function (v) { store.theme = v; F.persist(); F.withTransition(F.paintTheme); });
  seg(sheetBody, s.density, [['cozy', s.cozy], ['compact', s.compact]], store.density, function (v) { store.density = v; F.persist(); root.setAttribute('data-density', v); requestAnimationFrame(F.recaret); });
  seg(sheetBody, s.openIn, [['0', s.sameTab], ['1', s.otherTab]], store.newTab ? '1' : '0', function (v) { store.newTab = v === '1'; F.persist(); });
  el('div', 'sheet__label', sheetBody).textContent = s.data;
  var a = el('div', 'actions', sheetBody); a.style.marginBlockStart = '0';
  act(a, s.checkUpdate, 'sync', function () { F.checkUpdate(true); }, 'act--wide', null, !F.canFetch);
  act(a, s.importFile, 'up', function () { pickFile(importDoc); });
  act(a, s.exportData, 'down', function () { download('fihrist.json', F.serialize(F.doc)); });
  act(a, s.resetData, 'reset', function () { F.dropDoc(); applyDoc(F.seed, 'seed'); F.toast(s.reset); F.closeSheet(); }, 'act--wide', null, F.docSrc === 'seed');
  var b = el('div', 'actions', sheetBody);
  act(b, s.exportPrefs, 'down', function () { download('fihrist-prefs.json', { format: 'fihrist-prefs/1', prefs: store }); F.toast(s.prefsSaved); });
  act(b, s.importPrefs, 'up', function () { pickFile(importPrefs); });
  act(b, s.clearHistory, 'erase', function () {
    var bak = store.visits; store.visits = {}; F.persist(); F.renderTabs(); F.render({});
    F.toast(s.historyCleared, s.undo, function () { store.visits = bak; F.persist(); F.renderTabs(); F.render({}); }); F.closeSheet();
  }, 'act--wide', null, !Object.keys(store.visits).length);
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
  if (j && j.format === 'fihrist-prefs/1') { importPrefs(j); return; }
  var doc; try { doc = F.validate(j); } catch (e) { F.toast(T().badFile + ' — ' + e.message, null, null, 5000); return; }
  F.saveDoc(doc, 'file', true); applyDoc(doc, 'file'); F.closeSheet(true); F.toast(T().imported + ' · ' + num(doc.tools.length) + ' ' + T().tools);
}
function importPrefs(j) {
  if (!j || j.format !== 'fihrist-prefs/1' || !j.prefs) { importDoc(j); return; }
  var p = j.prefs;
  ['theme', 'lang', 'density', 'tab'].forEach(function (k) { if (typeof p[k] === 'string') store[k] = p[k]; });
  if (typeof p.newTab === 'boolean') store.newTab = p.newTab;
  if (Array.isArray(p.pins)) store.pins = p.pins.filter(function (x) { return typeof x === 'string'; });
  if (p.visits && typeof p.visits === 'object') store.visits = p.visits;
  if (p.lastVariant && typeof p.lastVariant === 'object') store.lastVariant = p.lastVariant;
  F.persist(); F.closeSheet(true); F.refreshAll(); F.toast(T().prefsLoaded);
}
function applyDoc(doc, src) {
  var keep = F.getActive() && F.getActive().d.id;
  F.setDoc(doc, src); F.paintChrome();
  F.withTransition(function () { F.render({ instant: true }); if (keep && F.rows[keep] && F.order().indexOf(F.rows[keep]) !== -1) F.setActive(F.rows[keep], { noScroll: true }); });
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

$('sheet-scrim').addEventListener('click', function () { F.closeSheet(); });
sheetEl.addEventListener('keydown', function (e) {
  if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); F.closeSheet(); return; }
  if (sheetRow && e.key === 'Enter' && !e.target.closest('button')) { e.preventDefault(); F.openTool(sheetRow, null, (e.metaKey || e.ctrlKey) ? 'tab' : 'here'); return; }
  if (e.key === 'Tab') {
    var f = Array.prototype.slice.call(sheetPanel.querySelectorAll('button:not([disabled])'));
    if (!f.length) return;
    var i = f.indexOf(document.activeElement);
    if (e.shiftKey && i <= 0) { e.preventDefault(); f[f.length - 1].focus(); }
    else if (!e.shiftKey && i === f.length - 1) { e.preventDefault(); f[0].focus(); }
  }
});
(function () {
  var y0 = 0, t0 = 0, dy = 0, dragging = false;
  sheetPanel.addEventListener('pointerdown', function (e) {
    if (innerWidth >= 700 || e.pointerType === 'mouse') return;
    if (sheetPanel.scrollTop > 0 && !e.target.closest('.sheet__grip, .sheet__head')) return;
    y0 = e.clientY; t0 = performance.now(); dy = 0; dragging = true;
  }, { passive: true });
  addEventListener('pointermove', function (e) {
    if (!dragging) return; dy = Math.max(0, e.clientY - y0);
    if (dy > 4) { sheetEl.classList.add('is-dragging'); sheetPanel.style.setProperty('--drag', dy + 'px'); }
  }, { passive: true });
  function up() {
    if (!dragging) return; dragging = false;
    var v = dy / Math.max(1, performance.now() - t0); sheetEl.classList.remove('is-dragging');
    if (dy > 10) { var eat = function (ev) { ev.stopPropagation(); ev.preventDefault(); }; sheetPanel.addEventListener('click', eat, { capture: true, once: true }); setTimeout(function () { sheetPanel.removeEventListener('click', eat, true); }, 350); }
    if (dy > 110 || (v > .6 && dy > 30)) F.closeSheet(); else sheetPanel.style.removeProperty('--drag');
  }
  addEventListener('pointerup', up); addEventListener('pointercancel', up);
})();

function rowOf(node) { var li = node && node.closest && node.closest('.row'); return li ? F.rows[li.dataset.id] : null; }
var press = null, suppressClick = false;
listEl.addEventListener('pointerdown', function (e) {
  if (e.button !== 0) return; suppressClick = false;
  var r = rowOf(e.target); if (!r || e.target.closest('.more') || e.pointerType === 'mouse') return;
  press = { r: r, x: e.clientX, y: e.clientY, timer: setTimeout(function () { if (!press) return; suppressClick = true; r.li.classList.remove('is-pressing'); F.buzz(); F.setActive(r, { noScroll: true }); F.openSheet(r); press = null; }, 460) };
  press.vis = setTimeout(function () { if (press) r.li.classList.add('is-pressing'); }, 120);
}, { passive: true });
function cancelPress() { if (!press) return; clearTimeout(press.timer); clearTimeout(press.vis); press.r.li.classList.remove('is-pressing'); press = null; }
var hoverRaf = null;
listEl.addEventListener('pointermove', function (e) {
  if (press && (Math.abs(e.clientX - press.x) > 9 || Math.abs(e.clientY - press.y) > 9)) cancelPress();
  if (e.pointerType !== 'mouse' || hoverRaf) return;
  var tgt = e.target;
  hoverRaf = requestAnimationFrame(function () { hoverRaf = null; var r = rowOf(tgt); if (r && r !== F.getActive()) F.setActive(r, { noScroll: true, noURL: true }); });
}, { passive: true });
listEl.addEventListener('pointerup', cancelPress);
listEl.addEventListener('pointercancel', cancelPress);
addEventListener('scroll', cancelPress, { passive: true });
listEl.addEventListener('contextmenu', function (e) {
  var r = rowOf(e.target); if (!r) return;
  e.preventDefault(); cancelPress();
  if (!F.sheetOpen()) { F.setActive(r, { noScroll: true }); F.openSheet(r); }
});
listEl.addEventListener('click', function (e) {
  if (suppressClick) { suppressClick = false; e.preventDefault(); return; }
  var r = rowOf(e.target); if (!r) return;
  F.setActive(r, { noScroll: true });
  if (e.target.closest('.more')) { F.openSheet(r); return; }
  var chip = e.target.closest('.chip'), v = null;
  if (chip) v = r.d.variants.filter(function (x) { return x.id === chip.dataset.v; })[0];
  F.openTool(r, v, (e.metaKey || e.ctrlKey || e.shiftKey) ? 'tab' : null);
});
listEl.addEventListener('auxclick', function (e) { if (e.button !== 1) return; var r = rowOf(e.target); if (!r) return; e.preventDefault(); F.openTool(r, null, 'tab'); });

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
seekEl.addEventListener('compositionend', function () { composing = false; F.render({}); });
seekEl.addEventListener('input', function () {
  if (composing) return;
  if (inputRaf) cancelAnimationFrame(inputRaf);
  inputRaf = requestAnimationFrame(function () { inputRaf = null; F.render({}); });
});
$('seek-clear').addEventListener('click', function (e) { e.preventDefault(); seekEl.value = ''; F.render({ animate: true }); seekEl.focus(); });

addEventListener('keydown', function (e) {
  if (F.sheetOpen() || e.defaultPrevented) return;
  var k = e.key, inSeek = document.activeElement === seekEl, mod = e.metaKey || e.ctrlKey, a = F.getActive();
  if (e.target.closest && e.target.closest('.controls, .tabs, .foot') && (k === 'Enter' || k === ' ')) return;
  if (mod && (e.code === 'KeyK' || k === 'k')) { e.preventDefault(); seekEl.focus(); seekEl.select(); return; }
  if (e.altKey && !mod) {
    if (e.code === 'KeyP' && a) { e.preventDefault(); F.togglePin(a); return; }
    if (e.code === 'KeyC' && a) { e.preventDefault(); F.copyUrl(a); return; }
    if (/^Digit[1-9]$/.test(e.code)) { e.preventDefault(); F.tabAt(Number(e.code.slice(5)) - 1); return; }
    if ((k === 'ArrowUp' || k === 'ArrowDown') && a && F.isPinned(a.d.id) && store.tab === 'pinned') { e.preventDefault(); F.movePin(a, k === 'ArrowUp' ? -1 : 1); return; }
  }
  switch (k) {
    case 'ArrowDown': e.preventDefault(); step(1); return;
    case 'ArrowUp': e.preventDefault(); step(-1); return;
    case 'PageDown': e.preventDefault(); step(5); return;
    case 'PageUp': e.preventDefault(); step(-5); return;
    case 'Home': if (inSeek && seekEl.value) break; e.preventDefault(); if (F.order()[0]) F.setActive(F.order()[0], {}); return;
    case 'End': if (inSeek && seekEl.value) break; e.preventDefault(); if (F.order().length) F.setActive(F.order()[F.order().length - 1], {}); return;
    case 'ArrowLeft': case 'ArrowRight':
      if (a && a.d.variants && (!inSeek || !seekEl.value || e.altKey)) { e.preventDefault(); F.cycleVariant(a, ((k === 'ArrowLeft') === (root.dir === 'rtl')) ? 1 : -1); }
      return;
    case 'Enter':
      if (!a) { if (F.order().length && (inSeek || F.order().length === 1)) { a = F.order()[0]; F.setActive(a, {}); } else return; }
      e.preventDefault();
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
  if (/^[0-9]$/.test(k) && !seekEl.value) { e.preventDefault(); folioKey(k); return; }
  if (!inSeek && (k === '/' || e.code === 'Slash')) { e.preventDefault(); seekEl.focus(); return; }
  if (!inSeek && k.length === 1 && k !== ' ') seekEl.focus();
});

var themeBtn = $('theme-btn'), langBtn = $('lang-btn'), themeMeta = $('theme-color-meta'), mq = matchMedia('(prefers-color-scheme: dark)');
F.paintTheme = function () {
  root.setAttribute('data-theme', store.theme);
  var dark = store.theme === 'dark' || (store.theme === 'system' && mq.matches);
  themeMeta.setAttribute('content', dark ? '#0c1114' : '#eceee6');
  themeBtn.innerHTML = svg(store.theme === 'system' ? 'system' : store.theme === 'dark' ? 'moon' : 'sun');
  el('span', '', themeBtn).textContent = T().theme[store.theme];
  themeBtn.setAttribute('aria-label', T().appearance + ': ' + T().theme[store.theme]);
};
if (mq.addEventListener) mq.addEventListener('change', function () { if (store.theme === 'system') F.paintTheme(); });
themeBtn.addEventListener('click', function () { store.theme = store.theme === 'system' ? 'light' : store.theme === 'light' ? 'dark' : 'system'; F.withTransition(F.paintTheme); F.persist(); });
var latin = false;
function ensureLatin() {
  if (latin) return; latin = true;
  var l = document.createElement('link'); l.rel = 'stylesheet';
  l.href = 'https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght,WONK@9..144,400..620,1&family=Newsreader:opsz,wght@6..72,300..700&display=swap';
  document.head.appendChild(l);
}
F.paintChrome = function () {
  var s = T();
  root.lang = store.lang; root.dir = store.lang === 'ar' ? 'rtl' : 'ltr';
  root.setAttribute('data-density', store.density);
  document.title = store.lang === 'ar' ? 'فهرست — Fihrist' : 'Fihrist — فهرست';
  $('wordmark-text').textContent = s.wordmark;
  $('brand-sub').textContent = (store.lang === 'ar' ? 'FIHRIST' : 'فهرست') + ' · ' + F.DATA.length + ' TOOLS · R' + F.doc.revision;
  langBtn.textContent = s.lang; langBtn.setAttribute('aria-label', s.langAria);
  $('settings-btn').setAttribute('aria-label', s.settings); $('settings-btn').title = s.settings;
  seekEl.placeholder = s.placeholder; $('seek-clear').setAttribute('aria-label', s.clear);
  $('tabs').setAttribute('aria-label', store.lang === 'ar' ? 'التصنيفات' : 'Sections');
  $('foot-keys').textContent = s.keys + ' ?'; $('foot-settings').textContent = s.settings;
  $('foot-data').textContent = s.revision + ' ' + F.doc.revision + (F.doc.updated ? ' · ' + F.doc.updated : '') + ' · ' + s.source[F.docSrc];
  $('drop').textContent = s.dropHere;
  F.paintTheme(); F.renderTabs();
};
langBtn.addEventListener('click', function () {
  store.lang = store.lang === 'ar' ? 'en' : 'ar';
  if (store.lang === 'en') ensureLatin();
  F.persist(); F.withTransition(function () { F.paintChrome(); F.render({ instant: true }); });
});
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
if ('ResizeObserver' in window) { var roRaf = null; new ResizeObserver(function () { if (roRaf) return; roRaf = requestAnimationFrame(function () { roRaf = null; F.recaret(); }); }).observe(listEl); }
if (document.fonts && document.fonts.ready) document.fonts.ready.then(F.recaret);

var init = F.loadInitial();
if (store.lang === 'en') ensureLatin();
F.setDoc(init.doc, init.src);
F.paintChrome();
try { var q0 = new URLSearchParams(location.search).get('q'); if (q0) seekEl.value = q0; } catch (e) {}
F.render({ instant: true, animate: !F.reduceMotion });
if (location.hash) { try { var h = F.rows[decodeURIComponent(location.hash.slice(1)).split(':')[0]]; if (h && F.order().indexOf(h) !== -1) F.setActive(h, {}); } catch (e) {} }
if (F.canHover && !location.hash) seekEl.focus({ preventScroll: true });
var idle = window.requestIdleCallback || function (fn) { return setTimeout(fn, 1200); };
idle(function () { F.checkUpdate(false); });
})();
