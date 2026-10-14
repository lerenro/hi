'use strict';
// Атмосфера: небесный купол с градиентом, солнцем и облаками, свет по времени суток (солнце/луна/небо),
// туман в цвет горизонта, детальная текстура земли, вода с рябью и отражением неба, свет фонарей ночью.
// Всё масштабируется пресетами качества (R3.preset) и не создаёт объектов в кадре.
(function () {
  const R3 = J.R3;
  const TAU = Math.PI * 2;

  // ---------- Бесшовный fbm-шум (решётка значений + сглаживание), size×size, значения ~0..1 ----------
  function fbm(size, P0, oct, seed) {
    const out = new Float32Array(size * size);
    let amp = 1, norm = 0, P = P0;
    for (let o = 0; o < oct && P <= size; o++, P *= 2, amp *= 0.5) {
      const lat = new Float32Array(P * P);
      for (let i = 0; i < P * P; i++) lat[i] = J.hash2(i % P, (i / P) | 0, seed + o * 31);
      const sc = P / size, i0 = new Int32Array(size), i1 = new Int32Array(size), w = new Float32Array(size);
      for (let x = 0; x < size; x++) {
        const f = x * sc, xi = Math.floor(f), t = f - xi;
        i0[x] = xi % P;
        i1[x] = (xi + 1) % P;
        w[x] = t * t * (3 - 2 * t);
      }
      for (let y = 0; y < size; y++) {
        const r0 = i0[y] * P, r1 = i1[y] * P, wy = w[y];
        for (let x = 0; x < size; x++) {
          const a = lat[r0 + i0[x]], b = lat[r0 + i1[x]], c = lat[r1 + i0[x]], d = lat[r1 + i1[x]], wx = w[x];
          const top = a + (b - a) * wx, bot = c + (d - c) * wx;
          out[y * size + x] += (top + (bot - top) * wy) * amp;
        }
      }
      norm += amp;
    }
    for (let i = 0; i < out.length; i++) out[i] /= norm;
    return out;
  }
  const dataTex = (size, fill, repeat, encoding) => {
    const d = new Uint8Array(size * size * 4);
    fill(d);
    const t = new THREE.DataTexture(d, size, size, THREE.RGBAFormat);
    t.wrapS = t.wrapT = repeat ? THREE.RepeatWrapping : THREE.ClampToEdgeWrapping;
    t.magFilter = THREE.LinearFilter;
    t.minFilter = THREE.LinearMipmapLinearFilter;
    t.generateMipmaps = true;
    t.encoding = encoding || THREE.LinearEncoding;
    t.needsUpdate = true;
    return t;
  };
  const stretch = (a) => {
    // растягиваем к 0..1 (fbm сжат к середине)
    let lo = 1, hi = 0;
    for (let i = 0; i < a.length; i++) {
      if (a[i] < lo) lo = a[i];
      if (a[i] > hi) hi = a[i];
    }
    const k = 1 / (hi - lo || 1);
    for (let i = 0; i < a.length; i++) a[i] = (a[i] - lo) * k;
    return a;
  };

  // Облака: R — крупные массивы, G — мелкие клочья
  function makeClouds(S) {
    const a = stretch(fbm(S, 4, 6, 777)), b = stretch(fbm(S, 8, 5, 778));
    return dataTex(S, (d) => {
      for (let i = 0; i < S * S; i++) {
        d[i * 4] = a[i] * 255;
        d[i * 4 + 1] = b[i] * 255;
        d[i * 4 + 2] = 0;
        d[i * 4 + 3] = 255;
      }
    }, true);
  }
  // Деталь земли (4 м на повтор): R — трава (штрихи + зерно), G — грунт/камень (пятна), B — крупные пятна для макро-вариаций
  function makeDetail(S) {
    const n1 = stretch(fbm(S, 16, 4, 31)), n2 = stretch(fbm(S, 8, 5, 32)), n3 = stretch(fbm(S, 4, 4, 33));
    const R = J.rng(4242);
    const grass = new Float32Array(S * S);
    for (let i = 0; i < S * S; i++) grass[i] = 0.5 + (n1[i] - 0.5) * 0.5 + (R() - 0.5) * 0.45;
    // травинки: короткие вертикальные штрихи (бесшовно — по модулю)
    for (let k = 0; k < S * S * 0.06; k++) {
      const x = (R() * S) | 0, y = (R() * S) | 0, L = 2 + ((R() * 4) | 0), v = R() < 0.5 ? 0.3 : -0.3;
      for (let j = 0; j < L; j++) {
        const i = ((y + j) % S) * S + x;
        grass[i] = Math.max(0, Math.min(1, grass[i] + v * (1 - j / L)));
      }
    }
    return dataTex(S, (d) => {
      for (let i = 0; i < S * S; i++) {
        const st = n2[i] * 0.7 + (R() - 0.5) * 0.4 + (n1[i] > 0.7 ? -0.2 : 0);
        d[i * 4] = Math.max(0, Math.min(1, grass[i])) * 255;
        d[i * 4 + 1] = Math.max(0, Math.min(1, 0.15 + st * 0.85)) * 255;
        d[i * 4 + 2] = n3[i] * 255;
        d[i * 4 + 3] = 255;
      }
    }, true);
  }
  // Нормали воды из бесшовной карты высот
  function makeWaterN(S) {
    const h = fbm(S, 8, 4, 909);
    return dataTex(S, (d) => {
      for (let y = 0; y < S; y++)
        for (let x = 0; x < S; x++) {
          const l = h[y * S + ((x - 1 + S) % S)], r = h[y * S + ((x + 1) % S)];
          const u = h[((y - 1 + S) % S) * S + x], dn = h[((y + 1) % S) * S + x];
          const nx = (l - r) * 7, ny = (u - dn) * 7, L = Math.hypot(nx, ny, 1);
          const i = (y * S + x) * 4;
          d[i] = (nx / L * 0.5 + 0.5) * 255;
          d[i + 1] = (ny / L * 0.5 + 0.5) * 255;
          d[i + 2] = (1 / L * 0.5 + 0.5) * 255;
          d[i + 3] = 255;
        }
    }, true);
  }
  // Световое пятно фонаря на земле
  function makePool() {
    const S = 64;
    return dataTex(S, (d) => {
      for (let y = 0; y < S; y++)
        for (let x = 0; x < S; x++) {
          const r = Math.hypot(x - S / 2 + 0.5, y - S / 2 + 0.5) / (S / 2);
          const v = Math.max(0, 1 - r);
          const k = v * v * (0.6 + 0.4 * v);
          const i = (y * S + x) * 4;
          d[i] = d[i + 1] = d[i + 2] = k * 255;
          d[i + 3] = 255;
        }
    }, false);
  }

  // ---------- Тональная кривая ACES (как в three.js r128) и sRGB — чтобы туман совпал с горизонтом ----------
  function aces(c, out) {
    const e = R3.renderer.toneMappingExposure / 0.6;
    const r = c.r * e, g = c.g * e, b = c.b * e;
    const ir = 0.59719 * r + 0.35458 * g + 0.04823 * b, ig = 0.076 * r + 0.90834 * g + 0.01566 * b, ib = 0.0284 * r + 0.13383 * g + 0.83777 * b;
    const fit = (v) => (v * (v + 0.0245786) - 0.000090537) / (v * (0.983729 * v + 0.432951) + 0.238081);
    const fr = fit(ir), fg = fit(ig), fb = fit(ib);
    const or = 1.60475 * fr - 0.53108 * fg - 0.07367 * fb, og = -0.10208 * fr + 1.10813 * fg - 0.00605 * fb, ob = -0.00327 * fr - 0.07276 * fg + 1.07602 * fb;
    const enc = (v) => {
      v = Math.max(0, Math.min(1, v));
      return v < 0.0031308 ? v * 12.92 : 1.055 * Math.pow(v, 0.41666) - 0.055;
    };
    return out.setRGB(enc(or), enc(og), enc(ob));
  }

  // ---------- Небесный купол ----------
  const SKY_VS = `
    varying vec3 vDir;
    void main() {
      vDir = position;
      vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      gl_Position = vec4(p.xy, p.w * 0.99999, p.w); // на дальней плоскости
    }`;
  const SKY_FS = `
    uniform vec3 zenith, horizon, groundC, sunDir, sunCol, cloudLit, cloudDark, fogOut;
    uniform float sunVis, cover, cloudAmt;
    uniform vec2 cloudOff;
    uniform sampler2D cloudTex;
    varying vec3 vDir;
    void main() {
      vec3 d = normalize(vDir);
      float h = d.y;
      vec3 col = mix(horizon, zenith, pow(clamp(h, 0.0, 1.0), 0.5));
      col = mix(col, groundC, smoothstep(0.0, -0.1, h));
      float sd = max(dot(d, sunDir), 0.0);
      // ореол и диск солнца
      col += sunCol * (pow(sd, 6.0) * 0.18 + pow(sd, 48.0) * 0.45) * sunVis;
      col += sunCol * smoothstep(0.99935, 0.99965, sd) * 14.0 * sunVis * smoothstep(-0.03, 0.02, h);
      #ifdef CLOUDS
      if (h > 0.0) {
        vec2 uv = d.xz / (h + 0.12) * 0.22;
        float a = texture2D(cloudTex, uv * 0.6 + cloudOff).r;
        float b = texture2D(cloudTex, uv * 1.9 + cloudOff * 1.7 + 0.31).g;
        float n = a * 0.72 + b * 0.38;
        float c = smoothstep(cover, cover + 0.28, n) * smoothstep(0.0, 0.18, h) * cloudAmt;
        float thick = smoothstep(cover, cover + 0.6, n);
        vec3 cc = mix(cloudLit, cloudDark, thick * 0.7);
        cc += sunCol * pow(sd, 10.0) * 0.6 * sunVis * (1.0 - thick);
        col = mix(col, cc, c);
      }
      #endif
      gl_FragColor = vec4(col, 1.0);
      #include <tonemapping_fragment>
      #include <encodings_fragment>
      // у самого горизонта — ровно цвет тумана, чтобы край мира растворялся
      gl_FragColor.rgb = mix(gl_FragColor.rgb, fogOut, (1.0 - smoothstep(0.0, 0.06, abs(h))) * 0.85);
    }`;

  // Ключевые цвета неба по высоте солнца (sRGB; Color переведёт в линейные)
  const K = [
    // el (градусы), зенит, горизонт, солнце, сила солнца, небо (полусфера), сила неба
    { el: -18, z: '#03050d', h: '#0a0e1e', s: '#000000', si: 0, hc: '#3a4c8a', hi: 0.3 },
    { el: -7, z: '#0d1430', h: '#2a2a48', s: '#000000', si: 0, hc: '#44528a', hi: 0.3 },
    { el: -1, z: '#24346a', h: '#c86a4a', s: '#ff6a2a', si: 0, hc: '#6a6a9a', hi: 0.3 },
    { el: 4, z: '#3a5ea6', h: '#f2a070', s: '#ff9a50', si: 0.55, hc: '#a0a0c0', hi: 0.32 },
    { el: 14, z: '#3f74c4', h: '#c8d4dc', s: '#ffd6a0', si: 0.95, hc: '#b8cce4', hi: 0.4 },
    { el: 35, z: '#2f6ad0', h: '#a9cdee', s: '#fff2e0', si: 1.15, hc: '#c4dcf6', hi: 0.45 },
    { el: 90, z: '#2a62cc', h: '#a4caee', s: '#fff6ea', si: 1.25, hc: '#c8e0fa', hi: 0.47 },
  ].map((k) => ({ el: k.el, z: new THREE.Color(k.z), h: new THREE.Color(k.h), s: new THREE.Color(k.s), si: k.si, hc: new THREE.Color(k.hc), hi: k.hi }));

  // временные объекты (без аллокаций в кадре)
  const cZ = new THREE.Color(), cH = new THREE.Color(), cS = new THREE.Color(), cHC = new THREE.Color(), cT = new THREE.Color();
  const C_GREY = new THREE.Color('#8a9098'), C_SAND = new THREE.Color('#d6b07a'), C_MOOR = new THREE.Color('#a4acb4'), C_DESERT = new THREE.Color('#bcd6f0');
  const C_GROUND = new THREE.Color('#5a5446'), C_MOON = new THREE.Color('#7f96d8'), C_WIN = new THREE.Color('#ffe6c4'), C_POOL = new THREE.Color('#ffc890');
  const C_CLOUD = new THREE.Color('#ffffff'), C_CLOUD_D = new THREE.Color('#8a94a4');
  const vDir = new THREE.Vector3(), vRt = new THREE.Vector3(), vUp = new THREE.Vector3(), vTc = new THREE.Vector3();
  const UPV = new THREE.Vector3(0, 1, 0);
  const SMP = { si: 0, hi: 0 };

  R3.lookInit = function () {
    const P = R3.preset;
    R3.tex = {
      clouds: makeClouds(P.texSize),
      detail: makeDetail(P.texSize),
      waterN: makeWaterN(128),
      pool: makePool(),
    };
    for (const k in R3.tex) R3.tex[k].anisotropy = Math.min(P.aniso, R3.renderer.capabilities.getMaxAnisotropy());
    // купол неба
    const u = (R3.skyU = {
      zenith: { value: new THREE.Color() }, horizon: { value: new THREE.Color() }, groundC: { value: new THREE.Color() },
      sunDir: { value: new THREE.Vector3(0, 1, 0) }, sunCol: { value: new THREE.Color() }, sunVis: { value: 1 },
      cloudLit: { value: new THREE.Color() }, cloudDark: { value: new THREE.Color() }, cover: { value: 0.5 }, cloudAmt: { value: 1 },
      cloudOff: { value: new THREE.Vector2() }, cloudTex: { value: R3.tex.clouds }, fogOut: { value: new THREE.Color() },
    });
    R3.skyMat = new THREE.ShaderMaterial({ uniforms: u, vertexShader: SKY_VS, fragmentShader: SKY_FS, side: THREE.BackSide, depthWrite: false, fog: false });
    R3.sky = new THREE.Mesh(new THREE.SphereGeometry(300, 32, 16), R3.skyMat);
    R3.sky.frustumCulled = false;
    R3.sky.renderOrder = -10;
    R3.scene.add(R3.sky);
    R3.stars.renderOrder = -9;
    // деталь земли: мировые UV из позиции, трава/грунт по цвету вершины, макро-пятна против повторов
    const tm = R3.terrainMat;
    tm.userData.detail = { value: R3.tex.detail };
    tm.onBeforeCompile = (sh) => {
      if (!R3.preset.detail) return;
      sh.uniforms.detailMap = tm.userData.detail;
      sh.vertexShader = sh.vertexShader
        .replace('#include <common>', '#include <common>\nvarying vec2 vDet;')
        .replace('#include <begin_vertex>', '#include <begin_vertex>\nvDet = (modelMatrix * vec4(transformed, 1.0)).xz;');
      sh.fragmentShader = sh.fragmentShader
        .replace('#include <common>', '#include <common>\nvarying vec2 vDet;\nuniform sampler2D detailMap;')
        .replace(
          '#include <color_fragment>',
          `#include <color_fragment>
          vec4 dA = texture2D(detailMap, vDet * 0.25);
          vec4 dB = texture2D(detailMap, vDet * 0.037 + 0.5);
          float grn = clamp((diffuseColor.g - max(diffuseColor.r, diffuseColor.b)) * 9.0, 0.0, 1.0);
          float fine = mix(dA.g, dA.r, grn);
          diffuseColor.rgb *= (0.5 + fine * 1.0) * (0.82 + dB.b * 0.36);
          // пятна подсохшей травы
          diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * vec3(1.35, 1.08, 0.55), smoothstep(0.45, 0.85, dB.g) * grn * 0.7);`
        );
    };
    tm.customProgramCacheKey = () => 'terrain-detail-' + (R3.preset.detail ? 1 : 0);
    // вода: рябь (карта нормалей), блики солнца, отражение неба под углом (Френель)
    const wm = R3.waterMat;
    wm.color.set('#1f6a8a');
    wm.opacity = 0.72;
    wm.shininess = 160;
    wm.specular.set('#ffffff');
    wm.userData.sky = { value: new THREE.Color() };
    wm.onBeforeCompile = (sh) => {
      sh.uniforms.skyRefl = wm.userData.sky;
      sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nuniform vec3 skyRefl;').replace(
        'gl_FragColor = vec4( outgoingLight, diffuseColor.a );',
        `float fr = pow(1.0 - clamp(dot(normalize(vViewPosition), normal), 0.0, 1.0), 4.0);
        outgoingLight = mix(outgoingLight, skyRefl, fr * 0.75);
        gl_FragColor = vec4(outgoingLight, mix(diffuseColor.a, 0.97, fr));`
      );
    };
    wm.customProgramCacheKey = () => 'water-' + (R3.preset.waterN ? 1 : 0);
    R3.water.geometry.dispose();
    const wg = new THREE.PlaneGeometry(420, 420, 1, 1);
    wg.rotateX(-Math.PI / 2);
    R3.water.geometry = wg;
    R3.tex.waterN.repeat.set(420 / 9, 420 / 9);
    // световые пятна фонарей (геометрия — в чанках города)
    R3.poolMat = new THREE.MeshBasicMaterial({ map: R3.tex.pool, color: '#ffc890', transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 });
    R3.poolMat.visible = false;
    R3.lookQuality(P);
  };

  // Что включено на каком пресете
  R3.lookQuality = function (P) {
    if (!R3.skyMat) return;
    R3.skyMat.defines = P.clouds ? { CLOUDS: 1 } : {};
    R3.skyMat.needsUpdate = true;
    R3.waterMat.normalMap = P.waterN ? R3.tex.waterN : null;
    R3.waterMat.normalScale.set(0.35, 0.35);
    R3.waterMat.needsUpdate = true;
    R3.terrainMat.needsUpdate = true;
  };

  // интерполяция ключей по высоте солнца
  function sample(el) {
    let i = 0;
    while (i < K.length - 2 && el > K[i + 1].el) i++;
    const a = K[i], b = K[i + 1];
    const t = Math.max(0, Math.min(1, (el - a.el) / (b.el - a.el)));
    cZ.copy(a.z).lerp(b.z, t);
    cH.copy(a.h).lerp(b.h, t);
    cS.copy(a.s).lerp(b.s, t);
    cHC.copy(a.hc).lerp(b.hc, t);
    SMP.si = a.si + (b.si - a.si) * t;
    SMP.hi = a.hi + (b.hi - a.hi) * t;
    return SMP;
  }

  // ---------- Освещение по времени суток ----------
  R3.setTime = function (minutes, cx, cz, regionBiome, weather) {
    const h = (minutes / 60) % 24;
    // солнце: восход 5:30, закат 19:30 (день 14 ч, ночь 10 ч); наклон орбиты, чтобы тени не были строго по оси
    const ang = h >= 5.5 && h < 19.5 ? ((h - 5.5) / 14) * Math.PI : Math.PI + (((h - 19.5 + 24) % 24) / 10) * Math.PI;
    const sy = Math.sin(ang), sxz = Math.cos(ang);
    const el = Math.asin(Math.max(-1, Math.min(1, sy * 0.92))) * 57.2958; // высота солнца в градусах
    const s = sample(el);
    // день 0..1 для игровой логики (как раньше: 6:30–18:30 — день)
    let day;
    if (h >= 6.5 && h <= 18.5) day = 1;
    else if (h > 18.5 && h < 20.5) day = 1 - (h - 18.5) / 2;
    else if (h > 4.5 && h < 6.5) day = (h - 4.5) / 2;
    else day = 0;
    // биом и погода
    if (regionBiome === 'desert' || regionBiome === 'mesa') cH.lerp(C_DESERT, 0.25 * Math.max(0, day));
    let overcast = 0;
    if (regionBiome === 'moor') overcast = 0.35;
    if (weather === 'rain' || weather === 'snow') overcast = 0.75;
    if (weather === 'fog') overcast = 0.6;
    if (overcast) {
      const g = cT.copy(C_GREY).multiplyScalar(0.2 + 0.8 * Math.max(0.08, day));
      cZ.lerp(g, overcast);
      cH.lerp(g, overcast * 0.85);
      cHC.lerp(g, overcast * 0.6);
    }
    if (weather === 'sand') {
      cT.copy(C_SAND).multiplyScalar(0.25 + 0.75 * day);
      cZ.lerp(cT, 0.55);
      cH.lerp(cT, 0.8);
    }
    const sunK = 1 - overcast * 0.75 - (weather === 'sand' ? 0.5 : 0);
    // купол неба
    const u = R3.skyU;
    const skyK = 1.0;
    u.zenith.value.copy(cZ).multiplyScalar(skyK);
    u.horizon.value.copy(cH).multiplyScalar(skyK);
    u.groundC.value.copy(cH).lerp(C_GROUND, 0.5).multiplyScalar(0.6);
    u.sunDir.value.set(sxz * 0.9, sy * 0.92, 0.38).normalize();
    u.sunCol.value.copy(cS);
    u.sunVis.value = Math.max(0, 1 - overcast * 1.2);
    // облака: больше днём в пасмурную погоду; ночью тёмные
    u.cover.value = 0.56 - overcast * 0.32;
    u.cloudAmt.value = 0.85;
    const cl = Math.max(0, Math.min(1, (el + 8) / 22)) ** 2 * 0.95 + 0.012; // ночью облака почти не видны
    u.cloudLit.value.copy(C_CLOUD).multiplyScalar(0.015 + 1.05 * cl).lerp(cT.copy(cS).multiplyScalar(1.2), el < 12 && el > -4 ? 0.45 : 0);
    u.cloudDark.value.copy(C_CLOUD_D).multiplyScalar(0.01 + 0.75 * cl);
    u.cloudOff.value.set((J.G.t || 0) * 0.0016 + minutes * 0.00004, (J.G.t || 0) * 0.0007);
    R3.sky.position.copy(R3.camera.position);
    // туман = цвет горизонта после тональной кривой (туман смешивается уже в выходном пространстве)
    aces(cH, R3.scene.fog.color);
    u.fogOut.value.copy(R3.scene.fog.color);
    R3.scene.background.copy(R3.scene.fog.color);
    const baseFar = R3.preset.fog;
    const fogK = weather === 'fog' || weather === 'sand' ? 0.42 : weather === 'rain' || weather === 'snow' ? 0.75 : regionBiome === 'moor' ? 0.8 : 1;
    R3.scene.fog.far = baseFar * fogK;
    R3.scene.fog.near = R3.scene.fog.far * (fogK < 1 ? 0.15 : 0.3);
    // солнце / луна (направленный свет с тенью)
    const sun = R3.sun;
    const moonUp = el < 2;
    if (!moonUp) {
      vDir.copy(u.sunDir.value);
      sun.color.copy(cS);
      sun.intensity = s.si * sunK;
    } else {
      // луна: напротив солнца, холодный слабый свет
      vDir.set(-sxz * 0.8, Math.max(0.35, -sy * 0.9), -0.45).normalize();
      sun.color.copy(C_MOON);
      sun.intensity = 0.3 * Math.min(1, (2 - el) / 8) * (1 - overcast * 0.6);
    }
    // привязка тени к текселям карты — тени не «мерцают» при движении
    const ext = R3.sun.shadow.camera.right, tex = (2 * ext) / sun.shadow.mapSize.x;
    vRt.crossVectors(UPV, vDir).normalize();
    vUp.crossVectors(vDir, vRt);
    vTc.set(cx, 0, cz);
    const rr = vTc.dot(vRt), uu = vTc.dot(vUp);
    vTc.addScaledVector(vRt, Math.round(rr / tex) * tex - rr).addScaledVector(vUp, Math.round(uu / tex) * tex - uu);
    sun.target.position.copy(vTc);
    sun.position.copy(vTc).addScaledVector(vDir, 80);
    // небо (полусфера)
    R3.hemi.color.copy(cHC);
    R3.hemi.groundColor.copy(C_GROUND).multiplyScalar(0.35 + 0.65 * Math.min(1, s.hi * 2.2));
    R3.hemi.intensity = s.hi * (1 - overcast * 0.15);
    // звёзды и луна
    const night = 1 - day;
    R3.starMat.opacity = Math.max(0, 1 - day * 2.2) * (1 - overcast);
    R3.stars.position.copy(R3.camera.position);
    R3.moon.position.set(R3.camera.position.x - sxz * 220, R3.camera.position.y + Math.max(-40, -sy * 170 + 25), R3.camera.position.z - 110);
    R3.moon.visible = day < 0.6 && overcast < 0.5;
    // окна и фонари ночью (свечение сильнее 1 — тональная кривая сделает мягкий тёплый свет)
    const lit = Math.max(0, Math.min(1, (6 - el) / 10)); // включаются в сумерках
    R3.lightMat.color.setRGB(0.12 + 2.2 * lit, 0.13 + 1.75 * lit, 0.16 + 1.05 * lit);
    R3.bulbMat.color.setRGB(0.25 + 3.0 * lit, 0.25 + 2.6 * lit, 0.22 + 1.6 * lit);
    if (R3.cmat && R3.cmat.facade) {
      R3.cmat.facade.emissive.copy(C_WIN).multiplyScalar(1.05 * lit);
      R3.cmat.facade.userData.sky.value.copy(cH).lerp(cZ, 0.35).multiplyScalar(0.75 * (1 - overcast * 0.4));
    }
    if (R3.poolMat) {
      R3.poolMat.visible = R3.preset.pools && lit > 0.05;
      R3.poolMat.color.copy(C_POOL).multiplyScalar(0.55 * lit);
    }
    R3.lantern.intensity = night > 0.5 ? 0.45 * night : 0;
    // вода
    R3.water.position.x = Math.round(cx);
    R3.water.position.z = Math.round(cz);
    R3.waterMat.userData.sky.value.copy(cH).multiplyScalar(0.9);
    if (R3.waterMat.normalMap) R3.waterMat.normalMap.offset.set((J.G.t || 0) * 0.011, (J.G.t || 0) * 0.007);
    R3.dayLevel = day;
    return day;
  };
})();
