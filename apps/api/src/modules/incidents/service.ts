import { IncidentModel, IIncidentDoc } from './model';
import { Incident, IncidentSchema } from '@polar-ops/shared';
import { appendEvent } from '../../core/events';
import { nowISO } from '../../core/clock';

export async function listIncidents(filter: { status?: string; severity?: string } = {}): Promise<any[]> {
  const query: any = {};
  if (filter.status) query.status = filter.status;
  if (filter.severity) query.severity = filter.severity;
  return IncidentModel.find(query).sort({ openedAt: -1 }).lean();
}

export async function getIncidentById(id: string): Promise<any | null> {
  return IncidentModel.findById(id).lean();
}

export async function createIncident(data: Partial<Incident>, actor = 'Station Leader'): Promise<IIncidentDoc> {
  const currentIso = nowISO();
  const payload = {
    ...data,
    openedAt: data.openedAt || currentIso,
    status: data.status || 'OPEN'
  };

  const validated = IncidentSchema.parse(payload);
  const doc = await IncidentModel.create(validated);

  await appendEvent('INCIDENT', doc._id.toString(), 'LOGGED', {
    code: doc.incidentCode,
    title: doc.title,
    severity: doc.severity,
    location: doc.location
  }, actor);

  return doc;
}

export async function addIncidentAction(id: string, actionText: string, actor = 'Station Leader'): Promise<IIncidentDoc | null> {
  const incident = await IncidentModel.findById(id);
  if (!incident) return null;

  incident.actionsTaken.push(`[${nowISO()}] (${actor}): ${actionText}`);
  await incident.save();

  await appendEvent('INCIDENT', id, 'ACTION_ADDED', { actionText }, actor);
  return incident;
}

export async function closeIncident(id: string, resolutionSummary?: string, actor = 'Station Leader'): Promise<IIncidentDoc | null> {
  const incident = await IncidentModel.findById(id);
  if (!incident) return null;

  const currentIso = nowISO();
  incident.status = 'CLOSED';
  incident.closedAt = currentIso;
  if (resolutionSummary) {
    incident.actionsTaken.push(`[${currentIso}] Resolved & Closed: ${resolutionSummary}`);
  }
  await incident.save();

  await appendEvent('INCIDENT', id, 'CLOSED', {
    incidentCode: incident.incidentCode,
    resolutionSummary
  }, actor);

  return incident;
}
