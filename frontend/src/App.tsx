import { useState, useMemo } from 'react';
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

  const currentTab = selectedIncident ? 'incidents' : activeTab;

  const handleNavClick = (id: Tab) => {
    setActiveTab(id);
    setSelectedIncident(null);
    setShowNotifications(false);
    setShowSettings(false);
    setShowHelp(false);
    setShowNewIncidentForm(false);
    setShowLogs(false);
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
            <li><button className="w-full flex items-center gap-3 px-4 py-2 rounded-lg text-slate-500 hover:text-black transition-all text-sm cursor-pointer"><span className="material-symbols-outlined text-sm">code</span> Terminal</button></li>
          </ul>
        </div>
      </nav>

      {/* ─── Mobile sidebar overlay ──────────────────────────── */}
      {sidebarCollapsed && <div className="fixed inset-0 bg-black/20 z-30 md:hidden" onClick={() => setSidebarCollapsed(false)} />}

      {/* ─── New Incident Modal ───────────────────────────────── */}
      {showNewIncidentForm && <NewIncidentModal onClose={() => setShowNewIncidentForm(false)} />}

      {/* ─── Main Content ─────────────────────────────────────── */}
      <main className="md:ml-64 pt-16 min-h-screen p-6">
        {selectedIncident ? (
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
