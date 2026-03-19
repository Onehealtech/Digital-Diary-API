// src/controllers/accountDeletion.controller.ts

import { Response } from "express";
import { z } from "zod";
import { AuthenticatedRequest } from "../middleware/authMiddleware";
import { responseMiddleware } from "../utils/response";
import { HTTP_STATUS } from "../utils/constants";
import { AppError } from "../utils/AppError";
import * as accountDeletionService from "../service/accountDeletion.service";

const deleteAccountSchema = z.object({
  reason: z.string().max(500).optional(),
  confirmDelete: z.literal(true, {
    errorMap: () => ({ message: "You must confirm deletion by setting confirmDelete to true" }),
  }),
});

/**
 * DELETE /api/v1/account/delete
 * Patient deletes their own account (Google Play Store compliance)
 */
export const deleteAccount = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const patientId = (req.user as { id: string }).id;

    const parsed = deleteAccountSchema.safeParse(req.body);
    if (!parsed.success) {
      responseMiddleware(res, HTTP_STATUS.BAD_REQUEST, parsed.error.issues[0].message);
      return;
    }

    const result = await accountDeletionService.deletePatientAccount(
      patientId,
      parsed.data.reason
    );

    responseMiddleware(res, HTTP_STATUS.OK, "User account and data deleted successfully", result);
  } catch (error: unknown) {
    if (error instanceof AppError) {
      responseMiddleware(res, error.statusCode, error.message);
      return;
    }
    const message = error instanceof Error ? error.message : "Failed to delete account";
    responseMiddleware(res, HTTP_STATUS.INTERNAL_SERVER_ERROR, message);
  }
};
