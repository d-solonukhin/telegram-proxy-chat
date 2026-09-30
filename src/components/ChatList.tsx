import { chatTitle, formatListTime, hueFromId, initials, lastActivity, lastPreview } from '../format';
import type { Chat, Message } from '../types';

type Props = {
  chats: Chat[];
  messages: Record<string, Message[]>;
  selectedId: string | null;
  onSelect: (chatId: string) => void;
};

export function ChatList({ chats, messages, selectedId, onSelect }: Props) {
  const sorted = [...chats].sort(
    (a, b) => lastActivity(b, messages[b.chatId]) - lastActivity(a, messages[a.chatId]),
  );

  if (sorted.length === 0) {
    return <p className="empty empty--side">Нет чатов. Нажмите «Новый чат».</p>;
  }

  return (
    <div className="chat-list" role="list">
      {sorted.map((chat) => {
        const thread = messages[chat.chatId];
        const activity = lastActivity(chat, thread);
        const active = chat.chatId === selectedId;
        return (
          <button
            key={chat.chatId}
            type="button"
            role="listitem"
            className={active ? 'chat-item chat-item--active' : 'chat-item'}
            aria-current={active ? 'true' : undefined}
            onClick={() => onSelect(chat.chatId)}
          >
            <span className="avatar" style={{ background: `hsl(${hueFromId(chat.chatId)} 38% 36%)` }}>
              {initials(chat)}
            </span>
            <span className="chat-item__body">
              <span className="chat-item__top">
                <span className="chat-item__name">{chatTitle(chat)}</span>
                {thread && thread.length > 0 && (
                  <time dateTime={new Date(activity * 1000).toISOString()}>{formatListTime(activity)}</time>
                )}
              </span>
              <span className="chat-item__preview">{lastPreview(thread)}</span>
            </span>
          </button>
        );
      })}
    </div>
  );
}
