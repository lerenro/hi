'use strict';
// Модели машин: обтекаемый кузов-лофт (сечения вдоль длины со сглаженными нормалями), фаски и скругления углов,
// арки колёс, стёкла отдельной геометрией (прозрачные, с отражением неба), салон (сиденья, приборная панель, руль),
// зеркала, швы дверей, ручки, бамперы, номера по региону, фары и фонари. Колёса — шина с профилем и диск со спицами.
// Атрибуты вершин: color, aRef (0 — матовое, 0..1 — лак/стекло по Френелю, 2 — хром), aGlow (свечение фар ночью).
// Локальная система: +z — вперёд, +x — левый борт, y — вверх.
(function () {
  const CM = (J.CarModels = {});
  const col = (h) => new THREE.Color(h);

  // ---------- Построитель с доп. атрибутами ----------
  class CB {
    constructor(cap = 512) {
      this.cap = cap;
      this.p = new Float32Array(cap * 3);
      this.n = new Float32Array(cap * 3);
      this.c = new Float32Array(cap * 3);
      this.r = new Float32Array(cap);
      this.g = new Float32Array(cap);
      this.v = 0;
    }
    grow(k) {
      if (this.v + k <= this.cap) return;
      let cap = this.cap * 2;
      while (cap < this.v + k) cap *= 2;
      const gr = (a, n) => { const b = new Float32Array(n); b.set(a); return b; };
      this.p = gr(this.p, cap * 3);
      this.n = gr(this.n, cap * 3);
      this.c = gr(this.c, cap * 3);
      this.r = gr(this.r, cap);
      this.g = gr(this.g, cap);
      this.cap = cap;
    }
    vert(x, y, z, nx, ny, nz, c, ref, glow) {
      const o = this.v * 3;
      this.p[o] = x; this.p[o + 1] = y; this.p[o + 2] = z;
      this.n[o] = nx; this.n[o + 1] = ny; this.n[o + 2] = nz;
      this.c[o] = c.r; this.c[o + 1] = c.g; this.c[o + 2] = c.b;
      this.r[this.v] = ref;
      this.g[this.v] = glow;
      this.v++;
    }
    // плоский треугольник (нормаль по грани)
    tri(a, b, c, cl, ref, glow) {
      const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2], vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
      let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
      const l = Math.hypot(nx, ny, nz) || 1;
      nx /= l; ny /= l; nz /= l;
      const rf = ref === undefined ? refOf(cl) : ref, gl = glow || 0;
      this.grow(3);
      this.vert(a[0], a[1], a[2], nx, ny, nz, cl, rf, gl);
      this.vert(b[0], b[1], b[2], nx, ny, nz, cl, rf, gl);
      this.vert(c[0], c[1], c[2], nx, ny, nz, cl, rf, gl);
    }
    quad(a, b, c, d, cl, ref, glow) {
      this.tri(a, b, c, cl, ref, glow);
      this.tri(a, c, d, cl, ref, glow);
    }
    // треугольник со своими нормалями вершин (гладкий)
    triN(a, na, b, nb, c, nc, cl, ref, glow) {
      this.grow(3);
      this.vert(a[0], a[1], a[2], na[0], na[1], na[2], cl, ref, glow);
      this.vert(b[0], b[1], b[2], nb[0], nb[1], nb[2], cl, ref, glow);
      this.vert(c[0], c[1], c[2], nc[0], nc[1], nc[2], cl, ref, glow);
    }
    box(x0, y0, z0, x1, y1, z1, cl, ref, glow, bottom) {
      if (x0 > x1) [x0, x1] = [x1, x0];
      if (y0 > y1) [y0, y1] = [y1, y0];
      if (z0 > z1) [z0, z1] = [z1, z0];
      const p000 = [x0, y0, z0], p100 = [x1, y0, z0], p010 = [x0, y1, z0], p110 = [x1, y1, z0];
      const p001 = [x0, y0, z1], p101 = [x1, y0, z1], p011 = [x0, y1, z1], p111 = [x1, y1, z1];
      this.quad(p011, p111, p110, p010, cl, ref, glow);
      if (bottom) this.quad(p000, p100, p101, p001, cl, ref, glow);
      this.quad(p001, p101, p111, p011, cl, ref, glow);
      this.quad(p100, p000, p010, p110, cl, ref, glow);
      this.quad(p101, p100, p110, p111, cl, ref, glow);
      this.quad(p000, p001, p011, p010, cl, ref, glow);
    }
    // готовая геометрия three.js с матрицей
    geo(g, m, cl, ref, glow) {
      const gg = g.index ? g.toNonIndexed() : g;
      const P = gg.attributes.position.array, N = gg.attributes.normal.array;
      const e = m.elements, nm = new THREE.Matrix3().getNormalMatrix(m).elements;
      const rf = ref === undefined ? refOf(cl) : ref, gl = glow || 0;
      this.grow(P.length / 3);
      for (let i = 0; i < P.length; i += 3) {
        const x = P[i], y = P[i + 1], z = P[i + 2], a = N[i], b = N[i + 1], d = N[i + 2];
        const nx = nm[0] * a + nm[3] * b + nm[6] * d, ny = nm[1] * a + nm[4] * b + nm[7] * d, nz = nm[2] * a + nm[5] * b + nm[8] * d;
        const l = 1 / (Math.hypot(nx, ny, nz) || 1);
        this.vert(e[0] * x + e[4] * y + e[8] * z + e[12], e[1] * x + e[5] * y + e[9] * z + e[13], e[2] * x + e[6] * y + e[10] * z + e[14], nx * l, ny * l, nz * l, cl, rf, gl);
      }
    }
    build(extra) {
      const g = new THREE.BufferGeometry(), n = this.v;
      g.setAttribute('position', new THREE.BufferAttribute(this.p.slice(0, n * 3), 3));
      g.setAttribute('normal', new THREE.BufferAttribute(this.n.slice(0, n * 3), 3));
      g.setAttribute('color', new THREE.BufferAttribute(this.c.slice(0, n * 3), 3));
      if (extra !== false) {
        g.setAttribute('aRef', new THREE.BufferAttribute(this.r.slice(0, n), 1));
        g.setAttribute('aGlow', new THREE.BufferAttribute(this.g.slice(0, n), 1));
      }
      J.fastBounds(g, this.p, n * 3);
      return g;
    }
  }
  CM.CB = CB;

  // ---------- Палитра деталей ----------
  const C = (CM.C = {
    GLASS: col('#0d1218'), GLASSD: col('#0a0d12'), TRIM: col('#17181b'), RUB: col('#0e0e10'), CHROME: col('#c8ccd2'), UNDER: col('#0b0b0c'),
    HEAD: col('#f4f2ea'), HEADB: col('#8a8f96'), TAIL: col('#b3120c'), TAILD: col('#5a0806'), AMBER: col('#e89a24'), REV: col('#e8e8e8'),
    SIGN: col('#ffd84a'), INT: col('#1e1f22'), SEAT: col('#2b2a2c'), SEATB: col('#6a5a48'), DASH: col('#141416'), GRILLE: col('#0c0d0f'),
    MIRROR: col('#9aa4ae'), WIPER: col('#0a0a0a'), PLATEW: col('#eef0f0'), PLATEY: col('#f2cc1c'), PLATEB: col('#121212'),
    INK: col('#16203a'), INKG: col('#1f5a2a'), EU: col('#1f3fa8'), SKIN: col('#c99a78'), SHIRT: col('#3a3e46'),
  });
  // отражательная способность по умолчанию для цвета детали
  const REF = new Map([
    [C.GLASS, 1], [C.GLASSD, 1], [C.TRIM, 0.12], [C.RUB, 0], [C.CHROME, 2], [C.UNDER, 0], [C.HEAD, 0.9], [C.HEADB, 2.2], [C.TAIL, 0.8], [C.TAILD, 0.8],
    [C.AMBER, 0.8], [C.REV, 0.8], [C.INT, 0.05], [C.SEAT, 0.06], [C.SEATB, 0.06], [C.DASH, 0.1], [C.GRILLE, 0.15], [C.MIRROR, 2.1], [C.WIPER, 0],
    [C.PLATEW, 0.15], [C.PLATEY, 0.15], [C.PLATEB, 0.2], [C.INK, 0], [C.INKG, 0], [C.EU, 0.1], [C.SKIN, 0.05], [C.SHIRT, 0.03],
  ]);
  const PAINT_REF = 0.62;
  function refOf(c) {
    const r = REF.get(c);
    return r === undefined ? PAINT_REF : r;
  }

  // ---------- Облик по типу и региону ----------
  // Только для отрисовки: лондонское кэб-такси, токийское такси-универсал и т.п. (физика — по J.VTYPES)
  const LOOK = {
    taxi_london: { H: 1.8, prof: { hood: 0.27, roof0: 0.4, roof1: 0.86, deck: 0.94, nose: 0.52, tail: 0.6, tumble: 0.07, belt: 0.53, round: 0.36, crown: 0.06 }, roundLights: true, chromeGrille: true },
    taxi_japan: { H: 1.52, prof: { hood: 0.3, roof0: 0.44, roof1: 0.74, deck: 0.85, nose: 0.6, tail: 0.73, tumble: 0.1, belt: 0.62, round: 0.14, crown: 0.03 }, chromeGrille: true, boxy: true },
    taxi_usa: { prof: { hood: 0.3, roof0: 0.44, roof1: 0.71, deck: 0.84, nose: 0.6, tail: 0.72, tumble: 0.12, belt: 0.63, round: 0.2, crown: 0.04 }, chromeGrille: true },
    compact: { roundLights: true, smile: true },
    kei: { tallLights: true },
    pickup: { chromeGrille: true, bigGrille: true },
    van: { blackGrille: true },
    sports: { slimLights: true },
  };
  const DRIVE_L = { singapore: 1, japan: 1, london: 1, india: 1, tibet: 1 };
  // номера: фон, буквы, полоса
  const PLATES = {
    usa: { bg: '#eef0f2', fg: '#1a2a6a', band: '#d8803a' }, western: { bg: '#f0e8d0', fg: '#5a2a1a' }, mexico: { bg: '#eef0f2', fg: '#1a3a1a', band: '#c83a2a' },
    japan: { bg: '#eef0e6', fg: '#1f5a2a' }, london: { bg: '#f4f4ee', rear: '#f2c81a', fg: '#111111' }, italy: { bg: '#f4f4f4', fg: '#111111', eu: 1 },
    swiss: { bg: '#f4f4f4', fg: '#111111' }, egypt: { bg: '#f0f0f0', fg: '#111111', top: '#3a7ad8' }, india: { bg: '#f4f4f0', fg: '#111111' },
    singapore: { bg: '#161616', fg: '#e8e8e8' }, tibet: { bg: '#2a4aa8', fg: '#f0f0f0' }, hw: { bg: '#eef0f2', fg: '#1a2a6a' },
  };

  // кусочно-линейная функция по точкам [x, y]
  const pl = (pts) => (x) => {
    if (x <= pts[0][0]) return pts[0][1];
    for (let i = 1; i < pts.length; i++) {
      if (x <= pts[i][0]) {
        const a = pts[i - 1], b = pts[i];
        return a[1] + ((b[1] - a[1]) * (x - a[0])) / Math.max(1e-6, b[0] - a[0]);
      }
    }
    return pts[pts.length - 1][1];
  };
  const sm = (t) => t * t * (3 - 2 * t);

  // ---------- Сглаженная сетка: rows[i][k] = [x, y, z] ----------
  function gridNormals(rows) {
    const ni = rows.length, nk = rows[0].length, out = [];
    const a = [0, 0, 0], b = [0, 0, 0];
    for (let i = 0; i < ni; i++) {
      const R = [];
      for (let k = 0; k < nk; k++) {
        const pi0 = rows[Math.max(0, i - 1)][k], pi1 = rows[Math.min(ni - 1, i + 1)][k];
        const pk0 = rows[i][Math.max(0, k - 1)], pk1 = rows[i][Math.min(nk - 1, k + 1)];
        a[0] = pi1[0] - pi0[0]; a[1] = pi1[1] - pi0[1]; a[2] = pi1[2] - pi0[2];
        b[0] = pk1[0] - pk0[0]; b[1] = pk1[1] - pk0[1]; b[2] = pk1[2] - pk0[2];
        if (Math.hypot(a[0], a[1], a[2]) < 1e-5) { a[0] = 0; a[1] = 0; a[2] = -1; }
        let nx = a[1] * b[2] - a[2] * b[1], ny = a[2] * b[0] - a[0] * b[2], nz = a[0] * b[1] - a[1] * b[0];
        const l = Math.hypot(nx, ny, nz);
        R.push(l < 1e-7 ? null : [nx / l, ny / l, nz / l]);
      }
      out.push(R);
    }
    return out;
  }
  // лофт: rows — полные контуры; zone(i, j) → [цель, цвет, отражение, свечение] или null (j — сегмент половины контура)
  function loft(rows, zone, half) {
    const N = gridNormals(rows);
    const nk = rows[0].length;
    for (let i = 0; i < rows.length - 1; i++)
      for (let k = 0; k < nk - 1; k++) {
        const j = k < half ? k : nk - 2 - k;
        const z = zone(i, j, k >= half);
        if (!z) continue;
        const pa = rows[i][k], pb = rows[i + 1][k], pc = rows[i + 1][k + 1], pd = rows[i][k + 1];
        // нормаль грани (на случай вырожденных точек и для проверки обхода)
        const fx = (pb[1] - pa[1]) * (pd[2] - pa[2]) - (pb[2] - pa[2]) * (pd[1] - pa[1]);
        const fy = (pb[2] - pa[2]) * (pd[0] - pa[0]) - (pb[0] - pa[0]) * (pd[2] - pa[2]);
        const fz = (pb[0] - pa[0]) * (pd[1] - pa[1]) - (pb[1] - pa[1]) * (pd[0] - pa[0]);
        const fl = Math.hypot(fx, fy, fz) || 1;
        const F = [fx / fl, fy / fl, fz / fl];
        const nA = N[i][k] || F, nB = N[i + 1][k] || F, nC = N[i + 1][k + 1] || F, nD = N[i][k + 1] || F;
        const [gb, cl, ref, glow] = z;
        const rf = ref === undefined ? refOf(cl) : ref, gl = glow || 0;
        // ожидаемая нормаль снаружи — средняя по вершинам; обход переворачиваем при несовпадении
        const ex = nA[0] + nB[0] + nC[0] + nD[0], ey = nA[1] + nB[1] + nC[1] + nD[1], ez = nA[2] + nB[2] + nC[2] + nD[2];
        const flip = F[0] * ex + F[1] * ey + F[2] * ez < 0;
        const inv = z[4]; // внутренняя сторона (обивка): обратный обход и нормали
        if (inv) {
          const ng = (n) => [-n[0], -n[1], -n[2]];
          if (!flip) { gb.triN(pa, ng(nA), pc, ng(nC), pb, ng(nB), cl, rf, gl); gb.triN(pa, ng(nA), pd, ng(nD), pc, ng(nC), cl, rf, gl); }
          else { gb.triN(pa, ng(nA), pb, ng(nB), pc, ng(nC), cl, rf, gl); gb.triN(pa, ng(nA), pc, ng(nC), pd, ng(nD), cl, rf, gl); }
        } else if (!flip) {
          gb.triN(pa, nA, pb, nB, pc, nC, cl, rf, gl);
          gb.triN(pa, nA, pc, nC, pd, nD, cl, rf, gl);
        } else {
          gb.triN(pa, nA, pc, nC, pb, nB, cl, rf, gl);
          gb.triN(pa, nA, pd, nD, pc, nC, cl, rf, gl);
        }
      }
  }
  const mirror = (half) => {
    const full = half.slice();
    for (let k = half.length - 2; k >= 0; k--) full.push([-half[k][0], half[k][1], half[k][2]]);
    return full;
  };
  // плоский многоугольник веером от центра (крышка носа/кормы)
  function fan(gb, ring, nrm, cl) {
    let cx = 0, cy = 0, cz = 0;
    for (const p of ring) { cx += p[0]; cy += p[1]; cz += p[2]; }
    const c = [cx / ring.length, cy / ring.length, cz / ring.length];
    for (let k = 0; k < ring.length; k++) {
      const a = ring[k], b = ring[(k + 1) % ring.length];
      const ux = a[0] - c[0], uy = a[1] - c[1], uz = a[2] - c[2], vx = b[0] - c[0], vy = b[1] - c[1], vz = b[2] - c[2];
      const nz = (uy * vz - uz * vy) * nrm[0] + (uz * vx - ux * vz) * nrm[1] + (ux * vy - uy * vx) * nrm[2];
      if (nz >= 0) gb.triN(c, nrm, a, nrm, b, nrm, cl, refOf(cl), 0);
      else gb.triN(c, nrm, b, nrm, a, nrm, cl, refOf(cl), 0);
    }
  }
  // плоский четырёхугольник на плоскости z = const (передок/корма): x0..x1, y0..y1, s — сторона (+1 нос, -1 корма)
  function plate(gb, x0, x1, y0, y1, z, s, cl, ref, glow) {
    const a = [x0, y0, z], b = [x1, y0, z], c = [x1, y1, z], d = [x0, y1, z];
    const n = [0, 0, s];
    const rf = ref === undefined ? refOf(cl) : ref, gl = glow || 0;
    if ((x1 - x0) * s > 0) { gb.triN(a, n, b, n, c, n, cl, rf, gl); gb.triN(a, n, c, n, d, n, cl, rf, gl); }
    else { gb.triN(a, n, c, n, b, n, cl, rf, gl); gb.triN(a, n, d, n, c, n, cl, rf, gl); }
  }
  // диск (круглая фара) на плоскости z
  function disc(gb, x, y, z, r, s, cl, ref, glow, seg = 12) {
    const n = [0, 0, s];
    for (let k = 0; k < seg; k++) {
      const a0 = (k / seg) * Math.PI * 2, a1 = ((k + 1) / seg) * Math.PI * 2;
      const p0 = [x + Math.cos(a0) * r, y + Math.sin(a0) * r, z], p1 = [x + Math.cos(a1) * r, y + Math.sin(a1) * r, z];
      if (s > 0) gb.triN([x, y, z], n, p0, n, p1, n, cl, ref, glow);
      else gb.triN([x, y, z], n, p1, n, p0, n, cl, ref, glow);
    }
  }

  // ---------- Номерные знаки: шрифт 3×5 и текст по региону ----------
  const FONT = {
    0: ['111', '101', '101', '101', '111'], 1: ['010', '110', '010', '010', '111'], 2: ['111', '001', '111', '100', '111'], 3: ['111', '001', '011', '001', '111'],
    4: ['101', '101', '111', '001', '001'], 5: ['111', '100', '111', '001', '111'], 6: ['111', '100', '111', '101', '111'], 7: ['111', '001', '010', '010', '010'],
    8: ['111', '101', '111', '101', '111'], 9: ['111', '101', '111', '001', '111'], A: ['010', '101', '111', '101', '101'], B: ['110', '101', '110', '101', '110'],
    C: ['011', '100', '100', '100', '011'], E: ['111', '100', '110', '100', '111'], H: ['101', '101', '111', '101', '101'], K: ['101', '110', '100', '110', '101'],
    M: ['101', '111', '111', '101', '101'], P: ['110', '101', '110', '100', '100'], T: ['111', '010', '010', '010', '010'], X: ['101', '101', '010', '101', '101'],
    '-': ['000', '000', '111', '000', '000'],
  };
  function plateText(region, seed) {
    let h = 2166136261;
    for (let i = 0; i < seed.length; i++) h = Math.imul(h ^ seed.charCodeAt(i), 16777619);
    const L = 'ABCEHKMPTX', rn = () => ((h = Math.imul(h ^ (h >>> 13), 1274126177)) >>> 0) / 4294967296;
    const d = () => String(Math.floor(rn() * 10)), l = () => L[Math.floor(rn() * L.length)];
    if (region === 'japan') return d() + d() + '-' + d() + d();
    if (region === 'italy' || region === 'swiss') return l() + l() + d() + d() + d() + l() + l();
    if (region === 'london') return l() + l() + d() + d() + l() + l() + l();
    if (region === 'usa' || region === 'hw' || region === 'western' || region === 'mexico') return d() + l() + l() + l() + d() + d() + d();
    return d() + d() + d() + l() + l() + d();
  }

  // номерной знак на плоскости z (s: +1 — нос, -1 — корма), центр по высоте y
  function drawPlate(body, tid, seed, region, hi, z, s, y, rear) {
    const pst = PLATES[region] || PLATES.usa;
    const pw = region === 'usa' || region === 'mexico' || region === 'western' || region === 'japan' ? 0.16 : 0.24;
    const ph = region === 'usa' || region === 'mexico' || region === 'western' || region === 'japan' ? 0.075 : 0.055;
    const bg = tid === 'kei' && region === 'japan' ? C.PLATEY : rear && pst.rear ? col(pst.rear) : col(pst.bg);
    const fg = tid === 'kei' && region === 'japan' ? C.PLATEB : col(pst.fg);
    plate(body, -pw - 0.01, pw + 0.01, y - ph - 0.01, y + ph + 0.01, z, s, C.TRIM, 0.1);
    plate(body, -pw, pw, y - ph, y + ph, z + s * 0.002, s, bg, 0.2);
    if (pst.eu) plate(body, s * -pw, s * (-pw + 0.035), y - ph, y + ph, z + s * 0.003, s, C.EU, 0.1);
    if (pst.band) plate(body, -pw, pw, y + ph - 0.016, y + ph - 0.004, z + s * 0.003, s, col(pst.band), 0.1);
    if (pst.top) plate(body, -pw, pw, y + ph - 0.03, y + ph, z + s * 0.003, s, col(pst.top), 0.1);
    // надпись номера: буквы и цифры шрифтом 3×5 (вблизи), вдали — просто полоса
    const txt = plateText(region, seed);
    if (!hi) {
      plate(body, -pw * 0.8, pw * 0.8, y - ph * 0.4, y + ph * 0.3, z + s * 0.004, s, fg, 0);
      return;
    }
    const gh = (pst.top || pst.band ? 1.25 : 1.45) * ph, gw = Math.min((pw * 1.7) / (txt.length * 1.25), gh * 0.62);
    const x0 = -(txt.length * gw * 1.25 - gw * 0.25) / 2 + (pst.eu ? 0.018 : 0), yb = y - gh / 2 - (pst.top || pst.band ? 0.012 : 0);
    for (let k = 0; k < txt.length; k++) {
      const gl = FONT[txt[k]];
      if (!gl) continue;
      const cx = x0 + k * gw * 1.25, px = gw / 3, py = gh / 5;
      for (let r = 0; r < 5; r++) {
        const row = gl[r];
        for (let c = 0; c < 3; c++) {
          if (row[c] !== '1') continue;
          let e = c;
          while (e < 2 && row[e + 1] === '1') e++;
          const xa = cx + c * px, xb = cx + (e + 1) * px, ya = yb + (4 - r) * py;
          plate(body, s * xa, s * xb, ya, ya + py * 1.02, z + s * 0.004, s, fg, 0);
          c = e;
        }
      }
    }
  }

  // ---------- Легковой кузов (седан, хэтчбек, такси, полиция, спорткар, кей-кар, малолитражка, пикап, фургон) ----------
  CM.buildCar = function (t, paint, livery, region, lod) {
    const lk = LOOK[t.id + '_' + region] || LOOK[t.id] || {};
    const P = Object.assign({}, t.prof, lk.prof || {});
    const L = t.L, W = t.W, H = lk.H || t.H, wr = t.wr, wb = t.wb;
    const hi = lod !== 1;
    const body = new CB(hi ? 6000 : 2400), glass = new CB(hi ? 600 : 300), brake = new CB(96);
    const zF = L / 2, zR = -L / 2, hwM = W / 2;
    const zoff = t.shape === 'van' ? 0.3 : 0;
    const c0 = wr * 0.62; // клиренс
    const yB = H * (P.belt || 0.64), yN = H * P.nose, yD = H * P.tail;
    const rc = Math.min(0.5, (P.round || 0.26) * (W / 1.8)); // радиус скругления углов в плане
    const crown = P.crown === undefined ? 0.04 : P.crown;
    const dWs = L * P.hood, dR0 = L * P.roof0, dR1 = L * P.roof1, dRw = L * P.deck;
    const hatch = P.deck > 0.92, bed = !!t.bed, van = t.shape === 'van';
    const second = livery ? col(livery[1]) : null;
    const drL = DRIVE_L[region] ? -1 : 1; // сторона руля: +1 — слева (+x)
    // оси колёс (расстояние от носа)
    const dAxF = L / 2 - (wb / 2 + zoff), dAxR = L / 2 + wb / 2 - zoff;
    const Ra = wr * 1.13, wy = wr + 0.02;
    // профиль верха (центральная линия) по расстоянию от носа
    const rwBase = hatch ? Math.min(yB, yD + 0.02) : yB - 0.02;
    const topPts = [[0, yN - 0.12], [0.05, yN - 0.045], [0.14, yN - 0.01], [0.3, yN], [dWs, yB - 0.01]];
    if (bed) topPts.push([dRw, yB], [dRw + 0.01, yB - 0.02], [L - 0.06, yD], [L, yD - 0.05]);
    else if (hatch) topPts.push([dRw, rwBase], [L - 0.04, yD - 0.02], [L, yD - 0.1]);
    else topPts.push([dRw, rwBase], [Math.min(L - 0.3, dRw + 0.28), yD + 0.01], [L - 0.12, yD], [L - 0.03, yD - 0.05], [L, yD - 0.12]);
    const ytAt = pl(topPts);
    const ybBase = pl([[0, c0 + 0.16], [0.12, c0 + 0.08], [0.35, c0 + 0.01], [0.6, c0], [L - 0.6, c0], [L - 0.35, c0 + 0.02], [L - 0.12, c0 + 0.1], [L, c0 + 0.2]]);
    const ybAt = (d) => {
      let y = ybBase(d);
      for (const da of [dAxF, dAxR]) {
        const dz = d - da;
        if (Math.abs(dz) < Ra) y = Math.max(y, wy + Math.sqrt(Ra * Ra - dz * dz));
      }
      return y;
    };
    const hwAt = (d) => {
      const e = Math.min(d, L - d);
      let h = hwM;
      if (e < rc) h -= rc - Math.sqrt(Math.max(0, rc * rc - (rc - e) * (rc - e)));
      return h;
    };
    // точки левой половины сечения нижней части кузова
    const lowSec = (d) => {
      const hw = hwAt(d), yb = ybAt(d), yt = ytAt(d);
      let ys = yt - Math.min(0.09, (yt - yb) * 0.3);
      if (ys < yb + 0.08) ys = Math.min(yt - 0.02, yb + 0.08);
      const z = zF - d;
      const bw = Math.min(0.13, hw * 0.3);
      return [[hw - 0.08, yb, z], [hw - 0.012, yb + Math.min(0.05, (ys - yb) * 0.3), z], [hw, yb + (ys - yb) * 0.5, z], [hw - 0.008, ys, z],
        [hw - bw * 0.35, ys + (yt - ys) * 0.65, z], [hw - bw, yt, z], [hw * 0.45, yt + crown * 0.8, z], [0, yt + crown, z]];
    };
    // станции вдоль длины
    const ds = [];
    const nEnd = hi ? [0, 0.02, 0.06, 0.12, 0.2, 0.3, 0.42] : [0, 0.06, 0.18, 0.36];
    for (const e of nEnd) { if (e < rc + 0.2 || e < 0.2) { ds.push(e); ds.push(L - e); } }
    const nArc = hi ? 10 : 5;
    for (const da of [dAxF, dAxR]) {
      for (let k = 0; k <= nArc; k++) ds.push(da - Ra * Math.cos((k / nArc) * Math.PI));
      ds.push(da - Ra - 0.02, da + Ra + 0.02);
    }
    // двери (швы) и ключевые точки профиля
    const dDoorF = dAxF + Ra + 0.08, dDoorR = (dR1 + dRw) / 2 + 0.02, dDoorB = (dR0 + dR1) / 2 + (t.id === 'sports' ? 0.35 : 0.06);
    const seams = van ? [dDoorF, dWs + 0.75] : t.id === 'sports' || t.id === 'compact' || bed ? [dDoorF, dDoorB + 0.25] : [dDoorF, dDoorB, Math.min(dDoorR, dAxR - Ra - 0.05)];
    for (const s of seams) ds.push(s - 0.007, s, s + 0.007);
    ds.push(0.3, dWs - 0.04, dWs, dWs + 0.02, dRw - 0.02, dRw, dRw + 0.02, L / 2);
    if (hi) for (let d = 0.5; d < L - 0.5; d += 0.45) ds.push(d);
    ds.sort((a, b) => a - b);
    const D = [];
    for (const d of ds) if (d >= 0 && d <= L && (!D.length || d - D[D.length - 1] > 0.004)) D.push(d);
    const rows = D.map((d) => mirror(lowSec(d)));
    const half = 7;
    const inCab = (d) => d > dWs + 0.005 && d < dRw - 0.005;
    const inBed = (d) => bed && d > dRw + 0.015 && d < L - 0.1;
    const seamAt = (d) => seams.some((s) => Math.abs(d - s) < 0.0045);
    const sill = van || bed || t.id === 'kei' ? C.TRIM : null;
    const twoTone = (d, j) => (second && j >= 1 && j <= 2 && d > dAxF - Ra && d < dAxR + Ra ? second : paint);
    loft(rows, (i, j) => {
      const d = (D[i] + D[i + 1]) / 2;
      if ((inCab(d) || inBed(d)) && j >= 5) return null; // салон / кузов пикапа открыт сверху
      if (j === 0) return [body, C.UNDER];
      if (seamAt(d) && j >= 1 && j <= 3) return [body, C.TRIM, 0];
      if (j === 1 && sill) return [body, sill];
      return [body, twoTone(d, j)];
    }, half);
    // днище: полоса между нижними кромками
    for (let i = 0; i < rows.length - 1; i++) {
      const a = rows[i][0], b = rows[i + 1][0], c = rows[i + 1][14], d2 = rows[i][14];
      body.quad(d2, c, b, a, C.UNDER, 0);
    }
    // торцы: нос и корма
    fan(body, rows[0], [0, 0, 1], paint);
    fan(body, rows[rows.length - 1], [0, 0, -1], paint);
    // салон: внутренние борта и пол
    const floorY = c0 + 0.16;
    const tub = (d0, d1, clr) => {
      const iw = [];
      for (const d of D) if (d >= d0 - 1e-6 && d <= d1 + 1e-6) iw.push(d);
      for (let i = 0; i < iw.length - 1; i++) {
        const sa = lowSec(iw[i]), sb = lowSec(iw[i + 1]);
        for (const s of [1, -1]) {
          const a = [s * sa[5][0], sa[5][1], sa[5][2]], b = [s * sb[5][0], sb[5][1], sb[5][2]];
          const a2 = [s * (sa[5][0] - 0.02), floorY, sa[5][2]], b2 = [s * (sb[5][0] - 0.02), floorY, sb[5][2]];
          if (s > 0) body.quad(a, a2, b2, b, clr, 0.05);
          else body.quad(a, b, b2, a2, clr, 0.05);
        }
      }
      const s0 = lowSec(d0), s1 = lowSec(d1);
      body.quad([s0[5][0], floorY, zF - d0], [s1[5][0], floorY, zF - d1], [-s1[5][0], floorY, zF - d1], [-s0[5][0], floorY, zF - d0], clr, 0.04);
      // торцевые стенки
      for (const [dd, sg] of [[d0, -1], [d1, 1]]) {
        const s = lowSec(dd), z = zF - dd;
        plate(body, -s[5][0], s[5][0], floorY, s[5][1] + 0.01, z, sg, clr, 0.05);
      }
    };
    tub(dWs, dRw, C.INT);
    if (bed) tub(dRw + 0.015, L - 0.1, C.TRIM);
    // ---------- Верх (салон под стеклом) ----------
    const tumble = P.tumble;
    const crR = crown * 0.9 + 0.02;
    const gSec = (d, mode) => {
      // mode: 0 — основание лобового, 1 — крыша, 2 — основание заднего
      const s = lowSec(d);
      const hwB = s[5][0] + 0.01, yb0 = s[5][1];
      if (mode === 1) {
        const hwR = hwB - tumble;
        const yr = H;
        return [[hwB, yb0, s[0][2]], [hwR + 0.012, yr - 0.07, s[0][2]], [hwR - 0.06, yr - 0.005, s[0][2]], [hwR * 0.5, yr + crR * 0.8, s[0][2]], [0, yr + crR, s[0][2]]];
      }
      const yc = yb0 + 0.008, z = s[0][2];
      return [[hwB, yb0, z], [hwB - 0.015, yc, z], [hwB - 0.09, yc + 0.003, z], [hwB * 0.5, yc + crown * 0.5, z], [0, yc + crown * 0.6, z]];
    };
    const gD = [dWs, dR0];
    const nRoof = hi ? 4 : 2;
    for (let k = 1; k < nRoof; k++) gD.push(dR0 + ((dR1 - dR0) * k) / nRoof);
    gD.push(dR1, dRw);
    const gRows = gD.map((d, i) => {
      const mode = i === 0 ? 0 : i === gD.length - 1 ? 2 : 1;
      const r = gSec(d, mode);
      // небольшой подъём середины крыши
      if (mode === 1) {
        const u = (d - dR0) / Math.max(0.01, dR1 - dR0);
        const lift = Math.sin(u * Math.PI) * 0.025;
        for (const p of r) p[1] += lift * (p[0] < hwM * 0.6 ? 1 : 0.4);
      }
      return mirror(r);
    });
    const nG = gRows.length;
    const vanCargo = (d) => van && d > dWs + 0.95;
    const gZone = (i, j, inner) => {
      const last = i === nG - 2, first = i === 0;
      const d = (gD[i] + gD[i + 1]) / 2;
      if (j === 0) {
        // боковые стёкла; у седана задняя стойка (C) — сплошная
        if (vanCargo(d)) return [body, paint];
        if (last && !hatch && !van) return [body, paint];
        return [glass, C.GLASS];
      }
      if (j === 1) return [body, first || last ? paint : paint];
      if (first) return [glass, C.GLASS];
      if (last) return van ? [body, paint] : [glass, C.GLASS];
      return [body, t.id === 'police' || !second ? paint : paint];
    };
    loft(gRows, gZone, 4);
    // обивка изнутри: крыша и стойки (видно через стёкла)
    loft(gRows, (i, j) => {
      const g = gZone(i, j);
      return g && g[0] === body ? [body, C.INT, 0.04, 0, true] : null;
    }, 4);
    // у фургона задняя стенка крыши: стекло-«окна» поверх краски
    const rwS = gSec(dRw, 2);
    // ---------- Стойки, окантовка, уплотнители ----------
    const gSide = (d) => {
      const s = gSec(d, 1);
      return s;
    };
    // стойка B (чёрная) между дверьми
    if (!van && t.id !== 'sports' && t.id !== 'compact' && !bed) {
      for (const sg of [1, -1]) {
        const s0 = gSide(dDoorB - 0.045), s1 = gSide(dDoorB + 0.045);
        const o = 0.006;
        const a = [sg * (s0[0][0] + o), s0[0][1], s0[0][2]], b = [sg * (s0[1][0] + o), s0[1][1], s0[1][2]], c = [sg * (s1[1][0] + o), s1[1][1], s1[1][2]], d = [sg * (s1[0][0] + o), s1[0][1], s1[0][2]];
        if (sg > 0) body.quad(a, d, c, b, C.TRIM, 0.3);
        else body.quad(a, b, c, d, C.TRIM, 0.3);
      }
    }
    // молдинг по нижней кромке стёкол
    for (const sg of [1, -1]) {
      for (let i = 0; i < gD.length - 1; i++) {
        const sa = lowSec(gD[i]), sb = lowSec(gD[i + 1]);
        const a = [sg * (sa[5][0] + 0.012), sa[5][1] + 0.004, sa[5][2]], b = [sg * (sb[5][0] + 0.012), sb[5][1] + 0.004, sb[5][2]];
        const a2 = [sg * (sa[5][0] + 0.03), sa[5][1] - 0.012, sa[5][2]], b2 = [sg * (sb[5][0] + 0.03), sb[5][1] - 0.012, sb[5][2]];
        if (sg > 0) body.quad(a, a2, b2, b, t.id === 'taxi' && region === 'usa' ? C.CHROME : C.TRIM, 0.3);
        else body.quad(a, b, b2, a2, t.id === 'taxi' && region === 'usa' ? C.CHROME : C.TRIM, 0.3);
      }
    }
    // дворники
    {
      const s = lowSec(dWs + 0.03);
      for (const xo of [0.28, -0.22]) {
        const x0 = xo - 0.26, x1 = xo + 0.22, y = s[7][1] + 0.03, z = zF - dWs - 0.06;
        body.box(x0, y, z - 0.012, x1, y + 0.018, z + 0.012, C.WIPER, 0);
      }
    }
    // ---------- Салон ----------
    if (hi) {
      const seatC = t.id === 'taxi' && region === 'london' ? C.SEAT : (t.id === 'compact' || t.id === 'kei') ? C.SEATB : C.SEAT;
      const zDash = zF - dWs - 0.05;
      const sw = lowSec(dWs + 0.4)[5][0] - 0.04;
      // приборная панель
      body.box(-sw, yB - 0.24, zDash - 0.42, sw, yB + 0.03, zDash, C.DASH, 0.1);
      // руль
      const swx = drL * Math.min(0.38, sw * 0.5), swy = yB + 0.06, swz = zDash - 0.5;
      const tor = new THREE.TorusGeometry(0.17, 0.022, 4, 12);
      const m = new THREE.Matrix4().makeRotationX(-0.45);
      m.setPosition(swx, swy, swz);
      body.geo(tor, m, C.DASH, 0.1);
      body.box(swx - 0.03, swy - 0.2, swz + 0.02, swx + 0.03, swy - 0.02, swz + 0.12, C.DASH, 0.1);
      // сиденья
      const zSeat = (zF - dR0 + zF - dR1) / 2 + (hatch || van ? 0.15 : 0.05);
      const seatH = Math.min(0.5, (H - floorY) * 0.42);
      const row = (z, n, w) => {
        for (let k = 0; k < n; k++) {
          const x = n === 1 ? 0 : (k - (n - 1) / 2) * (sw * 2 * 0.52);
          body.box(x - w / 2, floorY, z - 0.25, x + w / 2, floorY + 0.24, z + 0.22, seatC, 0.06);
          body.box(x - w / 2, floorY + 0.2, z - 0.32, x + w / 2, floorY + 0.2 + seatH, z - 0.2, seatC, 0.06);
          body.box(x - 0.11, floorY + 0.24 + seatH, z - 0.31, x + 0.11, floorY + 0.4 + seatH, z - 0.22, seatC, 0.06);
        }
      };
      if (!van) row(zSeat + 0.15, 2, 0.46);
      else row(zF - dWs - 0.9, 2, 0.46);
      if (!bed && !van && t.id !== 'sports' && dR1 - dR0 > 1.1) row(zSeat - 0.75, 1, sw * 1.7);
      if (van) {
        // перегородка грузового отсека
        const s = lowSec(dWs + 1.25);
        plate(body, -s[5][0], s[5][0], floorY, H - 0.05, s[0][2], 1, C.INT, 0.05);
      }
    }
    // ---------- Зеркала ----------
    {
      const s = lowSec(dWs + 0.18);
      for (const sg of [1, -1]) {
        const x = sg * (s[5][0] + 0.02), y = s[5][1] + 0.1, z = s[0][2];
        const xo = x + sg * 0.15;
        body.box(x, y - 0.03, z - 0.04, x + sg * 0.08, y + 0.01, z + 0.02, t.id === 'taxi' && region !== 'usa' ? C.CHROME : C.TRIM, 0.2);
        // корпус зеркала (каплевидный: ящик со срезанным носом)
        const hx = sg * 0.05, yy0 = y - 0.045, yy1 = y + 0.05;
        const m0 = [x + sg * 0.06, yy0 + 0.01, z + 0.045], m1 = [xo + hx * 0.2, yy0 + 0.012, z + 0.03], m2 = [xo + hx * 0.2, yy1 - 0.008, z + 0.03], m3 = [x + sg * 0.06, yy1 - 0.01, z + 0.045];
        const b0 = [x + sg * 0.065, yy0, z - 0.035], b1 = [xo + hx * 0.3, yy0, z - 0.03], b2 = [xo + hx * 0.3, yy1, z - 0.03], b3 = [x + sg * 0.065, yy1, z - 0.035];
        const pc = livery ? C.TRIM : van || bed || t.id === 'kei' ? C.TRIM : paint;
        const Q = (a, b, c, d, cl, rf) => (sg > 0 ? body.quad(a, b, c, d, cl, rf) : body.quad(a, d, c, b, cl, rf));
        Q(m0, m1, m2, m3, pc);
        Q(m1, b1, b2, m2, pc);
        Q(m3, m2, b2, b3, pc);
        Q(m0, b0, b1, m1, pc);
        Q(m0, m3, b3, b0, pc);
        Q(b0, b3, b2, b1, C.MIRROR, 2.1); // зеркальная гладь назад
      }
    }
    // ---------- Ручки дверей ----------
    for (const sd of seams.slice(1).concat([dDoorF])) {
      const d = sd + (sd === dDoorF ? 0 : 0) - 0.12;
      const dd = sd === seams[seams.length - 1] && seams.length > 2 ? sd - 0.14 : sd === dDoorF ? null : sd - 0.14;
      if (dd === null) continue;
      const s = lowSec(dd);
      for (const sg of [1, -1]) {
        const y = s[3][1] - 0.07, x = sg * (s[3][0] + 0.004), z = s[0][2];
        body.box(x, y - 0.018, z - 0.1, x + sg * 0.018, y + 0.018, z + 0.04, livery || van || bed ? C.TRIM : C.CHROME);
      }
      void d;
    }
    // швы капота и багажника (поперечные линии)
    const hoodSeam = (d) => {
      const s = lowSec(d);
      const pts = mirror(s.slice(3));
      for (let k = 0; k < pts.length - 1; k++) {
        const a = pts[k], b = pts[k + 1];
        const up = (p) => [p[0] + Math.sign(p[0]) * (p[1] < s[5][1] - 0.01 ? 0.004 : 0), p[1] + 0.004, p[2]];
        const A = up(a), B = up(b);
        body.quad([A[0], A[1], A[2] + 0.005], [B[0], B[1], B[2] + 0.005], [B[0], B[1], B[2] - 0.005], [A[0], A[1], A[2] - 0.005], C.TRIM, 0);
      }
    };
    if (!van) hoodSeam(0.32);
    if (!hatch && !van && !bed) hoodSeam(Math.min(L - 0.35, dRw + 0.12));
    // ---------- Передок ----------
    const s0 = lowSec(0), sT = lowSec(L);
    const fz = zF + 0.004, rz = zR - 0.004;
    const hwF = s0[2][0], ybF = s0[0][1], ytF = s0[7][1] - crown;
    const fh = ytF - ybF;
    // бампер: тёмная нижняя губа, номер
    plate(body, -hwF + 0.06, hwF - 0.06, ybF + 0.01, ybF + fh * 0.16, fz, 1, C.TRIM, 0.1);
    const lightY0 = ybF + fh * 0.62, lightY1 = ytF - 0.04;
    const lightX0 = hwF - 0.04, lightX1 = hwF * (lk.slimLights ? 0.42 : 0.5);
    const frontLamps = [];
    if (lk.roundLights) {
      const r = Math.min(0.12, (lightY1 - lightY0) * 0.75);
      for (const sg of [1, -1]) {
        const x = sg * (hwF - r - 0.06), y = (lightY0 + lightY1) / 2 - 0.01;
        disc(body, x, y, fz, r + 0.018, 1, C.CHROME, 2, 0, 14);
        disc(body, x, y, fz + 0.003, r, 1, C.HEAD, 0.9, 1, 14);
        frontLamps.push([x, y]);
      }
    } else if (lk.tallLights) {
      for (const sg of [1, -1]) {
        plate(body, sg * lightX0, sg * (hwF * 0.58), lightY0 - 0.05, lightY1 + 0.03, fz, 1, C.HEADB, 2.2);
        plate(body, sg * (lightX0 - 0.02), sg * (hwF * 0.6), lightY0 - 0.03, lightY1 + 0.01, fz + 0.003, 1, C.HEAD, 0.9, 1);
        frontLamps.push([sg * (lightX0 + hwF * 0.6) / 2, (lightY0 + lightY1) / 2]);
      }
    } else {
      for (const sg of [1, -1]) {
        const ly0 = lk.slimLights ? lightY0 + 0.06 : lightY0;
        plate(body, sg * (lightX0 + 0.012), sg * (lightX1 - 0.014), ly0 - 0.016, lightY1 + 0.014, fz - 0.002, 1, C.TRIM, 0.4);
        plate(body, sg * lightX0, sg * lightX1, ly0, lightY1, fz, 1, C.HEADB, 2.2);
        if (hi) plate(body, sg * lightX0, sg * lightX1, ly0 - 0.012, ly0 - 0.003, fz + 0.004, 1, C.HEAD, 0.9, 1); // ходовые огни
        plate(body, sg * (lightX0 - 0.025), sg * ((lightX0 + lightX1) / 2 + 0.01), ly0 + 0.02, lightY1 - 0.02, fz + 0.003, 1, C.HEAD, 0.9, 1);
        plate(body, sg * ((lightX0 + lightX1) / 2 - 0.01), sg * (lightX1 + 0.02), ly0 + 0.02, lightY1 - 0.02, fz + 0.003, 1, C.HEAD, 0.9, 1);
        frontLamps.push([sg * (lightX0 + lightX1) / 2, (ly0 + lightY1) / 2]);
      }
    }
    // поворотники спереди (по углам, ниже фар)
    for (const sg of [1, -1]) plate(body, sg * (hwF - 0.03), sg * (hwF - 0.16), lightY0 - 0.08, lightY0 - 0.03, fz, 1, C.AMBER, 0.8, 0.7);
    // решётка радиатора
    const gx = lk.bigGrille ? hwF * 0.62 : lk.smile ? 0.16 : t.id === 'kei' ? 0.24 : hwF * 0.42;
    const gy0 = lk.smile ? ybF + fh * 0.22 : ybF + fh * 0.5, gy1 = lk.smile ? ybF + fh * 0.36 : ytF - (lk.bigGrille ? 0.02 : 0.07);
    if (!lk.smile || true) {
      if (lk.chromeGrille || lk.bigGrille) plate(body, -gx - 0.025, gx + 0.025, gy0 - 0.025, gy1 + 0.02, fz, 1, C.CHROME, 2);
      plate(body, -gx, gx, gy0, gy1, fz + 0.002, 1, C.GRILLE, 0.15);
      const nb = lk.bigGrille ? 4 : 3;
      for (let k = 1; k < nb; k++) {
        const y = gy0 + ((gy1 - gy0) * k) / nb;
        plate(body, -gx + 0.01, gx - 0.01, y - 0.006, y + 0.006, fz + 0.004, 1, lk.chromeGrille ? C.CHROME : C.TRIM, lk.chromeGrille ? 2 : 0.2);
      }
    }
    // нижний воздухозаборник
    plate(body, -hwF * 0.55, hwF * 0.55, ybF + fh * 0.08, ybF + fh * 0.2, fz + 0.002, 1, C.GRILLE, 0.1);
    // номерные знаки
    const plateAt = (z, s, y, rear) => drawPlate(body, t.id, t.id + paint.getHexString(), region, hi, z, s, y, rear);
    plateAt(fz + 0.001, 1, ybF + fh * 0.3, false);
    // ---------- Корма ----------
    const hwT = sT[2][0], ybT = sT[0][1], ytT = sT[7][1] - crown;
    const th = ytT - ybT;
    plate(body, -hwT + 0.06, hwT - 0.06, ybT + 0.01, ybT + th * 0.18, rz, -1, C.TRIM, 0.1);
    const vert = van || t.id === 'kei' || t.id === 'pickup';
    const tY1 = van ? ybT + th * 0.95 : ytT - 0.03;
    const tY0 = van ? ybT + th * 0.45 : vert ? ybT + th * 0.58 : Math.max(ybT + th * 0.6, tY1 - (hatch ? 0.2 : 0.15));
    const tX0 = hwT - 0.03, tX1 = van ? hwT - 0.2 : hwT * (t.id === 'kei' ? 0.66 : vert ? 0.5 : 0.4);
    const rearLamps = [];
    let ambR = [hwT - 0.1, tY0 + 0.05];
    const sR = lowSec(L - 0.16);
    for (const sg of [1, -1]) {
      plate(body, sg * (tX0 + 0.012), sg * (tX1 - 0.018), tY0 - 0.018, tY1 + 0.016, rz, -1, C.TRIM, 0.4);
      // красная часть фонаря (горит стоп-сигналом) и её граница на боковине
      let rx0, rx1, ry0, ry1;
      if (vert) {
        // вертикальный фонарь: красное стекло сверху, янтарный поворотник и белый задний ход внизу
        const ym = tY0 + (tY1 - tY0) * 0.42, xm = tX1 + (tX0 - tX1) * 0.45;
        plate(body, sg * tX0, sg * xm, tY0, ym - 0.012, rz - 0.002, -1, C.AMBER, 0.8, 0.2);
        plate(body, sg * xm - sg * 0.012, sg * tX1, tY0, ym - 0.012, rz - 0.002, -1, hi ? C.REV : C.TAIL, 0.8, 0);
        rx0 = tX0; rx1 = tX1; ry0 = ym; ry1 = tY1;
        ambR = [(tX0 + xm) / 2, (tY0 + ym) / 2];
      } else {
        // горизонтальный фонарь: снаружи — красный, у середины — янтарный поворотник над белым задним ходом
        const xm = tX1 + (tX0 - tX1) * 0.38, yh = (tY0 + tY1) / 2;
        plate(body, sg * xm - sg * 0.012, sg * tX1, yh + 0.006, tY1, rz - 0.002, -1, C.AMBER, 0.8, 0.2);
        plate(body, sg * xm - sg * 0.012, sg * tX1, tY0, yh - 0.006, rz - 0.002, -1, hi ? C.REV : C.TAIL, 0.8, 0);
        rx0 = tX0; rx1 = xm; ry0 = tY0; ry1 = tY1;
        ambR = [(xm + tX1) / 2, (yh + tY1) / 2];
      }
      plate(body, sg * rx0, sg * rx1, ry0, ry1, rz - 0.002, -1, C.TAIL, 0.8, 0.42);
      if (hi) for (let k = 1; k < 3; k++) {
        const yy = ry0 + ((ry1 - ry0) * k) / 3;
        plate(body, sg * rx0, sg * rx1, yy - 0.004, yy + 0.004, rz - 0.004, -1, C.TAILD, 0.6, 0.2);
      }
      // загиб фонаря на боковину
      const wy1 = Math.min(ry1, sR[3][1] - 0.01);
      if (!van && wy1 - ry0 > 0.05) {
        const x = sg * (sR[3][0] + 0.003), z0 = rz + 0.03, z1 = rz + 0.13;
        const a = [x, ry0, z0], b = [x, wy1, z0], c = [x, wy1 - 0.01, z1], d = [x, ry0 + 0.01, z1];
        if (sg > 0) body.quad(a, b, c, d, C.TAIL, 0.8, 0.42);
        else body.quad(a, d, c, b, C.TAIL, 0.8, 0.42);
      }
      plate(brake, sg * (rx0 + 0.005), sg * (rx1 - 0.005), ry0 - 0.005, ry1 + 0.005, rz - 0.012, -1, col('#ff2a1a'), 0, 0);
      rearLamps.push([sg * (tX0 + tX1) / 2, (tY0 + tY1) / 2]);
    }
    // задний бампер, номер, глушитель
    plateAt(rz - 0.001, -1, van ? ybT + th * 0.3 : ybT + th * 0.38, true);
    {
      const ex = -drL * hwT * 0.55, ey = ybT + 0.04;
      const cyl = new THREE.CylinderGeometry(0.035, 0.035, 0.16, 8, 1);
      const m = new THREE.Matrix4().makeRotationX(Math.PI / 2);
      m.setPosition(ex, ey, zR + 0.02);
      body.geo(cyl, m, C.CHROME, 2);
    }
    // стоп-сигнал на крыше / на кромке багажника
    if (!bed) {
      const gzr = rwS[0][2];
      const yy = hatch || van ? H - 0.04 : rwS[0][1] + 0.05;
      const zz = hatch || van ? zF - dR1 - 0.03 : gzr - 0.05;
      plate(body, -0.22, 0.22, yy - 0.025, yy + 0.015, zz - 0.001, -1, C.TAILD, 0.6, 0.3);
      plate(brake, -0.22, 0.22, yy - 0.025, yy + 0.015, zz - 0.01, -1, col('#ff2a1a'), 0, 0);
    }
    // ---------- Опции по типу ----------
    let siren = null;
    if (t.id === 'taxi') {
      // шашечки нью-йоркского такси
      if (region === 'usa') {
        const s = lowSec(dDoorB);
        for (const sg of [1, -1])
          for (let k = 0; k < 14; k++) {
            const d = dDoorF + 0.1 + k * 0.1;
            if (d > dDoorR) break;
            const ss = lowSec(d), y = ss[3][1] - 0.13 + (k % 2) * 0.045, x = sg * (ss[3][0] + 0.003);
            body.quad([x, y, ss[0][2] + 0.05], [x, y + 0.045, ss[0][2] + 0.05], [x, y + 0.045, ss[0][2] - 0.05], [x, y, ss[0][2] - 0.05].map((v, q) => v), C.TRIM, 0);
            void s;
          }
      }
      // плафон «TAXI» на крыше
      const zs = zF - dR0 - 0.3;
      const lampC = region === 'london' ? C.AMBER : region === 'japan' ? col('#f2f0e8') : C.SIGN;
      body.box(-0.3, H + crR, zs - 0.16, 0.3, H + crR + 0.035, zs + 0.16, C.TRIM, 0.2);
      if (region === 'japan') {
        // японский «фонарь»-домик
        body.box(-0.16, H + crR + 0.03, zs - 0.08, 0.16, H + crR + 0.2, zs + 0.08, lampC, 0.4, 0.8);
      } else body.box(-0.28, H + crR + 0.035, zs - 0.13, 0.28, H + crR + 0.19, zs + 0.13, lampC, 0.5, 0.9);
    }
    if (t.lightbar) {
      const zm = zF - (dR0 + dR1) / 2 + 0.1, yy = H + crR + 0.01;
      body.box(-0.62, yy, zm - 0.14, 0.62, yy + 0.05, zm + 0.14, C.TRIM, 0.2);
      siren = [new CB(64), new CB(64)];
      siren[0].box(0.04, yy + 0.05, zm - 0.12, 0.6, yy + 0.16, zm + 0.12, col('#ff2a2a'), 0, 0);
      siren[1].box(-0.6, yy + 0.05, zm - 0.12, -0.04, yy + 0.16, zm + 0.12, col('#2a6aff'), 0, 0);
      body.box(0.04, yy + 0.05, zm - 0.12, 0.6, yy + 0.155, zm + 0.12, col('#5a0a0a'), 0.8);
      body.box(-0.6, yy + 0.05, zm - 0.12, -0.04, yy + 0.155, zm + 0.12, col('#0a1a5a'), 0.8);
    }
    if (t.id === 'sports') {
      // спойлер и воздухозаборник
      const s = lowSec(L - 0.12);
      body.box(-hwT + 0.1, s[7][1] + 0.12, zR + 0.06, hwT - 0.1, s[7][1] + 0.15, zR + 0.3, C.TRIM, 0.3);
      for (const sg of [1, -1]) body.box(sg * (hwT - 0.3), s[7][1], zR + 0.14, sg * (hwT - 0.36), s[7][1] + 0.12, zR + 0.22, C.TRIM, 0.3);
      const sh = lowSec(0.9);
      body.box(-0.32, sh[7][1] - 0.005, zF - 1.1, 0.32, sh[7][1] + 0.025, zF - 0.75, C.GRILLE, 0.2);
    }
    if (bed) {
      // задний борт кузова пикапа: ручка; дуга за кабиной
      const s = lowSec(dRw + 0.05);
      body.box(-s[5][0], s[5][1], s[0][2] - 0.04, s[5][0], s[5][1] + 0.05, s[0][2] + 0.0, C.TRIM, 0.2);
      body.box(-0.15, yD - 0.18, zR - 0.006, 0.15, yD - 0.12, zR, C.TRIM, 0.3);
    }
    if (t.id === 'kei' || van) {
      // рейлинги / водосток крыши
      for (const sg of [1, -1]) {
        const s0r = gSec(dR0 + 0.1, 1), s1r = gSec(dR1 - 0.05, 1);
        const x0 = sg * (s0r[2][0] - 0.02), x1 = sg * (s1r[2][0] - 0.02);
        body.quad([x0, s0r[2][1] + 0.012, s0r[0][2]], [x1, s1r[2][1] + 0.012, s1r[0][2]], [x1, s1r[2][1] + 0.03, s1r[0][2]], [x0, s0r[2][1] + 0.03, s0r[0][2]].slice(), C.TRIM, 0.2);
      }
    }
    // ---------- Точки для эффектов ----------
    const seatZ = zF - (dR0 + dR1) / 2 + (hatch || van ? 0.2 : 0.2);
    const fx = { front: frontLamps, rear: rearLamps, zf: zF, zr: zR, indF: [hwF - 0.1, lightY0 - 0.055, zF + 0.01], indR: [ambR[0], ambR[1], zR - 0.01], exhaust: [-drL * hwT * 0.55, ybT + 0.04, zR - 0.06] };
    return {
      body, glass, brake, siren, zoff,
      seat: { x: drL * Math.min(0.38, hwM * 0.42), y: floorY + 0.24, z: van ? zF - dWs - 0.9 : seatZ + 0.15 }, fx,
      bumper: { yf: ybF + fh * 0.2, yr: ybT + th * 0.2, hw: hwM },
    };
  };

  CM.plate = plate;
  CM.disc = disc;
  CM.drawPlate = drawPlate;
  CM.refOf = refOf;
  CM.DRIVE_L = DRIVE_L;

  // ---------- Колёса: шина с профилем, диск со спицами, тормозной диск (обе стороны симметричны) ----------
  // steel — стальной диск грузовика/автобуса: плоский, с отверстиями и гайками на ступице
  CM.buildWheel = function (lod, steel) {
    const hi = lod !== 1;
    const b = new CB(hi ? 3000 : 600);
    const seg = hi ? 22 : 12;
    const TY = col('#141416'), TYS = col('#1c1c1f'), RIM = col('#b6bcc4'), RIMD = col('#3a3e44'), HUB = col('#8a9098'), DISC = col('#4a4a4e');
    // профиль шины (радиус, x) от внешнего края к внутреннему — вращаем вокруг оси x
    const prof = hi
      ? [[0.62, 0.47, RIMD], [0.66, 0.5, TYS], [0.8, 0.52, TYS], [0.93, 0.5, TY], [0.99, 0.43, TY], [1, 0.3, TY], [1, 0, TY]]
      : [[0.62, 0.48, RIMD], [0.84, 0.52, TYS], [0.98, 0.45, TY], [1, 0, TY]];
    const ring = (r, x) => {
      const out = [];
      for (let k = 0; k <= seg; k++) {
        const a = (k / seg) * Math.PI * 2;
        out.push([x, Math.cos(a) * r, Math.sin(a) * r]);
      }
      return out;
    };
    for (const side of [1, -1]) {
      for (let i = 0; i < prof.length - 1; i++) {
        const [r0, x0, c0] = prof[i], [r1, x1] = prof[i + 1];
        const A = ring(r0, side * x0), B = ring(r1, side * x1);
        for (let k = 0; k < seg; k++) {
          const a = A[k], b2 = A[k + 1], c = B[k + 1], d = B[k];
          if (side > 0) b.quad(a, d, c, b2, c0, c0 === RIMD ? 0.4 : 0);
          else b.quad(a, b2, c, d, c0, c0 === RIMD ? 0.4 : 0);
        }
      }
      // диск: обод (кольцо 0.62 → 0.52, утоплен), спицы, ступица
      const xr = side * 0.44, xs = side * 0.4, xh = side * 0.43;
      const A = ring(0.62, side * 0.47), B = ring(0.55, xr);
      for (let k = 0; k < seg; k++) {
        if (side > 0) b.quad(A[k], B[k], B[k + 1], A[k + 1], RIM, 2);
        else b.quad(A[k], A[k + 1], B[k + 1], B[k], RIM, 2);
      }
      if (steel) {
        // неглубокая чаша диска, плоский лист с вентиляционными отверстиями, крупная ступица с гайками
        const ST = col('#aeb2b8'), xd = side * 0.36;
        const Dd = ring(0.55, xd);
        for (let k = 0; k < seg; k++) {
          if (side > 0) b.quad(B[k], Dd[k], Dd[k + 1], B[k + 1], ST, 0.5);
          else b.quad(B[k], B[k + 1], Dd[k + 1], Dd[k], ST, 0.5);
        }
        const cen = [xd, 0, 0];
        for (let k = 0; k < seg; k++) {
          if (side > 0) b.tri(cen, Dd[k], Dd[k + 1], ST, 0.5);
          else b.tri(cen, Dd[k + 1], Dd[k], ST, 0.5);
        }
        const nh = hi ? 8 : 6;
        for (let s = 0; s < nh; s++) {
          const a = (s / nh) * Math.PI * 2 + 0.2;
          const m = new THREE.Matrix4().makeRotationX(a);
          const hb = new THREE.BoxGeometry(0.02, 0.1, 0.07);
          hb.translate(xd + side * 0.006, 0.4, 0);
          b.geo(hb, m, RIMD, 0);
        }
        const hub = new THREE.CylinderGeometry(0.2, 0.22, 0.1, hi ? 10 : 6, 1);
        hub.rotateZ(Math.PI / 2);
        hub.translate(xd + side * 0.05, 0, 0);
        b.geo(hub, new THREE.Matrix4(), HUB, 1.2);
        if (hi) for (let s = 0; s < 8; s++) {
          const m = new THREE.Matrix4().makeRotationX((s / 8) * Math.PI * 2);
          const nut = new THREE.BoxGeometry(0.05, 0.045, 0.045);
          nut.translate(xd + side * 0.11, 0.14, 0);
          b.geo(nut, m, C.CHROME, 2);
        }
        continue;
      }
      // тёмная «глубина» диска и тормозной диск
      const Dd = ring(0.55, side * 0.2);
      for (let k = 0; k < seg; k++) {
        if (side > 0) b.quad(B[k], Dd[k], Dd[k + 1], B[k + 1], RIMD, 0.2);
        else b.quad(B[k], B[k + 1], Dd[k + 1], Dd[k], RIMD, 0.2);
      }
      const cen = [side * 0.2, 0, 0];
      for (let k = 0; k < seg; k++) {
        if (side > 0) b.tri(cen, Dd[k], Dd[k + 1], DISC, 0.5);
        else b.tri(cen, Dd[k + 1], Dd[k], DISC, 0.5);
      }
      // спицы
      const ns = hi ? 5 : 5;
      for (let s = 0; s < ns; s++) {
        const a = (s / ns) * Math.PI * 2;
        const m = new THREE.Matrix4().makeRotationX(a);
        const sp = new THREE.BoxGeometry(0.06, 0.4, 0.11);
        sp.translate(xs - side * 0.03, 0.33, 0);
        b.geo(sp, m, RIM, 2);
      }
      // ступица
      const hub = new THREE.CylinderGeometry(0.15, 0.17, 0.08, hi ? 10 : 6, 1);
      hub.rotateZ(Math.PI / 2);
      hub.translate(xh - side * 0.02, 0, 0);
      b.geo(hub, new THREE.Matrix4(), HUB, 2);
    }
    return b.build();
  };

  // ---------- Водитель-силуэт (виден сквозь стекло) ----------
  CM.buildDriver = function () {
    const b = new CB(400);
    const sph = new THREE.SphereGeometry(0.11, 8, 6);
    b.geo(sph, new THREE.Matrix4().makeScale(0.9, 1.1, 1).setPosition(0, 0.62, 0.02), C.SKIN, 0.05);
    const hair = new THREE.SphereGeometry(0.115, 8, 5, 0, Math.PI * 2, 0, Math.PI * 0.55);
    b.geo(hair, new THREE.Matrix4().makeScale(0.92, 1.05, 1.05).setPosition(0, 0.64, 0.0), col('#1a1410'), 0.05);
    b.box(-0.2, 0.06, -0.12, 0.2, 0.46, 0.1, C.SHIRT, 0.03);
    b.box(-0.06, 0.44, -0.05, 0.06, 0.53, 0.05, C.SKIN, 0.03);
    // руки к рулю
    for (const s of [1, -1]) {
      b.box(s * 0.2, 0.22, -0.02, s * 0.13, 0.42, 0.1, C.SHIRT, 0.03);
      b.box(s * 0.18, 0.22, 0.08, s * 0.11, 0.3, 0.36, C.SHIRT, 0.03);
    }
    return b.build();
  };
})();
