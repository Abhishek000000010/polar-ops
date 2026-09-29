import mongoose, { Schema, Document } from 'mongoose';
import { CargoStatus, Station, RouteLeg, CargoHistoryEvent } from '@polar-ops/shared';

export interface ICrateDoc extends Document {
  crateCode: string;
  title: string;
  weightKg: number;
  dimensionsCm: {
    length: number;
    width: number;
    height: number;
  };
  hazardous: boolean;
  hazardClass?: string;
  destinationStation: Station;
  requiredByDate: string; // ISO format
  status: CargoStatus;
  carrierTransportId?: string;
  carrierLoadStop?: number;
  carrierUnloadStop?: number;
  handlingDays: number;
  loadedOnCarrier: boolean;
  resupplies?: {
    inventoryItemId: string;
    quantity: number;
  };
  route: RouteLeg[];
  currentStageIndex: number;
  history: CargoHistoryEvent[];
  linkedMissionId?: string;
  storageConditions?: string;
}

const CrateSchema = new Schema<ICrateDoc>({
  crateCode: { type: String, required: true, unique: true, index: true },
  title: { type: String, required: true },
  weightKg: { type: Number, required: true },
  dimensionsCm: {
    length: { type: Number, required: true },
    width: { type: Number, required: true },
    height: { type: Number, required: true }
  },
  hazardous: { type: Boolean, default: false },
  hazardClass: { type: String },
  destinationStation: { type: String, required: true, index: true },
  requiredByDate: { type: String, required: true, index: true },
  status: { type: String, default: 'PACKED', index: true },
  carrierTransportId: { type: String, index: true },
  carrierLoadStop: { type: Number },
  carrierUnloadStop: { type: Number },
  handlingDays: { type: Number, default: 1 },
  loadedOnCarrier: { type: Boolean, default: false },
  resupplies: {
    inventoryItemId: { type: String },
    quantity: { type: Number }
  },
  route: [{
    stage: { type: String, required: true },
    locationName: { type: String, required: true },
    status: { type: String, default: 'PENDING' },
    arrivalDate: { type: String },
    completedDate: { type: String }
  }],
  currentStageIndex: { type: Number, default: 0 },
  history: [{
    action: { type: String, required: true },
    timestamp: { type: String, required: true },
    location: { type: String, required: true },
    details: { type: String },
    loggedBy: { type: String }
  }],
  linkedMissionId: { type: String, index: true },
  storageConditions: { type: String }
}, { timestamps: true });

export const CrateModel = mongoose.model<ICrateDoc>('Crate', CrateSchema);
