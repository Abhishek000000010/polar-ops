import mongoose, { Schema, Document } from 'mongoose';
import { ExpeditionStatus, Station } from '@polar-ops/shared';

export interface IExpeditionDoc extends Document {
  code: string;
  name: string;
  season: string;
  stations: Station[];
  status: ExpeditionStatus;
  startDate: string;
  endDate: string;
  leaderName: string;
  description?: string;
}

const ExpeditionSchema = new Schema<IExpeditionDoc>({
  code: { type: String, required: true, unique: true, index: true },
  name: { type: String, required: true },
  season: { type: String, required: true },
  stations: [{ type: String, required: true }],
  status: { type: String, required: true, default: 'ACTIVE' },
  startDate: { type: String, required: true },
  endDate: { type: String, required: true },
  leaderName: { type: String, default: 'Dr. Arvind Nair' },
  description: { type: String }
}, { timestamps: true });

export const ExpeditionModel = mongoose.model<IExpeditionDoc>('Expedition', ExpeditionSchema);
