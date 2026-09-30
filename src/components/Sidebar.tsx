import type { PollPhase } from '../hooks/useNotificationPoll';
import type { Chat, Message } from '../types';
import { ChatList } from './ChatList';

type Props = {
  chats: Chat[];
  messages: Record<string, Message[]>;
  selectedId: string | null;
  phase: PollPhase;
  detail: string | null;
  instanceId: string;
  settingsNote: string | null;
  stateNote: string | null;
  onDismissSettings: () => void;
  onSelect: (chatId: string) => void;
  onNewChat: () => void;
  onLogout: () => void;
};

export function Sidebar({
  chats,
  messages,
  selectedId,
  phase,
  detail,
  instanceId,
  settingsNote,
  stateNote,
  onDismissSettings,
  onSelect,
  onNewChat,
  onLogout,
}: Props) {
  return (
    <aside className="sidebar">
      <header className="sidebar__header">
        <div className="sidebar__title">
          <h1>Telegram</h1>
          <Status phase={phase} detail={detail} />
        </div>
        <button type="button" className="btn btn--ghost" onClick={onLogout}>
          Выйти
        </button>
      </header>

      {settingsNote && (
        <div className="banner">
          <p>{settingsNote}</p>
          <button type="button" className="btn btn--ghost" onClick={onDismissSettings}>
            Скрыть
          </button>
        </div>
      )}
      {stateNote && (
        <div className="banner banner--warn">
          <p>{stateNote}</p>
        </div>
      )}

      <div className="sidebar__new">
        <button type="button" className="btn btn--block" onClick={onNewChat}>
          Новый чат
        </button>
      </div>

      <ChatList chats={chats} messages={messages} selectedId={selectedId} onSelect={onSelect} />

      <footer className="sidebar__foot">инстанс {instanceId}</footer>
    </aside>
  );
}

export function Status({ phase, detail }: { phase: PollPhase; detail: string | null }) {
  const label = phase === 'online' ? 'онлайн' : 'ожидание';
  return (
    <p className={`status status--${phase}`} title={detail ?? 'Ожидание уведомлений GREEN-API'} aria-live="polite">
      <span className="status__dot" />
      {label}
      {phase === 'error' && detail && <span className="status__detail">{detail}</span>}
    </p>
  );
}
