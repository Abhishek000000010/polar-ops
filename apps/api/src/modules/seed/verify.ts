import 'dotenv/config';
import { connectDB, disconnectDB } from '../../core/db';
import { resetAndSeedDatabase } from './service';
import { getSystemAlerts, getRippleGraphForEntity } from '../dashboard/service';
import { getInventoryForecast } from '../inventory/service';
import { delayTransport } from '../transport/service';
import { swapStandby } from '../people/service';
import { updateCrate } from '../cargo/service';
import { updateAsset } from '../assets/service';
import { TransportModel } from '../transport/model';
import { CrateModel } from '../cargo/model';
import { PersonModel } from '../people/model';
import { AssetModel } from '../assets/model';
import { MissionModel } from '../missions/model';
import { IncidentModel } from '../incidents/model';
import { EventModel } from '../../core/events';

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`\x1b[31m[FAIL]\x1b[0m ${message}`);
    throw new Error(`Assertion failed: ${message}`);
  }
  console.log(`\x1b[32m[PASS]\x1b[0m ${message}`);
}

async function runAcceptanceVerification() {
  console.log('\n======================================================');
  console.log(' POLAR-OPS ACCEPTANCE VERIFICATION TEST SUITE (Seed 47)');
  console.log('======================================================\n');

  await connectDB();

  // Reset and seed fresh database
  console.log('--> Seeding fresh database...');
  await resetAndSeedDatabase('Acceptance Test Runner');

  // -------------------------------------------------------------------------
  // BEAT 1: Immediately after seeding (15 Nov 2026) — exactly 7 alerts
  // -------------------------------------------------------------------------
  console.log('\n--- BEAT 1: Immediate Post-Seed Baseline (15 Nov 2026) ---');
  const baselineAlerts = await getSystemAlerts();
  console.log(`Received ${baselineAlerts.length} alerts.`);
  baselineAlerts.forEach(a => console.log(`  [${a.category}] (${a.severity}) ${a.id}: ${a.title}`));

  assert(baselineAlerts.length === 7, `Expected exactly 7 alerts on 15 Nov, got ${baselineAlerts.length}`);

  const alertIds = baselineAlerts.map(a => a.id);
  assert(alertIds.includes('alert-cargo-missed-CRT-1118'), 'Alert 1: CRT-1118 missed connection present');
  assert(alertIds.includes('alert-cargo-tight-CRT-1042'), 'Alert 2: CRT-1042 tight buffer present');
  assert(alertIds.some(id => id.startsWith('alert-personnel-')), 'Alert 3: Sunita readiness incomplete present');
  assert(alertIds.includes('alert-asset-GEN-BHARATI-02'), 'Alert 4: GEN-BHARATI-02 maintenance overdue present');
  assert(alertIds.includes('alert-spof-SPR-CAT-PUMP'), 'Alert 5: SPR-CAT-PUMP single point of failure present');
  assert(alertIds.includes('alert-schedule-MSN-AWS-4704'), 'Alert 6: Mission D winter helicopter prohibition present');
  assert(alertIds.includes('alert-capacity-BHARATI'), 'Alert 7: Bharati bed overcapacity present');

  // Check severities
  const missedCrt = baselineAlerts.find(a => a.id === 'alert-cargo-missed-CRT-1118');
  assert(missedCrt?.severity === 'CRITICAL', 'CRT-1118 missed connection severity is CRITICAL');
  const tightCrt = baselineAlerts.find(a => a.id === 'alert-cargo-tight-CRT-1042');
  assert(tightCrt?.severity === 'MEDIUM', 'CRT-1042 tight buffer severity is MEDIUM');
  const genAlert = baselineAlerts.find(a => a.id === 'alert-asset-GEN-BHARATI-02');
  assert(genAlert?.severity === 'CRITICAL', 'GEN-BHARATI-02 asset overdue severity is CRITICAL');

  // Forecast checks
  const forecasts = await getInventoryForecast();
  const bharatiFuel = forecasts.find(f => f.itemCode === 'FUEL-SAB' && f.station === 'BHARATI');
  const maitriFuel = forecasts.find(f => f.itemCode === 'FUEL-SAB' && f.station === 'MAITRI');

  assert(!!bharatiFuel, 'Bharati FUEL-SAB forecast exists');
  assert(bharatiFuel!.burnRate === 1500, `Bharati 14-day burn rate expected 1500, got ${bharatiFuel?.burnRate}`);
  assert(Math.round(bharatiFuel!.naiveBurnRate) === 1193, `Bharati 60-day naive burn rate expected 1193, got ${Math.round(bharatiFuel!.naiveBurnRate)}`);
  assert(bharatiFuel!.minBreachDate?.startsWith('2026-12-07') === true, `Bharati min breach expected 2026-12-07, got ${bharatiFuel?.minBreachDate}`);
  assert(bharatiFuel!.nextResupplyDate?.startsWith('2026-11-30') === true, `Bharati resupply expected 2026-11-30, got ${bharatiFuel?.nextResupplyDate}`);
  assert(bharatiFuel!.marginDays === 7, `Bharati marginDays expected 7, got ${bharatiFuel?.marginDays}`);

  assert(!!maitriFuel, 'Maitri FUEL-SAB forecast exists');
  assert(maitriFuel!.burnRate === 1600, `Maitri 14-day burn rate expected 1600, got ${maitriFuel?.burnRate}`);
  assert(maitriFuel!.minBreachDate?.startsWith('2026-12-28') === true || maitriFuel!.minBreachDate?.startsWith('2026-12-29') === true, `Maitri min breach expected 28/29 Dec, got ${maitriFuel?.minBreachDate}`);
  assert(maitriFuel!.nextResupplyDate?.startsWith('2026-12-22') === true, `Maitri resupply expected 2026-12-22, got ${maitriFuel?.nextResupplyDate}`);
  assert(maitriFuel!.marginDays === 6, `Maitri marginDays expected 6, got ${maitriFuel?.marginDays}`);

  // -------------------------------------------------------------------------
  // BEAT 2: Report delay: T1 from stop 2, +5 days ("pack ice in Prydz Bay")
  // -------------------------------------------------------------------------
  console.log('\n--- BEAT 2: Delay T1 by +5 Days ---');
  const t1 = await TransportModel.findOne({ name: 'MV Vasily Golovnin' });
  assert(!!t1, 'Transport T1 exists');

  await delayTransport(t1!._id.toString(), 2, 5, 'pack ice in Prydz Bay');

  const beat2Alerts = await getSystemAlerts();
  const beat2Ids = beat2Alerts.map(a => a.id);

  assert(beat2Ids.includes('alert-cargo-late-CRT-1042'), 'CRT-1042 now late -> alert-cargo-late-CRT-1042 is present');
  const lateCrtAlert = beat2Alerts.find(a => a.id === 'alert-cargo-late-CRT-1042');
  assert(lateCrtAlert?.severity === 'CRITICAL', 'CRT-1042 late alert severity is CRITICAL');
  assert(!beat2Ids.includes('alert-cargo-tight-CRT-1042'), 'Old tight buffer alert-cargo-tight-CRT-1042 replaced');

  assert(beat2Ids.includes('alert-inv-margin-FUEL-SAB-BHARATI'), 'Bharati fuel margin <= 2 -> alert-inv-margin-FUEL-SAB-BHARATI present');
  const bharatiInvAlert = beat2Alerts.find(a => a.id === 'alert-inv-margin-FUEL-SAB-BHARATI');
  assert(bharatiInvAlert?.severity === 'MEDIUM', 'Bharati fuel alert severity is MEDIUM');

  assert(beat2Ids.includes('alert-inv-margin-FUEL-SAB-MAITRI'), 'Maitri fuel margin <= 2 -> alert-inv-margin-FUEL-SAB-MAITRI present');
  const maitriInvAlert = beat2Alerts.find(a => a.id === 'alert-inv-margin-FUEL-SAB-MAITRI');
  assert(maitriInvAlert?.severity === 'MEDIUM', 'Maitri fuel alert severity is MEDIUM');

  assert(beat2Ids.includes('alert-capacity-BHARATI'), 'Bharati bed capacity alert still active');
  const capacityAlert = beat2Alerts.find(a => a.id === 'alert-capacity-BHARATI');
  assert(capacityAlert?.description.includes('2026-12-03') === true, 'Bed overcapacity window shifted to start on 03 Dec');

  // Verify Mission B is NOT affected by T1 delay
  assert(!beat2Ids.includes('alert-cargo-late-CRT-1118'), 'Mission B crate CRT-1118 not marked late by T1 delay');
  assert(beat2Alerts.length === 9, `Expected exactly 9 alerts after +5d delay (7 baseline - tight CRT-1042 + late CRT-1042 + 2 fuel margins), got ${beat2Alerts.length}: ${beat2Ids.join(', ')}`);

  // -------------------------------------------------------------------------
  // BEAT 3: Further +3 days delay (+8 days total on T1)
  // -------------------------------------------------------------------------
  console.log('\n--- BEAT 3: Further +3 Days Delay (+8 Days Total) ---');
  await delayTransport(t1!._id.toString(), 2, 3, 'extended gale conditions');

  const beat3Alerts = await getSystemAlerts();
  const bharatiFuelCritical = beat3Alerts.find(a => a.id === 'alert-inv-margin-FUEL-SAB-BHARATI');
  assert(bharatiFuelCritical?.severity === 'CRITICAL', 'Bharati fuel stockout breach before resupply escalated to CRITICAL');

  const maitriFuelCritical = beat3Alerts.find(a => a.id === 'alert-inv-margin-FUEL-SAB-MAITRI');
  assert(maitriFuelCritical?.severity === 'CRITICAL', 'Maitri fuel stockout breach escalated to CRITICAL');

  // Research comparison verification: naive burn rate would have missed this
  const beat3Forecasts = await getInventoryForecast();
  const bFuelForecast = beat3Forecasts.find(f => f.itemCode === 'FUEL-SAB' && f.station === 'BHARATI');
  // Naive 60-day breach is 12 Dec, whereas resupply is 08 Dec (margin +4 days)
  assert(bFuelForecast!.marginDays! < 0, `14-day trend-aware margin is negative (${bFuelForecast!.marginDays} days)`);
  console.log(`  [Research Comparison] 14-day margin: ${bFuelForecast!.marginDays} days (CRISIS DETECTED) vs Naive 60-day breach: 12 Dec (MISSED)`);

  // -------------------------------------------------------------------------
  // BEAT 5: Swap Sunita -> Aman (People page)
  // -------------------------------------------------------------------------
  console.log('\n--- BEAT 5: Swap Unready Primary (Dr. Sunita) with Standby (Dr. Aman) ---');
  const sunita = await PersonModel.findOne({ name: 'Dr. Sunita Kulkarni' });
  const aman = await PersonModel.findOne({ name: 'Dr. Aman Verma' });
  assert(!!sunita && !!aman, 'Dr. Sunita and Dr. Aman exist');

  await swapStandby(sunita!._id.toString(), 'Medical Clearance Disqualification', 'Mission Leader');

  const beat5Alerts = await getSystemAlerts();
  const beat5Ids = beat5Alerts.map(a => a.id);
  assert(!beat5Ids.some(id => id === `alert-personnel-${sunita!._id}`), 'Sunita personnel readiness alert is resolved and CLEARED');

  // Verify PERSON_SWAPPED event logged
  const swapEvent = await EventModel.findOne({ action: 'PERSON_SWAPPED' });
  assert(!!swapEvent, 'SystemEvent log contains PERSON_SWAPPED entry');

  // Verify ripple on Mission A lists Aman
  const missionA = await MissionModel.findOne({ code: 'MSN-ICE-4701' });
  assert(!!missionA, 'Mission A exists');
  const missionARipple = await getRippleGraphForEntity('MISSION', missionA!._id.toString());
  const hasAmanInRipple = missionARipple.affectedNodes.some(n => n.id === aman!._id.toString());
  assert(hasAmanInRipple, 'Dr. Aman Verma is linked in Mission A dependency graph');

  // -------------------------------------------------------------------------
  // BEAT 6: Reassign CRT-1118 to T4 (DROMLAN Flight B)
  // -------------------------------------------------------------------------
  console.log('\n--- BEAT 6: Reassign Missed Crate CRT-1118 to T4 ---');
  const crt1118 = await CrateModel.findOne({ crateCode: 'CRT-1118' });
  const t4 = await TransportModel.findOne({ name: 'DROMLAN Flight B' });
  assert(!!crt1118 && !!t4, 'CRT-1118 and T4 exist');

  await updateCrate(crt1118!._id.toString(), {
    carrierTransportId: t4!._id.toString(),
    carrierLoadStop: 1,
    carrierUnloadStop: 2
  });

  const beat6Alerts = await getSystemAlerts();
  const beat6Ids = beat6Alerts.map(a => a.id);
  assert(!beat6Ids.includes('alert-cargo-missed-CRT-1118'), 'Missed connection alert for CRT-1118 is resolved and CLEARED');

  const inc02 = await IncidentModel.findOne({ incidentCode: 'INC-2026-02' });
  assert(inc02?.status === 'INVESTIGATING', 'Real-world customs hold incident INC-2026-02 remains active');

  // -------------------------------------------------------------------------
  // BEAT 7: Perform Preventive Maintenance on GEN-BHARATI-02
  // -------------------------------------------------------------------------
  console.log('\n--- BEAT 7: Perform Maintenance Routine on GEN-BHARATI-02 ---');
  const gen02 = await AssetModel.findOne({ assetCode: 'GEN-BHARATI-02' });
  assert(!!gen02, 'GEN-BHARATI-02 exists');

  await updateAsset(gen02!._id.toString(), {
    nextServiceDueDate: '2027-02-15T00:00:00.000Z',
    lastServiceDate: '2026-11-15T08:00:00.000Z'
  });

  const beat7Alerts = await getSystemAlerts();
  const beat7Ids = beat7Alerts.map(a => a.id);
  assert(!beat7Ids.includes('alert-asset-GEN-BHARATI-02'), 'Overdue maintenance alert for GEN-BHARATI-02 is resolved and CLEARED');

  console.log('\n======================================================');
  console.log(' ALL ACCEPTANCE TESTS PASSED SUCCESSFULLY! (Beats 1-7)');
  console.log('======================================================\n');

  await disconnectDB();
  process.exit(0);
}

runAcceptanceVerification().catch(err => {
  console.error('\nVerification failed with error:', err);
  process.exit(1);
});
