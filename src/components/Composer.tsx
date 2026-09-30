import { useEffect, useRef, useState, type KeyboardEvent } from 'react';

type Props = {
  chatId: string;
  onSend: (text: string) => void;
};

export function Composer({ chatId, onSend }: Props) {
  const drafts = useRef<Record<string, string>>({});
  const chatIdRef = useRef(chatId);
  const textRef = useRef('');
  const areaRef = useRef<HTMLTextAreaElement>(null);
  const [text, setText] = useState('');
  textRef.current = text;

  useEffect(() => {
    const previous = chatIdRef.current;
    if (previous !== chatId) drafts.current[previous] = textRef.current;
    chatIdRef.current = chatId;
    setText(drafts.current[chatId] ?? '');
  }, [chatId]);

  useEffect(() => {
    const area = areaRef.current;
    if (!area) return;
    area.style.height = 'auto';
    area.style.height = `${Math.min(area.scrollHeight, 160)}px`;
  }, [text]);

  const trimmed = text.trim();
  const tooLong = text.length > 4096;
  const canSend = trimmed.length > 0 && !tooLong;

  const send = () => {
    if (!canSend) return;
    onSend(trimmed);
    drafts.current[chatId] = '';
    setText('');
  };

  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key !== 'Enter' || event.shiftKey) return;
    if (event.nativeEvent.isComposing) return;
    event.preventDefault();
    send();
  };

  return (
    <form
      className="composer"
      onSubmit={(event) => {
        event.preventDefault();
        send();
      }}
    >
      <textarea
        ref={areaRef}
        rows={1}
        value={text}
        maxLength={4096}
        placeholder="Сообщение"
        aria-label="Сообщение"
        onChange={(event) => setText(event.target.value)}
        onKeyDown={onKeyDown}
      />
      <div className="composer__side">
        {text.length >= 3000 && (
          <span className={tooLong ? 'counter counter--over' : 'counter'}>
            {text.length}/4096
          </span>
        )}
        <button type="submit" className="send" disabled={!canSend} aria-label="Отправить">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path
              fill="currentColor"
              d="M3.4 11.2 20.2 3.6c.7-.3 1.4.4 1.1 1.1l-7.6 16.8c-.3.7-1.3.7-1.6 0l-3.2-6.4-6.4-3.2c-.7-.3-.7-1.3 0-1.7z"
            />
          </svg>
        </button>
      </div>
    </form>
  );
}
