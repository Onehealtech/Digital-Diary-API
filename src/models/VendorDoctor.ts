import {
  Table,
  Column,
  Model,
  DataType,
  ForeignKey,
  BelongsTo,
  Unique,
} from "sequelize-typescript";
import { AppUser } from "./Appuser";
import { DoctorOnboardRequest } from "./DoctorOnboardRequest";

@Table({
  tableName: "vendor_doctors",
  timestamps: true,
})
export class VendorDoctor extends Model {
  @Column({
    type: DataType.UUID,
    defaultValue: DataType.UUIDV4,
    primaryKey: true,
  })
  id!: string;

  @ForeignKey(() => AppUser)
  @Column({ type: DataType.UUID, allowNull: false })
  vendorId!: string;

  @BelongsTo(() => AppUser, "vendorId")
  vendor?: AppUser;

  @ForeignKey(() => AppUser)
  @Column({ type: DataType.UUID, allowNull: false })
  doctorId!: string;

  @BelongsTo(() => AppUser, "doctorId")
  doctor?: AppUser;

  // Who created this assignment (SuperAdmin ID)
  @ForeignKey(() => AppUser)
  @Column({ type: DataType.UUID, allowNull: true })
  assignedBy?: string;

  // Link back to the onboard request that created this (null for direct admin assignments)
  @ForeignKey(() => DoctorOnboardRequest)
  @Column({ type: DataType.UUID, allowNull: true })
  onboardRequestId?: string;

  @BelongsTo(() => DoctorOnboardRequest, "onboardRequestId")
  onboardRequest?: DoctorOnboardRequest;
}
