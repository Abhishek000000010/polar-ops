# Polar-Ops // Integrated Polar Expedition Logistics & Asset Management System

**SIH Problem Statement:** 26062  
**Organization:** Ministry of Earth Sciences (MoES) / National Centre for Polar and Ocean Research (NCPOR)  
**Theme:** Smart Automation / Extreme Environment Logistics

---

## ❄️ Architecture

```text
polar-ops/
├─ apps/
│  ├─ web/            Next.js (App Router) + TailwindCSS + TanStack Query + Recharts
│  │   ├─ src/app/    dashboard, expeditions, missions, people, cargo, transport, inventory, assets, incidents, ripple
│  │   └─ src/components/charts/  FuelRunwayChart, WinterSupplyForecastChart, BedCapacityChart, AssetHealthChart
│  └─ api/            Express + TypeScript + Mongoose
│     └─ src/
│        ├─ modules/          expeditions, missions, people, cargo, transport, inventory, assets, incidents, dashboard, seed, auth
│        ├─ core/
│        │   ├─ events.ts     appendEvent() – audit history log
│        │   ├─ edges.ts      link() – dependency graph for Ripple Effect View
│        │   ├─ clock.ts      now() – simulation clock (temporal time-travel)
│        │   ├─ auth.ts       JWT + requireRole()
│        │   └─ db.ts         Mongoose connection with embedded MongoMemoryServer fallback
│        ├─ rules/            Pure functional rule engine
│        │   ├─ crateEta.ts             Effective arrivals, delays & missed connections
│        │   ├─ forecastInventory.ts    14-day trend-aware vs 60-day naive burn rates & stockout horizons
│        │   ├─ assetEffectiveStatus.ts Clock-derived maintenance due statuses
│        │   └─ stationOccupancy.ts     Daily station bed headcount vs certified berth limits
│        └─ seed/
│            ├─ service.ts    Deterministic Seed 47 generator (Mulberry32 PRNG + hand-crafted operational chains)
│            ├─ run.ts        CLI seed runner (`npm run seed`)
│            └─ verify.ts     Automated acceptance test suite (`npm run test:verify`)
├─ packages/shared/   Zod schemas + TypeScript types (shared between web and api)
└─ docker-compose.yml mongo + api + web
```

---

## ⚡ The Five Architectural Principles

1. **Every write goes through a service:** Saves to database and appends to the immutable audit event log (`appendEvent()`).
2. **Link things when you create them:** Resources are linked into the `edges` collection via `link()`, enabling the **Ripple Effect Dependency Engine**.
3. **Never call `new Date()` in business logic:** Always calls `now()` from `clock.ts` to allow temporal simulation and time-stepping.
4. **Store IDs, don't nest documents:** Missions reference `peopleIds`, `crateIds`, and `assetIds`.
5. **Validate with Zod in `@polar-ops/shared`:** Zero schema drift between frontend and backend.

---

## 🚀 Running Locally

```bash
# 1. Install all dependencies across workspaces
npm install

# 2. Start the API service (Port 4000)
npm run dev:api

# 3. Start the Web console (Port 3000)
npm run dev:web

# 4. Run the automated acceptance verification test suite
npm run --workspace=@polar-ops/api test:verify
```

Open `http://localhost:3000` to access the Polar Operations Console.

---

## 📋 Demo Presentation Script (Connected Cause-and-Effect Story)

Every feature in the system participates in one connected operational narrative. The simulation starts at **15 November 2026 08:00 UTC**.

### Baseline Alert State (Day 1 — 15 Nov 2026)
Immediately upon seeding, the system evaluates all pure operational rules and detects **exactly 7 alerts**:
1. **CARGO (CRITICAL):** CRT-1118 missed connection (DROMLAN Flight A departed Cape Town on 05 Nov without loading it).
2. **CARGO (MEDIUM):** CRT-1042 tight delivery buffer (ETA 29 Nov vs mission deadline 01 Dec = 2-day margin).
3. **PERSONNEL (HIGH):** Dr. Sunita Kulkarni lacks mandatory Medical Clearance & MoES Polar Permit for Mission A (Standby Dr. Aman Verma available).
4. **ASSET (CRITICAL):** GEN-BHARATI-02 preventive maintenance overdue since 10 Nov.
5. **SPOF (HIGH):** Only 1 CAT pump available for 2 critical gensets (2 arriving via CRT-1050 on vessel).
6. **SCHEDULE (CRITICAL):** Mission D plans helicopter air-support in April (winter flight prohibition).
7. **CAPACITY (MEDIUM):** Bharati Station headcount peaks at 50 persons between 28 Nov and 08 Dec (exceeds certified limit of 47 beds).

**Forecast Baseline:**
- **Bharati Fuel:** 14-day burn rate: 1,500 L/day (naive 60-day: 1,193 L/day). Stockout breach: 07 Dec, Resupply: 30 Nov, Safety margin: **7 days**.
- **Maitri Fuel:** 14-day burn rate: 1,600 L/day. Stockout breach: 28/29 Dec, Resupply: 22 Dec, Safety margin: **6 days**.

---

### Interactive Demo Beats

| # | Action | How to Execute | Operational Result & Ripple Cascade |
|---|---|---|---|
| **1** | **Ripple on Vessel T1** | Open Ripple page, select `MV Vasily Golovnin` | Shows cascading links: CRT-1042 → Mission A; CRT-1043 → Bharati Fuel → Gensets 01/02/Field-03 → Missions A, C; CRT-1050 → Spares Pump → Genset 02 → Mission C; 22 people → Missions A, C; Stop-3 cargo → Maitri. Mission B is unaffected. |
| **2** | **Report Ship Delay (+5d)** | On Transport page, click **Report Delay** on T1 Stop 2 for `+5 days` ("Pack ice in Prydz Bay") | Vessel arrives Bharati 03 Dec instead of 28 Nov. CRT-1042 ETA shifts to 04 Dec (3 days late) → **CARGO CRITICAL** (replaces Medium). Bharati fuel margin drops to 2 days → **INVENTORY MEDIUM**. Maitri fuel margin drops to 1 day → **INVENTORY MEDIUM**. Bed surge window shifts to 03–13 Dec. Mission B remains unaffected. |
| **3** | **Further Delay (+3d / +8d total)** | On Transport page, add another `+3 days` delay on T1 | Bharati fuel resupply moves to 08 Dec > breach 07 Dec → **INVENTORY CRITICAL**. Maitri resupply moves to 30 Dec > breach 29 Dec → **INVENTORY CRITICAL**. *Research Point:* The naive 60-day average (1,193 L/day) projected breach on 12 Dec, which would have completely missed this impending winter crisis! |
| **4** | **Blizzard Sensitivity Toggle** | On Dashboard Winter Supply Forecast, switch to **Blizzard Surge (×1.35)** | Under baseline, fuel burn surges by +35%. Bharati stockout breach accelerates to 01 Dec vs resupply 30 Nov → margin narrows to 1 day. Demonstrates weather sensitivity modeling. |
| **5** | **One-Click Standby Replacement** | On People page, click **Swap with Standby** on Dr. Sunita Kulkarni | Sunita's unready alert clears immediately; Dr. Aman Verma is assigned to Mission A; transit itinerary transfers; audit log records `PERSON_SWAPPED`. |
| **6** | **Reassign Missed Crate** | On Cargo page, click **Reassign Carrier** on CRT-1118, select `DROMLAN Flight B` (02 Dec) | Projected ETA updates to 03 Dec (before 08 Dec deadline) → Missed connection alert clears! Incident INC-2026-02 remains active as the real-world customs blocker. |
| **7** | **Perform Maintenance** | On Assets page, record routine service on `GEN-BHARATI-02` | `nextServiceDueDate` advances into 2027 → Asset Overdue alert clears automatically! |
| **8** | **Equipment Breakdown Ripple** | Create Incident "PB-300-04 hydraulic failure", mark asset `UNDER_REPAIR` | Mission A is flagged as affected in Ripple; alternative vehicle PB-300-05 is visible (borrowing it impacts Mission E). |
| **9** | **Step Clock (+14 days)** | Use header clock controls to step forward +14 days | Projected fuel stock drops according to daily consumption (anchored at last transaction timestamp); alerts re-evaluate against new temporal date. |
| **10** | **Reset World** | Call `POST /api/v1/seed/reset` or click **Reset DB** in developer controls | Entire operational database restores back to the exact 7 baseline alerts of Section C1. |

---

## What-If Simulator (`/simulator`)

Tries a change on an in-memory copy of today's plan and shows what it does. The live database is never written.

**How it works** (`apps/api/src/modules/scenarios/service.ts`)
1. Copy the world snapshot and apply the disruptions: transport delay (from a stop onward; embarked helicopters move with the ship), bad weather (extra fuel use at one station for N days), equipment failure (out of service for N days), person unavailable, extra people (beds + proportional fuel use).
2. Run the same pure rules as the live dashboard (`crateEta`, `forecastInventory`, `stationOccupancy`, `assetEffectiveStatus`, `evaluateAlertsOverWorld`) on both the baseline and the copy.
3. Compare them: per-mission reasons (new / changed / gone / unchanged), fuel margins, bed windows, warnings.
4. Build an **impact tree** that follows the real links: transport → crates → missions, transport → resupply → fuel → generators → missions, transport → people → missions, failed asset → missions + backups + shared spares.
5. Calculate **decision options** from the data (wait N days + crew clashes, re-book cargo if a carrier with capacity exists, use a backup asset and which mission loses it, standby travel with free seats, exact fuel-use cut, temporary berths). The operator decides; nothing is applied.

**Presets** (each answers one question): ship +5 days, ship +8 days, 10-day Bharati blizzard, blizzard + ship delay (compound: neither alone breaches the fuel minimum, together they do), snowcat PB-300-04 out 21 days, generator GEN-BHARATI-01 fails, chief engineer unavailable, field party of 6 sheltering.

| Preset | Key result on the seed world |
|---|---|
| Ship +5 | CRT-1042 3 days late → MSN-ICE-4701 at risk; fuel slack Bharati 7→2 days, Maitri 6→1; Mission B unaffected |
| Ship +8 | Bharati short by 1 day, Maitri short by 2 before resupply; MSN-INF-4703 and MSN-SNW-4705 also affected |
| Blizzard alone | Bharati slack 7→3 days (no breach) |
| Blizzard + ship +5 | Bharati short by 2 days → a 17% fuel-use cut is needed |
