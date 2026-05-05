import { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { Dashboard } from '@/components/Dashboard';
import { IncidentDetail } from '@/components/IncidentDetail';

type Tab = 'dashboard' | 'incidents' | 'metrics' | 'signals' | 'teams';

const mainLinks: { icon: string; label: string; id: Tab }[] = [
  { icon: 'dashboard', label: 'Dashboard', id: 'dashboard' },
  { icon: 'warning', label: 'Incidents', id: 'incidents' },
  { icon: 'leaderboard', label: 'Metrics', id: 'metrics' },
  { icon: 'analytics', label: 'Signals', id: 'signals' },
  { icon: 'group', label: 'Teams', id: 'teams' },
];

export default function App() {
  const [selectedIncident, setSelectedIncident] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>('dashboard');
  const [searchQuery, setSearchQuery] = useState('');
  const [showNotifications, setShowNotifications] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [showNewIncidentForm, setShowNewIncidentForm] = useState(false);
  const [showLogs, setShowLogs] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [showTerminal, setShowTerminal] = useState(false);

  const currentTab = selectedIncident ? 'incidents' : activeTab;

  const handleNavClick = (id: Tab) => {
    setActiveTab(id);
    setSelectedIncident(null);
    setShowNotifications(false);
    setShowSettings(false);
    setShowHelp(false);
    setShowNewIncidentForm(false);
    setShowLogs(false);
    setShowTerminal(false);
  };

  return (
    <div className="bg-surface text-on-surface min-h-screen antialiased">
      {/* ─── Top App Bar ──────────────────────────────────────── */}
      <header className="fixed top-0 w-full z-50 flex justify-between items-center px-6 h-16 bg-white/70 backdrop-blur-md border-b border-white/20 shadow-[4px_4px_10px_rgba(0,0,0,0.08),-4px_-4px_10px_rgba(255,255,255,0.8)] tracking-tight">
        <div className="flex items-center gap-4">
          <button className="md:hidden p-2 rounded-full hover:bg-surface-container cursor-pointer" onClick={() => setSidebarCollapsed(!sidebarCollapsed)}>
            <span className="material-symbols-outlined">menu</span>
          </button>
          <div className="text-xl font-bold tracking-tighter text-black uppercase cursor-pointer" onClick={() => handleNavClick('dashboard')}>
            SentinelIMS
          </div>
          <div className="relative ml-8 hidden md:block">
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant text-sm">search</span>
            <input
              type="text"
              placeholder="Search incidents, signals..."
              value={searchQuery}
              onChange={e => { setSearchQuery(e.target.value); if (e.target.value) { setActiveTab('incidents'); setSelectedIncident(null); } }}
              className="pl-10 pr-4 py-2 bg-surface-container-low border border-outline-variant rounded-full text-body-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary w-72 transition-all"
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-on-surface-variant hover:text-on-surface cursor-pointer">
                <span className="material-symbols-outlined text-sm">close</span>
              </button>
            )}
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowNewIncidentForm(true)}
            className="text-label-caps px-4 py-2 border border-outline rounded-full hover:bg-error-container hover:text-on-error-container hover:border-error transition-colors cursor-pointer hidden sm:flex items-center gap-1 active:scale-95"
          >
            <span className="material-symbols-outlined text-sm">campaign</span> Emergency Broadcast
          </button>

          {/* Notifications */}
          <div className="relative">
            <button onClick={() => { setShowNotifications(!showNotifications); setShowSettings(false); setShowHelp(false); }} className="p-2 rounded-full hover:bg-surface-container transition-all text-on-surface-variant cursor-pointer active:scale-95 relative">
              <span className="material-symbols-outlined">notifications</span>
              <span className="absolute top-1 right-1 w-2 h-2 bg-error rounded-full animate-pulse" />
            </button>
            {showNotifications && (
              <div className="absolute right-0 top-12 w-80 bg-white rounded-xl shadow-[8px_8px_20px_rgba(0,0,0,0.1)] border border-outline-variant/30 z-50 overflow-hidden animate-fade-in">
                <div className="p-4 border-b border-surface-container flex justify-between items-center">
                  <span className="text-body-sm font-semibold">Notifications</span>
                  <button onClick={() => setShowNotifications(false)} className="text-outline hover:text-on-surface cursor-pointer"><span className="material-symbols-outlined text-sm">close</span></button>
                </div>
                <div className="max-h-64 overflow-y-auto">
                  <div className="p-3 border-b border-surface-container hover:bg-surface-container-low transition-colors cursor-pointer">
                    <div className="flex items-center gap-2 mb-1"><span className="w-2 h-2 rounded-full bg-error" /><span className="text-label-caps text-error">P0 Alert</span><span className="text-[11px] text-outline ml-auto">2m ago</span></div>
                    <p className="text-body-sm">RDBMS_PRIMARY_01 — Connection Pool Exhaustion</p>
                  </div>
                  <div className="p-3 border-b border-surface-container hover:bg-surface-container-low transition-colors cursor-pointer">
                    <div className="flex items-center gap-2 mb-1"><span className="w-2 h-2 rounded-full bg-secondary" /><span className="text-label-caps text-secondary">P2 Notice</span><span className="text-[11px] text-outline ml-auto">8m ago</span></div>
                    <p className="text-body-sm">CACHE_CLUSTER_01 — Elevated cache miss rate</p>
                  </div>
                  <div className="p-3 hover:bg-surface-container-low transition-colors cursor-pointer">
                    <div className="flex items-center gap-2 mb-1"><span className="w-2 h-2 rounded-full bg-outline-variant" /><span className="text-label-caps text-outline">System</span><span className="text-[11px] text-outline ml-auto">15m ago</span></div>
                    <p className="text-body-sm">Auto-scaling group expanded (us-east-1a)</p>
                  </div>
                </div>
                <div className="p-3 border-t border-surface-container text-center">
                  <button className="text-label-caps text-primary hover:underline cursor-pointer" onClick={() => { setShowNotifications(false); handleNavClick('incidents'); }}>View All Incidents</button>
                </div>
              </div>
            )}
          </div>

          {/* Settings */}
          <div className="relative">
            <button onClick={() => { setShowSettings(!showSettings); setShowNotifications(false); setShowHelp(false); }} className="p-2 rounded-full hover:bg-surface-container transition-all text-on-surface-variant cursor-pointer active:scale-95">
              <span className="material-symbols-outlined">settings</span>
            </button>
            {showSettings && (
              <div className="absolute right-0 top-12 w-64 bg-white rounded-xl shadow-[8px_8px_20px_rgba(0,0,0,0.1)] border border-outline-variant/30 z-50 overflow-hidden animate-fade-in">
                <div className="p-4 border-b border-surface-container flex justify-between items-center">
                  <span className="text-body-sm font-semibold">Settings</span>
                  <button onClick={() => setShowSettings(false)} className="text-outline hover:text-on-surface cursor-pointer"><span className="material-symbols-outlined text-sm">close</span></button>
                </div>
                <div className="p-3 space-y-2">
                  <button className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-surface-container-low transition-colors text-body-sm cursor-pointer"><span className="material-symbols-outlined text-sm">tune</span> Buffer Configuration</button>
                  <button className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-surface-container-low transition-colors text-body-sm cursor-pointer"><span className="material-symbols-outlined text-sm">speed</span> Rate Limit: 5000/s</button>
                  <button className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-surface-container-low transition-colors text-body-sm cursor-pointer"><span className="material-symbols-outlined text-sm">timer</span> Debounce: 10s</button>
                  <button className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-surface-container-low transition-colors text-body-sm cursor-pointer"><span className="material-symbols-outlined text-sm">notifications_active</span> Alert Rules</button>
                </div>
              </div>
            )}
          </div>

          {/* Help */}
          <div className="relative">
            <button onClick={() => { setShowHelp(!showHelp); setShowNotifications(false); setShowSettings(false); }} className="p-2 rounded-full hover:bg-surface-container transition-all text-on-surface-variant cursor-pointer active:scale-95">
              <span className="material-symbols-outlined">help</span>
            </button>
            {showHelp && (
              <div className="absolute right-0 top-12 w-72 bg-white rounded-xl shadow-[8px_8px_20px_rgba(0,0,0,0.1)] border border-outline-variant/30 z-50 overflow-hidden animate-fade-in">
                <div className="p-4 border-b border-surface-container flex justify-between items-center">
                  <span className="text-body-sm font-semibold">Help & Shortcuts</span>
                  <button onClick={() => setShowHelp(false)} className="text-outline hover:text-on-surface cursor-pointer"><span className="material-symbols-outlined text-sm">close</span></button>
                </div>
                <div className="p-3 space-y-3 text-body-sm">
                  <div className="flex justify-between"><span>Search</span><kbd className="text-label-caps bg-surface-container px-1.5 py-0.5 rounded">Ctrl+K</kbd></div>
                  <div className="flex justify-between"><span>New Incident</span><kbd className="text-label-caps bg-surface-container px-1.5 py-0.5 rounded">Ctrl+N</kbd></div>
                  <div className="flex justify-between"><span>Dashboard</span><kbd className="text-label-caps bg-surface-container px-1.5 py-0.5 rounded">Ctrl+1</kbd></div>
                  <div className="flex justify-between"><span>Incidents</span><kbd className="text-label-caps bg-surface-container px-1.5 py-0.5 rounded">Ctrl+2</kbd></div>
                  <hr className="border-surface-container" />
                  <p className="text-[11px] text-outline">SentinelIMS v1.0 — High-throughput Incident Management</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* ─── Click-away overlay ────────────────────────────────── */}
      {(showNotifications || showSettings || showHelp) && (
        <div className="fixed inset-0 z-40" onClick={() => { setShowNotifications(false); setShowSettings(false); setShowHelp(false); }} />
      )}

      {/* ─── Sidebar ──────────────────────────────────────────── */}
      <nav className={`fixed left-0 top-0 h-screen w-64 flex-col p-4 pt-20 border-r bg-slate-50/80 backdrop-blur-xl border-slate-200 shadow-[inset_-2px_0_10px_rgba(0,0,0,0.05)] z-40 transition-transform duration-300 ${sidebarCollapsed ? 'translate-x-0 flex' : 'hidden md:flex'}`}>
        {/* Mobile close */}
        <button className="md:hidden absolute top-5 right-4 cursor-pointer" onClick={() => setSidebarCollapsed(false)}>
          <span className="material-symbols-outlined">close</span>
        </button>

        <div className="mb-6 px-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-primary-container text-on-primary flex items-center justify-center font-bold text-sm">U</div>
            <div>
              <div className="text-body-sm font-bold text-on-surface">Command Center</div>
              <div className="text-[11px] text-on-surface-variant">Vigilant Mode</div>
            </div>
          </div>
        </div>

        <button
          onClick={() => { setShowNewIncidentForm(true); setSidebarCollapsed(false); }}
          className="mb-6 mx-4 py-2.5 bg-primary text-on-primary rounded-lg font-bold text-body-sm hover:opacity-90 transition-opacity flex items-center justify-center gap-2 cursor-pointer active:scale-95"
        >
          <span className="material-symbols-outlined text-sm">add</span> New Incident
        </button>

        <ul className="flex flex-col gap-2 flex-grow list-none p-0 m-0">
          {mainLinks.map(link => {
            const isActive = currentTab === link.id;
            return (
              <li key={link.id}>
                <button
                  onClick={() => { handleNavClick(link.id); setSidebarCollapsed(false); }}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all duration-200 cursor-pointer ${
                    isActive
                      ? 'bg-white shadow-[2px_2px_5px_rgba(0,0,0,0.1),-2px_-2px_5px_rgba(255,255,255,0.7)] text-black'
                      : 'text-slate-500 hover:text-black hover:translate-x-1'
                  }`}
                >
                  <span className="material-symbols-outlined" style={isActive ? { fontVariationSettings: "'FILL' 1" } : {}}>{link.icon}</span>
                  {link.label}
                </button>
              </li>
            );
          })}
        </ul>

        <div className="mt-auto border-t border-outline-variant/50 pt-4">
          <ul className="flex flex-col gap-2 list-none p-0 m-0">
            <li><button onClick={() => { setShowLogs(!showLogs); setActiveTab('dashboard'); setSelectedIncident(null); setSidebarCollapsed(false); }} className={`w-full flex items-center gap-3 px-4 py-2 rounded-lg text-sm cursor-pointer transition-all ${showLogs ? 'text-black bg-white shadow-sm' : 'text-slate-500 hover:text-black'}`}><span className="material-symbols-outlined text-sm">terminal</span> Logs</button></li>
            <li><button onClick={() => { setShowTerminal(!showTerminal); setShowLogs(false); setActiveTab('dashboard'); setSelectedIncident(null); setSidebarCollapsed(false); }} className={`w-full flex items-center gap-3 px-4 py-2 rounded-lg text-sm cursor-pointer transition-all ${showTerminal ? 'text-black bg-white shadow-sm' : 'text-slate-500 hover:text-black'}`}><span className="material-symbols-outlined text-sm">code</span> Terminal</button></li>
          </ul>
        </div>
      </nav>

      {/* ─── Mobile sidebar overlay ──────────────────────────── */}
      {sidebarCollapsed && <div className="fixed inset-0 bg-black/20 z-30 md:hidden" onClick={() => setSidebarCollapsed(false)} />}

      {/* ─── New Incident Modal ───────────────────────────────── */}
      {showNewIncidentForm && <NewIncidentModal onClose={() => setShowNewIncidentForm(false)} />}

      {/* ─── Main Content ─────────────────────────────────────── */}
      <main className="md:ml-64 pt-16 min-h-screen p-6">
        {showTerminal ? (
          <TerminalPanel />
        ) : selectedIncident ? (
          <IncidentDetail incidentId={selectedIncident} onBack={() => setSelectedIncident(null)} />
        ) : (
          <Dashboard
            onSelectIncident={setSelectedIncident}
            activeTab={activeTab}
            searchQuery={searchQuery}
            showLogs={showLogs}
          />
        )}
      </main>
    </div>
  );
}

/* ─── Terminal Panel ──────────────────────────────────────────── */
interface TermLine { type: 'input' | 'output' | 'error' | 'system'; text: string; }

function TerminalPanel() {
  const [lines, setLines] = useState<TermLine[]>([
    { type: 'system', text: '╔══════════════════════════════════════════════════════════╗' },
    { type: 'system', text: '║            🛡️  SentinelIMS Command Terminal              ║' },
    { type: 'system', text: '╠══════════════════════════════════════════════════════════╣' },
    { type: 'system', text: '║  Type "help" for available commands                     ║' },
    { type: 'system', text: '╚══════════════════════════════════════════════════════════╝' },
    { type: 'output', text: '' },
  ]);
  const [input, setInput] = useState('');
  const [history, setHistory] = useState<string[]>([]);
  const [historyIdx, setHistoryIdx] = useState(-1);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [lines]);
  useEffect(() => { inputRef.current?.focus(); }, []);

  const addLines = useCallback((newLines: TermLine[]) => {
    setLines(prev => [...prev, ...newLines]);
  }, []);

  const execCommand = useCallback(async (cmd: string) => {
    const trimmed = cmd.trim().toLowerCase();
    addLines([{ type: 'input', text: `sentinel@ims:~$ ${cmd}` }]);

    if (!trimmed) return;

    setHistory(prev => [...prev, cmd]);
    setHistoryIdx(-1);

    const parts = trimmed.split(/\s+/);
    const base = parts[0];

    try {
      switch (base) {
        case 'help': {
          addLines([
            { type: 'output', text: '' },
            { type: 'system', text: '  Available Commands:' },
            { type: 'output', text: '  ─────────────────────────────────────────' },
            { type: 'output', text: '  health          System health status' },
            { type: 'output', text: '  incidents       List active incidents' },
            { type: 'output', text: '  buffer          Ring buffer stats' },
            { type: 'output', text: '  metrics         Current throughput metrics' },
            { type: 'output', text: '  uptime          Server uptime' },
            { type: 'output', text: '  send <comp>     Send a test signal' },
            { type: 'output', text: '  flood [n]       Blast n signals (default 50) — watch the graph spike!' },
            { type: 'output', text: '  clear           Clear terminal' },
            { type: 'output', text: '  help            Show this help' },
            { type: 'output', text: '' },
          ]);
          break;
        }
        case 'clear': {
          setLines([]);
          break;
        }
        case 'health': {
          const { api } = await import('@/lib/api');
          const h = await api.getHealth();
          addLines([
            { type: 'output', text: '' },
            { type: 'system', text: `  System Status: ${h.status === 'healthy' ? '● HEALTHY' : '○ DEGRADED'}` },
            { type: 'output', text: `  Database:      ${h.database.status} (${h.database.latencyMs}ms)` },
            { type: 'output', text: `  Uptime:        ${Math.floor(h.uptime / 3600)}h ${Math.floor((h.uptime % 3600) / 60)}m ${h.uptime % 60}s` },
            { type: 'output', text: `  Buffer:        ${h.buffer.size}/${h.buffer.capacity} (${h.buffer.usagePercent}%)` },
            { type: 'output', text: `  Signals/sec:   ${h.metrics?.signalsPerSecond ?? 0}` },
            { type: 'output', text: `  Active Inc:    ${h.metrics?.activeIncidents ?? 0}` },
            { type: 'output', text: `  Total Proc:    ${(h.metrics?.totalSignalsProcessed ?? 0).toLocaleString()}` },
            { type: 'output', text: '' },
          ]);
          break;
        }
        case 'incidents': {
          const { api } = await import('@/lib/api');
          const d = await api.getDashboard();
          if (d.incidents.length === 0) {
            addLines([{ type: 'output', text: '  No active incidents. All clear! ✓' }, { type: 'output', text: '' }]);
          } else {
            addLines([
              { type: 'output', text: '' },
              { type: 'system', text: `  Active Incidents (${d.incidents.length}):` },
              { type: 'output', text: '  ──────────────────────────────────────────────────────' },
              ...d.incidents.slice(0, 15).map(inc => ({
                type: 'output' as const,
                text: `  [${inc.severity}] ${inc.id.slice(0, 8)}  ${inc.componentId.padEnd(20)} ${inc.status}`,
              })),
              { type: 'output', text: '' },
              { type: 'output', text: `  P0: ${d.counts.p0}  P1: ${d.counts.p1}  P2: ${d.counts.p2}  MTTR: ${d.avgMttr ? `${Math.round(d.avgMttr)}s` : '—'}` },
              { type: 'output', text: '' },
            ]);
          }
          break;
        }
        case 'buffer': {
          const { api } = await import('@/lib/api');
          const h = await api.getHealth();
          const pct = h.buffer.usagePercent;
          const barLen = 30;
          const filled = Math.round((pct / 100) * barLen);
          const bar = '█'.repeat(filled) + '░'.repeat(barLen - filled);
          addLines([
            { type: 'output', text: '' },
            { type: 'system', text: '  Ring Buffer Status:' },
            { type: 'output', text: `  [${bar}] ${pct}%` },
            { type: 'output', text: `  Size:     ${h.buffer.size.toLocaleString()} / ${h.buffer.capacity.toLocaleString()}` },
            { type: 'output', text: `  Pushed:   ${h.buffer.totalPushed.toLocaleString()}` },
            { type: 'output', text: `  Dropped:  ${h.buffer.totalDropped.toLocaleString()}` },
            { type: 'output', text: '' },
          ]);
          break;
        }
        case 'metrics': {
          const { api } = await import('@/lib/api');
          const h = await api.getHealth();
          addLines([
            { type: 'output', text: '' },
            { type: 'system', text: '  Throughput Metrics:' },
            { type: 'output', text: `  Signals/sec:        ${h.metrics?.signalsPerSecond ?? 0}` },
            { type: 'output', text: `  Active Incidents:   ${h.metrics?.activeIncidents ?? 0}` },
            { type: 'output', text: `  Total Processed:    ${(h.metrics?.totalSignalsProcessed ?? 0).toLocaleString()}` },
            { type: 'output', text: `  Buffer Usage:       ${h.buffer.usagePercent}%` },
            { type: 'output', text: '' },
          ]);
          break;
        }
        case 'uptime': {
          const { api } = await import('@/lib/api');
          const h = await api.getHealth();
          const hrs = Math.floor(h.uptime / 3600);
          const mins = Math.floor((h.uptime % 3600) / 60);
          const secs = h.uptime % 60;
          addLines([
            { type: 'output', text: `  Server uptime: ${hrs}h ${mins}m ${secs}s` },
            { type: 'output', text: '' },
          ]);
          break;
        }
        case 'send': {
          const comp = parts[1] || 'TEST_COMPONENT';
          const { api } = await import('@/lib/api');
          await api.sendSignal({
            component_id: comp.toUpperCase(),
            error_type: 'ManualTest',
            severity: 'low',
            metadata: { source: 'terminal', created_by: 'operator' },
          });
          addLines([
            { type: 'system', text: `  ✓ Signal sent to ${comp.toUpperCase()}` },
            { type: 'output', text: '' },
          ]);
          break;
        }
        case 'flood': {
          const count = Math.min(parseInt(parts[1] || '50') || 50, 500);
          const components = ['API_GATEWAY', 'AUTH_SERVICE', 'CACHE_CLUSTER', 'RDBMS_PRIMARY', 'QUEUE_BROKER', 'CDN_EDGE', 'ML_PIPELINE', 'PAYMENT_SVC'];
          const severities = ['critical', 'high', 'low'];
          addLines([
            { type: 'system', text: `  ⚡ Flooding ${count} signals...` },
          ]);
          const { api } = await import('@/lib/api');
          const promises = Array.from({ length: count }, (_, i) => {
            const comp = components[i % components.length];
            const sev = severities[Math.floor(Math.random() * severities.length)];
            return api.sendSignal({
              component_id: `${comp}_${String(Math.floor(Math.random() * 10)).padStart(2, '0')}`,
              error_type: ['ConnectionTimeout', 'MemoryExhaustion', 'DiskIOError', 'RateLimitHit', 'CertExpiry'][Math.floor(Math.random() * 5)],
              severity: sev,
              metadata: { source: 'terminal-flood', batch: i },
            }).catch(() => null);
          });
          await Promise.all(promises);
          addLines([
            { type: 'system', text: `  ✓ ${count} signals sent — switch to Dashboard to see the graph spike!` },
            { type: 'output', text: '' },
          ]);
          break;
        }
        default: {
          addLines([
            { type: 'error', text: `  sentinel: command not found: ${base}` },
            { type: 'output', text: '  Type "help" for available commands' },
            { type: 'output', text: '' },
          ]);
        }
      }
    } catch (err: any) {
      addLines([
        { type: 'error', text: `  Error: ${err.message}` },
        { type: 'output', text: '' },
      ]);
    }
  }, [addLines]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      execCommand(input);
      setInput('');
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (history.length > 0) {
        const newIdx = historyIdx === -1 ? history.length - 1 : Math.max(0, historyIdx - 1);
        setHistoryIdx(newIdx);
        setInput(history[newIdx]);
      }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (historyIdx !== -1) {
        const newIdx = historyIdx + 1;
        if (newIdx >= history.length) {
          setHistoryIdx(-1);
          setInput('');
        } else {
          setHistoryIdx(newIdx);
          setInput(history[newIdx]);
        }
      }
    }
  };

  return (
    <div className="animate-fade-in space-y-4">
      <h2 className="text-h1 text-on-surface flex items-center gap-2">
        <span className="material-symbols-outlined">code</span> Terminal
      </h2>
      <div
        className="rounded-xl overflow-hidden border border-slate-700 shadow-lg"
        onClick={() => inputRef.current?.focus()}
      >
        {/* Title bar */}
        <div className="flex items-center gap-2 px-4 py-2.5 bg-[#2d2d2d] border-b border-slate-700">
          <div className="flex gap-1.5">
            <span className="w-3 h-3 rounded-full bg-[#ff5f57]" />
            <span className="w-3 h-3 rounded-full bg-[#febc2e]" />
            <span className="w-3 h-3 rounded-full bg-[#28c840]" />
          </div>
          <span className="flex-1 text-center text-[12px] text-slate-400 font-mono">sentinel@ims — bash</span>
        </div>
        {/* Terminal body */}
        <div className="bg-[#1a1a2e] min-h-[500px] max-h-[calc(100vh-200px)] overflow-y-auto p-4 font-mono text-[13px] leading-relaxed cursor-text">
          {lines.map((line, i) => (
            <div key={i} className={
              line.type === 'input' ? 'text-emerald-400' :
              line.type === 'error' ? 'text-red-400' :
              line.type === 'system' ? 'text-cyan-400' :
              'text-slate-300'
            }>
              {line.text || '\u00A0'}
            </div>
          ))}
          <div className="flex items-center">
            <span className="text-emerald-400 shrink-0">sentinel@ims:~$&nbsp;</span>
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              className="flex-1 bg-transparent text-slate-200 outline-none font-mono text-[13px] caret-emerald-400"
              spellCheck={false}
              autoComplete="off"
            />
          </div>
          <div ref={bottomRef} />
        </div>
      </div>
    </div>
  );
}

/* ─── New Incident Modal ──────────────────────────────────────── */
function NewIncidentModal({ onClose }: { onClose: () => void }) {
  const [componentId, setComponentId] = useState('');
  const [errorType, setErrorType] = useState('');
  const [severity, setSeverity] = useState('critical');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!componentId || !errorType) return;
    setSending(true);
    try {
      const { api } = await import('@/lib/api');
      await api.sendSignal({ component_id: componentId, error_type: errorType, severity, metadata: { source: 'manual', created_by: 'operator' } });
      setSent(true);
      setTimeout(onClose, 1500);
    } catch { /* ignore */ }
    finally { setSending(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-xl shadow-[8px_8px_20px_rgba(0,0,0,0.1)] border border-outline-variant/30 w-full max-w-md p-6 animate-fade-in-up">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-h2 text-on-surface flex items-center gap-2"><span className="material-symbols-outlined">add_alert</span> New Signal</h2>
          <button onClick={onClose} className="text-outline hover:text-on-surface cursor-pointer"><span className="material-symbols-outlined">close</span></button>
        </div>
        {sent ? (
          <div className="text-center py-8 animate-fade-in">
            <span className="material-symbols-outlined text-[48px] text-primary mb-2" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
            <p className="text-body-sm text-on-surface font-medium">Signal sent successfully!</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="text-label-caps text-on-surface-variant block mb-2">Component ID</label>
              <input type="text" value={componentId} onChange={e => setComponentId(e.target.value)} placeholder="e.g. API_GATEWAY_02" className="w-full rounded-lg bg-surface-container-lowest border border-outline-variant p-3 text-body-sm focus:outline-none focus:ring-2 focus:ring-primary" required />
            </div>
            <div>
              <label className="text-label-caps text-on-surface-variant block mb-2">Error Type</label>
              <input type="text" value={errorType} onChange={e => setErrorType(e.target.value)} placeholder="e.g. ConnectionTimeout" className="w-full rounded-lg bg-surface-container-lowest border border-outline-variant p-3 text-body-sm focus:outline-none focus:ring-2 focus:ring-primary" required />
            </div>
            <div>
              <label className="text-label-caps text-on-surface-variant block mb-2">Severity</label>
              <div className="flex gap-2">
                {['critical', 'high', 'low'].map(s => (
                  <button key={s} type="button" onClick={() => setSeverity(s)} className={`flex-1 py-2 rounded-lg text-label-caps border transition-colors cursor-pointer ${severity === s ? 'bg-primary text-on-primary border-primary' : 'bg-surface-container-lowest border-outline-variant text-on-surface-variant hover:bg-surface-container'}`}>{s === 'critical' ? 'P0' : s === 'high' ? 'P1' : 'P2'}</button>
                ))}
              </div>
            </div>
            <button type="submit" disabled={sending} className="w-full bg-primary text-on-primary py-3 rounded-lg text-body-sm font-semibold cursor-pointer hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center justify-center gap-2">
              {sending ? 'Sending...' : <><span className="material-symbols-outlined text-sm">send</span> Send Signal</>}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
