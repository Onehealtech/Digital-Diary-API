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
const clinicController = __importStar(require("../controllers/clinic.controller"));
const reminder_controller_1 = require("../controllers/reminder.controller");
const authMiddleware_1 = require("../middleware/authMiddleware");
const validate_middleware_1 = require("../middleware/validate.middleware");
const constants_1 = require("../utils/constants");
const staff_schemas_1 = require("../schemas/staff.schemas");
const upload_middleware_1 = require("../middleware/upload.middleware");
const router = express_1.default.Router();
// Doctor and Assistant can register patients
router.post("/register-patient", (0, authMiddleware_1.authCheck)([constants_1.UserRole.DOCTOR, constants_1.UserRole.ASSISTANT]), (0, validate_middleware_1.validate)({ body: staff_schemas_1.registerPatientSchema }), clinicController.registerPatient);
// Doctor and Assistant can create reminders
router.post("/create-reminder", (0, authMiddleware_1.authCheck)([constants_1.UserRole.DOCTOR, constants_1.UserRole.ASSISTANT]), upload_middleware_1.notificationAttachmentUpload.single("attachment"), reminder_controller_1.createReminder);
router.get("/patients/:patientId", (0, authMiddleware_1.authCheck)([constants_1.UserRole.DOCTOR, constants_1.UserRole.ASSISTANT]), reminder_controller_1.getPatientRemindersforadmin);
// Doctor and Assistant can resend an existing reminder
router.post("/reminders/:id/resend", (0, authMiddleware_1.authCheck)([constants_1.UserRole.DOCTOR, constants_1.UserRole.ASSISTANT]), reminder_controller_1.resendReminder);
exports.default = router;
