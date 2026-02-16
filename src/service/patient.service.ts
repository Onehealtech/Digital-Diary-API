import { Patient } from "../models/Patient";
import { Diary } from "../models/Diary";
import { ScanLog } from "../models/ScanLog";
import { AppUser } from "../models/Appuser";
import { VendorProfile } from "../models/VendorProfile";
import { Op } from "sequelize";

interface PrescribeTestData {
  testName: string;
  testType: "major" | "normal";
  prescribedDate?: Date;
}

interface UpdateTestStatusData {
  testName: string;
  completed?: boolean;
  completedDate?: Date;
  reportReceived?: boolean;
  reportReceivedDate?: Date;
}

interface CallLogData {
  callDate?: Date;
  outcome: "answered" | "no-answer" | "busy" | "wrong-number";
  notes?: string;
  followUpRequired?: boolean;
  followUpDate?: Date;
}

class PatientService {
  /**
   * Get patient by ID with full details
   * Includes test status, diary info, scan logs
   */
  async getPatientById(patientId: string, requesterId: string, role: string) {
    const whereClause: any = { id: patientId };

    // Role-based filtering
    if (role === "DOCTOR") {
      whereClause.doctorId = requesterId;
    } else if (role === "ASSISTANT") {
      // Assistant can view their doctor's patients
      const assistant = await AppUser.findByPk(requesterId);
      if (!assistant || !assistant.parentId) {
        throw new Error("Assistant not linked to a doctor");
      }
      whereClause.doctorId = assistant.parentId;
    } else if (role === "VENDOR") {
      // Vendor can only view patients they sold diaries to
      whereClause.vendorId = requesterId;
    }

    const patient = await Patient.findOne({
      where: whereClause,
      include: [
        {
          model: AppUser,
          as: "doctor",
          attributes: ["id", "fullName", "email", "phoneNumber"],
        },
        {
          model: AppUser,
          as: "vendor",
          attributes: ["id", "fullName", "phoneNumber"],
        },
        {
          model: Diary,
          as: "diary",
          attributes: ["id", "status", "saleAmount", "activatedAt"],
        },
      ],
    });

    if (!patient) {
      throw new Error("Patient not found or access denied");
    }

    // Get scan logs count
    const totalScans = await ScanLog.count({
      where: { patientId },
    });

    const unreviewed = await ScanLog.count({
      where: { patientId, doctorReviewed: false },
    });

    const flagged = await ScanLog.count({
      where: { patientId, flagged: true },
    });

    // Get recent scans
    const recentScans = await ScanLog.findAll({
      where: { patientId },
      order: [["createdAt", "DESC"]],
      limit: 5,
      attributes: ["id", "pageType", "doctorReviewed", "flagged", "createdAt"],
    });

    return {
      ...patient.toJSON(),
      scanStats: {
        total: totalScans,
        unreviewed,
        flagged,
      },
      recentScans,
    };
  }

  /**
   * Update patient details
   */
  async updatePatient(
    patientId: string,
    requesterId: string,
    role: string,
    updates: Partial<Patient>
  ) {
    // Find patient with role-based filtering
    const whereClause: any = { id: patientId };

    if (role === "DOCTOR") {
      whereClause.doctorId = requesterId;
    } else if (role === "ASSISTANT") {
      const assistant = await AppUser.findByPk(requesterId);
      if (!assistant || !assistant.parentId) {
        throw new Error("Assistant not linked to a doctor");
      }
      whereClause.doctorId = assistant.parentId;
    } else {
      throw new Error("Only doctors and assistants can update patient details");
    }

    const patient = await Patient.findOne({ where: whereClause });

    if (!patient) {
      throw new Error("Patient not found or access denied");
    }

    // Restrict what can be updated
    const allowedUpdates = [
      "name",
      "phoneNumber",
      "address",
      "age",
      "gender",
      "stage",
      "treatmentPlan",
    ];

    const updateData: any = {};
    for (const key of allowedUpdates) {
      if (updates[key as keyof Patient] !== undefined) {
        updateData[key] = updates[key as keyof Patient];
      }
    }

    await patient.update(updateData);

    return patient;
  }

  /**
   * Prescribe tests to a patient
   */
  async prescribeTests(
    patientId: string,
    doctorId: string,
    tests: PrescribeTestData[]
  ) {
    const patient = await Patient.findOne({
      where: { id: patientId, doctorId },
    });

    if (!patient) {
      throw new Error("Patient not found");
    }

    // Get current prescribed tests
    const currentTests = (patient.prescribedTests as any[]) || [];

    // Add new tests
    const newTests = tests.map((test) => ({
      testName: test.testName,
      testType: test.testType,
      prescribedDate: test.prescribedDate || new Date(),
      completed: false,
      reportReceived: false,
    }));

    const updatedTests = [...currentTests, ...newTests];

    // Update patient
    await patient.update({
      prescribedTests: updatedTests,
      totalTestsPrescribed: updatedTests.length,
    });

    // Recalculate test completion percentage
    await this.updateTestCompletionPercentage(patientId);

    return patient;
  }

  /**
   * Update test status (completed, report received)
   */
  async updateTestStatus(
    patientId: string,
    doctorId: string,
    updates: UpdateTestStatusData
  ) {
    const patient = await Patient.findOne({
      where: { id: patientId, doctorId },
    });

    if (!patient) {
      throw new Error("Patient not found");
    }

    const prescribedTests = (patient.prescribedTests as any[]) || [];

    // Find the test and update it
    const testIndex = prescribedTests.findIndex(
      (test: any) => test.testName === updates.testName
    );

    if (testIndex === -1) {
      throw new Error("Test not found in patient's prescribed tests");
    }

    if (updates.completed !== undefined) {
      prescribedTests[testIndex].completed = updates.completed;
      prescribedTests[testIndex].completedDate = updates.completedDate || new Date();
    }

    if (updates.reportReceived !== undefined) {
      prescribedTests[testIndex].reportReceived = updates.reportReceived;
      prescribedTests[testIndex].reportReceivedDate =
        updates.reportReceivedDate || new Date();
    }

    await patient.update({
      prescribedTests,
    });

    // Recalculate test stats
    await this.updateTestCompletionPercentage(patientId);

    return patient;
  }

  /**
   * Log a call attempt to a patient
   */
  async logCallAttempt(
    patientId: string,
    requesterId: string,
    role: string,
    callData: CallLogData
  ) {
    // Verify access
    const whereClause: any = { id: patientId };

    if (role === "DOCTOR") {
      whereClause.doctorId = requesterId;
    } else if (role === "ASSISTANT") {
      const assistant = await AppUser.findByPk(requesterId);
      if (!assistant || !assistant.parentId) {
        throw new Error("Assistant not linked to a doctor");
      }
      whereClause.doctorId = assistant.parentId;
    } else {
      throw new Error("Only doctors and assistants can log call attempts");
    }

    const patient = await Patient.findOne({ where: whereClause });

    if (!patient) {
      throw new Error("Patient not found or access denied");
    }

    // Update last contact date
    await patient.update({
      lastDoctorContact: callData.callDate || new Date(),
    });

    // Create a call log entry (we could create a CallLog model later, for now just update patient)
    // In the future, you might want to create a separate CallLog model

    return {
      patientId: patient.id,
      patientName: patient.fullName,
      callDate: callData.callDate || new Date(),
      outcome: callData.outcome,
      notes: callData.notes,
      followUpRequired: callData.followUpRequired,
      followUpDate: callData.followUpDate,
      lastDoctorContact: patient.lastDoctorContact,
    };
  }

  /**
   * Get test progress for a patient
   */
  async getTestProgress(patientId: string, requesterId: string, role: string) {
    const whereClause: any = { id: patientId };

    if (role === "DOCTOR") {
      whereClause.doctorId = requesterId;
    } else if (role === "ASSISTANT") {
      const assistant = await AppUser.findByPk(requesterId);
      if (!assistant || !assistant.parentId) {
        throw new Error("Assistant not linked to a doctor");
      }
      whereClause.doctorId = assistant.parentId;
    }

    const patient = await Patient.findOne({ where: whereClause });

    if (!patient) {
      throw new Error("Patient not found or access denied");
    }

    const prescribedTests = (patient.prescribedTests as any[]) || [];

    const completed = prescribedTests.filter((test: any) => test.completed).length;
    const reportsReceived = prescribedTests.filter(
      (test: any) => test.reportReceived
    ).length;

    return {
      patientId: patient.id,
      patientName: patient.fullName,
      totalTestsPrescribed: patient.totalTestsPrescribed,
      testsCompleted: completed,
      reportsReceived,
      testCompletionPercentage: patient.testCompletionPercentage,
      prescribedTests,
      canStartTreatment:
        patient.testCompletionPercentage >= 70 && reportsReceived >= 5, // Example logic
    };
  }

  /**
   * Helper: Update test completion percentage
   */
  private async updateTestCompletionPercentage(patientId: string) {
    const patient = await Patient.findByPk(patientId);

    if (!patient) {
      return;
    }

    const prescribedTests = (patient.prescribedTests as any[]) || [];
    const total = prescribedTests.length;

    if (total === 0) {
      await patient.update({
        testsCompleted: 0,
        reportsReceived: 0,
        testCompletionPercentage: 0,
      });
      return;
    }

    const completed = prescribedTests.filter((test: any) => test.completed).length;
    const reportsReceived = prescribedTests.filter(
      (test: any) => test.reportReceived
    ).length;
    const percentage = Math.round((reportsReceived / total) * 100);

    await patient.update({
      testsCompleted: completed,
      reportsReceived,
      testCompletionPercentage: percentage,
    });
  }

  /**
   * Get patients needing follow-up
   * (No recent contact or incomplete tests)
   */
  async getPatientsNeedingFollowUp(doctorId: string) {
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const patients = await Patient.findAll({
      where: {
        doctorId,
        [Op.or]: [
          // No recent contact
          {
            lastDoctorContact: {
              [Op.or]: [{ [Op.is]: null }, { [Op.lt]: sevenDaysAgo }],
            },
          },
          // Incomplete tests
          {
            totalTestsPrescribed: { [Op.gt]: 0 },
            testCompletionPercentage: { [Op.lt]: 100 },
          },
        ],
      },
      attributes: [
        "id",
        "name",
        "phoneNumber",
        "lastDoctorContact",
        "totalTestsPrescribed",
        "testCompletionPercentage",
      ],
      order: [["lastDoctorContact", "ASC"]],
    });

    return patients;
  }
}

export const patientService = new PatientService();
