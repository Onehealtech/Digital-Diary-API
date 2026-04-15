import { Response } from "express";
import { AuthenticatedRequest } from "../middleware/authMiddleware";
import { AppError } from "../utils/AppError";
import { doctorOnboardService } from "../service/doctorOnboard.service";
import { logActivity } from "../utils/activityLogger";

/**
 * Vendor submits a doctor onboard request
 */
export const submitRequest = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const vendorId = req.user!.id;
    const request = await doctorOnboardService.submitRequest(vendorId, req.body);

    logActivity({
      req,
      userId: vendorId,
      userRole: req.user!.role,
      action: "DOCTOR_ONBOARD_REQUEST_SUBMITTED",
      details: { requestId: request.id, doctorEmail: req.body.email },
    });

    res.status(201).json({
      success: true,
      message: "Doctor onboard request submitted. Awaiting Super Admin approval.",
      data: request,
    });
  } catch (error: unknown) {
    if (error instanceof AppError) {
      res.status(error.statusCode).json({ success: false, message: error.message });
      return;
    }
    const message = error instanceof Error ? error.message : "Internal server error";
    console.error("Submit doctor request error:", message);
    res.status(500).json({ success: false, message: "Failed to submit doctor onboard request" });
  }
};

/**
 * Vendor views their own requests
 */
export const getMyRequests = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const vendorId = req.user!.id;
    const query = (res.locals.validatedQuery ?? req.query) as Record<string, string>;
    const result = await doctorOnboardService.getRequestsForVendor(vendorId, query);

    res.status(200).json({ success: true, data: result });
  } catch (error: unknown) {
    if (error instanceof AppError) {
      res.status(error.statusCode).json({ success: false, message: error.message });
      return;
    }
    console.error("Get my requests error:", error);
    res.status(500).json({ success: false, message: "Failed to fetch requests" });
  }
};

/**
 * SuperAdmin views all requests
 */
export const getAllRequests = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const query = (res.locals.validatedQuery ?? req.query) as Record<string, string>;
    const result = await doctorOnboardService.getAllRequests(query);
    res.status(200).json({ success: true, data: result });
  } catch (error: unknown) {
    if (error instanceof AppError) {
      res.status(error.statusCode).json({ success: false, message: error.message });
      return;
    }
    console.error("Get all requests error:", error);
    res.status(500).json({ success: false, message: "Failed to fetch requests" });
  }
};

/**
 * SuperAdmin views a single request
 */
export const getRequestById = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const result = await doctorOnboardService.getRequestById(req.params.id as string);
    res.status(200).json({ success: true, data: result });
  } catch (error: unknown) {
    if (error instanceof AppError) {
      res.status(error.statusCode).json({ success: false, message: error.message });
      return;
    }
    console.error("Get request by id error:", error);
    res.status(500).json({ success: false, message: "Failed to fetch request" });
  }
};

/**
 * SuperAdmin checks for duplicate doctors matching a request
 */
export const checkDuplicateDoctor = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const requestId = req.params.id as string;
    const result = await doctorOnboardService.checkDuplicateDoctor(requestId);
    res.status(200).json({ success: true, data: result });
  } catch (error: unknown) {
    if (error instanceof AppError) {
      res.status(error.statusCode).json({ success: false, message: error.message });
      return;
    }
    console.error("Check duplicate doctor error:", error);
    res.status(500).json({ success: false, message: "Failed to check for duplicate doctors" });
  }
};

/**
 * SuperAdmin approves a doctor onboard request
 */
export const approveRequest = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const reviewerId = req.user!.id;
    const requestId = req.params.id as string;
    const result = await doctorOnboardService.approveRequest(requestId, reviewerId);

    logActivity({
      req,
      userId: reviewerId,
      userRole: req.user!.role,
      action: "DOCTOR_ONBOARD_REQUEST_APPROVED",
      details: { requestId, doctorId: result.doctor.id, vendorId: result.vendorId },
    });

    res.status(200).json({
      success: true,
      message: "Doctor onboard request approved. Doctor account created and assigned to vendor.",
      data: result,
    });
  } catch (error: unknown) {
    if (error instanceof AppError) {
      res.status(error.statusCode).json({ success: false, message: error.message });
      return;
    }
    const message = error instanceof Error ? error.message : "Internal server error";
    console.error("Approve request error:", message);
    res.status(500).json({ success: false, message: "Failed to approve request" });
  }
};

/**
 * SuperAdmin rejects a doctor onboard request
 */
export const rejectRequest = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const reviewerId = req.user!.id;
    const { rejectionReason } = req.body;
    const requestId = req.params.id as string;
    const result = await doctorOnboardService.rejectRequest(requestId, reviewerId, rejectionReason);

    logActivity({
      req,
      userId: reviewerId,
      userRole: req.user!.role,
      action: "DOCTOR_ONBOARD_REQUEST_REJECTED",
      details: { requestId, rejectionReason },
    });

    res.status(200).json({
      success: true,
      message: "Doctor onboard request rejected.",
      data: result,
    });
  } catch (error: unknown) {
    if (error instanceof AppError) {
      res.status(error.statusCode).json({ success: false, message: error.message });
      return;
    }
    console.error("Reject request error:", error);
    res.status(500).json({ success: false, message: "Failed to reject request" });
  }
};

/**
 * SuperAdmin assigns an existing doctor to a vendor
 */
export const assignDoctorToVendor = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const assignedBy = req.user!.id;
    const { vendorId, doctorId } = req.body;
    const result = await doctorOnboardService.assignDoctorToVendor(vendorId, doctorId, assignedBy);

    logActivity({
      req,
      userId: assignedBy,
      userRole: req.user!.role,
      action: "DOCTOR_ASSIGNED_TO_VENDOR",
      details: { vendorId, doctorId },
    });

    res.status(201).json({
      success: true,
      message: `Doctor ${result.doctorName} assigned to vendor ${result.vendorName}.`,
      data: result,
    });
  } catch (error: unknown) {
    if (error instanceof AppError) {
      res.status(error.statusCode).json({ success: false, message: error.message });
      return;
    }
    console.error("Assign doctor error:", error);
    res.status(500).json({ success: false, message: "Failed to assign doctor to vendor" });
  }
};

/**
 * SuperAdmin removes a doctor-vendor assignment
 */
export const removeDoctorFromVendor = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const vendorId = req.params.vendorId as string;
    const doctorId = req.params.doctorId as string;
    await doctorOnboardService.removeDoctorFromVendor(vendorId, doctorId);

    logActivity({
      req,
      userId: req.user!.id,
      userRole: req.user!.role,
      action: "DOCTOR_REMOVED_FROM_VENDOR",
      details: { vendorId, doctorId },
    });

    res.status(200).json({
      success: true,
      message: "Doctor removed from vendor.",
    });
  } catch (error: unknown) {
    if (error instanceof AppError) {
      res.status(error.statusCode).json({ success: false, message: error.message });
      return;
    }
    console.error("Remove doctor error:", error);
    res.status(500).json({ success: false, message: "Failed to remove doctor from vendor" });
  }
};

/**
 * Get all doctors assigned to a vendor (used for patient registration dropdown)
 */
export const getVendorDoctors = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const vendorId = (req.params.vendorId as string) || req.user!.id;
    const doctors = await doctorOnboardService.getVendorDoctors(vendorId);

    res.status(200).json({
      success: true,
      data: { doctors },
    });
  } catch (error: unknown) {
    if (error instanceof AppError) {
      res.status(error.statusCode).json({ success: false, message: error.message });
      return;
    }
    console.error("Get vendor doctors error:", error);
    res.status(500).json({ success: false, message: "Failed to fetch vendor doctors" });
  }
};
