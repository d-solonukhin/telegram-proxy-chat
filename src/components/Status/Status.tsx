import type { PollPhase } from '../../hooks/useNotificationPoll';
import styles from './Status.module.css';

const PHASE_CLASS: Record<PollPhase, string> = {
  idle: '',
  waiting: styles.waiting,
  online: styles.online,
  error: styles.error,
};

export function Status({
  phase,
  detail,
  compact = false,
}: {
  phase: PollPhase;
  detail: string | null;
  compact?: boolean;
}) {
  const label = phase === 'online' ? 'онлайн' : 'ожидание';
  const className = [styles.status, PHASE_CLASS[phase], compact ? styles.compact : ''].filter(Boolean).join(' ');
  return (
    <p className={className} title={detail ?? 'Ожидание уведомлений GREEN-API'} aria-live="polite">
      <span className={styles.dot} />
      {label}
      {phase === 'error' && detail && !compact && <span className={styles.detail}>{detail}</span>}
    </p>
  );
}
