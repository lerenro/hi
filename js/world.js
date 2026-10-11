'use strict';
// Генерация огромного мира: земля, биомы, города, дороги, достопримечательности.
(function () {
  // Тип земли
  const T = (J.T = {
    DEEP: 0, WATER: 1, SAND: 2, GRASS: 3, FOREST: 4, DIRT: 5, ROAD: 6, PAVE: 7, DESERT: 8, SNOW: 9,
    ROCK: 10, BUILDING: 11, BRIDGE: 12, WALL: 13, FIELD: 14, SWAMP: 15, DRYGRASS: 16, MESA: 17,
    RUINS: 18, PLAZA: 19, ICE: 20, MOOR: 21, DOCKWOOD: 22,
  });
  // Объекты на клетке
  const O = (J.O = {
    NONE: 0, TREE: 1, PINE: 2, PALM: 3, CACTUS: 4, BOULDER: 5, BUSH: 6, FLOWERS: 7, TALLGRASS: 8,
    PILLAR: 9, JUNGLE: 10, LAMP: 11, OLIVE: 12, DEADTREE: 13, FOUNTAIN: 14, ACACIA: 15,
  });

  const SOLID_T = new Uint8Array(32);
  [T.DEEP, T.ROCK, T.BUILDING, T.WALL, T.MESA].forEach((t) => (SOLID_T[t] = 1));
  const SOLID_O = new Uint8Array(32);
  [O.TREE, O.PINE, O.PALM, O.CACTUS, O.BOULDER, O.PILLAR, O.JUNGLE, O.OLIVE, O.DEADTREE, O.FOUNTAIN, O.ACACIA].forEach((o) => (SOLID_O[o] = 1));
  const SPEED_T = new Float32Array(32).fill(1);
  SPEED_T[T.WATER] = 0.5; SPEED_T[T.SWAMP] = 0.65; SPEED_T[T.SAND] = 0.9; SPEED_T[T.DESERT] = 0.85;
  SPEED_T[T.SNOW] = 0.8; SPEED_T[T.ROAD] = 1.15; SPEED_T[T.PAVE] = 1.1; SPEED_T[T.PLAZA] = 1.1; SPEED_T[T.BRIDGE] = 1.1; SPEED_T[T.ICE] = 1.2;

  // Цвета земли (для миникарты и 3D)
  J.TCOL = {
    [T.DEEP]: '#1d4f8a', [T.WATER]: '#2f7fc4', [T.SAND]: '#e8d49a', [T.GRASS]: '#6cb24a', [T.FOREST]: '#4a8a3a',
    [T.DIRT]: '#9a7a52', [T.ROAD]: '#4a4a52', [T.PAVE]: '#a8a49a', [T.DESERT]: '#e3c27a', [T.SNOW]: '#eef3f8',
    [T.ROCK]: '#7a7480', [T.BUILDING]: '#999', [T.BRIDGE]: '#8a6a4a', [T.WALL]: '#6a6470', [T.FIELD]: '#b8c25a',
    [T.SWAMP]: '#4f6a3a', [T.DRYGRASS]: '#b8b05a', [T.MESA]: '#b8603a', [T.RUINS]: '#c9b48a', [T.PLAZA]: '#d8ccb0',
    [T.ICE]: '#bfe3f2', [T.MOOR]: '#5a7a4a', [T.DOCKWOOD]: '#7a5a3a',
  };

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
    // Высота клетки для 3D
    tileH(x, y) {
      if (!this.inb(x, y)) return -1.4;
      const i = y * this.W + x;
      const t = this.t[i];
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
        case T.ROAD: case T.PAVE: case T.PLAZA: case T.BUILDING: case T.WALL: return 0.05;
        default: return 0.06 + this.rock[i] * 0.35;
      }
    }
    vertH(vx, vy) {
      return (this.tileH(vx - 1, vy - 1) + this.tileH(vx, vy - 1) + this.tileH(vx - 1, vy) + this.tileH(vx, vy)) * 0.25;
    }
    groundY(x, y) {
      const t = this.tile(x, y);
      if (t === T.BRIDGE || t === T.DOCKWOOD) return 0.32;
      const vx = Math.floor(x), vy = Math.floor(y);
      const fx = x - vx, fy = y - vy;
      const a = this.vertH(vx, vy), b = this.vertH(vx + 1, vy), c = this.vertH(vx, vy + 1), d = this.vertH(vx + 1, vy + 1);
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

      for (let y = 0; y < H; y++) {
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
          // открытый океан — без лишних вычислений
          const dix = x - island.x, diy = y - island.y;
          const di = Math.sqrt(dix * dix + diy * diy);
          if (land < -0.55 && di > island.land + 20) {
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
      this.genCities();
      this.genLandmarks();
      this.genRoads();
      this.genIsland();
      this.decorateCities();
      this.ensureConnectivity();
    }

    // Гарантирует, что до каждого важного здания можно дойти пешком (кроме острова)
    ensureConnectivity() {
      const W = this.W, H = this.H;
      const start = this.buildings.find((b) => b.region === 'morioh' && b.type === 'station');
      if (!start) return;
      const seen = new Uint8Array(W * H);
      const q = new Int32Array(W * H);
      const DX = [1, -1, 0, 0], DY = [0, 0, 1, -1];
      const flood = (i0) => {
        let qh = 0, qt = 0;
        q[qt++] = i0;
        seen[i0] = 1;
        while (qh < qt) {
          const i = q[qh++];
          const x = i % W, y = (i / W) | 0;
          for (let k = 0; k < 4; k++) {
            const nx = x + DX[k], ny = y + DY[k];
            if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
            const j = ny * W + nx;
            if (seen[j] || this.solid(nx + 0.5, ny + 0.5)) continue;
            seen[j] = 1;
            q[qt++] = j;
          }
        }
      };
      flood((start.door.y + 1) * W + start.door.x);
      const prev = new Int32Array(W * H);
      for (const b of this.buildings) {
        if (b.type === 'house' || b.region === 'airsupplena') continue;
        const s0 = (b.door.y + 1) * W + b.door.x;
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
            const nx = x + DX[k], ny = y + DY[k];
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

    addBuilding(type, x, y, w, h, reg, styleKey) {
      const bt = J.BTYPES[type];
      const st = J.STYLES[styleKey || reg.style || 'usa'] || J.STYLES.usa;
      const R = this.R;
      const floors = bt.floors * (bt.special ? 1 : st.tall) * (type === 'house' ? R.range(0.8, 1.6) : 1);
      const b = {
        id: this.buildings.length,
        type, x, y, w, h,
        door: { x: x + (w >> 1), y: y + h - 1 },
        region: reg.id,
        name: bt.name,
        wall: R.pick(st.walls),
        roof: R.pick(st.roofs),
        flat: !!st.flat && type !== 'church',
        height: Math.max(2.4, floors * 2.6),
        sign: bt.color || null,
      };
      if (type === 'trussardi') b.wall = '#f2e0c0';
      if (type === 'dio_mansion') { b.wall = '#5a4a6a'; b.roof = '#2a2238'; b.flat = false; }
      if (type === 'joestar_mansion') { b.wall = '#e8dcc8'; b.roof = '#3a4a6a'; b.flat = false; }
      if (type === 'green_dolphin') { b.wall = '#a8b0b8'; b.roof = '#6a7480'; b.flat = true; }
      if (type === 'colosseum') { b.wall = '#d9c49a'; b.roof = '#c9b48a'; b.flat = true; }
      if (type === 'cape') { b.wall = '#f4f4f4'; b.roof = '#d8442b'; }
      if (type === 'lisa_castle' || type === 'hamon_temple') { b.wall = '#f0e8d8'; b.roof = '#c4283c'; b.flat = false; }
      if (type === 'pillar_ruins') { b.wall = '#c9b48a'; b.roof = '#a8946a'; b.flat = true; }
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

    genCities() {
      const B = 11;
      for (const reg of J.REGIONS) {
        if (!reg.city) continue;
        const R = reg.city;
        const x0 = reg.x - R - 1, y0 = reg.y - R - 1;
        // Сетка улиц
        for (let y = y0 - 1; y <= reg.y + R + 2; y++)
          for (let x = x0 - 1; x <= reg.x + R + 2; x++) {
            if (!this.inb(x, y)) continue;
            if (J.dist(x, y, reg.x, reg.y) > R + 1.5) continue;
            const lx = (((x - x0) % B) + B) % B, ly = (((y - y0) % B) + B) % B;
            const cur = this.tile(x, y);
            const water = cur === T.WATER || cur === T.DEEP;
            if (lx < 2 || ly < 2) this.setT(x, y, water ? T.BRIDGE : T.ROAD);
            else if (!water) this.setT(x, y, T.PAVE);
            else this.o[y * this.W + x] = 0;
          }
        // Кварталы
        const blocks = [];
        const nb = Math.ceil((2 * R + 2) / B) + 1;
        for (let gy = 0; gy < nb; gy++)
          for (let gx = 0; gx < nb; gx++) {
            const ix = x0 + gx * B + 3, iy = y0 + gy * B + 3;
            const cx = ix + 3.5, cy = iy + 3.5;
            if (J.dist(cx, cy, reg.x, reg.y) > R - 3) continue;
            let ok = true;
            for (let yy = iy - 1; yy < iy + 8 && ok; yy++)
              for (let xx = ix - 1; xx < ix + 8; xx++) {
                const t = this.tile(xx, yy);
                if (t !== T.PAVE) { ok = false; break; }
              }
            if (ok) blocks.push({ ix, iy, d: J.dist(cx, cy, reg.x, reg.y) });
          }
        blocks.sort((a, b) => a.d - b.d);
        const list = (J.CITY_BUILDINGS[reg.id] || []).slice();
        const placed = [];
        // центральная площадь
        if (blocks.length > 6) {
          const c = blocks.shift();
          for (let yy = c.iy; yy < c.iy + 7; yy++) for (let xx = c.ix; xx < c.ix + 7; xx++) this.setT(xx, yy, T.PLAZA);
          this.o[(c.iy + 3) * this.W + c.ix + 3] = O.FOUNTAIN;
          this.places[reg.id + '_plaza'] = { x: c.ix + 3.5, y: c.iy + 5.5 };
        }
        for (const blk of blocks) {
          const R2 = this.R;
          if (list.length) {
            const type = list.shift();
            const big = J.BTYPES[type].special || ['hospital', 'station', 'hotel', 'school', 'speedwagon', 'office', 'church'].includes(type);
            if (big) placed.push(this.addBuilding(type, blk.ix, blk.iy, 7, 6, reg));
            else {
              placed.push(this.addBuilding(type, blk.ix, blk.iy, 3, 5, reg));
              if (list.length && !J.BTYPES[list[0]].special) placed.push(this.addBuilding(list.shift(), blk.ix + 4, blk.iy, 3, 5, reg));
              else this.addBuilding('house', blk.ix + 4, blk.iy, 3, 5, reg);
            }
            continue;
          }
          const roll = R2();
          if (roll < 0.12) {
            // парк
            for (let yy = blk.iy; yy < blk.iy + 7; yy++)
              for (let xx = blk.ix; xx < blk.ix + 7; xx++) {
                this.setT(xx, yy, T.GRASS);
                const hh = J.hash2(xx, yy, this.seed + 5);
                if (hh < 0.18) this.o[yy * this.W + xx] = reg.biome === 'tropical' ? O.PALM : reg.biome === 'desert' ? O.PALM : O.TREE;
                else if (hh < 0.3) this.o[yy * this.W + xx] = O.FLOWERS;
              }
          } else if (roll < 0.5) {
            this.addBuilding('house', blk.ix, blk.iy, 7, 6, reg);
          } else if (roll < 0.8) {
            this.addBuilding('house', blk.ix, blk.iy, 3, 5, reg);
            this.addBuilding('house', blk.ix + 4, blk.iy, 3, 5, reg);
          } else {
            this.addBuilding('house', blk.ix, blk.iy, 3, 3, reg);
            this.addBuilding('house', blk.ix + 4, blk.iy, 3, 3, reg);
            this.addBuilding('house', blk.ix, blk.iy + 4, 3, 3, reg);
            this.addBuilding('house', blk.ix + 4, blk.iy + 4, 3, 3, reg);
          }
        }
        // если не хватило места — оставшиеся здания на окраине
        let ang = 0;
        while (list.length) {
          const type = list.shift();
          const p = this.findLand(reg.x + Math.cos(ang) * (R + 8), reg.y + Math.sin(ang) * (R + 8), 7, 6);
          ang += 1.3;
          if (p) placed.push(this.addBuilding(type, p.x, p.y, 7, 6, reg));
        }
        reg.buildings = placed.map((b) => b.id);
      }
    }

    // Найти свободный участок суши w×h рядом с (x,y)
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
              if (t === T.DEEP || t === T.WATER || t === T.BUILDING || t === T.ROCK || t === T.MESA || t === T.WALL || t === T.ROAD || t === T.BRIDGE) { ok = false; break; }
            }
          if (ok) return { x: px, y: py };
        }
      }
      return null;
    }

    // Запасной вариант: участок в основном на суше, без зданий и дорог; вода осушается
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
              if (t === T.BUILDING || t === T.WALL || t === T.ROAD || t === T.BRIDGE || !this.inb(xx, yy)) { ok = false; break; }
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

    walledCompound(type, reg, ox, oy, cw, ch, bw, bh, ground) {
      const p = this.findLand(reg.x + ox, reg.y + oy, cw, ch) || this.findLandLoose(reg.x + ox, reg.y + oy, cw, ch);
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
      const pr = this.findLand(RG.mexico.x - 50, RG.mexico.y + 26, 15, 13) || this.findLandLoose(RG.mexico.x - 50, RG.mexico.y + 26, 15, 13);
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
      const rr = this.findLand(RG.rome.x - 48, RG.rome.y - 20, 11, 9) || this.findLandLoose(RG.rome.x - 48, RG.rome.y - 20, 11, 9);
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
        const a = this.R() * J.TAU, r = 30 + this.R() * 90;
        const x = Math.round(RG.arizona.x + Math.cos(a) * r), y = Math.round(RG.arizona.y + Math.sin(a) * r);
        if (!this.solid(x, y) && !this.isWater(x, y) && !this.cityAt(x, y)) {
          for (let yy = -4; yy <= 4; yy++)
            for (let xx = -4; xx <= 4; xx++)
              if (xx * xx + yy * yy <= 16) this.setT(x + xx, y + yy, T.DESERT);
          P.devils_palm = { x: x + 0.5, y: y + 0.5 };
          break;
        }
      }
      // Пещера Альп (Ваму спит)
      const al = this.findLand(RG.alps.x + 34, RG.alps.y - 28, 9, 7) || this.findLandLoose(RG.alps.x + 34, RG.alps.y - 28, 9, 7);
      if (al) {
        for (let yy = al.y; yy < al.y + 7; yy++) for (let xx = al.x; xx < al.x + 9; xx++) this.setT(xx, yy, T.RUINS);
        this.o[(al.y + 1) * this.W + al.x + 1] = O.PILLAR;
        this.o[(al.y + 1) * this.W + al.x + 7] = O.PILLAR;
        P.alps_ruins = { x: al.x + 4.5, y: al.y + 3.5 };
      }
    }

    addSmall(type, reg, ox, oy, w, h) {
      const p = this.findLand(reg.x + ox, reg.y + oy, w, h) || this.findLandLoose(reg.x + ox, reg.y + oy, w, h);
      this.clearArea(p.x - 1, p.y - 1, w + 2, h + 3, T.PAVE);
      return this.addBuilding(type, p.x, p.y, w, h, reg);
    }

    genIsland() {
      const r = J.REGION.airsupplena;
      const cx = r.x, cy = r.y;
      for (let y = cy - 14; y <= cy + 14; y++)
        for (let x = cx - 14; x <= cx + 14; x++) {
          const d = J.dist(x, y, cx, cy) + (J.noise2(x / 4, y / 4, this.seed) - 0.5) * 3;
          if (d < 9) this.setT(x, y, J.hash2(x, y, 3) < 0.06 ? T.GRASS : T.GRASS, false);
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

    genRoads() {
      const pt = (p) => (typeof p === 'string' ? [J.REGION[p].x, J.REGION[p].y] : p);
      let seg = 0;
      for (const road of J.ROADS) {
        const pts = road.map(pt);
        for (let k = 0; k < pts.length - 1; k++) {
          const [ax, ay] = pts[k], [bx, by] = pts[k + 1];
          const L = Math.hypot(bx - ax, by - ay);
          const nx = -(by - ay) / L, ny = (bx - ax) / L;
          seg++;
          for (let d = 0; d <= L; d += 0.5) {
            const tt = d / L;
            const off = (J.fbm(d / 40, seg * 7.3, this.seed + 404, 3) - 0.5) * 30 * Math.sin(Math.PI * tt);
            const x = Math.round(ax + (bx - ax) * tt + nx * off), y = Math.round(ay + (by - ay) * tt + ny * off);
            for (let oy = 0; oy < 2; oy++)
              for (let ox = 0; ox < 2; ox++) {
                const X = x + ox, Y = y + oy;
                if (!this.inb(X, Y)) continue;
                const t = this.tile(X, Y);
                if (t === T.BUILDING || t === T.WALL || t === T.PLAZA) continue;
                if (t === T.DEEP || t === T.WATER) this.setT(X, Y, T.BRIDGE);
                else if (t === T.ROAD || t === T.PAVE || t === T.BRIDGE) continue;
                else this.setT(X, Y, T.ROAD);
              }
          }
        }
      }
    }

    decorateCities() {
      // фонари вдоль тротуаров
      for (const reg of J.REGIONS) {
        if (!reg.city) continue;
        const R = reg.city;
        for (let y = reg.y - R; y <= reg.y + R; y++)
          for (let x = reg.x - R; x <= reg.x + R; x++) {
            if (this.tile(x, y) !== T.PAVE) continue;
            const i = y * this.W + x;
            if (this.o[i]) continue;
            const nearRoad = this.tile(x - 1, y) === T.ROAD || this.tile(x, y - 1) === T.ROAD;
            if (nearRoad && (x * 7 + y * 13) % 9 === 0 && this.tile(x, y + 1) !== T.BUILDING) this.o[i] = O.LAMP;
          }
      }
    }

    buildingAt(x, y) {
      const i = this.bid[(y | 0) * this.W + (x | 0)];
      return i ? this.buildings[i - 1] : null;
    }
    // Ближайшая дверь в радиусе r
    doorNear(x, y, r = 1.8) {
      let best = null, bd = r;
      const x0 = Math.floor(x - 2), y0 = Math.floor(y - 3);
      for (let yy = y0; yy <= y0 + 4; yy++)
        for (let xx = x0; xx <= x0 + 4; xx++) {
          const b = this.buildingAt(xx, yy);
          if (!b || b.type === 'house') continue;
          const d = J.dist(x, y, b.door.x + 0.5, b.door.y + 1.3);
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
    // Случайная проходимая точка в радиусе
    randomWalkable(cx, cy, r, rand = J.R, opts) {
      for (let k = 0; k < 120; k++) {
        const a = rand() * J.TAU, d = Math.sqrt(rand()) * r;
        const x = cx + Math.cos(a) * d, y = cy + Math.sin(a) * d;
        if (this.solid(x, y) || this.isWater(x, y)) continue;
        if (opts && opts.outside && this.cityAt(x, y)) continue;
        if (opts && opts.street) {
          const t = this.tile(x, y);
          if (t !== T.PAVE && t !== T.ROAD && t !== T.PLAZA) continue;
        }
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
      const ocol = { [O.TREE]: '#3f7a32', [O.PINE]: '#2f5f3a', [O.JUNGLE]: '#2f6a2a', [O.PALM]: '#5aa040', [O.OLIVE]: '#7a9a4a', [O.CACTUS]: '#4a8a3a', [O.ACACIA]: '#7a8a3a' };
      for (let i = 0; i < this.W * this.H; i++) {
        const t = this.t[i];
        let col = J.TCOL[t];
        if (t === T.BUILDING) {
          const b = this.buildings[this.bid[i] - 1];
          col = b ? (b.type === 'house' ? b.roof : b.sign || b.roof) : '#888';
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
