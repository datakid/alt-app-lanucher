import { launch, newContext, minePayload, settle } from './lib.mjs';

const payload = await minePayload();
const env = await launch();
const rows = [];
for (const [label, withMine] of [['33 built-in', false], ['33 + 600 personal', true]]) {
  const times = [];
  for (let i = 0; i < 5; i++) {
    const ctx = await newContext(env.browser, { lang: 'en' });
    if (withMine) await ctx.addInitScript('localStorage.setItem("fihrist:mine:v1", ' + JSON.stringify(JSON.stringify(payload)) + ');');
    const page = await ctx.newPage();
    await page.goto('http://127.0.0.1:4173/index.html');
    await page.waitForFunction(() => performance.getEntriesByName('first-contentful-paint').length > 0);
    const m = await page.evaluate(() => ({ fcp: performance.getEntriesByName('first-contentful-paint')[0].startTime, n: F.DATA.length, rows: document.querySelectorAll('.row').length }));
    times.push(m.fcp);
    if (i === 0) rows.push(label + ': ' + m.n + ' tools, ' + m.rows + ' row nodes');
    await ctx.close();
  }
  times.sort((a, b) => a - b);
  rows.push('  first contentful paint median ' + times[2].toFixed(0) + 'ms (min ' + times[0].toFixed(0) + ', max ' + times[4].toFixed(0) + ')');
}
console.log(rows.join('\n'));
await env.close();
