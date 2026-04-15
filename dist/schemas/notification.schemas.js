"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.patientNotificationHistoryQuerySchema = exports.patientNotificationHistoryParamsSchema = void 0;
const zod_1 = require("zod");
/**
 * Schema for GET /api/v1/notifications/patient/:patientId/history
 */
exports.patientNotificationHistoryParamsSchema = zod_1.z.object({
    patientId: zod_1.z.string().uuid("Invalid patient ID"),
});
exports.patientNotificationHistoryQuerySchema = zod_1.z.object({
    page: zod_1.z.coerce.number().int().min(1).default(1),
    limit: zod_1.z.coerce.number().int().min(1).max(100).default(20),
});
