// Тест вещей в руках (Playwright, пошагово): подбор, выбор ячейки, удар ножом, бросок с прицелом и возврат ножа,
// нож в стене, бросок стендом (веер), ножи в остановленном времени, револьвер (барабан, перезарядка), бутылка-«розочка»,
// бутылка вдребезги, враг с битой, щелчок подшипником, Секс Пистолз, сохранение и загрузка панели.
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
  const open = () => {
    for (let k = 0; k < 600; k++) {
      const q = w.randomWalkable(p.x, p.y, 60, J.R, { street: true });
      if (!q) continue;
      let ok = true;
      for (let dx = -9; dx <= 9 && ok; dx++) for (let dy = -9; dy <= 9 && ok; dy++) if (w.solid(q.x + dx, q.y + dy) || w.isWater(q.x + dx, q.y + dy)) ok = false;
      if (ok) return q;
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
    window._step(0.1);
    const tgt = J.Game.interactTarget();
    const prompt = document.getElementById('prompt').textContent;
    J.Game.interact();
    window._step(0.3);
    return { tgt: !!(tgt && tgt.item === gi), prompt, inv: p.inv.kitchen_knife || 0, held: J.Hand.heldId(p), mesh: !!(p.view && p.view.heldMesh), ground: J.Hand.GROUND.length };
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
    for (let i = 0; i < 6; i++) { p.cds.item = 0; if (J.Hand.fire(p)) shots++; window._step(0.05); }
    const mag0 = J.Hand.magOf(p, 'revolver');
    return { shots, mag0, hit: f.hp < hp0, hp0 };
  });
  await ev(() => { const p = J.G.player; p.cds.item = 0; J.Hand.magOf(p, 'revolver'); p.mag.revolver = 1; J.Hand.fire(p); window._step(0.03); const c = J.R3.cam; c.yaw += 1.2; c.dist = 3.6; c.pitch = 0.15; });
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
    J.Hand.throwFrom(p, 1);
    window._sim(1.5);
    return { left: p.inv.bottle || 0, ground: J.Hand.GROUND.filter((g) => g.item === 'bottle').length, fly: J.Hand.FLY.length, hit: window._f.hp < hp0 };
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
  check('на улицах города лежат вещи', r.n > 0, r);
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
    J.Hand.select(p, J.Hand.slotOf(p, 'revolver'));
    J.Game.save(false);
    return { hb: p.hotbar.slice(), hsel: p.hsel };
  });
  await ev(() => { J.Game.toTitle(); J.Game.loadFromStore(); });
  await page.waitForFunction(() => J.Game.state === 'play' && document.getElementById('loading').hidden && J.G.player, null, { timeout: 120000 });
  const r2 = await ev(() => { const p = J.G.player; return { hb: p.hotbar.slice(), hsel: p.hsel, mag: p.mag.revolver, dur: p.dur.kitchen_knife, held: J.Hand.heldId(p) }; });
  check('сохранение: панель, барабан и прочность', JSON.stringify(r.hb) === JSON.stringify(r2.hb) && r2.hsel === r.hsel && r2.mag === 4 && r2.dur === 33 && r2.held === 'revolver', { r, r2 });
  await page.waitForTimeout(600);
  await page.screenshot({ path: path.join(OUT, 'i15_after_load.png') });
}

const fails = results.filter((x) => !x.ok).length;
console.log(`\nИТОГ: ${results.length - fails}/${results.length} проверок, ошибок страницы: ${errs.length}`);
for (const e of errs.slice(0, 15)) console.log('  ' + e);
await browser.close();
process.exit(fails || errs.length ? 1 : 0);
