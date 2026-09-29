import { Router } from 'express';
import {
  getCratesHandler,
  getCrateByIdHandler,
  createCrateHandler,
  advanceCrateStageHandler,
  updateCrateHandler
} from './controller';
import { authMiddleware } from '../../core/auth';

const router = Router();

router.use(authMiddleware);

router.get('/', getCratesHandler);
router.get('/:id', getCrateByIdHandler);
router.post('/', createCrateHandler);
router.post('/:id/advance', advanceCrateStageHandler);
router.patch('/:id', updateCrateHandler);

export default router;
