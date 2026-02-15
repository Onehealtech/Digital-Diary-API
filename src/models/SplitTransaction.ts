import {
    Table,
    Column,
    Model,
    DataType,
    ForeignKey,
    BelongsTo,
} from "sequelize-typescript";
import { Order } from "./Order";

@Table({
    tableName: "split_transactions",
    timestamps: true,
})
export class SplitTransaction extends Model {
    @Column({
        type: DataType.UUID,
        defaultValue: DataType.UUIDV4,
        primaryKey: true,
    })
    id!: string;

    // 🔗 The order this split belongs to
    @ForeignKey(() => Order)
    @Column({
        type: DataType.UUID,
        allowNull: false,
    })
    orderId!: string;

    @BelongsTo(() => Order)
    order!: Order;

    // 💰 All amounts use DECIMAL(10,2) — no floating point
    @Column({
        type: DataType.DECIMAL(10, 2),
        allowNull: false,
    })
    totalAmount!: number;

    @Column({
        type: DataType.DECIMAL(10, 2),
        allowNull: false,
    })
    vendorAmount!: number;

    @Column({
        type: DataType.DECIMAL(10, 2),
        allowNull: false,
    })
    doctorAmount!: number;

    @Column({
        type: DataType.DECIMAL(10, 2),
        allowNull: false,
    })
    platformAmount!: number; // total - vendor - doctor

    @Column({
        type: DataType.ENUM("PERCENTAGE", "FIXED"),
        allowNull: false,
    })
    splitType!: "PERCENTAGE" | "FIXED";

    @Column({
        type: DataType.STRING,
        allowNull: true,
    })
    vendorTransferId?: string; // Cashfree transfer reference

    @Column({
        type: DataType.STRING,
        allowNull: true,
    })
    doctorTransferId?: string; // Cashfree transfer reference

    @Column({
        type: DataType.ENUM("PENDING", "SUCCESS", "FAILED"),
        allowNull: false,
        defaultValue: "PENDING",
    })
    transferStatus!: "PENDING" | "SUCCESS" | "FAILED";

    @Column({
        type: DataType.DATE,
        allowNull: true,
    })
    processedAt?: Date;

    // Unique idempotency key — prevents double processing
    @Column({
        type: DataType.STRING,
        allowNull: false,
        unique: true,
    })
    idempotencyKey!: string;
}
