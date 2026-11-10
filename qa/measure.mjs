import fs from 'node:fs';
import path from 'node:path';
import { launch, newContext, open, settle, parseArgs, outDir } from './lib.mjs';
import { MEASURE, CHIP_WIDTHS, CONTRAST } from './metrics-fn.mjs';

const args = parseArgs();
const label = args.label || 'new';
const assertMode = !!args.assert;
const dprList = args.dpr ? String(args.dpr).split(',').map(Number) : [1];
const densities = args.density ? String(args.density).split(',') : ['cozy', 'compact'];
const viewports = args.viewport === 'mobile' ? [[390, 844]] : args.viewport === 'all' ? [[1280, 800], [390, 844]] : [[1280, 800]];

async function measureOne(env, opts) {
  const ctx = await newContext(env.browser, opts);
  await ctx.addInitScript('Date.now = (function (o) { var base = new Date("2026-11-04T10:00:00Z").getTime(), t0 = o(); return function () { return base + (o() - t0); }; })(Date.now);');
  const page = await open(ctx, '');
  const result = {};
  result.idle = await page.evaluate(MEASURE);
  await page.evaluate(() => F.setTab('print'));
  await settle(page, 300);
  result.scope = await page.evaluate(MEASURE);
  await page.evaluate(() => F.setTab('all'));
  await page.fill('#seek', 'parser alt');
  await settle(page, 400);
  result.query = await page.evaluate(MEASURE);
  await page.fill('#seek', '');
  await settle(page, 300);
  result.empty = await page.evaluate(MEASURE);
  result.chipWidths = await page.evaluate(CHIP_WIDTHS);
  result.contrast = await page.evaluate(CONTRAST);
  const errors = page.errors.slice();
  await ctx.close();
  return { result, errors };
}

function flatten(entry) {
  const pills = Object.assign({}, entry.idle.pills, entry.scope.pills && entry.scope.pills.scope ? { scope: entry.scope.pills.scope } : {}, entry.query.pills && entry.query.pills.vtag ? { vtag: entry.query.pills.vtag } : {});
  return { pills, row: entry.idle.rows.parser, searchEmpty: entry.empty.search, searchTyped: entry.query.search, chipWidths: entry.chipWidths, contrast: entry.contrast };
}

function assertions(key, m) {
  const fails = [];
  const need = (ok, msg) => { if (!ok) fails.push(key + ': ' + msg); };
  for (const [name, p] of Object.entries(m.pills)) {
    if (!p) continue;
    need([18, 22, 30, 36].some((h) => Math.abs(p.h - h) <= 0.5), name + ' height ' + p.h + ' not in {18,22,30,36}');
    need(Math.abs(p.optical) <= 0.5, name + ' optical offset ' + p.optical);
    need(Math.abs(p.padStart - p.padEnd) <= 0.5, name + ' padding ' + p.padStart + '/' + p.padEnd);
    if (p.countBaselineDelta !== undefined) need(Math.abs(p.countBaselineDelta) <= 0.5, name + ' count baseline ' + p.countBaselineDelta);
  }
  const r = m.row || {};
  if (r.folioBaselineDelta != null) need(Math.abs(r.folioBaselineDelta) <= 0.5, 'folio baseline ' + r.folioBaselineDelta);
  if (r.markOpticalDelta != null) need(Math.abs(r.markOpticalDelta) <= 0.5, 'mark vs title ' + r.markOpticalDelta);
  if (r.hostBaselineDelta != null) need(Math.abs(r.hostBaselineDelta) <= 0.5, 'host vs desc ' + r.hostBaselineDelta);
  need(Math.abs(m.searchEmpty.countX - m.searchTyped.countX) <= 0.5, 'search count x moves ' + m.searchEmpty.countX + ' -> ' + m.searchTyped.countX);
  if (m.contrast) {
    need(m.contrast.muted >= 4.5, 'muted contrast ' + m.contrast.muted.toFixed(2));
    need(m.contrast.host >= 4.5, 'host contrast ' + m.contrast.host.toFixed(2));
    for (const [n, c] of Object.entries(m.contrast.pigments)) {
      need(c.mark >= 3, 'pigment ' + n + ' mark contrast ' + c.mark.toFixed(2));
      need(c.text >= 4.5, 'pigment ' + n + ' text contrast ' + c.text.toFixed(2));
    }
  }
  for (const [id, spread] of Object.entries(m.chipWidths)) need(spread === 0, 'chip row width changes with version in ' + id + ' (' + spread + 'px)');
  return fails;
}

const env = await launch();
const report = {};
let failures = [];
try {
  for (const lang of ['ar', 'en']) for (const theme of ['light', 'dark']) for (const density of densities) for (const [width, height] of viewports) for (const dpr of dprList) {
    const key = [lang, theme, density, width + 'x' + height, 'x' + dpr].join('-');
    const { result, errors } = await measureOne(env, { lang, theme, density, width, height, dpr });
    report[key] = flatten(result);
    if (errors.length) console.error(key + ' page errors: ' + errors.join(' | '));
    if (assertMode) failures = failures.concat(assertions(key, report[key]));
  }
} finally {
  await env.close();
}
const dir = outDir(label);
fs.writeFileSync(path.join(dir, 'metrics.json'), JSON.stringify(report, null, 1) + '\n');
console.log('wrote qa/out/' + label + '/metrics.json (' + Object.keys(report).length + ' combos)');
if (assertMode) {
  if (failures.length) { console.error(failures.slice(0, 60).join('\n') + (failures.length > 60 ? '\n... ' + (failures.length - 60) + ' more' : '')); console.error(failures.length + ' assertion failures'); process.exit(1); }
  console.log('all measurements within targets');
}
