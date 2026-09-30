import { useEffect, useId, useState, type FormEvent } from 'react';
import { normalizePhone, normalizeUsername } from '../format';

type Mode = 'phone' | 'username';

type Props = {
  onClose: () => void;
  onCreate: (input: { phoneNumber?: string; username?: string }) => Promise<void>;
};

const USERNAME_RE = /^@[A-Za-z][A-Za-z0-9_]{4,31}$/;

export function NewChatModal({ onClose, onCreate }: Props) {
  const fieldId = useId();
  const [mode, setMode] = useState<Mode>('phone');
  const [phone, setPhone] = useState('');
  const [username, setUsername] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !loading) onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [loading, onClose]);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (loading) return;
    setError(null);

    if (mode === 'phone') {
      if (!/^\d{8,15}$/.test(phone)) {
        setError('Введите номер в международном формате, только цифры, например 79876543210');
        return;
      }
    } else if (!USERNAME_RE.test(username)) {
      setError('Введите @username: от 5 до 32 символов, латиница, цифры и _');
      return;
    }

    setLoading(true);
    try {
      await onCreate(mode === 'phone' ? { phoneNumber: phone } : { username });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось проверить аккаунт');
      setLoading(false);
    }
  };

  return (
    <div
      className="modal-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !loading) onClose();
      }}
    >
      <form className="modal" onSubmit={(event) => void submit(event)} role="dialog" aria-modal="true" aria-labelledby={`${fieldId}-title`}>
        <h2 id={`${fieldId}-title`}>Новый чат</h2>
        <p className="modal__hint">Номер или @username нужны только чтобы узнать chatId. Дальше сообщения уходят по chatId.</p>

        <div className="segment" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={mode === 'phone'}
            className={mode === 'phone' ? 'segment__btn segment__btn--active' : 'segment__btn'}
            onClick={() => setMode('phone')}
            disabled={loading}
          >
            Телефон
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={mode === 'username'}
            className={mode === 'username' ? 'segment__btn segment__btn--active' : 'segment__btn'}
            onClick={() => setMode('username')}
            disabled={loading}
          >
            Username
          </button>
        </div>

        {mode === 'phone' ? (
          <label className="field" htmlFor={fieldId}>
            <span>Номер в международном формате</span>
            <input
              id={fieldId}
              autoFocus
              inputMode="numeric"
              autoComplete="off"
              spellCheck={false}
              placeholder="79876543210"
              value={phone}
              disabled={loading}
              onChange={(event) => setPhone(normalizePhone(event.target.value))}
            />
          </label>
        ) : (
          <label className="field" htmlFor={fieldId}>
            <span>Telegram @username</span>
            <input
              id={fieldId}
              autoFocus
              autoComplete="off"
              spellCheck={false}
              placeholder="@username"
              value={username}
              disabled={loading}
              onChange={(event) => setUsername(normalizeUsername(event.target.value))}
            />
          </label>
        )}

        {error && (
          <div className="callout" role="alert">
            <p>{error}</p>
          </div>
        )}

        <div className="modal__actions">
          <button type="button" className="btn btn--ghost" onClick={onClose} disabled={loading}>
            Отмена
          </button>
          <button type="submit" className="btn" disabled={loading}>
            {loading ? 'Ищем аккаунт…' : 'Найти'}
          </button>
        </div>
      </form>
    </div>
  );
}
