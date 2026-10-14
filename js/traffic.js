'use strict';
// Дорожное движение: граф полос из дорожной сети города (w.net), ИИ-водители (полосы, повороты, светофоры,
// дистанция, пешеходы, сигнал), припаркованные машины, граф тротуаров для пешеходов (переход по зебре на зелёный).
// Без аллокаций в покадровом цикле: пути — типизированные массивы, временные объекты переиспользуются.
(function () {
  const TR = (J.Traffic = {});
  const G = () => J.G;
  const STEP = 2; // шаг передискретизации осей дорог (м)
  const LWH = 3.25, MED = 1; // ширина полосы шоссе и разделитель
  const VMAX = { st: 13.4, ave: 16.7, hw: 29 }; // 48 / 60 / 105 км/ч
  const CELL = 32;

  // ---------- Геометрия путей ----------
  function resample(P) {
    const out = [P[0].x, P[0].y];
    let lx = P[0].x, ly = P[0].y, carry = 0;
    for (let i = 1; i < P.length; i++) {
      const ax = P[i - 1].x, ay = P[i - 1].y, bx = P[i].x, by = P[i].y;
      const L = Math.hypot(bx - ax, by - ay);
      if (L < 1e-3) continue;
      let d = STEP - carry;
      while (d < L) {
        lx = ax + ((bx - ax) * d) / L;
        ly = ay + ((by - ay) * d) / L;
        out.push(lx, ly);
        d += STEP;
      }
      carry = L - (d - STEP);
    }
    const ex = P[P.length - 1].x, ey = P[P.length - 1].y;
    if (Math.hypot(ex - lx, ey - ly) > 0.3) out.push(ex, ey);
    else {
      out[out.length - 2] = ex;
      out[out.length - 1] = ey;
    }
    return out;
  }
  // сдвиг ломаной вправо (по нормали (-dy, dx)) на off и обрезка t0 м с начала и t1 м с конца
  function makePath(flat, off, t0, t1) {
    const n = flat.length / 2;
    const pts = [];
    for (let i = 0; i < n; i++) {
      const i0 = Math.max(0, i - 1), i1 = Math.min(n - 1, i + 1);
      let dx = flat[i1 * 2] - flat[i0 * 2], dy = flat[i1 * 2 + 1] - flat[i0 * 2 + 1];
      const L = Math.hypot(dx, dy) || 1;
      dx /= L;
      dy /= L;
      pts.push(flat[i * 2] - dy * off, flat[i * 2 + 1] + dx * off);
    }
    return finishPath(trimFlat(pts, t0, t1));
  }
  function trimFlat(pts, t0, t1) {
    const cut = (p, t) => {
      while (t > 0 && p.length > 4) {
        const L = Math.hypot(p[2] - p[0], p[3] - p[1]);
        if (L > t) {
          p[0] += ((p[2] - p[0]) * t) / L;
          p[1] += ((p[3] - p[1]) * t) / L;
          break;
        }
        t -= L;
        p.splice(0, 2);
      }
      return p;
    };
    pts = cut(pts, t0);
    const rev = [];
    for (let i = pts.length - 2; i >= 0; i -= 2) rev.push(pts[i], pts[i + 1]);
    const r2 = cut(rev, t1), back = [];
    for (let i = r2.length - 2; i >= 0; i -= 2) back.push(r2[i], r2[i + 1]);
    return back;
  }
  function finishPath(pts) {
    const n = pts.length / 2;
    const cum = new Float32Array(n);
    for (let i = 1; i < n; i++) cum[i] = cum[i - 1] + Math.hypot(pts[i * 2] - pts[i * 2 - 2], pts[i * 2 + 1] - pts[i * 2 - 1]);
    return { pts: new Float32Array(pts), cum, len: cum[n - 1] };
  }
  // квадратичная кривая Безье от P0 (курс a0) к P2 (курс a2) — проезд перекрёстка
  function bezier(x0, y0, a0, x2, y2, a2) {
    const dx0 = Math.cos(a0), dy0 = Math.sin(a0), dx2 = Math.cos(a2), dy2 = Math.sin(a2);
    const den = dx0 * dy2 - dy0 * dx2;
    let cx, cy;
    if (Math.abs(den) < 0.15) {
      cx = (x0 + x2) / 2;
      cy = (y0 + y2) / 2;
    } else {
      const t = ((x2 - x0) * dy2 - (y2 - y0) * dx2) / den;
      cx = x0 + dx0 * t;
      cy = y0 + dy0 * t;
    }
    const L = Math.hypot(x2 - x0, y2 - y0);
    const n = Math.max(3, Math.ceil(L / 1.2));
    const pts = [];
    for (let i = 0; i <= n; i++) {
      const t = i / n, u = 1 - t;
      pts.push(u * u * x0 + 2 * u * t * cx + t * t * x2, u * u * y0 + 2 * u * t * cy + t * t * y2);
    }
    return finishPath(pts);
  }
  // точка пути на расстоянии s → out {x, y, a}; hint {i} — курсор сегмента (движение вперёд — O(1))
  TR.sample = function (P, s, out, hint) {
    const cum = P.cum, pts = P.pts, n = cum.length;
    if (s <= 0) s = 0;
    if (s >= P.len) s = P.len - 1e-4;
    let i = hint && hint.i < n - 1 && cum[hint.i] <= s ? hint.i : 0;
    while (i < n - 2 && cum[i + 1] < s) i++;
    if (hint) hint.i = i;
    const L = cum[i + 1] - cum[i] || 1, f = (s - cum[i]) / L;
    const dx = pts[i * 2 + 2] - pts[i * 2], dy = pts[i * 2 + 3] - pts[i * 2 + 1];
    out.x = pts[i * 2] + dx * f;
    out.y = pts[i * 2 + 1] + dy * f;
    out.a = Math.atan2(dy, dx);
    return out;
  };
  const headAt = (P, end) => {
    const p = P.pts, n = p.length / 2;
    return end ? Math.atan2(p[n * 2 - 1] - p[n * 2 - 3], p[n * 2 - 2] - p[n * 2 - 4]) : Math.atan2(p[3] - p[1], p[2] - p[0]);
  };

  // ---------- Построение графа ----------
  TR.build = function (w) {
    const t0 = performance.now();
    const net = w.net;
    const nodes = net.nodes.map((n) => ({ id: n.id, x: n.x, y: n.y, ctrl: n.ctrl || 'none', phase: n.phase || 0, hx: n.aw[0] / 2, hy: n.aw[1] / 2, deg: n.edges.length, city: n.city, ins: [], outs: [], src: n }));
    // концы шоссе без узла — виртуальные развязки (слитые в радиусе 10 м)
    const vnode = (x, y) => {
      for (const n of nodes) if (n.virtual && Math.hypot(n.x - x, n.y - y) < 10) return n.id;
      nodes.push({ id: nodes.length, x, y, ctrl: 'none', phase: 0, hx: 8, hy: 8, deg: 0, virtual: true, ins: [], outs: [], src: null });
      return nodes.length - 1;
    };
    const lanes = [];
    for (const e of net.edges) {
      const hw = e.cls === 'hw';
      const P = e.pts ? e.pts : [{ x: e.x0, y: e.y0 }, { x: e.x1, y: e.y1 }];
      const a = e.a >= 0 ? e.a : vnode(P[0].x, P[0].y);
      const b = e.b >= 0 ? e.b : vnode(P[P.length - 1].x, P[P.length - 1].y);
      if (e.a < 0) nodes[a].deg++;
      if (e.b < 0) nodes[b].deg++;
      const flat = resample(P);
      if (flat.length < 4) continue;
      const nl = e.lanes || 1;
      // центр полосы от оси: на узких улицах с парковкой — ближе к оси, чтобы не цеплять стоящие машины
      const offOf = (k) => (hw ? MED / 2 + (k + 0.5) * LWH : nl === 1 ? (e.w >= 8 ? 1.2 : Math.min(1.5, e.w / 4)) : (k + 0.5) * Math.min(3.5, e.w / 2 / nl));
      const rh = (e.drive || 'R') === 'R' ? 1 : -1;
      const trimFor = (nid, ang) => {
        const N = nodes[nid];
        const ext = Math.abs(Math.cos(ang)) > Math.abs(Math.sin(ang)) ? N.hx : N.hy;
        return ext + (N.ctrl === 'signal' ? 3.2 : N.virtual ? 0 : 0.6);
      };
      const ang0 = Math.atan2(flat[3] - flat[1], flat[2] - flat[0]);
      const n2 = flat.length;
      const ang1 = Math.atan2(flat[n2 - 1] - flat[n2 - 3], flat[n2 - 2] - flat[n2 - 4]);
      const trA = trimFor(a, ang0), trB = trimFor(b, ang1);
      for (const dir of [1, -1]) {
        let f = flat;
        if (dir < 0) {
          f = [];
          for (let i = flat.length - 2; i >= 0; i -= 2) f.push(flat[i], flat[i + 1]);
        }
        for (let k = 0; k < nl; k++) {
          const path = makePath(f, rh * offOf(k), dir > 0 ? trA : trB, dir > 0 ? trB : trA);
          if (!(path.len > 2)) continue;
          const L = Object.assign(path, {
            id: lanes.length, kind: 'lane', e: e.id, dir, k, nl, cls: e.cls, from: dir > 0 ? a : b, to: dir > 0 ? b : a,
            vmax: VMAX[e.cls] || 13.4, out: [], axis: 'ns', city: e.city || null, busS: -1, hEnd: 0, rh,
          });
          L.hEnd = headAt(L, true);
          L.axis = Math.abs(Math.cos(L.hEnd)) > Math.abs(Math.sin(L.hEnd)) ? 'ew' : 'ns';
          lanes.push(L);
          nodes[L.to].ins.push(L.id);
          nodes[L.from].outs.push(L.id);
        }
      }
    }
    // проезды через узлы
    const conns = [];
    for (const N of nodes) {
      for (const li of N.ins) {
        const Lin = lanes[li];
        const aIn = Lin.hEnd;
        const ex = Lin.pts[Lin.pts.length - 2], ey = Lin.pts[Lin.pts.length - 1];
        // второй проход без дисциплины полос — если иначе полоса упирается в тупик (угол квартала)
        for (let pass = 0; pass < 2 && !Lin.out.length; pass++)
        for (const lo of N.outs) {
          const Lout = lanes[lo];
          const uTurn = Lout.e === Lin.e;
          if (uTurn && N.deg > 1) continue;
          const aOut = headAt(Lout, false);
          const d = J.angDiff(aIn, aOut);
          const turn = uTurn ? 'u' : Math.abs(d) < 0.5 ? 's' : d > 0 ? 'r' : 'l';
          // дисциплина полос: внутренняя (k=0) поворачивает через встречку, внешняя — к бордюру
          const rh = (net.edges[Lin.e].drive || 'R') === 'R';
          const inner = Lin.k === 0, outer = Lin.k === Lin.nl - 1;
          const nearSide = rh ? 'r' : 'l', farSide = rh ? 'l' : 'r';
          if (pass === 0 && Lin.nl > 1 && ((turn === farSide && !inner) || (turn === nearSide && !outer))) continue;
          if (pass === 0 && Lout.nl > 1 && ((turn === farSide && Lout.k !== 0) || (turn === nearSide && Lout.k !== Lout.nl - 1) || (turn === 's' && Lout.k !== Math.min(Lin.k, Lout.nl - 1)))) continue;
          const sx = Lout.pts[0], sy = Lout.pts[1];
          const P = bezier(ex, ey, aIn, sx, sy, aOut);
          const C = Object.assign(P, {
            id: conns.length, kind: 'conn', from: li, to: lo, node: N.id, turn, vmax: turn === 's' ? Lin.vmax : turn === 'u' ? 4 : 6.5,
            axis: Lin.axis, far: turn === farSide, opp: null, w: turn === 's' ? 0.6 : turn === nearSide ? 0.25 : 0.15,
          });
          conns.push(C);
          Lin.out.push(C.id);
        }
      }
    }
    // встречные полосы для поворота через встречку (уступить идущим прямо)
    for (const C of conns) {
      if (!C.far) continue;
      const Lin = lanes[C.from], N = nodes[C.node];
      C.opp = N.ins.filter((li) => Math.abs(Math.abs(J.angDiff(lanes[li].hEnd, Lin.hEnd)) - Math.PI) < 0.4);
    }
    // автобусные карманы: внешняя полоса проспекта напротив остановки
    for (const L of lanes) {
      if (L.cls !== 'ave' || L.k !== L.nl - 1) continue;
      const n = L.pts.length / 2;
      for (let i = 0; i < n - 1; i++) {
        // клетка на метр ближе к бордюру (справа по ходу при правостороннем движении)
        const dx = L.pts[i * 2 + 2] - L.pts[i * 2], dy = L.pts[i * 2 + 3] - L.pts[i * 2 + 1], dl = Math.hypot(dx, dy) || 1;
        const x = Math.floor(L.pts[i * 2] - (dy / dl) * L.rh * 1.1), y = Math.floor(L.pts[i * 2 + 1] + (dx / dl) * L.rh * 1.1);
        if (w.inb(x, y) && w.rf[y * w.W + x] & J.RF.BUSBAY) {
          L.busS = L.cum[i] + 3;
          break;
        }
      }
    }
    // индекс полос по клеткам 32 м (для появления машин)
    const gw = Math.ceil(w.W / CELL), gh = Math.ceil(w.H / CELL);
    const cellLanes = new Array(gw * gh);
    for (const L of lanes) {
      let last = -1;
      for (let i = 0; i < L.pts.length; i += 2) {
        const c = Math.floor(L.pts[i + 1] / CELL) * gw + Math.floor(L.pts[i] / CELL);
        if (c === last) continue;
        last = c;
        const l = cellLanes[c] || (cellLanes[c] = []);
        if (l[l.length - 1] !== L.id) l.push(L.id);
      }
    }
    // места парковки по клеткам
    const cellPark = new Array(gw * gh);
    w.parkSpots.forEach((sp, i) => {
      const c = Math.floor(sp.y / CELL) * gw + Math.floor(sp.x / CELL);
      (cellPark[c] || (cellPark[c] = [])).push(i);
      sp.veh = null;
    });
    const tr = { nodes, lanes, conns, gw, gh, cellLanes, cellPark };
    tr.peds = buildPeds(w, nodes, net, gw);
    tr.ms = performance.now() - t0;
    return tr;
  };
  TR.ensure = function (w) {
    if (!w || !w.net) return null;
    if (!w.traffic) {
      w.traffic = TR.build(w);
      if (J.R3.initSignals) J.R3.initSignals(w);
    }
    return w.traffic;
  };

  // светофор для движения по оси axis ('ns' | 'ew'): 'G' | 'Y' | 'R' — как в w.signalState
  TR.signal = function (N, axis, t) {
    if (N.ctrl !== 'signal') return 'G';
    const c = (((t + N.phase) % 40) + 40) % 40;
    if (axis === 'ns') return c < 17 ? 'G' : c < 20 ? 'Y' : 'R';
    return c >= 20 && c < 37 ? 'G' : c >= 37 ? 'Y' : 'R';
  };
  // можно ли пешеходу переходить дорогу с осью roadAxis (машины по этой оси стоят на красном)
  TR.walk = function (N, roadAxis, t) {
    if (N.ctrl !== 'signal') return true;
    const c = (((t + N.phase) % 40) + 40) % 40;
    return roadAxis === 'ew' ? c >= 0.5 && c < 15 : c >= 20.5 && c < 35;
  };

  // ---------- Граф тротуаров: 4 угла у каждого городского узла, тротуары вдоль рёбер, переходы ----------
  function buildPeds(w, nodes, net, gw) {
    const corners = []; // id = узел*4 + q; q: 0 (+x,+y) 1 (-x,+y) 2 (-x,-y) 3 (+x,-y)
    const QS = [[1, 1], [-1, 1], [-1, -1], [1, -1]];
    const swOf = (nd, horizRoad) => {
      let s = 0;
      for (const eid of nd.edges) {
        const e = net.edges[eid];
        if (e.cls === 'hw') continue;
        if (e.horiz === horizRoad) s = Math.max(s, e.sw || 2);
      }
      return s || 2;
    };
    const segs = [];
    const link = (a, b, kind, nodeId, roadAxis) => {
      const A = corners[a], B = corners[b];
      if (!A || !B) return;
      const s = { id: segs.length, a, b, kind, node: nodeId, axis: roadAxis, len: Math.hypot(B.x - A.x, B.y - A.y) };
      segs.push(s);
      A.segs.push(s.id);
      B.segs.push(s.id);
    };
    for (const N of nodes) {
      const nd = N.src;
      if (N.virtual || !nd || !nd.city) continue;
      const ox = N.hx + swOf(nd, false) / 2, oy = N.hy + swOf(nd, true) / 2;
      for (let q = 0; q < 4; q++) corners[N.id * 4 + q] = { id: N.id * 4 + q, x: N.x + QS[q][0] * ox, y: N.y + QS[q][1] * oy, node: N.id, segs: [] };
    }
    for (const e of net.edges) {
      if (e.cls === 'hw') continue;
      const A = e.a, B = e.b;
      if (e.horiz) {
        const [w0, e0] = net.nodes[A].x < net.nodes[B].x ? [A, B] : [B, A];
        link(w0 * 4 + 0, e0 * 4 + 1, 'walk', -1, null);
        link(w0 * 4 + 3, e0 * 4 + 2, 'walk', -1, null);
        link(w0 * 4 + 3, w0 * 4 + 0, 'cross', w0, 'ew');
        link(e0 * 4 + 2, e0 * 4 + 1, 'cross', e0, 'ew');
      } else {
        const [n0, s0] = net.nodes[A].y < net.nodes[B].y ? [A, B] : [B, A];
        link(n0 * 4 + 0, s0 * 4 + 3, 'walk', -1, null);
        link(n0 * 4 + 1, s0 * 4 + 2, 'walk', -1, null);
        link(n0 * 4 + 1, n0 * 4 + 0, 'cross', n0, 'ns');
        link(s0 * 4 + 2, s0 * 4 + 3, 'cross', s0, 'ns');
      }
    }
    // переходы повторяются (у двух рёбер одного узла) — убираем дубли
    const seen = new Set();
    for (const s of segs) {
      const k = Math.min(s.a, s.b) + ':' + Math.max(s.a, s.b);
      if (seen.has(k)) s.dup = true;
      seen.add(k);
    }
    for (const c of corners) if (c) c.segs = c.segs.filter((id) => !segs[id].dup);
    const idx = new Array(gw * Math.ceil(w.H / CELL));
    for (const s of segs) {
      if (s.kind !== 'walk' || s.dup) continue;
      const A = corners[s.a], B = corners[s.b];
      const n = Math.max(1, Math.ceil(s.len / 16));
      let last = -1;
      for (let i = 0; i <= n; i++) {
        const x = A.x + ((B.x - A.x) * i) / n, y = A.y + ((B.y - A.y) * i) / n;
        const c = Math.floor(y / CELL) * gw + Math.floor(x / CELL);
        if (c === last) continue;
        last = c;
        const l = idx[c] || (idx[c] = []);
        if (!l.includes(s.id)) l.push(s.id);
      }
    }
    return { corners, segs, idx };
  }

  // ---------- Пешеходы на тротуарах ----------
  const tmpP = { x: 0, y: 0, a: 0 };
  // привязать горожанина к ближайшему тротуару (null, если рядом нет)
  TR.attachPed = function (e) {
    const w = G().world, tr = TR.ensure(w);
    if (!tr) return false;
    const pd = tr.peds, gw = tr.gw;
    const cx = Math.floor(e.x / CELL), cy = Math.floor(e.y / CELL);
    let best = null, bd = 9;
    for (let dy = -1; dy <= 1; dy++)
      for (let dx = -1; dx <= 1; dx++) {
        const l = pd.idx[(cy + dy) * gw + cx + dx];
        if (!l) continue;
        for (const sid of l) {
          const s = pd.segs[sid], A = pd.corners[s.a], B = pd.corners[s.b];
          const vx = B.x - A.x, vy = B.y - A.y;
          const u = J.clamp(((e.x - A.x) * vx + (e.y - A.y) * vy) / (s.len * s.len), 0, 1);
          const d = Math.hypot(A.x + vx * u - e.x, A.y + vy * u - e.y);
          if (d < bd) {
            bd = d;
            best = { seg: sid, u: u * s.len };
          }
        }
      }
    if (!best) return false;
    const ai = e.ai;
    ai.sw = best.seg;
    ai.su = best.u;
    ai.sdir = Math.random() < 0.5 ? 1 : -1;
    ai.soff = (Math.random() - 0.5) * 1.2;
    ai.swait = 0;
    return true;
  };
  // точка для появления пешехода на тротуаре в кольце [r0, r1] от (px, py)
  TR.pedSpawnPoint = function (px, py, r0, r1) {
    const w = G().world, tr = TR.ensure(w);
    if (!tr) return null;
    const pd = tr.peds, gw = tr.gw;
    for (let k = 0; k < 10; k++) {
      const a = Math.random() * J.TAU, d = r0 + Math.random() * (r1 - r0);
      const x = px + Math.cos(a) * d, y = py + Math.sin(a) * d;
      const l = pd.idx[Math.floor(y / CELL) * gw + Math.floor(x / CELL)];
      if (!l || !l.length) continue;
      const s = pd.segs[l[(Math.random() * l.length) | 0]], A = pd.corners[s.a], B = pd.corners[s.b];
      const u = 0.15 + Math.random() * 0.7;
      const sx = A.x + (B.x - A.x) * u, sy = A.y + (B.y - A.y) * u;
      const dd = Math.hypot(sx - px, sy - py);
      if (dd < r0 || dd > r1 + 8 || w.solid(sx, sy)) continue;
      return { x: sx, y: sy };
    }
    return null;
  };
  // шаг ходьбы горожанина по графу тротуаров; false — не привязан (обычное блуждание)
  TR.pedStep = function (e, dt) {
    const ai = e.ai, g = G(), w = g.world, tr = w.traffic;
    if (!tr || ai.sw === undefined || ai.sw < 0) return false;
    const pd = tr.peds, s = pd.segs[ai.sw];
    const A = pd.corners[ai.sdir > 0 ? s.a : s.b], B = pd.corners[ai.sdir > 0 ? s.b : s.a];
    // ожидание у перехода
    if (ai.swait > 0) {
      const N = tr.nodes[s.node];
      ai.swait += dt;
      e.vx = e.vy = 0;
      e.face = Math.atan2(B.y - A.y, B.x - A.x);
      const ok = N.ctrl === 'signal' ? TR.walk(N, s.axis, g.t) : !TR.carNear(A.x, A.y, 16);
      if (ok || ai.swait > 45) ai.swait = 0;
      else return true;
    }
    const vx = B.x - A.x, vy = B.y - A.y, L = s.len || 1;
    const ux = vx / L, uy = vy / L;
    const cross = s.kind === 'cross';
    const spd = e.speed * (cross ? 1.25 : 1);
    ai.su += spd * dt;
    if (ai.su >= L) {
      // угол: выбираем следующий отрезок (не назад, если есть выбор)
      const C = B, opts = C.segs;
      let pick = -1, tries = 0;
      while (tries++ < 6) {
        const id = opts[(Math.random() * opts.length) | 0];
        if (id !== ai.sw || opts.length === 1) {
          pick = id;
          break;
        }
      }
      if (pick < 0) pick = ai.sw;
      const ns = pd.segs[pick];
      ai.sw = pick;
      ai.sdir = ns.a === C.id ? 1 : -1;
      ai.su = 0;
      if (ns.kind === 'cross') ai.swait = 0.01;
      return true;
    }
    // цель — точка чуть впереди на линии со своим боковым смещением (на переходе — по центру зебры)
    const off = cross ? ai.soff * 0.5 : ai.soff;
    const u = Math.min(L, ai.su + 1.2);
    tmpP.x = A.x + ux * u - uy * off;
    tmpP.y = A.y + uy * u + ux * off;
    J.steer(e, tmpP.x, tmpP.y, spd, dt);
    // если стенка/столб отбросили далеко от линии — догоняем параметр по факту
    const pu = (e.x - A.x) * ux + (e.y - A.y) * uy;
    if (pu > ai.su) ai.su = Math.min(L, pu);
    if (Math.abs((e.x - A.x) * -uy + (e.y - A.y) * ux - off) > 6) ai.sw = -1; // слишком далеко — отвязываемся
    return true;
  };

  // ---------- ИИ-машины ----------
  const S = { x: 0, y: 0, a: 0 };
  // есть ли движущаяся машина ближе r к точке
  TR.carNear = function (x, y, r) {
    const vs = G().vehs;
    for (let i = 0; i < vs.length; i++) {
      const v = vs[i];
      if (Math.abs(v.vf) < 1) continue;
      const dx = v.x - x, dy = v.y - y;
      if (dx * dx + dy * dy < r * r) return true;
    }
    return false;
  };
  const pickConn = (tr, L, bus) => {
    const out = L.out;
    if (!out.length) return null;
    let sum = 0;
    for (let i = 0; i < out.length; i++) sum += bus && tr.conns[out[i]].turn === 's' ? 3 : tr.conns[out[i]].w;
    let r = Math.random() * sum;
    for (let i = 0; i < out.length; i++) {
      const C = tr.conns[out[i]];
      r -= bus && C.turn === 's' ? 3 : C.w;
      if (r <= 0) return C;
    }
    return tr.conns[out[out.length - 1]];
  };
  TR.setLane = function (v, L, s) {
    const tr = G().world.traffic;
    v.path = L;
    v.s = s;
    v.hint.i = 0;
    v.nextC = pickConn(tr, L, v.type === 'bus');
    v.stopDone = false;
    v.busDone = false;
    v.stopT = 0;
    v.busT = 0;
    v.commit = false;
  };
  // целевая скорость машины на рельсах с учётом всего впереди
  function aiTarget(v, tr, t, dt) {
    const P = v.path, vt = v.vt;
    let vT = P.vmax * v.cruise;
    const halfL = vt.L / 2;
    v.waitWhy = 0;
    v.stopD = 1e9;
    const stopAt = (d) => {
      // плавная остановка: скорость, с которой ещё успеваем встать за d метров
      const vs = d <= 0 ? 0 : Math.sqrt(2 * vt.brk * 0.55 * d);
      if (vs < vT) vT = vs;
      if (d < v.stopD) v.stopD = d;
    };
    if (P.kind === 'lane') {
      const dEnd = P.len - v.s;
      const C = v.nextC;
      if (!C) stopAt(dEnd - halfL - 1);
      else {
        // ограничение на поворот
        if (C.vmax < vT) {
          const vs = Math.sqrt(C.vmax * C.vmax + 2 * 3.5 * Math.max(0, dEnd - halfL));
          if (vs < vT) vT = vs;
        }
        const N = tr.nodes[P.to];
        if (N.ctrl === 'signal') {
          const st = TR.signal(N, P.axis, t);
          const dStop = dEnd - halfL - 0.8;
          // нос уже за стоп-линией или на жёлтый не успеть встать — проезжаем
          if (dStop < 0.3 && st === 'G') v.commit = true;
          if (st === 'Y' && !v.commit && (v.vf * v.vf) / (2 * vt.brk * 0.8) >= dStop + 0.5) v.commit = true;
          if ((st === 'R' || st === 'Y') && !v.commit) {
            stopAt(dStop);
            v.waitWhy = 1;
          } else if (C.far && C.opp && dEnd < 18) {
            // поворот через встречку: уступаем тем, кто едет навстречу прямо
            const vs = G().vehs;
            for (let i = 0; i < vs.length; i++) {
              const o = vs[i];
              if (o.mode !== 'ai' || !o.path || o.path.kind !== 'lane' || o.vf < 1.5) continue;
              if (C.opp.indexOf(o.path.id) >= 0 && o.path.len - o.s < 26) {
                stopAt(dStop);
                v.waitWhy = 2;
                break;
              }
            }
          }
        } else if (N.ctrl === 'stop' && !v.stopDone) {
          const dStop = dEnd - halfL - 0.8;
          stopAt(dStop);
          if (dStop < 1.2 && v.vf < 0.3) {
            v.stopT += dt;
            if (v.stopT > 1.2 && !TR.carNear(N.x, N.y, Math.max(N.hx, N.hy) + 3)) v.stopDone = true;
          }
        }
      }
      // автобусная остановка
      if (v.type === 'bus' && P.busS > 0 && !v.busDone && v.s < P.busS + 1) {
        const d = P.busS - v.s;
        stopAt(d);
        if (d < 1.5 && v.vf < 0.3) {
          v.busT += dt;
          if (v.busT > 5) v.busDone = true;
        }
      }
    }
    // препятствия впереди: машины и люди в «коридоре» по курсу
    const look = 6 + v.vf * 1.7;
    const ca = Math.cos(v.ang), sa = Math.sin(v.ang);
    const vs = G().vehs;
    v.blk = null;
    for (let i = 0; i < vs.length; i++) {
      const o = vs[i];
      if (o === v) continue;
      const rx = o.x - v.x, ry = o.y - v.y;
      const reach = look + halfL + o.vt.L / 2;
      if (Math.abs(rx) > reach || Math.abs(ry) > reach) continue;
      const f = rx * ca + ry * sa;
      if (f <= 0) continue;
      const lat = Math.abs(-rx * sa + ry * ca);
      // поперечный размер другой машины с учётом её разворота
      const oc = Math.abs(Math.cos(o.ang - v.ang)), os = Math.abs(Math.sin(o.ang - v.ang));
      const oHalfW = o.vt.W / 2 * oc + o.vt.L / 2 * os, oHalfL = o.vt.L / 2 * oc + o.vt.W / 2 * os;
      if (lat > vt.W / 2 + oHalfW + 0.25) continue;
      if (f > reach) continue;
      // взаимная блокировка на перекрёстке: уступает машина с большим номером
      if (o.blk === v && o.id < v.id && o.mode === 'ai') continue;
      const gap = f - halfL - oHalfL - 2.2;
      const ov = Math.max(0, o.vx * ca + o.vy * sa);
      const vs2 = gap <= 0 ? 0 : Math.min(Math.sqrt(2 * vt.brk * 0.6 * gap) + ov * 0.6, ov + gap * 0.9);
      if (vs2 < vT) {
        vT = vs2;
        v.blk = o;
        v.waitWhy = 3;
      }
    }
    // стоящая поперёк полосы машина (авария, брошенная, игрок) — объезжаем по соседней полосе
    const b = v.blk;
    // на объезде навстречу едет машина — возвращаемся в свою полосу и ждём
    if (v.latT && b && b.mode === 'ai' && Math.cos(b.ang - v.ang) < -0.5) {
      v.latT = 0;
      v.blockT = 0;
    }
    v.blockT = b && b.mode !== 'ai' && Math.abs(b.vf) < 0.3 && v.vf < 1 ? v.blockT + dt : b && v.latT ? v.blockT : 0;
    const ents = G().ents;
    for (let i = 0; i < ents.length; i++) {
      const e = ents[i];
      if (e.dead || e.inCar || (e.st.fly > 0)) continue;
      const rx = e.x - v.x, ry = e.y - v.y;
      if (Math.abs(rx) > look + halfL + 2 || Math.abs(ry) > look + halfL + 2) continue;
      const f = rx * ca + ry * sa;
      if (f <= 0) continue;
      const lat = Math.abs(-rx * sa + ry * ca);
      if (lat > vt.W / 2 + 0.75) continue;
      const gap = f - halfL - 1.6;
      const vs2 = gap <= 0 ? 0 : Math.sqrt(2 * vt.brk * 0.7 * gap);
      if (vs2 < vT) {
        vT = vs2;
        v.waitWhy = 4;
        v.blkEnt = e;
      }
    }
    return vT;
  }

  // шаг ИИ-машины на рельсах
  TR.aiStep = function (v, dt, tr, t) {
    const vt = v.vt;
    const vT = aiTarget(v, tr, t, dt);
    const dv = vT - v.vf;
    let acc = dv > 0 ? Math.min(vt.acc * (1 - (v.vf / (vt.vmax + 1)) * 0.6), dv * 2.5) : Math.max(-vt.brk * 1.4, dv * 3);
    // точная остановка у стоп-линии: замедление, которого хватает ровно до неё
    if (v.stopD < 40 && v.vf > 0.05) {
      const need = (v.vf * v.vf) / (2 * Math.max(0.05, v.stopD));
      if (need > -acc) acc = -Math.min(need, vt.brk * 2);
    }
    v.vf = Math.max(0, v.vf + acc * dt);
    v.braking = acc < -1.2 || (v.vf < 0.2 && vT < 0.5);
    v.accel = acc;
    // ожидание: сигналим человеку на дороге или затору; долго стоим вдали от игрока — исчезаем
    if (v.vf < 0.3 && (v.waitWhy === 3 || v.waitWhy === 4)) {
      v.waitT += dt;
      if (v.waitT > 2.2 && v.honkT <= 0 && (v.waitWhy === 4 || v.waitT > 6)) {
        v.honkT = 4 + Math.random() * 4;
        J.Veh.honk(v, 0.6);
      }
    } else v.waitT = 0;
    v.honkT -= dt;
    v.stuckT = v.vf < 0.2 ? v.stuckT + dt : 0;
    // движение вдоль пути, переходы полоса → проезд → полоса
    v.s += v.vf * dt;
    let guard = 0;
    while (v.s >= v.path.len && guard++ < 4) {
      const over = v.s - v.path.len;
      const P = v.path;
      if (P.kind === 'lane') {
        if (!v.nextC) {
          v.s = P.len - 0.01;
          v.vf = 0;
          v.dead = true; // тупик
          break;
        }
        v.path = v.nextC;
        v.s = over;
        v.hint.i = 0;
      } else {
        TR.setLane(v, tr.lanes[P.to], over);
      }
    }
    TR.sample(v.path, v.s, S, v.hint);
    const pa = v.ang;
    // объезд: смещение к оси дороги (вправо по ходу — отрицательное для правостороннего)
    const rh = v.path.kind === 'lane' ? v.path.rh : tr.lanes[v.path.from].rh;
    if (v.blockT > 2.5 && !v.latT) v.latT = -rh * 3.2;
    else if (v.latT && !v.blk && v.vf > 2) {
      v.latClr = (v.latClr || 0) + dt;
      if (v.latClr > 2.2) v.latT = 0;
    } else v.latClr = 0;
    if (v.path.kind === 'conn' && v.latT) v.latT = 0; // на перекрёстке — по своей траектории
    v.lat += (v.latT - v.lat) * Math.min(1, dt * (0.5 + v.vf * 0.2));
    if (Math.abs(v.lat) < 0.01 && !v.latT) v.lat = 0;
    v.x = S.x - Math.sin(S.a) * v.lat;
    v.y = S.y + Math.cos(S.a) * v.lat;
    v.ang = S.a + (v.latT ? J.clamp((v.latT - v.lat) * 0.12, -0.25, 0.25) : 0);
    const yr = J.angDiff(pa, v.ang) / Math.max(dt, 1e-3);
    v.steer += (J.clamp(Math.atan((yr * vt.wb) / Math.max(1, v.vf)), -vt.steer, vt.steer) - v.steer) * Math.min(1, dt * 8);
    v.vx = Math.cos(v.ang) * v.vf;
    v.vy = Math.sin(v.ang) * v.vf;
    v.yawRate = yr;
  };

  // ---------- Появление и исчезновение ----------
  const pickType = (style, police) => {
    const mix = J.VMIX[style] || J.VMIX.usa;
    let sum = 0;
    for (const k in mix) if (k !== 'police' || police) sum += mix[k];
    let r = Math.random() * sum;
    for (const k in mix) {
      if (k === 'police' && !police) continue;
      r -= mix[k];
      if (r <= 0) return k;
    }
    return 'sedan';
  };
  TR.pickType = pickType;
  // свободно ли место на полосе (никого ближе gap по прямой)
  const freeAt = (x, y, gap) => {
    const vs = G().vehs;
    for (let i = 0; i < vs.length; i++) {
      const o = vs[i];
      if (Math.abs(o.x - x) < gap + o.vt.L / 2 && Math.abs(o.y - y) < gap + o.vt.L / 2) return false;
    }
    const ents = G().ents;
    for (let i = 0; i < ents.length; i++) if (Math.abs(ents[i].x - x) < 3 && Math.abs(ents[i].y - y) < 3) return false;
    return true;
  };
  TR.spawnAI = function (px, py, r0, r1, camFx, camFy, forcePolice) {
    const w = G().world, tr = TR.ensure(w);
    const gw = tr.gw;
    for (let k = 0; k < 6; k++) {
      const a = Math.random() * J.TAU, d = r0 + Math.random() * (r1 - r0);
      const x = px + Math.cos(a) * d, y = py + Math.sin(a) * d;
      const l = tr.cellLanes[Math.floor(y / CELL) * gw + Math.floor(x / CELL)];
      if (!l || !l.length) continue;
      const L = tr.lanes[l[(Math.random() * l.length) | 0]];
      if (L.len < 12) continue;
      const s = 4 + Math.random() * (L.len - 8);
      TR.sample(L, s, S, null);
      const dd = Math.hypot(S.x - px, S.y - py);
      if (dd < r0 || dd > r1 + 10) continue;
      // не появляемся прямо перед камерой вблизи
      if (dd < 70 && camFx !== undefined && (S.x - px) * camFx + (S.y - py) * camFy > dd * 0.35) continue;
      if (!freeAt(S.x, S.y, L.cls === 'hw' ? 16 : 9)) continue;
      const region = L.city ? J.REGION[L.city] : w.regionAt(S.x, S.y);
      const style = L.cls === 'hw' ? 'hw' : (region && region.style) || 'usa';
      let type = forcePolice ? 'police' : pickType(style, true);
      if (type === 'bus' && (L.cls !== 'ave' || L.k !== L.nl - 1)) type = 'sedan';
      if ((type === 'truck' || type === 'bus') && L.cls === 'st') type = 'van';
      const v = J.Veh.make(type, S.x, S.y, S.a, { mode: 'ai', region: region ? region.style : 'usa' });
      v.hint = { i: 0 };
      TR.setLane(v, L, s);
      // скорость появления — такая, чтобы успеть остановиться до конца полосы
      v.vf = Math.min(L.vmax * 0.6, Math.sqrt(2 * v.vt.brk * 0.5 * Math.max(0, L.len - s - v.vt.L / 2 - 2)));
      v.cruise = 0.85 + Math.random() * 0.2;
      return v;
    }
    return null;
  };
  // припаркованные машины у бордюра и на стоянках вокруг игрока (стабильно: одно и то же место — та же машина)
  TR.updateParked = function (px, py, maxN) {
    const w = G().world, tr = TR.ensure(w);
    const gw = tr.gw, cx = Math.floor(px / CELL), cy = Math.floor(py / CELL);
    let n = 0;
    const vs = G().vehs;
    for (let i = 0; i < vs.length; i++) if (vs[i].mode === 'parked' && vs[i].spot) n++;
    for (let dy = -2; dy <= 2 && n < maxN; dy++)
      for (let dx = -2; dx <= 2 && n < maxN; dx++) {
        const l = tr.cellPark[(cy + dy) * gw + cx + dx];
        if (!l) continue;
        for (const si of l) {
          const sp = w.parkSpots[si];
          if (sp.veh || sp.taken) continue;
          const d = Math.hypot(sp.x - px, sp.y - py);
          if (d > 62 || d < 8) continue;
          const h = J.hash2(Math.floor(sp.x * 4), Math.floor(sp.y * 4), 913);
          if (h > (sp.lot ? 0.62 : 0.5)) continue;
          if (!freeAt(sp.x, sp.y, 2.5)) continue;
          const region = w.regionAt(sp.x, sp.y);
          const style = region.style || 'usa';
          let type = 'sedan';
          const hk = J.hash2(Math.floor(sp.x * 4), Math.floor(sp.y * 4), 77);
          const mix = J.VMIX[style] || J.VMIX.usa;
          let sum = 0;
          for (const k in mix) if (k !== 'bus' && k !== 'truck' && k !== 'police') sum += mix[k];
          let r = hk * sum;
          for (const k in mix) {
            if (k === 'bus' || k === 'truck' || k === 'police') continue;
            r -= mix[k];
            if (r <= 0) {
              type = k;
              break;
            }
          }
          if (sp.lot && type === 'van' && hk > 0.5) type = 'hatch';
          // у бордюра: борт в 8 см от него (центр места — в 1 м от бордюра), широкие машины — дальше от столбов
          let x = sp.x, y = sp.y;
          if (!sp.lot) {
            const nx = -Math.sin(sp.ang), ny = Math.cos(sp.ang);
            const sgn = (J.GRID[style] || J.GRID.usa).drive === 'R' ? 1 : -1;
            const sh = 1.0 - (J.VTYPES[type].W / 2 + 0.08);
            x += nx * sh * sgn;
            y += ny * sh * sgn;
          }
          const v = J.Veh.make(type, x, y, sp.ang + (sp.lot && h < 0.25 ? Math.PI : 0), { mode: 'parked', region: style, colorHash: J.hash2(Math.floor(sp.x * 4), Math.floor(sp.y * 4), 5) });
          v.spot = sp;
          sp.veh = v;
          n++;
          if (n >= maxN) break;
        }
      }
  };

  // ---------- Покадровое обновление потока ----------
  TR.limits = function () {
    const q = J.R3.quality === undefined ? 1 : J.R3.quality;
    return q === 0 ? { ai: 9, parked: 8 } : q === 1 ? { ai: 15, parked: 12 } : { ai: 20, parked: 16 };
  };
  TR._spawnT = 0;
  TR._parkT = 0;
  TR.update = function (dt, px, py) {
    const g = G(), w = g.world, tr = TR.ensure(w);
    if (!tr) return;
    const vs = g.vehs;
    const lim = TR.limits();
    const city = w.cityAt(px, py);
    const he = city ? null : w.edgeAt(px, py);
    const onHw = !!(he && he.cls === 'hw');
    // убираем далёкие и застрявшие (кроме машины игрока и брошенных им машин поблизости)
    let nAI = 0;
    for (let i = vs.length - 1; i >= 0; i--) {
      const v = vs[i];
      const d = Math.hypot(v.x - px, v.y - py);
      const keep = v.driver && v.driver.isPlayer;
      let gone = false;
      if (!keep) {
        if (v.mode === 'ai' && (d > 125 || v.dead || (v.stuckT > 25 && d > 40))) gone = true;
        else if (v.mode === 'parked' && d > (v.owned ? 220 : 85)) gone = true;
        else if (v.mode === 'free' && d > (v.owned ? 220 : 110)) gone = true;
        else if (v.hp <= 0 && d > 60) gone = true;
      }
      if (gone) J.Veh.remove(v, i);
      else if (v.mode === 'ai') nAI++;
    }
    // новые машины: в городе — полная плотность, на шоссе — меньше, за городом — нет
    TR._spawnT -= dt;
    const want = city ? lim.ai : onHw ? Math.round(lim.ai * 0.5) : 0;
    if (TR._spawnT <= 0 && nAI < want) {
      TR._spawnT = nAI < want * 0.5 ? 0.05 : 0.25;
      const c = J.R3.cam;
      const fx = Math.cos(c.yaw), fy = Math.sin(c.yaw);
      const first = !TR._filled;
      TR.spawnAI(px, py, first ? 18 : 55, first ? 90 : 95, first ? undefined : fx, fy);
    }
    if (nAI >= want * 0.8) TR._filled = true;
    TR._parkT -= dt;
    if (TR._parkT <= 0) {
      TR._parkT = 0.6;
      if (city) TR.updateParked(px, py, lim.parked);
    }
  };
  TR.reset = function () {
    TR._filled = false;
    TR._spawnT = 0;
    TR._parkT = 0;
  };
})();
