import {
  Table,
  Column,
  Model,
  DataType,
  BeforeCreate,
  BeforeUpdate,
  HasMany,
  ForeignKey,
  BelongsTo,
} from "sequelize-typescript";
import bcrypt from "bcrypt";
import { Patient } from "./Patient";

@Table({
  tableName: "app-users",
  timestamps: true,
})
export class AppUser extends Model {
  @Column({
    type: DataType.UUID,
    defaultValue: DataType.UUIDV4,
    primaryKey: true,
  })
  id!: string;

  @Column({
    type: DataType.STRING(255),
    allowNull: false,
  })
  fullName!: string;

  @Column({
    type: DataType.STRING(50),
    allowNull: true,
  })
  phone?: string;

  @Column({
    type: DataType.STRING(255),
    allowNull: false,
    unique: true,
    validate: {
      isEmail: true,
    },
  })
  email!: string;

  @Column({
    type: DataType.STRING(255),
    allowNull: false,
  })
  password!: string;

  @Column({
    type: DataType.STRING(255),
    allowNull: true,
  })
  cashfreeVendorId!: string;

  @Column({
    type: DataType.STRING(255),
    allowNull: true,
  })
  license!: string;

  @Column({
    type: DataType.STRING(255),
    allowNull: true,
  })
  hospital!: string;

  @Column({
    type: DataType.STRING(255),
    allowNull: true,
  })
  specialization!: string;

  @Column({
    type: DataType.STRING(255),
    allowNull: true,
  })
  GST!: string;

  @Column({
    type: DataType.STRING(255),
    allowNull: true,
  })
  location!: string;
  @Column({
    type: DataType.STRING(255),
    allowNull: true,
  })
  commissionType!: string;

  @Column({
    type: DataType.NUMBER,
    allowNull: true,
  })
  commissionRate!: number;

  @Column({
    type: DataType.BOOLEAN,
    defaultValue: true,
    allowNull: true,
  })
  isActive!: boolean;

  @Column({
    type: DataType.ENUM("SUPER_ADMIN", "VENDOR", "DOCTOR", "ASSISTANT"),
    allowNull: false,
  })
  role!: "SUPER_ADMIN" | "VENDOR" | "DOCTOR" | "ASSISTANT";

  // 🔗 Self-referencing parent (Doctor → Assistant, SuperAdmin → Vendor)
  @ForeignKey(() => AppUser)
  @Column({
    type: DataType.UUID,
    allowNull: true,
  })
  parentId?: string;

  @BelongsTo(() => AppUser, "parentId")
  parent?: AppUser;

  @Column({
    type: DataType.JSONB,
    allowNull: true,
  })
  permissions?: {
    viewPatients?: boolean;
    callPatients?: boolean;
    exportData?: boolean;
    sendNotifications?: boolean;
  };

  @Column({
    type: DataType.BOOLEAN,
    defaultValue: false,
  })
  isEmailVerified!: boolean;

  // 🔗 Doctor → Patients
  @HasMany(() => Patient)
  patients!: Patient[];

  /* =======================
     Sequelize Hooks
     ======================= */

  @BeforeCreate
  static async hashPasswordOnCreate(instance: AppUser) {
    if (instance.password) {
      instance.password = await bcrypt.hash(instance.password, 10);
    }
  }

  @BeforeUpdate
  static async hashPasswordOnUpdate(instance: AppUser) {
    if (instance.changed("password")) {
      instance.password = await bcrypt.hash(instance.password, 10);
    }
  }

  /* =======================
     Instance Methods
     ======================= */

  async comparePassword(password: string): Promise<boolean> {
    return bcrypt.compare(password, this.password);
  }
}
