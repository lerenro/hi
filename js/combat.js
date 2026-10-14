'use strict';
// Боевая механика: блок, парирование, уклонение с неуязвимостью, реакции на удары, подброс и удары о стены,
// серия из трёх ударов с добиванием, заряженный тяжёлый удар, раш с удержанием и столкновение рашей,
// ИИ противников (дистанция, обход, блок, наказание промахов) и фирменные приёмы боссов.
(function () {
  const Cb = (J.Cb = {});
  const G = () => J.G;
  const rnd = Math.random;
  const Fx = () => J.Fx;
  const fxOk = () => J.Fx && J.Fx.ready;
  const PARRY_WIN = 0.16; // окно парирования после нажатия блока
  const GRAV = 22;
  Cb.PARRY_WIN = PARRY_WIN;

  // ---------- Помощники ----------
  const standOn = (u) => !!(u && u.stand && u.standOut && !(u.st.silence > 0));
  Cb.standOn = standOn;
  Cb.standReach = (u) => (standOn(u) ? 0.95 + J.rankNum(J.STANDS[u.stand.id].st.rng) * 0.22 : 0);
  const DOWNS = { launch: 1, air: 1, down: 1, getup: 1, slump: 1, death: 1, dead: 1 };
  Cb.isDown = (e) => !!(e.react && DOWNS[e.react.type]) || !!e.airborne;
  const setReact = (e, type, max, amp) => {
    const r = e.react || (e.react = { type: '', t: 0, max: 0, amp: 1 });
    r.type = type;
    r.t = 0;
    r.max = max;
    r.amp = amp || 1;
    return r;
  };
  Cb.setReact = setReact;
  const engaged = (e, s) => {
    e.inCombat = Math.max(e.inCombat || 0, s || 4);
  };

  // ---------- Блок ----------
  Cb.setGuard = function (e, on) {
    if (!on) {
      if (e.guard) e.guardOff = G().t;
      e.guard = false;
      return;
    }
    if (e.guard) return;
    if (!e.canAct() || e.channel || e.dash || e.airborne || Cb.isDown(e) || (e.atk && !e.atk.done) || e.chg) return;
    if (e.gm === undefined) e.gm = 100;
    if (e.gm < 10) return;
    e.guard = true;
    // окно парирования только у «честного» нажатия: дёргать блок без перерыва бесполезно
    e.guardAt = G().t - (e.guardOff || -9) < 0.35 ? G().t - 1 : G().t;
    engaged(e, 2);
  };
  const guardBreak = (t, src) => {
    t.guard = false;
    t.gm = 0;
    t.gRegT = 1.8;
    t.st.stun = Math.max(t.st.stun || 0, 1.5);
    setReact(t, 'gbreak', 1.5);
    if (t.atk && !t.atk.done) Cb.cancelAtk(t);
    if (fxOk()) Fx().onHit(t, src, 0, {}, false, false, 'gbreak');
    if (t.isPlayer) J.UI.toast('Блок пробит!', 'red');
  };

  // До урона: блок, парирование. Возвращает новый урон; -1 — удар полностью отражён
  // Два раша лицом к лицу: кулаки сталкиваются, урона нет — дальше решает столкновение (Cb.update)
  const facing = (a, b, tol) => {
    const ab = Math.atan2(b.y - a.y, b.x - a.x);
    return Math.abs(J.angDiff(a.face, ab)) < tol && Math.abs(J.angDiff(b.face, ab + Math.PI)) < tol;
  };
  const rushing = (e) => !!(e && e.channel && e.channel.type === 'rush' && !(e.channel.fin > 0));
  // Боссы бьют игрока слабее (у них в 3 раза больше здоровья) — бой длинный, но проходимый
  Cb.BOSS_VS_PLAYER = 0.45;
  Cb.preHurt = function (t, amount, src, opt) {
    if (opt.rushTick && src && rushing(t) && rushing(src) && facing(t, src, 0.6)) return -1;
    if (opt.dot || opt.pierceDef || opt.unblockable || !src) return amount;
    if (!t.guard || !t.canAct()) return amount;
    const so = J.ownerOf(src);
    const sx = src.x !== undefined ? src.x : so.x, sy = src.y !== undefined ? src.y : so.y;
    const ang = opt.ang !== undefined ? opt.ang : Math.atan2(t.y - sy, t.x - sx);
    // только удары спереди (±100°)
    if (Math.abs(J.angDiff(t.face, ang + Math.PI)) > 1.75) return amount;
    const g = G();
    // парирование: блок нажат прямо перед ударом ближнего боя
    if (opt.melee && !opt.rushTick && g.t - (t.guardAt || -9) < PARRY_WIN && so && so !== t) {
      t.gm = Math.min(100, (t.gm || 0) + 25);
      t.st.counter = 0.8;
      so.st.stun = Math.max(so.st.stun || 0, so.boss ? 0.6 : 0.95);
      setReact(so, 'parried', so.boss ? 0.6 : 0.95);
      Cb.cancelAtk(so);
      if (so.channel) so.channel = null;
      so.kx += Math.cos(ang) * 2.5;
      so.ky += Math.sin(ang) * 2.5;
      engaged(t);
      if (fxOk()) Fx().onHit(t, src, 0, opt, false, false, 'parry');
      if (t.isPlayer) J.P.trainStat(t, 'agi', 1);
      return -1;
    }
    // обычный блок: урон по шкале блока, царапина по здоровью
    let gd = opt.gdmg !== undefined ? opt.gdmg : opt.melee ? 6 + amount * 0.9 : amount * 0.6;
    if (t.boss) gd *= 0.55;
    t.gm = (t.gm === undefined ? 100 : t.gm) - gd;
    t.gRegT = 0.9;
    const push = Math.min(3.5, (opt.knock || 0) * 0.35 + (opt.rushTick ? 0.25 : 1.2));
    t.kx += Math.cos(ang) * push;
    t.ky += Math.sin(ang) * push;
    engaged(t);
    if (so) engaged(so);
    t.bstun = Math.max(t.bstun || 0, opt.rushTick ? 0.12 : 0.2);
    if (t.gm <= 0) {
      guardBreak(t, src);
      return amount * 0.5;
    }
    setReact(t, 'block', 0.18);
    if (fxOk() && !opt.rushTick) Fx().onHit(t, src, 0, opt, false, false, 'block');
    else if (fxOk() && rnd() < 0.3) Fx().sparks(t.x - Math.cos(ang) * 0.4, J.G.world.groundY(t.x, t.y) + 1.3, t.y - Math.sin(ang) * 0.4, 4, ang + Math.PI, '#bfe6ff', 5);
    const k = opt.kind === 'hamon' || opt.kind === 'fire' ? 0.35 : 0.15;
    return amount * k;
  };

  // Идеальное уклонение (удар пришёлся на неуязвимость рывка)
  Cb.perfectDodge = function (t, so) {
    if (!t.dash || t.dash.pd) return;
    t.dash.pd = true;
    t.st.counter = 0.9;
    if (fxOk()) Fx().perfectDodge(t);
    if (so && so.ai && so.bossKey === 'dio') Fx().taunt(so, 'dash');
  };

  // После урона: реакция, отбрасывание, оглушение, подброс
  Cb.postHurt = function (t, dmg, so, src, opt, crit, blocked) {
    const g = G();
    engaged(t);
    if (so && so !== t) {
      engaged(so);
      t.lastHitBy = so;
    }
    const killed = t.hp <= 0;
    if (opt.rushTick) {
      t.rushHitT = g.t;
      t.rushHitBy = so;
      // стенд-юзер ИИ может ответить встречным рашем (один шанс на чужой раш)
      if (!killed && t.ai && !t.ai.civ && t.stand && so && rushing(so) && t._crCh !== so.channel) {
        t._crCh = so.channel;
        const ra = ab(t, 'rush');
        if (ra && !(t.cds[ra.name] > 0) && !(t.st.silence > 0) && rnd() < (t.boss ? 0.6 : 0.3) && Cb.counterRush(t)) {
          t.standOut = true;
          J.Abil.use(t, ra, J.Abil.aimAt(t, so));
          t.cds[ra.name] = ra.cd || 6;
          return;
        }
      }
    }
    const ang = opt.ang !== undefined ? opt.ang : so ? Math.atan2(t.y - so.y, t.x - so.x) : rnd() * Math.PI * 2;
    if (blocked) {
      if (fxOk()) Fx().dmgNum(t, dmg, false, opt.rushTick);
      return;
    }
    const tier = fxOk() ? Fx().tierOf(t, dmg, opt, crit) : opt.knock >= 7 ? 'fin' : 'light';
    // масштаб оглушения в длинной серии
    const c = t.cmb || (t.cmb = { n: 0, t: -9 });
    if (g.t - c.t > 1.1) c.n = 0;
    c.n++;
    c.t = g.t;
    const sc = opt.rushTick ? 1 : Math.max(0.35, 1 - 0.11 * (c.n - 1));
    // замах ИИ после вспышки уже не сбить лёгким ударом — вспышку надо читать (блок, парирование, уклонение), а не долбить
    const committed = !!(t.ai && t.atk && !t.atk.done && t.atk.glinted && !opt.launch && !opt.rushTick && tier !== 'big' && tier !== 'fin');
    const armor = (t.boss || committed) && !killed && !opt.clashWin;
    const knock = opt.knock || 0;
    // отбрасывание
    if (knock && !armor) {
      t.kx += Math.cos(ang) * knock;
      t.ky += Math.sin(ang) * knock;
    } else if (knock && armor && (tier === 'big' || tier === 'fin')) {
      t.kx += Math.cos(ang) * knock * 0.25;
      t.ky += Math.sin(ang) * knock * 0.25;
    }
    if (opt.stun && !(t.react && (t.react.type === 'down' || t.react.type === 'slump'))) {
      const s = armor ? (tier === 'big' || tier === 'fin' ? opt.stun * 0.4 : 0) : opt.stun * sc;
      if (s > 0) t.st.stun = Math.max(t.st.stun || 0, s);
    }
    // удар во время замаха сбивает его
    if (t.atk && !t.atk.done && !(armor && tier !== 'big' && tier !== 'fin') && !t.atk.armor && (opt.stun || knock >= 1)) Cb.cancelAtk(t);
    if (t.chg && !armor) t.chg = null;
    if (t.guard && (opt.stun || knock >= 2)) t.guard = false;
    // реакция
    const air = t.airborne;
    if (killed) {
      if (knock >= 3 || tier === 'fin' || tier === 'big' || air) launch(t, ang, Math.max(knock, 6), true);
      else setReact(t, 'death', 0.7);
      return;
    }
    // лежачего добивают, но он остаётся лежать (без сброса в «вздрагивание»)
    if (t.react && (t.react.type === 'down' || t.react.type === 'slump') && !air) return;
    if (air && !opt.dot) {
      // жонглирование: каждый удар подбрасывает слабее
      const j = t.jug || 0;
      t.kz = Math.max(t.kz, (2.6 + knock * 0.2) * Math.max(0.2, 1 - 0.25 * j));
      t.jug = j + 1;
      t.airT = Math.min(t.airT || 0, 0.3);
      t.st.stun = Math.max(t.st.stun || 0, 0.5);
      return;
    }
    if (armor) {
      // суперброня: вздрагивает, но не прерывается
      if (tier === 'big' || tier === 'fin') setReact(t, 'stagger', 0.35);
      else if (tier !== 'tick') setReact(t, 'flinch', 0.22, 0.6);
      t.armorFlash = 0.15;
      return;
    }
    const launchIt = opt.launch || tier === 'fin' || (opt.finisher && (t.react && (t.react.type === 'stagger' || t.react.type === 'gbreak')));
    if (launchIt && !t.immortal) launch(t, ang, Math.max(knock, 7), false);
    else if (tier === 'big') {
      setReact(t, 'stagger', 0.5);
      t.st.stun = Math.max(t.st.stun || 0, 0.45 * sc);
      t.face = ang + Math.PI;
    } else if (tier === 'tick') {
      // под рашем: голову мотает от каждого кулака, жертву понемногу отжимает назад
      const r0 = t.react;
      const r = r0 && r0.type === 'pummel' ? r0 : setReact(t, 'pummel', 0.32);
      if (r !== r0) r.n = 0;
      r.t = 0;
      r.n++;
      t.face = ang + Math.PI;
    } else if (tier === 'mid') setReact(t, 'flinch', 0.3, 1.4);
    else setReact(t, 'flinch', 0.22);
    if (tier !== 'tick') t.face = ang + Math.PI;
  };

  // Подброс в воздух (отлёт назад с вращением)
  function launch(t, ang, knock, dead) {
    if (t.model && !dead && t.r > 0.45) knock *= 0.6; // медведь тяжёлый
    t.airborne = true;
    t.kz = 3.2 + knock * 0.35;
    t.airT = 0;
    t.airDur = (2 * t.kz) / GRAV;
    t.airSpin = -1.5708 - (knock >= 8 ? Math.PI * 2 : 0);
    t.bounce = 0;
    t.jug = 0;
    t.face = ang + Math.PI;
    t.kx = Math.cos(ang) * knock * 0.9;
    t.ky = Math.sin(ang) * knock * 0.9;
    t.guard = false;
    setReact(t, 'air', t.airDur);
    if (!dead) t.st.stun = Math.max(t.st.stun || 0, t.airDur + 1.2);
  }
  Cb.launch = launch;

  // ---------- Физика и таймеры сущности (вызывается в updateEnts) ----------
  Cb.tickEnt = function (e, dt) {
    if (e.inCombat > 0) e.inCombat -= dt;
    if (e.bstun > 0) e.bstun -= dt;
    if (e.armorFlash > 0) e.armorFlash -= dt;
    // шкала блока
    if (e.gm !== undefined && e.gm < 100) {
      if (e.gRegT > 0) e.gRegT -= dt;
      else e.gm = Math.min(100, e.gm + (e.guard ? 8 : 30) * dt);
    }
    if (e.guard && (!e.canAct() || e.channel || e.dash)) e.guard = false;
    Cb.physics(e, dt);
    if (e.atk) updateAtk(e, dt);
    if (e.chg) {
      e.chg.t += dt;
      if (!e.canAct() || e.dash || e.channel) e.chg = null;
      else if (e.chg.t > 1.4 && e.isPlayer) Cb.heavyRelease(e);
    }
  };
  // Реакции, полёт, скольжение от удара, удар о стену (и для трупов)
  Cb.physics = function (e, dt) {
    const r = e.react;
    if (r) {
      r.t += dt;
      if (r.t >= r.max) {
        const ty = r.type;
        if (ty === 'air' || ty === 'launch') {
          // ждём приземления
        } else if (ty === 'death') r.type = 'dead';
        else if (ty === 'dead') r.t = r.max;
        else if (ty === 'down') {
          if (e.dead) r.type = 'dead';
          else {
            setReact(e, 'getup', 0.45);
            e.st.gup = 0.6;
            if (e.ai) e.ai.wake = true;
          }
        } else if (ty === 'slump') {
          if (e.dead) setReact(e, 'dead', 99);
          else {
            setReact(e, 'getup', 0.45);
            e.st.gup = 0.6;
            if (e.ai) e.ai.wake = true;
          }
        } else e.react = null;
      }
    }
    if (e.airborne) {
      e.airT = (e.airT || 0) + dt;
      e.kz -= GRAV * dt;
      e.z = (e.z || 0) + e.kz * dt;
      if (e.z <= 0) {
        e.z = 0;
        if (e.kz < -5 && (e.bounce || 0) < 1) {
          e.bounce = (e.bounce || 0) + 1;
          e.kz *= -0.3;
          if (fxOk()) Fx().land(e, true);
        } else {
          e.airborne = false;
          e.kz = 0;
          e.jug = 0;
          if (e.dead) setReact(e, 'dead', 99);
          else {
            setReact(e, 'down', e.isPlayer ? 0.55 : 0.75);
            e.st.stun = Math.max(e.st.stun || 0, (e.isPlayer ? 0.55 : 0.75) + 0.45);
          }
          if (fxOk()) Fx().land(e, false);
        }
      }
    }
    // скольжение
    if (Math.abs(e.kx) + Math.abs(e.ky) > 0.05) {
      const sp = Math.hypot(e.kx, e.ky);
      const mx = e.kx * dt, my = e.ky * dt;
      const ox = e.x, oy = e.y;
      J.moveEnt(e, mx, my);
      if (sp > (e.airborne ? 3.5 : 5.5) && !e.slammed) {
        const bx = Math.abs(mx) > 0.02 && Math.abs(e.x - ox) < Math.abs(mx) * 0.3;
        const by = Math.abs(my) > 0.02 && Math.abs(e.y - oy) < Math.abs(my) * 0.3;
        if (bx || by) {
          // только о настоящую преграду (стена, дерево, камень), не о кромку воды
          const nx = bx ? -Math.sign(e.kx) : 0, ny = by ? -Math.sign(e.ky) : 0;
          const w = G().world, hx = e.x - nx * (e.r + 0.3), hy = e.y - ny * (e.r + 0.3);
          if (w.solid(hx, hy) && !w.isWater(hx, hy)) wallSlam(e, nx, ny, sp);
        }
      }
      const fr = e.airborne ? 0.5 : 0.02;
      const f = Math.pow(fr, dt);
      e.kx *= f;
      e.ky *= f;
      if (sp < 2) e.slammed = false;
    }
  };
  function wallSlam(e, nx, ny, sp) {
    const L = Math.hypot(nx, ny) || 1;
    nx /= L;
    ny /= L;
    e.slammed = true;
    e.kx = nx * 0.8;
    e.ky = ny * 0.8;
    const w = G().world;
    const b = w.buildingAt ? w.buildingAt(e.x - nx * 0.6, e.y - ny * 0.6) : null;
    const col = b && b.wall ? b.wall : '#8a8490';
    if (fxOk()) Fx().wallSlam(e, nx, ny, col);
    if (!e.dead) {
      // бонусный урон об стену
      const bonus = Math.min(40, 5 + sp * 1.2 + e.maxHp * 0.03);
      const src = e.lastHitBy && !e.lastHitBy.dead ? e.lastHitBy : null;
      J.hurt(e, bonus, src, { kind: 'pure', wallHit: true, fxTier: 'big', unblockable: true });
      if (!e.dead) {
        e.airborne = false;
        e.z = 0;
        e.kz = 0;
        setReact(e, 'slump', 0.8);
        e.face = Math.atan2(ny, nx);
        e.st.stun = Math.max(e.st.stun || 0, 0.8 + 0.45);
      }
    }
  }
  // Ответный раш: под чужим рашем можно сразу начать свой — кулаки столкнутся
  Cb.counterRush = function (u) {
    const s = u.st;
    if (!(u.rushHitT > G().t - 0.4) || u.dead || u.airborne || Cb.isDown(u)) return false;
    if (s.freeze > 0 || s.sleep > 0 || s.book > 0 || s.timefrozen || s.stun > 0.4) return false;
    s.stun = 0;
    const by = u.rushHitBy;
    if (by && !by.dead) u.face = Math.atan2(by.y - u.y, by.x - u.x);
    return true;
  };
  // Подъём с земли рывком (игрок)
  Cb.tech = function (e) {
    const r = e.react;
    if (!r || r.type !== 'down' || r.t < 0.12 || e.dead) return false;
    setReact(e, 'getup', 0.3);
    e.st.gup = 0.5;
    e.st.stun = 0.3;
    if (fxOk()) Fx().dust(e.x, e.y, 6, 0.4);
    return true;
  };

  // ---------- Атаки с моментом контакта ----------
  // o: { clip, type, dur, at, fn, stand, tg, step, armor, kind }
  Cb.attack = function (e, o) {
    e.atk = { t: 0, at: o.at, dur: o.dur, fn: o.fn, done: false, tg: o.tg || null, step: o.step || 0, reach: o.reach || 0.7, armor: !!o.armor, kind: o.kind || 'light', glint: !!o.glint };
    e.anim = { type: o.type || 'punch', clip: o.clip, t: o.dur, max: o.dur, stand: !!o.stand, tgt: o.tg || null, ai: !!o.ai };
    if (o.threat !== false) Cb.threat(e, o.at, o.kind || 'light');
    return e.atk;
  };
  Cb.cancelAtk = function (e) {
    if (e.atk && !e.atk.done) {
      e.atk = null;
      if (e.anim) e.anim.t = Math.min(e.anim.t, 0.08);
    }
  };
  function updateAtk(e, dt) {
    const a = e.atk;
    a.t += dt;
    if (!a.done) {
      if (a.glint && a.t >= a.at - 0.2 && !a.glinted) {
        a.glinted = true;
        if (fxOk()) Fx().glint(e);
      }
      // шаг вперёд к цели
      if (a.step && a.tg && !a.tg.dead) {
        const d = J.dist(e.x, e.y, a.tg.x, a.tg.y) - a.tg.r - e.r;
        if (d > a.reach) {
          const ang = Math.atan2(a.tg.y - e.y, a.tg.x - e.x);
          const s = Math.min(d - a.reach + 0.1, (a.step * dt) / Math.max(0.05, a.at));
          J.moveEnt(e, Math.cos(ang) * s, Math.sin(ang) * s);
        }
      }
      if (a.t >= a.at) {
        a.done = true;
        if (!e.dead && e.canAct()) a.fn();
      }
    }
    if (a.t >= a.dur && e.atk === a) e.atk = null;
  }
  Cb.busy = (e) => !!((e.atk && !e.atk.done) || e.channel || e.dash || e.chg || e.guard || e.bstun > 0);

  // Цель удара и угол (для игрока — прицел камеры)
  const aimFor = (u, range) => (u.isPlayer ? J.P.aim(u, range) : u.ai && u.ai.target ? J.Abil.aimAt(u, u.ai.target) : { ang: u.face, target: null });

  // Лёгкий удар: серия jab → cross → hook → апперкот (добивание)
  Cb.light = function (u) {
    const g = G();
    if (u.cds.basic > 0 || !u.canAct() || u.channel || u.dash || u.guard || u.chg || u.bstun > 0 || Cb.isDown(u)) return false;
    if (u.atk && !u.atk.done) {
      if (u.isPlayer) u.buf = g.t; // буфер ввода
      return false;
    }
    if (g.t - (u.lastAtkT || -9) > 0.7) u.combo = 0;
    const i = u.combo || 0;
    const clipName = J.Anim.CHAIN[i];
    const finisher = i === 3;
    u.combo = (i + 1) % 4;
    u.lastAtkT = g.t;
    const aim = aimFor(u, 3);
    u.face = aim.ang;
    const clip = J.Anim.CLIP[clipName];
    const so = standOn(u);
    const sd = so ? J.STANDS[u.stand.id] : null;
    const spdK = sd ? 1 - (J.rankNum(sd.st.spd) - 3) * 0.06 : 1;
    const dur = clip.dur * spdK;
    const at = dur * clip.hit;
    const counter = u.st.counter > 0;
    const cr = counter ? { crit: true } : null;
    if (counter) u.st.counter = 0;
    let fn;
    if (so) {
      u.standOut = true;
      const pw = u.isPlayer ? J.P.standPower(u) : u.dmgMul || 1;
      const base = u.isPlayer ? (5 + J.rankNum(sd.st.pow) * 2.2) * pw / Math.max(0.8, 0.7 + J.rankNum(sd.st.pow) * 0.11) : u.dmg * (u.dmgMul || 1) * 1.15;
      const dmg = base * (finisher ? 1.8 : 1) * (counter ? 1.6 : 1);
      if (sd.ranged || sd.basicFire) {
        fn = () => J.spawnProj(u, { ang: aimFor(u, 3).ang, speed: 14, dmg: dmg * 0.9, range: 10, shape: sd.basicFire ? 'flame' : 'orb', color: sd.c1, size: 0.18, fx: sd.basicFire ? { burn: 1.5 } : undefined, kind: sd.basicFire ? 'fire' : 'phys', stand: true });
      } else {
        // дальность считается от выброшенного вперёд стенда, а не от хозяина
        const range = 0.75 + Cb.standReach(u);
        fn = () => {
          const a = aimFor(u, 3).ang;
          u.face = a;
          const n = J.hitArc(u, a, range, 1.5, dmg, Object.assign({ knock: finisher ? 6 : 0.7, stun: finisher ? 0.4 : 0.16, finisher, melee: true, gdmg: finisher ? 35 : 12 }, cr));
          if (u.isPlayer && !n) u.whiff = g.t;
        };
      }
      Cb.attack(u, { clip: clipName, dur, at, fn, stand: true, tg: aim.target, kind: finisher ? 'heavy' : 'light', step: 0.3, reach: sd.ranged || sd.basicFire ? 6 : 0.25 + Cb.standReach(u) });
      J.Sfx && u.isPlayer && J.Sfx.whoosh(0.12, true, 0.08);
      u.cds.basic = finisher ? dur + 0.28 : dur * 0.82;
      return true;
    }
    // без стенда: кулаки, револьвер, хамон, вампир
    if (u.isPlayer && J.P.hasItem(u, 'revolver') && !u.style) {
      Cb.attack(u, { clip: 'jab', type: 'cast', dur: 0.25, at: 0.06, fn: () => J.spawnProj(u, { ang: aimFor(u, 3).ang, speed: 18, dmg: 16 + u.stats.agi * 1.5, range: 12, shape: 'bullet', color: '#ffd166', size: 0.1 }), kind: 'light', threat: false });
      u.cds.basic = 0.55;
      u.combo = 0;
      return true;
    }
    let dmg, kind = 'phys';
    if (u.isPlayer) {
      dmg = 4 + u.stats.str * 1.6 + (u.lvl - 1) * 0.6;
      if (u.style === 'vampire' || u.style === 'ultimate') dmg *= 1.7;
      if (u.style === 'hamon' && u.breath >= 3) {
        kind = 'hamon';
        u.breath -= 3;
        dmg *= 1.2;
      }
    } else dmg = u.dmg * (u.dmgMul || 1);
    dmg *= (finisher ? 1.7 : 1) * (counter ? 1.6 : 1);
    fn = () => {
      const a = aimFor(u, 3).ang;
      u.face = a;
      if (kind === 'hamon') J.R3.burst(u.x + Math.cos(a), u.y + Math.sin(a), 1.1, '#ffd84a', 4, 1.5, 0.3);
      const n = J.hitArc(u, a, (u.range || 1.35) + 0.05, 1.4, dmg, Object.assign({ knock: finisher ? 5 : 0.6, stun: finisher ? 0.35 : 0.14, kind, finisher, melee: true, gdmg: finisher ? 30 : 10, fx: u.poisonHit ? { poison: u.poisonHit } : undefined }, cr));
      if (u.isPlayer) {
        if (n && u.style === 'vampire') u.hp = Math.min(u.maxHp, u.hp + dmg * 0.15);
        if (n) J.P.trainStat(u, 'str', 0.4);
        else u.whiff = g.t;
      }
    };
    Cb.attack(u, { clip: clipName, dur: clip.dur * 1.1, at: clip.dur * 1.1 * clip.hit, fn, tg: aim.target, kind: finisher ? 'heavy' : 'light', step: 0.2 });
    J.Sfx && u.isPlayer && J.Sfx.whoosh(0.12, true, 0.07);
    u.cds.basic = finisher ? clip.dur + 0.3 : clip.dur * 0.9;
    return true;
  };

  // Заряженный тяжёлый удар: зажал — копишь, отпустил — бьёшь
  Cb.heavyStart = function (u) {
    if (u.cds.heavy > 0 || !u.canAct() || u.channel || u.dash || u.guard || u.chg || Cb.isDown(u) || (u.atk && !u.atk.done)) return false;
    if (u.isPlayer && u.stamina < 15) return false;
    u.chg = { t: 0, snd: false };
    return true;
  };
  Cb.heavyRelease = function (u) {
    const c = u.chg;
    if (!c) return false;
    u.chg = null;
    return Cb.heavy(u, J.clamp((c.t - 0.12) / 0.7, 0, 1));
  };
  Cb.heavy = function (u, k) {
    if (u.cds.heavy > 0 || !u.canAct() || u.channel || u.dash || Cb.isDown(u) || (u.atk && !u.atk.done)) return false;
    if (u.isPlayer) {
      if (u.stamina < 15) return false;
      u.stamina -= 15;
    }
    k = k || 0;
    const aim = aimFor(u, 3);
    u.face = aim.ang;
    const full = k >= 0.9;
    const counter = u.st.counter > 0;
    if (counter) u.st.counter = 0;
    const clip = J.Anim.CLIP.heavy;
    const so = standOn(u);
    let dmg, range, kind = 'phys';
    if (so) {
      const sd = J.STANDS[u.stand.id];
      u.standOut = true;
      dmg = u.isPlayer ? (12 + J.rankNum(sd.st.pow) * 5) * J.P.standPower(u) / Math.max(0.8, 0.7 + J.rankNum(sd.st.pow) * 0.11) : u.dmg * (u.dmgMul || 1) * 2.4;
      range = 0.95 + Cb.standReach(u);
    } else {
      dmg = u.isPlayer ? (10 + u.stats.str * 3.2) * (u.style === 'vampire' || u.style === 'ultimate' ? 1.6 : 1) : u.dmg * (u.dmgMul || 1) * 2.2;
      range = 1.5;
      if (u.isPlayer && u.style === 'hamon' && u.breath >= 8) {
        kind = 'hamon';
        u.breath -= 8;
      }
    }
    dmg *= (1 + 0.8 * k) * (counter ? 1.5 : 1);
    const fn = () => {
      const a = aimFor(u, 3).ang;
      u.face = a;
      const n = J.hitArc(u, a, range, 1.3, dmg, { knock: 8 + 2 * k, stun: 0.7, kind, launch: full, finisher: full, melee: true, gdmg: 45 + 45 * k, crit: counter });
      if (so && u.isPlayer) J.R3.text(u.x + Math.cos(a), u.y + Math.sin(a), J.STANDS[u.stand.id].cry + '!!', 'tcry', 0.9);
      if (u.isPlayer && !n) u.whiff = G().t;
    };
    Cb.attack(u, { clip: 'heavy', type: 'heavy', dur: clip.dur, at: clip.dur * clip.hit, fn, stand: so, tg: aim.target, kind: 'heavy', step: 0.35 });
    J.Sfx && J.Sfx.whoosh(0.2, true, 0.1);
    u.cds.heavy = u.isPlayer ? 1.5 : 2.2;
    return true;
  };

  // ---------- Рывок-уклонение ----------
  Cb.dodge = function (p, dx, dy) {
    if (Cb.isDown(p)) return Cb.tech(p);
    if (p.cds.dash > 0 || p.stamina < 20 || !p.canMove() || p.channel) return false;
    // рывок отменяет восстановление после удара, но не сам замах
    if (p.atk && !p.atk.done && p.atk.t < p.atk.at) return false;
    const ang = Math.hypot(dx, dy) > 0.1 ? Math.atan2(dy, dx) : p.face + Math.PI;
    p.stamina -= 20;
    p.cds.dash = 0.45;
    p.guard = false;
    p.chg = null;
    p.atk = null;
    if (p.anim && p.anim.type !== 'rush') p.anim = null;
    p.dash = { t: 0.22, vx: Math.cos(ang) * 13, vy: Math.sin(ang) * 13, dmg: 0, hit: new Set(), dodge: true };
    p.st.invuln = Math.max(p.st.invuln || 0, 0.24);
    const rel = J.angDiff(p.face, ang);
    p.dodgeDir = Math.abs(rel) < 0.8 ? 'f' : Math.abs(rel) > 2.3 ? 'b' : 's';
    p.dodgeSide = rel > 0 ? -1 : 1;
    if (fxOk()) Fx().dodge(p, ang);
    return true;
  };

  // ---------- Угрозы для ИИ ----------
  // Когда кто-то начинает удар, противники рядом «читают» замах (с задержкой реакции)
  Cb.threat = function (a, delay, kind) {
    const g = G();
    for (const o of g.ents) {
      if (o.dead || !o.ai || o.ai.civ || o.summon || !J.hostile(a, o)) continue;
      const d = J.dist(a.x, a.y, o.x, o.y);
      if (d > (kind === 'rush' ? 4.5 : kind === 'shot' ? 12 : 4)) continue;
      const ai = o.ai;
      // в блоке: долбить в блок опасно — ИИ ловит удар парированием
      if (o.guard && (kind === 'light' || kind === 'heavy') && d < 3.2 && rnd() < Cb.prof(o).parry * 2.5) {
        o.guardAt = g.t + delay - 0.08;
        ai.guardT = Math.max(ai.guardT || 0, delay + 0.1);
        continue;
      }
      // предугадывание: свободный стенд-юзер или босс может закрыться ещё до первого удара серии
      if (kind === 'light' && (o.standUser || o.boss) && !o.model && !o.guard && !o.react && d < 3.2 && !Cb.busy(o) && o.canAct() && rnd() < Cb.prof(o).guard * 0.5) {
        Cb.setGuard(o, true);
        if (o.guard) {
          o.guardAt = g.t - 1; // это не парирование
          ai.guardT = 0.5 + rnd() * 0.5;
          continue;
        }
      }
      if (ai.th && ai.th.at > g.t) continue;
      ai.th = { by: a, at: g.t + delay, kind, readAt: g.t + Cb.prof(o).react };
    }
  };

  // ---------- Раш: клэш (столкновение) ----------
  Cb.mash = function (u) {
    const c = G().clash;
    if (!c || (c.a !== u && c.b !== u)) return false;
    c.m = J.clamp(c.m + (c.a === u ? 0.045 : -0.045), 0, 1);
    c.pm = (c.pm || 0) + 1;
    return true;
  };
  Cb.inClash = (u) => {
    const c = G().clash;
    return !!c && (c.a === u || c.b === u);
  };
  const RUSH = [];
  function checkClash() {
    const g = G();
    if (g.clash) return;
    RUSH.length = 0;
    for (const e of g.ents) if (!e.dead && e.channel && e.channel.type === 'rush' && !(e.channel.fin > 0) && !e.st.timefrozen) RUSH.push(e);
    for (let i = 0; i < RUSH.length; i++)
      for (let j = i + 1; j < RUSH.length; j++) {
        const e = RUSH[i], o = RUSH[j];
        if (!J.hostile(e, o) || J.dist(e.x, e.y, o.x, o.y) > 3.2) continue;
        const ab = Math.atan2(o.y - e.y, o.x - e.x);
        if (Math.abs(J.angDiff(e.face, ab)) > 0.6 || Math.abs(J.angDiff(o.face, ab + Math.PI)) > 0.6) continue;
        startClash(o.isPlayer ? o : e, o.isPlayer ? e : o);
        RUSH.length = 0;
        return;
      }
    RUSH.length = 0;
  }
  function startClash(a, b) {
    const g = G();
    g.clash = { a, b, t: 0, m: 0.5, dur: 3.2 };
    for (const u of [a, b]) {
      u.channel.t = Math.max(u.channel.t, 0.5);
      u.guard = false;
    }
    if (fxOk()) Fx().clash(g.clash);
    if (a.isPlayer || b.isPlayer) J.UI.toast('Столкновение рашей! Жми ЛКМ / клавишу раша!', 'gold');
  }
  // скорость нажатий ИИ (в секунду)
  const mashRate = (e) => (e.isPlayer ? 0 : e.boss ? (e.bossKey === 'dio' ? 10.5 : 9.5) : 6.5 + Math.min(4, (e.stand ? e.stand.lvl : 3) * 0.4));
  function updateClash(dt) {
    const g = G();
    const c = g.clash;
    if (!c) return;
    const ok = (u) => !u.dead && u.channel && u.channel.type === 'rush' && g.ents.includes(u);
    if (!ok(c.a) || !ok(c.b)) {
      endClash(null);
      return;
    }
    c.t += dt;
    // ИИ давит
    for (const u of [c.a, c.b]) {
      const r = mashRate(u);
      if (!r) continue;
      u._mashAcc = (u._mashAcc || 0) + dt * r * (0.75 + rnd() * 0.5);
      while (u._mashAcc >= 1) {
        u._mashAcc -= 1;
        c.m = J.clamp(c.m + (c.a === u ? 0.045 : -0.045), 0, 1);
      }
    }
    // держим бойцов лицом к лицу на дистанции
    const ang = Math.atan2(c.b.y - c.a.y, c.b.x - c.a.x);
    c.a.face = ang;
    c.b.face = ang + Math.PI;
    c.a.channel.ang = ang;
    c.b.channel.ang = ang + Math.PI;
    const d = J.dist(c.a.x, c.a.y, c.b.x, c.b.y);
    const want = 2.3 + (c.a.stand ? 0 : -0.6);
    if (Math.abs(d - want) > 0.05) {
      const s = J.clamp((d - want) * 0.5, -0.05, 0.05);
      J.moveEnt(c.a, Math.cos(ang) * s, Math.sin(ang) * s);
      J.moveEnt(c.b, -Math.cos(ang) * s, -Math.sin(ang) * s);
    }
    // перевес сдвигает бойцов
    const push = (c.m - 0.5) * 0.6 * dt;
    J.moveEnt(c.b, Math.cos(ang) * push, Math.sin(ang) * push);
    J.moveEnt(c.a, Math.cos(ang) * push, Math.sin(ang) * push);
    for (const u of [c.a, c.b]) {
      u.channel.t = Math.max(u.channel.t, 0.3);
      if (u.anim) u.anim.t = Math.max(u.anim.t, 0.3);
    }
    if (c.m >= 0.985 || c.m <= 0.015 || c.t >= c.dur) endClash(c.m >= 0.5 ? c.a : c.b);
  }
  function endClash(win) {
    const g = G();
    const c = g.clash;
    g.clash = null;
    if (fxOk()) Fx().clashEnd();
    if (!win || !c) return;
    const lose = win === c.a ? c.b : c.a;
    const wc = win.channel;
    const ang = Math.atan2(lose.y - win.y, lose.x - win.x);
    lose.channel = null;
    if (lose.anim) lose.anim.t = 0;
    const dmg = (wc ? wc.dmg : 10) * 9;
    J.hurt(lose, dmg, win, { finisher: true, knock: 12, launch: true, clashWin: true, unblockable: true, melee: true, ang, stun: 1 });
    if (!lose.dead && !lose.airborne && !lose.immortal) launch(lose, ang, 12, false);
    if (wc) {
      wc.t = 0;
      wc.fin = 0.01;
      wc.won = true;
    }
    if (win.isPlayer) J.UI.toast('Ты победил в столкновении!', 'gold');
    else if (lose.isPlayer) J.UI.toast('Тебя перебили!', 'red');
  }
  Cb.endClash = endClash;

  // ---------- Общее обновление (раз в кадр симуляции) ----------
  Cb.update = function (dt) {
    checkClash();
    updateClash(dt);
    Cb.updateRoller(dt);
  };

  // ---------- ИИ ----------
  // Профиль противника: реакция, блок, парирование, уклонение, замах
  Cb.prof = function (e) {
    if (e.ai.prof) return e.ai.prof;
    const lvl = e.stand ? e.stand.lvl : Math.max(1, Math.round((e.maxHp || 50) / 40));
    let p;
    if (e.model) p = { react: 0.4, guard: 0, parry: 0, dodge: 0.05, wind: 0.42, aggr: 0.75, rec: 0.45 };
    else if (e.boss) p = { react: 0.2, guard: 0.5, parry: 0.16, dodge: 0.25, wind: 0.3, aggr: 0.7, rec: 0.38 };
    else if (e.standUser) p = { react: Math.max(0.22, 0.34 - lvl * 0.012), guard: Math.min(0.5, 0.22 + lvl * 0.03), parry: Math.min(0.12, 0.03 + lvl * 0.01), dodge: 0.15, wind: Math.max(0.3, 0.4 - lvl * 0.01), aggr: 0.6, rec: 0.42 };
    else p = { react: 0.36, guard: e.gun ? 0.08 : 0.15, parry: 0, dodge: e.gun ? 0.12 : 0.06, wind: 0.42, aggr: 0.55, rec: 0.48 };
    if (e.hamonHunter) p.guard = 0.25;
    e.ai.prof = p;
    return p;
  };

  // Приём со «звёздочкой» перед ударом (телеграф): замах → удар в момент контакта
  Cb.aiStrike = function (e, tg, heavy) {
    const pr = Cb.prof(e);
    const so = standOn(e);
    const wind = pr.wind * (heavy ? 1.35 : 1) * (0.9 + rnd() * 0.2);
    const ang0 = Math.atan2(tg.y - e.y, tg.x - e.x);
    e.face = ang0;
    const fx = e.poisonHit ? { poison: e.poisonHit } : undefined;
    const dmg = e.dmg * (e.dmgMul || 1) * (so ? 1.3 : 1) * (heavy ? 1.9 : 1) * (e.boss ? 0.7 : 1);
    const range = (e.range || 1.2) + (so ? 0.75 : 0.15);
    const fn = () => {
      const a = Math.atan2(tg.y - e.y, tg.x - e.x);
      e.face = a;
      // тяжёлый удар обычного противника отшвыривает и шатает, подбрасывают только боссы
      J.hitArc(e, a, range, heavy ? 1.6 : 1.3, dmg, { knock: heavy ? (e.boss ? 7 : 5.5) : 2, stun: heavy ? 0.6 : 0.2, fx, melee: true, gdmg: heavy ? 55 : 14 });
    };
    // анимация: замах, держим, резкий удар
    const clip = heavy ? 'heavy' : e.model ? 'jab' : J.Anim.CHAIN[(e.ai.ci = ((e.ai.ci || 0) + 1) % 3)];
    const C = J.Anim.CLIP[clip];
    const dur = wind / C.hit + (heavy ? 0.1 : 0);
    Cb.attack(e, { clip, type: heavy ? 'heavy' : 'punch', dur, at: wind, fn, stand: so, tg, kind: heavy ? 'heavy' : 'light', step: heavy ? 0.5 : 0.3, glint: true, ai: true });
    e.ai.rec = wind + pr.rec * (heavy ? 1.4 : 1);
  };

  // Решение ИИ, когда он «прочитал» замах противника
  function readThreat(e, ai, pr, g) {
    const th = ai.th;
    ai.th = null;
    if (!th || th.by.dead) return;
    // раш читается, пока он идёт; остальное — только до удара
    if (th.kind === 'rush' ? !rushing(th.by) : g.t > th.at + 0.05) return;
    if ((e.atk && !e.atk.done) || e.channel || e.dash || ai.rec > 0.15) return;
    const d = J.dist(e.x, e.y, th.by.x, th.by.y);
    const left = th.at - g.t;
    const r = rnd();
    // встречный раш — столкновение кулаков
    if (th.kind === 'rush' && e.stand && standOn(e) && d < 3.4 && (e.canAct() || Cb.counterRush(e))) {
      const ra = ab(e, 'rush');
      if (ra && !(e.cds[ra.name] > 0) && r < (e.boss ? 0.65 : 0.35)) {
        J.Abil.use(e, ra, J.Abil.aimAt(e, th.by));
        e.cds[ra.name] = ra.cd || 6;
        return;
      }
    }
    // парирование: блок ровно к удару
    if (left > 0.02 && th.kind !== 'rush' && th.kind !== 'shot' && r < pr.parry) {
      ai.parryAt = th.at - PARRY_WIN * 0.5;
      ai.guardT = 0.5;
      return;
    }
    // уклонение от тяжёлого / раша / выстрела
    if ((th.kind === 'heavy' || th.kind === 'rush' || th.kind === 'shot') && r < pr.parry + pr.dodge && e.canMove()) {
      const a = Math.atan2(e.y - th.by.y, e.x - th.by.x) + (rnd() < 0.5 ? 1.3 : -1.3);
      e.dash = { t: 0.2, vx: Math.cos(a) * 12, vy: Math.sin(a) * 12, dmg: 0, hit: new Set(), dodge: true };
      e.st.invuln = Math.max(e.st.invuln || 0, 0.2);
      e.dodgeDir = 's';
      return;
    }
    if (r < pr.parry + pr.dodge + pr.guard && d < 4.5) {
      Cb.setGuard(e, true);
      ai.guardT = 0.5 + rnd() * 0.7 + (th.kind === 'rush' ? 0.8 : 0);
    }
  }

  // Ближний/дальний бой ИИ. Возвращает true, если ИИ обработан
  Cb.fight = function (e, tg, d, ang, dt) {
    const g = G();
    const ai = e.ai;
    const pr = Cb.prof(e);
    const spd = e.speed * J.speedMul(e);
    if (e.stand) e.standOut = true;
    if (!(ai.rec > 0)) ai.rec = 0;
    else ai.rec -= dt;
    if (!(ai.atk > -9)) ai.atk = 0;
    engaged(e, 1);
    // заряд/замах идёт — стоим
    if (e.atk && !e.atk.done) {
      e.face = Math.atan2(tg.y - e.y, tg.x - e.x);
      e.vx = e.vy = 0;
      return true;
    }
    if (e.bstun > 0) {
      e.vx = e.vy = 0;
      return true;
    }
    // подъём после падения: стенд-юзеры и боссы встают в блок или отскакивают — бесконечно давить серией не выйдет
    if (ai.wake) {
      ai.wake = false;
      if (!e.model && !e.gun && (e.standUser || e.boss || e.hamonHunter) && e.canAct()) {
        const r = rnd();
        if (r < pr.guard * 1.3 && d < 4) {
          Cb.setGuard(e, true);
          ai.guardT = 0.6 + rnd() * 0.4;
          return true;
        }
        if (r < pr.guard * 1.3 + pr.dodge + 0.1 && d < 3 && e.canMove()) {
          const a = ang + Math.PI + (rnd() - 0.5) * 1.6;
          e.dash = { t: 0.2, vx: Math.cos(a) * 12, vy: Math.sin(a) * 12, dmg: 0, hit: new Set(), dodge: true };
          e.st.invuln = Math.max(e.st.invuln || 0, 0.2);
          e.dodgeDir = 'b';
          ai.atk = Math.min(ai.atk, 0.25);
          return true;
        }
      }
    }
    // чтение угрозы
    if (ai.th && g.t >= ai.th.readAt) readThreat(e, ai, pr, g);
    // запланированное парирование
    if (ai.parryAt && g.t >= ai.parryAt) {
      ai.parryAt = 0;
      e.guard = false;
      Cb.setGuard(e, true);
    }
    // блок
    if (e.guard) {
      ai.guardT = (ai.guardT || 0) - dt;
      e.face = ang;
      // пятимся в блоке
      if (d < 1.4) J.steer(e, e.x - Math.cos(ang), e.y - Math.sin(ang), spd * 0.3, dt);
      else e.vx = e.vy = 0;
      if (ai.guardT <= 0 || (e.gm !== undefined && e.gm < 25)) {
        Cb.setGuard(e, false);
        // контратака сразу после блока
        if (d < (e.range || 1.2) + tg.r + 1.2 && rnd() < pr.aggr) {
          ai.atk = 0;
          ai.counter = true;
        }
      }
      return true;
    }
    // боссы: фирменные приёмы
    if (e.boss && Cb.BOSS[e.bossKey] && Cb.BOSS[e.bossKey](e, tg, d, ang, dt)) return true;
    // способности стенда / заклинания (с телеграфом)
    ai.cast -= dt;
    if (ai.cast <= 0 && !(e.st.silence > 0) && ai.rec <= 0) {
      ai.cast = (e.boss ? 1.6 : 2.6) + rnd() * 1.6;
      if (J.Abil.aiCast(e, tg, d)) return true;
    }
    const ranged = e.gun || (e.stand && J.STANDS[e.stand.id].ranged);
    if (ranged) return rangedFight(e, tg, d, ang, dt, pr, spd);
    // ближний бой: дистанция, обход, вход в атаку
    const reach = (e.range || 1.2) + tg.r + (standOn(e) ? 0.7 : 0.1);
    ai.atk -= dt;
    ai.orb = ai.orb || (rnd() < 0.5 ? 1 : -1);
    if (rnd() < dt * 0.35) ai.orb *= -1;
    const lowHp = !e.boss && !e.model && e.hp < e.maxHp * 0.3;
    if (lowHp && !ai.fled) {
      ai.fled = true;
      ai.retreat = 1.4;
    }
    if (ai.retreat > 0) {
      ai.retreat -= dt;
      J.steer(e, e.x - Math.cos(ang) * 3 - Math.sin(ang) * ai.orb, e.y - Math.sin(ang) * 3 + Math.cos(ang) * ai.orb, spd * 0.85, dt);
      e.face = ang;
      return true;
    }
    // наказание промаха игрока
    const whiff = tg.isPlayer && tg.whiff && g.t - tg.whiff < 0.35 && d < reach + 1.2;
    if (whiff) {
      tg.whiff = 0;
      ai.atk = Math.min(ai.atk, 0);
    }
    const ready = ai.atk <= 0 && ai.rec <= 0;
    if (ready) {
      if (d > reach + 0.1) {
        // сближение
        J.steer(e, tg.x, tg.y, spd * (d > reach + 2 ? 1 : 0.85), dt);
        if (d < reach + 0.9 && rnd() < dt * 4) {
          startStrike(e, tg, pr);
        }
      } else startStrike(e, tg, pr);
      return true;
    }
    // ждём: держим дистанцию и кружим
    const ring = reach + 0.6 + (ai.st2 || 0);
    if (rnd() < dt * 0.5) ai.st2 = rnd() * 1.2;
    if (d > ring + 1.5) J.steer(e, tg.x, tg.y, spd, dt);
    else if (d < reach - 0.2) J.steer(e, e.x - Math.cos(ang) * 2, e.y - Math.sin(ang) * 2, spd * 0.55, dt);
    else J.steer(e, e.x - Math.sin(ang) * ai.orb * 2 + Math.cos(ang) * (d - ring), e.y + Math.cos(ang) * ai.orb * 2 + Math.sin(ang) * (d - ring), spd * 0.4, dt);
    e.face = ang;
    // иногда «закрывается» без повода
    if (!e.model && d < reach + 0.6 && rnd() < dt * pr.guard * 0.6) {
      Cb.setGuard(e, true);
      ai.guardT = 0.4 + rnd() * 0.5;
    }
    return true;
  };
  function startStrike(e, tg, pr) {
    const ai = e.ai;
    const heavy = !e.model && rnd() < (ai.counter ? 0.15 : 0.22);
    // контратака — быстрее
    if (ai.counter) {
      ai.counter = false;
      const p0 = pr.wind;
      pr.wind *= 0.7;
      Cb.aiStrike(e, tg, heavy);
      pr.wind = p0;
    } else Cb.aiStrike(e, tg, heavy);
    ai.atk = e.rate * (0.9 + rnd() * 0.7) * (e.boss ? 0.8 : 1) + (heavy ? 0.4 : 0);
  }
  // Стрелки: держат 5–7 м, обходят, стреляют после прицеливания
  function rangedFight(e, tg, d, ang, dt, pr, spd) {
    const ai = e.ai;
    ai.atk -= dt;
    ai.orb = ai.orb || (rnd() < 0.5 ? 1 : -1);
    if (rnd() < dt * 0.3) ai.orb *= -1;
    if (d > 8) J.steer(e, tg.x, tg.y, spd, dt);
    else if (d < 3.5) {
      J.steer(e, e.x - Math.cos(ang) * 3 - Math.sin(ang) * ai.orb, e.y - Math.sin(ang) * 3 + Math.cos(ang) * ai.orb, spd * 0.85, dt);
      // в упор — отскок
      if (d < 2 && rnd() < dt * pr.dodge * 6 && e.canMove()) {
        const a = ang + Math.PI + (rnd() - 0.5);
        e.dash = { t: 0.2, vx: Math.cos(a) * 12, vy: Math.sin(a) * 12, dmg: 0, hit: new Set(), dodge: true };
      }
    } else J.steer(e, e.x - Math.sin(ang) * ai.orb * 2, e.y + Math.cos(ang) * ai.orb * 2, spd * 0.45, dt);
    e.face = ang;
    if (ai.atk <= 0 && d < 11) {
      ai.atk = e.rate * (0.9 + rnd() * 0.6);
      const so = standOn(e);
      const color = e.stand ? J.STANDS[e.stand.id].c1 : '#ffd166';
      const wind = 0.32 + rnd() * 0.12;
      Cb.attack(e, {
        type: 'cast', clip: null, dur: wind + 0.2, at: wind, stand: so, tg, kind: 'shot', glint: true, ai: true,
        fn: () => {
          const a = Math.atan2(tg.y - e.y, tg.x - e.x);
          e.face = a;
          J.spawnProj(e, { ang: a + (rnd() - 0.5) * 0.12, speed: 14, dmg: e.dmg * e.dmgMul, range: 12, shape: e.stand ? 'orb' : 'bullet', color, size: e.stand ? 0.2 : 0.12, stand: !!e.stand });
          if (!e.stand && fxOk() && Fx().nearPlayer(e, null, 20)) J.Sfx && J.Sfx.thud(0.5, 0);
        },
      });
    }
    return true;
  }

  // Телеграф перед применением способности ИИ
  const TELE = { strike: 0.32, rush: 0.22, bomb: 0.25, disc: 0.3, beam: 0.42, shoot: 0.32, nova: 0.35, pull: 0.3, hex: 0.3, trap: 0.3, field: 0.3 };
  Cb.aiCastTele = function (e, ab, tg) {
    const t = TELE[ab.kind];
    if (!t) return J.Abil.use(e, ab, J.Abil.aimAt(e, tg));
    const pr = Cb.prof(e);
    const wind = t * (e.boss ? 0.9 : 1) * (pr.wind / 0.36);
    const melee = ab.kind === 'strike' || ab.kind === 'rush' || ab.kind === 'bomb' || ab.kind === 'disc';
    Cb.attack(e, {
      type: melee ? 'heavy' : 'cast', clip: melee ? 'heavy' : null, dur: wind + 0.05, at: wind, stand: standOn(e), tg, kind: ab.kind === 'rush' ? 'rush' : melee ? 'heavy' : 'shot', glint: true, ai: true,
      fn: () => {
        if (tg.dead) return;
        const r = J.Abil.use(e, ab, J.Abil.aimAt(e, tg));
        if (r) e.cds[ab.name] = (ab.cd || 5) * (e.boss ? 1.1 : 1.4);
      },
    });
    if (melee) e.ai.rec = wind + pr.rec;
    return true;
  };

  // ---------- Фирменные приёмы боссов ----------
  const ab = (e, kind, name) => {
    if (!e.stand) return null;
    const list = J.STANDS[e.stand.id].abil;
    return list.find((a) => a.kind === kind && (!name || a.name === name)) || null;
  };
  const ready = (e, a) => a && !(e.cds[a.name] > 0);
  Cb.BOSS = {
    // ДИО: остановка времени, ножи висят в воздухе, дорожный каток
    dio(e, tg, d, ang, dt) {
      const g = G();
      const ts = g.timestop;
      if (ts && ts.by === e) {
        const ai = e.ai;
        e.face = ang;
        // пока раскрывается сфера — стоит в позе
        if (ts.intro > 0) {
          e.vx = e.vy = 0;
          return true;
        }
        ai.tsT = (ai.tsT || 0) + dt;
        if (!ai.knives) {
          // отходит на дистанцию и метает ножи — они зависают в воздухе
          if (d < 4.2 && ai.tsT < 1.4) {
            J.steer(e, e.x - Math.cos(ang) * 3, e.y - Math.sin(ang) * 3, e.speed * 1.3, dt);
            return true;
          }
          e.vx = e.vy = 0;
          if (ai.tsT > 0.25 && d < 11) {
            ai.knives = true;
            const k = ab(e, 'shoot');
            if (k) J.Abil.use(e, k, J.Abil.aimAt(e, tg));
          }
          return true;
        }
        if (!ai.roller && ai.tsT > 1.3 && d < 12 && !(e.cds.roller > 0)) {
          ai.roller = true;
          e.cds.roller = 40;
          Cb.roadRoller(e, tg);
          return true;
        }
        // подходит вплотную, пока время стоит
        if (d > 2.4) J.steer(e, tg.x, tg.y, e.speed * 1.2, dt);
        else e.vx = e.vy = 0;
        e.face = ang;
        return true;
      }
      e.ai.tsT = 0;
      e.ai.knives = false;
      e.ai.roller = false;
      const t = ab(e, 'timestop');
      if (ready(e, t) && d < 9 && !g.timestop && !g.timeskip && e.hp < e.maxHp * 0.92 && e.ai.rec <= 0) {
        J.Abil.use(e, t, J.Abil.aimAt(e, tg));
        e.cds[t.name] = 30;
        Fx().taunt && Fx().taunt(e, 'ts');
        return true;
      }
      if (e.hp < e.maxHp * 0.3) Fx().taunt && Fx().taunt(e, 'low');
      return false;
    },
    // Кира: касание-метка, затем щелчок детонатора с предупреждением
    kira(e, tg, d, ang, dt) {
      const b = ab(e, 'bomb');
      if (!b) return false;
      if (tg.st.mark > 0 && tg.sv.markBy === e && ready(e, b) && !e.ai.det && e.ai.rec <= 0) {
        e.ai.det = true;
        e.cds[b.name] = b.cd * 1.3;
        Cb.bombTele(e, tg, b);
        return true;
      }
      if (!(tg.st.mark > 0)) e.ai.det = false;
      return false;
    },
    // Дьяволо: стирание времени → за спиной → удар сквозь грудь
    diavolo(e, tg, d, ang, dt) {
      const g = G();
      const k = ab(e, 'timeskip');
      if (ready(e, k) && !g.timestop && !g.timeskip && d < 9 && e.hp < e.maxHp * 0.9 && e.ai.rec <= 0) {
        J.Abil.use(e, k, J.Abil.aimAt(e, tg));
        e.cds[k.name] = 28;
        Fx().taunt && Fx().taunt(e, 'skip');
        e.ai.chop = true;
        return true;
      }
      if (e.ai.chop && !g.timeskip) {
        e.ai.chop = false;
        const s = ab(e, 'strike');
        if (s) {
          // после стирания — мощный удар с чётким замахом
          Cb.aiCastTele(e, s, tg);
          e.cds[s.name] = 0;
          return true;
        }
      }
      return false;
    },
    // Карс: рывок с клинком и сразу удар
    kars(e, tg, d, ang, dt) {
      const ai = e.ai;
      if (d > 3.5 && d < 9 && !(e.cds.karsDash > 0) && ai.rec <= 0 && e.canMove()) {
        e.cds.karsDash = 5;
        Cb.attack(e, {
          type: 'heavy', clip: 'heavy', dur: 0.4, at: 0.3, tg, kind: 'heavy', glint: true, ai: true,
          fn: () => {
            const a = Math.atan2(tg.y - e.y, tg.x - e.x);
            e.dash = { t: 0.3, vx: Math.cos(a) * 18, vy: Math.sin(a) * 18, dmg: e.dmg * e.dmgMul * 1.2, hit: new Set(), kind: 'phys' };
          },
        });
        ai.rec = 0.8;
        return true;
      }
      return false;
    },
  };
  Cb.BOSS.pucci_mih = function (e, tg, d) {
    // Made in Heaven: ускорение и серия ударов
    if (!(e.st.haste > 0) && !(e.cds.mihHaste > 0) && d < 10) {
      e.cds.mihHaste = 12;
      e.st.haste = 4;
      e.sv.haste = 0.8;
      Fx().taunt && Fx().taunt(e, 'aggro');
      J.R3.ring(e.x, e.y, 3, '#3cc48a', 0.5);
    }
    return false;
  };

  // Дорожный каток ДИО: падает на цель, после остановки — взрыв с предупреждением
  Cb.roadRoller = function (e, tg) {
    const g = G();
    const x = tg.x, y = tg.y;
    J.R3.text(e.x, e.y, 'ДОРОЖНЫЙ КАТОК!', 'tbig', 1.6, 3);
    J.UI.toast('ДИО: «ДОРОЖНЫЙ КАТОК!!»', 'red');
    const m = J.R3.roller ? J.R3.roller() : null;
    const rr = { x, y, h: 9, vh: 0, m, t: 0, landed: false, by: e };
    g.roller = rr;
    if (m) m.position.set(x, J.G.world.groundY(x, y) + 9, y);
  };
  Cb.updateRoller = function (dt) {
    const g = G();
    const r = g.roller;
    if (!r) return;
    const gy0 = g.world.groundY(r.x, r.y);
    if (!r.landed) {
      r.vh -= 30 * dt;
      r.h += r.vh * dt;
      if (r.h <= 0.6) {
        r.h = 0.6;
        r.landed = true;
        if (fxOk()) {
          Fx().shock(r.x, r.y, 1.2);
          Fx().trauma(0.6);
          Fx().word('ドゴォォン!!', r.x, r.y, gy0 + 1.5, 'fin', '#ffffff', '#b3122e');
          Fx().dust(r.x, r.y, 20, 1.6);
          J.Sfx && J.Sfx.boom(1);
        }
        J.R3.ring(r.x, r.y, 2.8, '#ff3a3a', 2);
      }
    } else if (!g.timestop) {
      // время пошло: 0.65 с на побег
      r.t += dt;
      if (r.t > 0.65) {
        if (fxOk()) {
          Fx().shock(r.x, r.y, 1.4);
          Fx().word(Fx().pick('boom'), r.x, r.y, gy0 + 1.6, 'fin', '#ffffff', '#b3122e');
          Fx().sparks(r.x, gy0 + 1, r.y, 30, null, '#ffb03a', 9);
          J.Sfx && J.Sfx.boom(1.2);
        }
        J.R3.flash(r.x, r.y, 3.2, '#ffb03a', 0.4);
        const by = r.by && !r.by.dead ? r.by : null;
        for (const o of g.ents) {
          if (o.dead || (by && !J.hostile(by, o))) continue;
          if (J.dist(o.x, o.y, r.x, r.y) > 2.7 + o.r) continue;
          J.hurt(o, 45 + (by ? by.dmg : 20), by, { knock: 9, stun: 0.8, finisher: true, ang: Math.atan2(o.y - r.y, o.x - r.x), gdmg: 80 });
        }
        if (r.m) J.R3.removeMesh(r.m);
        g.roller = null;
      }
    }
    if (r.m && g.roller) {
      r.m.position.set(r.x, gy0 + r.h, r.y);
      r.m.rotation.z = r.landed ? Math.sin(G().t * 30) * 0.02 : 0;
    }
  };
  // Детонация бомбы с предупреждением (Кира-ИИ)
  Cb.bombTele = function (e, tg, b) {
    J.R3.text(e.x, e.y, 'КЛИК…', 'tcry', 0.8);
    J.Sfx && J.Sfx.click();
    Fx().taunt && Fx().taunt(e, 'bomb');
    J.R3.ring(tg.x, tg.y, (b.radius || 2.2) * 1.1, '#ff5fa2', 0.7);
    e.anim = { type: 'pose', pose: 'kira', t: 0.7, max: 0.7 };
    G().timers.push({
      t: 0.7,
      fn: () => {
        if (e.dead) return;
        if (tg.st.mark > 0 && tg.sv.markBy === e) J.Abil.use(e, b, J.Abil.aimAt(e, tg), { det: true });
      },
    });
  };
})();
