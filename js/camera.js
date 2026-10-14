'use strict';
// Камера от третьего лица в духе GTA: жёсткое следование без запаздывания, «пружинная штанга»,
// которая при препятствии укорачивается (а не прыгает вверх), смещение за плечо,
// авто-разворот за спину при движении (в машине, на телефоне и без захвата мыши).
(function () {
  const R3 = J.R3;
  const T = () => J.T;

  R3.cam = {
    yaw: -Math.PI / 2,
    pitch: 0.24,
    dist: 5.6, // желаемая длина штанги (пешком)
    carDist: 8.5, // желаемая длина штанги (в машине)
    arm: 5.6, // текущая длина после столкновений
    tx: 0, ty: 0, tz: 0,
    shake: 0,
    fov: 60,
    idle: 9, // секунд без ручного поворота
    follow: false, // авто-разворот за спину пешком
    near: false,
    veryNear: false,
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

  // Высота препятствия в точке (x, z) мира для луча камеры
  function obstacleTop(w, x, z) {
    const b = w.buildingAt(x, z);
    if (b) return w.buildingTop(b, x, z); // небоскрёбы, уступы и крыши — из данных здания
    const t = w.tile(x, z);
    if (t === T().WALL) return 2.5;
    if (t === T().ROCK || t === T().MESA) return w.tileH(Math.floor(x), Math.floor(z)) + 0.3;
    return w.groundY(x, z) + 0.25;
  }

  // Длина свободного луча от точки (ox,oy,oz) в направлении (dx,dy,dz) до maxLen
  function traceArm(ox, oy, oz, dx, dy, dz, maxLen) {
    const w = J.G.world;
    const step = 0.14;
    for (let s = 0.35; s <= maxLen; s += step) {
      const x = ox + dx * s, y = oy + dy * s, z = oz + dz * s;
      if (y < obstacleTop(w, x, z)) return Math.max(0, s - 0.3);
      // боковые пробы, чтобы край стены не попадал в объектив
      const sx = -dz * 0.22, sz = dx * 0.22;
      if (y < obstacleTop(w, x + sx, z + sz) - 0.05 || y < obstacleTop(w, x - sx, z - sz) - 0.05) return Math.max(0, s - 0.3);
    }
    return maxLen;
  }

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
      c.yaw += J.angDiff(c.yaw, opts.heading) * Math.min(1, dt * rate);
      const restPitch = mode === 'car' ? 0.2 : 0.24;
      c.pitch += (restPitch - c.pitch) * Math.min(1, dt * 0.8);
    }
    // цель: голова персонажа (по горизонтали — без запаздывания, по высоте — мягко)
    const headH = mode === 'car' ? 1.35 : mode === 'title' ? 0 : 1.55;
    const jump = Math.abs(px - c.tx) + Math.abs(py - c.tz) > 6;
    c.tx = px;
    c.tz = py;
    const ty = pz + headH;
    c.ty = jump || mode === 'title' ? ty : c.ty + (ty - c.ty) * Math.min(1, dt * 14);
    // направление штанги
    const cp = Math.cos(c.pitch), sp = Math.sin(c.pitch);
    const dx = -Math.cos(c.yaw) * cp, dz = -Math.sin(c.yaw) * cp, dy = sp;
    const want = mode === 'car' ? c.carDist + Math.min(4, Math.abs(opts.speed || 0) * 0.12) : mode === 'title' ? 26 : c.dist;
    // смещение за правое плечо (уменьшается при близкой камере)
    const sh = mode === 'foot' ? 0.42 * J.clamp(c.arm / 4, 0.3, 1) : 0;
    const rx = -Math.sin(c.yaw), rz = Math.cos(c.yaw);
    const ox = c.tx + rx * sh, oz = c.tz + rz * sh, oy = c.ty;
    let len = want;
    if (mode !== 'title' && !opts.noCollide) len = Math.max(0.7, traceArm(ox, oy, oz, dx, dy, dz, want));
    // укорачиваем мгновенно, удлиняем плавно
    if (len < c.arm) c.arm = len;
    else c.arm += (len - c.arm) * Math.min(1, dt * 3.2);
    c.near = c.arm < 2.4;
    c.veryNear = c.arm < 1.25;
    // в тесноте камера приподнимается и смотрит поверх головы
    const up = mode === 'foot' ? J.clamp((2.3 - c.arm) / 2.3, 0, 1) * 0.6 : 0;
    let cx = ox + dx * c.arm, cy = oy + dy * c.arm + up, cz = oz + dz * c.arm;
    const gmin = J.G.world.groundY(cx, cz) + 0.3;
    if (cy < gmin) cy = gmin;
    // тряска
    if (c.shake > 0) {
      c.shake = Math.max(0, c.shake - dt);
      const s = Math.min(0.6, c.shake) * 0.5;
      cx += (Math.random() - 0.5) * s;
      cy += (Math.random() - 0.5) * s;
      cz += (Math.random() - 0.5) * s;
    }
    // поле зрения: шире на скорости
    const fov = mode === 'car' ? 62 + Math.min(18, Math.abs(opts.speed || 0) * 0.55) : mode === 'title' ? 55 : 60;
    c.fov += (fov - c.fov) * Math.min(1, dt * 3);
    if (Math.abs(R3.camera.fov - c.fov) > 0.05) {
      R3.camera.fov = c.fov;
      R3.camera.updateProjectionMatrix();
    }
    R3.camera.position.set(cx, cy, cz);
    // смотрим чуть выше и вперёд цели — персонаж в нижней трети кадра
    R3.camera.lookAt(ox - dx * 2, oy + (mode === 'car' ? 0.2 : 0.1) + up * 0.25, oz - dz * 2);
    if (R3.lantern) R3.lantern.position.set(px, pz + 2.5, py);
  };
})();
