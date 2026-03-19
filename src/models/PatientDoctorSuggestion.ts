import {
  Table,
  Column,
  Model,
  DataType,
  ForeignKey,
  BelongsTo,
} from "sequelize-typescript";
import { Patient } from "./Patient";
import { AppUser } from "./Appuser";

/**
 * When a self-signup patient can't find their doctor in the list,
 * they can suggest a new doctor to the Super Admin for onboarding.
 */
@Table({
  tableName: "patient_doctor_suggestions",
  timestamps: true,
})
export class PatientDoctorSuggestion extends Model {
  @Column({
    type: DataType.UUID,
    defaultValue: DataType.UUIDV4,
    primaryKey: true,
  })
  id!: string;

  @ForeignKey(() => Patient)
  @Column({
    type: DataType.UUID,
    allowNull: false,
  })
  patientId!: string;

  @BelongsTo(() => Patient)
  patient!: Patient;

  // Doctor details provided by patient
  @Column({
    type: DataType.STRING,
    allowNull: false,
  })
  doctorName!: string;

  @Column({
    type: DataType.STRING,
    allowNull: true,
  })
  doctorPhone?: string;

  @Column({
    type: DataType.STRING,
    allowNull: true,
  })
  doctorEmail?: string;

  @Column({
    type: DataType.STRING,
    allowNull: true,
  })
  hospital?: string;

  @Column({
    type: DataType.STRING,
    allowNull: true,
  })
  specialization?: string;

  @Column({
    type: DataType.STRING,
    allowNull: true,
  })
  city?: string;

  @Column({
    type: DataType.TEXT,
    allowNull: true,
  })
  additionalNotes?: string;

  // Admin workflow
  @Column({
    type: DataType.ENUM("PENDING", "APPROVED", "REJECTED"),
    defaultValue: "PENDING",
    allowNull: false,
  })
  status!: "PENDING" | "APPROVED" | "REJECTED";

  @ForeignKey(() => AppUser)
  @Column({
    type: DataType.UUID,
    allowNull: true,
  })
  reviewedBy?: string;

  @BelongsTo(() => AppUser, "reviewedBy")
  reviewer!: AppUser;

  @Column({
    type: DataType.DATE,
    allowNull: true,
  })
  reviewedAt?: Date;

  @Column({
    type: DataType.TEXT,
    allowNull: true,
  })
  rejectionReason?: string;

  // If approved, the created doctor's ID
  @Column({
    type: DataType.UUID,
    allowNull: true,
  })
  onboardedDoctorId?: string;
}
