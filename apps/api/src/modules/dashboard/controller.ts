import { Request, Response } from 'express';
import * as dashboardService from './service';
import { getRecentSystemEvents } from '../../core/events';
import { nowISO, setSimulatedTime, stepSimulatedTime, resetClock } from '../../core/clock';
import { successResponse, errorResponse } from '@polar-ops/shared';

export async function getDashboardStatsHandler(req: Request, res: Response) {
  try {
    const stats = await dashboardService.getDashboardStats();
    res.json(successResponse(stats, { simulatedDate: nowISO() }));
  } catch (err: any) {
    res.status(500).json(errorResponse(err.message));
  }
}

export async function getAlertsHandler(req: Request, res: Response) {
  try {
    const alerts = await dashboardService.getSystemAlerts();
    res.json(successResponse(alerts, { total: alerts.length, simulatedDate: nowISO() }));
  } catch (err: any) {
    res.status(500).json(errorResponse(err.message));
  }
}

export async function getEventsHandler(req: Request, res: Response) {
  try {
    const limit = Number(req.query.limit || 50);
    const events = await getRecentSystemEvents(limit);
    res.json(successResponse(events, { total: events.length, simulatedDate: nowISO() }));
  } catch (err: any) {
    res.status(500).json(errorResponse(err.message));
  }
}

export async function getRippleGraphHandler(req: Request, res: Response) {
  try {
    const { type, id } = req.params;
    const ripple = await dashboardService.getRippleGraphForEntity(type.toUpperCase(), id);
    res.json(successResponse(ripple, { simulatedDate: nowISO() }));
  } catch (err: any) {
    res.status(500).json(errorResponse(err.message));
  }
}

export async function getClockHandler(req: Request, res: Response) {
  res.json(successResponse({ simulatedDate: nowISO() }));
}

export async function setClockHandler(req: Request, res: Response) {
  try {
    const { date } = req.body;
    if (!date) return res.status(400).json(errorResponse('Date is required'));
    const updated = await setSimulatedTime(date);
    res.json(successResponse({ simulatedDate: updated.toISOString() }));
  } catch (err: any) {
    res.status(400).json(errorResponse(err.message));
  }
}

export async function stepClockHandler(req: Request, res: Response) {
  try {
    const days = Number(req.body.days || 1);
    const updated = await stepSimulatedTime(days);
    res.json(successResponse({ simulatedDate: updated.toISOString(), steppedDays: days }));
  } catch (err: any) {
    res.status(400).json(errorResponse(err.message));
  }
}

export async function resetClockHandler(req: Request, res: Response) {
  try {
    const updated = await resetClock();
    res.json(successResponse({ simulatedDate: updated.toISOString() }));
  } catch (err: any) {
    res.status(400).json(errorResponse(err.message));
  }
}

export async function getOccupancyHandler(req: Request, res: Response) {
  try {
    const station = String(req.query.station || 'BHARATI');
    const days = Number(req.query.days || 60);
    const result = await dashboardService.getStationOccupancyTimeline(station, days);
    res.json(successResponse(result, { simulatedDate: nowISO() }));
  } catch (err: any) {
    res.status(500).json(errorResponse(err.message));
  }
}

