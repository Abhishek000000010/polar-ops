import mongoose, { Schema, Document } from 'mongoose';
import { AssetCategory, AssetStatus, Station } from '@polar-ops/shared';

export interface IAssetDoc extends Document {
  assetCode: string;
  name: string;
  category: AssetCategory;
  location: Station;
  status: AssetStatus;
  lastServiceDate: string;
  nextServiceDueDate: string;
  runtimeHours: number;
  requiredSpareItemIds: string[];
  criticality: string;
}

const AssetSchema = new Schema<IAssetDoc>({
  assetCode: { type: String, required: true, unique: true, index: true },
  name: { type: String, required: true },
  category: { type: String, required: true, enum: ['GENERATOR', 'VEHICLE', 'DRILL_RIG', 'WATER_TREATMENT', 'COMMS', 'LAB_EQUIPMENT'] },
  location: { type: String, required: true, index: true },
  status: { type: String, default: 'OPERATIONAL', index: true },
  lastServiceDate: { type: String, required: true },
  nextServiceDueDate: { type: String, required: true, index: true },
  runtimeHours: { type: Number, default: 0 },
  requiredSpareItemIds: [{ type: String }],
  criticality: { type: String, default: 'HIGH' }
}, { timestamps: true });

export const AssetModel = mongoose.model<IAssetDoc>('Asset', AssetSchema);
