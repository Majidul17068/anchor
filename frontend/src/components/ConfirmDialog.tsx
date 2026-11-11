import React, { useEffect, useState } from 'react';
import { useConfirmStore } from '../store/confirm';
import { Dialog } from './Dialog';
import { Button } from './Button';
import { Input } from './Input';

/** Renders whatever `confirmDialog()` / `promptDialog()` is asking. Mount once. */
export const ConfirmHost: React.FC = () => {
  const pending = useConfirmStore((s) => s.pending);
  const settle = useConfirmStore((s) => s.settle);
  const [text, setText] = useState('');

  useEffect(() => {
    if (pending?.kind === 'prompt') setText(pending.defaultValue ?? '');
  }, [pending]);

  const accept = () => {
    if (!pending) return;
    if (pending.kind === 'prompt') settle(text);
    else settle(true);
  };

  // Enter confirms, matching the native dialogs this replaces.
  useEffect(() => {
    if (!pending) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        accept();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pending, text]);

  if (!pending) return null;

  const isPrompt = pending.kind === 'prompt';
  const disabled = isPrompt && !text.trim();

  return (
    <Dialog
      open
      onClose={() => settle(isPrompt ? null : false)}
      title={pending.title}
      description={pending.message}
      maxWidth="sm"
      footer={
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => settle(isPrompt ? null : false)}>
            {pending.cancelLabel ?? 'Cancel'}
          </Button>
          <Button
            variant={pending.danger ? 'danger' : 'primary'}
            size="sm"
            autoFocus={!isPrompt}
            disabled={disabled}
            onClick={accept}
          >
            {pending.confirmLabel ?? (isPrompt ? 'OK' : 'Confirm')}
          </Button>
        </div>
      }
    >
      {isPrompt ? (
        <Input
          autoFocus
          label={pending.label}
          placeholder={pending.placeholder}
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
      ) : (
        <span className="sr-only">{pending.title}</span>
      )}
    </Dialog>
  );
};
