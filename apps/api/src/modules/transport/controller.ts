import { Request, Response } from 'express';
import * as transportService from './service';
import { successResponse, errorResponse } from '@polar-ops/shared';
import { nowISO } from '../../core/clock';

export async function getTransportHandler(req: Request, res: Response) {
  try {
    const list = await transportService.listTransport(req.query as any);
    res.json(successResponse(list, { total: list.length, simulatedDate: nowISO() }));
  } catch (err: any) {
    res.status(500).json(errorResponse(err.message));
  }
}

export async function getTransportByIdHandler(req: Request, res: Response) {
  try {
    const item = await transportService.getTransportById(req.params.id);
    if (!item) return res.status(404).json(errorResponse('Transport carrier not found', 'NOT_FOUND'));
    res.json(successResponse(item, { simulatedDate: nowISO() }));
  } catch (err: any) {
    res.status(500).json(errorResponse(err.message));
  }
}

export async function createTransportHandler(req: Request, res: Response) {
  try {
    const actor = (req as any).user?.name || 'Admin';
    const created = await transportService.createTransport(req.body, actor);
    res.status(201).json(successResponse(created, { simulatedDate: nowISO() }));
  } catch (err: any) {
    res.status(400).json(errorResponse(err.message, 'VALIDATION_ERROR', err.errors));
  }
}

export async function updateTransportHandler(req: Request, res: Response) {
  try {
    const actor = (req as any).user?.name || 'Admin';
    const updated = await transportService.updateTransport(req.params.id, req.body, actor);
    if (!updated) return res.status(404).json(errorResponse('Transport carrier not found', 'NOT_FOUND'));
    res.json(successResponse(updated, { simulatedDate: nowISO() }));
  } catch (err: any) {
    res.status(400).json(errorResponse(err.message));
  }
}

export async function delayTransportHandler(req: Request, res: Response) {
  try {
    const actor = (req as any).user?.name || 'Logistics Officer';
    const { fromStop, days, reason } = req.body;
    if (fromStop === undefined || days === undefined) {
      return res.status(400).json(errorResponse('fromStop and days are required'));
    }
    const updated = await transportService.delayTransport(
      req.params.id,
      Number(fromStop),
      Number(days),
      reason || 'Operational delay',
      actor
    );
    res.json(successResponse(updated, { simulatedDate: nowISO() }));
  } catch (err: any) {
    res.status(400).json(errorResponse(err.message));
  }
}
