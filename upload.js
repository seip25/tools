import multer from "multer";
import path from "node:path";
import fs from "node:fs";

/**
 * Helper class to manage file uploads for both Next.js App Router (web Request) and standard Express/Pages Router (multer).
 */
class Upload {
  /**
   * Configures Express/multer disk storage.
   * Saves uploaded files by default to `public/uploads` under the project root directory.
   * @param {string} [folder="uploads"] - Destination directory name inside the public directory.
   * @returns {import('multer').StorageEngine} The configured multer disk storage engine.
   */
  static storage(folder = "uploads") {
    const dest = path.join(process.cwd(), "public", folder);

    if (!fs.existsSync(dest)) {
      fs.mkdirSync(dest, { recursive: true });
    }

    return multer.diskStorage({
      destination: (req, file, cb) => {
        cb(null, dest);
      },
      filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
        cb(null, uniqueSuffix + path.extname(file.originalname));
      },
    });
  }

  /**
   * Returns a multer instance for single or multiple file uploads in Express or Next.js Pages Router API routes.
   * @param {Object} [options={}] - Configuration options for multer.
   * @param {string} [options.folder="uploads"] - Destination directory inside the public directory.
   * @param {number} [options.fileSize=5000000] - Max file size allowed in bytes (default 5MB).
   * @param {Array<string>} [options.allowedTypes=[]] - List of allowed MIME types (e.g. ['image/png', 'image/jpeg']).
   * @returns {import('multer').Multer} The configured multer instance.
   */
  static disk(options = {}) {
    const { folder = "uploads", fileSize = 5000000, allowedTypes = [] } = options;

    return multer({
      storage: this.storage(folder),
      limits: { fileSize },
      fileFilter: (req, file, cb) => {
        if (allowedTypes.length > 0 && !allowedTypes.includes(file.mimetype)) {
          return cb(new Error("File type not allowed"), false);
        }
        cb(null, true);
      },
    });
  }

  /**
   * Handles file upload natively in Next.js App Router (Route Handlers).
   * Parses the Web Request's multipart/form-data, validates sizes/types, and saves files under `public/uploads`.
   * @param {Request} request - The standard Web Request object (NextRequest).
   * @param {Object} [options={}] - Upload options.
   * @param {string} [options.folder="uploads"] - Destination folder relative to the public directory.
   * @param {number} [options.fileSize=5000000] - Max file size in bytes (default 5MB).
   * @param {Array<string>} [options.allowedTypes=[]] - Allowed MIME types (e.g., ['image/png', 'image/jpeg']).
   * @param {string} [options.fieldName="file"] - The name of the form-data key holding the file.
   * @returns {Promise<{success: boolean, filename?: string, originalName?: string, mimeType?: string, size?: number, url?: string, path?: string, error?: string}>} Resolves with upload status.
   */
  static async handleNextUpload(request, options = {}) {
    const {
      folder = "uploads",
      fileSize = 5000000,
      allowedTypes = [],
      fieldName = "file",
    } = options;

    try {
      const formData = await request.formData();
      const file = formData.get(fieldName);

      if (!file || typeof file === "string") {
        return { success: false, error: `No file found for key "${fieldName}".` };
      }

      if (file.size > fileSize) {
        return { success: false, error: `File size exceeds the allowed limit of ${fileSize} bytes.` };
      }

      if (allowedTypes.length > 0 && !allowedTypes.includes(file.type)) {
        return { success: false, error: `File type "${file.type}" is not allowed.` };
      }

      const bytes = await file.arrayBuffer();
      const buffer = Buffer.from(bytes);

      const destDir = path.join(process.cwd(), "public", folder);
      if (!fs.existsSync(destDir)) {
        fs.mkdirSync(destDir, { recursive: true });
      }

      const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
      const originalName = file.name || "";
      const ext = originalName.includes(".") ? path.extname(originalName) : "";
      const filename = uniqueSuffix + ext;
      const filePath = path.join(destDir, filename);

      await fs.promises.writeFile(filePath, buffer);

      const fileUrl = `/${folder}/${filename}`;

      let blurDataURL = null;
      if (options.generateBlurPlaceholder && file.type.startsWith("image/")) {
        try {
          const sharp = (await import("sharp")).default;
          const resizedBuffer = await sharp(buffer)
            .resize(8, 8)
            .toBuffer();
          blurDataURL = `data:${file.type};base64,${resizedBuffer.toString("base64")}`;
        } catch {}
      }

      return {
        success: true,
        filename,
        originalName: file.name,
        mimeType: file.type,
        size: file.size,
        url: fileUrl,
        path: filePath,
        blurDataURL,
      };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }

  /**
   * Helper to construct the public URL of a saved file.
   * @param {string} filename - The generated unique filename.
   * @param {string} [folder="uploads"] - The directory where the file is stored.
   * @returns {string} The public URL path of the file.
   */
  static url(filename, folder = "uploads") {
    return `/${folder}/${filename}`;
  }
}

export default Upload;
