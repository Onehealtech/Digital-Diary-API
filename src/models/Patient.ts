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
    allowNull: true,
  })
  diaryId?: string;

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
    type: DataType.ENUM("ACTIVE", "CRITICAL", "COMPLETED", "INACTIVE", "ON_HOLD", "DOCTOR_REASSIGNED"),
    defaultValue: "ACTIVE",
  })
  status!: "ACTIVE" | "CRITICAL" | "COMPLETED" | "INACTIVE" | "ON_HOLD" | "DOCTOR_REASSIGNED";

  @Column({
    type: DataType.TEXT,
    allowNull: true,
  })
  deactivationReason?: string;

  @Column({
    type: DataType.DATE,
    allowNull: true,
  })
  deactivatedAt?: Date;

  @Column({
    type: DataType.UUID,
    allowNull: true,
  })
  deactivatedBy?: string;

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

  @Column({
    type: DataType.INTEGER,
    defaultValue: 0,
    allowNull: false,
  })
  onboardingViewCount!: number;

  @Column({
    type: DataType.ENUM("VENDOR_ASSIGNED", "SELF_SIGNUP"),
    defaultValue: "VENDOR_ASSIGNED",
    allowNull: false,
  })
  registrationSource!: "VENDOR_ASSIGNED" | "SELF_SIGNUP";

  @Column({
    type: DataType.ENUM("en", "hi"),
    defaultValue: "en",
    allowNull: false,
  })
  language!: "en" | "hi";

  @Column({
    type: DataType.INTEGER,
    allowNull: false,
    defaultValue: 0,
  })
  tokenVersion!: number;

  // 🔗 Foreign Key → Doctor (nullable for self-signup patients awaiting doctor acceptance)
  @ForeignKey(() => AppUser)
  @Column({
    type: DataType.UUID,
    allowNull: true,
  })
  doctorId?: string;

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
