import { ExpeditionModel, IExpeditionDoc } from './model';
import { Expedition, ExpeditionSchema } from '@polar-ops/shared';
import { appendEvent } from '../../core/events';

export async function listExpeditions(): Promise<any[]> {
  return ExpeditionModel.find().sort({ createdAt: -1 }).lean();
}

export async function getExpeditionById(id: string): Promise<any | null> {
  return ExpeditionModel.findById(id).lean();
}

export async function createExpedition(data: Partial<Expedition>, actor = 'Admin'): Promise<IExpeditionDoc> {
  const validated = ExpeditionSchema.parse(data);
  const doc = await ExpeditionModel.create(validated);

  await appendEvent('EXPEDITION', doc._id.toString(), 'CREATED', {
    code: doc.code,
    name: doc.name,
    season: doc.season
  }, actor);

  return doc;
}

export async function updateExpedition(id: string, updates: Partial<Expedition>, actor = 'Admin'): Promise<IExpeditionDoc | null> {
  const updated = await ExpeditionModel.findByIdAndUpdate(id, updates, { new: true });
  if (updated) {
    await appendEvent('EXPEDITION', id, 'UPDATED', updates, actor);
  }
  return updated;
}
