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
  tableName: "doctor_patient_history",
  timestamps: true,
})
export class DoctorPatientHistory extends Model {
  @Column({
    type: DataType.UUID,
    defaultValue: DataType.UUIDV4,
    primaryKey: true,
  })
  id!: string;

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

  @BelongsTo(() => AppUser)
  doctor!: AppUser;

  @Column({
    type: DataType.DATE,
    allowNull: false,
  })
  assignedAt!: Date;

  @Column({
    type: DataType.DATE,
    allowNull: true,
  })
  unassignedAt?: Date;
}
