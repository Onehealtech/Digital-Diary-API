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
exports.DoctorPatientHistory = void 0;
const sequelize_typescript_1 = require("sequelize-typescript");
const Patient_1 = require("./Patient");
const Appuser_1 = require("./Appuser");
let DoctorPatientHistory = class DoctorPatientHistory extends sequelize_typescript_1.Model {
};
__decorate([
    (0, sequelize_typescript_1.Column)({
        type: sequelize_typescript_1.DataType.UUID,
        defaultValue: sequelize_typescript_1.DataType.UUIDV4,
        primaryKey: true,
    }),
    __metadata("design:type", String)
], DoctorPatientHistory.prototype, "id", void 0);
__decorate([
    (0, sequelize_typescript_1.ForeignKey)(() => Patient_1.Patient),
    (0, sequelize_typescript_1.Column)({
        type: sequelize_typescript_1.DataType.UUID,
        allowNull: false,
    }),
    __metadata("design:type", String)
], DoctorPatientHistory.prototype, "patientId", void 0);
__decorate([
    (0, sequelize_typescript_1.BelongsTo)(() => Patient_1.Patient),
    __metadata("design:type", Patient_1.Patient)
], DoctorPatientHistory.prototype, "patient", void 0);
__decorate([
    (0, sequelize_typescript_1.ForeignKey)(() => Appuser_1.AppUser),
    (0, sequelize_typescript_1.Column)({
        type: sequelize_typescript_1.DataType.UUID,
        allowNull: false,
    }),
    __metadata("design:type", String)
], DoctorPatientHistory.prototype, "doctorId", void 0);
__decorate([
    (0, sequelize_typescript_1.BelongsTo)(() => Appuser_1.AppUser),
    __metadata("design:type", Appuser_1.AppUser)
], DoctorPatientHistory.prototype, "doctor", void 0);
__decorate([
    (0, sequelize_typescript_1.Column)({
        type: sequelize_typescript_1.DataType.DATE,
        allowNull: false,
    }),
    __metadata("design:type", Date)
], DoctorPatientHistory.prototype, "assignedAt", void 0);
__decorate([
    (0, sequelize_typescript_1.Column)({
        type: sequelize_typescript_1.DataType.DATE,
        allowNull: true,
    }),
    __metadata("design:type", Date)
], DoctorPatientHistory.prototype, "unassignedAt", void 0);
DoctorPatientHistory = __decorate([
    (0, sequelize_typescript_1.Table)({
        tableName: "doctor_patient_history",
        timestamps: true,
    })
], DoctorPatientHistory);
exports.DoctorPatientHistory = DoctorPatientHistory;
