import fs from 'node:fs';
import path from 'node:path';
import { launch, newContext } from './lib.mjs';
import { ROOT } from './serve.mjs';

const rate = Number((process.argv.find((a) => a.startsWith('--rate=')) || '--rate=1').slice(7));
const runs = 5;
const env = await launch();
const out = [];
for (const [label, file] of [['real 33', null], ['fixture 500', 'big-500'], ['fixture 1500', 'big-1500']]) {
  const times = [];
  for (let i = 0; i < runs; i++) {
    const ctx = await newContext(env.browser, { lang: 'en' });
    if (file) {
      const doc = JSON.parse(fs.readFileSync(path.join(ROOT, 'tools', 'fixtures', file + '.json'), 'utf8'));
      await ctx.addInitScript('localStorage.setItem("fihrist:data:v5", ' + JSON.stringify(JSON.stringify({ doc, src: 'file', forced: true, at: Date.now() })) + ');');
    }
    const page = await ctx.newPage();
    const cdp = await ctx.newCDPSession(page);
    if (rate > 1) await cdp.send('Emulation.setCPUThrottlingRate', { rate });
    await page.goto('http://127.0.0.1:4173/index.html?perf=1');
    await page.waitForFunction(() => window.F && F.perfLog && F.perfLog.some((x) => x[0] === 'index' && x[1] > 20), null, { timeout: 30000 });
    const r = await page.evaluate(() => { const x = F.perfLog.filter((y) => y[0] === 'index' && y[1] > 20)[0]; return { n: x[1], ms: x[2] }; });
    times.push(r.ms);
    await ctx.close();
  }
  times.sort((a, b) => a - b);
  out.push(label.padEnd(13) + ' first build in Chromium, CPU x' + rate + ': median ' + times[2].toFixed(1) + ' ms, slowest ' + times[runs - 1].toFixed(1) + ' ms');
}
console.log(out.join('\n'));
await env.close();
