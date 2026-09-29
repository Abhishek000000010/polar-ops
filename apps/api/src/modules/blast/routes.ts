import { Router, Request, Response } from 'express';
import { successResponse, errorResponse } from '@polar-ops/shared';
import { computeBlastRadius, listBlastCatalog } from './service';

const router = Router();

router.get('/catalog', async (_req: Request, res: Response) => {
  try {
    res.json(successResponse(await listBlastCatalog()));
  } catch (err: any) {
    res.status(500).json(errorResponse(err.message));
  }
});

router.get('/:type/:id', async (req: Request, res: Response) => {
  try {
    const depth = Math.min(6, Math.max(1, Number(req.query.depth) || 5));
    let id = req.params.id;
    try {
      id = decodeURIComponent(id);
    } catch {
      // fallback to raw
    }
    res.json(successResponse(await computeBlastRadius(req.params.type, id, depth)));
  } catch (err: any) {
    res.status(err.message?.includes('not found') ? 404 : 500).json(errorResponse(err.message));
  }
});

export default router;
