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
exports.PatientPreferences = void 0;
const sequelize_typescript_1 = require("sequelize-typescript");
const Patient_1 = require("./Patient");
let PatientPreferences = class PatientPreferences extends sequelize_typescript_1.Model {
};
__decorate([
    (0, sequelize_typescript_1.ForeignKey)(() => Patient_1.Patient),
    (0, sequelize_typescript_1.Column)({
        type: sequelize_typescript_1.DataType.UUID,
        primaryKey: true,
        allowNull: false,
    }),
    __metadata("design:type", String)
], PatientPreferences.prototype, "patientId", void 0);
__decorate([
    (0, sequelize_typescript_1.BelongsTo)(() => Patient_1.Patient),
    __metadata("design:type", Patient_1.Patient)
], PatientPreferences.prototype, "patient", void 0);
__decorate([
    (0, sequelize_typescript_1.Column)({
        type: sequelize_typescript_1.DataType.ENUM("device", "user"),
        defaultValue: "device",
        allowNull: false,
    }),
    __metadata("design:type", String)
], PatientPreferences.prototype, "languageSource", void 0);
PatientPreferences = __decorate([
    (0, sequelize_typescript_1.Table)({
        tableName: "patient_preferences",
        timestamps: true,
    })
], PatientPreferences);
exports.PatientPreferences = PatientPreferences;
