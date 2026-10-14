'use strict';
// Игрок: статы, уровни, инвентарь, стенд, стили, потребности, атаки.
(function () {
  const G = () => J.G;
  const P = (J.P = {});

  P.create = function (cfg) {
    const p = new J.Ent({
      isPlayer: true, kind: 'player', team: 'player', name: cfg.name, look: cfg.look, r: 0.3,
    });
    p.origin = cfg.origin;
    p.stats = Object.assign({ str: 1, agi: 1, end: 1, spi: 1, cha: 1, int: 1 }, cfg.stats);
    p.statXp = { str: 0, agi: 0, end: 0, spi: 0, cha: 0, int: 0 };
    p.points = 0;
    p.lvl = 1;
    p.xp = 0;
    p.money = cfg.money || 100;
    p.inv = {};
    p.discs = [];
    p.corpse = [];
    p.hunger = 85;
    p.energy = 90;
    p.blood = 80;
    p.stamina = 100;
    p.stand = null;
    p.se = 0;
    p.hamon = null;
    p.spin = null;
    p.vampire = false;
    p.ultimate = false;
    p.style = null;
    p.breath = 0;
    p.flags = {};
    p.codex = {};
    p.rep = { passione: 0, speedwagon: 0 };
    p.kills = 0;
    p.hist = [];
    p.mount = false;
    p.maxHpPenalty = 0;
    P.recalc(p);
    p.hp = p.maxHp;
    return p;
  };

  // ---------- Пересчёт производных ----------
  P.corpseBuff = (p, key) => p.corpse.reduce((s, id) => {
    const c = J.CORPSE_PARTS.find((x) => x.id === id);
    return s + (c && c.buff[key] ? c.buff[key] : 0);
  }, 0);
  P.recalc = function (p) {
    const s = p.stats;
    let hp = 70 + s.end * 12 + (p.lvl - 1) * 6 + P.corpseBuff(p, 'maxHp') - p.maxHpPenalty;
    if (p.vampire) hp *= 1.3;
    if (p.ultimate) hp *= 2;
    if (p.flags.awakenedSaint) hp += 40;
    const old = p.maxHp || hp;
    p.maxHp = Math.round(hp);
    if (p.hp > p.maxHp) p.hp = p.maxHp;
    if (p.maxHp > old && p.hp) p.hp += p.maxHp - old;
    p.staminaMax = 100 + s.agi * 5;
    p.seMax = p.stand ? 40 + s.spi * 12 + p.stand.lvl * 5 + P.corpseBuff(p, 'se') : 0;
    p.breathMax = p.hamon ? 50 + p.hamon.lvl * 12 : 0;
    let sp = 4.4 * (1 + s.agi * 0.025) * (1 + P.corpseBuff(p, 'speed'));
    if (p.vampire) sp *= 1.12;
    if (p.ultimate) sp *= 1.2;
    p.speed = sp;
    p.crit = 0.04;
  };
  P.armorBonus = (p) => P.corpseBuff(p, 'armor') + (p.ultimate ? 0.2 : p.vampire ? 0.08 : 0);
  P.critBonus = (p) => (p.stand ? J.rankNum(J.STANDS[p.stand.id].st.pre) * 0.02 : 0) + P.corpseBuff(p, 'crit');
  P.standPower = function (p) {
    if (!p.stand) return 1;
    const sd = J.STANDS[p.stand.id];
    let m = (0.7 + J.rankNum(sd.st.pow) * 0.11) * (1 + (p.stand.lvl - 1) * 0.075);
    if (p.stand.awakened) m *= 1.15;
    if (p.vampire) m *= 1.2;
    if (p.ultimate) m *= 1.4;
    m *= 1 + P.corpseBuff(p, 'power') + p.stats.spi * 0.015;
    return m;
  };
  P.stylePower = function (p, style) {
    if (style === 'vampire') return 1 + p.stats.str * 0.05 + (p.origin === 'brando' ? 0.2 : 0);
    if (style === 'hamon') return 1 + p.hamon.lvl * 0.08;
    return 1;
  };

  // ---------- Опыт ----------
  P.xpNeed = (l) => Math.round(60 * Math.pow(l, 1.6));
  P.gainXp = function (p, n) {
    n = Math.round(n * (1 + P.corpseBuff(p, 'xp')));
    p.xp += n;
    if (p.stand && p.standOut) P.standXp(p, n * 0.8);
    if (p.hamon && p.style === 'hamon') P.styleXp(p, 'hamon', n * 0.15);
    while (p.xp >= P.xpNeed(p.lvl)) {
      p.xp -= P.xpNeed(p.lvl);
      p.lvl++;
      p.points += 2;
      P.recalc(p);
      p.hp = p.maxHp;
      J.UI.toast(`Уровень ${p.lvl}! +2 очка характеристик (P — персонаж)`, 'gold');
      J.UI.sfx('level');
    }
  };
  P.standNeed = (l) => Math.round(80 * Math.pow(l, 1.5));
  P.standXp = function (p, n) {
    if (!p.stand || p.stand.lvl >= 10) return;
    const sd = J.STANDS[p.stand.id];
    n *= 0.6 + J.rankNum(sd.st.pot) * 0.15;
    p.stand.xp += n;
    while (p.stand && p.stand.lvl < 10 && p.stand.xp >= P.standNeed(p.stand.lvl)) {
      p.stand.xp -= P.standNeed(p.stand.lvl);
      p.stand.lvl++;
      P.recalc(p);
      const unlocked = sd.abil.filter((a) => a.lvl === p.stand.lvl);
      J.UI.toast(`${sd.ru}: уровень ${p.stand.lvl}!` + (unlocked.length ? ' Новая способность: ' + unlocked.map((a) => a.name).join(', ') : ''), 'stand');
      P.checkEvolution(p);
    }
  };
  P.styleNeed = (l) => Math.round(50 * Math.pow(l, 1.5));
  P.styleXp = function (p, style, n) {
    const s = p[style];
    if (!s || s.lvl >= 10) return;
    s.xp += n * (style === 'hamon' && p.origin === 'joestar' ? 1.3 : 1) * (style === 'spin' && p.origin === 'jockey' ? 1.3 : 1);
    while (s.lvl < 10 && s.xp >= P.styleNeed(s.lvl)) {
      s.xp -= P.styleNeed(s.lvl);
      s.lvl++;
      P.recalc(p);
      J.UI.toast(`${style === 'hamon' ? 'Хамон' : 'Вращение'}: уровень ${s.lvl}!`, 'gold');
      if (style === 'spin') P.checkEvolution(p);
    }
  };
  P.trainStat = function (p, stat, amt) {
    p.statXp[stat] += amt;
    const need = 20 + p.stats[stat] * 15;
    if (p.statXp[stat] >= need) {
      p.statXp[stat] -= need;
      p.stats[stat]++;
      P.recalc(p);
      J.UI.toast(`${P.STAT_RU[stat]} повышена до ${p.stats[stat]}!`, 'green');
    }
  };
  P.STAT_RU = { str: 'Сила', agi: 'Ловкость', end: 'Выносливость', spi: 'Дух', cha: 'Обаяние', int: 'Интеллект' };

  // ---------- Деньги и предметы ----------
  P.addMoney = function (p, n) {
    p.money = Math.max(0, p.money + n);
  };
  P.hasItem = (p, id) => (id === 'stand_disc' ? p.discs.length > 0 : (p.inv[id] || 0) > 0);
  P.count = (p, id) => (id === 'stand_disc' ? p.discs.length : id === 'corpse_part' ? p.corpse.length : p.inv[id] || 0);
  P.addItem = function (p, id, n = 1, meta, silent) {
    if (id === 'money') return P.addMoney(p, n);
    if (id === 'stand_disc') {
      p.discs.push(meta && meta.stand ? meta.stand : J.pickW(J.R, J.standPool()).s.id);
      if (!silent) J.UI.toast('Получен Стенд-диск: ' + J.STANDS[p.discs[p.discs.length - 1]].ru, 'gold');
      return;
    }
    if (id === 'corpse_part') {
      const free = J.CORPSE_PARTS.find((c) => !p.corpse.includes(c.id));
      const part = meta && meta.part ? meta.part : free && free.id;
      if (!part || p.corpse.includes(part)) return;
      p.corpse.push(part);
      P.recalc(p);
      const c = J.CORPSE_PARTS.find((x) => x.id === part);
      J.UI.toast(`Часть Святого Трупа: ${c.name} (${c.desc}). Собрано ${p.corpse.length}/9`, 'gold');
      if (!p.stand) {
        const pool = J.standPool((s) => s.part === 7);
        P.giveStand(p, J.pickW(J.R, pool).s.id, 'Часть Святого Трупа пробудила в тебе стенд!');
      }
      if (p.corpse.length >= 9) {
        p.flags.awakenedSaint = true;
        P.recalc(p);
        J.UI.toast('Все части Святого Трупа собраны! Ты чувствуешь благодать.', 'gold');
        P.checkEvolution(p);
      }
      return;
    }
    p.inv[id] = (p.inv[id] || 0) + n;
    if (!silent) J.UI.toast(`Получено: ${J.ITEMS[id].name}${n > 1 ? ' ×' + n : ''}`, J.ITEMS[id].rare ? 'gold' : 'normal');
    if (id === 'horse') J.UI.toast('Используй лошадь в инвентаре (I) или клавишей H, чтобы сесть верхом.', 'muted');
  };
  P.removeItem = function (p, id, n = 1) {
    p.inv[id] = Math.max(0, (p.inv[id] || 0) - n);
    if (!p.inv[id]) delete p.inv[id];
  };

  P.pickup = function (p, pk) {
    if (pk.item === 'money') {
      P.addMoney(p, pk.n);
      J.R3.text(p.x, p.y, '+' + J.fmtMoney(pk.n), 'tmoney', 0.9);
      J.UI.sfx('coin');
    } else P.addItem(p, pk.item, pk.n, pk.meta);
    if (pk.onPick) pk.onPick(p, pk);
    J.Story && J.Story.onPickup(pk);
  };

  P.addFlag = (p, k, n) => (p.flags[k] = (p.flags[k] || 0) + n);

  P.seeStand = function (p, id) {
    if (!p.codex[id]) {
      p.codex[id] = 'seen';
    }
  };

  // ---------- Использование предметов ----------
  P.useItem = function (p, id, idx) {
    const it = J.ITEMS[id];
    if (!it) return;
    switch (it.type) {
      case 'food': {
        if (p.vampire && !p.ultimate) {
          J.UI.toast('Ты вампир. Обычная еда не насыщает — нужна кровь.', 'red');
          return;
        }
        p.hunger = Math.min(100, p.hunger + (it.food || 0));
        p.energy = J.clamp(p.energy + (it.energy || 0), 0, 100);
        p.hp = Math.min(p.maxHp, p.hp + (it.heal || 0));
        P.removeItem(p, id);
        J.UI.toast(`Съедено: ${it.name}`, 'normal');
        if (id === 'trussardi_meal') J.UI.toast('Перл Джем! Из тебя выходит вся грязь, плечи больше не болят!', 'gold');
        break;
      }
      case 'blood':
        if (!p.vampire) {
          J.UI.toast('Пить кровь? Ты же не вампир...', 'muted');
          return;
        }
        p.blood = Math.min(100, p.blood + it.blood);
        p.hp = Math.min(p.maxHp, p.hp + p.maxHp * 0.15);
        P.removeItem(p, id);
        J.UI.toast('Жажда утолена.', 'normal');
        break;
      case 'heal':
        p.hp = Math.min(p.maxHp, p.hp + it.heal);
        P.removeItem(p, id);
        J.UI.toast(`+${it.heal} здоровья`, 'green');
        break;
      case 'arrow':
        J.UI.confirm(
          'Пронзить себя Стрелой?',
          p.stand
            ? 'У тебя уже есть стенд. Стрела может вызвать его эволюцию — или отвергнуть.'
            : `Шанс выжить: ${Math.round(P.arrowChance(p) * 100)}%. Если Стрела не выберет тебя — очнёшься в больнице, а Стрела исчезнет.`,
          () => P.useArrow(p)
        );
        break;
      case 'mask':
        J.UI.confirm(
          'Надеть Каменную маску?',
          p.vampire ? 'Ты уже вампир.' : 'Ты станешь вампиром: огромная сила, регенерация и бессмертие. Но солнце будет сжигать тебя, обычная еда перестанет насыщать, а хамон будет утерян навсегда.',
          () => P.useMask(p)
        );
        break;
      case 'redstone':
        if (p.vampire && P.hasItem(p, 'stone_mask')) {
          J.UI.confirm('Создать Совершенную форму жизни?', 'Маска и Красный камень Айи сделают тебя Совершенной формой жизни: бессмертие, неуязвимость к солнцу и хамон.', () => P.becomeUltimate(p));
        } else if (p.hamon) J.UI.toast('Красный камень в твоих руках усиливает хамон (пассивно, пока камень в инвентаре).', 'gold');
        else J.UI.toast('Красный камень Айи. Он отражает свет тысячами лучей. Нужен вампир и Каменная маска... или хамон.', 'muted');
        break;
      case 'disc': {
        const sid = p.discs[idx || 0];
        if (!sid) return;
        J.UI.confirm(
          'Вставить Стенд-диск?',
          `Стенд «${J.STANDS[sid].ru}» станет твоим.` + (p.stand ? ` Текущий стенд «${J.STANDS[p.stand.id].ru}» превратится в диск.` : ''),
          () => {
            p.discs.splice(idx || 0, 1);
            if (p.stand) p.discs.push(p.stand.id);
            P.giveStand(p, sid, 'Диск вошёл в голову. Новый стенд!', true);
          }
        );
        break;
      }
      case 'rokakaka':
        p.hp = p.maxHp;
        p.maxHpPenalty += 10;
        P.removeItem(p, id);
        P.recalc(p);
        J.UI.toast('Равноценный обмен: раны исцелены, но максимальное здоровье -10.', 'gold');
        break;
      case 'lottery': {
        P.removeItem(p, id);
        const r = Math.random();
        if (r < 0.01) {
          P.addMoney(p, 5000);
          J.UI.toast('ДЖЕКПОТ! +$5000!', 'gold');
        } else if (r < 0.12) {
          P.addMoney(p, 50);
          J.UI.toast('Выигрыш: $50', 'green');
        } else J.UI.toast('Не повезло.', 'muted');
        break;
      }
      case 'rumor':
        P.removeItem(p, id);
        J.Story.rumorTreasure(true);
        break;
      case 'gear':
        if (id === 'horse') P.toggleMount(p);
        else J.UI.toast(it.desc, 'muted');
        break;
      case 'key':
        if (id === 'green_baby') {
          if (p.stand && p.stand.id === 'whitesnake' && p.stand.lvl >= 6) {
            P.removeItem(p, id);
            P.evolve(p, 'c_moon');
          } else J.UI.toast('Зелёный младенец смотрит на тебя. Нужна Белая Змея 6+ уровня.', 'muted');
        } else J.UI.toast(it.desc, 'muted');
        break;
      default:
        J.UI.toast(it.desc, 'muted');
    }
  };

  P.toggleMount = function (p) {
    if (p.inCar) return;
    if (!P.hasItem(p, 'horse')) return;
    p.mount = !p.mount;
    J.UI.toast(p.mount ? 'Ты в седле! Вне города скорость выше.' : 'Ты спешился.', 'normal');
  };

  P.arrowChance = function (p) {
    let c = 0.5 + p.stats.spi * 0.045;
    if (p.origin === 'joestar') c += 0.25;
    if (p.origin === 'brando') c += 0.15;
    if (P.hasItem(p, 'luck_charm')) c += 0.05;
    return Math.min(0.95, c);
  };
  P.useArrow = function (p) {
    if (!P.hasItem(p, 'arrow')) return;
    if (p.stand) {
      const sd = J.STANDS[p.stand.id];
      if (sd.evo && sd.evo.how === 'arrow') {
        const need = sd.evo.minLvl || 10;
        if (p.stand.lvl >= need) {
          P.removeItem(p, 'arrow');
          J.UI.toast('Стрела вонзается в стенд...', 'gold');
          P.evolve(p, sd.evo.to);
          return;
        }
        J.UI.toast(`Стрела отвергает тебя. Стенду нужен ${need} уровень.`, 'muted');
        return;
      }
      if (p.stand.lvl >= 10 && !p.stand.awakened) {
        P.removeItem(p, 'arrow');
        p.stand.awakened = true;
        J.UI.toast('Стрела пробуждает скрытую силу стенда! +15% к силе.', 'gold');
        return;
      }
      J.UI.toast('Стрела не реагирует. Стенд ещё не достиг предела (10 ур.).', 'muted');
      return;
    }
    P.removeItem(p, 'arrow');
    J.R3.burst(p.x, p.y, 1.2, '#f2c230', 30, 3, 0.8);
    if (Math.random() < P.arrowChance(p)) {
      const pool = J.standPool();
      P.giveStand(p, J.pickW(J.R, pool).s.id, 'Стрела выбрала тебя!');
    } else {
      J.UI.toast('Стрела не выбрала тебя...', 'red');
      J.Game.collapse('Стрела не выбрала тебя. Ты чудом выжил.');
    }
  };

  P.giveStand = function (p, id, msg, silentReveal) {
    p.stand = { id, lvl: 1, xp: 0 };
    p.codex[id] = 'owned';
    p.standOut = true;
    P.recalc(p);
    p.se = p.seMax;
    J.UI.standReveal(id, msg);
    J.Story && J.Story.onStand();
  };
  P.checkEvolution = function (p) {
    if (!p.stand) return;
    const sd = J.STANDS[p.stand.id];
    const ev = sd.evo;
    if (!ev) return;
    if (ev.how === 'level' && p.stand.lvl >= ev.lvl) P.evolve(p, ev.to);
    else if (ev.how === 'witness' && p.flags.witnessTS && p.stand.lvl >= 5) P.evolve(p, ev.to);
    else if (ev.how === 'spin' && p.stand.lvl >= 10 && p.spin && p.spin.lvl >= 5) P.evolve(p, ev.to);
    else if (ev.how === 'corpse' && p.corpse.length >= 9) P.evolve(p, ev.to);
  };
  P.evolve = function (p, to) {
    const lvl = p.stand.lvl;
    p.stand = { id: to, lvl, xp: 0, awakened: p.stand.awakened };
    p.codex[to] = 'owned';
    P.recalc(p);
    p.se = p.seMax;
    J.UI.standReveal(to, 'Стенд эволюционировал!');
  };

  P.useMask = function (p) {
    if (p.vampire) return;
    p.vampire = true;
    p.hamon = null;
    p.breath = 0;
    if (p.style === 'hamon' || !p.style) p.style = 'vampire';
    p.blood = 60;
    P.recalc(p);
    p.hp = p.maxHp;
    p.look.eye = '#ff2a3a';
    J.R3.dropView(p);
    J.R3.flash(p.x, p.y, 3, '#c4283c', 0.8);
    J.UI.bigBanner('Я ОТКАЗЫВАЮСЬ ОТ СВОЕЙ ЧЕЛОВЕЧНОСТИ!', 'Ты стал вампиром. Избегай солнца. Клавиши 1, 2, 3 — вампирские способности.');
    J.Story && J.Story.onVampire();
  };
  P.becomeUltimate = function (p) {
    P.removeItem(p, 'red_stone');
    p.ultimate = true;
    p.style = 'ultimate';
    p.hamon = { lvl: 10, xp: 0 };
    P.recalc(p);
    p.hp = p.maxHp;
    J.R3.dropView(p);
    J.UI.bigBanner('СОВЕРШЕННАЯ ФОРМА ЖИЗНИ', 'Солнце больше не властно над тобой. Ты — вершина эволюции.');
  };
  P.learnStyle = function (p, style) {
    if (style === 'hamon') {
      if (p.vampire) {
        J.UI.toast('Вампир не может использовать хамон — он сожжёт тебя изнутри.', 'red');
        return false;
      }
      if (!p.hamon) p.hamon = { lvl: 1, xp: 0 };
      if (!p.style || p.style === 'spin') p.style = 'hamon';
    }
    if (style === 'spin') {
      if (!p.spin) p.spin = { lvl: 1, xp: 0 };
      if (!p.style) p.style = 'spin';
    }
    P.recalc(p);
    p.breath = p.breathMax || 0;
    return true;
  };
  P.cycleStyle = function (p) {
    const list = [];
    if (p.hamon && !p.vampire) list.push('hamon');
    if (p.vampire && !p.ultimate) list.push('vampire');
    if (p.ultimate) list.push('ultimate');
    if (p.spin) list.push('spin');
    if (list.length < 2) {
      J.UI.toast(list.length ? 'У тебя один стиль: ' + J.Abil.STYLES[list[0]].name : 'У тебя пока нет боевого стиля (хамон, вампиризм, вращение).', 'muted');
      return;
    }
    const i = list.indexOf(p.style);
    p.style = list[(i + 1) % list.length];
    J.UI.toast('Стиль: ' + J.Abil.STYLES[p.style].name, 'gold');
  };

  // ---------- Прицеливание ----------
  P.aim = function (p, range) {
    const inp = J.Input;
    let base = inp.touch ? p.face : J.R3.cam.yaw;
    if (inp.touch && Math.hypot(p.vx, p.vy) < 0.2 && p.lastMoveAng !== undefined) base = p.lastMoveAng;
    const cone = inp.touch ? 1.3 : 0.75;
    const tg = J.nearestHostile(p, Math.max(range, 6), cone, base) || J.nearestHostile(p, inp.touch ? 4.5 : 2.4);
    const ang = tg ? Math.atan2(tg.y - p.y, tg.x - p.x) : base;
    return { ang, x: tg ? tg.x : p.x + Math.cos(ang) * range, y: tg ? tg.y : p.y + Math.sin(ang) * range, target: tg };
  };

  // ---------- Атаки (момент удара, серии, заряд — в combat.js) ----------
  P.basicAttack = function (p) {
    if (p.inCar) return;
    if (J.Cb.light(p)) {
      p.buf = 0;
      if (J.Fx) J.Fx.cancelStandoff();
    }
  };
  // мгновенный тяжёлый удар (без заряда)
  P.heavyAttack = function (p) {
    if (p.inCar) return;
    return J.Cb.heavy(p, 0);
  };
  P.heavyStart = function (p) {
    if (p.inCar) return;
    return J.Cb.heavyStart(p);
  };
  P.heavyRelease = function (p) {
    if (p.inCar) return;
    if (J.Cb.heavyRelease(p) && J.Fx) J.Fx.cancelStandoff();
  };
  P.standAbility = function (p, i, tc) {
    if (p.inCar) return;
    if (!p.stand) {
      J.UI.toast('У тебя нет стенда. Стрела, диск, части Святого Трупа... способов много.', 'muted');
      return;
    }
    if (p.channel) return;
    const sd = J.STANDS[p.stand.id];
    const ab = sd.abil[i];
    if (!ab) return;
    // под чужим рашем можно ответить своим (столкновение рашей)
    if (!p.canAct() && !(ab.kind === 'rush' && p.stand.lvl >= ab.lvl && !(p.cds['s' + i] > 0) && J.Cb.counterRush(p))) return;
    if (p.stand.lvl < ab.lvl) {
      J.UI.toast(`«${ab.name}» откроется на ${ab.lvl} уровне стенда.`, 'muted');
      return;
    }
    if (p.st.silence > 0) {
      J.UI.toast('Стенд заблокирован!', 'red');
      return;
    }
    const key = 's' + i;
    if (p.cds[key] > 0) return;
    if (p.se < ab.cost) {
      J.UI.toast('Не хватает энергии стенда.', 'muted');
      return;
    }
    if ((ab.kind === 'timestop' && J.G.timestop) || (ab.kind === 'timeskip' && J.G.timeskip)) return;
    p.standOut = true;
    if (p.guard) p.guard = false;
    p.chg = null;
    const aim = P.aim(p, ab.range || 7);
    const r = J.Abil.use(p, ab, aim, { key: { kb: ['KeyQ', 'KeyE', 'KeyR'][i], tc: tc || ['q', 'e', 'r'][i] } });
    if (r && J.Fx) J.Fx.cancelStandoff();
    if (!r) {
      if (['hex', 'pull', 'bomb', 'disc'].includes(ab.kind)) J.UI.toast('Нет цели рядом.', 'muted');
      return;
    }
    p.se -= r === 'short' ? Math.round(ab.cost / 3) : ab.cost;
    p.cds[key] = r === 'short' ? 0.6 : ab.cd * (1 - J.rankNum(sd.st.spd) * 0.03);
    p.cdMax = p.cdMax || {};
    p.cdMax[key] = p.cds[key];
    P.standXp(p, 3);
  };
  P.toggleStand = function (p) {
    if (p.inCar) return;
    if (!p.stand) {
      J.UI.toast('У тебя нет стенда.', 'muted');
      return;
    }
    p.standOut = !p.standOut;
    if (p.standOut) {
      J.R3.text(p.x, p.y, J.STANDS[p.stand.id].ru.toUpperCase() + '!', 'tstand', 1.1, 2.6);
      if (!p.channel && !(p.atk && !p.atk.done)) p.anim = { type: 'pose', t: 0.7, max: 0.7 };
      if (J.Fx && J.Fx.ready) J.Fx.summon(p);
      else J.UI.sfx('stand');
      p.summonT = 0.25;
    } else {
      p.guard = false;
      J.Sfx && J.Sfx.whoosh(0.18, false, 0.08);
    }
  };
  // рывок-уклонение: неуязвимость, тратит выносливость; с земли — быстрый подъём
  P.dash = function (p, dx, dy) {
    if (p.inCar) return;
    if (J.Cb.inClash(p)) return J.Cb.mash(p);
    J.Cb.dodge(p, dx, dy);
  };

  // ---------- Ежесекундное обновление игрока ----------
  P.update = function (p, dt, inp) {
    const g = G();
    const w = g.world;
    if (p.dead) return;
    // история для перемотки
    p._histT = (p._histT || 0) - dt;
    if (p._histT <= 0) {
      p._histT = 0.25;
      p.hist.push({ t: g.t, x: p.x, y: p.y, hp: p.hp });
      while (p.hist.length && g.t - p.hist[0].t > 8) p.hist.shift();
    }
    if (p.tsMove > 0) p.tsMove -= dt;
    // ресурсы
    const moving = Math.hypot(inp.mx, inp.my) > 0.1;
    const sprint = inp.sprint && moving && p.stamina > 1;
    if (sprint) p.stamina -= 14 * dt;
    else p.stamina = Math.min(p.staminaMax, p.stamina + (p.energy < 20 ? 8 : 18) * dt);
    if (p.stand) {
      if (p.standOut) p.se = Math.max(0, p.se - 0.4 * dt + (p.se < p.seMax ? 2.2 * dt : 0));
      else p.se = Math.min(p.seMax, p.se + 6 * dt);
      p.se = Math.min(p.seMax, p.se);
    }
    // хамон-дыхание
    p.breathing = false;
    if (p.hamon && !p.vampire) {
      let reg = 2.5;
      if (inp.breathe) {
        p.breathing = true;
        reg = 26 + p.hamon.lvl * 2;
        if (p.hamon.lvl >= 4) p.hp = Math.min(p.maxHp, p.hp + p.maxHp * 0.012 * dt);
        if (Math.random() < dt * 12) J.R3.aura(p.x, p.y, w.groundY(p.x, p.y), '#ffd84a');
        P.styleXp(p, 'hamon', dt * 0.5);
      }
      p.breath = Math.min(p.breathMax, p.breath + reg * dt);
    }
    // вода
    const tile = w.tile(p.x, p.y);
    const onDeep = tile === J.T.DEEP;
    p.waterWalk = !!(p.hamon && !p.vampire && p.hamon.lvl >= 2 && p.breath > 1) || p.ultimate;
    if (onDeep && !(p.st.fly > 0)) {
      if (p.hamon && p.waterWalk && !p.ultimate) p.breath -= 5 * dt;
      p.onWater = true;
      if (!p.waterWalk) {
        p.x = p.lastSafe.x;
        p.y = p.lastSafe.y;
        J.hurt(p, p.maxHp * 0.12, null, { dot: true, kind: 'pure' });
        J.UI.toast('Ты чуть не утонул! Дыхание хамона иссякло.', 'red');
      }
      if (Math.random() < dt * 8) J.R3.ring(p.x, p.y, 1, '#ffd84a', 0.4);
    } else {
      p.onWater = false;
      if (!w.isWater(p.x, p.y) && !(p.st.fly > 0)) p.lastSafe = { x: p.x, y: p.y };
    }
    // солнце для вампира
    if (p.vampire && !p.ultimate && g.isSunny) {
      const umb = P.hasItem(p, 'umbrella');
      const dps = p.maxHp * (umb ? 0.012 : 0.06);
      J.hurt(p, dps * dt, null, { dot: true, kind: 'sun', silent: true });
      if (Math.random() < dt * (umb ? 2 : 10)) J.R3.burst(p.x, p.y, 1.2, '#ffb03a', 3, 1, 0.5, 2);
      p._sunWarn = (p._sunWarn || 0) - dt;
      if (p._sunWarn <= 0) {
        p._sunWarn = 12;
        J.UI.toast(umb ? 'Солнце жжёт даже сквозь зонт! Ищи тень — зайди в здание.' : 'СОЛНЦЕ СЖИГАЕТ ТЕБЯ! Зайди в любое здание (F у двери).', 'red');
      }
    }
    // реген
    let regen = 0.004;
    if (p.vampire) regen = 0.025;
    if (p.ultimate) regen = 0.05;
    regen += P.corpseBuff(p, 'regen') * 0.01;
    if (p.hunger <= 0 && !p.vampire) regen = -0.004;
    if (p.vampire && p.blood <= 0) regen = -0.006;
    if (!(p.st.infinite > 0)) p.hp = J.clamp(p.hp + p.maxHp * regen * dt, 0, p.maxHp);
    if (p.hp <= 0 && !p.dead) J.kill(p, null);
    if (!p.airborne) {
      if (p.st.fly > 0) p.z = J.lerp(p.z, 1.4, dt * 4);
      else p.z = J.lerp(p.z, 0, dt * 8);
    }
    // блок: удержание клавиши (Z / ПКМ при захвате мыши / кнопка «Блок»)
    if (inp.guard && !p.guard && !J.Cb.inClash(p)) J.Cb.setGuard(p, true);
    else if (!inp.guard && p.guard) J.Cb.setGuard(p, false);
    // буфер удара, нажатого во время замаха
    if (p.buf && g.t - p.buf > 0.3) p.buf = 0;
    // в блоке и при заряде — лицом к противнику
    if ((p.guard || p.chg) && p.canAct()) p.face = P.aim(p, 6).ang;

    // движение
    if (!p.canMove() || p.dash) {
      if (!p.dash) p.vx = p.vy = 0;
      p.mvx = p.mvy = 0;
      return;
    }
    if (p.st.void > 0) {
      // шар пустоты
    }
    let spd = p.speed * J.speedMul(p) * (sprint ? 1.55 : 1) * w.speedAt(p.x, p.y);
    if (p.energy < 15) spd *= 0.8;
    if (p.mount && !w.cityAt(p.x, p.y)) spd *= 1.45;
    if (p.channel) spd *= 0.35;
    if (p.guard) spd *= 0.4;
    if (p.chg) spd *= 0.45;
    if (p.atk && !p.atk.done) spd *= 0.3;
    if (p.breathing) spd *= 0.5;
    if (p.st.void > 0) spd *= 1.4;
    if (p.st.fly > 0) spd *= 1.25;
    if (moving) {
      const yaw = J.R3.cam.yaw;
      const fx = Math.cos(yaw), fy = Math.sin(yaw);
      const rx = -Math.sin(yaw), ry = Math.cos(yaw);
      let dx = fx * -inp.my + rx * inp.mx, dy = fy * -inp.my + ry * inp.mx;
      const L = Math.hypot(dx, dy);
      const mag = Math.min(1, Math.hypot(inp.mx, inp.my));
      dx = (dx / L) * mag;
      dy = (dy / L) * mag;
      // разгон: скорость догоняет желаемую за ~0.1 с — шаги и развороты без рывков
      const a = 1 - Math.exp(-14 * dt);
      p.mvx = (p.mvx || 0) + (dx * spd - (p.mvx || 0)) * a;
      p.mvy = (p.mvy || 0) + (dy * spd - (p.mvy || 0)) * a;
      const ox = p.x, oy = p.y;
      J.moveEnt(p, p.mvx * dt, p.mvy * dt);
      p.vx = (p.x - ox) / dt;
      p.vy = (p.y - oy) / dt;
      const busy = (p.anim && p.anim.t > 0 && p.anim.type !== 'pose') || p.channel || p.guard || p.chg;
      if (!busy) p.face = Math.atan2(dy, dx);
      // любое движение отменяет победную позу
      if (p.anim && p.anim.victory) p.anim = null;
      p.lastMoveAng = Math.atan2(dy, dx);
      if (sprint && Math.random() < dt * 2) P.trainStat(p, 'agi', 0.3);
    } else if (Math.abs(p.mvx || 0) + Math.abs(p.mvy || 0) > 0.05) {
      // торможение
      const a = 1 - Math.exp(-20 * dt);
      p.mvx -= p.mvx * a;
      p.mvy -= p.mvy * a;
      const ox = p.x, oy = p.y;
      J.moveEnt(p, p.mvx * dt, p.mvy * dt);
      p.vx = (p.x - ox) / dt;
      p.vy = (p.y - oy) / dt;
    } else {
      p.vx = p.vy = p.mvx = p.mvy = 0;
    }
  };

  // Потребности (вызывается каждую игровую минуту)
  P.tickNeeds = function (p, mins) {
    if (p.vampire && !p.ultimate) p.blood = Math.max(0, p.blood - mins * 0.045);
    else if (!p.ultimate) p.hunger = Math.max(0, p.hunger - mins * 0.075);
    p.energy = Math.max(0, p.energy - mins * 0.085);
    // тренировка Духа, пока стенд призван
    if (p.stand && p.standOut) P.trainStat(p, 'spi', mins * 0.01);
  };
})();
