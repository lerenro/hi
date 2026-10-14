'use strict';
// Рендер городов: асфальт и плитка с текстурами, бордюры, векторная разметка, шоссе с мостами,
// уличная мебель (одна геометрия на чанк), здания-архетипы с фасадами из атласа (один материал на чанк).
// Всё строится внутри генератора чанка R3.buildChunkGen (render3d.js) с частыми yield — без фризов.
(function () {
  const R3 = J.R3;
  const CH = 32;
  const T = J.T, O = J.O;
  const DX = J.DIRV.DX, DY = J.DIRV.DY;
  const RH = J.ROAD_H, CB = J.CURB_H;
  const URBAN = J.URBAN;
  const col = (h) => new THREE.Color(h);
  const tmpC = new THREE.Color();

  // ---------- Сборщик геометрии с UV (и ячейкой атласа для фасадов) ----------
  class GBU {
    constructor(cells, cap = 256) {
      this.cap = cap;
      this.p = new Float32Array(cap * 3);
      this.n = new Float32Array(cap * 3);
      this.c = new Float32Array(cap * 3);
      this.u = new Float32Array(cap * 2);
      this.a = cells ? new Float32Array(cap * 2) : null;
      this.v = 0;
      this.cell = 0;
    }
    grow(k) {
      if (this.v + k <= this.cap) return;
      let cap = this.cap * 2;
      while (cap < this.v + k) cap *= 2;
      const g = (a, n) => {
        const b = new Float32Array(n);
        b.set(a);
        return b;
      };
      this.p = g(this.p, cap * 3);
      this.n = g(this.n, cap * 3);
      this.c = g(this.c, cap * 3);
      this.u = g(this.u, cap * 2);
      if (this.a) this.a = g(this.a, cap * 2);
      this.cap = cap;
    }
    vert(p, nx, ny, nz, cl, uv) {
      const v = this.v, o = v * 3, o2 = v * 2;
      this.p[o] = p[0]; this.p[o + 1] = p[1]; this.p[o + 2] = p[2];
      this.n[o] = nx; this.n[o + 1] = ny; this.n[o + 2] = nz;
      this.c[o] = cl.r; this.c[o + 1] = cl.g; this.c[o + 2] = cl.b;
      this.u[o2] = uv[0]; this.u[o2 + 1] = uv[1];
      if (this.a) {
        this.a[o2] = CELLS[this.cell * 2];
        this.a[o2 + 1] = CELLS[this.cell * 2 + 1];
      }
      this.v = v + 1;
    }
    quad(a, b, c, d, cl, ua, ub, uc, ud) {
      const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2], vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
      let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
      const l = Math.hypot(nx, ny, nz) || 1;
      nx /= l; ny /= l; nz /= l;
      this.grow(6);
      this.vert(a, nx, ny, nz, cl, ua); this.vert(b, nx, ny, nz, cl, ub); this.vert(c, nx, ny, nz, cl, uc);
      this.vert(a, nx, ny, nz, cl, ua); this.vert(c, nx, ny, nz, cl, uc); this.vert(d, nx, ny, nz, cl, ud);
    }
    tri(a, b, c, cl, ua, ub, uc) {
      const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2], vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
      let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
      const l = Math.hypot(nx, ny, nz) || 1;
      nx /= l; ny /= l; nz /= l;
      this.grow(3);
      this.vert(a, nx, ny, nz, cl, ua); this.vert(b, nx, ny, nz, cl, ub); this.vert(c, nx, ny, nz, cl, uc);
    }
    // горизонтальная грань вверх, UV в мировых координатах / s
    top(x0, z0, x1, z1, y, cl, s = 1) {
      this.quad([x0, y, z1], [x1, y, z1], [x1, y, z0], [x0, y, z0], cl, [x0 / s, z1 / s], [x1 / s, z1 / s], [x1 / s, z0 / s], [x0 / s, z0 / s]);
    }
    // вертикальная стена от (x0,z0) к (x1,z1) — наружу смотрит правая сторона (нормаль (-dz, dx));
    // u — длина / bu, v — (высота - vb) / bv
    wall(x0, z0, x1, z1, y0, y1, cl, bu = 1, bv = 1, vb = 0) {
      const L = Math.hypot(x1 - x0, z1 - z0);
      const v0 = (y0 - vb) / bv, v1 = (y1 - vb) / bv;
      this.quad([x0, y0, z0], [x1, y0, z1], [x1, y1, z1], [x0, y1, z0], cl, [0, v0], [L / bu, v0], [L / bu, v1], [0, v1]);
    }
    // коробка: 4 стены (+ верх)
    box(x0, y0, z0, x1, y1, z1, cl, bu = 1, bv = 1, top = true, vb = 0) {
      this.wall(x0, z1, x1, z1, y0, y1, cl, bu, bv, vb);
      this.wall(x1, z1, x1, z0, y0, y1, cl, bu, bv, vb);
      this.wall(x1, z0, x0, z0, y0, y1, cl, bu, bv, vb);
      this.wall(x0, z0, x0, z1, y0, y1, cl, bu, bv, vb);
      if (top) this.top(x0, z0, x1, z1, y1, cl, 4);
    }
    build() {
      const g = new THREE.BufferGeometry(), n = this.v;
      g.setAttribute('position', new THREE.BufferAttribute(this.p.slice(0, n * 3), 3));
      g.setAttribute('normal', new THREE.BufferAttribute(this.n.slice(0, n * 3), 3));
      g.setAttribute('color', new THREE.BufferAttribute(this.c.slice(0, n * 3), 3));
      g.setAttribute('uv', new THREE.BufferAttribute(this.u.slice(0, n * 2), 2));
      if (this.a) g.setAttribute('aCell', new THREE.BufferAttribute(this.a.slice(0, n * 2), 2));
      J.fastBounds(g, this.p, n * 3);
      return g;
    }
    get empty() {
      return this.v === 0;
    }
  }
  R3.GBU = GBU;

  // ---------- Атлас фасадов: 8×8 ячеек по 128 px; ячейка = один пролёт × один этаж ----------
  const AN = 8, AS = 128, ASZ = AN * AS;
  const CELLS = new Float32Array(AN * AN * 2);
  for (let k = 0; k < AN * AN; k++) {
    CELLS[k * 2] = (k % AN) / AN;
    CELLS[k * 2 + 1] = 1 - (((k / AN) | 0) + 1) / AN;
  }
  const FC = { glass1: 0, glass2: 1, office: 2, officeP: 3, apt: 4, aptBal: 5, brick: 6, siding: 7, jhouse: 8, shutter: 9, plaster: 10, shop: 11, lobby: 12, corr: 13, garage: 14, stone: 15, blank: 16, roof: 17, tiles: 18, arch: 19, panel: 20, wood: 21 };
  R3.FC = FC;

  function makeAtlas() {
    const cv = (w, h) => {
      const c = document.createElement('canvas');
      c.width = w;
      c.height = h;
      return c;
    };
    const cc = cv(ASZ, ASZ), mc = cv(ASZ, ASZ), ec = cv(ASZ / 2, ASZ / 2);
    const g = cc.getContext('2d'), m = mc.getContext('2d'), e = ec.getContext('2d');
    // основа: лёгкий шум стены
    const img = g.createImageData(ASZ, ASZ);
    for (let i = 0; i < ASZ * ASZ; i++) {
      const v = 236 + (J.hash2(i % ASZ, (i / ASZ) | 0, 5) - 0.5) * 22;
      img.data[i * 4] = img.data[i * 4 + 1] = img.data[i * 4 + 2] = v;
      img.data[i * 4 + 3] = 255;
    }
    g.putImageData(img, 0, 0);
    m.fillStyle = '#fff';
    m.fillRect(0, 0, ASZ, ASZ);
    e.fillStyle = '#000';
    e.fillRect(0, 0, ASZ / 2, ASZ / 2);
    // помощники: f — краска (тонируемая стена), r — нетонируемая деталь (стекло, рама), lit — свет ночью
    let G_, M_, E_;
    const f = (x, y, w, h, c) => {
      G_.fillStyle = c;
      G_.fillRect(x, y, w, h);
    };
    const r = (x, y, w, h, c) => {
      G_.fillStyle = c;
      G_.fillRect(x, y, w, h);
      M_.fillStyle = '#000';
      M_.fillRect(x, y, w, h);
    };
    const lit = (x, y, w, h, c) => {
      E_.fillStyle = c;
      E_.fillRect(x, y, w, h);
    };
    const glass = (x, y, w, h, top, bot, l) => {
      const gr = G_.createLinearGradient(x, y, x + w * 0.4, y + h);
      gr.addColorStop(0, top);
      gr.addColorStop(1, bot);
      G_.fillStyle = gr;
      G_.fillRect(x, y, w, h);
      M_.fillStyle = '#000';
      M_.fillRect(x, y, w, h);
      // блик
      G_.fillStyle = 'rgba(255,255,255,0.13)';
      G_.beginPath();
      G_.moveTo(x + w * 0.15, y);
      G_.lineTo(x + w * 0.45, y);
      G_.lineTo(x + w * 0.1, y + h);
      G_.lineTo(x, y + h);
      G_.lineTo(x, y + h * 0.6);
      G_.fill();
      if (l) lit(x + 2, y + 2, w - 4, h - 4, l);
    };
    const WARM = '#ffd98a', COOL = '#e8e4c8', SHOP = '#fff0c8';
    const def = (k, fn) => {
      const x = (k % AN) * AS, y = ((k / AN) | 0) * AS;
      G_ = g; M_ = m; E_ = e;
      g.save(); m.save(); e.save();
      g.translate(x, y);
      m.translate(x, y);
      e.translate(x / 2, y / 2);
      e.scale(0.5, 0.5);
      fn();
      g.restore(); m.restore(); e.restore();
    };
    // стеклянная навесная стена (тонируется цветом стекла), тонкие импосты, перекрытие
    def(FC.glass1, () => {
      const gr = g.createLinearGradient(0, 0, 0, AS);
      gr.addColorStop(0, '#ffffff');
      gr.addColorStop(1, '#b8c0c8');
      g.fillStyle = gr;
      g.fillRect(0, 0, AS, AS);
      g.fillStyle = 'rgba(255,255,255,0.18)';
      g.beginPath(); g.moveTo(20, 0); g.lineTo(70, 0); g.lineTo(10, AS); g.lineTo(0, AS); g.lineTo(0, 60); g.fill();
      lit(4, 2, AS - 8, AS - 30, COOL);
      r(0, 0, 4, AS, '#3a4049');
      f(0, AS - 24, AS, 24, '#7d8790');
      r(0, AS - 26, AS, 3, '#3a4049');
    });
    def(FC.glass2, () => {
      const gr = g.createLinearGradient(0, 0, AS, AS);
      gr.addColorStop(0, '#f4f8fc');
      gr.addColorStop(1, '#a8b4c0');
      g.fillStyle = gr;
      g.fillRect(0, 0, AS, AS);
      lit(4, 4, AS - 8, AS - 10, COOL);
      r(0, 0, 3, AS, '#2f343c');
      r(AS / 2 - 1, 0, 2, AS, '#4a5058');
      r(0, AS - 4, AS, 4, '#2f343c');
    });
    // офис: ленточное остекление
    def(FC.office, () => {
      glass(0, 36, AS, 58, '#5a6c7e', '#2c3846', WARM);
      for (let x = 0; x < AS; x += 43) r(x, 36, 3, 58, '#6c747e');
      r(0, 94, AS, 3, '#c8c8c4');
    });
    def(FC.officeP, () => {
      glass(14, 24, 44, 70, '#56687a', '#2c3846', WARM);
      glass(70, 24, 44, 70, '#56687a', '#2c3846', WARM);
      r(12, 94, 48, 4, '#d6d2ca');
      r(68, 94, 48, 4, '#d6d2ca');
    });
    // жилой дом: окно с рамой и подоконником
    const sash = (x, y, w, h, frame) => {
      r(x - 4, y - 4, w + 8, h + 8, frame);
      glass(x, y, w, h, '#4c5a68', '#26303a', WARM);
      r(x + w / 2 - 2, y, 4, h, frame);
      r(x, y + h * 0.42, w, 4, frame);
    };
    def(FC.apt, () => {
      sash(38, 24, 52, 62, '#ece9e2');
      r(32, 90, 64, 7, '#cfcac0');
    });
    def(FC.aptBal, () => {
      sash(34, 14, 60, 84, '#e6e2da');
      r(4, 104, AS - 8, 8, '#bdb8ae');
      for (let x = 6; x < AS - 6; x += 9) r(x, 76, 3, 28, '#3a3c42');
      r(4, 74, AS - 8, 4, '#3a3c42');
    });
    // кирпич
    def(FC.brick, () => {
      for (let y = 0; y < AS; y += 8) {
        f(0, y, AS, 1, 'rgba(0,0,0,0.28)');
        for (let x = (y / 8) % 2 ? 0 : 10; x < AS; x += 20) f(x, y, 1, 8, 'rgba(0,0,0,0.22)');
      }
      for (let k = 0; k < 40; k++) f((J.hash2(k, 1, 7) * AS) | 0, ((J.hash2(k, 2, 7) * 16) | 0) * 8 + 1, 19, 7, 'rgba(0,0,0,0.08)');
      r(36, 14, 56, 6, '#d8cfbe');
      sash(42, 24, 44, 66, '#f2efe8');
      r(36, 94, 56, 6, '#d8cfbe');
    });
    // обшивка (американский дом)
    def(FC.siding, () => {
      for (let y = 0; y < AS; y += 10) f(0, y, AS, 2, 'rgba(0,0,0,0.16)');
      sash(44, 30, 40, 54, '#f8f6f0');
      r(28, 26, 12, 62, '#3f5248');
      r(88, 26, 12, 62, '#3f5248');
    });
    // японский дом: штукатурка, деревянный пояс, окно с решёткой сёдзи
    def(FC.jhouse, () => {
      f(0, 0, AS, 8, 'rgba(60,40,20,0.55)');
      r(28, 32, 72, 56, '#5a4630');
      r(32, 36, 64, 48, '#f2ecd8');
      lit(32, 36, 64, 48, '#ffe2a8');
      for (let x = 32; x < 96; x += 16) r(x, 36, 2, 48, '#6a5438');
      for (let y = 36; y < 84; y += 16) r(32, y, 64, 2, '#6a5438');
      r(24, 92, 80, 5, '#5a4630');
    });
    // Италия: высокое окно с зелёными ставнями
    def(FC.shutter, () => {
      sash(46, 20, 36, 72, '#efe8da');
      for (const sx of [26, 84]) {
        r(sx, 18, 18, 76, '#4e6e48');
        for (let y = 22; y < 92; y += 6) r(sx + 2, y, 14, 2, '#3c5838');
      }
      r(40, 96, 48, 6, '#e0d6c4');
    });
    // штукатурка с небольшим окном (Египет, Индия, Мексика)
    def(FC.plaster, () => {
      for (let k = 0; k < 30; k++) f((J.hash2(k, 3, 9) * AS) | 0, (J.hash2(k, 4, 9) * AS) | 0, 6 + J.hash2(k, 5, 9) * 14, 3, 'rgba(0,0,0,0.05)');
      r(44, 30, 40, 48, '#5c4a38');
      glass(48, 34, 32, 40, '#46525c', '#262c34', WARM);
      r(44, 78, 40, 5, '#d2c4a8');
    });
    // витрина первого этажа
    def(FC.shop, () => {
      f(0, 0, AS, 20, 'rgba(0,0,0,0.12)');
      r(0, 20, AS, 3, '#3a3a40');
      glass(4, 24, AS - 8, 84, '#5e6c78', '#232a32', SHOP);
      r(AS / 2 - 2, 24, 4, 84, '#3a3a40');
      r(0, 108, AS, 20, '#4a4a52');
    });
    // вестибюль башни: стеклянные двери во весь этаж
    def(FC.lobby, () => {
      r(0, 0, AS, AS, '#8a929a');
      glass(6, 6, AS / 2 - 9, AS - 10, '#6a7a88', '#24303c', SHOP);
      glass(AS / 2 + 3, 6, AS / 2 - 9, AS - 10, '#6a7a88', '#24303c', SHOP);
    });
    // профлист
    def(FC.corr, () => {
      for (let x = 0; x < AS; x += 8) {
        f(x, 0, 3, AS, 'rgba(0,0,0,0.16)');
        f(x + 4, 0, 2, AS, 'rgba(255,255,255,0.2)');
      }
      f(0, AS - 6, AS, 6, 'rgba(0,0,0,0.25)');
    });
    // открытый паркинг: плита перекрытия и тёмный проём
    def(FC.garage, () => {
      r(0, 34, AS, AS - 34, '#24262a');
      lit(0, 34, AS, AS - 34, '#5a5040');
      f(0, 34, 12, AS - 34, '#d8d4cc');
      M_.fillStyle = '#fff';
      M_.fillRect(0, 34, 12, AS - 34);
      r(14, 96, 40, 18, '#7a2a2a');
      r(70, 100, 40, 14, '#2a4a7a');
    });
    // камень: блоки и арочное окно (вокзал, церковь, библиотека)
    def(FC.stone, () => {
      for (let y = 0; y < AS; y += 16) {
        f(0, y, AS, 2, 'rgba(0,0,0,0.18)');
        for (let x = (y / 16) % 2 ? 0 : 24; x < AS; x += 48) f(x, y, 2, 16, 'rgba(0,0,0,0.14)');
      }
      G_.fillStyle = '#3c4048';
      G_.beginPath();
      G_.moveTo(42, 112); G_.lineTo(42, 40); G_.arc(64, 40, 22, Math.PI, 0); G_.lineTo(86, 112); G_.fill();
      M_.fillStyle = '#000';
      M_.beginPath();
      M_.moveTo(42, 112); M_.lineTo(42, 40); M_.arc(64, 40, 22, Math.PI, 0); M_.lineTo(86, 112); M_.fill();
      E_.fillStyle = WARM;
      E_.beginPath();
      E_.moveTo(44, 110); E_.lineTo(44, 40); E_.arc(64, 40, 20, Math.PI, 0); E_.lineTo(84, 110); E_.fill();
      r(62, 20, 4, 92, '#d8d0c0');
      r(38, 112, 52, 6, '#d8d0c0');
    });
    // гравийная плоская крыша
    def(FC.roof, () => {
      for (let k = 0; k < 900; k++) f((J.hash2(k, 1, 11) * AS) | 0, (J.hash2(k, 2, 11) * AS) | 0, 2, 2, J.hash2(k, 3, 11) < 0.5 ? 'rgba(0,0,0,0.18)' : 'rgba(255,255,255,0.12)');
    });
    // черепица
    def(FC.tiles, () => {
      for (let y = 0; y < AS; y += 16) {
        f(0, y + 13, AS, 3, 'rgba(0,0,0,0.35)');
        for (let x = (y / 16) % 2 ? 0 : 8; x < AS; x += 16) {
          G_.fillStyle = 'rgba(0,0,0,0.12)';
          G_.fillRect(x, y, 2, 14);
          G_.fillStyle = 'rgba(255,255,255,0.1)';
          G_.fillRect(x + 3, y + 1, 9, 3);
        }
      }
    });
    // аркада Колизея
    def(FC.arch, () => {
      for (let y = 0; y < AS; y += 16) f(0, y, AS, 2, 'rgba(0,0,0,0.12)');
      G_.fillStyle = '#4a3c2c';
      G_.beginPath();
      G_.moveTo(30, AS); G_.lineTo(30, 56); G_.arc(64, 56, 34, Math.PI, 0); G_.lineTo(98, AS); G_.fill();
      M_.fillStyle = '#000';
      M_.beginPath();
      M_.moveTo(30, AS); M_.lineTo(30, 56); M_.arc(64, 56, 34, Math.PI, 0); M_.lineTo(98, AS); M_.fill();
      f(0, 0, 14, AS, 'rgba(0,0,0,0.1)');
      f(AS - 14, 0, 14, AS, 'rgba(0,0,0,0.1)');
    });
    // бетонные панели
    def(FC.panel, () => {
      f(0, 0, AS, 2, 'rgba(0,0,0,0.25)');
      f(0, 0, 2, AS, 'rgba(0,0,0,0.25)');
      glass(38, 32, 52, 46, '#4c5864', '#262e36', WARM);
      r(34, 78, 60, 5, '#bdb8b0');
    });
    // доски (амбар, конюшня)
    def(FC.wood, () => {
      for (let x = 0; x < AS; x += 16) {
        f(x, 0, 2, AS, 'rgba(0,0,0,0.3)');
        f(x + 6, 0, 1, AS, 'rgba(0,0,0,0.08)');
      }
    });
    // сборка: RGB + маска тонировки в альфе; строки переворачиваются (v вверх)
    const cd = g.getImageData(0, 0, ASZ, ASZ).data, md = m.getImageData(0, 0, ASZ, ASZ).data;
    const data = new Uint8Array(ASZ * ASZ * 4);
    for (let y = 0; y < ASZ; y++) {
      const src = y * ASZ * 4, dst = (ASZ - 1 - y) * ASZ * 4;
      for (let x = 0; x < ASZ * 4; x += 4) {
        data[dst + x] = cd[src + x];
        data[dst + x + 1] = cd[src + x + 1];
        data[dst + x + 2] = cd[src + x + 2];
        data[dst + x + 3] = md[src + x];
      }
    }
    const tex = new THREE.DataTexture(data, ASZ, ASZ, THREE.RGBAFormat);
    tex.needsUpdate = true;
    tex.magFilter = THREE.LinearFilter;
    const gl2 = R3.renderer.capabilities.isWebGL2;
    tex.minFilter = gl2 ? THREE.LinearMipmapLinearFilter : THREE.LinearFilter;
    tex.generateMipmaps = gl2;
    tex.anisotropy = Math.min(R3.preset.aniso, R3.renderer.capabilities.getMaxAnisotropy());
    tex.encoding = THREE.sRGBEncoding;
    const etex = new THREE.CanvasTexture(ec);
    etex.encoding = THREE.sRGBEncoding;
    etex.minFilter = gl2 ? THREE.LinearMipmapLinearFilter : THREE.LinearFilter;
    etex.generateMipmaps = gl2;
    return { tex, etex, gl2 };
  }

  // ---------- Текстуры земли ----------
  const canvasTex = (w, h, draw) => {
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    draw(c.getContext('2d'), w, h);
    const t = new THREE.CanvasTexture(c);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.anisotropy = Math.min(R3.preset.aniso, R3.renderer.capabilities.getMaxAnisotropy());
    t.encoding = THREE.sRGBEncoding;
    return t;
  };
  const noiseFill = (g, w, h, base, amp, seed) => {
    const img = g.createImageData(w, h);
    for (let i = 0; i < w * h; i++) {
      const v = base + (J.hash2(i % w, (i / w) | 0, seed) - 0.5) * amp + (J.noise2((i % w) / 9, ((i / w) | 0) / 9, seed + 1) - 0.5) * amp * 0.6;
      img.data[i * 4] = img.data[i * 4 + 1] = img.data[i * 4 + 2] = v;
      img.data[i * 4 + 3] = 255;
    }
    g.putImageData(img, 0, 0);
  };
  function makeMats() {
    // асфальт: зерно, пятна, трещины (6 м на повтор)
    const asphalt = canvasTex(256, 256, (g, w, h) => {
      noiseFill(g, w, h, 200, 46, 3);
      g.globalAlpha = 0.22;
      g.strokeStyle = '#3a3a3a';
      for (let k = 0; k < 6; k++) {
        g.beginPath();
        let x = J.hash2(k, 1, 9) * w, y = J.hash2(k, 2, 9) * h;
        g.moveTo(x, y);
        for (let s = 0; s < 6; s++) {
          x += (J.hash2(k, s, 5) - 0.5) * 50;
          y += (J.hash2(k, s, 6) - 0.5) * 50;
          g.lineTo(x, y);
        }
        g.stroke();
      }
      g.globalAlpha = 0.1;
      g.fillStyle = '#000';
      for (let k = 0; k < 5; k++) {
        g.beginPath();
        g.ellipse(J.hash2(k, 7, 9) * w, J.hash2(k, 8, 9) * h, 10 + J.hash2(k, 9, 9) * 20, 6 + J.hash2(k, 10, 9) * 10, J.hash2(k, 11, 9) * 3, 0, J.TAU);
        g.fill();
      }
    });
    // плитка тротуара: 2×2 плиты по 1.5 м на повтор (3 м)
    const paving = canvasTex(128, 128, (g, w, h) => {
      noiseFill(g, w, h, 226, 22, 4);
      g.strokeStyle = 'rgba(70,70,70,0.5)';
      g.lineWidth = 2;
      for (const [x, y] of [[1, 1], [w / 2, 1], [1, h / 2], [w / 2, h / 2]]) g.strokeRect(x, y, w / 2 - 1, h / 2 - 1);
    });
    const lam = (o) => new THREE.MeshLambertMaterial(Object.assign({ vertexColors: true }, o));
    const atlas = makeAtlas();
    const facade = lam({ map: atlas.tex, emissiveMap: atlas.etex, emissive: new THREE.Color(0, 0, 0) });
    const PAD = (3 / ASZ).toFixed(6), IN = ((AS - 6) / ASZ).toFixed(6);
    facade.onBeforeCompile = (sh) => {
      sh.vertexShader = sh.vertexShader
        .replace('#include <common>', '#include <common>\nattribute vec2 aCell;\nvarying vec2 vCell;')
        .replace('#include <uv_vertex>', '#include <uv_vertex>\nvCell = aCell;');
      const samp = atlas.gl2 ? (t) => `textureGrad(${t}, cuv, cgx, cgy)` : (t) => `texture2D(${t}, cuv)`;
      sh.fragmentShader = sh.fragmentShader
        .replace('#include <common>', '#include <common>\nvarying vec2 vCell;')
        .replace(
          '#include <map_fragment>',
          `vec2 cuv = vCell + ${PAD} + fract(vUv) * ${IN};
          vec2 cgx = dFdx(vUv) * ${IN}, cgy = dFdy(vUv) * ${IN};
          vec4 texelColor = ${samp('map')};
          texelColor = mapTexelToLinear(texelColor);
          float wallMask = texelColor.a;
          diffuseColor.rgb *= texelColor.rgb;`
        )
        .replace('#include <color_fragment>', 'diffuseColor.rgb *= mix(vec3(1.0), vColor, wallMask);')
        .replace(
          '#include <emissivemap_fragment>',
          `vec4 emissiveColor = ${samp('emissiveMap')};
          emissiveColor.rgb = emissiveMapTexelToLinear(emissiveColor).rgb;
          vec2 wId = floor(vUv) + floor(vCell * 8.0 + 0.5) * 61.0; // целые числа: интерполяция varying не даёт шума
          float litW = step(0.52, fract(sin(dot(wId, vec2(12.9898, 78.233))) * 43758.5453));
          // у каждого окна своя яркость и оттенок (тёплые лампы, холодный свет экранов), сверху светлее
          float wr = fract(sin(dot(wId, vec2(39.3468, 11.135))) * 24634.6345);
          vec3 wt = mix(vec3(1.0, 0.86, 0.66), vec3(0.78, 0.88, 1.0), step(0.72, wr));
          totalEmissiveRadiance *= emissiveColor.rgb * litW * (0.3 + 0.7 * wr) * wt * (0.7 + 0.3 * fract(vUv.y));`
        );
    };
    if (!atlas.gl2) facade.extensions = { derivatives: true };
    R3.cmat = {
      asphalt: lam({ map: asphalt }),
      paving: lam({ map: paving }),
      marks: lam({ polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }),
      facade,
    };
  }

  // ---------- Уличная мебель: геометрия в локальных осях (+z — к дороге), склеивается в одну геометрию на чанк ----------
  function makeProps() {
    const GB = J.GB;
    const M = (x, y, z, sx = 1, sy = 1, sz = 1, ry = 0, rx = 0, rz = 0) => {
      const m = new THREE.Matrix4();
      m.compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)), new THREE.Vector3(sx, sy, sz));
      return m;
    };
    const B = (w, h, d) => new THREE.BoxGeometry(w, h, d);
    const C = (r0, r1, h, s = 8) => new THREE.CylinderGeometry(r0, r1, h, s);
    const P = {};
    const mk = (fn, edge = 0) => {
      const b = new GB(), l = new GB();
      fn(b, l);
      return { p: b.p.slice(0, b.v * 3), n: b.n.slice(0, b.v * 3), c: b.c.slice(0, b.v * 3), lp: l.p.slice(0, l.v * 3), ln: l.n.slice(0, l.v * 3), lc: l.c.slice(0, l.v * 3), edge };
    };
    const metal = col('#4a4d55'), dark = col('#26282e');
    // фонарь: опора у бордюра, консоль над дорогой
    P[O.LAMP] = mk((b, l) => {
      b.geo(C(0.07, 0.11, 6.2), M(0, 3.1, 0), metal);
      b.geo(B(0.08, 0.08, 1.8), M(0, 6.15, 0.85), metal);
      b.geo(B(0.36, 0.14, 0.7), M(0, 6.08, 1.7), dark);
      b.geo(C(0.16, 0.16, 0.25, 8), M(0, 0.12, 0), metal);
      l.geo(B(0.28, 0.04, 0.55), M(0, 5.99, 1.7), col('#fff4d0'));
    }, 0.25);
    // светофор: опора на углу, консоль над входящими полосами, секции смотрят на подъезжающих (+x или -x)
    const tlight = (sx) => mk((b) => {
      b.geo(C(0.1, 0.13, 5.6), M(0, 2.8, 0), col('#3a3d44'));
      b.geo(B(0.1, 0.1, 4.4), M(0, 5.45, 2.2), col('#3a3d44'));
      for (const z of [2.6, 4.1]) {
        b.geo(B(0.32, 1.0, 0.34), M(0, 4.9, z), dark);
        b.geo(B(0.05, 0.08, 0.36), M(sx * 0.19, 5.38, z), dark);
        b.geo(B(0.04, 0.2, 0.2), M(sx * 0.17, 5.2, z), col('#e0342c'));
        b.geo(B(0.04, 0.2, 0.2), M(sx * 0.17, 4.9, z), col('#e8b420'));
        b.geo(B(0.04, 0.2, 0.2), M(sx * 0.17, 4.6, z), col('#2cc055'));
      }
      // пешеходный светофор на опоре
      b.geo(B(0.28, 0.42, 0.26), M(sx * 0.2, 2.9, 0), dark);
      b.geo(B(0.03, 0.14, 0.14), M(sx * 0.34, 3.0, 0), col('#f2f2f2'));
      b.geo(B(0.3, 0.2, 0.2), M(0, 1.1, 0), col('#d8c040'));
    }, 0.3);
    P.TL_R = tlight(1);
    P.TL_L = tlight(-1);
    const stop = (sx) => mk((b) => {
      b.geo(C(0.04, 0.04, 2.5), M(0, 1.25, 0), col('#9a9a9a'));
      b.geo(C(0.4, 0.4, 0.03, 8), M(sx * 0.04, 2.25, 0, 1, 1, 1, Math.PI / 8, 0, Math.PI / 2), col('#f4f4f4'));
      b.geo(C(0.36, 0.36, 0.04, 8), M(sx * 0.055, 2.25, 0, 1, 1, 1, Math.PI / 8, 0, Math.PI / 2), col('#c8102e'));
    }, 0.3);
    P.SIGN_R = stop(1);
    P.SIGN_L = stop(-1);
    P[O.HYDRANT] = mk((b) => {
      b.geo(C(0.13, 0.16, 0.7), M(0, 0.35, 0), col('#d0302a'));
      b.geo(new THREE.SphereGeometry(0.14, 8, 5), M(0, 0.72, 0), col('#d0302a'));
      b.geo(C(0.06, 0.06, 0.42), M(0, 0.48, 0, 1, 1, 1, 0, 0, Math.PI / 2), col('#c0c0c0'));
    }, 0.2);
    P[O.BIN] = mk((b) => {
      b.geo(C(0.25, 0.22, 0.9, 10), M(0, 0.45, 0), col('#2f5a3a'));
      b.geo(C(0.27, 0.27, 0.06, 10), M(0, 0.92, 0), col('#222'));
    }, -0.1);
    P[O.BENCH] = mk((b) => {
      b.geo(B(1.8, 0.08, 0.5), M(0, 0.45, 0), col('#8a5a3a'));
      b.geo(B(1.8, 0.5, 0.06), M(0, 0.75, -0.24), col('#8a5a3a'));
      b.geo(B(0.08, 0.45, 0.45), M(-0.8, 0.22, 0), col('#333'));
      b.geo(B(0.08, 0.45, 0.45), M(0.8, 0.22, 0), col('#333'));
    }, -0.15);
    P[O.BUSSTOP] = mk((b, l) => {
      b.geo(B(3.2, 0.1, 1.6), M(0, 2.6, 0), col('#3a4a5a'));
      b.geo(B(3.2, 2.4, 0.06), M(0, 1.3, -0.75), col('#a8c8d8'));
      b.geo(B(0.08, 2.6, 0.08), M(-1.55, 1.3, -0.75), col('#555'));
      b.geo(B(0.08, 2.6, 0.08), M(1.55, 1.3, -0.75), col('#555'));
      b.geo(B(0.08, 2.6, 0.08), M(-1.55, 1.3, 0.7), col('#555'));
      b.geo(B(0.08, 2.6, 0.08), M(1.55, 1.3, 0.7), col('#555'));
      b.geo(B(2.4, 0.08, 0.45), M(0, 0.5, -0.45), col('#666'));
      b.geo(B(0.06, 1.8, 1.2), M(1.55, 1.2, 0), col('#f2c230'));
      b.geo(C(0.04, 0.04, 2.8), M(-1.9, 1.4, 0.6), col('#888'));
      b.geo(B(0.5, 0.5, 0.04), M(-1.9, 2.6, 0.6), col('#2a6ad8'));
      l.geo(B(3.0, 0.03, 0.2), M(0, 2.54, 0), col('#e8f0ff'));
    }, 0);
    P[O.BILLBOARD] = mk((b) => {
      b.geo(C(0.15, 0.18, 6), M(-2, 3, 0), col('#666'));
      b.geo(C(0.15, 0.18, 6), M(2, 3, 0), col('#666'));
      b.geo(B(6.5, 3.2, 0.2), M(0, 7, 0), col('#f4f4f4'));
      b.geo(B(6.1, 2.8, 0.05), M(0, 7, 0.12), col('#e2368f'));
      b.geo(B(2.6, 1.0, 0.03), M(-1.2, 7.4, 0.16), col('#ffffff'));
      b.geo(B(1.6, 1.6, 0.03), M(1.8, 6.8, 0.16), col('#f2c230'));
    }, 0);
    // уличное дерево: крона начинается выше 3.5 м (камера ходит под ней)
    P[O.STREETTREE] = mk((b) => {
      b.geo(C(0.1, 0.16, 4.2), M(0, 2.1, 0), col('#5a4030'));
      b.geo(new THREE.IcosahedronGeometry(1.4, 1), M(0, 4.75, 0, 1, 0.8, 1), col('#4f8a3a'));
      b.geo(new THREE.IcosahedronGeometry(0.9, 0), M(0.5, 5.3, 0.3), col('#5a9a44'));
      b.geo(B(1.1, 0.03, 1.1), M(0, 0.015, 0), col('#3a3a3a'));
    }, 0);
    P[O.FENCE] = mk((b) => {
      for (let k = -0.4; k <= 0.41; k += 0.2) b.geo(B(0.08, 1.1, 0.04), M(k, 0.55, 0), col('#ece8e0'));
      b.geo(B(1, 0.08, 0.04), M(0, 0.85, 0.02), col('#ece8e0'));
      b.geo(B(1, 0.08, 0.04), M(0, 0.35, 0.02), col('#ece8e0'));
    }, 0);
    P[O.HEDGE] = mk((b) => {
      b.geo(B(1, 1.3, 0.8), M(0, 0.65, 0), col('#3f7a32'));
    }, 0);
    P[O.PUMP] = mk((b) => {
      b.geo(B(0.6, 1.6, 0.4), M(0, 0.8, 0), col('#e8e8e8'));
      b.geo(B(0.62, 0.3, 0.42), M(0, 1.45, 0), col('#ff5a3c'));
      b.geo(B(0.4, 0.3, 0.05), M(0, 1.1, 0.21), col('#30343a'));
      b.geo(B(1.3, 0.15, 0.9), M(0, 0.075, 0), col('#cccccc'));
    }, 0);
    // телефонная будка (Лондон — красная)
    P[O.PHONE] = mk((b, l) => {
      b.geo(B(0.95, 2.5, 0.95), M(0, 1.25, 0), col('#c8102e'));
      b.geo(B(1.05, 0.15, 1.05), M(0, 2.55, 0), col('#a00d24'));
      b.geo(B(0.7, 1.4, 0.02), M(0, 1.4, 0.48), col('#2a3440'));
      l.geo(B(0.6, 0.12, 0.02), M(0, 2.3, 0.49), col('#ffffff'));
    }, -0.1);
    P[O.PCAR] = mk((b) => {
      b.geo(B(1.8, 0.7, 4.2), M(0, 0.55, 0), col('#3a5a8a'));
      b.geo(B(1.6, 0.6, 2.2), M(0, 1.15, -0.2), col('#2a3440'));
    }, 0);
    // фонтан на площади (большой)
    P[O.FOUNTAIN] = mk((b) => {
      b.geo(C(2.6, 2.8, 0.6, 16), M(0, 0.3, 0), col('#c9c4b8'));
      b.geo(C(2.3, 2.3, 0.08, 16), M(0, 0.55, 0), col('#5ab3ff'));
      b.geo(C(0.2, 0.3, 2.0, 8), M(0, 1.2, 0), col('#c9c4b8'));
      b.geo(C(0.9, 0.6, 0.2, 12), M(0, 2.1, 0), col('#c9c4b8'));
      b.geo(C(0.7, 0.7, 0.05, 12), M(0, 2.21, 0), col('#7ac8ff'));
    }, 0);
    return P;
  }
  // od → поворот: x' = x·cos + z·sin, z' = -x·sin + z·cos
  const RC = [1, 0, -1, 0], RS = [0, 1, 0, -1];
  function addProp(S, L, pr, x, y, z, od, tint) {
    const cs = RC[od], sn = RS[od];
    const put = (src, srcN, srcC, dst) => {
      dst.grow(src.length / 3);
      for (let i = 0; i < src.length; i += 3) {
        const lx = src[i], ly = src[i + 1], lz = src[i + 2], nx = srcN[i], nz = srcN[i + 2];
        dst.vert(x + lx * cs + lz * sn, y + ly, z - lx * sn + lz * cs, nx * cs + nz * sn, srcN[i + 1], -nx * sn + nz * cs, srcC[i] * tint, srcC[i + 1] * tint, srcC[i + 2] * tint);
      }
    };
    put(pr.p, pr.n, pr.c, S);
    if (pr.lp.length) put(pr.lp, pr.ln, pr.lc, L);
  }

  R3.cityInit = function () {
    makeMats();
    R3.props = makeProps();
  };

  // Цвета земли города
  const GC = {
    asphalt: col('#45464c'), parking: col('#55565c'), sidewalk: col('#c4c0b6'), pave: col('#b8b3a8'), plaza: col('#e0d4bc'), building: col('#a8a49a'),
    curb: col('#d2cfc6'), curbTop: col('#e0ddd4'), white: col('#f2f2ee'), yellow: col('#f2c230'), seawall: col('#9a968e'),
  };
  const WHITE1 = { r: 1, g: 1, b: 1 };
  const USA_LINES = { newyork: 1, florida: 1, sandiego: 1, arizona: 1, mexico: 1 };

  // ---------- Чанк города: земля, бордюры, разметка, шоссе, мебель, здания ----------
  R3.cityChunkGen = function* (w, cx, cy, group) {
    const x0 = cx * CH, y0 = cy * CH, X1 = x0 + CH, Y1 = y0 + CH;
    const W = w.W, edges = w.net.edges;
    const asph = new GBU(false, 4096), pav = new GBU(false, 4096);
    const S = new J.GB(8192), Lt = new J.GB(1024), MK = new J.GB(2048), PL = new GBU(false, 64);
    const c = new THREE.Color();
    // 1) асфальт, плитка, бордюры
    for (let ty = 0; ty < CH; ty++) {
      for (let tx = 0; tx < CH; tx++) {
        const X = x0 + tx, Y = y0 + ty;
        if (!w.inb(X, Y)) continue;
        const i = Y * W + X, t = w.t[i];
        const v = (J.hash2(X, Y, 7) - 0.5) * 0.035;
        if (t === T.ROAD) {
          const r = w.rid[i];
          if (r && !(r & 0x8000) && edges[r - 1].cls === 'hw') continue; // обочина шоссе — в местности
          c.copy(GC.asphalt).offsetHSL(0, 0, v);
          asph.top(X, Y, X + 1, Y + 1, RH, c, 6);
          continue;
        }
        if (!URBAN[t]) continue;
        if (t === T.PARKING) {
          c.copy(GC.parking).offsetHSL(0, 0, v);
          asph.top(X, Y, X + 1, Y + 1, CB, c, 6);
        } else if (t !== T.LAWN) {
          const base = t === T.SIDEWALK ? GC.sidewalk : t === T.PLAZA ? GC.plaza : t === T.BUILDING ? GC.building : GC.pave;
          c.copy(base).offsetHSL(0, 0, v);
          pav.top(X, Y, X + 1, Y + 1, CB, c, t === T.PLAZA ? 2 : 3);
        }
        // бордюр к более низким соседям (дорога, земля, вода — набережная)
        for (let k = 0; k < 4; k++) {
          const nx = X + DX[k], ny = Y + DY[k];
          const nt = w.tile(nx, ny);
          if (URBAN[nt]) continue;
          let lo;
          if (nt === T.ROAD) lo = RH;
          else if (nt === T.BRIDGE) lo = w.rid[ny * W + nx] ? RH : -0.6;
          else lo = Math.min(CB, w.tileH(nx, ny)) - 0.05;
          if (lo >= CB - 0.01) continue;
          const cl = lo < -0.3 ? GC.seawall : GC.curb;
          if (k === 0) S.quad([X, lo, Y + 1], [X + 1, lo, Y + 1], [X + 1, CB, Y + 1], [X, CB, Y + 1], cl);
          else if (k === 2) S.quad([X + 1, lo, Y], [X, lo, Y], [X, CB, Y], [X + 1, CB, Y], cl);
          else if (k === 1) S.quad([X + 1, lo, Y + 1], [X + 1, lo, Y], [X + 1, CB, Y], [X + 1, CB, Y + 1], cl);
          else S.quad([X, lo, Y], [X, lo, Y + 1], [X, CB, Y + 1], [X, CB, Y], cl);
          if (nt === T.ROAD) {
            const s = 0.2, yy = CB + 0.012;
            const a = k === 0 ? [X, Y + 1 - s, X + 1, Y + 1] : k === 2 ? [X, Y, X + 1, Y + s] : k === 1 ? [X + 1 - s, Y, X + 1, Y + 1] : [X, Y, X + s, Y + 1];
            S.quad([a[0], yy, a[3]], [a[2], yy, a[3]], [a[2], yy, a[1]], [a[0], yy, a[1]], GC.curbTop);
          }
        }
      }
      if ((ty & 7) === 7) yield;
    }
    // 2) разметка улиц и шоссе
    let n = 0;
    for (const eid of w.chunkEdges(cx, cy)) {
      const e = edges[eid];
      if (e.cls === 'hw') R3.hwChunk(w, e, x0, y0, asph, MK, S);
      else R3.edgeMarks(w, e, x0, y0, MK);
      if (++n % 6 === 0) yield;
    }
    // разметка парковочных мест
    for (const sp of w.parkSpots) {
      if (!sp.lot || sp.x < x0 || sp.x >= X1 || sp.y < y0 || sp.y >= Y1) continue;
      const fx = Math.cos(sp.ang), fz = Math.sin(sp.ang), sx = -fz, sz = fx;
      const yy = CB + 0.006;
      for (const sd of [-1.25, 1.25]) {
        const ax = sp.x + sx * sd - fx * 2.5, az = sp.y + sz * sd - fz * 2.5, bx = sp.x + sx * sd + fx * 2.5, bz = sp.y + sz * sd + fz * 2.5;
        const ox = sx * 0.06, oz = sz * 0.06;
        MK.quad([ax - ox, yy, az - oz], [ax + ox, yy, az + oz], [bx + ox, yy, bz + oz], [bx - ox, yy, bz - oz], GC.white);
      }
    }
    yield;
    // 3) уличная мебель — одна геометрия
    const P = R3.props;
    for (let ty = 0; ty < CH; ty++) {
      for (let tx = 0; tx < CH; tx++) {
        const X = x0 + tx, Y = y0 + ty;
        if (!w.inb(X, Y)) continue;
        const i = Y * W + X, o = w.o[i];
        if (!o) continue;
        let pr = P[o];
        if (o === O.TLIGHT || o === O.SIGN) {
          const st = w.regionAt(X, Y).style;
          const left = (J.GRID[st] || J.GRID.usa).drive === 'L';
          pr = o === O.TLIGHT ? (left ? P.TL_L : P.TL_R) : left ? P.SIGN_L : P.SIGN_R;
        }
        if (!pr) continue;
        if (o === O.LAMP && !w.net) continue;
        const od = w.od[i];
        const gy = o === O.FOUNTAIN ? CB : w.groundY(X + 0.5, Y + 0.5);
        const tint = o === O.STREETTREE || o === O.HEDGE ? 0.85 + J.hash2(X, Y, 55) * 0.3 : 1;
        const px = X + 0.5 + DX[od] * pr.edge, pz = Y + 0.5 + DY[od] * pr.edge;
        addProp(S, Lt, pr, px, gy, pz, od, tint);
        // пятно света под фонарём (видно только ночью)
        if (o === O.LAMP) {
          const hx = px + 1.7 * RS[od], hz = pz + 1.7 * RC[od], r = 4.6, yy = Math.max(RH, CB) + 0.03;
          PL.quad([hx - r, yy, hz + r], [hx + r, yy, hz + r], [hx + r, yy, hz - r], [hx - r, yy, hz - r], WHITE1, [0, 1], [1, 1], [1, 0], [0, 0]);
        }
      }
      if ((ty & 7) === 7) yield;
    }
    // 4) стены поместий, деревянные мосты и причалы
    const wallC = col('#8a8490'), wallTop = col('#6a6470'), plank = col('#9a7a52'), plankD = col('#6a4a2a');
    const wt = (xx, yy) => {
      const q = w.tile(xx, yy);
      return q === T.WATER || q === T.DEEP;
    };
    for (let ty = 0; ty < CH; ty++)
      for (let tx = 0; tx < CH; tx++) {
        const X = x0 + tx, Y = y0 + ty;
        if (!w.inb(X, Y)) continue;
        const i = Y * W + X, t = w.t[i];
        if (t === T.WALL) {
          S.box(X, 0, Y, X + 1, 2.2, Y + 1, wallC);
          S.box(X - 0.03, 2.2, Y - 0.03, X + 1.03, 2.4, Y + 1.03, wallTop);
        } else if ((t === T.BRIDGE && !w.rid[i]) || t === T.DOCKWOOD) {
          S.box(X, 0.14, Y, X + 1, 0.3, Y + 1, (X + Y) % 2 ? plank : plankD);
          if (wt(X - 1, Y) && Y % 2 === 0) S.box(X, 0.3, Y + 0.4, X + 0.12, 0.9, Y + 0.6, plankD);
          if (wt(X + 1, Y) && Y % 2 === 0) S.box(X + 0.88, 0.3, Y + 0.4, X + 1, 0.9, Y + 0.6, plankD);
          if (wt(X, Y - 1) && X % 2 === 0) S.box(X + 0.4, 0.3, Y, X + 0.6, 0.9, Y + 0.12, plankD);
          if (wt(X, Y + 1) && X % 2 === 0) S.box(X + 0.4, 0.3, Y + 0.88, X + 0.6, 0.9, Y + 1, plankD);
        }
      }
    yield;
    // 5) здания
    const B = new GBU(true, 8192);
    let k = 0;
    for (const id of w.chunkBuildings(cx, cy)) {
      R3.buildArch(B, S, Lt, w.buildings[id]);
      yield;
    }
    yield;
    // 6) меши
    const add = (gb, mat, cast, recv) => {
      if (gb.empty) return;
      const m = new THREE.Mesh(gb.build(), mat);
      m.castShadow = cast;
      m.receiveShadow = recv;
      group.add(m);
    };
    add(asph, R3.cmat.asphalt, false, true);
    add(pav, R3.cmat.paving, false, true);
    yield;
    add(MK, R3.cmat.marks, false, true);
    add(S, R3.buildMat, true, true);
    yield;
    add(B, R3.cmat.facade, true, true);
    add(Lt, R3.lightMat, false, false);
    if (R3.poolMat) add(PL, R3.poolMat, false, false);
  };

  // ---------- Разметка городской улицы (оси выровнены по клеткам) ----------
  R3.edgeMarks = function (w, e, x0, y0, mk) {
    const net = w.net, X1 = x0 + CH, Y1 = y0 + CH;
    const y = RH + 0.004;
    const rect = (horiz, a0, a1, c0, c1, cl) => {
      let xa, xb, za, zb;
      if (horiz) { xa = a0; xb = a1; za = c0; zb = c1; }
      else { xa = c0; xb = c1; za = a0; zb = a1; }
      if (xa > xb) [xa, xb] = [xb, xa];
      if (za > zb) [za, zb] = [zb, za];
      xa = Math.max(xa, x0); xb = Math.min(xb, X1); za = Math.max(za, y0); zb = Math.min(zb, Y1);
      if (xa >= xb || za >= zb) return;
      mk.quad([xa, y, zb], [xb, y, zb], [xb, y, za], [xa, y, za], cl);
    };
    const A = net.nodes[e.a], Bn = net.nodes[e.b];
    const horiz = e.horiz;
    const p = horiz ? A.y : A.x; // поперечная координата оси
    const sA = horiz ? A.x + A.aw[0] / 2 : A.y + A.aw[1] / 2, sB = horiz ? Bn.x - Bn.aw[0] / 2 : Bn.y - Bn.aw[1] / 2;
    const hw = e.w / 2;
    const sigA = A.ctrl === 'signal', sigB = Bn.ctrl === 'signal';
    const a0 = sA + (sigA ? 3.6 : A.ctrl === 'stop' ? 0.8 : 0), a1 = sB - (sigB ? 3.6 : Bn.ctrl === 'stop' ? 0.8 : 0);
    const centreC = USA_LINES[e.city] ? GC.yellow : GC.white;
    if (e.lanes === 2) {
      rect(horiz, a0, a1, p - 0.2, p - 0.08, centreC);
      rect(horiz, a0, a1, p + 0.08, p + 0.2, centreC);
      const ld = e.w / 4; // граница полос
      for (const s of [-1, 1]) for (let d = a0 + 1; d < a1 - 1; d += 9) rect(horiz, d, Math.min(d + 3, a1 - 1), p + s * ld - 0.07, p + s * ld + 0.07, GC.white);
      for (const s of [-1, 1]) rect(horiz, a0, a1, p + s * (hw - 0.45) - 0.06, p + s * (hw - 0.45) + 0.06, GC.white);
    } else {
      for (let d = a0 + 1; d < a1 - 1; d += 6) rect(horiz, d, Math.min(d + 3, a1 - 1), p - 0.07, p + 0.07, centreC);
      // широкая улица: край полосы и парковочный карман 1 м
      if (e.w >= 8) for (const s of [-1, 1]) rect(horiz, a0, a1, p + s * 3 - 0.06, p + s * 3 + 0.06, GC.white);
    }
    // стоп-линии (на входящей половине, с учётом стороны движения) и зебры
    const inSide = e.drive === 'L' ? -1 : 1;
    const end = (sig, stop, s0, sgn, half) => {
      if (!sig && !stop) return;
      const bar0 = sig ? 3.1 : 0.3;
      const lo = half > 0 ? p : p - hw + 0.2, hi = half > 0 ? p + hw - 0.2 : p;
      rect(horiz, s0 + sgn * bar0, s0 + sgn * (bar0 + 0.45), lo, hi, GC.white);
      if (sig) for (let c2 = p - hw + 0.4; c2 < p + hw - 0.4; c2 += 1.0) rect(horiz, s0 + sgn * 0.25, s0 + sgn * 2.75, c2, c2 + 0.5, GC.white);
    };
    end(sigA, A.ctrl === 'stop', sA, 1, horiz ? -inSide : inSide);
    end(sigB, Bn.ctrl === 'stop', sB, -1, horiz ? inSide : -inSide);
  };

  // ---------- Шоссе: асфальтовая лента вдоль ломаной, разметка, мосты ----------
  const hwNormals = (e) => {
    if (e.nrm) return e.nrm;
    const P = e.pts, N = [];
    for (let k = 0; k < P.length; k++) {
      let nx = 0, nz = 0;
      for (const [a, b] of [[k - 1, k], [k, k + 1]]) {
        if (a < 0 || b >= P.length) continue;
        const L = Math.hypot(P[b].x - P[a].x, P[b].y - P[a].y) || 1;
        nx += -(P[b].y - P[a].y) / L;
        nz += (P[b].x - P[a].x) / L;
      }
      const l = Math.hypot(nx, nz) || 1;
      N.push(nx / l, nz / l);
    }
    e.nrm = N;
    return N;
  };
  R3.hwChunk = function (w, e, x0, y0, asph, mk, S) {
    const X1 = x0 + CH, Y1 = y0 + CH;
    const P = e.pts, cum = e.cum, N = hwNormals(e);
    const own = e.id + 1;
    const nA = e.a >= 0 ? w.net.nodes[e.a] : null, nB = e.b >= 0 ? w.net.nodes[e.b] : null;
    const HW = e.w / 2;
    const hA = e.wa || HW, hB = e.wb || HW;
    const hwAt = (d) => {
      if (nA && d < 16) return J.lerp(hA, HW, J.smooth(0, 16, d));
      if (nB && e.len - d < 16) return J.lerp(hB, HW, J.smooth(0, 16, e.len - d));
      return HW;
    };
    const ownTile = (x, z) => {
      const X = Math.floor(x), Z = Math.floor(z);
      if (!w.inb(X, Z)) return 0;
      const i = Z * w.W + X;
      if (w.rid[i] !== own) return 0;
      return w.t[i] === T.BRIDGE ? 2 : 1;
    };
    const surf = (x, z) => {
      const tx = Math.floor(x), tz = Math.floor(z);
      if (w.tile(tx, tz) === T.BRIDGE) return RH;
      const fx = x - tx, fz = z - tz;
      const a = w.vertH(tx, tz), b = w.vertH(tx + 1, tz), cc = w.vertH(tx, tz + 1), d = w.vertH(tx + 1, tz + 1);
      return J.clamp(J.lerp(J.lerp(a, b, fx), J.lerp(cc, d, fx), fz), RH, RH + 0.14);
    };
    const asphC = col('#3f4046'), deckC = col('#a8a49c'), railC = col('#b8bcc2'), postC = col('#6a6e74');
    const OFFS = [-1, -0.5, 0, 0.5, 1];
    for (let k = 0; k < P.length - 1; k++) {
      const a = P[k], b = P[k + 1];
      if (Math.max(a.x, b.x) < x0 - 9 || Math.min(a.x, b.x) > X1 + 9 || Math.max(a.y, b.y) < y0 - 9 || Math.min(a.y, b.y) > Y1 + 9) continue;
      const L = cum[k + 1] - cum[k];
      if (L < 1e-3) continue;
      const ns = Math.max(1, Math.ceil(L / 2));

      for (let s = 0; s < ns; s++) {
        const t0 = s / ns, t1 = (s + 1) / ns;
        const d0 = cum[k] + L * t0, d1 = cum[k] + L * t1;
        const h0 = hwAt(d0), h1 = hwAt(d1);
        // нормали интерполируются между точками ломаной — без щелей на изгибах
        const n0x = J.lerp(N[k * 2], N[k * 2 + 2], t0), n0z = J.lerp(N[k * 2 + 1], N[k * 2 + 3], t0);
        const n1x = J.lerp(N[k * 2], N[k * 2 + 2], t1), n1z = J.lerp(N[k * 2 + 1], N[k * 2 + 3], t1);
        const c0x = a.x + (b.x - a.x) * t0, c0z = a.y + (b.y - a.y) * t0, c1x = a.x + (b.x - a.x) * t1, c1z = a.y + (b.y - a.y) * t1;
        const pt = (side, o) => (side ? [c1x + n1x * o * h1, c1z + n1z * o * h1] : [c0x + n0x * o * h0, c0z + n0z * o * h0]);
        const mx = (c0x + c1x) / 2, mz = (c0z + c1z) / 2;
        for (let j = 0; j < 4; j++) {
          const om = (OFFS[j] + OFFS[j + 1]) / 2;
          const qx = mx + ((n0x + n1x) / 2) * om * ((h0 + h1) / 2), qz = mz + ((n0z + n1z) / 2) * om * ((h0 + h1) / 2);
          if (qx < x0 || qx >= X1 || qz < y0 || qz >= Y1) continue;
          if (!ownTile(qx, qz)) continue;
          const A0 = pt(0, OFFS[j]), A1 = pt(1, OFFS[j]), B1 = pt(1, OFFS[j + 1]), B0 = pt(0, OFFS[j + 1]);
          const yA0 = surf(A0[0], A0[1]) + 0.03, yA1 = surf(A1[0], A1[1]) + 0.03, yB1 = surf(B1[0], B1[1]) + 0.03, yB0 = surf(B0[0], B0[1]) + 0.03;
          // поверх = нормаль вверх: порядок как у top() (ближний край к правой стороне)
          asph.quad([B0[0], yB0, B0[1]], [B1[0], yB1, B1[1]], [A1[0], yA1, A1[1]], [A0[0], yA0, A0[1]], asphC, [OFFS[j + 1] * 2, d0 / 5], [OFFS[j + 1] * 2, d1 / 5], [OFFS[j] * 2, d1 / 5], [OFFS[j] * 2, d0 / 5]);
        }
        // разметка
        const line = (o, wd, cl, da, db) => {
          const ta = (da - cum[k]) / L, tb = (db - cum[k]) / L;
          const ha = hwAt(da), hb = hwAt(db);
          const nax = J.lerp(N[k * 2], N[k * 2 + 2], ta), naz = J.lerp(N[k * 2 + 1], N[k * 2 + 3], ta);
          const nbx = J.lerp(N[k * 2], N[k * 2 + 2], tb), nbz = J.lerp(N[k * 2 + 1], N[k * 2 + 3], tb);
          const oa = typeof o === 'function' ? o(ha) : o, ob = typeof o === 'function' ? o(hb) : o;
          const ax = a.x + (b.x - a.x) * ta, az = a.y + (b.y - a.y) * ta, bx = a.x + (b.x - a.x) * tb, bz = a.y + (b.y - a.y) * tb;
          const cxm = (ax + nax * oa + bx + nbx * ob) / 2, czm = (az + naz * oa + bz + nbz * ob) / 2;
          if (cxm < x0 || cxm >= X1 || czm < y0 || czm >= Y1 || !ownTile(cxm, czm)) return;
          const p0 = [ax + nax * (oa - wd / 2), az + naz * (oa - wd / 2)], p1 = [ax + nax * (oa + wd / 2), az + naz * (oa + wd / 2)];
          const p2 = [bx + nbx * (ob + wd / 2), bz + nbz * (ob + wd / 2)], p3 = [bx + nbx * (ob - wd / 2), bz + nbz * (ob - wd / 2)];
          const ya = surf(ax + nax * oa, az + naz * oa) + 0.042, yb = surf(bx + nbx * ob, bz + nbz * ob) + 0.042;
          mk.quad([p1[0], ya, p1[1]], [p2[0], yb, p2[1]], [p3[0], yb, p3[1]], [p0[0], ya, p0[1]], cl);
        };
        for (const sd of [-1, 1]) {
          line(sd * 0.35, 0.12, GC.yellow, d0, d1);
          line((h) => sd * (h - 0.75), 0.15, GC.white, d0, d1);
          if (Math.min(h0, h1) > 6) {
            // пунктир 3 м через 9 м
            const p0 = Math.floor(d0 / 12) * 12;
            for (let q = p0; q < d1; q += 12) {
              const da = Math.max(d0, q), db = Math.min(d1, q + 3);
              if (db > da + 0.05) line(sd * 3.75, 0.14, GC.white, da, db);
            }
          }
        }
        // мост: борта, отбойники, опоры
        const brA = ownTile(c0x, c0z) === 2, brB = ownTile(c1x, c1z) === 2;
        if ((brA || brB) && mx >= x0 && mx < X1 && mz >= y0 && mz < Y1) {
          for (const sd of [-1, 1]) {
            const ax = c0x + n0x * sd * h0, az = c0z + n0z * sd * h0, bx = c1x + n1x * sd * h1, bz = c1z + n1z * sd * h1;
            const yt = RH + 0.03;
            // внешний борт
            if (sd > 0) S.quad([ax, -0.6, az], [bx, -0.6, bz], [bx, yt, bz], [ax, yt, az], deckC);
            else S.quad([bx, -0.6, bz], [ax, -0.6, az], [ax, yt, az], [bx, yt, bz], deckC);
            // отбойник (двусторонний)
            const rx0 = c0x + n0x * sd * (h0 - 0.2), rz0 = c0z + n0z * sd * (h0 - 0.2), rx1 = c1x + n1x * sd * (h1 - 0.2), rz1 = c1z + n1z * sd * (h1 - 0.2);
            S.quad([rx0, yt + 0.5, rz0], [rx1, yt + 0.5, rz1], [rx1, yt + 0.82, rz1], [rx0, yt + 0.82, rz0], railC);
            S.quad([rx1, yt + 0.5, rz1], [rx0, yt + 0.5, rz0], [rx0, yt + 0.82, rz0], [rx1, yt + 0.82, rz1], railC);
            S.box(rx0 - 0.06, yt, rz0 - 0.06, rx0 + 0.06, yt + 0.85, rz0 + 0.06, postC);
          }
          if (Math.floor(d1 / 12) !== Math.floor(d0 / 12)) S.box(mx - 0.7, -1.5, mz - 0.7, mx + 0.7, RH, mz + 0.7, deckC);
        }
      }
    }
  };

  // ---------- Здания по архетипам ----------
  // Фасад по архетипу, стилю города и типу: {cell, bay, g: {cell, h, bay} — первый этаж, roofCell}
  function facadeOf(b) {
    const st = (J.REGION[b.region] || {}).style || 'usa';
    const h = J.hash2(b.id, 7, 3);
    const aptCell = st === 'usa' || st === 'london' ? (h < 0.75 ? FC.brick : FC.apt) : st === 'italy' || st === 'swiss' ? FC.shutter : st === 'japan' ? (h < 0.5 ? FC.aptBal : FC.apt) : st === 'singapore' ? FC.aptBal : st === 'egypt' || st === 'india' || st === 'mexico' ? (h < 0.6 ? FC.plaster : FC.panel) : st === 'tibet' ? FC.plaster : FC.apt;
    const houseCell = st === 'usa' || st === 'western' ? FC.siding : st === 'japan' ? FC.jhouse : st === 'london' ? FC.brick : st === 'italy' || st === 'swiss' ? (h < 0.5 ? FC.shutter : FC.plaster) : FC.plaster;
    const shopG = { cell: FC.shop, h: 4, bay: 4 };
    switch (b.arch) {
      case 'tower_glass': return { cell: h < 0.5 ? FC.glass1 : FC.glass2, bay: 2, g: { cell: FC.lobby, h: 5, bay: 3 } };
      case 'tower_setback': return { cell: h < 0.7 ? FC.office : FC.officeP, bay: 3, g: { cell: FC.lobby, h: 5, bay: 3 } };
      case 'office_mid': return { cell: h < 0.5 ? FC.office : FC.officeP, bay: 3, g: h < 0.6 ? { cell: FC.lobby, h: 4, bay: 3 } : shopG };
      case 'apartment': return { cell: aptCell, bay: 3, g: h < 0.3 ? shopG : null };
      case 'shopfront': return { cell: aptCell, bay: 3, g: shopG };
      case 'suburban': return { cell: houseCell, bay: 3, g: null };
      case 'warehouse': return { cell: FC.corr, bay: 4, g: null };
      case 'parking': return { cell: FC.garage, bay: 4, g: null };
      case 'gas_kiosk': return { cell: FC.shop, bay: 4, g: null };
    }
    switch (b.type) {
      case 'hospital': case 'police': case 'office': case 'speedwagon': return { cell: FC.office, bay: 3, g: { cell: FC.lobby, h: 4, bay: 3 } };
      case 'casino': case 'hotel': return { cell: b.type === 'casino' ? FC.glass2 : aptCell, bay: b.type === 'casino' ? 2 : 3, g: { cell: FC.lobby, h: 4.5, bay: 3 } };
      case 'school': case 'sbr_office': case 'zeppeli_house': return { cell: FC.brick, bay: 3, g: null };
      case 'library': case 'station': case 'church': case 'joestar_mansion': case 'dio_mansion': case 'lisa_castle': case 'pillar_ruins': return { cell: FC.stone, bay: 3.5, g: null };
      case 'colosseum': return { cell: FC.arch, bay: 4, g: null };
      case 'polpo_prison': case 'green_dolphin': return { cell: FC.panel, bay: 4, g: null };
      case 'dock': case 'dig': return { cell: FC.corr, bay: 4, g: null };
      case 'stable': case 'farm': return { cell: FC.wood, bay: 3, g: null };
      case 'hamon_temple': case 'trussardi': case 'rohan': return { cell: st === 'japan' ? FC.jhouse : FC.plaster, bay: 3, g: b.type === 'trussardi' ? shopG : null };
      case 'kame_yu': return { cell: FC.office, bay: 3, g: shopG };
      case 'passione': return { cell: FC.shutter, bay: 3, g: null };
      case 'cape': return { cell: FC.blank, bay: 3, g: null };
      case 'shop': case 'restaurant': case 'bar': case 'black_market': case 'gym': return { cell: aptCell, bay: 3, g: shopG };
    }
    return { cell: aptCell, bay: 3, g: null };
  }
  R3.facadeOf = facadeOf;

  const AWN = ['#c8402e', '#2e6ac8', '#2e8a4e', '#d89a2a', '#7a3a8a', '#3a3a3a'];
  R3.buildArch = function (B, S, Lt, b) {
    const fac = facadeOf(b);
    const base = CB;
    const H = b.height, fh = b.floorH || 3;
    const tint = col(b.glass || b.wall);
    const roofC = col(b.roof);
    const ins = 0.04;
    const fitBay = (L, bay) => L / Math.max(1, Math.round(L / bay));
    // стены прямоугольника от y0 до y1 ячейкой cell; v от vb, этаж bv
    const walls = (x0, z0, x1, z1, y0, y1, cl, cell, bay, bv, vb) => {
      B.cell = cell;
      B.wall(x0, z1, x1, z1, y0, y1, cl, fitBay(x1 - x0, bay), bv, vb);
      B.wall(x1, z1, x1, z0, y0, y1, cl, fitBay(z1 - z0, bay), bv, vb);
      B.wall(x1, z0, x0, z0, y0, y1, cl, fitBay(x1 - x0, bay), bv, vb);
      B.wall(x0, z0, x0, z1, y0, y1, cl, fitBay(z1 - z0, bay), bv, vb);
    };
    const blankBox = (x0, y0, z0, x1, y1, z1, cl) => {
      B.cell = FC.blank;
      B.box(x0, y0, z0, x1, y1, z1, cl, 3, 3, true);
    };
    const parts = b.parts || [{ x0: b.x, y0: b.y, x1: b.x + b.w, y1: b.y + b.h, h0: 0, h1: H }];
    const pitched = !b.flat && (b.arch === 'suburban' || b.arch === 'special' || !b.arch);
    const special = b.type === 'colosseum';
    for (let pi = 0; pi < parts.length && !special; pi++) {
      const pt = parts[pi];
      const x0 = pt.x0 + ins, x1 = pt.x1 - ins, z0 = pt.y0 + ins, z1 = pt.y1 - ins;
      const yb = base + pt.h0, yt = base + pt.h1;
      if (fac.g && pt.h0 === 0 && pt.h1 > fac.g.h + 1) {
        const gC = fac.g.cell === FC.shop ? tint.clone().lerp(col('#ffffff'), 0.25) : tint;
        walls(x0, z0, x1, z1, yb, base + fac.g.h, gC, fac.g.cell, fac.g.bay, fac.g.h, base);
        walls(x0, z0, x1, z1, base + fac.g.h, yt, tint, fac.cell, fac.bay, fh, base + fac.g.h);
        // карниз над первым этажом
        blankBox(x0 - 0.12, base + fac.g.h - 0.12, z0 - 0.12, x1 + 0.12, base + fac.g.h + 0.12, z1 + 0.12, tint.clone().multiplyScalar(0.8));
      } else walls(x0, z0, x1, z1, yb, yt, tint, fac.cell, fac.bay, fh, base);
      if (!pitched || pi < parts.length - 1) {
        // плоская крыша с парапетом
        B.cell = FC.roof;
        B.top(x0, z0, x1, z1, yt, roofC, 4);
        const pr = 0.25, ph = 0.8, pc = tint.clone().multiplyScalar(0.85);
        B.cell = FC.blank;
        B.box(x0 - 0.05, yt, z0 - 0.05, x1 + 0.05, yt + ph, z0 + pr, pc, 3, 3);
        B.box(x0 - 0.05, yt, z1 - pr, x1 + 0.05, yt + ph, z1 + 0.05, pc, 3, 3);
        B.box(x0 - 0.05, yt, z0 + pr, x0 + pr, yt + ph, z1 - pr, pc, 3, 3);
        B.box(x1 - pr, yt, z0 + pr, x1 + 0.05, yt + ph, z1 - pr, pc, 3, 3);
      }
    }
    const top = parts[parts.length - 1];
    const tx0 = top.x0 + ins, tx1 = top.x1 - ins, tz0 = top.y0 + ins, tz1 = top.y1 - ins;
    const HT = base + top.h1;
    // крышные надстройки
    if (b.arch === 'tower_glass' || b.arch === 'tower_setback') {
      const mx = (tx0 + tx1) / 2, mz = (tz0 + tz1) / 2;
      blankBox(mx - 3, HT, mz - 2.5, mx + 3, HT + 3.5, mz + 2.5, col('#8a8f98'));
      blankBox(mx + 3.4, HT, mz - 1.5, mx + 4.6, HT + 1.6, mz + 1.5, col('#9a9ea6'));
      if (H > 70) {
        blankBox(mx - 0.15, HT + 3.5, mz - 0.15, mx + 0.15, HT + 14, mz + 0.15, col('#c0c4cc'));
        Lt.box(mx - 0.2, HT + 14, mz - 0.2, mx + 0.2, HT + 14.4, mz + 0.2, col('#ff3030'));
      }
    } else if (!pitched && b.w >= 6 && b.h >= 6 && !special) {
      blankBox(tx0 + 1.5, HT, tz0 + 1.5, tx0 + 3.5, HT + 1.4, tz0 + 3, col('#9a9aa4'));
      if (b.arch === 'apartment' && b.region === 'newyork') {
        // деревянный бак для воды на опорах
        const cx = tx1 - 2.5, cz = tz1 - 2.5;
        S.geo(new THREE.CylinderGeometry(1.1, 1.1, 2.4, 10), new THREE.Matrix4().makeTranslation(cx, HT + 3.0, cz), col('#7a5a3a'));
        S.geo(new THREE.ConeGeometry(1.25, 0.8, 10), new THREE.Matrix4().makeTranslation(cx, HT + 4.6, cz), col('#5a4030'));
        for (const [ox, oz] of [[-0.7, -0.7], [0.7, -0.7], [-0.7, 0.7], [0.7, 0.7]]) S.box(cx + ox - 0.06, HT, cz + oz - 0.06, cx + ox + 0.06, HT + 1.8, cz + oz + 0.06, col('#3a3a3a'));
      }
    }
    // двускатная крыша вдоль длинной стороны
    if (pitched && !special) {
      const along = b.w >= b.h;
      const x0 = b.x + ins, x1 = b.x + b.w - ins, z0 = b.y + ins, z1 = b.y + b.h - ins;
      const half = (along ? z1 - z0 : x1 - x0) / 2;
      const rh = Math.min(3.2, half * 0.8);
      const Hr = base + H;
      const o = 0.45;
      const rd = roofC.clone().multiplyScalar(0.82);
      const sl = Math.hypot(half + o, rh);
      B.cell = FC.tiles;
      if (along) {
        const zm = (z0 + z1) / 2;
        B.quad([x0 - o, Hr - o * (rh / half), z1 + o], [x1 + o, Hr - o * (rh / half), z1 + o], [x1 + o, Hr + rh, zm], [x0 - o, Hr + rh, zm], roofC, [0, 0], [(x1 - x0 + 2 * o) / 1.5, 0], [(x1 - x0 + 2 * o) / 1.5, sl / 1.2], [0, sl / 1.2]);
        B.quad([x1 + o, Hr - o * (rh / half), z0 - o], [x0 - o, Hr - o * (rh / half), z0 - o], [x0 - o, Hr + rh, zm], [x1 + o, Hr + rh, zm], rd, [0, 0], [(x1 - x0 + 2 * o) / 1.5, 0], [(x1 - x0 + 2 * o) / 1.5, sl / 1.2], [0, sl / 1.2]);
        B.cell = fac.cell;
        B.tri([x0, Hr, z0], [x0, Hr, z1], [x0, Hr + rh, zm], tint, [0, H / fh], [(z1 - z0) / 3, H / fh], [(z1 - z0) / 6, (H + rh) / fh]);
        B.tri([x1, Hr, z1], [x1, Hr, z0], [x1, Hr + rh, zm], tint, [0, H / fh], [(z1 - z0) / 3, H / fh], [(z1 - z0) / 6, (H + rh) / fh]);
      } else {
        const xm = (x0 + x1) / 2;
        B.quad([x1 + o, Hr - o * (rh / half), z1 + o], [x1 + o, Hr - o * (rh / half), z0 - o], [xm, Hr + rh, z0 - o], [xm, Hr + rh, z1 + o], roofC, [0, 0], [(z1 - z0 + 2 * o) / 1.5, 0], [(z1 - z0 + 2 * o) / 1.5, sl / 1.2], [0, sl / 1.2]);
        B.quad([x0 - o, Hr - o * (rh / half), z0 - o], [x0 - o, Hr - o * (rh / half), z1 + o], [xm, Hr + rh, z1 + o], [xm, Hr + rh, z0 - o], rd, [0, 0], [(z1 - z0 + 2 * o) / 1.5, 0], [(z1 - z0 + 2 * o) / 1.5, sl / 1.2], [0, sl / 1.2]);
        B.cell = fac.cell;
        B.tri([x0, Hr, z1], [x1, Hr, z1], [xm, Hr + rh, z1], tint, [0, H / fh], [(x1 - x0) / 3, H / fh], [(x1 - x0) / 6, (H + rh) / fh]);
        B.tri([x1, Hr, z0], [x0, Hr, z0], [xm, Hr + rh, z0], tint, [0, H / fh], [(x1 - x0) / 3, H / fh], [(x1 - x0) / 6, (H + rh) / fh]);
      }
    }
    // особые формы
    R3.buildSpecial(B, S, Lt, b, tint, roofC, base);
    // дверь, вывеска и навес на фасадной стороне
    const d = b.dir || 0;
    const nx = DX[d], nz = DY[d], tX = DY[d], tZ = -DX[d]; // нормаль наружу и касательная
    const fx = d === 1 ? b.x + b.w - ins : d === 3 ? b.x + ins : b.door.x + 0.5;
    const fz = d === 0 ? b.y + b.h - ins : d === 2 ? b.y + ins : b.door.y + 0.5;
    const P = (s, y, q) => [fx + tX * s + nx * q, y, fz + tZ * s + nz * q];
    const vq = (s0, s1, y0, y1, q, cl, cell) => {
      B.cell = cell;
      B.quad(P(s0, y0, q), P(s1, y0, q), P(s1, y1, q), P(s0, y1, q), cl, [0, 0], [1, 0], [1, 1], [0, 1]);
    };
    const big = b.arch === 'tower_glass' || b.arch === 'tower_setback' || b.type === 'station' || b.type === 'hospital';
    const dw = big ? 1.6 : 0.65, dh = big ? 3.0 : 2.25;
    if (b.arch !== 'parking') {
      vq(-dw - 0.12, dw + 0.12, base, base + dh + 0.12, 0.02, col('#e8e4dc'), FC.blank);
      vq(-dw, dw, base, base + dh, 0.04, col(b.type === 'house' ? '#5a3a2a' : big ? '#33404c' : '#3a2a22'), FC.blank);
      if (big) vq(-0.04, 0.04, base, base + dh, 0.05, col('#9aa0a8'), FC.blank);
    }
    if (b.arch === 'warehouse') vq(dw + 1, dw + 4.5, base, base + 3.6, 0.03, col('#8a8e94'), FC.corr);
    // вывеска
    if (b.sign && b.type !== 'house') {
      const sy = Math.min(base + H - 0.4, base + (fac.g ? fac.g.h : 3) + 0.25);
      const sw = Math.min(3.2, (d & 1 ? b.h : b.w) / 2 - 0.3);
      const sc = col(b.sign);
      B.cell = FC.blank;
      const p0 = P(-sw, sy, 0.02), p1 = P(sw, sy + 0.8, 0.2);
      B.box(Math.min(p0[0], p1[0]), sy, Math.min(p0[2], p1[2]), Math.max(p0[0], p1[0]), sy + 0.8, Math.max(p0[2], p1[2]), sc, 3, 3, true);
      // ночью вывеска светится
      const q0 = P(-sw + 0.15, sy + 0.15, 0.215), q1 = P(sw - 0.15, sy + 0.65, 0.215);
      Lt.quad([q0[0], q0[1], q0[2]], [q1[0], q0[1], q1[2]], [q1[0], q1[1], q1[2]], [q0[0], q1[1], q0[2]], sc.clone().lerp(col('#ffffff'), 0.35));
    }
    // навес над входом магазина / маркиза витрины
    if (fac.g && fac.g.cell === FC.shop) {
      const ac = col(b.sign || AWN[(b.id * 7) % AWN.length]);
      const wd = (d & 1 ? b.h : b.w) / 2 - 0.2, yT = base + fac.g.h - 0.3;
      B.cell = FC.blank;
      B.quad(P(-wd, yT - 0.55, 1.3), P(wd, yT - 0.55, 1.3), P(wd, yT, 0.02), P(-wd, yT, 0.02), ac.clone().multiplyScalar(0.9), [0, 0], [1, 0], [1, 1], [0, 1]);
      vq(-wd, wd, yT - 0.85, yT - 0.55, 1.3, ac, FC.blank);
    } else if (b.arch === 'suburban' || b.type === 'house') {
      // козырёк над крыльцом
      B.cell = FC.blank;
      const yT = base + 2.7;
      B.quad(P(-1.1, yT - 0.25, 1.0), P(1.1, yT - 0.25, 1.0), P(1.1, yT, 0.02), P(-1.1, yT, 0.02), roofC, [0, 0], [1, 0], [1, 1], [0, 1]);
    }
    // навес заправки
    if (b.canopy) {
      const cp = b.canopy;
      blankBox(cp.x, base + cp.h, cp.y, cp.x1, base + cp.h + 0.6, cp.y1, col('#f4f4f4'));
      Lt.quad([cp.x + 0.5, base + cp.h - 0.01, cp.y + 0.5], [cp.x1 - 0.5, base + cp.h - 0.01, cp.y + 0.5], [cp.x1 - 0.5, base + cp.h - 0.01, cp.y1 - 0.5], [cp.x + 0.5, base + cp.h - 0.01, cp.y1 - 0.5], col('#f8f8ff'));
      for (const [px, pz] of [[cp.x + 0.6, cp.y + 0.6], [cp.x1 - 0.6, cp.y + 0.6], [cp.x + 0.6, cp.y1 - 0.6], [cp.x1 - 0.6, cp.y1 - 0.6]]) blankBox(px - 0.2, base, pz - 0.2, px + 0.2, base + cp.h, pz + 0.2, col('#d0d0d0'));
      blankBox(cp.x - 0.02, base + cp.h + 0.08, cp.y - 0.02, cp.x1 + 0.02, base + cp.h + 0.5, cp.y1 + 0.02, col('#ff5a3c'));
    }
  };

  // Особые формы: шпиль церкви, башни поместий, маяк, пагода, крест больницы, часы вокзала, Колизей, вышки тюрьмы
  R3.buildSpecial = function (B, S, Lt, b, tint, roofC, base) {
    const t = b.type;
    const x0 = b.x + 0.04, x1 = b.x + b.w - 0.04, z0 = b.y + 0.04, z1 = b.y + b.h - 0.04;
    const H = base + b.height;
    const M = (x, y, z, sx = 1, sy = 1, sz = 1, ry = 0) => new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, ry, 0)), new THREE.Vector3(sx, sy, sz));
    const d = b.dir || 0;
    // точка у фасада: s — вдоль, q — внутрь от фасада
    const fpt = (s, q) => {
      const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
      const hx = (x1 - x0) / 2, hz = (z1 - z0) / 2;
      if (d === 0) return [cx + s, z1 - q];
      if (d === 2) return [cx - s, z0 + q];
      if (d === 1) return [x1 - q, cz - s];
      return [x0 + q, cz + s];
      void hx; void hz;
    };
    if (t === 'church' || t === 'cape') {
      const [cx, cz] = fpt(0, 1.5);
      B.cell = FC.stone;
      B.box(cx - 1.2, H - 1, cz - 1.2, cx + 1.2, H + 5, cz + 1.2, tint, 2.4, 3, false, base);
      S.geo(new THREE.ConeGeometry(1.7, 5, 4), M(cx, H + 7.5, cz, 1, 1, 1, Math.PI / 4), t === 'cape' ? col('#d8442b') : roofC);
      if (t === 'church') {
        S.box(cx - 0.08, H + 10, cz - 0.08, cx + 0.08, H + 11.6, cz + 0.08, col('#e8d890'));
        S.box(cx - 0.5, H + 10.9, cz - 0.08, cx + 0.5, H + 11.06, cz + 0.08, col('#e8d890'));
      }
      if (t === 'cape') S.geo(new THREE.CylinderGeometry(0.6, 0.8, 9, 12), M(x1 + 1.4, base + 4.5, z1 - 1), col('#f4f4f4'));
    }
    if (t === 'dio_mansion' || t === 'joestar_mansion' || t === 'lisa_castle') {
      for (const [tx, tz] of [[x0, z0], [x1, z0], [x0, z1], [x1, z1]]) {
        S.geo(new THREE.CylinderGeometry(0.9, 1.0, b.height + 3, 10), M(tx, base + (b.height + 3) / 2, tz), tint.clone().multiplyScalar(0.85));
        S.geo(new THREE.ConeGeometry(1.25, 2.6, 10), M(tx, base + b.height + 4.3, tz), roofC);
      }
    }
    if (t === 'hamon_temple') {
      S.box(x0 - 0.6, H + 1.2, z0 - 0.6, x1 + 0.6, H + 1.45, z1 + 0.6, roofC);
      B.cell = FC.jhouse;
      B.box(x0 + 1, H + 1.45, z0 + 1, x1 - 1, H + 3.0, z1 - 1, tint, 3, 3, false, H + 1.45);
      S.geo(new THREE.ConeGeometry((x1 - x0) * 0.55, 1.8, 4), M((x0 + x1) / 2, H + 3.9, (z0 + z1) / 2, 1, 1, 1, Math.PI / 4), roofC);
    }
    if (t === 'hospital') {
      // красный крест на фасаде у крыши
      const [cx, cz] = fpt(0, -0.25);
      const y = H - 2.2;
      const nx = DX[d], nz = DY[d];
      const w = d & 1 ? 0.15 : 1.6, dd = d & 1 ? 1.6 : 0.15;
      S.box(cx - w / 2 + nx * 0.1, y - 0.25, cz - dd / 2 + nz * 0.1, cx + w / 2 + nx * 0.1, y + 0.25, cz + dd / 2 + nz * 0.1, col('#e8202a'));
      S.box(cx - (d & 1 ? 0.15 : 0.25) / 2 + nx * 0.1, y - 0.8, cz - (d & 1 ? 0.25 : 0.15) / 2 + nz * 0.1, cx + (d & 1 ? 0.15 : 0.25) / 2 + nx * 0.1, y + 0.8, cz + (d & 1 ? 0.25 : 0.15) / 2 + nz * 0.1, col('#e8202a'));
      // вертолётная площадка
      S.box((x0 + x1) / 2 - 3, H + 0.02, (z0 + z1) / 2 - 3, (x0 + x1) / 2 + 3, H + 0.1, (z0 + z1) / 2 + 3, col('#5a5a60'));
    }
    if (t === 'station') {
      // часы над входом и навес
      const [cx, cz] = fpt(0, -0.2);
      S.geo(new THREE.CylinderGeometry(0.9, 0.9, 0.15, 16), M(cx, H - 1.5, cz, 1, 1, 1).multiply(new THREE.Matrix4().makeRotationX(Math.PI / 2)).premultiply(new THREE.Matrix4().makeRotationY(0)), col('#f4f0e0'));
      void cx;
    }
    if (t === 'polpo_prison' || t === 'green_dolphin') {
      for (const [tx, tz] of [[x0, z0], [x1, z1]]) {
        S.box(tx - 1, base, tz - 1, tx + 1, H + 4, tz + 1, col('#8a8c90'));
        S.box(tx - 1.4, H + 4, tz - 1.4, tx + 1.4, H + 5.4, tz + 1.4, col('#5a5c60'));
      }
    }
    if (t === 'colosseum') {
      // эллиптическое кольцо аркад в три яруса, внутри — арена
      const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2, rx = (x1 - x0) / 2, rz = (z1 - z0) / 2;
      const n = 28, th = 1.6;
      const sand = col('#d8c08a');
      B.cell = FC.blank;
      B.top(cx - rx * 0.7, cz - rz * 0.7, cx + rx * 0.7, cz + rz * 0.7, base + 0.02, sand, 4);
      for (let k = 0; k < n; k++) {
        const a0 = (k / n) * J.TAU, a1 = ((k + 1) / n) * J.TAU;
        const ox0 = cx + Math.cos(a0) * rx, oz0 = cz + Math.sin(a0) * rz, ox1 = cx + Math.cos(a1) * rx, oz1 = cz + Math.sin(a1) * rz;
        const ix0 = cx + Math.cos(a0) * (rx - th), iz0 = cz + Math.sin(a0) * (rz - th), ix1 = cx + Math.cos(a1) * (rx - th), iz1 = cz + Math.sin(a1) * (rz - th);
        // ломаный верх: часть стены выше (руина)
        const hh = k % 9 < 5 ? H : H - 4;
        B.cell = FC.arch;
        const L = Math.hypot(ox1 - ox0, oz1 - oz0);
        B.quad([ox1, base, oz1], [ox0, base, oz0], [ox0, hh, oz0], [ox1, hh, oz1], tint, [0, 0], [L / 4, 0], [L / 4, (hh - base) / 4.2], [0, (hh - base) / 4.2]);
        B.quad([ix0, base, iz0], [ix1, base, iz1], [ix1, hh, iz1], [ix0, hh, iz0], tint.clone().multiplyScalar(0.85), [0, 0], [L / 4, 0], [L / 4, (hh - base) / 4.2], [0, (hh - base) / 4.2]);
        B.cell = FC.blank;
        B.quad([ox0, hh, oz0], [ix0, hh, iz0], [ix1, hh, iz1], [ox1, hh, oz1], tint.clone().multiplyScalar(0.9), [0, 0], [1, 0], [1, 1], [0, 1]);
      }
    }
  };
})();
