import { Router } from 'express';
import {
  getDashboardStatsHandler,
  getAlertsHandler,
  getEventsHandler,
  getRippleGraphHandler,
  getClockHandler,
  setClockHandler,
  stepClockHandler,
  resetClockHandler,
  getOccupancyHandler
} from './controller';
import { authMiddleware } from '../../core/auth';

const router = Router();

router.use(authMiddleware);

router.get('/stats', getDashboardStatsHandler);
router.get('/alerts', getAlertsHandler);
router.get('/events', getEventsHandler);
router.get('/occupancy', getOccupancyHandler);
router.get('/ripple/:type/:id', getRippleGraphHandler);

router.get('/clock', getClockHandler);
router.post('/clock/set', setClockHandler);
router.post('/clock/step', stepClockHandler);
router.post('/clock/reset', resetClockHandler);

export default router;
