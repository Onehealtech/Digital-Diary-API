import { Op } from "sequelize";
import { sequelize } from "../config/Dbconnetion";
import { DoctorAssignmentRequest } from "../models/DoctorAssignmentRequest";
import { Patient } from "../models/Patient";
import { AppUser } from "../models/Appuser";
import { AppError } from "../utils/AppError";
import { twilioService } from "./twilio.service";
import { sendDoctorRequestEmail } from "./emailService";

const MAX_ATTEMPTS_PER_DOCTOR = 2;

/**
 * Patient sends a request to a doctor for assignment.
 * Flow: Patient selects doctor first, then subscribes after approval.
 * Max 2 requests per patient→doctor pair.
 */
export async function createRequest(
  patientId: any,
  doctorId: string
): Promise<DoctorAssignmentRequest> {
  // Verify patient exists and has no doctor yet
  const patient = await Patient.findByPk(patientId);
  if (!patient) throw new AppError(404, "Patient not found");
  if (patient.doctorId) throw new AppError(400, "You already have a doctor assigned");

  // Verify doctor exists and is active
  const doctor = await AppUser.findOne({
    where: { id: doctorId, role: "DOCTOR", isActive: true },
  });
  if (!doctor) throw new AppError(404, "Doctor not found or inactive");

  // Check attempt count for this patient→doctor pair
  const existingCount = await DoctorAssignmentRequest.count({
    where: { patientId, doctorId },
  });
  if (existingCount >= MAX_ATTEMPTS_PER_DOCTOR) {
    throw new AppError(
      400,
      "You have already sent the maximum number of requests (2) to this doctor"
    );
  }

  // Check if there's already a PENDING request for this patient→doctor
  const pendingRequest = await DoctorAssignmentRequest.findOne({
    where: { patientId, doctorId, status: "PENDING" },
  });
  if (pendingRequest) {
    throw new AppError(400, "You already have a pending request with this doctor");
  }

  // Check if patient has any other PENDING request to a different doctor
  const otherPending = await DoctorAssignmentRequest.findOne({
    where: { patientId, status: "PENDING", doctorId: { [Op.ne]: doctorId } },
  });
  if (otherPending) {
    throw new AppError(
      400,
      "You already have a pending request with another doctor. Please wait for a response."
    );
  }

  const request = await DoctorAssignmentRequest.create({
    patientId,
    doctorId,
    status: "PENDING",
    attemptNumber: existingCount + 1,
  });

  // Fire-and-forget: notify doctor via email and SMS
  notifyDoctorOfRequest(doctor, patient, request).catch((err) =>
    console.error("Failed to notify doctor of assignment request:", err)
  );

  return request;
}

/**
 * Doctor views their pending assignment requests
 */
export async function getRequestsForDoctor(
  doctorId: string,
  status?: string
): Promise<DoctorAssignmentRequest[]> {
  const where: Record<string, unknown> = { doctorId };
  if (status) where.status = status;

  return DoctorAssignmentRequest.findAll({
    where,
    include: [
      {
        model: Patient,
        attributes: ["id", "fullName", "age", "gender", "phone", "caseType", "registrationSource"],
      },
    ],
    order: [["createdAt", "DESC"]],
  });
}

/**
 * Doctor accepts a request — links doctor to patient.
 * Diary assignment happens later when the patient purchases a subscription.
 */
export async function acceptRequest(
  requestId: string,
  doctorId: string
): Promise<DoctorAssignmentRequest> {
  return await sequelize.transaction(async (t) => {
    const request = await DoctorAssignmentRequest.findOne({
      where: { id: requestId, doctorId, status: "PENDING" },
      include: [{ model: Patient }],
      transaction: t,
    });

    if (!request) throw new AppError(404, "Pending request not found");

    const patient = await Patient.findByPk(request.patientId, { transaction: t });
    if (!patient) throw new AppError(404, "Patient not found");

    // 1. Assign doctor to patient
    patient.doctorId = doctorId;
    await patient.save({ transaction: t });

    // 2. Mark request as accepted
    request.status = "ACCEPTED";
    request.respondedAt = new Date();
    await request.save({ transaction: t });

    // 3. Cancel any other pending requests from this patient
    await DoctorAssignmentRequest.update(
      { status: "REJECTED", rejectionReason: "Another doctor accepted", respondedAt: new Date() },
      { where: { patientId: request.patientId, status: "PENDING", id: { [Op.ne]: requestId } }, transaction: t }
    );

    // 4. Notify patient via SMS (fire-and-forget)
    const doctor = await AppUser.findByPk(doctorId, { attributes: ["fullName", "specialization", "hospital"], transaction: t });
    if (patient.phone && doctor) {
      twilioService
        .sendSMS(
          patient.phone,
          `Good news! Dr. ${doctor.fullName} has accepted your request. You can now purchase a subscription to start using your Elvantia diary. - Elvantia`
        )
        .catch((err) => console.error("Failed to send acceptance SMS:", err));
    }

    return request;
  });
}

/**
 * Doctor rejects a request
 */
export async function rejectRequest(
  requestId: string,
  doctorId: string,
  rejectionReason?: string
): Promise<DoctorAssignmentRequest> {
  const request = await DoctorAssignmentRequest.findOne({
    where: { id: requestId, doctorId, status: "PENDING" },
    include: [{ model: Patient }],
  });
  if (!request) throw new AppError(404, "Pending request not found");

  request.status = "REJECTED";
  request.rejectionReason = rejectionReason || "Doctor declined the request";
  request.respondedAt = new Date();
  await request.save();

  // Notify patient via SMS
  const patient = await Patient.findByPk(request.patientId);
  if (patient?.phone) {
    const canRetry = request.attemptNumber < MAX_ATTEMPTS_PER_DOCTOR;
    const retryMsg = canRetry
      ? " You may send one more request to this doctor, or choose a different doctor."
      : " You have used both attempts with this doctor. Please choose a different doctor.";

    twilioService
      .sendSMS(
        patient.phone,
        `Your doctor assignment request was not accepted.${retryMsg} - Elvantia`
      )
      .catch((err) => console.error("❌ Failed to send rejection SMS:", err));
  }

  return request;
}

/**
 * Get requests for a specific patient (for the mobile app)
 */
export async function getRequestsForPatient(
  patientId: any
): Promise<DoctorAssignmentRequest[]> {
  return DoctorAssignmentRequest.findAll({
    where: { patientId },
    include: [
      {
        model: AppUser,
        attributes: ["id", "fullName", "specialization", "hospital", "location"],
      },
    ],
    order: [["createdAt", "DESC"]],
  });
}

/**
 * Fire-and-forget: Send email + SMS to doctor about new patient request
 */
async function notifyDoctorOfRequest(
  doctor: AppUser,
  patient: Patient,
  request: DoctorAssignmentRequest
): Promise<void> {
  const caseLabel = patient.caseType
    ? patient.caseType.replace(/_/g, " ").toLowerCase()
    : "not specified";

  // SMS notification
  if (doctor.phone) {
    await twilioService.sendSMS(
      doctor.phone,
      `New patient request: ${patient.fullName} (${caseLabel}) has chosen you as their doctor on Elvantia. Please log in to your dashboard to accept or decline. - Elvantia`
    );
  }

  // Email notification
  if (doctor.email) {
    await sendDoctorRequestEmail(
      doctor.email,
      doctor.fullName,
      patient.fullName,
      patient.age?.toString() || "N/A",
      patient.gender || "N/A",
      caseLabel,
      patient.phone || "N/A"
    );
  }
}

