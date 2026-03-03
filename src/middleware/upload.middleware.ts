import multer from "multer";
import path from "path";
import fs from "fs";

const uploadPath = path.join(__dirname, "../../uploads");

// Create folder if not exists
if (!fs.existsSync(uploadPath)) {
  fs.mkdirSync(uploadPath, { recursive: true });
}

const storage = multer.diskStorage({
  destination: function (req: any, file: any, cb: any) {
    cb(null, uploadPath);
  },
  filename: function (req: any, file: any, cb: any) {
    const uniqueName =
      Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, uniqueName + path.extname(file.originalname));
  },
});

export const upload = multer({ storage });

// Bubble scan specific upload (image-only, 10MB limit)
const bubbleScanPath = path.join(__dirname, "../../uploads/bubble_scans");
if (!fs.existsSync(bubbleScanPath)) {
  fs.mkdirSync(bubbleScanPath, { recursive: true });
}

const bubbleScanStorage = multer.diskStorage({
  destination: function (req: any, file: any, cb: any) {
    cb(null, bubbleScanPath);
  },
  filename: function (req: any, file: any, cb: any) {
    const uniqueName =
      Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, uniqueName + path.extname(file.originalname));
  },
});

export const bubbleScanUpload = multer({
  storage: bubbleScanStorage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB max
  fileFilter: (req: any, file: any, cb: any) => {
    const allowedTypes = ["image/jpeg", "image/png", "image/jpg"];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Only JPEG and PNG images are allowed"));
    }
  },
});

// ─── CANTrac Form Extraction Upload ──────────────────────────────────────────
// Uses memoryStorage so images are NEVER written to disk (healthcare privacy).
// The image buffer is processed in-memory and discarded after extraction.
const MAX_FORM_IMAGE_BYTES =
  parseInt(process.env.MAX_IMAGE_SIZE_MB || "10") * 1024 * 1024;

export const formExtractionUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FORM_IMAGE_BYTES },
  fileFilter: (req: any, file: any, cb: any) => {
    const allowedTypes = ["image/jpeg", "image/png", "image/jpg"];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Only JPEG and PNG images are accepted for form extraction"));
    }
  },
});
