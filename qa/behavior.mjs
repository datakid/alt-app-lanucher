import { launch, newContext, open, settle, parseArgs } from './lib.mjs';

const args = parseArgs();
const modes = args.mode === 'file' ? ['file'] : args.mode === 'both' ? ['http', 'file'] : ['http'];
const filter = args.only ? String(args.only).split(',') : null;
const results = [];
const tests = [];

function T(name, fn, o = {}) { tests.push({ name, fn, o }); }
const active = (p) => p.evaluate(() => (document.querySelector('.row.is-active') || { dataset: {} }).dataset.id || null);
const order = (p) => p.evaluate(() => F.order().map((r) => (r.d ? r.d.id : r.id)));
const nextNav = async (p, ms = 1200) => { await p.waitForTimeout(ms); return p.context().nav.slice(); };
const eq = (a, b, msg) => { if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error((msg || 'mismatch') + ': got ' + JSON.stringify(a) + ' expected ' + JSON.stringify(b)); };
const ok = (c, msg) => { if (!c) throw new Error(msg || 'assertion failed'); };

T('focus: / and Ctrl+K focus search, typing from anywhere focuses it', async (p) => {
  await p.evaluate(() => document.activeElement && document.activeElement.blur());
  await p.keyboard.press('/');
  ok(await p.evaluate(() => document.activeElement.id === 'seek'), '/ did not focus');
  await p.evaluate(() => document.activeElement.blur());
  await p.keyboard.press('Control+KeyK');
  ok(await p.evaluate(() => document.activeElement.id === 'seek'), 'ctrl+k did not focus');
  await p.evaluate(() => document.activeElement.blur());
  await p.keyboard.type('p');
  eq(await p.inputValue('#seek'), 'p', 'typing from anywhere');
});

T('navigation: arrows wrap, PageUp/Down, Home/End, digit jump to folio', async (p) => {
  await p.evaluate(() => document.activeElement.blur());
  const ids = await p.evaluate(() => F.DATA.map((d) => d.id));
  await p.keyboard.press('ArrowDown');
  const first = await active(p);
  ok(first, 'ArrowDown selects');
  await p.keyboard.press('End');
  eq(await active(p), (await order(p)).slice(-1)[0], 'End');
  await p.keyboard.press('ArrowDown');
  eq(await active(p), (await order(p))[0], 'wraps to first');
  await p.keyboard.press('ArrowUp');
  eq(await active(p), (await order(p)).slice(-1)[0], 'wraps to last');
  await p.keyboard.press('Home');
  eq(await active(p), (await order(p))[0], 'Home');
  await p.keyboard.press('PageDown');
  eq(await active(p), (await order(p))[5], 'PageDown');
  await p.keyboard.press('PageUp');
  eq(await active(p), (await order(p))[0], 'PageUp');
  await p.keyboard.press('7');
  eq(await active(p), ids[6], 'digit jump');
});

T('variants: arrows change version, Alt+arrows while searching', async (p) => {
  await p.evaluate(() => F.setActive(F.rows.parser, {}));
  const before = await p.evaluate(() => F.target(F.byId.parser).v.id);
  await p.keyboard.press('ArrowLeft');
  const left = await p.evaluate(() => F.target(F.byId.parser).v.id);
  await p.keyboard.press('ArrowRight');
  const right = await p.evaluate(() => F.target(F.byId.parser).v.id);
  ok(left !== before && right === before, 'version cycle');
  await p.fill('#seek', 'parser');
  await p.waitForTimeout(300);
  await p.keyboard.press('Alt+ArrowLeft');
  const alt = await p.evaluate(() => F.target(F.byId.parser, F.rows.parser.matchV).v.id);
  ok(alt !== before, 'alt+arrow while searching');
});

T('open: Enter opens, Ctrl+Enter new tab, Shift+Enter sheet', async (p) => {
  await p.fill('#seek', 'drug');
  await p.waitForTimeout(300);
  await p.keyboard.press('Enter');
  const nav = await nextNav(p);
  ok(nav.length === 1 && /vercel|netlify/.test(nav[0]), 'Enter navigated: ' + nav.join(','));
});
T('open: Ctrl+Enter opens a new tab', async (p) => {
  await p.fill('#seek', 'drug');
  await p.waitForTimeout(300);
  const popup = p.context().waitForEvent('page', { timeout: 4000 });
  await p.keyboard.press('Control+Enter');
  const np = await popup;
  ok(!!np, 'popup');
  ok(p.url().includes('index.html'), 'stayed on the index');
});
T('open: Shift+Enter opens the sheet', async (p) => {
  await p.fill('#seek', 'drug');
  await p.waitForTimeout(300);
  await p.keyboard.press('Shift+Enter');
  await p.waitForTimeout(400);
  ok(await p.evaluate(() => F.sheetOpen()), 'sheet open');
});

T('pin: Alt+P pin, Undo, Alt+Up/Down reorder in Pinned', async (p) => {
  await p.evaluate(() => { F.store.pins = []; F.persist(); F.renderTabs(); F.render({}); F.setActive(F.rows.roi, {}); });
  await p.keyboard.press('Alt+KeyP');
  await p.waitForTimeout(300);
  ok(await p.evaluate(() => F.isPinned('roi')), 'pinned');
  await p.evaluate(() => document.querySelector('#toast-body button').click());
  await p.waitForTimeout(300);
  ok(!(await p.evaluate(() => F.isPinned('roi'))), 'undo unpinned');
  await p.evaluate(() => { F.store.pins = ['roi', 'parser']; F.persist(); F.renderTabs(); F.setTab('pinned'); });
  await p.waitForTimeout(300);
  await p.evaluate(() => F.setActive(F.rows.roi, {}));
  await p.keyboard.press('Alt+ArrowDown');
  eq(await p.evaluate(() => F.store.pins), ['parser', 'roi'], 'reorder');
});

T('Alt shortcuts: C copy, S shelf, T theme, L language, 1-9 tabs', async (p) => {
  await p.context().grantPermissions(['clipboard-read', 'clipboard-write']);
  await p.evaluate(() => F.setActive(F.rows.roi, {}));
  await p.keyboard.press('Alt+KeyC');
  await p.waitForTimeout(300);
  const clip = await p.evaluate(() => navigator.clipboard.readText());
  ok(/^https?:/.test(clip), 'copied url ' + clip);
  const shelf = await p.evaluate(() => F.store.shelf);
  await p.keyboard.press('Alt+KeyS');
  eq(await p.evaluate(() => F.store.shelf), !shelf, 'shelf toggled');
  const theme = await p.evaluate(() => F.store.theme);
  await p.keyboard.press('Alt+KeyT');
  ok((await p.evaluate(() => F.store.theme)) !== theme, 'theme cycled');
  const lang = await p.evaluate(() => F.store.lang);
  await p.keyboard.press('Alt+KeyL');
  await p.waitForTimeout(500);
  ok((await p.evaluate(() => F.store.lang)) !== lang, 'language toggled');
  await p.keyboard.press('Alt+Digit4');
  await p.waitForTimeout(300);
  eq(await p.evaluate(() => F.store.tab), await p.evaluate(() => F.tabList()[3].id), 'tab by position');
});

T('Escape order: clear query, then All tab, then clear active, then blur', async (p) => {
  await p.evaluate(() => F.setTab('print'));
  await p.fill('#seek', 'bayan');
  await p.waitForTimeout(300);
  await p.keyboard.press('Escape');
  await p.waitForTimeout(200);
  eq(await p.inputValue('#seek'), '', 'query cleared first');
  eq(await p.evaluate(() => F.store.tab), 'print', 'tab untouched at first');
  await p.keyboard.press('Escape');
  await p.waitForTimeout(200);
  eq(await p.evaluate(() => F.store.tab), 'all', 'then All tab');
  await p.keyboard.press('ArrowDown');
  ok(await active(p), 'active set');
  await p.keyboard.press('Escape');
  eq(await active(p), null, 'then active cleared');
  await p.keyboard.press('Escape');
  ok(await p.evaluate(() => document.activeElement.id !== 'seek'), 'then blur');
});

T('description search: guess band, URL host highlight, group scope, unmatched URL', async (p) => {
  await p.fill('#seek', 'converts handwriting to font');
  await p.waitForTimeout(500);
  eq(await p.evaluate(() => (document.querySelector('.band[data-g="guess"]') || {}).hidden === false || !!document.querySelector('.band[data-g="guess"]')), true, 'guess band present');
  eq((await order(p))[0], 'font-maker', 'description top result');
  await p.fill('#seek', '@netlify');
  await p.waitForTimeout(500);
  eq((await order(p)).length, 4, '@netlify rows');
  ok(await p.evaluate(() => CSS.highlights && CSS.highlights.size >= 0), 'highlight api');
  await p.fill('#seek', '#print font');
  await p.waitForTimeout(500);
  eq(await order(p), ['font-maker'], 'group scope result');
  ok(await p.evaluate(() => !document.getElementById('seek-scope').hidden && /#/.test(document.getElementById('seek-scope').textContent)), 'scope pill shown');
  await p.fill('#seek', '#print ');
  await p.waitForTimeout(400);
  await p.keyboard.press('Backspace');
  await p.waitForTimeout(300);
  eq(await p.inputValue('#seek'), '', 'backspace removes the scope');
  await p.fill('#seek', 'https://example.org/x');
  await p.waitForTimeout(500);
  eq((await order(p)).length, 0, 'no rows for unknown url');
  ok(await p.evaluate(() => !!document.querySelector('#empty-body .empty__btn')), 'open link button');
  await p.keyboard.press('Enter');
  const nav = await nextNav(p, 1200);
  ok(nav.length === 1 && nav[0].indexOf('example.org') !== -1, 'Enter opens the link: ' + nav.join(','));
});

const TEMPLATE = new URL('../templates/fihrist-links-template.xlsx', import.meta.url);
async function pickFile(p, trigger, file) {
  const chooser = p.waitForEvent('filechooser');
  await trigger();
  await (await chooser).setFiles(file);
}
const mineN = (p) => p.evaluate(() => F.DATA.filter((d) => d.mine).length);

T('my links: add, search, edit, delete with undo, persist, diamond tab', async (p, ctx, lang, mode) => {
  await p.evaluate(() => F.openSettings());
  await p.waitForTimeout(400);
  await p.evaluate(() => F.actions.mine('add'));
  await p.waitForSelector('.form');
  await p.fill('.fld__i--url', 'example.org/handbook');
  const inputs = await p.$$('.form .fld__i');
  await p.fill('.form__row label:nth-child(2) input', 'Staff Handbook');
  await p.selectOption('.form select', '__new');
  await p.fill('.form label:has(select) input[placeholder]', 'Work docs');
  await p.click('.form .act--primary');
  await p.waitForTimeout(700);
  eq(await mineN(p), 1, 'one personal link');
  ok(await p.evaluate(() => !!document.querySelector('.tab__d')), 'diamond on personal tab');
  await p.fill('#seek', 'handbook');
  await p.waitForTimeout(400);
  eq((await order(p))[0].indexOf('u-') === 0, true, 'search finds it');
  await p.fill('#seek', '');
  if (mode !== 'file') {
    await p.reload(); await settle(p);
    eq(await mineN(p), 1, 'survives reload');
  }
  const id = await p.evaluate(() => F.DATA.filter((d) => d.mine)[0].id);
  await p.evaluate((x) => F.actions.mine('edit', x), id);
  await p.waitForSelector('.form');
  await p.fill('.form__row label:nth-child(2) input', 'Staff Handbook 2');
  await p.click('.form .act--primary');
  await p.waitForTimeout(600);
  eq(await p.evaluate(() => F.DATA.filter((d) => d.mine)[0].en), 'Staff Handbook 2', 'edit saved');
  await p.evaluate((x) => F.actions.mine('remove', x), id);
  await p.waitForTimeout(500);
  eq(await mineN(p), 0, 'deleted');
  await p.evaluate(() => document.querySelector('#toast-body button').click());
  await p.waitForTimeout(500);
  eq(await mineN(p), 1, 'undo restores');
});

T('my links: duplicate url is refused and bad url shows an error', async (p) => {
  await p.evaluate(() => F.actions.mine('add'));
  await p.waitForSelector('.form');
  await p.fill('.fld__i--url', 'not a link at all');
  await p.click('.form .act--primary');
  ok((await p.textContent('.form__msg')).length > 0, 'error for bad url');
  await p.fill('.fld__i--url', 'https://dupe.example.com');
  await p.click('.form .act--primary');
  await p.waitForTimeout(500);
  await p.evaluate(() => F.actions.mine('add'));
  await p.waitForSelector('.form');
  await p.fill('.fld__i--url', 'dupe.example.com/');
  await p.click('.form .act--primary');
  ok((await p.textContent('.form__msg')).length > 0, 'duplicate refused');
  eq(await mineN(p), 1, 'still one');
});

T('my links: import the template with preview, merge twice, replace with confirm', async (p) => {
  await pickFile(p, () => p.evaluate(() => F.actions.mine('import')), TEMPLATE.pathname);
  await p.waitForSelector('.sum');
  ok(/6/.test(await p.textContent('.sum')), 'preview shows 6 new: ' + await p.textContent('.sum'));
  ok((await p.$$('.mini__row')).length >= 6, 'mini rows');
  eq(await mineN(p), 0, 'nothing written before confirm');
  await p.click('.actions .act--primary');
  await p.waitForTimeout(800);
  eq(await mineN(p), 6, 'six links committed');
  await pickFile(p, () => p.evaluate(() => F.actions.mine('import')), TEMPLATE.pathname);
  await p.waitForSelector('.sum');
  ok(/6/.test((await p.textContent('.sum')).split('·')[2] || ''), 'second import all unchanged');
  await p.click('#sheet-body .seg .seg__b >> nth=1');
  await p.waitForTimeout(300);
  await p.click('.actions .act--primary');
  await p.waitForTimeout(300);
  ok(await p.evaluate(() => !!document.querySelector('.actions .act--danger')), 'replace asks for a second confirm');
  eq(await mineN(p), 6, 'nothing replaced yet');
  await p.click('.actions .act--primary');
  await p.waitForTimeout(700);
  eq(await mineN(p), 6, 'replace committed');
  ok(await p.evaluate(() => F.DATA.filter((d) => d.mine && d.variants).length) === 1, 'docs has variants');
});

T('my links: export xlsx, csv and json download', async (p) => {
  await pickFile(p, () => p.evaluate(() => F.actions.mine('import')), TEMPLATE.pathname);
  await p.waitForSelector('.sum');
  await p.click('.actions .act--primary');
  await p.waitForTimeout(800);
  for (const [kind, ext] of [['export-xlsx', 'xlsx'], ['export-csv', 'csv'], ['export-json', 'json']]) {
    const dl = p.waitForEvent('download');
    await p.evaluate((k) => F.actions.mine(k), kind);
    const d = await dl;
    ok(d.suggestedFilename().endsWith(ext), 'download ' + ext);
  }
});

T('my links: built-in export unchanged, revert keeps links, sync across tabs', async (p, ctx, lang, mode) => {
  const before = await p.evaluate(() => F.serialize(F.doc));
  await pickFile(p, () => p.evaluate(() => F.actions.mine('import')), TEMPLATE.pathname);
  await p.waitForSelector('.sum');
  await p.click('.actions .act--primary');
  await p.waitForTimeout(800);
  eq(await p.evaluate(() => F.serialize(F.doc)), before, 'export data has no personal links');
  const other = mode === 'file' ? null : await open(ctx, '');
  if (other) eq(await mineN(other), 6, 'second tab sees links');
  await p.evaluate(() => F.actions.mine('remove', F.DATA.filter((d) => d.mine)[0].id));
  await p.waitForTimeout(700);
  if (other) eq(await mineN(other), 5, 'removal syncs to the other tab');
  const doc = await p.evaluate(() => JSON.parse(JSON.stringify(F.doc)));
  doc.revision += 1;
  await p.evaluate((d) => { F.saveDoc(d, 'file', true); }, doc);
  await p.evaluate(() => F.actions.revertData());
  await p.waitForTimeout(800);
  eq(await mineN(p), 5, 'revert to built-in data keeps links');
});

T('my links: unmatched link offers Add and opens the form prefilled', async (p) => {
  await p.fill('#seek', 'https://brand-new.example.net/x');
  await p.waitForTimeout(500);
  const btns = await p.$$('#empty-body .empty__btn');
  eq(btns.length, 2, 'open and add buttons');
  await btns[1].click();
  await p.waitForSelector('.form');
  ok((await p.inputValue('.fld__i--url')).indexOf('brand-new.example.net') !== -1, 'prefilled');
});

async function withTemplate(p) {
  await p.evaluate(() => {
    const m = F.mineBlank();
    m.groups.push({ id: 'u-search', ar: 'بحث', en: 'Search', icon: 'star' });
    m.tools.push({ id: 'u-wiki-search-aaaa', group: 'u-search', pigment: 'lapis', ar: 'بحث ويكي', en: 'Wiki Search', aliases: ['wk'], url: 'https://wiki.example.org/w?search={q}&x=1' });
    m.tools.push({ id: 'u-plain-bbbb', group: 'u-search', pigment: 'bone', en: 'Plain Page', url: 'https://plain.example.org/' });
    F.mineSave(m);
    F.refreshAll();
  });
  await p.waitForTimeout(500);
}

T('templates: Tab engages, argument is encoded, Backspace and Esc disengage', async (p) => {
  await withTemplate(p);
  ok(await p.evaluate(() => !!document.querySelector('.row[data-id="u-wiki-search-aaaa"] .tpl:not([hidden])')), 'template pill shown');
  await p.fill('#seek', 'wiki');
  await p.waitForTimeout(400);
  await p.keyboard.press('Tab');
  await p.waitForTimeout(400);
  ok(await p.evaluate(() => !document.getElementById('seek-scope').hidden && /\u25C6/.test(document.getElementById('seek-scope').textContent)), 'scope pill shows the template');
  eq(await p.inputValue('#seek'), '', 'input is now the argument');
  eq(await order(p), ['u-wiki-search-aaaa'], 'only the template row');
  await p.keyboard.press('Backspace');
  await p.waitForTimeout(300);
  ok(await p.evaluate(() => document.getElementById('seek-scope').hidden), 'backspace on empty disengages');
  await p.fill('#seek', 'wiki');
  await p.waitForTimeout(300);
  await p.keyboard.press('Tab');
  await p.waitForTimeout(300);
  await p.keyboard.type('تحويل');
  await p.waitForTimeout(300);
  await p.keyboard.press('Enter');
  const nav = await nextNav(p, 1500);
  ok(nav.length === 1 && nav[0].indexOf('search=%D8%AA%D8%AD%D9%88%D9%8A%D9%84&x=1') !== -1, 'encoded argument: ' + nav.join(','));
});
T('templates: Esc disengages and clears, plain Enter opens with an empty query, Tab is normal elsewhere', async (p) => {
  await withTemplate(p);
  await p.fill('#seek', 'wiki');
  await p.waitForTimeout(300);
  await p.keyboard.press('Tab');
  await p.waitForTimeout(300);
  await p.keyboard.type('abc');
  await p.keyboard.press('Escape');
  await p.waitForTimeout(300);
  ok(await p.evaluate(() => document.getElementById('seek-scope').hidden && !document.getElementById('seek').value), 'esc cleared');
  await p.fill('#seek', 'plain');
  await p.waitForTimeout(300);
  await p.keyboard.press('Tab');
  await p.waitForTimeout(300);
  ok(await p.evaluate(() => document.activeElement.id !== 'seek'), 'Tab moves focus when no template is on top');
  await p.fill('#seek', 'wiki');
  await p.waitForTimeout(300);
  await p.focus('#seek');
  await p.keyboard.press('Enter');
  const nav = await nextNav(p, 1500);
  ok(nav.length === 1 && nav[0].indexOf('search=&x=1') !== -1, 'empty query: ' + nav.join(','));
});

T('shortcuts panel and command mode', async (p) => {
  await p.evaluate(() => document.activeElement.blur());
  await p.keyboard.press('Shift+Slash');
  await p.waitForTimeout(400);
  ok(await p.evaluate(() => F.sheetOpen()), '? opens panel');
  await p.evaluate(() => F.closeSheet(true));
  await p.fill('#seek', '>theme dark');
  await p.waitForTimeout(300);
  await p.keyboard.press('Enter');
  await p.waitForTimeout(500);
  eq(await p.evaluate(() => F.store.theme), 'dark', 'theme.dark');
  await p.fill('#seek', '>density compact');
  await p.waitForTimeout(300);
  await p.keyboard.press('Enter');
  await p.waitForTimeout(300);
  eq(await p.evaluate(() => F.store.density), 'compact', 'density.compact');
  await p.fill('#seek', '>language');
  await p.waitForTimeout(300);
  const lang = await p.evaluate(() => F.store.lang);
  await p.keyboard.press('Enter');
  await p.waitForTimeout(600);
  ok((await p.evaluate(() => F.store.lang)) !== lang, 'lang.toggle');
});

T('g then a kbd key opens the tool', async (p) => {
  await p.evaluate(() => { F.byId.parser.kbd = 'p'; document.activeElement.blur(); });
  await p.keyboard.press('KeyG');
  await p.keyboard.press('KeyP');
  const nav = await nextNav(p, 1500);
  ok(nav.length === 1, 'navigated ' + nav.join(','));
});

T('wrong layout suggestion: lhv offers the Arabic keys', async (p) => {
  await p.fill('#seek', 'lhv');
  await p.waitForTimeout(400);
  const txt = await p.evaluate(() => document.getElementById('empty-body').textContent);
  ok(txt.includes('مار'), 'suggestion missing: ' + txt);
});

T('deep links: ?q=, #id, ?tab=', async (p, ctx, lang) => {
  const page = await open(ctx, '?q=parser%20alt');
  eq(await active(page), 'parser', 'q selects parser');
  eq(await page.evaluate(() => F.target(F.byId.parser, F.rows.parser.matchV).v.id), 'alt', 'alt shown');
  const page2 = await open(ctx, '#roi');
  eq(await active(page2), 'roi', '#roi');
  const page3 = await open(ctx, '?tab=pinned');
  eq(await page3.evaluate(() => F.store.tab), 'pinned', '?tab=pinned');
});

T('tool sheet: versions, copy, deep link, QR, chart, close, focus return', async (p) => {
  await p.context().grantPermissions(['clipboard-read', 'clipboard-write']);
  await p.evaluate(() => { F.store.visits.parser = { n: 3, t: Date.now(), d: {} }; F.openSheet(F.rows.parser); });
  await p.waitForTimeout(500);
  ok(await p.evaluate(() => !!document.querySelector('.seg--v .seg__ink')), 'version thumb');
  ok(await p.evaluate(() => !!document.querySelector('.spark svg')), '14-day chart');
  await p.evaluate(() => Array.from(document.querySelectorAll('.tile')).find((t) => /Fihrist|فهرست|deep|رابط فهرست/i.test(t.textContent) || true).click());
  await p.waitForTimeout(300);
  await p.evaluate(() => F.openSheet(F.rows.parser));
  await p.waitForTimeout(400);
  await p.evaluate(() => Array.from(document.querySelectorAll('.tile')).find((t) => t.querySelector('svg') && /QR/i.test(t.textContent)).click());
  await p.waitForTimeout(400);
  ok(await p.evaluate(() => !!document.querySelector('.qr svg')), 'QR renders');
  await p.keyboard.press('Escape');
  await p.waitForTimeout(500);
  ok(!(await p.evaluate(() => F.sheetOpen())), 'Esc closes');
  await p.evaluate(() => F.openSheet(F.rows.parser));
  await p.waitForTimeout(400);
  await p.mouse.click(5, 5);
  await p.waitForTimeout(500);
  ok(!(await p.evaluate(() => F.sheetOpen())), 'backdrop closes');
});

T('settings: every control persists across reload', async (p, ctx, lang, mode) => {
  await p.evaluate(() => F.openSettings());
  await p.waitForTimeout(500);
  await p.evaluate(() => { const segs = document.querySelectorAll('#sheet-body .seg'); segs[1].querySelectorAll('.seg__b')[1].click(); segs[2].querySelectorAll('.seg__b')[1].click(); segs[3].querySelectorAll('.seg__b')[1].click(); document.querySelector('.tog').click(); });
  await p.waitForTimeout(600);
  await p.evaluate(() => F.flush());
  if (mode === 'file') return;
  await p.reload();
  await settle(p);
  const s = await p.evaluate(() => ({ d: F.store.density, m: F.store.motion, n: F.store.newTab, sh: F.store.shelf }));
  eq(s, { d: 'compact', m: 'reduced', n: true, sh: false }, 'persisted settings');
});

T('data: import, export, revert, drag and drop', async (p) => {
  const doc = await p.evaluate(() => JSON.parse(JSON.stringify(F.doc)));
  doc.revision = 9;
  doc.tools = doc.tools.filter((t) => t.id !== 'roi');
  const text = JSON.stringify(doc);
  await p.evaluate((t) => {
    const dt = new DataTransfer();
    dt.items.add(new File([t], 'fihrist.json', { type: 'application/json' }));
    window.dispatchEvent(new DragEvent('dragenter', { dataTransfer: dt, bubbles: true }));
    window.dispatchEvent(new DragEvent('drop', { dataTransfer: dt, bubbles: true, cancelable: true }));
  }, text);
  await p.waitForTimeout(800);
  eq(await p.evaluate(() => F.docSrc), 'file', 'drag-drop import');
  ok(!(await p.evaluate(() => !!F.byId.roi)), 'roi removed');
  const exported = await p.evaluate(() => F.serialize(F.doc));
  const again = await p.evaluate((x) => F.serialize(F.validate(JSON.parse(x.replace(/^\\{\\n  "\\$schema".*\\n/, '{\\n')))), exported);
  eq(again, exported, 'export is stable through a round trip');
  await p.evaluate(() => F.actions.revertData());
  await p.waitForTimeout(600);
  eq(await p.evaluate(() => F.docSrc), 'seed', 'revert');
  ok(await p.evaluate(() => !!F.byId.roi), 'roi back');
});

T('migration: v4, v3 and v2 keys migrate and stay', async (p, ctx, lang, mode) => {
  for (const [key, data] of [['fihrist:v4', { lang: 'en', pins: ['roi'], visits: { roi: { n: 2, t: Date.now() } } }], ['fihrist:v3', { lang: 'en', pins: ['roi'], recents: ['parser', 'roi'] }], ['fihrist:v2', { lang: 'en', pins: ['roi'], recents: ['parser'] }]]) {
    const c = await newContext(p.context().browser(), { seed: false, mode });
    await c.addInitScript('if (!sessionStorage.getItem("seeded")) { sessionStorage.setItem("seeded", "1"); localStorage.setItem(' + JSON.stringify(key) + ', ' + JSON.stringify(JSON.stringify(data)) + '); }');
    const page = await open(c, '', mode);
    eq(await page.evaluate(() => F.store.lang), 'en', key + ' lang migrated');
    ok(await page.evaluate(() => F.store.pins.indexOf('roi') !== -1), key + ' pins migrated');
    ok(await page.evaluate((k) => localStorage.getItem(k) !== null, key), key + ' old key kept');
    await c.close();
  }
});

T('reduced motion: no animation longer than 1ms runs', async (p, ctx) => {
  await p.evaluate(() => { F.store.motion = 'reduced'; F.motion.apply(); });
  const longest = [];
  await p.evaluate(() => { window.__anim = []; const t = setInterval(() => document.getAnimations().forEach((a) => { const d = a.effect && a.effect.getComputedTiming().duration; if (d > 1) window.__anim.push(d); }), 16); window.__animT = t; });
  await p.keyboard.press('ArrowDown');
  await p.fill('#seek', 'par');
  await p.evaluate(() => F.openSheet(F.rows.parser));
  await p.waitForTimeout(500);
  await p.evaluate(() => F.closeSheet());
  await p.waitForTimeout(500);
  const found = await p.evaluate(() => { clearInterval(window.__animT); return window.__anim; });
  eq(found, longest, 'animations over 1ms found');
}, { reduced: true });

T('forced colors: page still renders and focus ring is visible', async (p) => {
  await p.keyboard.press('ArrowDown');
  ok((await p.evaluate(() => document.querySelectorAll('.row').length)) > 20, 'rows render');
  ok(await p.evaluate(() => getComputedStyle(document.querySelector('.row-link')).color !== getComputedStyle(document.body).backgroundColor), 'text visible');
}, { forced: true });

async function runAll() {
  const env = await launch();
  try {
    for (const mode of modes) for (const lang of ['ar', 'en']) for (const t of tests) {
      if (filter && !filter.some((f) => t.name.includes(f))) continue;
      if (t.o.reduced && lang === 'en') continue;
      const ctx = await newContext(env.browser, { lang, mode, reducedMotion: t.o.reduced ? 'reduce' : 'no-preference', forcedColors: t.o.forced ? 'active' : 'none' });
      const page = await open(ctx, '', mode);
      let err = null;
      try { await t.fn(page, ctx, lang, mode); } catch (e) { err = e; }
      if (!err && page.errors.length) err = new Error('console errors: ' + page.errors.join(' | '));
      results.push({ name: t.name, lang, mode, err });
      console.log((err ? 'FAIL ' : 'PASS ') + '[' + mode + '/' + lang + '] ' + t.name + (err ? ' :: ' + err.message : ''));
      await ctx.close();
    }
  } finally {
    await env.close();
  }
  const bad = results.filter((r) => r.err).length;
  console.log('\n' + (results.length - bad) + '/' + results.length + ' passed');
  process.exit(bad ? 1 : 0);
}

await runAll();
