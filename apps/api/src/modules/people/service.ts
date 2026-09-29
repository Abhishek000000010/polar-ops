import { PersonModel, IPersonDoc } from './model';
import { Person, PersonSchema } from '@polar-ops/shared';
import { appendEvent } from '../../core/events';
import { link } from '../../core/edges';
import { MissionModel } from '../missions/model';

export async function listPeople(filter: { role?: string; location?: string } = {}): Promise<any[]> {
  const query: any = {};
  if (filter.role) query.role = filter.role;
  if (filter.location) query.currentLocation = filter.location;
  return PersonModel.find(query).sort({ name: 1 }).lean();
}

export async function getPersonById(id: string): Promise<any | null> {
  return PersonModel.findById(id).lean();
}

export async function createPerson(data: Partial<Person>, actor = 'Admin'): Promise<IPersonDoc> {
  const validated = PersonSchema.parse(data);
  const doc = await PersonModel.create(validated);
  const personId = doc._id.toString();

  if (doc.standbyPersonId) {
    await link('PERSON', doc.standbyPersonId, 'PERSON', personId, 'BACKUP_FOR', {
      primaryName: doc.name,
      role: doc.role
    });
  }

  await appendEvent('PERSON', personId, 'CREATED', {
    name: doc.name,
    role: doc.role,
    currentLocation: doc.currentLocation,
    readiness: doc.readiness
  }, actor);

  return doc;
}

export async function updatePerson(id: string, updates: Partial<Person>, actor = 'Admin'): Promise<IPersonDoc | null> {
  const updated = await PersonModel.findByIdAndUpdate(id, updates, { new: true });
  if (updated) {
    if (updates.standbyPersonId) {
      await link('PERSON', updates.standbyPersonId, 'PERSON', id, 'BACKUP_FOR', {
        primaryName: updated.name,
        role: updated.role
      });
    }
    await appendEvent('PERSON', id, 'UPDATED', updates, actor);
  }
  return updated;
}

export async function updateReadiness(
  id: string,
  readinessUpdates: Partial<Person['readiness']>,
  actor = 'Medical Officer'
): Promise<IPersonDoc | null> {
  const person = await PersonModel.findById(id);
  if (!person) return null;

  person.readiness = {
    ...person.readiness,
    ...readinessUpdates
  };
  await person.save();

  await appendEvent('PERSON', id, 'READINESS_UPDATED', readinessUpdates, actor);
  return person;
}

/**
 * Differentiator #6: One-Click Replacement
 * If a selected member fails medical or is unavailable, swaps in their standby
 * across all assigned missions and reallocates their itinerary.
 */
export async function swapStandby(personId: string, reason = 'Medical Disqualification', actor = 'Admin') {
  const primary = await PersonModel.findById(personId);
  if (!primary) throw new Error('Primary person not found');
  if (!primary.standbyPersonId) throw new Error(`Person ${primary.name} has no designated standby.`);

  const standby = await PersonModel.findById(primary.standbyPersonId);
  if (!standby) throw new Error('Standby person record not found');

  // Find missions where primary is assigned
  const affectedMissions = await MissionModel.find({ peopleIds: personId });
  const { link, unlink } = await import('../../core/edges');

  for (const mission of affectedMissions) {
    mission.peopleIds = mission.peopleIds.map(id => id === personId ? standby._id.toString() : id);
    await mission.save();

    await unlink('MISSION', mission._id.toString(), 'PERSON', personId);
    await link('MISSION', mission._id.toString(), 'PERSON', standby._id.toString(), 'NEEDS_PERSON', {
      role: standby.role
    });

    await appendEvent('MISSION', mission._id.toString(), 'PERSON_SWAPPED', {
      previous: primary.name,
      replacement: standby.name,
      reason
    }, actor);
  }

  // Copy inbound transport to standby and move CARRIED_BY edge
  if (primary.inboundTransportId) {
    const transportId = primary.inboundTransportId;
    const unloadStop = primary.inboundUnloadStop;

    standby.inboundTransportId = transportId;
    standby.inboundUnloadStop = unloadStop;

    await unlink('PERSON', personId, 'TRANSPORT', transportId);
    await link('PERSON', standby._id.toString(), 'TRANSPORT', transportId, 'CARRIED_BY', {
      unloadStop
    });

    primary.inboundTransportId = undefined;
    primary.inboundUnloadStop = undefined;
  }

  // Swap their destinations
  const prevDest = primary.destinationLocation;
  primary.destinationLocation = 'GOA_HQ';
  standby.destinationLocation = prevDest;

  await primary.save();
  await standby.save();

  await appendEvent('PERSON', personId, 'SWAPPED_WITH_STANDBY', {
    primaryName: primary.name,
    standbyName: standby.name,
    missionsReassignedCount: affectedMissions.length,
    reason
  }, actor);

  return {
    primary,
    standby,
    affectedMissionsCount: affectedMissions.length
  };
}
