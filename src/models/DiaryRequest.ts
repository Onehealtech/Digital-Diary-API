import {
  Table,
  Column,
  Model,
  DataType,
  ForeignKey,
  BelongsTo,
} from "sequelize-typescript";
import { AppUser } from "./Appuser";

@Table({
  tableName: "diary_requests",
  timestamps: true,
})
export class DiaryRequest extends Model {
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
  vendorId!: string;

  @BelongsTo(() => AppUser)
  vendor!: AppUser;

  @Column({
    type: DataType.INTEGER,
    allowNull: false,
  })
  quantity!: number;

  @Column(DataType.TEXT)
  message?: string;

  @Column({
    type: DataType.ENUM("pending", "fulfilled", "rejected"),
    defaultValue: "pending",
  })
  status!: "pending" | "fulfilled" | "rejected";

  @Column({
    type: DataType.DATE,
    defaultValue: DataType.NOW,
  })
  requestDate!: Date;

  @Column(DataType.DATE)
  fulfilledDate?: Date;

  @Column({
    type: DataType.UUID,
    allowNull: true,
  })
  fulfilledBy?: string; // Super Admin ID

  @Column(DataType.TEXT)
  rejectionReason?: string;

  @Column({
    type: DataType.JSONB,
    allowNull: true,
  })
  assignedDiaryIds?: string[];
}
