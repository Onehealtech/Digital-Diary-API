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
  tableName: "vendor_profiles",
  timestamps: true,
})
export class VendorProfile extends Model {
  @Column({
    type: DataType.UUID,
    defaultValue: DataType.UUIDV4,
    primaryKey: true,
  })
  id!: string;

  @ForeignKey(() => AppUser)
  @Column({
    type: DataType.UUID,
    allowNull: false,
    unique: true,
  })
  vendorId!: string;

  @BelongsTo(() => AppUser)
  vendor!: AppUser;

  @Column({
    type: DataType.STRING,
    allowNull: false,
  })
  businessName!: string;

  @Column({
    type: DataType.STRING,
    allowNull: false,
  })
  location!: string;

  @Column({
    type: DataType.STRING,
    allowNull: false,
    unique: true,
  })
  gst!: string;

  @Column({
    type: DataType.JSONB,
    allowNull: false,
  })
  bankDetails!: {
    accountNumber: string;
    ifscCode: string;
    accountHolderName: string;
    bankName: string;
  };

  @Column({
    type: DataType.DECIMAL(10, 2),
    defaultValue: 0,
  })
  walletBalance!: number;

  @Column({
    type: DataType.INTEGER,
    defaultValue: 0,
  })
  diariesSold!: number;

  @Column({
    type: DataType.DECIMAL(10, 2),
    defaultValue: 50,
  })
  commissionRate!: number;

  @Column({
    type: DataType.ENUM("active", "inactive"),
    defaultValue: "active",
  })
  status!: "active" | "inactive";
}
