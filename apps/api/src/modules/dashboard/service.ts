import { ExpeditionModel } from '../expeditions/model';
import { MissionModel } from '../missions/model';
import { PersonModel } from '../people/model';
import { CrateModel } from '../cargo/model';
import { TransportModel } from '../transport/model';
import { InventoryItemModel, InventoryTransactionModel } from '../inventory/model';
import { AssetModel } from '../assets/model';
import { IncidentModel } from '../incidents/model';
import { EventModel } from '../../core/events';
import { computeRippleEffect, getAllEdges } from '../../core/edges';
import { now, nowISO } from '../../core/clock';
import {
  crateEta,
  forecastInventory,
  assetEffectiveStatus,
  stationOccupancy,
  IncomingResupply,
  BurnProfile,
  STATION_BED_CAPACITIES
} from '../../rules';
import { EdgeModel } from '../../core/edges';
import { AlertCategory } from '@polar-ops/shared';

export interface IDashboardStats {
  expeditionsCount: number;
  activeMissionsCount: number;
  personnelDeployed: number;
  personnelReadinessPending: number;
  cratesInTransit: number;
  cratesCritical: number;
  assetsOperational: number;
  assetsMaintenanceDue: number;
  inventoryAlertsCount: number;
  openIncidentsCount: number;
}

export interface IAlertItem {
  id: string;
  category: AlertCategory;
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM';
  title: string;
  description: string;
  affectedEntityId: string;
  affectedEntityType: string;
  suggestedAction: string;
}

export async function getDashboardStats(): Promise<IDashboardStats> {
  const currentDate = now();

  const [
    expeditionsCount,
    missions,
    people,
    crates,
    assets,
    transports,
    inventory,
    openIncidentsCount,
    alerts
  ] = await Promise.all([
    ExpeditionModel.countDocuments({ status: 'ACTIVE' }),
    MissionModel.find().lean(),
    PersonModel.find().lean(),
    CrateModel.find().lean(),
    AssetModel.find().lean(),
    TransportModel.find().lean(),
    InventoryItemModel.find().lean(),
    IncidentModel.countDocuments({ status: { $in: ['OPEN', 'INVESTIGATING'] } }),
    getSystemAlerts()
  ]);

  const transportsById = transports.reduce<Record<string, any>>((acc, t) => {
    acc[t._id.toString()] = t;
    return acc;
  }, {});

  const activeMissionsCount = missions.filter(m => m.status === 'IN_PROGRESS' || m.status === 'PLANNED').length;
  const personnelDeployed = people.filter(p => p.currentLocation !== 'GOA_HQ').length;
  const personnelReadinessPending = people.filter(p =>
    !p.readiness?.medicalCleared ||
    !p.readiness?.auliTrainingCompleted ||
    !p.readiness?.passportValid ||
    !p.readiness?.polarPermitIssued
  ).length;

  const cratesInTransit = crates.filter(c => c.status === 'IN_TRANSIT' || c.status === 'ARRIVED_HUB' || c.status === 'LOADED_VESSEL').length;

  // Use crateEta rule for critical crates
  const cratesCritical = crates.filter(c => {
    if (c.status === 'RECEIVED_STATION') return false;
    const etaInfo = crateEta(c as any, transportsById, currentDate);
    if (etaInfo.missedConnection) return true;
    if (etaInfo.etaDate && new Date(etaInfo.etaDate) > new Date(c.requiredByDate)) return true;
    return false;
  }).length;

  // Use assetEffectiveStatus rule
  const assetsOperational = assets.filter(a => assetEffectiveStatus(a as any, currentDate) === 'OPERATIONAL').length;
  const assetsMaintenanceDue = assets.filter(a => assetEffectiveStatus(a as any, currentDate) === 'MAINTENANCE_DUE').length;

  // Count inventory alerts from the rule-based alert set
  const inventoryAlertsCount = alerts.filter(a => a.category === 'INVENTORY').length;

  return {
    expeditionsCount,
    activeMissionsCount,
    personnelDeployed,
    personnelReadinessPending,
    cratesInTransit,
    cratesCritical,
    assetsOperational,
    assetsMaintenanceDue,
    inventoryAlertsCount,
    openIncidentsCount
  };
}

export interface IWorldSnapshot {
  crates: any[];
  transports: any[];
  inventory: any[];
  transactions: any[];
  missions: any[];
  people: any[];
  assets: any[];
  edges: any[];
}

export async function fetchWorldSnapshot(): Promise<IWorldSnapshot> {
  const [
    crates,
    transports,
    inventory,
    transactions,
    missions,
    people,
    assets,
    edges
  ] = await Promise.all([
    CrateModel.find().lean(),
    TransportModel.find().lean(),
    InventoryItemModel.find().lean(),
    InventoryTransactionModel.find().lean(),
    MissionModel.find().lean(),
    PersonModel.find().lean(),
    AssetModel.find().lean(),
    EdgeModel.find().lean()
  ]);

  return {
    crates,
    transports,
    inventory,
    transactions,
    missions,
    people,
    assets,
    edges
  };
}

/** Fuel burn profile per station; a plain number applies to every station. */
export type FuelBurnByStation = BurnProfile | Record<string, BurnProfile>;

export function fuelProfileFor(fuelBurn: FuelBurnByStation, station: string): BurnProfile {
  if (typeof fuelBurn === 'number' || Array.isArray(fuelBurn)) return fuelBurn;
  return fuelBurn[station] ?? 1;
}

export function evaluateAlertsOverWorld(
  world: IWorldSnapshot,
  currentDate: Date = now(),
  fuelBurn: FuelBurnByStation = 1
): IAlertItem[] {
  const alerts: IAlertItem[] = [];
  const { crates, transports, inventory, transactions, missions, people, assets } = world;

  const transportsById = transports.reduce<Record<string, any>>((acc, t) => {
    acc[t._id.toString()] = t;
    return acc;
  }, {});

  const missionsById = missions.reduce<Record<string, any>>((acc, m) => {
    acc[m._id.toString()] = m;
    return acc;
  }, {});

  // Pre-calculate crate ETAs
  const crateEtaMap = new Map<string, ReturnType<typeof crateEta>>();
  for (const c of crates) {
    const res = crateEta(c as any, transportsById, currentDate);
    crateEtaMap.set(c._id.toString(), res);
  }

  // Incoming resupplies for inventory forecasting
  const incomingResupplies: IncomingResupply[] = [];
  for (const c of crates) {
    if (c.resupplies && c.resupplies.inventoryItemId) {
      const etaInfo = crateEtaMap.get(c._id.toString());
      incomingResupplies.push({
        crateCode: c.crateCode,
        inventoryItemId: c.resupplies.inventoryItemId,
        quantity: c.resupplies.quantity,
        etaDate: etaInfo?.etaDate || null
      });
    }
  }

  // ==========================================
  // 1. CARGO ALERTS (missedConnection, late, tight buffer)
  // ==========================================
  for (const crate of crates) {
    if (crate.status === 'RECEIVED_STATION') continue;

    const etaInfo = crateEtaMap.get(crate._id.toString());
    if (!etaInfo) continue;

    // Rule: missedConnection -> CRITICAL
    if (etaInfo.missedConnection) {
      alerts.push({
        id: `alert-cargo-missed-${crate.crateCode}`,
        category: 'CARGO',
        severity: 'CRITICAL',
        title: `Missed Connection: ${crate.crateCode} (${crate.title})`,
        description: `Carrier departed without loading ${crate.crateCode}. Connection missed; delivery cannot proceed on schedule.`,
        affectedEntityId: crate._id.toString(),
        affectedEntityType: 'CRATE',
        suggestedAction: 'Reassign crate to upcoming air corridor (e.g. DROMLAN Flight B) or reschedule linked scientific mission.'
      });
      continue; // Once missed connection is raised, don't double-flag tight buffer
    }

    // Resupply crates are judged by the inventory forecast margin, not by their own deadline.
    if (etaInfo.etaDate && !crate.resupplies?.inventoryItemId) {
      const etaTime = new Date(etaInfo.etaDate).getTime();
      const reqTime = new Date(crate.requiredByDate).getTime();
      const bufferDays = (reqTime - etaTime) / 86400000;

      // Rule: ETA > requiredByDate -> CRITICAL if linked mission priority 1, else HIGH
      if (etaTime > reqTime) {
        const linkedMission = crate.linkedMissionId ? missionsById[crate.linkedMissionId] : null;
        const isPriority1 = linkedMission?.priority === 1;

        alerts.push({
          id: `alert-cargo-late-${crate.crateCode}`,
          category: 'CARGO',
          severity: isPriority1 ? 'CRITICAL' : 'HIGH',
          title: `Delivery Delay Exceeds Deadline: ${crate.crateCode}`,
          description: `Projected arrival (${etaInfo.etaDate.split('T')[0]}) is late by ${Math.ceil((etaTime - reqTime) / 86400000)} day(s) against required date (${crate.requiredByDate.split('T')[0]}).`,
          affectedEntityId: crate._id.toString(),
          affectedEntityType: 'CRATE',
          suggestedAction: 'Expedite handling or reassign priority carrier to prevent mission halt.'
        });
      }
      // Rule: 0 <= buffer < 3 days -> MEDIUM ("tight buffer")
      else if (bufferDays >= 0 && bufferDays < 3) {
        alerts.push({
          id: `alert-cargo-tight-${crate.crateCode}`,
          category: 'CARGO',
          severity: 'MEDIUM',
          title: `Tight Delivery Buffer: ${crate.crateCode} (${Math.round(bufferDays * 10) / 10}d margin)`,
          description: `Crate arrives on ${etaInfo.etaDate.split('T')[0]}, providing only a ${Math.round(bufferDays)} day buffer before the mission deadline on ${crate.requiredByDate.split('T')[0]}.`,
          affectedEntityId: crate._id.toString(),
          affectedEntityType: 'CRATE',
          suggestedAction: 'Monitor transport progress closely; any further delay will breach the operational deadline.'
        });
      }
    }
  }

  // ==========================================
  // 2. SPOF ALERTS (Spare quantity < critical assets needing it)
  // ==========================================
  const raisedAsSpofSet = new Set<string>();

  for (const item of inventory) {
    // Find critical assets that need this spare item
    const criticalAssetsNeedingSpare = assets.filter(a =>
      a.criticality === 'CRITICAL' &&
      (a.requiredSpareItemIds?.includes(item._id.toString()) || a.requiredSpareItemIds?.includes(item.itemCode))
    );

    if (criticalAssetsNeedingSpare.length > 0 && item.quantity < criticalAssetsNeedingSpare.length) {
      // Find incoming resupply crate
      const resupply = incomingResupplies.find(r => r.inventoryItemId === item._id.toString() || r.inventoryItemId === item.itemCode);
      const incomingEtaStr = resupply?.etaDate ? `arriving via ${resupply.crateCode} on ${resupply.etaDate.split('T')[0]}` : 'no resupply scheduled';

      alerts.push({
        id: `alert-spof-${item.itemCode}`,
        category: 'SPOF',
        severity: 'HIGH',
        title: `Single Point of Failure: ${item.name}`,
        description: `Only ${item.quantity} spare(s) available for ${criticalAssetsNeedingSpare.length} critical generators/assets (${criticalAssetsNeedingSpare.map(a => a.assetCode).join(', ')}). ${resupply ? `${resupply.quantity} units ${incomingEtaStr}` : incomingEtaStr}.`,
        affectedEntityId: item._id.toString(),
        affectedEntityType: 'INVENTORY',
        suggestedAction: 'Prioritize offloading and delivery of replacement pump consignment on incoming vessel.'
      });

      raisedAsSpofSet.add(item._id.toString());
      raisedAsSpofSet.add(item.itemCode);
    }
  }

  // ==========================================
  // 3. INVENTORY ALERTS (Forecast marginDays, quantity <= minimumLevel)
  // ==========================================
  for (const item of inventory) {
    const itemProfile = item.category === 'FUEL' ? fuelProfileFor(fuelBurn, item.station) : 1;
    const forecast = forecastInventory(item as any, transactions as any, incomingResupplies, currentDate, itemProfile);

    // Rule: marginDays < 0 (breach before resupply) -> CRITICAL if FUEL, else HIGH
    if (forecast.marginDays !== null && forecast.marginDays < 0) {
      alerts.push({
        id: `alert-inv-margin-${item.itemCode}-${item.station}`,
        category: 'INVENTORY',
        severity: item.category === 'FUEL' ? 'CRITICAL' : 'HIGH',
        title: `Stockout Breach Before Resupply: ${item.name} (${item.station})`,
        description: `Projected minimum level breach (${forecast.minBreachDate?.split('T')[0]}) occurs ${Math.abs(forecast.marginDays)} days BEFORE incoming resupply arrives (${forecast.nextResupplyDate?.split('T')[0]}).`,
        affectedEntityId: item._id.toString(),
        affectedEntityType: 'INVENTORY',
        suggestedAction: 'Enforce emergency conservation protocol and expedite vessel discharge.'
      });
    }
    // Rule: 0 <= marginDays < 3 -> MEDIUM
    else if (forecast.marginDays !== null && forecast.marginDays >= 0 && forecast.marginDays < 3) {
      alerts.push({
        id: `alert-inv-margin-${item.itemCode}-${item.station}`,
        category: 'INVENTORY',
        severity: 'MEDIUM',
        title: `Tight Resupply Margin: ${item.name} (${item.station})`,
        description: `Incoming resupply (${forecast.nextResupplyDate?.split('T')[0]}) arrives only ${forecast.marginDays} days before minimum stock breach. Weather delays pose high risk.`,
        affectedEntityId: item._id.toString(),
        affectedEntityType: 'INVENTORY',
        suggestedAction: 'Track inbound vessel ETA and stage offloading teams for immediate transfer.'
      });
    }

    // Rule: quantity <= minimumLevel (skip items raised as SPOF to prevent duplicates)
    if (!raisedAsSpofSet.has(item._id.toString()) && !raisedAsSpofSet.has(item.itemCode)) {
      if (item.quantity <= item.minimumLevel) {
        alerts.push({
          id: `alert-inv-low-${item.itemCode}-${item.station}`,
          category: 'INVENTORY',
          severity: item.quantity <= (item.minimumLevel / 2) ? 'CRITICAL' : 'HIGH',
          title: `Stock Below Threshold: ${item.name} (${item.station})`,
          description: `Current usable stock is ${item.quantity} ${item.unit} (Minimum threshold: ${item.minimumLevel} ${item.unit}).`,
          affectedEntityId: item._id.toString(),
          affectedEntityType: 'INVENTORY',
          suggestedAction: 'Manifest priority resupply or transfer reserves from alternative station.'
        });
      }
    }
  }

  // ==========================================
  // 4. PERSONNEL ALERTS (Readiness on active/planned missions)
  // ==========================================
  const activeMissions = missions.filter(m => m.status === 'PLANNED' || m.status === 'IN_PROGRESS');
  const peopleMap = new Map(people.map(p => [p._id.toString(), p]));

  for (const mission of activeMissions) {
    for (const pId of mission.peopleIds) {
      const person = peopleMap.get(pId);
      if (person) {
        const unreadyItems: string[] = [];
        if (!person.readiness?.medicalCleared) unreadyItems.push('Medical Clearance');
        if (!person.readiness?.auliTrainingCompleted) unreadyItems.push('Auli Snow Acclimatization');
        if (!person.readiness?.passportValid) unreadyItems.push('Passport Validity');
        if (!person.readiness?.polarPermitIssued) unreadyItems.push('MoES Polar Permit');

        if (unreadyItems.length > 0) {
          alerts.push({
            id: `alert-personnel-${person._id}`,
            category: 'PERSONNEL',
            severity: 'HIGH',
            title: `Mandatory Readiness Incomplete: ${person.name}`,
            description: `${person.name} (${person.role}) is assigned to "${mission.title}" but lacks: ${unreadyItems.join(', ')}.`,
            affectedEntityId: person._id.toString(),
            affectedEntityType: 'PERSON',
            suggestedAction: person.standbyPersonId
              ? 'Execute One-Click Standby Replacement to swap with certified reserve candidate.'
              : 'Expedite clearance documentation.'
          });
        }
      }
    }

    // ==========================================
    // 5. SCHEDULE ALERTS (Helicopter in winter: April to October)
    // ==========================================
    if (mission.helicopterNeeded) {
      const startDate = new Date(mission.startDate);
      const month = startDate.getUTCMonth() + 1; // 1-12
      // Winter cutoff: April to October (months 4 to 10) have zero helicopter air mobility
      if (month >= 4 && month <= 10) {
        alerts.push({
          id: `alert-schedule-${mission.code || mission._id}`,
          category: 'SCHEDULE',
          severity: 'CRITICAL',
          title: `Winter Helicopter Flight Prohibition: ${mission.code} (${mission.title})`,
          description: `Mission requires helicopter air-support in month ${month}, but ship-borne helicopters depart Antarctica in March due to winter conditions.`,
          affectedEntityId: mission._id.toString(),
          affectedEntityType: 'MISSION',
          suggestedAction: 'Reschedule mission to Summer window (Dec-Feb) or switch to PistenBully overland snowcat traverse.'
        });
      }
    }
  }

  // ==========================================
  // 6. ASSET ALERTS (assetEffectiveStatus === MAINTENANCE_DUE)
  // ==========================================
  for (const asset of assets) {
    const effStatus = assetEffectiveStatus(asset as any, currentDate);
    if (effStatus === 'UNDER_REPAIR') {
      alerts.push({
        id: `alert-asset-down-${asset.assetCode}`,
        category: 'ASSET',
        severity: asset.criticality === 'CRITICAL' || asset.criticality === 'HIGH' ? 'CRITICAL' : 'HIGH',
        title: `Out of Service: ${asset.assetCode} (${asset.name})`,
        description: `${asset.assetCode} at ${asset.location} is under repair and unavailable to missions that depend on it.`,
        affectedEntityId: asset._id.toString(),
        affectedEntityType: 'ASSET',
        suggestedAction: 'Assign a substitute asset or reschedule dependent missions until repair is complete.'
      });
    } else if (effStatus === 'MAINTENANCE_DUE') {
      alerts.push({
        id: `alert-asset-${asset.assetCode}`,
        category: 'ASSET',
        severity: asset.criticality === 'CRITICAL' ? 'CRITICAL' : 'HIGH',
        title: `Preventive Maintenance Overdue: ${asset.assetCode} (${asset.name})`,
        description: `Service was due on ${asset.nextServiceDueDate?.split('T')[0] || 'past date'}. Operating unserviced machinery in polar environments risks catastrophic failure.`,
        affectedEntityId: asset._id.toString(),
        affectedEntityType: 'ASSET',
        suggestedAction: 'Dispatch station mechanical technician for scheduled PM routine and spare replacement.'
      });
    }
  }

  // ==========================================
  // 7. CAPACITY ALERTS (stationOccupancy > beds in next 60 days)
  // ==========================================
  const datePlus60 = new Date(currentDate.getTime() + 60 * 86400000);
  for (const station of ['BHARATI', 'MAITRI']) {
    const daily = stationOccupancy(people as any, transportsById, station, currentDate, datePlus60);
    const overbookedDays = daily.filter(d => d.isOverbooked);

    if (overbookedDays.length > 0) {
      const maxHeadcount = Math.max(...overbookedDays.map(d => d.headcount));
      const firstDay = overbookedDays[0].date;
      const lastDay = overbookedDays[overbookedDays.length - 1].date;
      const bedLimit = STATION_BED_CAPACITIES[station] || 47;

      alerts.push({
        id: `alert-capacity-${station}`,
        category: 'CAPACITY',
        severity: 'MEDIUM',
        title: `Station Bed Overcapacity: ${station} (${maxHeadcount} / ${bedLimit} Beds)`,
        description: `Projected occupancy at ${station} peaks at ${maxHeadcount} persons between ${firstDay} and ${lastDay}, exceeding certified capacity of ${bedLimit} beds.`,
        affectedEntityId: station,
        affectedEntityType: 'EXPEDITION',
        suggestedAction: 'Adjust transit vessel departure window or deploy temporary containerized bunk modules.'
      });
    }
  }

  return alerts;
}

export async function getSystemAlerts(): Promise<IAlertItem[]> {
  const world = await fetchWorldSnapshot();
  return evaluateAlertsOverWorld(world, now());
}

export async function getRippleGraphForEntity(type: string, id: string) {
  const { affectedNodes, mitigations } = await computeRippleEffect(type as any, id, 3);
  const allEdges = await getAllEdges();

  return {
    root: { type, id },
    affectedCount: affectedNodes.length,
    affectedNodes,
    mitigations,
    allEdges
  };
}

export async function getStationOccupancyTimeline(station = 'BHARATI', days = 60) {
  const currentDate = now();
  const endDate = new Date(currentDate.getTime() + days * 86400000);
  const [people, transports] = await Promise.all([
    PersonModel.find().lean(),
    TransportModel.find().lean()
  ]);
  const transportsById = transports.reduce<Record<string, any>>((acc, t) => {
    acc[t._id.toString()] = t;
    return acc;
  }, {});

  const daily = stationOccupancy(people as any, transportsById, station, currentDate, endDate);
  const bedCapacity = STATION_BED_CAPACITIES[station] || 47;
  return {
    station,
    bedCapacity,
    daily
  };
}

