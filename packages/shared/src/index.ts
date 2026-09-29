import { z } from 'zod';

// ==========================================
// 1. STANDARD API RESPONSE ENVELOPE
// ==========================================
export interface ApiResponse<T = any> {
  data: T | null;
  error: {
    message: string;
    code?: string;
    details?: any;
  } | null;
  meta?: {
    total?: number;
    page?: number;
    limit?: number;
    simulatedDate?: string;
    [key: string]: any;
  };
}

export function successResponse<T>(data: T, meta?: ApiResponse['meta']): ApiResponse<T> {
  return { data, error: null, meta };
}

export function errorResponse(message: string, code = 'BAD_REQUEST', details?: any): ApiResponse<null> {
  return { data: null, error: { message, code, details } };
}

// ==========================================
// 2. ENUMS & CONSTANTS
// ==========================================
export const StationEnum = z.enum([
  'MAITRI',
  'BHARATI',
  'HIMADRI',
  'CAPE_TOWN',
  'GOA_HQ',
  'EN_ROUTE_VESSEL'
]);
export type Station = z.infer<typeof StationEnum>;

export const UserRoleEnum = z.enum([
  'ADMIN',
  'LOGISTICS_OFFICER',
  'STATION_LEADER',
  'SCIENTIST'
]);
export type UserRole = z.infer<typeof UserRoleEnum>;

export const EntityTypeEnum = z.enum([
  'EXPEDITION',
  'MISSION',
  'PERSON',
  'CARGO',
  'CRATE',
  'TRANSPORT',
  'INVENTORY',
  'ASSET',
  'INCIDENT',
  'CLOCK'
]);
export type EntityType = z.infer<typeof EntityTypeEnum>;

// ==========================================
// 3. AUTH & USER
// ==========================================
export const UserSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(2),
  email: z.string().email(),
  role: UserRoleEnum,
  station: StationEnum.optional().default('GOA_HQ'),
  createdAt: z.string().optional()
});
export type User = z.infer<typeof UserSchema>;

export const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(4)
});
export type LoginCredentials = z.infer<typeof LoginSchema>;

// ==========================================
// 4. EXPEDITIONS & MISSIONS
// ==========================================
export const ExpeditionStatusEnum = z.enum(['PLANNING', 'ACTIVE', 'WINTERING', 'CONCLUDED']);
export type ExpeditionStatus = z.infer<typeof ExpeditionStatusEnum>;

export const ExpeditionSchema = z.object({
  id: z.string().optional(),
  code: z.string().min(2), // e.g. "ISEA-47"
  name: z.string().min(2),
  season: z.string().min(4), // e.g. "2026-2027"
  stations: z.array(StationEnum),
  status: ExpeditionStatusEnum.default('ACTIVE'),
  startDate: z.string(), // ISO
  endDate: z.string(), // ISO
  leaderName: z.string().default('Dr. Arvind Nair'),
  description: z.string().optional(),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional()
});
export type Expedition = z.infer<typeof ExpeditionSchema>;

export const MissionStatusEnum = z.enum(['PLANNED', 'IN_PROGRESS', 'COMPLETED', 'BLOCKED', 'CANCELLED']);
export type MissionStatus = z.infer<typeof MissionStatusEnum>;

export const MissionSchema = z.object({
  id: z.string().optional(),
  expeditionId: z.string(),
  code: z.string().min(2), // e.g. "MSN-ICE-01"
  title: z.string().min(3),
  station: StationEnum,
  startDate: z.string(),
  endDate: z.string(),
  priority: z.number().int().min(1).max(5).default(3), // 1 (Highest) to 5 (Lowest)
  helicopterNeeded: z.boolean().default(false),
  peopleIds: z.array(z.string()).default([]),
  crateIds: z.array(z.string()).default([]),
  assetIds: z.array(z.string()).default([]),
  status: MissionStatusEnum.default('PLANNED'),
  leadScientist: z.string().default('Dr. Priya Sengupta'),
  description: z.string().optional(),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional()
});
export type Mission = z.infer<typeof MissionSchema>;

// ==========================================
// 5. PEOPLE & READINESS
// ==========================================
export const ReadinessChecklistSchema = z.object({
  medicalCleared: z.boolean().default(false),
  auliTrainingCompleted: z.boolean().default(false), // Snow & high altitude acclimatization
  passportValid: z.boolean().default(false),
  polarPermitIssued: z.boolean().default(false),
  notes: z.string().optional()
});
export type ReadinessChecklist = z.infer<typeof ReadinessChecklistSchema>;

export const PersonSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(2),
  role: z.string().min(2), // e.g., Glaciologist, Diesel Mechanic, Station Doctor
  skills: z.array(z.string()).default([]),
  readiness: ReadinessChecklistSchema.default({
    medicalCleared: false,
    auliTrainingCompleted: false,
    passportValid: false,
    polarPermitIssued: false
  }),
  standbyPersonId: z.string().nullable().optional(),
  currentLocation: StationEnum.default('GOA_HQ'),
  destinationLocation: StationEnum.default('BHARATI'),
  bloodGroup: z.string().default('O+'),
  inboundTransportId: z.string().optional(),
  inboundUnloadStop: z.number().int().optional(),
  outboundTransportId: z.string().optional(),
  outboundLoadStop: z.number().int().optional(),
  email: z.string().email().optional(),
  phone: z.string().optional(),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional()
});
export type Person = z.infer<typeof PersonSchema>;

// ==========================================
// 6. CARGO & CRATES
// ==========================================
export const CargoStatusEnum = z.enum([
  'PACKED',
  'IN_TRANSIT',
  'ARRIVED_HUB',
  'LOADED_VESSEL',
  'RECEIVED_STATION'
]);
export type CargoStatus = z.infer<typeof CargoStatusEnum>;

export const RouteLegSchema = z.object({
  stage: z.string(), // "Goa", "Mumbai", "Cape Town", "Ship (MV Vasily)", "Bharati"
  locationName: z.string(),
  status: z.enum(['PENDING', 'IN_PROGRESS', 'COMPLETED']).default('PENDING'),
  arrivalDate: z.string().optional(),
  completedDate: z.string().optional()
});
export type RouteLeg = z.infer<typeof RouteLegSchema>;

export const CargoHistoryEventSchema = z.object({
  action: z.enum(['PACKED', 'SHIPPED', 'ARRIVED', 'RECEIVED', 'INSPECTED']),
  timestamp: z.string(),
  location: z.string(),
  details: z.string().optional(),
  loggedBy: z.string().optional()
});
export type CargoHistoryEvent = z.infer<typeof CargoHistoryEventSchema>;

export const CrateSchema = z.object({
  id: z.string().optional(),
  crateCode: z.string().min(2), // e.g. "CRT-2026-042"
  title: z.string().min(2),
  weightKg: z.number().positive(),
  dimensionsCm: z.object({
    length: z.number().positive(),
    width: z.number().positive(),
    height: z.number().positive()
  }),
  hazardous: z.boolean().default(false),
  hazardClass: z.string().optional(), // e.g. "Class 3: Flammable", "Class 9: Lithium"
  destinationStation: StationEnum,
  requiredByDate: z.string(), // Critical mission deadline
  status: CargoStatusEnum.default('PACKED'),
  carrierTransportId: z.string().optional(),
  carrierLoadStop: z.number().int().optional(),
  carrierUnloadStop: z.number().int().optional(),
  handlingDays: z.number().default(1),
  loadedOnCarrier: z.boolean().default(false),
  resupplies: z.object({
    inventoryItemId: z.string(),
    quantity: z.number()
  }).optional(),
  route: z.array(RouteLegSchema).default([]),
  currentStageIndex: z.number().int().min(0).default(0),
  history: z.array(CargoHistoryEventSchema).default([]),
  linkedMissionId: z.string().optional(),
  storageConditions: z.string().optional(), // e.g. "-25C Cold Chain", "Keep Dry"
  createdAt: z.string().optional(),
  updatedAt: z.string().optional()
});
export type Crate = z.infer<typeof CrateSchema>;

// ==========================================
// 7. TRANSPORT
// ==========================================
export const TransportTypeEnum = z.enum(['SHIP', 'HELICOPTER', 'FLIGHT', 'VEHICLE']);
export type TransportType = z.infer<typeof TransportTypeEnum>;

export const TransportScheduleStopSchema = z.object({
  stopNumber: z.number().int(),
  portOrStation: z.string(),
  scheduledArrival: z.string(),
  scheduledDeparture: z.string(),
  actualArrival: z.string().optional(),
  actualDeparture: z.string().optional(),
  estimatedArrival: z.string().optional(),
  estimatedDeparture: z.string().optional(),
  status: z.enum(['SCHEDULED', 'ARRIVED', 'DEPARTED']).default('SCHEDULED')
});
export type TransportScheduleStop = z.infer<typeof TransportScheduleStopSchema>;

export const TransportSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(2), // e.g. "MV Vasily Golovnin", "Kamov Ka-32 Helo-1"
  type: TransportTypeEnum,
  capacityKg: z.number().positive(),
  passengerSeats: z.number().int().nonnegative(),
  status: z.enum(['AVAILABLE', 'EN_ROUTE', 'MAINTENANCE', 'OFFLINE']).default('AVAILABLE'),
  currentLocation: z.string().default('Cape Town Port'),
  schedule: z.array(TransportScheduleStopSchema).default([]),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional()
});
export type Transport = z.infer<typeof TransportSchema>;

// ==========================================
// 8. STATION INVENTORY
// ==========================================
export const InventoryCategoryEnum = z.enum([
  'FUEL',
  'FOOD',
  'SPARES',
  'MEDICAL',
  'SCIENTIFIC',
  'GENERAL'
]);
export type InventoryCategory = z.infer<typeof InventoryCategoryEnum>;

export const InventoryItemSchema = z.object({
  id: z.string().optional(),
  itemCode: z.string().min(2), // e.g. "FUEL-JET-A1", "MED-ATROPINE"
  name: z.string().min(2),
  category: InventoryCategoryEnum,
  station: StationEnum,
  quantity: z.number().nonnegative(),
  unit: z.string().default('units'), // e.g. "liters", "kg", "cylinders"
  minimumLevel: z.number().nonnegative(), // Critical threshold
  dailyBurnRate: z.number().nonnegative().default(0), // Average usage per day
  lastRestockedDate: z.string().optional(),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional()
});
export type InventoryItem = z.infer<typeof InventoryItemSchema>;

export const TransactionTypeEnum = z.enum(['RECEIVED', 'USED', 'TRANSFERRED']);
export type TransactionType = z.infer<typeof TransactionTypeEnum>;

export const InventoryTransactionSchema = z.object({
  id: z.string().optional(),
  itemId: z.string(),
  itemCode: z.string(),
  station: StationEnum,
  type: TransactionTypeEnum,
  quantity: z.number(),
  reason: z.string(),
  actor: z.string().default('System'),
  timestamp: z.string()
});
export type InventoryTransaction = z.infer<typeof InventoryTransactionSchema>;

// ==========================================
// 9. ASSETS & MAINTENANCE
// ==========================================
export const AssetCategoryEnum = z.enum([
  'GENERATOR',
  'VEHICLE',
  'DRILL_RIG',
  'WATER_TREATMENT',
  'COMMS',
  'LAB_EQUIPMENT'
]);
export type AssetCategory = z.infer<typeof AssetCategoryEnum>;

export const AssetStatusEnum = z.enum([
  'OPERATIONAL',
  'MAINTENANCE_DUE',
  'UNDER_REPAIR',
  'DECOMMISSIONED'
]);
export type AssetStatus = z.infer<typeof AssetStatusEnum>;

export const AssetSchema = z.object({
  id: z.string().optional(),
  assetCode: z.string().min(2), // e.g. "GEN-BHARATI-01"
  name: z.string().min(2),
  category: AssetCategoryEnum,
  location: StationEnum,
  status: AssetStatusEnum.default('OPERATIONAL'),
  lastServiceDate: z.string(),
  nextServiceDueDate: z.string(),
  runtimeHours: z.number().nonnegative().default(0),
  requiredSpareItemIds: z.array(z.string()).default([]), // IDs of inventory items required for maintenance
  criticality: z.enum(['CRITICAL', 'HIGH', 'MEDIUM', 'LOW']).default('HIGH'),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional()
});
export type Asset = z.infer<typeof AssetSchema>;

// ==========================================
// 10. INCIDENTS
// ==========================================
export const IncidentSeverityEnum = z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']);
export type IncidentSeverity = z.infer<typeof IncidentSeverityEnum>;

export const IncidentStatusEnum = z.enum(['OPEN', 'INVESTIGATING', 'RESOLVED', 'CLOSED']);
export type IncidentStatus = z.infer<typeof IncidentStatusEnum>;

export const IncidentSchema = z.object({
  id: z.string().optional(),
  incidentCode: z.string().min(2), // e.g. "INC-2026-03"
  title: z.string().min(3),
  description: z.string(),
  location: z.string(), // station or field camp coords
  severity: IncidentSeverityEnum,
  actionsTaken: z.array(z.string()).default([]),
  linkedEntities: z.array(z.object({
    type: EntityTypeEnum,
    id: z.string()
  })).default([]),
  status: IncidentStatusEnum.default('OPEN'),
  openedAt: z.string(),
  closedAt: z.string().optional(),
  reportedBy: z.string().default('Station Leader'),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional()
});
export type Incident = z.infer<typeof IncidentSchema>;

// ==========================================
// 11. AUDIT & EVENT LOG
// ==========================================
export const SystemEventSchema = z.object({
  id: z.string().optional(),
  entityType: EntityTypeEnum,
  entityId: z.string(),
  action: z.string(), // e.g., "CREATED", "UPDATED", "STATUS_CHANGED", "SWAPPED"
  payload: z.any().optional(),
  actor: z.string().default('System'),
  timestamp: z.string() // Simulated time
});
export type SystemEvent = z.infer<typeof SystemEventSchema>;

// ==========================================
// 12. DEPENDENCY EDGES (FOR RIPPLE VIEW)
// ==========================================
export const EdgeRelationEnum = z.enum([
  'NEEDS_PERSON',
  'NEEDS_CRATE',
  'NEEDS_ASSET',
  'NEEDS_SPARE',
  'CARRIED_BY',
  'ASSIGNED_TO',
  'BACKUP_FOR',
  'RESUPPLIED_BY',
  'CONSUMES'
]);
export type EdgeRelation = z.infer<typeof EdgeRelationEnum>;

export const AlertCategoryEnum = z.enum([
  'CARGO',
  'INVENTORY',
  'PERSONNEL',
  'ASSET',
  'SCHEDULE',
  'SPOF',
  'CAPACITY'
]);
export type AlertCategory = z.infer<typeof AlertCategoryEnum>;

export const EdgeSchema = z.object({
  id: z.string().optional(),
  sourceType: EntityTypeEnum,
  sourceId: z.string(),
  targetType: EntityTypeEnum,
  targetId: z.string(),
  relationType: EdgeRelationEnum,
  metadata: z.record(z.any()).optional(),
  createdAt: z.string().optional()
});
export type Edge = z.infer<typeof EdgeSchema>;

// ==========================================
// 13. SIMULATION CLOCK
// ==========================================
export const SimulationClockSchema = z.object({
  simulatedDate: z.string(), // ISO format
  isPaused: z.boolean().default(false),
  speedMultiplier: z.number().default(1)
});
export type SimulationClock = z.infer<typeof SimulationClockSchema>;
