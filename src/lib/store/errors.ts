/**
 * Domain errors for the settlement / assessment store.
 * ROUND7 (Milestone 3 P1): these live here instead of DemoRepository so the
 * SupabaseRepository (and any future backend) can throw the same contract
 * without importing the demo implementation.
 */

/** Stable machine-readable codes shared by store errors. */
export const STORE_ERROR_CODES = {
  activityAlreadySettled: "activity_already_settled",
} as const;

/**
 * Thrown when a confirmed Activity is re-assessed.
 *
 * Round6 (option B): a confirmed Activity yields ONE original settlement; no
 * re-assessment until a correction pipeline exists, so no forever-pending
 * zombie revisions can be minted. API maps this to 409.
 */
export class ActivityAlreadySettledError extends Error {
  readonly code = STORE_ERROR_CODES.activityAlreadySettled;
  constructor(activityId: string) {
    super(
      `Activity ${activityId} already settled; re-assessment is disabled until a correction pipeline exists`,
    );
    this.name = "ActivityAlreadySettledError";
  }
}
