import { useEffect, useRef } from 'react';
import { chatSubtitle, chatTitle, formatDayLabel, hueFromId, initials } from '../../format';
import type { PollPhase } from '../../hooks/useNotificationPoll';
import ui from '../../styles/ui.module.css';
import type { Chat, Message } from '../../types';
import { Composer } from '../Composer/Composer';
import { MessageBubble } from '../MessageBubble/MessageBubble';
import { Status } from '../Status/Status';
import styles from './ChatWindow.module.css';

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
      <section className={`${styles.pane} ${styles.emptyPane}`}>
        <div className={styles.placeholder}>
          <h2>Выберите чат</h2>
          <p>Или начните новый по номеру телефона или @username.</p>
        </div>
      </section>
    );
  }

  let lastDay = '';

  return (
    <section className={styles.pane}>
      <header className={styles.header}>
        <button type="button" className={styles.back} onClick={onBack} aria-label="К списку чатов">
          ←
        </button>
        <span className={`${ui.avatar} ${ui.avatarSm}`} style={{ background: `hsl(${hueFromId(chat.chatId)} 38% 36%)` }}>
          {initials(chat)}
        </span>
        <div className={styles.headerText}>
          <h2>{chatTitle(chat)}</h2>
          <p>{chatSubtitle(chat)}</p>
        </div>
        <Status phase={phase} detail={detail} compact />
      </header>

      <div
        className={styles.messages}
        ref={scrollerRef}
        onScroll={(event) => {
          const el = event.currentTarget;
          stickRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 120;
        }}
      >
        {messages.length === 0 && <p className={styles.empty}>Нет сообщений</p>}
        {messages.map((message) => {
          const day = formatDayLabel(message.timestamp);
          const showDay = day !== lastDay;
          lastDay = day;
          return (
            <div key={message.idMessage}>
              {showDay && <div className={styles.day}>{day}</div>}
              <MessageBubble message={message} onRetry={onRetry} />
            </div>
          );
        })}
      </div>

      <Composer chatId={chat.chatId} onSend={onSend} />
    </section>
  );
}
