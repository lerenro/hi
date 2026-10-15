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
    if (J.R3.clearSkids) J.R3.clearSkids();
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
  // Двухосная модель («велосипед»): боковые силы шин по углу увода (кривая Пасейки), нагрузка на оси с переносом веса
  // при разгоне и торможении, круг трения (газ у заднеприводных срывает зад в занос), ручник блокирует задние колёса.
  // На малой скорости — кинематика (без вырождения углов увода).
  const GRAV = 9.81;
  const tyre = (al, D) => -D * Math.sin(1.25 * Math.atan(10 * al));
  Veh.physics = function (v, dt, thr, st, hb) {
    const w = G().world, vt = v.vt;
    const ti = w.tile(v.x, v.y);
    const surf = SURF[ti], gk = GRIPK[ti];
    let ca = Math.cos(v.ang), sa = Math.sin(v.ang);
    let vf = v.vx * ca + v.vy * sa, vl = -v.vx * sa + v.vy * ca;
    // двигатель и тормоза
    let a = 0;
    v.reverse = false;
    let braking = false, drive = 0;
    if (v.hp <= 0) thr = 0;
    if (thr > 0.05) {
      if (vf < -0.4) { a = vt.brk * thr; braking = true; }
      else {
        drive = thr;
        a = vt.acc * thr * Math.max(0, 1 - (vf / vt.vmax) * (vf / vt.vmax)) / Math.max(1, surf * 0.5);
      }
    } else if (thr < -0.05) {
      if (vf > 0.4) { a = -vt.brk * -thr; braking = true; }
      else {
        a = vf > -vt.vmax * 0.26 ? -vt.acc * 0.6 * -thr : 0;
        v.reverse = true;
        drive = -thr;
      }
    }
    // сопротивление качению и воздуха
    const res = (0.25 + 0.45 * surf) + 0.0011 * vf * vf;
    let aW = a; // для переноса веса — только тяга и тормоза (сопротивление и трение заноса не входят)
    if (Math.abs(vf) > 0.05) a -= Math.sign(vf) * res;
    if (hb) {
      const hbA = Math.sign(vf) * Math.min(Math.abs(vf) / dt, 6.5);
      a -= hbA;
      aW -= hbA * 0.5;
      braking = true;
    }
    v.axS = (v.axS || 0) + (J.clamp(aW * Math.sign(vf || 1), -12, 10) - (v.axS || 0)) * Math.min(1, dt * 5);
    // занос гасит скорость (шины скользят боком)
    const slide = Math.abs(vl);
    a -= Math.sign(vf) * Math.min(Math.abs(vf) / dt, slide * 0.3);
    const nvf = vf + a * dt;
    // торможение не разгоняет в обратную сторону
    if ((braking || (thr === 0 && Math.abs(vf) < 1.5)) && Math.sign(nvf) !== Math.sign(vf) && vf !== 0) vf = 0;
    else vf = nvf;
    if (thr === 0 && !hb && Math.abs(vf) < 0.08) vf = 0;
    // руль: на скорости угол меньше (в заносе — можно контрить сильнее)
    // в заносе руль против вращения (контрруление) поворачивается сильнее
    const counter = st * v.yawRate < 0 && slide > 1.5 ? 1 + Math.min(1, slide / 8) * 0.8 : 1;
    const sMax = (vt.steer / (1 + Math.abs(vf) / 11)) * counter;
    v.steer += (st * sMax - v.steer) * Math.min(1, dt * 7);
    // перенос веса: при разгоне нагружается зад, при торможении — перед
    const m = vt.m, hcg = vt.H * 0.36, lf = vt.wb / 2, lr = vt.wb / 2;
    const dN = J.clamp((m * v.axS * hcg) / vt.wb, -m * GRAV * 0.08, m * GRAV * 0.08);
    const Nf = m * GRAV * 0.5 - dN, Nr = m * GRAV - Nf;
    const mu = (vt.grip / 9) * 1.3 * gk * (surf > 2 ? 0.85 : 1);
    // устойчивый баланс (зад держит чуть лучше перёда — машина недоворачивает, а не крутится сама)
    let muF = mu, muR = mu * 1.18;
    // полный газ: заднеприводная срывается в занос (на малой и средней скорости), переднеприводная недоворачивает
    if (drive > 0.85) {
      if (vt.rwd) muR *= Math.abs(vf) < 16 ? 0.66 : Math.abs(vf) < 24 ? 0.66 + (Math.abs(vf) - 16) * 0.0425 : 1;
      else muF *= 0.86;
    }
    if (braking && !hb) {
      muF *= 0.9;
      muR *= 0.86;
    }
    if (hb) muR *= 0.3; // задние колёса заблокированы
    const I = (m * (vt.L * vt.L + vt.W * vt.W)) / 12;
    const sp = Math.abs(vf);
    let r = v.yawRate;
    if (sp < 3) {
      // кинематика на малой скорости
      const yawT = (vf * Math.tan(v.steer)) / vt.wb;
      r += (yawT - r) * Math.min(1, dt * 10);
      vl *= Math.exp(-vt.grip * gk * dt);
      v.ay = vf * r;
    } else {
      const n = 3, h = dt / n, cd = Math.cos(v.steer), sd = Math.sin(v.steer);
      let ay = 0;
      for (let k = 0; k < n; k++) {
        // скорость колёс в их собственных осях → угол увода
        const vfw = vl + r * lf;
        const latF = -vf * sd + vfw * cd, lonF = vf * cd + vfw * sd;
        const Ff = tyre(Math.atan2(latF, Math.abs(lonF) + 0.3), muF * Nf);
        const Fr = tyre(Math.atan2(vl - r * lr, sp + 0.3), muR * Nr);
        ay = (Ff * cd + Fr) / m;
        vl += (ay - r * vf) * h;
        r += ((lf * Ff * cd - lr * Fr) / I) * h;
      }
      // плавный переход к кинематике около 3–5 м/с (без рывка)
      if (sp < 5) {
        const k = (5 - sp) / 2, yawT = (vf * Math.tan(v.steer)) / vt.wb;
        r += (yawT - r) * k * Math.min(1, dt * 10);
      }
      v.ay = ay;
    }
    if (!Number.isFinite(r) || !Number.isFinite(vl)) {
      r = 0;
      vl = 0;
    }
    v.yawRate = J.clamp(r, -5, 5);
    // скольжение колёс (для дыма и следов шин): боковое, пробуксовка на старте, блокировка ручником / резким тормозом
    v.skid = Math.max(J.clamp((slide - 1.6) / 4, 0, 1), hb && sp > 3 ? 0.9 : 0, braking && sp > 9 && thr < -0.5 ? 0.5 : 0, drive > 0.8 && sp < 7 && vt.acc > 6.5 && surf < 1.2 ? 0.7 : 0);
    v.v2 = vf;
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
    // кузов на пружинах: клевок при торможении, приседание при разгоне, крен наружу поворота (с затухающим покачиванием)
    const ay = v.ay !== undefined ? v.ay : v.vf * v.yawRate;
    const soft = vt.m > 3000 ? 1.4 : vt.id === 'sports' ? 0.6 : 1;
    const pitchT = tp + J.clamp(-v.accel * 0.0062 * soft, -0.055, 0.07);
    const rollT = tr + J.clamp(-ay * 0.0085 * soft, -0.09, 0.09);
    const kS = 90, cS = 11, h2 = Math.min(dt, 0.034) / 2;
    for (let k = 0; k < 2; k++) {
      v.pitchV = (v.pitchV || 0) + ((pitchT - v.pitch) * kS - (v.pitchV || 0) * cS) * h2;
      v.rollV = (v.rollV || 0) + ((rollT - v.roll) * kS * 0.8 - (v.rollV || 0) * cS) * h2;
      v.pitch += v.pitchV * h2;
      v.roll += v.rollV * h2;
    }
    // удар по подвеске на бордюре / кочке
    const dy = gy - (v.gyPrev === undefined ? gy : v.gyPrev);
    v.gyPrev = gy;
    if (Math.abs(dy) > 0.03 && full) v.pitchV -= dy * 6 * Math.sign(v.vf || 1);
    v.spin += (v.vf / vt.wr) * dt;
    // буксующие колёса крутятся быстрее
    if (v.skid > 0.6 && v.mode === 'player' && Math.abs(v.vf) < 7 && !v.braking) v.spin += 18 * dt;
  };

  // ---------- Урон машине ----------
  // разбитая машина сначала загорается (несколько секунд, чтобы успеть выскочить), потом взрывается;
  // мгновенный взрыв — только от огромного разового урона (другой взрыв, способности)
  Veh.damage = function (v, amt, src, noDent) {
    if (v.hp <= 0 || !(amt > 0)) return;
    v.hp -= amt;
    // удар силой, пулей, взрывом рядом — вмятина в случайном месте кузова, при сильном — стёкла
    if (!noDent && amt >= 12 && J.R3.carDent) {
      const a = Math.random() * J.TAU;
      J.R3.carDent(v, v.x + Math.cos(a) * v.vt.L, v.y + Math.sin(a) * v.vt.L, Math.min(16, 4 + amt / 6), 0.5 + Math.random() * 0.5);
      if (!v.glassBroken && (amt > 50 || v.hp < v.maxHp * 0.3)) Veh.breakGlass(v, v.x, v.y);
    }
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
  Veh.breakGlass = function (v, x, y, dCam) {
    v.glassBroken = true;
    J.R3.burst(x, y, v.gy + v.vt.H * 0.75, '#d8eef4', 14, 3.2, 0.7, 2);
    if (J.Pw && J.Pw.shards) J.Pw.shards(x, v.gy + v.vt.H * 0.75, y, 10, '#cfe6ee', 3, 0.05, 0);
    if (dCam === undefined) dCam = Math.hypot(x - J.R3.cam.tx, y - J.R3.cam.tz);
    if (dCam < 45) Veh.glassSound(dCam);
  };
  Veh.explode = function (v, src) {
    v.hp = 0;
    v.siren = false;
    const g = G(), R3 = J.R3;
    const gy = v.gy;
    if (J.Pw && J.Pw.explosion) {
      J.Pw.explosion(v.x, v.y, 3.2, '#ffc070');
      J.Pw.smoke(v.x, gy + 1.5, v.y, 10, '#1a1614', 1.6, 3.2, 2.2, 1, 0.65);
      if (J.Pw.shards) J.Pw.shards(v.x, gy + 1, v.y, 12, '#3a3a3e', 7, 0.14, 1, undefined, 4, 12, 1.4);
    } else {
      R3.burst(v.x, v.y, gy + 1, '#ffb030', 36, 9, 0.9, 4);
      R3.burst(v.x, v.y, gy + 1.4, '#3a3a3a', 26, 4, 1.6, 3);
    }
    R3.flash && R3.flash(v.x, v.y, 4, '#ffcf6a', 0.5, 2);
    R3.ring && R3.ring(v.x, v.y, 5, '#ffb030', 0.5);
    // кузов подбрасывает и мнёт со всех сторон, стёкла вылетают
    v.glassBroken = true;
    v.wreckT = 0;
    v.pitchV = (v.pitchV || 0) + (Math.random() - 0.5) * 4;
    v.rollV = (v.rollV || 0) + (Math.random() - 0.5) * 5;
    if (R3.carDent) for (let k = 0; k < 3; k++) R3.carDent(v, v.x + (Math.random() - 0.5) * v.vt.L, v.y + (Math.random() - 0.5) * v.vt.L, 16, 1.0);
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
    Veh.damage(v, dmg, v.driver && v.driver.isPlayer ? v.driver : null, true);
    const gy = v.gy;
    R3.burst(x, y, gy + 0.6, '#ffd27a', Math.min(18, 3 + imp * 1.5), 3 + imp * 0.3, 0.35, 1.5);
    if (imp > 7) R3.burst(x, y, gy + 0.7, '#b8bcc4', 8, 3, 0.6, 1.2); // осколки
    const dCam = Math.hypot(x - R3.cam.tx, y - R3.cam.tz);
    // вмятина в месте удара, на сильном — разбитые стёкла и оторванный бампер
    if (imp > 3.5 && R3.carDent) R3.carDent(v, x, y, imp);
    if (!v.glassBroken && (imp > 12 || (imp > 6 && v.hp < v.maxHp * 0.35))) Veh.breakGlass(v, x, y, dCam);
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
        // только что выскочивший водитель не попадает под собственную машину
        if (vn > 3.2 && !(e._carHit > g.t) && !(e === v.exDriver && g.t < v.exT)) {
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
    v.exDriver = p;
    v.exT = G().t + 2;
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
        // машина несётся по тротуару или очень быстро — прохожие впереди отпрыгивают
        if ((mine || v.chase) && Math.abs(v.vf) > 5) {
          v.scareT = (v.scareT || 0) - dt;
          if (v.scareT <= 0) {
            v.scareT = 0.25;
            const onRoad = w.tile(v.x, v.y) === J.T.ROAD;
            if (!onRoad || Math.abs(v.vf) > 12) {
              const k = Math.sign(v.vf) * (onRoad ? 5 : 7);
              J.scare(v.x + Math.cos(v.ang) * k, v.y + Math.sin(v.ang) * k, onRoad ? 3.5 : 7, v.x, v.y, Math.cos(v.ang), Math.sin(v.ang));
            }
          }
        }
        // свободная машина остановилась — водитель возвращается в поток (если рядом своя полоса)
        if (!mine && !v.chase && v.mode === 'free') {
          if (Math.hypot(v.vx, v.vy) < 0.4) {
            v.restT += dt;
            if (v.restT > 2.5) Veh.settle(v, tr);
          } else v.restT = 0;
        }
      } else Veh.ground(v, dt, false);
      // дым и огонь у повреждённых: сначала струйка пара, потом чёрный дым, потом пламя из-под капота — и взрыв
      if (v.hp < v.maxHp * 0.5 && v.d2 < 3600) Veh.burnFx(v, dt, mine ? p : null);
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
    Veh.ambient();
    Veh.updateWanted(dt, p);
  };
  const Pw = () => J.Pw;
  Veh.burnFx = function (v, dt, src) {
    v.smokeT -= dt;
    if (v.smokeT > 0) return;
    const k = Math.max(0, v.hp) / v.maxHp, vt = v.vt;
    const ca = Math.cos(v.ang), sa = Math.sin(v.ang);
    // моторный отсек — спереди (у автобуса и фургона — сзади/спереди по типу)
    const f = vt.shape === 'bus' ? -vt.L / 2 + 1 : vt.L / 2 - Math.min(1, vt.L * 0.22);
    const x = v.x + ca * f, y = v.y + sa * f, h = v.gy + (vt.shape === 'bus' || vt.shape === 'truck' ? vt.H * 0.5 : vt.H * 0.62);
    const pw = Pw();
    // ветер от езды сносит дым назад
    const wx = -v.vx * 0.25, wy = -v.vy * 0.25;
    if (v.hp <= 0) {
      // остов догорает, потом коптит
      v.smokeT = 0.12;
      v.wreckT = (v.wreckT || 0) + 0.12;
      if (pw && pw.fire && v.wreckT < 14) {
        pw.fire(v.x, v.gy + vt.H * 0.45, v.y, 2, vt.W * 0.35, 1.8, 0.7);
        if (Math.random() < 0.25) pw.light(v.x, v.gy + 1.2, v.y, '#ff8a3a', 1.6, 8, 0.4);
      } else if (pw && pw.smoke) pw.smoke(v.x, v.gy + vt.H * 0.7, v.y, 1, '#1a1a1a', 1.1, 2.6, 1.2, 0.4, 0.4);
      else J.R3.burst(v.x, v.gy + vt.H * 0.6, v.y, '#2a2a2a', 1, 0.6, 1.2, 1.8);
      return;
    }
    if (!pw || !pw.smoke) {
      v.smokeT = k < 0.2 ? 0.05 : 0.18;
      J.R3.burst(x, y, h, k < 0.2 ? '#ff8a30' : '#6a6a6a', 1, 0.8, 0.9, 1.6);
    } else if (v.fire) {
      v.smokeT = 0.06;
      pw.fire(x, h, y, 2, 0.35, 2.2, 0.55 + Math.min(0.5, (v.burnT || 0) * 0.08), wx, wy);
      pw.smoke(x, h + 0.5, y, 1, '#141210', 1.2, 2.4, 1.5, 0.3, 0.55);
      if (Math.random() < 0.3) pw.light(x, h + 0.6, y, '#ff7a2a', 2.2, 9, 0.35);
    } else if (k < 0.25) {
      v.smokeT = 0.08;
      pw.smoke(x, h, y, 1, '#1f1d1b', 0.9, 2.2, 1.3, 0.25, 0.5);
    } else {
      // белёсый пар из радиатора
      v.smokeT = 0.15;
      pw.smoke(x, h, y, 1, '#b8b8b4', 0.6, 1.4, 0.9, 0.2, 0.25 + (0.5 - k) * 0.6);
    }
    if (v.fire) {
      v.burnT = (v.burnT || 0) + (v.smokeT || 0.06);
      if (v.burnT > 6) Veh.explode(v, src);
    }
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
  // hx, hy — курс машины: тогда люди бегут в сторону от её пути, а не вперёд по нему
  J.scare = function (x, y, r, fx, fy, hx, hy) {
    const ents = G().ents;
    for (let i = 0; i < ents.length; i++) {
      const e = ents[i];
      if (e.kind !== 'civ' || e.dead || !e.ai || e.ai.still) continue;
      const dx = e.x - x, dy = e.y - y;
      if (dx * dx + dy * dy > r * r) continue;
      e.ai.fear = Math.max(e.ai.fear || 0, 5 + Math.random() * 3);
      e.ai.fx = fx !== undefined ? fx : x;
      e.ai.fy = fy !== undefined ? fy : y;
      if (hx !== undefined) {
        const t = (e.x - fx) * hx + (e.y - fy) * hy;
        e.ai.fx = fx + hx * t;
        e.ai.fy = fy + hy * t;
      }
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

  // ---------- Звук: мотор, шины, ветер, сигнал, сирена, удары (синтез WebAudio, без файлов) ----------
  // Мотор: три пилообразные/прямоугольные гармоники частоты вспышек, мягкое искажение, фильтр по нагрузке,
  // «перебои» цилиндров (модуляция), шум впуска. Обороты считаются по передачам — при переключении проседают.
  // Шины: визг — узкополосный шум с тоном; гул протектора и ветер растут со скоростью.
  let A = null;
  function noiseBuf(ac) {
    const nb = ac.createBuffer(1, ac.sampleRate * 2, ac.sampleRate), nd = nb.getChannelData(0);
    for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;
    return nb;
  }
  function loopNoise(ac, nb) {
    const s = ac.createBufferSource();
    s.buffer = nb;
    s.loop = true;
    s.start(0, Math.random());
    return s;
  }
  const filt = (ac, type, f, q) => {
    const b = ac.createBiquadFilter();
    b.type = type;
    b.frequency.value = f;
    if (q !== undefined) b.Q.value = q;
    return b;
  };
  const gain = (ac, v) => {
    const g = ac.createGain();
    g.gain.value = v || 0;
    return g;
  };
  // мотор: osc × 3 → искажение → фильтр → громкость
  function engineVoice(ac, out, nb) {
    const o1 = ac.createOscillator(), o2 = ac.createOscillator(), o3 = ac.createOscillator();
    o1.type = 'sawtooth';
    o2.type = 'square';
    o3.type = 'sawtooth';
    const g2 = gain(ac, 0.55), g3 = gain(ac, 0.22);
    const sh = ac.createWaveShaper();
    const cv = new Float32Array(256);
    for (let i = 0; i < 256; i++) {
      const x = (i / 255) * 2 - 1;
      cv[i] = Math.tanh(x * 2.2) * 0.8;
    }
    sh.curve = cv;
    const lp = filt(ac, 'lowpass', 420, 2.5), body = filt(ac, 'peaking', 110, 1.2);
    body.gain.value = 6;
    const eg = gain(ac, 0);
    // неровность работы цилиндров
    const lfo = ac.createOscillator(), lg = gain(ac, 0);
    lfo.type = 'triangle';
    lfo.connect(lg);
    lg.connect(eg.gain);
    o1.connect(sh);
    o2.connect(g2).connect(sh);
    o3.connect(g3).connect(sh);
    sh.connect(lp).connect(body).connect(eg).connect(out);
    // впуск: шум, полоса растёт с оборотами
    const ns = loopNoise(ac, nb), bp = filt(ac, 'bandpass', 500, 1.1), ig = gain(ac, 0);
    ns.connect(bp).connect(ig).connect(out);
    for (const o of [o1, o2, o3, lfo]) o.start();
    return { o1, o2, o3, lp, eg, lfo, lg, bp, ig };
  }
  function audio() {
    const UI = J.UI;
    if (!UI.sound) return null;
    if (A) return A;
    try {
      if (!UI.ac) UI.ac = new (window.AudioContext || window.webkitAudioContext)();
      const ac = UI.ac;
      const master = gain(ac, 0.9), comp = ac.createDynamicsCompressor();
      comp.threshold.value = -14;
      comp.ratio.value = 3;
      master.connect(comp).connect(ac.destination);
      const nb = noiseBuf(ac);
      const eng = engineVoice(ac, master, nb);
      // машины потока рядом (ближайшая) — тише и глуше
      const tLp = gain(ac, 1), traffic = engineVoice(ac, tLp, nb);
      tLp.connect(master);
      // визг шин: две узкие полосы шума + тон с дрожанием
      const sq = gain(ac, 0);
      const n1 = loopNoise(ac, nb), b1 = filt(ac, 'bandpass', 1050, 9), b2 = filt(ac, 'bandpass', 1900, 12);
      n1.connect(b1).connect(sq);
      n1.connect(b2).connect(sq);
      const so = ac.createOscillator(), sog = gain(ac, 0.18), vib = ac.createOscillator(), vg = gain(ac, 22);
      so.type = 'triangle';
      so.frequency.value = 980;
      vib.frequency.value = 7;
      vib.connect(vg).connect(so.frequency);
      so.connect(sog).connect(sq);
      so.start();
      vib.start();
      sq.connect(master);
      // гул протектора и ветер
      const n2 = loopNoise(ac, nb), rl = filt(ac, 'lowpass', 300, 0.7), rg = gain(ac, 0);
      n2.connect(rl).connect(rg).connect(master);
      const wb = filt(ac, 'bandpass', 700, 0.4), wg = gain(ac, 0);
      n2.connect(wb).connect(wg).connect(master);
      // сигнал: две ноты через полосовой фильтр (тембр клаксона)
      const h1 = ac.createOscillator(), h2 = ac.createOscillator(), hb = filt(ac, 'bandpass', 620, 1.4), hg = gain(ac, 0);
      h1.type = h2.type = 'sawtooth';
      h1.frequency.value = 415;
      h2.frequency.value = 523;
      h1.connect(hb);
      h2.connect(hb);
      hb.connect(hg).connect(master);
      h1.start();
      h2.start();
      // сирена полиции: тон с плавающей частотой
      const sr = ac.createOscillator(), srg = gain(ac, 0), srl = filt(ac, 'lowpass', 2400, 0.8);
      sr.type = 'triangle';
      sr.connect(srl).connect(srg).connect(master);
      sr.start();
      A = { ac, master, eng, traffic, sq, rg, wg, hg, h1, h2, sr, srg, nb, horn: false, rpm: 0.12, gear: 1, shiftT: 0 };
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
  // характер мотора по типу: частота вспышек на холостых и на отсечке, громкость
  const ENG = {
    sports: [30, 310, 1.25], truck: [17, 105, 1.3], bus: [16, 98, 1.25], van: [22, 170, 1], pickup: [24, 190, 1.15], kei: [30, 260, 0.75], compact: [27, 230, 0.85],
  };
  const engOf = (vt) => ENG[vt.id] || ENG[vt.shape] || [25, 215, 1];
  // передачи: доли максимальной скорости
  const GEARS = [0, 0.15, 0.29, 0.45, 0.63, 0.83, 1.05];
  // обороты 0..1 и передача по скорости; газ на месте / в пробуксовке — обороты вверх
  function rpmOf(v, thr) {
    const sp = Math.abs(v.vf), vm = v.vt.vmax;
    if (v.reverse || v.vf < -0.3) return { r: 0.2 + Math.min(0.6, (sp / (vm * 0.26)) * 0.6), g: -1 };
    let g = 1;
    while (g < GEARS.length - 1 && sp > GEARS[g] * vm) g++;
    const k = J.clamp((sp - GEARS[g - 1] * vm) / ((GEARS[g] - GEARS[g - 1]) * vm), 0, 1);
    let r = 0.22 + 0.74 * k;
    if (g === 1) r = 0.14 + 0.82 * k;
    if (thr > 0.5 && (v.skid > 0.5 || sp < 1)) r = Math.max(r, 0.55 + (v.skid || 0) * 0.35);
    return { r, g };
  }
  Veh.sound = function (v, on) {
    const a = A || (on ? audio() : null);
    if (!a) return;
    const t = a.ac.currentTime, e = a.eng;
    if (!on || !v || v.hp <= 0 || !J.UI.sound) {
      e.eg.gain.setTargetAtTime(0, t, 0.08);
      e.ig.gain.setTargetAtTime(0, t, 0.08);
      e.lg.gain.setTargetAtTime(0, t, 0.08);
      a.sq.gain.setTargetAtTime(0, t, 0.05);
      a.rg.gain.setTargetAtTime(0, t, 0.1);
      a.wg.gain.setTargetAtTime(0, t, 0.1);
      return;
    }
    const thr = J.Input && J.Input.keys ? ((J.Input.keys.KeyW || J.Input.keys.ArrowUp) ? 1 : 0) || (J.Input.touch && J.Input.tmy < -0.2 ? 1 : 0) : 0;
    const R = rpmOf(v, thr);
    // переключение вверх: короткий провал оборотов и тяги
    if (R.g > a.gear && R.g > 1) a.shiftT = 0.18;
    a.gear = R.g;
    v.gear = R.g;
    a.shiftT = Math.max(0, a.shiftT - 1 / 60);
    const load = J.clamp(thr * (a.shiftT > 0 ? 0.3 : 1), 0, 1);
    const want = a.shiftT > 0 ? R.r * 0.72 : R.r;
    a.rpm += (want - a.rpm) * (want > a.rpm ? 0.16 : 0.1);
    const [f0, f1, vol] = engOf(v.vt);
    const f = f0 + (f1 - f0) * a.rpm;
    e.o1.frequency.setTargetAtTime(f, t, 0.03);
    e.o2.frequency.setTargetAtTime(f * 0.5, t, 0.03);
    e.o3.frequency.setTargetAtTime(f * 1.503, t, 0.03);
    e.lfo.frequency.setTargetAtTime(f * 0.25, t, 0.05);
    e.lg.gain.setTargetAtTime((0.012 + 0.01 * (1 - a.rpm)) * vol, t, 0.1);
    e.lp.frequency.setTargetAtTime(260 + a.rpm * 1300 + load * 900, t, 0.06);
    e.eg.gain.setTargetAtTime((0.04 + 0.035 * load + 0.025 * a.rpm) * vol, t, 0.06);
    e.bp.frequency.setTargetAtTime(350 + a.rpm * 1400, t, 0.08);
    e.ig.gain.setTargetAtTime((0.004 + 0.02 * load * a.rpm) * vol, t, 0.08);
    // шины, протектор, ветер
    const sp = Math.abs(v.vf);
    const skid = J.clamp((v.skid || 0) * Math.min(1, sp / 4), 0, 1);
    a.sq.gain.setTargetAtTime(skid * 0.085, t, 0.04);
    a.rg.gain.setTargetAtTime(Math.min(0.06, sp * 0.0022), t, 0.1);
    a.wg.gain.setTargetAtTime(Math.min(0.05, sp * sp * 0.000022), t, 0.1);
  };
  // звук окружающего потока: ближайшая едущая машина и сирены (вызывается каждый кадр)
  Veh.ambient = function () {
    const a = A;
    if (!a || !J.UI.sound) return;
    const t = a.ac.currentTime, cx = J.R3.cam.tx, cz = J.R3.cam.tz, p = G().player;
    let best = null, bd = 26, sir = null, sd = 90;
    for (const v of G().vehs) {
      if (v.hp <= 0 || !v.driver || (p && v === p.inCar)) continue;
      const d = Math.hypot(v.x - cx, v.y - cz);
      if (d < bd && Math.abs(v.vf) > 0.5) {
        bd = d;
        best = v;
      }
      if (v.siren && d < sd) {
        sd = d;
        sir = v;
      }
    }
    const e = a.traffic;
    if (best) {
      const sp = Math.abs(best.vf), [f0, f1, vol] = engOf(best.vt);
      const r = 0.2 + Math.min(0.7, (sp / best.vt.vmax) * 1.6) * (0.6 + 0.4 * ((sp * 0.37) % 1));
      const f = f0 + (f1 - f0) * r;
      e.o1.frequency.setTargetAtTime(f, t, 0.08);
      e.o2.frequency.setTargetAtTime(f * 0.5, t, 0.08);
      e.o3.frequency.setTargetAtTime(f * 1.5, t, 0.08);
      e.lfo.frequency.setTargetAtTime(f * 0.25, t, 0.1);
      e.lp.frequency.setTargetAtTime(240 + r * 700, t, 0.1);
      const k = (1 - bd / 26) ** 2;
      e.eg.gain.setTargetAtTime(0.045 * k * vol, t, 0.12);
      e.lg.gain.setTargetAtTime(0.008 * k, t, 0.12);
      e.ig.gain.setTargetAtTime(0.004 * k, t, 0.12);
    } else {
      e.eg.gain.setTargetAtTime(0, t, 0.2);
      e.lg.gain.setTargetAtTime(0, t, 0.2);
      e.ig.gain.setTargetAtTime(0, t, 0.2);
    }
    // сирена: «вой» (плавно вверх-вниз) или «йелп» вблизи
    if (sir) {
      const k = (1 - sd / 90) ** 1.5, ph = G().t;
      const yelp = sd < 25;
      const f = yelp ? 900 + 500 * Math.abs(((ph * 3) % 2) - 1) : 700 + 650 * (0.5 - 0.5 * Math.cos(ph * 1.6));
      a.sr.frequency.setTargetAtTime(f, t, 0.03);
      a.srg.gain.setTargetAtTime(0.05 * k, t, 0.1);
    } else a.srg.gain.setTargetAtTime(0, t, 0.15);
  };
  Veh.horn = function (on) {
    const a = A || (on ? audio() : null);
    if (!a || a.horn === on) return;
    a.horn = on;
    const p = G().player, big = p && p.inCar && p.inCar.vt.m > 3000;
    a.h1.frequency.value = big ? 233 : 415;
    a.h2.frequency.value = big ? 294 : 523;
    a.hg.gain.setTargetAtTime(on ? 0.07 : 0, a.ac.currentTime, 0.015);
    if (on) {
      if (p && p.inCar) J.scare(p.inCar.x + Math.cos(p.inCar.ang) * 8, p.inCar.y + Math.sin(p.inCar.ang) * 8, 6, p.inCar.x, p.inCar.y, Math.cos(p.inCar.ang), Math.sin(p.inCar.ang));
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
      const o = ac.createOscillator(), o2 = ac.createOscillator(), bp = filt(ac, 'bandpass', 600, 1.3), g = ac.createGain();
      o.type = o2.type = 'sawtooth';
      const f = v.vt.m > 3000 ? 240 : 380 + (v.id % 5) * 20;
      o.frequency.value = f;
      o2.frequency.value = f * 1.26;
      o.connect(bp);
      o2.connect(bp);
      bp.connect(g).connect(a.master);
      const gv = 0.07 * vol * (1 - d / 55);
      const len = 0.18 + (v.id % 3) * 0.14;
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(gv, t + 0.015);
      g.gain.setValueAtTime(gv, t + len);
      g.gain.linearRampToValueAtTime(0, t + len + 0.05);
      // иногда — двойной сигнал
      if (v.id % 2) {
        g.gain.setValueAtTime(0, t + len + 0.12);
        g.gain.linearRampToValueAtTime(gv, t + len + 0.135);
        g.gain.setValueAtTime(gv, t + len + 0.3);
        g.gain.linearRampToValueAtTime(0, t + len + 0.35);
      }
      o.start(t);
      o2.start(t);
      o.stop(t + len + 0.4);
      o2.stop(t + len + 0.4);
    } catch (e) {}
  };
  function noiseHit(gainV, f, dur, type) {
    const a = audio();
    if (!a) return;
    try {
      const ac = a.ac, t = ac.currentTime;
      const s = ac.createBufferSource(), fl = filt(ac, type || 'lowpass', f), g = ac.createGain();
      s.buffer = a.nb;
      s.connect(fl).connect(g).connect(a.master);
      g.gain.setValueAtTime(gainV, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + dur);
      s.start(t, Math.random() * 1.5);
      s.stop(t + dur + 0.02);
    } catch (e) {}
  }
  // металл: несколько негармонических тонов с быстрым затуханием (звон и скрежет кузова)
  function metal(gainV, base, dur) {
    const a = audio();
    if (!a) return;
    try {
      const ac = a.ac, t = ac.currentTime;
      for (const m of [1, 1.62, 2.24, 3.48, 5.4]) {
        const o = ac.createOscillator(), g = ac.createGain();
        o.type = m < 2 ? 'triangle' : 'square';
        const f = base * m * (0.95 + Math.random() * 0.1);
        o.frequency.setValueAtTime(f, t);
        o.frequency.exponentialRampToValueAtTime(f * 0.92, t + dur);
        const pk = (gainV / m) * (m > 3 ? 0.35 : 1);
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(pk, t + 0.004);
        g.gain.exponentialRampToValueAtTime(0.0001, t + dur * (1.2 - m * 0.12));
        o.connect(g).connect(a.master);
        o.start(t);
        o.stop(t + dur + 0.05);
      }
    } catch (e) {}
  }
  Veh.crashSound = (imp, d) => {
    const k = Math.max(0, 1 - d / 50);
    noiseHit(Math.min(0.32, imp * 0.022) * k, 500 + imp * 50, 0.22 + Math.min(0.45, imp * 0.022));
    metal(Math.min(0.09, imp * 0.006) * k, 150 + Math.random() * 120, 0.25 + Math.min(0.5, imp * 0.025));
    if (imp > 8) noiseHit(0.08 * k, 2500, 0.35, 'highpass'); // скрежет и осколки
  };
  Veh.glassSound = (d) => {
    const k = Math.max(0, 1 - d / 45);
    noiseHit(0.12 * k, 3500, 0.5, 'highpass');
    if (J.Sfx && J.Sfx.glass && k > 0.3) J.Sfx.glass();
  };
  Veh.thump = (d) => d < 40 && noiseHit(0.14 * (1 - d / 45), 300, 0.18);
  Veh.boom = (v) => {
    const d = Math.hypot(v.x - J.R3.cam.tx, v.y - J.R3.cam.tz);
    if (d < 80) {
      noiseHit(0.5 * (1 - d / 85), 240, 1.6);
      metal(0.06 * (1 - d / 85), 90, 0.9);
    }
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
    const gear = v.reverse ? 'R' : Math.abs(v.vf) < 0.3 ? 'N' : v.gear > 0 ? String(v.gear) : 'D';
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
