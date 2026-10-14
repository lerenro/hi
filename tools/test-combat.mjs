// Боевой тест (Playwright, пошагово): серия ударов, заряженный удар и подброс, удар об стену, раш,
// столкновение рашей, блок, пробитие блока, парирование, уклонение, остановка времени ДИО, смерть и исчезновение тела.
// Запуск: node tools/test-combat.mjs   (переменные: PW — путь к playwright, CHROME — к chromium, OUT — папка для снимков)
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
const PW = process.env.PW || '/opt/node22/lib/node_modules/playwright/index.mjs';
const { chromium } = await import(PW);
const ROOT = process.env.ROOT || path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = process.env.OUT || path.join(ROOT, '..', 'combat-shots');
fs.mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({ executablePath: process.env.CHROME || '/opt/pw-browsers/chromium', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errs = [];
page.on('pageerror', (e) => errs.push('pageerror: ' + e.message));
page.on('console', (m) => { if (m.type() === 'error') errs.push('console: ' + m.text()); });
await page.goto('file://' + ROOT + '/index.html');
await page.waitForFunction(() => window.J && J.G.world && J.Game.state === 'title', null, { timeout: 120000 });
await page.evaluate(() => { J.UI.creator.origin = 'student'; J.UI.showCreator(); J.UI.finishCreator(); });
await page.waitForFunction(() => J.Game.state === 'play' && document.getElementById('loading').hidden, null, { timeout: 120000 });
await page.waitForTimeout(1000);
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
  const w = J.G.world;
  const open = () => {
    for (let k = 0; k < 400; k++) {
      const q = w.randomWalkable(p.x, p.y, 60, J.R, { street: true });
      if (!q) continue;
      let ok = true;
      for (let dx = -4; dx <= 4 && ok; dx++) for (let dy = -6; dy <= 6 && ok; dy++) if (w.solid(q.x + dx, q.y + dy)) ok = false;
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
    g.timestop = null; g.timeskip = null; g.clash = null;
    if (g.roller && g.roller.m) J.R3.removeMesh(g.roller.m);
    g.roller = null;
    Object.assign(p, { channel: null, atk: null, anim: null, react: null, guard: false, chg: null, dash: null, airborne: false, z: 0, kx: 0, ky: 0, st: {}, cds: {}, stamina: 100, dead: false, gm: 100 });
    p.hp = p.maxHp;
    p.x = window._home.x; p.y = window._home.y;
    J.Input.keys = {};
    J.Fx.reset();
  };
  window._foe = (kind, dist, o = {}) => {
    const c = J.R3.cam;
    c.pitch = 0.28; c.dist = 6.5; c.idle = 9;
    const a = c.yaw + Math.PI / 2;
    const x = p.x + Math.cos(a) * dist, y = p.y + Math.sin(a) * dist;
    const e = J.MOBS[kind] ? J.makeMob(kind, x, y, o.lvl || 3) : J.makeStandUser(x, y, o.lvl || 6, kind);
    J.addEnt(e);
    if (o.noai) e.ai = null;
    if (o.hp) e.maxHp = e.hp = o.hp;
    if (o.boss) { e.boss = true; e.bossKey = o.boss; }
    if (e.stand) e.standOut = true;
    e.face = a + Math.PI; p.face = a;
    return e;
  };
});
const ev = (f, a) => page.evaluate(f, a);
const shot = (n) => page.screenshot({ path: path.join(OUT, n + '.png') });
const results = [];
const check = (name, ok, info) => { results.push({ name, ok: !!ok }); console.log((ok ? 'OK   ' : 'FAIL ') + name + (info !== undefined ? '  ' + JSON.stringify(info) : '')); };

// 1. Серия из четырёх ударов: стенд у цели в момент контакта, последний — подброс
{
  await ev(() => { window._clear(); window._f = window._foe('thug', 2.2, { noai: true, hp: 900 }); window._step(0.4); });
  let hits = 0, standNear = true, launched = false;
  for (let i = 0; i < 4; i++) {
    const r = await ev(() => {
      const p = J.G.player, f = window._f;
      p.cds.basic = 0;
      const hp0 = f.hp;
      J.P.basicAttack(p);
      const at = p.atk.at;
      window._step(at - 1 / 60);
      const sv = p.standView;
      const ds = sv ? Math.hypot(sv.pos.x - f.x, sv.pos.z - f.y) : 9;
      window._step(2 / 60);
      return { hit: f.hp < hp0, ds: +ds.toFixed(2), react: f.react && f.react.type };
    });
    if (i === 3) await shot('c01_chain_finisher');
    if (r.hit) hits++;
    if (r.ds > 1.6) standNear = false;
    if (i === 3) launched = r.react === 'air';
    await ev(() => window._step(0.3));
  }
  check('серия: 4 попадания', hits === 4, hits);
  check('серия: стенд у цели в момент контакта', standNear);
  check('серия: добивание подбрасывает', launched);
}
// 2. Заряженный тяжёлый удар → подброс; удар об стену
{
  await ev(() => { window._clear(); window._f = window._foe('thug', 2.0, { noai: true, hp: 900 }); window._step(0.3); const p = J.G.player; J.P.heavyStart(p); window._step(1.0); });
  await shot('c02_charge');
  const r = await ev(() => { J.P.heavyRelease(J.G.player); window._step(0.45); const f = window._f; return { air: !!f.airborne, z: +(f.z || 0).toFixed(2) }; });
  await shot('c03_launch');
  check('заряженный удар подбрасывает', r.air && r.z > 0.3, r);
  const wall = await ev(() => {
    window._clear();
    const p = J.G.player, w = J.G.world;
    for (let k = 0; k < 4000; k++) {
      const q = w.randomWalkable(p.x, p.y, 80, J.R, {});
      if (!q) continue;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        let ok = true;
        for (let s = -2; s <= 2.6; s += 0.5) if (w.solid(q.x + dx * s, q.y + dy * s)) ok = false;
        if (!ok || !w.solid(q.x + dx * 3.6, q.y + dy * 3.6) || w.isWater(q.x + dx * 3.6, q.y + dy * 3.6)) continue;
        p.x = q.x - dx; p.y = q.y - dy;
        J.R3.updateChunks(p.x, p.y, true);
        const c = J.R3.cam; c.yaw = Math.atan2(dy, dx) - 1.2; c.pitch = 0.25; c.dist = 6;
        const f = window._f = J.addEnt(J.makeMob('thug', p.x + dx * 1.8, p.y + dy * 1.8, 4));
        f.ai = null; f.maxHp = f.hp = 900;
        p.face = Math.atan2(dy, dx);
        return true;
      }
    }
    return false;
  });
  if (wall) {
    const s = await ev(() => {
      window._step(0.2);
      const p = J.G.player;
      J.P.heavyStart(p); window._step(1.0); J.P.heavyRelease(p);
      for (let i = 0; i < 90; i++) { window._step(1 / 60); if (window._f.slammed) break; }
      return { slam: !!window._f.slammed, react: window._f.react && window._f.react.type };
    });
    await ev(() => window._step(0.1));
    await shot('c04_wallslam');
    check('удар об стену', s.slam && s.react === 'slump', s);
  } else check('удар об стену (нет стены рядом)', true);
}
// 3. Раш на 1.8 м: не меньше 10 попаданий
{
  const r = await ev(() => {
    window._clear();
    const f = window._f = window._foe('thug', 1.8, { noai: true, hp: 5000 });
    window._step(0.3);
    let n = 0;
    const oh = J.hurt;
    J.hurt = function (t, a, s, o) { if (t === f && o && o.rushTick) n++; return oh.apply(this, arguments); };
    const idle = J.R3.renderer.info.render.calls;
    J.P.standAbility(J.G.player, 0);
    window._step(0.5);
    const calls = J.R3.renderer.info.render.calls;
    window._step(1.2);
    J.hurt = oh;
    const nodes = document.getElementById('fx').querySelectorAll('*').length + document.getElementById('labels').children.length;
    return { n, idle, calls, nodes };
  });
  check('раш: ≥10 попаданий с 1.8 м', r.n >= 10, r.n);
  check('раш: мало лишних вызовов отрисовки', r.calls <= r.idle + 12, { idle: r.idle, rush: r.calls });
  check('DOM-узлы эффектов ограничены', r.nodes <= 80, r.nodes);
}
// 4. Столкновение рашей и победа
{
  await ev(() => {
    window._clear();
    const p = J.G.player, f = window._f = window._foe('the_world', 2.4, { noai: true, hp: 3000 });
    window._step(0.3);
    const ab = J.STANDS.the_world.abil.find((a) => a.kind === 'rush');
    f.face = Math.atan2(p.y - f.y, p.x - f.x);
    J.Abil.use(f, ab, J.Abil.aimAt(f, p));
    window._step(0.1);
    J.P.standAbility(p, 0);
    window._step(0.3);
  });
  const c = await ev(() => !!J.G.clash);
  for (let i = 0; i < 4; i++) await ev(() => { for (let k = 0; k < 8; k++) { if (k % 2 === 0) J.Cb.mash(J.G.player); window._step(1 / 60); } });
  await shot('c05_clash');
  const w = await ev(() => { for (let k = 0; k < 240 && J.G.clash; k++) { J.Cb.mash(J.G.player); J.Cb.mash(J.G.player); window._step(1 / 60); } window._step(0.15); const f = window._f; return { air: !!f.airborne || (f.react && f.react.type === 'down'), hp: Math.round(f.hp) }; });
  await shot('c06_clash_win');
  check('столкновение рашей началось', c);
  check('победитель столкновения отбрасывает проигравшего', w.air, w);
}
// 5. Блок, пробитие блока, парирование, уклонение
{
  const g = await ev(() => {
    window._clear();
    const p = J.G.player, f = window._f = window._foe('thug', 1.7, { hp: 600, lvl: 5 });
    J.Input.keys.KeyZ = true;
    let blocked = 0, dmg = 0, hp0 = p.hp;
    for (let i = 0; i < 300; i++) { window._step(1 / 60); if (p.react && p.react.type === 'block') blocked++; dmg += Math.max(0, hp0 - p.hp); hp0 = p.hp; }
    J.Input.keys.KeyZ = false;
    return { blocked, dmg: Math.round(dmg), gm: Math.round(p.gm) };
  });
  await shot('c07_guard');
  check('блок гасит удары и тратит шкалу', g.blocked > 0 && g.gm < 100 && g.dmg < 10, g);
  const gb = await ev(() => {
    window._clear();
    const p = J.G.player, f = window._f = window._foe('star_platinum', 2.0, { noai: true, hp: 5000 });
    window._step(0.2);
    for (let k = 0; k < 6; k++) {
      f.guard = false; J.Cb.setGuard(f, true); f.guardAt = -9;
      p.cds = {}; p.stamina = 100; J.P.heavyAttack(p); window._step(0.4);
      if (f.react && f.react.type === 'gbreak') return { k, stun: f.st.stun };
    }
    return null;
  });
  await shot('c08_guardbreak');
  check('пробитие блока оглушает', gb && gb.stun > 0.8, gb);
  const pr = await ev(() => {
    window._clear();
    const p = J.G.player, f = window._f = window._foe('thug', 1.6, { hp: 600, lvl: 4 });
    for (let i = 0; i < 400; i++) {
      window._step(1 / 60);
      if (f.atk && !f.atk.done && f.atk.at - f.atk.t < 0.1 && f.atk.at - f.atk.t > 0.02 && !p.guard) {
        J.Input.keys.KeyZ = true;
        for (let k = 0; k < 15; k++) { window._step(1 / 60); if (f.react && f.react.type === 'parried') { J.Input.keys.KeyZ = false; return true; } }
        J.Input.keys.KeyZ = false;
        window._step(0.3);
      }
    }
    return false;
  });
  await shot('c09_parry');
  check('парирование', pr);
  const dg = await ev(() => {
    window._clear();
    const p = J.G.player, f = window._f = window._foe('thug', 1.6, { hp: 600, lvl: 4 });
    for (let i = 0; i < 400; i++) {
      window._step(1 / 60);
      if (f.atk && !f.atk.done && f.atk.at - f.atk.t < 0.05) {
        const hp0 = p.hp;
        p.cds.dash = 0; p.stamina = 100;
        J.P.dash(p, -Math.sin(p.face), Math.cos(p.face));
        window._step(0.12);
        return { noDmg: p.hp >= hp0, perfect: !!(p.dash && p.dash.pd) || J.Fx.scale < 1 };
      }
    }
    return null;
  });
  check('уклонение с неуязвимостью', dg && dg.noDmg, dg);
}
// 6. Остановка времени ДИО: мир серый, ДИО цветной, ножи висят
{
  await ev(() => {
    window._clear();
    const p = J.G.player, f = window._f = window._foe('the_world', 4.5, { hp: 5000, boss: 'dio', lvl: 9 });
    window._step(0.3);
    J.Abil.use(f, J.STANDS.the_world.abil.find((a) => a.kind === 'timestop'), J.Abil.aimAt(f, p));
    window._step(0.35);
  });
  await shot('c10_timestop_sphere');
  const t = await ev(() => {
    window._step(1.3);
    const p = J.G.player, f = window._f;
    const pr = J.G.projs.map((q) => [q.x, q.y]);
    window._step(0.5);
    const still = J.G.projs.length > 0 && J.G.projs.every((q, i) => pr[i] && Math.hypot(q.x - pr[i][0], q.y - pr[i][1]) < 0.01);
    return { desat: J.R3.uDesat.value, dio: f.view.desat, pl: p.view.desat, knives: J.G.projs.length, still };
  });
  await shot('c11_timestop_world');
  check('остановка времени: мир серый, ДИО цветной', t.desat > 0.95 && t.dio === 0 && t.pl > 0.95, t);
  check('остановка времени: ножи висят в воздухе', t.still, t.knives);
  await ev(() => { for (let k = 0; k < 16 && J.G.timestop; k++) window._step(0.5); window._step(0.4); });
  await shot('c12_time_resumes');
  const after = await ev(() => J.R3.uDesat.value);
  check('время пошло: цвет вернулся', after < 0.05, after);
}
// 7. Смерть: тело без свечения, падает, исчезает; координаты конечны
{
  await ev(() => { window._clear(); window._f = window._foe('thug', 2.0, { noai: true, hp: 20 }); window._step(0.2); const p = J.G.player; p.combo = 3; p.lastAtkT = J.G.t; p.cds = {}; J.P.basicAttack(p); window._step(0.7); });
  await shot('c13_death');
  const d = await ev(() => { const f = window._f; return { dead: f.dead, em: f.view ? f.view.mats[0].emissive.getHexString() : 'none', react: f.react && f.react.type }; });
  check('смерть: тело не светится', d.dead && d.em === '000000', d);
  const gone = await ev(() => { window._step(3.2); return !J.G.ents.includes(window._f); });
  check('тело исчезает', gone);
  const fin = await ev(() => J.G.ents.every((e) => Number.isFinite(e.x) && Number.isFinite(e.y) && Number.isFinite(e.z || 0)));
  check('координаты конечны', fin);
}
check('нет ошибок страницы', errs.length === 0, errs.slice(0, 5));
const bad = results.filter((r) => !r.ok).length;
console.log(`ИТОГО: ${results.length - bad}/${results.length}`);
await browser.close();
process.exit(bad ? 1 : 0);
