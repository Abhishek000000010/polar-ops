import mongoose, { Schema, Document } from 'mongoose';
import { IncidentSeverity, IncidentStatus } from '@polar-ops/shared';

export interface IIncidentDoc extends Document {
  incidentCode: string;
  title: string;
  description: string;
  location: string;
  severity: IncidentSeverity;
  actionsTaken: string[];
  linkedEntities: { type: string; id: string }[];
  status: IncidentStatus;
  openedAt: string;
  closedAt?: string;
  reportedBy: string;
}

const IncidentSchema = new Schema<IIncidentDoc>({
  incidentCode: { type: String, required: true, unique: true, index: true },
  title: { type: String, required: true },
  description: { type: String, required: true },
  location: { type: String, required: true },
  severity: { type: String, required: true, enum: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] },
  actionsTaken: [{ type: String }],
  linkedEntities: [{
    type: { type: String, required: true },
    id: { type: String, required: true }
  }],
  status: { type: String, default: 'OPEN', enum: ['OPEN', 'INVESTIGATING', 'RESOLVED', 'CLOSED'] },
  openedAt: { type: String, required: true },
  closedAt: { type: String },
  reportedBy: { type: String, default: 'Station Leader' }
}, { timestamps: true });

export const IncidentModel = mongoose.model<IIncidentDoc>('Incident', IncidentSchema);
