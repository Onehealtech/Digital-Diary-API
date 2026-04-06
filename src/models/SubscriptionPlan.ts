import {
  Table,
  Column,
  Model,
  DataType,
  HasMany,
} from "sequelize-typescript";

@Table({
  tableName: "subscription_plans",
  timestamps: true,
  paranoid: true, // soft delete
})
export class SubscriptionPlan extends Model {
  @Column({
    type: DataType.UUID,
    defaultValue: DataType.UUIDV4,
    primaryKey: true,
  })
  id!: string;

  @Column({
    type: DataType.STRING(100),
    allowNull: false,
    validate: {
      len: [1, 100],
    },
  })
  name!: string; // e.g., "Basic", "Standard", "Premium"

  @Column({
    type: DataType.TEXT,
    allowNull: true,
    validate: {
      len: [0, 500],
    },
  })
  description?: string;

  @Column({
    type: DataType.DECIMAL(10, 2),
    allowNull: false,
    validate: {
      min: 0,
      max: 99999999.99,
    },
  })
  monthlyPrice!: number;

  @Column({
    type: DataType.INTEGER,
    allowNull: false,
    validate: {
      isValidMaxDiaryPages(value: number) {
        if (!Number.isInteger(value) || (value !== -1 && value <= 0)) {
          throw new Error("maxDiaryPages must be -1 or a positive integer");
        }
      },
    },
  })
  maxDiaryPages!: number; // e.g., 10, 50, unlimited (-1)

  @Column({
    type: DataType.BOOLEAN,
    allowNull: false,
    defaultValue: false,
  })
  scanEnabled!: boolean;

  @Column({
    type: DataType.BOOLEAN,
    allowNull: false,
    defaultValue: false,
  })
  manualEntryEnabled!: boolean;

  @Column({
    type: DataType.BOOLEAN,
    allowNull: false,
    defaultValue: false,
  })
  isPopular!: boolean;

  @Column({
    type: DataType.BOOLEAN,
    allowNull: false,
    defaultValue: true,
  })
  isActive!: boolean;

  @Column({
    type: DataType.INTEGER,
    allowNull: false,
    defaultValue: 0,
  })
  sortOrder!: number; // display ordering
}
