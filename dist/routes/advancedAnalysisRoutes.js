"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const authMiddleware_1 = require("../middleware/authMiddleware");
const constants_1 = require("../utils/constants");
const advancedAnalysisController_1 = require("../controllers/advancedAnalysisController");
const router = express_1.default.Router();
router.post("/patients", (0, authMiddleware_1.authCheck)([constants_1.UserRole.DOCTOR, constants_1.UserRole.ASSISTANT]), advancedAnalysisController_1.getAdvancedAnalysisPatients);
router.post("/count", (0, authMiddleware_1.authCheck)([constants_1.UserRole.DOCTOR, constants_1.UserRole.ASSISTANT]), advancedAnalysisController_1.getAdvancedAnalysisCount);
router.post("/sync-sheet", (0, authMiddleware_1.authCheck)([constants_1.UserRole.DOCTOR, constants_1.UserRole.ASSISTANT]), advancedAnalysisController_1.syncAnalyticsGoogleSheet);
exports.default = router;
