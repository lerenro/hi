'use strict';
// Реалистичные модели людей и стендов: скелет с коленями и локтями, лицо, причёски, одежда, броня стендов.
// Каждый сегмент тела — одна сборная геометрия с цветами вершин, поэтому на персонажа ~9 вызовов отрисовки.
(function () {
  const R3 = J.R3;
  const GB = J.GB;
  const col = (h) => new THREE.Color(h);
  // матрица детали (общие временные объекты: GB.geo сразу копирует вершины)
  const _m = new THREE.Matrix4(), _p = new THREE.Vector3(), _q = new THREE.Quaternion(), _s = new THREE.Vector3(), _e = new THREE.Euler();
  const M4 = (x, y, z, sx = 1, sy = 1, sz = 1, rx = 0, ry = 0, rz = 0) => _m.compose(_p.set(x, y, z), _q.setFromEuler(_e.set(rx, ry, rz)), _s.set(sx, sy, sz));
  // Общие примитивы (без индексов — для быстрого копирования)
  const NI = (g) => (g.index ? g.toNonIndexed() : g);
  const PR = {
    sph: NI(new THREE.SphereGeometry(1, 12, 8)),
    sphMid: NI(new THREE.SphereGeometry(1, 8, 6)),
    sphLo: NI(new THREE.SphereGeometry(1, 6, 4)),
    cap: NI(new THREE.SphereGeometry(1, 14, 7, 0, Math.PI * 2, 0, Math.PI * 0.56)),
    box: NI(new THREE.BoxGeometry(1, 1, 1)),
    cone: NI(new THREE.ConeGeometry(1, 1, 8)),
    cone4: NI(new THREE.ConeGeometry(1, 1, 4)),
    torus: NI(new THREE.TorusGeometry(1, 0.38, 6, 12)),
    oct: NI(new THREE.OctahedronGeometry(1, 0)),
  };
  const tcache = {};
  const taper = (rt, rb) => {
    const k = rt.toFixed(3) + '/' + rb.toFixed(3);
    return tcache[k] || (tcache[k] = NI(new THREE.CylinderGeometry(rt, rb, 1, 8, 1)));
  };
  // эллипсоид
  // мелкие детали — грубее (меньше треугольников и быстрее сборка), крупные — гладкие
  const ell = (gb, c, x, y, z, rx, ry, rz, ax = 0, ay = 0, az = 0, lo) => {
    const r = Math.max(rx, ry, rz);
    gb.geo(lo || r < 0.03 ? PR.sphLo : r < 0.08 ? PR.sphMid : PR.sph, M4(x, y, z, rx, ry, rz, ax, ay, az), c);
  };
  // сужающийся цилиндр от y0 вниз на длину len
  const tube = (gb, c, x, y0, z, rt, rb, len, sz = 1, ax = 0, az = 0) => gb.geo(taper(rt, rb), M4(x, y0 - len / 2, z, 1, len, sz, ax, 0, az), c);
  const box = (gb, c, x, y, z, sx, sy, sz, ax = 0, ay = 0, az = 0) => gb.geo(PR.box, M4(x, y, z, sx, sy, sz, ax, ay, az), c);

  const BUILDS = {
    normal: { sh: 0.2, chest: 0.185, waist: 0.14, hip: 0.155, arm: 0.05, leg: 0.083 },
    slim: { sh: 0.185, chest: 0.165, waist: 0.125, hip: 0.145, arm: 0.044, leg: 0.075 },
    muscular: { sh: 0.25, chest: 0.235, waist: 0.155, hip: 0.165, arm: 0.068, leg: 0.1 },
  };

  // Геометрии каркасов кэшируются по форме (пол, телосложение, причёска...) — новый персонаж почти бесплатен.
  // Общие геометрии НЕЛЬЗЯ освобождать (dispose) при удалении вида — ими пользуются другие персонажи.
  const geoCache = new Map();
  const SPINE_Y = 0.98, NECK_Y = 1.575;
  function rigGeos(spec) {
    const hit = spec.cacheKey && geoCache.get(spec.cacheKey);
    if (hit) return hit;
    const fem = spec.gender === 'f';
    const b = Object.assign({}, BUILDS[spec.build || 'normal']);
    if (fem) {
      b.sh *= 0.86;
      b.chest *= 0.88;
      b.waist *= 0.86;
      b.hip *= 1.08;
      b.arm *= 0.84;
      b.leg *= 0.95;
    }
    // геометрии каркаса общие для всех персонажей этой формы — помечаем, чтобы их никогда не освобождали
    const one = (fn) => {
      const gb = new GB();
      fn(gb);
      const g = gb.build();
      g.userData.shared = !!spec.cacheKey;
      return g;
    };
    // торс и голова — отдельные геометрии с центрами в суставах (таз 0.98 и шея 1.575)
    const G = {
      b,
      torso: one((gb) => spec.torso(gb, b, fem)).translate(0, -SPINE_Y, 0),
      head: one((gb) => spec.head(gb, b, fem)).translate(0, -NECK_Y, 0),
      thigh: [-1, 1].map((sx) => one((gb) => spec.thigh(gb, b, sx))),
      shin: [-1, 1].map((sx) => one((gb) => spec.shin(gb, b, sx))),
      upper: [-1, 1].map((sx) => one((gb) => spec.upper(gb, b, sx))),
      fore: [-1, 1].map((sx) => one((gb) => spec.fore(gb, b, sx))),
      extra: null,
    };
    if (spec.extra) {
      const gb = new GB();
      spec.extra(gb);
      if (!gb.empty) {
        G.extra = gb.build();
        G.extra.userData.shared = !!spec.cacheKey;
      }
    }
    if (spec.cacheKey) geoCache.set(spec.cacheKey, G);
    return G;
  }
  R3.rigCacheSize = () => geoCache.size;

  // Каркас: возвращает части с точками сочленения
  function makeRig(spec) {
    const G = rigGeos(spec);
    const b = G.b;
    const mat = spec.material;
    const g = new THREE.Group();
    const body = new THREE.Group();
    g.add(body);
    const mk = (geo) => {
      const m = new THREE.Mesh(geo, mat);
      m.castShadow = true;
      return m;
    };
    // позвоночник: торс, голова и руки поворачиваются отдельно от ног
    const spine = new THREE.Group();
    spine.position.y = SPINE_Y;
    body.add(spine);
    const torso = mk(G.torso);
    spine.add(torso);
    const head = mk(G.head);
    head.position.y = NECK_Y - SPINE_Y;
    spine.add(head);
    const legs = [0, 1].map((i) => {
      const thigh = mk(G.thigh[i]);
      thigh.position.set((i ? 1 : -1) * b.hip * 0.56, 0.94, 0);
      const shin = mk(G.shin[i]);
      shin.position.set(0, -0.44, 0);
      thigh.add(shin);
      body.add(thigh);
      return { thigh, shin };
    });
    const arms = [0, 1].map((i) => {
      const upper = mk(G.upper[i]);
      upper.position.set((i ? 1 : -1) * (b.sh + 0.035), 1.425 - SPINE_Y, 0);
      const fore = mk(G.fore[i]);
      fore.position.set(0, -0.29, 0);
      upper.add(fore);
      spine.add(upper);
      return { upper, fore };
    });
    if (G.extra) arms[1].fore.add(mk(G.extra));
    return {
      group: g, body, torso, spine, head,
      legL: legs[0].thigh, legR: legs[1].thigh, shinL: legs[0].shin, shinR: legs[1].shin,
      armL: arms[0].upper, armR: arms[1].upper, foreL: arms[0].fore, foreR: arms[1].fore,
      mats: [mat], baseColors: [new THREE.Color(1, 1, 1)],
    };
  }

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

  // Материал с палитрой: цвет вершины хранит номер слота (r), шейдер берёт цвет из uniform-массива
  const SLOT = (i) => ({ r: i, g: 0, b: 0 });
  R3.paletteMaterial = function (colors, opts) {
    const m = new THREE.MeshLambertMaterial(Object.assign({ vertexColors: true }, opts || {}));
    const pal = colors.map((c) => (c && c.isColor ? c.clone() : new THREE.Color(c)));
    while (pal.length < 16) pal.push(new THREE.Color(1, 0, 1));
    m.userData.palette = { value: pal };
    m.userData.fxU = { value: 0 };
    m.onBeforeCompile = (sh) => {
      sh.uniforms.palette = m.userData.palette;
      sh.vertexShader = sh.vertexShader
        .replace('#include <common>', '#include <common>\nuniform vec3 palette[16];')
        .replace('#include <color_vertex>', 'vColor = palette[int(color.r + 0.5)];');
      R3.fxPatchShader(sh, m.userData.fxU);
    };
    m.customProgramCacheKey = () => 'jj-palette-fx';
    return m;
  };

  // ---------- Человек ----------
  function hair(gb, style, H) {
    const top = 1.695;
    const capH = () => gb.geo(PR.cap, M4(0, top + 0.004, -0.008, 0.112, 0.132, 0.124, -0.42), H);
    switch (style) {
      case 'bald':
        break;
      case 'pompadour':
        capH();
        ell(gb, H, 0, top + 0.1, 0.06, 0.085, 0.07, 0.13, -0.25);
        ell(gb, H, 0, top + 0.13, 0.15, 0.07, 0.055, 0.09, -0.5);
        ell(gb, H, 0, top - 0.03, -0.085, 0.1, 0.09, 0.05);
        ell(gb, H, -0.1, top - 0.02, -0.01, 0.022, 0.06, 0.06);
        ell(gb, H, 0.1, top - 0.02, -0.01, 0.022, 0.06, 0.06);
        break;
      case 'cap': {
        const hatC = SLOT(13);
        capH();
        ell(gb, H, 0, top - 0.05, -0.085, 0.1, 0.09, 0.05);
        tube(gb, hatC, 0, top + 0.12, -0.01, 0.118, 0.124, 0.085);
        tube(gb, hatC, 0, top + 0.05, 0.035, 0.13, 0.13, 0.014, 1.35, 0.12);
        box(gb, SLOT(10), -0.04, top + 0.085, 0.115, 0.03, 0.03, 0.01);
        // цепочка Джотаро
        tube(gb, SLOT(14), 0.06, top + 0.1, 0.0, 0.123, 0.123, 0.01);
        break;
      }
      case 'curls':
        capH();
        for (let k = -1; k <= 1; k++) gb.geo(PR.torus, M4(k * 0.04, top + 0.06, 0.118, 0.018, 0.018, 0.018, 0, 0, 0), H);
        // коса сзади
        for (let k = 0; k < 4; k++) ell(gb, H, 0, top - 0.06 - k * 0.07, -0.12 - k * 0.012, 0.028, 0.04, 0.028, 0, 0, 0, true);
        ell(gb, H, -0.1, top - 0.03, 0.0, 0.02, 0.06, 0.05);
        ell(gb, H, 0.1, top - 0.03, 0.0, 0.02, 0.06, 0.05);
        break;
      case 'long':
        capH();
        ell(gb, H, 0, top - 0.13, -0.075, 0.11, 0.22, 0.05);
        ell(gb, H, -0.098, top - 0.08, 0.01, 0.025, 0.14, 0.05);
        ell(gb, H, 0.098, top - 0.08, 0.01, 0.025, 0.14, 0.05);
        break;
      case 'spiky':
        capH();
        for (let k = 0; k < 9; k++) {
          const a = (k / 9) * Math.PI * 2;
          gb.geo(PR.cone4, M4(Math.cos(a) * 0.06, top + 0.11, Math.sin(a) * 0.06 - 0.02, 0.035, 0.12, 0.035, Math.sin(a) * 0.7, 0, -Math.cos(a) * 0.7), H);
        }
        break;
      case 'buns':
        capH();
        ell(gb, H, -0.07, top + 0.12, -0.02, 0.052, 0.05, 0.052);
        ell(gb, H, 0.07, top + 0.12, -0.02, 0.052, 0.05, 0.052);
        ell(gb, H, 0, top - 0.06, -0.09, 0.09, 0.08, 0.045);
        break;
      default:
        capH();
        ell(gb, H, 0, top - 0.05, -0.085, 0.1, 0.09, 0.05);
        box(gb, H, 0, top + 0.075, 0.105, 0.16, 0.03, 0.03, -0.3);
    }
  }

  R3.buildHuman = function (look, scale = 1) {
    const skin = col(look.skin), top = col(look.top), bot = col(look.bottom);
    const skinD = skin.clone().multiplyScalar(0.86);
    // палитра: 0 кожа, 1 кожа-тень, 2 верх, 3 верх-тёмный, 4 низ, 5 низ-тёмный, 6 волосы, 7 белки, 8 глаза,
    // 9 тёмный, 10 золото, 11 губы, 12 обувь, 13 шапка, 14 цепочка
    const mat = R3.paletteMaterial([
      skin, skinD, top, top.clone().multiplyScalar(0.72), bot, bot.clone().multiplyScalar(0.8), col(look.hairColor), '#f4f4f4', look.eye || '#2a2230',
      '#1d1a22', '#f2c230', skinD.clone().lerp(col('#c0605a'), 0.35), look.shoe || '#2a2228', '#1f2a44', '#c9a84a',
    ]);
    const S = SLOT(0), SD = SLOT(1), TOP = SLOT(2), TOPD = SLOT(3), BOT = SLOT(4), BOTD = SLOT(5), H = SLOT(6);
    const WHITE = SLOT(7), EYE = SLOT(8), DARK = SLOT(9), GOLD = SLOT(10), LIP = SLOT(11), SHOE = SLOT(12);
    const v = makeRig({
      cacheKey: ['h', look.gender, look.build || 'normal', look.hair, look.coat ? 1 : 0].join('|'),
      gender: look.gender,
      build: look.build,
      material: mat,
      torso(gb, b, fem) {
        // таз и пояс
        ell(gb, BOT, 0, 0.98, 0, b.hip, 0.115, b.hip * 0.72);
        tube(gb, DARK, 0, 1.085, 0, b.waist + 0.012, b.waist + 0.014, 0.05, 0.74);
        box(gb, GOLD, 0, 1.06, b.waist * 0.74 + 0.012, 0.045, 0.032, 0.012);
        // корпус
        tube(gb, TOP, 0, 1.33, 0, b.chest * 0.96, b.waist, 0.27, 0.68);
        ell(gb, TOP, 0, 1.31, 0.008, b.chest, 0.15, b.chest * 0.68);
        ell(gb, TOP, 0, 1.415, -0.005, b.sh * 0.93, 0.07, b.chest * 0.6);
        if (fem) {
          ell(gb, TOP, -0.072, 1.3, b.chest * 0.5, 0.07, 0.065, 0.06);
          ell(gb, TOP, 0.072, 1.3, b.chest * 0.5, 0.07, 0.065, 0.06);
        }
        // пуговицы и воротник
        for (let k = 0; k < 3; k++) ell(gb, GOLD, 0, 1.36 - k * 0.09, b.chest * 0.68 + 0.004, 0.011, 0.011, 0.006, 0, 0, 0, true);
        tube(gb, TOPD, 0, 1.51, 0, 0.066, 0.08, 0.065);
        if (look.coat) tube(gb, TOP, 0, 1.08, -0.005, b.waist + 0.035, b.hip + 0.12, 0.58, 0.74);
        // шея
        tube(gb, S, 0, 1.575, 0, 0.047, 0.052, 0.1);
      },
      head(gb) {
        const y = 1.695;
        ell(gb, S, 0, y, 0, 0.1, 0.122, 0.112);
        ell(gb, S, 0, y - 0.065, 0.02, 0.078, 0.064, 0.086);
        ell(gb, S, -0.1, y - 0.02, -0.005, 0.016, 0.03, 0.022, 0, 0, 0, true);
        ell(gb, S, 0.1, y - 0.02, -0.005, 0.016, 0.03, 0.022, 0, 0, 0, true);
        ell(gb, SD, 0, y - 0.03, 0.111, 0.015, 0.028, 0.02, -0.25, 0, 0, true);
        ell(gb, WHITE, -0.037, y + 0.005, 0.094, 0.02, 0.013, 0.01, 0, 0, 0, true);
        ell(gb, WHITE, 0.037, y + 0.005, 0.094, 0.02, 0.013, 0.01, 0, 0, 0, true);
        ell(gb, EYE, -0.037, y + 0.005, 0.102, 0.0105, 0.0115, 0.005, 0, 0, 0, true);
        ell(gb, EYE, 0.037, y + 0.005, 0.102, 0.0105, 0.0115, 0.005, 0, 0, 0, true);
        box(gb, H, -0.04, y + 0.032, 0.103, 0.046, 0.011, 0.012, 0, 0, 0.1);
        box(gb, H, 0.04, y + 0.032, 0.103, 0.046, 0.011, 0.012, 0, 0, -0.1);
        box(gb, LIP, 0, y - 0.075, 0.1, 0.036, 0.008, 0.008);
        hair(gb, look.hair, H);
      },
      thigh(gb, b) {
        tube(gb, BOT, 0, 0.02, 0, b.leg, b.leg * 0.72, 0.46);
      },
      shin(gb, b) {
        ell(gb, BOT, 0, 0, 0, b.leg * 0.72, 0.05, b.leg * 0.74, 0, 0, 0, true);
        tube(gb, BOT, 0, 0, 0, b.leg * 0.7, b.leg * 0.52, 0.4);
        tube(gb, BOTD, 0, -0.36, 0, b.leg * 0.55, b.leg * 0.56, 0.04);
        ell(gb, SHOE, 0, -0.43, 0.04, 0.052, 0.046, 0.125);
        box(gb, DARK, 0, -0.468, 0.04, 0.1, 0.02, 0.245);
      },
      upper(gb, b, sx) {
        ell(gb, TOP, 0, -0.01, 0, b.arm * 1.35, 0.07, b.arm * 1.3);
        tube(gb, TOP, 0, 0, 0, b.arm, b.arm * 0.84, 0.3);
      },
      fore(gb, b, sx) {
        ell(gb, TOP, 0, 0, 0, b.arm * 0.86, 0.04, b.arm * 0.86, 0, 0, 0, true);
        tube(gb, TOP, 0, 0, 0, b.arm * 0.84, b.arm * 0.7, 0.24);
        tube(gb, TOPD, 0, -0.21, 0, b.arm * 0.74, b.arm * 0.74, 0.035);
        ell(gb, S, 0, -0.3, 0.004, 0.034, 0.062, 0.025);
        ell(gb, S, -sx * 0.018, -0.27, 0.026, 0.012, 0.03, 0.013, 0.3, 0, 0, true);
      },
    });
    v.group.scale.setScalar(scale * (look.gender === 'f' ? 0.95 : 1));
    v.kind = 'human';
    return v;
  };

  // Заранее собрать каркасы всех вариантов прохожих (пол × телосложение × причёска, как в J.rndLook) —
  // тогда появление нового прохожего стоит доли миллисекунды, а не 3–15 мс сборки геометрии
  R3.prebuildRigs = function () {
    const H = { m: ['short', 'spiky', 'bald', 'pompadour', 'cap', 'curls'], f: ['long', 'buns', 'short'] };
    for (const g of ['m', 'f'])
      for (const build of ['normal', 'slim', 'muscular'])
        for (const hair of H[g]) {
          const v = R3.buildHuman({ gender: g, build, hair, skin: '#eac09f', hairColor: '#222', top: '#333', bottom: '#333' });
          v.mats.forEach((m) => m.dispose());
        }
  };

  // ---------- Стенд ----------
  R3.buildStand = function (sd) {
    if (sd.head === 'plane' || sd.head === 'tiny' || sd.head === 'bug') return R3.buildStandSimple(sd);
    const C1 = col(sd.c1), C2 = col(sd.c2);
    const C1D = C1.clone().multiplyScalar(0.72), C2D = C2.clone().multiplyScalar(0.7);
    const GLOW = col('#ffffff');
    // блестящая «живая» поверхность: блики по мускулам вместо плоской пластмассы
    const mat = new THREE.MeshPhongMaterial({ vertexColors: true, transparent: true, opacity: 0.9, emissive: C1.clone().multiplyScalar(0.2), specular: col('#6a6a78'), shininess: 34 });
    // контурный свет цвета стенда и светящиеся глаза (powers.js), затем обесцвечивание
    if (R3.standPatch) R3.standPatch(mat, sd.c1, sd.c2);
    R3.fxPatch(mat);
    const head = sd.head;
    const id = sd.id;
    const DK = col('#1a1424'), WH = col('#f4f0e8'), GOLD = col('#e8b830');
    // сердечко лицом вперёд (+z)
    const heart = (gb, c, x, y, z, s) => {
      ell(gb, c, x - s * 0.45, y + s * 0.2, z, s * 0.55, s * 0.5, s * 0.3);
      ell(gb, c, x + s * 0.45, y + s * 0.2, z, s * 0.55, s * 0.5, s * 0.3);
      gb.geo(PR.cone4, M4(x, y - s * 0.4, z, s * 0.75, s * 0.9, s * 0.3, Math.PI), c);
    };
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
    // Узнаваемые детали стендов (в общей кэшированной геометрии — ничего не стоят в кадре)
    const deco = {
      torso(gb, b) {
        // воротник-кольцо и тёмные стыки — у всех
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
            for (let k = 0; k < 6; k++) box(gb, DK, (k % 2 ? 0.05 : -0.05), 1.45 - k * 0.06, b.chest * 0.64, 0.05, 0.012, 0.012);
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
    const v = makeRig({
      cacheKey: 'stand|' + sd.id,
      gender: 'm',
      build: 'muscular',
      material: mat,
      torso(gb, b) {
        ell(gb, C1D, 0, 0.98, 0, b.hip, 0.12, b.hip * 0.72);
        tube(gb, C2, 0, 1.09, 0, b.waist + 0.015, b.waist + 0.018, 0.06, 0.76);
        // пресс и грудь
        tube(gb, C1, 0, 1.33, 0, b.chest * 0.92, b.waist, 0.28, 0.66);
        ell(gb, C1, -0.085, 1.33, b.chest * 0.42, 0.11, 0.09, 0.08);
        ell(gb, C1, 0.085, 1.33, b.chest * 0.42, 0.11, 0.09, 0.08);
        for (let k = 0; k < 3; k++) {
          ell(gb, C1D, -0.04, 1.2 - k * 0.055, b.waist * 0.66, 0.035, 0.025, 0.02, 0, 0, 0, true);
          ell(gb, C1D, 0.04, 1.2 - k * 0.055, b.waist * 0.66, 0.035, 0.025, 0.02, 0, 0, 0, true);
        }
        ell(gb, C1, 0, 1.42, -0.01, b.sh * 0.95, 0.08, b.chest * 0.62);
        // наплечники
        ell(gb, C2, -b.sh - 0.02, 1.45, 0, 0.09, 0.06, 0.09);
        ell(gb, C2, b.sh + 0.02, 1.45, 0, 0.09, 0.06, 0.09);
        // эмблема
        if (head === 'ladybug') ell(gb, C2, 0, 1.32, b.chest * 0.68, 0.035, 0.035, 0.015);
        else gb.geo(PR.oct, M4(0, 1.36, b.chest * 0.62, 0.035, 0.05, 0.02), C2);
        tube(gb, C1, 0, 1.585, 0, 0.06, 0.07, 0.11);
        if (head === 'cloak') tube(gb, C2D, 0, 1.5, -0.03, 0.2, 0.42, 1.1, 0.8);
        if (head === 'eyes') for (let k = 0; k < 6; k++) ell(gb, GLOW, Math.cos(k * 1.3) * 0.12, 1.15 + (k % 3) * 0.09, b.chest * 0.6, 0.022, 0.022, 0.012, 0, 0, 0, true);
        deco.torso(gb, b);
      },
      head(gb) {
        const y = 1.71;
        if (head === 'egg') ell(gb, C2, 0, y + 0.03, -0.02, 0.12, 0.16, 0.13);
        else if (head !== 'cloud') ell(gb, C1, 0, y, 0, 0.105, 0.125, 0.115);
        ell(gb, C1, 0, y - 0.065, 0.02, 0.08, 0.064, 0.088);
        // маска лица
        if (head !== 'cloud') ell(gb, C2D, 0, y - 0.01, 0.06, 0.085, 0.09, 0.06);
        ell(gb, GLOW, -0.038, y + 0.008, 0.106, 0.022, 0.012, 0.008, 0, 0, 0.15, true);
        ell(gb, GLOW, 0.038, y + 0.008, 0.106, 0.022, 0.012, 0.008, 0, 0, -0.15, true);
        box(gb, C1D, 0, y - 0.07, 0.104, 0.04, 0.008, 0.008);
        switch (head) {
          case 'mane':
            gb.geo(PR.cap, M4(0, y + 0.01, -0.01, 0.115, 0.135, 0.125, -0.42), C2);
            for (let k = 0; k < 6; k++) gb.geo(PR.cone4, M4(-0.09 + k * 0.036, y + 0.02, -0.12, 0.03, 0.22, 0.03, -1.1 - (k % 2) * 0.2), C2);
            break;
          case 'helmet':
            gb.geo(PR.cap, M4(0, y + 0.012, -0.004, 0.116, 0.136, 0.126, -0.3), C2);
            box(gb, C2, 0, y + 0.13, -0.01, 0.02, 0.08, 0.2);
            break;
          case 'bird':
            gb.geo(PR.cone4, M4(0, y - 0.02, 0.16, 0.035, 0.12, 0.03, Math.PI / 2), C2);
            box(gb, C2, 0, y + 0.15, -0.03, 0.02, 0.12, 0.18, -0.3);
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
            break;
          case 'ladybug':
            gb.geo(PR.cap, M4(0, y + 0.01, -0.01, 0.112, 0.13, 0.122, -0.4), C1D);
            for (let k = 0; k < 3; k++) ell(gb, C2, -0.05 + k * 0.05, y + 0.11, 0.05, 0.022, 0.022, 0.015, 0, 0, 0, true);
            break;
          case 'twin':
            ell(gb, C2, 0.05, y + 0.01, 0, 0.065, 0.128, 0.117);
            break;
          case 'hat':
            tube(gb, C2, 0, y + 0.08, 0, 0.18, 0.18, 0.014);
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
          case 'skull':
          case 'mask':
            ell(gb, C2, 0, y - 0.005, 0.085, 0.08, 0.085, 0.04);
            break;
          case 'cloud':
            for (let k = 0; k < 7; k++) ell(gb, C1, Math.cos(k * 0.9) * 0.1, y + Math.sin(k * 1.7) * 0.06, Math.sin(k * 0.9) * 0.06, 0.09, 0.08, 0.09, 0, 0, 0, true);
            break;
          default:
        }
        deco.head(gb, y);
      },
      thigh(gb, b) {
        tube(gb, C1, 0, 0.02, 0, b.leg, b.leg * 0.7, 0.46);
      },
      shin(gb, b) {
        ell(gb, C2, 0, 0, 0.03, b.leg * 0.75, 0.06, b.leg * 0.6);
        tube(gb, C1, 0, 0, 0, b.leg * 0.68, b.leg * 0.4, 0.4);
        tube(gb, C2, 0, -0.3, 0, b.leg * 0.5, b.leg * 0.44, 0.08);
        gb.geo(PR.cone4, M4(0, -0.43, 0.06, 0.05, 0.16, 0.04, Math.PI / 2 + 0.3), C2);
        deco.shin(gb, b);
      },
      upper(gb, b, sx) {
        ell(gb, C1, 0, -0.03, 0, b.arm * 1.4, 0.08, b.arm * 1.35);
        tube(gb, C1, 0, 0, 0, b.arm, b.arm * 0.8, 0.3);
        if (head === 'vines') for (let k = 0; k < 3; k++) gb.geo(PR.torus, M4(0, -0.06 - k * 0.08, 0, b.arm * 1.1, b.arm * 1.1, b.arm * 1.1, Math.PI / 2), C2);
        deco.upper(gb, b, sx);
      },
      fore(gb, b, sx) {
        tube(gb, C1, 0, 0, 0, b.arm * 0.82, b.arm * 0.68, 0.22);
        tube(gb, C2, 0, -0.15, 0, b.arm * 0.82, b.arm * 0.82, 0.09);
        ell(gb, C2, 0, -0.29, 0.005, 0.045, 0.07, 0.035);
        if (head === 'vines') for (let k = 0; k < 3; k++) gb.geo(PR.torus, M4(0, -0.04 - k * 0.07, 0, b.arm * 0.95, b.arm * 0.95, b.arm * 0.95, Math.PI / 2), C2);
        deco.fore(gb, b, sx);
      },
      extra(gb) {
        if (sd.extra === 'sword' || sd.extra === 'arrow') {
          box(gb, col('#e8eefc'), 0, -0.3, 0.5, 0.02, 0.035, 0.9);
          box(gb, C2, 0, -0.3, 0.06, 0.12, 0.03, 0.03);
        } else if (sd.extra === 'scythe') {
          tube(gb, C2D, 0, 0.4, 0.05, 0.015, 0.015, 1.3);
          box(gb, col('#e8eefc'), 0, 0.42, 0.3, 0.015, 0.08, 0.5);
        } else if (sd.extra === 'rod') {
          box(gb, C2, 0, -0.3, 0.7, 0.015, 0.015, 1.4);
        }
      },
    });
    v.kind = 'human';
    return v;
  };
})();
