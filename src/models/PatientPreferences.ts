import {
  Table,
  Column,
  Model,
  DataType,
  ForeignKey,
  BelongsTo,
} from "sequelize-typescript";
import { Patient } from "./Patient";

@Table({
  tableName: "patient_preferences",
  timestamps: true,
})
export class PatientPreferences extends Model {
  @ForeignKey(() => Patient)
  @Column({
    type: DataType.UUID,
    primaryKey: true,
    allowNull: false,
  })
  patientId!: string;

  @BelongsTo(() => Patient)
  patient!: Patient;

  @Column({
    type: DataType.ENUM("device", "user"),
    defaultValue: "device",
    allowNull: false,
  })
  languageSource!: "device" | "user";
}
