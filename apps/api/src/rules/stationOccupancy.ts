import { Person, Transport, Station } from '@polar-ops/shared';
import { getEffectiveArrival, getEffectiveDeparture } from './crateEta';

export interface DailyOccupancy {
  date: string; // YYYY-MM-DD
  headcount: number;
  bedCapacity: number;
  isOverbooked: boolean;
  overbookedBy: number;
  peopleNames?: string[];
}

export const STATION_BED_CAPACITIES: Record<string, number> = {
  BHARATI: 47,
  MAITRI: 65,
  HIMADRI: 25,
  CAPE_TOWN: 100,
  GOA_HQ: 500
};

export function stationOccupancy(
  people: Array<Partial<Person> & { id?: string; _id?: any }>,
  transportsById: Record<string, Partial<Transport> | any>,
  station: Station | string,
  fromDate: Date = new Date('2026-11-15T00:00:00.000Z'),
  toDate: Date = new Date('2027-01-15T00:00:00.000Z')
): DailyOccupancy[] {
  const bedCapacity = STATION_BED_CAPACITIES[station] || 50;

  // Pre-calculate presence intervals for each person
  const intervals: Array<{ name: string; startMs: number; endMs: number }> = [];

  for (const p of people) {
    let startMs: number | null = null;
    let endMs: number = Number.POSITIVE_INFINITY;

    // Check if already at station
    if (p.currentLocation === station) {
      startMs = fromDate.getTime() - 86400000; // already present
    }

    // Check inbound transport
    if (p.inboundTransportId && p.destinationLocation === station) {
      const transport = transportsById[p.inboundTransportId];
      if (transport && transport.schedule) {
        const stop = transport.schedule.find((s: any) => s.stopNumber === p.inboundUnloadStop);
        if (stop) {
          // If portOrStation matches station or is the inbound stop to station
          const arr = getEffectiveArrival(stop);
          if (arr) {
            const arrMs = new Date(arr).getTime();
            // If they weren't already at station, this is their arrival
            if (startMs === null) {
              startMs = arrMs;
            }
          }
        }
      }
    }

    // Check outbound transport
    if (p.outboundTransportId) {
      const transport = transportsById[p.outboundTransportId];
      if (transport && transport.schedule) {
        const stop = transport.schedule.find((s: any) => s.stopNumber === p.outboundLoadStop);
        if (stop) {
          const dep = getEffectiveDeparture(stop);
          if (dep) {
            endMs = new Date(dep).getTime();
          }
        }
      }
    }

    if (startMs !== null) {
      intervals.push({
        name: p.name || 'Unknown Person',
        startMs,
        endMs
      });
    }
  }

  // Iterate daily from fromDate to toDate
  const results: DailyOccupancy[] = [];
  const current = new Date(fromDate);
  current.setUTCHours(12, 0, 0, 0);

  const endLimit = new Date(toDate).getTime();

  while (current.getTime() <= endLimit) {
    const dayMs = current.getTime();
    const dateStr = current.toISOString().split('T')[0];

    const presentPeople = intervals.filter(i => dayMs >= i.startMs && dayMs <= i.endMs);
    const headcount = presentPeople.length;
    const isOverbooked = headcount > bedCapacity;
    const overbookedBy = Math.max(0, headcount - bedCapacity);

    results.push({
      date: dateStr,
      headcount,
      bedCapacity,
      isOverbooked,
      overbookedBy,
      peopleNames: presentPeople.map(p => p.name)
    });

    // Advance 1 day
    current.setTime(current.getTime() + 86400000);
  }

  return results;
}
