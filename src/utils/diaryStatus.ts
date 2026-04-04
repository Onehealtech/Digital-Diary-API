export const DIARY_STATUS = {
  PENDING: "PENDING",
  APPROVED: "APPROVED",
} as const;

export type DiaryStatus = (typeof DIARY_STATUS)[keyof typeof DIARY_STATUS];

/**
 * Normalizes legacy diary statuses to the new approval workflow.
 * This keeps old DB rows readable while we migrate to strict PENDING/APPROVED.
 */
export const normalizeDiaryStatus = (status?: string | null): DiaryStatus => {
  if (status === DIARY_STATUS.APPROVED || status === "active") {
    return DIARY_STATUS.APPROVED;
  }
  return DIARY_STATUS.PENDING;
};
