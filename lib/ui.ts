// Shared button styling — 돌봄 direction.
//
// Roles, not colors: exactly one primary per view, everything else
// secondary, danger only for consequential actions. Pill shape and the
// generous padding are what make the surface read as soft rather than
// clinical; the palette lives in app/globals.css.
const base =
  'rounded-full font-medium transition-colors disabled:cursor-not-allowed focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent';

export const btnPrimary = `${base} bg-accent text-white hover:bg-accent-strong disabled:bg-line-strong disabled:text-ink-faint`;

export const btnSecondary = `${base} bg-surface text-ink-soft border border-line-strong hover:bg-accent-tint hover:text-accent-strong disabled:bg-line disabled:text-ink-faint`;

export const btnDanger = `${base} bg-red-700 text-white hover:bg-red-800 disabled:bg-line-strong disabled:text-ink-faint`;

// Header/toolbar actions that shouldn't compete with page content.
export const btnGhost = `${base} text-ink-soft hover:bg-accent-tint hover:text-accent-strong`;
