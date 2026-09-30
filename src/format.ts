import type { Chat, Message } from './types';

export function normalizePhone(value: string): string {
  return value.replace(/\D/g, '').slice(0, 15);
}

export function normalizeUsername(value: string): string {
  const trimmed = value.trim().replace(/\s+/g, '');
  if (!trimmed) return '';
  const bare = trimmed.replace(/^@+/, '').replace(/[^A-Za-z0-9_]/g, '');
  return bare ? `@${bare}` : '@';
}

export function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

export function formatClock(unixSeconds: number): string {
  return new Date(unixSeconds * 1000).toLocaleTimeString('ru-RU', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function formatDayLabel(unixSeconds: number): string {
  const date = new Date(unixSeconds * 1000);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  if (isSameDay(date, today)) return 'сегодня';
  if (isSameDay(date, yesterday)) return 'вчера';
  return date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' });
}

export function formatListTime(unixSeconds: number): string {
  const date = new Date(unixSeconds * 1000);
  if (isSameDay(date, new Date())) return formatClock(unixSeconds);
  return date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
}

export function chatTitle(chat: Chat): string {
  if (chat.name && chat.name !== chat.chatId) return chat.name;
  if (chat.username) return chat.username.startsWith('@') ? chat.username : `@${chat.username}`;
  if (chat.phoneNumber) return `+${chat.phoneNumber.replace(/^\+/, '')}`;
  return chat.chatId;
}

export function chatSubtitle(chat: Chat): string {
  const title = chatTitle(chat);
  const parts: string[] = [];
  if (chat.username) {
    const username = chat.username.startsWith('@') ? chat.username : `@${chat.username}`;
    if (username !== title) parts.push(username);
  }
  if (chat.phoneNumber) {
    const phone = `+${chat.phoneNumber.replace(/^\+/, '')}`;
    if (phone !== title) parts.push(phone);
  }
  if (parts.length === 0) parts.push(`id ${chat.chatId}`);
  return parts.join(' · ');
}

export function initials(chat: Chat): string {
  const source = (chat.name || chat.username || chat.phoneNumber || chat.chatId).replace(/^@/, '').trim();
  const words = source.split(/[\s_+.-]+/).filter(Boolean);
  if (words.length >= 2 && /\p{L}/u.test(words[0]?.[0] ?? '')) {
    return `${words[0][0]}${words[1][0]}`.toUpperCase();
  }
  const letters = source.replace(/[^\p{L}]/gu, '');
  if (letters.length >= 2) return letters.slice(0, 2).toUpperCase();
  return source.slice(0, 2).toUpperCase() || '?';
}

export function hueFromId(id: string): number {
  let hash = 0;
  for (let i = 0; i < id.length; i += 1) hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  return hash % 360;
}

export function lastPreview(messages: Message[] | undefined): string {
  if (!messages || messages.length === 0) return 'Нет сообщений';
  const last = messages[messages.length - 1];
  if (!last) return 'Нет сообщений';
  const text = last.text.replace(/\s+/g, ' ').trim();
  const clipped = text.length > 70 ? `${text.slice(0, 70)}…` : text;
  return last.direction === 'out' ? `Вы: ${clipped}` : clipped;
}

export function lastActivity(chat: Chat, messages: Message[] | undefined): number {
  const last = messages && messages.length > 0 ? messages[messages.length - 1]?.timestamp ?? 0 : 0;
  return Math.max(chat.createdAt, last);
}

export function createLocalId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `local-${crypto.randomUUID()}`;
  }
  return `local-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}
