"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getVendorDoctors = exports.removeDoctorFromVendor = exports.assignDoctorToVendor = exports.rejectRequest = exports.approveRequest = exports.checkDuplicateDoctor = exports.getRequestById = exports.getAllRequests = exports.getMyRequests = exports.submitRequest = void 0;
const AppError_1 = require("../utils/AppError");
const doctorOnboard_service_1 = require("../service/doctorOnboard.service");
const activityLogger_1 = require("../utils/activityLogger");
/**
 * Vendor submits a doctor onboard request
 */
const submitRequest = async (req, res) => {
    try {
        const vendorId = req.user.id;
        const request = await doctorOnboard_service_1.doctorOnboardService.submitRequest(vendorId, req.body);
        (0, activityLogger_1.logActivity)({
            req,
            userId: vendorId,
            userRole: req.user.role,
            action: "DOCTOR_ONBOARD_REQUEST_SUBMITTED",
            details: { requestId: request.id, doctorEmail: req.body.email },
        });
        res.status(201).json({
            success: true,
            message: "Doctor onboard request submitted. Awaiting Super Admin approval.",
            data: request,
        });
    }
    catch (error) {
        if (error instanceof AppError_1.AppError) {
            res.status(error.statusCode).json({ success: false, message: error.message });
            return;
        }
        const message = error instanceof Error ? error.message : "Internal server error";
        console.error("Submit doctor request error:", message);
        res.status(500).json({ success: false, message: "Failed to submit doctor onboard request" });
    }
};
exports.submitRequest = submitRequest;
/**
 * Vendor views their own requests
 */
const getMyRequests = async (req, res) => {
    try {
        const vendorId = req.user.id;
        const query = (res.locals.validatedQuery ?? req.query);
        const result = await doctorOnboard_service_1.doctorOnboardService.getRequestsForVendor(vendorId, query);
        res.status(200).json({ success: true, data: result });
    }
    catch (error) {
        if (error instanceof AppError_1.AppError) {
            res.status(error.statusCode).json({ success: false, message: error.message });
            return;
        }
        console.error("Get my requests error:", error);
        res.status(500).json({ success: false, message: "Failed to fetch requests" });
    }
};
exports.getMyRequests = getMyRequests;
/**
 * SuperAdmin views all requests
 */
const getAllRequests = async (req, res) => {
    try {
        const query = (res.locals.validatedQuery ?? req.query);
        const result = await doctorOnboard_service_1.doctorOnboardService.getAllRequests(query);
        res.status(200).json({ success: true, data: result });
    }
    catch (error) {
        if (error instanceof AppError_1.AppError) {
            res.status(error.statusCode).json({ success: false, message: error.message });
            return;
        }
        console.error("Get all requests error:", error);
        res.status(500).json({ success: false, message: "Failed to fetch requests" });
    }
};
exports.getAllRequests = getAllRequests;
/**
 * SuperAdmin views a single request
 */
const getRequestById = async (req, res) => {
    try {
        const result = await doctorOnboard_service_1.doctorOnboardService.getRequestById(req.params.id);
        res.status(200).json({ success: true, data: result });
    }
    catch (error) {
        if (error instanceof AppError_1.AppError) {
            res.status(error.statusCode).json({ success: false, message: error.message });
            return;
        }
        console.error("Get request by id error:", error);
        res.status(500).json({ success: false, message: "Failed to fetch request" });
    }
};
exports.getRequestById = getRequestById;
/**
 * SuperAdmin checks for duplicate doctors matching a request
 */
const checkDuplicateDoctor = async (req, res) => {
    try {
        const requestId = req.params.id;
        const result = await doctorOnboard_service_1.doctorOnboardService.checkDuplicateDoctor(requestId);
        res.status(200).json({ success: true, data: result });
    }
    catch (error) {
        if (error instanceof AppError_1.AppError) {
            res.status(error.statusCode).json({ success: false, message: error.message });
            return;
        }
        console.error("Check duplicate doctor error:", error);
        res.status(500).json({ success: false, message: "Failed to check for duplicate doctors" });
    }
};
exports.checkDuplicateDoctor = checkDuplicateDoctor;
/**
 * SuperAdmin approves a doctor onboard request
 */
const approveRequest = async (req, res) => {
    try {
        const reviewerId = req.user.id;
        const requestId = req.params.id;
        const result = await doctorOnboard_service_1.doctorOnboardService.approveRequest(requestId, reviewerId);
        (0, activityLogger_1.logActivity)({
            req,
            userId: reviewerId,
            userRole: req.user.role,
            action: "DOCTOR_ONBOARD_REQUEST_APPROVED",
            details: { requestId, doctorId: result.doctor.id, vendorId: result.vendorId },
        });
        res.status(200).json({
            success: true,
            message: "Doctor onboard request approved. Doctor account created and assigned to vendor.",
            data: result,
        });
    }
    catch (error) {
        if (error instanceof AppError_1.AppError) {
            res.status(error.statusCode).json({ success: false, message: error.message });
            return;
        }
        const message = error instanceof Error ? error.message : "Internal server error";
        console.error("Approve request error:", message);
        res.status(500).json({ success: false, message: "Failed to approve request" });
    }
};
exports.approveRequest = approveRequest;
/**
 * SuperAdmin rejects a doctor onboard request
 */
const rejectRequest = async (req, res) => {
    try {
        const reviewerId = req.user.id;
        const { rejectionReason } = req.body;
        const requestId = req.params.id;
        const result = await doctorOnboard_service_1.doctorOnboardService.rejectRequest(requestId, reviewerId, rejectionReason);
        (0, activityLogger_1.logActivity)({
            req,
            userId: reviewerId,
            userRole: req.user.role,
            action: "DOCTOR_ONBOARD_REQUEST_REJECTED",
            details: { requestId, rejectionReason },
        });
        res.status(200).json({
            success: true,
            message: "Doctor onboard request rejected.",
            data: result,
        });
    }
    catch (error) {
        if (error instanceof AppError_1.AppError) {
            res.status(error.statusCode).json({ success: false, message: error.message });
            return;
        }
        console.error("Reject request error:", error);
        res.status(500).json({ success: false, message: "Failed to reject request" });
    }
};
exports.rejectRequest = rejectRequest;
/**
 * SuperAdmin assigns an existing doctor to a vendor
 */
const assignDoctorToVendor = async (req, res) => {
    try {
        const assignedBy = req.user.id;
        const { vendorId, doctorId } = req.body;
        const result = await doctorOnboard_service_1.doctorOnboardService.assignDoctorToVendor(vendorId, doctorId, assignedBy);
        (0, activityLogger_1.logActivity)({
            req,
            userId: assignedBy,
            userRole: req.user.role,
            action: "DOCTOR_ASSIGNED_TO_VENDOR",
            details: { vendorId, doctorId },
        });
        res.status(201).json({
            success: true,
            message: `Doctor ${result.doctorName} assigned to vendor ${result.vendorName}.`,
            data: result,
        });
    }
    catch (error) {
        if (error instanceof AppError_1.AppError) {
            res.status(error.statusCode).json({ success: false, message: error.message });
            return;
        }
        console.error("Assign doctor error:", error);
        res.status(500).json({ success: false, message: "Failed to assign doctor to vendor" });
    }
};
exports.assignDoctorToVendor = assignDoctorToVendor;
/**
 * SuperAdmin removes a doctor-vendor assignment
 */
const removeDoctorFromVendor = async (req, res) => {
    try {
        const vendorId = req.params.vendorId;
        const doctorId = req.params.doctorId;
        await doctorOnboard_service_1.doctorOnboardService.removeDoctorFromVendor(vendorId, doctorId);
        (0, activityLogger_1.logActivity)({
            req,
            userId: req.user.id,
            userRole: req.user.role,
            action: "DOCTOR_REMOVED_FROM_VENDOR",
            details: { vendorId, doctorId },
        });
        res.status(200).json({
            success: true,
            message: "Doctor removed from vendor.",
        });
    }
    catch (error) {
        if (error instanceof AppError_1.AppError) {
            res.status(error.statusCode).json({ success: false, message: error.message });
            return;
        }
        console.error("Remove doctor error:", error);
        res.status(500).json({ success: false, message: "Failed to remove doctor from vendor" });
    }
};
exports.removeDoctorFromVendor = removeDoctorFromVendor;
/**
 * Get all doctors assigned to a vendor (used for patient registration dropdown)
 */
const getVendorDoctors = async (req, res) => {
    try {
        const vendorId = req.params.vendorId || req.user.id;
        const doctors = await doctorOnboard_service_1.doctorOnboardService.getVendorDoctors(vendorId);
        res.status(200).json({
            success: true,
            data: { doctors },
        });
    }
    catch (error) {
        if (error instanceof AppError_1.AppError) {
            res.status(error.statusCode).json({ success: false, message: error.message });
            return;
        }
        console.error("Get vendor doctors error:", error);
        res.status(500).json({ success: false, message: "Failed to fetch vendor doctors" });
    }
};
exports.getVendorDoctors = getVendorDoctors;
