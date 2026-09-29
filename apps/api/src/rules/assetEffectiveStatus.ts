import { Asset, AssetStatus } from '@polar-ops/shared';

export function assetEffectiveStatus(
  asset: Partial<Asset>,
  now: Date = new Date('2026-11-15T08:00:00.000Z')
): AssetStatus {
  if (asset.status === 'UNDER_REPAIR' || asset.status === 'DECOMMISSIONED') {
    return asset.status;
  }

  if (asset.nextServiceDueDate) {
    const dueDate = new Date(asset.nextServiceDueDate);
    if (dueDate.getTime() <= now.getTime()) {
      return 'MAINTENANCE_DUE';
    }
  }

  return 'OPERATIONAL';
}
