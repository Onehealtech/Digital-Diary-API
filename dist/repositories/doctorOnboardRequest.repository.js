"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.doctorOnboardRequestRepository = void 0;
const sequelize_1 = require("sequelize");
const DoctorOnboardRequest_1 = require("../models/DoctorOnboardRequest");
const Appuser_1 = require("../models/Appuser");
class DoctorOnboardRequestRepository {
    async create(data) {
        return DoctorOnboardRequest_1.DoctorOnboardRequest.create(data);
    }
    async findById(id) {
        return DoctorOnboardRequest_1.DoctorOnboardRequest.findByPk(id, {
            include: [
                { model: Appuser_1.AppUser, as: "vendor", attributes: ["id", "fullName", "email", "phone"] },
                { model: Appuser_1.AppUser, as: "reviewer", attributes: ["id", "fullName"] },
                { model: Appuser_1.AppUser, as: "doctor", attributes: ["id", "fullName", "email", "phone", "hospital", "specialization"] },
            ],
        });
    }
    async findByVendorId(vendorId, filters = {}) {
        const { status, page = 1, limit = 20, search } = filters;
        const offset = (page - 1) * limit;
        const where = { vendorId };
        if (status)
            where.status = status;
        if (search) {
            where[sequelize_1.Op.or] = [
                { fullName: { [sequelize_1.Op.iLike]: `%${search}%` } },
                { email: { [sequelize_1.Op.iLike]: `%${search}%` } },
            ];
        }
        return DoctorOnboardRequest_1.DoctorOnboardRequest.findAndCountAll({
            where,
            include: [
                { model: Appuser_1.AppUser, as: "doctor", attributes: ["id", "fullName", "email", "hospital", "specialization"] },
            ],
            order: [["createdAt", "DESC"]],
            limit,
            offset,
        });
    }
    async findAll(filters = {}) {
        const { status, page = 1, limit = 20, search } = filters;
        const offset = (page - 1) * limit;
        const where = {};
        if (status)
            where.status = status;
        if (search) {
            where[sequelize_1.Op.or] = [
                { fullName: { [sequelize_1.Op.iLike]: `%${search}%` } },
                { email: { [sequelize_1.Op.iLike]: `%${search}%` } },
            ];
        }
        return DoctorOnboardRequest_1.DoctorOnboardRequest.findAndCountAll({
            where,
            include: [
                { model: Appuser_1.AppUser, as: "vendor", attributes: ["id", "fullName", "email", "phone"] },
                { model: Appuser_1.AppUser, as: "doctor", attributes: ["id", "fullName", "email", "hospital", "specialization"] },
            ],
            order: [["createdAt", "DESC"]],
            limit,
            offset,
        });
    }
    async findPendingByEmail(email) {
        return DoctorOnboardRequest_1.DoctorOnboardRequest.findOne({
            where: { email: email.toLowerCase(), status: "PENDING" },
        });
    }
    /**
     * Find existing doctors matching by phone or license number
     */
    async findDuplicateDoctors(phone, license) {
        const conditions = [];
        if (phone && phone.trim()) {
            conditions.push({ phone: phone.trim() });
        }
        if (license && license.trim()) {
            conditions.push({ license: { [sequelize_1.Op.iLike]: license.trim() } });
        }
        if (conditions.length === 0)
            return [];
        return Appuser_1.AppUser.findAll({
            where: {
                role: "DOCTOR",
                [sequelize_1.Op.or]: conditions,
            },
            attributes: [
                "id", "fullName", "email", "phone", "license", "hospital",
                "specialization", "city", "state", "isActive", "createdAt",
            ],
            paranoid: false,
        });
    }
    async updateStatus(id, data, transaction) {
        await DoctorOnboardRequest_1.DoctorOnboardRequest.update({
            status: data.status,
            reviewedBy: data.reviewedBy,
            reviewedAt: new Date(),
            rejectionReason: data.rejectionReason || null,
            doctorId: data.doctorId || null,
        }, { where: { id }, ...(transaction && { transaction }) });
    }
}
exports.doctorOnboardRequestRepository = new DoctorOnboardRequestRepository();
