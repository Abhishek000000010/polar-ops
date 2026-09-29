import { ApiResponse } from '@polar-ops/shared';

export function getApiBase(): string {
  // If explicitly configured with non-localhost URL, use it
  if (process.env.NEXT_PUBLIC_API_URL && !process.env.NEXT_PUBLIC_API_URL.includes('localhost')) {
    return process.env.NEXT_PUBLIC_API_URL.replace(/\/+$/, '');
  }
  // When running in browser
  if (typeof window !== 'undefined') {
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
      return 'http://localhost:4000/api/v1';
    }
    // Deployed cloud production URL
    return 'https://polar-ops-api.onrender.com/api/v1';
  }
  // Server-side rendering
  if (process.env.API_URL) {
    const clean = process.env.API_URL.replace(/\/api\/v1\/?$/, '').replace(/\/+$/, '');
    return `${clean}/api/v1`;
  }
  return 'https://polar-ops-api.onrender.com/api/v1';
}

let authToken: string | null = null;

export function setToken(token: string | null) {
  authToken = token;
  if (typeof window !== 'undefined') {
    if (token) localStorage.setItem('polar_ops_token', token);
    else localStorage.removeItem('polar_ops_token');
  }
}

export function getToken(): string | null {
  if (authToken) return authToken;
  if (typeof window !== 'undefined') {
    return localStorage.getItem('polar_ops_token');
  }
  return null;
}

export async function apiFetch<T>(endpoint: string, options: RequestInit = {}): Promise<ApiResponse<T>> {
  const token = getToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> || {})
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const base = getApiBase();
  const url = endpoint.startsWith('http') ? endpoint : `${base}${endpoint}`;

  try {
    const res = await fetch(url, {
      ...options,
      headers
    });
    const json = await res.json();
    return json;
  } catch (err: any) {
    console.error(`API Fetch Error [${endpoint}]:`, err);
    return {
      data: null,
      error: { message: err.message || 'Network request failed', code: 'NETWORK_ERROR' }
    };
  }
}

// ==========================================
// API WRAPPERS
// ==========================================
export const api = {
  // Auth
  getDemoUsers: () => apiFetch<any[]>('/auth/demo-users'),
  login: (email: string) => apiFetch<{ token: string; user: any }>('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email })
  }),
  getMe: () => apiFetch<any>('/auth/me'),

  // Dashboard & Alerts
  getStats: () => apiFetch<any>('/dashboard/stats'),
  getAlerts: () => apiFetch<any[]>('/dashboard/alerts'),
  getEvents: (limit = 30) => apiFetch<any[]>(`/dashboard/events?limit=${limit}`),
  getRipple: (type: string, id: string) => apiFetch<any>(`/dashboard/ripple/${type}/${id}`),
  getOccupancy: (station = 'BHARATI', days = 60) => apiFetch<any>(`/dashboard/occupancy?station=${station}&days=${days}`),

  // Simulation Clock
  getClock: () => apiFetch<{ simulatedDate: string }>('/dashboard/clock'),
  setClock: (date: string) => apiFetch<{ simulatedDate: string }>('/dashboard/clock/set', {
    method: 'POST',
    body: JSON.stringify({ date })
  }),
  stepClock: (days: number) => apiFetch<{ simulatedDate: string }>('/dashboard/clock/step', {
    method: 'POST',
    body: JSON.stringify({ days })
  }),
  resetClock: () => apiFetch<{ simulatedDate: string }>('/dashboard/clock/reset', { method: 'POST' }),

  // Expeditions & Missions
  getExpeditions: () => apiFetch<any[]>('/expeditions'),
  createExpedition: (data: any) => apiFetch<any>('/expeditions', { method: 'POST', body: JSON.stringify(data) }),
  getMissions: (params: Record<string, string> = {}) => {
    const q = new URLSearchParams(params).toString();
    return apiFetch<any[]>(`/missions${q ? `?${q}` : ''}`);
  },
  createMission: (data: any) => apiFetch<any>('/missions', { method: 'POST', body: JSON.stringify(data) }),
  updateMission: (id: string, updates: any) => apiFetch<any>(`/missions/${id}`, { method: 'PATCH', body: JSON.stringify(updates) }),

  // People & Readiness
  getPeople: (params: Record<string, string> = {}) => {
    const q = new URLSearchParams(params).toString();
    return apiFetch<any[]>(`/people${q ? `?${q}` : ''}`);
  },
  createPerson: (data: any) => apiFetch<any>('/people', { method: 'POST', body: JSON.stringify(data) }),
  updateReadiness: (id: string, readiness: any) => apiFetch<any>(`/people/${id}/readiness`, { method: 'PATCH', body: JSON.stringify(readiness) }),
  swapStandby: (id: string, reason?: string) => apiFetch<any>(`/people/${id}/swap-standby`, { method: 'POST', body: JSON.stringify({ reason }) }),

  // Cargo & Crates
  getCrates: (params: Record<string, string> = {}) => {
    const q = new URLSearchParams(params).toString();
    return apiFetch<any[]>(`/cargo${q ? `?${q}` : ''}`);
  },
  createCrate: (data: any) => apiFetch<any>('/cargo', { method: 'POST', body: JSON.stringify(data) }),
  updateCrate: (id: string, updates: any) => apiFetch<any>(`/cargo/${id}`, { method: 'PATCH', body: JSON.stringify(updates) }),
  advanceCrate: (id: string) => apiFetch<any>(`/cargo/${id}/advance`, { method: 'POST' }),

  // Transport
  getTransport: (params: Record<string, string> = {}) => {
    const q = new URLSearchParams(params).toString();
    return apiFetch<any[]>(`/transport${q ? `?${q}` : ''}`);
  },
  createTransport: (data: any) => apiFetch<any>('/transport', { method: 'POST', body: JSON.stringify(data) }),
  delayTransport: (id: string, fromStop: number, days: number, reason: string) => apiFetch<any>(`/transport/${id}/delay`, {
    method: 'POST',
    body: JSON.stringify({ fromStop, days, reason })
  }),

  // Inventory
  getInventory: (params: Record<string, string> = {}) => {
    const q = new URLSearchParams(params).toString();
    return apiFetch<any[]>(`/inventory${q ? `?${q}` : ''}`);
  },
  createInventoryItem: (data: any) => apiFetch<any>('/inventory', { method: 'POST', body: JSON.stringify(data) }),
  recordTransaction: (itemId: string, data: any) => apiFetch<any>(`/inventory/${itemId}/transactions`, { method: 'POST', body: JSON.stringify(data) }),
  getTransactions: (itemId?: string) => apiFetch<any[]>(`/inventory/transactions${itemId ? `?itemId=${itemId}` : ''}`),
  getInventoryForecast: (burnMultiplier = 1) => apiFetch<any[]>(`/inventory/forecast?burnMultiplier=${burnMultiplier}`),

  // Assets
  getAssets: (params: Record<string, string> = {}) => {
    const q = new URLSearchParams(params).toString();
    return apiFetch<any[]>(`/assets${q ? `?${q}` : ''}`);
  },
  createAsset: (data: any) => apiFetch<any>('/assets', { method: 'POST', body: JSON.stringify(data) }),
  performMaintenance: (id: string, data: any) => apiFetch<any>(`/assets/${id}/maintenance`, { method: 'POST', body: JSON.stringify(data) }),

  // Incidents
  getIncidents: (params: Record<string, string> = {}) => {
    const q = new URLSearchParams(params).toString();
    return apiFetch<any[]>(`/incidents${q ? `?${q}` : ''}`);
  },
  createIncident: (data: any) => apiFetch<any>('/incidents', { method: 'POST', body: JSON.stringify(data) }),
  addIncidentAction: (id: string, actionText: string) => apiFetch<any>(`/incidents/${id}/actions`, { method: 'POST', body: JSON.stringify({ actionText }) }),
  closeIncident: (id: string, resolutionSummary?: string) => apiFetch<any>(`/incidents/${id}/close`, { method: 'POST', body: JSON.stringify({ resolutionSummary }) }),

  // What-If Scenarios
  getScenarioPresets: () => apiFetch<any[]>('/scenarios/presets'),
  simulateScenario: (scenario: any) => apiFetch<any>('/scenarios/simulate', {
    method: 'POST',
    body: JSON.stringify(scenario)
  }),

  // Dependency & blast-radius graph
  getBlastCatalog: () => apiFetch<any>('/blast/catalog'),
  getBlast: (type: string, id: string, depth = 5) => apiFetch<any>(`/blast/${type}/${id}?depth=${depth}`),

  // Offline field sync (store-and-forward)
  getSyncStatus: () => apiFetch<any>('/sync/status'),
  syncPush: (body: { nodeId: string; actions: any[]; batchSha256: string; compressedBytes?: number }) =>
    apiFetch<any>('/sync/push', { method: 'POST', body: JSON.stringify(body) }),
  setSyncLink: (nodeId: string, link: string, constellation?: string) =>
    apiFetch<any>('/sync/link', { method: 'POST', body: JSON.stringify({ nodeId, link, constellation }) }),
  resolveSyncConflict: (conflictId: string, choice: 'STATION' | 'HQ') =>
    apiFetch<any>(`/sync/conflicts/${conflictId}/resolve`, { method: 'POST', body: JSON.stringify({ choice }) }),
  prepareSyncDemo: (nodeId: string) => apiFetch<any>('/sync/demo/prepare', { method: 'POST', body: JSON.stringify({ nodeId }) }),
  resetSync: () => apiFetch<any>('/sync/reset', { method: 'POST' }),

  // Seed Reset
  resetDatabase: () => apiFetch<any>('/seed/reset', { method: 'POST' })
};
