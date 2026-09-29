import { AssetModel, IAssetDoc } from './model';
import { Asset, AssetSchema } from '@polar-ops/shared';
import { appendEvent } from '../../core/events';
import { link, unlinkAllFromSource } from '../../core/edges';
import { now, nowISO } from '../../core/clock';
import { assetEffectiveStatus } from '../../rules';

export async function listAssets(filter: { location?: string; status?: string; category?: string } = {}): Promise<any[]> {
  const query: any = {};
  if (filter.location) query.location = filter.location;
  if (filter.status) query.status = filter.status;
  if (filter.category) query.category = filter.category;
  const items = await AssetModel.find(query).sort({ criticality: 1, name: 1 }).lean();
  const currentDate = now();
  return items.map(item => ({
    ...item,
    effectiveStatus: assetEffectiveStatus(item as any, currentDate)
  }));
}

export async function getAssetById(id: string): Promise<any | null> {
  const item = await AssetModel.findById(id).lean();
  if (!item) return null;
  return {
    ...item,
    effectiveStatus: assetEffectiveStatus(item as any, now())
  };
}

export async function createAsset(data: Partial<Asset>, actor = 'Station Engineer'): Promise<IAssetDoc> {
  const validated = AssetSchema.parse(data);
  const doc = await AssetModel.create(validated);
  const assetId = doc._id.toString();

  // RULE 2: Link required spares to inventory
  if (validated.requiredSpareItemIds && validated.requiredSpareItemIds.length > 0) {
    for (const spareId of validated.requiredSpareItemIds) {
      await link('ASSET', assetId, 'INVENTORY', spareId, 'NEEDS_SPARE', {
        assetCode: doc.assetCode
      });
    }
  }

  await appendEvent('ASSET', assetId, 'CREATED', {
    code: doc.assetCode,
    name: doc.name,
    location: doc.location,
    status: doc.status
  }, actor);

  return doc;
}

export async function updateAsset(id: string, updates: Partial<Asset>, actor = 'Station Engineer'): Promise<IAssetDoc | null> {
  const current = await AssetModel.findById(id);
  if (!current) return null;

  const updated = await AssetModel.findByIdAndUpdate(id, updates, { new: true });
  if (!updated) return null;

  if (updates.requiredSpareItemIds) {
    await unlinkAllFromSource('ASSET', id);
    for (const spareId of updates.requiredSpareItemIds) {
      await link('ASSET', id, 'INVENTORY', spareId, 'NEEDS_SPARE', {
        assetCode: updated.assetCode
      });
    }
  }

  await appendEvent('ASSET', id, 'UPDATED', updates, actor);
  return updated;
}

export async function performMaintenance(
  id: string,
  serviceNotes: string,
  nextDueDate: string,
  hoursAdded = 0,
  actor = 'Station Engineer'
): Promise<IAssetDoc | null> {
  const asset = await AssetModel.findById(id);
  if (!asset) return null;

  const currentIso = nowISO();
  asset.lastServiceDate = currentIso;
  asset.nextServiceDueDate = nextDueDate;
  asset.runtimeHours += hoursAdded;
  asset.status = 'OPERATIONAL';

  await asset.save();

  await appendEvent('ASSET', id, 'MAINTENANCE_PERFORMED', {
    assetCode: asset.assetCode,
    serviceDate: currentIso,
    nextDueDate,
    notes: serviceNotes
  }, actor);

  return asset;
}
