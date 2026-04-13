import {
  Table, Column, Model, DataType, ForeignKey, BelongsTo,
} from "sequelize-typescript";
import { AppUser } from "./Appuser";

@Table({ tableName: "saved_filters", timestamps: true })
export class SavedFilter extends Model {
  @Column({
    type: DataType.UUID,
    defaultValue: DataType.UUIDV4,
    primaryKey: true,
  })
  id!: string;

  @Column({ type: DataType.STRING(100), allowNull: false })
  name!: string;

  @Column({ type: DataType.STRING(500), allowNull: true })
  description?: string;

  /** Hex colour the user picks, e.g. "#007787" */
  @Column({ type: DataType.STRING(20), allowNull: true })
  color?: string;

  @ForeignKey(() => AppUser)
  @Column({ type: DataType.UUID, allowNull: false })
  createdBy!: string;

  @BelongsTo(() => AppUser, { foreignKey: "createdBy", as: "creator" })
  creator!: AppUser;

  @Column({
    type: DataType.ENUM("DOCTOR", "SUPER_ADMIN"),
    allowNull: false,
  })
  creatorRole!: "DOCTOR" | "SUPER_ADMIN";

  /**
   * "personal"  – only the creator can see and use this filter
   * "global"    – Super Admin pushed this to specific doctors
   */
  @Column({
    type: DataType.ENUM("personal", "global"),
    allowNull: false,
    defaultValue: "personal",
  })
  scope!: "personal" | "global";

  /**
   * Relevant only when scope = "global".
   * Empty array means visible to ALL doctors.
   */
  @Column({
    type: DataType.JSONB,
    allowNull: false,
    defaultValue: [],
  })
  assignedDoctorIds!: string[];

  /** The serialised AdvancedAnalysisFilter (without page/limit/sortBy) */
  @Column({ type: DataType.JSONB, allowNull: false })
  filterConfig!: object;

  @Column({
    type: DataType.INTEGER,
    allowNull: false,
    defaultValue: 0,
  })
  usageCount!: number;

  @Column({
    type: DataType.BOOLEAN,
    allowNull: false,
    defaultValue: true,
  })
  isActive!: boolean;
}
