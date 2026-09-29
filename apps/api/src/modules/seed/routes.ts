import { Router } from 'express';
import { resetDatabaseHandler } from './controller';
import { authMiddleware } from '../../core/auth';

const router = Router();

router.use(authMiddleware);
router.post('/reset', resetDatabaseHandler);

export default router;
