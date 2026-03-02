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
import { DiaryTemplate } from "./DiaryTemplate";

@Table({
  tableName: "diaries",
  timestamps: true,
})
export class Diary extends Model {

  @Column({
    type: DataType.STRING,
    primaryKey: true,
  })
  id!: string;

  // ================== PATIENT ==================
  @ForeignKey(() => Patient)
  @Column({
    type: DataType.UUID,
    allowNull: false,
  })
  patientId!: string;

  @BelongsTo(() => Patient, {
    foreignKey: "patientId",
    as: "patient",
  })
  patient!: Patient;

  // ================== DOCTOR ==================
  @ForeignKey(() => AppUser)
  @Column({
    type: DataType.UUID,
    allowNull: false,
  })
  doctorId!: string;

  @BelongsTo(() => AppUser, {
    foreignKey: "doctorId",
    as: "doctor",
  })
  doctor!: AppUser;

  @ForeignKey(() => DiaryTemplate)
  @Column({ type: DataType.UUID, allowNull: true })
  templateId!: string;

  @BelongsTo(() => DiaryTemplate)
  template!: DiaryTemplate;

  @Column({
    type: DataType.JSONB,
    allowNull: true,
  })
  diaryData!: any;

  // ================== VENDOR ==================
  @ForeignKey(() => AppUser)
  @Column({
    type: DataType.UUID,
    allowNull: false,
  })
  vendorId!: string;

  @BelongsTo(() => AppUser, {
    foreignKey: "vendorId",
    as: "vendor",
  })
  vendor!: AppUser;

  // ================== STATUS ==================
  @Column({
    type: DataType.ENUM(
      "pending",
      "active",
      "inactive",
      "rejected",
      "completed"
    ),
    defaultValue: "pending",
  })
  status!: "pending" | "active" | "inactive" | "rejected" | "completed";

  @Column(DataType.DATE)
  activationDate?: Date;

  @Column(DataType.STRING(255))
  diaryType?: string;

  @Column({
    type: DataType.UUID,
    allowNull: true,
  })
  approvedBy?: string;

  @Column(DataType.DATE)
  approvedAt?: Date;

  @Column(DataType.TEXT)
  rejectionReason?: string;

  @Column({
    type: DataType.DECIMAL(10, 2),
    defaultValue: 500,
  })
  saleAmount!: number;

  @Column({
    type: DataType.DECIMAL(10, 2),
    defaultValue: 50,
  })
  commissionAmount!: number;

  @Column({
    type: DataType.BOOLEAN,
    defaultValue: false,
  })
  commissionPaid!: boolean;
}

