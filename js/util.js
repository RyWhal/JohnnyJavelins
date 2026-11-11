// Shared helpers and the global namespace. Plain scripts (no modules) so the
// game runs by simply opening index.html from disk.
'use strict';

const JJ = (window.JJ = {});

JJ.TAU = Math.PI * 2;
JJ.rand = (a, b) => a + Math.random() * (b - a);
JJ.randInt = (a, b) => Math.floor(JJ.rand(a, b + 1));
JJ.choice = (arr) => arr[Math.floor(Math.random() * arr.length)];
JJ.clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
JJ.lerp = (a, b, t) => a + (b - a) * t;
JJ.dist2 = (ax, ay, bx, by) => {
  const dx = ax - bx, dy = ay - by;
  return dx * dx + dy * dy;
};
JJ.angleDiff = (a, b) => {
  let d = (b - a) % JJ.TAU;
  if (d > Math.PI) d -= JJ.TAU;
  if (d < -Math.PI) d += JJ.TAU;
  return d;
};

// Pick from a { key: weight } object.
JJ.weightedKey = (weights) => {
  let total = 0;
  for (const k in weights) total += weights[k];
  let r = Math.random() * total;
  for (const k in weights) {
    r -= weights[k];
    if (r <= 0) return k;
  }
  return Object.keys(weights)[0];
};

// Pick n distinct items from an array using a weight function.
JJ.weightedSample = (items, n, weightFn) => {
  const pool = items.slice();
  const out = [];
  while (out.length < n && pool.length) {
    let total = 0;
    for (const it of pool) total += weightFn(it);
    let r = Math.random() * total;
    let idx = 0;
    for (; idx < pool.length; idx++) {
      r -= weightFn(pool[idx]);
      if (r <= 0) break;
    }
    idx = Math.min(idx, pool.length - 1);
    out.push(pool[idx]);
    pool.splice(idx, 1);
  }
  return out;
};

// Deterministic hash for procedural background decoration.
JJ.hash2 = (x, y) => {
  let h = (x * 374761393 + y * 668265263) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967295;
};

JJ.formatTime = (t) => {
  const m = Math.floor(t / 60);
  const s = Math.floor(t % 60);
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
};

JJ.formatNum = (n) => {
  if (n >= 1e6) return (n / 1e6).toFixed(1) + 'M';
  if (n >= 1e4) return (n / 1e3).toFixed(1) + 'k';
  return String(Math.round(n));
};

// Remove entries flagged `dead` in place (no allocation).
JJ.compact = (arr) => {
  let j = 0;
  for (let i = 0; i < arr.length; i++) {
    const o = arr[i];
    if (!o.dead) arr[j++] = o;
  }
  arr.length = j;
};

// Uniform grid for fast neighbour queries. Each entity is bucketed by centre;
// queries pad their radius by the largest entity radius seen this frame.
JJ.SpatialGrid = class {
  constructor(cell) {
    this.cell = cell;
    this.map = new Map();
    this.maxR = 0;
    this.frames = 0;
  }
  clear() {
    if (++this.frames % 240 === 0) this.map.clear();
    else for (const arr of this.map.values()) arr.length = 0;
    this.maxR = 0;
  }
  key(ix, iy) {
    return (ix + 32768) * 65536 + (iy + 32768);
  }
  insert(e) {
    const ix = Math.floor(e.x / this.cell), iy = Math.floor(e.y / this.cell);
    const k = this.key(ix, iy);
    let arr = this.map.get(k);
    if (!arr) this.map.set(k, (arr = []));
    arr.push(e);
    if (e.r > this.maxR) this.maxR = e.r;
  }
  // Calls fn(e) for every entity whose centre may lie within r (+maxR) of x,y.
  each(x, y, r, fn) {
    const R = r + this.maxR;
    const c = this.cell;
    const x0 = Math.floor((x - R) / c), x1 = Math.floor((x + R) / c);
    const y0 = Math.floor((y - R) / c), y1 = Math.floor((y + R) / c);
    for (let ix = x0; ix <= x1; ix++) {
      for (let iy = y0; iy <= y1; iy++) {
        const arr = this.map.get(this.key(ix, iy));
        if (!arr) continue;
        for (let i = 0; i < arr.length; i++) {
          if (fn(arr[i]) === false) return;
        }
      }
    }
  }
};
