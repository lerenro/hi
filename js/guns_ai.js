'use strict';
// Стрелки: банды, охрана и полиция с оружием по типу и уровню розыска; ищут укрытие (стена между собой и целью),
// выглядывают и бьют очередями, перезаряжаются за укрытием, держат дистанцию по оружию, бросают гранаты,
// теряют цель в дыму и после вспышки. При розыске ★★ и выше подходят пешие патрули (★★★ — спецназ с автоматами).
(function () {
  const H = J.Hand;
  const Gn = J.Guns;
  const N = J.Nades;
  const G = () => J.G;
  const rnd = Math.random;
  const TAU = Math.PI * 2;
  const gy = (x, y) => G().world.groundY(x, y);
  const pickW = (list) => {
    let s = 0;
    for (const [, w] of list) s += w;
    let r = rnd() * s;
    for (const [id, w] of list) if ((r -= w) <= 0) return id;
    return list[0][0];
  };

  // ---------- Оружие у врагов ----------
  const LOAD = {
    gangster: [['pistol', 40], ['micro_smg', 22], ['revolver', 15], ['smg', 10], ['sawnoff', 8], ['assault_rifle', 5]],
    guard: [['pistol', 45], ['pump_shotgun', 22], ['smg', 18], ['carbine', 10], ['revolver', 5]],
    bandit: [['revolver', 35], ['sawnoff', 18], ['pump_shotgun', 14], ['assault_rifle', 14], ['pistol', 12], ['sniper', 7]],
  };
  const THUG_W = ['bat', 'pipe', 'kitchen_knife', 'bottle', 'bottle', 'brick', 'switchblade', 'crowbar', 'machete', 'knuckles', 'golf_club'];
  const COP = [
    [['pistol', 80], ['pump_shotgun', 20]],
    [['pistol', 40], ['smg', 30], ['pump_shotgun', 30]],
    [['carbine', 45], ['assault_rifle', 20], ['smg', 20], ['pump_shotgun', 15]],
  ];
  H.arm = function (e) {
    if (!e || e.isPlayer || e.hand !== undefined) return;
    e.hand = null;
    if (e.model) return;
    const t = e.mobType;
    if (t === 'thug') {
      if (rnd() < 0.08) e.hand = 'pistol';
      else if (rnd() < 0.62) {
        e.hand = J.R.pick(THUG_W);
        if (e.hand === 'knuckles') e.hand = 'bat';
      }
      if (rnd() < 0.08) e.nades = 'molotov';
    } else if (LOAD[t]) {
      e.hand = pickW(LOAD[t]);
      if (rnd() < (t === 'guard' ? 0.06 : 0.14)) e.nades = rnd() < 0.6 ? 'grenade' : 'molotov';
    } else if (e.gun) e.hand = 'revolver';
    if (e.hand && H.def(e.hand) && H.def(e.hand).cls === 'gun') e.mag = H.def(e.hand).mag;
  };
  // полиция: оружие по звёздам розыска
  function armCop(e, stars) {
    const s = J.clamp(Math.floor(stars || 1), 1, 3);
    e.hand = pickW(COP[s - 1]);
    e.mag = H.def(e.hand).mag;
    e._copArmed = s;
    if (s >= 3) {
      e.name = 'Спецназ';
      e.armor = Math.max(e.armor || 0, 0.25);
      e.look = Object.assign({}, e.look || {}, { top: '#1e2228', bottom: '#1e2228', hair: 'cap', hairColor: '#111' });
      if (e.view && J.R3.dropView) J.R3.dropView(e);
      if (rnd() < 0.3) e.nades = 'flashbang';
    }
  }

  // ---------- Видимость ----------
  const eye = (e) => gy(e.x, e.y) + (e.z || 0) + 1.5 * (e.scale || 1);
  function canSee(e, tg) {
    const ai = e.ai;
    const g = G();
    if (ai.losT > g.t) return ai.los;
    ai.losT = g.t + 0.2 + rnd() * 0.1;
    let ok = N.los(e.x, eye(e), e.y, tg.x, gy(tg.x, tg.y) + 1.2, tg.y);
    if (ok && N.smokeBetween(e.x, e.y, tg.x, tg.y)) ok = false;
    if (ok && tg.isPlayer && N.inSmoke(tg.x, tg.y) && J.dist(e.x, e.y, tg.x, tg.y) > 3) ok = false;
    ai.los = ok;
    if (ok) {
      ai.seenT = g.t;
      ai.lastX = tg.x;
      ai.lastY = tg.y;
    }
    return ok;
  }

  // ---------- Укрытие ----------
  // точка у стены, закрытая от цели; ближе к себе, на нужной дистанции
  function findCover(e, tg, want) {
    const w = G().world;
    let best = null, bs = -1e9;
    for (let k = 0; k < 18; k++) {
      const a = rnd() * TAU, r = 1.5 + rnd() * 8;
      const x = e.x + Math.cos(a) * r, y = e.y + Math.sin(a) * r;
      if (J.blocked(x, y, 0.3, {}) || w.isWater(x, y)) continue;
      const ta = Math.atan2(tg.y - y, tg.x - x);
      // стена в сторону цели
      const cx = x + Math.cos(ta) * 0.9, cy = y + Math.sin(ta) * 0.9;
      if (Gn.topAt(cx, cy) < gy(x, y) + 1.3) continue;
      const dt = J.dist(x, y, tg.x, tg.y);
      if (dt < 4) continue;
      const sc = -J.dist(x, y, e.x, e.y) * 1.2 - Math.abs(dt - want) * 0.6 + (dt > want * 1.6 ? -6 : 0);
      if (sc > bs) {
        bs = sc;
        best = { x, y, a: ta };
      }
    }
    return best;
  }
  // точка выглядывания: шаг в сторону от укрытия, откуда видно цель
  function peekPoint(e, tg, c) {
    for (const s of [1, -1]) {
      const a = c.a + (s * Math.PI) / 2;
      const x = c.x + Math.cos(a) * 1.1, y = c.y + Math.sin(a) * 1.1;
      if (J.blocked(x, y, 0.3, {})) continue;
      if (N.los(x, gy(x, y) + 1.5, y, tg.x, gy(tg.x, tg.y) + 1.2, tg.y)) return { x, y };
    }
    return null;
  }

  // ---------- Бой стрелка ----------
  const PREF = { pistol: 9, smg: 8, rifle: 14, shotgun: 5, sniper: 26, heavy: 13 };
  function gunner(e) {
    if (e.isPlayer || e.boss || e.model || e.summon) return null;
    if (e.standUser && e.stand) return null;
    const d = H.held(e);
    return d && d.cls === 'gun' ? d : null;
  }
  Gn.gunner = gunner;
  function aiGun(e, tg, dist, ang, dt, d) {
    const g = G();
    const ai = e.ai;
    const spd = e.speed * J.speedMul(e);
    if (!(ai.rec > 0)) ai.rec = 0;
    else ai.rec -= dt;
    if (e.atk && !e.atk.done) {
      e.face = ang;
      e.vx = e.vy = 0;
      return true;
    }
    if (e.bstun > 0) {
      e.vx = e.vy = 0;
      return true;
    }
    // ослеплён вспышкой — бредёт наугад
    if (ai.blind > 0) {
      ai.blind -= dt;
      if (rnd() < dt * 2) ai.wa = rnd() * TAU;
      J.steer(e, e.x + Math.cos(ai.wa || 0) * 2, e.y + Math.sin(ai.wa || 0) * 2, spd * 0.3, dt);
      return true;
    }
    const want = PREF[d.cat] || 9;
    const see = canSee(e, tg);
    // вплотную — удар прикладом/рукоятью
    if (dist < 1.9 && see) {
      if (!(ai.atk > 0) && ai.rec <= 0 && e.canAct()) {
        e.face = ang;
        if (H.melee(e)) {
          ai.rec = 0.9;
          ai.atk = 1.2;
        }
      } else ai.atk -= dt;
      J.steer(e, e.x - Math.cos(ang) * 2, e.y - Math.sin(ang) * 2, spd * 0.6, dt);
      e.face = ang;
      return true;
    }
    // граната в цель, что засела за укрытием
    ai.nadeT = (ai.nadeT === undefined ? 2 + rnd() * 3 : ai.nadeT) - dt;
    if (e.nades && ai.nadeT <= 0 && dist > 5 && dist < 16 && e.canAct() && !e.reloadT) {
      ai.nadeT = 6 + rnd() * 6;
      if (!see || rnd() < 0.4) {
        const gun = e.hand, mag = e.mag;
        e.hand = e.nades;
        e.nades = null;
        e.face = ang;
        const o = H.throwFrom(e, 0.85);
        e.hand = gun;
        e.mag = mag;
        if (o && near(e.x, e.y, 30)) J.R3.text(e.x, e.y, o.nade === 'flash' ? 'Вспышка!' : 'Граната!', 'tsay', 1.1);
        ai.rec = 0.6;
        return true;
      }
    }
    // укрытие: ищем раз в 2–3 с или когда старое потеряно
    ai.coverT = (ai.coverT || 0) - dt;
    if (ai.coverT <= 0) {
      ai.coverT = 2.2 + rnd() * 1.6;
      const c = ai.cover;
      const stillOk = c && Gn.topAt(c.x + Math.cos(Math.atan2(tg.y - c.y, tg.x - c.x)) * 0.9, c.y + Math.sin(Math.atan2(tg.y - c.y, tg.x - c.x)) * 0.9) > gy(c.x, c.y) + 1.3;
      if (!stillOk) ai.cover = d.cat === 'shotgun' && rnd() < 0.6 ? null : findCover(e, tg, want);
      if (ai.cover) ai.cover.a = Math.atan2(tg.y - ai.cover.y, tg.x - ai.cover.x);
    }
    const cov = ai.cover;
    let mx, my, mspd = spd, aim = see;
    if (e.reloadT > 0) {
      // перезарядка — за укрытием или пятясь
      if (cov) {
        mx = cov.x;
        my = cov.y;
      } else {
        mx = e.x - Math.cos(ang) * 2 - Math.sin(ang) * (ai.orb || 1);
        my = e.y - Math.sin(ang) * 2 + Math.cos(ang) * (ai.orb || 1);
        mspd = spd * 0.6;
      }
      aim = false;
    } else if (cov) {
      const atC = J.dist(e.x, e.y, cov.x, cov.y) < 0.6;
      ai.phT = (ai.phT || 0) - dt;
      if (!atC && !ai.peek) {
        // бежим к укрытию; на бегу стреляют только автоматы
        mx = cov.x;
        my = cov.y;
        aim = see && d.auto && dist < want * 1.5;
      } else {
        if (ai.phT <= 0) {
          // спрятался ↔ выглянул
          ai.peek = !ai.peek;
          ai.phT = ai.peek ? 1.2 + rnd() * 1.4 : 0.7 + rnd() * 1.0;
          ai.pp = ai.peek ? peekPoint(e, tg, cov) : null;
          if (ai.peek && !ai.pp) {
            // отсюда не видно — менять укрытие
            ai.peek = false;
            ai.coverT = 0;
            ai.cover = null;
          }
        }
        if (ai.peek && ai.pp) {
          mx = ai.pp.x;
          my = ai.pp.y;
          mspd = spd * 0.7;
          aim = see;
        } else {
          mx = cov.x;
          my = cov.y;
          aim = false;
          ai.hideT = 0.3;
        }
      }
    } else {
      // открытое место: держим свою дистанцию и кружим
      ai.orb = ai.orb || (rnd() < 0.5 ? 1 : -1);
      if (rnd() < dt * 0.25) ai.orb *= -1;
      if (dist > want + 3 || !see) {
        const lx = see ? tg.x : ai.lastX !== undefined ? ai.lastX : tg.x, ly = see ? tg.y : ai.lastY !== undefined ? ai.lastY : tg.y;
        mx = lx;
        my = ly;
      } else if (dist < want - 2.5) {
        mx = e.x - Math.cos(ang) * 3 - Math.sin(ang) * ai.orb;
        my = e.y - Math.sin(ang) * 3 + Math.cos(ang) * ai.orb;
        mspd = spd * 0.8;
      } else {
        mx = e.x - Math.sin(ang) * ai.orb * 2;
        my = e.y + Math.cos(ang) * ai.orb * 2;
        mspd = spd * 0.45;
      }
    }
    if (ai.hideT > 0) ai.hideT -= dt;
    // стреляя, идут медленнее
    if (aim && (e.aimT > 0 || ai.burst > 0)) mspd *= 0.55;
    if (mx !== undefined && J.dist(e.x, e.y, mx, my) > 0.25) J.steer(e, mx, my, mspd, dt);
    else e.vx = e.vy = 0;
    // огонь
    if (aim) e.face = ang;
    ai.shot = (ai.shot || 0) - dt;
    if (!aim) {
      ai.react = Math.max(ai.react || 0, 0.35 + rnd() * 0.35);
      ai.burst = 0;
      return true;
    }
    if (ai.react > 0) {
      // заметил цель — миг на прицеливание (видно по вскинутому оружию)
      ai.react -= dt;
      e.aimT = 0.6;
      return true;
    }
    const maxR = d.cat === 'shotgun' ? 14 : d.cat === 'sniper' ? 70 : d.range * 0.9;
    if (dist > maxR || ai.shot > 0 || !e.canAct() || e.reloadT > 0) return true;
    if (d.cat === 'sniper' && !(ai.sniperAim > 0.9)) {
      // снайпер: долго целится, лазерный блик выдаёт его
      ai.sniperAim = (ai.sniperAim || 0) + dt;
      e.aimT = 0.5;
      if (J.Pw && J.Pw.ready && rnd() < 0.5) {
        const mz = Gn.muzzle(e, d);
        J.Pw.glow(mz.x, mz.h + 0.08, mz.z, 1, '#ff3a3a', 0.2, 0.12, 0.15, 0);
      }
      return true;
    }
    ai.sniperAim = 0;
    if (Gn.fire(e)) {
      if (d.auto) {
        ai.burst = ai.burst > 0 ? ai.burst - 1 : 2 + Math.floor(rnd() * 5);
        ai.burstN = (ai.burstN || 0) + 1;
        ai.shot = ai.burst > 0 ? d.rate : 0.5 + rnd() * 0.9;
        if (ai.burst <= 0) ai.burstN = 0;
      } else ai.shot = d.rate + (d.cat === 'shotgun' ? 0.3 : 0.25) + rnd() * 0.6;
    } else ai.shot = 0.2;
    return true;
  }
  const near = (x, y, r) => {
    const p = G().player;
    return !!p && J.dist(x, y, p.x, p.y) < r;
  };
  // перехват боя ИИ: стрелки воюют по-своему
  const fight0 = J.Cb.fight;
  J.Cb.fight = function (e, tg, d, ang, dt) {
    const gd = gunner(e);
    if (gd) return aiGun(e, tg, d, ang, dt, gd);
    return fight0.apply(this, arguments);
  };
  // старый путь «пуля-снаряд» стрелков больше не нужен — стреляют лучом
  const strike0 = J.Cb.aiStrike;
  J.Cb.aiStrike = function (e, tg, heavy) {
    if (gunner(e)) {
      e.ai.target = tg;
      if (H.melee(e, heavy ? 0.5 : undefined)) {
        e.ai.rec = 0.8;
        return;
      }
    }
    return strike0.apply(this, arguments);
  };

  // ---------- Полиция ----------
  let footT = 0;
  Gn.updateAI = function (dt) {
    const g = G();
    const p = g.player;
    if (!p) return;
    const stars = Math.floor(p.wanted || 0);
    for (const e of g.ents) {
      if (e.dead) continue;
      if (e.cop && e._copArmed !== Math.max(1, stars) && (!e._copArmed || stars > e._copArmed)) armCop(e, Math.max(1, stars));
      // игрок в дыму — цель теряется
      if (e.ai && e.ai.target === p && !e.boss && N.inSmoke(p.x, p.y) && J.dist(e.x, e.y, p.x, p.y) > 3 && rnd() < dt * 0.8) {
        e.ai.target = null;
        e.ai.lostT = 2;
      }
    }
    // пешие патрули при ★★ и выше
    footT -= dt;
    if (stars >= 2 && footT <= 0 && !p.dead && g.world.cityAt(p.x, p.y)) {
      footT = stars >= 3 ? 4 : 6.5;
      let n = 0;
      for (const e of g.ents) if (e.cop && !e.dead) n++;
      if (n < (stars >= 3 ? 6 : 3)) spawnCop(p, stars);
    }
  };
  function spawnCop(p, stars) {
    const w = G().world;
    const c = J.R3.cam;
    for (let k = 0; k < 20; k++) {
      // вне поля зрения, на улице
      const a = c.yaw + Math.PI + (rnd() - 0.5) * 2.4, r = 24 + rnd() * 12;
      const x = p.x + Math.cos(a) * r, y = p.y + Math.sin(a) * r;
      if (J.blocked(x, y, 0.35, {}) || w.isWater(x, y) || !w.cityAt(x, y)) continue;
      const e = J.makeMob('guard', x, y, Math.max(1, Math.round((p.lvl || 1) * 0.8)));
      e.name = 'Полицейский';
      e.cop = true;
      e.look = Object.assign({}, e.look, { top: '#2a3a5a', bottom: '#1e2a40', hair: 'cap', hairColor: '#1a1a22' });
      armCop(e, stars);
      e.ai.aggro = 40;
      e.ai.leash = 90;
      e.ai.target = p;
      J.addEnt(e);
      return e;
    }
    return null;
  }
  Gn.spawnCop = spawnCop;
})();
