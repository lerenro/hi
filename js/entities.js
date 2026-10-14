'use strict';
// Сущности: движение, статусы, урон, ИИ, призывы, снаряды, поля, ловушки, подбираемые предметы.
(function () {
  let UID = 1;
  const G = () => J.G;

  // ---------- Базовая сущность ----------
  class Ent {
    constructor(o) {
      this.id = UID++;
      this.x = 0; this.y = 0; this.z = 0;
      this.vx = 0; this.vy = 0; this.face = 0;
      this.r = 0.3;
      this.team = 'neutral';
      this.kind = 'npc';
      this.hp = this.maxHp = 50;
      this.speed = 3.2;
      this.st = {}; // статусы: имя → оставшееся время
      this.sv = {}; // значения статусов
      this.cds = {};
      this.anim = null;
      this.hitFlash = 0;
      this.dead = false;
      this.deadT = 0;
      this.dmgMul = 1;
      this.armor = 0;
      this.crit = 0.04;
      this.xp = 10;
      this.ai = null;
      this.stand = null;
      this.standOut = false;
      this.se = this.seMax = 0;
      this.kx = 0; this.ky = 0; // отбрасывание
      Object.assign(this, o);
      if (o && o.maxHp && !o.hp) this.hp = o.maxHp;
    }
    get alive() {
      return !this.dead;
    }
    canAct() {
      const s = this.st;
      return !(s.stun > 0 || s.freeze > 0 || s.sleep > 0 || s.book > 0 || s.timefrozen);
    }
    canMove() {
      return this.canAct() && !(this.st.root > 0) && !(this.st.invuln > 0 && this.sv.invulnRoot);
    }
  }
  J.Ent = Ent;

  J.hostile = (a, b) => a !== b && ((a.team === 'player' && b.team === 'enemy') || (a.team === 'enemy' && b.team === 'player'));
  J.ownerOf = (e) => {
    let o = e;
    let k = 0;
    while (o && o.owner && k++ < 4) o = o.owner;
    return o;
  };

  // ---------- Модели мобов ----------
  const rndLook = (rand, over) => {
    const R = rand || J.R;
    const gender = R() < 0.5 ? 'm' : 'f';
    const hairs = gender === 'f' ? ['long', 'buns', 'short', 'long'] : ['short', 'spiky', 'short', 'bald', 'pompadour', 'cap', 'curls'];
    return Object.assign(
      {
        gender,
        skin: R.pick ? R.pick(J.SKINS) : J.SKINS[0],
        hair: R.pick(hairs),
        hairColor: R.pick(J.HAIR_COLORS.slice(0, 6)),
        top: R.pick(['#3a4a6a', '#6a3a3a', '#3a6a4a', '#d8d0c0', '#2a2a33', '#7a5a8a', '#c98a4a', '#4a7aa8', '#e8e8f0', '#a83a5a']),
        bottom: R.pick(['#2a2a38', '#3a3a4a', '#5a4a3a', '#1f2a44', '#6a6a7a']),
        build: R() < 0.25 ? 'slim' : R() < 0.85 ? 'normal' : 'muscular',
      },
      over || {}
    );
  };
  J.rndLook = rndLook;

  // Типы врагов
  J.MOBS = {
    thug: { name: 'Хулиган', hp: 45, dmg: 6, speed: 3.3, xp: 12, money: [5, 25], range: 1.2, rate: 1.0 },
    gangster: { name: 'Гангстер Пассионе', hp: 60, dmg: 9, speed: 3.4, xp: 18, money: [15, 50], gun: true, rate: 1.4, look: { top: '#2a2a33', bottom: '#2a2a33' } },
    guard: { name: 'Охранник', hp: 80, dmg: 10, speed: 3.2, xp: 22, money: [10, 30], gun: true, rate: 1.3, look: { top: '#4a5a7a', bottom: '#2a3448', hair: 'cap' } },
    bandit: { name: 'Бандит пустыни', hp: 70, dmg: 10, speed: 3.6, xp: 20, money: [10, 60], gun: true, rate: 1.5, look: { top: '#8a6a4a', bottom: '#5a4a3a' } },
    zombie: { name: 'Зомби', hp: 55, dmg: 8, speed: 2.5, xp: 15, money: [0, 8], undead: true, night: true, rate: 1.2, look: { skin: '#8aa07a', top: '#4a4a3a', bottom: '#3a3a30', eye: '#ff3a3a' } },
    vampire: { name: 'Вампир', hp: 150, dmg: 15, speed: 4.0, xp: 60, money: [20, 80], undead: true, vamp: true, rate: 1.0, look: { skin: '#e8e0f0', top: '#3a1a2a', bottom: '#1a1a22', eye: '#ff2a3a' }, spells: ['vfreeze', 'veyes'] },
    coyote: { name: 'Койот', model: 'coyote', color: '#b08a5a', hp: 35, dmg: 7, speed: 5, xp: 10, money: [0, 0], rate: 0.9 },
    wolf: { name: 'Волк', model: 'wolf', color: '#7a7a82', hp: 55, dmg: 9, speed: 5.2, xp: 14, money: [0, 0], rate: 0.9 },
    bear: { name: 'Медведь', model: 'bear', color: '#5a3a22', hp: 170, dmg: 18, speed: 3.6, xp: 45, money: [0, 0], rate: 1.6, r: 0.55 },
    croc: { name: 'Аллигатор', model: 'croc', color: '#4a6a3a', hp: 95, dmg: 14, speed: 2.8, xp: 25, money: [0, 0], rate: 1.5, r: 0.5 },
    scorpion: { name: 'Скорпион', model: 'scorpion', color: '#7a5a2a', hp: 25, dmg: 6, speed: 3.2, xp: 8, money: [0, 0], rate: 1.0, poison: 3 },
    sha_enemy: { name: 'Шиер Харт Атак', model: 'sha', color: '#7a7f8c', hp: 380, dmg: 24, speed: 4.4, xp: 160, money: [0, 0], rate: 1.3, armor: 0.45, r: 0.4, stand: true },
    pillar_minion: { name: 'Вампир-слуга', hp: 120, dmg: 13, speed: 3.8, xp: 40, money: [10, 40], undead: true, vamp: true, rate: 1.0, look: { skin: '#d8d0e0', top: '#5a2a2a', bottom: '#2a2a30', eye: '#ff2a3a' } },
  };

  // Стенд-юзер: случайное имя, стенд, уровень
  J.makeStandUser = function (x, y, lvl, standId, opts) {
    const R = J.R;
    const pool = J.standPool((s) => s.id !== 'achtung_baby' && s.id !== 'hey_ya');
    const sid = standId || J.pickW(R, pool).s.id;
    const reg = G().world.regionAt(x, y);
    const nm = J.NAMES[reg.lang] || J.NAMES.en;
    const name = (opts && opts.name) || R.pick(nm.f) + ' ' + R.pick(nm.l);
    const e = new Ent({
      kind: 'enemy', team: 'enemy', x, y, name,
      look: (opts && opts.look) || rndLook(R),
      maxHp: Math.round((110 + lvl * 28) * (opts && opts.hpMul ? opts.hpMul : 1)),
      speed: 3.6, dmg: 7 + lvl * 1.6, xp: 40 + lvl * 14, money: [30 + lvl * 10, 90 + lvl * 25],
      rate: 0.9, range: 1.6, dmgMul: 0.75 + lvl * 0.07,
      stand: { id: sid, lvl: Math.min(10, Math.max(1, Math.round(lvl * 0.8))) }, standOut: false, standUser: true,
      se: 999, seMax: 999,
    });
    e.ai = { aggro: 11, leash: 34, home: { x, y }, atk: 0, cast: 1 + R() * 2 };
    if (opts) Object.assign(e, opts.extra || {});
    e.hp = e.maxHp;
    return e;
  };

  J.makeMob = function (type, x, y, lvl) {
    const d = J.MOBS[type];
    const R = J.R;
    const sc = 1 + (lvl - 1) * 0.16;
    const e = new Ent({
      kind: 'enemy', team: 'enemy', x, y, name: d.name, mobType: type,
      maxHp: Math.round(d.hp * sc), speed: d.speed, dmg: d.dmg * (1 + (lvl - 1) * 0.1), xp: Math.round(d.xp * sc),
      money: d.money, rate: d.rate || 1, range: d.range || 1.2, gun: d.gun, undead: d.undead, vamp: d.vamp, night: d.night,
      model: d.model, color: d.color, r: d.r || 0.3, poisonHit: d.poison, spells: d.spells, armor: d.armor || 0, standSummon: !!d.stand,
    });
    if (!d.model) e.look = rndLook(R, d.look);
    e.ai = { aggro: d.model ? 9 : 10, leash: 30, home: { x, y }, atk: R() * 0.5, cast: 2 + R() * 2 };
    e.hp = e.maxHp;
    return e;
  };

  J.makeCivilian = function (x, y, reg) {
    const R = J.R;
    const nm = J.NAMES[reg.lang] || J.NAMES.en;
    const look = rndLook(R);
    const e = new Ent({
      kind: 'civ', team: 'neutral', x, y,
      name: (look.gender === 'f' ? R.pick(nm.f.filter((n, i) => i % 2 === 1)) || R.pick(nm.f) : R.pick(nm.f)) + (R() < 0.5 ? ' ' + R.pick(nm.l) : ''),
      look, maxHp: 40, speed: 1.6 + R() * 0.6,
      region: reg.id,
    });
    e.ai = { civ: true, wander: 0, tx: x, ty: y, fear: 0 };
    // скрытый стенд-юзер
    if (R() < 0.05) e.hiddenStand = true;
    return e;
  };

  // ---------- Добавление/удаление ----------
  J.addEnt = function (e) {
    G().ents.push(e);
    return e;
  };

  // ---------- Коллизии ----------
  const moveOpts = (e) => {
    const s = e.st;
    return {
      water: !!e.waterWalk,
      fly: s.fly > 0 || s.void > 0,
      ghost: s.ghost > 0,
    };
  };
  const blocked = (x, y, r, o) => {
    const w = G().world;
    return w.solid(x - r, y - r, o) || w.solid(x + r, y - r, o) || w.solid(x - r, y + r, o) || w.solid(x + r, y + r, o);
  };
  J.blocked = blocked;
  J.moveEnt = function (e, dx, dy) {
    const o = moveOpts(e);
    const r = e.r * 0.9;
    let moved = false;
    if (dx) {
      if (!blocked(e.x + dx, e.y, r, o)) {
        e.x += dx;
        moved = true;
      }
    }
    if (dy) {
      if (!blocked(e.x, e.y + dy, r, o)) {
        e.y += dy;
        moved = true;
      }
    }
    // если застряли внутри стены (после призрачного рывка) — выталкиваем
    if (!o.ghost && !o.fly && blocked(e.x, e.y, r * 0.5, o)) {
      const p = G().world.randomWalkable(e.x, e.y, 3);
      if (p && !e.st.ghost) {
        e.x = p.x;
        e.y = p.y;
      }
    }
    return moved;
  };

  // ---------- Урон ----------
  J.hurt = function (t, amount, src, opt) {
    opt = opt || {};
    if (!t || t.dead || amount <= 0) return 0;
    const g = G();
    const so = src ? J.ownerOf(src) : null;
    if (t.st.invuln > 0 || t.st.void > 0 || t.immortal) {
      // удар пришёлся на неуязвимость рывка — идеальное уклонение
      if (t.dash && t.dash.dodge && so && so !== t && !opt.dot && J.Cb) J.Cb.perfectDodge(t, so);
      else if (!opt.dot && !t.dash && Math.random() < 0.3 && !(t._nuT > g.t)) {
        t._nuT = g.t + 0.6;
        J.R3.text(t.x, t.y, 'НЕУЯЗВИМ', 'tmiss', 0.6);
      }
      return 0;
    }
    // кадры неуязвимости при подъёме с земли
    if (t.st.gup > 0 && !opt.pierceDef && !opt.dot) return 0;
    if (t.kind === 'civ') return 0;
    // Реквием: возврат к нулю
    if (t.st.zero > 0 && so && so !== t && !opt.dot) {
      so.st.stun = Math.max(so.st.stun || 0, 1.5);
      J.R3.text(t.x, t.y, 'ВОЗВРАТ К НУЛЮ', 'tgold', 1);
      J.hurt(so, amount * 0.6, null, { dot: true, kind: 'pure' });
      return 0;
    }
    // Поезд Любви — несчастье уходит к другим
    if (t.st.lovetrain > 0 && !opt.dot) {
      const other = J.nearestHostile(t, 10);
      if (other) {
        J.R3.beam(t.x, t.y, other.x, other.y, 0.25, '#ffe9a8', 0.25);
        J.hurt(other, amount, null, { dot: true, kind: 'pure' });
      }
      return 0;
    }
    // Эпитафия — уклонение
    if (t.st.dodge > 0 && !opt.dot && !(t.cds._dodge > 0)) {
      t.cds._dodge = 0.7;
      const a = Math.random() * J.TAU;
      J.moveEnt(t, Math.cos(a) * 1.4, Math.sin(a) * 1.4);
      J.R3.text(t.x, t.y, 'ЭПИТАФИЯ', 'tred', 0.8);
      return 0;
    }
    // блок и парирование
    let blocked = false;
    if (J.Cb && !opt.dot) {
      const r = J.Cb.preHurt(t, amount, src, opt);
      if (r < 0) return 0;
      if (r !== amount) {
        blocked = true;
        amount = r;
      }
    }
    let mul = 1;
    const kind = opt.kind || 'phys';
    if (kind === 'hamon') {
      if (t.undead || t.vamp || t.pillar) mul *= t.pillar ? 2.5 : 3.2;
      else mul *= 0.9;
      if (t.isPlayer && t.vampire) mul *= 3;
      if (!opt.rushTick || Math.random() < 0.3) J.R3.burst(t.x, t.y, 1.2, '#ffd84a', opt.rushTick ? 3 : 8, 3, 0.4);
    }
    if (kind === 'sun' && !(t.undead || t.vamp || t.pillar || (t.isPlayer && t.vampire && !t.ultimate))) return 0;
    if (kind === 'fire' && (t.vamp || t.undead)) mul *= 1.4;
    if (t.pillar && kind !== 'hamon' && kind !== 'sun' && kind !== 'pure') mul *= 0.3;
    if (t.st.soft > 0) mul *= 1.5;
    if (t.st.book > 0) mul *= 1.5;
    if (t.st.mark2 > 0) mul *= 1.2;
    let armor = t.armor || 0;
    if (t.st.armor > 0) armor += t.sv.armor || 0.4;
    if (t.stand && t.standOut) armor += J.rankNum(J.STANDS[t.stand.id].st.dur) * 0.045;
    if (t.isPlayer) armor += J.P.armorBonus(t);
    armor = Math.min(0.8, armor);
    let crit = false;
    if (so && !opt.dot && !blocked) {
      let cc = so.crit || 0.04;
      if (so.st.luck > 0) cc += so.sv.luck || 0.3;
      if (so.isPlayer) cc += J.P.critBonus(so);
      if (opt.crit || Math.random() < cc) {
        crit = true;
        mul *= 1.8;
      }
    }
    if (so && so.st.power > 0) mul *= 1 + (so.sv.power || 0.4);
    if (so && so.st.dino > 0) mul *= 1 + (so.sv.dino || 0.5);
    if (so && so.st.age > 0) mul *= 0.65;
    if (opt.pierceDef) armor = 0;
    const dmg = Math.max(1, amount * mul * (1 - armor));
    t.hp -= dmg;
    if (!blocked) t.hitFlash = 0.12;
    if (t.st.sleep > 0) t.st.sleep = 0;
    if (t.ai && so && so !== t && J.hostile(t, so)) t.ai.target = so;
    if (t.ai && t.ai.civ) t.ai.fear = 6;
    if (!opt.silent && !blocked) {
      if (J.Fx && J.Fx.ready) J.Fx.dmgNum(t, dmg, crit, opt.rushTick);
      else {
        const near = g.player && J.dist(t.x, t.y, g.player.x, g.player.y) < 30;
        if (near) J.R3.text(t.x, t.y, (crit ? '!' : '') + Math.round(dmg), crit ? 'tcrit' : t.isPlayer ? 'thurt' : 'tdmg', 0.8, 2.1);
      }
    }
    if (J.Cb) J.Cb.postHurt(t, dmg, so, src, opt, crit, blocked);
    else {
      if (opt.knock && !t.boss) {
        const a = opt.ang !== undefined ? opt.ang : so ? Math.atan2(t.y - so.y, t.x - so.x) : 0;
        t.kx += Math.cos(a) * opt.knock;
        t.ky += Math.sin(a) * opt.knock;
      }
      if (opt.stun) t.st.stun = Math.max(t.st.stun || 0, t.boss ? opt.stun * 0.4 : opt.stun);
    }
    if (opt.fx && !blocked) J.applyFx(t, opt.fx, so);
    if (J.Fx && !blocked) J.Fx.onHit(t, src, dmg, opt, crit, t.hp <= 0, 'hit');
    if (t.isPlayer) {
      if (!t.stand && so && (so.stand || so.standSummon || (src && src.standProj)) && !(g._invisT > 0)) {
        g._invisT = 40;
        J.UI.toast('Тебя бьёт что-то невидимое! Без своего стенда чужие стенды не видны.', 'red');
      }
      J.UI && J.UI.hurtFlash(dmg / t.maxHp);
    }
    if (so && so.isPlayer && so.stand && so.standOut) J.P.standXp(so, dmg * 0.25);
    if (t.hp <= 0) J.kill(t, so);
    return dmg;
  };

  J.applyFx = function (t, fx, src) {
    const resist = t.boss ? 0.45 : 1;
    for (const k in fx) {
      const v = fx[k] * resist;
      if (k === 'burn' || k === 'poison' || k === 'bleed' || k === 'age' || k === 'infinite') {
        t.st[k] = Math.max(t.st[k] || 0, v);
        t.sv[k + 'Src'] = src;
      } else if (k === 'freeze' || k === 'stun' || k === 'sleep' || k === 'root' || k === 'slow' || k === 'silence' || k === 'heavy') {
        t.st[k] = Math.max(t.st[k] || 0, v);
      }
    }
  };

  J.kill = function (t, src) {
    if (t.dead) return;
    t.dead = true;
    t.deadT = 0;
    t.hp = 0;
    t.standOut = false;
    const g = G();
    if (t.isPlayer) {
      J.Game.onPlayerDeath();
      return;
    }
    const pl = g.player;
    const killer = src ? J.ownerOf(src) : null;
    t.guard = false;
    t.atk = null;
    t.channel = null;
    if (J.Fx) J.Fx.onKill(t, killer);
    if (t.team === 'enemy' || t.origTeam === 'enemy') {
      if (killer && (killer.isPlayer || killer.team === 'player')) {
        J.P.gainXp(pl, t.xp || 10);
        if (t.money) {
          const m = Math.round(t.money[0] + Math.random() * (t.money[1] - t.money[0]));
          if (m > 0) J.spawnPickup(t.x, t.y, 'money', m);
        }
        if (Math.random() < 0.18 && !t.model) J.spawnPickup(t.x + 0.4, t.y, J.R.pick(['bandage', 'onigiri', 'water', 'coffee', 'sandwich']), 1);
        // диск из Белой Змеи
        if (t.stand && t.st.disc > 0) J.spawnPickup(t.x, t.y + 0.4, 'stand_disc', 1, { stand: t.stand.id });
        pl.kills = (pl.kills || 0) + 1;
      }
      if (t.stand) J.P.seeStand(pl, t.stand.id);
    }
    J.Story && J.Story.onKill(t, killer);
  };

  J.nearestHostile = function (e, range, cone, ang) {
    let best = null, bd = range;
    for (const o of G().ents) {
      if (o.dead || !J.hostile(e, o)) continue;
      if (o.st.invis > 0 && o.team === 'enemy' && !(G().reveal > 0)) continue;
      const d = J.dist(e.x, e.y, o.x, o.y) - o.r;
      if (d > bd) continue;
      if (cone) {
        const a = Math.atan2(o.y - e.y, o.x - e.x);
        if (Math.abs(J.angDiff(ang, a)) > cone) continue;
      }
      bd = d;
      best = o;
    }
    return best;
  };

  // Урон по дуге перед сущностью
  J.hitArc = function (e, ang, range, arc, dmg, opt) {
    let n = 0;
    for (const o of G().ents) {
      if (o.dead || !J.hostile(e, o)) continue;
      const d = J.dist(e.x, e.y, o.x, o.y) - o.r;
      if (d > range) continue;
      const a = Math.atan2(o.y - e.y, o.x - e.x);
      if (d > 0.5 && Math.abs(J.angDiff(ang, a)) > arc / 2) continue;
      J.hurt(o, dmg, e, Object.assign({ ang: a }, opt));
      n++;
    }
    return n;
  };
  J.hitCircle = function (e, x, y, radius, dmg, opt) {
    let n = 0;
    for (const o of G().ents) {
      if (o.dead || !J.hostile(e, o)) continue;
      const d = J.dist(x, y, o.x, o.y);
      if (d > radius + o.r) continue;
      J.hurt(o, dmg, e, Object.assign({ ang: Math.atan2(o.y - y, o.x - x) }, opt));
      n++;
    }
    return n;
  };

  // ---------- Обновление статусов ----------
  const DOT_FX = { burn: ['#ff7b1c', 0.05], poison: ['#9ad94a', 0.04], bleed: ['#c4283c', 0.045], age: ['#9b7ad1', 0.03], infinite: ['#ffe14a', 0.06] };
  J.updateStatus = function (e, dt) {
    const s = e.st;
    for (const k in s) {
      if (k === 'timefrozen') continue;
      if (s[k] > 0) {
        s[k] -= dt;
        if (s[k] <= 0) {
          s[k] = 0;
          J.onStatusEnd(e, k);
        }
      }
    }
    // периодический урон
    e._dotT = (e._dotT || 0) + dt;
    if (e._dotT >= 0.5) {
      e._dotT = 0;
      for (const k in DOT_FX) {
        if (s[k] > 0) {
          const [c, pct] = DOT_FX[k];
          const base = k === 'infinite' ? Math.max(6, e.maxHp * pct) : Math.max(2, Math.min(18, e.maxHp * pct));
          J.hurt(e, base, e.sv[k + 'Src'] || null, { dot: true, kind: k === 'burn' ? 'fire' : 'pure', silent: false });
          J.R3.burst(e.x, e.y, 1.0, c, 3, 1, 0.4);
        }
      }
      if (s.drain > 0 && e.sv.drainSrc && !e.sv.drainSrc.dead) {
        const d = J.hurt(e, Math.max(4, e.maxHp * 0.035), e.sv.drainSrc, { dot: true });
        e.sv.drainSrc.hp = Math.min(e.sv.drainSrc.maxHp, e.sv.drainSrc.hp + d);
      }
      if (s.regen > 0) e.hp = Math.min(e.maxHp, e.hp + e.maxHp * 0.01 * (e.sv.regen || 3));
    }
    if (e.hitFlash > 0) e.hitFlash -= dt;
    for (const k in e.cds) if (e.cds[k] > 0) e.cds[k] -= dt;
  };
  J.onStatusEnd = function (e, k) {
    if (k === 'charm' && e.origTeam) {
      e.team = e.origTeam;
      e.origTeam = null;
      if (e.ai) e.ai.target = null;
    }
    if (k === 'mark2' && e.sv.mark2Src) {
      J.R3.flash(e.x, e.y, 1.4, '#ff5fa2');
      J.hurt(e, 40 * (e.sv.mark2Pw || 1), e.sv.mark2Src, { stun: 0.8 });
    }
    if (k === 'heaven' && e.isPlayer) G().timeAccel = 0;
    if (k === 'invuln') e.sv.invulnRoot = false;
    if (k === 'mark') e.sv.markBy = null;
  };

  // ---------- ИИ ----------
  J.updateAI = function (e, dt) {
    const g = G();
    const ai = e.ai;
    if (!ai) return;
    if (ai.civ) return civAI(e, dt);
    if (e.summon) return summonAI(e, dt);
    // день/ночь: зомби и вампиры горят на солнце
    if ((e.undead || e.vamp) && g.isSunny && !e.inShade) {
      J.hurt(e, e.maxHp * 0.12 * dt * 2, null, { dot: true, kind: 'sun', silent: true });
      if (Math.random() < 0.4) J.R3.burst(e.x, e.y, 1.2, '#ffb03a', 2, 1, 0.5);
    }
    let tg = ai.target;
    if (tg && (tg.dead || !J.hostile(e, tg) || (tg.st.invis > 0 && !(g.reveal > 0)) || (tg.st.void > 0))) tg = ai.target = null;
    if (ai.blind > 0) {
      ai.blind -= dt;
      tg = null;
    }
    if (!tg) {
      tg = J.nearestHostile(e, ai.aggro);
      // приманки привлекают внимание
      if (tg) {
        for (const o of g.ents) if (o.taunt && !o.dead && J.hostile(e, o) && J.dist(e.x, e.y, o.x, o.y) < ai.aggro) { tg = o; break; }
      }
      ai.target = tg;
      if (tg && e.boss && !ai.announced) {
        ai.announced = true;
        J.Story && J.Story.bossAggro(e);
      }
    }
    const spd = e.speed * speedMul(e);
    if (!tg) {
      // возврат домой / блуждание
      const dh = J.dist(e.x, e.y, ai.home.x, ai.home.y);
      if (dh > 3) steer(e, ai.home.x, ai.home.y, spd * 0.6, dt);
      else {
        ai.wt = (ai.wt || 0) - dt;
        if (ai.wt <= 0) {
          ai.wt = 2 + Math.random() * 3;
          ai.wx = ai.home.x + (Math.random() - 0.5) * 6;
          ai.wy = ai.home.y + (Math.random() - 0.5) * 6;
        }
        steer(e, ai.wx, ai.wy, spd * 0.35, dt);
      }
      if (e.standOut && Math.random() < dt * 0.5) e.standOut = false;
      return;
    }
    const d = J.dist(e.x, e.y, tg.x, tg.y);
    if (J.dist(e.x, e.y, ai.home.x, ai.home.y) > ai.leash && !e.boss) {
      ai.target = null;
      e.guard = false;
      return;
    }
    const ang = Math.atan2(tg.y - e.y, tg.x - e.x);
    e.face = ang;
    if (e.stand) e.standOut = true;
    // бой: дистанция, обход, блок, замахи, способности (combat.js)
    J.Cb.fight(e, tg, d, ang, dt);
  };

  function speedMul(e) {
    const s = e.st;
    let m = 1;
    if (s.slow > 0) m *= 0.5;
    if (s.heavy > 0) m *= 0.22;
    if (s.age > 0) m *= 0.6;
    if (s.haste > 0) m *= 1 + (e.sv.haste || 0.5);
    if (s.heaven > 0) m *= 2.4;
    if (s.dino > 0) m *= 1.3;
    return m;
  }
  J.speedMul = speedMul;

  function steer(e, tx, ty, spd, dt) {
    const dx = tx - e.x, dy = ty - e.y;
    const L = Math.hypot(dx, dy);
    if (L < 0.05) {
      e.vx = e.vy = 0;
      return;
    }
    let ux = dx / L, uy = dy / L;
    const w = G().world;
    const ts = w.speedAt(e.x, e.y);
    const step = spd * ts * dt;
    const ox = e.x, oy = e.y;
    J.moveEnt(e, ux * step, uy * step);
    // застряли — пробуем обойти
    if (Math.abs(e.x - ox) + Math.abs(e.y - oy) < step * 0.3) {
      e.ai.stuck = (e.ai.stuck || 0) + dt;
      const side = e.ai.side || (e.ai.side = Math.random() < 0.5 ? 1 : -1);
      J.moveEnt(e, -uy * side * step, ux * side * step);
      if (e.ai.stuck > 1.2) {
        e.ai.side = -side;
        e.ai.stuck = 0;
      }
    } else e.ai.stuck = 0;
    e.vx = (e.x - ox) / dt;
    e.vy = (e.y - oy) / dt;
    if (L > 0.3) e.face = Math.atan2(uy, ux);
  }
  J.steer = steer;

  function civAI(e, dt) {
    const ai = e.ai;
    const g = G();
    if (ai.still) {
      e.vx = e.vy = 0;
      if (J.dist(e.x, e.y, g.player.x, g.player.y) < 6) e.face = Math.atan2(g.player.y - e.y, g.player.x - e.x);
      return;
    }
    if (ai.fear > 0) {
      ai.fear -= dt;
      const p = g.player;
      steer(e, e.x + (e.x - p.x), e.y + (e.y - p.y), e.speed * 2.2, dt);
      if (Math.random() < dt * 0.6) J.R3.text(e.x, e.y, J.R.pick(['Аааа!', 'Помогите!', 'Бежим!']), 'tsay', 0.9);
      return;
    }
    if (ai.talk > 0) {
      ai.talk -= dt;
      e.vx = e.vy = 0;
      e.face = Math.atan2(g.player.y - e.y, g.player.x - e.x);
      return;
    }
    ai.wander -= dt;
    if (ai.wander <= 0) {
      ai.wander = 3 + Math.random() * 6;
      const p = g.world.randomWalkable(e.x, e.y, 8, J.R, { street: true });
      if (p) {
        ai.tx = p.x;
        ai.ty = p.y;
      }
      if (Math.random() < 0.3) {
        ai.tx = e.x;
        ai.ty = e.y;
      }
    }
    steer(e, ai.tx, ai.ty, e.speed, dt);
  }

  function summonAI(e, dt) {
    const g = G();
    const ai = e.ai;
    e.life -= dt;
    if (e.life <= 0) {
      e.dead = true;
      e.vanish = true;
      J.R3.burst(e.x, e.y, 0.8, e.color || '#ffffff', 8, 2, 0.4);
      return;
    }
    const own = e.owner;
    if (e.decoy) {
      // приманка бродит рядом
      if (own) steer(e, own.x + Math.cos(g.t + e.id) * 3, own.y + Math.sin(g.t + e.id) * 3, 3, dt);
      return;
    }
    let tg = ai.target;
    if (!tg || tg.dead || !J.hostile(e, tg)) tg = ai.target = J.nearestHostile(e, 10);
    const spd = e.speed * speedMul(e);
    if (!tg) {
      if (own && J.dist(e.x, e.y, own.x, own.y) > 2.5) steer(e, own.x, own.y, spd, dt);
      else e.vx = e.vy = 0;
      return;
    }
    const d = J.dist(e.x, e.y, tg.x, tg.y);
    const ang = Math.atan2(tg.y - e.y, tg.x - e.x);
    e.face = ang;
    if (e.sha) {
      steer(e, tg.x, tg.y, spd, dt);
      if (d < 1.0) {
        J.R3.flash(e.x, e.y, 2.4, '#ffb03a');
        J.R3.ring(e.x, e.y, 2.6, '#ff6a2a');
        J.R3.text(e.x, e.y, 'КОТЧИ ВО МИРО!', 'tcry', 1.1);
        J.hitCircle(e, e.x, e.y, 2.2, e.dmg, { knock: 6, kind: 'fire', fx: { burn: 3 } });
        e.dead = true;
        e.vanish = true;
      }
      return;
    }
    if (e.ranged) {
      if (d > 6) steer(e, tg.x, tg.y, spd, dt);
      ai.atk = (ai.atk || 0) - dt;
      if (ai.atk <= 0 && d < 9) {
        ai.atk = 0.9;
        J.spawnProj(e, { ang, speed: 13, dmg: e.dmg, range: 10, shape: 'bullet', color: '#ffe066', size: 0.1 });
      }
      return;
    }
    if (d > 0.9 + tg.r) steer(e, tg.x, tg.y, spd, dt);
    ai.atk = (ai.atk || 0) - dt;
    if (ai.atk <= 0 && d < 1.2 + tg.r) {
      ai.atk = e.rate || 0.8;
      e.anim = { type: 'punch', t: 0.25, max: 0.25 };
      J.hurt(tg, e.dmg, e, { knock: 1.5, ang, fx: e.hitFx, melee: true });
    }
  }

  // ---------- Призывы ----------
  const SUMMONS = {
    decoy: { hp: 40, speed: 3, dmg: 0, copy: true, decoy: true },
    clone: { hp: 90, speed: 4, dmg: 12, copy: true },
    frog: { model: 'frog', color: '#5ac85a', hp: 30, speed: 4.5, dmg: 7, reflect: true },
    bug: { model: 'bug', color: '#d9b23a', hp: 10, speed: 6, dmg: 4, hitFx: { poison: 2 } },
    soldier: { look: { skin: '#e8c8a0', top: '#556b2f', bottom: '#556b2f', hair: 'cap', hairColor: '#556b2f' }, scale: 0.45, hp: 18, speed: 3, dmg: 5, ranged: true },
    sha: { model: 'sha', color: '#7a7f8c', hp: 999, speed: 5.5, dmg: 55, sha: true, immortal: true },
    zombie_ally: { look: { skin: '#8aa07a', top: '#4a4a3a', bottom: '#3a3a30', eye: '#ff3a3a' }, hp: 50, speed: 2.8, dmg: 9 },
    raptor: { model: 'raptor', color: '#6aa84f', hp: 55, speed: 5.5, dmg: 11, hitFx: { bleed: 2 } },
    babyface: { look: { skin: '#5a6fd8', top: '#5a6fd8', bottom: '#3a4fb8', hair: 'bald', hairColor: '#ffffff' }, hp: 70, speed: 4, dmg: 12, hitFx: { stun: 0.3 } },
  };
  J.spawnSummon = function (owner, type, n, life, pw) {
    const d = SUMMONS[type];
    if (!d) return;
    for (let i = 0; i < n; i++) {
      const a = owner.face + Math.PI + (i - (n - 1) / 2) * 0.7;
      let x = owner.x + Math.cos(a) * 1.2, y = owner.y + Math.sin(a) * 1.2;
      if (J.blocked(x, y, 0.25, {})) {
        x = owner.x;
        y = owner.y;
      }
      const e = new Ent({
        kind: 'summon', summon: true, team: owner.team, owner, x, y, name: '',
        maxHp: Math.round(d.hp * (0.7 + pw * 0.4)), speed: d.speed, dmg: d.dmg * pw, life,
        model: d.model, color: d.color, decoy: d.decoy, taunt: d.decoy, sha: d.sha, ranged: d.ranged, hitFx: d.hitFx,
        reflectDmg: d.reflect, immortal: d.immortal, r: 0.25, scale: d.scale,
        standSummon: !!owner.stand && ['sha', 'bug', 'soldier', 'decoy', 'clone', 'babyface'].includes(type),
      });
      if (d.copy) {
        e.look = Object.assign({}, owner.look);
        e.ghostly = true;
      } else if (d.look) e.look = Object.assign({ gender: 'm', hair: 'short', hairColor: '#333' }, d.look);
      e.hp = e.maxHp;
      e.ai = { atk: 0 };
      J.addEnt(e);
      J.R3.burst(x, y, 0.8, d.color || '#ffffff', 10, 2, 0.5);
    }
  };

  // ---------- Снаряды ----------
  J.spawnProj = function (owner, o) {
    const g = G();
    const sp = o.speed || 10;
    const p = {
      x: owner.x + Math.cos(o.ang) * 0.5, y: owner.y + Math.sin(o.ang) * 0.5,
      vx: Math.cos(o.ang) * sp, vy: Math.sin(o.ang) * sp, speed: sp,
      life: (o.range || 10) / sp, dmg: o.dmg || 5, team: owner.team, owner,
      shape: o.shape || 'orb', color: o.color || '#ffffff', size: o.size || 0.2,
      pierce: o.pierce || 0, homing: o.homing || 0, fx: o.fx, explode: o.explode, cloud: o.cloud,
      kind: o.kind || 'phys', ghost: o.ghost, hits: new Set(), h: o.h || 1.0, returns: o.returns, standProj: !!o.stand,
    };
    if (o.x !== undefined) {
      p.x = o.x;
      p.y = o.y;
    }
    g.projs.push(p);
    return p;
  };

  J.updateProjs = function (dt) {
    const g = G();
    const w = g.world;
    const out = [];
    for (const p of g.projs) {
      if (g.timestop && (p.owner !== g.timestop.by || (p.tsAge = (p.tsAge || 0) + dt) > 0.12)) {
        // ножи ДИО замирают в воздухе, едва покинув руку
        out.push(p);
        J.R3.updateProj(p, dt);
        continue;
      }
      p.tsAge = 0;
      p.life -= dt;
      if (p.life <= 0) {
        if (p.explode) explodeProj(p);
        J.R3.dropProj(p);
        continue;
      }
      if (p.homing) {
        const tg = J.nearestHostile(p, 8, 1.2, Math.atan2(p.vy, p.vx));
        if (tg) {
          const cur = Math.atan2(p.vy, p.vx);
          const want = Math.atan2(tg.y - p.y, tg.x - p.x);
          const na = cur + J.clamp(J.angDiff(cur, want), -p.homing * dt, p.homing * dt);
          p.vx = Math.cos(na) * p.speed;
          p.vy = Math.sin(na) * p.speed;
        }
      }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      if (!p.ghost && w.solid(p.x, p.y, { water: true })) {
        if (p.explode) explodeProj(p);
        else J.R3.burst(p.x, p.y, p.h, p.color, 4, 2, 0.3);
        J.R3.dropProj(p);
        continue;
      }
      let alive = true;
      for (const o of g.ents) {
        if (o.dead || p.hits.has(o.id)) continue;
        if (!J.hostile(p, o)) continue;
        if (J.dist(p.x, p.y, o.x, o.y) > o.r + p.size + 0.15) continue;
        // отражение (Крафт Ворк, Белый Альбом)
        if (o.st.reflect > 0) {
          p.vx = -p.vx;
          p.vy = -p.vy;
          p.team = o.team;
          p.owner = o;
          p.hits.clear();
          p.life = Math.max(p.life, 1);
          J.R3.text(o.x, o.y, 'ОТРАЖЕНО', 'tgold', 0.6);
          break;
        }
        p.hits.add(o.id);
        if (p.explode) {
          explodeProj(p);
          alive = false;
          break;
        }
        J.hurt(o, p.dmg, p.owner, { fx: p.fx, kind: p.kind, knock: 1.2, ang: Math.atan2(p.vy, p.vx) });
        if (o.reflectDmg && p.owner && !p.owner.dead) J.hurt(p.owner, p.dmg * 0.5, null, { dot: true });
        if (p.cloud) J.addField(p.owner, { x: p.x, y: p.y, radius: p.cloud.radius, dur: p.cloud.dur, dps: p.cloud.dps, color: p.color, fx: { poison: 3 } });
        if (p.pierce-- <= 0) {
          alive = false;
          break;
        }
      }
      if (!alive) {
        J.R3.dropProj(p);
        continue;
      }
      J.R3.updateProj(p, dt);
      out.push(p);
    }
    g.projs = out;
  };

  function explodeProj(p) {
    const r = p.explode;
    J.R3.flash(p.x, p.y, r, p.color, 0.35);
    J.R3.ring(p.x, p.y, r * 1.1, p.color);
    J.R3.burst(p.x, p.y, 1, p.color, 16, 4, 0.5);
    J.hitCircle(p, p.x, p.y, r, p.dmg, { fx: p.fx, kind: p.kind === 'phys' ? 'fire' : p.kind, knock: 3 });
    if (p.cloud) J.addField(p.owner, { x: p.x, y: p.y, radius: p.cloud.radius, dur: p.cloud.dur, dps: p.cloud.dps, color: p.color, fx: { poison: 3 } });
  }

  // ---------- Поля ----------
  J.addField = function (owner, f) {
    const g = G();
    f.owner = owner;
    f.team = owner.team;
    f.t = 0;
    f.tick = 0;
    f.mesh = J.R3.fieldMesh(f);
    g.fields.push(f);
    return f;
  };
  J.updateFields = function (dt) {
    const g = G();
    g.fields = g.fields.filter((f) => {
      f.t += dt;
      if (f.follow && f.owner && !f.owner.dead) {
        f.x = f.owner.x;
        f.y = f.owner.y;
      }
      f.mesh.position.set(f.x, g.world.groundY(f.x, f.y) + 0.8, f.y);
      f.mesh.rotation.y += dt * 0.6;
      if (Math.random() < dt * 20) J.R3.burst(f.x + (Math.random() - 0.5) * f.radius * 1.6, f.y + (Math.random() - 0.5) * f.radius * 1.6, 0.4, f.color, 1, 0.3, 0.8, 1);
      if (f.t >= f.dur) {
        J.R3.removeMesh(f.mesh);
        return false;
      }
      if (g.timestop && f.owner !== g.timestop.by) return true;
      f.tick += dt;
      if (f.tick >= 0.5) {
        f.tick = 0;
        for (const o of g.ents) {
          if (o.dead) continue;
          const d = J.dist(o.x, o.y, f.x, f.y);
          if (d > f.radius) continue;
          if (J.hostile(f, o)) {
            let dps = f.dps;
            if (f.calamity) {
              // бедствие: страдают преследователи
              const tox = f.owner.x - o.x, toy = f.owner.y - o.y;
              const mv = Math.hypot(o.vx || 0, o.vy || 0);
              const toward = mv > 0.3 ? ((o.vx || 0) * tox + (o.vy || 0) * toy) / (mv * (Math.hypot(tox, toy) || 1)) : 0;
              dps = toward > 0.3 ? f.dps * 2.2 : f.dps * 0.3;
              if (toward > 0.3 && Math.random() < 0.4) J.R3.text(o.x, o.y, J.R.pick(['Бедствие!', 'Не преследуй...', 'Несчастье!']), 'tred', 0.8);
            }
            J.hurt(o, dps * 0.5, f.owner, { fx: f.fx, dot: true });
          } else if (f.hurtSelf && o === f.owner) {
            J.hurt(o, f.dps * 0.5 * f.hurtSelf, null, { dot: true, kind: 'pure' });
          }
        }
      }
      return true;
    });
  };

  // ---------- Ловушки ----------
  J.addTrap = function (owner, t) {
    t.owner = owner;
    t.team = owner.team;
    t.mesh = J.R3.trapMesh(t);
    G().traps.push(t);
  };
  J.updateTraps = function (dt) {
    const g = G();
    g.traps = g.traps.filter((t) => {
      t.life -= dt;
      const gy = g.world.groundY(t.x, t.y);
      t.mesh.position.set(t.x, gy + 0.4 + Math.sin(g.t * 3 + t.x) * 0.1, t.y);
      t.mesh.rotation.y += dt * 3;
      if (t.life <= 0) {
        J.R3.removeMesh(t.mesh);
        return false;
      }
      for (const o of g.ents) {
        if (o.dead || !J.hostile(t, o)) continue;
        if (J.dist(o.x, o.y, t.x, t.y) < 0.9 + o.r) {
          J.R3.flash(t.x, t.y, 1.6, t.color);
          J.R3.ring(t.x, t.y, 1.8, t.color);
          J.hitCircle(t, t.x, t.y, 1.6, t.dmg, { fx: t.fx, knock: 3 });
          J.R3.removeMesh(t.mesh);
          return false;
        }
      }
      return true;
    });
  };

  // ---------- Подбираемые предметы ----------
  const PICK_COL = { money: '#7ed957', arrow: '#f2c230', stone_mask: '#c9a46b', corpse_part: '#ffe9a8', stand_disc: '#e9e6ef', clue: '#ff5fa2', red_stone: '#ff3a4a', cat: '#ffb03a', package: '#c98a4a', green_baby: '#3cc48a' };
  J.spawnPickup = function (x, y, item, n = 1, meta, persist) {
    const g = G();
    const p = { id: UID++, x, y, item, n, meta: meta || null, persist: !!persist, life: persist ? Infinity : 90 };
    p.mesh = J.R3.pickupMesh(PICK_COL[item] || '#ffffff');
    if (!persist) {
      // обычные предметы — без луча
      p.mesh.children[1].visible = item === 'stand_disc' || item === 'arrow';
    }
    g.pickups.push(p);
    return p;
  };
  J.updatePickups = function (dt) {
    const g = G();
    const pl = g.player;
    g.pickups = g.pickups.filter((p) => {
      p.life -= dt;
      const gy = g.world.groundY(p.x, p.y);
      p.mesh.position.set(p.x, gy + 0.6 + Math.sin(g.t * 3 + p.id) * 0.12, p.y);
      p.mesh.children[0].rotation.y += dt * 2.5;
      p.mesh.visible = !p.hidden || g.reveal > 0;
      if (p.life <= 0) {
        J.R3.removeMesh(p.mesh);
        return false;
      }
      if (!pl.dead && J.dist(pl.x, pl.y, p.x, p.y) < 1.1 && !(p.hidden && !(g.reveal > 0) && !p.found)) {
        J.P.pickup(pl, p);
        J.R3.removeMesh(p.mesh);
        J.R3.burst(p.x, p.y, 0.8, PICK_COL[p.item] || '#ffffff', 12, 2, 0.5);
        return false;
      }
      return true;
    });
  };

  // ---------- Главное обновление сущностей ----------
  J.updateEnts = function (dt) {
    const g = G();
    const ts = g.timestop;
    for (const e of g.ents) {
      if (e.dead) {
        e.deadT += dt;
        if (e.hitFlash > 0) e.hitFlash = Math.max(0, e.hitFlash - dt);
        if (J.Cb) J.Cb.physics(e, dt);
        continue;
      }
      // остановка времени
      const frozen = ts && e !== ts.by && !(e.isPlayer && g.player.tsMove > 0) && !(e.owner && e.owner === ts.by);
      e.st.timefrozen = frozen ? 1 : 0;
      if (frozen) {
        e.vx = e.vy = 0;
        continue;
      }
      J.updateStatus(e, dt);
      if (e.anim && e.anim.t > 0) e.anim.t -= dt;
      // отбрасывание, полёт, реакции, замахи (combat.js)
      J.Cb.tickEnt(e, dt);
      // каналы (раш, рывок)
      if (e.channel) J.Abil.updateChannel(e, dt);
      if (e.dash) J.Abil.updateDash(e, dt);
      if (e.st.void > 0) J.Abil.updateVoid(e, dt);
      if (e.isPlayer) continue; // игрок обновляется отдельно
      if (e.canAct() && !e.dash && !e.airborne) J.updateAI(e, dt);
      else e.vx = e.vy = 0;
    }
    // расталкивание
    const E = g.ents;
    for (let i = 0; i < E.length; i++) {
      const a = E[i];
      if (a.dead || a.st.fly > 0) continue;
      for (let j = i + 1; j < E.length; j++) {
        const b = E[j];
        if (b.dead || b.st.fly > 0) continue;
        const dx = b.x - a.x, dy = b.y - a.y;
        const rr = a.r + b.r;
        if (Math.abs(dx) > rr || Math.abs(dy) > rr) continue;
        const d = Math.hypot(dx, dy) || 0.01;
        if (d < rr) {
          const push = (rr - d) * 0.5;
          const ux = dx / d, uy = dy / d;
          const wa = a.boss ? 0.2 : 1, wb = b.boss ? 0.2 : 1;
          if (!a.st.timefrozen) J.moveEnt(a, -ux * push * wa, -uy * push * wa);
          if (!b.st.timefrozen) J.moveEnt(b, ux * push * wb, uy * push * wb);
        }
      }
    }
    // удаление мёртвых
    g.ents = g.ents.filter((e) => {
      if (e.isPlayer) return true;
      const gone = (e.dead && (e.vanish || e.deadT > 3)) || e.despawn;
      if (gone) J.R3.dropView(e);
      return !gone;
    });
  };
})();
