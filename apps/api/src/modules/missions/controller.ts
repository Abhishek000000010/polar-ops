import { Request, Response } from 'express';
import * as missionService from './service';
import { successResponse, errorResponse } from '@polar-ops/shared';
import { nowISO } from '../../core/clock';

export async function getMissionsHandler(req: Request, res: Response) {
  try {
    const list = await missionService.listMissions(req.query as any);
    res.json(successResponse(list, { total: list.length, simulatedDate: nowISO() }));
  } catch (err: any) {
    res.status(500).json(errorResponse(err.message));
  }
}

export async function getMissionByIdHandler(req: Request, res: Response) {
  try {
    const mission = await missionService.getMissionById(req.params.id);
    if (!mission) return res.status(404).json(errorResponse('Mission not found', 'NOT_FOUND'));
    res.json(successResponse(mission, { simulatedDate: nowISO() }));
  } catch (err: any) {
    res.status(500).json(errorResponse(err.message));
  }
}

export async function createMissionHandler(req: Request, res: Response) {
  try {
    const actor = (req as any).user?.name || 'System';
    const created = await missionService.createMission(req.body, actor);
    res.status(201).json(successResponse(created, { simulatedDate: nowISO() }));
  } catch (err: any) {
    res.status(400).json(errorResponse(err.message, 'VALIDATION_ERROR', err.errors));
  }
}

export async function updateMissionHandler(req: Request, res: Response) {
  try {
    const actor = (req as any).user?.name || 'System';
    const updated = await missionService.updateMission(req.params.id, req.body, actor);
    if (!updated) return res.status(404).json(errorResponse('Mission not found', 'NOT_FOUND'));
    res.json(successResponse(updated, { simulatedDate: nowISO() }));
  } catch (err: any) {
    res.status(400).json(errorResponse(err.message));
  }
}
