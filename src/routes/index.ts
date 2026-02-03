import express from "express";
import authRoutes from "./auth.routes";
const router = express.Router();

// Auth routes (your new signup/login)
router.use('/auth', authRoutes);
export default router;