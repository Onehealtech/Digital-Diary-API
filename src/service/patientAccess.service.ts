// src/service/patientAccess.service.ts

import { Patient } from "../models/Patient";
import { Diary } from "../models/Diary";
import { AppUser } from "../models/Appuser";
import { UserSubscription } from "../models/UserSubscription";
import { SubscriptionPlan } from "../models/SubscriptionPlan";
import { AppError } from "../utils/AppError";
import {
  AccessLevel,
  CaseType,
  DIARY_MODULES,
  BUNDLE_PACKS,
  getDiaryTypeForCaseType,
} from "../utils/constants";
import { DIARY_STATUS, normalizeDiaryStatus } from "../utils/diaryStatus";

export interface PatientAccessInfo {
  accessLevel: "all_access" | "limited_access";
  registrationSource: "VENDOR_ASSIGNED" | "SELF_SIGNUP";

  patient: {
    id: string;
    fullName: string;
    caseType: string | null;
    status: string;
    diaryId: string | null;
    doctorAssigned: boolean;
  };

  diaryModule: {
    moduleName: string;
    diaryType: string;
    caseType: string | null;
    defaultValidityDays: number;
    mrp: number;
    extensions: { label: string; days: number; price: number }[];
  } | null;

  diary: {
    id: string;
    status: string;
    activationDate: Date | null;
  } | null;

  doctor: {
    id: string;
    fullName: string;
    specialization: string | null;
    hospital: string | null;
  } | null;

  subscription: {
    id: string;
    planName: string;
    status: string;
    startDate: Date;
    endDate: Date;
    paidAmount: number;
  } | null;

  features: {
    scanEnabled: boolean;
    manualEntryEnabled: boolean;
    maxDiaryPages: number;
    pagesUsed: number;
    unlimitedPages: boolean;
  };

  validity: {
    startDate: Date | null;
    endDate: Date | null;
    daysRemaining: number;
    isExpired: boolean;
    isActive: boolean;
  };
}

/**
 * Get complete access info for a patient.
 * Used by the mobile app to determine UI rendering and feature gating.
 *
 * VENDOR_ASSIGNED → all_access: unlimited pages, scan, manual entry, no expiry concern
 * SELF_SIGNUP     → limited_access: features based on subscription plan, validity tracked
 */
export async function getPatientAccessInfo(patientId: string): Promise<PatientAccessInfo> {
  const patient = await Patient.findByPk(patientId);
  if (!patient) throw new AppError(404, "Patient not found");

  const isVendorAssigned = patient.registrationSource === "VENDOR_ASSIGNED";
  const accessLevel = isVendorAssigned ? AccessLevel.ALL_ACCESS : AccessLevel.LIMITED_ACCESS;

  // Resolve diary module from caseType
  const caseType = patient.caseType as CaseType | undefined;
  const moduleConfig = caseType ? DIARY_MODULES[caseType] : null;

  // Fetch diary if assigned
  let diaryInfo: PatientAccessInfo["diary"] = null;
  if (patient.diaryId) {
    const diary = await Diary.findByPk(patient.diaryId, {
      attributes: ["id", "status", "activationDate"],
    });
    if (diary) {
      diaryInfo = {
        id: diary.id,
        status: normalizeDiaryStatus(diary.status),
        activationDate: diary.activationDate || null,
      };
    }
  }

  // Fetch doctor if assigned
  let doctorInfo: PatientAccessInfo["doctor"] = null;
  if (patient.doctorId) {
    const doctor = await AppUser.findByPk(patient.doctorId, {
      attributes: ["id", "fullName", "specialization", "hospital"],
    });
    if (doctor) {
      doctorInfo = {
        id: doctor.id,
        fullName: doctor.fullName,
        specialization: doctor.specialization || null,
        hospital: doctor.hospital || null,
      };
    }
  }

  // Fetch active subscription (for SELF_SIGNUP patients)
  let subscriptionInfo: PatientAccessInfo["subscription"] = null;
  let activeSubscription: UserSubscription | null = null;

  if (!isVendorAssigned) {
    activeSubscription = await UserSubscription.findOne({
      where: { patientId, status: "ACTIVE" },
      include: [{ model: SubscriptionPlan, attributes: ["id", "name"] }],
    });
    if (activeSubscription) {
      subscriptionInfo = {
        id: activeSubscription.id,
        planName: activeSubscription.plan?.name || "Unknown Plan",
        status: activeSubscription.status,
        startDate: activeSubscription.startDate,
        endDate: activeSubscription.endDate,
        paidAmount: Number(activeSubscription.paidAmount),
      };
    }
  }

  // Build features based on access level
  let features: PatientAccessInfo["features"];
  let validity: PatientAccessInfo["validity"];

  if (isVendorAssigned) {
    // ALL ACCESS — Vendor/SuperAdmin sold diary: everything enabled, no page limits
    const validityDays = moduleConfig?.defaultValidityDays || 365;
    const activationDate = diaryInfo?.activationDate
      ? new Date(diaryInfo.activationDate)
      : null;
    const endDate = activationDate
      ? new Date(activationDate.getTime() + validityDays * 24 * 60 * 60 * 1000)
      : null;
    const now = new Date();
    const daysRemaining = endDate
      ? Math.max(0, Math.ceil((endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)))
      : 0;
    const isExpired = endDate ? now > endDate : false;

    features = {
      scanEnabled: true,
      manualEntryEnabled: true,
      maxDiaryPages: -1,
      pagesUsed: 0,
      unlimitedPages: true,
    };

    validity = {
      startDate: activationDate,
      endDate,
      daysRemaining,
      isExpired,
      isActive: !!diaryInfo && diaryInfo.status === DIARY_STATUS.APPROVED && !isExpired,
    };
  } else {
    // LIMITED ACCESS — Subscription model: features from plan
    const now = new Date();
    const subEndDate = activeSubscription?.endDate
      ? new Date(activeSubscription.endDate)
      : null;
    const daysRemaining = subEndDate
      ? Math.max(0, Math.ceil((subEndDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)))
      : 0;
    const isExpired = subEndDate ? now > subEndDate : true;

    features = {
      scanEnabled: activeSubscription?.scanEnabled ?? false,
      manualEntryEnabled: activeSubscription?.manualEntryEnabled ?? false,
      maxDiaryPages: activeSubscription?.maxDiaryPages ?? 0,
      pagesUsed: activeSubscription?.pagesUsed ?? 0,
      unlimitedPages: activeSubscription?.maxDiaryPages === -1,
    };

    validity = {
      startDate: activeSubscription?.startDate || null,
      endDate: subEndDate,
      daysRemaining,
      isExpired,
      isActive: !!activeSubscription && activeSubscription.status === "ACTIVE" && !isExpired,
    };
  }

  return {
    accessLevel,
    registrationSource: patient.registrationSource,
    patient: {
      id: patient.id,
      fullName: patient.fullName,
      caseType: patient.caseType || null,
      status: patient.status,
      diaryId: patient.diaryId || null,
      doctorAssigned: !!patient.doctorId,
    },
    diaryModule: moduleConfig
      ? {
          moduleName: moduleConfig.moduleName,
          diaryType: moduleConfig.diaryType,
          caseType: moduleConfig.caseType,
          defaultValidityDays: moduleConfig.defaultValidityDays,
          mrp: moduleConfig.mrpInclGST,
          extensions: moduleConfig.extensions,
        }
      : null,
    diary: diaryInfo,
    doctor: doctorInfo,
    subscription: subscriptionInfo,
    features,
    validity,
  };
}

/**
 * Get all available diary modules with pricing for the catalog/store.
 */
export function getDiaryModuleCatalog() {
  const modules = Object.values(DIARY_MODULES).map((m) => ({
    caseType: m.caseType,
    moduleName: m.moduleName,
    diaryType: m.diaryType,
    defaultValidityDays: m.defaultValidityDays,
    mrp: m.mrpInclGST,
    extensions: m.extensions,
  }));

  const bundles = BUNDLE_PACKS.map((b) => ({
    bundleCode: b.bundleCode,
    bundleName: b.bundleName,
    includes: b.includes.map((ct) => ({
      caseType: ct,
      moduleName: DIARY_MODULES[ct].moduleName,
    })),
    packMRP: b.packMRP,
    discountPercent: b.discountPercent,
  }));

  return { modules, bundles };
}
