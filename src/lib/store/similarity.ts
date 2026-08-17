/**
 * MVP similarity rule for the repetition penalty (Round1 review fix).
 *
 * Two activities count as "similar" when ALL of the following hold:
 *   - same primary SKILL ID (stable identity — Round6: never the display name)
 *   - same activity type
 *   - happened within the recent window (default 30 days) before `refTime`
 *
 * `skillId` is the authoritative anti-farming key: two labels that alias the
 * same skill (Statistics / 统计学) must count as one and the same.
 */

export interface SimilarTransactionLike {
  skillId: string;
  activityType: string | null;
  createdAt: string;
}

export interface CountRecentSimilarParams {
  skillId: string;
  activityType: string | null;
  /** ISO timestamp used as the reference "now"; defaults to Date.now(). */
  refTime?: string;
  /** Number of days to look back; defaults to 30. */
  windowDays?: number;
}

const DEFAULT_WINDOW_DAYS = 30;

export function countRecentSimilar(
  transactions: SimilarTransactionLike[],
  params: CountRecentSimilarParams,
): number {
  if (!params.skillId) return 0;

  const refMs = params.refTime ? new Date(params.refTime).getTime() : Date.now();
  if (Number.isNaN(refMs)) return 0;
  const windowDays = params.windowDays ?? DEFAULT_WINDOW_DAYS;
  const windowMs = windowDays * 24 * 60 * 60 * 1000;
  const cutoffMs = refMs - windowMs;

  let count = 0;
  for (const tx of transactions) {
    const createdAtMs = new Date(tx.createdAt).getTime();
    if (Number.isNaN(createdAtMs)) continue;
    if (createdAtMs > refMs || createdAtMs < cutoffMs) continue;
    if (tx.skillId !== params.skillId) continue;
    if (params.activityType != null && tx.activityType !== params.activityType) continue;
    count += 1;
  }
  return count;
}
