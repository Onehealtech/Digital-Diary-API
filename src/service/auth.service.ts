import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { AppUser } from "../models/Appuser";
import dotenv from "dotenv";

dotenv.config(); // ✅ MUST be first
export class DoctorAuthService {
  static async register(data: {
    fullName: string;
    email: string;
    password: string;
    address: string;
    phone?: string;
  }) {
    const existing = await AppUser.findOne({
      where: { email: data.email },
    });

    if (existing) {
      throw new Error("Doctor already exists");
    }


    const doctor = await AppUser.create({
      fullName: data.fullName,
      email: data.email.toLowerCase(),
      password: data.password.trim(), // ✅ plain password only
      address: data.address,
      phone: data.phone,
      role: "doctor",
    });


    return doctor;
  }

  static async login(email: string, password: string) {
    const doctor = await AppUser.findOne({
      where: { email: email.toLowerCase(), role: "doctor" },
    });

    if (!doctor) {
      throw new Error("Doctor not found");
    }

    const isMatch = await bcrypt.compare(password.trim(), doctor.password);
    if (!isMatch) {
      throw new Error("Invalid credentials");
    }

    const token = jwt.sign(
      {
        id: doctor.id,
        role: doctor.role,
        fullName: doctor.fullName,
        email: doctor.email,
      },
      process.env.JWT_SECRET!,
      { expiresIn: "7d" }
    );

    return { token, doctor };
  }

}
