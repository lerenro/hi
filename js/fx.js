'use strict';
// Боевая подача в духе аниме: стоп-кадр и замедление (глобальная шкала времени), уровни попаданий,
// тряска и наезды камеры, кадры удара, линии скорости, катакана-звукоподражания, искры, пыль, обломки,
// шквал кулаков раша, баннеры «ОРА ОРА», столкновение рашей, остановка времени со сферой инверсии,
// противостояние с ゴゴゴ. Всё из пулов — в кадре нет выделений памяти.
(function () {
  const R3 = J.R3;
  const Fx = (J.Fx = {
    hs: 0, slow: null, scale: 1, simT: 0,
    set: { shake: 1, flash: true, slowmo: true }, q: 1,
    tsK: 0, ready: false,
  });
  const TAU = Math.PI * 2;
  const rnd = Math.random;
  const gy = (x, y) => J.G.world.groundY(x, y);
  const tmpC = new THREE.Color(), tmpC2 = new THREE.Color();
  const V = new THREE.Vector3(), V2 = new THREE.Vector3();
  const SP = { x: 0, y: 0, ok: false };
  const proj = (x, h, z) => {
    V.set(x, h, z).project(R3.camera);
    SP.ok = V.z > -1 && V.z < 1;
    SP.x = (V.x * 0.5 + 0.5) * R3.W;
    SP.y = (-V.y * 0.5 + 0.5) * R3.H;
    return SP;
  };
  Fx.proj = proj;
  const phone = () => J.Input && J.Input.touch && Math.min(innerWidth, innerHeight) < 600;

  // ---------- 1. Время: стоп-кадр и замедление ----------
  Fx.hitstop = (s) => {
    if (s > Fx.hs) Fx.hs = Math.min(0.3, s);
  };
  Fx.slowmo = (scale, dur, ease = 0.25) => {
    if (!Fx.set.slowmo) return;
    if (!Fx.slow || scale <= Fx.slow.scale) Fx.slow = { scale, t: dur, ease };
  };
  Fx.tick = function (rdt) {
    if (Fx.hs > 0) {
      Fx.hs -= rdt;
      Fx.scale = 0;
      return 0;
    }
    let s = 1;
    const o = Fx.slow;
    if (o) {
      o.t -= rdt;
      if (o.t <= 0) Fx.slow = null;
      else s = J.lerp(1, o.scale, Math.min(1, o.t / o.ease));
    }
    Fx.scale = s;
    return rdt * s;
  };
  // Попадание близко к игроку (стоп-кадры только для своих боёв)
  const nearPlayer = (a, b, r) => {
    const p = J.G.player;
    if (!p) return false;
    if (a === p || b === p || (a && J.ownerOf(a) === p) || (b && J.ownerOf(b) === p)) return true;
    const o = b || a;
    return !!o && J.dist(o.x, o.y, p.x, p.y) < (r || 12);
  };
  Fx.nearPlayer = nearPlayer;

  // ---------- 2. Камера: тряска, толчок, наезд, голландский угол, поле зрения, фокус ----------
  const CF = (Fx.CF = { trauma: 0, kickX: 0, kickV: 0, punch: 0, punchHold: 0, rollT: 0, roll: 0, rollHold: 0, fovAdd: 0, fovT: 0, fovHold: 0, yawOff: 0, yawT: 0, yawHold: 0, distMul: 1, distT: 1, focus: null, focusW: 0, focusT: 0, focusHold: 0 });
  Fx.trauma = (a) => {
    CF.trauma = Math.min(1, CF.trauma + a * Fx.set.shake);
  };
  Fx.kick = (ang, a) => {
    if (!Fx.set.shake) return;
    // знак: удар слева направо на экране
    const yaw = R3.cam.yaw;
    const s = Math.sin(ang - yaw) >= 0 ? 1 : -1;
    CF.kickV += s * a * 3 * Fx.set.shake;
  };
  Fx.punchIn = (amt, hold) => {
    if (!Fx.set.shake) amt *= 0.4;
    CF.punch = Math.max(CF.punch, amt);
    CF.punchHold = Math.max(CF.punchHold, hold);
  };
  Fx.dutch = (rad, hold) => {
    if (!Fx.set.shake) return;
    CF.rollT = (rnd() < 0.5 ? -1 : 1) * rad;
    CF.rollHold = hold;
  };
  Fx.fov = (add, hold) => {
    if (add < CF.fovT || CF.fovHold <= 0) CF.fovT = add;
    CF.fovHold = Math.max(CF.fovHold, hold);
  };
  Fx.yaw = (off, hold) => {
    CF.yawT = off;
    CF.yawHold = hold;
  };
  Fx.focusOn = (o, hold) => {
    CF.focus = o;
    CF.focusHold = hold;
  };
  Fx.applyCamera = function (cam, rdt) {
    const c = R3.cam;
    CF.trauma = Math.max(0, CF.trauma - 1.6 * rdt);
    const s = CF.trauma * CF.trauma;
    const T = performance.now() / 1000;
    const n1 = 0.5 * Math.sin(T * 61.3) + 0.5 * Math.sin(T * 37.1 + 1.3);
    const n2 = 0.5 * Math.sin(T * 53.7 + 2.1) + 0.5 * Math.sin(T * 29.3);
    const n3 = Math.sin(T * 47.9 + 0.7);
    CF.kickV += (-CF.kickX * 380 - CF.kickV * 28) * Math.min(rdt, 0.05);
    CF.kickX += CF.kickV * Math.min(rdt, 0.05);
    if (CF.punchHold > 0) CF.punchHold -= rdt;
    else CF.punch = Math.max(0, CF.punch - 1.8 * rdt);
    if (CF.punch > 0) {
      V2.set(c.tx, c.ty, c.tz).sub(cam.position).multiplyScalar(Math.min(0.5, CF.punch));
      cam.position.add(V2);
    }
    if (CF.rollHold > 0) CF.rollHold -= rdt;
    else CF.rollT *= Math.pow(0.02, rdt);
    CF.roll += (CF.rollT - CF.roll) * Math.min(1, rdt * 18);
    cam.translateX(n1 * s * 0.32 + CF.kickX);
    cam.translateY(n2 * s * 0.22);
    cam.rotateZ(CF.roll + n3 * s * 0.05);
    // плавные цели для базовой камеры (действуют со следующего кадра)
    if (CF.fovHold > 0) CF.fovHold -= rdt;
    else CF.fovT = 0;
    CF.fovAdd += (CF.fovT - CF.fovAdd) * Math.min(1, rdt * 8);
    c.fovAdd = CF.fovAdd;
    if (CF.yawHold > 0) CF.yawHold -= rdt;
    else CF.yawT = 0;
    if (c.idle < 0.15) CF.yawT = 0; // ручной поворот отменяет ракурс
    CF.yawOff += (CF.yawT - CF.yawOff) * Math.min(1, rdt * 3);
    c.yawOff = CF.yawOff;
    c.distMul += (CF.distT - c.distMul) * Math.min(1, rdt * 4);
    if (CF.focusHold > 0) CF.focusHold -= rdt;
    else CF.focus = null;
    const f = CF.focus;
    CF.focusW += ((f && !f.dead ? 1 : 0) - CF.focusW) * Math.min(1, rdt * 5);
    if (f) {
      c.focusX = f.x;
      c.focusZ = f.y;
      c.focusY = gy(f.x, f.y) + 1.3 + (f.z || 0);
    }
    c.focusW = CF.focusW;
  };

  // ---------- 3. DOM-слой: линии, вспышка, слова, колонки, баннеры, числа урона ----------
  let gmEl = null, gmI = null;
  let root = null, linesA = null, linesB = null, flashEl = null, lbT = null, lbB = null, lowEl = null, cardEl = null, clashEl = null;
  const WORDS = [], COLS = [], BANS = [], NUMS = [], RINGS = [];
  let lineImgs = [];
  const LN = { str: 0, life: 0, max: 0, x: 0, y: 0, white: false, fl: 0, streak: false, rot: 0 };
  function makeLines(seed, ink, streak) {
    const cv = document.createElement('canvas');
    const S = 1024;
    cv.width = cv.height = S;
    const c = cv.getContext('2d');
    const R = J.rng(seed);
    c.fillStyle = ink;
    if (streak) {
      // параллельные штрихи для рывка
      for (let i = 0; i < 70; i++) {
        const y = R() * S, x0 = R() * S * 0.5, L = S * (0.3 + R() * 0.5), w = 1 + R() * 4;
        c.beginPath();
        c.moveTo(x0, y);
        c.lineTo(x0 + L, y - w);
        c.lineTo(x0 + L, y + w);
        c.closePath();
        c.fill();
      }
      return cv.toDataURL();
    }
    c.translate(S / 2, S / 2);
    for (let i = 0; i < 110; i++) {
      const a = R() * TAU;
      const r0 = S * (0.13 + R() * 0.07), r1 = S * 0.75;
      const w = 2 + R() * 9;
      const ca = Math.cos(a), sa = Math.sin(a);
      c.beginPath();
      c.moveTo(ca * r0, sa * r0);
      c.lineTo(ca * r1 - sa * w, sa * r1 + ca * w);
      c.lineTo(ca * r1 + sa * w, sa * r1 - ca * w);
      c.closePath();
      c.fill();
    }
    return cv.toDataURL();
  }
  const div = (cls, parent) => {
    const d = document.createElement('div');
    d.className = cls;
    (parent || root).appendChild(d);
    return d;
  };
  function buildDom() {
    root = document.createElement('div');
    root.id = 'fx';
    document.body.insertBefore(root, document.getElementById('labels'));
    lineImgs = [makeLines(7, 'rgba(20,10,30,0.85)'), makeLines(19, 'rgba(20,10,30,0.85)'), makeLines(23, 'rgba(255,255,255,0.9)'), makeLines(31, 'rgba(255,255,255,0.9)'), makeLines(5, 'rgba(255,255,255,0.75)', true)];
    linesA = div('fxlines');
    linesB = div('fxlines');
    lowEl = div('fxlow');
    flashEl = div('fxflash');
    lbT = div('lbx top');
    lbB = div('lbx bot');
    const wl = div('fxwords');
    for (let i = 0; i < 8; i++) WORDS.push({ el: div('ono', wl), life: 0, max: 0, act: false, prio: 0, sx: 0, sy: 0, dx: 0, dy: 0, rot: 0, hold: 0.4 });
    for (let i = 0; i < 2; i++) COLS.push({ el: div('ono v col c' + i, root), life: 0, max: 0, act: false, side: i, text: '' });
    for (let i = 0; i < 2; i++) BANS.push({ el: div('rushb', root), u: null, t: 0, n: 0, txt: '', jit: 0, act: false, fin: 0, x: 0, y: 0 });
    const nl = div('fxnums');
    for (let i = 0; i < 6; i++) NUMS.push({ el: div('dnum', nl), t: null, life: 0, val: 0, n: 0, x: 0, y: 0, h: 0, txt: '', act: false, pop: 0, crit: false });
    for (let i = 0; i < 3; i++) RINGS.push({ el: div('fxring', root), life: 0, act: false });
    cardEl = div('namecard');
    gmEl = div('');
    gmEl.id = 'guardm';
    gmI = document.createElement('i');
    gmEl.appendChild(gmI);
    clashEl = div('clash');
    clashEl.innerHTML = '<div class="cbar"><i class="ca"></i><i class="cb"></i></div><div class="ctxt">ЖМИ! <b>ЛКМ</b> / <b>клавиша раша</b></div><button class="cbtn" type="button">ЖМИ!</button>';
    const btn = clashEl.querySelector('.cbtn');
    const mash = (e) => {
      e.preventDefault();
      J.Cb && J.Cb.mash(J.G.player);
    };
    btn.addEventListener('touchstart', mash, { passive: false });
    btn.addEventListener('mousedown', mash);
    linesA.style.backgroundImage = `url(${lineImgs[0]})`;
    linesB.style.backgroundImage = `url(${lineImgs[1]})`;
    // шрифт с катаканой — заранее, чтобы первые ゴゴゴ не мигнули запасным шрифтом
    try {
      if (document.fonts && document.fonts.load) document.fonts.load('40px "Dela Gothic One"', 'ドゴォンバキィガズキュウゴシュッカチザ・ワールドオラムダ').catch(() => {});
    } catch (e) {}
  }

  // Безопасные зоны HUD, куда слова не лезут
  const SAFE = [];
  const measureSafe = () => {
    SAFE.length = 0;
    const W = innerWidth, H = innerHeight;
    if (phone()) {
      SAFE.push([0, 0, 180, 110], [W - 130, 0, W, 170]);
    } else SAFE.push([0, 0, 250, 150], [W - 190, 0, W, 250]);
    for (const id of ['abilities', 'tbtns', 'joy', 'toasts']) {
      const el = document.getElementById(id);
      if (!el || el.offsetParent === null) continue;
      const r = el.getBoundingClientRect();
      if (r.width > 0 && r.height > 0) SAFE.push([r.left - 6, r.top - 6, r.right + 6, r.bottom + 6]);
    }
  };
  // Сдвигаем прямоугольник слова из HUD-зон
  const placeSafe = (o, hw, hh) => {
    const W = innerWidth, H = innerHeight;
    for (let k = 0; k < 2; k++)
      for (const r of SAFE) {
        if (o.sx + hw < r[0] || o.sx - hw > r[2] || o.sy + hh < r[1] || o.sy - hh > r[3]) continue;
        const dl = o.sx + hw - r[0], dr = r[2] - (o.sx - hw), du = o.sy + hh - r[1], dd = r[3] - (o.sy - hh);
        const m = Math.min(dl, dr, du, dd);
        if (m === dl) o.sx -= dl;
        else if (m === dr) o.sx += dr;
        else if (m === du) o.sy -= du;
        else o.sy += dd;
      }
    o.sx = J.clamp(o.sx, hw + 6, W - hw - 6);
    o.sy = J.clamp(o.sy, hh + 6, H - hh - 6);
  };

  // ---------- Слова (катакана) ----------
  const WSET = {
    light: ['ドッ', 'バシッ', 'ボコッ'], mid: ['バキッ', 'ドゴッ', 'ゴッ'], big: ['ドン!', 'ドゴォ!', 'バキィィ!'], fin: ['ドゴォォン!!', 'ドギャーン!!', 'バゴォォ!!'],
    kill: ['バーン!'], block: ['ガキィン!', 'ガッ'], wall: ['ズガァン!', 'ドガァ!'], boom: ['ドグォォン!'], shoot: ['バシュッ', 'ドスッ'],
  };
  Fx.WSET = WSET;
  const WSIZE = { light: [28, 20], mid: [40, 28], big: [64, 44], fin: [96, 62], kill: [110, 70], ts: [120, 72], tick: [34, 26], sm: [26, 20], md: [48, 32] };
  const WPRIO = { fin: 3, kill: 3, ts: 3, big: 2 };
  const WHOLD = { light: 0.35, mid: 0.45, big: 0.6, fin: 0.9, kill: 1.0, ts: 1.4, tick: 0.4, sm: 0.4, md: 0.6 };
  // Слово на экране в точке sx, sy
  Fx.wordAt = function (text, sx, sy, sizeKey, color, stroke) {
    if (!root) return null;
    const max = phone() ? 2 : 4;
    const prio = WPRIO[sizeKey] || 1;
    let w = null, act = 0, low = null;
    for (const o of WORDS) {
      if (!o.act) {
        if (!w) w = o;
        continue;
      }
      act++;
      if (!low || o.prio < low.prio || (o.prio === low.prio && o.life > low.life)) low = o;
    }
    if (act >= max || !w) {
      if (!low || low.prio > prio) return null;
      w = low;
    }
    const sz = (WSIZE[sizeKey] || WSIZE.mid)[phone() ? 1 : 0];
    w.el.textContent = text;
    w.el.style.setProperty('--os', sz + 'px');
    w.el.style.setProperty('--oc', color || '#ffe14a');
    w.el.style.setProperty('--ok', stroke || '#1a0a2a');
    w.el.style.display = 'block';
    w.act = true;
    w.prio = prio;
    w.hold = WHOLD[sizeKey] || 0.45;
    w.max = 0.15 + w.hold + 0.25;
    w.life = 0;
    w.rot = -14 + rnd() * 22;
    w.sx = sx;
    w.sy = sy;
    const hw = Math.min(innerWidth * 0.45, text.length * sz * 0.5), hh = sz * 0.6;
    placeSafe(w, hw, hh);
    const cx = innerWidth / 2, cy = innerHeight / 2;
    const L = Math.hypot(w.sx - cx, w.sy - cy) || 1;
    w.dx = ((w.sx - cx) / L) * 12;
    w.dy = ((w.sy - cy) / L) * 12;
    return w;
  };
  // Слово у точки мира (x, y карты, h высота) — смещено от центра экрана
  Fx.word = function (text, x, y, h, sizeKey, color, stroke) {
    if (!root) return null;
    const s = proj(x, h, y);
    if (!s.ok) return null;
    const cx = innerWidth / 2, cy = innerHeight / 2;
    let dx = s.x - cx, dy = s.y - cy;
    const L = Math.hypot(dx, dy) || 1;
    const off = 40 + rnd() * 40;
    dx = (dx / L) * off;
    dy = (dy / L) * off;
    if (L < 2) dx = (rnd() < 0.5 ? -1 : 1) * off;
    return Fx.wordAt(text, s.x + dx, s.y + dy - 30, sizeKey, color, stroke);
  };
  Fx.pick = (k) => {
    const a = WSET[k] || WSET.mid;
    return a[(rnd() * a.length) | 0];
  };
  function updateWords(rdt) {
    for (const o of WORDS) {
      if (!o.act) continue;
      o.life += rdt;
      const t = o.life;
      if (t >= o.max) {
        o.act = false;
        o.el.style.display = 'none';
        continue;
      }
      let sc, op = 1, dr = 0;
      if (t < 0.06) sc = 1.25 * J.Anim.EASE.outBack(t / 0.06);
      else if (t < 0.15) sc = 1.25 - 0.25 * ((t - 0.06) / 0.09);
      else sc = 1;
      const fade = o.max - 0.25;
      if (t > fade) {
        const k = (t - fade) / 0.25;
        op = 1 - k;
        dr = k;
      }
      o.el.style.transform = `translate(${(o.sx + o.dx * dr).toFixed(1)}px,${(o.sy + o.dy * dr).toFixed(1)}px) translate(-50%,-50%) rotate(${o.rot.toFixed(1)}deg) skewX(-10deg) scale(${sc.toFixed(3)})`;
      o.el.style.opacity = op.toFixed(3);
    }
  }

  // ---------- Вертикальные колонки ドドドド / ゴゴゴゴ ----------
  Fx.column = function (side, text, color, dur) {
    if (!root) return;
    if (phone() && side === 1) return;
    const c = COLS[side];
    if (c.text !== text) {
      c.el.textContent = text;
      c.text = text;
    }
    c.el.style.setProperty('--oc', color || '#b06bff');
    c.el.style.setProperty('--os', (phone() ? 30 : 58) + 'px');
    c.el.style.display = 'block';
    c.act = true;
    c.life = 0;
    c.max = dur || 1.6;
  };
  Fx.columnOff = (side) => {
    const c = COLS[side];
    if (c && c.act && c.max - c.life > 0.25) c.life = c.max - 0.25;
  };
  function updateCols(rdt) {
    const T = performance.now() / 1000;
    for (const c of COLS) {
      if (!c.act) continue;
      c.life += rdt;
      if (c.life >= c.max) {
        c.act = false;
        c.el.style.display = 'none';
        continue;
      }
      const inK = Math.min(1, c.life / 0.15), outK = Math.min(1, (c.max - c.life) / 0.25);
      const jy = Math.sin(T * 40 + c.side * 2) * 2;
      c.el.style.opacity = Math.min(inK, outK).toFixed(3);
      c.el.style.transform = `translateY(${jy.toFixed(1)}px) skewY(-8deg) rotate(${c.side ? -4 : 4}deg) scale(${(0.8 + 0.2 * inK).toFixed(3)})`;
    }
  }

  // ---------- Линии концентрации и штрихи рывка ----------
  Fx.lines = function (sx, sy, str, dur, white) {
    if (!root) return;
    if (!Fx.set.flash) str = Math.min(str, 0.35);
    if (str < LN.str * (LN.life / Math.max(0.01, LN.max)) && LN.life > 0) return;
    LN.str = str;
    LN.life = LN.max = dur;
    LN.x = sx;
    LN.y = sy;
    LN.streak = false;
    const night = (R3.dayLevel !== undefined && R3.dayLevel < 0.4) || Fx.tsK > 0.3;
    const w = !!(white || night);
    if (w !== LN.white || LN.wasStreak) {
      LN.white = w;
      LN.wasStreak = false;
      linesA.style.backgroundImage = `url(${lineImgs[w ? 2 : 0]})`;
      linesB.style.backgroundImage = `url(${lineImgs[w ? 3 : 1]})`;
    }
    LN.rot = rnd() * 360;
  };
  Fx.linesAt = function (x, y, h, str, dur, white) {
    const s = proj(x, h, y);
    Fx.lines(s.ok ? s.x : innerWidth / 2, s.ok ? s.y : innerHeight / 2, str, dur, white);
  };
  // штрихи в направлении движения на экране
  Fx.streak = function (screenAng, dur) {
    if (!root) return;
    LN.str = 0.5;
    LN.life = LN.max = dur || 0.2;
    LN.x = innerWidth / 2;
    LN.y = innerHeight / 2;
    LN.streak = true;
    LN.wasStreak = true;
    LN.rot = (screenAng * 180) / Math.PI;
    linesA.style.backgroundImage = `url(${lineImgs[4]})`;
    linesB.style.backgroundImage = `url(${lineImgs[4]})`;
  };
  function updateLines(rdt) {
    if (LN.life <= 0) {
      if (LN.vis) {
        LN.vis = false;
        linesA.style.opacity = linesB.style.opacity = '0';
      }
      return;
    }
    LN.life -= rdt;
    LN.vis = true;
    const k = Math.max(0, LN.life / LN.max);
    const op = (LN.str * Math.min(1, k * 2.5)).toFixed(3);
    LN.fl = (LN.fl + 1) % 4;
    const a = LN.fl < 2;
    const tr = `translate(${(LN.x - innerWidth / 2).toFixed(0)}px,${(LN.y - innerHeight / 2).toFixed(0)}px) rotate(${LN.rot.toFixed(1)}deg)` + (LN.streak ? '' : ` scale(${(1 + (1 - k) * 0.08).toFixed(3)})`);
    linesA.style.transform = tr;
    linesB.style.transform = tr + ' rotate(9deg)';
    linesA.style.opacity = a ? op : '0';
    linesB.style.opacity = a ? '0' : op;
  }

  // ---------- Вспышка экрана ----------
  const FL = { life: 0, max: 0, op: 0 };
  Fx.flash = function (color, dur, op) {
    if (!root || !Fx.set.flash) return;
    flashEl.style.background = color || '#fff';
    FL.life = FL.max = dur || 0.06;
    FL.op = op === undefined ? 0.85 : op;
  };
  function updateFlash(rdt) {
    if (FL.life <= 0) {
      if (FL.vis) {
        FL.vis = false;
        flashEl.style.opacity = '0';
      }
      return;
    }
    FL.vis = true;
    FL.life -= rdt;
    flashEl.style.opacity = (FL.op * Math.max(0, FL.life / FL.max)).toFixed(3);
  }

  // ---------- Кольцо ударной волны (CSS) ----------
  Fx.shockRing = function (x, y, h, scale) {
    if (!root) return;
    const s = proj(x, h, y);
    if (!s.ok) return;
    const r = RINGS.find((o) => !o.act) || RINGS[0];
    r.act = true;
    r.life = 0;
    r.x = s.x;
    r.y = s.y;
    r.sc = scale || 1;
    r.el.style.display = 'block';
  };
  function updateRings(rdt) {
    for (const r of RINGS) {
      if (!r.act) continue;
      r.life += rdt;
      const k = r.life / 0.3;
      if (k >= 1) {
        r.act = false;
        r.el.style.display = 'none';
        continue;
      }
      r.el.style.transform = `translate(${r.x.toFixed(0)}px,${r.y.toFixed(0)}px) translate(-50%,-50%) scale(${((0.2 + 2.2 * J.Anim.EASE.outQuad(k)) * r.sc).toFixed(3)})`;
      r.el.style.opacity = (1 - k).toFixed(3);
    }
  }

  // ---------- Числа урона (слияние: один счётчик на цель) ----------
  Fx.dmgNum = function (t, dmg, crit, rushTick) {
    if (!root) return;
    const p = J.G.player;
    if (!p || J.dist(t.x, t.y, p.x, p.y) > 30) return;
    let o = null;
    for (const n of NUMS) if (n.act && n.t === t && n.life < 0.75) o = n;
    if (!o) {
      o = NUMS.find((n) => !n.act);
      if (!o) {
        o = NUMS[0];
        for (const n of NUMS) if (n.life > o.life) o = n;
      }
      o.act = true;
      o.t = t;
      o.val = 0;
      o.n = 0;
      o.crit = false;
      o.el.className = 'dnum' + (t.isPlayer ? ' hurt' : '');
      o.el.style.display = 'block';
      o.dx = (rnd() - 0.5) * 30;
    }
    o.val += dmg;
    o.n++;
    o.crit = o.crit || crit;
    o.life = 0;
    o.pop = 0.12;
    const txt = (o.n > 1 ? '×' + o.n + '  ' : '') + (o.crit ? '!' : '') + Math.round(o.val);
    if (txt !== o.txt) {
      o.txt = txt;
      o.el.textContent = txt;
      if (o.crit) o.el.classList.add('crit');
    }
  };
  function updateNums(rdt) {
    for (const o of NUMS) {
      if (!o.act) continue;
      o.life += rdt;
      const max = o.n > 1 ? 1.1 : 0.85;
      if (o.life >= max || !o.t) {
        o.act = false;
        o.t = null;
        o.txt = '';
        o.el.style.display = 'none';
        continue;
      }
      const t = o.t;
      const s = proj(t.x, gy(t.x, t.y) + 2.75 * (t.scale || 1) + (t.z || 0) + o.life * 0.5, t.y);
      if (!s.ok) {
        o.el.style.opacity = '0';
        continue;
      }
      o.pop = Math.max(0, o.pop - rdt);
      const sc = 1 + o.pop * 2.5;
      o.el.style.transform = `translate(${(s.x + o.dx).toFixed(0)}px,${s.y.toFixed(0)}px) translate(-50%,-50%) scale(${sc.toFixed(3)})`;
      o.el.style.opacity = (o.life > max - 0.25 ? (max - o.life) / 0.25 : 1).toFixed(3);
    }
  }

  // ---------- 4. GPU-частицы: искры (аддитивные) и пыль ----------
  const PART_VS = `
    uniform float uTime; uniform float uGrav; uniform float uGrow;
    attribute vec3 aP0; attribute vec3 aV; attribute vec2 aT; attribute float aS; attribute vec3 aC;
    varying vec3 vC; varying float vA; varying vec2 vUv;
    void main() {
      float age = uTime - aT.x; float k = age / aT.y;
      vUv = position.xy;
      if (k < 0.0 || k > 1.0) { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); vA = 0.0; vC = aC; return; }
      vec3 p = aP0 + aV * age + vec3(0.0, -uGrav, 0.0) * age * age * 0.5;
      vec4 mv = modelViewMatrix * vec4(p, 1.0);
      #ifdef STRETCH
        vec3 vel = aV + vec3(0.0, -uGrav, 0.0) * age;
        vec3 vv = (modelViewMatrix * vec4(vel, 0.0)).xyz;
        vec2 dir = normalize(vv.xy + vec2(1e-5, 0.0));
        float len = aS * 0.5 + length(vv.xy) * 0.03;
        mv.xy += dir * position.y * len + vec2(-dir.y, dir.x) * position.x * aS * 0.25;
      #else
        float sz = aS * (0.4 + uGrow * k);
        mv.xy += position.xy * sz;
      #endif
      gl_Position = projectionMatrix * mv;
      vC = aC; vA = 1.0 - k;
    }`;
  const PART_FS = `
    varying vec3 vC; varying float vA; varying vec2 vUv;
    void main() {
      #ifdef STRETCH
        float d = 1.0 - length(vUv * vec2(1.6, 1.0));
        if (d <= 0.0) discard;
        gl_FragColor = vec4(vC * vA * (0.4 + d), 1.0);
      #else
        float d = 1.0 - length(vUv);
        if (d <= 0.0) discard;
        gl_FragColor = vec4(vC, vA * d * d * 0.55);
      #endif
    }`;
  function makePart(N, stretch) {
    const g = new THREE.InstancedBufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute([-1, -1, 0, 1, -1, 0, 1, 1, 0, -1, 1, 0], 3));
    g.setIndex([0, 1, 2, 0, 2, 3]);
    const A = {
      aP0: new THREE.InstancedBufferAttribute(new Float32Array(N * 3), 3),
      aV: new THREE.InstancedBufferAttribute(new Float32Array(N * 3), 3),
      aT: new THREE.InstancedBufferAttribute(new Float32Array(N * 2).fill(-99), 2),
      aS: new THREE.InstancedBufferAttribute(new Float32Array(N), 1),
      aC: new THREE.InstancedBufferAttribute(new Float32Array(N * 3), 3),
    };
    for (const k in A) {
      A[k].setUsage(THREE.DynamicDrawUsage);
      g.setAttribute(k, A[k]);
    }
    g.instanceCount = N;
    const m = new THREE.ShaderMaterial({
      uniforms: { uTime: { value: 0 }, uGrav: { value: stretch ? 6 : -0.4 }, uGrow: { value: stretch ? 0 : 1.6 } },
      vertexShader: PART_VS, fragmentShader: PART_FS, defines: stretch ? { STRETCH: 1 } : {},
      transparent: true, depthWrite: false, blending: stretch ? THREE.AdditiveBlending : THREE.NormalBlending,
    });
    const mesh = new THREE.Mesh(g, m);
    mesh.frustumCulled = false;
    mesh.renderOrder = stretch ? 5 : 4;
    R3.scene.add(mesh);
    return { mesh, g, m, A, N, next: 0, lo: 1e9, hi: -1, until: 0 };
  }
  let SPK = null, DST = null;
  const emit = (P, x, h, z, vx, vy, vz, life, size, c) => {
    const i = P.next;
    P.next = (P.next + 1) % P.N;
    const A = P.A;
    A.aP0.array[i * 3] = x;
    A.aP0.array[i * 3 + 1] = h;
    A.aP0.array[i * 3 + 2] = z;
    A.aV.array[i * 3] = vx;
    A.aV.array[i * 3 + 1] = vy;
    A.aV.array[i * 3 + 2] = vz;
    A.aT.array[i * 2] = Fx.simT;
    A.aT.array[i * 2 + 1] = life;
    A.aS.array[i] = size;
    A.aC.array[i * 3] = c.r;
    A.aC.array[i * 3 + 1] = c.g;
    A.aC.array[i * 3 + 2] = c.b;
    if (i < P.lo) P.lo = i;
    if (i > P.hi) P.hi = i;
    P.until = Math.max(P.until, Fx.simT + life);
  };
  const flushPart = (P) => {
    if (P.hi < 0) return;
    for (const k in P.A) {
      const a = P.A[k];
      a.updateRange.offset = P.lo * a.itemSize;
      a.updateRange.count = (P.hi - P.lo + 1) * a.itemSize;
      a.needsUpdate = true;
    }
    P.lo = 1e9;
    P.hi = -1;
  };
  // Искры в точке (x, h, z мира) по направлению ang (на карте) — веером
  Fx.sparks = function (x, h, z, n, ang, color, spd) {
    if (!SPK) return;
    if (Fx.q < 1) n = Math.ceil(n * 0.5);
    tmpC2.set(color || '#ffe9a8');
    const s0 = spd || 7;
    for (let i = 0; i < n; i++) {
      const a = ang === undefined || ang === null ? rnd() * TAU : ang + (rnd() - 0.5) * 2.2;
      const sp = s0 * (0.35 + rnd() * 0.9);
      const up = (rnd() - 0.25) * s0 * 0.7;
      const c = i % 3 === 0 ? tmpC.setRGB(1, 1, 1) : tmpC.copy(tmpC2);
      emit(SPK, x, h, z, Math.cos(a) * sp, up, Math.sin(a) * sp, 0.12 + rnd() * 0.22, 0.05 + rnd() * 0.07, c);
    }
  };
  // Пыль на земле
  Fx.dust = function (x, y, n, r, color) {
    if (!DST) return;
    if (Fx.q < 1) n = Math.ceil(n * 0.5);
    const g = gy(x, y);
    tmpC2.set(color || '#b8ad9a');
    for (let i = 0; i < n; i++) {
      const a = rnd() * TAU, rr = (r || 0.5) * rnd();
      const sp = 0.6 + rnd() * 1.6;
      emit(DST, x + Math.cos(a) * rr, g + 0.15 + rnd() * 0.25, y + Math.sin(a) * rr, Math.cos(a) * sp, 0.3 + rnd() * 0.6, Math.sin(a) * sp, 0.45 + rnd() * 0.3, 0.3 + rnd() * 0.3, tmpC.copy(tmpC2).multiplyScalar(0.85 + rnd() * 0.3));
    }
  };

  // ---------- Звёзды удара (спрайты) ----------
  const STARS = [];
  function makeStarTex() {
    const sc = document.createElement('canvas');
    sc.width = sc.height = 128;
    const sx = sc.getContext('2d');
    sx.translate(64, 64);
    sx.beginPath();
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * TAU, r = i % 2 ? 20 : 62 - (i % 4) * 10;
      sx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
    }
    sx.closePath();
    const gr = sx.createRadialGradient(0, 0, 4, 0, 0, 62);
    gr.addColorStop(0, '#ffffff');
    gr.addColorStop(0.45, '#ffffff');
    gr.addColorStop(1, 'rgba(255,255,255,0)');
    sx.fillStyle = gr;
    sx.fill();
    return new THREE.CanvasTexture(sc);
  }
  Fx.star = function (x, h, z, size, color) {
    if (!STARS.length) return;
    let s = STARS.find((o) => o.life <= 0);
    if (!s) {
      s = STARS[0];
      for (const o of STARS) if (o.life < s.life) s = o;
    }
    s.sp.position.set(x, h, z);
    s.sp.material.rotation = rnd() * TAU;
    s.sp.material.color.set(color || '#fff6c8');
    s.size = size;
    s.life = s.max = 0.2;
    s.sp.visible = true;
  };
  function updateStars(dt) {
    for (const s of STARS) {
      if (s.life <= 0) continue;
      s.life -= dt;
      if (s.life <= 0) {
        s.sp.visible = false;
        continue;
      }
      const k = 1 - s.life / s.max;
      const sz = s.size * (k < 0.4 ? 0.3 + 0.7 * (k / 0.4) : 1);
      s.sp.scale.set(sz, sz, 1);
      s.sp.material.opacity = k < 0.4 ? 1 : 1 - (k - 0.4) / 0.6;
    }
  }

  // ---------- Обломки стен и трещины ----------
  let DEB = null;
  const DP = [];
  const M4 = new THREE.Matrix4(), Q = new THREE.Quaternion(), E3 = new THREE.Euler(), S3 = new THREE.Vector3(), P3 = new THREE.Vector3();
  Fx.debris = function (x, h, z, nx, nz, n, color) {
    if (!DEB) return;
    if (Fx.q < 1) n = Math.ceil(n * 0.5);
    tmpC2.set(color || '#8a8490');
    let k = 0;
    for (const d of DP) {
      if (d.life > 0) continue;
      d.x = x + (rnd() - 0.5) * 0.4;
      d.y = h + (rnd() - 0.3) * 0.8;
      d.z = z + (rnd() - 0.5) * 0.4;
      const sp = 2 + rnd() * 4;
      d.vx = nx * sp + (rnd() - 0.5) * 3;
      d.vy = 1 + rnd() * 4;
      d.vz = nz * sp + (rnd() - 0.5) * 3;
      d.rx = rnd() * 6;
      d.ry = rnd() * 6;
      d.wr = (rnd() - 0.5) * 18;
      d.s = 0.06 + rnd() * 0.1;
      d.life = 1.2;
      d.b = 0;
      DEB.setColorAt(d.i, tmpC.copy(tmpC2).multiplyScalar(0.7 + rnd() * 0.5));
      if (++k >= n) break;
    }
    if (DEB.instanceColor) DEB.instanceColor.needsUpdate = true;
    DEB.visible = true;
  };
  function updateDebris(dt) {
    if (!DEB || !DEB.visible) return;
    let any = false;
    for (const d of DP) {
      if (d.life <= 0) continue;
      d.life -= dt;
      if (d.life <= 0) {
        S3.set(0, 0, 0);
        M4.makeScale(0, 0, 0);
        DEB.setMatrixAt(d.i, M4);
        continue;
      }
      any = true;
      d.vy -= 14 * dt;
      d.x += d.vx * dt;
      d.y += d.vy * dt;
      d.z += d.vz * dt;
      const g = gy(d.x, d.z) + d.s * 0.5;
      if (d.y < g) {
        d.y = g;
        if (d.b++ < 1 && d.vy < -1) {
          d.vy *= -0.35;
          d.vx *= 0.6;
          d.vz *= 0.6;
        } else {
          d.vy = 0;
          d.vx *= 0.8;
          d.vz *= 0.8;
          d.wr *= 0.8;
        }
      }
      d.rx += d.wr * dt;
      d.ry += d.wr * 0.7 * dt;
      const sc = d.s * Math.min(1, d.life * 3);
      E3.set(d.rx, d.ry, 0);
      Q.setFromEuler(E3);
      P3.set(d.x, d.y, d.z);
      S3.set(sc, sc, sc);
      M4.compose(P3, Q, S3);
      DEB.setMatrixAt(d.i, M4);
    }
    DEB.instanceMatrix.needsUpdate = true;
    if (!any) DEB.visible = false;
  }
  const DECALS = [];
  function makeCrackTex() {
    const cv = document.createElement('canvas');
    cv.width = cv.height = 256;
    const c = cv.getContext('2d');
    const R = J.rng(77);
    c.translate(128, 128);
    c.strokeStyle = 'rgba(20,14,24,0.95)';
    c.lineCap = 'round';
    for (let i = 0; i < 11; i++) {
      let a = (i / 11) * TAU + R() * 0.4, r = 6, x = 0, y = 0;
      c.lineWidth = 4;
      c.beginPath();
      c.moveTo(0, 0);
      while (r < 120) {
        r += 10 + R() * 16;
        a += (R() - 0.5) * 0.5;
        x = Math.cos(a) * r;
        y = Math.sin(a) * r;
        c.lineTo(x, y);
        c.lineWidth = Math.max(1, c.lineWidth * 0.8);
      }
      c.stroke();
    }
    c.fillStyle = 'rgba(20,14,24,0.85)';
    c.beginPath();
    c.arc(0, 0, 14, 0, TAU);
    c.fill();
    return new THREE.CanvasTexture(cv);
  }
  Fx.crack = function (x, h, z, nx, nz) {
    if (!DECALS.length) return;
    let d = DECALS.find((o) => o.life <= 0);
    if (!d) {
      d = DECALS[0];
      for (const o of DECALS) if (o.life < d.life) d = o;
    }
    d.m.position.set(x + nx * 0.02, h, z + nz * 0.02);
    d.m.lookAt(x + nx, h, z + nz);
    d.m.rotateZ(rnd() * TAU);
    d.life = 6;
    d.m.material.opacity = 1;
    d.m.visible = true;
  };
  function updateDecals(dt) {
    for (const d of DECALS) {
      if (d.life <= 0) continue;
      d.life -= dt;
      if (d.life <= 0) d.m.visible = false;
      else if (d.life < 1) d.m.material.opacity = d.life;
    }
  }

  // ---------- 5. Шквал кулаков раша (один InstancedMesh на два излучателя) ----------
  let FIST = null;
  const NF = 28;
  const EMIT = [{ u: null, f: [] }, { u: null, f: [] }];
  Fx.fistsOn = function (u) {
    if (!FIST) return;
    for (const em of EMIT) if (em.u === u) return;
    const em = EMIT.find((o) => !o.u || o.u.dead || !o.u.channel);
    if (em) {
      em.u = u;
      for (const f of em.f) f.t = 0;
    }
  };
  function updateFists(dt) {
    if (!FIST) return;
    let n = 0;
    const clash = J.G.clash;
    for (let e = 0; e < 2; e++) {
      const em = EMIT[e];
      const u = em.u;
      if (!u) continue;
      const ch = u.channel;
      if (u.dead || !ch || ch.type !== 'rush' || ch.fin > 0 || ch.done) {
        em.u = null;
        continue;
      }
      if (u.st.timefrozen) {
        // в остановленном времени кулаки висят на месте — пересобираем как есть
      }
      const sv = u.standView;
      const hasSv = sv && sv.group.visible;
      const a = u.face;
      const fx = Math.cos(a), fy = Math.sin(a);
      const ox = hasSv ? sv.pos.x : u.x + fx * 0.6;
      const oz = hasSv ? sv.pos.z : u.y + fy * 0.6;
      const oy = (hasSv ? sv.pos.y : gy(u.x, u.y) + (u.z || 0)) + 1.35 * (hasSv ? 1.18 : 1);
      const sd = u.stand ? J.STANDS[u.stand.id] : null;
      const c1 = sd ? sd.c1 : '#ffd84a', c2 = sd ? sd.c2 : '#fff2a8';
      const reach = clash && (clash.a === u || clash.b === u) ? 0.75 : 1;
      const frozen = !!u.st.timefrozen;
      for (let i = 0; i < NF; i++) {
        let f = em.f[i];
        if (!frozen) f.t -= dt;
        if (f.t <= 0) {
          f.life = f.t = 0.07 + rnd() * 0.07;
          f.ox = (rnd() - 0.5) * 1.0;
          f.oy = -0.25 + rnd() * 0.75;
          f.ext = (0.55 + rnd() * 0.55) * reach;
          f.c = rnd() < 0.5 ? 1 : 2;
          FIST.setColorAt(n, tmpC.set(f.c === 1 ? c1 : c2));
        } else if (f.slot !== n) FIST.setColorAt(n, tmpC.set(f.c === 1 ? c1 : c2));
        f.slot = n;
        const k = 1 - f.t / f.life;
        const ext = f.ext * Math.sin(Math.min(1, k * 1.6) * Math.PI * 0.5);
        P3.set(ox + fx * (0.45 + ext) - fy * f.ox, oy + f.oy, oz + fy * (0.45 + ext) + fx * f.ox);
        E3.set(0, Math.PI / 2 - a, 0);
        Q.setFromEuler(E3);
        S3.set(1.15, 1.15, 0.8 + ext * 0.9);
        M4.compose(P3, Q, S3);
        FIST.setMatrixAt(n, M4);
        n++;
      }
    }
    FIST.count = n;
    FIST.visible = n > 0;
    if (n) {
      FIST.instanceMatrix.needsUpdate = true;
      if (FIST.instanceColor) FIST.instanceColor.needsUpdate = true;
    }
  }

  // ---------- Баннер раша «ОРА ОРА ОРА» ----------
  const CRY_JP = { 'ОРА': 'オラ', 'МУДА': 'ムダ', 'ДОРА': 'ドラ', 'АРИ': 'アリ', 'УРЯ': 'ウリィ', 'ХОРА': 'ホラ' };
  Fx.CRY_JP = CRY_JP;
  Fx.rushStart = function (u, cry) {
    if (!root) return;
    Fx.fistsOn(u);
    const pl = J.G.player;
    if (!nearPlayer(u, null, 25)) return;
    let b = BANS.find((o) => o.u === u) || BANS.find((o) => !o.act) || BANS[0];
    b.u = u;
    b.act = true;
    b.t = 0;
    b.n = 0;
    b.fin = 0;
    b.cry = cry || 'ОРА';
    b.txt = '';
    const sd = u.stand ? J.STANDS[u.stand.id] : null;
    b.el.style.setProperty('--oc', '#fff');
    b.el.style.setProperty('--ok', sd ? sd.c2 : '#c4283c');
    b.el.style.setProperty('--os', (phone() ? 30 : 50) + 'px');
    b.el.style.display = 'block';
    if (u === pl) {
      const jp = CRY_JP[b.cry];
      Fx.column(0, 'ドドドドド', sd ? sd.c1 : '#b06bff', 99);
      Fx.column(1, jp ? jp + jp + jp : 'ドドドド', '#f2c230', 99);
      Fx.yaw(0.45, 99);
      CF.distT = 0.88;
      Fx.fov(-6, 99);
    }
    J.Sfx && J.Sfx.whoosh(0.2, true, 0.1);
  };
  Fx.rushEnd = function (u) {
    const b = BANS.find((o) => o.u === u && o.act);
    if (b) {
      b.fin = 0.5;
      const t = b.cry + 'А'.repeat(4) + '!';
      b.el.textContent = t;
      b.txt = t;
    }
    if (u === J.G.player) {
      Fx.columnOff(0);
      Fx.columnOff(1);
      CF.yawHold = 0.4;
      CF.fovHold = 0.3;
      CF.distT = 1;
    }
  };
  function updateBanners(rdt) {
    const T = performance.now();
    for (const b of BANS) {
      if (!b.act) continue;
      const u = b.u;
      b.t += rdt;
      if (b.fin > 0) {
        b.fin -= rdt;
        if (b.fin <= 0) {
          b.act = false;
          b.u = null;
          b.el.style.display = 'none';
          continue;
        }
      } else if (!u || u.dead || !u.channel || u.channel.type !== 'rush') {
        b.fin = 0.25;
      } else {
        const want = Math.min(6, 1 + Math.floor(b.t / 0.12));
        if (want !== b.n) {
          b.n = want;
          let s = '';
          for (let i = 0; i < want; i++) s += (i ? ' ' : '') + b.cry;
          b.el.textContent = s;
          b.txt = s;
        }
      }
      if (u) {
        const sv = u.standView;
        const hx = sv && sv.group.visible ? sv.pos.x : u.x, hz = sv && sv.group.visible ? sv.pos.z : u.y;
        const hy = (sv && sv.group.visible ? sv.pos.y + 1.9 * 1.18 : gy(u.x, u.y) + 1.9) + 0.8;
        const s = proj(hx, hy, hz);
        if (s.ok) {
          b.x = s.x;
          b.y = s.y;
        }
      }
      const clash = J.G.clash;
      if (clash && (clash.a === u || clash.b === u)) {
        // два баннера давят друг на друга в середине экрана
        const meA = clash.a === u;
        const r = clash.m;
        b.x = innerWidth * (meA ? 0.5 - 0.22 + (r - 0.5) * 0.3 : 0.5 + 0.22 + (r - 0.5) * 0.3);
        b.y = innerHeight * 0.2 + (meA ? 0 : 52);
      }
      const W = innerWidth;
      const sc = b.fin > 0 ? 1.4 : 1;
      const jx = (Math.floor(T / 33) % 2 ? 2 : -2), jy = (Math.floor(T / 47) % 2 ? 2 : -2);
      const scroll = b.n >= 6 && b.fin <= 0 ? -((b.t * 160) % 120) : 0;
      const x = J.clamp(b.x, 120, W - 120);
      const y = J.clamp(b.y, phone() ? 70 : 150, innerHeight * 0.55);
      b.el.style.transform = `translate(${(x + jx + scroll).toFixed(0)}px,${(y + jy).toFixed(0)}px) translate(-50%,-50%) skewX(-10deg) scale(${sc})`;
      b.el.style.opacity = b.fin > 0 ? Math.min(1, b.fin / 0.2).toFixed(3) : '1';
    }
  }

  // ---------- 6. Кадр удара (инверсия, силуэты) и сфера остановки времени ----------
  let invMat = null, invQuad = null, invScene = null, invCam = null, sphere = null, blackMat = null;
  const IF = { n: 0, i: 0, color: '#d8243a', cd: 0 };
  Fx.impactFrame = function (color) {
    if (!Fx.set.flash || IF.cd > 0 || !invMat) return;
    IF.cd = 0.6;
    IF.n = Fx.q >= 1 ? 3 : 1;
    IF.i = 0;
    IF.color = color || '#d8243a';
  };
  const silhouette = (bg) => {
    const sc = R3.scene, cam = R3.camera;
    const ob = sc.background, of = sc.fog;
    sc.background = tmpC.set(bg);
    sc.fog = null;
    sc.overrideMaterial = blackMat;
    cam.layers.set(1);
    R3.renderer.render(sc, cam);
    cam.layers.set(0);
    sc.overrideMaterial = null;
    sc.background = ob;
    sc.fog = of;
  };
  Fx.renderOverride = function () {
    if (IF.n <= 0 || !invQuad) return false;
    const i = IF.i++;
    if (i >= IF.n) {
      IF.n = 0;
      return false;
    }
    if (i === 0) {
      R3.render();
      const r = R3.renderer;
      r.autoClear = false;
      r.render(invScene, invCam);
      r.autoClear = true;
    } else silhouette(IF.color);
    return true;
  };

  // ---------- 7. Остановка времени ----------
  R3.uDesat = R3.uDesat || { value: 0 };
  const TS = (Fx.TS = { ph: null, t: 0, by: null, sx: 0, sy: 0, sh: 0, n: 0, sec: 0, out: 0 });
  Fx.patchWorld = function () {
    // все общие материалы мира получают общий uniform обесцвечивания (до первой отрисовки)
    for (const k in R3) {
      const m = R3[k];
      if (m && m.isMaterial && !m.isPointsMaterial && !m.isShaderMaterial && !m.isRawShaderMaterial) R3.fxPatch(m, R3.uDesat);
    }
    Fx.worldPatched = true;
  };
  Fx.timestopIntro = function (u, dur) {
    TS.ph = 'intro';
    TS.t = 0;
    TS.by = u;
    TS.sec = 0;
    TS.n = 0;
    TS.sx = u.x;
    TS.sy = u.y;
    TS.sh = gy(u.x, u.y) + 1.2;
    const near = nearPlayer(u, null, 40);
    if (near) {
      Fx.hitstop(0.25);
      Fx.punchIn(0.22, 0.5);
      Fx.dutch(0.1, 0.8);
      Fx.fov(-6, 1);
      const sp = u.stand && u.stand.id.indexOf('star_platinum') === 0;
      Fx.wordAt(sp ? 'スタープラチナ・ザ・ワールド!!' : 'ザ・ワールド!!', innerWidth / 2, innerHeight * 0.3, 'ts', '#ffe14a', '#2a0a3a');
      J.Sfx && J.Sfx.timestop();
      Fx.linesAt(u.x, u.y, gy(u.x, u.y) + 1.4, 0.8, 0.8, true);
    }
    // без вспышек сфера не рисуется — мир просто плавно сереет (uDesat), ДИО остаётся цветным
    if (!sphere) J.UI.timestopFx(true);
  };
  function updateTimestop(rdt, dt) {
    const g = J.G;
    const ts = g.timestop;
    if (TS.ph && TS.ph !== 'outro' && !ts) {
      // время пошло
      TS.ph = 'outro';
      TS.t = 0;
      const p = g.player;
      if (p && TS.by && nearPlayer(TS.by, null, 40)) {
        Fx.wordAt('そして時は動き出す…', innerWidth / 2, innerHeight * 0.26, 'md', '#e8e2ff', '#2a0a3a');
        Fx.trauma(0.4);
        J.Sfx && J.Sfx.resume();
      }
      J.UI.timestopFx(false);
    }
    if (ts && TS.ph === null) Fx.timestopIntro(ts.by, ts.t);
    if (!TS.ph) {
      Fx.tsK = Math.max(0, Fx.tsK - rdt * 4);
      return;
    }
    TS.t += rdt;
    const fl = Fx.set.flash && sphere;
    if (TS.ph === 'intro') {
      const k = (TS.t - 0.1) / 0.7;
      if (fl && TS.t >= 0.1 && TS.t < 0.95) {
        const r = TS.t < 0.8 ? 0.3 + 48 * (1 - Math.pow(1 - J.clamp(k, 0, 1), 3)) : 48.3;
        sphere.position.set(TS.sx, TS.sh, TS.sy);
        sphere.scale.setScalar(r);
        sphere.visible = true;
      }
      Fx.tsK = Math.min(1, Fx.tsK + rdt * (fl ? 0.6 : 2));
      if (TS.t >= 0.95) {
        if (sphere) sphere.visible = false;
        Fx.flash('#ffffff', 0.05, 0.9);
        TS.ph = 'hold';
        TS.t = 0;
      }
    } else if (TS.ph === 'hold') {
      Fx.tsK = Math.min(1, Fx.tsK + rdt * 10);
      if (ts && !(ts.intro > 0)) {
        TS.sec += dt > 0 || ts.by === g.player ? rdt : 0;
        if (TS.sec >= 1) {
          TS.sec -= 1;
          TS.n++;
          if (nearPlayer(ts.by, null, 40)) {
            J.Sfx && J.Sfx.tick(TS.n % 2 === 0);
            Fx.wordAt('カチ', innerWidth - (phone() ? 150 : 230), phone() ? 130 : 270, 'tick', '#ffffff', '#1a0a2a');
            const n = TS.n;
            if (ts.by.bossKey === 'dio' || (ts.by.stand && ts.by.stand.id === 'the_world')) Fx.say(ts.by, n + (n === 1 ? ' секунда…' : n < 5 ? ' секунды…' : ' секунд…'));
          }
        }
      }
    } else if (TS.ph === 'outro') {
      const k = TS.t / 0.3;
      if (fl && k < 1) {
        sphere.position.set(TS.sx, TS.sh, TS.sy);
        sphere.scale.setScalar(Math.max(0.01, 40 * (1 - k)));
        sphere.visible = true;
      } else if (sphere) sphere.visible = false;
      Fx.tsK = Math.max(0, Fx.tsK - rdt * 4);
      if (k >= 1 && Fx.tsK <= 0) {
        TS.ph = null;
        TS.by = null;
        if (sphere) sphere.visible = false;
      }
    }
  }
  // Небо и туман — в оттенки серого
  Fx.desatSky = function (k) {
    const sc = R3.scene;
    const bg = sc.background;
    if (bg && bg.isColor) {
      const l = bg.r * 0.299 + bg.g * 0.587 + bg.b * 0.114;
      bg.r += (l * 0.86 - bg.r) * k;
      bg.g += (l * 0.9 - bg.g) * k;
      bg.b += (Math.min(1, l * 1.12) - bg.b) * k;
      if (sc.fog) sc.fog.color.copy(bg);
    }
  };
  // Обесцвечивание: мир — по tsK, персонажи — только застывшие
  function updateDesat() {
    const k = Fx.tsK;
    let world = k;
    const p = J.G.player;
    if (Fx.lowK > 0 && !J.G.timestop) world = Math.max(world, 0.25 * Fx.lowK);
    R3.uDesat.value = world;
    for (const e of J.G.ents) {
      const want = k > 0 && e.st && e.st.timefrozen ? k : e === p ? 0 : k > 0 ? 0 : world;
      setDesat(e.view, want);
      setDesat(e.standView, want);
    }
  }
  const setDesat = (v, val) => {
    if (!v || v.desat === val) return;
    v.desat = val;
    for (const m of v.mats) if (m.userData.fxU) m.userData.fxU.value = val;
  };

  // ---------- 8. Попадания: уровни и агрегатор кадра ----------
  const HITS = [];
  for (let i = 0; i < 24; i++) HITS.push({ t: null, so: null, dmg: 0, tier: '', crit: false, ang: 0, killed: false, kind: '', knock: 0, x: 0, y: 0 });
  let nHits = 0;
  const TIER = {
    tick: { hs: 0, tr: 0.04, sp: 4, word: 0, snd: 0.3 },
    light: { hs: 0.045, tr: 0.12, sp: 8, word: 0.3, snd: 0.45 },
    mid: { hs: 0.075, tr: 0.25, sp: 14, word: 1, snd: 0.7 },
    big: { hs: 0.12, tr: 0.45, sp: 26, word: 1, snd: 1 },
    fin: { hs: 0.18, tr: 0.65, sp: 40, word: 1, snd: 1 },
  };
  const TORD = { tick: 0, light: 1, mid: 2, big: 3, fin: 4 };
  Fx.tierOf = function (t, dmg, opt, crit) {
    if (opt.dot) return null;
    if (opt.fxTier) return opt.fxTier;
    if (opt.rushTick) return 'tick';
    const knock = opt.knock || 0;
    if (opt.finisher || knock >= 7) return 'fin';
    // тяжесть — по силе удара; слабым врагам лёгкий удар не даёт кадра удара
    if (knock >= 5 || (dmg > t.maxHp * 0.35 && knock >= 1.5)) return 'big';
    if (knock >= 2.5 || crit || dmg > t.maxHp * 0.18) return 'mid';
    return 'light';
  };
  // kind: 'hit' | 'block' | 'parry' | 'gbreak' | 'pdodge'
  Fx.onHit = function (t, src, dmg, opt, crit, killed, kind) {
    if (!Fx.ready) return;
    opt = opt || {};
    const tier = kind && kind !== 'hit' ? 'mid' : Fx.tierOf(t, dmg, opt, crit);
    if (!tier) return;
    if (nHits >= HITS.length) return;
    const h = HITS[nHits++];
    h.t = t;
    h.so = src ? J.ownerOf(src) : null;
    h.dmg = dmg;
    h.tier = tier;
    h.crit = crit;
    h.killed = killed;
    h.kind = kind || 'hit';
    h.knock = opt.knock || 0;
    h.ang = opt.ang !== undefined ? opt.ang : h.so ? Math.atan2(t.y - h.so.y, t.x - h.so.x) : rnd() * TAU;
    h.color = opt.fxColor || null;
    h.hamon = opt.kind === 'hamon';
    h.fire = opt.kind === 'fire';
  };
  Fx.flush = function () {
    if (!nHits) return;
    let best = null;
    let nPlayerHits = 0;
    for (let i = 0; i < nHits; i++) {
      const h = HITS[i];
      if (!h.t) continue;
      const rank = (h.kind === 'parry' || h.kind === 'gbreak' ? 5 : TORD[h.tier] || 0) + (h.killed ? 0.5 : 0);
      if (!best || rank > best.rank) {
        best = h;
        best.rank = rank;
      }
      if (h.so && h.so.isPlayer) nPlayerHits++;
      // искры и звёзды у каждой цели (дёшево), остальное — один раз
      const t = h.t;
      const cx = t.x - Math.cos(h.ang) * t.r, cz = t.y - Math.sin(h.ang) * t.r;
      const ch = gy(t.x, t.y) + (t.z || 0) + 1.25 * (t.scale || 1);
      const T = TIER[h.tier];
      const sd = h.so && h.so.stand ? J.STANDS[h.so.stand.id] : null;
      const col = h.kind === 'block' || h.kind === 'parry' ? '#bfe6ff' : h.hamon ? '#ffd84a' : h.fire ? '#ff7b1c' : h.color || (sd ? sd.c2 : '#ffe9a8');
      if (nearPlayer(h.so, t, 30)) {
        Fx.sparks(cx, ch, cz, h.kind === 'parry' ? 30 : T.sp, h.ang + Math.PI, col, h.tier === 'fin' ? 10 : 7);
        if (h.tier !== 'tick' && h.tier !== 'light') Fx.star(cx, ch, cz, h.tier === 'mid' ? 0.7 : h.tier === 'big' ? 1.1 : 1.6, h.kind === 'block' || h.kind === 'parry' ? '#cfeeff' : '#fff6c8');
        else if (h.tier === 'light' && i < 3) Fx.star(cx, ch, cz, 0.45, '#ffffff');
      }
      t.hitAng = h.ang;
    }
    const h = best;
    nHits = 0;
    if (!h) return;
    const t = h.t;
    const p = J.G.player;
    const involved = nearPlayer(h.so, t, 12);
    if (!nearPlayer(h.so, t, 30)) return clearHits();
    const T = TIER[h.tier];
    const cx = t.x - Math.cos(h.ang) * t.r, cz = t.y - Math.sin(h.ang) * t.r;
    const ch = gy(t.x, t.y) + (t.z || 0) + 1.25 * (t.scale || 1);
    const S = J.Sfx;
    if (h.kind === 'block') {
      if (involved) Fx.hitstop(0.05);
      Fx.trauma(involved ? 0.12 : 0.04);
      S && S.block(false);
      if (rnd() < 0.6) Fx.word(Fx.pick('block'), cx, cz, ch, 'mid', '#cfeeff', '#0a2a4a');
      return clearHits();
    }
    if (h.kind === 'parry') {
      if (involved) {
        Fx.hitstop(0.12);
        Fx.slowmo(0.35, 0.45);
      }
      Fx.trauma(0.35);
      Fx.punchIn(0.12, 0.1);
      S && S.parry();
      Fx.word('パリィ!', cx, cz, ch + 0.3, 'big', '#bfe6ff', '#0a2a4a');
      Fx.linesAt(cx, cz, ch, 0.6, 0.35, true);
      Fx.flash('#bfe6ff', 0.06, 0.35);
      return clearHits();
    }
    if (h.kind === 'gbreak') {
      if (involved) Fx.hitstop(0.16);
      Fx.trauma(0.5);
      S && S.guardBreak();
      Fx.word('ガードブレイク!', cx, cz, ch + 0.4, 'big', '#ffffff', '#b3122e');
      Fx.impactFrame('#2a6ad8');
      Fx.linesAt(cx, cz, ch, 0.7, 0.4);
      return clearHits();
    }
    // обычное попадание
    if (involved && T.hs > 0) Fx.hitstop(T.hs * (h.killed ? 1.4 : 1));
    Fx.trauma(involved ? T.tr : T.tr * 0.3);
    if (involved) Fx.kick(h.ang, h.tier === 'light' || h.tier === 'tick' ? 0.04 : 0.07);
    if (S) {
      if (h.tier === 'fin') S.heavy(true);
      else if (h.tier === 'big') S.heavy(false);
      else if (h.tier !== 'tick') S.thud(T.snd, 0);
      if (nPlayerHits >= 3 && h.tier !== 'tick') S.thud(0.6, 0.2);
    }
    if (h.tier === 'big') {
      Fx.punchIn(0.12, 0.08);
      Fx.fov(-4, 0.25);
      if (involved) Fx.impactFrame(t.isPlayer ? '#3a0a14' : '#d8243a');
      Fx.linesAt(cx, cz, ch, 0.45, 0.3);
    } else if (h.tier === 'fin') {
      Fx.punchIn(0.2, 0.12);
      Fx.dutch(0.14, 0.3);
      if (involved) Fx.impactFrame(t.isPlayer ? '#3a0a14' : '#d8243a');
      Fx.linesAt(cx, cz, ch, 0.75, 0.45);
      Fx.shock(t.x, t.y, 1);
    }
    const w = T.word;
    if (w && rnd() < w) {
      const key = h.killed ? 'kill' : h.tier;
      Fx.word(Fx.pick(key), cx, cz, ch, h.killed ? 'kill' : h.tier, h.tier === 'fin' || h.killed ? '#ffffff' : '#ffe14a', h.tier === 'fin' || h.killed ? '#b3122e' : '#1a0a2a');
    }
    if (t.isPlayer) {
      Fx.trauma(0.2 + (0.8 * h.dmg) / t.maxHp);
      Fx.flash('#ff1a3a', 0.12, 0.18);
    }
    clearHits();
  };
  const clearHits = () => {
    for (let i = 0; i < HITS.length; i++) {
      HITS[i].t = null;
      HITS[i].so = null;
    }
    nHits = 0;
  };

  // Ударная волна: кольцо на земле + CSS-кольцо + пыль
  Fx.shock = function (x, y, scale) {
    R3.ring(x, y, 3.5 * (scale || 1), '#ffffff', 0.35);
    Fx.shockRing(x, y, gy(x, y) + 1, scale);
    Fx.dust(x, y, 10, 0.8);
  };
  Fx.land = function (e, hard) {
    Fx.dust(e.x, e.y, hard ? 14 : 8, 0.7);
    if (nearPlayer(e, null, 20)) {
      J.Sfx && J.Sfx.land();
      Fx.trauma(hard ? 0.2 : 0.08);
      if (hard && rnd() < 0.6) Fx.word('ドサッ', e.x, e.y, gy(e.x, e.y) + 0.6, 'mid', '#ffe14a');
    }
  };
  Fx.wallSlam = function (e, nx, ny, color) {
    const h = gy(e.x, e.y) + 1.1 + (e.z || 0);
    const wx = e.x - nx * (e.r + 0.05), wz = e.y - ny * (e.r + 0.05);
    Fx.debris(wx, h, wz, nx, ny, 48, color);
    Fx.crack(wx, h, wz, nx, ny);
    Fx.dust(wx, wz, 8, 0.5, color);
    if (nearPlayer(e, null, 25)) {
      Fx.hitstop(0.1);
      Fx.trauma(0.5);
      Fx.word(Fx.pick('wall'), wx, wz, h + 0.3, 'big', '#ffffff', '#b3122e');
      J.Sfx && J.Sfx.heavy(false);
      J.Sfx && J.Sfx.boom(0.4);
    }
  };
  // Смерть
  Fx.onKill = function (t, killer) {
    if (!Fx.ready) return;
    const p = J.G.player;
    if (!nearPlayer(killer, t, 14)) return;
    if (t.boss) {
      Fx.hitstop(0.3);
      Fx.impactFrame('#d8243a');
      Fx.slowmo(0.15, 1.4, 0.5);
      Fx.wordAt('バーン!', innerWidth / 2, innerHeight * 0.32, 'kill', '#ffffff', '#b3122e');
      Fx.letterbox(1.6);
      Fx.victory(p, 1.6);
      return;
    }
    Fx.hitstop(0.08);
    let last = true;
    for (const o of J.G.ents) if (o !== t && !o.dead && o.team === 'enemy' && J.dist(o.x, o.y, p.x, p.y) < 20) last = false;
    if (last && killer && killer.isPlayer) {
      Fx.slowmo(0.25, 0.8, 0.4);
      Fx.victory(p, 1.2);
    } else Fx.slowmo(0.35, 0.45);
  };
  // Победная поза
  Fx.victory = function (p, dur) {
    if (!p || p.dead || (p.anim && p.anim.t > 0 && p.anim.type !== 'pose')) return;
    J.G.timers.push({
      t: 0.35,
      fn: () => {
        if (p.dead || p.channel || p.guard) return;
        p.anim = { type: 'pose', t: dur, max: dur, victory: true };
        Fx.yaw(0.5, dur);
        Fx.fov(-8, dur);
        if (p.stand && /^star_platinum/.test(p.stand.id) && p.look && p.look.hair === 'cap') Fx.say(p, 'Яре-яре…');
      },
    });
  };
  // Реплика над головой
  Fx.say = function (e, text) {
    R3.text(e.x, e.y, text, 'tsay', 1.6, 2.4 * (e.scale || 1));
  };
  // Блик-предупреждение перед ударом врага
  Fx.glint = function (e) {
    const sv = e.standView && e.standView.group.visible ? e.standView : null;
    const x = sv ? sv.pos.x : e.x, z = sv ? sv.pos.z : e.y;
    const h = (sv ? sv.pos.y + 1.75 * 1.18 : gy(e.x, e.y) + 1.7 * (e.scale || 1)) + (e.z || 0);
    Fx.star(x, h, z, 0.55, '#ffffff');
    if (rnd() < 0.35 && nearPlayer(e, null, 14)) Fx.word('ギラッ', e.x, e.y, h, 'sm', '#ffffff', '#4a0a2a');
  };

  // ---------- 9. Противостояние, фазы боссов, леттербокс ----------
  const LB = { t: 0, on: false };
  Fx.letterbox = function (dur) {
    LB.t = Math.max(LB.t, dur);
  };
  function updateLetterbox(rdt) {
    const on = LB.t > 0;
    if (on) LB.t -= rdt;
    if (on !== LB.on) {
      LB.on = on;
      lbT.classList.toggle('on', on);
      lbB.classList.toggle('on', on);
    }
  }
  const CARD = { t: 0, e: null };
  Fx.standoff = function (e) {
    if (!root || !e) return;
    const p = J.G.player;
    Fx.letterbox(1.8);
    const sd = e.stand ? J.STANDS[e.stand.id] : null;
    const name = e.name + (sd && p && p.stand ? ' 「' + sd.ru + '」' : '');
    cardEl.textContent = name;
    cardEl.style.setProperty('--oc', sd ? sd.c1 : '#ff5d73');
    cardEl.style.display = 'block';
    CARD.t = 2.2;
    CARD.e = e;
    Fx.column(0, 'ゴゴゴゴ', '#b06bff', 2.4);
    Fx.column(1, 'ゴゴゴゴ', '#b06bff', 2.4);
    J.Sfx && J.Sfx.menace(2.5, 0.4);
    Fx.focusOn(e, 1.6);
    Fx.fov(-10, 1.6);
    CF.distT = 0.85;
    J.G.timers.push({ t: 1.6, fn: () => (CF.distT = 1) });
    Fx.so = 1.6;
    const tt = TAUNT[e.bossKey];
    if (tt && tt.aggro) J.G.timers.push({ t: 1.5, fn: () => !e.dead && Fx.say(e, tt.aggro) });
  };
  // отмена противостояния вводом игрока
  Fx.cancelStandoff = function () {
    if (!(Fx.so > 0)) return;
    Fx.so = 0;
    CF.focusHold = 0;
    CF.fovHold = 0;
    CF.distT = 1;
    LB.t = Math.min(LB.t, 0.2);
  };
  function updateCard(rdt) {
    if (CARD.t <= 0) return;
    CARD.t -= rdt;
    if (Fx.so > 0) Fx.so -= rdt;
    const e = CARD.e;
    if (CARD.t <= 0 || !e || e.dead) {
      CARD.t = 0;
      cardEl.style.display = 'none';
      return;
    }
    // подпись выезжает слева над нижней полосой леттербокса, как титр в аниме
    const k = Math.min(1, (2.2 - CARD.t) / 0.25), o = Math.min(1, CARD.t / 0.3);
    const x = -60 * (1 - J.Anim.EASE.outQuad(k));
    cardEl.style.transform = `translateX(${x.toFixed(1)}px) skewX(-8deg)`;
    cardEl.style.opacity = Math.min(k, o).toFixed(3);
  }
  const TAUNT = (Fx.TAUNT = {
    dio: { aggro: 'О? Ты приближаешься ко мне?', ts: 'Это Мир! Время, остановись!', dash: 'Ты думал, это кто-то другой? Это был я — ДИО!', low: 'Ничтожество… как ты посмел!' },
    kira: { aggro: 'Я просто хочу жить спокойной жизнью.', bomb: 'Королева-убийца уже коснулась…', low: 'Ты не отнимешь мой покой!' },
    diavolo: { aggro: 'Никто не узнает моего лица.', skip: 'Только я вижу вершину!', low: 'Я — вершина! Я — Дьяволо!' },
    pucci: { aggro: 'Ты веришь в гравитацию?', low: 'Небеса уже близко…' },
    pucci_mih: { aggro: 'Время ускоряется. Ты не успеешь.', low: 'Мир будет перезапущен!' },
    kars: { aggro: 'Я — совершенство.', low: 'Невозможно!' },
    valentine: { aggro: 'Всё ради моей страны.', low: 'Это не конец… это другой мир!' },
    vanilla: { aggro: 'Ты оскорбил господина ДИО.', low: 'Господин ДИО…' },
  });
  Fx.taunt = function (e, key) {
    const tt = TAUNT[e.bossKey];
    if (!tt || !tt[key]) return;
    if ((e._tauntT || 0) > J.G.t) return;
    e._tauntT = J.G.t + 8;
    Fx.say(e, tt[key]);
  };
  Fx.bossPhase = function (e, text) {
    const sd = e.stand ? J.STANDS[e.stand.id] : null;
    Fx.slowmo(0.3, 0.8);
    Fx.punchIn(0.15, 0.3);
    Fx.column(0, 'ゴゴゴゴ', '#b06bff', 1.6);
    Fx.column(1, 'ゴゴゴゴ', '#b06bff', 1.6);
    R3.ring(e.x, e.y, 4, sd ? sd.c1 : '#ff5fa2', 0.6);
    J.Sfx && J.Sfx.menace(1.6, 0.5);
    Fx.focusOn(e, 1);
  };

  // ---------- 10. Призыв стенда, рывок, низкое здоровье ----------
  Fx.summon = function (e) {
    const sd = J.STANDS[e.stand.id];
    R3.ring(e.x, e.y, 1.6, sd.c1, 0.5);
    for (let i = 0; i < 24; i++) R3.aura(e.x, e.y, gy(e.x, e.y), sd.c1);
    if (nearPlayer(e, null, 20)) {
      Fx.word('ズキュウウン', e.x, e.y, gy(e.x, e.y) + 2.2, 'big', sd.c1, '#1a0a2a');
      J.Sfx && J.Sfx.summon();
      if (e.isPlayer) Fx.punchIn(0.08, 0.2);
    }
  };
  Fx.dodge = function (e, ang) {
    if (!e.isPlayer) return;
    J.Sfx && J.Sfx.whoosh(0.18, true, 0.12);
    // экранное направление рывка
    const yaw = R3.cam.yaw;
    const rel = ang - yaw;
    Fx.streak(-Math.atan2(Math.sin(rel), Math.cos(rel)) + Math.PI / 2, 0.22);
    Fx.dust(e.x, e.y, 6, 0.4);
  };
  Fx.perfectDodge = function (e) {
    Fx.slowmo(0.4, 0.6, 0.3);
    Fx.flash('#7ab8ff', 0.08, 0.3);
    Fx.wordAt('УКЛОНЕНИЕ!', innerWidth / 2, innerHeight * 0.3, 'md', '#bfe6ff', '#0a2a4a');
    Fx.linesAt(e.x, e.y, gy(e.x, e.y) + 1.2, 0.5, 0.5, true);
    J.Sfx && J.Sfx.whoosh(0.35, false, 0.14);
  };
  const LOW = { t: 0 };
  function updateLow(rdt) {
    const p = J.G.player;
    const low = p && !p.dead && p.hp < p.maxHp * 0.25 && J.Game.state === 'play';
    Fx.lowK = J.clamp((Fx.lowK || 0) + (low ? rdt : -rdt) * 2, 0, 1);
    if (low) {
      LOW.t -= rdt;
      if (LOW.t <= 0) {
        LOW.t = 0.9;
        J.Sfx && J.Sfx.heartbeat();
        LOW.pulse = 0.35;
      }
    }
    LOW.pulse = Math.max(0, (LOW.pulse || 0) - rdt * 0.6);
    const op = Fx.lowK * (0.2 + LOW.pulse);
    if (Math.abs(op - (LOW.op || 0)) > 0.01) {
      LOW.op = op;
      lowEl.style.opacity = op.toFixed(3);
    }
  }
  // Смерть игрока: замедление перед экраном «TO BE CONTINUED»
  Fx.playerDeath = function (fn) {
    Fx.slowmo(0.2, 1.0, 0.3);
    Fx.wordAt('バーン!', innerWidth / 2, innerHeight * 0.35, 'kill', '#ffffff', '#b3122e');
    J.G.timers.push({ t: 0.35, fn });
  };

  // ---------- Шкала блока игрока (над головой, пока не полная) ----------
  const GM = { vis: false, w: -1, low: false };
  function updateGuardMeter() {
    const p = J.G.player;
    const show = !!p && !p.dead && (p.guard || (p.gm !== undefined && p.gm < 99.5));
    if (show !== GM.vis) {
      GM.vis = show;
      gmEl.style.display = show ? 'block' : 'none';
    }
    if (!show) return;
    const s = proj(p.x, gy(p.x, p.y) + 2.25 + (p.z || 0), p.y);
    if (s.ok) gmEl.style.transform = `translate(${(s.x - innerWidth / 2).toFixed(0)}px,${(s.y - innerHeight * 0.62).toFixed(0)}px)`;
    const w = Math.round(J.clamp(p.gm === undefined ? 100 : p.gm, 0, 100));
    if (w !== GM.w) {
      GM.w = w;
      gmI.style.width = w + '%';
      const low = w < 30;
      if (low !== GM.low) {
        GM.low = low;
        gmEl.classList.toggle('low', low);
      }
    }
  }

  // ---------- Столкновение рашей ----------
  Fx.clash = function (c) {
    if (!root) return;
    const mine = c.a.isPlayer || c.b.isPlayer;
    clashEl.style.display = mine ? 'block' : 'none';
    clashEl.classList.toggle('touch', !!(J.Input && J.Input.touch));
    const sa = c.a.stand ? J.STANDS[c.a.stand.id] : null, sb = c.b.stand ? J.STANDS[c.b.stand.id] : null;
    clashEl.querySelector('.ca').style.background = sa ? sa.c1 : '#ffd84a';
    clashEl.querySelector('.cb').style.background = sb ? sb.c1 : '#ffd84a';
    Fx.word('ドドドドド', (c.a.x + c.b.x) / 2, (c.a.y + c.b.y) / 2, gy(c.a.x, c.a.y) + 2.4, 'big', '#ffffff', '#b3122e');
    Fx.flash('#ffffff', 0.06, 0.5);
    J.Sfx && J.Sfx.heavy(false);
    if (mine) {
      Fx.focusOn({ x: (c.a.x + c.b.x) / 2, y: (c.a.y + c.b.y) / 2, z: 0 }, 99);
      Fx.fov(-6, 99);
    }
  };
  Fx.clashEnd = function () {
    if (!root) return;
    clashEl.style.display = 'none';
    CF.focusHold = 0;
    CF.fovHold = 0;
  };
  function updateClash(rdt) {
    const c = J.G.clash;
    if (!c) return;
    const mx = (c.a.x + c.b.x) / 2, mz = (c.a.y + c.b.y) / 2;
    const h = gy(mx, mz) + 1.55;
    if (CF.focus && CF.focusHold > 50) {
      CF.focus.x = mx;
      CF.focus.y = mz;
    }
    c.fxT = (c.fxT || 0) - rdt;
    if (c.fxT <= 0) {
      c.fxT = 0.05;
      const a = Math.atan2(c.b.y - c.a.y, c.b.x - c.a.x);
      Fx.sparks(mx, h, mz, 12, a + Math.PI / 2, '#ffffff', 8);
      Fx.sparks(mx, h, mz, 8, a - Math.PI / 2, '#ffe14a', 8);
      if (rnd() < 0.4) Fx.star(mx, h + (rnd() - 0.5) * 0.4, mz, 0.8 + rnd() * 0.6, '#ffffff');
      Fx.trauma(0.06);
      J.Sfx && J.Sfx.rushTick(rnd() - 0.5);
    }
    if (c.a.isPlayer || c.b.isPlayer) {
      const me = c.a.isPlayer ? 'a' : 'b';
      const r = me === 'a' ? c.m : 1 - c.m;
      clashEl.querySelector('.ca').style.width = (c.m * 100).toFixed(1) + '%';
      clashEl.querySelector('.cb').style.width = ((1 - c.m) * 100).toFixed(1) + '%';
      clashEl.classList.toggle('win', r > 0.6);
      clashEl.classList.toggle('lose', r < 0.4);
    }
  }


  // ---------- Стирание времени (Король Багрового) ----------
  Fx.timeskip = function (u, on) {
    if (!Fx.ready || !nearPlayer(u, null, 40)) return;
    if (on) {
      Fx.column(0, 'ドドドド', '#c4283c', 99);
      Fx.column(1, 'ドドドド', '#c4283c', 99);
      J.Sfx && J.Sfx.menace(3, 0.5);
      Fx.punchIn(0.1, 0.3);
      Fx.wordAt('キング・クリムゾン!!', innerWidth / 2, innerHeight * 0.3, 'big', '#ffffff', '#b3122e');
    } else {
      Fx.columnOff(0);
      Fx.columnOff(1);
      Fx.flash('#000000', 0.12, 1);
      Fx.hitstop(0.12);
      Fx.trauma(0.45);
      Fx.wordAt('ドン!', innerWidth / 2, innerHeight * 0.36, 'big', '#ffffff', '#b3122e');
      J.Sfx && J.Sfx.heavy(false);
    }
  };

  // ---------- Дорожный каток ДИО ----------
  let rollerGeo = null;
  R3.roller = function () {
    if (!rollerGeo) {
      const gb = new J.GB();
      const Y = new THREE.Color('#e8b81c'), D = new THREE.Color('#2a2630'), Gr = new THREE.Color('#6a6a72'), Wd = new THREE.Color('#bfe6ff');
      const M = (x, y, z) => new THREE.Matrix4().makeTranslation(x, y, z);
      gb.geo(new THREE.BoxGeometry(2.2, 1.3, 3.0), M(0, 1.15, -0.2), Y);
      gb.geo(new THREE.BoxGeometry(1.6, 0.9, 1.1), M(0, 2.2, -0.6), Y);
      gb.geo(new THREE.BoxGeometry(1.5, 0.5, 0.05), M(0, 2.3, -0.04), Wd);
      gb.geo(new THREE.CylinderGeometry(0.75, 0.75, 2.3, 16).rotateZ(Math.PI / 2), M(0, 0.75, 1.55), Gr);
      gb.geo(new THREE.CylinderGeometry(0.6, 0.6, 2.3, 14).rotateZ(Math.PI / 2), M(0, 0.6, -1.4), D);
      gb.geo(new THREE.BoxGeometry(2.0, 0.12, 0.6), M(0, 1.85, 1.55), Y);
      rollerGeo = gb.build();
    }
    const m = new THREE.Mesh(rollerGeo, new THREE.MeshLambertMaterial({ vertexColors: true }));
    m.castShadow = true;
    m.rotation.y = rnd() * TAU;
    R3.fxGroup.add(m);
    return m;
  };

  // ---------- Инициализация ----------
  Fx.applySettings = function (s) {
    s = s || (J.Game && J.Game.settings) || {};
    const rm = !!s.fx_rm;
    Fx.set.shake = rm ? 0 : s.fx_shake === undefined ? 1 : +s.fx_shake;
    Fx.set.flash = !rm && s.fx_flash !== false;
    Fx.set.slowmo = !rm && s.fx_slowmo !== false;
    Fx.q = s.fx_q === undefined ? (s.quality === 0 ? 0 : 1) : +s.fx_q;
  };
  Fx.init = function () {
    if (Fx.ready) return;
    Fx.applySettings();
    buildDom();
    measureSafe();
    window.addEventListener('resize', measureSafe);
    const sc = R3.scene;
    SPK = makePart(256, true);
    DST = makePart(64, false);
    const starTex = makeStarTex();
    for (let i = 0; i < 6; i++) {
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: starTex, blending: THREE.AdditiveBlending, depthWrite: false, depthTest: false, transparent: true }));
      sp.visible = false;
      sp.renderOrder = 998;
      sc.add(sp);
      STARS.push({ sp, life: 0, max: 0.2, size: 1 });
    }
    // обломки
    DEB = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshLambertMaterial({ color: '#ffffff' }), 48);
    DEB.frustumCulled = false;
    DEB.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    M4.makeScale(0, 0, 0);
    for (let i = 0; i < 48; i++) {
      DEB.setMatrixAt(i, M4);
      DEB.setColorAt(i, tmpC.set('#8a8490'));
      DP.push({ i, life: 0 });
    }
    DEB.visible = false;
    sc.add(DEB);
    const crackTex = makeCrackTex();
    const cg = new THREE.PlaneGeometry(1.7, 1.7);
    for (let i = 0; i < 6; i++) {
      const m = new THREE.Mesh(cg, new THREE.MeshBasicMaterial({ map: crackTex, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4 }));
      m.visible = false;
      sc.add(m);
      DECALS.push({ m, life: 0 });
    }
    // кулаки
    const gb = new J.GB();
    const W = new THREE.Color(1, 1, 1);
    gb.geo(new THREE.BoxGeometry(0.15, 0.13, 0.16), new THREE.Matrix4(), W);
    gb.geo(new THREE.CylinderGeometry(0.05, 0.06, 0.42, 6).rotateX(Math.PI / 2), new THREE.Matrix4().makeTranslation(0, 0, -0.27), W);
    FIST = new THREE.InstancedMesh(gb.build(), new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.7, depthWrite: false }), NF * 2);
    FIST.frustumCulled = false;
    FIST.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    for (let i = 0; i < NF * 2; i++) FIST.setColorAt(i, W);
    FIST.count = 0;
    FIST.visible = false;
    sc.add(FIST);
    for (const em of EMIT) for (let i = 0; i < NF; i++) em.f.push({ t: 0, life: 0.1, ox: 0, oy: 0, ext: 0, c: 1, slot: -1 });
    // инверсия
    invMat = new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.BackSide, depthTest: false, depthWrite: false, transparent: true, blending: THREE.CustomBlending, blendEquation: THREE.AddEquation, blendSrc: THREE.OneMinusDstColorFactor, blendDst: THREE.ZeroFactor, fog: false });
    sphere = new THREE.Mesh(new THREE.SphereGeometry(1, 32, 16), invMat);
    sphere.renderOrder = 999;
    sphere.frustumCulled = false;
    sphere.visible = false;
    sc.add(sphere);
    const qm = invMat.clone();
    qm.side = THREE.FrontSide;
    invQuad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), qm);
    invQuad.frustumCulled = false;
    invScene = new THREE.Scene();
    invScene.add(invQuad);
    invCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    blackMat = new THREE.MeshBasicMaterial({ color: 0x0b0610, fog: false });
    Fx.warm();
    Fx.ready = true;
  };
  // Компиляция шейдеров эффектов заранее: первый кадр удара или раш не должны давать фриз
  Fx.warm = function () {
    const r = R3.renderer, sc = R3.scene, cam = R3.camera;
    const objs = [SPK.mesh, DST.mesh, DEB, FIST, sphere];
    for (const s of STARS) objs.push(s.sp);
    for (const d of DECALS) objs.push(d.m);
    const vis = objs.map((o) => o.visible);
    for (const o of objs) o.visible = true;
    FIST.count = 1;
    const tmp = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 0.1), blackMat);
    tmp.position.set(0, -60, 0);
    sc.add(tmp);
    try {
      r.compile(sc, cam);
      r.compile(invScene, invCam);
    } catch (e) {}
    sc.remove(tmp);
    tmp.geometry.dispose();
    objs.forEach((o, i) => (o.visible = vis[i]));
    FIST.count = 0;
  };

  // Слой 1 — для силуэтного кадра удара
  Fx.layerView = (v) => {
    if (v && v.group) v.group.traverse((o) => o.layers.enable(1));
  };

  // ---------- Главное обновление (реальное время rdt, игровое dt) ----------
  Fx.update = function (rdt, dt) {
    if (!Fx.ready) return;
    const frozenPart = Fx.tsK > 0.5;
    Fx.simT += frozenPart ? 0 : dt;
    if (SPK) {
      SPK.m.uniforms.uTime.value = Fx.simT;
      DST.m.uniforms.uTime.value = Fx.simT;
      flushPart(SPK);
      flushPart(DST);
      SPK.mesh.visible = SPK.until > Fx.simT;
      DST.mesh.visible = DST.until > Fx.simT;
    }
    IF.cd -= rdt;
    updateStars(dt);
    updateDebris(frozenPart ? 0 : dt);
    updateDecals(rdt);
    updateFists(dt);
    updateTimestop(rdt, dt);
    updateDesat();
    updateWords(rdt);
    updateCols(rdt);
    updateLines(rdt);
    updateFlash(rdt);
    updateRings(rdt);
    updateNums(rdt);
    updateBanners(rdt);
    updateClash(rdt);
    updateLetterbox(rdt);
    updateCard(rdt);
    updateLow(rdt);
    updateGuardMeter();
    if (J.Sfx) J.Sfx.setSlow(Fx.scale < 0.95 ? 1 - Fx.scale : 0);
    // камера в бою на телефоне — ближе
    const p = J.G.player;
    if (J.Input && J.Input.touch && p && p.inCombat > 0 && !(Fx.so > 0) && !J.G.clash && CF.distT === 1) R3.cam.distMul += (6.8 / 8.5 - R3.cam.distMul) * Math.min(1, rdt * 2);
    // слой виден только когда что-то есть
    const busy = GM.vis || LN.vis || FL.vis || LB.on || CARD.t > 0 || J.G.clash || LOW.op > 0.01 || WORDS.some((o) => o.act) || COLS.some((o) => o.act) || BANS.some((o) => o.act) || NUMS.some((o) => o.act) || RINGS.some((o) => o.act);
    if (busy !== Fx._vis) {
      Fx._vis = busy;
      root.style.visibility = busy ? 'visible' : 'hidden';
    }
  };
  // Сброс при смене сцены (новая игра, загрузка)
  Fx.reset = function () {
    Fx.hs = 0;
    Fx.slow = null;
    Fx.tsK = 0;
    TS.ph = null;
    R3.uDesat.value = 0;
    if (sphere) sphere.visible = false;
    for (const o of WORDS) {
      o.act = false;
      o.el.style.display = 'none';
    }
    for (const o of COLS) {
      o.act = false;
      o.el.style.display = 'none';
    }
    for (const o of BANS) {
      o.act = false;
      o.u = null;
      o.el.style.display = 'none';
    }
    for (const o of NUMS) {
      o.act = false;
      o.t = null;
      o.el.style.display = 'none';
    }
    for (const em of EMIT) em.u = null;
    for (const d of DECALS) {
      d.life = 0;
      d.m.visible = false;
    }
    for (const d of DP) d.life = 0;
    if (DEB) {
      M4.makeScale(0, 0, 0);
      for (const d of DP) DEB.setMatrixAt(d.i, M4);
      DEB.instanceMatrix.needsUpdate = true;
      DEB.visible = false;
    }
    LB.t = 0;
    CARD.t = 0;
    if (cardEl) cardEl.style.display = 'none';
    Fx.clashEnd();
    CF.trauma = CF.punch = CF.roll = CF.rollT = CF.kickX = CF.kickV = 0;
    CF.focus = null;
    CF.distT = 1;
    clearHits();
  };
})();
