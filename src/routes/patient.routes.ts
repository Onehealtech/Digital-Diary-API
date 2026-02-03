import { Router } from "express";
import { createPatient, getDoctorPatients } from "../controllers/patient.controller";
import { authCheck } from "../middleware/authMiddleware";

const router = Router();

router.post("/", authCheck(["doctor"]), createPatient);
router.get("/getAllPatients", authCheck(["doctor"]), getDoctorPatients);
export default router;
