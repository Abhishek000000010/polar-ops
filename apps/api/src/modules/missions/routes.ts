import { Router } from 'express';
import {
  getMissionsHandler,
  getMissionByIdHandler,
  createMissionHandler,
  updateMissionHandler
} from './controller';
import { authMiddleware } from '../../core/auth';

const router = Router();

router.use(authMiddleware);

router.get('/', getMissionsHandler);
router.get('/:id', getMissionByIdHandler);
router.post('/', createMissionHandler);
router.patch('/:id', updateMissionHandler);

export default router;
