'use strict';
// Метательное со взрывателем: осколочная граната (взрыв, осколки, машины), коктейль Молотова (огонь растекается,
// перекидывается по траве, поджигает людей и машины), светошумовая (ослепление и звон в ушах), дымовая шашка
// (плотная завеса — в дыму не видят и не целятся).
(function () {
  const Gn = J.Guns;
  const H = J.Hand;
  const G = () => J.G;
  const R3 = J.R3;
  const rnd = Math.random;
  const TAU = Math.PI * 2;
  const gy = (x, y) => G().world.groundY(x, y);
  const fxOk = () => J.Fx && J.Fx.ready;
  const pwOk = () => J.Pw && J.Pw.ready;
  const near = (x, y, r) => {
    const p = G().player;
    return !!p && J.dist(x, y, p.x, p.y) < r;
  };
  const N = (J.Nades = { FIRES: [], SMOKES: [] });

  // прямая видимость между точками (стены и здания; дым — отдельно)
  N.los = function (ax, ah, az, bx, bh, bz) {
    const L = Math.hypot(bx - ax, bz - az);
    const n = Math.ceil(L / 0.4);
    for (let i = 1; i < n; i++) {
      const k = i / n;
      const x = ax + (bx - ax) * k, z = az + (bz - az) * k, h = ah + (bh - ah) * k;
      if (Gn.topAt(x, z) > h) return false;
    }
    return true;
  };

  // ---------- Взрыв осколочной ----------
  function frag(o) {
    const g = G();
    const x = o.x, y = o.y, h = Math.max(o.h, gy(x, y) + 0.1);
    const R = 6.5;
    if (pwOk()) {
      J.Pw.explosion(x, y, 2.4, '#ffd08a', true);
      J.Pw.smoke(x, h + 0.4, y, 10, '#3a3430', 1.1, 2.6, 1.4, 1.2, 0.6);
    } else J.R3.burst(x, y, 1, '#ffb030', 30, 6, 0.6, 3);
    if (fxOk()) J.Fx.debris(x, h + 0.3, y, 0, 0, 14, '#5a5048');
    // осколки — трассеры во все стороны
    for (let i = 0; i < 10; i++) {
      const a = rnd() * TAU, e = (rnd() - 0.2) * 0.6;
      Gn.tracer(x, h + 0.2, y, Math.cos(a) * Math.cos(e), Math.sin(e), Math.sin(a) * Math.cos(e), 3 + rnd() * 6, { sp: 90, len: 0.6, w: 0.01 });
    }
    // дырки от осколков на ближних стенах
    for (let i = 0; i < 8; i++) {
      const a = rnd() * TAU;
      const r = Gn.trace(x, h + 0.3, y, Math.cos(a), (rnd() - 0.3) * 0.5, Math.sin(a), R, null, { all: true });
      if (r.kind === 'wall') Gn.hole(r.x, r.h, r.z, r.nx, r.ny, r.nz, 0.08);
    }
    Gn.snd('shotgun', x, y, { k: 1.4, prio: true });
    const own = o.owner;
    for (const e of g.ents) {
      if (e.dead) continue;
      const d = J.dist(x, y, e.x, e.y);
      if (d > R) continue;
      if (!N.los(x, h + 0.5, y, e.x, gy(e.x, e.y) + 1, e.y)) continue;
      const k = Math.pow(1 - d / R, 1.3);
      const a = Math.atan2(e.y - y, e.x - x);
      if (e.kind === 'civ') {
        if (J.Veh.knockDown) J.Veh.knockDown(e, 60 * k, a, 6 * k, own);
        else e.downT = 3;
        continue;
      }
      let dmg = 150 * k;
      if (e === own) dmg *= 0.55;
      J.hurt(e, dmg, own && !own.dead ? own : null, { ang: a, knock: 4 + 9 * k, stun: 0.6 + k, launch: k > 0.45, unblockable: true, kind: 'phys', gdmg: 80, fxTier: 'big', explosion: true });
    }
    // машины: рядом — взрыв, дальше — пожар
    if (g.vehs && J.Pw) {
      for (const v of g.vehs) {
        if (v.hp <= 0) continue;
        const d = Math.hypot(v.x - x, v.y - y) - v.vt.L * 0.3;
        if (d > 5) continue;
        if (d < 1.6) J.Veh.damage(v, v.maxHp * 2, own);
        else J.Pw.hitVeh(v, 70 * (1 - d / 5), own, true, 6 * (1 - d / 5), Math.atan2(v.y - y, v.x - x));
      }
    }
    // мусор и вещи разлетаются
    for (const gi of H.GROUND.slice()) {
      if (J.dist(gi.x, gi.y, x, y) < 3 && !gi.loot) gi.life = Math.min(gi.life, 0.01);
    }
    if (own && own.isPlayer && g.world.cityAt(x, y)) J.Veh.crime(1.4, x, y);
    J.scare(x, y, 40);
  }

  // ---------- Огонь (Молотов) ----------
  const FLAM = new Uint8Array(64);
  ['GRASS', 'FOREST', 'FIELD', 'DRYGRASS', 'MOOR', 'LAWN', 'FARM', 'SWAMP'].forEach((k) => { if (J.T[k] !== undefined) FLAM[J.T[k]] = 1; });
  N.addFire = function (x, y, r, life, own, gen) {
    const w = G().world;
    if (w.isWater(x, y) || w.solid(x, y)) return null;
    if (N.FIRES.length >= 32) {
      // самый старый гаснет
      N.FIRES.sort((a, b) => b.t - a.t);
      N.FIRES.length = 31;
    }
    const f = { x, y, r, life, t: 0, own, gen: gen || 0, dmgT: rnd() * 0.4, sprT: 0.8 + rnd() * 0.6, lt: 0 };
    N.FIRES.push(f);
    return f;
  };
  function molotov(o) {
    const x = o.x, y = o.y;
    const w = G().world;
    if (w.isWater(x, y)) {
      if (pwOk()) J.Pw.smoke(x, gy(x, y) + 0.2, y, 6, '#d8d8d8', 0.4, 1, 1, 0.3, 0.5);
      return;
    }
    const a = Math.atan2(o.vy || 0, o.vx || 0);
    N.addFire(x, y, 1.7, 9 + rnd() * 3, o.owner, 0);
    // брызги горящего бензина вперёд по полёту
    const n = 3 + Math.floor(rnd() * 3);
    for (let i = 0; i < n; i++) {
      const aa = a + (rnd() - 0.5) * 1.6, d = 0.9 + rnd() * 1.8;
      N.addFire(x + Math.cos(aa) * d, y + Math.sin(aa) * d, 0.9 + rnd() * 0.5, 6 + rnd() * 4, o.owner, 1);
    }
    if (pwOk()) {
      J.Pw.fire(x, gy(x, y) + 0.1, y, 26, 1.4, 3.2, 0.9);
      J.Pw.light(x, gy(x, y) + 1, y, '#ff9a3a', 3.5, 12, 0.6);
    }
    Gn.snd('whoomp', x, y, { k: 1.3, prio: true });
    if (o.owner && o.owner.isPlayer && w.cityAt(x, y)) J.Veh.crime(0.8, x, y);
    J.scare(x, y, 25);
  }
  function updFires(dt) {
    const g = G();
    const F = N.FIRES;
    if (!F.length) return;
    const w = g.world;
    let lightDone = false;
    const ts = g.timestop;
    for (let i = F.length - 1; i >= 0; i--) {
      const f = F[i];
      if (ts) continue;
      f.t += dt;
      if (f.t >= f.life) {
        if (pwOk()) J.Pw.decal('scorch', f.x, f.y, f.r * 1.7, 25);
        F.splice(i, 1);
        continue;
      }
      const k = Math.min(1, f.t / 0.4) * Math.min(1, (f.life - f.t) / 2);
      const r = f.r * (0.5 + 0.5 * k);
      const h0 = gy(f.x, f.y);
      // пламя и дым
      if (pwOk() && near(f.x, f.y, 70)) {
        if (rnd() < 0.9) J.Pw.fire(f.x, h0 + 0.05, f.y, Math.max(1, Math.round(r * 1.6)), r * 0.75, 1.9, 0.5 + r * 0.12);
        if (rnd() < dt * 3) J.Pw.smoke(f.x, h0 + 1.2, f.y, 1, '#2a2624', 0.8, 2.4, 1.2, r * 0.4, 0.45);
        if (!lightDone && (f.lt -= dt) <= 0 && near(f.x, f.y, 30)) {
          f.lt = 0.35;
          lightDone = true;
          J.Pw.light(f.x, h0 + 1.0, f.y, '#ff8a2a', 2.2 * k + 0.6, 10, 0.4);
        }
      }
      // треск рядом
      if (near(f.x, f.y, 16) && rnd() < dt * 2.5) Gn.snd('crackle', f.x, f.y, { k: 0.9 });
      // ожоги
      f.dmgT -= dt;
      if (f.dmgT <= 0) {
        f.dmgT = 0.4;
        for (const e of g.ents) {
          if (e.dead || e.airborne || (e.z || 0) > 0.6) continue;
          if (Math.abs(e.x - f.x) > r + 0.5 || Math.abs(e.y - f.y) > r + 0.5) continue;
          if (J.dist(e.x, e.y, f.x, f.y) > r + e.r) continue;
          if (e.kind === 'civ') {
            if (e.ai) {
              e.ai.fear = 8;
              e.ai.fx = f.x;
              e.ai.fy = f.y;
            }
            continue;
          }
          J.hurt(e, 5, f.own && !f.own.dead ? f.own : null, { dot: true, kind: 'fire', fx: { burn: 3.5 } });
          if (e.st) e.st.burn = Math.max(e.st.burn || 0, 3.5);
        }
        // машины в огне загораются
        if (g.vehs && J.Pw) for (const v of g.vehs) if (v.hp > 0 && !v.fire && J.Pw.vehAt(f.x, f.y, r * 0.8) === v) J.Pw.hitVeh(v, 14, f.own, true, 0);
      }
      // огонь растекается по траве
      f.sprT -= dt;
      if (f.sprT <= 0) {
        f.sprT = 0.9 + rnd() * 0.8;
        if (f.gen < 4 && f.t > 1.5 && F.length < 30) {
          const a = rnd() * TAU, d = 1.3 + rnd() * 1.1;
          const nx = f.x + Math.cos(a) * d, ny = f.y + Math.sin(a) * d;
          if (FLAM[w.tile(nx, ny)] && !N.fireAt(nx, ny, 1.0) && rnd() < 0.55) N.addFire(nx, ny, 1.0 + rnd() * 0.5, 6 + rnd() * 5, f.own, f.gen + 1);
        }
      }
    }
  }
  N.fireAt = function (x, y, pad) {
    for (const f of N.FIRES) if (J.dist(x, y, f.x, f.y) < f.r + (pad || 0)) return f;
    return null;
  };

  // ---------- Светошумовая ----------
  function flash(o) {
    const g = G();
    const x = o.x, y = o.y, h = gy(x, y) + 0.3;
    if (pwOk()) {
      J.Pw.light(x, h + 0.8, y, '#ffffff', 9, 22, 0.35);
      J.Pw.glow(x, h, y, 26, '#ffffff', 6, 0.14, 0.35, 0);
      J.Pw.smoke(x, h, y, 6, '#c8c8c8', 0.6, 1.6, 0.8, 0.5, 0.5);
    }
    if (R3.flash) R3.flash(x, y, 4, '#ffffff', 0.25, 1);
    Gn.snd('flashbang', x, y, { k: 1.4, prio: true });
    for (const e of g.ents) {
      if (e.dead || e.isPlayer) continue;
      const d = J.dist(x, y, e.x, e.y);
      if (d > 13) continue;
      if (!N.los(x, h + 0.3, y, e.x, gy(e.x, e.y) + 1.6, e.y)) continue;
      const k = 1 - d / 14;
      if (e.kind === 'civ') {
        e.downT = Math.max(e.downT || 0, 2 * k);
        if (e.ai) e.ai.fear = 9;
        continue;
      }
      const t = (e.boss ? 1.2 : 4) * k;
      e.st.stun = Math.max(e.st.stun || 0, t);
      e.blindT = t + 1.5;
      if (e.ai) e.ai.blind = t + 1.5;
      if (near(e.x, e.y, 30)) J.R3.text(e.x, e.y, J.R.pick(['Ааа! Глаза!', 'Ничего не вижу!', '?!']), 'tsay', 1.2);
    }
    // игрок: смотрит на вспышку — ослеплён сильнее
    const p = g.player;
    if (p && !p.dead) {
      const d = J.dist(x, y, p.x, p.y);
      if (d < 18 && N.los(x, h + 0.3, y, p.x, gy(p.x, p.y) + 1.6, p.y)) {
        const cam = R3.camera;
        const v = new THREE.Vector3();
        cam.getWorldDirection(v);
        const ex = x - cam.position.x, eh = h - cam.position.y, ez = y - cam.position.z;
        const L = Math.hypot(ex, eh, ez) || 1;
        const look = (ex * v.x + eh * v.y + ez * v.z) / L;
        const k = (1 - d / 18) * (look > 0.5 ? 1 : 0.35);
        N.blind(k);
      }
    }
    if (o.owner && o.owner.isPlayer && g.world.cityAt(x, y)) J.Veh.crime(0.4, x, y);
    J.scare(x, y, 30);
  }
  // белая пелена и звон в ушах
  let BL = null;
  N.blind = function (k) {
    if (k <= 0.05) return;
    if (!BL) {
      BL = document.createElement('div');
      BL.id = 'blindfx';
      document.getElementById('hud').appendChild(BL);
    }
    const t = 0.8 + 4 * k;
    N.blindT = Math.max(N.blindT || 0, t);
    N.blindMax = Math.max(N.blindT, N.blindMax || 0);
    BL.style.opacity = Math.min(1, 0.4 + k);
    Gn.snd('ring', R3.cam.tx, R3.cam.tz, { k: 1.5 * k + 0.4, dur: t });
    if (J.Sfx && J.Sfx.setSlow) J.Sfx.setSlow(0.9);
  };
  function updBlind(rdt) {
    if (!BL || !(N.blindT > 0)) return;
    N.blindT -= rdt;
    const k = Math.max(0, N.blindT / Math.max(0.5, N.blindMax));
    BL.style.opacity = N.blindT > 0 ? Math.min(1, k * 1.4).toFixed(3) : '0';
    if (N.blindT <= 0) {
      N.blindMax = 0;
      if (J.Sfx && J.Sfx.setSlow) J.Sfx.setSlow(0);
    }
  }

  // ---------- Дымовая шашка ----------
  function smoke(o) {
    N.SMOKES.push({ x: o.x, y: o.y, t: 0, life: 16, r: 0.5, own: o.owner, emT: 0 });
    Gn.snd('hiss', o.x, o.y, { k: 1.2, dur: 2.5 });
    // первый клуб — сразу
    if (pwOk() && near(o.x, o.y, 80)) J.Pw.smoke(o.x, gy(o.x, o.y) + 0.6, o.y, 18, '#cfd2d6', 1.6, 4, 0.8, 1.6, 0.95);
  }
  function updSmokes(dt) {
    const S = N.SMOKES;
    for (let i = S.length - 1; i >= 0; i--) {
      const s = S[i];
      s.t += dt;
      if (s.t > s.life) {
        S.splice(i, 1);
        continue;
      }
      const k = Math.min(1, s.t / 2.5);
      const fade = Math.min(1, (s.life - s.t) / 3);
      s.r = 0.6 + 4.2 * k;
      s.dense = k * fade;
      if (pwOk() && near(s.x, s.y, 80)) {
        s.emT -= dt;
        if (s.emT <= 0) {
          s.emT = 0.05;
          const h0 = gy(s.x, s.y);
          // шашка шипит и густо дымит; облако расползается (плотнее к центру)
          if (s.t < s.life - 3) J.Pw.smoke(s.x, h0 + 0.15, s.y, 2, '#e4e6e8', 0.45, 1.4, 1.8, 0.08, 0.85);
          for (let k = 0; k < 3; k++) {
            const a = rnd() * TAU, r = Math.sqrt(rnd()) * s.r * 0.85;
            J.Pw.smoke(s.x + Math.cos(a) * r, h0 + 0.2 + rnd() * 2.2, s.y + Math.sin(a) * r, 1, rnd() < 0.5 ? '#e0e2e5' : '#cdd0d4', 2.2 + rnd() * 1.1, 5, 0.08, 0.7, fade);
          }
        }
      }
    }
  }
  // точка внутри дыма
  N.inSmoke = function (x, y) {
    for (const s of N.SMOKES) if (s.dense > 0.35 && Math.abs(x - s.x) < s.r && Math.abs(y - s.y) < s.r && J.dist(x, y, s.x, s.y) < s.r * 0.85) return true;
    return false;
  };
  // дым между точками
  N.smokeBetween = function (ax, az, bx, bz) {
    if (!N.SMOKES.length) return false;
    for (const s of N.SMOKES) {
      if (s.dense < 0.35) continue;
      const dx = bx - ax, dz = bz - az;
      const L2 = dx * dx + dz * dz || 1;
      const t = J.clamp(((s.x - ax) * dx + (s.y - az) * dz) / L2, 0, 1);
      const qx = ax + dx * t, qz = az + dz * t;
      if (J.dist(qx, qz, s.x, s.y) < s.r * 0.8) return true;
    }
    return false;
  };
  Gn.inSmoke = N.inSmoke;

  // ---------- Детонация ----------
  Gn.detonate = function (o) {
    if (o.done) return;
    o.done = true;
    if (o.nade === 'frag') frag(o);
    else if (o.nade === 'fire') molotov(o);
    else if (o.nade === 'flash') flash(o);
    else if (o.nade === 'smoke') smoke(o);
  };
  // горящая тряпка молотова в руке; шипение запала у брошенной гранаты
  function heldFx(dt) {
    const g = G();
    for (const e of g.ents) {
      if (e.dead || e.hand !== 'molotov' && !(e.isPlayer && H.heldId(e) === 'molotov')) continue;
      const v = e.view;
      if (!v || !v.heldMesh || !v.group.visible || !pwOk() || rnd() > 0.7) continue;
      v.heldMesh.updateWorldMatrix(true, false);
      const P = new THREE.Vector3(0, 0, 0.23).applyMatrix4(v.heldMesh.matrixWorld);
      J.Pw.fire(P.x, P.y, P.z, 1, 0.02, 0.9, 0.12);
    }
    for (const o of H.FLY) {
      if (!o.nade || !pwOk() || !near(o.x, o.y, 50)) continue;
      if (o.nade === 'fire' && rnd() < 0.8) J.Pw.fire(o.x, o.h + 0.1, o.y, 1, 0.03, 0.6, 0.18);
      else if (o.nade === 'smoke' && o.rest && rnd() < 0.3) J.Pw.smoke(o.x, o.h + 0.1, o.y, 1, '#d8d8d8', 0.15, 0.6, 0.6, 0.02, 0.5);
    }
  }
  N.update = function (dt, rdt) {
    updFires(dt);
    updSmokes(dt);
    heldFx(dt);
    updBlind(rdt === undefined ? dt : rdt);
  };
  N.reset = function () {
    N.FIRES.length = 0;
    N.SMOKES.length = 0;
    N.blindT = 0;
    if (BL) BL.style.opacity = '0';
  };
})();
