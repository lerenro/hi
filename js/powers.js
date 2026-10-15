'use strict';
// Сверхспособности стендов: настоящие эффекты вместо безликих ударов.
// Ядро — пулы, без выделений памяти в кадре:
//  • частицы на GPU (огонь, дым, искры энергии, брызги) — два буфера: аддитивный и полупрозрачный;
//  • «немедленные» инстанс-меши, которые силы перерисовывают каждый кадр: сегменты (лозы, нити, щупальца,
//    молнии, лучи), шипы (терновник, лёд, зубья молнии-застёжки), кристаллы (изумруды, осколки), кубики;
//  • наземные следы (подпалины, иней, кратер, плесень, кровь), точечный свет от огня и взрывов,
//    остаточные силуэты (послеобразы стендов), звуковые слова Эха как 3D-надписи;
//  • аура стенда: полупрозрачное пламя-«сияние» и контурный свет по краю.
// Сами силы (Красный Маг, Иерофант, Колесница, Королева-убийца, Рука, Липкие Пальцы...) — ниже, в Pw.POW.
(function () {
  const R3 = J.R3;
  const Pw = (J.Pw = { ready: false, simT: 0 });
  const TAU = Math.PI * 2;
  const rnd = Math.random;
  const G = () => J.G;
  const gy = (x, y) => J.G.world.groundY(x, y);
  const C = new THREE.Color(), C2 = new THREE.Color(), C3 = new THREE.Color();
  const V1 = new THREE.Vector3(), V2 = new THREE.Vector3(), V3 = new THREE.Vector3(), UP = new THREE.Vector3(0, 1, 0);
  const M = new THREE.Matrix4(), Q = new THREE.Quaternion(), S = new THREE.Vector3(), P = new THREE.Vector3(), E = new THREE.Euler();
  const fxOn = () => J.Fx && J.Fx.ready;
  const near = (a, b, r) => (J.Fx && J.Fx.nearPlayer ? J.Fx.nearPlayer(a, b, r) : true);
  const col = (h) => (h && h.isColor ? h : C3.set(h || '#ffffff'));
  Pw.col = col;

  // ---------- 1. Частицы ----------
  const PVS = `
    uniform float uTime;
    attribute vec3 aP0; attribute vec3 aV; attribute vec4 aT; attribute vec3 aC0; attribute vec3 aC1; attribute vec4 aX;
    varying vec3 vC; varying float vA; varying vec2 vUv;
    void main() {
      float age = uTime - aT.x; float k = age / aT.y;
      vUv = position.xy * 0.5 + 0.5;
      if (k < 0.0 || k > 1.0) { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); vA = 0.0; vC = aC0; return; }
      float tt = (1.0 - exp(-1.4 * age)) / 1.4;
      vec3 p = aP0 + aV * tt - vec3(0.0, aX.x * 0.5 * age * age, 0.0);
      vec4 mv = modelViewMatrix * vec4(p, 1.0);
      float sz = mix(aT.z, aT.w, k);
      float a = aX.z + aX.w * age; float c = cos(a), s = sin(a);
      mv.xy += vec2(c * position.x - s * position.y, s * position.x + c * position.y) * sz;
      gl_Position = projectionMatrix * mv;
      vC = mix(aC0, aC1, k);
      vA = aX.y * (1.0 - k) * min(1.0, k * 10.0 + 0.15);
    }`;
  const PFS_ADD = `
    uniform sampler2D uTex; varying vec3 vC; varying float vA; varying vec2 vUv;
    void main() { vec4 t = texture2D(uTex, vUv); float a = t.a * vA; if (a < 0.004) discard; gl_FragColor = vec4(vC * a, 1.0); }`;
  const PFS_ALPHA = `
    uniform sampler2D uTex; varying vec3 vC; varying float vA; varying vec2 vUv;
    void main() { vec4 t = texture2D(uTex, vUv); float a = t.a * vA; if (a < 0.004) discard; gl_FragColor = vec4(vC * (0.7 + 0.3 * t.r), a); }`;
  function puffTex() {
    const cv = document.createElement('canvas');
    cv.width = cv.height = 64;
    const c = cv.getContext('2d');
    const R = J.rng(31);
    // клубящееся пятно: несколько размытых кругов
    for (let i = 0; i < 14; i++) {
      const a = R() * TAU, r = R() * 12, x = 32 + Math.cos(a) * r, y = 32 + Math.sin(a) * r, rr = 10 + R() * 12;
      const g = c.createRadialGradient(x, y, 0, x, y, rr);
      g.addColorStop(0, 'rgba(255,255,255,0.55)');
      g.addColorStop(0.6, 'rgba(255,255,255,0.22)');
      g.addColorStop(1, 'rgba(255,255,255,0)');
      c.fillStyle = g;
      c.fillRect(0, 0, 64, 64);
    }
    // мягкий край
    const id = c.getImageData(0, 0, 64, 64);
    for (let y = 0; y < 64; y++)
      for (let x = 0; x < 64; x++) {
        const d = Math.hypot(x - 31.5, y - 31.5) / 32;
        const i = (y * 64 + x) * 4;
        const f = Math.max(0, 1 - d * d);
        id.data[i + 3] = Math.min(255, id.data[i + 3] * f * 1.4);
        id.data[i] = id.data[i + 1] = id.data[i + 2] = 200 + R() * 55;
      }
    c.putImageData(id, 0, 0);
    const t = new THREE.CanvasTexture(cv);
    return t;
  }
  function makeSys(N, additive, tex) {
    const g = new THREE.InstancedBufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute([-1, -1, 0, 1, -1, 0, 1, 1, 0, -1, 1, 0], 3));
    g.setIndex([0, 1, 2, 0, 2, 3]);
    const A = {
      aP0: new THREE.InstancedBufferAttribute(new Float32Array(N * 3), 3),
      aV: new THREE.InstancedBufferAttribute(new Float32Array(N * 3), 3),
      aT: new THREE.InstancedBufferAttribute(new Float32Array(N * 4), 4),
      aC0: new THREE.InstancedBufferAttribute(new Float32Array(N * 3), 3),
      aC1: new THREE.InstancedBufferAttribute(new Float32Array(N * 3), 3),
      aX: new THREE.InstancedBufferAttribute(new Float32Array(N * 4), 4),
    };
    for (let i = 0; i < N; i++) A.aT.array[i * 4] = -99;
    for (const k in A) {
      A[k].setUsage(THREE.DynamicDrawUsage);
      g.setAttribute(k, A[k]);
    }
    g.instanceCount = N;
    const m = new THREE.ShaderMaterial({
      uniforms: { uTime: { value: 0 }, uTex: { value: tex } },
      vertexShader: PVS, fragmentShader: additive ? PFS_ADD : PFS_ALPHA,
      transparent: true, depthWrite: false, blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
    });
    const mesh = new THREE.Mesh(g, m);
    mesh.frustumCulled = false;
    mesh.renderOrder = additive ? 6 : 5;
    R3.scene.add(mesh);
    return { mesh, g, m, A, N, next: 0, lo: 1e9, hi: -1, until: 0 };
  }
  let ADD = null, ALP = null;
  // x,h,z — мир; v — скорость; life; s0→s1 размер; c0→c1 цвет; grav (м/с², отрицательная — всплывает); alpha; spin
  const emit = (Sy, x, h, z, vx, vy, vz, life, s0, s1, c0, c1, grav, alpha, spin) => {
    const i = Sy.next;
    Sy.next = (i + 1) % Sy.N;
    const A = Sy.A;
    let j = i * 3;
    A.aP0.array[j] = x; A.aP0.array[j + 1] = h; A.aP0.array[j + 2] = z;
    A.aV.array[j] = vx; A.aV.array[j + 1] = vy; A.aV.array[j + 2] = vz;
    A.aC0.array[j] = c0.r; A.aC0.array[j + 1] = c0.g; A.aC0.array[j + 2] = c0.b;
    A.aC1.array[j] = c1.r; A.aC1.array[j + 1] = c1.g; A.aC1.array[j + 2] = c1.b;
    j = i * 4;
    A.aT.array[j] = Pw.simT; A.aT.array[j + 1] = life; A.aT.array[j + 2] = s0; A.aT.array[j + 3] = s1;
    A.aX.array[j] = grav; A.aX.array[j + 1] = alpha; A.aX.array[j + 2] = rnd() * TAU; A.aX.array[j + 3] = spin;
    if (i < Sy.lo) Sy.lo = i;
    if (i > Sy.hi) Sy.hi = i;
    if (Pw.simT + life > Sy.until) Sy.until = Pw.simT + life;
  };
  const flushSys = (Sy) => {
    Sy.m.uniforms.uTime.value = Pw.simT;
    Sy.mesh.visible = Sy.until > Pw.simT;
    if (Sy.hi < 0) return;
    for (const k in Sy.A) {
      const a = Sy.A[k];
      a.updateRange.offset = Sy.lo * a.itemSize;
      a.updateRange.count = (Sy.hi - Sy.lo + 1) * a.itemSize;
      a.needsUpdate = true;
    }
    Sy.lo = 1e9;
    Sy.hi = -1;
  };
  const q = () => (J.Fx ? J.Fx.q : 1);
  const cnt = (n) => (q() < 1 ? Math.ceil(n * 0.5) : n);
  // Огонь: языки пламени (желто-белые → тёмно-красные), всплывают, плюс дым над ними
  const FIRE0 = new THREE.Color(1.0, 0.6, 0.2), FIRE1 = new THREE.Color(0.42, 0.05, 0.01), SMK0 = new THREE.Color(0.16, 0.13, 0.12), SMK1 = new THREE.Color(0.32, 0.3, 0.3);
  Pw.fire = function (x, h, z, n, spread, up, size, vx, vz) {
    if (!ADD) return;
    n = cnt(n);
    const s = size || 0.5;
    for (let i = 0; i < n; i++) {
      const a = rnd() * TAU, r = rnd() * (spread || 0.3);
      const sp = (spread || 0.3) * 1.2;
      emit(ADD, x + Math.cos(a) * r, h + rnd() * 0.15, z + Math.sin(a) * r, (vx || 0) + Math.cos(a) * sp * rnd(), (up || 1.6) * (0.6 + rnd() * 0.7), (vz || 0) + Math.sin(a) * sp * rnd(), 0.35 + rnd() * 0.4, s * (0.6 + rnd() * 0.5), s * (0.15 + rnd() * 0.2), FIRE0, FIRE1, -2.5, 0.75, (rnd() - 0.5) * 3);
      if (i % 3 === 0) emit(ALP, x + Math.cos(a) * r, h + 0.4 + rnd() * 0.3, z + Math.sin(a) * r, (vx || 0) * 0.3, (up || 1.6) * 0.7, (vz || 0) * 0.3, 0.9 + rnd() * 0.8, s * 0.5, s * 1.8, SMK0, SMK1, -0.8, 0.45, (rnd() - 0.5) * 1.5);
    }
  };
  // Дым / пыль / туман: цвет, размер, время
  Pw.smoke = function (x, h, z, n, color, size, life, up, spread, alpha) {
    if (!ALP) return;
    n = cnt(n);
    C.copy(col(color));
    C2.copy(C).multiplyScalar(1.15);
    const s = size || 0.6, sp = spread === undefined ? 0.6 : spread;
    for (let i = 0; i < n; i++) {
      const a = rnd() * TAU, r = rnd() * sp;
      emit(ALP, x + Math.cos(a) * r, h + rnd() * 0.2, z + Math.sin(a) * r, Math.cos(a) * sp * 0.8 * rnd(), (up === undefined ? 0.5 : up) * (0.5 + rnd()), Math.sin(a) * sp * 0.8 * rnd(), (life || 1.2) * (0.7 + rnd() * 0.6), s * 0.6, s * 1.6, C, C2, -0.2, alpha === undefined ? 0.55 : alpha, (rnd() - 0.5) * 1.2);
    }
  };
  // Искры энергии / блёстки (аддитивно, один цвет → темнее)
  Pw.glow = function (x, h, z, n, color, spd, size, life, grav, spread) {
    if (!ADD) return;
    n = cnt(n);
    C.copy(col(color));
    C2.copy(C).multiplyScalar(0.35);
    const sp = spd === undefined ? 2 : spd, s = size || 0.12, sr = spread || 0;
    for (let i = 0; i < n; i++) {
      const a = rnd() * TAU, e = (rnd() - 0.3) * 1.6;
      const v = sp * (0.4 + rnd() * 0.8);
      emit(ADD, x + (rnd() - 0.5) * sr, h + (rnd() - 0.5) * sr, z + (rnd() - 0.5) * sr, Math.cos(a) * Math.cos(e) * v, Math.sin(e) * v, Math.sin(a) * Math.cos(e) * v, (life || 0.5) * (0.6 + rnd() * 0.8), s, s * 0.3, C, C2, grav === undefined ? 1 : grav, 1, (rnd() - 0.5) * 4);
    }
  };
  // Одна частица с заданной скоростью (следы снарядов, потоки)
  Pw.puff = function (x, h, z, vx, vy, vz, life, s0, s1, c0, c1, grav, alpha, additive) {
    const Sy = additive === false ? ALP : ADD;
    if (!Sy) return;
    C.copy(col(c0));
    C2.copy(c1 ? col(c1) : C);
    emit(Sy, x, h, z, vx, vy, vz, life, s0, s1, C, C2, grav || 0, alpha === undefined ? 1 : alpha, (rnd() - 0.5) * 3);
  };
  // Кровь: тёмные капли с силой тяжести
  Pw.blood = function (x, h, z, n, ang, spd) {
    if (!ALP) return;
    n = cnt(n);
    C.set('#7a0a12');
    C2.set('#3a0408');
    for (let i = 0; i < n; i++) {
      const a = ang === undefined || ang === null ? rnd() * TAU : ang + (rnd() - 0.5) * 1.2;
      const v = (spd || 3) * (0.4 + rnd() * 0.8);
      emit(ALP, x, h, z, Math.cos(a) * v, 1 + rnd() * 2.5, Math.sin(a) * v, 0.5 + rnd() * 0.4, 0.06 + rnd() * 0.06, 0.05, C, C2, 9, 0.95, 0);
    }
  };

  // ---------- 2. Немедленные инстанс-меши (рисуются заново каждый кадр) ----------
  // emissive от цвета инстанса: светящиеся изумруды, лёд, лозы
  const glowPatch = (m, k) => {
    m.userData.glowK = { value: k };
    m.onBeforeCompile = (sh) => {
      sh.uniforms.uGlowK = m.userData.glowK;
      sh.fragmentShader = 'uniform float uGlowK;\n' + sh.fragmentShader.replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n#ifdef USE_COLOR\ntotalEmissiveRadiance += vColor * uGlowK;\n#endif');
    };
    m.customProgramCacheKey = () => 'pwglow' + k;
    return m;
  };
  // мягкая светящаяся трубка (молнии, огненные путы, ядро луча): яркая в центре, тает к краям
  const GSEG_VS = `
    varying vec3 vC; varying float vE; varying float vL;
    void main() {
      vec4 wp = instanceMatrix * vec4(position, 1.0);
      vec3 n = normalize(normalMatrix * mat3(instanceMatrix) * normal);
      vec4 mv = modelViewMatrix * wp;
      vE = abs(dot(n, normalize(-mv.xyz)));
      vL = position.y;
      #ifdef USE_INSTANCING_COLOR
        vC = instanceColor;
      #else
        vC = vec3(1.0);
      #endif
      gl_Position = projectionMatrix * mv;
    }`;
  const GSEG_FS = `
    uniform float uTime; varying vec3 vC; varying float vE; varying float vL;
    void main() {
      float core = pow(vE, 2.2);
      float fl = 0.8 + 0.2 * sin(vL * 18.0 - uTime * 30.0);
      gl_FragColor = vec4(vC * core * fl + vec3(1.0) * pow(vE, 9.0) * 0.6, 1.0);
    }`;
  const IM = {};
  function makeIM(name, geo, mat, N) {
    const m = new THREE.InstancedMesh(geo, mat, N);
    m.frustumCulled = false;
    m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    for (let i = 0; i < N; i++) m.setColorAt(i, C.setRGB(1, 1, 1));
    m.instanceColor.setUsage(THREE.DynamicDrawUsage);
    m.count = 0;
    m.castShadow = false;
    R3.scene.add(m);
    IM[name] = { m, n: 0, N };
    return IM[name];
  }
  const put = (im, c) => {
    if (im.n >= im.N) return false;
    im.m.setMatrixAt(im.n, M);
    im.m.setColorAt(im.n, c);
    im.n++;
    return true;
  };
  // Сегмент от A до B (мировые x, h, z), радиус r
  const segM = (ax, ah, az, bx, bh, bz, r) => {
    V1.set(bx - ax, bh - ah, bz - az);
    const L = V1.length();
    if (L < 1e-4) return false;
    V1.multiplyScalar(1 / L);
    Q.setFromUnitVectors(UP, V1);
    P.set((ax + bx) / 2, (ah + bh) / 2, (az + bz) / 2);
    S.set(r, L, r);
    M.compose(P, Q, S);
    return true;
  };
  Pw.seg = function (ax, ah, az, bx, bh, bz, r, color) {
    if (IM.seg && segM(ax, ah, az, bx, bh, bz, r)) put(IM.seg, col(color));
  };
  Pw.gseg = function (ax, ah, az, bx, bh, bz, r, color) {
    if (IM.gseg && segM(ax, ah, az, bx, bh, bz, r)) put(IM.gseg, col(color));
  };
  // Шип (конус) от основания по направлению (dx, dh, dz) длиной L
  Pw.spike = function (x, h, z, dx, dh, dz, L, r, color) {
    if (!IM.spike) return;
    V1.set(dx, dh, dz).normalize();
    Q.setFromUnitVectors(UP, V1);
    P.set(x + V1.x * L * 0.5, h + V1.y * L * 0.5, z + V1.z * L * 0.5);
    S.set(r, L, r);
    M.compose(P, Q, S);
    put(IM.spike, col(color));
  };
  Pw.gem = function (x, h, z, s, color, rx, ry, sy) {
    if (!IM.gem) return;
    E.set(rx || 0, ry || 0, 0);
    Q.setFromEuler(E);
    P.set(x, h, z);
    S.set(s, s * (sy || 1.6), s);
    M.compose(P, Q, S);
    put(IM.gem, col(color));
  };
  Pw.box = function (x, h, z, sx, sy, sz, color, rx, ry, rz) {
    if (!IM.box) return;
    E.set(rx || 0, ry || 0, rz || 0);
    Q.setFromEuler(E);
    P.set(x, h, z);
    S.set(sx, sy, sz);
    M.compose(P, Q, S);
    put(IM.box, col(color));
  };
  // Цепочка по точкам pts [x,h,z, x,h,z, ...] (n точек)
  Pw.chain = function (pts, n, r, color, glow, rEnd) {
    for (let i = 0; i < n - 1; i++) {
      const a = i * 3, b = a + 3;
      const rr = rEnd === undefined ? r : r + (rEnd - r) * (i / Math.max(1, n - 2));
      if (glow) Pw.gseg(pts[a], pts[a + 1], pts[a + 2], pts[b], pts[b + 1], pts[b + 2], rr, color);
      else Pw.seg(pts[a], pts[a + 1], pts[a + 2], pts[b], pts[b + 1], pts[b + 2], rr, color);
    }
  };
  // Ломаная молния между двумя точками (каждый кадр — новая форма)
  const BOLT = new Float32Array(64 * 3);
  Pw.bolt = function (ax, ah, az, bx, bh, bz, color, jag, r, n) {
    n = Math.min(60, n || Math.max(4, Math.round(Math.hypot(bx - ax, bh - ah, bz - az) * 2.2)));
    const j = jag === undefined ? 0.35 : jag;
    for (let i = 0; i <= n; i++) {
      const k = i / n;
      const e = i === 0 || i === n ? 0 : j * Math.sin(k * Math.PI);
      BOLT[i * 3] = ax + (bx - ax) * k + (rnd() - 0.5) * e * 2;
      BOLT[i * 3 + 1] = ah + (bh - ah) * k + (rnd() - 0.5) * e * 2;
      BOLT[i * 3 + 2] = az + (bz - az) * k + (rnd() - 0.5) * e * 2;
    }
    Pw.chain(BOLT, n + 1, r || 0.06, color || '#cfe6ff', true);
    // тонкая белая сердцевина
    for (let i = 0; i < n; i++) Pw.gseg(BOLT[i * 3], BOLT[i * 3 + 1], BOLT[i * 3 + 2], BOLT[i * 3 + 3], BOLT[i * 3 + 4], BOLT[i * 3 + 5], (r || 0.06) * 0.35, '#ffffff');
  };
  // Кольцо из сегментов на высоте h (горизонтальное) — обвивающие путы, обручи
  Pw.hoop = function (x, h, z, rad, r, color, glow, n, tilt) {
    n = n || 12;
    const t = tilt || 0;
    for (let i = 0; i < n; i++) {
      const a0 = (i / n) * TAU, a1 = ((i + 1) / n) * TAU;
      const f = glow ? Pw.gseg : Pw.seg;
      f(x + Math.cos(a0) * rad, h + Math.sin(a0) * t, z + Math.sin(a0) * rad, x + Math.cos(a1) * rad, h + Math.sin(a1) * t, z + Math.sin(a1) * rad, r, color);
    }
  };

  // ---------- 3. Наземные следы ----------
  const DEC = [];
  const DTEX = {};
  function decalTex(kind) {
    const cv = document.createElement('canvas');
    cv.width = cv.height = 128;
    const c = cv.getContext('2d');
    const R = J.rng(kind.length * 97 + 3);
    c.translate(64, 64);
    const blob = (r, inner, outer) => {
      const g = c.createRadialGradient(0, 0, 0, 0, 0, r);
      g.addColorStop(0, inner);
      g.addColorStop(1, outer);
      c.fillStyle = g;
      c.beginPath();
      for (let i = 0; i <= 24; i++) {
        const a = (i / 24) * TAU, rr = r * (0.75 + R() * 0.25);
        c.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
      }
      c.fill();
    };
    const cracks = (n, w, colr) => {
      c.strokeStyle = colr;
      for (let i = 0; i < n; i++) {
        let a = (i / n) * TAU + R() * 0.5, r = 6;
        c.lineWidth = w;
        c.beginPath();
        c.moveTo(Math.cos(a) * r, Math.sin(a) * r);
        while (r < 60) {
          r += 6 + R() * 10;
          a += (R() - 0.5) * 0.6;
          c.lineTo(Math.cos(a) * r, Math.sin(a) * r);
        }
        c.stroke();
      }
    };
    if (kind === 'scorch') {
      blob(62, 'rgba(10,6,4,0.95)', 'rgba(20,12,8,0)');
      blob(30, 'rgba(0,0,0,0.9)', 'rgba(30,14,6,0.4)');
      for (let i = 0; i < 30; i++) {
        c.fillStyle = 'rgba(255,' + (90 + R() * 80) + ',20,' + (0.3 + R() * 0.5) + ')';
        const a = R() * TAU, r = R() * 36;
        c.fillRect(Math.cos(a) * r, Math.sin(a) * r, 2, 2);
      }
    } else if (kind === 'frost') {
      blob(62, 'rgba(230,248,255,0.9)', 'rgba(180,225,255,0)');
      cracks(14, 2, 'rgba(255,255,255,0.9)');
    } else if (kind === 'crater') {
      blob(58, 'rgba(30,24,20,0.85)', 'rgba(60,50,40,0)');
      cracks(12, 4, 'rgba(15,10,8,0.95)');
    } else if (kind === 'mold') {
      for (let i = 0; i < 40; i++) {
        const a = R() * TAU, r = R() * 50, rr = 4 + R() * 10;
        const g = c.createRadialGradient(Math.cos(a) * r, Math.sin(a) * r, 0, Math.cos(a) * r, Math.sin(a) * r, rr);
        g.addColorStop(0, 'rgba(120,190,60,0.9)');
        g.addColorStop(1, 'rgba(60,110,30,0)');
        c.fillStyle = g;
        c.fillRect(-64, -64, 128, 128);
      }
    } else if (kind === 'blood') {
      blob(40, 'rgba(110,8,16,0.95)', 'rgba(70,4,10,0)');
      for (let i = 0; i < 16; i++) {
        c.fillStyle = 'rgba(100,6,14,0.9)';
        const a = R() * TAU, r = 30 + R() * 28;
        c.beginPath();
        c.arc(Math.cos(a) * r, Math.sin(a) * r, 2 + R() * 4, 0, TAU);
        c.fill();
      }
    } else if (kind === 'water') {
      blob(60, 'rgba(120,170,220,0.6)', 'rgba(120,170,220,0)');
    } else if (kind === 'void') {
      blob(62, 'rgba(0,0,0,0.98)', 'rgba(60,20,90,0)');
      blob(36, 'rgba(0,0,0,1)', 'rgba(0,0,0,0.9)');
    } else if (kind === 'sand') {
      blob(62, 'rgba(210,180,120,0.9)', 'rgba(210,180,120,0)');
    } else if (kind === 'virus') {
      for (let i = 0; i < 36; i++) {
        const a = R() * TAU, r = R() * 50, rr = 5 + R() * 12;
        const g = c.createRadialGradient(Math.cos(a) * r, Math.sin(a) * r, 0, Math.cos(a) * r, Math.sin(a) * r, rr);
        g.addColorStop(0, 'rgba(170,80,230,0.85)');
        g.addColorStop(1, 'rgba(90,30,140,0)');
        c.fillStyle = g;
        c.fillRect(-64, -64, 128, 128);
      }
    } else if (kind === 'gold') {
      blob(62, 'rgba(255,220,90,0.7)', 'rgba(255,200,60,0)');
      cracks(10, 2, 'rgba(255,250,200,0.8)');
    }
    return new THREE.CanvasTexture(cv);
  }
  const decGeo = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
  Pw.decal = function (kind, x, y, size, life, additive) {
    if (!DEC.length) return;
    if (!DTEX[kind]) DTEX[kind] = decalTex(kind);
    let d = null;
    for (const o of DEC) if (o.life <= 0) { d = o; break; }
    if (!d) {
      d = DEC[0];
      for (const o of DEC) if (o.life < d.life) d = o;
    }
    const m = d.m.material;
    if (m.map !== DTEX[kind]) {
      m.map = DTEX[kind];
      m.needsUpdate = true;
    }
    const add = !!additive;
    if ((m.blending === THREE.AdditiveBlending) !== add) {
      m.blending = add ? THREE.AdditiveBlending : THREE.NormalBlending;
      m.needsUpdate = true;
    }
    d.m.position.set(x, gy(x, y) + 0.04 + DEC.indexOf(d) * 0.002, y);
    d.m.rotation.y = rnd() * TAU;
    d.size = size;
    d.m.scale.set(size * 0.4, 1, size * 0.4);
    d.life = d.max = life || 8;
    d.grow = 0;
    m.opacity = 1;
    d.m.visible = true;
    return d;
  };
  function updateDecals(dt) {
    for (const d of DEC) {
      if (d.life <= 0) continue;
      d.life -= dt;
      if (d.grow < 1) {
        d.grow = Math.min(1, d.grow + dt * 6);
        const s = d.size * (0.4 + 0.6 * d.grow);
        d.m.scale.set(s, 1, s);
      }
      if (d.life <= 0) d.m.visible = false;
      else if (d.life < 1.5) d.m.material.opacity = d.life / 1.5;
    }
  }

  // ---------- 4. Свет от огня и взрывов ----------
  const LIGHTS = [];
  Pw.preInit = function () {
    // свет добавляется до прогрева шейдеров: число источников не меняется в игре (без перекомпиляции)
    for (let i = 0; i < 2; i++) {
      const l = new THREE.PointLight('#ff9a3a', 0, 9, 1.6);
      l.position.set(0, -50, 0);
      R3.scene.add(l);
      LIGHTS.push({ l, t: 0, max: 1, I: 0 });
    }
  };
  Pw.light = function (x, h, z, color, I, dist, life) {
    if (!LIGHTS.length) return;
    let o = LIGHTS[0];
    for (const L of LIGHTS) if (L.t <= 0 || L.I * (L.t / L.max) < o.I * (o.t / o.max)) o = L;
    o.l.position.set(x, h, z);
    o.l.color.copy(col(color));
    o.l.distance = dist || 9;
    o.I = I;
    o.t = o.max = life || 0.3;
  };
  function updateLights(dt) {
    for (const L of LIGHTS) {
      if (L.t <= 0) {
        if (L.l.intensity !== 0) L.l.intensity = 0;
        continue;
      }
      L.t -= dt;
      const k = Math.max(0, L.t / L.max);
      L.l.intensity = L.I * k * (0.85 + rnd() * 0.15);
    }
  }

  // ---------- 5. Остаточные силуэты (послеобразы) ----------
  const GH_VS = `
    varying float vE;
    void main() {
      vec4 mv = modelViewMatrix * vec4(position, 1.0);
      vec3 n = normalize(normalMatrix * normal);
      vE = 1.0 - abs(dot(n, normalize(-mv.xyz)));
      gl_Position = projectionMatrix * mv;
    }`;
  const GH_FS = `
    uniform vec3 uC; uniform float uA; varying float vE;
    void main() { gl_FragColor = vec4(uC * (0.18 + pow(vE, 1.6) * 1.2) * uA, 1.0); }`;
  const GHM = [];
  const GHOSTS = [];
  Pw.ghost = function (view, color, life) {
    if (!view || !view.group || !GHM.length || !view.group.visible) return;
    const life0 = life || 0.4;
    const list = GH_LIST;
    list.length = 0;
    // хватит ли свободных мешей на весь силуэт (половинчатый призрак хуже, чем никакого)
    let free = 0;
    for (const g of GHM) if (!g.busy) free++;
    if (free < 12) return;
    view.group.updateMatrixWorld(true);
    view.group.traverse((o) => {
      if (!o.isMesh || !o.visible || list.length >= 14) return;
      let m = null;
      for (const g of GHM) if (!g.busy) { m = g; break; }
      if (!m) return;
      m.busy = true;
      m.mesh.geometry = o.geometry;
      m.mesh.matrix.copy(o.matrixWorld);
      m.mesh.matrixWorldNeedsUpdate = true;
      m.mat.uniforms.uC.value.copy(col(color));
      m.mat.uniforms.uA.value = 1;
      m.mesh.visible = true;
      list.push(m);
    });
    if (list.length) GHOSTS.push({ list: list.slice(), t: life0, max: life0 });
  };
  const GH_LIST = [];
  function updateGhosts(dt) {
    let j = 0;
    for (const g of GHOSTS) {
      g.t -= dt;
      const k = Math.max(0, g.t / g.max);
      for (const m of g.list) {
        m.mat.uniforms.uA.value = k * k;
        if (g.t <= 0) {
          m.busy = false;
          m.mesh.visible = false;
          m.mesh.geometry = GH_DUMMY;
        }
      }
      if (g.t > 0) GHOSTS[j++] = g;
    }
    GHOSTS.length = j;
  }
  const GH_DUMMY = new THREE.BufferGeometry();

  // ---------- 6. Звуковые слова Эха и надписи в мире (спрайты) ----------
  const SPR = [];
  const STEX = {};
  function wordTex(word, color, stroke) {
    const k = word + color;
    if (STEX[k]) return STEX[k];
    const cv = document.createElement('canvas');
    cv.width = 256;
    cv.height = 128;
    const c = cv.getContext('2d');
    const FONT = 'px "Hiragino Kaku Gothic Pro", "Noto Sans JP", "Yu Gothic", Impact, sans-serif';
    let fs = 84;
    c.font = '900 ' + fs + FONT;
    // длинное слово ужимается, чтобы целиком влезть в холст (иначе края обрезаны)
    const w0 = c.measureText(word).width + 16;
    if (w0 > 240) {
      fs = Math.max(20, Math.floor((fs * 240) / w0));
      c.font = '900 ' + fs + FONT;
    }
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.lineJoin = 'round';
    c.lineWidth = 14;
    c.strokeStyle = stroke || '#1a0a2a';
    c.strokeText(word, 128, 66);
    c.fillStyle = color || '#ffe14a';
    c.fillText(word, 128, 66);
    const t = new THREE.CanvasTexture(cv);
    STEX[k] = t;
    return t;
  }
  Pw.wordSprite = function (word, color, stroke) {
    let s = null;
    for (const o of SPR) if (!o.busy) { s = o; break; }
    if (!s) return null;
    s.busy = true;
    const t = wordTex(word, color, stroke);
    if (s.sp.material.map !== t) {
      s.sp.material.map = t;
      s.sp.material.needsUpdate = true;
    }
    s.sp.material.opacity = 1;
    s.sp.material.rotation = 0;
    s.sp.visible = true;
    return s;
  };
  Pw.freeSprite = function (s) {
    if (!s) return;
    s.busy = false;
    s.trap = false;
    s.sp.visible = false;
  };

  // ---------- 7. Аура стенда и контурный свет ----------
  // Контур: свет по краю силуэта цветом стенда, светящиеся глаза и вставки (белые вершины), вспышка при применении силы
  R3.standPatch = function (mat, c1, c2) {
    const U = { uRimC: { value: new THREE.Color(c1).lerp(new THREE.Color(c2), 0.35).multiplyScalar(1.1) }, uRimK: { value: 0.5 } };
    mat.userData.rim = U;
    mat.onBeforeCompile = (sh) => {
      sh.uniforms.uRimC = U.uRimC;
      sh.uniforms.uRimK = U.uRimK;
      sh.vertexShader = 'varying float vRim;\n' + sh.vertexShader.replace('#include <project_vertex>', '#include <project_vertex>\nvRim = 1.0 - abs(dot(normalize(transformedNormal), normalize(-mvPosition.xyz)));');
      sh.fragmentShader = 'uniform vec3 uRimC; uniform float uRimK; varying float vRim;\n' + sh.fragmentShader.replace('#include <dithering_fragment>', 'gl_FragColor.rgb += uRimC * pow(vRim, 2.2) * uRimK;\n#ifdef USE_COLOR\nif (vColor.r + vColor.g + vColor.b > 2.85) gl_FragColor.rgb += vColor * 0.9;\n#endif\n#include <dithering_fragment>');
    };
    mat.customProgramCacheKey = () => 'standrim';
    // гладкие грани: сглаженное освещение уже по вершинам; чуть сильнее собственное свечение
    mat.emissiveIntensity = 1.15;
  };
  const AURA_VS = `
    uniform float uS; varying vec2 vUv;
    void main() {
      vUv = position.xy * 0.5 + 0.5;
      vec4 mv = modelViewMatrix * vec4(0.0, 1.05, -0.05, 1.0);
      mv.xy += position.xy * vec2(0.62, 1.0) * uS;
      gl_Position = projectionMatrix * mv;
    }`;
  // шум — из маленькой текстуры (дешевле, чем считать хэши в каждом пикселе)
  const AURA_FS = `
    uniform float uT; uniform vec3 uC1; uniform vec3 uC2; uniform float uA; uniform sampler2D uN; varying vec2 vUv;
    void main() {
      vec2 p = vUv * 2.0 - 1.0;
      float body = 1.0 - length(p * vec2(1.05, 0.82));
      if (body < -0.3) discard;
      float fl = texture2D(uN, vec2(vUv.x * 0.6, vUv.y * 0.4 - uT * 0.25)).r * 0.62 + texture2D(uN, vec2(vUv.x * 1.4 + 0.3, vUv.y * 1.0 - uT * 0.45)).g * 0.38;
      // языки пламени тянутся вверх, к краям — на нет (без видимой границы)
      float rise = texture2D(uN, vec2(vUv.x * 0.9 + 0.6, vUv.y * 0.35 - uT * 0.35)).b;
      float a = body + (fl - 0.5) * 0.7 + (rise - 0.5) * 0.5 * vUv.y;
      a = smoothstep(0.0, 0.7, a);
      a *= a;
      a *= 1.0 - smoothstep(0.7, 0.98, vUv.y);
      vec3 c = mix(uC1, uC2, fl * 0.7) * a;
      gl_FragColor = vec4(c * uA, 1.0);
    }`;
  const auraGeo = new THREE.PlaneGeometry(2, 2);
  // плавный шум в трёх каналах (повторяется по краям)
  let NTEX = null;
  function noiseTex() {
    if (NTEX) return NTEX;
    const N = 64;
    const cv = document.createElement('canvas');
    cv.width = cv.height = N;
    const c = cv.getContext('2d');
    const id = c.createImageData(N, N);
    const R = J.rng(5);
    const grid = (g) => {
      const v = [];
      for (let i = 0; i < g * g; i++) v.push(R());
      return (x, y) => {
        const fx = (x / N) * g, fy = (y / N) * g;
        const ix = Math.floor(fx), iy = Math.floor(fy);
        let tx = fx - ix, ty = fy - iy;
        tx = tx * tx * (3 - 2 * tx);
        ty = ty * ty * (3 - 2 * ty);
        const at = (a, b) => v[((b + g) % g) * g + ((a + g) % g)];
        return (at(ix, iy) * (1 - tx) + at(ix + 1, iy) * tx) * (1 - ty) + (at(ix, iy + 1) * (1 - tx) + at(ix + 1, iy + 1) * tx) * ty;
      };
    };
    const ch = [grid(5), grid(9), grid(6)], ch2 = [grid(13), grid(17), grid(11)];
    for (let y = 0; y < N; y++)
      for (let x = 0; x < N; x++) {
        const i = (y * N + x) * 4;
        for (let k = 0; k < 3; k++) id.data[i + k] = Math.round((ch[k](x, y) * 0.7 + ch2[k](x, y) * 0.3) * 255);
        id.data[i + 3] = 255;
      }
    c.putImageData(id, 0, 0);
    NTEX = new THREE.CanvasTexture(cv);
    NTEX.wrapS = NTEX.wrapT = THREE.RepeatWrapping;
    return NTEX;
  }
  // вызывается из R3.updateView после того, как стенд поставлен на место
  Pw.standFx = function (e, sv, attacking, dt) {
    const sd = J.STANDS[e.stand.id];
    if (!sv.aura && sv.kind === 'human') {
      const m = new THREE.ShaderMaterial({
        uniforms: { uT: { value: rnd() * 10 }, uC1: { value: new THREE.Color(sd.c1) }, uC2: { value: new THREE.Color(sd.c2) }, uA: { value: 0 }, uS: { value: 1 }, uN: { value: noiseTex() } },
        vertexShader: AURA_VS, fragmentShader: AURA_FS, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      });
      const a = new THREE.Mesh(auraGeo, m);
      a.frustumCulled = false;
      a.renderOrder = -1;
      sv.group.add(a);
      sv.mats.push(m);
      sv.aura = a;
      sv.surge = 0.6;
    }
    sv.surge = Math.max(0, (sv.surge || 0) - dt * 1.4);
    const fight = attacking || e.inCombat > 0 || e.guard;
    const far = e.isPlayer && R3.cam.near;
    if (sv.aura) {
      const dx = sv.pos.x - R3.camera.position.x, dz = sv.pos.z - R3.camera.position.z;
      sv.aura.visible = !Pw.noAura && dx * dx + dz * dz < 900;
    }
    if (sv.aura) {
      const U = sv.aura.material.uniforms;
      U.uT.value += dt;
      const want = (far ? 0.08 : fight ? 0.24 : 0.14) + sv.surge * 0.5;
      U.uA.value += (want - U.uA.value) * Math.min(1, dt * 6);
      U.uS.value = (1 + sv.surge * 0.35 + Math.sin(U.uT.value * 7) * 0.02) * (Pw.auraK === undefined ? 1 : Pw.auraK);
    }
    const rim = sv.mats[0] && sv.mats[0].userData.rim;
    if (rim) rim.uRimK.value = (fight ? 0.42 : 0.32) + sv.surge * 0.9;
    // послеобразы стенда (Колесница без доспехов, Мир на скорости, ускорение времени)
    if ((e.st.haste > 0 || e.st.heaven > 0) && (attacking || Math.hypot(e.vx || 0, e.vy || 0) > 1)) {
      sv.ghT = (sv.ghT || 0) - dt;
      if (sv.ghT <= 0) {
        sv.ghT = 0.07;
        Pw.ghost(sv, sd.c1, 0.32);
      }
    }
  };
  // вспышка силы на стенде (контур и аура разгораются)
  Pw.surge = function (u, k) {
    if (u && u.standView) u.standView.surge = Math.max(u.standView.surge || 0, k || 1);
  };
  // точка у кулака стенда (или у руки владельца)
  const HP = { x: 0, h: 0, z: 0 };
  Pw.hand = function (u, left) {
    const sv = u.standView && u.standView.group.visible ? u.standView : null;
    const v = sv && sv.foreR ? sv : u.view && u.view.foreR && u.view.group.visible ? u.view : null;
    if (v) {
      const f = left ? v.foreL : v.foreR;
      V2.set(0, -0.3, 0.03);
      f.localToWorld(V2);
      HP.x = V2.x;
      HP.h = V2.y;
      HP.z = V2.z;
      return HP;
    }
    const a = u.face || 0;
    HP.x = u.x + Math.cos(a) * 0.55;
    HP.z = u.y + Math.sin(a) * 0.55;
    HP.h = gy(u.x, u.y) + 1.3 + (u.z || 0);
    return HP;
  };
  // центр тела сущности
  const BP = { x: 0, h: 0, z: 0 };
  Pw.body = function (e, hk) {
    BP.x = e.x;
    BP.z = e.y;
    BP.h = gy(e.x, e.y) + (e.z || 0) + (hk === undefined ? 1.05 : hk) * (e.scale || 1);
    return BP;
  };

  // ---------- 8. Пулы старых эффектов R3 (кольцо, вспышка, луч, искры) — без new в каждом вызове ----------
  const RINGS = [], FLASH = [], BEAMS = [];
  const FL_VS = GH_VS;
  const FL_FS = `
    uniform vec3 uC; uniform float uA; varying float vE;
    void main() { float c = 1.0 - vE; gl_FragColor = vec4(uC * (pow(c, 1.4) * 1.1) * uA, 1.0); }`;
  function initLegacy() {
    const ringGeo = new THREE.RingGeometry(0.85, 1, 48).rotateX(-Math.PI / 2);
    for (let i = 0; i < 16; i++) {
      const m = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.9, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending }));
      m.visible = false;
      m.frustumCulled = false;
      R3.fxGroup.add(m);
      RINGS.push({ m, life: 0, max: 1, r: 1 });
    }
    const sg = new THREE.SphereGeometry(1, 20, 14);
    for (let i = 0; i < 12; i++) {
      const mat = new THREE.ShaderMaterial({ uniforms: { uC: { value: new THREE.Color() }, uA: { value: 0 } }, vertexShader: FL_VS, fragmentShader: FL_FS, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
      const m = new THREE.Mesh(sg, mat);
      m.visible = false;
      m.frustumCulled = false;
      R3.fxGroup.add(m);
      FLASH.push({ m, life: 0, max: 1, r: 1 });
    }
    for (let i = 0; i < 24; i++) BEAMS.push({ t: 0, max: 1, x0: 0, y0: 0, x1: 0, y1: 0, h: 0, w: 0, c: new THREE.Color() });
    const oldest = (A) => {
      let o = A[0];
      for (const x of A) {
        if (x.life <= 0) return x;
        if (x.life < o.life) o = x;
      }
      return o;
    };
    R3.ring = function (x, y, radius, color, life = 0.45) {
      const o = oldest(RINGS);
      o.m.material.color.set(color);
      o.m.position.set(x, gy(x, y) + 0.15, y);
      o.life = o.max = life;
      o.r = radius;
      o.m.visible = true;
    };
    R3.flash = function (x, y, radius, color, life = 0.3, h = 1) {
      const o = oldest(FLASH);
      o.m.material.uniforms.uC.value.set(color);
      o.m.position.set(x, gy(x, y) + h, y);
      o.life = o.max = life;
      o.r = radius;
      o.m.visible = true;
    };
    R3.beam = function (x0, y0, x1, y1, width, color, life = 0.3) {
      let o = BEAMS[0];
      for (const b of BEAMS) {
        if (b.t <= 0) { o = b; break; }
        if (b.t < o.t) o = b;
      }
      o.x0 = x0; o.y0 = y0; o.x1 = x1; o.y1 = y1;
      o.h = gy(x0, y0) + 1.1;
      o.w = width;
      o.c.set(color);
      o.t = o.max = life;
    };
    R3.updateFx = function (dt) {
      for (const f of RINGS) {
        if (f.life <= 0) continue;
        f.life -= dt;
        if (f.life <= 0) {
          f.m.visible = false;
          continue;
        }
        const k = 1 - f.life / f.max;
        const s = 0.3 + f.r * (1 - (1 - k) * (1 - k));
        f.m.scale.set(s, 1, s);
        f.m.material.opacity = 0.85 * (1 - k);
      }
      for (const f of FLASH) {
        if (f.life <= 0) continue;
        f.life -= dt;
        if (f.life <= 0) {
          f.m.visible = false;
          continue;
        }
        const k = 1 - f.life / f.max;
        const s = f.r * (0.45 + 0.55 * Math.sqrt(k));
        f.m.scale.set(s, s, s);
        f.m.material.uniforms.uA.value = (1 - k) * (1 - k) * 1.2;
      }
    };
    // искры R3.burst/R3.aura — в общий буфер частиц (без объектов на каждую частицу)
    R3.burst = function (x, y, z, color, n = 10, spd = 3, life = 0.6, up = 2) {
      if (!ADD) return;
      n = cnt(Math.min(n, 40));
      C.copy(col(color));
      C2.copy(C).multiplyScalar(0.3);
      for (let i = 0; i < n; i++) {
        const a = rnd() * TAU, s = rnd() * spd;
        emit(ADD, x, z, y, Math.cos(a) * s, rnd() * up * 1.4, Math.sin(a) * s, life * (0.6 + rnd() * 0.6), 0.13, 0.04, C, C2, 4, 1, (rnd() - 0.5) * 4);
      }
    };
    R3.aura = function (x, y, z, color) {
      if (!ADD) return;
      C.copy(col(color));
      C2.copy(C).multiplyScalar(0.2);
      emit(ADD, x + (rnd() - 0.5) * 0.9, z + rnd() * 1.5, y + (rnd() - 0.5) * 0.9, 0, 1.2 + rnd(), 0, 0.7, 0.16, 0.05, C, C2, -1, 0.8, (rnd() - 0.5) * 3);
    };
    // старая система точек больше не наполняется — один раз очистить и не гонять буфер каждый кадр
    let cleared = false;
    R3.updateParticles = function () {
      if (cleared || !R3.points) return;
      cleared = true;
      R3.parts.length = 0;
      R3.points.visible = false;
    };
  }
  function drawBeams(dt) {
    for (const b of BEAMS) {
      if (b.t <= 0) continue;
      b.t -= dt;
      const k = Math.max(0, b.t / b.max);
      const w = b.w * (0.35 + 0.65 * k);
      C.copy(b.c).multiplyScalar(0.6 + 0.6 * k);
      Pw.gseg(b.x0, b.h, b.y0, b.x1, b.h, b.y1, w * 0.9, C);
      C.setRGB(k, k, k);
      Pw.gseg(b.x0, b.h, b.y0, b.x1, b.h, b.y1, w * 0.3, C);
    }
  }

  // ---------- 9. Осколки, кубики, обломки (короткая физика, рисуются немедленно) ----------
  const SH = [];
  for (let i = 0; i < 120; i++) SH.push({ t: 0, max: 1, x: 0, h: 0, z: 0, vx: 0, vh: 0, vz: 0, s: 0.1, f: 0, c: new THREE.Color(), rx: 0, ry: 0, w: 0, g: 9 });
  let shN = 0;
  // f: 0 кристалл, 1 кубик, 2 шип, 3 светящийся шарик
  Pw.shards = function (x, h, z, n, color, spd, size, form, ang, up, grav, life) {
    n = cnt(n);
    for (let i = 0; i < n; i++) {
      const o = SH[shN];
      shN = (shN + 1) % SH.length;
      const a = ang === undefined || ang === null ? rnd() * TAU : ang + (rnd() - 0.5) * 1.6;
      const v = (spd || 4) * (0.35 + rnd() * 0.8);
      o.x = x; o.h = h; o.z = z;
      o.vx = Math.cos(a) * v;
      o.vz = Math.sin(a) * v;
      o.vh = (up === undefined ? 2 : up) * (0.4 + rnd());
      o.s = (size || 0.08) * (0.6 + rnd() * 0.8);
      o.f = form || 0;
      o.c.copy(col(color));
      o.rx = rnd() * 6;
      o.ry = rnd() * 6;
      o.w = (rnd() - 0.5) * 16;
      o.g = grav === undefined ? 9 : grav;
      o.t = o.max = (life || 0.9) * (0.7 + rnd() * 0.5);
    }
  };
  function drawShards(dt) {
    for (const o of SH) {
      if (o.t <= 0) continue;
      o.t -= dt;
      o.vh -= o.g * dt;
      o.x += o.vx * dt;
      o.h += o.vh * dt;
      o.z += o.vz * dt;
      const g0 = gy(o.x, o.z) + o.s * 0.5;
      if (o.h < g0) {
        o.h = g0;
        o.vh *= -0.3;
        o.vx *= 0.6;
        o.vz *= 0.6;
        o.w *= 0.6;
      }
      o.rx += o.w * dt;
      o.ry += o.w * 0.7 * dt;
      const s = o.s * Math.min(1, (o.t / o.max) * 3);
      if (o.f === 1) Pw.box(o.x, o.h, o.z, s, s, s, o.c, o.rx, o.ry, 0);
      else if (o.f === 2) Pw.spike(o.x, o.h, o.z, Math.cos(o.rx), Math.sin(o.ry), Math.sin(o.rx), s * 3, s * 0.5, o.c);
      else if (o.f === 3) Pw.orb(o.x, o.h, o.z, s, o.c);
      else Pw.gem(o.x, o.h, o.z, s, o.c, o.rx, o.ry);
    }
  }
  Pw.orb = function (x, h, z, s, color) {
    if (!IM.orb) return;
    Q.identity();
    P.set(x, h, z);
    S.set(s, s, s);
    M.compose(P, Q, S);
    put(IM.orb, col(color));
  };
  Pw.sph = function (x, h, z, s, color, sy) {
    if (!IM.sph) return;
    Q.identity();
    P.set(x, h, z);
    S.set(s, s * (sy || 1), s);
    M.compose(P, Q, S);
    put(IM.sph, col(color));
  };

  // ---------- 10. Темы: попадание / взрыв / след в духе силы ----------
  const TH = {
    fire: '#ff7b1c', ice: '#bfe9ff', water: '#5ab3ff', elec: '#ffe14a', sand: '#d9b77a', poison: '#9ad94a', dark: '#5a3a7a', gold: '#ffd84a',
    sound: '#a6ff7e', metal: '#e9edf5', emerald: '#3dff8a', pink: '#ff9be6', blood: '#8a0a14', rock: '#8a7a6a', light: '#fff6d8', ink: '#2b2b33',
    wind: '#c8d8ff', cube: '#8fa0ff', string: '#7fe3e6', gravity: '#7dff9b', life: '#7ed957', bubble: '#e6f3ff', energy: '#ffffff',
  };
  Pw.TH = TH;
  const SHAPE_TH = { flame: 'fire', ankh: 'fire', hamon: 'gold', emerald: 'emerald', shard: 'pink', ice: 'ice', water: 'water', sound: 'sound', bullet: 'metal', knife: 'metal', blade: 'metal', nail: 'metal', needle: 'metal', arrow: 'metal', missile: 'fire', cube: 'cube', spiral: 'gold', bubble: 'bubble', ink: 'ink', orb: 'energy' };
  Pw.shapeTheme = (s) => SHAPE_TH[s] || 'energy';
  // взрыв/вспышка темы в точке (x, h, z мира), s — масштаб, color — свой цвет (для «энергии»)
  Pw.burst = function (th, x, h, z, s, ang, color) {
    if (!ADD) return;
    s = s || 1;
    const c = color || TH[th] || '#ffffff';
    switch (th) {
      case 'fire':
        Pw.fire(x, h - 0.2, z, 10 + 10 * s, 0.4 * s, 2.6 * s, 0.55 * s);
        Pw.glow(x, h, z, 8 * s, '#ffb03a', 5 * s, 0.09, 0.5, 6);
        Pw.light(x, h + 0.5, z, '#ff8a2a', 2.2 * s, 7 + 3 * s, 0.4 + 0.15 * s);
        if (s >= 1) Pw.decal('scorch', x, z, 1.6 * s, 10);
        break;
      case 'ice':
        Pw.shards(x, h, z, 8 * s, c, 4 * s, 0.09 * s, 0, ang);
        Pw.smoke(x, h - 0.3, z, 5 * s, '#e8f6ff', 0.5 * s, 0.9, 0.3, 0.4 * s, 0.4);
        Pw.glow(x, h, z, 6 * s, '#ffffff', 3 * s, 0.07, 0.4);
        if (s >= 1) Pw.decal('frost', x, z, 1.8 * s, 9);
        break;
      case 'water':
        for (let i = 0; i < cnt(10 * s); i++) {
          const a = ang === undefined || ang === null ? rnd() * TAU : ang + Math.PI + (rnd() - 0.5) * 2.4;
          const v = 1.5 + rnd() * 3 * s;
          Pw.puff(x, h, z, Math.cos(a) * v, 1 + rnd() * 3, Math.sin(a) * v, 0.5 + rnd() * 0.3, 0.07, 0.03, '#cfe8ff', '#5ab3ff', 9, 0.9, false);
        }
        Pw.smoke(x, h - 0.2, z, 4 * s, '#d8ecff', 0.4 * s, 0.6, 0.4, 0.3 * s, 0.35);
        if (s >= 1) Pw.decal('water', x, z, 1.4 * s, 6);
        break;
      case 'elec':
        Pw.zap(x, h, z, 0.25 + 0.15 * s, 1.2 * s, c);
        Pw.glow(x, h, z, 10 * s, '#fff6a8', 5 * s, 0.07, 0.3, 4);
        Pw.light(x, h + 0.4, z, '#cfe2ff', 2.6 * s, 8, 0.18);
        break;
      case 'sand':
      case 'rock':
        Pw.smoke(x, h - 0.4, z, 10 * s, th === 'sand' ? '#d9b77a' : '#9a8c7a', 0.7 * s, 1.3, 0.8, 0.6 * s, 0.6);
        if (fxOn()) J.Fx.debris(x, h - 0.2, z, 0, 0, Math.round(10 * s), th === 'sand' ? '#c9a46b' : '#7a6e60');
        break;
      case 'poison':
        Pw.smoke(x, h - 0.3, z, 8 * s, c, 0.7 * s, 1.6, 0.4, 0.5 * s, 0.5);
        Pw.glow(x, h, z, 6 * s, c, 1.5, 0.08, 0.8, -1);
        break;
      case 'dark':
        Pw.smoke(x, h - 0.3, z, 8 * s, '#160a22', 0.6 * s, 1, 0.6, 0.5 * s, 0.75);
        Pw.glow(x, h, z, 8 * s, c, 3 * s, 0.1, 0.5, 0);
        break;
      case 'gold':
      case 'life':
      case 'light':
        Pw.glow(x, h, z, 14 * s, c, 3.5 * s, 0.11, 0.6, th === 'life' ? -1.5 : 1);
        Pw.light(x, h + 0.3, z, c, 1.6 * s, 7, 0.25);
        break;
      case 'sound':
        Pw.wordBurst(x, z, h, ['ドゴォン', 'ボヨヨン', 'ドジュウ', 'バァン'][(rnd() * 4) | 0], c);
        R3.ring(x, z, 1.4 * s, c, 0.4);
        break;
      case 'metal':
        if (fxOn()) J.Fx.sparks(x, h, z, Math.round(8 * s), ang === undefined ? null : ang + Math.PI, '#ffe9a8', 6);
        break;
      case 'emerald':
        Pw.shards(x, h, z, 6 * s, '#3dff8a', 3.5 * s, 0.07, 0, ang);
        Pw.glow(x, h, z, 8 * s, '#7dffb0', 3 * s, 0.09, 0.4);
        break;
      case 'pink':
        Pw.shards(x, h, z, 6 * s, c, 3 * s, 0.07, 0, ang);
        Pw.glow(x, h, z, 8 * s, c, 3 * s, 0.09, 0.45);
        break;
      case 'blood':
        Pw.blood(x, h, z, 12 * s, ang, 3 * s);
        if (s >= 1) Pw.decal('blood', x, z, 1.2, 12);
        break;
      case 'ink':
        Pw.smoke(x, h, z, 6 * s, '#1a1a22', 0.3 * s, 0.7, 0.2, 0.3, 0.85);
        break;
      case 'cube':
        Pw.shards(x, h, z, 10 * s, c, 3.5 * s, 0.09, 1, ang);
        break;
      case 'bubble':
        Pw.glow(x, h, z, 8 * s, '#ffffff', 2.5 * s, 0.07, 0.35);
        Pw.smoke(x, h, z, 3, '#e6f3ff', 0.35 * s, 0.5, 0.2, 0.2, 0.25);
        break;
      case 'wind':
      case 'gravity':
        Pw.smoke(x, h - 0.4, z, 8 * s, c, 0.5 * s, 0.8, 0.3, 0.8 * s, 0.3);
        Pw.glow(x, h, z, 8 * s, c, 3 * s, 0.08, 0.5, th === 'gravity' ? -4 : 0);
        break;
      default:
        Pw.glow(x, h, z, 10 * s, c, 3.5 * s, 0.1, 0.45);
        Pw.light(x, h + 0.3, z, c, 1.2 * s, 6, 0.18);
    }
  };
  // Большой реалистичный взрыв: огненный шар, дым столбом, ударная волна, обломки, свет, подпалина
  Pw.explosion = function (x, y, r, color) {
    const h = gy(x, y);
    r = r || 2;
    Pw.fire(x, h + 0.3, y, 26 * Math.min(2, r / 1.5), r * 0.45, 3.5, 0.8 * Math.min(1.6, r / 1.6));
    Pw.smoke(x, h + 0.6, y, 12, '#2a2422', 0.9 * Math.min(1.5, r / 1.6), 2.2, 1.8, r * 0.3, 0.6);
    Pw.glow(x, h + 0.8, y, 22, color || '#ffd08a', 7, 0.1, 0.6, 7);
    R3.flash(x, y, r * 1.1, '#ffb070', 0.35, 1);
    R3.ring(x, y, r * 1.6, '#ffd8a0', 0.45);
    Pw.light(x, h + 1.2, y, '#ff9a4a', 4.5, 14, 0.6);
    Pw.decal('scorch', x, y, r * 1.7, 14);
    if (fxOn()) {
      J.Fx.debris(x, h + 0.5, y, 0, 0, 16, '#6a5a4a');
      if (near(null, { x, y }, 30)) {
        J.Fx.shock(x, y, Math.min(1.6, r / 2));
        J.Fx.trauma(Math.min(0.6, 0.2 + r * 0.12));
        J.Sfx && J.Sfx.boom(Math.min(1.3, 0.6 + r * 0.2));
      }
    }
  };
  // Короткие разряды из точки
  const ZAPS = [];
  for (let i = 0; i < 10; i++) ZAPS.push({ t: 0, x: 0, h: 0, z: 0, r: 1, c: new THREE.Color() });
  Pw.zap = function (x, h, z, dur, r, color) {
    let o = ZAPS[0];
    for (const q of ZAPS) if (q.t <= 0) { o = q; break; }
    o.t = dur;
    o.x = x; o.h = h; o.z = z;
    o.r = r || 1;
    o.c.copy(col(color || '#ffe14a'));
  };
  function drawZaps(dt) {
    for (const o of ZAPS) {
      if (o.t <= 0) continue;
      o.t -= dt;
      for (let i = 0; i < 3; i++) {
        const a = rnd() * TAU, e = (rnd() - 0.4) * 1.5, L = o.r * (0.5 + rnd() * 0.7);
        Pw.bolt(o.x, o.h, o.z, o.x + Math.cos(a) * Math.cos(e) * L, o.h + Math.sin(e) * L, o.z + Math.sin(a) * Math.cos(e) * L, o.c, 0.15 * o.r, 0.035, 5);
      }
    }
  }
  // Слово-звук (Эхо): объёмная надпись всплывает и тает
  const WB = [];
  Pw.wordBurst = function (x, y, h, word, color, life, big) {
    const s = Pw.wordSprite(word, color || '#ffe14a');
    if (!s) return null;
    s.sp.position.set(x, h + 0.4, y);
    const o = { s, t: life || 0.8, max: life || 0.8, sc: big ? 2.2 : 1.5, x, y, h: h + 0.4 };
    WB.push(o);
    return o;
  };
  function drawWords(dt) {
    let j = 0;
    for (const o of WB) {
      o.t -= dt;
      if (o.t <= 0) {
        Pw.freeSprite(o.s);
        continue;
      }
      const k = 1 - o.t / o.max;
      const sc = o.sc * (k < 0.15 ? 0.3 + (k / 0.15) * 0.9 : 1.2 - k * 0.2);
      o.s.sp.scale.set(sc, sc * 0.5, 1);
      o.s.sp.position.y = o.h + k * 0.6;
      o.s.sp.material.opacity = k > 0.6 ? (1 - k) / 0.4 : 1;
      WB[j++] = o;
    }
    WB.length = j;
  }

  // ---------- 11. Снаряды: сердцевина рисуется немедленно, след — частицами ----------
  R3.updateProj = function () {};
  R3.dropProj = function (p) {
    if (p.spr) {
      Pw.freeSprite(p.spr);
      p.spr = null;
    }
    p.view = null;
  };
  // попадание снаряда (o — цель или null, wall — об стену)
  Pw.impact = function (p, o, wall) {
    if (!ADD || !near(p.owner, o, 35)) return;
    const th = p.theme || Pw.shapeTheme(p.shape);
    const h = gy(p.x, p.y) + (p.h || 1);
    const a = Math.atan2(p.vy, p.vx);
    Pw.burst(th, p.x, h, p.y, th === 'fire' ? 0.8 : 0.7, a, p.color);
    if (o && (th === 'metal' || p.shape === 'needle')) Pw.blood(p.x, h, p.y, 4, a, 2.5);
    if (wall && (th === 'metal' || th === 'emerald')) Pw.decal('crater', p.x, p.y, 0.5, 4);
  };
  // снаряд попал в цель: вспышка темы, огненный след, огненный столб, прилипшее слово
  Pw.onProjHit = function (p, o) {
    Pw.impact(p, o, false);
    if (p.pillar) Pw.firePillar(p.owner, p.x, p.y, p.dmg * 0.3, 1);
    if (p.firePatch) J.addField(p.owner, { x: p.x, y: p.y, radius: 1.1, dur: 2.5, dps: p.dmg * 0.25, color: '#ff7b1c', fx: { burn: 1.5 }, vis: 'fire' });
    if (p.stick && p.word && !o.dead) Pw.stickWord(o, p.word, p.color, p.stick, p.owner);
  };
  Pw.explodeProj = function (p) {
    const th = p.theme || Pw.shapeTheme(p.shape);
    const r = p.explode || 1.5;
    if (th === 'sound') {
      Pw.wordBurst(p.x, p.y, gy(p.x, p.y) + 1, ['ドゴォン', 'バァーン'][(rnd() * 2) | 0], p.color, 0.9, true);
      R3.ring(p.x, p.y, r * 1.2, p.color, 0.45);
      R3.flash(p.x, p.y, r * 0.8, p.color, 0.3, 1);
      if (fxOn() && near(p.owner, null, 30)) {
        J.Fx.shock(p.x, p.y, Math.min(1.4, r / 2));
        J.Sfx && J.Sfx.boom(0.7);
      }
    } else if (th === 'poison' || th === 'gravity' || th === 'wind') {
      Pw.burst(th, p.x, gy(p.x, p.y) + 1, p.y, r, null, p.color);
      R3.flash(p.x, p.y, r * 0.7, p.color, 0.3, 1);
      R3.ring(p.x, p.y, r * 1.1, p.color, 0.4);
    } else Pw.explosion(p.x, p.y, r, p.color);
  };
  let projLight = 0;
  function drawProjs(dt, frozen) {
    const g = G();
    const pl = g.player;
    const seeStand = !!(pl && pl.stand);
    projLight = 0;
    const cx = R3.cam.tx, cz = R3.cam.tz;
    for (const p of g.projs) {
      if (p.standProj && p.team !== 'player' && !seeStand) continue;
      const dx = p.x - cx, dz = p.y - cz;
      if (dx * dx + dz * dz > 3600) continue;
      const h = gy(p.x, p.y) + (p.h || 1);
      const a = Math.atan2(p.vy, p.vx);
      const ca = Math.cos(a), sa = Math.sin(a);
      const s = p.size || 0.2;
      let x = p.x, z = p.y;
      if (p.thaw > 0) x += (rnd() - 0.5) * 0.06;
      const th = p.theme || Pw.shapeTheme(p.shape);
      const emitK = frozen ? 0 : Math.min(1, dt * 60);
      p.age = (p.age || 0) + (frozen ? 0 : dt);
      switch (p.shape) {
        case 'flame':
        case 'ankh': {
          // огненный шар: яркое ядро, языки пламени за ним, свет на окружение
          Pw.orb(x, h, z, s * 0.9, '#ffb050');
          Pw.orb(x, h, z, s * 1.8, '#b0380a');
          if (p.shape === 'ankh') {
            // анкх: крест с петлёй из огня
            const r = s * 1.6, px = -sa, pz = ca;
            Pw.gseg(x, h - r * 1.2, z, x, h + r * 0.4, z, s * 0.35, '#ffb03a');
            Pw.gseg(x - px * r * 0.8, h, z - pz * r * 0.8, x + px * r * 0.8, h, z + pz * r * 0.8, s * 0.3, '#ffb03a');
            const n = 8;
            for (let i = 0; i < n; i++) {
              const b0 = (i / n) * TAU, b1 = ((i + 1) / n) * TAU, rr = r * 0.45;
              Pw.gseg(x + px * Math.cos(b0) * rr, h + r * 0.75 + Math.sin(b0) * rr, z + pz * Math.cos(b0) * rr, x + px * Math.cos(b1) * rr, h + r * 0.75 + Math.sin(b1) * rr, z + pz * Math.cos(b1) * rr, s * 0.25, '#ffb03a');
            }
          }
          if (emitK > 0 && rnd() < 0.9) Pw.fire(x - ca * s, h - s * 0.5, z - sa * s, 2, s * 0.6, 0.8, s * 2.2, -ca * 1.5, -sa * 1.5);
          if (projLight++ < 1) Pw.light(x, h + 0.2, z, '#ff8a2a', 1.6, 7, 0.08);
          break;
        }
        case 'hamon':
          Pw.orb(x, h, z, s * 1.6, '#fff2a8');
          if (emitK > 0) Pw.glow(x, h, z, 2, '#ffd84a', 1.2, 0.08, 0.25, 0, 0.1);
          break;
        case 'emerald':
        case 'shard':
          Pw.gem(x, h, z, s * 0.8, p.color, p.age * 9, p.age * 7, 1.5);
          Pw.orb(x, h, z, s * 1.6, p.color);
          if (emitK > 0 && rnd() < 0.7) Pw.puff(x, h, z, 0, 0, 0, 0.3, s * 0.9, s * 0.2, p.color, null, 0, 0.7);
          break;
        case 'ice':
          Pw.spike(x - ca * s * 1.4, h, z - sa * s * 1.4, ca, 0, sa, s * 2.8, s * 0.5, p.color);
          Pw.orb(x, h, z, s * 1.4, '#cfefff');
          if (emitK > 0 && rnd() < 0.6) Pw.puff(x, h, z, 0, -0.2, 0, 0.6, s * 0.8, s * 2, '#eef8ff', null, 0, 0.35, false);
          break;
        case 'water':
          Pw.sph(x, h, z, s * 0.9, p.color, 1);
          Pw.orb(x, h, z, s * 1.5, '#9ad0ff');
          if (emitK > 0) Pw.puff(x, h, z, -ca * 0.5 + (rnd() - 0.5), 0.5 + rnd(), -sa * 0.5 + (rnd() - 0.5), 0.4, s * 0.5, s * 0.2, '#cfe8ff', '#5ab3ff', 8, 0.8, false);
          break;
        case 'sound': {
          // настоящее слово-звук летит и крутится
          if (!p.spr) {
            const W = p.word || ['ドジュウウ', 'ボヨヨン', 'ドドド', 'ゴゴゴ'][(rnd() * 4) | 0];
            p.spr = Pw.wordSprite(W, p.color, '#1a2a0a');
          }
          if (p.spr) {
            const sc = 1.1 + s * 2 + Math.sin(p.age * 14) * 0.12;
            p.spr.sp.position.set(x, h + 0.2, z);
            p.spr.sp.scale.set(sc, sc * 0.5, 1);
            p.spr.sp.material.rotation = Math.sin(p.age * 6) * 0.25;
          }
          if (emitK > 0 && rnd() < 0.5) Pw.glow(x, h, z, 1, p.color, 0.8, 0.12, 0.4, 0, 0.3);
          break;
        }
        case 'bullet': {
          // трассер: светящийся росчерк за пулей
          Pw.sph(x, h, z, s * 0.6, '#d8c070', 1);
          const L = Math.min(1.6, p.speed * 0.06);
          Pw.gseg(x - ca * L, h, z - sa * L, x, h, z, s * 0.35, p.color);
          break;
        }
        case 'knife':
        case 'blade': {
          // клинок: длинное лезвие с бликом, лёгкий свистящий след
          const L = s * (p.shape === 'blade' ? 4 : 2.8);
          Pw.box(x, h, z, s * 0.12, s * 0.45, L, '#e9edf5', 0, Math.PI / 2 - a, 0);
          Pw.box(x - ca * L * 0.55, h, z - sa * L * 0.55, s * 0.3, s * 0.3, s * 0.6, p.shape === 'blade' ? '#c7ccd8' : '#4a3a2a', 0, Math.PI / 2 - a, 0);
          if (emitK > 0) Pw.gseg(x - ca * L * 1.2, h, z - sa * L * 1.2, x - ca * L * 0.5, h, z - sa * L * 0.5, s * 0.12, '#9ab0d0');
          // зависший в остановленном времени нож поблёскивает остриём
          if (p.held || p.thaw > 0) Pw.orb(x + ca * L * 0.5, h, z + sa * L * 0.5, s * (0.25 + 0.2 * Math.abs(Math.sin(Pw.simT * 6 + p.x * 3))), '#ffffff');
          break;
        }
        case 'nail':
        case 'needle':
        case 'arrow': {
          Pw.spike(x - ca * s * 1.3, h, z - sa * s * 1.3, ca, 0, sa, s * 2.6, s * 0.45, p.color);
          if (p.shape === 'nail') Pw.hoop(x, h, z, s * 0.9, s * 0.12, p.color, true, 8, Math.sin(p.age * 30) * s);
          if (emitK > 0 && rnd() < 0.6) Pw.puff(x, h, z, 0, 0, 0, 0.18, s * 0.7, s * 0.1, p.color, null, 0, 0.8);
          break;
        }
        case 'missile': {
          Pw.seg(x - ca * s * 1.2, h, z - sa * s * 1.2, x + ca * s * 1.2, h, z + sa * s * 1.2, s * 0.4, '#5a6a4a');
          Pw.spike(x + ca * s * 1.2, h, z + sa * s * 1.2, ca, 0, sa, s * 0.7, s * 0.4, '#c0c0c0');
          Pw.orb(x - ca * s * 1.4, h, z - sa * s * 1.4, s * 0.9, '#ffb03a');
          if (emitK > 0) Pw.smoke(x - ca * s * 1.6, h, z - sa * s * 1.6, 1, '#8a8480', s * 1.2, 1.2, 0.1, 0.02, 0.5);
          break;
        }
        case 'cube':
          Pw.box(x, h, z, s * 1.1, s * 1.1, s * 1.1, p.color, p.age * 6, p.age * 5, 0);
          if (emitK > 0 && rnd() < 0.4) Pw.shards(x, h, z, 1, p.color, 0.8, s * 0.4, 1, a + Math.PI, 0.5, 2, 0.4);
          break;
        case 'spiral': {
          if (p.beyond) {
            // Go Beyond: «несуществующий» пузырь — тугая спираль-веретено, кольца крутятся поперёк полёта
            const t0 = p.age * 18;
            for (let i = 0; i < 3; i++) Pw.hoop(x - ca * i * s * 0.6, h, z - sa * i * s * 0.6, s * (1.3 - i * 0.3), s * 0.07, i ? '#ff7ab8' : '#ffffff', true, 16, Math.sin(t0 + i * 2) * s);
            Pw.orb(x, h, z, s * 0.7, '#ffe6f2');
            for (let i = 0; i < 6; i++) {
              const b0 = t0 + i * 1.05, b1 = b0 + 1.05, d0 = i * s * 0.5, d1 = d0 + s * 0.5, r0 = s * (1 - i * 0.12), r1 = s * (1 - (i + 1) * 0.12);
              Pw.gseg(x - ca * d0 - sa * Math.cos(b0) * r0, h + Math.sin(b0) * r0, z - sa * d0 + ca * Math.cos(b0) * r0, x - ca * d1 - sa * Math.cos(b1) * r1, h + Math.sin(b1) * r1, z - sa * d1 + ca * Math.cos(b1) * r1, s * 0.08, '#ff9ad0');
            }
            if (projLight++ < 1) Pw.light(x, h, z, '#ff7ab8', 1.2, 5, 0.08);
            break;
          }
          // золотое вращение: вращающийся обруч и спираль искр
          const r = s * 1.2;
          Pw.hoop(x, h, z, r, s * 0.18, p.color, true, 14, Math.sin(p.age * 20) * r);
          Pw.orb(x, h, z, s * 1.1, '#fff6c8');
          if (emitK > 0) {
            const b = p.age * 25;
            Pw.puff(x + Math.cos(b) * r, h + Math.sin(b) * r, z + Math.sin(b) * r, 0, 0, 0, 0.45, s * 0.35, s * 0.1, p.color, null, 0, 1);
          }
          break;
        }
        case 'bubble':
          Pw.orb(x, h + Math.sin(p.age * 6) * 0.05, z, s * 1.1, '#9fc8ff');
          Pw.sph(x, h + Math.sin(p.age * 6) * 0.05, z, s * 0.95, '#f4fbff', 1);
          break;
        case 'ink':
          Pw.sph(x, h, z, s * 0.8, '#15151c', 1.2);
          if (emitK > 0) Pw.puff(x, h, z, 0, -0.5, 0, 0.5, s * 0.5, s * 0.3, '#1a1a22', null, 3, 0.8, false);
          break;
        default:
          Pw.orb(x, h, z, s * 1.8, p.color);
          Pw.orb(x, h, z, s * 0.8, '#ffffff');
          if (emitK > 0 && rnd() < 0.8) Pw.puff(x, h, z, 0, 0, 0, 0.3, s * 1.1, s * 0.2, p.color, null, 0, 0.7);
      }
      if (th === 'poison' && emitK > 0 && rnd() < 0.5) Pw.puff(x, h, z, 0, 0.3, 0, 0.8, s, s * 2.5, p.color, null, -0.2, 0.35, false);
    }
  }

  // ---------- 12. Видимые состояния на персонажах ----------
  const STK = ['burn', 'freeze', 'poison', 'bleed', 'age', 'stun', 'sleep', 'heavy', 'root', 'charm', 'book', 'silence', 'mark', 'mark2', 'drain', 'infinite', 'reflect', 'invuln', 'void', 'zero', 'lovetrain', 'power', 'regen', 'luck', 'armor', 'dodge', 'fly', 'soft', 'bound', 'disc', 'slow', 'dino', 'invis'];
  function drawStatus(e, dt, live) {
    const s = e.st;
    let any = false;
    for (let i = 0; i < STK.length; i++) if (s[STK[i]] > 0) { any = true; break; }
    if (!any || !e.view || !e.view.group.visible) return;
    const t = Pw.simT + e.id;
    const sc = e.scale || 1;
    const x = e.x, z = e.y, g0 = gy(x, z) + (e.z || 0);
    const k = live ? Math.min(1, dt * 60) : 0;
    if (s.burn > 0) {
      if (k && rnd() < 0.75) Pw.fire(x + (rnd() - 0.5) * 0.3, g0 + 0.2 + rnd() * 1.3 * sc, z + (rnd() - 0.5) * 0.3, 1, 0.12, 1.4, 0.32);
      if (e.isPlayer || rnd() < 0.3) Pw.light(x, g0 + 1, z, '#ff8a2a', 1.1, 5, 0.1);
    }
    if (s.freeze > 0) {
      // ледяная корка: кристаллы вокруг ног и тела
      for (let i = 0; i < 7; i++) {
        const a = i * 2.39 + e.id, r = 0.22 + (i % 3) * 0.06;
        Pw.gem(x + Math.cos(a) * r, g0 + 0.15 + (i % 4) * 0.32 * sc, z + Math.sin(a) * r, 0.11 + (i % 2) * 0.05, '#cfeeff', 0.3 * Math.cos(a), a, 2.2);
      }
      if (k && rnd() < 0.2) Pw.puff(x, g0 + 0.3, z, (rnd() - 0.5) * 0.4, 0.1, (rnd() - 0.5) * 0.4, 1, 0.25, 0.6, '#eef8ff', null, 0, 0.3, false);
    }
    if (s.poison > 0 && k && rnd() < 0.3) Pw.puff(x + (rnd() - 0.5) * 0.4, g0 + 0.6 + rnd() * 0.8, z + (rnd() - 0.5) * 0.4, 0, 0.5, 0, 0.9, 0.06, 0.12, '#b8ff6a', '#5a9a2a', -0.3, 0.9);
    if (s.bleed > 0 && k && rnd() < 0.25) Pw.puff(x + (rnd() - 0.5) * 0.3, g0 + 0.8 + rnd() * 0.5, z + (rnd() - 0.5) * 0.3, 0, -0.5, 0, 0.6, 0.05, 0.04, '#8a0a14', '#4a0408', 9, 0.95, false);
    if (s.age > 0 && k && rnd() < 0.25) Pw.puff(x + (rnd() - 0.5) * 0.5, g0 + 0.4 + rnd() * 1.2, z + (rnd() - 0.5) * 0.5, 0, 0.3, 0, 1.2, 0.15, 0.4, '#9a8aa8', null, -0.2, 0.3, false);
    if (s.stun > 0.3 && !e.react) {
      for (let i = 0; i < 3; i++) {
        const a = t * 5 + (i / 3) * TAU;
        Pw.orb(x + Math.cos(a) * 0.28, g0 + 1.95 * sc, z + Math.sin(a) * 0.28, 0.07, '#ffe14a');
      }
    }
    if (s.sleep > 0 && k && rnd() < 0.08) Pw.wordBurst(x + 0.3, z, g0 + 1.8 * sc, 'Zzz', '#bfc8ff', 1.2);
    if (s.heavy > 0) {
      // Три Заморозки: давит к земле — кольца давления и трещины
      for (let i = 0; i < 3; i++) {
        const f = ((t * 1.6 + i / 3) % 1);
        Pw.hoop(x, g0 + 2.2 - f * 2.1, z, 0.45 - f * 0.1, 0.02, '#ffd23f', true, 12);
      }
      if (!e._heavyDec || e._heavyDec < G().t - 3) {
        e._heavyDec = G().t;
        Pw.decal('crater', x, z, 1.6, 4);
      }
      if (k && rnd() < 0.15) Pw.smoke(x, g0 + 0.05, z, 1, '#a89a88', 0.3, 0.6, 0.1, 0.4, 0.4);
    }
    if (s.root > 0 || s.bound > 0) {
      const c = e._bindC || '#7fe3e6';
      for (let i = 0; i < 4; i++) {
        const a = (i / 4) * TAU + e.id;
        Pw.gseg(x + Math.cos(a) * 0.55, g0 + 0.02, z + Math.sin(a) * 0.55, x + Math.cos(a) * 0.15, g0 + 0.45, z + Math.sin(a) * 0.15, 0.025, c);
      }
      Pw.hoop(x, g0 + 0.45, z, 0.2, 0.025, c, true, 10, 0.05);
      Pw.hoop(x, g0 + 1.05 * sc, z, 0.25, 0.025, c, true, 10, 0.06);
    }
    if (s.charm > 0) {
      // нити кукловода от макушки вверх
      const c = e._charmC || '#ff8ad8';
      for (let i = 0; i < 3; i++) {
        const a = (i / 3) * TAU + t * 0.6;
        Pw.gseg(x + Math.cos(a) * 0.18, g0 + 1.6 * sc, z + Math.sin(a) * 0.18, x + Math.cos(a) * 0.05, g0 + 3.4, z + Math.sin(a) * 0.05, 0.012, c);
      }
    }
    if (s.book > 0 && k && rnd() < 0.5) {
      // страницы: лицо раскрывается книгой
      const a = rnd() * TAU;
      Pw.puff(x + Math.cos(a) * 0.2, g0 + 1.4 * sc, z + Math.sin(a) * 0.2, Math.cos(a) * 0.8, 0.6, Math.sin(a) * 0.8, 0.8, 0.12, 0.1, '#fff8e8', '#e8dcc0', 0.5, 0.95, false);
    }
    if (s.book > 0) {
      for (let i = 0; i < 4; i++) Pw.box(x + Math.cos(e.face) * 0.18, g0 + 1.55 * sc, z + Math.sin(e.face) * 0.18, 0.02, 0.22, 0.16, '#fff8e8', 0, Math.PI / 2 - e.face + (i - 1.5) * 0.35, 0);
    }
    if (s.silence > 0) {
      for (let i = 0; i < 6; i++) {
        const a = t * 0.8 + (i / 6) * TAU;
        Pw.box(x + Math.cos(a) * 0.5, g0 + 0.5 + (i % 3) * 0.5 * sc, z + Math.sin(a) * 0.5, 0.25, 0.4, 0.015, '#dfe8f7', 0, -a, 0);
      }
    }
    if (s.mark > 0) {
      // бомба Королевы: розовая метка над головой пульсирует
      const p = 1 + Math.sin(t * 9) * 0.15;
      Pw.hoop(x, g0 + 2.15 * sc, z, 0.16 * p, 0.02, '#ff5fa2', true, 12, 0.03);
      Pw.gem(x, g0 + 2.15 * sc, z, 0.06 * p, '#ff9ad8', 0, t * 3, 1);
      if (k && rnd() < 0.15) Pw.glow(x, g0 + 1.2, z, 1, '#ff5fa2', 0.6, 0.08, 0.6, -1, 0.5);
    }
    if (s.mark2 > 0) Pw.box(x + Math.cos(e.face) * 0.2, g0 + 1.25 * sc, z + Math.sin(e.face) * 0.2, 0.2, 0.14, 0.02, '#ff5fa2', 0, Math.PI / 2 - e.face, 0.4);
    if (s.drain > 0 && e.sv.drainSrc && !e.sv.drainSrc.dead && k && rnd() < 0.6) {
      const o = e.sv.drainSrc;
      const v = 3;
      const dx = o.x - x, dz = o.y - z, L = Math.hypot(dx, dz) || 1;
      Pw.puff(x, g0 + 1, z, (dx / L) * v, 0.3, (dz / L) * v, Math.min(1, L / v), 0.1, 0.05, '#ff3a4a', '#7a0a14', 0, 1);
    }
    if (s.infinite > 0) {
      for (let i = 0; i < 2; i++) {
        const a = t * 9 + i * Math.PI;
        Pw.orb(x + Math.cos(a) * 0.35, g0 + 0.3 + ((t * 0.7 + i * 0.5) % 1) * 1.5, z + Math.sin(a) * 0.35, 0.09, '#ffe14a');
      }
    }
    if (s.reflect > 0) {
      for (let i = 0; i < 3; i++) Pw.hoop(x, g0 + 0.4 + i * 0.55, z, 0.75 - Math.abs(i - 1) * 0.12, 0.012, '#cfefff', true, 16);
      if (k && rnd() < 0.3) Pw.glow(x + (rnd() - 0.5) * 1.2, g0 + rnd() * 1.8, z + (rnd() - 0.5) * 1.2, 1, '#ffffff', 0.3, 0.06, 0.5, 0);
    }
    if (s.invuln > 0.6 && !(G().timeskip && G().timeskip.by === e)) {
      const c = e.sv.invulnRoot ? '#c9ccd6' : '#ffe9a8';
      for (let i = 0; i < 3; i++) Pw.hoop(x, g0 + 0.3 + i * 0.6, z, 0.65 - Math.abs(i - 1) * 0.1, 0.02, c, true, 14, Math.sin(t * 2 + i) * 0.05);
      if (e.sv.invulnRoot) Pw.sph(x, g0 + 0.9, z, 0.62, '#8a8f9a', 1.4);
    }
    if (s.void > 0) {
      Pw.sph(x, g0 + 0.9, z, 0.9, '#050208', 1);
      Pw.hoop(x, g0 + 0.9, z, 0.92, 0.03, '#8a3ac4', true, 16, Math.sin(t * 3) * 0.2);
      if (k) Pw.smoke(x, g0 + 0.6, z, 1, '#120820', 0.5, 0.8, 0.3, 0.6, 0.7);
      if (k && rnd() < 0.3) Pw.decal('void', x, z, 1.6, 6);
    }
    if (s.zero > 0 || s.lovetrain > 0) {
      const c = s.zero > 0 ? '#ffd84a' : '#fff2c8';
      if (k && rnd() < 0.5) Pw.glow(x + (rnd() - 0.5) * 0.8, g0 + rnd() * 2, z + (rnd() - 0.5) * 0.8, 1, c, 0.6, 0.1, 0.8, -1);
      if (s.lovetrain > 0) Pw.gseg(x, g0, z, x, g0 + 30, z, 0.9 + Math.sin(t * 4) * 0.05, '#7a6a40');
    }
    if (s.power > 0 && k && rnd() < 0.35) Pw.puff(x + (rnd() - 0.5) * 0.6, g0 + rnd() * 1.6, z + (rnd() - 0.5) * 0.6, 0, 1.5, 0, 0.5, 0.15, 0.05, '#ff4a3a', '#7a0a0a', -1, 0.9);
    if (s.regen > 0 && k && rnd() < 0.3) Pw.puff(x + (rnd() - 0.5) * 0.6, g0 + rnd() * 1.4, z + (rnd() - 0.5) * 0.6, 0, 0.8, 0, 0.7, 0.09, 0.03, '#9dff7a', null, -0.5, 1);
    if (s.luck > 0 && k && rnd() < 0.2) Pw.puff(x + (rnd() - 0.5) * 0.7, g0 + rnd() * 1.8, z + (rnd() - 0.5) * 0.7, 0, 0.4, 0, 0.6, 0.08, 0.02, '#ffe14a', null, 0, 1);
    if (s.armor > 0) {
      for (let i = 0; i < 5; i++) {
        const a = i * 1.26 + t * 0.4;
        Pw.gem(x + Math.cos(a) * 0.32, g0 + 0.35 + i * 0.28 * sc, z + Math.sin(a) * 0.32, 0.07, e._armorC || '#d6f2ff', 0, a, 1.8);
      }
    }
    if (s.dodge > 0 && k) {
      // Эпитафия: видно будущее — красные призраки врагов там, где они окажутся через миг
      if (e.isPlayer) {
        e._epT = (e._epT || 0) - dt;
        if (e._epT <= 0) {
          e._epT = 0.35;
          for (const o of G().ents) {
            if (o.dead || !J.hostile(e, o) || !o.view || J.dist(o.x, o.y, x, z) > 14) continue;
            const vx = o.vx || 0, vy = o.vy || 0;
            if (Math.abs(vx) + Math.abs(vy) < 0.3 && !(o.atk && !o.atk.done)) continue;
            const ox = o.view.group.position.x, oz = o.view.group.position.z;
            o.view.group.position.x += vx * 0.6;
            o.view.group.position.z += vy * 0.6;
            Pw.ghost(o.view, '#ff2a3a', 0.45);
            o.view.group.position.x = ox;
            o.view.group.position.z = oz;
            o.view.group.updateMatrixWorld(true);
          }
        }
      }
    }
    if (s.fly > 0 && k && rnd() < 0.5) {
      const b = e.face + Math.PI;
      for (const sd of [-1, 1]) Pw.puff(x + Math.cos(b) * 0.3 + Math.cos(b + sd * 1.5) * 0.5, g0 + 1.3, z + Math.sin(b) * 0.3 + Math.sin(b + sd * 1.5) * 0.5, 0, -0.4, 0, 0.6, 0.2, 0.05, e._flyC || '#ffffff', null, 1, 0.6, false);
    }
    if (s.soft > 0) {
      const f = (t * 1.5) % 1;
      Pw.hoop(x, g0 + 0.05, z, 0.3 + f * 0.8, 0.02, '#ff6fae', true, 14);
    }
    if (s.disc > 0) Pw.seg(x, g0 + 1.75 * sc, z, x + 0.02, g0 + 1.77 * sc, z, 0.11, '#e9e6ef');
    if (s.slow > 0 && k && rnd() < 0.08) Pw.hoop(x, g0 + 0.1, z, 0.5, 0.015, '#a6ff7e', true, 12);
    if (s.dino > 0 && k && rnd() < 0.2) Pw.puff(x, g0 + 1, z, 0, 0.5, 0, 0.4, 0.12, 0.05, '#6aa84f', null, 0, 0.8);
    if (s.invis > 0 && e.team === 'player' && k && rnd() < 0.2) Pw.glow(x + (rnd() - 0.5) * 0.5, g0 + rnd() * 1.6, z + (rnd() - 0.5) * 0.5, 1, '#d6e8ff', 0.2, 0.06, 0.5, 0);
  }

  // ---------- 13. Остановка времени: удары по застывшим копятся и срабатывают, когда время пойдёт ----------
  // (J.hurt вызывает Pw.tsHold; при выходе из остановки — Pw.tsRelease)
  const HOLD = [];
  Pw.tsHold = function (t, amount, src, opt) {
    const g = G();
    const ts = g.timestop;
    if (!ts || !t.st.timefrozen || opt.dot || opt.tsRelease) return false;
    const so = src ? J.ownerOf(src) : null;
    if (!so || (so !== ts.by && !(so.isPlayer && so.tsMove > 0))) return false;
    let h = null;
    for (const o of HOLD) if (o.t === t) { h = o; break; }
    if (!h) {
      if (HOLD.length >= 24) return false;
      h = { t, dmg: 0, n: 0, src, kx: 0, ky: 0, knock: 0, kind: opt.kind, fx: opt.fx };
      HOLD.push(h);
    }
    h.dmg += amount;
    h.n++;
    const a = opt.ang !== undefined ? opt.ang : Math.atan2(t.y - so.y, t.x - so.x);
    h.kx += Math.cos(a) * (opt.knock || 1);
    h.ky += Math.sin(a) * (opt.knock || 1);
    h.knock = Math.max(h.knock, opt.knock || 0);
    if (opt.fx) h.fx = opt.fx;
    // удар «застыл» на теле: искры висят в воздухе
    const b = Pw.body(t);
    Pw.glow(b.x + (rnd() - 0.5) * 0.4, b.h + (rnd() - 0.4) * 0.5, b.z + (rnd() - 0.5) * 0.4, opt.rushTick ? 2 : 6, '#ffffff', 0.6, 0.12, 2.5, 0);
    if (fxOn() && !opt.rushTick && near(so, t, 20)) J.Fx.word('ピタッ', t.x, t.y, gy(t.x, t.y) + 1.6, 'sm', '#e8e2ff', '#2a0a3a');
    return true;
  };
  Pw.tsRelease = function () {
    if (!HOLD.length) return;
    const list = HOLD.splice(0, HOLD.length);
    for (const h of list) {
      const t = h.t;
      if (t.dead) continue;
      const a = Math.atan2(h.ky, h.kx);
      const big = h.n >= 4 || h.dmg > t.maxHp * 0.25;
      J.hurt(t, h.dmg, h.src, { knock: Math.min(10, h.knock + h.n * 0.4), ang: a, kind: h.kind, fx: h.fx, tsRelease: true, finisher: big, launch: big, crit: false, gdmg: 80 });
      const b = Pw.body(t);
      Pw.glow(b.x, b.h, b.z, 18, '#ffffff', 6, 0.12, 0.4);
      R3.flash(t.x, t.y, 1.2, '#ffffff', 0.25, 1);
      if (fxOn() && near(h.src, t, 30)) {
        J.Fx.word(h.n > 6 ? 'ドドドドドッ!!' : 'ドンッ!', t.x, t.y, gy(t.x, t.y) + 1.7, big ? 'fin' : 'big', '#ffffff', '#2a0a3a');
        J.Fx.sparks(b.x, b.h, b.z, 20, a, '#ffffff', 8);
        J.Sfx && J.Sfx.heavy(big);
      }
    }
  };

  // ---------- 14. Активные силы (живут несколько кадров) ----------
  const ACT = [];
  Pw.add = function (o) {
    o.t = o.t || 0;
    ACT.push(o);
    return o;
  };
  const frozenFor = (u) => {
    const ts = G().timestop;
    return !!(ts && u && ts.by !== u && !(u.isPlayer && u.tsMove > 0) && !(u.owner && u.owner === ts.by));
  };
  Pw.frozenFor = frozenFor;
  // игровой шаг (в Game.update после боя)
  Pw.update = function (dt) {
    let j = 0;
    for (let i = 0; i < ACT.length; i++) {
      const o = ACT[i];
      let alive = true;
      if (!frozenFor(o.u)) {
        o.t += dt;
        alive = o.update(dt) !== false;
      }
      if (alive) ACT[j++] = o;
      else if (o.end) o.end();
    }
    ACT.length = j;
    if (!G().timestop && HOLD.length) Pw.tsRelease();
  };
  Pw.reset = function () {
    for (const o of ACT) if (o.end) o.end();
    ACT.length = 0;
    HOLD.length = 0;
    for (const w of WB) Pw.freeSprite(w.s);
    WB.length = 0;
    for (const d of DEC) {
      d.life = 0;
      d.m.visible = false;
    }
    for (const o of SH) o.t = 0;
    for (const b of BEAMS) b.t = 0;
    for (const L of LIGHTS) L.t = 0;
    for (const r of RINGS) {
      r.life = 0;
      r.m.visible = false;
    }
    for (const r of FLASH) {
      r.life = 0;
      r.m.visible = false;
    }
  };

  // ---------- 15. Кадр: всё рисуется заново ----------
  Pw.draw = function (rdt, dt) {
    if (!Pw.ready) return;
    const frozen = J.Fx && J.Fx.tsK > 0.5;
    const pdt = frozen ? 0 : dt;
    Pw.simT += pdt;
    for (const k in IM) IM[k].n = 0;
    drawProjs(dt, frozen || dt <= 0);
    for (const o of ACT) if (o.draw) o.draw(pdt);
    drawBeams(rdt);
    drawZaps(pdt);
    drawShards(pdt);
    drawFields(pdt);
    drawTraps(pdt);
    const g = G();
    const live = pdt > 0;
    const cx = R3.cam.tx, cz = R3.cam.tz;
    // стёртое время: враги бродят вслепую, за ними тянутся багровые послеобразы
    // ускорение времени: за владельцем Сделано на Небесах — шлейф силуэтов
    Pw._ghT = (Pw._ghT || 0) - pdt;
    const ghostTick = live && Pw._ghT <= 0;
    if (ghostTick) Pw._ghT = 0.14;
    const sk = g.timeskip;
    for (const e of g.ents) {
      if (e.dead) continue;
      const dx = e.x - cx, dz = e.y - cz;
      if (dx * dx + dz * dz > 1600) continue;
      if (ghostTick && e.view && Math.hypot(e.vx || 0, e.vy || 0) > 0.4) {
        if (sk && e !== sk.by && dx * dx + dz * dz < 400) Pw.ghost(e.view, '#ff2a4a', 0.42);
        else if (e.st.heaven > 0) Pw.ghost(e.view, '#7affc8', 0.3);
      }
      drawStatus(e, pdt, live && !e.st.timefrozen);
      // Шиер Харт Атак: пыль из-под гусениц
      if (e.sha && live && rnd() < 0.4) Pw.smoke(e.x, gy(e.x, e.y) + 0.05, e.y, 1, '#8a7a6a', 0.25, 0.5, 0.2, 0.2, 0.5);
    }
    for (const k in IM) {
      const im = IM[k];
      im.m.count = im.n;
      im.m.visible = im.n > 0;
      if (im.n) {
        im.m.instanceMatrix.updateRange.count = im.n * 16;
        im.m.instanceMatrix.needsUpdate = true;
        im.m.instanceColor.updateRange.count = im.n * 3;
        im.m.instanceColor.needsUpdate = true;
      }
    }
    if (IM.gseg) IM.gseg.m.material.uniforms.uTime.value = Pw.simT;
    flushSys(ADD);
    flushSys(ALP);
    if (Pw.noPart) ADD.mesh.visible = ALP.mesh.visible = false;
    updateDecals(pdt);
    updateLights(pdt);
    updateGhosts(rdt);
    drawWords(rdt);
  };

  // ---------- 16. Инициализация ----------
  Pw.init = function () {
    if (Pw.ready) return;
    const tex = puffTex();
    ADD = makeSys(1400, true, tex);
    ALP = makeSys(700, false, tex);
    const cyl = new THREE.CylinderGeometry(1, 1, 1, 7, 1);
    const cylG = new THREE.CylinderGeometry(1, 1, 1, 8, 1, true);
    makeIM('seg', cyl, glowPatch(new THREE.MeshLambertMaterial({ color: '#ffffff' }), 0.18), 700);
    makeIM('gseg', cylG, new THREE.ShaderMaterial({ uniforms: { uTime: { value: 0 } }, vertexShader: GSEG_VS, fragmentShader: GSEG_FS, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }), 900);
    makeIM('spike', new THREE.ConeGeometry(1, 1, 6), glowPatch(new THREE.MeshLambertMaterial({ color: '#ffffff' }), 0.3), 400);
    makeIM('gem', new THREE.OctahedronGeometry(1, 0), glowPatch(new THREE.MeshLambertMaterial({ color: '#ffffff', flatShading: true }), 0.55), 300);
    makeIM('box', new THREE.BoxGeometry(1, 1, 1), glowPatch(new THREE.MeshLambertMaterial({ color: '#ffffff' }), 0.08), 300);
    makeIM('sph', new THREE.SphereGeometry(1, 14, 10), glowPatch(new THREE.MeshLambertMaterial({ color: '#ffffff', transparent: true, opacity: 0.92 }), 0.2), 120);
    makeIM('orb', new THREE.SphereGeometry(1, 12, 8), new THREE.ShaderMaterial({ vertexShader: GSEG_VS, fragmentShader: 'varying vec3 vC; varying float vE; varying float vL; void main() { gl_FragColor = vec4(vC * pow(vE, 2.0) + vC * pow(vE, 8.0) * 0.6, 1.0); }', transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }), 400);
    IM.gseg.m.renderOrder = 7;
    IM.orb.m.renderOrder = 7;
    IM.sph.m.renderOrder = 3;
    // следы на земле
    for (let i = 0; i < 16; i++) {
      const m = new THREE.Mesh(decGeo, new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 }));
      m.visible = false;
      m.renderOrder = 2;
      R3.scene.add(m);
      DEC.push({ m, life: 0, max: 1, grow: 1, size: 1 });
    }
    // послеобразы
    for (let i = 0; i < 96; i++) {
      const mat = new THREE.ShaderMaterial({ uniforms: { uC: { value: new THREE.Color() }, uA: { value: 0 } }, vertexShader: GH_VS, fragmentShader: GH_FS, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
      const mesh = new THREE.Mesh(GH_DUMMY, mat);
      mesh.matrixAutoUpdate = false;
      mesh.frustumCulled = false;
      mesh.visible = false;
      R3.scene.add(mesh);
      GHM.push({ mesh, mat, busy: false });
    }
    // надписи
    for (let i = 0; i < 12; i++) {
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({ transparent: true, depthWrite: false, fog: false }));
      sp.visible = false;
      sp.renderOrder = 8;
      R3.scene.add(sp);
      SPR.push({ sp, busy: false });
    }
    initLegacy();
    Pw.ready = true;
    Pw.warm();
  };
  Pw.stats = () => ({ add: ADD.next, alp: ALP.next, simT: +Pw.simT.toFixed(2), act: ACT.length, im: Object.keys(IM).map((k) => k + ':' + IM[k].n).join(' ') });
  // прогрев шейдеров: первая сила в бою не должна давать фриз компиляции
  Pw.warm = function () {
    const r = R3.renderer, sc = R3.scene, cam = R3.camera;
    const objs = [ADD.mesh, ALP.mesh].concat(Object.values(IM).map((o) => o.m), DEC.map((d) => d.m), [GHM[0].mesh, SPR[0].sp], RINGS.map((o) => o.m), FLASH.map((o) => o.m));
    const vis = objs.map((o) => o.visible);
    for (const o of objs) o.visible = true;
    for (const k in IM) IM[k].m.count = 1;
    GHM[0].mesh.geometry = decGeo;
    try {
      r.compile(sc, cam);
    } catch (e) {}
    GHM[0].mesh.geometry = GH_DUMMY;
    objs.forEach((o, i) => (o.visible = vis[i]));
    for (const k in IM) IM[k].m.count = 0;
  };

  // ---------- 17. Общее для сил ----------
  const POW = (Pw.POW = {});
  const sdOf = (u) => (u && u.stand ? J.STANDS[u.stand.id] : null);
  const c1Of = (u) => (u && u.stand ? J.STANDS[u.stand.id].c1 : '#ffd84a');
  const c2Of = (u) => (u && u.stand ? J.STANDS[u.stand.id].c2 : '#fff2a8');
  const snd = (u, name, a, b, c) => {
    if (J.Sfx && J.Sfx[name] && near(u, null, 30)) J.Sfx[name](a, b, c);
  };
  const say = (u, at, word, size, color, stroke) => {
    const o = at || u;
    if (fxOn() && near(u, at, 25)) J.Fx.word(word, o.x, o.y, gy(o.x, o.y) + 1.8, size || 'mid', color || '#ffffff', stroke || '#1a0a2a');
  };
  const shout = (u, word, color, stroke) => {
    if (fxOn() && (u.isPlayer || near(u, null, 18))) J.Fx.wordAt(word, innerWidth / 2, innerHeight * 0.28, 'big', color || '#ffffff', stroke || '#2a0a3a');
  };
  Pw.shout = shout;
  // Тема по стенду (если у способности нет своей)
  const STAND_TH = {
    magicians_red: 'fire', hermit_purple: 'vine', hierophant_green: 'emerald', the_fool: 'sand', oasis: 'sand', death_13: 'dark', black_sabbath: 'dark', cream: 'dark', wonder_of_u: 'dark', chariot_requiem: 'dark',
    echoes_1: 'sound', echoes_2: 'sound', echoes_3: 'sound', geb: 'water', foo_fighters: 'water', catch_the_rainbow: 'water', horus: 'ice', white_album: 'ice', green_day: 'poison', purple_haze: 'poison', grateful_dead: 'poison', harvest: 'poison',
    kiss: 'pink', crazy_diamond: 'pink', killer_queen: 'pink', kq_btd: 'pink', c_moon: 'gravity', jumpin_jack_flash: 'wind', twentieth_century_boy: 'metal', metallica: 'metal', baby_face: 'cube', stone_free: 'string', red_hot_chili_pepper: 'elec', paisley_park: 'elec', weather_report: 'elec',
    gold_experience: 'life', ger: 'gold', planet_waves: 'fire', heavens_door: 'ink', spice_girl: 'pink', justice: 'wind', man_in_the_mirror: 'metal', kraft_work: 'metal', d4c: 'light', love_train: 'light', made_in_heaven: 'light', tusk_1: 'pink', tusk_2: 'gold', tusk_3: 'gold', tusk_4: 'gold',
  };
  const themeOf = (u, ab) => {
    if (ab.vis) return ab.vis;
    const f = ab.fx || {};
    if (f.burn) return 'fire';
    if (f.freeze) return 'ice';
    if (f.poison) return 'poison';
    if (f.sleep) return 'dark';
    if (ab.hamon) return 'gold';
    return STAND_TH[u.stand ? u.stand.id : ''] || 'energy';
  };
  Pw.themeOf = themeOf;
  // урон вдоль отрезка
  const hitLine = (u, x0, y0, ang, L, w, dmg, opt, cb) => {
    let n = 0;
    const ca = Math.cos(ang), sa = Math.sin(ang);
    for (const o of G().ents) {
      if (o.dead || !J.hostile(u, o)) continue;
      const dx = o.x - x0, dy = o.y - y0;
      const t = dx * ca + dy * sa;
      if (t < -o.r || t > L + o.r) continue;
      if (Math.abs(-dx * sa + dy * ca) > w / 2 + o.r) continue;
      J.hurt(o, dmg, u, Object.assign({ ang }, opt));
      if (cb) cb(o);
      n++;
    }
    return n;
  };
  Pw.hitLine = hitLine;
  // сколько можно пройти по направлению до стены
  const freeLen = (x, y, ang, max, ghost) => {
    const w = G().world;
    let L = 0;
    while (L < max) {
      const nx = x + Math.cos(ang) * (L + 0.25), ny = y + Math.sin(ang) * (L + 0.25);
      if (!ghost && w.solid(nx, ny, { water: true })) break;
      L += 0.25;
    }
    return L;
  };
  // Сбор силы в ладони стенда: свет стягивается к кулаку
  Pw.charge = function (u, dur, color) {
    Pw.add({
      u, dur, color,
      update() {
        return this.t < this.dur && !u.dead;
      },
      draw(dt) {
        const k = Math.min(1, this.t / this.dur);
        const h = Pw.hand(u);
        Pw.orb(h.x, h.h, h.z, 0.08 + 0.22 * k, this.color);
        Pw.orb(h.x, h.h, h.z, 0.05 + 0.08 * k, '#ffffff');
        if (dt > 0 && rnd() < 0.8) {
          const a = rnd() * TAU, e = (rnd() - 0.5) * 2, r = 0.7;
          const ox = Math.cos(a) * Math.cos(e) * r, oh = Math.sin(e) * r, oz = Math.sin(a) * Math.cos(e) * r;
          Pw.puff(h.x + ox, h.h + oh, h.z + oz, -ox * 4, -oh * 4, -oz * 4, 0.22, 0.07, 0.03, this.color, null, 0, 1);
        }
      },
    });
  };
  // Игрок: читаемый замах (стенд тянет руку, сила собирается), потом выстрел. ИИ свой замах уже показал (Cb.aiCastTele).
  const windup = (u, aim, at, color, fn) => {
    Pw.surge(u, 0.8);
    if (!u.isPlayer || !J.Cb) {
      fn();
      return true;
    }
    J.Cb.attack(u, { type: 'cast', dur: at + 0.2, at, fn, stand: true, tg: aim.target, kind: 'shot', step: 0 });
    Pw.charge(u, at, color);
    snd(u, 'power', at + 0.05);
    return true;
  };
  Pw.windup = windup;
  // ИИ: силовой замах — свечение в руке и предупреждение о зоне удара
  Pw.tele = function (e, ab, tg, wind) {
    if (!Pw.ready) return;
    const th = themeOf(e, ab);
    const c = ab.color || TH[th] || c1Of(e);
    Pw.charge(e, wind, c);
    Pw.surge(e, 0.7);
    if (ab.kind === 'nova' && (ab.at === 'aim' || ab.delay)) R3.ring(tg.x, tg.y, ab.radius || 2, '#ff3a3a', wind + (ab.delay || 0));
    else if (ab.kind === 'nova') R3.ring(e.x, e.y, ab.radius || 3, '#ff6a4a', wind);
    if (ab.kind === 'beam') {
      Pw.add({
        u: e, tg, wind,
        update() {
          return this.t < this.wind && !e.dead;
        },
        draw() {
          const h = Pw.hand(e);
          const b = Pw.body(this.tg);
          Pw.gseg(h.x, h.h, h.z, b.x, b.h, b.z, 0.012 + 0.02 * (this.t / this.wind), '#ff3a3a');
        },
      });
    }
  };
  // спавн веера снарядов (как у вида «shoot»), с поправками
  const fan = (u, ab, ang, c, over, each) => {
    const n = ab.n || 1;
    const spread = ((ab.spread || 0) * Math.PI) / 180;
    for (let i = 0; i < n; i++) {
      let a = ang;
      if (n > 1) a = spread >= TAU - 0.01 ? ang + (i / n) * TAU : ang + spread * (i / (n - 1) - 0.5);
      const p = J.spawnProj(u, {
        ang: a, speed: ab.speed || 10, dmg: ab.dmg * c.pw, range: ab.range || 10, shape: ab.proj, color: ab.color, size: ab.size,
        pierce: ab.pierce, homing: ab.homing, fx: ab.fx, explode: ab.explode, cloud: ab.cloud, kind: c.kind, ghost: ab.ghost, stand: !!u.stand,
      });
      if (over) Object.assign(p, over);
      if (each) each(p, i);
    }
  };
  // угол выстрела в момент срабатывания: цель, выбранная при нажатии, если она ещё жива; иначе — прицел
  const fireAng = (u, aim, range) => {
    const t = aim.target;
    if (t && !t.dead && J.dist(u.x, u.y, t.x, t.y) < (range || 8) + 3) return Math.atan2(t.y - u.y, t.x - u.x);
    return u.isPlayer ? J.P.aim(u, range || 8).ang : aim.ang;
  };
  // целевая сущность для силы (из прицела или ближайшая)
  const pickTarget = (u, aim, range, cone) => (aim.target && !aim.target.dead && J.dist(u.x, u.y, aim.target.x, aim.target.y) < range + 0.6 ? aim.target : J.nearestHostile(u, range, cone || 0.7, aim.ang));
  Pw.use = function (u, ab, aim, extra, pw, kind) {
    const P0 = POW[ab.pw];
    Pw.surge(u, 1);
    return P0.use(u, ab, aim, { pw, kind, extra });
  };
  Pw.has = (k) => !!(k && POW[k] && Pw.ready);

  // ---------- 18. Звёздная Платина: Звёздный палец ----------
  POW.starFinger = {
    use(u, ab, aim, c) {
      return windup(u, aim, 0.14, ab.color || '#c7b6ff', () => {
        const a = fireAng(u, aim, ab.range || 6);
        u.face = a;
        u.anim = { type: 'punch', t: 0.35, max: 0.35, stand: true };
        const L = freeLen(u.x, u.y, a, ab.range || 6);
        snd(u, 'whoosh', 0.14, true, 0.16);
        Pw.add({
          u, a, L, ext: 0, phase: 0, hold: 0,
          update(dt) {
            if (this.phase === 0) {
              this.ext = Math.min(this.L, this.ext + dt * 48);
              if (this.ext >= this.L - 0.01) {
                this.phase = 1;
                this.hold = 0.14;
                const n = hitLine(u, u.x, u.y, this.a, this.L + 0.3, 0.55, ab.dmg * c.pw, { knock: 5, stun: 0.45, kind: c.kind, fx: ab.fx, gdmg: 55 });
                const tx = u.x + Math.cos(this.a) * this.L, tz = u.y + Math.sin(this.a) * this.L;
                Pw.burst('energy', tx, gy(tx, tz) + 1.25, tz, n ? 1 : 0.6, this.a, ab.color || '#c7b6ff');
                if (n) {
                  snd(u, 'heavy', false);
                  say(u, { x: tx, y: tz }, 'ズドッ!', 'big', '#ffffff', '#2a0a5a');
                } else if (this.L < (ab.range || 6) - 0.3) Pw.decal('crater', tx, tz, 0.6, 5);
              }
            } else if (this.hold > 0) this.hold -= dt;
            else this.ext -= dt * 34;
            return this.ext > 0 && !u.dead;
          },
          draw() {
            const h = Pw.hand(u);
            const ca = Math.cos(this.a), sa = Math.sin(this.a);
            const tx = h.x + ca * this.ext, tz = h.z + sa * this.ext, th = h.h - 0.1 * (this.ext / 6);
            Pw.seg(h.x, h.h, h.z, tx, th, tz, 0.06, c1Of(u));
            Pw.gseg(h.x, h.h, h.z, tx, th, tz, 0.17, ab.color || '#c7b6ff');
            Pw.orb(tx, th, tz, 0.2, '#e8dcff');
          },
        });
      });
    },
  };

  // ---------- 19. Красный Маг ----------
  POW.ankh = {
    use(u, ab, aim, c) {
      return windup(u, aim, 0.12, '#ff7b1c', () => {
        const a = fireAng(u, aim, ab.range || 9);
        u.face = a;
        const h = Pw.hand(u);
        Pw.fire(h.x, h.h - 0.1, h.z, 8, 0.15, 1.2, 0.4);
        snd(u, 'fire', 0.8);
        fan(u, ab, a, c, { shape: 'ankh', theme: 'fire', firePatch: 1 });
      });
    },
  };
  // Огненный столб (Ураган перекрёстного огня, метеоры)
  Pw.firePillar = function (u, x, y, dmg, dur) {
    Pw.add({
      u, x, y, dmg, dur: dur || 1, tick: 0,
      update(dt) {
        this.tick -= dt;
        if (this.tick <= 0) {
          this.tick = 0.25;
          J.hitCircle(u, this.x, this.y, 1.1, this.dmg, { kind: 'fire', fx: { burn: 2.5 }, knock: 1 });
        }
        return this.t < this.dur;
      },
      draw(dt) {
        const k = 1 - this.t / this.dur;
        const h0 = gy(this.x, this.y);
        if (dt > 0) {
          Pw.fire(this.x, h0, this.y, 3, 0.45 * k + 0.1, 5 * k + 1, 0.7);
          if (rnd() < 0.5) Pw.fire(this.x, h0 + 1.5 * k, this.y, 1, 0.3, 3, 0.6);
        }
        Pw.light(this.x, h0 + 1.5, this.y, '#ff7a20', 2.5 * k, 9, 0.1);
      },
    });
    Pw.decal('scorch', x, y, 2.2, 12);
  };
  POW.crossfire = {
    use(u, ab, aim, c) {
      return windup(u, aim, 0.3, '#ff9b2c', () => {
        const a = fireAng(u, aim, ab.range || 10);
        u.face = a;
        u.anim = { type: 'pose', t: 0.5, max: 0.5 };
        shout(u, 'クロスファイヤーハリケーン!!', '#ffd08a', '#5a0a00');
        snd(u, 'fire', 1.4);
        const b = Pw.body(u, 1.2);
        Pw.fire(b.x, b.h - 0.6, b.z, 30, 1.2, 3, 0.7);
        Pw.light(b.x, b.h, b.z, '#ff8a2a', 3.5, 12, 0.6);
        // анкхи вылетают по кругу и разворачиваются к цели
        fan(u, Object.assign({}, ab, { spread: 360 }), a, c, { shape: 'ankh', theme: 'fire', pillar: 1, firePatch: 0 }, (p, i) => {
          p.speed *= 0.85;
          p.homing = (ab.homing || 2.2) * 1.6;
          p.life += 0.6;
        });
      });
    },
  };
  // Красные путы: огненные верёвки связывают всех вокруг
  POW.redBind = {
    use(u, ab, aim, c) {
      return windup(u, aim, 0.2, '#ff5a1c', () => {
        const R = (ab.radius || 3.2) * 1.7;
        const list = [];
        for (const o of G().ents) if (!o.dead && J.hostile(u, o) && J.dist(u.x, u.y, o.x, o.y) < R && list.length < 5) list.push(o);
        snd(u, 'fire', 1.1);
        snd(u, 'whip');
        say(u, null, 'レッドバインド!', 'big', '#ffb03a', '#5a0a00');
        // огненное кольцо вокруг — как и раньше, бьёт всех рядом
        const h0 = gy(u.x, u.y);
        for (let i = 0; i < 16; i++) {
          const a = (i / 16) * TAU;
          Pw.fire(u.x + Math.cos(a) * 1.2, h0 + 0.1, u.y + Math.sin(a) * 1.2, 2, 0.15, 1.6, 0.45, Math.cos(a) * 3, Math.sin(a) * 3);
        }
        J.hitCircle(u, u.x, u.y, ab.radius || 3.2, ab.dmg * c.pw * 0.5, { kind: 'fire', fx: { burn: 2 }, knock: 2 });
        Pw.add({
          u, list, grow: 0, bound: false, dur: 2.4,
          update(dt) {
            this.grow = Math.min(1, this.grow + dt * 4);
            if (!this.bound && this.grow >= 1) {
              this.bound = true;
              for (const o of this.list) {
                if (o.dead) continue;
                J.hurt(o, ab.dmg * c.pw, u, { kind: 'fire', fx: ab.fx, stun: 0.3 });
                o.st.bound = Math.max(o.st.bound || 0, o.boss ? 0.9 : 2.2);
                o.st.root = Math.max(o.st.root || 0, o.boss ? 0.9 : 2.2);
                o._bindC = '#ff6a1a';
              }
            }
            return this.t < this.dur && !u.dead;
          },
          draw(dt) {
            const h = Pw.hand(u);
            const fade = this.t > this.dur - 0.4 ? (this.dur - this.t) / 0.4 : 1;
            for (const o of this.list) {
              if (o.dead) continue;
              const b = Pw.body(o, 0.9);
              const k = this.grow;
              const ex = h.x + (b.x - h.x) * k, eh = h.h + (b.h - h.h) * k + Math.sin(k * Math.PI) * 0.4, ez = h.z + (b.z - h.z) * k;
              C.set('#ff6a1a').multiplyScalar(fade);
              // верёвка: тёмно-красная сердцевина в огненной оболочке
              Pw.seg(h.x, h.h, h.z, ex, eh, ez, 0.035, '#8a1a08');
              Pw.gseg(h.x, h.h, h.z, ex, eh, ez, 0.13, C);
              if (dt > 0)
                for (let q = 0; q < 2; q++) {
                  const f = rnd() * k;
                  Pw.fire(h.x + (ex - h.x) * f, h.h + (eh - h.h) * f, h.z + (ez - h.z) * f, 1, 0.05, 0.9, 0.3);
                }
              if (this.bound) {
                Pw.hoop(b.x, b.h - 0.2, b.z, 0.32, 0.05, C, true, 10, 0.08);
                Pw.hoop(b.x, b.h + 0.25, b.z, 0.3, 0.05, C, true, 10, -0.08);
              }
            }
          },
        });
      });
    },
  };

  // ---------- 20. Лозы, нити, щупальца, леска: захват и подтягивание ----------
  const ROPE = new Float32Array(40 * 3);
  // pts вдоль кривой от руки к цели (волна убывает к концу)
  const ropePts = (ax, ah, az, bx, bh, bz, k, wav, t, n) => {
    const dx = bx - ax, dz = bz - az, L = Math.hypot(dx, dz) || 1;
    const px = -dz / L, pz = dx / L;
    for (let i = 0; i < n; i++) {
      const f = (i / (n - 1)) * k;
      const w = Math.sin(f * 9 + t * 14) * wav * Math.sin(f * Math.PI) * (1 - k * 0.6);
      ROPE[i * 3] = ax + dx * f + px * w;
      ROPE[i * 3 + 1] = ah + (bh - ah) * f + Math.sin(f * Math.PI) * 0.35 * (1 - k * 0.5) + Math.cos(f * 7 + t * 9) * wav * 0.4;
      ROPE[i * 3 + 2] = az + dz * f + pz * w;
    }
    return ROPE;
  };
  const ROPE_ST = {
    vine: { c: '#8b3fc4', g: '#c06bff', r: 0.035, thorn: '#5a1f8a', wav: 0.25 },
    string: { c: '#3aa2a6', g: '#7fe3e6', r: 0.014, wav: 0.12 },
    line: { c: '#e8f4ff', g: '#bfe6ff', r: 0.008, wav: 0.05, hook: true },
    tentacle: { c: '#2bbf6a', g: '#3dff8a', r: 0.03, wav: 0.3 },
  };
  POW.lasso = {
    use(u, ab, aim, c) {
      const tg = pickTarget(u, aim, ab.range || 7, ab.style === 'line' ? 1.2 : 0.7);
      if (!tg) return false;
      const st = ROPE_ST[ab.style] || ROPE_ST.vine;
      u.anim = { type: 'cast', t: 0.4, max: 0.4, stand: true };
      u.face = Math.atan2(tg.y - u.y, tg.x - u.x);
      snd(u, 'whip');
      if (ab.style === 'string') say(u, null, 'シュルルッ', 'mid', '#7fe3e6');
      else if (ab.style === 'vine') say(u, null, 'ハーミットパープル!', 'mid', '#c06bff', '#2a0a3a');
      const d = J.dist(u.x, u.y, tg.x, tg.y);
      Pw.add({
        u, tg, st, k: 0, phase: 0, reel: 0, d,
        update(dt) {
          const o = this.tg;
          if (o.dead || u.dead) return false;
          if (this.phase === 0) {
            this.k = Math.min(1, this.k + (dt * 20) / Math.max(2, this.d));
            if (this.k >= 1) {
              this.phase = 1;
              J.hurt(o, (ab.dmg || 6) * c.pw, u, { stun: ab.stun || 0.6, kind: c.kind, melee: true });
              o._bindC = st.g;
              Pw.burst(ab.style === 'vine' ? 'blood' : 'energy', o.x, gy(o.x, o.y) + 1, o.y, 0.5, null, st.g);
              snd(u, 'thud', 0.5);
            }
          } else if (this.phase === 1) {
            // подсечка: тянем цель к себе (тяжёлого босса не сдвинуть — тогда сами подтягиваемся к нему)
            this.reel += dt;
            const a = Math.atan2(o.y - u.y, o.x - u.x);
            const L = J.dist(u.x, u.y, o.x, o.y);
            const want = 1.15;
            if (L > want + 0.05) {
              const step = Math.min(L - want, dt * 16);
              if (!o.boss) {
                const nx = o.x - Math.cos(a) * step, ny = o.y - Math.sin(a) * step;
                if (!J.blocked(nx, ny, o.r * 0.9, {}) || ab.style === 'line') {
                  o.x = nx;
                  o.y = ny;
                } else J.moveEnt(o, -Math.cos(a) * step, -Math.sin(a) * step);
              } else J.moveEnt(u, Math.cos(a) * step, Math.sin(a) * step);
              o.st.stun = Math.max(o.st.stun || 0, 0.25);
            }
            if (L <= want + 0.06 || this.reel > 0.6) this.phase = 2;
          } else {
            this.k -= dt * 5;
            if (this.k <= 0) return false;
          }
          return true;
        },
        draw() {
          const o = this.tg;
          const h = Pw.hand(u);
          const b = Pw.body(o, 0.95);
          const n = 18;
          const pts = ropePts(h.x, h.h, h.z, b.x, b.h, b.z, this.k, st.wav, this.t, n);
          Pw.chain(pts, n, st.r, st.c);
          Pw.chain(pts, n, st.r * 2.2, st.g, true);
          if (st.thorn)
            for (let i = 2; i < n - 1; i += 2) {
              const j = i * 3;
              const s = i % 4 ? 1 : -1;
              Pw.spike(pts[j], pts[j + 1], pts[j + 2], s * 0.3, 0.8, -s * 0.3, 0.09, 0.02, st.thorn);
            }
          const e = (n - 1) * 3;
          if (st.hook) Pw.spike(pts[e], pts[e + 1], pts[e + 2], 0, -1, 0, 0.12, 0.03, '#c9ccd6');
          if (this.phase >= 1) Pw.hoop(b.x, b.h, b.z, 0.3, st.r * 1.5, st.g, true, 10, 0.1);
        },
      });
      return true;
    },
  };
  // Хамон по лозам: лозы хлещут к каждому врагу, по ним бежит солнечная волна
  POW.hamonVines = {
    use(u, ab, aim, c) {
      return windup(u, aim, 0.18, '#ffd84a', () => {
        const R = (ab.radius || 3.5) * 1.6;
        const list = [];
        for (const o of G().ents) if (!o.dead && J.hostile(u, o) && J.dist(u.x, u.y, o.x, o.y) < R && list.length < 6) list.push(o);
        snd(u, 'whip');
        say(u, null, 'コォォォ', 'big', '#ffe14a', '#5a3a00');
        // волна по земле — удар по всем рядом
        R3.ring(u.x, u.y, ab.radius || 3.5, '#ffd84a', 0.5);
        Pw.burst('gold', u.x, gy(u.x, u.y) + 0.4, u.y, 1.2);
        Pw.add({
          u, list, k: 0, pulse: -1, done: false,
          update(dt) {
            this.k = Math.min(1, this.k + dt * 5);
            if (this.k >= 1 && this.pulse < 0) {
              this.pulse = 0;
              snd(u, 'zap', 0.8);
            }
            if (this.pulse >= 0 && !this.done) {
              this.pulse += dt * 4;
              if (this.pulse >= 1) {
                this.done = true;
                for (const o of this.list) {
                  if (o.dead) continue;
                  J.hurt(o, ab.dmg * c.pw * 1.2, u, { kind: 'hamon', fx: ab.fx, stun: 0.8, knock: 2 });
                  Pw.burst('gold', o.x, gy(o.x, o.y) + 1, o.y, 0.9);
                }
                if (!this.list.length) J.hitCircle(u, u.x, u.y, ab.radius || 3.5, ab.dmg * c.pw, { kind: 'hamon', fx: ab.fx, knock: 3 });
              }
            }
            return this.t < 1.1 && !u.dead;
          },
          draw() {
            const h = Pw.hand(u);
            const fade = this.t > 0.8 ? (1.1 - this.t) / 0.3 : 1;
            for (const o of this.list) {
              if (o.dead) continue;
              const b = Pw.body(o, 0.9);
              const n = 14;
              const pts = ropePts(h.x, h.h, h.z, b.x, b.h, b.z, this.k, 0.2, this.t, n);
              C.set('#8b3fc4').multiplyScalar(fade);
              Pw.chain(pts, n, 0.03, '#8b3fc4');
              if (this.pulse >= 0 && this.pulse < 1) {
                const i = Math.min(n - 1, Math.floor(this.pulse * (n - 1))) * 3;
                Pw.orb(pts[i], pts[i + 1], pts[i + 2], 0.22, '#ffe14a');
                Pw.chain(pts, n, 0.07, '#ffd84a', true);
              }
            }
          },
        });
      });
    },
  };

  // ---------- 21. Зелёный Иерофант ----------
  POW.emeraldSplash = {
    use(u, ab, aim, c) {
      return windup(u, aim, 0.16, '#3dff8a', () => {
        say(u, null, 'エメラルドスプラッシュ!', 'big', '#7dffb0', '#0a3a1a');
        const n = (ab.n || 6) * 2;
        Pw.add({
          u, n, i: 0, acc: 0,
          update(dt) {
            this.acc += dt;
            while (this.acc > 0.035 && this.i < this.n) {
              this.acc -= 0.035;
              this.i++;
              const a = fireAng(u, aim, ab.range || 10) + (rnd() - 0.5) * ((ab.spread || 40) * Math.PI) / 180;
              u.face = a;
              const p = J.spawnProj(u, { ang: a, speed: (ab.speed || 12) * (0.9 + rnd() * 0.3), dmg: ab.dmg * c.pw * 0.55, range: ab.range || 10, shape: 'emerald', color: '#3dff8a', size: ab.size || 0.22, kind: c.kind, stand: !!u.stand });
              p.h = 1 + (rnd() - 0.5) * 0.35;
              const h = Pw.hand(u, this.i % 2 === 0);
              Pw.glow(h.x, h.h, h.z, 3, '#7dffb0', 2, 0.08, 0.25);
              if (this.i % 3 === 0) snd(u, 'glass');
            }
            if (u.anim && u.anim.type === 'cast') u.anim.t = Math.max(u.anim.t, 0.1);
            return this.i < this.n && !u.dead && u.canAct();
          },
        });
      });
    },
  };
  // Барьер из нитей: задел нить — изумруды летят с обоих концов
  POW.web = {
    use(u, ab, aim, c) {
      const emerald = ab.style !== 'string';
      const n = ab.n || 8;
      const R = (ab.radius || 4.5) * (emerald ? 1.6 : 1.3);
      const cx = u.x, cy = u.y;
      const anc = [];
      for (let i = 0; i < n; i++) {
        const a = (i / n) * TAU + rnd() * 0.2;
        const L = Math.max(1.2, freeLen(cx, cy, a, R));
        anc.push({ x: cx + Math.cos(a) * L, y: cy + Math.sin(a) * L, ok: true, rim: true });
      }
      u.anim = { type: 'cast', t: 0.45, max: 0.45, stand: true };
      snd(u, 'whip');
      say(u, null, emerald ? '半径20mエメラルドスプラッシュ!' : 'ストーンフリー!', 'big', emerald ? '#7dffb0' : '#7fe3e6', '#0a2a2a');
      const col1 = emerald ? '#3dff8a' : '#7fe3e6';
      Pw.add({
        u, cx, cy, anc, grow: 0, life: ab.life || 25, chk: 0,
        update(dt) {
          this.grow = Math.min(1, this.grow + dt * 3);
          this.chk -= dt;
          if (this.chk <= 0 && this.grow >= 1) {
            this.chk = 0.08;
            for (const o of G().ents) {
              if (o.dead || !J.hostile(u, o)) continue;
              for (let i = 0; i < this.anc.length; i++) {
                const A = this.anc[i];
                if (!A.ok) continue;
                // спица (центр → якорь) и дуга (якорь → следующий)
                const B = this.anc[(i + 1) % this.anc.length];
                const d1 = segDist(o.x, o.y, this.cx, this.cy, A.x, A.y);
                const d2 = A.rim && B ? segDist(o.x, o.y, A.x, A.y, B.x, B.y) : 99;
                if (Math.min(d1, d2) > 0.35 + o.r * 0.5) continue;
                A.ok = false;
                snd(u, emerald ? 'glass' : 'whip');
                if (emerald) {
                  // залп изумрудов с обоих концов нити
                  for (const P0 of [A, d2 < d1 ? B : { x: this.cx, y: this.cy }]) {
                    for (let k = 0; k < 3; k++) {
                      const a = Math.atan2(o.y - P0.y, o.x - P0.x) + (k - 1) * 0.12;
                      J.spawnProj(u, { x: P0.x, y: P0.y, ang: a, speed: 14, dmg: ab.dmg * c.pw, range: 9, shape: 'emerald', color: '#3dff8a', size: 0.2, fx: ab.fx, kind: c.kind, stand: !!u.stand });
                    }
                  }
                  say(u, o, 'ビシッ', 'mid', '#7dffb0');
                } else {
                  // паутина Стоун Фри: оплетает и держит
                  J.hurt(o, ab.dmg * c.pw, u, { stun: 0.4, kind: c.kind });
                  o.st.bound = Math.max(o.st.bound || 0, o.boss ? 1 : 2.5);
                  o.st.root = Math.max(o.st.root || 0, o.boss ? 1 : 2.5);
                  o._bindC = '#7fe3e6';
                  say(u, o, 'ギュッ', 'mid', '#7fe3e6');
                }
                break;
              }
            }
          }
          let any = false;
          for (const A of this.anc) if (A.ok) any = true;
          return any && this.t < this.life && !u.dead;
        },
        draw() {
          const h = gy(this.cx, this.cy) + 0.3;
          const fade = this.t > this.life - 1 ? Math.max(0, this.life - this.t) : 1;
          C2.set(col1).multiplyScalar(0.55 + 0.45 * fade);
          for (let i = 0; i < this.anc.length; i++) {
            const A = this.anc[i];
            if (!A.ok) continue;
            const k = this.grow;
            const ax = this.cx + (A.x - this.cx) * k, ay = this.cy + (A.y - this.cy) * k;
            const ah = gy(ax, ay) + 0.3;
            Pw.gseg(this.cx, h, this.cy, ax, ah, ay, 0.022, C2);
            const B = this.anc[(i + 1) % this.anc.length];
            if (k >= 1 && B.ok) Pw.gseg(A.x, gy(A.x, A.y) + 0.3, A.y, B.x, gy(B.x, B.y) + 0.3, B.y, 0.018, C2);
            if (k >= 1) Pw.gem(A.x, gy(A.x, A.y) + 0.3, A.y, 0.06, col1, 0, this.t * 2, 1.5);
          }
        },
      });
      return true;
    },
  };
  const segDist = (px, py, ax, ay, bx, by) => {
    const dx = bx - ax, dy = by - ay;
    const L2 = dx * dx + dy * dy || 1e-6;
    const t = J.clamp(((px - ax) * dx + (py - ay) * dy) / L2, 0, 1);
    return Math.hypot(px - ax - dx * t, py - ay - dy * t);
  };
  Pw.segDist = segDist;
  // Захват тела: лента-щупальце уходит в цель, затем контроль
  POW.possess = {
    use(u, ab, aim, c) {
      const tg = pickTarget(u, aim, ab.range || 6, 0.8);
      if (!tg) return false;
      u.anim = { type: 'cast', t: 0.5, max: 0.5, stand: true };
      snd(u, 'whip');
      const color = c1Of(u);
      Pw.add({
        u, tg, k: 0, done: false,
        update(dt) {
          if (this.tg.dead || u.dead) return false;
          this.k = Math.min(1, this.k + dt * 3);
          if (this.k >= 1 && !this.done) {
            this.done = true;
            this.tg._charmC = color;
            const victims = ab.aoe ? G().ents.filter((o) => !o.dead && J.hostile(u, o) && J.dist(o.x, o.y, this.tg.x, this.tg.y) <= ab.aoe) : [this.tg];
            for (const v of victims) {
              v._charmC = color;
              J.Abil.applyHex(u, v, ab.status, ab.dur, c.pw);
            }
            Pw.burst('emerald', this.tg.x, gy(this.tg.x, this.tg.y) + 1.5, this.tg.y, 0.8, null, color);
            snd(u, 'glass');
          }
          return this.t < 1.2;
        },
        draw() {
          const h = Pw.hand(u);
          const b = Pw.body(this.tg, 1.55);
          const n = 16;
          const k = this.done ? Math.max(0, 1 - (this.t - 0.4) * 1.5) : this.k;
          if (k <= 0) return;
          const pts = ropePts(h.x, h.h, h.z, b.x, b.h, b.z, this.done ? 1 : k, 0.35, this.t, n);
          Pw.chain(pts, n, 0.03, color);
          Pw.chain(pts, n, 0.07, color, true);
        },
      });
      return true;
    },
  };

  // ---------- 22. Серебряная Колесница ----------
  POW.armorOff = {
    use(u, ab, aim, c) {
      const sv = u.standView;
      const b = sv && sv.group.visible ? { x: sv.pos.x, h: sv.pos.y + 1.2, z: sv.pos.z } : Pw.body(u, 1.3);
      if (fxOn()) {
        J.Fx.debris(b.x, b.h, b.z, 0, 0, 26, '#c7ccd8');
        J.Fx.sparks(b.x, b.h, b.z, 18, null, '#ffffff', 7);
      }
      Pw.shards(b.x, b.h, b.z, 14, '#d8dde8', 5, 0.12, 1, null, 3, 9, 1.4);
      snd(u, 'block', true);
      snd(u, 'guardBreak');
      shout(u, '鎧を脱いだ!', '#e8eefc', '#2a2a4a');
      R3.text(u.x, u.y, 'Доспехи сброшены!', 'tbig', 1.2, 2.6);
      const d = ab.dur || 8;
      u.st.haste = d;
      u.sv.haste = ab.val || 0.8;
      // без брони — неуловим, но хрупок
      u.st.dodge = d;
      u.st.fragile = d;
      u.st.armorOff = d;
      return true;
    },
  };
  POW.bladeShot = {
    use(u, ab, aim, c) {
      return windup(u, aim, 0.22, '#e8eefc', () => {
        const a = fireAng(u, aim, ab.range || 9);
        u.face = a;
        u.anim = { type: 'punch', t: 0.3, max: 0.3, stand: true };
        snd(u, 'whoosh', 0.2, false, 0.16);
        say(u, null, 'シュバッ!', 'big', '#e8eefc', '#2a2a4a');
        fan(u, ab, a, c, { shape: 'blade', theme: 'metal' }, (p) => {
          p.size = 0.32;
          p.h = 1.25;
        });
      });
    },
  };

  // ---------- 23. Королева-убийца: бомба касанием, мина-монетка, детонатор ----------
  POW.kqBomb = {
    use(u, ab, aim, c) {
      const g = G();
      const extra = c.extra;
      const marked = g.ents.find((o) => !o.dead && o.st.mark > 0 && o.sv.markBy === u);
      const boom = (x, y, who) => {
        J.R3.text(u.x, u.y, 'КЛИК!', 'tcry', 0.8);
        snd(u, 'click');
        Pw.explosion(x, y, ab.radius || 2.2, '#ffb0d8');
        J.hitCircle(u, x, y, ab.radius || 2.2, ab.dmg * c.pw, { knock: 6, kind: 'fire', fx: { burn: 3 }, gdmg: 60, finisher: true });
        if (fxOn() && near(u, who, 30)) J.Fx.word(J.Fx.pick('boom'), x, y, gy(x, y) + 1.6, 'fin', '#ffffff', '#b3122e');
      };
      if (marked) {
        // ИИ сначала щёлкает детонатором — у цели есть миг, чтобы увернуться
        if (!u.isPlayer && !(extra && extra.det) && J.Cb) {
          J.Cb.bombTele(u, marked, ab);
          return true;
        }
        u.anim = { type: 'pose', pose: 'kira', t: 0.5, max: 0.5 };
        marked.st.mark = 0;
        boom(marked.x, marked.y, marked);
        return true;
      }
      const tg = pickTarget(u, aim, ab.range || 2, 0.9);
      const mine = u._kqMine;
      if (!tg && mine && !mine.gone) {
        // заложенная бомба-монетка взрывается по щелчку
        mine.gone = true;
        boom(mine.x, mine.y, null);
        return 'short';
      }
      u.anim = { type: 'punch', t: 0.3, max: 0.3, stand: true };
      if (!tg) {
        // касание земли: монетка становится бомбой (взрыв по щелчку или когда враг подойдёт)
        const a = aim.ang;
        const x = u.x + Math.cos(a) * 1.4, y = u.y + Math.sin(a) * 1.4;
        if (mine) mine.gone = true;
        const m = (u._kqMine = { x, y, gone: false });
        snd(u, 'click');
        say(u, m, 'カチッ', 'mid', '#ff9ad8');
        Pw.add({
          u, m, chk: 0,
          update(dt) {
            if (m.gone || u.dead) return false;
            this.chk -= dt;
            if (this.chk <= 0) {
              this.chk = 0.1;
              for (const o of G().ents)
                if (!o.dead && J.hostile(u, o) && J.dist(o.x, o.y, m.x, m.y) < 1.1 + o.r) {
                  m.gone = true;
                  boom(m.x, m.y, o);
                  break;
                }
            }
            return this.t < 40;
          },
          draw() {
            const h = gy(m.x, m.y) + 0.06;
            Pw.seg(m.x, h, m.y, m.x, h + 0.02, m.y, 0.09, '#e8c860');
            const p = 0.5 + 0.5 * Math.sin(this.t * 8);
            C.set('#ff5fa2').multiplyScalar(0.4 + p * 0.8);
            Pw.orb(m.x, h + 0.05, m.y, 0.14 + p * 0.06, C);
          },
        });
        return 'short';
      }
      tg.st.mark = 15;
      tg.sv.markBy = u;
      J.hurt(tg, 8 * c.pw, u, { melee: true });
      J.R3.text(tg.x, tg.y, 'Первая бомба!', 'tpink', 1);
      Pw.burst('pink', tg.x, gy(tg.x, tg.y) + 1.2, tg.y, 0.6, null, '#ff9ad8');
      snd(u, 'click');
      if (fxOn() && near(u, tg, 20)) J.Fx.word('カチッ', tg.x, tg.y, gy(tg.x, tg.y) + 2, 'mid', '#ff9ad8');
      return 'short';
    },
  };

  // ---------- 24. Рука: стирание пространства ----------
  // разрыв-шрам в воздухе (рисуется, пока не схлопнется)
  // arc: { x, y, r, a0, a1 } — разрыв по дуге взмаха (иначе — прямой от A до B)
  Pw.tear = function (u, ax, ay, bx, by, h, dur, arc) {
    const n = 9;
    const pts = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      const f = i / (n - 1);
      let x, y;
      if (arc) {
        const a = arc.a0 + (arc.a1 - arc.a0) * f;
        x = arc.x + Math.cos(a) * arc.r;
        y = arc.y + Math.sin(a) * arc.r;
      } else {
        x = ax + (bx - ax) * f;
        y = ay + (by - ay) * f;
      }
      const j = i === 0 || i === n - 1 ? 0 : (rnd() - 0.5) * 0.12;
      pts[i * 3] = x + j;
      pts[i * 3 + 1] = h + (rnd() - 0.5) * 0.1 * Math.sin(f * Math.PI);
      pts[i * 3 + 2] = y - j;
    }
    Pw.add({
      u, pts, n, dur: dur || 0.5,
      update() {
        return this.t < this.dur;
      },
      draw(dt) {
        const k = 1 - this.t / this.dur;
        const P0 = this.pts;
        // посередине щель шире, к концам сходится на нет
        for (let i = 0; i < this.n - 1; i++) {
          const a = i * 3, b = a + 3;
          const w = (0.13 * k + 0.015) * Math.sin(((i + 0.5) / (this.n - 1)) * Math.PI);
          Pw.seg(P0[a], P0[a + 1], P0[a + 2], P0[b], P0[b + 1], P0[b + 2], w, '#030106');
          Pw.gseg(P0[a], P0[a + 1], P0[a + 2], P0[b], P0[b + 1], P0[b + 2], w * 2.4 + 0.02, '#6a2ab4');
        }
        // воздух и пыль затягивает в разрыв
        if (dt > 0)
          for (let q = 0; q < 2; q++) {
            const i = (rnd() * (this.n - 1)) | 0;
            const x = P0[i * 3], h0 = P0[i * 3 + 1], z = P0[i * 3 + 2];
            const ox = (rnd() - 0.5) * 1.4, oh = (rnd() - 0.5) * 0.8, oz = (rnd() - 0.5) * 1.4;
            Pw.puff(x + ox, h0 + oh, z + oz, -ox * 5, -oh * 5, -oz * 5, 0.2, 0.06, 0.02, '#b48aff', null, 0, 0.9);
          }
      },
    });
  };
  const gaon = (u, at) => {
    snd(u, 'erase');
    if (fxOn() && near(u, at, 25)) J.Fx.word('ガオン!', (at || u).x, (at || u).y, gy((at || u).x, (at || u).y) + 1.9, 'big', '#e8d8ff', '#1a0a3a');
  };
  POW.handErase = {
    use(u, ab, aim, c) {
      const go = () => {
        const tg = aim.target && !aim.target.dead ? aim.target : null;
        const a = u.isPlayer ? J.P.aim(u, ab.range || 1.8).ang : tg ? Math.atan2(tg.y - u.y, tg.x - u.x) : aim.ang;
        u.face = a;
        // правая рука проводит дугу: всё на ней стёрто
        const R = (ab.range || 1.8) + 0.4;
        const h = gy(u.x, u.y) + 1.15;
        Pw.tear(u, 0, 0, 0, 0, h, 0.55, { x: u.x, y: u.y, r: R, a0: a - 0.75, a1: a + 0.75 });
        Pw.decal('void', u.x + Math.cos(a) * R, u.y + Math.sin(a) * R, 1.2, 4);
        let n = 0;
        for (const o of G().ents) {
          if (o.dead || !J.hostile(u, o)) continue;
          const d = J.dist(u.x, u.y, o.x, o.y) - o.r;
          const oa = Math.atan2(o.y - u.y, o.x - u.x);
          const inArc = Math.abs(J.angDiff(a, oa)) < 0.8;
          if (d <= R && inArc) {
            J.hurt(o, ab.dmg * c.pw, u, { pierceDef: true, knock: 2, kind: c.kind, melee: true, finisher: true, gdmg: 90, ang: oa });
            Pw.glow(o.x, gy(o.x, o.y) + 1.1, o.y, 10, '#9a5ae4', 2, 0.1, 0.4);
            n++;
          } else if (d <= R + 4.5 && inArc && !o.boss) {
            // пространство схлопнулось: дальних рывком притянуло к руке
            const L = Math.max(0, J.dist(u.x, u.y, o.x, o.y) - 1.2);
            const nx = o.x - Math.cos(oa) * Math.min(L, 3), ny = o.y - Math.sin(oa) * Math.min(L, 3);
            if (!J.blocked(nx, ny, o.r * 0.9, {})) {
              Pw.tear(u, o.x, o.y, nx, ny, gy(o.x, o.y) + 1, 0.4);
              o.x = nx;
              o.y = ny;
              o.st.stun = Math.max(o.st.stun || 0, 0.5);
            }
          }
        }
        gaon(u, n ? null : u);
        if (!n && u.isPlayer) u.whiff = G().t;
      };
      if (u.isPlayer && J.Cb) J.Cb.attack(u, { clip: 'heavy', type: 'heavy', dur: 0.5, at: 0.22, fn: go, stand: true, tg: aim.target, kind: 'heavy', step: 0.3 });
      else {
        u.anim = { type: 'heavy', t: 0.35, max: 0.35, stand: true };
        go();
      }
      return true;
    },
  };
  POW.handPull = {
    use(u, ab, aim, c) {
      const tg = pickTarget(u, aim, ab.range || 8, 0.7);
      if (!tg) return false;
      const a = Math.atan2(tg.y - u.y, tg.x - u.x);
      u.face = a;
      u.anim = { type: 'heavy', t: 0.35, max: 0.35, stand: true };
      const h = gy(u.x, u.y) + 1.1;
      const ox = tg.x, oy = tg.y;
      // стёрт отрезок пространства между нами — цель оказывается рядом
      if (!tg.boss) {
        const nx = u.x + Math.cos(a) * 1.15, ny = u.y + Math.sin(a) * 1.15;
        if (!J.blocked(nx, ny, tg.r * 0.9, {})) {
          tg.x = nx;
          tg.y = ny;
        }
      } else {
        const nx = tg.x - Math.cos(a) * 1.3, ny = tg.y - Math.sin(a) * 1.3;
        if (!J.blocked(nx, ny, u.r * 0.9, {})) {
          u.x = nx;
          u.y = ny;
        }
      }
      Pw.tear(u, u.x, u.y, ox, oy, h, 0.45);
      // стёртые на пути снаряды
      for (const p of G().projs) if (p.team !== u.team && segDist(p.x, p.y, u.x, u.y, ox, oy) < 0.6) p.life = 0;
      J.hurt(tg, (ab.dmg || 6) * c.pw, u, { stun: ab.stun || 0.6, kind: c.kind });
      gaon(u, tg);
      return true;
    },
  };
  POW.handStep = {
    use(u, ab, aim, c) {
      const a = aim.target ? Math.atan2(aim.target.y - u.y, aim.target.x - u.x) : aim.ang;
      let L = Math.min(ab.range || 7, aim.target ? Math.max(0, J.dist(u.x, u.y, aim.target.x, aim.target.y) - 1.3) : ab.range || 7);
      L = Math.min(L, freeLen(u.x, u.y, a, L));
      if (L < 0.8) return false;
      const ox = u.x, oy = u.y;
      u.x += Math.cos(a) * L;
      u.y += Math.sin(a) * L;
      u.face = a;
      Pw.tear(u, ox, oy, u.x, u.y, gy(ox, oy) + 1.1, 0.5);
      if (u.view) Pw.ghost(u.view, '#7a3ac4', 0.35);
      gaon(u, null);
      return true;
    },
  };

  // ---------- 25. Липкие Пальцы: молнии-застёжки ----------
  const zipper = (x, y, a, len, h, dur, u) => {
    Pw.add({
      u, x, y, a, len, h, dur: dur || 1.2,
      update() {
        return this.t < this.dur;
      },
      draw() {
        const k = Math.min(1, this.t / 0.2) * (this.t > this.dur - 0.3 ? (this.dur - this.t) / 0.3 : 1);
        const ca = Math.cos(this.a), sa = Math.sin(this.a), L = this.len * k;
        const h0 = this.h === undefined ? gy(this.x, this.y) + 0.03 : this.h;
        const x0 = this.x - ca * L / 2, z0 = this.y - sa * L / 2;
        Pw.seg(x0, h0, z0, x0 + ca * L, h0, z0 + sa * L, 0.03, '#2a3a6a');
        const n = Math.floor(L / 0.07);
        for (let i = 0; i < n; i++) {
          const f = i * 0.07, s = i % 2 ? 1 : -1;
          Pw.box(x0 + ca * f - sa * s * 0.03, h0 + 0.01, z0 + sa * f + ca * s * 0.03, 0.05, 0.02, 0.03, '#d8dde8', 0, -this.a, 0);
        }
        // приоткрытая щель
        if (this.t < this.dur * 0.7) Pw.seg(x0 + ca * L * 0.2, h0 - 0.01, z0 + sa * L * 0.2, x0 + ca * L * 0.8, h0 - 0.01, z0 + sa * L * 0.8, 0.06 * k, '#05050a');
        Pw.box(x0 + ca * L, h0 + 0.03, z0 + sa * L, 0.06, 0.04, 0.12, '#e8e8f0', 0, -this.a, 0);
      },
    });
  };
  POW.zipBlink = {
    use(u, ab, aim, c) {
      const w = G().world;
      const tg = aim.target && J.dist(u.x, u.y, aim.target.x, aim.target.y) < (ab.range || 7) + 2 ? aim.target : null;
      const a = tg ? Math.atan2(tg.y - u.y, tg.x - u.x) : aim.ang;
      // молния в земле: ныряем и выходим за спиной цели — сквозь стены
      let tx = tg ? tg.x + Math.cos(a) * 1.2 : u.x + Math.cos(a) * (ab.range || 7);
      let ty = tg ? tg.y + Math.sin(a) * 1.2 : u.y + Math.sin(a) * (ab.range || 7);
      let ok = false;
      for (let k = 0; k < 14; k++) {
        const f = 1 - k * 0.07;
        const x = u.x + (tx - u.x) * f, y = u.y + (ty - u.y) * f;
        if (!J.blocked(x, y, u.r * 0.9, {}) && !w.isWater(x, y)) {
          tx = x;
          ty = y;
          ok = true;
          break;
        }
      }
      if (!ok) return false;
      zipper(u.x, u.y, a + Math.PI / 2, 1.2, undefined, 1.1, u);
      if (u.view) Pw.ghost(u.view, '#3d6fd8', 0.3);
      u.x = tx;
      u.y = ty;
      zipper(u.x, u.y, a + Math.PI / 2, 1.2, undefined, 1.1, u);
      snd(u, 'zip', true);
      say(u, null, 'ジッパー!', 'mid', '#bfd0ff', '#0a1a4a');
      Pw.smoke(u.x, gy(u.x, u.y) + 0.1, u.y, 4, '#8a8aa0', 0.4, 0.6, 0.6, 0.3, 0.35);
      if (tg) u.face = Math.atan2(tg.y - u.y, tg.x - u.x);
      u.st.invuln = Math.max(u.st.invuln || 0, 0.15);
      return true;
    },
  };
  // Расстегнуть: тело врага разъезжается по молнии
  const SPLIT = [];
  POW.unzip = {
    use(u, ab, aim, c) {
      const go = () => {
        const tg = aim.target && !aim.target.dead ? aim.target : null;
        const a = u.isPlayer ? J.P.aim(u, ab.range || 1.8).ang : tg ? Math.atan2(tg.y - u.y, tg.x - u.x) : aim.ang;
        u.face = a;
        let hit = null;
        for (const o of G().ents) {
          if (o.dead || !J.hostile(u, o)) continue;
          const d = J.dist(u.x, u.y, o.x, o.y) - o.r;
          if (d > (ab.range || 1.8) || (d > 0.5 && Math.abs(J.angDiff(a, Math.atan2(o.y - u.y, o.x - u.x))) > 0.75)) continue;
          J.hurt(o, ab.dmg * c.pw, u, { stun: ab.stun || 2, knock: 1, kind: c.kind, melee: true, gdmg: 70 });
          if (!hit) hit = o;
        }
        snd(u, 'zip', false);
        if (!hit) {
          if (u.isPlayer) u.whiff = G().t;
          return;
        }
        say(u, hit, 'アリーヴェデルチ!', 'big', '#bfd0ff', '#0a1a4a');
        hit.st.stun = Math.max(hit.st.stun || 0, hit.boss ? 0.8 : ab.stun || 2);
        Pw.add({
          u, o: hit, dur: hit.boss ? 0.9 : 2,
          update() {
            return this.t < this.dur && !this.o.dead;
          },
          draw() {
            const o = this.o, v = o.view;
            const k = Math.min(1, this.t / 0.15) * Math.min(1, (this.dur - this.t) / 0.3);
            if (v && v.spine) {
              v.spine.position.y = 0.98 + 0.22 * k;
              v.spine.rotation.z += 0.25 * k * Math.sin(this.t * 3);
            }
            const b = Pw.body(o, 1.0);
            Pw.hoop(b.x, b.h + 0.04, b.z, 0.2, 0.02, '#2a3a6a', false, 12);
            for (let i = 0; i < 12; i++) {
              const q = (i / 12) * TAU;
              Pw.box(b.x + Math.cos(q) * 0.21, b.h + 0.04 + (i % 2) * 0.02, b.z + Math.sin(q) * 0.21, 0.035, 0.03, 0.03, '#d8dde8', 0, -q, 0);
            }
            Pw.seg(b.x, b.h + 0.04, b.z, b.x, b.h + 0.04 + 0.22 * k, b.z, 0.17 * k, '#0a0a12');
          },
          end() {
            const v = this.o.view;
            if (v && v.spine) v.spine.position.y = 0.98;
          },
        });
      };
      if (u.isPlayer && J.Cb) J.Cb.attack(u, { clip: 'heavy', type: 'heavy', dur: 0.5, at: 0.22, fn: go, stand: true, tg: aim.target, kind: 'heavy', step: 0.3 });
      else {
        u.anim = { type: 'heavy', t: 0.35, max: 0.35, stand: true };
        go();
      }
      return true;
    },
  };

  // ---------- 26. Король Багровый: удар сквозь грудь ----------
  POW.impale = {
    use(u, ab, aim, c) {
      const go = () => {
        const tg = aim.target && !aim.target.dead ? aim.target : null;
        const a = u.isPlayer ? J.P.aim(u, ab.range || 1.8).ang : tg ? Math.atan2(tg.y - u.y, tg.x - u.x) : aim.ang;
        u.face = a;
        let hit = null;
        for (const o of G().ents) {
          if (o.dead || !J.hostile(u, o)) continue;
          const d = J.dist(u.x, u.y, o.x, o.y) - o.r;
          if (d > (ab.range || 1.8) || (d > 0.5 && Math.abs(J.angDiff(a, Math.atan2(o.y - u.y, o.x - u.x))) > (ab.arc || 0.9) / 2 + 0.2)) continue;
          J.hurt(o, ab.dmg * c.pw, u, { knock: ab.knock || 4, stun: ab.stun, kind: c.kind, melee: true, finisher: true, gdmg: 80, ang: a });
          if (!hit) hit = o;
        }
        if (!hit) {
          if (u.isPlayer) u.whiff = G().t;
          return;
        }
        const b = Pw.body(hit, 1.15);
        Pw.blood(b.x + Math.cos(a) * 0.3, b.h, b.z + Math.sin(a) * 0.3, 26, a, 4.5);
        Pw.decal('blood', hit.x + Math.cos(a) * 0.9, hit.y + Math.sin(a) * 0.9, 1.3, 14);
        say(u, hit, 'ドスッ!!', 'fin', '#ffffff', '#7a0a14');
        snd(u, 'heavy', false);
        const col0 = c1Of(u);
        Pw.add({
          u, a, hit, dur: 0.45,
          update() {
            return this.t < this.dur;
          },
          draw() {
            const o = this.hit;
            const k = 1 - this.t / this.dur;
            const bb = Pw.body(o, 1.15);
            const h = Pw.hand(u);
            const ex = bb.x + Math.cos(this.a) * 0.75, ez = bb.z + Math.sin(this.a) * 0.75;
            Pw.seg(h.x, h.h, h.z, ex, bb.h, ez, 0.07 * k + 0.02, col0);
            Pw.box(ex, bb.h, ez, 0.12, 0.12, 0.14, col0, 0, Math.PI / 2 - this.a, 0);
          },
        });
      };
      if (u.isPlayer && J.Cb) J.Cb.attack(u, { clip: 'heavy', type: 'heavy', dur: 0.5, at: 0.24, fn: go, stand: true, tg: aim.target, kind: 'heavy', step: 0.3 });
      else {
        u.anim = { type: 'heavy', t: 0.35, max: 0.35, stand: true };
        go();
      }
      return true;
    },
  };

  // ---------- 27. Стихии: молния с неба, метеоры, разряд, перегрузка, ледяные шипы, струя воды ----------
  // точка удара по прицелу
  const aimSpot = (u, ab, aim) => {
    if (aim.target && !aim.target.dead && J.dist(u.x, u.y, aim.target.x, aim.target.y) < (ab.range || 7) + 1) return { x: aim.target.x, y: aim.target.y };
    return { x: u.x + Math.cos(aim.ang) * (ab.range || 6), y: u.y + Math.sin(aim.ang) * (ab.range || 6) };
  };
  Pw.skyBolt = function (u, x, y, color) {
    const h = gy(x, y);
    Pw.add({
      u, x, y, h, dur: 0.32, ox: (rnd() - 0.5) * 6, oz: (rnd() - 0.5) * 6,
      update() {
        return this.t < this.dur;
      },
      draw() {
        const k = 1 - this.t / this.dur;
        if (rnd() < 0.85) Pw.bolt(this.x + this.ox, this.h + 26, this.y + this.oz, this.x, this.h + 0.1, this.y, color || '#dfe8ff', 1.1, 0.09 + 0.06 * k, 26);
        if (rnd() < 0.4) Pw.bolt(this.x, this.h + 6, this.y, this.x + (rnd() - 0.5) * 3, this.h + 0.1, this.y + (rnd() - 0.5) * 3, color || '#dfe8ff', 0.4, 0.04, 8);
      },
    });
    Pw.light(x, h + 3, y, '#dfe8ff', 6, 22, 0.3);
    Pw.decal('scorch', x, y, 1.8, 10);
    Pw.glow(x, h + 0.3, y, 18, '#fff6c8', 6, 0.1, 0.4, 6);
    Pw.smoke(x, h + 0.2, y, 6, '#4a4a52', 0.5, 1.2, 1, 0.5, 0.5);
    if (fxOn() && near(u, { x, y }, 40)) {
      J.Fx.flash('#ffffff', 0.05, 0.55);
      J.Fx.trauma(0.3);
      J.Fx.word('ピシャーン!!', x, y, h + 2, 'big', '#fff6a8', '#1a1a4a');
    }
    snd(u, 'thunder');
  };
  POW.lightning = {
    use(u, ab, aim, c) {
      const s = aimSpot(u, ab, aim);
      u.anim = { type: 'cast', t: 0.35, max: 0.35, stand: true };
      Pw.skyBolt(u, s.x, s.y, '#e8f0ff');
      J.hitCircle(u, s.x, s.y, ab.radius || 1.8, ab.dmg * c.pw, { fx: ab.fx, kind: c.kind, knock: 3, gdmg: 50 });
      return true;
    },
  };
  // Метеорит: с неба по дуге, предупреждение-кольцо, кратер и пламя
  Pw.meteor = function (u, x, y, r, dmg, fx, delay, big) {
    const h0 = gy(x, y);
    const fromA = rnd() * TAU;
    R3.ring(x, y, r, '#ff5a2a', delay);
    Pw.add({
      u, x, y, r, delay, sx: x + Math.cos(fromA) * 14, sz: y + Math.sin(fromA) * 14, sh: h0 + 30, hit: false,
      update() {
        if (!this.hit && this.t >= this.delay) {
          this.hit = true;
          Pw.explosion(this.x, this.y, this.r * 1.1, '#ffb070');
          Pw.decal('crater', this.x, this.y, this.r * 1.6, 14);
          J.hitCircle(u, this.x, this.y, this.r, dmg, { fx, kind: 'fire', knock: 5, gdmg: 60, finisher: big });
          if (fxOn() && near(u, this, 40)) J.Fx.word('ズドォォン!!', this.x, this.y, h0 + 2, big ? 'fin' : 'big', '#ffffff', '#5a1a00');
          if (big) Pw.firePillar(u, this.x, this.y, dmg * 0.15, 1.2);
        }
        return this.t < this.delay + 0.05;
      },
      draw(dt) {
        if (this.hit) return;
        const k = Math.min(1, this.t / this.delay);
        const x1 = this.sx + (this.x - this.sx) * k, z1 = this.sz + (this.y - this.sz) * k, h1 = this.sh + (h0 - this.sh) * k;
        const s = 0.35 * this.r;
        Pw.sph(x1, h1, z1, s, '#3a2a22', 1);
        Pw.orb(x1, h1, z1, s * 2.2, '#ff7a2a');
        const vx = (this.x - this.sx) / this.delay, vz = (this.y - this.sz) / this.delay, vh = (h0 - this.sh) / this.delay;
        if (dt > 0) {
          Pw.fire(x1, h1, z1, 3, s * 0.5, 0.3, s * 3, -vx * 0.15, -vz * 0.15);
          Pw.smoke(x1 - vx * 0.05, h1 - vh * 0.05, z1 - vz * 0.05, 1, '#3a3330', s * 2, 1.4, 0, 0.1, 0.55);
        }
        Pw.light(x1, h1, z1, '#ff7a2a', 2.5, 14, 0.08);
      },
    });
  };
  POW.meteor = {
    use(u, ab, aim, c) {
      u.anim = { type: 'cast', t: 0.4, max: 0.4, stand: true };
      say(u, null, ab.radius > 4 ? '流星群!!' : 'メテオ!', 'big', '#ffb03a', '#4a0a00');
      if (ab.radius > 4) {
        // звездопад: много метеоров вокруг
        const n = 7;
        for (let i = 0; i < n; i++) {
          const a = rnd() * TAU, r = i === 0 ? 0 : 1.5 + rnd() * (ab.radius - 1);
          const cx = (aim.target ? aim.target.x : u.x) + Math.cos(a) * r, cy = (aim.target ? aim.target.y : u.y) + Math.sin(a) * r;
          Pw.meteor(u, cx, cy, 1.8, ab.dmg * c.pw * 0.45, ab.fx, (ab.delay || 1) + i * 0.18, i === 0);
        }
        return true;
      }
      const s = aimSpot(u, ab, aim);
      Pw.meteor(u, s.x, s.y, ab.radius || 2, ab.dmg * c.pw, ab.fx, ab.delay || 0.6, false);
      return true;
    },
  };
  // Разряд: ветвистая молния от руки до цели держится долю секунды
  POW.elecBeam = {
    use(u, ab, aim, c) {
      return windup(u, aim, 0.1, ab.color || '#ffe14a', () => {
        const a = fireAng(u, aim, ab.range || 7);
        u.face = a;
        u.anim = { type: 'cast', t: 0.35, max: 0.35, stand: true };
        const L = freeLen(u.x, u.y, a, ab.range || 7);
        hitLine(u, u.x, u.y, a, L, (ab.width || 0.35) + 0.3, ab.dmg * c.pw, { fx: ab.fx, kind: c.kind, knock: 2 });
        const ex = u.x + Math.cos(a) * L, ez = u.y + Math.sin(a) * L;
        Pw.burst('elec', ex, gy(ex, ez) + 1.1, ez, 0.8, a, ab.color);
        snd(u, 'zap', 1);
        say(u, null, 'バリバリッ', 'mid', '#fff6a8', '#1a1a4a');
        Pw.add({
          u, a, L, dur: 0.3,
          update() {
            return this.t < this.dur;
          },
          draw() {
            const h = Pw.hand(u);
            const ex2 = u.x + Math.cos(this.a) * this.L, ez2 = u.y + Math.sin(this.a) * this.L;
            Pw.bolt(h.x, h.h, h.z, ex2, gy(ex2, ez2) + 1.05, ez2, ab.color || '#ffe14a', 0.35, 0.06);
            if (rnd() < 0.5) Pw.bolt(h.x, h.h, h.z, ex2 + (rnd() - 0.5), gy(ex2, ez2) + 0.8, ez2 + (rnd() - 0.5), '#ffffff', 0.5, 0.025);
            Pw.light(h.x, h.h, h.z, '#ffe8a0', 1.8, 8, 0.06);
          },
        });
      });
    },
  };
  POW.overload = {
    use(u, ab, aim, c) {
      return windup(u, aim, 0.25, '#ffe14a', () => {
        const R = ab.radius || 4;
        u.anim = { type: 'pose', t: 0.4, max: 0.4 };
        const list = [];
        for (const o of G().ents) if (!o.dead && J.hostile(u, o) && J.dist(u.x, u.y, o.x, o.y) < R + o.r) list.push(o);
        J.hitCircle(u, u.x, u.y, R, ab.dmg * c.pw, { fx: ab.fx, kind: c.kind, knock: ab.knock || 3, gdmg: 45 });
        snd(u, 'thunder');
        shout(u, 'オーバーロード!!', '#fff6a8', '#1a1a4a');
        R3.ring(u.x, u.y, R * 1.1, '#ffe14a', 0.45);
        Pw.light(u.x, gy(u.x, u.y) + 1.5, u.y, '#ffe8a0', 5, 14, 0.5);
        Pw.add({
          u, list, dur: 0.5,
          update() {
            return this.t < this.dur;
          },
          draw() {
            const b = Pw.body(u, 1.2);
            for (const o of this.list) {
              const t = Pw.body(o);
              if (rnd() < 0.8) Pw.bolt(b.x, b.h, b.z, t.x, t.h, t.z, '#ffe14a', 0.4, 0.06);
            }
            for (let i = 0; i < 4; i++) {
              const a = rnd() * TAU, L = R * (0.4 + rnd() * 0.6);
              Pw.bolt(b.x, b.h, b.z, b.x + Math.cos(a) * L, gy(u.x, u.y) + 0.05, b.z + Math.sin(a) * L, '#fff2a0', 0.35, 0.04, 8);
            }
          },
        });
      });
    },
  };
  // Ледяные шипы вырастают из земли под врагами
  Pw.iceSpikes = function (u, x, y, R, n, dur) {
    const sp = [];
    for (let i = 0; i < n; i++) {
      const a = rnd() * TAU, r = Math.sqrt(rnd()) * R;
      sp.push({ x: x + Math.cos(a) * r, y: y + Math.sin(a) * r, L: 0.5 + rnd() * 1.1, tx: (rnd() - 0.5) * 0.6, tz: (rnd() - 0.5) * 0.6, d: rnd() * 0.15 });
    }
    Pw.decal('frost', x, y, R * 2.2, dur + 4);
    Pw.add({
      u, sp, dur, shat: false,
      update() {
        if (!this.shat && this.t > this.dur - 0.05) {
          this.shat = true;
          for (const s of this.sp) if (rnd() < 0.5) Pw.shards(s.x, gy(s.x, s.y) + s.L * 0.5, s.y, 3, '#cfeeff', 3, 0.07, 0);
          snd(u, 'ice');
        }
        return this.t < this.dur;
      },
      draw() {
        for (const s of this.sp) {
          const k = J.clamp((this.t - s.d) / 0.12, 0, 1) * (this.t > this.dur - 0.25 ? (this.dur - this.t) / 0.25 : 1);
          if (k <= 0) continue;
          Pw.spike(s.x, gy(s.x, s.y) - 0.05, s.y, s.tx, 1, s.tz, s.L * k, 0.11 + s.L * 0.05, '#bfe9ff');
        }
      },
    });
  };
  POW.iceCage = {
    use(u, ab, aim, c) {
      return windup(u, aim, 0.18, '#a7e3ff', () => {
        const R = ab.radius || 3;
        u.anim = { type: 'cast', t: 0.35, max: 0.35, stand: true };
        Pw.iceSpikes(u, u.x, u.y, R, 22, 1.8);
        for (const o of G().ents) if (!o.dead && J.hostile(u, o) && J.dist(u.x, u.y, o.x, o.y) < R + o.r) Pw.iceSpikes(u, o.x, o.y, 0.6, 7, 1.8);
        J.hitCircle(u, u.x, u.y, R, ab.dmg * c.pw, { fx: ab.fx, kind: c.kind, knock: 1, gdmg: 40 });
        Pw.smoke(u.x, gy(u.x, u.y) + 0.2, u.y, 14, '#eef8ff', 0.8, 1.2, 0.3, R * 0.6, 0.45);
        snd(u, 'ice');
        say(u, null, 'ピキィン!', 'big', '#dff4ff', '#0a2a4a');
        if (fxOn() && near(u, null, 25)) J.Fx.flash('#cfefff', 0.06, 0.35);
      });
    },
  };
  // Режущий поток воды под давлением
  POW.waterJet = {
    use(u, ab, aim, c) {
      return windup(u, aim, 0.16, '#7fc4ff', () => {
        const a = fireAng(u, aim, ab.range || 10);
        u.face = a;
        const L = freeLen(u.x, u.y, a, ab.range || 10);
        hitLine(u, u.x, u.y, a, L, (ab.width || 0.5) + 0.2, ab.dmg * c.pw, { fx: ab.fx, kind: c.kind, knock: 3 });
        snd(u, 'water');
        Pw.add({
          u, a, L, dur: 0.45,
          update() {
            return this.t < this.dur;
          },
          draw(dt) {
            const k = 1 - this.t / this.dur;
            const h = Pw.hand(u);
            const ex = u.x + Math.cos(this.a) * this.L, ez = u.y + Math.sin(this.a) * this.L, eh = gy(ex, ez) + 1;
            Pw.gseg(h.x, h.h, h.z, ex, eh, ez, 0.12 * k + 0.03, '#5ab3ff');
            Pw.seg(h.x, h.h, h.z, ex, eh, ez, 0.03 * k + 0.01, '#e8f6ff');
            if (dt > 0) {
              for (let i = 0; i < 3; i++) {
                const a2 = this.a + Math.PI + (rnd() - 0.5) * 2.4, v = 2 + rnd() * 3;
                Pw.puff(ex, eh, ez, Math.cos(a2) * v, 1 + rnd() * 2, Math.sin(a2) * v, 0.45, 0.06, 0.03, '#dff0ff', '#5ab3ff', 9, 0.9, false);
              }
              if (rnd() < 0.5) Pw.smoke(ex, eh - 0.3, ez, 1, '#e8f4ff', 0.4, 0.6, 0.3, 0.3, 0.3);
            }
          },
        });
        Pw.decal('water', u.x + Math.cos(a) * L, u.y + Math.sin(a) * L, 1.5, 6);
      });
    },
  };
  // Си-Мун: гравитация наизнанку — враги взлетают, переворачиваясь
  POW.gravity = {
    use(u, ab, aim, c) {
      return windup(u, aim, 0.2, '#7dff9b', () => {
        const R = ab.radius || 5;
        const zeroG = ab.style === 'zerog';
        u.anim = { type: 'cast', t: 0.4, max: 0.4, stand: true };
        R3.ring(u.x, u.y, R, ab.color || '#7dff9b', 0.6);
        Pw.burst(zeroG ? 'wind' : 'gravity', u.x, gy(u.x, u.y) + 0.5, u.y, 1.4, null, ab.color);
        snd(u, 'whoosh', 0.4, true, 0.16);
        say(u, null, zeroG ? 'フワッ' : 'グルン!', 'big', ab.color || '#7dff9b', '#0a2a1a');
        for (const o of G().ents) {
          if (o.dead || !J.hostile(u, o)) continue;
          const d = J.dist(u.x, u.y, o.x, o.y);
          if (d > R + o.r) continue;
          const a = Math.atan2(o.y - u.y, o.x - u.x);
          J.hurt(o, ab.dmg * c.pw, u, { fx: ab.fx, kind: c.kind, knock: 0, gdmg: 40, ang: a });
          if (!o.dead && !o.boss && J.Cb) {
            J.Cb.launch(o, a, zeroG ? 2 : ab.knock || 8, false);
            if (zeroG) {
              // невесомость: долгий плавный подъём
              o.kz = 5;
              o.airDur = 1.4;
              o.airSpin = -0.6;
            }
          }
          Pw.glow(o.x, gy(o.x, o.y) + 0.3, o.y, 8, ab.color || '#7dff9b', 1, 0.08, 0.7, -5);
        }
      });
    },
  };

  // ---------- 28. Эхо: звуки становятся реальностью ----------
  const ECHO_W = ['ドジュウウ', 'ボヨヨン', 'ドドドド', 'ズキュン', 'ドゴォン'];
  POW.soundWord = {
    use(u, ab, aim, c) {
      const a = fireAng(u, aim, ab.range || 12);
      u.face = a;
      u.anim = { type: 'cast', t: 0.3, max: 0.3, stand: true };
      snd(u, 'word');
      const W = ab.word || ECHO_W[(rnd() * ECHO_W.length) | 0];
      fan(u, ab, a, c, { shape: 'sound', theme: 'sound', word: W, stick: ab.explode ? 0 : 3 });
      return true;
    },
  };
  // слово прилипло к цели и звучит снова и снова
  Pw.stickWord = function (o, word, color, dur, u) {
    const s = Pw.wordSprite(word, color);
    if (!s) return;
    Pw.add({
      u, o, s, dur, beat: 0,
      update(dt) {
        this.beat -= dt;
        if (this.beat <= 0) {
          this.beat = 0.5;
          if (near(u, this.o, 18) && J.Sfx) J.Sfx.word();
          this.o.st.slow = Math.max(this.o.st.slow || 0, 0.6);
        }
        return this.t < this.dur && !this.o.dead;
      },
      draw() {
        const b = Pw.body(this.o, 1.5);
        const p = 1 + Math.sin(this.t * 12) * 0.12;
        this.s.sp.position.set(b.x, b.h + 0.2, b.z);
        this.s.sp.scale.set(1.3 * p, 0.65 * p, 1);
        this.s.sp.material.rotation = Math.sin(this.t * 7) * 0.2;
        this.s.sp.material.opacity = Math.min(1, (this.dur - this.t) * 3);
      },
      end() {
        Pw.freeSprite(this.s);
      },
    });
  };

  // ---------- 29. Золотой Опыт: жизнь из неживого — дерево, лягушки ----------
  Pw.lifeTree = function (u, x, y, life, pw) {
    const h0 = gy(x, y);
    Pw.glow(x, h0 + 0.3, y, 24, '#ffd84a', 2.5, 0.12, 0.8, -2);
    Pw.decal('gold', x, y, 2.2, life);
    snd(u, 'life');
    Pw.add({
      u, x, y, life, rooted: false, tick: 0,
      update(dt) {
        this.tick -= dt;
        if (this.t > 0.6 && this.tick <= 0) {
          this.tick = 1.2;
          // корни хватают врагов рядом с деревом
          for (const o of G().ents) {
            if (o.dead || !J.hostile(u, o) || J.dist(o.x, o.y, this.x, this.y) > 2.2 + o.r) continue;
            o.st.root = Math.max(o.st.root || 0, o.boss ? 0.6 : 1.4);
            o.st.bound = o.st.root;
            o._bindC = '#7ed957';
            J.hurt(o, 5 * (pw || 1), u, { dot: true, kind: 'phys' });
          }
        }
        return this.t < this.life;
      },
      draw(dt) {
        const g = Math.min(1, this.t / 0.6) * (this.t > this.life - 0.6 ? (this.life - this.t) / 0.6 : 1);
        if (g <= 0) return;
        const H = 2.6 * g;
        Pw.seg(this.x, h0, this.y, this.x + 0.05, h0 + H, this.y, 0.14 * g + 0.02, '#6a4a2a');
        for (let i = 0; i < 3; i++) {
          const a = i * 2.1 + 0.4;
          Pw.seg(this.x, h0 + H * 0.55, this.y, this.x + Math.cos(a) * 0.7 * g, h0 + H * 0.85, this.y + Math.sin(a) * 0.7 * g, 0.05 * g, '#6a4a2a');
          Pw.seg(this.x, h0 + 0.05, this.y, this.x + Math.cos(a + 1) * 0.9 * g, h0 + 0.02, this.y + Math.sin(a + 1) * 0.9 * g, 0.05 * g, '#5a3a1a');
        }
        for (let i = 0; i < 9; i++) {
          const a = i * 2.39, r = (0.35 + (i % 3) * 0.25) * g;
          Pw.gem(this.x + Math.cos(a) * r, h0 + H * (0.8 + (i % 4) * 0.1), this.y + Math.sin(a) * r, 0.32 * g, i % 2 ? '#4a9a3a' : '#5aba4a', 0.3, a, 1);
        }
        if (dt > 0 && rnd() < 0.2) Pw.glow(this.x + (rnd() - 0.5), h0 + H * 0.9, this.y + (rnd() - 0.5), 1, '#ffd84a', 0.4, 0.07, 0.8, 0.5);
      },
    });
  };

  // ---------- 30. Секс Пистолз: пуля получает пинок к цели ----------
  Pw.kick = function (p) {
    if (!(p.kick > 0)) return false;
    const tg = J.nearestHostile(p, 12);
    if (!tg) return false;
    p.kick--;
    const a = Math.atan2(tg.y - p.y, tg.x - p.x);
    // отскок от стены — шаг назад, чтобы не застрять
    p.x -= p.vx * 0.03;
    p.y -= p.vy * 0.03;
    p.vx = Math.cos(a) * p.speed;
    p.vy = Math.sin(a) * p.speed;
    p.life = Math.max(p.life, J.dist(p.x, p.y, tg.x, tg.y) / p.speed + 0.3);
    p.hits.clear();
    const h = gy(p.x, p.y) + (p.h || 1);
    // крошечный стенд пинает пулю
    Pw.add({
      u: p.owner, x: p.x, h, z: p.y, a,
      update() {
        return this.t < 0.3;
      },
      draw() {
        const k = 1 - this.t / 0.3;
        Pw.sph(this.x - Math.cos(this.a) * 0.18, this.h + 0.05, this.z - Math.sin(this.a) * 0.18, 0.09 * (0.5 + k), '#f2d14a', 1);
        Pw.orb(this.x, this.h, this.z, 0.18 * k, '#fff2a8');
      },
    });
    if (fxOn() && near(p.owner, null, 25)) {
      J.Fx.sparks(p.x, h, p.y, 6, a, '#ffe9a8', 5);
      if (rnd() < 0.5) J.Fx.word(['イィーハー!', 'パス!', 'No.5!'][(rnd() * 3) | 0], p.x, p.y, h + 0.4, 'sm', '#ffe066', '#3a2a0a');
    }
    snd(p.owner, 'shot', 0.4);
    return true;
  };

  // ---------- 31. Отдельные декорации для общих видов способностей ----------
  // Выстрел: вспышка у руки по теме
  Pw.fxShoot = function (u, ab, ang) {
    if (!Pw.ready || !near(u, null, 35)) return;
    const h = Pw.hand(u);
    const th = Pw.shapeTheme(ab.proj);
    Pw.surge(u, 0.6);
    if (th === 'metal' && (ab.proj === 'bullet')) {
      Pw.orb(h.x, h.h, h.z, 0.01, '#ffffff');
      Pw.puff(h.x + Math.cos(ang) * 0.15, h.h, h.z + Math.sin(ang) * 0.15, Math.cos(ang) * 2, 0.2, Math.sin(ang) * 2, 0.08, 0.35, 0.1, '#ffe6a0', '#ff8a2a', 0, 1);
      Pw.smoke(h.x, h.h, h.z, 2, '#9a9490', 0.15, 0.7, 0.3, 0.05, 0.4);
      Pw.light(h.x, h.h, h.z, '#ffd08a', 1.4, 6, 0.06);
      snd(u, 'shot', ab.dmg > 40 ? 1.2 : 0.7);
    } else if (th === 'fire') {
      Pw.fire(h.x, h.h, h.z, 5, 0.12, 1, 0.35);
      snd(u, 'fire', 0.6);
    } else if (th === 'ice') {
      Pw.smoke(h.x, h.h, h.z, 3, '#eef8ff', 0.3, 0.6, 0.2, 0.1, 0.4);
      snd(u, 'ice');
    } else if (th === 'water') {
      Pw.burst('water', h.x, h.h, h.z, 0.4, ang + Math.PI);
      snd(u, 'water');
    } else if (th === 'emerald' || th === 'pink') {
      Pw.glow(h.x, h.h, h.z, 6, ab.color || TH[th], 2, 0.08, 0.3);
      snd(u, 'glass');
    } else if (th === 'metal') {
      Pw.glow(h.x, h.h, h.z, 4, '#ffffff', 1.5, 0.06, 0.2);
      snd(u, 'whoosh', 0.12, false, 0.1);
    } else {
      Pw.glow(h.x, h.h, h.z, 6, ab.color || c1Of(u), 2, 0.09, 0.3);
      snd(u, 'whoosh', 0.14, true, 0.08);
    }
  };
  // Луч: слой под тему (молния, вода, леска, плоть)
  Pw.fxBeam = function (u, ab, ang, L) {
    if (!Pw.ready) return;
    const th = themeOf(u, ab);
    const ex = u.x + Math.cos(ang) * L, ez = u.y + Math.sin(ang) * L, eh = gy(ex, ez) + 1.1;
    const c = ab.color || c1Of(u);
    Pw.surge(u, 0.8);
    Pw.burst(th === 'energy' ? 'energy' : th, ex, eh, ez, 0.6, ang, c);
    Pw.light(ex, eh, ez, c, 1.4, 7, 0.2);
    if (th === 'elec') snd(u, 'zap', 0.8);
    else if (th === 'water') snd(u, 'water');
    else snd(u, 'whoosh', 0.16, false, 0.12);
  };
  // Волна вокруг / в точке
  Pw.fxNova = function (u, ab, cx, cy) {
    if (!Pw.ready) return;
    const th = themeOf(u, ab);
    const R = ab.radius || 3;
    const c = ab.color || TH[th] || c1Of(u);
    const h = gy(cx, cy);
    Pw.surge(u, 1);
    switch (th) {
      case 'fire':
        for (let i = 0; i < 18; i++) {
          const a = (i / 18) * TAU;
          Pw.fire(cx + Math.cos(a) * R * 0.3, h + 0.1, cy + Math.sin(a) * R * 0.3, 2, 0.15, 1.4, 0.45, Math.cos(a) * R * 1.2, Math.sin(a) * R * 1.2);
        }
        Pw.light(cx, h + 1, cy, '#ff8a2a', 3, R * 3, 0.45);
        Pw.decal('scorch', cx, cy, R * 1.6, 10);
        snd(u, 'fire', 1.2);
        break;
      case 'ice':
        Pw.iceSpikes(u, cx, cy, R, Math.round(8 + R * 3), 1.4);
        snd(u, 'ice');
        break;
      case 'elec':
        for (let i = 0; i < 6; i++) Pw.zap(cx + (rnd() - 0.5) * R, h + 0.4 + rnd(), cy + (rnd() - 0.5) * R, 0.3, 1.4, c);
        Pw.light(cx, h + 1.5, cy, '#dfe8ff', 3.5, R * 3, 0.3);
        snd(u, 'zap', 1.2);
        break;
      case 'sand':
      case 'rock':
        Pw.smoke(cx, h + 0.2, cy, 22, th === 'sand' ? '#d9b77a' : '#9a8c7a', 0.9, 1.6, 1.4, R * 0.5, 0.65);
        Pw.decal(th === 'sand' ? 'sand' : 'crater', cx, cy, R * 1.8, 8);
        if (fxOn()) J.Fx.debris(cx, h + 0.3, cy, 0, 0, 18, th === 'sand' ? '#c9a46b' : '#7a6e60');
        break;
      case 'poison':
        Pw.smoke(cx, h + 0.3, cy, 18, c, 0.8, 2, 0.5, R * 0.6, 0.5);
        Pw.glow(cx, h + 0.6, cy, 12, c, 2, 0.1, 1, -1, R);
        break;
      case 'dark':
        Pw.smoke(cx, h + 0.3, cy, 18, '#120820', 0.9, 1.4, 0.8, R * 0.5, 0.8);
        Pw.glow(cx, h + 0.8, cy, 16, c, 4, 0.12, 0.6, 0);
        if (fxOn() && near(u, null, 25)) J.Fx.flash('#1a0a2a', 0.08, 0.35);
        break;
      case 'sound':
        for (let i = 0; i < 3; i++) R3.ring(cx, cy, R * (0.6 + i * 0.35), c, 0.35 + i * 0.12);
        Pw.wordBurst(cx, cy, h + 1.4, ab.word || ['キィィン', 'ドォン', 'ジュウウウ'][(rnd() * 3) | 0], c, 0.9, true);
        snd(u, 'word');
        break;
      case 'pink':
        Pw.glow(cx, h + 1, cy, 20, c, 5, 0.12, 0.5);
        Pw.shards(cx, h + 1, cy, 10, c, 5, 0.08, 0);
        break;
      case 'gold':
      case 'life':
        Pw.glow(cx, h + 0.5, cy, 22, c, 4, 0.12, 0.7, -1.5);
        Pw.light(cx, h + 1, cy, c, 2.5, R * 3, 0.4);
        break;
      default:
        Pw.glow(cx, h + 0.8, cy, 18, c, 4.5, 0.11, 0.5);
        Pw.light(cx, h + 1, cy, c, 2, R * 3, 0.3);
    }
  };
  // Удар: след взмаха и кратер у сильных ударов
  Pw.fxStrike = function (u, ab, a, n) {
    if (!Pw.ready) return;
    const R = (ab.range || 1.8) + 0.2;
    const c = ab.color || c2Of(u);
    const sd = sdOf(u);
    const blade = sd && (sd.extra === 'sword' || sd.extra === 'scythe');
    Pw.surge(u, 0.9);
    // дуга взмаха
    Pw.add({
      u, a, R, c, blade, dur: 0.18,
      update() {
        return this.t < this.dur;
      },
      draw() {
        const k = this.t / this.dur;
        const h = gy(u.x, u.y) + 1.15;
        const span = this.blade ? 1.6 : 0.9;
        const m = 7;
        for (let i = 0; i < m; i++) {
          const f0 = i / m, f1 = (i + 1) / m;
          if (f1 > k * 1.4) break;
          const a0 = this.a - span / 2 + span * f0, a1 = this.a - span / 2 + span * f1;
          C.set(this.c).multiplyScalar((1 - k) * (0.4 + f1));
          Pw.gseg(u.x + Math.cos(a0) * this.R, h + (f0 - 0.5) * 0.4, u.y + Math.sin(a0) * this.R, u.x + Math.cos(a1) * this.R, h + (f1 - 0.5) * 0.4, u.y + Math.sin(a1) * this.R, this.blade ? 0.05 : 0.09, C);
        }
      },
    });
    if (n && (ab.knock || 3) >= 6) {
      const x = u.x + Math.cos(a) * 1.3, y = u.y + Math.sin(a) * 1.3;
      Pw.decal('crater', x, y, 1.6, 8);
      if (fxOn()) J.Fx.debris(x, gy(x, y) + 0.3, y, Math.cos(a), Math.sin(a), 12, '#7a6e60');
      Pw.smoke(x, gy(x, y) + 0.2, y, 6, '#a89a88', 0.6, 0.9, 0.6, 0.6, 0.45);
    }
    if (n && ab.fx && ab.fx.bleed) Pw.blood(u.x + Math.cos(a) * 1.2, gy(u.x, u.y) + 1.1, u.y + Math.sin(a) * 1.2, 10, a, 3);
    if (n && ab.fx && ab.fx.age) Pw.smoke(u.x + Math.cos(a) * 1.2, gy(u.x, u.y) + 1, u.y + Math.sin(a) * 1.2, 6, '#9a8aa8', 0.4, 1, 0.3, 0.3, 0.4);
  };
  // Мгновенное перемещение: портал под тему стенда
  Pw.fxBlink = function (u, ab, x0, y0) {
    if (!Pw.ready) return;
    const id = u.stand ? u.stand.id : '';
    const a = Math.atan2(u.y - y0, u.x - x0);
    const c = c1Of(u);
    const both = (fn) => {
      fn(x0, y0);
      fn(u.x, u.y);
    };
    if (id === 'man_in_the_mirror') {
      // зеркало: стеклянная панель на входе и выходе
      both((x, y) =>
        Pw.add({
          u, x, y, a, dur: 0.6,
          update() {
            return this.t < this.dur;
          },
          draw() {
            const k = Math.min(1, this.t / 0.1) * (1 - this.t / this.dur);
            const h = gy(this.x, this.y) + 1;
            Pw.box(this.x, h, this.y, 0.9 * k, 1.9 * k, 0.03, '#dfe8f7', 0, Math.PI / 2 - this.a + Math.PI / 2, 0);
            Pw.gseg(this.x, h - 0.95 * k, this.y, this.x, h + 0.95 * k, this.y, 0.05, '#ffffff');
          },
        })
      );
      snd(u, 'glass');
    } else if (id === 'd4c' || id === 'love_train') {
      // между двумя предметами — в соседний мир: вертикальная световая щель
      both((x, y) =>
        Pw.add({
          u, x, y, dur: 0.5,
          update() {
            return this.t < this.dur;
          },
          draw() {
            const k = 1 - this.t / this.dur;
            const h = gy(this.x, this.y);
            Pw.gseg(this.x, h, this.y, this.x, h + 2.2, this.y, 0.25 * k, '#ffe9a8');
            Pw.gseg(this.x, h, this.y, this.x, h + 2.2, this.y, 0.06 * k, '#ffffff');
          },
        })
      );
      if (u.isPlayer && fxOn()) J.Fx.flash('#fff2c8', 0.06, 0.3);
      say(u, null, 'ドジャァーン', 'mid', '#ffe9a8', '#1a1a4a');
    } else if (/^tusk/.test(id)) {
      both((x, y) => Pw.decal('void', x, y, 1.2, 1.5));
      both((x, y) => Pw.glow(x, gy(x, y) + 0.2, y, 12, '#ffd34a', 2, 0.08, 0.5, -3));
    } else if (id === 'catch_the_rainbow') {
      both((x, y) => Pw.burst('water', x, gy(x, y) + 1, y, 0.8));
    } else if (id === 'achtung_baby' || id === 'wonder_of_u') {
      both((x, y) => Pw.smoke(x, gy(x, y) + 0.8, y, 8, id === 'wonder_of_u' ? '#3a2e24' : '#d6e8ff', 0.5, 0.9, 0.3, 0.4, 0.4));
    } else {
      both((x, y) => Pw.glow(x, gy(x, y) + 1, y, 12, c, 2.5, 0.1, 0.4));
    }
    // светящийся след пути
    Pw.add({
      u, x0, y0, x1: u.x, y1: u.y, c, dur: 0.3,
      update() {
        return this.t < this.dur;
      },
      draw() {
        const k = 1 - this.t / this.dur;
        C.set(this.c).multiplyScalar(k);
        Pw.gseg(this.x0, gy(this.x0, this.y0) + 1, this.y0, this.x1, gy(this.x1, this.y1) + 1, this.y1, 0.12 * k, C);
      },
    });
  };
  // Рывок: начало и след на каждом кадре
  Pw.fxDash = function (u, ab) {
    if (!Pw.ready) return;
    Pw.surge(u, 0.8);
    const id = u.stand ? u.stand.id : '';
    if (id === 'red_hot_chili_pepper') snd(u, 'zap', 0.8);
    else if (id === 'oasis') snd(u, 'water');
    else snd(u, 'whoosh', 0.22, true, 0.12);
  };
  Pw.dashTick = function (e, d, dt) {
    if (!Pw.ready || dt <= 0) return;
    const id = e.stand ? e.stand.id : '';
    const h = gy(e.x, e.y);
    d.gt = (d.gt || 0) - dt;
    const ghost = d.gt <= 0;
    if (ghost) d.gt = 0.05;
    if (id === 'red_hot_chili_pepper') {
      if (ghost) Pw.zap(e.x, h + 1, e.y, 0.15, 1, '#ffe14a');
      Pw.light(e.x, h + 1, e.y, '#ffe8a0', 1.5, 6, 0.06);
    } else if (id === 'black_sabbath') {
      Pw.smoke(e.x, h + 0.2, e.y, 2, '#0a0610', 0.5, 0.6, 0.1, 0.3, 0.8);
    } else if (id === 'oasis') {
      Pw.smoke(e.x, h + 0.1, e.y, 2, '#8a6a3a', 0.5, 0.7, 0.6, 0.3, 0.6);
      if (ghost) R3.ring(e.x, e.y, 1, '#8a6a3a', 0.35);
    } else if (id === 'cream') {
      Pw.smoke(e.x, h + 0.6, e.y, 2, '#120820', 0.6, 0.6, 0.2, 0.3, 0.85);
      if (ghost) Pw.decal('void', e.x, e.y, 1.4, 5);
    } else if (id === 'anubis') {
      if (ghost) Pw.glow(e.x, h + 1, e.y, 3, '#e8eefc', 1, 0.07, 0.2);
    } else if (ghost && e.view) Pw.ghost(e.view, c1Of(e), 0.28);
    if (ghost && e.standView && e.standView.group.visible) Pw.ghost(e.standView, c1Of(e), 0.25);
  };
  // Захват (без своей силы): тонкий жгут под цвет стенда
  Pw.fxPull = function (u, ab, tg) {
    if (!Pw.ready) return;
    const c = c1Of(u);
    Pw.add({
      u, tg, dur: 0.35,
      update() {
        return this.t < this.dur;
      },
      draw() {
        const h = Pw.hand(u);
        const b = Pw.body(this.tg, 0.95);
        const n = 12;
        const pts = ropePts(h.x, h.h, h.z, b.x, b.h, b.z, 1, 0.1, this.t, n);
        Pw.chain(pts, n, 0.025, c);
        Pw.chain(pts, n, 0.06, c, true);
      },
    });
    snd(u, 'whip');
  };
  // Порча (hex): видимая нить к цели и вспышка по статусу
  const HEX_C = { charm: '#ff8ad8', sleep: '#8a7ad8', book: '#2b2b33', drain: '#ff3a4a', mark2: '#ff5fa2', bleed: '#c4283c', age: '#9b7ad1', heavy: '#ffd23f', slow: '#a6ff7e', root: '#dbe87a', silence: '#dfe8f7', soft: '#ff6fae' };
  Pw.fxHex = function (u, ab, tg, victims) {
    if (!Pw.ready) return;
    const st = ab.status;
    const c = HEX_C[st] || c1Of(u);
    Pw.surge(u, 0.9);
    for (const v of victims) {
      if (st === 'charm') v._charmC = c1Of(u);
      const b = Pw.body(v, 1.1);
      switch (st) {
        case 'bleed':
          // бритвы изнутри
          Pw.shards(b.x, b.h, b.z, 10, '#c9ccd6', 3.5, 0.06, 2, null, 2);
          Pw.blood(b.x, b.h, b.z, 14, null, 3);
          Pw.decal('blood', v.x, v.y, 1.2, 10);
          break;
        case 'age':
          Pw.smoke(b.x, b.h, b.z, 8, '#9b7ad1', 0.5, 1.4, 0.4, 0.3, 0.45);
          break;
        case 'heavy':
          Pw.decal('crater', v.x, v.y, 1.8, 6);
          if (fxOn() && near(u, v, 25)) J.Fx.word('ズシッ!', v.x, v.y, gy(v.x, v.y) + 1.6, 'big', '#ffd23f', '#1a2a0a');
          Pw.smoke(v.x, gy(v.x, v.y) + 0.1, v.y, 8, '#a89a88', 0.4, 0.7, 0.2, 0.5, 0.5);
          break;
        case 'sleep':
          Pw.smoke(b.x, b.h + 0.4, b.z, 8, '#5a4a8a', 0.5, 1.2, 0.2, 0.3, 0.45);
          break;
        case 'book':
          for (let i = 0; i < 10; i++) Pw.puff(b.x, b.h + 0.4, b.z, (rnd() - 0.5) * 3, 1 + rnd() * 2, (rnd() - 0.5) * 3, 1, 0.14, 0.1, '#fff8e8', '#e8dcc0', 2, 1, false);
          break;
        case 'silence':
          Pw.shards(b.x, b.h, b.z, 8, '#dfe8f7', 3, 0.1, 0);
          snd(u, 'glass');
          break;
        case 'slow':
          Pw.wordBurst(v.x, v.y, gy(v.x, v.y) + 1.6, 'ウォォン', '#a6ff7e', 0.7);
          break;
        default:
          Pw.glow(b.x, b.h, b.z, 10, c, 2, 0.09, 0.5);
      }
    }
    // нить от руки к цели держится миг
    Pw.add({
      u, tg, c, st, dur: 0.4,
      update() {
        return this.t < this.dur && !this.tg.dead;
      },
      draw() {
        const k = 1 - this.t / this.dur;
        const h = Pw.hand(u);
        const b = Pw.body(this.tg, 1.2);
        C.set(this.c).multiplyScalar(k + 0.2);
        if (this.st === 'book') Pw.seg(h.x, h.h, h.z, b.x, b.h, b.z, 0.02 * k, '#15151c');
        else if (this.st === 'drain') Pw.chain(ropePts(b.x, b.h, b.z, h.x, h.h, h.z, 1, 0.15, this.t, 10), 10, 0.04, C, true);
        else Pw.gseg(h.x, h.h, h.z, b.x, b.h, b.z, 0.04 * k + 0.01, C);
      },
    });
  };
  // Усиление: вспышка, слово и образ (крылья, броня, щит...)
  Pw.fxBuff = function (u, ab) {
    if (!Pw.ready) return;
    const b = ab.buff;
    const c = ab.color || c1Of(u);
    const B = Pw.body(u, 1);
    Pw.surge(u, 1.3);
    const id = u.stand ? u.stand.id : '';
    if (b === 'fly') u._flyC = id === 'the_fool' ? '#d9b77a' : c;
    if (b === 'armor') u._armorC = id === 'spice_girl' ? '#ff9fcf' : '#d6f2ff';
    switch (b) {
      case 'invis':
        Pw.smoke(B.x, B.h, B.z, 10, '#d6e8ff', 0.5, 0.8, 0.3, 0.4, 0.35);
        snd(u, 'whoosh', 0.3, false, 0.08);
        break;
      case 'armor':
        Pw.shards(B.x, B.h, B.z, 10, u._armorC, 2.5, 0.07, 0, null, 1, 2);
        snd(u, id === 'white_album' ? 'ice' : 'glass');
        break;
      case 'reflect':
        Pw.smoke(B.x, B.h, B.z, 8, '#eef8ff', 0.6, 1, 0.2, 0.5, 0.35);
        snd(u, 'ice');
        if (id === 'kraft_work') say(u, null, 'ピタッ', 'mid', '#dbe87a');
        break;
      case 'invuln':
        if (ab.root) {
          if (fxOn()) J.Fx.sparks(B.x, B.h, B.z, 14, null, '#ffffff', 5);
          snd(u, 'block', true);
          say(u, null, 'ガキィン!', 'big', '#e8e8f0', '#3a3a4a');
        } else {
          // Небесная Дверь вписывает приказ
          Pw.wordBurst(u.x, u.y, gy(u.x, u.y) + 2.2, '傷つけられない', '#ffe9a8', 1.6, true);
          snd(u, 'life');
        }
        break;
      case 'dodge':
        shout(u, 'エピタフ!', '#ff4a5a', '#2a0008');
        if (fxOn() && u.isPlayer) J.Fx.flash('#ff1a3a', 0.08, 0.25);
        snd(u, 'menace', 1.2, 0.3);
        break;
      case 'heaven':
        shout(u, 'メイド・イン・ヘブン!!', '#ffffff', '#0a3a2a');
        if (fxOn() && u.isPlayer) {
          J.Fx.flash('#ffffff', 0.1, 0.6);
          J.Fx.linesAt(u.x, u.y, gy(u.x, u.y) + 1.2, 1, 1.2, true);
        }
        // время ускоряется для всех, кроме владельца: враги вокруг не поспевают
        for (const o of G().ents) if (!o.dead && J.hostile(u, o) && J.dist(o.x, o.y, u.x, u.y) < 25) o.st.slow = Math.max(o.st.slow || 0, (ab.dur || 8) * (o.boss ? 0.4 : 1));
        snd(u, 'whoosh', 0.6, true, 0.18);
        break;
      case 'zero':
        shout(u, 'ゴールド・エクスペリエンス・レクイエム', '#ffe14a', '#3a2a00');
        Pw.glow(B.x, B.h, B.z, 30, '#ffd84a', 5, 0.12, 0.9, -2);
        snd(u, 'life');
        break;
      case 'lovetrain':
        Pw.glow(B.x, B.h + 1, B.z, 30, '#fff2c8', 4, 0.12, 1, 1);
        if (fxOn() && u.isPlayer) J.Fx.flash('#fff6d8', 0.12, 0.6);
        snd(u, 'life');
        break;
      case 'haste':
        Pw.glow(B.x, B.h, B.z, 14, c, 4, 0.08, 0.35);
        snd(u, 'whoosh', 0.3, true, 0.12);
        break;
      case 'power':
        Pw.fire(B.x, B.h - 0.8, B.z, 10, 0.4, 2, 0.4);
        say(u, null, 'ゴゴゴゴ', 'big', '#ff6a5a', '#2a0008');
        snd(u, 'menace', 1.4, 0.35);
        break;
      case 'void':
        Pw.smoke(B.x, B.h, B.z, 14, '#0a0610', 0.7, 1, 0.3, 0.5, 0.9);
        say(u, null, 'ガオン', 'big', '#c8b6dd', '#1a0a2a');
        snd(u, 'erase');
        break;
      case 'dino':
        say(u, null, 'ガルルル', 'big', '#9ad94a', '#1a2a0a');
        snd(u, 'menace', 1, 0.3);
        break;
      default:
        Pw.glow(B.x, B.h, B.z, 16, c, 3, 0.1, 0.6, -1);
        snd(u, 'life');
    }
  };
  // Призыв: появление под тему
  Pw.fxSummon = function (u, ab) {
    if (!Pw.ready) return;
    const unit = ab.unit;
    const a = u.face + Math.PI;
    const x = u.x + Math.cos(a) * 1.2, y = u.y + Math.sin(a) * 1.2;
    const h = gy(x, y);
    Pw.surge(u, 1);
    switch (unit) {
      case 'frog':
        // Золотой Опыт: камни оживают, рядом с целью вырастает дерево
        Pw.glow(x, h + 0.3, y, 20, '#ffd84a', 2, 0.1, 0.8, -2);
        say(u, null, 'ゴールド・エクスペリエンス!', 'mid', '#ffe14a', '#3a2a00');
        {
          const tg = u.isPlayer ? J.P.aim(u, 8).target : u.ai && u.ai.target;
          const tx = tg ? tg.x - Math.cos(Math.atan2(tg.y - u.y, tg.x - u.x)) * 0.9 : u.x + Math.cos(u.face) * 2.5;
          const ty = tg ? tg.y - Math.sin(Math.atan2(tg.y - u.y, tg.x - u.x)) * 0.9 : u.y + Math.sin(u.face) * 2.5;
          if (!G().world.solid(tx, ty)) Pw.lifeTree(u, tx, ty, Math.min(12, ab.life || 12), A_pw(u));
        }
        break;
      case 'zombie_ally':
        for (let i = 0; i < 4; i++) Pw.smoke(x + (rnd() - 0.5) * 2, h + 0.1, y + (rnd() - 0.5) * 2, 4, '#3a3a30', 0.6, 1.2, 0.8, 0.3, 0.6);
        Pw.decal('crater', x, y, 2.5, 8);
        snd(u, 'menace', 1.2, 0.3);
        break;
      case 'sha':
        say(u, null, 'シアーハートアタック!', 'big', '#ff9ad8', '#3a0a2a');
        Pw.glow(x, h + 0.4, y, 14, '#ff9ad8', 2, 0.1, 0.5);
        snd(u, 'click');
        break;
      case 'bug':
        for (let i = 0; i < 20; i++) Pw.puff(x, h + 0.5, y, (rnd() - 0.5) * 5, rnd() * 2, (rnd() - 0.5) * 5, 0.6, 0.05, 0.04, '#d9b23a', null, 0, 1, false);
        break;
      case 'soldier':
        Pw.smoke(x, h + 0.1, y, 6, '#8a8480', 0.4, 0.8, 0.5, 0.6, 0.5);
        say(u, null, '突撃!', 'mid', '#a8b07a', '#1a2a0a');
        break;
      case 'raptor':
        Pw.smoke(x, h + 0.1, y, 8, '#6a8a4a', 0.5, 0.9, 0.5, 0.8, 0.5);
        say(u, null, 'ギャオオ!', 'big', '#9ad94a', '#1a2a0a');
        break;
      case 'babyface':
        Pw.shards(x, h + 0.8, y, 16, '#8fa0ff', 2, 0.08, 1, null, 2, -2, 0.6);
        break;
      case 'clone':
        Pw.add({
          u, x, y, dur: 0.5,
          update() {
            return this.t < this.dur;
          },
          draw() {
            const k = 1 - this.t / this.dur;
            Pw.gseg(this.x, h, this.y, this.x, h + 2.3, this.y, 0.4 * k, '#ffe9a8');
          },
        });
        if (u.isPlayer && fxOn()) J.Fx.flash('#fff2c8', 0.06, 0.25);
        break;
      default: {
        // песчаный/зеркальный/призрачный двойник
        const sand = u.stand && u.stand.id === 'the_fool';
        Pw.smoke(x, h + 0.8, y, 10, sand ? '#d9b77a' : c1Of(u), 0.5, 0.9, 0.4, 0.4, sand ? 0.7 : 0.35);
      }
    }
  };
  const A_pw = (u) => (J.Abil ? J.Abil.pw(u) : 1);
  // Исцеление: свет стягивается к ранам
  Pw.fxHeal = function (u, ab) {
    if (!Pw.ready) return;
    const c = u.stand && u.stand.id === 'pearl_jam' ? '#ff9a6a' : u.stand && u.stand.id === 'foo_fighters' ? '#7fffb0' : '#ffe9a8';
    const B = Pw.body(u, 1);
    for (let i = 0; i < 18; i++) {
      const a = rnd() * TAU, r = 1.2 + rnd() * 0.6, e = (rnd() - 0.3) * 1.4;
      const ox = Math.cos(a) * r, oh = Math.sin(e) * r * 0.6, oz = Math.sin(a) * r;
      Pw.puff(B.x + ox, B.h + oh, B.z + oz, -ox * 2.2, -oh * 2.2, -oz * 2.2, 0.45, 0.1, 0.04, c, null, 0, 1);
    }
    Pw.glow(B.x, B.h, B.z, 10, '#9dff7a', 1.2, 0.1, 0.9, -2);
    Pw.light(B.x, B.h, B.z, c, 1.5, 6, 0.5);
    snd(u, 'life');
  };
  // Безумный Бриллиант: «исправить» — враг вплавлен в камень, свои вылечены, машины починены
  Pw.fxRestore = function (u, ab, foes, friends) {
    if (!Pw.ready) return;
    R3.ring(u.x, u.y, ab.radius, '#ff9be6', 0.6);
    say(u, null, 'ドララァ!', 'big', '#ff9be6', '#2a0a3a');
    snd(u, 'glass');
    for (const o of foes) {
      const dur = o.boss ? 1 : ab.stun || 2.5;
      Pw.add({
        u, o, dur,
        update() {
          return this.t < this.dur && !this.o.dead;
        },
        draw() {
          const o = this.o;
          const h = gy(o.x, o.y);
          const k = Math.min(1, this.t / 0.15);
          // каменная глыба вокруг тела (собралась из обломков)
          for (let i = 0; i < 6; i++) {
            const a = i * 1.05 + o.id;
            Pw.box(o.x + Math.cos(a) * 0.28 * k, h + 0.3 + (i % 3) * 0.45, o.y + Math.sin(a) * 0.28 * k, 0.4, 0.5, 0.35, i % 2 ? '#8a8078' : '#a09488', 0.2 * i, a, 0.1 * i);
          }
        },
        end() {
          if (!this.o.dead) Pw.shards(this.o.x, gy(this.o.x, this.o.y) + 0.8, this.o.y, 10, '#9a8c80', 3, 0.1, 1);
        },
      });
      Pw.shards(o.x, gy(o.x, o.y) + 0.8, o.y, 8, '#9a8c80', 2, 0.08, 1, null, 1, -3, 0.25);
    }
    for (const o of friends) {
      const B = Pw.body(o, 1);
      for (let i = 0; i < 10; i++) {
        const a = rnd() * TAU, r = 1.4;
        Pw.puff(B.x + Math.cos(a) * r, B.h + (rnd() - 0.5), B.z + Math.sin(a) * r, -Math.cos(a) * 3, 0, -Math.sin(a) * 3, 0.45, 0.09, 0.04, '#ff9be6', null, 0, 1);
      }
    }
    // починка машин рядом
    for (const v of G().vehs || []) {
      if (v.hp <= 0 || J.dist(v.x, v.y, u.x, u.y) > ab.radius + 2) continue;
      if (v.hp < v.maxHp) {
        v.hp = v.maxHp;
        v.fire = false;
        v.burnT = 0;
        Pw.glow(v.x, gy(v.x, v.y) + 0.8, v.y, 16, '#ff9be6', 2.5, 0.1, 0.6);
        if (u.isPlayer) J.UI.toast('Безумный Бриллиант починил машину.', 'green');
      }
    }
  };
  // Ясновидение и прочие поиски: волна разведки
  Pw.fxReveal = function (u, ab) {
    if (!Pw.ready) return;
    const id = u.stand ? u.stand.id : '';
    const c = c1Of(u);
    if (id === 'hermit_purple') {
      // фото духа: вспышка камеры и лозы по земле во все стороны
      if (fxOn()) J.Fx.flash('#ffffff', 0.08, 0.8);
      snd(u, 'click');
      say(u, null, 'パシャッ!', 'big', '#ffffff', '#2a0a3a');
      Pw.add({
        u, x: u.x, y: u.y, dur: 1.8,
        update() {
          return this.t < this.dur;
        },
        draw() {
          const k = Math.min(1, this.t / 0.8), f = this.t > 1.2 ? (1.8 - this.t) / 0.6 : 1;
          for (let i = 0; i < 10; i++) {
            const a = (i / 10) * TAU;
            const n = 10;
            for (let j = 0; j < n - 1; j++) {
              const r0 = (j / n) * 12 * k, r1 = ((j + 1) / n) * 12 * k;
              const w0 = Math.sin(j * 1.3 + i) * 0.5, w1 = Math.sin((j + 1) * 1.3 + i) * 0.5;
              const x0 = this.x + Math.cos(a) * r0 - Math.sin(a) * w0, y0 = this.y + Math.sin(a) * r0 + Math.cos(a) * w0;
              const x1 = this.x + Math.cos(a) * r1 - Math.sin(a) * w1, y1 = this.y + Math.sin(a) * r1 + Math.cos(a) * w1;
              C.set('#c06bff').multiplyScalar(f);
              Pw.gseg(x0, gy(x0, y0) + 0.06, y0, x1, gy(x1, y1) + 0.06, y1, 0.035, C);
            }
          }
        },
      });
    } else {
      // радар / волна
      for (let i = 0; i < 3; i++) R3.ring(u.x, u.y, 8 + i * 6, id === 'aerosmith' ? '#7aff8a' : c, 0.6 + i * 0.25);
      Pw.glow(u.x, gy(u.x, u.y) + 1, u.y, 14, c, 3, 0.1, 0.8, -1);
      snd(u, id === 'geb' ? 'water' : 'whoosh', 0.4, true, 0.08);
    }
  };
  // Перемотка (Пожирающая пыль, Мэндом): призраки пути назад
  Pw.fxRewind = function (u, ab, ox, oy, hist) {
    if (!Pw.ready || !u.view) return;
    const c = ab.dmg ? '#ff7ac8' : '#c9a46b';
    const v = u.view;
    const px = v.group.position.x, py = v.group.position.y, pz = v.group.position.z;
    const n = Math.min(7, hist ? hist.length : 0);
    for (let i = 0; i < n; i++) {
      const s = hist[Math.floor((i / Math.max(1, n - 1)) * (hist.length - 1))];
      v.group.position.set(s.x, gy(s.x, s.y), s.y);
      Pw.ghost(v, c, 0.5 + i * 0.07);
    }
    v.group.position.set(px, py, pz);
    v.group.updateMatrixWorld(true);
    // циферблат над головой: стрелки бегут назад
    Pw.add({
      u, dur: 0.9,
      update() {
        return this.t < this.dur;
      },
      draw() {
        const B = Pw.body(u, 2.4);
        const k = 1 - this.t / this.dur;
        Pw.hoop(B.x, B.h, B.z, 0.45, 0.02, c, true, 20, 0);
        const a = -this.t * 22;
        Pw.gseg(B.x, B.h, B.z, B.x + Math.cos(a) * 0.38 * k, B.h, B.z + Math.sin(a) * 0.38 * k, 0.025, '#ffffff');
        Pw.gseg(B.x, B.h, B.z, B.x + Math.cos(a / 12) * 0.25 * k, B.h, B.z + Math.sin(a / 12) * 0.25 * k, 0.03, '#ffffff');
      },
    });
    if (ab.dmg) Pw.explosion(ox, oy, ab.radius || 3, '#ff9ad8');
  };
  // Белая Змея: диск вылетает из головы
  Pw.fxDisc = function (u, tg, stolen) {
    if (!Pw.ready) return;
    const B = Pw.body(tg, 1.75);
    snd(u, 'glass');
    Pw.add({
      u, x: B.x, h: B.h, z: B.z, stolen, dur: stolen ? 0.6 : 0.35,
      update() {
        return this.t < this.dur;
      },
      draw() {
        const k = this.t / this.dur;
        const H = Pw.hand(u);
        const x = this.stolen ? this.x + (H.x - this.x) * k : this.x + Math.cos(tg.face) * 0.25 * Math.sin(k * Math.PI);
        const h = this.stolen ? this.h + (H.h - this.h) * k + Math.sin(k * Math.PI) * 0.6 : this.h;
        const z = this.stolen ? this.z + (H.z - this.z) * k : this.z + Math.sin(tg.face) * 0.25 * Math.sin(k * Math.PI);
        Pw.seg(x, h, z, x + 0.01, h + 0.012, z, 0.13, '#e9e6ef');
        Pw.orb(x, h, z, 0.18, '#d6d0ff');
      },
    });
  };

  // ---------- 32. Поля (туман, газ, дождь, плесень, зыбучая земля, вакуум, бедствие, огонь) ----------
  const fieldVis = (f) => {
    if (f.vis) return f.vis;
    const id = f.owner && f.owner.stand ? f.owner.stand.id : '';
    return { justice: 'fog', grateful_dead: 'gas', purple_haze: 'virus', weather_report: 'rain', green_day: 'mold', oasis: 'quicksand', jumpin_jack_flash: 'vacuum', wonder_of_u: 'calamity' }[id] || (f.fx && f.fx.poison ? 'virus' : 'mist');
  };
  function drawFields(dt) {
    const g = G();
    if (!g.fields.length) return;
    for (const f of g.fields) {
      const vis = (f._vis = f._vis || fieldVis(f));
      const R = f.radius;
      const h = gy(f.x, f.y);
      const k = f.t < 0.4 ? f.t / 0.4 : f.t > f.dur - 0.8 ? Math.max(0, (f.dur - f.t) / 0.8) : 1;
      if (!f._dec && vis !== 'fog' && vis !== 'vacuum' && vis !== 'calamity') {
        f._dec = true;
        const dk = { gas: 'virus', virus: 'virus', rain: 'water', mold: 'mold', quicksand: 'sand', fire: 'scorch', mist: 'water' }[vis];
        if (dk && !f.follow) Pw.decal(dk, f.x, f.y, R * 2, f.dur + 1);
      }
      if (dt <= 0) continue;
      const rate = dt * 60;
      const rx = () => (rnd() - 0.5) * 2 * R * 0.85;
      switch (vis) {
        case 'fog':
          // густой туман Правосудия: клубы у земли, сквозь них едва видно
          for (let i = 0; i < 2; i++) if (rnd() < rate * 0.6) Pw.puff(f.x + rx(), h + 0.2 + rnd() * 1.6, f.y + rx(), (rnd() - 0.5) * 0.4, 0.05, (rnd() - 0.5) * 0.4, 2.6, 1.6, 3, '#aeb4c2', '#c8ccd8', 0, 0.55 * k, false);
          break;
        case 'gas':
          if (rnd() < rate * 0.45) Pw.puff(f.x + rx(), h + 0.2 + rnd() * 1.2, f.y + rx(), 0, 0.2, 0, 1.6, 0.6, 1.4, '#8a6ab8', '#5a3a7a', -0.1, 0.35 * k, false);
          break;
        case 'virus':
          if (rnd() < rate * 0.45) Pw.puff(f.x + rx(), h + 0.2 + rnd() * 0.9, f.y + rx(), 0, 0.15, 0, 1.4, 0.5, 1.2, '#b06bff', '#6a2a9a', -0.1, 0.38 * k, false);
          if (rnd() < rate * 0.15) Pw.puff(f.x + rx(), h + 0.3, f.y + rx(), 0, 0.6, 0, 0.8, 0.06, 0.1, '#e8b0ff', null, -0.5, 0.9);
          break;
        case 'rain':
          // ливень: косые струи воды и брызги
          for (let i = 0; i < 3; i++) {
            const x = f.x + rx(), y = f.y + rx();
            Pw.puff(x - 0.6, h + 5, y, 1.2, -16, 0, 0.32, 0.05, 0.04, '#cfe6ff', '#8ab8ff', 0, 0.7, false);
          }
          if (rnd() < rate * 0.5) Pw.burst('water', f.x + rx(), h + 0.05, f.y + rx(), 0.2);
          break;
        case 'mold':
          if (rnd() < rate * 0.3) Pw.puff(f.x + rx(), h + 0.1, f.y + rx(), 0, 0.3, 0, 1.5, 0.15, 0.35, '#9ad94a', '#4a7a2a', -0.05, 0.55 * k, false);
          break;
        case 'quicksand':
          if (rnd() < rate * 0.3) {
            const a = rnd() * TAU, r = rnd() * R;
            Pw.puff(f.x + Math.cos(a) * r, h + 0.05, f.y + Math.sin(a) * r, -Math.sin(a) * 1.5, 0.1, Math.cos(a) * 1.5, 1.2, 0.3, 0.5, '#a88a5a', null, 0, 0.6 * k, false);
          }
          break;
        case 'vacuum':
          if (rnd() < rate * 0.5) {
            const a = rnd() * TAU, r = R;
            Pw.puff(f.x + Math.cos(a) * r, h + 0.5 + rnd(), f.y + Math.sin(a) * r, -Math.cos(a) * R * 1.4, 0, -Math.sin(a) * R * 1.4, 0.7, 0.3, 0.05, '#c8d8ff', null, 0, 0.35 * k, false);
          }
          break;
        case 'calamity':
          // бедствие: сверху падают предметы на тех, кто преследует
          f._calT = (f._calT || 0) - dt;
          if (f._calT <= 0) {
            f._calT = 0.6;
            for (const o of g.ents) {
              if (o.dead || !J.hostile(f, o) || J.dist(o.x, o.y, f.x, f.y) > R) continue;
              const mv = Math.hypot(o.vx || 0, o.vy || 0);
              if (mv < 0.3 || rnd() < 0.4) continue;
              Pw.dropThing(f.owner, o);
              break;
            }
          }
          if (rnd() < rate * 0.25) Pw.puff(f.x + rx(), h + 0.4 + rnd(), f.y + rx(), 0, 0.2, 0, 2, 0.6, 1.4, '#3a2e24', null, 0, 0.3 * k, false);
          break;
        case 'fire':
          if (rnd() < rate * 0.5) Pw.fire(f.x + rx() * 0.8, h, f.y + rx() * 0.8, 1, 0.1, 1.5, 0.4);
          if (rnd() < 0.3) Pw.light(f.x, h + 0.8, f.y, '#ff8a2a', 1.4, 6, 0.12);
          break;
        default:
          if (rnd() < rate * 0.4) Pw.puff(f.x + rx(), h + 0.3 + rnd(), f.y + rx(), 0, 0.2, 0, 1.2, 0.4, 0.9, f.color, null, 0, 0.3 * k, false);
      }
    }
  }
  // Бедствие: что-то падает сверху (горшок, вывеска, кирпич)
  Pw.dropThing = function (u, o) {
    const x = o.x + (o.vx || 0) * 0.5, y = o.y + (o.vy || 0) * 0.5;
    const h0 = gy(x, y);
    const c = ['#8a5a3a', '#6a6a72', '#a04a3a'][(rnd() * 3) | 0];
    Pw.add({
      u, x, y, hit: false, c,
      update() {
        if (!this.hit && this.t > 0.55) {
          this.hit = true;
          J.hitCircle(u, this.x, this.y, 0.9, 22 * A_pw(u), { stun: 0.8, knock: 1, kind: 'phys' });
          Pw.shards(this.x, h0 + 0.3, this.y, 10, this.c, 3, 0.1, 1);
          Pw.smoke(this.x, h0 + 0.2, this.y, 4, '#8a8078', 0.4, 0.7, 0.4, 0.3, 0.5);
          if (fxOn() && near(u, this, 25)) J.Fx.word('ガシャーン!', this.x, this.y, h0 + 1.5, 'mid', '#ffffff', '#3a2e24');
          snd(u, 'guardBreak');
        }
        return this.t < 0.6;
      },
      draw() {
        const k = Math.min(1, this.t / 0.55);
        Pw.box(this.x, h0 + 9 * (1 - k * k) + 0.25, this.y, 0.4, 0.35, 0.3, this.c, this.t * 5, this.t * 3, 0);
      },
    });
  };

  // ---------- 33. Ловушки ----------
  const trapVis = (t) => {
    if (t.vis) return t.vis;
    const id = t.owner && t.owner.stand ? t.owner.stand.id : '';
    return { echoes_2: 'word', bad_company: 'mine', diver_down: 'punch', twentieth_century_boy: 'dynamite', hierophant_green: 'emerald', stone_free: 'string' }[id] || 'orb';
  };
  // надписи ловушек: если список ловушек сбросили целиком (новая игра, загрузка), надпись висела бы вечно
  const TSPR = [];
  let trapFrame = 0;
  function drawTraps(dt) {
    const g = G();
    trapFrame++;
    for (const t of g.traps) {
      if (t.spr) t.spr.tf = trapFrame;
      const vis = (t._vis = t._vis || trapVis(t));
      const h = gy(t.x, t.y);
      const tt = Pw.simT + t.x;
      switch (vis) {
        case 'word':
          if (!t.spr) {
            t.spr = Pw.wordSprite(['ドゴォン', 'ボヨヨン', 'ジュウウ'][(rnd() * 3) | 0], t.color);
            if (t.spr) {
              t.spr.tf = trapFrame;
              t.spr.trap = true;
              TSPR.push(t.spr);
            }
          }
          if (t.spr) {
            t.spr.sp.position.set(t.x, h + 0.35 + Math.sin(tt * 3) * 0.05, t.y);
            t.spr.sp.scale.set(1, 0.5, 1);
          }
          break;
        case 'mine': {
          Pw.seg(t.x, h + 0.02, t.y, t.x, h + 0.08, t.y, 0.16, '#4a5a3a');
          const on = Math.sin(tt * 8) > 0.3;
          Pw.orb(t.x, h + 0.11, t.y, on ? 0.08 : 0.03, '#ff2a2a');
          break;
        }
        case 'punch':
          Pw.hoop(t.x, h + 0.05, t.y, 0.35 + Math.sin(tt * 4) * 0.04, 0.025, t.color, true, 14);
          Pw.orb(t.x, h + 0.05, t.y, 0.12, t.color);
          break;
        case 'dynamite':
          for (let i = 0; i < 3; i++) Pw.seg(t.x + (i - 1) * 0.09, h + 0.05, t.y, t.x + (i - 1) * 0.09, h + 0.05, t.y + 0.3, 0.04, '#c4283c');
          if (dt > 0 && rnd() < 0.5) Pw.glow(t.x, h + 0.15, t.y + 0.35, 2, '#ffd08a', 1.5, 0.05, 0.2, 4);
          break;
        default:
          Pw.gem(t.x, h + 0.4 + Math.sin(tt * 3) * 0.1, t.y, 0.18, t.color, 0, tt * 3, 1.3);
          Pw.orb(t.x, h + 0.4 + Math.sin(tt * 3) * 0.1, t.y, 0.3, t.color);
      }
    }
    for (let i = TSPR.length - 1; i >= 0; i--) {
      const s = TSPR[i];
      if (s.trap && s.tf === trapFrame) continue;
      if (s.trap) Pw.freeSprite(s);
      TSPR.splice(i, 1);
    }
  }
  // срабатывание ловушки
  Pw.trapBoom = function (t) {
    if (!Pw.ready) return false;
    if (t.spr) {
      Pw.freeSprite(t.spr);
      t.spr = null;
    }
    const vis = t._vis || trapVis(t);
    const h = gy(t.x, t.y);
    if (vis === 'mine' || vis === 'dynamite') Pw.explosion(t.x, t.y, 1.8);
    else if (vis === 'word') {
      Pw.wordBurst(t.x, t.y, h + 1, 'ドゴォォン!', t.color, 0.9, true);
      R3.ring(t.x, t.y, 1.8, t.color, 0.4);
      Pw.burst(t.fx && t.fx.burn ? 'fire' : 'sound', t.x, h + 0.6, t.y, 0.9);
      J.Sfx && J.Sfx.word();
    } else if (vis === 'punch') {
      // запасённый удар вырывается из земли
      Pw.add({
        u: t.owner, x: t.x, y: t.y, dur: 0.35, c: t.color,
        update() {
          return this.t < this.dur;
        },
        draw() {
          const k = Math.sin(Math.min(1, this.t / this.dur) * Math.PI);
          Pw.seg(this.x, h, this.y, this.x, h + 1.4 * k, this.y, 0.09, c1Of(t.owner));
          Pw.box(this.x, h + 1.4 * k, this.y, 0.2, 0.18, 0.2, c2Of(t.owner));
        },
      });
      Pw.smoke(t.x, h + 0.1, t.y, 6, '#a89a88', 0.4, 0.7, 1, 0.3, 0.5);
      Pw.decal('crater', t.x, t.y, 1.4, 6);
      J.Sfx && J.Sfx.heavy(false);
    } else {
      Pw.burst('energy', t.x, h + 0.5, t.y, 1, null, t.color);
      R3.flash(t.x, t.y, 1.6, t.color, 0.3, 0.5);
    }
    return true;
  };
  Pw.trapGone = function (t) {
    if (t.spr) {
      Pw.freeSprite(t.spr);
      t.spr = null;
    }
  };


  // ---------- 34. Фирменные силы: Финальный ОРА, ножи Мира, песчаная волна Шута, радуга Прогноза Погоды, Go Beyond, револьвер Императора ----------
  // Звёздная Платина: стенд хватает цель взглядом, короткий бешеный шквал и сокрушительный последний удар
  POW.finalOra = {
    use(u, ab, aim, c) {
      const sd = sdOf(u);
      const cry = (sd && sd.cry) || 'ОРА';
      const a0 = fireAng(u, aim, 3);
      u.face = a0;
      Pw.charge(u, 0.32, c1Of(u));
      Pw.surge(u, 1.6);
      say(u, null, 'ゴゴゴゴ', 'big', '#c7b6ff', '#1a0a3a');
      snd(u, 'menace', 1.2, 0.3);
      if (u.isPlayer && fxOn()) J.Fx.linesAt(u.x, u.y, gy(u.x, u.y) + 1.2, 0.6, 0.35, false);
      if (J.Cb) J.Cb.threat(u, 0.32, 'rush');
      u.anim = { type: 'pose', t: 0.3, max: 0.3, stand: true };
      Pw.add({
        u, ab, c, cry, a0, go: false,
        update() {
          if (u.dead || !u.canAct()) return false;
          if (this.t < 0.3) return true;
          const fin = this.ab.knock || 9;
          // короткий раш без продления: добивание в 8 раз сильнее обычного и с огромным отбросом
          u.channel = {
            type: 'rush', t: 0.7, max: 0.7, tick: 0, dmg: this.ab.dmg * this.c.pw * 0.07, range: this.ab.range || 1.8, ang: u.isPlayer ? J.P.aim(u, 3).ang : this.a0, cry: this.cry, kind: this.c.kind, key: null, ext: 0, maxExt: 0, mag: 0.4, fin: 0, n: 0,
            finMul: 8.5, finKnock: fin * 1.5, finStun: this.ab.stun || 1.2, onFin: Pw.finalOraHit,
          };
          u.anim = { type: 'rush', t: 0.7, max: 0.7, stand: true };
          if (J.Fx) J.Fx.rushStart(u, this.cry);
          return false;
        },
      });
      return true;
    },
  };
  // последний удар Финального ОРА: воронка, ударная волна конусом, пыль, тряска
  Pw.finalOraHit = function (e, c, n) {
    const a = c.ang;
    const x = e.x + Math.cos(a) * 1.7, y = e.y + Math.sin(a) * 1.7, h = gy(x, y);
    Pw.surge(e, 2);
    if (!n) return;
    Pw.decal('crater', x, y, 2.6, 10);
    for (let i = 0; i < 16; i++) {
      const b = a + (rnd() - 0.5) * 1.1, v = 4 + rnd() * 5;
      Pw.puff(x, h + 0.3 + rnd() * 0.8, y, Math.cos(b) * v, 0.5 + rnd(), Math.sin(b) * v, 0.6 + rnd() * 0.4, 0.4, 1.3, '#b8ab98', '#8a7e70', -0.5, 0.55, false);
    }
    Pw.glow(x, h + 1.2, y, 20, c1Of(e), 7, 0.12, 0.35, 0, 0.3);
    Pw.light(x, h + 1.2, y, c2Of(e), 3, 9, 0.25);
    if (fxOn() && near(e, null, 30)) {
      J.Fx.shock(x, y, 1.5);
      J.Fx.debris(x, h + 0.3, y, Math.cos(a), Math.sin(a), 22, '#7a6e60');
      J.Fx.word('ドゴォォン!!', x, y, h + 2, 'fin', '#ffffff', '#2a0a5a');
    }
    R3.cam.shake = Math.max(R3.cam.shake || 0, 0.5);
    snd(e, 'boom', 0.8);
  };

  // Мир: ножи. В своём остановленном времени — кольцо ножей вокруг цели, висят, пока время не пойдёт
  POW.knives = {
    use(u, ab, aim, c) {
      const g = G();
      const ts = g.timestop && g.timestop.by === u;
      const tg = pickTarget(u, aim, (ab.range || 10) + 2, 1.3);
      return windup(u, aim, ts ? 0.2 : 0.1, '#e9edf5', () => {
        const a = fireAng(u, aim, ab.range || 10);
        u.face = a;
        u.anim = { type: 'punch', t: 0.3, max: 0.3, stand: true };
        const h = Pw.hand(u);
        Pw.glow(h.x, h.h, h.z, 8, '#ffffff', 3, 0.07, 0.25);
        snd(u, 'whoosh', 0.14, false, 0.12);
        if (ts && tg && !tg.dead) {
          // «Ты окружён»: ножи со всех сторон, остриём к цели
          const N = (ab.n || 5) + 5;
          const w = g.world;
          let k = 0;
          for (let i = 0; i < N; i++) {
            const b = (i / N) * TAU + rnd() * 0.2;
            const R = 2.2 + (i % 2) * 0.5;
            const x = tg.x + Math.cos(b) * R, y = tg.y + Math.sin(b) * R;
            if (w.solid(x, y)) continue;
            const p = J.spawnProj(u, { ang: b + Math.PI, speed: ab.speed || 13, dmg: ab.dmg * c.pw, range: R + 2.5, shape: 'knife', color: ab.color, size: (ab.size || 0.22) * 1.5, kind: c.kind, stand: true, x, y });
            p.tsAge = 1;
            p.held = true;
            p.h = 0.7 + (i % 3) * 0.35;
            if (k++ < 6) Pw.glow(x, gy(x, y) + p.h, y, 3, '#ffffff', 1, 0.06, 0.3, 0);
          }
          say(u, tg, 'ザ・ワールド', 'big', '#f2c230', '#1a3a10');
          if (u.isPlayer) J.UI.toast('Ножи повисли кольцом — сорвутся, когда время пойдёт.', 'gold');
        } else fan(u, ab, a, c, { shape: 'knife' }, (p) => (p.glint = 1));
      });
    },
  };

  // Шут: песок поднимается стеной и катится вперёд волной, сбивая с ног и засыпая глаза
  POW.sandWave = {
    use(u, ab, aim, c) {
      return windup(u, aim, 0.18, '#d9b77a', () => {
        const a = fireAng(u, aim, 6);
        u.face = a;
        u.anim = { type: 'heavy', t: 0.35, max: 0.35, stand: true };
        snd(u, 'whoosh', 0.5, true, 0.2);
        say(u, null, 'ザザザァッ', 'big', '#e8cf9a', '#3a2a10');
        const L = Math.max(2, freeLen(u.x, u.y, a, 7));
        Pw.add({
          u, a, L, x0: u.x, y0: u.y, hit: new Set(), dur: 0.55, dmg: ab.dmg * c.pw, ab,
          update() {
            const r = (this.t / this.dur) * this.L;
            for (const o of G().ents) {
              if (o.dead || this.hit.has(o.id) || !J.hostile(u, o)) continue;
              const dx = o.x - this.x0, dy = o.y - this.y0, d = Math.hypot(dx, dy);
              if (d > r + o.r || d < r - 1.4 || Math.abs(J.angDiff(this.a, Math.atan2(dy, dx))) > 0.75) continue;
              this.hit.add(o.id);
              J.hurt(o, this.dmg, u, { knock: 6, stun: 0.6, ang: Math.atan2(dy, dx), fx: { slow: 3 }, kind: 'phys' });
              const b = Pw.body(o, 1.4);
              Pw.smoke(b.x, b.h, b.z, 6, '#d9b77a', 0.4, 0.8, 0.3, 0.3, 0.7);
            }
            return this.t < this.dur;
          },
          draw(dt) {
            const k = this.t / this.dur, r = k * this.L;
            if (dt <= 0) return;
            // гребень волны: песок вздымается по дуге и осыпается
            for (let i = 0; i < 11; i++) {
              const b = this.a + (i / 10 - 0.5) * 1.4;
              const x = this.x0 + Math.cos(b) * r, y = this.y0 + Math.sin(b) * r, h = gy(x, y);
              const up = 5 * (1 - k * 0.5);
              Pw.puff(x, h + 0.1, y, Math.cos(b) * 2.5, up * (0.7 + rnd() * 0.6), Math.sin(b) * 2.5, 0.6 + rnd() * 0.35, 0.45, 1.2, '#e2c48e', '#a8875a', 8, 0.85, false);
              Pw.puff(x, h + 0.6 + rnd() * 0.8, y, Math.cos(b) * 3, up * 0.4, Math.sin(b) * 3, 0.5, 0.7, 1.4, '#d6b780', '#9a7a50', 4, 0.6, false);
              if (i % 2 === 0) Pw.puff(x, h + 0.05, y, Math.cos(b) * 0.6, 0.2, Math.sin(b) * 0.6, 1.1, 0.6, 1.6, '#cfae78', null, -0.1, 0.45, false);
            }
            if (!this.dec || this.t - this.dec > 0.12) {
              this.dec = this.t;
              Pw.decal('sand', this.x0 + Math.cos(this.a) * r, this.y0 + Math.sin(this.a) * r, 2.4, 8);
            }
          },
        });
      });
    },
  };

  // Прогноз Погоды: радуга через небо — кто её видит, видит улиток и бросается на своих
  POW.rainbow = {
    use(u, ab, aim, c) {
      const tg = pickTarget(u, aim, ab.range || 8, 1.2);
      if (!tg) return false;
      return windup(u, aim, 0.3, '#bfe0ff', () => {
        const vs = G().ents.filter((o) => !o.dead && J.hostile(u, o) && J.dist(o.x, o.y, tg.x, tg.y) <= (ab.aoe || 5));
        for (const v of vs) {
          J.Abil.applyHex(u, v, ab.status || 'charm', ab.dur, c.pw);
          if (!v.dead && v.st.charm > 0) v._snail = 1;
        }
        shout(u, 'ヘビー・ウェザー', '#e8f2ff', '#1a2a4a');
        snd(u, 'life');
        if (u.isPlayer && fxOn()) J.Fx.flash('#e8f2ff', 0.06, 0.4);
        Pw.add({
          u, x: tg.x, y: tg.y, a: Math.atan2(tg.y - u.y, tg.x - u.x) + Math.PI / 2, vs, dur: Math.min(8, ab.dur || 8),
          update() {
            return this.t < this.dur;
          },
          draw(dt) {
            const f = Math.min(1, this.t / 0.6) * Math.min(1, (this.dur - this.t) / 1);
            const R = 7, ca = Math.cos(this.a), sa = Math.sin(this.a), h0 = gy(this.x, this.y) - 0.5;
            const RC = ['#ff3a3a', '#ff9a2a', '#ffe14a', '#5adf6a', '#3aa8ff', '#5a5aff', '#b05aff'];
            for (let j = 0; j < 7; j++) {
              const rr = R - j * 0.32;
              C.set(RC[j]).multiplyScalar(0.55 * f);
              let px = this.x - ca * rr, ph = h0, pz = this.y - sa * rr;
              for (let i = 1; i <= 14; i++) {
                const b = (i / 14) * Math.PI;
                const nx = this.x - Math.cos(b) * ca * rr, nh = h0 + Math.sin(b) * rr * 0.75, nz = this.y - Math.cos(b) * sa * rr;
                Pw.gseg(px, ph, pz, nx, nh, nz, 0.14, C);
                px = nx;
                ph = nh;
                pz = nz;
              }
            }
            // улитки на одурманенных
            for (const v of this.vs) {
              if (v.dead || !(v.st.charm > 0)) continue;
              const b = Pw.body(v, 1.75);
              Pw.sph(b.x, b.h, b.z, 0.13, '#c9a46b', 0.9);
              Pw.hoop(b.x, b.h, b.z, 0.09, 0.02, '#7a5a2a', false, 10, 0);
              if (dt > 0 && rnd() < 0.1) Pw.puff(b.x, b.h - 0.1, b.z, 0, -0.3, 0, 0.8, 0.05, 0.03, '#d9f2c8', null, 2, 0.6, false);
            }
          },
        });
      });
    },
  };

  // Мягкий и Влажный: Go Beyond — «несуществующий» вращающийся пузырь: насквозь через стены и блок
  POW.goBeyond = {
    use(u, ab, aim, c) {
      return windup(u, aim, 0.35, '#ff7ab8', () => {
        const a = fireAng(u, aim, ab.range || 14);
        u.face = a;
        u.anim = { type: 'punch', t: 0.35, max: 0.35, stand: true };
        shout(u, 'ゴー・ビヨンド', '#ffd6ec', '#3a0a2a');
        snd(u, 'whoosh', 0.4, true, 0.14);
        fan(u, ab, a, c, { shape: 'spiral', ghost: true, unblockable: true, beyond: 1, size: 0.42, stun: 0.8, knock: 5 });
      });
    },
  };

  // Император: револьвер появляется в руке, пули сами доворачивают к цели
  POW.emperor = {
    use(u, ab, aim, c) {
      return windup(u, aim, ab.n > 2 ? 0.2 : 0.08, '#ffd166', () => {
        const a = fireAng(u, aim, ab.range || 12);
        u.face = a;
        u.anim = { type: 'punch', t: 0.3, max: 0.3, stand: false };
        Pw.add({
          u, dur: 0.6,
          update() {
            return this.t < this.dur;
          },
          draw() {
            const h = Pw.hand(u);
            const f = u.face, ca = Math.cos(f), sa = Math.sin(f);
            const k = Math.min(1, this.t / 0.08) * Math.min(1, (this.dur - this.t) / 0.15);
            Pw.box(h.x + ca * 0.12, h.h + 0.03, h.z + sa * 0.12, 0.05 * k, 0.07 * k, 0.3 * k, '#c9a04a', 0, Math.PI / 2 - f, 0);
            Pw.box(h.x - ca * 0.02, h.h - 0.05, h.z - sa * 0.02, 0.045 * k, 0.12 * k, 0.07 * k, '#7c5a2a', 0.3, Math.PI / 2 - f, 0);
          },
        });
        const h = Pw.hand(u);
        Pw.puff(h.x + Math.cos(a) * 0.4, h.h, h.z + Math.sin(a) * 0.4, Math.cos(a) * 2, 0.2, Math.sin(a) * 2, 0.08, 0.4, 0.12, '#ffe6a0', '#ff8a2a', 0, 1);
        Pw.smoke(h.x, h.h, h.z, 3, '#9a9490', 0.15, 0.7, 0.3, 0.05, 0.4);
        Pw.light(h.x, h.h, h.z, '#ffd08a', 1.6, 6, 0.06);
        snd(u, 'shot', ab.dmg > 40 ? 1.2 : 0.8);
        say(u, null, ab.n > 2 ? 'バババン!' : 'バン!', 'mid', '#ffd166', '#3a2a00');
        fan(u, ab, a, c, { shape: 'bullet' });
      });
    },
  };
})();
