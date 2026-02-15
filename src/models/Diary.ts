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

@Table({
  tableName: "diaries",
  timestamps: true,
})
export class Diary extends Model {
  @Column({
    type: DataType.STRING,
    primaryKey: true,
  })
  id!: string; // Same as GeneratedDiary ID

  @ForeignKey(() => Patient)
  @Column({
    type: DataType.UUID,
    allowNull: false,
  })
  patientId!: string;

  @BelongsTo(() => Patient)
  patient!: Patient;

  @ForeignKey(() => AppUser)
  @Column({
    type: DataType.UUID,
    allowNull: false,
  })
  doctorId!: string;

  @BelongsTo(() => AppUser, "doctorId")
  doctor!: AppUser;

  @Column({
    type: DataType.UUID,
    allowNull: false,
  })
  vendorId!: string;

  @Column({
    type: DataType.ENUM("pending", "active", "inactive", "rejected", "completed"),
    defaultValue: "pending",
  })
  status!: "pending" | "active" | "inactive" | "rejected" | "completed";

  @Column(DataType.DATE)
  activationDate?: Date;

  @Column({
    type: DataType.UUID,
    allowNull: true,
  })
  approvedBy?: string; // Super Admin ID

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
