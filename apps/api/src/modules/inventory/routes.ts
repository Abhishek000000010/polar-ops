import { Router } from 'express';
import {
  getInventoryHandler,
  getInventoryByIdHandler,
  createInventoryItemHandler,
  recordTransactionHandler,
  getTransactionsHandler,
  getInventoryForecastHandler
} from './controller';
import { authMiddleware } from '../../core/auth';

const router = Router();

router.use(authMiddleware);

router.get('/', getInventoryHandler);
router.get('/forecast', getInventoryForecastHandler);
router.get('/transactions', getTransactionsHandler);
router.get('/:id', getInventoryByIdHandler);
router.post('/', createInventoryItemHandler);
router.post('/:id/transactions', recordTransactionHandler);

export default router;
