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
  tableName: "tasks",
  timestamps: true,
})
export class Task extends Model {
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
  createdBy!: string; // Doctor ID

  @BelongsTo(() => AppUser, "createdBy")
  creator!: AppUser;

  @ForeignKey(() => AppUser)
  @Column({
    type: DataType.UUID,
    allowNull: false,
  })
  assignedTo!: string; // Assistant ID

  @BelongsTo(() => AppUser, "assignedTo")
  assignee!: AppUser;

  @Column({
    type: DataType.STRING,
    allowNull: false,
  })
  title!: string;

  @Column(DataType.TEXT)
  description?: string;

  @Column({
    type: DataType.ENUM("review-entries", "call-patients", "send-reminders", "follow-up", "export-data", "other"),
    allowNull: false,
  })
  taskType!: "review-entries" | "call-patients" | "send-reminders" | "follow-up" | "export-data" | "other";

  @Column({
    type: DataType.ENUM("low", "medium", "high", "urgent"),
    defaultValue: "medium",
  })
  priority!: "low" | "medium" | "high" | "urgent";

  @Column({
    type: DataType.JSONB,
    allowNull: true,
  })
  relatedPatientIds?: string[];

  @Column({
    type: DataType.ENUM("pending", "in-progress", "completed", "cancelled"),
    defaultValue: "pending",
  })
  status!: "pending" | "in-progress" | "completed" | "cancelled";

  @Column({
    type: DataType.DATE,
    allowNull: false,
  })
  dueDate!: Date;

  @Column(DataType.DATE)
  completedAt?: Date;

  @Column(DataType.TEXT)
  completionNotes?: string;

  @Column({
    type: DataType.BOOLEAN,
    defaultValue: false,
  })
  notificationSent!: boolean;

  @Column({
    type: DataType.BOOLEAN,
    defaultValue: false,
  })
  reminderSent!: boolean;
}
