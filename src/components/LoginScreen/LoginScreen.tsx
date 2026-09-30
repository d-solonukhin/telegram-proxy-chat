import { useId, useState, type FormEvent } from 'react';
import { QR_AUTH_MESSAGE } from '../../api/greenApi';
import ui from '../../styles/ui.module.css';
import styles from './LoginScreen.module.css';

type Props = {
  initialId: string;
  initialToken: string;
  initialApiUrl: string;
  checking: boolean;
  error: string | null;
  canClear: boolean;
  onSubmit: (input: { idInstance: string; apiTokenInstance: string; apiUrl: string }) => void;
  onClear: () => void;
};

export function LoginScreen({
  initialId,
  initialToken,
  initialApiUrl,
  checking,
  error,
  canClear,
  onSubmit,
  onClear,
}: Props) {
  const idField = useId();
  const tokenField = useId();
  const urlField = useId();
  const [idInstance, setIdInstance] = useState(initialId);
  const [apiTokenInstance, setApiTokenInstance] = useState(initialToken);
  const [apiUrl, setApiUrl] = useState(initialApiUrl);
  const [showToken, setShowToken] = useState(false);

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (checking) return;
    onSubmit({ idInstance, apiTokenInstance, apiUrl });
  };

  return (
    <main className={styles.page}>
      <form className={styles.card} onSubmit={handleSubmit} autoComplete="off">
        <div className={styles.brand}>
          <Logo />
          <div>
            <h1>Telegram</h1>
            <p>Текстовые сообщения через GREEN-API</p>
          </div>
        </div>

        <label className={ui.field} htmlFor={idField}>
          <span className={ui.label}>ID инстанса (idInstance)</span>
          <input
            id={idField}
            className={ui.control}
            inputMode="numeric"
            autoComplete="off"
            spellCheck={false}
            value={idInstance}
            disabled={checking}
            onChange={(event) => setIdInstance(event.target.value.replace(/[^\d]/g, '').slice(0, 20))}
            placeholder="4100000000"
          />
        </label>

        <label className={ui.field} htmlFor={tokenField}>
          <span className={ui.label}>Токен инстанса (apiTokenInstance)</span>
          <span className={ui.row}>
            <input
              id={tokenField}
              className={ui.control}
              type={showToken ? 'text' : 'password'}
              autoComplete="new-password"
              spellCheck={false}
              value={apiTokenInstance}
              disabled={checking}
              onChange={(event) => setApiTokenInstance(event.target.value.trim())}
              placeholder="токен из кабинета"
            />
            <button
              type="button"
              className={`${ui.btn} ${ui.ghost}`}
              onClick={() => setShowToken((value) => !value)}
              disabled={checking}
            >
              {showToken ? 'Скрыть' : 'Показать'}
            </button>
          </span>
        </label>

        <label className={ui.field} htmlFor={urlField}>
          <span className={ui.label}>URL API (apiUrl), необязательно</span>
          <input
            id={urlField}
            className={ui.control}
            inputMode="url"
            autoComplete="off"
            spellCheck={false}
            value={apiUrl}
            disabled={checking}
            onChange={(event) => setApiUrl(event.target.value.trim())}
            placeholder="https://4100.api.green-api.com"
          />
          <small className={ui.hint}>Если пусто — https://XXXX.api.green-api.com, где XXXX первые 4 цифры idInstance.</small>
        </label>

        {error && (
          <div className={ui.callout} role="alert">
            <p>{error}</p>
            {error === QR_AUTH_MESSAGE && (
              <p>
                В кабинете нажмите «Получить QR», затем в Telegram: Настройки → Устройства → Подключить устройство.
              </p>
            )}
          </div>
        )}

        <button className={`${ui.btn} ${ui.block}`} type="submit" disabled={checking}>
          {checking ? 'Проверяем инстанс…' : 'Войти'}
        </button>

        <div className={styles.links}>
          <a href="https://console.green-api.com" target="_blank" rel="noreferrer">
            Личный кабинет GREEN-API
          </a>
          {canClear && (
            <button type="button" className={`${ui.btn} ${ui.ghost}`} onClick={onClear} disabled={checking}>
              Выйти
            </button>
          )}
        </div>
      </form>
    </main>
  );
}

export function BootScreen() {
  return (
    <main className={styles.page}>
      <div className={`${styles.card} ${styles.boot}`}>
        <Logo />
        <p className={styles.bootText}>Подключаемся…</p>
      </div>
    </main>
  );
}

function Logo() {
  return (
    <svg className={styles.logo} viewBox="0 0 32 32" aria-hidden="true">
      <rect width="32" height="32" rx="10" fill="#2b5278" />
      <path
        fill="#fff"
        d="M7 15.2 24.2 8.4c.8-.3 1.5.4 1.3 1.2l-2.8 13.2c-.2.9-1.1 1.3-1.9.8l-4.2-2.6-2.2 2.1c-.3.3-.8.1-.9-.3l-.5-3.4 7.6-6.8c.3-.3 0-.7-.4-.5l-9.4 5.9-3.3-1c-.9-.3-.9-1.5 0-1.8z"
      />
    </svg>
  );
}
