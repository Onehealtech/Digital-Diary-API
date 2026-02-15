import {
    Table,
    Column,
    Model,
    DataType,
} from "sequelize-typescript";

@Table({
    tableName: "webhook_logs",
    timestamps: true,
})
export class WebhookLog extends Model {
    @Column({
        type: DataType.UUID,
        defaultValue: DataType.UUIDV4,
        primaryKey: true,
    })
    id!: string;

    @Column({
        type: DataType.STRING,
        allowNull: false,
    })
    eventType!: string; // PAYMENT_SUCCESS, PAYMENT_FAILED, etc.

    @Column({
        type: DataType.STRING,
        allowNull: true,
    })
    orderId?: string; // Our order ID from the webhook payload

    @Column({
        type: DataType.JSONB,
        allowNull: false,
    })
    payload!: object; // Raw webhook body

    @Column({
        type: DataType.STRING,
        allowNull: true,
    })
    signature?: string; // x-webhook-signature header

    @Column({
        type: DataType.BOOLEAN,
        allowNull: false,
        defaultValue: false,
    })
    isVerified!: boolean; // Signature check result

    @Column({
        type: DataType.BOOLEAN,
        allowNull: false,
        defaultValue: false,
    })
    isProcessed!: boolean; // Whether we acted on this webhook
}
