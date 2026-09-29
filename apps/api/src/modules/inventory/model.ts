import mongoose, { Schema, Document } from 'mongoose';
import { InventoryCategory, Station, TransactionType } from '@polar-ops/shared';

export interface IInventoryItemDoc extends Document {
  itemCode: string;
  name: string;
  category: InventoryCategory;
  station: Station;
  quantity: number;
  unit: string;
  minimumLevel: number;
  dailyBurnRate: number;
  lastRestockedDate?: string;
}

const InventoryItemSchema = new Schema<IInventoryItemDoc>({
  itemCode: { type: String, required: true, index: true },
  name: { type: String, required: true },
  category: { type: String, required: true, enum: ['FUEL', 'FOOD', 'SPARES', 'MEDICAL', 'SCIENTIFIC', 'GENERAL'] },
  station: { type: String, required: true, index: true },
  quantity: { type: Number, required: true, default: 0 },
  unit: { type: String, default: 'units' },
  minimumLevel: { type: Number, required: true, default: 10 },
  dailyBurnRate: { type: Number, default: 0 },
  lastRestockedDate: { type: String }
}, { timestamps: true });

InventoryItemSchema.index({ itemCode: 1, station: 1 }, { unique: true });

export const InventoryItemModel = mongoose.model<IInventoryItemDoc>('InventoryItem', InventoryItemSchema);

export interface IInventoryTransactionDoc extends Document {
  itemId: string;
  itemCode: string;
  station: Station;
  type: TransactionType;
  quantity: number;
  reason: string;
  actor: string;
  timestamp: string;
}

const InventoryTransactionSchema = new Schema<IInventoryTransactionDoc>({
  itemId: { type: String, required: true, index: true },
  itemCode: { type: String, required: true, index: true },
  station: { type: String, required: true, index: true },
  type: { type: String, required: true, enum: ['RECEIVED', 'USED', 'TRANSFERRED'] },
  quantity: { type: Number, required: true },
  reason: { type: String, required: true },
  actor: { type: String, default: 'System' },
  timestamp: { type: String, required: true }
}, { timestamps: true });

export const InventoryTransactionModel = mongoose.model<IInventoryTransactionDoc>('InventoryTransaction', InventoryTransactionSchema);
