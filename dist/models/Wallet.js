"use strict";
// src/models/wallet.model.ts
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Wallet = void 0;
const sequelize_typescript_1 = require("sequelize-typescript");
const walletTransaction_model_1 = require("./walletTransaction.model");
const payout_model_1 = require("./payout.model");
const Appuser_1 = require("./Appuser");
let Wallet = class Wallet extends sequelize_typescript_1.Model {
};
__decorate([
    sequelize_typescript_1.PrimaryKey,
    (0, sequelize_typescript_1.Default)(sequelize_typescript_1.DataType.UUIDV4),
    (0, sequelize_typescript_1.Column)(sequelize_typescript_1.DataType.UUID),
    __metadata("design:type", String)
], Wallet.prototype, "id", void 0);
__decorate([
    (0, sequelize_typescript_1.ForeignKey)(() => Appuser_1.AppUser),
    (0, sequelize_typescript_1.Column)({
        type: sequelize_typescript_1.DataType.UUID,
        allowNull: false,
    }),
    __metadata("design:type", String)
], Wallet.prototype, "userId", void 0);
__decorate([
    (0, sequelize_typescript_1.BelongsTo)(() => Appuser_1.AppUser, {
        foreignKey: "userId",
        as: "vendor",
    }),
    __metadata("design:type", Appuser_1.AppUser)
], Wallet.prototype, "vendor", void 0);
__decorate([
    (0, sequelize_typescript_1.AllowNull)(false),
    (0, sequelize_typescript_1.Column)(sequelize_typescript_1.DataType.ENUM("VENDOR", "DOCTOR", "PLATFORM")),
    __metadata("design:type", String)
], Wallet.prototype, "walletType", void 0);
__decorate([
    (0, sequelize_typescript_1.AllowNull)(false),
    (0, sequelize_typescript_1.Default)(0.0),
    (0, sequelize_typescript_1.Column)(sequelize_typescript_1.DataType.DECIMAL(12, 2)),
    __metadata("design:type", Number)
], Wallet.prototype, "balance", void 0);
__decorate([
    (0, sequelize_typescript_1.AllowNull)(false),
    (0, sequelize_typescript_1.Default)(0.0),
    (0, sequelize_typescript_1.Column)(sequelize_typescript_1.DataType.DECIMAL(12, 2)),
    __metadata("design:type", Number)
], Wallet.prototype, "totalCredited", void 0);
__decorate([
    (0, sequelize_typescript_1.AllowNull)(false),
    (0, sequelize_typescript_1.Default)(0.0),
    (0, sequelize_typescript_1.Column)(sequelize_typescript_1.DataType.DECIMAL(12, 2)),
    __metadata("design:type", Number)
], Wallet.prototype, "totalDebited", void 0);
__decorate([
    (0, sequelize_typescript_1.Default)("INR"),
    (0, sequelize_typescript_1.Column)(sequelize_typescript_1.DataType.STRING(3)),
    __metadata("design:type", String)
], Wallet.prototype, "currency", void 0);
__decorate([
    (0, sequelize_typescript_1.Default)(true),
    (0, sequelize_typescript_1.Column)(sequelize_typescript_1.DataType.BOOLEAN),
    __metadata("design:type", Boolean)
], Wallet.prototype, "isActive", void 0);
__decorate([
    (0, sequelize_typescript_1.HasMany)(() => walletTransaction_model_1.WalletTransaction),
    __metadata("design:type", Array)
], Wallet.prototype, "transactions", void 0);
__decorate([
    (0, sequelize_typescript_1.HasMany)(() => payout_model_1.Payout),
    __metadata("design:type", Array)
], Wallet.prototype, "payouts", void 0);
Wallet = __decorate([
    (0, sequelize_typescript_1.Table)({
        tableName: "wallets",
        timestamps: true,
    })
], Wallet);
exports.Wallet = Wallet;
