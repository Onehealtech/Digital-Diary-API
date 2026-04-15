"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
var AppUser_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.AppUser = void 0;
const sequelize_typescript_1 = require("sequelize-typescript");
const bcrypt_1 = __importDefault(require("bcrypt"));
const Patient_1 = require("./Patient");
const referralUtils_1 = require("../utils/referralUtils");
let AppUser = AppUser_1 = class AppUser extends sequelize_typescript_1.Model {
    /* =======================
       Sequelize Hooks
       ======================= */
    static async hashPasswordOnCreate(instance) {
        if (instance.password) {
            instance.password = await bcrypt_1.default.hash(instance.password, 10);
        }
        if (!instance.referralCode) {
            instance.referralCode = (0, referralUtils_1.generateReferralCode)();
        }
    }
    static async hashPasswordOnUpdate(instance) {
        if (instance.changed("password")) {
            instance.password = await bcrypt_1.default.hash(instance.password, 10);
        }
    }
    /* =======================
       Instance Methods
       ======================= */
    async comparePassword(password) {
        return bcrypt_1.default.compare(password, this.password);
    }
};
__decorate([
    (0, sequelize_typescript_1.Column)({
        type: sequelize_typescript_1.DataType.UUID,
        defaultValue: sequelize_typescript_1.DataType.UUIDV4,
        primaryKey: true,
    }),
    __metadata("design:type", String)
], AppUser.prototype, "id", void 0);
__decorate([
    (0, sequelize_typescript_1.Column)({
        type: sequelize_typescript_1.DataType.STRING(255),
        allowNull: false,
    }),
    __metadata("design:type", String)
], AppUser.prototype, "fullName", void 0);
__decorate([
    (0, sequelize_typescript_1.Column)({
        type: sequelize_typescript_1.DataType.STRING(50),
        allowNull: true,
    }),
    __metadata("design:type", String)
], AppUser.prototype, "phone", void 0);
__decorate([
    (0, sequelize_typescript_1.Column)({
        type: sequelize_typescript_1.DataType.STRING(50),
        allowNull: true,
    }),
    __metadata("design:type", String)
], AppUser.prototype, "landLinePhone", void 0);
__decorate([
    (0, sequelize_typescript_1.Column)({
        type: sequelize_typescript_1.DataType.JSONB,
        allowNull: true,
    }),
    __metadata("design:type", Object)
], AppUser.prototype, "bankDetails", void 0);
__decorate([
    (0, sequelize_typescript_1.Column)({
        type: sequelize_typescript_1.DataType.STRING(255),
        allowNull: false,
        unique: true,
        validate: {
            isEmail: true,
        },
    }),
    __metadata("design:type", String)
], AppUser.prototype, "email", void 0);
__decorate([
    (0, sequelize_typescript_1.Column)({
        type: sequelize_typescript_1.DataType.STRING(255),
        allowNull: false,
    }),
    __metadata("design:type", String)
], AppUser.prototype, "password", void 0);
__decorate([
    (0, sequelize_typescript_1.Column)({
        type: sequelize_typescript_1.DataType.STRING(255),
        allowNull: true,
    }),
    __metadata("design:type", String)
], AppUser.prototype, "cashfreeVendorId", void 0);
__decorate([
    (0, sequelize_typescript_1.Column)({
        type: sequelize_typescript_1.DataType.STRING(255),
        allowNull: true,
    }),
    __metadata("design:type", String)
], AppUser.prototype, "license", void 0);
__decorate([
    (0, sequelize_typescript_1.Column)({
        type: sequelize_typescript_1.DataType.STRING(255),
        allowNull: true,
    }),
    __metadata("design:type", String)
], AppUser.prototype, "hospital", void 0);
__decorate([
    (0, sequelize_typescript_1.Column)({
        type: sequelize_typescript_1.DataType.STRING(255),
        allowNull: true,
    }),
    __metadata("design:type", String)
], AppUser.prototype, "specialization", void 0);
__decorate([
    (0, sequelize_typescript_1.Column)({
        type: sequelize_typescript_1.DataType.STRING(255),
        allowNull: true,
    }),
    __metadata("design:type", String)
], AppUser.prototype, "GST", void 0);
__decorate([
    (0, sequelize_typescript_1.Column)({
        type: sequelize_typescript_1.DataType.STRING(255),
        allowNull: true,
    }),
    __metadata("design:type", String)
], AppUser.prototype, "location", void 0);
__decorate([
    (0, sequelize_typescript_1.Column)({
        type: sequelize_typescript_1.DataType.STRING(500),
        allowNull: true,
    }),
    __metadata("design:type", String)
], AppUser.prototype, "address", void 0);
__decorate([
    (0, sequelize_typescript_1.Column)({
        type: sequelize_typescript_1.DataType.STRING(100),
        allowNull: true,
    }),
    __metadata("design:type", String)
], AppUser.prototype, "city", void 0);
__decorate([
    (0, sequelize_typescript_1.Column)({
        type: sequelize_typescript_1.DataType.STRING(100),
        allowNull: true,
    }),
    __metadata("design:type", String)
], AppUser.prototype, "state", void 0);
__decorate([
    (0, sequelize_typescript_1.Column)({
        type: sequelize_typescript_1.DataType.STRING(255),
        allowNull: true,
    }),
    __metadata("design:type", String)
], AppUser.prototype, "commissionType", void 0);
__decorate([
    (0, sequelize_typescript_1.Column)({
        type: sequelize_typescript_1.DataType.FLOAT,
        allowNull: true,
    }),
    __metadata("design:type", Number)
], AppUser.prototype, "commissionRate", void 0);
__decorate([
    (0, sequelize_typescript_1.Column)({
        type: sequelize_typescript_1.DataType.BOOLEAN,
        defaultValue: true,
        allowNull: true,
    }),
    __metadata("design:type", Boolean)
], AppUser.prototype, "isActive", void 0);
__decorate([
    (0, sequelize_typescript_1.Column)({
        type: sequelize_typescript_1.DataType.INTEGER,
        allowNull: false,
        defaultValue: 0,
    }),
    __metadata("design:type", Number)
], AppUser.prototype, "tokenVersion", void 0);
__decorate([
    (0, sequelize_typescript_1.Column)({
        type: sequelize_typescript_1.DataType.ENUM("SUPER_ADMIN", "VENDOR", "DOCTOR", "ASSISTANT"),
        allowNull: false,
    }),
    __metadata("design:type", String)
], AppUser.prototype, "role", void 0);
__decorate([
    (0, sequelize_typescript_1.ForeignKey)(() => AppUser_1),
    (0, sequelize_typescript_1.Column)({
        type: sequelize_typescript_1.DataType.UUID,
        allowNull: true,
    }),
    __metadata("design:type", String)
], AppUser.prototype, "parentId", void 0);
__decorate([
    (0, sequelize_typescript_1.BelongsTo)(() => AppUser_1, "parentId"),
    __metadata("design:type", AppUser)
], AppUser.prototype, "parent", void 0);
__decorate([
    (0, sequelize_typescript_1.Column)({
        type: sequelize_typescript_1.DataType.JSONB,
        allowNull: true,
    }),
    __metadata("design:type", Object)
], AppUser.prototype, "permissions", void 0);
__decorate([
    (0, sequelize_typescript_1.Column)({
        type: sequelize_typescript_1.DataType.ENUM("ACTIVE", "ON_HOLD", "DELETED"),
        allowNull: true,
        defaultValue: "ACTIVE",
    }),
    __metadata("design:type", String)
], AppUser.prototype, "assistantStatus", void 0);
__decorate([
    (0, sequelize_typescript_1.Column)({
        type: sequelize_typescript_1.DataType.STRING(20),
        allowNull: true,
        defaultValue: "all",
    }),
    __metadata("design:type", String)
], AppUser.prototype, "patientAccessMode", void 0);
__decorate([
    (0, sequelize_typescript_1.Column)({
        type: sequelize_typescript_1.DataType.JSONB,
        allowNull: true,
        defaultValue: [],
    }),
    __metadata("design:type", Array)
], AppUser.prototype, "assignedPatientIds", void 0);
__decorate([
    (0, sequelize_typescript_1.Column)({
        type: sequelize_typescript_1.DataType.STRING(20),
        allowNull: true,
        unique: true,
    }),
    __metadata("design:type", String)
], AppUser.prototype, "referralCode", void 0);
__decorate([
    (0, sequelize_typescript_1.Column)({
        type: sequelize_typescript_1.DataType.BOOLEAN,
        defaultValue: false,
        allowNull: false,
    }),
    __metadata("design:type", Boolean)
], AppUser.prototype, "selfRegistered", void 0);
__decorate([
    (0, sequelize_typescript_1.Column)({
        type: sequelize_typescript_1.DataType.BOOLEAN,
        defaultValue: false,
    }),
    __metadata("design:type", Boolean)
], AppUser.prototype, "isEmailVerified", void 0);
__decorate([
    (0, sequelize_typescript_1.Column)({
        type: sequelize_typescript_1.DataType.STRING,
        allowNull: true,
    }),
    __metadata("design:type", String)
], AppUser.prototype, "fcmToken", void 0);
__decorate([
    (0, sequelize_typescript_1.HasMany)(() => Patient_1.Patient),
    __metadata("design:type", Array)
], AppUser.prototype, "patients", void 0);
__decorate([
    sequelize_typescript_1.BeforeCreate,
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [AppUser]),
    __metadata("design:returntype", Promise)
], AppUser, "hashPasswordOnCreate", null);
__decorate([
    sequelize_typescript_1.BeforeUpdate,
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [AppUser]),
    __metadata("design:returntype", Promise)
], AppUser, "hashPasswordOnUpdate", null);
AppUser = AppUser_1 = __decorate([
    (0, sequelize_typescript_1.Table)({
        tableName: "app-users",
        timestamps: true,
        paranoid: true, // Soft delete: sets deletedAt instead of destroying rows
    })
], AppUser);
exports.AppUser = AppUser;
