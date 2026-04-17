# Sergei Quest — v2 (Vite + Supabase Realtime + Reactions)

## 🚀 Что изменилось

### 1. Миграция с CRA на Vite
- Dev-сервер стартует за ~0.5 сек вместо 10-15 сек
- Hot reload мгновенный
- Vercel автоматически определит Vite-проект — никаких настроек менять не нужно

### 2. Supabase Realtime вместо polling
- Было: запрос каждые 8 секунд на 6 таблиц = ~2700 запросов в час
- Стало: одно WebSocket-соединение, обновления прилетают мгновенно
- Egress-трафик падает на порядок → вписываемся в бесплатный Supabase

### 3. Реакции от Сергея
- На каждую запись в логе (кроме его собственных действий) он может поставить эмодзи: 🐷 🔥 🎉 ❤️ 👍🏻 👎🏻
- Повторный тап по реакции — убирает её
- Админ видит реакции в новой вкладке "📜 Лог" с отдельной секцией "💬 Реакции Сергея"
- Счётчик в табе показывает сколько реакций накопилось

## 📋 Что нужно сделать для запуска

### Шаг 1: Применить миграцию БД

Открой Supabase → SQL Editor и выполни файл `SUPABASE_MIGRATION.sql`.

Там в самом конце (секция "MIGRATION v3") добавились:
- Поле `reaction` в `sq_log`
- Включение Realtime для всех таблиц через `alter publication supabase_realtime add table ...`

**Важно:** без этой миграции Realtime работать не будет.

Альтернатива через UI: Database → Replication → включить тумблеры для всех таблиц `sq_*`.

### Шаг 2: Локально

```bash
npm install
npm run dev        # dev-сервер на http://localhost:3000
npm run build      # сборка в папку build/
npm run preview    # локально посмотреть собранный билд
```

### Шаг 3: Deploy на Vercel

Vercel сам всё подхватит. Ничего настраивать не нужно — он видит `vite.config.js` и `package.json` с `vite` в зависимостях, и выбирает правильный фреймворк автоматически.

Единственное: в настройках проекта на Vercel, если там было прописано вручную "Framework: Create React App" — поменяй на "Vite" (или оставь "Other", Vercel сам разберётся по package.json). Output directory оставь `build` — я специально это настроил, чтобы путь не менялся.

## 🗂 Структура

```
├── index.html              ← точка входа Vite (в корне, не в public/)
├── vite.config.js          ← конфиг Vite
├── package.json            ← vite вместо react-scripts
├── SUPABASE_MIGRATION.sql  ← SQL с миграциями v1/v2/v3
├── public/
│   ├── favicon.ico, logo192/512.png, manifest.json
│   ├── sw.js               ← Service Worker для push
│   └── robots.txt
└── src/
    ├── main.jsx            ← раньше был index.js (CRA)
    ├── App.jsx             ← раньше был App.js
    ├── constants.js        ← + REACTION_EMOJIS, OWN_ACTION_TYPES
    ├── hooks.js            ← переписан на Supabase Realtime
    ├── components/
    │   ├── Badge.jsx
    │   ├── BurstLayer.jsx
    │   ├── TaskCard.jsx
    │   └── Toast.jsx
    └── screens/
        ├── LoginScreen.jsx
        ├── ProfileScreen.jsx
        ├── TasksScreen.jsx
        ├── LogScreen.jsx   ← переписан: + UI реакций
        ├── RewardScreen.jsx
        └── AdminScreen.jsx ← + вкладка "📜 Лог"
```

## 🔧 Как работают реакции

**Сергей (LogScreen):**
- Для записей с типом `earn`, `reject`, `manual`, `fail`, `tier` (не его собственные действия) видит кнопку `+ 😀`
- Тап → раскрывается палитра из 6 эмодзи
- Тап по эмодзи → реакция сохраняется в `sq_log.reaction`, точечный PATCH в БД (без ожидания debounced push)
- Тап по уже поставленной реакции → снимает её

**Админ (AdminScreen → вкладка "📜 Лог"):**
- Сверху блок "💬 Реакции Сергея" — только записи, на которые он отреагировал
- Ниже полный лог, записи с реакцией подсвечены голубой рамкой
- В табе счётчик `(N💬)` — сколько всего реакций от Сергея

**Какие события считаются "его собственными" (реагировать нельзя):**
```js
OWN_ACTION_TYPES = ["submit", "cancel", "buy", "tier"]
```
— то есть когда Сергей сам что-то сделал: отправил задание, отменил, купил награду/валюту, получил тир. На всё остальное (одобрения/отказы от тебя, начисления, провалы по дедлайну) — можно.

## ⚙️ Если что-то пойдёт не так

**Реалтайм не работает:**
- Проверь в Supabase Dashboard: Database → Replication — включены ли все таблицы `sq_*`
- Открой консоль браузера: должно быть `SUBSCRIBED` в статусе; если `CHANNEL_ERROR` — не применена миграция v3

**После деплоя Vercel "не та сборка":**
- Зайди в Settings → Build & Development Settings
- Build Command: `npm run build` (или Vercel сам)
- Output Directory: `build`
- Install Command: `npm install`

**Хочу откатиться:**
- Старый код по-прежнему лежит на GitHub, предыдущий коммит работает как раньше.
