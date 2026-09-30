import { useCallback, useEffect, useRef, useState } from 'react';
import {
  checkAccount,
  describeInstanceState,
  ensureHttpApiSettings,
  getStateInstance,
  normalizeCredentials,
  sendMessage as apiSendMessage,
} from './api/greenApi';
import styles from './App.module.css';
import { ChatWindow } from './components/ChatWindow/ChatWindow';
import { BootScreen, LoginScreen } from './components/LoginScreen/LoginScreen';
import { NewChatModal } from './components/NewChatModal/NewChatModal';
import { Sidebar } from './components/Sidebar/Sidebar';
import { createLocalId } from './format';
import { useChats } from './hooks/useChats';
import { useNotificationPoll } from './hooks/useNotificationPoll';
import { clearCredentials, loadCredentials, saveCredentials } from './storage';
import type { Chat, Credentials, Message, PollEvent } from './types';

const EMPTY_MESSAGES: Message[] = [];

export function App() {
  const savedOnStart = useRef(loadCredentials());
  const [session, setSession] = useState<Credentials | null>(null);
  const [draft, setDraft] = useState<Credentials | null>(savedOnStart.current);
  const [checking, setChecking] = useState(false);
  const [booting, setBooting] = useState(savedOnStart.current !== null);
  const [error, setError] = useState<string | null>(null);
  const [settingsNote, setSettingsNote] = useState<string | null>(null);
  const [stateNote, setStateNote] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [pane, setPane] = useState<'list' | 'chat'>('list');
  const [modalOpen, setModalOpen] = useState(false);
  const attempt = useRef(0);

  const { chats, messages, openChat, ingest, pushOptimistic, confirm, fail, retryPending } = useChats(
    session?.idInstance ?? null,
  );

  const onEvent = useCallback(
    (event: PollEvent) => {
      if (event.type === 'message') {
        ingest(event.message);
        return;
      }
      if (event.state === 'starting') {
        setStateNote('Инстанс запускается. Приём сообщений может появиться через несколько минут.');
        return;
      }
      const described = describeInstanceState(event.state);
      if (!described.ok) {
        setSession(null);
        setError(described.message);
        setPane('list');
        setModalOpen(false);
        return;
      }
      setStateNote(described.message || null);
    },
    [ingest],
  );

  const { phase, detail } = useNotificationPoll(session, onEvent);

  const enter = useCallback(async (input: { idInstance: string; apiTokenInstance: string; apiUrl: string }) => {
    const my = ++attempt.current;
    setChecking(true);
    setError(null);
    try {
      const credentials = normalizeCredentials(input);
      const state = await getStateInstance(credentials);
      if (attempt.current !== my) return;
      const described = describeInstanceState(state);
      saveCredentials(credentials);
      setDraft(credentials);
      if (!described.ok) {
        setSession(null);
        setError(described.message);
        return;
      }
      setStateNote(described.message || null);
      setSettingsNote(null);
      setSession(credentials);
      setSelectedId(sessionStorage.getItem(`tg-green-selected:${credentials.idInstance}`));
      setPane('list');
    } catch (err) {
      if (attempt.current !== my) return;
      setSession(null);
      setError(err instanceof Error ? err.message : 'Не удалось подключиться');
    } finally {
      if (attempt.current === my) {
        setChecking(false);
        setBooting(false);
      }
    }
  }, []);

  useEffect(() => {
    if (!savedOnStart.current) return;
    void enter(savedOnStart.current);
  }, [enter]);

  useEffect(() => {
    if (!session) return;
    let cancelled = false;
    void ensureHttpApiSettings(session).then((note) => {
      if (!cancelled && note) setSettingsNote(note);
    });
    return () => {
      cancelled = true;
    };
  }, [session]);

  useEffect(() => {
    if (!session || !selectedId) return;
    sessionStorage.setItem(`tg-green-selected:${session.idInstance}`, selectedId);
  }, [session, selectedId]);

  const logout = () => {
    attempt.current += 1;
    clearCredentials();
    setSession(null);
    setDraft(null);
    setError(null);
    setChecking(false);
    setBooting(false);
    setSettingsNote(null);
    setStateNote(null);
    setSelectedId(null);
    setPane('list');
    setModalOpen(false);
  };

  const sendText = useCallback(
    async (chatId: string, text: string, tempId?: string) => {
      if (!session) return;
      const message = text.trim();
      if (!message || message.length > 4096) return;
      const id = tempId ?? createLocalId();
      if (tempId) retryPending(chatId, tempId);
      else pushOptimistic(chatId, id, message, Math.floor(Date.now() / 1000));
      try {
        const result = await apiSendMessage(session, chatId, message);
        confirm(chatId, id, result.idMessage);
      } catch (err) {
        fail(chatId, id, err instanceof Error ? err.message : 'Не удалось отправить сообщение');
      }
    },
    [session, retryPending, pushOptimistic, confirm, fail],
  );

  const createChat = useCallback(
    async (input: { phoneNumber?: string; username?: string }) => {
      if (!session) throw new Error('Нет активной сессии');
      const result = await checkAccount(session, input);
      if (!result.exist || !result.chatId) {
        throw new Error('Аккаунт Telegram не найден');
      }
      if (result.chatId.startsWith('-')) {
        throw new Error('Групповые чаты не поддерживаются');
      }
      const username = storedUsername(result.username);
      const phone = (result.phoneNumber || input.phoneNumber || '').replace(/\D/g, '') || undefined;
      const chat: Chat = {
        chatId: result.chatId,
        name: username || (phone ? `+${phone}` : result.chatId),
        username,
        phoneNumber: phone,
        createdAt: Math.floor(Date.now() / 1000),
      };
      openChat(chat);
      setSelectedId(chat.chatId);
      setPane('chat');
    },
    [session, openChat],
  );

  if (!session && booting) return <BootScreen />;

  if (!session) {
    return (
      <LoginScreen
        key={draft?.idInstance ?? 'signed-out'}
        initialId={draft?.idInstance ?? ''}
        initialToken={draft?.apiTokenInstance ?? ''}
        initialApiUrl={draft?.apiUrl ?? ''}
        checking={checking}
        error={error}
        canClear={draft !== null}
        onSubmit={(input) => void enter(input)}
        onClear={logout}
      />
    );
  }

  const selected = chats.find((chat) => chat.chatId === selectedId) ?? null;
  const thread = selected ? messages[selected.chatId] ?? EMPTY_MESSAGES : EMPTY_MESSAGES;

  return (
    <div className={styles.app} data-pane={pane}>
      <Sidebar
        chats={chats}
        messages={messages}
        selectedId={selected?.chatId ?? null}
        phase={phase}
        detail={detail}
        instanceId={session.idInstance}
        settingsNote={settingsNote}
        stateNote={stateNote}
        onDismissSettings={() => setSettingsNote(null)}
        onSelect={(chatId) => {
          setSelectedId(chatId);
          setPane('chat');
        }}
        onNewChat={() => setModalOpen(true)}
        onLogout={logout}
      />
      <ChatWindow
        chat={selected}
        messages={thread}
        phase={phase}
        detail={detail}
        onBack={() => setPane('list')}
        onSend={(text) => {
          if (selected) void sendText(selected.chatId, text);
        }}
        onRetry={(message) => void sendText(message.chatId, message.text, message.idMessage)}
      />
      {modalOpen && <NewChatModal onClose={() => setModalOpen(false)} onCreate={createChat} />}
    </div>
  );
}

function storedUsername(value: string | undefined): string | undefined {
  if (!value) return undefined;
  const bare = value.trim().replace(/^@+/, '');
  return bare ? `@${bare}` : undefined;
}
