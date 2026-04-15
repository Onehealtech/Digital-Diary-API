import {
  Table,
  Column,
  Model,
  DataType,
  ForeignKey,
  BelongsTo,
} from "sequelize-typescript";
import { AppUser } from "./Appuser";
import { Patient } from "./Patient";

@Table({
  tableName: "notifications",
  timestamps: true,
})
export class Notification extends Model {
  @Column({
    type: DataType.UUID,
    defaultValue: DataType.UUIDV4,
    primaryKey: true,
  })
  id!: string;

  @Column({
    type: DataType.UUID,
    allowNull: false,
  })
  recipientId!: string;

  @Column({
    type: DataType.ENUM("patient", "staff"),
    allowNull: false,
  })
  recipientType!: "patient" | "staff";

  @ForeignKey(() => AppUser)
  @Column({
    type: DataType.UUID,
    allowNull: false,
  })
  senderId!: string;

  @BelongsTo(() => AppUser, { foreignKey: "senderId", as: "sender" })
  sender?: AppUser;

  @Column({
    type: DataType.ENUM("alert", "info", "reminder", "task-assigned", "test-result"),
    allowNull: false,
  })
  type!: "alert" | "info" | "reminder" | "task-assigned" | "test-result";

  @Column({
    type: DataType.ENUM("low", "medium", "high", "critical"),
    defaultValue: "low",
  })
  severity!: "low" | "medium" | "high" | "critical";

  @Column({
    type: DataType.STRING,
    allowNull: false,
  })
  title!: string;

  @Column({
    type: DataType.TEXT,
    allowNull: false,
  })
  message!: string;

  @Column({
    type: DataType.UUID,
    allowNull: true,
  })
  relatedTaskId?: string;

  @Column(DataType.STRING)
  relatedTestName?: string;

  @Column(DataType.STRING)
  actionUrl?: string;

  @Column({
    type: DataType.BOOLEAN,
    defaultValue: false,
  })
  read!: boolean;

  @Column(DataType.DATE)
  readAt?: Date;

  @Column({
    type: DataType.ENUM("in-app", "sms", "email"),
    defaultValue: "in-app",
  })
  deliveryMethod!: "in-app" | "sms" | "email";

  @Column({
    type: DataType.BOOLEAN,
    defaultValue: false,
  })
  delivered!: boolean;

  @Column({
    type: DataType.TEXT,
    allowNull: true,
  })
  responseMessage?: string;

  @Column({
    type: DataType.DATE,
    allowNull: true,
  })
  respondedAt?: Date;

  @ForeignKey(() => Patient)
  @Column({
    type: DataType.UUID,
    allowNull: true,
  })
  responseId?: string; // patientId

  @BelongsTo(() => Patient, { foreignKey: "responseId", as: "responseBy" })
  responseBy?: Patient;

  @Column({
    type: DataType.BOOLEAN,
    defaultValue: false,
  })
  isResponded!: boolean;

  @Column({
    type: DataType.STRING,
    allowNull: true,
  })
  attachmentUrl?: string;
}
