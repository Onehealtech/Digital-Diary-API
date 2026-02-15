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
  tableName: "transactions",
  timestamps: true,
})
export class Transaction extends Model {
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
    type: DataType.ENUM("sale", "commission", "payout", "refund"),
    allowNull: false,
  })
  type!: "sale" | "commission" | "payout" | "refund";

  @Column({
    type: DataType.DECIMAL(10, 2),
    allowNull: false,
  })
  amount!: number;

  @Column({
    type: DataType.DECIMAL(10, 2),
    allowNull: false,
  })
  balanceBefore!: number;

  @Column({
    type: DataType.DECIMAL(10, 2),
    allowNull: false,
  })
  balanceAfter!: number;

  @Column(DataType.STRING)
  diaryId?: string;

  @Column(DataType.TEXT)
  description?: string;

  @Column(DataType.STRING)
  paymentMethod?: string;

  @Column({
    type: DataType.UUID,
    allowNull: true,
  })
  processedBy?: string; // Super Admin ID

  @Column({
    type: DataType.DATE,
    defaultValue: DataType.NOW,
  })
  timestamp!: Date;
}
