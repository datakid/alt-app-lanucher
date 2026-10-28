(function () {
'use strict';
var F = window.F, store = F.store, el = F.el, svg = F.svg;
var P = F.palette = {};
var seekEl = F.$('seek'), ghintEl = F.$('ghint');

function A() { return F.actions; }
var KW_THEME = ['theme', 'mazhar', 'appearance', 'mode', 'ثيم', 'مظهر', 'وضع'];
var DEFS = [
  { id: 'theme.system', icon: 'system', kw: KW_THEME.concat(['system', 'auto', 'تلقائي']), cur: function () { return store.theme === 'system'; }, run: function () { A().setTheme('system'); } },
  { id: 'theme.light', icon: 'sun', kw: KW_THEME.concat(['light', 'day', 'fateh', 'فاتح', 'نهاري']), cur: function () { return store.theme === 'light'; }, run: function () { A().setTheme('light'); } },
  { id: 'theme.dark', icon: 'moon', kw: KW_THEME.concat(['dark', 'night', 'dakin', 'داكن', 'ليلي']), cur: function () { return store.theme === 'dark'; }, run: function () { A().setTheme('dark'); } },
  { id: 'lang.toggle', icon: 'globe', kw: ['language', 'lang', 'arabic', 'english', 'logha', 'لغة', 'عربي', 'انجليزي', 'عربية'], kbd: '⌥L', val: function (s) { return store.lang === 'ar' ? s.langName.ar : s.langName.en; }, run: function () { A().toggleLang(); } },
  { id: 'density.cozy', icon: 'dens1', kw: ['density', 'cozy', 'comfortable', 'spacing', 'كثافة', 'مريح'], cur: function () { return store.density === 'cozy'; }, run: function () { A().setDensity('cozy'); } },
  { id: 'density.compact', icon: 'dens2', kw: ['density', 'compact', 'dense', 'small', 'كثافة', 'مضغوط'], cur: function () { return store.density === 'compact'; }, run: function () { A().setDensity('compact'); } },
  { id: 'open.same', icon: 'go', kw: ['open', 'same tab', 'here', 'فتح', 'نفس التبويب'], cur: function () { return !store.newTab; }, run: function () { A().setOpenIn(false); } },
  { id: 'open.new', icon: 'ext', kw: ['open', 'new tab', 'other tab', 'فتح', 'تبويب جديد'], cur: function () { return store.newTab; }, run: function () { A().setOpenIn(true); } },
  { id: 'shelf.toggle', icon: 'shelf', kw: ['today', 'shelf', 'home', 'cards', 'اليوم', 'رف', 'بطاقات'], kbd: '⌥S', val: function (s) { return store.shelf ? s.on : s.off; }, run: function () { A().toggleShelf(); } },
  { id: 'motion.auto', icon: 'motion', kw: ['motion', 'animation', 'auto', 'حركة', 'تلقائي'], cur: function () { return store.motion === 'auto'; }, run: function () { A().setMotion('auto'); } },
  { id: 'motion.reduced', icon: 'motion', kw: ['motion', 'animation', 'reduced', 'reduce', 'calm', 'حركة', 'مخففة', 'بدون حركة'], cur: function () { return store.motion === 'reduced'; }, run: function () { A().setMotion('reduced'); } },
  { id: 'data.check', icon: 'sync', kw: ['update', 'check', 'refresh', 'sync', 'data', 'تحديث', 'بيانات'], disabled: function () { return !F.canFetch; }, run: function () { A().checkUpdate(true); }, quiet: true },
  { id: 'data.import', icon: 'up', kw: ['import', 'load', 'file', 'json', 'data', 'استيراد', 'ملف'], run: function () { A().importData(); }, quiet: true },
  { id: 'data.export', icon: 'down', kw: ['export', 'save', 'download', 'json', 'data', 'تصدير', 'حفظ'], run: function () { A().exportData(); } },
  { id: 'data.revert', icon: 'reset', kw: ['revert', 'reset', 'built-in', 'seed', 'data', 'العودة', 'مدمجة'], disabled: function () { return F.docSrc === 'seed'; }, run: function () { A().revertData(); }, quiet: true },
  { id: 'prefs.export', icon: 'down', kw: ['backup', 'preferences', 'prefs', 'export', 'نسخ احتياطي', 'تفضيلات'], run: function () { A().exportPrefs(); }, quiet: true },
  { id: 'prefs.import', icon: 'up', kw: ['restore', 'preferences', 'prefs', 'import', 'استعادة', 'تفضيلات'], run: function () { A().importPrefs(); }, quiet: true },
  { id: 'history.clear', icon: 'erase', kw: ['history', 'clear', 'usage', 'recent', 'erase', 'سجل', 'مسح'], disabled: function () { return !Object.keys(store.visits).length; }, run: function () { A().clearHistory(); }, quiet: true },
  { id: 'keys.show', icon: 'keys', kw: ['shortcuts', 'keys', 'keyboard', 'help', 'اختصارات', 'مفاتيح'], kbd: '?', run: function () { A().openKeys(); }, quiet: true },
  { id: 'whatsnew.show', icon: 'star', kw: ['new', 'whats new', 'changelog', 'version', 'الجديد', 'إصدار'], run: function () { A().openWhatsNew(); }, quiet: true }
];
var CMDS = null, byId = {}, rowsById = {};

function ensure() {
  if (CMDS) return;
  CMDS = DEFS.map(function (c, i) {
    byId[c.id] = c;
    return { id: c.id, group: 'cmd', ar: F.STR.ar.cmd[c.id], en: F.STR.en.cmd[c.id], dar: '', den: '', aliases: c.kw, folio: i + 1, def: c };
  });
  F.prepare(CMDS, []);
}
var CTX = { isPinned: function () { return false; }, frecency: function () { return 0; }, isClosed: function () { return false; }, curVariantId: function () { return null; } };

function rowFor(c) {
  var r = rowsById[c.id];
  if (r) return r;
  var li = el('li', 'row row--cmd'); li.setAttribute('role', 'presentation'); li.dataset.id = c.id; li.style.setProperty('--pigment', 'var(--seal)');
  var a = el('a', 'row-link', li); a.id = 'opt-' + c.id.replace(/\./g, '-'); a.tabIndex = -1; a.setAttribute('role', 'option'); a.setAttribute('aria-selected', 'false'); a.draggable = false;
  var ic = el('span', 'folio folio--icon', a, svg(c.icon)); ic.setAttribute('aria-hidden', 'true');
  el('span', 'mark', a).setAttribute('aria-hidden', 'true');
  var body = el('span', 'body', a), tl = el('span', 'title-line', body);
  var title = el('span', 'title', tl), kbd = c.kbd ? el('span', 'kbd cmd__kbd', tl) : null;
  if (kbd) kbd.textContent = c.kbd;
  var meta = el('span', 'meta', body), hint = el('span', 'desc cmd__hint', meta);
  r = { cmd: c, id: c.id, li: li, link: a, title: title, hint: hint, jobs: [] };
  li._r = r;
  rowsById[c.id] = r;
  return r;
}
P.row = function (id) { return rowsById[id] || null; };
P.total = function () { return DEFS.length; };
P.test = function (raw) { return raw.charAt(0) === '>'; };

P.seq = function (q) {
  ensure();
  var s = F.T(), lang = store.lang, list, out;
  if (!q) list = CMDS.map(function (d) { return { d: d, marks: [] }; });
  else {
    out = F.search(q, CMDS, { lang: lang, isPinned: CTX.isPinned, frecency: CTX.frecency, isClosed: CTX.isClosed, curVariantId: CTX.curVariantId });
    list = out.full.length ? out.full : out.partial;
  }
  return list.map(function (x) {
    var c = x.d.def, r = rowFor(c), label = F.L(x.d), val = c.val ? c.val(s) : (c.cur && c.cur() ? s.current : ''), off = !!(c.disabled && c.disabled());
    F.setText(r.hint, val);
    r.hint.hidden = !val;
    r.link.setAttribute('aria-disabled', off ? 'true' : 'false');
    r.li.classList.toggle('is-closed', off);
    r.li.classList.toggle('is-current', !!(c.cur && c.cur()));
    r.title.textContent = label;
    var rg = [];
    (x.marks || []).forEach(function (m) { if (m.kind === 'title' && m.lang === lang) m.ranges.forEach(function (p) { rg.push(p); }); });
    if (rg.length) F.hlNode(r.title, label, F.mergeRanges(rg));
    return { row: r };
  });
};

P.run = function (r) {
  var c = r.cmd;
  if (c.disabled && c.disabled()) return;
  c.run();
  seekEl.value = '';
  F.render({ animate: true, resetActive: true });
  if (!c.quiet) F.toast(F.STR[store.lang].cmdDone + ' · ' + F.L({ ar: F.STR.ar.cmd[c.id], en: F.STR.en.cmd[c.id] }));
};

var gUntil = 0, gT = null;
P.hasKbd = function () { return F.DATA.some(function (d) { return !!d.kbd; }); };
P.armed = function () { return Date.now() < gUntil; };
P.arm = function () {
  gUntil = Date.now() + 900;
  F.setText(ghintEl, F.T().gHint);
  ghintEl.hidden = false;
  clearTimeout(gT);
  gT = setTimeout(P.disarm, 900);
};
P.disarm = function () { gUntil = 0; clearTimeout(gT); ghintEl.hidden = true; };
P.byKbd = function (k) {
  var key = String(k).toLowerCase(), i;
  for (i = 0; i < F.DATA.length; i++) if (F.DATA[i].kbd === key) return F.DATA[i];
  return null;
};
})();
