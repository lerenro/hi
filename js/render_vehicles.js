'use strict';
// Отрисовка транспорта: низкополигональные модели машин (геометрия строится один раз на тип+цвет и делится),
// все колёса — один InstancedMesh, пятна фар ночью — один InstancedMesh, фара машины игрока — один SpotLight.
// Сигналы светофоров (горящая секция) — тоже один InstancedMesh.
// Локальная система модели: +z — вперёд, +x — левый борт, y — вверх; в мире rotation.y = PI/2 - ang (как у людей).
(function () {
  const R3 = J.R3;
  const col = (h) => new THREE.Color(h);
  const V = (x, y, z) => new THREE.Vector3(x, y, z);
  const tA = new THREE.Vector3(), tB = new THREE.Vector3(), tN = new THREE.Vector3();

  // выпуклый плоский многоугольник веером; нормаль разворачиваем по nExp
  function face(gb, pts, nExp, c) {
    tA.subVectors(pts[1], pts[0]);
    tB.subVectors(pts[2], pts[0]);
    tN.crossVectors(tA, tB);
    if (tN.dot(nExp) < 0) pts = pts.slice().reverse();
    for (let i = 1; i < pts.length - 1; i++) gb.tri(pts[0].toArray(), pts[i].toArray(), pts[i + 1].toArray(), c);
  }
  // призма по боковому профилю (z, y) с полушириной hw(z, y); colEdge(i) — цвет грани i (null — не рисовать)
  function prism(gb, prof, hwFn, capCol, colEdge) {
    const n = prof.length;
    const L = prof.map(([z, y]) => V(hwFn(z, y), y, z));
    const Rr = prof.map(([z, y]) => V(-hwFn(z, y), y, z));
    if (capCol) {
      face(gb, L, V(1, 0, 0), capCol);
      face(gb, Rr, V(-1, 0, 0), capCol);
    }
    let cz = 0, cy = 0;
    prof.forEach(([z, y]) => { cz += z / n; cy += y / n; });
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      const mz = (prof[i][0] + prof[j][0]) / 2 - cz, my = (prof[i][1] + prof[j][1]) / 2 - cy;
      const c = colEdge(i);
      if (!c) continue;
      face(gb, [L[i], L[j], Rr[j], Rr[i]], V(0, my, mz), c);
    }
  }
  const boxC = (gb, x0, y0, z0, x1, y1, z1, c) => gb.box(Math.min(x0, x1), Math.min(y0, y1), Math.min(z0, z1), Math.max(x0, x1), Math.max(y0, y1), Math.max(z0, z1), c, false);
  // тёмная арка над колесом с обеих сторон
  function wheelWells(gb, hw, zc, r, c) {
    for (const s of [1, -1]) {
      const pts = [V(s * (hw + 0.004), r * 0.3, zc)];
      for (let k = 0; k <= 8; k++) {
        const a = (k / 8) * Math.PI;
        pts.push(V(s * (hw + 0.004), r * 0.3 + Math.sin(a) * r * 1.2, zc + Math.cos(a) * r * 1.2));
      }
      for (let k = 1; k < pts.length - 1; k++) face(gb, [pts[0], pts[k], pts[k + 1]], V(s, 0, 0), c);
    }
  }

  const GLASS = col('#141a22'), TRIM = col('#1d1e22'), CHROME = col('#b8bcc4'), PLATE = col('#e9e6d6'), UNDER = col('#121214');
  const HEAD = col('#fff4dc'), TAIL = col('#ff2418'), AMBER = col('#ffae2a'), SIGN = col('#ffd84a'), REV = col('#f4f4f4');

  // ---------- Легковые: седан, хэтчбек, такси, полиция, спорткар ----------
  function buildCarLike(t, paint, livery, region) {
    const gb = new J.GB(1024), lb = new J.GB(128), bb = new J.GB(64);
    const { L, W, H, wr, wb } = t;
    const P = t.prof;
    const zF = L / 2, zR = -L / 2, c = wr * 0.62;
    const yHood = H * P.nose, yBelt = H * 0.64, yTrunk = H * P.tail;
    const hw = W / 2;
    const P2 = paint.clone().multiplyScalar(0.8);
    const second = livery ? col(livery[1]) : null; // двухцветная полиция: низ дверей
    const zWin = zF - L * P.hood, zRoof0 = zF - L * P.roof0, zRoof1 = zF - L * P.roof1, zDeck = zF - L * P.deck;
    const hatch = P.deck > 0.92;
    // нижняя часть кузова
    const lower = [
      [zR + 0.14, c], [zF - 0.14, c], [zF, c + 0.2], [zF, yHood - 0.1], [zF - 0.2, yHood],
      [zWin, yBelt], [zDeck, yBelt], [zR + (hatch ? 0.06 : 0.18), yTrunk], [zR, yTrunk - 0.12], [zR, c + 0.2],
    ];
    // боковины плоские (неплоская крышка многоугольника давала тёмные складки на дверях)
    const chamfer = () => 0;
    prism(gb, lower, () => hw, second || paint, (i) => (i === 0 ? UNDER : i === 2 || i === 8 ? P2 : paint));
    if (second) {
      // полоса основного цвета под окнами
      for (const s of [1, -1]) face(gb, [V(s * (hw + 0.003), yBelt - 0.22, zWin), V(s * (hw + 0.003), yBelt, zWin), V(s * (hw + 0.003), yBelt, zDeck), V(s * (hw + 0.003), yBelt - 0.22, zDeck)], V(s, 0, 0), paint);
    }
    // салон (сужается кверху)
    // у хэтчбека — наклонная дверь багажника до самого верха задка
    const cabin = hatch ? [[zWin, yBelt], [zRoof0, H], [zRoof1, H], [zDeck, yTrunk], [zDeck, yBelt]] : [[zWin, yBelt], [zRoof0, H], [zRoof1, H], [zDeck, yBelt]];
    const hwc = (z, y) => hw - P.tumble * ((y - yBelt) / (H - yBelt)) - 0.04;
    prism(gb, cabin, hwc, GLASS, (i) => (i === 1 ? paint : hatch ? (i === 3 ? paint : i === 4 ? null : GLASS) : i === 3 ? null : GLASS));
    // стойки A, B, C
    const pil = (z0, y0, z1, y1, w) => {
      for (const s of [1, -1]) {
        const x0 = s * (hwc(z0, y0) + 0.006), x1 = s * (hwc(z1, y1) + 0.006);
        face(gb, [V(x0, y0, z0 - w / 2), V(x0, y0, z0 + w / 2), V(x1, y1, z1 + w / 2), V(x1, y1, z1 - w / 2)], V(s, 0, 0), paint);
      }
    };
    pil(zWin - 0.04, yBelt, zRoof0 - 0.03, H - 0.01, 0.09);
    pil((zWin + zDeck) / 2 + 0.05, yBelt, (zRoof0 + zRoof1) / 2 + 0.05, H - 0.01, 0.1);
    pil(zDeck + 0.08, yBelt, zRoof1 + 0.06, H - 0.01, hatch ? 0.32 : 0.2);
    for (const s of [1, -1]) boxC(gb, s * (hw - 0.03), yBelt - 0.015, zDeck, s * (hw + 0.004), yBelt + 0.015, zWin, TRIM);
    // бамперы, решётка, номера, швы дверей, зеркала, ручки
    boxC(gb, -hw + 0.08, c + 0.06, zF - 0.06, hw - 0.08, c + 0.32, zF + 0.06, TRIM);
    boxC(gb, -hw + 0.08, c + 0.06, zR - 0.06, hw - 0.08, c + 0.32, zR + 0.06, TRIM);
    boxC(gb, -0.4, yHood - 0.3, zF - 0.02, 0.4, yHood - 0.12, zF + 0.012, TRIM);
    boxC(gb, -0.26, c + 0.12, zF + 0.06, 0.26, c + 0.26, zF + 0.075, PLATE);
    boxC(gb, -0.26, yTrunk - 0.42, zR - 0.015, 0.26, yTrunk - 0.28, zR, PLATE);
    for (const s of [1, -1]) {
      boxC(gb, s * hw, c + 0.25, zWin - 0.02, s * (hw + 0.006), yBelt - 0.05, zWin + 0.005, TRIM);
      boxC(gb, s * hw, c + 0.25, (zWin + zDeck) / 2 + 0.02, s * (hw + 0.006), yBelt - 0.05, (zWin + zDeck) / 2 + 0.045, TRIM);
      boxC(gb, s * hw, yBelt - 0.16, zWin - 0.45, s * (hw + 0.02), yBelt - 0.12, zWin - 0.3, CHROME);
      boxC(gb, s * hw, yBelt - 0.16, (zWin + zDeck) / 2 - 0.4, s * (hw + 0.02), yBelt - 0.12, (zWin + zDeck) / 2 - 0.25, CHROME);
      boxC(gb, s * (hw - 0.02), yBelt + 0.02, zWin - 0.05, s * (hw + 0.17), yBelt + 0.14, zWin - 0.2, second ? paint : P2);
      boxC(gb, s * hw, c + 0.02, zR + wr * 1.4, s * (hw + 0.01), c + 0.14, zF - wr * 1.4, TRIM); // порог
    }
    wheelWells(gb, hw - chamfer(0), wb / 2, wr, UNDER);
    wheelWells(gb, hw - chamfer(0), -wb / 2, wr, UNDER);
    if (t.id === 'sports') {
      boxC(gb, -hw + 0.12, yTrunk + 0.12, zR + 0.06, hw - 0.12, yTrunk + 0.16, zR + 0.32, TRIM);
      for (const s of [1, -1]) boxC(gb, s * (hw - 0.3), yTrunk, zR + 0.15, s * (hw - 0.36), yTrunk + 0.12, zR + 0.22, TRIM);
      boxC(gb, -0.5, yHood + 0.005, zF - 0.9, 0.5, yHood + 0.02, zF - 0.4, TRIM); // воздухозаборник
    }
    if (t.id === 'taxi' && region === 'usa') {
      // шашечки по бортам
      for (const s of [1, -1]) for (let k = 0; k < 10; k++) boxC(gb, s * (hw + 0.004), yBelt - 0.28 + (k % 2) * 0.06, zDeck + 0.25 + k * 0.12, s * (hw + 0.009), yBelt - 0.22 + (k % 2) * 0.06, zDeck + 0.37 + k * 0.12, TRIM);
    }
    // фары, поворотники, задние фонари (+ отдельная накладка стоп-сигналов)
    for (const s of [1, -1]) {
      boxC(lb, s * (hw - 0.12), yHood - 0.27, zF - 0.02, s * (hw - 0.52), yHood - 0.1, zF + 0.018, HEAD);
      boxC(lb, s * (hw - 0.11), yHood - 0.33, zF - 0.02, s * (hw - 0.24), yHood - 0.28, zF + 0.014, AMBER);
      boxC(lb, s * (hw - 0.08), yTrunk - 0.3, zR - 0.018, s * (hw - 0.48), yTrunk - 0.12, zR + 0.02, TAIL);
      boxC(lb, s * (hw - 0.5), yTrunk - 0.28, zR - 0.016, s * (hw - 0.6), yTrunk - 0.14, zR + 0.02, REV);
      boxC(bb, s * (hw - 0.07), yTrunk - 0.31, zR - 0.032, s * (hw - 0.49), yTrunk - 0.11, zR + 0.01, TAIL);
    }
    boxC(bb, -0.3, H - 0.06, zRoof1 - 0.02, 0.3, H - 0.02, zRoof1 + 0.02, TAIL); // третий стоп-сигнал
    let siren = null;
    if (t.sign) {
      boxC(gb, -0.32, H, zRoof0 - 0.4, 0.32, H + 0.04, zRoof0 - 0.12, TRIM);
      boxC(lb, -0.3, H + 0.04, zRoof0 - 0.38, 0.3, H + 0.22, zRoof0 - 0.14, region === 'london' ? AMBER : SIGN);
    }
    if (t.lightbar) {
      const zm = (zRoof0 + zRoof1) / 2;
      boxC(gb, -0.58, H, zm - 0.13, 0.58, H + 0.05, zm + 0.13, TRIM);
      siren = [new J.GB(64), new J.GB(64)];
      boxC(siren[0], 0.04, H + 0.05, zm - 0.11, 0.56, H + 0.17, zm + 0.11, col('#ff2a2a'));
      boxC(siren[1], -0.56, H + 0.05, zm - 0.11, -0.04, H + 0.17, zm + 0.11, col('#2a6aff'));
    }
    return { body: gb, lights: lb, brake: bb, siren, seat: { x: 0.38, y: yBelt - 0.42, z: (zWin + zDeck) / 2 + 0.25 } };
  }

  // ---------- Фургон (цельнометаллический) ----------
  function buildVan(t, paint) {
    const gb = new J.GB(1024), lb = new J.GB(128), bb = new J.GB(64);
    const { L, W, H, wr, wb } = t;
    const zF = L / 2, zR = -L / 2, c = wr * 0.6, hw = W / 2;
    const yB = 1.05, zHood = zF - 0.55, zWs = zF - 1.25;
    const P2 = paint.clone().multiplyScalar(0.82);
    const lower = [[zR, c], [zF - 0.1, c], [zF, c + 0.25], [zF, yB - 0.12], [zF - 0.1, yB], [zR, yB]];
    prism(gb, lower, () => hw, paint, (i) => (i === 0 ? UNDER : i === 5 ? null : paint));
    // верх: лобовое стекло наклонное, дальше — глухой короб
    const upper = [[zR, yB], [zHood, yB], [zWs, H], [zR, H]];
    const hwu = (z, y) => hw - 0.03 - 0.05 * ((y - yB) / (H - yB));
    prism(gb, upper, hwu, paint, (i) => (i === 0 ? null : i === 1 ? GLASS : i === 2 ? paint : P2));
    // окна кабины по бортам
    for (const s of [1, -1]) {
      const x = s * (hwu(0, (yB + H) / 2) + 0.012);
      face(gb, [V(x, yB + 0.12, zHood - 0.1), V(x, yB + 0.12, zWs - 0.75), V(x, H - 0.18, zWs - 0.75), V(x, H - 0.18, zWs - 0.05)], V(s, 0, 0), GLASS);
      boxC(gb, s * hw, c + 0.2, zWs - 0.8, s * (hw + 0.006), H - 0.15, zWs - 0.77, TRIM); // шов двери кабины
      boxC(gb, s * hw, c + 0.2, zR + 1.3, s * (hw + 0.006), H - 0.15, zR + 1.33, TRIM); // сдвижная дверь
      boxC(gb, s * (hw - 0.02), yB + 0.05, zHood - 0.15, s * (hw + 0.2), yB + 0.32, zHood - 0.25, TRIM); // зеркало
      boxC(gb, s * hw, c + 0.02, zR + wr * 1.5, s * (hw + 0.01), c + 0.16, zF - wr * 1.5, TRIM);
    }
    boxC(gb, -0.02, c + 0.3, zR - 0.012, 0.02, H - 0.1, zR, TRIM); // задние распашные двери
    boxC(gb, -hw + 0.3, yB + 0.25, zR - 0.012, -0.08, H - 0.35, zR, GLASS);
    boxC(gb, 0.08, yB + 0.25, zR - 0.012, hw - 0.3, H - 0.35, zR, GLASS);
    boxC(gb, -hw + 0.06, c + 0.04, zF - 0.06, hw - 0.06, c + 0.36, zF + 0.06, TRIM);
    boxC(gb, -hw + 0.06, c + 0.04, zR - 0.08, hw - 0.06, c + 0.34, zR + 0.04, TRIM);
    boxC(gb, -0.5, yB - 0.4, zF - 0.01, 0.5, yB - 0.14, zF + 0.012, TRIM);
    boxC(gb, -0.26, c + 0.12, zF + 0.06, 0.26, c + 0.26, zF + 0.075, PLATE);
    boxC(gb, -0.26, c + 0.38, zR - 0.09, 0.26, c + 0.52, zR - 0.075, PLATE);
    wheelWells(gb, hw, wb / 2 + 0.35, wr, UNDER);
    wheelWells(gb, hw, -wb / 2 + 0.35, wr, UNDER);
    for (const s of [1, -1]) {
      boxC(lb, s * (hw - 0.1), yB - 0.36, zF - 0.02, s * (hw - 0.45), yB - 0.16, zF + 0.016, HEAD);
      boxC(lb, s * (hw - 0.04), c + 0.45, zR - 0.016, s * (hw - 0.22), c + 1.0, zR + 0.02, TAIL);
      boxC(bb, s * (hw - 0.03), c + 0.44, zR - 0.03, s * (hw - 0.23), c + 1.01, zR + 0.01, TAIL);
    }
    return { body: gb, lights: lb, brake: bb, siren: null, seat: { x: 0.45, y: yB - 0.35, z: zWs - 0.3 }, zoff: 0.35 };
  }

  // ---------- Автобус ----------
  function buildBus(t, paint) {
    const gb = new J.GB(2048), lb = new J.GB(128), bb = new J.GB(64);
    const { L, W, H, wr, wb } = t;
    const zF = L / 2, zR = -L / 2, c = wr * 0.5, hw = W / 2;
    const yBelt = H * 0.42, yTop = H - 0.28;
    const P2 = paint.clone().multiplyScalar(0.8);
    prism(gb, [[zR, c], [zF, c], [zF, yBelt], [zR, yBelt]], () => hw, paint, (i) => (i === 0 ? UNDER : paint));
    prism(gb, [[zR, yBelt], [zF, yBelt], [zF - 0.12, yTop], [zR, yTop]], () => hw - 0.02, GLASS, (i) => (i === 0 ? null : GLASS));
    prism(gb, [[zR, yTop], [zF - 0.12, yTop], [zF - 0.3, H], [zR + 0.1, H]], () => hw - 0.02, paint, (i) => (i === 0 ? null : P2));
    for (let z = zR + 0.2; z < zF - 0.4; z += 1.25) for (const s of [1, -1]) boxC(gb, s * (hw - 0.02), yBelt, z - 0.06, s * (hw + 0.006), yTop, z + 0.06, paint);
    for (const s of [1, -1]) boxC(gb, s * (hw - 0.02), yBelt - 0.02, zR, s * (hw + 0.008), yBelt + 0.05, zF, TRIM);
    boxC(gb, -hw + 0.05, c, zF - 0.02, hw - 0.05, c + 0.3, zF + 0.06, TRIM);
    boxC(gb, -hw + 0.05, c, zR - 0.06, hw - 0.05, c + 0.3, zR + 0.02, TRIM);
    for (const zc of [zF - 1.2, 0]) for (const s of [1, -1]) boxC(gb, s * hw, c + 0.15, zc - 0.55, s * (hw + 0.01), yTop - 0.1, zc + 0.55, GLASS);
    for (const zc of [wb / 2, -wb / 2]) wheelWells(gb, hw, zc, wr, UNDER);
    for (const s of [1, -1]) {
      boxC(lb, s * (hw - 0.1), c + 0.35, zF - 0.01, s * (hw - 0.45), c + 0.55, zF + 0.02, HEAD);
      boxC(lb, s * (hw - 0.06), c + 0.4, zR - 0.02, s * (hw - 0.3), c + 0.75, zR + 0.01, TAIL);
      boxC(bb, s * (hw - 0.05), c + 0.39, zR - 0.03, s * (hw - 0.31), c + 0.76, zR, TAIL);
    }
    boxC(lb, -hw + 0.3, yTop - 0.05, zF - 0.1, hw - 0.3, yTop + 0.2, zF - 0.07, AMBER); // табло маршрута
    return { body: gb, lights: lb, brake: bb, siren: null, seat: { x: 0.6, y: yBelt - 0.3, z: zF - 1.0 } };
  }

  // ---------- Грузовик ----------
  function buildTruck(t, paint) {
    const gb = new J.GB(1024), lb = new J.GB(128), bb = new J.GB(64);
    const { L, W, H, wr, wb } = t;
    const zF = L / 2, zR = -L / 2, c = wr * 0.62, hw = W / 2;
    const cabL = 2.1, yCabBelt = 1.75, yCabTop = 2.65;
    const P2 = paint.clone().multiplyScalar(0.8);
    const CAB = col('#e8e8ea');
    prism(gb, [[zF - cabL, c + 0.2], [zF - 0.1, c + 0.2], [zF, c + 0.4], [zF, yCabBelt], [zF - cabL, yCabBelt]], () => hw - 0.05, CAB, (i) => (i === 0 ? UNDER : CAB));
    prism(gb, [[zF - cabL, yCabBelt], [zF - 0.05, yCabBelt], [zF - 0.3, yCabTop], [zF - cabL, yCabTop]], () => hw - 0.1, GLASS, (i) => (i === 0 ? null : i === 2 ? CAB : GLASS));
    boxC(gb, -hw + 0.15, yCabTop, zF - cabL + 0.1, hw - 0.15, yCabTop + 0.06, zF - 0.4, CAB);
    for (const s of [1, -1]) boxC(gb, s * (hw - 0.1), yCabBelt, zF - cabL + 0.05, s * (hw - 0.04), yCabTop, zF - cabL + 0.35, CAB);
    boxC(gb, -hw, c + 0.45, zR, hw, H, zF - cabL - 0.15, paint);
    boxC(gb, -hw - 0.01, H - 0.12, zR - 0.01, hw + 0.01, H + 0.01, zF - cabL - 0.14, P2);
    boxC(gb, -hw + 0.08, c + 0.55, zR - 0.02, hw - 0.08, H - 0.15, zR, P2);
    boxC(gb, -0.02, c + 0.55, zR - 0.03, 0.02, H - 0.15, zR, TRIM);
    boxC(gb, -hw + 0.35, c, zR + 0.2, hw - 0.35, c + 0.45, zF - cabL, UNDER);
    boxC(gb, -hw + 0.08, c + 0.1, zF - 0.06, hw - 0.08, c + 0.42, zF + 0.06, TRIM);
    boxC(gb, -0.5, c + 0.5, zF - 0.01, 0.5, yCabBelt - 0.25, zF + 0.01, TRIM);
    for (const zc of [wb / 2 + 0.4, -wb / 2 + 0.4]) wheelWells(gb, hw - 0.02, zc, wr, UNDER);
    for (const s of [1, -1]) {
      boxC(gb, s * (hw - 0.05), yCabBelt + 0.05, zF - 0.35, s * (hw + 0.22), yCabBelt + 0.45, zF - 0.42, TRIM);
      boxC(lb, s * (hw - 0.12), c + 0.5, zF - 0.01, s * (hw - 0.42), c + 0.72, zF + 0.02, HEAD);
      boxC(lb, s * (hw - 0.08), c + 0.5, zR - 0.03, s * (hw - 0.32), c + 0.72, zR, TAIL);
      boxC(bb, s * (hw - 0.07), c + 0.49, zR - 0.04, s * (hw - 0.33), c + 0.73, zR - 0.01, TAIL);
    }
    return { body: gb, lights: lb, brake: bb, siren: null, seat: { x: 0.5, y: yCabBelt - 0.3, z: zF - 1.0 }, zoff: 0.4 };
  }

  // ---------- Кэш геометрии и материалы ----------
  const geoCache = new Map();
  const shared = (g) => {
    g.userData.shared = true; // общая геометрия: никогда не освобождать при удалении машины
    return g;
  };
  R3.carGeo = function (typeId, paintHex, livery, region) {
    const k = typeId + paintHex + (livery ? livery.join() : '') + (typeId === 'taxi' ? region : '');
    let g = geoCache.get(k);
    if (g) return g;
    const t = J.vtypeOf(typeId);
    const paint = col(paintHex);
    const parts = t.shape === 'bus' ? buildBus(t, paint) : t.shape === 'truck' ? buildTruck(t, paint) : t.shape === 'van' ? buildVan(t, paint) : buildCarLike(t, paint, livery, region);
    g = {
      body: shared(mergeGlow(parts.body, parts.lights)), brake: shared(parts.brake.build()),
      siren: parts.siren ? parts.siren.map((s) => shared(s.build())) : null, seat: parts.seat, zoff: parts.zoff || 0,
      tris: (parts.body.v + parts.lights.v) / 3,
    };
    geoCache.set(k, g);
    return g;
  };
  R3.carGeoCount = () => geoCache.size;
  // кузов и фары — одна геометрия (один вызов отрисовки); у вершин фар атрибут aGlow = 1 — они светятся ночью
  function mergeGlow(a, b) {
    const n = a.v + b.v, g = new THREE.BufferGeometry();
    const P = new Float32Array(n * 3), N = new Float32Array(n * 3), C = new Float32Array(n * 3), GL = new Float32Array(n);
    P.set(a.p.subarray(0, a.v * 3));
    P.set(b.p.subarray(0, b.v * 3), a.v * 3);
    N.set(a.n.subarray(0, a.v * 3));
    N.set(b.n.subarray(0, b.v * 3), a.v * 3);
    C.set(a.c.subarray(0, a.v * 3));
    C.set(b.c.subarray(0, b.v * 3), a.v * 3);
    // красные фонари светятся слабее белых фар — после тональной кривой остаются красными, а не оранжевыми
    for (let i = a.v; i < n; i++) GL[i] = C[i * 3] > 0.5 && C[i * 3 + 1] < 0.2 ? 0.42 : 1;
    g.setAttribute('position', new THREE.BufferAttribute(P, 3));
    g.setAttribute('normal', new THREE.BufferAttribute(N, 3));
    g.setAttribute('color', new THREE.BufferAttribute(C, 3));
    g.setAttribute('aGlow', new THREE.BufferAttribute(GL, 1));
    J.fastBounds(g, P, n * 3);
    return g;
  }

  R3.initCars = function () {
    const MAXV = 64;
    R3.carMat = new THREE.MeshPhongMaterial({ vertexColors: true, shininess: 80, specular: new THREE.Color(0.35, 0.35, 0.35) });
    R3.carGlow = { value: 0 };
    R3.carGlowOff = { value: 0.12 };
    const glowShader = (u) => (sh) => {
      sh.uniforms.uGlow = u;
      sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nattribute float aGlow;\nvarying float vGlow;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvGlow = aGlow;');
      sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nuniform float uGlow;\nvarying float vGlow;').replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance += vColor * vGlow * uGlow;');
    };
    R3.carMat.onBeforeCompile = glowShader(R3.carGlow);
    // припаркованные машины без водителя: фары не горят (тот же шейдер — без лишней компиляции)
    R3.carMatOff = R3.carMat.clone();
    R3.carMatOff.onBeforeCompile = glowShader(R3.carGlowOff);
    R3.carBrakeMat = new THREE.MeshBasicMaterial({ vertexColors: true });
    R3.carBrakeMat.color.setRGB(1.25, 1.25, 1.25);
    R3.sirenMats = [new THREE.MeshBasicMaterial({ vertexColors: true }), new THREE.MeshBasicMaterial({ vertexColors: true })];
    R3.wreckMat = new THREE.MeshLambertMaterial({ color: '#2a2622' });
    // все колёса — один InstancedMesh: колесо радиуса 1 и ширины 1, ось — локальный x
    const wg = new J.GB(1024);
    const tire = new THREE.CylinderGeometry(1, 1, 1, 14, 1);
    tire.rotateZ(Math.PI / 2);
    wg.geo(tire, new THREE.Matrix4(), col('#161618'));
    const rim = new THREE.CylinderGeometry(0.64, 0.64, 1.04, 10, 1);
    rim.rotateZ(Math.PI / 2);
    wg.geo(rim, new THREE.Matrix4(), col('#8a9098'));
    for (let k = 0; k < 3; k++) {
      // спицы (через центр) — чтобы было видно вращение
      const m = new THREE.Matrix4().makeRotationX((k / 3) * Math.PI);
      wg.geo(new THREE.BoxGeometry(1.08, 1.1, 0.14), m, col('#4a4e56'));
    }
    R3.wheelIM = new THREE.InstancedMesh(shared(wg.build()), new THREE.MeshLambertMaterial({ vertexColors: true }), MAXV * 4);
    R3.wheelIM.count = 0;
    R3.wheelIM.frustumCulled = false;
    R3.wheelIM.castShadow = true;
    R3.scene.add(R3.wheelIM);
    // пятна света фар на асфальте ночью (аддитивно), один InstancedMesh на все машины
    const cv = document.createElement('canvas');
    cv.width = cv.height = 64;
    const cx = cv.getContext('2d');
    const gr = cx.createRadialGradient(32, 40, 0, 32, 36, 34);
    gr.addColorStop(0, 'rgba(255,240,205,0.95)');
    gr.addColorStop(0.5, 'rgba(255,236,200,0.4)');
    gr.addColorStop(1, 'rgba(255,236,200,0)');
    cx.fillStyle = gr;
    cx.fillRect(0, 0, 64, 64);
    const pg = new THREE.PlaneGeometry(1, 1);
    pg.rotateX(-Math.PI / 2);
    const ptex = new THREE.CanvasTexture(cv);
    ptex.encoding = THREE.sRGBEncoding;
    R3.carPoolMat = new THREE.MeshBasicMaterial({ map: ptex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 });
    R3.carPoolIM = new THREE.InstancedMesh(shared(pg), R3.carPoolMat, MAXV);
    R3.carPoolIM.count = 0;
    R3.carPoolIM.frustumCulled = false;
    R3.carPoolIM.renderOrder = 2;
    R3.scene.add(R3.carPoolIM);
    // настоящий свет — только у машины игрока (добавлен один раз: меняется лишь яркость — без перекомпиляции шейдеров)
    R3.carBeam = new THREE.SpotLight('#fff1d0', 0, 38, 0.52, 0.55, 1.4);
    R3.scene.add(R3.carBeam, R3.carBeam.target);
    // горящие секции светофоров
    const lg = new THREE.BoxGeometry(0.05, 0.2, 0.2);
    R3.sigIM = new THREE.InstancedMesh(shared(lg), new THREE.MeshBasicMaterial({ color: '#ffffff' }), 512);
    R3.sigIM.count = 0;
    R3.sigIM.frustumCulled = false;
    R3.sigIM.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(512 * 3), 3);
    R3.scene.add(R3.sigIM);
    // заранее собрать частые машины (чтобы появление потока не давало рывков)
    for (const id of ['sedan', 'hatch', 'van']) {
      const t = J.VTYPES[id];
      for (let i = 0; i < Math.min(4, t.colors.length); i++) R3.carGeo(id, t.colors[i]);
    }
  };

  // ---------- Вид одной машины: группа (кузов, фары, стоп-сигналы, мигалки) ----------
  R3.makeCarView = function (v) {
    const g = R3.carGeo(v.type, v.color, v.livery, v.region);
    const grp = new THREE.Group();
    grp.matrixAutoUpdate = false;
    const body = new THREE.Mesh(g.body, R3.carMat);
    body.castShadow = false;
    body.receiveShadow = true;
    const brake = new THREE.Mesh(g.brake, R3.carBrakeMat);
    brake.visible = false;
    grp.add(body, brake);
    let siren = null;
    if (g.siren) {
      siren = [new THREE.Mesh(g.siren[0], R3.sirenMats[0]), new THREE.Mesh(g.siren[1], R3.sirenMats[1])];
      grp.add(siren[0], siren[1]);
    }
    R3.scene.add(grp);
    return { group: grp, body, brake, siren, geo: g, cast: false };
  };
  R3.dropCarView = function (v) {
    if (!v.view) return;
    R3.scene.remove(v.view.group); // геометрия общая и кэшированная — не освобождаем
    v.view = null;
  };

  // ---------- Покадровая синхронизация всех машин ----------
  const mW = new THREE.Matrix4(), mC = new THREE.Matrix4(), mL = new THREE.Matrix4(), qq = new THREE.Quaternion(), e3 = new THREE.Euler(), pp = new THREE.Vector3(), ss = new THREE.Vector3();
  const casters = [];
  R3.updateCars = function (list, t, playerCar) {
    const day = R3.dayLevel === undefined ? 1 : R3.dayLevel;
    const night = J.clamp(1 - day * 1.4, 0, 1);
    let wi = 0, pi = 0;
    // фары: днём тусклые (просто цвет стекла), ночью ярче единицы — тональная кривая даст свечение
    R3.carGlow.value = 0.15 + 2.4 * night;
    const flash = Math.sin(t * 14) > 0;
    R3.sirenMats[0].color.setScalar(flash ? 2.6 : 0.3);
    R3.sirenMats[1].color.setScalar(flash ? 0.3 : 2.6);
    const far = R3.scene.fog.far * 0.88, far2 = far * far; // дальше — в тумане, не рисуем
    const cx = R3.cam.tx, cz = R3.cam.tz;
    const maxCast = R3.shadows && R3.preset.shadows ? Math.max(2, R3.charCast) : 0;
    casters.length = 0;
    for (let i = 0; i < list.length; i++) {
      const v = list[i];
      const dx = v.x - cx, dz = v.y - cz;
      v.d2 = dx * dx + dz * dz;
      if (v.d2 > far2) {
        if (v.view) v.view.group.visible = false;
        continue;
      }
      if (!v.view) v.view = R3.makeCarView(v);
      const vw = v.view, vt = v.vt;
      const gr = vw.group;
      gr.visible = true;
      gr.position.set(v.x, v.gy + (v.bob || 0), v.y);
      // кузов кренится на спущенные колёса
      const fm = v.flatMask || 0;
      const fRoll = fm ? ((fm & 2 ? 1 : 0) + (fm & 8 ? 1 : 0) - (fm & 1 ? 1 : 0) - (fm & 4 ? 1 : 0)) * 0.035 : 0;
      const fPitch = fm ? ((fm & 1 ? 1 : 0) + (fm & 2 ? 1 : 0) - (fm & 4 ? 1 : 0) - (fm & 8 ? 1 : 0)) * 0.02 : 0;
      e3.set((v.pitch || 0) + fPitch, Math.PI / 2 - v.ang, (v.roll || 0) + fRoll, 'YXZ');
      gr.rotation.copy(e3);
      gr.updateMatrix();
      gr.updateMatrixWorld(true);
      const wreck = v.hp <= 0;
      vw.brake.visible = !wreck && (v.braking || v.reverse);
      if (vw.siren) vw.siren[0].visible = vw.siren[1].visible = !!v.siren;
      const lit = !wreck && !!v.driver;
      const mat = wreck ? R3.wreckMat : lit ? R3.carMat : R3.carMatOff;
      if (vw.body.material !== mat) vw.body.material = mat;
      if (v.d2 < 900 && maxCast) casters.push(v);
      // колёса: матрица машины × T(локально) × Ry(-руль, передние) × Rx(вращение) × S(ширина, r, r)
      const hwT = vt.tr / 2, hz = vt.wb / 2, r = vt.wr, zoff = vw.geo.zoff;
      for (let k = 0; k < 4; k++) {
        const front = k < 2, sx = k % 2 ? -1 : 1;
        // спущенная шина (guns.js) — диск ниже, колесо проседает
        const flat = v.flatMask && v.flatMask & (1 << k);
        pp.set(sx * hwT, flat ? r * 0.74 : r, (front ? hz : -hz) + zoff);
        qq.setFromEuler(e3.set(v.spin || 0, front ? v.steer || 0 : 0, 0, 'YXZ'));
        ss.set(0.2 + r * 0.25, r, r);
        mL.compose(pp, qq, ss);
        mW.multiplyMatrices(gr.matrixWorld, mL);
        R3.wheelIM.setMatrixAt(wi++, mW);
      }
      // пятно света фар
      if (night > 0.25 && lit && pi < 64) {
        const ca = Math.cos(v.ang), sa = Math.sin(v.ang), d = vt.L / 2 + 4.2;
        pp.set(v.x + ca * d, v.gy + 0.07, v.y + sa * d);
        qq.setFromAxisAngle(THREE.Object3D.DefaultUp, Math.PI / 2 - v.ang);
        ss.set(vt.W * 2.4, 1, 9.5);
        mC.compose(pp, qq, ss);
        R3.carPoolIM.setMatrixAt(pi++, mC);
      }
    }
    // тени отбрасывают только ближайшие машины
    if (casters.length > 1) casters.sort((a, b) => a.d2 - b.d2);
    for (let i = 0; i < list.length; i++) {
      const v = list[i];
      if (!v.view) continue;
      const want = maxCast > 0 && (v === playerCar || casters.indexOf(v) < maxCast) && v.d2 < 900;
      if (v.view.cast !== want) {
        v.view.cast = want;
        v.view.body.castShadow = want;
      }
    }
    R3.wheelIM.count = wi;
    R3.wheelIM.instanceMatrix.needsUpdate = true;
    R3.carPoolIM.count = pi;
    R3.carPoolIM.instanceMatrix.needsUpdate = true;
    R3.carPoolMat.color.setScalar(0.85 * night);
    // свет фар машины игрока
    const b = R3.carBeam;
    if (playerCar && night > 0.2 && playerCar.hp > 0) {
      const ca = Math.cos(playerCar.ang), sa = Math.sin(playerCar.ang), L2 = playerCar.vt.L / 2;
      b.position.set(playerCar.x + ca * L2, playerCar.gy + 0.8, playerCar.y + sa * L2);
      b.target.position.set(playerCar.x + ca * (L2 + 14), playerCar.gy - 0.6, playerCar.y + sa * (L2 + 14));
      b.target.updateMatrixWorld();
      b.intensity = 2.2 * night;
    } else b.intensity = 0;
  };

  // ---------- Светофоры: горящая секция по фазе ----------
  // Головы светофоров ищутся по той же раскладке углов, что и в генераторе (world.decorateCities).
  const RC = [1, 0, -1, 0], RS = [0, 1, 0, -1];
  R3.initSignals = function (w) {
    const heads = [];
    const O = J.O, W = w.W;
    for (const nd of w.net.nodes) {
      if (nd.ctrl !== 'signal' || !nd.city) continue;
      const hx = nd.aw[0] / 2, hy = nd.aw[1] / 2;
      const left = (J.GRID[J.REGION[nd.city].style] || J.GRID.usa).drive === 'L';
      const corners = left ? [[hx, hy], [-hx - 1, hy], [-hx - 1, -hy - 1], [hx, -hy - 1]] : [[hx, hy], [-hx - 1, hy], [-hx - 1, -hy - 1], [hx, -hy - 1]];
      for (const [ox, oy] of corners) {
        const X = nd.x + ox, Y = nd.y + oy;
        if (!w.inb(X, Y) || w.o[Y * W + X] !== O.TLIGHT) continue;
        const od = w.od[Y * W + X];
        const sx = left ? -1 : 1;
        const gy = w.groundY(X + 0.5, Y + 0.5);
        const px = X + 0.5 + J.DIRV.DX[od] * 0.3, pz = Y + 0.5 + J.DIRV.DY[od] * 0.3;
        heads.push({ nd, px, pz, gy, od, sx, axis: od % 2 === 0 ? 'ew' : 'ns' });
      }
    }
    R3.sigHeads = heads;
  };
  const SIG_Y = { R: 5.2, Y: 4.9, G: 4.6 };
  const SIG_C = { R: [1.7, 0.06, 0.03], Y: [1.7, 0.75, 0.04], G: [0.08, 1.5, 0.5] };
  R3.updateSignals = function (w, t) {
    const heads = R3.sigHeads;
    if (!heads || !R3.sigIM) return;
    const cx = R3.cam.tx, cz = R3.cam.tz;
    const im = R3.sigIM, ic = im.instanceColor.array;
    let n = 0;
    for (let i = 0; i < heads.length && n < 510; i++) {
      const h = heads[i];
      const dx = h.px - cx, dz = h.pz - cz;
      if (dx * dx + dz * dz > 110 * 110) continue;
      const st = w.signalState(h.nd, t)[h.axis];
      const cs = RC[h.od], sn = RS[h.od];
      qq.setFromAxisAngle(THREE.Object3D.DefaultUp, (h.od * Math.PI) / 2);
      ss.set(1, 1, 1);
      const lx = h.sx * 0.185;
      for (const lz of [2.6, 4.1]) {
        pp.set(h.px + lx * cs + lz * sn, h.gy + SIG_Y[st], h.pz - lx * sn + lz * cs);
        mC.compose(pp, qq, ss);
        im.setMatrixAt(n, mC);
        const c = SIG_C[st];
        ic[n * 3] = c[0];
        ic[n * 3 + 1] = c[1];
        ic[n * 3 + 2] = c[2];
        n++;
      }
    }
    im.count = n;
    im.instanceMatrix.needsUpdate = true;
    im.instanceColor.needsUpdate = true;
  };
})();
