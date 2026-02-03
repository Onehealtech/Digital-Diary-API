import { Request, Response } from "express";
import { DoctorAuthService } from "../service/auth.service";

export class DoctorAuthController {
  static async register(req: Request, res: Response) {
    try {
      const doctor = await DoctorAuthService.register(req.body);

      return res.status(201).json({
        message: "Doctor registered successfully",
        data: {
          id: doctor.id,
          fullName: doctor.fullName,
          email: doctor.email,
        },
      });
    } catch (error: any) {
      return res.status(400).json({ message: error.message });
    }
  }

  static async login(req: Request, res: Response) {
    try {
      const { email, password } = req.body;

      const result = await DoctorAuthService.login(email, password);

      return res.json({
        message: "Login successful",
        token: result.token,
        doctor: {
          id: result.doctor.id,
          fullName: result.doctor.fullName,
          email: result.doctor.email,
        },
      });
    } catch (error: any) {
      return res.status(401).json({ message: error.message });
    }
  }
}
