import { Request, Response } from 'express';
import { resetAndSeedDatabase } from './service';
import { successResponse, errorResponse } from '@polar-ops/shared';
import { nowISO } from '../../core/clock';

export async function resetDatabaseHandler(req: Request, res: Response) {
  try {
    const actor = (req as any).user?.name || 'Administrator';
    const result = await resetAndSeedDatabase(actor);
    res.json(successResponse(result, { message: 'Database reset to clean baseline world.', simulatedDate: nowISO() }));
  } catch (err: any) {
    res.status(500).json(errorResponse(err.message));
  }
}
