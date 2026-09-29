import express from 'express';
import cors from 'cors';
import expeditionsRouter from './modules/expeditions/routes';
import missionsRouter from './modules/missions/routes';
import peopleRouter from './modules/people/routes';
import cargoRouter from './modules/cargo/routes';
import transportRouter from './modules/transport/routes';
import inventoryRouter from './modules/inventory/routes';
import assetsRouter from './modules/assets/routes';
import incidentsRouter from './modules/incidents/routes';
import dashboardRouter from './modules/dashboard/routes';
import scenariosRouter from './modules/scenarios/routes';
import blastRouter from './modules/blast/routes';
import seedRouter from './modules/seed/routes';
import authRouter from './modules/auth/routes';
import syncRouter from './modules/sync/routes';
import { successResponse, errorResponse } from '@polar-ops/shared';
import { nowISO } from './core/clock';

export function createApp() {
  const app = express();

  app.use(cors());
  app.use(express.json());

  // Health check
  app.get('/health', (req, res) => {
    res.json(successResponse({ status: 'HEALTHY', system: 'Polar-Ops NCPOR Operational Platform' }, { simulatedDate: nowISO() }));
  });

  // REST API v1 mounting
  const v1 = express.Router();
  v1.use('/auth', authRouter);
  v1.use('/expeditions', expeditionsRouter);
  v1.use('/missions', missionsRouter);
  v1.use('/people', peopleRouter);
  v1.use('/cargo', cargoRouter);
  v1.use('/transport', transportRouter);
  v1.use('/inventory', inventoryRouter);
  v1.use('/assets', assetsRouter);
  v1.use('/incidents', incidentsRouter);
  v1.use('/dashboard', dashboardRouter);
  v1.use('/scenarios', scenariosRouter);
  v1.use('/blast', blastRouter);
  v1.use('/sync', syncRouter);
  v1.use('/seed', seedRouter);

  app.use('/api/v1', v1);

  // 404 handler
  app.use((req, res) => {
    res.status(404).json(errorResponse(`Endpoint ${req.method} ${req.path} not found`, 'NOT_FOUND'));
  });

  return app;
}
