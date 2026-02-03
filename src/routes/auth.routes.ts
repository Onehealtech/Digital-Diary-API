import { Router } from "express";
import { DoctorAuthController } from "../controllers/auth.controller";

const router = Router();

router.post("/register", DoctorAuthController.register);
router.post("/login", DoctorAuthController.login);

export default router;
