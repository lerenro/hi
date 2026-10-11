'use strict';
// Стенды. stats: [Сила, Скорость, Дальность, Прочность, Точность, Потенциал]
// abil: Q / E / R. lvl — уровень стенда для открытия способности.
// Виды способностей описаны в abilities.js.
(function () {
  const S = [];
  const add = (o) => S.push(o);

  // ---------- Часть 3 ----------
  add({
    id: 'star_platinum', name: 'Star Platinum', ru: 'Звёздная Платина', part: 3, rar: 2,
    stats: 'AAC AAA', c1: '#7a5cd6', c2: '#2aa7d8', head: 'mane', cry: 'ОРА', type: 'Ближний бой',
    desc: 'Невероятно сильный и точный стенд ближнего боя. Видит муху на расстоянии.',
    abil: [
      { name: 'ОРА-раш', kind: 'rush', dmg: 4, dur: 1.4, range: 1.6, cd: 6, cost: 14, lvl: 1 },
      { name: 'Звёздный палец', kind: 'beam', dmg: 26, range: 6, width: 0.45, color: '#c7b6ff', cd: 5, cost: 12, lvl: 3 },
      { name: 'Финальный ОРА', kind: 'strike', dmg: 60, range: 1.8, knock: 9, stun: 1.2, cd: 14, cost: 25, lvl: 6 },
    ],
    evo: { to: 'star_platinum_tw', how: 'witness', note: 'Пережить остановку времени врагом (ур. 5+)' },
  });
  add({
    id: 'star_platinum_tw', name: 'Star Platinum: The World', ru: 'Звёздная Платина: Мир', part: 3, rar: 0, evolved: true,
    stats: 'AAC AAA', c1: '#6b4fd0', c2: '#f2c230', head: 'mane', cry: 'ОРА', type: 'Ближний бой',
    desc: 'Платина научилась останавливать время. Пять секунд — и всё решено.',
    abil: [
      { name: 'ОРА-раш', kind: 'rush', dmg: 5, dur: 1.5, range: 1.7, cd: 6, cost: 14, lvl: 1 },
      { name: 'Звёздный палец', kind: 'beam', dmg: 30, range: 6.5, width: 0.45, color: '#c7b6ff', cd: 5, cost: 12, lvl: 1 },
      { name: 'Звёздная Платина: Мир!', kind: 'timestop', dur: 3, cd: 40, cost: 55, lvl: 1 },
    ],
  });
  add({
    id: 'magicians_red', name: "Magician's Red", ru: 'Красный Маг', part: 3, rar: 3,
    stats: 'BBC BCD', c1: '#d8442b', c2: '#ffb028', head: 'bird', cry: 'КУА', type: 'Ближний бой',
    desc: 'Повелитель огня с головой птицы. Пламя гнётся по воле владельца.',
    basicFire: true,
    abil: [
      { name: 'Огненный анкх', kind: 'shoot', n: 1, dmg: 18, speed: 9, range: 9, proj: 'flame', color: '#ff7b1c', size: 0.35, fx: { burn: 3 }, cd: 2.5, cost: 8, lvl: 1 },
      { name: 'Красные путы', kind: 'nova', radius: 3.2, dmg: 18, color: '#ff5a1c', fx: { burn: 4, slow: 2 }, cd: 9, cost: 18, lvl: 3 },
      { name: 'Ураган перекрёстного огня', kind: 'shoot', n: 7, spread: 70, dmg: 16, speed: 8, range: 10, proj: 'flame', color: '#ff9b2c', size: 0.32, homing: 2.2, fx: { burn: 4 }, cd: 14, cost: 30, lvl: 6 },
    ],
  });
  add({
    id: 'hermit_purple', name: 'Hermit Purple', ru: 'Пурпурный Отшельник', part: 3, rar: 3,
    stats: 'DCD ADE', c1: '#8b3fc4', c2: '#c06bff', head: 'vines', cry: 'ОХ МОЙ БОГ', type: 'Колючие лозы',
    desc: 'Терновые лозы для предсказаний и захвата. Проводит хамон.',
    abil: [
      { name: 'Хватка лоз', kind: 'pull', range: 7, dmg: 8, stun: 0.8, cd: 4, cost: 8, lvl: 1 },
      { name: 'Ясновидение', kind: 'reveal', dur: 25, cd: 30, cost: 20, lvl: 2 },
      { name: 'Хамон по лозам', kind: 'nova', radius: 3.5, dmg: 24, color: '#ffd84a', hamon: true, fx: { stun: 1 }, cd: 10, cost: 20, lvl: 5 },
    ],
  });
  add({
    id: 'hierophant_green', name: 'Hierophant Green', ru: 'Зелёный Иерофант', part: 3, rar: 3,
    stats: 'CBA CCD', c1: '#2bbf6a', c2: '#bfff6b', head: 'helmet', cry: 'ИЗУМРУДНЫЙ ВСПЛЕСК', type: 'Дальний бой',
    desc: 'Стенд-лента, способный разматываться на огромные расстояния.',
    ranged: true,
    abil: [
      { name: 'Изумрудный всплеск', kind: 'shoot', n: 6, spread: 40, dmg: 8, speed: 12, range: 10, proj: 'emerald', color: '#3dff8a', size: 0.22, cd: 2.5, cost: 8, lvl: 1 },
      { name: 'Барьер 20 метров', kind: 'trap', n: 8, radius: 4.5, dmg: 14, life: 25, color: '#3dff8a', cd: 16, cost: 25, lvl: 3, fx: { stun: 0.6 } },
      { name: 'Захват тела', kind: 'hex', status: 'charm', dur: 8, range: 6, cd: 22, cost: 30, lvl: 6 },
    ],
  });
  add({
    id: 'silver_chariot', name: 'Silver Chariot', ru: 'Серебряная Колесница', part: 3, rar: 3,
    stats: 'CAC BBC', c1: '#c7ccd8', c2: '#8fa3c9', head: 'helmet', extra: 'sword', cry: 'ХОРА', type: 'Ближний бой',
    desc: 'Рыцарь с рапирой. Сбросив доспех, становится неуловим.',
    abil: [
      { name: 'Шквал рапиры', kind: 'rush', dmg: 3.5, dur: 1.3, range: 2, cd: 5, cost: 12, lvl: 1 },
      { name: 'Снять доспехи', kind: 'buff', buff: 'haste', val: 0.8, dur: 8, cd: 18, cost: 20, lvl: 3 },
      { name: 'Выстрел клинком', kind: 'shoot', n: 1, dmg: 40, speed: 16, range: 9, proj: 'blade', color: '#e8eefc', size: 0.3, pierce: 3, cd: 8, cost: 18, lvl: 6 },
    ],
    evo: { to: 'chariot_requiem', how: 'arrow', note: 'Стрела на 10 уровне стенда' },
  });
  add({
    id: 'the_fool', name: 'The Fool', ru: 'Шут', part: 3, rar: 4,
    stats: 'BCD CDC', c1: '#c9a46b', c2: '#3b3b46', head: 'mask', cry: 'ГАВ', type: 'Песок',
    desc: 'Стенд из песка. Принимает любую форму, может летать.',
    abil: [
      { name: 'Песчаный удар', kind: 'nova', radius: 2.6, dmg: 16, color: '#d9b77a', fx: { slow: 2 }, cd: 5, cost: 10, lvl: 1 },
      { name: 'Песчаные крылья', kind: 'buff', buff: 'fly', dur: 12, cd: 20, cost: 25, lvl: 2 },
      { name: 'Песчаный двойник', kind: 'summon', unit: 'decoy', n: 1, life: 12, cd: 18, cost: 20, lvl: 5 },
    ],
  });
  add({
    id: 'the_world', name: 'The World', ru: 'Мир', part: 3, rar: 1,
    stats: 'AAC AAB', c1: '#f2c230', c2: '#2c7f4f', head: 'helmet', cry: 'МУДА', type: 'Ближний бой',
    desc: 'Стенд ДИО. Останавливает время. ZA WARUDO!',
    abil: [
      { name: 'МУДА-раш', kind: 'rush', dmg: 4.5, dur: 1.4, range: 1.6, cd: 6, cost: 14, lvl: 1 },
      { name: 'Ножи', kind: 'shoot', n: 5, spread: 30, dmg: 10, speed: 13, range: 10, proj: 'knife', color: '#e9edf5', size: 0.22, cd: 4, cost: 12, lvl: 3 },
      { name: 'ZA WARUDO!', kind: 'timestop', dur: 4, cd: 45, cost: 60, lvl: 6 },
    ],
  });
  add({
    id: 'emperor', name: 'Emperor', ru: 'Император', part: 3, rar: 4,
    stats: 'BBB CEE', c1: '#d2b05b', c2: '#7c5a2a', head: 'none', cry: 'БАХ', type: 'Револьвер',
    desc: 'Стенд-револьвер Хол Хорса. Пули поворачивают в полёте.',
    ranged: true,
    abil: [
      { name: 'Пули Императора', kind: 'shoot', n: 2, spread: 14, dmg: 14, speed: 15, range: 12, proj: 'bullet', color: '#ffd166', size: 0.14, homing: 3, cd: 1.6, cost: 6, lvl: 1 },
      { name: 'Шквал выстрелов', kind: 'shoot', n: 6, spread: 50, dmg: 12, speed: 15, range: 12, proj: 'bullet', color: '#ffd166', size: 0.14, homing: 4, cd: 7, cost: 16, lvl: 3 },
      { name: 'Пуля в лоб', kind: 'shoot', n: 1, dmg: 70, speed: 20, range: 14, proj: 'bullet', color: '#fff2a8', size: 0.18, homing: 6, cd: 15, cost: 25, lvl: 6 },
    ],
  });
  add({
    id: 'justice', name: 'Justice', ru: 'Правосудие', part: 3, rar: 4,
    stats: 'DEA BEE', c1: '#9aa2b8', c2: '#53586b', head: 'skull', cry: 'КЕ-КЕ-КЕ', type: 'Туман',
    desc: 'Стенд-туман. Превращает раненых в марионеток.',
    abil: [
      { name: 'Туман', kind: 'field', radius: 4, dur: 8, dps: 5, color: '#c9cedb', fx: { slow: 1 }, cd: 12, cost: 18, lvl: 1 },
      { name: 'Марионетка', kind: 'hex', status: 'charm', dur: 10, range: 5, cd: 16, cost: 22, lvl: 3 },
      { name: 'Армия мертвецов', kind: 'summon', unit: 'zombie_ally', n: 4, life: 18, cd: 30, cost: 40, lvl: 6 },
    ],
  });
  add({
    id: 'death_13', name: 'Death 13', ru: 'Смерть 13', part: 3, rar: 4,
    stats: 'CCE DBB', c1: '#3d3550', c2: '#e3e0ea', head: 'skull', extra: 'scythe', cry: 'ЛЭЛЭЛЭ', type: 'Сон',
    desc: 'Жнец из снов. Во сне ты бессилен.',
    abil: [
      { name: 'Взмах косы', kind: 'strike', dmg: 22, range: 2.2, arc: 1.6, knock: 3, cd: 2.5, cost: 6, lvl: 1 },
      { name: 'Колыбельная', kind: 'hex', status: 'sleep', dur: 5, range: 6, aoe: 2.5, cd: 14, cost: 20, lvl: 3 },
      { name: 'Кошмар', kind: 'nova', radius: 4, dmg: 34, color: '#7d5cb3', fx: { stun: 1.2 }, cd: 16, cost: 28, lvl: 6 },
    ],
  });
  add({
    id: 'anubis', name: 'Anubis', ru: 'Анубис', part: 3, rar: 4,
    stats: 'BBE AEC', c1: '#7a7f99', c2: '#c9cdd9', head: 'dog', extra: 'sword', cry: 'ДЗИН', type: 'Меч',
    desc: 'Проклятый меч, запоминающий каждый удар противника.',
    abil: [
      { name: 'Рассечение', kind: 'strike', dmg: 24, range: 2.2, arc: 1.4, cd: 2, cost: 6, lvl: 1 },
      { name: 'Обучение', kind: 'buff', buff: 'power', val: 0.6, dur: 12, cd: 20, cost: 18, lvl: 3 },
      { name: 'Сквозь стены', kind: 'dash', dist: 6, dmg: 30, invuln: true, ghost: true, cd: 10, cost: 20, lvl: 6 },
    ],
  });
  add({
    id: 'geb', name: 'Geb', ru: 'Геб', part: 3, rar: 4,
    stats: 'CBA BDB', c1: '#2f7fd1', c2: '#9bd3ff', head: 'none', cry: 'ШУХ', type: 'Вода',
    desc: 'Стенд-вода с когтем. Атакует на звук из-под песка.',
    ranged: true,
    abil: [
      { name: 'Водяной коготь', kind: 'shoot', n: 1, dmg: 20, speed: 10, range: 14, proj: 'water', color: '#5ab3ff', size: 0.28, homing: 4, pierce: 2, cd: 2.2, cost: 8, lvl: 1 },
      { name: 'Слух пустыни', kind: 'reveal', dur: 15, cd: 25, cost: 12, lvl: 3 },
      { name: 'Режущий поток', kind: 'beam', dmg: 36, range: 10, width: 0.5, color: '#7fc4ff', cd: 9, cost: 22, lvl: 6 },
    ],
  });
  add({
    id: 'horus', name: 'Horus', ru: 'Хорус', part: 3, rar: 4,
    stats: 'BBD CCC', c1: '#8fd5ff', c2: '#e6f7ff', head: 'bird', cry: 'КИИ', type: 'Лёд',
    desc: 'Ледяной стенд пса-сокола Пет Шопа.',
    abil: [
      { name: 'Ледяные копья', kind: 'shoot', n: 3, spread: 24, dmg: 14, speed: 11, range: 10, proj: 'ice', color: '#bfe9ff', size: 0.25, fx: { slow: 2 }, cd: 2.5, cost: 8, lvl: 1 },
      { name: 'Ледяная клетка', kind: 'nova', radius: 3, dmg: 20, color: '#a7e3ff', fx: { freeze: 1.6 }, cd: 12, cost: 20, lvl: 3 },
      { name: 'Ледяной шторм', kind: 'shoot', n: 12, spread: 360, dmg: 16, speed: 9, range: 9, proj: 'ice', color: '#d8f3ff', size: 0.25, fx: { freeze: 0.6 }, cd: 16, cost: 32, lvl: 6 },
    ],
  });
  add({
    id: 'cream', name: 'Cream', ru: 'Крем', part: 3, rar: 2,
    stats: 'BBD CCD', c1: '#3c2f48', c2: '#c8b6dd', head: 'mask', cry: 'ГЛОТ', type: 'Пустота',
    desc: 'Стенд Ванилла Айса. Пасть, ведущая в пустоту.',
    abil: [
      { name: 'Удар', kind: 'strike', dmg: 26, range: 1.8, arc: 1.2, knock: 4, cd: 2, cost: 6, lvl: 1 },
      { name: 'Сфера пустоты', kind: 'buff', buff: 'void', dur: 4, cd: 22, cost: 35, lvl: 3 },
      { name: 'Поглощение', kind: 'dash', dist: 9, dmg: 60, invuln: true, ghost: true, cd: 14, cost: 30, lvl: 6 },
    ],
  });
  add({
    id: 'tower_of_gray', name: 'Tower of Gray', ru: 'Серая Башня', part: 3, rar: 5,
    stats: 'EAA EAE', c1: '#7d7d86', c2: '#d64d6c', head: 'bug', cry: 'ЖЖЖ', type: 'Жук',
    desc: 'Крошечный жук с языком-иглой. Быстрее пуль.',
    ranged: true,
    abil: [
      { name: 'Язык-игла', kind: 'shoot', n: 1, dmg: 12, speed: 18, range: 10, proj: 'needle', color: '#ff6b8a', size: 0.12, homing: 6, cd: 1, cost: 4, lvl: 1 },
      { name: 'Иглострел', kind: 'shoot', n: 5, spread: 60, dmg: 9, speed: 16, range: 9, proj: 'needle', color: '#ff6b8a', size: 0.12, homing: 5, cd: 6, cost: 12, lvl: 3 },
      { name: 'Неуловимость', kind: 'buff', buff: 'haste', val: 1, dur: 6, cd: 18, cost: 18, lvl: 5 },
    ],
  });

  // ---------- Часть 4 ----------
  add({
    id: 'crazy_diamond', name: 'Crazy Diamond', ru: 'Безумный Бриллиант', part: 4, rar: 2,
    stats: 'AAD BBC', c1: '#e58bd0', c2: '#6ad1ff', head: 'helmet', cry: 'ДОРА', type: 'Ближний бой',
    desc: 'Восстанавливает всё, кроме своего владельца.',
    abil: [
      { name: 'ДОРА-раш', kind: 'rush', dmg: 4.2, dur: 1.4, range: 1.5, cd: 6, cost: 14, lvl: 1 },
      { name: 'Исправление', kind: 'restore', radius: 4, heal: 40, stun: 2.5, cd: 12, cost: 20, lvl: 3 },
      { name: 'Самонаводящиеся осколки', kind: 'shoot', n: 8, spread: 360, dmg: 14, speed: 10, range: 10, proj: 'shard', color: '#ff9be6', size: 0.2, homing: 5, cd: 12, cost: 26, lvl: 6 },
    ],
  });
  add({
    id: 'the_hand', name: 'The Hand', ru: 'Рука', part: 4, rar: 3,
    stats: 'BBD CCC', c1: '#3f63c9', c2: '#f2c230', head: 'helmet', cry: 'ВЖУХ', type: 'Ближний бой',
    desc: 'Правая рука стирает пространство. Окуясу не понимает, куда оно девается.',
    abil: [
      { name: 'Стирание', kind: 'strike', dmg: 45, range: 1.8, arc: 1, pierceDef: true, cd: 5, cost: 14, lvl: 1 },
      { name: 'Притяжение', kind: 'pull', range: 8, dmg: 6, stun: 0.6, cd: 4, cost: 8, lvl: 2 },
      { name: 'Шаг сквозь пространство', kind: 'blink', range: 7, cd: 5, cost: 10, lvl: 4 },
    ],
  });
  add({
    id: 'echoes_1', name: 'Echoes Act 1', ru: 'Эхо, акт 1', part: 4, rar: 3,
    stats: 'EEB DCA', c1: '#7ed957', c2: '#e3f7c8', head: 'egg', cry: 'БУУУН', type: 'Звук',
    desc: 'Звуковые иероглифы. Растёт вместе с владельцем.',
    ranged: true,
    abil: [
      { name: 'Звуковой иероглиф', kind: 'shoot', n: 1, dmg: 8, speed: 9, range: 12, proj: 'sound', color: '#a6ff7e', size: 0.32, fx: { slow: 2 }, cd: 2, cost: 6, lvl: 1 },
      { name: 'Оглушающий звук', kind: 'nova', radius: 3, dmg: 6, color: '#a6ff7e', fx: { stun: 1.2 }, cd: 10, cost: 14, lvl: 2 },
      { name: 'Вой', kind: 'hex', status: 'slow', dur: 6, range: 8, aoe: 3, cd: 14, cost: 16, lvl: 3 },
    ],
    evo: { to: 'echoes_2', how: 'level', lvl: 4 },
  });
  add({
    id: 'echoes_2', name: 'Echoes Act 2', ru: 'Эхо, акт 2', part: 4, rar: 0, evolved: true,
    stats: 'CDB CCA', c1: '#5fc74a', c2: '#ffcf33', head: 'egg', cry: 'ДОГОН', type: 'Звук',
    desc: 'Хвост-иероглиф: звуки становятся реальностью. «Шшш» обжигает!',
    ranged: true,
    abil: [
      { name: 'Звук «ДОГОН»', kind: 'shoot', n: 1, dmg: 16, speed: 9, range: 12, proj: 'sound', color: '#ffd23f', size: 0.34, explode: 1.6, cd: 2.2, cost: 8, lvl: 1 },
      { name: 'Звуковые ловушки', kind: 'trap', n: 4, radius: 3, dmg: 22, life: 30, color: '#ffd23f', fx: { burn: 3 }, cd: 12, cost: 18, lvl: 1 },
      { name: 'Шшш-ожог', kind: 'nova', radius: 3, dmg: 24, color: '#ff8a1c', fx: { burn: 5 }, cd: 12, cost: 20, lvl: 1 },
    ],
    evo: { to: 'echoes_3', how: 'level', lvl: 7 },
  });
  add({
    id: 'echoes_3', name: 'Echoes Act 3', ru: 'Эхо, акт 3', part: 4, rar: 0, evolved: true,
    stats: 'BBC BCA', c1: '#4cb848', c2: '#2a2f45', head: 'helmet', cry: 'S-H-I-T', type: 'Ближний бой',
    desc: 'Three Freeze! Делает врагов неподъёмно тяжёлыми. Let\'s kill da ho!',
    abil: [
      { name: 'S-H-I-T раш', kind: 'rush', dmg: 4, dur: 1.2, range: 1.5, cd: 6, cost: 12, lvl: 1 },
      { name: 'Тройная заморозка', kind: 'hex', status: 'heavy', dur: 6, range: 5, cd: 9, cost: 18, lvl: 1 },
      { name: 'Звуковая бомба', kind: 'shoot', n: 1, dmg: 40, speed: 9, range: 12, proj: 'sound', color: '#ffd23f', size: 0.4, explode: 2.4, cd: 10, cost: 22, lvl: 1 },
    ],
  });
  add({
    id: 'heavens_door', name: "Heaven's Door", ru: 'Небесная Дверь', part: 4, rar: 3,
    stats: 'DBB DCA', c1: '#ffe9a8', c2: '#2e8bd8', head: 'hat', cry: 'ХЕВЕНС ДОР', type: 'Книга',
    desc: 'Превращает людей в книги. Можно прочесть всё и вписать приказ.',
    abil: [
      { name: 'Открыть книгу', kind: 'hex', status: 'book', dur: 4, range: 5, cd: 8, cost: 16, lvl: 1 },
      { name: 'Росчерк пера', kind: 'shoot', n: 3, spread: 20, dmg: 14, speed: 12, range: 9, proj: 'ink', color: '#2b2b33', size: 0.2, cd: 3, cost: 8, lvl: 2 },
      { name: '«Не может ранить меня»', kind: 'buff', buff: 'invuln', dur: 5, cd: 30, cost: 35, lvl: 6 },
    ],
  });
  add({
    id: 'killer_queen', name: 'Killer Queen', ru: 'Королева-убийца', part: 4, rar: 2,
    stats: 'ABD BBA', c1: '#e889c9', c2: '#6b4a9e', head: 'cat', cry: 'КЛИК', type: 'Бомба',
    desc: 'Превращает всё, чего коснётся, в бомбу. Хочу спокойной жизни.',
    abil: [
      { name: 'Первая бомба', kind: 'bomb', dmg: 55, radius: 2.2, range: 2, cd: 4, cost: 14, lvl: 1 },
      { name: 'Шиер Харт Атак', kind: 'summon', unit: 'sha', n: 1, life: 16, cd: 18, cost: 25, lvl: 3 },
      { name: 'Пузыри Стрей Кэта', kind: 'shoot', n: 4, spread: 50, dmg: 22, speed: 5, range: 9, proj: 'bubble', color: '#e8f7ff', size: 0.3, explode: 1.8, homing: 1.5, cd: 9, cost: 20, lvl: 6 },
    ],
    evo: { to: 'kq_btd', how: 'arrow', minLvl: 8, note: 'Стрела на 8+ уровне стенда' },
  });
  add({
    id: 'kq_btd', name: 'Killer Queen: Bites the Dust', ru: 'Королева-убийца: Пожирающая пыль', part: 4, rar: 0, evolved: true,
    stats: 'ABD BBA', c1: '#d670b8', c2: '#f2c230', head: 'cat', cry: 'КЛИК', type: 'Бомба',
    desc: 'Третья бомба. Время откатывается назад, а судьба повторяется.',
    abil: [
      { name: 'Первая бомба', kind: 'bomb', dmg: 65, radius: 2.4, range: 2, cd: 4, cost: 14, lvl: 1 },
      { name: 'Шиер Харт Атак', kind: 'summon', unit: 'sha', n: 2, life: 16, cd: 18, cost: 25, lvl: 1 },
      { name: 'Bites the Dust', kind: 'rewind', back: 5, dmg: 70, radius: 4, cd: 35, cost: 45, lvl: 1 },
    ],
  });
  add({
    id: 'harvest', name: 'Harvest', ru: 'Урожай', part: 4, rar: 4,
    stats: 'EBA CEC', c1: '#d9b23a', c2: '#7a5a19', head: 'bug', cry: 'ДЗЗ', type: 'Колония',
    desc: 'Пятьсот крошечных жуков. Находят деньги и всё что угодно.',
    swarm: true,
    abil: [
      { name: 'Рой', kind: 'summon', unit: 'bug', n: 6, life: 14, cd: 10, cost: 16, lvl: 1 },
      { name: 'Поиск', kind: 'reveal', dur: 20, money: true, cd: 40, cost: 15, lvl: 2 },
      { name: 'Инъекция спирта', kind: 'nova', radius: 3.5, dmg: 14, color: '#d9b23a', fx: { poison: 6 }, cd: 12, cost: 20, lvl: 5 },
    ],
  });
  add({
    id: 'bad_company', name: 'Bad Company', ru: 'Плохая Компания', part: 4, rar: 4,
    stats: 'BBC BCC', c1: '#556b2f', c2: '#a8b07a', head: 'helmet', cry: 'ОГОНЬ', type: 'Армия',
    desc: 'Армия игрушечных солдат, танков и вертолётов.',
    swarm: true,
    abil: [
      { name: 'Пехота', kind: 'summon', unit: 'soldier', n: 4, life: 16, cd: 12, cost: 18, lvl: 1 },
      { name: 'Ракеты «Апачи»', kind: 'shoot', n: 4, spread: 30, dmg: 15, speed: 10, range: 11, proj: 'missile', color: '#ffcf5a', size: 0.2, explode: 1.4, homing: 3, cd: 8, cost: 20, lvl: 3 },
      { name: 'Мины', kind: 'trap', n: 6, radius: 3.5, dmg: 30, life: 30, color: '#a8b07a', cd: 16, cost: 24, lvl: 6 },
    ],
  });
  add({
    id: 'red_hot_chili_pepper', name: 'Red Hot Chili Pepper', ru: 'Ред Хот Чили Пеппер', part: 4, rar: 4,
    stats: 'AAA AEA', c1: '#ffb52a', c2: '#ff4a2a', head: 'horn', cry: 'БЗЗТ', type: 'Электричество',
    desc: 'Живёт в проводах. Чем больше энергии, тем сильнее.',
    abil: [
      { name: 'Разряд', kind: 'beam', dmg: 18, range: 7, width: 0.35, color: '#ffe14a', fx: { stun: 0.5 }, cd: 3, cost: 8, lvl: 1 },
      { name: 'Бег по проводам', kind: 'dash', dist: 8, dmg: 20, invuln: true, cd: 6, cost: 12, lvl: 2 },
      { name: 'Перегрузка', kind: 'nova', radius: 4, dmg: 40, color: '#ffe14a', fx: { stun: 1.5 }, cd: 16, cost: 32, lvl: 6 },
    ],
  });
  add({
    id: 'pearl_jam', name: 'Pearl Jam', ru: 'Перл Джем', part: 4, rar: 4,
    stats: 'EBE BEC', c1: '#f2a7c9', c2: '#ffe2a8', head: 'egg', cry: 'БУОНО', type: 'Кулинария',
    desc: 'Стенд Тонио Труссарди. Еда лечит всё — от зубов до плеч.',
    swarm: true,
    abil: [
      { name: 'Целебное блюдо', kind: 'heal', amt: 0.35, cd: 12, cost: 18, lvl: 1 },
      { name: 'Пряный удар', kind: 'shoot', n: 3, spread: 30, dmg: 12, speed: 10, range: 9, proj: 'orb', color: '#ff6b6b', size: 0.22, fx: { burn: 2 }, cd: 3, cost: 8, lvl: 2 },
      { name: 'Фирменный ужин', kind: 'buff', buff: 'regen', val: 6, dur: 12, cd: 30, cost: 30, lvl: 5 },
    ],
  });
  add({
    id: 'highway_star', name: 'Highway Star', ru: 'Звезда Шоссе', part: 4, rar: 4,
    stats: 'CBA ECC', c1: '#7fd0ff', c2: '#ffffff', head: 'mask', cry: 'НЯМ', type: 'Погоня',
    desc: 'Гонится за жертвой со скоростью 60 км/ч и пьёт её силы.',
    ranged: true,
    abil: [
      { name: 'Поглощение', kind: 'hex', status: 'drain', dur: 5, range: 6, cd: 10, cost: 16, lvl: 1 },
      { name: 'Погоня', kind: 'dash', dist: 10, dmg: 16, cd: 6, cost: 10, lvl: 2 },
      { name: 'Рой ног', kind: 'shoot', n: 8, spread: 80, dmg: 10, speed: 9, range: 10, proj: 'orb', color: '#bfe9ff', size: 0.22, homing: 3, cd: 10, cost: 22, lvl: 5 },
    ],
  });
  add({
    id: 'achtung_baby', name: 'Achtung Baby', ru: 'Ахтунг Бэби', part: 4, rar: 5,
    stats: '-?- ---', c1: '#d6e8ff', c2: '#ffd6ec', head: 'egg', cry: '...', type: 'Невидимость',
    desc: 'Стенд малышки Сидзуки. Делает невидимым всё вокруг.',
    abil: [
      { name: 'Невидимость', kind: 'buff', buff: 'invis', dur: 10, cd: 16, cost: 16, lvl: 1 },
      { name: 'Невидимые друзья', kind: 'summon', unit: 'decoy', n: 2, life: 10, cd: 20, cost: 18, lvl: 3 },
      { name: 'Исчезновение', kind: 'blink', range: 8, cd: 6, cost: 10, lvl: 5 },
    ],
  });
  add({
    id: 'surface', name: 'Surface', ru: 'Поверхность', part: 4, rar: 5,
    stats: 'BBC ACC', c1: '#d9c7a6', c2: '#3a3a3a', head: 'mask', cry: 'ХЕ-ХЕ', type: 'Копия',
    desc: 'Деревянная кукла, копирующая чужие движения.',
    abil: [
      { name: 'Кукловод', kind: 'hex', status: 'charm', dur: 6, range: 5, cd: 14, cost: 20, lvl: 1 },
      { name: 'Двойник', kind: 'summon', unit: 'decoy', n: 1, life: 14, cd: 18, cost: 18, lvl: 2 },
      { name: 'Деревянный кулак', kind: 'strike', dmg: 40, range: 1.6, knock: 6, cd: 6, cost: 12, lvl: 4 },
    ],
  });

  // ---------- Часть 5 ----------
  add({
    id: 'gold_experience', name: 'Gold Experience', ru: 'Золотой Опыт', part: 5, rar: 2,
    stats: 'CAC DCA', c1: '#f2c230', c2: '#e86ab0', head: 'ladybug', cry: 'МУДА', type: 'Жизнь',
    desc: 'Даёт жизнь неживому. У меня есть мечта!',
    abil: [
      { name: 'МУДА-раш', kind: 'rush', dmg: 3.8, dur: 1.4, range: 1.5, cd: 6, cost: 14, lvl: 1 },
      { name: 'Порождение жизни', kind: 'summon', unit: 'frog', n: 3, life: 18, cd: 12, cost: 20, lvl: 2 },
      { name: 'Создание органов', kind: 'heal', amt: 0.4, cd: 25, cost: 28, lvl: 4 },
    ],
    evo: { to: 'ger', how: 'arrow', note: 'Стрела на 10 уровне стенда' },
  });
  add({
    id: 'ger', name: 'Gold Experience Requiem', ru: 'Золотой Опыт Реквием', part: 5, rar: 0, evolved: true,
    stats: '∞∞∞ ∞∞∞', c1: '#ffd84a', c2: '#ffffff', head: 'ladybug', cry: 'МУДА', type: 'Реквием',
    desc: 'Возвращение к нулю. Никто не достигнет истины.',
    abil: [
      { name: 'МУДА-раш', kind: 'rush', dmg: 6, dur: 1.6, range: 1.7, cd: 5, cost: 12, lvl: 1 },
      { name: 'Скорпионы жизни', kind: 'summon', unit: 'frog', n: 5, life: 20, cd: 12, cost: 18, lvl: 1 },
      { name: 'Возврат к нулю', kind: 'buff', buff: 'zero', dur: 7, cd: 35, cost: 45, lvl: 1 },
    ],
  });
  add({
    id: 'sticky_fingers', name: 'Sticky Fingers', ru: 'Липкие Пальцы', part: 5, rar: 2,
    stats: 'AAC DCD', c1: '#3d6fd8', c2: '#e8e8f0', head: 'helmet', cry: 'АРИ', type: 'Ближний бой',
    desc: 'Молнии на всём, чего коснётся. Можно спрятаться в стене.',
    abil: [
      { name: 'АРИ-раш', kind: 'rush', dmg: 4, dur: 1.3, range: 1.5, cd: 6, cost: 14, lvl: 1 },
      { name: 'Молния-проход', kind: 'blink', range: 7, cd: 4, cost: 10, lvl: 2 },
      { name: 'Расстегнуть', kind: 'strike', dmg: 48, range: 1.8, stun: 2, cd: 10, cost: 18, lvl: 5 },
    ],
  });
  add({
    id: 'moody_blues', name: 'Moody Blues', ru: 'Муди Блюз', part: 5, rar: 4,
    stats: 'CCA DCC', c1: '#6a7dd8', c2: '#c8d0ff', head: 'mask', cry: 'ПЕРЕМОТКА', type: 'Повтор',
    desc: 'Воспроизводит прошлое. Идеален для расследований.',
    abil: [
      { name: 'Перемотка', kind: 'reveal', dur: 20, cd: 20, cost: 14, lvl: 1 },
      { name: 'Двойник-повтор', kind: 'summon', unit: 'decoy', n: 1, life: 14, cd: 14, cost: 16, lvl: 2 },
      { name: 'Кулак повтора', kind: 'strike', dmg: 34, range: 1.6, knock: 5, cd: 5, cost: 12, lvl: 4 },
    ],
  });
  add({
    id: 'sex_pistols', name: 'Sex Pistols', ru: 'Секс Пистолз', part: 5, rar: 3,
    stats: 'EBB ... ', c1: '#f2d14a', c2: '#3a2a2a', head: 'tiny', cry: 'ИИХА', type: 'Колония',
    desc: 'Шесть маленьких стендов, перенаправляющих пули. Только не №4!',
    ranged: true, swarm: true,
    abil: [
      { name: 'Пас пули', kind: 'shoot', n: 3, spread: 18, dmg: 13, speed: 16, range: 13, proj: 'bullet', color: '#ffe066', size: 0.13, homing: 5, cd: 1.6, cost: 6, lvl: 1 },
      { name: 'Рикошет', kind: 'shoot', n: 6, spread: 360, dmg: 12, speed: 15, range: 12, proj: 'bullet', color: '#ffe066', size: 0.13, homing: 6, cd: 7, cost: 16, lvl: 3 },
      { name: 'Пистолз, вперёд!', kind: 'shoot', n: 1, dmg: 75, speed: 22, range: 15, proj: 'bullet', color: '#fff6b0', size: 0.18, homing: 8, pierce: 2, cd: 14, cost: 26, lvl: 6 },
    ],
  });
  add({
    id: 'aerosmith', name: 'Aerosmith', ru: 'Аэросмит', part: 5, rar: 3,
    stats: 'BBB EED', c1: '#e25b3a', c2: '#ffd34a', head: 'plane', cry: 'ВОЛЯ', type: 'Самолёт',
    desc: 'Стенд-истребитель с пулемётом. Радар видит дыхание.',
    ranged: true,
    abil: [
      { name: 'Пулемёт', kind: 'shoot', n: 5, spread: 12, dmg: 7, speed: 18, range: 12, proj: 'bullet', color: '#ffd34a', size: 0.12, cd: 1.6, cost: 6, lvl: 1 },
      { name: 'Радар CO₂', kind: 'reveal', dur: 18, cd: 24, cost: 12, lvl: 2 },
      { name: 'Бомба', kind: 'shoot', n: 1, dmg: 60, speed: 8, range: 9, proj: 'missile', color: '#ffb02e', size: 0.32, explode: 3, cd: 12, cost: 25, lvl: 5 },
    ],
  });
  add({
    id: 'purple_haze', name: 'Purple Haze', ru: 'Пурпурная Дымка', part: 5, rar: 3,
    stats: 'ABC EEB', c1: '#9b59d6', c2: '#ffd94a', head: 'mask', cry: 'УБАШАА', type: 'Вирус',
    desc: 'Капсулы со смертельным вирусом. Опасен для всех, даже для владельца.',
    abil: [
      { name: 'Бешеный удар', kind: 'strike', dmg: 30, range: 1.6, arc: 1.4, knock: 4, cd: 1.8, cost: 5, lvl: 1 },
      { name: 'Капсула вируса', kind: 'shoot', n: 1, dmg: 12, speed: 10, range: 9, proj: 'orb', color: '#c86bff', size: 0.24, cloud: { radius: 2.6, dur: 6, dps: 12 }, cd: 6, cost: 14, lvl: 2 },
      { name: 'Пурпурная Дымка', kind: 'field', radius: 4.5, dur: 8, dps: 18, color: '#b06bff', fx: { poison: 4 }, hurtSelf: 0.25, cd: 20, cost: 34, lvl: 5 },
    ],
  });
  add({
    id: 'spice_girl', name: 'Spice Girl', ru: 'Спайс Гёрл', part: 5, rar: 4,
    stats: 'AAC BCC', c1: '#ff6fae', c2: '#ffd34a', head: 'mask', cry: 'ВАННАБИ', type: 'Мягкость',
    desc: 'Делает предметы мягкими как резина. Стенд с собственной волей.',
    abil: [
      { name: 'ВАННАБИ-раш', kind: 'rush', dmg: 3.8, dur: 1.3, range: 1.5, cd: 6, cost: 14, lvl: 1 },
      { name: 'Размягчение', kind: 'hex', status: 'soft', dur: 8, range: 5, aoe: 2, cd: 10, cost: 16, lvl: 2 },
      { name: 'Резиновое тело', kind: 'buff', buff: 'armor', val: 0.6, dur: 10, cd: 22, cost: 25, lvl: 5 },
    ],
  });
  add({
    id: 'king_crimson', name: 'King Crimson', ru: 'Багровый Король', part: 5, rar: 1,
    stats: 'AAE ??A', c1: '#c4283c', c2: '#ffd2d2', head: 'twin', cry: 'КИНГ КРИМСОН', type: 'Стирание времени',
    desc: 'Стирает время. В этом мире останутся только результаты.',
    abil: [
      { name: 'Удар сквозь грудь', kind: 'strike', dmg: 55, range: 1.8, arc: 0.9, knock: 4, stun: 0.8, cd: 4, cost: 12, lvl: 1 },
      { name: 'Эпитафия', kind: 'buff', buff: 'dodge', dur: 9, cd: 20, cost: 20, lvl: 3 },
      { name: 'Стирание времени', kind: 'timeskip', dur: 5, cd: 35, cost: 50, lvl: 6 },
    ],
  });
  add({
    id: 'metallica', name: 'Metallica', ru: 'Металлика', part: 5, rar: 4,
    stats: 'CCC AEC', c1: '#7a7f8c', c2: '#b8273a', head: 'tiny', cry: 'ЛЕЛЕЛЕ', type: 'Железо',
    desc: 'Собирает железо из крови. Бритвы рождаются внутри врага.',
    swarm: true,
    abil: [
      { name: 'Бритвы', kind: 'hex', status: 'bleed', dur: 6, range: 6, cd: 6, cost: 12, lvl: 1 },
      { name: 'Железный камуфляж', kind: 'buff', buff: 'invis', dur: 8, cd: 18, cost: 18, lvl: 3 },
      { name: 'Скальпели', kind: 'shoot', n: 6, spread: 50, dmg: 14, speed: 13, range: 9, proj: 'knife', color: '#c9ccd6', size: 0.2, fx: { poison: 3 }, cd: 9, cost: 20, lvl: 5 },
    ],
  });
  add({
    id: 'grateful_dead', name: 'The Grateful Dead', ru: 'Благодарный Мертвец', part: 5, rar: 4,
    stats: 'BEB ECE', c1: '#7d4fa8', c2: '#e3c96b', head: 'eyes', cry: 'ГЛАЗА', type: 'Старение',
    desc: 'Газ, старящий всё живое. Лёд спасает.',
    abil: [
      { name: 'Хватка старости', kind: 'strike', dmg: 24, range: 1.8, fx: { age: 6 }, cd: 3, cost: 8, lvl: 1 },
      { name: 'Газ старения', kind: 'field', radius: 5, dur: 10, dps: 8, color: '#9b7ad1', fx: { age: 3 }, follow: true, cd: 18, cost: 28, lvl: 2 },
      { name: 'Прямое старение', kind: 'hex', status: 'age', dur: 10, range: 4, aoe: 2, cd: 16, cost: 24, lvl: 5 },
    ],
  });
  add({
    id: 'beach_boy', name: 'Beach Boy', ru: 'Бич Бой', part: 5, rar: 4,
    stats: 'CBB CAB', c1: '#2aa3d8', c2: '#e8e8e8', head: 'none', extra: 'rod', cry: 'ВЗЗЗ', type: 'Удочка',
    desc: 'Удочка, леска которой проходит сквозь стены.',
    ranged: true,
    abil: [
      { name: 'Заброс', kind: 'pull', range: 10, dmg: 14, stun: 0.6, cd: 4, cost: 8, lvl: 1 },
      { name: 'Крючок в сердце', kind: 'hex', status: 'bleed', dur: 8, range: 9, cd: 9, cost: 16, lvl: 3 },
      { name: 'Подсечка', kind: 'beam', dmg: 40, range: 10, width: 0.25, color: '#e8f4ff', ghost: true, cd: 10, cost: 22, lvl: 5 },
    ],
  });
  add({
    id: 'white_album', name: 'White Album', ru: 'Белый Альбом', part: 5, rar: 3,
    stats: 'ACE AEE', c1: '#d6f2ff', c2: '#3a8fd8', head: 'helmet', cry: 'ХОЛОД', type: 'Броня-лёд',
    desc: 'Ледяной костюм. Абсолютный ноль и коньки.',
    abil: [
      { name: 'Ледяная броня', kind: 'buff', buff: 'armor', val: 0.6, dur: 12, cd: 18, cost: 22, lvl: 1 },
      { name: 'Заморозка', kind: 'nova', radius: 3.5, dmg: 20, color: '#c8f0ff', fx: { freeze: 1.8 }, cd: 10, cost: 18, lvl: 2 },
      { name: 'Gently Weeps', kind: 'buff', buff: 'reflect', dur: 6, cd: 24, cost: 30, lvl: 5 },
    ],
  });
  add({
    id: 'man_in_the_mirror', name: 'Man in the Mirror', ru: 'Человек в Зеркале', part: 5, rar: 4,
    stats: 'CCB DDE', c1: '#b9c4d6', c2: '#5a6a85', head: 'mask', cry: 'ДЗИИН', type: 'Зеркало',
    desc: 'Затягивает врагов в мир зеркал без их стендов.',
    abil: [
      { name: 'Зеркальный шаг', kind: 'blink', range: 8, cd: 4, cost: 10, lvl: 1 },
      { name: 'Запереть в зеркале', kind: 'hex', status: 'silence', dur: 8, range: 6, aoe: 2, cd: 14, cost: 20, lvl: 2 },
      { name: 'Осколки', kind: 'shoot', n: 7, spread: 70, dmg: 13, speed: 12, range: 9, proj: 'shard', color: '#e3edf7', size: 0.2, cd: 8, cost: 18, lvl: 4 },
    ],
  });
  add({
    id: 'kraft_work', name: 'Kraft Work', ru: 'Крафт Ворк', part: 5, rar: 4,
    stats: 'AEE AAC', c1: '#b8c95a', c2: '#3d4a1f', head: 'helmet', cry: 'СТОП', type: 'Фиксация',
    desc: 'Фиксирует предметы в пространстве. Пули замирают в воздухе.',
    abil: [
      { name: 'Зафиксировать', kind: 'hex', status: 'root', dur: 4, range: 5, aoe: 2, cd: 8, cost: 14, lvl: 1 },
      { name: 'Остановка пуль', kind: 'buff', buff: 'reflect', dur: 6, cd: 18, cost: 20, lvl: 2 },
      { name: 'Залп фиксированных пуль', kind: 'shoot', n: 9, spread: 60, dmg: 15, speed: 15, range: 10, proj: 'bullet', color: '#dbe87a', size: 0.14, cd: 10, cost: 22, lvl: 5 },
    ],
  });
  add({
    id: 'black_sabbath', name: 'Black Sabbath', ru: 'Чёрный Шабаш', part: 5, rar: 4,
    stats: 'AAA ECE', c1: '#23202e', c2: '#d6c447', head: 'cloak', cry: 'ВЫБИРАЙ', type: 'Тень',
    desc: 'Живёт в тени. Вонзает стрелу в избранных.',
    abil: [
      { name: 'Вырвать душу', kind: 'strike', dmg: 30, range: 1.8, stun: 1.4, cd: 4, cost: 10, lvl: 1 },
      { name: 'Скольжение в тени', kind: 'dash', dist: 8, dmg: 18, invuln: true, cd: 5, cost: 10, lvl: 2 },
      { name: 'Стрела в рот', kind: 'shoot', n: 1, dmg: 55, speed: 14, range: 9, proj: 'arrow', color: '#d6c447', size: 0.24, homing: 4, cd: 12, cost: 24, lvl: 5 },
    ],
  });
  add({
    id: 'green_day', name: 'Green Day', ru: 'Грин Дэй', part: 5, rar: 4,
    stats: 'AEA EEA', c1: '#5c8a2f', c2: '#c7e86b', head: 'mask', cry: 'ГНИЛЬ', type: 'Плесень',
    desc: 'Плесень пожирает всех, кто спускается ниже.',
    abil: [
      { name: 'Споры', kind: 'shoot', n: 4, spread: 50, dmg: 10, speed: 8, range: 9, proj: 'orb', color: '#9ad94a', size: 0.25, fx: { poison: 4 }, cd: 3, cost: 8, lvl: 1 },
      { name: 'Поле плесени', kind: 'field', radius: 6, dur: 12, dps: 9, color: '#7fc23a', fx: { slow: 1 }, cd: 20, cost: 30, lvl: 3 },
      { name: 'Пожирание', kind: 'nova', radius: 4, dmg: 30, color: '#a8e05a', fx: { poison: 8 }, cd: 16, cost: 28, lvl: 6 },
    ],
  });
  add({
    id: 'oasis', name: 'Oasis', ru: 'Оазис', part: 5, rar: 5,
    stats: 'ABE ADE', c1: '#4f4f9a', c2: '#c09f5f', head: 'helmet', cry: 'БУЛЬ', type: 'Растворение',
    desc: 'Плавает в земле как в воде.',
    abil: [
      { name: 'Нырок в землю', kind: 'dash', dist: 8, dmg: 22, invuln: true, ghost: true, cd: 6, cost: 12, lvl: 1 },
      { name: 'Град ударов', kind: 'rush', dmg: 4, dur: 1.2, range: 1.4, cd: 6, cost: 14, lvl: 2 },
      { name: 'Зыбучая земля', kind: 'field', radius: 4, dur: 8, dps: 6, color: '#8a6a3a', fx: { slow: 2 }, cd: 16, cost: 22, lvl: 4 },
    ],
  });
  add({
    id: 'baby_face', name: 'Baby Face', ru: 'Бэби Фэйс', part: 5, rar: 5,
    stats: 'ABA DBA', c1: '#5a6fd8', c2: '#ffffff', head: 'egg', cry: 'ПАПА', type: 'Ребёнок',
    desc: 'Стенд-ребёнок, разбирающий всё на кубики.',
    abil: [
      { name: 'Сын', kind: 'summon', unit: 'babyface', n: 1, life: 22, cd: 16, cost: 22, lvl: 1 },
      { name: 'Разборка на кубики', kind: 'shoot', n: 6, spread: 40, dmg: 11, speed: 11, range: 9, proj: 'cube', color: '#8fa0ff', size: 0.22, cd: 4, cost: 10, lvl: 2 },
      { name: 'Пересборка', kind: 'hex', status: 'root', dur: 4, range: 5, aoe: 2.5, cd: 14, cost: 20, lvl: 5 },
    ],
  });
  add({
    id: 'chariot_requiem', name: 'Silver Chariot Requiem', ru: 'Серебряная Колесница Реквием', part: 5, rar: 0, evolved: true,
    stats: '??? ???', c1: '#1d1b26', c2: '#c7ccd8', head: 'helmet', extra: 'arrow', cry: '...', type: 'Реквием',
    desc: 'Меняет души местами и усыпляет всех вокруг.',
    abil: [
      { name: 'Шквал рапиры', kind: 'rush', dmg: 5, dur: 1.4, range: 2, cd: 5, cost: 12, lvl: 1 },
      { name: 'Обмен душ', kind: 'hex', status: 'charm', dur: 12, range: 7, aoe: 4, cd: 20, cost: 30, lvl: 1 },
      { name: 'Сон Реквиема', kind: 'nova', radius: 7, dmg: 20, color: '#2a2440', fx: { sleep: 4 }, cd: 25, cost: 35, lvl: 1 },
    ],
  });

  // ---------- Часть 6 ----------
  add({
    id: 'stone_free', name: 'Stone Free', ru: 'Стоун Фри', part: 6, rar: 2,
    stats: 'AAB ACA', c1: '#3aa2a6', c2: '#ffd34a', head: 'helmet', cry: 'ОРА', type: 'Нити',
    desc: 'Тело разматывается в нити. Свобода из камня!',
    abil: [
      { name: 'ОРА-раш', kind: 'rush', dmg: 4, dur: 1.4, range: 1.6, cd: 6, cost: 14, lvl: 1 },
      { name: 'Нить-захват', kind: 'pull', range: 9, dmg: 10, stun: 0.8, cd: 4, cost: 8, lvl: 2 },
      { name: 'Паутина', kind: 'trap', n: 7, radius: 4, dmg: 16, life: 25, color: '#7fe3e6', fx: { root: 2.5 }, cd: 14, cost: 22, lvl: 5 },
    ],
  });
  add({
    id: 'whitesnake', name: 'Whitesnake', ru: 'Белая Змея', part: 6, rar: 2,
    stats: '??? ???', c1: '#e9e6ef', c2: '#2d2b38', head: 'twin', cry: 'ДИСК', type: 'Диски',
    desc: 'Крадёт стенды и воспоминания в виде дисков.',
    abil: [
      { name: 'Кража диска', kind: 'disc', range: 2.2, dmg: 24, stun: 2, cd: 10, cost: 22, lvl: 1 },
      { name: 'Иллюзия', kind: 'hex', status: 'sleep', dur: 4, range: 6, aoe: 3, cd: 14, cost: 20, lvl: 3 },
      { name: 'Ядовитая слизь', kind: 'shoot', n: 3, spread: 30, dmg: 16, speed: 10, range: 9, proj: 'orb', color: '#e9e6ef', size: 0.24, fx: { poison: 4 }, cd: 6, cost: 12, lvl: 5 },
    ],
    evo: { to: 'c_moon', how: 'item', item: 'green_baby', minLvl: 6, note: 'Зелёный младенец + 6 ур.' },
  });
  add({
    id: 'c_moon', name: 'C-Moon', ru: 'Си-Мун', part: 6, rar: 0, evolved: true,
    stats: '??? ???', c1: '#4fbf6a', c2: '#ffffff', head: 'twin', cry: 'ГРАВИТАЦИЯ', type: 'Гравитация',
    desc: 'Сам становится центром гравитации. Всё выворачивается наизнанку.',
    abil: [
      { name: 'Выворачивающий удар', kind: 'strike', dmg: 50, range: 1.8, stun: 1, knock: 6, cd: 5, cost: 14, lvl: 1 },
      { name: 'Обратная гравитация', kind: 'nova', radius: 5, dmg: 26, color: '#7dff9b', knock: 10, cd: 10, cost: 20, lvl: 1 },
      { name: 'Кража диска', kind: 'disc', range: 2.2, dmg: 28, stun: 2, cd: 10, cost: 22, lvl: 1 },
    ],
    evo: { to: 'made_in_heaven', how: 'level', lvl: 10, note: 'Мыс Канаверал ждёт' },
  });
  add({
    id: 'made_in_heaven', name: 'Made in Heaven', ru: 'Сделано на Небесах', part: 6, rar: 0, evolved: true,
    stats: 'BA∞ AAA', c1: '#f4f4f4', c2: '#3cc48a', head: 'horse', cry: 'НЕБЕСА', type: 'Ускорение времени',
    desc: 'Ускоряет время до бесконечности. Новый мир близко.',
    abil: [
      { name: 'Удар на скорости', kind: 'rush', dmg: 4.5, dur: 1.2, range: 1.6, cd: 4, cost: 12, lvl: 1 },
      { name: 'Ножи на скорости света', kind: 'shoot', n: 9, spread: 60, dmg: 14, speed: 22, range: 12, proj: 'knife', color: '#ffffff', size: 0.2, cd: 6, cost: 16, lvl: 1 },
      { name: 'Ускорение времени', kind: 'buff', buff: 'heaven', val: 1.5, dur: 8, cd: 40, cost: 55, lvl: 1 },
    ],
  });
  add({
    id: 'weather_report', name: 'Weather Report', ru: 'Прогноз Погоды', part: 6, rar: 2,
    stats: 'AEC EEA', c1: '#d6e2f0', c2: '#4f8fd8', head: 'cloud', cry: 'ГРОМ', type: 'Погода',
    desc: 'Управляет погодой. Тяжёлая погода сводит с ума всех вокруг.',
    abil: [
      { name: 'Молния', kind: 'nova', at: 'aim', range: 7, radius: 1.8, dmg: 34, color: '#fff27a', fx: { stun: 0.8 }, cd: 3, cost: 10, lvl: 1 },
      { name: 'Ливень', kind: 'field', radius: 6, dur: 10, dps: 5, color: '#7fb8ff', fx: { slow: 2 }, follow: true, cd: 18, cost: 24, lvl: 3 },
      { name: 'Тяжёлая погода', kind: 'hex', status: 'charm', dur: 10, range: 8, aoe: 5, cd: 30, cost: 45, lvl: 7 },
    ],
  });
  add({
    id: 'foo_fighters', name: 'Foo Fighters', ru: 'Фу Файтерс', part: 6, rar: 4,
    stats: 'BBC ABC', c1: '#3aa86b', c2: '#d6ffcf', head: 'mask', cry: 'БАТ-БАТ', type: 'Планктон',
    desc: 'Разумный планктон. Стреляет пальцами и латает раны.',
    ranged: true,
    abil: [
      { name: 'Пальцы-пули', kind: 'shoot', n: 3, spread: 20, dmg: 12, speed: 14, range: 11, proj: 'bullet', color: '#9dff7a', size: 0.14, cd: 1.6, cost: 6, lvl: 1 },
      { name: 'Латать раны', kind: 'heal', amt: 0.3, cd: 16, cost: 20, lvl: 2 },
      { name: 'Водяной залп', kind: 'shoot', n: 10, spread: 90, dmg: 12, speed: 13, range: 10, proj: 'water', color: '#7fffb0', size: 0.18, cd: 10, cost: 24, lvl: 5 },
    ],
  });
  add({
    id: 'diver_down', name: 'Diver Down', ru: 'Дайвер Даун', part: 6, rar: 4,
    stats: 'AAE BBC', c1: '#4a62d8', c2: '#ffcf4a', head: 'helmet', cry: 'УРЯ', type: 'Ныряние',
    desc: 'Ныряет в предметы и хранит в них удар.',
    abil: [
      { name: 'Раш', kind: 'rush', dmg: 4, dur: 1.2, range: 1.5, cd: 6, cost: 14, lvl: 1 },
      { name: 'Запасённый удар', kind: 'trap', n: 3, radius: 2.5, dmg: 40, life: 30, color: '#ffcf4a', fx: { stun: 1 }, cd: 12, cost: 18, lvl: 2 },
      { name: 'Нырок в тело', kind: 'strike', dmg: 52, range: 1.6, stun: 1.5, cd: 9, cost: 18, lvl: 5 },
    ],
  });
  add({
    id: 'planet_waves', name: 'Planet Waves', ru: 'Волны Планеты', part: 6, rar: 4,
    stats: 'AEA EEC', c1: '#8a5a3a', c2: '#ff8a3a', head: 'none', cry: 'МЕТЕОР', type: 'Метеоры',
    desc: 'Притягивает метеоры с неба. Опасно для всех.',
    ranged: true,
    abil: [
      { name: 'Метеорит', kind: 'nova', at: 'aim', range: 9, radius: 2, dmg: 36, color: '#ff8a3a', fx: { burn: 3 }, delay: 0.6, cd: 4, cost: 12, lvl: 1 },
      { name: 'Метеоритный дождь', kind: 'shoot', n: 8, spread: 360, dmg: 18, speed: 7, range: 7, proj: 'flame', color: '#ff6a2a', size: 0.32, explode: 1.4, cd: 14, cost: 28, lvl: 4 },
      { name: 'Звездопад', kind: 'nova', radius: 6, dmg: 50, color: '#ffb03a', fx: { burn: 5 }, delay: 1, cd: 25, cost: 40, lvl: 7 },
    ],
  });
  add({
    id: 'kiss', name: 'Kiss', ru: 'Кисс', part: 6, rar: 4,
    stats: 'ABE ... ', c1: '#ff5fa2', c2: '#ffe0ef', head: 'helmet', cry: 'ЧМОК', type: 'Наклейки',
    desc: 'Наклейка удваивает предмет. Сорвёшь — две половины схлопнутся.',
    abil: [
      { name: 'Двойной удар', kind: 'strike', dmg: 22, range: 1.6, hits: 2, cd: 2, cost: 6, lvl: 1 },
      { name: 'Наклейка', kind: 'hex', status: 'mark2', dur: 8, range: 5, cd: 8, cost: 12, lvl: 2 },
      { name: 'Схлопывание', kind: 'nova', radius: 3.5, dmg: 44, color: '#ff5fa2', fx: { stun: 1 }, cd: 14, cost: 26, lvl: 5 },
    ],
  });
  add({
    id: 'survivor', name: 'Survivor', ru: 'Выживший', part: 6, rar: 5,
    stats: 'EEA EEE', c1: '#8b8b8b', c2: '#3d3d3d', head: 'bug', cry: 'ДРАКА', type: 'Ярость',
    desc: 'Слабейший стенд, превращающий всех вокруг в злобных бойцов.',
    abil: [
      { name: 'Ярость толпы', kind: 'hex', status: 'charm', dur: 8, range: 6, aoe: 4, cd: 16, cost: 24, lvl: 1 },
      { name: 'Видеть слабости', kind: 'buff', buff: 'luck', val: 0.4, dur: 12, cd: 20, cost: 16, lvl: 2 },
      { name: 'Всеобщая драка', kind: 'hex', status: 'charm', dur: 12, range: 8, aoe: 6, cd: 30, cost: 40, lvl: 6 },
    ],
  });
  add({
    id: 'jumpin_jack_flash', name: "Jumpin' Jack Flash", ru: 'Джампин Джек Флэш', part: 6, rar: 5,
    stats: 'BCA CCC', c1: '#5f7fbf', c2: '#ffd34a', head: 'helmet', cry: 'ВЖЖЖ', type: 'Невесомость',
    desc: 'Создаёт вакуум и невесомость.',
    abil: [
      { name: 'Вакуумная пуля', kind: 'shoot', n: 2, spread: 10, dmg: 16, speed: 12, range: 11, proj: 'orb', color: '#c8d8ff', size: 0.22, cd: 2, cost: 6, lvl: 1 },
      { name: 'Невесомость', kind: 'nova', radius: 4, dmg: 14, color: '#c8d8ff', knock: 8, fx: { stun: 1 }, cd: 10, cost: 18, lvl: 3 },
      { name: 'Вакуум', kind: 'field', radius: 4, dur: 7, dps: 14, color: '#5f7fbf', fx: { slow: 2 }, cd: 20, cost: 30, lvl: 6 },
    ],
  });

  // ---------- Часть 7 ----------
  add({
    id: 'tusk_1', name: 'Tusk Act 1', ru: 'Бивень, акт 1', part: 7, rar: 2,
    stats: 'EED DAA', c1: '#f29bd0', c2: '#ffe6f4', head: 'egg', cry: 'ЧУМИ', type: 'Вращение ногтей',
    desc: 'Ногти, вращающиеся как пули.',
    ranged: true,
    abil: [
      { name: 'Ноготь-пуля', kind: 'shoot', n: 1, dmg: 14, speed: 14, range: 11, proj: 'nail', color: '#ffb3e0', size: 0.16, pierce: 1, cd: 1.2, cost: 5, lvl: 1 },
      { name: 'Пять ногтей', kind: 'shoot', n: 5, spread: 36, dmg: 12, speed: 14, range: 11, proj: 'nail', color: '#ffb3e0', size: 0.16, cd: 5, cost: 14, lvl: 2 },
      { name: 'Ноготь-резак', kind: 'beam', dmg: 30, range: 8, width: 0.3, color: '#ffb3e0', cd: 8, cost: 16, lvl: 3 },
    ],
    evo: { to: 'tusk_2', how: 'level', lvl: 4 },
  });
  add({
    id: 'tusk_2', name: 'Tusk Act 2', ru: 'Бивень, акт 2', part: 7, rar: 0, evolved: true,
    stats: 'DDB CAA', c1: '#e47ac0', c2: '#ffd34a', head: 'egg', cry: 'ЧУМИ', type: 'Вращение ногтей',
    desc: 'Дыры от ногтей ползут за врагом.',
    ranged: true,
    abil: [
      { name: 'Золотая дыра', kind: 'shoot', n: 2, spread: 12, dmg: 16, speed: 13, range: 12, proj: 'nail', color: '#ffd34a', size: 0.17, homing: 5, cd: 1.4, cost: 6, lvl: 1 },
      { name: 'Пять дыр', kind: 'shoot', n: 5, spread: 40, dmg: 14, speed: 13, range: 12, proj: 'nail', color: '#ffd34a', size: 0.17, homing: 4, cd: 5, cost: 14, lvl: 1 },
      { name: 'Ноготь-резак', kind: 'beam', dmg: 36, range: 9, width: 0.3, color: '#ffb3e0', cd: 8, cost: 16, lvl: 1 },
    ],
    evo: { to: 'tusk_3', how: 'level', lvl: 7 },
  });
  add({
    id: 'tusk_3', name: 'Tusk Act 3', ru: 'Бивень, акт 3', part: 7, rar: 0, evolved: true,
    stats: 'CCB BAA', c1: '#d65ab0', c2: '#ffd34a', head: 'egg', cry: 'ЧУМИ', type: 'Вращение ногтей',
    desc: 'Можно нырнуть в собственную дыру и выйти где угодно.',
    ranged: true,
    abil: [
      { name: 'Золотая дыра', kind: 'shoot', n: 2, spread: 12, dmg: 18, speed: 14, range: 12, proj: 'nail', color: '#ffd34a', size: 0.17, homing: 5, cd: 1.4, cost: 6, lvl: 1 },
      { name: 'Червоточина', kind: 'blink', range: 9, cd: 4, cost: 10, lvl: 1 },
      { name: 'Ноготь-резак', kind: 'beam', dmg: 42, range: 9, width: 0.3, color: '#ffb3e0', cd: 7, cost: 16, lvl: 1 },
    ],
    evo: { to: 'tusk_4', how: 'spin', note: 'Золотое вращение (Вращение 5 ур.) + 10 ур.' },
  });
  add({
    id: 'tusk_4', name: 'Tusk Act 4', ru: 'Бивень, акт 4', part: 7, rar: 0, evolved: true,
    stats: 'AAA AAA', c1: '#c74aa8', c2: '#ffe14a', head: 'horn', cry: 'ЧУМИ', type: 'Бесконечное вращение',
    desc: 'Бесконечное вращение. От него не спасёт ни одно измерение.',
    abil: [
      { name: 'ОРА-раш', kind: 'rush', dmg: 6, dur: 1.5, range: 1.7, cd: 5, cost: 12, lvl: 1 },
      { name: 'Золотая дыра', kind: 'shoot', n: 3, spread: 16, dmg: 20, speed: 15, range: 13, proj: 'nail', color: '#ffd34a', size: 0.18, homing: 6, cd: 1.6, cost: 6, lvl: 1 },
      { name: 'Бесконечное вращение', kind: 'shoot', n: 1, dmg: 40, speed: 9, range: 16, proj: 'spiral', color: '#ffe14a', size: 0.4, homing: 8, pierce: 99, fx: { infinite: 8 }, cd: 25, cost: 40, lvl: 1 },
    ],
  });
  add({
    id: 'd4c', name: 'Dirty Deeds Done Dirt Cheap', ru: 'D4C', part: 7, rar: 1,
    stats: 'AAC ACB', c1: '#4f6fd8', c2: '#f29bd0', head: 'horn', cry: 'ДОДЖО', type: 'Измерения',
    desc: 'Путешествия между параллельными мирами. Выбери Америку!',
    abil: [
      { name: 'Раш', kind: 'rush', dmg: 4.2, dur: 1.3, range: 1.5, cd: 6, cost: 14, lvl: 1 },
      { name: 'Прыжок в измерение', kind: 'blink', range: 8, cd: 4, cost: 10, lvl: 2 },
      { name: 'Двойник из мира', kind: 'summon', unit: 'clone', n: 1, life: 18, cd: 20, cost: 30, lvl: 5 },
    ],
    evo: { to: 'love_train', how: 'corpse', note: 'Все 9 частей Святого Трупа' },
  });
  add({
    id: 'love_train', name: 'D4C Love Train', ru: 'D4C: Поезд Любви', part: 7, rar: 0, evolved: true,
    stats: 'AAC ACB', c1: '#ffe9a8', c2: '#4f6fd8', head: 'horn', cry: 'ДОДЖО', type: 'Реквием',
    desc: 'Несчастья отводятся прочь. Свет защищает владельца.',
    abil: [
      { name: 'Раш', kind: 'rush', dmg: 5, dur: 1.4, range: 1.6, cd: 5, cost: 12, lvl: 1 },
      { name: 'Двойник из мира', kind: 'summon', unit: 'clone', n: 2, life: 18, cd: 18, cost: 30, lvl: 1 },
      { name: 'Поезд Любви', kind: 'buff', buff: 'lovetrain', dur: 8, cd: 35, cost: 45, lvl: 1 },
    ],
  });
  add({
    id: 'scary_monsters', name: 'Scary Monsters', ru: 'Страшные Монстры', part: 7, rar: 3,
    stats: 'BBE CDB', c1: '#6aa84f', c2: '#e3d27a', head: 'dino', cry: 'РРРА', type: 'Динозавр',
    desc: 'Превращает в динозавра. Видит только движение.',
    abil: [
      { name: 'Укус', kind: 'strike', dmg: 32, range: 1.6, fx: { bleed: 4 }, cd: 2, cost: 6, lvl: 1 },
      { name: 'Форма динозавра', kind: 'buff', buff: 'dino', val: 0.6, dur: 12, cd: 20, cost: 22, lvl: 2 },
      { name: 'Стая рапторов', kind: 'summon', unit: 'raptor', n: 3, life: 18, cd: 22, cost: 30, lvl: 5 },
    ],
  });
  add({
    id: 'mandom', name: 'Mandom', ru: 'Мэндом', part: 7, rar: 4,
    stats: '-?- ---', c1: '#c9a46b', c2: '#5a3a2a', head: 'none', cry: 'ЩЁЛК', type: 'Перемотка',
    desc: 'Откатывает время на шесть секунд.',
    abil: [
      { name: 'Шесть секунд', kind: 'rewind', back: 6, dmg: 0, radius: 0, cd: 20, cost: 25, lvl: 1 },
      { name: 'Револьвер', kind: 'shoot', n: 1, dmg: 22, speed: 16, range: 12, proj: 'bullet', color: '#ffd166', size: 0.14, cd: 1.2, cost: 4, lvl: 1 },
      { name: 'Ковбойская удача', kind: 'buff', buff: 'luck', val: 0.4, dur: 12, cd: 20, cost: 16, lvl: 3 },
    ],
  });
  add({
    id: 'twentieth_century_boy', name: '20th Century Boy', ru: 'Мальчик XX века', part: 7, rar: 5,
    stats: 'EEE AEC', c1: '#7a8a9a', c2: '#ffd34a', head: 'helmet', cry: 'ДЗИН', type: 'Защита',
    desc: 'Абсолютная защита ценой неподвижности.',
    abil: [
      { name: 'Абсолютная защита', kind: 'buff', buff: 'invuln', root: true, dur: 4, cd: 12, cost: 16, lvl: 1 },
      { name: 'Ответный удар', kind: 'nova', radius: 2.5, dmg: 30, color: '#ffd34a', knock: 6, cd: 8, cost: 14, lvl: 2 },
      { name: 'Динамит', kind: 'trap', n: 3, radius: 3, dmg: 45, life: 25, color: '#ff6a3a', cd: 16, cost: 22, lvl: 4 },
    ],
  });
  add({
    id: 'hey_ya', name: 'Hey Ya!', ru: 'Хэй Я!', part: 7, rar: 5,
    stats: 'EEE EEE', c1: '#ffe14a', c2: '#ff8a3a', head: 'egg', cry: 'ТЫ СМОЖЕШЬ', type: 'Поддержка',
    desc: 'Слабейший стенд, который просто подбадривает. Но удача — тоже сила!',
    abil: [
      { name: 'Ты сможешь!', kind: 'buff', buff: 'luck', val: 0.5, dur: 15, cd: 18, cost: 10, lvl: 1 },
      { name: 'Не сдавайся!', kind: 'heal', amt: 0.25, cd: 18, cost: 14, lvl: 2 },
      { name: 'Вера в победу', kind: 'buff', buff: 'power', val: 0.5, dur: 12, cd: 24, cost: 18, lvl: 4 },
    ],
  });
  add({
    id: 'catch_the_rainbow', name: 'Catch the Rainbow', ru: 'Поймай Радугу', part: 7, rar: 4,
    stats: 'BBC CCC', c1: '#7fa8d8', c2: '#e8f2ff', head: 'mask', cry: 'КАП', type: 'Дождь',
    desc: 'Капли дождя становятся лезвиями.',
    abil: [
      { name: 'Лезвия капель', kind: 'shoot', n: 5, spread: 30, dmg: 11, speed: 14, range: 10, proj: 'water', color: '#cfe6ff', size: 0.16, cd: 2, cost: 6, lvl: 1 },
      { name: 'Шаг по каплям', kind: 'blink', range: 8, cd: 4, cost: 10, lvl: 2 },
      { name: 'Рассечение', kind: 'hex', status: 'bleed', dur: 8, range: 5, aoe: 2.5, cd: 12, cost: 20, lvl: 5 },
    ],
  });
  add({
    id: 'cream_starter', name: 'Cream Starter', ru: 'Крем Стартер', part: 7, rar: 5,
    stats: 'DBD BDD', c1: '#f5e6d3', c2: '#d6a87a', head: 'none', cry: 'ПШШ', type: 'Плоть',
    desc: 'Распыляет плоть как крем. Лечит и душит.',
    abil: [
      { name: 'Мясной крем', kind: 'heal', amt: 0.3, cd: 14, cost: 18, lvl: 1 },
      { name: 'Залепить', kind: 'hex', status: 'silence', dur: 6, range: 5, cd: 10, cost: 14, lvl: 2 },
      { name: 'Струя', kind: 'beam', dmg: 30, range: 7, width: 0.5, color: '#f5e6d3', fx: { slow: 2 }, cd: 8, cost: 16, lvl: 4 },
    ],
  });

  // ---------- Часть 8 ----------
  add({
    id: 'soft_and_wet', name: 'Soft & Wet', ru: 'Мягкий и Влажный', part: 8, rar: 2,
    stats: 'ABC ACA', c1: '#f2f2f7', c2: '#ff7ab8', head: 'star', cry: 'ОРА', type: 'Пузыри',
    desc: 'Пузыри, которые что-то отнимают: зрение, звук, трение.',
    abil: [
      { name: 'Пузыри-воры', kind: 'shoot', n: 3, spread: 30, dmg: 10, speed: 6, range: 10, proj: 'bubble', color: '#e6f3ff', size: 0.3, fx: { silence: 3, slow: 2 }, cd: 2.5, cost: 8, lvl: 1 },
      { name: 'ОРА-раш', kind: 'rush', dmg: 4, dur: 1.3, range: 1.5, cd: 6, cost: 14, lvl: 2 },
      { name: 'Go Beyond', kind: 'shoot', n: 1, dmg: 70, speed: 7, range: 14, proj: 'spiral', color: '#ff7ab8', size: 0.3, homing: 4, pierce: 99, cd: 18, cost: 32, lvl: 7 },
    ],
  });
  add({
    id: 'wonder_of_u', name: 'Wonder of U', ru: 'Чудо Тебя', part: 8, rar: 1,
    stats: '??? ???', c1: '#5a4a3a', c2: '#d6c9a8', head: 'cloak', cry: '...', type: 'Бедствие',
    desc: 'Всякий, кто преследует его, встречает бедствие.',
    abil: [
      { name: 'Бедствие', kind: 'field', radius: 5, dur: 10, dps: 16, color: '#3a2e24', follow: true, calamity: true, cd: 18, cost: 28, lvl: 1 },
      { name: 'Иллюзия старика', kind: 'blink', range: 7, cd: 5, cost: 10, lvl: 2 },
      { name: 'Неотвратимость', kind: 'nova', radius: 5, dmg: 40, color: '#6b5a48', fx: { stun: 1.5 }, cd: 20, cost: 34, lvl: 5 },
    ],
  });
  add({
    id: 'paisley_park', name: 'Paisley Park', ru: 'Пейсли Парк', part: 8, rar: 4,
    stats: 'DBA ECB', c1: '#7ab8ff', c2: '#ffe0f0', head: 'helmet', cry: 'СЮДА', type: 'Навигация',
    desc: 'Ведёт хозяйку по правильному пути через сети и карты.',
    abil: [
      { name: 'Путеводитель', kind: 'reveal', dur: 30, cd: 20, cost: 10, lvl: 1 },
      { name: 'Электрошок', kind: 'beam', dmg: 20, range: 7, width: 0.3, color: '#bde0ff', fx: { stun: 0.6 }, cd: 4, cost: 8, lvl: 2 },
      { name: 'Верный путь', kind: 'buff', buff: 'dodge', dur: 8, cd: 22, cost: 20, lvl: 4 },
    ],
  });
  add({
    id: 'king_nothing', name: 'King Nothing', ru: 'Кинг Нафинг', part: 8, rar: 5,
    stats: 'CCC DBC', c1: '#d8c6a0', c2: '#2a2a2a', head: 'puzzle', cry: 'НЮХ', type: 'След',
    desc: 'Идёт по запаху, собирая пазл.',
    abil: [
      { name: 'Пазл-удар', kind: 'strike', dmg: 26, range: 1.6, cd: 2, cost: 6, lvl: 1 },
      { name: 'Запах', kind: 'reveal', dur: 20, cd: 20, cost: 10, lvl: 2 },
      { name: 'Рассыпаться', kind: 'dash', dist: 7, dmg: 20, invuln: true, cd: 7, cost: 12, lvl: 4 },
    ],
  });

  J.STANDS = {};
  for (const s of S) {
    const parts = s.stats.replace(/\s+/g, '').split('');
    while (parts.length < 6) parts.push('-');
    s.st = { pow: parts[0], spd: parts[1], rng: parts[2], dur: parts[3], pre: parts[4], pot: parts[5] };
    J.STANDS[s.id] = s;
  }
  J.STAND_LIST = S;
  // Пул для Стрелы (без эволюций), с весами по редкости
  J.standPool = (filter) =>
    S.filter((s) => !s.evolved && s.rar > 0 && (!filter || filter(s))).map((s) => ({ s, w: [0, 1, 3, 6, 9, 12][s.rar] }));
  J.STAT_NAMES = { pow: 'Сила', spd: 'Скорость', rng: 'Дальность', dur: 'Прочность', pre: 'Точность', pot: 'Потенциал' };
})();
