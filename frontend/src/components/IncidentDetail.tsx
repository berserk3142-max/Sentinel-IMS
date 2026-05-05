import { useState, useEffect, useCallback } from 'react';
import { api, type Incident, type Signal, type RCA } from '@/lib/api';
import { formatAge, formatMTTR } from '@/lib/utils';

interface Props { incidentId: string; onBack: () => void; }

const STATUS_STEPS = [
  { key: 'OPEN', icon: 'radio_button_checked', label: 'OPEN' },
  { key: 'INVESTIGATING', icon: 'search', label: 'INVESTIGATING' },
  { key: 'RESOLVED', icon: 'build', label: 'RESOLVED' },
  { key: 'CLOSED', icon: 'check', label: 'CLOSED' },
];
const RCA_CATEGORIES = ['Network', 'Database', 'Memory', 'Config', 'ExternalDependency'];

export function IncidentDetail({ incidentId, onBack }: Props) {
  const [incident, setIncident] = useState<Incident | null>(null);
  const [signals, setSignals] = useState<Signal[]>([]);
  const [rca, setRca] = useState<RCA | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [transitioning, setTransitioning] = useState(false);
  const [rcaForm, setRcaForm] = useState({ root_cause_category: '', fix_applied: '', prevention_steps: '' });
  const [rcaError, setRcaError] = useState<string | null>(null);
  const [submittingRca, setSubmittingRca] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const res = await api.getIncident(incidentId);
      setIncident(res.incident); setSignals(res.signals); setRca(res.rca); setError(null);
    } catch (err: any) { setError(err.message); }
    finally { setLoading(false); }
  }, [incidentId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleTransition = async (next: string) => {
    setTransitioning(true); setError(null);
    try { await api.transitionIncident(incidentId, next); await fetchData(); }
    catch (err: any) { setError(err.message); }
    finally { setTransitioning(false); }
  };

  const handleRcaSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rcaForm.root_cause_category || !rcaForm.fix_applied || !rcaForm.prevention_steps) { setRcaError('All fields are required'); return; }
    setSubmittingRca(true); setRcaError(null);
    try { await api.submitRCA(incidentId, rcaForm); await api.transitionIncident(incidentId, 'CLOSED'); await fetchData(); }
    catch (err: any) { setRcaError(err.message); }
    finally { setSubmittingRca(false); }
  };

  if (loading) return (
    <div className="flex items-center justify-center h-[60vh]">
      <span className="material-symbols-outlined text-[48px] text-outline animate-spin">progress_activity</span>
    </div>
  );
  if (!incident) return <div className="text-center py-12 text-outline text-body-sm">Incident not found</div>;

  const currentStepIdx = STATUS_STEPS.findIndex(s => s.key === incident.status);
  const nextTransition = incident.allowedTransitions[0];

  const severityBg = incident.severity === 'P0' ? 'bg-error text-on-error'
    : incident.severity === 'P1' ? 'bg-amber-600 text-white'
    : 'bg-secondary text-on-secondary';

  const statusBg = incident.status === 'OPEN' ? 'bg-error-container text-on-error-container border border-error/20'
    : incident.status === 'INVESTIGATING' ? 'bg-amber-100 text-amber-800 border border-amber-300/40'
    : incident.status === 'RESOLVED' ? 'bg-emerald-100 text-emerald-800 border border-emerald-300/40'
    : 'bg-surface-container-highest text-on-surface-variant border border-outline-variant';

  return (
    <div className="flex justify-center items-start animate-fade-in-up">
      <article className="w-full max-w-5xl bg-surface-container-lowest rounded-xl border border-white/40 shadow-[8px_8px_20px_rgba(0,0,0,0.05),-8px_-8px_20px_rgba(255,255,255,0.8)] p-8 relative overflow-hidden mt-4">

        {/* ─── Header ─────────────────────────────────────────── */}
        <header className="flex justify-between items-start mb-10 pb-6 border-b border-surface-container-high">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <span className={`text-label-caps px-2 py-1 rounded ${severityBg}`}>{incident.severity}</span>
              <span className={`text-label-caps px-2 py-1 rounded ${statusBg}`}>{incident.status}</span>
            </div>
            <h1 className="text-h1 text-on-surface">{incident.componentId}</h1>
            <p className="text-body-sm text-on-surface-variant mt-1 flex items-center gap-2">
              <span className="material-symbols-outlined text-[16px]">tag</span>
              {incident.id}
            </p>
          </div>
          <button
            onClick={onBack}
            className="text-on-surface-variant hover:text-on-surface transition-colors p-2 rounded-full hover:bg-surface-variant cursor-pointer"
            aria-label="Close"
          >
            <span className="material-symbols-outlined">close</span>
          </button>
        </header>

        {error && (
          <div className="bg-error-container text-on-error-container rounded-lg p-3 text-body-sm flex items-center gap-2 mb-6">
            <span className="material-symbols-outlined text-[18px]">error</span> {error}
          </div>
        )}

        {/* ─── State Flow ─────────────────────────────────────── */}
        <section className="mb-10">
          <div className="flex items-center justify-between relative">
            {/* Connecting line */}
            <div className="absolute left-0 top-1/2 -translate-y-1/2 w-full h-px bg-outline-variant z-0" />

            {STATUS_STEPS.map((step, i) => {
              const isCurrent = i === currentStepIdx;
              const isPast = i < currentStepIdx;
              const isActive = isCurrent || isPast;

              let dotClass: string;
              let iconFill: string;

              if (isCurrent) {
                dotClass = 'bg-error-container border-2 border-error text-error shadow-[0_0_8px_rgba(186,26,26,0.4)]';
                iconFill = "'FILL' 1";
              } else if (isPast) {
                dotClass = 'bg-primary text-on-primary border-2 border-primary shadow-sm';
                iconFill = "'FILL' 1";
              } else {
                dotClass = 'bg-surface-container border border-outline text-on-surface-variant';
                iconFill = "'FILL' 0";
              }

              return (
                <div key={step.key} className={`relative z-10 flex flex-col items-center gap-2 ${!isActive ? 'opacity-50' : ''}`}>
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center transition-all duration-300 ${dotClass}`}>
                    <span className="material-symbols-outlined text-sm" style={{ fontVariationSettings: iconFill }}>
                      {isCurrent ? 'radio_button_checked' : step.icon}
                    </span>
                  </div>
                  <span className={`text-label-caps ${isCurrent ? 'text-error' : isPast ? 'text-primary' : 'text-on-surface-variant'}`}>
                    {step.label}
                  </span>
                </div>
              );
            })}
          </div>
        </section>

        {/* ─── Metrics Bento Grid ─────────────────────────────── */}
        <section className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 mb-10">
          <MetricCard label="STARTED" value={`${new Date(incident.startTime).toLocaleTimeString()}`} />
          <MetricCard label="AGE" value={formatAge(incident.age)} isError={incident.severity === 'P0'} />
          <MetricCard label="SIGNALS" value={incident.signalCount.toLocaleString()} />
          <MetricCard label="MTTR" value={formatMTTR(incident.mttrSeconds)} />
        </section>

        {/* ─── Signal Timeline ────────────────────────────────── */}
        <section className="bg-surface-container-low rounded-xl p-6 border border-outline-variant/50 mb-8">
          <h3 className="text-h2 text-on-surface mb-6 flex items-center gap-2">
            <span className="material-symbols-outlined text-primary">timeline</span>
            Signal Timeline
            <span className="text-on-surface-variant text-body-sm ml-1">({signals.length})</span>
          </h3>

          {signals.length > 0 ? (
            <div className="relative pl-6 border-l-2 border-outline-variant ml-2 space-y-6 max-h-[400px] overflow-y-auto pr-2">
              {signals.map((signal, i) => {
                const isError = signal.severity === 'critical' || signal.severity === 'high';
                const dotColor = isError
                  ? 'bg-error shadow-[0_0_8px_rgba(186,26,26,0.6)]'
                  : 'bg-secondary shadow-[0_0_6px_rgba(80,95,118,0.4)]';

                return (
                  <div key={signal.id} className="relative animate-fade-in" style={{ animationDelay: `${i * 40}ms` }}>
                    <div className={`absolute w-3 h-3 rounded-full -left-[31px] top-1 ${dotColor}`} />

                    <div className="flex items-center gap-3 mb-3">
                      <span className="text-data-mono text-on-surface-variant">
                        {new Date(signal.timestamp).toLocaleTimeString(undefined, { hour12: false, fractionalSecondDigits: 3 })}
                      </span>
                      <span className="text-label-caps bg-surface-container-highest px-2 py-1 rounded text-on-surface">
                        {signal.errorType}
                      </span>
                    </div>

                    {signal.rawPayload && Object.keys(signal.rawPayload).length > 0 && (
                      <div className="bg-primary-container rounded-lg p-4 shadow-inner overflow-x-auto border border-white/10">
                        <pre className="text-data-mono text-on-primary-container leading-relaxed m-0">
                          <code>{formatPayload(signal.rawPayload)}</code>
                        </pre>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-10 text-outline">
              <span className="material-symbols-outlined text-[32px] mb-2 block opacity-30">sensors_off</span>
              <p className="text-body-sm">No signals recorded</p>
            </div>
          )}
        </section>

        {/* ─── RCA Section (if RESOLVED and no RCA yet) ──────── */}
        {rca ? (
          <section className="bg-surface-container-low rounded-xl p-6 border border-outline-variant/50 mb-8 border-l-4 border-l-emerald-500">
            <h3 className="text-h2 text-on-surface mb-4 flex items-center gap-2">
              <span className="material-symbols-outlined text-emerald-600" style={{ fontVariationSettings: "'FILL' 1" }}>verified</span>
              Root Cause Analysis
            </h3>
            <div className="space-y-3 text-body-sm">
              <div className="flex gap-4"><span className="text-label-caps text-on-surface-variant min-w-[100px]">Category</span><span className="font-medium">{rca.rootCauseCategory}</span></div>
              <div className="flex gap-4"><span className="text-label-caps text-on-surface-variant min-w-[100px]">Fix Applied</span><span className="text-data-mono text-on-surface-variant">{rca.fixApplied}</span></div>
              <div className="flex gap-4"><span className="text-label-caps text-on-surface-variant min-w-[100px]">Prevention</span><span className="text-data-mono text-on-surface-variant">{rca.preventionSteps}</span></div>
            </div>
          </section>
        ) : incident.status === 'RESOLVED' ? (
          <section className="bg-surface-container-low rounded-xl p-6 border border-outline-variant/50 mb-8">
            <h3 className="text-h2 text-on-surface mb-4 flex items-center gap-2">
              <span className="material-symbols-outlined text-primary">assignment</span>
              Submit RCA to Close
            </h3>
            <form onSubmit={handleRcaSubmit} className="space-y-4">
              <div>
                <label className="text-label-caps text-on-surface-variant block mb-2">Root Cause Category</label>
                <select
                  className="w-full rounded-lg bg-surface-container-lowest border border-outline-variant p-3 text-body-sm text-on-surface focus:outline-none focus:ring-2 focus:ring-primary"
                  value={rcaForm.root_cause_category}
                  onChange={e => setRcaForm({ ...rcaForm, root_cause_category: e.target.value })}
                >
                  <option value="">Select a category...</option>
                  {RCA_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label className="text-label-caps text-on-surface-variant block mb-2">Fix Applied</label>
                <textarea
                  className="w-full rounded-lg bg-surface-container-lowest border border-outline-variant p-3 text-body-sm h-24 resize-none focus:outline-none focus:ring-2 focus:ring-primary"
                  placeholder="Describe the remediation steps taken..."
                  value={rcaForm.fix_applied}
                  onChange={e => setRcaForm({ ...rcaForm, fix_applied: e.target.value })}
                />
              </div>
              <div>
                <label className="text-label-caps text-on-surface-variant block mb-2">Prevention Steps</label>
                <textarea
                  className="w-full rounded-lg bg-surface-container-lowest border border-outline-variant p-3 text-body-sm h-24 resize-none focus:outline-none focus:ring-2 focus:ring-primary"
                  placeholder="How will we prevent recurrence..."
                  value={rcaForm.prevention_steps}
                  onChange={e => setRcaForm({ ...rcaForm, prevention_steps: e.target.value })}
                />
              </div>
              {rcaError && <p className="text-body-sm text-error">{rcaError}</p>}
              <button
                type="submit"
                disabled={submittingRca}
                className="w-full bg-primary text-on-primary py-3 rounded-lg text-body-sm font-semibold cursor-pointer hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {submittingRca ? 'Submitting...' : (
                  <>Submit RCA &amp; Close Incident <span className="material-symbols-outlined text-sm">lock</span></>
                )}
              </button>
            </form>
          </section>
        ) : null}

        {/* ─── Actions Footer ─────────────────────────────────── */}
        <footer className="pt-6 border-t border-surface-container-high flex justify-end gap-4">
          <button
            onClick={onBack}
            className="text-body-sm px-6 py-2.5 rounded-lg text-on-surface bg-surface border border-outline hover:bg-surface-variant transition-colors cursor-pointer"
          >
            Back to Dashboard
          </button>
          {nextTransition && nextTransition !== 'CLOSED' && (
            <button
              onClick={() => handleTransition(nextTransition)}
              disabled={transitioning}
              className="text-body-sm font-semibold px-6 py-2.5 rounded-lg bg-primary text-on-primary shadow-[4px_4px_10px_rgba(0,0,0,0.1),-2px_-2px_5px_rgba(255,255,255,0.5)] hover:-translate-y-0.5 hover:shadow-lg transition-all duration-300 flex items-center gap-2 cursor-pointer disabled:opacity-50 active:scale-95"
            >
              {transitioning ? 'Processing...' : `Move to ${nextTransition}`}
              <span className="material-symbols-outlined text-sm">arrow_forward</span>
            </button>
          )}
          {nextTransition === 'CLOSED' && rca && (
            <button
              onClick={() => handleTransition('CLOSED')}
              disabled={transitioning}
              className="text-body-sm font-semibold px-6 py-2.5 rounded-lg bg-primary text-on-primary shadow-[4px_4px_10px_rgba(0,0,0,0.1),-2px_-2px_5px_rgba(255,255,255,0.5)] hover:-translate-y-0.5 hover:shadow-lg transition-all duration-300 flex items-center gap-2 cursor-pointer disabled:opacity-50 active:scale-95"
            >
              {transitioning ? 'Closing...' : 'Close Incident'}
              <span className="material-symbols-outlined text-sm">check</span>
            </button>
          )}
        </footer>
      </article>
    </div>
  );
}

/* ─── Sub-components ──────────────────────────────────────────── */

function MetricCard({ label, value, isError = false }: { label: string; value: string | number; isError?: boolean }) {
  return (
    <div className="bg-surface border border-white/50 p-5 rounded-lg shadow-[inset_2px_2px_5px_rgba(255,255,255,0.8),inset_-2px_-2px_5px_rgba(0,0,0,0.02),2px_2px_8px_rgba(0,0,0,0.05)] hover:-translate-y-0.5 hover:shadow-md transition-all duration-300">
      <div className="text-label-caps text-on-surface-variant mb-2">{label}</div>
      <div className={`text-data-mono font-semibold ${isError ? 'text-error' : 'text-on-surface'}`}>{value}</div>
    </div>
  );
}

function formatPayload(payload: Record<string, any>): string {
  return JSON.stringify(payload, null, 2);
}
