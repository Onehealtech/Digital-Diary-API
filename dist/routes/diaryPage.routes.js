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
const constants_1 = require("../utils/constants");
const diaryPageController = __importStar(require("../controllers/diaryPage.controller"));
const router = express_1.default.Router();
// Get all diary pages with questions (patient app uses this for manual entry)
router.get("/", authMiddleware_1.patientAuthCheck, diaryPageController.getAllDiaryPages);
// Get all diary pages (doctor/assistant access for viewing patient submissions)
router.get("/staff/all", (0, authMiddleware_1.authCheck)([constants_1.UserRole.DOCTOR, constants_1.UserRole.ASSISTANT]), diaryPageController.getAllDiaryPagesStaff);
// Get a single diary page by page number
router.get("/:pageNumber", authMiddleware_1.patientAuthCheck, diaryPageController.getDiaryPageByNumber);
// Seed diary pages (super admin only)
router.post("/seed", (0, authMiddleware_1.authCheck)([constants_1.UserRole.SUPER_ADMIN]), diaryPageController.seedDiaryPages);
exports.default = router;
