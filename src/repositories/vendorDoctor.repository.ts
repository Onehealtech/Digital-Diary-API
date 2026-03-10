import { Transaction } from "sequelize";
import { AppUser } from "../models/Appuser";
import { Patient } from "../models/Patient";
import { VendorDoctor } from "../models/VendorDoctor";

class VendorDoctorRepository {
  async create(data: {
    vendorId: string;
    doctorId: string;
    assignedBy?: string;
    onboardRequestId?: string;
  }, transaction?: Transaction): Promise<VendorDoctor> {
    return VendorDoctor.create(data, { ...(transaction && { transaction }) });
  }

  async exists(vendorId: string, doctorId: string): Promise<boolean> {
    const count = await VendorDoctor.count({ where: { vendorId, doctorId } });
    return count > 0;
  }

  async findByVendorId(vendorId: string): Promise<VendorDoctor[]> {
    return VendorDoctor.findAll({
      where: { vendorId },
      include: [
        {
          model: AppUser,
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

  async findByDoctorId(doctorId: string): Promise<VendorDoctor[]> {
    return VendorDoctor.findAll({
      where: { doctorId },
      include: [
        {
          model: AppUser,
          as: "vendor",
          attributes: ["id", "fullName", "email", "phone"],
        },
      ],
    });
  }

  async delete(vendorId: string, doctorId: string): Promise<number> {
    return VendorDoctor.destroy({ where: { vendorId, doctorId } });
  }

  async getDoctorsWithStatsForVendor(vendorId: string): Promise<Array<Record<string, unknown>>> {
    const associations = await this.findByVendorId(vendorId);

    const doctorsWithStats = await Promise.all(
      associations.map(async (assoc) => {
        const doctor = assoc.doctor;
        if (!doctor) return null;

        const patientCount = await Patient.count({
          where: { doctorId: doctor.id },
        });

        const assistantCount = await AppUser.count({
          where: { role: "ASSISTANT", parentId: doctor.id },
        });

        return {
          ...doctor.toJSON(),
          stats: {
            totalPatients: patientCount,
            totalAssistants: assistantCount,
          },
        };
      })
    );

    return doctorsWithStats.filter((d): d is Record<string, unknown> => d !== null);
  }
}

export const vendorDoctorRepository = new VendorDoctorRepository();
