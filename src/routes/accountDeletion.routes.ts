// src/routes/accountDeletion.routes.ts

import express from "express";
import { patientAuthCheck } from "../middleware/authMiddleware";
import * as controller from "../controllers/accountDeletion.controller";

const router = express.Router();

// POST /api/v1/account/request-delete-otp — Step 1: send OTP before deletion
router.post("/request-delete-otp", patientAuthCheck, controller.requestDeleteOTP);

// DELETE /api/v1/account/delete — Step 2: verify OTP and delete account
router.delete("/delete", patientAuthCheck, controller.deleteAccount);

export default router;
