import { Router } from "express";

import { editTemplate, getAllTemplates, getSingleTemplate, removeTemplate, uploadTemplate } from "../controllers/diary-template.controller";
import { authCheck } from "../middleware/authMiddleware";
import { UserRole } from "../utils/constants";

const router = Router();

// List all active templates (any authenticated user — for dropdowns)
router.get("/", getAllTemplates);
// Get single template with full JSON
router.get("/:templateType", getSingleTemplate);

// SuperAdmin only
router.post("/" ,authCheck([UserRole.SUPER_ADMIN]), uploadTemplate);
router.put("/:templateId", authCheck([UserRole.SUPER_ADMIN]), editTemplate);
router.delete("/:templateId", authCheck([UserRole.SUPER_ADMIN]), removeTemplate);

export default router;