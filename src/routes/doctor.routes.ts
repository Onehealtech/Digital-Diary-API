import express from "express";
import * as doctorController from "../controllers/doctor.controller";
import { authCheck } from "../middleware/authMiddleware";
import { UserRole } from "../utils/constants";

const router = express.Router();

// Doctor only routes
router.post(
    "/create-assistant",
    authCheck([UserRole.DOCTOR]),
    doctorController.createAssistant
);

export default router;
