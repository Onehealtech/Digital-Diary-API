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
    tableName: "reminders",
    timestamps: true,
})
export class Reminder extends Model {
    @Column({
        type: DataType.UUID,
        defaultValue: DataType.UUIDV4,
        primaryKey: true,
    })
    id!: string;

    @ForeignKey(() => Patient)
    @Column({
        type: DataType.UUID,
        allowNull: false,
    })
    patientId!: string;

    @BelongsTo(() => Patient)
    patient!: Patient;

    @Column({
        type: DataType.TEXT,
        allowNull: false,
    })
    message!: string;

    @Column({
        type: DataType.DATE,
        allowNull: false,
    })
    reminderDate!: Date;

    @Column({
        type: DataType.ENUM(
            "APPOINTMENT",
            "CHEMOTHERAPY",
            "RADIOLOGY",
            "FOLLOW_UP",
            "OTHER"
        ),
        allowNull: false,
    })
    type!: "APPOINTMENT" | "CHEMOTHERAPY" | "RADIOLOGY" | "FOLLOW_UP" | "OTHER";

    @Column({
        type: DataType.ENUM("PENDING", "READ", "EXPIRED"),
        defaultValue: "PENDING",
    })
    status!: "PENDING" | "READ" | "EXPIRED";

    @ForeignKey(() => AppUser)
    @Column({
        type: DataType.UUID,
        allowNull: false,
    })
    createdBy!: string;

    @BelongsTo(() => AppUser)
    creator!: AppUser;
}
