'use strict';
// Камера от третьего лица в духе GTA: жёсткое следование без запаздывания, «пружинная штанга»,
// которая при препятствии укорачивается (а не прыгает вверх), смещение за плечо,
// авто-разворот за спину при движении (в машине, на телефоне и без захвата мыши).
// Столкновения: луч DDA по столбцам клеток (Amanatides–Woo) с высотами зданий, башен и скал.
(function () {
  const R3 = J.R3;
  const hl = (h, dt) => 1 - Math.pow(0.5, dt / h); // доля сближения за dt при полупериоде h — не зависит от FPS

  R3.cam = {
    yaw: -Math.PI / 2,
    pitch: 0.24,
    dist: 5.6, // желаемая длина штанги (пешком)
    carDist: 8.5, // желаемая длина штанги (в машине)
    arm: 5.6, // текущая длина после столкновений
    tx: 0, ty: undefined, tz: 0,
    shake: 0,
    fov: 60,
    idle: 9, // секунд без ручного поворота
    follow: false, // авто-разворот за спину пешком
    near: false,
    veryNear: false,
    lift: 0,
    mode: 'foot',
  };

  // Ручной поворот (мышь, тач, стрелки)
  R3.rotateCam = function (dyaw, dpitch) {
    const c = R3.cam;
    c.yaw += dyaw;
    c.pitch = J.clamp(c.pitch + dpitch, -0.45, 1.25);
    c.idle = 0;
  };
  R3.zoomCam = function (k) {
    const c = R3.cam;
    if (c.mode === 'car') c.carDist = J.clamp(c.carDist * k, 4.5, 16);
    else c.dist = J.clamp(c.dist * k, 2.2, 14);
  };
  // Мгновенно поставить камеру на место (после телепорта, загрузки, возрождения)
  R3.snapCamera = function () {
    const c = R3.cam;
    c.ty = undefined;
    c.arm = c.mode === 'car' ? c.carDist : c.dist;
    c.lift = 0;
  };

  // Верх твёрдого столбца клетки (ix, iz) для луча камеры; земля — тоже столбец чуть выше поверхности
  function occTop(w, ix, iz) {
    if (!w.inb(ix, iz)) return -99;
    if (w.occTop) return w.occTop(ix, iz); // крючок для эстакад и прочих будущих построек
    const i = iz * w.W + ix, bi = w.bid[i];
    if (bi) return w.buildingTop(w.buildings[bi - 1], ix + 0.5, iz + 0.5); // небоскрёбы, уступы и крыши
    const t = w.t[i];
    if (t === J.T.WALL) return 2.5;
    return w.tileH(ix, iz) + 0.28; // скалы и плато уже входят в высоту клетки
  }
  R3.occTop = occTop;

  // DDA по столбцам клеток от (x0,y0,z0) к (x1,y1,z1). Возвращает свободную долю отрезка 0..1.
  R3.segTrace = function (x0, y0, z0, x1, y1, z1) {
    const w = J.G.world, dx = x1 - x0, dy = y1 - y0, dz = z1 - z0;
    let ix = Math.floor(x0), iz = Math.floor(z0);
    const sx = dx > 0 ? 1 : -1, sz = dz > 0 ? 1 : -1;
    const tdx = dx !== 0 ? Math.abs(1 / dx) : Infinity, tdz = dz !== 0 ? Math.abs(1 / dz) : Infinity;
    let tmx = dx !== 0 ? (dx > 0 ? ix + 1 - x0 : x0 - ix) * tdx : Infinity;
    let tmz = dz !== 0 ? (dz > 0 ? iz + 1 - z0 : z0 - iz) * tdz : Infinity;
    let tIn = 0;
    for (let n = 0; n < 128; n++) {
      const tOut = Math.min(tmx, tmz, 1), top = occTop(w, ix, iz);
      const yIn = y0 + dy * tIn, yOut = y0 + dy * tOut;
      if (yIn < top) return tIn; // упёрлись в бок столбца
      if (yOut < top) return Math.max(tIn, (top - y0) / dy); // опустились на его верх (dy < 0)
      if (tOut >= 1) return 1;
      tIn = tOut;
      if (tmx < tmz) { ix += sx; tmx += tdx; } else { iz += sz; tmz += tdz; }
    }
    return 1;
  };
  // Веер из трёх лучей: в камеру и на ±r вбок. Возвращает свободную длину в метрах.
  R3.armTrace = function (px, py, pz, fx, fy, fz, L, r) {
    const ll = Math.hypot(fx, fz) || 1, lx = -fz / ll, lz = fx / ll;
    let free = L;
    for (let s = -1; s <= 1; s++) {
      const ex = px + fx * L + lx * r * s, ez = pz + fz * L + lz * r * s, ey = py + fy * L;
      free = Math.min(free, R3.segTrace(px, py, pz, ex, ey, ez) * L);
    }
    return free;
  };

  /*
   * opts: { mode: 'foot'|'car'|'title', heading, moving, speed, noCollide }
   * px, py — позиция цели на карте, pz — высота земли под ней
   */
  R3.updateCamera = function (px, py, pz, dt, opts) {
    const c = R3.cam;
    opts = opts || {};
    const mode = opts.mode || 'foot';
    if (c.mode !== mode) {
      c.mode = mode;
      c.idle = 9;
    }
    c.idle += dt;
    // авто-разворот за спину
    const autoFollow = mode === 'car' ? c.idle > 0.8 : c.follow && opts.moving && c.idle > 1.0;
    if (autoFollow && opts.heading !== undefined) {
      const rate = mode === 'car' ? 2.6 * J.clamp(Math.abs(opts.speed || 0) / 6, 0.3, 1.2) : 1.6;
      c.yaw += J.angDiff(c.yaw, opts.heading) * (1 - Math.exp(-rate * dt));
      const restPitch = mode === 'car' ? 0.2 : 0.24;
      c.pitch += (restPitch - c.pitch) * (1 - Math.exp(-0.8 * dt));
    }
    // цель: голова персонажа (по горизонтали — без запаздывания, по высоте — мягко)
    const headH = mode === 'car' ? 1.35 : mode === 'title' ? 0 : 1.55;
    const jump = Math.abs(px - c.tx) + Math.abs(py - c.tz) > 6;
    c.tx = px;
    c.tz = py;
    const ty = pz + headH;
    c.ty = c.ty === undefined || jump || mode === 'title' || Math.abs(ty - c.ty) > 4 ? ty : c.ty + (ty - c.ty) * hl(0.05, dt);
    // направление штанги
    const cp = Math.cos(c.pitch), sp = Math.sin(c.pitch);
    const dx = -Math.cos(c.yaw) * cp, dz = -Math.sin(c.yaw) * cp, dy = sp;
    const want = mode === 'car' ? c.carDist + Math.min(4, Math.abs(opts.speed || 0) * 0.12) : mode === 'title' ? 26 : c.dist;
    // смещение за правое плечо (уменьшается при близкой камере); само плечо тоже не должно входить в стену
    let sh = mode === 'foot' ? 0.42 * J.clamp(c.arm / 4, 0.3, 1) : 0;
    const rx = -Math.sin(c.yaw), rz = Math.cos(c.yaw);
    const oy = c.ty + c.lift;
    if (sh > 0 && !opts.noCollide) sh *= R3.segTrace(c.tx, oy, c.tz, c.tx + rx * (sh + 0.25), oy, c.tz + rz * (sh + 0.25));
    const ox = c.tx + rx * sh, oz = c.tz + rz * sh;
    let len = want;
    if (mode !== 'title' && !opts.noCollide) len = Math.max(0.7, Math.min(want, R3.armTrace(ox, oy, oz, dx, dy, dz, want, 0.26) - 0.25));
    // укорачиваем мгновенно, удлиняем плавно
    if (jump || c.arm === undefined) c.arm = len;
    else if (len < c.arm) c.arm = len;
    else c.arm += (len - c.arm) * hl(0.22, dt);
    c.near = c.arm < 2.4;
    c.veryNear = c.arm < 1.25;
    // в тесноте камера приподнимается и смотрит поверх головы (плавно, без рывков)
    const upT = mode === 'foot' ? J.clamp((2.3 - c.arm) / 2.3, 0, 1) * 0.6 : 0;
    c.lift += (upT - c.lift) * hl(0.12, dt);
    const up = c.lift;
    let cx = ox + dx * c.arm, cy = oy + dy * c.arm, cz = oz + dz * c.arm;
    const gmin = J.G.world.groundY(cx, cz) + 0.3;
    if (cy < gmin) cy = gmin;
    // тряска — плавная (синусы), а не случайный шум каждый кадр
    let lx = ox - dx * 2, ly = oy + (mode === 'car' ? 0.2 : 0.1) - up * 0.75, lz = oz - dz * 2;
    if (c.shake > 0) {
      c.shake = Math.max(0, c.shake - dt);
      const s = Math.min(0.6, c.shake) * 0.32, t = J.G.t * 1.0;
      cx += Math.sin(t * 41.3) * s;
      cy += Math.sin(t * 37.9 + 1.7) * s;
      cz += Math.sin(t * 29.1 + 0.6) * s;
    }
    // поле зрения: шире на скорости
    const fov = mode === 'car' ? 62 + Math.min(18, Math.abs(opts.speed || 0) * 0.55) : mode === 'title' ? 55 : 60;
    c.fov += (fov - c.fov) * hl(0.25, dt);
    if (Math.abs(R3.camera.fov - c.fov) > 0.05) {
      R3.camera.fov = c.fov;
      R3.camera.updateProjectionMatrix();
    }
    R3.camera.position.set(cx, cy, cz);
    // смотрим чуть выше и вперёд цели — персонаж в нижней трети кадра
    R3.camera.lookAt(lx, ly, lz);
    if (R3.lantern) R3.lantern.position.set(px, pz + 2.5, py);
  };
})();
