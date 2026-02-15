import {
    Table,
    Column,
    Model,
    DataType,
    ForeignKey,
    BelongsTo,
} from "sequelize-typescript";
import { Patient } from "./Patient";
import { AppUser } from "./Appuser";

@Table({
    tableName: "orders",
    timestamps: true,
})
export class Order extends Model {
    @Column({
        type: DataType.UUID,
        defaultValue: DataType.UUIDV4,
        primaryKey: true,
    })
    id!: string;

    @Column({
        type: DataType.STRING(45),
        allowNull: false,
        unique: true,
    })
    orderId!: string; // Our internal order ID (sent to Cashfree)

    @Column({
        type: DataType.STRING,
        allowNull: true,
    })
    cfOrderId?: string; // Cashfree's order ID

    // 🔗 Patient who is buying
    @ForeignKey(() => Patient)
    @Column({
        type: DataType.UUID,
        allowNull: false,
    })
    patientId!: string;

    @BelongsTo(() => Patient)
    patient!: Patient;

    // 🔗 Prescribing doctor
    @ForeignKey(() => AppUser)
    @Column({
        type: DataType.UUID,
        allowNull: false,
        field: "doctorId",
    })
    doctorId!: string;

    @BelongsTo(() => AppUser, "doctorId")
    doctor!: AppUser;

    // 🔗 Fulfilling vendor
    @Column({
        type: DataType.UUID,
        allowNull: false,
        field: "vendorId",
    })
    vendorId!: string;

    // 💰 Total order amount — DECIMAL for precision
    @Column({
        type: DataType.DECIMAL(10, 2),
        allowNull: false,
    })
    amount!: number;

    @Column({
        type: DataType.STRING(3),
        allowNull: false,
        defaultValue: "INR",
    })
    currency!: string;

    @Column({
        type: DataType.ENUM("PENDING", "PAID", "FAILED", "EXPIRED", "REFUNDED"),
        allowNull: false,
        defaultValue: "PENDING",
    })
    status!: "PENDING" | "PAID" | "FAILED" | "EXPIRED" | "REFUNDED";

    @Column({
        type: DataType.STRING,
        allowNull: true,
    })
    paymentSessionId?: string; // From Cashfree

    @Column({
        type: DataType.STRING,
        allowNull: true,
    })
    paymentMethod?: string; // UPI, CARD, etc.

    @Column({
        type: DataType.DATE,
        allowNull: true,
    })
    paidAt?: Date;

    @Column({
        type: DataType.TEXT,
        allowNull: true,
    })
    orderNote?: string;
}
