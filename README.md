# Sergei Quest — v3 (Vite + Realtime + Reactions + Telegram)

## 🚀 Что нового в v3

**Telegram-бот для push-уведомлений на заблокированный экран.**
- Любой пишет боту `/start` и начинает получать все уведомления — работает даже при выключенном приложении
- 11 событий автоматически уходят всем подписчикам:
  - **Админ (5):** одобрение, отклонение, новое задание, ручное начисление монет, произвольное сообщение
  - **Сергей (6):** отправка на проверку, отмена, покупка награды, шоколада, звезды, получение/покупка тира, провал дедлайна
- Ручная отправка из админки: вкладка "🔔 Уведомления" → блок "📱 Telegram"
- Список подписчиков с возможностью удалить любого

---

## 📋 Настройка Telegram с нуля

### Шаг 1. Создать бота

1. В Telegram открой **@BotFather** → `/newbot`
2. Придумай имя (отображаемое) и username (должен заканчиваться на `bot`, например `sergei_quest_bot`)
3. Получишь **токен** вида `123456789:AAEhBP0av5g...` — **сохрани**

### Шаг 2. Вставить токен в код

В `src/constants.js` замени:
```js
export const TELEGRAM_BOT_TOKEN = "YOUR_BOT_TOKEN_HERE";
```
на свой токен. Это нужно для **отправки** сообщений из приложения.

### Шаг 3. Применить SQL-миграцию v4

В Supabase SQL Editor выполни блок `MIGRATION v4` из `SUPABASE_MIGRATION.sql`. Создастся таблица `sq_telegram_subscribers`.

### Шаг 4. Задеплоить Edge Function

Функция нужна для **приёма** команд от Telegram (`/start`, `/stop`).

**4.1** Установить Supabase CLI (если ещё нет):
```bash
npm install -g supabase
# или на Mac: brew install supabase/tap/supabase
```

**4.2** Залогиниться и связать проект:
```bash
supabase login

cd путь/до/sergei-stars-vite
supabase link --project-ref hfwjzcdiftywljshmtgo
```
(ID проекта найдёшь в Supabase → Settings → General → Reference ID)

**4.3** Прописать секреты функции:
```bash
supabase secrets set TELEGRAM_BOT_TOKEN=123456789:AAEhBP0av5g...

# SERVICE_ROLE_KEY: Supabase → Settings → API → service_role key (это НЕ тот же ключ что anon)
supabase secrets set SUPABASE_SERVICE_ROLE_KEY=eyJhbGci...
```

**4.4** Задеплоить:
```bash
supabase functions deploy telegram-webhook --no-verify-jwt
```

Флаг `--no-verify-jwt` обязателен — Telegram не знает про JWT.

После деплоя получишь URL вида:
```
https://hfwjzcdiftywljshmtgo.supabase.co/functions/v1/telegram-webhook
```

### Шаг 5. Подключить webhook к Telegram

Одна команда в терминале (подставь свой токен и URL из предыдущего шага):
```bash
curl "https://api.telegram.org/bot<ТВОЙ_ТОКЕН>/setWebhook?url=<URL_ФУНКЦИИ>"
```

Должен ответить `{"ok":true,"result":true,"description":"Webhook was set"}`.

Проверить:
```bash
curl "https://api.telegram.org/bot<ТВОЙ_ТОКЕН>/getWebhookInfo"
```

### Шаг 6. Подписаться

1. Найди бота в Telegram по username
2. Напиши `/start` — бот ответит `✅ Подписка активна!`
3. Попроси Сергея сделать то же самое

### Шаг 7. Проверить

1. Зайди в приложение админом → "🔔 Уведомления"
2. Внизу блок "📱 Telegram" → должен быть "✅ Активен" и твой username в списке
3. Отправь тест через "Отправить в Telegram" — должно прийти мгновенно

---

## 🔧 Команды бота

- `/start` — подписаться
- `/stop` — отписаться
- `/whoami` — узнать свой chat_id
- `/help` — список команд

## 🛠 Что и когда уходит в Telegram

| Событие | Текст |
|---|---|
| Админ одобрил задание | `✅ Задание одобрено! «название» +N 💰` |
| Админ отклонил | `❌ Задание отклонено «название»` |
| Админ добавил задание | `📋 Новое задание! «название» — N 💰` |
| Админ начислил монеты | `💰 Начисление! +N монет` |
| Админ отправил сообщение | любой текст |
| Сергей отправил задание | `📤 Sergei отправил задание «X» на проверку` |
| Сергей отменил | `↩️ Sergei отменил задание «X»` |
| Сергей купил награду | `🎁 Sergei купил награду «X» (−N 💰)` |
| Сергей купил шоколад | `🍫 Sergei купил батончик (−N 💰)` |
| Сергей купил звезду | `⭐️ Sergei купил звезду (−N 💰)` |
| Сергей получил тир | `🏆 Sergei получил/купил тир «X»` |
| Дедлайн истёк | `💀 Задание «X» провалено — дедлайн истёк` |

## ⚠️ Если что-то не работает

**Webhook не принимает `/start`:**
- Проверь: `curl "https://api.telegram.org/bot<TOKEN>/getWebhookInfo"` — `url` должен быть правильный, `pending_update_count` = 0
- Логи функции: Supabase Dashboard → Edge Functions → telegram-webhook → Logs
- Секреты установлены? `supabase secrets list` — должны быть `TELEGRAM_BOT_TOKEN` и `SUPABASE_SERVICE_ROLE_KEY`

**Сообщения не приходят подписчикам:**
- В админке "📱 Telegram" видны подписчики? Если да — проблема в токене в `constants.js`
- Если подписчиков нет — проблема в webhook (см. выше)

**Сменить бота:**
- `@BotFather` → `/revoke` → старый токен отозвать
- Повторить шаги 1, 2, 4.3, 5
- Старые подписчики останутся в БД → удали их через админку

---

## 🚀 Напоминалка про v2

- **Vite** вместо CRA — dev-сервер за 0.5 сек
- **Supabase Realtime** вместо polling — трафик падает на порядок
- **Реакции Сергея** на записи лога (🐷 🔥 🎉 ❤️ 👍🏻 👎🏻), видны во вкладке "📜 Лог" админки

---

## 📋 Установка с нуля

### 1. Применить все миграции БД
Supabase SQL Editor → выполни `SUPABASE_MIGRATION.sql` целиком (идемпотентный).

### 2. Локально
```bash
npm install
npm run dev        # http://localhost:3000
npm run build
```

### 3. Deploy на Vercel
Ничего настраивать не нужно — Vercel сам подхватит Vite. Output directory = `build`.

Если в настройках проекта стоит "Framework: Create React App" — поменяй на "Vite" или "Other".

### 4. Настроить Telegram (см. раздел выше)

---

## 🗂 Структура проекта

```
├── index.html
├── vite.config.js
├── package.json
├── SUPABASE_MIGRATION.sql           ← v1 + v2 + v3 + v4
├── supabase/
│   └── functions/
│       └── telegram-webhook/
│           └── index.ts             ← Edge Function (приём /start)
├── public/
│   ├── favicon.ico, logo*.png, manifest.json
│   ├── sw.js                        ← Service Worker (браузерные push)
│   └── robots.txt
└── src/
    ├── main.jsx
    ├── App.jsx
    ├── constants.js                 ← TELEGRAM_BOT_TOKEN сюда
    ├── hooks.js                     ← Realtime + sendToTelegram
    ├── components/  (Badge, BurstLayer, TaskCard, Toast)
    └── screens/
        ├── LoginScreen.jsx
        ├── ProfileScreen.jsx
        ├── TasksScreen.jsx          ← Telegram при submit/cancel/fail
        ├── LogScreen.jsx            ← UI реакций
        ├── RewardScreen.jsx         ← Telegram при всех покупках
        └── AdminScreen.jsx          ← вкладка "Лог" + секция "Telegram"
```
