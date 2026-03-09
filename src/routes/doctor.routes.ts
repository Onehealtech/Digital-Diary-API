import express from "express";
import * as doctorController from "../controllers/doctor.controller";
import { authCheck } from "../middleware/authMiddleware";
import { validate } from "../middleware/validate.middleware";
import { UserRole } from "../utils/constants";
import { createAssistantSchema } from "../schemas/staff.schemas";

const router = express.Router();

// Doctor only routes
router.post(
    "/create-assistant",
    authCheck([UserRole.DOCTOR]),
    validate({ body: createAssistantSchema }),
    doctorController.createAssistant
);

export default router;
