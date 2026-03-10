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
exports.SplitConfig = void 0;
const sequelize_typescript_1 = require("sequelize-typescript");
const Appuser_1 = require("./Appuser");
let SplitConfig = class SplitConfig extends sequelize_typescript_1.Model {
};
__decorate([
    (0, sequelize_typescript_1.Column)({
        type: sequelize_typescript_1.DataType.UUID,
        defaultValue: sequelize_typescript_1.DataType.UUIDV4,
        primaryKey: true,
    }),
    __metadata("design:type", String)
], SplitConfig.prototype, "id", void 0);
__decorate([
    (0, sequelize_typescript_1.Column)({
        type: sequelize_typescript_1.DataType.ENUM("PERCENTAGE", "FIXED"),
        allowNull: false,
    }),
    __metadata("design:type", String)
], SplitConfig.prototype, "splitType", void 0);
__decorate([
    (0, sequelize_typescript_1.Column)({
        type: sequelize_typescript_1.DataType.DECIMAL(10, 2),
        allowNull: false,
    }),
    __metadata("design:type", Number)
], SplitConfig.prototype, "vendorValue", void 0);
__decorate([
    (0, sequelize_typescript_1.Column)({
        type: sequelize_typescript_1.DataType.DECIMAL(10, 2),
        allowNull: false,
    }),
    __metadata("design:type", Number)
], SplitConfig.prototype, "doctorValue", void 0);
__decorate([
    (0, sequelize_typescript_1.Column)({
        type: sequelize_typescript_1.DataType.BOOLEAN,
        allowNull: false,
        defaultValue: true,
    }),
    __metadata("design:type", Boolean)
], SplitConfig.prototype, "isActive", void 0);
__decorate([
    (0, sequelize_typescript_1.ForeignKey)(() => Appuser_1.AppUser),
    (0, sequelize_typescript_1.Column)({
        type: sequelize_typescript_1.DataType.UUID,
        allowNull: false,
    }),
    __metadata("design:type", String)
], SplitConfig.prototype, "createdBy", void 0);
__decorate([
    (0, sequelize_typescript_1.BelongsTo)(() => Appuser_1.AppUser),
    __metadata("design:type", Appuser_1.AppUser)
], SplitConfig.prototype, "creator", void 0);
__decorate([
    (0, sequelize_typescript_1.Column)({
        type: sequelize_typescript_1.DataType.TEXT,
        allowNull: true,
    }),
    __metadata("design:type", String)
], SplitConfig.prototype, "notes", void 0);
SplitConfig = __decorate([
    (0, sequelize_typescript_1.Table)({
        tableName: "split_configs",
        timestamps: true,
    })
], SplitConfig);
exports.SplitConfig = SplitConfig;
