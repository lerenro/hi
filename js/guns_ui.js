'use strict';
// Арсенал: ввод и интерфейс. Прицеливание (ПКМ с оружием: камера через плечо, приближение, перекрестие,
// оптика снайперской), отметки попаданий, колесо оружия (удерживать Tab; на телефоне — кнопка «Оружие»),
// перезарядка R, граната — ЛКМ (прицел и бросок), оружейный магазин «Калибр», сенсорные кнопки.
(function () {
  const H = J.Hand;
  const Gn = J.Guns;
  const N = J.Nades;
  const G = () => J.G;
  const R3 = J.R3;
  const Input = J.Input;
  const rnd = Math.random;
  const esc = (s) => J.esc(String(s));
  const cnt = (p, id) => (p.inv && p.inv[id]) || 0;
  const approach = (cur, want, step) => (cur < want ? Math.min(want, cur + step) : Math.max(want, cur - step));
  const ready = (p) => J.Game.state === 'play' && p && !p.dead && !J.UI.blocking() && !p.inCar;
  const gunIn = (p) => {
    const d = p && H.held(p);
    return d && d.cls === 'gun' ? d : null;
  };

  // ---------- Прицеливание ----------
  Gn.adsK = 0;
  // ПКМ: с оружием — прицел (вместо блока/заряда)
  Gn.rmb = function (down) {
    const p = G().player;
    if (!p) return false;
    if (down) {
      if (!ready(p) || !gunIn(p) || Input.lockFailed) return false;
      p.ads = true;
      p.chg = null;
      return true;
    }
    if (p.ads && !Input.touch) {
      p.ads = false;
      return true;
    }
    return false;
  };
  // ЛКМ: граната — прицел с дугой, отпускание — бросок
  Gn.lmb = function (down) {
    const p = G().player;
    if (!p) return false;
    if (Gn.wheelOpen) {
      if (down) Gn.closeWheel(true);
      return true;
    }
    const d = H.held(p);
    if (down) {
      if (!ready(p) || !d || d.cls !== 'nade') return false;
      H.aimStart(p);
      p.nadeAim = true;
      return true;
    }
    if (p.nadeAim) {
      p.nadeAim = false;
      if (p.thrAim) {
        if (ready(p)) H.aimRelease(p);
        else p.thrAim = null;
      }
      return true;
    }
    return false;
  };
  // камера в прицеле: ближе, через правое плечо, уже поле зрения (оптика — ×8)
  const cam0 = R3.updateCamera;
  R3.updateCamera = function (px, py, pz, dt, opts) {
    const c = R3.cam;
    const p = G().player;
    const d = p && gunIn(p);
    const on = !!(opts && opts.mode === 'foot' && p && p.ads && d);
    Gn.adsK = approach(Gn.adsK, on ? 1 : 0, (dt || 0.016) / (d && d.scope ? 0.2 : 0.13));
    const k = Gn.adsK * Gn.adsK * (3 - 2 * Gn.adsK);
    if (k > 0.001) {
      const dd = d || Gn.lastAds || {};
      if (d) Gn.lastAds = d;
      const want = dd.scope ? 1.25 : dd.grip === 'rifle' ? 1.75 : 2.05;
      c.distMul += (want / c.dist - c.distMul) * k;
      c.fovAdd += ((dd.zoom || 48) - 60 - c.fovAdd) * k;
      c.yawOff *= 1 - k;
      c.focusW *= 1 - k;
      c.lookShift *= 1 - k;
      c.shoulder = 1 + 1.9 * k;
      if (on) c.idle = 0;
    } else c.shoulder = 1;
    return cam0.apply(this, arguments);
  };
  // в прицеле мышь медленнее (по полю зрения)
  const rot0 = R3.rotateCam;
  R3.rotateCam = function (dy, dp) {
    if (Gn.wheelOpen) return Gn.wheelMove(dy, dp);
    if (Gn.adsK > 0.05) {
      const f = Math.max(0.12, R3.camera.fov / 60);
      return rot0.call(this, dy * f, dp * f);
    }
    return rot0.call(this, dy, dp);
  };
  // в прицеле идёт медленно
  const spd0 = J.speedMul;
  J.speedMul = function (e) {
    let m = spd0(e);
    if (e.isPlayer && e.ads) {
      const d = gunIn(e);
      m *= d && d.scope ? 0.4 : d && d.grip === 'rifle' ? 0.58 : 0.7;
    }
    if (e.isPlayer && !e.ads) {
      const d = gunIn(e);
      if (d && d.w >= 6) m *= 0.85;
    }
    return m;
  };
  // после хода игрока: в прицеле — лицом к перекрестию, курок отпущен?
  const pupd0 = J.P.update;
  J.P.update = function (p, dt, inp) {
    pupd0.apply(this, arguments);
    const d = gunIn(p);
    if (p.ads && (!d || p.inCar || p.dead || J.UI.blocking())) p.ads = false;
    const trig = Input.mouse.l || Input.touchHold.atk;
    if (!trig) p.trigUp = true;
    // граната на телефоне: кнопка удара — прицел и бросок
    const nd = H.held(p);
    if (Input.touch && nd && nd.cls === 'nade') {
      if (Input.touchHold.atk && !p._atkWas && ready(p)) {
        H.aimStart(p);
        p.nadeAim = true;
      } else if (!Input.touchHold.atk && p._atkWas && p.nadeAim) Gn.lmb(false);
    }
    p._atkWas = !!Input.touchHold.atk;
    if (p.ads && d && p.canAct() && !p.dead) {
      const ap = Gn.aimPoint(p, (d.range || 45) * 1.5);
      p.face = Math.atan2(ap.pz - p.y, ap.px - p.x);
      const hh = G().world.groundY(p.x, p.y) + 1.4;
      p.aimPitch = J.clamp(Math.atan2(ap.ph - hh, Math.hypot(ap.px - p.x, ap.pz - p.y)), -0.8, 0.8);
      p.aimT = Math.max(p.aimT || 0, 0.2);
      Gn.aimTg = ap.tg;
      // прохожий под прицелом — в панике
      if (ap.tg && ap.tg.kind === 'civ' && ap.tg.ai && !(ap.tg.ai.fear > 0) && rnd() < dt * 3) {
        ap.tg.ai.fear = 5;
        J.R3.text(ap.tg.x, ap.tg.y, J.R.pick(['Не стреляйте!', 'Он вооружён!', 'Аааа!']), 'tsay', 1);
      }
    } else Gn.aimTg = null;
  };

  // ---------- Перекрестие, оптика, отметки ----------
  let XH = null;
  function buildXH() {
    const hud = document.getElementById('hud');
    if (!hud || XH) return;
    const el = document.createElement('div');
    el.id = 'xhair';
    el.innerHTML = '<i class="xd"></i><i class="xt t"></i><i class="xt b"></i><i class="xt l"></i><i class="xt r"></i><b class="xm"><i></i><i></i><i></i><i></i></b>';
    hud.appendChild(el);
    const sc = document.createElement('div');
    sc.id = 'scope';
    sc.innerHTML = '<div class="sc-ring"></div><i class="sc-h"></i><i class="sc-v"></i><i class="sc-d"></i>';
    hud.appendChild(sc);
    const am = document.createElement('div');
    am.id = 'ammohud';
    hud.appendChild(am);
    XH = { el, ticks: [...el.querySelectorAll('.xt')], mark: el.querySelector('.xm'), sc, am, markT: 0, lastAm: '' };
  }
  Gn.hitMark = function (head, kill) {
    if (!XH) return;
    XH.markT = kill ? 0.35 : 0.18;
    XH.mark.className = 'xm on' + (kill ? ' kill' : head ? ' head' : '');
  };
  function updXH(rdt) {
    if (!XH) buildXH();
    if (!XH) return;
    const p = G().player;
    const d = p && H.held(p);
    const show = p && d && d.cls === 'gun' && J.Game.state === 'play' && !p.inCar && !p.dead && !J.UI.blocking() && !Gn.wheelOpen;
    const scope = show && d.scope && Gn.adsK > 0.85;
    XH.el.style.display = show && !scope ? '' : 'none';
    XH.sc.style.display = scope ? '' : 'none';
    // в оптике — только перекрестие: панель, способности, подсказки и надписи прячутся
    if (XH.scoped !== !!scope) {
      XH.scoped = !!scope;
      document.body.classList.toggle('scoped', XH.scoped);
    }
    // патроны: магазин / запас
    const am = show ? `<b>${H.magOf(p, H.heldId(p))}</b><span>/ ${cnt(p, d.ammo)}</span>${p.reloadT > 0 ? '<em>перезарядка</em>' : ''}` : '';
    if (am !== XH.lastAm) {
      XH.lastAm = am;
      XH.am.innerHTML = am;
      XH.am.style.display = am ? '' : 'none';
    }
    if (!show) return;
    // раскрытие перекрестия = разброс в пикселях
    const s = Gn.spread(p, d) + (d.pellets ? d.spread * 0.6 : 0);
    const px = (Math.tan(Math.min(0.6, s)) / Math.tan((R3.camera.fov * Math.PI) / 360)) * (innerHeight / 2);
    const gap = Math.round(J.clamp(px, 3, 140));
    const [t, b, l, r] = XH.ticks;
    t.style.transform = `translate(-50%, ${-gap - 9}px)`;
    b.style.transform = `translate(-50%, ${gap}px)`;
    l.style.transform = `translate(${-gap - 9}px, -50%)`;
    r.style.transform = `translate(${gap}px, -50%)`;
    const foe = Gn.aimTg && J.hostile(p, Gn.aimTg);
    XH.el.classList.toggle('foe', !!foe);
    XH.el.classList.toggle('ads', Gn.adsK > 0.5);
    if (XH.markT > 0) {
      XH.markT -= rdt;
      if (XH.markT <= 0) XH.mark.className = 'xm';
    }
  }

  // ---------- Колесо оружия ----------
  const CATS = [
    { k: 'melee', n: 'Холодное' }, { k: 'pistol', n: 'Пистолеты' }, { k: 'smg', n: 'Пистолеты-пулемёты' }, { k: 'rifle', n: 'Винтовки' },
    { k: 'heavy', n: 'Пулемёты' }, { k: 'sniper', n: 'Снайперские' }, { k: 'shotgun', n: 'Ружья' }, { k: 'throw', n: 'Метательное' },
  ];
  Gn.CATS = CATS;
  Gn.catOf = function (id) {
    const d = H.def(id);
    if (!d) return null;
    if (d.cls === 'gun') return d.cat || 'pistol';
    if (d.cls === 'nade' || d.cls === 'throw') return 'throw';
    if (d.cls === 'blade' || d.cls === 'blunt') return 'melee';
    return null;
  };
  Gn.listCat = function (p, cat) {
    return Object.keys(p.inv || {}).filter((id) => cnt(p, id) > 0 && Gn.catOf(id) === cat).sort((a, b) => (J.ITEMS[b].price || 0) - (J.ITEMS[a].price || 0));
  };
  let WH = null;
  const WS = { x: 0, y: 0, sec: -1, t0: 0, moved: false, pick: {} };
  function buildWheel() {
    if (WH) return WH;
    const hud = document.getElementById('hud');
    const el = document.createElement('div');
    el.id = 'wwheel';
    el.hidden = true;
    const R = 170, r = 64, cx = 180, cy = 180;
    let svg = `<svg viewBox="0 0 360 360" class="ww-ring">`;
    CATS.forEach((c, i) => {
      const a0 = ((i * 45 - 90 - 22.5) * Math.PI) / 180, a1 = ((i * 45 - 90 + 22.5) * Math.PI) / 180;
      const p = (rr, a) => `${(cx + Math.cos(a) * rr).toFixed(1)} ${(cy + Math.sin(a) * rr).toFixed(1)}`;
      svg += `<path data-s="${i}" d="M ${p(r, a0)} L ${p(R, a0)} A ${R} ${R} 0 0 1 ${p(R, a1)} L ${p(r, a1)} A ${r} ${r} 0 0 0 ${p(r, a0)} Z"/>`;
    });
    svg += `<circle cx="180" cy="180" r="${r - 4}" class="ww-c"/></svg>`;
    el.innerHTML = svg + CATS.map((c, i) => {
      const a = ((i * 45 - 90) * Math.PI) / 180;
      return `<div class="ww-it" data-i="${i}" style="left:${50 + Math.cos(a) * 32.5}%;top:${50 + Math.sin(a) * 32.5}%"><span class="ww-ic"></span><b></b><em></em></div>`;
    }).join('') + '<div class="ww-mid"><b></b><span></span><em></em></div><div class="ww-hint">Удерживай Tab, веди мышью · колёсико — другое оружие раздела · отпусти — взять</div>';
    hud.appendChild(el);
    WH = { el, paths: [...el.querySelectorAll('path[data-s]')], its: [...el.querySelectorAll('.ww-it')], mid: el.querySelector('.ww-mid') };
    // касание: выбрать раздел (повторное — следующее оружие раздела)
    const tapSec = (i, ev) => {
      ev.preventDefault();
      ev.stopPropagation();
      if (WS.sec === i) cycleCat(1);
      WS.sec = i;
      renderWheel();
    };
    WH.its.forEach((it, i) => {
      it.addEventListener('touchstart', (ev) => tapSec(i, ev), { passive: false });
      it.addEventListener('mousedown', (ev) => { if (Input.touch) tapSec(i, ev); });
    });
    WH.paths.forEach((pa, i) => pa.addEventListener('touchstart', (ev) => tapSec(i, ev), { passive: false }));
    WH.mid.addEventListener('touchstart', (ev) => {
      ev.preventDefault();
      ev.stopPropagation();
      if (WS.sec === -1) Gn.closeWheel(false);
      else {
        WS.sec = -1;
        renderWheel();
      }
    }, { passive: false });
    el.addEventListener('wheel', (ev) => {
      ev.preventDefault();
      cycleCat(ev.deltaY > 0 ? 1 : -1);
    }, { passive: false });
    return WH;
  }
  // выбранное в разделе оружие
  function curOf(p, cat) {
    const list = Gn.listCat(p, cat);
    if (!list.length) return null;
    const want = WS.pick[cat];
    if (want && list.includes(want)) return want;
    const held = H.heldId(p);
    if (held && list.includes(held)) return held;
    return list[0];
  }
  function cycleCat(dir) {
    const p = G().player;
    if (!p || WS.sec < 0) return;
    const cat = CATS[WS.sec].k;
    const list = Gn.listCat(p, cat);
    if (list.length < 2) return;
    const i = list.indexOf(curOf(p, cat));
    WS.pick[cat] = list[(i + dir + list.length) % list.length];
    renderWheel();
  }
  Gn.wheelCycle = cycleCat;
  function ammoTxt(p, id) {
    const d = H.def(id);
    if (!d) return '';
    if (d.cls === 'gun') return `${H.magOf(p, id)} / ${cnt(p, d.ammo)}`;
    if (cnt(p, id) > 1) return '×' + cnt(p, id);
    return '';
  }
  function renderWheel() {
    const p = G().player;
    if (!WH || !p) return;
    CATS.forEach((c, i) => {
      const id = curOf(p, c.k);
      const it = WH.its[i];
      const n = Gn.listCat(p, c.k).length;
      it.classList.toggle('empty', !id);
      it.classList.toggle('on', WS.sec === i);
      WH.paths[i].classList.toggle('on', WS.sec === i);
      WH.paths[i].classList.toggle('empty', !id);
      it.querySelector('.ww-ic').innerHTML = id ? H.icon(id) : '';
      it.querySelector('b').textContent = id ? ammoTxt(p, id) : '';
      it.querySelector('em').textContent = n > 1 ? `${CATS[i].n} · ${n}` : CATS[i].n;
    });
    const mid = WH.mid;
    const sel = WS.sec >= 0 ? curOf(p, CATS[WS.sec].k) : null;
    mid.querySelector('b').textContent = WS.sec < 0 ? 'Без оружия' : sel ? J.ITEMS[sel].name : CATS[WS.sec].n;
    const d = sel && H.def(sel);
    mid.querySelector('span').textContent = sel ? (d.cls === 'gun' ? `Магазин ${H.magOf(p, sel)}/${d.mag} · запас ${cnt(p, d.ammo)}` : d.cls === 'nade' || d.cls === 'throw' ? `Осталось: ${cnt(p, sel)}` : `Урон ${d.dmg}`) : WS.sec < 0 ? 'кулаки и стенд' : 'нет оружия';
    mid.querySelector('em').textContent = d && d.cls === 'gun' ? `Урон ${Math.round(d.dmg * (d.pellets || 1))} · ${d.auto ? 'автомат' : d.act === 'pump' ? 'помпа' : d.act === 'bolt' ? 'затвор' : 'полуавтомат'}` : '';
  }
  Gn.openWheel = function () {
    const p = G().player;
    if (!ready(p) || Gn.wheelOpen) return;
    buildWheel();
    Gn.wheelOpen = true;
    p.ads = false;
    p.thrAim = null;
    WS.x = WS.y = 0;
    WS.moved = false;
    WS.t0 = performance.now();
    const held = H.heldId(p);
    const c = held ? Gn.catOf(held) : null;
    WS.sec = c ? CATS.findIndex((q) => q.k === c) : -1;
    WS.sec0 = WS.sec;
    WH.el.hidden = false;
    renderWheel();
    if (J.Sfx && J.Sfx.whoosh) J.Sfx.whoosh(0.12, true, 0.04);
  };
  Gn.wheelMove = function (dx, dy) {
    // движения мыши → направление (без поворота камеры)
    WS.x += dx * 420;
    WS.y += dy * 500;
    const L = Math.hypot(WS.x, WS.y);
    if (L > 120) {
      WS.x *= 120 / L;
      WS.y *= 120 / L;
    }
    if (L > 28) {
      WS.moved = true;
      const a = (Math.atan2(WS.y, WS.x) * 180) / Math.PI + 90 + 22.5;
      const s = Math.floor((((a % 360) + 360) % 360) / 45);
      if (s !== WS.sec) {
        WS.sec = s;
        renderWheel();
        if (J.Sfx && J.Sfx.click) J.Sfx.click();
      }
    }
  };
  Gn.closeWheel = function (apply) {
    if (!Gn.wheelOpen) return;
    Gn.wheelOpen = false;
    WH.el.hidden = true;
    const p = G().player;
    if (!p || !apply) return;
    if (WS.sec < 0) {
      if (p.hsel >= 0 && WS.sec0 !== -1) H.select(p, p.hsel);
      return;
    }
    const id = curOf(p, CATS[WS.sec].k);
    if (!id || id === H.heldId(p)) return;
    H.equip(p, id);
  };
  // Tab: удерживать — колесо; короткое нажатие — стенд, как раньше
  const onKey0 = J.Game.onKey;
  J.Game.onKey = function (code) {
    const p = G().player;
    if (code === 'Tab' && ready(p) && !(J.Cb && J.Cb.inClash && J.Cb.inClash(p))) return Gn.openWheel();
    // R с оружием — перезарядка (если магазин не полон и есть патроны); иначе — способность стенда
    if (code === 'KeyR' && ready(p)) {
      const d = gunIn(p);
      if (d && H.magOf(p, H.heldId(p)) < d.mag && cnt(p, d.ammo) > 0 && !(p.reloadT > 0)) return void H.reload(p);
    }
    if (Gn.wheelOpen && /^Digit[0-9]$/.test(code)) return;
    return onKey0.apply(this, arguments);
  };
  const onKeyUp0 = J.Game.onKeyUp;
  J.Game.onKeyUp = function (code) {
    if (code === 'Tab' && Gn.wheelOpen) {
      const quick = performance.now() - WS.t0 < 220 && !WS.moved;
      Gn.closeWheel(!quick);
      const p = G().player;
      if (quick && ready(p)) J.P.toggleStand(p);
      return;
    }
    return onKeyUp0.apply(this, arguments);
  };
  // колёсико мыши при открытом колесе — оружие внутри раздела
  const wheel0 = H.wheel;
  H.wheel = function (e) {
    if (Gn.wheelOpen) {
      cycleCat(e.deltaY > 0 ? 1 : -1);
      return true;
    }
    return wheel0.apply(this, arguments);
  };

  // ---------- Оружейный магазин «Калибр» ----------
  const bar = (v, max) => `<i class="gs-bar"><s style="width:${Math.round(J.clamp(v / max, 0.04, 1) * 100)}%"></s></i>`;
  function gunStats(d) {
    const dps = (d.dmg * (d.pellets || 1)) / Math.max(0.06, d.rate);
    return `<div class="gs-st"><span>Урон</span>${bar(d.dmg * (d.pellets || 1), 120)}<span>Скорострельность</span>${bar(1 / d.rate, 14)}<span>Точность</span>${bar(0.12 - d.spread, 0.11)}<span>Дальность</span>${bar(d.range, 180)}</div><div class="muted small">Магазин ${d.mag} · ${J.ITEMS[d.ammo].name} · ${Math.round(dps)} ур/с · вес ${d.w} кг</div>`;
  }
  Gn.renderShop = function (b) {
    const UI = J.UI;
    const p = G().player;
    const box = document.getElementById('bbody');
    const rg = J.REGION[b.region];
    const mul = UI.discount(p);
    let h = `<h2>${esc(b.name)}</h2><p class="muted">${esc(rg.name)} · ${J.fmtClock(G().time)} · ${J.fmtMoney(p.money)}</p><p>Лицензия не нужна. Стрелять в городе — дело твоё, но полиция услышит.</p><div class="gs-tabs">`;
    const tab = Gn._shopTab || 0;
    J.GUNSHOP.forEach(([n], i) => (h += `<button class="gs-tab ${i === tab ? 'on' : ''}" data-tab="${i}">${esc(n)}</button>`));
    h += '</div><div class="gs-list">';
    for (const id of J.GUNSHOP[tab][1]) {
      const it = J.ITEMS[id];
      const d = it.hand || (it.pack && J.ITEMS[it.pack[0]].hand);
      const pr = Math.ceil(it.price * mul);
      const own = it.type === 'gun' && cnt(p, id) > 0;
      const icon = H.icon(it.type === 'pack' ? it.pack[0] : id);
      let info = esc(it.desc);
      if (it.type === 'gun') info = gunStats(it.hand) + `<div class="small">${esc(it.desc)}</div>`;
      else if (it.type === 'pack') info += ` <span class="muted small">(есть: ${cnt(p, it.pack[0])})</span>`;
      else if (d && d.cls !== 'gun') info += ` <span class="muted small">${d.cls === 'nade' ? `есть: ${cnt(p, id)}` : `урон ${d.dmg}`}</span>`;
      h += `<div class="gs-item ${own ? 'own' : ''}"><span class="gs-ic">${icon}</span><div class="gs-info"><b>${esc(it.name)}</b>${info}</div><button class="btn sm" data-buy="${id}" ${own || p.money < pr ? 'disabled' : ''}>${own ? 'Куплено' : J.fmtMoney(pr)}</button></div>`;
    }
    h += '</div>';
    box.innerHTML = h;
    box.querySelectorAll('[data-tab]').forEach((bt) => (bt.onclick = () => { Gn._shopTab = +bt.dataset.tab; Gn.renderShop(b); }));
    box.querySelectorAll('[data-buy]').forEach((bt) => (bt.onclick = () => {
      const id = bt.dataset.buy;
      const it = J.ITEMS[id];
      const pr = Math.ceil(it.price * mul);
      if (p.money < pr) return UI.toast('Не хватает денег.', 'red');
      J.P.addMoney(p, -pr);
      J.P.addItem(p, id, 1, null, true);
      // к новому стволу — полный магазин и коробка патронов
      if (it.type === 'gun') {
        p.mag[id] = it.hand.mag;
        J.P.addItem(p, it.hand.ammo, it.hand.mag * 2, null, true);
        UI.toast(`Куплено: ${it.name} + ${it.hand.mag * 2} патронов. Tab — колесо оружия, ПКМ — прицел.`, 'gold');
      } else UI.toast('Куплено: ' + it.name, 'green');
      if (J.Sfx && J.Sfx.click) J.Sfx.click();
      Gn.renderShop(b);
    }));
  };
  const rb0 = J.UI.renderBuilding;
  J.UI.renderBuilding = function () {
    const b = J.UI.bOpen;
    if (b && b.type === 'gunshop') return Gn.renderShop(b);
    return rb0.apply(this, arguments);
  };

  // ---------- Сенсорные кнопки ----------
  function touchBtns() {
    const act = document.getElementById('hotact');
    if (!act || act.querySelector('[data-ga]')) return;
    for (const [k, n] of [['ads', 'Прицел'], ['wheel', 'Оружие'], ['rel', 'Перезар.']]) {
      const b = document.createElement('button');
      b.className = 'tb sm';
      b.dataset.ga = k;
      b.textContent = n;
      b.addEventListener('touchstart', (ev) => {
        ev.preventDefault();
        ev.stopPropagation();
        const p = G().player;
        if (!p) return;
        if (k === 'wheel') return Gn.wheelOpen ? Gn.closeWheel(true) : Gn.openWheel();
        if (!ready(p)) return;
        if (k === 'ads' && gunIn(p)) {
          p.ads = !p.ads;
          b.classList.toggle('on', p.ads);
        }
        if (k === 'rel' && gunIn(p)) H.reload(p);
      }, { passive: false });
      act.appendChild(b);
    }
  }

  // ---------- Подписи, справка ----------
  const abar0 = J.UI.updateAbilityBar;
  J.UI.updateAbilityBar = function () {
    abar0.apply(this, arguments);
    const p = G().player;
    const E = J.UI.abEls;
    const d = p && H.held(p);
    if (!d || !E) return;
    if (d.cls === 'gun') E.heavy.querySelector('.n').textContent = Input.touch ? 'Приклад' : 'Прицел (ПКМ)';
    if (d.cls === 'nade') {
      E.basic.querySelector('.n').textContent = 'Бросить';
      E.heavy.querySelector('.n').textContent = 'Бросок';
    }
    if (d.fist) E.basic.querySelector('.n').textContent = 'Кастет';
  };
  // кастет: кулаки бьют сильнее (только свои удары, не стенд)
  const hurt0 = J.hurt;
  J.hurt = function (t, amount, src, opt) {
    if (src && src.isPlayer && opt && opt.melee && !opt.stand && !(src.stand && src.standOut)) {
      const d = H.held(src);
      if (d && d.fist) {
        amount *= d.fist;
        if (!opt._k) {
          opt = Object.assign({}, opt, { _k: 1, stun: Math.max(opt.stun || 0, d.stun), knock: (opt.knock || 1) * 1.25 });
          if (Gn.snd && J.dist(t.x, t.y, src.x, src.y) < 3) Gn.snd('hitmetal', t.x, t.y, { k: 0.35 });
        }
      }
    }
    return hurt0.call(this, t, amount, src, opt);
  };

  // ---------- Подключение к циклу ----------
  const pick0 = J.updatePickups;
  J.updatePickups = function (dt) {
    pick0.call(this, dt);
    Gn.update(dt);
    N.update(dt);
    Gn.updateAI(dt);
    // в колесе время замедляется
    if (Gn.wheelOpen && J.Fx && J.Fx.slowmo) J.Fx.slowmo(0.22, 0.12, 0.06);
  };
  const uiUpd0 = J.UI.update;
  J.UI.update = function (rdt) {
    uiUpd0.apply(this, arguments);
    updXH(rdt || 0.016);
    touchBtns();
    if (Gn.wheelOpen) {
      const p = G().player;
      if (!p || p.dead || p.inCar || J.UI.blocking() || J.Game.state !== 'play') Gn.closeWheel(false);
      else if ((Gn._wrT = (Gn._wrT || 0) - (rdt || 0.016)) <= 0) {
        Gn._wrT = 0.25;
        renderWheel();
      }
    }
  };
  const reset0 = J.Hand.reset;
  J.Hand.reset = function () {
    reset0.apply(this, arguments);
    Gn.reset();
    N.reset();
    const p = G().player;
    if (p) p.ads = false;
    Gn.adsK = 0;
    if (Gn.wheelOpen) Gn.closeWheel(false);
  };
  window.addEventListener('blur', () => {
    const p = G().player;
    if (p) {
      if (!Input.touch) p.ads = false;
      p.nadeAim = false;
    }
    if (Gn.wheelOpen) Gn.closeWheel(false);
  });
})();
