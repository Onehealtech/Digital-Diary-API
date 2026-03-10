"use strict";
// src/models/walletTransaction.model.ts
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
exports.WalletTransaction = void 0;
const sequelize_typescript_1 = require("sequelize-typescript");
const Wallet_1 = require("./Wallet");
let WalletTransaction = class WalletTransaction extends sequelize_typescript_1.Model {
};
__decorate([
    sequelize_typescript_1.PrimaryKey,
    (0, sequelize_typescript_1.Default)(sequelize_typescript_1.DataType.UUIDV4),
    (0, sequelize_typescript_1.Column)(sequelize_typescript_1.DataType.UUID),
    __metadata("design:type", String)
], WalletTransaction.prototype, "id", void 0);
__decorate([
    (0, sequelize_typescript_1.AllowNull)(false),
    (0, sequelize_typescript_1.ForeignKey)(() => Wallet_1.Wallet),
    (0, sequelize_typescript_1.Column)(sequelize_typescript_1.DataType.UUID),
    __metadata("design:type", String)
], WalletTransaction.prototype, "walletId", void 0);
__decorate([
    (0, sequelize_typescript_1.BelongsTo)(() => Wallet_1.Wallet),
    __metadata("design:type", Wallet_1.Wallet)
], WalletTransaction.prototype, "wallet", void 0);
__decorate([
    (0, sequelize_typescript_1.AllowNull)(false),
    (0, sequelize_typescript_1.Column)(sequelize_typescript_1.DataType.ENUM("CREDIT", "DEBIT")),
    __metadata("design:type", String)
], WalletTransaction.prototype, "type", void 0);
__decorate([
    (0, sequelize_typescript_1.Column)({
        type: sequelize_typescript_1.DataType.STRING,
        unique: false,
        allowNull: true,
    }),
    __metadata("design:type", String)
], WalletTransaction.prototype, "diaryId", void 0);
__decorate([
    (0, sequelize_typescript_1.AllowNull)(false),
    (0, sequelize_typescript_1.Column)(sequelize_typescript_1.DataType.DECIMAL(12, 2)),
    __metadata("design:type", Number)
], WalletTransaction.prototype, "amount", void 0);
__decorate([
    (0, sequelize_typescript_1.AllowNull)(false),
    (0, sequelize_typescript_1.Column)(sequelize_typescript_1.DataType.DECIMAL(12, 2)),
    __metadata("design:type", Number)
], WalletTransaction.prototype, "balanceAfter", void 0);
__decorate([
    (0, sequelize_typescript_1.AllowNull)(false),
    sequelize_typescript_1.Index,
    (0, sequelize_typescript_1.Column)(sequelize_typescript_1.DataType.ENUM("DIARY_SALE", "PAYOUT", "MANUAL_CREDIT", "ADVANCE_PAYMENT", "MANUAL_DEBIT", "REFUND", "COMMISSION")),
    __metadata("design:type", String)
], WalletTransaction.prototype, "category", void 0);
__decorate([
    (0, sequelize_typescript_1.AllowNull)(false),
    (0, sequelize_typescript_1.Column)(sequelize_typescript_1.DataType.STRING(500)),
    __metadata("design:type", String)
], WalletTransaction.prototype, "description", void 0);
__decorate([
    sequelize_typescript_1.Index,
    (0, sequelize_typescript_1.Column)(sequelize_typescript_1.DataType.ENUM("ORDER", "PAYOUT", "MANUAL", "REFUND", "ADVANCE")),
    __metadata("design:type", Object)
], WalletTransaction.prototype, "referenceType", void 0);
__decorate([
    sequelize_typescript_1.Index,
    (0, sequelize_typescript_1.Column)(sequelize_typescript_1.DataType.STRING(255)),
    __metadata("design:type", Object)
], WalletTransaction.prototype, "referenceId", void 0);
__decorate([
    (0, sequelize_typescript_1.Column)(sequelize_typescript_1.DataType.UUID),
    __metadata("design:type", Object)
], WalletTransaction.prototype, "performedBy", void 0);
__decorate([
    (0, sequelize_typescript_1.Column)(sequelize_typescript_1.DataType.JSONB),
    __metadata("design:type", Object)
], WalletTransaction.prototype, "metadata", void 0);
WalletTransaction = __decorate([
    (0, sequelize_typescript_1.Table)({
        tableName: "wallet_transactions",
        timestamps: true,
    })
], WalletTransaction);
exports.WalletTransaction = WalletTransaction;
