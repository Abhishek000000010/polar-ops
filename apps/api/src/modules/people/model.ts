import mongoose, { Schema, Document } from 'mongoose';
import { Station } from '@polar-ops/shared';

export interface IPersonDoc extends Document {
  name: string;
  role: string;
  skills: string[];
  readiness: {
    medicalCleared: boolean;
    auliTrainingCompleted: boolean;
    passportValid: boolean;
    polarPermitIssued: boolean;
    notes?: string;
  };
  standbyPersonId?: string | null;
  currentLocation: Station;
  destinationLocation: Station;
  bloodGroup: string;
  inboundTransportId?: string;
  inboundUnloadStop?: number;
  outboundTransportId?: string;
  outboundLoadStop?: number;
  email?: string;
  phone?: string;
}

const PersonSchema = new Schema<IPersonDoc>({
  name: { type: String, required: true },
  role: { type: String, required: true },
  skills: [{ type: String }],
  readiness: {
    medicalCleared: { type: Boolean, default: false },
    auliTrainingCompleted: { type: Boolean, default: false },
    passportValid: { type: Boolean, default: false },
    polarPermitIssued: { type: Boolean, default: false },
    notes: { type: String }
  },
  standbyPersonId: { type: String, default: null },
  currentLocation: { type: String, default: 'GOA_HQ' },
  destinationLocation: { type: String, default: 'BHARATI' },
  bloodGroup: { type: String, default: 'O+' },
  inboundTransportId: { type: String },
  inboundUnloadStop: { type: Number },
  outboundTransportId: { type: String },
  outboundLoadStop: { type: Number },
  email: { type: String },
  phone: { type: String }
}, { timestamps: true });

export const PersonModel = mongoose.model<IPersonDoc>('Person', PersonSchema);
