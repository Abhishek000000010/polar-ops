import { Router, Request, Response } from 'express';
import { successResponse, errorResponse } from '@polar-ops/shared';
import { getSyncStatus, setLink, resetSync, pushBatch, resolveConflict, prepareDemo, LinkDownError } from './service';
import { NodeId, LinkState, Constellation } from './types';

const router = Router();

const wrap = (fn: (req: Request) => Promise<any> | any) => async (req: Request, res: Response) => {
  try {
    res.json(successResponse(await fn(req)));
  } catch (err: any) {
    if (err instanceof LinkDownError) return res.status(503).json(errorResponse(err.message, 'LINK_DOWN'));
    res.status(err.message?.includes('not found') ? 404 : 400).json(errorResponse(err.message));
  }
};

router.get('/status', wrap(() => getSyncStatus()));

router.post('/push', wrap(req => pushBatch(req.body)));

router.post('/link', wrap(req => {
  const { nodeId, link, constellation } = req.body as { nodeId: NodeId; link: LinkState; constellation?: Constellation };
  if (!nodeId || !link) throw new Error('nodeId and link are required');
  return setLink(nodeId, link, constellation);
}));

router.post('/conflicts/:id/resolve', wrap(req => {
  const choice = req.body?.choice;
  if (choice !== 'STATION' && choice !== 'HQ') throw new Error('choice must be STATION or HQ');
  return resolveConflict(req.params.id, choice, req.body?.resolvedBy);
}));

router.post('/demo/prepare', wrap(req => prepareDemo((req.body?.nodeId as NodeId) || 'BHARATI')));

router.post('/reset', wrap(() => resetSync()));

export default router;
