# Telegram contact form setup

## Что уже есть
- `index.html`, `ru/index.html`, `he/index.html` — статические страницы с формой обращения
- `worker.js` — Cloudflare Worker, который принимает форму и пересылает сообщение в Telegram
- `wrangler.toml.example` — пример конфигурации Wrangler

## Что нужно сделать

### 1. Создать Telegram-бота
Напиши `@BotFather` в Telegram, создай нового бота и сохрани токен.

### 2. Узнать chat_id
Напиши что-нибудь своему боту и вызови:

```bash
curl https://api.telegram.org/botYOUR_BOT_TOKEN/getUpdates
```

В ответе найди `message.chat.id`.

### 3. Создать KV namespace в Cloudflare
Нужен для простого rate limit на 60 секунд.

### 4. Настроить Worker secrets
Добавь секреты:
- `TG_BOT_TOKEN`
- `TG_CHAT_ID`

И переменную:
- `ALLOWED_ORIGIN = https://maxfullstack.com`

### 5. Задеплоить Worker
Используй `worker.js` как основной файл.

### 6. Подставить URL воркера в сайт
В `script.js` замени:

```js
const CONTACT_ENDPOINT = 'https://example.your-subdomain.workers.dev';
```

на реальный URL твоего Worker.

## Что делает защита
- Telegram токен хранится только в Worker secrets
- запросы разрешены только с твоего origin
- есть проверка referer
- есть honeypot поле от простого спама
- есть rate limit по IP через KV на 60 секунд
- валидируется длина полей
