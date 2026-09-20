import fs from 'fs';
import path from 'path';
import multer from 'multer';
import { v4 as uuidv4 } from 'uuid';
import { Request } from 'express';

const storageDir = process.env.RESUME_STORAGE_PATH || './storage/resumes';
const resolvedStorageDir = path.resolve(process.cwd(), storageDir);

// Ensure storage directory exists
if (!fs.existsSync(resolvedStorageDir)) {
  fs.mkdirSync(resolvedStorageDir, { recursive: true });
}

export const maxResumeSizeMB = parseInt(process.env.MAX_RESUME_SIZE_MB || '10', 10);
export const maxFileSizeBytes = maxResumeSizeMB * 1024 * 1024;

const allowedExtensions = ['.pdf', '.docx'];
const allowedMimeTypes = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/msword',
  'application/octet-stream' // fallback checked with extension
];

const diskStorage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, resolvedStorageDir);
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const sanitizedUuid = uuidv4();
    // Path traversal protection: pure UUID + normalized extension
    cb(null, `${sanitizedUuid}${ext}`);
  },
});

export const resumeUploadMiddleware = multer({
  storage: diskStorage,
  limits: {
    fileSize: maxFileSizeBytes,
  },
  fileFilter: (_req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (!allowedExtensions.includes(ext)) {
      return cb(new Error(`Unsupported file type '${ext}'. Only PDF and DOCX files are supported.`));
    }
    cb(null, true);
  },
});

export class StorageService {
  public static getStoragePath(): string {
    return resolvedStorageDir;
  }

  public static getAbsolutePath(filename: string): string {
    // Path traversal safety
    const safeFilename = path.basename(filename);
    return path.join(resolvedStorageDir, safeFilename);
  }

  public static deleteFile(storagePath: string): void {
    try {
      if (fs.existsSync(storagePath)) {
        fs.unlinkSync(storagePath);
      }
    } catch (e) {
      console.error(`Failed to delete file at ${storagePath}:`, e);
    }
  }

  public static readBuffer(storagePath: string): Buffer {
    return fs.readFileSync(storagePath);
  }
}
