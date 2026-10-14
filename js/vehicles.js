'use strict';
// Машины: аркадная физика (разгон, тормоз/задний ход, руль зависит от скорости, ручник и занос), столкновения
// со зданиями, столбами и другими машинами (удар, отскок, урон, дым, взрыв), сбитые пешеходы,
// посадка / угон / выход, звук мотора и сигнала, спидометр. Поток машин — в traffic.js, отрисовка — render_vehicles.js.
(function () {
  const Veh = (J.Veh = {});
  const G = () => J.G;
  let VID = 1;

  // ---------- Создание ----------
  Veh.make = function (type, x, y, ang, o) {
    o = o || {};
    const vt = J.vtypeOf(type);
    const style = o.region || 'usa';
    let color, livery = null;
    if (type === 'taxi') color = (J.VLIVERY.taxi[style] || '#f2c21a');
    else if (type === 'police') {
      livery = J.VLIVERY.police[style] || ['#f4f4f4', '#14161a'];
      color = livery[0];
    } else if (type === 'bus' && J.VLIVERY.bus[style]) color = J.VLIVERY.bus[style];
    else {
      const h = o.colorHash !== undefined ? o.colorHash : Math.random();
      color = vt.colors[Math.floor(h * vt.colors.length) % vt.colors.length];
    }
    const v = {
      id: VID++, type, vt, color, livery, region: style, mode: o.mode || 'parked',
      x, y, ang, vx: 0, vy: 0, vf: 0, vl: 0, yawRate: 0, steer: 0, spin: 0, gy: J.ROAD_H, pitch: 0, roll: 0, bob: 0, accel: 0,
      hp: vt.hp, maxHp: vt.hp, braking: false, reverse: false, siren: false, lightsOn: true,
      driver: o.mode === 'ai' ? true : null, owned: false, spot: null, view: null, d2: 0,
      path: null, s: 0, hint: { i: 0 }, nextC: null, cruise: 1, lat: 0, latT: 0, blockT: 0, waitT: 0, honkT: 0, stuckT: 0, stopT: 0, busT: 0, blk: null, blkEnt: null,
      dead: false, restT: 0, smokeT: 0, fire: false, hitCD: 0, waitWhy: 0, stopDone: false, busDone: false,
    };
    v.gy = G().world.groundY(x, y);
    G().vehs.push(v);
    return v;
  };
  Veh.remove = function (v, idx) {
    const vs = G().vehs;
    if (idx === undefined) idx = vs.indexOf(v);
    if (idx >= 0) vs.splice(idx, 1);
    if (v.spot && v.spot.veh === v) v.spot.veh = null;
    J.R3.dropCarView(v);
    if (v.driver && v.driver.isPlayer) Veh.forceExit(v.driver);
  };
  Veh.clear = function () {
    const g = G();
    if (g.player && g.player.inCar) Veh.forceExit(g.player);
    for (const v of g.vehs || []) {
      J.R3.dropCarView(v);
      if (v.spot) v.spot.veh = null;
    }
    g.vehs = [];
    J.Traffic.reset();
    Veh.sound(null, 0);
  };

  // ---------- Твёрдость клеток для машин ----------
  const T = J.T, O = J.O;
  const SOLID_T = new Uint8Array(64);
  [T.DEEP, T.WATER, T.ROCK, T.BUILDING, T.WALL, T.MESA].forEach((t) => (SOLID_T[t] = 1));
  const SOLID_O = new Uint8Array(64);
  for (let i = 0; i < 64; i++) SOLID_O[i] = J.SOLID_O[i];
  [O.LAMP, O.SIGN, O.HYDRANT, O.BENCH].forEach((o) => (SOLID_O[o] = 1));
  const carSolid = (w, tx, ty) => {
    if (tx < 0 || ty < 0 || tx >= w.W || ty >= w.H) return true;
    const i = ty * w.W + tx;
    return SOLID_T[w.t[i]] === 1 || SOLID_O[w.o[i]] === 1;
  };
  Veh.carSolid = carSolid;

  // точки корпуса (локально: вперёд f, вправо r)
  const PF = [1, 1, -1, -1, 1, -1, 0, 0, 0.5, 0.5, -0.5, -0.5], PR = [1, -1, 1, -1, 0, 0, 1, -1, 1, -1, 1, -1];
  const col = { nx: 0, ny: 0, pen: 0, rx: 0, ry: 0 };
  // самая глубокая точка корпуса внутри препятствия → col; false — свободно
  function worldHit(w, v) {
    const vt = v.vt, ca = Math.cos(v.ang), sa = Math.sin(v.ang);
    const hl = vt.L / 2 - 0.05, hw = vt.W / 2 - 0.04;
    let best = 0;
    for (let k = 0; k < PF.length; k++) {
      const lf = PF[k] * hl, lr = PR[k] * hw;
      const rx = lf * ca - lr * sa, ry = lf * sa + lr * ca;
      const px = v.x + rx, py = v.y + ry;
      const tx = Math.floor(px), ty = Math.floor(py);
      if (!carSolid(w, tx, ty)) continue;
      // выталкивание к ближайшей свободной стороне клетки
      let pen = 9, nx = 0, ny = 0;
      const dl = px - tx, dr = tx + 1 - px, du = py - ty, dd = ty + 1 - py;
      if (dl < pen && !carSolid(w, tx - 1, ty)) { pen = dl; nx = -1; ny = 0; }
      if (dr < pen && !carSolid(w, tx + 1, ty)) { pen = dr; nx = 1; ny = 0; }
      if (du < pen && !carSolid(w, tx, ty - 1)) { pen = du; nx = 0; ny = -1; }
      if (dd < pen && !carSolid(w, tx, ty + 1)) { pen = dd; nx = 0; ny = 1; }
      if (pen === 9) {
        // окружены со всех сторон — назад к центру машины
        const L = Math.hypot(rx, ry) || 1;
        nx = -rx / L;
        ny = -ry / L;
        pen = 0.5;
      }
      if (pen > best) {
        best = pen;
        col.nx = nx;
        col.ny = ny;
        col.pen = pen + 0.002;
        col.rx = rx;
        col.ry = ry;
      }
    }
    return best > 0;
  }

  // ---------- Физика одной машины (игрок / свободная) ----------
  const SURF = new Float32Array(64).fill(1); // сопротивление покрытия
  const GRIPK = new Float32Array(64).fill(1);
  [T.GRASS, T.FOREST, T.FIELD, T.DRYGRASS, T.MOOR, T.LAWN, T.RUINS].forEach((t) => (SURF[t] = 2.4));
  [T.DIRT].forEach((t) => (SURF[t] = 1.6));
  [T.SAND, T.DESERT, T.SNOW, T.SWAMP].forEach((t) => (SURF[t] = 3.6));
  GRIPK[T.ICE] = 0.25;
  GRIPK[T.SNOW] = 0.55;
  GRIPK[T.SAND] = GRIPK[T.DESERT] = 0.7;
  GRIPK[T.GRASS] = GRIPK[T.LAWN] = 0.8;
  Veh.physics = function (v, dt, thr, st, hb) {
    const w = G().world, vt = v.vt;
    const ti = w.tile(v.x, v.y);
    const surf = SURF[ti], gk = GRIPK[ti];
    let ca = Math.cos(v.ang), sa = Math.sin(v.ang);
    let vf = v.vx * ca + v.vy * sa, vl = -v.vx * sa + v.vy * ca;
    // двигатель и тормоза
    let a = 0;
    v.reverse = false;
    let braking = false;
    if (v.hp <= 0) thr = 0;
    if (thr > 0.05) {
      if (vf < -0.4) { a = vt.brk * thr; braking = true; }
      else a = vt.acc * thr * Math.max(0, 1 - (vf / vt.vmax) * (vf / vt.vmax)) / Math.max(1, surf * 0.5);
    } else if (thr < -0.05) {
      if (vf > 0.4) { a = -vt.brk * -thr; braking = true; }
      else {
        a = vf > -vt.vmax * 0.26 ? -vt.acc * 0.6 * -thr : 0;
        v.reverse = true;
      }
    }
    // сопротивление качению и воздуха
    const res = (0.25 + 0.45 * surf) + 0.0011 * vf * vf * Math.sign(vf) * Math.sign(vf);
    if (Math.abs(vf) > 0.05) a -= Math.sign(vf) * res;
    if (hb) {
      a -= Math.sign(vf) * Math.min(Math.abs(vf) / dt, 6.5);
      braking = true;
    }
    const nvf = vf + a * dt;
    // торможение не разгоняет в обратную сторону
    if ((braking || (thr === 0 && Math.abs(vf) < 1.5)) && Math.sign(nvf) !== Math.sign(vf) && vf !== 0) vf = 0;
    else vf = nvf;
    if (thr === 0 && !hb && Math.abs(vf) < 0.08) vf = 0;
    // руль: на скорости угол меньше
    const sMax = vt.steer / (1 + Math.abs(vf) / 11);
    v.steer += (st * sMax - v.steer) * Math.min(1, dt * 7);
    // поворот кузова и сцепление
    let yawT = (vf * Math.tan(v.steer)) / vt.wb;
    const slide = Math.abs(vl);
    let grip = vt.grip * gk;
    if (hb) {
      grip *= 0.16;
      yawT *= 1.55;
    }
    if (slide > 4) grip *= 0.7; // уже в заносе — держит хуже
    v.yawRate += (yawT - v.yawRate) * Math.min(1, dt * (hb ? 3.2 : 8.5) * gk);
    vl *= Math.exp(-grip * dt);
    // в заносе скорость гасится
    vf -= Math.sign(vf) * Math.min(Math.abs(vf), slide * 0.35 * dt);
    v.vx = ca * vf - sa * vl;
    v.vy = sa * vf + ca * vl;
    v.ang += v.yawRate * dt;
    v.vf = vf;
    v.vl = vl;
    v.braking = braking || (v.hp > 0 && thr < -0.05 && vf > 0.4);
    // кузов: клевок при торможении, крен в повороте
    v.accel += (a - v.accel) * Math.min(1, dt * 6);
  };
  // перемещение с подшагами и столкновениями со статикой
  Veh.move = function (v, dt) {
    const w = G().world, vt = v.vt;
    const sp = Math.hypot(v.vx, v.vy);
    const n = Math.min(8, Math.max(1, Math.ceil((sp * dt) / 0.3)));
    const h = dt / n;
    const I = (vt.L * vt.L + vt.W * vt.W) / 12;
    let maxImp = 0;
    for (let k = 0; k < n; k++) {
      v.x += v.vx * h;
      v.y += v.vy * h;
      for (let it = 0; it < 3; it++) {
        if (!worldHit(w, v)) break;
        v.x += col.nx * col.pen;
        v.y += col.ny * col.pen;
        // скорость точки удара вдоль нормали
        const pvx = v.vx - v.yawRate * col.ry, pvy = v.vy + v.yawRate * col.rx;
        const vn = pvx * col.nx + pvy * col.ny;
        if (vn < 0) {
          const rn = col.rx * col.ny - col.ry * col.nx;
          const e = -vn > 6 ? 0.22 : 0.08;
          const j = (-(1 + e) * vn) / (1 + (rn * rn) / I);
          v.vx += j * col.nx;
          v.vy += j * col.ny;
          v.yawRate += (rn * j) / I;
          // трение вдоль стены
          v.vx *= 0.97;
          v.vy *= 0.97;
          if (-vn > maxImp) {
            maxImp = -vn;
            v.hitX = v.x + col.rx;
            v.hitY = v.y + col.ry;
          }
        }
      }
    }
    if (maxImp > 2.5) Veh.impact(v, maxImp, v.hitX, v.hitY, null);
  };

  // ---------- Высота, наклоны, колёса ----------
  Veh.ground = function (v, dt, full) {
    const w = G().world, vt = v.vt;
    const ca = Math.cos(v.ang), sa = Math.sin(v.ang);
    let gy, tp = 0, tr = 0;
    if (full) {
      const fx = ca * vt.wb / 2, fy = sa * vt.wb / 2, rx = -sa * vt.tr / 2, ry = ca * vt.tr / 2;
      const hFL = w.groundY(v.x + fx - rx, v.y + fy - ry), hFR = w.groundY(v.x + fx + rx, v.y + fy + ry);
      const hRL = w.groundY(v.x - fx - rx, v.y - fy - ry), hRR = w.groundY(v.x - fx + rx, v.y - fy + ry);
      gy = (hFL + hFR + hRL + hRR) / 4;
      tp = Math.atan2((hRL + hRR - hFL - hFR) / 2, vt.wb);
      tr = Math.atan2((hFL + hRL - hFR - hRR) / 2, vt.tr);
    } else gy = w.groundY(v.x, v.y);
    // подвеска: мягкое следование за землёй (бордюр — толчок)
    const k = Math.min(1, dt * 14);
    v.gy += (gy - v.gy) * k;
    const pitchT = tp + J.clamp(-v.accel * 0.0075, -0.045, 0.06);
    const rollT = tr + J.clamp(-v.vf * v.yawRate * 0.0055, -0.07, 0.07);
    v.pitch += (pitchT - v.pitch) * Math.min(1, dt * 7);
    v.roll += (rollT - v.roll) * Math.min(1, dt * 6);
    v.spin += (v.vf / vt.wr) * dt;
  };

  // ---------- Урон машине ----------
  // разбитая машина сначала загорается (несколько секунд, чтобы успеть выскочить), потом взрывается;
  // мгновенный взрыв — только от огромного разового урона (другой взрыв, способности)
  Veh.damage = function (v, amt, src) {
    if (v.hp <= 0 || !(amt > 0)) return;
    v.hp -= amt;
    if (v.hp <= 0 && amt > v.maxHp * 0.9) return Veh.explode(v, src);
    if (v.hp <= v.maxHp * 0.12 && !v.fire) {
      v.fire = true;
      v.burnT = 0;
      v.hp = Math.max(1, v.hp);
      if (v.driver && v.driver.isPlayer) J.UI.toast('Машина горит! Выходи (F), пока не рванула!', 'red');
      else if (v.driver === true && v.mode !== 'player') {
        // водитель выскакивает и убегает
        Veh.doorPoint(v, driverSide(v), DP);
        const w = G().world;
        if (!w.solid(DP.x, DP.y)) {
          const d = J.makeCivilian(DP.x, DP.y, w.regionAt(DP.x, DP.y));
          d.ai.fear = 10;
          d.ai.fx = v.x;
          d.ai.fy = v.y;
          J.addEnt(d);
        }
        v.driver = null;
        if (v.mode === 'ai') Veh.toFree(v);
      }
    }
    v.hp = Math.max(1, v.hp);
  };
  Veh.explode = function (v, src) {
    v.hp = 0;
    v.siren = false;
    const g = G(), R3 = J.R3;
    const gy = v.gy;
    R3.burst(v.x, v.y, gy + 1, '#ffb030', 36, 9, 0.9, 4);
    R3.burst(v.x, v.y, gy + 1.4, '#3a3a3a', 26, 4, 1.6, 3);
    R3.flash && R3.flash(v.x, v.y, 4, '#ffcf6a', 0.5, 2);
    R3.ring && R3.ring(v.x, v.y, 5, '#ffb030', 0.5);
    if (Math.hypot(v.x - R3.cam.tx, v.y - R3.cam.tz) < 30) R3.cam.shake = 0.6;
    Veh.boom(v);
    // взрывная волна
    const p = g.player;
    const drv = v.driver;
    if (drv && drv.isPlayer) Veh.forceExit(drv, true);
    for (const e of g.ents) {
      if (e.dead) continue;
      const d = Math.hypot(e.x - v.x, e.y - v.y);
      if (d > 5.5) continue;
      const dmg = 70 * (1 - d / 5.5);
      if (e.kind === 'civ') Veh.knockDown(e, dmg, Math.atan2(e.y - v.y, e.x - v.x), 6, p);
      else J.hurt(e, dmg, src || null, { knock: 7, ang: Math.atan2(e.y - v.y, e.x - v.x), kind: 'fire' });
    }
    for (const o of g.vehs) if (o !== v && o.hp > 0 && Math.hypot(o.x - v.x, o.y - v.y) < 6) Veh.damage(o, 60, src);
    J.scare(v.x, v.y, 30);
  };
  // удар обо что-то: урон, искры, тряска камеры, звук
  Veh.impact = function (v, imp, x, y, other) {
    if (v.hitCD > 0 && imp < 8) return;
    v.hitCD = 0.25;
    const R3 = J.R3;
    const dmg = Math.pow(Math.max(0, imp - 2.5), 1.45) * 4.2 * (other ? 0.8 : 1);
    Veh.damage(v, dmg, v.driver && v.driver.isPlayer ? v.driver : null);
    const gy = v.gy;
    R3.burst(x, y, gy + 0.6, '#ffd27a', Math.min(18, 3 + imp * 1.5), 3 + imp * 0.3, 0.35, 1.5);
    if (imp > 7) R3.burst(x, y, gy + 0.7, '#b8bcc4', 8, 3, 0.6, 1.2); // осколки
    const dCam = Math.hypot(x - R3.cam.tx, y - R3.cam.tz);
    if (v.driver && v.driver.isPlayer) {
      R3.cam.shake = Math.max(R3.cam.shake, Math.min(0.5, imp * 0.04));
      // водитель тоже получает удар при сильном столкновении
      if (imp > 14) J.hurt(v.driver, (imp - 14) * 1.6, null, { dot: true, kind: 'pure', silent: true });
    }
    if (dCam < 45) Veh.crashSound(imp, dCam);
    if (imp > 6) J.scare(x, y, 14);
  };

  // ---------- Столкновения машин между собой (по цепочке кругов вдоль корпуса) ----------
  const circ = (v, k, out) => {
    const vt = v.vt, n = v._nc, r = vt.W / 2;
    const span = vt.L / 2 - r;
    const f = n === 1 ? 0 : -span + (2 * span * k) / (n - 1);
    out.x = v.x + Math.cos(v.ang) * f;
    out.y = v.y + Math.sin(v.ang) * f;
    out.r = r;
    return out;
  };
  const cA = { x: 0, y: 0, r: 0 }, cB = { x: 0, y: 0, r: 0 };
  const physical = (v) => v.mode === 'player' || v.mode === 'free';
  Veh.collideCars = function () {
    const vs = G().vehs;
    for (let i = 0; i < vs.length; i++) vs[i]._nc = Math.max(2, Math.round(vs[i].vt.L / vs[i].vt.W));
    for (let i = 0; i < vs.length; i++) {
      const a = vs[i];
      for (let j = i + 1; j < vs.length; j++) {
        const b = vs[j];
        const reach = (a.vt.L + b.vt.L) / 2 + 0.2;
        if (Math.abs(a.x - b.x) > reach || Math.abs(a.y - b.y) > reach) continue;
        // оба на рельсах или оба стоят — ИИ сам держит дистанцию
        if (!physical(a) && !physical(b)) continue;
        let best = 0, nx = 0, ny = 0, px = 0, py = 0;
        for (let ka = 0; ka < a._nc; ka++) {
          circ(a, ka, cA);
          for (let kb = 0; kb < b._nc; kb++) {
            circ(b, kb, cB);
            const dx = cA.x - cB.x, dy = cA.y - cB.y, d = Math.hypot(dx, dy);
            const pen = cA.r + cB.r - d;
            if (pen > best && d > 1e-4) {
              best = pen;
              nx = dx / d;
              ny = dy / d;
              px = (cA.x + cB.x) / 2;
              py = (cA.y + cB.y) / 2;
            }
          }
        }
        if (best <= 0) continue;
        Veh.resolvePair(a, b, nx, ny, best, px, py);
      }
    }
  };
  // разведение пары и обмен импульсом; n — от b к a
  Veh.resolvePair = function (a, b, nx, ny, pen, px, py) {
    const ma = a.vt.m, mb = b.vt.m;
    const pa = physical(a), pb = physical(b);
    // стоящая / едущая по рельсам машина «тяжелее» — сдвигаем в основном физическую
    const wa = pa ? (pb ? mb / (ma + mb) : 1) : 0, wb = pb ? (pa ? ma / (ma + mb) : 1) : 0;
    a.x += nx * pen * wa;
    a.y += ny * pen * wa;
    b.x -= nx * pen * wb;
    b.y -= ny * pen * wb;
    const ra = { x: px - a.x, y: py - a.y }, rb = { x: px - b.x, y: py - b.y };
    const vax = a.vx - a.yawRate * ra.y, vay = a.vy + a.yawRate * ra.x;
    const vbx = b.vx - b.yawRate * rb.y, vby = b.vy + b.yawRate * rb.x;
    const vn = (vax - vbx) * nx + (vay - vby) * ny;
    if (vn >= 0) return;
    const e = 0.18;
    const j = (-(1 + e) * vn) / (1 / ma + 1 / mb);
    const imp = -vn;
    const apply = (v, s, r) => {
      const I = (v.vt.m * (v.vt.L * v.vt.L + v.vt.W * v.vt.W)) / 12;
      if (!physical(v)) {
        const dv = j / v.vt.m;
        if (dv > 1.8 || v.mode === 'parked' && dv > 0.6) Veh.toFree(v);
        else {
          if (v.mode === 'ai') v.vf = Math.max(0, v.vf - dv);
          return;
        }
      }
      v.vx += (s * j * nx) / v.vt.m;
      v.vy += (s * j * ny) / v.vt.m;
      v.yawRate += (s * (r.x * ny - r.y * nx) * j) / I;
    };
    apply(a, 1, ra);
    apply(b, -1, rb);
    if (imp > 2.5) {
      Veh.impact(a, imp * (mb / (ma + mb)) * 2, px, py, b);
      Veh.impact(b, imp * (ma / (ma + mb)) * 2, px, py, a);
      // ИИ-водитель после удара сигналит
      for (const v of [a, b]) if (v.driver === true && v.honkT <= 0) {
        v.honkT = 5;
        Veh.honk(v, 1);
      }
    }
  };
  Veh.toFree = function (v) {
    if (v.mode === 'ai') {
      v.vx = Math.cos(v.ang) * v.vf;
      v.vy = Math.sin(v.ang) * v.vf;
    }
    v.mode = 'free';
    v.restT = 0;
    if (v.spot) {
      v.spot.veh = null;
      v.spot = null;
    }
  };

  // ---------- Машина против людей ----------
  const ESCAPES = ['Аааа!', 'Псих за рулём!', 'Помогите!', 'Смотри куда едешь!', 'Он меня сбил!'];
  Veh.knockDown = function (e, dmg, ang, force, src) {
    e.kx += Math.cos(ang) * force;
    e.ky += Math.sin(ang) * force;
    e.downT = Math.max(e.downT || 0, 2.2 + Math.random());
    e.st.stun = Math.max(e.st.stun || 0, e.downT);
    e.hitFlash = 0.15;
    e.hp -= dmg;
    J.R3.text(e.x, e.y, Math.round(dmg) + '', 'tdmg', 0.8, 1.2);
    if (e.ai) {
      e.ai.fear = 9;
      e.ai.fx = e.x - Math.cos(ang) * 3;
      e.ai.fy = e.y - Math.sin(ang) * 3;
      e.ai.sw = -1;
    }
    if (e.hp <= 0) J.kill(e, src);
  };
  Veh.collideEnts = function (dt) {
    const g = G(), vs = g.vehs, ents = g.ents;
    for (let i = 0; i < vs.length; i++) {
      const v = vs[i], vt = v.vt;
      const ca = Math.cos(v.ang), sa = Math.sin(v.ang);
      const reach = vt.L / 2 + 1;
      const drv = v.driver && v.driver.isPlayer ? v.driver : null;
      for (let k = 0; k < ents.length; k++) {
        const e = ents[k];
        if (e.dead || e.inCar || e.st.fly > 0 || e.st.ghost > 0 || e.summon || e.standSummon) continue;
        const rx = e.x - v.x, ry = e.y - v.y;
        if (Math.abs(rx) > reach || Math.abs(ry) > reach) continue;
        const lf = rx * ca + ry * sa, ll = -rx * sa + ry * ca;
        const r = e.r || 0.3;
        const hx = vt.L / 2 + r, hy = vt.W / 2 + r;
        if (Math.abs(lf) >= hx || Math.abs(ll) >= hy) continue;
        const pxp = hx - Math.abs(lf), pyp = hy - Math.abs(ll);
        let nx, ny, pen;
        if (pxp < pyp) {
          const s = Math.sign(lf) || 1;
          nx = ca * s;
          ny = sa * s;
          pen = pxp;
        } else {
          const s = Math.sign(ll) || 1;
          nx = -sa * s;
          ny = ca * s;
          pen = pyp;
        }
        // скорость кузова в точке касания, вдоль нормали к человеку
        const vpx = v.vx - v.yawRate * ry, vpy = v.vy + v.yawRate * rx;
        const vn = vpx * nx + vpy * ny;
        if (vn > 3.2 && !(e._carHit > g.t)) {
          e._carHit = g.t + 0.8;
          const dmg = 6 + vn * vn * 0.75;
          const ang = Math.atan2(ny + v.vy * 0.05, nx + v.vx * 0.05);
          const force = 3 + vn * 0.9;
          J.R3.burst(e.x, e.y, v.gy + 0.9, '#ffffff', 6, 2, 0.3, 1);
          Veh.thump(Math.hypot(e.x - J.R3.cam.tx, e.y - J.R3.cam.tz));
          if (e.kind === 'civ') {
            Veh.knockDown(e, dmg, ang, force, drv);
            if (drv) Veh.crime(e.dead ? 1.1 : 0.45, e.x, e.y);
          } else if (e.kind === 'story' && !e.storyTag) {
            e.kx += nx * force;
            e.ky += ny * force;
          } else if (e.isPlayer) {
            J.hurt(e, dmg * 0.6, null, { knock: force, ang, stun: 0.6 });
          } else {
            J.hurt(e, e.boss ? dmg * 0.25 : dmg, drv, { knock: force * (e.boss ? 0.3 : 1), ang, stun: 0.9 });
          }
          J.scare(e.x, e.y, 16, v.x, v.y);
          if (physical(v)) {
            v.vx *= 0.94;
            v.vy *= 0.94;
          }
          if (v.mode === 'ai') v.vf *= 0.5;
        }
        // выталкиваем человека из корпуса (стены учитываются)
        J.moveEnt(e, nx * (pen + 0.01), ny * (pen + 0.01));
      }
    }
  };

  // ---------- Посадка, угон, выход ----------
  Veh.near = function (p, maxD) {
    let best = null, bd = maxD || 1.4;
    for (const v of G().vehs) {
      if (v.hp <= 0 || v.driver && v.driver.isPlayer) continue;
      const ca = Math.cos(v.ang), sa = Math.sin(v.ang);
      const rx = p.x - v.x, ry = p.y - v.y;
      const lf = Math.abs(rx * ca + ry * sa) - v.vt.L / 2, ll = Math.abs(-rx * sa + ry * ca) - v.vt.W / 2;
      const d = Math.max(lf, ll, 0);
      if (d < bd) {
        bd = d;
        best = v;
      }
    }
    return best;
  };
  // сторона водителя: левостороннее движение — руль справа
  const driverSide = (v) => ((J.GRID[v.region] || J.GRID.usa).drive === 'L' ? -1 : 1); // +1 — левый борт
  Veh.doorPoint = function (v, side, out) {
    const ca = Math.cos(v.ang), sa = Math.sin(v.ang);
    const d = v.vt.W / 2 + 0.6;
    // левый борт в координатах карты: (sa, -ca)
    const zf = v.vt.shape === 'bus' ? v.vt.L / 2 - 1.2 : v.vt.L * 0.08;
    out.x = v.x + sa * d * side + ca * zf;
    out.y = v.y - ca * d * side + sa * zf;
    return out;
  };
  const DP = { x: 0, y: 0 };
  Veh.enter = function (p, v) {
    if (!v || p.inCar || p.dead) return;
    if (v.hp <= 0) return J.UI.toast('Эта машина разбита.', 'muted');
    const g = G();
    const wasAI = v.driver === true;
    if (wasAI) {
      // вытаскиваем водителя: он убегает, прохожие пугаются
      Veh.doorPoint(v, driverSide(v), DP);
      const w = g.world;
      const pos = !w.solid(DP.x, DP.y) ? DP : w.randomWalkable(v.x, v.y, 4) || { x: v.x, y: v.y };
      const reg = w.regionAt(v.x, v.y);
      const d = J.makeCivilian(pos.x, pos.y, reg);
      d.ai.fear = 10;
      d.ai.fx = p.x;
      d.ai.fy = p.y;
      d.kx = (pos.x - v.x) * 2;
      d.ky = (pos.y - v.y) * 2;
      J.addEnt(d);
      J.R3.text(pos.x, pos.y, J.R.pick(['Эй! Моя машина!', 'Не трогай меня!', 'Забирай, только не бей!', 'Полиция!']), 'tsay', 1.4);
      J.scare(v.x, v.y, 14, p.x, p.y);
      Veh.crime(v.type === 'police' ? 2 : Veh.copNear(v.x, v.y, 45) ? 1 : 0.35, v.x, v.y);
      J.UI.toast(`Ты угнал машину: ${v.vt.name.toLowerCase()}.`, 'red');
    } else if (!v.owned) J.UI.toast(`Ты сел в машину: ${v.vt.name.toLowerCase()}.`, 'normal');
    if (v.mode === 'ai') Veh.toFree(v);
    if (v.spot) {
      v.spot.veh = null;
      v.spot = null;
    }
    v.mode = 'player';
    v.driver = p;
    v.owned = true;
    v.path = null;
    v.nextC = null;
    v.siren = false;
    p.inCar = v;
    p.standOut = false;
    p.channel = null;
    p.dash = null;
    p.anim = null;
    p.mount = false;
    p.vx = p.vy = p.mvx = p.mvy = 0;
    if (!g._carHelp) {
      g._carHelp = true;
      J.UI.toast('W/S — газ и тормоз (задний ход), A/D — руль, Пробел — ручник, H — сигнал, F — выйти.', 'gold');
    }
    J.R3.cam.idle = 9;
    Veh.sound(v, 1);
    document.body.classList.add('driving');
  };
  // выход; при высокой скорости — прыжок на ходу
  Veh.exit = function (p) {
    const v = p.inCar;
    if (!v) return;
    const w = G().world;
    const fast = Math.abs(v.vf) > 7;
    let pos = null;
    for (const s of [driverSide(v), -driverSide(v)]) {
      Veh.doorPoint(v, s, DP);
      if (!w.solid(DP.x, DP.y) && !w.isWater(DP.x, DP.y)) {
        pos = { x: DP.x, y: DP.y };
        break;
      }
    }
    if (!pos) {
      const ca = Math.cos(v.ang), sa = Math.sin(v.ang);
      const bx = v.x - ca * (v.vt.L / 2 + 0.8), by = v.y - sa * (v.vt.L / 2 + 0.8);
      pos = !w.solid(bx, by) ? { x: bx, y: by } : w.randomWalkable(v.x, v.y, 5) || { x: v.x, y: v.y };
    }
    Veh.forceExit(p);
    p.x = pos.x;
    p.y = pos.y;
    p.face = v.ang;
    p.lastSafe = { x: p.x, y: p.y };
    if (fast) {
      J.hurt(p, p.maxHp * 0.06 + Math.abs(v.vf), null, { dot: true, kind: 'pure' });
      p.st.stun = Math.max(p.st.stun || 0, 0.7);
      p.kx = v.vx * 0.5;
      p.ky = v.vy * 0.5;
      J.UI.toast('Ты выпрыгнул на ходу!', 'red');
    }
  };
  Veh.forceExit = function (p, thrown) {
    const v = p.inCar;
    p.inCar = null;
    document.body.classList.remove('driving');
    Veh.sound(null, 0);
    if (!v) return;
    v.driver = null;
    v.mode = 'free';
    v.restT = 0;
    v.siren = false;
    if (thrown) {
      p.kx = (Math.random() - 0.5) * 8;
      p.ky = (Math.random() - 0.5) * 8;
    }
  };

  // ---------- Розыск (лёгкий): угон и сбитые пешеходы привлекают полицию ----------
  // n — тяжесть: 1 — звезда розыска; мелочи копятся (свидетели звонят в полицию)
  Veh.crime = function (n, x, y) {
    const p = G().player;
    if (!p) return;
    const before = Math.floor(p.wanted || 0);
    p.wanted = Math.min(3, (p.wanted || 0) + n);
    p.wantedT = 40;
    if (Math.floor(p.wanted) > before) J.UI.toast('Полиция ищет тебя: ' + '★'.repeat(Math.floor(p.wanted)), 'red');
  };
  Veh.copNear = function (x, y, r) {
    for (const v of G().vehs) if (v.type === 'police' && v.driver === true && Math.hypot(v.x - x, v.y - y) < r) return true;
    for (const e of G().ents) if (e.cop && !e.dead && Math.hypot(e.x - x, e.y - y) < r) return true;
    return false;
  };
  Veh.updateWanted = function (dt, p) {
    if (!(p.wanted > 0)) return;
    if (p.wanted < 1) {
      // меньше звезды — просто забывается
      p.wantedT -= dt;
      if (p.wantedT <= 0) p.wanted = 0;
      return;
    }
    // полиция рядом — розыск не спадает
    let seen = false;
    for (const v of G().vehs) if (v.type === 'police' && v.hp > 0 && v.driver === true && Math.hypot(v.x - p.x, v.y - p.y) < 45) seen = true;
    p.wantedT -= dt * (seen ? 0.25 : 1);
    if (p.wantedT <= 0) {
      p.wanted = Math.max(0, p.wanted - 1);
      p.wantedT = 25;
      if (p.wanted < 1) {
        p.wanted = 0;
        Veh.calmDown(p);
        J.UI.toast('Полиция потеряла твой след.', 'green');
      }
    }
    // патрули: при розыске одна-две полицейские машины гонятся за игроком
    let chasing = 0;
    for (const v of G().vehs) if (v.chase) chasing++;
    const want = p.wanted >= 2 ? 2 : 1;
    Veh._copT = (Veh._copT || 0) - dt;
    if (chasing < want && Veh._copT <= 0 && G().world.cityAt(p.x, p.y)) {
      Veh._copT = 6;
      const c = J.R3.cam;
      const v = J.Traffic.spawnAI(p.x, p.y, 45, 80, Math.cos(c.yaw), Math.sin(c.yaw), true);
      if (v) Veh.startChase(v);
    }
    for (const v of G().vehs) if (v.type === 'police' && v.driver === true && !v.chase && v.hp > 0 && Math.hypot(v.x - p.x, v.y - p.y) < 40) Veh.startChase(v);
  };
  // розыск снят: погони прекращаются, патрульные уходят
  Veh.calmDown = function (p) {
    for (const v of G().vehs) if (v.chase) {
      v.chase = false;
      v.siren = false;
      v.restT = 0;
    }
    for (const e of G().ents) if (e.cop && !e.dead && Math.hypot(e.x - p.x, e.y - p.y) > 15) e.despawn = true;
  };
  Veh.startChase = function (v) {
    if (v.mode === 'ai') Veh.toFree(v);
    v.chase = true;
    v.siren = true;
    v.mode = 'free';
  };
  // преследование: едем на игрока (или его машину), таран
  const chaseCtl = { thr: 0, st: 0, hb: false };
  function chaseControl(v, p, dt) {
    const tx = p.x, ty = p.y;
    const dx = tx - v.x, dy = ty - v.y, d = Math.hypot(dx, dy);
    const want = Math.atan2(dy, dx);
    let da = J.angDiff(v.ang, want);
    chaseCtl.hb = false;
    if (v.backT > 0) {
      v.backT -= dt;
      chaseCtl.thr = -1;
      chaseCtl.st = -Math.sign(da);
      return chaseCtl;
    }
    chaseCtl.st = J.clamp(da * 2, -1, 1);
    const close = !p.inCar && d < 7;
    chaseCtl.thr = close ? (v.vf > 1 ? -1 : 0) : Math.abs(da) > 1.6 && v.vf > 8 ? -0.5 : 1;
    if (Math.abs(da) > 2.2 && d < 12) chaseCtl.thr = -1; // цель сзади — разворот задом
    v.stuck2 = Math.abs(v.vf) < 1 && !close ? (v.stuck2 || 0) + dt : 0;
    if (v.stuck2 > 1.5) {
      v.backT = 1.2;
      v.stuck2 = 0;
    }
    // полицейские выходят, если игрок пешком рядом
    if (close && Math.abs(v.vf) < 1 && !v.copsOut) {
      v.copsOut = true;
      for (let k = 0; k < 2; k++) {
        Veh.doorPoint(v, k ? -1 : 1, DP);
        if (G().world.solid(DP.x, DP.y)) continue;
        const cop = J.makeMob('guard', DP.x, DP.y, Math.max(1, Math.round(p.lvl * 0.8)));
        cop.name = 'Полицейский';
        cop.cop = true;
        J.addEnt(cop);
      }
      J.R3.text(v.x, v.y, 'Полиция! Стоять!', 'tsay', 1.5);
    }
    return chaseCtl;
  }

  // ---------- Покадровое обновление ----------
  const idle = { thr: 0, st: 0, hb: false };
  Veh.update = function (dt, inp) {
    const g = G(), w = g.world, p = g.player;
    if (!w || !p) return;
    if (!g.vehs) g.vehs = [];
    const tr = J.Traffic.ensure(w);
    if (!tr) return;
    const ts = g.timestop;
    const frozenAll = !!(ts && ts.by !== p);
    // игрока телепортировали (сюжет, поездка) — он больше не в машине
    if (p.inCar && (Math.abs(p.x - p.inCar.x) > 3 || Math.abs(p.y - p.inCar.y) > 3 || p.dead)) Veh.forceExit(p);
    if (!frozenAll) J.Traffic.update(dt, p.x, p.y);
    const vs = g.vehs;
    for (let i = 0; i < vs.length; i++) {
      const v = vs[i];
      if (v.hitCD > 0) v.hitCD -= dt;
      const mine = v.driver === p;
      if (frozenAll || (ts && !mine)) {
        if (v.mode !== 'parked') v.braking = false;
        continue;
      }
      if (v.mode === 'ai') {
        J.Traffic.aiStep(v, dt, tr, g.t);
        Veh.ground(v, dt, false);
      } else if (v.mode === 'player' || v.mode === 'free') {
        let c = idle;
        if (mine) c = inp;
        else if (v.chase && v.hp > 0) c = chaseControl(v, p, dt);
        else {
          idle.thr = 0;
          idle.st = 0;
          idle.hb = Math.abs(v.vf) < 3; // брошенная машина катится и останавливается
        }
        Veh.physics(v, dt, c.thr, c.st, c.hb);
        Veh.move(v, dt);
        Veh.ground(v, dt, true);
        // свободная машина остановилась — водитель возвращается в поток (если рядом своя полоса)
        if (!mine && !v.chase && v.mode === 'free') {
          if (Math.hypot(v.vx, v.vy) < 0.4) {
            v.restT += dt;
            if (v.restT > 2.5) Veh.settle(v, tr);
          } else v.restT = 0;
        }
      } else Veh.ground(v, dt, false);
      // дым и огонь у повреждённых
      if (v.hp < v.maxHp * 0.45 && v.d2 < 3600) {
        v.smokeT -= dt;
        if (v.smokeT <= 0) {
          const k = v.hp / v.maxHp;
          v.smokeT = k < 0.2 ? 0.05 : 0.18;
          const ca = Math.cos(v.ang), sa = Math.sin(v.ang), f = v.vt.L / 2 - 0.6;
          if (v.hp > 0) J.R3.burst(v.x + ca * f, v.y + sa * f, v.gy + v.vt.H * 0.75, k < 0.2 ? '#ff8a30' : '#6a6a6a', 1, 0.8, 0.9, 1.6);
          else J.R3.burst(v.x, v.y, v.gy + v.vt.H * 0.6, '#2a2a2a', 1, 0.6, 1.2, 1.8);
          // горит — через несколько секунд взрыв
          if (v.hp > 0 && v.fire) {
            v.burnT = (v.burnT || 0) + 0.05;
            if (Math.random() < 0.5) J.R3.burst(v.x, v.y, v.gy + v.vt.H * 0.6, '#ff6a20', 2, 1.4, 0.5, 2.2);
            if (v.burnT > 5) Veh.explode(v, mine ? p : null);
          }
        }
      }
    }
    if (!frozenAll) {
      Veh.collideCars();
      Veh.collideEnts(dt);
    }
    // игрок в машине: его позиция — машина
    if (p.inCar) {
      const v = p.inCar;
      p.x = v.x;
      p.y = v.y;
      p.face = v.ang;
      p.vx = p.vy = 0;
      p.lastSafe = { x: p.x, y: p.y };
      Veh.sound(v, 1);
    }
    Veh.updateWanted(dt, p);
  };
  // остановившаяся машина: на свою полосу (если рядом и по курсу) или в припаркованные
  Veh.settle = function (v, tr) {
    v.restT = 0;
    if (v.driver === true && v.hp > 0) {
      const w = G().world, gw = tr.gw;
      const l = tr.cellLanes[Math.floor(v.y / 32) * gw + Math.floor(v.x / 32)];
      let best = null, bd = 2.2, bs = 0;
      if (l)
        for (const id of l) {
          const L = tr.lanes[id], P = L.pts;
          for (let i = 0; i < P.length / 2 - 1; i++) {
            const d = Math.hypot(P[i * 2] - v.x, P[i * 2 + 1] - v.y);
            if (d >= bd) continue;
            const a = Math.atan2(P[i * 2 + 3] - P[i * 2 + 1], P[i * 2 + 2] - P[i * 2]);
            if (Math.abs(J.angDiff(a, v.ang)) > 0.6) continue;
            bd = d;
            best = L;
            bs = L.cum[i];
          }
        }
      if (best && best.len - bs > 6) {
        v.mode = 'ai';
        v.vx = v.vy = 0;
        v.vf = 0;
        v.yawRate = 0;
        J.Traffic.setLane(v, best, bs);
        return;
      }
      if (w && v.d2 > 1600) v.dead = true; // стоит криво вдали — убираем
    }
    v.mode = 'parked';
    v.vx = v.vy = v.vf = v.yawRate = 0;
  };

  // ---------- Пугаем прохожих ----------
  J.scare = function (x, y, r, fx, fy) {
    const ents = G().ents;
    for (let i = 0; i < ents.length; i++) {
      const e = ents[i];
      if (e.kind !== 'civ' || e.dead || !e.ai || e.ai.still) continue;
      const dx = e.x - x, dy = e.y - y;
      if (dx * dx + dy * dy > r * r) continue;
      e.ai.fear = Math.max(e.ai.fear || 0, 5 + Math.random() * 3);
      e.ai.fx = fx !== undefined ? fx : x;
      e.ai.fy = fy !== undefined ? fy : y;
      e.ai.sw = -1;
    }
  };

  // ---------- Ввод водителя ----------
  const drv = { thr: 0, st: 0, hb: false };
  Veh.input = function () {
    const I = J.Input, k = I.keys;
    let thr = (k.KeyW || k.ArrowUp ? 1 : 0) - (k.KeyS || k.ArrowDown ? 1 : 0);
    let st = (k.KeyD ? 1 : 0) - (k.KeyA ? 1 : 0);
    if (I.touch && (I.tmx || I.tmy)) {
      thr = J.clamp(-I.tmy * 1.4, -1, 1);
      st = J.clamp(I.tmx * 1.2, -1, 1);
    }
    drv.thr = thr;
    drv.st = st;
    drv.hb = !!(k.Space || I.touchHold.hb);
    if ((k.KeyH || I.touchHold.horn) && G().player.inCar) Veh.horn(true);
    else Veh.horn(false);
    return drv;
  };

  // ---------- Звук: мотор, занос, удары, сигнал ----------
  let A = null;
  function audio() {
    const UI = J.UI;
    if (!UI.sound) return null;
    if (A) return A;
    try {
      if (!UI.ac) UI.ac = new (window.AudioContext || window.webkitAudioContext)();
      const ac = UI.ac;
      const master = ac.createGain();
      master.gain.value = 0.9;
      master.connect(ac.destination);
      // мотор: пила + квадрат на пол-октавы ниже через фильтр
      const o1 = ac.createOscillator(), o2 = ac.createOscillator(), lp = ac.createBiquadFilter(), eg = ac.createGain();
      o1.type = 'sawtooth';
      o2.type = 'square';
      lp.type = 'lowpass';
      lp.frequency.value = 420;
      eg.gain.value = 0;
      o1.connect(lp);
      o2.connect(lp);
      lp.connect(eg);
      eg.connect(master);
      o1.start();
      o2.start();
      // шум (занос, удары)
      const nb = ac.createBuffer(1, ac.sampleRate, ac.sampleRate), nd = nb.getChannelData(0);
      for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;
      const ns = ac.createBufferSource();
      ns.buffer = nb;
      ns.loop = true;
      const bp = ac.createBiquadFilter(), sg = ac.createGain();
      bp.type = 'bandpass';
      bp.frequency.value = 1600;
      bp.Q.value = 1.4;
      sg.gain.value = 0;
      ns.connect(bp);
      bp.connect(sg);
      sg.connect(master);
      ns.start();
      // сигнал: два квадрата
      const h1 = ac.createOscillator(), h2 = ac.createOscillator(), hg = ac.createGain();
      h1.type = h2.type = 'square';
      h1.frequency.value = 415;
      h2.frequency.value = 523;
      hg.gain.value = 0;
      h1.connect(hg);
      h2.connect(hg);
      hg.connect(master);
      h1.start();
      h2.start();
      A = { ac, master, o1, o2, lp, eg, sg, nb, hg, horn: false };
    } catch (e) {
      A = null;
    }
    return A;
  }
  // звук создаём заранее (на экране загрузки), а не в момент посадки — без рывка кадра;
  // браузер запускает аудио только после жеста пользователя — возобновляем при первом нажатии
  Veh.warmAudio = function () {
    audio();
  };
  const resume = () => {
    const ac = J.UI && J.UI.ac;
    if (ac && ac.state === 'suspended') ac.resume().catch(() => {});
  };
  window.addEventListener('keydown', resume, { passive: true });
  window.addEventListener('mousedown', resume, { passive: true });
  window.addEventListener('touchstart', resume, { passive: true });
  Veh.sound = function (v, on) {
    const a = A || (on ? audio() : null);
    if (!a) return;
    const t = a.ac.currentTime;
    if (!on || !v || v.hp <= 0 || !J.UI.sound) {
      a.eg.gain.setTargetAtTime(0, t, 0.08);
      a.sg.gain.setTargetAtTime(0, t, 0.05);
      return;
    }
    // «передачи»: обороты растут и сбрасываются
    const sp = Math.abs(v.vf);
    const gears = [0, 7, 14, 22, 31, 44, 70];
    let gI = 1;
    while (gI < gears.length - 1 && sp > gears[gI]) gI++;
    const k = (sp - gears[gI - 1]) / (gears[gI] - gears[gI - 1]);
    const thr = Math.abs(v.accel) > 0.5 ? 1 : 0;
    const rpm = 0.18 + 0.82 * J.clamp(k, 0, 1) * (gI === 1 ? 0.9 : 1);
    const base = v.vt.m > 3000 ? 32 : v.type === 'sports' ? 58 : 44;
    a.o1.frequency.setTargetAtTime(base + rpm * base * 2.6, t, 0.05);
    a.o2.frequency.setTargetAtTime((base + rpm * base * 2.6) * 0.5, t, 0.05);
    a.lp.frequency.setTargetAtTime(300 + rpm * 900 + thr * 300, t, 0.08);
    a.eg.gain.setTargetAtTime(0.035 + 0.03 * thr + 0.02 * rpm, t, 0.08);
    const skid = J.clamp((Math.abs(v.vl) - 2.5) / 6, 0, 1);
    a.sg.gain.setTargetAtTime(skid * 0.07, t, 0.05);
  };
  Veh.horn = function (on) {
    const a = A || (on ? audio() : null);
    if (!a || a.horn === on) return;
    a.horn = on;
    a.hg.gain.setTargetAtTime(on ? 0.05 : 0, a.ac.currentTime, 0.02);
    if (on) {
      const p = G().player;
      if (p && p.inCar) J.scare(p.inCar.x + Math.cos(p.inCar.ang) * 8, p.inCar.y + Math.sin(p.inCar.ang) * 8, 6, p.inCar.x, p.inCar.y);
    }
  };
  // короткий сигнал чужой машины (громкость по расстоянию до камеры)
  Veh.honk = function (v, vol) {
    const d = Math.hypot(v.x - J.R3.cam.tx, v.y - J.R3.cam.tz);
    if (d > 50) return;
    const a = audio();
    if (!a) return;
    try {
      const ac = a.ac, t = ac.currentTime;
      const o = ac.createOscillator(), o2 = ac.createOscillator(), g = ac.createGain();
      o.type = o2.type = 'square';
      const f = v.vt.m > 3000 ? 280 : 380 + (v.id % 5) * 20;
      o.frequency.value = f;
      o2.frequency.value = f * 1.26;
      o.connect(g);
      o2.connect(g);
      g.connect(a.master);
      const gv = 0.045 * vol * (1 - d / 55);
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(gv, t + 0.02);
      g.gain.setValueAtTime(gv, t + 0.32);
      g.gain.linearRampToValueAtTime(0, t + 0.38);
      o.start(t);
      o2.start(t);
      o.stop(t + 0.4);
      o2.stop(t + 0.4);
    } catch (e) {}
  };
  function noiseHit(gain, f, dur) {
    const a = audio();
    if (!a) return;
    try {
      const ac = a.ac, t = ac.currentTime;
      const s = ac.createBufferSource(), fl = ac.createBiquadFilter(), g = ac.createGain();
      s.buffer = a.nb;
      fl.type = 'lowpass';
      fl.frequency.value = f;
      s.connect(fl);
      fl.connect(g);
      g.connect(a.master);
      g.gain.setValueAtTime(gain, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + dur);
      s.start(t, Math.random() * 0.5);
      s.stop(t + dur + 0.02);
    } catch (e) {}
  }
  Veh.crashSound = (imp, d) => noiseHit(Math.min(0.3, imp * 0.02) * (1 - d / 50), 700 + imp * 60, 0.25 + Math.min(0.4, imp * 0.02));
  Veh.thump = (d) => d < 40 && noiseHit(0.12 * (1 - d / 45), 300, 0.18);
  Veh.boom = (v) => {
    const d = Math.hypot(v.x - J.R3.cam.tx, v.y - J.R3.cam.tz);
    if (d < 80) noiseHit(0.45 * (1 - d / 85), 260, 1.2);
  };

  // ---------- Спидометр и звёзды розыска ----------
  Veh.hud = function (p) {
    let el = Veh._hudEl;
    if (!el) {
      const hud = document.getElementById('hud');
      if (!hud) return;
      el = Veh._hudEl = document.createElement('div');
      el.id = 'speedo';
      el.hidden = true;
      el.innerHTML = '<div class="sp-n"></div><div class="sp-v"><b>0</b><span>км/ч</span><em class="sp-g">N</em></div><div class="sp-hp"><i></i></div>';
      hud.appendChild(el);
      const wd = (Veh._wantEl = document.createElement('div'));
      wd.id = 'wanted';
      hud.appendChild(wd);
      Veh._hudB = el.querySelector('.sp-v b');
      Veh._hudG = el.querySelector('.sp-g');
      Veh._hudH = el.querySelector('.sp-hp i');
      Veh._hudN = el.querySelector('.sp-n');
    }
    const ws = p.wanted >= 1 ? '★'.repeat(Math.floor(p.wanted)) : '';
    if (Veh._lastW !== ws) {
      Veh._lastW = ws;
      Veh._wantEl.textContent = ws;
    }
    const v = p.inCar;
    if (!v) {
      if (!el.hidden) el.hidden = true;
      return;
    }
    if (el.hidden) el.hidden = false;
    const kmh = Math.round(Math.abs(v.vf) * 3.6);
    if (Veh._lastKmh !== kmh) {
      Veh._lastKmh = kmh;
      Veh._hudB.textContent = kmh;
    }
    const gear = v.reverse ? 'R' : Math.abs(v.vf) < 0.3 ? 'N' : 'D';
    if (Veh._lastGear !== gear) {
      Veh._lastGear = gear;
      Veh._hudG.textContent = gear;
    }
    const hp = Math.round((Math.max(0, v.hp) / v.maxHp) * 100);
    if (Veh._lastHp !== hp) {
      Veh._lastHp = hp;
      Veh._hudH.style.width = hp + '%';
      Veh._hudH.style.background = hp > 50 ? '#7ad86a' : hp > 20 ? '#f2c230' : '#e8402a';
    }
    if (Veh._lastName !== v.vt.name) {
      Veh._lastName = v.vt.name;
      Veh._hudN.textContent = v.vt.name;
    }
  };
})();
