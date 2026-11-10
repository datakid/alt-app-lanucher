import fs from 'node:fs';
import path from 'node:path';
import { launch, newContext, open, settle, STATES, queryFor, parseArgs, outDir } from './lib.mjs';
import { ROOT } from './serve.mjs';

const args = parseArgs();
const label = args.label || 'new';
const compare = args.compare;
const baseline = args.baseline || 'baseline';
const only = args.only ? String(args.only).split(',') : null;

const LANGS = ['ar', 'en'];
const THEMES = ['light', 'dark'];
const VIEWPORTS = [['desktop', 1280, 800], ['mobile', 390, 844]];

function shotName(lang, theme, vp, state) {
  return [lang, theme, vp, state].join('-') + '.png';
}

async function capture() {
  const dir = outDir(label);
  const env = await launch();
  let n = 0;
  try {
    for (const lang of LANGS) for (const theme of THEMES) for (const [vp, width, height] of VIEWPORTS) {
      for (const state of Object.keys(STATES)) {
        if (only && !only.includes(state)) continue;
        const density = state === 'compact-density' ? 'compact' : 'cozy';
        const ctx = await newContext(env.browser, { lang, theme, density, width, height, reducedMotion: 'reduce' });
        const page = await open(ctx, '?q=' + encodeURIComponent(queryFor(state, lang)));
        const act = STATES[state].action;
        if (act) { await page.evaluate(act); await settle(page, 600); }
        await page.screenshot({ path: path.join(dir, shotName(lang, theme, vp, state)), animations: 'disabled', caret: 'hide' });
        if (page.errors.length) console.error(shotName(lang, theme, vp, state) + ': ' + page.errors.join(' | '));
        await ctx.close();
        n++;
      }
    }
  } finally {
    await env.close();
  }
  console.log('wrote ' + n + ' screenshots to qa/out/' + label);
}

async function side() {
  const a = path.join(ROOT, 'qa', 'baseline');
  const b = path.join(ROOT, 'qa', 'out', label);
  const out = path.join(ROOT, 'qa', 'out', 'compare');
  fs.mkdirSync(out, { recursive: true });
  const aDir = fs.existsSync(path.join(a, 'shots')) ? path.join(a, 'shots') : path.join(ROOT, 'qa', 'out', baseline);
  const env = await launch();
  let changed = 0;
  let same = 0;
  try {
    const ctx = await env.browser.newContext({ viewport: { width: 1400, height: 900 } });
    for (const f of fs.readdirSync(b).filter((x) => x.endsWith('.png'))) {
      const pa = path.join(aDir, f);
      if (!fs.existsSync(pa)) continue;
      const ba = fs.readFileSync(pa);
      const bb = fs.readFileSync(path.join(b, f));
      if (ba.equals(bb)) { same++; continue; }
      changed++;
      const page = await ctx.newPage();
      await page.setContent('<body style="margin:0;display:flex;gap:8px;background:#888"><img style="max-width:50%" src="data:image/png;base64,' + ba.toString('base64') + '"><img style="max-width:50%" src="data:image/png;base64,' + bb.toString('base64') + '"></body>');
      await page.screenshot({ path: path.join(out, f), fullPage: true });
      await page.close();
    }
    await ctx.close();
  } finally {
    await env.close();
  }
  console.log('compare: ' + changed + ' changed, ' + same + ' identical (grids in qa/out/compare)');
}

if (!args['skip-capture']) await capture();
if (compare || args['skip-capture']) await side();
