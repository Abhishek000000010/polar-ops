import { Request, Response } from 'express';
import * as inventoryService from './service';
import { successResponse, errorResponse } from '@polar-ops/shared';
import { nowISO } from '../../core/clock';

export async function getInventoryHandler(req: Request, res: Response) {
  try {
    const list = await inventoryService.listInventory(req.query as any);
    res.json(successResponse(list, { total: list.length, simulatedDate: nowISO() }));
  } catch (err: any) {
    res.status(500).json(errorResponse(err.message));
  }
}

export async function getInventoryByIdHandler(req: Request, res: Response) {
  try {
    const item = await inventoryService.getInventoryById(req.params.id);
    if (!item) return res.status(404).json(errorResponse('Item not found', 'NOT_FOUND'));
    res.json(successResponse(item, { simulatedDate: nowISO() }));
  } catch (err: any) {
    res.status(500).json(errorResponse(err.message));
  }
}

export async function createInventoryItemHandler(req: Request, res: Response) {
  try {
    const actor = (req as any).user?.name || 'Station Leader';
    const created = await inventoryService.createInventoryItem(req.body, actor);
    res.status(201).json(successResponse(created, { simulatedDate: nowISO() }));
  } catch (err: any) {
    res.status(400).json(errorResponse(err.message, 'VALIDATION_ERROR', err.errors));
  }
}

export async function recordTransactionHandler(req: Request, res: Response) {
  try {
    const actor = (req as any).user?.name || 'Logistics Officer';
    const { type, quantity, reason, targetStation } = req.body;
    const result = await inventoryService.recordTransaction(
      req.params.id,
      type,
      Number(quantity),
      reason,
      targetStation,
      actor
    );
    res.json(successResponse(result, { simulatedDate: nowISO() }));
  } catch (err: any) {
    res.status(400).json(errorResponse(err.message));
  }
}

export async function getTransactionsHandler(req: Request, res: Response) {
  try {
    const { itemId, station } = req.query as any;
    const list = await inventoryService.listTransactions(itemId, station);
    res.json(successResponse(list, { total: list.length, simulatedDate: nowISO() }));
  } catch (err: any) {
    res.status(500).json(errorResponse(err.message));
  }
}

export async function getInventoryForecastHandler(req: Request, res: Response) {
  try {
    const burnMultiplier = req.query.burnMultiplier ? Number(req.query.burnMultiplier) : 1;
    const forecast = await inventoryService.getInventoryForecast(burnMultiplier);
    res.json(successResponse(forecast, { total: forecast.length, simulatedDate: nowISO() }));
  } catch (err: any) {
    res.status(500).json(errorResponse(err.message));
  }
}
