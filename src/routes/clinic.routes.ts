import express from "express";
import * as clinicController from "../controllers/clinic.controller";
import { authCheck } from "../middleware/authMiddleware";

const router = express.Router();

// Doctor and Assistant can register patients
router.post(
    "/register-patient",
    authCheck(["DOCTOR", "ASSISTANT"]),
    clinicController.registerPatient
);

export default router;
