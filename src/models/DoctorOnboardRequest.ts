import {
  Table,
  Column,
  Model,
  DataType,
  ForeignKey,
  BelongsTo,
} from "sequelize-typescript";
import { AppUser } from "./Appuser";

@Table({
  tableName: "doctor_onboard_requests",
  timestamps: true,
  paranoid: true,
})
export class DoctorOnboardRequest extends Model {
  @Column({
    type: DataType.UUID,
    defaultValue: DataType.UUIDV4,
    primaryKey: true,
  })
  id!: string;

  @ForeignKey(() => AppUser)
  @Column({
    type: DataType.UUID,
    allowNull: false,
  })
  vendorId!: string;

  @BelongsTo(() => AppUser, "vendorId")
  vendor?: AppUser;

  @Column({
    type: DataType.ENUM("PENDING", "APPROVED", "REJECTED"),
    allowNull: false,
    defaultValue: "PENDING",
  })
  status!: "PENDING" | "APPROVED" | "REJECTED";

  // Doctor profile data submitted by the vendor
  @Column({ type: DataType.STRING(255), allowNull: false })
  fullName!: string;

  @Column({ type: DataType.STRING(255), allowNull: false })
  email!: string;

  @Column({ type: DataType.STRING(50), allowNull: true })
  phone?: string;

  @Column({ type: DataType.STRING(255), allowNull: true })
  hospital?: string;

  @Column({ type: DataType.STRING(255), allowNull: true })
  specialization?: string;

  @Column({ type: DataType.STRING(30), allowNull: true })
  license?: string;

  @Column({ type: DataType.STRING(255), allowNull: true })
  commissionType?: string;

  @Column({ type: DataType.FLOAT, allowNull: true })
  commissionRate?: number;

  @Column({ type: DataType.JSONB, allowNull: true })
  bankDetails?: Record<string, unknown>;

  // Approval/rejection metadata
  @Column({ type: DataType.TEXT, allowNull: true })
  rejectionReason?: string;

  @ForeignKey(() => AppUser)
  @Column({ type: DataType.UUID, allowNull: true })
  reviewedBy?: string;

  @BelongsTo(() => AppUser, "reviewedBy")
  reviewer?: AppUser;

  @Column({ type: DataType.DATE, allowNull: true })
  reviewedAt?: Date;

  // Set when approved — links to the created doctor AppUser
  @ForeignKey(() => AppUser)
  @Column({ type: DataType.UUID, allowNull: true })
  doctorId?: string;

  @BelongsTo(() => AppUser, "doctorId")
  doctor?: AppUser;
}
