import mongoose, { Schema } from 'mongoose';

// One receipt per field action ever received: makes re-sent batches harmless (idempotency).
const SyncReceiptSchema = new Schema({
  actionId: { type: String, required: true, unique: true, index: true },
  nodeId: { type: String, required: true, index: true },
  kind: { type: String, required: true },
  targetCode: { type: String, required: true },
  result: { type: String, required: true },
  message: { type: String, default: '' },
  conflictIds: { type: [String], default: [] },
  capturedAt: { type: String, required: true },
  receivedAt: { type: String, required: true, index: true },
  actor: { type: String, default: 'Field operator' },
  bytes: { type: Number, default: 0 },
  duplicateHits: { type: Number, default: 0 }
});

export const SyncReceiptModel = mongoose.model('SyncReceipt', SyncReceiptSchema);

const SyncConflictSchema = new Schema({
  conflictId: { type: String, required: true, unique: true, index: true },
  actionId: { type: String, required: true },
  nodeId: { type: String, required: true },
  actor: { type: String, default: '' },
  targetType: { type: String, required: true },
  targetCode: { type: String, required: true },
  targetId: { type: String, required: true },
  field: { type: String, required: true },
  base: { type: Schema.Types.Mixed },
  local: { type: Schema.Types.Mixed },
  remote: { type: Schema.Types.Mixed },
  capturedAt: { type: String, required: true },
  createdAt: { type: String, required: true },
  status: { type: String, default: 'OPEN', index: true },
  resolution: { type: String },
  resolvedAt: { type: String },
  resolvedBy: { type: String }
});

export const SyncConflictModel = mongoose.model('SyncConflict', SyncConflictSchema);
