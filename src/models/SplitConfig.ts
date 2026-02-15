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
    tableName: "split_configs",
    timestamps: true,
})
export class SplitConfig extends Model {
    @Column({
        type: DataType.UUID,
        defaultValue: DataType.UUIDV4,
        primaryKey: true,
    })
    id!: string;

    @Column({
        type: DataType.ENUM("PERCENTAGE", "FIXED"),
        allowNull: false,
    })
    splitType!: "PERCENTAGE" | "FIXED";

    // Vendor's share — % value (e.g. 30 for 30%) or ₹ amount (e.g. 200.00)
    @Column({
        type: DataType.DECIMAL(10, 2),
        allowNull: false,
    })
    vendorValue!: number;

    // Doctor's share — % value or ₹ amount
    @Column({
        type: DataType.DECIMAL(10, 2),
        allowNull: false,
    })
    doctorValue!: number;

    @Column({
        type: DataType.BOOLEAN,
        allowNull: false,
        defaultValue: true,
    })
    isActive!: boolean;

    // 🔗 SuperAdmin who created this config
    @ForeignKey(() => AppUser)
    @Column({
        type: DataType.UUID,
        allowNull: false,
    })
    createdBy!: string;

    @BelongsTo(() => AppUser)
    creator!: AppUser;

    @Column({
        type: DataType.TEXT,
        allowNull: true,
    })
    notes?: string;
}
