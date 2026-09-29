import { Router } from 'express';
import { simulateHandler, presetsHandler } from './controller';

const router = Router();

router.post('/simulate', simulateHandler);
router.get('/presets', presetsHandler);

export default router;
