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

// Notification attachment upload (images + PDFs, 10MB)
const notificationAttachmentPath = path.join(__dirname, "../../uploads/notification_attachments");
if (!fs.existsSync(notificationAttachmentPath)) {
  fs.mkdirSync(notificationAttachmentPath, { recursive: true });
}

const notificationAttachmentStorage = multer.diskStorage({
  destination: function (req: any, file: any, cb: any) {
    cb(null, notificationAttachmentPath);
  },
  filename: function (req: any, file: any, cb: any) {
    const uniqueName = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, uniqueName + path.extname(file.originalname));
  },
});

export const notificationAttachmentUpload = multer({
  storage: notificationAttachmentStorage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB max
  fileFilter: (req: any, file: any, cb: any) => {
    const allowedTypes = ["image/jpeg", "image/png", "image/jpg", "application/pdf", "image/gif", "image/webp"];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Only images (JPEG, PNG, GIF, WebP) and PDF files are allowed"));
    }
  },
});

// Report upload — memory storage, supports PDF + images, up to 25 MB each, max 5 files
const REPORT_ALLOWED_TYPES = [
  "image/jpeg", "image/jpg", "image/png", "image/webp",
  "application/pdf",
];

export const reportUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 }, // 25 MB per file
  fileFilter: (req: any, file: any, cb: any) => {
    if (REPORT_ALLOWED_TYPES.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Only JPEG, PNG, WebP images and PDF files are allowed for reports"));
    }
  },
});

// Vision scan upload — memory storage (no local file, buffer goes to S3)
export const visionScanUpload = multer({
  storage: multer.memoryStorage(),
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
