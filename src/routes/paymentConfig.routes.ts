// src/routes/paymentConfig.routes.ts

import express from "express";
import { authCheck } from "../middleware/authMiddleware";
import { UserRole } from "../utils/constants";
import {
    getPaymentConfig,
    updatePaymentConfig,
} from "../controllers/paymentConfig.controller";

const router = express.Router();

// Super Admin only
router.get("/", authCheck([UserRole.SUPER_ADMIN]), getPaymentConfig);
router.put("/", authCheck([UserRole.SUPER_ADMIN]), updatePaymentConfig);

export default router;
