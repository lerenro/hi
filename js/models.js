'use strict';
// Реалистичные модели людей и стендов: скелет с коленями и локтями, лицо, причёски, одежда, броня стендов.
// Каждый сегмент тела — одна сборная геометрия с цветами вершин, поэтому на персонажа ~9 вызовов отрисовки.
(function () {
  const R3 = J.R3;
  const GB = J.GB;
  const col = (h) => new THREE.Color(h);
  const M4 = (x, y, z, sx = 1, sy = 1, sz = 1, rx = 0, ry = 0, rz = 0) => {
    const m = new THREE.Matrix4();
    m.compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)), new THREE.Vector3(sx, sy, sz));
    return m;
  };
  // Общие примитивы (без индексов — для быстрого копирования)
  const NI = (g) => (g.index ? g.toNonIndexed() : g);
  const PR = {
    sph: NI(new THREE.SphereGeometry(1, 14, 10)),
    sphLo: NI(new THREE.SphereGeometry(1, 9, 6)),
    cap: NI(new THREE.SphereGeometry(1, 16, 8, 0, Math.PI * 2, 0, Math.PI * 0.56)),
    box: NI(new THREE.BoxGeometry(1, 1, 1)),
    cone: NI(new THREE.ConeGeometry(1, 1, 8)),
    cone4: NI(new THREE.ConeGeometry(1, 1, 4)),
    torus: NI(new THREE.TorusGeometry(1, 0.38, 6, 12)),
    oct: NI(new THREE.OctahedronGeometry(1, 0)),
  };
  const tcache = {};
  const taper = (rt, rb) => {
    const k = rt.toFixed(3) + '/' + rb.toFixed(3);
    return tcache[k] || (tcache[k] = NI(new THREE.CylinderGeometry(rt, rb, 1, 12, 1)));
  };
  // эллипсоид
  const ell = (gb, c, x, y, z, rx, ry, rz, ax = 0, ay = 0, az = 0, lo) => gb.geo(lo ? PR.sphLo : PR.sph, M4(x, y, z, rx, ry, rz, ax, ay, az), c);
  // сужающийся цилиндр от y0 вниз на длину len
  const tube = (gb, c, x, y0, z, rt, rb, len, sz = 1, ax = 0, az = 0) => gb.geo(taper(rt, rb), M4(x, y0 - len / 2, z, 1, len, sz, ax, 0, az), c);
  const box = (gb, c, x, y, z, sx, sy, sz, ax = 0, ay = 0, az = 0) => gb.geo(PR.box, M4(x, y, z, sx, sy, sz, ax, ay, az), c);

  const BUILDS = {
    normal: { sh: 0.2, chest: 0.185, waist: 0.14, hip: 0.155, arm: 0.05, leg: 0.083 },
    slim: { sh: 0.185, chest: 0.165, waist: 0.125, hip: 0.145, arm: 0.044, leg: 0.075 },
    muscular: { sh: 0.25, chest: 0.235, waist: 0.155, hip: 0.165, arm: 0.068, leg: 0.1 },
  };

  // Каркас: возвращает части с точками сочленения
  function makeRig(spec) {
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
    const mat = spec.material;
    const g = new THREE.Group();
    const body = new THREE.Group();
    g.add(body);
    const mk = (gb) => {
      const m = new THREE.Mesh(gb.build(), mat);
      m.castShadow = true;
      return m;
    };
    // --- туловище и голова (одна сетка) ---
    const tb = new GB();
    spec.torso(tb, b, fem);
    spec.head(tb, b, fem);
    const torso = mk(tb);
    body.add(torso);
    // --- ноги ---
    const legs = ['L', 'R'].map((side) => {
      const sx = side === 'L' ? -1 : 1;
      const tg = new GB();
      spec.thigh(tg, b, sx);
      const thigh = mk(tg);
      thigh.position.set(sx * b.hip * 0.56, 0.94, 0);
      const sg = new GB();
      spec.shin(sg, b, sx);
      const shin = mk(sg);
      shin.position.set(0, -0.44, 0);
      thigh.add(shin);
      body.add(thigh);
      return { thigh, shin };
    });
    // --- руки ---
    const arms = ['L', 'R'].map((side) => {
      const sx = side === 'L' ? -1 : 1;
      const ug = new GB();
      spec.upper(ug, b, sx);
      const upper = mk(ug);
      upper.position.set(sx * (b.sh + 0.035), 1.425, 0);
      const fg = new GB();
      spec.fore(fg, b, sx);
      const fore = mk(fg);
      fore.position.set(0, -0.29, 0);
      upper.add(fore);
      body.add(upper);
      return { upper, fore };
    });
    if (spec.extra) spec.extra(arms[1].fore, body, b);
    return {
      group: g, body, torso,
      legL: legs[0].thigh, legR: legs[1].thigh, shinL: legs[0].shin, shinR: legs[1].shin,
      armL: arms[0].upper, armR: arms[1].upper, foreL: arms[0].fore, foreR: arms[1].fore,
      mats: [mat], baseColors: [new THREE.Color(1, 1, 1)],
    };
  }

  // ---------- Человек ----------
  function hair(gb, style, H, hc, accent) {
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
        const hatC = col('#1f2a44');
        capH();
        ell(gb, H, 0, top - 0.05, -0.085, 0.1, 0.09, 0.05);
        tube(gb, hatC, 0, top + 0.12, -0.01, 0.118, 0.124, 0.085);
        tube(gb, hatC, 0, top + 0.05, 0.035, 0.13, 0.13, 0.014, 1.35, 0.12);
        box(gb, col('#f2c230'), -0.04, top + 0.085, 0.115, 0.03, 0.03, 0.01);
        // цепочка Джотаро
        tube(gb, col('#c9a84a'), 0.06, top + 0.1, 0.0, 0.123, 0.123, 0.01);
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
    const mat = new THREE.MeshLambertMaterial({ vertexColors: true });
    const S = col(look.skin), SD = S.clone().multiplyScalar(0.86);
    const TOP = col(look.top), TOPD = TOP.clone().multiplyScalar(0.72);
    const BOT = col(look.bottom), BOTD = BOT.clone().multiplyScalar(0.8);
    const H = col(look.hairColor);
    const DARK = col('#1d1a22'), WHITE = col('#f4f4f4'), EYE = col(look.eye || '#2a2230'), GOLD = col('#f2c230'), LIP = SD.clone().lerp(col('#c0605a'), 0.35);
    const SHOE = col(look.shoe || '#2a2228');
    const v = makeRig({
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

  // ---------- Стенд ----------
  R3.buildStand = function (sd) {
    if (sd.head === 'plane' || sd.head === 'tiny' || sd.head === 'bug') return R3.buildStandSimple(sd);
    const C1 = col(sd.c1), C2 = col(sd.c2);
    const C1D = C1.clone().multiplyScalar(0.72), C2D = C2.clone().multiplyScalar(0.7);
    const GLOW = col('#ffffff');
    const mat = new THREE.MeshLambertMaterial({ vertexColors: true, transparent: true, opacity: 0.88, emissive: C1.clone().multiplyScalar(0.32) });
    const head = sd.head;
    const v = makeRig({
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
      },
      thigh(gb, b) {
        tube(gb, C1, 0, 0.02, 0, b.leg, b.leg * 0.7, 0.46);
      },
      shin(gb, b) {
        ell(gb, C2, 0, 0, 0.03, b.leg * 0.75, 0.06, b.leg * 0.6);
        tube(gb, C1, 0, 0, 0, b.leg * 0.68, b.leg * 0.4, 0.4);
        tube(gb, C2, 0, -0.3, 0, b.leg * 0.5, b.leg * 0.44, 0.08);
        gb.geo(PR.cone4, M4(0, -0.43, 0.06, 0.05, 0.16, 0.04, Math.PI / 2 + 0.3), C2);
      },
      upper(gb, b) {
        ell(gb, C1, 0, -0.03, 0, b.arm * 1.4, 0.08, b.arm * 1.35);
        tube(gb, C1, 0, 0, 0, b.arm, b.arm * 0.8, 0.3);
        if (head === 'vines') for (let k = 0; k < 3; k++) gb.geo(PR.torus, M4(0, -0.06 - k * 0.08, 0, b.arm * 1.1, b.arm * 1.1, b.arm * 1.1, Math.PI / 2), C2);
      },
      fore(gb, b, sx) {
        tube(gb, C1, 0, 0, 0, b.arm * 0.82, b.arm * 0.68, 0.22);
        tube(gb, C2, 0, -0.15, 0, b.arm * 0.82, b.arm * 0.82, 0.09);
        ell(gb, C2, 0, -0.29, 0.005, 0.045, 0.07, 0.035);
        if (head === 'vines') for (let k = 0; k < 3; k++) gb.geo(PR.torus, M4(0, -0.04 - k * 0.07, 0, b.arm * 0.95, b.arm * 0.95, b.arm * 0.95, Math.PI / 2), C2);
      },
      extra(foreR) {
        const gb = new GB();
        if (sd.extra === 'sword' || sd.extra === 'arrow') {
          box(gb, col('#e8eefc'), 0, -0.3, 0.5, 0.02, 0.035, 0.9);
          box(gb, C2, 0, -0.3, 0.06, 0.12, 0.03, 0.03);
        } else if (sd.extra === 'scythe') {
          tube(gb, C2D, 0, 0.4, 0.05, 0.015, 0.015, 1.3);
          box(gb, col('#e8eefc'), 0, 0.42, 0.3, 0.015, 0.08, 0.5);
        } else if (sd.extra === 'rod') {
          box(gb, C2, 0, -0.3, 0.7, 0.015, 0.015, 1.4);
        } else return;
        const m = new THREE.Mesh(gb.build(), mat);
        foreR.add(m);
      },
    });
    v.kind = 'human';
    return v;
  };
})();
