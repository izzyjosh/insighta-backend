import { Router } from 'express';
import {
  validateRequest,
  validateQueryParams,
} from '../utils/validate-request';
import { profileController } from '../controllers/profile.controllers';
import {
  filterQuerySchema,
  naturalSearchSchema,
} from '../schemas/profile.schemas';

const profileRouter = Router();

profileRouter.post('/profiles', validateRequest(), (req, res, next) => {
  profileController.classify(req, res, next);
});

profileRouter.get(
  '/profiles',
  validateQueryParams(filterQuerySchema),
  (req, res, next) => {
    profileController.allProfiles(req, res, next);
  },
);

profileRouter.get(
  '/profiles/search',
  validateQueryParams(naturalSearchSchema),
  (req, res, next) => {
    profileController.naturalSearch(req, res, next);
  },
);

profileRouter.get('/profiles/:id', (req, res, next) => {
  profileController.getProfile(req, res, next);
});

profileRouter.delete('/profiles/:id', (req, res, next) => {
  profileController.deleteProfile(req, res, next);
});

export default profileRouter;
