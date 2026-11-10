(function () {
'use strict';
var F = window.F, store = F.store, el = F.el, svg = F.svg, ui = F.ui, IO = F.mineio;
var M = F.mineui = {};

var S = {
  ar: {
    addTitle: 'إضافة رابط', editTitle: 'تعديل الرابط', url: 'الرابط', urlHint: 'https://…  (أو الصق عدة روابط، كل رابط في سطر)', nameAr: 'الاسم بالعربية', nameEn: 'الاسم بالإنجليزية',
    group: 'المجموعة', newGroup: 'مجموعة جديدة…', newGroupName: 'اسم المجموعة', desc: 'الوصف', aliases: 'كلمات البحث (افصل بفاصلة)', pigment: 'اللون', save: 'حفظ', cancel: 'إلغاء',
    urlBad: 'الرابط غير صالح', exists: 'هذا الرابط موجود بالفعل: ', versions: 'هذه الأداة بعدة نسخ. عدّل الروابط من ملف الاستيراد.', bulk: function (n) { return 'تم العثور على ' + n + ' رابط'; },
    previewTitle: 'مراجعة الاستيراد', newN: 'جديد', updatedN: 'محدّث', unchangedN: 'بلا تغيير', skippedN: 'متخطّى', merge: 'دمج', replace: 'استبدال روابطي', mode: 'الأسلوب',
    mergeHint: 'يطابق الروابط، يحدّث الأسماء والأوصاف، ولا يحذف شيئًا.', replaceHint: 'يستبدل كل روابطك الحالية بما في الملف.', confirm: 'تأكيد الاستيراد', confirmReplace: 'تأكيد الاستبدال',
    skipped: 'الصفوف المتخطّاة', sheet: 'ورقة', row: 'صف', first30: 'أول ٣٠ رابطًا', warnings: 'تنبيهات', nothing: 'لم أجد روابط في هذا الملف', imported: function (n) { return 'تم استيراد ' + n + ' رابط'; },
    added: 'تمت الإضافة', saved: 'تم الحفظ', removed: 'تم حذف الرابط', cleared: 'تم حذف كل روابطك', clearTitle: 'حذف كل روابطي', clearBody: 'سيتم حذف كل روابطك الشخصية من هذا الجهاز. لن تتأثر الأدوات المدمجة.', clearGo: 'حذف الكل',
    tooBig: 'روابطك أكبر من الحد المسموح (1.5 ميغابايت)', saveFailed: 'تعذّر الحفظ في هذا المتصفح', importFailed: 'تعذّرت قراءة الملف', undo: 'تراجع', files: 'ملف', reasons: { 'no-url': 'لا يوجد رابط', 'bad-url': 'رابط غير صالح', 'no-url-column': 'لا يوجد عمود للروابط' },
    keyTaken: 'الاختصار مستخدم: ', keyInvalid: 'اختصار غير صالح: ', dup: 'رابط مكرر في الملف', templateDone: 'تم تنزيل القالب', exported: 'تم التصدير', links: 'رابط'
  },
  en: {
    addTitle: 'Add a link', editTitle: 'Edit link', url: 'Link', urlHint: 'https://…  (or paste several links, one per line)', nameAr: 'Arabic name', nameEn: 'English name',
    group: 'Group', newGroup: 'New group…', newGroupName: 'Group name', desc: 'Description', aliases: 'Search words (comma separated)', pigment: 'Colour', save: 'Save', cancel: 'Cancel',
    urlBad: 'That link is not valid', exists: 'This link already exists: ', versions: 'This tool has several versions. Edit its links through an import file.', bulk: function (n) { return n + ' links found'; },
    previewTitle: 'Review import', newN: 'new', updatedN: 'updated', unchangedN: 'unchanged', skippedN: 'skipped', merge: 'Merge', replace: 'Replace my links', mode: 'Mode',
    mergeHint: 'Matches links, updates names and descriptions, deletes nothing.', replaceHint: 'Replaces all your current links with the file.', confirm: 'Confirm import', confirmReplace: 'Confirm replace',
    skipped: 'Skipped rows', sheet: 'Sheet', row: 'Row', first30: 'First 30 links', warnings: 'Warnings', nothing: 'No links found in this file', imported: function (n) { return n + ' links imported'; },
    added: 'Link added', saved: 'Saved', removed: 'Link deleted', cleared: 'All your links were removed', clearTitle: 'Remove all my links', clearBody: 'This deletes every personal link on this device. Built-in tools are not affected.', clearGo: 'Remove all',
    tooBig: 'Your links are over the size limit (1.5 MB)', saveFailed: "Couldn't save in this browser", importFailed: "Couldn't read that file", undo: 'Undo', files: 'file', reasons: { 'no-url': 'No link', 'bad-url': 'Invalid link', 'no-url-column': 'No link column' },
    keyTaken: 'Shortcut already used: ', keyInvalid: 'Invalid shortcut: ', dup: 'Duplicate link in file', templateDone: 'Template downloaded', exported: 'Exported', links: 'links'
  }
};
function T() { return S[store.lang]; }
function toast(msg, undo) { F.toast(msg, undo ? T().undo : null, undo || null, undo ? 8000 : 2400); }

function refresh() { F.onMineExternal(); }
function commit(next, msg) {
  var prev = F.mineRead(), res = F.mineSave(next);
  if (!res.ok) { F.toast(res.reason === 'size' ? T().tooBig : T().saveFailed, null, null, 5000); return false; }
  refresh();
  F.toast(msg, T().undo, function () { F.mineSave(prev); refresh(); }, 8000);
  return true;
}
function builtinKeys() {
  var out = {};
  F.doc.tools.forEach(function (t) { if (t.kbd) out[t.kbd] = 1; });
  return out;
}
function save(name, bytes, mime) {
  var blob = new Blob([bytes], { type: mime }), a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(function () { URL.revokeObjectURL(a.href); }, 2000);
}
function fileLink(href, name) {
  var a = document.createElement('a');
  a.href = href; a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
}
var XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

function field(parent, label, input) {
  var w = el('label', 'fld', parent);
  el('span', 'fld__l', w).textContent = label;
  w.appendChild(input);
  return w;
}
function input(type, value, ph) {
  var i = el('input', 'fld__i'); i.type = type; i.value = value || ''; if (ph) i.placeholder = ph; i.autocomplete = 'off'; i.spellcheck = false;
  return i;
}
function groupsOf(payload) { return payload.groups.slice(); }
function nameOf(t) { return store.lang === 'ar' ? (t.ar || t.en) : (t.en || t.ar); }

function addEdit(id, prefill) {
  var s = T(), payload = F.mineRead(), tool = id ? payload.tools.filter(function (t) { return t.id === id; })[0] : null;
  if (id && !tool) return;
  ui.head(tool ? s.editTitle : s.addTitle, 'FIHRIST', tool ? 'var(--p-' + tool.pigment + ')' : null);
  var body = ui.sheetBody, form = el('div', 'form', body), msg = el('p', 'form__msg', form);
  msg.setAttribute('role', 'alert');
  var urlIn = el('textarea', 'fld__i fld__i--url'); urlIn.rows = 1; urlIn.placeholder = s.urlHint; urlIn.spellcheck = false; urlIn.dir = 'ltr';
  urlIn.value = tool ? (tool.url || '') : (prefill || '');
  var urlF = field(form, s.url, urlIn);
  if (tool && tool.variants) { urlIn.disabled = true; urlIn.value = tool.variants.map(function (v) { return v.url; }).join('\n'); urlIn.rows = Math.min(4, tool.variants.length); el('p', 'form__hint', form).textContent = s.versions; }
  var nameAr = input('text', tool ? tool.ar : '', ''), nameEn = input('text', tool ? tool.en : '', '');
  nameAr.dir = 'rtl'; nameEn.dir = 'ltr';
  var names = el('div', 'form__row', form);
  field(names, s.nameAr, nameAr); field(names, s.nameEn, nameEn);
  var groupSel = el('select', 'fld__i');
  groupsOf(payload).forEach(function (g) { var o = el('option', '', groupSel); o.value = g.id; o.textContent = store.lang === 'ar' ? g.ar : g.en; });
  var defG = IO.defaultGroup();
  if (!payload.groups.some(function (g) { return g.id === defG.id; })) { var d = el('option', '', groupSel); d.value = defG.id; d.textContent = store.lang === 'ar' ? defG.ar : defG.en; }
  var nw = el('option', '', groupSel); nw.value = '__new'; nw.textContent = s.newGroup;
  if (tool) groupSel.value = tool.group;
  var gF = field(form, s.group, groupSel), newName = input('text', '', s.newGroupName); newName.hidden = true; gF.appendChild(newName);
  groupSel.addEventListener('change', function () { newName.hidden = groupSel.value !== '__new'; if (!newName.hidden) newName.focus(); });
  var descIn = input('text', tool ? (store.lang === 'ar' ? tool.dar || tool.den : tool.den || tool.dar) || '' : '', '');
  field(form, s.desc, descIn);
  var aliasIn = input('text', tool && tool.aliases ? tool.aliases.join(', ') : '', '');
  field(form, s.aliases, aliasIn);
  var pig = tool ? tool.pigment : '', sw = el('div', 'sw-row', form), swLab = el('span', 'fld__l', sw); swLab.textContent = s.pigment;
  var swBox = el('div', 'sw-box', sw);
  F.PIGMENTS.forEach(function (p) {
    var b = el('button', 'sw', swBox); b.type = 'button'; b.style.setProperty('--sw', 'var(--p-' + p + ')'); b.setAttribute('aria-label', p);
    b.setAttribute('aria-pressed', String(p === pig));
    b.addEventListener('click', function () { pig = pig === p ? '' : p; Array.prototype.forEach.call(swBox.children, function (c) { c.setAttribute('aria-pressed', String(c === b && pig === p)); }); });
    swBox.appendChild(b);
  });
  var acts = el('div', 'actions', form);
  var go = ui.act(acts, s.save, 'go', submit, 'act--primary');
  ui.act(acts, s.cancel, 'x', function () { F.closeSheet(); });
  function lines() { return urlIn.value.split(/\r?\n/).map(function (x) { return x.trim(); }).filter(Boolean); }
  urlIn.addEventListener('input', function () {
    msg.textContent = '';
    var n = lines().length;
    if (!tool && n > 1) msg.textContent = s.bulk(n);
    urlIn.rows = Math.min(4, Math.max(1, n));
  });
  function submit() {
    var ls = lines();
    if (!tool && ls.length > 1) { bulk(ls); return; }
    var url = tool && tool.variants ? null : IO.fixUrl(ls[0] || '');
    if (!url && !(tool && tool.variants)) { msg.textContent = s.urlBad; urlIn.focus(); return; }
    var next = F.mineRead(), gid, g;
    if (groupSel.value === '__new') {
      var gn = newName.value.trim();
      g = gn ? IO.groupFor(gn) : IO.defaultGroup();
    } else g = next.groups.filter(function (x) { return x.id === groupSel.value; })[0] || IO.defaultGroup();
    if (!next.groups.some(function (x) { return x.id === g.id; })) next.groups.push({ id: g.id, ar: g.ar, en: g.en, icon: 'star' });
    if (url) {
      var clash = next.tools.filter(function (t) { return t.id !== (tool && tool.id) && (t.variants ? t.variants.map(function (v) { return v.url; }) : [t.url]).some(function (u) { return F.normUrl(u) === F.normUrl(url); }); })[0];
      if (clash) { msg.textContent = s.exists + nameOf(clash); return; }
    }
    var host = url ? url : tool.variants[0].url, descV = descIn.value.trim(), arD = /[\u0600-\u06FF]/.test(descV);
    var t = tool ? JSON.parse(JSON.stringify(tool)) : { id: '' };
    t.group = g.id; t.pigment = pig || (tool && tool.pigment) || F.pigmentFor(host);
    t.ar = nameAr.value.trim(); t.en = nameEn.value.trim();
    if (!t.ar && !t.en) t.en = IO.prettyHost(host);
    delete t.dar; delete t.den;
    if (descV) { if (arD) t.dar = descV; else t.den = descV; }
    var al = aliasIn.value.split(/[,;،]/).map(function (x) { return x.trim(); }).filter(Boolean).slice(0, 12);
    if (al.length) t.aliases = al; else delete t.aliases;
    if (url) { t.url = url; delete t.variants; }
    if (!tool) { t.id = F.mineToolId(t.en || t.ar, url); var n = 2, base = t.id; while (next.tools.some(function (x) { return x.id === t.id; })) t.id = base + '-' + n++; next.tools.push(t); }
    else next.tools = next.tools.map(function (x) { return x.id === tool.id ? t : x; });
    next.groups = next.groups.filter(function (x) { return next.tools.some(function (y) { return y.group === x.id; }); });
    F.closeSheet(true);
    commit(next, tool ? s.saved : s.added);
  }
  function bulk(ls) {
    var items = [], g = groupSel.value === '__new' ? (newName.value.trim() ? IO.groupFor(newName.value.trim()) : IO.defaultGroup()) : (payload.groups.filter(function (x) { return x.id === groupSel.value; })[0] || IO.defaultGroup());
    var rows = ls.map(function (ln, i) {
      var toks = ln.split(/\s+/), u = toks.filter(function (x) { return /^(https?:\/\/|[a-z0-9-]+\.[a-z0-9.-]+)/i.test(x); })[0] || '', nm = toks.filter(function (x) { return x !== u; }).join(' ');
      return [u, /[\u0600-\u06FF]/.test(nm) ? nm : '', /[\u0600-\u06FF]/.test(nm) ? '' : nm, g.ar === g.en ? g.en : g.en];
    });
    var sheetRows = [['url', 'name_ar', 'name_en']].concat(rows.map(function (r) { return [r[0], r[1], r[2]]; }));
    var mapped = IO.mapSheets([{ name: store.lang === 'ar' ? g.ar : g.en, hidden: false, rows: sheetRows }]);
    mapped.drafts.forEach(function (d) { d.group = { id: g.id, ar: g.ar, en: g.en, icon: 'star' }; });
    preview(mapped, 'paste');
  }
  ui.show(urlIn);
}

function dot(p) { var d = el('span', 'mini__dot'); d.style.setProperty('--sw', 'var(--p-' + p + ')'); return d; }

function preview(mapped, source) {
  var s = T(), payload = F.mineRead(), taken = builtinKeys(), mode = 'merge', stage = 0;
  function planFor() { return IO.plan(mapped.drafts, payload, mode, taken); }
  function draw() {
    var plan = planFor();
    ui.head(s.previewTitle, source ? String(source) : 'FIHRIST');
    var body = ui.sheetBody, sum = el('p', 'sum', body);
    sum.textContent = plan.new + ' ' + s.newN + ' · ' + plan.updated + ' ' + s.updatedN + ' · ' + plan.unchanged + ' ' + s.unchangedN + ' · ' + mapped.skipped.length + ' ' + s.skippedN;
    var segs = el('div', 'seg-wrap', body);
    ui.seg(segs, s.mode, [['merge', s.merge], ['replace', s.replace]], mode, function (v) { mode = v; stage = 0; draw(); });
    el('p', 'sheet__desc', body).textContent = mode === 'merge' ? s.mergeHint : s.replaceHint;
    var gl = Object.keys(plan.groups).map(function (k) { return plan.groups[k]; });
    if (gl.length) {
      var gb = el('p', 'sum sum--groups', body);
      gb.textContent = gl.map(function (g) { return (store.lang === 'ar' ? g.ar : g.en) + ' ' + g.n; }).join(' · ');
    }
    if (plan.rows.length) {
      el('h3', 'sub', body).textContent = s.first30;
      var list = el('ul', 'mini', body);
      plan.rows.slice(0, 30).forEach(function (r) {
        var li = el('li', 'mini__row mini__row--' + r.status, list);
        li.appendChild(dot(r.tool.pigment));
        el('span', 'mini__name', li).textContent = nameOf(r.tool);
        var u = r.tool.url || (r.tool.variants && r.tool.variants[0].url) || '';
        el('span', 'mini__host', li).textContent = F.hostOf(u) + (r.tool.variants ? ' +' + (r.tool.variants.length - 1) : '');
      });
    }
    var warn = plan.warnings.map(function (w) { return (w.reason === 'key-taken' ? s.keyTaken : s.keyInvalid) + w.value; }).concat(mapped.warnings.map(function () { return s.dup; }));
    if (mapped.warnings.length > 1) warn = warn.filter(function (x, i) { return x !== s.dup || warn.indexOf(x) === i; });
    if (warn.length) { el('h3', 'sub', body).textContent = s.warnings; var wl = el('ul', 'mini', body); warn.slice(0, 20).forEach(function (w) { el('li', 'mini__row', wl).textContent = w; }); }
    if (mapped.skipped.length) {
      el('h3', 'sub', body).textContent = s.skipped;
      var sl = el('ul', 'mini', body);
      mapped.skipped.slice(0, 50).forEach(function (k) { el('li', 'mini__row', sl).textContent = (k.sheet ? s.sheet + ' ' + k.sheet + ' · ' : '') + s.row + ' ' + k.row + ' · ' + (s.reasons[k.reason] || k.reason) + (k.value ? ' (' + k.value + ')' : ''); });
    }
    var acts = el('div', 'actions', body);
    var go = ui.act(acts, mode === 'replace' && stage === 1 ? s.confirmReplace : s.confirm, 'go', function () {
      if (mode === 'replace' && stage === 0) { stage = 1; go.querySelector('span').textContent = s.confirmReplace; go.classList.add('act--danger'); return; }
      if (!plan.rows.length) return;
      F.closeSheet(true);
      commit(plan.payload, s.imported(plan.rows.length));
    }, 'act--primary', null, !plan.rows.length);
    ui.act(acts, s.cancel, 'x', function () { F.closeSheet(); });
  }
  draw();
  ui.show();
}

function readBytes(file, cb) {
  var fr = new FileReader();
  fr.onload = function () { cb(new Uint8Array(fr.result)); };
  fr.onerror = function () { F.toast(T().importFailed, null, null, 4000); };
  fr.readAsArrayBuffer(file);
}
function importFile(file) {
  readBytes(file, function (bytes) {
    var src, mapped;
    try {
      src = IO.sheetsFromBytes(file.name, bytes);
      mapped = src.json ? IO.fromJSON(src.json) : IO.mapSheets(src.sheets);
    } catch (e) { F.toast(T().importFailed + (e && e.message ? ' — ' + e.message : ''), null, null, 4500); return; }
    if (!mapped.count && !mapped.skipped.length) { F.toast(T().nothing, null, null, 4000); return; }
    preview(mapped, file.name);
  });
}
function pickAndImport() {
  var i = document.createElement('input'); i.type = 'file'; i.accept = '.csv,.xlsx,.tsv,.txt,.json,text/csv';
  i.addEventListener('change', function () { if (i.files[0]) importFile(i.files[0]); });
  i.click();
}
function remove(id) {
  var next = F.mineRead(), t = next.tools.filter(function (x) { return x.id === id; })[0];
  if (!t) return;
  next.tools = next.tools.filter(function (x) { return x.id !== id; });
  next.groups = next.groups.filter(function (g) { return next.tools.some(function (y) { return y.group === g.id; }); });
  var pinned = F.store.pins.indexOf(id), wasPinned = pinned !== -1;
  if (wasPinned) { F.store.pins.splice(pinned, 1); F.persist(); }
  var prev = F.mineRead(), res = F.mineSave(next);
  if (!res.ok) { F.toast(T().saveFailed, null, null, 4000); return; }
  refresh();
  F.toast(T().removed, T().undo, function () { F.mineSave(prev); if (wasPinned) { F.store.pins.splice(Math.min(pinned, F.store.pins.length), 0, id); F.persist(); } refresh(); }, 8000);
}
function clearAll() {
  var s = T();
  ui.head(s.clearTitle, 'FIHRIST');
  el('p', 'sheet__desc', ui.sheetBody).textContent = s.clearBody;
  var acts = el('div', 'actions', ui.sheetBody);
  ui.act(acts, s.clearGo, 'erase', function () { F.closeSheet(true); commit(F.mineBlank(), s.cleared); }, 'act--danger');
  ui.act(acts, s.cancel, 'x', function () { F.closeSheet(); });
  ui.show();
}
function exportAs(kind) {
  var p = F.mineRead();
  if (!p.tools.length) return;
  if (kind === 'xlsx') save('fihrist-my-links.xlsx', F.xlsx.write(IO.exportSheets(p)), XLSX_MIME);
  else if (kind === 'csv') save('fihrist-my-links.csv', new TextEncoder().encode(IO.exportCSV(p)), 'text/csv;charset=utf-8');
  else save('fihrist-my-links.json', JSON.stringify(p, null, 2) + '\n', 'application/json');
  toast(T().exported);
}

M.run = function (what, arg) {
  if (what === 'add') addEdit(null, typeof arg === 'string' ? arg : '');
  else if (what === 'edit') addEdit(arg);
  else if (what === 'remove') remove(arg);
  else if (what === 'import') pickAndImport();
  else if (what === 'import-file') importFile(arg);
  else if (what === 'template' || what === 'template-xlsx') { fileLink('templates/fihrist-links-template.xlsx', 'fihrist-links-template.xlsx'); toast(T().templateDone); }
  else if (what === 'template-csv') { fileLink('templates/fihrist-links-template.csv', 'fihrist-links-template.csv'); toast(T().templateDone); }
  else if (what === 'export' || what === 'export-xlsx') exportAs('xlsx');
  else if (what === 'export-csv') exportAs('csv');
  else if (what === 'export-json') exportAs('json');
  else if (what === 'clear') clearAll();
};
M.preview = preview;
M.commit = commit;
})();
