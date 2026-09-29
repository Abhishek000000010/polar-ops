import { MissionModel, IMissionDoc } from './model';
import { Mission, MissionSchema } from '@polar-ops/shared';
import { appendEvent } from '../../core/events';
import { link, unlinkAllFromSource } from '../../core/edges';

export async function listMissions(filter: { station?: string; status?: string; expeditionId?: string } = {}): Promise<any[]> {
  const query: any = {};
  if (filter.station) query.station = filter.station;
  if (filter.status) query.status = filter.status;
  if (filter.expeditionId) query.expeditionId = filter.expeditionId;
  return MissionModel.find(query).sort({ startDate: 1 }).lean();
}

export async function getMissionById(id: string): Promise<any | null> {
  return MissionModel.findById(id).lean();
}

export async function createMission(data: Partial<Mission>, actor = 'Admin'): Promise<IMissionDoc> {
  const validated = MissionSchema.parse(data);
  const doc = await MissionModel.create(validated);
  const missionId = doc._id.toString();

  // RULE 2: Link things when you create them
  if (validated.peopleIds && validated.peopleIds.length > 0) {
    for (const personId of validated.peopleIds) {
      await link('MISSION', missionId, 'PERSON', personId, 'NEEDS_PERSON', { missionCode: doc.code });
    }
  }

  if (validated.crateIds && validated.crateIds.length > 0) {
    for (const crateId of validated.crateIds) {
      await link('MISSION', missionId, 'CRATE', crateId, 'NEEDS_CRATE', { missionCode: doc.code });
    }
  }

  if (validated.assetIds && validated.assetIds.length > 0) {
    for (const assetId of validated.assetIds) {
      await link('MISSION', missionId, 'ASSET', assetId, 'NEEDS_ASSET', { missionCode: doc.code });
    }
  }

  // RULE 1: Append event
  await appendEvent('MISSION', missionId, 'CREATED', {
    code: doc.code,
    title: doc.title,
    station: doc.station,
    peopleCount: validated.peopleIds?.length || 0,
    crateCount: validated.crateIds?.length || 0,
    assetCount: validated.assetIds?.length || 0
  }, actor);

  return doc;
}

export async function updateMission(id: string, updates: Partial<Mission>, actor = 'Admin'): Promise<IMissionDoc | null> {
  const current = await MissionModel.findById(id);
  if (!current) return null;

  const updated = await MissionModel.findByIdAndUpdate(id, updates, { new: true });
  if (!updated) return null;

  // Re-link if people, crates or assets changed
  if (updates.peopleIds !== undefined || updates.crateIds !== undefined || updates.assetIds !== undefined) {
    await unlinkAllFromSource('MISSION', id);

    const people = updates.peopleIds ?? current.peopleIds ?? [];
    for (const pId of people) {
      await link('MISSION', id, 'PERSON', pId, 'NEEDS_PERSON', { missionCode: updated.code });
    }

    const crates = updates.crateIds ?? current.crateIds ?? [];
    for (const cId of crates) {
      await link('MISSION', id, 'CRATE', cId, 'NEEDS_CRATE', { missionCode: updated.code });
    }

    const assets = updates.assetIds ?? current.assetIds ?? [];
    for (const aId of assets) {
      await link('MISSION', id, 'ASSET', aId, 'NEEDS_ASSET', { missionCode: updated.code });
    }
  }

  await appendEvent('MISSION', id, 'UPDATED', updates, actor);
  return updated;
}
