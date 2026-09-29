import mongoose, { Schema, Document } from 'mongoose';
import { MissionStatus, Station } from '@polar-ops/shared';

export interface IMissionDoc extends Document {
  expeditionId: string;
  code: string;
  title: string;
  station: Station;
  startDate: string;
  endDate: string;
  priority: number;
  helicopterNeeded: boolean;
  peopleIds: string[];
  crateIds: string[];
  assetIds: string[];
  status: MissionStatus;
  leadScientist: string;
  description?: string;
}

const MissionSchema = new Schema<IMissionDoc>({
  expeditionId: { type: String, required: true, index: true },
  code: { type: String, required: true, unique: true, index: true },
  title: { type: String, required: true },
  station: { type: String, required: true },
  startDate: { type: String, required: true },
  endDate: { type: String, required: true },
  priority: { type: Number, min: 1, max: 5, default: 3 },
  helicopterNeeded: { type: Boolean, default: false },
  peopleIds: [{ type: String }],
  crateIds: [{ type: String }],
  assetIds: [{ type: String }],
  status: { type: String, default: 'PLANNED' },
  leadScientist: { type: String, default: 'Dr. Priya Sengupta' },
  description: { type: String }
}, { timestamps: true });

export const MissionModel = mongoose.model<IMissionDoc>('Mission', MissionSchema);
