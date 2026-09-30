import { formatClock } from '../../format';
import type { Message } from '../../types';
import styles from './MessageBubble.module.css';

type Props = {
  message: Message;
  onRetry: (message: Message) => void;
};

export function MessageBubble({ message, onRetry }: Props) {
  const outgoing = message.direction === 'out';
  return (
    <div className={[styles.row, outgoing ? styles.rowOut : ''].filter(Boolean).join(' ')}>
      <div
        className={[
          styles.bubble,
          outgoing ? styles.outgoing : styles.incoming,
          message.status === 'failed' ? styles.failed : '',
        ]
          .filter(Boolean)
          .join(' ')}
      >
        <p className={styles.text}>{message.text}</p>
        <div className={styles.meta}>
          <time dateTime={new Date(message.timestamp * 1000).toISOString()}>{formatClock(message.timestamp)}</time>
          {outgoing && message.status === 'pending' && <span>отправка…</span>}
          {outgoing && message.status === 'sent' && <span aria-label="отправлено">✓</span>}
          {outgoing && message.status === 'failed' && (
            <button type="button" className={styles.retry} onClick={() => onRetry(message)}>
              Повторить
            </button>
          )}
        </div>
        {message.status === 'failed' && message.error && <p className={styles.error}>{message.error}</p>}
      </div>
    </div>
  );
}
