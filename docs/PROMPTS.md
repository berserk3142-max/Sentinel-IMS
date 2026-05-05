# SentinelIMS — Prompts & Design Decisions

This document captures the key prompts, design decisions, and iterative refinements used to build SentinelIMS from scratch.

---

## Initial Prompt

> Build a high-throughput incident management system (IMS) with the following characteristics:
> - Signal ingestion endpoint handling 10k+ signals/sec
> - Ring buffer for backpressure (fixed-size circular buffer)
> - Debounce engine to aggregate signals into work items per component
> - Strategy pattern for severity-based alerting (P0/P1/P2)
> - Strict state machine for incident lifecycle (OPEN → INVESTIGATING → RESOLVED → CLOSED)
> - Mandatory RCA (Root Cause Analysis) before closing any incident
> - Real-time dashboard with live charts using Socket.IO
> - PostgreSQL backend with Drizzle ORM on Neon

## Architecture Design Prompts

### Backend Engine Design

> Design the ingestion pipeline with these layers:
> 1. Rate Limiter (Fastify plugin, 5000 req/sec)
> 2. Ring Buffer (50,000 slots, O(1) push/pop, backpressure on full)
> 3. Drain Loop (100ms interval, pops batches of 100)
> 4. Debounce Engine (10s window, batches signals per component)
> 5. Worker Pool (retry with exponential backoff for DB writes)

### State Machine Design

> Implement a validated state machine for work items:
> - OPEN → INVESTIGATING → RESOLVED → CLOSED
> - No transition skipping
> - MTTR auto-calculated when transitioning to RESOLVED
> - RCA guard: RESOLVED → CLOSED requires complete RCA record
> - Return allowed transitions in every API response

### Alert Strategy Pattern

> Use the Strategy design pattern for alerts:
> - Interface: AlertStrategy { priority, notify(workItem) }
> - P0CriticalAlert: immediate page for RDBMS, MCP, PRIMARY_DB components
> - P1HighAlert: team notification for API, SERVICE, GATEWAY components
> - P2LowAlert: logged for review for CACHE, CDN, QUEUE components
> - AlertFactory: maps component_id prefix → severity → strategy

## Frontend Design Prompts

### Dashboard Layout

> Create a command center dashboard with:
> - Neumorphic/glassmorphic design with Material Design 3 tokens
> - Sidebar navigation: Dashboard, Incidents, Metrics, Signals, Teams
> - Live signal ingestion chart using Recharts (area chart with gradient fill)
> - Stats cards with animated counters
> - Active incidents table with severity badges
> - On-call roster widget with chat functionality

### Real-time Metrics

> Implement a useMetrics hook with three data sources:
> 1. Seed: GET /api/metrics for historical DB snapshots
> 2. Socket: Listen for Socket.IO 'metrics' events
> 3. Fallback: Poll GET /health every 2s for live data points
>
> Graph must always be visible — seed with synthetic data on mount,
> then smoothly transition to real data as it arrives.

### Terminal Feature

> Add an interactive terminal panel to the sidebar:
> - Dark themed terminal with macOS-style title bar
> - Commands: health, incidents, buffer, metrics, uptime, send, flood, clear, help
> - All commands fetch real data from the backend API
> - Command history with up/down arrow navigation
> - flood command sends burst of signals to stress test the graph

## Iterative Refinements

### Problem: Graph not showing on first load
> The Signal Ingestion Rate chart was blank until real data arrived because
> `metrics.length > 1` was required to render the chart. Fixed by seeding
> with 10 synthetic data points immediately on mount.

### Problem: Graph flashing blank
> When first real data point arrived, seed-stripping logic (`filter(p => !p._seed)`)
> removed all 10 seed points at once, leaving only 1 point. Chart required > 1 points
> so it flashed to placeholder. Fixed by removing aggressive seed stripping —
> real data just appends and the 60-point sliding window naturally pushes seed out.

### Problem: Terminal button not functional
> The Terminal sidebar button had no onClick handler. Added full TerminalPanel
> component with dark theme, command execution, history navigation, and
> real API integration.

## Design Principles

1. **Honest HTTP semantics** — 202 Accepted (not 200 OK) for buffered signals
2. **Backpressure over crash** — Ring buffer rejects with 429 rather than OOM
3. **Idempotency** — Unique constraint on (component_id, window_start)
4. **Progressive data loading** — Seed → historical → real-time (never blank)
5. **Mandatory accountability** — No incident closure without structured RCA
6. **Strategy pattern** — Alert behavior varies by severity, not by conditionals
7. **State machine rigor** — Invalid transitions return error with allowed options
