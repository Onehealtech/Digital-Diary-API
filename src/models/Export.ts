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
  tableName: "exports",
  timestamps: true,
})
export class Export extends Model {
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
  userId!: string;

  @BelongsTo(() => AppUser)
  user!: AppUser;

  @Column({
    type: DataType.ENUM("patient-data", "test-reports", "diary-pages"),
    allowNull: false,
  })
  type!: "patient-data" | "test-reports" | "diary-pages";

  @ForeignKey(() => Patient)
  @Column({
    type: DataType.UUID,
    allowNull: false,
  })
  patientId!: string;

  @BelongsTo(() => Patient)
  patient!: Patient;

  @Column({
    type: DataType.ENUM("pdf", "excel", "csv", "zip"),
    allowNull: false,
  })
  format!: "pdf" | "excel" | "csv" | "zip";

  @Column({
    type: DataType.STRING,
    allowNull: false,
  })
  downloadUrl!: string;

  @Column({
    type: DataType.INTEGER,
    defaultValue: 0,
  })
  fileSize!: number;

  @Column({
    type: DataType.DATE,
    allowNull: false,
  })
  expiresAt!: Date;
}
