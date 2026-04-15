export const DIARY_STATUS = {
  PENDING: "pending",
  APPROVED: "active",
  REJECTED: "rejected",
} as const;

export type DiaryStatus = (typeof DIARY_STATUS)[keyof typeof DIARY_STATUS];

/**
 * Normalizes legacy diary statuses to the DB enum values.
 */
export const normalizeDiaryStatus = (status?: string | null): DiaryStatus => {
  if (
    status === "active" ||
    status === "APPROVED" ||
    status === DIARY_STATUS.APPROVED
  ) {
    return DIARY_STATUS.APPROVED;
  }
  if (
    status === "rejected" ||
    status === "REJECTED" ||
    status === DIARY_STATUS.REJECTED
  ) {
    return DIARY_STATUS.REJECTED;
  }
  return DIARY_STATUS.PENDING;
};
