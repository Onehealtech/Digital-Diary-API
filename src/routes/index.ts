import express from "express";
import authRoutes from "./auth.routes";
import adminRoutes from "./admin.routes";
import doctorRoutes from "./doctor.routes";
import clinicRoutes from "./clinic.routes";
import dashboardRoutes from "./dashboard.routes";
import scanRoutes from "./scan.routes";
import patientRoutes from "./patient.routes";

const router = express.Router();

// API v1 Routes
router.use("/v1", authRoutes);           // Auth routes (staff & patient login)
router.use("/v1/admin", adminRoutes);     // Super Admin routes
router.use("/v1/doctor", doctorRoutes);   // Doctor routes
router.use("/v1/clinic", clinicRoutes);   // Clinic routes (patient registration)
router.use("/v1/dashboard", dashboardRoutes); // Dashboard routes
router.use("/v1/scan", scanRoutes);       // Scan routes (patient symptom logging)
router.use("/v1/patient", patientRoutes); // Patient routes (profile, reminders)

export default router;