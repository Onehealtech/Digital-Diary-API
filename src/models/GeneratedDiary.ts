import {
  Table,
  Column,
  Model,
  DataType,
} from "sequelize-typescript";

@Table({
  tableName: "generated_diaries",
  timestamps: true,
})
export class GeneratedDiary extends Model {
  @Column({
    type: DataType.STRING,
    primaryKey: true,
  })
  id!: string; // Format: DRY-2026-BC-001

  @Column({
    type: DataType.STRING,
    defaultValue: "breast-cancer-treatment",
  })
  diaryType!: string;

  @Column({
    type: DataType.ENUM("unassigned", "assigned", "sold", "active"),
    defaultValue: "unassigned",
  })
  status!: "unassigned" | "assigned" | "sold" | "active";

  @Column({
    type: DataType.DATE,
    defaultValue: DataType.NOW,
  })
  generatedDate!: Date;

  @Column({
    type: DataType.UUID,
    allowNull: true,
  })
  assignedTo?: string; // Vendor ID

  @Column(DataType.DATE)
  assignedDate?: Date;

  @Column(DataType.STRING)
  qrCodeUrl?: string;

  @Column({
    type: DataType.UUID,
    allowNull: true,
  })
  soldTo?: string; // Patient ID

  @Column(DataType.DATE)
  soldDate?: Date;
}
