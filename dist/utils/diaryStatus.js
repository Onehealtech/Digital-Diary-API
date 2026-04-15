"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.normalizeDiaryStatus = exports.DIARY_STATUS = void 0;
exports.DIARY_STATUS = {
    PENDING: "pending",
    APPROVED: "active",
    REJECTED: "rejected",
};
/**
 * Normalizes legacy diary statuses to the DB enum values.
 */
const normalizeDiaryStatus = (status) => {
    if (status === "active" ||
        status === "APPROVED" ||
        status === exports.DIARY_STATUS.APPROVED) {
        return exports.DIARY_STATUS.APPROVED;
    }
    if (status === "rejected" ||
        status === "REJECTED" ||
        status === exports.DIARY_STATUS.REJECTED) {
        return exports.DIARY_STATUS.REJECTED;
    }
    return exports.DIARY_STATUS.PENDING;
};
exports.normalizeDiaryStatus = normalizeDiaryStatus;
