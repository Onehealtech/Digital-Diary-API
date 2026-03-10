"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const upload_controller_1 = require("../controllers/upload.controller");
const upload_middleware_1 = require("../middleware/upload.middleware");
const router = express_1.default.Router();
// Super Admin only routes
router.post("/:id", upload_middleware_1.upload.single("image"), 
// authCheck([UserRole.SUPER_ADMIN]),
upload_controller_1.uploadImage);
router.get("/image-history/:id", 
// authCheck([UserRole.SUPER_ADMIN]),
upload_controller_1.getImageHistory);
exports.default = router;
