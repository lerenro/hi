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
  add('bullets', { name: 'Патроны .38', type: 'ammo', price: 3, desc: 'Патроны к револьверу. Когда барабан пуст, перезарядка идёт сама.', hand: { cls: 'ammo', model: 'ammo' } });
  // упаковки: при покупке распаковываются в поштучные вещи
  add('ammo_box', { name: 'Коробка патронов .38', type: 'pack', pack: ['bullets', 12], price: 30, desc: '12 патронов к револьверу.' });
  add('knife_set', { name: 'Набор метательных ножей', type: 'pack', pack: ['throw_knife', 5], price: 80, desc: 'Пять сбалансированных ножей в чехле.' });
  add('bearing_bag', { name: 'Мешочек подшипников', type: 'pack', pack: ['ball_bearings', 10], price: 40, desc: 'Десять стальных шариков.' });
  add('cola', { name: 'Газировка в стекле', type: 'food', food: 4, energy: 12, price: 3, desc: 'Холодная газировка. Пустая бутылка останется у тебя.' });
  I.revolver.hand = { cls: 'gun', model: 'revolver', dmg: 30, reach: 1.0, arc: 1.0, w: 1.0, dur: 9999, mag: 6, ammo: 'bullets', rate: 0.42, reload: 1.6, stun: 0.3, knock: 1.6, thr: { dmg: 8, spin: 6 } };
  I.steel_ball.hand = { cls: 'throw', model: 'steelball', dmg: 8, reach: 1.0, arc: 1.0, w: 0.5, dur: 9999, stun: 0.2, knock: 1, thr: { dmg: 18, spin: 0, ret: true, speed: 1.1 } };
  I.steel_ball.desc = 'Шары семьи Цеппели. Нужны для Вращения. Брошенный из руки шар возвращается.';
  I.wine.empty = 'bottle';
  I.cola.empty = 'bottle';

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
    black_market: ['arrow', 'stone_mask', 'rokakaka', 'revolver', 'ammo_box', 'knife_set', 'switchblade', 'bearing_bag', 'rumor_map', 'umbrella', 'blood_pack', 'luck_charm', 'clackers'],
    gym: ['bat', 'energy_drink', 'water'],
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
