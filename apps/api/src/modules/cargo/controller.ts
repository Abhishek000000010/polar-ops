import { Request, Response } from 'express';
import * as cargoService from './service';
import { successResponse, errorResponse } from '@polar-ops/shared';
import { nowISO } from '../../core/clock';

export async function getCratesHandler(req: Request, res: Response) {
  try {
    const list = await cargoService.listCrates(req.query as any);
    res.json(successResponse(list, { total: list.length, simulatedDate: nowISO() }));
  } catch (err: any) {
    res.status(500).json(errorResponse(err.message));
  }
}

export async function getCrateByIdHandler(req: Request, res: Response) {
  try {
    const crate = await cargoService.getCrateById(req.params.id);
    if (!crate) return res.status(404).json(errorResponse('Crate not found', 'NOT_FOUND'));
    res.json(successResponse(crate, { simulatedDate: nowISO() }));
  } catch (err: any) {
    res.status(500).json(errorResponse(err.message));
  }
}

export async function createCrateHandler(req: Request, res: Response) {
  try {
    const actor = (req as any).user?.name || 'Logistics Officer';
    const created = await cargoService.createCrate(req.body, actor);
    res.status(201).json(successResponse(created, { simulatedDate: nowISO() }));
  } catch (err: any) {
    res.status(400).json(errorResponse(err.message, 'VALIDATION_ERROR', err.errors));
  }
}

export async function advanceCrateStageHandler(req: Request, res: Response) {
  try {
    const actor = (req as any).user?.name || 'Logistics Officer';
    const advanced = await cargoService.advanceCrateStage(req.params.id, actor);
    if (!advanced) return res.status(404).json(errorResponse('Crate not found', 'NOT_FOUND'));
    res.json(successResponse(advanced, { simulatedDate: nowISO() }));
  } catch (err: any) {
    res.status(400).json(errorResponse(err.message));
  }
}

export async function updateCrateHandler(req: Request, res: Response) {
  try {
    const actor = (req as any).user?.name || 'Logistics Officer';
    const updated = await cargoService.updateCrate(req.params.id, req.body, actor);
    if (!updated) return res.status(404).json(errorResponse('Crate not found', 'NOT_FOUND'));
    res.json(successResponse(updated, { simulatedDate: nowISO() }));
  } catch (err: any) {
    res.status(400).json(errorResponse(err.message));
  }
}
