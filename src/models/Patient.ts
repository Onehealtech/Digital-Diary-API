import {
  Table,
  Column,
  Model,
  DataType,
  ForeignKey,
  BelongsTo,
  BeforeCreate,
} from "sequelize-typescript";
import { AppUser } from "./Appuser";

@Table({
  tableName: "patients",
  timestamps: true,
})
export class Patient extends Model {
  @Column({
    type: DataType.UUID,
    defaultValue: DataType.UUIDV4,
    primaryKey: true,
  })
  id!: string;

  @Column({
    type: DataType.STRING,
    unique: true,
  })
  patientCode!: string;

  @Column({
    type: DataType.STRING,
    allowNull: false,
  })
  fullName!: string;

  @Column(DataType.INTEGER)
  age?: number;

  @Column(DataType.STRING)
  gender?: string;

  @Column(DataType.STRING)
  phone?: string;

  // 🔗 Foreign Key → Doctor
  @ForeignKey(() => AppUser)
  @Column({
    type: DataType.UUID,
    allowNull: false,
  })
  doctorId!: string;

  @BelongsTo(() => AppUser)
  doctor!: AppUser;

  @BeforeCreate
  static async generatePatientCode(instance: Patient) {
    const lastPatient = await Patient.findOne({
      order: [["createdAt", "DESC"]],
    });

    const lastNumber = lastPatient
      ? parseInt(lastPatient.patientCode.replace("P", ""))
      : 0;

    instance.patientCode = `P${String(lastNumber + 1).padStart(3, "0")}`;
  }
}
