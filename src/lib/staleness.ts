/**
 * Whether data has stopped arriving.
 *
 * Kept apart from the component that renders it so it can be tested, and
 * because "how old is this?" is a question the summary layer will ask too.
 */

/**
 * Whole days since an ISO timestamp.
 *
 * Returns null when there has never been a sample. That is deliberately not 0:
 * a member who has never connected anything is an EMPTY state, and reporting
 * them as "0 days since last sync" would read as perfectly up to date.
 */
export function daysSince(iso: string | null, now = new Date()): number | null {
  if (!iso) return null;
  const then = new Date(iso);
  if (Number.isNaN(then.getTime())) return null;
  return Math.floor((now.getTime() - then.getTime()) / 86_400_000);
}
