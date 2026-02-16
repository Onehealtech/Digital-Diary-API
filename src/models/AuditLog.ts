import {
  Table,
  Column,
  Model,
  DataType,
} from "sequelize-typescript";

@Table({
  tableName: "audit_logs",
  timestamps: true,
})
export class AuditLog extends Model {
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
  userId!: string;

  @Column({
    type: DataType.ENUM("super_admin", "doctor", "vendor", "assistant", "patient"),
    allowNull: false,
  })
  userRole!: "super_admin" | "doctor" | "vendor" | "assistant" | "patient";

  @Column({
    type: DataType.STRING,
    allowNull: false,
  })
  action!: string;

  @Column({
    type: DataType.JSONB,
    allowNull: false,
  })
  details!: object;

  @Column({
    type: DataType.STRING,
    allowNull: false,
  })
  ipAddress!: string;

  @Column(DataType.STRING)
  userAgent?: string;

  @Column({
    type: DataType.DATE,
    defaultValue: DataType.NOW,
  })
  timestamp!: Date;
}
