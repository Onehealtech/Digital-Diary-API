"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.VendorController = void 0;
const vendor_service_1 = require("../service/vendor.service");
const response_1 = require("../utils/response");
const vendorService = new vendor_service_1.VendorService();
class VendorController {
    /**
     * GET /api/vendors - List all vendors
     */
    async getAllVendors(req, res) {
        try {
            const { page, limit, search, location, status } = req.query;
            const result = await vendorService.getAllVendors({
                page: page ? parseInt(page) : undefined,
                limit: limit ? parseInt(limit) : undefined,
                search: search,
                location: location,
                status: status,
            });
            return (0, response_1.sendResponse)(res, 200, "Vendors retrieved successfully", result);
        }
        catch (error) {
            return (0, response_1.sendError)(res, 500, "Failed to retrieve vendors", error.message);
        }
    }
    /**
     * GET /api/vendors/:id - Get vendor by ID
     */
    async getVendorById(req, res) {
        try {
            const id = req.params.id;
            const vendor = await vendorService.getVendorById(id);
            return (0, response_1.sendResponse)(res, 200, "Vendor retrieved successfully", vendor);
        }
        catch (error) {
            return (0, response_1.sendError)(res, 404, error.message);
        }
    }
    /**
     * POST /api/vendors - Create new vendor
     */
    async createVendor(req, res) {
        try {
            const { fullName, email, phone, password, businessName, address, city, state, gst, bankDetails, commissionRate, } = req.body;
            // Validation
            if (!fullName ||
                !email ||
                !password ||
                !businessName ||
                !address ||
                !city ||
                !state ||
                !gst ||
                !bankDetails) {
                return (0, response_1.sendError)(res, 400, "Missing required fields");
            }
            const result = await vendorService.createVendor({
                fullName,
                email,
                phone,
                password,
                businessName,
                address,
                city,
                state,
                gst,
                bankDetails,
                commissionRate,
            });
            return (0, response_1.sendResponse)(res, 201, "Vendor created successfully", result);
        }
        catch (error) {
            return (0, response_1.sendError)(res, 500, "Failed to create vendor", error.message);
        }
    }
    /**
     * PUT /api/vendors/:id - Update vendor
     */
    async updateVendor(req, res) {
        try {
            const id = req.params.id;
            const updates = req.body;
            const result = await vendorService.updateVendor(id, updates);
            return (0, response_1.sendResponse)(res, 200, "Vendor updated successfully", result);
        }
        catch (error) {
            return (0, response_1.sendError)(res, 500, "Failed to update vendor", error.message);
        }
    }
    /**
     * GET /api/vendors/:id/wallet - Get vendor wallet
     */
    async getVendorWallet(req, res) {
        try {
            const id = req.params.id;
            const { page, limit } = req.query;
            const result = await vendorService.getVendorWallet(id, page ? parseInt(page) : undefined, limit ? parseInt(limit) : undefined);
            return (0, response_1.sendResponse)(res, 200, "Wallet information retrieved successfully", result);
        }
        catch (error) {
            return (0, response_1.sendError)(res, 500, "Failed to retrieve wallet", error.message);
        }
    }
    /**
     * POST /api/vendors/:id/wallet/transfer - Transfer funds to vendor
     */
    async transferFunds(req, res) {
        try {
            const id = req.params.id;
            const { amount, description } = req.body;
            const processedBy = req.user.id; // From auth middleware
            if (!amount || amount <= 0) {
                return (0, response_1.sendError)(res, 400, "Invalid amount");
            }
            const result = await vendorService.transferFunds(id, amount, processedBy, description);
            return (0, response_1.sendResponse)(res, 200, "Funds transferred successfully", result);
        }
        catch (error) {
            return (0, response_1.sendError)(res, 500, "Failed to transfer funds", error.message);
        }
    }
    /**
     * GET /api/vendors/:id/sales - Get vendor sales history
     */
    async getVendorSales(req, res) {
        try {
            const id = req.params.id;
            const { page, limit, startDate, endDate, status } = req.query;
            const result = await vendorService.getVendorSales(id, {
                page: page ? parseInt(page) : undefined,
                limit: limit ? parseInt(limit) : undefined,
                startDate: startDate ? new Date(startDate) : undefined,
                endDate: endDate ? new Date(endDate) : undefined,
                status: status,
            });
            return (0, response_1.sendResponse)(res, 200, "Sales history retrieved successfully", result);
        }
        catch (error) {
            return (0, response_1.sendError)(res, 500, "Failed to retrieve sales history", error.message);
        }
    }
    /**
     * GET /api/vendors/:id/inventory - Get vendor inventory
     */
    async getVendorInventory(req, res) {
        try {
            const id = req.params.id;
            const { page, limit, status } = req.query;
            const result = await vendorService.getVendorInventory(id, {
                page: page ? parseInt(page) : undefined,
                limit: limit ? parseInt(limit) : undefined,
                status: status,
            });
            return (0, response_1.sendResponse)(res, 200, "Inventory retrieved successfully", result);
        }
        catch (error) {
            return (0, response_1.sendError)(res, 500, "Failed to retrieve inventory", error.message);
        }
    }
    /**
     * POST /api/vendors/:id/sell-diary - Sell diary to patient
     */
    async sellDiary(req, res) {
        try {
            const id = req.params.id;
            const { diaryId, patientName, age, gender, phone, address, doctorId, paymentAmount, } = req.body;
            // Validation
            if (!diaryId ||
                !patientName ||
                !age ||
                !gender ||
                !phone ||
                !address ||
                !doctorId ||
                !paymentAmount) {
                return (0, response_1.sendError)(res, 400, "Missing required fields");
            }
            const result = await vendorService.sellDiary({
                vendorId: id,
                diaryId,
                patientName,
                age,
                gender,
                phone,
                address,
                doctorId,
                paymentAmount,
            });
            return (0, response_1.sendResponse)(res, 201, "Diary sold successfully. Awaiting Super Admin approval.", result);
        }
        catch (error) {
            return (0, response_1.sendError)(res, 500, "Failed to sell diary", error.message);
        }
    }
    /**
     * PUT /api/vendors/:id/sales/:diaryId/mark-transferred - Mark sale as fund transferred
     */
    async markFundTransferred(req, res) {
        try {
            const vendorId = req.params.id;
            const diaryId = req.params.diaryId;
            const result = await vendorService.markFundTransferred(diaryId, vendorId);
            return (0, response_1.sendResponse)(res, 200, "Fund transfer marked successfully", result);
        }
        catch (error) {
            return (0, response_1.sendError)(res, 400, error.message);
        }
    }
    /**
     * GET /api/vendors/:id/dashboard - Get vendor dashboard stats
     */
    async getVendorDashboard(req, res) {
        try {
            const id = req.params.id;
            const result = await vendorService.getVendorDashboard(id);
            return (0, response_1.sendResponse)(res, 200, "Dashboard data retrieved successfully", result);
        }
        catch (error) {
            return (0, response_1.sendError)(res, 500, "Failed to retrieve dashboard data", error.message);
        }
    }
}
exports.VendorController = VendorController;
