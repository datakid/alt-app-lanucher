export const MEASURE = () => {
  const lang = document.documentElement.lang;
  const canvas = document.createElement('canvas').getContext('2d');
  const r2 = (n) => Math.round(n * 100) / 100;

  function firstText(el) {
    const w = document.createTreeWalker(el, NodeFilter.SHOW_TEXT, { acceptNode: (n) => (n.data.trim() ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT) });
    return w.nextNode();
  }
  function textInfo(el) {
    const tn = firstText(el);
    if (!tn) return null;
    const rg = document.createRange();
    rg.selectNodeContents(tn);
    const rects = rg.getClientRects();
    if (!rects.length) return null;
    const rect = rects[0];
    const cs = getComputedStyle(el);
    canvas.font = cs.fontStyle + ' ' + cs.fontWeight + ' ' + cs.fontSize + ' ' + cs.fontFamily;
    const fm = canvas.measureText('x');
    const arabic = /[\u0600-\u06FF]/.test(tn.data);
    const probe = canvas.measureText(arabic ? 'س' : 'x');
    const baseline = rect.top + fm.fontBoundingBoxAscent;
    const tooth = probe.actualBoundingBoxAscent;
    const all = rg.getBoundingClientRect();
    return { baseline, tooth, mid: baseline - tooth / 2, left: all.left, right: all.right, top: rect.top, arabic, size: parseFloat(cs.fontSize), family: cs.fontFamily.split(',')[0].replace(/['"]/g, '') };
  }
  function pill(el, labelEl, endEl) {
    if (!el || el.hidden) return null;
    const box = el.getBoundingClientRect();
    if (!box.width) return null;
    const ti = textInfo(labelEl || el);
    if (!ti) return null;
    const rtl = getComputedStyle(el).direction === 'rtl';
    let left = ti.left, right = ti.right;
    if (endEl) { const eb = endEl.getBoundingClientRect(); left = Math.min(left, eb.left); right = Math.max(right, eb.right); }
    const startPad = rtl ? box.right - right : left - box.left;
    const endPad = rtl ? left - box.left : box.right - right;
    return { h: r2(box.height), w: r2(box.width), optical: r2(ti.mid - (box.top + box.height / 2)), padStart: r2(startPad), padEnd: r2(endPad), size: r2(ti.size), font: ti.family, script: ti.arabic ? 'ar' : 'en' };
  }
  function show(el) { if (el) el.scrollIntoView({ block: 'center' }); }

  const out = { lang, pills: {}, rows: {}, search: {}, chipWidths: {} };
  const chipRow = document.querySelector('.row[data-id="parser"]');
  show(chipRow);
  if (chipRow) {
    const cur = chipRow.querySelector('.chip[aria-current="true"]');
    const other = chipRow.querySelector('.chip[aria-current="false"]');
    out.pills['chip-current'] = pill(cur);
    out.pills['chip'] = pill(other);
    const vt = chipRow.querySelector('.vtag');
    out.pills['vtag'] = vt && !vt.hidden ? pill(vt) : null;
  }
  const fm = document.querySelector('.row[data-id="font-maker"]');
  show(fm);
  if (fm) out.pills['flag-new'] = pill(fm.querySelector('.flag'));
  const lf = document.querySelector('.row[data-id="ledger-form"]');
  show(lf);
  if (lf) out.pills['flag-closed'] = pill(lf.querySelector('.flag'));
  const tab = document.querySelector('.tab[aria-selected="false"]');
  const tabAny = document.querySelector('.tab');
  const tabEl = tab || tabAny;
  window.scrollTo(0, 0);
  if (tabEl) {
    out.pills['tab'] = pill(tabEl, tabEl.querySelector('.tab__t'), tabEl.querySelector('.tab__n'));
    const t = textInfo(tabEl.querySelector('.tab__t'));
    const n = tabEl.querySelector('.tab__n') ? textInfo(tabEl.querySelector('.tab__n')) : null;
    out.pills['tab'] && n && t && (out.pills['tab'].countBaselineDelta = r2(n.baseline - t.baseline));
  }
  const scope = document.getElementById('seek-scope');
  if (scope && !scope.hidden) out.pills['scope'] = pill(scope);

  const rowEl = document.querySelector('.row[data-id="parser"]');
  show(rowEl);
  if (rowEl) {
    const title = rowEl.querySelector('.title');
    const folio = rowEl.querySelector('.folio');
    const mark = rowEl.querySelector('.mark');
    const host = rowEl.querySelector('.host');
    const desc = rowEl.querySelector('.desc');
    const ti = textInfo(title);
    const fo = textInfo(folio);
    const mk = mark.getBoundingClientRect();
    const hi = textInfo(host);
    const de = textInfo(desc);
    out.rows.parser = {
      folioBaselineDelta: fo && ti ? r2(fo.baseline - ti.baseline) : null,
      markOpticalDelta: ti ? r2(mk.top + mk.height / 2 - ti.mid) : null,
      hostBaselineDelta: hi && de ? r2(hi.baseline - de.baseline) : null,
      hostWidth: r2(host.getBoundingClientRect().width),
      rowHeight: r2(rowEl.getBoundingClientRect().height),
      titleFont: ti && ti.family,
      titleSize: ti && r2(ti.size)
    };
  }

  const field = document.getElementById('seek-field');
  const icon = field.querySelector('.seek__icon');
  const count = document.getElementById('seek-count');
  const fb = field.getBoundingClientRect();
  const ib = icon.getBoundingClientRect();
  const cb = count.getBoundingClientRect();
  const cti = textInfo(count);
  const rtl = getComputedStyle(field).direction === 'rtl';
  const kids = Array.from(field.children).filter((c) => c.getBoundingClientRect().width > 0 && getComputedStyle(c).visibility !== 'hidden');
  const minL = Math.min(...kids.map((c) => c.getBoundingClientRect().left));
  const maxR = Math.max(...kids.map((c) => c.getBoundingClientRect().right));
  out.search = {
    height: r2(fb.height),
    iconCentre: r2(ib.top + ib.height / 2 - (fb.top + fb.height / 2)),
    countCentre: cti ? r2(cti.mid - (fb.top + fb.height / 2)) : null,
    countX: r2(rtl ? cb.left : cb.right),
    padInlineStart: r2(rtl ? fb.right - maxR : minL - fb.left),
    padInlineEnd: r2(rtl ? minL - fb.left : fb.right - maxR)
  };
  return out;
};

export const CHIP_WIDTHS = () => {
  const res = {};
  for (const d of F.DATA) {
    if (!d.variants || d.variants.length < 2) continue;
    const r = F.rows[d.id];
    const widths = d.variants.map((v) => {
      F.store.lastVariant[d.id] = v.id;
      F.paintRow(r);
      return Array.from(r.li.querySelectorAll('.chip')).map((c) => c.offsetWidth).join(',');
    });
    const spread = Math.max(...widths.map((w) => w.split(',').reduce((a, b) => a + Number(b), 0))) - Math.min(...widths.map((w) => w.split(',').reduce((a, b) => a + Number(b), 0)));
    res[d.id] = spread;
  }
  return res;
};


export const CONTRAST = () => {
  const cs = getComputedStyle(document.documentElement);
  const cv = document.createElement('canvas').getContext('2d');
  function rgb(v) {
    cv.fillStyle = '#000';
    cv.fillStyle = v.trim();
    const c = cv.fillStyle;
    if (c[0] === '#') return [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16));
    return c.match(/[\d.]+/g).slice(0, 3).map(Number);
  }
  const lum = (c) => { const x = c.map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }); return 0.2126 * x[0] + 0.7152 * x[1] + 0.0722 * x[2]; };
  const ratio = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
  const mix = (a, b, p) => a.map((v, i) => v * p + b[i] * (1 - p));
  const surface = rgb(cs.getPropertyValue('--surface'));
  const out = { muted: ratio(rgb(cs.getPropertyValue('--muted')), surface), host: ratio(rgb(cs.getPropertyValue('--host-ink')), surface), pigments: {} };
  for (const n of ['indigo', 'verdigris', 'madder', 'orpiment', 'lapis', 'malachite', 'tyrian', 'bone']) {
    const p = rgb(cs.getPropertyValue('--p-' + n));
    out.pigments[n] = { mark: ratio(p, surface), text: ratio(p, mix(p, surface, 0.11)) };
  }
  return out;
};
