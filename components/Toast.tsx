'use client';

import { useCallback, useRef, useState } from 'react';

export type ToastTone = 'success' | 'error';

export interface Toast {
  id: number;
  tone: ToastTone;
  message: string;
}

// Success messages confirm something the user already knows they did, so they
// can time out. Errors have to be read — and often name a next step — so they
// stay until dismissed. A four-second error is an error nobody read.
const DISMISS_AFTER_MS: Record<ToastTone, number | null> = {
  success: 4000,
  error: null,
};

// Replaces the native alert() calls the app used for every success/failure
// message. alert() blocks the browser, can't be styled, and is especially
// disruptive on mobile.
export function useToasts() {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const nextId = useRef(0);

  const dismiss = useCallback((id: number) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const showToast = useCallback(
    (tone: ToastTone, message: string) => {
      const id = nextId.current++;
      setToasts((current) => [...current, { id, tone, message }]);
      const timeout = DISMISS_AFTER_MS[tone];
      if (timeout !== null) setTimeout(() => dismiss(id), timeout);
    },
    [dismiss]
  );

  return { toasts, showToast, dismiss };
}

const TONE_STYLES: Record<ToastTone, string> = {
  success: 'bg-surface border-green-200 text-green-800',
  error: 'bg-surface border-red-200 text-red-800',
};

export function ToastViewport({
  toasts,
  onDismiss,
}: {
  toasts: Toast[];
  onDismiss: (id: number) => void;
}) {
  if (toasts.length === 0) return null;

  return (
    <div
      // aria-live so screen readers announce messages that previously came
      // through blocking alert() dialogs.
      aria-live="polite"
      className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-[calc(100vw-2rem)] sm:max-w-sm"
    >
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`flex items-start gap-3 rounded-lg border shadow-lg px-4 py-3 text-sm ${TONE_STYLES[toast.tone]}`}
        >
          <span className="flex-1 whitespace-pre-line break-words">{toast.message}</span>
          <button
            type="button"
            onClick={() => onDismiss(toast.id)}
            aria-label="알림 닫기"
            className="shrink-0 -mt-0.5 -mr-1 rounded px-1.5 text-lg leading-none text-ink-faint hover:bg-line hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          >
            ×
          </button>
        </div>
      ))}
    </div>
  );
}
