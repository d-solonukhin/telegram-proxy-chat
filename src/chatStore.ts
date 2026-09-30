import type { Chat, Message, ParsedMessage } from './types';
import type { ChatStore } from './storage';

const MAX_MESSAGES = 400;

function trimMessages(list: Message[]): Message[] {
  return list.length > MAX_MESSAGES ? list.slice(list.length - MAX_MESSAGES) : list;
}

function pickName(previous: Chat, incoming: string): string {
  if (!incoming) return previous.name;
  if (!isPlaceholderName(previous)) return previous.name;
  return incoming;
}

function isPlaceholderName(chat: Chat): boolean {
  const name = chat.name.trim();
  if (!name || name === chat.chatId) return true;
  if (chat.phoneNumber && (name === chat.phoneNumber || name === `+${chat.phoneNumber}`)) return true;
  if (chat.username && (name === chat.username || name === chat.username.replace(/^@/, ''))) return true;
  return false;
}

function mergeChat(chat: Chat, message: ParsedMessage): Chat {
  const phoneNumber = chat.phoneNumber || message.phoneNumber;
  const name =
    message.name && message.name !== message.chatId && isPlaceholderName(chat) ? message.name : chat.name;
  if (phoneNumber === chat.phoneNumber && name === chat.name) return chat;
  return { ...chat, phoneNumber, name };
}

export function upsertChat(store: ChatStore, chat: Chat): ChatStore {
  const index = store.chats.findIndex((item) => item.chatId === chat.chatId);
  if (index === -1) {
    return { ...store, chats: [chat, ...store.chats] };
  }
  const previous = store.chats[index];
  if (!previous) return store;
  const chats = store.chats.slice();
  chats[index] = {
    ...previous,
    name: pickName(previous, chat.name),
    phoneNumber: chat.phoneNumber || previous.phoneNumber,
    username: chat.username || previous.username,
    createdAt: previous.createdAt,
  };
  return { ...store, chats };
}

export function ingestMessage(store: ChatStore, message: ParsedMessage): ChatStore {
  if (!message.chatId || message.chatId.startsWith('-') || !message.idMessage || !message.text) return store;

  let chats = store.chats;
  const existing = chats.find((chat) => chat.chatId === message.chatId);
  if (!existing) {
    chats = [
      {
        chatId: message.chatId,
        name: message.name || message.chatId,
        phoneNumber: message.phoneNumber,
        createdAt: message.timestamp,
      },
      ...chats,
    ];
  } else {
    const merged = mergeChat(existing, message);
    if (merged !== existing) {
      chats = chats.map((chat) => (chat.chatId === message.chatId ? merged : chat));
    }
  }

  const list = store.messages[message.chatId] ?? [];
  if (list.some((item) => item.idMessage === message.idMessage)) {
    return chats === store.chats ? store : { ...store, chats };
  }

  if (message.direction === 'out') {
    const pendingIndex = list.findIndex(
      (item) =>
        item.status === 'pending' &&
        item.direction === 'out' &&
        item.text === message.text &&
        item.idMessage.startsWith('local-'),
    );
    if (pendingIndex >= 0) {
      const copy = list.slice();
      const pending = copy[pendingIndex];
      if (pending) {
        copy[pendingIndex] = {
          ...pending,
          idMessage: message.idMessage,
          status: 'sent',
          timestamp: message.timestamp,
          error: undefined,
        };
      }
      return {
        chats,
        messages: { ...store.messages, [message.chatId]: copy },
      };
    }
  }

  const next: Message = {
    idMessage: message.idMessage,
    chatId: message.chatId,
    text: message.text,
    timestamp: message.timestamp,
    direction: message.direction,
    status: 'sent',
  };
  return {
    chats,
    messages: {
      ...store.messages,
      [message.chatId]: trimMessages([...list, next]),
    },
  };
}

export function addOptimistic(
  store: ChatStore,
  chatId: string,
  tempId: string,
  text: string,
  timestamp: number,
): ChatStore {
  const message: Message = {
    idMessage: tempId,
    chatId,
    text,
    timestamp,
    direction: 'out',
    status: 'pending',
  };
  const list = store.messages[chatId] ?? [];
  return {
    ...store,
    messages: { ...store.messages, [chatId]: trimMessages([...list, message]) },
  };
}

export function confirmOptimistic(store: ChatStore, chatId: string, tempId: string, realId: string): ChatStore {
  const list = store.messages[chatId] ?? [];
  const hasReal = list.some((item) => item.idMessage === realId);
  const next = hasReal
    ? list.filter((item) => item.idMessage !== tempId)
    : list.map((item) =>
        item.idMessage === tempId ? { ...item, idMessage: realId, status: 'sent' as const, error: undefined } : item,
      );
  return { ...store, messages: { ...store.messages, [chatId]: next } };
}

export function failOptimistic(store: ChatStore, chatId: string, tempId: string, error: string): ChatStore {
  const list = (store.messages[chatId] ?? []).map((item) =>
    item.idMessage === tempId ? { ...item, status: 'failed' as const, error } : item,
  );
  return { ...store, messages: { ...store.messages, [chatId]: list } };
}

export function markPending(store: ChatStore, chatId: string, idMessage: string): ChatStore {
  const list = store.messages[chatId];
  if (!list) return store;
  return {
    ...store,
    messages: {
      ...store.messages,
      [chatId]: list.map((item) =>
        item.idMessage === idMessage ? { ...item, status: 'pending' as const, error: undefined } : item,
      ),
    },
  };
}
