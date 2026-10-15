'use strict';
// Арсенал в духе GTA: модели стволов, хваты и анимации стрельбы/перезарядки, баллистика (луч в 3D: стены, земля,
// люди с головой и ногами, машины и шины), разброс и отдача, вспышка у ствола, трассеры, гильзы, магазины,
// дырки от пуль, звуки выстрелов по классам оружия, стенды против пуль (ловит, отбивает, рассекает, плавит,
// Секс Пистолз доворачивают, в остановленном времени пули зависают). Пулы — без новых объектов в бою.
(function () {
  const H = J.Hand;
  const Gn = (J.Guns = {});
  const G = () => J.G;
  const R3 = J.R3;
  const rnd = Math.random;
  const TAU = Math.PI * 2;
  const gy = (x, y) => G().world.groundY(x, y);
  const fxOk = () => J.Fx && J.Fx.ready;
  const pwOk = () => J.Pw && J.Pw.ready;
  const near = (x, y, r) => {
    const p = G().player;
    return !!p && Math.abs(p.x - x) < r && Math.abs(p.y - y) < r && J.dist(x, y, p.x, p.y) < r;
  };
  const { rod, box, blade, M4, C, CYL8, CYL16, SPH, TOR, CONE, BOX, HALF } = H.MB;
  const cnt = (p, id) => (p.inv && p.inv[id]) || 0;

  // ---------- 1. Модели (ось +z — ствол, начало координат — кисть на рукояти) ----------
  const BLK = '#1c1e22', GUNM = '#2c2f35', GUNL = '#454a52', WOOD = '#6e4424', WOODL = '#8a5a30';
  // рукоять с наклоном назад
  const grip = (gb, col, z, h, rake) => box(gb, col, 0, -h / 2 + 0.01, z - Math.sin(rake || 0.25) * h * 0.5, 0.027, h, 0.042, rake || 0.25);
  const guard = (gb, col, z) => gb.geo(TOR(), M4(0, -0.004, z, 0.016, 0.016, 0.02, 0, HALF, 0), col);
  const M = H.MODELS;
  Object.assign(M, {
    pistol(gb) {
      const sl = C('#2a2d32'), fr = C(BLK), dt = C('#5c626b');
      box(gb, sl, 0, 0.034, 0.05, 0.026, 0.03, 0.19);
      box(gb, fr, 0, 0.014, 0.06, 0.024, 0.016, 0.15);
      for (let i = 0; i < 5; i++) box(gb, dt, 0, 0.042, -0.03 + i * 0.008, 0.027, 0.012, 0.003);
      box(gb, dt, 0, 0.051, 0.14, 0.004, 0.006, 0.006);
      box(gb, dt, 0, 0.051, -0.035, 0.012, 0.006, 0.006);
      rod(gb, C('#111214'), 0.144, 0.147, 0.0055, 0.0055, 0, 0.036);
      grip(gb, fr, 0, 0.1, 0.22);
      guard(gb, fr, 0.03);
      box(gb, dt, 0, -0.01, 0.035, 0.005, 0.012, 0.004, 0.3);
    },
    deagle(gb) {
      const st = C('#b9bdc3'), dk = C('#8c9097'), bl = C(BLK);
      box(gb, st, 0, 0.04, 0.07, 0.034, 0.042, 0.26);
      box(gb, dk, 0, 0.064, 0.09, 0.012, 0.008, 0.22);
      for (let i = 0; i < 6; i++) box(gb, dk, 0, 0.045, -0.04 + i * 0.008, 0.035, 0.02, 0.003);
      box(gb, st, 0, 0.012, 0.075, 0.03, 0.02, 0.2);
      rod(gb, C('#101012'), 0.198, 0.202, 0.008, 0.008, 0, 0.042);
      box(gb, bl, 0, 0.07, 0.19, 0.005, 0.008, 0.008);
      grip(gb, bl, 0, 0.115, 0.2);
      guard(gb, st, 0.035);
    },
    mista(gb) {
      const gm = C('#30343c'), gl = C('#565c66'), iv = C('#e9e2cf');
      box(gb, iv, 0, -0.04, -0.014, 0.027, 0.088, 0.035, 0.32);
      box(gb, C('#c9a23a'), 0, -0.04, -0.014, 0.028, 0.012, 0.024, 0.32);
      box(gb, gm, 0, 0.018, 0.018, 0.024, 0.042, 0.078);
      rod(gb, gl, 0.012, 0.058, 0.022, 0.022, 0, 0.022);
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * TAU;
        rod(gb, C('#1c1e22'), 0.0575, 0.0595, 0.0045, 0.0045, Math.cos(a) * 0.012, 0.022 + Math.sin(a) * 0.012);
      }
      rod(gb, gm, 0.05, 0.2, 0.0088, 0.0088, 0, 0.034);
      box(gb, gm, 0, 0.0255, 0.125, 0.01, 0.016, 0.15);
      box(gb, gm, 0, 0.048, 0.195, 0.003, 0.01, 0.008);
      box(gb, gm, 0, 0.043, -0.02, 0.008, 0.018, 0.012, -0.5);
      gb.geo(TOR(), M4(0, -0.008, 0.02, 0.017, 0.017, 0.022, 0, HALF, 0), gm);
    },
    uzi(gb) {
      const bl = C('#26282d'), dk = C('#16171a'), gl = C(GUNL);
      box(gb, bl, 0, 0.035, 0.06, 0.04, 0.055, 0.24);
      box(gb, dk, 0, 0.065, 0.06, 0.03, 0.008, 0.2);
      box(gb, dk, 0, -0.045, 0.005, 0.03, 0.12, 0.04, 0.1);
      box(gb, gl, 0, -0.13, -0.004, 0.024, 0.05, 0.032, 0.1);
      rod(gb, C('#101012'), 0.18, 0.22, 0.008, 0.008, 0, 0.03);
      box(gb, dk, 0, 0.068, -0.08, 0.02, 0.01, 0.06);
      guard(gb, dk, 0.045);
      box(gb, gl, 0.021, 0.04, 0.03, 0.003, 0.012, 0.04);
    },
    mp5(gb) {
      const bl = C('#24262b'), dk = C('#141518'), gl = C(GUNL);
      box(gb, bl, 0, 0.04, 0.08, 0.036, 0.05, 0.26);
      rod(gb, bl, 0.21, 0.32, 0.016, 0.016, 0, 0.042);
      rod(gb, dk, 0.31, 0.34, 0.01, 0.01, 0, 0.042);
      box(gb, dk, 0, 0.035, 0.27, 0.042, 0.045, 0.1);
      box(gb, dk, 0, 0.074, 0.25, 0.006, 0.02, 0.012);
      box(gb, dk, 0, 0.074, -0.02, 0.016, 0.018, 0.02);
      // изогнутый магазин
      box(gb, gl, 0, -0.03, 0.12, 0.022, 0.09, 0.03, -0.2);
      box(gb, gl, 0, -0.1, 0.135, 0.022, 0.06, 0.03, -0.35);
      grip(gb, dk, 0, 0.095, 0.25);
      guard(gb, dk, 0.04);
      // складной приклад
      box(gb, dk, 0.012, 0.035, -0.17, 0.006, 0.012, 0.22);
      box(gb, dk, -0.012, 0.035, -0.17, 0.006, 0.012, 0.22);
      box(gb, dk, 0, 0.0, -0.28, 0.036, 0.07, 0.014);
    },
    ak(gb) {
      const st = C('#2d2f33'), wd = C(WOOD), wl = C(WOODL), dk = C('#17181b');
      box(gb, st, 0, 0.038, 0.08, 0.038, 0.05, 0.3);
      box(gb, st, 0, 0.065, 0.05, 0.034, 0.012, 0.22);
      box(gb, wd, 0, 0.032, 0.3, 0.046, 0.05, 0.16);
      box(gb, wl, 0, 0.062, 0.31, 0.034, 0.018, 0.14);
      rod(gb, st, 0.22, 0.52, 0.0085, 0.0085, 0, 0.042);
      rod(gb, st, 0.22, 0.4, 0.008, 0.008, 0, 0.068);
      box(gb, dk, 0, 0.066, 0.44, 0.012, 0.03, 0.012);
      rod(gb, dk, 0.5, 0.53, 0.011, 0.011, 0, 0.042);
      // магазин-«рожок»
      for (let i = 0; i < 4; i++) box(gb, i % 2 ? C('#7a4a26') : st, 0, -0.02 - i * 0.04, 0.15 + i * 0.016, 0.025, 0.045, 0.04, -0.28 - i * 0.07);
      grip(gb, wd, 0, 0.095, 0.3);
      guard(gb, st, 0.045);
      box(gb, st, 0.021, 0.045, 0.06, 0.004, 0.01, 0.07);
      // деревянный приклад
      box(gb, wd, 0, 0.012, -0.17, 0.038, 0.06, 0.2, -0.08);
      box(gb, wd, 0, -0.012, -0.3, 0.04, 0.11, 0.07, -0.08);
      box(gb, dk, 0, -0.012, -0.338, 0.042, 0.11, 0.008, -0.08);
    },
    m4(gb) {
      const bl = C('#26282c'), dk = C('#15161a'), gl = C('#3a3e45'), tan = C('#2f3236');
      box(gb, bl, 0, 0.04, 0.07, 0.036, 0.055, 0.26);
      box(gb, gl, 0, 0.04, 0.27, 0.046, 0.05, 0.17);
      for (let i = 0; i < 7; i++) box(gb, dk, 0, 0.068, 0.2 + i * 0.022, 0.03, 0.006, 0.01);
      rod(gb, dk, 0.35, 0.48, 0.008, 0.008, 0, 0.042);
      box(gb, dk, 0, 0.068, 0.44, 0.01, 0.03, 0.01);
      rod(gb, dk, 0.46, 0.49, 0.011, 0.011, 0, 0.042);
      // коллиматор
      box(gb, dk, 0, 0.074, 0.02, 0.026, 0.012, 0.06);
      rod(gb, dk, -0.005, 0.07, 0.016, 0.016, 0, 0.095);
      rod(gb, C('#c43a3a'), 0.069, 0.071, 0.012, 0.012, 0, 0.095);
      box(gb, tan, 0, -0.045, 0.14, 0.024, 0.11, 0.032, -0.12);
      grip(gb, dk, 0, 0.095, 0.3);
      guard(gb, dk, 0.045);
      // телескопический приклад
      rod(gb, dk, -0.25, -0.08, 0.013, 0.013, 0, 0.035);
      box(gb, bl, 0, 0.01, -0.27, 0.036, 0.085, 0.08, -0.05);
    },
    pump(gb) {
      const st = C('#2a2c30'), wd = C('#5b3820'), dk = C('#151618');
      box(gb, st, 0, 0.035, 0.05, 0.04, 0.06, 0.2);
      rod(gb, st, 0.14, 0.6, 0.0115, 0.0115, 0, 0.05);
      rod(gb, st, 0.14, 0.52, 0.011, 0.011, 0, 0.022);
      rod(gb, dk, 0.59, 0.61, 0.013, 0.013, 0, 0.05);
      // цевьё помпы с рифлением
      rod(gb, wd, 0.24, 0.4, 0.019, 0.019, 0, 0.024);
      for (let i = 0; i < 6; i++) rod(gb, C('#3f2716'), 0.255 + i * 0.024, 0.262 + i * 0.024, 0.0195, 0.0195, 0, 0.024);
      box(gb, C('#c8a040'), 0, 0.07, 0.59, 0.004, 0.005, 0.004);
      guard(gb, dk, 0.025);
      grip(gb, wd, -0.005, 0.085, 0.45);
      box(gb, wd, 0, 0.01, -0.17, 0.038, 0.06, 0.22, -0.1);
      box(gb, wd, 0, -0.018, -0.3, 0.04, 0.115, 0.06, -0.1);
      box(gb, dk, 0, -0.018, -0.333, 0.042, 0.118, 0.01, -0.1);
    },
    sawnoff(gb) {
      const st = C('#33363c'), wd = C('#6a4024'), dk = C('#17181b');
      rod(gb, st, 0.03, 0.32, 0.0125, 0.0125, 0.0125, 0.038);
      rod(gb, st, 0.03, 0.32, 0.0125, 0.0125, -0.0125, 0.038);
      rod(gb, dk, 0.312, 0.322, 0.0105, 0.0105, 0.0125, 0.038);
      rod(gb, dk, 0.312, 0.322, 0.0105, 0.0105, -0.0125, 0.038);
      box(gb, wd, 0, 0.02, 0.15, 0.03, 0.024, 0.15);
      box(gb, st, 0, 0.03, 0.0, 0.034, 0.05, 0.07);
      box(gb, dk, 0, 0.06, -0.02, 0.008, 0.02, 0.012, -0.4);
      guard(gb, dk, 0.012);
      grip(gb, wd, -0.01, 0.1, 0.5);
    },
    sniper(gb) {
      const st = C('#2b2e33'), dk = C('#141518'), cam = C('#4a4f3c'), gl = C('#3a3e44');
      box(gb, cam, 0, 0.03, 0.12, 0.05, 0.06, 0.42);
      rod(gb, st, 0.3, 0.9, 0.0105, 0.0085, 0, 0.045);
      rod(gb, dk, 0.86, 0.92, 0.0135, 0.0135, 0, 0.045);
      box(gb, st, 0, 0.045, 0.02, 0.034, 0.03, 0.16);
      // затвор
      rod(gb, gl, -0.03, 0.03, 0.006, 0.006, 0.026, 0.05);
      gb.geo(SPH(), M4(0.034, 0.045, -0.02, 0.012, 0.012, 0.012), dk);
      // оптика
      rod(gb, dk, -0.06, 0.2, 0.019, 0.019, 0, 0.106);
      rod(gb, dk, 0.18, 0.25, 0.019, 0.027, 0, 0.106);
      rod(gb, dk, -0.11, -0.05, 0.025, 0.019, 0, 0.106);
      rod(gb, C('#5a8ab0'), 0.248, 0.252, 0.024, 0.024, 0, 0.106);
      box(gb, dk, 0, 0.082, 0.0, 0.012, 0.03, 0.012);
      box(gb, dk, 0, 0.082, 0.14, 0.012, 0.03, 0.012);
      box(gb, gl, 0, -0.03, 0.08, 0.022, 0.05, 0.05);
      guard(gb, dk, 0.03);
      grip(gb, cam, -0.01, 0.1, 0.38);
      box(gb, cam, 0, 0.012, -0.2, 0.04, 0.07, 0.28, -0.06);
      box(gb, cam, 0, -0.03, -0.32, 0.042, 0.13, 0.06, -0.06);
      box(gb, dk, 0, -0.03, -0.355, 0.044, 0.13, 0.012, -0.06);
      box(gb, cam, 0, 0.06, -0.18, 0.03, 0.02, 0.12);
      // сошки (сложены)
      rod(gb, gl, 0.4, 0.6, 0.005, 0.005, 0.012, 0.018);
      rod(gb, gl, 0.4, 0.6, 0.005, 0.005, -0.012, 0.018);
    },
    lmg(gb) {
      const st = C('#2a2c30'), dk = C('#151618'), ol = C('#4c5236'), gl = C('#3d4148');
      box(gb, st, 0, 0.045, 0.1, 0.05, 0.075, 0.34);
      box(gb, gl, 0, 0.088, 0.09, 0.044, 0.012, 0.28);
      rod(gb, st, 0.27, 0.62, 0.011, 0.011, 0, 0.05);
      rod(gb, gl, 0.27, 0.5, 0.02, 0.02, 0, 0.05);
      for (let i = 0; i < 6; i++) rod(gb, dk, 0.29 + i * 0.035, 0.3 + i * 0.035, 0.021, 0.021, 0, 0.05);
      rod(gb, dk, 0.6, 0.64, 0.015, 0.012, 0, 0.05);
      // короб с лентой
      box(gb, ol, 0.0, -0.045, 0.14, 0.07, 0.1, 0.11);
      box(gb, C('#c9a24a'), -0.03, 0.02, 0.12, 0.012, 0.03, 0.08);
      // ручка для переноски
      box(gb, dk, 0, 0.12, 0.16, 0.012, 0.012, 0.12);
      box(gb, dk, 0, 0.105, 0.1, 0.012, 0.03, 0.012);
      box(gb, dk, 0, 0.105, 0.22, 0.012, 0.03, 0.012);
      grip(gb, dk, 0, 0.1, 0.3);
      guard(gb, dk, 0.045);
      box(gb, st, 0, 0.02, -0.19, 0.045, 0.07, 0.22, -0.05);
      box(gb, st, 0, -0.01, -0.3, 0.047, 0.12, 0.05, -0.05);
      rod(gb, gl, 0.45, 0.64, 0.006, 0.006, 0.014, 0.022);
      rod(gb, gl, 0.45, 0.64, 0.006, 0.006, -0.014, 0.022);
    },
    grenade(gb) {
      const ol = C('#4d5a2a'), dk = C('#2d3418'), mt = C('#a7acb3');
      gb.geo(SPH(), M4(0, 0, 0.04, 0.03, 0.03, 0.04), ol);
      for (let i = 0; i < 4; i++) gb.geo(TOR(), M4(0, 0, 0.012 + i * 0.019, 0.029 - Math.abs(i - 1.5) * 0.004, 0.029 - Math.abs(i - 1.5) * 0.004, 0.02), dk);
      rod(gb, mt, 0.075, 0.095, 0.011, 0.011);
      box(gb, mt, 0, 0.018, 0.06, 0.006, 0.006, 0.07, 0.25);
      gb.geo(TOR(), M4(0.016, 0, 0.098, 0.011, 0.011, 0.011, 0, HALF, 0), mt);
    },
    molotov(gb) {
      const g = C('#9a6a2a'), rag = C('#d8c8a8');
      rod(gb, g, -0.06, 0.09, 0.033, 0.033);
      rod(gb, g, 0.09, 0.13, 0.033, 0.013);
      rod(gb, g, 0.13, 0.17, 0.013, 0.012);
      rod(gb, C('#e0a040'), -0.055, 0.05, 0.0315, 0.0315);
      gb.geo(CONE(), M4(0, 0, 0.2, 0.02, 0.07, 0.02, HALF), rag);
      gb.geo(CONE(), M4(0.01, 0.006, 0.19, 0.014, 0.05, 0.014, HALF + 0.5, 0.4), C('#c8b088'));
    },
    flash(gb) {
      const gr = C('#8d939b'), dk = C('#4a4f56'), mt = C('#c8ccd2');
      rod(gb, gr, -0.01, 0.1, 0.025, 0.025);
      for (let i = 0; i < 3; i++) for (let k = 0; k < 6; k++) {
        const a = (k / 6) * TAU;
        box(gb, dk, Math.cos(a) * 0.025, Math.sin(a) * 0.025, 0.015 + i * 0.03, 0.006, 0.006, 0.012, 0, 0, a);
      }
      rod(gb, mt, 0.1, 0.115, 0.012, 0.012);
      box(gb, mt, 0, 0.02, 0.07, 0.006, 0.006, 0.07, 0.2);
      gb.geo(TOR(), M4(0.015, 0, 0.118, 0.011, 0.011, 0.011, 0, HALF, 0), mt);
    },
    smoke(gb) {
      const gn = C('#3e5a3a'), wh = C('#e8e8e0'), mt = C('#a8adb3');
      rod(gb, gn, -0.01, 0.11, 0.03, 0.03);
      rod(gb, wh, 0.03, 0.05, 0.0305, 0.0305);
      rod(gb, mt, 0.11, 0.125, 0.014, 0.014);
      box(gb, mt, 0, 0.024, 0.07, 0.006, 0.006, 0.08, 0.2);
      gb.geo(TOR(), M4(0.016, 0, 0.13, 0.011, 0.011, 0.011, 0, HALF, 0), mt);
    },
    cknife(gb) {
      const bl = C('#1d1f22'), st = C('#cfd5dc'), dk = C('#7f868f');
      box(gb, bl, 0, -0.002, -0.02, 0.022, 0.03, 0.12);
      for (let i = 0; i < 5; i++) box(gb, C('#2c2f33'), 0, -0.002, -0.07 + i * 0.022, 0.024, 0.032, 0.006);
      box(gb, dk, 0, -0.002, 0.044, 0.014, 0.07, 0.008);
      blade(gb, C(STEEL()), [[0.013, 0.048], [0.013, 0.16], [0.02, 0.2], [0.006, 0.235], [-0.01, 0.215], [-0.019, 0.17], [-0.019, 0.048]], 0.0019);
      for (let i = 0; i < 5; i++) box(gb, dk, 0, 0.0145, 0.06 + i * 0.012, 0.003, 0.004, 0.006, 0.6);
    },
    machete(gb) {
      const bl = C('#202226'), st = C('#bcc3cb');
      box(gb, bl, 0, -0.003, -0.03, 0.024, 0.032, 0.13);
      box(gb, C('#9aa1a9'), 0, -0.003, 0.038, 0.016, 0.034, 0.008);
      blade(gb, st, [[0.014, 0.042], [0.016, 0.38], [0.012, 0.47], [-0.01, 0.5], [-0.036, 0.46], [-0.034, 0.2], [-0.02, 0.042]], 0.0016);
      box(gb, C('#7d848c'), 0, 0.01, 0.25, 0.0034, 0.006, 0.38);
    },
    crowbar(gb) {
      const rd = C('#a8261e'), mt = C('#3a3c40');
      rod(gb, rd, -0.12, 0.42, 0.011, 0.011);
      rod(gb, mt, -0.18, -0.11, 0.011, 0.009);
      // загнутый «гвоздодёр»
      for (let i = 0; i < 5; i++) {
        const a = (i / 4) * 2.4;
        box(gb, rd, 0, (1 - Math.cos(a)) * 0.04, 0.42 + Math.sin(a) * 0.04, 0.02, 0.018, 0.03, a);
      }
      box(gb, mt, 0, 0.082, 0.392, 0.026, 0.006, 0.03, 2.6);
    },
    golf(gb) {
      const sh = C('#c4cad1'), bl = C('#1a1b1e'), hd = C('#2e3138');
      rod(gb, bl, -0.2, 0.05, 0.0125, 0.011);
      rod(gb, sh, 0.05, 0.86, 0.0085, 0.0055);
      gb.geo(SPH(), M4(0, -0.03, 0.88, 0.024, 0.05, 0.034, 0.25), hd);
      box(gb, C('#c9ced5'), 0.023, -0.03, 0.88, 0.003, 0.05, 0.04, 0.25);
    },
    knuckles(gb) {
      const br = C('#c9a24a');
      for (let i = 0; i < 4; i++) gb.geo(TOR(), M4(-0.033 + i * 0.022, 0.028, 0.012, 0.011, 0.011, 0.013, HALF, 0, 0), br);
      box(gb, br, 0, 0.028, 0.026, 0.09, 0.012, 0.01);
      box(gb, br, 0, 0.005, 0.0, 0.07, 0.022, 0.014);
    },
    shells(gb) {
      for (let i = 0; i < 3; i++) {
        rod(gb, C('#b82a22'), 0.0, 0.06, 0.0105, 0.0105, -0.022 + i * 0.022, 0);
        rod(gb, C('#c9a24a'), -0.012, 0.0, 0.011, 0.011, -0.022 + i * 0.022, 0);
      }
    },
  });
  function STEEL() {
    return '#dfe5ec';
  }
  // лежит на земле: высота подъёма модели
  const LIFTS = { pistol: 0.014, deagle: 0.018, mista: 0.016, uzi: 0.02, mp5: 0.022, ak: 0.024, m4: 0.024, pump: 0.022, sawnoff: 0.018, sniper: 0.027, lmg: 0.04, grenade: 0.03, molotov: 0.034, flash: 0.026, smoke: 0.03, crowbar: 0.012, golf: 0.012, knuckles: 0.01, shells: 0.012 };
  for (const id in J.ITEMS) {
    const d = J.ITEMS[id].hand;
    if (d && LIFTS[d.model]) d.lift = LIFTS[d.model];
  }

  // ---------- 2. Иконки ----------
  Object.assign(H.ICONS, {
    pistol: '<path d="M5 11 H26 V16 H13 L12 18 H10 L8 27 H3 L5 16 Z" fill="#2c2f35"/><rect x="6" y="11" width="20" height="2" fill="#5c626b"/><path d="M12 16 Q12 21 16 20" stroke="#2c2f35" stroke-width="1.6" fill="none"/>',
    deagle: '<path d="M3 10 H29 V16 H14 L13 18 H11 L9 28 H3 L4 16 Z" fill="#b9bdc3"/><path d="M4 16 L3 28 H9 L11 18 Z" fill="#1c1e22"/><rect x="3" y="10" width="26" height="2" fill="#8c9097"/>',
    mista: '<path d="M4 12 H24 V15 H4 Z" fill="#30343c"/><rect x="14" y="10" width="7" height="8" rx="2" fill="#565c66"/><path d="M19 15 L25 15 L28 28 L22 28 Z" fill="#e9e2cf"/><path d="M16 18 Q16 22 20 22" stroke="#30343c" stroke-width="1.6" fill="none"/>',
    uzi: '<rect x="4" y="9" width="22" height="8" fill="#26282d"/><rect x="11" y="16" width="5" height="13" fill="#16171a"/><rect x="26" y="11" width="4" height="3" fill="#101012"/><rect x="2" y="9" width="5" height="2" fill="#16171a"/>',
    mp5: '<rect x="8" y="10" width="17" height="6" fill="#24262b"/><rect x="25" y="11" width="6" height="3" fill="#141518"/><path d="M15 16 L19 16 L21 25 L17 26 Z" fill="#3a3e45"/><path d="M10 16 L13 16 L12 23 L9 23 Z" fill="#141518"/><rect x="1" y="11" width="8" height="2" fill="#141518"/><rect x="1" y="11" width="2" height="7" fill="#141518"/>',
    ak: '<rect x="10" y="12" width="12" height="5" fill="#2d2f33"/><rect x="21" y="12" width="6" height="5" fill="#6e4424"/><rect x="26" y="13" width="5" height="2" fill="#2d2f33"/><path d="M15 17 L19 17 Q21 23 23 26 L20 27 Q17 23 15 17 Z" fill="#7a4a26"/><path d="M1 14 L10 12 V17 L2 21 Z" fill="#6e4424"/><path d="M11 17 L13 17 L12 22 L10 22 Z" fill="#6e4424"/>',
    m4: '<rect x="10" y="12" width="12" height="5" fill="#26282c"/><rect x="21" y="12" width="7" height="5" fill="#3a3e45"/><rect x="27" y="13" width="4" height="2" fill="#15161a"/><rect x="12" y="9" width="6" height="3" fill="#15161a"/><path d="M15 17 L18 17 L18 25 L15 25 Z" fill="#2f3236"/><path d="M1 13 L10 13 V17 L2 19 Z" fill="#26282c"/><path d="M11 17 L13 17 L12 22 L10 22 Z" fill="#15161a"/>',
    pump: '<rect x="8" y="12" width="7" height="5" fill="#2a2c30"/><rect x="14" y="12" width="17" height="2" fill="#2a2c30"/><rect x="18" y="14" width="8" height="3" fill="#5b3820"/><path d="M1 14 L8 12 V17 L2 21 Z" fill="#5b3820"/>',
    sawnoff: '<rect x="12" y="11" width="17" height="2.4" fill="#33363c"/><rect x="12" y="13.6" width="17" height="2.4" fill="#33363c"/><rect x="15" y="16" width="9" height="2" fill="#6a4024"/><path d="M12 11 L12 18 L6 27 L2 25 L8 16 Z" fill="#6a4024"/>',
    sniper: '<rect x="8" y="13" width="14" height="4" fill="#4a4f3c"/><rect x="21" y="14" width="10" height="1.6" fill="#2b2e33"/><rect x="9" y="8" width="11" height="3" rx="1.4" fill="#141518"/><path d="M1 14 L8 13 V17 L2 21 Z" fill="#4a4f3c"/><path d="M10 17 L12 17 L11 22 L9 22 Z" fill="#4a4f3c"/>',
    lmg: '<rect x="8" y="11" width="13" height="7" fill="#2a2c30"/><rect x="20" y="12" width="11" height="2.4" fill="#3d4148"/><rect x="12" y="18" width="8" height="6" fill="#4c5236"/><rect x="11" y="8" width="8" height="2" fill="#151618"/><path d="M1 13 L8 12 V17 L2 20 Z" fill="#2a2c30"/>',
    grenade: '<ellipse cx="15" cy="19" rx="8" ry="10" fill="#4d5a2a"/><path d="M8 15 H22 M8 20 H22 M8 25 H22" stroke="#2d3418" stroke-width="1"/><rect x="13" y="6" width="5" height="4" fill="#a7acb3"/><path d="M18 8 Q25 9 23 17" stroke="#a7acb3" stroke-width="1.8" fill="none"/><circle cx="12" cy="6" r="3" fill="none" stroke="#a7acb3" stroke-width="1.3"/>',
    molotov: '<path d="M14 9 H18 V12 Q22 14 22 18 V29 H10 V18 Q10 14 14 12 Z" fill="#9a6a2a"/><rect x="10" y="20" width="12" height="7" fill="#e0a040"/><path d="M14 9 Q12 4 16 2 Q15 6 19 5 Q18 8 18 9 Z" fill="#ff8a2a"/>',
    flash: '<rect x="10" y="9" width="12" height="19" rx="2" fill="#8d939b"/><path d="M12 13 H20 M12 18 H20 M12 23 H20" stroke="#4a4f56" stroke-width="1.6" stroke-dasharray="2 2"/><rect x="13" y="5" width="6" height="4" fill="#c8ccd2"/>',
    smoke: '<rect x="10" y="9" width="12" height="19" rx="2" fill="#3e5a3a"/><rect x="10" y="14" width="12" height="3" fill="#e8e8e0"/><rect x="13" y="5" width="6" height="4" fill="#a8adb3"/><circle cx="24" cy="7" r="3" fill="#d8d8d8" opacity="0.7"/>',
    cknife: '<path d="M4 27 L9 22 L12 25 L7 30 Z" fill="#1d1f22"/><path d="M8 21 L13 26" stroke="#7f868f" stroke-width="2"/><path d="M11 21 L24 7 Q29 3 28 9 L14 24 Z" fill="#cfd5dc"/>',
    machete: '<path d="M3 28 L8 23 L10 25 L5 30 Z" fill="#202226"/><path d="M9 21 L25 4 Q31 2 29 8 L13 25 Z" fill="#bcc3cb"/>',
    crowbar: '<path d="M5 28 L24 9" stroke="#a8261e" stroke-width="3.2" stroke-linecap="round"/><path d="M24 9 Q28 4 23 3" stroke="#a8261e" stroke-width="3.2" fill="none" stroke-linecap="round"/>',
    golf: '<path d="M4 27 L22 7" stroke="#c4cad1" stroke-width="1.8"/><path d="M3 28 L8 23" stroke="#1a1b1e" stroke-width="3.2"/><ellipse cx="25" cy="6" rx="5" ry="3" fill="#2e3138" transform="rotate(-30 25 6)"/>',
    knuckles: '<rect x="4" y="14" width="24" height="6" rx="3" fill="#c9a24a"/><circle cx="8" cy="12" r="3.4" fill="none" stroke="#c9a24a" stroke-width="2"/><circle cx="14" cy="12" r="3.4" fill="none" stroke="#c9a24a" stroke-width="2"/><circle cx="20" cy="12" r="3.4" fill="none" stroke="#c9a24a" stroke-width="2"/><circle cx="26" cy="12" r="3.4" fill="none" stroke="#c9a24a" stroke-width="2"/>',
    shells: '<rect x="6" y="9" width="5" height="16" fill="#b82a22"/><rect x="13" y="9" width="5" height="16" fill="#b82a22"/><rect x="20" y="9" width="5" height="16" fill="#b82a22"/><rect x="6" y="22" width="19" height="4" fill="#c9a24a"/>',
  });

  // ---------- 3. Хваты, прицел, клипы ----------
  const P = H.pose, I = H.IDLE, CL = H.CLIPS;
  I.pistol = I.gun;
  I.nade = P({ AR: -0.2, ARZ: 0.1, FR: -0.85, WR: 1.0, AL: -0.15, ALZ: -0.1, FL: -0.5 });
  // ружьё «на изготовку»: ствол вниз-вперёд поперёк груди
  const RIF = { AR: -0.38, ARZ: -0.12, FR: -1.15, WR: 2.05, SY: 0.22, AL: -0.95, ALZ: 0.42, FL: -1.15 };
  I.rifle = P(RIF);
  // приклад у плеча, ствол на цель
  const AIMR = { AR: -0.62, ARZ: -0.22, FR: -1.5, WR: 2.12, SY: -0.12, SX: 0.02, AL: -1.42, ALZ: 0.6, FL: -0.2 };
  H.AIMP.pistol = H.AIMP.gun;
  H.AIMP.rifle = P(AIMR, I.rifle);
  const AIM = { AR: -1.55, ARZ: -0.08, FR: -0.03, WR: 1.57, SY: -0.3, AL: -1.4, ALZ: 0.45, FL: -0.55 };
  const a2 = (o, m) => Object.assign({}, o, m);
  CL.shoot.aim = true;
  Object.assign(CL, {
    // отдача пистолета: короткий подброс кисти; тяжёлый калибр и револьвер — сильнее, с отходом корпуса
    shootP: { hit: 0, left: true, aim: true, K: [[0, AIM], [0.1, a2(AIM, { AR: -1.68, FR: -0.14, WR: 1.4, SX: -0.03 }), 'outExpo'], [0.5, AIM, 'inOut'], [1, AIM]] },
    shootH: { hit: 0, left: true, aim: true, K: [[0, AIM], [0.1, a2(AIM, { AR: -1.84, FR: -0.3, WR: 1.3, SX: -0.07 }), 'outExpo'], [0.55, AIM, 'inOut'], [1, AIM]] },
    shootR: { hit: 0, left: true, aim: true, K: [[0, AIMR], [0.12, a2(AIMR, { AR: -0.72, FR: -1.55, WR: 2.02, SX: -0.07, AL: -1.5 }), 'outExpo'], [0.6, AIMR, 'inOut'], [1, AIMR]] },
    pump: { hit: 0, left: true, aim: true, K: [[0, AIMR], [0.35, a2(AIMR, { AL: -1.1, ALZ: 0.55, FL: -0.75 }), 'outQuad'], [0.7, AIMR, 'inQuad'], [1, AIMR]] },
    bolt: { hit: 0, left: true, aim: true, K: [[0, AIMR], [0.25, a2(AIMR, { AR: -0.45, WR: 2.3, SX: 0.06, AL: -1.25, FL: -0.5 }), 'outQuad'], [0.6, a2(AIMR, { AR: -0.45, WR: 2.3, SX: 0.06, AL: -1.25, FL: -0.5 })], [1, AIMR, 'inOut']] },
    reloadR: { hit: 0, left: true, K: [[0, {}], [0.15, { WR: 2.45, SY: 0.4, AL: -0.75, ALZ: 0.45, FL: -1.4 }, 'outQuad'], [0.35, { WR: 2.45, SY: 0.4, AL: -0.15, ALZ: 0.15, FL: -0.5 }, 'inOut'], [0.62, { WR: 2.45, SY: 0.4, AL: -0.8, ALZ: 0.5, FL: -1.45 }, 'inOut'], [0.78, { WR: 2.2, SY: 0.3, AL: -0.95, ALZ: 0.55, FL: -1.6 }, 'outExpo'], [1, {}, 'inOut']] },
    reloadP: { hit: 0, left: true, K: [[0, {}], [0.15, { AR: -0.75, ARZ: -0.2, FR: -1.55, WR: 2.4, SX: 0.1 }, 'outQuad'], [0.4, { AR: -0.75, ARZ: -0.2, FR: -1.55, WR: 2.4, SX: 0.1, AL: -0.1, ALZ: 0.1, FL: -0.4 }, 'inOut'], [0.7, { AR: -0.75, ARZ: -0.2, FR: -1.55, WR: 2.4, SX: 0.1, AL: -0.75, ALZ: 0.6, FL: -1.5 }, 'inOut'], [0.85, { AR: -0.8, ARZ: -0.2, FR: -1.5, WR: 2.2, SX: 0.1, AL: -0.85, ALZ: 0.62, FL: -1.6 }, 'outExpo'], [1, {}, 'inOut']] },
    reloadS: { hit: 0, left: true, K: [[0, {}], [0.15, { AR: -0.5, FR: -1.4, WR: 2.9, SX: 0.12, AL: -0.85, ALZ: 0.5, FL: -1.3 }, 'outQuad'], [0.45, { AR: -0.5, FR: -1.4, WR: 2.9, SX: 0.12, AL: -0.2, ALZ: 0.15, FL: -0.6 }, 'inOut'], [0.75, { AR: -0.5, FR: -1.4, WR: 2.9, SX: 0.12, AL: -0.85, ALZ: 0.5, FL: -1.4 }, 'inOut'], [0.85, { AR: -0.65, FR: -1.25, WR: 1.6, SX: 0.05, AL: -0.9, ALZ: 0.5, FL: -1.4 }, 'outExpo'], [1, {}, 'inOut']] },
    shell: { hit: 0, left: true, K: [[0, {}], [0.4, { AL: -0.35, ALZ: 0.15, FL: -0.9 }, 'inOut'], [0.78, { AL: -0.9, ALZ: 0.5, FL: -1.35 }, 'outQuad'], [1, {}, 'inOut']] },
    butt: { hit: 0.5, left: true, K: [[0, {}], [0.36, { AR: -0.15, ARZ: -0.35, FR: -1.85, WR: 2.9, SY: 0.6, AL: -0.85, ALZ: 0.5, FL: -1.3 }, 'in'], [0.5, { AR: -1.05, ARZ: -0.1, FR: -1.15, WR: 2.6, SY: -0.55, SX: 0.22, AL: -1.25, ALZ: 0.6, FL: -0.9 }, 'outExpo'], [0.7, { AR: -1.0, ARZ: -0.1, FR: -1.15, WR: 2.6, SY: -0.55, SX: 0.22, AL: -1.2, ALZ: 0.6, FL: -0.9 }], [1, {}, 'inOut']] },
  });
  H.rebuildClips();

  // ---------- 4. Пулы: трассеры, гильзы, магазины, дыры, вспышки ----------
  const Q = new THREE.Quaternion(), V = new THREE.Vector3(), V2 = new THREE.Vector3(), S = new THREE.Vector3(), MX = new THREE.Matrix4(), UP = new THREE.Vector3(0, 1, 0), ZAX = new THREE.Vector3(0, 0, 1);
  const HIDE = new THREE.Matrix4().makeScale(0, 0, 0);
  let POOL = null;
  const canvasTex = (w, h, draw) => {
    const cv = document.createElement('canvas');
    cv.width = w;
    cv.height = h;
    draw(cv.getContext('2d'), w, h);
    const t = new THREE.CanvasTexture(cv);
    return t;
  };
  function initPools() {
    if (POOL) return POOL;
    const grp = R3.fxGroup;
    const inst = (geo, mat, n) => {
      const m = new THREE.InstancedMesh(geo, mat, n);
      for (let i = 0; i < n; i++) m.setMatrixAt(i, HIDE);
      m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      m.frustumCulled = false;
      m.count = n;
      grp.add(m);
      return m;
    };
    // трассер: светящаяся полоска от 0 до 1 по z
    const trG = new THREE.BoxGeometry(1, 1, 1).translate(0, 0, 0.5);
    const trM = new THREE.MeshBasicMaterial({ color: '#ffd88a', transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false });
    const tr = inst(trG, trM, 64);
    tr.renderOrder = 4;
    // гильзы: латунь (у дроби — красные)
    const csG = new THREE.CylinderGeometry(1, 1, 1, 7).rotateX(HALF);
    const csM = new THREE.MeshPhongMaterial({ color: '#ffffff', shininess: 80, specular: new THREE.Color('#887755'), emissive: new THREE.Color('#1a140a') });
    const cs = inst(csG, csM, 96);
    cs.setColorAt(0, C('#d0a64a'));
    for (let i = 1; i < 96; i++) cs.setColorAt(i, C('#d0a64a'));
    // выброшенные магазины
    const mgG = new THREE.BoxGeometry(1, 1, 1);
    const mgM = new THREE.MeshLambertMaterial({ color: '#2a2c30' });
    const mg = inst(mgG, mgM, 12);
    // дырки от пуль: тёмный центр и сколы
    const hTex = canvasTex(64, 64, (c, w) => {
      const g = c.createRadialGradient(32, 32, 0, 32, 32, 30);
      g.addColorStop(0, 'rgba(8,8,8,1)');
      g.addColorStop(0.18, 'rgba(20,18,16,1)');
      g.addColorStop(0.32, 'rgba(60,56,50,0.85)');
      g.addColorStop(0.6, 'rgba(120,112,100,0.35)');
      g.addColorStop(1, 'rgba(120,112,100,0)');
      c.fillStyle = g;
      c.fillRect(0, 0, w, w);
      c.strokeStyle = 'rgba(25,22,20,0.7)';
      c.lineWidth = 1.2;
      for (let i = 0; i < 7; i++) {
        const a = (i / 7) * TAU + rnd() * 0.6;
        c.beginPath();
        c.moveTo(32 + Math.cos(a) * 5, 32 + Math.sin(a) * 5);
        c.lineTo(32 + Math.cos(a) * (12 + rnd() * 14), 32 + Math.sin(a) * (12 + rnd() * 14));
        c.stroke();
      }
    });
    const hoG = new THREE.PlaneGeometry(1, 1);
    const hoM = new THREE.MeshLambertMaterial({ map: hTex, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 });
    const ho = inst(hoG, hoM, 160);
    // вспышка у ствола: звезда из трёх плоскостей
    const fTex = canvasTex(64, 64, (c, w) => {
      c.translate(32, 32);
      const g = c.createRadialGradient(0, 0, 0, 0, 0, 30);
      g.addColorStop(0, 'rgba(255,255,235,1)');
      g.addColorStop(0.25, 'rgba(255,220,130,0.95)');
      g.addColorStop(0.6, 'rgba(255,140,40,0.45)');
      g.addColorStop(1, 'rgba(255,90,20,0)');
      c.fillStyle = g;
      c.beginPath();
      for (let i = 0; i < 16; i++) {
        const a = (i / 16) * TAU, r = i % 2 ? 9 : 30;
        c.lineTo(Math.cos(a) * r, Math.sin(a) * r);
      }
      c.closePath();
      c.fill();
      c.beginPath();
      c.arc(0, 0, 10, 0, TAU);
      c.fill();
    });
    const fl = [];
    const flM = new THREE.MeshBasicMaterial({ map: fTex, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
    // боковые языки пламени: вытянутая звезда
    const sTex = canvasTex(64, 32, (c) => {
      const g = c.createLinearGradient(0, 0, 64, 0);
      g.addColorStop(0, 'rgba(255,250,220,1)');
      g.addColorStop(0.35, 'rgba(255,200,90,0.9)');
      g.addColorStop(1, 'rgba(255,90,20,0)');
      c.fillStyle = g;
      c.beginPath();
      c.moveTo(0, 6);
      c.lineTo(20, 9);
      c.lineTo(64, 16);
      c.lineTo(20, 23);
      c.lineTo(0, 26);
      c.closePath();
      c.fill();
    });
    const slM = new THREE.MeshBasicMaterial({ map: sTex, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
    const front = new THREE.PlaneGeometry(1, 1);
    const side = new THREE.PlaneGeometry(1, 0.5).translate(0.5, 0, 0).rotateY(-HALF);
    for (let i = 0; i < 6; i++) {
      const g = new THREE.Group();
      const a = new THREE.Mesh(front, flM);
      const b = new THREE.Mesh(side, slM);
      const c2 = new THREE.Mesh(side, slM);
      c2.rotation.z = HALF;
      g.add(a, b, c2);
      g.visible = false;
      g.renderOrder = 5;
      grp.add(g);
      fl.push({ g, a, t: 0 });
    }
    POOL = { tr, cs, mg, ho, fl, TR: [], CS: [], MG: [], HO: [], hi: 0, ci: 0, mi: 0 };
    for (let i = 0; i < 64; i++) POOL.TR.push({ i, on: false, x: 0, h: 0, z: 0, dx: 0, dh: 0, dz: 0, L: 0, d: 0, sp: 0, w: 0.012 });
    for (let i = 0; i < 96; i++) POOL.CS.push({ i, on: false, x: 0, h: 0, z: 0, vx: 0, vh: 0, vz: 0, rx: 0, ry: 0, rz: 0, wx: 0, wy: 0, t: 0, rest: false, s: 1, red: false, b: 0 });
    for (let i = 0; i < 12; i++) POOL.MG.push({ i, on: false, x: 0, h: 0, z: 0, vx: 0, vh: 0, vz: 0, rx: 0, ry: 0, rz: 0, wx: 0, wy: 0, t: 0, rest: false, sx: 0.02, sy: 0.1, sz: 0.03, b: 0 });
    for (let i = 0; i < 160; i++) POOL.HO.push({ i, on: false, t: 0, veh: null, lx: 0, ly: 0, lh: 0, nx: 0, nz: 0, s: 0.1 });
    return POOL;
  }
  Gn.pools = () => initPools();
  // прогрев шейдеров пулов (трассеры, гильзы, дыры, вспышки) вместе с остальными — без фриза на первом выстреле
  const warm0 = R3.warmup;
  R3.warmup = function () {
    warm0.apply(this, arguments);
    try {
      const P0 = initPools();
      for (const f of P0.fl) f.g.visible = true;
      R3.renderer.compile(R3.scene, R3.camera);
      for (const f of P0.fl) f.g.visible = false;
    } catch (e) {}
  };

  // трассер из точки по направлению на длину d
  Gn.tracer = function (x, h, z, dx, dh, dz, d, o) {
    const P0 = initPools();
    if (d < 1.5) return;
    let t = null;
    for (const q of P0.TR) if (!q.on) { t = q; break; }
    if (!t) return;
    t.on = true;
    t.x = x; t.h = h; t.z = z;
    t.dx = dx; t.dh = dh; t.dz = dz;
    t.d = d;
    t.L = 0;
    t.sp = (o && o.sp) || 260;
    t.len = (o && o.len) || Math.min(3.2, 1 + d * 0.06);
    t.w = (o && o.w) || 0.011;
    t.held = !!(o && o.held);
  };
  function updTracers(dt) {
    const P0 = POOL;
    let dirty = false;
    for (const t of P0.TR) {
      if (!t.on) continue;
      dirty = true;
      if (!t.held) t.L += t.sp * dt;
      const head = Math.min(t.d, t.L);
      const tail = Math.max(0, t.L - t.len);
      if (tail >= t.d) {
        t.on = false;
        P0.tr.setMatrixAt(t.i, HIDE);
        continue;
      }
      const len = Math.max(0.05, head - tail);
      V.set(t.x + t.dx * tail, t.h + t.dh * tail, t.z + t.dz * tail);
      V2.set(t.dx, t.dh, t.dz);
      Q.setFromUnitVectors(ZAX, V2);
      S.set(t.w, t.w, len);
      MX.compose(V, Q, S);
      P0.tr.setMatrixAt(t.i, MX);
    }
    if (dirty) P0.tr.instanceMatrix.needsUpdate = true;
  }
  // гильза из окна затвора
  const EUL = new THREE.Euler();
  Gn.casing = function (x, h, z, ang, red, big) {
    const P0 = initPools();
    const c = P0.CS[P0.ci];
    P0.ci = (P0.ci + 1) % P0.CS.length;
    const ra = ang - HALF + (rnd() - 0.5) * 0.5; // вправо от ствола
    const sp = 2.2 + rnd() * 1.4;
    Object.assign(c, { on: true, x, h, z, vx: Math.cos(ra) * sp - Math.cos(ang) * 0.6, vz: Math.sin(ra) * sp - Math.sin(ang) * 0.6, vh: 2.2 + rnd() * 1.2, rx: rnd() * 3, ry: ang, rz: 0, wx: 18 + rnd() * 12, wy: (rnd() - 0.5) * 10, t: 0, rest: false, b: 0, red: !!red });
    c.s = red ? 1.6 : big ? 1.3 : 1;
    P0.cs.setColorAt(c.i, red ? C('#b02a22') : C('#d0a64a'));
    P0.cs.instanceColor.needsUpdate = true;
  };
  Gn.magDrop = function (x, h, z, ang, sx, sy, sz) {
    const P0 = initPools();
    const c = P0.MG[P0.mi];
    P0.mi = (P0.mi + 1) % P0.MG.length;
    Object.assign(c, { on: true, x, h, z, vx: Math.cos(ang) * 0.4, vz: Math.sin(ang) * 0.4, vh: -0.5, rx: 0.2, ry: ang, rz: 0, wx: (rnd() - 0.5) * 6, wy: (rnd() - 0.5) * 4, t: 0, rest: false, b: 0, sx: sx || 0.024, sy: sy || 0.11, sz: sz || 0.035 });
  };
  let tinkT = 0;
  function physBits(list, mesh, dt, kind) {
    let dirty = false;
    const w = G().world;
    for (const c of list) {
      if (!c.on) continue;
      c.t += dt;
      if (c.t > (kind === 'mag' ? 25 : 12)) {
        c.on = false;
        mesh.setMatrixAt(c.i, HIDE);
        dirty = true;
        continue;
      }
      if (c.rest) continue;
      dirty = true;
      c.vh -= 9.8 * dt;
      c.x += c.vx * dt;
      c.z += c.vz * dt;
      c.h += c.vh * dt;
      c.rx += c.wx * dt;
      c.ry += c.wy * dt;
      if (w.solid(c.x, c.z)) {
        c.x -= c.vx * dt * 1.5;
        c.z -= c.vz * dt * 1.5;
        c.vx *= -0.3;
        c.vz *= -0.3;
      }
      const g0 = gy(c.x, c.z) + (kind === 'mag' ? c.sz / 2 : 0.006);
      if (c.h < g0) {
        c.h = g0;
        if (c.vh < -1.2 && c.b < 3) {
          c.b++;
          c.vh = -c.vh * 0.35;
          c.vx *= 0.5;
          c.vz *= 0.5;
          c.wx *= 0.5;
          if (kind === 'case' && tinkT <= 0 && near(c.x, c.z, 9)) {
            tinkT = 0.05;
            gsnd('tink', c.x, c.z, { k: c.red ? 0.6 : 1 });
          }
        } else {
          c.rest = true;
          c.vx = c.vz = c.vh = 0;
          c.rx = kind === 'mag' ? HALF : HALF;
          c.rz = kind === 'mag' ? 0 : rnd() * TAU;
        }
      }
      V.set(c.x, c.h, c.z);
      Q.setFromEuler(EUL.set(c.rx, c.ry, c.rz, 'YXZ'));
      if (kind === 'mag') S.set(c.sx, c.sy, c.sz);
      else S.set(0.0045 * c.s, 0.0045 * c.s, 0.02 * c.s * (c.red ? 1.6 : 1));
      MX.compose(V, Q, S);
      mesh.setMatrixAt(c.i, MX);
    }
    if (dirty) mesh.instanceMatrix.needsUpdate = true;
  }
  // дырка от пули: точка и нормаль поверхности (машина — дырка едет вместе с ней)
  Gn.hole = function (x, h, z, nx, ny, nz, s, veh) {
    const P0 = initPools();
    const o = P0.HO[P0.hi];
    P0.hi = (P0.hi + 1) % P0.HO.length;
    o.on = true;
    o.t = 0;
    o.s = (s || 0.11) * (0.8 + rnd() * 0.4);
    o.veh = veh || null;
    o.rot = rnd() * TAU;
    if (veh) {
      // в координатах машины
      const ca = Math.cos(veh.ang), sa = Math.sin(veh.ang);
      const dx = x - veh.x, dz = z - veh.y;
      o.lx = dx * ca + dz * sa;
      o.ly = -dx * sa + dz * ca;
      o.lh = h - veh.gy;
      o.nl = Math.atan2(nz, nx) - veh.ang;
      o.ny = ny;
      placeVehHole(o);
      return;
    }
    V.set(x + nx * 0.012, h + ny * 0.012, z + nz * 0.012);
    V2.set(nx, ny, nz);
    Q.setFromUnitVectors(ZAX, V2);
    Q.multiply(QR.setFromAxisAngle(ZAX, o.rot));
    S.set(o.s, o.s, 1);
    MX.compose(V, Q, S);
    P0.ho.setMatrixAt(o.i, MX);
    P0.ho.instanceMatrix.needsUpdate = true;
  };
  const QR = new THREE.Quaternion();
  function placeVehHole(o) {
    const v = o.veh;
    const ca = Math.cos(v.ang), sa = Math.sin(v.ang);
    const na = v.ang + o.nl;
    const nx = Math.cos(na) * Math.sqrt(1 - o.ny * o.ny), nz = Math.sin(na) * Math.sqrt(1 - o.ny * o.ny);
    V.set(v.x + o.lx * ca - o.ly * sa + nx * 0.015, v.gy + o.lh + o.ny * 0.015, v.y + o.lx * sa + o.ly * ca + nz * 0.015);
    V2.set(nx, o.ny, nz).normalize();
    Q.setFromUnitVectors(ZAX, V2);
    Q.multiply(QR.setFromAxisAngle(ZAX, o.rot));
    S.set(o.s * 0.8, o.s * 0.8, 1);
    MX.compose(V, Q, S);
    POOL.ho.setMatrixAt(o.i, MX);
  }
  function updHoles(dt) {
    let dirty = false;
    const vs = G().vehs || [];
    for (const o of POOL.HO) {
      if (!o.on || !o.veh) continue;
      const v = o.veh;
      if (v.hp <= 0 || vs.indexOf(v) < 0 || !v.view || !v.view.group.visible) {
        o.on = false;
        o.veh = null;
        POOL.ho.setMatrixAt(o.i, HIDE);
        dirty = true;
        continue;
      }
      if (v.mode === 'parked' && o.placed) continue;
      placeVehHole(o);
      o.placed = true;
      dirty = true;
    }
    if (dirty) POOL.ho.instanceMatrix.needsUpdate = true;
  }
  // вспышка у дульного среза
  Gn.flash = function (x, h, z, dx, dh, dz, size) {
    const P0 = initPools();
    let f = P0.fl[0];
    for (const q of P0.fl) if (q.t <= 0) { f = q; break; }
    f.t = 0.045 + rnd() * 0.02;
    f.g.visible = true;
    f.g.position.set(x, h, z);
    V2.set(dx, dh, dz).normalize();
    f.g.quaternion.setFromUnitVectors(ZAX, V2);
    f.g.rotateZ(rnd() * TAU);
    const s = (size || 0.3) * (0.8 + rnd() * 0.5);
    f.g.scale.set(s, s, s);
  };
  function updFlashes(dt) {
    for (const f of POOL.fl) {
      if (f.t <= 0) continue;
      f.t -= dt;
      if (f.t <= 0) f.g.visible = false;
    }
  }
  Gn.updatePools = function (dt) {
    if (!POOL) return;
    if (tinkT > 0) tinkT -= dt;
    updTracers(dt);
    physBits(POOL.CS, POOL.cs, dt, 'case');
    physBits(POOL.MG, POOL.mg, dt, 'mag');
    updHoles(dt);
    updFlashes(dt);
  };
  Gn.resetPools = function () {
    if (!POOL) return;
    for (const t of POOL.TR) { t.on = false; POOL.tr.setMatrixAt(t.i, HIDE); }
    for (const c of POOL.CS) { c.on = false; POOL.cs.setMatrixAt(c.i, HIDE); }
    for (const c of POOL.MG) { c.on = false; POOL.mg.setMatrixAt(c.i, HIDE); }
    for (const o of POOL.HO) { o.on = false; o.veh = null; POOL.ho.setMatrixAt(o.i, HIDE); }
    for (const f of POOL.fl) { f.t = 0; f.g.visible = false; }
    POOL.tr.instanceMatrix.needsUpdate = POOL.cs.instanceMatrix.needsUpdate = POOL.mg.instanceMatrix.needsUpdate = POOL.ho.instanceMatrix.needsUpdate = true;
  };

  // ---------- 5. Звук: синтез выстрелов по классам ----------
  let NB = null;
  const ac = () => {
    const S0 = J.Sfx;
    if (!S0 || !S0.ac || (J.Game.settings && !J.Game.settings.sound) || document.hidden) return null;
    return S0.ac;
  };
  const outNode = (a) => (J.Sfx.out && J.Sfx.out()) || a.destination;
  const noiseBuf = (a) => {
    if (NB) return NB;
    const n = a.sampleRate;
    NB = a.createBuffer(1, n, n);
    const d = NB.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = rnd() * 2 - 1;
    return NB;
  };
  const env = (g, t, a, peak, dec) => {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), t + a);
    g.gain.exponentialRampToValueAtTime(0.0001, t + a + dec);
  };
  // шум через фильтр
  const nz = (a, out, t, dur, type, f0, f1, q, peak, att) => {
    const s = a.createBufferSource();
    s.buffer = noiseBuf(a);
    s.start(t, rnd() * 0.5);
    s.stop(t + dur + 0.05);
    const f = a.createBiquadFilter();
    f.type = type;
    f.frequency.setValueAtTime(f0, t);
    if (f1 && f1 !== f0) f.frequency.exponentialRampToValueAtTime(f1, t + dur);
    f.Q.value = q || 0.7;
    const g = a.createGain();
    env(g, t, att || 0.002, peak, dur);
    s.connect(f).connect(g).connect(out);
  };
  const tone = (a, out, t, dur, type, f0, f1, peak, att) => {
    const o = a.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(f0, t);
    if (f1 && f1 !== f0) o.frequency.exponentialRampToValueAtTime(f1, t + dur);
    o.start(t);
    o.stop(t + dur + 0.05);
    const g = a.createGain();
    env(g, t, att || 0.002, peak, dur);
    o.connect(g).connect(out);
  };
  // профили: треск (полоса, длина, громкость), удар (частоты, длина, громкость), хвост (длина, громкость, срез)
  const SND = {
    pistol: { c: [2600, 0.045, 0.55], b: [170, 60, 0.12, 0.7], t: [0.32, 0.16, 1800] },
    heavy: { c: [1700, 0.08, 0.7], b: [115, 38, 0.24, 1.0], t: [0.65, 0.26, 1100] },
    revolver: { c: [2000, 0.06, 0.6], b: [135, 48, 0.17, 0.85], t: [0.45, 0.2, 1400] },
    smg: { c: [3300, 0.032, 0.42], b: [210, 85, 0.07, 0.45], t: [0.2, 0.09, 2000] },
    rifle: { c: [2300, 0.055, 0.72], b: [125, 45, 0.18, 0.9], t: [0.75, 0.24, 1500] },
    lmg: { c: [2100, 0.055, 0.7], b: [110, 42, 0.17, 0.9], t: [0.55, 0.2, 1300] },
    shotgun: { c: [1300, 0.09, 0.62], b: [92, 34, 0.3, 1.1], t: [0.9, 0.3, 900] },
    sniper: { c: [2800, 0.06, 0.95], b: [100, 34, 0.3, 1.15], t: [1.4, 0.33, 1300] },
  };
  // звук в точке мира: громкость и глухость по расстоянию, панорама по камере
  function spot(a, x, z, loud) {
    const c = R3.cam;
    const d = Math.hypot(x - c.tx, z - c.tz);
    const ang = Math.atan2(z - c.tz, x - c.tx) - c.yaw;
    const k = loud / (1 + d / 14);
    const out = outNode(a);
    let node = out;
    if (a.createStereoPanner) {
      const pn = a.createStereoPanner();
      pn.pan.value = J.clamp(Math.sin(ang) * Math.min(1, d / 6), -0.9, 0.9);
      pn.connect(node);
      node = pn;
    }
    const lp = a.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = Math.max(700, 16000 / (1 + d / 18));
    lp.connect(node);
    return { out: lp, k, d };
  }
  let vcount = 0, vtime = 0;
  function gsnd(kind, x, z, o) {
    const a = ac();
    if (!a) return;
    o = o || {};
    const t = a.currentTime;
    // не больше ~40 голосов выстрелов за полсекунды
    if (t - vtime > 0.5) { vtime = t; vcount = 0; }
    if (++vcount > 40 && !o.prio) return;
    try {
      const pr = SND[kind];
      if (pr) {
        const sp = spot(a, x, z, (o.mine ? 1.25 : 1) * (o.k || 1));
        if (sp.k < 0.015) return;
        const f = 1 + (rnd() - 0.5) * 0.1;
        const far = sp.d > 35;
        if (!far) nz(a, sp.out, t, pr.c[1], 'bandpass', pr.c[0] * f, pr.c[0] * 0.6, 0.9, pr.c[2] * sp.k);
        nz(a, sp.out, t, pr.c[1] * 0.6, 'highpass', 4500, 3000, 0.5, pr.c[2] * 0.5 * sp.k * (far ? 0.2 : 1));
        tone(a, sp.out, t, pr.b[2], 'sine', pr.b[0] * f, pr.b[1], pr.b[3] * sp.k);
        nz(a, sp.out, t, pr.b[2] * 0.8, 'lowpass', 900, 200, 0.7, pr.b[3] * 0.6 * sp.k);
        // хвост: эхо улицы
        nz(a, sp.out, t + 0.01, pr.t[0], 'lowpass', pr.t[2], pr.t[2] * 0.35, 0.5, pr.t[1] * sp.k * (far ? 1.6 : 1), 0.01);
        if (kind === 'sniper' || kind === 'rifle' || kind === 'shotgun') nz(a, sp.out, t + 0.16 + rnd() * 0.08, pr.t[0] * 0.8, 'lowpass', pr.t[2] * 0.6, 300, 0.5, pr.t[1] * 0.35 * sp.k, 0.03);
        return;
      }
      const sp = spot(a, x, z, o.k || 1);
      const out = sp.out, k = sp.k;
      if (kind === 'dry') tone(a, out, t, 0.02, 'square', 2400, 1800, 0.06 * k);
      else if (kind === 'tink') {
        tone(a, out, t, 0.06, 'sine', 4200 + rnd() * 1800, 3800, 0.03 * k);
        tone(a, out, t + 0.07, 0.04, 'sine', 5200 + rnd() * 1000, 4600, 0.015 * k);
      } else if (kind === 'magout') {
        nz(a, out, t, 0.03, 'bandpass', 1400, 900, 2, 0.12 * k);
        tone(a, out, t, 0.03, 'square', 900, 500, 0.03 * k);
      } else if (kind === 'magin') {
        nz(a, out, t, 0.04, 'bandpass', 1000, 700, 2, 0.18 * k);
        tone(a, out, t, 0.02, 'square', 1500, 1100, 0.04 * k);
      } else if (kind === 'slide') {
        nz(a, out, t, 0.05, 'bandpass', 2200, 1200, 1.5, 0.12 * k);
        nz(a, out, t + 0.09, 0.04, 'bandpass', 2600, 1800, 1.8, 0.16 * k);
      } else if (kind === 'pump') {
        nz(a, out, t, 0.07, 'bandpass', 900, 600, 1.2, 0.25 * k);
        nz(a, out, t + 0.16, 0.06, 'bandpass', 1300, 800, 1.2, 0.28 * k);
      } else if (kind === 'bolt') {
        nz(a, out, t, 0.04, 'bandpass', 1800, 1200, 2, 0.14 * k);
        nz(a, out, t + 0.12, 0.05, 'bandpass', 1500, 900, 2, 0.14 * k);
        nz(a, out, t + 0.3, 0.04, 'bandpass', 2400, 1500, 2, 0.16 * k);
      } else if (kind === 'shell') nz(a, out, t, 0.05, 'bandpass', 1200, 800, 1.6, 0.14 * k);
      else if (kind === 'whiz') nz(a, out, t, 0.12, 'bandpass', 5000, 1800, 3, 0.22 * k, 0.03);
      else if (kind === 'ric') tone(a, out, t, 0.22, 'sine', 2400 + rnd() * 1200, 700, 0.05 * k, 0.005);
      else if (kind === 'hitflesh') {
        nz(a, out, t, 0.06, 'lowpass', 900, 300, 0.7, 0.3 * k);
        tone(a, out, t, 0.05, 'sine', 140, 70, 0.18 * k);
      } else if (kind === 'hitmetal') {
        for (const m of [1, 2.7, 5.1]) tone(a, out, t, 0.35 / Math.sqrt(m), 'sine', 900 * m * (0.95 + rnd() * 0.1), 0, (0.06 / m) * k);
        nz(a, out, t, 0.03, 'highpass', 3000, 0, 0.7, 0.12 * k);
      } else if (kind === 'hitglass') {
        if (J.Sfx.glass) J.Sfx.glass();
      } else if (kind === 'hitwall') {
        nz(a, out, t, 0.05, 'bandpass', 1800, 700, 1, 0.16 * k);
        nz(a, out, t, 0.12, 'lowpass', 600, 200, 0.7, 0.08 * k);
      } else if (kind === 'hitdirt') nz(a, out, t, 0.09, 'lowpass', 700, 200, 0.7, 0.12 * k);
      else if (kind === 'catch') {
        tone(a, out, t, 0.12, 'sine', 3200, 2600, 0.05 * k);
        nz(a, out, t, 0.03, 'highpass', 5000, 0, 0.7, 0.1 * k);
      } else if (kind === 'flashbang') {
        nz(a, out, t, 0.2, 'highpass', 2500, 1200, 0.5, 1.0 * k);
        tone(a, out, t, 0.3, 'sine', 140, 40, 1.0 * k);
        nz(a, out, t, 1.2, 'lowpass', 1500, 300, 0.5, 0.4 * k, 0.01);
      } else if (kind === 'ring') {
        tone(a, out, t, o.dur || 3, 'sine', 3600, 3400, 0.05 * k, 0.05);
      } else if (kind === 'pin') {
        tone(a, out, t, 0.05, 'sine', 3800, 3000, 0.04 * k);
        nz(a, out, t + 0.03, 0.03, 'bandpass', 2800, 2000, 2, 0.08 * k);
      } else if (kind === 'hiss') nz(a, out, t, o.dur || 1.5, 'highpass', 2500, 1800, 0.5, 0.12 * k, 0.1);
      else if (kind === 'crackle') {
        for (let i = 0; i < 4; i++) nz(a, out, t + rnd() * 0.25, 0.015, 'bandpass', 1500 + rnd() * 2500, 0, 3, (0.05 + rnd() * 0.06) * k);
        nz(a, out, t, 0.3, 'lowpass', 400, 200, 0.7, 0.04 * k, 0.05);
      } else if (kind === 'whoomp') {
        nz(a, out, t, 0.6, 'lowpass', 500, 150, 0.7, 0.5 * k, 0.04);
        tone(a, out, t, 0.4, 'sine', 90, 45, 0.3 * k, 0.03);
      }
    } catch (err) {}
  }
  Gn.snd = gsnd;
  Gn.reloadSnd = function (u, d, ph) {
    const x = u.x, z = u.y;
    const tm = G().timers;
    if (ph === 'shell') return gsnd('shell', x, z, { k: 1 });
    if (d.rclip === 'reload' || d.model === 'revolver' || d.model === 'mista') {
      // барабан: откинуть, высыпать гильзы, вставить, закрыть
      gsnd('magout', x, z);
      const hp = H.handPos(u);
      for (let i = 0; i < 6 - Math.max(0, H.magOf(u, H.heldId(u))); i++) Gn.casing(hp.x, hp.h, hp.z, u.face + Math.PI * 0.5 + (rnd() - 0.5), false, false);
      tm.push({ t: d.reload * 0.6, fn: () => gsnd('magin', u.x, u.y) });
      tm.push({ t: d.reload * 0.85, fn: () => gsnd('slide', u.x, u.y, { k: 0.6 }) });
      return;
    }
    if (d.model === 'sawnoff') {
      gsnd('magout', x, z);
      const hp = H.handPos(u);
      Gn.casing(hp.x, hp.h, hp.z, u.face + Math.PI, true, true);
      Gn.casing(hp.x, hp.h, hp.z, u.face + Math.PI, true, true);
      tm.push({ t: d.reload * 0.55, fn: () => gsnd('shell', u.x, u.y) });
      tm.push({ t: d.reload * 0.8, fn: () => gsnd('pump', u.x, u.y, { k: 0.6 }) });
      return;
    }
    gsnd('magout', x, z);
    // пустой магазин падает на землю
    const hp = H.handPos(u);
    const big = d.grip === 'rifle';
    if (d.model !== 'pump') Gn.magDrop(hp.x, hp.h - 0.08, hp.z, u.face, big ? 0.026 : 0.022, d.model === 'lmg' ? 0.09 : big ? 0.16 : 0.11, big ? 0.04 : 0.03);
    tm.push({ t: d.reload * 0.62, fn: () => gsnd('magin', u.x, u.y) });
    tm.push({ t: d.reload * 0.85, fn: () => gsnd(d.act === 'bolt' ? 'bolt' : 'slide', u.x, u.y) });
  };
  Gn.reloadDone = function (u, d) {
    if (d.shell) {
      u.anim = { type: 'item', iclip: 'pump', t: 0.4, max: 0.4 };
      gsnd('pump', u.x, u.y);
    }
  };
  Gn.clink = function (o, sp) {
    gsnd('tink', o.x, o.y, { k: Math.min(2, sp / 4) * 2 });
  };

  // ---------- 6. Баллистика: луч в 3D ----------
  // результат: kind — ent/veh/wall/ground/none, точка, нормаль, часть тела
  const HIT = { kind: 'none', d: 0, x: 0, h: 0, z: 0, nx: 0, ny: 1, nz: 0, o: null, part: '', v: null, tyre: -1, glass: false };
  const SKIP = new Set();
  // высота препятствия в клетке (здание, стена, скала); -99 — пусто
  function topAt(w, ix, iz) {
    if (!w.inb(ix, iz)) return 999;
    const i = iz * w.W + ix;
    const bi = w.bid[i];
    if (bi) return w.buildingTop(w.buildings[bi - 1], ix + 0.5, iz + 0.5);
    if (!w.solid(ix + 0.5, iz + 0.5)) return -99;
    if (w.t[i] === J.T.WALL) return w.tileH(ix, iz) + 2.5;
    return w.tileH(ix, iz) + 3;
  }
  Gn.topAt = (x, z) => topAt(G().world, Math.floor(x), Math.floor(z));
  // луч из (x,h,z) по (dx,dh,dz) — единичный; skip — кого не задевать; team — чьи пули (своих не бьёт)
  Gn.trace = function (x, h, z, dx, dh, dz, maxD, shooter, o) {
    const g = G(), w = g.world;
    o = o || {};
    HIT.kind = 'none';
    HIT.o = HIT.v = null;
    HIT.tyre = -1;
    HIT.glass = false;
    HIT.part = '';
    // стены и земля: шаг 0.2 м, уточнение до границы клетки
    let wallD = maxD, nx = 0, ny = 1, nzz = 0, ground = false;
    const step = 0.2;
    let px = x, ph = h, pz = z;
    let pix = Math.floor(x), piz = Math.floor(z);
    for (let s = step; s <= maxD; s += step) {
      const cx = x + dx * s, ch = h + dh * s, cz = z + dz * s;
      const ix = Math.floor(cx), iz = Math.floor(cz);
      if (ix !== pix || iz !== piz) {
        const top = topAt(w, ix, iz);
        if (ch < top) {
          // граница клетки: по какой оси вошли
          let t;
          if (ix !== pix) {
            const bx = dx > 0 ? ix : ix + 1;
            t = (bx - x) / dx;
            nx = dx > 0 ? -1 : 1;
            nzz = 0;
          } else {
            const bz = dz > 0 ? iz : iz + 1;
            t = (bz - z) / dz;
            nzz = dz > 0 ? -1 : 1;
            nx = 0;
          }
          ny = 0;
          wallD = Math.max(0.05, Math.min(s, t));
          break;
        }
        pix = ix;
        piz = iz;
      }
      const g0 = w.groundY(cx, cz);
      if (ch < g0) {
        // уточнение по высоте
        const k = (ph - w.groundY(px, pz)) / Math.max(1e-4, ph - w.groundY(px, pz) - (ch - g0));
        wallD = s - step + step * J.clamp(k, 0, 1);
        nx = nzz = 0;
        ny = 1;
        ground = true;
        break;
      }
      px = cx;
      ph = ch;
      pz = cz;
    }
    let bd = wallD, best = null, part = '';
    // люди: вертикальные цилиндры (голова — верхние 28 см)
    for (const e of g.ents) {
      if (e === shooter || e.dead || SKIP.has(e)) continue;
      if (shooter && e.owner && J.ownerOf(e) === shooter) continue;
      if (shooter && e.team === shooter.team && e.kind !== 'civ' && !o.all) continue;
      if (e.kind === 'summon' && !e.model && !e.look) continue;
      const ex = e.x - x, ez = e.y - z;
      const b = ex * dx + ez * dz;
      const hor = Math.hypot(dx, dz) || 1e-6;
      if (b < 0) continue;
      const r = (e.r || 0.3) * 1.05;
      // 2D пересечение с кругом (в плоскости земли, луч проецируется)
      const tc = b / (hor * hor);
      const qx = x + dx * tc - e.x, qz = z + dz * tc - e.y;
      const perp2 = qx * qx + qz * qz;
      if (perp2 > r * r) continue;
      const th = Math.sqrt(r * r - perp2) / hor;
      let t0 = tc - th;
      if (t0 < 0) t0 = 0;
      if (t0 > bd) continue;
      const sc = e.scale || 1;
      const base = w.groundY(e.x, e.y) + (e.z || 0);
      const top = base + 1.78 * sc;
      // по высоте: вход и выход из цилиндра
      const h0 = h + dh * t0, h1 = h + dh * (tc + th);
      const lo = Math.min(h0, h1), hi = Math.max(h0, h1);
      if (hi < base || lo > top) continue;
      const crouch = e.react && (e.react.type === 'down' || e.react.type === 'slump');
      if (crouch && lo > base + 0.5) continue;
      const hh = J.clamp(h0, base, top);
      bd = t0;
      best = e;
      part = hh > top - 0.27 * sc && !crouch ? 'head' : hh < base + 0.8 * sc ? 'legs' : 'body';
    }
    // машины
    let veh = null;
    if (g.vehs && g.vehs.length && J.Pw && J.Pw.vehAt) {
      for (let s = 0.4; s < bd; s += 0.25) {
        const cx = x + dx * s, cz = z + dz * s, ch = h + dh * s;
        const v = J.Pw.vehAt(cx, cz, 0.02, shooter && shooter.inCar);
        if (!v) continue;
        if (ch > v.gy + v.vt.H * 0.98 || ch < v.gy + 0.08) continue;
        veh = v;
        bd = s;
        best = null;
        // где попали: шина, стекло
        const ca = Math.cos(v.ang), sa = Math.sin(v.ang);
        const lx = (cx - v.x) * ca + (cz - v.y) * sa, ly = -(cx - v.x) * sa + (cz - v.y) * ca;
        const L = v.vt.L / 2, W = v.vt.W / 2;
        HIT.tyre = -1;
        if (ch < v.gy + 0.62 && Math.abs(Math.abs(lx) - (L - 0.78)) < 0.42) HIT.tyre = (lx > 0 ? 0 : 2) + (ly > 0 ? 1 : 0);
        HIT.glass = ch > v.gy + v.vt.H * 0.6;
        // нормаль: ближайшая грань
        const ex = L - Math.abs(lx), ey = W - Math.abs(ly);
        if (ch > v.gy + v.vt.H * 0.9) { nx = 0; ny = 1; nzz = 0; }
        else if (ex < ey) { const sg = Math.sign(lx) || 1; nx = ca * sg; nzz = sa * sg; ny = 0; }
        else { const sg = Math.sign(ly) || 1; nx = -sa * sg; nzz = ca * sg; ny = 0; }
        break;
      }
    }
    HIT.d = bd;
    HIT.x = x + dx * bd;
    HIT.h = h + dh * bd;
    HIT.z = z + dz * bd;
    if (best) {
      HIT.kind = 'ent';
      HIT.o = best;
      HIT.part = part;
    } else if (veh) {
      HIT.kind = 'veh';
      HIT.v = veh;
      HIT.nx = nx; HIT.ny = ny; HIT.nz = nzz;
    } else if (bd < maxD) {
      HIT.kind = ground ? 'ground' : 'wall';
      HIT.nx = nx; HIT.ny = ny; HIT.nz = nzz;
    }
    return HIT;
  };

  // ---------- 7. Прицел игрока ----------
  const CAMD = new THREE.Vector3();
  const AIMO = { x: 0, h: 0, z: 0, dx: 0, dh: 0, dz: 0, tg: null, px: 0, ph: 0, pz: 0, free: false };
  // точка прицела: куда смотрит центр экрана (мышь) или ближайший враг (телефон, без захвата)
  Gn.freeAim = () => !J.Input.touch && (J.Input.locked || G().player.ads);
  Gn.aimPoint = function (p, range) {
    const cam = R3.camera;
    const out = AIMO;
    out.tg = null;
    out.free = Gn.freeAim();
    if (out.free) {
      cam.getWorldDirection(CAMD);
      const cx = cam.position.x, ch = cam.position.y, cz = cam.position.z;
      SKIP.add(p);
      const r = Gn.trace(cx, ch, cz, CAMD.x, CAMD.y, CAMD.z, range + 8, p, { all: false });
      SKIP.delete(p);
      out.px = r.x;
      out.ph = r.h;
      out.pz = r.z;
      if (r.kind === 'ent') out.tg = r.o;
      // помощь в прицеливании от бедра: враг рядом с перекрестием
      if (!out.tg && !p.ads) {
        let best = null, ba = 0.05;
        for (const e of G().ents) {
          if (e.dead || !J.hostile(p, e)) continue;
          const ex = e.x - cx, ez = e.y - cz, eh = w0().groundY(e.x, e.y) + 1.25 * (e.scale || 1) - ch;
          const L = Math.hypot(ex, eh, ez);
          if (L > range) continue;
          const dot = (ex * CAMD.x + eh * CAMD.y + ez * CAMD.z) / L;
          const ang = Math.acos(J.clamp(dot, -1, 1));
          if (ang < ba) {
            ba = ang;
            best = e;
          }
        }
        if (best) {
          out.tg = best;
          out.px = best.x;
          out.pz = best.y;
          out.ph = w0().groundY(best.x, best.y) + (best.z || 0) + 1.25 * (best.scale || 1);
        }
      }
      return out;
    }
    const inp = J.Input;
    const base = inp.touch ? p.face : R3.cam.yaw;
    const tg = J.nearestHostile(p, range, inp.touch ? 0.7 : 0.45, base);
    if (tg) {
      out.tg = tg;
      out.px = tg.x;
      out.pz = tg.y;
      out.ph = w0().groundY(tg.x, tg.y) + (tg.z || 0) + 1.25 * (tg.scale || 1);
    } else {
      out.px = p.x + Math.cos(base) * range;
      out.pz = p.y + Math.sin(base) * range;
      out.ph = w0().groundY(p.x, p.y) + 1.35;
    }
    return out;
  };
  const w0 = () => G().world;
  // дульный срез: по модели в руке (её мировая матрица), иначе — от кисти
  const MZ = { x: 0, h: 0, z: 0, fx: 0, fh: 0, fz: 0 };
  const MV = new THREE.Vector3(), MF = new THREE.Vector3();
  Gn.muzzle = function (u, d) {
    const v = u.view;
    const m = v && v.heldMesh;
    if (m && v.group.visible && m.visible) {
      m.updateWorldMatrix(true, false);
      MV.set(0, d.grip === 'rifle' ? 0.045 : 0.035, d.muz || 0.15).applyMatrix4(m.matrixWorld);
      MF.set(0, 0, 1).transformDirection(m.matrixWorld);
      MZ.x = MV.x; MZ.h = MV.y; MZ.z = MV.z;
      MZ.fx = MF.x; MZ.fh = MF.y; MZ.fz = MF.z;
      return MZ;
    }
    const hp = H.handPos(u);
    const a = u.face;
    MZ.x = hp.x + Math.cos(a) * (d.muz || 0.15);
    MZ.z = hp.z + Math.sin(a) * (d.muz || 0.15);
    MZ.h = hp.h + 0.04;
    MZ.fx = Math.cos(a); MZ.fh = 0; MZ.fz = Math.sin(a);
    return MZ;
  };

  // ---------- 8. Стенды против пуль ----------
  // что делает стенд цели с пулей: ловит / отбивает / рассекает / плавит / (Пистолз — у стрелка)
  const BSTAND = { star_platinum: 'catch', star_platinum_tw: 'catch', the_world: 'deflect', crazy_diamond: 'deflect', king_crimson: 'deflect', silver_chariot: 'slice', magicians_red: 'melt', gold_experience: 'deflect', gold_experience_requiem: 'deflect', made_in_heaven: 'deflect', c_moon: 'deflect', stone_free: 'deflect', tusk: 'deflect', d4c: 'deflect', soft_wet: 'deflect', the_hand: 'erase', cream: 'erase', white_album: 'deflect', kraft_work: 'catch' };
  Gn.BSTAND = BSTAND;
  function standStop(o, sh, d, hx, hh, hz, dx, dh, dz) {
    if (!o.stand || !o.standOut || o.st.silence > 0 || !o.canAct()) return null;
    const how = BSTAND[o.stand.id];
    if (!how) return null;
    if (o.cds && o.cds._bst > 0) return null;
    const lvl = o.stand.lvl || 1;
    let ch = (how === 'catch' ? 0.55 : how === 'melt' ? 0.45 : 0.4) + lvl * 0.035;
    if (o.isPlayer) ch += 0.1;
    if (d.cat === 'sniper') ch *= 0.6;
    if (d.pellets) ch *= 0.5;
    if (rnd() > Math.min(0.9, ch)) return null;
    o.cds._bst = d.auto ? 0.05 : 0.12;
    const sd = J.STANDS[o.stand.id];
    // стенд встаёт на пути пули
    const px = o.x - dx * 0.55, pz = o.y - dz * 0.55, ph = hh;
    o.anim = { type: 'punch', t: 0.16, max: 0.16, stand: true, tgt: sh };
    const nr = near(o.x, o.y, 35);
    if (how === 'catch') {
      if (nr) {
        if (pwOk()) J.Pw.glow(px, ph, pz, 5, '#ffffff', 1.5, 0.05, 0.25, 0);
        if (fxOk()) J.Fx.sparks(px, ph, pz, 3, Math.atan2(-dz, -dx), '#ffe9a8', 2);
        gsnd('catch', px, pz);
        if (!(o._bsT > G().t)) {
          o._bsT = G().t + 1.2;
          J.R3.text(o.x, o.y, o.stand.id === 'kraft_work' ? 'ЗАСТРЯЛА!' : 'ПОЙМАЛ!', 'tgold', 0.8, 2.3);
        }
      }
      // пойманная пуля падает к ногам
      Gn.casing(px, ph, pz, Math.atan2(dz, dx) + Math.PI, false, false);
      return { x: px, h: ph, z: pz, how };
    }
    if (how === 'slice') {
      if (nr) {
        if (fxOk()) J.Fx.sparks(px, ph, pz, 8, Math.atan2(dz, dx) + Math.PI * 0.5, '#e8f0ff', 6);
        if (pwOk()) J.Pw.gseg(px - dz * 0.4, ph + 0.25, pz + dx * 0.4, px + dz * 0.4, ph - 0.25, pz - dx * 0.4, 0.012, '#dfe8ff');
        gsnd('hitmetal', px, pz, { k: 0.8 });
        if (!(o._bsT > G().t)) {
          o._bsT = G().t + 1.2;
          J.R3.text(o.x, o.y, 'РАССЕЧЕНА!', 'tgold', 0.8, 2.3);
        }
      }
      Gn.casing(px, ph, pz, Math.atan2(dz, dx) + 2, false, false);
      Gn.casing(px, ph, pz, Math.atan2(dz, dx) - 2, false, false);
      return { x: px, h: ph, z: pz, how };
    }
    if (how === 'melt') {
      if (nr && pwOk()) {
        J.Pw.fire(px, ph, pz, 6, 0.1, 1.2, 0.25);
        J.Pw.glow(px, ph, pz, 6, '#ff9a3a', 2, 0.06, 0.4, 2);
      }
      if (nr) gsnd('crackle', px, pz, { k: 0.8 });
      return { x: px, h: ph, z: pz, how };
    }
    if (how === 'erase') {
      if (nr && pwOk()) J.Pw.glow(px, ph, pz, 8, sd.c1 || '#9a7aff', 1.5, 0.08, 0.4, 0);
      if (nr && !(o._bsT > G().t)) {
        o._bsT = G().t + 1.2;
        J.R3.text(o.x, o.y, 'СТЁРТА', 'tgold', 0.8, 2.3);
      }
      return { x: px, h: ph, z: pz, how };
    }
    // отбил: искры и рикошет в сторону
    if (nr) {
      if (fxOk()) J.Fx.sparks(px, ph, pz, 7, Math.atan2(-dz, -dx), '#ffe9a8', 6);
      gsnd('ric', px, pz);
      if (!(o._bsT > G().t)) {
        o._bsT = G().t + 1.2;
        J.R3.text(o.x, o.y, 'ОТБИЛ!', 'tgold', 0.8, 2.3);
      }
    }
    const ra = Math.atan2(dz, dx) + Math.PI + (rnd() - 0.5) * 2.2;
    Gn.tracer(px, ph, pz, Math.cos(ra), (rnd() - 0.3) * 0.4, Math.sin(ra), 6 + rnd() * 8, { len: 1.2 });
    return { x: px, h: ph, z: pz, how };
  }
  Gn.standStop = standStop;

  // ---------- 9. Выстрел ----------
  const partMul = (d, part) => (part === 'head' ? d.hs || 2 : part === 'legs' ? 0.72 : 1);
  // урон по попаданию одной пули/дробины
  function applyHit(u, d, r, dmg, dx, dh, dz, pell) {
    const g = G();
    const ang = Math.atan2(dz, dx);
    const nr = near(r.x, r.z, 40);
    if (r.kind === 'ent') {
      const o = r.o;
      if (o.kind === 'civ') {
        o.downT = 2.5;
        if (o.ai) o.ai.fear = 8;
        if (nr && pwOk()) J.Pw.blood(r.x, r.h, r.z, 8, ang, 2.5);
        if (u.isPlayer) {
          J.Veh.crime(1, u.x, u.y);
          H.say('civshot', 'Ты подстрелил прохожего! Полиция уже едет.', 'red');
        }
        return;
      }
      // стенд цели против пули
      const ss = Gn.standStop(o, u, d, r.x, r.h, r.z, dx, dh, dz);
      if (ss) {
        r.x = ss.x;
        r.h = ss.h;
        r.z = ss.z;
        return;
      }
      const head = r.part === 'head';
      const k = partMul(d, r.part);
      const fall = r.d <= d.range ? 1 : Math.max(0.3, 1 - (r.d - d.range) / (d.range * 1.5));
      const kn = (d.knock || 1.4) * (pell ? 1.6 / d.pellets : 1) * (head ? 1.3 : 1);
      J.hurt(o, dmg * k * fall, u, { ang, knock: kn, stun: (d.stun || 0.2) * (pell ? 0.4 : 1), crit: head, kind: 'phys', fxColor: '#ffd27a', gdmg: 18 + d.dmg * 0.3, unblockable: !(o.stand && o.standOut), bullet: true, head });
      if (nr) {
        if (pwOk()) {
          J.Pw.blood(r.x, r.h, r.z, head ? 14 : 8, ang, head ? 4 : 3);
          // брызги за спину на землю
          if (!pell || rnd() < 0.3) J.Pw.decal('blood', o.x + dx * (0.8 + rnd()), o.y + dz * (0.8 + rnd()), 0.6 + rnd() * 0.5, 14);
        }
        gsnd('hitflesh', r.x, r.z, { k: u.isPlayer ? 1 : 0.7 });
      }
      if (head && u.isPlayer && !pell) J.R3.text(o.x, o.y, 'В ГОЛОВУ!', 'tcrit', 0.9, 2.4);
      if (u.isPlayer) Gn.hitMark(head, o.dead);
      return;
    }
    if (r.kind === 'veh') {
      const v = r.v;
      J.Veh.damage(v, dmg * (pell ? 0.3 : 0.45), u);
      if (r.tyre >= 0 && !(v.flatMask & (1 << r.tyre)) && (d.dmg >= 10 || rnd() < 0.3)) {
        v.flatMask = (v.flatMask || 0) | (1 << r.tyre);
        v.flat = (v.flat || 0) + 1;
        v.flatPull = (v.flatPull || 0) + (r.tyre % 2 ? 1 : -1);
        if (nr) {
          gsnd('hiss', r.x, r.z, { k: 1.2, dur: 0.8 });
          if (pwOk()) J.Pw.smoke(r.x, r.h, r.z, 6, '#c8c8c8', 0.3, 0.8, 0.6, 0.2, 0.5);
          if (u.isPlayer) J.R3.text(v.x, v.y, 'Шина пробита!', 'tmiss', 0.9, 1.6);
        }
      }
      if (nr) {
        if (fxOk()) J.Fx.sparks(r.x, r.h, r.z, r.glass ? 3 : 6, ang + Math.PI, '#ffd27a', 5);
        if (r.glass) {
          if (pwOk()) J.Pw.shards(r.x, r.h, r.z, 6, '#cfe6f0', 2.5, 0.025, 0, ang, 1.2, 9, 0.8);
          gsnd('hitglass', r.x, r.z);
        } else gsnd('hitmetal', r.x, r.z, { k: 0.7 });
        if (!pell || rnd() < 0.4) Gn.hole(r.x, r.h, r.z, r.nx, r.ny, r.nz, r.glass ? 0.14 : 0.06, v);
      }
      // водитель напуган: машина рвёт с места
      if (v.mode === 'ai' && v.driver === true && rnd() < 0.3 && J.Veh.toFree) v.scared = 3;
      return;
    }
    if (r.kind === 'wall' || r.kind === 'ground') {
      if (!nr) return;
      const wall = r.kind === 'wall';
      const w = G().world;
      const water = !wall && w.isWater(r.x, r.z);
      if (water) {
        if (pwOk()) {
          J.Pw.puff(r.x, r.h + 0.05, r.z, 0, 3.2, 0, 0.5, 0.05, 0.12, '#dff0ff', null, 9, 0.8, false);
          J.Pw.smoke(r.x, r.h, r.z, 2, '#e8f4ff', 0.18, 0.4, 1.2, 0.05, 0.5);
        }
        return;
      }
      const dust = wall ? '#a59d90' : '#9a8a70';
      if (fxOk()) J.Fx.sparks(r.x + r.nx * 0.03, r.h + r.ny * 0.03, r.z + r.nz * 0.03, wall ? 5 : 2, Math.atan2(r.nz, r.nx), wall ? '#ffd27a' : '#e0c890', 4);
      if (pwOk()) {
        J.Pw.puff(r.x + r.nx * 0.05, r.h + r.ny * 0.05, r.z + r.nz * 0.05, r.nx * 1.2, 0.5 + r.ny * 1.2, r.nz * 1.2, 0.6, 0.06, 0.35, dust, null, 0.5, 0.7, false);
        if (!pell || rnd() < 0.3) J.Pw.shards(r.x + r.nx * 0.04, r.h, r.z + r.nz * 0.04, 3, wall ? '#8a8378' : '#6a5a40', 2, 0.02, 1, Math.atan2(r.nz, r.nx), 1, 9, 0.6);
      }
      if (!pell || rnd() < 0.5) Gn.hole(r.x, r.h, r.z, r.nx, r.ny, r.nz, wall ? 0.1 : 0.13);
      gsnd(wall ? 'hitwall' : 'hitdirt', r.x, r.z, { k: 0.8 });
      if (wall && rnd() < 0.18) gsnd('ric', r.x, r.z, { k: 0.7 });
    }
  }
  Gn.applyHit = applyHit;
  // пуля прошла рядом с игроком — свист
  function whiz(u, x, h, z, dx, dh, dz, d) {
    const p = G().player;
    if (!p || u === p || p.dead) return;
    const ex = p.x - x, ez = p.y - z;
    const t = ex * dx + ez * dz;
    if (t < 1 || t > d) return;
    const qx = x + dx * t - p.x, qz = z + dz * t - p.y;
    const pd = Math.hypot(qx, qz);
    if (pd < 2.2 && pd > 0.25) {
      gsnd('whiz', p.x + qx, p.y + qz, { k: 1.2 });
      if (fxOk() && pd < 1) J.Fx.trauma(0.05);
    }
  }
  // Секс Пистолз игрока: промах — пулю пинают в ближайшего врага
  function pistolsKick(u, d, r, dmg) {
    if (!u.stand || u.stand.id !== 'sex_pistols' || !u.standOut || u.st.silence > 0) return false;
    let best = null, bd = 14;
    for (const e of G().ents) {
      if (e.dead || !J.hostile(u, e)) continue;
      const dd = J.dist(r.x, r.z, e.x, e.y);
      if (dd < bd) {
        bd = dd;
        best = e;
      }
    }
    if (!best) return false;
    const th = w0().groundY(best.x, best.y) + 1.2;
    const kx = r.x - (r.kind === 'wall' ? r.nx * -0.1 : 0), kz = r.z, kh = Math.max(r.h, w0().groundY(r.x, r.z) + 0.3);
    const ex = best.x - kx, eh = th - kh, ez = best.y - kz;
    const L = Math.hypot(ex, eh, ez) || 1;
    Gn.tracer(kx, kh, kz, ex / L, eh / L, ez / L, L, { sp: 120, w: 0.014 });
    if (pwOk()) J.Pw.glow(kx, kh, kz, 6, '#ffe066', 2, 0.06, 0.3, 0);
    if (near(kx, kz, 35) && (u._pkT || 0) < G().t) {
      u._pkT = G().t + 1;
      J.R3.text(kx, kz, J.R.pick(['No.1, пас!', 'Йииха!', 'No.5, пинай!', 'No.7!']), 'tgold', 0.7, 1.4);
    }
    G().timers.push({
      t: L / 120,
      fn: () => {
        if (best.dead) return;
        J.hurt(best, dmg * (d.mista ? 1.45 : 1.2), u, { ang: Math.atan2(ez, ex), knock: d.knock || 1.4, stun: d.stun || 0.2, kind: 'phys', unblockable: !(best.stand && best.standOut), bullet: true });
        if (pwOk()) J.Pw.blood(best.x, th, best.y, 8, Math.atan2(ez, ex), 3);
        if (u.isPlayer) Gn.hitMark(false, best.dead);
      },
    });
    if (u.isPlayer) J.P.standXp(u, 1);
    return true;
  }
  // зависшие в остановленном времени пули
  const FROZEN = [];
  Gn.FROZEN = FROZEN;
  // одна пуля: луч, трассер, попадание
  function bullet(u, d, x, h, z, dx, dh, dz, dmg, pell) {
    const g = G();
    // в своём остановленном времени пуля пролетает метр и зависает
    if (g.timestop && (g.timestop.by === u || (u.isPlayer && u.tsMove > 0))) {
      const k = 0.7 + rnd() * 0.5;
      const fz = { u, d, x: x + dx * k, h: h + dh * k, z: z + dz * k, dx, dh, dz, dmg, pell, t: 0 };
      FROZEN.push(fz);
      Gn.tracer(x, h, z, dx, dh, dz, k, { held: true, len: k, w: 0.008 });
      return;
    }
    const maxD = (d.range || 45) * 1.8;
    let r = Gn.trace(x, h, z, dx, dh, dz, maxD, u);
    const rr = { kind: r.kind, d: r.d, x: r.x, h: r.h, z: r.z, nx: r.nx, ny: r.ny, nz: r.nz, o: r.o, part: r.part, v: r.v, tyre: r.tyre, glass: r.glass };
    if (rr.kind !== 'ent' && u.isPlayer && pistolsKick(u, d, rr, dmg)) {
      Gn.tracer(x, h, z, dx, dh, dz, rr.d, { w: pell ? 0.008 : 0.011 });
      return;
    }
    applyHit(u, d, rr, dmg, dx, dh, dz, pell);
    // пробитие (снайперская): дальше за первым
    if (d.pierce && rr.kind === 'ent' && !rr.o.dead) {
      SKIP.add(rr.o);
      const r2 = Gn.trace(rr.x + dx * 0.1, rr.h + dh * 0.1, rr.z + dz * 0.1, dx, dh, dz, maxD - rr.d, u);
      SKIP.clear();
      const r3 = { kind: r2.kind, d: r2.d + rr.d, x: r2.x, h: r2.h, z: r2.z, nx: r2.nx, ny: r2.ny, nz: r2.nz, o: r2.o, part: r2.part, v: r2.v, tyre: r2.tyre, glass: r2.glass };
      if (r3.kind !== 'none') applyHit(u, d, r3, dmg * 0.6, dx, dh, dz, false);
      rr.d = r3.d;
    }
    SKIP.clear();
    const tl = Math.hypot(rr.x - x, rr.h - h, rr.z - z);
    if (!pell || rnd() < 0.6) Gn.tracer(x, h, z, dx, dh, dz, tl, { w: d.cat === 'sniper' ? 0.016 : pell ? 0.007 : 0.011, sp: d.cat === 'sniper' ? 420 : 260 });
    if (!u.isPlayer) whiz(u, x, h, z, dx, dh, dz, tl);
  }
  // время снова пошло — зависшие пули летят
  function updFrozen(dt) {
    if (!FROZEN.length) return;
    const g = G();
    for (let i = FROZEN.length - 1; i >= 0; i--) {
      const f = FROZEN[i];
      f.t += dt;
      if (g.timestop && (g.timestop.by === f.u || (f.u.isPlayer && f.u.tsMove > 0))) {
        // застывшая пуля: блик и короткий росчерк
        if (pwOk() && near(f.x, f.z, 40) && rnd() < 0.25) J.Pw.orb(f.x, f.h, f.z, 0.03 + rnd() * 0.03, '#fff6d0');
        continue;
      }
      FROZEN.splice(i, 1);
      if (f.u.dead) continue;
      bullet(f.u, f.d, f.x, f.h, f.z, f.dx, f.dh, f.dz, f.dmg, f.pell);
    }
  }
  // случайное отклонение внутри конуса s
  const DIR = { x: 0, h: 0, z: 0 };
  function cone(dx, dh, dz, s) {
    const a = rnd() * TAU, r = s * Math.sqrt(rnd());
    const yaw = Math.atan2(dz, dx) + Math.cos(a) * r;
    const pit = Math.asin(J.clamp(dh, -1, 1)) + Math.sin(a) * r;
    const cp = Math.cos(pit);
    DIR.x = Math.cos(yaw) * cp;
    DIR.h = Math.sin(pit);
    DIR.z = Math.sin(yaw) * cp;
    return DIR;
  }
  // разброс игрока сейчас
  Gn.spread = function (p, d) {
    const mv = Math.hypot(p.vx || 0, p.vy || 0);
    let s = (p.ads ? d.ads : d.spread) + (p.bloom || 0) * (p.ads ? 0.55 : 1) + mv * (p.ads ? 0.006 : 0.012);
    if (p.airborne || p.dash) s += 0.08;
    if (p.st && p.st.stun > 0) s += 0.1;
    if (p.ads && d.scope && mv > 0.5) s += 0.02;
    return s;
  };
  // ИИ: прицел в грудь (иногда в голову) с ошибкой по дистанции, движению цели и дыму
  const TGT = { x: 0, h: 0, z: 0 };
  function npcAimPoint(e, tg) {
    const base = w0().groundY(tg.x, tg.y) + (tg.z || 0);
    TGT.x = tg.x;
    TGT.z = tg.y;
    TGT.h = base + (rnd() < 0.08 ? 1.62 : 1.15) * (tg.scale || 1);
    return TGT;
  }
  Gn.npcSpread = function (e, d, tg, dist) {
    const tv = Math.hypot(tg.vx || 0, tg.vy || 0);
    let s = d.spread * 0.7 + 0.03 + tv * 0.007 + Math.min(0.05, dist * 0.0012);
    if (e.cop) s *= 0.85;
    if (e.mobType === 'thug' || e.mobType === 'bandit') s *= 1.15;
    if (Gn.inSmoke && (Gn.inSmoke(e.x, e.y) || Gn.inSmoke(tg.x, tg.y))) s += 0.25;
    if (tg.isPlayer && tg.ads) s *= 1.1;
    if (e.ai && e.ai.burstN > 3) s *= 1.2;
    return s;
  };
  // главный выстрел (игрок и ИИ)
  Gn.fire = function (u) {
    const g = G();
    const id = H.heldId(u);
    const d = H.def(id);
    if (!d || d.cls !== 'gun') return false;
    if (!u.canAct() || u.channel || u.dash || (J.Cb && J.Cb.isDown(u)) || u.inCar) return false;
    // ружьё: выстрел прерывает дозарядку
    if (u.reloadT > 0) {
      if (d.shell && H.magOf(u, id) > 0 && u.cds.item <= 0) {
        u.reloadT = 0;
        u.anim = null;
      } else return false;
    }
    // кулдаун с остатком: темп стрельбы не зависит от частоты кадров
    if (u.cds.item > 0.001) return false;
    // полуавтомат — по отдельному нажатию
    if (u.isPlayer && !d.auto && !u.trigUp) return false;
    const mag = H.magOf(u, id);
    if (mag <= 0) {
      if (!H.reload(u)) {
        gsnd('dry', u.x, u.y);
        u.cds.item = 0.3;
        u.trigUp = false;
      }
      return false;
    }
    // револьвер Мисты: четвёртый патрон — к беде (иногда осечка)
    if (d.mista && u.isPlayer && d.mag - mag === 3) {
      if (near(u.x, u.y, 30)) J.R3.text(u.x, u.y, J.R.pick(['Четвёртый… не к добру!', 'Только не четыре!']), 'tsay', 1.2);
      if (rnd() < 0.35) {
        H.setMag(u, id, mag - 1);
        gsnd('dry', u.x, u.y, { k: 1.5 });
        u.cds.item = 0.55;
        u.trigUp = false;
        u.anim = { type: 'item', iclip: 'shootP', t: 0.2, max: 0.2 };
        H.dirty = true;
        return false;
      }
    }
    H.setMag(u, id, mag - 1);
    u.cds.item = d.rate + J.clamp(u.cds.item || 0, -d.rate * 0.5, 0);
    u.trigUp = false;
    u.aimT = 1.6;
    u.lastShotT = g.t;
    const pl = u.isPlayer;
    const range = d.range || 45;
    // точка прицела
    let ax, ah, az, tg = null;
    if (pl) {
      const ap = Gn.aimPoint(u, range * 1.5);
      ax = ap.px; ah = ap.ph; az = ap.pz;
      tg = ap.tg;
    } else {
      tg = u.ai && u.ai.target;
      if (!tg || tg.dead) return false;
      const tp = npcAimPoint(u, tg);
      ax = tp.x; ah = tp.h; az = tp.z;
    }
    // лицом к цели — раньше, чем считать дуло
    const fa = Math.atan2(az - u.y, ax - u.x);
    u.face = fa;
    const mz = Gn.muzzle(u, d);
    let dx = ax - mz.x, dh = ah - mz.h, dz = az - mz.z;
    let L = Math.hypot(dx, dh, dz);
    // точка прицела за спиной у дула (стена вплотную) — стреляем прямо по стволу
    if (L < 0.6 || dx * Math.cos(fa) + dz * Math.sin(fa) < 0.2) {
      dx = Math.cos(fa); dz = Math.sin(fa); dh = 0; L = 1;
    }
    dx /= L; dh /= L; dz /= L;
    u.aimPitch = J.clamp(Math.asin(dh), -0.8, 0.8);
    const sprd = pl ? Gn.spread(u, d) : Gn.npcSpread(u, d, tg, J.dist(u.x, u.y, tg.x, tg.y));
    // урон
    let dmg;
    if (pl) dmg = d.dmg * (1 + u.stats.agi * 0.02) * (1 + (u.lvl - 1) * 0.015);
    else {
      const md = J.MOBS[u.mobType];
      dmg = d.dmg * 0.55 * (md ? u.dmg / md.dmg : 1) * (u.dmgMul || 1) * (tg && tg.isPlayer ? 1 : 0.8);
    }
    const n = d.pellets || 1;
    // дробь: общий разброс + свой у каждой дробины
    const bx = dx, bh = dh, bz = dz;
    let cdx = bx, cdh = bh, cdz = bz;
    if (n > 1) {
      const c = cone(bx, bh, bz, pl ? (p_ads(u) ? 0.004 : 0.012) : sprd * 0.4);
      cdx = c.x; cdh = c.h; cdz = c.z;
    }
    for (let i = 0; i < n; i++) {
      const c = cone(cdx, cdh, cdz, n > 1 ? d.spread * (pl && u.ads ? 0.75 : 1) : sprd);
      bullet(u, d, mz.x, mz.h, mz.z, c.x, c.h, c.z, dmg, n > 1);
    }
    // вспышка, дым, свет, гильза
    const nr = near(u.x, u.y, 45);
    if (nr) {
      const big = d.snd === 'shotgun' || d.snd === 'heavy' || d.snd === 'sniper';
      Gn.flash(mz.x, mz.h, mz.z, mz.fx, mz.fh, mz.fz, big ? 0.45 : d.grip === 'rifle' ? 0.36 : 0.26);
      if (pwOk()) {
        J.Pw.light(mz.x, mz.h, mz.z, '#ffc870', big ? 3.2 : 2.2, big ? 9 : 7, 0.06);
        J.Pw.puff(mz.x + mz.fx * 0.1, mz.h, mz.z + mz.fz * 0.1, mz.fx * 0.9, 0.25, mz.fz * 0.9, big ? 1.3 : 0.9, 0.06, big ? 0.6 : 0.35, '#c8c4bc', null, -0.15, big ? 0.45 : 0.3, false);
      }
      if (d.case && !d.act) {
        const hp = MZ;
        Gn.casing(hp.x - hp.fx * (d.muz * 0.75), hp.h + 0.02, hp.z - hp.fz * (d.muz * 0.75), fa, false, d.grip === 'rifle');
      }
    }
    gsnd(d.snd || 'pistol', u.x, u.y, { mine: pl, prio: pl });
    // анимация отдачи и затвор
    const grip = d.grip || 'pistol';
    const sc = grip === 'rifle' ? 'shootR' : d.snd === 'heavy' || d.snd === 'revolver' || d.snd === 'shotgun' ? 'shootH' : 'shootP';
    u.anim = { type: 'item', iclip: sc, t: 0.28, max: 0.28 };
    if (d.act) {
      g.timers.push({
        t: Math.min(0.3, d.rate * 0.35),
        fn: () => {
          if (u.dead || H.heldId(u) !== id) return;
          u.anim = { type: 'item', iclip: d.act, t: d.rate * 0.6, max: d.rate * 0.6 };
          gsnd(d.act, u.x, u.y, { k: pl ? 1 : 0.7 });
          if (near(u.x, u.y, 30)) {
            const m2 = Gn.muzzle(u, d);
            Gn.casing(m2.x - m2.fx * d.muz * 0.8, m2.h + 0.02, m2.z - m2.fz * d.muz * 0.8, u.face, d.act === 'pump', true);
          }
        },
      });
    }
    // отдача и раскрытие разброса
    u.bloom = Math.min(d.auto ? 0.075 : 0.1, (u.bloom || 0) + (d.bloom || 0));
    if (pl) {
      const k = (d.kick || 0.03) * (u.ads ? 0.65 : 1) * (0.8 + rnd() * 0.4);
      Gn.recoil(u, k, d);
      if (fxOk()) J.Fx.trauma(Math.min(0.3, 0.05 + (d.kick || 0.03) * 1.6));
    }
    J.scare(u.x, u.y, 28);
    // выстрел в городе — полиция слышит (очередь — громче)
    if (pl && w0().cityAt(u.x, u.y) && J.Veh && J.Veh.copNear) {
      H.shotsHeard = (H.shotsHeard || 0) + (J.Veh.copNear(u.x, u.y, 45) ? 0.4 : 0.14) * (d.auto ? 0.6 : 1);
      if (H.shotsHeard >= 0.5) {
        J.Veh.crime(H.shotsHeard, u.x, u.y);
        H.shotsHeard = 0;
      }
    }
    // магазин пуст — перезарядка сама
    if (H.magOf(u, id) === 0 && (!pl || cnt(u, d.ammo) > 0)) g.timers.push({ t: Math.min(0.35, d.rate + 0.05), fn: () => { if (H.heldId(u) === id) H.reload(u); } });
    if (pl) {
      J.P.trainStat(u, 'agi', 0.05);
      H.dirty = true;
    }
    return true;
  };
  const p_ads = (u) => !!u.ads;
  // отдача камеры: ствол подбрасывает, потом частично возвращается
  Gn.recoil = function (p, k, d) {
    const c = R3.cam;
    const ky = k * (0.9 + rnd() * 0.2);
    const kx = (rnd() - 0.5) * k * (d.auto ? 0.6 : 0.35);
    c.pitch = J.clamp(c.pitch - ky * (Gn.freeAim() ? 1 : 0.3), -0.45, 1.25);
    c.yaw += kx;
    p.recoilBack = (p.recoilBack || 0) + ky * 0.55;
  };
  Gn.hitMark = function () {};
  H.fire = Gn.fire;

  // ---------- 10. Обновление ----------
  Gn.update = function (dt) {
    const g = G();
    const p = g.player;
    if (!p || !g.world) return;
    initPools();
    Gn.updatePools(dt);
    updFrozen(dt);
    // разброс сходится, отдача возвращается
    for (const e of g.ents) {
      // разброс копится в очереди и сходится после паузы
      if (e.bloom > 0 && g.t - (e.lastShotT || 0) > 0.14) e.bloom = Math.max(0, e.bloom - dt * (0.1 + e.bloom * 2.5));
      if (e.cds && e.cds._bst > 0) e.cds._bst -= dt;
    }
    if (p.recoilBack > 0) {
      const k = Math.min(p.recoilBack, dt * 0.6);
      p.recoilBack -= k;
      if (Gn.freeAim() && !(J.Input.mouse.l && H.held(p) && H.held(p).auto)) R3.cam.pitch = J.clamp(R3.cam.pitch + k, -0.45, 1.25);
    }
    if (p.aimPitch && !(p.aimT > 0) && !p.ads) p.aimPitch *= Math.max(0, 1 - dt * 6);
    // пробитые шины: искры от дисков на скорости
    if (g.vehs && pwOk()) {
      for (const v of g.vehs) {
        if (!v.flat || v.hp <= 0 || Math.abs(v.vf || 0) < 5 || !near(v.x, v.y, 40) || rnd() > dt * 18) continue;
        const ca = Math.cos(v.ang), sa = Math.sin(v.ang);
        for (let k = 0; k < 4; k++) {
          if (!(v.flatMask & (1 << k))) continue;
          const lx = (k < 2 ? 1 : -1) * (v.vt.L / 2 - 0.78), ly = (k % 2 ? 1 : -1) * (v.vt.W / 2 - 0.1);
          if (fxOk()) J.Fx.sparks(v.x + lx * ca - ly * sa, v.gy + 0.08, v.y + lx * sa + ly * ca, 3, v.ang + Math.PI, '#ffd27a', 4);
        }
      }
    }
  };
  Gn.reset = function () {
    FROZEN.length = 0;
    Gn.resetPools();
  };
})();
