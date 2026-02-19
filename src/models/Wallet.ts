// src/models/wallet.model.ts

import {
  Table,
  Column,
  Model,
  DataType,
  PrimaryKey,
  Default,
  AllowNull,
  Unique,
  ForeignKey,
  HasMany,
  BelongsTo,
} from "sequelize-typescript";
import { WalletTransaction } from "./walletTransaction.model";
import { Payout } from "./payout.model";
import { AppUser } from "./Appuser";

@Table({
  tableName: "wallets",
  timestamps: true,
})
export class Wallet extends Model<Wallet> {
  @PrimaryKey
  @Default(DataType.UUIDV4)
  @Column(DataType.UUID)
  id!: string;

 @ForeignKey(() => AppUser)
  @Column({
    type: DataType.UUID,
    allowNull: false,
  })
  userId!: string;

  @BelongsTo(() => AppUser, {
    foreignKey: "userId",
    as: "vendor",
  })
  vendor!: AppUser;
  
  @AllowNull(false)
  @Column(DataType.ENUM("VENDOR", "DOCTOR", "PLATFORM"))
  walletType!: "VENDOR" | "DOCTOR" | "PLATFORM";

  @AllowNull(false)
  @Default(0.0)
  @Column(DataType.DECIMAL(12, 2))
  balance!: number;

  @AllowNull(false)
  @Default(0.0)
  @Column(DataType.DECIMAL(12, 2))
  totalCredited!: number;

  @AllowNull(false)
  @Default(0.0)
  @Column(DataType.DECIMAL(12, 2))
  totalDebited!: number;

  @Default("INR")
  @Column(DataType.STRING(3))
  currency!: string;

  @Default(true)
  @Column(DataType.BOOLEAN)
  isActive!: boolean;

  // Associations
  @HasMany(() => WalletTransaction)
  transactions!: WalletTransaction[];

  @HasMany(() => Payout)
  payouts!: Payout[];
}
