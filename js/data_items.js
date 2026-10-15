'use strict';
// Предметы, еда, магазины.
(function () {
  const I = {};
  const add = (id, o) => (I[id] = Object.assign({ id, stack: true, price: 0 }, o));

  // Еда: food — сытость, heal — здоровье, energy — бодрость
  add('onigiri', { name: 'Онигири', type: 'food', food: 25, heal: 5, price: 6, desc: 'Рисовый треугольник с тунцом.' });
  add('sandwich', { name: 'Сэндвич', type: 'food', food: 30, heal: 6, price: 8, desc: 'Сэндвич с ветчиной.' });
  add('pizza', { name: 'Пицца Маргарита', type: 'food', food: 55, heal: 15, price: 18, desc: 'Настоящая неаполитанская.' });
  add('burger', { name: 'Бургер', type: 'food', food: 45, heal: 8, price: 12, desc: 'Американская классика.' });
  add('curry', { name: 'Карри', type: 'food', food: 50, heal: 12, price: 14, desc: 'Острое, как удар Красного Мага.' });
  add('koshari', { name: 'Кошари', type: 'food', food: 45, heal: 10, price: 9, desc: 'Египетское блюдо из риса и чечевицы.' });
  add('fish_chips', { name: 'Фиш-энд-чипс', type: 'food', food: 45, heal: 10, price: 12, desc: 'Британская классика.' });
  add('laksa', { name: 'Лакса', type: 'food', food: 50, heal: 10, price: 11, desc: 'Острый суп Сингапура.' });
  add('coffee', { name: 'Кофе', type: 'food', food: 4, energy: 22, price: 5, desc: 'Бодрит. Немного.' });
  add('tea', { name: 'Чай', type: 'food', food: 3, energy: 14, heal: 4, price: 4, desc: 'Английский чай. Джентльменский выбор.' });
  add('water', { name: 'Вода', type: 'food', food: 4, energy: 4, price: 2, desc: 'Чистая вода. Хамон-воины ценят.' });
  add('wine', { name: 'Вино', type: 'food', food: 6, heal: 10, energy: -6, price: 15, desc: 'Цеппели научили бы тебя трюку с бокалом.' });
  add('coffee_gum', { name: 'Кофейная жвачка', type: 'food', food: 2, energy: 10, price: 3, desc: 'Любимое лакомство одного бостон-терьера.' });
  add('trussardi_meal', { name: 'Ужин Труссарди', type: 'food', food: 100, heal: 100, energy: 30, price: 80, desc: 'Перл Джем вылечит всё. Даже плечи.' });
  add('blood_pack', { name: 'Пакет крови', type: 'blood', blood: 45, price: 40, desc: 'Для тех, кто больше не ест обычную еду.' });

  add('medkit', { name: 'Аптечка', type: 'heal', heal: 60, price: 35, desc: 'Бинты и антисептик.' });
  add('bandage', { name: 'Бинт', type: 'heal', heal: 25, price: 12, desc: 'Останавливает кровь.' });
  add('energy_drink', { name: 'Энергетик', type: 'food', food: 2, energy: 40, price: 10, desc: 'Бодрость в банке.' });

  // Особые
  add('arrow', { name: 'Стрела', type: 'arrow', price: 60000, rare: true, desc: 'Древняя стрела из метеорита. Пробуждает стенд у избранных. Остальных убивает.' });
  add('stone_mask', { name: 'Каменная маска', type: 'mask', price: 45000, rare: true, desc: 'Ацтекская маска. С кровью превращает в вампира.' });
  add('red_stone', { name: 'Красный камень Айи', type: 'redstone', price: 0, rare: true, desc: 'Суперэйджа. Усиливает хамон в тысячи раз. С маской — создаёт Совершенную форму жизни.' });
  add('stand_disc', { name: 'Стенд-диск', type: 'disc', stack: false, price: 0, rare: true, desc: 'Диск с чужим стендом. Вставь в голову, чтобы получить стенд.' });
  add('green_baby', { name: 'Зелёный младенец', type: 'key', price: 0, rare: true, desc: 'Плод кости ДИО. Сливается с тем, кто готов к Небесам.' });
  add('corpse_part', { name: 'Часть Святого Трупа', type: 'corpse', stack: false, price: 0, rare: true, desc: 'Часть мумии святого. Дарует силу.' });
  add('rokakaka', { name: 'Плод Рокакака', type: 'rokakaka', price: 9000, rare: true, desc: 'Равноценный обмен: исцеляет полностью, но забирает часть жизни.' });
  add('polpo_lighter', { name: 'Зажигалка Польпо', type: 'key', price: 0, desc: 'Не дай ей погаснуть 24 часа.' });
  add('clackers', { name: 'Клакеры', type: 'gear', price: 450, desc: 'Стальные шары на верёвке. Хамон-воин сделает из них оружие.' });
  add('steel_ball', { name: 'Стальные шары', type: 'gear', price: 0, desc: 'Шары семьи Цеппели. Нужны для Вращения.' });
  add('umbrella', { name: 'Плотный зонт', type: 'gear', price: 120, desc: 'Защищает вампира от солнца (частично).' });
  add('revolver', { name: 'Револьвер', type: 'gun', price: 900, desc: 'Шестизарядный револьвер, как у Мисты. Нужны патроны, после шести выстрелов — перезарядка.' });
  add('horse', { name: 'Лошадь', type: 'gear', price: 3500, desc: 'Верхом по пустыне! Скорость +45% вне города. Для Золотого Вращения.' });
  add('lottery', { name: 'Лотерейный билет', type: 'lottery', price: 10, desc: 'Может, повезёт?' });
  add('rumor_map', { name: 'Карта слухов', type: 'rumor', price: 300, desc: 'Отмечает на карте место, где видели Стрелу или маску.' });
  add('luck_charm', { name: 'Амулет удачи', type: 'gear', price: 700, desc: '+5% к шансу пережить Стрелу.' });
  add('dio_diary', { name: 'Дневник ДИО', type: 'lore', price: 0, desc: '«Спиральная лестница. Жук-носорог. Город-призрак. Ангел. Фиговое дерево...»' });
  add('package', { name: 'Посылка', type: 'quest', price: 0, desc: 'Чья-то посылка. Нужно доставить.' });
  add('cat', { name: 'Потерявшийся кот', type: 'quest', price: 0, desc: 'Пушистый беглец. Хозяин будет рад.' });
  add('clue', { name: 'Улика', type: 'quest', price: 0, desc: 'Странная улика.' });

  // ---------- Оружие и вещи в руку (js/items_hand.js) ----------
  // hand: cls — blade (клинок), blunt (дубина), throw (метательное), gun (огнестрел), ammo (патроны);
  // dmg — урон, reach — дальность, arc — ширина замаха, w — вес (кг: медленнее замах, больше выносливости),
  // dur — прочность, bleed — кровотечение, stun — оглушение, knock — отброс, two — двуручное,
  // thr — бросок: dmg, stick (втыкается), spin (вращается в полёте), shatter (разбивается), ret (возвращается)
  add('kitchen_knife', { name: 'Кухонный нож', type: 'weapon', price: 25, desc: 'Острый поварской нож. Режет, колет, можно метнуть — но он не сбалансирован для броска.',
    hand: { cls: 'blade', model: 'knife', dmg: 15, reach: 1.15, arc: 1.2, w: 0.2, dur: 70, bleed: 3, stun: 0.12, knock: 0.6, thr: { dmg: 20, stick: 0.45, spin: 11 } } });
  add('switchblade', { name: 'Выкидной нож', type: 'weapon', price: 45, desc: 'Щелчок — и лезвие наружу. Быстрые короткие удары.',
    hand: { cls: 'blade', model: 'switchblade', dmg: 11, reach: 1.0, arc: 1.0, w: 0.12, dur: 90, bleed: 2.5, stun: 0.1, knock: 0.4, thr: { dmg: 14, stick: 0.4, spin: 12 } } });
  add('throw_knife', { name: 'Метательные ножи', type: 'weapon', price: 18, desc: 'Сбалансированные ножи — летят остриём вперёд и втыкаются. Отдай стенду — он метнёт веером.',
    hand: { cls: 'throw', model: 'tknife', dmg: 9, reach: 1.0, arc: 1.0, w: 0.1, dur: 40, bleed: 2, stun: 0.08, knock: 0.3, thr: { dmg: 24, stick: 0.85, spin: 0, speed: 1.15 } } });
  add('bat', { name: 'Бейсбольная бита', type: 'weapon', price: 60, desc: 'Ясень, 84 см. Тяжёлый размашистый удар оглушает.',
    hand: { cls: 'blunt', model: 'bat', dmg: 19, reach: 1.65, arc: 2.0, w: 0.9, dur: 140, stun: 0.45, knock: 3.2, two: true, thr: { dmg: 14, spin: 9 } } });
  add('pipe', { name: 'Стальная труба', type: 'weapon', price: 0, desc: 'Кусок водопроводной трубы со стройки. Тяжёлая и почти вечная.',
    hand: { cls: 'blunt', model: 'pipe', dmg: 23, reach: 1.55, arc: 1.8, w: 1.7, dur: 400, stun: 0.6, knock: 3.6, two: true, thr: { dmg: 18, spin: 8 } } });
  add('road_sign', { name: 'Дорожный знак', type: 'weapon', price: 0, desc: 'Знак «СТОП» вместе со столбом. Огромный размах, но очень тяжёлый.',
    hand: { cls: 'blunt', model: 'sign', dmg: 32, reach: 2.3, arc: 2.6, w: 4.5, dur: 90, stun: 0.9, knock: 6, two: true, thr: { dmg: 26, spin: 5 } } });
  add('bottle', { name: 'Стеклянная бутылка', type: 'weapon', price: 1, desc: 'Пустая бутылка. Ударишь — разобьётся и станет «розочкой». Брошенная — разлетается вдребезги.',
    hand: { cls: 'blunt', model: 'bottle', dmg: 11, reach: 1.05, arc: 1.3, w: 0.45, dur: 1, stun: 0.35, knock: 1.2, breaksTo: 'broken_bottle', thr: { dmg: 13, spin: 10, shatter: true } } });
  add('broken_bottle', { name: 'Розочка', type: 'weapon', price: 0, desc: 'Разбитая бутылка. Острые края режут — и быстро крошатся.',
    hand: { cls: 'blade', model: 'bbottle', dmg: 13, reach: 1.0, arc: 1.2, w: 0.3, dur: 10, bleed: 3.5, stun: 0.1, knock: 0.4, thr: { dmg: 9, spin: 10, shatter: true } } });
  add('brick', { name: 'Кирпич', type: 'weapon', price: 0, desc: 'Обычный красный кирпич. Тяжёлый — бросок оглушает.',
    hand: { cls: 'blunt', model: 'brick', dmg: 14, reach: 1.05, arc: 1.2, w: 2.2, dur: 30, stun: 0.5, knock: 2, thr: { dmg: 22, spin: 6, stun: 0.9 } } });
  add('rock', { name: 'Камень', type: 'weapon', price: 0, desc: 'Увесистый булыжник. Самое древнее оружие.',
    hand: { cls: 'throw', model: 'rock', dmg: 10, reach: 1.0, arc: 1.1, w: 0.8, dur: 999, stun: 0.3, knock: 1.4, thr: { dmg: 16, spin: 7, stun: 0.5 } } });
  add('ball_bearings', { name: 'Подшипниковые шарики', type: 'weapon', price: 6, desc: 'Стальные шарики. Рукой — так себе, а щелчок Звёздной Платины пробивает насквозь.',
    hand: { cls: 'throw', model: 'bearing', dmg: 4, reach: 1.0, arc: 1.0, w: 0.03, dur: 999, stun: 0.05, knock: 0.2, thr: { dmg: 8, spin: 0, speed: 1.2 } } });
  add('coins', { name: 'Монеты по 500 иен', type: 'weapon', price: 5, desc: 'Тяжёлые монеты. Рукой бросать бессмысленно, но щелчок стенда превращает монету в пулю.',
    hand: { cls: 'throw', model: 'coin', dmg: 2, reach: 1.0, arc: 1.0, w: 0.01, dur: 999, stun: 0.05, knock: 0.1, thr: { dmg: 5, spin: 20, speed: 1.2 } } });
  add('bullets', { name: 'Патроны .38', type: 'ammo', price: 3, desc: 'Патроны к револьверу. Когда барабан пуст, перезарядка идёт сама.', hand: { cls: 'ammo', model: 'ammo' } });
  // упаковки: при покупке распаковываются в поштучные вещи
  add('ammo_box', { name: 'Коробка патронов .38', type: 'pack', pack: ['bullets', 12], price: 30, desc: '12 патронов к револьверу.' });
  add('knife_set', { name: 'Набор метательных ножей', type: 'pack', pack: ['throw_knife', 5], price: 80, desc: 'Пять сбалансированных ножей в чехле.' });
  add('bearing_bag', { name: 'Мешочек подшипников', type: 'pack', pack: ['ball_bearings', 10], price: 40, desc: 'Десять стальных шариков.' });
  add('cola', { name: 'Газировка в стекле', type: 'food', food: 4, energy: 12, price: 3, desc: 'Холодная газировка. Пустая бутылка останется у тебя.' });
  I.steel_ball.hand = { cls: 'throw', model: 'steelball', dmg: 8, reach: 1.0, arc: 1.0, w: 0.5, dur: 9999, stun: 0.2, knock: 1, thr: { dmg: 18, spin: 0, ret: true, speed: 1.1 } };
  I.steel_ball.desc = 'Шары семьи Цеппели. Нужны для Вращения. Брошенный из руки шар возвращается.';
  I.wine.empty = 'bottle';
  I.cola.empty = 'bottle';

  // ---------- Арсенал (js/guns.js) ----------
  // огнестрел: grip — хват (pistol/rifle), cat — раздел колеса оружия, mag — магазин, ammo — патроны,
  // rate — пауза между выстрелами (с), auto — автоматический огонь, reload — перезарядка (с), shell — по патрону (с),
  // pellets — дробин, spread/ads — разброс от бедра и в прицеле (рад), bloom — рост разброса за выстрел,
  // kick — отдача (рад), range — дальность, hs — множитель в голову, snd — звук, zoom — поле зрения в прицеле,
  // scope — оптика, act — затвор после выстрела (pump/bolt), muz — длина до дульного среза, case — гильза
  I.revolver.hand = { cls: 'gun', grip: 'pistol', cat: 'pistol', model: 'revolver', dmg: 30, reach: 1.0, arc: 1.0, w: 1.0, dur: 9999, mag: 6, ammo: 'bullets', rate: 0.42, reload: 1.6, rclip: 'reload', stun: 0.3, knock: 1.6,
    spread: 0.035, ads: 0.008, bloom: 0.03, kick: 0.05, range: 45, hs: 2.2, snd: 'revolver', zoom: 46, muz: 0.17, case: 0, thr: { dmg: 8, spin: 6 } };
  const gun = (id, name, price, desc, h) => add(id, { name, type: 'gun', price, desc, hand: Object.assign({ cls: 'gun', grip: 'pistol', cat: 'pistol', reach: 1.0, arc: 1.0, dur: 9999, stun: 0.25, knock: 1.4, hs: 2.2, range: 45, zoom: 48, case: 1, thr: { dmg: 8, spin: 6 } }, h) });
  gun('pistol', 'Пистолет 9 мм', 650, 'Надёжный полуавтомат на 15 патронов. Лёгкая отдача, быстрая перезарядка.',
    { model: 'pistol', dmg: 22, w: 0.9, mag: 15, ammo: 'ammo_9mm', rate: 0.17, reload: 1.25, spread: 0.03, ads: 0.006, bloom: 0.022, kick: 0.035, snd: 'pistol', muz: 0.13 });
  gun('heavy_pistol', 'Тяжёлый пистолет .50', 1600, 'Огромный «пустынный» калибр. Семь патронов, каждый — как удар молота. Отдача подбрасывает ствол.',
    { model: 'deagle', dmg: 52, w: 2.0, mag: 7, ammo: 'ammo_50', rate: 0.36, reload: 1.55, spread: 0.04, ads: 0.007, bloom: 0.06, kick: 0.11, snd: 'heavy', muz: 0.19, knock: 3.2, stun: 0.45, hs: 2.5 });
  gun('mista_revolver', 'Револьвер Мисты', 2600, 'Тот самый револьвер Гвидо Мисты. Точный бой, шесть патронов .38 — и никогда, никогда не стреляй четвёртым.',
    { model: 'mista', dmg: 38, w: 1.0, mag: 6, ammo: 'bullets', rate: 0.33, reload: 1.35, rclip: 'reload', spread: 0.022, ads: 0.004, bloom: 0.025, kick: 0.055, snd: 'revolver', muz: 0.2, case: 0, hs: 2.6, mista: true });
  gun('micro_smg', 'Микро-пистолет-пулемёт', 1900, 'Компактный автомат: 30 патронов 9 мм за две секунды. Стреляет вкривь и вкось.',
    { model: 'uzi', cat: 'smg', dmg: 13, w: 1.6, mag: 30, ammo: 'ammo_9mm', rate: 0.065, auto: true, reload: 1.5, spread: 0.065, ads: 0.03, bloom: 0.012, kick: 0.02, snd: 'smg', muz: 0.15 });
  gun('smg', 'Пистолет-пулемёт', 2600, 'Классический ПП с прикладом: 30 патронов 9 мм, точнее микро-ПП, приятная отдача.',
    { model: 'mp5', cat: 'smg', grip: 'rifle', dmg: 16, w: 2.6, mag: 30, ammo: 'ammo_9mm', rate: 0.08, auto: true, reload: 1.9, spread: 0.045, ads: 0.012, bloom: 0.009, kick: 0.018, snd: 'smg', muz: 0.33, zoom: 44 });
  gun('assault_rifle', 'Автомат', 4200, 'Автомат под патрон 7,62. Магазин на 30, мощный и надёжный. Короткими очередями — точнее.',
    { model: 'ak', cat: 'rifle', grip: 'rifle', dmg: 27, w: 3.6, mag: 30, ammo: 'ammo_rifle', rate: 0.1, auto: true, reload: 2.2, spread: 0.04, ads: 0.008, bloom: 0.012, kick: 0.032, snd: 'rifle', muz: 0.52, range: 70, zoom: 40, knock: 2 });
  gun('carbine', 'Карабин', 5000, 'Лёгкий карабин с коллиматором: меньше отдачи, выше точность, магазин на 30.',
    { model: 'm4', cat: 'rifle', grip: 'rifle', dmg: 24, w: 3.2, mag: 30, ammo: 'ammo_rifle', rate: 0.09, auto: true, reload: 2.0, spread: 0.034, ads: 0.005, bloom: 0.009, kick: 0.024, snd: 'rifle', muz: 0.48, range: 75, zoom: 36, knock: 1.8 });
  gun('pump_shotgun', 'Помповое ружьё', 2100, 'Восемь патронов 12 калибра, в каждом — девять дробин. В упор сносит с ног. Заряжается по патрону.',
    { model: 'pump', cat: 'shotgun', grip: 'rifle', dmg: 11, pellets: 9, w: 3.4, mag: 8, ammo: 'ammo_12g', rate: 0.85, reload: 0.5, shell: 0.5, act: 'pump', spread: 0.1, ads: 0.075, bloom: 0, kick: 0.09, snd: 'shotgun', muz: 0.6, range: 26, hs: 1.4, knock: 5, stun: 0.6, zoom: 50 });
  gun('sawnoff', 'Обрез', 1300, 'Двустволка с отпиленными стволами. Два выстрела, огромный разброс — только в упор.',
    { model: 'sawnoff', cat: 'shotgun', dmg: 12, pellets: 11, w: 2.2, mag: 2, ammo: 'ammo_12g', rate: 0.22, reload: 1.7, rclip: 'reloadS', spread: 0.17, ads: 0.13, bloom: 0, kick: 0.13, snd: 'shotgun', muz: 0.32, range: 16, hs: 1.3, knock: 6, stun: 0.7, case: 0, zoom: 52 });
  gun('sniper', 'Снайперская винтовка', 7500, 'Винтовка с оптикой ×8 под патрон .308. Пять патронов, затвор после каждого выстрела. Попадание в голову — смерть.',
    { model: 'sniper', cat: 'sniper', grip: 'rifle', dmg: 115, w: 6.5, mag: 5, ammo: 'ammo_308', rate: 1.15, reload: 2.6, act: 'bolt', spread: 0.06, ads: 0.0005, bloom: 0.08, kick: 0.09, snd: 'sniper', muz: 0.9, range: 180, hs: 3.5, scope: true, zoom: 9, knock: 4, stun: 0.8, pierce: 1 });
  gun('lmg', 'Ручной пулемёт', 9500, 'Пулемёт с лентой на 100 патронов. Тяжёлый, долго перезаряжается, но прижимает к земле кого угодно.',
    { model: 'lmg', cat: 'heavy', grip: 'rifle', dmg: 25, w: 9.5, mag: 100, ammo: 'ammo_rifle', rate: 0.075, auto: true, reload: 4.2, spread: 0.06, ads: 0.022, bloom: 0.006, kick: 0.03, snd: 'lmg', muz: 0.62, range: 70, zoom: 44, knock: 2 });
  // патроны: в магазин заряжаются сами (R — вручную)
  const ammo = (id, name, price, desc, model) => add(id, { name, type: 'ammo', price, desc, hand: { cls: 'ammo', model: model || 'ammo' } });
  I.bullets.name = 'Патроны .38';
  I.bullets.desc = 'Патроны к револьверам. R — перезарядка, пустой барабан заряжается сам.';
  ammo('ammo_9mm', 'Патроны 9 мм', 2, 'Для пистолета и пистолетов-пулемётов.');
  ammo('ammo_50', 'Патроны .50 AE', 6, 'Для тяжёлого пистолета.');
  ammo('ammo_rifle', 'Винтовочные патроны 7,62', 3, 'Для автомата, карабина и пулемёта.');
  ammo('ammo_12g', 'Патроны 12 калибра', 4, 'Картечь для ружей.', 'shells');
  ammo('ammo_308', 'Снайперские патроны .308', 12, 'Для снайперской винтовки.');
  add('box_9mm', { name: 'Коробка 9 мм (30)', type: 'pack', pack: ['ammo_9mm', 30], price: 55, desc: '30 патронов 9 мм.' });
  add('box_50', { name: 'Коробка .50 AE (14)', type: 'pack', pack: ['ammo_50', 14], price: 80, desc: '14 патронов к тяжёлому пистолету.' });
  add('box_rifle', { name: 'Цинк 7,62 (60)', type: 'pack', pack: ['ammo_rifle', 60], price: 170, desc: '60 винтовочных патронов.' });
  add('box_12g', { name: 'Пачка 12 калибра (16)', type: 'pack', pack: ['ammo_12g', 16], price: 60, desc: '16 патронов с картечью.' });
  add('box_308', { name: 'Пачка .308 (10)', type: 'pack', pack: ['ammo_308', 10], price: 120, desc: '10 снайперских патронов.' });
  // метательное со взрывателем: nade — вид, fuse — запал (с)
  const nade = (id, name, price, desc, h) => add(id, { name, type: 'weapon', price, desc, hand: Object.assign({ cls: 'nade', grip: 'nade', cat: 'throw', reach: 1.0, arc: 1.0, dur: 999, w: 0.5, dmg: 4, stun: 0.1, knock: 0.3 }, h) });
  nade('grenade', 'Граната', 260, 'Осколочная граната. Запал 3 секунды, отскакивает от стен. Разрывает машины. ЛКМ — прицел и бросок.',
    { model: 'grenade', nade: 'frag', fuse: 3, thr: { dmg: 4, spin: 7, speed: 1.0 } });
  nade('molotov', 'Коктейль Молотова', 90, 'Бутылка с бензином и горящей тряпкой. Разбивается — огонь растекается по земле, перекидывается на траву и поджигает машины.',
    { model: 'molotov', nade: 'fire', thr: { dmg: 6, spin: 9, speed: 0.95, shatter: true } });
  nade('flashbang', 'Светошумовая граната', 170, 'Ослепляющая вспышка и оглушающий хлопок через 1,5 секунды. Враги теряют ориентацию. Не смотри на неё сам!',
    { model: 'flash', nade: 'flash', fuse: 1.5, thr: { dmg: 3, spin: 7, speed: 1.05 } });
  nade('smoke_grenade', 'Дымовая шашка', 130, 'Плотная дымовая завеса на 15 секунд: в дыму тебя не видят и не могут прицелиться.',
    { model: 'smoke', nade: 'smoke', fuse: 1.2, thr: { dmg: 3, spin: 6, speed: 1.0 } });
  // ближний бой
  add('combat_knife', { name: 'Боевой нож', type: 'weapon', price: 140, desc: 'Армейский нож с гардой и пилой на обухе. Быстрые глубокие удары, кровотечение.',
    hand: { cls: 'blade', model: 'cknife', dmg: 19, reach: 1.15, arc: 1.2, w: 0.3, dur: 260, bleed: 3.5, stun: 0.14, knock: 0.6, thr: { dmg: 22, stick: 0.5, spin: 11 } } });
  add('machete', { name: 'Мачете', type: 'weapon', price: 170, desc: 'Длинный рубящий клинок. Широкие взмахи, глубокие раны.',
    hand: { cls: 'blade', model: 'machete', chop: true, dmg: 25, reach: 1.45, arc: 1.9, w: 0.65, dur: 180, bleed: 4.5, stun: 0.2, knock: 1.2, thr: { dmg: 20, stick: 0.35, spin: 10 } } });
  add('crowbar', { name: 'Монтировка', type: 'weapon', price: 45, desc: 'Стальной гвоздодёр. Тяжёлый удар загнутым концом пробивает блок.',
    hand: { cls: 'blunt', model: 'crowbar', dmg: 22, reach: 1.35, arc: 1.5, w: 1.4, dur: 600, stun: 0.55, knock: 2.6, thr: { dmg: 18, spin: 9 } } });
  add('golf_club', { name: 'Клюшка для гольфа', type: 'weapon', price: 95, desc: 'Драйвер с титановой головкой. Длинный хлёсткий замах отправляет врага в полёт.',
    hand: { cls: 'blunt', model: 'golf', two: true, dmg: 18, reach: 1.8, arc: 2.1, w: 0.45, dur: 120, stun: 0.4, knock: 4.6, thr: { dmg: 12, spin: 11 } } });
  add('knuckles', { name: 'Кастет', type: 'weapon', price: 75, desc: 'Латунный кастет. Кулаки бьют сильнее и звонче — обычные удары и серии остаются твоими.',
    hand: { cls: 'blunt', grip: 'fist', model: 'knuckles', fist: 1.55, dmg: 14, reach: 1.0, arc: 1.1, w: 0.25, dur: 999, stun: 0.35, knock: 1.6, thr: { dmg: 6, spin: 9 } } });
  // Оружейный магазин «Калибр»: раздел → товары
  J.GUNSHOP = [
    ['Пистолеты', ['pistol', 'revolver', 'heavy_pistol']],
    ['Пистолеты-пулемёты', ['micro_smg', 'smg']],
    ['Винтовки', ['assault_rifle', 'carbine', 'lmg']],
    ['Ружья', ['pump_shotgun', 'sawnoff']],
    ['Снайперское', ['sniper']],
    ['Метательное', ['grenade', 'molotov', 'flashbang', 'smoke_grenade']],
    ['Холодное', ['combat_knife', 'machete', 'crowbar', 'golf_club', 'knuckles', 'bat']],
    ['Патроны', ['ammo_box', 'box_9mm', 'box_50', 'box_rifle', 'box_12g', 'box_308']],
  ];

  J.ITEMS = I;

  J.CORPSE_PARTS = [
    { id: 'left_arm', name: 'Левая рука', buff: { maxHp: 20 }, desc: '+20 к здоровью' },
    { id: 'eyes', name: 'Глаза', buff: { crit: 0.06 }, desc: '+6% крит' },
    { id: 'heart', name: 'Сердце', buff: { regen: 0.6 }, desc: 'Регенерация здоровья' },
    { id: 'right_arm', name: 'Правая рука', buff: { power: 0.1 }, desc: '+10% урон' },
    { id: 'ears', name: 'Уши', buff: { reveal: 1 }, desc: 'Чувствуешь врагов' },
    { id: 'legs', name: 'Ноги', buff: { speed: 0.08 }, desc: '+8% скорость' },
    { id: 'spine', name: 'Позвоночник', buff: { se: 20 }, desc: '+20 энергии стенда' },
    { id: 'torso', name: 'Торс', buff: { armor: 0.08 }, desc: '-8% урона' },
    { id: 'head', name: 'Голова', buff: { xp: 0.2 }, desc: '+20% опыт' },
  ];

  // Магазины: тип здания → ассортимент
  J.SHOPS = {
    shop: ['onigiri', 'sandwich', 'coffee', 'water', 'cola', 'energy_drink', 'bandage', 'coffee_gum', 'lottery', 'kitchen_knife'],
    restaurant: ['pizza', 'burger', 'curry', 'wine', 'tea', 'coffee'],
    hospital: ['medkit', 'bandage', 'blood_pack'],
    black_market: ['arrow', 'stone_mask', 'rokakaka', 'revolver', 'mista_revolver', 'ammo_box', 'box_9mm', 'micro_smg', 'sawnoff', 'molotov', 'knife_set', 'switchblade', 'knuckles', 'bearing_bag', 'coins', 'rumor_map', 'umbrella', 'blood_pack', 'luck_charm', 'clackers'],
    gym: ['bat', 'golf_club', 'energy_drink', 'water'],
    bar: ['cola', 'wine'],
    stable: ['horse', 'water', 'sandwich'],
    sport: ['clackers', 'energy_drink', 'water', 'bandage'],
  };
  // Региональная еда для ресторанов
  J.REGION_FOOD = {
    morioh: ['onigiri', 'curry', 'tea', 'coffee'],
    naples: ['pizza', 'wine', 'coffee'],
    rome: ['pizza', 'wine', 'coffee'],
    venice: ['pizza', 'wine', 'coffee'],
    cairo: ['koshari', 'tea', 'water'],
    london: ['fish_chips', 'tea', 'wine'],
    newyork: ['burger', 'coffee', 'sandwich'],
    sandiego: ['burger', 'water', 'coffee'],
    arizona: ['burger', 'water'],
    florida: ['burger', 'coffee', 'water'],
    mexico: ['burger', 'water', 'coffee'],
    varanasi: ['curry', 'tea', 'water'],
    singapore: ['laksa', 'tea', 'curry'],
    tibet: ['tea', 'water', 'onigiri'],
    alps: ['tea', 'wine', 'sandwich'],
    airsupplena: ['wine', 'pizza', 'water'],
  };
})();
