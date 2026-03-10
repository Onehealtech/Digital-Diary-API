"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.vendorDoctorRepository = void 0;
const Appuser_1 = require("../models/Appuser");
const Patient_1 = require("../models/Patient");
const VendorDoctor_1 = require("../models/VendorDoctor");
class VendorDoctorRepository {
    async create(data, transaction) {
        return VendorDoctor_1.VendorDoctor.create(data, { ...(transaction && { transaction }) });
    }
    async exists(vendorId, doctorId) {
        const count = await VendorDoctor_1.VendorDoctor.count({ where: { vendorId, doctorId } });
        return count > 0;
    }
    async findByVendorId(vendorId) {
        return VendorDoctor_1.VendorDoctor.findAll({
            where: { vendorId },
            include: [
                {
                    model: Appuser_1.AppUser,
                    as: "doctor",
                    attributes: [
                        "id", "fullName", "email", "phone",
                        "specialization", "hospital", "license",
                        "isActive", "createdAt",
                    ],
                },
            ],
            order: [["createdAt", "DESC"]],
        });
    }
    async findByDoctorId(doctorId) {
        return VendorDoctor_1.VendorDoctor.findAll({
            where: { doctorId },
            include: [
                {
                    model: Appuser_1.AppUser,
                    as: "vendor",
                    attributes: ["id", "fullName", "email", "phone"],
                },
            ],
        });
    }
    async delete(vendorId, doctorId) {
        return VendorDoctor_1.VendorDoctor.destroy({ where: { vendorId, doctorId } });
    }
    async getDoctorsWithStatsForVendor(vendorId) {
        const associations = await this.findByVendorId(vendorId);
        const doctorsWithStats = await Promise.all(associations.map(async (assoc) => {
            const doctor = assoc.doctor;
            if (!doctor)
                return null;
            const patientCount = await Patient_1.Patient.count({
                where: { doctorId: doctor.id },
            });
            const assistantCount = await Appuser_1.AppUser.count({
                where: { role: "ASSISTANT", parentId: doctor.id },
            });
            return {
                ...doctor.toJSON(),
                stats: {
                    totalPatients: patientCount,
                    totalAssistants: assistantCount,
                },
            };
        }));
        return doctorsWithStats.filter((d) => d !== null);
    }
}
exports.vendorDoctorRepository = new VendorDoctorRepository();
