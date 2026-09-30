import { useEffect, useRef, useState } from 'react';
import { deleteNotification, interpretNotification, receiveNotification } from '../api/greenApi';
import type { Credentials, PollEvent } from '../types';

export type PollPhase = 'idle' | 'waiting' | 'online' | 'error';

/**
 * One long-poll loop. Every notification is deleted, including statuses we do
 * not render: GREEN-API delivers the queue FIFO, and an undeleted receipt
 * blocks everything behind it. Empty timeouts poll again immediately.
 */
export function useNotificationPoll(
  credentials: Credentials | null,
  onEvent: (event: PollEvent) => void,
): { phase: PollPhase; detail: string | null } {
  const [phase, setPhase] = useState<PollPhase>(credentials ? 'waiting' : 'idle');
  const [detail, setDetail] = useState<string | null>(null);
  const onEventRef = useRef(onEvent);
  onEventRef.current = onEvent;

  const idInstance = credentials?.idInstance ?? '';
  const apiTokenInstance = credentials?.apiTokenInstance ?? '';
  const apiUrl = credentials?.apiUrl ?? '';

  useEffect(() => {
    if (!credentials) {
      setPhase('idle');
      setDetail(null);
      return;
    }

    const ac = new AbortController();
    let stopped = false;
    let lastReceipt = '';
    let repeats = 0;

    const fail = (message: string) => {
      if (stopped || ac.signal.aborted) return;
      setPhase('error');
      setDetail(message);
    };

    const run = async () => {
      setPhase('waiting');
      setDetail(null);
      while (!stopped && !ac.signal.aborted) {
        try {
          const started = Date.now();
          const notification = await receiveNotification(credentials, ac.signal);
          if (stopped || ac.signal.aborted) return;
          setPhase((prev) => (prev === 'online' ? prev : 'online'));
          setDetail((prev) => (prev === null ? prev : null));

          if (!notification) {
            // A real timeout takes ~20s. An instant empty body would spin the loop.
            if (Date.now() - started < 1000) await sleep(1000, ac.signal);
            continue;
          }

          if (notification.receiptId === lastReceipt) {
            repeats += 1;
          } else {
            lastReceipt = notification.receiptId;
            repeats = 0;
          }

          const event = interpretNotification(notification.body);
          if (event) onEventRef.current(event);

          await deleteNotification(credentials, notification.receiptId, ac.signal);
          if (repeats >= 2) await sleep(2000, ac.signal);
        } catch (err) {
          if (stopped || ac.signal.aborted) return;
          const message = err instanceof Error ? err.message : 'Не удалось получить уведомления';
          fail(message);
          await sleep(1500, ac.signal);
        }
      }
    };

    void run();
    return () => {
      stopped = true;
      ac.abort();
    };
    // Primitives only: a new credentials object with the same values must not
    // restart the loop. apiTokenInstance is a dependency, never a log line.
  }, [idInstance, apiTokenInstance, apiUrl]);

  return { phase, detail };
}

function sleep(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    if (signal.aborted) {
      resolve();
      return;
    }
    const timer = setTimeout(finish, ms);
    const onAbort = () => finish();
    function finish() {
      clearTimeout(timer);
      signal.removeEventListener('abort', onAbort);
      resolve();
    }
    signal.addEventListener('abort', onAbort, { once: true });
  });
}
