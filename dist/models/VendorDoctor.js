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
exports.VendorDoctor = void 0;
const sequelize_typescript_1 = require("sequelize-typescript");
const Appuser_1 = require("./Appuser");
const DoctorOnboardRequest_1 = require("./DoctorOnboardRequest");
let VendorDoctor = class VendorDoctor extends sequelize_typescript_1.Model {
};
__decorate([
    (0, sequelize_typescript_1.Column)({
        type: sequelize_typescript_1.DataType.UUID,
        defaultValue: sequelize_typescript_1.DataType.UUIDV4,
        primaryKey: true,
    }),
    __metadata("design:type", String)
], VendorDoctor.prototype, "id", void 0);
__decorate([
    (0, sequelize_typescript_1.ForeignKey)(() => Appuser_1.AppUser),
    (0, sequelize_typescript_1.Column)({ type: sequelize_typescript_1.DataType.UUID, allowNull: false }),
    __metadata("design:type", String)
], VendorDoctor.prototype, "vendorId", void 0);
__decorate([
    (0, sequelize_typescript_1.BelongsTo)(() => Appuser_1.AppUser, "vendorId"),
    __metadata("design:type", Appuser_1.AppUser)
], VendorDoctor.prototype, "vendor", void 0);
__decorate([
    (0, sequelize_typescript_1.ForeignKey)(() => Appuser_1.AppUser),
    (0, sequelize_typescript_1.Column)({ type: sequelize_typescript_1.DataType.UUID, allowNull: false }),
    __metadata("design:type", String)
], VendorDoctor.prototype, "doctorId", void 0);
__decorate([
    (0, sequelize_typescript_1.BelongsTo)(() => Appuser_1.AppUser, "doctorId"),
    __metadata("design:type", Appuser_1.AppUser)
], VendorDoctor.prototype, "doctor", void 0);
__decorate([
    (0, sequelize_typescript_1.ForeignKey)(() => Appuser_1.AppUser),
    (0, sequelize_typescript_1.Column)({ type: sequelize_typescript_1.DataType.UUID, allowNull: true }),
    __metadata("design:type", String)
], VendorDoctor.prototype, "assignedBy", void 0);
__decorate([
    (0, sequelize_typescript_1.ForeignKey)(() => DoctorOnboardRequest_1.DoctorOnboardRequest),
    (0, sequelize_typescript_1.Column)({ type: sequelize_typescript_1.DataType.UUID, allowNull: true }),
    __metadata("design:type", String)
], VendorDoctor.prototype, "onboardRequestId", void 0);
__decorate([
    (0, sequelize_typescript_1.BelongsTo)(() => DoctorOnboardRequest_1.DoctorOnboardRequest, "onboardRequestId"),
    __metadata("design:type", DoctorOnboardRequest_1.DoctorOnboardRequest)
], VendorDoctor.prototype, "onboardRequest", void 0);
VendorDoctor = __decorate([
    (0, sequelize_typescript_1.Table)({
        tableName: "vendor_doctors",
        timestamps: true,
    })
], VendorDoctor);
exports.VendorDoctor = VendorDoctor;
