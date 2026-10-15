'use strict';
// Интерфейс: HUD, панели, диалоги, здания, мини-игры, создание персонажа, сенсорное управление.
(function () {
  const G = () => J.G;
  const P = () => J.G.player;
  const UI = (J.UI = {});
  const $ = (s, r) => (r || document).querySelector(s);
  const el = (tag, cls, html) => {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (html !== undefined) e.innerHTML = html;
    return e;
  };
  const esc = J.esc;

  // ---------- Построение DOM ----------
  UI.build = function () {
    const root = $('#ui');
    root.innerHTML = `
    <div id="hud" hidden>
      <div id="hud-left">
        <div class="who"><b id="h-name"></b><span id="h-lvl" class="chip"></span></div>
        <div class="bar hp"><i id="b-hp"></i><span id="t-hp"></span></div>
        <div class="bar stam"><i id="b-st"></i></div>
        <div class="bar se" id="w-se"><i id="b-se"></i><span id="t-se"></span></div>
        <div class="bar br" id="w-br"><i id="b-br"></i><span id="t-br">Дыхание</span></div>
        <div class="bar blood" id="w-bl"><i id="b-bl"></i><span>Жажда крови</span></div>
        <div class="needs">
          <div class="mini" id="w-hu"><span>Сытость</span><div class="bar sm hun"><i id="b-hu"></i></div></div>
          <div class="mini"><span>Бодрость</span><div class="bar sm en"><i id="b-en"></i></div></div>
        </div>
        <div id="h-money"></div>
        <div id="h-status"></div>
      </div>
      <div id="hud-right">
        <canvas id="minimap" width="168" height="168"></canvas>
        <div class="clockrow"><b id="h-clock"></b><span id="h-day"></span></div>
        <div id="h-region"></div>
      </div>
      <div id="tracker"></div>
      <div id="prompt" hidden></div>
      <div id="abilities"></div>
      <div id="hint">Клик по игре — захват мыши · F1 — помощь · Esc — меню</div>
    </div>
    <div id="toasts"></div>
    <div id="vignette"></div>
    <div id="menace"></div>
    <div id="panel" class="modal" hidden><div class="pbox"><nav id="tabs"></nav><div id="pbody"></div><button id="pclose" aria-label="Закрыть">✕</button></div></div>
    <div id="bpanel" class="modal" hidden><div class="pbox narrow"><div id="bbody"></div><button id="bclose" aria-label="Закрыть">✕</button></div></div>
    <div id="dialog" hidden><div class="dname"></div><div class="dtext"></div><div class="dchoices"></div><div class="dnext">▼</div></div>
    <div id="confirm" class="modal" hidden><div class="pbox narrow"><h3 id="cf-title"></h3><p id="cf-text"></p><div class="row"><button id="cf-yes" class="btn gold">Да</button><button id="cf-no" class="btn">Отмена</button></div></div></div>
    <div id="banner" hidden><div class="bt"></div><div class="bs"></div><div class="bh">Нажми любую клавишу</div></div>
    <div id="reveal" class="modal" hidden><div class="rbox"><div class="rmsg"></div><div class="rname"></div><div class="ren"></div><canvas id="hexc" width="260" height="260"></canvas><div class="rdesc"></div><button class="btn gold" id="rok">Стенд!</button></div></div>
    <div id="mini" class="modal" hidden><div class="pbox narrow"><h3 id="mg-title"></h3><p id="mg-text"></p><canvas id="mgc" width="420" height="140"></canvas><div class="row"><b id="mg-score"></b></div><p class="muted" id="mg-help"></p></div></div>
    <div id="death" hidden><div class="tbc"><span>TO BE CONTINUED</span><svg viewBox="0 0 120 40" width="120" height="40"><path d="M118 20 L30 20 M30 6 L4 20 L30 34 Z" stroke="currentColor" stroke-width="6" fill="currentColor"/></svg></div><p id="death-text"></p></div>
    <div id="touch" hidden>
      <div id="joy"><div id="joyk"></div></div>
      <div id="tbtns">
        <button data-k="atk" class="tb big">Удар</button>
        <button data-k="heavy" class="tb">Сил.</button>
        <button data-k="dash" class="tb">Рывок</button>
        <button data-k="guard" class="tb">Блок</button>
        <button data-k="rush" class="tb">Раш</button>
        <button data-k="q" class="tb">Q</button>
        <button data-k="e" class="tb">E</button>
        <button data-k="r" class="tb">R</button>
        <button data-k="1" class="tb sm">1</button>
        <button data-k="2" class="tb sm">2</button>
        <button data-k="3" class="tb sm">3</button>
        <button data-k="g" class="tb">Стенд</button>
        <button data-k="v" class="tb sm">Дых.</button>
        <button data-k="f" class="tb">F</button>
        <button data-k="hb" class="tb big drv">Ручник</button>
        <button data-k="horn" class="tb drv">Сигнал</button>
      </div>
      <div id="ttop"><button data-k="menu" class="tb sm">☰</button><button data-k="map" class="tb sm">Карта</button><button data-k="run" class="tb sm">Бег</button></div>
    </div>`;
    $('#pclose').onclick = () => UI.closePanel();
    $('#bclose').onclick = () => UI.closeBuilding();
    $('#rok').onclick = () => UI.closeReveal();
    $('#cf-no').onclick = () => UI.closeConfirm(false);
    $('#cf-yes').onclick = () => UI.closeConfirm(true);
    $('#dialog').addEventListener('click', (e) => {
      if (e.target.closest('button')) return;
      UI.dialogNext();
    });
    $('#banner').addEventListener('click', () => UI.closeBanner());
    UI.minimap = $('#minimap').getContext('2d');
    UI.buildAbilityBar();
  };

  UI.blocking = () => !!(UI.panelOpen || UI.bOpen || UI.dlg || UI.cfOpen || UI.bannerOpen || UI.revealOpen || UI.mgOpen || UI.deathOpen || UI.inMenu);

  // ---------- Тосты ----------
  UI.toast = function (text, type) {
    const box = $('#toasts');
    if (!box) return;
    const t = el('div', 'toast ' + (type || ''), esc(text));
    box.prepend(t);
    while (box.children.length > 5) box.lastChild.remove();
    setTimeout(() => t.classList.add('out'), 4200);
    setTimeout(() => t.remove(), 4800);
  };

  // ---------- Звук (простые синтезированные эффекты) ----------
  UI.sound = true;
  UI.sfx = function (name) {
    if (!UI.sound) return;
    // боевые звуки синтезирует J.Sfx (удары и остановку времени озвучивает J.Fx)
    if (J.Sfx && J.Sfx.ac && J.Fx && J.Fx.ready) {
      if (name === 'hit' || name === 'ts') return;
      if (name === 'stand') return J.Sfx.summon();
    }
    try {
      if (!UI.ac) UI.ac = new (window.AudioContext || window.webkitAudioContext)();
      const ac = UI.ac;
      const o = ac.createOscillator(), g = ac.createGain();
      o.connect(g);
      g.connect(ac.destination);
      const t = ac.currentTime;
      const set = { coin: [880, 1320, 0.12, 'square'], level: [440, 880, 0.4, 'triangle'], stand: [180, 520, 0.35, 'sawtooth'], hit: [140, 60, 0.08, 'square'], ts: [600, 60, 1.2, 'sine'], ui: [520, 520, 0.05, 'sine'] }[name] || [440, 440, 0.1, 'sine'];
      o.type = set[3];
      o.frequency.setValueAtTime(set[0], t);
      o.frequency.exponentialRampToValueAtTime(set[1], t + set[2]);
      g.gain.setValueAtTime(0.06, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + set[2]);
      o.start(t);
      o.stop(t + set[2] + 0.02);
    } catch (e) {}
  };

  // ---------- Полосы способностей ----------
  UI.buildAbilityBar = function () {
    const bar = $('#abilities');
    bar.innerHTML = '';
    const mk = (key, id) => {
      const d = el('div', 'ab', `<span class="k">${key}</span><span class="n"></span><i class="cd"></i>`);
      d.id = 'ab-' + id;
      bar.appendChild(d);
      return d;
    };
    UI.abEls = {
      basic: mk('ЛКМ', 'basic'), heavy: mk('X', 'heavy'), s0: mk('Q', 's0'), s1: mk('E', 's1'), s2: mk('R', 's2'),
      g: mk('G', 'g'), y0: mk('1', 'y0'), y1: mk('2', 'y1'), y2: mk('3', 'y2'),
    };
  };
  UI.updateAbilityBar = function () {
    const p = P();
    const E = UI.abEls;
    const sd = p.stand ? J.STANDS[p.stand.id] : null;
    const setAb = (e, name, cd, max, locked, color) => {
      e.querySelector('.n').textContent = name;
      const k = max ? J.clamp(cd / max, 0, 1) : 0;
      e.querySelector('.cd').style.height = k * 100 + '%';
      e.classList.toggle('locked', !!locked);
      e.style.setProperty('--c', color || 'var(--gold)');
    };
    setAb(E.basic, sd ? 'Удар стенда' : p.style === 'hamon' ? 'Хамон-кулак' : 'Удар', p.cds.basic || 0, 0.5, false, sd ? sd.c1 : null);
    setAb(E.heavy, 'Тяжёлый', p.cds.heavy || 0, 2.2, false, sd ? sd.c1 : null);
    for (let i = 0; i < 3; i++) {
      const ab = sd ? sd.abil[i] : null;
      const cdm = (p.cdMax && p.cdMax['s' + i]) || (ab ? ab.cd : 1);
      setAb(E['s' + i], ab ? ab.name : '—', p.cds['s' + i] || 0, cdm, !ab || p.stand.lvl < ab.lvl, sd ? sd.c2 : '#666');
      E['s' + i].title = ab ? `${ab.name} (ур. ${ab.lvl}, энергия ${ab.cost})` : '';
    }
    setAb(E.g, sd ? (p.standOut ? 'Убрать' : 'Призвать') : 'Нет стенда', 0, 1, !sd, sd ? sd.c1 : '#666');
    const S = p.style ? J.Abil.STYLES[p.style] : null;
    for (let i = 0; i < 3; i++) {
      const sl = S ? S.slots[i] : null;
      const lvl = !S ? 0 : p.style === 'hamon' ? p.hamon.lvl : p.style === 'spin' ? p.spin.lvl : 1;
      setAb(E['y' + i], sl ? sl.name : '—', p.cds[p.style + i] || 0, sl ? sl.cd : 1, !sl || lvl < sl.lvl, S ? S.color : '#666');
      E['y' + i].style.display = S ? '' : 'none';
    }
  };

  // ---------- HUD ----------
  UI.hudShow = (v) => ($('#hud').hidden = !v);
  UI.update = function (dt) {
    const p = P();
    if (!p) return;
    const pct = (a, b) => J.clamp((a / b) * 100, 0, 100) + '%';
    $('#b-hp').style.width = pct(p.hp, p.maxHp);
    $('#t-hp').textContent = `${Math.ceil(p.hp)} / ${p.maxHp}`;
    $('#b-st').style.width = pct(p.stamina, p.staminaMax);
    $('#w-se').hidden = !p.stand;
    if (p.stand) {
      $('#b-se').style.width = pct(p.se, p.seMax);
      $('#t-se').textContent = J.STANDS[p.stand.id].ru;
      $('#b-se').style.background = J.STANDS[p.stand.id].c1;
    }
    $('#w-br').hidden = !(p.hamon && !p.vampire);
    if (p.hamon) {
      $('#b-br').style.width = pct(p.breath, p.breathMax);
      $('#t-br').textContent = p.breathing ? 'Дыхание хамона...' : 'Дыхание (V)';
    }
    $('#w-bl').hidden = !(p.vampire && !p.ultimate);
    if (p.vampire) $('#b-bl').style.width = pct(p.blood, 100);
    $('#w-hu').hidden = p.vampire;
    $('#b-hu').style.width = pct(p.hunger, 100);
    $('#b-en').style.width = pct(p.energy, 100);
    UI._slow = (UI._slow || 0) - dt;
    if (UI._slow > 0) return;
    UI._slow = 0.15;
    const g = G();
    $('#h-name').textContent = p.name;
    $('#h-lvl').textContent = 'Ур. ' + p.lvl + (p.points ? ` · +${p.points}` : '');
    $('#h-money').textContent = J.fmtMoney(p.money);
    $('#h-clock').textContent = J.fmtClock(g.time);
    $('#h-day').textContent = 'День ' + g.day + (g.weather ? ' · ' + { rain: 'дождь', snow: 'снег', sand: 'буря', fog: 'туман' }[g.weather] : '') + (g.isSunny ? ' · ☀' : g.isNight ? ' · ☾' : '');
    const rg = g.world.regionAt(p.x, p.y);
    const city = g.world.cityAt(p.x, p.y);
    $('#h-region').textContent = rg.name + (city ? '' : ' · окрестности');
    // статусы
    const sts = [];
    const nm = { stun: 'Оглушён', freeze: 'Заморожен', poison: 'Отравлен', burn: 'Горит', bleed: 'Кровотечение', slow: 'Замедлен', heavy: 'Тяжесть', age: 'Старение', invis: 'Невидим', invuln: 'Неуязвим', haste: 'Ускорен', power: 'Сила+', armor: 'Броня', fly: 'Полёт', silence: 'Стенд заблокирован', dodge: 'Эпитафия', zero: 'Реквием', lovetrain: 'Поезд Любви', heaven: 'Небеса', luck: 'Удача', regen: 'Регенерация', void: 'Пустота', sleep: 'Сон', reflect: 'Отражение', dino: 'Динозавр', infinite: 'Бесконечное вращение', counter: 'Контрудар!' };
    for (const k in p.st) if (p.st[k] > 0 && nm[k]) sts.push(`<span class="chip">${nm[k]} ${Math.ceil(p.st[k])}с</span>`);
    if (p.hunger < 15 && !p.vampire) sts.push('<span class="chip red">Голоден</span>');
    if (p.energy < 15) sts.push('<span class="chip red">Устал</span>');
    if (p.vampire && g.isSunny && !p.ultimate) sts.push('<span class="chip red">СОЛНЦЕ!</span>');
    if (p.mount) sts.push('<span class="chip">Верхом</span>');
    if (p.style) sts.push(`<span class="chip">${J.Abil.STYLES[p.style].name}</span>`);
    $('#h-status').innerHTML = sts.join('');
    UI.updateAbilityBar();
    UI.updateTracker();
    UI.drawMinimap();
    UI.updatePrompt();
  };

  UI.updatePrompt = function () {
    const it = J.Game.interactTarget();
    const pr = $('#prompt');
    if (!it) {
      pr.hidden = true;
      return;
    }
    pr.hidden = false;
    const key = J.Input.touch ? 'F' : 'F';
    if (it.exit) {
      pr.innerHTML = `<b>${key}</b> Выйти из машины`;
      return;
    }
    if (it.car) {
      pr.innerHTML = it.car.driver === true ? `<b>${key}</b> Вытащить водителя и угнать: ${esc(it.car.vt.name.toLowerCase())}` : `<b>${key}</b> Сесть в машину: ${esc(it.car.vt.name.toLowerCase())}`;
      return;
    }
    pr.innerHTML = it.ent ? `<b>${key}</b> Говорить: ${esc(it.ent.name)}` : `<b>${key}</b> Войти: ${esc(it.b.name)}`;
  };

  UI.questDirty = () => (UI._slow = 0);
  UI.updateTracker = function () {
    const p = P();
    const ms = J.Story.markers();
    if (G().waypoint) ms.push({ x: G().waypoint.x, y: G().waypoint.y, label: 'Метка на карте', kind: 'way' });
    const st = G().story;
    let h = '';
    if (st.arc) h += `<div class="tq-arc">${esc(J.Story.ARCS[st.arc.id].title)}</div>`;
    else if (st.idx < st.fate.length) h += `<div class="tq-arc muted">Обычная жизнь… (день ${G().day})</div>`;
    const yaw = J.R3.cam.yaw;
    ms.slice(0, 5).forEach((m) => {
      const d = J.dist(p.x, p.y, m.x, m.y);
      const rel = Math.atan2(m.y - p.y, m.x - p.x) - yaw;
      h += `<div class="tq ${m.kind}"><i style="transform:rotate(${rel}rad)">▲</i><span>${esc(m.label)}</span><em>${d < 1000 ? Math.round(d) + ' м' : (d / 1000).toFixed(1) + ' км'}</em></div>`;
    });
    if (!ms.length && !st.arc) h += '<div class="tq-tip">Работай, тренируйся, исследуй мир. Задания — в барах и полиции.</div>';
    $('#tracker').innerHTML = h;
  };

  UI.drawMinimap = function () {
    const ctx = UI.minimap;
    const g = G();
    const p = P();
    const img = J.Game.mapImg;
    const S = 168, sc = 2;
    const half = S / 2 / sc;
    ctx.save();
    ctx.fillStyle = '#123';
    ctx.fillRect(0, 0, S, S);
    ctx.beginPath();
    ctx.arc(S / 2, S / 2, S / 2 - 2, 0, J.TAU);
    ctx.clip();
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(img, p.x - half, p.y - half, half * 2, half * 2, 0, 0, S, S);
    const toM = (x, y) => [(x - p.x) * sc + S / 2, (y - p.y) * sc + S / 2];
    // враги
    for (const e of g.ents) {
      if (e.dead) continue;
      if (e.team === 'enemy' || e.kind === 'story') {
        const [mx, my] = toM(e.x, e.y);
        if (mx < 0 || my < 0 || mx > S || my > S) continue;
        if (e.st.invis > 0 && !(g.reveal > 0)) continue;
        ctx.fillStyle = e.kind === 'story' ? '#5ac8fa' : e.boss ? '#ff2a6a' : '#ff5d5d';
        ctx.beginPath();
        ctx.arc(mx, my, e.boss ? 4 : 2.5, 0, J.TAU);
        ctx.fill();
      }
    }
    // маркеры
    const ms = J.Story.markers();
    if (g.waypoint) ms.push({ x: g.waypoint.x, y: g.waypoint.y, kind: 'way' });
    for (const m of ms) {
      let [mx, my] = toM(m.x, m.y);
      const dx = mx - S / 2, dy = my - S / 2;
      const L = Math.hypot(dx, dy);
      if (L > S / 2 - 8) {
        mx = S / 2 + (dx / L) * (S / 2 - 8);
        my = S / 2 + (dy / L) * (S / 2 - 8);
      }
      ctx.fillStyle = m.kind === 'main' ? '#f2c230' : m.kind === 'way' ? '#5ac8fa' : '#e2368f';
      ctx.beginPath();
      ctx.moveTo(mx, my - 6);
      ctx.lineTo(mx + 5, my);
      ctx.lineTo(mx, my + 6);
      ctx.lineTo(mx - 5, my);
      ctx.fill();
    }
    // скрытые предметы при ясновидении
    if (g.reveal > 0) for (const pk of g.pickups) {
      const [mx, my] = toM(pk.x, pk.y);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(mx - 2, my - 2, 4, 4);
    }
    // игрок и конус обзора
    ctx.translate(S / 2, S / 2);
    ctx.fillStyle = 'rgba(255,255,255,0.12)';
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.arc(0, 0, 40, J.R3.cam.yaw - 0.6, J.R3.cam.yaw + 0.6);
    ctx.fill();
    ctx.rotate(p.face);
    ctx.fillStyle = '#fff';
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(7, 0);
    ctx.lineTo(-5, -5);
    ctx.lineTo(-2, 0);
    ctx.lineTo(-5, 5);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();
    ctx.strokeStyle = 'rgba(242,194,48,0.8)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(S / 2, S / 2, S / 2 - 2, 0, J.TAU);
    ctx.stroke();
  };

  UI.hurtFlash = function (k) {
    const v = $('#vignette');
    v.style.opacity = Math.min(0.8, 0.25 + k * 3);
    clearTimeout(UI._hf);
    UI._hf = setTimeout(() => (v.style.opacity = 0), 160);
    UI.sfx('hit');
  };
  UI.timestopFx = function (on) {
    const c = $('#game');
    if (on) {
      c.classList.add('ts-flash');
      setTimeout(() => {
        c.classList.remove('ts-flash');
        if (G().timestop) c.classList.add('ts');
      }, 250);
      UI.sfx('ts');
    } else c.classList.remove('ts', 'ts-flash');
  };
  UI.timeskipFx = function (on) {
    // с эффектами боя мир багровеет через шейдер (J.Fx); CSS-фильтр — запасной вариант
    if (J.Fx && J.Fx.worldPatched) on = false;
    $('#game').classList.toggle('tskip', !!on);
  };
  UI.rewindFx = function () {
    const c = $('#game');
    c.classList.add('rewind');
    setTimeout(() => c.classList.remove('rewind'), 600);
  };
  UI.menacing = function (e) {
    const box = $('#menace');
    box.innerHTML = '';
    for (let i = 0; i < 10; i++) {
      const s = el('span', 'gogo', i % 3 === 2 ? 'ド' : 'ゴ');
      const side = i % 2;
      s.style.left = (side ? 78 + Math.random() * 16 : 3 + Math.random() * 14) + '%';
      s.style.top = 15 + Math.random() * 60 + '%';
      s.style.animationDelay = (i * 0.12).toFixed(2) + 's';
      s.style.fontSize = 28 + Math.random() * 36 + 'px';
      box.appendChild(s);
    }
    box.classList.add('on');
    clearTimeout(UI._mt);
    UI._mt = setTimeout(() => box.classList.remove('on'), 3200);
    if (e) J.R3.text(e.x, e.y, 'ゴゴゴゴ', 'tgogo', 2.5, 2.8);
  };

  // ---------- Диалоги ----------
  UI.say = function (name, lines, then) {
    if (!Array.isArray(lines)) lines = [lines];
    UI.dlg = { name, lines: lines.slice(), then, choices: null };
    UI.showDialog();
  };
  UI.ask = function (name, text, choices) {
    UI.dlg = { name, lines: [text], then: null, choices };
    UI.showDialog();
  };
  UI.showDialog = function () {
    const d = UI.dlg;
    const box = $('#dialog');
    J.Input.releasePointer();
    box.hidden = false;
    box.querySelector('.dname').textContent = d.name;
    const t = box.querySelector('.dtext');
    const line = d.lines[0];
    t.textContent = line;
    const ch = box.querySelector('.dchoices');
    ch.innerHTML = '';
    const last = d.lines.length === 1;
    box.querySelector('.dnext').style.visibility = last && d.choices ? 'hidden' : 'visible';
    if (last && d.choices) {
      d.choices.forEach((c, i) => {
        const b = el('button', 'btn choice', `<span class="k">${i + 1}</span>${esc(c.t)}`);
        b.onclick = () => UI.choose(i);
        ch.appendChild(b);
      });
    }
  };
  UI.choose = function (i) {
    const d = UI.dlg;
    if (!d || !d.choices || d.lines.length > 1) return;
    const c = d.choices[i];
    if (!c) return;
    UI.dlg = null;
    $('#dialog').hidden = true;
    c.fn && c.fn();
  };
  UI.dialogNext = function () {
    const d = UI.dlg;
    if (!d) return;
    if (d.lines.length > 1) {
      d.lines.shift();
      UI.showDialog();
      return;
    }
    if (d.choices) return;
    UI.dlg = null;
    $('#dialog').hidden = true;
    if (d.then) d.then();
  };

  // ---------- Подтверждение ----------
  UI.confirm = function (title, text, onYes) {
    UI.cfOpen = { onYes };
    J.Input.releasePointer();
    $('#cf-title').textContent = title;
    $('#cf-text').textContent = text;
    $('#confirm').hidden = false;
  };
  UI.closeConfirm = function (yes) {
    const c = UI.cfOpen;
    UI.cfOpen = null;
    $('#confirm').hidden = true;
    if (yes && c && c.onYes) c.onYes();
  };

  // ---------- Баннер ----------
  UI.bigBanner = function (title, sub, isArc, isWin) {
    const b = $('#banner');
    b.querySelector('.bt').textContent = title;
    b.querySelector('.bs').textContent = sub || '';
    b.className = isArc ? 'arc' : isWin ? 'win' : '';
    b.hidden = false;
    UI.bannerOpen = true;
    UI.bannerT = performance.now();
    J.Input.releasePointer();
  };
  UI.closeBanner = function () {
    if (performance.now() - UI.bannerT < 600) return;
    $('#banner').hidden = true;
    UI.bannerOpen = false;
  };

  // ---------- Открытие стенда ----------
  UI.standReveal = function (id, msg) {
    const sd = J.STANDS[id];
    const r = $('#reveal');
    r.querySelector('.rmsg').textContent = msg || '';
    r.querySelector('.rname').textContent = sd.ru;
    r.querySelector('.ren').textContent = `「${sd.name}」 · ${sd.type} · Часть ${sd.part}`;
    r.querySelector('.rdesc').textContent = sd.desc;
    r.style.setProperty('--c1', sd.c1);
    r.style.setProperty('--c2', sd.c2);
    UI.drawHex($('#hexc'), sd);
    r.hidden = false;
    UI.revealOpen = true;
    UI.revealT = performance.now();
    J.Input.releasePointer();
    UI.sfx('stand');
  };
  UI.closeReveal = function () {
    if (performance.now() - UI.revealT < 500) return;
    $('#reveal').hidden = true;
    UI.revealOpen = false;
  };
  UI.drawHex = function (cv, sd) {
    const ctx = cv.getContext('2d');
    const W = cv.width, H = cv.height, cx = W / 2, cy = H / 2, R = W * 0.36;
    ctx.clearRect(0, 0, W, H);
    const keys = ['pow', 'spd', 'rng', 'dur', 'pre', 'pot'];
    const pt = (i, r) => [cx + Math.cos(-Math.PI / 2 + (i / 6) * J.TAU) * r, cy + Math.sin(-Math.PI / 2 + (i / 6) * J.TAU) * r];
    ctx.strokeStyle = 'rgba(244,236,255,0.25)';
    ctx.lineWidth = 1;
    for (let k = 1; k <= 5; k++) {
      ctx.beginPath();
      for (let i = 0; i <= 6; i++) {
        const [x, y] = pt(i % 6, (R * k) / 5);
        i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
      }
      ctx.stroke();
    }
    for (let i = 0; i < 6; i++) {
      const [x, y] = pt(i, R);
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(x, y);
      ctx.stroke();
    }
    ctx.beginPath();
    keys.forEach((k, i) => {
      const v = J.clamp(J.rankNum(sd.st[k]), 0, 5.6);
      const [x, y] = pt(i, (R * Math.max(0.3, v)) / 5);
      i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
    });
    ctx.closePath();
    ctx.fillStyle = J.rgba(sd.c1, 0.55);
    ctx.fill();
    ctx.strokeStyle = sd.c2;
    ctx.lineWidth = 2.5;
    ctx.stroke();
    ctx.font = '600 13px Rubik, system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    keys.forEach((k, i) => {
      const [x, y] = pt(i, R + 26);
      ctx.fillStyle = '#b7a6cf';
      ctx.fillText(J.STAT_NAMES[k], x, y - 8);
      ctx.fillStyle = '#f2c230';
      ctx.font = '900 16px "Dela Gothic One", Rubik, sans-serif';
      const r = sd.st[k];
      ctx.fillText(/[A-E∞]/.test(r) ? r : r === '-' ? '—' : '?', x, y + 9);
      ctx.font = '600 13px Rubik, system-ui, sans-serif';
    });
  };

  // ---------- Смерть ----------
  UI.showDeath = function (text, cb) {
    const d = $('#death');
    $('#death-text').textContent = text;
    d.hidden = false;
    UI.deathOpen = true;
    J.Input.releasePointer();
    setTimeout(() => {
      d.hidden = true;
      UI.deathOpen = false;
      cb && cb();
    }, 3200);
  };

  // ---------- Панели ----------
  const TABS = [
    ['char', 'Персонаж'],
    ['stand', 'Стенд'],
    ['inv', 'Инвентарь'],
    ['journal', 'Журнал'],
    ['map', 'Карта'],
    ['codex', 'Стендопедия'],
    ['menu', 'Меню'],
  ];
  UI.openPanel = function (tab) {
    UI.panelOpen = tab || 'char';
    J.Input.releasePointer();
    $('#panel').hidden = false;
    const nav = $('#tabs');
    nav.innerHTML = '';
    TABS.forEach(([k, n]) => {
      const b = el('button', 'tab' + (k === UI.panelOpen ? ' on' : ''), n);
      b.onclick = () => UI.openPanel(k);
      nav.appendChild(b);
    });
    UI.renderPanel();
  };
  UI.closePanel = function () {
    UI.panelOpen = null;
    $('#panel').hidden = true;
    UI.mapDrag = null;
  };
  UI.togglePanel = (tab) => (UI.panelOpen === tab ? UI.closePanel() : UI.openPanel(tab));

  UI.renderPanel = function () {
    const body = $('#pbody');
    const tab = UI.panelOpen;
    const p = P();
    body.innerHTML = '';
    body.className = 'tab-' + tab;
    if (tab === 'char') {
      const s = p.stats;
      const origin = J.ORIGINS.find((o) => o.id === p.origin);
      const row = (k) => {
        const need = 20 + s[k] * 15;
        return `<div class="stat"><span>${J.P.STAT_RU[k]}</span><b>${s[k]}</b><div class="bar sm"><i style="width:${(p.statXp[k] / need) * 100}%"></i></div>${p.points ? `<button class="btn sm" data-st="${k}">+</button>` : ''}</div>`;
      };
      body.innerHTML = `
        <div class="cols">
          <div>
            <h2>${esc(p.name)}</h2>
            <p class="muted">${esc(origin ? origin.name : '')} · Уровень ${p.lvl} · опыт ${Math.floor(p.xp)}/${J.P.xpNeed(p.lvl)}</p>
            ${p.points ? `<p class="gold">Свободных очков: ${p.points}</p>` : ''}
            <div class="stats">${['str', 'agi', 'end', 'spi', 'cha', 'int'].map(row).join('')}</div>
            <p class="muted small">Сила — урон кулаков. Ловкость — скорость. Выносливость — здоровье. Дух — энергия стенда и шанс пережить Стрелу. Обаяние — цены и разговоры. Интеллект — работа и учёба.</p>
          </div>
          <div>
            <h3>Состояние</h3>
            <ul class="kv">
              <li><span>Здоровье</span><b>${Math.ceil(p.hp)} / ${p.maxHp}</b></li>
              <li><span>Деньги</span><b>${J.fmtMoney(p.money)}</b></li>
              <li><span>Стенд</span><b>${p.stand ? J.STANDS[p.stand.id].ru + ' (ур. ' + p.stand.lvl + ')' : 'нет'}</b></li>
              <li><span>Хамон</span><b>${p.hamon && !p.vampire ? 'ур. ' + p.hamon.lvl : '—'}</b></li>
              <li><span>Вращение</span><b>${p.spin ? 'ур. ' + p.spin.lvl : '—'}</b></li>
              <li><span>Природа</span><b>${p.ultimate ? 'Совершенная форма жизни' : p.vampire ? 'Вампир' : 'Человек'}</b></li>
              <li><span>Части Трупа</span><b>${p.corpse.length} / 9</b></li>
              <li><span>Репутация Пассионе</span><b>${p.rep.passione}</b></li>
              <li><span>Побед</span><b>${p.kills}</b></li>
              <li><span>Шанс пережить Стрелу</span><b>${Math.round(J.P.arrowChance(p) * 100)}%</b></li>
            </ul>
            ${p.style ? `<h3>Стиль: ${J.Abil.STYLES[p.style].name}</h3><ul class="abl">${J.Abil.STYLES[p.style].slots.map((sl, i) => `<li><b>${i + 1}</b> ${esc(sl.name)} <em>ур. ${sl.lvl}</em><br><span class="muted small">${esc(sl.desc)}</span></li>`).join('')}</ul>` : ''}
          </div>
        </div>`;
      body.querySelectorAll('[data-st]').forEach((b) =>
        (b.onclick = () => {
          if (p.points <= 0) return;
          p.points--;
          p.stats[b.dataset.st]++;
          J.P.recalc(p);
          UI.renderPanel();
        })
      );
    } else if (tab === 'stand') {
      if (!p.stand) {
        body.innerHTML = `<h2>Стенда нет</h2><p>Стенд — воплощение духа. Способы получить его:</p>
        <ul class="ways">
          <li><b>Стрела</b> — пронзает и пробуждает стенд (шанс выжить: ${Math.round(J.P.arrowChance(p) * 100)}%). Её можно найти по слухам, купить на чёрном рынке, получить от Кейчо в Морио или от Польпо в Неаполе.</li>
          <li><b>Стенд-диск</b> — вставь в голову. Выпадают из стенд-юзеров, побеждённых Белой Змеёй, и в тюрьме «Грин Дельфин».</li>
          <li><b>Части Святого Трупа</b> — в пустыне Аризоны. Первая же часть пробуждает стенд.</li>
          <li><b>Дьявольская ладонь</b> — особое место в пустыне Аризоны.</li>
          <li><b>Происхождение</b> — «Прирождённый стенд-юзер» начинает со стендом.</li>
        </ul>`;
        return;
      }
      const sd = J.STANDS[p.stand.id];
      const need = J.P.standNeed(p.stand.lvl);
      body.innerHTML = `<div class="cols">
        <div><h2 style="color:${sd.c1}">${esc(sd.ru)}</h2><p class="en">「${esc(sd.name)}」 · ${esc(sd.type)} · Часть ${sd.part}</p>
          <p>${esc(sd.desc)}</p>
          <p>Уровень стенда: <b>${p.stand.lvl}</b>/10 ${p.stand.lvl < 10 ? `· опыт ${Math.floor(p.stand.xp)}/${need}` : '· максимум'} ${p.stand.awakened ? '<span class="chip gold">Пробуждён</span>' : ''}</p>
          <div class="bar"><i style="width:${p.stand.lvl >= 10 ? 100 : (p.stand.xp / need) * 100}%;background:${sd.c1}"></i></div>
          <h3>Способности</h3>
          <ul class="abl">${sd.abil.map((a, i) => `<li class="${p.stand.lvl < a.lvl ? 'locked' : ''}"><b>${'QER'[i]}</b> ${esc(a.name)} <em>ур. ${a.lvl} · энергия ${a.cost} · откат ${a.cd}с</em></li>`).join('')}</ul>
          ${sd.evo ? `<p class="gold">Эволюция → ${esc(J.STANDS[sd.evo.to].ru)}: ${esc(sd.evo.note || (sd.evo.how === 'level' ? 'уровень ' + sd.evo.lvl : ''))}</p>` : ''}
          <p class="muted small">ЛКМ — удар стенда, ПКМ — тяжёлый удар, G — призвать/убрать.</p>
        </div>
        <div class="center"><canvas id="hex2" width="300" height="300"></canvas></div></div>`;
      UI.drawHex($('#hex2'), sd);
    } else if (tab === 'inv') {
      const items = Object.keys(p.inv).filter((k) => p.inv[k] > 0);
      let h = '<div class="inv">';
      if (!items.length && !p.discs.length && !p.corpse.length) h += '<p class="muted">Инвентарь пуст.</p>';
      for (const k of items) {
        const it = J.ITEMS[k];
        h += `<div class="item ${it.rare ? 'rare' : ''}"><div><b>${esc(it.name)}</b> ×${p.inv[k]}<br><span class="muted small">${esc(it.desc)}</span></div><button class="btn sm" data-use="${k}">${['food', 'blood', 'heal'].includes(it.type) ? 'Съесть' : it.type === 'gear' && k !== 'horse' ? 'Инфо' : 'Использовать'}</button></div>`;
      }
      p.discs.forEach((sid, i) => {
        const sd = J.STANDS[sid];
        h += `<div class="item rare"><div><b>Стенд-диск: ${esc(sd.ru)}</b><br><span class="muted small">${esc(sd.desc)}</span></div><button class="btn sm" data-disc="${i}">Вставить</button></div>`;
      });
      p.corpse.forEach((cid) => {
        const c = J.CORPSE_PARTS.find((x) => x.id === cid);
        h += `<div class="item rare"><div><b>Святой Труп: ${esc(c.name)}</b><br><span class="muted small">${esc(c.desc)}</span></div></div>`;
      });
      h += '</div>';
      body.innerHTML = h;
      body.querySelectorAll('[data-use]').forEach((b) => (b.onclick = () => { J.P.useItem(p, b.dataset.use); if (UI.panelOpen) UI.renderPanel(); }));
      body.querySelectorAll('[data-disc]').forEach((b) => (b.onclick = () => { J.P.useItem(p, 'stand_disc', +b.dataset.disc); }));
    } else if (tab === 'journal') {
      const st = G().story;
      let h = '<div class="cols"><div>';
      if (st.arc) {
        const arc = J.Story.ARCS[st.arc.id];
        h += `<h2>${esc(arc.title)}</h2><p class="muted">${esc(arc.intro)}</p><ol class="stages">`;
        arc.stages.forEach((sg, i) => {
          if (i < st.arc.stage) h += `<li class="done">${esc(sg.text)}</li>`;
          else if (i === st.arc.stage) h += `<li class="cur">${esc(sg.text)}${st.arc.d.left !== undefined && sg.tick ? ` <em>(осталось ${Math.max(0, Math.ceil(st.arc.d.left / 60))} ч)</em>` : ''}</li>`;
        });
        h += '</ol>';
      } else h += `<h2>Обычная жизнь</h2><p class="muted">Следующая глава судьбы начнётся на ${st.nextArcDay}-й день. Пока — работай, тренируйся и исследуй.</p>`;
      h += `<h3>Судьба</h3><p class="small">${st.fate.map((a, i) => (i < st.idx ? `<s>${esc(J.Story.ARCS[a].title)}</s>` : i === st.idx ? `<b>${esc(J.Story.ARCS[a].title)}</b>` : '???')).join(' → ')}</p>`;
      h += '</div><div><h3>Задания</h3>';
      if (!st.side.length) h += '<p class="muted">Нет заданий. Ищи их в барах, полиции и у Фонда Спидвагона.</p>';
      st.side.forEach((q) => (h += `<div class="item"><div><b>${esc(q.title)}</b><br><span class="muted small">${esc(q.desc)}${q.expires ? ` · до ${J.fmtClock(q.expires)} (день ${Math.floor(q.expires / 1440) + 1})` : ''}</span></div><button class="btn sm" data-ab="${q.id}">Бросить</button></div>`));
      h += '<h3>Хроника</h3><ul class="log">' + st.log.map((l) => `<li><em>День ${l.day}</em> ${esc(l.t)}</li>`).join('') + '</ul></div></div>';
      body.innerHTML = h;
      body.querySelectorAll('[data-ab]').forEach((b) => (b.onclick = () => { J.Story.abandonSide(b.dataset.ab); UI.renderPanel(); }));
    } else if (tab === 'map') {
      body.innerHTML = '<canvas id="bigmap"></canvas><p class="muted small center">Колёсико — масштаб, перетаскивание — сдвиг, клик — поставить метку. Вокзалы позволяют быстро путешествовать.</p>';
      UI.initBigMap();
    } else if (tab === 'codex') {
      const list = J.STAND_LIST;
      const owned = Object.keys(p.codex).filter((k) => p.codex[k] === 'owned').length;
      const seen = Object.keys(p.codex).length;
      let h = `<p class="muted">Встречено стендов: ${seen} из ${list.length}. Владел: ${owned}.</p><div class="codex">`;
      for (const sd of list) {
        const st = p.codex[sd.id];
        if (st) h += `<div class="cx ${st}" style="--c1:${sd.c1};--c2:${sd.c2}"><b>${esc(sd.ru)}</b><span>「${esc(sd.name)}」</span><em>Часть ${sd.part} · ${esc(sd.type)}${st === 'owned' ? ' · был твоим' : ''}</em><span class="st">${['pow', 'spd', 'rng', 'dur', 'pre', 'pot'].map((k) => sd.st[k]).join(' ')}</span></div>`;
        else h += '<div class="cx unknown"><b>???</b><span>Неизвестный стенд</span></div>';
      }
      body.innerHTML = h + '</div>';
    } else if (tab === 'menu') {
      const set = J.Game.settings;
      body.innerHTML = `<div class="cols"><div>
        <h2>Меню</h2>
        <div class="col-btns">
          <button class="btn gold" id="m-save">Сохранить игру</button>
          <button class="btn" id="m-load">Загрузить сохранение</button>
          <button class="btn" id="m-help">Как играть</button>
          <button class="btn" id="m-title">Выйти в главное меню</button>
        </div>
        <p class="muted small">Игра сохраняется в этом браузере, а также автоматически при сне. Сохраняться можно где угодно.</p>
      </div><div>
        <h3>Настройки</h3>
        <label class="opt"><span>Качество графики</span><select id="o-q"><option value="2">Высокое</option><option value="1">Среднее</option><option value="0">Низкое (быстрее)</option></select></label>
        <p class="muted small" id="o-qnote">${J.R3.preset.name} качество. Сглаживание меняется после перезапуска игры; при тяжёлых кадрах разрешение понижается само.</p>
        <label class="opt"><span>Тени</span><input type="checkbox" id="o-sh"></label>
        <label class="opt"><span>Чувствительность мыши</span><input type="range" id="o-sens" min="0.3" max="2.5" step="0.1"></label>
        <label class="opt"><span>Звук</span><input type="checkbox" id="o-snd"></label>
        <label class="opt"><span>Инверсия по вертикали</span><input type="checkbox" id="o-inv"></label>
        <label class="opt"><span>Камера сама разворачивается за спину</span><input type="checkbox" id="o-fol"></label>
        <h3>Бой</h3>
        <label class="opt"><span>Тряска камеры</span><select id="o-shk"><option value="1">Сильная</option><option value="0.5">Слабая</option><option value="0">Нет</option></select></label>
        <label class="opt"><span>Вспышки, кадры удара, инверсия</span><input type="checkbox" id="o-fl"></label>
        <label class="opt"><span>Замедление и стоп-кадры</span><input type="checkbox" id="o-sm"></label>
        <label class="opt"><span>Щадящий режим (без вспышек и тряски)</span><input type="checkbox" id="o-rm"></label>
        <label class="opt"><span>Качество эффектов</span><select id="o-fq"><option value="1">Высокое</option><option value="0">Низкое (быстрее)</option></select></label>
      </div></div>`;
      $('#o-q').value = String(set.quality);
      $('#o-sh').checked = set.shadows;
      $('#o-sens').value = set.sens;
      $('#o-snd').checked = set.sound;
      $('#o-inv').checked = !!set.invert;
      $('#o-fol').checked = !!set.follow;
      $('#o-shk').value = String(set.fx_shake === undefined ? 1 : set.fx_shake);
      $('#o-fl').checked = set.fx_flash !== false;
      $('#o-sm').checked = set.fx_slowmo !== false;
      $('#o-rm').checked = !!set.fx_rm;
      $('#o-fq').value = String(set.fx_q === undefined ? (set.quality === 0 ? 0 : 1) : set.fx_q);
      const apply = () => {
        set.quality = +$('#o-q').value;
        set.shadows = $('#o-sh').checked;
        set.sens = +$('#o-sens').value;
        set.sound = $('#o-snd').checked;
        set.invert = $('#o-inv').checked;
        set.follow = $('#o-fol').checked;
        set.fx_shake = +$('#o-shk').value;
        set.fx_flash = $('#o-fl').checked;
        set.fx_slowmo = $('#o-sm').checked;
        set.fx_rm = $('#o-rm').checked;
        set.fx_q = +$('#o-fq').value;
        UI.sound = set.sound;
        J.Game.applySettings();
      };
      ['o-q', 'o-sh', 'o-sens', 'o-snd', 'o-inv', 'o-fol', 'o-shk', 'o-fl', 'o-sm', 'o-rm', 'o-fq'].forEach((id) => ($('#' + id).onchange = apply));
      $('#m-save').onclick = () => J.Game.save(true);
      $('#m-load').onclick = () => J.Game.loadFromStore();
      $('#m-help').onclick = () => UI.showHelp();
      $('#m-title').onclick = () => UI.confirm('Выйти в главное меню?', 'Несохранённый прогресс будет потерян.', () => J.Game.toTitle());
    }
  };

  // Большая карта
  UI.initBigMap = function () {
    const cv = $('#bigmap');
    const box = $('#pbody');
    const W = Math.min(box.clientWidth - 8, 1100), H = Math.max(260, Math.min(window.innerHeight * 0.62, 760));
    cv.width = W * (window.devicePixelRatio || 1);
    cv.height = H * (window.devicePixelRatio || 1);
    cv.style.width = W + 'px';
    cv.style.height = H + 'px';
    const p = P();
    const fit = Math.min(W / J.WORLD_W, H / J.WORLD_H);
    UI.mapV = UI.mapV || { cx: p.x, cy: p.y, z: fit * 2.5 };
    UI.mapV.cx = p.x;
    UI.mapV.cy = p.y;
    const draw = () => UI.drawBigMap(cv, W, H);
    cv.onwheel = (e) => {
      e.preventDefault();
      UI.mapV.z = J.clamp(UI.mapV.z * (e.deltaY < 0 ? 1.2 : 1 / 1.2), fit * 0.9, 12);
      draw();
    };
    let drag = null;
    cv.onpointerdown = (e) => {
      drag = { x: e.clientX, y: e.clientY, cx: UI.mapV.cx, cy: UI.mapV.cy, moved: false };
      cv.setPointerCapture(e.pointerId);
    };
    cv.onpointermove = (e) => {
      if (!drag) return;
      const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
      if (Math.abs(dx) + Math.abs(dy) > 4) drag.moved = true;
      UI.mapV.cx = drag.cx - dx / UI.mapV.z;
      UI.mapV.cy = drag.cy - dy / UI.mapV.z;
      draw();
    };
    cv.onpointerup = (e) => {
      if (drag && !drag.moved) {
        const r = cv.getBoundingClientRect();
        const wx = UI.mapV.cx + (e.clientX - r.left - W / 2) / UI.mapV.z;
        const wy = UI.mapV.cy + (e.clientY - r.top - H / 2) / UI.mapV.z;
        G().waypoint = G().waypoint && J.dist(G().waypoint.x, G().waypoint.y, wx, wy) < 8 / UI.mapV.z * 3 ? null : { x: wx, y: wy };
        draw();
      }
      drag = null;
    };
    const zb = el('div', 'mapzoom', '<button class="btn sm" id="mz-in">+</button><button class="btn sm" id="mz-out">−</button><button class="btn sm" id="mz-me">Я</button>');
    box.prepend(zb);
    $('#mz-in').onclick = () => { UI.mapV.z = Math.min(12, UI.mapV.z * 1.4); draw(); };
    $('#mz-out').onclick = () => { UI.mapV.z = Math.max(fit * 0.9, UI.mapV.z / 1.4); draw(); };
    $('#mz-me').onclick = () => { UI.mapV.cx = p.x; UI.mapV.cy = p.y; draw(); };
    draw();
  };
  UI.drawBigMap = function (cv, W, H) {
    const ctx = cv.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const v = UI.mapV;
    ctx.fillStyle = '#1d4f8a';
    ctx.fillRect(0, 0, W, H);
    ctx.imageSmoothingEnabled = v.z < 2;
    const ox = W / 2 - v.cx * v.z, oy = H / 2 - v.cy * v.z;
    ctx.drawImage(J.Game.mapImg, ox, oy, J.WORLD_W * v.z, J.WORLD_H * v.z);
    const tp = (x, y) => [ox + x * v.z, oy + y * v.z];
    ctx.textAlign = 'center';
    for (const r of J.REGIONS) {
      const [x, y] = tp(r.x, r.y);
      ctx.font = `700 ${r.city ? 14 : 12}px Rubik, sans-serif`;
      ctx.lineWidth = 3;
      ctx.strokeStyle = 'rgba(15,10,24,0.85)';
      ctx.fillStyle = r.city ? '#fff' : '#d9cfea';
      ctx.strokeText(r.name, x, y - (r.city ? r.city * v.z + 6 : 0));
      ctx.fillText(r.name, x, y - (r.city ? r.city * v.z + 6 : 0));
    }
    // вокзалы
    if (v.z > 1.5)
      for (const b of G().world.buildings) {
        if (b.type !== 'station') continue;
        const [x, y] = tp(b.door.x, b.door.y);
        ctx.fillStyle = '#9b6bff';
        ctx.fillRect(x - 3, y - 3, 6, 6);
      }
    const ms = J.Story.markers();
    if (G().waypoint) ms.push({ x: G().waypoint.x, y: G().waypoint.y, label: 'Метка', kind: 'way' });
    for (const m of ms) {
      const [x, y] = tp(m.x, m.y);
      ctx.fillStyle = m.kind === 'main' ? '#f2c230' : m.kind === 'way' ? '#5ac8fa' : '#e2368f';
      ctx.beginPath();
      ctx.moveTo(x, y - 9);
      ctx.lineTo(x + 7, y);
      ctx.lineTo(x, y + 9);
      ctx.lineTo(x - 7, y);
      ctx.fill();
      ctx.strokeStyle = '#000';
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }
    const p = P();
    const [px, py] = tp(p.x, p.y);
    ctx.save();
    ctx.translate(px, py);
    ctx.rotate(p.face);
    ctx.fillStyle = '#fff';
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(10, 0);
    ctx.lineTo(-7, -7);
    ctx.lineTo(-3, 0);
    ctx.lineTo(-7, 7);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  };

  UI.showHelp = function () {
    UI.closePanel();
    UI.say('Как играть', [
      'WASD — движение (относительно камеры). Мышь — камера (кликни по игре, чтобы захватить мышь; Esc — отпустить). Без захвата — тяни правой кнопкой или крути стрелками ←/→. Колёсико — приближение (если в панели есть вещи — листает их, приближение — Shift + колёсико).',
      'ЛКМ — удар (стендом, если он есть): серия из четырёх, последний — апперкот-добивание. X (или ПКМ без захвата мыши) — тяжёлый удар: держи, чтобы зарядить, отпусти — бьёшь; полный заряд подбрасывает врага, а удар об стену наносит дополнительный урон. Пробел — рывок-уклонение (тратит выносливость, на мгновение неуязвим; лёжа — быстрый подъём). Shift — бег. G — призвать стенд. Q / E / R — способности стенда.',
      'Бой. Z или ПКМ (когда мышь захвачена) — блок: держи, он гасит урон спереди, но тратит шкалу блока; опустела — блок пробит и ты оглушён. Нажми блок прямо перед ударом врага — парирование: враг откинут и открыт, следующий твой удар — критический. Враги перед ударом замахиваются и сверкают — читай замах, уклоняйся или парируй, наказывай промахи. Раш (ОРА ОРА!): держи клавишу способности, чтобы продлить. Если два раша сталкиваются лицом к лицу — жми удар или клавишу раша как можно чаще, победитель отбрасывает проигравшего.',
      'Сверхспособности стендов. У каждого стенда свои силы: Красный Маг поджигает и связывает огненными путами, Иерофант раскидывает изумруды и сеть нитей (задел нить — залп), Отшельник хватает лозами, Рука стирает пространство и притягивает, Липкие Пальцы проходят сквозь стены по молнии, Безумный Бриллиант вплавляет врагов в камень (рядом со стеной — прямо в стену) и чинит машины, Звёздная Платина в Финальном ОРА бьёт шквалом и отправляет врага в полёт, Шут гонит песчаную волну, Крем в рывке глотает пули и снаряды, Go Beyond проходит сквозь стены и блок, Золотой Опыт выращивает дерево, чьи корни держат врагов. Сила видна заранее: свет собирается в руке стенда, зона удара подсвечивается — так же и у врагов, уходи из подсветки. Остановка времени: удары по застывшим врагам копятся и обрушиваются разом, когда время пойдёт; Мир в своём остановленном времени по R роняет дорожный каток, а ножи (E) встают кольцом вокруг врага и срываются разом, когда время пойдёт. Королева-убийца: касание — бомба, касание земли — бомба-монетка, повторное нажатие — взрыв.',
      '1 / 2 / 3 — приёмы стиля (хамон, вампиризм, вращение). V — дыхание хамона (восстанавливает дыхание, лечит). T — сменить стиль. H — сесть на лошадь.',
      'Вещи в руках. Внизу — панель из шести ячеек: 4–9 или колёсико мыши — взять вещь в руку (Shift + колёсико — приближение камеры), 0 — убрать в карман, Y — выбросить. ЛКМ с вещью — её действие: нож колет и режет (кровотечение), бита, труба и дорожный знак бьют размашисто и оглушают, револьвер стреляет (шесть патронов в барабане, перезарядка сама из патронов в сумке), еду и питьё — съесть. X (ПКМ) — заряженный удар оружием, а метательное (ножи, камни, подшипники) — бросок. B или средняя кнопка — держи, чтобы прицелиться (видна дуга полёта), отпусти — бросок: ножи втыкаются в стены и врагов, бутылки разбиваются, брошенное можно подобрать (F). Тяжёлое машет медленнее и выматывает, у вещей есть прочность, бутылка о голову становится «розочкой». N — отдать вещь стенду: быстрый и точный стенд (Звёздная Платина, Мир, Серебряная Колесница…) мечет веер ножей, Звёздная Платина щелчком пускает подшипник как пулю, Секс Пистолз пинают пули револьвера, а в остановленном времени ножи замирают перед целью и срываются, когда время пойдёт. Слабые стенды не умеют. Полиция не любит оружие на виду. Вещи лежат у баров, ресторанов, доков и домов, продаются в магазинах и на чёрном рынке, падают с врагов.',
      'Арсенал. Оружейный магазин «Калибр» — в Морио, Неаполе, Лондоне, Нью-Йорке, Каире и городах Америки: пистолеты, пистолеты-пулемёты, автомат, карабин, пулемёт, помповое ружьё, обрез, снайперская винтовка, гранаты, Молотовы, светошумовые и дымовые, нож, мачете, монтировка, клюшка, кастет; патроны — по калибрам. Tab (держать) — колесо оружия: веди мышью к разделу, колёсико — другое оружие раздела, отпусти — взять (короткое нажатие Tab — стенд). ПКМ с оружием — прицел через плечо (у снайперской — оптика), ЛКМ — огонь (автоматы стреляют, пока держишь), R — перезарядка. Разброс растёт на бегу и в длинной очереди; в голову — больше урона; пули пробивают шины. ЛКМ с гранатой — прицел с дугой, отпусти — бросок. Стрельба в городе поднимает розыск: при ★★ — пешие патрули, при ★★★ — спецназ. Банды и охрана прячутся за укрытиями и отстреливаются. Звёздная Платина ловит пули, Мир и другие отбивают, Серебряная Колесница рассекает, Секс Пистолз доворачивают промахи во врагов.',
      'F — говорить с людьми и входить в здания. В зданиях: работа, еда, сон, магазины, вокзалы для быстрых поездок.',
      'Машины: F (или Enter) рядом с машиной — сесть в припаркованную или вытащить водителя и угнать. За рулём: W/S — газ и тормоз (задний ход), A/D — руль, Пробел — ручник (занос), H — сигнал, F — выйти. Удары о стены и машины портят кузов, разбитая машина горит и взрывается. Сбитые прохожие и угоны привлекают полицию (звёзды розыска) — оторвись или пережди. На телефоне: джойстик — газ и руль, кнопки «Ручник» и «Сигнал».',
      'I — инвентарь, P — персонаж и стенд, L — журнал, M — карта, K — Стендопедия, Esc — меню и сохранение.',
      'Следи за сытостью и бодростью: ешь и спи. Вампиры горят на солнце — днём прячься в зданиях. Хамон 2+ уровня позволяет ходить по воде.',
      'Сюжет случаен: судьба выбирает главы. Между ними живи обычной жизнью: работай, учись, бери задания в барах и полиции, ищи Стрелы и маски по слухам.',
    ]);
  };

  // ---------- Здания ----------
  UI.openBuilding = function (b) {
    if (J.Story.onBuilding(b)) return;
    if (J.Story.sideBuilding(b)) return;
    UI.bOpen = b;
    J.Input.releasePointer();
    $('#bpanel').hidden = false;
    UI.renderBuilding();
  };
  UI.closeBuilding = function () {
    UI.bOpen = null;
    $('#bpanel').hidden = true;
  };
  UI.discount = (p) => 1 - Math.min(0.2, p.stats.cha * 0.02);

  UI.renderBuilding = function () {
    const b = UI.bOpen;
    if (!b) return;
    const p = P();
    const bt = J.BTYPES[b.type];
    const g = G();
    const box = $('#bbody');
    const opts = [];
    const add = (label, sub, fn, dis) => opts.push({ label, sub, fn, dis });
    const rg = J.REGION[b.region];
    const priceMul = UI.discount(p);
    const buy = (id, eat) => {
      const it = J.ITEMS[id];
      const pr = Math.ceil(it.price * priceMul);
      add(`${eat ? 'Поесть' : 'Купить'}: ${it.name}`, J.fmtMoney(pr), () => {
        if (p.money < pr) return UI.toast('Не хватает денег.', 'red');
        if (eat && p.vampire && !p.ultimate) return UI.toast('Вампир не может есть обычную еду.', 'red');
        J.P.addMoney(p, -pr);
        if (eat) {
          J.P.addItem(p, id, 1, null, true);
          J.P.useItem(p, id);
          J.Game.passTime(20);
        } else J.P.addItem(p, id, 1);
        UI.renderBuilding();
      });
    };
    const job = bt.job;
    const t = b.type;
    let desc = '';
    switch (t) {
      case 'home':
        desc = 'Твой дом. Здесь можно отдохнуть и сохраниться.';
        add('Спать до утра', 'Бодрость и здоровье восстановятся. Сохранение.', () => J.Game.sleep(false));
        add('Вздремнуть 2 часа', '+25 бодрости', () => { J.Game.passTime(120); p.energy = Math.min(100, p.energy + 25); UI.renderBuilding(); });
        if (p.vampire) add('Переждать до ночи', 'Безопасно от солнца', () => J.Game.waitUntil(20 * 60));
        add('Сохранить игру', '', () => J.Game.save(true));
        break;
      case 'hotel': {
        const price = Math.round((rg.danger + 2) * 12 * priceMul);
        desc = 'Отель. Номер на ночь — и ты как новенький.';
        add('Снять номер и спать', J.fmtMoney(price), () => {
          if (p.money < price) return UI.toast('Не хватает денег.', 'red');
          J.P.addMoney(p, -price);
          J.Game.sleep(false);
        });
        if (p.vampire) add('Снять номер до ночи', J.fmtMoney(price), () => { if (p.money < price) return UI.toast('Не хватает денег.', 'red'); J.P.addMoney(p, -price); J.Game.waitUntil(20 * 60); });
        add('Сохранить игру', '', () => J.Game.save(true));
        break;
      }
      case 'shop':
      case 'kame_yu':
        desc = 'Еда, напитки и мелочи.';
        J.SHOPS.shop.forEach((id) => buy(id));
        break;
      case 'restaurant':
        desc = `Местная кухня: ${rg.name}.`;
        (J.REGION_FOOD[b.region] || J.SHOPS.restaurant).forEach((id) => buy(id, true));
        break;
      case 'trussardi':
        desc = 'Тонио Труссарди готовит блюда, которые лечат тело. Буонджорно!';
        add('Ужин Труссарди', J.fmtMoney(80) + ' · полное исцеление', () => {
          if (p.money < 80) return UI.toast('Не хватает денег.', 'red');
          if (p.vampire && !p.ultimate) return UI.toast('Тонио: «Вам... не подходит моя еда».', 'red');
          J.P.addMoney(p, -80);
          J.P.addItem(p, 'trussardi_meal', 1, null, true);
          J.P.useItem(p, 'trussardi_meal');
          J.Game.passTime(60);
          UI.renderBuilding();
        });
        buy('pizza', true);
        buy('wine', true);
        break;
      case 'hospital': {
        const miss = p.maxHp - p.hp;
        const cost = Math.ceil(miss * 0.6 * priceMul);
        desc = 'Больница. Врачи вылечат раны.';
        add('Лечение', miss > 1 ? J.fmtMoney(cost) : 'ты здоров', () => {
          if (miss <= 1) return;
          if (p.money < cost) return UI.toast('Не хватает денег.', 'red');
          J.P.addMoney(p, -cost);
          p.hp = p.maxHp;
          for (const k of ['poison', 'burn', 'bleed', 'age', 'infinite']) p.st[k] = 0;
          J.Game.passTime(60);
          UI.toast('Ты здоров.', 'green');
          UI.renderBuilding();
        }, miss <= 1);
        J.SHOPS.hospital.forEach((id) => buy(id));
        break;
      }
      case 'gym':
        desc = 'Спортзал. 2 часа тренировки, $15.';
        for (const [st, n] of [['str', 'Сила'], ['end', 'Выносливость'], ['agi', 'Ловкость']])
          add(`Тренировать: ${n}`, '2 ч · $15 · -20 бодрости', () => {
            if (p.money < 15) return UI.toast('Не хватает денег.', 'red');
            if (p.energy < 20) return UI.toast('Слишком устал.', 'red');
            J.P.addMoney(p, -15);
            p.energy -= 20;
            J.Game.passTime(120);
            J.P.trainStat(p, st, 14);
            UI.renderBuilding();
          });
        (J.SHOPS.gym || []).forEach((id) => buy(id));
        break;
      case 'library':
      case 'school':
        desc = t === 'school' ? 'Школа. Учёба развивает интеллект.' : 'Библиотека. Тишина и знания.';
        add('Учиться 3 часа', 'Интеллект +', () => {
          if (p.energy < 15) return UI.toast('Слишком устал.', 'red');
          p.energy -= 15;
          J.Game.passTime(180);
          J.P.trainStat(p, 'int', p.origin === 'student' ? 16 : 11);
          if (Math.random() < 0.3) J.P.trainStat(p, 'spi', 5);
          UI.renderBuilding();
        });
        add('Читать о стендах', 'Дух +', () => { J.Game.passTime(60); J.P.trainStat(p, 'spi', 6); UI.toast('«Стенд — это проявление жизненной энергии»', 'muted'); });
        break;
      case 'station':
        desc = b.region === 'airsupplena' ? 'Пристань. Лодка до материка.' : 'Вокзал: поезда, автобусы, корабли и самолёты. Быстрое путешествие между городами.';
        UI.travelOptions(b).forEach((o) => opts.push(o));
        break;
      case 'bar':
        desc = 'Бар. Слухи, выпивка и доска заданий.';
        add('Выпить', '$8 · +бодрость, +обаяние', () => {
          if (p.money < 8) return UI.toast('Не хватает денег.', 'red');
          J.P.addMoney(p, -8);
          p.energy = Math.min(100, p.energy + 8);
          J.Game.passTime(30);
          J.P.trainStat(p, 'cha', 3);
          UI.toast('Бармен: «' + J.Story.rumorLine() + '»', 'muted');
        });
        (J.SHOPS.bar || []).forEach((id) => buy(id));
        add('Доска заданий: доставка', '', () => J.Story.offerSide('delivery', b));
        add('Доска заданий: потерявшийся кот', '', () => J.Story.offerSide('cat', b));
        add('Доска заданий: громилы', '', () => J.Story.offerSide('thugs', b));
        add('Купить слух о сокровище', '$120', () => { if (p.money < 120) return UI.toast('Не хватает денег.', 'red'); J.P.addMoney(p, -120); J.Story.rumorTreasure(); });
        break;
      case 'police':
        desc = 'Полиция. Награды за опасных преступников.';
        add('Охота за головой', 'стенд-юзер за городом', () => J.Story.offerSide('bounty', b));
        add('Защита магазина', '', () => J.Story.offerSide('thugs', b));
        break;
      case 'speedwagon':
        desc = 'Фонд Спидвагона. Агент снаружи у дверей.';
        J.Story.speedwagon({ name: 'Агент Фонда Спидвагона' });
        return;
      case 'black_market':
        desc = 'Чёрный рынок. Здесь продают то, чего не должно существовать.';
        J.SHOPS.black_market.forEach((id) => buy(id));
        break;
      case 'church':
        desc = 'Церковь. Тишина и покой.';
        add('Помолиться (1 ч)', '+15 бодрости, Дух +', () => { J.Game.passTime(60); p.energy = Math.min(100, p.energy + 15); J.P.trainStat(p, 'spi', 4); UI.toast('Ты чувствуешь покой.', 'muted'); });
        if (p.vampire) add('Переждать до ночи', '', () => J.Game.waitUntil(20 * 60));
        break;
      case 'casino':
        desc = 'Казино. Здесь играет Дэниел Д\'Арби. Ставки — деньги... или души.';
        for (const bet of [50, 250, 1000])
          add(`Ставка ${J.fmtMoney(bet)}`, 'шанс ×2 — 46%', () => {
            if (p.money < bet) return UI.toast('Не хватает денег.', 'red');
            J.Game.passTime(15);
            if (Math.random() < 0.46) { J.P.addMoney(p, bet); UI.toast('Выигрыш! +' + J.fmtMoney(bet), 'green'); }
            else { J.P.addMoney(p, -bet); UI.toast('Проигрыш. Д\'Арби улыбается.', 'red'); }
          });
        break;
      case 'stable':
        desc = 'Конюшня.';
        J.SHOPS.stable.forEach((id) => buy(id));
        break;
      case 'passione':
        desc = 'Штаб Пассионе. Здесь не задают лишних вопросов.';
        if (p.rep.passione < 1 && p.origin !== 'gangster') desc += ' Тебя пока не знают.';
        break;
      case 'polpo_prison':
        desc = 'Тюрьма Неаполя. В одной из камер сидит огромный Польпо.';
        add('Навестить Польпо', '', () => UI.say('Польпо', ['Хе-хе... Ты ещё не готов. Приходи, когда тебя пришлёт Буччеллати.']));
        break;
      case 'colosseum':
        desc = 'Колизей. По ночам здесь бьются за деньги.';
        add('Бой на арене', 'три противника', () => { UI.closeBuilding(); J.Story.offerSide('arena', b); });
        break;
      case 'hamon_temple':
        desc = 'Храм хамона высоко в горах.';
        add('Поговорить с мастером Тонпетти', '', () => { UI.closeBuilding(); J.Story.hamonMaster({ name: 'Мастер Тонпетти' }, 7, 2, 'Дыши. Дыши как ветер в горах.'); });
        break;
      case 'lisa_castle':
        desc = 'Замок на острове Эйр-Сапплена. Школа хамона Лизы Лизы.';
        add('Тренировка у Лизы Лизы', '', () => { UI.closeBuilding(); J.Story.hamonMaster({ name: 'Лиза Лиза' }, 10, 4, 'Ты пришёл учиться? Здесь будет больно.'); });
        add('Отдохнуть в замке', 'бесплатно', () => J.Game.sleep(false));
        break;
      case 'zeppeli_house':
        desc = 'Дом барона Цеппели.';
        add('Тренировка у барона', '', () => { UI.closeBuilding(); J.Story.hamonMaster({ name: 'Барон Уилл Цеппели' }, 4, 0, 'Хамон — дыхание солнца!'); });
        break;
      case 'joestar_mansion':
        desc = 'Поместье Джостаров. Старинный дом с долгой историей.';
        if (p.origin === 'joestar' && !p.flags.heirloom)
          add('Открыть фамильный сундук', '', () => {
            p.flags.heirloom = true;
            J.P.addItem(p, 'clackers', 1);
            J.P.addItem(p, 'luck_charm', 1);
            J.P.addMoney(p, 1500);
            UI.toast('Наследство Джостаров: клакеры, амулет и $1500.', 'gold');
            UI.renderBuilding();
          });
        add('Осмотреть картины', '', () => UI.say('Поместье', ['Портрет Джонатана Джостара. Рядом — пустая рамка с надписью «Дио Брандо».']));
        if (p.origin === 'joestar' || p.origin === 'brando') add('Спать', '', () => J.Game.sleep(false));
        break;
      case 'dio_mansion':
        desc = 'Особняк ДИО. Окна заколочены. Изнутри веет холодом.';
        add('Постучать', '', () => UI.say('Тишина', ['Никто не открывает. Но тебе кажется, что за тобой следят тысячи глаз.']));
        break;
      case 'green_dolphin':
        desc = 'Тюрьма строгого режима «Грин Дельфин».';
        if (p.origin === 'prisoner') add('Работать в прачечной', '$6/ч', () => UI.work(b, 4));
        add('Обыскать двор', '1 ч', () => {
          J.Game.passTime(60);
          if (!p.flags.gdDisc && Math.random() < 0.25) {
            p.flags.gdDisc = true;
            J.P.addItem(p, 'stand_disc', 1);
          } else UI.toast('Ничего интересного.', 'muted');
        });
        break;
      case 'sbr_office':
        desc = 'Штаб гонки Steel Ball Run.';
        add('Поговорить с Джайро', '', () => { UI.closeBuilding(); J.Story.spinMaster({ name: 'Джайро Цеппели' }); });
        break;
      case 'pillar_ruins':
        desc = 'Древние руины. На стенах — люди, поглощающие людей.';
        add('Исследовать руины (2 ч)', '', () => {
          J.Game.passTime(120);
          if (!p.flags.ruinMask && Math.random() < 0.35) {
            p.flags.ruinMask = true;
            J.P.addItem(p, 'stone_mask', 1);
          } else UI.toast('Ты нашёл лишь древние рисунки.', 'muted');
        });
        break;
      case 'cape':
        desc = 'Мыс Канаверал. Отсюда запускают ракеты к небесам.';
        break;
      case 'rohan':
        desc = 'Дом мангаки Кисибэ Рохана.';
        break;
      default:
        desc = '';
    }
    if (job) {
      const ok = !job.req || Object.keys(job.req).every((k) => p.stats[k] >= job.req[k]);
      const pay = job.pay ? `${J.fmtMoney(job.pay * (1 + p.stats[job.stat] * 0.06))}/ч` : 'без оплаты';
      for (const h of [2, 4, 8]) add(`${job.study ? 'Учиться' : 'Работать'}: ${job.title}, ${h} ч`, ok ? pay : 'нужно: ' + Object.keys(job.req).map((k) => J.P.STAT_RU[k] + ' ' + job.req[k]).join(', '), () => UI.work(b, h), !ok);
    }
    if (!['home', 'hotel', 'church'].includes(t) && p.vampire && g.isSunny) add('Переждать до заката', 'укрытие от солнца', () => J.Game.waitUntil(19 * 60 + 30));
    add('Подождать 1 час', '', () => { J.Game.passTime(60); UI.renderBuilding(); });
    const sell = Object.keys(p.inv).filter((k) => J.ITEMS[k].price > 0 && ['shop', 'black_market', 'kame_yu'].includes(t));
    let h = `<h2>${esc(b.name)}</h2><p class="muted">${esc(rg.name)} · ${J.fmtClock(g.time)} · ${J.fmtMoney(p.money)}</p>${desc ? `<p>${esc(desc)}</p>` : ''}<div class="opts">`;
    opts.forEach((o, i) => (h += `<button class="opt-b" data-i="${i}" ${o.dis ? 'disabled' : ''}><span>${esc(o.label)}</span><em>${esc(o.sub || '')}</em></button>`));
    h += '</div>';
    if (sell.length) {
      h += '<h3>Продать</h3><div class="opts">';
      sell.forEach((k) => (h += `<button class="opt-b" data-sell="${k}"><span>${esc(J.ITEMS[k].name)} ×${p.inv[k]}</span><em>${J.fmtMoney(Math.floor(J.ITEMS[k].price * 0.4))}</em></button>`));
      h += '</div>';
    }
    box.innerHTML = h;
    box.querySelectorAll('[data-i]').forEach((bt) => (bt.onclick = () => opts[+bt.dataset.i].fn()));
    box.querySelectorAll('[data-sell]').forEach((bt) =>
      (bt.onclick = () => {
        const k = bt.dataset.sell;
        J.P.removeItem(p, k);
        J.P.addMoney(p, Math.floor(J.ITEMS[k].price * 0.4));
        UI.renderBuilding();
      })
    );
  };

  UI.travelOptions = function (b) {
    const p = P();
    const out = [];
    const from = J.REGION[b.region];
    const dests = J.REGIONS.filter((r) => r.id !== b.region && r.buildings && r.buildings.some((id) => G().world.buildings[id].type === 'station'));
    for (const r of dests) {
      if (r.id === 'airsupplena' && !['venice', 'naples'].includes(b.region)) continue;
      if (b.region === 'airsupplena' && !['venice', 'naples'].includes(r.id)) continue;
      const d = J.dist(from.x, from.y, r.x, r.y);
      const sea = (from.x < 345) !== (r.x < 345) || (from.x > 900) !== (r.x > 900) || r.id === 'airsupplena' || b.region === 'airsupplena';
      const price = Math.round((20 + d * (sea ? 1.4 : 0.7)) * UI.discount(p));
      const hours = Math.max(1, Math.round(d / (sea ? 60 : 45)));
      out.push({
        label: `${sea ? 'Корабль/самолёт' : 'Поезд'} → ${r.name}`,
        sub: `${J.fmtMoney(price)} · ${hours} ч`,
        fn: () => {
          if (p.money < price) return UI.toast('Не хватает денег.', 'red');
          J.P.addMoney(p, -price);
          UI.closeBuilding();
          J.Game.travelTo(r.id, hours * 60);
        },
      });
    }
    return out;
  };

  UI.work = function (b, hours) {
    const p = P();
    const job = J.BTYPES[b.type].job;
    if (p.energy < hours * 7) return UI.toast('Ты слишком устал для такой смены. Поспи.', 'red');
    if (p.vampire && !p.ultimate && G().isSunny && hours > 0) {
      // внутри здания безопасно
    }
    const pay = Math.round(job.pay * hours * (1 + p.stats[job.stat] * 0.06) * (job.gang && p.origin === 'gangster' ? 1.3 : 1));
    p.energy -= hours * 7;
    J.Game.passTime(hours * 60);
    J.P.addMoney(p, pay);
    J.P.trainStat(p, job.stat, hours * 2.5);
    let msg = job.study ? `Учёба: ${hours} ч.` : `Смена окончена: +${J.fmtMoney(pay)}.`;
    if (job.dig) {
      const mul = p.origin === 'archaeologist' ? 3 : 1;
      const r = Math.random();
      if (r < 0.006 * hours * mul) {
        J.P.addItem(p, b.region === 'cairo' ? 'arrow' : 'stone_mask', 1);
        msg += ' ТЫ НАШЁЛ ДРЕВНИЙ АРТЕФАКТ!';
      } else if (r < 0.06 * hours) {
        J.P.addMoney(p, 60);
        msg += ' Нашёл старинную монету (+$60).';
      }
    }
    if (job.rohan && Math.random() < 0.3) {
      J.P.trainStat(p, 'int', 10);
      msg += ' Рохан «прочёл» тебя. Странное чувство...';
    }
    if (job.gang) {
      p.rep.passione += 1;
      if (Math.random() < 0.35) {
        UI.closeBuilding();
        UI.toast(msg, 'green');
        UI.toast('На обратном пути — засада конкурентов!', 'red');
        J.Story.spawnGroup('gangster', 2, p.x, p.y, 7);
        return;
      }
    }
    if (Math.random() < 0.06 && p.stand) {
      UI.closeBuilding();
      UI.toast(msg, 'green');
      J.Story.ambushStandUser('Коллега-стенд-юзер');
      return;
    }
    UI.toast(msg, 'green');
    UI.renderBuilding();
  };

  // ---------- Мини-игры ----------
  UI.minigame = function (kind, opts, done) {
    const m = $('#mini');
    UI.mgOpen = { kind, done, round: 0, score: 0, t: 0, rounds: 5, zone: 0, speed: 1, last: performance.now() };
    J.Input.releasePointer();
    $('#mg-title').textContent = opts.title;
    $('#mg-text').textContent = kind === 'breath' ? `${opts.master || 'Мастер'}: «Дыши! Нажимай Пробел (или касайся), когда метка в золотой зоне.»` : 'Останови вращение шара в золотом сечении — Пробел или касание.';
    $('#mg-help').textContent = 'Раундов: 5. Чем больше попаданий — тем больше опыта.';
    m.hidden = false;
    UI.newMgRound();
    const cv = $('#mgc');
    cv.onpointerdown = () => UI.mgHit();
    const loop = () => {
      if (!UI.mgOpen) return;
      UI.drawMg();
      requestAnimationFrame(loop);
    };
    loop();
  };
  UI.newMgRound = function () {
    const mg = UI.mgOpen;
    mg.zone = 0.2 + Math.random() * 0.6;
    mg.w = 0.16 - mg.round * 0.015;
    mg.speed = 0.7 + mg.round * 0.22 + Math.random() * 0.2;
    mg.pos = 0;
    mg.dir = 1;
    mg.t0 = performance.now();
    $('#mg-score').textContent = `Раунд ${mg.round + 1}/5 · попаданий: ${mg.score}`;
  };
  UI.mgHit = function () {
    const mg = UI.mgOpen;
    if (!mg || mg.lock) return;
    const hit = Math.abs(mg.pos - mg.zone) < mg.w / 2;
    if (hit) mg.score++;
    mg.flash = hit ? 'hit' : 'miss';
    mg.lock = true;
    UI.sfx(hit ? 'coin' : 'hit');
    setTimeout(() => {
      if (!UI.mgOpen) return;
      mg.lock = false;
      mg.flash = null;
      mg.round++;
      if (mg.round >= mg.rounds) {
        const sc = mg.score;
        const d = mg.done;
        UI.mgOpen = null;
        $('#mini').hidden = true;
        UI.toast(`Результат: ${sc}/5`, sc >= 3 ? 'gold' : 'muted');
        d && d(sc);
      } else UI.newMgRound();
    }, 450);
  };
  UI.drawMg = function () {
    const mg = UI.mgOpen;
    const cv = $('#mgc');
    const ctx = cv.getContext('2d');
    const W = cv.width, H = cv.height;
    const now = performance.now();
    const dt = (now - mg.last) / 1000;
    mg.last = now;
    if (!mg.lock) {
      mg.pos += mg.dir * mg.speed * dt;
      if (mg.pos > 1) { mg.pos = 1; mg.dir = -1; }
      if (mg.pos < 0) { mg.pos = 0; mg.dir = 1; }
    }
    ctx.clearRect(0, 0, W, H);
    if (mg.kind === 'breath') {
      ctx.fillStyle = '#251a36';
      ctx.fillRect(20, H / 2 - 20, W - 40, 40);
      ctx.fillStyle = 'rgba(242,194,48,0.85)';
      ctx.fillRect(20 + (mg.zone - mg.w / 2) * (W - 40), H / 2 - 20, mg.w * (W - 40), 40);
      const x = 20 + mg.pos * (W - 40);
      ctx.fillStyle = mg.flash === 'hit' ? '#7ed957' : mg.flash === 'miss' ? '#e8445a' : '#fff';
      ctx.fillRect(x - 3, H / 2 - 32, 6, 64);
      // волна дыхания
      ctx.strokeStyle = 'rgba(255,216,74,0.5)';
      ctx.beginPath();
      for (let i = 0; i <= 60; i++) {
        const xx = 20 + (i / 60) * (W - 40);
        const yy = H / 2 + 46 + Math.sin(i * 0.4 + now / 200) * 6;
        i ? ctx.lineTo(xx, yy) : ctx.moveTo(xx, yy);
      }
      ctx.stroke();
    } else {
      const cx = W / 2, cy = H / 2, R = 54;
      ctx.strokeStyle = '#4a3566';
      ctx.lineWidth = 12;
      ctx.beginPath();
      ctx.arc(cx, cy, R, 0, J.TAU);
      ctx.stroke();
      ctx.strokeStyle = 'rgba(242,194,48,0.9)';
      ctx.beginPath();
      ctx.arc(cx, cy, R, (mg.zone - mg.w / 2) * J.TAU, (mg.zone + mg.w / 2) * J.TAU);
      ctx.stroke();
      const a = mg.pos * J.TAU;
      ctx.fillStyle = mg.flash === 'hit' ? '#7ed957' : mg.flash === 'miss' ? '#e8445a' : '#c9ccd6';
      ctx.beginPath();
      ctx.arc(cx + Math.cos(a) * R, cy + Math.sin(a) * R, 11, 0, J.TAU);
      ctx.fill();
      // спираль золотого сечения
      ctx.strokeStyle = 'rgba(242,194,48,0.35)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      for (let i = 0; i < 200; i++) {
        const t = i / 30;
        const r = 2 * Math.pow(1.618, t / 1.6);
        if (r > R - 14) break;
        const x = cx + Math.cos(t + now / 400) * r, y = cy + Math.sin(t + now / 400) * r;
        i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
      }
      ctx.stroke();
    }
  };

  // ---------- Титульный экран и создание персонажа ----------
  UI.showTitle = function () {
    UI.inMenu = true;
    const t = $('#title');
    t.hidden = false;
    $('#creator').hidden = true;
    const has = !!J.store.get(J.Game.SAVE_KEY);
    $('#t-continue').hidden = !has;
  };
  UI.hideTitle = function () {
    $('#title').hidden = true;
    $('#creator').hidden = true;
    UI.inMenu = false;
  };

  UI.creator = {
    name: 'Джоджо',
    look: { gender: 'm', skin: J.SKINS[1], hair: 'pompadour', hairColor: J.HAIR_COLORS[0], top: J.OUTFIT_COLORS[0], bottom: J.OUTFIT_COLORS[0] },
    origin: 'student',
    stats: { str: 1, agi: 1, end: 1, spi: 1, cha: 1, int: 1 },
    pts: 6,
  };
  UI.showCreator = function () {
    $('#title').hidden = true;
    const c = $('#creator');
    c.hidden = false;
    UI.renderCreator();
    UI.initPreview();
  };
  UI.renderCreator = function () {
    const C = UI.creator;
    const box = $('#cr-form');
    const swatches = (arr, key) => arr.map((c) => `<button class="sw ${C.look[key] === c ? 'on' : ''}" style="background:${c}" data-k="${key}" data-v="${c}" aria-label="${c}"></button>`).join('');
    const og = J.ORIGINS.find((o) => o.id === C.origin);
    box.innerHTML = `
      <label class="field"><span>Имя</span><input id="cr-name" maxlength="20" value="${esc(C.name)}"></label>
      <div class="field"><span>Пол</span><div class="seg"><button data-g="m" class="${C.look.gender === 'm' ? 'on' : ''}">Мужской</button><button data-g="f" class="${C.look.gender === 'f' ? 'on' : ''}">Женский</button></div></div>
      <div class="field"><span>Причёска</span><div class="seg wrap">${J.HAIR_STYLES.map((h) => `<button data-h="${h.id}" class="${C.look.hair === h.id ? 'on' : ''}">${h.name}</button>`).join('')}</div></div>
      <div class="field"><span>Кожа</span><div class="sws">${swatches(J.SKINS, 'skin')}</div></div>
      <div class="field"><span>Волосы</span><div class="sws">${swatches(J.HAIR_COLORS, 'hairColor')}</div></div>
      <div class="field"><span>Верх</span><div class="sws">${swatches(J.OUTFIT_COLORS, 'top')}</div></div>
      <div class="field"><span>Низ</span><div class="sws">${swatches(J.OUTFIT_COLORS, 'bottom')}</div></div>
      <div class="field"><span>Происхождение</span><div class="origins">${J.ORIGINS.map((o) => `<button class="orig ${C.origin === o.id ? 'on' : ''}" data-o="${o.id}"><b>${esc(o.name)}</b><em>${esc(o.region ? J.REGION[o.region].name : 'случайный город')}</em></button>`).join('')}</div>
        <p class="odesc">${esc(og.desc)} <b>${esc(og.perk)}</b></p></div>
      <div class="field"><span>Характеристики · осталось ${C.pts}</span><div class="crstats">${['str', 'agi', 'end', 'spi', 'cha', 'int'].map((k) => `<div class="crs"><span>${J.P.STAT_RU[k]}</span><button data-s="${k}" data-d="-1">−</button><b>${C.stats[k] + (og.stats[k] || 0)}</b><button data-s="${k}" data-d="1">+</button></div>`).join('')}</div></div>
    `;
    $('#cr-name').oninput = (e) => (C.name = e.target.value);
    box.querySelectorAll('[data-g]').forEach((b) => (b.onclick = () => { C.look.gender = b.dataset.g; if (b.dataset.g === 'f' && C.look.hair === 'pompadour') C.look.hair = 'buns'; UI.renderCreator(); UI.refreshPreview(); }));
    box.querySelectorAll('[data-h]').forEach((b) => (b.onclick = () => { C.look.hair = b.dataset.h; UI.renderCreator(); UI.refreshPreview(); }));
    box.querySelectorAll('.sw').forEach((b) => (b.onclick = () => { C.look[b.dataset.k] = b.dataset.v; UI.renderCreator(); UI.refreshPreview(); }));
    box.querySelectorAll('[data-o]').forEach((b) => (b.onclick = () => { C.origin = b.dataset.o; UI.renderCreator(); }));
    box.querySelectorAll('[data-s]').forEach((b) =>
      (b.onclick = () => {
        const k = b.dataset.s, d = +b.dataset.d;
        if (d > 0 && C.pts > 0 && C.stats[k] < 5) { C.stats[k]++; C.pts--; }
        if (d < 0 && C.stats[k] > 1) { C.stats[k]--; C.pts++; }
        UI.renderCreator();
      })
    );
  };
  UI.randomizeCreator = function () {
    const C = UI.creator;
    const R = J.R;
    C.look.gender = R() < 0.5 ? 'm' : 'f';
    C.look.hair = R.pick(J.HAIR_STYLES).id;
    C.look.skin = R.pick(J.SKINS);
    C.look.hairColor = R.pick(J.HAIR_COLORS);
    C.look.top = R.pick(J.OUTFIT_COLORS);
    C.look.bottom = R.pick(J.OUTFIT_COLORS);
    C.origin = R.pick(J.ORIGINS).id;
    C.name = R.pick(['Джоджо', 'Джорно', 'Джолин', 'Джонни', 'Джотаро', 'Джозеф', 'Ясуо', 'Коити', 'Наранча', 'Тамаки', 'Хана', 'Рика']);
    C.stats = { str: 1, agi: 1, end: 1, spi: 1, cha: 1, int: 1 };
    C.pts = 6;
    for (let i = 0; i < 6; i++) {
      const k = R.pick(['str', 'agi', 'end', 'spi', 'cha', 'int']);
      if (C.stats[k] < 5) { C.stats[k]++; C.pts--; }
    }
    UI.renderCreator();
    UI.refreshPreview();
  };
  UI.initPreview = function () {
    const cv = $('#cr-preview');
    if (!UI.pv) {
      const r = new THREE.WebGLRenderer({ canvas: cv, antialias: true, alpha: true });
      r.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
      r.outputEncoding = THREE.sRGBEncoding; // цвета линейные, как в основном рендере
      r.toneMapping = THREE.ACESFilmicToneMapping;
      const sc = new THREE.Scene();
      const cam = new THREE.PerspectiveCamera(30, 1, 0.1, 50);
      cam.position.set(0, 1.35, 6);
      cam.lookAt(0, 1.12, 0);
      sc.add(new THREE.HemisphereLight('#ffffff', '#6a4a8a', 1.1));
      const dl = new THREE.DirectionalLight('#fff2d8', 1.6);
      dl.position.set(2, 4, 3);
      sc.add(dl);
      const base = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 1, 0.12, 32), new THREE.MeshLambertMaterial({ color: '#2a1f3a' }));
      base.position.y = -0.06;
      sc.add(base);
      UI.pv = { r, sc, cam, model: null };
      const loop = () => {
        if ($('#creator').hidden) return (UI.pv.running = false);
        const w = cv.clientWidth, h = cv.clientHeight;
        if (cv.width !== Math.floor(w * r.getPixelRatio())) {
          r.setSize(w, h, false);
          cam.aspect = w / h;
          cam.updateProjectionMatrix();
        }
        if (UI.pv.model) UI.pv.model.group.rotation.y += 0.012;
        r.render(sc, cam);
        requestAnimationFrame(loop);
      };
      UI.pv.loop = loop;
    }
    UI.refreshPreview();
    if (!UI.pv.running) {
      UI.pv.running = true;
      UI.pv.loop();
    }
  };
  UI.refreshPreview = function () {
    const pv = UI.pv;
    if (!pv) return;
    if (pv.model) {
      pv.sc.remove(pv.model.group);
      pv.model.mats.forEach((m) => m.dispose());
    }
    const m = (pv.model = J.R3.buildHuman(Object.assign({}, UI.creator.look), 1.25));
    // поза ДжоДжо
    m.armR.rotation.x = -2.7;
    m.foreR.rotation.x = -1.5;
    m.armL.rotation.z = -0.6;
    m.foreL.rotation.x = -1.2;
    m.body.rotation.y = 0.45;
    m.body.rotation.z = 0.1;
    m.legL.rotation.x = -0.25;
    m.legR.rotation.x = 0.35;
    m.shinR.rotation.x = 0.55;
    m.legR.rotation.z = 0.08;
    pv.sc.add(m.group);
  };
  UI.finishCreator = function () {
    const C = UI.creator;
    const og = J.ORIGINS.find((o) => o.id === C.origin);
    if (!C.name.trim()) C.name = 'Джоджо';
    const stats = Object.assign({}, C.stats);
    for (const k in og.stats) stats[k] += og.stats[k];
    stats.str += 0;
    J.Game.newGame({ name: C.name.trim().slice(0, 20), look: Object.assign({}, C.look), origin: C.origin, stats, extraPts: C.pts });
  };

  // ---------- Сенсорное управление ----------
  UI.initTouch = function () {
    const t = $('#touch');
    t.hidden = false;
    document.body.classList.add('is-touch');
    const joy = $('#joy'), knob = $('#joyk');
    let jid = null, jc = null;
    const inp = J.Input;
    joy.addEventListener('touchstart', (e) => {
      const tt = e.changedTouches[0];
      jid = tt.identifier;
      const r = joy.getBoundingClientRect();
      jc = { x: r.left + r.width / 2, y: r.top + r.height / 2, R: r.width / 2 };
      e.preventDefault();
    }, { passive: false });
    const move = (e) => {
      for (const tt of e.changedTouches) {
        if (tt.identifier !== jid) continue;
        let dx = tt.clientX - jc.x, dy = tt.clientY - jc.y;
        const L = Math.hypot(dx, dy);
        if (L > jc.R) { dx *= jc.R / L; dy *= jc.R / L; }
        knob.style.transform = `translate(${dx}px, ${dy}px)`;
        inp.tmx = dx / jc.R;
        inp.tmy = dy / jc.R;
        e.preventDefault();
      }
    };
    joy.addEventListener('touchmove', move, { passive: false });
    const end = (e) => {
      for (const tt of e.changedTouches) {
        if (tt.identifier !== jid) continue;
        jid = null;
        knob.style.transform = '';
        inp.tmx = inp.tmy = 0;
      }
    };
    joy.addEventListener('touchend', end);
    joy.addEventListener('touchcancel', end);
    t.querySelectorAll('[data-k]').forEach((b) => {
      const k = b.dataset.k;
      b.addEventListener('touchstart', (e) => {
        e.preventDefault();
        e.stopPropagation();
        b.classList.add('on');
        inp.touchPress(k, true);
      }, { passive: false });
      const up = (e) => {
        e.preventDefault();
        b.classList.remove('on');
        inp.touchPress(k, false);
      };
      b.addEventListener('touchend', up, { passive: false });
      b.addEventListener('touchcancel', up, { passive: false });
    });
    // вращение камеры — свободной частью экрана
    let cid = null, last = null;
    const cv = $('#game');
    cv.addEventListener('touchstart', (e) => {
      for (const tt of e.changedTouches) {
        if (cid === null && tt.clientX > window.innerWidth * 0.35) {
          cid = tt.identifier;
          last = { x: tt.clientX, y: tt.clientY };
        }
      }
    }, { passive: true });
    cv.addEventListener('touchmove', (e) => {
      for (const tt of e.changedTouches) {
        if (tt.identifier !== cid) continue;
        J.Input.rotateCam((tt.clientX - last.x) * 2.2, (tt.clientY - last.y) * 2.2);
        last = { x: tt.clientX, y: tt.clientY };
      }
    }, { passive: true });
    const cend = (e) => {
      for (const tt of e.changedTouches) if (tt.identifier === cid) cid = null;
    };
    cv.addEventListener('touchend', cend);
    cv.addEventListener('touchcancel', cend);
  };
})();
