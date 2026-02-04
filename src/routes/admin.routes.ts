import express from "express";
import * as adminController from "../controllers/admin.controller";
import { authCheck } from "../middleware/authMiddleware";

const router = express.Router();

// Super Admin only routes
router.post(
    "/create-staff",
    authCheck(["SUPER_ADMIN"]),
    adminController.createStaff
);

export default router;
