import { useEffect, useRef } from 'react';
import { chatSubtitle, chatTitle, formatDayLabel, hueFromId, initials } from '../format';
import type { PollPhase } from '../hooks/useNotificationPoll';
import type { Chat, Message } from '../types';
import { Composer } from './Composer';
import { MessageBubble } from './MessageBubble';
import { Status } from './Sidebar';

type Props = {
  chat: Chat | null;
  messages: Message[];
  phase: PollPhase;
  detail: string | null;
  onBack: () => void;
  onSend: (text: string) => void;
  onRetry: (message: Message) => void;
};

export function ChatWindow({ chat, messages, phase, detail, onBack, onSend, onRetry }: Props) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const stickRef = useRef(true);

  useEffect(() => {
    stickRef.current = true;
    const scroller = scrollerRef.current;
    if (scroller) scroller.scrollTop = scroller.scrollHeight;
  }, [chat?.chatId]);

  useEffect(() => {
    const scroller = scrollerRef.current;
    if (!scroller || !stickRef.current) return;
    scroller.scrollTop = scroller.scrollHeight;
  }, [messages, chat?.chatId]);

  if (!chat) {
    return (
      <section className="chat-pane chat-pane--empty">
        <div className="placeholder">
          <h2>Выберите чат</h2>
          <p>Или начните новый по номеру телефона или @username.</p>
        </div>
      </section>
    );
  }

  let lastDay = '';

  return (
    <section className="chat-pane">
      <header className="chat-header">
        <button type="button" className="back-btn" onClick={onBack} aria-label="К списку чатов">
          ←
        </button>
        <span className="avatar avatar--sm" style={{ background: `hsl(${hueFromId(chat.chatId)} 38% 36%)` }}>
          {initials(chat)}
        </span>
        <div className="chat-header__text">
          <h2>{chatTitle(chat)}</h2>
          <p>{chatSubtitle(chat)}</p>
        </div>
        <Status phase={phase} detail={detail} />
      </header>

      <div
        className="messages"
        ref={scrollerRef}
        onScroll={(event) => {
          const el = event.currentTarget;
          stickRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 120;
        }}
      >
        {messages.length === 0 && <p className="empty">Нет сообщений</p>}
        {messages.map((message) => {
          const day = formatDayLabel(message.timestamp);
          const showDay = day !== lastDay;
          lastDay = day;
          return (
            <div key={message.idMessage}>
              {showDay && <div className="day">{day}</div>}
              <MessageBubble message={message} onRetry={onRetry} />
            </div>
          );
        })}
      </div>

      <Composer chatId={chat.chatId} onSend={onSend} />
    </section>
  );
}
