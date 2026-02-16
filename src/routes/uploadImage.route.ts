import express from "express";

import { authCheck } from "../middleware/authMiddleware";
import { UserRole } from "../utils/constants";
import { getImageHistory, uploadImage } from "../controllers/upload.controller";
import { upload } from "../middleware/upload.middleware";

const router = express.Router();

// Super Admin only routes
router.post(
    "/:id",
    upload.single("image"),
    // authCheck([UserRole.SUPER_ADMIN]),
    uploadImage
);
router.get(
    "/image-history/:id",
    // authCheck([UserRole.SUPER_ADMIN]),
    getImageHistory
);

export default router;
