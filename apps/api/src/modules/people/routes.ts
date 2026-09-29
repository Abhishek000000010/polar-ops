import { Router } from 'express';
import {
  getPeopleHandler,
  getPersonByIdHandler,
  createPersonHandler,
  updatePersonHandler,
  updateReadinessHandler,
  swapStandbyHandler
} from './controller';
import { authMiddleware } from '../../core/auth';

const router = Router();

router.use(authMiddleware);

router.get('/', getPeopleHandler);
router.get('/:id', getPersonByIdHandler);
router.post('/', createPersonHandler);
router.patch('/:id', updatePersonHandler);
router.patch('/:id/readiness', updateReadinessHandler);
router.post('/:id/swap-standby', swapStandbyHandler);

export default router;
