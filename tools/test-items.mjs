// Тест вещей в руках (Playwright, пошагово): подбор, выбор ячейки, удар ножом, бросок с прицелом и возврат ножа,
// нож в стене, бросок стендом (веер), ножи в остановленном времени, револьвер (барабан, перезарядка), бутылка-«розочка»,
// бутылка вдребезги, враг с битой, щелчок подшипником, Секс Пистолз, сохранение и загрузка панели.
// Арсенал: полуавтомат и очередь, перезарядка R, ружьё по патрону, снайперская в голову, дырки в стенах, машины и шины,
// прицел и оптика, колесо оружия, «Калибр», граната, Молотов, светошумовая, дым, стрелки и полиция, стенды против пуль, розыск.
// Запуск: node tools/test-items.mjs   (переменные: PW — путь к playwright, CHROME — к chromium, OUT — папка для снимков, ROOT — папка игры)
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
const PW = process.env.PW || '/opt/node22/lib/node_modules/playwright/index.mjs';
const { chromium } = await import(PW);
const ROOT = process.env.ROOT || path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = process.env.OUT || path.join(ROOT, '..', 'items-shots');
fs.mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({ executablePath: process.env.CHROME || '/opt/pw-browsers/chromium', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errs = [];
page.on('pageerror', (e) => errs.push('pageerror: ' + e.message + ' ' + (e.stack || '').split('\n').slice(1, 3).join(' ')));
page.on('console', (m) => { if (m.type() === 'error') errs.push('console: ' + m.text()); });
await page.goto('file://' + ROOT + '/index.html');
await page.waitForFunction(() => window.J && J.G.world && J.Game.state === 'title', null, { timeout: 120000 });
await page.evaluate(() => { J.UI.creator.origin = 'student'; J.UI.showCreator(); J.UI.finishCreator(); });
await page.waitForFunction(() => J.Game.state === 'play' && document.getElementById('loading').hidden, null, { timeout: 120000 });
await page.waitForTimeout(800);
await page.evaluate(() => {
  const p = J.G.player;
  J.P.giveStand(p, 'star_platinum', 'x', true);
  p.stand.lvl = 7; J.P.recalc(p); p.se = p.seMax = 999; p.maxHp = p.hp = 600;
  J.G.time = Math.floor(J.G.time / 1440) * 1440 + 720;
  J.Game.loop = function () {};
  const R3 = J.R3, realRender = R3.render;
  window._step = (sec, dt = 1 / 60) => {
    R3.render = () => {};
    const n = Math.max(1, Math.round(sec / dt));
    for (let i = 0; i < n - 1; i++) J.Game.update(dt);
    R3.render = realRender;
    J.Game.update(dt);
  };
  // без рисования (циклы проверок)
  window._sim = (sec, dt = 1 / 60) => {
    R3.render = () => {};
    const n = Math.max(1, Math.round(sec / dt));
    for (let i = 0; i < n; i++) J.Game.update(dt);
    R3.render = realRender;
  };
  const w = J.G.world;
  // открытое место в городе: 12 м во все стороны без стен и воды (для стрельбы — прямая видимость)
  const open = () => {
    const clear = (x, y, R) => { for (let dx = -R; dx <= R; dx++) for (let dy = -R; dy <= R; dy++) if (w.solid(x + dx, y + dy) || w.isWater(x + dx, y + dy)) return false; return true; };
    for (const [R, S] of [[12, 240], [12, 600], [9, 600], [7, 600]]) {
      for (let k = 0; k < 30000; k++) {
        const x = p.x + (Math.random() - 0.5) * S, y = p.y + (Math.random() - 0.5) * S;
        if (w.cityAt(x, y) && clear(x, y, R)) return { x: Math.floor(x) + 0.5, y: Math.floor(y) + 0.5 };
      }
    }
    return null;
  };
  const q = open();
  if (q) { p.x = q.x; p.y = q.y; }
  window._home = { x: p.x, y: p.y };
  window._clear = () => {
    const g = J.G;
    for (let k = 0; k < 30; k++) {
      if (J.UI.revealOpen) { J.UI.revealT = 0; J.UI.closeReveal(); } else if (J.UI.bannerOpen) { J.UI.bannerT = 0; J.UI.closeBanner(); } else if (J.UI.dlg) J.UI.dialogNext(); else break;
    }
    for (const e of g.ents) if (e !== p) { J.R3.dropView(e); e.despawn = true; }
    g.ents = g.ents.filter((e) => !e.despawn);
    g.projs.forEach((pr) => J.R3.dropProj(pr)); g.projs = [];
    g.timestop = null; g.timeskip = null; g.clash = null; g.timers = [];
    J.Hand.reset();
    Object.assign(p, { channel: null, atk: null, anim: null, react: null, guard: false, chg: null, dash: null, airborne: false, z: 0, kx: 0, ky: 0, st: {}, cds: {}, stamina: 100, dead: false, gm: 100, thrAim: null, eat: null, reloadT: 0 });
    p.hp = p.maxHp; p.se = 999; p.tsMove = 0;
    p.x = window._home.x; p.y = window._home.y;
    p.inv = {}; p.hotbar = Array(6).fill(null); p.hsel = -1; p.dur = {}; p.mag = {};
    p.wanted = 0; p.ads = false; p.trigUp = true; p.bloom = 0;
    J.Input.mouse.l = J.Input.mouse.r = false;
    // машины (погоня полиции, подстреленные) не мешают линии огня
    for (const v of g.vehs.slice()) J.Veh.remove(v);
    J.Veh._copT = 30;
    J.Input.keys = {};
    J.Fx.reset();
    p.standOut = false;
    const c = J.R3.cam; c.yaw = -Math.PI / 2; c.pitch = 0.22; c.dist = 5; c.idle = 9;
  };
  // враг впереди по взгляду камеры (смещение da — чтобы видеть сбоку)
  window._foe = (kind, dist, o = {}) => {
    const c = J.R3.cam;
    const a = c.yaw + (o.da || 0);
    const x = p.x + Math.cos(a) * dist, y = p.y + Math.sin(a) * dist;
    const e = J.MOBS[kind] ? J.makeMob(kind, x, y, o.lvl || 3) : J.makeStandUser(x, y, o.lvl || 6, kind);
    J.addEnt(e);
    if (o.hand !== undefined) e.hand = o.hand;
    if (o.noai) e.ai = null;
    if (o.hp) e.maxHp = e.hp = o.hp;
    e.face = a + Math.PI; p.face = a;
    return e;
  };
  // сменить стенд (без окна «Стенд пробудился»)
  window._stand = (id, lvl = 7) => {
    J.P.giveStand(p, id, 'x', true);
    for (let k = 0; k < 10; k++) { if (J.UI.revealOpen) { J.UI.revealT = 0; J.UI.closeReveal(); } else if (J.UI.bannerOpen) { J.UI.bannerT = 0; J.UI.closeBanner(); } else if (J.UI.dlg) J.UI.dialogNext(); else break; }
    p.stand.lvl = lvl; J.P.recalc(p); p.se = 999;
  };
  window._give = (id, n = 1, sel = true) => {
    J.P.addItem(p, id, n, null, true);
    if (!J.Hand.handable(id)) return -1;
    const s = J.Hand.autoAssign(p, id);
    if (sel) { p.hsel = -1; J.Hand.select(p, s); }
    return s;
  };
});
const ev = (f, a) => page.evaluate(f, a);
// снимок: камера встаёт на место (без шага симуляции)
const shot = async (n) => {
  await ev(() => { const p = J.G.player; for (let i = 0; i < 4; i++) J.R3.updateCamera(p.x, p.y, J.G.world.groundY(p.x, p.y) + (p.z || 0), 0.5, { mode: 'foot', heading: p.face, moving: false }); J.UI.update(0.016); J.R3.render(); });
  await page.screenshot({ path: path.join(OUT, n + '.png') });
};
const results = [];
const check = (name, ok, info) => { results.push({ name, ok: !!ok }); console.log((ok ? 'OK   ' : 'FAIL ') + name + (info !== undefined ? '  ' + JSON.stringify(info) : '')); };

// 0. Панель на экране
check('панель быстрого доступа в HUD', await ev(() => document.querySelectorAll('#hotbar .hs').length === 6));

// 1. Подбор ножа с земли по F, нож сразу в руке и виден в кисти
{
  const r = await ev(() => {
    window._clear();
    const p = J.G.player;
    const gi = J.Hand.spawnGround(p.x + 0.6, p.y, 'kitchen_knife', 1);
    window._step(0.2);
    const tgt = J.Game.interactTarget();
    const prompt = document.getElementById('prompt').textContent;
    J.Game.interact();
    window._step(0.3);
    return { tgt: !!(tgt && tgt.item === gi), prompt, inv: p.inv.kitchen_knife || 0, held: J.Hand.heldId(p), mesh: !!(p.view && p.view.heldMesh), ground: J.Hand.GROUND.indexOf(gi) >= 0 ? 1 : 0 };
  });
  check('подбор: F подбирает нож, он в руке', r.tgt && r.inv === 1 && r.held === 'kitchen_knife' && r.mesh && r.ground === 0, r);
  check('подсказка «Подобрать»', /Подобрать/.test(r.prompt), r.prompt);
  await ev(() => { const c = J.R3.cam; c.yaw = -Math.PI / 2 + 1.9; c.pitch = 0.12; c.dist = 2.6; window._step(0.6); });
  await shot('i01_knife_held');
}

// 2. Клавиши: 0 — убрать, 4 — снова в руку
{
  const r = await ev(() => {
    const p = J.G.player;
    J.Game.onKey('Digit0');
    const a = J.Hand.heldId(p);
    J.Game.onKey('Digit4');
    const b = J.Hand.heldId(p);
    J.Hand.wheel({ deltaY: 1 });
    const c = J.Hand.heldId(p);
    J.Hand.wheel({ deltaY: -1 });
    return { a, b, c, d: J.Hand.heldId(p) };
  });
  check('клавиши 0/4 и колёсико', r.a === null && r.b === 'kitchen_knife' && r.c === null && r.d === 'kitchen_knife', r);
}

// 3. Удар ножом: урон, кровотечение, износ
{
  const r = await ev(() => {
    const p = J.G.player;
    const f = window._f = window._foe('thug', 1.3, { noai: true, hp: 900, hand: null });
    window._step(0.2);
    const d0 = J.Hand.durOf(p, 'kitchen_knife');
    let hits = 0;
    for (let i = 0; i < 3; i++) {
      p.cds.item = 0;
      const hp0 = f.hp;
      J.P.basicAttack(p);
      window._step(0.5);
      if (f.hp < hp0) hits++;
    }
    return { hits, bleed: f.st.bleed || 0, dur0: d0, dur1: J.Hand.durOf(p, 'kitchen_knife') };
  });
  check('нож: 3 удара попадают', r.hits === 3, r);
  check('нож: кровотечение и износ', r.bleed > 0 && r.dur1 < r.dur0, r);
  await ev(() => { const p = J.G.player; p.cds.item = 0; J.P.basicAttack(p); window._step(0.14); const c = J.R3.cam; c.yaw = -Math.PI / 2 + 1.5; c.dist = 4; });
  await shot('i02_knife_stab');
}

// 4. Прицельный бросок метательного ножа (B): дуга, попадание, нож торчит и выпадает, возврат подбором
{
  const r = await ev(() => {
    window._clear();
    const p = J.G.player;
    window._give('throw_knife', 5);
    const f = window._f = window._foe('thug', 7, { noai: true, hp: 900, da: 0.15 });
    window._step(0.3);
    J.Game.onKey('KeyB');
    window._step(0.5);
    return { aim: !!p.thrAim };
  });
  await ev(() => { const c = J.R3.cam; c.pitch = 0.3; c.dist = 5.5; window._step(0.05); });
  await shot('i03_throw_aim_arc');
  const r2 = await ev(() => {
    const p = J.G.player, f = window._f;
    const hp0 = f.hp;
    J.Game.onKeyUp('KeyB');
    const flying = J.Hand.FLY.length;
    let hit = false;
    const tr = [];
    for (let i = 0; i < 60 && !hit; i++) { window._sim(1 / 30); hit = f.hp < hp0; const o = J.Hand.FLY[0]; if (o && i % 3 === 0) tr.push([+o.x.toFixed(1) - +f.x.toFixed(1), +o.y.toFixed(1) - +f.y.toFixed(1), +(o.h - J.G.world.groundY(o.x, o.y)).toFixed(2)]); }
    const stuck = J.Hand.FLY.some((o) => o.stuckTo === f);
    return { flying, hit, stuck, left: p.inv.throw_knife || 0, tr: hit ? undefined : tr };
  });
  check('бросок B: нож летит и попадает', r.aim && r2.flying === 1 && r2.hit && r2.left === 4, Object.assign(r, r2));
  await ev(() => { const c = J.R3.cam; c.yaw += 0.9; c.dist = 3.4; window._step(0.05); });
  await shot('i04_knife_stuck_in_foe');
  const r3 = await ev(() => {
    const p = J.G.player, f = window._f;
    window._sim(4.2);
    const gi = J.Hand.GROUND.find((g) => g.item === 'throw_knife');
    if (!gi) return { ground: false };
    p.x = gi.x - 0.5; p.y = gi.y;
    window._step(0.1);
    J.Game.interact();
    return { ground: true, back: p.inv.throw_knife || 0 };
  });
  check('нож выпадает на землю и подбирается обратно', r3.ground && r3.back === 5, r3);
}

// 5. Нож в стене
{
  const r = await ev(() => {
    window._clear();
    const p = J.G.player, w = J.G.world;
    for (let k = 0; k < 4000; k++) {
      const q = w.randomWalkable(p.x, p.y, 80, J.R, {});
      if (!q) continue;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        let ok = true;
        for (let s = -2; s <= 3; s += 0.5) if (w.solid(q.x + dx * s, q.y + dy * s)) ok = false;
        if (!ok || !w.solid(q.x + dx * 4.5, q.y + dy * 4.5) || w.isWater(q.x + dx * 4.5, q.y + dy * 4.5)) continue;
        p.x = q.x; p.y = q.y;
        J.R3.updateChunks(p.x, p.y, true);
        const c = J.R3.cam; c.yaw = Math.atan2(dy, dx); c.pitch = 0.2; c.dist = 4;
        window._give('throw_knife', 3);
        window._step(0.3);
        c.yaw = Math.atan2(dy, dx); c.pitch = 0.22;
        J.Hand.throwFrom(p, 1);
        window._sim(1.2);
        const gi = J.Hand.GROUND.find((g) => g.item === 'throw_knife');
        c.yaw = Math.atan2(dy, dx) + 0.9; c.dist = 3;
        return { stuck: !!(gi && gi.stuck), h: gi ? +(gi.h - w.groundY(gi.x, gi.y)).toFixed(2) : null, any: !!gi };
      }
    }
    return { none: true };
  });
  check('нож втыкается в стену', r.stuck && r.h > 0.5, r);
  await ev(() => window._step(0.05));
  await shot('i05_knife_in_wall');
}

// 6. Отдать стенду (Звёздная Платина): веер ножей
{
  const r = await ev(() => {
    window._clear();
    const p = J.G.player;
    window._give('throw_knife', 6);
    const f = window._f = window._foe('thug', 7, { noai: true, hp: 2000, da: 0.2 });
    window._step(0.3);
    const hp0 = f.hp;
    J.Game.onKey('KeyN');
    window._step(0.22);
    const fly = J.Hand.FLY.length;
    return { fly, left: p.inv.throw_knife || 0, hp0 };
  });
  await ev(() => { const c = J.R3.cam; c.yaw += 0.7; c.dist = 5; window._step(0.03); });
  await shot('i06_stand_knife_fan');
  const r2 = await ev((hp0) => { window._sim(1.0); return { hit: window._f.hp < hp0, dmg: Math.round(hp0 - window._f.hp) }; }, r.hp0);
  check('стенд метает веер ножей', r.fly >= 3 && r.left === 6 - r.fly && r2.hit, Object.assign(r, r2));
}

// 7. Щелчок подшипником (Звёздная Платина)
{
  const r = await ev(() => {
    window._clear();
    const p = J.G.player;
    window._give('ball_bearings', 10);
    const f = window._f = window._foe('thug', 8, { noai: true, hp: 2000 });
    window._step(0.3);
    const hp0 = f.hp;
    J.Hand.give(p);
    window._step(0.8);
    return { hit: f.hp < hp0, dmg: Math.round(hp0 - f.hp), left: p.inv.ball_bearings };
  });
  check('Звёздная Платина щелчком пускает подшипник как пулю', r.hit && r.left === 9, r);
}

// 8. Слабый стенд не может метать
{
  const r = await ev(() => {
    window._clear();
    const p = J.G.player;
    const keep = p.stand;
    window._stand('harvest');
    window._give('throw_knife', 3);
    const ok = J.Hand.give(p);
    const cap = J.Hand.standCap(p);
    window._stand(keep.id);
    return { ok, cap, left: p.inv.throw_knife };
  });
  check('слабый стенд не метает', !r.ok && !r.cap && r.left === 3, r);
}

// 9. Остановка времени (Мир): ножи зависают перед целью, срываются, когда время идёт
{
  const r = await ev(() => {
    window._clear();
    const p = J.G.player;
    window._stand('the_world');
    window._give('throw_knife', 8);
    const f = window._f = window._foe('thug', 7, { noai: true, hp: 3000, da: 0.2 });
    window._step(0.3);
    J.G.timestop = { by: p, t: 4, max: 4, intro: 0 };
    J.Fx.timestopIntro && J.Fx.timestopIntro(p, 4);
    window._sim(1.0);
    const hp0 = f.hp;
    J.Hand.give(p);
    window._sim(1.2);
    const held = J.Hand.FLY.filter((o) => o.held);
    const pos0 = held.map((o) => o.x + ',' + o.y);
    window._step(0.5);
    const still = held.every((o, i) => o.x + ',' + o.y === pos0[i]);
    const dists = held.map((o) => +J.dist(o.x, o.y, f.x, f.y).toFixed(2));
    return { n: held.length, still, dists, hpSame: f.hp === hp0, hp0 };
  });
  await ev(() => { const c = J.R3.cam; c.yaw += 0.8; c.dist = 5; c.pitch = 0.2; window._step(0.03); });
  await shot('i07_timestop_knives_frozen');
  const r2 = await ev((hp0) => {
    J.G.timestop.t = 0.01;
    window._sim(1.5);
    return { hit: window._f.hp < hp0, dmg: Math.round(hp0 - window._f.hp), fly: J.Hand.FLY.filter((o) => !o.stuckTo).length };
  }, r.hp0);
  check('остановка времени: ножи зависают перед целью', r.n >= 3 && r.still && r.hpSame && r.dists.every((d) => d < 2.6), r);
  check('время пошло: ножи попадают', r2.hit, r2);
  await ev(() => window._stand('star_platinum'));
}

// 10. Револьвер: шесть выстрелов, перезарядка из патронов
{
  const r = await ev(() => {
    window._clear();
    const p = J.G.player;
    window._give('bullets', 9, false);
    window._give('revolver', 1);
    const f = window._f = window._foe('thug', 8, { noai: true, hp: 3000, da: 0.1 });
    window._step(0.3);
    const hp0 = f.hp;
    let shots = 0;
    for (let i = 0; i < 6; i++) { p.cds.item = 0; p.trigUp = true; if (J.Hand.fire(p)) shots++; window._step(0.05); }
    const mag0 = J.Hand.magOf(p, 'revolver');
    return { shots, mag0, hit: f.hp < hp0, hp0 };
  });
  await ev(() => { const p = J.G.player; p.cds.item = 0; p.trigUp = true; J.Hand.magOf(p, 'revolver'); p.mag.revolver = 1; J.Hand.fire(p); window._step(0.03); const c = J.R3.cam; c.yaw += 1.2; c.dist = 3.6; c.pitch = 0.15; });
  await shot('i08_revolver_fire');
  const r2 = await ev(() => {
    const p = J.G.player;
    window._sim(2.2);
    const mag = J.Hand.magOf(p, 'revolver');
    return { mag, bullets: p.inv.bullets || 0 };
  });
  check('револьвер: 6 выстрелов, барабан пуст, попадания', r.shots === 6 && r.mag0 === 0 && r.hit, r);
  check('перезарядка из патронов', r2.mag === 6 && r2.bullets === 3, r2);
}

// 11. Бутылка: удар — «розочка», брошенная — вдребезги
{
  const r = await ev(() => {
    window._clear();
    const p = J.G.player;
    window._give('bottle', 2);
    const f = window._f = window._foe('thug', 1.3, { noai: true, hp: 900 });
    window._step(0.2);
    p.cds.item = 0;
    J.P.basicAttack(p);
    window._step(0.6);
    return { held: J.Hand.heldId(p), bottles: p.inv.bottle || 0, broken: p.inv.broken_bottle || 0 };
  });
  check('бутылка разбивается о голову и становится «розочкой»', r.held === 'broken_bottle' && r.bottles === 1 && r.broken === 1, r);
  await shot('i09_broken_bottle');
  const r2 = await ev(() => {
    const p = J.G.player;
    J.Hand.select(p, J.Hand.slotOf(p, 'bottle'));
    window._f.x += Math.cos(J.R3.cam.yaw) * 5; window._f.y += Math.sin(J.R3.cam.yaw) * 5;
    const hp0 = window._f.hp;
    window._step(0.1);
    for (const g of J.Hand.GROUND.slice()) if (g.loot) g.life = 0;
    window._sim(0.02);
    J.Hand.throwFrom(p, 1);
    window._sim(1.5);
    return { left: p.inv.bottle || 0, ground: J.Hand.GROUND.filter((g) => g.item === 'bottle' && !g.loot).length, fly: J.Hand.FLY.length, hit: window._f.hp < hp0 };
  });
  check('брошенная бутылка разбивается вдребезги', r2.left === 0 && r2.ground === 0 && r2.fly === 0, r2);
}

// 12. Еда из руки: анимация еды и эффект
{
  const r = await ev(() => {
    window._clear();
    const p = J.G.player;
    p.hunger = 30;
    window._give('burger', 1);
    J.P.basicAttack(p);
    window._step(0.6);
    const eating = !!p.eat;
    return { eating };
  });
  await ev(() => { const c = J.R3.cam; c.yaw += 2.4; c.dist = 2.4; c.pitch = 0.1; window._step(0.02); });
  await shot('i10_eat_burger');
  const r2 = await ev(() => { window._step(1.3); const p = J.G.player; return { hunger: p.hunger, left: p.inv.burger || 0 }; });
  check('еда из руки: ест и насыщается', r.eating && r2.hunger > 30 && r2.left === 0, Object.assign(r, r2));
}

// 13. Враг с битой бьёт игрока; убитый роняет оружие
{
  const r = await ev(() => {
    window._clear();
    const p = J.G.player;
    p.standOut = false;
    const f = window._f = window._foe('thug', 2.0, { hp: 200, hand: 'bat', da: 0.6 });
    const hp0 = p.hp;
    let hitBat = false;
    for (let i = 0; i < 300 && !hitBat; i++) {
      window._sim(1 / 30);
      if (p.hp < hp0) hitBat = true;
    }
    return { hitBat, mesh: !!(f.view && f.view.heldMesh), model: f.view && f.view.heldModel };
  });
  await shot('i11_thug_bat');
  check('враг с битой: бита в руке и бьёт', r.hitBat && r.mesh && r.model === 'bat', r);
  const r2 = await ev(() => { J.hurt(window._f, 99999, J.G.player, { pierceDef: true }); window._step(0.3); return { drop: J.Hand.GROUND.some((g) => g.item === 'bat') }; });
  check('убитый враг роняет оружие', r2.drop, r2);
}

// 14. Секс Пистолз: пули под пинками
{
  const r = await ev(() => {
    window._clear();
    const p = J.G.player;
    window._stand('sex_pistols', 6);
    window._give('revolver', 1);
    const f = window._f = window._foe('thug', 9, { noai: true, hp: 3000, da: 0.5 });
    window._step(0.3);
    const hp0 = f.hp;
    const ok = J.Hand.give(p);
    window._sim(1.6);
    const res = { ok, hit: f.hp < hp0, mag: J.Hand.magOf(p, 'revolver') };
    window._stand('star_platinum');
    return res;
  });
  check('Секс Пистолз: залп пуль с пинками', r.ok && r.hit && r.mag === 0, r);
}

// 15. Тяжёлая труба: замах медленнее ножа; выбросить (Y) — лежит на земле
{
  const r = await ev(() => {
    window._clear();
    const p = J.G.player;
    window._give('kitchen_knife', 1);
    window._give('pipe', 1);
    const f = window._f = window._foe('thug', 1.4, { noai: true, hp: 900 });
    window._step(0.2);
    p.cds.item = 0; J.P.basicAttack(p); const dPipe = p.atk ? p.atk.dur : 0;
    window._step(1.2);
    J.Hand.select(p, J.Hand.slotOf(p, 'kitchen_knife'));
    p.cds.item = 0; J.P.basicAttack(p); const dKnife = p.atk ? p.atk.dur : 0;
    window._step(1.0);
    J.Hand.select(p, J.Hand.slotOf(p, 'pipe'));
    J.Game.onKey('KeyY');
    return { dPipe, dKnife, inv: p.inv.pipe || 0, ground: J.Hand.GROUND.some((g) => g.item === 'pipe') };
  });
  check('вес: труба медленнее ножа', r.dPipe > r.dKnife * 1.1, r);
  check('Y — выбросить: труба лежит на земле', r.inv === 0 && r.ground, r);
  await ev(() => { const c = J.R3.cam; c.dist = 3; c.pitch = 0.4; window._step(0.03); });
  await shot('i12_dropped_pipe');
}

// 16. Галерея: каждая вещь в руке (снимки)
{
  const ids = ['bat', 'road_sign', 'revolver', 'bottle', 'brick', 'switchblade'];
  await ev(() => { window._clear(); });
  for (const id of ids) {
    await ev((id) => { const p = J.G.player; p.inv = {}; p.hotbar = Array(6).fill(null); window._give(id, 1); window._step(0.4); const c = J.R3.cam; c.yaw = -Math.PI / 2 + 2.0; c.pitch = 0.1; c.dist = 2.6; window._step(0.3); }, id);
    await shot('i13_hold_' + id);
  }
}

// 17. Магазин: ножи и патроны продаются; упаковка распаковывается
{
  const r = await ev(() => {
    window._clear();
    const p = J.G.player;
    J.P.addItem(p, 'ammo_box', 1);
    J.P.addItem(p, 'knife_set', 1);
    return { bullets: p.inv.bullets || 0, knives: p.inv.throw_knife || 0, box: p.inv.ammo_box || 0, shop: J.SHOPS.black_market.includes('ammo_box') && J.SHOPS.shop.includes('kitchen_knife') };
  });
  check('упаковки: 12 патронов и 5 ножей', r.bullets === 12 && r.knives === 5 && !r.box && r.shop, r);
}

// 18. Инвентарь: панель ячеек и кнопки «В руку»
{
  await ev(() => { window._clear(); const p = J.G.player; J.P.addItem(p, 'bat', 1); J.P.addItem(p, 'sandwich', 2); J.P.addItem(p, 'bottle', 3); J.UI.openPanel('inv'); });
  const r = await ev(() => ({ slots: document.querySelectorAll('.hbedit [data-hslot]').length, inHand: [...document.querySelectorAll('[data-use]')].some((b) => b.textContent === 'В руку'), icons: document.querySelectorAll('.item .iico').length }));
  await shot('i14_inventory');
  await ev(() => J.UI.closePanel());
  check('инвентарь: ячейки, «В руку», иконки', r.slots === 6 && r.inHand && r.icons >= 3, r);
}


// 20. Вещи на улицах: бутылки у баров, трубы и кирпичи у доков, ножи у ресторанов
{
  const r = await ev(() => {
    window._clear();
    const p = J.G.player, w = J.G.world;
    const types = {};
    let gi = null;
    // обойти несколько улиц города
    for (let k = 0; k < 8; k++) {
      const q = w.randomWalkable(window._home.x, window._home.y, 60, J.R, { street: true });
      if (!q) continue;
      p.x = q.x; p.y = q.y;
      window._sim(1.0);
      for (const g of J.Hand.GROUND) if (g.loot) types[g.item] = (types[g.item] || 0) + 1;
    }
    gi = J.Hand.GROUND.find((g) => g.loot);
    if (gi) {
      const a = Math.atan2(gi.y - p.y, gi.x - p.x);
      p.x = gi.x - 1.2; p.y = gi.y; p.face = 0;
      J.R3.updateChunks(p.x, p.y, true);
      const c = J.R3.cam; c.yaw = 0.5; c.pitch = 0.45; c.dist = 3;
      window._sim(0.2);
    }
    return { types, n: J.Hand.GROUND.filter((g) => g.loot).length, item: gi && gi.item };
  });
  check('на улицах города лежат вещи', r.n > 0 || Object.keys(r.types).length > 0, r);
  await shot('i16_street_loot');
}

// 21. Полиция замечает оружие в руке
{
  const r = await ev(() => {
    window._clear();
    const p = J.G.player;
    p.wanted = 0;
    const cop = window._foe('guard', 6, { noai: true, da: 0.8 });
    cop.cop = true; cop.team = 'neutral'; cop.kind = 'civ';
    window._give('pipe', 1);
    window._sim(1.6);
    const warned = p.copSeen || 0;
    window._sim(5.5);
    const w1 = p.wanted || 0;
    J.Game.onKey('Digit0');
    return { warned, wanted: w1 };
  });
  check('полиция: предупреждение и розыск за оружие на виду', r.warned >= 1 && r.wanted > 0, r);
}


// ---------- 22. Арсенал ----------
// точка прицела по заказу (вместо центра экрана)
await ev(() => {
  const ap0 = J.Guns.aimPoint;
  window._aimAt = (x, h, z, tg) => { J.Guns.aimPoint = () => ({ px: x, ph: h, pz: z, tg: tg || null, free: true }); };
  window._aimOff = () => { J.Guns.aimPoint = ap0; };
  // открытая площадка в городе (для перестрелок: прямая видимость)
  window._plaza = () => {
    const p = J.G.player, w = J.G.world;
    const ok = (x, y, R) => { for (let dx = -R; dx <= R; dx++) for (let dy = -R; dy <= R; dy++) if (w.solid(x + dx, y + dy) || w.isWater(x + dx, y + dy)) return false; return true; };
    for (const [R, S] of [[12, 240], [12, 600], [9, 600]]) {
      for (let k = 0; k < 30000; k++) {
        const x = window._home.x + (Math.random() - 0.5) * S, y = window._home.y + (Math.random() - 0.5) * S;
        if (w.cityAt(x, y) && ok(x, y, R)) { p.x = Math.floor(x) + 0.5; p.y = Math.floor(y) + 0.5; J.R3.updateChunks(p.x, p.y, true); return true; }
      }
    }
    return false;
  };
});
// 22.1 Пистолет: полуавтомат (по нажатию), вспышка, трассер, гильза
{
  const r = await ev(() => {
    window._clear();
    const p = J.G.player;
    window._give('ammo_9mm', 30, false);
    window._give('pistol', 1);
    const f = window._foe('thug', 8, { noai: true, hp: 3000 });
    window._step(0.3);
    const hp0 = f.hp;
    p.cds.item = 0; p.trigUp = true;
    const a = J.Hand.fire(p);
    const P0 = J.Guns.pools();
    const fx = { tr: P0.TR.some((t) => t.on), cs: P0.CS.some((c) => c.on), fl: P0.fl.some((q) => q.t > 0) };
    p.cds.item = 0;
    const b = J.Hand.fire(p); // курок не отпущен
    p.trigUp = true;
    const c = J.Hand.fire(p);
    window._step(0.1);
    return { a, b, c, fx, mag: J.Hand.magOf(p, 'pistol'), hit: f.hp < hp0 };
  });
  check('пистолет: полуавтомат, магазин 15', r.a && !r.b && r.c && r.mag === 13 && r.hit, r);
  check('пистолет: вспышка, трассер, гильза', r.fx.tr && r.fx.cs && r.fx.fl, r.fx);
}
// 22.2 Автомат: очередь, пока зажата ЛКМ; разброс растёт; R — перезарядка, магазин падает
{
  const r = await ev(() => {
    window._clear();
    const p = J.G.player;
    window._give('ammo_rifle', 90, false);
    window._give('assault_rifle', 1);
    const f = window._foe('thug', 10, { noai: true, hp: 5000 });
    window._step(0.3);
    const hp0 = f.hp;
    J.Input.mouse.l = true;
    let bloom = 0;
    for (let i = 0; i < 60; i++) { window._sim(1 / 60); bloom = Math.max(bloom, p.bloom || 0); }
    const spread = J.Guns.spread(p, J.Hand.def('assault_rifle'));
    J.Input.mouse.l = false;
    window._sim(0.1);
    const mag = J.Hand.magOf(p, 'assault_rifle');
    J.Game.onKey('KeyR');
    const rel = p.reloadT > 0;
    const mg = J.Guns.pools().MG.some((m) => m.on);
    window._sim(2.5);
    return { mag, bloom: +bloom.toFixed(3), spread: +spread.toFixed(3), hit: f.hp < hp0, rel, mg, after: J.Hand.magOf(p, 'assault_rifle'), ammo: p.inv.ammo_rifle };
  });
  check('автомат: очередь при зажатой ЛКМ, разброс растёт', r.mag <= 22 && r.mag >= 18 && r.bloom > 0.05 && r.spread > 0.08 && r.hit, r);
  check('перезарядка R: магазин падает, 30 из запаса', r.rel && r.mg && r.after === 30 && r.ammo === 90 - (30 - r.mag), r);
  await shot('g01_rifle_burst');
}
// 22.3 Помповое ружьё: дробь, по патрону; выстрел прерывает дозарядку
{
  const r = await ev(() => {
    window._clear();
    const p = J.G.player;
    window._give('ammo_12g', 10, false);
    window._give('pump_shotgun', 1);
    const f = window._foe('thug', 5, { noai: true, hp: 3000 });
    window._step(0.3);
    const hp0 = f.hp;
    let hits = 0;
    const h0 = J.hurt;
    J.hurt = function (t) { if (t === f) hits++; return h0.apply(this, arguments); };
    p.cds.item = 0; p.trigUp = true;
    J.Hand.fire(p);
    J.hurt = h0;
    window._sim(1.0);
    p.mag.pump_shotgun = 2;
    J.Game.onKey('KeyR');
    window._sim(0.6);
    const m1 = J.Hand.magOf(p, 'pump_shotgun');
    p.cds.item = 0; p.trigUp = true;
    const shotOk = J.Hand.fire(p);
    return { hits, dmg: Math.round(hp0 - f.hp), m1, shotOk, rel: p.reloadT, m2: J.Hand.magOf(p, 'pump_shotgun') };
  });
  check('ружьё: несколько дробин попадают', r.hits >= 4, r);
  check('ружьё: заряжается по патрону, выстрел прерывает', r.m1 === 3 && r.shotOk && !(r.rel > 0) && r.m2 === 2, r);
}
// 22.4 Снайперская: в голову — многократный урон
{
  const r = await ev(() => {
    window._clear();
    const p = J.G.player;
    window._give('ammo_308', 10, false);
    window._give('sniper', 1);
    const f = window._foe('thug', 11, { noai: true, hp: 3000 });
    window._step(0.3);
    p.ads = true;
    window._step(0.3);
    const g = J.G.world.groundY(f.x, f.y);
    window._aimAt(f.x, g + 1.66, f.y, f);
    const hp0 = f.hp;
    p.cds.item = 0; p.trigUp = true;
    J.Hand.fire(p);
    window._aimOff();
    const head = hp0 - f.hp;
    return { head: Math.round(head), scope: document.getElementById('scope').style.display !== 'none' };
  });
  await shot('g02_sniper_scope');
  const r2 = await ev(() => { const p = J.G.player; return { fov: J.R3.camera.fov, scope: document.getElementById('scope').style.display !== 'none', scoped: document.body.classList.contains('scoped') }; });
  check('снайперская: выстрел в голову (×3,5)', r.head > 115 * 3, r);
  check('оптика: приближение и прицельная сетка', r2.fov < 20 && r2.scope && r2.scoped, r2);
  await ev(() => { J.G.player.ads = false; window._step(0.5); });
}
// 22.5 Дырки от пуль в стене; машина: урон, дырки и пробитая шина
{
  const r = await ev(() => {
    window._clear();
    const p = J.G.player, w = J.G.world;
    window._give('ammo_9mm', 60, false);
    window._give('pistol', 1);
    window._step(0.2);
    // ближняя стена
    let wall = null;
    for (let i = 0; i < 32 && !wall; i++) {
      const a = (i / 32) * Math.PI * 2;
      const h = w.groundY(p.x, p.y) + 1.4;
      const t = J.Guns.trace(p.x, h, p.y, Math.cos(a), 0, Math.sin(a), 40, p);
      if (t.kind === 'wall' && t.d < 25 && t.d > 3) wall = { x: t.x, h: t.h, z: t.z };
    }
    const P0 = J.Guns.pools();
    const n0 = P0.HO.filter((o) => o.on && !o.veh).length;
    if (wall) { window._aimAt(wall.x, wall.h, wall.z); p.ads = true; for (let i = 0; i < 3; i++) { p.cds.item = 0; p.trigUp = true; p.bloom = 0; J.Hand.fire(p); } p.ads = false; }
    const n1 = P0.HO.filter((o) => o.on && !o.veh).length;
    // машина боком к игроку
    const c = J.R3.cam;
    const vx = p.x + Math.cos(c.yaw) * 7, vy = p.y + Math.sin(c.yaw) * 7;
    const v = J.Veh.make('sedan', vx, vy, c.yaw + Math.PI / 2, { mode: 'parked' });
    window._step(0.1);
    window._aimAt(v.x, v.gy + 0.8, v.y);
    for (let i = 0; i < 3; i++) { p.cds.item = 0; p.trigUp = true; J.Hand.fire(p); }
    const hpV = v.hp;
    // переднее колесо со стороны игрока
    const ca = Math.cos(v.ang), sa = Math.sin(v.ang), lx = v.vt.L / 2 - 0.78;
    let best = null;
    for (const s of [1, -1]) {
      const ly = s * v.vt.W / 2;
      const x = v.x + lx * ca - ly * sa, y = v.y + lx * sa + ly * ca;
      if (!best || J.dist(x, y, p.x, p.y) < J.dist(best.x, best.y, p.x, p.y)) best = { x, y };
    }
    window._aimAt(best.x, v.gy + 0.32, best.y);
    p.bloom = 0; p.ads = true; // прицельно, без накопленного разброса
    p.cds.item = 0; p.trigUp = true; J.Hand.fire(p);
    p.ads = false;
    window._aimOff();
    window._step(0.1);
    window._v = v;
    return { wall: !!wall, holes: n1 - n0, hpV, max: v.maxHp, vholes: P0.HO.filter((o) => o.on && o.veh === v).length, flat: v.flatMask || 0 };
  });
  check('дырки от пуль на стене', r.wall && r.holes >= 2, r);
  check('машина: урон от пуль, дырки, пробитая шина', r.hpV < r.max && r.vholes >= 1 && r.flat > 0, r);
  await ev(() => { const c = J.R3.cam; c.yaw += 0.5; c.dist = 4; window._step(0.03); });
  await shot('g03_car_holes_flat');
  await ev(() => { J.Veh.remove ? J.Veh.remove(window._v) : 0; });
}
// 22.6 Колесо оружия (Tab): раздел мышью, отпустить — взять; «Калибр»: покупка ствола с патронами
{
  const r = await ev(() => {
    window._clear();
    const p = J.G.player, w = J.G.world;
    p.money = 40000;
    const b = w.buildings.find((q) => q.type === 'gunshop' && q.region === w.regionAt(p.x, p.y).id) || w.buildings.find((q) => q.type === 'gunshop');
    J.UI.openBuilding(b);
    const tabs = document.querySelectorAll('#bbody [data-tab]').length;
    document.querySelector('#bbody [data-tab="2"]').click();
    document.querySelector('#bbody [data-buy="carbine"]').click();
    document.querySelector('#bbody [data-tab="0"]').click();
    document.querySelector('#bbody [data-buy="heavy_pistol"]').click();
    document.querySelector('#bbody [data-tab="5"]').click();
    document.querySelector('#bbody [data-buy="grenade"]').click();
    const bought = { carbine: p.inv.carbine || 0, ammo: p.inv.ammo_rifle || 0, mag: p.mag.carbine, hp: p.inv.heavy_pistol || 0, nade: p.inv.grenade || 0 };
    J.UI.closeBuilding();
    J.Hand.select(p, J.Hand.slotOf(p, 'heavy_pistol'));
    J.Game.onKey('Tab');
    const open = J.Guns.wheelOpen;
    J.Guns.wheelMove(0.2, 0.2); // вправо-вниз — «Винтовки»
    window._step(0.05);
    return { tabs, bought, open, region: b.region };
  });
  await shot('g04_weapon_wheel');
  const r2 = await ev(() => { J.Game.onKeyUp('Tab'); window._step(0.1); return { held: J.Hand.heldId(J.G.player), open: J.Guns.wheelOpen }; });
  check('«Калибр»: разделы и покупка ствола с патронами', r.tabs === 8 && r.bought.carbine === 1 && r.bought.ammo === 60 && r.bought.mag === 30 && r.bought.hp === 1 && r.bought.nade === 1, r);
  check('колесо оружия: Tab, раздел мышью, взять', r.open && r2.held === 'carbine' && !r2.open, r2);
}
// 22.65 «Калибр»: пополнить патроны ко всем стволам; тир; револьвер Мисты — четвёртый патрон даёт осечку
{
  const r = await ev(() => {
    window._clear();
    const p = J.G.player, w = J.G.world;
    p.money = 40000;
    window._give('carbine', 1, false); window._give('heavy_pistol', 1, false);
    p.inv.ammo_rifle = 5;
    const b = w.buildings.find((q) => q.type === 'gunshop' && q.region === w.regionAt(p.x, p.y).id) || w.buildings.find((q) => q.type === 'gunshop');
    J.UI.openBuilding(b);
    const need = J.Guns.refillNeed(p);
    const m0 = p.money;
    document.querySelector('#bbody [data-gs="refill"]').click();
    const after = { rifle: p.inv.ammo_rifle, a50: p.inv.ammo_50, paid: m0 - p.money, cost: need.cost, full: document.querySelector('#bbody [data-gs="refill"]').disabled };
    const agi0 = p.stats.agi, xp0 = p.statXp.agi, t0 = J.G.time;
    document.querySelector('#bbody [data-gs="range"]').click();
    after.agi = p.stats.agi > agi0 || p.statXp.agi > xp0;
    after.mins = Math.round(J.G.time - t0);
    return after;
  });
  await shot('g045_gunshop');
  await ev(() => J.UI.closeBuilding());
  check('«Калибр»: пополнить патроны (4 магазина на калибр) и тир', r.rifle === 120 && r.a50 === 28 && r.paid > 0 && r.full && r.agi && r.mins >= 59, r);
  const r2 = await ev(() => {
    window._clear();
    const p = J.G.player;
    window._give('bullets', 30, false);
    window._give('mista_revolver', 1);
    const f = window._foe('thug', 7, { noai: true, hp: 5000 });
    window._step(0.3);
    window._aimAt(f.x, J.G.world.groundY(f.x, f.y) + 1.2, f.y, f);
    let shots = 0;
    for (let i = 0; i < 3; i++) { p.cds.item = 0; p.trigUp = true; if (J.Hand.fire(p)) shots++; }
    // четвёртый патрон: осечка с вероятностью ~35% — пробуем много раз с полного барабана минус три
    let mis = 0, ok = 0;
    for (let k = 0; k < 40; k++) {
      J.Hand.setMag(p, 'mista_revolver', 3);
      p.cds.item = 0; p.trigUp = true; p.reloadT = 0;
      const fired = J.Hand.fire(p);
      const m = J.Hand.magOf(p, 'mista_revolver');
      if (!fired && m === 2) mis++;
      else if (fired && m === 2) ok++;
    }
    p.cds.item = 0; p.trigUp = true;
    const fifth = J.Hand.fire(p);
    window._aimOff();
    const fourth = { mis, ok };
    return { shots, fourth, fifth, hit: f.hp < 5000 };
  });
  check('револьвер Мисты: четвёртый — осечка, пятый стреляет', r2.shots === 3 && r2.fourth.mis >= 3 && r2.fourth.ok >= 10 && r2.fifth && r2.hit, r2);
}
// 22.7 Граната, Молотов (машина горит), светошумовая, дымовая шашка
{
  const r = await ev(() => {
    window._clear();
    const p = J.G.player;
    window._give('grenade', 2);
    const fs = [window._foe('thug', 9, { noai: true, hp: 400 }), window._foe('thug', 9.5, { noai: true, hp: 400, da: 0.12 }), window._foe('thug', 10, { noai: true, hp: 400, da: -0.12 })];
    window._step(0.2);
    J.Hand.throwFrom(p, 0.7);
    window._sim(3.6);
    return { hurt: fs.filter((f) => f.hp < 360).length, left: p.inv.grenade };
  });
  check('граната: взрыв ранит группу', r.hurt >= 2 && r.left === 1, r);
  const r2 = await ev(() => {
    window._clear();
    const p = J.G.player, c = J.R3.cam;
    window._give('molotov', 2);
    const v = J.Veh.make('sedan', p.x + Math.cos(c.yaw) * 8, p.y + Math.sin(c.yaw) * 8, c.yaw + Math.PI / 2, { mode: 'parked' });
    p.face = c.yaw;
    window._step(0.2);
    J.Hand.throwFrom(p, 0.6);
    window._sim(1.4);
    const fires = J.Nades.FIRES.length;
    window._sim(1.2);
    window._v = v;
    return { fires, vfire: !!v.fire || v.hp <= 0 };
  });
  await shot('g05_molotov');
  check('Молотов: огонь растекается, машина загорается', r2.fires >= 3 && r2.vfire, r2);
  const r3 = await ev(() => {
    window._clear();
    const p = J.G.player;
    window._give('flashbang', 1);
    const f = window._foe('thug', 8, { hp: 400 });
    f.ai.target = p;
    p.face = J.R3.cam.yaw + Math.PI; // игрок отвернулся
    J.Hand.throwFrom(p, 0.5);
    window._sim(1.8);
    const st = { stun: f.st.stun || 0, blind: f.ai ? f.ai.blind || 0 : 0 };
    window._clear();
    window._give('smoke_grenade', 1);
    J.Hand.throwFrom(p, 0.5);
    window._sim(4);
    const s = J.Nades.SMOKES[0];
    return Object.assign(st, { smoke: !!s, inSmoke: !!s && J.Nades.inSmoke(s.x, s.y) });
  });
  check('светошумовая оглушает и ослепляет', r3.stun > 1 && r3.blind > 1, r3);
  check('дымовая шашка: плотная завеса', r3.smoke && r3.inSmoke, r3);
  await shot('g06_smoke');
}
// 22.8 Стрелки: банда отстреливается; Звёздная Платина ловит пули; розыск ★★ — пешие патрули с оружием
{
  const r = await ev(() => {
    window._clear();
    const p = J.G.player;
    window._plaza();
    p.maxHp = p.hp = 5000;
    p.standOut = false;
    const f = window._foe('gangster', 12, { hand: 'micro_smg' });
    f.mag = 30; f.ai.target = p; f.ai.aggro = 40;
    const f2 = window._foe('guard', 13, { hand: 'pistol', da: 0.5 });
    f2.mag = 15; f2.ai.target = p; f2.ai.aggro = 40;
    let shots = 0;
    const fire0 = J.Guns.fire;
    J.Guns.fire = function (u) { const ok = fire0.apply(this, arguments); if (ok && !u.isPlayer) shots++; return ok; };
    window._sim(5);
    const lost = 5000 - p.hp;
    // стенд против пуль
    p.standOut = true;
    let caught = 0;
    const ss0 = J.Guns.standStop;
    J.Guns.standStop = function () { const r = ss0.apply(this, arguments); if (r) caught++; return r; };
    window._sim(4);
    J.Guns.standStop = ss0;
    J.Guns.fire = fire0;
    return { shots, lost: Math.round(lost), caught };
  });
  check('банда отстреливается из своего оружия', r.shots >= 6 && r.lost > 0, r);
  check('Звёздная Платина ловит пули', r.caught >= 2, r);
  await shot('g07_gunfight');
  const r2 = await ev(() => {
    window._clear();
    const p = J.G.player;
    window._plaza();
    p.wanted = 2.2; p.wantedT = 60; p.maxHp = p.hp = 5000;
    window._sim(8);
    const cops = J.G.ents.filter((e) => e.cop && !e.dead);
    return { n: cops.length, armed: cops.filter((e) => e.hand && J.Hand.def(e.hand).cls === 'gun').length, w: p.wanted };
  });
  check('розыск ★★: пешие патрули с оружием', r2.n >= 1 && r2.armed === r2.n, r2);
}
// 22.9 Мир: пули зависают в остановленном времени; Секс Пистолз доворачивают промах
{
  const r = await ev(() => {
    window._clear();
    const p = J.G.player;
    window._stand('the_world');
    window._give('ammo_9mm', 30, false);
    window._give('pistol', 1);
    const f = window._foe('thug', 8, { noai: true, hp: 3000 });
    window._step(0.3);
    J.G.timestop = { by: p, t: 4, max: 4, intro: 0 };
    window._sim(0.5);
    const hp0 = f.hp;
    for (let i = 0; i < 3; i++) { p.cds.item = 0; p.trigUp = true; J.Hand.fire(p); }
    window._sim(0.4);
    const frozen = J.Guns.FROZEN.length, same = f.hp === hp0;
    J.G.timestop.t = 0.01;
    window._sim(0.6);
    return { frozen, same, hit: f.hp < hp0, left: J.Guns.FROZEN.length };
  });
  check('Мир: пули зависают и срываются, когда время идёт', r.frozen === 3 && r.same && r.hit && r.left === 0, r);
  const r2 = await ev(() => {
    window._clear();
    const p = J.G.player;
    window._stand('sex_pistols', 6);
    p.standOut = true;
    window._give('ammo_9mm', 30, false);
    window._give('pistol', 1);
    const f = window._foe('thug', 9, { noai: true, hp: 3000 });
    window._step(0.3);
    const hp0 = f.hp;
    const g = J.G.world.groundY(p.x, p.y);
    // мимо: в землю в трёх метрах сбоку от цели
    const a = Math.atan2(f.y - p.y, f.x - p.x) + 0.45;
    window._aimAt(p.x + Math.cos(a) * 8, g, p.y + Math.sin(a) * 8);
    p.cds.item = 0; p.trigUp = true; J.Hand.fire(p);
    window._aimOff();
    window._sim(0.5);
    const res = { hit: f.hp < hp0 };
    window._stand('star_platinum');
    return res;
  });
  check('Секс Пистолз доворачивают промах во врага', r2.hit, r2);
}
// 22.10 Стрельба в городе поднимает розыск
{
  const r = await ev(() => {
    window._clear();
    const p = J.G.player;
    window._give('ammo_9mm', 30, false);
    window._give('pistol', 1);
    window._step(0.2);
    const city = !!J.G.world.cityAt(p.x, p.y);
    for (let i = 0; i < 5; i++) { p.cds.item = 0; p.trigUp = true; J.Hand.fire(p); window._sim(0.2); }
    return { city, wanted: p.wanted || 0 };
  });
  check('выстрелы в городе — розыск', r.city && r.wanted > 0, r);
}

// 19. Сохранение и загрузка панели
{
  const r = await ev(() => {
    window._clear();
    const p = J.G.player;
    window._give('bullets', 7, false);
    window._give('revolver', 1);
    p.mag.revolver = 4;
    window._give('kitchen_knife', 1);
    p.dur.kitchen_knife = 33;
    window._give('carbine', 1, false);
    p.mag.carbine = 17;
    J.Hand.select(p, J.Hand.slotOf(p, 'revolver'));
    J.Game.save(false);
    return { hb: p.hotbar.slice(), hsel: p.hsel };
  });
  await ev(() => { J.Game.toTitle(); J.Game.loadFromStore(); });
  await page.waitForFunction(() => J.Game.state === 'play' && document.getElementById('loading').hidden && J.G.player, null, { timeout: 120000 });
  const r2 = await ev(() => { const p = J.G.player; return { hb: p.hotbar.slice(), hsel: p.hsel, mag: p.mag.revolver, dur: p.dur.kitchen_knife, held: J.Hand.heldId(p), carb: p.mag.carbine }; });
  check('сохранение: панель, барабан и прочность', JSON.stringify(r.hb) === JSON.stringify(r2.hb) && r2.hsel === r.hsel && r2.mag === 4 && r2.dur === 33 && r2.held === 'revolver' && r2.carb === 17, { r, r2 });
  await page.waitForTimeout(600);
  await page.screenshot({ path: path.join(OUT, 'i15_after_load.png') });
}

const fails = results.filter((x) => !x.ok).length;
console.log(`\nИТОГ: ${results.length - fails}/${results.length} проверок, ошибок страницы: ${errs.length}`);
for (const e of errs.slice(0, 15)) console.log('  ' + e);
await browser.close();
process.exit(fails || errs.length ? 1 : 0);
