// src/models/walletTransaction.model.ts

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
  Index,
} from "sequelize-typescript";
import { Wallet } from "./Wallet";
import { Diary } from "./Diary";


@Table({
  tableName: "wallet_transactions",
  timestamps: true,
})
export class WalletTransaction extends Model<WalletTransaction> {
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
  @Column(DataType.ENUM("CREDIT", "DEBIT"))
  type!: "CREDIT" | "DEBIT";

  @Column({
    type: DataType.STRING,
    unique: false,
    allowNull: true,
  })
  diaryId!: string;

  @AllowNull(false)
  @Column(DataType.DECIMAL(12, 2))
  amount!: number;

  @AllowNull(false)
  @Column(DataType.DECIMAL(12, 2))
  balanceAfter!: number;

  @AllowNull(false)
  @Index
  @Column(
    DataType.ENUM(
      "DIARY_SALE",
      "PAYOUT",
      "MANUAL_CREDIT",
      "ADVANCE_PAYMENT",
      "MANUAL_DEBIT",
      "REFUND",
      "COMMISSION"
    )
  )
  category!: string;

  @AllowNull(false)
  @Column(DataType.STRING(500))
  description!: string;

  @Index
  @Column(DataType.ENUM("ORDER", "PAYOUT", "MANUAL", "REFUND"))
  referenceType!: string | null;

  @Index
  @Column(DataType.STRING(255))
  referenceId!: string | null;

  @Column(DataType.UUID)
  performedBy!: string | null;

  @Column(DataType.JSONB)
  metadata!: object | null;
}
