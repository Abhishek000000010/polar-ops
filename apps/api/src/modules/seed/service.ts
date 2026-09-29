import { ExpeditionModel } from '../expeditions/model';
import { MissionModel } from '../missions/model';
import { PersonModel } from '../people/model';
import { CrateModel } from '../cargo/model';
import { TransportModel } from '../transport/model';
import { InventoryItemModel, InventoryTransactionModel } from '../inventory/model';
import { AssetModel } from '../assets/model';
import { IncidentModel } from '../incidents/model';
import { EventModel } from '../../core/events';
import { EdgeModel, link } from '../../core/edges';
import { resetClock } from '../../core/clock';

// Mulberry32 deterministic PRNG
function mulberry32(seed: number) {
  let a = seed;
  return function () {
    let t = (a += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export async function resetAndSeedDatabase(actor = 'System') {
  console.log('[Seed] Clearing all operational collections...');

  await Promise.all([
    ExpeditionModel.deleteMany({}),
    MissionModel.deleteMany({}),
    PersonModel.deleteMany({}),
    CrateModel.deleteMany({}),
    TransportModel.deleteMany({}),
    InventoryItemModel.deleteMany({}),
    InventoryTransactionModel.deleteMany({}),
    AssetModel.deleteMany({}),
    IncidentModel.deleteMany({}),
    EventModel.deleteMany({}),
    EdgeModel.deleteMany({})
  ]);

  // Reset clock to 15 Nov 2026 08:00 UTC
  await resetClock();

  const rand = mulberry32(47);
  console.log('[Seed] Inserting unified demo world (Seed 47)...');

  // ==========================================
  // 1. EXPEDITION
  // ==========================================
  const expedition = await ExpeditionModel.create({
    code: 'ISEA-47',
    name: '47th Indian Scientific Expedition to Antarctica',
    season: '2026-2027',
    stations: ['BHARATI', 'MAITRI', 'CAPE_TOWN', 'GOA_HQ'],
    status: 'ACTIVE',
    startDate: '2026-11-01T00:00:00.000Z',
    endDate: '2027-04-15T00:00:00.000Z',
    leaderName: 'Dr. Arvind Nair (Voyage Leader & Chief Scientist)',
    description: '47th Indian Scientific Expedition to Antarctica: Larsemann Hills paleoclimate ice-core drilling and atmospheric radar sounding.'
  });

  // ==========================================
  // 2. TRANSPORTS (B1)
  // ==========================================
  // T1: MV Vasily Golovnin (SHIP, 4,500,000 kg, 85 seats, EN_ROUTE)
  const t1 = await TransportModel.create({
    name: 'MV Vasily Golovnin',
    type: 'SHIP',
    capacityKg: 4500000,
    passengerSeats: 85,
    status: 'EN_ROUTE',
    currentLocation: 'Southern Ocean (Lat -54.2, Lon 32.1)',
    schedule: [
      {
        stopNumber: 1,
        portOrStation: 'Cape Town Port',
        scheduledArrival: '2026-11-01T00:00:00.000Z',
        scheduledDeparture: '2026-11-12T00:00:00.000Z',
        actualArrival: '2026-11-01T00:00:00.000Z',
        actualDeparture: '2026-11-12T14:00:00.000Z',
        status: 'DEPARTED'
      },
      {
        stopNumber: 2,
        portOrStation: 'Bharati (Larsemann Hills)',
        scheduledArrival: '2026-11-28T08:00:00.000Z',
        scheduledDeparture: '2026-12-08T18:00:00.000Z',
        status: 'SCHEDULED'
      },
      {
        stopNumber: 3,
        portOrStation: 'Maitri (via India Bay)',
        scheduledArrival: '2026-12-20T08:00:00.000Z',
        scheduledDeparture: '2027-01-10T18:00:00.000Z',
        status: 'SCHEDULED'
      },
      {
        stopNumber: 4,
        portOrStation: 'Cape Town Port',
        scheduledArrival: '2027-01-28T08:00:00.000Z',
        scheduledDeparture: '2027-02-05T18:00:00.000Z',
        status: 'SCHEDULED'
      }
    ]
  });

  // T2: Kamov Ka-32 Helo-1 (HELICOPTER, aboard T1)
  const t2 = await TransportModel.create({
    name: 'Kamov Ka-32 Helo-1',
    type: 'HELICOPTER',
    capacityKg: 4000,
    passengerSeats: 14,
    status: 'AVAILABLE',
    currentLocation: 'Aboard MV Vasily Golovnin',
    schedule: [
      {
        stopNumber: 1,
        portOrStation: 'Bharati Helipad',
        scheduledArrival: '2026-11-28T10:00:00.000Z',
        scheduledDeparture: '2026-12-08T16:00:00.000Z',
        status: 'SCHEDULED'
      },
      {
        stopNumber: 2,
        portOrStation: 'Maitri Helipad',
        scheduledArrival: '2026-12-20T10:00:00.000Z',
        scheduledDeparture: '2027-01-10T16:00:00.000Z',
        status: 'SCHEDULED'
      }
    ]
  });

  // T3: DROMLAN Flight A (FLIGHT, Cape Town -> Novo, departed 05 Nov)
  const t3 = await TransportModel.create({
    name: 'DROMLAN Flight A',
    type: 'FLIGHT',
    capacityKg: 12000,
    passengerSeats: 18,
    status: 'DEPARTED',
    currentLocation: 'Novo Airbase',
    schedule: [
      {
        stopNumber: 1,
        portOrStation: 'Cape Town International Airport',
        scheduledArrival: '2026-11-04T00:00:00.000Z',
        scheduledDeparture: '2026-11-05T06:00:00.000Z',
        actualArrival: '2026-11-04T00:00:00.000Z',
        actualDeparture: '2026-11-05T06:00:00.000Z',
        status: 'DEPARTED'
      },
      {
        stopNumber: 2,
        portOrStation: 'Novo Airbase (Maitri Gateway)',
        scheduledArrival: '2026-11-05T14:30:00.000Z',
        scheduledDeparture: '2026-11-06T12:00:00.000Z',
        actualArrival: '2026-11-05T14:30:00.000Z',
        status: 'ARRIVED'
      }
    ]
  });

  // T4: DROMLAN Flight B (FLIGHT, Cape Town -> Novo, 02 Dec)
  const t4 = await TransportModel.create({
    name: 'DROMLAN Flight B',
    type: 'FLIGHT',
    capacityKg: 12000,
    passengerSeats: 18,
    status: 'SCHEDULED',
    currentLocation: 'Cape Town International Airport',
    schedule: [
      {
        stopNumber: 1,
        portOrStation: 'Cape Town International Airport',
        scheduledArrival: '2026-12-01T12:00:00.000Z',
        scheduledDeparture: '2026-12-02T06:00:00.000Z',
        status: 'SCHEDULED'
      },
      {
        stopNumber: 2,
        portOrStation: 'Novo Airbase (Maitri Gateway)',
        scheduledArrival: '2026-12-02T14:30:00.000Z',
        scheduledDeparture: '2026-12-03T10:00:00.000Z',
        status: 'SCHEDULED'
      }
    ]
  });

  // T5: Charter Flight CPT->Larsemann (illustrative)
  const t5 = await TransportModel.create({
    name: 'Charter Flight CPT→Larsemann (illustrative)',
    type: 'FLIGHT',
    capacityKg: 3000,
    passengerSeats: 12,
    status: 'SCHEDULED',
    currentLocation: 'Cape Town Executive Hangars',
    schedule: [
      {
        stopNumber: 1,
        portOrStation: 'Cape Town International Airport',
        scheduledArrival: '2026-11-23T12:00:00.000Z',
        scheduledDeparture: '2026-11-24T05:00:00.000Z',
        status: 'SCHEDULED'
      },
      {
        stopNumber: 2,
        portOrStation: 'Larsemann Hills Skiway (Bharati)',
        scheduledArrival: '2026-11-24T14:00:00.000Z',
        scheduledDeparture: '2026-11-25T10:00:00.000Z',
        status: 'SCHEDULED'
      }
    ]
  });

  // T6: PistenBully convoy (VEHICLE at Bharati)
  const t6 = await TransportModel.create({
    name: 'PistenBully Overland Convoy',
    type: 'VEHICLE',
    capacityKg: 8000,
    passengerSeats: 6,
    status: 'AVAILABLE',
    currentLocation: 'Bharati Station Garage',
    schedule: [
      {
        stopNumber: 1,
        portOrStation: 'Bharati Station',
        scheduledArrival: '2026-11-15T00:00:00.000Z',
        scheduledDeparture: '2026-12-05T08:00:00.000Z',
        status: 'SCHEDULED'
      },
      {
        stopNumber: 2,
        portOrStation: 'Polar Plateau Field Camp L-1',
        scheduledArrival: '2026-12-05T16:00:00.000Z',
        scheduledDeparture: '2026-12-20T08:00:00.000Z',
        status: 'SCHEDULED'
      }
    ]
  });

  const t1Id = t1._id.toString();
  const t3Id = t3._id.toString();
  const t4Id = t4._id.toString();
  const t5Id = t5._id.toString();

  // ==========================================
  // 3. INVENTORY & 60 DAYS OF TRANSACTIONS (B2)
  // ==========================================
  const invBharatiFuel = await InventoryItemModel.create({
    itemCode: 'FUEL-SAB',
    name: 'Polar Diesel (Special Antarctic Blend)',
    category: 'FUEL',
    station: 'BHARATI',
    quantity: 63000,
    minimumLevel: 30000,
    unit: 'liters',
    dailyBurnRate: 1500,
    lastRestockedDate: '2026-03-12T00:00:00.000Z'
  });

  const invMaitriFuel = await InventoryItemModel.create({
    itemCode: 'FUEL-SAB',
    name: 'Polar Diesel (Special Antarctic Blend)',
    category: 'FUEL',
    station: 'MAITRI',
    quantity: 120000,
    minimumLevel: 50000,
    unit: 'liters',
    dailyBurnRate: 1600,
    lastRestockedDate: '2026-03-20T00:00:00.000Z'
  });

  const invFoodBharati = await InventoryItemModel.create({
    itemCode: 'FOOD-RATIONS',
    name: 'Polar Expedition Freeze-Dried Rations',
    category: 'FOOD',
    station: 'BHARATI',
    quantity: 4200,
    minimumLevel: 1500,
    unit: 'kg',
    dailyBurnRate: 45,
    lastRestockedDate: '2026-03-12T00:00:00.000Z'
  });

  const invCatPump = await InventoryItemModel.create({
    itemCode: 'SPR-CAT-PUMP',
    name: 'CAT High-Pressure Fuel Injection Pump',
    category: 'SPARES',
    station: 'BHARATI',
    quantity: 1, // Planted SPOF
    minimumLevel: 2,
    unit: 'units',
    dailyBurnRate: 0
  });

  const invDrillHead = await InventoryItemModel.create({
    itemCode: 'SPR-DRILL-HEAD',
    name: 'Carbide Ice-Core Drill Head 120mm',
    category: 'SPARES',
    station: 'BHARATI',
    quantity: 3,
    minimumLevel: 2,
    unit: 'units',
    dailyBurnRate: 0
  });

  const invMedO2 = await InventoryItemModel.create({
    itemCode: 'MED-O2-CYL',
    name: 'Medical Oxygen Cylinders 50L (Cryo-rated)',
    category: 'MEDICAL',
    station: 'BHARATI',
    quantity: 14,
    minimumLevel: 8,
    unit: 'cylinders',
    dailyBurnRate: 0.2
  });

  // Seed 60 days of daily USED transactions ending on 15 Nov 2026
  const anchorTime = new Date('2026-11-15T08:00:00.000Z').getTime();
  const txDocs: any[] = [];

  // Generate Bharati Fuel transactions:
  // Days 1..46 (winter crew): mean exactly 1100, variance +/- 60
  // Days 47..60 (last 14 days): mean exactly 1500, variance +/- 60
  const bFuelTxs: number[] = [];
  let sumBWinter = 0;
  for (let i = 0; i < 45; i++) {
    const jitter = Math.round((rand() - 0.5) * 120);
    const val = 1100 + jitter;
    bFuelTxs.push(val);
    sumBWinter += val;
  }
  bFuelTxs.push(1100 * 46 - sumBWinter); // 46th day balances sum to exactly 46 * 1100

  let sumBSummer = 0;
  for (let i = 0; i < 13; i++) {
    const jitter = Math.round((rand() - 0.5) * 120);
    const val = 1500 + jitter;
    bFuelTxs.push(val);
    sumBSummer += val;
  }
  bFuelTxs.push(1500 * 14 - sumBSummer); // 60th day balances sum to exactly 14 * 1500

  // Maitri Fuel: days 1..46 mean 1300; last 14 days mean 1600
  const mFuelTxs: number[] = [];
  let sumMWinter = 0;
  for (let i = 0; i < 45; i++) {
    const jitter = Math.round((rand() - 0.5) * 120);
    const val = 1300 + jitter;
    mFuelTxs.push(val);
    sumMWinter += val;
  }
  mFuelTxs.push(1300 * 46 - sumMWinter);

  let sumMSummer = 0;
  for (let i = 0; i < 13; i++) {
    const jitter = Math.round((rand() - 0.5) * 120);
    const val = 1600 + jitter;
    mFuelTxs.push(val);
    sumMSummer += val;
  }
  mFuelTxs.push(1600 * 14 - sumMSummer);

  for (let d = 59; d >= 0; d--) {
    const txTime = new Date(anchorTime - d * 86400000).toISOString();
    const dayIdx = 59 - d;

    // Bharati Fuel
    txDocs.push({
      itemId: invBharatiFuel._id.toString(),
      itemCode: 'FUEL-SAB',
      station: 'BHARATI',
      type: 'USED',
      quantity: bFuelTxs[dayIdx],
      reason: 'Daily Station Genset & Facility Heating Consumption',
      actor: 'Genset Automation Controller',
      timestamp: txTime
    });

    // Maitri Fuel
    txDocs.push({
      itemId: invMaitriFuel._id.toString(),
      itemCode: 'FUEL-SAB',
      station: 'MAITRI',
      type: 'USED',
      quantity: mFuelTxs[dayIdx],
      reason: 'Daily Station Power & Habitat Heating Consumption',
      actor: 'Maitri Power Watch',
      timestamp: txTime
    });

    // Food Rations
    txDocs.push({
      itemId: invFoodBharati._id.toString(),
      itemCode: 'FOOD-RATIONS',
      station: 'BHARATI',
      type: 'USED',
      quantity: 45 + Math.round((rand() - 0.5) * 6),
      reason: 'Galley Daily Crew Consumption',
      actor: 'Station Chef',
      timestamp: txTime
    });

    // Medical O2 (1 cylinder every 5 days)
    if (dayIdx % 5 === 0) {
      txDocs.push({
        itemId: invMedO2._id.toString(),
        itemCode: 'MED-O2-CYL',
        station: 'BHARATI',
        type: 'USED',
        quantity: 1,
        reason: 'Hyperbaric Chamber Testing & Altitude Prep',
        actor: 'Station Doctor',
        timestamp: txTime
      });
    }
  }

  await InventoryTransactionModel.insertMany(txDocs);

  // ==========================================
  // 4. ASSETS (B3)
  // ==========================================
  const gen01 = await AssetModel.create({
    assetCode: 'GEN-BHARATI-01',
    name: 'Caterpillar 3406C Polar Diesel Genset #1',
    category: 'GENERATOR',
    location: 'BHARATI',
    status: 'OPERATIONAL',
    lastServiceDate: '2026-07-01T00:00:00.000Z',
    nextServiceDueDate: '2027-01-01T00:00:00.000Z',
    runtimeHours: 8420,
    requiredSpareItemIds: [invCatPump._id.toString()],
    criticality: 'CRITICAL'
  });

  const gen02 = await AssetModel.create({
    assetCode: 'GEN-BHARATI-02',
    name: 'Caterpillar 3406C Polar Diesel Genset #2',
    category: 'GENERATOR',
    location: 'BHARATI',
    status: 'OPERATIONAL', // Will derive to MAINTENANCE_DUE because nextServiceDueDate <= now
    lastServiceDate: '2026-05-10T00:00:00.000Z',
    nextServiceDueDate: '2026-11-10T00:00:00.000Z', // OVERDUE on 10 Nov!
    runtimeHours: 9150,
    requiredSpareItemIds: [invCatPump._id.toString()],
    criticality: 'CRITICAL'
  });

  const genField03 = await AssetModel.create({
    assetCode: 'GEN-FIELD-03',
    name: 'Mobile Cummins 60kVA Field Genset',
    category: 'GENERATOR',
    location: 'BHARATI',
    status: 'OPERATIONAL',
    lastServiceDate: '2026-08-01T00:00:00.000Z',
    nextServiceDueDate: '2027-02-01T00:00:00.000Z',
    runtimeHours: 3200,
    criticality: 'HIGH'
  });

  const rigDeep01 = await AssetModel.create({
    assetCode: 'RIG-DEEP-01',
    name: 'Hans Tausen 120m Paleoclimate Ice Drill Rig',
    category: 'DRILL_RIG',
    location: 'BHARATI',
    status: 'OPERATIONAL',
    lastServiceDate: '2026-06-15T00:00:00.000Z',
    nextServiceDueDate: '2027-01-15T00:00:00.000Z',
    runtimeHours: 1450,
    requiredSpareItemIds: [invDrillHead._id.toString()],
    criticality: 'HIGH'
  });

  const rigShallow02 = await AssetModel.create({
    assetCode: 'RIG-SHALLOW-02',
    name: 'Kovacs 30m Shallow Ice Auger Drill (Backup)',
    category: 'DRILL_RIG',
    location: 'BHARATI',
    status: 'OPERATIONAL',
    lastServiceDate: '2026-09-01T00:00:00.000Z',
    nextServiceDueDate: '2027-03-01T00:00:00.000Z',
    runtimeHours: 850,
    criticality: 'MEDIUM'
  });

  const pb04 = await AssetModel.create({
    assetCode: 'PB-300-04',
    name: 'Kässbohrer PistenBully 300 Polar Snowcat',
    category: 'VEHICLE',
    location: 'BHARATI',
    status: 'OPERATIONAL',
    lastServiceDate: '2026-07-01T00:00:00.000Z',
    nextServiceDueDate: '2027-01-01T00:00:00.000Z',
    runtimeHours: 4200,
    criticality: 'HIGH'
  });

  const pb05 = await AssetModel.create({
    assetCode: 'PB-300-05',
    name: 'Kässbohrer PistenBully 300 Heavy Traverse Snowcat (Alternative)',
    category: 'VEHICLE',
    location: 'BHARATI',
    status: 'OPERATIONAL',
    lastServiceDate: '2026-07-15T00:00:00.000Z',
    nextServiceDueDate: '2027-01-15T00:00:00.000Z',
    runtimeHours: 3800,
    criticality: 'HIGH'
  });

  const lidar01 = await AssetModel.create({
    assetCode: 'LIDAR-MAI-01',
    name: 'Rayleigh Doppler Lidar Atmospheric Sounder',
    category: 'LAB_EQUIPMENT',
    location: 'MAITRI',
    status: 'OPERATIONAL',
    lastServiceDate: '2026-09-01T00:00:00.000Z',
    nextServiceDueDate: '2027-03-01T00:00:00.000Z',
    runtimeHours: 5120,
    criticality: 'HIGH'
  });

  // Link Asset dependencies
  await link('ASSET', gen01._id.toString(), 'INVENTORY', invCatPump._id.toString(), 'NEEDS_SPARE');
  await link('ASSET', gen01._id.toString(), 'INVENTORY', invBharatiFuel._id.toString(), 'CONSUMES');
  await link('ASSET', gen02._id.toString(), 'INVENTORY', invCatPump._id.toString(), 'NEEDS_SPARE');
  await link('ASSET', gen02._id.toString(), 'INVENTORY', invBharatiFuel._id.toString(), 'CONSUMES');
  await link('ASSET', genField03._id.toString(), 'INVENTORY', invBharatiFuel._id.toString(), 'CONSUMES');
  await link('ASSET', rigDeep01._id.toString(), 'INVENTORY', invDrillHead._id.toString(), 'NEEDS_SPARE');

  // ==========================================
  // 5. PEOPLE & STANDBYS (B4)
  // ==========================================
  // Planted standbys first
  const pAman = await PersonModel.create({
    name: 'Dr. Aman Verma',
    role: 'Glaciologist',
    skills: ['Ice-Core Drilling', 'Cryo-Stratigraphy', 'Glacial Radar'],
    readiness: { medicalCleared: true, auliTrainingCompleted: true, passportValid: true, polarPermitIssued: true },
    standbyPersonId: null,
    currentLocation: 'GOA_HQ',
    destinationLocation: 'BHARATI'
  });

  const pRajesh = await PersonModel.create({
    name: 'Rajesh Naik',
    role: 'Station Mechanical Engineer',
    skills: ['Diesel Generator Overhaul', 'Hydraulics', 'HVAC'],
    readiness: { medicalCleared: true, auliTrainingCompleted: true, passportValid: true, polarPermitIssued: true },
    standbyPersonId: null,
    currentLocation: 'GOA_HQ',
    destinationLocation: 'BHARATI'
  });

  // Planted primaries
  const pSunita = await PersonModel.create({
    name: 'Dr. Sunita Kulkarni',
    role: 'Lead Glaciologist',
    skills: ['Paleoclimate Analysis', 'Ice-Core Logging', 'Remote Glacial Traverse'],
    readiness: { medicalCleared: false, auliTrainingCompleted: true, passportValid: true, polarPermitIssued: false },
    standbyPersonId: pAman._id.toString(),
    currentLocation: 'CAPE_TOWN',
    destinationLocation: 'BHARATI',
    inboundTransportId: t5Id,
    inboundUnloadStop: 2
  });

  const pGurpreet = await PersonModel.create({
    name: 'Gurpreet Singh',
    role: 'Chief Station Engineer',
    skills: ['Power Plant Supervisory', 'Cryo-Piping', 'Snowcat Maintenance'],
    readiness: { medicalCleared: true, auliTrainingCompleted: true, passportValid: true, polarPermitIssued: true },
    standbyPersonId: pRajesh._id.toString(),
    currentLocation: 'EN_ROUTE_VESSEL',
    destinationLocation: 'BHARATI',
    inboundTransportId: t1Id,
    inboundUnloadStop: 2
  });

  const pImran = await PersonModel.create({
    name: 'Imran Shaikh',
    role: 'Generator Mechanic',
    skills: ['CAT 3406C Rebuilding', 'Fuel Injector Calibration', 'Electrical Switchgear'],
    readiness: { medicalCleared: true, auliTrainingCompleted: true, passportValid: true, polarPermitIssued: true },
    standbyPersonId: null,
    currentLocation: 'EN_ROUTE_VESSEL',
    destinationLocation: 'BHARATI',
    inboundTransportId: t1Id,
    inboundUnloadStop: 2
  });

  const pTenzing = await PersonModel.create({
    name: 'Tenzing Norbu',
    role: 'Field Safety Guide',
    skills: ['Crevasse Rescue', 'Polar Navigation', 'Overland Snowcat Lead'],
    readiness: { medicalCleared: true, auliTrainingCompleted: true, passportValid: true, polarPermitIssued: true },
    standbyPersonId: null,
    currentLocation: 'BHARATI',
    destinationLocation: 'BHARATI'
  });

  const pAnanya = await PersonModel.create({
    name: 'Ananya Roy',
    role: 'Atmospheric Radar Scientist',
    skills: ['Lidar Sounding', 'Ionospheric Physics', 'Radio Interferometry'],
    readiness: { medicalCleared: true, auliTrainingCompleted: true, passportValid: true, polarPermitIssued: true },
    standbyPersonId: null,
    currentLocation: 'MAITRI',
    destinationLocation: 'MAITRI'
  });

  const pSwaminathan = await PersonModel.create({
    name: 'Dr. K. Swaminathan',
    role: 'Medical Officer',
    skills: ['Polar Emergency Trauma', 'Hyperbaric Medicine', 'Frostbite Surgery'],
    readiness: { medicalCleared: true, auliTrainingCompleted: true, passportValid: true, polarPermitIssued: true },
    standbyPersonId: null,
    currentLocation: 'EN_ROUTE_VESSEL',
    destinationLocation: 'BHARATI',
    inboundTransportId: t1Id,
    inboundUnloadStop: 2
  });

  // Link standbys
  await link('PERSON', pAman._id.toString(), 'PERSON', pSunita._id.toString(), 'BACKUP_FOR');
  await link('PERSON', pRajesh._id.toString(), 'PERSON', pGurpreet._id.toString(), 'BACKUP_FOR');

  // Link inbound transports
  await link('PERSON', pSunita._id.toString(), 'TRANSPORT', t5Id, 'CARRIED_BY', { unloadStop: 2 });
  await link('PERSON', pGurpreet._id.toString(), 'TRANSPORT', t1Id, 'CARRIED_BY', { unloadStop: 2 });
  await link('PERSON', pImran._id.toString(), 'TRANSPORT', t1Id, 'CARRIED_BY', { unloadStop: 2 });
  await link('PERSON', pSwaminathan._id.toString(), 'TRANSPORT', t1Id, 'CARRIED_BY', { unloadStop: 2 });

  // ------------------------------------------
  // Filler People Teams (all fully ready)
  // ------------------------------------------
  // 1. Bharati winter crew: 23 people at BHARATI, outbound T1 stop 2 (leaves 08 Dec)
  const bharatiWinterPeople: any[] = [];
  for (let i = 1; i <= 23; i++) {
    const doc = await PersonModel.create({
      name: `Bharati Winter Specialist #${i}`,
      role: i % 2 === 0 ? 'Research Technician' : 'Facility Operator',
      skills: ['Wintering Life Support', 'Cold-Weather Station Ops'],
      readiness: { medicalCleared: true, auliTrainingCompleted: true, passportValid: true, polarPermitIssued: true },
      currentLocation: 'BHARATI',
      destinationLocation: 'GOA_HQ',
      outboundTransportId: t1Id,
      outboundLoadStop: 2
    });
    bharatiWinterPeople.push(doc);
  }

  // 2. Bharati summer team on ship: 19 more on T1 stop 2 (making 22 total with Gurpreet, Imran, Swaminathan)
  const bharatiSummerShipPeople: any[] = [];
  for (let i = 1; i <= 19; i++) {
    const doc = await PersonModel.create({
      name: `Bharati Summer Scientist #${i}`,
      role: i % 3 === 0 ? 'Geophysicist' : (i % 3 === 1 ? 'Meteorologist' : 'Drill Technician'),
      skills: ['Summer Field Science', 'Environmental Sampling'],
      readiness: { medicalCleared: true, auliTrainingCompleted: true, passportValid: true, polarPermitIssued: true },
      currentLocation: 'EN_ROUTE_VESSEL',
      destinationLocation: 'BHARATI',
      inboundTransportId: t1Id,
      inboundUnloadStop: 2
    });
    await link('PERSON', doc._id.toString(), 'TRANSPORT', t1Id, 'CARRIED_BY', { unloadStop: 2 });
    bharatiSummerShipPeople.push(doc);
  }

  // 3. Mission A flight team: 3 more on T5 (making 4 total with Sunita)
  const missionAFlightPeople: any[] = [];
  for (let i = 1; i <= 3; i++) {
    const doc = await PersonModel.create({
      name: `Paleo-Ice Field Scientist #${i}`,
      role: 'Ice-Core Core Logger',
      skills: ['Cryo-Stratigraphy', 'Drill Core Trench Logging'],
      readiness: { medicalCleared: true, auliTrainingCompleted: true, passportValid: true, polarPermitIssued: true },
      currentLocation: 'CAPE_TOWN',
      destinationLocation: 'BHARATI',
      inboundTransportId: t5Id,
      inboundUnloadStop: 2
    });
    await link('PERSON', doc._id.toString(), 'TRANSPORT', t5Id, 'CARRIED_BY', { unloadStop: 2 });
    missionAFlightPeople.push(doc);
  }

  // 4. Maitri filler: 19 more at MAITRI (making 20 with Ananya)
  // 17 of current Maitri crew outbound T1 stop 3
  // 18 arriving T1 stop 3
  for (let i = 1; i <= 19; i++) {
    const isOutbound = i <= 17;
    await PersonModel.create({
      name: `Maitri Station Crew #${i}`,
      role: 'Atmospheric & Geomagnetic Observer',
      skills: ['Magnetometer Sounding', 'Ozone Spectrometry'],
      readiness: { medicalCleared: true, auliTrainingCompleted: true, passportValid: true, polarPermitIssued: true },
      currentLocation: 'MAITRI',
      destinationLocation: isOutbound ? 'GOA_HQ' : 'MAITRI',
      outboundTransportId: isOutbound ? t1Id : undefined,
      outboundLoadStop: isOutbound ? 3 : undefined
    });
  }

  // 18 arriving Maitri summer team on T1 stop 3
  for (let i = 1; i <= 18; i++) {
    const doc = await PersonModel.create({
      name: `Maitri Summer Team #${i}`,
      role: 'Summer Research Fellow',
      skills: ['Polar Biology', 'Permafrost Coring'],
      readiness: { medicalCleared: true, auliTrainingCompleted: true, passportValid: true, polarPermitIssued: true },
      currentLocation: 'EN_ROUTE_VESSEL',
      destinationLocation: 'MAITRI',
      inboundTransportId: t1Id,
      inboundUnloadStop: 3
    });
    await link('PERSON', doc._id.toString(), 'TRANSPORT', t1Id, 'CARRIED_BY', { unloadStop: 3 });
  }

  // ==========================================
  // 6. CRATES (B5)
  // ==========================================
  // Planted Crates
  const crt1042 = await CrateModel.create({
    crateCode: 'CRT-1042',
    title: 'HT-120 Ice-Core Drill Barrel, Cutter Head, & 150m Winch Cable',
    weightKg: 850,
    dimensionsCm: { length: 240, width: 90, height: 95 },
    hazardous: false,
    destinationStation: 'BHARATI',
    requiredByDate: '2026-12-01T00:00:00.000Z', // Mission A requires by 01 Dec (ETA 29 Nov = 2-day buffer)
    status: 'LOADED_VESSEL',
    carrierTransportId: t1Id,
    carrierLoadStop: 1,
    carrierUnloadStop: 2,
    handlingDays: 1,
    loadedOnCarrier: true,
    storageConditions: 'Dry Heated Hold (+5C to +15C)'
  });

  const crt1043 = await CrateModel.create({
    crateCode: 'CRT-1043',
    title: 'Bulk Polar Diesel Consignment (250,000 Liters SAB)',
    weightKg: 212500,
    dimensionsCm: { length: 1200, width: 240, height: 260 },
    hazardous: true,
    hazardClass: 'Class 3: Flammable Liquid',
    destinationStation: 'BHARATI',
    requiredByDate: '2026-12-07T00:00:00.000Z',
    status: 'LOADED_VESSEL',
    carrierTransportId: t1Id,
    carrierLoadStop: 1,
    carrierUnloadStop: 2,
    handlingDays: 2,
    loadedOnCarrier: true,
    resupplies: {
      inventoryItemId: invBharatiFuel._id.toString(),
      quantity: 250000
    }
  });

  const crt1044 = await CrateModel.create({
    crateCode: 'CRT-1044',
    title: 'Bulk Polar Diesel Consignment (200,000 Liters SAB)',
    weightKg: 170000,
    dimensionsCm: { length: 1000, width: 240, height: 260 },
    hazardous: true,
    hazardClass: 'Class 3: Flammable Liquid',
    destinationStation: 'MAITRI',
    requiredByDate: '2026-12-28T00:00:00.000Z',
    status: 'LOADED_VESSEL',
    carrierTransportId: t1Id,
    carrierLoadStop: 1,
    carrierUnloadStop: 3,
    handlingDays: 2,
    loadedOnCarrier: true,
    resupplies: {
      inventoryItemId: invMaitriFuel._id.toString(),
      quantity: 200000
    }
  });

  const crt1050 = await CrateModel.create({
    crateCode: 'CRT-1050',
    title: 'CAT 3406C High-Pressure Fuel Injection Replacement Pumps (2 Units)',
    weightKg: 140,
    dimensionsCm: { length: 80, width: 60, height: 50 },
    hazardous: false,
    destinationStation: 'BHARATI',
    requiredByDate: '2026-12-15T00:00:00.000Z',
    status: 'LOADED_VESSEL',
    carrierTransportId: t1Id,
    carrierLoadStop: 1,
    carrierUnloadStop: 2,
    handlingDays: 1,
    loadedOnCarrier: true,
    resupplies: {
      inventoryItemId: invCatPump._id.toString(),
      quantity: 2
    }
  });

  const crt1004 = await CrateModel.create({
    crateCode: 'CRT-1004',
    title: 'Cold-Chain Cryo-Preserved Surgical Anaesthetics & Plasma',
    weightKg: 45,
    dimensionsCm: { length: 60, width: 45, height: 40 },
    hazardous: false,
    destinationStation: 'BHARATI',
    requiredByDate: '2026-12-10T00:00:00.000Z',
    status: 'LOADED_VESSEL',
    carrierTransportId: t1Id,
    carrierLoadStop: 1,
    carrierUnloadStop: 2,
    handlingDays: 1,
    loadedOnCarrier: true,
    storageConditions: 'Strict Cold-Chain (-20C Cryo-Shipper)'
  });

  const crt1118 = await CrateModel.create({
    crateCode: 'CRT-1118',
    title: 'LiFePO4 Automatic Weather Station Battery Bank 180kg (UN3480)',
    weightKg: 180,
    dimensionsCm: { length: 110, width: 75, height: 60 },
    hazardous: true,
    hazardClass: 'Class 9: Lithium Ion Batteries (UN 3480)',
    destinationStation: 'MAITRI',
    requiredByDate: '2026-12-08T00:00:00.000Z', // Needed by Mission B on 10 Dec
    status: 'ARRIVED_HUB',
    carrierTransportId: t3Id, // Assigned to T3
    carrierLoadStop: 1,
    carrierUnloadStop: 2,
    handlingDays: 1,
    loadedOnCarrier: false // NOT LOADED! T3 departed 05 Nov -> Missed connection!
  });

  // Link Crates to Transports
  await link('CRATE', crt1042._id.toString(), 'TRANSPORT', t1Id, 'CARRIED_BY', { loadStop: 1, unloadStop: 2 });
  await link('CRATE', crt1043._id.toString(), 'TRANSPORT', t1Id, 'CARRIED_BY', { loadStop: 1, unloadStop: 2 });
  await link('CRATE', crt1044._id.toString(), 'TRANSPORT', t1Id, 'CARRIED_BY', { loadStop: 1, unloadStop: 3 });
  await link('CRATE', crt1050._id.toString(), 'TRANSPORT', t1Id, 'CARRIED_BY', { loadStop: 1, unloadStop: 2 });
  await link('CRATE', crt1004._id.toString(), 'TRANSPORT', t1Id, 'CARRIED_BY', { loadStop: 1, unloadStop: 2 });
  await link('CRATE', crt1118._id.toString(), 'TRANSPORT', t3Id, 'CARRIED_BY', { loadStop: 1, unloadStop: 2 });

  // Link Resupplies
  await link('INVENTORY', invBharatiFuel._id.toString(), 'CRATE', crt1043._id.toString(), 'RESUPPLIED_BY');
  await link('INVENTORY', invMaitriFuel._id.toString(), 'CRATE', crt1044._id.toString(), 'RESUPPLIED_BY');
  await link('INVENTORY', invCatPump._id.toString(), 'CRATE', crt1050._id.toString(), 'RESUPPLIED_BY');

  // ------------------------------------------
  // Filler Crates (~25 on T1 with requiredBy >= ETA + 14 days, e.g. late Dec/Jan)
  // ------------------------------------------
  for (let i = 1; i <= 25; i++) {
    const isMaitri = i > 15;
    const unloadStop = isMaitri ? 3 : 2;
    const baseEta = isMaitri ? new Date('2026-12-22T08:00:00.000Z') : new Date('2026-11-29T08:00:00.000Z');
    // Buffer >= 14 days
    const reqDate = new Date(baseEta.getTime() + (16 + (i % 10)) * 86400000).toISOString();

    const fCrate = await CrateModel.create({
      crateCode: `CRT-FLR-${1000 + i}`,
      title: `General Scientific Consumables Consignment #${i}`,
      weightKg: Math.round(150 + rand() * 300),
      dimensionsCm: { length: 100, width: 80, height: 70 },
      hazardous: false,
      destinationStation: isMaitri ? 'MAITRI' : 'BHARATI',
      requiredByDate: reqDate,
      status: 'LOADED_VESSEL',
      carrierTransportId: t1Id,
      carrierLoadStop: 1,
      carrierUnloadStop: unloadStop,
      handlingDays: 1,
      loadedOnCarrier: true
    });

    await link('CRATE', fCrate._id.toString(), 'TRANSPORT', t1Id, 'CARRIED_BY', { loadStop: 1, unloadStop });
  }

  // ~10 crates already RECEIVED_STATION
  for (let i = 1; i <= 10; i++) {
    await CrateModel.create({
      crateCode: `CRT-STN-${2000 + i}`,
      title: `Pre-staged Winter Survival Equipment Unit #${i}`,
      weightKg: 200,
      dimensionsCm: { length: 100, width: 80, height: 80 },
      hazardous: false,
      destinationStation: i % 2 === 0 ? 'BHARATI' : 'MAITRI',
      requiredByDate: '2026-11-01T00:00:00.000Z',
      status: 'RECEIVED_STATION',
      handlingDays: 1
    });
  }

  // ==========================================
  // 7. MISSIONS (B6)
  // ==========================================
  // Mission A: MSN-ICE-4701 (Hero Story)
  const misA = await MissionModel.create({
    expeditionId: expedition._id.toString(),
    code: 'MSN-ICE-4701',
    title: 'Larsemann Hills 120-Meter Paleoclimate Ice-Core Retrieval',
    station: 'BHARATI',
    startDate: '2026-12-03T00:00:00.000Z',
    endDate: '2027-01-20T00:00:00.000Z',
    priority: 1,
    helicopterNeeded: false,
    leadScientist: 'Dr. Sunita Kulkarni',
    peopleIds: [
      pSunita._id.toString(),
      pGurpreet._id.toString(),
      pTenzing._id.toString(),
      ...missionAFlightPeople.map(p => p._id.toString())
    ],
    crateIds: [crt1042._id.toString()],
    assetIds: [rigDeep01._id.toString(), pb04._id.toString(), genField03._id.toString()],
    status: 'PLANNED',
    description: 'Drilling 120-meter continuous ice cores in Larsemann Hills to analyze Milankovitch climate cycles over the past 80,000 years.'
  });

  // Mission B: MSN-ATM-4702 (Customs / Missed-Flight Story)
  const misB = await MissionModel.create({
    expeditionId: expedition._id.toString(),
    code: 'MSN-ATM-4702',
    title: 'Schirmacher Oasis Rayleigh Lidar Atmospheric Sounding',
    station: 'MAITRI',
    startDate: '2026-12-10T00:00:00.000Z',
    endDate: '2027-02-15T00:00:00.000Z',
    priority: 2,
    helicopterNeeded: true, // December is summer, so helicopter is permitted!
    leadScientist: 'Ananya Roy',
    peopleIds: [pAnanya._id.toString()],
    crateIds: [crt1118._id.toString()],
    assetIds: [lidar01._id.toString()],
    status: 'PLANNED',
    description: 'Observation of middle-atmosphere temperature profiles and polar stratospheric clouds over Schirmacher Oasis.'
  });

  // Mission C: MSN-INF-4703 (Generator Overhaul)
  const misC = await MissionModel.create({
    expeditionId: expedition._id.toString(),
    code: 'MSN-INF-4703',
    title: 'Bharati Main Powerhouse Genset-02 Critical Overhaul',
    station: 'BHARATI',
    startDate: '2026-12-10T00:00:00.000Z',
    endDate: '2026-12-17T00:00:00.000Z',
    priority: 2,
    helicopterNeeded: false,
    leadScientist: 'Imran Shaikh',
    peopleIds: [pImran._id.toString()],
    crateIds: [crt1050._id.toString()],
    assetIds: [gen02._id.toString()],
    status: 'PLANNED',
    description: 'Installation of arriving fuel injection pumps and full mechanical overhaul of overdue generator CAT-02.'
  });

  // Mission D: MSN-AWS-4704 (Planted Planning Error: Helicopter in April)
  const misD = await MissionModel.create({
    expeditionId: expedition._id.toString(),
    code: 'MSN-AWS-4704',
    title: 'Plateau Remote AWS Servicing Traverse',
    station: 'BHARATI',
    startDate: '2027-04-05T00:00:00.000Z',
    endDate: '2027-04-15T00:00:00.000Z',
    priority: 3,
    helicopterNeeded: true, // Planted error: month 4 (April) has zero helicopter air support!
    leadScientist: 'Station Operations Specialist',
    peopleIds: [bharatiSummerShipPeople[0]._id.toString()],
    crateIds: [],
    assetIds: [],
    status: 'PLANNED',
    description: 'Scheduled maintenance of automated weather station telemetry on the Polar Plateau rim.'
  });

  // Mission E: MSN-SNW-4705 (Owns Backup Drill & Spare Snowcat)
  const misE = await MissionModel.create({
    expeditionId: expedition._id.toString(),
    code: 'MSN-SNW-4705',
    title: 'Coastal Cryo-Surface Snow Accumulation Study',
    station: 'BHARATI',
    startDate: '2026-12-05T00:00:00.000Z',
    endDate: '2026-12-25T00:00:00.000Z',
    priority: 3,
    helicopterNeeded: false,
    leadScientist: 'Field Glaciologist',
    peopleIds: [bharatiSummerShipPeople[1]._id.toString(), bharatiSummerShipPeople[2]._id.toString()],
    crateIds: [],
    assetIds: [rigShallow02._id.toString(), pb05._id.toString()],
    status: 'PLANNED',
    description: 'Annual snow stake accumulation survey and shallowfirn core measurements.'
  });

  // Link Crates to Missions
  crt1042.linkedMissionId = misA._id.toString();
  await crt1042.save();
  await link('MISSION', misA._id.toString(), 'CRATE', crt1042._id.toString(), 'NEEDS_CRATE');

  crt1118.linkedMissionId = misB._id.toString();
  await crt1118.save();
  await link('MISSION', misB._id.toString(), 'CRATE', crt1118._id.toString(), 'NEEDS_CRATE');

  crt1050.linkedMissionId = misC._id.toString();
  await crt1050.save();
  await link('MISSION', misC._id.toString(), 'CRATE', crt1050._id.toString(), 'NEEDS_CRATE');

  // Link Mission A Resources
  await link('MISSION', misA._id.toString(), 'PERSON', pSunita._id.toString(), 'NEEDS_PERSON', { role: 'Lead Glaciologist' });
  await link('MISSION', misA._id.toString(), 'PERSON', pGurpreet._id.toString(), 'NEEDS_PERSON', { role: 'Chief Station Engineer' });
  await link('MISSION', misA._id.toString(), 'PERSON', pTenzing._id.toString(), 'NEEDS_PERSON', { role: 'Field Safety Guide' });
  for (const fp of missionAFlightPeople) {
    await link('MISSION', misA._id.toString(), 'PERSON', fp._id.toString(), 'NEEDS_PERSON', { role: fp.role });
  }
  await link('MISSION', misA._id.toString(), 'ASSET', rigDeep01._id.toString(), 'NEEDS_ASSET');
  await link('MISSION', misA._id.toString(), 'ASSET', pb04._id.toString(), 'NEEDS_ASSET');
  await link('MISSION', misA._id.toString(), 'ASSET', genField03._id.toString(), 'NEEDS_ASSET');

  // Link Mission B Resources
  await link('MISSION', misB._id.toString(), 'PERSON', pAnanya._id.toString(), 'NEEDS_PERSON', { role: 'Atmospheric Radar Scientist' });
  await link('MISSION', misB._id.toString(), 'ASSET', lidar01._id.toString(), 'NEEDS_ASSET');

  // Link Mission C Resources
  await link('MISSION', misC._id.toString(), 'PERSON', pImran._id.toString(), 'NEEDS_PERSON', { role: 'Generator Mechanic' });
  await link('MISSION', misC._id.toString(), 'ASSET', gen02._id.toString(), 'NEEDS_ASSET');

  // Link Mission D & E Resources
  await link('MISSION', misD._id.toString(), 'PERSON', bharatiSummerShipPeople[0]._id.toString(), 'NEEDS_PERSON');
  await link('MISSION', misE._id.toString(), 'PERSON', bharatiSummerShipPeople[1]._id.toString(), 'NEEDS_PERSON');
  await link('MISSION', misE._id.toString(), 'PERSON', bharatiSummerShipPeople[2]._id.toString(), 'NEEDS_PERSON');
  await link('MISSION', misE._id.toString(), 'ASSET', rigShallow02._id.toString(), 'NEEDS_ASSET');
  await link('MISSION', misE._id.toString(), 'ASSET', pb05._id.toString(), 'NEEDS_ASSET');

  // ==========================================
  // 8. INCIDENTS (B7)
  // ==========================================
  await IncidentModel.create({
    incidentCode: 'INC-2026-01',
    title: 'Severe Katabatic Gale Advisory (Gusts > 75 kts) in Prydz Bay Sector',
    description: 'Polar maritime front generating sustained 55 kt katabatic winds with peak gusts exceeding 78 kts across Larsemann Hills and ice-shelf margins. Visual flight operations suspended.',
    location: 'Bharati Station (Larsemann Hills coastal shelf)',
    severity: 'HIGH',
    status: 'OPEN',
    actionsTaken: [
      'Moored outdoor equipment tied down with steel cable bridles',
      'Helicopter flight operations restricted pending wind drop below 40 kts',
      'Automatic genset load-shedding engaged for non-essential labs'
    ],
    openedAt: '2026-11-14T19:30:00.000Z',
    reportedBy: 'Station Meteorologist',
    linkedEntities: []
  });

  await IncidentModel.create({
    incidentCode: 'INC-2026-02',
    title: 'Customs Lithium Battery Transit Embargo on CRT-1118',
    description: 'South African customs authorities placed a formal regulatory hold on Crate CRT-1118 at Cape Town Air Freight Consolidation Terminal due to missing UN 38.3 test certification and hazardous battery airway bill.',
    location: 'Cape Town Air Cargo Logistics Hub',
    severity: 'MEDIUM',
    status: 'INVESTIGATING',
    actionsTaken: [
      'Contacted battery manufacturer in Bengaluru for emergency re-issuance of UN 38.3 testing compliance dossier',
      'Requested Cape Town logistics liaison to file special scientific dangerous goods dispensation with DFFE'
    ],
    openedAt: '2026-11-10T11:00:00.000Z',
    reportedBy: 'Cape Town Transit Officer',
    linkedEntities: [
      { type: 'CRATE', id: crt1118._id.toString() },
      { type: 'MISSION', id: misB._id.toString() }
    ]
  });

  console.log('[Seed] World initialization complete.');

  return {
    expeditionId: expedition._id.toString(),
    counts: {
      transports: 6,
      inventory: 6,
      assets: 8,
      people: await PersonModel.countDocuments(),
      crates: await CrateModel.countDocuments(),
      missions: 5,
      incidents: 2
    }
  };
}
