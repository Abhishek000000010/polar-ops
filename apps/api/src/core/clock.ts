import mongoose, { Schema, Document } from 'mongoose';

export interface ISimulationClock extends Document {
  simulatedDate: Date;
  isPaused: boolean;
  speedMultiplier: number;
}

const SimulationClockSchema = new Schema<ISimulationClock>({
  simulatedDate: { type: Date, required: true, default: () => new Date('2026-11-15T08:00:00.000Z') },
  isPaused: { type: Boolean, default: false },
  speedMultiplier: { type: Number, default: 1 }
}, { timestamps: true });

export const ClockModel = mongoose.model<ISimulationClock>('SimulationClock', SimulationClockSchema);

// In-memory cache for fast synchronous access
let cachedSimulatedDate: Date = new Date('2026-11-15T08:00:00.000Z');

export async function initClock(): Promise<Date> {
  try {
    let clock = await ClockModel.findOne();
    if (!clock) {
      clock = await ClockModel.create({
        simulatedDate: new Date('2026-11-15T08:00:00.000Z'),
        isPaused: false,
        speedMultiplier: 1
      });
    }
    cachedSimulatedDate = clock.simulatedDate;
    return cachedSimulatedDate;
  } catch (err) {
    console.warn('[Clock] Using fallback in-memory clock', err);
    return cachedSimulatedDate;
  }
}

/**
 * RULE 3: Never call new Date() in business logic.
 * Always call now() from clock.ts.
 */
export function now(): Date {
  return new Date(cachedSimulatedDate.getTime());
}

export function nowISO(): string {
  return now().toISOString();
}

export async function setSimulatedTime(newDateInput: string | Date): Promise<Date> {
  const d = new Date(newDateInput);
  if (isNaN(d.getTime())) {
    throw new Error('Invalid date format for simulation clock');
  }
  cachedSimulatedDate = d;
  await ClockModel.findOneAndUpdate({}, { simulatedDate: d }, { upsert: true, new: true });
  return cachedSimulatedDate;
}

export async function stepSimulatedTime(days: number): Promise<Date> {
  const current = now();
  current.setDate(current.getDate() + days);
  return setSimulatedTime(current);
}

export async function resetClock(): Promise<Date> {
  return setSimulatedTime('2026-11-15T08:00:00.000Z');
}
