import { Request, Response } from "express";
import { Patient } from "../models/Patient";
import { AuthenticatedRequest } from "../middleware/authMiddleware";
import { AppUser } from "../models/Appuser";
import { UserRole } from "../utils/constants";

export const createPatient = async (req: AuthenticatedRequest, res: Response) => {
  try {
    let doctorId = req.user.id; // from auth middleware
    const role = req.user.role;

    if (role !== UserRole.DOCTOR && role !== UserRole.ASSISTANT) {
      return res.status(403).json({ message: "Only doctors and assistants can create patients" });
    }
    const userData = await AppUser.findByPk(req.user.id);
    if (userData?.role == UserRole.ASSISTANT) {
      doctorId = userData.parentId;
    }
    const { fullName, age, gender, phone, diaryId } = req.body;

    const patient = await Patient.create({
      fullName,
      age,
      gender,
      phone,
      doctorId,
      diaryId,
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
    let doctorId = req.user.id;
    const role = req.user.role;

    if (role !== UserRole.DOCTOR && role !== UserRole.ASSISTANT) {
      return res.status(403).json({ message: "Only doctors and assistants can create patients" });
    }
    const userData = await AppUser.findByPk(req.user.id);
    if (userData?.role == UserRole.ASSISTANT) {
      doctorId = userData.parentId;
    }

    const doctor = await AppUser.findByPk(doctorId, {
      attributes: ["id", "fullName", "email"],
      include: [
        {
          model: Patient,
          attributes: ["id", "fullName", "age", "gender", "diaryId"],
        },
      ],
    });

    return res.json(doctor);
  } catch (error) {
    return res.status(500).json({ message: "Server error" });
  }
};
