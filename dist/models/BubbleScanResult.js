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
exports.BubbleScanResult = void 0;
const sequelize_typescript_1 = require("sequelize-typescript");
const Patient_1 = require("./Patient");
const DiaryPage_1 = require("./DiaryPage");
let BubbleScanResult = class BubbleScanResult extends sequelize_typescript_1.Model {
};
__decorate([
    (0, sequelize_typescript_1.Column)({
        type: sequelize_typescript_1.DataType.UUID,
        defaultValue: sequelize_typescript_1.DataType.UUIDV4,
        primaryKey: true,
    }),
    __metadata("design:type", String)
], BubbleScanResult.prototype, "id", void 0);
__decorate([
    (0, sequelize_typescript_1.ForeignKey)(() => Patient_1.Patient),
    (0, sequelize_typescript_1.Column)({
        type: sequelize_typescript_1.DataType.UUID,
        allowNull: false,
    }),
    __metadata("design:type", String)
], BubbleScanResult.prototype, "patientId", void 0);
__decorate([
    (0, sequelize_typescript_1.BelongsTo)(() => Patient_1.Patient),
    __metadata("design:type", Patient_1.Patient)
], BubbleScanResult.prototype, "patient", void 0);
__decorate([
    (0, sequelize_typescript_1.Column)({
        type: sequelize_typescript_1.DataType.ENUM("scan", "manual"),
        allowNull: false,
        defaultValue: "scan",
    }),
    __metadata("design:type", String)
], BubbleScanResult.prototype, "submissionType", void 0);
__decorate([
    (0, sequelize_typescript_1.Column)({
        type: sequelize_typescript_1.DataType.INTEGER,
        allowNull: true,
    }),
    __metadata("design:type", Number)
], BubbleScanResult.prototype, "pageNumber", void 0);
__decorate([
    (0, sequelize_typescript_1.ForeignKey)(() => DiaryPage_1.DiaryPage),
    (0, sequelize_typescript_1.Column)({
        type: sequelize_typescript_1.DataType.UUID,
        allowNull: true,
    }),
    __metadata("design:type", String)
], BubbleScanResult.prototype, "diaryPageId", void 0);
__decorate([
    (0, sequelize_typescript_1.BelongsTo)(() => DiaryPage_1.DiaryPage),
    __metadata("design:type", DiaryPage_1.DiaryPage)
], BubbleScanResult.prototype, "diaryPage", void 0);
__decorate([
    (0, sequelize_typescript_1.Column)({
        type: sequelize_typescript_1.DataType.STRING,
        allowNull: false,
    }),
    __metadata("design:type", String)
], BubbleScanResult.prototype, "pageId", void 0);
__decorate([
    (0, sequelize_typescript_1.Column)({
        type: sequelize_typescript_1.DataType.STRING,
        allowNull: true,
    }),
    __metadata("design:type", String)
], BubbleScanResult.prototype, "pageType", void 0);
__decorate([
    (0, sequelize_typescript_1.Column)({
        type: sequelize_typescript_1.DataType.STRING,
        allowNull: true,
    }),
    __metadata("design:type", String)
], BubbleScanResult.prototype, "templateName", void 0);
__decorate([
    (0, sequelize_typescript_1.Column)({
        type: sequelize_typescript_1.DataType.STRING,
        allowNull: true,
    }),
    __metadata("design:type", String)
], BubbleScanResult.prototype, "templateVersion", void 0);
__decorate([
    (0, sequelize_typescript_1.Column)({
        type: sequelize_typescript_1.DataType.STRING,
        allowNull: true,
    }),
    __metadata("design:type", String)
], BubbleScanResult.prototype, "imageUrl", void 0);
__decorate([
    (0, sequelize_typescript_1.Column)({
        type: sequelize_typescript_1.DataType.ENUM("pending", "processing", "completed", "failed"),
        defaultValue: "pending",
    }),
    __metadata("design:type", String)
], BubbleScanResult.prototype, "processingStatus", void 0);
__decorate([
    (0, sequelize_typescript_1.Column)({
        type: sequelize_typescript_1.DataType.JSONB,
        allowNull: true,
    }),
    __metadata("design:type", Object)
], BubbleScanResult.prototype, "scanResults", void 0);
__decorate([
    (0, sequelize_typescript_1.Column)({
        type: sequelize_typescript_1.DataType.JSONB,
        allowNull: true,
    }),
    __metadata("design:type", Object)
], BubbleScanResult.prototype, "rawConfidenceScores", void 0);
__decorate([
    (0, sequelize_typescript_1.Column)({
        type: sequelize_typescript_1.DataType.JSONB,
        allowNull: true,
    }),
    __metadata("design:type", Object)
], BubbleScanResult.prototype, "processingMetadata", void 0);
__decorate([
    (0, sequelize_typescript_1.Column)(sequelize_typescript_1.DataType.TEXT),
    __metadata("design:type", String)
], BubbleScanResult.prototype, "errorMessage", void 0);
__decorate([
    (0, sequelize_typescript_1.Column)({
        type: sequelize_typescript_1.DataType.DATE,
        defaultValue: sequelize_typescript_1.DataType.NOW,
    }),
    __metadata("design:type", Date)
], BubbleScanResult.prototype, "scannedAt", void 0);
__decorate([
    (0, sequelize_typescript_1.Column)({
        type: sequelize_typescript_1.DataType.BOOLEAN,
        defaultValue: false,
    }),
    __metadata("design:type", Boolean)
], BubbleScanResult.prototype, "doctorReviewed", void 0);
__decorate([
    (0, sequelize_typescript_1.Column)({
        type: sequelize_typescript_1.DataType.UUID,
        allowNull: true,
    }),
    __metadata("design:type", String)
], BubbleScanResult.prototype, "reviewedBy", void 0);
__decorate([
    (0, sequelize_typescript_1.Column)(sequelize_typescript_1.DataType.DATE),
    __metadata("design:type", Date)
], BubbleScanResult.prototype, "reviewedAt", void 0);
__decorate([
    (0, sequelize_typescript_1.Column)(sequelize_typescript_1.DataType.TEXT),
    __metadata("design:type", String)
], BubbleScanResult.prototype, "doctorNotes", void 0);
__decorate([
    (0, sequelize_typescript_1.Column)({
        type: sequelize_typescript_1.DataType.BOOLEAN,
        defaultValue: false,
    }),
    __metadata("design:type", Boolean)
], BubbleScanResult.prototype, "flagged", void 0);
__decorate([
    (0, sequelize_typescript_1.Column)({
        type: sequelize_typescript_1.DataType.JSONB,
        allowNull: true,
    }),
    __metadata("design:type", Object)
], BubbleScanResult.prototype, "doctorOverrides", void 0);
BubbleScanResult = __decorate([
    (0, sequelize_typescript_1.Table)({
        tableName: "bubble_scan_results",
        timestamps: true,
    })
], BubbleScanResult);
exports.BubbleScanResult = BubbleScanResult;
