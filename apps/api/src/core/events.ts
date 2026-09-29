import mongoose, { Schema, Document, ClientSession } from 'mongoose';
import { EntityType } from '@polar-ops/shared';
import { now } from './clock';

export interface ISystemEvent extends Document {
  entityType: EntityType;
  entityId: string;
  action: string;
  payload: any;
  actor: string;
  timestamp: Date;
}

const SystemEventSchema = new Schema<ISystemEvent>({
  entityType: { type: String, required: true, index: true },
  entityId: { type: String, required: true, index: true },
  action: { type: String, required: true },
  payload: { type: Schema.Types.Mixed },
  actor: { type: String, default: 'System' },
  timestamp: { type: Date, required: true, index: true }
}, { timestamps: true });

export const EventModel = mongoose.model<ISystemEvent>('SystemEvent', SystemEventSchema);

/**
 * RULE 1: Every write goes through a service.
 * The service saves the change AND calls appendEvent().
 */
export async function appendEvent(
  entityType: EntityType,
  entityId: string,
  action: string,
  payload: any = {},
  actor = 'System',
  session?: ClientSession
): Promise<ISystemEvent> {
  const eventData = {
    entityType,
    entityId,
    action,
    payload,
    actor,
    timestamp: now()
  };

  const [event] = await EventModel.create([eventData], { session });
  return event;
}

export async function getEventsForEntity(entityType: EntityType, entityId: string) {
  return EventModel.find({ entityType, entityId }).sort({ timestamp: -1 }).limit(100).lean();
}

export async function getRecentSystemEvents(limit = 50) {
  return EventModel.find().sort({ timestamp: -1 }).limit(limit).lean();
}
