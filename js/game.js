'use strict';
// Главный модуль: ввод, цикл, время, население, путешествия, сон, смерть, сохранения.
(function () {
  const G = (J.G = { ents: [], vehs: [], projs: [], fields: [], traps: [], pickups: [], timers: [], t: 0, time: 480, day: 1 });
  const Game = (J.Game = {});
  Game.SAVE_KEY = 'jojo_bizarre_life_save_v1';
  const SET_KEY = 'jojo_bizarre_life_settings_v1';

  // ---------- Ввод ----------
  const Input = (J.Input = {
    keys: {},
    mouse: { l: false, r: false },
    mx: 0, my: 0, tmx: 0, tmy: 0,
    mdx: 0, mdy: 0, // накопленные за кадр движения мыши (применяются один раз в начале кадра)
    touch: false,
    locked: false,
    sprint: false, breathe: false,
    touchHold: {},
    runToggle: false,
    guardM: false, // блок правой кнопкой при захваченной мыши
  });
  // зажата ли клавиша способности (клавиатура или сенсорная кнопка)
  Input.held = (k) => !!(k && (Input.keys[k.kb] || Input.touchHold[k.tc]));
  // в столкновении рашей любое нажатие — «жми!»
  const mashing = () => G.player && J.Cb && J.Cb.inClash(G.player);
  Input.releasePointer = function () {
    if (document.pointerLockElement) {
      try {
        document.exitPointerLock();
      } catch (e) {}
    }
  };
  Input.rotateCam = function (dx, dy) {
    const s = Game.settings.sens;
    J.R3.rotateCam(dx * 0.0024 * s, dy * 0.002 * s * (Game.settings.invert ? -1 : 1));
  };
  Input.requestLock = function (cv) {
    try {
      const r = cv.requestPointerLock({ unadjustedMovement: true });
      if (r && r.catch) r.catch(() => { try { cv.requestPointerLock(); } catch (e) {} });
    } catch (e) {
      try { cv.requestPointerLock(); } catch (e2) {}
    }
  };
  Input.applyFollow = function () {
    J.R3.cam.follow = Input.touch || Input.lockFailed || !!Game.settings.follow;
  };
  Input.init = function () {
    const cv = document.getElementById('game');
    Input.touch = 'ontouchstart' in window || (window.matchMedia && matchMedia('(pointer: coarse)').matches);
    window.addEventListener('keydown', (e) => {
      if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT')) return;
      if (['Space', 'Tab', 'F1', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
      if (e.repeat && !['KeyW', 'KeyA', 'KeyS', 'KeyD'].includes(e.code)) return;
      Input.keys[e.code] = true;
      Game.onKey(e.code);
    });
    window.addEventListener('keyup', (e) => {
      Input.keys[e.code] = false;
      Game.onKeyUp(e.code);
    });
    window.addEventListener('blur', () => {
      Input.keys = {};
      Input.mouse.l = Input.mouse.r = false;
      Input.guardM = false;
      if (G.player) G.player.chg = null;
    });
    cv.addEventListener('mousedown', (e) => {
      if (Game.state !== 'play' || J.UI.blocking()) return;
      if (e.button === 0) {
        // клик для захвата мыши не должен бить
        if (!Input.locked && !Input.touch && Game.settings.lock && !Input.lockFailed) {
          Input.requestLock(cv);
          return;
        }
        Input.mouse.l = true;
        // граната в руке: ЛКМ — прицел с дугой (guns_ui.js)
        if (J.Guns && J.Guns.lmb(true)) return;
        if (mashing()) J.Cb.mash(G.player);
        else if (G.player) G.player.buf = G.t;
      }
      if (e.button === 2) {
        Input.mouse.r = true;
        // с оружием в руке ПКМ — прицел (guns_ui.js)
        if (J.Guns && !mashing() && J.Guns.rmb(true)) return;
        // с захватом мыши ПКМ — блок; без захвата — заряд тяжёлого удара (или поворот камеры перетаскиванием)
        if (Input.locked) Input.guardM = true;
        else {
          Input.rDrag = { x: e.clientX, y: e.clientY, moved: 0 };
          if (G.player && !mashing()) J.P.heavyStart(G.player);
        }
      }
    });
    window.addEventListener('mouseup', (e) => {
      if (e.button === 0) {
        Input.mouse.l = false;
        if (J.Guns) J.Guns.lmb(false);
      }
      if (e.button === 2) {
        Input.mouse.r = false;
        if (J.Guns) J.Guns.rmb(false);
        Input.guardM = false;
        const p = G.player;
        if (Input.rDrag && p) {
          if (Input.rDrag.moved < 6 && Game.state === 'play' && !J.UI.blocking()) J.P.heavyRelease(p);
          else p.chg = null;
        }
        Input.rDrag = null;
      }
    });
    cv.addEventListener('contextmenu', (e) => e.preventDefault());
    window.addEventListener('mousemove', (e) => {
      if (Game.state !== 'play' || (!Input.locked && !Input.rDrag)) return;
      let dx = e.movementX || 0, dy = e.movementY || 0;
      if (Math.abs(dx) > 400 || Math.abs(dy) > 400) return; // скачки Chrome при захвате мыши
      if (!Input.locked) {
        Input.rDrag.moved += Math.abs(dx) + Math.abs(dy);
        dx *= 1.4;
        dy *= 1.4;
        // это поворот камеры, а не заряд удара
        if (Input.rDrag.moved >= 6 && G.player) G.player.chg = null;
      }
      // копим и применяем раз за кадр: камера двигается ровно, без лишних пересчётов
      Input.mdx += dx;
      Input.mdy += dy;
    });
    cv.addEventListener('wheel', (e) => {
      e.preventDefault();
      // колёсико листает вещи в руке (если они есть); с Shift/Ctrl/Alt — приближение камеры
      if (!e.shiftKey && J.Hand && J.Hand.wheel(e)) return;
      J.R3.zoomCam(e.deltaY > 0 ? 1.1 : 0.9);
    }, { passive: false });
    document.addEventListener('pointerlockchange', () => {
      Input.locked = document.pointerLockElement === cv;
      Input.mdx = Input.mdy = 0;
    });
    // захват мыши запрещён (например, во встроенном фрейме) — включаем следящую камеру
    document.addEventListener('pointerlockerror', () => {
      if (Input.lockFailed) return;
      Input.lockFailed = true;
      Input.applyFollow();
      J.UI.toast('Захват мыши недоступен: камера сама держится за спиной. Поворот — правой кнопкой мыши или стрелками ←/→.', 'muted');
    });
  };
  Input.touchPress = function (k, down) {
    const p = G.player;
    if (Game.state !== 'play' || !p) return;
    if (J.UI.blocking()) {
      if (down && J.UI.dlg) J.UI.dialogNext();
      return;
    }
    Input.touchHold[k] = down;
    if (!down) {
      if (k === 'heavy') J.P.heavyRelease(p);
      return;
    }
    // за рулём: только выход, меню и карта (газ/руль — джойстиком, ручник и сигнал — удержанием)
    if (p.inCar && !['f', 'menu', 'map'].includes(k)) return;
    if (mashing() && ['atk', 'heavy', 'dash', 'q', 'e', 'r', 'rush', '3'].includes(k)) {
      J.Cb.mash(p);
      return;
    }
    switch (k) {
      case 'heavy': J.P.heavyStart(p); break;
      case 'dash': J.P.dash(p, p.vx, p.vy); break;
      case 'atk': p.buf = G.t; break;
      case 'rush': {
        const sd = p.stand ? J.STANDS[p.stand.id] : null;
        const i = sd ? sd.abil.findIndex((a) => a.kind === 'rush') : -1;
        if (i >= 0) J.P.standAbility(p, i, 'rush');
        else if (p.style === 'hamon') J.Abil.useStyle(p, 2);
        break;
      }
      case 'q': J.P.standAbility(p, 0); break;
      case 'e': J.P.standAbility(p, 1); break;
      case 'r': J.P.standAbility(p, 2); break;
      case '1': J.Abil.useStyle(p, 0); break;
      case '2': J.Abil.useStyle(p, 1); break;
      case '3': J.Abil.useStyle(p, 2); break;
      case 'g': J.P.toggleStand(p); break;
      case 'f': Game.interact(); break;
      case 'menu': J.UI.openPanel('char'); break;
      case 'map': J.UI.openPanel('map'); break;
      case 'run': Input.runToggle = !Input.runToggle; J.UI.toast(Input.runToggle ? 'Бег включён' : 'Бег выключен', 'muted'); break;
    }
  };

  Game.onKey = function (code) {
    const UI = J.UI;
    if (Game.state !== 'play') return;
    const p = G.player;
    // открытые окна
    if (UI.mgOpen) {
      if (code === 'Space' || code === 'Enter') UI.mgHit();
      return;
    }
    if (UI.revealOpen) {
      if (['Enter', 'Space', 'Escape'].includes(code)) UI.closeReveal();
      return;
    }
    if (UI.cfOpen) {
      if (code === 'Enter') UI.closeConfirm(true);
      if (code === 'Escape') UI.closeConfirm(false);
      return;
    }
    if (UI.dlg) {
      if (['Space', 'Enter', 'KeyF', 'KeyE'].includes(code)) UI.dialogNext();
      const n = { Digit1: 0, Digit2: 1, Digit3: 2, Digit4: 3, Digit5: 4, Digit6: 5 }[code];
      if (n !== undefined) UI.choose(n);
      if (code === 'Escape' && UI.dlg && !UI.dlg.choices) UI.dialogNext();
      return;
    }
    if (UI.bannerOpen) {
      UI.closeBanner();
      return;
    }
    if (UI.deathOpen) return;
    if (UI.bOpen) {
      if (code === 'Escape' || code === 'KeyF') UI.closeBuilding();
      return;
    }
    const tabKey = { KeyI: 'inv', KeyP: 'char', KeyC: 'stand', KeyL: 'journal', KeyJ: 'journal', KeyM: 'map', KeyK: 'codex' }[code];
    if (UI.panelOpen) {
      if (code === 'Escape') UI.closePanel();
      else if (tabKey) UI.togglePanel(tabKey);
      return;
    }
    if (tabKey) return UI.openPanel(tabKey);
    // за рулём: удары и способности недоступны
    if (p.inCar) {
      if (code === 'KeyF' || code === 'Enter') J.Veh.exit(p);
      else if (code === 'Escape') UI.openPanel('menu');
      else if (code === 'F1') UI.showHelp();
      return;
    }
    // столкновение рашей: жми!
    if (mashing() && ['KeyQ', 'KeyE', 'KeyR', 'Space', 'KeyX', 'KeyF', 'Digit3', 'Enter'].includes(code)) {
      J.Cb.mash(p);
      return;
    }
    switch (code) {
      case 'Enter': Game.interact(); break;
      case 'Escape': UI.openPanel('menu'); break;
      case 'F1': UI.showHelp(); break;
      case 'KeyQ': J.P.standAbility(p, 0); break;
      case 'KeyE': J.P.standAbility(p, 1); break;
      case 'KeyR': J.P.standAbility(p, 2); break;
      case 'KeyG': case 'Tab': J.P.toggleStand(p); break;
      case 'KeyF': Game.interact(); break;
      case 'Digit1': J.Abil.useStyle(p, 0); break;
      case 'Digit2': J.Abil.useStyle(p, 1); break;
      case 'Digit3': J.Abil.useStyle(p, 2); break;
      case 'KeyT': J.P.cycleStyle(p); break;
      case 'KeyH': J.P.toggleMount(p); break;
      case 'KeyX': J.P.heavyStart(p); break;
      case 'Space': {
        const m = Game.moveInput();
        const yaw = J.R3.cam.yaw;
        const dx = Math.cos(yaw) * -m.my - Math.sin(yaw) * m.mx, dy = Math.sin(yaw) * -m.my + Math.cos(yaw) * m.mx;
        J.P.dash(p, dx, dy);
        break;
      }
    }
  };
  Game.onKeyUp = function (code) {
    if (Game.state !== 'play' || !G.player) return;
    if (code === 'KeyX' && !J.UI.blocking()) J.P.heavyRelease(G.player);
  };
  Game.moveInput = function () {
    const k = Input.keys;
    let mx = (k.KeyD ? 1 : 0) - (k.KeyA ? 1 : 0);
    let my = (k.KeyS ? 1 : 0) - (k.KeyW ? 1 : 0);
    if (Input.touch && (Input.tmx || Input.tmy)) {
      mx = Input.tmx;
      my = Input.tmy;
    }
    return { mx, my };
  };

  // ---------- Настройки ----------
  // щадящий режим по умолчанию, если система просит меньше движения
  const reduceMotion = !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);
  Game.settings = Object.assign({ quality: 1, shadows: true, sens: 1, sound: true, invert: false, lock: true, follow: false, fx_shake: 1, fx_flash: !reduceMotion, fx_slowmo: true, fx_rm: reduceMotion }, J.store.get(SET_KEY) || {});
  if (!J.store.get(SET_KEY)) Game.settings.quality = J.R3.autoQuality(); // первый запуск: качество по устройству
  Game.applySettings = function () {
    J.store.set(SET_KEY, Game.settings);
    J.R3.setQuality(Game.settings.quality, Game.settings.shadows);
    J.UI.sound = Game.settings.sound;
    Input.applyFollow();
    if (J.Fx) J.Fx.applySettings(Game.settings);
  };

  // ---------- Запуск ----------
  Game.init = function () {
    J.R3.quality = Game.settings.quality;
    J.R3.shadows = Game.settings.shadows;
    J.R3.init(document.getElementById('game'));
    J.R3.initCars();
    // обесцвечивание мира для остановки времени — патч материалов до первой компиляции
    if (J.Fx) J.Fx.patchWorld();
    // свет сверхспособностей — до прогрева шейдеров (число источников света потом не меняется)
    if (J.Pw) J.Pw.preInit();
    J.R3.setQuality(Game.settings.quality, Game.settings.shadows);
    J.R3.warmup();
    J.UI.build();
    J.UI.sound = Game.settings.sound;
    if (J.Fx) J.Fx.init();
    if (J.Pw) J.Pw.init();
    if (J.Sfx) J.Sfx.init();
    Input.init();
    Input.applyFollow();
    if (Input.touch) J.UI.initTouch();
    document.getElementById('touch').hidden = true;
    Game.state = 'title';
    Game.bindTitle();
    J.UI.showTitle();
    Game.titleScene();
    Game.last = performance.now();
    requestAnimationFrame(Game.loop);
  };

  Game.bindTitle = function () {
    const $ = (s) => document.querySelector(s);
    $('#t-new').onclick = () => J.UI.showCreator();
    $('#t-continue').onclick = () => Game.loadFromStore();
    $('#t-help').onclick = () => {
      const h = $('#t-helpbox');
      h.hidden = !h.hidden;
    };
    $('#cr-back').onclick = () => J.UI.showTitle();
    $('#cr-rand').onclick = () => J.UI.randomizeCreator();
    $('#cr-go').onclick = () => J.UI.finishCreator();
  };

  // Фон главного меню: небольшой мир с медленной камерой
  Game.titleScene = function () {
    if (!G.world) {
      Game.setLoading('Создание мира…');
      setTimeout(() => {
        const seed = (Math.random() * 2 ** 31) >>> 0;
        G.seed = seed;
        G.world = new J.World(seed);
        G.freshWorld = true;
        Game.mapImg = G.world.makeMapImage();
        const r = J.REGION.morioh;
        G.titleCam = { x: r.x, y: r.y };
        J.R3.updateChunks(r.x, r.y, true);
        Game.setLoading(null);
      }, 30);
    }
  };
  Game.setLoading = function (text) {
    const l = document.getElementById('loading');
    l.hidden = !text;
    if (text) l.querySelector('span').textContent = text;
  };

  // ---------- Новая игра ----------
  Game.newGame = function (cfg) {
    Game.setLoading('Создание огромного мира…');
    setTimeout(() => {
      if (G.world && G.freshWorld) Game.resetWorld(G.seed, true);
      else Game.resetWorld((Math.random() * 2 ** 31) >>> 0);
      G.freshWorld = false;
      const og = J.ORIGINS.find((o) => o.id === cfg.origin);
      const cities = J.REGIONS.filter((r) => r.city >= 16);
      const region = og.region ? J.REGION[og.region] : J.R.pick(cities);
      const p = J.P.create({ name: cfg.name, look: cfg.look, origin: cfg.origin, stats: cfg.stats, money: og.money });
      G.player = p;
      p.points = cfg.extraPts || 0;
      p.homeRegion = region.id;
      Game.setupHome(p, true);
      for (const k in og.items) J.P.addItem(p, k, og.items[k], null, true);
      if (og.hamon) J.P.learnStyle(p, 'hamon');
      G.ents = [p];
      J.Story.init();
      G.time = 480;
      G.day = 1;
      Game.startPlay();
      Game.setLoading(null);
      if (og.stand) J.P.giveStand(p, J.pickW(J.R, J.standPool()).s.id, 'Твой стенд с тобой с рождения.');
      J.UI.bigBanner('ПРИЧУДЛИВАЯ ЖИЗНЬ', `${p.name}. ${og.name}. ${region.name}, ${region.country}. Обычное утро… пока что. Твоя судьба уже выбрана — но ты её ещё не знаешь.`, true);
      setTimeout(() => J.UI.toast('Подсказка: F1 — управление, M — карта, F — войти в здание или поговорить.', 'muted'), 800);
      Game.save(false);
    }, 40);
  };

  Game.resetWorld = function (seed, keepWorld) {
    J.Veh.clear();
    J.R3.clearAll();
    for (const e of G.ents) J.R3.dropView(e);
    for (const pk of G.pickups) J.R3.removeMesh(pk.mesh);
    for (const f of G.fields) J.R3.removeMesh(f.mesh);
    for (const t of G.traps) J.R3.removeMesh(t.mesh);
    for (const pr of G.projs) J.R3.dropProj(pr);
    G.ents = [];
    G.projs = [];
    G.fields = [];
    G.traps = [];
    G.pickups = [];
    G.timers = [];
    G.timestop = null;
    G.timeskip = null;
    G.timeAccel = 0;
    G.reveal = 0;
    G.weather = null;
    G.waypoint = null;
    G.clash = null;
    if (G.roller && G.roller.m) J.R3.removeMesh(G.roller.m);
    G.roller = null;
    if (J.Fx) J.Fx.reset();
    if (J.Pw && J.Pw.ready) J.Pw.reset();
    if (keepWorld && G.world && G.world.seed === seed) return;
    G.seed = seed;
    G.world = new J.World(seed);
    Game.mapImg = G.world.makeMapImage();
  };

  // Дом игрока: превращаем жилой дом в его жилище
  Game.setupHome = function (p, place) {
    const w = G.world;
    const reg = J.REGION[p.homeRegion];
    let b = p.homeId !== undefined ? w.buildings[p.homeId] : null;
    if (!b) {
      const hs = w.buildings.filter((x) => x.region === reg.id && x.type === 'house');
      hs.sort((a, c) => J.dist(a.x, a.y, reg.x, reg.y) - J.dist(c.x, c.y, reg.x, reg.y));
      b = hs[Math.min(hs.length - 1, 3)];
    }
    if (!b) b = w.buildings.find((x) => x.region === reg.id) || w.buildings[0];
    b.type = 'home';
    b.name = 'Твой дом';
    b.sign = '#e6c36a';
    p.homeId = b.id;
    if (place) {
      const dp = J.doorPt(b);
      p.x = dp.x;
      p.y = dp.y;
      p.face = J.doorAng(b);
      p.lastSafe = { x: p.x, y: p.y };
      J.R3.cam.yaw = -Math.PI / 2;
    }
  };

  Game.startPlay = function () {
    Game.state = 'play';
    J.UI.hideTitle();
    J.UI.hudShow(true);
    if (Input.touch) document.getElementById('touch').hidden = false;
    const p = G.player;
    const c = J.R3.cam;
    c.tx = p.x;
    c.tz = p.y;
    c.dist = Input.touch ? 6.5 : 5.6;
    c.pitch = 0.24;
    c.idle = 9;
    c.mode = 'foot';
    J.R3.snapCamera();
    Input.mdx = Input.mdy = 0;
    J.R3.clearAll();
    J.R3.updateChunks(p.x, p.y, true);
    J.Traffic.ensure(G.world); // граф полос и тротуаров строится один раз на мир
    J.Traffic.reset();
    J.Veh.warmAudio();
    Game.popT = 0;
  };

  Game.toTitle = function () {
    J.UI.closePanel();
    Game.state = 'title';
    J.UI.hudShow(false);
    document.getElementById('touch').hidden = true;
    J.Veh.clear();
    for (const e of G.ents) J.R3.dropView(e);
    G.ents = [];
    J.UI.showTitle();
    const r = J.REGION.morioh;
    G.titleCam = { x: r.x, y: r.y };
    J.R3.clearAll();
  };

  // ---------- Сохранение ----------
  const PF = ['name', 'look', 'origin', 'stats', 'statXp', 'points', 'lvl', 'xp', 'money', 'inv', 'discs', 'corpse', 'hunger', 'energy', 'blood', 'stamina', 'hp', 'stand', 'se', 'hamon', 'spin', 'vampire', 'ultimate', 'style', 'breath', 'flags', 'codex', 'rep', 'kills', 'mount', 'maxHpPenalty', 'x', 'y', 'face', 'homeId', 'homeRegion', 'hotbar', 'hsel', 'dur', 'mag'];
  Game.save = function (manual) {
    if (!G.player || G.player.dead) return;
    const p = G.player;
    const pd = {};
    PF.forEach((k) => (pd[k] = p[k]));
    const data = { v: 1, genV: J.GEN_V, seed: G.seed, time: G.time, weather: G.weather, waypoint: G.waypoint, player: pd, story: J.Story.serialize(), cam: { yaw: J.R3.cam.yaw }, savedAt: Date.now() };
    const ok = J.store.set(Game.SAVE_KEY, data);
    if (manual) J.UI.toast(ok ? 'Игра сохранена.' : 'Не удалось сохранить: хранилище браузера недоступно.', ok ? 'green' : 'red');
  };
  Game.loadFromStore = function () {
    const data = J.store.get(Game.SAVE_KEY);
    if (!data) return J.UI.toast('Сохранение не найдено.', 'red');
    // сохранение из старой версии мира (до новых городов): координаты и здания не совпадают — начинаем заново
    if ((data.genV || 1) !== J.GEN_V) {
      J.store.del(Game.SAVE_KEY);
      if (J.UI.showTitle) J.UI.showTitle();
      return J.UI.toast('Мир обновлён: города перестроены заново, старое сохранение несовместимо. Начни новую игру!', 'gold');
    }
    J.UI.closePanel();
    Game.setLoading('Загрузка мира…');
    setTimeout(() => {
      try {
        Game.load(data);
      } catch (e) {
        console.error(e);
        Game.setLoading(null);
        J.UI.toast('Сохранение повреждено.', 'red');
      }
    }, 40);
  };
  Game.load = function (data) {
    G.freshWorld = false;
    Game.resetWorld(data.seed, true);
    const pd = data.player;
    const p = J.P.create({ name: pd.name, look: pd.look, origin: pd.origin, stats: pd.stats, money: pd.money });
    PF.forEach((k) => {
      if (pd[k] !== undefined) p[k] = pd[k];
    });
    p.hist = [];
    p.st = {};
    p.cds = {};
    J.P.recalc(p);
    p.hp = Math.min(p.maxHp, pd.hp);
    p.lastSafe = { x: p.x, y: p.y };
    G.player = p;
    Game.setupHome(p, false);
    G.ents = [p];
    G.time = data.time;
    G.day = Math.floor(G.time / 1440) + 1;
    G.weather = data.weather || null;
    G.weatherT = 120;
    G.waypoint = data.waypoint || null;
    J.Story.load(data.story);
    if (data.cam) J.R3.cam.yaw = data.cam.yaw;
    Game.startPlay();
    Game.setLoading(null);
    J.UI.toast(`С возвращением, ${p.name}! День ${G.day}, ${J.fmtClock(G.time)}.`, 'gold');
  };

  // ---------- Время ----------
  Game.updateClock = function () {
    G.day = Math.floor(G.time / 1440) + 1;
    const h = (G.time % 1440) / 60;
    G.hour = h;
    G.isNight = h >= 20 || h < 5;
    G.isSunny = h >= 6.5 && h < 18.5;
  };
  Game.tickMinutes = function (mins) {
    const p = G.player;
    J.P.tickNeeds(p, mins);
    J.Story.tick(mins);
    if (G.weather) {
      G.weatherT -= mins;
      if (G.weatherT <= 0) G.weather = null;
    }
    // аренда/день: оплата не требуется, но голод при пропуске
  };
  Game.passTime = function (mins) {
    let left = mins;
    while (left > 0) {
      const step = Math.min(60, left);
      G.time += step;
      left -= step;
      Game.updateClock();
      Game.tickMinutes(step);
    }
    // уходим со сцены враждебных обычных мобов
    for (const e of G.ents) if (e.team === 'enemy' && !e.storyTag && !e.boss) e.despawn = true;
  };
  Game.sleep = function (vampDay) {
    const p = G.player;
    J.UI.closeBuilding();
    const m = G.time % 1440;
    const target = 7 * 60;
    const mins = m < target ? target - m : 1440 - m + target;
    Game.passTime(mins);
    p.energy = 100;
    p.hp = p.maxHp;
    p.stamina = p.staminaMax;
    if (p.hamon) p.breath = p.breathMax;
    if (p.stand) p.se = p.seMax;
    J.UI.bigBanner(`ДЕНЬ ${G.day}`, `${J.fmtClock(G.time)}. Ты выспался. ${p.hunger < 30 && !p.vampire ? 'Ты голоден — поешь.' : ''}`);
    Game.save(false);
  };
  Game.waitUntil = function (minuteOfDay) {
    J.UI.closeBuilding();
    const m = G.time % 1440;
    const mins = m < minuteOfDay ? minuteOfDay - m : 1440 - m + minuteOfDay;
    Game.passTime(mins);
    J.UI.toast(`Ты переждал до ${J.fmtClock(G.time)}.`, 'muted');
  };

  // ---------- Путешествия ----------
  Game.travelTo = function (regionId, mins) {
    const p = G.player;
    J.Veh.clear();
    Game.passTime(mins);
    const w = G.world;
    const b = w.buildings.find((x) => x.region === regionId && x.type === 'station');
    if (!b) return;
    const dp = J.doorPt(b);
    p.x = dp.x;
    p.y = dp.y;
    p.lastSafe = { x: p.x, y: p.y };
    p.mount = false;
    for (const e of G.ents) if (e !== p && !e.summon) e.despawn = true;
    for (const e of G.ents) if (e.summon) { e.x = p.x; e.y = p.y; }
    J.R3.cam.tx = p.x;
    J.R3.cam.tz = p.y;
    J.R3.snapCamera();
    J.R3.clearAll();
    J.R3.updateChunks(p.x, p.y, true);
    J.UI.bigBanner(J.REGION[regionId].name, `${J.REGION[regionId].country}. Прибытие в ${J.fmtClock(G.time)}, день ${G.day}.`);
  };

  // ---------- Смерть ----------
  Game.onPlayerDeath = function () {
    const p = G.player;
    J.Veh.forceExit(p);
    p.wanted = 0;
    p.standOut = false;
    p.channel = null;
    p.guard = false;
    p.chg = null;
    G.timestop = null;
    G.timeskip = null;
    G.timeAccel = 0;
    G.clash = null;
    J.UI.timestopFx(false);
    J.UI.timeskipFx(false);
    let shown = false;
    const show = () => {
      if (shown || !p.dead) return;
      shown = true;
      J.UI.closeBuilding();
      J.UI.showDeath('Ты пал в бою… Но история продолжается.', () => Game.respawn('Ты очнулся в больнице. Врачи спасли тебе жизнь, но лечение стоило денег.'));
    };
    // замедление и отлёт тела перед «TO BE CONTINUED»
    if (J.Fx && J.Fx.ready && !J.UI.blocking()) {
      J.Fx.playerDeath(show);
      setTimeout(show, 2600);
    } else show();
  };
  Game.respawn = function (msg) {
    const p = G.player;
    const w = G.world;
    const here = w.regionAt(p.x, p.y);
    let hs = w.buildings.filter((b) => b.type === 'hospital');
    hs.sort((a, b) => J.dist(a.x, a.y, p.x, p.y) - J.dist(b.x, b.y, p.x, p.y));
    const b = hs[0] || w.buildings[p.homeId];
    p.dead = false;
    p.hp = Math.round(p.maxHp * 0.5);
    p.st = {};
    p.cds = {};
    p.dash = null;
    p.react = null;
    p.airborne = false;
    p.z = 0;
    p.kx = p.ky = 0;
    p.atk = null;
    const lost = Math.floor(p.money * 0.15);
    p.money -= lost;
    J.Veh.clear();
    Game.passTime(240);
    const dp = J.doorPt(b);
    p.x = dp.x;
    p.y = dp.y;
    p.lastSafe = { x: p.x, y: p.y };
    for (const e of G.ents) if (e !== p && e.team === 'enemy') e.despawn = true;
    J.R3.dropView(p);
    J.R3.snapCamera();
    J.R3.clearAll();
    J.R3.updateChunks(p.x, p.y, true);
    J.UI.bigBanner('ВОЗРОЖДЕНИЕ', `${msg} Потеряно: ${J.fmtMoney(lost)}. ${here.name !== w.regionAt(p.x, p.y).name ? '' : ''}`);
  };
  Game.collapse = function (msg) {
    const p = G.player;
    J.Veh.clear();
    p.hp = Math.max(1, Math.round(p.maxHp * 0.25));
    Game.passTime(12 * 60);
    const hs = G.world.buildings.filter((b) => b.type === 'hospital').sort((a, b) => J.dist(a.x, a.y, p.x, p.y) - J.dist(b.x, b.y, p.x, p.y));
    if (hs[0]) {
      const dp = J.doorPt(hs[0]);
      p.x = dp.x;
      p.y = dp.y;
      J.R3.snapCamera();
      J.R3.clearAll();
      J.R3.updateChunks(p.x, p.y, true);
    }
    const lost = Math.floor(p.money * 0.2);
    p.money -= lost;
    J.UI.bigBanner('СТРЕЛА ОТВЕРГЛА ТЕБЯ', `${msg} Ты очнулся в больнице через 12 часов. Счёт за лечение: ${J.fmtMoney(lost)}. Дух закаляется: попробуй снова, когда найдёшь другую Стрелу.`);
    J.P.trainStat(p, 'spi', 30);
  };

  // ---------- Взаимодействие ----------
  Game.interactTarget = function () {
    const p = G.player;
    if (!p || p.dead) return null;
    if (p.inCar) return { exit: p.inCar };
    let best = null, bd = 2.1;
    for (const e of G.ents) {
      if (e === p || e.dead || (e.kind !== 'civ' && e.kind !== 'story')) continue;
      const d = J.dist(p.x, p.y, e.x, e.y);
      if (d < bd) {
        bd = d;
        best = e;
      }
    }
    if (best) return { ent: best };
    const b = G.world.doorNear(p.x, p.y, 1.9);
    if (b) return { b };
    const v = J.Veh.near(p, 1.3);
    if (v) return { car: v };
    return null;
  };
  Game.interact = function () {
    const it = Game.interactTarget();
    if (!it) return;
    if (it.exit) J.Veh.exit(G.player);
    else if (it.car) J.Veh.enter(G.player, it.car);
    else if (it.ent) J.Story.talk(it.ent);
    else J.UI.openBuilding(it.b);
  };

  // ---------- Население ----------
  Game.population = function () {
    const p = G.player;
    const w = G.world;
    const city = w.cityAt(p.x, p.y);
    let civs = 0, enemies = 0;
    for (const e of G.ents) {
      const d = J.dist(e.x, e.y, p.x, p.y);
      if (e.kind === 'civ') {
        if (d > 55) e.despawn = true;
        else civs++;
      } else if (e.team === 'enemy' && !e.storyTag && !e.boss) {
        if (d > 70) e.despawn = true;
        else enemies++;
      }
      if (e.nightOnly && !G.isNight && !e.dead && !e.storyTag) {
        e.despawn = true;
      }
    }
    if (city) {
      const want = Math.round(Math.min(24, city.city * 0.8) * (G.isNight ? 0.4 : 1));
      for (let i = 0; i < 3 && civs < want; i++) {
        // прохожие появляются на тротуарах (дальше 14 м — не на глазах)
        const pos = J.Traffic.pedSpawnPoint(p.x, p.y, 16, 40) || w.randomWalkable(p.x, p.y, 34, J.R, { street: true });
        if (!pos || J.dist(pos.x, pos.y, p.x, p.y) < 14) continue;
        J.addEnt(J.makeCivilian(pos.x, pos.y, w.regionAt(pos.x, pos.y)));
        civs++;
      }
    } else if (enemies < 2 && Math.random() < 0.06) {
      const rg = w.regionAt(p.x, p.y);
      const wild = { mesa: 'coyote', prairie: 'coyote', desert: 'scorpion', alpine: 'wolf', tundra: 'wolf', swamp: 'croc', moor: 'wolf', temperate: 'wolf', savanna: 'coyote', tropical: 'croc', mediterranean: 'coyote' }[rg.biome];
      const mob = G.isNight && rg.danger >= 3 && Math.random() < 0.5 ? 'zombie' : wild;
      if (mob) {
        const pos = w.randomWalkable(p.x, p.y, 26, J.R, { outside: true });
        if (pos && J.dist(pos.x, pos.y, p.x, p.y) > 16) {
          const n = mob === 'zombie' ? 3 : 2;
          for (let i = 0; i < n; i++) {
            const e = J.makeMob(mob, pos.x + i * 0.8, pos.y, Math.max(1, Math.round((p.lvl + rg.danger) / 2)));
            if (mob === 'zombie') e.nightOnly = true;
            J.addEnt(e);
          }
        }
      }
    }
  };

  // ---------- Ярлыки ----------
  Game.labeled = new Set();
  Game.frame = 0;
  Game.updateLabels = function () {
    const f = ++Game.frame;
    const p = G.player;
    const R3 = J.R3;
    const act = Game.labeled;
    const w = G.world;
    const show = (o, html, cls, x, y, h) => {
      const elx = R3.label(o, html, cls);
      R3.placeLabel(elx, x, y, h);
      o._lf = f;
      act.add(o);
    };
    const hasStand = !!p.stand;
    for (const e of G.ents) {
      if (e === p || e.dead || e.vanish || e.summon) continue;
      if (e.standSummon && !hasStand) continue;
      const d = J.dist(p.x, p.y, e.x, e.y);
      const gy = w.groundY(e.x, e.y) + (e.z || 0);
      const top = gy + 1.9 * (e.scale || 1) + (e.model ? -0.6 : 0);
      if (e.kind === 'story' && d < 24) show(e, `<b>${J.esc(e.name)}</b>`, 'npc', e.x, e.y, top);
      else if ((e.team === 'enemy' || e.origTeam === 'enemy') && d < 22 && !(e.st.invis > 0 && !(G.reveal > 0)) && !e.st.void) {
        const pct = Math.max(0, (e.hp / e.maxHp) * 100).toFixed(0);
        const stName = e.stand ? (hasStand ? `<em style="color:${J.STANDS[e.stand.id].c1}">「${J.esc(J.STANDS[e.stand.id].ru)}」</em>` : '<em>「???」</em>') : '';
        show(e, `<b>${e.boss ? '★ ' : ''}${J.esc(e.name)}</b>${stName}<i class="hpb${e.boss ? ' boss' : ''}"><s style="width:${pct}%"></s></i>`, 'foe' + (e.team === 'player' ? ' charmed' : ''), e.x, e.y, top);
      } else if (e.kind === 'civ' && d < 5) show(e, J.esc(e.name), 'civ', e.x, e.y, top);
    }
    Game._bT = (Game._bT || 0) - 1;
    if (Game._bT <= 0) {
      Game._bT = 20;
      Game.nearB = w.buildings.filter((b) => b.type !== 'house' && J.dist(p.x, p.y, b.door.x, b.door.y) < 18);
    }
    for (const b of Game.nearB || []) {
      const dp = J.doorPt(b, 1.1);
      show(b, J.esc(b.name), 'sign', dp.x, dp.y, 3.1);
    }
    for (const o of act) {
      if (o._lf !== f) {
        if (o.labelEl) {
          o.labelEl.style.display = 'none';
          o.labelEl._hid = true;
        }
        act.delete(o);
      }
    }
  };

  // ---------- Главный цикл ----------
  Game.loop = function (now) {
    requestAnimationFrame(Game.loop);
    let dt = (now - Game.last) / 1000;
    Game.last = now;
    if (Game.state === 'play') J.R3.updateDynRes(dt * 1000); // динамическое разрешение по настоящей длине кадра
    if (!(dt > 0)) dt = 0.016;
    dt = Math.min(dt, 0.05);
    try {
      if (Game.state === 'play') Game.update(dt);
      else if (Game.state === 'title') Game.updateTitle(dt);
    } catch (e) {
      console.error(e);
      if (!Game._errShown) {
        Game._errShown = true;
        J.UI.toast('Ошибка в игре: ' + e.message, 'red');
      }
    }
  };
  Game.updateTitle = function (dt) {
    if (!G.world || !G.titleCam) return;
    G.t += dt;
    const c = J.R3.cam;
    c.yaw += dt * 0.05;
    c.pitch = 0.62;
    G.titleCam.x += Math.cos(G.t * 0.05) * dt * 1.5;
    G.titleCam.y += Math.sin(G.t * 0.04) * dt * 1.5;
    J.R3.updateChunks(G.titleCam.x, G.titleCam.y);
    J.R3.setTime(1140 + Math.sin(G.t * 0.02) * 60, G.titleCam.x, G.titleCam.y, 'temperate', null);
    if (J.Fx && J.Fx.SEE) J.Fx.SEE.on.value = 0;
    J.R3.updateCamera(G.titleCam.x, G.titleCam.y, 0, dt, { mode: 'title' });
    J.R3.render();
  };

  Game.update = function (rdt) {
    const p = G.player;
    const UI = J.UI;
    const R3 = J.R3;
    const Fx = J.Fx;
    const blocking = UI.blocking();
    // мышь: все движения за кадр — одним поворотом
    if (Input.mdx || Input.mdy) {
      if (!blocking) Input.rotateCam(Input.mdx, Input.mdy);
      Input.mdx = Input.mdy = 0;
    }
    // rdt — реальное время кадра; dt — игровое (0 в стоп-кадре, меньше в замедлении)
    const dt = blocking ? 0 : Fx ? Fx.tick(rdt) : rdt;
    if (!blocking && dt > 1e-4) {
      G.t += dt;
      // время
      const rate = G.timeAccel > 0 ? 45 : 2;
      if (G.timeAccel > 0 && G.timeAccel !== 1) G.timeAccel = Math.max(0, G.timeAccel - dt);
      if (!G.timestop) {
        G.time += dt * rate;
        Game._mAcc = (Game._mAcc || 0) + dt * rate;
        if (Game._mAcc >= 1) {
          const m = Math.floor(Game._mAcc);
          Game._mAcc -= m;
          Game.tickMinutes(m);
        }
      }
      Game.updateClock();
      // остановка времени (вступление со сферой не считается)
      if (G.timestop) {
        if (G.timestop.intro > 0) G.timestop.intro -= dt;
        else G.timestop.t -= dt;
        if (G.timestop.t <= 0 || G.timestop.by.dead) {
          G.timestop = null;
          UI.timestopFx(false);
          R3.text(p.x, p.y, 'Время снова движется', 'tmiss', 1.2);
          p.tsMove = 0;
        }
      }
      if (G.reveal > 0) G.reveal -= dt;
      if (G._invisT > 0) G._invisT -= dt;
      // ввод игрока
      const m = Game.moveInput();
      const inp = { mx: m.mx, my: m.my, sprint: Input.keys.ShiftLeft || Input.keys.ShiftRight || Input.runToggle, breathe: Input.keys.KeyV || Input.touchHold.v, guard: !!(Input.keys.KeyZ || Input.guardM || Input.touchHold.guard) };
      const tsFrozen = G.timestop && G.timestop.by !== p && !(p.tsMove > 0);
      if (p.inCar) {
        // за рулём: потребности и реген идут как обычно, движение — у машины
        inp.mx = inp.my = 0;
        inp.sprint = inp.breathe = false;
        J.P.update(p, dt, inp);
      } else if (!tsFrozen) {
        J.P.update(p, dt, inp);
        if ((Input.mouse.l || Input.touchHold.atk || p.buf) && !p.dead && !(J.Cb && J.Cb.inClash(p))) J.P.basicAttack(p);
      } else {
        p.vx = p.vy = 0;
      }
      J.Veh.update(dt, J.Veh.input());
      J.updateEnts(dt);
      if (J.Cb) J.Cb.update(dt);
      if (J.Pw) J.Pw.update(dt);
      J.updateProjs(dt);
      J.updateFields(dt);
      J.updateTraps(dt);
      J.updatePickups(dt);
      // таймеры
      G.timers = G.timers.filter((t) => {
        if (G.timestop && G.timestop.by !== p) return true;
        t.t -= dt;
        if (t.t <= 0) {
          t.fn();
          return false;
        }
        return true;
      });
      J.Story.update(dt);
      Game.popT -= dt;
      if (Game.popT <= 0) {
        Game.popT = 1;
        Game.population();
      }
      // Дьявольская ладонь
      const dp = G.world.places.devils_palm;
      if (dp && !p.flags.devilsPalm && J.dist(p.x, p.y, dp.x, dp.y) < 3) {
        p.flags.devilsPalm = true;
        if (!p.stand) J.P.giveStand(p, J.pickW(J.R, J.standPool((s) => s.part === 7 || s.part === 8)).s.id, 'Дьявольская ладонь! Песок пробудил в тебе стенд.');
        else {
          J.P.standXp(p, 600);
          UI.toast('Дьявольская ладонь усиливает твой стенд!', 'gold');
        }
      }
      if (Fx) Fx.flush();
    }
    // рендер
    const rg = G.world.regionAt(p.x, p.y);
    R3.updateChunks(p.x, p.y);
    const hasStand = !!p.stand;
    R3.viewBudget = 1;
    R3.rankCasters(G.ents, p.x, p.y);
    for (const e of G.ents) R3.updateView(e, dt, G.t, hasStand);
    R3.updateCars(G.vehs, G.t, p.inCar);
    R3.updateSignals(G.world, G.t);
    if (!blocking) {
      // в остановленном времени частицы замирают
      R3.updateParticles(Fx && Fx.tsK > 0.5 ? 0 : dt);
      R3.updateFx(dt);
    }
    if (Fx) Fx.update(blocking ? 0 : rdt, dt);
    if (J.Pw) J.Pw.draw(blocking ? 0 : rdt, blocking ? 0 : dt);
    R3.updateText(blocking ? 0 : rdt);
    let wth = G.weather;
    if (!wth && rg.biome === 'tundra') wth = 'snow';
    R3.setTime(G.time, R3.cam.tx, R3.cam.tz, rg.biome, wth);
    if (Fx && (Fx.tsK > 0 || Fx.skipK > 0)) Fx.desatSky(Fx.tsK);
    R3.updateWeather(Fx && Fx.tsK > 0.5 ? 0 : rdt, wth === 'fog' ? null : wth, R3.cam.tx, R3.cam.tz);
    // стрелки вращают камеру
    if (!blocking) {
      const k = Input.keys;
      const ax = (k.ArrowRight ? 1 : 0) - (k.ArrowLeft ? 1 : 0), ay = (k.ArrowDown ? 1 : 0) - (k.ArrowUp ? 1 : 0);
      if (ax || ay) R3.rotateCam(ax * 2.4 * rdt * Game.settings.sens, ay * 1.4 * rdt * Game.settings.sens);
    }
    const car = p.inCar;
    if (car) {
      // в машине: камера дальше и выше для больших машин, сама заходит за спину
      const vt = car.vt;
      R3.updateCamera(car.x, car.y, car.gy + Math.max(0, vt.H - 1.45) * 0.8, rdt, { mode: 'car', heading: car.ang, speed: Math.abs(car.vf), scale: Math.max(1, vt.L / 4.6) * 0.85 + 0.15 });
    } else {
      const moving = !blocking && Math.hypot(p.vx, p.vy) > 0.5 && !Input.touchHold.atk && !Input.mouse.l;
      R3.updateCamera(p.x, p.y, G.world.groundY(p.x, p.y) + (p.z || 0), rdt, { mode: 'foot', heading: p.face, moving });
    }
    if (Fx) {
      Fx.applyCamera(R3.camera, rdt);
      Fx.updateSee();
    }
    if (!Fx || !Fx.renderOverride()) R3.render();
    Game.updateLabels();
    UI.update(rdt);
    J.Veh.hud(p);
  };

  window.addEventListener('load', () => {
    if (!window.THREE) {
      document.getElementById('loading').hidden = false;
      document.querySelector('#loading span').textContent = 'Не удалось загрузить 3D-движок (Three.js). Проверь подключение к интернету.';
      return;
    }
    Game.init();
  });
})();
