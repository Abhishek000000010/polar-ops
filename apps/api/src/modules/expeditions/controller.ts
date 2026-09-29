import { Request, Response } from 'express';
import * as expeditionService from './service';
import { successResponse, errorResponse } from '@polar-ops/shared';
import { nowISO } from '../../core/clock';

export async function getExpeditionsHandler(req: Request, res: Response) {
  try {
    const list = await expeditionService.listExpeditions();
    res.json(successResponse(list, { total: list.length, simulatedDate: nowISO() }));
  } catch (err: any) {
    res.status(500).json(errorResponse(err.message));
  }
}

export async function getExpeditionByIdHandler(req: Request, res: Response) {
  try {
    const exp = await expeditionService.getExpeditionById(req.params.id);
    if (!exp) return res.status(404).json(errorResponse('Expedition not found', 'NOT_FOUND'));
    res.json(successResponse(exp, { simulatedDate: nowISO() }));
  } catch (err: any) {
    res.status(500).json(errorResponse(err.message));
  }
}

export async function createExpeditionHandler(req: Request, res: Response) {
  try {
    const actor = (req as any).user?.name || 'System';
    const created = await expeditionService.createExpedition(req.body, actor);
    res.status(201).json(successResponse(created, { simulatedDate: nowISO() }));
  } catch (err: any) {
    res.status(400).json(errorResponse(err.message, 'VALIDATION_ERROR', err.errors));
  }
}

export async function updateExpeditionHandler(req: Request, res: Response) {
  try {
    const actor = (req as any).user?.name || 'System';
    const updated = await expeditionService.updateExpedition(req.params.id, req.body, actor);
    if (!updated) return res.status(404).json(errorResponse('Expedition not found', 'NOT_FOUND'));
    res.json(successResponse(updated, { simulatedDate: nowISO() }));
  } catch (err: any) {
    res.status(400).json(errorResponse(err.message));
  }
}
