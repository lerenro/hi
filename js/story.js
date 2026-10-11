'use strict';
// Сюжет: случайная судьба из арок, этапы, боссы, побочные квесты, случайные события, сюжетные NPC.
(function () {
  const G = () => J.G;
  const S = (J.Story = {});
  const P = () => J.G.player;
  const W = () => J.G.world;
  const UI = () => J.UI;

  // ---------- Сюжетные персонажи ----------
  const L = (o) => Object.assign({ gender: 'm', skin: '#eac09f', hair: 'short', hairColor: '#1c1a24', top: '#2a2a33', bottom: '#2a2a33' }, o);
  S.NPCS = {
    jotaro: { name: 'Джотаро Куджо', b: ['hotel', 'morioh'], look: L({ build: 'muscular', hair: 'cap', top: '#e8e8f0', bottom: '#e8e8f0', coat: true }) },
    rohan: { name: 'Кисибэ Рохан', b: ['rohan', 'morioh'], look: L({ hairColor: '#2a6a3a', top: '#2a7a5a', bottom: '#e8e8f0' }) },
    josuke: { name: 'Джоске Хигашиката', b: ['kame_yu', 'morioh'], look: L({ hair: 'pompadour', top: '#1f2a44', bottom: '#1f2a44' }) },
    tonio: { name: 'Тонио Труссарди', b: ['trussardi', 'morioh'], look: L({ hairColor: '#7a4b2a', top: '#f4f4f4', bottom: '#f4f4f4', skin: '#d9a57f' }) },
    sw_ny: { name: 'Агент Фонда Спидвагона', b: ['speedwagon', 'newyork'], look: L({ top: '#2a2a33', bottom: '#2a2a33', hair: 'short', hairColor: '#3b2a1d' }) },
    sw_london: { name: 'Агент Фонда Спидвагона', b: ['speedwagon', 'london'], look: L({ top: '#2a2a33', bottom: '#2a2a33' }) },
    sw_cairo: { name: 'Агент Фонда Спидвагона', b: ['speedwagon', 'cairo'], look: L({ top: '#e8dcc8', bottom: '#e8dcc8', skin: '#b8805c' }) },
    zeppeli: { name: 'Барон Уилл Цеппели', b: ['zeppeli_house', 'london'], look: L({ hair: 'cap', hairColor: '#d9b36a', top: '#3a5a3a', bottom: '#3a3a30', skin: '#f6d7c3' }) },
    tonpetty: { name: 'Мастер Тонпетти', b: ['hamon_temple', 'tibet'], look: L({ hair: 'bald', top: '#c4583a', bottom: '#c4583a', skin: '#d9a57f' }) },
    lisalisa: { name: 'Лиза Лиза', b: ['lisa_castle', 'airsupplena'], look: L({ gender: 'f', hair: 'long', hairColor: '#1c1a24', top: '#2a2a33', bottom: '#e8e8f0', skin: '#f6d7c3' }) },
    gyro: { name: 'Джайро Цеппели', b: ['sbr_office', 'sandiego'], look: L({ hair: 'long', hairColor: '#d9b36a', top: '#2a7a5a', bottom: '#2a2a38', skin: '#eac09f' }) },
    bucciarati: { name: 'Бруно Буччеллати', b: ['passione', 'naples'], look: L({ hair: 'long', hairColor: '#1c1a24', top: '#f4f4f4', bottom: '#f4f4f4' }) },
    jolyne: { name: 'Джолин Куджо', b: ['green_dolphin', 'florida'], look: L({ gender: 'f', hair: 'buns', hairColor: '#3aa86b', top: '#3aa2a6', bottom: '#3aa2a6' }) },
    pucci: { name: 'Отец Пуччи', b: ['church', 'florida'], look: L({ hair: 'short', hairColor: '#e8e8f0', top: '#1d1a22', bottom: '#1d1a22', skin: '#8a5a3c' }) },
    avdol: { name: 'Мухаммед Абдул', b: ['bar', 'cairo'], look: L({ hair: 'long', hairColor: '#1c1a24', top: '#d8442b', bottom: '#d8442b', skin: '#8a5a3c' }) },
    stroheim: { name: 'Рудольф фон Штрогейм', b: ['hotel', 'mexico'], look: L({ hair: 'cap', top: '#4a5a3a', bottom: '#4a5a3a', hairColor: '#d9b36a' }) },
  };

  // Облики боссов
  const BOSS = {
    kira: { name: 'Кира Ёсикагэ', look: L({ hairColor: '#f2e6c8', top: '#7a5cd6', bottom: '#7a5cd6', skin: '#f6d7c3' }), stand: 'killer_queen', lvl: 8, hpMul: 3.2 },
    keicho: { name: 'Кейчо Нидзимура', look: L({ hair: 'long', hairColor: '#3b2a1d', top: '#1f2a44', bottom: '#1f2a44' }), stand: 'bad_company', lvl: 3, hpMul: 1.4 },
    dio: { name: 'ДИО', look: L({ build: 'muscular', hairColor: '#f2d36a', top: '#f2c230', bottom: '#2c7f4f', skin: '#f6e2c8', eye: '#ff2a3a' }), stand: 'the_world', lvl: 9, hpMul: 4.5, vamp: true, spells: ['vfreeze', 'veyes'], nightOnly: true },
    vanilla: { name: 'Ванилла Айс', look: L({ hair: 'long', hairColor: '#b06bff', top: '#2c2238', bottom: '#2c2238' }), stand: 'cream', lvl: 7, hpMul: 2.6 },
    diavolo: { name: 'Дьяволо', look: L({ hair: 'long', hairColor: '#ff7ab8', top: '#2c2238', bottom: '#5a3a6a' }), stand: 'king_crimson', lvl: 9, hpMul: 4.5 },
    pucci: { name: 'Энрико Пуччи', look: L({ hairColor: '#e8e8f0', top: '#1d1a22', bottom: '#1d1a22', skin: '#8a5a3c' }), stand: 'whitesnake', lvl: 8, hpMul: 3.5, phases: [{ at: 0.5, stand: 'c_moon', text: 'Си-Мун! Гравитация теперь во мне!' }] },
    pucci_mih: { name: 'Энрико Пуччи', look: L({ hairColor: '#e8e8f0', top: '#f4f4f4', bottom: '#1d1a22', skin: '#8a5a3c' }), stand: 'made_in_heaven', lvl: 10, hpMul: 5 },
    valentine: { name: 'Фанни Валентайн', look: L({ hair: 'long', hairColor: '#f2e6c8', top: '#2a6ad8', bottom: '#e8e8f0' }), stand: 'd4c', lvl: 9, hpMul: 4.5 },
    santana: { name: 'Сантана', look: L({ build: 'muscular', hair: 'spiky', hairColor: '#3b2a1d', top: '#6a3a3a', bottom: '#3a2a22', skin: '#d9a57f' }), lvl: 6, hpMul: 3, pillar: true, scale: 1.2, nightOnly: true, spells: [{ name: 'Вторжение в тело', kind: 'strike', dmg: 30, range: 1.8, stun: 1, cd: 5 }, { name: 'Рёберные клинки', kind: 'shoot', n: 5, spread: 50, dmg: 13, speed: 12, range: 8, proj: 'blade', color: '#d9a57f', size: 0.25, cd: 6 }] },
    wamuu: { name: 'Ваму', look: L({ build: 'muscular', hair: 'spiky', hairColor: '#1c1a24', top: '#d8442b', bottom: '#2a2a33', skin: '#b8805c' }), lvl: 8, hpMul: 4, pillar: true, scale: 1.35, nightOnly: true, spells: [{ name: 'Божественный вихрь', kind: 'beam', dmg: 42, range: 9, width: 0.9, color: '#c8f0ff', cd: 7 }, { name: 'Ветряные доспехи', kind: 'buff', buff: 'armor', val: 0.5, dur: 6, cd: 15 }, { name: 'Вихрь', kind: 'nova', radius: 4, dmg: 28, knock: 10, color: '#c8f0ff', cd: 9 }] },
    esidisi: { name: 'Эсидиси', look: L({ build: 'muscular', hair: 'long', hairColor: '#1c1a24', top: '#f2c230', bottom: '#2a2a33', skin: '#8a5a3c' }), lvl: 8, hpMul: 4, pillar: true, scale: 1.3, nightOnly: true, spells: [{ name: 'Кипящая кровь', kind: 'shoot', n: 6, spread: 60, dmg: 15, speed: 10, range: 9, proj: 'flame', color: '#ff3a1c', size: 0.26, fx: { burn: 4 }, cd: 5 }, { name: 'Жар', kind: 'nova', radius: 3.5, dmg: 30, fx: { burn: 5 }, color: '#ff5a1c', cd: 9 }] },
    kars: { name: 'Карс', look: L({ build: 'muscular', hair: 'long', hairColor: '#1c1a24', top: '#e8e8f0', bottom: '#5a3a6a', skin: '#d9a57f' }), lvl: 10, hpMul: 5.5, pillar: true, scale: 1.35, nightOnly: true, spells: [{ name: 'Сияющий клинок', kind: 'strike', dmg: 48, range: 2.3, arc: 2, fx: { bleed: 4 }, cd: 3, color: '#ff8ad8' }, { name: 'Сияющий режим', kind: 'nova', radius: 4.5, dmg: 42, color: '#ff8ad8', cd: 10 }, { name: 'Рывок', kind: 'dash', dist: 7, dmg: 34, cd: 7 }] },
    black_sabbath: { name: 'Чёрный Шабаш', look: L({ hair: 'bald', top: '#141018', bottom: '#141018', skin: '#141018', eye: '#d6c447' }), stand: 'black_sabbath', lvl: 4, hpMul: 1.6, nightOnly: false },
  };
  S.BOSS = BOSS;

  // ---------- Помощники ----------
  const rand = () => J.R;
  const reg = (id) => J.REGION[id];
  const bfind = (type, rid) => W().findBuilding(type, rid);
  const door = (b) => (b ? { x: b.door.x + 0.5, y: b.door.y + 1.6 } : null);
  const randIn = (rid, r, opts) => {
    const R = reg(rid);
    return W().randomWalkable(R.x, R.y, r || 25, J.R, opts) || { x: R.x, y: R.y };
  };
  const housesOf = (rid) => W().buildings.filter((b) => b.region === rid && b.type === 'house' && b.w >= 3);
  const isNight = () => G().isNight;
  S.door = door;

  // Спаун по описанию
  S.spawnSpec = function (spec, x, y) {
    const pl = P();
    let e;
    if (spec.mob) {
      e = J.makeMob(spec.mob, x, y, Math.max(1, spec.lvl || pl.lvl));
    } else {
      const bd = spec.boss ? BOSS[spec.boss] : spec;
      const lvl = Math.max(bd.lvl || 3, Math.min(10, pl.lvl + (spec.boss ? 1 : 0)));
      e = J.makeStandUser(x, y, lvl, bd.stand || null, { name: bd.name, look: bd.look ? Object.assign({}, bd.look) : null, hpMul: bd.hpMul || 1 });
      if (!bd.stand && spec.boss) {
        e.stand = null;
        e.standUser = false;
      }
      e.spells = bd.spells || null;
      e.vamp = !!bd.vamp;
      e.undead = !!bd.vamp;
      e.pillar = !!bd.pillar;
      e.scale = bd.scale || 1;
      e.r = 0.3 * (bd.scale || 1);
      if (spec.boss) {
        e.boss = true;
        e.bossKey = spec.boss;
        e.phases = bd.phases ? bd.phases.map((p) => Object.assign({}, p)) : null;
        e.xp = 300 + lvl * 60;
        e.money = [400 + lvl * 80, 800 + lvl * 120];
        e.ai.aggro = 14;
        e.ai.leash = 60;
        e.dmgMul *= 1.15;
        if (bd.pillar) {
          e.dmg *= 1.4;
          e.speed = 4.2;
        }
      }
    }
    e.storyTag = spec.tag;
    e.nightOnly = !!(spec.nightOnly || (spec.boss && BOSS[spec.boss].nightOnly));
    J.addEnt(e);
    return e;
  };

  // ---------- Арки ----------
  const ARCS = {};
  S.ARCS = ARCS;

  ARCS.morioh = {
    title: 'Несокрушимый Морио',
    part: 4,
    intro: 'В тихом городке Морио-тё пропадают люди. В город приехал Джотаро Куджо. Говорят, он ищет кого-то очень опасного.',
    setup(d) {
      const hs = housesOf('morioh');
      const a = J.R.pick(hs), b = J.R.pick(hs.filter((h) => h !== a)) || a;
      d.kiraHouse = a.id;
      d.nijimura = b.id;
      d.clues = [0, 1, 2].map(() => randIn('morioh', 26, { street: true }));
      d.found = 0;
    },
    stages: [
      {
        text: 'Найди Джотаро Куджо у отеля в Морио-тё',
        marker: () => S.npcPos('jotaro'),
        talk: {
          jotaro(d, done) {
            const p = P();
            UI().say('Джотаро Куджо', [
              'Яре яре дазе... Ещё один любопытный.',
              p.stand ? 'Я вижу твой стенд. Хорошо. Мне нужна помощь.' : 'Слушай. В этом городе есть люди со «стендами» — духами силы.',
              'Кто-то в Морио убивает людей и не оставляет следов. Он охотится за руками.',
              p.stand ? 'Найди улики. Начни с улиц города.' : 'Без стенда ты его даже не увидишь. В доме Нидзимуры есть Стрела. Будь осторожен.',
            ], done);
          },
        },
      },
      {
        skipIf: () => !!P().stand,
        text: 'Дом Нидзимуры: там хранят Стрелу',
        marker: (d) => door(W().buildings[d.nijimura]),
        begin(d) {
          d.spawns = [{ tag: 'keicho', spec: { boss: 'keicho', tag: 'keicho' }, at: door(W().buildings[d.nijimura]) }];
        },
        approach: {
          r: 7,
          fn(d) {
            UI().say('Кейчо Нидзимура', ['Ещё один гость... Посмотрим, достоин ли ты!', '*Стрела пронзает тебя насквозь*'], () => {
              if (!P().stand) J.P.giveStand(P(), J.pickW(J.R, J.standPool()).s.id, 'Стрела Кейчо пробудила твой стенд!');
            });
          },
        },
        done: (d) => S.killed(d, 'keicho'),
        end() {
          UI().toast('Кейчо повержен. Стрела где-то в Морио...', 'gold');
        },
      },
      {
        text: 'Найди 3 улики на улицах Морио-тё',
        marker: (d) => d.clues.find((c) => !c.got),
        begin(d) {
          d.items = d.clues.map((c, i) => ({ x: c.x, y: c.y, item: 'clue', tag: 'clue' + i, lore: ['Пакет из бутика... внутри — женская рука. Ногти аккуратно подстрижены.', 'Дневник: «Мои ногти растут слишком быстро. Это значит, я должен снова...»', 'Фото с камеры наблюдения: мужчина в фиолетовом костюме. Галстук с черепами.'][i] }));
        },
        done: (d) => d.found >= 3,
        end() {
          UI().say('Джотаро Куджо (по телефону)', ['Хорошая работа. Его имя — Кира Ёсикагэ.', 'Будь начеку. Если он узнал о тебе — придёт сам.']);
        },
      },
      {
        text: 'Шиер Харт Атак охотится за тобой! Уничтожь его',
        begin(d) {
          const p = P();
          const pos = W().randomWalkable(p.x, p.y, 10) || { x: p.x + 3, y: p.y };
          d.spawns = [{ tag: 'sha', spec: { mob: 'sha_enemy', tag: 'sha' }, at: pos, follow: true }];
          UI().bigBanner('КОТЧИ ВО МИРО!', 'Самонаводящаяся бомба Киры идёт на тепло твоего тела.');
        },
        marker: (d) => S.spawnPos(d, 'sha'),
        done: (d) => S.killed(d, 'sha'),
      },
      {
        text: 'Логово Киры Ёсикагэ. Положи конец спокойной жизни убийцы',
        marker: (d) => door(W().buildings[d.kiraHouse]),
        begin(d) {
          d.spawns = [{ tag: 'kira', spec: { boss: 'kira', tag: 'kira' }, at: door(W().buildings[d.kiraHouse]) }];
        },
        done: (d) => S.killed(d, 'kira'),
        end() {
          UI().say('Кира Ёсикагэ', ['Я... просто хотел... спокойной жизни...', '*Скорая помощь сбивает Киру. Призраки переулка утаскивают его душу.*']);
        },
      },
    ],
    reward: { money: 3000, xp: 900, items: { arrow: 1 }, text: 'Морио снова спит спокойно. Ты получил Стрелу отца Киры.' },
  };

  ARCS.dio = {
    title: 'Наследие ДИО',
    part: 3,
    intro: 'Фонд Спидвагона поднял тревогу: из моря подняли гроб. ДИО проснулся, и его наёмники-стенды уже ищут тебя.',
    setup(d) {
      const p = P();
      // ближайший офис фонда
      const sws = ['sw_ny', 'sw_london', 'sw_cairo'].map((k) => ({ k, pos: S.npcPos(k) })).filter((o) => o.pos);
      sws.sort((a, b) => J.dist(p.x, p.y, a.pos.x, a.pos.y) - J.dist(p.x, p.y, b.pos.x, b.pos.y));
      d.sw = sws.length ? sws[0].k : 'sw_cairo';
      d.ambush = 2;
    },
    stages: [
      {
        text: 'Поговори с агентом Фонда Спидвагона',
        marker: (d) => S.npcPos(d.sw),
        talk: {
          any_sw(d, done) {
            UI().say('Агент Фонда Спидвагона', ['ДИО жив. Он прячется в Каире, в особняке за городом.', 'Его слуги — стенд-юзеры с именами карт Таро. Они уже знают о тебе.', 'Мы оплатим билет. Отправляйся в Каир!'], () => {
              J.P.addMoney(P(), 800);
              UI().toast('Фонд выдал $800 на дорогу.', 'green');
              done();
            });
          },
        },
      },
      {
        text: 'Отправляйся в Каир (вокзал — быстрый путь). Будь готов к засадам',
        marker: () => ({ x: reg('cairo').x, y: reg('cairo').y }),
        begin(d) {
          d.ambushT = 4;
        },
        tick(d, mins) {
          d.ambushT -= mins / 60;
          if (d.ambushT <= 0 && d.ambush > 0) {
            d.ambush--;
            d.ambushT = 5 + Math.random() * 4;
            S.ambushStandUser('Наёмник ДИО', J.R.pick(['emperor', 'justice', 'death_13', 'tower_of_gray', 'geb', 'horus', 'anubis']));
          }
        },
        done: () => J.dist(P().x, P().y, reg('cairo').x, reg('cairo').y) < 30,
      },
      {
        text: 'Узнай у Мухаммеда Абдула (бар Каира), где особняк ДИО',
        marker: () => S.npcPos('avdol'),
        talk: {
          avdol(d, done) {
            UI().say('Мухаммед Абдул', ['Особняк ДИО? Он к северо-востоку от города, за стеной.', 'Его охраняет Ванилла Айс. Его стенд Крем стирает всё, к чему прикоснётся.', 'ДИО выходит только ночью. Солнце — твой союзник... но ночь — его.', 'Я отметил особняк на твоей карте. Бог тебе в помощь.'], done);
          },
        },
      },
      {
        text: 'Особняк ДИО: победи Ваниллу Айса у ворот',
        marker: () => door(W().buildings[W().places.dio_mansion]),
        begin(d) {
          const b = W().buildings[W().places.dio_mansion];
          d.spawns = [{ tag: 'vanilla', spec: { boss: 'vanilla', tag: 'vanilla' }, at: { x: b.door.x + 0.5, y: b.door.y + 3.5 } }];
        },
        done: (d) => S.killed(d, 'vanilla'),
      },
      {
        text: 'Встреться с ДИО (только ночью, 20:00–5:00)',
        marker: () => door(W().buildings[W().places.dio_mansion]),
        begin(d) {
          const b = W().buildings[W().places.dio_mansion];
          d.spawns = [{ tag: 'dio', spec: { boss: 'dio', tag: 'dio' }, at: { x: b.door.x + 0.5, y: b.door.y + 2 }, nightOnly: true }];
        },
        approach: {
          r: 9,
          night: true,
          fn(d) {
            const p = P();
            if (p.vampire || p.origin === 'brando') {
              UI().ask('ДИО', 'Хм... В тебе течёт тёмная кровь. Присоединяйся ко мне. Я дам тебе всё — вечность, власть, покой. Разве это не то, чего ты хочешь?', [
                { t: 'Служить ДИО', fn: () => S.joinDio(d) },
                { t: '«Я отказываюсь!»', fn: () => UI().say('ДИО', ['Тогда умри! WRYYYYY!']) },
              ]);
            } else UI().say('ДИО', ['Ты зашёл далеко, червь. Но ты так и не понял одного...', 'ЭТО БЫЛ Я, ДИО!']);
          },
        },
        done: (d) => S.killed(d, 'dio') || d.joined,
        end(d) {
          if (!d.joined) {
            UI().say('ДИО', ['Невозможно... Я... ДИО...', '*Тело ДИО рассыпается в рассветных лучах. Остаётся лишь кость и дневник.*']);
            J.P.addItem(P(), 'dio_diary', 1);
            J.P.addItem(P(), 'green_baby', 1);
          }
        },
      },
    ],
    reward: { money: 6000, xp: 1500, text: 'Проклятие ДИО снято... или нет?' },
  };

  ARCS.passione = {
    title: 'Золотой Ветер',
    part: 5,
    intro: 'Неаполь. Банда Пассионе продаёт наркотики детям, а её босс скрывает своё лицо. Говорят, у каждого члена банды есть «особая сила».',
    setup(d) {
      const shops = W().buildings.filter((b) => b.region === 'naples' && ['shop', 'restaurant', 'bar', 'dock', 'hotel'].includes(b.type));
      d.shops = J.R.shuffle(shops).slice(0, 3).map((b) => ({ id: b.id, done: false }));
      d.squad = J.R.shuffle(['grateful_dead', 'beach_boy', 'white_album', 'man_in_the_mirror', 'baby_face', 'metallica', 'kraft_work', 'green_day', 'oasis', 'spice_girl']).slice(0, 2);
    },
    stages: [
      {
        text: 'Встреться с Бруно Буччеллати у штаба Пассионе в Неаполе',
        marker: () => S.npcPos('bucciarati'),
        talk: {
          bucciarati(d, done) {
            const p = P();
            UI().say('Бруно Буччеллати', [
              'Ты хочешь в Пассионе? Посмотри мне в глаза... *облизывает твоё лицо* Ты не лжёшь.',
              p.stand ? 'У тебя есть стенд. Значит, испытание Польпо тебе не нужно.' : 'Чтобы вступить, нужно пройти испытание Польпо в тюрьме Неаполя.',
            ], done);
          },
        },
      },
      {
        skipIf: () => !!P().stand,
        text: 'Испытание Польпо: поговори с ним в тюрьме Неаполя',
        marker: () => door(bfind('polpo_prison', 'naples')),
        building: {
          polpo_prison(d, b, done) {
            UI().say('Польпо (за решёткой)', ['Новенький? Возьми эту зажигалку. Огонь не должен погаснуть 24 часа.', 'Если погаснет и ты зажжёшь его снова... ну, ты узнаешь, что будет. Хе-хе-хе.'], () => {
              J.P.addItem(P(), 'polpo_lighter', 1);
              d.lighterStart = G().time;
              done();
            });
          },
        },
      },
      {
        skipIf: () => !!P().stand,
        text: 'Не дай огню зажигалки погаснуть 24 часа',
        tick(d) {
          const p = P();
          const left = 1440 - (G().time - d.lighterStart);
          d.left = left;
          if (p.hp < p.maxHp * 0.6 && !d.sabbath && Math.random() < 0.02) {
            d.sabbath = true;
            UI().bigBanner('ОГОНЬ ПОГАС!', 'Ты зажёг его снова... Из тени выходит Чёрный Шабаш!');
            const pos = W().randomWalkable(p.x, p.y, 6) || p;
            d.spawns = [{ tag: 'sabbath', spec: { boss: 'black_sabbath', tag: 'sabbath' }, at: pos }];
          }
        },
        done: (d) => (d.sabbath ? S.killed(d, 'sabbath') : G().time - d.lighterStart >= 1440),
        end(d) {
          J.P.removeItem(P(), 'polpo_lighter');
          UI().say('Польпо', [d.sabbath ? 'Ты победил мой стенд?! Тогда Стрела уже в тебе... Поздравляю!' : 'Огонь горит. Ты прошёл. *Стрела пронзает тебя*'], () => {
            if (!P().stand) J.P.giveStand(P(), J.pickW(J.R, J.standPool((s) => s.part === 5)).s.id, 'Стрела Польпо пробудила твой стенд!');
          });
        },
      },
      {
        text: 'Собери дань Пассионе с трёх заведений Неаполя',
        marker: (d) => {
          const s = d.shops.find((x) => !x.done);
          return s ? door(W().buildings[s.id]) : null;
        },
        anyBuilding(d, b, done) {
          const s = d.shops.find((x) => x.id === b.id && !x.done);
          if (!s) return false;
          s.done = true;
          if (Math.random() < 0.5) {
            UI().toast('Владелец позвал громил!', 'red');
            S.spawnGroup('thug', 3, P().x, P().y, 6);
          } else {
            J.P.addMoney(P(), 150);
            UI().toast('Дань собрана: $150', 'green');
          }
          P().rep.passione += 1;
          if (d.shops.every((x) => x.done)) done();
          return true;
        },
      },
      {
        text: 'Отряд убийц Ла Сквадра охотится за тобой! Победи их',
        begin(d) {
          const p = P();
          d.spawns = d.squad.map((sid, i) => ({ tag: 'squad' + i, spec: { stand: sid, lvl: Math.max(5, p.lvl + 1), name: J.R.pick(['Прошутто', 'Пеши', 'Гьяччо', 'Иллюзо', 'Мелоне', 'Ризотто', 'Формаджо', 'Сорбет', 'Джелато']), tag: 'squad' + i }, at: W().randomWalkable(p.x, p.y, 12, J.R, {}) || p }));
          UI().bigBanner('ЛА СКВАДРА', 'Отряд убийц вышел на охоту. Их стенды смертельны.');
        },
        marker: (d) => S.spawnPos(d, 'squad0') || S.spawnPos(d, 'squad1'),
        done: (d) => S.killed(d, 'squad0') && S.killed(d, 'squad1'),
      },
      {
        text: 'Колизей в Риме: Босс Пассионе ждёт',
        marker: () => door(bfind('colosseum', 'rome')),
        begin(d) {
          const b = bfind('colosseum', 'rome');
          d.spawns = [{ tag: 'diavolo', spec: { boss: 'diavolo', tag: 'diavolo' }, at: { x: b.door.x + 0.5, y: b.door.y + 3 } }];
        },
        approach: {
          r: 10,
          fn() {
            UI().say('Дьяволо', ['В этом мире останутся только результаты. Процесс будет стёрт.', 'Кинг Кримсон!']);
          },
        },
        done: (d) => S.killed(d, 'diavolo'),
        end() {
          UI().say('Голос', ['Дьяволо обречён умирать снова и снова, никогда не достигая истины...', 'У тебя есть мечта. Ты — новый босс Пассионе.']);
          P().rep.passione += 10;
        },
      },
    ],
    reward: { money: 8000, xp: 1600, items: { arrow: 1 }, text: 'Ты забрал Стрелу из Колизея. Пассионе — твоя.' },
  };

  ARCS.pillar = {
    title: 'Боевое Направление',
    part: 2,
    intro: 'Под руинами в Мексике учёные нашли каменного человека в столбе. Он древнее человечества. И он просыпается ночью.',
    setup() {},
    stages: [
      {
        text: 'Поговори с фон Штрогеймом в Мексике (у отеля)',
        marker: () => S.npcPos('stroheim'),
        talk: {
          stroheim(d, done) {
            UI().say('Рудольф фон Штрогейм', ['НАУКА — ЛУЧШАЯ В МИРЕ! Но против этого существа она бессильна.', 'Люди из Столпа поглощают людей касанием. Солнце обращает их в камень.', 'Их можно убить только хамоном — дыханием солнца. Найди мастера: барон Цеппели в Лондоне, Тонпетти в Тибете, Лиза Лиза на острове.', 'Первый — Сантана — в руинах к западу. Он выходит ночью.'], done);
          },
        },
      },
      {
        text: 'Руины Мексики: победи Сантану (ночью). Хамон наносит ×2.5 урона',
        marker: () => door(W().buildings[W().places.pillar_ruins]),
        begin(d) {
          const b = W().buildings[W().places.pillar_ruins];
          d.spawns = [{ tag: 'santana', spec: { boss: 'santana', tag: 'santana' }, at: { x: b.door.x + 0.5, y: b.door.y + 2.5 }, nightOnly: true }];
          if (!P().hamon) UI().toast('Без хамона Люди из Столпа получают лишь 30% урона. Изучи хамон!', 'gold');
        },
        done: (d) => S.killed(d, 'santana'),
      },
      {
        skipIf: () => P().hamon && P().hamon.lvl >= 3,
        text: 'Освой хамон хотя бы до 3 уровня (мастера: Лондон, Тибет)',
        marker: () => S.npcPos(P().hamon ? 'tonpetty' : 'zeppeli'),
        done: () => P().hamon && P().hamon.lvl >= 3,
      },
      {
        text: 'Альпы: Ваму, воин ветра, пробудился (ночью)',
        marker: () => W().places.alps_ruins,
        begin(d) {
          d.spawns = [{ tag: 'wamuu', spec: { boss: 'wamuu', tag: 'wamuu' }, at: W().places.alps_ruins, nightOnly: true }];
        },
        done: (d) => S.killed(d, 'wamuu'),
        end() {
          UI().say('Ваму', ['Ты сражался как настоящий воин. Я... признаю тебя.']);
        },
      },
      {
        text: 'Катакомбы Рима: Эсидиси, повелитель жара (ночью)',
        marker: () => W().places.catacombs,
        begin(d) {
          d.spawns = [{ tag: 'esidisi', spec: { boss: 'esidisi', tag: 'esidisi' }, at: W().places.catacombs, nightOnly: true }];
        },
        done: (d) => S.killed(d, 'esidisi'),
      },
      {
        text: 'Карс пришёл за Красным камнем Айи. Он ждёт у руин Мексики (ночью)',
        marker: () => door(W().buildings[W().places.pillar_ruins]),
        begin(d) {
          const b = W().buildings[W().places.pillar_ruins];
          d.spawns = [{ tag: 'kars', spec: { boss: 'kars', tag: 'kars' }, at: { x: b.door.x - 2, y: b.door.y + 3 }, nightOnly: true }];
          UI().bigBanner('КАРС', 'Гений из Людей Столпа. Его клинки сияют как солнце.');
        },
        done: (d) => S.killed(d, 'kars'),
        end() {
          UI().say('Карс', ['Я стал бы... совершенным...', '*Карс превращается в камень и исчезает в небе. Красный камень Айи остался.*']);
        },
      },
    ],
    reward: { money: 5000, xp: 1800, items: { red_stone: 1 }, text: 'Люди из Столпа повержены. Красный камень Айи — твой.' },
  };

  ARCS.stone_ocean = {
    title: 'Каменный Океан',
    part: 6,
    intro: 'Флорида. Дочь Джотаро — Джолин Куджо — заперта в тюрьме «Грин Дельфин». Кто-то крадёт стенды и души в виде дисков.',
    setup(d) {
      d.inmates = J.R.shuffle(['stone_free', 'foo_fighters', 'diver_down', 'planet_waves', 'kiss', 'survivor', 'jumpin_jack_flash', 'weather_report']).filter((s) => s !== 'stone_free' && s !== 'weather_report').slice(0, 2);
      d.bone = randIn('florida', 40, { outside: true });
    },
    stages: [
      {
        text: 'Тюрьма «Грин Дельфин»: поговори с Джолин Куджо',
        marker: () => S.npcPos('jolyne'),
        talk: {
          jolyne(d, done) {
            UI().say('Джолин Куджо', ['Ты пришёл от отца? Он... без души. Её украли в виде диска.', 'Здесь двое заключённых нападают на всех и отнимают диски. Помоги мне!'], done);
          },
        },
      },
      {
        text: 'Победи двух стенд-юзеров во дворе тюрьмы (они роняют диски)',
        begin(d) {
          const b = W().buildings[W().places.green_dolphin];
          d.spawns = d.inmates.map((sid, i) => ({ tag: 'inmate' + i, spec: { stand: sid, lvl: Math.max(5, P().lvl), name: J.R.pick(['Джонгален', 'Торнадо', 'Миу Миу', 'Ланг Рангler', 'Сандерленд', 'Виви', 'Кенсо']), tag: 'inmate' + i, discDrop: true }, at: { x: b.door.x + 0.5 + (i ? 3 : -3), y: b.door.y + 4 } }));
        },
        marker: () => door(W().buildings[W().places.green_dolphin]),
        done: (d) => S.killed(d, 'inmate0') && S.killed(d, 'inmate1'),
      },
      {
        text: 'Найди «кость» — Зелёного младенца — на болотах Флориды',
        marker: (d) => d.bone,
        begin(d) {
          if (!d.bonePlaced) {
            d.bonePlaced = true;
            d.items = [{ x: d.bone.x, y: d.bone.y, item: 'green_baby', tag: 'bone' }];
          }
        },
        done: (d) => d.boneGot,
      },
      {
        text: 'Отец Пуччи требует младенца. Победи его у церкви Флориды',
        marker: () => door(bfind('church', 'florida')),
        begin(d) {
          d.spawns = [{ tag: 'pucci', spec: { boss: 'pucci', tag: 'pucci' }, at: door(bfind('church', 'florida')) }];
        },
        approach: {
          r: 9,
          fn() {
            UI().say('Энрико Пуччи', ['Спиральная лестница. Жук-носорог. Город-призрак. Фиговое дерево...', 'Отдай мне младенца. Это судьба.']);
          },
        },
        done: (d) => S.killed(d, 'pucci'),
        end() {
          UI().say('Энрико Пуччи', ['Ещё не конец... Мыс Канаверал! Там гравитация подарит мне Небеса!']);
        },
      },
      {
        text: 'Мыс Канаверал: останови Made in Heaven, пока время не ускорилось до конца',
        marker: () => door(W().buildings[W().places.cape]),
        begin(d) {
          d.spawns = [{ tag: 'mih', spec: { boss: 'pucci_mih', tag: 'mih' }, at: door(W().buildings[W().places.cape]) }];
        },
        approach: {
          r: 10,
          fn(d) {
            d.mihTimer = 240;
            UI().bigBanner('MADE IN HEAVEN', 'Время ускоряется! У тебя 4 минуты, пока Вселенная не перезапустится.');
          },
        },
        tick(d, mins, dt) {
          if (d.mihTimer !== undefined && !S.killed(d, 'mih')) {
            d.mihTimer -= dt;
            G().timeAccel = 1;
            if (d.mihTimer <= 0) {
              d.mihTimer = undefined;
              G().timeAccel = 0;
              UI().bigBanner('ВСЕЛЕННАЯ ПЕРЕЗАПУЩЕНА', 'Ты погиб в новом мире... Пуччи ждёт новой попытки.');
              J.kill(P(), null);
              S.resetSpawn(d, 'mih');
            }
          }
        },
        done: (d) => S.killed(d, 'mih'),
        end() {
          G().timeAccel = 0;
          UI().say('Энрико Пуччи', ['Нет... Это не может... Судьба...', '*Пуччи стирается из этой Вселенной. Время возвращается в норму.*']);
        },
      },
    ],
    reward: { money: 6000, xp: 1700, discs: 3, text: 'Коллекция дисков Пуччи — твоя: три стенд-диска.' },
  };

  ARCS.sbr = {
    title: 'Steel Ball Run',
    part: 7,
    intro: 'Великая гонка через Америку! Приз — 50 миллионов долларов. Но настоящий приз — части Святого Трупа, спрятанные в пустыне.',
    setup(d) {
      d.parts = J.R.shuffle(J.CORPSE_PARTS.map((c) => c.id)).filter((id) => !P().corpse.includes(id));
      d.find = d.parts.slice(0, Math.min(5, d.parts.length)).map((id) => {
        const pt = randIn('arizona', 70, { outside: true });
        return { x: pt.x, y: pt.y, part: id };
      });
    },
    stages: [
      {
        text: 'Сан-Диего: поговори с Джайро Цеппели в штабе Steel Ball Run',
        marker: () => S.npcPos('gyro'),
        talk: {
          gyro(d, done) {
            const p = P();
            UI().say('Джайро Цеппели', [
              'Ньо-хо-хо! Ещё один гонщик? Без лошади тут делать нечего.',
              p.spin ? 'Ты уже знаешь Вращение. Отлично.' : 'Смотри: стальной шар. Вращение — техника семьи Цеппели. Держи пару шаров. Учиться — у меня.',
              'В пустыне Аризоны спрятаны части Святого Трупа. Кто соберёт их — получит силу. За ними охотится сам президент.',
            ], () => {
              if (!J.P.hasItem(p, 'steel_ball')) J.P.addItem(p, 'steel_ball', 1);
              if (!p.spin) J.P.learnStyle(p, 'spin');
              if (!J.P.hasItem(p, 'horse')) {
                J.P.addItem(p, 'horse', 1);
                UI().toast('Джайро одолжил тебе лошадь. Клавиша H — сесть верхом.', 'gold');
              }
              done();
            });
          },
        },
      },
      {
        text: 'Найди части Святого Трупа в пустыне Аризоны',
        begin(d) {
          d.items = d.find.map((f, i) => ({ x: f.x, y: f.y, item: 'corpse_part', meta: { part: f.part }, tag: 'part' + i }));
          d.got = 0;
          d.guards = 0;
        },
        marker: (d) => d.find.find((f, i) => !(d.gotTags || {})['part' + i]),
        tick(d, mins) {
          d.guardT = (d.guardT || 3) - mins / 60;
          if (d.guardT <= 0 && d.guards < 3) {
            d.guardT = 6;
            d.guards++;
            S.ambushStandUser('Агент Валентайна', J.R.pick(['scary_monsters', 'mandom', 'catch_the_rainbow', 'cream_starter', 'twentieth_century_boy']));
          }
        },
        done: (d) => d.got >= d.find.length,
      },
      {
        text: 'Финиш гонки — Нью-Йорк. Президент Валентайн ждёт',
        marker: () => S.npcPos('sw_ny') || { x: reg('newyork').x, y: reg('newyork').y },
        begin(d) {
          const pos = W().randomWalkable(reg('newyork').x, reg('newyork').y, 8, J.R, { street: true }) || { x: reg('newyork').x, y: reg('newyork').y };
          d.spawns = [{ tag: 'valentine', spec: { boss: 'valentine', tag: 'valentine' }, at: pos }];
        },
        approach: {
          r: 10,
          fn() {
            UI().say('Фанни Валентайн', ['Ради моей страны я заберу все части Трупа. Это справедливо.', 'Ты знаешь, почему салфетку кладут слева? ...Неважно. D4C!']);
          },
        },
        done: (d) => S.killed(d, 'valentine'),
        end(d) {
          const left = J.CORPSE_PARTS.filter((c) => !P().corpse.includes(c.id));
          left.forEach((c) => J.P.addItem(P(), 'corpse_part', 1, { part: c.id }));
        },
      },
    ],
    reward: { money: 10000, xp: 1800, text: 'Ты победил в гонке и забрал части Святого Трупа у Валентайна.' },
  };

  // ---------- Инициализация ----------
  const FIRST = { student: 'morioh', joestar: 'dio', gangster: 'passione', zeppeli: 'pillar', archaeologist: 'pillar', jockey: 'sbr', brando: 'dio', prisoner: 'stone_ocean' };
  S.init = function () {
    const p = P();
    const all = Object.keys(ARCS);
    let order = J.R.shuffle(all);
    const first = FIRST[p.origin];
    if (first) order = [first].concat(order.filter((a) => a !== first));
    G().story = {
      fate: order,
      fateN: 3,
      idx: 0,
      arc: null,
      nextArcDay: 2,
      done: [],
      side: [],
      log: [],
      eventT: 240,
      seenIntro: false,
      sid: 1,
    };
    S.placeNpcs();
  };
  S.load = function (data) {
    G().story = data;
    S.placeNpcs();
    // восстановить подбираемые предметы сюжета
    const st = data;
    if (st.arc) S.restoreItems(st.arc.d);
    st.side.forEach((q) => S.restoreItems(q));
  };
  S.serialize = () => {
    const s = G().story;
    return JSON.parse(JSON.stringify(s, (k, v) => (k === 'ent' || k === 'pk' ? undefined : v)));
  };

  S.placeNpcs = function () {
    const pos = {};
    for (const k in S.NPCS) {
      const n = S.NPCS[k];
      const b = W().findBuilding(n.b[0], n.b[1]);
      if (!b) continue;
      let x = b.door.x + 0.5 + 1.6, y = b.door.y + 1.7;
      if (J.blocked(x, y, 0.3, {})) {
        x = b.door.x + 0.5 - 1.6;
        if (J.blocked(x, y, 0.3, {})) x = b.door.x + 0.5;
      }
      pos[k] = { x, y };
    }
    S.npcPosMap = pos;
  };
  S.npcPos = (k) => S.npcPosMap && S.npcPosMap[k] ? Object.assign({ label: S.NPCS[k].name }, S.npcPosMap[k]) : null;

  // ---------- Основной цикл ----------
  S.killed = (d, tag) => !!(d.dead && d.dead[tag]);
  S.spawnPos = (d, tag) => {
    const s = (d.spawns || []).find((x) => x.tag === tag);
    if (!s) return null;
    const e = G().ents.find((o) => o.storyTag === tag && !o.dead);
    return e ? { x: e.x, y: e.y } : s.at;
  };
  S.resetSpawn = (d, tag) => {
    const e = G().ents.find((o) => o.storyTag === tag && !o.dead);
    if (e) e.despawn = true;
  };

  S.restoreItems = function (d) {
    if (!d || !d.items) return;
    d.gotTags = d.gotTags || {};
    for (const it of d.items) {
      if (d.gotTags[it.tag]) continue;
      if (G().pickups.some((p) => p.storyTag === it.tag)) continue;
      const pk = J.spawnPickup(it.x, it.y, it.item, 1, it.meta, true);
      pk.storyTag = it.tag;
      pk.lore = it.lore;
      pk.storyD = d;
    }
  };

  S.curStage = () => {
    const st = G().story;
    if (!st || !st.arc) return null;
    return ARCS[st.arc.id].stages[st.arc.stage];
  };

  S.startArc = function (id) {
    const st = G().story;
    const arc = ARCS[id];
    st.arc = { id, stage: 0, d: {} };
    arc.setup(st.arc.d);
    UI().bigBanner(arc.title, arc.intro, true);
    S.log(`Новая глава: «${arc.title}»`);
    S.enterStage();
  };
  S.enterStage = function () {
    const st = G().story;
    const arc = ARCS[st.arc.id];
    const sg = arc.stages[st.arc.stage];
    if (!sg) return S.finishArc();
    if (sg.skipIf && sg.skipIf(st.arc.d)) {
      st.arc.stage++;
      return S.enterStage();
    }
    const d = st.arc.d;
    d.dead = d.dead || {};
    d.spawns = [];
    d.items = null;
    if (sg.begin) sg.begin(d);
    S.restoreItems(d);
    UI().toast('Цель: ' + sg.text, 'quest');
    UI().questDirty();
  };
  S.advance = function () {
    const st = G().story;
    const arc = ARCS[st.arc.id];
    const sg = arc.stages[st.arc.stage];
    if (sg && sg.end) sg.end(st.arc.d);
    st.arc.stage++;
    if (st.arc.stage >= arc.stages.length) S.finishArc();
    else S.enterStage();
  };
  S.finishArc = function () {
    const st = G().story;
    const arc = ARCS[st.arc.id];
    const p = P();
    const rw = arc.reward;
    J.P.addMoney(p, rw.money || 0);
    J.P.gainXp(p, rw.xp || 0);
    if (rw.items) for (const k in rw.items) J.P.addItem(p, k, rw.items[k]);
    if (rw.discs) for (let i = 0; i < rw.discs; i++) J.P.addItem(p, 'stand_disc', 1);
    st.done.push(st.arc.id);
    S.log(`Глава «${arc.title}» завершена. ${rw.text}`);
    UI().bigBanner('ГЛАВА ЗАВЕРШЕНА', `«${arc.title}». ${rw.text} +${J.fmtMoney(rw.money || 0)}`, false, true);
    st.arc = null;
    st.idx++;
    st.nextArcDay = G().day + 2;
    UI().questDirty();
  };
  S.joinDio = function (d) {
    d.joined = true;
    const p = P();
    UI().bigBanner('ТЫ СЛУЖИШЬ ДИО', 'ДИО дарит тебе свою кровь. Мир теперь принадлежит вам.');
    if (!p.vampire) J.P.useMask(p);
    J.P.addMoney(p, 5000);
    const e = G().ents.find((o) => o.storyTag === 'dio');
    if (e) {
      e.team = 'neutral';
      e.despawn = true;
    }
  };

  S.log = (t) => {
    const st = G().story;
    st.log.unshift({ day: G().day, t });
    if (st.log.length > 40) st.log.pop();
  };

  // Вызывается каждый кадр
  S.update = function (dt) {
    const g = G();
    const st = g.story;
    const p = P();
    if (!st) return;
    S._t = (S._t || 0) + dt;
    S._dt = (S._dt || 0) + dt;
    if (S._t < 0.5) return;
    const realDt = S._dt;
    S._dt = 0;
    S._t = 0;
    S.updateNpcs();
    // начать арку
    if (!st.arc && g.day >= st.nextArcDay && st.idx < st.fate.length) {
      if (st.idx === st.fateN && !st.fateMsg) {
        st.fateMsg = true;
        UI().bigBanner('СУДЬБА НЕ ЗАКОНЧЕНА', 'Три главы твоей истории позади. Но мир полон стенд-юзеров...');
      }
      S.startArc(st.fate[st.idx]);
    }
    const lists = [];
    if (st.arc) lists.push(st.arc.d);
    st.side.forEach((q) => lists.push(q));
    for (const d of lists) S.handleSpawns(d);
    if (st.arc) {
      const sg = S.curStage();
      const d = st.arc.d;
      if (sg) {
        if (sg.tick) sg.tick(d, 0, realDt);
        if (sg.approach && !d['ap' + st.arc.stage]) {
          const m = sg.marker ? sg.marker(d) : null;
          if (m && J.dist(p.x, p.y, m.x, m.y) < sg.approach.r && (!sg.approach.night || g.isNight)) {
            d['ap' + st.arc.stage] = true;
            sg.approach.fn(d);
          }
        }
        if (sg.done && sg.done(d)) S.advance();
      }
    }
    // побочные квесты
    for (const q of st.side.slice()) S.sideCheck(q);
    // фазы боссов
    for (const e of g.ents) {
      if (!e.boss || e.dead || !e.phases) continue;
      for (const ph of e.phases) {
        if (!ph.done && e.hp < e.maxHp * ph.at) {
          ph.done = true;
          if (ph.stand) {
            e.stand = { id: ph.stand, lvl: e.stand ? e.stand.lvl : 8 };
            J.P.seeStand(p, ph.stand);
          }
          J.R3.text(e.x, e.y, ph.text, 'tbig', 2);
          UI().toast(e.name + ': «' + ph.text + '»', 'red');
        }
      }
    }
  };

  // Вызывается при течении игрового времени
  S.tick = function (mins) {
    const st = G().story;
    if (!st) return;
    if (st.arc) {
      const sg = S.curStage();
      if (sg && sg.tick) sg.tick(st.arc.d, mins, 0);
    }
    st.eventT -= mins;
    if (st.eventT <= 0) {
      st.eventT = 150 + Math.random() * 240;
      S.randomEvent();
    }
    // истечение побочных квестов
    st.side = st.side.filter((q) => {
      if (q.expires && G().time > q.expires) {
        UI().toast('Задание провалено (время вышло): ' + q.title, 'muted');
        S.cleanupSide(q);
        return false;
      }
      return true;
    });
  };

  S.handleSpawns = function (d) {
    if (!d.spawns) return;
    const g = G();
    const p = P();
    d.dead = d.dead || {};
    for (const s of d.spawns) {
      if (d.dead[s.tag]) continue;
      const ent = g.ents.find((o) => o.storyTag === s.tag && !o.dead);
      const nightOnly = s.nightOnly || (s.spec.boss && BOSS[s.spec.boss] && BOSS[s.spec.boss].nightOnly);
      if (ent) {
        if (nightOnly && !g.isNight) {
          ent.despawn = true;
          UI().toast(ent.name + ' исчезает с первыми лучами солнца...', 'muted');
        }
        continue;
      }
      if (!s.at) continue;
      if (nightOnly && !g.isNight) continue;
      if (J.dist(p.x, p.y, s.at.x, s.at.y) > 38) continue;
      let x = s.at.x, y = s.at.y;
      if (J.blocked(x, y, 0.35, {})) {
        const q = g.world.randomWalkable(x, y, 4);
        if (q) {
          x = q.x;
          y = q.y;
        }
      }
      const e = S.spawnSpec(s.spec, x, y);
      e.storyTag = s.tag;
      e.discDrop = s.spec.discDrop;
      if (e.boss) J.P.seeStand(p, e.stand ? e.stand.id : null);
    }
  };

  S.onKill = function (e, killer) {
    const st = G().story;
    if (!st) return;
    if (e.storyTag) {
      const lists = [];
      if (st.arc) lists.push(st.arc.d);
      st.side.forEach((q) => lists.push(q));
      for (const d of lists) {
        if ((d.spawns || []).some((s) => s.tag === e.storyTag)) {
          d.dead = d.dead || {};
          d.dead[e.storyTag] = true;
        }
      }
      if (e.discDrop && e.stand) J.spawnPickup(e.x, e.y, 'stand_disc', 1, { stand: e.stand.id });
      if (e.boss) {
        UI().toast(`${e.name} повержен!`, 'gold');
        J.R3.text(e.x, e.y, 'ПОБЕДА', 'tbig', 2);
        if (e.stand) P().codex[e.stand.id] = P().codex[e.stand.id] || 'seen';
      }
    }
    // случайные стенд-юзеры иногда роняют Стрелу
    if (e.standUser && !e.boss && killer && Math.random() < 0.025) J.spawnPickup(e.x, e.y, 'arrow', 1);
    if (e.standUser && !e.boss && killer && P().origin === 'prisoner' && Math.random() < 0.12) J.spawnPickup(e.x, e.y, 'stand_disc', 1, { stand: e.stand ? e.stand.id : undefined });
  };

  S.onPickup = function (pk) {
    const d = pk.storyD;
    if (!d) return;
    d.gotTags = d.gotTags || {};
    d.gotTags[pk.storyTag] = true;
    if (pk.lore) UI().say('Улика', [pk.lore]);
    if (pk.item === 'clue') {
      d.found = (d.found || 0) + 1;
      J.P.removeItem(P(), 'clue', 1);
    }
    if (pk.item === 'green_baby') d.boneGot = true;
    if (pk.item === 'corpse_part') d.got = (d.got || 0) + 1;
    if (d.sideType) S.sidePicked(d, pk);
  };
  S.onStand = () => UI().questDirty();
  S.onVampire = () => {};
  S.onReveal = () => {
    // раскрываем скрытых стенд-юзеров среди прохожих
    for (const e of G().ents) {
      if (e.kind === 'civ' && e.hiddenStand && J.dist(e.x, e.y, P().x, P().y) < 25) J.R3.text(e.x, e.y, 'СТЕНД-ЮЗЕР', 'tred', 3);
    }
  };
  S.onDrain = () => {
    const p = P();
    if ((p.flags.drains || 0) % 4 === 3) {
      UI().toast('Слухи о вампире в городе... На тебя объявили охоту!', 'red');
      for (let i = 0; i < 2; i++) {
        const pos = W().randomWalkable(p.x, p.y, 12) || p;
        const e = J.makeMob('thug', pos.x, pos.y, Math.max(2, p.lvl));
        e.name = 'Охотник с хамоном';
        e.hamonHunter = true;
        e.look.top = '#ffd84a';
        e.spells = [{ name: 'Хамон-удар', kind: 'strike', dmg: 30, range: 1.8, cd: 4, color: '#ffd84a', dmgKind: 'hamon' }];
        J.addEnt(e);
      }
    }
  };
  S.bossAggro = function (e) {
    UI().menacing(e);
  };

  // Здания: сюжетные хуки. Возвращает true, если событие обработано
  S.onBuilding = function (b) {
    const st = G().story;
    if (!st || !st.arc) return false;
    const sg = S.curStage();
    if (!sg) return false;
    const d = st.arc.d;
    if (sg.building && sg.building[b.type]) {
      sg.building[b.type](d, b, () => S.advance());
      return true;
    }
    if (sg.anyBuilding && sg.anyBuilding(d, b, () => S.advance())) return true;
    return false;
  };

  // ---------- Сюжетные NPC ----------
  S.updateNpcs = function () {
    const g = G();
    const p = P();
    for (const k in S.npcPosMap) {
      const pos = S.npcPosMap[k];
      const d = J.dist(p.x, p.y, pos.x, pos.y);
      let ent = g.ents.find((e) => e.npcKey === k && !e.dead);
      const hidden = k === 'pucci' && (G().story.done.includes('stone_ocean') || (G().story.arc && G().story.arc.id === 'stone_ocean' && G().story.arc.stage >= 3));
      if (d < 45 && !ent && !hidden) {
        const n = S.NPCS[k];
        ent = new J.Ent({ kind: 'story', team: 'neutral', npcKey: k, name: n.name, look: Object.assign({}, n.look), x: pos.x, y: pos.y, maxHp: 999, face: Math.PI / 2 });
        ent.ai = { civ: true, still: true };
        J.addEnt(ent);
      } else if (ent && (d > 60 || hidden)) ent.despawn = true;
    }
  };

  S.talk = function (e) {
    const st = G().story;
    const p = P();
    e.ai && (e.ai.talk = 4);
    if (e.kind === 'story') {
      const k = e.npcKey;
      // сюжетный разговор
      if (st.arc) {
        const sg = S.curStage();
        if (sg && sg.talk) {
          const fn = sg.talk[k] || (k.startsWith('sw_') && sg.talk.any_sw);
          if (fn) {
            fn(st.arc.d, () => S.advance());
            return;
          }
        }
      }
      return S.npcChat(k, e);
    }
    // прохожие
    if (e.hiddenStand && p.stand && !e.revealed) {
      e.revealed = true;
      if (Math.random() < 0.55) {
        UI().say(e.name, ['Ты... Ты тоже это видишь? Твой стенд...', 'Стенд-юзеры притягиваются друг к другу. Значит, один из нас должен уйти. УМРИ!'], () => {
          const en = J.makeStandUser(e.x, e.y, Math.max(2, p.lvl), null, { name: e.name, look: e.look });
          e.despawn = true;
          J.addEnt(en);
          UI().menacing(en);
        });
      } else {
        UI().say(e.name, ['Вижу, у тебя есть стенд. У меня тоже. Не будем драться, ладно?', S.rumorLine()]);
        J.P.addMoney(p, 0);
      }
      return;
    }
    const rg = W().regionAt(e.x, e.y);
    const pool = (J.LINES[rg.id] || []).concat(J.LINES.any);
    let line = G().isNight && Math.random() < 0.3 ? J.R.pick(J.NIGHT_LINES) : J.R.pick(pool);
    if (Math.random() < 0.2) line = S.rumorLine();
    if (e.drained) line = '...ммм... кружится голова...';
    UI().say(e.name, [line]);
    if (Math.random() < 0.3) J.P.trainStat(p, 'cha', 0.5);
  };

  S.rumorLine = function () {
    const st = G().story;
    const q = st.side.find((x) => x.sideType === 'treasure');
    if (q) return `Слышал, в районе «${W().regionAt(q.x, q.y).name}» кто-то видел ${q.item === 'arrow' ? 'странную стрелу' : 'каменную маску'}.`;
    const opts = [
      'Говорят, Фонд Спидвагона платит большие деньги за каменные маски.',
      'В пустыне Аризоны есть место, где песок шепчет. Дьявольская ладонь...',
      'Говорят, на чёрном рынке продают Стрелы. За бешеные деньги.',
      'Мастер хамона живёт в тибетском храме. Он учит дышать как солнце.',
      'На острове у Венеции — школа хамона Лизы Лизы. Лодка — с пристани Венеции.',
      'В Колизее устраивают бои. Можно неплохо заработать.',
      'Раскопки в Каире и Мексике иногда находят древние артефакты.',
    ];
    return J.R.pick(opts);
  };

  S.npcChat = function (k, e) {
    const p = P();
    const say = (lines, then) => UI().say(e.name, lines, then);
    switch (k) {
      case 'jotaro':
        return say([J.R.pick(['Яре яре дазе.', 'Хмф. Ты всё ещё здесь?', 'Стенды — это воплощение духа. Тренируй дух.']), p.stand ? `Твой стенд ${J.STANDS[p.stand.id].ru}... ${J.rankNum(J.STANDS[p.stand.id].st.pot) >= 4 ? 'У него большой потенциал.' : 'Используй его с умом.'}` : 'Без стенда тебе здесь опасно.']);
      case 'rohan':
        return UI().ask(e.name, 'Ты выглядишь интересно. Хочешь, я прочту тебя как книгу? Хевенс Дор!', [
          {
            t: 'Позволить прочесть себя',
            fn: () => {
              const facts = [`Имя: ${p.name}. Уровень ${p.lvl}.`, p.stand ? `Стенд: ${J.STANDS[p.stand.id].ru}, ур. ${p.stand.lvl}.` : 'Стенда нет. Скучно.', p.vampire ? 'Вампир! Как интересно!' : p.hamon ? `Хамон ${p.hamon.lvl} ур.` : 'Обычный человек.', `Шанс пережить Стрелу: ${Math.round(J.P.arrowChance(p) * 100)}%.`];
              say(facts.concat(['*Рохан вписал на твоей странице: «Становится чуточку смышлёнее»*']), () => J.P.trainStat(p, 'int', 8));
            },
          },
          { t: 'Нет, спасибо', fn: () => say(['Хмф. Отказываю тебе в интересе!']) },
        ]);
      case 'josuke':
        return say([J.R.pick(['Эй! Что ты сказал про мою причёску?!', 'Безумный Бриллиант может починить что угодно. Кроме меня самого.', 'Тебе нужна помощь? Морио — мой город.'])]);
      case 'tonio':
        return say(['Буонджорно! Траттория Труссарди готовит только для гостей.', 'Зайди внутрь — мой ужин вылечит всё: от зубов до плеч.']);
      case 'zeppeli':
        return S.hamonMaster(e, 4, 0, 'Хамон — дыхание солнца. Хочешь научиться? Тогда — как насчёт удара по лягушке?');
      case 'tonpetty':
        return S.hamonMaster(e, 7, 2, 'Дыши. Дыши как ветер в горах. Только так твой хамон станет сильнее.');
      case 'lisalisa':
        return S.hamonMaster(e, 10, 4, 'Ты пришёл учиться? Здесь будет больно. Очень больно.');
      case 'gyro':
        return S.spinMaster(e);
      case 'bucciarati':
        return say(['Если тебе нужна работа — зайди в штаб. У Пассионе всегда есть поручения.', p.rep.passione > 5 ? 'Ты хорошо работаешь. Арриведерчи.' : 'Помни: предатели долго не живут.']);
      case 'jolyne':
        return say(['Тюрьма — это ещё не конец. Стоун Фри!', 'Отец всегда был холодным... но он пришёл за мной.']);
      case 'pucci':
        return say(['Ты веришь в судьбу? Я — да.', 'Считай простые числа, когда тебе страшно. 2, 3, 5, 7, 11...']);
      case 'avdol':
        return say(['Я — Мухаммед Абдул. Предсказатель.', p.stand ? `Твой стенд. Его карта — ${J.R.pick(['Звезда', 'Маг', 'Колесница', 'Мир', 'Шут', 'Отшельник', 'Император'])}.` : 'Тебе суждено встретить Стрелу.']);
      case 'stroheim':
        return say(['НЕМЕЦКАЯ НАУКА — ЛУЧШАЯ В МИРЕ!', 'Если увидишь людей из Столпа — беги к солнцу.']);
      default:
        if (k.startsWith('sw_')) return S.speedwagon(e);
    }
  };

  S.hamonMaster = function (e, maxLvl, minLvl, greet) {
    const p = P();
    const opts = [];
    if (p.vampire) {
      return UI().say(e.name, ['Ты... вампир! Хамон сожжёт тебя. Уходи, пока я не передумал!']);
    }
    if ((p.hamon ? p.hamon.lvl : 0) < minLvl) {
      return UI().say(e.name, [greet, `Но тебе рано учиться у меня. Нужен хамон ${minLvl} уровня.`, minLvl > 2 ? 'Сначала поучись у Тонпетти в Тибете.' : 'Сначала поучись у барона Цеппели в Лондоне.']);
    }
    if (p.hamon && p.hamon.lvl >= maxLvl) {
      return UI().say(e.name, [greet, 'Мне больше нечему тебя учить. Иди дальше.', maxLvl < 10 ? (maxLvl === 4 ? 'В Тибете есть мастер Тонпетти.' : 'Лиза Лиза на острове Эйр-Сапплена — сильнейший мастер.') : 'Ты — мастер хамона.']);
    }
    const price = p.hamon ? 60 + p.hamon.lvl * 40 : 0;
    opts.push({
      t: p.hamon ? `Тренировка дыхания (${J.fmtMoney(price)}, 3 ч)` : 'Научиться хамону',
      fn: () => {
        if (p.money < price) return UI().toast('Не хватает денег.', 'red');
        if (p.energy < 20) return UI().toast('Слишком устал. Отдохни.', 'red');
        J.P.addMoney(p, -price);
        UI().minigame('breath', { title: 'Тренировка хамона', master: e.name }, (score) => {
          J.Game.passTime(180);
          p.energy = Math.max(0, p.energy - 20);
          if (!p.hamon) {
            if (score >= 2) {
              J.P.learnStyle(p, 'hamon');
              UI().bigBanner('ХАМОН', 'Ты научился дыханию солнца! Клавиши 1, 2, 3 — приёмы. V — дыхание. С хамоном 2+ можно ходить по воде.');
            } else UI().toast('Неудача. Дыхание сбилось. Попробуй ещё раз.', 'muted');
            return;
          }
          const gain = score * 22 * (p.origin === 'zeppeli' ? 1.3 : 1);
          J.P.styleXp(p, 'hamon', gain);
          J.P.trainStat(p, 'end', score * 3);
          UI().toast(`Хамон +${Math.round(gain)} опыта`, 'gold');
        });
      },
    });
    if (p.hamon && J.P.hasItem(p, 'clackers') === false && maxLvl >= 7) opts.push({ t: 'Купить клакеры ($450)', fn: () => (p.money >= 450 ? (J.P.addMoney(p, -450), J.P.addItem(p, 'clackers', 1)) : UI().toast('Не хватает денег.', 'red')) });
    opts.push({ t: 'Уйти', fn: () => {} });
    UI().ask(e.name, greet, opts);
  };

  S.spinMaster = function (e) {
    const p = P();
    const price = p.spin ? 80 + p.spin.lvl * 50 : 0;
    UI().ask(e.name, 'Ньо-хо-хо! Вращение — это техника. Золотое сечение, понимаешь?', [
      {
        t: p.spin ? `Тренировка вращения (${J.fmtMoney(price)}, 3 ч)` : 'Научиться вращению',
        fn: () => {
          if (p.money < price) return UI().toast('Не хватает денег.', 'red');
          J.P.addMoney(p, -price);
          UI().minigame('spin', { title: 'Тренировка вращения' }, (score) => {
            J.Game.passTime(180);
            if (!p.spin) {
              J.P.learnStyle(p, 'spin');
              if (!J.P.hasItem(p, 'steel_ball')) J.P.addItem(p, 'steel_ball', 1);
              UI().bigBanner('ВРАЩЕНИЕ', 'Ты освоил основы вращения. Нужны стальные шары. Т — смена стиля, 1/2/3 — приёмы.');
              return;
            }
            J.P.styleXp(p, 'spin', score * 22);
            UI().toast(`Вращение +${score * 22} опыта`, 'gold');
          });
        },
      },
      { t: 'Уйти', fn: () => {} },
    ]);
  };

  S.speedwagon = function (e) {
    const p = P();
    const opts = [];
    const sell = { stone_mask: 20000, arrow: 25000, red_stone: 40000, dio_diary: 8000 };
    for (const k in sell) if (J.P.hasItem(p, k)) opts.push({ t: `Продать: ${J.ITEMS[k].name} (${J.fmtMoney(sell[k])})`, fn: () => { J.P.removeItem(p, k); J.P.addMoney(p, sell[k]); p.rep.speedwagon += 3; UI().toast('Фонд благодарит тебя.', 'green'); } });
    opts.push({ t: 'Спросить о слухах', fn: () => UI().say(e.name, [S.rumorLine()]) });
    opts.push({ t: 'Задание фонда (охота на вампиров)', fn: () => S.offerSide('vampnest') });
    opts.push({ t: 'Уйти', fn: () => {} });
    UI().ask(e.name, 'Фонд Спидвагона изучает всё сверхъестественное. Чем можем помочь?', opts);
  };

  // ---------- Побочные квесты ----------
  S.SIDE = {
    delivery: 'Доставка',
    bounty: 'Охота за головой',
    cat: 'Потерявшийся кот',
    treasure: 'Слух о сокровище',
    thugs: 'Защита магазина',
    vampnest: 'Гнездо вампиров',
    arena: 'Бой на арене',
    corpse: 'Часть Святого Трупа',
  };
  S.offerSide = function (type, b) {
    const q = S.makeSide(type, b);
    if (!q) return UI().toast('Сейчас нет подходящих заданий.', 'muted');
    UI().ask('Задание: ' + q.title, q.desc + `\nНаграда: ${J.fmtMoney(q.reward)}`, [
      { t: 'Принять', fn: () => S.acceptSide(q) },
      { t: 'Отказаться', fn: () => {} },
    ]);
  };
  S.acceptSide = function (q) {
    const st = G().story;
    if (st.side.length >= 6) return UI().toast('Слишком много заданий. Заверши старые.', 'red');
    st.side.push(q);
    if (q.onAccept) S.sideAccept(q);
    S.restoreItems(q);
    UI().toast('Новое задание: ' + q.title, 'quest');
    UI().questDirty();
  };
  S.makeSide = function (type, b) {
    const p = P();
    const st = G().story;
    const id = 'q' + st.sid++;
    const here = W().regionAt(p.x, p.y);
    const lvl = Math.max(1, p.lvl);
    const exp = (h) => G().time + h * 60;
    const q = { id, sideType: type, dead: {}, spawns: [] };
    switch (type) {
      case 'delivery': {
        const regions = J.REGIONS.filter((r) => r.buildings && r.buildings.length > 1);
        const far = Math.random() < 0.4;
        const rr = far ? J.R.pick(regions) : (regions.find((r) => r.id === here.id) || J.R.pick(regions));
        const cand = W().buildings.filter((x) => x.region === rr.id && x.type !== 'house' && x !== b);
        if (!cand.length) return null;
        const to = J.R.pick(cand);
        Object.assign(q, { title: `${S.SIDE.delivery}: ${to.name} (${rr.name})`, desc: `Отнеси посылку в «${to.name}», ${rr.name}.`, to: to.id, reward: Math.round(60 + J.dist(p.x, p.y, to.door.x, to.door.y) * 1.6), expires: exp(far ? 72 : 24), onAccept: 'package' });
        return q;
      }
      case 'bounty': {
        const pos = W().randomWalkable(here.x, here.y, 70, J.R, { outside: true }) || W().randomWalkable(here.x, here.y, 30);
        if (!pos) return null;
        const sid = J.pickW(J.R, J.standPool()).s.id;
        const nm = J.R.pick(['Безумный', 'Тихий', 'Кровавый', 'Неуловимый', 'Странный']) + ' ' + J.R.pick(['Джек', 'Карл', 'Лука', 'Ханс', 'Ким', 'Мигель', 'Омар']);
        Object.assign(q, { title: `${S.SIDE.bounty}: ${nm}`, desc: `Стенд-юзер ${nm} скрывается за городом. Его стенд — ${J.STANDS[sid].ru}.`, reward: 250 + lvl * 90, expires: exp(72), x: pos.x, y: pos.y });
        q.spawns = [{ tag: id + 'b', spec: { stand: sid, lvl: lvl + 1, name: nm, tag: id + 'b' }, at: pos }];
        return q;
      }
      case 'cat': {
        const pos = W().randomWalkable(here.x, here.y, 28);
        if (!pos || !b) return null;
        Object.assign(q, { title: S.SIDE.cat, desc: 'Кот сбежал! Найди его и принеси обратно.', reward: 70 + lvl * 10, expires: exp(36), x: pos.x, y: pos.y, back: b.id });
        q.items = [{ x: pos.x, y: pos.y, item: 'cat', tag: id + 'c' }];
        return q;
      }
      case 'thugs': {
        if (!b) return null;
        const pos = door(b);
        Object.assign(q, { title: `${S.SIDE.thugs}: ${b.name}`, desc: 'Громилы угрожают владельцу. Прогони их.', reward: 90 + lvl * 25, expires: exp(12), x: pos.x, y: pos.y });
        q.spawns = [0, 1, 2].map((i) => ({ tag: id + 't' + i, spec: { mob: lvl > 4 ? 'gangster' : 'thug', lvl, tag: id + 't' + i }, at: { x: pos.x + i - 1, y: pos.y + 1.5 } }));
        return q;
      }
      case 'vampnest': {
        const pos = W().randomWalkable(here.x, here.y, 60, J.R, { outside: true });
        if (!pos) return null;
        Object.assign(q, { title: S.SIDE.vampnest, desc: 'Ночью здесь собираются вампир и его зомби. Уничтожь гнездо (лучше днём — но они выходят только ночью).', reward: 400 + lvl * 80, expires: exp(96), x: pos.x, y: pos.y });
        q.spawns = [{ tag: id + 'v', spec: { mob: 'vampire', lvl: lvl + 1, tag: id + 'v' }, at: pos, nightOnly: true }].concat([0, 1, 2].map((i) => ({ tag: id + 'z' + i, spec: { mob: 'zombie', lvl, tag: id + 'z' + i }, at: { x: pos.x + i - 1, y: pos.y + 1.5 }, nightOnly: true })));
        return q;
      }
      case 'treasure': {
        const item = Math.random() < 0.6 ? 'arrow' : 'stone_mask';
        const rr = J.R.pick(J.REGIONS.filter((r) => r.danger >= 2));
        const pos = W().randomWalkable(rr.x, rr.y, rr.land * 0.8, J.R, { outside: true });
        if (!pos) return null;
        Object.assign(q, { title: `${S.SIDE.treasure}: ${J.ITEMS[item].name}`, desc: `Говорят, в районе «${rr.name}» видели ${J.ITEMS[item].name.toLowerCase()}. Её охраняют.`, reward: 0, expires: exp(96), x: pos.x, y: pos.y, item });
        q.items = [{ x: pos.x, y: pos.y, item, tag: id + 'i' }];
        q.spawns = [{ tag: id + 'g', spec: item === 'arrow' ? { stand: null, lvl: lvl + 1, tag: id + 'g' } : { mob: 'vampire', lvl: lvl + 1, tag: id + 'g' }, at: { x: pos.x + 2, y: pos.y + 1 }, nightOnly: item !== 'arrow' }];
        return q;
      }
      case 'arena': {
        if (!b) return null;
        const pos = door(b);
        Object.assign(q, { title: S.SIDE.arena, desc: 'Три бойца выходят против тебя. Победи всех.', reward: 200 + lvl * 60, expires: exp(3), x: pos.x, y: pos.y + 2 });
        q.spawns = [0, 1, 2].map((i) => ({ tag: id + 'a' + i, spec: i === 2 ? { stand: null, lvl: lvl + 1, tag: id + 'a' + i } : { mob: J.R.pick(['thug', 'gangster', 'bandit']), lvl: lvl + 1, tag: id + 'a' + i }, at: { x: pos.x + (i - 1) * 2, y: pos.y + 4 } }));
        return q;
      }
      case 'corpse': {
        const left = J.CORPSE_PARTS.filter((c) => !P().corpse.includes(c.id));
        if (!left.length) return null;
        const part = J.R.pick(left);
        const pos = W().randomWalkable(reg('arizona').x, reg('arizona').y, 80, J.R, { outside: true });
        if (!pos) return null;
        Object.assign(q, { title: `${S.SIDE.corpse}: ${part.name}`, desc: 'В пустыне Аризоны видели свечение. Это может быть часть Святого Трупа.', reward: 0, expires: exp(120), x: pos.x, y: pos.y });
        q.items = [{ x: pos.x, y: pos.y, item: 'corpse_part', meta: { part: part.id }, tag: id + 'p' }];
        return q;
      }
    }
    return null;
  };
  S.sideAccept = function (q) {
    if (q.onAccept === 'package') J.P.addItem(P(), 'package', 1, null, true);
  };
  S.sideCheck = function (q) {
    const done = () => {
      const st = G().story;
      st.side = st.side.filter((x) => x !== q);
      if (q.reward) J.P.addMoney(P(), q.reward);
      J.P.gainXp(P(), 30 + P().lvl * 8);
      UI().toast(`Задание выполнено: ${q.title}` + (q.reward ? ` (+${J.fmtMoney(q.reward)})` : ''), 'gold');
      S.log('Выполнено: ' + q.title);
      UI().questDirty();
    };
    if (q.spawns && q.spawns.length && q.spawns.every((s) => q.dead[s.tag]) && !q.items) return done();
    if (q.items && q.items.every((it) => (q.gotTags || {})[it.tag])) {
      if (q.sideType === 'cat') return; // нужно вернуть
      if (!q.spawns.length || q.spawns.every((s) => q.dead[s.tag] || s.nightOnly)) return done();
      return done();
    }
  };
  S.sidePicked = function (q, pk) {
    if (q.sideType === 'cat') UI().toast('Кот у тебя! Верни его владельцу — зайди в здание, где взял задание.', 'gold');
  };
  // Проверка доставки/возврата кота при входе в здание
  S.sideBuilding = function (b) {
    const st = G().story;
    const p = P();
    for (const q of st.side.slice()) {
      if (q.sideType === 'delivery' && q.to === b.id && J.P.hasItem(p, 'package')) {
        J.P.removeItem(p, 'package');
        st.side = st.side.filter((x) => x !== q);
        J.P.addMoney(p, q.reward);
        J.P.gainXp(p, 25 + p.lvl * 5);
        UI().toast(`Посылка доставлена! +${J.fmtMoney(q.reward)}`, 'gold');
        UI().questDirty();
        return true;
      }
      if (q.sideType === 'cat' && q.back === b.id && J.P.hasItem(p, 'cat')) {
        J.P.removeItem(p, 'cat');
        st.side = st.side.filter((x) => x !== q);
        J.P.addMoney(p, q.reward);
        J.P.gainXp(p, 20 + p.lvl * 4);
        UI().toast(`Кот дома! Хозяин счастлив. +${J.fmtMoney(q.reward)}`, 'gold');
        UI().questDirty();
        return true;
      }
    }
    return false;
  };
  S.cleanupSide = function (q) {
    G().pickups = G().pickups.filter((p) => {
      if (p.storyD === q) {
        J.R3.removeMesh(p.mesh);
        return false;
      }
      return true;
    });
    for (const e of G().ents) if (e.storyTag && (q.spawns || []).some((s) => s.tag === e.storyTag)) e.despawn = true;
    if (q.onAccept === 'package') J.P.removeItem(P(), 'package');
  };
  S.abandonSide = function (id) {
    const st = G().story;
    const q = st.side.find((x) => x.id === id);
    if (!q) return;
    S.cleanupSide(q);
    st.side = st.side.filter((x) => x !== q);
    UI().questDirty();
  };

  S.rumorTreasure = function (fromItem) {
    const q = S.makeSide('treasure');
    if (q) {
      S.acceptSide(q);
      UI().toast('Место отмечено на карте (M).', 'gold');
    }
  };

  // ---------- Случайные события ----------
  S.ambushStandUser = function (title, standId) {
    const p = P();
    const pos = W().randomWalkable(p.x, p.y, 12) || p;
    const e = J.makeStandUser(pos.x, pos.y, Math.max(2, p.lvl + 1), standId || null);
    e.name = title + ' ' + e.name.split(' ')[0];
    J.addEnt(e);
    UI().menacing(e);
    UI().toast(p.stand ? 'Стенд-юзеры притягиваются друг к другу! На тебя напали!' : 'Кто-то нападает на тебя... ты не видишь, чем он бьёт!', 'red');
  };
  S.spawnGroup = function (mob, n, x, y, r) {
    const p = P();
    for (let i = 0; i < n; i++) {
      const pos = W().randomWalkable(x, y, r) || { x, y };
      J.addEnt(J.makeMob(mob, pos.x, pos.y, Math.max(1, p.lvl)));
    }
  };

  S.randomEvent = function () {
    const g = G();
    const p = P();
    if (p.dead || g.ents.some((e) => e.boss && !e.dead)) return;
    const w = W();
    const rg = w.regionAt(p.x, p.y);
    const city = w.cityAt(p.x, p.y);
    const night = g.isNight;
    const ev = [];
    if (p.stand) ev.push({ w: 3, f: () => S.ambushStandUser('Стенд-юзер') });
    else ev.push({ w: 0.6, f: () => S.ambushStandUser('Странный тип') });
    if (city) ev.push({ w: night ? 3 : 1.5, f: () => { UI().toast('Громилы ищут неприятностей!', 'red'); S.spawnGroup(rg.id === 'naples' ? 'gangster' : 'thug', 2 + (Math.random() < 0.5 ? 1 : 0), p.x, p.y, 9); } });
    if (night && rg.danger >= 2) ev.push({ w: 2.5, f: () => { UI().toast('Из темноты выходят зомби!', 'red'); S.spawnGroup('zombie', 3 + Math.floor(Math.random() * 3), p.x, p.y, 12); } });
    if (night && rg.danger >= 3) ev.push({ w: 1, f: () => { UI().toast('Вампир вышел на охоту!', 'red'); S.spawnGroup('vampire', 1, p.x, p.y, 12); } });
    if (!city) {
      const wild = { mesa: 'coyote', prairie: 'coyote', desert: 'scorpion', alpine: 'wolf', tundra: 'wolf', swamp: 'croc', moor: 'wolf', temperate: 'wolf', savanna: 'coyote', tropical: 'croc', mediterranean: 'coyote' }[rg.biome] || 'coyote';
      ev.push({ w: 3, f: () => S.spawnGroup(wild, wild === 'bear' ? 1 : 2 + Math.floor(Math.random() * 2), p.x, p.y, 12) });
      if (rg.biome === 'alpine' || rg.biome === 'temperate') ev.push({ w: 0.7, f: () => S.spawnGroup('bear', 1, p.x, p.y, 12) });
      if (rg.biome === 'mesa' || rg.biome === 'desert') ev.push({ w: 1.5, f: () => { UI().toast('Бандиты пустыни!', 'red'); S.spawnGroup('bandit', 2, p.x, p.y, 12); } });
    }
    ev.push({ w: 1.2, f: () => { const pos = w.randomWalkable(p.x, p.y, 6); if (pos) { J.spawnPickup(pos.x, pos.y, 'money', 20 + Math.floor(Math.random() * 80)); UI().toast('Кто-то обронил кошелёк неподалёку...', 'green'); } } });
    if (!G().story.side.some((q) => q.sideType === 'treasure')) ev.push({ w: 1.3, f: () => { const q = S.makeSide('treasure'); if (q) { UI().ask('Слух', q.desc + ' Проверить?', [{ t: 'Отметить на карте', fn: () => S.acceptSide(q) }, { t: 'Забыть', fn: () => {} }]); } } });
    if (rg.id === 'arizona' && p.corpse.length < 9) ev.push({ w: 2, f: () => { const q = S.makeSide('corpse'); if (q) { S.acceptSide(q); UI().toast('Ты видишь свечение в пустыне... Часть Святого Трупа?', 'gold'); } } });
    ev.push({ w: 1.5, f: () => S.weatherChange() });
    if (p.vampire && !p.ultimate) ev.push({ w: 0.8, f: () => S.onDrain() });
    const e = J.pickW(J.R, ev);
    e.f();
  };

  S.weatherChange = function () {
    const g = G();
    const rg = W().regionAt(P().x, P().y);
    const opts = { moor: ['rain', 'fog', null], temperate: ['rain', null, null], mediterranean: ['rain', null, null, null], desert: ['sand', null, null], mesa: ['sand', null], alpine: ['snow', 'snow', null], tundra: ['snow', 'snow'], swamp: ['rain', 'fog', null], tropical: ['rain', null], savanna: [null, 'rain'], prairie: [null, 'rain', 'sand'] }[rg.biome] || [null];
    g.weather = J.R.pick(opts);
    g.weatherT = 120 + Math.random() * 240;
    if (g.weather) UI().toast({ rain: 'Начался дождь.', snow: 'Пошёл снег.', sand: 'Песчаная буря!', fog: 'Опустился густой туман.' }[g.weather], 'muted');
  };

  // ---------- Маркеры и журнал ----------
  S.markers = function () {
    const st = G().story;
    const out = [];
    if (!st) return out;
    if (st.arc) {
      const sg = S.curStage();
      const m = sg && sg.marker ? sg.marker(st.arc.d) : null;
      if (m) out.push({ x: m.x, y: m.y, label: sg.text, kind: 'main' });
    }
    for (const q of st.side) {
      let x = q.x, y = q.y;
      if (q.sideType === 'delivery') {
        const b = W().buildings[q.to];
        x = b.door.x + 0.5;
        y = b.door.y + 1.5;
      }
      if (q.sideType === 'cat' && J.P.hasItem(P(), 'cat')) {
        const b = W().buildings[q.back];
        x = b.door.x + 0.5;
        y = b.door.y + 1.5;
      }
      if (x !== undefined) out.push({ x, y, label: q.title, kind: 'side' });
    }
    return out;
  };
})();
