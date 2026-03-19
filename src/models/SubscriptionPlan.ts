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
  })
  name!: string; // e.g., "Basic", "Standard", "Premium"

  @Column({
    type: DataType.TEXT,
    allowNull: true,
  })
  description?: string;

  @Column({
    type: DataType.DECIMAL(10, 2),
    allowNull: false,
  })
  monthlyPrice!: number;

  @Column({
    type: DataType.INTEGER,
    allowNull: false,
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
