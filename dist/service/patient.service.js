"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.patientService = void 0;
const Patient_1 = require("../models/Patient");
const Diary_1 = require("../models/Diary");
const ScanLog_1 = require("../models/ScanLog");
const Appuser_1 = require("../models/Appuser");
const DoctorPatientHistory_1 = require("../models/DoctorPatientHistory");
const sequelize_1 = require("sequelize");
class PatientService {
    /**
     * Get patient by ID with full details.
     * Current doctor sees ALL scan data from the start.
     * Old doctor sees scan data only up to their unassignment date.
     */
    async getPatientById(patientId, requesterId, role) {
        let doctorId = null;
        // Role-based access resolution
        if (role === "DOCTOR") {
            doctorId = requesterId;
        }
        else if (role === "ASSISTANT") {
            const assistant = await Appuser_1.AppUser.findByPk(requesterId);
            if (!assistant || !assistant.parentId) {
                throw new Error("Assistant not linked to a doctor");
            }
            doctorId = assistant.parentId;
        }
        // For doctors/assistants: check current or historical access
        let dateCutoff = null;
        if (doctorId) {
            const patient = await Patient_1.Patient.findByPk(patientId, { attributes: ["doctorId"] });
            if (patient && patient.doctorId === doctorId) {
                // Current doctor — full access, no cutoff
            }
            else {
                // Check history for old doctor
                const history = await DoctorPatientHistory_1.DoctorPatientHistory.findOne({
                    where: { patientId, doctorId, unassignedAt: { [sequelize_1.Op.ne]: null } },
                    order: [["unassignedAt", "DESC"]],
                });
                if (!history) {
                    throw new Error("Patient not found or access denied");
                }
                dateCutoff = history.unassignedAt;
            }
        }
        // Build patient query (no doctorId filter — access already validated above)
        const whereClause = { id: patientId };
        if (role === "VENDOR") {
            whereClause.vendorId = requesterId;
        }
        const patientRecord = await Patient_1.Patient.findOne({
            where: whereClause,
            include: [
                {
                    model: Appuser_1.AppUser,
                    as: "doctor",
                    attributes: ["id", "fullName", "email", "phone"],
                },
                {
                    model: Diary_1.Diary,
                    as: "diary",
                    attributes: ["id", "status", "saleAmount", "activationDate"],
                },
            ],
        });
        if (!patientRecord) {
            throw new Error("Patient not found or access denied");
        }
        // Build scan log filter (apply date cutoff for old doctors)
        const scanWhere = { patientId };
        if (dateCutoff) {
            scanWhere.scannedAt = { [sequelize_1.Op.lte]: dateCutoff };
        }
        const totalScans = await ScanLog_1.ScanLog.count({ where: scanWhere });
        const unreviewed = await ScanLog_1.ScanLog.count({
            where: { ...scanWhere, doctorReviewed: false },
        });
        const flagged = await ScanLog_1.ScanLog.count({
            where: { ...scanWhere, flagged: true },
        });
        const recentScans = await ScanLog_1.ScanLog.findAll({
            where: scanWhere,
            order: [["createdAt", "DESC"]],
            limit: 5,
            attributes: ["id", "pageType", "doctorReviewed", "flagged", "createdAt"],
        });
        const patientJson = patientRecord.toJSON();
        return {
            ...patientJson,
            isCurrentDoctor: !dateCutoff,
            assignmentCutoff: dateCutoff,
            // Old doctor sees "DOCTOR_REASSIGNED" status
            status: dateCutoff ? "DOCTOR_REASSIGNED" : patientJson.status,
            scanStats: {
                total: totalScans,
                unreviewed,
                flagged,
            },
            recentScans,
        };
    }
    /**
     * Update patient details
     */
    async updatePatient(patientId, requesterId, role, updates) {
        // Find patient with role-based filtering
        const whereClause = { id: patientId };
        if (role === "DOCTOR") {
            whereClause.doctorId = requesterId;
        }
        else if (role === "ASSISTANT") {
            const assistant = await Appuser_1.AppUser.findByPk(requesterId);
            if (!assistant || !assistant.parentId) {
                throw new Error("Assistant not linked to a doctor");
            }
            whereClause.doctorId = assistant.parentId;
        }
        else {
            throw new Error("Only doctors and assistants can update patient details");
        }
        const patient = await Patient_1.Patient.findOne({ where: whereClause });
        if (!patient) {
            throw new Error("Patient not found or access denied");
        }
        // Restrict what can be updated
        const allowedUpdates = [
            "name",
            "phoneNumber",
            "address",
            "age",
            "gender",
            "stage",
            "treatmentPlan",
            "language",
        ];
        const updateData = {};
        for (const key of allowedUpdates) {
            if (updates[key] !== undefined) {
                updateData[key] = updates[key];
            }
        }
        await patient.update(updateData);
        return patient;
    }
    /**
     * Prescribe tests to a patient
     */
    async prescribeTests(patientId, doctorId, tests) {
        const patient = await Patient_1.Patient.findOne({
            where: { id: patientId, doctorId },
        });
        if (!patient) {
            throw new Error("Patient not found");
        }
        // Get current prescribed tests
        const currentTests = patient.prescribedTests || [];
        // Add new tests
        const newTests = tests.map((test) => ({
            testName: test.testName,
            testType: test.testType,
            prescribedDate: test.prescribedDate || new Date(),
            completed: false,
            reportReceived: false,
        }));
        const updatedTests = [...currentTests, ...newTests];
        // Update patient
        await patient.update({
            prescribedTests: updatedTests,
            totalTestsPrescribed: updatedTests.length,
        });
        // Recalculate test completion percentage
        await this.updateTestCompletionPercentage(patientId);
        return patient;
    }
    /**
     * Update test status (completed, report received)
     */
    async updateTestStatus(patientId, doctorId, updates) {
        const patient = await Patient_1.Patient.findOne({
            where: { id: patientId, doctorId },
        });
        if (!patient) {
            throw new Error("Patient not found");
        }
        const prescribedTests = patient.prescribedTests || [];
        // Find the test and update it
        const testIndex = prescribedTests.findIndex((test) => test.testName === updates.testName);
        if (testIndex === -1) {
            throw new Error("Test not found in patient's prescribed tests");
        }
        if (updates.completed !== undefined) {
            prescribedTests[testIndex].completed = updates.completed;
            prescribedTests[testIndex].completedDate = updates.completedDate || new Date();
        }
        if (updates.reportReceived !== undefined) {
            prescribedTests[testIndex].reportReceived = updates.reportReceived;
            prescribedTests[testIndex].reportReceivedDate =
                updates.reportReceivedDate || new Date();
        }
        await patient.update({
            prescribedTests,
        });
        // Recalculate test stats
        await this.updateTestCompletionPercentage(patientId);
        return patient;
    }
    /**
     * Log a call attempt to a patient
     */
    async logCallAttempt(patientId, requesterId, role, callData) {
        // Verify access
        const whereClause = { id: patientId };
        if (role === "DOCTOR") {
            whereClause.doctorId = requesterId;
        }
        else if (role === "ASSISTANT") {
            const assistant = await Appuser_1.AppUser.findByPk(requesterId);
            if (!assistant || !assistant.parentId) {
                throw new Error("Assistant not linked to a doctor");
            }
            whereClause.doctorId = assistant.parentId;
        }
        else {
            throw new Error("Only doctors and assistants can log call attempts");
        }
        const patient = await Patient_1.Patient.findOne({ where: whereClause });
        if (!patient) {
            throw new Error("Patient not found or access denied");
        }
        // Update last contact date
        await patient.update({
            lastDoctorContact: callData.callDate || new Date(),
        });
        // Create a call log entry (we could create a CallLog model later, for now just update patient)
        // In the future, you might want to create a separate CallLog model
        return {
            patientId: patient.id,
            patientName: patient.fullName,
            callDate: callData.callDate || new Date(),
            outcome: callData.outcome,
            notes: callData.notes,
            followUpRequired: callData.followUpRequired,
            followUpDate: callData.followUpDate,
            lastDoctorContact: patient.lastDoctorContact,
        };
    }
    /**
     * Get test progress for a patient
     */
    async getTestProgress(patientId, requesterId, role) {
        const whereClause = { id: patientId };
        if (role === "DOCTOR") {
            whereClause.doctorId = requesterId;
        }
        else if (role === "ASSISTANT") {
            const assistant = await Appuser_1.AppUser.findByPk(requesterId);
            if (!assistant || !assistant.parentId) {
                throw new Error("Assistant not linked to a doctor");
            }
            whereClause.doctorId = assistant.parentId;
        }
        const patient = await Patient_1.Patient.findOne({ where: whereClause });
        if (!patient) {
            throw new Error("Patient not found or access denied");
        }
        const prescribedTests = patient.prescribedTests || [];
        const completed = prescribedTests.filter((test) => test.completed).length;
        const reportsReceived = prescribedTests.filter((test) => test.reportReceived).length;
        return {
            patientId: patient.id,
            patientName: patient.fullName,
            totalTestsPrescribed: patient.totalTestsPrescribed,
            testsCompleted: completed,
            reportsReceived,
            testCompletionPercentage: patient.testCompletionPercentage,
            prescribedTests,
            canStartTreatment: patient.testCompletionPercentage >= 70 && reportsReceived >= 5, // Example logic
        };
    }
    /**
     * Helper: Update test completion percentage
     */
    async updateTestCompletionPercentage(patientId) {
        const patient = await Patient_1.Patient.findByPk(patientId);
        if (!patient) {
            return;
        }
        const prescribedTests = patient.prescribedTests || [];
        const total = prescribedTests.length;
        if (total === 0) {
            await patient.update({
                testsCompleted: 0,
                reportsReceived: 0,
                testCompletionPercentage: 0,
            });
            return;
        }
        const completed = prescribedTests.filter((test) => test.completed).length;
        const reportsReceived = prescribedTests.filter((test) => test.reportReceived).length;
        const percentage = Math.round((reportsReceived / total) * 100);
        await patient.update({
            testsCompleted: completed,
            reportsReceived,
            testCompletionPercentage: percentage,
        });
    }
    /**
     * Deactivate a patient — sets status to INACTIVE with reason.
     */
    async deactivatePatient(patientId, requesterId, role, reason) {
        const whereClause = { id: patientId };
        if (role === "DOCTOR") {
            whereClause.doctorId = requesterId;
        }
        else if (role === "ASSISTANT") {
            const assistant = await Appuser_1.AppUser.findByPk(requesterId);
            if (!assistant || !assistant.parentId) {
                throw new Error("Assistant not linked to a doctor");
            }
            whereClause.doctorId = assistant.parentId;
        }
        else {
            throw new Error("Only doctors and assistants can deactivate patients");
        }
        const patient = await Patient_1.Patient.findOne({ where: whereClause });
        if (!patient) {
            throw new Error("Patient not found or access denied");
        }
        if (patient.status === "INACTIVE") {
            throw new Error("Patient is already inactive");
        }
        await patient.update({
            status: "INACTIVE",
            deactivationReason: reason,
            deactivatedAt: new Date(),
            deactivatedBy: requesterId,
        });
        return patient;
    }
    /**
     * Put a patient on hold — sets status to ON_HOLD (no reason required).
     */
    async putPatientOnHold(patientId, requesterId, role) {
        const whereClause = { id: patientId };
        if (role === "DOCTOR") {
            whereClause.doctorId = requesterId;
        }
        else if (role === "ASSISTANT") {
            const assistant = await Appuser_1.AppUser.findByPk(requesterId);
            if (!assistant || !assistant.parentId) {
                throw new Error("Assistant not linked to a doctor");
            }
            whereClause.doctorId = assistant.parentId;
        }
        else {
            throw new Error("Only doctors and assistants can put patients on hold");
        }
        const patient = await Patient_1.Patient.findOne({ where: whereClause });
        if (!patient) {
            throw new Error("Patient not found or access denied");
        }
        if (patient.status === "ON_HOLD") {
            throw new Error("Patient is already on hold");
        }
        await patient.update({
            status: "ON_HOLD",
            deactivatedAt: new Date(),
            deactivatedBy: requesterId,
        });
        return patient;
    }
    /**
     * Reactivate an inactive/on-hold patient — sets status back to ACTIVE.
     */
    async activatePatient(patientId, requesterId, role) {
        const whereClause = { id: patientId };
        if (role === "DOCTOR") {
            whereClause.doctorId = requesterId;
        }
        else if (role === "ASSISTANT") {
            const assistant = await Appuser_1.AppUser.findByPk(requesterId);
            if (!assistant || !assistant.parentId) {
                throw new Error("Assistant not linked to a doctor");
            }
            whereClause.doctorId = assistant.parentId;
        }
        else {
            throw new Error("Only doctors and assistants can activate patients");
        }
        const patient = await Patient_1.Patient.findOne({ where: whereClause });
        if (!patient) {
            throw new Error("Patient not found or access denied");
        }
        if (patient.status !== "INACTIVE" && patient.status !== "ON_HOLD") {
            throw new Error("Patient is not inactive or on hold");
        }
        await patient.update({
            status: "ACTIVE",
            deactivationReason: null,
            deactivatedAt: null,
            deactivatedBy: null,
        });
        return patient;
    }
    /**
     * Get patients needing follow-up
     * (No recent contact or incomplete tests)
     */
    async getPatientsNeedingFollowUp(doctorId) {
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        const patients = await Patient_1.Patient.findAll({
            where: {
                doctorId,
                [sequelize_1.Op.or]: [
                    // No recent contact
                    {
                        lastDoctorContact: {
                            [sequelize_1.Op.or]: [{ [sequelize_1.Op.is]: null }, { [sequelize_1.Op.lt]: sevenDaysAgo }],
                        },
                    },
                    // Incomplete tests
                    {
                        totalTestsPrescribed: { [sequelize_1.Op.gt]: 0 },
                        testCompletionPercentage: { [sequelize_1.Op.lt]: 100 },
                    },
                ],
            },
            attributes: [
                "id",
                "fullName",
                "phone",
                "lastDoctorContact",
                "totalTestsPrescribed",
                "testCompletionPercentage",
            ],
            order: [["lastDoctorContact", "ASC"]],
        });
        return patients;
    }
}
exports.patientService = new PatientService();
