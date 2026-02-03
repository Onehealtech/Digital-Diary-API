import express from "express";
import authRoutes from "./auth.routes";
import patientRoutes from "./patient.routes";
const router = express.Router();

// Auth routes (your new signup/login)
router.use('/auth', authRoutes);
router.use('/patient', patientRoutes);
export default router;