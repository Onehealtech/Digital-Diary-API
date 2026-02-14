// src/controllers/splitConfig.controller.ts

import { Response } from "express";
import { AuthenticatedRequest } from "../middleware/authMiddleware";
import { SplitConfig } from "../models/SplitConfig";
import { validateSplitConfig } from "../service/split.service";
import { responseMiddleware } from "../utils/response";
import { sequelize } from "../config/Dbconnetion";
import { HTTP_STATUS } from "../utils/constants";

/**
 * POST /admin/split-config
 * SuperAdmin creates a new split configuration
 * Automatically deactivates the previous active config
 */
export const createSplitConfig = async (
    req: AuthenticatedRequest,
    res: Response
) => {
    try {
        const { splitType, vendorValue, doctorValue, notes } = req.body;

        if (!splitType || vendorValue === undefined || doctorValue === undefined) {
            return responseMiddleware(
                res,
                HTTP_STATUS.BAD_REQUEST,
                "Missing required fields: splitType, vendorValue, doctorValue"
            );
        }

        if (!["PERCENTAGE", "FIXED"].includes(splitType)) {
            return responseMiddleware(
                res,
                HTTP_STATUS.BAD_REQUEST,
                "splitType must be PERCENTAGE or FIXED"
            );
        }

        // Validate the config
        const validation = validateSplitConfig({
            splitType,
            vendorValue: parseFloat(vendorValue),
            doctorValue: parseFloat(doctorValue),
        });

        if (!validation.isValid) {
            return responseMiddleware(
                res,
                HTTP_STATUS.BAD_REQUEST,
                validation.errors.join("; ")
            );
        }

        // Atomic: deactivate old config + create new one
        const newConfig = await sequelize.transaction(async (t) => {
            // Deactivate all currently active configs
            await SplitConfig.update(
                { isActive: false },
                { where: { isActive: true }, transaction: t }
            );

            // Create new active config
            return await SplitConfig.create(
                {
                    splitType,
                    vendorValue: parseFloat(vendorValue),
                    doctorValue: parseFloat(doctorValue),
                    isActive: true,
                    createdBy: req.user.id,
                    notes: notes || null,
                },
                { transaction: t }
            );
        });

        return responseMiddleware(
            res,
            HTTP_STATUS.CREATED,
            "Split configuration created successfully",
            newConfig
        );
    } catch (error: any) {
        console.error("❌ Error creating split config:", error);
        return responseMiddleware(
            res,
            HTTP_STATUS.INTERNAL_SERVER_ERROR,
            error.message || "Failed to create split config"
        );
    }
};

/**
 * GET /admin/split-config
 * Get the currently active split configuration
 */
export const getActiveSplitConfig = async (
    req: AuthenticatedRequest,
    res: Response
) => {
    try {
        const config = await SplitConfig.findOne({
            where: { isActive: true },
            include: [
                {
                    association: "creator",
                    attributes: ["id", "fullName", "email"],
                },
            ],
        });

        if (!config) {
            return responseMiddleware(
                res,
                HTTP_STATUS.NOT_FOUND,
                "No active split configuration found"
            );
        }

        return responseMiddleware(
            res,
            HTTP_STATUS.OK,
            "Active split config fetched",
            config
        );
    } catch (error: any) {
        console.error("❌ Error fetching split config:", error);
        return responseMiddleware(
            res,
            HTTP_STATUS.INTERNAL_SERVER_ERROR,
            error.message || "Failed to fetch split config"
        );
    }
};

/**
 * PUT /admin/split-config/:id
 * Update an existing split configuration
 */
export const updateSplitConfig = async (
    req: AuthenticatedRequest,
    res: Response
) => {
    try {
        const { id }: any = req.params;
        const { splitType, vendorValue, doctorValue, notes } = req.body;

        const config = await SplitConfig.findByPk(id);
        if (!config) {
            return responseMiddleware(
                res,
                HTTP_STATUS.NOT_FOUND,
                "Split configuration not found"
            );
        }

        // Validate if values are changing
        const newSplitType = splitType || config.splitType;
        const newVendorValue =
            vendorValue !== undefined ? parseFloat(vendorValue) : config.vendorValue;
        const newDoctorValue =
            doctorValue !== undefined ? parseFloat(doctorValue) : config.doctorValue;

        const validation = validateSplitConfig({
            splitType: newSplitType,
            vendorValue: newVendorValue,
            doctorValue: newDoctorValue,
        });

        if (!validation.isValid) {
            return responseMiddleware(
                res,
                HTTP_STATUS.BAD_REQUEST,
                validation.errors.join("; ")
            );
        }

        config.splitType = newSplitType;
        config.vendorValue = newVendorValue;
        config.doctorValue = newDoctorValue;
        if (notes !== undefined) config.notes = notes;

        await config.save();

        return responseMiddleware(
            res,
            HTTP_STATUS.OK,
            "Split configuration updated successfully",
            config
        );
    } catch (error: any) {
        console.error("❌ Error updating split config:", error);
        return responseMiddleware(
            res,
            HTTP_STATUS.INTERNAL_SERVER_ERROR,
            error.message || "Failed to update split config"
        );
    }
};

/**
 * GET /admin/split-config/history
 * Get all split configurations (active and inactive)
 */
export const getSplitConfigHistory = async (
    req: AuthenticatedRequest,
    res: Response
) => {
    try {
        const configs = await SplitConfig.findAll({
            order: [["createdAt", "DESC"]],
            include: [
                {
                    association: "creator",
                    attributes: ["id", "fullName", "email"],
                },
            ],
        });

        return responseMiddleware(
            res,
            HTTP_STATUS.OK,
            "Split config history fetched",
            configs
        );
    } catch (error: any) {
        console.error("❌ Error fetching split config history:", error);
        return responseMiddleware(
            res,
            HTTP_STATUS.INTERNAL_SERVER_ERROR,
            error.message || "Failed to fetch split config history"
        );
    }
};
