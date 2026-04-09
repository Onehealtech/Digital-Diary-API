import { AppUser } from "../models/Appuser";
import { Patient } from "../models/Patient";
import { SubscriptionPlan } from "../models/SubscriptionPlan";
import { UserSubscription } from "../models/UserSubscription";
import { AppError } from "../utils/AppError";
import {
  AccessLevel,
  BUNDLE_PACKS,
  DIARY_MODULES,
  CaseType,
  getDiaryTypeForCaseType,
} from "../utils/constants";

export interface AssistantPatientScope {
  doctorId: string;
  allowedPatientIds?: string[];
}

function normalizePatientIds(patientIds?: string[] | null): string[] {
  return (patientIds ?? []).filter((id): id is string => typeof id === "string" && id.trim() !== "");
}

/**
 * Resolve the effective doctor scope for analytics-style queries.
 * Doctors can see their own patients.
 * Assistants can see their parent doctor's patients, but selected-access
 * assistants are restricted to assignedPatientIds only.
 */
export async function resolveAssistantPatientScope(user: {
  id: string;
  role?: string;
}): Promise<AssistantPatientScope> {
  if (user.role === "DOCTOR") {
    return { doctorId: user.id };
  }

  if (user.role !== "ASSISTANT") {
    throw new AppError(403, "Unauthorized");
  }

  const assistant = await AppUser.findByPk(user.id, {
    attributes: ["id", "parentId", "patientAccessMode", "assignedPatientIds"],
  });

  if (!assistant?.parentId) {
    throw new AppError(403, "Assistant is not linked to a doctor");
  }

  const assignedPatientIds = normalizePatientIds(assistant.assignedPatientIds);

  if (assistant.patientAccessMode === "selected" || assignedPatientIds.length > 0) {
    return {
      doctorId: assistant.parentId,
      allowedPatientIds: assignedPatientIds,
    };
  }

  return { doctorId: assistant.parentId };
}

/**
 * Check whether an assistant can access a specific patient record.
 * Returns false when the assistant uses selected access and the patient is
 * not explicitly assigned.
 */
export async function canAssistantAccessPatient(
  user: { id: string; role?: string },
  patientId: string
): Promise<boolean> {
  if (user.role === "DOCTOR") {
    return true;
  }

  if (user.role !== "ASSISTANT") {
    return false;
  }

  const assistant = await AppUser.findByPk(user.id, {
    attributes: ["id", "parentId", "patientAccessMode", "assignedPatientIds"],
  });

  if (!assistant?.parentId) {
    return false;
  }

  const assignedPatientIds = normalizePatientIds(assistant.assignedPatientIds);
  if (assignedPatientIds.length > 0) {
    return assignedPatientIds.includes(patientId);
  }

  if (assistant.patientAccessMode === "selected") {
    return false;
  }

  return true;
}

function getDiaryModuleConfig(caseType?: string | null) {
  const normalizedCaseType = caseType && caseType in DIARY_MODULES ? (caseType as CaseType) : CaseType.PERI_OPERATIVE;
  return DIARY_MODULES[normalizedCaseType];
}

function getSubscriptionValidity(endDate?: Date | null) {
  if (!endDate) {
    return {
      isExpired: true,
      daysRemaining: 0,
    };
  }

  const now = Date.now();
  const remainingMs = endDate.getTime() - now;
  return {
    isExpired: remainingMs < 0,
    daysRemaining: remainingMs > 0 ? Math.ceil(remainingMs / (1000 * 60 * 60 * 24)) : 0,
  };
}

export async function getPatientAccessInfo(patientId: string) {
  const patient = await Patient.findByPk(patientId, {
    include: [
      {
        model: AppUser,
        as: "doctor",
        attributes: [
          "id",
          "fullName",
          "email",
          "phone",
          "specialization",
          "hospital",
          "license",
        ],
      },
    ],
  });

  if (!patient) {
    throw new AppError(404, "Patient not found");
  }

  const subscription = await UserSubscription.findOne({
    where: { patientId },
    include: [
      {
        model: SubscriptionPlan,
        attributes: [
          "id",
          "name",
          "description",
          "monthlyPrice",
          "maxDiaryPages",
          "scanEnabled",
          "manualEntryEnabled",
        ],
      },
    ],
    order: [["createdAt", "DESC"]],
  });

  const diaryModule = getDiaryModuleConfig(patient.caseType);
  const diaryType = getDiaryTypeForCaseType(patient.caseType);
  const activeSubscription =
    subscription &&
    subscription.status === "ACTIVE" &&
    subscription.endDate &&
    new Date(subscription.endDate) >= new Date();

  const validity = getSubscriptionValidity(subscription?.endDate ?? null);

  return {
    patient: {
      id: patient.id,
      fullName: patient.fullName,
      phone: patient.phone,
      age: patient.age,
      gender: patient.gender,
      status: patient.status,
      caseType: patient.caseType,
      diaryId: patient.diaryId,
      doctorId: patient.doctorId,
      registeredDate: patient.registeredDate,
    },
    doctor: patient.doctor
      ? {
          id: patient.doctor.id,
          fullName: patient.doctor.fullName,
          email: patient.doctor.email,
          phone: patient.doctor.phone,
          specialization: patient.doctor.specialization,
          hospital: patient.doctor.hospital,
          license: patient.doctor.license,
        }
      : null,
    diaryModule: {
      caseType: patient.caseType ?? CaseType.PERI_OPERATIVE,
      moduleName: diaryModule.moduleName,
      diaryType,
      defaultValidityDays: diaryModule.defaultValidityDays,
      mrpInclGST: diaryModule.mrpInclGST,
      extensions: diaryModule.extensions,
    },
    subscription: subscription
      ? {
          id: subscription.id,
          status: subscription.status,
          planId: subscription.planId,
          planName: (subscription.plan as SubscriptionPlan | null)?.name ?? "Subscription",
          description: (subscription.plan as SubscriptionPlan | null)?.description ?? null,
          maxDiaryPages: subscription.maxDiaryPages,
          scanEnabled: subscription.scanEnabled,
          manualEntryEnabled: subscription.manualEntryEnabled,
          pagesUsed: subscription.pagesUsed,
          remainingPages:
            subscription.maxDiaryPages === -1
              ? -1
              : Math.max(subscription.maxDiaryPages - subscription.pagesUsed, 0),
          startDate: subscription.startDate,
          endDate: subscription.endDate,
        }
      : null,
    accessLevel: activeSubscription ? AccessLevel.ALL_ACCESS : AccessLevel.LIMITED_ACCESS,
    validity: {
      startDate: subscription?.startDate ?? null,
      endDate: subscription?.endDate ?? null,
      ...validity,
    },
    features: {
      canScan: activeSubscription ? subscription?.scanEnabled ?? false : false,
      canManualEntry: activeSubscription ? subscription?.manualEntryEnabled ?? false : false,
      canViewCatalog: true,
    },
  };
}

export function getDiaryModuleCatalog() {
  return {
    modules: Object.values(DIARY_MODULES),
    bundles: BUNDLE_PACKS,
  };
}
