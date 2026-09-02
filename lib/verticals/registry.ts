import type { VerticalPack } from './types';
import { genericPack } from './packs/generic';
import { medicalObgynPack } from './packs/medical-obgyn';
import { childDevelopmentPack } from './packs/child-development';

/**
 * Every vertical the engine can write for. Adding an industry is: write a pack
 * file, import it, add it here. No other file should need to change.
 */
const PACKS: readonly VerticalPack[] = [genericPack, medicalObgynPack, childDevelopmentPack];

export const DEFAULT_VERTICAL_ID = genericPack.id;

const BY_ID = new Map(PACKS.map((pack) => [pack.id, pack]));

/**
 * Resolve a tenant's `vertical` column to a pack. Falls back to the generic
 * pack rather than throwing: an unknown id means the row predates a pack or
 * the pack was removed, and a tenant losing their industry voice is a much
 * better failure than their dashboard 500ing.
 */
export function getVertical(id: string | null | undefined): VerticalPack {
  if (!id) return genericPack;
  return BY_ID.get(id) ?? genericPack;
}

/** True when `id` names a pack that actually exists — use before persisting. */
export function isKnownVertical(id: string): boolean {
  return BY_ID.has(id);
}

/** Options for the admin's vertical picker. */
export function listVerticals(): { id: string; label: string; description: string }[] {
  return PACKS.map(({ id, label, description }) => ({ id, label, description }));
}

export { genericPack, medicalObgynPack, childDevelopmentPack };
export * from './types';
