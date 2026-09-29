import { Request, Response } from 'express';
import * as peopleService from './service';
import { successResponse, errorResponse } from '@polar-ops/shared';
import { nowISO } from '../../core/clock';

export async function getPeopleHandler(req: Request, res: Response) {
  try {
    const list = await peopleService.listPeople(req.query as any);
    res.json(successResponse(list, { total: list.length, simulatedDate: nowISO() }));
  } catch (err: any) {
    res.status(500).json(errorResponse(err.message));
  }
}

export async function getPersonByIdHandler(req: Request, res: Response) {
  try {
    const person = await peopleService.getPersonById(req.params.id);
    if (!person) return res.status(404).json(errorResponse('Person not found', 'NOT_FOUND'));
    res.json(successResponse(person, { simulatedDate: nowISO() }));
  } catch (err: any) {
    res.status(500).json(errorResponse(err.message));
  }
}

export async function createPersonHandler(req: Request, res: Response) {
  try {
    const actor = (req as any).user?.name || 'System';
    const created = await peopleService.createPerson(req.body, actor);
    res.status(201).json(successResponse(created, { simulatedDate: nowISO() }));
  } catch (err: any) {
    res.status(400).json(errorResponse(err.message, 'VALIDATION_ERROR', err.errors));
  }
}

export async function updatePersonHandler(req: Request, res: Response) {
  try {
    const actor = (req as any).user?.name || 'System';
    const updated = await peopleService.updatePerson(req.params.id, req.body, actor);
    if (!updated) return res.status(404).json(errorResponse('Person not found', 'NOT_FOUND'));
    res.json(successResponse(updated, { simulatedDate: nowISO() }));
  } catch (err: any) {
    res.status(400).json(errorResponse(err.message));
  }
}

export async function updateReadinessHandler(req: Request, res: Response) {
  try {
    const actor = (req as any).user?.name || 'System';
    const updated = await peopleService.updateReadiness(req.params.id, req.body, actor);
    if (!updated) return res.status(404).json(errorResponse('Person not found', 'NOT_FOUND'));
    res.json(successResponse(updated, { simulatedDate: nowISO() }));
  } catch (err: any) {
    res.status(400).json(errorResponse(err.message));
  }
}

export async function swapStandbyHandler(req: Request, res: Response) {
  try {
    const actor = (req as any).user?.name || 'System';
    const reason = req.body?.reason || 'Medical Disqualification';
    const result = await peopleService.swapStandby(req.params.id, reason, actor);
    res.json(successResponse(result, { simulatedDate: nowISO() }));
  } catch (err: any) {
    res.status(400).json(errorResponse(err.message));
  }
}
