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
Object.defineProperty(exports, "__esModule", { value: true });
exports.Order = void 0;
const sequelize_typescript_1 = require("sequelize-typescript");
const Patient_1 = require("./Patient");
const Appuser_1 = require("./Appuser");
let Order = class Order extends sequelize_typescript_1.Model {
};
__decorate([
    (0, sequelize_typescript_1.Column)({
        type: sequelize_typescript_1.DataType.UUID,
        defaultValue: sequelize_typescript_1.DataType.UUIDV4,
        primaryKey: true,
    }),
    __metadata("design:type", String)
], Order.prototype, "id", void 0);
__decorate([
    (0, sequelize_typescript_1.Column)({
        type: sequelize_typescript_1.DataType.STRING(45),
        allowNull: false,
        unique: true,
    }),
    __metadata("design:type", String)
], Order.prototype, "orderId", void 0);
__decorate([
    (0, sequelize_typescript_1.Column)({
        type: sequelize_typescript_1.DataType.STRING,
        allowNull: true,
    }),
    __metadata("design:type", String)
], Order.prototype, "cfOrderId", void 0);
__decorate([
    (0, sequelize_typescript_1.ForeignKey)(() => Patient_1.Patient),
    (0, sequelize_typescript_1.Column)({
        type: sequelize_typescript_1.DataType.UUID,
        allowNull: false,
    }),
    __metadata("design:type", String)
], Order.prototype, "patientId", void 0);
__decorate([
    (0, sequelize_typescript_1.BelongsTo)(() => Patient_1.Patient),
    __metadata("design:type", Patient_1.Patient)
], Order.prototype, "patient", void 0);
__decorate([
    (0, sequelize_typescript_1.ForeignKey)(() => Appuser_1.AppUser),
    (0, sequelize_typescript_1.Column)({
        type: sequelize_typescript_1.DataType.UUID,
        allowNull: false,
        field: "doctorId",
    }),
    __metadata("design:type", String)
], Order.prototype, "doctorId", void 0);
__decorate([
    (0, sequelize_typescript_1.BelongsTo)(() => Appuser_1.AppUser, "doctorId"),
    __metadata("design:type", Appuser_1.AppUser)
], Order.prototype, "doctor", void 0);
__decorate([
    (0, sequelize_typescript_1.Column)({
        type: sequelize_typescript_1.DataType.UUID,
        allowNull: false,
        field: "vendorId",
    }),
    __metadata("design:type", String)
], Order.prototype, "vendorId", void 0);
__decorate([
    (0, sequelize_typescript_1.Column)({
        type: sequelize_typescript_1.DataType.DECIMAL(10, 2),
        allowNull: false,
    }),
    __metadata("design:type", Number)
], Order.prototype, "amount", void 0);
__decorate([
    (0, sequelize_typescript_1.Column)({
        type: sequelize_typescript_1.DataType.STRING(3),
        allowNull: false,
        defaultValue: "INR",
    }),
    __metadata("design:type", String)
], Order.prototype, "currency", void 0);
__decorate([
    (0, sequelize_typescript_1.Column)({
        type: sequelize_typescript_1.DataType.ENUM("PENDING", "PAID", "FAILED", "EXPIRED", "REFUNDED"),
        allowNull: false,
        defaultValue: "PENDING",
    }),
    __metadata("design:type", String)
], Order.prototype, "status", void 0);
__decorate([
    (0, sequelize_typescript_1.Column)({
        type: sequelize_typescript_1.DataType.STRING,
        allowNull: true,
    }),
    __metadata("design:type", String)
], Order.prototype, "paymentSessionId", void 0);
__decorate([
    (0, sequelize_typescript_1.Column)({
        type: sequelize_typescript_1.DataType.STRING,
        allowNull: true,
    }),
    __metadata("design:type", String)
], Order.prototype, "paymentMethod", void 0);
__decorate([
    (0, sequelize_typescript_1.Column)({
        type: sequelize_typescript_1.DataType.DATE,
        allowNull: true,
    }),
    __metadata("design:type", Date)
], Order.prototype, "paidAt", void 0);
__decorate([
    (0, sequelize_typescript_1.Column)({
        type: sequelize_typescript_1.DataType.TEXT,
        allowNull: true,
    }),
    __metadata("design:type", String)
], Order.prototype, "orderNote", void 0);
Order = __decorate([
    (0, sequelize_typescript_1.Table)({
        tableName: "orders",
        timestamps: true,
    })
], Order);
exports.Order = Order;
