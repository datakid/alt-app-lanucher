import fs from 'node:fs';
import path from 'node:path';
import { launch, newContext, open, settle, parseArgs } from './lib.mjs';
import { ROOT } from './serve.mjs';

const args = parseArgs();
const enforce = !!args.enforce;
const fixture = args.fixture || 'big-500';
const rate = Number(args.rate || 4);
const onlyLang = args.lang || null;
const onlyWidth = args.width ? Number(args.width) : null;
const scrollSteps = Number(args.scroll || 150);
const QUERIES = { ar: 'تحويل خط اليد', en: 'parser alt' };

const OBSERVE = () => {
  window.__perf = { long: [], shift: 0, events: [], frames: [] };
  try { new PerformanceObserver((l) => l.getEntries().forEach((e) => window.__perf.long.push(e.duration))).observe({ type: 'longtask' }); } catch (e) {}
  try { new PerformanceObserver((l) => l.getEntries().forEach((e) => { if (!e.hadRecentInput) window.__perf.shift += e.value; })).observe({ type: 'layout-shift' }); } catch (e) {}
  try { new PerformanceObserver((l) => l.getEntries().forEach((e) => window.__perf.events.push([e.name, e.duration]))).observe({ type: 'event', durationThreshold: 16 }); } catch (e) {}
};

const FRAMES_ON = () => {
  window.__perf.frames = [];
  let last = performance.now();
  window.__perf.running = true;
  const tick = (t) => { window.__perf.frames.push(t - last); last = t; if (window.__perf.running) requestAnimationFrame(tick); };
  requestAnimationFrame(tick);
};

function p95(list) {
  if (!list.length) return 0;
  const s = list.slice().sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.floor(s.length * 0.95))];
}

async function run(env, lang, width, height) {
  const ctx = await newContext(env.browser, { lang, width, height });
  const page = await open(ctx, '?perf=1&fixture=' + fixture.replace('big-', ''));
  const doc = JSON.parse(fs.readFileSync(path.join(ROOT, 'tools', 'fixtures', fixture + '.json'), 'utf8'));
  await page.waitForFunction((n) => F.DATA.length === n, doc.tools.length, { timeout: 20000 });
  await settle(page, 600);
  const cdp = await ctx.newCDPSession(page);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate });
  await page.evaluate(OBSERVE);

  await page.focus('#seek');
  let keys = 0;
  for (const q of [QUERIES[lang], lang === 'ar' ? 'parser alt' : 'تحويل خط اليد']) {
    for (const ch of q) { await page.keyboard.type(ch); keys++; await page.waitForTimeout(60); }
    await page.waitForTimeout(150);
    await page.fill('#seek', '');
    await page.evaluate(() => document.getElementById('seek').dispatchEvent(new Event('input', { bubbles: true })));
    await page.waitForTimeout(200);
  }

  await page.evaluate(FRAMES_ON);
  const steps = Math.ceil((await page.evaluate(() => document.documentElement.scrollHeight)) / 120);
  await page.mouse.move(width / 2, height / 2);
  for (let i = 0; i < Math.min(steps, scrollSteps); i++) { await page.mouse.wheel(0, 120); await page.waitForTimeout(16); }
  await page.waitForTimeout(200);
  const frames = await page.evaluate(() => { window.__perf.running = false; return window.__perf.frames.slice(); });

  const tabCount = await page.evaluate(() => F.tabList().length);
  for (let i = 0; i < Math.min(tabCount, 8); i++) { await page.evaluate((n) => F.tabAt(n), i); await page.waitForTimeout(120); }
  await page.evaluate(() => F.setTab('all'));
  for (let i = 0; i < 5; i++) {
    await page.evaluate(() => F.openSheet(F.rows[F.DATA[3].id]));
    await page.waitForTimeout(350);
    await page.evaluate(() => F.closeSheet());
    await page.waitForTimeout(300);
  }
  await page.waitForTimeout(300);
  const perf = await page.evaluate(() => window.__perf);
  const errors = page.errors.slice();
  await ctx.close();

  const slowKeys = perf.events.filter((e) => /^(keydown|keyup|input|keypress)$/.test(e[0])).map((e) => e[1]);
  const slowShare = keys ? slowKeys.filter((d) => d > 16).length / (keys * 2) : 0;
  const maxFrame = frames.length ? Math.max(...frames.slice(2)) : 0;
  const fps = frames.length > 3 ? 1000 / (frames.slice(2).reduce((a, b) => a + b, 0) / (frames.length - 2)) : 0;
  return { lang, width, keys, slowEvents: slowKeys.length, slowShare, maxEvent: slowKeys.length ? Math.max(...slowKeys) : 0, longTasks: perf.long.filter((d) => d > 50).length, maxLong: perf.long.length ? Math.max(...perf.long) : 0, shift: perf.shift, maxFrame, over24: frames.filter((f) => f > 24).length, frameP95: p95(frames), fps, frames: frames.length, errors };
}

const env = await launch();
const rows = [];
try {
  for (const [width, height] of [[1280, 800], [390, 844]]) for (const lang of ['ar', 'en']) {
    if ((onlyLang && onlyLang !== lang) || (onlyWidth && onlyWidth !== width)) continue;
    rows.push(await run(env, lang, width, height));
  }
} finally {
  await env.close();
}
const f = (n, d = 1) => Number(n).toFixed(d);
console.log('fixture ' + fixture + ', CPU x' + rate);
console.log('lang width keys slowEv(>16ms) maxEv longTasks(>50) maxLong shift  frames fps   maxFrame >24ms');
let bad = 0;
for (const r of rows) {
  const fail = r.slowShare > 0.05 || r.longTasks > 0 || r.shift > 0 || r.fps < 58 || r.over24 > 0 || r.errors.length;
  if (fail) bad++;
  console.log([r.lang.padEnd(4), String(r.width).padStart(5), String(r.keys).padStart(4), String(r.slowEvents).padStart(10), f(r.maxEvent, 0).padStart(5), String(r.longTasks).padStart(10), f(r.maxLong, 0).padStart(7), f(r.shift, 3).padStart(6), String(r.frames).padStart(6), f(r.fps).padStart(5), f(r.maxFrame).padStart(9), String(r.over24).padStart(5), fail ? ' OVER' : '', r.errors.length ? ' errors: ' + r.errors.join('|') : ''].join(' '));
}
if (enforce && bad) { console.error('perf budgets missed'); process.exit(1); }
