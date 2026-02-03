import { Request, Response } from "express";
import { Patient } from "../models/Patient";
import { AuthenticatedRequest } from "../middleware/authMiddleware";
import { AppUser } from "../models/Appuser";

export const createPatient = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const doctorId = req.user.id; // from auth middleware
    const role = req.user.role;

    if (role !== "doctor") {
      return res.status(403).json({ message: "Only doctors can create patients" });
    }

    const { fullName, age, gender, phone } = req.body;

    const patient = await Patient.create({
      fullName,
      age,
      gender,
      phone,
      doctorId,
    });

    return res.status(201).json({
      message: "Patient created successfully",
      data: patient,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

export const getDoctorPatients = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const doctorId = req.user.id;
    
    const doctor = await AppUser.findByPk(doctorId, {
      attributes: ["id", "fullName", "email"],
      include: [
        {
          model: Patient,
          attributes: ["patientCode", "fullName", "age", "gender"],
        },
      ],
    });

    return res.json(doctor);
  } catch (error) {
    return res.status(500).json({ message: "Server error" });
  }
};
