import { Router } from 'express';
import {
  getTransportHandler,
  getTransportByIdHandler,
  createTransportHandler,
  updateTransportHandler,
  delayTransportHandler
} from './controller';
import { authMiddleware } from '../../core/auth';

const router = Router();

router.use(authMiddleware);

router.get('/', getTransportHandler);
router.get('/:id', getTransportByIdHandler);
router.post('/', createTransportHandler);
router.patch('/:id', updateTransportHandler);
router.post('/:id/delay', delayTransportHandler);

export default router;
