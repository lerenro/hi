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
  add('revolver', { name: 'Револьвер', type: 'gear', price: 900, desc: 'Без стенда стреляет обычными пулями (Z без стиля).' });
  add('horse', { name: 'Лошадь', type: 'gear', price: 3500, desc: 'Верхом по пустыне! Скорость +45% вне города. Для Золотого Вращения.' });
  add('lottery', { name: 'Лотерейный билет', type: 'lottery', price: 10, desc: 'Может, повезёт?' });
  add('rumor_map', { name: 'Карта слухов', type: 'rumor', price: 300, desc: 'Отмечает на карте место, где видели Стрелу или маску.' });
  add('luck_charm', { name: 'Амулет удачи', type: 'gear', price: 700, desc: '+5% к шансу пережить Стрелу.' });
  add('dio_diary', { name: 'Дневник ДИО', type: 'lore', price: 0, desc: '«Спиральная лестница. Жук-носорог. Город-призрак. Ангел. Фиговое дерево...»' });
  add('package', { name: 'Посылка', type: 'quest', price: 0, desc: 'Чья-то посылка. Нужно доставить.' });
  add('cat', { name: 'Потерявшийся кот', type: 'quest', price: 0, desc: 'Пушистый беглец. Хозяин будет рад.' });
  add('clue', { name: 'Улика', type: 'quest', price: 0, desc: 'Странная улика.' });

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
    shop: ['onigiri', 'sandwich', 'coffee', 'water', 'energy_drink', 'bandage', 'coffee_gum', 'lottery'],
    restaurant: ['pizza', 'burger', 'curry', 'wine', 'tea', 'coffee'],
    hospital: ['medkit', 'bandage', 'blood_pack'],
    black_market: ['arrow', 'stone_mask', 'rokakaka', 'revolver', 'rumor_map', 'umbrella', 'blood_pack', 'luck_charm', 'clackers'],
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
