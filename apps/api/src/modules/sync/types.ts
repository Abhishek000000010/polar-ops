export type NodeId = 'GOA_HQ' | 'BHARATI' | 'MAITRI' | 'VESSEL_VASILY_GOLOVNIN';
export type LinkState = 'ONLINE' | 'DEGRADED' | 'BLACKOUT';
export type Constellation = 'IRIDIUM_CERTUS' | 'STARLINK_POLAR' | 'INMARSAT_FLEET';

export interface SyncNode {
  id: NodeId;
  name: string;
  role: 'HUB' | 'STATION' | 'SHIP';
  location: string;
  link: LinkState;
  constellation: Constellation;
  /** Usable uplink rate in kbit/s for the current link state (0 when blacked out). */
  uplinkKbps: number;
  latencyMs: number;
  lastContactAt: string | null;
}

/**
 * Field actions a station can record while cut off. Each kind has its own merge rule:
 *  - STOCK_USED, CRATE_EVENT, INCIDENT_NOTE: commutative / append-only — always merge.
 *  - STOCK_COUNT, ASSET_UPDATE, READINESS_UPDATE: field values — 3-way merge against the value
 *    the station last saw ("base"); a field changed on both sides becomes a conflict.
 */
export type ActionKind = 'STOCK_USED' | 'STOCK_COUNT' | 'CRATE_EVENT' | 'ASSET_UPDATE' | 'READINESS_UPDATE' | 'INCIDENT_NOTE';

export interface FieldAction {
  id: string;
  nodeId: NodeId;
  kind: ActionKind;
  actor: string;
  capturedAt: string;
  target: { type: 'INVENTORY' | 'CRATE' | 'ASSET' | 'PERSON' | 'INCIDENT'; code: string; station?: string };
  /** Values as last seen by the station for every field it changes. */
  base: Record<string, any>;
  change: Record<string, any>;
  note?: string;
  /** SHA-256 (hex) of the canonical JSON of the action without this field. */
  sha256: string;
}

export type ApplyResult = 'APPLIED' | 'MERGED' | 'DUPLICATE' | 'CONFLICT' | 'REJECTED';

export interface ActionReceipt {
  actionId: string;
  nodeId: NodeId;
  kind: ActionKind;
  targetCode: string;
  result: ApplyResult;
  message: string;
  conflictIds: string[];
  capturedAt: string;
  receivedAt: string;
  actor: string;
}

export interface PushRequest {
  nodeId: NodeId;
  actions: FieldAction[];
  /** SHA-256 of the concatenated action hashes, in order. */
  batchSha256: string;
  compressedBytes?: number;
}
