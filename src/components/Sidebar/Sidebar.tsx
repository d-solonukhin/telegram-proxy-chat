import type { PollPhase } from '../../hooks/useNotificationPoll';
import ui from '../../styles/ui.module.css';
import type { Chat, Message } from '../../types';
import { ChatList } from '../ChatList/ChatList';
import { Status } from '../Status/Status';
import styles from './Sidebar.module.css';

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
    <aside className={styles.sidebar}>
      <header className={styles.header}>
        <div className={styles.title}>
          <h1>Telegram</h1>
          <Status phase={phase} detail={detail} />
        </div>
        <button type="button" className={`${ui.btn} ${ui.ghost}`} onClick={onLogout}>
          Выйти
        </button>
      </header>

      {settingsNote && (
        <div className={styles.banner}>
          <p>{settingsNote}</p>
          <button type="button" className={`${ui.btn} ${ui.ghost} ${styles.dismiss}`} onClick={onDismissSettings}>
            Скрыть
          </button>
        </div>
      )}
      {stateNote && (
        <div className={`${styles.banner} ${styles.warn}`}>
          <p>{stateNote}</p>
        </div>
      )}

      <div className={styles.newChat}>
        <button type="button" className={`${ui.btn} ${ui.block}`} onClick={onNewChat}>
          Новый чат
        </button>
      </div>

      <ChatList chats={chats} messages={messages} selectedId={selectedId} onSelect={onSelect} />

      <footer className={styles.foot}>инстанс {instanceId}</footer>
    </aside>
  );
}
