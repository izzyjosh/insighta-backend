import { Router, Request, Response, NextFunction } from 'express';
import {
  validateRequest,
  validateQueryParams,
} from '../utils/validate-request';
import { profileController } from '../controllers/profile.controllers';
import {
  filterQuerySchema,
  naturalSearchSchema,
} from '../schemas/profile.schemas';
import { requireRole } from '../middlewares/authMiddleware';
import multer from 'multer';
import fs from 'fs';
import { promises as fsPromises } from 'fs';
import os from 'os';
import path from 'path';

const uploadDir = path.join(os.tmpdir(), 'insighta-uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

async function cleanupStaleUploadFiles(): Promise<void> {
  const staleAfterMs = 24 * 60 * 60 * 1000;

  try {
    const files = await fsPromises.readdir(uploadDir);
    const now = Date.now();

    await Promise.all(
      files.map(async (file) => {
        const filePath = path.join(uploadDir, file);

        try {
          const stats = await fsPromises.stat(filePath);
          if (now - stats.mtimeMs > staleAfterMs) {
            await fsPromises.unlink(filePath);
          }
        } catch {
          return;
        }
      }),
    );
  } catch {
    return;
  }
}

void cleanupStaleUploadFiles();

const profileRouter = Router();

const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => {
      cb(null, uploadDir);
    },
    filename: (_req, file, cb) => {
      const uniqueName = `${Date.now()}-${Math.random().toString(36).slice(2)}-${file.originalname}`;
      cb(null, uniqueName);
    },
  }),
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'text/csv' || file.originalname.endsWith('.csv')) {
      cb(null, true);
      return;
    }
    cb(new Error('Only CSV files are allowed'));
  },
  limits: {
    fileSize: 100 * 1024 * 1024,
  },
});

profileRouter.post(
  '/',
  requireRole('admin'),
  validateRequest(),
  (req, res, next) => {
    profileController.classify(req, res, next);
  },
);

profileRouter.get(
  '/',
  validateQueryParams(filterQuerySchema),
  (req, res, next) => {
    profileController.allProfiles(req, res, next);
  },
);

profileRouter.get(
  '/search',
  validateQueryParams(naturalSearchSchema),
  (req, res, next) => {
    profileController.naturalSearch(req, res, next);
  },
);

profileRouter.get(
  '/export',
  validateQueryParams(filterQuerySchema),
  (req, res, next) => {
    profileController.exportProfiles(req, res, next);
  },
);

profileRouter.get(
  '/:id',
  (req: Request<{ id: string }>, res: Response, next: NextFunction) => {
    profileController.getProfile(req, res, next);
  },
);

profileRouter.delete(
  '/:id',
  requireRole('admin'),
  (req: Request<{ id: string }>, res: Response, next: NextFunction) => {
    profileController.deleteProfile(req, res, next);
  },
);

profileRouter.post(
  '/bulk-upload',
  requireRole('admin'),
  upload.single('file'),
  (req, res, next) => {
    profileController.bulkUploadCSV(req, res, next);
  },
);

profileRouter.get(
  '/bulk-upload/:uploadId/status',
  requireRole('admin'),
  (req, res, next) => {
    profileController.getBulkUploadStatus(req, res, next);
  },
);

export default profileRouter;
