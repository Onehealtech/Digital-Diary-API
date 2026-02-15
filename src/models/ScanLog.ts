import {
    Table,
    Column,
    Model,
    DataType,
    ForeignKey,
    BelongsTo,
} from "sequelize-typescript";
import { Patient } from "./Patient";

@Table({
    tableName: "scan_logs",
    timestamps: true,
})
export class ScanLog extends Model {
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
        type: DataType.STRING,
        allowNull: false,
    })
    pageId!: string;

    @Column({
        type: DataType.ENUM("test-status", "treatment-update", "symptoms", "notes"),
        allowNull: true,
    })
    pageType?: "test-status" | "treatment-update" | "symptoms" | "notes";

    @Column({
        type: DataType.STRING,
        allowNull: true,
    })
    imageUrl?: string;

    @Column({
        type: DataType.JSONB,
        allowNull: false,
    })
    scanData!: object;

    @Column({
        type: DataType.DATE,
        defaultValue: DataType.NOW,
        field: "scannedAt",
    })
    scannedAt!: Date;

    @Column({
        type: DataType.BOOLEAN,
        defaultValue: false,
    })
    isUpdated!: boolean;

    @Column({
        type: DataType.INTEGER,
        defaultValue: 0,
    })
    updatedCount!: number;

    @Column({
        type: DataType.BOOLEAN,
        defaultValue: false,
    })
    doctorReviewed!: boolean;

    @Column({
        type: DataType.UUID,
        allowNull: true,
    })
    reviewedBy?: string;

    @Column(DataType.DATE)
    reviewedAt?: Date;

    @Column(DataType.TEXT)
    doctorNotes?: string;

    @Column({
        type: DataType.BOOLEAN,
        defaultValue: false,
    })
    flagged!: boolean;
}
