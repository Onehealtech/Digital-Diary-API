// src/routes/accountDeletion.routes.ts

import express from "express";
import { patientAuthCheck } from "../middleware/authMiddleware";
import * as controller from "../controllers/accountDeletion.controller";

const router = express.Router();

// DELETE /api/v1/account/delete — patient deletes their own account
router.delete("/delete", patientAuthCheck, controller.deleteAccount);

export default router;
