import { useCallback, useEffect, useRef, useState } from 'react';
import {
  addOptimistic,
  confirmOptimistic,
  failOptimistic,
  ingestMessage,
  markPending,
  upsertChat,
} from '../chatStore';
import { EMPTY_STORE, loadStore, saveStore, type ChatStore } from '../storage';
import type { Chat, ParsedMessage } from '../types';

export function useChats(instanceId: string | null) {
  const [store, setStore] = useState<ChatStore>(EMPTY_STORE);
  const instanceRef = useRef(instanceId);
  instanceRef.current = instanceId;

  useEffect(() => {
    setStore(instanceId ? loadStore(instanceId) : EMPTY_STORE);
  }, [instanceId]);

  const update = useCallback((recipe: (prev: ChatStore) => ChatStore) => {
    setStore((prev) => {
      const id = instanceRef.current;
      if (!id) return prev;
      const next = recipe(prev);
      saveStore(id, next);
      return next;
    });
  }, []);

  const openChat = useCallback((chat: Chat) => {
    update((prev) => upsertChat(prev, chat));
  }, [update]);

  const ingest = useCallback((message: ParsedMessage) => {
    update((prev) => ingestMessage(prev, message));
  }, [update]);

  const pushOptimistic = useCallback((chatId: string, tempId: string, text: string, timestamp: number) => {
    update((prev) => addOptimistic(prev, chatId, tempId, text, timestamp));
  }, [update]);

  const confirm = useCallback((chatId: string, tempId: string, realId: string) => {
    update((prev) => confirmOptimistic(prev, chatId, tempId, realId));
  }, [update]);

  const fail = useCallback((chatId: string, tempId: string, error: string) => {
    update((prev) => failOptimistic(prev, chatId, tempId, error));
  }, [update]);

  const retryPending = useCallback((chatId: string, idMessage: string) => {
    update((prev) => markPending(prev, chatId, idMessage));
  }, [update]);

  return {
    chats: store.chats,
    messages: store.messages,
    openChat,
    ingest,
    pushOptimistic,
    confirm,
    fail,
    retryPending,
  };
}
