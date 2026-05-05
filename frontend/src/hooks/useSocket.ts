import { useEffect, useRef, useState, useCallback } from 'react';
import { io, type Socket } from 'socket.io-client';
import { api, type DashboardData, type HealthData, type Incident } from '@/lib/api';

// ─── Socket.IO Hook ─────────────────────────────────────────────────────────

export function useSocket() {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    const socketUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001';
    const s = io(socketUrl, {
      transports: ['websocket', 'polling'],
    });

    setSocket(s);

    s.on('connect', () => setConnected(true));
    s.on('disconnect', () => setConnected(false));

    return () => {
      s.disconnect();
      setSocket(null);
    };
  }, []);

  return { socket, connected };
}

// ─── Dashboard Hook ─────────────────────────────────────────────────────────

export function useDashboard(pollInterval = 5000) {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { socket } = useSocket();

  const refresh = useCallback(async () => {
    try {
      const dashboard = await api.getDashboard();
      setData(dashboard);
      setError(null);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
    const interval = setInterval(refresh, pollInterval);
    return () => clearInterval(interval);
  }, [refresh, pollInterval]);

  // Listen for real-time updates
  useEffect(() => {
    if (!socket) return;

    const handler = () => {
      refresh();
    };

    socket.on('incident:updated', handler);
    socket.on('incident:rca', handler);

    return () => {
      socket.off('incident:updated', handler);
      socket.off('incident:rca', handler);
    };
  }, [socket, refresh]);

  return { data, loading, error, refresh };
}

// ─── Health Hook ─────────────────────────────────────────────────────────────

export function useHealth(pollInterval = 10000) {
  const [data, setData] = useState<HealthData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetch = async () => {
      try {
        const health = await api.getHealth();
        setData(health);
        setError(null);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetch();
    const interval = setInterval(fetch, pollInterval);
    return () => clearInterval(interval);
  }, [pollInterval]);

  return { data, loading, error };
}

// ─── Real-time Metrics Hook ─────────────────────────────────────────────────

/** Generate seed data points so the graph is always visible on first load */
function generateSeedMetrics(count = 10): any[] {
  const now = Date.now();
  return Array.from({ length: count }, (_, i) => {
    const t = new Date(now - (count - 1 - i) * 3000);
    // Small random baseline values to look like an idle system
    return {
      signalsPerSecond: Math.floor(Math.random() * 3),
      activeIncidents: 0,
      totalSignalsProcessed: 0,
      bufferUsage: +(Math.random() * 0.05).toFixed(2),
      timestamp: t.toLocaleTimeString(undefined, { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      _seed: true,
    };
  });
}

export function useMetrics() {
  // Start with seed data so the chart renders immediately
  const [metrics, setMetrics] = useState<any[]>(() => generateSeedMetrics(10));
  const { socket } = useSocket();

  // Replace seed with historical data from the API on mount
  // If we get DB snapshots, use them; otherwise seed stays and real data appends
  useEffect(() => {
    let cancelled = false;

    api.getMetrics(60).then(res => {
      if (cancelled) return;
      if (res.metrics && res.metrics.length > 1) {
        // We have enough historical data — swap in fully
        const formatted = res.metrics.map((m: any) => ({
          ...m,
          timestamp: new Date(m.timestamp).toLocaleTimeString(undefined, { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' }),
        }));
        setMetrics(formatted);
      }
    }).catch(() => { /* ignore seed failure */ });

    return () => { cancelled = true; };
  }, []);

  // Listen for Socket.IO metrics events — just append, never strip
  useEffect(() => {
    if (!socket) return;

    const handler = (data: any) => {
      setMetrics(prev => {
        const point = {
          ...data,
          timestamp: new Date(data.timestamp || Date.now()).toLocaleTimeString(undefined, { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' }),
        };
        return [...prev, point].slice(-60);
      });
    };

    socket.on('metrics', handler);
    return () => { socket.off('metrics', handler); };
  }, [socket]);

  // Poll /health every 2s to generate live data points continuously
  useEffect(() => {
    const poll = async () => {
      try {
        const health = await api.getHealth();
        if (health) {
          setMetrics(prev => {
            const point = {
              signalsPerSecond: health.metrics?.signalsPerSecond ?? 0,
              activeIncidents: health.metrics?.activeIncidents ?? 0,
              totalSignalsProcessed: health.metrics?.totalSignalsProcessed ?? 0,
              bufferUsage: health.buffer.usagePercent,
              timestamp: new Date().toLocaleTimeString(undefined, { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' }),
            };
            // Don't add duplicate if the last timestamp matches
            if (prev.length > 0 && prev[prev.length - 1].timestamp === point.timestamp) return prev;
            return [...prev, point].slice(-60);
          });
        }
      } catch { /* ignore */ }
    };

    // Fire immediately, then every 2s
    poll();
    const interval = setInterval(poll, 2000);
    return () => clearInterval(interval);
  }, []);

  return metrics;
}
