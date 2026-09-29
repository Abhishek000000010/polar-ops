import { Router } from 'express';
import {
  getIncidentsHandler,
  getIncidentByIdHandler,
  createIncidentHandler,
  addIncidentActionHandler,
  closeIncidentHandler
} from './controller';
import { authMiddleware } from '../../core/auth';

const router = Router();

router.use(authMiddleware);

router.get('/', getIncidentsHandler);
router.get('/:id', getIncidentByIdHandler);
router.post('/', createIncidentHandler);
router.post('/:id/actions', addIncidentActionHandler);
router.post('/:id/close', closeIncidentHandler);

export default router;
