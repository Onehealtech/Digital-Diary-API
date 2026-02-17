import express from "express";

import { authCheck } from "../middleware/authMiddleware";
import { UserRole } from "../utils/constants";
import { createOrder, getOrderStatus } from "../controllers/order.controller";
const router = express.Router();

// Super Admin only routes
router.post(
    "/create",
    authCheck([UserRole.SUPER_ADMIN, UserRole.DOCTOR]),
    createOrder
);
router.get(
    "/orderStatus/:orderId",
    getOrderStatus
);

export default router;
