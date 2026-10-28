(function () {
'use strict';
var F = window.F = window.F || {};
var BLOCKS = { 1: [10, 1, 16], 2: [16, 1, 28], 3: [26, 1, 44], 4: [18, 2, 32], 5: [24, 2, 43], 6: [16, 4, 27] };
var MAXV = 6;

var EXP = [], LOG = [];
(function () {
  var x = 1, i;
  for (i = 0; i < 255; i++) { EXP[i] = x; LOG[x] = i; x <<= 1; if (x & 256) x ^= 0x11D; }
  for (i = 255; i < 512; i++) EXP[i] = EXP[i - 255];
})();
function gmul(a, b) { return a && b ? EXP[LOG[a] + LOG[b]] : 0; }
function genPoly(n) {
  var g = [1], i, j, ng;
  for (i = 0; i < n; i++) {
    ng = [];
    for (j = 0; j <= g.length; j++) ng[j] = 0;
    for (j = 0; j < g.length; j++) { ng[j] ^= g[j]; ng[j + 1] ^= gmul(g[j], EXP[i]); }
    g = ng;
  }
  return g;
}
function remainder(data, n) {
  var g = genPoly(n), res = [], i, k, f;
  for (i = 0; i < n; i++) res.push(0);
  for (k = 0; k < data.length; k++) {
    f = data[k] ^ res.shift(); res.push(0);
    for (i = 0; i < n; i++) res[i] ^= gmul(g[i + 1], f);
  }
  return res;
}
function utf8(s) {
  if (window.TextEncoder) return Array.prototype.slice.call(new TextEncoder().encode(s));
  var e = unescape(encodeURIComponent(s)), out = [], i;
  for (i = 0; i < e.length; i++) out.push(e.charCodeAt(i));
  return out;
}
function capacity(v) { var b = BLOCKS[v]; return Math.floor((b[1] * b[2] * 8 - 12) / 8); }
function pickVersion(n) {
  for (var v = 1; v <= MAXV; v++) if (n <= capacity(v)) return v;
  return 0;
}
function codewords(bytes, v) {
  var b = BLOCKS[v], ecLen = b[0], nb = b[1], per = b[2], cap = nb * per * 8, bits = [], i, j, pad;
  function put(val, len) { for (var k = len - 1; k >= 0; k--) bits.push((val >>> k) & 1); }
  put(4, 4); put(bytes.length, 8);
  for (i = 0; i < bytes.length; i++) put(bytes[i], 8);
  put(0, Math.min(4, cap - bits.length));
  while (bits.length % 8) bits.push(0);
  for (pad = 0xEC; bits.length < cap; pad ^= 0xEC ^ 0x11) put(pad, 8);
  var data = [];
  for (i = 0; i < bits.length; i += 8) { var byte = 0; for (j = 0; j < 8; j++) byte = (byte << 1) | bits[i + j]; data.push(byte); }
  var blocks = [], ecs = [];
  for (i = 0; i < nb; i++) { blocks.push(data.slice(i * per, (i + 1) * per)); ecs.push(remainder(blocks[i], ecLen)); }
  var out = [];
  for (i = 0; i < per; i++) for (j = 0; j < nb; j++) out.push(blocks[j][i]);
  for (i = 0; i < ecLen; i++) for (j = 0; j < nb; j++) out.push(ecs[j][i]);
  return out;
}

function Grid(size) {
  this.size = size; this.m = []; this.fn = [];
  for (var y = 0; y < size; y++) { this.m.push([]); this.fn.push([]); for (var x = 0; x < size; x++) { this.m[y].push(false); this.fn[y].push(false); } }
}
Grid.prototype.setFn = function (x, y, dark) { this.m[y][x] = dark; this.fn[y][x] = true; };
Grid.prototype.finder = function (cx, cy) {
  var dx, dy, x, y, d;
  for (dy = -4; dy <= 4; dy++) for (dx = -4; dx <= 4; dx++) {
    x = cx + dx; y = cy + dy;
    if (x < 0 || y < 0 || x >= this.size || y >= this.size) continue;
    d = Math.max(Math.abs(dx), Math.abs(dy));
    this.setFn(x, y, d !== 2 && d !== 4);
  }
};
Grid.prototype.align = function (cx, cy) {
  for (var dy = -2; dy <= 2; dy++) for (var dx = -2; dx <= 2; dx++) this.setFn(cx + dx, cy + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1);
};
Grid.prototype.format = function (mask) {
  var size = this.size, data = mask, rem = data, i;
  for (i = 0; i < 10; i++) rem = (rem << 1) ^ ((rem >>> 9) * 0x537);
  var bits = ((data << 10) | rem) ^ 0x5412;
  function bit(k) { return ((bits >>> k) & 1) !== 0; }
  for (i = 0; i <= 5; i++) this.setFn(8, i, bit(i));
  this.setFn(8, 7, bit(6)); this.setFn(8, 8, bit(7)); this.setFn(7, 8, bit(8));
  for (i = 9; i < 15; i++) this.setFn(14 - i, 8, bit(i));
  for (i = 0; i < 8; i++) this.setFn(size - 1 - i, 8, bit(i));
  for (i = 8; i < 15; i++) this.setFn(8, size - 15 + i, bit(i));
  this.setFn(8, size - 8, true);
};
Grid.prototype.place = function (cw) {
  var size = this.size, i = 0, right, vert, j, x, y, up, total = cw.length * 8;
  for (right = size - 1; right >= 1; right -= 2) {
    if (right === 6) right = 5;
    for (vert = 0; vert < size; vert++) for (j = 0; j < 2; j++) {
      x = right - j; up = ((right + 1) & 2) === 0; y = up ? size - 1 - vert : vert;
      if (!this.fn[y][x] && i < total) { this.m[y][x] = ((cw[i >>> 3] >>> (7 - (i & 7))) & 1) !== 0; i++; }
    }
  }
};
function maskFn(mask, x, y) {
  switch (mask) {
    case 0: return (x + y) % 2 === 0;
    case 1: return y % 2 === 0;
    case 2: return x % 3 === 0;
    case 3: return (x + y) % 3 === 0;
    case 4: return (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0;
    case 5: return x * y % 2 + x * y % 3 === 0;
    case 6: return (x * y % 2 + x * y % 3) % 2 === 0;
    default: return ((x + y) % 2 + x * y % 3) % 2 === 0;
  }
}
Grid.prototype.mask = function (mask) {
  for (var y = 0; y < this.size; y++) for (var x = 0; x < this.size; x++) if (!this.fn[y][x] && maskFn(mask, x, y)) this.m[y][x] = !this.m[y][x];
};
function lineScore(line) {
  var s = 0, run = 1, i, n = line.length, p;
  for (i = 1; i <= n; i++) {
    if (i < n && line[i] === line[i - 1]) run++;
    else { if (run >= 5) s += 3 + run - 5; run = 1; }
  }
  var a = [1, 0, 1, 1, 1, 0, 1, 0, 0, 0, 0], b = [0, 0, 0, 0, 1, 0, 1, 1, 1, 0, 1], j, ma, mb;
  for (i = 0; i + 11 <= n; i++) {
    ma = true; mb = true;
    for (j = 0; j < 11; j++) { p = line[i + j] ? 1 : 0; if (p !== a[j]) ma = false; if (p !== b[j]) mb = false; }
    if (ma) s += 40;
    if (mb) s += 40;
  }
  return s;
}
Grid.prototype.penalty = function () {
  var size = this.size, s = 0, x, y, dark = 0, col, k;
  for (y = 0; y < size; y++) s += lineScore(this.m[y]);
  for (x = 0; x < size; x++) { col = []; for (y = 0; y < size; y++) col.push(this.m[y][x]); s += lineScore(col); }
  for (y = 0; y < size - 1; y++) for (x = 0; x < size - 1; x++) { var c = this.m[y][x]; if (c === this.m[y][x + 1] && c === this.m[y + 1][x] && c === this.m[y + 1][x + 1]) s += 3; }
  for (y = 0; y < size; y++) for (x = 0; x < size; x++) if (this.m[y][x]) dark++;
  k = Math.floor(Math.abs(dark * 20 - size * size * 10) / (size * size));
  return s + k * 10;
};

function encode(text, forceMask) {
  var bytes = utf8(String(text)), v = pickVersion(bytes.length);
  if (!v) return null;
  var size = 17 + 4 * v, g = new Grid(size), i;
  for (i = 0; i < size; i++) { g.setFn(6, i, i % 2 === 0); g.setFn(i, 6, i % 2 === 0); }
  g.finder(3, 3); g.finder(size - 4, 3); g.finder(3, size - 4);
  if (v >= 2) g.align(size - 7, size - 7);
  g.format(0);
  g.place(codewords(bytes, v));
  var best = 0, bestScore = Infinity, m, sc;
  if (typeof forceMask === 'number') best = forceMask;
  else for (m = 0; m < 8; m++) {
    g.mask(m); g.format(m); sc = g.penalty(); g.mask(m);
    if (sc < bestScore) { bestScore = sc; best = m; }
  }
  g.mask(best); g.format(best);
  return { size: size, version: v, mask: best, modules: g.m };
}

var NS = 'http://www.w3.org/2000/svg';
function svgEl(text) {
  var q = encode(text);
  if (!q) return null;
  var n = q.size, d = '', x, y, start, el = document.createElementNS(NS, 'svg'), bg, path;
  for (y = 0; y < n; y++) {
    x = 0;
    while (x < n) {
      if (!q.modules[y][x]) { x++; continue; }
      start = x;
      while (x < n && q.modules[y][x]) x++;
      d += 'M' + start + ' ' + y + 'h' + (x - start) + 'v1h-' + (x - start) + 'z';
    }
  }
  el.setAttribute('viewBox', '-4 -4 ' + (n + 8) + ' ' + (n + 8));
  el.setAttribute('shape-rendering', 'crispEdges');
  el.setAttribute('role', 'img');
  bg = document.createElementNS(NS, 'rect');
  bg.setAttribute('x', '-4'); bg.setAttribute('y', '-4'); bg.setAttribute('width', n + 8); bg.setAttribute('height', n + 8); bg.setAttribute('fill', '#ffffff');
  path = document.createElementNS(NS, 'path');
  path.setAttribute('d', d); path.setAttribute('fill', '#111513');
  el.appendChild(bg); el.appendChild(path);
  return el;
}
F.qr = { encode: encode, svg: svgEl, capacity: capacity, maxBytes: capacity(MAXV) };
})();
