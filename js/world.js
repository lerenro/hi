'use strict';
// Генерация огромного мира: земля, биомы, города (сетка проспектов, кварталы, участки, здания по архетипам),
// шоссе между городами, уличная мебель, граф дорог для транспорта, достопримечательности.
(function () {
  // Тип земли
  const T = (J.T = {
    DEEP: 0, WATER: 1, SAND: 2, GRASS: 3, FOREST: 4, DIRT: 5, ROAD: 6, PAVE: 7, DESERT: 8, SNOW: 9,
    ROCK: 10, BUILDING: 11, BRIDGE: 12, WALL: 13, FIELD: 14, SWAMP: 15, DRYGRASS: 16, MESA: 17,
    RUINS: 18, PLAZA: 19, ICE: 20, MOOR: 21, DOCKWOOD: 22,
    SIDEWALK: 23, PARKING: 24, LAWN: 25,
  });
  // Объекты на клетке
  const O = (J.O = {
    NONE: 0, TREE: 1, PINE: 2, PALM: 3, CACTUS: 4, BOULDER: 5, BUSH: 6, FLOWERS: 7, TALLGRASS: 8,
    PILLAR: 9, JUNGLE: 10, LAMP: 11, OLIVE: 12, DEADTREE: 13, FOUNTAIN: 14, ACACIA: 15,
    // уличная мебель
    TLIGHT: 16, HYDRANT: 17, BENCH: 18, BIN: 19, BUSSTOP: 20, BILLBOARD: 21, STREETTREE: 22,
    FENCE: 23, HEDGE: 24, PUMP: 25, PCAR: 26, SIGN: 27, PHONE: 28,
  });

  const SOLID_T = new Uint8Array(64);
  [T.DEEP, T.ROCK, T.BUILDING, T.WALL, T.MESA].forEach((t) => (SOLID_T[t] = 1));
  const SOLID_O = new Uint8Array(64);
  [O.TREE, O.PINE, O.PALM, O.CACTUS, O.BOULDER, O.PILLAR, O.JUNGLE, O.OLIVE, O.DEADTREE, O.FOUNTAIN, O.ACACIA,
    O.TLIGHT, O.BUSSTOP, O.BILLBOARD, O.STREETTREE, O.FENCE, O.HEDGE, O.PUMP, O.PCAR, O.PHONE].forEach((o) => (SOLID_O[o] = 1));
  J.SOLID_O = SOLID_O;
  const SPEED_T = new Float32Array(64).fill(1);
  SPEED_T[T.WATER] = 0.5; SPEED_T[T.SWAMP] = 0.65; SPEED_T[T.SAND] = 0.9; SPEED_T[T.DESERT] = 0.85;
  SPEED_T[T.SNOW] = 0.8; SPEED_T[T.ROAD] = 1.15; SPEED_T[T.PAVE] = 1.1; SPEED_T[T.PLAZA] = 1.1; SPEED_T[T.BRIDGE] = 1.1; SPEED_T[T.ICE] = 1.2;
  SPEED_T[T.SIDEWALK] = 1.1; SPEED_T[T.PARKING] = 1.1;
  // Городские поверхности лежат на высоте бордюра — получается чёткая ступенька к проезжей части
  const URBAN = (J.URBAN = new Uint8Array(64));
  [T.SIDEWALK, T.PAVE, T.PLAZA, T.PARKING, T.LAWN, T.BUILDING].forEach((t) => (URBAN[t] = 1));
  const ROAD_H = (J.ROAD_H = 0.05), CURB_H = (J.CURB_H = 0.2);
  // Направления: 0 — юг (+y), 1 — восток (+x), 2 — север (-y), 3 — запад (-x)
  const DX = [0, 1, 0, -1], DY = [1, 0, -1, 0];
  J.DIRV = { DX, DY };
  // Флаги клеток (w.rf): зебра, коробка перекрёстка, стоп-линия, автобусный карман, проход к двери (без мебели)
  const RF = (J.RF = { CROSS: 1, BOX: 2, STOP: 4, BUSBAY: 8, KEEP: 16 });
  const HW_HALF = 7.75; // полуширина шоссе: 0.5 разделитель + 2 полосы × 3.25 + 0.75 обочина
  const CHUNK = 32; // размер чанка рендера (для индексов зданий и рёбер по чанкам)
  J.GEN_V = 2; // версия генератора мира (в сохранении)
  J.smooth = (a, b, x) => {
    const t = J.clamp((x - a) / (b - a), 0, 1);
    return t * t * (3 - 2 * t);
  };

  // Цвета земли (для миникарты и 3D)
  J.TCOL = {
    [T.DEEP]: '#1d4f8a', [T.WATER]: '#2f7fc4', [T.SAND]: '#e8d49a', [T.GRASS]: '#6cb24a', [T.FOREST]: '#4a8a3a',
    [T.DIRT]: '#9a7a52', [T.ROAD]: '#4a4a52', [T.PAVE]: '#a8a49a', [T.DESERT]: '#e3c27a', [T.SNOW]: '#eef3f8',
    [T.ROCK]: '#7a7480', [T.BUILDING]: '#999', [T.BRIDGE]: '#8a6a4a', [T.WALL]: '#6a6470', [T.FIELD]: '#b8c25a',
    [T.SWAMP]: '#4f6a3a', [T.DRYGRASS]: '#b8b05a', [T.MESA]: '#b8603a', [T.RUINS]: '#c9b48a', [T.PLAZA]: '#d8ccb0',
    [T.ICE]: '#bfe3f2', [T.MOOR]: '#5a7a4a', [T.DOCKWOOD]: '#7a5a3a',
    [T.SIDEWALK]: '#b9b5ab', [T.PARKING]: '#55555c', [T.LAWN]: '#5fa846',
  };

  // Точка перед дверью с учётом направления фасада: out — отступ наружу (от центра клетки двери + 0.5),
  // side — сдвиг вдоль фасада. Заменяет старое «door.x + 0.5, door.y + 1.6».
  J.doorPt = function (b, out = 1.6, side = 0) {
    const d = b.dir || 0, dx = DX[d], dy = DY[d];
    return { x: b.door.x + 0.5 + dx * (out - 0.5) - dy * side, y: b.door.y + 0.5 + dy * (out - 0.5) + dx * side };
  };
  // Угол взгляда «из двери наружу» (как e.face: atan2(dy, dx))
  J.doorAng = (b) => Math.atan2(DY[b.dir || 0], DX[b.dir || 0]);

  function chaikin(p) {
    const o = [p[0]];
    for (let i = 0; i < p.length - 1; i++) {
      const a = p[i], b = p[i + 1];
      o.push({ x: a.x * 0.75 + b.x * 0.25, y: a.y * 0.75 + b.y * 0.25 }, { x: a.x * 0.25 + b.x * 0.75, y: a.y * 0.25 + b.y * 0.75 });
    }
    o.push(p[p.length - 1]);
    return o;
  }

  class World {
    constructor(seed) {
      this.seed = seed >>> 0;
      this.W = J.WORLD_W;
      this.H = J.WORLD_H;
      const N = this.W * this.H;
      this.t = new Uint8Array(N);
      this.o = new Uint8Array(N);
      this.reg = new Uint8Array(N);
      this.bid = new Int32Array(N); // индекс здания + 1
      this.rock = new Float32Array(N); // высота скал
      // Городские слои. Всё выделяется здесь, до gen(): добавление свойств посреди генерации
      // переводит объект V8 в «словарный» режим и вдвое замедляет цикл местности.
      this.rid = new Uint16Array(N); // дороги: id ребра + 1, либо 0x8000 | id узла (коробка перекрёстка)
      this.rf = new Uint8Array(N); // флаги RF
      this.od = new Uint8Array(N); // направление объекта: 0 S, 1 E, 2 N, 3 W (стрела фонаря, светофора, скамейка, ось забора)
      this.under = new Uint8Array(N); // тип земли под шоссе (рисуется обочиной)
      this.net = { nodes: [], edges: [] }; // граф дорог
      this.lots = []; // участки
      this.parkSpots = []; // места парковки {x, y, ang}
      this.cityGrids = {};
      this.chunkB = null; // индексы зданий по чанкам (по углу x,y)
      this.chunkE = null; // индексы рёбер дорог по чанкам
      this.NCX = Math.ceil(this.W / CHUNK);
      this.genV = J.GEN_V;
      this.R = null;
      this.buildings = [];
      this.places = {}; // особые точки
      this.gen();
    }
    idx(x, y) {
      return y * this.W + x;
    }
    inb(x, y) {
      return x >= 0 && y >= 0 && x < this.W && y < this.H;
    }
    tile(x, y) {
      x |= 0; y |= 0;
      if (!this.inb(x, y)) return T.DEEP;
      return this.t[y * this.W + x];
    }
    obj(x, y) {
      x |= 0; y |= 0;
      if (!this.inb(x, y)) return 0;
      return this.o[y * this.W + x];
    }
    regionAt(x, y) {
      x = J.clamp(x | 0, 0, this.W - 1);
      y = J.clamp(y | 0, 0, this.H - 1);
      return J.REGIONS[this.reg[y * this.W + x]];
    }
    cityAt(x, y) {
      for (const r of J.REGIONS) {
        if (r.city && J.dist(x, y, r.x, r.y) < r.city + 3) return r;
      }
      return null;
    }
    // Проходимость клетки. opts: {water: можно по воде, fly: полёт, ghost: сквозь стены}
    solid(x, y, opts) {
      x = Math.floor(x); y = Math.floor(y);
      if (!this.inb(x, y)) return true;
      const i = y * this.W + x;
      const t = this.t[i];
      if (opts) {
        if (opts.fly) return false;
        if (opts.ghost) return t === T.DEEP && !opts.water;
        if (t === T.DEEP && opts.water) return false;
      }
      return SOLID_T[t] === 1 || SOLID_O[this.o[i]] === 1;
    }
    speedAt(x, y) {
      const t = this.tile(x, y);
      const o = this.obj(x, y);
      let s = SPEED_T[t];
      if (o === O.BUSH || o === O.TALLGRASS) s *= 0.85;
      return s;
    }
    isWater(x, y) {
      const t = this.tile(x, y);
      if (t === T.BRIDGE || t === T.DOCKWOOD) return false;
      return t === T.WATER || t === T.DEEP;
    }
    // Клетка для пешеходов: тротуар, мостовая, площадь или зебра
    isPedTile(x, y) {
      x |= 0; y |= 0;
      if (!this.inb(x, y)) return false;
      const i = y * this.W + x;
      const t = this.t[i];
      return t === T.SIDEWALK || t === T.PAVE || t === T.PLAZA || (t === T.ROAD && (this.rf[i] & RF.CROSS) !== 0);
    }
    // Высота клетки для 3D
    tileH(x, y) {
      if (!this.inb(x, y)) return -1.4;
      const i = y * this.W + x;
      const t = this.t[i];
      if (URBAN[t]) return CURB_H;
      switch (t) {
        case T.DEEP: return -1.4;
        case T.WATER: return -0.55;
        case T.SAND: return 0.02;
        case T.ROCK: return 1.2 + this.rock[i] * 4.5;
        case T.MESA: return 3.2 + this.rock[i] * 1.2;
        case T.SNOW: return 0.12;
        case T.ICE: return -0.02;
        case T.SWAMP: return -0.08;
        case T.BRIDGE: case T.DOCKWOOD: return -0.55;
        case T.ROAD: return ROAD_H;
        case T.WALL: return 0.05;
        default: return 0.06 + this.rock[i] * 0.35;
      }
    }
    vertH(vx, vy) {
      return (this.tileH(vx - 1, vy - 1) + this.tileH(vx, vy - 1) + this.tileH(vx - 1, vy) + this.tileH(vx, vy)) * 0.25;
    }
    groundY(x, y) {
      const fx0 = Math.floor(x), fy0 = Math.floor(y);
      if (!this.inb(fx0, fy0)) return 0;
      const i = fy0 * this.W + fx0;
      const t = this.t[i];
      // город: плоско в пределах клетки (тротуар на 15 см выше асфальта)
      if (URBAN[t]) return CURB_H;
      if (t === T.ROAD) return ROAD_H;
      if (t === T.BRIDGE) return this.rid[i] ? ROAD_H : 0.32;
      if (t === T.DOCKWOOD) return 0.32;
      const fx = x - fx0, fy = y - fy0;
      const a = this.vertH(fx0, fy0), b = this.vertH(fx0 + 1, fy0), c = this.vertH(fx0, fy0 + 1), d = this.vertH(fx0 + 1, fy0 + 1);
      const h = J.lerp(J.lerp(a, b, fx), J.lerp(c, d, fx), fy);
      if (t === T.WATER || t === T.DEEP) return Math.max(h, -0.25);
      return Math.max(h, 0);
    }

    gen() {
      const W = this.W, H = this.H, s = this.seed;
      const R = J.rng(s);
      this.R = R;
      const regs = J.REGIONS;
      // Сегменты перешейков
      const pt = (p) => (typeof p === 'string' ? [J.REGION[p].x, J.REGION[p].y] : p);
      const caps = J.CAPSULES.map(([a, b, r]) => {
        const A = pt(a), B = pt(b);
        return { ax: A[0], ay: A[1], bx: B[0], by: B[1], r };
      });
      const island = J.REGION.airsupplena;
      // диски городов: внутри R+4 — гарантированная суша, до R+8 — берег
      const discs = regs.filter((r) => r.city).map((r) => ({ x: r.x, y: r.y, r1: (r.city + 4) * (r.city + 4), r2: (r.city + 8) * (r.city + 8), rr: r.city + 8, idx: r.idx }));

      for (let y = 0; y < H; y++) {
        const rowD = discs.filter((d) => Math.abs(y - d.y) <= d.rr);
        for (let x = 0; x < W; x++) {
          const i = y * W + x;
          let land = -1;
          for (let k = 0; k < regs.length; k++) {
            const r = regs[k];
            const ddx = x - r.x, ddy = y - r.y;
            const v = 1 - Math.sqrt(ddx * ddx + ddy * ddy) / r.land;
            if (v > land) land = v;
          }
          for (const c of caps) {
            const dx = c.bx - c.ax, dy = c.by - c.ay;
            const L2 = dx * dx + dy * dy;
            let tt = ((x - c.ax) * dx + (y - c.ay) * dy) / L2;
            tt = tt < 0 ? 0 : tt > 1 ? 1 : tt;
            const ex = x - (c.ax + dx * tt), ey = y - (c.ay + dy * tt);
            const d = Math.sqrt(ex * ex + ey * ey) / c.r;
            const v = (1 - d) * 0.75;
            if (v > land) land = v;
          }
          let cityK = 0, cityI = -1;
          for (let k = 0; k < rowD.length; k++) {
            const d = rowD[k], ex = x - d.x, ey = y - d.y, d2 = ex * ex + ey * ey;
            if (d2 < d.r2) {
              cityK = d2 < d.r1 ? 2 : 1;
              cityI = d.idx;
              break;
            }
          }
          // открытый океан — без лишних вычислений
          const dix = x - island.x, diy = y - island.y;
          const di = Math.sqrt(dix * dix + diy * diy);
          if (land < -0.55 && di > island.land + 20 && !cityK) {
            this.t[i] = T.DEEP;
            this.reg[i] = 0;
            continue;
          }
          // домен-искажение для биомов
          const wx = x + (J.noise2(x / 70, y / 70, s + 11) - 0.5) * 70;
          const wy = y + (J.noise2(x / 70, y / 70, s + 23) - 0.5) * 70;
          let best = 1e9, bi = 0;
          for (let k = 0; k < regs.length; k++) {
            const r = regs[k];
            const ux = wx - r.x, uy = wy - r.y;
            const dw = Math.sqrt(ux * ux + uy * uy) / (r.land + 30);
            if (dw < best) {
              best = dw;
              bi = k;
            }
          }
          const n = J.fbm(x / 46, y / 46, s, 4);
          let lv = land + (n - 0.5) * 0.85;
          // остров Эйр-Сапплена окружён водой
          if (di < island.land + 15) {
            if (di > island.land) lv = Math.min(lv, -0.1);
            else lv = Math.max(lv, 0.3);
            bi = island.idx;
          } else if (cityK) {
            // город целиком на суше и в своём регионе
            lv = Math.max(lv, cityK === 2 ? 0.2 : 0.1);
            bi = cityI;
          }
          // края карты — океан
          const edge = Math.min(x, y, W - 1 - x, H - 1 - y);
          if (edge < 12) lv -= (12 - edge) * 0.08;

          this.reg[i] = bi;
          const reg = regs[bi];
          const m = J.fbm(x / 30, y / 30, s + 5, 3);
          const f = J.fbm(x / 22, y / 22, s + 3, 3);
          const h = J.hash2(x, y, s + 77);
          let t, o = 0;
          if (lv < -0.02) t = T.DEEP;
          else if (lv < 0.09) t = T.WATER;
          else if (lv < 0.14 && reg.biome !== 'tundra' && reg.biome !== 'alpine') t = reg.biome === 'swamp' ? T.SWAMP : T.SAND;
          else {
            const deep = lv; // глубина внутри суши
            switch (reg.biome) {
              case 'temperate':
                t = f > 0.56 ? T.FOREST : T.GRASS;
                if (t === T.FOREST && h < 0.32) o = O.TREE;
                else if (h < 0.02) o = O.TREE;
                else if (h < 0.035) o = O.FLOWERS;
                else if (h < 0.045) o = O.BUSH;
                if (m > 0.68 && deep > 0.3) t = T.ROCK;
                break;
              case 'moor':
                t = f > 0.6 ? T.FOREST : T.MOOR;
                if (t === T.FOREST && h < 0.25) o = O.TREE;
                else if (h < 0.03) o = O.BUSH;
                else if (h < 0.04) o = O.BOULDER;
                else if (h < 0.06) o = O.TALLGRASS;
                break;
              case 'alpine':
                if (m > 0.56 && deep > 0.25) t = T.ROCK;
                else if (m > 0.47 || deep > 0.6) t = T.SNOW;
                else t = T.GRASS;
                if (t !== T.ROCK) {
                  if (f > 0.55 && h < 0.3) o = O.PINE;
                  else if (h < 0.02) o = O.BOULDER;
                }
                break;
              case 'mediterranean':
                t = f > 0.6 ? T.GRASS : n > 0.55 ? T.DRYGRASS : T.GRASS;
                if (h < 0.025) o = O.OLIVE;
                else if (f > 0.6 && h < 0.12) o = O.PINE;
                else if (h < 0.035) o = O.BOULDER;
                else if (h < 0.05) o = O.FLOWERS;
                if (m > 0.7 && deep > 0.3) t = T.ROCK;
                break;
              case 'desert':
                t = T.DESERT;
                if (m > 0.66 && deep > 0.25) t = T.ROCK;
                else if (reg.id === 'mexico') {
                  if (h < 0.02) o = O.CACTUS;
                  else if (f > 0.62) { t = T.DRYGRASS; if (h < 0.1) o = O.BUSH; }
                  else if (h < 0.03) o = O.BOULDER;
                } else {
                  if (h < 0.008) o = O.BOULDER;
                  else if (f > 0.68 && h < 0.08) o = O.PALM;
                }
                break;
              case 'mesa':
                t = f > 0.52 ? T.DESERT : T.DRYGRASS;
                if (J.fbm(x / 16, y / 16, s + 9, 3) > 0.66 && deep > 0.2) t = T.MESA;
                else if (h < 0.015) o = O.CACTUS;
                else if (h < 0.022) o = O.DEADTREE;
                else if (h < 0.03) o = O.BOULDER;
                else if (h < 0.05) o = O.BUSH;
                break;
              case 'prairie':
                t = T.DRYGRASS;
                if (f > 0.6) t = T.GRASS;
                if (h < 0.01) o = O.TREE;
                else if (h < 0.05) o = O.TALLGRASS;
                else if (h < 0.065) o = O.BUSH;
                break;
              case 'swamp':
                t = f > 0.62 ? T.WATER : n > 0.5 ? T.SWAMP : T.GRASS;
                if (t !== T.WATER) {
                  if (h < 0.18 && f > 0.45) o = O.JUNGLE;
                  else if (h < 0.08) o = O.TALLGRASS;
                }
                break;
              case 'tropical':
                t = T.GRASS;
                if (f > 0.5 && h < 0.4) o = O.JUNGLE;
                else if (h < 0.03) o = O.PALM;
                else if (h < 0.06) o = O.FLOWERS;
                break;
              case 'savanna':
                t = f > 0.55 ? T.GRASS : T.DRYGRASS;
                if (h < 0.012) o = O.ACACIA;
                else if (h < 0.04) o = O.BUSH;
                else if (h < 0.06) o = O.TALLGRASS;
                break;
              case 'tundra':
                t = f > 0.62 ? T.ICE : T.SNOW;
                if (t === T.SNOW && h < 0.03) o = O.PINE;
                else if (h < 0.04) o = O.BOULDER;
                break;
              default:
                t = T.GRASS;
            }
            // болота и озёра внутри города осушены
            if (cityK === 2 && (t === T.WATER || t === T.SWAMP)) {
              t = T.GRASS;
              o = 0;
            }
          }
          this.t[i] = t;
          this.o[i] = o;
          if (t === T.ROCK || t === T.MESA) this.rock[i] = J.clamp((m - 0.55) * 4, 0, 1) * (0.6 + 0.4 * J.noise2(x / 5, y / 5, s + 99));
          else this.rock[i] = (J.noise2(x / 9, y / 9, s + 31) - 0.5) * 0.4;
        }
      }

      // регион открытого океана — ближайший (по грубой сетке 8×8)
      for (let by = 0; by < H; by += 8)
        for (let bx = 0; bx < W; bx += 8) {
          let best = 1e9, bi = 0;
          for (let k = 0; k < regs.length; k++) {
            const ax = bx + 4 - regs[k].x, ay = by + 4 - regs[k].y;
            const d = Math.sqrt(ax * ax + ay * ay) - regs[k].land;
            if (d < best) {
              best = d;
              bi = k;
            }
          }
          for (let y = by; y < Math.min(H, by + 8); y++)
            for (let x = bx; x < Math.min(W, bx + 8); x++) {
              const i = y * W + x;
              if (this.t[i] === T.DEEP && this.reg[i] === 0) this.reg[i] = bi;
            }
        }
      // порядок: города → шоссе → достопримечательности → остров → уличная мебель → связность → индексы
      this.genCities();
      this.genHighways();
      this.genLandmarks();
      this.genIsland();
      this.decorateCities();
      this.ensureConnectivity();
      this.indexChunks();
    }

    // Клетка перед дверью (всегда проходима)
    doorFront(b) {
      const d = b.dir || 0;
      return { x: b.door.x + DX[d], y: b.door.y + DY[d] };
    }

    // Гарантирует, что до каждого важного здания можно дойти пешком (кроме острова)
    ensureConnectivity() {
      const W = this.W, H = this.H;
      const start = this.buildings.find((b) => b.region === 'morioh' && b.type === 'station');
      if (!start) return;
      const seen = new Uint8Array(W * H);
      const q = new Int32Array(W * H);
      const DX4 = [1, -1, 0, 0], DY4 = [0, 0, 1, -1];
      const flood = (i0) => {
        let qh = 0, qt = 0;
        q[qt++] = i0;
        seen[i0] = 1;
        while (qh < qt) {
          const i = q[qh++];
          const x = i % W, y = (i / W) | 0;
          for (let k = 0; k < 4; k++) {
            const nx = x + DX4[k], ny = y + DY4[k];
            if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
            const j = ny * W + nx;
            if (seen[j] || this.solid(nx + 0.5, ny + 0.5)) continue;
            seen[j] = 1;
            q[qt++] = j;
          }
        }
      };
      const front = (b) => {
        const f = this.doorFront(b);
        return f.y * W + f.x;
      };
      flood(front(start));
      for (const b of this.buildings) {
        if (b.type === 'house' || b.region === 'airsupplena') continue;
        const s0 = front(b);
        if (seen[s0]) continue;
        // поиск ближайшей достижимой клетки, проходя сквозь препятствия (кроме зданий)
        const mark = new Map();
        let qh = 0, qt = 0, found = -1;
        q[qt++] = s0;
        mark.set(s0, -1);
        while (qh < qt && qt < 400000) {
          const i = q[qh++];
          if (seen[i]) { found = i; break; }
          const x = i % W, y = (i / W) | 0;
          for (let k = 0; k < 4; k++) {
            const nx = x + DX4[k], ny = y + DY4[k];
            if (nx < 1 || ny < 1 || nx >= W - 1 || ny >= H - 1) continue;
            const j = ny * W + nx;
            if (mark.has(j) || this.t[j] === T.BUILDING) continue;
            mark.set(j, i);
            q[qt++] = j;
          }
        }
        if (found < 0) continue;
        // прокладываем тропу
        let i = found;
        const path = [];
        while (i !== -1) {
          path.push(i);
          i = mark.get(i);
        }
        for (const j of path) {
          const t = this.t[j];
          this.o[j] = 0;
          if (t === T.DEEP || t === T.WATER) this.t[j] = T.BRIDGE;
          else if (t === T.ROCK || t === T.MESA || t === T.WALL) this.t[j] = T.DIRT;
          if (this.rock[j] > 0.3) this.rock[j] = 0;
        }
        // заново заливаем, чтобы учесть новую тропу
        flood(s0);
      }
    }

    setT(x, y, t, clearObj = true) {
      if (!this.inb(x, y)) return;
      const i = y * this.W + x;
      this.t[i] = t;
      if (clearObj) this.o[i] = 0;
      if (t !== T.ROCK && t !== T.MESA) this.rock[i] = 0;
    }

    // Цвета особых зданий (общие для старых и новых построек)
    typeColors(b) {
      const type = b.type;
      if (type === 'trussardi') b.wall = '#f2e0c0';
      if (type === 'dio_mansion') { b.wall = '#5a4a6a'; b.roof = '#2a2238'; b.flat = false; }
      if (type === 'joestar_mansion') { b.wall = '#e8dcc8'; b.roof = '#3a4a6a'; b.flat = false; }
      if (type === 'green_dolphin') { b.wall = '#a8b0b8'; b.roof = '#6a7480'; b.flat = true; }
      if (type === 'colosseum') { b.wall = '#d9c49a'; b.roof = '#c9b48a'; b.flat = true; }
      if (type === 'cape') { b.wall = '#f4f4f4'; b.roof = '#d8442b'; }
      if (type === 'lisa_castle' || type === 'hamon_temple') { b.wall = '#f0e8d8'; b.roof = '#c4283c'; b.flat = false; }
      if (type === 'pillar_ruins') { b.wall = '#c9b48a'; b.roof = '#a8946a'; b.flat = true; }
      if (type === 'hospital') b.wall = '#eef0f2';
      if (type === 'church') b.wall = '#d8d0c0';
      if (type === 'polpo_prison') { b.wall = '#9a9ca0'; b.flat = true; }
    }

    // Старое здание (достопримечательности за городом, остров): дверь на юг
    addBuilding(type, x, y, w, h, reg, styleKey) {
      const bt = J.BTYPES[type];
      const st = J.STYLES[styleKey || reg.style || 'usa'] || J.STYLES.usa;
      const R = this.R;
      const floors = bt.floors * (bt.special ? 1 : st.tall) * (type === 'house' ? R.range(0.8, 1.6) : 1);
      const b = {
        id: this.buildings.length,
        type, x, y, w, h, dir: 0,
        door: { x: x + (w >> 1), y: y + h - 1 },
        region: reg.id,
        name: bt.name,
        wall: R.pick(st.walls),
        roof: R.pick(st.roofs),
        flat: !!st.flat && type !== 'church',
        floors: Math.max(1, Math.round(floors)), floorH: 2.6,
        height: Math.max(2.4, floors * 2.6),
        sign: bt.color || null,
        arch: null, zone: null, glass: null, parts: null, canopy: null,
      };
      this.typeColors(b);
      for (let yy = y; yy < y + h; yy++)
        for (let xx = x; xx < x + w; xx++) {
          this.setT(xx, yy, T.BUILDING);
          this.bid[yy * this.W + xx] = b.id + 1;
        }
      // клетка перед дверью должна быть проходимой
      const fx = b.door.x, fy = b.door.y + 1;
      if (this.solid(fx, fy)) this.setT(fx, fy, T.PAVE);
      this.buildings.push(b);
      return b;
    }

    // Здание с фасадом в сторону dir и архетипом (info: {arch, floors, zone})
    addBuildingDir(type, x, y, w, h, reg, dir, info) {
      const R = this.R;
      const bt = J.BTYPES[type];
      const st = J.STYLES[reg.style || 'usa'] || J.STYLES.usa;
      const G = J.GRID[reg.style] || J.GRID.usa;
      const arch = info.arch;
      const floors = info.floors || bt.floors;
      const floorH = arch === 'suburban' || arch === 'parking' ? 3.0 : 3.4;
      const b = {
        id: this.buildings.length, type, x, y, w, h, dir,
        door: dir === 0 ? { x: x + (w >> 1), y: y + h - 1 } : dir === 2 ? { x: x + (w >> 1), y } : dir === 1 ? { x: x + w - 1, y: y + (h >> 1) } : { x, y: y + (h >> 1) },
        region: reg.id, name: bt.name, wall: R.pick(st.walls), roof: R.pick(st.roofs),
        flat: arch !== 'suburban' && arch !== 'special' ? true : !!st.flat || R() > G.pitched,
        floors, floorH, height: Math.max(3, floors * floorH + (arch === 'shopfront' ? 0.8 : 0)),
        sign: bt.color || null, arch, zone: info.zone, glass: null, parts: null, canopy: null,
      };
      this.typeColors(b);
      if (arch === 'tower_glass') b.glass = R.pick(['#6f8fa8', '#5a7f8f', '#8aa6b8', '#4f6a7f', '#9fb3bf', '#7a8c9c']);
      if (arch === 'tower_setback') {
        // до трёх ярусов, каждый уже на 2 клетки с каждой стороны
        b.parts = [];
        let x0 = x, y0 = y, x1 = x + w, y1 = y + h, h0 = 0;
        const tiers = Math.min(3, 1 + Math.floor(floors / 12));
        for (let k = 0; k < tiers; k++) {
          const last = k === tiers - 1 || x1 - x0 - 4 < 6 || y1 - y0 - 4 < 6;
          const hk = last ? b.height : Math.round((h0 + (b.height - h0) * 0.5) / floorH) * floorH;
          b.parts.push({ x0, y0, x1, y1, h0, h1: hk });
          h0 = hk;
          if (last) break;
          x0 += 2; y0 += 2; x1 -= 2; y1 -= 2;
        }
      }
      for (let yy = y; yy < y + h; yy++)
        for (let xx = x; xx < x + w; xx++) {
          this.setT(xx, yy, T.BUILDING);
          this.bid[yy * this.W + xx] = b.id + 1;
        }
      const fx = b.door.x + DX[dir], fy = b.door.y + DY[dir];
      if (this.solid(fx, fy)) this.setT(fx, fy, T.PAVE);
      this.o[fy * this.W + fx] = 0;
      this.buildings.push(b);
      return b;
    }

    // Высота верха здания в точке (x, y) — для камеры и прочих лучей
    buildingTop(b, x, y) {
      const H = b.height;
      if (b.parts) {
        let top = CURB_H;
        for (const p of b.parts) if (x >= p.x0 && x < p.x1 && y >= p.y0 && y < p.y1) top = CURB_H + p.h1 + 0.8;
        return top;
      }
      if (!b.arch) {
        // старые постройки: от земли, скатная крыша вдоль x
        if (b.flat) return H + 0.6;
        const z0 = b.y + 0.06, z1 = b.y + b.h - 0.06, zm = (z0 + z1) / 2;
        const rh = Math.min(2.2, (z1 - z0) * 0.38);
        const k = 1 - Math.min(1, Math.abs(y - zm) / ((z1 - z0) / 2 + 0.3));
        return H + rh * k + 0.3;
      }
      let top = CURB_H + H;
      if (!b.flat) {
        // скат вдоль длинной стороны
        const along = b.w >= b.h;
        const half = (along ? b.h : b.w) / 2;
        const rh = Math.min(3.2, half * 0.8);
        const dd = along ? Math.abs(y - (b.y + b.h / 2)) : Math.abs(x - (b.x + b.w / 2));
        return top + rh * (1 - Math.min(1, dd / (half + 0.4))) + 0.2;
      }
      top += 0.8; // парапет
      if (b.arch === 'tower_glass') {
        const mx = b.x + b.w / 2, my = b.y + b.h / 2;
        if (Math.abs(x - mx) < 3.2 && Math.abs(y - my) < 2.7) top += 3.5;
      }
      return top;
    }

    // ===================== Города =====================
    genCities() {
      for (const reg of J.REGIONS) if (reg.city) this.genCity(reg);
    }

    // Город: анизотропная сетка (как Манхэттен) → кварталы → прямоугольники → участки → здания
    genCity(reg) {
      const W = this.W, H = this.H, R = reg.city, cx = reg.x, cy = reg.y;
      const G = J.GRID[reg.style] || J.GRID.usa;
      const rnd = J.rng((this.seed ^ Math.imul(reg.idx + 1, 0x9e3779b1)) >>> 0);
      const zi = (d) => {
        const k = d / R;
        return k < 0.36 ? 0 : k < 0.66 ? 1 : 2;
      };
      const asw = (cls) => (cls === 'ave' ? G.aw : G.sw);
      const sww = (cls) => (cls === 'ave' ? G.as : G.ss);
      const half = (cls) => asw(cls) / 2 + sww(cls);
      // (1) линии сетки от центрального проспекта наружу; одна линия — за радиусом, чтобы крайние кварталы существовали
      const mkLines = (sizes, every) => {
        const L = [{ p: 0, cls: 'ave' }];
        for (const sg of [1, -1]) {
          let pos = 0, prev = 'ave', k = 0;
          for (;;) {
            k++;
            const cls = k % every === 0 ? 'ave' : 'st';
            const blk = sizes[zi(pos)] + ((rnd() * 5) | 0) - 2;
            const start = pos + half(prev);
            pos += half(prev) + blk + half(cls);
            if (k > 1 && start > R) break;
            L.push({ p: sg * pos, cls });
            prev = cls;
          }
        }
        return L.sort((a, b) => a.p - b.p);
      };
      const swap = rnd() < 0.5;
      const LA = mkLines(G.lng, G.lngAve), LB = mkLines(G.sht, G.shtAve);
      const XS = swap ? LB : LA, YS = swap ? LA : LB;
      const nx = XS.length - 1, ny = YS.length - 1;
      // (2) квартал входит в город: ≥45% внутри шумного круга, в основном суша, не у края карты
      const inc = new Uint8Array(nx * ny);
      const cellRect = (i, j) => ({
        x0: cx + XS[i].p + half(XS[i].cls), x1: cx + XS[i + 1].p - half(XS[i + 1].cls),
        y0: cy + YS[j].p + half(YS[j].cls), y1: cy + YS[j + 1].p - half(YS[j + 1].cls),
      });
      const lim = (x, y) => {
        const a = Math.atan2(y - cy, x - cx);
        return R * (0.9 + 0.2 * J.noise2(Math.cos(a) * 1.7 + 9, Math.sin(a) * 1.7 + 9, this.seed + reg.idx));
      };
      for (let j = 0; j < ny; j++)
        for (let i = 0; i < nx; i++) {
          const r = cellRect(i, j);
          const centre = XS[i].p <= 0 && XS[i + 1].p >= 0 && YS[j].p <= 0 && YS[j + 1].p >= 0;
          let inside = 0, land = 0, n = 0;
          for (let sy = 0; sy < 4; sy++)
            for (let sx = 0; sx < 4; sx++) {
              const x = r.x0 + ((sx + 0.5) * (r.x1 - r.x0)) / 4, y = r.y0 + ((sy + 0.5) * (r.y1 - r.y0)) / 4;
              n++;
              if (Math.hypot(x - cx, y - cy) < lim(x, y)) inside++;
              const t = this.tile(x, y);
              if (t !== T.DEEP && t !== T.WATER) land++;
            }
          const edgeOk = Math.min(r.x0, r.y0, W - r.x1, H - r.y1) > 30;
          if (edgeOk && (centre || (inside / n >= 0.45 && land / n >= 0.6))) inc[j * nx + i] = 1;
        }
      const used = (i, j) => i >= 0 && j >= 0 && i < nx && j < ny && inc[j * nx + i] === 1;
      // (3) граф дорог по решётке
      const net = this.net;
      const nodeAt = new Int32Array((nx + 1) * (ny + 1)).fill(-1);
      const myNodes = [];
      const getNode = (i, j) => {
        const k = j * (nx + 1) + i;
        if (nodeAt[k] < 0) {
          nodeAt[k] = net.nodes.length;
          const nd = { id: net.nodes.length, x: cx + XS[i].p, y: cy + YS[j].p, city: reg.id, edges: [], aw: [asw(XS[i].cls), asw(YS[j].cls)], ctrl: 'none', phase: 0 };
          net.nodes.push(nd);
          myNodes.push(nd);
        }
        return nodeAt[k];
      };
      const addEdge = (a, b, cls, horiz) => {
        const A = net.nodes[a], B = net.nodes[b];
        const e = { id: net.edges.length, a, b, cls, horiz, lanes: cls === 'ave' ? 2 : 1, w: asw(cls), sw: sww(cls), x0: A.x, y0: A.y, x1: B.x, y1: B.y, city: reg.id, drive: G.drive, len: Math.abs(B.x - A.x) + Math.abs(B.y - A.y), pts: null, cum: null };
        net.edges.push(e);
        A.edges.push(e.id);
        B.edges.push(e.id);
        return e.id;
      };
      const edgeH = new Int32Array(nx * (ny + 1)).fill(-1), edgeV = new Int32Array((nx + 1) * ny).fill(-1);
      for (let j = 0; j <= ny; j++) for (let i = 0; i < nx; i++) if (used(i, j) || used(i, j - 1)) edgeH[j * nx + i] = addEdge(getNode(i, j), getNode(i + 1, j), YS[j].cls, true);
      for (let j = 0; j < ny; j++) for (let i = 0; i <= nx; i++) if (used(i, j) || used(i - 1, j)) edgeV[j * (nx + 1) + i] = addEdge(getNode(i, j), getNode(i, j + 1), XS[i].cls, false);
      // (4) растеризация прямоугольниками: участки → тротуары → асфальт → перекрёстки
      const tt = this.t, oo = this.o, rk = this.rock, rid = this.rid, rf = this.rf;
      const fill = (x0, y0, x1, y1, t, id) => {
        x0 = Math.max(1, x0); y0 = Math.max(1, y0); x1 = Math.min(W - 1, x1); y1 = Math.min(H - 1, y1);
        for (let y = y0; y < y1; y++)
          for (let x = x0, i = y * W + x0; x < x1; x++, i++) {
            tt[i] = t; oo[i] = 0; rk[i] = 0;
            if (id !== undefined) rid[i] = id;
          }
      };
      for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) if (used(i, j)) { const r = cellRect(i, j); fill(r.x0, r.y0, r.x1, r.y1, T.PAVE); }
      for (const pass of [0, 1]) {
        for (let j = 0; j <= ny; j++)
          for (let i = 0; i < nx; i++) {
            const e = edgeH[j * nx + i];
            if (e < 0) continue;
            const L = YS[j], y = cy + L.p, a = asw(L.cls) / 2, hh = half(L.cls);
            if (pass === 0) fill(cx + XS[i].p - half(XS[i].cls), y - hh, cx + XS[i + 1].p + half(XS[i + 1].cls), y + hh, T.SIDEWALK);
            else fill(cx + XS[i].p, y - a, cx + XS[i + 1].p, y + a, T.ROAD, e + 1);
          }
        for (let j = 0; j < ny; j++)
          for (let i = 0; i <= nx; i++) {
            const e = edgeV[j * (nx + 1) + i];
            if (e < 0) continue;
            const L = XS[i], x = cx + L.p, a = asw(L.cls) / 2, hh = half(L.cls);
            if (pass === 0) fill(x - hh, cy + YS[j].p - half(YS[j].cls), x + hh, cy + YS[j + 1].p + half(YS[j + 1].cls), T.SIDEWALK);
            else fill(x - a, cy + YS[j].p, x + a, cy + YS[j + 1].p, T.ROAD, e + 1);
          }
      }
      for (const nd of myNodes) {
        const hx = nd.aw[0] / 2, hy = nd.aw[1] / 2;
        fill(nd.x - hx, nd.y - hy, nd.x + hx, nd.y + hy, T.ROAD, 0x8000 | nd.id);
        for (let y = nd.y - hy; y < nd.y + hy; y++) for (let x = nd.x - hx; x < nd.x + hx; x++) rf[y * W + x] |= RF.BOX;
      }
      // (5) светофоры / знаки «стоп» и зебры
      for (const nd of myNodes) {
        nd.phase = rnd() * 40; // смещение цикла светофора, с
        this.nodeCtrl(nd);
      }
      // (6) кварталы → свободные прямоугольники; площадь и парки
      const cells = [];
      for (let j = 0; j < ny; j++)
        for (let i = 0; i < nx; i++) {
          if (!used(i, j)) continue;
          const r = cellRect(i, j);
          const d = Math.hypot((r.x0 + r.x1) / 2 - cx, (r.y0 + r.y1) / 2 - cy);
          const side = { 0: YS[j + 1].cls, 2: YS[j].cls, 1: XS[i + 1].cls, 3: XS[i].cls }; // класс улицы с каждой стороны
          const outer = !used(i - 1, j) || !used(i + 1, j) || !used(i, j - 1) || !used(i, j + 1);
          cells.push({ i, j, r, d, zone: 'suburb', side, outer, use: null, rects: [{ x0: r.x0, y0: r.y0, x1: r.x1, y1: r.y1 }] });
        }
      cells.sort((a, b) => a.d - b.d);
      // зоны по рангу удалённости: в каждом городе есть центр, середина и окраина
      const zs = J.ZSHARE[reg.style] || J.ZSHARE.usa, nC = cells.length;
      cells.forEach((c, k) => {
        const q = (k + 0.5) / nC;
        c.zone = q < zs[0] ? 'core' : q < zs[0] + zs[1] ? 'downtown' : q < zs[0] + zs[1] + zs[2] ? 'midtown' : 'suburb';
      });
      this.cityGrids[reg.id] = { XS, YS, nx, ny, cells: cells.length, cx, cy };
      const ctx = { reg, G, rnd, R, cx, cy, placed: [], gas: false };
      if (cells.length > 3) {
        cells[0].use = 'plaza';
        cells[0].rects = [];
        this.makePlaza(cells[0].r, ctx);
      }
      const freeCells = (zones) => cells.filter((c) => !c.use && c.rects.length && (!zones || zones.includes(c.zone)));
      const nPark = cells.length >= 8 ? Math.max(1, Math.round(cells.length / 14)) : 0;
      for (let k = 0; k < nPark; k++) {
        const cand = freeCells(['midtown', 'downtown']);
        const c = cand.length ? cand[(rnd() * cand.length) | 0] : null;
        if (c) {
          c.use = 'park';
          c.rects = [];
          this.makePark(c.r, ctx);
        }
      }
      // (7) большие особые здания вырезают участки до нарезки, мелкие получают участки потом
      const prefOf = (t) => J.CITY_PREF[t] || J.CITY_PREF_DEFAULT;
      const list = (J.CITY_BUILDINGS[reg.id] || []).slice();
      const bigs = list.filter((t) => {
        const s = prefOf(t).s;
        return s.w > 10 || s.d > 10;
      });
      const smalls = list.filter((t) => !bigs.includes(t));
      const lots = [];
      for (const type of bigs) {
        const pf = prefOf(type);
        let best = null, bs = -1e9;
        for (const c of cells) {
          if (c.use === 'plaza' || c.use === 'park') continue;
          for (const r of c.rects) {
            const fit = this.carveFit(r, c, pf.s);
            if (!fit) continue;
            const z = pf.z.indexOf(c.zone);
            let sc = (z < 0 ? -60 : -z * 15) - c.d * 0.08 + (fit.ave ? 4 : 0) - fit.waste * 0.01;
            if (pf.water && c.outer) sc += 30;
            if (sc > bs) {
              bs = sc;
              best = { c, r, fit };
            }
          }
        }
        if (!best) {
          smalls.push(type);
          continue;
        }
        const lot = this.carve(best.c, best.r, best.fit);
        lot.taken = true;
        lots.push(lot);
        const b = this.buildOnLot(lot, type, ctx, pf);
        if (b) ctx.placed.push(b);
      }
      // (8) нарезка остальных прямоугольников на участки
      for (const c of cells) for (const r of c.rects) this.subdivide(c, r, ctx, lots);
      // (9) мелкие особые здания — на лучший участок (зона, проспект, близость к центру)
      const missing = [];
      for (const type of smalls) {
        const pf = prefOf(type);
        let best = null, bs = -1e9;
        for (const L of lots) {
          if (L.taken || L.fw < pf.s.w || L.fd < pf.s.d) continue;
          const z = pf.z.indexOf(L.zone);
          const sc = (z < 0 ? -60 : -z * 15) - L.d * 0.08 + (L.street === 'ave' ? 4 : 0) - (L.fw * L.fd) / 300 + (pf.water && L.cell.outer ? 30 : 0);
          if (sc > bs) {
            bs = sc;
            best = L;
          }
        }
        if (!best) {
          missing.push(type);
          continue;
        }
        best.taken = true;
        const b = this.buildOnLot(best, type, ctx, pf);
        if (b) ctx.placed.push(b);
        else missing.push(type);
      }
      // (10) обычная застройка (+ одна заправка на проспекте)
      for (const L of lots) if (!L.taken) this.buildOnLot(L, null, ctx, null);
      // (11) не поместилось — на окраину
      let ang = 0;
      for (const type of missing) {
        const ox = Math.cos(ang) * (R + 14), oy = Math.sin(ang) * (R + 14);
        ang += 1.3;
        const p = this.findLand(cx + ox, cy + oy, 12, 10) || this.findLandLoose(cx + ox, cy + oy, 12, 10);
        if (p) {
          this.clearArea(p.x - 1, p.y - 1, 14, 13, T.PAVE);
          ctx.placed.push(this.addBuildingDir(type, p.x, p.y, 12, 10, reg, 0, { arch: 'civic', floors: J.BTYPES[type].floors, zone: 'suburb' }));
        }
      }
      for (const L of lots) {
        L.cell = null; // без циклических ссылок
        this.lots.push(L);
      }
      reg.buildings = ctx.placed.map((b) => b.id);
      reg.cityNodes = myNodes.map((n) => n.id);
    }

    // Управление перекрёстком: светофор (≥3 рёбер и проспект или 4 ребра), «стоп» (≥3) или ничего.
    // Светофорам — зебры шириной 3 клетки сразу за коробкой на каждом подходе и стоп-линии.
    nodeCtrl(nd) {
      const W = this.W, net = this.net, rf = this.rf;
      const deg = nd.edges.length;
      const ave = nd.edges.some((e) => net.edges[e].cls !== 'st');
      nd.ctrl = deg >= 3 && (ave || deg === 4) ? 'signal' : deg >= 3 ? 'stop' : 'none';
      if (nd.ctrl === 'none') return;
      const hx = nd.aw[0] / 2, hy = nd.aw[1] / 2;
      const sig = nd.ctrl === 'signal';
      for (const eid of nd.edges) {
        const e = net.edges[eid];
        const [sx, sy] = this.approachDir(nd, e);
        // светофор: зебра в 3 клетки, за ней ряд стоп-линии; «стоп»: стоп-линия у самой коробки
        for (let k = 0; k < 4; k++) {
          const flag = sig ? (k < 3 ? RF.CROSS : RF.STOP) : k === 0 ? RF.STOP : 0;
          const n = sx ? 2 * hy : 2 * hx;
          for (let m = 0; m < n; m++) {
            const x = sx ? (sx > 0 ? nd.x + hx + k : nd.x - hx - 1 - k) : nd.x - hx + m;
            const y = sx ? nd.y - hy + m : sy > 0 ? nd.y + hy + k : nd.y - hy - 1 - k;
            if (!this.inb(x, y)) continue;
            const i = y * W + x;
            if (this.t[i] !== T.ROAD || this.rid[i] !== e.id + 1) continue;
            rf[i] = (rf[i] & ~(RF.CROSS | RF.STOP)) | flag;
          }
        }
      }
    }
    // Направление подхода ребра к узлу (единичный вектор по осям от узла к ребру)
    approachDir(nd, e) {
      let ox, oy;
      if (e.pts) {
        const p = e.a === nd.id ? e.pts[Math.min(2, e.pts.length - 1)] : e.pts[Math.max(0, e.pts.length - 3)];
        ox = p.x - nd.x;
        oy = p.y - nd.y;
      } else {
        const o = this.net.nodes[e.a === nd.id ? e.b : e.a];
        ox = o.x - nd.x;
        oy = o.y - nd.y;
      }
      return Math.abs(ox) >= Math.abs(oy) ? [Math.sign(ox), 0] : [0, Math.sign(oy)];
    }

    // Можно ли вырезать участок s ({w,d}) из прямоугольника r квартала c? Фасад — вдоль длинной стороны.
    carveFit(r, c, s) {
      const W = r.x1 - r.x0, H = r.y1 - r.y0;
      const horiz = W >= H; // фасад вдоль x (на север или юг)
      const along = horiz ? W : H, depth = horiz ? H : W;
      const need = s.w + 4, needD = s.d + 3;
      if (along < need || depth < needD) return null;
      // сторона: лучше на проспект
      const sA = horiz ? 2 : 3, sB = horiz ? 0 : 1;
      const touches = (dir) => (dir === 2 ? r.y0 === c.r.y0 : dir === 0 ? r.y1 === c.r.y1 : dir === 3 ? r.x0 === c.r.x0 : r.x1 === c.r.x1);
      let dir = c.side[sA] === 'ave' && touches(sA) ? sA : c.side[sB] === 'ave' && touches(sB) ? sB : touches(sA) ? sA : sB;
      if (!touches(dir)) return null;
      const halfD = depth >= 2 * needD + 2; // половина глубины, если остаток ещё пригоден
      return { horiz, dir, pw: need, pd: halfD ? depth >> 1 : depth, ave: c.side[dir] === 'ave', waste: (along - need) * depth };
    }
    // Вырезать участок из прямоугольника, вернуть лот
    carve(c, r, f) {
      const idx = c.rects.indexOf(r);
      c.rects.splice(idx, 1);
      let lot;
      if (f.horiz) {
        const y0 = f.dir === 2 ? r.y0 : r.y1 - f.pd, y1 = y0 + f.pd;
        lot = { x: r.x0, y: y0, w: f.pw, h: f.pd };
        if (r.x1 - (r.x0 + f.pw) >= 6) c.rects.push({ x0: r.x0 + f.pw, y0: r.y0, x1: r.x1, y1: r.y1 });
        else if (r.x1 > r.x0 + f.pw) this.fillRect({ x0: r.x0 + f.pw, y0: r.y0, x1: r.x1, y1: r.y1 }, T.PAVE);
        if (f.pd < r.y1 - r.y0) c.rects.push(f.dir === 2 ? { x0: r.x0, y0: y1, x1: r.x0 + f.pw, y1: r.y1 } : { x0: r.x0, y0: r.y0, x1: r.x0 + f.pw, y1: y0 });
      } else {
        const x0 = f.dir === 3 ? r.x0 : r.x1 - f.pd, x1 = x0 + f.pd;
        lot = { x: x0, y: r.y0, w: f.pd, h: f.pw };
        if (r.y1 - (r.y0 + f.pw) >= 6) c.rects.push({ x0: r.x0, y0: r.y0 + f.pw, x1: r.x1, y1: r.y1 });
        else if (r.y1 > r.y0 + f.pw) this.fillRect({ x0: r.x0, y0: r.y0 + f.pw, x1: r.x1, y1: r.y1 }, T.PAVE);
        if (f.pd < r.x1 - r.x0) c.rects.push(f.dir === 3 ? { x0: x1, y0: r.y0, x1: r.x1, y1: r.y0 + f.pw } : { x0: r.x0, y0: r.y0, x1: x0, y1: r.y0 + f.pw });
      }
      return this.mkLot(c, lot.x, lot.y, lot.w, lot.h, f.dir);
    }
    mkLot(c, x, y, w, h, dir) {
      const sb = c.zone === 'suburb' ? 3 : c.zone === 'midtown' ? 1 : 2; // отступ от улицы
      const fw = dir & 1 ? h : w, depth = dir & 1 ? w : h;
      return { x, y, w, h, dir, zone: c.zone, d: c.d, street: c.side[dir], cell: c, b: -1, sb, fw, fd: depth - sb - (c.zone === 'suburb' ? 3 : 1), taken: false };
    }

    // Нарезка свободного прямоугольника на участки по зоне; участки смотрят на улицу длинными сторонами
    subdivide(c, r, ctx, out) {
      const W = r.x1 - r.x0, H = r.y1 - r.y0;
      if (W < 6 || H < 6) {
        this.fillRect(r, c.zone === 'suburb' ? T.LAWN : T.PAVE);
        return;
      }
      const rnd = ctx.rnd;
      const horiz = W >= H;
      const along = horiz ? W : H, depth = horiz ? H : W;
      const sides = horiz ? [2, 0] : [3, 1];
      // какие стороны действительно выходят на улицу (внутренние остатки — только одна)
      const touches = (dir) => (dir === 2 ? r.y0 === c.r.y0 : dir === 0 ? r.y1 === c.r.y1 : dir === 3 ? r.x0 === c.r.x0 : r.x1 === c.r.x1);
      const narrow = ctx.G.sw <= 6; // старый свет: узкие фасады
      const fr = c.zone === 'suburb' ? (narrow ? [9, 13] : [12, 16]) : c.zone === 'midtown' ? (narrow ? [7, 11] : [8, 14]) : [18, 26];
      const t0 = touches(sides[0]), t1 = touches(sides[1]);
      if (!t0 && !t1) {
        // внутренний кусок без выхода на улицу — двор
        this.fillRect(r, c.zone === 'suburb' ? T.LAWN : T.PAVE);
        return;
      }
      const rows = [];
      if (c.zone === 'core' || c.zone === 'downtown' || depth < 20 || !(t0 && t1)) rows.push({ off: 0, d: depth, dir: t0 ? sides[0] : sides[1] });
      else {
        const h0 = depth >> 1;
        rows.push({ off: 0, d: h0, dir: sides[0] }, { off: h0, d: depth - h0, dir: sides[1] });
      }
      for (const row of rows) {
        let a = 0;
        while (a < along) {
          let w = fr[0] + ((rnd() * (fr[1] - fr[0] + 1)) | 0);
          if (along - (a + w) < fr[0]) w = along - a;
          const L = horiz ? this.mkLot(c, r.x0 + a, r.y0 + row.off, w, row.d, row.dir) : this.mkLot(c, r.x0 + row.off, r.y0 + a, row.d, w, row.dir);
          if (L.fw >= 6 && L.fd >= 5) out.push(L);
          else this.fillRect({ x0: L.x, y0: L.y, x1: L.x + L.w, y1: L.y + L.h }, c.zone === 'suburb' ? T.LAWN : T.PAVE);
          a += w;
        }
      }
    }
    fillRect(r, t) {
      for (let y = r.y0; y < r.y1; y++) for (let x = r.x0; x < r.x1; x++) this.setT(x, y, t);
    }

    makePlaza(r, ctx) {
      const W = this.W;
      this.fillRect(r, T.PLAZA);
      const mx = (r.x0 + r.x1) >> 1, my = (r.y0 + r.y1) >> 1;
      this.o[my * W + mx] = O.FOUNTAIN;
      // деревья по периметру
      for (let y = r.y0 + 1; y < r.y1; y += 6) for (let x = r.x0 + 1; x < r.x1; x += 6) if (x < r.x0 + 2 || x > r.x1 - 3 || y < r.y0 + 2 || y > r.y1 - 3) this.o[y * W + x] = O.STREETTREE;
      for (const k of [-2, 2]) {
        this.o[(my + 4) * W + mx + k] = O.BENCH;
        this.od[(my + 4) * W + mx + k] = 0;
        this.o[(my - 4) * W + mx + k] = O.BENCH;
        this.od[(my - 4) * W + mx + k] = 2;
      }
      this.places[ctx.reg.id + '_plaza'] = { x: mx + 0.5, y: my + 5.5 };
    }
    makePark(r, ctx) {
      const W = this.W, { x0, x1, y0, y1 } = r;
      const mx = (x0 + x1) >> 1, my = (y0 + y1) >> 1;
      const tree = ctx.reg.biome === 'tropical' || ctx.reg.biome === 'desert' ? O.PALM : ctx.reg.biome === 'mediterranean' ? O.OLIVE : O.TREE;
      for (let y = y0; y < y1; y++)
        for (let x = x0; x < x1; x++) {
          // дорожки: крест и диагональ
          const path = Math.abs(x + 0.5 - mx) < 1 || Math.abs(y + 0.5 - my) < 1 || Math.abs(x - x0 - ((y - y0) * (x1 - x0)) / (y1 - y0)) < 1;
          if (path) {
            this.setT(x, y, T.PAVE);
            continue;
          }
          this.setT(x, y, T.LAWN);
          const h = J.hash2(x, y, this.seed + 5);
          if (h < 0.06) this.o[y * W + x] = tree;
          else if (h < 0.08) this.o[y * W + x] = O.BUSH;
          else if (h < 0.1) this.o[y * W + x] = O.FLOWERS;
        }
      // скамейки вдоль дорожек (рядом с дорожкой, на газоне)
      for (let k = -2; k <= 2; k++) {
        if (!k) continue;
        const bx = mx + k * 5, by = my + 2;
        if (bx > x0 && bx < x1 - 1 && this.t[by * W + bx] === T.LAWN) { this.o[by * W + bx] = O.BENCH; this.od[by * W + bx] = 2; }
        const cx2 = mx + 2, cy2 = my + k * 5;
        if (cy2 > y0 && cy2 < y1 - 1 && this.t[cy2 * W + cx2] === T.LAWN) { this.o[cy2 * W + cx2] = O.BENCH; this.od[cy2 * W + cx2] = 3; }
      }
    }

    // Поставить здание (особое или обычное по архетипу) на участок лицом к L.dir
    buildOnLot(L, type, ctx, pf) {
      const rnd = ctx.rnd, G = ctx.G, reg = ctx.reg, W = this.W;
      const zone = L.zone;
      const fall = 1 - J.smooth(0.06, 0.55, L.d / ctx.R); // 1 в центре → 0 на 0.55R
      if (!type) {
        if (L.street === 'ave' && !ctx.gas && (zone === 'midtown' || zone === 'suburb') && L.fw >= 16 && L.fd >= 10 && ctx.R >= 40) {
          ctx.gas = true;
          return this.makeGas(L, ctx);
        }
        if ((zone === 'midtown' || zone === 'downtown') && L.fw >= 14 && L.fd >= 12 && rnd() < 0.07) return this.makeParkingLot(L, ctx);
      }
      this.fillRect({ x0: L.x, y0: L.y, x1: L.x + L.w, y1: L.y + L.h }, zone === 'suburb' ? T.LAWN : T.PAVE);
      let arch, fw, fd, floors;
      if (type) {
        const s = pf.s;
        fw = Math.min(L.fw - 2, Math.max(s.w, Math.round(L.fw * 0.8)));
        fd = Math.min(L.fd, Math.max(s.d, Math.round(L.fd * 0.85)));
        floors = pf.f || J.BTYPES[type].floors;
        arch = J.BTYPES[type].special ? 'special' : 'civic';
        if (pf.tower && G.maxF >= 10) {
          floors = Math.max(6, Math.round(floors * (0.5 + 0.5 * fall) * Math.min(1.2, G.maxF / 36)));
          arch = 'tower_glass';
        } else if (pf.tower) floors = Math.min(floors, G.maxF + 2);
        if (type === 'rohan') arch = 'suburban';
      } else if (zone === 'core' || zone === 'downtown') {
        const towers = G.maxF >= 10;
        arch = towers ? (rnd() < 0.55 ? 'tower_glass' : 'tower_setback') : rnd() < 0.5 ? 'office_mid' : 'apartment';
        if (rnd() < 0.1 && L.fw >= 16) arch = 'parking';
        fw = L.fw - (towers ? 4 : 2);
        fd = L.fd - (towers ? 2 : 0);
        floors = Math.max(towers ? 8 : 3, Math.round(G.maxF * (0.3 + 0.7 * fall) * (0.65 + rnd() * 0.5)));
        if (arch === 'parking') floors = 4 + ((rnd() * 3) | 0);
      } else if (zone === 'midtown') {
        const r = rnd();
        arch = r < 0.4 ? 'shopfront' : r < 0.75 ? 'apartment' : 'office_mid';
        fw = L.fw - (arch === 'shopfront' ? 0 : 2);
        fd = Math.min(L.fd, 11 + ((rnd() * 4) | 0));
        floors = Math.max(2, Math.round(Math.min(G.maxF, 12) * (0.25 + 0.6 * fall + rnd() * 0.25)));
      } else {
        arch = rnd() < 0.08 && L.street === 'ave' ? 'warehouse' : 'suburban';
        fw = arch === 'warehouse' ? L.fw - 2 : Math.min(L.fw - 4, 8 + ((rnd() * 3) | 0));
        fd = arch === 'warehouse' ? L.fd : Math.min(L.fd, 7 + ((rnd() * 3) | 0));
        floors = arch === 'warehouse' ? 2 : 1 + (rnd() < 0.55 ? 1 : 0);
      }
      if (fw < 4 || fd < 4) return null;
      const d = L.dir;
      const sb = arch === 'shopfront' || arch === 'apartment' ? Math.min(1, L.sb) : L.sb;
      const along = d & 1 ? L.h : L.w;
      // дом сдвинут к одной стороне участка (место под подъездную дорожку)
      const off = arch === 'suburban' ? (rnd() < 0.5 ? 1 : along - fw - 1) : (along - fw) >> 1;
      let bx, by, bw, bh;
      if (d === 0) { bw = fw; bh = fd; bx = L.x + off; by = L.y + L.h - sb - fd; }
      else if (d === 2) { bw = fw; bh = fd; bx = L.x + off; by = L.y + sb; }
      else if (d === 1) { bw = fd; bh = fw; bx = L.x + L.w - sb - fd; by = L.y + off; }
      else { bw = fd; bh = fw; bx = L.x + sb; by = L.y + off; }
      const b = this.addBuildingDir(type || 'house', bx, by, bw, bh, reg, d, { arch, floors, zone });
      L.b = b.id;
      // дорожка от двери до тротуара, без мебели (RF.KEEP)
      for (let k = 1; k < sb + 8; k++) {
        const x = b.door.x + DX[d] * k, y = b.door.y + DY[d] * k, i = y * W + x;
        const t = this.t[i];
        if (t !== T.LAWN && t !== T.PAVE && t !== T.SIDEWALK) break; // дошли до асфальта
        if (t === T.LAWN) this.setT(x, y, T.PAVE);
        this.o[i] = 0;
        this.rf[i] |= RF.KEEP;
      }
      if (arch === 'suburban') this.yardDecor(L, b, ctx);
      // деревья на площадках у башен
      if (zone === 'core' || zone === 'downtown')
        for (let y = L.y + 1; y < L.y + L.h - 1; y += 4)
          for (let x = L.x + 1; x < L.x + L.w - 1; x += 4) {
            const i = y * W + x;
            if (this.t[i] === T.PAVE && !(this.rf[i] & RF.KEEP) && J.hash2(x, y, 77) < 0.3) this.o[i] = O.STREETTREE;
          }
      if (arch === 'suburban' && L.street === 'ave' && rnd() < 0.25) {
        // рекламный щит в углу двора, лицом к проспекту
        const x = d & 1 ? (d === 1 ? L.x + L.w - 2 : L.x + 1) : L.x + (off < 3 ? L.w - 2 : 1), y = d & 1 ? L.y + (off < 3 ? L.h - 2 : 1) : d === 0 ? L.y + L.h - 2 : L.y + 1;
        const i = y * W + x;
        if (this.t[i] === T.LAWN && !this.o[i] && !(this.rf[i] & RF.KEEP)) {
          this.o[i] = O.BILLBOARD;
          this.od[i] = d;
        }
      }
      return b;
    }

    // Двор частного дома: забор (США) или живая изгородь (Лондон, Япония) по боковым и задней границам, деревья
    yardDecor(L, b, ctx) {
      const W = this.W, d = L.dir;
      const kind = ctx.reg.style === 'london' || ctx.reg.style === 'japan' ? O.HEDGE : ctx.reg.style === 'usa' || ctx.reg.style === 'western' ? O.FENCE : 0;
      const edge = (x, y, od) => {
        const i = y * W + x;
        if (kind && this.t[i] === T.LAWN && !this.o[i] && !(this.rf[i] & RF.KEEP)) {
          this.o[i] = kind;
          this.od[i] = od;
        }
      };
      for (let x = L.x; x < L.x + L.w; x++) {
        if (d !== 2) edge(x, L.y, 0);
        if (d !== 0) edge(x, L.y + L.h - 1, 0);
      }
      for (let y = L.y; y < L.y + L.h; y++) {
        if (d !== 3) edge(L.x, y, 1);
        if (d !== 1) edge(L.x + L.w - 1, y, 1);
      }
      // деревья во дворе
      for (let k = 0; k < 2; k++) {
        const x = L.x + 2 + ((ctx.rnd() * Math.max(1, L.w - 4)) | 0), y = L.y + 2 + ((ctx.rnd() * Math.max(1, L.h - 4)) | 0);
        const i = y * W + x;
        if (this.t[i] === T.LAWN && !this.o[i] && !(this.rf[i] & RF.KEEP)) this.o[i] = ctx.reg.biome === 'tropical' || ctx.reg.biome === 'desert' ? O.PALM : O.TREE;
      }
    }

    // Заправка: площадка, навес (не твёрдый), колонки и магазин-киоск (тип 'shop')
    makeGas(L, ctx) {
      const W = this.W, d = L.dir;
      this.fillRect({ x0: L.x, y0: L.y, x1: L.x + L.w, y1: L.y + L.h }, T.PAVE);
      const kw = 8, kd = 5;
      let kx, ky;
      if (d === 0) { kx = L.x + 1; ky = L.y + 1; }
      else if (d === 2) { kx = L.x + 1; ky = L.y + L.h - 1 - kd; }
      else if (d === 1) { kx = L.x + 1; ky = L.y + 1; }
      else { kx = L.x + L.w - 1 - kd; ky = L.y + 1; }
      const b = this.addBuildingDir('shop', kx, ky, d & 1 ? kd : kw, d & 1 ? kw : kd, ctx.reg, d, { arch: 'gas_kiosk', floors: 1, zone: L.zone });
      b.name = 'Заправка';
      b.sign = '#ff5a3c';
      // островки с колонками между киоском и улицей
      const pumps = [];
      const along = d & 1 ? L.h : L.w;
      for (let k = 0; k < 3; k++) {
        const a = 4 + k * 4;
        if (a > along - 3) break;
        const x = d & 1 ? (d === 1 ? L.x + L.w - 5 : L.x + 4) : L.x + a, y = d & 1 ? L.y + a : d === 0 ? L.y + L.h - 5 : L.y + 4;
        const i = y * W + x;
        if (this.t[i] === T.PAVE && !(this.rf[i] & RF.KEEP)) {
          this.o[i] = O.PUMP;
          this.od[i] = d;
          pumps.push([x, y]);
        }
      }
      if (pumps.length) b.canopy = { x: Math.min(...pumps.map((p) => p[0])) - 2, y: Math.min(...pumps.map((p) => p[1])) - 2, x1: Math.max(...pumps.map((p) => p[0])) + 3, y1: Math.max(...pumps.map((p) => p[1])) + 3, h: 4.6 };
      // дорожка к двери
      for (let k = 1; k < 8; k++) {
        const x = b.door.x + DX[d] * k, y = b.door.y + DY[d] * k, i = y * W + x;
        if (this.t[i] !== T.PAVE && this.t[i] !== T.SIDEWALK) break;
        if (this.o[i] === O.PUMP) break;
        this.rf[i] |= RF.KEEP;
      }
      L.b = b.id;
      return b;
    }

    // Открытая парковка: асфальт, проезд вдоль улицы и ряды мест 2.5 × 5 м
    makeParkingLot(L, ctx) {
      const d = L.dir;
      this.fillRect({ x0: L.x, y0: L.y, x1: L.x + L.w, y1: L.y + L.h }, T.PARKING);
      // локальные оси: a — вдоль улицы, q — вглубь от улицы
      const along = d & 1 ? L.h : L.w, depth = d & 1 ? L.w : L.h;
      const toXY = (a, q) => {
        if (d === 0) return [L.x + a, L.y + L.h - q];
        if (d === 2) return [L.x + a, L.y + q];
        if (d === 1) return [L.x + L.w - q, L.y + a];
        return [L.x + q, L.y + a];
      };
      const inAng = Math.atan2(-DY[d], -DX[d]); // въезд: от улицы вглубь
      // ряды: проезд 6 м от фасадной линии, места за ним; при глубине — второй ряд у улицы
      // ряд мест за проездом (носом от улицы), при глубине — второй ряд у задней границы (носом к улице)
      const rows = [{ q0: 6.5, face: inAng }];
      if (depth >= 23) rows.push({ q0: depth - 5.5, face: inAng + Math.PI });
      for (const row of rows) {
        for (let a = 1.5; a + 2.5 <= along - 1; a += 2.5) {
          const [x, y] = toXY(a + 1.25, row.q0 + 2.5);
          this.parkSpots.push({ x, y, ang: row.face, lot: true });
        }
      }
      L.b = -2;
      return null;
    }

    // ===================== Шоссе =====================
    // Маршруты J.ROADS: от въездного перекрёстка города, 2+2 полосы, сглаженные, мосты над водой
    genHighways() {
      const net = this.net;
      const pt = (p) => (typeof p === 'string' ? J.REGION[p] : { x: p[0], y: p[1] });
      const usedNodes = new Set();
      let seg = 0;
      for (const road of J.ROADS) {
        const P0 = road.map(pt);
        // концы-города заменяются въездами на краю города
        const pts = P0.map((r, k) => {
          if (!r.id || !r.city || !r.cityNodes) return { x: r.x, y: r.y, node: -1 };
          const nb = P0[k === 0 ? 1 : k - 1];
          return this.gateway(r, nb.x, nb.y, usedNodes);
        });
        for (const p of pts) if (p.node >= 0) usedNodes.add(p.node);
        const poly = [];
        const add = (p) => {
          const l = poly[poly.length - 1];
          if (!l || Math.hypot(l.x - p.x, l.y - p.y) > 0.5) poly.push({ x: p.x, y: p.y });
        };
        const A0 = pts[0], B0 = pts[pts.length - 1];
        const short = pts.length === 2 && A0.node >= 0 && B0.node >= 0 && Math.hypot(B0.x - A0.x, B0.y - A0.y) < 60;
        if (short) {
          // соседние города (Рим — Неаполь): напрямую, без выездов и изгибов
          add(A0);
          add({ x: (A0.x + B0.x) / 2, y: (A0.y + B0.y) / 2 });
          add(B0);
        } else
          for (let k = 0; k < pts.length - 1; k++) {
            const A = pts[k], B = pts[k + 1];
            // выезд: прямо по оси въезда на 18 клеток
            const a2 = A.ox !== undefined ? { x: A.x + A.ox * 18, y: A.y + A.oy * 18 } : { x: A.x, y: A.y };
            const b2 = B.ox !== undefined ? { x: B.x + B.ox * 18, y: B.y + B.oy * 18 } : { x: B.x, y: B.y };
            const L = Math.hypot(b2.x - a2.x, b2.y - a2.y) || 1;
            const nx = -(b2.y - a2.y) / L, ny = (b2.x - a2.x) / L;
            seg++;
            if (k === 0) {
              add(A);
              if (A.ox !== undefined) add({ x: A.x + A.ox * 8, y: A.y + A.oy * 8 });
            }
            add(a2);
            // плавные S-изгибы: редкие контрольные точки, потом сглаживание
            const nc = Math.max(1, Math.floor(L / 60));
            for (let c = 1; c < nc; c++) {
              const tt = c / nc;
              const off = (J.fbm(c * 0.7, seg * 7.3, this.seed + 404, 2) - 0.5) * 40 * Math.sin(Math.PI * tt);
              add({ x: a2.x + (b2.x - a2.x) * tt + nx * off, y: a2.y + (b2.y - a2.y) * tt + ny * off });
            }
            add(b2);
            if (k === pts.length - 2) {
              if (B.ox !== undefined) add({ x: B.x + B.ox * 8, y: B.y + B.oy * 8 });
              add(B);
            }
          }
        const sm = short ? poly : chaikin(chaikin(poly));
        // накопленная длина вдоль ломаной
        const cum = [0];
        for (let k = 1; k < sm.length; k++) cum.push(cum[k - 1] + Math.hypot(sm[k].x - sm[k - 1].x, sm[k].y - sm[k - 1].y));
        const nA = A0.node >= 0 ? net.nodes[A0.node] : null, nB = B0.node >= 0 ? net.nodes[B0.node] : null;
        const regA = J.REGION[nA ? nA.city : ''];
        const drive = regA ? (J.GRID[regA.style] || J.GRID.usa).drive : 'R';
        const e = { id: net.edges.length, a: A0.node, b: B0.node, cls: 'hw', horiz: false, lanes: 2, w: HW_HALF * 2, sw: 0, x0: sm[0].x, y0: sm[0].y, x1: sm[sm.length - 1].x, y1: sm[sm.length - 1].y, city: null, drive, len: cum[cum.length - 1], pts: sm, cum };
        net.edges.push(e);
        // сужение до ширины городской улицы на последних 16 клетках
        const endHalf = (nd, ox) => (nd ? (ox ? nd.aw[1] : nd.aw[0]) / 2 : HW_HALF);
        const hA = endHalf(nA, A0.ox), hB = endHalf(nB, B0.ox);
        const total = e.len;
        const hwAt = (d) => {
          if (nA && d < 16) return J.lerp(hA, HW_HALF, J.smooth(0, 16, d));
          if (nB && total - d < 16) return J.lerp(hB, HW_HALF, J.smooth(0, 16, total - d));
          return HW_HALF;
        };
        this.strokeRoad(sm, cum, hwAt, e.id + 1, total);
        if (nA) {
          nA.edges.push(e.id);
          this.nodeCtrl(nA);
        }
        if (nB) {
          nB.edges.push(e.id);
          this.nodeCtrl(nB);
        }
      }
    }
    // Въезд: крайний перекрёсток города, лучше всего смотрящий в сторону (tx, ty), с осью выезда наружу
    gateway(reg, tx, ty, usedNodes) {
      const net = this.net;
      const ang = Math.atan2(ty - reg.y, tx - reg.x);
      const missing = (n) => {
        const out = [];
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const has = n.edges.some((eid) => {
            const e = net.edges[eid];
            if (e.cls === 'hw') return true;
            const o = e.a === n.id ? net.nodes[e.b] : net.nodes[e.a];
            return Math.sign(o.x - n.x) === dx && Math.sign(o.y - n.y) === dy;
          });
          if (!has) out.push([dx, dy]);
        }
        return out;
      };
      let best = null, bs = -1e9, bdir = null;
      for (const id of reg.cityNodes || []) {
        const n = net.nodes[id];
        if (n.edges.length > 3 || usedNodes.has(id)) continue; // только на границе и не занятые
        const miss = missing(n);
        if (!miss.length) continue;
        let dd = -2, dir = null;
        for (const [dx, dy] of miss) {
          const v = dx * Math.cos(ang) + dy * Math.sin(ang);
          if (v > dd) {
            dd = v;
            dir = [dx, dy];
          }
        }
        const a = Math.atan2(n.y - reg.y, n.x - reg.x);
        const s = Math.cos(a - ang) * 100 + dd * 60 + Math.hypot(n.x - reg.x, n.y - reg.y) * 0.2 + ((dir[0] ? n.aw[1] : n.aw[0]) >= 10 ? 8 : 0);
        if (s > bs) {
          bs = s;
          best = n;
          bdir = dir;
        }
      }
      if (!best) return { x: reg.x, y: reg.y, node: -1 };
      return { x: best.x, y: best.y, node: best.id, ox: bdir[0], oy: bdir[1] };
    }
    // Проводит шоссе по ломаной с переменной полушириной; не режет кварталы, другие дороги и здания
    strokeRoad(pts, cum, hwAt, rid, total) {
      const W = this.W;
      for (let k = 0; k < pts.length - 1; k++) {
        const a = pts[k], b = pts[k + 1];
        const L = Math.hypot(b.x - a.x, b.y - a.y);
        if (L < 1e-6) continue;
        const nx = -(b.y - a.y) / L, ny = (b.x - a.x) / L;
        for (let d = 0; d <= L; d += 0.5) {
          const dist = cum[k] + d;
          const hw = hwAt(dist);
          const nearEnd = Math.min(dist, total - dist) < 15;
          const px = a.x + (b.x - a.x) * (d / L), py = a.y + (b.y - a.y) * (d / L);
          for (let o = -hw + 0.25; o <= hw - 0.25; o += 0.5) {
            const X = Math.floor(px + nx * o), Y = Math.floor(py + ny * o);
            if (!this.inb(X, Y)) continue;
            const i = Y * W + X;
            const t = this.t[i];
            if (t === T.BUILDING || t === T.WALL || this.rid[i] & 0x8000) continue;
            if (URBAN[t] && !(nearEnd && t === T.SIDEWALK)) continue; // у въезда прорезаем внешний тротуар
            if ((t === T.ROAD || t === T.BRIDGE) && this.rid[i] && this.rid[i] !== rid) continue;
            if (this.rid[i] !== rid) this.under[i] = t === T.ROAD || t === T.BRIDGE || t === T.SIDEWALK ? T.DIRT : t;
            if (t === T.DEEP || t === T.WATER || t === T.BRIDGE || t === T.SWAMP) this.setT(X, Y, T.BRIDGE);
            else this.setT(X, Y, T.ROAD);
            this.rid[i] = rid;
          }
        }
      }
    }

    // ===================== Уличная мебель =====================
    decorateCities() {
      const W = this.W, net = this.net;
      const put = (x, y, o, od) => {
        if (!this.inb(x, y)) return false;
        const i = y * W + x;
        if (this.t[i] !== T.SIDEWALK || this.o[i] || this.rf[i] & RF.KEEP) return false;
        this.o[i] = o;
        this.od[i] = od;
        return true;
      };
      for (const e of net.edges) {
        if (e.cls === 'hw') continue;
        const nA = net.nodes[e.a], nB = net.nodes[e.b];
        const len = e.horiz ? nB.x - nA.x : nB.y - nA.y;
        const hwA = (e.horiz ? nA.aw[0] : nA.aw[1]) / 2 + 4, hwB = (e.horiz ? nB.aw[0] : nB.aw[1]) / 2 + 4;
        const hwE = e.w / 2;
        const ave = e.cls === 'ave';
        const lampStep = ave ? 12 : 16;
        const style = (J.REGION[e.city] || {}).style;
        for (const side of [-1, 1]) {
          // ряд у бордюра = первый ряд тротуара за асфальтом
          const off = side < 0 ? -hwE - 1 : hwE;
          const odir = e.horiz ? (side < 0 ? 0 : 2) : side < 0 ? 1 : 3; // лицом к дороге
          for (let s = hwA; s < len - hwB; s++) {
            const x = e.horiz ? nA.x + s : nA.x + off, y = e.horiz ? nA.y + off : nA.y + s;
            const ph = (s + (side > 0 ? lampStep >> 1 : 0)) % lampStep;
            if (ph === 0) put(x, y, O.LAMP, odir);
            else if (ave && ph === lampStep >> 1 && e.city !== 'arizona') put(x, y, O.STREETTREE, odir);
            else if (s === hwA + 2 && side < 0) put(x, y, O.HYDRANT, odir);
            else if (s === hwA + 1) put(x, y, O.BIN, odir);
            else if (ave && side > 0 && Math.abs(s - (len >> 1)) < 2 && e.id % 2 === 0) {
              if (put(x, y, O.BUSSTOP, odir)) {
                // автобусный карман: полоса у бордюра напротив остановки
                for (let k = -2; k <= 2; k++) {
                  const bx = e.horiz ? x + k : x + (side < 0 ? 1 : -1), by = e.horiz ? y + (side < 0 ? 1 : -1) : y + k;
                  const j = by * W + bx;
                  if (this.t[j] === T.ROAD) this.rf[j] |= RF.BUSBAY;
                }
              }
            } else if (ave && side > 0 && s === (len >> 1) + 3 && e.id % 2 === 0) put(x, y, O.BENCH, odir);
            else if ((style === 'london' || style === 'usa') && side < 0 && s === (len >> 1) + 5 && e.id % 3 === 0) put(x, y, O.PHONE, odir);
          }
        }
        // парковка вдоль бордюра на широких улицах (США): «карман» 1 м у края асфальта
        if (!ave && e.w >= 8) {
          for (const side of [-1, 1]) {
            const offC = side * (hwE - 1.0);
            for (let s = hwA + 4; s + 5 < len - hwB - 2; s += 6.5) {
              const ax = e.horiz ? nA.x + s + 2.5 : nA.x + offC, ay = e.horiz ? nA.y + offC : nA.y + s + 2.5;
              // направление движения у этого края: правостороннее — справа по ходу
              const fwd = (side > 0) === (e.drive === 'R') ? 1 : -1; // вдоль от A к B
              const ang = e.horiz ? (fwd > 0 ? 0 : Math.PI) : fwd > 0 ? Math.PI / 2 : -Math.PI / 2;
              // не перед гидрантом и не в кармане остановки
              const curb = side < 0 ? (e.horiz ? nA.y : nA.x) - hwE - 1 : (e.horiz ? nA.y : nA.x) + hwE;
              const cx0 = e.horiz ? Math.floor(ax) : curb, cy0 = e.horiz ? curb : Math.floor(ay);
              if (this.inb(cx0, cy0) && this.o[cy0 * W + cx0] === O.HYDRANT) continue;
              if (this.rf[Math.floor(ay) * W + Math.floor(ax)] & (RF.BUSBAY | RF.CROSS)) continue;
              this.parkSpots.push({ x: ax, y: ay, ang, edge: e.id });
            }
          }
        }
      }
      // светофоры и знаки «стоп» по углам перекрёстков: стрела над входящими полосами
      for (const nd of net.nodes) {
        if (!nd.ctrl || nd.ctrl === 'none' || !nd.city) continue;
        const hx = nd.aw[0] / 2, hy = nd.aw[1] / 2;
        const left = (J.GRID[J.REGION[nd.city].style] || J.GRID.usa).drive === 'L';
        const corners = left ? [[hx, hy, 0], [-hx - 1, hy, 3], [-hx - 1, -hy - 1, 2], [hx, -hy - 1, 1]] : [[hx, hy, 3], [-hx - 1, hy, 2], [-hx - 1, -hy - 1, 1], [hx, -hy - 1, 0]];
        for (const [ox, oy, od] of corners) {
          const x = nd.x + ox, y = nd.y + oy, i = y * W + x;
          if (this.inb(x, y) && this.t[i] === T.SIDEWALK && this.o[i] && !(this.rf[i] & RF.KEEP)) this.o[i] = 0; // светофор важнее урны
          put(x, y, nd.ctrl === 'signal' ? O.TLIGHT : O.SIGN, od);
        }
      }
    }

    // ===================== Индексы по чанкам =====================
    indexChunks() {
      const NCX = this.NCX, NCY = Math.ceil(this.H / CHUNK);
      const B = (this.chunkB = new Array(NCX * NCY));
      const E = (this.chunkE = new Array(NCX * NCY));
      for (let k = 0; k < B.length; k++) { B[k] = []; E[k] = []; }
      for (const b of this.buildings) {
        const k = Math.floor(b.y / CHUNK) * NCX + Math.floor(b.x / CHUNK);
        if (B[k]) B[k].push(b.id);
      }
      const addBox = (eid, x0, y0, x1, y1) => {
        const cx0 = Math.max(0, Math.floor(x0 / CHUNK)), cx1 = Math.min(NCX - 1, Math.floor(x1 / CHUNK));
        const cy0 = Math.max(0, Math.floor(y0 / CHUNK)), cy1 = Math.min(NCY - 1, Math.floor(y1 / CHUNK));
        for (let cy = cy0; cy <= cy1; cy++)
          for (let cx = cx0; cx <= cx1; cx++) {
            const l = E[cy * NCX + cx];
            if (l[l.length - 1] !== eid) l.push(eid);
          }
      };
      for (const e of this.net.edges) {
        if (e.pts) {
          for (let k = 0; k < e.pts.length - 1; k++) {
            const a = e.pts[k], b = e.pts[k + 1];
            addBox(e.id, Math.min(a.x, b.x) - 10, Math.min(a.y, b.y) - 10, Math.max(a.x, b.x) + 10, Math.max(a.y, b.y) + 10);
          }
        } else addBox(e.id, Math.min(e.x0, e.x1) - e.w, Math.min(e.y0, e.y1) - e.w, Math.max(e.x0, e.x1) + e.w, Math.max(e.y0, e.y1) + e.w);
      }
    }
    chunkBuildings(cx, cy) {
      return (this.chunkB && this.chunkB[cy * this.NCX + cx]) || [];
    }
    chunkEdges(cx, cy) {
      return (this.chunkE && this.chunkE[cy * this.NCX + cx]) || [];
    }

    // ===================== API дорожного движения =====================
    // Смещение центра полосы k (0 — внутренняя) от оси дороги, вправо по ходу движения (для левостороннего — влево)
    laneOffset(e, k) {
      const o = e.cls === 'hw' ? 0.5 + (k + 0.5) * 3.25 : (k + 0.5) * (e.cls === 'st' && e.w >= 8 ? 3 : e.w / (2 * e.lanes));
      return e.drive === 'R' ? o : -o;
    }
    // Точка на оси ребра при параметре t ∈ [0,1] (по длине) и касательная
    edgePoint(e, t) {
      if (!e.pts) {
        const A = this.net.nodes[e.a], B = this.net.nodes[e.b];
        const L = Math.hypot(B.x - A.x, B.y - A.y) || 1;
        return { x: A.x + (B.x - A.x) * t, y: A.y + (B.y - A.y) * t, dx: (B.x - A.x) / L, dy: (B.y - A.y) / L };
      }
      const s = J.clamp(t, 0, 1) * e.len, cum = e.cum, P = e.pts;
      let lo = 0, hi = cum.length - 1;
      while (hi - lo > 1) {
        const m = (lo + hi) >> 1;
        if (cum[m] <= s) lo = m;
        else hi = m;
      }
      const a = P[lo], b = P[hi];
      const L = cum[hi] - cum[lo] || 1;
      const f = (s - cum[lo]) / L;
      return { x: a.x + (b.x - a.x) * f, y: a.y + (b.y - a.y) * f, dx: (b.x - a.x) / L, dy: (b.y - a.y) / L };
    }
    // Центр полосы k для движения по ребру в направлении dir (+1: от a к b, -1: от b к a) при параметре t (0..1 от a к b).
    // Возвращает {x, y, ang} — ang как у сущностей: atan2(dy, dx) направления движения.
    laneCenter(e, dir, k, t) {
      const p = this.edgePoint(e, t);
      const fx = p.dx * dir, fy = p.dy * dir;
      const off = this.laneOffset(e, k);
      // правая нормаль в координатах карты (y вниз): (-fy, fx)
      return { x: p.x - fy * off, y: p.y + fx * off, ang: Math.atan2(fy, fx) };
    }
    // Диапазон t, где у городского ребра есть полосы (между коробками перекрёстков); для шоссе — от края до края
    laneSpan(e) {
      if (e.pts) {
        const nA = e.a >= 0 ? this.net.nodes[e.a] : null, nB = e.b >= 0 ? this.net.nodes[e.b] : null;
        const ha = nA ? Math.max(nA.aw[0], nA.aw[1]) / 2 : 0, hb = nB ? Math.max(nB.aw[0], nB.aw[1]) / 2 : 0;
        return { t0: ha / e.len, t1: 1 - hb / e.len };
      }
      const A = this.net.nodes[e.a], B = this.net.nodes[e.b];
      const ha = (e.horiz ? A.aw[0] : A.aw[1]) / 2, hb = (e.horiz ? B.aw[0] : B.aw[1]) / 2;
      return { t0: ha / e.len, t1: 1 - hb / e.len };
    }
    // Состояние светофора: цикл 40 с. ns — для движения по оси север-юг, ew — восток-запад.
    // Пешеходы переходят дорогу N-S, пока у EW зелёный (и наоборот).
    signalState(node, tSec) {
      if (!node || node.ctrl !== 'signal') return { ns: 'G', ew: 'G' };
      const c = (((tSec + node.phase) % 40) + 40) % 40;
      return { ns: c < 17 ? 'G' : c < 20 ? 'Y' : 'R', ew: c >= 20 && c < 37 ? 'G' : c >= 37 ? 'Y' : 'R' };
    }
    // Ось ребра у узла: 'ns' или 'ew'
    edgeAxis(nd, e) {
      const [sx] = this.approachDir(nd, e);
      return sx ? 'ew' : 'ns';
    }
    // Что под точкой: {node} в коробке перекрёстка, ребро на проезжей части, иначе null
    edgeAt(x, y) {
      x |= 0; y |= 0;
      if (!this.inb(x, y)) return null;
      const r = this.rid[y * this.W + x];
      if (!r) return null;
      if (r & 0x8000) return { node: this.net.nodes[r & 0x7fff] };
      return this.net.edges[r - 1] || null;
    }
    // Варианты проезда через узел для въехавшего по ребру inEdge: [{edge, dir, turn, w}], без разворотов
    turnOptions(nodeId, inEdgeId) {
      const nd = this.net.nodes[nodeId], net = this.net;
      const ein = net.edges[inEdgeId];
      const [ix, iy] = this.approachDir(nd, ein); // откуда пришли
      const hx = -ix, hy = -iy; // направление движения
      const out = [];
      for (const eid of nd.edges) {
        if (eid === inEdgeId) continue;
        const e = net.edges[eid];
        const [ox, oy] = this.approachDir(nd, e);
        const dot = ox * hx + oy * hy, cross = hx * oy - hy * ox;
        const turn = dot > 0.5 ? 'straight' : cross > 0 ? 'right' : 'left';
        out.push({ edge: eid, dir: e.a === nodeId ? 1 : -1, turn, w: turn === 'straight' ? 0.6 : turn === 'right' ? 0.25 : 0.15 });
      }
      return out;
    }

    // ===================== Достопримечательности =====================
    // Найти свободный участок суши w×h рядом с (x,y) (не в городе и не на дорогах)
    findLand(x, y, w, h) {
      x = Math.round(x); y = Math.round(y);
      for (let r = 0; r < 40; r++) {
        for (let k = 0; k < 16; k++) {
          const a = (k / 16) * J.TAU;
          const px = Math.round(x + Math.cos(a) * r), py = Math.round(y + Math.sin(a) * r);
          let ok = true;
          for (let yy = py - 1; yy < py + h + 2 && ok; yy++)
            for (let xx = px - 1; xx < px + w + 1; xx++) {
              const t = this.tile(xx, yy);
              if (t === T.DEEP || t === T.WATER || t === T.ROCK || t === T.MESA || t === T.WALL || t === T.ROAD || t === T.BRIDGE || URBAN[t]) { ok = false; break; }
            }
          if (ok) return { x: px, y: py };
        }
      }
      return null;
    }

    // Запасной вариант: участок в основном на суше, без зданий, города и дорог; вода осушается
    findLandLoose(x, y, w, h) {
      x = Math.round(x); y = Math.round(y);
      for (let r = 0; r < 60; r += 2) {
        for (let k = 0; k < 24; k++) {
          const a = (k / 24) * J.TAU;
          const px = Math.round(x + Math.cos(a) * r), py = Math.round(y + Math.sin(a) * r);
          let ok = true, deep = 0;
          for (let yy = py - 1; yy < py + h + 2 && ok; yy++)
            for (let xx = px - 1; xx < px + w + 1; xx++) {
              const t = this.tile(xx, yy);
              if (t === T.WALL || t === T.ROAD || t === T.BRIDGE || URBAN[t] || !this.inb(xx, yy)) { ok = false; break; }
              if (t === T.DEEP) deep++;
            }
          if (ok && deep < w * h * 0.15) return { x: px, y: py };
        }
      }
      return { x, y };
    }

    clearArea(x, y, w, h, t) {
      for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) this.setT(xx, yy, t);
    }

    // Смещение (ox, oy) от центра региона выносится за границу города (большие города съели старые места)
    pushOut(reg, ox, oy, size) {
      if (!reg.city) return [ox, oy];
      const d = Math.hypot(ox, oy) || 1, need = reg.city + 14 + size;
      return d < need ? [(ox * need) / d, (oy * need) / d] : [ox, oy];
    }
    landNear(reg, ox, oy, w, h) {
      const [px, py] = this.pushOut(reg, ox, oy, Math.max(w, h) / 2);
      return this.findLand(reg.x + px, reg.y + py, w, h) || this.findLandLoose(reg.x + px, reg.y + py, w, h);
    }

    walledCompound(type, reg, ox, oy, cw, ch, bw, bh, ground) {
      const p = this.landNear(reg, ox, oy, cw, ch);
      this.clearArea(p.x, p.y, cw, ch, ground || T.DIRT);
      for (let xx = p.x; xx < p.x + cw; xx++) {
        this.setT(xx, p.y, T.WALL);
        this.setT(xx, p.y + ch - 1, T.WALL);
      }
      for (let yy = p.y; yy < p.y + ch; yy++) {
        this.setT(p.x, yy, T.WALL);
        this.setT(p.x + cw - 1, yy, T.WALL);
      }
      // ворота снизу
      const gx = p.x + (cw >> 1);
      for (let k = -1; k <= 1; k++) this.setT(gx + k, p.y + ch - 1, T.PAVE);
      const bx = p.x + ((cw - bw) >> 1), by = p.y + 2;
      const b = this.addBuilding(type, bx, by, bw, bh, reg);
      for (let yy = by + bh; yy < p.y + ch - 1; yy++) this.setT(gx, yy, T.PAVE);
      return b;
    }

    genLandmarks() {
      const RG = J.REGION;
      const P = this.places;
      let b;
      b = this.walledCompound('joestar_mansion', RG.london, 44, 30, 17, 14, 9, 6, T.GRASS);
      if (b) P.joestar_mansion = b.id;
      b = this.addSmall('zeppeli_house', RG.london, -50, -22, 5, 4);
      if (b) P.zeppeli_house = b.id;
      b = this.walledCompound('dio_mansion', RG.cairo, 52, -34, 17, 15, 11, 7, T.DIRT);
      if (b) P.dio_mansion = b.id;
      b = this.walledCompound('green_dolphin', RG.florida, 36, 24, 24, 18, 12, 7, T.DIRT);
      if (b) P.green_dolphin = b.id;
      b = this.addSmall('cape', RG.florida, 46, -26, 5, 5);
      if (b) P.cape = b.id;
      b = this.addSmall('hamon_temple', RG.tibet, 22, -22, 7, 6);
      if (b) P.hamon_temple = b.id;
      // Руины в Мексике
      const pr = this.landNear(RG.mexico, -50, 26, 15, 13);
      if (pr) {
        for (let yy = pr.y; yy < pr.y + 13; yy++)
          for (let xx = pr.x; xx < pr.x + 15; xx++) {
            this.setT(xx, yy, T.RUINS);
            if ((xx - pr.x) % 3 === 0 && (yy - pr.y) % 4 === 0 && J.hash2(xx, yy, this.seed) < 0.7) this.o[yy * this.W + xx] = O.PILLAR;
          }
        b = this.addBuilding('pillar_ruins', pr.x + 4, pr.y + 3, 7, 5, RG.mexico);
        P.pillar_ruins = b.id;
      }
      // Катакомбы под Римом — руины за городом
      const rr = this.landNear(RG.rome, -48, -20, 11, 9);
      if (rr) {
        for (let yy = rr.y; yy < rr.y + 9; yy++)
          for (let xx = rr.x; xx < rr.x + 11; xx++) {
            this.setT(xx, yy, T.RUINS);
            if (((xx - rr.x) % 3 === 0 && (yy - rr.y) % 3 === 0) && J.hash2(xx, yy, this.seed + 1) < 0.6) this.o[yy * this.W + xx] = O.PILLAR;
          }
        P.catacombs = { x: rr.x + 5.5, y: rr.y + 4.5 };
      }
      // Дьявольская ладонь — случайное место в пустыне Аризоны
      for (let k = 0; k < 200; k++) {
        const a = this.R() * J.TAU, r = RG.arizona.city + 10 + this.R() * 80;
        const x = Math.round(RG.arizona.x + Math.cos(a) * r), y = Math.round(RG.arizona.y + Math.sin(a) * r);
        if (!this.solid(x, y) && !this.isWater(x, y) && !this.cityAt(x, y) && this.tile(x, y) !== T.ROAD) {
          for (let yy = -4; yy <= 4; yy++)
            for (let xx = -4; xx <= 4; xx++) {
              if (xx * xx + yy * yy > 16) continue;
              const t = this.tile(x + xx, y + yy);
              if (t === T.ROAD || t === T.BRIDGE || URBAN[t]) continue;
              this.setT(x + xx, y + yy, T.DESERT);
            }
          P.devils_palm = { x: x + 0.5, y: y + 0.5 };
          break;
        }
      }
      // Пещера Альп (Ваму спит)
      const al = this.landNear(RG.alps, 34, -28, 9, 7);
      if (al) {
        for (let yy = al.y; yy < al.y + 7; yy++) for (let xx = al.x; xx < al.x + 9; xx++) this.setT(xx, yy, T.RUINS);
        this.o[(al.y + 1) * this.W + al.x + 1] = O.PILLAR;
        this.o[(al.y + 1) * this.W + al.x + 7] = O.PILLAR;
        P.alps_ruins = { x: al.x + 4.5, y: al.y + 3.5 };
      }
    }

    addSmall(type, reg, ox, oy, w, h) {
      const p = this.landNear(reg, ox, oy, w, h);
      this.clearArea(p.x - 1, p.y - 1, w + 2, h + 3, T.PAVE);
      return this.addBuilding(type, p.x, p.y, w, h, reg);
    }

    genIsland() {
      const r = J.REGION.airsupplena;
      const cx = r.x, cy = r.y;
      for (let y = cy - 14; y <= cy + 14; y++)
        for (let x = cx - 14; x <= cx + 14; x++) {
          const d = J.dist(x, y, cx, cy) + (J.noise2(x / 4, y / 4, this.seed) - 0.5) * 3;
          if (d < 9) this.setT(x, y, T.GRASS, false);
          else if (d < r.land) this.setT(x, y, T.SAND, false);
        }
      for (let y = cy - 9; y <= cy + 9; y++)
        for (let x = cx - 9; x <= cx + 9; x++) {
          const i = y * this.W + x;
          if (this.t[i] === T.GRASS) this.o[i] = J.hash2(x, y, 9) < 0.08 ? O.OLIVE : J.hash2(x, y, 10) < 0.08 ? O.FLOWERS : 0;
        }
      this.clearArea(cx - 5, cy - 6, 10, 9, T.PLAZA);
      const b = this.addBuilding('lisa_castle', cx - 3, cy - 6, 7, 6, r);
      this.places.lisa_castle = b.id;
      // пристань
      this.clearArea(cx - 1, cy + 3, 3, 9, T.DOCKWOOD);
      const st = this.addBuilding('station', cx + 3, cy + 2, 3, 3, r);
      st.name = 'Пристань';
      r.buildings = [b.id, st.id];
      r.city = 0;
    }

    buildingAt(x, y) {
      const i = this.bid[(y | 0) * this.W + (x | 0)];
      return i ? this.buildings[i - 1] : null;
    }
    // Ближайшая дверь в радиусе r (двери смотрят в любую сторону)
    doorNear(x, y, r = 1.8) {
      let best = null, bd = r;
      const x0 = Math.floor(x - 3), y0 = Math.floor(y - 3);
      for (let yy = y0; yy <= y0 + 6; yy++)
        for (let xx = x0; xx <= x0 + 6; xx++) {
          if (!this.inb(xx, yy)) continue;
          const b = this.buildingAt(xx, yy);
          if (!b || b.type === 'house' || b === best) continue;
          const p = J.doorPt(b, 0.8);
          const d = J.dist(x, y, p.x, p.y);
          if (d < bd) {
            bd = d;
            best = b;
          }
        }
      return best;
    }
    buildingsOf(regId, type) {
      return this.buildings.filter((b) => b.region === regId && (!type || b.type === type));
    }
    findBuilding(type, regId) {
      return this.buildings.find((b) => b.type === type && (!regId || b.region === regId));
    }
    // Случайная проходимая точка в радиусе. opts.street — только тротуары/площади/зебры; opts.outside — вне городов
    randomWalkable(cx, cy, r, rand = J.R, opts) {
      for (let k = 0; k < 120; k++) {
        const a = rand() * J.TAU, d = Math.sqrt(rand()) * r;
        const x = cx + Math.cos(a) * d, y = cy + Math.sin(a) * d;
        if (this.solid(x, y) || this.isWater(x, y)) continue;
        if (opts && opts.outside && this.cityAt(x, y)) continue;
        if (opts && opts.street && !this.isPedTile(x, y)) continue;
        return { x: Math.floor(x) + 0.5, y: Math.floor(y) + 0.5 };
      }
      return null;
    }
    // Случайная точка за городом: кольцо [city+10, city+extra] вокруг региона (для деревень — от центра)
    randOutside(reg, extra = 60, rand = J.R) {
      const r0 = reg.city ? reg.city + 10 : 0, r1 = reg.city ? reg.city + extra : extra;
      for (let k = 0; k < 160; k++) {
        const a = rand() * J.TAU, d = r0 + Math.sqrt(rand()) * (r1 - r0);
        const x = reg.x + Math.cos(a) * d, y = reg.y + Math.sin(a) * d;
        if (!this.inb(x | 0, y | 0) || this.solid(x, y) || this.isWater(x, y) || this.cityAt(x, y)) continue;
        return { x: Math.floor(x) + 0.5, y: Math.floor(y) + 0.5 };
      }
      return null;
    }

    // Картинка миникарты: 1 пиксель = 1 клетка
    makeMapImage() {
      const c = document.createElement('canvas');
      c.width = this.W;
      c.height = this.H;
      const ctx = c.getContext('2d');
      const img = ctx.createImageData(this.W, this.H);
      const cache = {};
      const rgb = (hex) => cache[hex] || (cache[hex] = J.hexToRgb(hex));
      const ocol = { [O.TREE]: '#3f7a32', [O.PINE]: '#2f5f3a', [O.JUNGLE]: '#2f6a2a', [O.PALM]: '#5aa040', [O.OLIVE]: '#7a9a4a', [O.CACTUS]: '#4a8a3a', [O.ACACIA]: '#7a8a3a', [O.STREETTREE]: '#4f8a3a' };
      const edges = this.net.edges;
      for (let i = 0; i < this.W * this.H; i++) {
        const t = this.t[i];
        let col = J.TCOL[t];
        if (t === T.BUILDING) {
          const b = this.buildings[this.bid[i] - 1];
          col = b ? (b.type === 'house' ? b.roof : b.sign || b.roof) : '#888';
        } else if ((t === T.ROAD || t === T.BRIDGE) && this.rid[i]) {
          const r = this.rid[i];
          if (r & 0x8000) col = '#5c5c66';
          else {
            const e = edges[r - 1];
            col = e && e.cls === 'hw' ? '#d9b04a' : e && e.cls === 'ave' ? '#62626c' : '#52525a';
          }
        } else if (ocol[this.o[i]]) col = ocol[this.o[i]];
        const [r, g, bb] = rgb(col);
        const shade = t === T.ROCK || t === T.MESA ? 0.75 + this.rock[i] * 0.4 : 1;
        img.data[i * 4] = r * shade;
        img.data[i * 4 + 1] = g * shade;
        img.data[i * 4 + 2] = bb * shade;
        img.data[i * 4 + 3] = 255;
      }
      ctx.putImageData(img, 0, 0);
      return c;
    }
  }
  J.World = World;
})();
