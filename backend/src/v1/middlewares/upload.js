import multer from "multer";
import path from "path";
import fs from "fs";
import crypto from "crypto";

const uploadsDir = path.join(__dirname, "..", "uploads");
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const MAX_UPLOAD_BYTES = 5 * 1024 * 1024; // 5 MB
const ALLOWED_MIME = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
]);
const ALLOWED_EXT = new Set([".jpg", ".jpeg", ".png", ".webp", ".gif"]);

const storage = multer.diskStorage({
  destination: function (_, __, cb) {
    cb(null, uploadsDir);
  },
  filename: function (_, file, cb) {
    // Derive the extension from the declared type rather than echoing the
    // client's filename back onto the filesystem.
    const ext = path.extname(file.originalname).toLowerCase();
    const safeExt = ALLOWED_EXT.has(ext) ? ext : "";
    cb(null, `${Date.now()}-${crypto.randomBytes(8).toString("hex")}${safeExt}`);
  },
});

/**
 * Every upload here is an avatar or a group logo. Without a size cap or a type
 * filter the endpoints accepted arbitrary files of arbitrary size, wrote them
 * to local disk and handed them to Cloudinary.
 */
const upload = multer({
  storage,
  limits: { fileSize: MAX_UPLOAD_BYTES, files: 1 },
  fileFilter: (_, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (!ALLOWED_MIME.has(file.mimetype) || !ALLOWED_EXT.has(ext)) {
      return cb(
        Object.assign(new Error("Only JPEG, PNG, WebP or GIF images are allowed"), {
          status: 400,
        })
      );
    }
    return cb(null, true);
  },
});

export { MAX_UPLOAD_BYTES, uploadsDir };
export default upload;
