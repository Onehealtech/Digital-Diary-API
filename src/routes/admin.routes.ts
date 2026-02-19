import express from "express";
import * as adminController from "../controllers/admin.controller";
import { authCheck } from "../middleware/authMiddleware";
import { UserRole } from "../utils/constants";

const router = express.Router();

// Super Admin only routes
router.post(
    "/create-staff",
    authCheck([UserRole.SUPER_ADMIN, UserRole.VENDOR]),
    adminController.createStaff
);

export default router;
