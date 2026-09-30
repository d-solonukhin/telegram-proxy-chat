import type { Chat, Credentials, Message } from './types';

const CREDENTIALS_KEY = 'tg-green-credentials';

export type ChatStore = {
  chats: Chat[];
  messages: Record<string, Message[]>;
};

export const EMPTY_STORE: ChatStore = { chats: [], messages: {} };

export function loadCredentials(): Credentials | null {
  try {
    const raw = localStorage.getItem(CREDENTIALS_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return null;
    const record = parsed as Partial<Credentials>;
    if (!record.idInstance || !record.apiTokenInstance || !record.apiUrl) return null;
    return {
      idInstance: String(record.idInstance),
      apiTokenInstance: String(record.apiTokenInstance),
      apiUrl: String(record.apiUrl),
    };
  } catch {
    return null;
  }
}

export function saveCredentials(credentials: Credentials): void {
  localStorage.setItem(CREDENTIALS_KEY, JSON.stringify(credentials));
}

export function clearCredentials(): void {
  localStorage.removeItem(CREDENTIALS_KEY);
}

function storeKey(instanceId: string): string {
  return `tg-green-chats:${instanceId}`;
}

function isMessage(value: unknown): value is Message {
  if (!value || typeof value !== 'object') return false;
  const message = value as Partial<Message>;
  return (
    typeof message.idMessage === 'string' &&
    typeof message.chatId === 'string' &&
    typeof message.text === 'string' &&
    typeof message.timestamp === 'number' &&
    (message.direction === 'in' || message.direction === 'out') &&
    (message.status === 'pending' || message.status === 'sent' || message.status === 'failed')
  );
}

function isChat(value: unknown): value is Chat {
  if (!value || typeof value !== 'object') return false;
  const chat = value as Partial<Chat>;
  return typeof chat.chatId === 'string' && typeof chat.name === 'string' && typeof chat.createdAt === 'number';
}

export function loadStore(instanceId: string): ChatStore {
  try {
    const raw = localStorage.getItem(storeKey(instanceId));
    if (!raw) return EMPTY_STORE;
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return EMPTY_STORE;
    const record = parsed as { chats?: unknown; messages?: unknown };
    const chats = Array.isArray(record.chats)
      ? record.chats.filter(isChat).filter((chat) => !chat.chatId.startsWith('-'))
      : [];
    const messages: Record<string, Message[]> = {};
    if (record.messages && typeof record.messages === 'object') {
      for (const [chatId, list] of Object.entries(record.messages)) {
        if (chatId.startsWith('-') || !Array.isArray(list)) continue;
        messages[chatId] = list.filter(isMessage).slice(-400).map((message) =>
          message.status === 'pending'
            ? { ...message, status: 'failed' as const, error: 'Отправка прервана. Нажмите «Повторить».' }
            : message,
        );
      }
    }
    return { chats, messages };
  } catch {
    return EMPTY_STORE;
  }
}

export function saveStore(instanceId: string, store: ChatStore): void {
  const payload = JSON.stringify(store);
  try {
    localStorage.setItem(storeKey(instanceId), payload);
  } catch {
    const trimmed: ChatStore = {
      chats: store.chats.slice(-80),
      messages: Object.fromEntries(
        Object.entries(store.messages).map(([chatId, list]) => [chatId, list.slice(-80)]),
      ),
    };
    try {
      localStorage.setItem(storeKey(instanceId), JSON.stringify(trimmed));
    } catch {
      // Quota exceeded — keep the in-memory transcript for this session.
    }
  }
}
