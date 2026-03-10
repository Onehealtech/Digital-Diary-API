import express from "express";
import * as adminController from "../controllers/admin.controller";
import { authCheck } from "../middleware/authMiddleware";
import { validate } from "../middleware/validate.middleware";
import { UserRole } from "../utils/constants";
import { createStaffSchema } from "../schemas/staff.schemas";

const router = express.Router();

// Super Admin only routes
router.post(
    "/create-staff",
    authCheck([UserRole.SUPER_ADMIN]),
    validate({ body: createStaffSchema }),
    adminController.createStaff
);

export default router;
