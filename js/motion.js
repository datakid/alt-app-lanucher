(function () {
'use strict';
var F = window.F, store = F.store, root = document.documentElement;
var M = F.motion = {};
var mqReduce = matchMedia('(prefers-reduced-motion: reduce)');
var EASE_OUT = 'cubic-bezier(.16,1,.3,1)';
var SPRING = 'cubic-bezier(.34,1.56,.64,1)';
try {
  if (window.CSS && CSS.supports && CSS.supports('animation-timing-function', 'linear(0, 1)')) {
    SPRING = 'linear(0,.009,.035 2.1%,.141 4.4%,.723 12.9%,.938 16.7%,1.017 19.4%,1.067,1.099 24.3%,1.106 26.5%,1.097,1.07 32%,1.024 37.4%,1.003 41.4%,.99 45.4%,.991 52.5%,1.001 67.2%,1)';
  }
} catch (e) {}
M.EASE_OUT = EASE_OUT;
M.SPRING = SPRING;

M.ok = function () { return !(mqReduce.matches || store.motion === 'reduced'); };
M.apply = function () {
  if (store.motion === 'reduced') root.setAttribute('data-motion', 'reduced'); else root.removeAttribute('data-motion');
};
if (mqReduce.addEventListener) mqReduce.addEventListener('change', M.apply);

var reads = [], writes = [], queued = false;
function flush() {
  var r = reads, w = writes, i;
  queued = false; reads = []; writes = [];
  for (i = 0; i < r.length; i++) r[i]();
  for (i = 0; i < w.length; i++) w[i]();
}
M.frame = function (readFn, writeFn) {
  if (readFn) reads.push(readFn);
  if (writeFn) writes.push(writeFn);
  if (!queued) { queued = true; requestAnimationFrame(flush); }
};
M.measure = function (readFn) { M.frame(readFn, null); };

function stop(node) {
  var a = node && node._anim;
  if (a) { try { a.cancel(); } catch (e) {} node._anim = null; }
}
M.cancel = function (el) {
  if (!el) return;
  stop(el);
  if (el._spring) { el._spring.stop(); el._spring = null; }
  if (el._slide) { try { el._slide.cancel(); } catch (e) {} el._slide = null; }
};

function listTop(list) { return list ? list.getBoundingClientRect().top : 0; }

M.snap = function (list, nodes) {
  var m = new Map(), base = listTop(list), i;
  for (i = 0; i < nodes.length; i++) if (nodes[i].isConnected) m.set(nodes[i], nodes[i].getBoundingClientRect().top - base);
  return m;
};
M.flip = function (nodes, mutateFn, opts) {
  opts = opts || {};
  var holder = opts.holder || function (n) { return n; };
  var list = opts.list || null;
  if (!M.ok()) { mutateFn(); return Promise.resolve(); }
  var first = opts.snap || M.snap(list, nodes), i, n;
  for (i = 0; i < nodes.length; i++) { n = holder(nodes[i]); if (n.anim) { try { n.anim.cancel(); } catch (e) {} n.anim = null; } }
  mutateFn();
  var next = opts.next || nodes;
  if (!first.size) {
    var cap = opts.cap || 10, stag = opts.stagger || 0, run = [], j;
    for (j = 0; j < next.length && j < 14; j++) {
      run.push(next[j].animate([{ opacity: 0 }, { opacity: 1 }], { duration: 180, delay: stag ? Math.min(j, cap) * stag : 0, easing: 'ease-out', fill: 'backwards' }).finished.catch(function () {}));
    }
    return Promise.all(run);
  }
  return new Promise(function (resolve) {
    var last = new Map(), lbase = 0;
    M.frame(function () {
      var j, m;
      lbase = listTop(list);
      for (j = 0; j < next.length; j++) { m = next[j]; if (m.isConnected) last.set(m, m.getBoundingClientRect().top - lbase); }
    }, function () {
      var plays = [], k = 0, fresh = 0, node, dy, h, anim, del, vh = window.innerHeight, lo = -120 - lbase, hi = vh + 120 - lbase, ft, lt;
      for (var p = 0; p < next.length; p++) {
        node = next[p];
        if (!last.has(node)) continue;
        lt = last.get(node); ft = first.has(node) ? first.get(node) : lt;
        if ((lt < lo || lt > hi) && (ft < lo || ft > hi)) continue;
        if (k >= (opts.max || 24)) break;
        h = holder(node);
        if (first.has(node)) {
          dy = ft - lt;
          if (Math.abs(dy) < 1) continue;
          anim = node.animate([{ transform: 'translateY(' + dy + 'px)' }, { transform: 'none' }], { duration: opts.duration || 280, easing: EASE_OUT });
        } else {
          del = opts.stagger ? Math.min(fresh, opts.cap || 10) * opts.stagger : 0;
          fresh++;
          anim = node.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 180, delay: del, easing: 'ease-out', fill: 'backwards' });
        }
        h.anim = anim; plays.push(anim.finished.catch(function () {})); k++;
        (function (a, hh) { a.onfinish = function () { if (hh.anim === a) hh.anim = null; }; })(anim, h);
      }
      Promise.all(plays).then(resolve);
    });
  });
};

function slideRead(ind, target, xy) {
  ind._next = target && target.isConnected ? { x: target.offsetLeft, y: xy ? target.offsetTop : 0, w: target.offsetWidth, h: xy ? target.offsetHeight : 0 } : null;
}
function slideWrite(ind, xy, now) {
  var to = ind._next, from = ind._at;
  ind._next = null;
  if (!to || !to.w) { ind.style.opacity = '0'; ind._at = null; return; }
  var t = 'translate(' + to.x + 'px,' + to.y + 'px)';
  var tween = from && M.ok() && !now && ind.style.opacity !== '0' && (from.x !== to.x || from.y !== to.y || from.w !== to.w || from.h !== to.h);
  if (ind._slide) { try { ind._slide.cancel(); } catch (e) {} ind._slide = null; }
  ind.style.transform = t; ind.style.width = to.w + 'px'; if (xy) ind.style.height = to.h + 'px';
  ind.style.opacity = '1';
  if (tween) {
    var f0 = { transform: 'translate(' + from.x + 'px,' + from.y + 'px)', width: from.w + 'px' }, f1 = { transform: t, width: to.w + 'px' };
    if (xy) { f0.height = from.h + 'px'; f1.height = to.h + 'px'; }
    ind._slide = ind.animate([f0, f1], { duration: 320, easing: EASE_OUT });
  }
  ind._at = to;
}
M.slide = function (ind, target, axis, now) {
  if (!ind) return;
  var xy = axis === 'xy';
  if (now) { slideRead(ind, target, xy); slideWrite(ind, xy, true); return; }
  M.frame(function () { slideRead(ind, target, xy); }, function () { slideWrite(ind, xy, false); });
};
M.slideMany = function (list, axis) {
  var xy = axis === 'xy', i;
  for (i = 0; i < list.length; i++) slideRead(list[i][0], list[i][1], xy);
  for (i = 0; i < list.length; i++) slideWrite(list[i][0], xy, true);
};

M.spring = function (el, from, to, o) {
  o = o || {};
  var k = o.stiffness || 520, c = o.damping || 38, v = o.velocity || 0, x = from, last = 0, raf = 0, dead = false;
  var h = { stop: function () { dead = true; if (raf) cancelAnimationFrame(raf); raf = 0; } };
  if (el) { if (el._spring) el._spring.stop(); el._spring = h; }
  function done() { if (el && el._spring === h) el._spring = null; if (o.onDone) o.onDone(); }
  if (!M.ok()) { if (o.onUpdate) o.onUpdate(to); done(); return h; }
  function tick(t) {
    if (dead) return;
    var dt = last ? Math.min(.032, (t - last) / 1000) : .016, a;
    last = t;
    a = -k * (x - to) - c * v;
    v += a * dt; x += v * dt;
    if (Math.abs(v) < .01 && Math.abs(x - to) < .5) { if (o.onUpdate) o.onUpdate(to); done(); return; }
    if (o.onUpdate) o.onUpdate(x);
    raf = requestAnimationFrame(tick);
  }
  raf = requestAnimationFrame(tick);
  return h;
};

M.apply();
})();
