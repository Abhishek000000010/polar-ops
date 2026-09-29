import { IScenarioPreset } from './types';

const SHIP = 'MV Vasily Golovnin';

export const SCENARIO_PRESETS: IScenarioPreset[] = [
  {
    id: 'ship-delay-5',
    name: 'Ship held 5 days by pack ice',
    tag: 'Transport',
    question: 'What if the ship reaches Bharati 5 days late?',
    description: 'MV Vasily Golovnin is slowed by pack ice in Prydz Bay. Every later stop (Bharati, Maitri, Cape Town) moves by 5 days.',
    scenarioInput: {
      name: 'Ship held 5 days by pack ice',
      transportDelays: [{ transportId: SHIP, fromStop: 2, delayDays: 5, reason: 'Pack ice in Prydz Bay' }]
    }
  },
  {
    id: 'ship-delay-8',
    name: 'Ship held 8 days',
    tag: 'Transport',
    question: 'At what point does the ship delay run the stations short of fuel?',
    description: 'A longer 8-day hold. Compare with the 5-day case: this is where fuel resupply arrives after stock falls below the safety minimum.',
    scenarioInput: {
      name: 'Ship held 8 days',
      transportDelays: [{ transportId: SHIP, fromStop: 2, delayDays: 8, reason: 'Extended pack-ice hold in Prydz Bay' }]
    }
  },
  {
    id: 'blizzard-bharati',
    name: '10-day blizzard at Bharati',
    tag: 'Weather',
    question: 'What does a long blizzard do to Bharati on its own?',
    description: 'Heating and power fuel use at Bharati rises 35% for 10 days. The ship is on time.',
    scenarioInput: {
      name: '10-day blizzard at Bharati',
      weather: [{ station: 'BHARATI', fuelBurnMultiplier: 1.35, durationDays: 10, label: 'Blizzard' }]
    }
  },
  {
    id: 'blizzard-plus-ship',
    name: 'Blizzard + 5-day ship delay',
    tag: 'Compound',
    question: 'Two manageable problems at once: are they still manageable?',
    description: 'The 10-day Bharati blizzard and the 5-day ship delay together. Neither alone breaches the fuel minimum; combined, they can.',
    scenarioInput: {
      name: 'Blizzard + 5-day ship delay',
      weather: [{ station: 'BHARATI', fuelBurnMultiplier: 1.35, durationDays: 10, label: 'Blizzard' }],
      transportDelays: [{ transportId: SHIP, fromStop: 2, delayDays: 5, reason: 'Pack ice in Prydz Bay' }]
    }
  },
  {
    id: 'snowcat-down',
    name: 'Snowcat PB-300-04 out for 3 weeks',
    tag: 'Asset',
    question: 'What if the ice-core mission loses its snowcat?',
    description: 'PB-300-04 suffers a hydraulic failure and is out of service for 21 days, overlapping the start of the ice-core mission.',
    scenarioInput: {
      name: 'Snowcat PB-300-04 out for 3 weeks',
      assetFailures: [{ assetId: 'PB-300-04', outageDays: 21, reason: 'Hydraulic pump failure' }]
    }
  },
  {
    id: 'generator-down',
    name: 'Main generator GEN-BHARATI-01 fails',
    tag: 'Asset',
    question: 'How much backup power does Bharati really have?',
    description: 'The primary station generator fails for 10 days. Shows which backup generator carries the load and whether spare parts cover it.',
    scenarioInput: {
      name: 'Main generator GEN-BHARATI-01 fails',
      assetFailures: [{ assetId: 'GEN-BHARATI-01', outageDays: 10, reason: 'Fuel-injection pump seizure' }]
    }
  },
  {
    id: 'engineer-unavailable',
    name: 'Chief engineer unavailable',
    tag: 'Personnel',
    question: 'What if a key person cannot join?',
    description: 'Gurpreet Singh (Chief Station Engineer) cannot take part. Shows the missions that lose him and whether his standby can realistically step in.',
    scenarioInput: {
      name: 'Chief engineer unavailable',
      personnelUnavailable: [{ personId: 'Gurpreet Singh', reason: 'Medical evacuation' }]
    }
  },
  {
    id: 'field-party-shelter',
    name: 'Field party of 6 sheltering at Bharati',
    tag: 'Headcount',
    question: 'What if unplanned people need beds and fuel?',
    description: 'A 6-person field party sheltering from weather stays at Bharati for 14 days. Adds to bed demand and fuel use.',
    scenarioInput: {
      name: 'Field party of 6 sheltering at Bharati',
      extraPeople: [{ station: 'BHARATI', count: 6, durationDays: 14, reason: 'Field party sheltering from weather' }]
    }
  }
];
