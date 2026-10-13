'use strict';
// Анимация скелета: позы и клипы ударов, боевая стойка, команды стенду, реакции на попадания, позы ДжоДжо.
// Поза — Float32Array из 20 каналов (радианы). Слои: ходьба → стойка → действие → реакция → блок.
// Без выделений памяти в кадре: только модульные массивы.
(function () {
  const A = (J.Anim = {});
  const CH = ['legL', 'legR', 'shinL', 'shinR', 'armL', 'armR', 'armLz', 'armRz', 'foreL', 'foreR', 'spX', 'spY', 'spZ', 'hdX', 'hdY', 'hdZ', 'drop', 'rootX', 'legLz', 'legRz'];
  const N = CH.length;
  const I = {};
  CH.forEach((c, i) => (I[c] = i));
  const LEGL = 0, LEGR = 1, SHINL = 2, SHINR = 3, ARML = 4, ARMR = 5, ARMLZ = 6, ARMRZ = 7, FOREL = 8, FORER = 9;
  const SPX = 10, SPY = 11, SPZ = 12, HDX = 13, HDY = 14, HDZ = 15, DROP = 16, ROOTX = 17, LEGLZ = 18, LEGRZ = 19;
  const pose = (o, base) => {
    const a = new Float32Array(N);
    if (base) a.set(base);
    for (const k in o) a[I[k]] = o[k];
    return a;
  };
  const P = (A.POSE = {});
  P.zero = pose({});
  P.guard = pose({ armL: -1.0, armR: -0.75, armLz: -0.2, armRz: 0.25, foreL: -2.0, foreR: -2.1, spY: 0.35, legL: -0.3, legR: 0.25, shinL: 0.3, shinR: 0.35, drop: -0.04 });
  const G = P.guard;
  P.jabCh = pose({ armL: -0.7, foreL: -2.3, spY: 0.5 }, G);
  P.jabEx = pose({ armL: -1.57, foreL: -0.05, armLz: 0, armR: -0.8, foreR: -2.1, spY: -0.25, legL: -0.45, legR: 0.35, shinR: 0.3, hdY: 0.15, drop: -0.06 }, G);
  P.crossEx = pose({ armR: -1.57, foreR: -0.05, armL: -0.9, foreL: -2.1, spY: -0.6, legL: -0.4, legR: 0.45, shinR: 0.45, drop: -0.08 }, G);
  P.hookEx = pose({ armR: -1.35, armRz: 1.25, foreR: -1.45, spY: -0.75, spZ: -0.1, legL: -0.35, legR: 0.3 }, G);
  P.upCh = pose({ armR: 0.25, foreR: -1.9, spX: 0.25, drop: -0.16, shinL: 0.6, shinR: 0.6, legL: -0.35, legR: -0.15 }, G);
  P.upEx = pose({ armR: -2.7, foreR: -0.45, spX: -0.2, spY: -0.3, drop: 0.02, legR: 0.25, hdX: -0.2 }, G);
  P.heavyCh = pose({ armR: 0.65, armRz: 0.4, foreR: -2.0, spY: 0.75, spX: 0.1, legL: -0.5, legR: 0.4, shinL: 0.45, shinR: 0.5, drop: -0.12 }, G);
  P.heavyEx = pose({ armR: -1.62, foreR: 0, armL: 0.2, foreL: -1.2, spY: -0.85, spX: 0.18, legL: -0.65, legR: 0.55, shinR: 0.6, drop: -0.14 }, G);
  P.kickCh = pose({ legR: -0.6, shinR: 1.6, legL: 0.1, shinL: 0.3, spX: -0.1, armL: -0.8, armR: -0.4 }, G);
  P.kickEx = pose({ legR: -1.45, shinR: 0.08, legL: 0.12, shinL: 0.25, spX: -0.22, armL: -0.6, armLz: -0.6, armR: 0.3, armRz: 0.5 }, G);
  P.command = pose({ armR: -1.5, foreR: -0.05, armL: 0.15, armLz: -0.25, foreL: -0.9, spY: 0.45, legL: -0.2, legR: 0.3, shinR: 0.25 });
  P.pockets = pose({ armL: 0.15, armLz: -0.1, foreL: -0.6, armR: 0.15, armRz: 0.1, foreR: -0.6, spX: -0.05, hdX: 0.08, legL: -0.12, legR: 0.18, shinR: 0.15 });
  P.cast = pose({ armR: -1.45, armL: -1.45, foreR: -0.2, foreL: -0.2, spX: 0.1 });
  P.block = pose({ armL: -1.75, armR: -1.75, armLz: 0.75, armRz: -0.75, foreL: -1.55, foreR: -1.55, spX: 0.15, hdX: 0.2, legL: -0.25, legR: 0.2, shinL: 0.3, shinR: 0.3, drop: -0.08 });
  P.flinch = pose({ spX: -0.3, hdX: -0.55, armL: 0.35, armR: 0.25, armLz: -0.5, armRz: 0.55, legR: -0.35, shinR: 0.45 });
  P.stagger = pose({ spX: -0.45, spZ: 0.25, hdX: -0.4, hdZ: 0.3, armL: 0.5, armLz: -0.9, armRz: 1.0, legL: 0.4, legR: -0.5, shinL: 0.5, shinR: 0.7, drop: -0.1 });
  P.gbreak = pose({ spX: -0.55, spZ: -0.15, hdX: -0.7, armL: -2.2, armR: -2.4, armLz: -0.7, armRz: 0.8, foreL: -0.4, foreR: -0.3, legL: 0.45, legR: -0.35, shinL: 0.6, shinR: 0.5, drop: -0.12 });
  P.launch = pose({ armL: 0.5, armR: 0.7, armLz: -1.1, armRz: 1.2, foreL: -0.3, foreR: -0.2, legL: -0.7, legR: 0.2, shinL: 0.9, shinR: 0.3, spX: -0.5, hdX: -0.6 });
  P.down = pose({ rootX: -1.5708, armL: -2.6, armR: -2.4, armLz: -0.4, armRz: 0.5, legR: 0.1, shinL: 0.4, hdY: 0.5 });
  P.dead = pose({ rootX: -1.5708, armL: -2.9, armR: -1.6, armLz: -0.9, armRz: 0.4, foreL: -0.3, foreR: -0.8, legL: -0.1, legR: 0.25, legLz: -0.15, legRz: 0.2, shinL: 0.5, shinR: 0.1, hdY: 0.7, hdZ: 0.2 });
  P.crouch = pose({ drop: -0.3, shinL: 1.2, shinR: 1.0, legL: -0.9, legR: -0.6, spX: 0.4, armL: -0.6, armR: -0.3 });
  P.slump = pose({ drop: -0.55, legL: -1.5, legR: -1.4, shinL: 0.2, shinR: 0.4, spX: -0.3, hdX: 0.4, armL: 0.3, armR: 0.2 });
  // рывки
  P.dodgeF = pose({ spX: 0.45, armL: 0.6, armR: 0.6, foreL: -0.4, foreR: -0.4, legL: -0.8, legR: 0.6, shinR: 0.9, drop: -0.08 });
  P.dodgeB = pose({ spX: -0.2, armL: -0.9, armR: -0.7, foreL: -1.9, foreR: -2.0, legL: 0.4, legR: -0.5, shinL: 0.6, shinR: 0.3, drop: -0.05 });
  P.dodgeS = pose({ spZ: 0.4, armL: -0.8, armR: -0.6, foreL: -1.8, foreR: -1.9, legL: -0.5, legR: 0.5, legLz: -0.3, legRz: 0.3, shinL: 0.4, shinR: 0.4, drop: -0.1 });
  // стенд
  P.stIdle = pose({ armL: 0.18, armR: 0.18, armLz: -0.22, armRz: 0.22, foreL: -0.5, foreR: -0.5, legL: 0.25, legR: -0.05, shinL: 0.5, shinR: 0.25 });
  P.stGuard = pose({ armL: -0.95, armR: -0.6, armLz: -0.25, armRz: 0.3, foreL: -1.9, foreR: -2.0, spY: 0.3, spX: 0.12, legL: 0.3, legR: -0.1, shinL: 0.6, shinR: 0.35 });
  P.stCross = pose({ armL: -0.25, armR: -0.25, armLz: 0.9, armRz: -0.9, foreL: -1.7, foreR: -1.7, spX: -0.08, hdX: -0.1, legL: 0.25, legR: -0.05, shinL: 0.5, shinR: 0.25 });
  // позы ДжоДжо
  P.jotaro = pose({ armR: -1.55, foreR: -0.02, armL: -2.6, armLz: -0.35, foreL: -1.9, spY: 0.55, spZ: -0.08, legL: -0.45, legR: 0.35, shinR: 0.55, hdX: 0.15 });
  P.dio = pose({ armL: -0.4, armR: -0.4, armLz: -1.35, armRz: 1.35, foreL: -0.6, foreR: -0.6, spX: -0.35, spY: -0.25, spZ: 0.1, hdX: -0.3, legR: 0.4, shinR: 0.3 });
  P.giorno = pose({ armR: -0.9, armRz: -0.6, foreR: -1.9, armL: -1.2, armLz: -0.9, foreL: -0.3, spZ: 0.18, spY: 0.3, legLz: 0.25, legL: 0.15, legR: -0.1, hdZ: -0.15 });
  P.josuke = pose({ armR: -2.9, foreR: -1.7, armL: 0.1, armLz: -0.4, foreL: -1.5, spX: -0.15, spZ: -0.12, legL: -0.3, legR: 0.45, shinR: 0.4 });
  P.kira = pose({ armR: -2.3, armRz: 0.3, foreR: -2.4, armL: -0.3, armLz: -0.3, foreL: -1.8, spY: -0.3, spZ: 0.08, hdX: 0.2, hdY: -0.3, legL: -0.15, legR: 0.25, shinR: 0.2 });
  A.JOJO = ['jotaro', 'dio', 'giorno', 'josuke'];

  // ---------- Сглаживания и клипы ----------
  const EASE = {
    lin: (x) => x,
    in: (x) => x * x * x,
    outQuad: (x) => 1 - (1 - x) * (1 - x),
    outExpo: (x) => (x >= 1 ? 1 : 1 - Math.pow(2, -10 * x)),
    outBack: (x) => 1 + 2.70158 * Math.pow(x - 1, 3) + 1.70158 * Math.pow(x - 1, 2),
    inOut: (x) => (x < 0.5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2),
  };
  A.EASE = EASE;
  const CLIP = (A.CLIP = {
    jab: { dur: 0.22, hit: 0.32, K: [[0, G], [0.22, P.jabCh, 'in'], [0.32, P.jabEx, 'outExpo'], [0.55, P.jabEx], [1, G, 'inOut']] },
    cross: { dur: 0.26, hit: 0.36, K: [[0, G], [0.2, P.jabCh, 'in'], [0.36, P.crossEx, 'outExpo'], [0.6, P.crossEx], [1, G, 'inOut']] },
    hook: { dur: 0.3, hit: 0.42, K: [[0, G], [0.28, P.heavyCh, 'in'], [0.42, P.hookEx, 'outExpo'], [0.65, P.hookEx], [1, G, 'inOut']] },
    upper: { dur: 0.36, hit: 0.45, K: [[0, G], [0.32, P.upCh, 'in'], [0.45, P.upEx, 'outBack'], [0.72, P.upEx], [1, G, 'inOut']] },
    heavy: { dur: 0.5, hit: 0.42, K: [[0, G], [0.36, P.heavyCh, 'outQuad'], [0.42, P.heavyEx, 'outExpo'], [0.7, P.heavyEx], [1, G, 'inOut']] },
    kick: { dur: 0.42, hit: 0.4, K: [[0, G], [0.3, P.kickCh, 'in'], [0.4, P.kickEx, 'outExpo'], [0.65, P.kickEx], [1, G]] },
    getup: { dur: 0.45, hit: 1, K: [[0, P.down], [0.55, P.crouch, 'outQuad'], [1, G, 'outBack']] },
  });
  A.CHAIN = ['jab', 'cross', 'hook', 'upper'];
  // Выборка клипа в момент k (0..1) в out
  A.sample = function (clip, k, out) {
    const K = clip.K;
    if (k <= 0) return out.set(K[0][1]);
    if (k >= 1) return out.set(K[K.length - 1][1]);
    let i = 1;
    while (i < K.length - 1 && K[i][0] < k) i++;
    const t0 = K[i - 1][0], t1 = K[i][0];
    const u = t1 > t0 ? J.clamp((k - t0) / (t1 - t0), 0, 1) : 1;
    const e = (EASE[K[i][2] || 'inOut'] || EASE.inOut)(u);
    const a = K[i - 1][1], b = K[i][1];
    for (let c = 0; c < N; c++) out[c] = a[c] + (b[c] - a[c]) * e;
  };

  // ---------- Рабочие массивы ----------
  const BASE = new Float32Array(N), ACT = new Float32Array(N), OUT = new Float32Array(N), TMP = new Float32Array(N);
  const lerpInto = (out, b, w) => {
    if (w <= 0) return;
    if (w >= 1) return out.set(b);
    for (let c = 0; c < N; c++) out[c] += (b[c] - out[c]) * w;
  };
  const addInto = (out, b, w) => {
    for (let c = 0; c < N; c++) out[c] += b[c] * w;
  };
  const approach = (cur, want, step) => (cur < want ? Math.min(want, cur + step) : Math.max(want, cur - step));

  // ДжоДжо-поза персонажа
  A.jojoPose = function (e) {
    if (e.jojo) return e.jojo;
    let k;
    if (e.bossKey === 'dio' || e.origin === 'brando') k = 'dio';
    else if (e.bossKey === 'kira') k = 'kira';
    else if (e.origin === 'joestar') k = 'jotaro';
    else if (e.origin === 'born') k = 'giorno';
    else {
      let h = 0;
      const s = e.name || '';
      for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
      k = A.JOJO[Math.abs(h) % A.JOJO.length];
    }
    return (e.jojo = k);
  };

  // Ходьба (как раньше), записывает в out
  function loco(v, e, sw, spd, t, out) {
    out.fill(0);
    const amp = J.clamp(spd / 4.4, 0.55, 1.35);
    const moving = spd > 0.2;
    const cw = moving ? Math.cos(v.phase) : 0;
    out[LEGL] = sw * 0.62 * amp;
    out[LEGR] = -sw * 0.62 * amp;
    out[SHINL] = moving ? 0.1 + Math.max(0, -cw) * 0.95 * amp : 0.04;
    out[SHINR] = moving ? 0.1 + Math.max(0, cw) * 0.95 * amp : 0.04;
    out[ARML] = -sw * 0.5 * amp;
    out[ARMR] = sw * 0.5 * amp;
    out[FOREL] = out[FORER] = moving ? -0.35 - 0.3 * (amp - 0.5) : -0.12;
    out[ARMLZ] = -0.09;
    out[ARMRZ] = 0.09;
    out[SPX] = moving ? 0.04 + (amp > 1.1 ? 0.12 : 0) : 0;
    out[DROP] = moving && !e.mount ? Math.abs(Math.sin(v.phase)) * 0.035 * amp : Math.sin(t * 2 + (v.phase || 0)) * 0.004;
    if (e.mount) {
      out[LEGL] = out[LEGR] = -1.35;
      out[SHINL] = out[SHINR] = 1.45;
      out[LEGLZ] = -0.35;
      out[LEGRZ] = 0.35;
    }
  }

  // Какой клип играет действие e.anim
  function actionClip(e) {
    const an = e.anim;
    if (an.clip) return an.clip;
    if (an.type === 'heavy') return 'heavy';
    if (an.type === 'kick') return 'kick';
    if (an.type === 'punch') return A.CHAIN[((e.combo | 0) + 3) % 4];
    return null;
  }
  A.actionClip = actionClip;

  // Реакция на удар: записывает поверх out, возвращает смещения
  const RX = { jit: 0, lie: 0 };
  function reaction(e, out, t) {
    RX.jit = 0;
    RX.lie = 0;
    const r = e.react;
    if (!r) return;
    const k = r.max > 0 ? J.clamp(r.t / r.max, 0, 1) : 1;
    switch (r.type) {
      case 'jitter':
        RX.jit = Math.sin(t * 190) * 0.03 * (1 - k);
        break;
      case 'flinch':
        addInto(out, P.flinch, Math.sin(Math.PI * k) * (r.amp || 1));
        break;
      case 'block': {
        const s = Math.sin(Math.PI * k);
        out[SPX] -= 0.12 * s;
        out[HDX] -= 0.1 * s;
        out[DROP] -= 0.03 * s;
        break;
      }
      case 'stagger':
      case 'parried':
      case 'gbreak': {
        const env = k < 0.2 ? EASE.outQuad(k / 0.2) : 1 - EASE.inOut((k - 0.2) / 0.8);
        lerpInto(out, r.type === 'gbreak' ? P.gbreak : P.stagger, env);
        // два шага назад
        const st = Math.sin(r.t * 18) * 0.35 * env;
        out[LEGL] += st;
        out[LEGR] -= st;
        break;
      }
      case 'launch':
      case 'air': {
        out.set(P.launch);
        const ak = e.airDur > 0 ? J.clamp((e.airT || 0) / e.airDur, 0, 1) : k;
        out[ROOTX] = (e.airSpin || -1.5708) * EASE.outQuad(ak);
        break;
      }
      case 'death': {
        // падение назад
        out.set(P.launch);
        lerpInto(out, P.dead, EASE.in(k));
        out[ROOTX] = -1.5708 * EASE.in(k);
        RX.lie = EASE.in(k);
        break;
      }
      case 'down':
        out.set(P.down);
        RX.lie = 1;
        break;
      case 'dead':
        out.set(P.dead);
        RX.lie = 1;
        break;
      case 'getup':
        A.sample(CLIP.getup, k, out);
        RX.lie = 1 - EASE.outQuad(Math.min(1, k / 0.55));
        break;
      case 'slump': {
        const env = Math.min(1, k * 6);
        lerpInto(out, P.slump, env);
        break;
      }
    }
  }

  // Применение позы к каркасу
  function apply(v, O, jit, lie) {
    v.legL.rotation.x = O[LEGL];
    v.legR.rotation.x = O[LEGR];
    v.legL.rotation.z = O[LEGLZ];
    v.legR.rotation.z = O[LEGRZ];
    if (v.shinL) {
      v.shinL.rotation.x = O[SHINL];
      v.shinR.rotation.x = O[SHINR];
    }
    v.armL.rotation.x = O[ARML];
    v.armR.rotation.x = O[ARMR];
    v.armL.rotation.z = O[ARMLZ];
    v.armR.rotation.z = O[ARMRZ];
    if (v.foreL) {
      v.foreL.rotation.x = O[FOREL];
      v.foreR.rotation.x = O[FORER];
    }
    const rx = O[ROOTX];
    if (v.spine) {
      v.spine.rotation.set(O[SPX], O[SPY], O[SPZ]);
      v.body.rotation.set(rx, 0, 0);
    } else v.body.rotation.set(rx + O[SPX] * 0.6, O[SPY], O[SPZ]);
    if (v.head) v.head.rotation.set(O[HDX], O[HDY], O[HDZ]);
    // вращение вокруг центра масс (0, 0.9, 0); лёжа центр масс опускается к земле
    const comH = 0.9 - 0.74 * lie;
    v.body.position.set(jit, O[DROP] + comH - 0.9 * Math.cos(rx), -0.9 * Math.sin(rx));
  }
  A.apply = apply;

  // ---------- Человек ----------
  A.rig = function (v, e, sw, spd, t, dt) {
    loco(v, e, sw, spd, t, BASE);
    OUT.set(BASE);
    // боевая стойка
    const fight = (e.inCombat > 0 || e.guard) && !e.mount && !e.dead;
    v.cw = approach(v.cw || 0, fight ? 1 : 0, dt / 0.15);
    if (v.cw > 0) lerpInto(OUT, G, v.cw * J.clamp(1 - spd / 3, 0, 1));
    // рывок
    if (e.dash && e.dodgeDir) lerpInto(OUT, e.dodgeDir === 'f' ? P.dodgeF : e.dodgeDir === 'b' ? P.dodgeB : P.dodgeS, 0.85);
    if (e.dash && e.dodgeDir === 's') OUT[SPZ] *= e.dodgeSide || 1;
    // действие
    const an = e.anim && e.anim.t > 0 ? e.anim : null;
    let w = 0;
    if (an) {
      const k = J.clamp(1 - an.t / an.max, 0, 1);
      const byStand = an.stand && e.standOut && e.stand && !e.dead;
      const clip = actionClip(e);
      if (an.type === 'pose') ACT.set(P[an.pose || A.jojoPose(e)] || P.jotaro);
      else if (byStand) ACT.set(an.type === 'cast' ? P.cast : e.capUser ? P.pockets : P.command);
      else if (an.type === 'rush') {
        // без стенда (хамон): сам молотит руками
        ACT.set(G);
        const ph = t * 12;
        const pl = ph - Math.floor(ph), pr = ph + 0.5 - Math.floor(ph + 0.5);
        ACT[ARML] = -0.9 - 0.7 * (pl < 0.35 ? EASE.outExpo(pl / 0.35) : 1 - EASE.inOut((pl - 0.35) / 0.65));
        ACT[ARMR] = -0.9 - 0.7 * (pr < 0.35 ? EASE.outExpo(pr / 0.35) : 1 - EASE.inOut((pr - 0.35) / 0.65));
        ACT[FOREL] = -1.6 - ACT[ARML] * 0.9;
        ACT[FORER] = -1.6 - ACT[ARMR] * 0.9;
        ACT[SPX] = 0.25;
      } else if (clip && CLIP[clip]) A.sample(CLIP[clip], k, ACT);
      else if (an.type === 'cast') ACT.set(P.cast);
      else ACT.set(G);
      v.aw = approach(v.aw || 0, 1, dt / 0.04);
      w = v.aw;
    } else {
      v.aw = approach(v.aw || 0, 0, dt / 0.08);
      w = v.aw;
      if (w > 0 && v.lastAct) ACT.set(v.lastAct);
    }
    if (w > 0) {
      lerpInto(OUT, ACT, w);
      if (an) (v.lastAct || (v.lastAct = new Float32Array(N))).set(ACT);
    }
    // заряд тяжёлого удара
    if (e.chg) {
      const ck = J.clamp(e.chg.t / 0.25, 0, 1);
      lerpInto(OUT, e.standOut && e.stand ? P.command : P.heavyCh, ck);
      if (!(e.standOut && e.stand)) OUT[DROP] += Math.sin(t * 60) * 0.006 * ck;
    }
    // блок
    v.gw = approach(v.gw || 0, e.guard && !e.dead ? 1 : 0, dt / 0.07);
    if (v.gw > 0) {
      if (e.standOut && e.stand) {
        TMP.set(G);
        TMP[SPX] = -0.1;
        TMP[HDX] = 0.12;
        lerpInto(OUT, TMP, v.gw);
      } else lerpInto(OUT, P.block, v.gw);
    }
    reaction(e, OUT, t);
    apply(v, OUT, RX.jit, RX.lie);
  };

  // ---------- Стенд ----------
  A.stand = function (sv, e, attacking, t, dt) {
    const fight = e.inCombat > 0 || e.guard || attacking;
    sv.cw = approach(sv.cw || 0, fight ? 1 : 0, dt / 0.2);
    OUT.set(P.stIdle);
    if (sv.cw > 0) lerpInto(OUT, P.stGuard, sv.cw);
    // лёгкое парение рук
    OUT[ARML] += Math.sin(t * 2) * 0.05;
    OUT[ARMR] -= Math.sin(t * 2) * 0.05;
    const an = attacking ? e.anim : null;
    let rushing = false;
    if (an) {
      const k = J.clamp(1 - an.t / an.max, 0, 1);
      if (an.type === 'rush') {
        rushing = true;
        OUT.set(P.stGuard);
        const ph = t * 12;
        for (let s = 0; s < 2; s++) {
          const pp = ph + s * 0.5 - Math.floor(ph + s * 0.5);
          const ext = pp < 0.35 ? EASE.outExpo(pp / 0.35) : 1 - EASE.inOut((pp - 0.35) / 0.65);
          OUT[s ? ARMR : ARML] = -0.9 - 0.7 * ext;
          OUT[s ? FORER : FOREL] = -2.0 + 1.95 * ext;
          OUT[s ? ARMRZ : ARMLZ] = (s ? 1 : -1) * (0.15 - 0.1 * ext);
          (s ? sv.armR : sv.armL).scale.y = 1 + 0.35 * ext;
        }
        OUT[SPX] = 0.35;
        OUT[SPY] = Math.sin(t * 24) * 0.12;
        OUT[DROP] = Math.sin(t * 188) * 0.02;
        // финишер: замах правой
        if (e.channel && e.channel.fin > 0) {
          lerpInto(OUT, P.heavyCh, 1);
          sv.armR.scale.y = 1;
        }
      } else {
        const clip = actionClip(e) || (an.type === 'cast' ? null : 'cross');
        if (clip && CLIP[clip]) {
          A.sample(CLIP[clip], k, ACT);
          // стенд бьёт размашистее: ×1.25 от стойки
          for (let c = 0; c < N; c++) OUT[c] = G[c] + (ACT[c] - G[c]) * 1.25;
          OUT[DROP] = ACT[DROP];
        } else OUT.set(P.cast);
      }
    }
    if (!rushing) {
      sv.armL.scale.y = 1;
      sv.armR.scale.y = 1;
    }
    if (e.chg && !an) {
      const ck = J.clamp(e.chg.t / 0.25, 0, 1);
      lerpInto(OUT, P.heavyCh, ck);
      OUT[SPY] += Math.sin(t * 50) * 0.03 * ck;
    }
    sv.gw = approach(sv.gw || 0, e.guard ? 1 : 0, dt / 0.06);
    if (sv.gw > 0) lerpInto(OUT, P.block, sv.gw);
    // стенд вздрагивает вместе с хозяином
    const r = e.react;
    RX.jit = 0;
    if (r && r.max > 0) {
      const k = J.clamp(r.t / r.max, 0, 1);
      if (r.type === 'flinch' || r.type === 'jitter') addInto(OUT, P.flinch, Math.sin(Math.PI * k) * 0.6);
      else if (r.type === 'block') OUT[SPX] -= 0.15 * Math.sin(Math.PI * k);
      else if (r.type === 'stagger' || r.type === 'parried' || r.type === 'gbreak') lerpInto(OUT, P.stagger, Math.sin(Math.PI * k));
    }
    OUT[ROOTX] = 0;
    apply(sv, OUT, 0, 0);
  };
})();
