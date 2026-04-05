export const DIARY_STATUS = {
  PENDING: "PENDING",
  APPROVED: "APPROVED",
  REJECTED: "REJECTED",
} as const;

export type DiaryStatus = (typeof DIARY_STATUS)[keyof typeof DIARY_STATUS];

/**
 * Normalizes legacy diary statuses to the new approval workflow.
 * This keeps old DB rows readable while we migrate to strict
 * PENDING / APPROVED / REJECTED semantics.
 */
export const normalizeDiaryStatus = (status?: string | null): DiaryStatus => {
  if (status === DIARY_STATUS.APPROVED || status === "active") {
    return DIARY_STATUS.APPROVED;
  }
  if (
    status === DIARY_STATUS.REJECTED ||
    status === "rejected" ||
    status === "available"
  ) {
    return DIARY_STATUS.REJECTED;
  }
  return DIARY_STATUS.PENDING;
};
