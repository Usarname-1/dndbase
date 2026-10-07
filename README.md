# D&D Base — русская база Dungeons & Dragons 5e

[![Сайт](https://img.shields.io/badge/сайт-usarname--1.github.io%2Fdndbase-922610?style=flat-square)](https://usarname-1.github.io/dndbase/)
[![Редакции](https://img.shields.io/badge/редакции-2014%20%2B%202024-2b6a75?style=flat-square)](https://usarname-1.github.io/dndbase/)
[![Записей](https://img.shields.io/badge/записей-~6%20800-7a200d?style=flat-square)](https://usarname-1.github.io/dndbase/)
[![Язык](https://img.shields.io/badge/язык-русский%20%2B%20English-1d1a16?style=flat-square)](https://usarname-1.github.io/dndbase/)

**Бесплатный онлайн-справочник Dungeons & Dragons 5-й редакции на русском языке.**

Бестиарий, заклинания, классы, расы и виды, предыстории, черты, магические предметы, снаряжение и глоссарий правил. Две редакции в одном сайте: **2014 (5e)** и **2024 (PHB / MM / DMG 2024)**.

### [Открыть базу → usarname-1.github.io/dndbase](https://usarname-1.github.io/dndbase/)

Поиск на русском и английском · фильтры по CR, школе, редкости, источнику · статблоки в стиле книги правил · без регистрации.

---

## Зачем это нужно

Русскоязычным мастерам и игрокам обычно приходится прыгать между вики, PDF и таблицами. Здесь всё в одном окне:

- найти монстра по **опасности (CR / БО)**, типу и среде, когда готовите энкаунтер;
- отфильтровать **заклинания** класса по уровню, школе, ритуалу и концентрации;
- сравнить **виды / расы** и **предыстории** при создании персонажа;
- подобрать **магический предмет** по редкости и настройке;
- подсмотреть правило в **глоссарии 2024**, не листая книгу.

Названия даны по-русски, английское имя всегда рядом — можно искать и `огненный шар`, и `Fireball`.

---

## Что внутри

| Раздел | 2024 | 2014 |
| --- | ---: | ---: |
| Бестиарий (монстры, существа, НИП) | 657 | 2 873 |
| Заклинания | 444 | 524 |
| Классы и подклассы | 14 | 16 |
| Виды / расы | 19 | 48 |
| Предыстории | 70 | 87 |
| Черты | 195 | 105 |
| Магические предметы | 437 | 932 |
| Снаряжение | 197 | — |
| Глоссарий правил | 155 | — |
| **Всего записей** | **~2 200** | **~4 600** |

Источники включают Player’s Handbook, Monster Manual, Dungeon Master’s Guide (2014 и 2024), Tasha’s, Xanathar’s, Fizban’s, Eberron, Ravenloft, Forgotten Realms и другие официальные книги — с русскими названиями и английскими именами.

---

## Возможности

- Переключение редакций **2014 ↔ 2024** в шапке. Если запись есть в обеих, на карточке будет ссылка на другую версию.
- Живой **поиск** по русскому и английскому названию.
- Десятки **фильтров**: опасность, тип, размер, мировоззрение, среда, скорость, чувства, КД, хиты, иммунитеты, школа магии, класс, ритуал, концентрация, редкость, настройка, источник.
- Сортировка по алфавиту, CR, уровню, КД, хитам, редкости, цене.
- Карточки в духе официального статблока: характеристики, спасброски, особенности, легендарные действия, логово, региональные эффекты.
- Работает на телефоне. Тёмная тема подстраивается под систему.
- Статический сайт: открыл в браузере — и всё. GitHub Pages, Netlify или просто локальный HTTP-сервер.

---

## Как пользоваться

1. Откройте [usarname-1.github.io/dndbase](https://usarname-1.github.io/dndbase/).
2. Выберите редакцию **2014** или **2024**.
3. Откройте раздел: Бестиарий, Заклинания, Классы, Виды / Расы, Предыстории, Черты, Предметы, Снаряжение, Глоссарий.
4. Введите название в поиск или сузьте список фильтрами.
5. Кликните запись — справа откроется полный статблок.

Прямые ссылки можно копировать из адресной строки:

| Что | Ссылка |
| --- | --- |
| Бестиарий 2024 | [#bestiary](https://usarname-1.github.io/dndbase/#bestiary) |
| Заклинания 2024 | [#spells](https://usarname-1.github.io/dndbase/#spells) |
| Классы 2024 | [#class](https://usarname-1.github.io/dndbase/#class) |
| Бестиарий 2014 | [#14/bestiary](https://usarname-1.github.io/dndbase/#14/bestiary) |
| Заклинания 2014 | [#14/spells](https://usarname-1.github.io/dndbase/#14/spells) |
| Конкретный монстр | `#bestiary/adult-red-dragon` |

---

## Запуск у себя

Обычный статический сайт: `index.html` + JSON. Из-за `fetch()` его нужно открывать через HTTP, а не как `file://`.

```bash
git clone https://github.com/Usarname-1/dndbase.git
cd dndbase
python3 -m http.server 8080
```

Дальше откройте `http://127.0.0.1:8080/`.

Подойдёт любой статический хостинг: GitHub Pages, Cloudflare Pages, Netlify.

---

## Структура репозитория

```text
dndbase/
├── index.html          # поиск, фильтры, карточки
├── data/               # JSON редакции 2024
│   ├── bestiary.json
│   ├── spells.json
│   ├── class.json
│   ├── species.json
│   ├── backgrounds.json
│   ├── feats.json
│   ├── items.json
│   ├── equipment.json
│   └── glossary.json
└── data14/             # JSON редакции 2014
    ├── bestiary.json
    ├── spells.json
    ├── class.json
    ├── race.json
    ├── backgrounds.json
    ├── feats.json
    └── items.json
```

Каждая запись содержит `slug`, `name_ru`, `name_en`, `sources` и поля статблока (CR, хиты, школа, редкость и т.д.).

---

## Правовой статус

**Неофициальный фанатский проект.**

Dungeons & Dragons, D&D, Player’s Handbook, Monster Manual, Dungeon Master’s Guide и все связанные названия — товарные знаки [Wizards of the Coast](https://company.wizards.com/). Материалы публикуются в образовательных и справочных целях для русскоязычного сообщества настольных ролевых игр.

Проект **не связан** с Wizards of the Coast и Hasbro и **не является официальным переводом**.

---

## Развитие

Ошибки в данных, идеи фильтров и правки перевода — через [Issues](https://github.com/Usarname-1/dndbase/issues) и Pull Request.

Если база полезна, поставьте репозиторию ★ — так её проще найти другим игрокам и мастерам.

---

## English

Unofficial **Dungeons & Dragons 5th Edition** reference in **Russian**. Covers both the **2014 (5e)** and **2024** rulesets: bestiary / monsters, spells, classes, species / races, backgrounds, feats, magic items, equipment and a 2024 rules glossary.

- Live site: [https://usarname-1.github.io/dndbase/](https://usarname-1.github.io/dndbase/)
- Search in Russian **and** English (`Fireball` finds «Огненный шар»)
- Filters for CR, type, school, rarity, source, and more
- Book-style statblocks, no account required, static GitHub Pages app

Not affiliated with Wizards of the Coast or Hasbro.
