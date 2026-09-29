import mongoose, { Schema, Document } from 'mongoose';
import { TransportType, TransportScheduleStop } from '@polar-ops/shared';

export interface ITransportDoc extends Document {
  name: string;
  type: TransportType;
  capacityKg: number;
  passengerSeats: number;
  status: string;
  currentLocation: string;
  schedule: TransportScheduleStop[];
}

const TransportSchema = new Schema<ITransportDoc>({
  name: { type: String, required: true },
  type: { type: String, required: true, enum: ['SHIP', 'HELICOPTER', 'FLIGHT', 'VEHICLE'] },
  capacityKg: { type: Number, required: true },
  passengerSeats: { type: Number, required: true, default: 0 },
  status: { type: String, default: 'AVAILABLE' },
  currentLocation: { type: String, default: 'Cape Town Port' },
  schedule: [{
    stopNumber: { type: Number, required: true },
    portOrStation: { type: String, required: true },
    scheduledArrival: { type: String, required: true },
    scheduledDeparture: { type: String, required: true },
    actualArrival: { type: String },
    actualDeparture: { type: String },
    estimatedArrival: { type: String },
    estimatedDeparture: { type: String },
    status: { type: String, default: 'SCHEDULED' }
  }]
}, { timestamps: true });

export const TransportModel = mongoose.model<ITransportDoc>('Transport', TransportSchema);
