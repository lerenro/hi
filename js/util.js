'use strict';
// Общие утилиты: случайность, шум, математика, цвета.
const J = (window.J = {});

J.TAU = Math.PI * 2;
J.clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
J.lerp = (a, b, t) => a + (b - a) * t;
J.dist = (ax, ay, bx, by) => Math.hypot(ax - bx, ay - by);
J.angDiff = (a, b) => {
  let d = (b - a) % J.TAU;
  if (d > Math.PI) d -= J.TAU;
  if (d < -Math.PI) d += J.TAU;
  return d;
};

// Детерминированный генератор (mulberry32)
J.rng = function (seed) {
  let a = seed >>> 0;
  const f = () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  f.int = (n) => Math.floor(f() * n);
  f.range = (a, b) => a + f() * (b - a);
  f.pick = (arr) => arr[Math.floor(f() * arr.length)];
  f.chance = (p) => f() < p;
  f.shuffle = (arr) => {
    const r = arr.slice();
    for (let i = r.length - 1; i > 0; i--) {
      const j = Math.floor(f() * (i + 1));
      [r[i], r[j]] = [r[j], r[i]];
    }
    return r;
  };
  return f;
};
J.R = J.rng((Date.now() ^ (Math.random() * 1e9)) >>> 0);

J.hash2 = (x, y, s) => {
  let h = (Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263) + Math.imul(s | 0, 1442695041)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
};

J.noise2 = (x, y, s) => {
  const xi = Math.floor(x), yi = Math.floor(y);
  const xf = x - xi, yf = y - yi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  const a = J.hash2(xi, yi, s), b = J.hash2(xi + 1, yi, s);
  const c = J.hash2(xi, yi + 1, s), d = J.hash2(xi + 1, yi + 1, s);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
};

J.fbm = (x, y, s, oct = 4) => {
  let t = 0, amp = 1, f = 1, n = 0;
  for (let i = 0; i < oct; i++) {
    t += J.noise2(x * f, y * f, s + i * 101) * amp;
    n += amp;
    amp *= 0.5;
    f *= 2;
  }
  return t / n;
};

J.pickW = (rand, items, key = 'w') => {
  let total = 0;
  for (const it of items) total += it[key];
  let r = rand() * total;
  for (const it of items) {
    r -= it[key];
    if (r <= 0) return it;
  }
  return items[items.length - 1];
};

// Цвета
J.hexToRgb = (h) => {
  h = h.replace('#', '');
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  const n = parseInt(h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};
J.rgbToHex = (r, g, b) =>
  '#' + [r, g, b].map((v) => J.clamp(Math.round(v), 0, 255).toString(16).padStart(2, '0')).join('');
J.shade = (hex, amt) => {
  const [r, g, b] = J.hexToRgb(hex);
  if (amt >= 0) return J.rgbToHex(r + (255 - r) * amt, g + (255 - g) * amt, b + (255 - b) * amt);
  return J.rgbToHex(r * (1 + amt), g * (1 + amt), b * (1 + amt));
};
J.mix = (a, b, t) => {
  const A = J.hexToRgb(a), B = J.hexToRgb(b);
  return J.rgbToHex(J.lerp(A[0], B[0], t), J.lerp(A[1], B[1], t), J.lerp(A[2], B[2], t));
};
J.rgba = (hex, a) => {
  const [r, g, b] = J.hexToRgb(hex);
  return `rgba(${r},${g},${b},${a})`;
};

J.esc = (s) =>
  String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

J.fmtMoney = (n) => '$' + Math.floor(n).toLocaleString('ru-RU');
J.fmtClock = (min) => {
  const m = Math.floor(min) % 1440;
  return String(Math.floor(m / 60)).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0');
};
J.plural = (n, one, few, many) => {
  const a = Math.abs(n) % 100, b = a % 10;
  if (a > 10 && a < 20) return many;
  if (b > 1 && b < 5) return few;
  if (b === 1) return one;
  return many;
};

J.store = {
  get(k) {
    try {
      const v = localStorage.getItem(k);
      return v ? JSON.parse(v) : null;
    } catch (e) {
      return null;
    }
  },
  set(k, v) {
    try {
      localStorage.setItem(k, JSON.stringify(v));
      return true;
    } catch (e) {
      return false;
    }
  },
  del(k) {
    try {
      localStorage.removeItem(k);
    } catch (e) {}
  },
};

// Буквенные ранги стендов → числа
J.RANK = { A: 5, B: 4, C: 3, D: 2, E: 1, '∞': 6, '-': 0, '?': 2 };
J.rankNum = (r) => (r in J.RANK ? J.RANK[r] : 2);
