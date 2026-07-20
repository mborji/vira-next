import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";
import multer from "multer";
import { authenticateToken, requireAdmin } from "../middleware/auth.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = express.Router();

const PROJECTS_UPLOAD_DIR = path.join(
  __dirname,
  "../../public/uploads/projects"
);
const BLOGS_UPLOAD_DIR = path.join(__dirname, "../../public/uploads/blogs");

function createUpload(uploadDir) {
  return multer({
    storage: multer.diskStorage({
      destination: (_req, _file, cb) => {
        if (!fs.existsSync(uploadDir)) {
          fs.mkdirSync(uploadDir, { recursive: true, mode: 0o755 });
        }
        cb(null, uploadDir);
      },
      filename: (_req, file, cb) => {
        const ext = path.extname(file.originalname) || ".jpg";
        cb(
          null,
          `${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`
        );
      },
    }),
    limits: { fileSize: 10 * 1024 * 1024 },
    fileFilter: (_req, file, cb) => {
      if (file.mimetype.startsWith("image/")) {
        cb(null, true);
      } else {
        cb(new Error("Only image files are allowed"));
      }
    },
  });
}

const projectUpload = createUpload(PROJECTS_UPLOAD_DIR);
const blogUpload = createUpload(BLOGS_UPLOAD_DIR);

function buildImageUrl(folder, filename) {
  const base =
    process.env.PUBLIC_API_URL?.replace(/\/$/, "") || "https://viraap.co";
  return `${base}/uploads/${folder}/${filename}`;
}

function handleImageUpload(uploadMiddleware) {
  return (req, res, next) => {
    uploadMiddleware.single("image")(req, res, (err) => {
      if (err) {
        if (err.code === "LIMIT_FILE_SIZE") {
          return res
            .status(413)
            .json({ error: "Image must be smaller than 10MB" });
        }
        return res.status(400).json({ error: err.message });
      }
      next();
    });
  };
}

// POST /project-image — multipart field "image" (preferred)
router.post(
  "/project-image",
  authenticateToken,
  requireAdmin,
  handleImageUpload(projectUpload),
  (req, res) => {
    if (!req.file) {
      return res.status(400).json({ error: "No image provided" });
    }
    res.json({ imageUrl: buildImageUrl("projects", req.file.filename) });
  }
);

// POST /blog-image — multipart field "image" (preferred)
router.post(
  "/blog-image",
  authenticateToken,
  requireAdmin,
  handleImageUpload(blogUpload),
  (req, res) => {
    if (!req.file) {
      return res.status(400).json({ error: "No image provided" });
    }
    res.json({ imageUrl: buildImageUrl("blogs", req.file.filename) });
  }
);

// Delete project image
router.delete("/project-image", (req, res) => {
  try {
    const { imageUrl } = req.body;
    if (!imageUrl) {
      return res.status(400).json({ error: "No image URL provided" });
    }

    const filename = path.basename(imageUrl);
    const filePath = path.join(
      __dirname,
      "../../public/uploads/projects",
      filename
    );

    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      res.json({ message: "Image deleted successfully" });
    } else {
      res.status(404).json({ error: "Image not found" });
    }

  } catch (error) {
    console.error("Delete error:", error);
    res.status(500).json({ error: error.message });
  }

});

export default router;