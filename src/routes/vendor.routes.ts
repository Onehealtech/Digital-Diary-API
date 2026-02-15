import { Router } from "express";
import { VendorController } from "../controllers/vendor.controller";
import { authCheck } from "../middleware/authMiddleware";

const router = Router();
const vendorController = new VendorController();

/**
 * Vendor Management Routes
 * Base path: /api/v1/vendors
 */

// GET /api/v1/vendors - List all vendors
router.get(
  "/",
  authCheck(["SUPER_ADMIN", "VENDOR"]),
  vendorController.getAllVendors.bind(vendorController)
);

// GET /api/v1/vendors/:id - Get vendor by ID
router.get(
  "/:id",
  authCheck(["SUPER_ADMIN", "VENDOR"]),
  vendorController.getVendorById.bind(vendorController)
);

// POST /api/v1/vendors - Create new vendor (SUPER_ADMIN only)
router.post(
  "/",
  authCheck(["SUPER_ADMIN"]),
  vendorController.createVendor.bind(vendorController)
);

// PUT /api/v1/vendors/:id - Update vendor
router.put(
  "/:id",
  authCheck(["SUPER_ADMIN", "VENDOR"]),
  vendorController.updateVendor.bind(vendorController)
);

// GET /api/v1/vendors/:id/wallet - Get vendor wallet
router.get(
  "/:id/wallet",
  authCheck(["SUPER_ADMIN", "VENDOR"]),
  vendorController.getVendorWallet.bind(vendorController)
);

// POST /api/v1/vendors/:id/wallet/transfer - Transfer funds (SUPER_ADMIN only)
router.post(
  "/:id/wallet/transfer",
  authCheck(["SUPER_ADMIN"]),
  vendorController.transferFunds.bind(vendorController)
);

// GET /api/v1/vendors/:id/sales - Get sales history
router.get(
  "/:id/sales",
  authCheck(["SUPER_ADMIN", "VENDOR"]),
  vendorController.getVendorSales.bind(vendorController)
);

// GET /api/v1/vendors/:id/inventory - Get assigned diaries
router.get(
  "/:id/inventory",
  authCheck(["SUPER_ADMIN", "VENDOR"]),
  vendorController.getVendorInventory.bind(vendorController)
);

// POST /api/v1/vendors/:id/sell-diary - Sell diary to patient
router.post(
  "/:id/sell-diary",
  authCheck(["VENDOR"]),
  vendorController.sellDiary.bind(vendorController)
);

// GET /api/v1/vendors/:id/dashboard - Get vendor dashboard stats
router.get(
  "/:id/dashboard",
  authCheck(["SUPER_ADMIN", "VENDOR"]),
  vendorController.getVendorDashboard.bind(vendorController)
);

export default router;
