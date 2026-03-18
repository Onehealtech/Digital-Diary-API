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
  tableName: "doctor_assignment_requests",
  timestamps: true,
})
export class DoctorAssignmentRequest extends Model {
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
    type: DataType.ENUM("PENDING", "ACCEPTED", "REJECTED"),
    defaultValue: "PENDING",
    allowNull: false,
  })
  status!: "PENDING" | "ACCEPTED" | "REJECTED";

  @Column({
    type: DataType.TEXT,
    allowNull: true,
  })
  rejectionReason?: string;

  @Column({
    type: DataType.DATE,
    allowNull: true,
  })
  respondedAt?: Date;

  @Column({
    type: DataType.INTEGER,
    allowNull: false,
    defaultValue: 1,
  })
  attemptNumber!: number;
}
