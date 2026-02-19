// src/models/payout.model.ts

import {
  Table,
  Column,
  Model,
  DataType,
  PrimaryKey,
  Default,
  AllowNull,
  ForeignKey,
  BelongsTo,
} from "sequelize-typescript";
import { Wallet } from "./Wallet";

@Table({
  tableName: "payouts",
  timestamps: true,
})
export class Payout extends Model<Payout> {
  @PrimaryKey
  @Default(DataType.UUIDV4)
  @Column(DataType.UUID)
  id!: string;

  @AllowNull(false)
  @ForeignKey(() => Wallet)
  @Column(DataType.UUID)
  walletId!: string;

  @BelongsTo(() => Wallet)
  wallet!: Wallet;

  @AllowNull(false)
  @Column(DataType.UUID)
  userId!: string;

  @AllowNull(false)
  @Column(DataType.DECIMAL(12, 2))
  amount!: number;

  @Default("PENDING")
  @Column(DataType.ENUM("PENDING", "PROCESSING", "SUCCESS", "FAILED"))
  status!: "PENDING" | "PROCESSING" | "SUCCESS" | "FAILED";

  @Column(DataType.STRING)
  cashfreeTransferId!: string | null;

  @Column(DataType.DATE)
  processedAt!: Date | null;

  @Column(DataType.STRING(500))
  failureReason!: string | null;
}
