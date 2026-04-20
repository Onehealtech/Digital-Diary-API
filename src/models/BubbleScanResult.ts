import {
    Table,
    Column,
    Model,
    DataType,
    ForeignKey,
    BelongsTo,
} from "sequelize-typescript";
import { Patient } from "./Patient";
import { DiaryPage } from "./DiaryPage";
import { ReportFile } from "../utils/reportFiles";

@Table({
    tableName: "bubble_scan_results",
    timestamps: true,
})
export class BubbleScanResult extends Model {
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
        type: DataType.ENUM("scan", "manual", "doctor_manual"),
        allowNull: false,
        defaultValue: "scan",
    })
    submissionType!: "scan" | "manual" | "doctor_manual";

    @Column({
        type: DataType.INTEGER,
        allowNull: true,
    })
    pageNumber?: number;

    @ForeignKey(() => DiaryPage)
    @Column({
        type: DataType.UUID,
        allowNull: true,
    })
    diaryPageId?: string;

    @BelongsTo(() => DiaryPage)
    diaryPage?: DiaryPage;

    @Column({
        type: DataType.STRING,
        allowNull: false,
    })
    pageId!: string;

    @Column({
        type: DataType.STRING,
        allowNull: true,
    })
    pageType?: string;

    @Column({
        type: DataType.STRING,
        allowNull: true,
    })
    templateName?: string;

    @Column({
        type: DataType.STRING,
        allowNull: true,
    })
    templateVersion?: string;

    @Column({
        type: DataType.STRING,
        allowNull: true,
    })
    imageUrl?: string;

    @Column({
        type: DataType.ENUM("pending", "processing", "completed", "failed"),
        defaultValue: "pending",
    })
    processingStatus!: "pending" | "processing" | "completed" | "failed";

    @Column({
        type: DataType.JSONB,
        allowNull: true,
    })
    scanResults?: object;

    @Column({
        type: DataType.JSONB,
        allowNull: true,
    })
    rawConfidenceScores?: object;

    @Column({
        type: DataType.JSONB,
        allowNull: true,
    })
    processingMetadata?: object;

    @Column(DataType.TEXT)
    errorMessage?: string;

    @Column({
        type: DataType.DATE,
        defaultValue: DataType.NOW,
    })
    scannedAt!: Date;

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

    @Column({
        type: DataType.JSONB,
        allowNull: true,
    })
    doctorOverrides?: object;

    @Column({
        type: DataType.JSONB,
        allowNull: true,
    })
    questionMarks?: object; // { q1: true, q2: false, ... } — per-question doctor review marks

    @Column({
        type: DataType.JSONB,
        allowNull: true,
        defaultValue: [],
    })
    reportUrls?: Array<string | ReportFile>; // Legacy string[] or normalized [{ url, name }]

    @Column({
        type: DataType.JSONB,
        allowNull: true,
        defaultValue: {},
    })
    questionReports?: Record<string, Array<string | ReportFile>>; // { "q1": [{ url, name }] }
}
