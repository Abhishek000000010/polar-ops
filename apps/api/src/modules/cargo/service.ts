import { CrateModel, ICrateDoc } from './model';
import { Crate, CrateSchema } from '@polar-ops/shared';
import { appendEvent } from '../../core/events';
import { link } from '../../core/edges';
import { nowISO } from '../../core/clock';

export async function listCrates(filter: { destination?: string; status?: string; hazardous?: boolean } = {}): Promise<any[]> {
  const query: any = {};
  if (filter.destination) query.destinationStation = filter.destination;
  if (filter.status) query.status = filter.status;
  if (filter.hazardous !== undefined) query.hazardous = filter.hazardous;
  const crates = await CrateModel.find(query).sort({ requiredByDate: 1 }).lean();

  const { TransportModel } = await import('../transport/model');
  const { crateEta } = await import('../../rules');
  const { now } = await import('../../core/clock');

  const transports = await TransportModel.find().lean();
  const transportsById = transports.reduce<Record<string, any>>((acc, t) => {
    acc[t._id.toString()] = t;
    return acc;
  }, {});
  const currentDate = now();

  return crates.map(c => {
    const etaInfo = crateEta(c as any, transportsById, currentDate);
    return {
      ...c,
      eta: etaInfo.etaDate,
      missedConnection: etaInfo.missedConnection,
      effectiveArrivalDate: etaInfo.effectiveArrivalDate
    };
  });
}

export async function getCrateById(id: string): Promise<any | null> {
  return CrateModel.findById(id).lean();
}

export async function createCrate(data: Partial<Crate>, actor = 'Logistics Officer'): Promise<ICrateDoc> {
  const currentIso = nowISO();

  // If route is not provided, populate standard polar route
  const defaultRoute = [
    { stage: 'Goa Hub', locationName: 'NCPOR Goa Packing Facility', status: 'COMPLETED' as const, completedDate: currentIso },
    { stage: 'Mumbai Port', locationName: 'Mumbai JNPT Maritime Terminal', status: 'PENDING' as const },
    { stage: 'Cape Town Gateway', locationName: 'Cape Town Antarctic Consolidation Hub', status: 'PENDING' as const },
    { stage: 'Polar Vessel', locationName: 'MV Vasily Golovnin', status: 'PENDING' as const },
    { stage: 'Station Arrival', locationName: data.destinationStation || 'BHARATI', status: 'PENDING' as const }
  ];

  const defaultHistory = [
    { action: 'PACKED' as const, timestamp: currentIso, location: 'NCPOR Goa', details: 'Consolidated and sealed with polar weatherproofing', loggedBy: actor }
  ];

  const payload = {
    ...data,
    route: data.route && data.route.length > 0 ? data.route : defaultRoute,
    history: data.history && data.history.length > 0 ? data.history : defaultHistory,
    currentStageIndex: 0,
    status: data.status || 'PACKED'
  };

  const validated = CrateSchema.parse(payload);
  const doc = await CrateModel.create(validated);
  const crateId = doc._id.toString();

  if (doc.linkedMissionId) {
    await link('MISSION', doc.linkedMissionId, 'CRATE', crateId, 'NEEDS_CRATE', {
      crateCode: doc.crateCode,
      requiredBy: doc.requiredByDate
    });
  }

  await appendEvent('CARGO', crateId, 'CREATED', {
    code: doc.crateCode,
    title: doc.title,
    weightKg: doc.weightKg,
    hazardous: doc.hazardous,
    destination: doc.destinationStation
  }, actor);

  return doc;
}

export async function advanceCrateStage(id: string, actor = 'Logistics Officer'): Promise<ICrateDoc | null> {
  const crate = await CrateModel.findById(id);
  if (!crate) return null;

  const currentIdx = crate.currentStageIndex;
  const currentIso = nowISO();

  if (currentIdx < crate.route.length - 1) {
    crate.route[currentIdx].status = 'COMPLETED';
    crate.route[currentIdx].completedDate = currentIso;

    crate.currentStageIndex = currentIdx + 1;
    crate.route[crate.currentStageIndex].status = 'IN_PROGRESS';
    crate.route[crate.currentStageIndex].arrivalDate = currentIso;

    const nextLeg = crate.route[crate.currentStageIndex];
    let newStatus: any = 'IN_TRANSIT';

    if (nextLeg.stage.includes('Cape Town')) {
      newStatus = 'ARRIVED_HUB';
    } else if (nextLeg.stage.includes('Vessel') || nextLeg.stage.includes('Ship')) {
      newStatus = 'LOADED_VESSEL';
    } else if (crate.currentStageIndex === crate.route.length - 1) {
      newStatus = 'RECEIVED_STATION';
      nextLeg.status = 'COMPLETED';
    }

    crate.status = newStatus;

    crate.history.push({
      action: newStatus === 'RECEIVED_STATION' ? 'RECEIVED' : (newStatus === 'LOADED_VESSEL' ? 'SHIPPED' : 'ARRIVED'),
      timestamp: currentIso,
      location: nextLeg.locationName,
      details: `Advanced to ${nextLeg.stage}`,
      loggedBy: actor
    });

    await crate.save();

    await appendEvent('CARGO', id, 'STAGE_ADVANCED', {
      crateCode: crate.crateCode,
      newStage: nextLeg.stage,
      status: crate.status
    }, actor);
  }

  return crate;
}

export async function updateCrate(id: string, updates: Partial<Crate>, actor = 'Logistics Officer'): Promise<ICrateDoc | null> {
  const existing = await CrateModel.findById(id);
  if (!existing) return null;

  const oldCarrier = existing.carrierTransportId;
  const updated = await CrateModel.findByIdAndUpdate(id, updates, { new: true });
  if (updated) {
    const { unlink } = await import('../../core/edges');

    if (updates.linkedMissionId) {
      await link('MISSION', updates.linkedMissionId, 'CRATE', id, 'NEEDS_CRATE', {
        crateCode: updated.crateCode,
        requiredBy: updated.requiredByDate
      });
    }

    if (updates.carrierTransportId) {
      if (oldCarrier && oldCarrier !== updates.carrierTransportId) {
        await unlink('CRATE', id, 'TRANSPORT', oldCarrier);
      }
      await link('CRATE', id, 'TRANSPORT', updates.carrierTransportId, 'CARRIED_BY', {
        loadStop: updated.carrierLoadStop,
        unloadStop: updated.carrierUnloadStop
      });
    }

    await appendEvent('CARGO', id, 'UPDATED', updates, actor);
  }
  return updated;
}
