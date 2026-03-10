"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createAssistant = void 0;
const Appuser_1 = require("../models/Appuser");
const passwordUtils_1 = require("../utils/passwordUtils");
const emailService_1 = require("../service/emailService");
const activityLogger_1 = require("../utils/activityLogger");
/**
 * POST /api/v1/doctor/create-assistant
 * Doctor creates an Assistant linked to them via parentId
 */
const createAssistant = async (req, res) => {
    try {
        const { fullName, email, phone } = req.body;
        // Validate required fields
        if (!fullName || !email) {
            res.status(400).json({
                success: false,
                message: "Full name and email are required",
            });
            return;
        }
        // Check if user already exists
        const existingUser = await Appuser_1.AppUser.findOne({
            where: { email: email.toLowerCase() },
        });
        if (existingUser) {
            res.status(409).json({
                success: false,
                message: "User with this email already exists",
            });
            return;
        }
        // Generate secure password
        const plainPassword = (0, passwordUtils_1.generateSecurePassword)();
        // Create Assistant with parentId set to the Doctor's ID
        const newAssistant = await Appuser_1.AppUser.create({
            fullName,
            email: email.toLowerCase(),
            password: plainPassword,
            phone,
            role: "ASSISTANT",
            parentId: req.user.id,
            isEmailVerified: false,
            assistantStatus: "ACTIVE",
            patientAccessMode: "all",
            assignedPatientIds: [],
            permissions: {
                viewPatients: true,
                callPatients: true,
                exportData: false,
                sendNotifications: false,
            },
        });
        // Send password email
        await (0, emailService_1.sendPasswordEmail)(email, plainPassword, "ASSISTANT", fullName);
        (0, activityLogger_1.logActivity)({
            req,
            userId: req.user.id,
            userRole: "DOCTOR",
            action: "ASSISTANT_CREATED",
            details: { assistantId: newAssistant.id, email: newAssistant.email },
        });
        res.status(201).json({
            success: true,
            message: `Assistant created successfully. Credentials sent to ${email}`,
            data: {
                id: newAssistant.id,
                fullName: newAssistant.fullName,
                email: newAssistant.email,
                role: newAssistant.role,
                parentId: newAssistant.parentId,
            },
        });
    }
    catch (error) {
        console.error("Create assistant error:", error);
        res.status(500).json({
            success: false,
            message: error.message || "Failed to create assistant",
        });
    }
};
exports.createAssistant = createAssistant;
