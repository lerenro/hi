'use strict';
// Транспорт: типы машин, региональный состав потока и окраска. 1 клетка = 1 м, скорости в м/с (км/ч = v·3.6).
(function () {
  // L/W/H — размеры кузова; wb — колёсная база; tr — колея; wr — радиус колеса; m — масса (кг)
  // vmax — макс. скорость; acc — разгон на малой скорости (м/с²); brk — торможение; steer — макс. угол колёс (рад)
  // grip — боковое сцепление (1/с, больше — меньше заносит); hp — прочность; prof — профиль кузова (доли длины от носа)
  J.VTYPES = {
    sedan: {
      name: 'Седан', L: 4.6, W: 1.82, H: 1.45, wb: 2.75, tr: 1.54, wr: 0.33, m: 1450,
      vmax: 44, acc: 6.8, brk: 12, steer: 0.6, grip: 9, hp: 320, rwd: 1,
      prof: { hood: 0.31, roof0: 0.45, roof1: 0.72, deck: 0.83, nose: 0.6, tail: 0.73, tumble: 0.13 },
      colors: ['#c9ccd2', '#2a2d33', '#8a1f24', '#1f3a6b', '#e8e6df', '#3a5a40', '#6b6f78', '#9a8a6a', '#5a6f8a'],
    },
    hatch: {
      name: 'Хэтчбек', L: 3.95, W: 1.74, H: 1.48, wb: 2.5, tr: 1.48, wr: 0.31, m: 1150,
      vmax: 40, acc: 7.2, brk: 12, steer: 0.64, grip: 9.5, hp: 270, rwd: 0,
      prof: { hood: 0.27, roof0: 0.42, roof1: 0.86, deck: 0.97, nose: 0.6, tail: 0.86, tumble: 0.12 },
      colors: ['#d8d4c8', '#c43a2a', '#2f6fa8', '#f2c230', '#3a3d44', '#7ab0c8', '#8ab04a', '#e8e6df'],
    },
    taxi: {
      name: 'Такси', base: 'sedan', vmax: 42, acc: 6.4, hp: 330, sign: true,
      colors: ['#f2c21a'],
    },
    police: {
      name: 'Полиция', base: 'sedan', vmax: 52, acc: 8.8, brk: 14, grip: 10.5, hp: 460, lightbar: true,
      colors: ['#f4f4f4'],
    },
    sports: {
      name: 'Спорткар', L: 4.45, W: 1.95, H: 1.16, wb: 2.62, tr: 1.64, wr: 0.34, m: 1320,
      vmax: 66, acc: 11, brk: 15, steer: 0.56, grip: 11.5, hp: 260, rwd: 1,
      prof: { hood: 0.4, roof0: 0.53, roof1: 0.69, deck: 0.87, nose: 0.48, tail: 0.66, tumble: 0.17 },
      colors: ['#d81f26', '#f2c230', '#f4f4f4', '#14161a', '#1f6bd8', '#ff7a1a', '#2a8a4a'],
    },
    kei: {
      name: 'Кей-кар', L: 3.39, W: 1.47, H: 1.72, wb: 2.42, tr: 1.3, wr: 0.28, m: 880,
      vmax: 37, acc: 6.2, brk: 11.5, steer: 0.68, grip: 9, hp: 230, rwd: 0,
      prof: { hood: 0.15, roof0: 0.3, roof1: 0.95, deck: 0.985, nose: 0.5, tail: 0.6, tumble: 0.05, belt: 0.56, round: 0.18, crown: 0.03 },
      colors: ['#f2f0ea', '#e8dcc0', '#9ccab8', '#b8cfe0', '#c8c8cc', '#e6b8b0', '#3a3d44', '#f2d878'],
    },
    compact: {
      name: 'Малолитражка', L: 3.57, W: 1.63, H: 1.49, wb: 2.3, tr: 1.41, wr: 0.29, m: 960,
      vmax: 38, acc: 6.6, brk: 12, steer: 0.66, grip: 9.4, hp: 240, rwd: 0,
      prof: { hood: 0.22, roof0: 0.41, roof1: 0.8, deck: 0.95, nose: 0.55, tail: 0.66, tumble: 0.15, belt: 0.6, round: 0.42, crown: 0.07 },
      colors: ['#c8241e', '#efe6d0', '#9cc8d8', '#a8d0a0', '#f2c230', '#f4f4f4', '#2a2d33', '#d8a0a8'],
    },
    pickup: {
      name: 'Пикап', L: 5.3, W: 1.96, H: 1.82, wb: 3.3, tr: 1.66, wr: 0.38, m: 2100,
      vmax: 42, acc: 6.4, brk: 11, steer: 0.58, grip: 8.6, hp: 420, rwd: 1, bed: true,
      prof: { hood: 0.27, roof0: 0.37, roof1: 0.54, deck: 0.585, nose: 0.62, tail: 0.6, tumble: 0.1, belt: 0.6, round: 0.2, crown: 0.03 },
      colors: ['#c43a2a', '#f0f0ee', '#2a2d33', '#3a5a8a', '#8a7a5a', '#5a6a4a', '#b8bcc4'],
    },
    van: {
      name: 'Фургон', L: 5.2, W: 1.98, H: 2.25, wb: 3.25, tr: 1.7, wr: 0.36, m: 2300,
      vmax: 36, acc: 5, brk: 10, steer: 0.62, grip: 8.5, hp: 480, shape: 'van', rwd: 1,
      prof: { hood: 0.11, roof0: 0.25, roof1: 0.99, deck: 1, nose: 0.42, tail: 0.5, tumble: 0.05, belt: 0.47, round: 0.2, crown: 0.03 },
      colors: ['#f0f0ee', '#e8e6df', '#3a5a8a', '#c8c8c0', '#8a1f24', '#2f4a3a'],
    },
    truck: {
      name: 'Грузовик', L: 7.2, W: 2.4, H: 3.2, wb: 4.3, tr: 1.95, wr: 0.48, m: 6500,
      vmax: 28, acc: 3.4, brk: 8, steer: 0.6, grip: 7.5, hp: 800, shape: 'truck', rwd: 1,
      colors: ['#e8e8e8', '#2f5fa8', '#c43a2a', '#3a7a4a'],
    },
    bus: {
      name: 'Автобус', L: 11, W: 2.5, H: 3.1, wb: 6.0, tr: 2.05, wr: 0.5, m: 11000,
      vmax: 24, acc: 2.4, brk: 7, steer: 0.62, grip: 7, hp: 1000, shape: 'bus', rwd: 1,
      colors: ['#f2c230', '#2f7ad8', '#d83a2a', '#3aa86b'],
    },
  };
  for (const k in J.VTYPES) {
    const t = J.VTYPES[k];
    t.id = k;
    if (t.base) {
      const b = J.VTYPES[t.base];
      for (const key in b) if (t[key] === undefined && key !== 'id' && key !== 'name' && key !== 'colors') t[key] = b[key];
    }
  }
  // Состав потока по стилю региона (веса)
  J.VMIX = {
    usa: { sedan: 36, hatch: 6, taxi: 18, sports: 7, van: 9, pickup: 6, truck: 6, bus: 6, police: 5 },
    singapore: { sedan: 40, hatch: 12, taxi: 20, sports: 7, van: 8, truck: 4, bus: 8, police: 3, compact: 4 },
    japan: { sedan: 20, hatch: 16, kei: 30, taxi: 12, sports: 6, van: 10, truck: 4, bus: 5, police: 3 },
    london: { sedan: 30, hatch: 18, taxi: 18, sports: 5, van: 10, truck: 4, bus: 10, police: 4, compact: 5 },
    italy: { sedan: 18, hatch: 22, compact: 30, taxi: 8, sports: 9, van: 9, truck: 4, bus: 5, police: 3 },
    egypt: { sedan: 38, hatch: 14, taxi: 22, sports: 2, van: 10, pickup: 6, truck: 6, bus: 6, police: 3 },
    india: { sedan: 26, hatch: 20, kei: 8, taxi: 18, sports: 2, van: 10, truck: 10, bus: 9, police: 2 },
    mexico: { sedan: 34, hatch: 16, taxi: 12, sports: 4, van: 10, pickup: 12, truck: 10, bus: 4, police: 3 },
    western: { sedan: 30, hatch: 6, taxi: 3, sports: 5, van: 12, pickup: 26, truck: 24, bus: 2, police: 4 },
    swiss: { sedan: 36, hatch: 22, compact: 8, taxi: 6, sports: 10, van: 10, truck: 6, bus: 6, police: 2 },
    tibet: { sedan: 24, hatch: 10, taxi: 4, sports: 0, van: 18, pickup: 18, truck: 30, bus: 6, police: 0 },
    hw: { sedan: 40, hatch: 10, taxi: 4, sports: 10, van: 9, pickup: 8, truck: 16, bus: 3, police: 3 },
  };
  // Окраска такси и полиции по стилю региона: нью-йоркское жёлтое, лондонское чёрное, токийское и т.д.
  J.VLIVERY = {
    taxi: { usa: '#f2c21a', singapore: '#2f7ad8', japan: '#2c3a5a', london: '#17181b', italy: '#f4f4f4', egypt: '#17181b', india: '#2a2d33', mexico: '#3aa86b', western: '#f2c21a', swiss: '#14161a', tibet: '#c43a2a' },
    // [верх, низ дверей]
    police: { usa: ['#f4f4f4', '#14161a'], western: ['#f4f4f4', '#14161a'], japan: ['#f4f4f4', '#14161a'], london: ['#f4f4f4', '#1f6bd8'], italy: ['#1f3a6b', '#f4f4f4'], singapore: ['#f4f4f4', '#1f6bd8'], swiss: ['#f4f4f4', '#d81f26'], mexico: ['#f4f4f4', '#1f3a6b'] },
    bus: { london: '#c81e1e', usa: '#2f7ad8', japan: '#3aa86b', italy: '#f2a21a' },
  };
  J.vtypeOf = (id) => J.VTYPES[id] || J.VTYPES.sedan;
})();
