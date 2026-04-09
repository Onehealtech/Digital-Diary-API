"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getDiaryModuleCatalog = exports.getPatientAccessInfo = exports.canAssistantAccessPatient = exports.resolveAssistantPatientScope = void 0;
const Appuser_1 = require("../models/Appuser");
const Patient_1 = require("../models/Patient");
const SubscriptionPlan_1 = require("../models/SubscriptionPlan");
const UserSubscription_1 = require("../models/UserSubscription");
const AppError_1 = require("../utils/AppError");
const constants_1 = require("../utils/constants");
function normalizePatientIds(patientIds) {
    return (patientIds ?? []).filter((id) => typeof id === "string" && id.trim() !== "");
}
/**
 * Resolve the effective doctor scope for analytics-style queries.
 * Doctors can see their own patients.
 * Assistants can see their parent doctor's patients, but selected-access
 * assistants are restricted to assignedPatientIds only.
 */
async function resolveAssistantPatientScope(user) {
    if (user.role === "DOCTOR") {
        return { doctorId: user.id };
    }
    if (user.role !== "ASSISTANT") {
        throw new AppError_1.AppError(403, "Unauthorized");
    }
    const assistant = await Appuser_1.AppUser.findByPk(user.id, {
        attributes: ["id", "parentId", "patientAccessMode", "assignedPatientIds"],
    });
    if (!assistant?.parentId) {
        throw new AppError_1.AppError(403, "Assistant is not linked to a doctor");
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
exports.resolveAssistantPatientScope = resolveAssistantPatientScope;
/**
 * Check whether an assistant can access a specific patient record.
 * Returns false when the assistant uses selected access and the patient is
 * not explicitly assigned.
 */
async function canAssistantAccessPatient(user, patientId) {
    if (user.role === "DOCTOR") {
        return true;
    }
    if (user.role !== "ASSISTANT") {
        return false;
    }
    const assistant = await Appuser_1.AppUser.findByPk(user.id, {
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
exports.canAssistantAccessPatient = canAssistantAccessPatient;
function getDiaryModuleConfig(caseType) {
    const normalizedCaseType = caseType && caseType in constants_1.DIARY_MODULES ? caseType : constants_1.CaseType.PERI_OPERATIVE;
    return constants_1.DIARY_MODULES[normalizedCaseType];
}
function getSubscriptionValidity(endDate) {
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
async function getPatientAccessInfo(patientId) {
    const patient = await Patient_1.Patient.findByPk(patientId, {
        include: [
            {
                model: Appuser_1.AppUser,
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
        throw new AppError_1.AppError(404, "Patient not found");
    }
    const subscription = await UserSubscription_1.UserSubscription.findOne({
        where: { patientId },
        include: [
            {
                model: SubscriptionPlan_1.SubscriptionPlan,
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
    const diaryType = (0, constants_1.getDiaryTypeForCaseType)(patient.caseType);
    const activeSubscription = subscription &&
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
            caseType: patient.caseType ?? constants_1.CaseType.PERI_OPERATIVE,
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
                planName: subscription.plan?.name ?? "Subscription",
                description: subscription.plan?.description ?? null,
                maxDiaryPages: subscription.maxDiaryPages,
                scanEnabled: subscription.scanEnabled,
                manualEntryEnabled: subscription.manualEntryEnabled,
                pagesUsed: subscription.pagesUsed,
                remainingPages: subscription.maxDiaryPages === -1
                    ? -1
                    : Math.max(subscription.maxDiaryPages - subscription.pagesUsed, 0),
                startDate: subscription.startDate,
                endDate: subscription.endDate,
            }
            : null,
        accessLevel: activeSubscription ? constants_1.AccessLevel.ALL_ACCESS : constants_1.AccessLevel.LIMITED_ACCESS,
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
exports.getPatientAccessInfo = getPatientAccessInfo;
function getDiaryModuleCatalog() {
    return {
        modules: Object.values(constants_1.DIARY_MODULES),
        bundles: constants_1.BUNDLE_PACKS,
    };
}
exports.getDiaryModuleCatalog = getDiaryModuleCatalog;
