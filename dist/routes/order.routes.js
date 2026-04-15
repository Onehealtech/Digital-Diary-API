"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const authMiddleware_1 = require("../middleware/authMiddleware");
const constants_1 = require("../utils/constants");
const order_controller_1 = require("../controllers/order.controller");
const router = express_1.default.Router();
// Super Admin only routes
router.post("/create", (0, authMiddleware_1.authCheck)([constants_1.UserRole.SUPER_ADMIN, constants_1.UserRole.VENDOR, constants_1.UserRole.DOCTOR, constants_1.UserRole.ASSISTANT]), order_controller_1.createOrder);
router.get("/orderStatus/:orderId", order_controller_1.getOrderStatus);
exports.default = router;
