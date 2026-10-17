# Nemor Cards (Quizlet analog)

🇷🇺 [Русский](#русский) · 🇬🇧 [English](#english)

---

## Русский

Аналог Quizlet: клиент на Expo (web + native) и Cloudflare Worker (API + статика, D1). Подробности — в `README.md` проекта ниже / `CONTRACT.md`.

### Использование

Склонируйте репозиторий и откройте нужную папку. Секреты (токены, API-ключи, `.env`) в репозиторий не включены: создайте свой `.env` по образцу `.env.example` (если есть) или задайте переменные окружения. Заглушки вида `YOUR_*` замените своими значениями.

## English

A Quizlet-like flashcards app: Expo client (web + native) and a Cloudflare Worker (API + static assets, D1). See `CONTRACT.md` for the API contract.

### Usage

Clone the repository and open the relevant folder. Secrets (tokens, API keys, `.env`) are not included: create your own `.env` from `.env.example` (if present) or set environment variables. Replace `YOUR_*` placeholders with your own values.

---

## Подробная документация / Detailed docs (RU)


Аналог Quizlet: клиент на **Expo** (web + native) и один **Cloudflare Worker**,
который одновременно отдаёт собранный web-экспорт (Static Assets + SPA-fallback)
и BFF на пути `/api`. Источник правды — **Cloudflare D1**; клиент кэширует данные
локально (Dexie в web, expo-sqlite на устройстве) и синхронизируется. Origin
один (Worker отдаёт и приложение, и API), поэтому **CORS не нужен**.

Интервальное повторение (FSRS) считается **на клиенте** через `ts-fsrs`; Worker
только хранит поля расписания и логи повторений.

---

## 1. Требования

- **Node.js 18+** (рекомендуется LTS 20/22) и npm.
- **Cloudflare-аккаунт** с доступом к Workers, D1 и Workers AI.
- **Wrangler** (ставится как dev-зависимость воркера). Перед работой авторизуйтесь:

  ```bash
  npx wrangler login
  ```

---

## 2. Разовая настройка

### 2.1. Установка зависимостей

Из корня репозитория:

```bash
npm run install:all      # ставит зависимости в app/ и в worker/
```

### 2.2. Создание базы D1

```bash
cd worker
npx wrangler d1 create nemor-cards
```

Команда вернёт `database_id`. Скопируйте его и вставьте в
`worker/wrangler.toml`, заменив `REPLACE_WITH_YOUR_D1_ID`:

```toml
[[d1_databases]]
binding = "DB"
database_name = "nemor-cards"
database_id = "ВАШ_D1_ID"
```

### 2.3. Ключ авторизации (alrevion auth-api)

Логин идёт по номеру телефона через Telegram и проксируется в alrevion auth-api.
Нужно:

1. В alrevion auth-api создать `client` и для него строку в `api_keys` —
   это значение `AUTH_API_KEY`.
2. Базовый URL auth-api уже прописан в `wrangler.toml` →
   `AUTH_API_BASE_URL` (по умолчанию `https://api-auth.alrevion.workers.dev`).

### 2.4. Секреты

В проекте два секрета (никогда не коммитятся):

| Секрет | Назначение |
|--------|-----------|
| `AUTH_API_KEY` | ключ сервиса alrevion auth-api (заголовок `X-API-Key`) |
| `OPENROUTER_PROXY_KEY` | bearer-токен для OpenRouter-совместимого прокси |

**Для продакшена** — через Wrangler:

```bash
cd worker
npx wrangler secret put AUTH_API_KEY
npx wrangler secret put OPENROUTER_PROXY_KEY
```

**Для локальной разработки** — файл `worker/.dev.vars` (есть пример
`worker/.dev.vars.example`, скопируйте его):

```ini
AUTH_API_KEY="..."
OPENROUTER_PROXY_KEY="..."
```

### 2.5. Инициализация схемы БД

Применить `worker/schema.sql`:

```bash
npm run db:init          # локальная D1 (для wrangler dev)
npm run db:init:remote   # удалённая D1 (продакшен)
```

---

## 3. Локальная разработка

Нужны два процесса.

**Терминал 1 — Worker (API + локальная D1):**

```bash
cd worker
npm run dev              # wrangler dev, обычно http://127.0.0.1:8787
```

**Терминал 2 — Expo web:**

```bash
cd app
EXPO_PUBLIC_API_BASE=http://127.0.0.1:8787 npm run web
```

`EXPO_PUBLIC_API_BASE` должен указывать на запущенный `wrangler dev`-воркер,
чтобы запросы клиента к `/api/...` попадали в локальный BFF.

> В продакшене этот адрес не нужен: Worker отдаёт и приложение, и API с одного
> origin, поэтому запросы идут на относительный `/api`.

---

## 4. Сборка и деплой

Один скрипт собирает web-экспорт и деплоит воркер, который его раздаёт:

```bash
npm run deploy
```

Под капотом:

1. `npm run build:web` → `expo export -p web`, затем `scripts/inject-pwa.mjs`
   дописывает в `app/dist/index.html` манифест, iOS-мета, `theme-color` и
   регистрацию service worker (в режиме `output: "single"` Expo не применяет
   `+html.tsx`, поэтому PWA-теги добавляются пост-обработкой).
2. `cd worker && wrangler deploy` → деплой Worker; секция `[assets]` в
   `wrangler.toml` указывает на `../app/dist` с
   `not_found_handling = "single-page-application"` (SPA-fallback на `index.html`).

Перед первым удалённым деплоем убедитесь, что выполнены шаги 2.2–2.5
(`database_id`, секреты, `db:init:remote`).

---

## 5. Установка на iPhone («На экран Домой»)

Приложение — PWA, ставится без App Store:

1. Откройте задеплоенный адрес в **Safari** на iPhone.
2. Нажмите кнопку «Поделиться» (квадрат со стрелкой вверх).
3. Выберите **«На экран Домой»** (Add to Home Screen) → **Добавить**.
4. Значок «Карточки» появится на домашнем экране; запуск — в полноэкранном
   standalone-режиме (без адресной строки), с тёмным фоном `#0b1020`.

После установки приложение работает офлайн (service worker кэширует оболочку
SPA): навигация — network-first с откатом на закэшированную страницу, статика —
stale-while-revalidate, запросы `/api/*` всегда идут в сеть и не кэшируются.

> **Про офлайн-данные на iOS.** iOS может очищать локальное хранилище PWA при
> длительном неиспользовании. Для нас это не критично: **источник правды — D1**.
> Локальный кэш (Dexie/SQLite) — лишь зеркало; после входа клиент заново
> синхронизируется с сервером, и данные восстанавливаются.

---

## 6. LLM-прокси (генерация карточек и квизов)

Worker обращается к OpenRouter-совместимому прокси:

- URL запроса: `OPENROUTER_PROXY_URL + "/v1/chat/completions"`
  (заголовок `Authorization: Bearer OPENROUTER_PROXY_KEY`, тело в формате
  OpenAI Chat Completions).

  > Путь `/v1/chat/completions` — предположение под стандартный OpenRouter-прокси;
  > при необходимости подгоните его под фактически развёрнутый прокси.

- Модели берутся из `LLM_MODELS` (через запятую) и пробуются **по порядку**,
  пока какая-то не вернёт пригодный ответ. По умолчанию — 4 бесплатные модели:

  1. `nvidia/nemotron-3-ultra-550b-a55b:free`
  2. `nvidia/nemotron-3-super-120b-a12b:free`
  3. `openai/gpt-oss-120b:free`
  4. `google/gemma-4-31b-it:free`

Распознавание PDF → Markdown идёт через Workers AI (`env.AI.toMarkdown`,
binding `AI`), отдельный ключ не нужен.

---

## 7. Структура

```
.
├── app/        Expo-клиент (web + native), web-экспорт → app/dist
│   ├── app/        экраны expo-router (login, колоды, учёба, импорт, тест…)
│   ├── assets/     иконки/сплэш приложения (icon, adaptive-icon, splash, favicon)
│   ├── public/     статика web: manifest.json, sw.js, иконки PWA
│   └── scripts/    gen-icons.mjs (PNG-иконки), inject-pwa.mjs (PWA-теги в index.html)
├── worker/     Cloudflare Worker: /api (BFF) + раздача app/dist
│   ├── schema.sql       схема D1
│   └── wrangler.toml    конфиг (vars, секреты, D1, AI, assets)
├── CONTRACT.md API- и data-контракт (источник истины по типам/эндпоинтам)
└── package.json корневые скрипты (install:all, build:web, deploy, db:init…)
```

### Регенерация иконок

```bash
node app/scripts/gen-icons.mjs
```

Скрипт использует только встроенные модули Node и кодирует валидные PNG
(сплошной цвет, бренд `#4f46e5`, сплэш `#0b1020`).
