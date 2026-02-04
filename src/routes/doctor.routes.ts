import express from "express";
import * as doctorController from "../controllers/doctor.controller";
import { authCheck } from "../middleware/authMiddleware";

const router = express.Router();

// Doctor only routes
router.post(
    "/create-assistant",
    authCheck(["DOCTOR"]),
    doctorController.createAssistant
);

export default router;
