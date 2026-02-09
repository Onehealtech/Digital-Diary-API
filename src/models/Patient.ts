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
    allowNull: false,
  })
  stickerId!: string;

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

  // 🔗 Foreign Key → Doctor
  @ForeignKey(() => AppUser)
  @Column({
    type: DataType.UUID,
    allowNull: false,
  })
  doctorId!: string;

  @BelongsTo(() => AppUser)
  doctor!: AppUser;
}
