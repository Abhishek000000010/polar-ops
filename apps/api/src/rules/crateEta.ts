import { Crate, Transport } from '@polar-ops/shared';

export interface CrateEtaResult {
  etaDate: string | null;
  missedConnection: boolean;
  effectiveArrivalDate: string | null;
}

export function getEffectiveArrival(stop?: { actualArrival?: string; estimatedArrival?: string; scheduledArrival: string }): string | null {
  if (!stop) return null;
  return stop.actualArrival || stop.estimatedArrival || stop.scheduledArrival || null;
}

export function getEffectiveDeparture(stop?: { actualDeparture?: string; estimatedDeparture?: string; scheduledDeparture: string }): string | null {
  if (!stop) return null;
  return stop.actualDeparture || stop.estimatedDeparture || stop.scheduledDeparture || null;
}

export function crateEta(
  crate: Partial<Crate> & {
    carrierTransportId?: string;
    carrierLoadStop?: number;
    carrierUnloadStop?: number;
    handlingDays?: number;
    loadedOnCarrier?: boolean;
  },
  transportsById: Record<string, Partial<Transport> | any>,
  now: Date = new Date('2026-11-15T08:00:00.000Z')
): CrateEtaResult {
  if (!crate.carrierTransportId) {
    return { etaDate: null, missedConnection: false, effectiveArrivalDate: null };
  }

  const transport = transportsById[crate.carrierTransportId];
  if (!transport || !transport.schedule) {
    return { etaDate: null, missedConnection: false, effectiveArrivalDate: null };
  }

  const loadStop = transport.schedule.find((s: any) => s.stopNumber === crate.carrierLoadStop);
  const unloadStop = transport.schedule.find((s: any) => s.stopNumber === crate.carrierUnloadStop);

  let missedConnection = false;
  if (loadStop && !crate.loadedOnCarrier) {
    const depTime = getEffectiveDeparture(loadStop);
    if (depTime && new Date(depTime).getTime() < now.getTime()) {
      missedConnection = true;
    }
  }

  if (!unloadStop) {
    return { etaDate: null, missedConnection, effectiveArrivalDate: null };
  }

  const arrivalTime = getEffectiveArrival(unloadStop);
  if (!arrivalTime) {
    return { etaDate: null, missedConnection, effectiveArrivalDate: null };
  }

  const handlingDays = crate.handlingDays ?? 1;
  const arrDate = new Date(arrivalTime);
  const etaDate = new Date(arrDate.getTime() + handlingDays * 86400000).toISOString();

  return {
    etaDate,
    missedConnection,
    effectiveArrivalDate: arrDate.toISOString()
  };
}
