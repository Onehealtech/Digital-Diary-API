"use strict";
// src/service/patientAccess.service.ts
Object.defineProperty(exports, "__esModule", { value: true });
exports.getDiaryModuleCatalog = exports.getPatientAccessInfo = void 0;
const Patient_1 = require("../models/Patient");
const Diary_1 = require("../models/Diary");
const Appuser_1 = require("../models/Appuser");
const UserSubscription_1 = require("../models/UserSubscription");
const SubscriptionPlan_1 = require("../models/SubscriptionPlan");
const AppError_1 = require("../utils/AppError");
const constants_1 = require("../utils/constants");
/**
 * Get complete access info for a patient.
 * Used by the mobile app to determine UI rendering and feature gating.
 *
 * VENDOR_ASSIGNED → all_access: unlimited pages, scan, manual entry, no expiry concern
 * SELF_SIGNUP     → limited_access: features based on subscription plan, validity tracked
 */
async function getPatientAccessInfo(patientId) {
    const patient = await Patient_1.Patient.findByPk(patientId);
    if (!patient)
        throw new AppError_1.AppError(404, "Patient not found");
    const isVendorAssigned = patient.registrationSource === "VENDOR_ASSIGNED";
    const accessLevel = isVendorAssigned ? constants_1.AccessLevel.ALL_ACCESS : constants_1.AccessLevel.LIMITED_ACCESS;
    // Resolve diary module from caseType
    const caseType = patient.caseType;
    const moduleConfig = caseType ? constants_1.DIARY_MODULES[caseType] : null;
    // Fetch diary if assigned
    let diaryInfo = null;
    if (patient.diaryId) {
        const diary = await Diary_1.Diary.findByPk(patient.diaryId, {
            attributes: ["id", "status", "activationDate"],
        });
        if (diary) {
            diaryInfo = {
                id: diary.id,
                status: diary.status,
                activationDate: diary.activationDate || null,
            };
        }
    }
    // Fetch doctor if assigned
    let doctorInfo = null;
    if (patient.doctorId) {
        const doctor = await Appuser_1.AppUser.findByPk(patient.doctorId, {
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
    let subscriptionInfo = null;
    let activeSubscription = null;
    if (!isVendorAssigned) {
        activeSubscription = await UserSubscription_1.UserSubscription.findOne({
            where: { patientId, status: "ACTIVE" },
            include: [{ model: SubscriptionPlan_1.SubscriptionPlan, attributes: ["id", "name"] }],
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
    let features;
    let validity;
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
            isActive: !!diaryInfo && diaryInfo.status === "active" && !isExpired,
        };
    }
    else {
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
exports.getPatientAccessInfo = getPatientAccessInfo;
/**
 * Get all available diary modules with pricing for the catalog/store.
 */
function getDiaryModuleCatalog() {
    const modules = Object.values(constants_1.DIARY_MODULES).map((m) => ({
        caseType: m.caseType,
        moduleName: m.moduleName,
        diaryType: m.diaryType,
        defaultValidityDays: m.defaultValidityDays,
        mrp: m.mrpInclGST,
        extensions: m.extensions,
    }));
    const bundles = constants_1.BUNDLE_PACKS.map((b) => ({
        bundleCode: b.bundleCode,
        bundleName: b.bundleName,
        includes: b.includes.map((ct) => ({
            caseType: ct,
            moduleName: constants_1.DIARY_MODULES[ct].moduleName,
        })),
        packMRP: b.packMRP,
        discountPercent: b.discountPercent,
    }));
    return { modules, bundles };
}
exports.getDiaryModuleCatalog = getDiaryModuleCatalog;
