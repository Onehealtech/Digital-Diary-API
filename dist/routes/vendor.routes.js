"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const vendor_controller_1 = require("../controllers/vendor.controller");
const dashboardController = __importStar(require("../controllers/dashboard.controller"));
const authMiddleware_1 = require("../middleware/authMiddleware");
const validate_middleware_1 = require("../middleware/validate.middleware");
const constants_1 = require("../utils/constants");
const staff_schemas_1 = require("../schemas/staff.schemas");
const router = (0, express_1.Router)();
const vendorController = new vendor_controller_1.VendorController();
/**
 * Vendor Management Routes
 * Base path: /api/v1/vendors
 */
// GET /api/v1/vendors/patients - Vendor can view all patients (from main)
router.get("/patients", (0, authMiddleware_1.authCheck)([constants_1.UserRole.VENDOR]), dashboardController.getPatients);
// GET /api/v1/vendors - List all vendors
router.get("/", (0, authMiddleware_1.authCheck)([constants_1.UserRole.SUPER_ADMIN, constants_1.UserRole.VENDOR]), vendorController.getAllVendors.bind(vendorController));
// GET /api/v1/vendors/:id - Get vendor by ID
router.get("/:id", (0, authMiddleware_1.authCheck)([constants_1.UserRole.SUPER_ADMIN, constants_1.UserRole.VENDOR]), vendorController.getVendorById.bind(vendorController));
// POST /api/v1/vendors - Create new vendor (SUPER_ADMIN only)
router.post("/", (0, authMiddleware_1.authCheck)([constants_1.UserRole.SUPER_ADMIN]), (0, validate_middleware_1.validate)({ body: staff_schemas_1.createVendorSchema }), vendorController.createVendor.bind(vendorController));
// PUT /api/v1/vendors/:id - Update vendor
router.put("/:id", (0, authMiddleware_1.authCheck)([constants_1.UserRole.SUPER_ADMIN, constants_1.UserRole.VENDOR]), vendorController.updateVendor.bind(vendorController));
// GET /api/v1/vendors/:id/wallet - Get vendor wallet
router.get("/:id/wallet", (0, authMiddleware_1.authCheck)([constants_1.UserRole.SUPER_ADMIN, constants_1.UserRole.VENDOR]), vendorController.getVendorWallet.bind(vendorController));
// POST /api/v1/vendors/:id/wallet/transfer - Transfer funds (SUPER_ADMIN only)
router.post("/:id/wallet/transfer", (0, authMiddleware_1.authCheck)([constants_1.UserRole.SUPER_ADMIN]), vendorController.transferFunds.bind(vendorController));
// GET /api/v1/vendors/:id/sales - Get sales history
router.get("/:id/sales", (0, authMiddleware_1.authCheck)([constants_1.UserRole.SUPER_ADMIN, constants_1.UserRole.VENDOR]), vendorController.getVendorSales.bind(vendorController));
// PUT /api/v1/vendors/:id/sales/:diaryId/mark-transferred - Mark fund as transferred
router.put("/:id/sales/:diaryId/mark-transferred", (0, authMiddleware_1.authCheck)([constants_1.UserRole.VENDOR]), vendorController.markFundTransferred.bind(vendorController));
// GET /api/v1/vendors/:id/inventory - Get assigned diaries
router.get("/:id/inventory", (0, authMiddleware_1.authCheck)([constants_1.UserRole.SUPER_ADMIN, constants_1.UserRole.VENDOR]), vendorController.getVendorInventory.bind(vendorController));
// POST /api/v1/vendors/:id/sell-diary - Sell diary to patient
router.post("/:id/sell-diary", (0, authMiddleware_1.authCheck)([constants_1.UserRole.VENDOR]), vendorController.sellDiary.bind(vendorController));
// GET /api/v1/vendors/:id/dashboard - Get vendor dashboard stats
router.get("/:id/dashboard", (0, authMiddleware_1.authCheck)([constants_1.UserRole.SUPER_ADMIN, constants_1.UserRole.VENDOR]), vendorController.getVendorDashboard.bind(vendorController));
exports.default = router;
