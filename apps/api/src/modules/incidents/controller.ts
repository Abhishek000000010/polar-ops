import { Request, Response } from 'express';
import * as incidentService from './service';
import { successResponse, errorResponse } from '@polar-ops/shared';
import { nowISO } from '../../core/clock';

export async function getIncidentsHandler(req: Request, res: Response) {
  try {
    const list = await incidentService.listIncidents(req.query as any);
    res.json(successResponse(list, { total: list.length, simulatedDate: nowISO() }));
  } catch (err: any) {
    res.status(500).json(errorResponse(err.message));
  }
}

export async function getIncidentByIdHandler(req: Request, res: Response) {
  try {
    const incident = await incidentService.getIncidentById(req.params.id);
    if (!incident) return res.status(404).json(errorResponse('Incident not found', 'NOT_FOUND'));
    res.json(successResponse(incident, { simulatedDate: nowISO() }));
  } catch (err: any) {
    res.status(500).json(errorResponse(err.message));
  }
}

export async function createIncidentHandler(req: Request, res: Response) {
  try {
    const actor = (req as any).user?.name || 'Station Leader';
    const created = await incidentService.createIncident(req.body, actor);
    res.status(201).json(successResponse(created, { simulatedDate: nowISO() }));
  } catch (err: any) {
    res.status(400).json(errorResponse(err.message, 'VALIDATION_ERROR', err.errors));
  }
}

export async function addIncidentActionHandler(req: Request, res: Response) {
  try {
    const actor = (req as any).user?.name || 'Station Leader';
    const { actionText } = req.body;
    const updated = await incidentService.addIncidentAction(req.params.id, actionText, actor);
    if (!updated) return res.status(404).json(errorResponse('Incident not found', 'NOT_FOUND'));
    res.json(successResponse(updated, { simulatedDate: nowISO() }));
  } catch (err: any) {
    res.status(400).json(errorResponse(err.message));
  }
}

export async function closeIncidentHandler(req: Request, res: Response) {
  try {
    const actor = (req as any).user?.name || 'Station Leader';
    const { resolutionSummary } = req.body;
    const closed = await incidentService.closeIncident(req.params.id, resolutionSummary, actor);
    if (!closed) return res.status(404).json(errorResponse('Incident not found', 'NOT_FOUND'));
    res.json(successResponse(closed, { simulatedDate: nowISO() }));
  } catch (err: any) {
    res.status(400).json(errorResponse(err.message));
  }
}
