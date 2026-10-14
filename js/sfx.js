'use strict';
// Синтезированные боевые звуки на WebAudio: удары, раш, блок, парирование, свист, остановка времени, ゴゴゴ.
// Только осцилляторы, шум и фильтры — никаких файлов. Контекст создаётся по первому жесту игрока (iOS).
(function () {
  const Sfx = (J.Sfx = { ac: null, slow: 0 });
  let master = null, lp = null, comp = null, room = null, noiseBuf = null;
  const last = {}; // защита от одинаковых звуков чаще 25 мс
  const ends = []; // время окончания активных голосов
  const MAXV = 24;

  Sfx.init = function () {
    const unlock = () => {
      Sfx.ensure();
      if (Sfx.ac && Sfx.ac.state === 'suspended') Sfx.ac.resume().catch(() => {});
    };
    ['pointerdown', 'keydown', 'touchstart'].forEach((ev) => window.addEventListener(ev, unlock, { passive: true }));
  };
  Sfx.ensure = function () {
    if (Sfx.ac) return Sfx.ac;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      const ac = new AC();
      master = ac.createGain();
      master.gain.value = 0.8;
      lp = ac.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = 20000;
      comp = ac.createDynamicsCompressor();
      comp.threshold.value = -16;
      comp.ratio.value = 4;
      master.connect(lp).connect(comp).connect(ac.destination);
      // «комната» для тяжёлых ударов: короткая задержка с обратной связью
      const dl = ac.createDelay(0.2);
      dl.delayTime.value = 0.07;
      const fb = ac.createGain();
      fb.gain.value = 0.3;
      const rf = ac.createBiquadFilter();
      rf.type = 'lowpass';
      rf.frequency.value = 2000;
      room = ac.createGain();
      room.gain.value = 0.5;
      room.connect(dl);
      dl.connect(rf).connect(fb).connect(dl);
      rf.connect(master);
      const n = ac.sampleRate;
      noiseBuf = ac.createBuffer(1, n, n);
      const d = noiseBuf.getChannelData(0);
      for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
      Sfx.ac = ac;
    } catch (e) {
      Sfx.ac = null;
    }
    return Sfx.ac;
  };
  const enabled = () => Sfx.ac && master && (!J.Game || !J.Game.settings || J.Game.settings.sound) && !document.hidden;
  // Можно ли запустить звук: лимит голосов и антидребезг
  const voice = (name, dur, prio) => {
    if (!enabled()) return null;
    const ac = Sfx.ac;
    const now = ac.currentTime;
    if (last[name] !== undefined && now - last[name] < 0.025) return null;
    let n = 0;
    for (let i = 0; i < ends.length; i++) if (ends[i] > now) ends[n++] = ends[i];
    ends.length = n;
    if (n >= MAXV && !prio) return null;
    last[name] = now;
    ends.push(now + dur);
    return now;
  };
  const env = (g, t, a, peak, dec) => {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), t + a);
    g.gain.exponentialRampToValueAtTime(0.0001, t + a + dec);
  };
  const noise = (t, dur) => {
    const s = Sfx.ac.createBufferSource();
    s.buffer = noiseBuf;
    s.loop = true;
    const off = Math.random() * 0.5;
    s.start(t, off);
    s.stop(t + dur + 0.05);
    return s;
  };
  const panner = (pan) => {
    const ac = Sfx.ac;
    if (ac.createStereoPanner) {
      const p = ac.createStereoPanner();
      p.pan.value = J.clamp(pan || 0, -1, 1);
      p.connect(master);
      return p;
    }
    const g = ac.createGain();
    g.connect(master);
    return g;
  };
  const osc = (type, f0, f1, t, dur) => {
    const o = Sfx.ac.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(f0, t);
    if (f1 && f1 !== f0) o.frequency.exponentialRampToValueAtTime(f1, t + dur);
    o.start(t);
    o.stop(t + dur + 0.05);
    return o;
  };

  // ---------- Рецепты ----------
  // Удар: синус с падением тона + шлепок шума + щелчок. power 0..1
  const thudAt = (t, power, pan, gain) => {
    const ac = Sfx.ac;
    const out = panner(pan);
    const pr = 1 + (Math.random() - 0.5) * 0.16;
    const G = (gain || 1) * 4.4 * 0.18;
    const o = osc('sine', 120 * pr, 42 * pr, t, 0.09 + power * 0.08);
    const og = ac.createGain();
    env(og, t, 0.003, 0.55 * power * G, 0.09 + power * 0.12);
    o.connect(og).connect(out);
    const n = noise(t, 0.15);
    const f = ac.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.setValueAtTime(700 + power * 1600, t);
    f.frequency.exponentialRampToValueAtTime(200, t + 0.1);
    const ng = ac.createGain();
    env(ng, t, 0.002, 0.7 * power * G, 0.05 + power * 0.06);
    n.connect(f).connect(ng).connect(out);
    const c = noise(t, 0.02);
    const hp = ac.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 3200;
    const cg = ac.createGain();
    env(cg, t, 0.001, 0.25 * power * G, 0.012);
    c.connect(hp).connect(cg).connect(out);
    return out;
  };
  Sfx.thud = function (power = 0.5, pan = 0) {
    const t = voice('thud', 0.3);
    if (t === null) return;
    thudAt(t, power, pan);
  };
  Sfx.heavy = function (boom) {
    const t = voice('heavy', 0.8, true);
    if (t === null) return;
    const ac = Sfx.ac;
    const out = thudAt(t, 1, 0, 2.3 / 4.4);
    const o = osc('sine', 70, 28, t, 0.45);
    const g = ac.createGain();
    env(g, t, 0.005, 0.5, 0.45);
    o.connect(g).connect(master);
    g.connect(room);
    const n = noise(t, 0.05);
    const bp = ac.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 2500;
    bp.Q.value = 0.9;
    const ng = ac.createGain();
    env(ng, t, 0.001, 0.4, 0.035);
    n.connect(bp).connect(ng).connect(out);
    if (boom) Sfx.boom(0.6);
  };
  Sfx.whoosh = function (dur = 0.18, up = true, gain = 0.12) {
    const t = voice('whoosh', dur);
    if (t === null) return;
    const ac = Sfx.ac;
    const n = noise(t, dur);
    const bp = ac.createBiquadFilter();
    bp.type = 'bandpass';
    bp.Q.value = 1.4;
    bp.frequency.setValueAtTime(up ? 350 : 2600, t);
    bp.frequency.exponentialRampToValueAtTime(up ? 2600 : 350, t + dur);
    const g = ac.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain * 3, t + dur * 0.6);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    n.connect(bp).connect(g).connect(master);
  };
  // Набор силы для заряженного удара: восходящий гул
  Sfx.charge = function (dur = 0.8) {
    const t = voice('charge', dur);
    if (t === null) return;
    const ac = Sfx.ac;
    const o = osc('sawtooth', 70, 210, t, dur);
    const f = ac.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.setValueAtTime(300, t);
    f.frequency.exponentialRampToValueAtTime(1600, t + dur);
    const g = ac.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.09, t + dur * 0.8);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.05);
    o.connect(f).connect(g).connect(master);
  };
  // Раш: подкачиваем удары небольшими порциями, пока он идёт
  Sfx.rushTick = function (pan) {
    const t = voice('rush' + (pan > 0 ? 'r' : 'l'), 0.25);
    if (t === null) return;
    thudAt(t + Math.random() * 0.012, 0.32 + Math.random() * 0.12, pan, 0.3 / 0.18 / 4.4 * 1.6);
  };
  Sfx.block = function (bright) {
    const t = voice('block', 0.25, true);
    if (t === null) return;
    const ac = Sfx.ac;
    const fs = bright ? [1610, 2330, 3480] : [1210, 1745, 2630];
    fs.forEach((f, i) => {
      const o = osc('square', f, f, t, 0.2);
      const bp = ac.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.value = f;
      bp.Q.value = 12;
      const g = ac.createGain();
      env(g, t, 0.001, (bright ? 0.32 : 0.22) / (i + 1), bright ? 0.32 : 0.16);
      o.connect(bp).connect(g).connect(master);
    });
    thudAt(t, 0.3, 0, 0.6);
  };
  // Парирование: звонкий лязг + свист
  Sfx.parry = function () {
    Sfx.block(true);
    Sfx.whoosh(0.25, false, 0.1);
  };
  // Пробитие блока: треск стекла + низкий удар
  Sfx.guardBreak = function () {
    const t = voice('gbreak', 0.6, true);
    if (t === null) return;
    const ac = Sfx.ac;
    const n = noise(t, 0.4);
    const hp = ac.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.setValueAtTime(5000, t);
    hp.frequency.exponentialRampToValueAtTime(1500, t + 0.35);
    const g = ac.createGain();
    env(g, t, 0.002, 0.35, 0.35);
    n.connect(hp).connect(g).connect(master);
    thudAt(t, 0.9, 0, 0.7);
  };
  Sfx.boom = function (power = 1) {
    const t = voice('boom', 1.2, true);
    if (t === null) return;
    const ac = Sfx.ac;
    const n = noise(t, 0.9);
    const f = ac.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.setValueAtTime(900, t);
    f.frequency.exponentialRampToValueAtTime(120, t + 0.8);
    const g = ac.createGain();
    env(g, t, 0.004, 0.75 * power, 0.8);
    n.connect(f).connect(g).connect(master);
    g.connect(room);
    const o = osc('sine', 60, 30, t, 0.9);
    const og = ac.createGain();
    env(og, t, 0.004, 0.6 * power, 0.9);
    o.connect(og).connect(master);
  };
  Sfx.land = function () {
    const t = voice('land', 0.3);
    if (t === null) return;
    thudAt(t, 0.6, 0, 0.9);
    const ac = Sfx.ac;
    const n = noise(t, 0.25);
    const f = ac.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = 500;
    const g = ac.createGain();
    env(g, t, 0.01, 0.2, 0.22);
    n.connect(f).connect(g).connect(master);
  };
  Sfx.summon = function () {
    const t = voice('summon', 1, true);
    if (t === null) return;
    Sfx.whoosh(0.35, true, 0.12);
    const ac = Sfx.ac;
    [880, 1320, 1760].forEach((f, i) => {
      const o = osc('sine', f, f, t + 0.1, 0.9);
      const lfo = osc('sine', 7 + i, 7 + i, t + 0.1, 0.9);
      const lg = ac.createGain();
      lg.gain.value = f * 0.01;
      lfo.connect(lg).connect(o.frequency);
      const g = ac.createGain();
      g.gain.setValueAtTime(0.0001, t + 0.1);
      g.gain.exponentialRampToValueAtTime(0.08 / (i + 1), t + 0.3);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.95);
      o.connect(g).connect(master);
    });
  };
  Sfx.tick = function (tock) {
    const t = voice('tick', 0.05, true);
    if (t === null) return;
    const ac = Sfx.ac;
    for (const [dt, f] of [[0, tock ? 1800 : 2300], [0.011, tock ? 1500 : 1900]]) {
      const n = noise(t + dt, 0.012);
      const bp = ac.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.value = f;
      bp.Q.value = 8;
      const g = ac.createGain();
      env(g, t + dt, 0.0008, 0.6, 0.012);
      n.connect(bp).connect(g).connect(master);
    }
  };
  // Остановка времени: обратный нарастающий шум → обрыв → бум и гонг
  Sfx.timestop = function () {
    const t = voice('ts', 3, true);
    if (t === null) return;
    const ac = Sfx.ac;
    const n = noise(t, 0.7);
    const f = ac.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.setValueAtTime(200, t);
    f.frequency.exponentialRampToValueAtTime(7000, t + 0.65);
    const g = ac.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.5, t + 0.65);
    g.gain.setValueAtTime(0.0001, t + 0.66);
    n.connect(f).connect(g).connect(master);
    const T = t + 0.66;
    const b = osc('sine', 70, 32, T, 1.2);
    const bg = ac.createGain();
    env(bg, T, 0.004, 0.7, 1.3);
    b.connect(bg).connect(master);
    [220, 311.1, 466].forEach((fq, i) => {
      const o = osc(i === 2 ? 'triangle' : 'sine', fq, fq, T, 2.3);
      const og = ac.createGain();
      env(og, T, 0.01, 0.18 / (i + 1), 2.2);
      o.connect(og).connect(master);
    });
  };
  // Время снова движется: светлый нарастающий шум и свист
  Sfx.resume = function () {
    const t = voice('resume', 0.6, true);
    if (t === null) return;
    const ac = Sfx.ac;
    const n = noise(t, 0.3);
    const hp = ac.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.setValueAtTime(3000, t);
    hp.frequency.exponentialRampToValueAtTime(600, t + 0.25);
    const g = ac.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.3, t + 0.22);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.3);
    n.connect(hp).connect(g).connect(master);
    Sfx.whoosh(0.3, true, 0.12);
  };
  // ゴゴゴ: гул из расстроенных пил с тремоло
  Sfx.menace = function (dur = 2.5, gain = 0.38) {
    const t = voice('menace', dur, true);
    if (t === null) return;
    const ac = Sfx.ac;
    const f = ac.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = 190;
    const trem = ac.createGain();
    trem.gain.value = 0.5;
    const lfo = osc('sine', 6, 6, t, dur);
    const lg = ac.createGain();
    lg.gain.value = 0.4;
    lfo.connect(lg).connect(trem.gain);
    const g = ac.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.35 * gain, t + 0.5);
    g.gain.setValueAtTime(0.35 * gain, t + Math.max(0.6, dur - 0.6));
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    f.connect(trem).connect(g).connect(master);
    [55, 55.7, 82.4].forEach((fq) => osc('sawtooth', fq, fq, t, dur).connect(f));
  };
  // Сердцебиение при низком здоровье
  Sfx.heartbeat = function () {
    const t = voice('heart', 0.5);
    if (t === null) return;
    const ac = Sfx.ac;
    [0, 0.18].forEach((d, i) => {
      const o = osc('sine', 60, 45, t + d, 0.16);
      const g = ac.createGain();
      env(g, t + d, 0.01, i ? 0.22 : 0.3, 0.15);
      o.connect(g).connect(master);
    });
  };
  // Щелчок детонатора Королевы
  Sfx.click = function () {
    const t = voice('click', 0.1, true);
    if (t === null) return;
    Sfx.tick(false);
    setTimeout(() => Sfx.tick(true), 70);
  };

  // ---------- Звуки сверхспособностей ----------
  // полосовой шум с огибающей (основа для огня, воды, ветра)
  const band = (t, dur, f0, f1, Q, peak, a, type) => {
    const ac = Sfx.ac;
    const n = noise(t, dur);
    const f = ac.createBiquadFilter();
    f.type = type || 'bandpass';
    f.Q.value = Q;
    f.frequency.setValueAtTime(f0, t);
    f.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    const g = ac.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + a);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    n.connect(f).connect(g).connect(master);
    return g;
  };
  // Рёв пламени
  Sfx.fire = function (power = 1) {
    const t = voice('fire', 0.9);
    if (t === null) return;
    band(t, 0.8 * power, 300, 900, 0.7, 0.32 * power, 0.12, 'lowpass');
    band(t, 0.5, 1800, 600, 1.2, 0.08 * power, 0.05);
  };
  // Электрический треск
  Sfx.zap = function (power = 1) {
    const t = voice('zap', 0.5);
    if (t === null) return;
    const ac = Sfx.ac;
    for (let i = 0; i < 5; i++) {
      const d = t + i * 0.035 + Math.random() * 0.02;
      const o = osc('square', 90 + Math.random() * 300, 60, d, 0.05);
      const g = ac.createGain();
      env(g, d, 0.001, 0.09 * power, 0.04);
      o.connect(g).connect(master);
    }
    band(t, 0.25, 5000, 2500, 0.8, 0.16 * power, 0.005, 'highpass');
  };
  // Лёд: хрустальный звон
  Sfx.ice = function () {
    const t = voice('ice', 0.8);
    if (t === null) return;
    const ac = Sfx.ac;
    [2637, 3520, 4186, 3136].forEach((f, i) => {
      const d = t + i * 0.03;
      const o = osc('sine', f, f * 0.995, d, 0.6);
      const g = ac.createGain();
      env(g, d, 0.002, 0.06, 0.55);
      o.connect(g).connect(master);
    });
    band(t, 0.2, 6000, 3000, 1, 0.1, 0.003, 'highpass');
  };
  // Вода: всплеск
  Sfx.water = function () {
    const t = voice('water', 0.6);
    if (t === null) return;
    band(t, 0.45, 2400, 500, 1.5, 0.22, 0.02);
    band(t + 0.05, 0.3, 900, 300, 2, 0.12, 0.03);
  };
  // Хлёст лозы / нити
  Sfx.whip = function () {
    const t = voice('whip', 0.4);
    if (t === null) return;
    band(t, 0.18, 800, 5000, 1.6, 0.18, 0.12);
    const ac = Sfx.ac;
    const c = noise(t + 0.17, 0.02);
    const g = ac.createGain();
    env(g, t + 0.17, 0.001, 0.25, 0.02);
    c.connect(g).connect(master);
  };
  // Стекло: изумруды, осколки, зеркала
  Sfx.glass = function () {
    const t = voice('glass', 0.5);
    if (t === null) return;
    const ac = Sfx.ac;
    for (let i = 0; i < 3; i++) {
      const f = 3000 + Math.random() * 3000;
      const d = t + i * 0.025;
      const o = osc('triangle', f, f, d, 0.3);
      const g = ac.createGain();
      env(g, d, 0.001, 0.05, 0.25);
      o.connect(g).connect(master);
    }
  };
  // Рука стирает пространство: «гаон»
  Sfx.erase = function () {
    const t = voice('erase', 0.8, true);
    if (t === null) return;
    const ac = Sfx.ac;
    const o = osc('sawtooth', 220, 40, t, 0.35);
    const f = ac.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.setValueAtTime(1800, t);
    f.frequency.exponentialRampToValueAtTime(150, t + 0.35);
    const g = ac.createGain();
    env(g, t, 0.005, 0.32, 0.35);
    o.connect(f).connect(g).connect(master);
    band(t, 0.25, 4000, 200, 0.9, 0.2, 0.01);
  };
  // Молния-застёжка: быстрая трещотка
  Sfx.zip = function (up = true) {
    const t = voice('zip', 0.5);
    if (t === null) return;
    const ac = Sfx.ac;
    for (let i = 0; i < 14; i++) {
      const d = t + i * 0.018;
      const n = noise(d, 0.006);
      const bp = ac.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.value = (up ? 1800 + i * 120 : 3400 - i * 120);
      bp.Q.value = 6;
      const g = ac.createGain();
      env(g, d, 0.0005, 0.35, 0.006);
      n.connect(bp).connect(g).connect(master);
    }
  };
  // Выстрел
  Sfx.shot = function (power = 1) {
    const t = voice('shot', 0.4);
    if (t === null) return;
    band(t, 0.12, 3000, 800, 0.6, 0.35 * power, 0.002, 'lowpass');
    thudAt(t, 0.4 * power, 0, 0.6);
  };
  // Звук Эха: пружинящее «бойнг»
  Sfx.word = function () {
    const t = voice('word', 0.5);
    if (t === null) return;
    const ac = Sfx.ac;
    const o = osc('sine', 300, 120, t, 0.35);
    const lfo = osc('sine', 18, 18, t, 0.35);
    const lg = ac.createGain();
    lg.gain.value = 60;
    lfo.connect(lg).connect(o.frequency);
    const g = ac.createGain();
    env(g, t, 0.005, 0.2, 0.33);
    o.connect(g).connect(master);
  };
  // Жизнь / исцеление: светлый аккорд
  Sfx.life = function () {
    const t = voice('life', 1);
    if (t === null) return;
    const ac = Sfx.ac;
    [523, 659, 784, 1046].forEach((f, i) => {
      const d = t + i * 0.06;
      const o = osc('sine', f, f, d, 0.8);
      const g = ac.createGain();
      env(g, d, 0.02, 0.05, 0.7);
      o.connect(g).connect(master);
    });
  };
  // Гул заряда силы (короткий)
  Sfx.power = function (dur = 0.4) {
    const t = voice('power', dur);
    if (t === null) return;
    const ac = Sfx.ac;
    const o = osc('sawtooth', 110, 330, t, dur);
    const f = ac.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.setValueAtTime(400, t);
    f.frequency.exponentialRampToValueAtTime(2400, t + dur);
    const g = ac.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.07, t + dur * 0.85);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.05);
    o.connect(f).connect(g).connect(master);
  };
  // Гром
  Sfx.thunder = function () {
    const t = voice('thunder', 2, true);
    if (t === null) return;
    Sfx.zap(1.2);
    band(t + 0.02, 1.6, 1200, 60, 0.5, 0.6, 0.01, 'lowpass');
  };
  // Замедление: глушим верха
  Sfx.setSlow = function (k) {
    if (!Sfx.ac || !lp) return;
    const want = k > 0.05 ? 900 + (1 - k) * 4000 : 20000;
    if (Math.abs(want - Sfx.slow) < 50) return;
    Sfx.slow = want;
    try {
      lp.frequency.setTargetAtTime(want, Sfx.ac.currentTime, 0.06);
    } catch (e) {}
  };
})();
