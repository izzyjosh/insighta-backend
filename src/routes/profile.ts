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

const profileRouter = Router();

profileRouter.post(
  '/',
  validateRequest(),
  requireRole('admin'),
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

profileRouter.get('/:id', (req: Request<{ id: string }>, res: Response, next: NextFunction) => {
  profileController.getProfile(req, res, next);
});

profileRouter.delete('/:id', requireRole('admin'), (req: Request<{ id: string }>, res: Response, next: NextFunction) => {
  profileController.deleteProfile(req, res, next);
});

export default profileRouter;
