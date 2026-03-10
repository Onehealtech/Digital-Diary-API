import { z } from "zod";

/**
 * Schema for GET /api/v1/notifications/patient/:patientId/history
 */
export const patientNotificationHistoryParamsSchema = z.object({
    patientId: z.string().uuid("Invalid patient ID"),
});

export const patientNotificationHistoryQuerySchema = z.object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
});
