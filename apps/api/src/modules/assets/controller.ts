import { Request, Response } from 'express';
import * as assetService from './service';
import { successResponse, errorResponse } from '@polar-ops/shared';
import { nowISO } from '../../core/clock';

export async function getAssetsHandler(req: Request, res: Response) {
  try {
    const list = await assetService.listAssets(req.query as any);
    res.json(successResponse(list, { total: list.length, simulatedDate: nowISO() }));
  } catch (err: any) {
    res.status(500).json(errorResponse(err.message));
  }
}

export async function getAssetByIdHandler(req: Request, res: Response) {
  try {
    const asset = await assetService.getAssetById(req.params.id);
    if (!asset) return res.status(404).json(errorResponse('Asset not found', 'NOT_FOUND'));
    res.json(successResponse(asset, { simulatedDate: nowISO() }));
  } catch (err: any) {
    res.status(500).json(errorResponse(err.message));
  }
}

export async function createAssetHandler(req: Request, res: Response) {
  try {
    const actor = (req as any).user?.name || 'Station Engineer';
    const created = await assetService.createAsset(req.body, actor);
    res.status(201).json(successResponse(created, { simulatedDate: nowISO() }));
  } catch (err: any) {
    res.status(400).json(errorResponse(err.message, 'VALIDATION_ERROR', err.errors));
  }
}

export async function updateAssetHandler(req: Request, res: Response) {
  try {
    const actor = (req as any).user?.name || 'Station Engineer';
    const updated = await assetService.updateAsset(req.params.id, req.body, actor);
    if (!updated) return res.status(404).json(errorResponse('Asset not found', 'NOT_FOUND'));
    res.json(successResponse(updated, { simulatedDate: nowISO() }));
  } catch (err: any) {
    res.status(400).json(errorResponse(err.message));
  }
}

export async function performMaintenanceHandler(req: Request, res: Response) {
  try {
    const actor = (req as any).user?.name || 'Station Engineer';
    const { serviceNotes, nextDueDate, hoursAdded } = req.body;
    const updated = await assetService.performMaintenance(
      req.params.id,
      serviceNotes || 'Scheduled PM routine',
      nextDueDate,
      Number(hoursAdded || 0),
      actor
    );
    if (!updated) return res.status(404).json(errorResponse('Asset not found', 'NOT_FOUND'));
    res.json(successResponse(updated, { simulatedDate: nowISO() }));
  } catch (err: any) {
    res.status(400).json(errorResponse(err.message));
  }
}
