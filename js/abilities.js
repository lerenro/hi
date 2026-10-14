'use strict';
// Способности: виды умений стендов + стили (хамон, вампир, вращение, совершенная форма).
(function () {
  const G = () => J.G;
  const A = (J.Abil = {});
  const deg = (d) => (d * Math.PI) / 180;

  A.pw = (u) => (u.isPlayer ? J.P.standPower(u) : u.dmgMul || 1);

  // Цель/точка прицеливания для ИИ
  A.aimAt = (u, tg) => ({ ang: Math.atan2(tg.y - u.y, tg.x - u.x), x: tg.x, y: tg.y, target: tg });

  const cryOf = (u) => {
    if (u.stand) {
      const sd = J.STANDS[u.stand.id];
      if (sd.cry) return sd.cry;
    }
    return 'ОРА';
  };

  // ---------- Применение способности ----------
  A.use = function (u, ab, aim, extra) {
    const g = G();
    const pw = (extra && extra.pw) || A.pw(u);
    const kind = (extra && extra.kind) || ab.dmgKind || (ab.hamon ? 'hamon' : 'phys');
    const ang = aim.ang;
    u.face = ang;
    const anim = (type, t) => (u.anim = { type, t, max: t, stand: !extra || !extra.noStand });
    switch (ab.kind) {
      case 'rush': {
        // раш: удержание клавиши продлевает, в конце — добивающий удар
        u.channel = { type: 'rush', t: ab.dur, max: ab.dur, tick: 0, dmg: ab.dmg * pw, range: ab.range || 1.6, ang, cry: (extra && extra.cry) || cryOf(u), kind, key: (extra && extra.key) || null, ext: 0, maxExt: ab.dur * 0.9, mag: 0.25, fin: 0, n: 0 };
        anim('rush', ab.dur);
        u.guard = false;
        u.chg = null;
        if (J.Fx) J.Fx.rushStart(u, u.channel.cry);
        if (J.Cb) J.Cb.threat(u, 0.15, 'rush');
        return true;
      }
      case 'strike': {
        const hits = ab.hits || 1;
        const strong = (ab.knock || 3) >= 6;
        const go = () => {
          const tg = aim.target && !aim.target.dead ? aim.target : null;
          const a = u.isPlayer ? J.P.aim(u, ab.range || 1.8).ang : tg ? Math.atan2(tg.y - u.y, tg.x - u.x) : ang;
          u.face = a;
          let n = 0;
          for (let i = 0; i < hits; i++) n += J.hitArc(u, a, ab.range || 1.8, ab.arc || 1.4, ab.dmg * pw, { knock: ab.knock || 3, stun: ab.stun, fx: ab.fx, pierceDef: ab.pierceDef, kind, melee: true, finisher: strong, gdmg: strong ? 70 : 45 });
          const fx = u.x + Math.cos(a) * 1.2, fy = u.y + Math.sin(a) * 1.2;
          J.R3.flash(fx, fy, 0.9, ab.color || standColor(u), 0.2);
          if (u.isPlayer && !n) u.whiff = g.t;
        };
        // игрок: замах и удар в момент касания; ИИ уже показал замах (Cb.aiCastTele)
        if (u.isPlayer && J.Cb) J.Cb.attack(u, { clip: 'heavy', type: 'heavy', dur: 0.5, at: 0.22, fn: go, stand: !extra || !extra.noStand, tg: aim.target, kind: 'heavy', step: 0.3 });
        else {
          anim('heavy', 0.35);
          go();
        }
        return true;
      }
      case 'shoot': {
        anim('cast', 0.3);
        if (J.Cb) J.Cb.threat(u, 0.12, 'shot');
        if (J.Fx && J.Fx.ready && u.isPlayer) J.Fx.star(u.x + Math.cos(ang) * 0.9, g.world.groundY(u.x, u.y) + 1.25, u.y + Math.sin(ang) * 0.9, 0.5, ab.color || '#ffffff');
        const n = ab.n || 1;
        const spread = deg(ab.spread || 0);
        for (let i = 0; i < n; i++) {
          let a = ang;
          if (n > 1) a = spread >= J.TAU - 0.01 ? ang + (i / n) * J.TAU : ang + spread * (i / (n - 1) - 0.5);
          J.spawnProj(u, {
            ang: a, speed: ab.speed || 10, dmg: ab.dmg * pw, range: ab.range || 10, shape: ab.proj, color: ab.color, size: ab.size,
            pierce: ab.pierce, homing: ab.homing, fx: ab.fx, explode: ab.explode, cloud: ab.cloud, kind, ghost: ab.ghost,
            stand: !(extra && extra.noStand) && !!u.stand,
          });
        }
        return true;
      }
      case 'beam': {
        anim('cast', 0.3);
        const w = g.world;
        let L = 0;
        const step = 0.25;
        const max = ab.range || 7;
        while (L < max) {
          const x = u.x + Math.cos(ang) * (L + step), y = u.y + Math.sin(ang) * (L + step);
          if (!ab.ghost && w.solid(x, y, { water: true })) break;
          L += step;
        }
        const x1 = u.x + Math.cos(ang) * L, y1 = u.y + Math.sin(ang) * L;
        J.R3.beam(u.x, u.y, x1, y1, ab.width || 0.35, ab.color || standColor(u), 0.35);
        if (J.Fx && J.Fx.ready && J.Fx.nearPlayer(u, null, 25)) {
          J.Fx.sparks(x1, g.world.groundY(x1, y1) + 1.1, y1, 14, ang + Math.PI, ab.color || standColor(u), 6);
          if (u.isPlayer) J.Fx.word('ビシュウウ', u.x + Math.cos(ang) * 2, u.y + Math.sin(ang) * 2, g.world.groundY(u.x, u.y) + 1.6, 'mid', ab.color || '#ffffff');
        }
        for (const o of g.ents) {
          if (o.dead || !J.hostile(u, o)) continue;
          const dx = o.x - u.x, dy = o.y - u.y;
          const t = dx * Math.cos(ang) + dy * Math.sin(ang);
          if (t < 0 || t > L + o.r) continue;
          const perp = Math.abs(-dx * Math.sin(ang) + dy * Math.cos(ang));
          if (perp > (ab.width || 0.35) / 2 + o.r) continue;
          J.hurt(o, ab.dmg * pw, u, { fx: ab.fx, kind, knock: 2, ang });
        }
        return true;
      }
      case 'nova': {
        anim('cast', 0.3);
        let cx = u.x, cy = u.y;
        if (ab.at === 'aim') {
          if (aim.target && J.dist(u.x, u.y, aim.target.x, aim.target.y) < (ab.range || 7) + 1) {
            cx = aim.target.x;
            cy = aim.target.y;
          } else {
            cx = u.x + Math.cos(ang) * (ab.range || 6);
            cy = u.y + Math.sin(ang) * (ab.range || 6);
          }
        }
        const fire = () => {
          if (u.dead) return;
          J.R3.ring(cx, cy, ab.radius * 1.1, ab.color || standColor(u), 0.5);
          J.R3.flash(cx, cy, ab.radius * 0.8, ab.color || standColor(u), 0.35, 0.6);
          J.R3.burst(cx, cy, 0.6, ab.color || standColor(u), 24, ab.radius * 1.5, 0.6);
          J.hitCircle(u, cx, cy, ab.radius, ab.dmg * pw, { fx: ab.fx, kind, knock: ab.knock || 3, gdmg: 40 });
          if (ab.radius > 3) J.R3.cam.shake = 0.2;
          if (J.Fx && J.Fx.ready) J.Fx.shock(cx, cy, Math.min(1.5, ab.radius / 3));
        };
        if (ab.delay) {
          J.R3.ring(cx, cy, ab.radius, '#ffffff', ab.delay);
          g.timers.push({ t: ab.delay, fn: fire });
        } else fire();
        return true;
      }
      case 'dash': {
        const dist = ab.dist || 6;
        const sp = 20;
        u.dash = { t: dist / sp, vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp, dmg: (ab.dmg || 0) * pw, hit: new Set(), kind };
        if (ab.invuln) u.st.invuln = Math.max(u.st.invuln || 0, dist / sp + 0.05);
        if (ab.ghost) u.st.ghost = dist / sp + 0.05;
        anim('heavy', dist / sp);
        if (J.Fx && J.Fx.ready) J.Fx.dodge(u, ang);
        return true;
      }
      case 'blink': {
        const w = g.world;
        let tx, ty;
        if (aim.target && J.dist(u.x, u.y, aim.target.x, aim.target.y) < (ab.range || 7) + 2) {
          // за спину цели
          const ta = Math.atan2(aim.target.y - u.y, aim.target.x - u.x);
          tx = aim.target.x + Math.cos(ta) * 1.2;
          ty = aim.target.y + Math.sin(ta) * 1.2;
        } else {
          tx = u.x + Math.cos(ang) * (ab.range || 7);
          ty = u.y + Math.sin(ang) * (ab.range || 7);
        }
        // ищем проходимую точку ближе к цели
        let ok = false;
        for (let k = 0; k < 12; k++) {
          const f = 1 - k * 0.08;
          const x = u.x + (tx - u.x) * f, y = u.y + (ty - u.y) * f;
          if (!J.blocked(x, y, u.r * 0.9, {}) && !w.isWater(x, y)) {
            tx = x;
            ty = y;
            ok = true;
            break;
          }
        }
        if (!ok) return false;
        J.R3.burst(u.x, u.y, 1, standColor(u), 16, 3, 0.5);
        if (J.Fx && J.Fx.ready) J.Fx.star(u.x, g.world.groundY(u.x, u.y) + 1.1, u.y, 1.2, standColor(u));
        u.x = tx;
        u.y = ty;
        J.R3.burst(u.x, u.y, 1, standColor(u), 16, 3, 0.5);
        if (J.Fx && J.Fx.ready && J.Fx.nearPlayer(u, null, 20)) {
          J.Fx.star(u.x, g.world.groundY(u.x, u.y) + 1.1, u.y, 1.2, standColor(u));
          J.Fx.word('シュン', u.x, u.y, g.world.groundY(u.x, u.y) + 2, 'mid', '#ffffff');
          J.Sfx && J.Sfx.whoosh(0.15, false, 0.1);
        }
        if (aim.target) u.face = Math.atan2(aim.target.y - u.y, aim.target.x - u.x);
        return true;
      }
      case 'pull': {
        const tg = aim.target && J.dist(u.x, u.y, aim.target.x, aim.target.y) < (ab.range || 7) + 0.5 ? aim.target : J.nearestHostile(u, ab.range || 7, 0.6, ang);
        if (!tg) return false;
        anim('cast', 0.3);
        J.R3.beam(u.x, u.y, tg.x, tg.y, 0.12, standColor(u), 0.35);
        const a = Math.atan2(tg.y - u.y, tg.x - u.x);
        if (!tg.boss) {
          tg.x = u.x + Math.cos(a) * 1.1;
          tg.y = u.y + Math.sin(a) * 1.1;
          if (J.blocked(tg.x, tg.y, tg.r, {})) {
            tg.x = u.x;
            tg.y = u.y;
          }
        }
        J.hurt(tg, (ab.dmg || 5) * pw, u, { stun: ab.stun || 0.6, kind });
        return true;
      }
      case 'timestop': {
        let dur = ab.dur;
        if (u.isPlayer && u.stand) dur += Math.max(0, u.stand.lvl - 6) * 0.3;
        // вступление (сфера инверсии) не съедает время остановки
        g.timestop = { by: u, t: dur, max: dur, intro: 0.95 };
        const isWorld = u.stand && (u.stand.id === 'the_world');
        J.R3.text(u.x, u.y, isWorld ? 'ZA WARUDO!' : 'ВРЕМЯ, ОСТАНОВИСЬ!', 'tbig', 1.6, 2.6);
        u.anim = { type: 'pose', t: 0.9, max: 0.9 };
        u.channel = null;
        if (J.Fx && J.Fx.ready) J.Fx.timestopIntro(u, dur);
        else {
          J.R3.ring(u.x, u.y, 18, '#ffffff', 0.8);
          J.UI.timestopFx(true);
        }
        // игрок со стендом, умеющим останавливать время, может двигаться
        const pl = g.player;
        if (u !== pl && pl.stand) {
          const can = J.STANDS[pl.stand.id].abil.some((x) => x.kind === 'timestop');
          if (can) {
            pl.tsMove = Math.min(dur, 1 + pl.stand.lvl * 0.12);
            J.UI.toast('Ты можешь двигаться в остановленном времени!', 'gold');
          } else if (pl.stand.id === 'star_platinum' && pl.stand.lvl >= 5) {
            pl.flags.witnessTS = true;
            J.UI.toast('Звёздная Платина видит остановленное время...', 'gold');
          }
        }
        return true;
      }
      case 'timeskip': {
        u.st.invuln = ab.dur;
        u.st.haste = ab.dur;
        u.sv.haste = 0.6;
        g.timeskip = { by: u, t: ab.dur, max: ab.dur };
        J.R3.text(u.x, u.y, 'КИНГ КРИМСОН!', 'tbig', 1.4, 2.6);
        if (J.Fx && J.Fx.ready) J.Fx.timeskip(u, true);
        for (const o of g.ents) if (o.ai && J.hostile(u, o)) o.ai.blind = ab.dur;
        if (u.isPlayer) J.UI.timeskipFx(true);
        else {
          // враг стирает время: появляется за спиной игрока
          const pl = g.player;
          const a = pl.face + Math.PI;
          const x = pl.x + Math.cos(a) * 1.3, y = pl.y + Math.sin(a) * 1.3;
          if (!J.blocked(x, y, u.r, {})) {
            u.x = x;
            u.y = y;
          }
          J.UI.timeskipFx(true);
          J.UI.toast('Время стёрто! Где он?!', 'red');
        }
        g.timers.push({
          t: ab.dur,
          fn: () => {
            g.timeskip = null;
            J.UI.timeskipFx(false);
            if (J.Fx && J.Fx.ready) J.Fx.timeskip(u, false);
            u.st.power = 2.5;
            u.sv.power = 0.6;
          },
        });
        return true;
      }
      case 'rewind': {
        const h = u.hist || [];
        const back = ab.back || 5;
        const snap = h.find((s) => g.t - s.t <= back + 0.3 && g.t - s.t >= back - 0.5) || h[0];
        if (!snap) return false;
        const ox = u.x, oy = u.y;
        J.R3.flash(u.x, u.y, 2.5, '#d670b8', 0.5);
        u.x = snap.x;
        u.y = snap.y;
        u.hp = Math.max(u.hp, snap.hp);
        for (const k of ['stun', 'freeze', 'poison', 'burn', 'bleed', 'age', 'heavy', 'slow', 'sleep', 'book', 'root']) u.st[k] = 0;
        J.R3.text(u.x, u.y, ab.dmg ? 'BITES THE DUST' : 'ПЕРЕМОТКА', 'tbig', 1.4, 2.4);
        if (J.Fx && J.Fx.ready && J.Fx.nearPlayer(u, null, 25)) {
          J.Fx.word('カチッ', u.x, u.y, g.world.groundY(u.x, u.y) + 2, 'big', '#ff9ad8');
          J.Sfx && J.Sfx.click();
          J.Sfx && J.Sfx.whoosh(0.4, false, 0.12);
        }
        if (ab.dmg) {
          J.R3.flash(ox, oy, ab.radius, '#ff5fa2', 0.5);
          J.hitCircle(u, ox, oy, ab.radius, ab.dmg * pw, { knock: 5, kind: 'fire' });
        }
        if (u.isPlayer) J.UI.rewindFx();
        return true;
      }
      case 'summon': {
        anim('cast', 0.3);
        J.spawnSummon(u, ab.unit, ab.n || 1, ab.life || 15, pw);
        return true;
      }
      case 'heal': {
        const amt = u.maxHp * (ab.amt || 0.3);
        u.hp = Math.min(u.maxHp, u.hp + amt);
        J.R3.burst(u.x, u.y, 1, '#7ed957', 20, 2, 0.8, 3);
        J.R3.text(u.x, u.y, '+' + Math.round(amt), 'theal', 1);
        return true;
      }
      case 'restore': {
        anim('cast', 0.35);
        let healed = 0;
        for (const o of g.ents) {
          if (o.dead || o === u) continue;
          const d = J.dist(u.x, u.y, o.x, o.y);
          if (d > ab.radius) continue;
          if (J.hostile(u, o)) {
            J.hurt(o, 12 * pw, u, { stun: ab.stun });
            J.R3.text(o.x, o.y, 'ВОССТАНОВЛЕНИЕ', 'tpink', 0.8);
          } else if (o.team === u.team || o.kind === 'civ') {
            o.hp = Math.min(o.maxHp, o.hp + ab.heal * pw);
            healed++;
            J.R3.burst(o.x, o.y, 1, '#ff9be6', 10, 1.5, 0.6);
          }
        }
        J.R3.ring(u.x, u.y, ab.radius, '#ff9be6', 0.6);
        if (u.isPlayer && healed === 0) J.UI.toast('Безумный Бриллиант не может лечить своего владельца.', 'muted');
        return true;
      }
      case 'buff': {
        const b = ab.buff;
        u.st[b] = ab.dur;
        u.sv[b] = ab.val;
        if (b === 'invuln' && ab.root) u.sv.invulnRoot = true;
        if (b === 'heaven') {
          if (u.isPlayer) g.timeAccel = ab.dur;
          J.R3.text(u.x, u.y, 'MADE IN HEAVEN', 'tbig', 1.6, 2.6);
        }
        if (b === 'zero') J.R3.text(u.x, u.y, 'РЕКВИЕМ', 'tbig', 1.4, 2.6);
        if (b === 'lovetrain') J.R3.text(u.x, u.y, 'ПОЕЗД ЛЮБВИ', 'tbig', 1.4, 2.6);
        if (b === 'fly') u.z = 0;
        J.R3.burst(u.x, u.y, 1, ab.color || standColor(u), 24, 2.5, 0.7, 3);
        J.R3.ring(u.x, u.y, 2, ab.color || standColor(u), 0.5);
        if (J.Fx && J.Fx.ready && u.isPlayer) J.Fx.column(0, 'ドドドド', ab.color || standColor(u), 1.2);
        return true;
      }
      case 'hex': {
        let tg = aim.target && J.dist(u.x, u.y, aim.target.x, aim.target.y) < (ab.range || 5) + 0.6 ? aim.target : J.nearestHostile(u, ab.range || 5, 0.7, ang);
        if (!tg) return false;
        anim('cast', 0.3);
        const victims = ab.aoe ? G().ents.filter((o) => !o.dead && J.hostile(u, o) && J.dist(o.x, o.y, tg.x, tg.y) <= ab.aoe) : [tg];
        J.R3.beam(u.x, u.y, tg.x, tg.y, 0.08, standColor(u), 0.3);
        if (ab.aoe) J.R3.ring(tg.x, tg.y, ab.aoe, standColor(u), 0.5);
        for (const v of victims) A.applyHex(u, v, ab.status, ab.dur, pw);
        return true;
      }
      case 'trap': {
        anim('cast', 0.3);
        const cx = aim.target ? aim.target.x : u.x + Math.cos(ang) * 2.5;
        const cy = aim.target ? aim.target.y : u.y + Math.sin(ang) * 2.5;
        const n = ab.n || 4;
        for (let i = 0; i < n; i++) {
          const a = (i / n) * J.TAU;
          const r = n > 3 ? ab.radius * 0.7 : 1;
          let x = cx + Math.cos(a) * r, y = cy + Math.sin(a) * r;
          if (G().world.solid(x, y)) {
            x = cx;
            y = cy;
          }
          J.addTrap(u, { x, y, dmg: ab.dmg * pw, fx: ab.fx, color: ab.color || standColor(u), life: ab.life || 25 });
        }
        return true;
      }
      case 'field': {
        anim('cast', 0.3);
        let fx = u.x, fy = u.y;
        if (!ab.follow && aim.target && J.dist(u.x, u.y, aim.target.x, aim.target.y) < 8) {
          fx = aim.target.x;
          fy = aim.target.y;
        }
        J.addField(u, { x: fx, y: fy, radius: ab.radius, dur: ab.dur, dps: ab.dps * pw, color: ab.color || standColor(u), fx: ab.fx, follow: ab.follow, hurtSelf: ab.hurtSelf, calamity: ab.calamity });
        return true;
      }
      case 'reveal': {
        if (!u.isPlayer) return false;
        g.reveal = ab.dur;
        J.R3.ring(u.x, u.y, 25, standColor(u), 1.2);
        J.UI.toast('Скрытое стало видно: враги, улики и тайники отмечены.', 'gold');
        if (ab.money) {
          const m = 20 + Math.floor(Math.random() * 120);
          J.P.addMoney(u, m);
          J.UI.toast('Жуки нашли ' + J.fmtMoney(m) + '!', 'green');
        }
        J.Story && J.Story.onReveal();
        return true;
      }
      case 'bomb': {
        const marked = G().ents.find((o) => !o.dead && o.st.mark > 0 && o.sv.markBy === u);
        if (marked) {
          // ИИ сначала щёлкает детонатором — у цели есть миг, чтобы увернуться
          if (!u.isPlayer && !(extra && extra.det) && J.Cb) {
            J.Cb.bombTele(u, marked, ab);
            return true;
          }
          J.R3.text(u.x, u.y, 'КЛИК!', 'tcry', 0.8);
          J.R3.flash(marked.x, marked.y, ab.radius, '#ff9ad8', 0.45);
          J.R3.ring(marked.x, marked.y, ab.radius * 1.2, '#ff5fa2', 0.5);
          J.R3.burst(marked.x, marked.y, 1, '#ffb03a', 30, 5, 0.6);
          J.hitCircle(u, marked.x, marked.y, ab.radius, ab.dmg * pw, { knock: 6, kind: 'fire', fx: { burn: 3 }, gdmg: 60 });
          marked.st.mark = 0;
          J.R3.cam.shake = 0.3;
          if (J.Fx && J.Fx.ready && J.Fx.nearPlayer(u, marked, 30)) {
            J.Fx.word(J.Fx.pick('boom'), marked.x, marked.y, g.world.groundY(marked.x, marked.y) + 1.6, 'fin', '#ffffff', '#b3122e');
            J.Fx.shock(marked.x, marked.y, 1.2);
            J.Fx.sparks(marked.x, g.world.groundY(marked.x, marked.y) + 1, marked.y, 30, null, '#ffb03a', 9);
            J.Fx.debris(marked.x, g.world.groundY(marked.x, marked.y) + 0.6, marked.y, 0, 0, 20, '#8a7a6a');
            J.Sfx && J.Sfx.boom(1);
          }
          return true;
        }
        const tg = aim.target && J.dist(u.x, u.y, aim.target.x, aim.target.y) < (ab.range || 2) + 0.8 ? aim.target : J.nearestHostile(u, ab.range || 2, 0.9, ang);
        anim('punch', 0.3);
        if (!tg) return false;
        tg.st.mark = 15;
        tg.sv.markBy = u;
        J.hurt(tg, 8 * pw, u, { melee: true });
        J.R3.text(tg.x, tg.y, 'Первая бомба!', 'tpink', 1);
        if (J.Fx && J.Fx.ready && J.Fx.nearPlayer(u, tg, 20)) J.Fx.word('カチッ', tg.x, tg.y, g.world.groundY(tg.x, tg.y) + 2, 'mid', '#ff9ad8');
        return 'short';
      }
      case 'disc': {
        const tg = aim.target && J.dist(u.x, u.y, aim.target.x, aim.target.y) < (ab.range || 2) + 0.8 ? aim.target : J.nearestHostile(u, ab.range || 2, 0.9, ang);
        anim('heavy', 0.35);
        if (!tg) return false;
        J.hurt(tg, ab.dmg * pw, u, { stun: ab.stun });
        if (tg.stand && (!tg.boss || tg.hp < tg.maxHp * 0.35)) {
          if (u.isPlayer) {
            J.P.addItem(u, 'stand_disc', 1, { stand: tg.stand.id });
            J.UI.toast('Белая Змея вытащила диск: ' + J.STANDS[tg.stand.id].ru + '!', 'gold');
            J.P.seeStand(u, tg.stand.id);
          }
          J.R3.text(tg.x, tg.y, 'ДИСК!', 'tbig', 1.2);
          tg.stand = null;
          tg.standOut = false;
          tg.st.silence = 99;
        } else if (tg.isPlayer && tg.stand && Math.random() < 0.25) {
          J.UI.toast('Белая Змея пытается вытащить твой стенд!', 'red');
          tg.st.silence = 6;
        } else tg.st.disc = 12;
        return true;
      }
    }
    return false;
  };

  A.applyHex = function (u, v, status, dur, pw) {
    const res = v.boss ? 0.4 : 1;
    switch (status) {
      case 'charm':
        if (v.boss || v.isPlayer) {
          v.st.stun = Math.max(v.st.stun || 0, 1.2);
          J.R3.text(v.x, v.y, 'СОПРОТИВЛЯЕТСЯ', 'tmiss', 0.8);
          return;
        }
        if (!v.origTeam) v.origTeam = v.team;
        v.team = u.team;
        v.st.charm = dur;
        if (v.ai) v.ai.target = null;
        J.R3.text(v.x, v.y, 'ПОД КОНТРОЛЕМ', 'tpink', 1);
        break;
      case 'sleep':
        v.st.sleep = dur * res;
        J.R3.text(v.x, v.y, 'Zzz', 'tmiss', 1);
        break;
      case 'book':
        v.st.book = dur * res;
        J.R3.text(v.x, v.y, 'ХЕВЕНС ДОР!', 'tgold', 1);
        if (u.isPlayer && v.name) J.UI.toast('Книга «' + v.name + '»: ' + (v.stand ? 'стенд — ' + J.STANDS[v.stand.id].ru + '. ' : '') + (v.boss ? 'Очень опасен.' : 'Ничего особенного.'), 'muted');
        break;
      case 'drain':
        v.st.drain = dur;
        v.sv.drainSrc = u;
        J.R3.text(v.x, v.y, 'ПОГЛОЩЕНИЕ', 'tred', 0.8);
        break;
      case 'mark2':
        v.st.mark2 = dur;
        v.sv.mark2Src = u;
        v.sv.mark2Pw = pw;
        J.R3.text(v.x, v.y, 'НАКЛЕЙКА', 'tpink', 0.8);
        break;
      case 'bleed':
      case 'age':
        v.st[status] = dur * res;
        v.sv[status + 'Src'] = u;
        J.R3.text(v.x, v.y, status === 'age' ? 'СТАРЕНИЕ' : 'КРОВОТЕЧЕНИЕ', 'tred', 0.8);
        break;
      case 'heavy':
        v.st.heavy = dur * res;
        J.R3.text(v.x, v.y, 'S-H-I-T! ТЯЖЕСТЬ!', 'tgreen', 1);
        break;
      default:
        v.st[status] = dur * res;
        J.R3.text(v.x, v.y, ({ slow: 'ЗАМЕДЛЕН', root: 'ЗАФИКСИРОВАН', silence: 'ТИШИНА', soft: 'РАЗМЯГЧЁН' }[status] || status.toUpperCase()), 'tmiss', 0.8);
    }
  };

  function standColor(u) {
    if (u.stand) return J.STANDS[u.stand.id].c1;
    return '#ffd84a';
  }
  A.standColor = standColor;

  // ---------- Каналы ----------
  A.updateChannel = function (e, dt) {
    const c = e.channel;
    if (!e.canAct()) {
      e.channel = null;
      if (e.anim && e.anim.type === 'rush') e.anim.t = 0;
      return;
    }
    // во время столкновения рашей всем управляет combat.js
    if (J.Cb && J.Cb.inClash(e)) return;
    const sf = J.Cb && J.Cb.standOn(e) ? 0.95 : 0.3;
    if (c.fin > 0) {
      c.fin -= dt;
      e.face = c.ang;
      if (e.anim) e.anim.t = Math.max(e.anim.t, 0.1);
      if (c.fin <= 0) rushFinisher(e, c, sf);
      return;
    }
    c.t -= dt;
    c.tick -= dt;
    if (e.isPlayer) c.ang = J.P.aim(e, 3).ang;
    e.face = c.ang;
    // удержание клавиши продлевает раш (тратит энергию стенда)
    if (e.isPlayer && c.key) {
      const held = J.Input.held(c.key);
      if (held && c.t < 0.1 && c.ext < c.maxExt && (!e.stand || e.se > 2)) {
        c.t += dt;
        c.ext += dt;
        if (e.stand) e.se -= 9 * dt;
      } else if (!held && c.ext > 0) c.t = Math.min(c.t, 0);
    }
    // притяжение к цели: в начале раша — рывком, дальше — шагом за отлетающей жертвой
    {
      const mag = c.mag > 0;
      if (mag) c.mag -= dt;
      const tg = J.nearestHostile(e, c.range + sf + 1.2, 0.8, c.ang);
      if (tg) {
        const d = J.dist(e.x, e.y, tg.x, tg.y) - tg.r;
        if (d > sf + 0.55) {
          const a = Math.atan2(tg.y - e.y, tg.x - e.x);
          const sp = mag ? 3.2 : 1.8;
          J.moveEnt(e, Math.cos(a) * sp * dt, Math.sin(a) * sp * dt);
        }
      }
    }
    if (c.tick <= 0) {
      c.tick = 1 / 11;
      c.n++;
      J.hitArc(e, c.ang, c.range + sf, 1.4, c.dmg, { stun: 0.25, knock: 0.18, kind: c.kind, rushTick: true, melee: true, gdmg: 7 });
      if (J.Sfx && J.Fx && J.Fx.nearPlayer(e, null, 20)) {
        J.Sfx.rushTick(c.n % 2 ? 0.25 : -0.25);
        if (c.n % 3 === 0) J.Sfx.rushTick(c.n % 2 ? -0.2 : 0.2);
      }
    }
    if (e.anim && e.anim.type === 'rush') e.anim.t = Math.max(e.anim.t, 0.2);
    if (c.t <= 0) {
      // короткий замах перед добиванием
      c.fin = 0.12;
      if (J.Fx) J.Fx.rushEnd(e);
    }
  };
  function rushFinisher(e, c, sf) {
    const n = J.hitArc(e, c.ang, c.range + sf + 0.3, 1.5, c.dmg * 3.5, { knock: 8, stun: 0.5, kind: c.kind, finisher: true, melee: true, gdmg: 60 });
    J.R3.flash(e.x + Math.cos(c.ang) * 1.3, e.y + Math.sin(c.ang) * 1.3, 1.1, e.stand ? J.STANDS[e.stand.id].c2 : '#ffd84a', 0.25);
    e.channel = null;
    const so = J.Cb && J.Cb.standOn(e);
    e.anim = { type: 'heavy', clip: 'heavy', t: 0.26, max: 0.5, stand: so };
    // поза ДжоДжо после добивания
    if (e.isPlayer || e.boss)
      G().timers.push({
        t: 0.32,
        fn: () => {
          if (!e.dead && !e.channel && !(e.atk && !e.atk.done) && !e.guard && (n || c.won)) e.anim = { type: 'pose', t: 0.7, max: 0.7 };
        },
      });
  }
  A.updateDash = function (e, dt) {
    const d = e.dash;
    d.t -= dt;
    J.moveEnt(e, d.vx * dt, d.vy * dt);
    e.vx = d.vx;
    e.vy = d.vy;
    J.R3.burst(e.x, e.y, 0.6, standColor(e), 2, 1, 0.3, 0.5);
    if (d.dmg > 0)
      for (const o of G().ents) {
        if (o.dead || d.hit.has(o.id) || !J.hostile(e, o)) continue;
        if (J.dist(e.x, e.y, o.x, o.y) < 1.1 + o.r) {
          d.hit.add(o.id);
          J.hurt(o, d.dmg, e, { knock: 4, stun: 0.3, kind: d.kind, melee: true });
        }
      }
    if (d.t <= 0) e.dash = null;
  };
  A.updateVoid = function (e, dt) {
    e._vt = (e._vt || 0) - dt;
    if (Math.random() < 0.6) J.R3.burst(e.x, e.y, 0.9, '#3c2f48', 3, 1, 0.5, 0.3);
    if (e._vt > 0) return;
    e._vt = 0.15;
    for (const o of G().ents) {
      if (o.dead || !J.hostile(e, o)) continue;
      if (J.dist(e.x, e.y, o.x, o.y) < 1.2 + o.r) J.hurt(o, 30 * A.pw(e), e, { kind: 'pure', pierceDef: true });
    }
    if (!e.isPlayer && e.ai && e.ai.target) J.steer(e, e.ai.target.x, e.ai.target.y, 6, dt);
  };

  // ---------- ИИ: выбор способности ----------
  const MELEE = { rush: 1, strike: 1, bomb: 1, disc: 1, restore: 1 };
  const VSPELLS = {
    vfreeze: { name: 'Заморозка', kind: 'strike', dmg: 22, range: 1.8, fx: { freeze: 1.2 }, cd: 5, color: '#a8e0ff' },
    veyes: { name: 'Глаза-лазеры', kind: 'beam', dmg: 30, range: 9, width: 0.2, color: '#ff4a6a', cd: 7 },
  };
  A.VSPELLS = VSPELLS;
  A.aiCast = function (e, tg, d) {
    const list = [];
    if (e.stand) {
      const sd = J.STANDS[e.stand.id];
      sd.abil.forEach((ab) => {
        if (ab.lvl <= Math.max(e.stand.lvl, 1)) list.push(ab);
      });
    }
    if (e.spells) e.spells.forEach((s) => list.push(typeof s === 'string' ? VSPELLS[s] : s));
    const ok = list.filter((ab) => {
      if (e.cds[ab.name] > 0) return false;
      if (ab.kind === 'reveal') return false;
      if (ab.kind === 'heal') return e.hp < e.maxHp * 0.5;
      if (ab.kind === 'timestop' || ab.kind === 'timeskip') return d < 8 && !G().timestop && !G().timeskip;
      if (ab.kind === 'rewind') return e.hp < e.maxHp * 0.4 && e.hist && e.hist.length > 4;
      if (ab.kind === 'blink' || ab.kind === 'dash') return d > 3 && d < 10;
      if (MELEE[ab.kind]) return d < (ab.range || 1.8) + 0.8;
      if (ab.kind === 'buff' || ab.kind === 'summon') return d < 10;
      return d < (ab.range || 7) + 1;
    });
    if (!ok.length) return false;
    // предпочитаем сильные способности
    const ab = ok[Math.floor(Math.random() * ok.length)];
    e.cds[ab.name] = (ab.cd || 5) * (e.boss ? 1.1 : 1.4);
    e.standOut = !!e.stand;
    // замах-телеграф перед ударными и дальними приёмами
    const r = J.Cb ? J.Cb.aiCastTele(e, ab, tg) : A.use(e, ab, A.aimAt(e, tg));
    if (!r) e.cds[ab.name] = 0;
    return !!r;
  };

  // ---------- Стили игрока ----------
  // Хамон
  A.STYLES = {
    hamon: {
      name: 'Хамон',
      color: '#ffd84a',
      slots: [
        { name: 'Хамон Овердрайв', lvl: 1, cost: 18, cd: 1.6, desc: 'Удар солнечной энергией. ×3 урона по нежити.' },
        { name: 'Хамон-резак', lvl: 3, cost: 25, cd: 3, desc: 'Сжатая струя с хамоном. С клакерами — клакер-воллей.' },
        { name: 'Солнечный Жёлтый Овердрайв', lvl: 5, cost: 50, cd: 12, desc: 'Шквал ударов чистым хамоном.' },
      ],
    },
    vampire: {
      name: 'Вампиризм',
      color: '#c4283c',
      slots: [
        { name: 'Вампирская заморозка', lvl: 1, cost: 0, cd: 3, desc: 'Касание, замораживающее кровь врага.' },
        { name: 'Космический Потрошитель', lvl: 1, cost: 8, cd: 6, desc: 'Лучи жидкости под давлением из глаз.' },
        { name: 'Высасывание крови', lvl: 1, cost: 0, cd: 5, desc: 'Пьёшь кровь врага или прохожего. Лечит и утоляет жажду.' },
      ],
    },
    spin: {
      name: 'Вращение',
      color: '#3cc48a',
      slots: [
        { name: 'Бросок стального шара', lvl: 1, cost: 0, cd: 1.8, desc: 'Вращающийся шар возвращается в руку.' },
        { name: 'Врачебное вращение', lvl: 2, cost: 0, cd: 16, desc: 'Вращение мышц лечит раны и ускоряет.' },
        { name: 'Золотое вращение', lvl: 5, cost: 0, cd: 20, desc: 'Бесконечная энергия золотого сечения. Верхом — вдвое сильнее.' },
      ],
    },
    ultimate: {
      name: 'Совершенная форма',
      color: '#ff3a8a',
      slots: [
        { name: 'Сияющие клинки', lvl: 1, cost: 0, cd: 4, desc: 'Клинки из света вокруг тела.' },
        { name: 'Ультра-хамон', lvl: 1, cost: 0, cd: 8, desc: 'Хамон в тысячи раз сильнее.' },
        { name: 'Крылья', lvl: 1, cost: 0, cd: 25, desc: 'Полёт над морем и горами.' },
      ],
    },
  };

  A.useStyle = function (p, slot) {
    const style = p.style;
    if (!style) return false;
    const S = A.STYLES[style];
    const sl = S.slots[slot];
    if (!sl) return false;
    const lvl = style === 'hamon' ? p.hamon.lvl : style === 'spin' ? p.spin.lvl : 1;
    if (lvl < sl.lvl) {
      J.UI.toast(`«${sl.name}» откроется на ${sl.lvl} уровне (${S.name}).`, 'muted');
      return false;
    }
    const key = style + slot;
    if (p.cds[key] > 0) return false;
    const aim = J.P.aim(p, 8);
    let ok = false;
    const pw = J.P.stylePower(p, style);
    if (style === 'hamon') {
      if (p.breath < sl.cost) {
        J.UI.toast('Не хватает дыхания! Зажми V, чтобы восстановить хамон.', 'muted');
        return false;
      }
      const red = J.P.hasItem(p, 'red_stone') ? 1.8 : 1;
      if (slot === 0) ok = A.use(p, { kind: 'strike', dmg: (16 + p.hamon.lvl * 6) * red, range: p.hamon.lvl >= 6 ? 2.8 : 1.7, knock: 4, color: '#ffd84a', stun: 0.3 }, aim, { pw: 1, kind: 'hamon', noStand: true });
      else if (slot === 1) {
        if (J.P.hasItem(p, 'clackers')) ok = A.use(p, { kind: 'shoot', n: 2, spread: 20, dmg: (14 + p.hamon.lvl * 5) * red, speed: 12, range: 8, proj: 'orb', color: '#ffd84a', size: 0.24, homing: 4, pierce: 1 }, aim, { pw: 1, kind: 'hamon', noStand: true });
        else ok = A.use(p, { kind: 'shoot', n: 3, spread: 12, dmg: (12 + p.hamon.lvl * 4) * red, speed: 14, range: 9, proj: 'hamon', color: '#ffe46a', size: 0.16 }, aim, { pw: 1, kind: 'hamon', noStand: true });
      } else ok = A.use(p, { kind: 'rush', dmg: (5 + p.hamon.lvl) * red, dur: 1.3, range: 1.6 }, aim, { pw: 1, kind: 'hamon', noStand: true, cry: 'ХАМОН', key: { kb: 'Digit3', tc: '3' } });
      if (ok) {
        p.breath -= sl.cost;
        J.P.styleXp(p, 'hamon', 4);
        J.R3.burst(p.x, p.y, 1.2, '#ffd84a', 10, 2, 0.4);
      }
    } else if (style === 'vampire') {
      if (slot === 0) ok = A.use(p, { kind: 'strike', dmg: 24, range: 1.8, fx: { freeze: 1.5 }, color: '#a8e0ff', knock: 2 }, aim, { pw, noStand: true });
      else if (slot === 1) ok = A.use(p, { kind: 'beam', dmg: 42, range: 10, width: 0.18, color: '#ff4a6a' }, aim, { pw, noStand: true });
      else ok = A.vampDrain(p);
    } else if (style === 'spin') {
      if (!J.P.hasItem(p, 'steel_ball')) {
        J.UI.toast('Нужны стальные шары. Их даёт Джайро Цеппели.', 'muted');
        return false;
      }
      const mounted = !!p.mount;
      if (slot === 0) ok = A.use(p, { kind: 'shoot', n: 1, dmg: 16 + p.spin.lvl * 6, speed: 13, range: 10, proj: 'orb', color: '#c9ccd6', size: 0.24, pierce: 2 }, aim, { pw: 1, noStand: true });
      else if (slot === 1) {
        p.hp = Math.min(p.maxHp, p.hp + p.maxHp * 0.18);
        p.st.haste = 4;
        p.sv.haste = 0.4;
        J.R3.burst(p.x, p.y, 1, '#3cc48a', 16, 2, 0.6);
        ok = true;
      } else {
        ok = A.use(p, { kind: 'shoot', n: 1, dmg: (60 + p.spin.lvl * 10) * (mounted ? 2 : 1), speed: 9, range: 14, proj: 'spiral', color: '#ffd84a', size: 0.4, pierce: 99, homing: 2, fx: { stun: 1 } }, aim, { pw: 1, noStand: true });
        if (ok) J.R3.text(p.x, p.y, mounted ? 'ЗОЛОТОЕ ВРАЩЕНИЕ!' : 'ВРАЩЕНИЕ!', 'tbig', 1.2);
      }
      if (ok) J.P.styleXp(p, 'spin', 4);
    } else if (style === 'ultimate') {
      if (slot === 0) ok = A.use(p, { kind: 'nova', radius: 3.6, dmg: 65, color: '#ff8ad8' }, aim, { pw: 1, noStand: true });
      else if (slot === 1) ok = A.use(p, { kind: 'beam', dmg: 110, range: 13, width: 0.6, color: '#ffe46a' }, aim, { pw: 1, kind: 'hamon', noStand: true });
      else ok = A.use(p, { kind: 'buff', buff: 'fly', dur: 15, color: '#ff8ad8' }, aim, { noStand: true });
    }
    if (ok) {
      p.cds[key] = sl.cd;
      if (!p.channel && !(p.atk && !p.atk.done)) p.anim = { type: 'heavy', t: 0.3, max: 0.3 };
    }
    return ok;
  };

  A.vampDrain = function (p) {
    let best = null, bd = 1.8;
    for (const o of G().ents) {
      if (o.dead || o === p || o.summon || (o.team === 'player')) continue;
      const d = J.dist(p.x, p.y, o.x, o.y);
      if (d < bd) {
        bd = d;
        best = o;
      }
    }
    if (!best) {
      J.UI.toast('Рядом нет никого, чью кровь можно выпить.', 'muted');
      return false;
    }
    if (best.kind === 'civ') {
      best.st.sleep = 30;
      best.ai.fear = 0;
      best.drained = true;
      p.blood = Math.min(100, p.blood + 30);
      p.hp = Math.min(p.maxHp, p.hp + p.maxHp * 0.25);
      J.R3.text(best.x, best.y, 'ОБМОРОК', 'tred', 1);
      J.P.addFlag(p, 'drains', 1);
      J.Story && J.Story.onDrain(best);
    } else {
      if (best.undead) {
        J.UI.toast('Кровь нежити не насыщает.', 'muted');
        return false;
      }
      const d = J.hurt(best, 30 * J.P.stylePower(p, 'vampire'), p, { stun: 0.8 });
      p.hp = Math.min(p.maxHp, p.hp + d * 0.8);
      p.blood = Math.min(100, p.blood + 18);
    }
    J.R3.beam(p.x, p.y, best.x, best.y, 0.1, '#c4283c', 0.4);
    J.R3.burst(best.x, best.y, 1, '#c4283c', 14, 2, 0.6);
    return true;
  };
})();
