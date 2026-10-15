'use strict';
// Отрисовка транспорта: модели машин из car_models.js (геометрия строится один раз на тип+цвет+регион и делится;
// вблизи — подробная с салоном и стёклами, вдали — простая), вмятины — своя копия кузова у битой машины,
// колёса, водители, лучи фар, поворотники — общие InstancedMesh, фара машины игрока — один SpotLight.
// Сигналы светофоров (горящая секция) — тоже один InstancedMesh.
// Локальная система модели: +z — вперёд, +x — левый борт, y — вверх; в мире rotation.y = PI/2 - ang (как у людей).
(function () {
  const R3 = J.R3;
  const col = (h) => new THREE.Color(h);
  const V = (x, y, z) => new THREE.Vector3(x, y, z);
  const tA = new THREE.Vector3(), tB = new THREE.Vector3(), tN = new THREE.Vector3();

  // выпуклый плоский многоугольник веером; нормаль разворачиваем по nExp
  function face(gb, pts, nExp, c) {
    tA.subVectors(pts[1], pts[0]);
    tB.subVectors(pts[2], pts[0]);
    tN.crossVectors(tA, tB);
    if (tN.dot(nExp) < 0) pts = pts.slice().reverse();
    for (let i = 1; i < pts.length - 1; i++) gb.tri(pts[0].toArray(), pts[i].toArray(), pts[i + 1].toArray(), c);
  }
  // призма по боковому профилю (z, y) с полушириной hw(z, y); colEdge(i) — цвет грани i (null — не рисовать)
  function prism(gb, prof, hwFn, capCol, colEdge) {
    const n = prof.length;
    const L = prof.map(([z, y]) => V(hwFn(z, y), y, z));
    const Rr = prof.map(([z, y]) => V(-hwFn(z, y), y, z));
    if (capCol) {
      face(gb, L, V(1, 0, 0), capCol);
      face(gb, Rr, V(-1, 0, 0), capCol);
    }
    let cz = 0, cy = 0;
    prof.forEach(([z, y]) => { cz += z / n; cy += y / n; });
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      const mz = (prof[i][0] + prof[j][0]) / 2 - cz, my = (prof[i][1] + prof[j][1]) / 2 - cy;
      const c = colEdge(i);
      if (!c) continue;
      face(gb, [L[i], L[j], Rr[j], Rr[i]], V(0, my, mz), c);
    }
  }
  const boxC = (gb, x0, y0, z0, x1, y1, z1, c) => gb.box(Math.min(x0, x1), Math.min(y0, y1), Math.min(z0, z1), Math.max(x0, x1), Math.max(y0, y1), Math.max(z0, z1), c, false);
  // тёмная арка над колесом с обеих сторон
  function wheelWells(gb, hw, zc, r, c) {
    for (const s of [1, -1]) {
      const pts = [V(s * (hw + 0.004), r * 0.3, zc)];
      for (let k = 0; k <= 8; k++) {
        const a = (k / 8) * Math.PI;
        pts.push(V(s * (hw + 0.004), r * 0.3 + Math.sin(a) * r * 1.2, zc + Math.cos(a) * r * 1.2));
      }
      for (let k = 1; k < pts.length - 1; k++) face(gb, [pts[0], pts[k], pts[k + 1]], V(s, 0, 0), c);
    }
  }

  const GLASS = col('#141a22'), TRIM = col('#1d1e22'), CHROME = col('#b8bcc4'), PLATE = col('#e9e6d6'), UNDER = col('#121214');
  const HEAD = col('#fff4dc'), TAIL = col('#ff2418'), AMBER = col('#ffae2a'), SIGN = col('#ffd84a'), REV = col('#f4f4f4');

  // ---------- Автобус ----------
  function buildBus(t, paint) {
    const gb = new J.GB(2048), lb = new J.GB(128), bb = new J.GB(64);
    const { L, W, H, wr, wb } = t;
    const zF = L / 2, zR = -L / 2, c = wr * 0.5, hw = W / 2;
    const yBelt = H * 0.42, yTop = H - 0.28;
    const P2 = paint.clone().multiplyScalar(0.8);
    prism(gb, [[zR, c], [zF, c], [zF, yBelt], [zR, yBelt]], () => hw, paint, (i) => (i === 0 ? UNDER : paint));
    prism(gb, [[zR, yBelt], [zF, yBelt], [zF - 0.12, yTop], [zR, yTop]], () => hw - 0.02, GLASS, (i) => (i === 0 ? null : GLASS));
    prism(gb, [[zR, yTop], [zF - 0.12, yTop], [zF - 0.3, H], [zR + 0.1, H]], () => hw - 0.02, paint, (i) => (i === 0 ? null : P2));
    for (let z = zR + 0.2; z < zF - 0.4; z += 1.25) for (const s of [1, -1]) boxC(gb, s * (hw - 0.02), yBelt, z - 0.06, s * (hw + 0.006), yTop, z + 0.06, paint);
    for (const s of [1, -1]) boxC(gb, s * (hw - 0.02), yBelt - 0.02, zR, s * (hw + 0.008), yBelt + 0.05, zF, TRIM);
    boxC(gb, -hw + 0.05, c, zF - 0.02, hw - 0.05, c + 0.3, zF + 0.06, TRIM);
    boxC(gb, -hw + 0.05, c, zR - 0.06, hw - 0.05, c + 0.3, zR + 0.02, TRIM);
    for (const zc of [zF - 1.2, 0]) for (const s of [1, -1]) boxC(gb, s * hw, c + 0.15, zc - 0.55, s * (hw + 0.01), yTop - 0.1, zc + 0.55, GLASS);
    for (const zc of [wb / 2, -wb / 2]) wheelWells(gb, hw, zc, wr, UNDER);
    for (const s of [1, -1]) {
      boxC(lb, s * (hw - 0.1), c + 0.35, zF - 0.01, s * (hw - 0.45), c + 0.55, zF + 0.02, HEAD);
      boxC(lb, s * (hw - 0.06), c + 0.4, zR - 0.02, s * (hw - 0.3), c + 0.75, zR + 0.01, TAIL);
      boxC(bb, s * (hw - 0.05), c + 0.39, zR - 0.03, s * (hw - 0.31), c + 0.76, zR, TAIL);
    }
    boxC(lb, -hw + 0.3, yTop - 0.05, zF - 0.1, hw - 0.3, yTop + 0.2, zF - 0.07, AMBER); // табло маршрута
    return { body: gb, lights: lb, brake: bb, siren: null, seat: { x: 0.6, y: yBelt - 0.3, z: zF - 1.0 } };
  }

  // ---------- Грузовик ----------
  function buildTruck(t, paint) {
    const gb = new J.GB(1024), lb = new J.GB(128), bb = new J.GB(64);
    const { L, W, H, wr, wb } = t;
    const zF = L / 2, zR = -L / 2, c = wr * 0.62, hw = W / 2;
    const cabL = 2.1, yCabBelt = 1.75, yCabTop = 2.65;
    const P2 = paint.clone().multiplyScalar(0.8);
    const CAB = col('#e8e8ea');
    prism(gb, [[zF - cabL, c + 0.2], [zF - 0.1, c + 0.2], [zF, c + 0.4], [zF, yCabBelt], [zF - cabL, yCabBelt]], () => hw - 0.05, CAB, (i) => (i === 0 ? UNDER : CAB));
    prism(gb, [[zF - cabL, yCabBelt], [zF - 0.05, yCabBelt], [zF - 0.3, yCabTop], [zF - cabL, yCabTop]], () => hw - 0.1, GLASS, (i) => (i === 0 ? null : i === 2 ? CAB : GLASS));
    boxC(gb, -hw + 0.15, yCabTop, zF - cabL + 0.1, hw - 0.15, yCabTop + 0.06, zF - 0.4, CAB);
    for (const s of [1, -1]) boxC(gb, s * (hw - 0.1), yCabBelt, zF - cabL + 0.05, s * (hw - 0.04), yCabTop, zF - cabL + 0.35, CAB);
    boxC(gb, -hw, c + 0.45, zR, hw, H, zF - cabL - 0.15, paint);
    boxC(gb, -hw - 0.01, H - 0.12, zR - 0.01, hw + 0.01, H + 0.01, zF - cabL - 0.14, P2);
    boxC(gb, -hw + 0.08, c + 0.55, zR - 0.02, hw - 0.08, H - 0.15, zR, P2);
    boxC(gb, -0.02, c + 0.55, zR - 0.03, 0.02, H - 0.15, zR, TRIM);
    boxC(gb, -hw + 0.35, c, zR + 0.2, hw - 0.35, c + 0.45, zF - cabL, UNDER);
    boxC(gb, -hw + 0.08, c + 0.1, zF - 0.06, hw - 0.08, c + 0.42, zF + 0.06, TRIM);
    boxC(gb, -0.5, c + 0.5, zF - 0.01, 0.5, yCabBelt - 0.25, zF + 0.01, TRIM);
    for (const zc of [wb / 2 + 0.4, -wb / 2 + 0.4]) wheelWells(gb, hw - 0.02, zc, wr, UNDER);
    for (const s of [1, -1]) {
      boxC(gb, s * (hw - 0.05), yCabBelt + 0.05, zF - 0.35, s * (hw + 0.22), yCabBelt + 0.45, zF - 0.42, TRIM);
      boxC(lb, s * (hw - 0.12), c + 0.5, zF - 0.01, s * (hw - 0.42), c + 0.72, zF + 0.02, HEAD);
      boxC(lb, s * (hw - 0.08), c + 0.5, zR - 0.03, s * (hw - 0.32), c + 0.72, zR, TAIL);
      boxC(bb, s * (hw - 0.07), c + 0.49, zR - 0.04, s * (hw - 0.33), c + 0.73, zR - 0.01, TAIL);
    }
    return { body: gb, lights: lb, brake: bb, siren: null, seat: { x: 0.5, y: yCabBelt - 0.3, z: zF - 1.0 }, zoff: 0.4 };
  }

  // ---------- Кэш геометрии ----------
  // Легковые и фургоны — подробные модели car_models.js (ближний план: кузов + прозрачные стёкла + салон;
  // дальний: всё одной геометрией). Автобус и грузовик — прежние призмы.
  // Записи кэша считают пользователей; неиспользуемые освобождаются, когда кэш переполнен.
  const CM = J.CarModels;
  const geoCache = new Map();
  const CACHE_MAX = 90;
  const shared = (g) => {
    g.userData.shared = true; // общая геометрия: никогда не освобождать при удалении машины
    return g;
  };
  const isBig = (t) => t.shape === 'bus' || t.shape === 'truck';
  // кузов и стёкла дальнего плана — одна геометрия
  function mergeCB(a, b) {
    const n = a.v + b.v, g = new THREE.BufferGeometry();
    const cat = (x, y, k) => {
      const o = new Float32Array(n * k);
      o.set(x.subarray(0, a.v * k));
      o.set(y.subarray(0, b.v * k), a.v * k);
      return o;
    };
    const P = cat(a.p, b.p, 3);
    g.setAttribute('position', new THREE.BufferAttribute(P, 3));
    g.setAttribute('normal', new THREE.BufferAttribute(cat(a.n, b.n, 3), 3));
    g.setAttribute('color', new THREE.BufferAttribute(cat(a.c, b.c, 3), 3));
    g.setAttribute('aRef', new THREE.BufferAttribute(cat(a.r, b.r, 1), 1));
    g.setAttribute('aGlow', new THREE.BufferAttribute(cat(a.g, b.g, 1), 1));
    J.fastBounds(g, P, n * 3);
    return g;
  }
  // автобус/грузовик: кузов и фары (J.GB) → одна геометрия с отражением и свечением по цвету вершины
  const GLASS_L = col('#141a22'), CHROME_L = col('#b8bcc4'), TRIM_L = col('#1d1e22'), UNDER_L = col('#121214');
  function mergeBig(a, b) {
    const n = a.v + b.v, g = new THREE.BufferGeometry();
    const P = new Float32Array(n * 3), N = new Float32Array(n * 3), C = new Float32Array(n * 3), GL = new Float32Array(n), RF = new Float32Array(n);
    P.set(a.p.subarray(0, a.v * 3));
    P.set(b.p.subarray(0, b.v * 3), a.v * 3);
    N.set(a.n.subarray(0, a.v * 3));
    N.set(b.n.subarray(0, b.v * 3), a.v * 3);
    C.set(a.c.subarray(0, a.v * 3));
    C.set(b.c.subarray(0, b.v * 3), a.v * 3);
    const near = (i, c) => Math.abs(C[i * 3] - c.r) + Math.abs(C[i * 3 + 1] - c.g) + Math.abs(C[i * 3 + 2] - c.b) < 0.01;
    for (let i = 0; i < a.v; i++) RF[i] = near(i, GLASS_L) ? 1 : near(i, CHROME_L) ? 2 : near(i, TRIM_L) ? 0.15 : near(i, UNDER_L) ? 0 : 0.5;
    // красные фонари светятся слабее белых фар — после тональной кривой остаются красными, а не оранжевыми
    for (let i = a.v; i < n; i++) {
      GL[i] = C[i * 3] > 0.5 && C[i * 3 + 1] < 0.2 ? 0.42 : 1;
      RF[i] = 0.8;
    }
    g.setAttribute('position', new THREE.BufferAttribute(P, 3));
    g.setAttribute('normal', new THREE.BufferAttribute(N, 3));
    g.setAttribute('color', new THREE.BufferAttribute(C, 3));
    g.setAttribute('aRef', new THREE.BufferAttribute(RF, 1));
    g.setAttribute('aGlow', new THREE.BufferAttribute(GL, 1));
    J.fastBounds(g, P, n * 3);
    return g;
  }
  const keyOf = (typeId, paintHex, livery, region) => typeId + paintHex + (livery ? livery.join() : '') + (isBig(J.vtypeOf(typeId)) && typeId !== 'bus' ? '' : region);
  R3.carGeo = function (typeId, paintHex, livery, region) {
    const k = keyOf(typeId, paintHex, livery, region);
    let g = geoCache.get(k);
    if (g) return g;
    const t = J.vtypeOf(typeId);
    const paint = col(paintHex);
    if (isBig(t)) {
      const parts = t.shape === 'bus' ? buildBus(t, paint) : buildTruck(t, paint);
      const hw = t.W / 2, zf = t.L / 2;
      const body = shared(mergeBig(parts.body, parts.lights));
      g = {
        k, users: 0, big: true, hi: body, lo: body, glass: null, brake: shared(parts.brake.build()), siren: null, seat: parts.seat, zoff: parts.zoff || 0,
        fx: { front: [[hw - 0.27, t.wr * 0.62 + 0.6], [-(hw - 0.27), t.wr * 0.62 + 0.6]], zf, zr: -zf, indF: [hw - 0.1, t.wr * 0.62 + 0.4, zf + 0.02], indR: [hw - 0.1, t.wr * 0.62 + 0.9, -zf - 0.02] },
      };
    } else {
      // ближний план собирается лениво (машины появляются вдали) — сначала только дальний
      const lo = CM.buildCar(t, paint, livery, region, 1);
      g = {
        k, users: 0, big: false, hi: null, glass: null, lo: shared(mergeCB(lo.body, lo.glass)), brake: shared(lo.brake.build()),
        siren: lo.siren ? lo.siren.map((s) => shared(s.build())) : null, seat: lo.seat, zoff: lo.zoff || 0, fx: lo.fx, bumper: lo.bumper,
        t, paint, livery, region,
      };
    }
    geoCache.set(k, g);
    if (geoCache.size > CACHE_MAX) evict();
    return g;
  };
  // подробная модель ближнего плана (кузов с салоном и отдельные стёкла)
  function buildHi(g) {
    if (g.hi) return;
    const P = CM.buildCar(g.t, g.paint, g.livery, g.region, 0);
    g.hi = shared(P.body.build());
    g.glass = shared(P.glass.build());
    g.seat = P.seat;
  }
  function evict() {
    for (const [k, g] of geoCache) {
      if (geoCache.size <= CACHE_MAX * 0.8) break;
      if (g.users > 0 || g.keep) continue;
      for (const x of [g.hi, g.lo, g.glass, g.brake].concat(g.siren || [])) if (x) x.dispose();
      geoCache.delete(k);
    }
  }
  R3.carGeoCount = () => geoCache.size;

  // ---------- Материал машин ----------
  // Фонг + отражение неба по Френелю (лак, стекло, хром — по атрибуту aRef), силуэты домов в отражении,
  // свечение фар ночью (aGlow), обгоревший кузов (uBurn), трещины на разбитом стекле (CAR_CRACK).
  const CAR_VS_PARS = '\nattribute float aRef;\nattribute float aGlow;\nvarying float vRef;\nvarying float vGlow;\nvarying vec3 vOP;';
  const CAR_FS_PARS = `
uniform float uGlow, uBurn, uSunV, uCity;
uniform vec3 uZen, uHor, uGnd, uSunD, uSunC;
varying float vRef;
varying float vGlow;
varying vec3 vOP;
float cHash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
vec3 carSky(vec3 d) {
  float h = d.y;
  vec3 c = mix(uHor, uZen, pow(clamp(h, 0.0, 1.0), 0.5));
  float az = atan(d.z, d.x) * 6.0;
  float bh = 0.05 + 0.24 * cHash(vec2(floor(az), 3.0));
  c = mix(c, uGnd * 0.5 + uHor * 0.06, step(h, bh) * step(-0.02, h) * uCity);
  c = mix(c, uGnd * 0.55, smoothstep(0.0, -0.12, h));
  float sd = max(dot(d, uSunD), 0.0);
  c += uSunC * (pow(sd, 48.0) * 0.18 + pow(sd, 900.0) * 7.0) * uSunV;
  return c;
}
#ifdef CAR_CRACK
float cVor(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  float d1 = 8.0, d2 = 8.0;
  for (int y = -1; y <= 1; y++) for (int x = -1; x <= 1; x++) {
    vec2 o = vec2(float(x), float(y));
    vec2 r = o + vec2(cHash(i + o), cHash(i + o + 17.3)) - f;
    float d = dot(r, r);
    if (d < d1) { d2 = d1; d1 = d; } else if (d < d2) d2 = d;
  }
  return sqrt(d2) - sqrt(d1);
}
#endif`;
  const CAR_ENV = `
  {
    vec3 Vv = normalize(vViewPosition);
    vec3 Nn = normalize(normal);
    float ndv = clamp(dot(Nn, Vv), 0.0, 1.0);
    vec3 Rw = inverseTransformDirection(reflect(-Vv, Nn), viewMatrix);
    vec3 env = carSky(Rw);
    float fr = pow(1.0 - ndv, 5.0);
    float rf = vRef * (1.0 - uBurn);
    if (rf > 1.5) {
      outgoingLight = outgoingLight * 0.35 + env * (vColor * 0.75 + 0.25) * (0.7 + 0.3 * fr);
    } else {
      #ifdef CAR_GLASS
      float F = (0.09 + 0.91 * fr) * rf;
      #else
      float F = (0.04 + 0.96 * fr) * rf;
      #endif
      outgoingLight = mix(outgoingLight, env, F);
      #ifdef CAR_GLASS
      diffuseColor.a = clamp(opacity + F * 1.3, 0.0, 1.0);
      #endif
    }
    #ifdef CAR_CRACK
    float e = cVor(vec2(vOP.x * 0.8 + vOP.z, vOP.y * 1.3) * 9.0);
    float e2 = cVor(vec2(vOP.z - vOP.x * 0.6, vOP.y) * 23.0);
    float cr = (1.0 - smoothstep(0.0, 0.07, e)) * 0.9 + (1.0 - smoothstep(0.0, 0.05, e2)) * 0.45;
    outgoingLight = mix(outgoingLight, (uHor * 0.6 + uZen * 0.2 + 0.08) * 1.4, clamp(cr, 0.0, 1.0) * 0.85);
    diffuseColor.a = max(diffuseColor.a, 0.3 + cr * 0.6);
    #endif
  }`;
  function carPatch(mat, glowU, burn, defs, key) {
    mat.defines = Object.assign({}, defs || {});
    const burnU = { value: burn || 0 };
    mat.userData.burn = burnU;
    mat.onBeforeCompile = (sh) => {
      const su = R3.skyU;
      sh.uniforms.uGlow = glowU;
      sh.uniforms.uBurn = burnU;
      sh.uniforms.uCity = R3.carCity;
      sh.uniforms.uZen = su.zenith;
      sh.uniforms.uHor = su.horizon;
      sh.uniforms.uGnd = su.groundC;
      sh.uniforms.uSunD = su.sunDir;
      sh.uniforms.uSunC = su.sunCol;
      sh.uniforms.uSunV = su.sunVis;
      sh.vertexShader = sh.vertexShader
        .replace('#include <common>', '#include <common>' + CAR_VS_PARS)
        .replace('#include <begin_vertex>', '#include <begin_vertex>\nvRef = aRef;\nvGlow = aGlow;\nvOP = position;');
      sh.fragmentShader = sh.fragmentShader
        .replace('#include <common>', '#include <common>' + CAR_FS_PARS)
        .replace('#include <color_fragment>', '#include <color_fragment>\nif (uBurn > 0.0) { float bn = cHash(floor(vOP.xz * 9.0) + floor(vOP.y * 9.0)); diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.045, 0.04, 0.036) + bn * 0.05, uBurn); }')
        .replace('#include <specularmap_fragment>', '#include <specularmap_fragment>\nspecularStrength = (vRef > 1.5 ? 1.0 : min(1.0, vRef * 1.3)) * (1.0 - uBurn * 0.9);')
        .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance += vColor * vGlow * uGlow * (1.0 - uBurn);')
        .replace('#include <envmap_fragment>', CAR_ENV);
    };
    mat.customProgramCacheKey = () => 'jj-car|' + key;
    return mat;
  }

  R3.initCars = function () {
    const MAXV = 64;
    R3.carCity = { value: 1 };
    R3.carGlow = { value: 0 };
    R3.carGlowOff = { value: 0.12 };
    const phong = (o) => new THREE.MeshPhongMaterial(Object.assign({ vertexColors: true, shininess: 90, specular: new THREE.Color(0.5, 0.5, 0.5) }, o || {}));
    R3.carMat = carPatch(phong(), R3.carGlow, 0, null, 'b');
    // припаркованные машины без водителя: фары не горят (тот же шейдер — без лишней компиляции)
    R3.carMatOff = carPatch(phong(), R3.carGlowOff, 0, null, 'b');
    // сгоревший остов: та же модель, обугленная
    R3.wreckMat = carPatch(phong({ shininess: 20 }), R3.carGlowOff, 1, null, 'b');
    // стёкла: прозрачные, у края — зеркальные; разбитые — в трещинах
    R3.carGlassMat = carPatch(phong({ transparent: true, opacity: 0.6, depthWrite: false, shininess: 300, specular: new THREE.Color(0.55, 0.55, 0.55) }), R3.carGlowOff, 0, { CAR_GLASS: '' }, 'g');
    R3.carGlassBroken = carPatch(phong({ transparent: true, opacity: 0.5, depthWrite: false, shininess: 60, side: THREE.DoubleSide }), R3.carGlowOff, 0, { CAR_GLASS: '', CAR_CRACK: '' }, 'gc');
    R3.carBrakeMat = new THREE.MeshBasicMaterial({ vertexColors: true });
    R3.carBrakeMat.color.setRGB(1.25, 1.25, 1.25);
    R3.sirenMats = [new THREE.MeshBasicMaterial({ vertexColors: true }), new THREE.MeshBasicMaterial({ vertexColors: true })];
    // колёса — два InstancedMesh (подробные вблизи, простые вдали): радиус 1, ширина 1.04, ось — локальный x
    R3.wheelMat = carPatch(phong({ shininess: 60 }), R3.carGlowOff, 0, null, 'w');
    R3.wheelIM = new THREE.InstancedMesh(shared(CM.buildWheel(0)), R3.wheelMat, MAXV * 4);
    R3.wheelIMlo = new THREE.InstancedMesh(shared(CM.buildWheel(1)), R3.wheelMat, MAXV * 4);
    for (const im of [R3.wheelIM, R3.wheelIMlo]) {
      im.count = 0;
      im.frustumCulled = false;
      im.castShadow = true;
      R3.scene.add(im);
    }
    // водители за стёклами (силуэты) — один InstancedMesh
    R3.drvIM = new THREE.InstancedMesh(shared(CM.buildDriver()), R3.wheelMat, MAXV);
    R3.drvIM.count = 0;
    R3.drvIM.frustumCulled = false;
    R3.scene.add(R3.drvIM);
    // пятна света фар на асфальте ночью (аддитивно), один InstancedMesh на все машины
    const cv = document.createElement('canvas');
    cv.width = cv.height = 64;
    const cx = cv.getContext('2d');
    const gr = cx.createRadialGradient(32, 40, 0, 32, 36, 34);
    gr.addColorStop(0, 'rgba(255,240,205,0.95)');
    gr.addColorStop(0.5, 'rgba(255,236,200,0.4)');
    gr.addColorStop(1, 'rgba(255,236,200,0)');
    cx.fillStyle = gr;
    cx.fillRect(0, 0, 64, 64);
    const pg = new THREE.PlaneGeometry(1, 1);
    pg.rotateX(-Math.PI / 2);
    const ptex = new THREE.CanvasTexture(cv);
    ptex.encoding = THREE.sRGBEncoding;
    R3.carPoolMat = new THREE.MeshBasicMaterial({ map: ptex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 });
    R3.carPoolIM = new THREE.InstancedMesh(shared(pg), R3.carPoolMat, MAXV);
    R3.carPoolIM.count = 0;
    R3.carPoolIM.frustumCulled = false;
    R3.carPoolIM.renderOrder = 2;
    R3.scene.add(R3.carPoolIM);
    // лучи фар в воздухе (конусы, мягкие к краям и к концу) — один InstancedMesh, по два на машину
    R3.beamMat = new THREE.ShaderMaterial({
      uniforms: Object.assign({ uK: { value: 0 } }, THREE.UniformsUtils.clone(THREE.UniformsLib.fog)),
      vertexShader: `varying float vT; varying vec3 vN; varying vec3 vV;
        #include <fog_pars_vertex>
        void main() {
          vT = uv.y;
          mat4 im = mat4(1.0);
          #ifdef USE_INSTANCING
          im = instanceMatrix;
          #endif
          vec4 mvPosition = modelViewMatrix * im * vec4(position, 1.0);
          vN = normalize(normalMatrix * mat3(im) * normal);
          vV = -mvPosition.xyz;
          gl_Position = projectionMatrix * mvPosition;
          #include <fog_vertex>
        }`,
      fragmentShader: `uniform float uK; varying float vT; varying vec3 vN; varying vec3 vV;
        #include <fog_pars_fragment>
        void main() {
          float side = abs(dot(normalize(vN), normalize(vV)));
          float a = uK * pow(1.0 - vT, 1.6) * smoothstep(0.0, 0.08, vT) * pow(side, 1.5);
          gl_FragColor = vec4(vec3(1.0, 0.93, 0.78) * a, 1.0);
          #include <fog_fragment>
        }`,
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: true,
    });
    const cone = new THREE.CylinderGeometry(1, 0.08, 1, 12, 1, true); // верх (y=+0.5) — широкий конец
    cone.translate(0, 0.5, 0);
    cone.rotateX(Math.PI / 2); // ось — +z, узкий конец в 0
    const cuv = cone.attributes.uv.array, cps = cone.attributes.position.array;
    for (let i = 0; i < cuv.length / 2; i++) cuv[i * 2 + 1] = cps[i * 3 + 2]; // vT — расстояние вдоль луча 0..1
    R3.beamIM = new THREE.InstancedMesh(shared(cone), R3.beamMat, MAXV * 2);
    R3.beamIM.count = 0;
    R3.beamIM.frustumCulled = false;
    R3.beamIM.renderOrder = 3;
    R3.scene.add(R3.beamIM);
    // поворотники и аварийка (мигающие янтарные огни)
    R3.indMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(2.6, 1.25, 0.12) });
    R3.indIM = new THREE.InstancedMesh(shared(new THREE.BoxGeometry(0.15, 0.07, 0.04)), R3.indMat, MAXV * 4);
    R3.indIM.count = 0;
    R3.indIM.frustumCulled = false;
    R3.scene.add(R3.indIM);
    // настоящий свет — только у машины игрока (добавлен один раз: меняется лишь яркость — без перекомпиляции шейдеров)
    R3.carBeam = new THREE.SpotLight('#fff1d0', 0, 38, 0.52, 0.55, 1.4);
    R3.scene.add(R3.carBeam, R3.carBeam.target);
    // горящие секции светофоров
    const lg = new THREE.BoxGeometry(0.05, 0.2, 0.2);
    R3.sigIM = new THREE.InstancedMesh(shared(lg), new THREE.MeshBasicMaterial({ color: '#ffffff' }), 512);
    R3.sigIM.count = 0;
    R3.sigIM.frustumCulled = false;
    R3.sigIM.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(512 * 3), 3);
    R3.scene.add(R3.sigIM);
    // заранее собрать частые машины (чтобы появление потока не давало рывков)
    for (const id of ['sedan', 'hatch']) {
      const t = J.VTYPES[id];
      for (let i = 0; i < Math.min(3, t.colors.length); i++) R3.carGeo(id, t.colors[i], null, 'usa').keep = true;
    }
  };
  // качество → дальность подробной модели
  R3.carLodD2 = () => [18 * 18, 32 * 32, 46 * 46][R3.quality === undefined ? 1 : R3.quality] || 1024;

  // ---------- Вид одной машины: группа (кузов, стёкла, стоп-сигналы, мигалки) ----------
  R3.makeCarView = function (v) {
    const g = R3.carGeo(v.type, v.color, v.livery, v.region);
    g.users++;
    const grp = new THREE.Group();
    grp.matrixAutoUpdate = false;
    const body = new THREE.Mesh(g.lo, R3.carMat);
    body.castShadow = false;
    body.receiveShadow = true;
    const brake = new THREE.Mesh(g.brake, R3.carBrakeMat);
    brake.visible = false;
    grp.add(body, brake);
    let siren = null;
    if (g.siren) {
      siren = [new THREE.Mesh(g.siren[0], R3.sirenMats[0]), new THREE.Mesh(g.siren[1], R3.sirenMats[1])];
      grp.add(siren[0], siren[1]);
    }
    R3.scene.add(grp);
    return { group: grp, body, brake, siren, glass: null, geo: g, cast: false, hi: false, own: null, nDent: 0 };
  };
  R3.dropCarView = function (v) {
    const vw = v.view;
    if (!vw) return;
    R3.scene.remove(vw.group); // геометрия общая и кэшированная — не освобождаем (кроме своей, помятой)
    if (vw.own) vw.own.dispose();
    vw.geo.users--;
    v.view = null;
  };
  // ближний / дальний план
  function setHi(v, vw, on) {
    const g = vw.geo;
    if (on && !g.big) {
      buildHi(g);
      if (!vw.glass) {
        vw.glass = new THREE.Mesh(g.glass, R3.carGlassMat);
        vw.glass.renderOrder = 1;
        vw.group.add(vw.glass);
      }
      vw.glass.visible = true;
      if (v.dents && v.dents.length && vw.nDent !== v.dents.length) applyDents(v, vw);
      vw.body.geometry = vw.own || g.hi;
    } else {
      if (vw.glass) vw.glass.visible = false;
      vw.body.geometry = g.hi && g.big ? g.hi : g.lo;
    }
    vw.hi = on;
  }

  // ---------- Вмятины: смещение вершин своей копии кузова ----------
  // dent: {x, y, z} — точка удара в системе машины, a — глубина, r — радиус; bumper: ±1 — оторванный бампер спереди/сзади
  const NRM = new THREE.Vector3();
  function applyDents(v, vw) {
    const g = vw.geo;
    if (!g.hi || g.big) return;
    if (!vw.own) vw.own = g.hi.clone();
    const src = g.hi.attributes, P = vw.own.attributes.position.array, N = vw.own.attributes.normal.array;
    P.set(src.position.array);
    N.set(src.normal.array);
    const vt = v.vt, zf = vt.L / 2, hw = vt.W / 2;
    for (const d of v.dents) {
      if (d.bumper) {
        // бампер повис: нижняя часть торца опускается с одной стороны
        const by = (g.bumper ? (d.bumper > 0 ? g.bumper.yf : g.bumper.yr) : 0.5) + 0.12;
        for (let i = 0; i < P.length; i += 3) {
          const z = P[i + 2] * d.bumper;
          if (z < zf - 0.42 || P[i + 1] > by) continue;
          const k = (z - (zf - 0.42)) / 0.42;
          const s = (P[i] * d.side / hw + 1) / 2;
          P[i + 1] -= k * s * s * 0.26;
          P[i + 2] += d.bumper * k * s * 0.06;
        }
        continue;
      }
      const r2 = d.r * d.r;
      for (let i = 0; i < P.length; i += 3) {
        const dx = P[i] - d.x, dy = (P[i + 1] - d.y) * 1.4, dz = P[i + 2] - d.z;
        const q = dx * dx + dy * dy + dz * dz;
        if (q >= r2) continue;
        const r = Math.sqrt(q), u = 1 - r / d.r;
        // гофр — металл мнётся складками
        const cr = 0.75 + 0.25 * Math.sin(P[i] * 23 + P[i + 1] * 17 + P[i + 2] * 29);
        const dep = d.a * u * u * cr;
        // внутрь кузова: к оси машины по горизонтали
        let ix = -P[i], iz = 0;
        if (Math.abs(P[i + 2]) > zf - 0.5) iz = -Math.sign(P[i + 2]) * (Math.abs(P[i + 2]) - (zf - 0.5)) * 2;
        const il = Math.hypot(ix, iz) || 1;
        P[i] += (ix / il) * dep;
        P[i + 1] -= dep * 0.35;
        P[i + 2] += (iz / il) * dep;
        // нормали: склоны вмятины смотрят к её центру
        const k = (2 * d.a * u * cr) / d.r * 1.6;
        NRM.set(N[i] - (dx / (r || 1)) * k, N[i + 1] - (dy / (r || 1)) * k * 0.6, N[i + 2] - (dz / (r || 1)) * k).normalize();
        N[i] = NRM.x;
        N[i + 1] = NRM.y;
        N[i + 2] = NRM.z;
      }
    }
    vw.own.attributes.position.needsUpdate = true;
    vw.own.attributes.normal.needsUpdate = true;
    vw.nDent = v.dents.length;
  }
  // удар в точку карты (x, y) силой imp: записываем вмятину и обновляем вид
  R3.carDent = function (v, x, y, imp, h) {
    if (v.vt.shape === 'bus' || v.vt.shape === 'truck') return;
    const ca = Math.cos(v.ang), sa = Math.sin(v.ang);
    const dx = x - v.x, dy = y - v.y;
    const hl = v.vt.L / 2, hw = v.vt.W / 2;
    // точка на корпусе (в системе машины: +z вперёд, +x — левый борт)
    let lz = dx * ca + dy * sa, lx = dx * sa - dy * ca;
    lz = J.clamp(lz, -hl, hl);
    lx = J.clamp(lx, -hw, hw);
    if (Math.abs(lz) / hl > Math.abs(lx) / hw) lz = Math.sign(lz) * hl;
    else lx = Math.sign(lx) * hw;
    const dents = v.dents || (v.dents = []);
    const a = Math.min(0.3, 0.04 + imp * 0.012), r = Math.min(1.25, 0.45 + imp * 0.035);
    // рядом уже есть вмятина — углубляем её
    let d = null;
    for (const o of dents) if (!o.bumper && Math.hypot(o.x - lx, o.z - lz) < r * 0.5) d = o;
    if (d) {
      d.a = Math.min(0.34, d.a + a * 0.5);
      d.r = Math.min(1.35, Math.max(d.r, r));
    } else if (dents.length < 14) dents.push({ x: lx, y: h === undefined ? 0.62 : h, z: lz, a, r });
    if (imp > 9 && Math.abs(lz) >= hl - 0.01 && !dents.some((o) => o.bumper === Math.sign(lz))) dents.push({ bumper: Math.sign(lz), side: Math.random() < 0.5 ? 1 : -1 });
    const vw = v.view;
    if (vw && vw.hi) {
      applyDents(v, vw);
      vw.body.geometry = vw.own;
    }
  };

  // ---------- Покадровая синхронизация всех машин ----------
  const mW = new THREE.Matrix4(), mC = new THREE.Matrix4(), mL = new THREE.Matrix4(), qq = new THREE.Quaternion(), e3 = new THREE.Euler(), pp = new THREE.Vector3(), ss = new THREE.Vector3();
  const casters = [];
  // поворотник: 1 — левый, -1 — правый, 2 — аварийка, 0 — нет
  function blinker(v, t) {
    if (v.hp <= 0) return 0;
    if (v.fire || (v.hp < v.maxHp * 0.3 && v.mode !== 'player')) return 2;
    if (v.mode !== 'ai' || !v.path) return v.blink || 0;
    const P = v.path;
    let turn = null;
    if (P.kind === 'conn') turn = P.turn;
    else if (v.nextC && P.len - v.s < 32) turn = v.nextC.turn;
    if (turn === 'l' || turn === 'u') return 1;
    if (turn === 'r') return -1;
    if (v.latT) return v.latT > 0 ? 1 : -1; // объезд
    return 0;
  }
  R3.updateCars = function (list, t, playerCar) {
    const day = R3.dayLevel === undefined ? 1 : R3.dayLevel;
    const night = J.clamp(1 - day * 1.4, 0, 1);
    let wi = 0, wl = 0, pi = 0, di = 0, bi = 0, ii = 0;
    // фары: днём тусклые (просто цвет стекла), ночью ярче единицы — тональная кривая даст свечение
    R3.carGlow.value = 0.15 + 2.4 * night;
    const flash = Math.sin(t * 14) > 0;
    const blinkOn = t * 1.6 % 1 < 0.55;
    R3.sirenMats[0].color.setScalar(flash ? 2.6 : 0.3);
    R3.sirenMats[1].color.setScalar(flash ? 0.3 : 2.6);
    const far = R3.scene.fog.far * 0.88, far2 = far * far; // дальше — в тумане, не рисуем
    const cx = R3.cam.tx, cz = R3.cam.tz;
    const w = J.G && J.G.world;
    R3.carCity.value = w && w.cityAt && w.cityAt(cx, cz) ? 1 : 0.35;
    const maxCast = R3.shadows && R3.preset.shadows ? Math.max(2, R3.charCast) : 0;
    const lod2 = R3.carLodD2();
    let hiBudget = 1; // подробных моделей за кадр (сборка 1.5–2 мс)
    casters.length = 0;
    for (let i = 0; i < list.length; i++) {
      const v = list[i];
      const dx = v.x - cx, dz = v.y - cz;
      v.d2 = dx * dx + dz * dz;
      if (v.d2 > far2) {
        if (v.view) v.view.group.visible = false;
        continue;
      }
      if (!v.view) v.view = R3.makeCarView(v);
      const vw = v.view, vt = v.vt, g = vw.geo;
      const gr = vw.group;
      gr.visible = true;
      // ближний план: подробная модель (собирается не больше одной за кадр)
      const wantHi = !g.big && (v.d2 < lod2 || v === playerCar);
      if (wantHi !== vw.hi && (!wantHi || g.hi || hiBudget-- > 0 || v === playerCar)) setHi(v, vw, wantHi);
      else if (vw.hi && v.dents && vw.nDent !== v.dents.length) {
        applyDents(v, vw);
        vw.body.geometry = vw.own;
      }
      gr.position.set(v.x, v.gy + (v.bob || 0), v.y);
      e3.set(v.pitch || 0, Math.PI / 2 - v.ang, v.roll || 0, 'YXZ');
      gr.rotation.copy(e3);
      gr.updateMatrix();
      gr.updateMatrixWorld(true);
      const wreck = v.hp <= 0;
      vw.brake.visible = !wreck && (v.braking || v.reverse);
      if (vw.siren) vw.siren[0].visible = vw.siren[1].visible = !!v.siren;
      const lit = !wreck && !!v.driver;
      const mat = wreck ? R3.wreckMat : lit ? R3.carMat : R3.carMatOff;
      if (vw.body.material !== mat) vw.body.material = mat;
      if (vw.glass) {
        vw.glass.visible = vw.hi && !wreck;
        const gm = v.glassBroken ? R3.carGlassBroken : R3.carGlassMat;
        if (vw.glass.material !== gm) vw.glass.material = gm;
      }
      if (v.d2 < 900 && maxCast) casters.push(v);
      // колёса: матрица машины × T(локально) × Ry(-руль, передние) × Rx(вращение) × S(ширина, r, r)
      const hwT = vt.tr / 2, hz = vt.wb / 2, r = vt.wr, zoff = g.zoff;
      const tw = (r * 0.62 + 0.04) / 1.04;
      const im = vw.hi || g.big && v.d2 < lod2 ? R3.wheelIM : R3.wheelIMlo;
      for (let k = 0; k < 4; k++) {
        const front = k < 2, sx = k % 2 ? -1 : 1;
        // подвеска: колесо чуть ниже кузова при крене (кузов «висит» на пружинах)
        const sus = -((v.roll || 0) * sx * hwT * 0.6) + (front ? 1 : -1) * (v.pitch || 0) * hz * 0.5;
        pp.set(sx * hwT, r + J.clamp(sus, -0.06, 0.06), (front ? hz : -hz) + zoff);
        qq.setFromEuler(e3.set(v.spin || 0, front ? v.steer || 0 : 0, wreck ? sx * 0.12 : 0, 'YXZ'));
        ss.set(tw, r, r);
        mL.compose(pp, qq, ss);
        mW.multiplyMatrices(gr.matrixWorld, mL);
        if (im === R3.wheelIM) R3.wheelIM.setMatrixAt(wi++, mW);
        else R3.wheelIMlo.setMatrixAt(wl++, mW);
      }
      // водитель за стеклом
      if (vw.hi && !wreck && v.driver && di < 64) {
        const s = g.seat;
        pp.set(s.x, s.y - 0.05, s.z);
        qq.identity();
        ss.set(1, 1, 1);
        mL.compose(pp, qq, ss);
        mW.multiplyMatrices(gr.matrixWorld, mL);
        R3.drvIM.setMatrixAt(di++, mW);
      }
      // поворотники
      const bl = blinker(v, t);
      if (bl && blinkOn && ii < 250 && v.d2 < 6400) {
        const fx = g.fx;
        for (const side of bl === 2 ? [1, -1] : [bl]) {
          for (const P of [fx.indF, fx.indR]) {
            pp.set(side * P[0], P[1], P[2]);
            qq.identity();
            ss.set(1, 1, 1);
            mL.compose(pp, qq, ss);
            mW.multiplyMatrices(gr.matrixWorld, mL);
            R3.indIM.setMatrixAt(ii++, mW);
          }
        }
      }
      if (night > 0.25 && lit) {
        const ca = Math.cos(v.ang), sa = Math.sin(v.ang);
        // пятно света фар
        if (pi < 64) {
          const d = vt.L / 2 + 4.2;
          pp.set(v.x + ca * d, v.gy + 0.07, v.y + sa * d);
          qq.setFromAxisAngle(THREE.Object3D.DefaultUp, Math.PI / 2 - v.ang);
          ss.set(vt.W * 2.4, 1, 9.5);
          mC.compose(pp, qq, ss);
          R3.carPoolIM.setMatrixAt(pi++, mC);
        }
        // лучи из фар (вблизи)
        if (v.d2 < 4900 && bi < 126) {
          const fx = g.fx;
          for (const L of fx.front) {
            pp.set(L[0], L[1], fx.zf + 0.02);
            qq.setFromAxisAngle(ax1, 0.075);
            ss.set(0.85, 0.42, 11);
            mL.compose(pp, qq, ss);
            mW.multiplyMatrices(gr.matrixWorld, mL);
            R3.beamIM.setMatrixAt(bi++, mW);
          }
        }
      }
    }
    // тени отбрасывают только ближайшие машины
    if (casters.length > 1) casters.sort((a, b) => a.d2 - b.d2);
    for (let i = 0; i < list.length; i++) {
      const v = list[i];
      if (!v.view) continue;
      const want = maxCast > 0 && (v === playerCar || casters.indexOf(v) < maxCast) && v.d2 < 900;
      if (v.view.cast !== want) {
        v.view.cast = want;
        v.view.body.castShadow = want;
      }
    }
    const upd = (m, n) => {
      m.count = n;
      m.instanceMatrix.needsUpdate = true;
    };
    upd(R3.wheelIM, wi);
    upd(R3.wheelIMlo, wl);
    upd(R3.drvIM, di);
    upd(R3.carPoolIM, pi);
    upd(R3.beamIM, bi);
    upd(R3.indIM, ii);
    R3.carPoolMat.color.setScalar(0.85 * night);
    R3.beamMat.uniforms.uK.value = 0.16 * night;
    // свет фар машины игрока
    const b = R3.carBeam;
    if (playerCar && night > 0.2 && playerCar.hp > 0) {
      const ca = Math.cos(playerCar.ang), sa = Math.sin(playerCar.ang), L2 = playerCar.vt.L / 2;
      b.position.set(playerCar.x + ca * L2, playerCar.gy + 0.8, playerCar.y + sa * L2);
      b.target.position.set(playerCar.x + ca * (L2 + 14), playerCar.gy - 0.6, playerCar.y + sa * (L2 + 14));
      b.target.updateMatrixWorld();
      b.intensity = 2.2 * night;
    } else b.intensity = 0;
  };
  const ax1 = new THREE.Vector3(1, 0, 0);

  // ---------- Светофоры: горящая секция по фазе ----------
  // Головы светофоров ищутся по той же раскладке углов, что и в генераторе (world.decorateCities).
  const RC = [1, 0, -1, 0], RS = [0, 1, 0, -1];
  R3.initSignals = function (w) {
    const heads = [];
    const O = J.O, W = w.W;
    for (const nd of w.net.nodes) {
      if (nd.ctrl !== 'signal' || !nd.city) continue;
      const hx = nd.aw[0] / 2, hy = nd.aw[1] / 2;
      const left = (J.GRID[J.REGION[nd.city].style] || J.GRID.usa).drive === 'L';
      const corners = left ? [[hx, hy], [-hx - 1, hy], [-hx - 1, -hy - 1], [hx, -hy - 1]] : [[hx, hy], [-hx - 1, hy], [-hx - 1, -hy - 1], [hx, -hy - 1]];
      for (const [ox, oy] of corners) {
        const X = nd.x + ox, Y = nd.y + oy;
        if (!w.inb(X, Y) || w.o[Y * W + X] !== O.TLIGHT) continue;
        const od = w.od[Y * W + X];
        const sx = left ? -1 : 1;
        const gy = w.groundY(X + 0.5, Y + 0.5);
        const px = X + 0.5 + J.DIRV.DX[od] * 0.3, pz = Y + 0.5 + J.DIRV.DY[od] * 0.3;
        heads.push({ nd, px, pz, gy, od, sx, axis: od % 2 === 0 ? 'ew' : 'ns' });
      }
    }
    R3.sigHeads = heads;
  };
  const SIG_Y = { R: 5.2, Y: 4.9, G: 4.6 };
  const SIG_C = { R: [1.7, 0.06, 0.03], Y: [1.7, 0.75, 0.04], G: [0.08, 1.5, 0.5] };
  R3.updateSignals = function (w, t) {
    const heads = R3.sigHeads;
    if (!heads || !R3.sigIM) return;
    const cx = R3.cam.tx, cz = R3.cam.tz;
    const im = R3.sigIM, ic = im.instanceColor.array;
    let n = 0;
    for (let i = 0; i < heads.length && n < 510; i++) {
      const h = heads[i];
      const dx = h.px - cx, dz = h.pz - cz;
      if (dx * dx + dz * dz > 110 * 110) continue;
      const st = w.signalState(h.nd, t)[h.axis];
      const cs = RC[h.od], sn = RS[h.od];
      qq.setFromAxisAngle(THREE.Object3D.DefaultUp, (h.od * Math.PI) / 2);
      ss.set(1, 1, 1);
      const lx = h.sx * 0.185;
      for (const lz of [2.6, 4.1]) {
        pp.set(h.px + lx * cs + lz * sn, h.gy + SIG_Y[st], h.pz - lx * sn + lz * cs);
        mC.compose(pp, qq, ss);
        im.setMatrixAt(n, mC);
        const c = SIG_C[st];
        ic[n * 3] = c[0];
        ic[n * 3 + 1] = c[1];
        ic[n * 3 + 2] = c[2];
        n++;
      }
    }
    im.count = n;
    im.instanceMatrix.needsUpdate = true;
    im.instanceColor.needsUpdate = true;
  };
})();
