# Telegram через GREEN-API

Одностраничный веб-клиент для личной переписки текстом. Сообщения уходят и приходят через [GREEN-API](https://green-api.com) (инстанс Telegram). Файлов, групп, каналов, стикеров и звонков нет. Своей базы и аккаунтов, кроме данных инстанса, тоже нет: чаты лежат в `localStorage` браузера.

## Локальный запуск

v. Node 18+.

```bash
npm install
npm run dev
```

Откройте http://localhost:5173.

## Где взять idInstance и apiTokenInstance

1. Зарегистрируйтесь в [личном кабинете GREEN-API](https://console.green-api.com/registration).
2. Создайте инстанс и выберите мессенджер **Telegram**. Один инстанс — один аккаунт Telegram.
3. Откройте карточку инстанса на [странице инстансов](https://console.green-api.com/instanceList). Там опубликованы:
   - `idInstance` — номер инстанса;
   - `apiTokenInstance` — ключ доступа;
   - `apiUrl` — хост API, например `https://4100.api.green-api.com`.
4. Вставьте `idInstance` и `apiTokenInstance` на первый экран. `apiUrl` можно оставить пустым: приложение само возьмёт `https://{первые 4 цифры idInstance}.api.green-api.com`. Если кабинет показывает другой хост, вставьте его в поле apiUrl.

Токен хранится только в `localStorage` этого браузера. В консоль он не пишется. Кнопка **Выйти** удаляет учётные данные инстанса (история чатов этого `idInstance` на устройстве остаётся и вернётся при следующем входе).

## Как авторизовать инстанс

Пока инстанс не авторизован, `getStateInstance` не равен `authorized`, и приложение не откроет переписку. Оно покажет: нужно авторизовать инстанс в кабинете GREEN-API по QR (Telegram → Настройки → Устройства).

Рекомендуемый способ — QR:

1. На телефоне откройте Telegram → **Настройки** → **Устройства** → **Подключить устройство** (Settings → Devices → Link Desktop Device).
2. В [кабинете GREEN-API](https://console.green-api.com) откройте инстанс и нажмите **Получить QR**.
3. Отсканируйте код.
4. Вернитесь в веб-клиент и нажмите **Войти** ещё раз. Статус должен стать `authorized`.

Пока инстанс в состоянии `starting`, подождите до 5 минут: он перезапускается.

## Как устроен прокси в разработке

Браузерный `fetch` на чужой origin зависит от CORS. У GREEN-API это не контракт: часть ответов приходит с `Access-Control-Allow-Origin: *`, а часть (страницы ошибок nginx, отдельные сбои) — без нужных заголовков, и предполёт `OPTIONS` для `POST` с `Content-Type: application/json` может отличаться от хоста к хосту. Поэтому страница не вызывает `https://4100.api.green-api.com` напрямую и всегда ходит на свой origin:

```text
/green-api/{host}/waInstance{idInstance}/{method}/{apiTokenInstance}
```

Пример:

```text
/green-api/4100.api.green-api.com/waInstance4100000000/sendMessage/{token}
```

Плагин в `vite.config.ts` (`greenApiDevPlugin`, и для `vite dev`, и для `vite preview`) переписывает это в

```text
https://4100.api.green-api.com/waInstance4100000000/sendMessage/{token}
```

Хост берётся из пути, а не из одного захардкоженного `server.proxy.target`: у разных инстансов разные хосты (`{первые 4 цифры idInstance}.api.green-api.com`). Прокси пускает только `*.green-api.com`, чтобы не стать открытым реле на произвольные сайты. Тело запроса и ответ не логируются: в URL есть `apiTokenInstance`.

Тот же путь `/green-api/...` в проде обслуживают серверные функции (см. ниже).

## Приём сообщений

Входящие читаются длинным опросом HTTP API, не вебхуком:

1. `GET .../receiveNotification/{token}?receiveTimeout=20`
2. Если в ответе есть `receiptId` и `body`, текст (`textMessage` или `extendedTextMessage`) добавляется в чат. Уведомления `outgoingAPIMessageReceived` и `outgoingMessageReceived` тоже показываются: это сообщения, отправленные через API или с другого устройства.
3. Сразу после обработки вызывается `DELETE .../deleteNotification/{token}/{receiptId}`. Удаляются и статусы, которые UI не рисует: очередь FIFO, и неподтверждённое уведомление блокирует следующие.
4. Пустой ответ (таймаут) — немедленный следующий опрос. Цикл один, с `AbortController`, останавливается при выходе и размонтировании.

Для этого у инстанса **`webhookUrl` должен быть пустым**. Иначе `receiveNotification` отвечает 400 и просит очистить URL. После входа приложение один раз вызывает `getSettings`. Если вебхук задан или выключены входящие/исходящие уведомления, оно вызывает `setSettings`:

```json
{
  "webhookUrl": "",
  "incomingWebhook": "yes",
  "outgoingAPIMessageWebhook": "yes",
  "outgoingMessageWebhook": "yes",
  "outgoingWebhook": "yes",
  "stateWebhook": "yes"
}
```

`outgoingMessageWebhook` включён дополнительно, чтобы в ленте появлялись сообщения, набранные в официальном Telegram, а не только через API. **`setSettings` перезапускает инстанс**, настройки доезжают до нескольких минут. Уже правильно настроенный инстанс метод не трогает. То же самое можно сделать руками в кабинете: изменить инстанс, очистить URL вебхука, включить входящие и исходящие уведомления, сохранить.

Группы (отрицательный `chatId`) игнорируются. Отправка всегда идёт по `chatId` вида `"10000000"`, который вернул `checkAccount`. Номер `79876543210@c.us` в `sendMessage` не используется.
