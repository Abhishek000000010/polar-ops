import { Router } from 'express';
import {
  getExpeditionsHandler,
  getExpeditionByIdHandler,
  createExpeditionHandler,
  updateExpeditionHandler
} from './controller';
import { authMiddleware } from '../../core/auth';

const router = Router();

router.use(authMiddleware);

router.get('/', getExpeditionsHandler);
router.get('/:id', getExpeditionByIdHandler);
router.post('/', createExpeditionHandler);
router.patch('/:id', updateExpeditionHandler);

export default router;
