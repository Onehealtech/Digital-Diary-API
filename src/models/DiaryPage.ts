import {
    Table,
    Column,
    Model,
    DataType,
} from "sequelize-typescript";

@Table({
    tableName: "diary_pages",
    timestamps: true,
})
export class DiaryPage extends Model {
    @Column({
        type: DataType.UUID,
        defaultValue: DataType.UUIDV4,
        primaryKey: true,
    })
    id!: string;

    @Column({
        type: DataType.INTEGER,
        allowNull: false,
    })
    pageNumber!: number;

    @Column({
        type: DataType.STRING,
        allowNull: false,
    })
    diaryType!: string;

    @Column({
        type: DataType.STRING,
        allowNull: false,
    })
    diaryCode!: string;

    @Column({
        type: DataType.STRING,
        allowNull: false,
    })
    title!: string;

    @Column({
        type: DataType.STRING,
        allowNull: true,
    })
    titleHi?: string;

    @Column({
        type: DataType.STRING,
        allowNull: true,
    })
    layoutType?: string;

    @Column({
        type: DataType.JSONB,
        allowNull: false,
    })
    questions!: Array<{
        id: string;
        text: string;
        textHi?: string;
        type: "yes_no" | "date" | "select" | "text" | "info";
        category: string;
        options?: string[];
    }>;

    @Column({
        type: DataType.BOOLEAN,
        defaultValue: true,
    })
    isActive!: boolean;
}
