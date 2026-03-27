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
exports.DiaryRequest = void 0;
const sequelize_typescript_1 = require("sequelize-typescript");
const Appuser_1 = require("./Appuser");
let DiaryRequest = class DiaryRequest extends sequelize_typescript_1.Model {
};
__decorate([
    (0, sequelize_typescript_1.Column)({
        type: sequelize_typescript_1.DataType.UUID,
        defaultValue: sequelize_typescript_1.DataType.UUIDV4,
        primaryKey: true,
    }),
    __metadata("design:type", String)
], DiaryRequest.prototype, "id", void 0);
__decorate([
    (0, sequelize_typescript_1.ForeignKey)(() => Appuser_1.AppUser),
    (0, sequelize_typescript_1.Column)({
        type: sequelize_typescript_1.DataType.UUID,
        allowNull: true,
    }),
    __metadata("design:type", String)
], DiaryRequest.prototype, "vendorId", void 0);
__decorate([
    (0, sequelize_typescript_1.BelongsTo)(() => Appuser_1.AppUser, { foreignKey: "vendorId", as: "vendor" }),
    __metadata("design:type", Appuser_1.AppUser)
], DiaryRequest.prototype, "vendor", void 0);
__decorate([
    (0, sequelize_typescript_1.Column)({
        type: sequelize_typescript_1.DataType.UUID,
        allowNull: true,
    }),
    __metadata("design:type", String)
], DiaryRequest.prototype, "requesterId", void 0);
__decorate([
    (0, sequelize_typescript_1.Column)({
        type: sequelize_typescript_1.DataType.STRING(20),
        allowNull: true,
    }),
    __metadata("design:type", String)
], DiaryRequest.prototype, "requesterRole", void 0);
__decorate([
    (0, sequelize_typescript_1.Column)({
        type: sequelize_typescript_1.DataType.INTEGER,
        allowNull: false,
    }),
    __metadata("design:type", Number)
], DiaryRequest.prototype, "quantity", void 0);
__decorate([
    (0, sequelize_typescript_1.Column)(sequelize_typescript_1.DataType.TEXT),
    __metadata("design:type", String)
], DiaryRequest.prototype, "message", void 0);
__decorate([
    (0, sequelize_typescript_1.Column)(sequelize_typescript_1.DataType.STRING),
    __metadata("design:type", String)
], DiaryRequest.prototype, "dairyType", void 0);
__decorate([
    (0, sequelize_typescript_1.Column)({
        type: sequelize_typescript_1.DataType.ENUM("pending", "fulfilled", "rejected", "cancelled"),
        defaultValue: "pending",
    }),
    __metadata("design:type", String)
], DiaryRequest.prototype, "status", void 0);
__decorate([
    (0, sequelize_typescript_1.Column)({
        type: sequelize_typescript_1.DataType.DATE,
        defaultValue: sequelize_typescript_1.DataType.NOW,
    }),
    __metadata("design:type", Date)
], DiaryRequest.prototype, "requestDate", void 0);
__decorate([
    (0, sequelize_typescript_1.Column)(sequelize_typescript_1.DataType.DATE),
    __metadata("design:type", Date)
], DiaryRequest.prototype, "fulfilledDate", void 0);
__decorate([
    (0, sequelize_typescript_1.Column)({
        type: sequelize_typescript_1.DataType.UUID,
        allowNull: true,
    }),
    __metadata("design:type", String)
], DiaryRequest.prototype, "fulfilledBy", void 0);
__decorate([
    (0, sequelize_typescript_1.Column)(sequelize_typescript_1.DataType.TEXT),
    __metadata("design:type", String)
], DiaryRequest.prototype, "rejectionReason", void 0);
__decorate([
    (0, sequelize_typescript_1.Column)({
        type: sequelize_typescript_1.DataType.JSONB,
        allowNull: true,
    }),
    __metadata("design:type", Array)
], DiaryRequest.prototype, "assignedDiaryIds", void 0);
DiaryRequest = __decorate([
    (0, sequelize_typescript_1.Table)({
        tableName: "diary_requests",
        timestamps: true,
    })
], DiaryRequest);
exports.DiaryRequest = DiaryRequest;
