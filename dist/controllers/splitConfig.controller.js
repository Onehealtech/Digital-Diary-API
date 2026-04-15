"use strict";
// src/controllers/splitConfig.controller.ts
Object.defineProperty(exports, "__esModule", { value: true });
exports.getSplitConfigHistory = exports.updateSplitConfig = exports.getActiveSplitConfig = exports.createSplitConfig = void 0;
const SplitConfig_1 = require("../models/SplitConfig");
const split_service_1 = require("../service/split.service");
const response_1 = require("../utils/response");
const Dbconnetion_1 = require("../config/Dbconnetion");
const constants_1 = require("../utils/constants");
/**
 * POST /admin/split-config
 * SuperAdmin creates a new split configuration
 * Automatically deactivates the previous active config
 */
const createSplitConfig = async (req, res) => {
    try {
        const { splitType, vendorValue, doctorValue, notes } = req.body;
        if (!splitType || vendorValue === undefined || doctorValue === undefined) {
            return (0, response_1.responseMiddleware)(res, constants_1.HTTP_STATUS.BAD_REQUEST, "Missing required fields: splitType, vendorValue, doctorValue");
        }
        if (!["PERCENTAGE", "FIXED"].includes(splitType)) {
            return (0, response_1.responseMiddleware)(res, constants_1.HTTP_STATUS.BAD_REQUEST, "splitType must be PERCENTAGE or FIXED");
        }
        // Validate the config
        const validation = (0, split_service_1.validateSplitConfig)({
            splitType,
            vendorValue: parseFloat(vendorValue),
            doctorValue: parseFloat(doctorValue),
        });
        if (!validation.isValid) {
            return (0, response_1.responseMiddleware)(res, constants_1.HTTP_STATUS.BAD_REQUEST, validation.errors.join("; "));
        }
        // Atomic: deactivate old config + create new one
        const newConfig = await Dbconnetion_1.sequelize.transaction(async (t) => {
            // Deactivate all currently active configs
            await SplitConfig_1.SplitConfig.update({ isActive: false }, { where: { isActive: true }, transaction: t });
            // Create new active config
            return await SplitConfig_1.SplitConfig.create({
                splitType,
                vendorValue: parseFloat(vendorValue),
                doctorValue: parseFloat(doctorValue),
                isActive: true,
                createdBy: req.user.id,
                notes: notes || null,
            }, { transaction: t });
        });
        return (0, response_1.responseMiddleware)(res, constants_1.HTTP_STATUS.CREATED, "Split configuration created successfully", newConfig);
    }
    catch (error) {
        console.error("❌ Error creating split config:", error);
        return (0, response_1.responseMiddleware)(res, constants_1.HTTP_STATUS.INTERNAL_SERVER_ERROR, error.message || "Failed to create split config");
    }
};
exports.createSplitConfig = createSplitConfig;
/**
 * GET /admin/split-config
 * Get the currently active split configuration
 */
const getActiveSplitConfig = async (req, res) => {
    try {
        const config = await SplitConfig_1.SplitConfig.findOne({
            where: { isActive: true },
            include: [
                {
                    association: "creator",
                    attributes: ["id", "fullName", "email"],
                },
            ],
        });
        if (!config) {
            return (0, response_1.responseMiddleware)(res, constants_1.HTTP_STATUS.NOT_FOUND, "No active split configuration found");
        }
        return (0, response_1.responseMiddleware)(res, constants_1.HTTP_STATUS.OK, "Active split config fetched", config);
    }
    catch (error) {
        console.error("❌ Error fetching split config:", error);
        return (0, response_1.responseMiddleware)(res, constants_1.HTTP_STATUS.INTERNAL_SERVER_ERROR, error.message || "Failed to fetch split config");
    }
};
exports.getActiveSplitConfig = getActiveSplitConfig;
/**
 * PUT /admin/split-config/:id
 * Update an existing split configuration
 */
const updateSplitConfig = async (req, res) => {
    try {
        const { id } = req.params;
        const { splitType, vendorValue, doctorValue, notes } = req.body;
        const config = await SplitConfig_1.SplitConfig.findByPk(id);
        if (!config) {
            return (0, response_1.responseMiddleware)(res, constants_1.HTTP_STATUS.NOT_FOUND, "Split configuration not found");
        }
        // Validate if values are changing
        const newSplitType = splitType || config.splitType;
        const newVendorValue = vendorValue !== undefined ? parseFloat(vendorValue) : config.vendorValue;
        const newDoctorValue = doctorValue !== undefined ? parseFloat(doctorValue) : config.doctorValue;
        const validation = (0, split_service_1.validateSplitConfig)({
            splitType: newSplitType,
            vendorValue: newVendorValue,
            doctorValue: newDoctorValue,
        });
        if (!validation.isValid) {
            return (0, response_1.responseMiddleware)(res, constants_1.HTTP_STATUS.BAD_REQUEST, validation.errors.join("; "));
        }
        config.splitType = newSplitType;
        config.vendorValue = newVendorValue;
        config.doctorValue = newDoctorValue;
        if (notes !== undefined)
            config.notes = notes;
        await config.save();
        return (0, response_1.responseMiddleware)(res, constants_1.HTTP_STATUS.OK, "Split configuration updated successfully", config);
    }
    catch (error) {
        console.error("❌ Error updating split config:", error);
        return (0, response_1.responseMiddleware)(res, constants_1.HTTP_STATUS.INTERNAL_SERVER_ERROR, error.message || "Failed to update split config");
    }
};
exports.updateSplitConfig = updateSplitConfig;
/**
 * GET /admin/split-config/history
 * Get all split configurations (active and inactive)
 */
const getSplitConfigHistory = async (req, res) => {
    try {
        const configs = await SplitConfig_1.SplitConfig.findAll({
            order: [["createdAt", "DESC"]],
            include: [
                {
                    association: "creator",
                    attributes: ["id", "fullName", "email"],
                },
            ],
        });
        return (0, response_1.responseMiddleware)(res, constants_1.HTTP_STATUS.OK, "Split config history fetched", configs);
    }
    catch (error) {
        console.error("❌ Error fetching split config history:", error);
        return (0, response_1.responseMiddleware)(res, constants_1.HTTP_STATUS.INTERNAL_SERVER_ERROR, error.message || "Failed to fetch split config history");
    }
};
exports.getSplitConfigHistory = getSplitConfigHistory;
