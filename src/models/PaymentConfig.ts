// src/models/PaymentConfig.ts

import {
  Table,
  Column,
  Model,
  DataType,
  ForeignKey,
} from "sequelize-typescript";
import { AppUser } from "./Appuser";

@Table({
  tableName: "payment_config",
  timestamps: true,
})
export class PaymentConfig extends Model {
  @Column({
    type: DataType.UUID,
    defaultValue: DataType.UUIDV4,
    primaryKey: true,
  })
  id!: string;

  @Column({
    type: DataType.STRING(20),
    allowNull: false,
    defaultValue: "CASHFREE",
  })
  activeGateway!: "CASHFREE" | "RAZORPAY";

  @ForeignKey(() => AppUser)
  @Column({
    type: DataType.UUID,
    allowNull: true,
  })
  updatedBy?: string;
}
