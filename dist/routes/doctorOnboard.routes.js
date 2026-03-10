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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const authMiddleware_1 = require("../middleware/authMiddleware");
const validate_middleware_1 = require("../middleware/validate.middleware");
const constants_1 = require("../utils/constants");
const doctorOnboard_schemas_1 = require("../schemas/doctorOnboard.schemas");
const doctorOnboardController = __importStar(require("../controllers/doctorOnboard.controller"));
const router = express_1.default.Router();
// ── Vendor Routes ────────────────────────────────────────────────────────
// Vendor submits a doctor onboard request
router.post("/doctor-requests", (0, authMiddleware_1.authCheck)([constants_1.UserRole.VENDOR]), (0, validate_middleware_1.validate)({ body: doctorOnboard_schemas_1.submitDoctorRequestSchema }), doctorOnboardController.submitRequest);
// Vendor views their own requests
router.get("/doctor-requests/my", (0, authMiddleware_1.authCheck)([constants_1.UserRole.VENDOR]), (0, validate_middleware_1.validate)({ query: doctorOnboard_schemas_1.listRequestsQuerySchema }), doctorOnboardController.getMyRequests);
// Vendor gets their assigned doctors (for patient registration dropdown)
router.get("/vendor-doctors/my", (0, authMiddleware_1.authCheck)([constants_1.UserRole.VENDOR]), doctorOnboardController.getVendorDoctors);
// ── SuperAdmin Routes ────────────────────────────────────────────────────
// SuperAdmin views all requests
router.get("/doctor-requests", (0, authMiddleware_1.authCheck)([constants_1.UserRole.SUPER_ADMIN]), (0, validate_middleware_1.validate)({ query: doctorOnboard_schemas_1.listRequestsQuerySchema }), doctorOnboardController.getAllRequests);
// SuperAdmin views a single request
router.get("/doctor-requests/:id", (0, authMiddleware_1.authCheck)([constants_1.UserRole.SUPER_ADMIN]), doctorOnboardController.getRequestById);
// SuperAdmin approves a request
router.post("/doctor-requests/:id/approve", (0, authMiddleware_1.authCheck)([constants_1.UserRole.SUPER_ADMIN]), doctorOnboardController.approveRequest);
// SuperAdmin rejects a request
router.post("/doctor-requests/:id/reject", (0, authMiddleware_1.authCheck)([constants_1.UserRole.SUPER_ADMIN]), (0, validate_middleware_1.validate)({ body: doctorOnboard_schemas_1.rejectRequestSchema }), doctorOnboardController.rejectRequest);
// SuperAdmin assigns an existing doctor to a vendor
router.post("/vendor-doctors/assign", (0, authMiddleware_1.authCheck)([constants_1.UserRole.SUPER_ADMIN]), (0, validate_middleware_1.validate)({ body: doctorOnboard_schemas_1.assignDoctorSchema }), doctorOnboardController.assignDoctorToVendor);
// SuperAdmin removes a doctor-vendor assignment
router.delete("/vendor-doctors/:vendorId/:doctorId", (0, authMiddleware_1.authCheck)([constants_1.UserRole.SUPER_ADMIN]), doctorOnboardController.removeDoctorFromVendor);
// Get doctors assigned to a specific vendor (SuperAdmin or Vendor)
router.get("/vendor-doctors/:vendorId", (0, authMiddleware_1.authCheck)([constants_1.UserRole.SUPER_ADMIN, constants_1.UserRole.VENDOR]), doctorOnboardController.getVendorDoctors);
exports.default = router;
