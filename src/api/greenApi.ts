import type {
  CheckAccountResult,
  Credentials,
  NotificationBody,
  ParsedMessage,
  PollEvent,
} from '../types';

export const QR_AUTH_MESSAGE =
  'Нужно авторизовать инстанс в кабинете GREEN-API по QR (Telegram → Настройки → Устройства).';

const HTTP_API_SETTINGS = {
  webhookUrl: '',
  incomingWebhook: 'yes',
  outgoingAPIMessageWebhook: 'yes',
  outgoingMessageWebhook: 'yes',
  outgoingWebhook: 'yes',
  stateWebhook: 'yes',
} as const;

const settingsPromises = new Map<string, Promise<string | null>>();

export class GreenApiError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'GreenApiError';
    this.status = status;
  }
}

type SettingsSnapshot = {
  webhookUrl?: unknown;
  incomingWebhook?: unknown;
  outgoingAPIMessageWebhook?: unknown;
  outgoingMessageWebhook?: unknown;
  outgoingWebhook?: unknown;
  stateWebhook?: unknown;
};

export function resolveApiUrl(idInstance: string, apiUrl: string): string {
  const manual = apiUrl.trim();
  if (manual) {
    let parsed: URL;
    try {
      parsed = new URL(manual);
    } catch {
      throw new GreenApiError('Некорректный apiUrl. Пример: https://4100.api.green-api.com', 400);
    }
    if (parsed.protocol !== 'https:') {
      throw new GreenApiError('apiUrl должен начинаться с https://', 400);
    }
    if (!isGreenHost(parsed.hostname)) {
      throw new GreenApiError('apiUrl должен быть хостом *.green-api.com', 400);
    }
    const path = parsed.pathname.replace(/\/+$/, '');
    return `${parsed.origin}${path}`;
  }

  if (!/^\d{4,20}$/.test(idInstance)) {
    throw new GreenApiError('idInstance должен состоять из цифр (минимум 4), чтобы определить хост API', 400);
  }
  return `https://${idInstance.slice(0, 4)}.api.green-api.com`;
}

export function normalizeCredentials(input: {
  idInstance: string;
  apiTokenInstance: string;
  apiUrl: string;
}): Credentials {
  const idInstance = input.idInstance.trim();
  const apiTokenInstance = input.apiTokenInstance.trim();
  if (!/^\d{4,20}$/.test(idInstance)) {
    throw new GreenApiError('idInstance должен состоять из цифр', 400);
  }
  if (apiTokenInstance.length < 10 || /[\s/]/.test(apiTokenInstance)) {
    throw new GreenApiError('Похоже, apiTokenInstance указан неверно', 400);
  }
  return {
    idInstance,
    apiTokenInstance,
    apiUrl: resolveApiUrl(idInstance, input.apiUrl),
  };
}

export function describeInstanceState(state: string): { ok: boolean; message: string } {
  switch (state) {
    case 'authorized':
      return { ok: true, message: '' };
    case 'suspended':
      return {
        ok: true,
        message: 'На аккаунте временные ограничения Telegram. Отправка сообщений может не проходить.',
      };
    case 'notAuthorized':
    case 'pendingCode':
      return { ok: false, message: QR_AUTH_MESSAGE };
    case 'pendingPassword':
      return {
        ok: false,
        message: 'Для завершения авторизации нужен пароль двухфакторной защиты. Завершите вход в кабинете GREEN-API.',
      };
    case 'starting':
      return { ok: false, message: 'Инстанс запускается. Подождите до 5 минут и повторите вход.' };
    case 'blocked':
      return { ok: false, message: 'Инстанс заблокирован. Проверьте статус в кабинете GREEN-API.' };
    default:
      return { ok: false, message: `Не удалось подтвердить авторизацию инстанса (${state}).` };
  }
}

export async function getStateInstance(credentials: Credentials, signal?: AbortSignal): Promise<string> {
  const { parsed } = await request(credentials, 'GET', instancePath(credentials, 'getStateInstance'), undefined, signal);
  const record = asRecord(parsed);
  const state = record && typeof record.stateInstance === 'string' ? record.stateInstance : '';
  if (!state) throw new GreenApiError('GREEN-API не вернул состояние инстанса', 200);
  return state;
}

export async function checkAccount(
  credentials: Credentials,
  input: { phoneNumber?: string; username?: string },
  signal?: AbortSignal,
): Promise<CheckAccountResult> {
  const hasPhone = Boolean(input.phoneNumber);
  const hasUsername = Boolean(input.username);
  if (hasPhone === hasUsername) {
    throw new GreenApiError('Укажите номер телефона или @username — что-то одно', 400);
  }

  const rawBody = hasPhone
    ? `{"phoneNumber":${input.phoneNumber}}`
    : JSON.stringify({ username: input.username });

  const { parsed, raw } = await request(
    credentials,
    'POST',
    instancePath(credentials, 'checkAccount'),
    undefined,
    signal,
    rawBody,
  );
  const record = asRecord(parsed);
  if (!record) throw new GreenApiError('Пустой ответ CheckAccount', 200);
  if (record.status === false) {
    throw new GreenApiError(humanize(200, parsed), 200);
  }

  const exist = record.exist === true;
  const chatId = firstField(raw, 'chatId') || (record.chatId != null ? String(record.chatId) : '');
  const usernameValue = typeof record.username === 'string' ? record.username : undefined;
  const phoneValue =
    typeof record.phoneNumber === 'number' || typeof record.phoneNumber === 'string'
      ? String(record.phoneNumber)
      : input.phoneNumber;

  return {
    exist,
    chatId: exist ? chatId : '',
    username: usernameValue || input.username,
    phoneNumber: phoneValue,
  };
}

export async function sendMessage(
  credentials: Credentials,
  chatId: string,
  message: string,
  signal?: AbortSignal,
): Promise<{ idMessage: string }> {
  if (!chatId || chatId.includes('@') || chatId.startsWith('-')) {
    throw new GreenApiError('Сообщение можно отправить только по chatId личного чата', 400);
  }
  if (!message || message.length > 4096) {
    throw new GreenApiError('Текст сообщения должен быть от 1 до 4096 символов', 400);
  }

  const { parsed, raw } = await request(
    credentials,
    'POST',
    instancePath(credentials, 'sendMessage'),
    { chatId, message },
    signal,
  );
  const record = asRecord(parsed);
  const idMessage =
    firstField(raw, 'idMessage') || (record && record.idMessage != null ? String(record.idMessage) : '');
  if (!idMessage) throw new GreenApiError('GREEN-API не вернул idMessage', 200);
  return { idMessage };
}

export async function receiveNotification(
  credentials: Credentials,
  signal?: AbortSignal,
): Promise<{ receiptId: string; body: NotificationBody } | null> {
  const { parsed, raw, status } = await request(
    credentials,
    'GET',
    `${instancePath(credentials, 'receiveNotification')}?receiveTimeout=20`,
    undefined,
    signal,
    undefined,
    80_000,
  );
  if (parsed == null || status === 204) return null;
  const record = asRecord(parsed);
  if (!record || record.receiptId == null) return null;

  const receiptId = firstField(raw, 'receiptId') || String(record.receiptId);
  const body: NotificationBody = (asRecord(record.body) as NotificationBody | null) ?? {};
  const idMessage = firstField(raw, 'idMessage');
  const chatId = firstField(raw, 'chatId');
  if (idMessage) body.idMessage = idMessage;
  if (chatId && body.senderData) body.senderData.chatId = chatId;
  else if (chatId) body.senderData = { chatId };
  return { receiptId, body };
}

export async function deleteNotification(
  credentials: Credentials,
  receiptId: string,
  signal?: AbortSignal,
): Promise<void> {
  if (!/^\d+$/.test(receiptId)) {
    throw new GreenApiError('Некорректный receiptId', 400);
  }
  await request(
    credentials,
    'DELETE',
    `${instancePath(credentials, 'deleteNotification')}/${receiptId}`,
    undefined,
    signal,
  );
}

export async function getSettings(credentials: Credentials, signal?: AbortSignal): Promise<SettingsSnapshot> {
  const { parsed } = await request(credentials, 'GET', instancePath(credentials, 'getSettings'), undefined, signal);
  const record = asRecord(parsed);
  if (!record) throw new GreenApiError('Пустой ответ GetSettings', 200);
  return record;
}

export async function setSettings(
  credentials: Credentials,
  signal?: AbortSignal,
): Promise<void> {
  const { parsed } = await request(
    credentials,
    'POST',
    instancePath(credentials, 'setSettings'),
    HTTP_API_SETTINGS,
    signal,
  );
  const record = asRecord(parsed);
  if (!record || record.saveSettings !== true) {
    throw new GreenApiError('Не удалось сохранить настройки инстанса', 200);
  }
}

/**
 * Enables the HTTP API queue once, if incoming notifications are not already
 * configured. SetSettings restarts the instance, so a healthy profile is left
 * untouched. outgoingMessageWebhook is included so messages typed on another
 * Telegram device show up next to API-sent ones.
 */
export function ensureHttpApiSettings(credentials: Credentials): Promise<string | null> {
  const guardKey = `tg-green-settings-touch:${credentials.idInstance}`;
  try {
    if (sessionStorage.getItem(guardKey) === 'done') return Promise.resolve(null);
  } catch {
    // sessionStorage can throw in private modes; still try once per page load.
  }
  const existing = settingsPromises.get(credentials.idInstance);
  if (existing) return existing;

  const promise = applyHttpApiSettings(credentials, guardKey).finally(() => {
    settingsPromises.delete(credentials.idInstance);
  });
  settingsPromises.set(credentials.idInstance, promise);
  return promise;
}

async function applyHttpApiSettings(credentials: Credentials, guardKey: string): Promise<string | null> {
  try {
    const settings = await getSettings(credentials);
    if (!looksLikeSettings(settings) || !needsSettingsUpdate(settings)) {
      rememberSettings(guardKey);
      return null;
    }
    await setSettings(credentials);
    rememberSettings(guardKey);
    return 'Приём переключён на HTTP API: webhookUrl очищен, уведомления о входящих и исходящих сообщениях включены. SetSettings перезапускает инстанс — если ответы не появляются сразу, подождите несколько минут.';
  } catch {
    return null;
  }
}

export function interpretNotification(body: NotificationBody): PollEvent | null {
  if (body.typeWebhook === 'stateInstanceChanged' && typeof body.stateInstance === 'string') {
    return { type: 'state', state: body.stateInstance };
  }

  const kind = body.instanceData?.typeInstance;
  if (kind && kind !== 'telegram') return null;

  const incoming = body.typeWebhook === 'incomingMessageReceived';
  const outgoing =
    body.typeWebhook === 'outgoingAPIMessageReceived' || body.typeWebhook === 'outgoingMessageReceived';
  if (!incoming && !outgoing) return null;

  const chatType = body.senderData?.chatType;
  const chatId = body.senderData?.chatId ? String(body.senderData.chatId) : '';
  if (!chatId || chatId.startsWith('-') || chatType === 'group') return null;

  const text = extractText(body);
  if (!text) return null;

  const idMessage = body.idMessage ? String(body.idMessage) : '';
  if (!idMessage) return null;

  const phoneRaw = body.senderData?.senderPhoneNumber;
  const phoneNumber =
    typeof phoneRaw === 'number' || typeof phoneRaw === 'string' ? String(phoneRaw).replace(/^\+/, '') : undefined;

  const message: ParsedMessage = {
    idMessage,
    chatId,
    text,
    timestamp: normalizeUnix(body.timestamp),
    direction: incoming ? 'in' : 'out',
    name: body.senderData?.chatName || body.senderData?.senderContactName || body.senderData?.senderName || '',
    phoneNumber,
  };
  return { type: 'message', message };
}

function extractText(body: NotificationBody): string | null {
  const data = body.messageData;
  if (!data) return null;
  if (data.typeMessage === 'textMessage') {
    const text = data.textMessageData?.textMessage;
    return typeof text === 'string' && text.length > 0 ? text : null;
  }
  if (data.typeMessage === 'extendedTextMessage') {
    const text = data.extendedTextMessageData?.text ?? data.extendedTextMessageData?.textMessage;
    return typeof text === 'string' && text.length > 0 ? text : null;
  }
  return null;
}

function normalizeUnix(value: number | undefined): number {
  if (value == null || !Number.isFinite(value)) return Math.floor(Date.now() / 1000);
  if (value > 10_000_000_000) return Math.floor(value / 1000);
  return Math.floor(value);
}

function instancePath(credentials: Credentials, method: string): string {
  return `/waInstance${encodeURIComponent(credentials.idInstance)}/${method}/${encodeURIComponent(credentials.apiTokenInstance)}`;
}

function toProxyPath(apiUrl: string, methodPath: string): string {
  const base = new URL(apiUrl);
  const prefix = base.pathname.replace(/\/+$/, '');
  const suffix = methodPath.startsWith('/') ? methodPath : `/${methodPath}`;
  return `/green-api/${base.host}${prefix}${suffix}`;
}

type RequestResult = {
  status: number;
  parsed: unknown;
  raw: string;
};

async function request(
  credentials: Credentials,
  method: 'GET' | 'POST' | 'DELETE',
  methodPath: string,
  body?: unknown,
  signal?: AbortSignal,
  rawBody?: string,
  timeoutMs = 30_000,
): Promise<RequestResult> {
  const url = toProxyPath(credentials.apiUrl, methodPath);
  const headers: Record<string, string> = { Accept: 'application/json' };
  let payload: string | undefined;
  if (rawBody !== undefined) {
    payload = rawBody;
    headers['Content-Type'] = 'application/json';
  } else if (body !== undefined) {
    payload = JSON.stringify(body);
    headers['Content-Type'] = 'application/json';
  }

  const timeout = timeoutSignal(timeoutMs);
  const linked = linkSignals(signal, timeout);

  let response: Response;
  try {
    response = await fetch(url, {
      method,
      headers,
      body: payload,
      signal: linked,
      cache: 'no-store',
    });
  } catch (err) {
    if (isAbortError(err)) {
      if (signal?.aborted) throw err;
      throw new GreenApiError('Превышено время ожидания ответа GREEN-API', 504);
    }
    throw new GreenApiError(
      'Нет соединения с API. Запустите dev-сервер или деплой с прокси: браузер не может вызвать GREEN-API напрямую из-за CORS.',
      0,
    );
  }

  const raw = await response.text();
  const parsed = parseJson(raw);
  if (!response.ok) {
    throw new GreenApiError(humanize(response.status, parsed), response.status);
  }
  return { status: response.status, parsed, raw };
}

function parseJson(raw: string): unknown {
  const trimmed = raw.trim();
  if (!trimmed || trimmed === 'null') return null;
  try {
    return JSON.parse(trimmed) as unknown;
  } catch {
    return trimmed.slice(0, 500);
  }
}

function humanize(status: number, parsed: unknown): string {
  const reason = redactSecrets(readReason(parsed));
  if (status === 401 || status === 403) return 'Неверный idInstance или apiTokenInstance.';
  if (status === 429 || /rate_limit|rate limited|too many/i.test(reason)) {
    return 'Слишком много запросов к Telegram. Подождите и повторите попытку.';
  }
  if (/webhook url/i.test(reason)) {
    return 'На инстансе указан webhookUrl. Для приёма по HTTP API очистите его в кабинете GREEN-API и подождите около минуты.';
  }
  if (/not authorized|notAuthorized/i.test(reason)) return QR_AUTH_MESSAGE;
  if (/starting/i.test(reason)) return 'Инстанс запускается. Подождите и повторите попытку.';
  if (asRecord(parsed)?.error === 'proxy_error') {
    return 'Прокси API недоступен. Откройте приложение через dev-сервер, а не как файл с диска.';
  }
  if (asRecord(parsed)?.error === 'bad_proxy_target') return 'Некорректный адрес API.';
  if (reason && !reason.startsWith('<')) return reason.slice(0, 400);
  if (status >= 500) return 'Сервер GREEN-API временно недоступен. Повторите попытку через минуту.';
  if (status === 0) return 'Нет соединения с API.';
  return 'Не удалось выполнить запрос к GREEN-API.';
}

function readReason(parsed: unknown): string {
  if (typeof parsed === 'string') return parsed;
  const record = asRecord(parsed);
  if (!record) return '';
  if (typeof record.reason === 'string' && record.reason) return record.reason;
  if (typeof record.message === 'string' && record.message) return record.message;
  if (typeof record.error === 'string' && record.error !== 'proxy_error') return record.error;
  const data = asRecord(record.data);
  if (data && typeof data.reason === 'string') return data.reason;
  return '';
}

export function redactSecrets(value: string): string {
  return value.replace(/(\/waInstance\d+\/[^/\s?]+\/)[^/\s?]+/gi, '$1***');
}

function firstField(raw: string, field: string): string {
  const match = new RegExp(`"${field}"\\s*:\\s*(?:"([^"]*)"|(-?\\d+))`).exec(raw);
  if (!match) return '';
  return match[1] ?? match[2] ?? '';
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' ? (value as Record<string, unknown>) : null;
}

function isGreenHost(hostname: string): boolean {
  return /^(?:[a-z0-9-]+\.)*green-api\.com$/i.test(hostname);
}

function looksLikeSettings(settings: SettingsSnapshot): boolean {
  return 'webhookUrl' in settings || 'incomingWebhook' in settings || 'outgoingAPIMessageWebhook' in settings;
}

function needsSettingsUpdate(settings: SettingsSnapshot): boolean {
  const webhook = typeof settings.webhookUrl === 'string' ? settings.webhookUrl.trim() : '';
  if (webhook) return true;
  return !(
    isYes(settings.incomingWebhook) &&
    isYes(settings.outgoingAPIMessageWebhook) &&
    isYes(settings.outgoingMessageWebhook) &&
    isYes(settings.outgoingWebhook) &&
    isYes(settings.stateWebhook)
  );
}

function isYes(value: unknown): boolean {
  return value === 'yes' || value === true;
}

function rememberSettings(guardKey: string): void {
  try {
    sessionStorage.setItem(guardKey, 'done');
  } catch {
    // Ignore storage failures.
  }
}

function isAbortError(err: unknown): boolean {
  return err instanceof Error && (err.name === 'AbortError' || err.name === 'TimeoutError');
}

function timeoutSignal(ms: number): AbortSignal {
  if (typeof AbortSignal !== 'undefined' && typeof AbortSignal.timeout === 'function') {
    return AbortSignal.timeout(ms);
  }
  const controller = new AbortController();
  setTimeout(() => controller.abort(), ms);
  return controller.signal;
}

function linkSignals(outer: AbortSignal | undefined, timeout: AbortSignal): AbortSignal {
  if (!outer) return timeout;
  const controller = new AbortController();
  const abort = () => controller.abort();
  if (outer.aborted || timeout.aborted) {
    controller.abort();
    return controller.signal;
  }
  outer.addEventListener('abort', abort, { once: true });
  timeout.addEventListener('abort', abort, { once: true });
  return controller.signal;
}
