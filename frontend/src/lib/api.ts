const API_BASE = import.meta.env.VITE_API_URL || '';

export interface Incident {
  id: string;
  componentId: string;
  status: string;
  severity: string;
  startTime: string;
  endTime: string | null;
  mttrSeconds: number | null;
  windowStart: string;
  signalCount: number;
  createdAt: string;
  updatedAt: string;
  allowedTransitions: string[];
  age: number;
}

export interface Signal {
  id: string;
  workItemId: string;
  componentId: string;
  errorType: string;
  severity: string;
  rawPayload: any;
  timestamp: string;
}

export interface RCA {
  id: string;
  workItemId: string;
  rootCauseCategory: string;
  fixApplied: string;
  preventionSteps: string;
  submittedAt: string;
}

export interface DashboardData {
  incidents: Incident[];
  counts: {
    total: number;
    open: number;
    investigating: number;
    resolved: number;
    closed: number;
    p0: number;
    p1: number;
    p2: number;
  };
  avgMttr: number | null;
  timestamp: string;
}

export interface HealthData {
  status: string;
  uptime: number;
  timestamp: string;
  buffer: {
    size: number;
    capacity: number;
    usagePercent: number;
    totalPushed: number;
    totalDropped: number;
  };
  database: {
    status: string;
    latencyMs: number;
  };
  metrics: {
    signalsPerSecond: number;
    activeIncidents: number;
    totalSignalsProcessed: number;
  } | null;
}

export interface MetricsSnapshot {
  id: string;
  signalsPerSecond: number;
  bufferUsage: number;
  bufferCapacity: number;
  activeIncidents: number;
  totalSignalsProcessed: number;
  timestamp: string;
}

async function fetchJSON<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${url}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(error.error || `HTTP ${res.status}`);
  }
  return res.json();
}

export const api = {
  // Dashboard
  getDashboard: () => fetchJSON<DashboardData>('/api/dashboard'),

  // Incidents
  getIncidents: (page = 1, limit = 50) =>
    fetchJSON<{ incidents: Incident[]; pagination: any }>(`/api/incidents?page=${page}&limit=${limit}`),

  getIncident: (id: string) =>
    fetchJSON<{ incident: Incident; signals: Signal[]; rca: RCA | null; signalCount: number }>(`/api/incidents/${id}`),

  transitionIncident: (id: string, next: string) =>
    fetchJSON<{ success: boolean; incident: Incident }>(`/api/incidents/${id}/transition`, {
      method: 'POST',
      body: JSON.stringify({ next }),
    }),

  submitRCA: (id: string, data: { root_cause_category: string; fix_applied: string; prevention_steps: string }) =>
    fetchJSON<{ success: boolean; rca: RCA }>(`/api/incidents/${id}/rca`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  // Health
  getHealth: () => fetchJSON<HealthData>('/health'),

  // Metrics
  getMetrics: (limit = 100) => fetchJSON<{ metrics: MetricsSnapshot[] }>(`/api/metrics?limit=${limit}`),

  // Signal ingestion (for testing from UI)
  sendSignal: (signal: { component_id: string; error_type: string; severity: string; metadata?: any }) =>
    fetchJSON<any>('/api/signals', {
      method: 'POST',
      body: JSON.stringify(signal),
    }),
};
