'use strict';
// 3D-рендер на Three.js: чанки местности, здания, растительность, персонажи, стенды, эффекты.
(function () {
  const CH = 32; // размер чанка в клетках
  const V3 = () => new THREE.Vector3();
  const tmpM = new THREE.Matrix4();
  const tmpQ = new THREE.Quaternion();
  const tmpS = new THREE.Vector3();
  const tmpP = new THREE.Vector3();
  const tmpC = new THREE.Color();
  const UP = new THREE.Vector3(0, 1, 0);

  // ---------- Линейный цвет ----------
  // Рендер идёт в линейном пространстве с выводом в sRGB и тональной кривой ACES. Все цвета игры заданы
  // привычными sRGB-строками ('#aabbcc'), поэтому при разборе строки/числа переводим их в линейные.
  // Явные setRGB(...) — уже линейные множители (тонировка, вспышки).
  (function () {
    const CP = THREE.Color.prototype, oHex = CP.setHex, oStyle = CP.setStyle;
    let depth = 0;
    CP.setHex = function (h) {
      oHex.call(this, h);
      if (!depth) this.convertSRGBToLinear();
      return this;
    };
    CP.setStyle = function (st) {
      depth++;
      try {
        oStyle.call(this, st);
      } finally {
        depth--;
      }
      if (!depth) this.convertSRGBToLinear();
      return this;
    };
  })();

  // ---------- Сборщик геометрии с цветами вершин ----------
  // Растущие типизированные массивы (а не JS-массивы с push): меньше памяти и мусора, сборка чанков без пауз GC.
  // p/n/c — Float32Array по 3 числа на вершину, v — число вершин.
  const GEO_NM = new THREE.Matrix3();
  const growF = (a, n) => {
    const b = new Float32Array(n);
    b.set(a);
    return b;
  };
  // Ограничивающие объёмы за один проход по массиву (быстрее computeBoundingSphere на больших чанках)
  J.fastBounds = function (g, P, n) {
    let x0 = Infinity, y0 = Infinity, z0 = Infinity, x1 = -Infinity, y1 = -Infinity, z1 = -Infinity;
    for (let i = 0; i < n; i += 3) {
      const x = P[i], y = P[i + 1], z = P[i + 2];
      if (x < x0) x0 = x;
      if (x > x1) x1 = x;
      if (y < y0) y0 = y;
      if (y > y1) y1 = y;
      if (z < z0) z0 = z;
      if (z > z1) z1 = z;
    }
    if (!(x1 >= x0)) {
      g.computeBoundingSphere();
      return;
    }
    g.boundingBox = new THREE.Box3(new THREE.Vector3(x0, y0, z0), new THREE.Vector3(x1, y1, z1));
    g.boundingSphere = new THREE.Sphere(new THREE.Vector3((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2), Math.hypot(x1 - x0, y1 - y0, z1 - z0) / 2);
  };
  class GB {
    constructor(cap = 256) {
      this.cap = cap;
      this.p = new Float32Array(cap * 3);
      this.n = new Float32Array(cap * 3);
      this.c = new Float32Array(cap * 3);
      this.v = 0;
    }
    // место ещё под k вершин
    grow(k) {
      if (this.v + k <= this.cap) return;
      let cap = this.cap * 2;
      while (cap < this.v + k) cap *= 2;
      this.p = growF(this.p, cap * 3);
      this.n = growF(this.n, cap * 3);
      this.c = growF(this.c, cap * 3);
      this.cap = cap;
    }
    // одна вершина (после grow)
    vert(x, y, z, nx, ny, nz, r, g, b) {
      const o = this.v * 3, P = this.p, N = this.n, C = this.c;
      P[o] = x; P[o + 1] = y; P[o + 2] = z;
      N[o] = nx; N[o + 1] = ny; N[o + 2] = nz;
      C[o] = r; C[o + 1] = g; C[o + 2] = b;
      this.v++;
    }
    tri(a, b, c, col) {
      const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2];
      const vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
      let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
      const l = Math.hypot(nx, ny, nz) || 1;
      nx /= l; ny /= l; nz /= l;
      this.grow(3);
      this.vert(a[0], a[1], a[2], nx, ny, nz, col.r, col.g, col.b);
      this.vert(b[0], b[1], b[2], nx, ny, nz, col.r, col.g, col.b);
      this.vert(c[0], c[1], c[2], nx, ny, nz, col.r, col.g, col.b);
    }
    quad(a, b, c, d, col) {
      this.tri(a, b, c, col);
      this.tri(a, c, d, col);
    }
    box(x0, y0, z0, x1, y1, z1, col, noBottom = true) {
      const p000 = [x0, y0, z0], p100 = [x1, y0, z0], p010 = [x0, y1, z0], p110 = [x1, y1, z0];
      const p001 = [x0, y0, z1], p101 = [x1, y0, z1], p011 = [x0, y1, z1], p111 = [x1, y1, z1];
      this.quad(p011, p111, p110, p010, col);
      if (!noBottom) this.quad(p000, p100, p101, p001, col);
      this.quad(p001, p101, p111, p011, col);
      this.quad(p100, p000, p010, p110, col);
      this.quad(p101, p100, p110, p111, col);
      this.quad(p000, p001, p011, p010, col);
    }
    // добавить готовую геометрию с матрицей m (вычисления вручную — это горячий путь сборки персонажей)
    geo(g, m, col) {
      const gg = g.index ? g.toNonIndexed() : g;
      const P = gg.attributes.position.array, N = gg.attributes.normal.array;
      const e = m.elements;
      const nm = GEO_NM.getNormalMatrix(m).elements;
      const cr = col.r, cg = col.g, cb = col.b;
      this.grow(P.length / 3);
      for (let i = 0; i < P.length; i += 3) {
        const x = P[i], y = P[i + 1], z = P[i + 2];
        const w = 1 / (e[3] * x + e[7] * y + e[11] * z + e[15]);
        const a = N[i], b = N[i + 1], d = N[i + 2];
        const nx = nm[0] * a + nm[3] * b + nm[6] * d, ny = nm[1] * a + nm[4] * b + nm[7] * d, nz = nm[2] * a + nm[5] * b + nm[8] * d;
        const l = 1 / (Math.sqrt(nx * nx + ny * ny + nz * nz) || 1);
        this.vert((e[0] * x + e[4] * y + e[8] * z + e[12]) * w, (e[1] * x + e[5] * y + e[9] * z + e[13]) * w, (e[2] * x + e[6] * y + e[10] * z + e[14]) * w, nx * l, ny * l, nz * l, cr, cg, cb);
      }
    }
    build() {
      const g = new THREE.BufferGeometry(), n = this.v * 3;
      g.setAttribute('position', new THREE.BufferAttribute(this.p.slice(0, n), 3));
      g.setAttribute('normal', new THREE.BufferAttribute(this.n.slice(0, n), 3));
      g.setAttribute('color', new THREE.BufferAttribute(this.c.slice(0, n), 3));
      J.fastBounds(g, this.p, n);
      return g;
    }
    get empty() {
      return this.v === 0;
    }
  }
  J.GB = GB;
  const col = (hex) => new THREE.Color(hex);
  const M = (x, y, z, sx = 1, sy = 1, sz = 1, ry = 0, rx = 0, rz = 0) => {
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz));
    m.compose(new THREE.Vector3(x, y, z), q, new THREE.Vector3(sx, sy, sz));
    return m;
  };

  // ---------- Модели растительности (общие геометрии) ----------
  function makeDecoGeos() {
    const O = J.O;
    const G = {};
    const cyl = (rt, rb, h, s = 6) => new THREE.CylinderGeometry(rt, rb, h, s);
    const ico = (r) => new THREE.IcosahedronGeometry(r, 0);
    const cone = (r, h, s = 6) => new THREE.ConeGeometry(r, h, s);
    let b;
    b = new GB();
    b.geo(cyl(0.09, 0.13, 1.2), M(0, 0.6, 0), col('#6a4a2a'));
    b.geo(ico(0.75), M(0, 1.6, 0, 1, 0.9, 1), col('#4f9a3a'));
    b.geo(ico(0.5), M(0.3, 2.05, 0.1), col('#5aaa44'));
    G[O.TREE] = b.build();
    b = new GB();
    b.geo(cyl(0.08, 0.12, 0.8), M(0, 0.4, 0), col('#5a3a22'));
    b.geo(cone(0.75, 1.3), M(0, 1.3, 0), col('#2f6a3a'));
    b.geo(cone(0.58, 1.1), M(0, 1.9, 0), col('#357a42'));
    b.geo(cone(0.38, 0.9), M(0, 2.45, 0), col('#3d8a4a'));
    G[O.PINE] = b.build();
    b = new GB();
    for (let k = 0; k < 4; k++) b.geo(cyl(0.07, 0.09, 0.6), M(k * 0.06, 0.3 + k * 0.55, 0, 1, 1, 1, 0, 0, -0.08), col('#8a6a42'));
    for (let k = 0; k < 6; k++) {
      const a = (k / 6) * J.TAU;
      b.geo(new THREE.BoxGeometry(1.1, 0.05, 0.28), M(0.22 + Math.cos(a) * 0.5, 2.35, Math.sin(a) * 0.5, 1, 1, 1, -a, 0, -0.35), col('#4a9a3a'));
    }
    G[O.PALM] = b.build();
    b = new GB();
    b.geo(cyl(0.18, 0.2, 1.4, 8), M(0, 0.7, 0), col('#3f8a3a'));
    b.geo(cyl(0.11, 0.11, 0.5, 6), M(0.32, 0.85, 0, 1, 1, 1, 0, 0, Math.PI / 2), col('#3f8a3a'));
    b.geo(cyl(0.1, 0.1, 0.45, 6), M(0.48, 1.05, 0), col('#3f8a3a'));
    b.geo(cyl(0.1, 0.1, 0.4, 6), M(-0.3, 0.95, 0, 1, 1, 1, 0, 0, Math.PI / 2), col('#3f8a3a'));
    b.geo(cyl(0.09, 0.09, 0.35, 6), M(-0.45, 1.12, 0), col('#3f8a3a'));
    G[O.CACTUS] = b.build();
    b = new GB();
    b.geo(new THREE.DodecahedronGeometry(0.5, 0), M(0, 0.25, 0, 1.2, 0.8, 1), col('#8a8690'));
    G[O.BOULDER] = b.build();
    b = new GB();
    b.geo(ico(0.42), M(0, 0.28, 0, 1.2, 0.8, 1.2), col('#4a8a3a'));
    b.geo(ico(0.3), M(0.25, 0.32, 0.1), col('#5a9a44'));
    G[O.BUSH] = b.build();
    b = new GB();
    const fl = ['#ff5d73', '#ffd84a', '#ffffff', '#b06bff', '#ff9a3c'];
    for (let k = 0; k < 6; k++) {
      const x = Math.cos(k * 2.1) * 0.3, z = Math.sin(k * 2.1) * 0.3;
      b.geo(new THREE.BoxGeometry(0.03, 0.25, 0.03), M(x, 0.12, z), col('#3a7a2a'));
      b.geo(new THREE.OctahedronGeometry(0.08, 0), M(x, 0.27, z), col(fl[k % fl.length]));
    }
    G[O.FLOWERS] = b.build();
    b = new GB();
    for (let k = 0; k < 7; k++) {
      const x = Math.cos(k * 2.4) * 0.3, z = Math.sin(k * 2.4) * 0.3;
      b.geo(cone(0.06, 0.6, 4), M(x, 0.3, z, 1, 1, 1, 0, Math.cos(k) * 0.2, Math.sin(k) * 0.2), col('#8aa84a'));
    }
    G[O.TALLGRASS] = b.build();
    b = new GB();
    b.geo(cyl(0.3, 0.34, 3, 10), M(0, 1.5, 0), col('#d9ccb0'));
    b.geo(new THREE.BoxGeometry(0.85, 0.25, 0.85), M(0, 3.1, 0), col('#c9bca0'));
    b.geo(new THREE.BoxGeometry(0.85, 0.2, 0.85), M(0, 0.1, 0), col('#c9bca0'));
    G[O.PILLAR] = b.build();
    b = new GB();
    b.geo(cyl(0.14, 0.2, 1.8), M(0, 0.9, 0), col('#5a4a2a'));
    b.geo(ico(1.0), M(0, 2.2, 0, 1.1, 0.8, 1.1), col('#2f7a2a'));
    b.geo(ico(0.7), M(-0.4, 2.7, 0.2), col('#3a8a32'));
    b.geo(ico(0.6), M(0.5, 2.6, -0.3), col('#2a6a28'));
    G[O.JUNGLE] = b.build();
    b = new GB();
    b.geo(cyl(0.05, 0.07, 2.6), M(0, 1.3, 0), col('#2a2a33'));
    b.geo(new THREE.BoxGeometry(0.5, 0.06, 0.08), M(0.2, 2.6, 0), col('#2a2a33'));
    G[O.LAMP] = b.build();
    b = new GB();
    b.geo(cyl(0.1, 0.14, 0.9), M(0, 0.45, 0, 1, 1, 1, 0, 0, 0.15), col('#7a6a52'));
    b.geo(ico(0.6), M(0.12, 1.25, 0, 1.2, 0.75, 1.2), col('#8a9a5a'));
    G[O.OLIVE] = b.build();
    b = new GB();
    b.geo(cyl(0.07, 0.12, 1.5), M(0, 0.75, 0), col('#6a5a4a'));
    b.geo(cyl(0.04, 0.06, 0.7), M(0.25, 1.2, 0, 1, 1, 1, 0, 0, -0.8), col('#6a5a4a'));
    b.geo(cyl(0.04, 0.06, 0.6), M(-0.2, 1.35, 0.1, 1, 1, 1, 0, 0, 0.9), col('#6a5a4a'));
    G[O.DEADTREE] = b.build();
    b = new GB();
    b.geo(cyl(1.0, 1.1, 0.5, 12), M(0, 0.25, 0), col('#c9c4b8'));
    b.geo(cyl(0.85, 0.85, 0.1, 12), M(0, 0.45, 0), col('#5ab3ff'));
    b.geo(cyl(0.12, 0.16, 1.2, 8), M(0, 0.9, 0), col('#c9c4b8'));
    b.geo(cyl(0.4, 0.3, 0.12, 10), M(0, 1.4, 0), col('#c9c4b8'));
    G[O.FOUNTAIN] = b.build();
    b = new GB();
    b.geo(cyl(0.08, 0.13, 1.6), M(0, 0.8, 0, 1, 1, 1, 0, 0, 0.1), col('#6a4a2a'));
    b.geo(cyl(1.0, 0.7, 0.35, 8), M(0.15, 1.8, 0), col('#6a8a3a'));
    G[O.ACACIA] = b.build();
    // Лампа (светящаяся часть)
    G.bulb = new THREE.BoxGeometry(0.22, 0.14, 0.22);
    return G;
  }

  // ---------- Основной рендер ----------
  const R3 = (J.R3 = {
    chunks: new Map(),
    queue: [],
    quality: 1,
    shadows: true,
    labelPool: [],
    textFx: [],
  });

  // Пресеты качества: 0 — низкое (телефоны, слабые ПК), 1 — среднее, 2 — высокое
  const PRESET = (R3.PRESETS = [
    { name: 'Низкое', prCap: 1.0, aa: false, shadows: false, map: 512, soft: false, ext: 20, viewR: 1, fog: 62, charCast: 0, chunkMs: 2, aniso: 1, clouds: false, detail: false, waterN: false, pools: false, texSize: 128 },
    { name: 'Среднее', prCap: 1.25, aa: 'auto', shadows: true, map: 1024, soft: false, ext: 24, viewR: 2, fog: 92, charCast: 4, chunkMs: 3, aniso: 4, clouds: true, detail: true, waterN: true, pools: true, texSize: 256 },
    { name: 'Высокое', prCap: 1.75, aa: true, shadows: true, map: 2048, soft: true, ext: 30, viewR: 2, fog: 100, charCast: 12, chunkMs: 3, aniso: 8, clouds: true, detail: true, waterN: true, pools: true, texSize: 256 },
  ]);
  R3.preset = PRESET[1];
  // Автовыбор по устройству: телефон или слабый ПК — низкое, иначе среднее
  R3.autoQuality = function () {
    const touch = 'ontouchstart' in window || (window.matchMedia && matchMedia('(pointer: coarse)').matches);
    const cores = navigator.hardwareConcurrency || 4, mem = navigator.deviceMemory || 8;
    if (touch || cores <= 2 || mem <= 2) return 0;
    return 1;
  };

  R3.init = function (canvas) {
    const P = (R3.preset = PRESET[R3.quality] || PRESET[1]);
    // сглаживание задаётся только при создании контекста (смена — после перезапуска)
    const aa = P.aa === true || (P.aa === 'auto' && (window.devicePixelRatio || 1) < 1.5);
    R3.aa = aa;
    const r = new THREE.WebGLRenderer({ canvas, antialias: aa, powerPreference: 'high-performance' });
    r.setPixelRatio(Math.min(window.devicePixelRatio || 1, P.prCap));
    r.outputEncoding = THREE.sRGBEncoding;
    r.toneMapping = THREE.ACESFilmicToneMapping;
    r.toneMappingExposure = 1.0;
    r.shadowMap.enabled = R3.shadows;
    r.shadowMap.type = P.soft ? THREE.PCFSoftShadowMap : THREE.PCFShadowMap;
    R3.renderer = r;
    const scene = (R3.scene = new THREE.Scene());
    scene.background = new THREE.Color('#8fc8ff');
    scene.fog = new THREE.Fog('#8fc8ff', 40, 95);
    const cam = (R3.camera = new THREE.PerspectiveCamera(58, 1, 0.1, 420));
    cam.position.set(0, 10, 10);

    R3.hemi = new THREE.HemisphereLight('#cfe8ff', '#5a6a3a', 0.65);
    scene.add(R3.hemi);
    const sun = (R3.sun = new THREE.DirectionalLight('#fff2d8', 0.9));
    sun.castShadow = R3.shadows;
    sun.shadow.mapSize.set(P.map, P.map);
    const sc = sun.shadow.camera;
    sc.left = -P.ext; sc.right = P.ext; sc.top = P.ext; sc.bottom = -P.ext; sc.near = 1; sc.far = 160;
    sun.shadow.bias = -0.0006;
    sun.shadow.normalBias = 0.02;
    scene.add(sun);
    scene.add(sun.target);
    R3.lantern = new THREE.PointLight('#ffd9a0', 0, 14, 1.6);
    scene.add(R3.lantern);

    R3.terrainMat = new THREE.MeshLambertMaterial({ vertexColors: true });
    R3.decoMat = new THREE.MeshLambertMaterial({ vertexColors: true });
    R3.buildMat = new THREE.MeshLambertMaterial({ vertexColors: true });
    R3.lightMat = new THREE.MeshBasicMaterial({ vertexColors: true, color: '#5a6a80' });
    R3.bulbMat = new THREE.MeshBasicMaterial({ color: '#8a8a7a' });
    R3.decoGeos = makeDecoGeos();
    R3.cityInit();

    // вода
    const wg = new THREE.PlaneGeometry(420, 420, 1, 1);
    wg.rotateX(-Math.PI / 2);
    R3.waterMat = new THREE.MeshPhongMaterial({ color: '#2f86d0', transparent: true, opacity: 0.8, shininess: 90, specular: '#bfe3ff' });
    R3.water = new THREE.Mesh(wg, R3.waterMat);
    R3.water.position.y = -0.14;
    R3.water.receiveShadow = true;
    scene.add(R3.water);

    // звёзды
    const sg = new THREE.BufferGeometry();
    const sp = [];
    for (let i = 0; i < 700; i++) {
      const a = Math.random() * J.TAU, e = Math.random() * 1.2 + 0.15;
      sp.push(Math.cos(a) * Math.cos(e) * 300, Math.sin(e) * 300, Math.sin(a) * Math.cos(e) * 300);
    }
    sg.setAttribute('position', new THREE.Float32BufferAttribute(sp, 3));
    R3.starMat = new THREE.PointsMaterial({ color: '#ffffff', size: 1.4, sizeAttenuation: false, fog: false, transparent: true, opacity: 0, depthWrite: false });
    R3.stars = new THREE.Points(sg, R3.starMat);
    R3.stars.frustumCulled = false;
    R3.stars.renderOrder = -9;
    scene.add(R3.stars);
    // Луна
    R3.moon = new THREE.Mesh(new THREE.SphereGeometry(9, 16, 12), new THREE.MeshBasicMaterial({ color: '#f4f0e0', fog: false, toneMapped: false, depthWrite: false }));
    R3.moon.renderOrder = -8;
    scene.add(R3.moon);
    R3.lookInit(); // небо, облака, детали земли, вода, свет фонарей (render_sky.js)

    R3.initParticles();
    R3.initWeather();
    R3.fxGroup = new THREE.Group();
    scene.add(R3.fxGroup);
    R3.labelLayer = document.getElementById('labels');
    window.addEventListener('resize', R3.resize);
    R3.resize();
  };

  R3.setQuality = function (q, shadows) {
    R3.quality = q;
    R3.shadows = shadows;
    const P = (R3.preset = PRESET[q] || PRESET[1]);
    R3.viewR = P.viewR;
    R3.chunkMs = P.chunkMs;
    R3.charCast = P.charCast;
    if (!R3.renderer) return;
    const r = R3.renderer, sun = R3.sun;
    const on = shadows && P.shadows;
    const type = P.soft ? THREE.PCFSoftShadowMap : THREE.PCFShadowMap;
    // смена размера/типа карты теней: старую карту освобождаем, три.js создаст новую
    if (sun.shadow.mapSize.x !== P.map || r.shadowMap.type !== type) {
      if (sun.shadow.map) sun.shadow.map.dispose();
      sun.shadow.map = null;
      sun.shadow.mapSize.set(P.map, P.map);
    }
    r.shadowMap.enabled = on;
    r.shadowMap.type = type;
    sun.castShadow = on;
    const sc = sun.shadow.camera;
    sc.left = -P.ext; sc.right = P.ext; sc.top = P.ext; sc.bottom = -P.ext;
    sc.updateProjectionMatrix();
    R3.lookQuality(P);
    R3.scene.traverse((o) => {
      if (o.material) o.material.needsUpdate = true;
    });
    R3.dyn.s = 1;
    R3.applyPixelRatio();
    R3.scene.fog.far = P.fog;
  };
  R3.applyPixelRatio = function () {
    R3.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, R3.preset.prCap) * R3.dyn.s);
    R3.resize();
  };
  // Динамическое разрешение: если кадр долго держится тяжёлым — снижаем внутреннее разрешение (до 60 %)
  R3.dyn = { s: 1, ema: 16.7, acc: 0, enabled: true };
  R3.updateDynRes = function (ms) {
    const d = R3.dyn;
    if (!d.enabled || !(ms > 0) || ms > 250) return;
    d.ema += (ms - d.ema) * 0.05;
    d.acc += ms;
    if (d.acc < 1000) return;
    d.acc = 0;
    let s = d.s;
    if (d.ema > 21) s = Math.max(0.6, s - 0.1);
    else if (d.ema < 14) s = Math.min(1, s + 0.05);
    if (Math.abs(s - d.s) > 0.001) {
      d.s = s;
      R3.applyPixelRatio();
    }
  };

  R3.resize = function () {
    const w = window.innerWidth, h = window.innerHeight;
    R3.renderer.setSize(w, h, false);
    R3.camera.aspect = w / h;
    R3.camera.updateProjectionMatrix();
    R3.W = w;
    R3.H = h;
  };

  // ---------- Чанки ----------
  R3.viewR = 2;
  R3.queued = new Set();
  R3.updateChunks = function (px, py, force) {
    const w = J.G.world;
    const ccx = Math.floor(px / CH), ccy = Math.floor(py / CH);
    const need = new Set();
    const VR = R3.viewR;
    for (let dy = -VR; dy <= VR; dy++)
      for (let dx = -VR; dx <= VR; dx++) {
        const cx = ccx + dx, cy = ccy + dy;
        if (cx < 0 || cy < 0 || cx * CH >= w.W || cy * CH >= w.H) continue;
        // отбрасываем углы
        if (Math.abs(dx) === VR && Math.abs(dy) === VR && VR > 1) continue;
        const k = cx + ',' + cy;
        need.add(k);
        if (!R3.chunks.has(k) && !R3.queued.has(k) && !(R3.pending && R3.pending.k === k)) {
          R3.queue.push({ k, cx, cy });
          R3.queued.add(k);
        }
      }
    for (const [k, c] of R3.chunks) {
      if (!need.has(k)) {
        const [cx, cy] = k.split(',').map(Number);
        if (Math.abs(cx - ccx) > VR + 1 || Math.abs(cy - ccy) > VR + 1) R3.dropChunk(k, c);
      }
    }
    if (R3.queue.length) {
      R3.queue = R3.queue.filter((q) => need.has(q.k) || (R3.queued.delete(q.k), false));
      // сначала ближние и те, что впереди по взгляду камеры
      const fx = Math.cos(R3.cam.yaw), fz = Math.sin(R3.cam.yaw); // камера смотрит вдоль (cos yaw, sin yaw)
      const pri = (q) => {
        const dx = q.cx + 0.5 - px / CH, dy = q.cy + 0.5 - py / CH, d = Math.hypot(dx, dy) || 1;
        return d - 0.8 * Math.max(0, (dx * fx + dy * fz) / d);
      };
      R3.queue.sort((a, b) => pri(a) - pri(b));
    }
    if (R3.pending && !need.has(R3.pending.k)) R3.dropPending();
    // строим по частям в пределах бюджета времени на кадр
    const budget = force ? 1e9 : R3.chunkMs || 3;
    const t0 = performance.now();
    while (R3.pending || R3.queue.length) {
      if (!R3.pending) {
        const q = R3.queue.shift();
        R3.queued.delete(q.k);
        const group = new THREE.Group();
        R3.pending = { k: q.k, group, gen: R3.buildChunkGen(q.cx, q.cy, group) };
      }
      const r = R3.pending.gen.next();
      if (r.done) {
        R3.chunks.set(R3.pending.k, r.value);
        R3.pending = null;
      }
      if (performance.now() - t0 > budget) break;
    }
  };

  R3.dropChunk = function (k, c) {
    R3.scene.remove(c.group);
    c.group.traverse((o) => {
      if (o.geometry && !o.userData.shared) o.geometry.dispose();
      if (o.isInstancedMesh && o.dispose) o.dispose();
    });
    R3.chunks.delete(k);
  };

  R3.clearAll = function () {
    for (const [k, c] of R3.chunks) R3.dropChunk(k, c);
    R3.queue = [];
    R3.queued.clear();
    R3.dropPending();
  };
  // недостроенный чанк больше не нужен: останавливаем генератор и освобождаем уже созданные геометрии
  R3.dropPending = function () {
    const pd = R3.pending;
    if (!pd) return;
    pd.gen.return();
    pd.group.traverse((o) => {
      if (o.geometry && !o.userData.shared) o.geometry.dispose();
    });
    R3.pending = null;
  };

  const UNDER = { [0]: '#245a80', [1]: '#4f8aa0' };
  // Генератор: строит чанк по частям, отдавая управление между этапами (без фризов)
  const TCC = {};
  const tcol = (hex) => TCC[hex] || (TCC[hex] = new THREE.Color(hex)); // разобранные цвета клеток (без разбора строки на каждую клетку)
  R3.buildChunkGen = function* (cx, cy, group) {
    const w = J.G.world;
    const T = J.T, O = J.O;
    const x0 = cx * CH, y0 = cy * CH;
    group = group || new THREE.Group();
    // высоты вершин
    const hv = new Float32Array((CH + 1) * (CH + 1));
    for (let vy = 0; vy <= CH; vy++) for (let vx = 0; vx <= CH; vx++) hv[vy * (CH + 1) + vx] = w.vertH(x0 + vx, y0 + vy);
    const gb = new GB(6400);
    const c = new THREE.Color();
    const URB = J.URBAN, CB = J.CURB_H;
    for (let ty = 0; ty < CH; ty++)
      for (let tx = 0; tx < CH; tx++) {
        const X = x0 + tx, Y = y0 + ty;
        if (!w.inb(X, Y)) continue;
        const i = Y * w.W + X, t = w.t[i];
        // городская земля (асфальт, плитка, бордюры) строится в render_city.js; обочины шоссе — здесь
        if (t === T.ROAD && !(w.rid[i] && !(w.rid[i] & 0x8000) && w.net.edges[w.rid[i] - 1].cls === 'hw')) continue;
        if (URB[t] && t !== T.LAWN) continue;
        if (t === T.LAWN) {
          c.copy(tcol(J.TCOL[t])).multiplyScalar(1 + (J.hash2(X, Y, 7) - 0.5) * 0.1);
          gb.tri([X, CB, Y + 1], [X + 1, CB, Y + 1], [X + 1, CB, Y], c);
          gb.tri([X, CB, Y + 1], [X + 1, CB, Y], [X, CB, Y], c);
          continue;
        }
        let hex = UNDER[t] || (t === T.ROAD ? '#77716a' : J.TCOL[t]);
        if (t === T.BRIDGE || t === T.DOCKWOOD) hex = UNDER[1];
        c.copy(tcol(hex));
        const v = (J.hash2(X, Y, 7) - 0.5) * 0.1;
        if (t === T.ROCK || t === T.MESA) {
          const k = 0.85 + w.rock[Y * w.W + X] * 0.3 + v;
          c.multiplyScalar(k);
        } else c.multiplyScalar(1 + v * 1.6);
        const h00 = hv[ty * (CH + 1) + tx], h10 = hv[ty * (CH + 1) + tx + 1];
        const h01 = hv[(ty + 1) * (CH + 1) + tx], h11 = hv[(ty + 1) * (CH + 1) + tx + 1];
        const a = [X, h01, Y + 1], b = [X + 1, h11, Y + 1], cc = [X + 1, h10, Y], d = [X, h00, Y];
        gb.tri(a, b, cc, c);
        gb.tri(a, cc, d, c);
        if (tx === CH - 1 && (ty & 7) === 7) yield;
      }
    const tm = new THREE.Mesh(gb.build(), R3.terrainMat);
    tm.receiveShadow = true;
    group.add(tm);
    yield;

    // Растительность — инстансы
    const lists = {};
    for (let ty = 0; ty < CH; ty++)
      for (let tx = 0; tx < CH; tx++) {
        const X = x0 + tx, Y = y0 + ty;
        if (!w.inb(X, Y)) continue;
        const o = w.o[Y * w.W + X];
        // уличная мебель (фонари, светофоры, деревья у тротуара…) — одной геометрией в render_city.js
        if (!o || R3.props[o] || !R3.decoGeos[o]) continue;
        (lists[o] || (lists[o] = [])).push(X, Y);
      }
    const bulbs = [];
    for (const k in lists) {
      const o = +k;
      const arr = lists[k];
      const n = arr.length / 2;
      const im = new THREE.InstancedMesh(R3.decoGeos[o], R3.decoMat, n);
      im.userData.shared = true; // геометрия общая
      for (let i = 0; i < n; i++) {
        const X = arr[i * 2], Y = arr[i * 2 + 1];
        const hsh = J.hash2(X, Y, 1234);
        const sc = o === O.LAMP || o === O.PILLAR ? 1 : 0.8 + hsh * 0.5;
        const jx = o === O.LAMP ? 0.15 : (J.hash2(X, Y, 3) - 0.5) * 0.4, jz = o === O.LAMP ? 0.15 : (J.hash2(X, Y, 4) - 0.5) * 0.4;
        const gy = w.vertH(X, Y) * 0.25 + w.vertH(X + 1, Y + 1) * 0.25 + w.vertH(X + 1, Y) * 0.25 + w.vertH(X, Y + 1) * 0.25;
        tmpQ.setFromAxisAngle(UP, o === O.LAMP ? 0 : hsh * J.TAU);
        tmpS.set(sc, sc, sc);
        tmpP.set(X + 0.5 + jx, gy, Y + 0.5 + jz);
        tmpM.compose(tmpP, tmpQ, tmpS);
        im.setMatrixAt(i, tmpM);
        const tint = 0.85 + J.hash2(X, Y, 55) * 0.3;
        tmpC.setRGB(tint, tint, tint);
        im.setColorAt(i, tmpC);
        if (o === O.LAMP) bulbs.push(X + 0.85, gy + 2.52, Y + 0.65);
      }
      im.instanceMatrix.needsUpdate = true;
      if (im.instanceColor) im.instanceColor.needsUpdate = true;
      im.castShadow = o !== O.FLOWERS && o !== O.TALLGRASS;
      im.receiveShadow = true;
      group.add(im);
      yield;
    }
    if (bulbs.length) {
      const n = bulbs.length / 3;
      const im = new THREE.InstancedMesh(R3.decoGeos.bulb, R3.bulbMat, n);
      im.userData.shared = true;
      for (let i = 0; i < n; i++) {
        tmpM.makeTranslation(bulbs[i * 3], bulbs[i * 3 + 1], bulbs[i * 3 + 2]);
        im.setMatrixAt(i, tmpM);
      }
      group.add(im);
    }

    // Город: земля, бордюры, разметка, шоссе, мебель, стены, мосты и все здания
    yield* R3.cityChunkGen(w, cx, cy, group);
    R3.scene.add(group);
    return { group };
  };
  R3.buildChunk = function (cx, cy) {
    const g = R3.buildChunkGen(cx, cy);
    let r;
    do r = g.next();
    while (!r.done);
    return r.value;
  };

  R3.buildBuilding = function (gb, lb, b) {
    const wall = col(b.wall), roof = col(b.roof);
    const wallD = wall.clone().multiplyScalar(0.8);
    const x0 = b.x + 0.06, x1 = b.x + b.w - 0.06, z0 = b.y + 0.06, z1 = b.y + b.h - 0.06;
    const H = b.height;
    gb.box(x0, 0, z0, x1, H, z1, wall);
    // карниз
    gb.box(x0 - 0.05, H - 0.25, z0 - 0.05, x1 + 0.05, H, z1 + 0.05, wallD);
    if (b.flat) {
      gb.box(x0 - 0.1, H, z0 - 0.1, x1 + 0.1, H + 0.22, z1 + 0.1, roof);
      gb.box(x0 - 0.1, H + 0.22, z0 - 0.1, x1 + 0.1, H + 0.55, z0 + 0.05, roof);
      gb.box(x0 - 0.1, H + 0.22, z1 - 0.05, x1 + 0.1, H + 0.55, z1 + 0.1, roof);
      if (b.w >= 5 && b.type !== 'colosseum') gb.box(x0 + 0.8, H + 0.22, z0 + 0.8, x0 + 2, H + 1, z0 + 1.8, col('#9a9aa4'));
    } else {
      const rh = Math.min(2.2, (z1 - z0) * 0.38);
      const ox0 = x0 - 0.25, ox1 = x1 + 0.25, oz0 = z0 - 0.3, oz1 = z1 + 0.3, zm = (z0 + z1) / 2, Hr = H - 0.05;
      const roofD = roof.clone().multiplyScalar(0.82);
      gb.quad([ox0, Hr, oz1], [ox1, Hr, oz1], [ox1, Hr + rh, zm], [ox0, Hr + rh, zm], roof);
      gb.quad([ox1, Hr, oz0], [ox0, Hr, oz0], [ox0, Hr + rh, zm], [ox1, Hr + rh, zm], roofD);
      gb.tri([x0, Hr, z0], [x0, Hr, z1], [x0, Hr + rh * 0.95, zm], wallD);
      gb.tri([x1, Hr, z1], [x1, Hr, z0], [x1, Hr + rh * 0.95, zm], wallD);
    }
    // дверь и вывеска
    const dx = b.door.x + 0.5;
    const doorC = b.type === 'house' ? col('#5a3a2a') : col('#3a2a22');
    gb.box(dx - 0.45, 0, z1 - 0.02, dx + 0.45, 1.65, z1 + 0.08, doorC);
    gb.box(dx - 0.55, 1.65, z1 - 0.02, dx + 0.55, 1.75, z1 + 0.1, wallD);
    if (b.sign) {
      gb.box(dx - 0.95, 1.95, z1, dx + 0.95, 2.45, z1 + 0.16, col(b.sign));
      // навес
      gb.quad([dx - 1.1, 1.85, z1 + 0.7], [dx + 1.1, 1.85, z1 + 0.7], [dx + 1.1, 2.0, z1], [dx - 1.1, 2.0, z1], col(b.sign).multiplyScalar(0.75));
    }
    // окна
    const winC = new THREE.Color('#ffe6a0');
    const winF = wallD;
    const floors = Math.max(1, Math.floor((H - 0.6) / 2.6));
    for (let f = 0; f < floors; f++) {
      const y = 0.75 + f * 2.6;
      if (y + 1 > H - 0.3) break;
      for (let x = x0 + 0.75; x <= x1 - 0.6; x += 1.4) {
        if (f === 0 && Math.abs(x - dx) < 1.3) continue;
        lb.box(x - 0.28, y, z1 - 0.01, x + 0.28, y + 0.85, z1 + 0.04, winC);
        gb.box(x - 0.34, y - 0.08, z1 - 0.01, x + 0.34, y, z1 + 0.07, winF);
        lb.box(x - 0.28, y, z0 - 0.04, x + 0.28, y + 0.85, z0 + 0.01, winC);
      }
      for (let z = z0 + 0.8; z <= z1 - 0.6; z += 1.5) {
        lb.box(x0 - 0.04, y, z - 0.28, x0 + 0.01, y + 0.85, z + 0.28, winC);
        lb.box(x1 - 0.01, y, z - 0.28, x1 + 0.04, y + 0.85, z + 0.28, winC);
      }
    }
    // особые элементы
    const t = b.type;
    if (t === 'church' || t === 'cape') {
      const cx = (x0 + x1) / 2, cz = z0 + 1;
      gb.box(cx - 0.7, H, cz - 0.7, cx + 0.7, H + 3.2, cz + 0.7, wall);
      gb.geo(new THREE.ConeGeometry(1.1, 2.2, 4), M(cx, H + 4.3, cz, 1, 1, 1, Math.PI / 4), t === 'cape' ? col('#d8442b') : roof);
      if (t === 'cape') gb.geo(new THREE.CylinderGeometry(0.5, 0.6, 7, 10), M(x1 + 1.2, 3.5, z1 - 1), col('#f4f4f4'));
    }
    if (t === 'dio_mansion' || t === 'joestar_mansion' || t === 'lisa_castle') {
      for (const [tx, tz] of [[x0, z0], [x1, z0], [x0, z1], [x1, z1]]) {
        gb.geo(new THREE.CylinderGeometry(0.7, 0.8, H + 2, 8), M(tx, (H + 2) / 2, tz), wallD);
        gb.geo(new THREE.ConeGeometry(1.0, 2, 8), M(tx, H + 3, tz), roof);
      }
    }
    if (t === 'hamon_temple') {
      gb.box(x0 - 0.4, H + 1.2, z0 - 0.4, x1 + 0.4, H + 1.45, z1 + 0.4, roof);
      gb.box(x0 + 1, H + 1.45, z0 + 1, x1 - 1, H + 2.6, z1 - 1, wall);
      gb.geo(new THREE.ConeGeometry((x1 - x0) * 0.55, 1.6, 4), M((x0 + x1) / 2, H + 3.4, (z0 + z1) / 2, 1, 1, 1, Math.PI / 4), roof);
    }
    if (t === 'colosseum') {
      for (let x = x0 + 0.5; x < x1; x += 1.2)
        for (let f = 0; f < 3; f++) lb.box(x - 0.25, 0.6 + f * 2.6, z1 - 0.01, x + 0.25, 2 + f * 2.6, z1 + 0.05, col('#4a3a2a'));
    }
  };

  // ---------- Частицы ----------
  R3.initParticles = function () {
    const N = 2400;
    const g = new THREE.BufferGeometry();
    R3.pPos = new Float32Array(N * 3);
    R3.pCol = new Float32Array(N * 3);
    g.setAttribute('position', new THREE.BufferAttribute(R3.pPos, 3));
    g.setAttribute('color', new THREE.BufferAttribute(R3.pCol, 3));
    // мягкая круглая точка
    const cv = document.createElement('canvas');
    cv.width = cv.height = 32;
    const cx = cv.getContext('2d');
    const gr = cx.createRadialGradient(16, 16, 0, 16, 16, 16);
    gr.addColorStop(0, 'rgba(255,255,255,1)');
    gr.addColorStop(0.4, 'rgba(255,255,255,0.75)');
    gr.addColorStop(1, 'rgba(255,255,255,0)');
    cx.fillStyle = gr;
    cx.fillRect(0, 0, 32, 32);
    R3.dotTex = new THREE.CanvasTexture(cv);
    const m = new THREE.PointsMaterial({ size: 0.3, map: R3.dotTex, vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
    R3.points = new THREE.Points(g, m);
    R3.points.frustumCulled = false;
    R3.scene.add(R3.points);
    R3.parts = [];
    R3.pN = N;
    for (let i = 0; i < N; i++) R3.pPos[i * 3 + 1] = -999;
  };
  R3.burst = function (x, y, z, color, n = 10, spd = 3, life = 0.6, up = 2) {
    const c = new THREE.Color(color);
    for (let i = 0; i < n; i++) {
      if (R3.parts.length >= R3.pN) R3.parts.shift();
      const a = Math.random() * J.TAU, s = Math.random() * spd;
      R3.parts.push({ x, y: z, z: y, vx: Math.cos(a) * s, vy: Math.random() * up, vz: Math.sin(a) * s, life, max: life, r: c.r, g: c.g, b: c.b, grav: 4 });
    }
  };
  R3.aura = function (x, y, z, color) {
    const c = new THREE.Color(color);
    if (R3.parts.length >= R3.pN) R3.parts.shift();
    R3.parts.push({ x: x + (Math.random() - 0.5) * 0.9, y: z + Math.random() * 1.5, z: y + (Math.random() - 0.5) * 0.9, vx: 0, vy: 1.2 + Math.random(), vz: 0, life: 0.7, max: 0.7, r: c.r, g: c.g, b: c.b, grav: 0 });
  };
  R3.updateParticles = function (dt) {
    const P = R3.parts;
    let j = 0;
    for (let i = 0; i < P.length; i++) {
      const p = P[i];
      p.life -= dt;
      if (p.life <= 0) continue;
      p.vy -= p.grav * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.z += p.vz * dt;
      P[j++] = p;
    }
    P.length = j;
    const pos = R3.pPos, c = R3.pCol;
    for (let i = 0; i < R3.pN; i++) {
      if (i < P.length) {
        const p = P[i], k = p.life / p.max;
        pos[i * 3] = p.x; pos[i * 3 + 1] = p.y; pos[i * 3 + 2] = p.z;
        c[i * 3] = p.r * k; c[i * 3 + 1] = p.g * k; c[i * 3 + 2] = p.b * k;
      } else pos[i * 3 + 1] = -999;
    }
    R3.points.geometry.attributes.position.needsUpdate = true;
    R3.points.geometry.attributes.color.needsUpdate = true;
  };

  // ---------- Погода ----------
  R3.initWeather = function () {
    const N = 900;
    const g = new THREE.BufferGeometry();
    R3.wPos = new Float32Array(N * 3);
    for (let i = 0; i < N; i++) {
      R3.wPos[i * 3] = (Math.random() - 0.5) * 50;
      R3.wPos[i * 3 + 1] = Math.random() * 20;
      R3.wPos[i * 3 + 2] = (Math.random() - 0.5) * 50;
    }
    g.setAttribute('position', new THREE.BufferAttribute(R3.wPos, 3));
    R3.wMat = new THREE.PointsMaterial({ size: 0.12, color: '#bcd8ff', map: R3.dotTex, transparent: true, opacity: 0.8, depthWrite: false });
    R3.weatherPts = new THREE.Points(g, R3.wMat);
    R3.weatherPts.frustumCulled = false;
    R3.weatherPts.visible = false;
    R3.scene.add(R3.weatherPts);
  };
  R3.updateWeather = function (dt, kind, cx, cz) {
    const on = !!kind;
    R3.weatherPts.visible = on;
    if (!on) return;
    const p = R3.wPos;
    const fall = kind === 'rain' ? 22 : kind === 'snow' ? 2.5 : 3;
    const wind = kind === 'sand' ? 14 : kind === 'snow' ? 1 : 2;
    R3.wMat.color.set(kind === 'rain' ? '#bcd8ff' : kind === 'snow' ? '#ffffff' : '#e8c88a');
    R3.wMat.size = kind === 'rain' ? 0.1 : kind === 'snow' ? 0.18 : 0.14;
    for (let i = 0; i < p.length; i += 3) {
      p[i] += wind * dt;
      p[i + 1] -= fall * dt;
      if (p[i + 1] < 0) p[i + 1] += 20;
      if (p[i] > 25) p[i] -= 50;
    }
    R3.weatherPts.position.set(cx, 0, cz);
    R3.weatherPts.geometry.attributes.position.needsUpdate = true;
  };

  // Освещение по времени суток, небо, туман и вода — R3.setTime в render_sky.js

  // ---------- Персонажи ----------
  const matCache = (list, hex, opts) => {
    const m = new THREE.MeshLambertMaterial(Object.assign({ color: hex }, opts || {}));
    list.push(m);
    return m;
  };
  // Общие (кэшированные) геометрии помечены userData.shared — dropView их не освобождает
  const shareG = (g) => ((g.userData.shared = true), g);
  const boxG = {};
  const bgeo = (w, h, d) => {
    const k = w + ',' + h + ',' + d;
    return boxG[k] || (boxG[k] = shareG(new THREE.BoxGeometry(w, h, d)));
  };
  const geoC = {};
  const cgeo = (k, mk) => geoC[k] || (geoC[k] = shareG(mk()));
  const coneG = (r, h, s) => cgeo('c' + r + ',' + h + ',' + s, () => new THREE.ConeGeometry(r, h, s));
  const sphG = (r, a, b) => cgeo('s' + r + ',' + a + ',' + b, () => new THREE.SphereGeometry(r, a, b));
  const mesh = (g, m, x, y, z) => {
    const o = new THREE.Mesh(g, m);
    o.position.set(x, y, z);
    o.castShadow = true;
    return o;
  };

  // Простые (не гуманоидные) стенды: самолёт, рой. Гуманоиды — в models.js
  R3.buildStandSimple = function (sd) {
    const mats = [];
    const g = new THREE.Group();
    const mk = (hex) => matCache(mats, hex, { transparent: true, opacity: 0.88, emissive: new THREE.Color(hex).multiplyScalar(0.35) });
    const c1 = mk(sd.c1), c2 = mk(sd.c2), eye = matCache(mats, '#ffffff', { emissive: '#ffffff' });
    const head = sd.head;
    if (head === 'plane') {
      g.add(mesh(bgeo(0.25, 0.25, 1.2), c1, 0, 0, 0));
      g.add(mesh(bgeo(1.4, 0.06, 0.35), c2, 0, 0, 0.05));
      g.add(mesh(bgeo(0.5, 0.05, 0.2), c2, 0, 0.05, -0.5));
      g.add(mesh(bgeo(0.05, 0.3, 0.2), c1, 0, 0.18, -0.5));
      return { group: g, mats, kind: 'plane', body: g };
    }
    if (head === 'tiny' || head === 'bug') {
      const n = head === 'tiny' ? 6 : 4;
      const kids = [];
      for (let i = 0; i < n; i++) {
        const k = new THREE.Group();
        k.add(mesh(new THREE.SphereGeometry(0.11, 8, 6), c1, 0, 0, 0));
        k.add(mesh(bgeo(0.05, 0.05, 0.02), eye, -0.04, 0.03, 0.1));
        k.add(mesh(bgeo(0.05, 0.05, 0.02), eye, 0.04, 0.03, 0.1));
        k.add(mesh(bgeo(0.24, 0.02, 0.08), c2, 0, 0.07, 0));
        g.add(k);
        kids.push(k);
      }
      return { group: g, mats, kind: 'swarm', kids, body: g };
    }
    if (head === 'cloud') {
      for (let i = 0; i < 6; i++) g.add(mesh(new THREE.IcosahedronGeometry(0.35, 1), c1, Math.cos(i) * 0.4, 1.2 + Math.sin(i * 2) * 0.2, Math.sin(i) * 0.3));
      g.add(mesh(bgeo(0.08, 0.08, 0.02), eye, -0.1, 1.3, 0.38));
      g.add(mesh(bgeo(0.08, 0.08, 0.02), eye, 0.1, 1.3, 0.38));
    }
    const body = new THREE.Group();
    g.add(body);
    // ноги (стенды часто без ног внизу — сужение)
    const legL = new THREE.Group(), legR = new THREE.Group();
    legL.position.set(-0.13, 0.7, 0);
    legR.position.set(0.13, 0.7, 0);
    legL.add(mesh(new THREE.CylinderGeometry(0.1, 0.05, 0.7, 6), c1, 0, -0.35, 0));
    legR.add(mesh(new THREE.CylinderGeometry(0.1, 0.05, 0.7, 6), c1, 0, -0.35, 0));
    body.add(legL, legR);
    // торс — мускулистый
    body.add(mesh(new THREE.CylinderGeometry(0.34, 0.2, 0.62, 7), c1, 0, 1.02, 0));
    body.add(mesh(bgeo(0.36, 0.1, 0.24), c2, 0, 0.73, 0));
    body.add(mesh(bgeo(0.5, 0.12, 0.22), c2, 0, 1.28, 0));
    const armL = new THREE.Group(), armR = new THREE.Group();
    armL.position.set(-0.42, 1.25, 0);
    armR.position.set(0.42, 1.25, 0);
    armL.add(mesh(new THREE.CylinderGeometry(0.09, 0.07, 0.58, 6), c1, 0, -0.27, 0));
    armR.add(mesh(new THREE.CylinderGeometry(0.09, 0.07, 0.58, 6), c1, 0, -0.27, 0));
    armL.add(mesh(bgeo(0.16, 0.16, 0.16), c2, 0, -0.6, 0));
    armR.add(mesh(bgeo(0.16, 0.16, 0.16), c2, 0, -0.6, 0));
    body.add(armL, armR);
    const hd = new THREE.Group();
    hd.position.set(0, 1.42, 0);
    body.add(hd);
    if (head !== 'cloud' && head !== 'none') {
      hd.add(mesh(bgeo(0.32, 0.36, 0.32), c1, 0, 0.18, 0));
      hd.add(mesh(bgeo(0.07, 0.04, 0.02), eye, -0.08, 0.22, 0.165));
      hd.add(mesh(bgeo(0.07, 0.04, 0.02), eye, 0.08, 0.22, 0.165));
    }
    switch (head) {
      case 'mane':
        for (let k = 0; k < 5; k++) {
          const c = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.5, 4), c2);
          c.position.set(-0.16 + k * 0.08, 0.32, -0.18);
          c.rotation.x = -0.9;
          hd.add(c);
        }
        break;
      case 'helmet':
        hd.add(mesh(bgeo(0.06, 0.18, 0.4), c2, 0, 0.4, 0));
        hd.add(mesh(bgeo(0.34, 0.06, 0.34), c2, 0, 0.3, 0));
        break;
      case 'bird':
      case 'dog': {
        const c = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.3, 4), c2);
        c.rotation.x = Math.PI / 2;
        c.position.set(0, 0.15, 0.28);
        hd.add(c);
        if (head === 'dog') {
          hd.add(mesh(new THREE.ConeGeometry(0.06, 0.2, 4), c1, -0.12, 0.42, 0));
          hd.add(mesh(new THREE.ConeGeometry(0.06, 0.2, 4), c1, 0.12, 0.42, 0));
        } else hd.add(mesh(bgeo(0.05, 0.25, 0.3), c2, 0, 0.42, -0.05));
        break;
      }
      case 'cat':
        hd.add(mesh(new THREE.ConeGeometry(0.08, 0.18, 4), c1, -0.12, 0.42, 0));
        hd.add(mesh(new THREE.ConeGeometry(0.08, 0.18, 4), c1, 0.12, 0.42, 0));
        hd.add(mesh(new THREE.SphereGeometry(0.05, 6, 4), c2, 0, 0.1, 0.16));
        break;
      case 'horn':
        hd.add(mesh(new THREE.ConeGeometry(0.06, 0.3, 5), c2, 0, 0.48, 0.05));
        break;
      case 'ladybug':
        for (let k = 0; k < 3; k++) hd.add(mesh(new THREE.SphereGeometry(0.05, 6, 4), c2, -0.08 + k * 0.08, 0.36, 0.08));
        body.add(mesh(new THREE.SphereGeometry(0.07, 6, 4), c2, 0, 1.05, 0.26));
        break;
      case 'skull':
      case 'mask':
        hd.add(mesh(bgeo(0.28, 0.16, 0.04), c2, 0, 0.12, 0.165));
        break;
      case 'twin':
        hd.add(mesh(bgeo(0.17, 0.37, 0.33), c2, 0.08, 0.18, 0));
        break;
      case 'egg':
        hd.add(mesh(new THREE.SphereGeometry(0.22, 8, 6), c2, 0, 0.32, -0.05));
        break;
      case 'hat':
        hd.add(mesh(bgeo(0.42, 0.04, 0.42), c2, 0, 0.37, 0));
        hd.add(mesh(bgeo(0.26, 0.14, 0.26), c2, 0, 0.45, 0));
        break;
      case 'horse':
        hd.add(mesh(bgeo(0.2, 0.2, 0.3), c1, 0, 0.12, 0.22));
        hd.add(mesh(bgeo(0.06, 0.3, 0.4), c2, 0, 0.38, -0.05));
        break;
      case 'dino':
        hd.add(mesh(bgeo(0.24, 0.18, 0.34), c1, 0, 0.12, 0.26));
        break;
      case 'cloak':
        body.add(mesh(new THREE.ConeGeometry(0.5, 1.4, 7), c2, 0, 0.75, -0.05));
        break;
      case 'puzzle':
        hd.add(mesh(bgeo(0.12, 0.12, 0.12), c2, 0.12, 0.38, 0));
        break;
      case 'star':
        hd.add(mesh(new THREE.OctahedronGeometry(0.1, 0), c2, 0, 0.42, 0.1));
        break;
      case 'vines':
        for (let k = 0; k < 4; k++) armR.add(mesh(new THREE.TorusGeometry(0.12, 0.025, 4, 8), c1, 0, -0.1 - k * 0.15, 0));
        for (let k = 0; k < 4; k++) armL.add(mesh(new THREE.TorusGeometry(0.12, 0.025, 4, 8), c1, 0, -0.1 - k * 0.15, 0));
        break;
      case 'eyes':
        for (let k = 0; k < 6; k++) body.add(mesh(new THREE.SphereGeometry(0.05, 6, 4), eye, Math.cos(k) * 0.25, 0.85 + (k % 3) * 0.18, 0.2));
        break;
      default:
    }
    if (sd.extra === 'sword' || sd.extra === 'arrow') armR.add(mesh(bgeo(0.04, 0.04, 1.1), matCache(mats, '#e8eefc', { emissive: '#6a7a9a' }), 0, -0.6, 0.5));
    if (sd.extra === 'scythe') {
      armR.add(mesh(bgeo(0.04, 1.4, 0.04), c2, 0, -0.55, 0.1));
      armR.add(mesh(bgeo(0.04, 0.12, 0.7), matCache(mats, '#e8eefc'), 0, 0.1, 0.4));
    }
    if (sd.extra === 'rod') armR.add(mesh(bgeo(0.03, 0.03, 1.6), c2, 0, -0.6, 0.7));
    return { group: g, mats, kind: 'human', body, head: hd, legL, legR, armL, armR };
  };

  // Звери и прочие модели
  R3.buildCreature = function (kind, colorHex) {
    const mats = [];
    const g = new THREE.Group();
    const c = matCache(mats, colorHex || '#7a6a5a');
    const d = matCache(mats, '#1d1a22');
    const legs = [];
    const quad = (len, hgt, w, legH) => {
      g.add(mesh(bgeo(w, hgt, len), c, 0, legH + hgt / 2, 0));
      for (const [x, z] of [[-w / 2 + 0.06, len / 2 - 0.1], [w / 2 - 0.06, len / 2 - 0.1], [-w / 2 + 0.06, -len / 2 + 0.1], [w / 2 - 0.06, -len / 2 + 0.1]]) {
        const lg = new THREE.Group();
        lg.position.set(x, legH, z);
        lg.add(mesh(bgeo(0.1, legH, 0.1), c, 0, -legH / 2, 0));
        g.add(lg);
        legs.push(lg);
      }
    };
    switch (kind) {
      case 'coyote':
      case 'wolf':
        quad(0.9, 0.32, 0.3, 0.38);
        g.add(mesh(bgeo(0.26, 0.26, 0.34), c, 0, 0.82, 0.55));
        g.add(mesh(coneG(0.06, 0.15, 4), c, -0.08, 1.0, 0.5));
        g.add(mesh(coneG(0.06, 0.15, 4), c, 0.08, 1.0, 0.5));
        g.add(mesh(bgeo(0.06, 0.06, 0.4), c, 0, 0.75, -0.6));
        g.add(mesh(bgeo(0.05, 0.05, 0.02), matCache(mats, '#ffd84a', { emissive: '#ffd84a' }), -0.07, 0.86, 0.73));
        g.add(mesh(bgeo(0.05, 0.05, 0.02), matCache(mats, '#ffd84a', { emissive: '#ffd84a' }), 0.07, 0.86, 0.73));
        break;
      case 'bear':
        quad(1.3, 0.7, 0.7, 0.45);
        g.add(mesh(bgeo(0.45, 0.4, 0.4), c, 0, 1.2, 0.75));
        break;
      case 'croc':
        g.add(mesh(bgeo(0.5, 0.25, 1.6), c, 0, 0.18, 0));
        g.add(mesh(bgeo(0.36, 0.18, 0.6), c, 0, 0.18, 1.05));
        g.add(mesh(coneG(0.18, 0.9, 4), c, 0, 0.15, -1.2));
        g.children[g.children.length - 1].rotation.x = -Math.PI / 2;
        break;
      case 'scorpion':
        g.add(mesh(bgeo(0.4, 0.15, 0.55), c, 0, 0.15, 0));
        g.add(mesh(bgeo(0.1, 0.4, 0.1), c, 0, 0.4, -0.3));
        g.add(mesh(coneG(0.06, 0.15, 4), d, 0, 0.65, -0.2));
        g.add(mesh(bgeo(0.15, 0.08, 0.2), c, -0.25, 0.15, 0.35));
        g.add(mesh(bgeo(0.15, 0.08, 0.2), c, 0.25, 0.15, 0.35));
        break;
      case 'frog':
        g.add(mesh(bgeo(0.36, 0.22, 0.4), c, 0, 0.12, 0));
        g.add(mesh(sphG(0.07, 6, 4), matCache(mats, '#ffffff'), -0.1, 0.27, 0.12));
        g.add(mesh(sphG(0.07, 6, 4), matCache(mats, '#ffffff'), 0.1, 0.27, 0.12));
        break;
      case 'bug':
        g.add(mesh(sphG(0.13, 8, 6), c, 0, 0.6, 0));
        g.add(mesh(bgeo(0.36, 0.02, 0.12), matCache(mats, '#ffffff', { transparent: true, opacity: 0.6 }), 0, 0.7, 0));
        break;
      case 'sha':
        g.add(mesh(bgeo(0.5, 0.3, 0.6), c, 0, 0.25, 0));
        g.add(mesh(sphG(0.22, 8, 6), matCache(mats, '#e8e8f0'), 0, 0.5, 0.15));
        g.add(mesh(bgeo(0.6, 0.12, 0.66), d, 0, 0.08, 0));
        break;
      case 'raptor':
        g.add(mesh(bgeo(0.36, 0.4, 0.9), c, 0, 0.85, 0));
        g.add(mesh(bgeo(0.28, 0.26, 0.5), c, 0, 1.15, 0.6));
        g.add(mesh(coneG(0.12, 0.8, 4), c, 0, 0.85, -0.75));
        g.children[g.children.length - 1].rotation.x = -Math.PI / 2;
        for (const x of [-0.12, 0.12]) {
          const lg = new THREE.Group();
          lg.position.set(x, 0.65, 0);
          lg.add(mesh(bgeo(0.1, 0.65, 0.12), c, 0, -0.32, 0));
          g.add(lg);
          legs.push(lg);
        }
        break;
      case 'horse':
        quad(1.4, 0.55, 0.45, 0.8);
        g.add(mesh(bgeo(0.25, 0.7, 0.3), c, 0, 1.55, 0.7));
        g.children[g.children.length - 1].rotation.x = 0.5;
        g.add(mesh(bgeo(0.22, 0.25, 0.5), c, 0, 1.85, 0.95));
        break;
      default:
        g.add(mesh(sphG(0.3, 8, 6), c, 0, 0.4, 0));
    }
    return { group: g, mats, kind: 'creature', legs, baseColors: mats.map((m) => m.color.clone()) };
  };

  // тень от персонажа включается/выключается по рейтингу близости (см. Game.update → R3.rankCasters)
  const setCast = (v, on) => {
    v.cast = on;
    v.group.traverse((o) => {
      if (o.isMesh) o.castShadow = on;
    });
  };
  R3.makeView = function (e) {
    let v;
    if (e.look) v = R3.buildHuman(e.look, e.scale || 1);
    else v = R3.buildCreature(e.model, e.color);
    setCast(v, !!(e.isPlayer || e._cast));
    R3.scene.add(v.group);
    v.phase = Math.random() * 6;
    v.face = e.face || 0;
    if (!v.baseColors) v.baseColors = v.mats.map((m) => m.color.clone());
    if (e.mount) {
      v.horse = R3.buildCreature('horse', '#7a4a2a');
      setCast(v.horse, true);
      R3.scene.add(v.horse.group);
    }
    return v;
  };

  // убрать вид из сцены и освободить его собственные геометрии и материалы (общие кэшированные — не трогаем)
  const disposeView = (R3.disposeView = (v) => {
    if (!v) return;
    R3.scene.remove(v.group);
    v.group.traverse((o) => {
      if (o.isMesh && o.geometry && !o.geometry.userData.shared) o.geometry.dispose();
    });
    v.mats.forEach((m) => m.dispose());
  });
  R3.dropView = function (e) {
    const rm = disposeView;
    if (e.view) {
      rm(e.view);
      if (e.view.horse) rm(e.view.horse);
    }
    rm(e.standView);
    e.view = null;
    e.standView = null;
    if (e.labelEl) {
      e.labelEl.remove();
      e.labelEl = null;
    }
  };

  // Рейтинг теней: тень отбрасывают игрок и N ближайших персонажей (N из пресета), не дальше 18 м
  const castList = [];
  R3.rankCasters = function (ents, px, py) {
    castList.length = 0;
    for (const e of ents) {
      e._cast = false;
      if (e.isPlayer) continue;
      const dx = e.x - px, dy = e.y - py;
      e._d2 = dx * dx + dy * dy;
      if (e._d2 < 324) castList.push(e);
    }
    const n = R3.shadows && R3.preset.shadows ? R3.charCast : 0;
    if (!n || !castList.length) return;
    castList.sort((a, b) => a._d2 - b._d2);
    for (let i = 0; i < castList.length && i < n; i++) castList[i]._cast = true;
  };

  // Обновление вида сущности
  R3.viewBudget = 99;
  R3.updateView = function (e, dt, t, playerHasStand) {
    const w = J.G.world;
    // дальше тумана — не рисуем и не анимируем
    const cdx = e.x - R3.cam.tx, cdy = e.y - R3.cam.tz, d2 = cdx * cdx + cdy * cdy;
    const far = R3.scene.fog.far + 5;
    const important = e.isPlayer || e.storyTag || e.boss;
    if (!important && d2 > far * far) {
      if (e.view) e.view.group.visible = false;
      if (e.view && e.view.horse) e.view.horse.group.visible = false;
      if (e.standView) e.standView.group.visible = false;
      return;
    }
    if (!e.view || e.view.forHorse !== !!e.mount) {
      // не больше одного нового второстепенного персонажа за кадр — без рывков при появлении толпы
      if (!e.view && !important) {
        if (R3.viewBudget <= 0) return;
        R3.viewBudget--;
      }
      if (e.view) R3.dropView(e);
      e.view = R3.makeView(e);
      e.view.forHorse = !!e.mount;
    }
    const v = e.view;
    const wantCast = !!(e.isPlayer || e._cast);
    if (v.cast !== wantCast) setCast(v, wantCast);
    if (v.horse) v.horse.group.visible = true;
    const gy = e.onWater ? -0.1 : w.groundY(e.x, e.y);
    const ride = e.mount ? 0.95 : 0;
    v.group.position.set(e.x, gy + (e.z || 0) + ride, e.y);
    // плавный поворот
    v.face += J.angDiff(v.face, e.face) * Math.min(1, dt * 14);
    v.group.rotation.y = Math.PI / 2 - v.face;
    const spd = Math.hypot(e.vx || 0, e.vy || 0);
    if (spd > 0.2) v.phase += dt * (4 + spd * 1.6);
    const sw = spd > 0.2 ? Math.sin(v.phase) : 0;
    if (v.legL && (d2 < 2025 || important)) R3.animateRig(v, e, sw, spd, t, dt);
    if (v.legs) v.legs.forEach((l, i) => (l.rotation.x = (i % 2 ? sw : -sw) * 0.6));
    if (v.kind === 'creature' && e.model === 'bug') v.group.position.y += 0.3 + Math.sin(t * 8 + v.phase) * 0.1;
    // смерть
    if (e.dead) {
      v.group.rotation.z = Math.min(Math.PI / 2, (v.group.rotation.z || 0) + dt * 5);
    } else v.group.rotation.z = 0;
    // цвет: вспышка урона / заморозка / невидимость
    const flash = e.hitFlash > 0;
    const frozen = e.st && (e.st.freeze > 0 || e.st.timefrozen);
    let op = 1;
    if (e.st && e.st.invis > 0) op = e.team === 'player' ? 0.3 : 0.06;
    if (e.st && e.st.void > 0) op = 0.05;
    if (e.isPlayer && R3.cam.veryNear) op = Math.min(op, 0.3);
    for (let i = 0; i < v.mats.length; i++) {
      const m = v.mats[i];
      if (flash) m.color.setRGB(1, 0.35, 0.35);
      else if (frozen) m.color.copy(v.baseColors[i]).lerp(tmpC.set('#a8e0ff'), 0.6);
      else if (e.st && e.st.book > 0) m.color.copy(v.baseColors[i]).lerp(tmpC.set('#fff6d8'), 0.5);
      else if (e.st && e.st.age > 0) m.color.copy(v.baseColors[i]).lerp(tmpC.set('#9a8a7a'), 0.5);
      else m.color.copy(v.baseColors[i]);
      const tr = op < 1;
      if (m.transparent !== tr) {
        m.transparent = tr;
        m.needsUpdate = true;
      }
      m.opacity = op;
    }
    v.group.visible = !(e.st && e.st.void > 0 && e.team !== 'player') && !(e.standSummon && e.team !== 'player' && !playerHasStand);
    if (v.horse) {
      v.horse.group.position.set(e.x, gy, e.y);
      v.horse.group.rotation.y = v.group.rotation.y;
      v.horse.legs.forEach((l, i) => (l.rotation.x = (i % 2 ? sw : -sw) * 0.8));
    }

    // Стенд
    const showStand = e.stand && e.standOut && !e.dead && (e.team === 'player' || playerHasStand);
    if (showStand) {
      const sd = J.STANDS[e.stand.id];
      if (!e.standView || e.standView.id !== sd.id) {
        if (e.standView) disposeView(e.standView);
        e.standView = R3.buildStand(sd);
        e.standView.id = sd.id;
        e.standView.pos = new THREE.Vector3(e.x, gy + 0.3, e.y);
        R3.scene.add(e.standView.group);
        R3.burst(e.x, e.y, gy + 1.2, sd.c1, 18, 3, 0.6, 2);
      }
      const sv = e.standView;
      const fa = e.face;
      const fx = Math.cos(fa), fy = Math.sin(fa);
      const attacking = e.anim && e.anim.t > 0 && e.anim.stand;
      let ox, oy;
      if (attacking) {
        ox = fx * 0.95;
        oy = fy * 0.95;
      } else {
        // за плечом
        ox = -fx * 0.55 - fy * 0.55;
        oy = -fy * 0.55 + fx * 0.55;
      }
      const target = tmpP.set(e.x + ox, gy + 0.25 + Math.sin(t * 2.2) * 0.07 + (e.z || 0) + ride * 0.6, e.y + oy);
      sv.pos.lerp(target, Math.min(1, dt * (attacking ? 22 : 9)));
      sv.group.position.copy(sv.pos);
      sv.group.rotation.y = Math.PI / 2 - fa;
      sv.group.visible = true;
      const sc = sd.head === 'plane' ? 1 : 1.18;
      sv.group.scale.setScalar(sc);
      if (sv.kind === 'plane') {
        sv.group.position.y += 1.6;
        sv.group.rotation.z = Math.sin(t * 3) * 0.3;
      }
      if (sv.kind === 'swarm') {
        sv.kids.forEach((k, i) => {
          const a = t * 2 + (i / sv.kids.length) * J.TAU;
          k.position.set(Math.cos(a) * 0.6, 1.1 + Math.sin(t * 5 + i) * 0.2, Math.sin(a) * 0.6);
          if (attacking) k.position.z += 0.6;
        });
      }
      if (sv.armL) R3.animateStand(sv, e, attacking, t);
      const op = e.isPlayer && R3.cam.near ? 0.35 : 0.88;
      if (sv.op !== op) {
        sv.op = op;
        sv.mats.forEach((m) => (m.opacity = m.transparent ? op : m.opacity));
      }
      if (Math.random() < dt * 14) R3.aura(sv.pos.x, sv.pos.z, sv.pos.y, sd.c1);
      if (attacking && e.anim.type === 'rush' && Math.random() < 0.7) {
        const r = Math.random() * 0.5;
        R3.burst(e.x + fx * (1.3 + r) + (Math.random() - 0.5) * 0.6, e.y + fy * (1.3 + r) + (Math.random() - 0.5) * 0.6, gy + 1 + Math.random() * 0.7, sd.c2, 1, 0.5, 0.15, 0.2);
      }
    } else if (e.standView) {
      e.standView.group.visible = false;
      if (!e.standOut || e.dead) {
        disposeView(e.standView);
        e.standView = null;
      }
    }
  };

  // Анимация скелета человека: ходьба, бег, удары, поза, верховая езда
  R3.animateRig = function (v, e, sw, spd, t, dt) {
    const amp = J.clamp(spd / 4.4, 0.55, 1.35);
    const moving = spd > 0.2;
    const cw = moving ? Math.cos(v.phase) : 0;
    let tL = sw * 0.62 * amp, tR = -sw * 0.62 * amp;
    let kL = moving ? 0.1 + Math.max(0, -cw) * 0.95 * amp : 0.04, kR = moving ? 0.1 + Math.max(0, cw) * 0.95 * amp : 0.04;
    let aL = -sw * 0.5 * amp, aR = sw * 0.5 * amp;
    let fL = moving ? -0.35 - 0.3 * (amp - 0.5) : -0.12, fR = fL;
    let bodyX = moving ? 0.04 + (amp > 1.1 ? 0.12 : 0) : 0, bodyY = 0, bodyZ = 0;
    let azL = -0.09, azR = 0.09;
    if (e.mount) {
      tL = tR = -1.35;
      kL = kR = 1.45;
      v.legL.rotation.z = -0.35;
      v.legR.rotation.z = 0.35;
    } else {
      v.legL.rotation.z = v.legR.rotation.z = 0;
    }
    if (e.anim && e.anim.t > 0) {
      const k = e.anim.t / e.anim.max;
      const ty = e.anim.type;
      if (ty === 'punch') { aR = -1.55 * Math.sin(k * Math.PI); fR = -0.15; bodyY = -0.25 * Math.sin(k * Math.PI); }
      else if (ty === 'heavy') { aR = -1.7 * Math.sin(k * Math.PI); fR = -0.05; bodyY = -0.45 * Math.sin(k * Math.PI); tL = -0.35; kR = 0.3; }
      else if (ty === 'cast') { aR = -1.45; aL = -1.45; fR = fL = -0.2; }
      else if (ty === 'rush') { aR = -1.35 + Math.sin(t * 50) * 0.45; aL = -1.35 + Math.cos(t * 50) * 0.45; fR = fL = -0.25; }
      else if (ty === 'pose') {
        // поза ДжоДжо
        aR = -2.7; fR = -1.5; aL = 0.25; azL = -0.6; fL = -1.2;
        bodyY = 0.45; bodyZ = 0.12; tL = -0.25; tR = 0.35; kR = 0.55;
      }
    }
    v.legL.rotation.x = tL;
    v.legR.rotation.x = tR;
    v.shinL.rotation.x = kL;
    v.shinR.rotation.x = kR;
    v.armL.rotation.x = aL;
    v.armR.rotation.x = aR;
    v.armL.rotation.z = azL;
    v.armR.rotation.z = azR;
    v.foreL.rotation.x = fL;
    v.foreR.rotation.x = fR;
    v.body.rotation.x = e.dead ? 0 : bodyX;
    v.body.rotation.y = bodyY;
    v.body.rotation.z = bodyZ;
    v.body.position.y = moving && !e.mount ? Math.abs(Math.sin(v.phase)) * 0.035 * amp : Math.sin(t * 2 + v.phase) * 0.004;
  };
  R3.animateStand = function (sv, e, attacking, t) {
    let aL = 0.18 + Math.sin(t * 2) * 0.05, aR = 0.18 - Math.sin(t * 2) * 0.05, fL = -0.5, fR = -0.5;
    if (attacking) {
      const ty = e.anim.type;
      if (ty === 'rush') {
        aR = -1.5 + Math.sin(t * 60) * 0.45;
        aL = -1.5 + Math.cos(t * 60) * 0.45;
        fR = -0.1 - Math.max(0, Math.cos(t * 60)) * 0.6;
        fL = -0.1 - Math.max(0, Math.sin(t * 60)) * 0.6;
      } else if (ty === 'heavy' || ty === 'punch') {
        const k = e.anim.t / e.anim.max;
        aR = -1.6 * Math.sin(k * Math.PI);
        fR = -0.05;
      } else {
        aR = aL = -1.4;
        fR = fL = -0.15;
      }
    }
    sv.armL.rotation.x = aL;
    sv.armR.rotation.x = aR;
    sv.armL.rotation.z = -0.22;
    sv.armR.rotation.z = 0.22;
    if (sv.foreL) {
      sv.foreL.rotation.x = fL;
      sv.foreR.rotation.x = fR;
    }
    sv.legL.rotation.x = 0.25;
    sv.legR.rotation.x = -0.05;
    if (sv.shinL) {
      sv.shinL.rotation.x = 0.5;
      sv.shinR.rotation.x = 0.25;
    }
  };

  // ---------- Снаряды ----------
  const projGeos = {};
  const projGeo = (shape, size) => {
    const k = shape + size.toFixed(2);
    if (projGeos[k]) return projGeos[k];
    let g;
    switch (shape) {
      case 'knife': case 'blade': g = new THREE.BoxGeometry(size * 0.35, size * 0.15, size * 2.6); break;
      case 'nail': case 'needle': case 'arrow': g = new THREE.ConeGeometry(size * 0.5, size * 2.6, 5); g.rotateX(Math.PI / 2); break;
      case 'emerald': case 'shard': g = new THREE.OctahedronGeometry(size, 0); break;
      case 'ice': g = new THREE.ConeGeometry(size * 0.6, size * 2.8, 5); g.rotateX(Math.PI / 2); break;
      case 'missile': g = new THREE.CylinderGeometry(size * 0.4, size * 0.4, size * 2.4, 6); g.rotateX(Math.PI / 2); break;
      case 'cube': g = new THREE.BoxGeometry(size * 1.2, size * 1.2, size * 1.2); break;
      case 'spiral': g = new THREE.TorusGeometry(size, size * 0.3, 6, 12); break;
      case 'sound': g = new THREE.TorusKnotGeometry(size * 0.6, size * 0.18, 24, 4); break;
      default: g = new THREE.SphereGeometry(size, 8, 6);
    }
    return (projGeos[k] = g);
  };
  const basicMats = {};
  const bmat = (hex, opacity = 1) => {
    const k = hex + opacity;
    return basicMats[k] || (basicMats[k] = new THREE.MeshBasicMaterial({ color: hex, transparent: opacity < 1, opacity }));
  };
  R3.updateProj = function (p, dt) {
    if (!p.view) {
      const g = projGeo(p.shape || 'orb', p.size || 0.2);
      p.view = new THREE.Mesh(g, bmat(p.color || '#ffffff', p.shape === 'bubble' ? 0.45 : 1));
      R3.fxGroup.add(p.view);
    }
    const w = J.G.world;
    const y = Math.max(0, w.groundY(p.x, p.y)) + (p.h || 1.0);
    p.view.position.set(p.x, y, p.y);
    // чужие стендовые снаряды не видны без своего стенда
    p.view.visible = !(p.standProj && p.team !== 'player' && !J.G.player.stand);
    p.view.rotation.y = Math.PI / 2 - Math.atan2(p.vy, p.vx);
    if (p.shape === 'spiral' || p.shape === 'sound') p.view.rotation.z += dt * 12;
    if ((p.shape === 'flame' || p.shape === 'hamon') && p.view.visible) R3.burst(p.x, p.y, y, p.color, 1, 0.6, 0.3, 0.5);
  };
  R3.dropProj = function (p) {
    if (p.view) R3.fxGroup.remove(p.view);
    p.view = null;
  };

  // ---------- Визуальные эффекты ----------
  R3.fx = [];
  const ringGeo = new THREE.RingGeometry(0.85, 1, 40);
  ringGeo.rotateX(-Math.PI / 2);
  const sphGeo = new THREE.SphereGeometry(1, 16, 10);
  const cylGeo = new THREE.CylinderGeometry(1, 1, 1, 24, 1, true);
  const beamGeo = new THREE.BoxGeometry(1, 1, 1);
  R3.ring = function (x, y, radius, color, life = 0.45) {
    const m = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.9, side: THREE.DoubleSide, depthWrite: false }));
    m.position.set(x, J.G.world.groundY(x, y) + 0.15, y);
    R3.fxGroup.add(m);
    R3.fx.push({ m, life, max: life, kind: 'ring', r: radius });
  };
  R3.flash = function (x, y, radius, color, life = 0.3, h = 1) {
    const m = new THREE.Mesh(sphGeo, new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.7, depthWrite: false }));
    m.position.set(x, J.G.world.groundY(x, y) + h, y);
    R3.fxGroup.add(m);
    R3.fx.push({ m, life, max: life, kind: 'flash', r: radius });
  };
  R3.beam = function (x0, y0, x1, y1, width, color, life = 0.3) {
    const m = new THREE.Mesh(beamGeo, new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.9, depthWrite: false }));
    const L = Math.hypot(x1 - x0, y1 - y0);
    const gy = J.G.world.groundY(x0, y0) + 1.1;
    m.position.set((x0 + x1) / 2, gy, (y0 + y1) / 2);
    m.scale.set(width, width, L);
    m.rotation.y = Math.PI / 2 - Math.atan2(y1 - y0, x1 - x0);
    R3.fxGroup.add(m);
    R3.fx.push({ m, life, max: life, kind: 'beam', w: width });
  };
  R3.fieldMesh = function (f) {
    const m = new THREE.Mesh(cylGeo, new THREE.MeshBasicMaterial({ color: f.color, transparent: true, opacity: 0.22, side: THREE.DoubleSide, depthWrite: false }));
    m.scale.set(f.radius, 1.6, f.radius);
    R3.fxGroup.add(m);
    return m;
  };
  R3.trapMesh = function (tr) {
    const m = new THREE.Mesh(new THREE.OctahedronGeometry(0.22, 0), new THREE.MeshBasicMaterial({ color: tr.color }));
    R3.fxGroup.add(m);
    return m;
  };
  const pickGeo = new THREE.OctahedronGeometry(0.32, 0);
  R3.pickupMesh = function (color) {
    const g = new THREE.Group();
    g.add(new THREE.Mesh(pickGeo, bmat(color)));
    const beam = new THREE.Mesh(cylGeo, new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.18, depthWrite: false, side: THREE.DoubleSide }));
    beam.scale.set(0.35, 30, 0.35);
    beam.position.y = 15;
    g.add(beam);
    R3.fxGroup.add(g);
    return g;
  };
  R3.removeMesh = function (m) {
    if (!m) return;
    R3.fxGroup.remove(m);
  };
  R3.updateFx = function (dt) {
    let j = 0;
    for (const f of R3.fx) {
      f.life -= dt;
      if (f.life <= 0) {
        R3.fxGroup.remove(f.m);
        f.m.material.dispose();
        continue;
      }
      const k = 1 - f.life / f.max;
      if (f.kind === 'ring') {
        const s = 0.3 + f.r * k;
        f.m.scale.set(s, 1, s);
        f.m.material.opacity = 0.9 * (1 - k);
      } else if (f.kind === 'flash') {
        const s = f.r * (0.4 + 0.6 * k);
        f.m.scale.set(s, s, s);
        f.m.material.opacity = 0.6 * (1 - k);
      } else if (f.kind === 'beam') {
        f.m.scale.x = f.m.scale.y = f.w * (1 - k * 0.8);
        f.m.material.opacity = 0.9 * (1 - k);
      }
      R3.fx[j++] = f;
    }
    R3.fx.length = j;
  };

  // ---------- Текст поверх 3D (урон, ОРА, ゴゴゴ) ----------
  const proj = new THREE.Vector3();
  R3.toScreen = function (x, y, h) {
    proj.set(x, h, y).project(R3.camera);
    if (proj.z > 1) return null;
    return { x: (proj.x * 0.5 + 0.5) * R3.W, y: (-proj.y * 0.5 + 0.5) * R3.H };
  };
  R3.text = function (x, y, text, cls, life = 0.9, h = 2) {
    const el = document.createElement('div');
    el.className = 'ftxt ' + (cls || '');
    el.textContent = text;
    R3.labelLayer.appendChild(el);
    R3.textFx.push({ el, x, y, h: J.G.world.groundY(x, y) + h, life, max: life, dx: (Math.random() - 0.5) * 30 });
    if (R3.textFx.length > 60) {
      const o = R3.textFx.shift();
      o.el.remove();
    }
  };
  R3.updateText = function (dt) {
    let j = 0;
    for (const f of R3.textFx) {
      f.life -= dt;
      if (f.life <= 0) {
        f.el.remove();
        continue;
      }
      const k = 1 - f.life / f.max;
      const s = R3.toScreen(f.x, f.y, f.h + k * 1.2);
      if (s) {
        f.el.style.transform = `translate(${s.x + f.dx * k}px, ${s.y}px) translate(-50%,-50%) scale(${1 + 0.3 * Math.sin(Math.min(1, k * 4) * Math.PI)})`;
        f.el.style.opacity = f.life < 0.25 ? f.life / 0.25 : 1;
        f.el.style.display = '';
      } else f.el.style.display = 'none';
      R3.textFx[j++] = f;
    }
    R3.textFx.length = j;
  };

  // Ярлыки над NPC и зданиями
  R3.label = function (owner, text, cls) {
    if (!owner.labelEl) {
      owner.labelEl = document.createElement('div');
      owner.labelEl.className = 'wlabel ' + (cls || '');
      R3.labelLayer.appendChild(owner.labelEl);
    }
    if (owner.labelEl._t !== text) {
      owner.labelEl.innerHTML = text;
      owner.labelEl._t = text;
    }
    return owner.labelEl;
  };
  R3.placeLabel = function (el, x, y, h) {
    const s = R3.toScreen(x, y, h);
    if (!s || s.x < -100 || s.x > R3.W + 100 || s.y < -50 || s.y > R3.H + 50) {
      if (el._hid !== true) {
        el.style.display = 'none';
        el._hid = true;
      }
      return;
    }
    if (el._hid !== false) {
      el.style.display = '';
      el._hid = false;
    }
    const sx = Math.round(s.x * 2) / 2, sy = Math.round(s.y * 2) / 2;
    if (el._x !== sx || el._y !== sy) {
      el._x = sx;
      el._y = sy;
      el.style.transform = `translate3d(${sx}px, ${sy}px, 0) translate(-50%,-100%)`;
    }
  };

  // Предварительная компиляция шейдеров, чтобы первые встречи с объектами не давали фризов
  R3.warmup = function () {
    R3.prebuildRigs();
    const tmp = new THREE.Group();
    const h = R3.buildHuman({ gender: 'm', skin: '#eac09f', hair: 'short', hairColor: '#222', top: '#333', bottom: '#333' });
    tmp.add(h.group);
    const st = R3.buildStand(J.STANDS.star_platinum);
    tmp.add(st.group);
    tmp.add(R3.buildCreature('coyote', '#aa8855').group);
    tmp.add(R3.pickupMesh('#ffffff'));
    tmp.add(new THREE.Mesh(sphGeo, new THREE.MeshBasicMaterial({ color: '#fff', transparent: true, opacity: 0.5, depthWrite: false })));
    tmp.add(new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ color: '#fff', transparent: true, opacity: 0.5, side: THREE.DoubleSide, depthWrite: false })));
    // материалы чанков (земля, город, фасады, растительность-инстансы) — иначе первый город даёт фриз компиляции
    const g = new THREE.BufferGeometry();
    const n3 = (a) => new THREE.Float32BufferAttribute(a, 3);
    g.setAttribute('position', n3([0, 0, 0, 1, 0, 0, 0, 0, 1]));
    g.setAttribute('normal', n3([0, 1, 0, 0, 1, 0, 0, 1, 0]));
    g.setAttribute('color', n3([1, 1, 1, 1, 1, 1, 1, 1, 1]));
    g.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, 1, 0, 0, 1], 2));
    g.setAttribute('aCell', new THREE.Float32BufferAttribute([0, 0, 0, 0, 0, 0], 2));
    const mats = [R3.terrainMat, R3.buildMat, R3.lightMat, R3.poolMat].concat(Object.values(R3.cmat || {}));
    for (const m of mats) if (m) tmp.add(new THREE.Mesh(g, m));
    for (const m of [R3.decoMat, R3.bulbMat]) {
      const im = new THREE.InstancedMesh(g, m, 1);
      im.setMatrixAt(0, new THREE.Matrix4());
      im.setColorAt(0, new THREE.Color(1, 1, 1));
      tmp.add(im);
    }
    tmp.position.set(0, -50, 0);
    R3.scene.add(tmp);
    try {
      R3.renderer.compile(R3.scene, R3.camera);
    } catch (e) {}
    R3.scene.remove(tmp);
    g.dispose();
  };

  R3.render = function () {
    if (R3.sky) R3.sky.position.copy(R3.camera.position);
    R3.renderer.render(R3.scene, R3.camera);
  };
})();
