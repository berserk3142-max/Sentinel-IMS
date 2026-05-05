import { useMemo, useState, useRef, useEffect } from 'react';
import { useDashboard, useHealth, useMetrics } from '@/hooks/useSocket';
import { formatAge, formatMTTR } from '@/lib/utils';
import { AreaChart, Area, XAxis, YAxis, ResponsiveContainer, Tooltip, CartesianGrid } from 'recharts';
import type { Incident } from '@/lib/api';

interface DashboardProps {
  onSelectIncident: (id: string) => void;
  activeTab?: string;
  searchQuery?: string;
  showLogs?: boolean;
}

/* ─── Marquee Bar ─────────────────────────────────────────────── */
function MarqueeBar() {
  const items = [
    { icon: 'bolt', label: 'Real-time Monitoring' },
    { icon: 'security', label: 'Threat Detection' },
    { icon: 'analytics', label: 'Predictive Analytics' },
    { icon: 'hub', label: 'Automated Triage' },
    { icon: 'cloud_sync', label: 'Cloud-Native Scale' },
  ];
  return (
    <div className="marquee-wrapper bg-surface-container-lowest border-b border-outline-variant/30 py-2 mb-6">
      <div className="marquee-track">
        {[...items, ...items].map((item, i) => (
          <div key={i} className="flex items-center gap-2 px-4 py-1 bg-surface-container rounded-2xl shrink-0">
            <span className="material-symbols-outlined text-[16px] text-primary">{item.icon}</span>
            <span className="text-label-caps text-on-surface">{item.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─── System Health Bar ───────────────────────────────────────── */
function HealthBar({ health }: { health: any }) {
  if (!health) return null;
  return (
    <div className="flex items-center justify-between bg-surface-container-low rounded-lg p-3 mb-6 border border-outline-variant/30 shadow-sm">
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined text-outline text-[18px]">database</span>
          <span className="text-data-mono text-on-surface-variant">DB Latency: {health.database.latencyMs}ms</span>
        </div>
        <div className="w-px h-4 bg-outline-variant" />
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined text-outline text-[18px]">memory</span>
          <span className="text-data-mono text-on-surface-variant">Buffer: {health.buffer.usagePercent}%</span>
        </div>
        <div className="w-px h-4 bg-outline-variant hidden sm:block" />
        <div className="hidden sm:flex items-center gap-2">
          <span className="material-symbols-outlined text-outline text-[18px]">schedule</span>
          <span className="text-data-mono text-on-surface-variant">Uptime: {formatAge(health.uptime)}</span>
        </div>
      </div>
      <div className="flex items-center gap-2 text-primary">
        <span className="material-symbols-outlined text-[18px]">favorite</span>
        <span className="text-label-caps">
          {health.status === 'healthy' ? 'System Healthy' : 'Degraded'}
        </span>
      </div>
    </div>
  );
}

/* ─── Stat Card ───────────────────────────────────────────────── */
function StatCard({ label, value, subtext, icon, iconColor = 'text-outline' }: {
  label: string; value: string | number; subtext?: string; icon: string; iconColor?: string;
}) {
  return (
    <div className="neu-flat rounded-xl p-5 flex flex-col justify-between transition-all duration-200">
      <div className="flex justify-between items-start mb-4">
        <span className="text-label-caps text-on-surface-variant">{label}</span>
        <span className={`material-symbols-outlined ${iconColor}`}>{icon}</span>
      </div>
      <div className="flex items-end justify-between">
        <span className="text-h1 text-on-surface">{value}</span>
        {subtext && <span className="text-data-mono text-secondary">{subtext}</span>}
      </div>
    </div>
  );
}

/* ─── Incident Row ────────────────────────────────────────────── */
function IncidentRow({ incident, onClick }: { incident: Incident; onClick: () => void }) {
  const severityStyle = incident.severity === 'P0'
    ? 'bg-error-container text-on-error-container'
    : incident.severity === 'P1'
    ? 'bg-amber-100 text-amber-800'
    : 'bg-secondary-container text-on-secondary-container';

  const statusColor = incident.status === 'OPEN' || incident.status === 'INVESTIGATING'
    ? 'border-error text-error'
    : incident.status === 'RESOLVED'
    ? 'border-success text-success'
    : 'border-outline text-outline';

  const statusDot = incident.status === 'OPEN' || incident.status === 'INVESTIGATING'
    ? 'bg-error'
    : incident.status === 'RESOLVED'
    ? 'bg-success'
    : 'bg-outline';

  return (
    <tr className="border-b border-surface-container hover:bg-surface-container-lowest transition-colors group cursor-pointer" onClick={onClick}>
      <td className="py-3 px-5 text-data-mono text-outline">{incident.id.slice(0, 8)}</td>
      <td className="py-3 px-5">
        <span className={`inline-flex items-center px-2 py-1 rounded text-label-caps ${severityStyle}`}>
          {incident.severity}
        </span>
      </td>
      <td className="py-3 px-5 text-body-sm font-medium text-on-surface">{incident.componentId}</td>
      <td className="py-3 px-5">
        <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-2xl border text-label-caps ${statusColor}`}>
          <span className={`w-1.5 h-1.5 rounded-full ${statusDot}`} />
          {incident.status}
        </span>
      </td>
      <td className="py-3 px-5 text-data-mono text-outline">{formatAge(incident.age)}</td>
      <td className="py-3 px-5 text-right">
        <button className="px-3 py-1 bg-surface-container hover:bg-surface-variant rounded text-on-surface text-label-caps transition-colors opacity-0 group-hover:opacity-100 cursor-pointer">
          View
        </button>
      </td>
    </tr>
  );
}

/* ─── Event Log Item ──────────────────────────────────────────── */
function LogItem({ time, text, color }: { time: string; text: string; color: string }) {
  return (
    <div className="relative">
      <span className={`absolute -left-[21px] top-1 w-2.5 h-2.5 rounded-full border-2 border-surface ${color}`} />
      <p className="text-data-mono text-outline text-[11px] mb-1">{time}</p>
      <p className="text-body-sm text-on-surface">{text}</p>
    </div>
  );
}

/* ─── Metrics Panel ───────────────────────────────────────────── */
function MetricsView({ metrics, health }: { metrics: any[]; health: any }) {
  return (
    <div className="animate-fade-in space-y-6">
      <h2 className="text-h1 text-on-surface">System Metrics</h2>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="neu-flat rounded-xl p-5"><span className="text-label-caps text-on-surface-variant block mb-2">Signals/sec</span><span className="text-h1 text-on-surface">{health?.metrics?.signalsPerSecond ?? 0}</span></div>
        <div className="neu-flat rounded-xl p-5"><span className="text-label-caps text-on-surface-variant block mb-2">Total Processed</span><span className="text-h1 text-on-surface">{(health?.metrics?.totalSignalsProcessed ?? 0).toLocaleString()}</span></div>
        <div className="neu-flat rounded-xl p-5"><span className="text-label-caps text-on-surface-variant block mb-2">Buffer Usage</span><span className="text-h1 text-on-surface">{health?.buffer?.usagePercent ?? 0}%</span><div className="w-full h-2 bg-surface-container rounded-full mt-3"><div className="h-full bg-primary rounded-full transition-all" style={{ width: `${health?.buffer?.usagePercent ?? 0}%` }} /></div></div>
      </div>
      <div className="neu-flat rounded-xl p-5">
        <h3 className="text-h2 text-on-surface mb-4">Throughput Over Time</h3>
        <div className="h-80 w-full bg-surface-container-lowest rounded-lg border border-outline-variant/30 overflow-hidden">
          {metrics.length > 1 ? (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={metrics} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                <defs><linearGradient id="gradM" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#505f76" stopOpacity={0.3} /><stop offset="95%" stopColor="#505f76" stopOpacity={0} /></linearGradient></defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e2e2" /><XAxis dataKey="timestamp" hide /><YAxis hide />
                <Tooltip contentStyle={{ background: '#fff', border: '1px solid #cfc4c5', borderRadius: '8px', fontFamily: 'DM Mono', fontSize: '12px' }} />
                <Area type="monotone" dataKey="signalsPerSecond" stroke="#505f76" strokeWidth={2} fill="url(#gradM)" />
              </AreaChart>
            </ResponsiveContainer>
          ) : <div className="flex items-center justify-center h-full text-outline text-body-sm">Collecting metrics data...</div>}
        </div>
      </div>
    </div>
  );
}

/* ─── Signals View ────────────────────────────────────────────── */
function SignalsView({ incidents, onSelect }: { incidents: Incident[]; onSelect: (id: string) => void }) {
  const allSignals = incidents.flatMap(inc => [{ id: inc.id, component: inc.componentId, severity: inc.severity, status: inc.status, time: inc.startTime, count: inc.signalCount }]);
  return (
    <div className="animate-fade-in space-y-6">
      <h2 className="text-h1 text-on-surface">Signal Feed</h2>
      <div className="neu-flat rounded-xl overflow-hidden">
        <table className="w-full text-left border-collapse">
          <thead><tr className="bg-surface-container-lowest border-b border-outline-variant text-label-caps text-on-surface-variant">
            <th className="py-3 px-5">Component</th><th className="py-3 px-5">Severity</th><th className="py-3 px-5">Signals</th><th className="py-3 px-5">Time</th><th className="py-3 px-5">Status</th>
          </tr></thead>
          <tbody>{allSignals.map(s => (
            <tr key={s.id} className="border-b border-surface-container hover:bg-surface-container-lowest cursor-pointer transition-colors" onClick={() => onSelect(s.id)}>
              <td className="py-3 px-5 text-body-sm font-medium">{s.component}</td>
              <td className="py-3 px-5"><span className={`text-label-caps px-2 py-1 rounded ${s.severity==='P0'?'bg-error-container text-on-error-container':s.severity==='P1'?'bg-amber-100 text-amber-800':'bg-secondary-container text-on-secondary-container'}`}>{s.severity}</span></td>
              <td className="py-3 px-5 text-data-mono">{s.count}</td>
              <td className="py-3 px-5 text-data-mono text-outline">{new Date(s.time).toLocaleTimeString()}</td>
              <td className="py-3 px-5 text-label-caps">{s.status}</td>
            </tr>
          ))}</tbody>
        </table>
      </div>
    </div>
  );
}

/* ─── Team Members Data ───────────────────────────────────────── */
const TEAM_MEMBERS = [
  { initials: 'JD', name: 'Jane Doe', role: 'Primary On-Call (SRE)', status: 'online' as const },
  { initials: 'AS', name: 'Alex Smith', role: 'Secondary On-Call', status: 'online' as const },
  { initials: 'MK', name: 'Maya Kumar', role: 'Backend Lead', status: 'away' as const },
  { initials: 'TC', name: 'Tom Chen', role: 'DevOps Engineer', status: 'offline' as const },
  { initials: 'LR', name: 'Lena Rivera', role: 'SRE Manager', status: 'online' as const },
];

type TeamMember = typeof TEAM_MEMBERS[number];
interface ChatMessage { id: string; from: 'me' | 'them'; text: string; time: string; }

const AUTO_REPLIES: Record<string, string[]> = {
  'JD': ['Looking into it now.', 'I see the alert — triaging.', 'Acknowledged, escalating to P0 response.', 'Checking the runbook for this component.'],
  'AS': ['On it.', 'I can take secondary on this.', 'Pulling up the dashboards now.', 'Confirmed, I see the spike.'],
  'MK': ['Let me check the backend logs.', 'Might be a connection pool issue.', 'I\'ll push a hotfix if needed.', 'Reviewing the recent deploy diff.'],
  'TC': ['Checking infra metrics.', 'No anomalies on the k8s side.', 'I\'ll scale up the replicas.', 'Disk IOPS look normal from here.'],
  'LR': ['Keep me posted.', 'Good call escalating early.', 'I\'ll join the bridge call.', 'Let\'s do a quick sync in 5.'],
};

/* ─── Chat Panel ──────────────────────────────────────────────── */
function ChatPanel({ member, onClose }: { member: TeamMember; onClose: () => void }) {
  const [messages, setMessages] = useState<ChatMessage[]>([
    { id: '0', from: 'them', text: `Hey, I'm ${member.status === 'online' ? 'available' : member.status === 'away' ? 'away but reachable' : 'offline'}. What's up?`, time: new Date(Date.now() - 60000).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' }) },
  ]);
  const [input, setInput] = useState('');
  const [typing, setTyping] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages, typing]);

  const handleSend = () => {
    if (!input.trim()) return;
    const now = new Date().toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
    setMessages(prev => [...prev, { id: Date.now().toString(), from: 'me', text: input.trim(), time: now }]);
    setInput('');
    // Simulate reply
    setTyping(true);
    const delay = 1000 + Math.random() * 2000;
    setTimeout(() => {
      setTyping(false);
      const replies = AUTO_REPLIES[member.initials] || ['Got it.'];
      const reply = replies[Math.floor(Math.random() * replies.length)];
      const replyTime = new Date().toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
      setMessages(prev => [...prev, { id: (Date.now() + 1).toString(), from: 'them', text: reply, time: replyTime }]);
    }, delay);
  };

  const statusDot = member.status === 'online' ? 'bg-emerald-500' : member.status === 'away' ? 'bg-amber-400' : 'bg-outline-variant';

  return (
    <div className="fixed bottom-6 right-6 w-96 max-h-[520px] bg-white rounded-2xl shadow-[8px_8px_30px_rgba(0,0,0,0.15)] border border-outline-variant/30 z-50 flex flex-col overflow-hidden animate-fade-in-up">
      {/* Header */}
      <div className="flex items-center gap-3 p-4 border-b border-surface-container bg-surface-container-lowest">
        <div className="relative">
          <div className="w-10 h-10 rounded-full bg-secondary-container text-on-secondary-container flex items-center justify-center text-label-caps font-bold">{member.initials}</div>
          <div className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-white ${statusDot}`} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-body-sm font-semibold truncate">{member.name}</p>
          <p className="text-[11px] text-on-surface-variant">{member.role}</p>
        </div>
        <button onClick={onClose} className="text-outline hover:text-on-surface p-1 rounded-full hover:bg-surface-container transition-colors cursor-pointer">
          <span className="material-symbols-outlined text-[20px]">close</span>
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-surface min-h-[200px] max-h-[340px]">
        {messages.map(msg => (
          <div key={msg.id} className={`flex flex-col ${msg.from === 'me' ? 'items-end' : 'items-start'}`}>
            <div className={`max-w-[80%] px-3 py-2 rounded-2xl text-body-sm ${
              msg.from === 'me'
                ? 'bg-primary text-on-primary rounded-br-sm'
                : 'bg-surface-container text-on-surface rounded-bl-sm'
            }`}>
              {msg.text}
            </div>
            <span className="text-[10px] text-outline mt-1 px-1">{msg.time}</span>
          </div>
        ))}
        {typing && (
          <div className="flex items-start">
            <div className="bg-surface-container px-4 py-2 rounded-2xl rounded-bl-sm">
              <div className="flex gap-1"><span className="w-1.5 h-1.5 bg-outline rounded-full animate-bounce" style={{ animationDelay: '0ms' }} /><span className="w-1.5 h-1.5 bg-outline rounded-full animate-bounce" style={{ animationDelay: '150ms' }} /><span className="w-1.5 h-1.5 bg-outline rounded-full animate-bounce" style={{ animationDelay: '300ms' }} /></div>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="p-3 border-t border-surface-container bg-surface-container-lowest">
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSend()}
            placeholder="Type a message..."
            className="flex-1 bg-surface-container border border-outline-variant/50 rounded-full px-4 py-2 text-body-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
          />
          <button onClick={handleSend} disabled={!input.trim()} className="w-9 h-9 rounded-full bg-primary text-on-primary flex items-center justify-center cursor-pointer hover:opacity-90 transition-opacity disabled:opacity-30 active:scale-90 shrink-0">
            <span className="material-symbols-outlined text-[18px]">send</span>
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── Teams View ──────────────────────────────────────────────── */
function TeamsView() {
  const [chatWith, setChatWith] = useState<TeamMember | null>(null);
  return (
    <div className="animate-fade-in space-y-6">
      <h2 className="text-h1 text-on-surface">Team Roster</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {TEAM_MEMBERS.map(m => (
          <div key={m.initials} className="neu-flat rounded-xl p-5 flex items-center gap-4 hover:-translate-y-0.5 transition-all duration-200">
            <div className="relative"><div className="w-12 h-12 rounded-full bg-secondary-container text-on-secondary-container flex items-center justify-center text-label-caps font-bold">{m.initials}</div><div className={`absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2 border-white ${m.status==='online'?'bg-emerald-500':m.status==='away'?'bg-amber-400':'bg-outline-variant'}`}/></div>
            <div className="flex-1 min-w-0"><p className="text-body-sm font-semibold truncate">{m.name}</p><p className="text-label-caps text-outline">{m.role}</p></div>
            <button onClick={() => setChatWith(chatWith?.initials === m.initials ? null : m)} className={`p-2 rounded-full transition-colors cursor-pointer ${chatWith?.initials === m.initials ? 'bg-primary text-on-primary' : 'text-secondary hover:text-on-surface hover:bg-surface-container'}`}><span className="material-symbols-outlined">chat</span></button>
          </div>
        ))}
      </div>
      {chatWith && <ChatPanel member={chatWith} onClose={() => setChatWith(null)} />}
    </div>
  );
}

/* ─── Logs View ───────────────────────────────────────────────── */
function LogsView({ incidents }: { incidents: Incident[] }) {
  return (
    <div className="animate-fade-in space-y-4">
      <h2 className="text-h1 text-on-surface flex items-center gap-2"><span className="material-symbols-outlined">terminal</span> System Logs</h2>
      <div className="bg-primary-container rounded-xl p-5 font-mono text-[13px] text-on-primary-container max-h-[500px] overflow-y-auto space-y-1 shadow-inner">
        {incidents.slice(0, 20).map((inc, i) => (
          <div key={inc.id} className="flex gap-3"><span className="text-outline-variant shrink-0">{new Date(inc.startTime).toLocaleTimeString(undefined,{hour12:false})}</span><span className={inc.severity==='P0'?'text-red-400':inc.severity==='P1'?'text-amber-400':'text-slate-400'}>[{inc.severity}]</span><span>{inc.status.padEnd(14)} {inc.componentId}</span></div>
        ))}
        {incidents.length === 0 && <div className="text-outline-variant">No log entries</div>}
      </div>
    </div>
  );
}

/* ─── On-Call Roster (sidebar widget) ─────────────────────────── */
function OnCallRoster() {
  const [chatWith, setChatWith] = useState<TeamMember | null>(null);
  const onCallMembers = TEAM_MEMBERS.filter(m => m.initials === 'JD' || m.initials === 'AS');
  return (
    <div className="neu-flat rounded-xl p-5">
      <h3 className="text-h2 text-on-surface mb-4">On-Call Roster</h3>
      <div className="flex flex-col gap-3">
        {onCallMembers.map((m, i) => (
          <div key={m.initials} className={`flex items-center justify-between p-2 rounded-lg transition-all ${i === 0 ? 'bg-surface-container-lowest border border-outline-variant/30' : 'hover:bg-surface-container-lowest border border-transparent hover:border-outline-variant/30'}`}>
            <div className="flex items-center gap-3">
              <div className="relative">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-label-caps ${i === 0 ? 'bg-secondary-container text-on-secondary-container' : 'bg-surface-container text-on-surface-variant'}`}>{m.initials}</div>
                <div className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-white ${m.status === 'online' ? 'bg-emerald-500' : 'bg-outline-variant'}`} />
              </div>
              <div>
                <p className="text-body-sm font-medium">{m.name}</p>
                <p className="text-label-caps text-outline">{i === 0 ? 'Primary (SRE)' : 'Secondary'}</p>
              </div>
            </div>
            <button onClick={() => setChatWith(chatWith?.initials === m.initials ? null : m)} className={`p-1.5 rounded-full transition-colors cursor-pointer ${chatWith?.initials === m.initials ? 'bg-primary text-on-primary' : 'text-secondary hover:text-on-surface'}`}><span className="material-symbols-outlined text-[20px]">chat</span></button>
          </div>
        ))}
      </div>
      {chatWith && <ChatPanel member={chatWith} onClose={() => setChatWith(null)} />}
    </div>
  );
}
/* ─── Main Dashboard ──────────────────────────────────────────── */
export function Dashboard({ onSelectIncident, activeTab = 'dashboard', searchQuery = '', showLogs = false }: DashboardProps) {
  const { data, loading, error, refresh } = useDashboard(5000);
  const { data: health } = useHealth(10000);
  const metrics = useMetrics();

  const filteredIncidents = useMemo(() => {
    if (!data?.incidents) return [];
    if (!searchQuery) return data.incidents;
    const q = searchQuery.toLowerCase();
    return data.incidents.filter(i => i.componentId.toLowerCase().includes(q) || i.id.toLowerCase().includes(q) || i.severity.toLowerCase().includes(q) || i.status.toLowerCase().includes(q));
  }, [data?.incidents, searchQuery]);

  if (loading && !data) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <div className="text-center space-y-4">
          <span className="material-symbols-outlined text-[48px] text-outline animate-spin">progress_activity</span>
          <p className="text-body-sm text-outline">Loading command center...</p>
        </div>
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <div className="neu-flat rounded-xl p-8 text-center space-y-4 max-w-md">
          <span className="material-symbols-outlined text-[48px] text-error">error</span>
          <p className="text-h2 text-on-surface">Connection Error</p>
          <p className="text-body-sm text-outline">{error}</p>
          <button onClick={refresh} className="bg-primary text-on-primary px-6 py-2 rounded-lg text-label-caps cursor-pointer hover:bg-on-surface-variant transition-colors">Retry Connection</button>
        </div>
      </div>
    );
  }

  if (showLogs) return <LogsView incidents={data?.incidents || []} />;
  if (activeTab === 'metrics') return <MetricsView metrics={metrics} health={health} />;
  if (activeTab === 'signals') return <SignalsView incidents={filteredIncidents} onSelect={onSelectIncident} />;
  if (activeTab === 'teams') return <TeamsView />;

  const c = data?.counts || { total: 0, open: 0, investigating: 0, resolved: 0, closed: 0, p0: 0, p1: 0, p2: 0 };

  // For 'incidents' tab, show only the table full-width
  if (activeTab === 'incidents') {
    return (
      <div className="animate-fade-in space-y-6">
        <div className="flex justify-between items-center">
          <h2 className="text-h1 text-on-surface">All Incidents {searchQuery && <span className="text-body-sm text-outline font-normal">— filtered by "{searchQuery}"</span>}</h2>
          <span className="text-label-caps text-on-surface-variant">{filteredIncidents.length} results</span>
        </div>
        <div className="neu-flat rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead><tr className="bg-surface-container-lowest border-b border-outline-variant text-label-caps text-on-surface-variant">
                <th className="py-3 px-5 font-semibold">ID</th><th className="py-3 px-5 font-semibold">Severity</th><th className="py-3 px-5 font-semibold">Component</th><th className="py-3 px-5 font-semibold">Status</th><th className="py-3 px-5 font-semibold">Age</th><th className="py-3 px-5 font-semibold text-right">Action</th>
              </tr></thead>
              <tbody className="text-body-sm text-on-surface">
                {filteredIncidents.map(incident => <IncidentRow key={incident.id} incident={incident} onClick={() => onSelectIncident(incident.id)} />)}
                {filteredIncidents.length === 0 && <tr><td colSpan={6} className="text-center py-16 text-outline"><span className="material-symbols-outlined text-[32px] mb-2 block opacity-30">search_off</span>{searchQuery ? 'No incidents match your search' : 'No incidents found'}</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="animate-fade-in">
      <MarqueeBar />
      <HealthBar health={health} />

      {/* ─── Stats Row ────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard label="Open Incidents" value={c.open} icon="warning" iconColor="text-error" subtext={c.investigating > 0 ? `+${c.investigating} investigating` : undefined} />
        <StatCard label="Investigating" value={c.investigating} icon="search" iconColor="text-secondary" />
        <StatCard label="Resolved (24h)" value={c.resolved + c.closed} icon="check_circle" iconColor="text-primary" subtext={c.closed > 0 ? `${c.closed} closed` : undefined} />
        <StatCard label="MTTR" value={data?.avgMttr ? formatMTTR(data.avgMttr) : '—'} icon="timer" iconColor="text-outline" subtext={data?.avgMttr ? 'avg' : undefined} />
      </div>

      {/* ─── Content Grid ─────────────────────────────────────── */}
      <div className="grid grid-cols-12 gap-4">
        {/* ─── Main Column ────────────────────────────────────── */}
        <div className="col-span-12 lg:col-span-8 flex flex-col gap-4">
          {/* Signal Ingestion Chart */}
          <div className="neu-flat rounded-xl p-5">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-h2 text-on-surface">Signal Ingestion Rate</h3>
              <div className="flex items-center gap-4">
                {metrics.length > 0 && (
                  <span className="text-h2 text-on-surface tabular-nums">{metrics[metrics.length - 1]?.signalsPerSecond ?? 0} <span className="text-body-sm text-on-surface-variant font-normal">sig/s</span></span>
                )}
                <div className="flex items-center gap-2 bg-surface-container rounded-2xl px-3 py-1">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  <span className="text-label-caps text-on-surface-variant">Live</span>
                </div>
              </div>
            </div>
            <div className="h-72 w-full bg-surface-container-lowest rounded-lg border border-outline-variant/30 overflow-hidden p-2">
              {metrics.length > 1 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={metrics} margin={{ top: 10, right: 10, left: -10, bottom: 5 }}>
                    <defs>
                      <linearGradient id="gradSignals" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#505f76" stopOpacity={0.35} />
                        <stop offset="95%" stopColor="#505f76" stopOpacity={0.02} />
                      </linearGradient>
                      <linearGradient id="gradBuffer" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#ba1a1a" stopOpacity={0.15} />
                        <stop offset="95%" stopColor="#ba1a1a" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e2e2" vertical={false} />
                    <XAxis
                      dataKey="timestamp"
                      tick={{ fontSize: 11, fontFamily: 'DM Mono', fill: '#7e7576' }}
                      axisLine={{ stroke: '#cfc4c5' }}
                      tickLine={false}
                      interval="preserveStartEnd"
                    />
                    <YAxis
                      tick={{ fontSize: 11, fontFamily: 'DM Mono', fill: '#7e7576' }}
                      axisLine={false}
                      tickLine={false}
                      width={40}
                    />
                    <Tooltip
                      contentStyle={{ background: '#fff', border: '1px solid #cfc4c5', borderRadius: '8px', fontFamily: 'DM Mono', fontSize: '12px', boxShadow: '4px 4px 10px rgba(0,0,0,0.08)' }}
                      labelStyle={{ color: '#7e7576', marginBottom: 4 }}
                      formatter={(value: number, name: string) => [value, name === 'signalsPerSecond' ? 'Signals/sec' : 'Buffer %']}
                    />
                    <Area type="monotone" dataKey="signalsPerSecond" name="signalsPerSecond" stroke="#505f76" strokeWidth={2} fill="url(#gradSignals)" dot={false} activeDot={{ r: 4, fill: '#505f76', stroke: '#fff', strokeWidth: 2 }} />
                    <Area type="monotone" dataKey="bufferUsage" name="bufferUsage" stroke="#ba1a1a" strokeWidth={1.5} fill="url(#gradBuffer)" dot={false} activeDot={{ r: 3, fill: '#ba1a1a', stroke: '#fff', strokeWidth: 2 }} />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex flex-col items-center justify-center h-full text-on-surface-variant text-body-sm gap-3">
                  <span className="material-symbols-outlined text-[32px] animate-pulse opacity-40">sensors</span>
                  <span>Collecting live data points...</span>
                  <span className="text-label-caps text-outline">Graph populates in ~3 seconds</span>
                </div>
              )}
            </div>
            <div className="flex items-center gap-6 mt-3 text-[11px] text-on-surface-variant">
              <div className="flex items-center gap-1.5"><span className="w-3 h-[2px] bg-secondary rounded-full inline-block" /> Signals/sec</div>
              <div className="flex items-center gap-1.5"><span className="w-3 h-[2px] bg-error rounded-full inline-block" /> Buffer Usage %</div>
              <span className="ml-auto text-outline">{metrics.length} data points · 3s interval</span>
            </div>
          </div>

          {/* Incidents Table */}
          <div className="neu-flat rounded-xl overflow-hidden">
            <div className="p-5 border-b border-surface-container flex justify-between items-center bg-surface-bright">
              <h3 className="text-h2 text-on-surface">Active Incidents</h3>
              <span className="text-label-caps text-on-surface-variant">{filteredIncidents.length} total</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-surface-container-lowest border-b border-outline-variant text-label-caps text-on-surface-variant">
                    <th className="py-3 px-5 font-semibold">ID</th>
                    <th className="py-3 px-5 font-semibold">Severity</th>
                    <th className="py-3 px-5 font-semibold">Component</th>
                    <th className="py-3 px-5 font-semibold">Status</th>
                    <th className="py-3 px-5 font-semibold">Age</th>
                    <th className="py-3 px-5 font-semibold text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="text-body-sm text-on-surface">
                  {filteredIncidents.slice(0, 10).map(incident => (
                    <IncidentRow key={incident.id} incident={incident} onClick={() => onSelectIncident(incident.id)} />
                  ))}
                  {(!data?.incidents || data.incidents.length === 0) && (
                    <tr>
                      <td colSpan={6} className="text-center py-16 text-outline">
                        <span className="material-symbols-outlined text-[32px] mb-2 block opacity-30">shield</span>
                        No active incidents — all clear
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* ─── Side Panel ─────────────────────────────────────── */}
        <div className="col-span-12 lg:col-span-4 flex flex-col gap-4">
          {/* On-Call Roster */}
          <OnCallRoster />

          {/* Event Log / Severity Breakdown */}
          <div className="neu-flat rounded-xl p-5 flex-grow flex flex-col">
            <h3 className="text-h2 text-on-surface mb-4">System Event Log</h3>
            <div className="relative pl-4 border-l-2 border-surface-container flex-grow space-y-4">
              {filteredIncidents.slice(0, 4).map((inc) => {
                const dotColor = inc.severity === 'P0' ? 'bg-error' : inc.severity === 'P1' ? 'bg-amber-500' : 'bg-outline-variant';
                return (
                  <LogItem
                    key={inc.id}
                    time={new Date(inc.startTime).toLocaleTimeString('en-US', { hour12: false })}
                    text={`${inc.severity} alert: ${inc.componentId} — ${inc.status}`}
                    color={dotColor}
                  />
                );
              })}
              {filteredIncidents.length === 0 && (
                <p className="text-body-sm text-outline py-4">No recent events</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
