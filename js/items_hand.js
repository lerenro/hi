'use strict';
// Вещи в руках: панель быстрого доступа (клавиши 4–9, колёсико), предмет виден в руке персонажа и меняет хват,
// удары оружием (колющие, режущие, дробящие, вес, прочность), револьвер с барабаном и перезарядкой,
// бросок с прицелом и настоящей физикой (дуга, вращение, нож втыкается, бутылка разбивается), подбор и выброс,
// передача метательного стенду (веер ножей, щелчок Звёздной Платины, пули Секс Пистолз, ножи в остановленном времени),
// оружие у врагов, реакция полиции, вещи, лежащие на улицах городов.
(function () {
  const H = (J.Hand = {});
  const G = () => J.G;
  const R3 = J.R3;
  const rnd = Math.random;
  const TAU = Math.PI * 2;
  const SLOTS = 6;
  const KEYS = ['4', '5', '6', '7', '8', '9'];
  H.SLOTS = SLOTS;
  H.KEYS = KEYS;
  const GRAV = 9.8;
  const gy = (x, y) => G().world.groundY(x, y);
  const fxOk = () => J.Fx && J.Fx.ready;
  const pwOk = () => J.Pw && J.Pw.ready;
  const nearP = (x, y, r) => {
    const p = G().player;
    return !!p && J.dist(x, y, p.x, p.y) < (r || 30);
  };
  const approach = (cur, want, step) => (cur < want ? Math.min(want, cur + step) : Math.max(want, cur - step));
  const lerp = J.lerp;

  // ---------- Описания ----------
  const FOOD_MODEL = { coffee: 'cup', tea: 'cup', water: 'pbottle', wine: 'wine', cola: 'gbottle', energy_drink: 'can', blood_pack: 'bloodbag', medkit: 'medkit', bandage: 'bandage', onigiri: 'onigiri', sandwich: 'sandwich', pizza: 'pizza', burger: 'burger', coffee_gum: 'gum', trussardi_meal: 'bowl' };
  const DRINKS = { coffee: 1, tea: 1, water: 1, wine: 1, cola: 1, energy_drink: 1, blood_pack: 1 };
  const DEF_CACHE = {};
  // «рука» предмета: оружие — из data_items, еда и лекарства — общий хват
  H.def = function (id) {
    const it = J.ITEMS[id];
    if (!it) return null;
    if (it.hand) return it.hand;
    if (it.type === 'food' || it.type === 'heal' || it.type === 'blood') {
      return DEF_CACHE[id] || (DEF_CACHE[id] = { cls: 'food', model: FOOD_MODEL[id] || (it.type === 'heal' ? 'medkit' : 'bowl'), drink: !!DRINKS[id], dmg: 3, reach: 1, arc: 1, w: 0.3, dur: 999, thr: { dmg: 4, spin: 8 } });
    }
    return null;
  };
  const WEAPON = { blade: 1, blunt: 1, throw: 1, gun: 1 };
  H.isWeapon = (id) => !!(H.def(id) && WEAPON[H.def(id).cls]);
  H.handable = (id) => !!H.def(id) && H.def(id).cls !== 'ammo';
  // хват: как держит предмет
  const gripOf = (d) => {
    if (!d) return null;
    if (d.cls === 'gun') return 'gun';
    if (d.cls === 'food') return 'food';
    if (d.model === 'sign') return 'sign';
    if (d.two) return 'two';
    if (d.cls === 'blade' || d.model === 'tknife' || d.model === 'tknife3') return 'knife';
    if (d.model === 'bottle') return 'club1';
    return 'small';
  };
  H.gripOf = gripOf;

  // ---------- Состояние игрока ----------
  H.ensure = function (p) {
    if (!p) return p;
    if (!Array.isArray(p.hotbar) || p.hotbar.length !== SLOTS) p.hotbar = (Array.isArray(p.hotbar) ? p.hotbar : []).concat(Array(SLOTS).fill(null)).slice(0, SLOTS);
    if (typeof p.hsel !== 'number' || p.hsel >= SLOTS) p.hsel = -1;
    if (!p.dur || typeof p.dur !== 'object') p.dur = {};
    if (!p.mag || typeof p.mag !== 'object') p.mag = {};
    return p;
  };
  const cnt = (p, id) => (p.inv && p.inv[id]) || 0;
  // id предмета в руке (игрок — выбранная ячейка, ИИ — e.hand)
  H.heldId = function (e) {
    if (!e) return null;
    if (e.isPlayer) {
      if (!e.hotbar || !(e.hsel >= 0)) return null;
      const id = e.hotbar[e.hsel];
      return id && cnt(e, id) > 0 ? id : null;
    }
    return e.hand || null;
  };
  H.held = (e) => {
    const id = H.heldId(e);
    return id ? H.def(id) : null;
  };
  const durMax = (id) => (H.def(id) && H.def(id).dur) || 999;
  H.durOf = (e, id) => (e.isPlayer ? (e.dur && e.dur[id] !== undefined ? e.dur[id] : durMax(id)) : e.hdur !== undefined ? e.hdur : durMax(id));
  H.magOf = (e, id) => {
    const d = H.def(id);
    if (!d || d.cls !== 'gun') return 0;
    if (e.isPlayer) {
      H.ensure(e);
      if (e.mag[id] === undefined) e.mag[id] = d.mag;
      return e.mag[id];
    }
    if (e.mag === undefined) e.mag = d.mag;
    return e.mag;
  };
  const setMag = (e, id, n) => {
    if (e.isPlayer) e.mag[id] = n;
    else e.mag = n;
  };

  // тосты без повторов
  const SAID = {};
  const say = (key, text, type, cd) => {
    const t = performance.now();
    if (SAID[key] && t - SAID[key] < (cd || 2500)) return;
    SAID[key] = t;
    J.UI.toast(text, type || 'muted');
  };

  // ---------- Выбор ячейки ----------
  // выбрать ячейку (i = -1 — пустая рука) без переключения
  const setSel = (p, i) => {
    if (p.eat) p.eat = null;
    p.thrAim = null;
    p.reloadT = 0;
    p.hsel = i;
    const id = H.heldId(p);
    if (id && J.Sfx && J.Sfx.whoosh) J.Sfx.whoosh(0.1, false, 0.05);
    H.dirty = true;
  };
  // клавиша ячейки: повторное нажатие — убрать в карман
  H.select = function (p, i) {
    H.ensure(p);
    if (p.inCar) return;
    setSel(p, i === p.hsel ? -1 : i);
  };
  // колёсико: следующая занятая ячейка (пустая рука — между кругами)
  H.cycle = function (p, dir) {
    H.ensure(p);
    const order = [-1, 0, 1, 2, 3, 4, 5];
    let k = order.indexOf(p.hsel);
    if (k < 0) k = 0;
    for (let n = 0; n < order.length; n++) {
      k = (k + dir + order.length) % order.length;
      const s = order[k];
      if (s === -1 || (p.hotbar[s] && cnt(p, p.hotbar[s]) > 0)) {
        if (s !== p.hsel) setSel(p, s);
        return true;
      }
    }
    return false;
  };
  H.wheel = function (e) {
    const p = G().player;
    if (!p || J.Game.state !== 'play' || e.ctrlKey || e.altKey || p.inCar) return false;
    H.ensure(p);
    if (!p.hotbar.some((id) => id && cnt(p, id) > 0)) return false;
    return H.cycle(p, e.deltaY > 0 ? 1 : -1);
  };
  H.assign = function (p, slot, id) {
    H.ensure(p);
    if (slot < 0 || slot >= SLOTS) return;
    for (let i = 0; i < SLOTS; i++) if (p.hotbar[i] === id) p.hotbar[i] = null;
    p.hotbar[slot] = id;
    H.dirty = true;
  };
  H.slotOf = (p, id) => (p.hotbar ? p.hotbar.indexOf(id) : -1);
  // положить в первую свободную ячейку
  H.autoAssign = function (p, id) {
    H.ensure(p);
    if (H.slotOf(p, id) >= 0) return H.slotOf(p, id);
    const i = p.hotbar.findIndex((x) => !x || cnt(p, x) <= 0);
    if (i < 0) return -1;
    p.hotbar[i] = id;
    H.dirty = true;
    return i;
  };
  // взять в руку (из инвентаря)
  H.equip = function (p, id) {
    H.ensure(p);
    let i = H.slotOf(p, id);
    if (i < 0) i = H.autoAssign(p, id);
    if (i < 0) {
      i = p.hsel >= 0 ? p.hsel : 0;
      p.hotbar[i] = id;
    }
    p.hsel = -1;
    H.select(p, i);
  };

  // ---------- Модели ----------
  const PRIM = {};
  const prim = (k, mk) => PRIM[k] || (PRIM[k] = (() => {
    const g = mk();
    return g.index ? g.toNonIndexed() : g;
  })());
  const TAPER = (k) => prim('tp' + k, () => new THREE.CylinderGeometry(k, 1, 1, 10));
  const CYL = () => TAPER(1);
  const CYL8 = () => prim('c8', () => new THREE.CylinderGeometry(1, 1, 1, 8));
  const CYL16 = () => prim('c16', () => new THREE.CylinderGeometry(1, 1, 1, 18));
  const PRISM3 = () => prim('p3', () => new THREE.CylinderGeometry(1, 1, 1, 3));
  const BOX = () => prim('box', () => new THREE.BoxGeometry(1, 1, 1));
  const SPH = () => prim('sph', () => new THREE.SphereGeometry(1, 10, 7));
  const OCT = () => prim('oct', () => new THREE.OctahedronGeometry(1, 1));
  const TOR = () => prim('tor', () => new THREE.TorusGeometry(1, 0.22, 6, 16));
  const CONE = () => prim('cone', () => new THREE.ConeGeometry(1, 1, 5));
  const _p = new THREE.Vector3(), _q = new THREE.Quaternion(), _s = new THREE.Vector3(), _e = new THREE.Euler();
  const M4 = (x, y, z, sx, sy, sz, rx = 0, ry = 0, rz = 0) => new THREE.Matrix4().compose(_p.set(x, y, z), _q.setFromEuler(_e.set(rx, ry, rz)), _s.set(sx, sy, sz));
  const C = (hex) => new THREE.Color(hex);
  const HALF = Math.PI / 2;
  // построитель с общей матрицей (веер ножей — одна модель трижды)
  class TGB {
    constructor(gb, m) {
      this.gb = gb;
      this.m = m;
      this.v = new THREE.Vector3();
    }
    geo(g, m, col) {
      this.gb.geo(g, this.m.clone().multiply(m), col);
    }
    pt(a) {
      this.v.set(a[0], a[1], a[2]).applyMatrix4(this.m);
      return [this.v.x, this.v.y, this.v.z];
    }
    tri(a, b, c, col) {
      this.gb.tri(this.pt(a), this.pt(b), this.pt(c), col);
    }
    quad(a, b, c, d, col) {
      this.tri(a, b, c, col);
      this.tri(a, c, d, col);
    }
  }
  // цилиндр вдоль +z от z0 (радиус rb) до z1 (радиус rt)
  const rod = (gb, col, z0, z1, rb, rt, x = 0, y = 0) => {
    const k = Math.round((rt / rb) * 50) / 50;
    gb.geo(TAPER(k), M4(x, y, (z0 + z1) / 2, rb, z1 - z0, rb, HALF), col);
  };
  const box = (gb, col, x, y, z, sx, sy, sz, rx, ry, rz) => gb.geo(BOX(), M4(x, y, z, sx, sy, sz, rx, ry, rz), col);
  // плоский клинок: выпуклый контур [[y, z], ...], толщина 2t
  const blade = (gb, col, pts, t, x = 0) => {
    const n = pts.length;
    const F = pts.map(([y, z]) => [x + t, y, z]), B = pts.map(([y, z]) => [x - t, y, z]);
    for (let i = 1; i < n - 1; i++) {
      gb.tri(F[0], F[i], F[i + 1], col);
      gb.tri(B[0], B[i + 1], B[i], col);
    }
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      gb.quad(F[i], B[i], B[j], F[j], col);
    }
  };
  const STEEL = '#dfe5ec';
  const MODELS = {
    knife(gb) {
      const wd = C('#3b2417'), rv = C('#c9ccd2');
      box(gb, wd, 0, -0.003, -0.022, 0.02, 0.027, 0.11);
      for (const z of [-0.058, -0.022, 0.012]) gb.geo(CYL8(), M4(0, -0.003, z, 0.0045, 0.022, 0.0045, 0, 0, HALF), rv);
      box(gb, rv, 0, -0.002, 0.036, 0.012, 0.031, 0.008);
      blade(gb, C(STEEL), [[0.012, 0.04], [0.012, 0.17], [0.006, 0.205], [-0.002, 0.228], [-0.014, 0.19], [-0.021, 0.14], [-0.021, 0.04]], 0.0016);
    },
    switchblade(gb) {
      const bk = C('#1d1d22'), sv = C('#b8bcc4');
      box(gb, bk, 0, 0, -0.012, 0.017, 0.022, 0.1);
      box(gb, sv, 0, 0, -0.064, 0.018, 0.023, 0.01);
      box(gb, sv, 0, 0, 0.039, 0.018, 0.023, 0.008);
      blade(gb, C(STEEL), [[0.008, 0.043], [0.008, 0.125], [0.001, 0.148], [-0.012, 0.12], [-0.012, 0.043]], 0.0013);
    },
    tknife(gb) {
      const cd = C('#2a2a33'), st = C('#cfd6de');
      box(gb, cd, 0, 0, -0.028, 0.009, 0.02, 0.085);
      gb.geo(TOR(), M4(0, 0, -0.084, 0.014, 0.014, 0.014, 0, HALF, 0), st);
      box(gb, st, 0, 0, 0.017, 0.012, 0.034, 0.006);
      blade(gb, C(STEEL), [[0, 0.02], [0.013, 0.042], [0.009, 0.12], [0, 0.158], [-0.009, 0.12], [-0.013, 0.042]], 0.0015);
    },
    tknife3(gb) {
      for (const [x, a] of [[-0.012, -0.32], [0, 0], [0.012, 0.32]]) MODELS.tknife(new TGB(gb, M4(x, 0, 0, 1, 1, 1, 0, 0, 0).multiply(M4(0, 0, 0, 1, 1, 1, a, 0, 0))));
    },
    bat(gb) {
      const wd = C('#c99a5e'), wdD = C('#9f723e'), tp = C('#24242a');
      rod(gb, tp, -0.17, 0.11, 0.0155, 0.0155);
      gb.geo(SPH(), M4(0, 0, -0.176, 0.025, 0.025, 0.012), wdD);
      rod(gb, wd, 0.11, 0.42, 0.0155, 0.031);
      rod(gb, wd, 0.42, 0.66, 0.031, 0.034);
      gb.geo(SPH(), M4(0, 0, 0.66, 0.034, 0.034, 0.016), wd);
    },
    pipe(gb) {
      const st = C('#8b9098'), dk = C('#5f646c');
      rod(gb, st, -0.3, 0.6, 0.021, 0.021);
      rod(gb, dk, 0.58, 0.66, 0.027, 0.027);
      rod(gb, dk, -0.33, -0.27, 0.025, 0.025);
      gb.geo(CYL(), M4(0, 0, 0.662, 0.016, 0.004, 0.016, HALF), C('#1a1a1e'));
    },
    sign(gb) {
      const pole = C('#9aa0a8'), red = C('#c8242a'), wh = C('#f2f2f2'), dk = C('#3a3d42');
      rod(gb, pole, -0.4, 1.5, 0.022, 0.022);
      // «Въезд запрещён»: красный круг с белой полосой
      gb.geo(CYL16(), M4(0, 0, 1.36, 0.004, 0.31, 0.31, 0, 0, HALF), wh);
      gb.geo(CYL16(), M4(0.004, 0, 1.36, 0.004, 0.28, 0.28, 0, 0, HALF), red);
      gb.geo(CYL16(), M4(-0.004, 0, 1.36, 0.004, 0.28, 0.28, 0, 0, HALF), dk);
      box(gb, wh, 0.0075, 0, 1.36, 0.002, 0.075, 0.38);
      box(gb, dk, -0.012, 0, 1.36, 0.02, 0.05, 0.06);
    },
    bottle(gb) {
      const g = C('#3e8c4c');
      rod(gb, g, -0.012, 0.06, 0.012, 0.0115);
      gb.geo(TOR(), M4(0, 0, -0.012, 0.0135, 0.0135, 0.0135), g);
      rod(gb, g, 0.06, 0.1, 0.0115, 0.034);
      rod(gb, g, 0.1, 0.27, 0.034, 0.034);
      gb.geo(CYL(), M4(0, 0, 0.271, 0.034, 0.004, 0.034, HALF), C('#2c6a38'));
    },
    bbottle(gb) {
      const g = C('#3e8c4c');
      rod(gb, g, -0.012, 0.06, 0.012, 0.0115);
      gb.geo(TOR(), M4(0, 0, -0.012, 0.0135, 0.0135, 0.0135), g);
      rod(gb, g, 0.06, 0.1, 0.0115, 0.034);
      rod(gb, g, 0.1, 0.125, 0.034, 0.034);
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * TAU + 0.3, L = 0.03 + ((i * 37) % 5) * 0.012;
        gb.geo(CONE(), M4(Math.cos(a) * 0.028, Math.sin(a) * 0.028, 0.125 + L / 2, 0.01, L, 0.006, HALF, 0, a), g);
      }
    },
    brick(gb) {
      const r = C('#a8462f'), m = C('#cfc2b0');
      box(gb, r, 0, 0, 0.07, 0.1, 0.065, 0.21);
      box(gb, m, 0, 0.0335, 0.07, 0.07, 0.002, 0.17);
    },
    rock(gb) {
      gb.geo(OCT(), M4(0, 0, 0.035, 0.055, 0.045, 0.065, 0.3, 0.5, 0.2), C('#7b766e'));
      gb.geo(SPH(), M4(0.015, 0.012, 0.05, 0.035, 0.03, 0.035), C('#8a857c'));
    },
    bearing(gb) {
      const c = C('#eef2f6');
      gb.geo(SPH(), M4(0, 0.006, 0.012, 0.011, 0.011, 0.011), c);
      gb.geo(SPH(), M4(0.012, -0.004, 0.006, 0.011, 0.011, 0.011), c);
    },
    coin(gb) {
      const c = C('#d8c27a');
      gb.geo(CYL16(), M4(0, 0, 0.012, 0.0133, 0.002, 0.0133, HALF), c);
      gb.geo(CYL16(), M4(0.004, 0.006, 0.006, 0.0133, 0.002, 0.0133, HALF, 0.4), C('#c9b064'));
    },
    steelball(gb) {
      gb.geo(SPH(), M4(0, 0, 0.035, 0.045, 0.045, 0.045), C('#c8ccd2'));
      gb.geo(TOR(), M4(0, 0, 0.035, 0.0455, 0.0455, 0.0455, 0, HALF, 0), C('#e0b030'));
      gb.geo(TOR(), M4(0, 0, 0.035, 0.0455, 0.0455, 0.0455, HALF, 0, 0), C('#e0b030'));
    },
    revolver(gb) {
      const gm = C('#2b2e34'), gl = C('#4a4f58'), wd = C('#5b3a22');
      box(gb, wd, 0, -0.04, -0.014, 0.026, 0.085, 0.034, 0.3);
      box(gb, gm, 0, 0.018, 0.018, 0.024, 0.04, 0.075);
      rod(gb, gl, 0.012, 0.056, 0.021, 0.021, 0, 0.022);
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * TAU;
        rod(gb, C('#1c1e22'), 0.0555, 0.0575, 0.0045, 0.0045, Math.cos(a) * 0.012, 0.022 + Math.sin(a) * 0.012);
      }
      rod(gb, gm, 0.05, 0.17, 0.0085, 0.0085, 0, 0.034);
      box(gb, gm, 0, 0.0425, 0.11, 0.004, 0.006, 0.12);
      box(gb, gm, 0, 0.047, 0.165, 0.003, 0.009, 0.008);
      box(gb, gm, 0, 0.043, -0.02, 0.008, 0.018, 0.012, -0.5);
      gb.geo(TOR(), M4(0, -0.008, 0.02, 0.017, 0.017, 0.022, 0, HALF, 0), gm);
    },
    ammo(gb) {
      box(gb, C('#c9a24a'), 0, 0, 0.02, 0.05, 0.03, 0.07);
      box(gb, C('#7a2a1a'), 0, 0.0155, 0.02, 0.046, 0.002, 0.066);
    },
    // еда и напитки (ось +z — «вверх» предмета)
    cup(gb) {
      rod(gb, C('#f4f0e6'), -0.04, 0.06, 0.03, 0.037);
      rod(gb, C('#5a3a22'), 0.06, 0.068, 0.038, 0.034);
      rod(gb, C('#a8603a'), -0.005, 0.025, 0.0335, 0.0345);
    },
    pbottle(gb) {
      rod(gb, C('#bfe3f5'), -0.07, 0.1, 0.03, 0.03);
      rod(gb, C('#bfe3f5'), 0.1, 0.13, 0.03, 0.013);
      rod(gb, C('#2a6ad0'), 0.13, 0.15, 0.014, 0.014);
      rod(gb, C('#2a6ad0'), -0.01, 0.04, 0.0305, 0.0305);
    },
    wine(gb) {
      const g = C('#1f4a2a');
      rod(gb, g, -0.08, 0.1, 0.036, 0.036);
      rod(gb, g, 0.1, 0.14, 0.036, 0.013);
      rod(gb, g, 0.14, 0.2, 0.013, 0.012);
      rod(gb, C('#7a1a2a'), 0.185, 0.205, 0.0135, 0.0135);
      rod(gb, C('#efe6cf'), -0.04, 0.04, 0.0365, 0.0365);
    },
    gbottle(gb) {
      const g = C('#3a1c12');
      rod(gb, g, -0.08, 0.06, 0.03, 0.03);
      rod(gb, g, 0.06, 0.1, 0.03, 0.012);
      rod(gb, g, 0.1, 0.14, 0.012, 0.011);
      rod(gb, C('#d42a2a'), -0.03, 0.02, 0.0305, 0.0305);
      rod(gb, C('#c0c4ca'), 0.14, 0.15, 0.0125, 0.0125);
    },
    can(gb) {
      rod(gb, C('#2f8f4f'), -0.06, 0.06, 0.033, 0.033);
      rod(gb, C('#c8ccd2'), 0.06, 0.068, 0.033, 0.03);
      rod(gb, C('#e8e040'), -0.01, 0.02, 0.0335, 0.0335);
    },
    bloodbag(gb) {
      box(gb, C('#8a0a14'), 0, 0, 0.03, 0.02, 0.085, 0.13);
      box(gb, C('#e8e8e8'), 0, 0, 0.1, 0.006, 0.02, 0.02);
    },
    medkit(gb) {
      box(gb, C('#f2f2f2'), 0, 0, 0.03, 0.06, 0.1, 0.12);
      box(gb, C('#d42a2a'), 0.031, 0, 0.03, 0.002, 0.065, 0.02);
      box(gb, C('#d42a2a'), 0.031, 0, 0.03, 0.002, 0.02, 0.065);
      box(gb, C('#d42a2a'), -0.031, 0, 0.03, 0.002, 0.065, 0.02);
      box(gb, C('#d42a2a'), -0.031, 0, 0.03, 0.002, 0.02, 0.065);
    },
    bandage(gb) {
      gb.geo(CYL(), M4(0, 0, 0.02, 0.032, 0.05, 0.032, 0, 0, HALF), C('#f4f2ec'));
    },
    onigiri(gb) {
      gb.geo(PRISM3(), M4(0, 0, 0.03, 0.055, 0.035, 0.055, 0, 0, HALF).multiply(M4(0, 0, 0, 1, 1, 1, 0, HALF, 0)), C('#f6f4ee'));
      box(gb, C('#1c241c'), 0, -0.018, 0.03, 0.037, 0.04, 0.03);
    },
    sandwich(gb) {
      gb.geo(PRISM3(), M4(0, 0, 0.03, 0.06, 0.04, 0.06, 0, 0, HALF), C('#e8cf96'));
      gb.geo(PRISM3(), M4(0, 0, 0.03, 0.062, 0.012, 0.062, 0, 0, HALF), C('#e8909a'));
    },
    pizza(gb) {
      gb.geo(PRISM3(), M4(0, 0, 0.05, 0.08, 0.012, 0.08, 0, 0, HALF).multiply(M4(0, 0, 0, 1, 1, 1, 0, -HALF, 0)), C('#f0b848'));
      for (let i = 0; i < 3; i++) gb.geo(CYL(), M4(0.007, (i - 1) * 0.018, 0.04 + i * 0.012, 0.009, 0.004, 0.009, 0, 0, HALF), C('#c4282c'));
    },
    burger(gb) {
      rod(gb, C('#c98a40'), -0.03, -0.012, 0.045, 0.045);
      rod(gb, C('#4a2a1a'), -0.012, 0.006, 0.047, 0.047);
      rod(gb, C('#f2c230'), 0.006, 0.011, 0.049, 0.049);
      rod(gb, C('#5aa040'), 0.011, 0.016, 0.05, 0.05);
      gb.geo(SPH(), M4(0, 0, 0.016, 0.046, 0.046, 0.03), C('#d49450'));
    },
    gum(gb) {
      box(gb, C('#f2f2ee'), 0, 0, 0.02, 0.02, 0.05, 0.08);
      box(gb, C('#6a3a1a'), 0.011, 0, 0.02, 0.002, 0.05, 0.03);
    },
    bowl(gb) {
      rod(gb, C('#f4f2ec'), -0.02, 0.03, 0.04, 0.06);
      rod(gb, C('#c87a2a'), 0.026, 0.031, 0.056, 0.056);
    },
  };
  const GLASS = { bottle: 1, bbottle: 1 };
  const GEO = {};
  H.geo = function (model) {
    if (GEO[model]) return GEO[model];
    const gb = new J.GB();
    (MODELS[model] || MODELS.rock)(gb);
    const g = gb.build();
    g.userData.shared = true; // общие — их никогда не освобождают вместе с видом персонажа
    return (GEO[model] = g);
  };
  H.modelOf = (e, id) => {
    const d = H.def(id);
    if (!d) return null;
    // веер ножей между пальцев
    if (d.model === 'tknife' && (e.isPlayer ? cnt(e, id) >= 3 : e.bossKey === 'dio')) return 'tknife3';
    return d.model;
  };
  // материалы: у предметов игрока — свой (не сереет в его остановке времени), у остальных — общий мира
  let MAT = null;
  const mats = () => {
    if (MAT) return MAT;
    // лёгкое собственное свечение — сталь не чернеет в тени
    const mk = (o) => new THREE.MeshPhongMaterial(Object.assign({ vertexColors: true, side: THREE.DoubleSide, shininess: 60, specular: new THREE.Color('#5a5a62'), emissive: new THREE.Color('#15171b') }, o));
    MAT = { w: mk({}), p: mk({}), gw: mk({ transparent: true, opacity: 0.78, shininess: 90 }), gp: mk({ transparent: true, opacity: 0.78, shininess: 90 }) };
    if (R3.fxPatch) {
      R3.fxPatch(MAT.w, R3.uDesat);
      R3.fxPatch(MAT.gw, R3.uDesat);
      R3.fxPatch(MAT.p);
      R3.fxPatch(MAT.gp);
    }
    return MAT;
  };
  H.mesh = function (model, own) {
    const m = mats();
    const glass = GLASS[model];
    const mesh = new THREE.Mesh(H.geo(model), glass ? (own ? m.gp : m.gw) : own ? m.p : m.w);
    mesh.rotation.order = 'YXZ';
    mesh.castShadow = false;
    return mesh;
  };

  // ---------- Позы хвата и клипы ----------
  // каналы: правая рука (x, z), предплечье, кисть (наклон предмета), поворот и наклон корпуса, левая рука (x, z), левое предплечье
  const AR = 0, ARZ = 1, FR = 2, WR = 3, SY = 4, SX = 5, AL = 6, ALZ = 7, FL = 8, NC = 9;
  const CHN = { AR, ARZ, FR, WR, SY, SX, AL, ALZ, FL };
  const pose = (o, base) => {
    const a = new Float32Array(NC);
    if (base) a.set(base);
    for (const k in o) a[CHN[k]] = o[k];
    return a;
  };
  const IDLE = {
    knife: pose({ AR: -0.35, ARZ: 0.12, FR: -0.95, WR: 1.05, AL: -0.15, ALZ: -0.1, FL: -0.5 }),
    club1: pose({ AR: -0.08, ARZ: 0.1, FR: -0.3, WR: 1.75, AL: -0.15, ALZ: -0.1, FL: -0.5 }),
    small: pose({ AR: -0.2, ARZ: 0.1, FR: -0.75, WR: 1.2, AL: -0.15, ALZ: -0.1, FL: -0.5 }),
    two: pose({ AR: -0.5, ARZ: 0.32, FR: -2.25, WR: 0.25, AL: -0.15, ALZ: -0.1, FL: -0.5 }),
    sign: pose({ AR: -0.55, ARZ: 0.3, FR: -2.3, WR: 0.6, AL: -0.15, ALZ: -0.1, FL: -0.5 }),
    gun: pose({ AR: -0.35, ARZ: 0.05, FR: -0.55, WR: 1.35, AL: -0.15, ALZ: -0.1, FL: -0.5 }),
    food: pose({ AR: -0.22, ARZ: 0.1, FR: -1.15, WR: -0.25, AL: -0.15, ALZ: -0.1, FL: -0.5 }),
  };
  const AIM = { AR: -1.55, ARZ: -0.08, FR: -0.03, WR: 1.57, SY: -0.3, AL: -1.4, ALZ: 0.45, FL: -0.55 };
  // клип: { hit — доля длительности до удара, left — левая рука участвует, K: [[k, поза, сглаживание]] }
  const CLIPS = {
    stab: { hit: 0.42, K: [[0, {}], [0.3, { AR: -0.55, ARZ: 0.25, FR: -1.95, WR: 1.45, SY: 0.35 }, 'in'], [0.42, { AR: -1.5, ARZ: 0.02, FR: -0.08, WR: 1.55, SY: -0.5, SX: 0.12 }, 'outExpo'], [0.65, { AR: -1.5, ARZ: 0.02, FR: -0.08, WR: 1.55, SY: -0.5, SX: 0.12 }], [1, {}, 'inOut']] },
    slash: { hit: 0.45, K: [[0, {}], [0.3, { AR: -1.45, ARZ: 1.0, FR: -1.3, WR: 0.35, SY: 0.55 }, 'in'], [0.45, { AR: -1.35, ARZ: -0.55, FR: -0.35, WR: 0.35, SY: -0.65, SX: 0.1 }, 'outExpo'], [0.65, { AR: -1.3, ARZ: -0.7, FR: -0.4, WR: 0.35, SY: -0.75, SX: 0.1 }], [1, {}, 'inOut']] },
    overhead: { hit: 0.5, K: [[0, {}], [0.36, { AR: -2.8, ARZ: 0.2, FR: -1.3, WR: 0.6, SX: -0.12, SY: 0.25 }, 'in'], [0.5, { AR: -1.15, ARZ: 0.05, FR: -0.35, WR: 1.45, SX: 0.28, SY: -0.3 }, 'outExpo'], [0.7, { AR: -1.1, ARZ: 0.05, FR: -0.35, WR: 1.45, SX: 0.28, SY: -0.3 }], [1, {}, 'inOut']] },
    swing: { hit: 0.5, left: true, K: [[0, {}], [0.36, { AR: -1.0, ARZ: 0.75, FR: -2.3, WR: 0.8, SY: 0.85, SX: 0.05, AL: -0.9, ALZ: 0.55, FL: -2.0 }, 'in'], [0.5, { AR: -1.45, ARZ: -0.15, FR: -0.25, WR: 1.55, SY: -0.95, SX: 0.1, AL: -1.45, ALZ: 0.75, FL: -0.5 }, 'outExpo'], [0.72, { AR: -1.25, ARZ: -0.7, FR: -0.6, WR: 1.4, SY: -1.35, SX: 0.1, AL: -1.2, ALZ: 1.0, FL: -0.9 }], [1, {}, 'inOut']] },
    swingB: { hit: 0.5, left: true, K: [[0, {}], [0.36, { AR: -1.4, ARZ: -0.6, FR: -1.0, WR: 1.3, SY: -0.9, AL: -1.3, ALZ: 0.9, FL: -1.2 }, 'in'], [0.5, { AR: -1.45, ARZ: 0.7, FR: -0.3, WR: 1.5, SY: 0.7, AL: -1.2, ALZ: 0.3, FL: -0.6 }, 'outExpo'], [0.72, { AR: -1.4, ARZ: 0.9, FR: -0.35, WR: 1.45, SY: 0.85, AL: -1.1, ALZ: 0.2, FL: -0.7 }], [1, {}, 'inOut']] },
    smash: { hit: 0.55, left: true, K: [[0, {}], [0.4, { AR: -2.9, ARZ: 0.1, FR: -1.0, WR: 0.4, SX: -0.2, AL: -2.7, ALZ: 0.3, FL: -1.0 }, 'in'], [0.55, { AR: -1.1, ARZ: 0.05, FR: -0.1, WR: 1.55, SX: 0.4, AL: -1.1, ALZ: 0.35, FL: -0.15 }, 'outExpo'], [0.75, { AR: -1.05, ARZ: 0.05, FR: -0.1, WR: 1.55, SX: 0.4, AL: -1.05, ALZ: 0.35, FL: -0.15 }], [1, {}, 'inOut']] },
    throw: { hit: 0.55, left: true, K: [[0, {}], [0.45, { AR: -2.75, ARZ: 0.35, FR: -1.85, WR: 0.9, SY: 0.75, SX: -0.12, AL: -1.2, ALZ: -0.3, FL: -0.4 }, 'outQuad'], [0.58, { AR: -1.25, ARZ: 0.05, FR: -0.15, WR: 1.5, SY: -0.65, SX: 0.28, AL: 0.3, ALZ: -0.2, FL: -0.5 }, 'outExpo'], [0.8, { AR: -1.2, ARZ: 0.05, FR: -0.2, WR: 1.5, SY: -0.6, SX: 0.25, AL: 0.3, ALZ: -0.2, FL: -0.5 }], [1, {}, 'inOut']] },
    shoot: { hit: 0, left: true, K: [[0, AIM], [0.12, Object.assign({}, AIM, { AR: -1.88, FR: -0.32, WR: 1.25, SX: -0.05 }), 'outExpo'], [0.45, AIM, 'inOut'], [1, AIM]] },
    reload: { hit: 0, left: true, K: [[0, {}], [0.15, { AR: -0.75, ARZ: -0.2, FR: -1.7, WR: 2.9, SX: 0.12, AL: -0.95, ALZ: 0.55, FL: -1.6 }, 'outQuad'], [0.5, { AR: -0.7, ARZ: -0.25, FR: -1.6, WR: 3.3, SX: 0.12, AL: -1.05, ALZ: 0.6, FL: -1.75 }], [0.85, { AR: -0.8, ARZ: -0.2, FR: -1.7, WR: 2.6, SX: 0.12, AL: -0.95, ALZ: 0.55, FL: -1.6 }], [1, {}, 'inOut']] },
    eat: { hit: 0, K: [[0, {}], [0.22, { AR: -0.55, ARZ: -0.38, FR: -2.45, WR: 0.5, SX: 0.05 }, 'outQuad'], [0.45, { AR: -0.6, ARZ: -0.38, FR: -2.5, WR: 0.6, SX: 0.08 }], [0.65, { AR: -0.55, ARZ: -0.38, FR: -2.45, WR: 0.5, SX: 0.05 }], [0.85, { AR: -0.6, ARZ: -0.38, FR: -2.5, WR: 0.6, SX: 0.08 }], [1, {}, 'inOut']] },
    drink: { hit: 0, K: [[0, {}], [0.22, { AR: -0.75, ARZ: -0.35, FR: -2.35, WR: 0.1, SX: -0.18 }, 'outQuad'], [0.82, { AR: -0.8, ARZ: -0.35, FR: -2.4, WR: -0.15, SX: -0.22 }], [1, {}, 'inOut']] },
  };
  // клип, собранный поверх позы хвата (кэш по хвату)
  const BUILT = {};
  const built = (grip, name) => {
    const k = grip + '|' + name;
    if (BUILT[k]) return BUILT[k];
    const c = CLIPS[name];
    const base = IDLE[grip];
    return (BUILT[k] = { hit: c.hit, left: !!c.left, K: c.K.map(([t, o, e]) => [t, pose(o, base), e]) });
  };
  const OUTP = new Float32Array(NC);
  const sampleClip = (cl, k, out) => {
    const K = cl.K;
    if (k <= 0) return out.set(K[0][1]);
    if (k >= 1) return out.set(K[K.length - 1][1]);
    let i = 1;
    while (i < K.length - 1 && K[i][0] < k) i++;
    const t0 = K[i - 1][0], t1 = K[i][0];
    const u = t1 > t0 ? J.clamp((k - t0) / (t1 - t0), 0, 1) : 1;
    const E = J.Anim && J.Anim.EASE;
    const e = E ? (E[K[i][2] || 'inOut'] || E.inOut)(u) : u;
    const a = K[i - 1][1], b = K[i][1];
    for (let c = 0; c < NC; c++) out[c] = a[c] + (b[c] - a[c]) * e;
  };
  H.CLIPS = CLIPS;
  H.IDLE = IDLE;
  H.rebuildClips = () => { for (const k in BUILT) delete BUILT[k]; };

  // Поза поверх обычной анимации (вызывается после J.Anim.rig)
  const NOHOLD = { down: 1, dead: 1, death: 1, air: 1, launch: 1, getup: 1, slump: 1, stagger: 1, gbreak: 1, parried: 1, pummel: 1 };
  function holdPose(v, e, spd, t, dt) {
    const mesh = v.heldMesh;
    if (!mesh) return;
    const d = H.def(v.heldId);
    const grip = gripOf(d);
    const an = e.anim && e.anim.t > 0 ? e.anim : null;
    const mine = an && an.type === 'item';
    let want = 1;
    if (e.dead || (e.react && NOHOLD[e.react.type]) || e.guard || e.dash || e.channel || e.mount || e.airborne) want = 0;
    else if (an && !mine && an.type !== 'punch' && !an.stand) want = 0;
    v.hw = approach(v.hw || 0, want, dt / 0.12);
    const w = v.hw;
    let left = false, spine = 0;
    const ch = e.chg && !(e.standOut && e.stand && !mine);
    if (mine && CLIPS[an.iclip]) {
      const cl = built(grip, an.iclip);
      sampleClip(cl, J.clamp(1 - an.t / an.max, 0, 1), OUTP);
      left = cl.left;
      spine = 1;
    } else if (e.thrAim || (ch && d.cls === 'throw')) {
      // замах для броска: рука отведена назад
      const k = e.thrAim ? J.clamp(e.thrAim.t / 0.25, 0, 1) : J.clamp(e.chg.t / 0.25, 0, 1);
      sampleClip(built(grip, 'throw'), 0.45 * k, OUTP);
      left = true;
      spine = 1;
    } else if (ch) {
      // заряд тяжёлого удара оружием: держит замах
      const cl = built(grip, grip === 'knife' ? 'stab' : grip === 'two' || grip === 'sign' ? 'smash' : 'overhead');
      sampleClip(cl, cl.hit * 0.75 * J.clamp(e.chg.t / 0.25, 0, 1), OUTP);
      left = cl.left;
      spine = 1;
    } else if (grip === 'gun' && (e.aimT > 0 || (e.ai && e.ai.target && !e.ai.civ))) {
      OUTP.set(pose(AIM, IDLE.gun));
      left = true;
      spine = 0.6;
    } else {
      OUTP.set(IDLE[grip]);
      // ходьба: предмет покачивается в такт шагу
      if (spd > 0.3) OUTP[AR] += Math.sin(v.phase || 0) * 0.12 * (grip === 'two' || grip === 'sign' ? 0.3 : 1);
      left = d.two && grip !== 'two' && grip !== 'sign';
    }
    if (w <= 0) {
      mesh.rotation.x = OUTP[WR];
      return;
    }
    v.armR.rotation.x = lerp(v.armR.rotation.x, OUTP[AR], w);
    v.armR.rotation.z = lerp(v.armR.rotation.z, OUTP[ARZ], w);
    v.foreR.rotation.x = lerp(v.foreR.rotation.x, OUTP[FR], w);
    if (left) {
      v.armL.rotation.x = lerp(v.armL.rotation.x, OUTP[AL], w);
      v.armL.rotation.z = lerp(v.armL.rotation.z, OUTP[ALZ], w);
      v.foreL.rotation.x = lerp(v.foreL.rotation.x, OUTP[FL], w);
    }
    if (spine && v.spine) {
      v.spine.rotation.y = lerp(v.spine.rotation.y, OUTP[SY], w * spine);
      v.spine.rotation.x = lerp(v.spine.rotation.x, OUTP[SX], w * spine);
    }
    mesh.rotation.x = OUTP[WR];
  }

  // ---------- Предмет в руке на модели ----------
  function syncHeld(e) {
    const v = e.view;
    if (!v || !v.foreR) return;
    let id = !e.dead || !e.isPlayer ? H.heldId(e) : null;
    if (e.inCar) id = null;
    const model = id ? H.modelOf(e, id) : null;
    if (v.heldModel !== model) {
      if (v.heldMesh) v.foreR.remove(v.heldMesh);
      v.heldMesh = null;
      v.heldModel = model;
      v.heldId = id;
      if (model) {
        const m = H.mesh(model, e.isPlayer);
        m.position.set(-0.004, -0.305, 0.025);
        v.foreR.add(m);
        v.heldMesh = m;
        v.hw = 0;
      }
    }
    v.heldId = id;
    if (v.heldMesh) {
      // дальше 45 м предмет в руке не нужен
      v.heldMesh.visible = v.group.visible && (e.isPlayer || e._d2 === undefined || e._d2 < 2025);
    }
  }
  H.syncHeld = syncHeld;

  // ---------- Мир ----------
  const FLY = []; // летящие предметы
  const GROUND = []; // лежащие предметы
  H.FLY = FLY;
  H.GROUND = GROUND;
  let UID = 1;
  const V1 = new THREE.Vector3();
  // точка кисти в мире
  const HP = { x: 0, h: 0, z: 0 };
  H.handPos = function (e, stand) {
    const v = stand ? e.standView : e.view;
    if (v && v.foreR && v.group.visible) {
      v.foreR.updateWorldMatrix(true, false);
      V1.set(0, -0.31, 0.04);
      v.foreR.localToWorld(V1);
      HP.x = V1.x;
      HP.h = V1.y;
      HP.z = V1.z;
      return HP;
    }
    const a = e.face || 0;
    HP.x = e.x + Math.cos(a) * 0.35 - Math.sin(a) * 0.2;
    HP.z = e.y + Math.sin(a) * 0.35 + Math.cos(a) * 0.2;
    HP.h = gy(e.x, e.y) + (e.z || 0) + 1.25 * (e.scale || 1);
    return HP;
  };

  // предмет на земле
  H.spawnGround = function (x, y, item, n = 1, o = {}) {
    const w = G().world;
    if (!w || !J.ITEMS[item]) return null;
    const d = H.def(item);
    const gi = { id: UID++, x, y, item, n, dur: o.dur, mag: o.mag, loot: !!o.loot, life: o.loot ? Infinity : o.life || 300, h: o.h, yaw: o.yaw !== undefined ? o.yaw : rnd() * TAU, pitch: o.pitch, roll: o.roll, mesh: null };
    if (gi.h === undefined) gi.h = gy(x, y);
    // как лежит: плашмя на боку; воткнутый — под углом
    if (gi.pitch === undefined) gi.pitch = 0;
    if (gi.roll === undefined) gi.roll = d && (d.cls === 'blade' || d.model === 'tknife' || d.model === 'sign') ? HALF : d && d.cls === 'gun' ? HALF : 0;
    gi.mesh = H.mesh(d ? d.model : 'rock', false);
    R3.fxGroup.add(gi.mesh);
    placeGround(gi);
    GROUND.push(gi);
    if (GROUND.length > 60) {
      // самые старые выброшенные — исчезают
      const i = GROUND.findIndex((g) => !g.loot && g.life < 999);
      removeGround(GROUND[i >= 0 ? i : 0]);
    }
    return gi;
  };
  const LIFT = { coin: 0.004, bat: 0.034, pipe: 0.022, sign: 0.03, bottle: 0.034, bbottle: 0.034, brick: 0.035, rock: 0.04, steelball: 0.045, revolver: 0.016, bearing: 0.011 };
  function placeGround(gi) {
    const m = gi.mesh;
    const d = H.def(gi.item);
    const lift = gi.stuck ? 0 : LIFT[d && d.model] || 0.012;
    m.position.set(gi.x, gi.h + lift, gi.y);
    m.rotation.set(gi.pitch, gi.yaw, gi.roll);
  }
  function removeGround(gi) {
    if (!gi) return;
    R3.fxGroup.remove(gi.mesh);
    const i = GROUND.indexOf(gi);
    if (i >= 0) GROUND.splice(i, 1);
  }
  // ближайший предмет, который можно подобрать
  H.nearItem = function (p, r = 1.5) {
    let best = null, bd = r;
    const g0 = gy(p.x, p.y);
    for (const gi of GROUND) {
      const d = J.dist(p.x, p.y, gi.x, gi.y);
      if (d < bd && Math.abs(gi.h - g0) < 2.4) {
        bd = d;
        best = gi;
      }
    }
    return best;
  };
  H.pickup = function (p, gi) {
    if (!gi || GROUND.indexOf(gi) < 0) return;
    H.ensure(p);
    const had = cnt(p, gi.item);
    J.P.addItem(p, gi.item, gi.n, null, true);
    if (!had && gi.dur !== undefined) p.dur[gi.item] = gi.dur;
    if (gi.mag !== undefined && H.def(gi.item) && H.def(gi.item).cls === 'gun') p.mag[gi.item] = Math.max(gi.mag, had ? p.mag[gi.item] || 0 : 0);
    removeGround(gi);
    const it = J.ITEMS[gi.item];
    const slot = H.slotOf(p, gi.item);
    J.UI.toast(`Подобрано: ${it.name}${gi.n > 1 ? ' ×' + gi.n : ''}${slot >= 0 ? ` (клавиша ${KEYS[slot]})` : ''}`, 'normal');
    if (J.Sfx && J.Sfx.whoosh) J.Sfx.whoosh(0.08, true, 0.05);
    // пустая рука — сразу берёт найденное оружие
    if (slot >= 0 && !H.heldId(p) && H.isWeapon(gi.item)) {
      p.hsel = -1;
      H.select(p, slot);
    }
    H.dirty = true;
  };
  H.drop = function (p) {
    const id = H.heldId(p);
    if (!id || p.inCar) return;
    const d = H.def(id);
    const a = p.face;
    const x = p.x + Math.cos(a) * 0.6, y = p.y + Math.sin(a) * 0.6;
    const w = G().world;
    const ok = !w.solid(x, y) && !w.isWater(x, y);
    const o = { dur: d.dur < 999 ? H.durOf(p, id) : undefined, mag: d.cls === 'gun' ? H.magOf(p, id) : undefined, yaw: a + HALF };
    H.spawnGround(ok ? x : p.x, ok ? y : p.y, id, 1, o);
    J.P.removeItem(p, id);
    if (cnt(p, id) <= 0 || d.dur < 999) delete p.dur[id];
    if (d.cls === 'gun' && cnt(p, id) <= 0) delete p.mag[id];
    J.R3.text(p.x, p.y, 'Выброшено: ' + J.ITEMS[id].name, 'tmiss', 0.8, 2.2);
    H.dirty = true;
  };

  // ---------- Износ ----------
  H.wear = function (e, id, n) {
    const d = H.def(id);
    if (!d || !(d.dur < 999)) return false;
    const v = H.durOf(e, id) - n;
    if (v > 0) {
      if (e.isPlayer) e.dur[id] = v;
      else e.hdur = v;
      H.dirty = true;
      return false;
    }
    H.breakItem(e, id);
    return true;
  };
  H.breakItem = function (e, id) {
    const d = H.def(id);
    const it = J.ITEMS[id];
    const hp = H.handPos(e);
    if (pwOk() && nearP(e.x, e.y, 30)) {
      const glass = d.model === 'bottle' || d.model === 'bbottle';
      J.Pw.shards(hp.x, hp.h, hp.z, glass ? 14 : 8, glass ? '#7fd08a' : d.cls === 'blade' ? '#dfe5ec' : '#b0855a', 3, glass ? 0.025 : 0.03, glass ? 0 : 1, e.face, 1.5, 9, 0.9);
      if (glass && J.Sfx) J.Sfx.glass();
      else if (J.Sfx) J.Sfx.block(true);
    }
    if (e.isPlayer) {
      delete e.dur[id];
      const slot = e.hsel;
      J.P.removeItem(e, id);
      if (d.breaksTo) {
        J.P.addItem(e, d.breaksTo, 1, null, true);
        if (slot >= 0) {
          H.assign(e, slot, d.breaksTo);
          e.hsel = slot;
          // остальные целые бутылки — в свободную ячейку
          if (cnt(e, id) > 0) H.autoAssign(e, id);
        }
        J.UI.toast(`${it.name} разбилась — в руке ${J.ITEMS[d.breaksTo].name.toLowerCase()}!`, 'gold');
      } else J.UI.toast(`${it.name}: сломано!`, 'red');
      H.dirty = true;
    } else {
      e.hand = d.breaksTo || null;
      e.hdur = undefined;
    }
  };

  // ---------- Звуки ----------
  // свои короткие звуки (WebAudio) поверх общих J.Sfx
  const snd = function (kind, power = 1) {
    const S = J.Sfx;
    if (!S || !S.ac || (J.Game.settings && !J.Game.settings.sound)) return;
    const ac = S.ac;
    try {
      const t = ac.currentTime;
      const out = ac.createGain();
      out.connect(ac.destination);
      if (kind === 'slash') {
        // свист клинка и влажный шлепок
        const n = ac.createBufferSource();
        const len = Math.floor(ac.sampleRate * 0.18);
        const b = ac.createBuffer(1, len, ac.sampleRate);
        const ch = b.getChannelData(0);
        for (let i = 0; i < len; i++) ch[i] = (Math.random() * 2 - 1) * (1 - i / len);
        n.buffer = b;
        const f = ac.createBiquadFilter();
        f.type = 'bandpass';
        f.frequency.setValueAtTime(5200, t);
        f.frequency.exponentialRampToValueAtTime(1400, t + 0.15);
        f.Q.value = 1.4;
        out.gain.setValueAtTime(0.0001, t);
        out.gain.exponentialRampToValueAtTime(0.22 * power, t + 0.01);
        out.gain.exponentialRampToValueAtTime(0.0001, t + 0.17);
        n.connect(f).connect(out);
        n.start(t);
      } else if (kind === 'clang' || kind === 'ting') {
        // металл: несколько негармоничных обертонов
        const base = kind === 'ting' ? 2400 : 620;
        for (const k of [1, 2.76, 5.4]) {
          const o = ac.createOscillator();
          o.type = 'sine';
          o.frequency.value = base * k * (0.97 + Math.random() * 0.06);
          const g = ac.createGain();
          g.gain.setValueAtTime(0.0001, t);
          g.gain.exponentialRampToValueAtTime((0.09 / k) * power, t + 0.004);
          g.gain.exponentialRampToValueAtTime(0.0001, t + (kind === 'ting' ? 0.35 : 0.6) / Math.sqrt(k));
          o.connect(g).connect(out);
          o.start(t);
          o.stop(t + 0.7);
        }
      } else if (kind === 'wood') {
        const o = ac.createOscillator();
        o.type = 'triangle';
        o.frequency.setValueAtTime(380, t);
        o.frequency.exponentialRampToValueAtTime(160, t + 0.08);
        out.gain.setValueAtTime(0.0001, t);
        out.gain.exponentialRampToValueAtTime(0.25 * power, t + 0.003);
        out.gain.exponentialRampToValueAtTime(0.0001, t + 0.12);
        o.connect(out);
        o.start(t);
        o.stop(t + 0.15);
      } else if (kind === 'reload') {
        for (let i = 0; i < 4; i++) {
          const o = ac.createOscillator();
          o.type = 'square';
          o.frequency.value = 1800 + i * 90;
          const g = ac.createGain();
          const d = t + i * 0.22;
          g.gain.setValueAtTime(0.0001, d);
          g.gain.exponentialRampToValueAtTime(0.05, d + 0.002);
          g.gain.exponentialRampToValueAtTime(0.0001, d + 0.03);
          o.connect(g).connect(out);
          o.start(d);
          o.stop(d + 0.05);
        }
      }
    } catch (err) {}
  };
  H.snd = snd;

  // ---------- Удары оружием ----------
  const aimFor = (u, range) => (u.isPlayer ? J.P.aim(u, range) : u.ai && u.ai.target ? J.Abil.aimAt(u, u.ai.target) : { ang: u.face, target: null });
  const HAMON_OK = { bat: 1, bottle: 1, bbottle: 1, rock: 1, brick: 1, sign: 0 };
  // прохожие под ударом: падают и разбегаются, полиция это запомнит
  function civHit(u, ang, range, arc) {
    let n = 0;
    for (const o of G().ents) {
      if (o.dead || o.kind !== 'civ' || o.downT > 0) continue;
      const d = J.dist(u.x, u.y, o.x, o.y) - o.r;
      if (d > range) continue;
      const a = Math.atan2(o.y - u.y, o.x - u.x);
      if (d > 0.5 && Math.abs(J.angDiff(ang, a)) > arc / 2) continue;
      o.downT = 1.6;
      if (o.ai) o.ai.fear = 7;
      J.R3.text(o.x, o.y, J.R.pick(['Ай!', 'Ты что творишь?!', 'Полиция!']), 'tsay', 1);
      n++;
    }
    if (n && u.isPlayer && J.Veh && J.Veh.crime) J.Veh.crime(0.5 * n, u.x, u.y);
    return n;
  }
  // попадание оружием: кровь у клинков, звук по материалу
  function meleeFx(u, d, id, a, n, wall) {
    const hp = H.handPos(u);
    if (!nearP(u.x, u.y, 30)) return;
    const metal = d.model === 'pipe' || d.model === 'sign' || d.cls === 'gun';
    if (n) {
      if (d.cls === 'blade') {
        snd('slash', 1);
        if (pwOk()) {
          const tg = J.nearestHostile(u, d.reach + 0.6, 1.2, a);
          const x = tg ? tg.x - Math.cos(a) * 0.2 : hp.x, y = tg ? tg.y - Math.sin(a) * 0.2 : hp.z;
          J.Pw.blood(x, gy(x, y) + 1.15, y, 10, a, 3);
          if (rnd() < 0.5) J.Pw.decal('blood', x + Math.cos(a) * 0.6, y + Math.sin(a) * 0.6, 0.9, 10);
        }
      } else if (metal) snd('clang', 0.8);
      else snd('wood', 1);
    } else if (wall) {
      snd(metal || d.cls === 'blade' ? 'clang' : 'wood', 0.7);
      if (fxOk()) J.Fx.sparks(hp.x, hp.h, hp.z, metal || d.cls === 'blade' ? 10 : 4, a + Math.PI, metal || d.cls === 'blade' ? '#ffd27a' : '#c8a070', 5);
    }
  }
  // удар предметом в руке; k — заряд тяжёлого (undefined — обычный)
  H.melee = function (u, k) {
    const g = G();
    const id = H.heldId(u);
    const d = H.def(id);
    if (!d || d.cls === 'ammo') return false;
    const heavy = k !== undefined;
    if (!heavy && u.cds.item > 0) {
      if (u.isPlayer) u.buf = g.t;
      return false;
    }
    if (!u.canAct() || u.channel || u.dash || u.guard || u.bstun > 0 || (J.Cb && J.Cb.isDown(u))) return false;
    if (u.atk && !u.atk.done) {
      if (u.isPlayer) u.buf = g.t;
      return false;
    }
    if (heavy && u.cds.heavy > 0) return false;
    const grip = gripOf(d);
    const str = u.isPlayer ? u.stats.str : 3;
    // вес: тяжёлое оружие медленнее и выматывает
    let dur = (0.3 + d.w * 0.075) / (1 + str * 0.03);
    let tired = false;
    if (u.isPlayer) {
      const cost = 2 + d.w * 3.5 + (heavy ? 6 : 0);
      if (u.stamina < cost) {
        tired = true;
        dur *= 1.45;
        say('tired', 'Ты выдохся: удары медленные и слабые.', 'muted');
      }
      u.stamina = Math.max(0, u.stamina - cost);
    }
    if (heavy) dur *= 1.35;
    if (g.t - (u.lastItemT || -9) > 0.8) u.icombo = 0;
    const ci = u.icombo || 0;
    u.icombo = ci + 1;
    u.lastItemT = g.t;
    let clip;
    if (grip === 'knife') clip = heavy ? 'stab' : ci % 2 ? 'slash' : 'stab';
    else if (grip === 'two') clip = heavy ? 'smash' : ci % 2 ? 'swingB' : 'swing';
    else if (grip === 'sign') clip = heavy ? 'smash' : 'swing';
    else clip = 'overhead';
    const cl = built(grip, clip);
    const aim = aimFor(u, d.reach + 1.2);
    u.face = aim.ang;
    const counter = u.st.counter > 0;
    if (counter) u.st.counter = 0;
    let dmg;
    if (u.isPlayer) {
      dmg = d.dmg * (1 + str * 0.06) * (1 + (u.lvl - 1) * 0.02);
      if (u.style === 'vampire' || u.style === 'ultimate') dmg *= 1.4;
    } else dmg = u.dmg * (u.dmgMul || 1) * (0.7 + d.dmg / 20) * (u.boss ? 0.7 : 1);
    if (heavy) dmg *= 1.5 + 0.8 * k;
    if (counter) dmg *= 1.6;
    if (tired) dmg *= 0.7;
    let kind = 'phys';
    if (u.isPlayer && u.style === 'hamon' && HAMON_OK[d.model] && u.breath >= 2) {
      kind = 'hamon';
      u.breath -= 2;
      dmg *= 1.25;
    }
    const fn = () => {
      const a = aimFor(u, d.reach + 0.6).ang;
      u.face = a;
      const range = d.reach + (heavy ? 0.15 : 0);
      const opt = {
        knock: (d.knock || 1) * (heavy ? 2.2 + k : 1), stun: (d.stun || 0.15) * (heavy ? 1.6 : 1), melee: true, kind,
        gdmg: (heavy ? 30 : 10) + d.w * 8, finisher: heavy && k >= 0.9, launch: heavy && k >= 0.9 && d.w >= 0.8, crit: counter,
        fx: d.bleed ? { bleed: d.bleed * (heavy ? 1.5 : 1) } : undefined,
      };
      const n = J.hitArc(u, a, range, d.arc, dmg, opt);
      if (u.isPlayer) civHit(u, a, range, d.arc);
      // по стене — звон и износ
      const w = g.world;
      const wall = !n && w.solid(u.x + Math.cos(a) * range * 0.9, u.y + Math.sin(a) * range * 0.9);
      meleeFx(u, d, id, a, n, wall);
      if (kind === 'hamon' && pwOk()) J.Pw.glow(u.x + Math.cos(a) * range, gy(u.x, u.y) + 1.2, u.y + Math.sin(a) * range, 8, '#ffd84a', 2, 0.1, 0.4);
      if (n || wall) H.wear(u, id, heavy ? 2 : 1);
      if (u.isPlayer) {
        if (n) J.P.trainStat(u, 'str', 0.3 + d.w * 0.2);
        else u.whiff = g.t;
      }
    };
    J.Cb.attack(u, { clip: null, type: 'item', dur, at: dur * cl.hit, fn, tg: aim.target, kind: heavy ? 'heavy' : 'light', step: grip === 'knife' ? 0.35 : 0.25, reach: Math.max(0.3, d.reach - 0.4), glint: !u.isPlayer });
    u.anim.iclip = clip;
    if (J.Sfx && J.Sfx.whoosh && (u.isPlayer || nearP(u.x, u.y, 15))) J.Sfx.whoosh(0.1 + d.w * 0.05, d.w < 1, 0.06 + Math.min(0.08, d.w * 0.03));
    u.cds.item = dur * 0.92;
    if (heavy) u.cds.heavy = u.isPlayer ? 1.2 + d.w * 0.15 : 2.2;
    return true;
  };

  // ---------- Револьвер ----------
  const GUN_FX = (u, x, h, z, a) => {
    if (!nearP(u.x, u.y, 45)) return;
    if (pwOk()) {
      J.Pw.orb(x, h, z, 0.22, '#fff2b0');
      J.Pw.glow(x, h, z, 6, '#ffd27a', 4, 0.05, 0.12, 0, 0.05);
      J.Pw.light(x, h, z, '#ffc870', 2.2, 7, 0.07);
      J.Pw.puff(x + Math.cos(a) * 0.15, h, z + Math.sin(a) * 0.15, Math.cos(a) * 0.8, 0.3, Math.sin(a) * 0.8, 0.9, 0.08, 0.35, '#c8c4bc', null, -0.2, 0.35, false);
    }
    if (J.Sfx && J.Sfx.shot) J.Sfx.shot(u.isPlayer ? 1.1 : 0.7);
  };
  H.reload = function (u) {
    const id = H.heldId(u);
    const d = H.def(id);
    if (!d || d.cls !== 'gun' || u.reloadT > 0) return false;
    const mag = H.magOf(u, id);
    if (mag >= d.mag) return false;
    if (u.isPlayer && cnt(u, d.ammo) <= 0) {
      say('noammo', 'Нет патронов! Купи коробку на чёрном рынке или подбери у бандитов.', 'red');
      if (J.Sfx && J.Sfx.click) J.Sfx.click();
      return false;
    }
    u.reloadT = d.reload;
    u.anim = { type: 'item', iclip: 'reload', t: d.reload, max: d.reload };
    if (u.isPlayer || nearP(u.x, u.y, 20)) snd('reload');
    if (u.isPlayer) J.R3.text(u.x, u.y, 'Перезарядка…', 'tmiss', d.reload, 2.4);
    return true;
  };
  function finishReload(u) {
    const id = H.heldId(u);
    const d = H.def(id);
    if (!d || d.cls !== 'gun') return;
    const mag = H.magOf(u, id);
    if (u.isPlayer) {
      const n = Math.min(d.mag - mag, cnt(u, d.ammo));
      if (n > 0) J.P.removeItem(u, d.ammo, n);
      setMag(u, id, mag + n);
    } else setMag(u, id, d.mag);
    H.dirty = true;
  }
  // линия выстрела: первая стена, машина или человек
  function hitscan(u, ang, maxD) {
    const g = G();
    const w = g.world;
    const ca = Math.cos(ang), sa = Math.sin(ang);
    let wallD = maxD;
    for (let s = 0.4; s < maxD; s += 0.25) {
      if (w.solid(u.x + ca * s, u.y + sa * s)) {
        wallD = s;
        break;
      }
    }
    let best = null, bd = wallD;
    for (const o of g.ents) {
      if (o === u || o.dead || (o.owner && J.ownerOf(o) === u)) continue;
      if (o.kind !== 'civ' && !J.hostile(u, o)) continue;
      if (o.st.invis > 0 && !(g.reveal > 0) && o.team === 'enemy') continue;
      const dx = o.x - u.x, dy = o.y - u.y;
      const t = dx * ca + dy * sa;
      if (t < 0.2 || t > bd) continue;
      const perp = Math.abs(-dx * sa + dy * ca);
      if (perp > o.r + 0.06) continue;
      bd = t;
      best = o;
    }
    let veh = null;
    if (pwOk() && J.Pw.vehAt && g.vehs && g.vehs.length) {
      for (let s = 0.6; s < bd; s += 0.3) {
        const v = J.Pw.vehAt(u.x + ca * s, u.y + sa * s, 0.05, u.inCar);
        if (v) {
          veh = v;
          bd = s;
          best = null;
          break;
        }
      }
    }
    return { o: best, d: bd, wall: !best && !veh && wallD < maxD, veh };
  }
  H.fire = function (u) {
    const g = G();
    const id = H.heldId(u);
    const d = H.def(id);
    if (!d || d.cls !== 'gun') return false;
    if (u.reloadT > 0 || !u.canAct() || u.channel || u.dash || (J.Cb && J.Cb.isDown(u))) return false;
    if (u.cds.item > 0) return false;
    const mag = H.magOf(u, id);
    if (mag <= 0) {
      if (!H.reload(u)) {
        if (J.Sfx && J.Sfx.click) J.Sfx.click();
        u.cds.item = 0.35;
      }
      return false;
    }
    setMag(u, id, mag - 1);
    u.cds.item = d.rate;
    u.aimT = 1.4;
    // прицел: камера (с лёгкой доводкой) или цель ИИ
    let ang;
    if (u.isPlayer) {
      const inp = J.Input;
      const base = inp.touch ? u.face : J.R3.cam.yaw;
      const tg = J.nearestHostile(u, 30, inp.touch ? 0.6 : 0.22, base);
      ang = tg ? Math.atan2(tg.y - u.y, tg.x - u.x) : base;
      const mv = Math.hypot(u.vx || 0, u.vy || 0);
      ang += (rnd() - 0.5) * (0.02 + mv * 0.012);
    } else ang = aimFor(u, 20).ang + (rnd() - 0.5) * 0.08;
    u.face = ang;
    u.anim = { type: 'item', iclip: 'shoot', t: 0.3, max: 0.3 };
    const hp = H.handPos(u);
    const mx = hp.x + Math.cos(ang) * 0.2, mz = hp.z + Math.sin(ang) * 0.2;
    GUN_FX(u, mx, hp.h + 0.03, mz, ang);
    if (u.isPlayer && fxOk()) J.Fx.trauma(0.12);
    J.scare(u.x, u.y, 25);
    // Секс Пистолз: пули с пинками к цели
    const pistols = u.stand && u.stand.id === 'sex_pistols' && u.standOut && !(u.st.silence > 0);
    let dmg = u.isPlayer ? d.dmg * (1 + u.stats.agi * 0.03) : u.dmg * (u.dmgMul || 1) * 1.6;
    if (pistols) {
      const pr = J.spawnProj(u, { ang, speed: 26, dmg: dmg * 1.15, range: 22, shape: 'bullet', color: '#ffe066', size: 0.12, homing: 3, stand: false, x: mx, y: mz });
      pr.kick = 1 + Math.floor((u.stand.lvl || 1) / 4);
      pr.knock = d.knock;
      pr.stun = d.stun;
      if (u.isPlayer && rnd() < 0.3) J.R3.text(mx, mz, J.R.pick(['Пас!', 'Йииха!', 'No.1, вперёд!']), 'tgold', 0.7);
    } else {
      const r = hitscan(u, ang, 32);
      const far = Math.max(0.5, 1 - Math.max(0, r.d - 12) / 40);
      // трассер (без урона): виден росчерк пули
      const tr = J.spawnProj(u, { ang, speed: 95, dmg: 0, range: r.d, shape: 'bullet', color: '#ffd27a', size: 0.07, ghost: true, x: mx, y: mz });
      tr.pierce = 99;
      const ex = u.x + Math.cos(ang) * r.d, ey = u.y + Math.sin(ang) * r.d;
      if (r.o) {
        if (r.o.kind === 'civ') {
          r.o.downT = 2.5;
          if (r.o.ai) r.o.ai.fear = 8;
          if (pwOk()) J.Pw.blood(r.o.x, gy(r.o.x, r.o.y) + 1.1, r.o.y, 8, ang, 2.5);
          if (u.isPlayer) {
            J.Veh.crime(1, u.x, u.y);
            say('civshot', 'Ты подстрелил прохожего! Полиция уже едет.', 'red');
          }
        } else if (J.hostile(u, r.o)) {
          const head = rnd() < 0.12;
          J.hurt(r.o, dmg * far * (head ? 1.8 : 1), u, { ang, knock: d.knock, stun: d.stun, crit: head, kind: 'phys', fxColor: '#ffd27a', gdmg: 30 });
          if (pwOk()) J.Pw.blood(r.o.x - Math.cos(ang) * 0.1, gy(r.o.x, r.o.y) + (head ? 1.6 : 1.15), r.o.y - Math.sin(ang) * 0.1, 10, ang, 3.5);
          if (head && u.isPlayer) J.R3.text(r.o.x, r.o.y, 'В ГОЛОВУ!', 'tcrit', 0.9, 2.4);
        }
      } else if (r.veh) {
        J.Pw.hitVeh(r.veh, dmg * 0.8, u, false, 0.5, ang);
        if (fxOk()) J.Fx.sparks(ex, gy(ex, ey) + 0.9, ey, 8, ang + Math.PI, '#ffd27a', 5);
        snd('ting', 0.6);
      } else if (r.wall) {
        if (fxOk()) J.Fx.sparks(ex - Math.cos(ang) * 0.1, hp.h, ey - Math.sin(ang) * 0.1, 8, ang + Math.PI, '#ffd27a', 5);
        if (pwOk()) J.Pw.puff(ex, hp.h, ey, 0, 0.4, 0, 0.8, 0.1, 0.35, '#a8a098', null, 0, 0.5, false);
        snd('ting', 0.4);
      }
    }
    // выстрел в городе — полиция слышит
    if (u.isPlayer && G().world.cityAt(u.x, u.y) && J.Veh && J.Veh.copNear) {
      H.shotsHeard = (H.shotsHeard || 0) + (J.Veh.copNear(u.x, u.y, 40) ? 0.5 : 0.18);
      if (H.shotsHeard >= 0.5) {
        J.Veh.crime(H.shotsHeard, u.x, u.y);
        H.shotsHeard = 0;
      }
    }
    if (u.isPlayer && H.magOf(u, id) === 0 && cnt(u, d.ammo) > 0) G().timers.push({ t: 0.25, fn: () => H.reload(u) });
    H.dirty = true;
    return true;
  };

  // ---------- Еда и питьё из руки ----------
  H.consume = function (p) {
    const id = H.heldId(p);
    const d = H.def(id);
    if (!d || d.cls !== 'food' || p.eat) return false;
    const it = J.ITEMS[id];
    if (it.type === 'food' && p.vampire && !p.ultimate) {
      say('vampfood', 'Ты вампир. Обычная еда не насыщает — нужна кровь.', 'red');
      return false;
    }
    if (it.type === 'blood' && !p.vampire) {
      say('notvamp', 'Пить кровь? Ты же не вампир...', 'muted');
      return false;
    }
    const T = d.drink ? 1.3 : it.type === 'heal' ? 1.6 : 1.5;
    p.eat = { id, t: T };
    p.anim = { type: 'item', iclip: it.type === 'heal' ? 'eat' : d.drink ? 'drink' : 'eat', t: T, max: T };
    return true;
  };
  function updateEat(p, dt) {
    const e = p.eat;
    if (!e) return;
    if (!p.canAct() || p.react || p.dash || p.guard || H.heldId(p) !== e.id) {
      p.eat = null;
      if (p.anim && p.anim.type === 'item') p.anim.t = 0;
      return;
    }
    e.t -= dt;
    if (e.t <= 0) {
      p.eat = null;
      J.P.useItem(p, e.id);
      H.dirty = true;
    }
  }

  // ---------- Действие ЛКМ с предметом ----------
  H.use = function (p) {
    const d = H.held(p);
    if (!d) return false;
    if (d.cls === 'gun') return H.fire(p);
    if (d.cls === 'food') return H.consume(p);
    return H.melee(p);
  };

  // ---------- Бросок ----------
  const throwSpeed = (u, d, k) => {
    const str = u.isPlayer ? u.stats.str : 3;
    return (12 + 0.7 * str) * ((d.thr && d.thr.speed) || 1) * J.clamp(1.15 - 0.12 * d.w, 0.5, 1.15) * (0.55 + 0.45 * k);
  };
  // угол возвышения, чтобы попасть в точку (низкая траектория); null — не долетит
  const solveElev = (dx, dh, v, g) => {
    const v2 = v * v;
    const disc = v2 * v2 - g * (g * dx * dx + 2 * dh * v2);
    if (disc < 0) return null;
    return Math.atan2(v2 - Math.sqrt(disc), g * dx);
  };
  // начальные условия броска
  const TH = { x: 0, h: 0, y: 0, vx: 0, vh: 0, vy: 0, tg: null };
  function throwInit(u, d, k, gf) {
    const v = throwSpeed(u, d, k);
    const hp = H.handPos(u);
    let ang, elev, tg = null;
    if (u.isPlayer) {
      const inp = J.Input;
      const base = inp.touch ? u.face : J.R3.cam.yaw;
      tg = J.nearestHostile(u, 16, inp.touch ? 0.9 : 0.4, base);
      ang = tg ? Math.atan2(tg.y - u.y, tg.x - u.x) : base;
      elev = J.clamp(0.16 + (0.24 - J.R3.cam.pitch) * 1.1, -0.2, 1.0);
    } else {
      tg = u.ai && u.ai.target;
      ang = tg ? Math.atan2(tg.y - u.y, tg.x - u.x) : u.face;
      elev = 0.25;
    }
    const sx = u.x + Math.cos(ang) * 0.35, sy = u.y + Math.sin(ang) * 0.35;
    const sh = Math.max(hp.h, gy(u.x, u.y) + (u.z || 0) + 1.35);
    if (tg && !tg.dead) {
      const dx = J.dist(sx, sy, tg.x, tg.y);
      const dh = gy(tg.x, tg.y) + (tg.z || 0) + 1.15 - sh;
      const e = solveElev(dx, dh, v, GRAV * gf);
      if (e !== null) elev = e;
      else elev = Math.PI / 4;
    }
    TH.x = sx;
    TH.y = sy;
    TH.h = sh;
    TH.vx = Math.cos(ang) * Math.cos(elev) * v;
    TH.vy = Math.sin(ang) * Math.cos(elev) * v;
    TH.vh = Math.sin(elev) * v;
    TH.tg = tg;
    TH.ang = ang;
    return TH;
  }
  // создать летящий предмет
  H.launch = function (owner, item, o) {
    const d = H.def(item);
    const thr = (d && d.thr) || {};
    const obj = {
      id: UID++, item, owner, team: owner.team, x: o.x, y: o.y, h: o.h, vx: o.vx, vy: o.vy, vh: o.vh,
      gf: o.gf !== undefined ? o.gf : 1, spin: o.spin !== undefined ? o.spin : thr.spin || 0, rot: 0,
      dmg: o.dmg, stick: o.stick !== undefined ? o.stick : thr.stick || 0, shatter: !!thr.shatter, ret: !!thr.ret,
      stun: thr.stun || (d && d.stun) || 0.2, w: d ? d.w : 0.5, blade: d && (d.cls === 'blade' || d.model === 'tknife'),
      v0: Math.hypot(o.vx, o.vy, o.vh), dur: o.dur, mag: o.mag, t: 0, tsAge: 0, held: false, thaw: 0,
      freezeNear: o.freezeNear || 0, tg: o.tg || null, stand: !!o.stand, hits: new Set(), mesh: H.mesh(d ? d.model : 'rock', false),
      trail: o.trail || 0, spinBall: !!o.spinBall,
    };
    R3.fxGroup.add(obj.mesh);
    FLY.push(obj);
    orientFly(obj);
    return obj;
  };
  // бросок рукой: k — сила замаха (0..1)
  H.throwFrom = function (u, k) {
    const id = H.heldId(u);
    const d = H.def(id);
    if (!d || d.cls === 'ammo') return false;
    if (!u.canAct() || u.channel || u.dash || (J.Cb && J.Cb.isDown(u)) || u.inCar) return false;
    if (u.cds.throw > 0) return false;
    if (u.isPlayer) {
      const cost = 4 + d.w * 4;
      if (u.stamina < cost) {
        say('tiredthr', 'Нет сил на бросок.', 'muted');
        return false;
      }
      u.stamina -= cost;
    }
    k = J.clamp(k === undefined ? 1 : k, 0.15, 1);
    const ti = throwInit(u, d, k, 1);
    u.face = ti.ang;
    const thr = d.thr || {};
    const str = u.isPlayer ? u.stats.str : 3;
    let dmg = (thr.dmg || 6) * (u.isPlayer ? 1 + str * 0.05 : (u.dmg * (u.dmgMul || 1)) / 10) * (0.6 + 0.4 * k);
    const spinBall = id === 'steel_ball' && u.spin;
    if (spinBall) dmg *= 1 + u.spin.lvl * 0.15;
    const o = { x: ti.x, y: ti.y, h: ti.h, vx: ti.vx, vy: ti.vy, vh: ti.vh, dmg, tg: ti.tg, spinBall };
    if (d.dur < 999) o.dur = H.durOf(u, id);
    if (d.cls === 'gun') o.mag = H.magOf(u, id);
    // в своём остановленном времени брошенное замирает в воздухе
    const obj = H.launch(u, id, o);
    if (u.isPlayer) {
      J.P.removeItem(u, id);
      delete u.dur[id];
      if (d.cls === 'gun' && cnt(u, id) <= 0) delete u.mag[id];
      J.P.trainStat(u, 'agi', 0.2);
    } else {
      u.hand = null;
      u.hdur = undefined;
    }
    u.anim = { type: 'item', iclip: 'throw', t: 0.42, max: 0.42 };
    u.anim.t = 0.42 * 0.45; // момент отпускания уже позади
    u.cds.throw = 0.35;
    if (J.Sfx && J.Sfx.whoosh) J.Sfx.whoosh(0.16, true, 0.08 + 0.06 * k);
    H.dirty = true;
    return obj;
  };
  // прицеливание (B / средняя кнопка / кнопка «Бросок»)
  H.aimStart = function (p) {
    if (!p || p.inCar || p.dead) return;
    const id = H.heldId(p);
    if (!id) {
      say('noitem', 'В руке ничего нет. Выбери предмет клавишами 4–9 или колёсиком.', 'muted');
      return;
    }
    if (H.def(id).cls === 'ammo') return;
    if (!p.canAct()) return;
    p.thrAim = { t: 0 };
    p.eat = null;
  };
  H.aimRelease = function (p) {
    if (!p || !p.thrAim) return;
    const k = J.clamp(p.thrAim.t / 0.6, 0, 1);
    p.thrAim = null;
    H.throwFrom(p, 0.25 + 0.75 * k);
  };

  // ---------- Физика летящих предметов ----------
  const QY = new THREE.Quaternion();
  function orientFly(o) {
    const m = o.mesh;
    let dx = o.vx, dh = o.vh, dz = o.vy;
    if (o.held && o.tg && !o.tg.dead) {
      // зависший нож смотрит на цель
      dx = o.tg.x - o.x;
      dz = o.tg.y - o.y;
      dh = gy(o.tg.x, o.tg.y) + 1.1 - o.h;
    }
    const hor = Math.hypot(dx, dz) || 1e-4;
    m.position.set(o.x, o.h, o.y);
    m.rotation.set(-Math.atan2(dh, hor) + o.rot, Math.atan2(dx, dz), o.blade ? HALF : o.rot * 0.15);
  }
  const SPEED_STOP = 0.5;
  function flyStep(o, dt) {
    const g = G();
    const w = g.world;
    o.t += dt;
    o.vh -= GRAV * o.gf * dt;
    if (o.ret && o.t > 0.25 && (o.returning || o.t > 1.1)) {
      // шар возвращается в руку
      o.returning = true;
      const u = o.owner;
      if (!u || u.dead) o.ret = false;
      else {
        const hp = H.handPos(u);
        const dx = hp.x - o.x, dz = hp.z - o.y, dh = hp.h - o.h;
        const L = Math.hypot(dx, dz, dh) || 1;
        const sp = 16;
        o.vx = lerp(o.vx, (dx / L) * sp, Math.min(1, dt * 8));
        o.vy = lerp(o.vy, (dz / L) * sp, Math.min(1, dt * 8));
        o.vh = lerp(o.vh, (dh / L) * sp, Math.min(1, dt * 8));
        if (L < 0.5) {
          catchBack(o);
          return false;
        }
      }
    }
    const sp = Math.hypot(o.vx, o.vy, o.vh);
    const n = Math.max(1, Math.ceil((sp * dt) / 0.2));
    const sdt = dt / n;
    for (let i = 0; i < n; i++) {
      const px = o.x, py = o.y;
      o.x += o.vx * sdt;
      o.y += o.vy * sdt;
      o.h += o.vh * sdt;
      o.rot += o.spin * sdt;
      // люди
      for (const e of g.ents) {
        if (e.dead || e === o.owner || o.hits.has(e.id) || (e.owner && J.ownerOf(e) === o.owner)) continue;
        const civ = e.kind === 'civ';
        if (!civ && !J.hostile(o, e)) continue;
        const dx = e.x - o.x, dy = e.y - o.y;
        if (dx * dx + dy * dy > (e.r + 0.18) * (e.r + 0.18)) continue;
        const g0 = gy(e.x, e.y) + (e.z || 0);
        if (o.h < g0 + 0.05 || o.h > g0 + 1.9 * (e.scale || 1)) continue;
        o.hits.add(e.id);
        if (hitEnt(o, e, civ)) return false;
      }
      // стены
      if (w.solid(o.x, o.y) && !w.isWater(o.x, o.y) && o.h < gy(o.x, o.y) + 12) {
        o.x = px;
        o.y = py;
        return hitWall(o);
      }
      // машины
      if (pwOk() && J.Pw.vehAt && g.vehs && g.vehs.length && o.h < gy(o.x, o.y) + 1.6) {
        const v = J.Pw.vehAt(o.x, o.y, 0.1, o.owner && o.owner.inCar);
        if (v) {
          J.Pw.hitVeh(v, o.dmg * 0.6, o.owner, false, 0.5, Math.atan2(o.vy, o.vx));
          o.x = px;
          o.y = py;
          return hitWall(o, true);
        }
      }
      // земля / вода
      const g1 = gy(o.x, o.y);
      if (o.h <= g1 + 0.02) {
        o.h = g1 + 0.02;
        if (w.isWater(o.x, o.y)) {
          if (pwOk() && nearP(o.x, o.y, 30)) J.Pw.puff(o.x, g1 + 0.1, o.y, 0, 1.5, 0, 0.5, 0.15, 0.3, '#cfe8ff', null, 4, 0.7, false);
          if (o.ret) return catchBack(o), false;
          return false; // утонуло
        }
        return hitGround(o);
      }
    }
    if (o.t > 8) return toGround(o), false;
    return true;
  }
  // эффекты попадания летящего
  function shatterFx(o) {
    if (!nearP(o.x, o.y, 35)) return;
    if (pwOk()) {
      J.Pw.shards(o.x, o.h, o.y, 16, '#7fd08a', 3.5, 0.025, 0, Math.atan2(o.vy, o.vx), 1.6, 9, 1);
      J.Pw.glow(o.x, o.h, o.y, 5, '#d8ffe0', 2, 0.04, 0.25, 1, 0.1);
    }
    if (J.Sfx && J.Sfx.glass) J.Sfx.glass();
  }
  function hitEnt(o, e, civ) {
    const ang = Math.atan2(o.vy, o.vx);
    const sp = Math.hypot(o.vx, o.vy, o.vh);
    const sk = J.clamp(sp / Math.max(1, o.v0), 0.5, 1.15);
    if (civ) {
      e.downT = 1.6;
      if (e.ai) e.ai.fear = 7;
      J.R3.text(e.x, e.y, J.R.pick(['Ай!', 'Ты что творишь?!']), 'tsay', 0.9);
      if (o.owner && o.owner.isPlayer && J.Veh && J.Veh.crime) J.Veh.crime(0.5, e.x, e.y);
      if (o.shatter) return shatterFx(o), true;
      bounceOff(o, e);
      return false;
    }
    // клинок: воткнётся остриём — или ударит рукоятью
    let stuck = false, dmg = o.dmg * sk;
    const fx = {};
    if (o.blade) {
      const ph = ((o.rot % TAU) + TAU) % TAU;
      const pointFirst = o.spin === 0 || ph < 0.9 || ph > TAU - 0.9;
      stuck = o.stand || (pointFirst && rnd() < Math.max(o.stick, 0.25)) || rnd() < o.stick * 0.5;
      if (stuck) fx.bleed = 3;
      else dmg *= 0.35;
    }
    const kn = 1.2 + o.w * 1.1 + (o.stand ? 1.5 : 0);
    J.hurt(e, dmg, o.owner, { ang, knock: kn, stun: o.blade && !stuck ? 0.12 : o.stun, kind: 'phys', fx: fx.bleed ? fx : undefined, fxColor: o.blade ? '#c4283c' : null, gdmg: 12 + o.w * 10 });
    const near = nearP(o.x, o.y, 35);
    if (near && o.blade && stuck) {
      snd('slash', 0.8);
      if (pwOk()) J.Pw.blood(o.x, o.h, o.y, 7, ang, 2.5);
    } else if (near) snd(o.blade ? 'ting' : 'wood', 0.8);
    if (o.spinBall && pwOk()) J.Pw.glow(o.x, o.h, o.y, 12, '#ffd84a', 3, 0.08, 0.5, 0, 0.2);
    if (o.shatter) {
      shatterFx(o);
      if (o.owner && o.owner.isPlayer) J.R3.text(e.x, e.y, 'ДЗЫНЬ!', 'tcry', 0.7);
      return true;
    }
    if (o.dur !== undefined) {
      o.dur -= 1;
      if (o.dur <= 0) {
        if (pwOk() && near) J.Pw.shards(o.x, o.h, o.y, 6, '#dfe5ec', 2, 0.025, 1, ang, 1, 9, 0.8);
        return true;
      }
    }
    if (o.ret) {
      o.returning = true;
      o.vx *= -0.3;
      o.vy *= -0.3;
      return false;
    }
    if (stuck && !e.dead) {
      // нож торчит в теле, потом выпадает
      o.stuckTo = e;
      o.stuckA = J.angDiff(e.face, ang + Math.PI);
      o.stuckH = J.clamp(o.h - gy(e.x, e.y) - (e.z || 0), 0.5, 1.6);
      o.stuckT = 0;
      return false;
    }
    bounceOff(o, e);
    return false;
  }
  function bounceOff(o, e) {
    const a = Math.atan2(o.y - e.y, o.x - e.x);
    const sp = Math.hypot(o.vx, o.vy) * 0.2;
    o.vx = Math.cos(a) * sp;
    o.vy = Math.sin(a) * sp;
    o.vh = Math.max(o.vh * 0.2, 1);
    o.spin *= 0.5;
  }
  function hitWall(o, car) {
    const near = nearP(o.x, o.y, 35);
    if (o.shatter) {
      shatterFx(o);
      return false;
    }
    const sp = Math.hypot(o.vx, o.vy);
    const ang = Math.atan2(o.vy, o.vx);
    if (o.ret) {
      o.returning = true;
      return true;
    }
    if (o.blade && !car && sp > 7 && (o.stand || o.spin === 0 || rnd() < o.stick)) {
      // воткнулся в стену — торчит, можно вытащить
      if (near) snd('ting', 0.9);
      if (fxOk() && near) J.Fx.sparks(o.x, o.h, o.y, 4, ang + Math.PI, '#ffd27a', 3);
      const gi = H.spawnGround(o.x - Math.cos(ang) * 0.02, o.y - Math.sin(ang) * 0.02, o.item, 1, { dur: o.dur, h: o.h, yaw: Math.atan2(o.vx, o.vy), pitch: -Math.atan2(o.vh, sp) * 0.5, roll: HALF });
      if (gi) gi.stuck = true;
      return false;
    }
    if (near) {
      snd(o.blade || o.w > 1.2 ? 'clang' : 'wood', 0.6);
      if (fxOk() && sp > 6) J.Fx.sparks(o.x, o.h, o.y, 5, ang + Math.PI, o.blade ? '#ffd27a' : '#c8b8a0', 3);
    }
    // отскок от стены
    o.vx *= -0.25;
    o.vy *= -0.25;
    o.vh *= 0.4;
    o.spin *= -0.5;
    o.hits.clear();
    if (sp < SPEED_STOP) return toGround(o), false;
    return true;
  }
  function hitGround(o) {
    const sp = Math.hypot(o.vx, o.vy, o.vh);
    const near = nearP(o.x, o.y, 35);
    if (o.shatter) {
      shatterFx(o);
      return false;
    }
    if (o.ret) {
      o.returning = true;
      o.vh = Math.abs(o.vh) * 0.4 + 1;
      return true;
    }
    // клинок втыкается в землю, если падает остриём
    if (o.blade && sp > 6 && o.vh < -2 && (o.spin === 0 || rnd() < o.stick * 0.8)) {
      if (near) snd('ting', 0.5);
      const gi = H.spawnGround(o.x, o.y, o.item, 1, { dur: o.dur, h: gy(o.x, o.y) + 0.06, yaw: Math.atan2(o.vx, o.vy), pitch: 1.0, roll: HALF });
      if (gi) gi.stuck = true;
      return false;
    }
    if (sp > 3 && !o.bounced) {
      o.bounced = true;
      o.vh = Math.abs(o.vh) * 0.25;
      o.vx *= 0.45;
      o.vy *= 0.45;
      o.spin *= 0.4;
      if (near) {
        snd(o.blade || o.w > 1.2 ? 'clang' : 'wood', 0.4);
        if (fxOk()) J.Fx.dust(o.x, o.y, 2, 0.15);
      }
      return true;
    }
    toGround(o);
    return false;
  }
  function toGround(o) {
    H.spawnGround(o.x, o.y, o.item, 1, { dur: o.dur, mag: o.mag, yaw: Math.atan2(o.vx, o.vy) + (rnd() - 0.5) });
  }
  function catchBack(o) {
    const u = o.owner;
    if (u && u.isPlayer) {
      J.P.addItem(u, o.item, 1, null, true);
      H.dirty = true;
    } else if (u && !u.dead) u.hand = o.item;
  }
  function removeFly(o) {
    R3.fxGroup.remove(o.mesh);
  }
  function updateFly(dt) {
    const g = G();
    const ts = g.timestop;
    for (let i = FLY.length - 1; i >= 0; i--) {
      const o = FLY[i];
      // торчит в теле
      if (o.stuckTo) {
        const e = o.stuckTo;
        o.stuckT += dt;
        if (e.dead && (e.deadT > 2.5 || !g.ents.includes(e)) || o.stuckT > 3.5 || !g.ents.includes(e)) {
          o.x = e.x + Math.cos(e.face) * 0.4;
          o.y = e.y + Math.sin(e.face) * 0.4;
          toGround(o);
          removeFly(o);
          FLY.splice(i, 1);
          continue;
        }
        const a = e.face + o.stuckA;
        o.x = e.x + Math.cos(a) * (e.r * 0.85);
        o.y = e.y + Math.sin(a) * (e.r * 0.85);
        o.h = gy(e.x, e.y) + (e.z || 0) + o.stuckH;
        o.vx = -Math.cos(a);
        o.vy = -Math.sin(a);
        o.vh = -0.25;
        o.rot = 0;
        orientFly(o);
        continue;
      }
      // остановка времени: чужое замирает, своё летит миг и зависает (или зависает перед целью)
      if (ts) {
        const own = o.owner;
        const mine = own === ts.by || (own && own.isPlayer && own.tsMove > 0);
        if (!mine) {
          orientFly(o);
          continue;
        }
        o.tsAge += dt;
        if (!o.held) {
          const tg = o.tg && !o.tg.dead ? o.tg : null;
          if (o.freezeNear ? tg && J.dist(o.x, o.y, tg.x, tg.y) < o.freezeNear : o.tsAge > 0.12) {
            o.held = true;
            if (pwOk()) J.Pw.glow(o.x, o.h, o.y, 3, '#ffffff', 1, 0.05, 0.3, 0);
          }
        }
        if (o.held) {
          // повернуть скорость на цель, чтобы сорвался точно в неё
          const tg = o.tg && !o.tg.dead ? o.tg : null;
          if (tg) {
            const sp = Math.max(14, Math.hypot(o.vx, o.vy, o.vh));
            const dx = tg.x - o.x, dz = tg.y - o.y, dh = gy(tg.x, tg.y) + 1.1 - o.h;
            const L = Math.hypot(dx, dz, dh) || 1;
            o.vx = (dx / L) * sp;
            o.vy = (dz / L) * sp;
            o.vh = (dh / L) * sp;
            o.gf = 0.05;
            o.spin = 0;
            o.rot = 0;
          }
          orientFly(o);
          if (pwOk() && nearP(o.x, o.y, 40)) {
            // застывший росчерк полёта позади ножа и блик на острие
            const sp = Math.hypot(o.vx, o.vy, o.vh) || 1;
            const ux = o.vx / sp, uh = o.vh / sp, uz = o.vy / sp;
            J.Pw.gseg(o.x - ux * 0.75, o.h - uh * 0.75, o.y - uz * 0.75, o.x - ux * 0.1, o.h - uh * 0.1, o.y - uz * 0.1, 0.006, '#e8f0ff');
            if (rnd() < 0.06) J.Pw.orb(o.x + ux * 0.12, o.h + uh * 0.12, o.y + uz * 0.12, 0.04 + rnd() * 0.05, '#ffffff');
          }
          continue;
        }
      } else if (o.held) {
        o.held = false;
        o.thaw = 0.2;
      }
      if (o.thaw > 0) {
        o.thaw -= dt;
        orientFly(o);
        o.mesh.position.x += (rnd() - 0.5) * 0.04;
        continue;
      }
      const alive = flyStep(o, dt);
      if (!alive) {
        removeFly(o);
        FLY.splice(i, 1);
        continue;
      }
      orientFly(o);
      // след брошенного стендом
      if (o.trail && pwOk() && nearP(o.x, o.y, 40)) {
        const L = 0.6;
        const sp = Math.hypot(o.vx, o.vy, o.vh) || 1;
        J.Pw.gseg(o.x - (o.vx / sp) * L, o.h - (o.vh / sp) * L, o.y - (o.vy / sp) * L, o.x, o.h, o.y, 0.02, o.trail);
      }
      if (o.spinBall && pwOk() && rnd() < 0.6) J.Pw.glow(o.x, o.h, o.y, 1, '#ffd84a', 0.6, 0.06, 0.3, 0, 0.05);
    }
  }

  // ---------- Предварительный просмотр дуги ----------
  let ARC = null;
  const ARCN = 40;
  function arcInit() {
    if (ARC) return ARC;
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(ARCN * 3), 3));
    const line = new THREE.Line(geo, new THREE.LineDashedMaterial({ color: '#ffffff', transparent: true, opacity: 0.85, dashSize: 0.18, gapSize: 0.12, depthWrite: false }));
    line.frustumCulled = false;
    line.renderOrder = 5;
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.22, 0.3, 24).rotateX(-HALF), new THREE.MeshBasicMaterial({ color: '#ffe066', transparent: true, opacity: 0.85, depthWrite: false, side: THREE.DoubleSide }));
    ring.renderOrder = 5;
    R3.fxGroup.add(line);
    R3.fxGroup.add(ring);
    line.visible = ring.visible = false;
    ARC = { line, ring, geo };
    return ARC;
  }
  function showArc(p, k) {
    const A = arcInit();
    const id = H.heldId(p);
    const d = H.def(id);
    if (!d) {
      A.line.visible = A.ring.visible = false;
      return;
    }
    const ti = throwInit(p, d, k, 1);
    const pos = A.geo.attributes.position.array;
    const w = G().world;
    let x = ti.x, y = ti.y, h = ti.h, vx = ti.vx, vy = ti.vy, vh = ti.vh;
    const dt = 0.035;
    let n = 0, hit = false;
    for (; n < ARCN; n++) {
      pos[n * 3] = x;
      pos[n * 3 + 1] = h;
      pos[n * 3 + 2] = y;
      if (hit) continue;
      vh -= GRAV * dt;
      x += vx * dt;
      y += vy * dt;
      h += vh * dt;
      const g1 = gy(x, y);
      if (h <= g1 + 0.02 || w.solid(x, y)) {
        hit = true;
        if (h < g1) h = g1 + 0.02;
      }
    }
    A.geo.attributes.position.needsUpdate = true;
    A.line.computeLineDistances();
    A.line.visible = true;
    A.ring.position.set(x, Math.max(gy(x, y), h - 0.5) + 0.05, y);
    A.ring.visible = true;
    A.ring.material.color.set(ti.tg ? '#ff5d73' : '#ffe066');
  }
  function hideArc() {
    if (ARC) ARC.line.visible = ARC.ring.visible = false;
  }

  // ---------- Передать стенду ----------
  // может ли стенд метать вещи: нужна скорость и точность (человекоподобный стенд)
  const NOHAND = { tiny: 1, plane: 1, bug: 1, none: 1, cloud: 1 };
  H.standCap = function (u) {
    if (!u.stand) return null;
    const sd = J.STANDS[u.stand.id];
    if (sd.id === 'sex_pistols') return { pistols: true };
    if (NOHAND[sd.head]) return null;
    const r = J.rankNum;
    const sc = r(sd.st.spd) + r(sd.st.pre);
    if (sc < 8) return null;
    return { n: 2 + Math.floor(sc / 3.4), spd: 20 + r(sd.st.spd) * 3, pre: r(sd.st.pre), flick: sd.id === 'star_platinum' || sd.id === 'star_platinum_tw', sd };
  };
  H.give = function (p) {
    if (!p || p.inCar || p.dead) return false;
    const id = H.heldId(p);
    if (!id) {
      say('noitem', 'В руке ничего нет — стенду нечего передать.', 'muted');
      return false;
    }
    if (!p.stand) {
      say('nostand', 'У тебя нет стенда.', 'muted');
      return false;
    }
    if (p.st.silence > 0) {
      say('silence', 'Стенд заблокирован!', 'red');
      return false;
    }
    if (!p.canAct() || p.channel || p.dash) return false;
    if (p.cds.give > 0) return false;
    const d = H.def(id);
    const cap = H.standCap(p);
    const sd = J.STANDS[p.stand.id];
    if (cap && cap.pistols) {
      if (d.cls !== 'gun') return say('pistolsno', 'Секс Пистолз умеют только пинать пули. Возьми револьвер.', 'muted', 3000), false;
      return pistolsVolley(p, id, d);
    }
    if (!cap) return say('weak', `«${sd.ru}» не хватает скорости и точности, чтобы метать вещи.`, 'muted', 3000), false;
    if (d.cls === 'gun' || d.cls === 'food') return say('nogive', d.cls === 'gun' ? 'Стенд не стреляет из револьвера — стреляй сам.' : 'Это не метают.', 'muted'), false;
    if (p.se < 6) return say('nose', 'Не хватает энергии стенда.', 'muted'), false;
    p.standOut = true;
    const g = G();
    const aim = J.P.aim(p, 18);
    const tg = aim.target;
    p.face = aim.ang;
    // Звёздная Платина: щелчок подшипника — пуля
    if (cap.flick && (id === 'ball_bearings' || id === 'rock' || id === 'coins')) {
      p.se -= 6;
      p.cds.give = 0.45;
      p.anim = { type: 'punch', t: 0.22, max: 0.22, stand: true, tgt: tg };
      J.P.removeItem(p, id);
      g.timers.push({
        t: 0.1,
        fn: () => {
          const hp = H.handPos(p, true);
          const a = tg && !tg.dead ? Math.atan2(tg.y - hp.z, tg.x - hp.x) : p.face;
          const pr = J.spawnProj(p, { ang: a, speed: 42, dmg: (id === 'rock' ? 46 : 38) * J.P.standPower(p), range: 26, shape: 'bullet', color: '#ffffff', size: id === 'rock' ? 0.16 : 0.1, pierce: id === 'rock' ? 0 : 2, stand: true, x: hp.x, y: hp.z });
          pr.knock = id === 'rock' ? 7 : 3;
          pr.stun = 0.4;
          pr.h = J.clamp(hp.h - gy(hp.x, hp.z), 0.9, 1.5);
          if (fxOk()) {
            J.Fx.word('ピシッ', p.x + Math.cos(a), p.y + Math.sin(a), gy(p.x, p.y) + 1.8, 'mid', '#ffffff', '#3a2a7a');
            J.Fx.trauma(0.2);
          }
          if (pwOk()) J.Pw.glow(hp.x, hp.h, hp.z, 6, '#c7b6ff', 3, 0.06, 0.2);
          if (J.Sfx && J.Sfx.shot) J.Sfx.shot(0.8);
        },
      });
      J.P.standXp(p, 2);
      H.dirty = true;
      return true;
    }
    // метание веером: стенд забирает до N штук
    const stackable = J.ITEMS[id].stack && (d.cls === 'throw' || d.model === 'tknife');
    const n = Math.min(stackable ? cap.n : 1, cnt(p, id));
    const cost = 4 + n * 2;
    if (p.se < cost) return say('nose', 'Не хватает энергии стенда.', 'muted'), false;
    p.se -= cost;
    p.cds.give = 0.6;
    const ts = g.timestop && g.timestop.by === p;
    const durs = [];
    for (let i = 0; i < n; i++) {
      durs.push(d.dur < 999 ? H.durOf(p, id) : undefined);
      J.P.removeItem(p, id);
      delete p.dur[id];
    }
    // стенд берёт вещи в руку и замахивается
    p.anim = { type: 'punch', t: 0.34, max: 0.34, stand: true, tgt: tg };
    const sv = p.standView;
    let gift = null;
    if (sv && sv.foreR) {
      gift = H.mesh(n >= 3 && d.model === 'tknife' ? 'tknife3' : d.model, true);
      gift.position.set(0, -0.3, 0.03);
      gift.rotation.x = 1.2;
      sv.foreR.add(gift);
    }
    if (fxOk()) J.Fx.word(n > 2 ? 'シュバババッ' : 'シュッ', p.x, p.y, gy(p.x, p.y) + 2.1, n > 2 ? 'big' : 'mid', sd.c1, '#1a0a2a');
    g.timers.push({
      t: 0.17,
      fn: () => {
        if (gift && gift.parent) gift.parent.remove(gift);
        const hp = H.handPos(p, true);
        const sx = hp.x, sy = hp.z, sh = J.clamp(hp.h, gy(p.x, p.y) + 1.2, gy(p.x, p.y) + 2.1);
        const T = tg && !tg.dead ? tg : null;
        const base = T ? Math.atan2(T.y - sy, T.x - sx) : p.face;
        const pw = J.P.standPower(p);
        // веер шириной ~0.8 м у цели (все ножи в тело), без цели — шире
        const dist = T ? Math.max(1.5, J.dist(sx, sy, T.x, T.y)) : 0;
        const spread = n > 1 ? (T ? Math.min(0.5, 2 * Math.atan(0.4 / dist)) : 0.4) : 0;
        for (let i = 0; i < n; i++) {
          const a = base + (n > 1 ? spread * (i / (n - 1) - 0.5) : 0) + (rnd() - 0.5) * Math.max(0.01, 0.08 - cap.pre * 0.015);
          const v = cap.spd;
          let elev = 0.02;
          if (T) {
            const dx = J.dist(sx, sy, T.x, T.y), dh = gy(T.x, T.y) + 1.1 - sh;
            const e = solveElev(dx, dh, v, GRAV * 0.3);
            if (e !== null) elev = e;
          }
          const o = H.launch(p, id, {
            x: sx, y: sy, h: sh + (i % 2) * 0.08, vx: Math.cos(a) * Math.cos(elev) * v, vy: Math.sin(a) * Math.cos(elev) * v, vh: Math.sin(elev) * v,
            gf: 0.3, spin: d.model === 'tknife' || d.cls === 'blade' ? 0 : (d.thr && d.thr.spin) || 6, dmg: ((d.thr && d.thr.dmg) || 8) * pw * 1.5, stick: 1, stand: true, tg: T,
            freezeNear: ts ? 1.4 + (i % 3) * 0.25 : 0, trail: sd.c1, dur: durs[i],
          });
          o.tsAge = 0;
        }
        if (J.Sfx && J.Sfx.whoosh) J.Sfx.whoosh(0.2, true, 0.12);
        if (pwOk()) J.Pw.glow(hp.x, hp.h, hp.z, 8, sd.c1, 3, 0.07, 0.25);
        if (ts) J.R3.text(p.x, p.y, 'Ножи зависли в воздухе…', 'tgold', 1.2, 2.6);
      },
    });
    J.P.standXp(p, 2 + n);
    H.dirty = true;
    return true;
  };
  // Секс Пистолз: весь барабан — пулями с пинками
  function pistolsVolley(p, id, d) {
    const mag = H.magOf(p, id);
    if (mag <= 0) {
      H.reload(p);
      return false;
    }
    if (p.cds.give > 0 || p.reloadT > 0) return false;
    p.cds.give = 1.4;
    p.standOut = true;
    J.UI.toast('«Пистолз, вперёд!» — каждая пуля под пинками маленьких стендов.', 'gold');
    const g = G();
    for (let i = 0; i < mag; i++) {
      g.timers.push({
        t: i * 0.13,
        fn: () => {
          if (p.dead || H.heldId(p) !== id || H.magOf(p, id) <= 0) return;
          const tg = J.nearestHostile(p, 25);
          const a = tg ? Math.atan2(tg.y - p.y, tg.x - p.x) + (rnd() - 0.5) * 0.6 : p.face + (rnd() - 0.5) * 0.5;
          setMag(p, id, H.magOf(p, id) - 1);
          p.face = a;
          p.aimT = 1;
          p.anim = { type: 'item', iclip: 'shoot', t: 0.12, max: 0.12 };
          const hp = H.handPos(p);
          GUN_FX(p, hp.x + Math.cos(a) * 0.2, hp.h, hp.z + Math.sin(a) * 0.2, a);
          const pr = J.spawnProj(p, { ang: a, speed: 24, dmg: d.dmg * 1.3 * (1 + (p.stand.lvl || 1) * 0.06), range: 20, shape: 'bullet', color: '#fff6b0', size: 0.13, homing: 7, x: hp.x, y: hp.z });
          pr.kick = 3;
          pr.knock = d.knock;
          H.dirty = true;
        },
      });
    }
    J.P.standXp(p, 4);
    return true;
  }

  // ---------- Враги с оружием ----------
  const THUG_W = ['bat', 'pipe', 'kitchen_knife', 'bottle', 'bottle', 'brick', 'switchblade'];
  H.arm = function (e) {
    if (!e || e.isPlayer || e.hand !== undefined) return;
    e.hand = null;
    if (e.model) return;
    if (e.mobType === 'thug' && rnd() < 0.6) e.hand = J.R.pick(THUG_W);
    else if (e.gun) e.hand = 'revolver';
    else if (e.mobType === 'bandit' && rnd() < 0.3) e.hand = 'revolver';
  };
  const OTHROW = { bottle: 1, brick: 1, rock: 1, broken_bottle: 0 };
  function npcTick(e, dt) {
    if (e.aimT > 0) e.aimT -= dt;
    if (e.reloadT > 0) {
      e.reloadT -= dt;
      if (e.reloadT <= 0) finishReload(e);
    }
    if (e.hand === undefined && e.bossKey === 'dio') e.hand = 'throw_knife';
    if (!e.hand || !e.ai || !e.ai.target || e.dead || e.summon) return;
    // бросок бутылки или кирпича издалека
    if (OTHROW[e.hand] && e.canAct() && !e.atk && !e.dash && !e.channel && !(e.ai.rec > 0) && !(J.Cb && J.Cb.isDown(e))) {
      const tg = e.ai.target;
      const d = J.dist(e.x, e.y, tg.x, tg.y);
      if (d > 3.5 && d < 10 && rnd() < dt * 0.6) {
        const id = e.hand;
        e.face = Math.atan2(tg.y - e.y, tg.x - e.x);
        J.Cb.attack(e, { clip: null, type: 'item', dur: 0.62, at: 0.34, kind: 'shot', glint: true, ai: true, tg, fn: () => { if (e.hand === id) H.throwFrom(e, 0.85); } });
        e.anim.iclip = 'throw';
        e.ai.rec = 0.9;
      }
    }
  }

  // ---------- Полиция и оружие на виду ----------
  function policeTick(p, dt) {
    H._polT = (H._polT || 0) - dt;
    if (H._polT > 0) return;
    H._polT = 0.5;
    const d = H.held(p);
    const armed = d && WEAPON[d.cls] && d.model !== 'bearing' && d.model !== 'rock' && d.model !== 'coin';
    if (!armed || p.inCar || !G().world.cityAt(p.x, p.y) || !J.Veh || !J.Veh.copNear) {
      p.copSeen = Math.max(0, (p.copSeen || 0) - 1);
      return;
    }
    if (!J.Veh.copNear(p.x, p.y, d.cls === 'gun' ? 22 : 14)) {
      p.copSeen = Math.max(0, (p.copSeen || 0) - 0.5);
      return;
    }
    p.copSeen = (p.copSeen || 0) + 0.5;
    if (p.copSeen >= 1 && p.copSeen < 1.5) say('copwarn', `Полицейский: «Эй ты! Убери ${d.cls === 'gun' ? 'пистолет' : 'оружие'}, живо!» (0 — убрать в карман)`, 'red', 15000);
    if (p.copSeen >= 6) {
      p.copSeen = 1.5;
      if ((p.wanted || 0) < 1) J.Veh.crime(d.cls === 'gun' ? 1.1 : 0.7, p.x, p.y);
    }
  }

  // ---------- Вещи на улицах ----------
  const LOOT = {
    bar: [['bottle', 0.75], ['broken_bottle', 0.15]],
    restaurant: [['bottle', 0.5], ['kitchen_knife', 0.22]],
    trussardi: [['kitchen_knife', 0.4], ['bottle', 0.4]],
    shop: [['bottle', 0.4], ['brick', 0.1]],
    kame_yu: [['bottle', 0.4]],
    dock: [['pipe', 0.55], ['brick', 0.35], ['rock', 0.2]],
    school: [['bat', 0.15], ['rock', 0.2]],
    gym: [['bat', 0.2]],
    house: [['brick', 0.1], ['bottle', 0.08], ['rock', 0.06], ['pipe', 0.04], ['road_sign', 0.025]],
    office: [['brick', 0.08], ['road_sign', 0.04]],
    station: [['bottle', 0.3], ['road_sign', 0.08]],
    hotel: [['bottle', 0.25]],
    casino: [['bottle', 0.3], ['coins', 0.3]],
    hospital: [['bandage', 0.2]],
    dig: [['pipe', 0.45], ['brick', 0.35], ['rock', 0.2]],
    farm: [['pipe', 0.3], ['rock', 0.3]],
    black_market: [['switchblade', 0.15], ['bottle', 0.4]],
    police: [['road_sign', 0.12]],
    church: [['rock', 0.1]],
    library: [['brick', 0.08]],
  };
  const lootDone = new Set();
  function lootTick(p) {
    const g = G();
    const w = g.world;
    H._lootT = (H._lootT || 0) - 1;
    if (H._lootT > 0) return;
    H._lootT = 45;
    // далеко — убрать
    for (let i = GROUND.length - 1; i >= 0; i--) {
      const gi = GROUND[i];
      if (gi.loot && J.dist(gi.x, gi.y, p.x, p.y) > 75) removeGround(gi);
    }
    if (p.inCar || !w.cityAt(p.x, p.y)) return;
    let n = 0;
    for (const gi of GROUND) if (gi.loot) n++;
    if (n >= 14) return;
    for (const b of w.buildings) {
      if (n >= 14) break;
      const L = LOOT[b.type];
      if (!L || !b.door) continue;
      const dx = b.door.x - p.x, dy = b.door.y - p.y;
      if (dx * dx + dy * dy > 42 * 42 || dx * dx + dy * dy < 9 * 9) continue;
      const key = b.id + '@' + g.day;
      if (lootDone.has(key)) continue;
      lootDone.add(key);
      const h = J.hash2(b.id, g.day, 7177);
      let acc = 0, item = null;
      for (const [id, c] of L) {
        acc += c;
        if (h < acc) {
          item = id;
          break;
        }
      }
      if (!item) continue;
      // у стены рядом с дверью (задний двор кухни, урна у бара)
      const side = (J.hash2(b.id, g.day, 991) < 0.5 ? -1 : 1) * (1.2 + J.hash2(b.id, 3, g.day) * 1.6);
      const q = J.doorPt(b, 1.05, side);
      if (w.solid(q.x, q.y) || w.isWater(q.x, q.y)) continue;
      H.spawnGround(q.x, q.y, item, 1, { loot: true, yaw: J.hash2(b.id, 5, g.day) * TAU });
      n++;
    }
  }

  // ---------- Главное обновление (раз в кадр симуляции) ----------
  H.update = function (dt) {
    const g = G();
    const p = g.player;
    if (!p || !g.world) return;
    H.ensure(p);
    // игрок
    if (p.aimT > 0) p.aimT -= dt;
    if (p.reloadT > 0) {
      p.reloadT -= dt;
      if (p.reloadT <= 0) finishReload(p);
    }
    updateEat(p, dt);
    const tsFrozen = g.timestop && g.timestop.by !== p && !(p.tsMove > 0);
    const held = H.heldId(p);
    if (p.thrAim) {
      if (!held || p.inCar || p.dead || !p.canAct() || tsFrozen) p.thrAim = null;
      else {
        p.thrAim.t += dt;
        const ti = throwInit(p, H.def(held), 1, 1);
        p.face = ti.ang;
      }
    }
    const thrChg = p.chg && held && H.def(held).cls === 'throw';
    if (p.thrAim || thrChg) showArc(p, p.thrAim ? J.clamp(0.25 + 0.75 * (p.thrAim.t / 0.6), 0, 1) : J.clamp((p.chg.t - 0.12) / 0.7, 0.15, 1));
    else hideArc();
    policeTick(p, dt);
    // ИИ с оружием
    for (const e of g.ents) if (!e.isPlayer && (e.hand || e.bossKey === 'dio' || e.reloadT > 0 || e.aimT > 0)) npcTick(e, dt);
    updateFly(dt);
    // лежащие вещи
    for (let i = GROUND.length - 1; i >= 0; i--) {
      const gi = GROUND[i];
      gi.life -= dt;
      if (gi.life <= 0) removeGround(gi);
      else {
        const dx = gi.x - R3.cam.tx, dz = gi.y - R3.cam.tz;
        gi.mesh.visible = dx * dx + dz * dz < 3600;
      }
    }
    lootTick(p);
  };
  H.reset = function () {
    for (const o of FLY) removeFly(o);
    FLY.length = 0;
    for (const gi of GROUND.slice()) removeGround(gi);
    lootDone.clear();
    hideArc();
    H.dirty = true;
  };

  // ---------- Обёртки чужих модулей (без правок их файлов) ----------
  // игрок: ЛКМ с предметом — действие предмета
  const basic0 = J.P.basicAttack;
  J.P.basicAttack = function (p) {
    if (!p.inCar && H.heldId(p)) {
      if (H.use(p)) {
        p.buf = 0;
        if (J.Fx && J.Fx.cancelStandoff) J.Fx.cancelStandoff();
      }
      return;
    }
    return basic0.call(this, p);
  };
  // тяжёлый (X / ПКМ): оружием — заряженный удар, метательным — бросок
  const heavy0 = J.Cb.heavy;
  J.Cb.heavy = function (u, k) {
    const d = H.held(u);
    if (d && !(J.Cb.standOn(u) && !u.isPlayer)) {
      if (d.cls === 'throw') return !!H.throwFrom(u, 0.3 + 0.7 * (k || 0));
      if (d.cls === 'food' || d.cls === 'ammo') return false;
      return H.melee(u, k || 0);
    }
    return heavy0.call(this, u, k);
  };
  // ИИ: удар оружием вместо кулака (если сражается сам, без стенда)
  const aiStrike0 = J.Cb.aiStrike;
  J.Cb.aiStrike = function (e, tg, heavy) {
    const d = H.held(e);
    if (d && (d.cls === 'blade' || d.cls === 'blunt' || (d.cls === 'throw' && e.hand !== 'throw_knife')) && !J.Cb.standOn(e)) {
      const pr = J.Cb.prof(e);
      e.ai.target = tg;
      const ok = H.melee(e, heavy ? 0.6 : undefined);
      if (ok) {
        e.ai.rec = (e.atk ? e.atk.at : 0.3) + pr.rec * (heavy ? 1.4 : 1);
        return;
      }
    }
    return aiStrike0.call(this, e, tg, heavy);
  };
  // выстрел ИИ: вспышка у ствола, шесть патронов и перезарядка
  const spawnProj0 = J.spawnProj;
  J.spawnProj = function (owner, o) {
    if (owner && !owner.isPlayer && owner.hand === 'revolver' && o.shape === 'bullet' && !owner.summon) {
      if (owner.reloadT > 0) {
        // пока перезаряжает — выстрела нет: возвращаем «пустышку» без урона
        const pr = spawnProj0.call(this, owner, Object.assign({}, o, { dmg: 0, range: 0.01 }));
        pr.life = 0;
        return pr;
      }
      const hp = H.handPos(owner);
      owner.aimT = 1.2;
      owner.anim = { type: 'item', iclip: 'shoot', t: 0.3, max: 0.3 };
      GUN_FX(owner, hp.x + Math.cos(o.ang) * 0.2, hp.h + 0.03, hp.z + Math.sin(o.ang) * 0.2, o.ang);
      const pr = spawnProj0.call(this, owner, Object.assign({}, o, { x: hp.x, y: hp.z }));
      const m = H.magOf(owner, 'revolver') - 1;
      setMag(owner, 'revolver', m);
      if (m <= 0) {
        H.reload(owner);
        if (owner.ai) owner.ai.atk = Math.max(owner.ai.atk || 0, 1.9);
        if (nearP(owner.x, owner.y, 18)) J.R3.text(owner.x, owner.y, 'Перезаряжает!', 'tmiss', 1);
      }
      return pr;
    }
    return spawnProj0.call(this, owner, o);
  };
  // оружие у врагов
  const makeMob0 = J.makeMob;
  J.makeMob = function () {
    const e = makeMob0.apply(this, arguments);
    H.arm(e);
    return e;
  };
  // при смерти оружие падает на землю
  const kill0 = J.kill;
  J.kill = function (t, src) {
    if (t && !t.dead && !t.isPlayer && t.hand && !t.vanish && G().world) {
      const d = H.def(t.hand);
      if (d && t.hand !== 'throw_knife') {
        H.spawnGround(t.x + (rnd() - 0.5) * 0.6, t.y + (rnd() - 0.5) * 0.6, t.hand, 1, { dur: t.hdur, mag: d.cls === 'gun' ? Math.max(0, t.mag || 0) : undefined });
        if (d.cls === 'gun' && rnd() < 0.7) H.spawnGround(t.x + (rnd() - 0.5) * 0.8, t.y + (rnd() - 0.5) * 0.8, 'bullets', 2 + Math.floor(rnd() * 5));
      }
      t.hand = null;
    }
    return kill0.call(this, t, src);
  };
  // скорость: прицеливание и тяжёлая ноша замедляют
  const speedMul0 = J.speedMul;
  J.speedMul = function (e) {
    let m = speedMul0(e);
    if (e.isPlayer) {
      if (e.thrAim) m *= 0.55;
      const d = H.held(e);
      if (d && d.w > 2) m *= 1 - Math.min(0.3, (d.w - 2) * 0.1);
      if (e.reloadT > 0) m *= 0.75;
    }
    return m;
  };
  // предметы, расход, автоматическая раскладка по панели
  const addItem0 = J.P.addItem;
  J.P.addItem = function (p, id, n = 1, meta, silent) {
    const it = J.ITEMS[id];
    if (it && it.type === 'pack') return J.P.addItem(p, it.pack[0], it.pack[1] * n, meta, silent);
    const had = p && p.inv ? cnt(p, id) : 0;
    const r = addItem0.call(this, p, id, n, meta, silent);
    if (p && p.isPlayer && !had && H.isWeapon(id) && H.autoAssign(p, id) >= 0 && p.flags && !p.flags.hbTip && J.Game.state === 'play') {
      // подсказка один раз за игру
      p.flags.hbTip = true;
      G().timers.push({ t: 1.2, fn: () => J.UI.toast(`${J.ITEMS[id].name} — на панели внизу. ${H.KEYS[0]}–${H.KEYS[SLOTS - 1]} или колёсико — взять в руку, B — бросить, N — отдать стенду, 0 — убрать.`, 'gold') });
    }
    H.dirty = true;
    return r;
  };
  const removeItem0 = J.P.removeItem;
  J.P.removeItem = function (p, id, n = 1) {
    const r = removeItem0.call(this, p, id, n);
    if (p && p.hotbar && cnt(p, id) <= 0) for (let i = 0; i < p.hotbar.length; i++) if (p.hotbar[i] === id) p.hotbar[i] = null;
    H.dirty = true;
    return r;
  };
  const useItem0 = J.P.useItem;
  J.P.useItem = function (p, id, idx) {
    const it = J.ITEMS[id];
    if (it && (it.type === 'weapon' || it.type === 'gun')) {
      if (cnt(p, id) > 0) {
        H.equip(p, id);
        J.UI.toast(`В руке: ${it.name}. ${it.type === 'gun' ? 'ЛКМ — выстрел.' : 'ЛКМ — удар, B — бросок, N — отдать стенду.'}`, 'normal');
      }
      return;
    }
    if (it && it.type === 'ammo') {
      J.UI.toast('Патроны заряжаются в револьвер сами, когда барабан пуст.', 'muted');
      return;
    }
    if (it && it.type === 'pack') return;
    const before = cnt(p, id);
    const r = useItem0.call(this, p, id, idx);
    if (it && it.empty && cnt(p, id) < before) {
      addItem0.call(this, p, it.empty, 1, null, true);
      J.UI.toast('Осталась пустая бутылка. Пригодится.', 'muted');
    }
    H.dirty = true;
    return r;
  };
  // мир: новые миры и выход в меню чистят вещи
  const reset0 = J.Game.resetWorld;
  J.Game.resetWorld = function () {
    H.reset();
    return reset0.apply(this, arguments);
  };
  const toTitle0 = J.Game.toTitle;
  J.Game.toTitle = function () {
    H.reset();
    return toTitle0.apply(this, arguments);
  };
  // обновление вещей — вместе с подбираемыми предметами
  const pick0 = J.updatePickups;
  J.updatePickups = function (dt) {
    pick0.call(this, dt);
    H.update(dt);
  };
  // поза и предмет в руке
  const rig0 = J.Anim.rig;
  J.Anim.rig = function (v, e, sw, spd, t, dt) {
    rig0.call(this, v, e, sw, spd, t, dt);
    if (v.heldMesh) holdPose(v, e, spd, t, dt);
  };
  const updView0 = R3.updateView;
  R3.updateView = function (e, dt, t, hs) {
    updView0.call(this, e, dt, t, hs);
    syncHeld(e);
  };


  // ---------- Ввод: клавиши, средняя кнопка, взаимодействие ----------
  const ready = (p) => J.Game.state === 'play' && p && !p.dead && !J.UI.blocking() && !p.inCar && !(J.Cb && J.Cb.inClash && J.Cb.inClash(p));
  const onKey0 = J.Game.onKey;
  J.Game.onKey = function (code) {
    const p = G().player;
    if (ready(p)) {
      H.ensure(p);
      const i = code.length === 6 && code.startsWith('Digit') ? KEYS.indexOf(code[5]) : -1;
      if (i >= 0) return H.select(p, i);
      if (code === 'Digit0') {
        if (p.hsel >= 0) setSel(p, -1);
        return;
      }
      if (code === 'KeyB') return H.aimStart(p);
      if (code === 'KeyN') return void H.give(p);
      if (code === 'KeyY') return H.drop(p);
    }
    return onKey0.apply(this, arguments);
  };
  const onKeyUp0 = J.Game.onKeyUp;
  J.Game.onKeyUp = function (code) {
    const p = G().player;
    if (code === 'KeyB' && p && p.thrAim) {
      if (ready(p)) H.aimRelease(p);
      else p.thrAim = null;
    }
    return onKeyUp0.apply(this, arguments);
  };
  // средняя кнопка мыши — прицельный бросок
  H.bindMouse = function () {
    const cv = document.getElementById('game');
    if (!cv || H._mouseBound) return;
    H._mouseBound = true;
    cv.addEventListener('mousedown', (e) => {
      if (e.button !== 1) return;
      e.preventDefault();
      const p = G().player;
      if (ready(p)) H.aimStart(p);
    });
    // окно потеряло фокус — отпущенная клавиша броска не дойдёт, прицел снимаем
    window.addEventListener('blur', () => {
      const p = G().player;
      if (p) p.thrAim = null;
    });
    window.addEventListener('mouseup', (e) => {
      if (e.button !== 1) return;
      const p = G().player;
      if (p && p.thrAim) {
        if (ready(p)) H.aimRelease(p);
        else p.thrAim = null;
      }
    });
  };
  // F рядом с вещью — подобрать (люди и выход из машины важнее, двери и машины — если вещь ближе)
  const itTarget0 = J.Game.interactTarget;
  J.Game.interactTarget = function () {
    const r = itTarget0.apply(this, arguments);
    const p = G().player;
    if (!p || p.dead || p.inCar || (r && r.exit) || !GROUND.length) return r;
    const gi = H.nearItem(p, 1.4);
    if (!gi) return r;
    if (r && r.ent && J.dist(p.x, p.y, r.ent.x, r.ent.y) < J.dist(p.x, p.y, gi.x, gi.y)) return r;
    return { item: gi };
  };
  const interact0 = J.Game.interact;
  J.Game.interact = function () {
    const it = J.Game.interactTarget();
    if (it && it.item) return H.pickup(G().player, it.item);
    return interact0.apply(this, arguments);
  };
  // сенсорные кнопки рядом с панелью: бросок (держать — прицел), отдать стенду, выбросить
  const touchAct = (k, down) => {
    const p = G().player;
    if (!p) return;
    if (k === 'thr') {
      if (down && ready(p)) H.aimStart(p);
      else if (!down && p.thrAim) H.aimRelease(p);
    } else if (down && ready(p)) {
      if (k === 'give') H.give(p);
      else if (k === 'drop') H.drop(p);
    }
  };

  // ---------- Интерфейс: панель быстрого доступа ----------
  const ICON_C = { blade: '#dfe5ec', blunt: '#c99a5e', gun: '#8a9099', throw: '#cfd6de', food: '#f2c230' };
  const ICONS = {
    knife: '<path d="M5 26 L9 22 L11 24 L7 28 Z" fill="#5a3a22"/><path d="M10 21 L25 6 Q28 4 27 8 L12 23 Z" fill="#dfe5ec"/>',
    switchblade: '<path d="M4 27 L10 21 L13 24 L7 30 Z" fill="#2a2a30"/><path d="M12 20 L24 9 Q27 7 25 11 L14 22 Z" fill="#dfe5ec"/>',
    tknife: '<circle cx="7" cy="25" r="2.6" fill="none" stroke="#cfd6de" stroke-width="1.4"/><path d="M8 23 L12 19 L14 21 L10 25 Z" fill="#2a2a33"/><path d="M13 18 L26 5 L23 15 L15 20 Z" fill="#e6ebf0"/>',
    tknife3: '<path d="M6 26 L22 4 L18 14 Z" fill="#e6ebf0"/><path d="M8 27 L27 8 L21 16 Z" fill="#cfd6de"/><path d="M5 23 L13 3 L13 13 Z" fill="#dfe5ec"/>',
    bat: '<path d="M5 27 L7 29 L27 9 Q29 5 25 5 Z" fill="#c99a5e"/><path d="M4 26 L8 30 L11 27 L7 23 Z" fill="#24242a"/>',
    pipe: '<path d="M5 25 L7 27 L28 6 L26 4 Z" fill="#8b9098"/><path d="M24 4 L28 8 L29 7 L25 3 Z" fill="#5f646c"/>',
    sign: '<path d="M6 28 L8 28 L8 14 L6 14 Z" fill="#9aa0a8"/><circle cx="7" cy="10" r="6.5" fill="#c8242a"/><rect x="2.5" y="8.6" width="9" height="2.8" fill="#fff"/><path d="M12 30 L30 12" stroke="#9aa0a8" stroke-width="0"/>',
    bottle: '<path d="M14 3 H18 V10 Q23 12 23 16 V28 Q23 30 21 30 H11 Q9 30 9 28 V16 Q9 12 14 10 Z" fill="#3e8c4c" opacity="0.9"/><rect x="11" y="18" width="10" height="6" fill="#d8e8c8" opacity="0.5"/>',
    bbottle: '<path d="M14 3 H18 V10 Q23 12 23 16 L21 20 L19 16 L17 22 L15 17 L12 21 L9 16 Q9 12 14 10 Z" fill="#3e8c4c"/>',
    brick: '<path d="M3 13 L22 10 L29 14 L29 21 L10 24 L3 20 Z" fill="#a8462f"/><path d="M3 13 L22 10 L29 14 L10 17 Z" fill="#c25a40"/>',
    rock: '<path d="M6 21 L9 12 L17 8 L25 12 L27 20 L20 26 L10 26 Z" fill="#7b766e"/><path d="M9 12 L17 8 L20 14 L12 17 Z" fill="#938d84"/>',
    coin: '<ellipse cx="13" cy="19" rx="8" ry="6" fill="#c9b064"/><ellipse cx="18" cy="14" rx="8" ry="6" fill="#d8c27a" stroke="#a89040" stroke-width="1"/>',
    bearing: '<circle cx="11" cy="18" r="5" fill="#dfe5ec"/><circle cx="20" cy="13" r="5" fill="#c8ccd2"/><circle cx="9" cy="16" r="1.5" fill="#fff"/>',
    steelball: '<circle cx="16" cy="16" r="10" fill="#c8ccd2"/><path d="M6 16 Q16 22 26 16" stroke="#e0b030" stroke-width="1.6" fill="none"/><path d="M16 6 Q10 16 16 26" stroke="#e0b030" stroke-width="1.6" fill="none"/>',
    revolver: '<path d="M4 12 H22 V15 H4 Z" fill="#3a3e46"/><rect x="14" y="10" width="7" height="8" rx="2" fill="#555b64"/><path d="M19 15 L25 15 L28 27 L22 28 Z" fill="#5b3a22"/><path d="M16 18 Q16 22 20 22" stroke="#3a3e46" stroke-width="1.6" fill="none"/>',
    ammo: '<rect x="7" y="10" width="18" height="14" fill="#c9a24a"/><rect x="7" y="10" width="18" height="3" fill="#7a2a1a"/>',
    cup: '<path d="M9 9 H23 L21 28 H11 Z" fill="#f4f0e6"/><rect x="8" y="6" width="16" height="4" rx="1" fill="#5a3a22"/><rect x="10" y="15" width="12" height="5" fill="#a8603a"/>',
    pbottle: '<rect x="11" y="9" width="10" height="20" rx="3" fill="#bfe3f5"/><rect x="13" y="4" width="6" height="5" fill="#2a6ad0"/><rect x="11" y="16" width="10" height="5" fill="#2a6ad0"/>',
    wine: '<path d="M14 2 H18 V11 Q22 13 22 17 V29 H10 V17 Q10 13 14 11 Z" fill="#1f4a2a"/><rect x="10" y="19" width="12" height="6" fill="#efe6cf"/><rect x="14" y="2" width="4" height="3" fill="#7a1a2a"/>',
    gbottle: '<path d="M14 3 H18 V10 Q22 12 22 16 V29 H10 V16 Q10 12 14 10 Z" fill="#3a1c12"/><rect x="10" y="18" width="12" height="5" fill="#d42a2a"/>',
    can: '<rect x="10" y="6" width="12" height="22" rx="2" fill="#2f8f4f"/><rect x="10" y="14" width="12" height="4" fill="#e8e040"/><rect x="11" y="5" width="10" height="2" fill="#c8ccd2"/>',
    bloodbag: '<rect x="9" y="7" width="14" height="20" rx="3" fill="#8a0a14"/><rect x="14" y="3" width="4" height="5" fill="#e8e8e8"/>',
    medkit: '<rect x="5" y="9" width="22" height="17" rx="2" fill="#f2f2f2"/><rect x="14" y="12" width="4" height="11" fill="#d42a2a"/><rect x="10.5" y="15.5" width="11" height="4" fill="#d42a2a"/>',
    bandage: '<ellipse cx="16" cy="17" rx="10" ry="8" fill="#f4f2ec"/><ellipse cx="16" cy="17" rx="4" ry="3" fill="#d8d4cc"/>',
    onigiri: '<path d="M16 5 L28 26 H4 Z" fill="#f6f4ee"/><rect x="11" y="19" width="10" height="7" fill="#1c241c"/>',
    sandwich: '<path d="M4 24 L28 24 L16 8 Z" fill="#e8cf96"/><path d="M6 21 L26 21 L24 18 L8 18 Z" fill="#e8909a"/>',
    pizza: '<path d="M16 28 L4 6 Q16 2 28 6 Z" fill="#f0b848"/><circle cx="13" cy="11" r="2" fill="#c4282c"/><circle cx="19" cy="12" r="2" fill="#c4282c"/><circle cx="16" cy="18" r="2" fill="#c4282c"/>',
    burger: '<path d="M5 14 Q16 2 27 14 Z" fill="#d49450"/><rect x="5" y="15" width="22" height="3" fill="#5aa040"/><rect x="5" y="18" width="22" height="4" fill="#4a2a1a"/><rect x="5" y="22" width="22" height="4" rx="2" fill="#c98a40"/>',
    gum: '<rect x="6" y="11" width="20" height="10" rx="1" fill="#f2f2ee"/><rect x="13" y="11" width="6" height="10" fill="#6a3a1a"/>',
    bowl: '<path d="M4 14 H28 Q27 27 16 27 Q5 27 4 14 Z" fill="#f4f2ec"/><ellipse cx="16" cy="14" rx="12" ry="3" fill="#c87a2a"/>',
  };
  H.icon = (id) => {
    const d = H.def(id);
    const m = d ? (d.model === 'tknife' ? 'tknife' : d.model) : null;
    return `<svg viewBox="0 0 32 32" aria-hidden="true">${(m && ICONS[m]) || `<circle cx="16" cy="16" r="9" fill="${(d && ICON_C[d.cls]) || '#888'}"/>`}</svg>`;
  };
  let BAR = null;
  H.buildUI = function () {
    const hud = document.getElementById('hud');
    if (!hud || document.getElementById('hotbar')) return;
    const wrap = document.createElement('div');
    wrap.id = 'hotwrap';
    wrap.innerHTML = `<div id="hand-name"></div><div id="hotbar">${KEYS.map((k, i) => `<div class="hs" data-slot="${i}"><span class="hk">${k}</span><span class="hi"></span><b class="hn"></b><i class="hd"><s></s></i></div>`).join('')}</div><div id="hotact"><button class="tb sm" data-ha="thr">Бросок</button><button class="tb sm" data-ha="give">Стенду</button><button class="tb sm" data-ha="drop">Выбр.</button></div>`;
    hud.appendChild(wrap);
    BAR = { wrap, name: wrap.querySelector('#hand-name'), slots: [...wrap.querySelectorAll('.hs')] };
    BAR.slots.forEach((el, i) => {
      const tap = (ev) => {
        ev.preventDefault();
        ev.stopPropagation();
        const p = G().player;
        if (!p || J.Game.state !== 'play') return;
        H.ensure(p);
        if (!p.hotbar[i] || cnt(p, p.hotbar[i]) <= 0) {
          J.UI.openPanel('inv');
          return;
        }
        H.select(p, i);
      };
      el.addEventListener('touchstart', tap, { passive: false });
      el.addEventListener('mousedown', tap);
    });
    wrap.querySelectorAll('[data-ha]').forEach((b) => {
      const k = b.dataset.ha;
      b.addEventListener('touchstart', (ev) => {
        ev.preventDefault();
        ev.stopPropagation();
        b.classList.add('on');
        touchAct(k, true);
      }, { passive: false });
      const up = (ev) => {
        ev.preventDefault();
        b.classList.remove('on');
        touchAct(k, false);
      };
      b.addEventListener('touchend', up, { passive: false });
      b.addEventListener('touchcancel', up, { passive: false });
    });
    H.bindMouse();
    H.dirty = true;
  };
  let lastSig = '';
  H.uiUpdate = function () {
    const p = G().player;
    if (!BAR || !p) return;
    H.ensure(p);
    const id = H.heldId(p);
    const d = id ? H.def(id) : null;
    let sig = p.hsel + '|' + (p.inCar ? 1 : 0);
    for (const x of p.hotbar) sig += '|' + (x || '') + ':' + (x ? cnt(p, x) + ':' + (H.def(x).dur < 999 ? Math.ceil((H.durOf(p, x) / H.def(x).dur) * 20) : '') + ':' + (H.def(x).cls === 'gun' ? H.magOf(p, x) + '/' + cnt(p, H.def(x).ammo) : '') : '');
    if (d && d.cls === 'gun') sig += '|r' + (p.reloadT > 0 ? 1 : 0);
    if (sig === lastSig && !H.dirty) return;
    lastSig = sig;
    H.dirty = false;
    BAR.slots.forEach((el, i) => {
      const x = p.hotbar[i];
      const has = x && cnt(p, x) > 0;
      el.classList.toggle('on', i === p.hsel);
      el.classList.toggle('empty', !has);
      el.querySelector('.hi').innerHTML = has ? H.icon(x) : '';
      const dx = has ? H.def(x) : null;
      el.querySelector('.hn').textContent = !has ? '' : dx.cls === 'gun' ? H.magOf(p, x) + '/' + dx.mag : cnt(p, x) > 1 ? '×' + cnt(p, x) : '';
      const bar = el.querySelector('.hd');
      const showDur = has && dx.dur < 999;
      bar.style.display = showDur ? '' : 'none';
      if (showDur) {
        const k = J.clamp(H.durOf(p, x) / dx.dur, 0, 1);
        bar.firstChild.style.width = k * 100 + '%';
        bar.firstChild.style.background = k > 0.5 ? '#7ed957' : k > 0.2 ? '#f2c230' : '#ff5d73';
      }
      el.title = has ? J.ITEMS[x].name : 'Пусто — назначь предмет в инвентаре (I)';
    });
    let nm = '';
    if (d) {
      const it = J.ITEMS[id];
      nm = `<b>${J.esc(it.name)}</b>`;
      if (d.cls === 'gun') nm += ` <span>${p.reloadT > 0 ? 'перезарядка…' : `${H.magOf(p, id)}/${d.mag}`} · патронов: ${cnt(p, d.ammo)}</span>`;
      else if (d.dur < 999) nm += ` <span>прочность ${Math.ceil((H.durOf(p, id) / d.dur) * 100)}%</span>`;
      if (d.w >= 2) nm += ' <span class="w">тяжёлое</span>';
    }
    BAR.name.innerHTML = nm;
    BAR.name.style.display = nm ? '' : 'none';
  };
  // подпись ЛКМ/X на панели способностей
  const ACT_NAME = { blade: 'Колоть / резать', blunt: 'Бить', throw: 'Бить', gun: 'Стрелять', food: 'Съесть' };
  const abar0 = J.UI.updateAbilityBar;
  J.UI.updateAbilityBar = function () {
    abar0.apply(this, arguments);
    const p = G().player;
    const E = J.UI.abEls;
    const d = p && H.held(p);
    if (!d || !E) return;
    E.basic.querySelector('.n').textContent = d.drink ? 'Выпить' : ACT_NAME[d.cls] || 'Удар';
    E.heavy.querySelector('.n').textContent = d.cls === 'throw' ? 'Бросок' : d.cls === 'food' ? '—' : d.cls === 'gun' ? 'Удар рукоятью' : 'Сильный удар';
  };
  const uiUpd0 = J.UI.update;
  J.UI.update = function (dt) {
    uiUpd0.apply(this, arguments);
    H.uiUpdate();
  };
  const build0 = J.UI.build;
  J.UI.build = function () {
    build0.apply(this, arguments);
    H.buildUI();
  };
  // инвентарь: панель быстрого доступа, «В руку», перетаскивание
  const render0 = J.UI.renderPanel;
  J.UI.renderPanel = function () {
    render0.apply(this, arguments);
    if (J.UI.panelOpen !== 'inv') return;
    const p = G().player;
    const body = document.getElementById('pbody');
    if (!p || !body) return;
    H.ensure(p);
    const box = document.createElement('div');
    box.className = 'hbedit';
    box.innerHTML = `<h3>Панель быстрого доступа</h3><p class="muted small">Клавиши 4–9 или колёсико — взять в руку, 0 — убрать в карман. Перетащи предмет в ячейку или нажми «В руку». Клик по ячейке — очистить.</p><div class="hbrow">${KEYS.map((k, i) => {
      const x = p.hotbar[i];
      const has = x && cnt(p, x) > 0;
      return `<div class="hs ${i === p.hsel ? 'on' : ''} ${has ? '' : 'empty'}" data-hslot="${i}" title="${has ? J.esc(J.ITEMS[x].name) : 'пусто'}"><span class="hk">${k}</span><span class="hi">${has ? H.icon(x) : ''}</span><b class="hn">${has && cnt(p, x) > 1 ? '×' + cnt(p, x) : ''}</b></div>`;
    }).join('')}</div>`;
    body.prepend(box);
    box.querySelectorAll('[data-hslot]').forEach((el) => {
      const i = +el.dataset.hslot;
      el.onclick = () => {
        p.hotbar[i] = null;
        if (p.hsel === i) p.hsel = -1;
        H.dirty = true;
        J.UI.renderPanel();
      };
      el.addEventListener('dragover', (ev) => ev.preventDefault());
      el.addEventListener('drop', (ev) => {
        ev.preventDefault();
        const id = ev.dataTransfer.getData('text/plain');
        if (id && H.handable(id) && cnt(p, id) > 0) {
          H.assign(p, i, id);
          J.UI.renderPanel();
        }
      });
    });
    body.querySelectorAll('[data-use]').forEach((b) => {
      const id = b.dataset.use;
      if (!H.handable(id)) return;
      const row = b.closest('.item');
      if (!row) return;
      row.draggable = true;
      row.addEventListener('dragstart', (ev) => ev.dataTransfer.setData('text/plain', id));
      const ic = document.createElement('span');
      ic.className = 'iico';
      ic.innerHTML = H.icon(id);
      const info = row.firstElementChild;
      if (info && info !== b) info.prepend(ic);
      const it = J.ITEMS[id];
      if (it.type === 'weapon' || it.type === 'gun') {
        b.textContent = H.heldId(p) === id ? 'В руке' : 'В руку';
      } else {
        const add = document.createElement('button');
        add.className = 'btn sm';
        add.textContent = H.slotOf(p, id) >= 0 ? 'На панели: ' + KEYS[H.slotOf(p, id)] : 'На панель';
        add.onclick = () => {
          H.autoAssign(p, id);
          J.UI.renderPanel();
        };
        b.parentNode.insertBefore(add, b);
      }
      const d = H.def(id);
      if (d.dur < 999 || d.cls === 'gun') {
        const s = document.createElement('div');
        s.className = 'muted small';
        s.textContent = d.cls === 'gun' ? `Барабан ${H.magOf(p, id)}/${d.mag} · урон ${d.dmg}` : `Прочность ${Math.ceil(H.durOf(p, id))}/${d.dur} · урон ${d.dmg} · вес ${d.w} кг`;
        if (info && info !== b) info.appendChild(s);
      }
    });
  };
  // подсказка «F — подобрать»
  const prompt0 = J.UI.updatePrompt;
  J.UI.updatePrompt = function () {
    const it = J.Game.interactTarget();
    if (it && it.item) {
      const pr = document.getElementById('prompt');
      if (!pr) return;
      pr.hidden = false;
      const nm = J.ITEMS[it.item.item].name;
      pr.innerHTML = `<b>F</b> Подобрать: ${J.esc(nm)}${it.item.n > 1 ? ' ×' + it.item.n : ''}`;
      return;
    }
    return prompt0.apply(this, arguments);
  };
})();
