'use strict';
// Данные мира: регионы, здания, имена, реплики, происхождения.
(function () {
  J.WORLD_W = 1024;
  J.WORLD_H = 768;

  // style — стиль застройки, lang — пул имён
  J.REGIONS = [
    { id: 'morioh', name: 'Морио-тё', country: 'Япония', x: 953, y: 300, land: 45, biome: 'temperate', city: 30, style: 'japan', lang: 'jp', danger: 1 },
    { id: 'tibet', name: 'Тибет', country: 'Тибет', x: 840, y: 250, land: 55, biome: 'alpine', city: 9, style: 'tibet', lang: 'tib', danger: 3 },
    { id: 'varanasi', name: 'Варанаси', country: 'Индия', x: 830, y: 420, land: 60, biome: 'savanna', city: 22, style: 'india', lang: 'in', danger: 2 },
    { id: 'singapore', name: 'Сингапур', country: 'Сингапур', x: 910, y: 600, land: 45, biome: 'tropical', city: 22, style: 'singapore', lang: 'sg', danger: 2 },
    { id: 'arabia', name: 'Аравийская пустыня', country: 'Ближний Восток', x: 760, y: 350, land: 40, biome: 'desert', city: 0, lang: 'ar', danger: 3 },
    { id: 'cairo', name: 'Каир', country: 'Египет', x: 610, y: 540, land: 85, biome: 'desert', city: 28, style: 'egypt', lang: 'ar', danger: 4 },
    { id: 'naples', name: 'Неаполь', country: 'Италия', x: 600, y: 362, land: 45, biome: 'mediterranean', city: 26, style: 'italy', lang: 'it', danger: 3 },
    { id: 'rome', name: 'Рим', country: 'Италия', x: 520, y: 290, land: 50, biome: 'mediterranean', city: 26, style: 'italy', lang: 'it', danger: 3 },
    { id: 'venice', name: 'Венеция', country: 'Италия', x: 640, y: 245, land: 40, biome: 'mediterranean', city: 16, style: 'italy', lang: 'it', danger: 2 },
    { id: 'alps', name: 'Швейцарские Альпы', country: 'Швейцария', x: 560, y: 200, land: 55, biome: 'alpine', city: 10, style: 'swiss', lang: 'de', danger: 4 },
    { id: 'london', name: 'Лондон', country: 'Англия', x: 470, y: 120, land: 60, biome: 'moor', city: 28, style: 'london', lang: 'en', danger: 2 },
    { id: 'greenland', name: 'Ледяной перешеек', country: 'Север', x: 375, y: 55, land: 30, biome: 'tundra', city: 0, lang: 'en', danger: 4 },
    { id: 'newyork', name: 'Нью-Йорк', country: 'США', x: 260, y: 150, land: 75, biome: 'temperate', city: 30, style: 'usa', lang: 'en', danger: 2 },
    { id: 'arizona', name: 'Аризона', country: 'США', x: 170, y: 300, land: 95, biome: 'mesa', city: 8, style: 'western', lang: 'en', danger: 4 },
    { id: 'sandiego', name: 'Сан-Диего', country: 'США', x: 70, y: 340, land: 55, biome: 'prairie', city: 18, style: 'western', lang: 'en', danger: 2 },
    { id: 'florida', name: 'Флорида', country: 'США', x: 305, y: 420, land: 55, biome: 'swamp', city: 18, style: 'usa', lang: 'en', danger: 3 },
    { id: 'mexico', name: 'Мексика', country: 'Мексика', x: 175, y: 540, land: 80, biome: 'desert', city: 16, style: 'mexico', lang: 'es', danger: 4 },
    { id: 'airsupplena', name: 'Остров Эйр-Сапплена', country: 'Средиземное море', x: 650, y: 405, land: 13, biome: 'mediterranean', city: 0, island: true, lang: 'it', danger: 2 },
  ];
  // Мир масштабируется: координаты выше заданы для 1024×768
  const SC = 1.5;
  J.WORLD_W = Math.round(1024 * SC);
  J.WORLD_H = Math.round(768 * SC);
  // Радиусы городов в клетках (1 клетка = 1 м): настоящие проспекты и кварталы помещаются только в большие города
  J.CITY_R = { newyork: 140, cairo: 130, london: 100, varanasi: 100, singapore: 90, sandiego: 80, florida: 80, mexico: 80, morioh: 80, rome: 64, naples: 64, venice: 60, arizona: 32, alps: 30, tibet: 28 };
  J.REGION = {};
  J.REGIONS.forEach((r, i) => {
    r.idx = i;
    r.x = Math.round(r.x * SC);
    r.y = Math.round(r.y * SC);
    r.land = Math.round(r.land * SC);
    r.city = r.city ? J.CITY_R[r.id] || Math.round(r.city * 1.25) : 0;
    J.REGION[r.id] = r;
  });

  // Сетка улиц по стилям (в клетках = метрах; ширина асфальта чётная, чтобы ось дороги шла по краю клетки).
  // aw/as — асфальт/тротуар проспекта, sw/ss — улицы; lng/sht — размер квартала по длинной/короткой оси
  // для зон [центр, середина, окраина]; lngAve/shtAve — каждая N-я линия — проспект (99 — только центральная);
  // maxF — этажность в самом центре; pitched — доля скатных крыш; drive — сторона движения
  J.GRID = {
    usa: { aw: 12, as: 3, sw: 8, ss: 3, lng: [40, 36, 34], sht: [26, 24, 22], lngAve: 1, shtAve: 3, maxF: 42, pitched: 0.1, drive: 'R' },
    singapore: { aw: 12, as: 3, sw: 8, ss: 3, lng: [38, 34, 32], sht: [26, 24, 22], lngAve: 1, shtAve: 3, maxF: 36, pitched: 0.05, drive: 'L' },
    japan: { aw: 10, as: 3, sw: 6, ss: 2, lng: [30, 28, 26], sht: [22, 20, 20], lngAve: 2, shtAve: 3, maxF: 14, pitched: 0.6, drive: 'L' },
    london: { aw: 10, as: 3, sw: 8, ss: 3, lng: [40, 36, 32], sht: [26, 24, 22], lngAve: 2, shtAve: 3, maxF: 18, pitched: 0.7, drive: 'L' },
    italy: { aw: 10, as: 3, sw: 6, ss: 2, lng: [30, 28, 26], sht: [22, 20, 20], lngAve: 2, shtAve: 3, maxF: 7, pitched: 0.85, drive: 'R' },
    egypt: { aw: 12, as: 3, sw: 6, ss: 2, lng: [36, 32, 30], sht: [24, 22, 22], lngAve: 2, shtAve: 3, maxF: 10, pitched: 0, drive: 'R' },
    india: { aw: 10, as: 3, sw: 6, ss: 2, lng: [34, 30, 28], sht: [22, 22, 20], lngAve: 2, shtAve: 3, maxF: 8, pitched: 0.1, drive: 'L' },
    mexico: { aw: 10, as: 3, sw: 6, ss: 2, lng: [34, 30, 28], sht: [22, 22, 20], lngAve: 2, shtAve: 3, maxF: 4, pitched: 0.1, drive: 'R' },
    western: { aw: 12, as: 3, sw: 6, ss: 2, lng: [36, 36, 36], sht: [22, 22, 22], lngAve: 99, shtAve: 99, maxF: 2, pitched: 0.5, drive: 'R' },
    swiss: { aw: 8, as: 3, sw: 6, ss: 2, lng: [30, 30, 30], sht: [22, 22, 22], lngAve: 99, shtAve: 99, maxF: 4, pitched: 1, drive: 'R' },
    tibet: { aw: 8, as: 2, sw: 6, ss: 2, lng: [28, 28, 28], sht: [22, 22, 22], lngAve: 99, shtAve: 99, maxF: 3, pitched: 1, drive: 'L' },
  };
  // Доли зон по рангу удалённости кварталов: [ядро, деловой центр, средний пояс], остальное — пригород
  J.ZSHARE = { usa: [0.08, 0.2, 0.42], singapore: [0.08, 0.2, 0.45], london: [0.04, 0.16, 0.5], japan: [0.04, 0.16, 0.48], egypt: [0.03, 0.15, 0.5], italy: [0, 0.14, 0.56], india: [0, 0.14, 0.5], mexico: [0, 0.1, 0.5], western: [0, 0, 0.5], swiss: [0, 0, 0.5], tibet: [0, 0, 0.5] };
  // Особые здания: предпочтительные зоны, минимальный участок (фасад × глубина), этажность
  {
    const BIG = { w: 14, d: 12 }, MED = { w: 12, d: 10 }, SMALL = { w: 8, d: 8 };
    J.CITY_PREF = {
      station: { z: ['downtown', 'midtown'], s: { w: 18, d: 12 }, f: 2 },
      hospital: { z: ['midtown', 'downtown'], s: { w: 16, d: 14 }, f: 6 },
      school: { z: ['midtown', 'suburb'], s: { w: 16, d: 12 }, f: 3 },
      hotel: { z: ['core', 'downtown'], s: BIG, f: 16, tower: 1 },
      office: { z: ['core', 'downtown'], s: BIG, f: 24, tower: 1 },
      speedwagon: { z: ['core', 'downtown'], s: BIG, f: 30, tower: 1 },
      casino: { z: ['downtown', 'core'], s: BIG, f: 8 },
      church: { z: ['midtown', 'downtown'], s: { w: 12, d: 14 }, f: 3 },
      police: { z: ['midtown', 'downtown'], s: MED, f: 3 },
      library: { z: ['midtown', 'downtown'], s: MED, f: 3 },
      gym: { z: ['midtown'], s: SMALL, f: 2 },
      kame_yu: { z: ['downtown', 'midtown'], s: BIG, f: 4 },
      passione: { z: ['midtown', 'downtown'], s: MED, f: 4 },
      polpo_prison: { z: ['suburb', 'midtown'], s: { w: 16, d: 14 }, f: 4 },
      colosseum: { z: ['downtown', 'midtown'], s: { w: 20, d: 18 }, f: 4 },
      sbr_office: { z: ['midtown', 'downtown'], s: MED, f: 2 },
      stable: { z: ['suburb'], s: MED, f: 1 },
      farm: { z: ['suburb'], s: MED, f: 1 },
      dig: { z: ['suburb'], s: MED, f: 1 },
      dock: { z: ['suburb', 'midtown'], s: MED, f: 1, water: true },
      rohan: { z: ['suburb', 'midtown'], s: SMALL, f: 2 },
    };
    J.CITY_PREF_DEFAULT = { z: ['midtown', 'downtown'], s: SMALL, f: null };
  }
  const scalePt = (p) => (typeof p === 'string' ? p : [Math.round(p[0] * SC), Math.round(p[1] * SC)]);

  // Перешейки между землями: [ax, ay, bx, by, радиус]
  J.CAPSULES = [
    ['newyork', 'arizona', 35], ['arizona', 'sandiego', 40], ['arizona', 'florida', 30], ['arizona', 'mexico', 45],
    [[260, 150], [340, 60], 22], [[340, 60], [430, 50], 20], [[430, 50], 'london', 22],
    ['london', 'alps', 30], ['alps', 'venice', 28], ['alps', 'rome', 30], ['rome', 'naples', 28],
    ['venice', 'arabia', 28], ['arabia', 'cairo', 28], ['arabia', 'varanasi', 30], ['varanasi', 'tibet', 28], ['varanasi', 'singapore', 25],
  ];
  J.CAPSULES.forEach((c) => {
    c[0] = scalePt(c[0]);
    c[1] = scalePt(c[1]);
    c[2] = Math.round(c[2] * SC);
  });
  // Дороги между городами (с промежуточными точками)
  J.ROADS = [
    ['newyork', 'arizona'], ['arizona', 'sandiego'], ['arizona', 'florida'], ['arizona', 'mexico'],
    ['newyork', [340, 62], [430, 52], 'london'],
    ['london', 'alps'], ['alps', 'venice'], ['alps', 'rome'], ['rome', 'naples'],
    ['venice', 'arabia'], ['arabia', 'cairo'], ['arabia', 'varanasi'], ['varanasi', 'tibet'], ['varanasi', 'singapore'], ['tibet', 'morioh'],
  ];
  J.ROADS.forEach((r) => r.forEach((p, i) => (r[i] = scalePt(p))));

  // Типы зданий. job — работа; h — высота (этажи)
  J.BTYPES = {
    home: { name: 'Твой дом', color: '#e6c36a', floors: 2 },
    house: { name: 'Жилой дом', floors: 2, closed: true },
    shop: { name: 'Магазин', color: '#5ac8fa', floors: 1, shop: 'shop', job: { title: 'Кассир', pay: 12, stat: 'cha' } },
    restaurant: { name: 'Ресторан', color: '#ff7a59', floors: 1, shop: 'restaurant', job: { title: 'Официант', pay: 14, stat: 'cha' } },
    hospital: { name: 'Больница', color: '#ff5d73', floors: 3, shop: 'hospital', job: { title: 'Санитар', pay: 15, stat: 'end' } },
    gym: { name: 'Спортзал', color: '#f2c230', floors: 2 },
    school: { name: 'Школа', color: '#7ed957', floors: 3, job: { title: 'Учёба', pay: 0, stat: 'int', study: true } },
    library: { name: 'Библиотека', color: '#c9a46b', floors: 2 },
    station: { name: 'Вокзал', color: '#9b6bff', floors: 2 },
    hotel: { name: 'Отель', color: '#ffb6e1', floors: 4 },
    bar: { name: 'Бар', color: '#d6a03a', floors: 1 },
    police: { name: 'Полиция', color: '#4f8fd8', floors: 2 },
    speedwagon: { name: 'Фонд Спидвагона', color: '#f2c230', floors: 4 },
    black_market: { name: 'Чёрный рынок', color: '#b06bff', floors: 1, shop: 'black_market' },
    church: { name: 'Церковь', color: '#e8e8f0', floors: 3 },
    dock: { name: 'Порт', color: '#5ab3ff', floors: 1, job: { title: 'Грузчик', pay: 16, stat: 'str' } },
    office: { name: 'Офис', color: '#9ad0ff', floors: 6, job: { title: 'Клерк', pay: 22, stat: 'int', req: { int: 4 } } },
    farm: { name: 'Ферма', color: '#a8d05a', floors: 1, job: { title: 'Фермер', pay: 10, stat: 'end' } },
    dig: { name: 'Раскопки', color: '#d9b77a', floors: 1, job: { title: 'Археолог', pay: 18, stat: 'int', dig: true } },
    casino: { name: 'Казино', color: '#ff4fa3', floors: 2 },
    stable: { name: 'Конюшня', color: '#c98a4a', floors: 1, shop: 'stable', job: { title: 'Конюх', pay: 12, stat: 'agi' } },
    // Особые
    trussardi: { name: 'Траттория Труссарди', color: '#ff7a59', floors: 1, special: true },
    rohan: { name: 'Дом Кисибэ Рохана', color: '#8fd5ff', floors: 2, special: true, job: { title: 'Ассистент мангаки', pay: 24, stat: 'int', req: { int: 3 }, rohan: true } },
    kame_yu: { name: 'Универмаг «Камэ Ю»', color: '#5ac8fa', floors: 3, shop: 'shop', special: true, job: { title: 'Продавец', pay: 13, stat: 'cha' } },
    passione: { name: 'Штаб Пассионе', color: '#e2368f', floors: 3, special: true, job: { title: 'Поручения банды', pay: 32, stat: 'str', gang: true } },
    polpo_prison: { name: 'Тюрьма Неаполя', color: '#7a7f8c', floors: 3, special: true },
    colosseum: { name: 'Колизей', color: '#d9b77a', floors: 4, special: true },
    hamon_temple: { name: 'Храм Хамона', color: '#ffd84a', floors: 3, special: true },
    lisa_castle: { name: 'Замок Лизы Лизы', color: '#ffd84a', floors: 5, special: true },
    zeppeli_house: { name: 'Дом барона Цеппели', color: '#ffd84a', floors: 2, special: true },
    joestar_mansion: { name: 'Поместье Джостаров', color: '#f2c230', floors: 3, special: true },
    dio_mansion: { name: 'Особняк ДИО', color: '#f2c230', floors: 4, special: true },
    green_dolphin: { name: 'Тюрьма «Грин Дельфин»', color: '#5ab3ff', floors: 3, special: true, job: { title: 'Прачечная', pay: 6, stat: 'end' } },
    sbr_office: { name: 'Штаб Steel Ball Run', color: '#f2c230', floors: 2, special: true },
    pillar_ruins: { name: 'Древние руины', color: '#c9a46b', floors: 2, special: true },
    cape: { name: 'Мыс Канаверал', color: '#ffffff', floors: 5, special: true },
  };

  // Здания в городах (по порядку важности; остальное — жилые дома)
  J.CITY_BUILDINGS = {
    morioh: ['station', 'kame_yu', 'trussardi', 'hospital', 'school', 'hotel', 'rohan', 'gym', 'library', 'police', 'shop', 'bar', 'office'],
    naples: ['station', 'passione', 'polpo_prison', 'restaurant', 'hotel', 'shop', 'hospital', 'gym', 'bar', 'black_market', 'dock', 'church', 'police'],
    rome: ['station', 'colosseum', 'restaurant', 'hotel', 'shop', 'hospital', 'bar', 'church', 'library', 'black_market'],
    venice: ['station', 'restaurant', 'hotel', 'shop', 'bar', 'dock', 'church'],
    alps: ['station', 'hotel', 'shop', 'restaurant', 'hospital'],
    london: ['station', 'speedwagon', 'restaurant', 'hotel', 'shop', 'hospital', 'library', 'gym', 'bar', 'black_market', 'police', 'church', 'school'],
    newyork: ['station', 'speedwagon', 'restaurant', 'hotel', 'shop', 'hospital', 'gym', 'bar', 'police', 'office', 'casino', 'black_market', 'library', 'school'],
    sandiego: ['station', 'sbr_office', 'stable', 'restaurant', 'hotel', 'shop', 'bar', 'dock', 'hospital'],
    arizona: ['station', 'stable', 'shop', 'bar'],
    florida: ['station', 'restaurant', 'hotel', 'shop', 'hospital', 'bar', 'police', 'church', 'dock'],
    mexico: ['station', 'restaurant', 'hotel', 'shop', 'bar', 'dig', 'hospital', 'black_market'],
    cairo: ['station', 'speedwagon', 'restaurant', 'hotel', 'shop', 'hospital', 'bar', 'dig', 'black_market', 'casino', 'police'],
    varanasi: ['station', 'restaurant', 'hotel', 'shop', 'hospital', 'bar', 'church', 'farm'],
    singapore: ['station', 'restaurant', 'hotel', 'shop', 'hospital', 'gym', 'bar', 'dock', 'office'],
    tibet: ['station', 'shop', 'hotel'],
  };

  // Палитры стилей: стены, крыши, высота
  J.STYLES = {
    japan: { walls: ['#efe6d8', '#d9d4c7', '#c7d3dd', '#f0d9c4'], roofs: ['#4a5a78', '#7a3a3a', '#5a5f6a', '#3a6a5a'], tall: 1 },
    italy: { walls: ['#f2d3a0', '#e8b98a', '#f0e0c0', '#e6a97a', '#f5e7c8'], roofs: ['#c4583a', '#b04a30', '#d0703f'], tall: 1.4 },
    egypt: { walls: ['#e3c99a', '#d9b77a', '#ead8b0'], roofs: ['#cdb07a', '#c49f66', '#d8c08a'], tall: 1, flat: true },
    london: { walls: ['#8a4a3a', '#7a5a4a', '#9a6a5a', '#6a5a52'], roofs: ['#3a3f4a', '#4a4f5a', '#2f3440'], tall: 1.3 },
    usa: { walls: ['#b8bcc8', '#c9a48a', '#9aa8b8', '#d0c8b8', '#8a8f9a'], roofs: ['#4a4f5a', '#5a5f6a', '#3a3a44'], tall: 2.2, flat: true },
    western: { walls: ['#b98a5a', '#a87a4a', '#c99a6a'], roofs: ['#7a5a3a', '#6a4a2a'], tall: 1 },
    mexico: { walls: ['#f2b8a0', '#a0d8c8', '#f2e08a', '#e8a0c0'], roofs: ['#c4583a', '#d0703f'], tall: 1, flat: true },
    india: { walls: ['#f2c8a0', '#e8a0a0', '#a0c8e8', '#f2e0a0'], roofs: ['#c47a3a', '#b05a3a'], tall: 1.1, flat: true },
    singapore: { walls: ['#f5f5f0', '#a0e0d8', '#f2d0a0', '#e8e8f8'], roofs: ['#c4583a', '#3a8a7a'], tall: 2, flat: true },
    tibet: { walls: ['#f0e8d8', '#e8d0b0'], roofs: ['#b03a3a', '#d0a03a'], tall: 1 },
    swiss: { walls: ['#e8d8c0', '#d8c0a0'], roofs: ['#6a4a3a', '#5a3a2a'], tall: 1.2 },
  };

  J.NAMES = {
    jp: {
      f: ['Таро', 'Хиро', 'Кэнта', 'Юки', 'Аюми', 'Сакура', 'Рэн', 'Сота', 'Харука', 'Мисаки', 'Кодзи', 'Дайки', 'Нанами', 'Рина', 'Такэси', 'Сигэру', 'Мика', 'Аки'],
      l: ['Сато', 'Судзуки', 'Такахаси', 'Танака', 'Ватанабэ', 'Ито', 'Накамура', 'Кобаяси', 'Ямамото', 'Като', 'Ёсида', 'Мацумото', 'Иноуэ'],
    },
    it: {
      f: ['Марко', 'Лука', 'Джованни', 'Франческа', 'Джулия', 'Алессандро', 'Паоло', 'Сильвия', 'Карла', 'Маттео', 'Дарио', 'Анджело', 'Рената', 'Сандро'],
      l: ['Росси', 'Руссо', 'Феррари', 'Эспозито', 'Бьянки', 'Романо', 'Колонна', 'Риччи', 'Галло', 'Конти'],
    },
    en: {
      f: ['Джон', 'Мэри', 'Джеймс', 'Элизабет', 'Уильям', 'Эмили', 'Роберт', 'Сара', 'Генри', 'Джордж', 'Анна', 'Томас', 'Люси', 'Джек'],
      l: ['Смит', 'Браун', 'Тейлор', 'Уилсон', 'Эванс', 'Кларк', 'Уокер', 'Райт', 'Грин', 'Холл'],
    },
    ar: {
      f: ['Ахмед', 'Мухаммед', 'Фатима', 'Омар', 'Лейла', 'Карим', 'Хасан', 'Амира', 'Юсуф', 'Надя', 'Самир'],
      l: ['аль-Масри', 'Хассан', 'Саид', 'Махмуд', 'Фарук', 'Насер'],
    },
    in: { f: ['Радж', 'Прия', 'Арджун', 'Анжали', 'Викрам', 'Сита', 'Рави', 'Мира', 'Аван'], l: ['Шарма', 'Сингх', 'Патель', 'Гупта', 'Кумар'] },
    sg: { f: ['Вэй', 'Мэй', 'Джун', 'Лин', 'Аиша', 'Кумар', 'Хуэй'], l: ['Тан', 'Ли', 'Лим', 'Онг', 'Нг'] },
    es: { f: ['Хосе', 'Мария', 'Карлос', 'Хуан', 'Ана', 'Луис', 'Изабелла', 'Педро', 'Рохелио'], l: ['Гарсия', 'Лопес', 'Мартинес', 'Эрнандес', 'Рамирес'] },
    tib: { f: ['Тензин', 'Дорже', 'Пема', 'Карма', 'Нима', 'Лхамо'], l: ['', '', ''] },
    de: { f: ['Ганс', 'Грета', 'Клаус', 'Ева', 'Фриц', 'Анна', 'Лукас'], l: ['Мюллер', 'Шмидт', 'Фишер', 'Вебер', 'Келлер'] },
  };

  // Реплики прохожих
  J.LINES = {
    any: [
      'Хорошая погода сегодня, правда?',
      'Ты видел этого парня в фуражке? Говорят, он сильнее всех на свете.',
      'Мне кажется, за мной кто-то следит... Кто-то, кого невозможно увидеть.',
      'Мой дедушка говорил: «Стенд-юзеры притягиваются друг к другу». Странный был старик.',
      'Что ты так на меня смотришь? Это вызов?!',
      'Иногда по ночам на улицах пропадают люди. Будь осторожен.',
      'Ты слышал? Нашли древнюю каменную маску. Её сразу кто-то украл.',
      'Ничего не понимаю... Я только что был здесь, и вдруг прошла минута. Будто время стёрли.',
      'Фонд Спидвагона щедро платит за странные находки.',
      'Слышал про стрелу, от которой люди получают призрачных духов? Ерунда, наверное.',
      'Если увидишь кого-то в странной позе — не подходи. Это может быть стенд-юзер.',
      'Говорят, где-то есть мастер, который учит дышать по-особому. Дыхание солнца...',
      'Ой, извини! Я засмотрелся на твою причёску.',
      'Я когда-то был жокеем. Пересёк всю Америку верхом!',
      'Работы полно, денег мало. Обычная жизнь, что ещё скажешь?',
    ],
    morioh: [
      'В «Камэ Ю» сегодня распродажа!',
      'Ты был в траттории Труссарди? После его спагетти у меня перестали болеть зубы!',
      'Мангака Кисибэ Рохан живёт здесь. Не соглашайся, если он предложит «просто посмотреть» на тебя.',
      'Морио — тихий город. Слишком тихий...',
      'Ты не видел кота? Странного... у которого вместо шерсти растения.',
      'Не смейся над причёсками местных. Серьёзно. Не надо.',
      'Говорят, в доме Нидзимуры есть что-то жуткое. И там живёт кто-то запертый.',
      'Кто-то ворует руки... То есть, кошельки! Я хотел сказать — кошельки.',
    ],
    naples: [
      'Пассионе держит этот город. Они не прощают долгов.',
      'Если ищешь работу — спроси в баре. Только не задавай лишних вопросов.',
      'Арриведерчи! Ха-ха, это я просто так.',
      'Босса Пассионе никто никогда не видел. Никто.',
      'В тюрьме сидит один толстяк, который раздаёт «испытания». Тех, кто проваливается, больше не видят.',
      'Лучшая пицца в мире — здесь. Не спорь.',
    ],
    rome: [
      'Колизей ночью — жуткое место. Там что-то шевелится.',
      'Под Римом есть древние катакомбы. Говорят, там спят... не люди.',
      'Все дороги ведут в Рим. Даже самые странные.',
    ],
    venice: ['Гондолы, каналы, туман... Отсюда ходит лодка на остров Эйр-Сапплена.', 'На острове живёт таинственная женщина. Она учит дышать.'],
    cairo: [
      'Ночью в старом особняке за городом горит свет... Там живёт кто-то, кто боится солнца.',
      'Солнце здесь беспощадное. Хорошо для тех, кто боится вампиров!',
      'На раскопках иногда находят странные вещи. Стрелы, маски...',
      'В казино есть игрок, который ставит на кон души. Не садись с ним играть.',
      'Слышал, у наёмников ДИО все стенды названы по картам Таро.',
    ],
    london: [
      'Мистер Спидвагон когда-то был бандитом на Огр-стрит. Теперь он миллионер!',
      'Туман сегодня густой. В таком тумане что угодно может прятаться.',
      'Поместье Джостаров давно сгорело... или нет?',
      'Барон Цеппели живёт за городом. Странный человек, всё время дышит.',
    ],
    newyork: ['Фонд Спидвагона — самая богатая организация в мире. И самая загадочная.', 'Нью-Йорк никогда не спит. Как и вампиры.', 'Здесь можно найти всё. Даже то, чего не стоит искать.'],
    sandiego: ['Скоро старт великой гонки Steel Ball Run! Приз — 50 миллионов долларов!', 'Без лошади в прерии ты никто.', 'Говорят, в пустыне есть место, где люди получают силу. Дьявольская ладонь...'],
    arizona: ['Пустыня убивает слабых.', 'Здесь находили части тела... святого. Да, я серьёзно.', 'Видишь песчаную бурю — прячься.'],
    florida: ['Тюрьма «Грин Дельфин» — оттуда никто не выходит.', 'Аллигаторы на болотах — не самое страшное во Флориде.', 'Священник в тюрьме... Что-то с ним не так.'],
    mexico: ['В горах есть древние руины. Учёные туда ходили. Не вернулись.', 'Там, под руинами, спит что-то древнее, чем человечество.', 'Ночью в пустыне воют... и это не койоты.'],
    varanasi: ['Ганг очищает душу.', 'Здесь когда-то сражались странные люди — один с цепью, другой с мечом в зеркале.'],
    singapore: ['Сингапур — город чистоты. Не мусори!', 'На корабле в порту видели огромную обезьяну... она курила?!'],
    tibet: ['Мастер Тонпетти учит хамону в горном храме.', 'Здесь воздух чист. Идеально для дыхания.'],
    alps: ['В горах нашли каменный столб с человеком внутри... Нацисты? Нет, хуже.', 'Красный камень Айи? Легенда. Наверное.'],
    airsupplena: ['Госпожа Лиза Лиза не терпит лентяев.', 'Тренировка хамона здесь — это ад. Но ты станешь сильнее.'],
    greenland: ['Холодно... Даже вампиры здесь мёрзнут.'],
    arabia: ['Песок, солнце и бесконечная дорога.'],
  };

  // Ночные реплики
  J.NIGHT_LINES = ['Поздно уже... Лучше не гулять в темноте.', 'Ночью здесь не безопасно. Я слышал крики.', 'Ты тоже не спишь? Странная сегодня ночь.'];

  // Происхождения персонажа
  J.ORIGINS = [
    { id: 'student', name: 'Школьник из Морио', region: 'morioh', money: 300, stats: { int: 1, cha: 1 }, items: { onigiri: 2, coffee: 1 }, desc: 'Обычный старшеклассник. Ничего странного... пока.', perk: 'Учёба даёт больше опыта. Дом в Морио.' },
    { id: 'joestar', name: 'Наследник Джостаров', region: 'newyork', money: 900, stats: { spi: 1, end: 1 }, items: { tea: 2 }, mark: true, desc: 'Родимое пятно-звезда на шее. Кровь Джостаров зовёт к приключениям.', perk: 'Шанс пережить Стрелу +25%. Хамон учится быстрее. Особая судьба.' },
    { id: 'gangster', name: 'Уличный бандит', region: 'naples', money: 150, stats: { str: 1, agi: 1 }, items: { bandage: 2, switchblade: 1 }, desc: 'Мечтаешь подняться в Пассионе. У тебя есть мечта!', perk: 'Пассионе быстрее примет тебя. Больше денег за поручения.' },
    { id: 'zeppeli', name: 'Потомок Цеппели', region: 'london', money: 500, stats: { end: 1, spi: 1 }, items: { wine: 1 }, hamon: 1, desc: 'Искусство хамона — семейная традиция.', perk: 'Начинаешь с хамоном 1 уровня.' },
    { id: 'archaeologist', name: 'Археолог', region: 'cairo', money: 600, stats: { int: 2 }, items: { water: 3 }, desc: 'Ищешь древние артефакты. Иногда они находят тебя.', perk: 'Раскопки чаще дают артефакты: стрелы, маски.' },
    { id: 'jockey', name: 'Жокей', region: 'sandiego', money: 400, stats: { agi: 2 }, items: { horse: 1, water: 2, revolver: 1, bullets: 12 }, desc: 'Лошадь, седло и бескрайняя прерия.', perk: 'Начинаешь с лошадью. Вращение учится быстрее.' },
    { id: 'brando', name: 'Потомок Брандо', region: 'london', money: 800, stats: { cha: 2 }, items: { wine: 2 }, mark: true, desc: 'Тёмное наследие. Каменная маска манит тебя.', perk: 'Сильнее как вампир. Шанс пережить Стрелу +15%.' },
    { id: 'prisoner', name: 'Осуждённый', region: 'florida', money: 60, stats: { str: 1, end: 1 }, items: { bandage: 1, brick: 1 }, desc: 'Тебя подставили. Свобода — дорогое удовольствие.', perk: 'Стенд-диски чаще попадают к тебе.' },
    { id: 'born', name: 'Прирождённый стенд-юзер', region: null, money: 200, stats: { spi: 1 }, items: { onigiri: 1 }, stand: true, desc: 'Твой стенд был с тобой с рождения. Но враги тоже его видят.', perk: 'Начинаешь со случайным стендом. Случайный город.' },
  ];

  J.HAIR_STYLES = [
    { id: 'short', name: 'Короткая' },
    { id: 'pompadour', name: 'Помпадур' },
    { id: 'cap', name: 'Фуражка' },
    { id: 'curls', name: 'Три завитка' },
    { id: 'long', name: 'Длинные' },
    { id: 'spiky', name: 'Ёжик' },
    { id: 'buns', name: 'Пучки' },
    { id: 'bald', name: 'Лысый' },
  ];
  J.SKINS = ['#f6d7c3', '#eac09f', '#d9a57f', '#b8805c', '#8a5a3c', '#5e3b26'];
  J.HAIR_COLORS = ['#1c1a24', '#3b2a1d', '#7a4b2a', '#d9b36a', '#f2e6c8', '#c2341f', '#2a6ad8', '#3aa86b', '#b06bff', '#e8e8f0', '#ff7ab8'];
  J.OUTFIT_COLORS = ['#1f2a44', '#2c2238', '#e2368f', '#f2c230', '#2aa7d8', '#3aa86b', '#d8442b', '#f4f4f4', '#7a5cd6', '#e58bd0', '#2b2b33', '#c98a4a'];
})();
