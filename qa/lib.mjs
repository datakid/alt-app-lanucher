import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';
import { ROOT, PORT, serve, fileUrl } from './serve.mjs';

export const HTTP_URL = 'http://127.0.0.1:' + PORT + '/index.html';

const FONT_PACKAGES = [
  ['@fontsource/amiri', 'index.css', { 'Amiri': 'Amiri' }],
  ['@fontsource-variable/readex-pro', 'index.css', { 'Readex Pro Variable': 'Readex Pro' }],
  ['@fontsource/ibm-plex-mono', 'index.css', { 'IBM Plex Mono': 'IBM Plex Mono' }],
  ['@fontsource-variable/fraunces', 'index.css', { 'Fraunces Variable': 'Fraunces' }],
  ['@fontsource-variable/newsreader', 'index.css', { 'Newsreader Variable': 'Newsreader' }]
];

let fontCss = null;
function buildFontCss() {
  if (fontCss !== null) return fontCss;
  fontCss = '';
  for (const [pkg, cssFile, rename] of FONT_PACKAGES) {
    const dir = path.join(ROOT, 'node_modules', pkg);
    if (!fs.existsSync(dir)) continue;
    let css = fs.readFileSync(path.join(dir, cssFile), 'utf8');
    css = css.replace(/url\(\.\/files\//g, 'url(http://127.0.0.1:' + PORT + '/__fonts/' + pkg + '/files/');
    for (const [from, to] of Object.entries(rename)) css = css.split("'" + from + "'").join("'" + to + "'");
    fontCss += css + '\n';
  }
  return fontCss;
}

export function newsId() {
  const core = fs.readFileSync(path.join(ROOT, 'js', 'core.js'), 'utf8');
  const m = /F\.NEWS_ID = '([^']+)'/.exec(core);
  return m ? m[1] : '5.0';
}

export async function launch() {
  const server = await serve().catch(() => null);
  const browser = await chromium.launch();
  return {
    browser,
    async close() {
      await browser.close();
      if (server) await new Promise((r) => server.close(r));
    }
  };
}

export function seedPrefs(over = {}) {
  return Object.assign({
    v: 5, theme: 'light', lang: 'ar', density: 'cozy', seenWhatsNew: newsId(), pins: ['parser', 'drug-list'],
    visits: { parser: { n: 9, t: Date.now() }, roi: { n: 4, t: Date.now() - 864e5 } }
  }, over);
}

export async function newContext(browser, opts = {}) {
  const { lang = 'ar', theme = 'light', density = 'cozy', width = 1280, height = 800, mode = 'http', dpr = 1, seed = true, extra = {}, reducedMotion = 'no-preference', forcedColors = 'none', serviceWorkers = 'block' } = opts;
  const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: dpr, reducedMotion, forcedColors, serviceWorkers, hasTouch: width < 700, isMobile: false });
  await context.route(/fonts\.googleapis\.com/, (r) => r.fulfill({ status: 200, contentType: 'text/css', body: buildFontCss() }));
  await context.route(/fonts\.gstatic\.com/, (r) => r.abort());
  context.nav = [];
  await context.route((u) => /^https?:/.test(u.href) && !/^https?:\/\/(127\.0\.0\.1|localhost)/.test(u.href), (r) => {
    if (r.request().resourceType() === 'document') {
      context.nav.push(r.request().url());
      r.fulfill({ status: 200, contentType: 'text/html', body: '<title>external</title>' });
    } else r.abort();
  });
  if (seed) {
    const prefs = JSON.stringify(seedPrefs(Object.assign({ lang, theme, density }, extra)));
    await context.addInitScript('if (!localStorage.getItem("fihrist:v5")) localStorage.setItem("fihrist:v5", ' + JSON.stringify(prefs) + ');');
  }
  context.__mode = mode;
  return context;
}

export function baseUrl(mode) {
  return mode === 'file' ? fileUrl() : HTTP_URL;
}

export async function open(context, query = '', mode = context.__mode || 'http') {
  const page = await context.newPage();
  page.errors = [];
  page.on('pageerror', (e) => page.errors.push(String(e)));
  page.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) page.errors.push(m.text()); });
  await page.goto(baseUrl(mode) + query);
  await settle(page);
  return page;
}

export async function settle(page, extra = 400) {
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(extra);
}

export const STATES = {
  idle: { query: '' },
  query: { query: null },
  'query-variant-hit': { query: 'parser alt' },
  'sheet-open': { action: "F.openSheet(F.rows.parser)" },
  'settings-open': { action: 'F.openSettings()' },
  'empty-state': { query: 'zzqx' },
  'command-mode': { query: '>' },
  'compact-density': { density: 'compact' }
};

export function queryFor(state, lang) {
  if (state === 'query') return lang === 'ar' ? 'بديل' : 'alt';
  return STATES[state].query || '';
}

export function parseArgs(argv = process.argv.slice(2)) {
  const out = { _: [] };
  for (const a of argv) {
    const m = /^--([^=]+)(?:=(.*))?$/.exec(a);
    if (m) out[m[1]] = m[2] === undefined ? true : m[2];
    else out._.push(a);
  }
  return out;
}

export function outDir(label) {
  const dir = path.join(ROOT, 'qa', 'out', label);
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

export async function minePayload() {
  const { createRequire } = await import('node:module');
  const req = createRequire(import.meta.url);
  const loader = req('../tools/loader');
  const F = loader.loadCore(null, { url: true, scripts: ['js/xlsx.js', 'js/mine-core.js'] }).F;
  const bytes = new Uint8Array(fs.readFileSync(path.join(ROOT, 'tools', 'fixtures', 'mine-600.xlsx')));
  const mapped = F.mineio.mapSheets(F.mineio.sheetsFromBytes('mine-600.xlsx', bytes).sheets);
  return JSON.parse(JSON.stringify(F.mineio.plan(mapped.drafts, F.mineBlank(), 'merge', {}).payload));
}
