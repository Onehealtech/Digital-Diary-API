import {
  Table,
  Column,
  Model,
  DataType,
  ForeignKey,
  BelongsTo,
} from "sequelize-typescript";
import { Patient } from "./Patient";
import { SubscriptionPlan } from "./SubscriptionPlan";
import { AppUser } from "./Appuser";

@Table({
  tableName: "user_subscriptions",
  timestamps: true,
})
export class UserSubscription extends Model {
  @Column({
    type: DataType.UUID,
    defaultValue: DataType.UUIDV4,
    primaryKey: true,
  })
  id!: string;

  // Patient who subscribed
  @ForeignKey(() => Patient)
  @Column({
    type: DataType.UUID,
    allowNull: false,
  })
  patientId!: string;

  @BelongsTo(() => Patient)
  patient!: Patient;

  // Subscription plan
  @ForeignKey(() => SubscriptionPlan)
  @Column({
    type: DataType.UUID,
    allowNull: false,
  })
  planId!: string;

  @BelongsTo(() => SubscriptionPlan)
  plan!: SubscriptionPlan;

  // Assigned diary (auto-assigned on subscription)
  @Column({
    type: DataType.STRING,
    allowNull: true,
  })
  diaryId?: string;

  // Linked doctor
  @ForeignKey(() => AppUser)
  @Column({
    type: DataType.UUID,
    allowNull: true,
  })
  doctorId?: string;

  @BelongsTo(() => AppUser, "doctorId")
  doctor!: AppUser;

  // Subscription status
  @Column({
    type: DataType.ENUM("ACTIVE", "EXPIRED", "CANCELLED", "UPGRADED"),
    allowNull: false,
    defaultValue: "ACTIVE",
  })
  status!: "ACTIVE" | "EXPIRED" | "CANCELLED" | "UPGRADED";

  // Plan snapshot at time of subscription (so price changes don't affect existing)
  @Column({
    type: DataType.DECIMAL(10, 2),
    allowNull: false,
  })
  paidAmount!: number;

  @Column({
    type: DataType.INTEGER,
    allowNull: false,
  })
  maxDiaryPages!: number;

  @Column({
    type: DataType.BOOLEAN,
    allowNull: false,
    defaultValue: false,
  })
  scanEnabled!: boolean;

  @Column({
    type: DataType.BOOLEAN,
    allowNull: false,
    defaultValue: false,
  })
  manualEntryEnabled!: boolean;

  // Pages used tracking
  @Column({
    type: DataType.INTEGER,
    allowNull: false,
    defaultValue: 0,
  })
  pagesUsed!: number;

  // Payment reference
  @Column({
    type: DataType.STRING,
    allowNull: true,
  })
  paymentOrderId?: string;

  @Column({
    type: DataType.STRING,
    allowNull: true,
  })
  paymentMethod?: string;

  // Dates
  @Column({
    type: DataType.DATE,
    allowNull: false,
  })
  startDate!: Date;

  @Column({
    type: DataType.DATE,
    allowNull: false,
  })
  endDate!: Date;

  @Column({
    type: DataType.DATE,
    allowNull: true,
  })
  cancelledAt?: Date;
}
