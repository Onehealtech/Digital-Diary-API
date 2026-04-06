"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.normalizeDiaryStatus = exports.DIARY_STATUS = void 0;
exports.DIARY_STATUS = {
    PENDING: "PENDING",
    APPROVED: "APPROVED",
    REJECTED: "REJECTED",
};
/**
 * Normalizes legacy diary statuses to the new approval workflow.
 * This keeps old DB rows readable while we migrate to strict
 * PENDING / APPROVED / REJECTED semantics.
 */
const normalizeDiaryStatus = (status) => {
    if (status === exports.DIARY_STATUS.APPROVED || status === "active") {
        return exports.DIARY_STATUS.APPROVED;
    }
    if (status === exports.DIARY_STATUS.REJECTED ||
        status === "rejected" ||
        status === "available") {
        return exports.DIARY_STATUS.REJECTED;
    }
    return exports.DIARY_STATUS.PENDING;
};
exports.normalizeDiaryStatus = normalizeDiaryStatus;
