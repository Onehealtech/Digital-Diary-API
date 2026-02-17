import {
  Table,
  Column,
  Model,
  DataType,
  ForeignKey,
  BelongsTo,
  HasOne,
  BeforeCreate,
} from "sequelize-typescript";
import { AppUser } from "./Appuser";
import { Diary } from "./Diary";

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
    allowNull: false,
  })
  diaryId!: string;

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

  @Column(DataType.TEXT)
  address?: string;

  @Column({
    type: DataType.UUID,
    allowNull: true,
  })
  vendorId?: string;

  @Column(DataType.STRING)
  stage?: string;

  @Column(DataType.TEXT)
  treatmentPlan?: string;

  @Column({
    type: DataType.JSONB,
    allowNull: true,
    defaultValue: [],
  })
  prescribedTests?: Array<{
    testName: string;
    testType: "major" | "normal";
    prescribedDate: Date;
    completed: boolean;
    completedDate?: Date;
    reportReceived: boolean;
    reportReceivedDate?: Date;
    reportUrl?: string;
  }>;

  @Column({
    type: DataType.INTEGER,
    defaultValue: 0,
  })
  totalTestsPrescribed!: number;

  @Column({
    type: DataType.INTEGER,
    defaultValue: 0,
  })
  testsCompleted!: number;

  @Column({
    type: DataType.INTEGER,
    defaultValue: 0,
  })
  reportsReceived!: number;

  @Column({
    type: DataType.FLOAT,
    defaultValue: 0,
  })
  testCompletionPercentage!: number;

  @Column(DataType.DATE)
  lastDiaryScan?: Date;

  @Column(DataType.DATE)
  lastDoctorContact?: Date;

  @Column(DataType.DATE)
  registeredDate?: Date;

  @Column({
    type: DataType.ENUM("ACTIVE", "CRITICAL", "COMPLETED"),
    defaultValue: "ACTIVE",
  })
  status!: "ACTIVE" | "CRITICAL" | "COMPLETED";

  @Column({
    type: DataType.ENUM(
      "PERI_OPERATIVE",
      "POST_OPERATIVE",
      "FOLLOW_UP",
      "CHEMOTHERAPY",
      "RADIOLOGY"
    ),
    allowNull: true,
  })
  caseType?:
    | "PERI_OPERATIVE"
    | "POST_OPERATIVE"
    | "FOLLOW_UP"
    | "CHEMOTHERAPY"
    | "RADIOLOGY";

  @Column({
    type: DataType.STRING,
    allowNull: true,
  })
  fcmToken?: string;

  // 🔗 Foreign Key → Doctor
  @ForeignKey(() => AppUser)
  @Column({
    type: DataType.UUID,
    allowNull: false,
  })
  doctorId!: string;

  @BelongsTo(() => AppUser)
  doctor!: AppUser;

  // 🔗 Association → Diary (One-to-One)
  // Patient.id is referenced by Diary.patientId
  @HasOne(() => Diary, {
    sourceKey: "id",
    foreignKey: "patientId",
    as: "diary",
  })
  diary?: Diary;
}
