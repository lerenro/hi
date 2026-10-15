'use strict';
// Реалистичные модели людей и стендов: скелет с коленями и локтями, лицо с глазами и губами, пальцы, обувь,
// одежда по стилю (гакуран, пиджак, рубашка, футболка, платье), аксессуары, броня и узоры стендов.
// Каждый персонаж — ОДИН меш со скелетом (SkinnedMesh): 1 вызов отрисовки вместо десяти.
// Части тела кэшируются по форме и сливаются в общую геометрию варианта; её НЕЛЬЗЯ освобождать (dispose).
(function () {
  const R3 = J.R3;
  const col = (h) => new THREE.Color(h);
  // матрица детали (общие временные объекты: сборщик сразу копирует вершины)
  const _m = new THREE.Matrix4(), _p = new THREE.Vector3(), _q = new THREE.Quaternion(), _s = new THREE.Vector3(), _e = new THREE.Euler();
  const _nm = new THREE.Matrix3();
  const M4 = (x, y, z, sx = 1, sy = 1, sz = 1, rx = 0, ry = 0, rz = 0) => _m.compose(_p.set(x, y, z), _q.setFromEuler(_e.set(rx, ry, rz)), _s.set(sx, sy, sz));
  // Общие примитивы (с индексами — вершин в 4–5 раз меньше)
  const PR = {
    sph: new THREE.SphereGeometry(1, 11, 8),
    sphMid: new THREE.SphereGeometry(1, 8, 6),
    sphLo: new THREE.SphereGeometry(1, 6, 4),
    sphT: new THREE.SphereGeometry(1, 5, 3),
    sphHi: new THREE.SphereGeometry(1, 18, 14),
    cap: new THREE.SphereGeometry(1, 14, 7, 0, Math.PI * 2, 0, Math.PI * 0.56),
    box: new THREE.BoxGeometry(1, 1, 1),
    cone: new THREE.ConeGeometry(1, 1, 8),
    cone4: new THREE.ConeGeometry(1, 1, 4),
    cone6: new THREE.ConeGeometry(1, 1, 6),
    torus: new THREE.TorusGeometry(1, 0.38, 5, 10),
    oct: new THREE.OctahedronGeometry(1, 0),
  };
  const tcache = {};
  const taper = (rt, rb, seg = 8) => {
    const k = rt.toFixed(3) + '/' + rb.toFixed(3) + '/' + seg;
    return tcache[k] || (tcache[k] = new THREE.CylinderGeometry(rt, rb, 1, seg, 1));
  };

  // ---------- Сборщик частей с индексами ----------
  const PRIM = new Map();
  const primOf = (g) => {
    let p = PRIM.get(g);
    if (!p) {
      const pos = g.attributes.position.array, nrm = g.attributes.normal.array;
      let idx = g.index ? g.index.array : null;
      if (!idx) {
        idx = new Uint16Array(pos.length / 3);
        for (let i = 0; i < idx.length; i++) idx[i] = i;
      }
      p = { pos, nrm, idx, n: pos.length / 3 };
      PRIM.set(g, p);
    }
    return p;
  };
  const growF = (a, n) => {
    const b = new a.constructor(n);
    b.set(a);
    return b;
  };
  class CB {
    constructor() {
      this.vc = 2048;
      this.ic = 4096;
      this.p = new Float32Array(this.vc * 3);
      this.n = new Float32Array(this.vc * 3);
      this.c = new Float32Array(this.vc * 3);
      this.i = new Uint32Array(this.ic);
      this.v = 0;
      this.ni = 0;
    }
    geo(g, m, c) {
      this.geoP(primOf(g), m, c);
    }
    geoP(pr, m, c) {
      if (this.v + pr.n > this.vc) {
        let k = this.vc * 2;
        while (k < this.v + pr.n) k *= 2;
        this.p = growF(this.p, k * 3);
        this.n = growF(this.n, k * 3);
        this.c = growF(this.c, k * 3);
        this.vc = k;
      }
      if (this.ni + pr.idx.length > this.ic) {
        let k = this.ic * 2;
        while (k < this.ni + pr.idx.length) k *= 2;
        this.i = growF(this.i, k);
        this.ic = k;
      }
      const P = pr.pos, N = pr.nrm, e = m.elements, nm = _nm.getNormalMatrix(m).elements;
      const OP = this.p, ON = this.n, OC = this.c;
      const cr = c.r, cg = c.g, cb = c.b;
      const base = this.v;
      let o = base * 3;
      for (let i = 0; i < P.length; i += 3, o += 3) {
        const x = P[i], y = P[i + 1], z = P[i + 2];
        OP[o] = e[0] * x + e[4] * y + e[8] * z + e[12];
        OP[o + 1] = e[1] * x + e[5] * y + e[9] * z + e[13];
        OP[o + 2] = e[2] * x + e[6] * y + e[10] * z + e[14];
        const a = N[i], b = N[i + 1], d = N[i + 2];
        const nx = nm[0] * a + nm[3] * b + nm[6] * d, ny = nm[1] * a + nm[4] * b + nm[7] * d, nz = nm[2] * a + nm[5] * b + nm[8] * d;
        const l = 1 / (Math.sqrt(nx * nx + ny * ny + nz * nz) || 1);
        ON[o] = nx * l;
        ON[o + 1] = ny * l;
        ON[o + 2] = nz * l;
        OC[o] = cr;
        OC[o + 1] = cg;
        OC[o + 2] = cb;
      }
      const I = pr.idx, OI = this.i;
      for (let k = 0; k < I.length; k++) OI[this.ni + k] = base + I[k];
      this.ni += I.length;
      this.v += pr.n;
    }
    // готовые массивы (лофт): позиции, нормали, цвета по вершинам и индексы
    raw(P, N, C, I, nv) {
      const base = this.v;
      this.geoP({ pos: P, nrm: N, idx: I, n: nv }, IDM, { r: 0, g: 0, b: 0 });
      this.c.set(C.subarray(0, nv * 3), base * 3);
    }
    get empty() {
      return this.v === 0;
    }
    part() {
      return { p: this.p.slice(0, this.v * 3), n: this.n.slice(0, this.v * 3), c: this.c.slice(0, this.v * 3), i: this.i.slice(0, this.ni), v: this.v };
    }
  }
  const IDM = new THREE.Matrix4();
  // Лофт: гладкая оболочка по сечениям-кольцам (торс, руки, ноги) — без «бугров» из сложенных шаров.
  // Кольцо: [y, полуширина, глубина спереди, глубина сзади, сдвиг по z, слот, сдвиг по x].
  // Сечение — суперэллипс (n > 2 — «квадратнее», как грудная клетка); нормали сглажены по соседним граням.
  const LP = new Float32Array(4096 * 3), LN = new Float32Array(4096 * 3), LC = new Float32Array(4096 * 3), LI = new Uint16Array(8192 * 3);
  const spow = (v, e) => Math.sign(v) * Math.pow(Math.abs(v), e);
  function loft(gb, R, N, n = 2, capB = true, capT = true) {
    if (LO) N = Math.max(6, Math.round(N * 0.6));
    const e = 2 / n;
    let v = 0, t = 0;
    const put = (x, y, z, c) => {
      LP[v * 3] = x; LP[v * 3 + 1] = y; LP[v * 3 + 2] = z;
      LN[v * 3] = LN[v * 3 + 1] = LN[v * 3 + 2] = 0;
      LC[v * 3] = c.r; LC[v * 3 + 1] = c.g; LC[v * 3 + 2] = c.b;
      return v++;
    };
    for (const r of R) {
      for (let j = 0; j < N; j++) {
        const a = (j / N) * Math.PI * 2, ca = Math.cos(a), sa = Math.sin(a);
        put((r[6] || 0) + r[1] * spow(ca, e), r[0], r[4] + (sa >= 0 ? r[2] : r[3]) * spow(sa, e), r[5]);
      }
    }
    const tri = (a, b, c) => {
      LI[t++] = a; LI[t++] = b; LI[t++] = c;
    };
    // кольца идут сверху вниз: грань (i, i+1) смотрит наружу при обходе a→b→c
    for (let i = 0; i < R.length - 1; i++)
      for (let j = 0; j < N; j++) {
        const a = i * N + j, b = i * N + ((j + 1) % N), c = (i + 1) * N + j, d = (i + 1) * N + ((j + 1) % N);
        tri(a, b, c);
        tri(b, d, c);
      }
    if (capT) {
      const r = R[0], top = put(r[6] || 0, r[0] + Math.min(r[1], r[2]) * 0.35, r[4], r[5]);
      for (let j = 0; j < N; j++) tri(top, (j + 1) % N, j);
    }
    if (capB) {
      const r = R[R.length - 1], o = (R.length - 1) * N, bot = put(r[6] || 0, r[0] - Math.min(r[1], r[2]) * 0.35, r[4], r[5]);
      for (let j = 0; j < N; j++) tri(bot, o + j, o + ((j + 1) % N));
    }
    // сглаженные нормали
    for (let k = 0; k < t; k += 3) {
      const a = LI[k] * 3, b = LI[k + 1] * 3, c = LI[k + 2] * 3;
      const ux = LP[b] - LP[a], uy = LP[b + 1] - LP[a + 1], uz = LP[b + 2] - LP[a + 2];
      const vx = LP[c] - LP[a], vy = LP[c + 1] - LP[a + 1], vz = LP[c + 2] - LP[a + 2];
      const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
      for (const q of [a, b, c]) {
        LN[q] += nx; LN[q + 1] += ny; LN[q + 2] += nz;
      }
    }
    for (let q = 0; q < v * 3; q += 3) {
      const l = 1 / (Math.hypot(LN[q], LN[q + 1], LN[q + 2]) || 1);
      LN[q] *= l; LN[q + 1] *= l; LN[q + 2] *= l;
    }
    gb.raw(LP.subarray(0, v * 3), LN.subarray(0, v * 3), LC, LI.subarray(0, t), v);
  }

  // часть → обычная геометрия (оружие стенда — отдельный меш на кисти)
  const partGeo = (pt) => {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pt.p, 3));
    g.setAttribute('normal', new THREE.BufferAttribute(pt.n, 3));
    g.setAttribute('color', new THREE.BufferAttribute(pt.c, 3));
    g.setIndex(new THREE.BufferAttribute(pt.v > 65535 ? pt.i : new Uint16Array(pt.i), 1));
    J.fastBounds(g, pt.p, pt.p.length);
    g.userData.shared = true;
    return g;
  };

  // эллипсоид: мелкие детали — грубее (меньше треугольников), крупные — гладкие
  let LO = false; // упрощённая сборка (дальний план)
  const ell = (gb, c, x, y, z, rx, ry, rz, ax = 0, ay = 0, az = 0, lo) => {
    const r = Math.max(rx, ry, rz);
    gb.geo(r < 0.012 ? PR.sphT : lo || r < 0.025 || (LO && r < 0.09) ? PR.sphLo : r < 0.07 || LO ? PR.sphMid : PR.sph, M4(x, y, z, rx, ry, rz, ax, ay, az), c);
  };
  // крупные гладкие формы (череп, челюсть) — плотнее сетка, иначе вблизи видны грани
  const ellH = (gb, c, x, y, z, rx, ry, rz, ax = 0, ay = 0, az = 0) => gb.geo(LO ? PR.sphMid : PR.sphHi, M4(x, y, z, rx, ry, rz, ax, ay, az), c);
  // сужающийся цилиндр от y0 вниз на длину len
  const tube = (gb, c, x, y0, z, rt, rb, len, sz = 1, ax = 0, az = 0, seg) => gb.geo(taper(rt, rb, seg || (LO || Math.max(rt, rb) < 0.03 ? 6 : 8)), M4(x, y0 - len / 2, z, 1, len, sz, ax, 0, az), c);
  const box = (gb, c, x, y, z, sx, sy, sz, ax = 0, ay = 0, az = 0) => gb.geo(PR.box, M4(x, y, z, sx, sy, sz, ax, ay, az), c);
  // звено (палец, прядь): от точки (x,y,z) по направлению поворота (ax, az), возвращает конец
  const END = [0, 0, 0];
  const seg = (gb, c, x, y, z, ax, az, len, r0, r1) => {
    const dx = Math.sin(az), dy = -Math.cos(az) * Math.cos(ax), dz = -Math.cos(az) * Math.sin(ax);
    gb.geo(taper(r0, r1, 5), M4(x + (dx * len) / 2, y + (dy * len) / 2, z + (dz * len) / 2, 1, len, 1, ax, 0, az), c);
    END[0] = x + dx * len;
    END[1] = y + dy * len;
    END[2] = z + dz * len;
    return END;
  };

  const BUILDS = {
    normal: { sh: 0.2, chest: 0.185, waist: 0.14, hip: 0.155, arm: 0.05, leg: 0.083 },
    slim: { sh: 0.185, chest: 0.165, waist: 0.125, hip: 0.145, arm: 0.044, leg: 0.075 },
    muscular: { sh: 0.25, chest: 0.235, waist: 0.155, hip: 0.165, arm: 0.068, leg: 0.1 },
  };
  const buildOf = (gender, build) => {
    const b = Object.assign({}, BUILDS[build || 'normal'] || BUILDS.normal);
    if (gender === 'f') {
      b.sh *= 0.86;
      b.chest *= 0.88;
      b.waist *= 0.86;
      b.hip *= 1.08;
      b.arm *= 0.84;
      b.leg *= 0.95;
    }
    return b;
  };

  // ---------- Каркас со скелетом ----------
  const SPINE_Y = 0.98, NECK_Y = 1.575;
  // кости: 0 таз, 1 позвоночник, 2 голова, 3/5 бёдра, 4/6 голени, 7/9 плечи, 8/10 предплечья
  const jointsOf = (b) => ({
    thigh: [-1, 1].map((sx) => [sx * b.hip * 0.56, 0.94, 0]),
    shin: [-1, 1].map((sx) => [sx * b.hip * 0.56, 0.5, 0]),
    upper: [-1, 1].map((sx) => [sx * (b.sh + 0.035), 1.425, 0]),
    fore: [-1, 1].map((sx) => [sx * (b.sh + 0.035), 1.135, 0]),
  });
  const sstep = (a, b, x) => {
    const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
    return t * t * (3 - 2 * t);
  };
  // Слияние частей в одну геометрию со скелетными весами. pal — цвет вершины хранит номер слота палитры (r)
  // и запечённое затенение (g); иначе (стенды) затенение умножается на сам цвет.
  function mergeRig(parts, b, pal) {
    let nv = 0, ni = 0;
    for (const q of parts) {
      nv += q.pt.v;
      ni += q.pt.i.length;
    }
    const P = new Float32Array(nv * 3), N = new Float32Array(nv * 3), C = new Float32Array(nv * 3);
    const SI = new Uint16Array(nv * 4), SW = new Float32Array(nv * 4);
    const I = nv > 65535 ? new Uint32Array(ni) : new Uint16Array(ni);
    let v0 = 0, i0 = 0;
    const chest = b.chest;
    for (const q of parts) {
      const pt = q.pt, ox = q.o[0], oy = q.o[1], oz = q.o[2];
      for (let k = 0; k < pt.i.length; k++) I[i0 + k] = pt.i[k] + v0;
      i0 += pt.i.length;
      for (let i = 0; i < pt.v; i++) {
        const s = i * 3, d = (v0 + i) * 3, w4 = (v0 + i) * 4;
        const x = pt.p[s], y = pt.p[s + 1], z = pt.p[s + 2];
        const X = x + ox, Y = y + oy, Z = z + oz;
        P[d] = X;
        P[d + 1] = Y;
        P[d + 2] = Z;
        N[d] = pt.n[s];
        N[d + 1] = pt.n[s + 1];
        N[d + 2] = pt.n[s + 2];
        // затенение: к ступням темнее, в подмышках, под подбородком и между ног — тени складок
        let ao = 0.7 + 0.3 * sstep(0.02, 1.05, Y);
        const ax = Math.abs(X);
        if (q.kind === 'torso') {
          ao *= 1 - 0.22 * sstep(chest * 0.7, chest * 1.02, ax) * sstep(1.18, 1.3, Y) * (1 - sstep(1.4, 1.47, Y));
          ao *= 1 - 0.2 * sstep(1.5, 1.545, Y) * (1 - sstep(1.58, 1.62, Y));
          ao *= 1 - 0.18 * (1 - sstep(0.02, 0.07, ax)) * (1 - sstep(0.86, 0.95, Y));
        } else if (q.kind === 'thigh') ao *= 1 - 0.2 * (1 - sstep(0.03, 0.09, ax)) * sstep(0.7, 0.88, Y);
        else if (q.kind === 'head') ao *= 1 - 0.15 * (1 - sstep(-0.07, -0.02, y)) * (1 - sstep(0.02, 0.07, z));
        if (pal) {
          C[d] = pt.c[s];
          C[d + 1] = ao * pt.c[s + 1];
          C[d + 2] = pt.c[s + 2];
        } else {
          const glow = pt.c[s] + pt.c[s + 1] + pt.c[s + 2] > 2.85;
          const k = glow ? 1 : ao;
          C[d] = pt.c[s] * k;
          C[d + 1] = pt.c[s + 1] * k;
          C[d + 2] = pt.c[s + 2] * k;
        }
        // вес соседней кости у сустава — мягкий изгиб локтя, колена, шеи, талии
        SI[w4] = q.bone;
        let w = 0;
        if (q.wf) w = q.wf(x, y, z);
        if (w > 0.001) {
          SI[w4 + 1] = q.b2;
          SW[w4] = 1 - w;
          SW[w4 + 1] = w;
        } else SW[w4] = 1;
      }
      v0 += pt.v;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(P, 3));
    g.setAttribute('normal', new THREE.BufferAttribute(N, 3));
    g.setAttribute('color', new THREE.BufferAttribute(C, 3));
    g.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(SI, 4));
    g.setAttribute('skinWeight', new THREE.BufferAttribute(SW, 4));
    g.setIndex(new THREE.BufferAttribute(I, 1));
    J.fastBounds(g, P, nv * 3);
    // чуть шире: руки и ноги в движении выходят за позу покоя
    g.boundingSphere.radius += 0.35;
    g.userData.shared = true;
    return g;
  }
  // веса суставов (локальные координаты части)
  const W = {
    torso: (x, y) => {
      // таз и подол — к тазовой кости (ноги не прорезают низ), шея — частично к голове
      if (y < 1.04) return 1;
      if (y < 1.1) return 1 - sstep(1.04, 1.1, y);
      return 0;
    },
    torsoNeck: (x, y) => sstep(1.555, 1.63, y) * 0.65,
    thigh: (x, y) => sstep(-0.36, -0.47, y) * 0.5,
    shin: (x, y) => sstep(-0.05, 0.04, y) * 0.5,
    upper: (x, y) => sstep(-0.24, -0.31, y) * 0.5,
    fore: (x, y) => sstep(-0.05, 0.03, y) * 0.5,
  };
  // Части в позу покоя: торс и голова уже в пространстве каркаса, конечности — в локальном пространстве сустава
  function rigParts(P, b) {
    const J0 = jointsOf(b);
    const L = [];
    // торс разбит по весам: таз — кость 0 (с плавным переходом к позвоночнику), шея — к голове
    L.push({ pt: P.torso, o: [0, 0, 0], bone: 1, b2: 0, wf: W.torso, kind: 'torso' });
    L.push({ pt: P.head, o: [0, 0, 0], bone: 2, kind: 'head' });
    for (let i = 0; i < 2; i++) {
      L.push({ pt: P.thigh[i], o: J0.thigh[i], bone: i ? 5 : 3, b2: i ? 6 : 4, wf: W.thigh, kind: 'thigh' });
      L.push({ pt: P.shin[i], o: J0.shin[i], bone: i ? 6 : 4, b2: i ? 5 : 3, wf: W.shin, kind: 'shin' });
      L.push({ pt: P.upper[i], o: J0.upper[i], bone: i ? 9 : 7, b2: i ? 10 : 8, wf: W.upper, kind: 'upper' });
      L.push({ pt: P.fore[i], o: J0.fore[i], bone: i ? 10 : 8, b2: i ? 9 : 7, wf: W.fore, kind: 'fore' });
    }
    return L;
  }
  // торс: вес таза и вес шеи (две кости-соседки) — разносим вершины шеи отдельным проходом
  function fixNeck(g) {
    const P = g.attributes.position.array, SI = g.attributes.skinIndex.array, SW = g.attributes.skinWeight.array;
    for (let i = 0; i < P.length / 3; i++) {
      if (SI[i * 4] !== 1 || SW[i * 4 + 1] > 0) continue;
      const w = W.torsoNeck(0, P[i * 3 + 1]);
      if (w > 0.001) {
        SI[i * 4 + 1] = 2;
        SW[i * 4] = 1 - w;
        SW[i * 4 + 1] = w;
      }
    }
  }
  // обратные матрицы костей в позе покоя (только сдвиги) — общие для всех персонажей формы
  function boneInverses(b) {
    const J0 = jointsOf(b);
    const T = (x, y, z) => new THREE.Matrix4().makeTranslation(-x, -y, -z);
    return [T(0, 0, 0), T(0, SPINE_Y, 0), T(0, NECK_Y, 0), T(...J0.thigh[0]), T(...J0.shin[0]), T(...J0.thigh[1]), T(...J0.shin[1]), T(...J0.upper[0]), T(...J0.fore[0]), T(...J0.upper[1]), T(...J0.fore[1])];
  }

  // Кэш частей и слитых вариантов. Части — по своим ключам (голова зависит только от причёски, торс — от одежды...),
  // поэтому новых сочетаний много, а собирать приходится мало.
  const partCache = new Map();
  const rigCache = new Map();
  // один общий буфер сборки на все части (part() копирует результат) — без лишнего мусора для сборщика
  let SCB = null;
  const part = (key, fn) => {
    let p = key && partCache.get(key);
    if (p) return p;
    const gb = SCB || (SCB = new CB());
    gb.v = gb.ni = 0;
    fn(gb);
    p = gb.part();
    if (key) partCache.set(key, p);
    return p;
  };
  R3.rigCacheSize = () => rigCache.size;
  R3.partCacheSize = () => partCache.size;

  // spec: key, keys{torso, head, leg, arm}, gender, build, pal, builders; lod — упрощённая копия для дальнего плана
  function rigGeos(spec) {
    const hit = spec.key && rigCache.get(spec.key);
    if (hit) return hit;
    const b = buildOf(spec.gender, spec.build);
    const fem = spec.gender === 'f';
    const one = (lo) => {
      LO = lo;
      const K = spec.keys || {};
      const sfx = lo ? '|lo' : '';
      const k = (s) => (K[s] ? K[s] + sfx : null);
      const P = {
        torso: part(k('torso'), (gb) => spec.torso(gb, b, fem)),
        head: part(k('head'), (gb) => spec.head(gb, b, fem)),
        thigh: [-1, 1].map((sx, i) => part(k('leg') && k('leg') + '|t' + i, (gb) => spec.thigh(gb, b, sx))),
        shin: [-1, 1].map((sx, i) => part(k('leg') && k('leg') + '|s' + i, (gb) => spec.shin(gb, b, sx))),
        upper: [-1, 1].map((sx, i) => part(k('arm') && k('arm') + '|u' + i, (gb) => spec.upper(gb, b, sx))),
        fore: [-1, 1].map((sx, i) => part(k('arm') && k('arm') + '|f' + i, (gb) => spec.fore(gb, b, sx))),
      };
      LO = false;
      const g = mergeRig(rigParts(P, b), b, spec.pal);
      fixNeck(g);
      return g;
    };
    // упрощённая копия собирается лениво — когда персонаж впервые окажется вдали
    const G = { b, geo: one(false), lo: null, loF: spec.lod ? () => G.lo || (G.lo = one(true)) : null, inv: boneInverses(b), extra: null };
    if (spec.extra) {
      const gb = new CB();
      spec.extra(gb);
      if (!gb.empty) G.extra = partGeo(gb.part());
    }
    if (spec.key) rigCache.set(spec.key, G);
    return G;
  }

  const IDENT = new THREE.Matrix4();
  const bone = () => new THREE.Bone();
  // Каркас: кости-суставы (их крутит анимация) и один меш с кожей
  function makeRig(spec) {
    const G = rigGeos(spec);
    const b = G.b;
    const mat = spec.material;
    const g = new THREE.Group();
    const body = bone();
    g.add(body);
    // позвоночник: торс, голова и руки поворачиваются отдельно от ног
    const spine = bone();
    spine.position.y = SPINE_Y;
    body.add(spine);
    const head = bone();
    head.position.y = NECK_Y - SPINE_Y;
    spine.add(head);
    const legs = [0, 1].map((i) => {
      const thigh = bone();
      thigh.position.set((i ? 1 : -1) * b.hip * 0.56, 0.94, 0);
      const shin = bone();
      shin.position.set(0, -0.44, 0);
      thigh.add(shin);
      body.add(thigh);
      return { thigh, shin };
    });
    const arms = [0, 1].map((i) => {
      const upper = bone();
      upper.position.set((i ? 1 : -1) * (b.sh + 0.035), 1.425 - SPINE_Y, 0);
      const fore = bone();
      fore.position.set(0, -0.29, 0);
      upper.add(fore);
      spine.add(upper);
      return { upper, fore };
    });
    const bones = [body, spine, head, legs[0].thigh, legs[0].shin, legs[1].thigh, legs[1].shin, arms[0].upper, arms[0].fore, arms[1].upper, arms[1].fore];
    const skel = new THREE.Skeleton(bones, G.inv);
    const mesh = new THREE.SkinnedMesh(G.geo, mat);
    mesh.castShadow = true;
    g.add(mesh);
    mesh.bind(skel, IDENT);
    const v = {
      group: g, body, torso: spine, spine, head, skin: mesh, skel, lodG: G.loF ? [G.geo, G.lo] : null, lodF: G.loF, lodI: 0,
      legL: legs[0].thigh, legR: legs[1].thigh, shinL: legs[0].shin, shinR: legs[1].shin,
      armL: arms[0].upper, armR: arms[1].upper, foreL: arms[0].fore, foreR: arms[1].fore,
      mats: [mat], baseColors: [new THREE.Color(1, 1, 1)],
    };
    if (G.extra) {
      const x = new THREE.Mesh(G.extra, mat.userData.extraMat || mat);
      x.castShadow = true;
      arms[1].fore.add(x);
    }
    return v;
  }
  // дальний план: упрощённая геометрия (без пальцев и мелких черт лица)
  R3.rigLod = function (v, far) {
    if (!v.lodG) return;
    const want = far ? 1 : 0;
    if (v.lodI !== want) {
      v.lodI = want;
      if (!v.lodG[want]) v.lodG[want] = v.lodF();
      v.skin.geometry = v.lodG[want];
    }
  };

  // Обесцвечивание (остановка времени): uniform uDesat подмешивается в конец фрагментного шейдера.
  // Патч ставится один раз при создании материала; во время игры меняется только значение uniform.
  // оттенок общий для всех: серо-голубой у остановки времени, багровый у стирания времени (Король Багрового)
  R3.uTint = R3.uTint || { value: new THREE.Vector3(0.86, 0.9, 1.12) };
  const DESAT = '#include <dithering_fragment>\n{ float l = dot(gl_FragColor.rgb, vec3(0.299, 0.587, 0.114)); gl_FragColor.rgb = mix(gl_FragColor.rgb, vec3(l) * uTint, uDesat); }';
  R3.fxPatchShader = function (sh, uni) {
    sh.uniforms.uDesat = uni;
    sh.uniforms.uTint = R3.uTint;
    sh.fragmentShader = 'uniform float uDesat; uniform vec3 uTint;\n' + sh.fragmentShader.replace('#include <dithering_fragment>', DESAT);
  };
  R3.fxPatch = function (mat, uni) {
    if (!mat || !mat.isMaterial) return null;
    if (mat.userData.fxU) return mat.userData.fxU;
    uni = uni || { value: 0 };
    mat.userData.fxU = uni;
    const prev = mat.onBeforeCompile;
    const prevKey = mat.customProgramCacheKey.call(mat);
    mat.onBeforeCompile = function (sh, r) {
      if (prev) prev.call(this, sh, r);
      R3.fxPatchShader(sh, uni);
    };
    // ключ программы сохраняет отличие от исходного шейдера
    mat.customProgramCacheKey = () => 'fx|' + prevKey;
    mat.needsUpdate = true;
    return uni;
  };

  // ---------- Материал персонажа ----------
  // Цвет вершины: r — номер слота палитры, g — запечённая тень складок. Палитра и свойства слотов — uniform-массивы.
  // Свойства слота: x — шероховатость, y — металл, z — сила шума ткани/волос, w — контурный свет.
  // Среднее и высокое качество: PBR (MeshStandard) с попиксельным светом, шумом ткани и контурным светом неба;
  // низкое — дешёвый Ламберт (свет по вершинам).
  R3.uChSky = R3.uChSky || { value: new THREE.Color(0.55, 0.65, 0.8) };
  // b — признак кожи (тёплый подповерхностный отсвет)
  const SLOT = (i, sk) => ({ r: i, g: 1, b: sk ? 1 : 0 });
  const NOISE_GLSL = `
    float jjH(vec3 p) { p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
    float jjN(vec3 x) {
      vec3 i = floor(x); vec3 f = fract(x); f = f * f * (3.0 - 2.0 * f);
      return mix(mix(mix(jjH(i), jjH(i + vec3(1.0, 0.0, 0.0)), f.x), mix(jjH(i + vec3(0.0, 1.0, 0.0)), jjH(i + vec3(1.0, 1.0, 0.0)), f.x), f.y),
                 mix(mix(jjH(i + vec3(0.0, 0.0, 1.0)), jjH(i + vec3(1.0, 0.0, 1.0)), f.x), mix(jjH(i + vec3(0.0, 1.0, 1.0)), jjH(i + vec3(1.0, 1.0, 1.0)), f.x), f.y), f.z);
    }`;
  const DEF_PM = [
    [0.52, 0, 0.05, 0.5], [0.58, 0, 0.05, 0.45], [0.84, 0, 0.13, 0.32], [0.84, 0, 0.13, 0.3], [0.86, 0, 0.14, 0.28], [0.86, 0, 0.14, 0.28],
    [0.4, 0, 0.32, 0.6], [0.18, 0, 0, 0.15], [0.12, 0, 0, 0.1], [0.62, 0, 0.04, 0.2], [0.3, 0.75, 0.02, 0.45], [0.38, 0, 0.03, 0.3],
    [0.32, 0, 0.05, 0.3], [0.72, 0, 0.12, 0.32], [0.26, 0.85, 0, 0.45], [0.8, 0, 0.1, 0.3],
  ];
  R3.paletteMaterial = function (colors, opts, pm, skinned) {
    const lo = R3.quality === 0;
    const base = Object.assign({ vertexColors: true }, opts || {});
    if (skinned) base.skinning = true;
    const m = lo ? new THREE.MeshLambertMaterial(base) : new THREE.MeshStandardMaterial(Object.assign({ roughness: 0.8, metalness: 0 }, base));
    const pal = colors.map((c) => (c && c.isColor ? c.clone() : new THREE.Color(c)));
    while (pal.length < 16) pal.push(new THREE.Color(1, 0, 1));
    m.userData.palette = { value: pal };
    const PM = (pm || DEF_PM).map((a) => new THREE.Vector4(a[0], a[1], a[2], a[3]));
    while (PM.length < 16) PM.push(new THREE.Vector4(0.8, 0, 0, 0.3));
    m.userData.pmat = { value: PM };
    m.userData.fxU = { value: 0 };
    m.onBeforeCompile = (sh) => {
      sh.uniforms.palette = m.userData.palette;
      sh.uniforms.pmat = m.userData.pmat;
      sh.uniforms.uChSky = R3.uChSky;
      if (lo) {
        sh.vertexShader = sh.vertexShader
          .replace('#include <common>', '#include <common>\nuniform vec3 palette[16];')
          .replace('#include <color_vertex>', 'vColor = palette[int(color.r + 0.5)] * color.g;');
      } else {
        sh.vertexShader = sh.vertexShader
          .replace('#include <common>', '#include <common>\nuniform vec3 palette[16]; uniform vec4 pmat[16]; varying vec4 vPM; varying vec3 vOP; varying float vSk;')
          .replace('#include <color_vertex>', 'int jjS = int(color.r + 0.5); vColor = palette[jjS] * color.g; vPM = pmat[jjS]; vOP = position; vSk = color.b;');
        sh.fragmentShader = sh.fragmentShader
          .replace('#include <common>', '#include <common>\nuniform vec3 uChSky; varying vec4 vPM; varying vec3 vOP; varying float vSk;' + NOISE_GLSL)
          // кожа: тёплый отсвет в тенях (подповерхностное рассеяние «на глаз»)
          .replace('#include <lights_fragment_end>', '#include <lights_fragment_end>\nreflectedLight.indirectDiffuse += diffuseColor.rgb * vec3(0.2, 0.075, 0.045) * vSk * (0.25 + dot(uChSky, vec3(0.4)));')
          // ткань и волосы: мелкое переплетение и крупные складки (волосы — вытянутые пряди)
          .replace(
            '#include <color_fragment>',
            '#include <color_fragment>\n{ vec3 sc = mix(vec3(36.0), vec3(120.0, 22.0, 120.0), step(0.25, vPM.z)); float n = jjN(vOP * sc) * 0.6 + jjN(vOP * sc * 2.7) * 0.4; float f = jjN(vOP * vec3(9.0, 5.0, 9.0)); diffuseColor.rgb *= 1.0 + ((n - 0.5) * 1.6 + (f - 0.5) * 0.9) * vPM.z; }'
          )
          .replace('#include <roughnessmap_fragment>', 'float roughnessFactor = vPM.x;')
          .replace('#include <metalnessmap_fragment>', 'float metalnessFactor = vPM.y;')
          // контурный свет неба: силуэт отделяется от фона, металл и глаза ловят отблеск неба
          .replace(
            '#include <tonemapping_fragment>',
            '{ float rimF = pow(1.0 - saturate(dot(normal, normalize(vViewPosition))), 3.0); gl_FragColor.rgb += uChSky * (rimF * vPM.w * 0.55 + vPM.y * 0.35) * diffuseColor.rgb + uChSky * rimF * vPM.w * 0.08; }\n#include <tonemapping_fragment>'
          );
      }
      R3.fxPatchShader(sh, m.userData.fxU);
    };
    m.customProgramCacheKey = () => (lo ? 'jj-pal-lo' : 'jj-pal-pbr');
    return m;
  };

  // ---------- Человек ----------
  // слоты палитры: 0 кожа, 1 кожа-тень, 2 верх, 3 верх-тёмный, 4 низ, 5 низ-тёмный, 6 волосы, 7 белки, 8 радужка,
  // 9 тёмный, 10 золото, 11 губы, 12 обувь, 13 второй цвет (шапка, галстук, шарф), 14 цепочка, 15 рубашка под верхом
  const S = SLOT(0, 1), SD = SLOT(1, 1), TOP = SLOT(2), TOPD = SLOT(3), BOT = SLOT(4), BOTD = SLOT(5), H = SLOT(6);
  const WHITE = SLOT(7), EYE = SLOT(8), DARK = SLOT(9), GOLD = SLOT(10), LIP = SLOT(11, 1), SHOE = SLOT(12), ACC2 = SLOT(13), CHAIN = SLOT(14), ACC = SLOT(15);
  const HY = 1.695; // центр головы

  function hair(gb, style, fem) {
    const top = HY;
    const capH = (k = 1) => gb.geo(PR.cap, M4(0, top + 0.012, -0.012, 0.108 * k, 0.13 * k, 0.122 * k, -0.42), H);
    const sides = () => {
      for (const sx of [-1, 1]) ell(gb, H, sx * 0.094, top - 0.02, -0.012, 0.02, 0.058, 0.055);
    };
    // прядь-конус: от корня наружу
    const strand = (x, y, z, l, r, ax, az) => gb.geo(LO ? PR.cone4 : PR.cone6, M4(x, y, z, r, l, r * 0.8, ax, 0, az), H);
    switch (style) {
      case 'bald':
        break;
      case 'pompadour':
        // знаменитый помпадур Джоске: высокий валик вперёд, гладкие бока, «утиный хвост» сзади
        capH();
        ell(gb, H, 0, top + 0.1, 0.055, 0.085, 0.07, 0.13, -0.25);
        ell(gb, H, 0, top + 0.125, 0.15, 0.075, 0.06, 0.1, -0.5);
        ell(gb, H, 0, top + 0.12, 0.22, 0.06, 0.045, 0.055, -0.7);
        ell(gb, H, 0, top - 0.03, -0.088, 0.1, 0.09, 0.05);
        for (const sx of [-1, 1]) {
          ell(gb, H, sx * 0.095, top + 0.0, -0.01, 0.024, 0.06, 0.075);
          strand(sx * 0.03, top - 0.09, -0.1, 0.07, 0.025, 0.5, sx * 0.2);
        }
        break;
      case 'cap': {
        // фуражка Джотаро: высокая тулья, козырёк, золотая кокарда, цепочка; сзади фуражка срастается с волосами
        const hatC = ACC2;
        capH();
        ell(gb, H, 0, top - 0.05, -0.088, 0.1, 0.09, 0.05);
        sides();
        // околыш, расширяющаяся тулья с наклоном назад, плоский верх
        gb.geo(taper(0.114, 0.112, 12), M4(0, top + 0.065, -0.012, 1, 0.045, 1.06, -0.12), DARK);
        gb.geo(taper(0.135, 0.116, 12), M4(0, top + 0.115, -0.022, 1, 0.065, 1.08, -0.2), hatC);
        ell(gb, hatC, 0, top + 0.148, -0.03, 0.134, 0.016, 0.144, -0.2);
        gb.geo(taper(0.12, 0.12, 12), M4(0, top + 0.05, 0.05, 1, 0.01, 1.25, 0.16), DARK);
        box(gb, GOLD, -0.035, top + 0.11, 0.125, 0.036, 0.032, 0.01, -0.2);
        // цепочка по тулье
        for (let k = 0; k < 7; k++) {
          const a = -0.3 + k * 0.23;
          gb.geo(PR.torus, M4(Math.sin(a) * 0.124, top + 0.088 + k * 0.004, Math.cos(a) * 0.124 - 0.016, 0.011, 0.011, 0.011, 0, a + Math.PI / 2, 0), CHAIN);
        }
        // рваный край сзади
        for (let k = 0; k < 5; k++) strand(-0.08 + k * 0.04, top + 0.03, -0.13, 0.09, 0.03, 0.9 + (k % 2) * 0.25, (k - 2) * 0.15);
        break;
      }
      case 'curls':
        // три завитка Джорно и коса
        capH();
        for (let k = -1; k <= 1; k++) gb.geo(PR.torus, M4(k * 0.042, top + 0.065, 0.112, 0.02, 0.02, 0.02, 0, 0, 0), H);
        for (let k = 0; k < 5; k++) ell(gb, H, 0, top - 0.06 - k * 0.065, -0.12 - k * 0.01, 0.03 - k * 0.002, 0.038, 0.028, 0, 0, 0, true);
        sides();
        break;
      case 'long':
        // длинные волосы до плеч: пробор, пряди чёлки по лбу, локоны вдоль щёк, тяжёлая масса сзади с прядями на концах
        capH();
        ell(gb, H, 0, top - 0.11, -0.07, 0.114, 0.2, 0.055);
        for (const sx of [-1, 1]) {
          ell(gb, H, sx * 0.1, top - 0.06, 0.0, 0.028, 0.13, 0.055);
          for (let k = 0; k < 3; k++) strand(sx * (0.018 + k * 0.03), top + 0.07 - k * 0.012, 0.105 - k * 0.014, 0.08 - k * 0.01, 0.028, 2.75, -sx * (0.25 + k * 0.2));
          strand(sx * 0.098, top - 0.15, 0.035, 0.17, 0.032, Math.PI - 0.12, -sx * 0.1);
          strand(sx * 0.105, top - 0.17, -0.02, 0.19, 0.034, Math.PI + 0.06, -sx * 0.14);
        }
        for (let k = 0; k < 7; k++) strand(-0.1 + k * 0.033, top - 0.32 + Math.abs(k - 3) * 0.012, -0.072 + Math.abs(k - 3) * 0.006, 0.12, 0.03, Math.PI - 0.12, (k - 3) * 0.06);
        break;
      case 'spiky':
        capH();
        for (let k = 0; k < 11; k++) {
          const a = (k / 11) * Math.PI * 2;
          strand(Math.cos(a) * 0.065, top + 0.1, Math.sin(a) * 0.065 - 0.015, 0.13, 0.035, Math.sin(a) * 0.8, -Math.cos(a) * 0.8);
        }
        strand(0, top + 0.13, 0, 0.12, 0.035, 0, 0);
        sides();
        break;
      case 'buns':
        // пучки Джолин, чёлка и косичка
        capH();
        for (const sx of [-1, 1]) {
          ell(gb, H, sx * 0.07, top + 0.125, -0.02, 0.055, 0.052, 0.055);
          strand(sx * 0.07, top + 0.17, -0.02, 0.05, 0.02, 0, sx * 0.3);
        }
        ell(gb, H, 0, top - 0.06, -0.09, 0.09, 0.08, 0.045);
        for (let k = 0; k < 4; k++) ell(gb, H, 0, top - 0.13 - k * 0.055, -0.115, 0.022, 0.032, 0.022, 0, 0, 0, true);
        for (let k = 0; k < 4; k++) strand(-0.05 + k * 0.034, top + 0.09, 0.105, 0.05, 0.02, 2.6, (k - 1.5) * 0.15);
        sides();
        break;
      default: {
        // короткая: чёлка прядями, бока, затылок
        capH();
        ell(gb, H, 0, top - 0.05, -0.088, 0.1, 0.09, 0.05);
        for (let k = 0; k < 5; k++) strand(-0.06 + k * 0.03, top + 0.07, 0.1, 0.06, 0.026, 2.5, (k - 2) * 0.18);
        sides();
      }
    }
  }

  // лицо: глазницы, белки, радужка, зрачок, ресницы, брови, нос, губы, уши, скулы
  function face(gb, fem, look) {
    const y = HY;
    ellH(gb, S, 0, y + 0.012, -0.008, 0.098, 0.118, 0.11);
    ellH(gb, S, 0, y - 0.036, 0.024, fem ? 0.077 : 0.083, 0.078, 0.084);
    ell(gb, S, 0, y - 0.084, 0.048, fem ? 0.03 : 0.037, 0.03, 0.038);
    // надбровье
    ell(gb, S, 0, y + 0.026, 0.078, 0.086, 0.021, 0.031);
    if (LO) {
      for (const sx of [-1, 1]) {
        ell(gb, DARK, sx * 0.036, y + 0.006, 0.096, 0.02, 0.012, 0.01, 0, 0, 0, true);
        box(gb, H, sx * 0.04, y + 0.036, 0.102, 0.05, 0.013, 0.014, 0, 0, -sx * 0.14);
      }
      box(gb, S, 0, y - 0.015, 0.106, 0.018, 0.05, 0.024, -0.32);
      box(gb, LIP, 0, y - 0.072, 0.102, 0.034, 0.012, 0.01);
      return;
    }
    for (const sx of [-1, 1]) {
      ell(gb, SD, sx * 0.036, y + 0.007, 0.088, 0.024, 0.0145, 0.013);
      ell(gb, WHITE, sx * 0.036, y + 0.005, 0.0945, 0.0172, 0.0092, 0.0085);
      ell(gb, EYE, sx * 0.034, y + 0.0052, 0.1005, 0.0082, 0.0086, 0.004);
      ell(gb, DARK, sx * 0.034, y + 0.0052, 0.1038, 0.0038, 0.0042, 0.0016);
      // верхнее веко и ресницы (у женщин гуще, с хвостиком)
      box(gb, DARK, sx * 0.037, y + 0.0162, 0.1005, 0.042, fem ? 0.0068 : 0.0048, 0.008, 0.25, 0, sx * 0.06);
      if (fem) box(gb, DARK, sx * 0.058, y + 0.016, 0.094, 0.014, 0.005, 0.006, 0.2, 0, sx * 0.5);
      // брови: у мужчин тяжёлые, как у героев ДжоДжо
      box(gb, H, sx * 0.04, y + 0.035, 0.103, 0.052, fem ? 0.0075 : 0.013, 0.014, 0, 0, sx * (fem ? 0.06 : 0.17));
      // уши
      ell(gb, S, sx * 0.097, y - 0.008, -0.01, 0.014, 0.03, 0.022);
      ell(gb, SD, sx * 0.103, y - 0.008, -0.007, 0.006, 0.018, 0.012, 0, 0, 0, true);
      // ноздри
      ell(gb, SD, sx * 0.009, y - 0.044, 0.11, 0.006, 0.0042, 0.005, 0, 0, 0, true);
    }
    // нос
    box(gb, S, 0, y - 0.012, 0.106, fem ? 0.014 : 0.018, 0.05, 0.024, -0.32);
    ell(gb, S, 0, y - 0.038, fem ? 0.111 : 0.113, fem ? 0.014 : 0.018, 0.013, 0.016);
    // губы
    ell(gb, LIP, 0, y - 0.068, 0.1055, 0.025, 0.0065, 0.008);
    ell(gb, LIP, 0, y - 0.077, 0.103, 0.021, 0.0078, 0.009);
    box(gb, DARK, 0, y - 0.0718, 0.1095, 0.03, 0.0022, 0.004);
    if (look.acc && look.acc.indexOf('headband') >= 0) {
      // повязка ДИО с сердечком
      gb.geo(taper(0.104, 0.104, 14), M4(0, y + 0.05, -0.006, 1, 0.022, 1.08, 0.15), GOLD);
      heartH(gb, GOLD, 0, y + 0.06, 0.112, 0.02);
    }
    if (look.acc && look.acc.indexOf('earring') >= 0) for (const sx of [-1, 1]) gb.geo(PR.torus, M4(sx * 0.1, y - 0.045, -0.005, 0.008, 0.008, 0.008, 0, Math.PI / 2, 0), GOLD);
  }
  // сердечко лицом вперёд (+z)
  function heartH(gb, c, x, y, z, s) {
    ell(gb, c, x - s * 0.45, y + s * 0.2, z, s * 0.55, s * 0.5, s * 0.3, 0, 0, 0, true);
    ell(gb, c, x + s * 0.45, y + s * 0.2, z, s * 0.55, s * 0.5, s * 0.3, 0, 0, 0, true);
    gb.geo(PR.cone4, M4(x, y - s * 0.4, z, s * 0.75, s * 0.9, s * 0.3, Math.PI), c);
  }

  // кисть с пальцами (полусогнутые); ладонь смотрит к телу (−sx), большой палец — вперёд (+z)
  function hand(gb, sx, k, c, cd) {
    ell(gb, c, 0, -0.287 * 1, 0.002, 0.019 * k, 0.04 * k, 0.034 * k);
    if (LO) {
      ell(gb, c, -sx * 0.006, -0.33, 0.004, 0.017 * k, 0.03 * k, 0.03 * k);
      return;
    }
    const zs = [-0.024, -0.008, 0.008, 0.024], ls = [0.026, 0.032, 0.034, 0.031];
    for (let f = 0; f < 4; f++) {
      const r = (f === 0 ? 0.0068 : 0.0078) * k;
      const p = seg(gb, c, -sx * 0.003, -0.318 * 1 - (f === 1 || f === 2 ? 0.004 : 0), zs[f] * k, 0, -sx * 0.35, ls[f] * k, r, r * 0.92);
      seg(gb, c, p[0], p[1], p[2], 0, -sx * 1.15, 0.026 * k, r * 0.92, r * 0.8);
    }
    const p = seg(gb, c, -sx * 0.01, -0.272, 0.028 * k, -0.7, -sx * 0.25, 0.028 * k, 0.0105 * k, 0.009 * k);
    seg(gb, c, p[0], p[1], p[2], -0.35, -sx * 0.75, 0.024 * k, 0.009 * k, 0.0075 * k);
  }

  // обувь: пятка, подъём, носок, подошва, язычок; у женщин — каблук
  function shoe(gb, fem, sporty) {
    ell(gb, SHOE, 0, -0.412, 0.012, 0.045, 0.047, 0.07);
    ell(gb, SHOE, 0, -0.434, 0.075, 0.045, 0.033, 0.085);
    ell(gb, SHOE, 0, -0.446, 0.142, 0.039, 0.024, 0.045);
    box(gb, DARK, 0, -0.466, 0.06, 0.094, 0.016, 0.262);
    if (!LO) {
      box(gb, sporty ? WHITE : SHOE, 0, -0.405, 0.088, 0.03, 0.008, 0.06, -0.5);
      if (sporty) box(gb, WHITE, 0, -0.455, 0.06, 0.097, 0.014, 0.264);
    }
    if (fem) box(gb, DARK, 0, -0.45, -0.035, 0.028, 0.05, 0.03);
  }

  // Одежда: стиль верха задаёт силуэт, цвета — из палитры
  J.OUTFIT_STYLES = [
    { id: 'shirt', name: 'Рубашка' },
    { id: 'jacket', name: 'Пиджак' },
    { id: 'gakuran', name: 'Гакуран' },
    { id: 'tee', name: 'Футболка' },
    { id: 'dress', name: 'Платье' },
  ];
  const styleOf = (look) => {
    const s = look.style;
    if (s && J.OUTFIT_STYLES.some((o) => o.id === s)) return s === 'dress' && look.gender !== 'f' ? 'shirt' : s;
    if (look.coat || look.hair === 'cap') return 'gakuran';
    return 'shirt';
  };

  function torsoB(gb, b, fem, st, coat, acc) {
    const dress = st === 'dress';
    const h = b.hip, w = b.waist, c = b.chest, sh = b.sh, nk = fem ? 0.044 : 0.053;
    const PB = dress ? TOP : BOT;
    // корпус одним гладким лофтом: таз → талия → грудная клетка → плечи → основание шеи
    loft(gb, [
      [1.54, nk * 1.12, nk * 1.0, nk * 1.05, -0.004, TOP],
      [1.515, nk * 1.55, nk * 1.25, nk * 1.35, -0.01, TOP],
      [1.485, sh * 0.66, c * 0.42, c * 0.46, -0.014, TOP],
      [1.45, sh * 0.93, c * 0.52, c * 0.52, -0.01, TOP],
      [1.39, c * (fem ? 0.97 : 1.03), c * (fem ? 0.66 : 0.7), c * 0.6, 0, TOP],
      [1.31, c * (fem ? 0.93 : 0.98), c * (fem ? 0.8 : 0.7), c * 0.6, 0.004, TOP],
      [1.22, (w + c) * 0.48, c * 0.62, c * 0.57, 0.002, TOP],
      [1.12, w, w * 0.76, w * 0.72, 0, TOP],
      [1.075, w * 1.03, w * 0.78, w * 0.74, 0, TOP],
      [1.074, w * 1.03, w * 0.78, w * 0.74, 0, PB],
      [1.02, (w + h) * 0.5, h * 0.7, h * 0.74, 0, PB],
      [0.96, h, h * 0.68, h * 0.84, -0.006, PB],
      [0.9, h * 0.94, h * 0.62, h * 0.76, -0.004, PB],
      [0.85, h * 0.66, h * 0.44, h * 0.5, 0, PB],
    ], 14, 2.3, true, false);
    // пояс с пряжкой
    tube(gb, DARK, 0, 1.088, 0, w * 1.04 + 0.006, w * 1.04 + 0.006, 0.042, 0.77, 0, 0, 12);
    box(gb, GOLD, 0, 1.066, w * 0.78 + 0.008, 0.044, 0.03, 0.01);
    // шея с кадыком
    tube(gb, S, 0, 1.635, 0, fem ? 0.041 : 0.049, nk, 0.13);
    if (!fem && !LO) ell(gb, S, 0, 1.565, 0.046, 0.011, 0.015, 0.01, 0, 0, 0, true);
    const zf = b.chest * 0.68; // передняя поверхность груди
    switch (st) {
      case 'gakuran': {
        // гакуран: высокий стоячий воротник, золотые пуговицы, полы ниже пояса (с плащом — до колен)
        tube(gb, TOPD, 0, 1.6, 0, 0.066, 0.07, 0.08);
        ell(gb, TOPD, 0, 1.522, 0, 0.072, 0.012, 0.068);
        for (let k = 0; k < 5; k++) ell(gb, GOLD, 0, 1.48 - k * 0.085, zf + 0.004 - (k > 2 ? 0.01 : 0), 0.011, 0.011, 0.007, 0, 0, 0, true);
        box(gb, TOPD, 0, 1.3, zf - 0.003, 0.008, 0.36, 0.006);
        // значки на воротнике (у Джоске — сердечко и мир)
        box(gb, GOLD, -0.045, 1.575, 0.05, 0.014, 0.014, 0.006);
        ell(gb, GOLD, 0.045, 1.575, 0.05, 0.008, 0.008, 0.005, 0, 0, 0, true);
        const len = coat ? 0.6 : 0.22;
        tube(gb, TOP, 0, 1.1, -0.004, b.waist + 0.024, b.hip + (coat ? 0.13 : 0.05), len, 0.76, 0, 0, 12);
        tube(gb, TOPD, 0, 1.1 - len + 0.02, -0.004, b.hip + (coat ? 0.127 : 0.048), b.hip + (coat ? 0.132 : 0.052), 0.025, 0.76, 0, 0, 12);
        if (coat) {
          // разрез спереди и сзади, тёмная подкладка
          box(gb, TOPD, 0, 0.78, b.hip * 0.95 + 0.04, 0.025, 0.42, 0.01);
          box(gb, TOPD, 0, 0.78, -b.hip * 0.95 - 0.04, 0.025, 0.42, 0.01);
        }
        break;
      }
      case 'jacket': {
        // пиджак нараспашку: лацканы, рубашка/майка под ним, полы
        ell(gb, ACC, 0, 1.39, zf - 0.016, 0.056, 0.12, 0.026);
        tube(gb, ACC, 0, 1.56, 0, 0.062, 0.066, 0.03);
        for (const sx of [-1, 1]) {
          box(gb, TOPD, sx * 0.052, 1.415, zf - 0.002, 0.032, 0.19, 0.008, -0.12, 0, sx * 0.3);
          box(gb, TOPD, sx * 0.1, 1.17, zf - 0.016, 0.05, 0.006, 0.008);
        }
        tube(gb, TOP, 0, 1.12, -0.012, b.waist + 0.024, b.hip + 0.045, 0.2, 0.74, 0, 0, 12);
        break;
      }
      case 'tee': {
        tube(gb, TOP, 0, 1.54, 0, 0.064, 0.07, 0.02);
        break;
      }
      case 'dress': {
        // платье: вырез, юбка-трапеция до колен
        ell(gb, S, 0, 1.47, 0.05, 0.05, 0.04, 0.03);
        tube(gb, TOP, 0, 1.08, 0, b.waist + 0.012, b.hip + 0.11, 0.42, 0.86, 0, 0, 14);
        tube(gb, TOPD, 0, 0.675, 0, b.hip + 0.108, b.hip + 0.112, 0.022, 0.86, 0, 0, 14);
        break;
      }
      default: {
        // рубашка: отложной воротник, планка, карман
        tube(gb, TOP, 0, 1.575, 0, 0.064, 0.07, 0.045);
        for (const sx of [-1, 1]) box(gb, TOPD, sx * 0.03, 1.515, 0.06, 0.045, 0.032, 0.008, -0.5, 0, sx * 0.55);
        box(gb, TOPD, 0, 1.3, zf + 0.002, 0.014, 0.34, 0.006);
        for (let k = 0; k < 4; k++) ell(gb, WHITE, 0, 1.46 - k * 0.09, zf + 0.006, 0.007, 0.007, 0.004, 0, 0, 0, true);
        box(gb, TOPD, 0.07, 1.38, zf - 0.005, 0.05, 0.05, 0.006);
        if (coat) tube(gb, TOP, 0, 1.08, -0.005, b.waist + 0.035, b.hip + 0.12, 0.58, 0.74, 0, 0, 12);
      }
    }
    if (acc.indexOf('tie') >= 0) {
      // галстук (у Киры — в черепах)
      ell(gb, ACC, 0, 1.38, zf - 0.012, 0.05, 0.12, 0.022);
      ell(gb, ACC2, 0, 1.52, 0.062, 0.016, 0.014, 0.01);
      gb.geo(PR.cone4, M4(0, 1.36, zf + 0.012, 0.024, 0.28, 0.008, Math.PI), ACC2);
      if (!LO) for (let k = 0; k < 3; k++) ell(gb, WHITE, 0, 1.44 - k * 0.07, zf + 0.018, 0.006, 0.006, 0.003, 0, 0, 0, true);
    }
    if (acc.indexOf('chain') >= 0) {
      // цепочка Джотаро: от левой стороны воротника дугой к груди
      for (let k = 0; k < 9; k++) {
        const t = k / 8;
        gb.geo(PR.torus, M4(-0.05 - t * 0.075, 1.56 - t * 0.17 + Math.sin(t * Math.PI) * 0.02, 0.06 + Math.sin(t * Math.PI) * 0.035 + t * 0.07, 0.011, 0.011, 0.011, 0, k % 2 ? Math.PI / 2 : 0, 0.6), CHAIN);
      }
    }
    if (acc.indexOf('scarf') >= 0) {
      tube(gb, ACC2, 0, 1.6, 0, 0.07, 0.08, 0.07);
      box(gb, ACC2, 0.04, 1.42, zf + 0.02, 0.05, 0.24, 0.015, -0.1, 0, 0.1);
    }
    if (acc.indexOf('hearts') >= 0) heartH(gb, GOLD, 0, 1.0, b.hip * 0.74 + 0.01, 0.03);
  }

  // ноги и руки — лофты с рельефом мышц (квадрицепс, икра, дельта, бицепс, предплечье)
  function thighB(gb, b, st) {
    const l = b.leg;
    loft(gb, [
      [0.07, l * 0.86, l * 0.84, l * 0.9, -0.004, BOT],
      [0.0, l * 1.0, l * 0.98, l * 1.0, 0, BOT],
      [-0.12, l * 0.98, l * 1.02, l * 0.94, 0.006, BOT],
      [-0.26, l * 0.88, l * 0.92, l * 0.84, 0.006, BOT],
      [-0.38, l * 0.76, l * 0.78, l * 0.72, 0.004, BOT],
      [-0.46, l * 0.72, l * 0.76, l * 0.7, 0.006, BOT],
    ], 10, 2, true, true);
  }
  function shinB(gb, b, fem, st, acc) {
    const l = b.leg, cuff = st !== 'dress';
    loft(gb, [
      [0.03, l * 0.72, l * 0.78, l * 0.7, 0.006, BOT],
      [-0.05, l * 0.72, l * 0.74, l * 0.78, 0, BOT],
      [-0.13, l * 0.72, l * 0.66, l * 0.86, -0.006, BOT],
      [-0.24, l * 0.6, l * 0.58, l * 0.66, -0.004, BOT],
      [-0.33, l * 0.52, l * 0.52, l * 0.52, 0, BOT],
      [-0.335, l * (cuff ? 0.62 : 0.52), l * (cuff ? 0.64 : 0.52), l * (cuff ? 0.62 : 0.52), 0, cuff ? BOTD : BOT],
      [-0.38, l * (cuff ? 0.62 : 0.5), l * (cuff ? 0.64 : 0.5), l * (cuff ? 0.62 : 0.5), 0, cuff ? BOTD : BOT],
    ], 10, 2, true, true);
    if (acc.indexOf('hearts') >= 0) heartH(gb, GOLD, 0, -0.01, b.leg * 0.8, 0.04);
    shoe(gb, fem, st === 'tee');
  }
  function upperB(gb, b, sx, st) {
    const a = b.arm, tee = st === 'tee' || st === 'dress';
    const sl = st === 'dress' ? -0.05 : -0.14;
    const R = [
      [0.035, a * 0.78, a * 0.8, a * 0.84, 0, TOP],
      [-0.01, a * 1.08, a * 1.02, a * 1.04, 0, TOP],
      [-0.07, a * 1.04, a * 1.0, a * 1.0, 0, TOP],
    ];
    if (tee) {
      R.push([sl, a * 1.02, a * 1.02, a * 1.0, 0, TOP], [sl - 0.002, a * 0.92, a * 0.98, a * 0.9, 0, S], [-0.2, a * 0.86, a * 0.92, a * 0.84, 0, S], [-0.29, a * 0.78, a * 0.78, a * 0.78, 0, S]);
      tube(gb, TOPD, 0, sl + 0.008, 0, a * 1.05, a * 1.05, 0.014);
    } else R.push([-0.15, a * 0.96, a * 1.02, a * 0.92, 0, TOP], [-0.22, a * 0.88, a * 0.9, a * 0.86, 0, TOP], [-0.29, a * 0.8, a * 0.8, a * 0.8, 0, TOP]);
    loft(gb, R, 10, 2, true, true);
  }
  function foreB(gb, b, sx, fem, st) {
    const a = b.arm, bare = st === 'tee' || st === 'dress';
    const c = bare ? S : TOP;
    const R = [
      [0.03, a * 0.8, a * 0.8, a * 0.8, 0, c],
      [-0.05, a * 0.88, a * 0.9, a * 0.84, 0.004, c],
      [-0.13, a * 0.74, a * 0.74, a * 0.7, 0.002, c],
    ];
    if (bare) R.push([-0.2, a * 0.6, a * 0.56, a * 0.56, 0, S], [-0.25, a * 0.52, a * 0.48, a * 0.48, 0, S]);
    else R.push([-0.19, a * 0.66, a * 0.64, a * 0.64, 0, TOP], [-0.191, a * 0.72, a * 0.7, a * 0.7, 0, TOPD], [-0.225, a * 0.72, a * 0.7, a * 0.7, 0, TOPD], [-0.226, a * 0.54, a * 0.5, a * 0.5, 0, S], [-0.255, a * 0.52, a * 0.48, a * 0.48, 0, S]);
    loft(gb, R, 10, 2, true, true);
    hand(gb, sx, fem ? 0.88 : 1 + (b.arm - 0.05) * 3, S, SD);
  }

  R3.buildHuman = function (look, scale = 1) {
    const skin = col(look.skin), top = col(look.top), bot = col(look.bottom);
    const skinD = skin.clone().multiplyScalar(0.86).lerp(col('#8a4038'), 0.1);
    const st = styleOf(look);
    const acc = look.acc || (look.hair === 'cap' && look.coat ? 'chain' : '');
    const fem = look.gender === 'f';
    // рубашка под пиджаком — светлая, под тёмным пиджаком — белая; второй цвет — по образу
    const under = look.under || (top.getHSL({}).l > 0.6 ? '#2a2a33' : '#ecebe6');
    const mat = R3.paletteMaterial(
      [
        skin, skinD, top, top.clone().multiplyScalar(0.62), bot, bot.clone().multiplyScalar(0.7), col(look.hairColor), '#e2dcd4', look.eye || '#3a2a20',
        '#18151c', '#e8b830', skinD.clone().lerp(col(fem ? '#c03a4a' : '#a0504a'), fem ? 0.55 : 0.3), look.shoe || (st === 'tee' ? '#d8d8dc' : '#2a2228'), look.hat || (look.hair === 'cap' ? '#1f2a44' : '#5a2a6a'), '#d8b860', under,
      ],
      null,
      null,
      true
    );
    const key = [look.gender, look.build || 'normal', look.hair, st, look.coat ? 1 : 0, acc].join('|');
    const v = makeRig({
      key: 'h|' + key,
      keys: {
        torso: 'ht|' + [look.gender, look.build || 'normal', st, look.coat ? 1 : 0, acc].join('|'),
        head: 'hh|' + [look.gender, look.hair, acc].join('|'),
        leg: 'hl|' + [look.gender, look.build || 'normal', st, acc].join('|'),
        arm: 'ha|' + [look.gender, look.build || 'normal', st].join('|'),
      },
      gender: look.gender,
      build: look.build,
      pal: true,
      lod: true,
      material: mat,
      torso: (gb, b) => torsoB(gb, b, fem, st, !!look.coat, acc),
      head: (gb) => {
        face(gb, fem, look);
        hair(gb, look.hair, fem);
      },
      thigh: (gb, b) => thighB(gb, b, st),
      shin: (gb, b) => shinB(gb, b, fem, st, acc),
      upper: (gb, b, sx) => upperB(gb, b, sx, st),
      fore: (gb, b, sx) => foreB(gb, b, sx, fem, st),
    });
    v.group.scale.setScalar(scale * (fem ? 0.95 : 1));
    v.kind = 'human';
    return v;
  };

  // Заранее собрать части всех вариантов прохожих (пол × телосложение × причёска × одежда, как в J.rndLook) —
  // тогда появление нового прохожего стоит доли миллисекунды (только слияние готовых частей)
  R3.prebuildRigs = function () {
    const H = { m: ['short', 'spiky', 'bald', 'pompadour', 'cap', 'curls'], f: ['long', 'buns', 'short'] };
    const ST = { m: ['shirt', 'jacket', 'tee', 'gakuran'], f: ['shirt', 'jacket', 'tee', 'dress'] };
    for (const g of ['m', 'f'])
      for (const build of ['normal', 'slim', 'muscular'])
        for (let i = 0; i < Math.max(H[g].length, ST[g].length); i++) {
          const v = R3.buildHuman({ gender: g, build, hair: H[g][i % H[g].length], style: ST[g][i % ST[g].length], skin: '#eac09f', hairColor: '#222', top: '#333', bottom: '#333' });
          if (v.lodF) v.lodF();
          v.mats.forEach((m) => m.dispose());
        }
  };

  // ---------- Стенд ----------
  // Оболочка-ореол: обратные грани чуть раздуты по нормали, светятся цветом стенда по краю силуэта
  const SHELL_VS = `
    #include <common>
    #include <skinning_pars_vertex>
    uniform float uW; varying float vF;
    void main() {
      #include <beginnormal_vertex>
      #include <skinbase_vertex>
      #include <skinnormal_vertex>
      #include <begin_vertex>
      #include <skinning_vertex>
      vec3 n = normalize(objectNormal);
      transformed += n * uW;
      vec4 mv = modelViewMatrix * vec4(transformed, 1.0);
      vec3 vn = normalize(normalMatrix * n);
      vF = 1.0 - abs(dot(vn, normalize(-mv.xyz)));
      gl_Position = projectionMatrix * mv;
    }`;
  const SHELL_FS = `
    uniform vec3 uC; uniform float uA; varying float vF;
    void main() { gl_FragColor = vec4(uC * (0.03 + pow(vF, 3.0) * 1.3) * uA, 1.0); }`;

  // Облик стендов по аниме: свои цвета тела, деталей, волос и кулаков там, где цвета данных — для эффектов
  const STAND_LOOK = {
    star_platinum: { c2: '#d6b25e', hair: '#1c1830', fist: '#5e4aa8' },
    star_platinum_tw: { c2: '#d6b25e', hair: '#1c1830', fist: '#5e4aa8' },
    the_world: { c1: '#e6b832', c2: '#2a6e52', fist: '#d9a92a' },
    crazy_diamond: { c1: '#d988c8', c2: '#58b8e0' },
    killer_queen: { c1: '#dc8cc4', c2: '#6a4a96' },
    kq_btd: { c1: '#d07ab8' },
    magicians_red: { c1: '#c8462e', c2: '#f0a22a' },
    silver_chariot: { c1: '#b8bfcc', c2: '#8a98b8' },
    hierophant_green: { c1: '#3aa86a', c2: '#c6ef8a' },
    gold_experience: { c1: '#e2b838' },
    sticky_fingers: { c1: '#4a66c4', c2: '#e8c446' },
    king_crimson: { c1: '#b8304a', c2: '#f0d0d0' },
  };
  // тело стенда чуть приглушённее цвета данных: живая кожа вместо неона
  const mute = (c, k) => {
    const h = {};
    c.getHSL(h);
    return c.setHSL(h.h, h.s * k, Math.min(h.l, 0.66));
  };
  // Материал стенда: PBR с влажным блеском «кожи-брони», мелким рельефом по шуму, тонким контуром цвета стенда,
  // светящимися вставками (сумма каналов вершины > 2.85); на низком качестве — Ламберт с контуром из powers.js
  const STAND_FS_HEAD = 'uniform vec3 uRimC; uniform float uRimK; uniform vec3 uChSky; varying vec3 vOP;' + NOISE_GLSL;
  R3.standMaterial = function (C1, C2) {
    if (R3.quality === 0) {
      const m = new THREE.MeshLambertMaterial({ vertexColors: true, emissive: C1.clone().multiplyScalar(0.1), skinning: true });
      if (R3.standPatch) R3.standPatch(m, '#' + C1.getHexString(), '#' + C2.getHexString());
      return m;
    }
    const m = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.36, metalness: 0.12, emissive: C1.clone().multiplyScalar(0.05), skinning: true });
    const U = { uRimC: { value: C1.clone().lerp(C2, 0.35).multiplyScalar(1.1) }, uRimK: { value: 0.35 } };
    m.userData.rim = U;
    m.onBeforeCompile = (sh) => {
      sh.uniforms.uRimC = U.uRimC;
      sh.uniforms.uRimK = U.uRimK;
      sh.uniforms.uChSky = R3.uChSky;
      sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vOP;').replace('#include <color_vertex>', '#include <color_vertex>\nvOP = position;');
      sh.fragmentShader = sh.fragmentShader
        .replace('#include <common>', '#include <common>\n' + STAND_FS_HEAD)
        // рельеф: крупные «мышечные» пятна и мелкая шероховатость — поверхность перестаёт быть пластмассой
        .replace('#include <color_fragment>', '#include <color_fragment>\nfloat jjG = step(2.85, vColor.r + vColor.g + vColor.b); float jjN1 = jjN(vOP * 9.0); float jjN2 = jjN(vOP * 46.0); diffuseColor.rgb *= 1.0 + ((jjN1 - 0.5) * 0.22 + (jjN2 - 0.5) * 0.1) * (1.0 - jjG);')
        .replace('#include <roughnessmap_fragment>', 'float roughnessFactor = roughness * (0.8 + jjN2 * 0.45);')
        .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance += vColor * 0.85 * jjG;')
        // контур цвета стенда и отсвет неба по силуэту
        .replace('#include <dithering_fragment>', '{ float rimF = 1.0 - abs(dot(normal, normalize(vViewPosition))); gl_FragColor.rgb += uRimC * pow(rimF, 3.0) * uRimK + uChSky * pow(rimF, 2.0) * 0.18 * diffuseColor.rgb; }\n#include <dithering_fragment>');
    };
    m.customProgramCacheKey = () => 'jj-stand-pbr';
    return m;
  };

  R3.buildStand = function (sd) {
    if (sd.head === 'plane' || sd.head === 'tiny' || sd.head === 'bug') return R3.buildStandSimple(sd);
    const SL = STAND_LOOK[sd.id] || {};
    const C1 = mute(col(SL.c1 || sd.c1), 0.82), C2 = mute(col(SL.c2 || sd.c2), 0.9);
    const C1D = C1.clone().multiplyScalar(0.62), C2D = C2.clone().multiplyScalar(0.62), C1L = C1.clone().lerp(col('#ffffff'), 0.12);
    const HAIR = SL.hair ? col(SL.hair) : C2, FIST = SL.fist ? col(SL.fist) : C2, FISTD = FIST.clone().multiplyScalar(0.62);
    const GLOW = col('#ffffff');
    // самосветящиеся вставки цвета стенда (сумма каналов > 2.85 — шейдер добавляет свечение)
    const GEM = C2.clone().lerp(col('#ffffff'), 0.25);
    const gs = GEM.r + GEM.g + GEM.b;
    GEM.multiplyScalar(3.1 / Math.max(0.3, gs));
    const mat = R3.standMaterial(C1, C2);
    R3.fxPatch(mat);
    // оружие на кисти — без скелета
    const xmat = new THREE.MeshPhongMaterial({ vertexColors: true, specular: col('#c8d0e0'), shininess: 80 });
    mat.userData.extraMat = xmat;
    const head = sd.head;
    const id = sd.id;
    const DK = col('#1a1424'), WH = col('#f4f0e8'), GOLD = col('#e8b830');
    const heart = (gb, c, x, y, z, s) => heartH(gb, c, x, y, z, s);
    const skull = (gb, x, y, z, s) => {
      ell(gb, WH, x, y, z, s, s * 0.9, s * 0.6);
      ell(gb, WH, x, y - s * 0.7, z + s * 0.05, s * 0.6, s * 0.4, s * 0.45);
      ell(gb, DK, x - s * 0.38, y - s * 0.05, z + s * 0.5, s * 0.25, s * 0.28, s * 0.12, 0, 0, 0, true);
      ell(gb, DK, x + s * 0.38, y - s * 0.05, z + s * 0.5, s * 0.25, s * 0.28, s * 0.12, 0, 0, 0, true);
    };
    // молния-застёжка: полоса с зубчиками
    const zip = (gb, x, y0, z, len, ax) => {
      box(gb, DK, x, y0 - len / 2, z, 0.012, len, 0.012, ax);
      for (let k = 0; k < Math.round(len / 0.035); k++) box(gb, col('#d8dce6'), x, y0 - 0.02 - k * 0.035, z + 0.004, 0.034, 0.012, 0.012, ax);
    };
    // броня/шлем есть у «механических» голов — пластины вместо голых мышц
    const armored = head === 'helmet' || head === 'mask' || head === 'egg' || head === 'skull' || head === 'horn';
    // Узнаваемые детали стендов (в общей кэшированной геометрии — ничего не стоят в кадре)
    const deco = {
      torso(gb, b) {
        // воротник-кольцо — у всех
        tube(gb, C2D, 0, 1.56, 0, 0.078, 0.085, 0.035);
        switch (id) {
          case 'star_platinum':
          case 'star_platinum_tw':
            // шарф и набедренная повязка
            tube(gb, col('#c4283c'), 0, 1.565, 0, 0.09, 0.1, 0.06);
            box(gb, col('#c4283c'), -0.05, 1.42, -0.13, 0.05, 0.26, 0.015, 0.25);
            box(gb, col('#a82034'), 0.04, 1.4, -0.14, 0.05, 0.3, 0.015, 0.32);
            box(gb, C2, 0, 0.83, b.hip * 0.7, 0.13, 0.28, 0.02, -0.08);
            box(gb, C2, 0, 0.83, -b.hip * 0.7, 0.13, 0.28, 0.02, 0.08);
            ell(gb, GOLD, 0, 1.08, b.waist + 0.01, 0.05, 0.035, 0.02);
            break;
          case 'the_world':
            // сердце на поясе, трубки на спине
            heart(gb, C2, 0, 1.08, b.waist + 0.02, 0.05);
            for (const sx of [-1, 1]) tube(gb, C2D, sx * 0.07, 1.6, -0.15, 0.022, 0.018, 0.5, 1, 0.12);
            box(gb, C2, 0, 1.38, b.chest * 0.66, 0.2, 0.035, 0.02);
            break;
          case 'crazy_diamond':
            heart(gb, C2, 0, 1.38, b.chest * 0.7, 0.045);
            for (const sx of [-1, 1]) heart(gb, C2, sx * (b.sh + 0.02), 1.46, 0.07, 0.035);
            for (const sx of [-1, 1]) tube(gb, C2D, sx * 0.06, 1.62, -0.13, 0.02, 0.016, 0.42, 1, 0.1);
            break;
          case 'killer_queen':
          case 'kq_btd':
            skull(gb, 0, 1.09, b.waist + 0.03, 0.045);
            for (let k = 0; k < 3; k++) box(gb, C2, 0, 1.24 + k * 0.07, b.chest * 0.6, 0.18 - k * 0.02, 0.012, 0.02);
            break;
          case 'gold_experience':
          case 'ger':
            for (const sx of [-1, 1]) ell(gb, C2, sx * 0.09, 1.36, b.chest * 0.74, 0.035, 0.035, 0.015);
            heart(gb, DK, 0, 1.22, b.waist * 0.85, 0.03);
            break;
          case 'silver_chariot':
            // латы
            ell(gb, C2, 0, 1.35, 0.03, b.chest + 0.03, 0.17, b.chest * 0.85);
            for (const sx of [-1, 1]) ell(gb, C2, sx * (b.sh + 0.03), 1.47, 0, 0.12, 0.07, 0.11);
            box(gb, col('#e8eefc'), 0, 1.35, b.chest * 0.82, 0.02, 0.2, 0.01);
            break;
          case 'magicians_red':
            for (const sx of [-1, 1]) for (let k = 0; k < 3; k++) gb.geo(PR.cone4, M4(sx * (b.sh + 0.05), 1.5 - k * 0.05, -0.02 - k * 0.03, 0.03, 0.16, 0.02, -0.4, 0, sx * (0.9 + k * 0.25)), C2);
            break;
          case 'hierophant_green':
            // дольки «дыни» и ленты-щупальца
            for (let k = -2; k <= 2; k++) box(gb, C1D, k * 0.06, 1.3, b.chest * 0.66 - Math.abs(k) * 0.02, 0.012, 0.32, 0.012, 0, k * 0.25);
            for (const sx of [-1, 1]) tube(gb, C2, sx * 0.09, 1.0, -0.08, 0.025, 0.008, 0.7, 1, 0.5, sx * 0.3);
            break;
          case 'sticky_fingers':
            zip(gb, 0, 1.5, b.chest * 0.66, 0.42, -0.08);
            break;
          case 'king_crimson':
            for (let k = -2; k <= 2; k++) {
              box(gb, C2, k * 0.06, 1.3, b.chest * 0.66, 0.008, 0.36, 0.012, 0, 0, 0.6);
              box(gb, C2, k * 0.06, 1.3, b.chest * 0.66, 0.008, 0.36, 0.012, 0, 0, -0.6);
            }
            break;
          case 'stone_free':
            for (let k = 0; k < 5; k++) tube(gb, C2, 0, 1.46 - k * 0.09, 0, b.chest * 0.95 + 0.01, b.chest * 0.95 + 0.01, 0.012);
            break;
          case 'the_hand':
            for (let k = 0; k < 4; k++) box(gb, C2, 0, 1.44 - k * 0.09, b.chest * 0.62, 0.22, 0.02, 0.02);
            break;
          case 'whitesnake':
            for (let k = 0; k < 6; k++) box(gb, DK, k % 2 ? 0.05 : -0.05, 1.45 - k * 0.06, b.chest * 0.64, 0.05, 0.012, 0.012);
            break;
          case 'made_in_heaven':
            box(gb, C2, 0, 1.3, b.chest * 0.66, 0.02, 0.3, 0.02);
            for (const sx of [-1, 1]) gb.geo(PR.cone4, M4(sx * 0.12, 1.45, -0.2, 0.05, 0.3, 0.02, -1.2, 0, sx * 0.6), C2);
            break;
          case 'echoes_3':
            box(gb, C2, 0, 1.3, b.chest * 0.64, 0.05, 0.12, 0.02);
            break;
        }
      },
      head(gb, y) {
        switch (id) {
          case 'the_world':
            for (const sx of [-1, 1]) tube(gb, C2D, sx * 0.08, y + 0.02, -0.09, 0.02, 0.016, 0.22, 1, 0.5);
            box(gb, C2, 0, y + 0.06, 0.11, 0.17, 0.02, 0.012);
            break;
          case 'crazy_diamond':
            heart(gb, C2, 0, y + 0.1, 0.1, 0.03);
            break;
          case 'killer_queen':
          case 'kq_btd':
            box(gb, C2, 0, y + 0.12, 0.04, 0.02, 0.06, 0.12);
            break;
          case 'star_platinum':
          case 'star_platinum_tw':
            ell(gb, col('#c4283c'), 0, y + 0.07, 0.1, 0.07, 0.016, 0.01);
            break;
        }
      },
      upper(gb, b, sx) {
        // тёмный стык у плеча
        tube(gb, C1D, 0, -0.02, 0, b.arm * 1.05, b.arm * 1.02, 0.03);
        if (id === 'sticky_fingers') zip(gb, b.arm * sx * 0.9, -0.02, 0.02, 0.26);
        if (id === 'killer_queen' || id === 'kq_btd') tube(gb, C2, 0, -0.18, 0, b.arm * 0.95, b.arm * 0.92, 0.03);
      },
      fore(gb, b, sx) {
        switch (id) {
          case 'killer_queen':
          case 'kq_btd':
            if (sx > 0) skull(gb, 0, -0.24, b.arm * 0.7, 0.025);
            break;
          case 'star_platinum':
          case 'star_platinum_tw':
          case 'the_world':
            tube(gb, GOLD, 0, -0.17, 0, b.arm * 0.88, b.arm * 0.88, 0.035);
            break;
          case 'crazy_diamond':
            heart(gb, C2, 0, -0.08, b.arm * 0.8, 0.022);
            break;
          case 'silver_chariot':
            tube(gb, C2, 0, -0.02, 0, b.arm * 0.95, b.arm * 0.9, 0.14);
            break;
        }
      },
      shin(gb, b) {
        switch (id) {
          case 'the_world':
          case 'crazy_diamond':
            heart(gb, C2, 0, -0.02, b.leg * 0.72, 0.04);
            break;
          case 'silver_chariot':
            ell(gb, C2, 0, -0.18, 0.02, b.leg * 0.8, 0.2, b.leg * 0.75);
            break;
          case 'sticky_fingers':
            zip(gb, 0, -0.04, b.leg * 0.66, 0.24);
            break;
        }
      },
    };
    // кулак стенда: ладонь, ряд костяшек (ударная поверхность снизу), подогнутые пальцы, большой палец
    const fist = (gb, b, sx) => {
      // сжатый кулак: ладонь, блок подогнутых пальцев, бугорки костяшек, большой палец поверх
      ell(gb, FIST, 0, -0.29, 0.004, 0.036, 0.048, 0.044);
      ell(gb, FIST, -sx * 0.006, -0.335, 0.004, 0.034, 0.03, 0.046);
      for (let f = 0; f < 4; f++) ell(gb, FISTD, sx * 0.012, -0.352, -0.027 + f * 0.018, 0.016, 0.012, 0.0095, 0, 0, 0, true);
      ell(gb, FIST, -sx * 0.026, -0.318, 0.03, 0.012, 0.03, 0.012, 0.9, 0, sx * 0.6);
      // наручи у локтя
      tube(gb, C2D, 0, -0.245, 0, b.arm * 0.74, b.arm * 0.8, 0.03);
    };
    const v = makeRig({
      key: 'stand|' + sd.id,
      gender: 'm',
      build: 'muscular',
      pal: false,
      lod: true,
      material: mat,
      torso(gb, b) {
        const c = b.chest, w = b.waist, h = b.hip, sh = b.sh;
        // торс-«треугольник»: широкие плечи и широчайшие, узкая талия — одним гладким лофтом
        loft(gb, [
          [1.6, 0.06, 0.06, 0.065, 0, C1],
          [1.53, 0.1, 0.08, 0.09, -0.01, C1],
          [1.49, sh * 0.74, c * 0.44, c * 0.5, -0.015, C1],
          [1.45, sh * 1.0, c * 0.56, c * 0.56, -0.01, C1],
          [1.39, c * 1.1, c * 0.72, c * 0.62, 0, C1],
          [1.31, c * 1.02, c * 0.7, c * 0.6, 0.004, C1],
          [1.22, (w + c) * 0.5, c * 0.6, c * 0.56, 0.004, C1],
          [1.13, w * 0.98, w * 0.74, w * 0.72, 0, C1],
          [1.1, w * 1.02, w * 0.76, w * 0.74, 0, C2],
          [1.06, w * 1.04, w * 0.76, w * 0.74, 0, C2],
          [1.059, w * 1.04, w * 0.76, w * 0.74, 0, C1D],
          [0.98, h * 1.0, h * 0.7, h * 0.8, -0.004, C1D],
          [0.9, h * 0.92, h * 0.62, h * 0.72, -0.004, C1D],
          [0.85, h * 0.62, h * 0.44, h * 0.5, 0, C1D],
        ], 16, 2.1, true, false);
        // рельеф: грудные, пресс, косые
        for (const sx of [-1, 1]) {
          ell(gb, C1L, sx * 0.078, 1.37, c * 0.5, 0.098, 0.06, 0.045, 0.3, 0, sx * 0.14);
          // складка под грудной мышцей
          ell(gb, C1D, sx * 0.08, 1.313, c * 0.665, 0.08, 0.006, 0.012, 0.3, 0, sx * 0.1);
          ell(gb, C1, sx * w * 0.8, 1.17, 0.025, 0.045, 0.09, 0.07, 0, 0, sx * 0.12);
        }
        for (let k = 0; k < 3; k++) for (const sx of [-1, 1]) ell(gb, C1L, sx * 0.038, 1.24 - k * 0.055, w * 0.66, 0.033, 0.024, 0.02, 0, 0, 0, true);
        box(gb, C1D, 0, 1.18, w * 0.72, 0.006, 0.16, 0.01);
        // наплечники: двойные пластины
        for (const sx of [-1, 1]) {
          ell(gb, C2, sx * (b.sh + 0.02), 1.45, 0, 0.095, 0.062, 0.095);
          ell(gb, C2D, sx * (b.sh + 0.03), 1.415, 0, 0.088, 0.03, 0.09);
        }
        if (armored) {
          // нагрудные пластины с окантовкой
          for (const sx of [-1, 1]) {
            box(gb, C2, sx * 0.075, 1.405, b.chest * 0.58, 0.11, 0.012, 0.02, 0.15, 0, -sx * 0.12);
            box(gb, C2, sx * 0.14, 1.32, b.chest * 0.48, 0.012, 0.15, 0.02, 0, 0, sx * 0.12);
          }
          for (const sx of [-1, 1]) box(gb, C2D, sx * 0.07, 0.99, b.hip * 0.66, 0.08, 0.1, 0.014, -0.1, 0, sx * 0.15);
        }
        // эмблема-самоцвет
        if (head === 'ladybug') ell(gb, C2, 0, 1.32, b.chest * 0.68, 0.035, 0.035, 0.015);
        else gb.geo(PR.oct, M4(0, 1.36, b.chest * 0.64, 0.032, 0.046, 0.018), GEM);
        if (head === 'cloak') tube(gb, C2D, 0, 1.5, -0.03, 0.2, 0.42, 1.1, 0.8, 0, 0, 12);
        if (head === 'eyes') for (let k = 0; k < 6; k++) ell(gb, GLOW, Math.cos(k * 1.3) * 0.12, 1.15 + (k % 3) * 0.09, b.chest * 0.6, 0.022, 0.022, 0.012, 0, 0, 0, true);
        deco.torso(gb, b);
      },
      head(gb) {
        const y = 1.71;
        if (head === 'egg') ell(gb, C2, 0, y + 0.03, -0.02, 0.12, 0.16, 0.13);
        else if (head !== 'cloud') ell(gb, C1, 0, y, 0, 0.105, 0.125, 0.115);
        // лицо: челюсть, надбровье, тёмные глазницы, «линии стенда» под глазами, губы
        if (head !== 'cloud') {
          // тяжёлая челюсть, квадратный подбородок, скулы
          ell(gb, C1, 0, y - 0.045, 0.026, 0.086, 0.078, 0.086);
          ell(gb, C1, 0, y - 0.094, 0.05, 0.044, 0.028, 0.042);
          for (const sx of [-1, 1]) {
            ell(gb, C1, sx * 0.056, y - 0.022, 0.068, 0.032, 0.026, 0.032);
            // тёмные глазницы и нахмуренные надбровья (к переносице ниже — грозный взгляд)
            ell(gb, C1D, sx * 0.038, y + 0.006, 0.092, 0.027, 0.016, 0.013, 0, 0, -sx * 0.15);
            ell(gb, C1, sx * 0.041, y + 0.027, 0.09, 0.042, 0.012, 0.022, 0, 0, sx * 0.3);
            // «линии стенда» на щеках — у шлемов и масок
            if (armored) box(gb, C1D, sx * 0.05, y - 0.03, 0.098, 0.004, 0.04, 0.006, 0, 0, sx * 0.12);
          }
          // нос — тонкий прямой гребень, губы на тон темнее тела
          box(gb, C1, 0, y - 0.016, 0.104, 0.014, 0.046, 0.02, -0.3);
          ell(gb, C1, 0, y - 0.04, 0.108, 0.014, 0.011, 0.013);
          ell(gb, C1D, 0, y - 0.067, 0.1, 0.022, 0.0055, 0.008);
          ell(gb, C1, 0, y - 0.076, 0.098, 0.019, 0.0075, 0.009);
          box(gb, DK, 0, y - 0.071, 0.104, 0.026, 0.002, 0.004);
        }
        // глаза — светящиеся, раскосые
        ell(gb, GLOW, -0.038, y + 0.008, 0.103, 0.02, 0.0095, 0.008, 0, 0, 0.18, true);
        ell(gb, GLOW, 0.038, y + 0.008, 0.103, 0.02, 0.0095, 0.008, 0, 0, -0.18, true);
        switch (head) {
          case 'mane':
            // грива Звёздной Платины: густые пряди назад и вверх, длинные — по плечам, чёлка на лоб
            gb.geo(PR.cap, M4(0, y + 0.012, -0.012, 0.118, 0.138, 0.128, -0.42), HAIR);
            for (let k = 0; k < 7; k++) {
              const u = k - 3;
              gb.geo(PR.cone6, M4(u * 0.032, y + 0.1 - Math.abs(u) * 0.012, -0.1, 0.045, 0.3 - Math.abs(u) * 0.025, 0.036, -1.25 - (k % 2) * 0.18, 0, u * 0.12), HAIR);
            }
            for (let k = 0; k < 6; k++) {
              const u = k - 2.5;
              gb.geo(PR.cone6, M4(u * 0.04, y - 0.06, -0.14 - Math.abs(u) * 0.005, 0.042, 0.34 - Math.abs(u) * 0.03, 0.03, -2.55 + (k % 2) * 0.12, 0, u * 0.1), HAIR);
            }
            for (const sx of [-1, 1]) gb.geo(PR.cone6, M4(sx * 0.1, y - 0.04, -0.03, 0.032, 0.2, 0.03, -2.9, 0, -sx * 0.25), HAIR);
            for (let k = 0; k < 3; k++) gb.geo(PR.cone4, M4(-0.04 + k * 0.04, y + 0.085, 0.1, 0.022, 0.08, 0.016, 2.3, 0, (k - 1) * 0.3), HAIR);
            break;
          case 'helmet':
            // шлем: купол, гребень, нащёчники, козырёк над глазами
            gb.geo(PR.cap, M4(0, y + 0.012, -0.004, 0.118, 0.138, 0.128, -0.3), C2);
            box(gb, C2, 0, y + 0.13, -0.01, 0.022, 0.085, 0.21);
            box(gb, C2D, 0, y + 0.034, 0.112, 0.15, 0.016, 0.02, 0.2);
            for (const sx of [-1, 1]) {
              box(gb, C2, sx * 0.09, y - 0.03, 0.04, 0.02, 0.09, 0.09, 0, 0, -sx * 0.1);
              gb.geo(PR.cone4, M4(sx * 0.11, y + 0.07, -0.04, 0.02, 0.1, 0.035, -0.5, 0, -sx * 0.7), C2);
            }
            break;
          case 'bird':
            gb.geo(PR.cone4, M4(0, y - 0.02, 0.16, 0.035, 0.12, 0.03, Math.PI / 2), C2);
            box(gb, C2, 0, y + 0.15, -0.03, 0.02, 0.12, 0.18, -0.3);
            for (let k = 0; k < 3; k++) gb.geo(PR.cone4, M4(0, y + 0.09 - k * 0.03, -0.12 - k * 0.03, 0.03, 0.16, 0.02, -1.2 - k * 0.2), C2);
            break;
          case 'dog':
            ell(gb, C1, 0, y - 0.04, 0.13, 0.05, 0.045, 0.07);
            gb.geo(PR.cone4, M4(-0.07, y + 0.15, 0, 0.035, 0.12, 0.025), C1);
            gb.geo(PR.cone4, M4(0.07, y + 0.15, 0, 0.035, 0.12, 0.025), C1);
            break;
          case 'cat':
            gb.geo(PR.cone4, M4(-0.07, y + 0.14, 0, 0.04, 0.09, 0.03), C1);
            gb.geo(PR.cone4, M4(0.07, y + 0.14, 0, 0.04, 0.09, 0.03), C1);
            ell(gb, C2, 0, y - 0.03, 0.115, 0.018, 0.018, 0.012, 0, 0, 0, true);
            break;
          case 'horn':
            gb.geo(PR.cone, M4(0, y + 0.16, 0.05, 0.03, 0.14, 0.03, 0.3), C2);
            gb.geo(PR.cap, M4(0, y + 0.01, -0.01, 0.11, 0.13, 0.12, -0.35), C1D);
            break;
          case 'ladybug':
            gb.geo(PR.cap, M4(0, y + 0.01, -0.01, 0.112, 0.13, 0.122, -0.4), C1D);
            for (let k = 0; k < 3; k++) ell(gb, C2, -0.05 + k * 0.05, y + 0.11, 0.05, 0.022, 0.022, 0.015, 0, 0, 0, true);
            break;
          case 'twin':
            ell(gb, C2, 0.05, y + 0.01, 0, 0.065, 0.128, 0.117);
            break;
          case 'hat':
            tube(gb, C2, 0, y + 0.08, 0, 0.18, 0.18, 0.014, 1, 0, 0, 14);
            tube(gb, C2, 0, y + 0.17, 0, 0.1, 0.11, 0.09);
            break;
          case 'horse':
            ell(gb, C1, 0, y - 0.03, 0.12, 0.06, 0.06, 0.09);
            box(gb, C2, 0, y + 0.1, -0.06, 0.02, 0.16, 0.22);
            break;
          case 'dino':
            ell(gb, C1, 0, y - 0.04, 0.14, 0.07, 0.05, 0.1);
            break;
          case 'puzzle':
            box(gb, C2, 0.07, y + 0.11, 0, 0.06, 0.06, 0.06);
            break;
          case 'star':
            gb.geo(PR.oct, M4(0, y + 0.15, 0.05, 0.05, 0.05, 0.02), C2);
            break;
          case 'egg':
            // гладкий шлем-яйцо: полоса по центру и самоцвет во лбу
            box(gb, C2D, 0, y + 0.1, 0.0, 0.016, 0.04, 0.26, -0.2);
            gb.geo(PR.oct, M4(0, y + 0.06, 0.115, 0.014, 0.02, 0.01), GEM);
            break;
          case 'skull':
          case 'mask':
            ell(gb, C2, 0, y - 0.005, 0.085, 0.08, 0.085, 0.04);
            for (const sx of [-1, 1]) ell(gb, DK, sx * 0.036, y + 0.008, 0.112, 0.026, 0.016, 0.006, 0, 0, -sx * 0.18, true);
            ell(gb, GLOW, -0.036, y + 0.008, 0.116, 0.016, 0.008, 0.005, 0, 0, 0.18, true);
            ell(gb, GLOW, 0.036, y + 0.008, 0.116, 0.016, 0.008, 0.005, 0, 0, -0.18, true);
            box(gb, C2D, 0, y - 0.05, 0.12, 0.006, 0.05, 0.006);
            break;
          case 'cloud':
            for (let k = 0; k < 7; k++) ell(gb, C1, Math.cos(k * 0.9) * 0.1, y + Math.sin(k * 1.7) * 0.06, Math.sin(k * 0.9) * 0.06, 0.09, 0.08, 0.09, 0, 0, 0, true);
            break;
          default:
            // без шлема: гладкий «капюшон» и линии по черепу
            gb.geo(PR.cap, M4(0, y + 0.008, -0.012, 0.109, 0.13, 0.12, -0.45), C1D);
            box(gb, C2, 0, y + 0.1, 0.06, 0.012, 0.012, 0.11, -0.6);
        }
        deco.head(gb, y);
      },
      thigh(gb, b) {
        const l = b.leg;
        loft(gb, [
          [0.07, l * 0.9, l * 0.88, l * 0.92, -0.004, C1],
          [0.0, l * 1.04, l * 1.02, l * 1.02, 0, C1],
          [-0.13, l * 1.0, l * 1.08, l * 0.94, 0.008, C1],
          [-0.28, l * 0.86, l * 0.92, l * 0.82, 0.006, C1],
          [-0.4, l * 0.72, l * 0.76, l * 0.7, 0.004, C1],
          [-0.46, l * 0.7, l * 0.74, l * 0.68, 0.006, C1],
        ], 12, 2, true, true);
        if (armored) box(gb, C2D, 0, -0.08, b.leg * 0.85, b.leg * 1.1, 0.16, 0.014, -0.06);
      },
      shin(gb, b) {
        const l = b.leg;
        ell(gb, C2, 0, 0, 0.03, l * 0.75, 0.06, l * 0.6);
        // голень с икрой, поножи-сапог
        loft(gb, [
          [0.03, l * 0.7, l * 0.74, l * 0.7, 0.004, C1],
          [-0.06, l * 0.72, l * 0.7, l * 0.84, -0.004, C1],
          [-0.14, l * 0.7, l * 0.64, l * 0.88, -0.008, C1],
          [-0.21, l * 0.58, l * 0.58, l * 0.66, -0.004, C1],
          [-0.211, l * 0.6, l * 0.62, l * 0.66, -0.002, C2],
          [-0.3, l * 0.5, l * 0.52, l * 0.52, 0, C2],
          [-0.38, l * 0.52, l * 0.54, l * 0.54, 0, C2],
        ], 12, 2, true, true);
        ell(gb, C2, 0, -0.4, 0.02, 0.05, 0.05, 0.07);
        gb.geo(PR.cone4, M4(0, -0.43, 0.08, 0.05, 0.18, 0.04, Math.PI / 2 + 0.25), C2);
        if (armored) gb.geo(PR.cone4, M4(0, -0.12, b.leg * 0.66, 0.04, 0.2, 0.02, 0.1, Math.PI / 4), C2D);
        deco.shin(gb, b);
      },
      upper(gb, b, sx) {
        const a = b.arm;
        // дельта и бицепс
        loft(gb, [
          [0.045, a * 0.85, a * 0.9, a * 0.95, 0, C1],
          [-0.01, a * 1.3, a * 1.22, a * 1.22, 0, C1],
          [-0.08, a * 1.12, a * 1.12, a * 1.05, 0.004, C1],
          [-0.15, a * 1.0, a * 1.12, a * 0.98, 0.008, C1],
          [-0.23, a * 0.86, a * 0.9, a * 0.86, 0.004, C1],
          [-0.3, a * 0.8, a * 0.8, a * 0.8, 0, C1],
        ], 12, 2, true, true);
        if (head === 'vines') for (let k = 0; k < 3; k++) gb.geo(PR.torus, M4(0, -0.06 - k * 0.08, 0, b.arm * 1.1, b.arm * 1.1, b.arm * 1.1, Math.PI / 2), C2);
        deco.upper(gb, b, sx);
      },
      fore(gb, b, sx) {
        const a = b.arm;
        loft(gb, [
          [0.03, a * 0.82, a * 0.82, a * 0.82, 0, C1],
          [-0.05, a * 0.94, a * 0.96, a * 0.9, 0.004, C1],
          [-0.13, a * 0.78, a * 0.78, a * 0.74, 0.002, C1],
          [-0.131, a * 0.84, a * 0.84, a * 0.82, 0, C2],
          [-0.24, a * 0.74, a * 0.72, a * 0.7, 0, C2],
        ], 12, 2, true, true);
        fist(gb, b, sx);
        if (head === 'vines') for (let k = 0; k < 3; k++) gb.geo(PR.torus, M4(0, -0.04 - k * 0.07, 0, b.arm * 0.95, b.arm * 0.95, b.arm * 0.95, Math.PI / 2), C2);
        deco.fore(gb, b, sx);
      },
      extra(gb) {
        if (sd.extra === 'sword' || sd.extra === 'arrow') {
          // рапира: клинок с долом, гарда-чашка
          box(gb, col('#e8eefc'), 0, -0.3, 0.5, 0.012, 0.03, 0.9);
          box(gb, col('#a8b0c8'), 0, -0.3, 0.5, 0.014, 0.008, 0.86);
          gb.geo(PR.cone4, M4(0, -0.3, 0.97, 0.016, 0.06, 0.008, Math.PI / 2, 0, 0), col('#e8eefc'));
          ell(gb, C2, 0, -0.3, 0.06, 0.06, 0.06, 0.02);
          box(gb, C2D, 0, -0.3, 0.0, 0.025, 0.025, 0.1);
        } else if (sd.extra === 'scythe') {
          tube(gb, C2D, 0, 0.4, 0.05, 0.015, 0.015, 1.3);
          box(gb, col('#e8eefc'), 0, 0.42, 0.3, 0.015, 0.08, 0.5);
        } else if (sd.extra === 'rod') {
          box(gb, C2, 0, -0.3, 0.7, 0.015, 0.015, 1.4);
        }
      },
    });
    // ореол-оболочка (на низком качестве — без неё)
    if (R3.quality > 0) {
      const sm = new THREE.ShaderMaterial({
        uniforms: { uC: { value: C1.clone().lerp(C2, 0.3) }, uA: { value: 0.5 }, uW: { value: 0.016 } },
        vertexShader: SHELL_VS, fragmentShader: SHELL_FS, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.BackSide, skinning: true,
      });
      const sh = new THREE.SkinnedMesh(v.skin.geometry, sm);
      sh.renderOrder = 1;
      sh.userData.noCast = true;
      v.group.add(sh);
      sh.bind(v.skel, IDENT);
      v.shell = sh;
      v.mats.push(sm);
    }
    v.mats.push(xmat);
    v.kind = 'human';
    return v;
  };
})();
