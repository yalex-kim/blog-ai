'use client';

import { btnDanger, btnPrimary, btnSecondary } from '@/lib/ui';

// Replaces native confirm() for destructive actions, so the prompt matches
// the rest of the app instead of rendering as a browser chrome dialog.
export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = '확인',
  cancelLabel = '취소',
  tone = 'danger',
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: 'danger' | 'primary';
  onConfirm: () => void;
  onCancel: () => void;
}) {
  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-dialog-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4"
      onClick={onCancel}
    >
      <div
        className="w-full max-w-sm rounded-lg bg-surface p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="confirm-dialog-title" className="text-lg font-semibold text-ink">
          {title}
        </h2>
        <p className="mt-2 text-sm text-ink-soft">{message}</p>
        <div className="mt-6 flex justify-end gap-2">
          <button type="button" onClick={onCancel} className={`${btnSecondary} px-4 py-2`}>
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className={`${tone === 'danger' ? btnDanger : btnPrimary} px-4 py-2`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
