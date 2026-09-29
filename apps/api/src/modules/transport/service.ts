import { TransportModel, ITransportDoc } from './model';
import { Transport, TransportSchema } from '@polar-ops/shared';
import { appendEvent } from '../../core/events';

export async function listTransport(filter: { type?: string; status?: string } = {}): Promise<any[]> {
  const query: any = {};
  if (filter.type) query.type = filter.type;
  if (filter.status) query.status = filter.status;
  return TransportModel.find(query).sort({ type: 1 }).lean();
}

export async function getTransportById(id: string): Promise<any | null> {
  return TransportModel.findById(id).lean();
}

export async function createTransport(data: Partial<Transport>, actor = 'Admin'): Promise<ITransportDoc> {
  const validated = TransportSchema.parse(data);
  const doc = await TransportModel.create(validated);

  await appendEvent('TRANSPORT', doc._id.toString(), 'CREATED', {
    name: doc.name,
    type: doc.type,
    capacityKg: doc.capacityKg,
    passengerSeats: doc.passengerSeats
  }, actor);

  return doc;
}

export async function updateTransport(id: string, updates: Partial<Transport>, actor = 'Admin'): Promise<ITransportDoc | null> {
  const updated = await TransportModel.findByIdAndUpdate(id, updates, { new: true });
  if (updated) {
    await appendEvent('TRANSPORT', id, 'UPDATED', updates, actor);
  }
  return updated;
}

export async function delayTransport(
  id: string,
  fromStop: number,
  days: number,
  reason: string,
  actor = 'Logistics Officer'
): Promise<ITransportDoc | null> {
  const transport = await TransportModel.findById(id);
  if (!transport) throw new Error('Transport not found');

  const shiftMs = days * 86400000;

  for (const stop of transport.schedule) {
    if (stop.stopNumber >= fromStop) {
      const baseArr = stop.estimatedArrival || stop.scheduledArrival;
      const baseDep = stop.estimatedDeparture || stop.scheduledDeparture;

      if (baseArr) {
        stop.estimatedArrival = new Date(new Date(baseArr).getTime() + shiftMs).toISOString();
      }
      if (baseDep) {
        stop.estimatedDeparture = new Date(new Date(baseDep).getTime() + shiftMs).toISOString();
      }
    }
  }

  await transport.save();

  await appendEvent('TRANSPORT', id, 'DELAYED', {
    fromStop,
    days,
    reason,
    transportName: transport.name
  }, actor);

  return transport;
}
