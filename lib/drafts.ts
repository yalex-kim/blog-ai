// Unsaved edits, kept in the browser so closing a tab mid-edit does not throw
// the work away.
//
// This is deliberately not a sync-to-server feature. A draft here is a local
// safety net for one person on one device between opening the editor and
// pressing save; the server copy stays the single source of truth, and a draft
// is dropped the moment the edit lands there.

const PREFIX = 'blog-ai:draft:';

export interface Draft {
  content: string;
  savedAt: number;
}

// Every accessor is wrapped: localStorage throws in a private window, with
// site data blocked, and when the origin's quota is full. A draft that cannot
// be stored is a missing convenience, never a broken editor.
export function saveDraft(postId: string, content: string): void {
  try {
    const draft: Draft = { content, savedAt: Date.now() };
    localStorage.setItem(PREFIX + postId, JSON.stringify(draft));
  } catch {
    // no-op
  }
}

export function readDraft(postId: string): Draft | null {
  try {
    const raw = localStorage.getItem(PREFIX + postId);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Draft;
    return typeof parsed?.content === 'string' ? parsed : null;
  } catch {
    return null;
  }
}

export function clearDraft(postId: string): void {
  try {
    localStorage.removeItem(PREFIX + postId);
  } catch {
    // no-op
  }
}

/** Formats a draft's age for the restore prompt — "3분 전에 저장됨". */
export function describeDraftAge(savedAt: number): string {
  const minutes = Math.floor((Date.now() - savedAt) / 60000);
  if (minutes < 1) return '방금';
  if (minutes < 60) return `${minutes}분 전`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}시간 전`;
  return `${Math.floor(hours / 24)}일 전`;
}
