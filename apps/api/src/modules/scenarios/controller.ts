import { Request, Response } from 'express';
import { simulateScenario, getScenarioPresets } from './service';
import { successResponse, errorResponse } from '@polar-ops/shared';

export async function simulateHandler(req: Request, res: Response) {
  try {
    const input = req.body || {};
    const result = await simulateScenario(input);
    res.json(successResponse(result));
  } catch (err: any) {
    console.error('What-If Scenario Simulation Error:', err);
    res.status(500).json(errorResponse(err.message || 'Simulation execution failed', 'SIMULATION_ERROR'));
  }
}

export async function presetsHandler(req: Request, res: Response) {
  try {
    const presets = getScenarioPresets();
    res.json(successResponse(presets));
  } catch (err: any) {
    res.status(500).json(errorResponse(err.message || 'Failed to retrieve presets', 'PRESET_ERROR'));
  }
}
