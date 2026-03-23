import { Op } from "sequelize";
import { sequelize } from "../config/Dbconnetion";
import { DoctorAssignmentRequest } from "../models/DoctorAssignmentRequest";
import { Patient } from "../models/Patient";
import { AppUser } from "../models/Appuser";
import { Diary } from "../models/Diary";
import { UserSubscription } from "../models/UserSubscription";
import { DoctorPatientHistory } from "../models/DoctorPatientHistory";
import { AppError } from "../utils/AppError";
import { twilioService } from "./twilio.service";
import { sendDoctorRequestEmail } from "./emailService";

const MAX_ATTEMPTS_PER_DOCTOR = 2;

/**
 * Patient sends a request to a doctor for assignment or doctor change.
 * - New patient (no doctor): sends first request
 * - Existing patient (has doctor): requests doctor change, status set to ON_HOLD
 * Max 2 requests per patient→doctor pair.
 */
export async function createRequest(
  patientId: any,
  doctorId: string
): Promise<DoctorAssignmentRequest> {
  const patient = await Patient.findByPk(patientId);
  if (!patient) throw new AppError(404, "Patient not found");

  // Cannot request your current doctor
  if (patient.doctorId === doctorId) {
    throw new AppError(400, "This doctor is already assigned to you");
  }

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

  // If patient already has a doctor, this is a doctor-change request → set ON_HOLD
  const isDoctorChange = !!patient.doctorId;
  if (isDoctorChange) {
    patient.status = "ON_HOLD";
    await patient.save();
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
 * For new patients: diary assignment happens when subscription is purchased.
 * For doctor-change: reassigns existing diary/subscription to the new doctor,
 * so the new doctor sees the patient's full history immediately.
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

    const oldDoctorId = patient.doctorId;
    const isDoctorChange = !!oldDoctorId && oldDoctorId !== doctorId;
    const now = new Date();

    // 1. Record assignment history
    if (isDoctorChange) {
      // Close old doctor's history record
      await DoctorPatientHistory.update(
        { unassignedAt: now },
        {
          where: { patientId: request.patientId, doctorId: oldDoctorId, unassignedAt: null },
          transaction: t,
        }
      );

      // Reassign diary so new doctor sees all patient history
      if (patient.diaryId) {
        await Diary.update(
          { doctorId },
          { where: { id: patient.diaryId }, transaction: t }
        );
      }

      // Reassign active subscription to new doctor
      await UserSubscription.update(
        { doctorId },
        { where: { patientId: request.patientId, status: "ACTIVE" }, transaction: t }
      );
    }

    // Create new history record for the new doctor
    await DoctorPatientHistory.create(
      {
        patientId: request.patientId,
        doctorId,
        assignedAt: now,
        unassignedAt: null,
      },
      { transaction: t }
    );

    // 2. Assign new doctor to patient and restore ACTIVE status
    patient.doctorId = doctorId;
    if (patient.status === "ON_HOLD") {
      patient.status = "ACTIVE";
    }
    await patient.save({ transaction: t });

    // 3. Mark request as accepted
    request.status = "ACCEPTED";
    request.respondedAt = new Date();
    await request.save({ transaction: t });

    // 4. Cancel any other pending requests from this patient
    await DoctorAssignmentRequest.update(
      { status: "REJECTED", rejectionReason: "Another doctor accepted", respondedAt: new Date() },
      { where: { patientId: request.patientId, status: "PENDING", id: { [Op.ne]: requestId } }, transaction: t }
    );

    // 5. Notify patient via SMS (fire-and-forget)
    const doctor = await AppUser.findByPk(doctorId, { attributes: ["fullName", "specialization", "hospital"], transaction: t });
    if (patient.phone && doctor) {
      const smsMessage = isDoctorChange
        ? `Good news! Dr. ${doctor.fullName} has accepted your request. Your care has been transferred and all your diary history is now available to your new doctor. - Elvantia`
        : `Good news! Dr. ${doctor.fullName} has accepted your request. You can now purchase a subscription to start using your Elvantia diary. - Elvantia`;

      twilioService
        .sendSMS(patient.phone, smsMessage)
        .catch((err) => console.error("Failed to send acceptance SMS:", err));
    }

    return request;
  });
}

/**
 * Doctor rejects a request.
 * If this was a doctor-change request and no other pending requests remain,
 * restore the patient status from ON_HOLD back to ACTIVE.
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

  const patient = await Patient.findByPk(request.patientId);
  if (patient) {
    // If patient is ON_HOLD (doctor-change) and no other pending requests remain, restore ACTIVE
    if (patient.status === "ON_HOLD") {
      const remainingPending = await DoctorAssignmentRequest.count({
        where: { patientId: request.patientId, status: "PENDING" },
      });
      if (remainingPending === 0) {
        patient.status = "ACTIVE";
        await patient.save();
      }
    }

    // Notify patient via SMS
    if (patient.phone) {
      const canRetry = request.attemptNumber < MAX_ATTEMPTS_PER_DOCTOR;
      const retryMsg = canRetry
        ? " You may send one more request to this doctor, or choose a different doctor."
        : " You have used both attempts with this doctor. Please choose a different doctor.";

      twilioService
        .sendSMS(
          patient.phone,
          `Your doctor assignment request was not accepted.${retryMsg} - Elvantia`
        )
        .catch((err) => console.error("Failed to send rejection SMS:", err));
    }
  }

  return request;
}

/**
 * Patient cancels their own PENDING request.
 * If this was a doctor-change request and no other pending requests remain,
 * restore the patient status from ON_HOLD back to ACTIVE.
 */
export async function cancelRequest(
  requestId: string,
  patientId: string
): Promise<DoctorAssignmentRequest> {
  const request = await DoctorAssignmentRequest.findOne({
    where: { id: requestId, patientId, status: "PENDING" },
  });
  if (!request) throw new AppError(404, "Pending request not found");

  request.status = "CANCELLED";
  request.respondedAt = new Date();
  await request.save();

  // If patient is ON_HOLD and no other pending requests remain, restore ACTIVE
  const patient = await Patient.findByPk(patientId);
  if (patient && patient.status === "ON_HOLD") {
    const remainingPending = await DoctorAssignmentRequest.count({
      where: { patientId, status: "PENDING" },
    });
    if (remainingPending === 0) {
      patient.status = "ACTIVE";
      await patient.save();
    }
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

