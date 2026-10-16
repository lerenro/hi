'use strict';
// Большие машины: городской автобус (в Лондоне — двухэтажный) и грузовик-фургон с кабиной.
// Кузов — коробки со скруглёнными рёбрами (фаски с плавными нормалями), вырезы под колёсные арки с нишами,
// окна и двери со стёклами отдельной геометрией, салон (сиденья, поручни, место водителя), зеркала на кронштейнах,
// бамперы, решётка, фары, табло маршрута, номера. Формат — как у CM.buildCar: { body, glass, brake, siren, seat, zoff, fx, bumper }.
// Локальная система: +z — вперёд, +x — левый борт, y — вверх.
(function () {
  const CM = J.CarModels, C = CM.C, CB = CM.CB, plate = CM.plate;
  const col = (h) => new THREE.Color(h);
  const refOf = (cl) => CM.refOf(cl);

  // четырёхугольник с нормалями вершин; обход выбирается по нормалям (лицом наружу)
  function Q(gb, a, b, c, d, na, nb, nc, nd, cl, ref, glow) {
    const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2], vx = d[0] - a[0], vy = d[1] - a[1], vz = d[2] - a[2];
    const fx = uy * vz - uz * vy, fy = uz * vx - ux * vz, fz = ux * vy - uy * vx;
    const e = fx * (na[0] + nb[0] + nc[0] + nd[0]) + fy * (na[1] + nb[1] + nc[1] + nd[1]) + fz * (na[2] + nb[2] + nc[2] + nd[2]);
    const rf = ref === undefined ? refOf(cl) : ref, gl = glow || 0;
    if (e >= 0) {
      gb.triN(a, na, b, nb, c, nc, cl, rf, gl);
      gb.triN(a, na, c, nc, d, nd, cl, rf, gl);
    } else {
      gb.triN(a, na, c, nc, b, nb, cl, rf, gl);
      gb.triN(a, na, d, nd, c, nc, cl, rf, gl);
    }
  }
  const QF = (gb, a, b, c, d, n, cl, ref, glow) => Q(gb, a, b, c, d, n, n, n, n, cl, ref, glow);
  function T(gb, a, b, c, na, nb, nc, cl, ref, glow) {
    const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2], vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
    const fx = uy * vz - uz * vy, fy = uz * vx - ux * vz, fz = ux * vy - uy * vx;
    const e = fx * (na[0] + nb[0] + nc[0]) + fy * (na[1] + nb[1] + nc[1]) + fz * (na[2] + nb[2] + nc[2]);
    const rf = ref === undefined ? refOf(cl) : ref, gl = glow || 0;
    if (e >= 0) gb.triN(a, na, b, nb, c, nc, cl, rf, gl);
    else gb.triN(a, na, c, nc, b, nb, cl, rf, gl);
  }
  // произвольно повёрнутый брусок (кронштейны, дворники): центр, размеры, углы Эйлера
  const mB = new THREE.Matrix4(), eB = new THREE.Euler(), qB = new THREE.Quaternion(), pB = new THREE.Vector3(), sB = new THREE.Vector3();
  let unitBox = null;
  function obox(gb, x, y, z, sx, sy, sz, rx, ry, rz, cl, ref) {
    if (!unitBox) unitBox = new THREE.BoxGeometry(1, 1, 1).toNonIndexed();
    mB.compose(pB.set(x, y, z), qB.setFromEuler(eB.set(rx, ry, rz, 'YXZ')), sB.set(sx, sy, sz));
    gb.geo(unitBox, mB, cl, ref);
  }
  function cyl(gb, r0, r1, h, seg, m, cl, ref) {
    const g = new THREE.CylinderGeometry(r0, r1, h, seg, 1);
    gb.geo(g, m, cl, ref);
  }
  // сетка значений: границы + внутренние линии, по возрастанию, без повторов
  function lines(a, b, extra) {
    const out = [a];
    for (const v of extra.slice().sort((p, q) => p - q)) if (v > a + 1e-4 && v < b - 1e-4 && v - out[out.length - 1] > 1e-4) out.push(v);
    out.push(b);
    return out;
  }
  const NX = [1, 0, 0], NXm = [-1, 0, 0], NY = [0, 1, 0], NYm = [0, -1, 0], NZ = [0, 0, 1], NZm = [0, 0, -1];
  // ячейка: функция цвета → null (дыра) | Color | [Color, ref, glow]
  function paintCell(gb, r, a, b, c, d, na, nb, nc, nd) {
    if (!r) return;
    if (r.isColor) Q(gb, a, b, c, d, na, nb, nc, nd, r);
    else Q(gb, a, b, c, d, na, nb, nc, nd, r[0], r[1], r[2]);
  }

  // ---------- Коробка со скруглёнными рёбрами ----------
  // o: { hw, y0, y1, z0, z1, c — радиус фасок (верх и вертикальные рёбра), zs/ys/xs — доп. линии сетки граней,
  //      f(face, u, v) — цвет ячейки: 'L'/'R' — борт (u = z, v = y), 'F'/'B' — нос/корма (u = x, v = y), 'T' — крыша (u = x, v = z),
  //      'V' — вертикальное ребро (u = индекс угла, v = y), 'E' — верхнее ребро (u = сторона, v = координата вдоль), bottom — дно }
  function rbox(gb, o) {
    const { hw, y0, y1, z0, z1 } = o, c = o.c || 0, f = o.f;
    const Ys = lines(y0, y1 - c, o.ys || []);
    const Zs = lines(z0 + c, z1 - c, o.zs || []);
    const Xs = lines(-(hw - c), hw - c, o.xs || []);
    // борта
    for (const s of [1, -1]) {
      const n = s > 0 ? NX : NXm, x = s * hw;
      for (let i = 0; i < Zs.length - 1; i++)
        for (let j = 0; j < Ys.length - 1; j++) {
          const za = Zs[i], zb = Zs[i + 1], ya = Ys[j], yb = Ys[j + 1];
          paintCell(gb, f(s > 0 ? 'L' : 'R', (za + zb) / 2, (ya + yb) / 2), [x, ya, za], [x, ya, zb], [x, yb, zb], [x, yb, za], n, n, n, n);
        }
    }
    // нос и корма
    for (const s of [1, -1]) {
      const n = s > 0 ? NZ : NZm, z = s > 0 ? z1 : z0;
      for (let i = 0; i < Xs.length - 1; i++)
        for (let j = 0; j < Ys.length - 1; j++) {
          const xa = Xs[i], xb = Xs[i + 1], ya = Ys[j], yb = Ys[j + 1];
          paintCell(gb, f(s > 0 ? 'F' : 'B', (xa + xb) / 2, (ya + yb) / 2), [xa, ya, z], [xb, ya, z], [xb, yb, z], [xa, yb, z], n, n, n, n);
        }
    }
    // крыша
    const Xt = lines(-(hw - c), hw - c, o.xs || []);
    for (let i = 0; i < Xt.length - 1; i++)
      for (let j = 0; j < Zs.length - 1; j++) {
        const xa = Xt[i], xb = Xt[i + 1], za = Zs[j], zb = Zs[j + 1];
        paintCell(gb, f('T', (xa + xb) / 2, (za + zb) / 2), [xa, y1, za], [xb, y1, za], [xb, y1, zb], [xa, y1, zb], NY, NY, NY, NY);
      }
    if (o.bottom) QF(gb, [-hw, y0, z0], [hw, y0, z0], [hw, y0, z1], [-hw, y0, z1], NYm, o.bottom, 0);
    if (c <= 0) return;
    // вертикальные рёбра
    let k = 0;
    for (const sx of [1, -1])
      for (const sz of [1, -1]) {
        const na = sx > 0 ? NX : NXm, nb = sz > 0 ? NZ : NZm;
        const zi = sz > 0 ? z1 - c : z0 + c, ze = sz > 0 ? z1 : z0;
        for (let j = 0; j < Ys.length - 1; j++) {
          const ya = Ys[j], yb = Ys[j + 1];
          paintCell(gb, f('V', k, (ya + yb) / 2), [sx * hw, ya, zi], [sx * (hw - c), ya, ze], [sx * (hw - c), yb, ze], [sx * hw, yb, zi], na, nb, nb, na);
        }
        // угловой треугольник крыши
        const r = f('E', k + 10, 0);
        if (r) T(gb, [sx * hw, y1 - c, zi], [sx * (hw - c), y1 - c, ze], [sx * (hw - c), y1, zi], na, nb, NY, r.isColor ? r : r[0], r.isColor ? undefined : r[1]);
        k++;
      }
    // верхние рёбра: вдоль бортов и поперёк носа/кормы
    for (const s of [1, -1]) {
      const n = s > 0 ? NX : NXm;
      for (let i = 0; i < Zs.length - 1; i++) {
        const za = Zs[i], zb = Zs[i + 1];
        paintCell(gb, f('E', s, (za + zb) / 2), [s * hw, y1 - c, za], [s * hw, y1 - c, zb], [s * (hw - c), y1, zb], [s * (hw - c), y1, za], n, n, NY, NY);
      }
      const nz = s > 0 ? NZ : NZm, z = s > 0 ? z1 : z0, zi = s > 0 ? z1 - c : z0 + c;
      for (let i = 0; i < Xt.length - 1; i++) {
        const xa = Xt[i], xb = Xt[i + 1];
        paintCell(gb, f('E', s * 2, (xa + xb) / 2), [xa, y1 - c, z], [xb, y1 - c, z], [xb, y1, zi], [xa, y1, zi], nz, nz, NY, NY);
      }
    }
  }
  // внутренняя «обивка»: грани коробки лицом внутрь (виден дальний борт сквозь окна)
  // lamp — свечение потолка (салон автобуса освещён ночью)
  function ibox(gb, x0, x1, y0, y1, z0, z1, cWall, cFloor, cCeil, lamp) {
    QF(gb, [x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1], NY, cFloor, 0.05);
    if (cCeil) QF(gb, [x0, y1, z0], [x1, y1, z0], [x1, y1, z1], [x0, y1, z1], NYm, cCeil, 0.03, lamp || 0);
    QF(gb, [x0, y0, z0], [x0, y1, z0], [x0, y1, z1], [x0, y0, z1], NX, cWall, 0.05);
    QF(gb, [x1, y0, z0], [x1, y1, z0], [x1, y1, z1], [x1, y0, z1], NXm, cWall, 0.05);
    QF(gb, [x0, y0, z0], [x1, y0, z0], [x1, y1, z0], [x0, y1, z0], NZ, cWall, 0.05);
    QF(gb, [x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1], NZm, cWall, 0.05);
  }
  // проём в борту (ax = 'x': плоскость x = s·hw, u — z) или в торце (ax = 'z': плоскость z = pz, u — x):
  // откосы-уплотнитель внутрь и стекло на глубине d
  function opening(body, glass, ax, s, pl, u0, u1, v0, v1, d, gcl) {
    const P = ax === 'x' ? (u, v, k) => [s * (pl - k), v, u] : (u, v, k) => [u, v, pl - s * k];
    const n = ax === 'x' ? (s > 0 ? NX : NXm) : s > 0 ? NZ : NZm;
    const nU0 = ax === 'x' ? NZ : NX, nU1 = ax === 'x' ? NZm : NXm;
    // откосы смотрят в центр проёма
    QF(body, P(u0, v0, 0), P(u0, v1, 0), P(u0, v1, d), P(u0, v0, d), nU0, C.RUB, 0.1);
    QF(body, P(u1, v0, 0), P(u1, v1, 0), P(u1, v1, d), P(u1, v0, d), nU1, C.RUB, 0.1);
    QF(body, P(u0, v0, 0), P(u1, v0, 0), P(u1, v0, d), P(u0, v0, d), NY, C.RUB, 0.1);
    QF(body, P(u0, v1, 0), P(u1, v1, 0), P(u1, v1, d), P(u0, v1, d), NYm, C.RUB, 0.1);
    if (glass) QF(glass, P(u0, v0, d), P(u1, v0, d), P(u1, v1, d), P(u0, v1, d), n, gcl || C.GLASS, 1);
  }
  // колёсная арка: заполнение борта над полукругом, ниша и резиновая кромка
  function arch(body, s, hw, zc, yc, Ra, ytop, y0, depth, fill, hi) {
    const N = hi ? 12 : 7, x = s * hw, xi = s * (hw - depth), n = s > 0 ? NX : NXm;
    for (let k = 0; k < N; k++) {
      const a0 = (k / N) * Math.PI, a1 = ((k + 1) / N) * Math.PI;
      const za = zc + Ra * Math.cos(a0), ya = yc + Ra * Math.sin(a0), zb = zc + Ra * Math.cos(a1), yb = yc + Ra * Math.sin(a1);
      paintCell(body, fill((za + zb) / 2, (ytop + Math.max(ya, yb)) / 2), [x, ya, za], [x, yb, zb], [x, ytop, zb], [x, ytop, za], n, n, n, n);
      // ниша: внутренняя поверхность цилиндра
      const n0 = [0, -Math.sin(a0), -Math.cos(a0)], n1 = [0, -Math.sin(a1), -Math.cos(a1)];
      Q(body, [x, ya, za], [x, yb, zb], [xi, yb, zb], [xi, ya, za], n0, n1, n1, n0, C.UNDER, 0);
      // кромка
      const R2 = Ra + 0.055, x2 = s * (hw + 0.004);
      const qa = [x2, yc + R2 * Math.sin(a0), zc + R2 * Math.cos(a0)], qb = [x2, yc + R2 * Math.sin(a1), zc + R2 * Math.cos(a1)];
      QF(body, [x2, ya, za], [x2, yb, zb], qb, qa, n, C.RUB, 0.05);
    }
    // вертикальные стенки ниши ниже оси
    for (const e of [1, -1]) {
      const z = zc + e * Ra;
      QF(body, [x, y0, z], [x, yc, z], [xi, yc, z], [xi, y0, z], e > 0 ? NZm : NZ, C.UNDER, 0);
    }
    QF(body, [xi, y0, zc - Ra], [xi, yc + Ra, zc - Ra], [xi, yc + Ra, zc + Ra], [xi, y0, zc + Ra], s > 0 ? NXm : NX, C.UNDER, 0);
  }
  const inArch = (arches, z, y) => arches.some((a) => Math.abs(z - a.zc) < a.Ra && y < a.top);
  // зеркало заднего вида на кронштейне
  function mirrorArm(body, s, x0, y0, z0, x1, y1, z1, mh, mw) {
    const dx = x1 - x0, dy = y1 - y0, dz = z1 - z0, L = Math.hypot(dx, dy, dz);
    const ry = Math.atan2(dx, dz), rx = -Math.asin(dy / L);
    obox(body, (x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2, 0.035, 0.035, L, rx, ry, 0, C.TRIM, 0.2);
    body.box(x1 - mw / 2, y1 - mh, z1 - 0.06, x1 + mw / 2, y1 + 0.02, z1 + 0.04, C.TRIM, 0.25);
    plate(body, x1 + mw / 2 - 0.015, x1 - mw / 2 + 0.015, y1 - mh + 0.02, y1, z1 - 0.062, -1, C.MIRROR, 2.1);
  }
  // сиденье лицом вперёд (+z)
  function seat(body, x, y, z, w, cl) {
    body.box(x - w / 2, y, z - 0.22, x + w / 2, y + 0.1, z + 0.22, cl, 0.06);
    body.box(x - w / 2, y + 0.1, z - 0.24, x + w / 2, y + 0.62, z - 0.14, cl, 0.06);
    body.box(x - 0.04, y - 0.4, z - 0.05, x + 0.04, y, z + 0.05, C.TRIM, 0.3);
  }

  // ---------- Автобус ----------
  const BUS_INT = col('#6c7076'), BUS_FLOOR = col('#2c2d30'), BUS_CEIL = col('#b8bbbe'), BUS_SEAT = col('#2e3f6e'), POLE = col('#e8c21a'), LED = col('#ff9a1a');
  CM.buildBus = function (t, paint, livery, region, lod) {
    const hi = lod !== 1;
    const body = new CB(hi ? 12000 : 4000), glass = new CB(hi ? 800 : 300), brake = new CB(96);
    const dd = region === 'london'; // двухэтажный
    const L = t.L, W = t.W, H = dd ? 4.3 : t.H, wr = t.wr, wb = t.wb, zoff = 0.25;
    const hw = W / 2, zF = L / 2, zR = -L / 2, c = 0.2, y0 = 0.32;
    const drL = CM.DRIVE_L[region] ? -1 : 1, sd = -drL; // руль у борта drL, двери — у тротуара
    const P2 = paint.clone().multiplyScalar(0.72);
    const stripe = dd ? col('#efe6cf') : paint.getHSL({}).l > 0.6 ? col('#1f5aa8') : col('#f2f2f0');
    // уровни
    const yW0 = 1.22, yW1 = dd ? 2.1 : H - 0.42, yU0 = 2.6, yU1 = H - 0.3;
    const yS0 = yW0 - 0.1, yS1 = yW0 - 0.02, yBmp = y0 + 0.3;
    const yWs0 = 0.96, yWs1 = dd ? 2.02 : H - 0.55;
    // колёса и арки
    const Ra = wr * 1.12, aF = wb / 2 + zoff, aR = -wb / 2 + zoff;
    const arches = [aF, aR].map((zc) => ({ zc, Ra, top: Math.min(yS0, wr + Ra + 0.06) }));
    // двери у тротуара: передняя (перед передней осью) и средняя
    const doors = [[aF + Ra + 0.15, zF - 0.32], [-0.6, 0.65]];
    if (L > 10.5) doors.push([aR - Ra - 1.25, aR - Ra - 0.1]);
    const inDoor = (z) => doors.some((d) => z > d[0] && z < d[1]);
    // окна по борту: равные пролёты между стойками
    const wins = [];
    {
      const za = zR + 0.55, zb = zF - 0.5, n = Math.round((zb - za) / 1.35), step = (zb - za) / n;
      for (let k = 0; k < n; k++) wins.push([za + k * step + 0.05, za + (k + 1) * step - 0.05]);
    }
    // части окон у бортa с дверями — без проёмов дверей (с запасом под стойку)
    const segs = (s, w) => {
      let out = [w];
      if (s !== sd) return out;
      for (const d of doors) {
        const a = d[0] - 0.22, b = d[1] + 0.22, nx = [];
        for (const q of out) {
          if (q[1] <= a || q[0] >= b) nx.push(q);
          else {
            if (q[0] < a - 0.12) nx.push([q[0], a]);
            if (q[1] > b + 0.12) nx.push([b, q[1]]);
          }
        }
        out = nx;
      }
      return out;
    };
    const inWin = (z, s) => wins.some((w) => segs(s, w).some((q) => z > q[0] && z < q[1]));
    const zs = [];
    for (const a of arches) zs.push(a.zc - a.Ra, a.zc + a.Ra);
    for (const d of doors) zs.push(d[0], d[1]);
    for (const s of [1, -1]) for (const w of wins) for (const q of segs(s, w)) zs.push(q[0], q[1]);
    if (hi) for (let z = zR; z < zF; z += 1.1) zs.push(z); // плотнее сетка — вмятины ложатся мягче
    const ys = [yBmp, yS0, yS1, yW0, yW1, arches[0].top, yWs0, yWs1, yW0 + 0.35];
    if (hi) ys.push((y0 + yW0) / 2);
    if (dd) ys.push(yU0, yU1, yW1 + 0.1, yU0 - 0.1);
    const xs = [];
    const xWs = hw - c - 0.04;
    xs.push(-xWs, xWs, -(hw - c - 0.5), hw - c - 0.5);
    if (hi) for (let x = -1; x <= 1; x += 0.5) xs.push(x);
    const band = (y) => (y < yBmp ? [C.TRIM, 0.12] : !dd && y > yS0 && y < yS1 ? stripe : dd && y > yW1 + 0.1 && y < yU0 - 0.1 ? stripe : paint);
    rbox(body, {
      hw, y0, y1: H, z0: zR, z1: zF, c, zs, ys, xs, bottom: C.UNDER,
      f(face, u, v) {
        if (face === 'L' || face === 'R') {
          const s = face === 'L' ? 1 : -1;
          if (inArch(arches, u, v)) return null;
          if (s === sd && inDoor(u) && v < yW1) return null;
          if (v > yW0 && v < yW1) return inWin(u, s) ? null : [C.TRIM, 0.35];
          if (dd && v > yU0 && v < yU1) return inWin(u, 0) ? null : [C.TRIM, 0.35];
          return band(v);
        }
        if (face === 'F') {
          if (Math.abs(u) < xWs && v > yWs0 && v < yWs1) return null;
          if (dd && Math.abs(u) < xWs && v > yU0 && v < yU1) return null;
          return v < yBmp ? [C.TRIM, 0.12] : paint;
        }
        if (face === 'B') {
          if (Math.abs(u) < hw - c - 0.5 && v > yW0 + 0.35 && v < yW1) return null;
          if (dd && Math.abs(u) < hw - c - 0.5 && v > yU0 && v < yU1) return null;
          return v < yBmp ? [C.TRIM, 0.12] : paint;
        }
        if (face === 'V') return (v > yW0 && v < yW1) || (dd && v > yU0 && v < yU1) ? [C.TRIM, 0.35] : band(v);
        return paint;
      },
    });
    for (const a of arches) for (const s of [1, -1]) arch(body, s, hw, a.zc, wr, a.Ra, a.top, y0, 0.55, (z, y) => band(y), hi);
    // стёкла: боковые окна, лобовое, заднее
    const D = 0.03;
    for (const s of [1, -1])
      for (const w of wins) {
        for (const q of segs(s, w)) opening(body, glass, 'x', s, hw, q[0], q[1], yW0, yW1, D);
        if (dd) opening(body, glass, 'x', s, hw, w[0], w[1], yU0, yU1, D);
      }
    for (const d of doors) {
      const s = sd, x = s * hw;
      const n = s > 0 ? NX : NXm, zm = (d[0] + d[1]) / 2;
      // проём двери: откосы, створки — стекло в тёмной раме
      opening(body, null, 'x', s, hw, d[0], d[1], y0, yW1, 0.05);
      for (const [za, zb] of [[d[0], zm - 0.01], [zm + 0.01, d[1]]]) {
        const xr = s * (hw - 0.05);
        QF(body, [xr, y0 + 0.1, za], [xr, y0 + 0.1, zb], [xr, yW1, zb], [xr, yW1, za], n, C.TRIM, 0.3);
        QF(glass, [s * (hw - 0.045), y0 + 0.2, za + 0.06], [s * (hw - 0.045), y0 + 0.2, zb - 0.06], [s * (hw - 0.045), yW1 - 0.08, zb - 0.06], [s * (hw - 0.045), yW1 - 0.08, za + 0.06], n, C.GLASS, 1);
      }
      if (hi) QF(body, [x * 1.003, yW1 + 0.03, d[0]], [x * 1.003, yW1 + 0.03, d[1]], [x * 1.003, yW1 + 0.09, d[1]], [x * 1.003, yW1 + 0.09, d[0]], n, LED, 0.5, 0.25);
    }
    opening(body, glass, 'z', 1, zF, -xWs, xWs, yWs0, yWs1, 0.04);
    if (dd) opening(body, glass, 'z', 1, zF, -xWs, xWs, yU0, yU1, 0.04);
    opening(body, glass, 'z', -1, zR, -(hw - c - 0.5), hw - c - 0.5, yW0 + 0.35, yW1, 0.04);
    if (dd) opening(body, glass, 'z', -1, zR, -(hw - c - 0.5), hw - c - 0.5, yU0, yU1, 0.04);
    // ---------- Перед ----------
    const fz = zF + 0.002;
    // табло маршрута: тёмное поле и светящиеся «буквы»
    const yT0 = yWs1 + 0.08, yT1 = yWs1 + 0.34;
    plate(body, -xWs + 0.05, xWs - 0.05, yT0, yT1, fz, 1, C.GRILLE, 0.6);
    if (hi) {
      let x = -xWs + 0.15;
      for (let k = 0; k < 15 && x < xWs - 0.2; k++) {
        const w = k === 2 ? 0.12 : 0.05 + ((k * 37) % 5) * 0.012;
        plate(body, x, x + w, yT0 + 0.07, yT1 - 0.07, fz + 0.002, 1, LED, 0.3, 1);
        x += w + (k === 2 ? 0.14 : 0.035);
      }
    } else plate(body, -xWs + 0.15, xWs - 0.3, yT0 + 0.08, yT1 - 0.08, fz + 0.002, 1, LED, 0.3, 1);
    // фары, поворотники, решётка
    const front = [];
    for (const s of [1, -1]) {
      const xa = s * (hw - c - 0.04), xb = s * (hw - c - 0.42);
      plate(body, xa + s * 0.015, xb - s * 0.015, yBmp + 0.1, yBmp + 0.38, fz, 1, C.TRIM, 0.4);
      plate(body, xa, (xa + xb) / 2 + s * 0.01, yBmp + 0.2, yBmp + 0.36, fz + 0.002, 1, C.HEAD, 0.9, 1);
      plate(body, (xa + xb) / 2 - s * 0.01, xb, yBmp + 0.2, yBmp + 0.36, fz + 0.002, 1, C.HEAD, 0.9, 1);
      plate(body, xa, xb, yBmp + 0.12, yBmp + 0.18, fz + 0.002, 1, C.AMBER, 0.8, 0.2);
      front.push([(xa + xb) / 2, yBmp + 0.28]);
    }
    plate(body, -0.55, 0.55, yBmp + 0.12, yBmp + 0.42, fz, 1, C.GRILLE, 0.15);
    for (let k = 1; k < 4; k++) plate(body, -0.53, 0.53, yBmp + 0.12 + k * 0.075 - 0.008, yBmp + 0.12 + k * 0.075 + 0.008, fz + 0.002, 1, C.TRIM, 0.3);
    CM.drawPlate(body, 'bus', 'bus' + paint.getHexString(), region, hi, fz + 0.004, 1, y0 + 0.15, false);
    // дворники
    if (hi) for (const s of [1, -1]) obox(body, s * 0.45, yWs0 + 0.25, zF + 0.045, 0.025, 0.55, 0.02, 0, 0, s * 0.5, C.WIPER, 0);
    // зеркала «рожки» над лобовым стеклом
    for (const s of [1, -1]) mirrorArm(body, s, s * (hw - 0.05), yWs1 + 0.1, zF - 0.1, s * (hw + 0.22), yWs1 - 0.05, zF + 0.32, 0.42, 0.2);
    // ---------- Корма ----------
    const rz = zR - 0.002;
    const rear = [];
    for (const s of [1, -1]) {
      const xa = s * (hw - c - 0.03), xb = s * (hw - c - 0.24);
      plate(body, xa + s * 0.015, xb - s * 0.015, yBmp + 0.05, yW0 + 0.3, rz, -1, C.TRIM, 0.4);
      plate(body, xa, xb, yBmp + 0.5, yW0 + 0.28, rz - 0.002, -1, C.TAIL, 0.8, 0.42);
      plate(body, xa, xb, yBmp + 0.3, yBmp + 0.48, rz - 0.002, -1, C.AMBER, 0.8, 0.2);
      plate(body, xa, xb, yBmp + 0.07, yBmp + 0.28, rz - 0.002, -1, C.REV, 0.8, 0);
      plate(brake, xa, xb, yBmp + 0.5, yW0 + 0.28, rz - 0.01, -1, col('#ff2a1a'), 0, 0);
      rear.push([(xa + xb) / 2, yBmp + 0.7]);
    }
    // решётка моторного отсека
    plate(body, -0.75, 0.75, yBmp + 0.1, yW0 - 0.05, rz, -1, C.GRILLE, 0.15);
    for (let k = 0; k < 7; k++) {
      const y = yBmp + 0.16 + k * 0.095;
      if (y > yW0 - 0.1) break;
      plate(body, -0.72, 0.72, y, y + 0.03, rz - 0.002, -1, P2, 0.3);
    }
    CM.drawPlate(body, 'bus', 'bus' + paint.getHexString(), region, hi, rz - 0.004, -1, y0 + 0.16, true);
    plate(body, -0.3, 0.3, yW1 + 0.05, yW1 + 0.2, rz, -1, C.GRILLE, 0.6);
    plate(body, -0.25, 0.1, yW1 + 0.08, yW1 + 0.17, rz - 0.002, -1, LED, 0.3, 1);
    plate(brake, -0.4, 0.4, H - 0.12, H - 0.06, rz - 0.01, -1, col('#ff2a1a'), 0, 0);
    // ---------- Крыша: кондиционер и люки ----------
    rbox(body, { hw: 0.78, y0: H, y1: H + 0.2, z0: dd ? -1.2 : -1.6, z1: dd ? 0.6 : 0.9, c: 0.07, f: (face) => (face === 'T' ? col('#d4d6d8') : col('#c4c6c8')) });
    if (hi) for (const z of [2.6, -3]) body.box(-0.35, H, z - 0.35, 0.35, H + 0.06, z + 0.35, col('#bcbec2'), 0.4);
    // ---------- Салон ----------
    if (hi) {
      const yf = 0.55, xi = hw - 0.06;
      ibox(body, -xi, xi, yf, dd ? yU0 - 0.32 : H - 0.12, zR + 0.12, zF - 0.12, BUS_INT, BUS_FLOOR, BUS_CEIL, 0.3);
      // кресла рядами по обоим бортам (пропуская двери, место водителя и арки)
      for (const s of [1, -1])
        for (let z = zR + 0.7; z < zF - 1.6; z += 0.82) {
          if (s === sd && doors.some((d) => z > d[0] - 0.4 && z < d[1] + 0.4)) continue;
          const y = arches.some((a) => Math.abs(z - a.zc) < a.Ra) ? yf + 0.62 : yf + 0.38;
          seat(body, s * (xi - 0.28), y, z, 0.42, BUS_SEAT);
          seat(body, s * (xi - 0.72), y, z, 0.42, BUS_SEAT);
        }
      // поручни у дверей
      for (const d of doors) for (const z of [d[0] - 0.08, d[1] + 0.08]) body.box(sd * (xi - 0.5) - 0.02, yf, z - 0.02, sd * (xi - 0.5) + 0.02, dd ? yU0 - 0.32 : H - 0.12, z + 0.02, POLE, 0.5);
      body.box(-0.02, yf, -2.2, 0.02, H - 0.12, -2.16, POLE, 0.5);
      // место водителя: панель и руль
      body.box(-xi, yf, zF - 0.5, xi, yWs0 + 0.05, zF - 0.12, C.DASH, 0.1);
      const xd = drL * (xi - 0.55);
      seat(body, xd, yf + 0.42, zF - 1.25, 0.5, C.SEAT);
      cyl(body, 0.24, 0.24, 0.05, 12, new THREE.Matrix4().makeRotationX(-0.9).setPosition(xd, yWs0 + 0.12, zF - 0.7), C.TRIM, 0.2);
      body.box(drL * 0.15, yf, zF - 1.0, drL * 0.2, yf + 1.0, zF - 0.95, C.TRIM, 0.2);
      if (dd) {
        // пол второго этажа и кресла наверху
        ibox(body, -xi, xi, yU0 - 0.3, H - 0.12, zR + 0.12, zF - 0.12, BUS_INT, BUS_FLOOR, BUS_CEIL, 0.3);
        for (const s of [1, -1]) for (let z = zR + 0.7; z < zF - 0.6; z += 0.82) {
          seat(body, s * (xi - 0.28), yU0 - 0.3 + 0.38, z, 0.42, BUS_SEAT);
          seat(body, s * (xi - 0.72), yU0 - 0.3 + 0.38, z, 0.42, BUS_SEAT);
        }
      }
    }
    const fx = { front, rear, zf: zF, zr: zR, indF: [hw - c - 0.2, yBmp + 0.15, zF + 0.01], indR: [hw - c - 0.13, yBmp + 0.39, zR - 0.01], exhaust: [-drL * (hw - 0.5), y0, zR - 0.05] };
    return {
      body, glass, brake, siren: null, zoff, fx,
      seat: { x: drL * (hw - 0.62), y: 0.98, z: zF - 1.2 },
      bumper: { yf: y0 + 0.15, yr: y0 + 0.15, hw },
    };
  };

  // ---------- Грузовик: кабина над мотором и фургон ----------
  const ALU = col('#b4b8be'), CABI = col('#3a3c40');
  CM.buildTruck = function (t, paint, livery, region, lod) {
    const hi = lod !== 1;
    const body = new CB(hi ? 9000 : 3000), glass = new CB(hi ? 400 : 160), brake = new CB(96);
    const L = t.L, W = t.W, H = t.H, wr = t.wr, wb = t.wb, zoff = 0.4;
    const hw = W / 2, zF = L / 2, zR = -L / 2;
    const drL = CM.DRIVE_L[region] ? -1 : 1;
    const white = paint.getHSL({}).l > 0.75;
    const cabC = paint, boxC = white ? paint : col('#eceeee'), stripeC = white ? col('#2f5fa8') : paint;
    const aF = wb / 2 + zoff, aR = -wb / 2 + zoff, Ra = wr * 1.2;
    // ---------- Кабина ----------
    const cabL = 2.05, cz0 = zF - cabL, cy0 = 0.62, cy1 = 2.78, chw = hw - 0.06, cc = 0.2;
    const yWs0 = 1.78, yWs1 = cy1 - 0.2, xWs = chw - cc - 0.05;
    const dz0 = zF - 1.45, dz1 = zF - 0.32; // дверь
    const wz0 = dz0 + 0.12, wz1 = dz1 - 0.06, wy0 = yWs0 - 0.02, wy1 = yWs1 - 0.06;
    const cabArch = { zc: aF, Ra, top: wr + Ra + 0.1 };
    const yG0 = 0.95, yG1 = 1.62;
    rbox(body, {
      hw: chw, y0: cy0, y1: cy1, z0: cz0, z1: zF, c: cc, bottom: C.UNDER,
      zs: [cabArch.zc - Ra, cabArch.zc + Ra, wz0, wz1, dz0, dz1, (cz0 + zF) / 2], ys: [cabArch.top, wy0, wy1, yWs0, yWs1, yG0, yG1, 1.2],
      xs: [-xWs, xWs, -0.7, 0.7, 0],
      f(face, u, v) {
        if (face === 'L' || face === 'R') {
          if (Math.abs(u - cabArch.zc) < Ra && v < cabArch.top) return null;
          if (u > wz0 && u < wz1 && v > wy0 && v < wy1) return null;
          return cabC;
        }
        if (face === 'F') {
          if (Math.abs(u) < xWs && v > yWs0 && v < yWs1) return null;
          return cabC;
        }
        if (face === 'B') return [CABI, 0.1];
        if (face === 'V') return v > yWs0 && v < yWs1 && (u === 0 || u === 2) ? [C.TRIM, 0.4] : cabC;
        return cabC;
      },
    });
    for (const s of [1, -1]) arch(body, s, chw, cabArch.zc, wr, Ra, cabArch.top, cy0, 0.5, () => cabC, hi);
    opening(body, glass, 'z', 1, zF, -xWs, xWs, yWs0, yWs1, 0.045);
    for (const s of [1, -1]) opening(body, glass, 'x', s, chw, wz0, wz1, wy0, wy1, 0.035);
    // швы двери, ручка, подножки
    for (const s of [1, -1]) {
      const x = s * (chw + 0.003), n = s > 0 ? NX : NXm;
      for (const z of [dz0, dz1]) QF(body, [x, cy0 + 0.25, z - 0.008], [x, cy0 + 0.25, z + 0.008], [x, yWs1 + 0.05, z + 0.008], [x, yWs1 + 0.05, z - 0.008], n, C.TRIM, 0.1);
      QF(body, [x, cy0 + 0.25, dz0], [x, cy0 + 0.25, dz1], [x, cy0 + 0.27, dz1], [x, cy0 + 0.27, dz0], n, C.TRIM, 0.1);
      body.box(s * (chw - 0.002), 1.5, dz0 + 0.12, s * (chw + 0.03), 1.54, dz0 + 0.32, C.CHROME, 2);
      for (const y of [0.42, 0.72]) body.box(s * (chw - 0.25), y - 0.04, dz0 + 0.05, s * (chw + 0.02), y, dz0 + 0.55, C.TRIM, 0.2);
      // большие зеркала
      mirrorArm(body, s, s * (chw - 0.02), yWs1 - 0.15, zF - 0.25, s * (chw + 0.3), yWs1 - 0.05, zF - 0.1, 0.55, 0.18);
      // полоса по низу кабины
      QF(body, [x, cy0 + 0.05, cz0 + cc], [x, cy0 + 0.05, zF - cc], [x, cy0 + 0.17, zF - cc], [x, cy0 + 0.17, cz0 + cc].slice(), n, stripeC === cabC ? C.TRIM : stripeC, 0.3);
    }
    // решётка радиатора с хромированными планками и эмблемой
    const fz = zF + 0.002;
    plate(body, -0.72, 0.72, yG0, yG1, fz, 1, C.GRILLE, 0.15);
    for (let k = 1; k < 7; k++) {
      const y = yG0 + ((yG1 - yG0) * k) / 7;
      plate(body, -0.7, 0.7, y - 0.012, y + 0.012, fz + 0.002, 1, C.CHROME, 2);
    }
    disc(body, 0, yG1 + 0.09, fz + 0.003, 0.07, C.CHROME, 2);
    // бампер с фарами
    body.box(-chw + 0.02, 0.48, zF - 0.1, chw - 0.02, 0.86, zF + 0.12, C.TRIM, 0.18, 0, true);
    const front = [];
    for (const s of [1, -1]) {
      const xa = s * (chw - 0.1), xb = s * (chw - 0.5);
      plate(body, xa + s * 0.02, xb - s * 0.02, 0.92, 1.24, fz, 1, C.TRIM, 0.4);
      plate(body, xa, xb, 1.0, 1.22, fz + 0.002, 1, C.HEAD, 0.9, 1);
      plate(body, xa, xa - s * 0.12, 0.94, 0.99, fz + 0.003, 1, C.AMBER, 0.8, 0.2);
      plate(body, s * (chw - 0.25), s * (chw - 0.45), 0.6, 0.72, zF + 0.122, 1, C.HEAD, 0.9, 0.5);
      front.push([(xa + xb) / 2, 1.11]);
    }
    CM.drawPlate(body, 'truck', 'truck' + paint.getHexString(), region, hi, zF + 0.123, 1, 0.7, false);
    if (hi) for (const s of [1, -1]) obox(body, s * 0.42, yWs0 + 0.22, zF + 0.05, 0.025, 0.5, 0.02, 0.15, 0, s * 0.55, C.WIPER, 0);
    // козырёк над стеклом
    body.box(-xWs, yWs1 + 0.02, zF - 0.02, xWs, yWs1 + 0.06, zF + 0.16, C.TRIM, 0.2);
    // салон кабины
    if (hi) {
      ibox(body, -chw + 0.05, chw - 0.05, 1.05, cy1 - 0.08, cz0 + 0.08, zF - 0.08, CABI, C.INT, CABI);
      body.box(-chw + 0.06, 1.05, zF - 0.6, chw - 0.06, yWs0 + 0.08, zF - 0.1, C.DASH, 0.1);
      for (const s of [1, -1]) seat(body, s * 0.55, 1.4, zF - 1.25, 0.55, C.SEAT);
      cyl(body, 0.22, 0.22, 0.05, 12, new THREE.Matrix4().makeRotationX(-0.75).setPosition(drL * 0.55, yWs0 + 0.08, zF - 0.72), C.TRIM, 0.2);
    }
    // ---------- Рама, бак, защита ----------
    for (const s of [1, -1]) body.box(s * 0.32, 0.62, zR + 0.25, s * 0.52, 0.88, cz0 + 0.3, C.UNDER, 0, 0, true);
    {
      const m = new THREE.Matrix4().makeRotationX(Math.PI / 2).setPosition(-drL * (hw - 0.38), 0.86, (aF - Ra + cz0) / 2 - 0.15);
      cyl(body, 0.26, 0.26, 0.95, hi ? 14 : 8, m, C.CHROME, 2);
      body.box(drL * (hw - 0.55), 0.62, cz0 - 0.65, drL * (hw - 0.12), 1.0, cz0 - 0.05, C.TRIM, 0.2, 0, true);
    }
    for (const s of [1, -1]) {
      // боковая защита между осями
      const z0 = aR + Ra + 0.1, z1 = Math.min(aF - Ra - 0.1, cz0 - 0.7);
      if (z1 > z0) for (const y of [0.55, 0.78]) body.box(s * (hw - 0.06), y - 0.05, z0, s * (hw - 0.02), y + 0.03, z1, ALU, 1.2);
      // брызговики за задними колёсами
      body.box(s * (hw - 0.45), 0.25, aR - Ra - 0.04, s * (hw - 0.05), 0.95, aR - Ra - 0.01, C.RUB, 0);
    }
    // выхлопная труба за кабиной
    if (hi) cyl(body, 0.06, 0.06, 1.3, 8, new THREE.Matrix4().setPosition(-drL * (chw - 0.15), cy1 - 0.25, cz0 - 0.1), C.CHROME, 2);
    // ---------- Фургон ----------
    const bz0 = zR, bz1 = cz0 - 0.12, by0 = 1.05, by1 = H, bc = 0.04, bhw = hw;
    const sy0 = by0 + 0.55, sy1 = by0 + 0.95;
    const zsB = [];
    if (hi) for (let z = bz0; z < bz1; z += 0.9) zsB.push(z);
    rbox(body, {
      hw: bhw, y0: by0, y1: by1, z0: bz0, z1: bz1, c: bc, zs: zsB, ys: [sy0, sy1, (by0 + by1) / 2, by1 - 0.5], xs: [0, -0.6, 0.6], bottom: C.UNDER,
      f(face, u, v) {
        if (face === 'L' || face === 'R') return v > sy0 && v < sy1 ? stripeC : boxC;
        if (face === 'B') return boxC;
        if (face === 'F') return [col('#c8cacc'), 0.4];
        if (face === 'V' || face === 'E') return ALU;
        return boxC;
      },
    });
    // нижний и верхний профиль, угловые стойки
    for (const s of [1, -1]) {
      const x = s * (bhw + 0.012);
      body.box(x - s * 0.03, by0 - 0.02, bz0, x, by0 + 0.1, bz1, ALU, 1.2);
      body.box(x - s * 0.03, by1 - 0.1, bz0, x, by1 - 0.02, bz1, ALU, 1.2);
    }
    // поперечины под полом
    if (hi) for (let z = bz0 + 0.3; z < bz1; z += 0.55) body.box(-bhw + 0.1, by0 - 0.18, z - 0.04, bhw - 0.1, by0, z + 0.04, C.UNDER, 0, 0, true);
    // задние двери: рамка, шов, петли, запорные штанги
    const rz = bz0 - 0.002;
    plate(body, bhw - 0.01, bhw - 0.1, by0, by1 - 0.02, rz, -1, ALU, 1.2);
    plate(body, -bhw + 0.01, -bhw + 0.1, by0, by1 - 0.02, rz, -1, ALU, 1.2);
    plate(body, -bhw + 0.05, bhw - 0.05, by1 - 0.14, by1 - 0.04, rz, -1, ALU, 1.2);
    plate(body, -bhw + 0.05, bhw - 0.05, by0, by0 + 0.1, rz, -1, ALU, 1.2);
    plate(body, -0.012, 0.012, by0 + 0.1, by1 - 0.14, rz - 0.002, -1, C.TRIM, 0.2);
    for (const x of [-0.75, -0.3, 0.3, 0.75]) {
      plate(body, x - 0.018, x + 0.018, by0 + 0.15, by1 - 0.2, rz - 0.01, -1, C.CHROME, 2);
      if (hi) plate(body, x - 0.05, x + 0.05, by0 + 0.9, by0 + 0.96, rz - 0.012, -1, C.TRIM, 0.3);
    }
    if (hi) for (const s of [1, -1]) for (const y of [by0 + 0.35, (by0 + by1) / 2, by1 - 0.4]) plate(body, s * (bhw - 0.1), s * (bhw - 0.2), y, y + 0.1, rz - 0.006, -1, C.TRIM, 0.3);
    // задний отбойник с фонарями и номером
    body.box(-bhw + 0.12, 0.5, bz0 + 0.02, bhw - 0.12, 0.66, bz0 + 0.14, C.TRIM, 0.2, 0, true);
    for (const s of [1, -1]) body.box(s * 0.5, 0.6, bz0 + 0.1, s * 0.58, by0, bz0 + 0.5, C.UNDER, 0);
    const rear = [];
    const lz = bz0 + 0.019;
    for (const s of [1, -1]) {
      const xa = s * (bhw - 0.15), xb = s * (bhw - 0.62);
      body.box(xa, 0.7, bz0 + 0.03, xb, 0.92, bz0 + 0.1, C.TRIM, 0.3);
      plate(body, xa - s * 0.02, xa - s * 0.17, 0.73, 0.89, lz, -1, C.TAIL, 0.8, 0.42);
      plate(body, xa - s * 0.18, xa - s * 0.31, 0.73, 0.89, lz, -1, C.AMBER, 0.8, 0.2);
      plate(body, xa - s * 0.32, xa - s * 0.44, 0.73, 0.89, lz, -1, C.REV, 0.8, 0);
      plate(brake, xa - s * 0.02, xa - s * 0.17, 0.73, 0.89, lz - 0.01, -1, col('#ff2a1a'), 0, 0);
      rear.push([xa - s * 0.1, 0.81]);
      // габаритные огни по верху
      plate(body, s * (bhw - 0.08), s * (bhw - 0.2), by1 - 0.13, by1 - 0.06, rz - 0.004, -1, C.TAIL, 0.8, 0.6);
    }
    CM.drawPlate(body, 'truck', 'truck' + paint.getHexString(), region, hi, bz0 + 0.019, -1, 0.58, true);
    const fx = { front, rear, zf: zF, zr: zR, indF: [chw - 0.2, 0.965, zF + 0.01], indR: [bhw - 0.3, 0.81, bz0 + 0.0], exhaust: [-drL * (chw - 0.15), cy1 + 0.4, cz0 - 0.1] };
    return {
      body, glass, brake, siren: null, zoff, fx,
      seat: { x: drL * 0.55, y: 1.62, z: zF - 1.1 },
      bumper: { yf: 0.66, yr: 0.58, hw },
    };
  };
  function disc(gb, x, y, z, r, cl, ref) {
    CM.disc(gb, x, y, z, r, 1, cl, ref, 0, 14);
  }
})();
