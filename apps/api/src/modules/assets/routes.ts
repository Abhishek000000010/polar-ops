import { Router } from 'express';
import {
  getAssetsHandler,
  getAssetByIdHandler,
  createAssetHandler,
  updateAssetHandler,
  performMaintenanceHandler
} from './controller';
import { authMiddleware } from '../../core/auth';

const router = Router();

router.use(authMiddleware);

router.get('/', getAssetsHandler);
router.get('/:id', getAssetByIdHandler);
router.post('/', createAssetHandler);
router.patch('/:id', updateAssetHandler);
router.post('/:id/maintenance', performMaintenanceHandler);

export default router;
