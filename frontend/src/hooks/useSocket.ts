import { useEffect, useRef, useState, useCallback } from 'react';
import { io, type Socket } from 'socket.io-client';
import { api, type DashboardData, type HealthData, type Incident } from '@/lib/api';

// ─── Socket.IO Hook ─────────────────────────────────────────────────────────

export function useSocket() {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    const s = io('http://localhost:3001', {
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

export function useMetrics() {
  const [metrics, setMetrics] = useState<any[]>([]);
  const { socket } = useSocket();

  // Seed with historical data from the API on mount (safe to re-run on StrictMode remount)
  useEffect(() => {
    let cancelled = false;

    api.getMetrics(60).then(res => {
      if (cancelled) return;
      if (res.metrics && res.metrics.length > 0) {
        const formatted = res.metrics.map((m: any) => ({
          ...m,
          timestamp: new Date(m.timestamp).toLocaleTimeString(undefined, { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' }),
        }));
        setMetrics(formatted);
      }
    }).catch(() => { /* ignore seed failure */ });

    return () => { cancelled = true; };
  }, []);

  // Listen for Socket.IO metrics events
  useEffect(() => {
    if (!socket) return;

    const handler = (data: any) => {
      setMetrics(prev => {
        const point = {
          ...data,
          timestamp: new Date(data.timestamp || Date.now()).toLocaleTimeString(undefined, { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' }),
        };
        const next = [...prev, point];
        return next.slice(-60);
      });
    };

    socket.on('metrics', handler);
    return () => { socket.off('metrics', handler); };
  }, [socket]);

  // Fallback: poll /health every 3s to generate live data points even if socket is silent
  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const health = await api.getHealth();
        if (health?.metrics) {
          setMetrics(prev => {
            const point = {
              signalsPerSecond: health.metrics!.signalsPerSecond,
              activeIncidents: health.metrics!.activeIncidents,
              totalSignalsProcessed: health.metrics!.totalSignalsProcessed,
              bufferUsage: health.buffer.usagePercent,
              timestamp: new Date().toLocaleTimeString(undefined, { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' }),
            };
            // Don't add duplicate if the last timestamp matches
            if (prev.length > 0 && prev[prev.length - 1].timestamp === point.timestamp) return prev;
            const next = [...prev, point];
            return next.slice(-60);
          });
        }
      } catch { /* ignore */ }
    }, 3000);

    return () => clearInterval(interval);
  }, []);

  return metrics;
}
