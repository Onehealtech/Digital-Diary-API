"use strict";
// src/routes/paymentConfig.routes.ts
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const authMiddleware_1 = require("../middleware/authMiddleware");
const constants_1 = require("../utils/constants");
const paymentConfig_controller_1 = require("../controllers/paymentConfig.controller");
const router = express_1.default.Router();
// Super Admin only
router.get("/", (0, authMiddleware_1.authCheck)([constants_1.UserRole.SUPER_ADMIN]), paymentConfig_controller_1.getPaymentConfig);
router.put("/", (0, authMiddleware_1.authCheck)([constants_1.UserRole.SUPER_ADMIN]), paymentConfig_controller_1.updatePaymentConfig);
exports.default = router;
