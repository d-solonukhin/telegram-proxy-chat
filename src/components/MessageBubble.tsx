import { formatClock } from '../format';
import type { Message } from '../types';

type Props = {
  message: Message;
  onRetry: (message: Message) => void;
};

export function MessageBubble({ message, onRetry }: Props) {
  const outgoing = message.direction === 'out';
  return (
    <div className={outgoing ? 'bubble-row bubble-row--out' : 'bubble-row'}>
      <div
        className={[
          'bubble',
          outgoing ? 'bubble--out' : 'bubble--in',
          message.status === 'failed' ? 'bubble--failed' : '',
        ]
          .filter(Boolean)
          .join(' ')}
      >
        <p className="bubble__text">{message.text}</p>
        <div className="bubble__meta">
          <time dateTime={new Date(message.timestamp * 1000).toISOString()}>{formatClock(message.timestamp)}</time>
          {outgoing && message.status === 'pending' && <span>отправка…</span>}
          {outgoing && message.status === 'sent' && <span aria-label="отправлено">✓</span>}
          {outgoing && message.status === 'failed' && (
            <button type="button" className="linkish" onClick={() => onRetry(message)}>
              Повторить
            </button>
          )}
        </div>
        {message.status === 'failed' && message.error && <p className="bubble__error">{message.error}</p>}
      </div>
    </div>
  );
}
