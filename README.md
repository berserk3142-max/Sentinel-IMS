# 🛡️ SentinelIMS — Incident Management System

A **high-throughput signal ingestion and incident management platform** with real-time dashboards, automated debouncing, strategy-pattern alerting, state machine work items, and mandatory RCA enforcement.

Built to handle **10,000+ signals/sec** with backpressure, deduplication, and zero data loss.

---

## Table of Contents

- [System Overview](#system-overview)
- [How It Works — End to End](#how-it-works--end-to-end)
- [Signal Ingestion Pipeline](#signal-ingestion-pipeline)
- [Backpressure & Ring Buffer](#backpressure--ring-buffer)
- [Debounce Engine](#debounce-engine)
- [Alert Strategy Pattern](#alert-strategy-pattern)
- [Incident State Machine](#incident-state-machine)
- [RCA Enforcement](#rca-enforcement)
- [Real-Time Dashboard](#real-time-dashboard)
- [Metrics Collection](#metrics-collection)
- [Database Schema](#database-schema)
- [Tech Stack](#tech-stack)
- [API Reference](#api-reference)
- [Project Structure](#project-structure)
- [Quick Start](#quick-start)
- [Running Tests](#running-tests)
- [Simulation Script](#simulation-script)

---

## System Overview

```mermaid
graph TB
    subgraph Producers["Signal Producers"]
        SIM["simulate.ts"]
        CURL["curl / External Systems"]
        UI["Frontend UI"]
    end

    subgraph Backend["Fastify Backend :3001"]
        RL["Rate Limiter<br/>5000 req/sec"]
        RB["Ring Buffer<br/>50,000 slots"]
        DL["Drain Loop<br/>100ms interval"]
        DE["Debounce Engine<br/>10s window"]
        AS["Alert Strategy<br/>P0 / P1 / P2"]
        SM["State Machine<br/>OPEN → CLOSED"]
        WP["Worker Pool<br/>Retry + Backoff"]
        API["REST API"]
        SIO["Socket.IO"]
        MC["Metrics Collector<br/>5s interval"]
    end

    subgraph Database["Neon PostgreSQL"]
        WI["work_items"]
        SG["signals"]
        RCA["rca_records"]
        MS["metrics_snapshots"]
    end

    subgraph Frontend["React Frontend :5173"]
        DASH["Live Dashboard"]
        INC["Incident Detail"]
        RCAF["RCA Form"]
        CHART["Throughput Chart"]
        TEAM["Team Chat"]
    end

    Producers -->|POST /api/signals| RL
    RL --> RB
    RB -->|popBatch| DL
    DL --> DE
    DE --> AS
    DE --> WP
    WP --> WI
    WP --> SG
    SM --> WI
    API --> SM
    API --> RCA
    MC --> MS
    SIO -->|metrics, incident:updated| Frontend
    Frontend -->|HTTP + WebSocket| API
```

---

## How It Works — End to End

This flowchart shows the **complete lifecycle** of a signal from ingestion to incident closure:

```mermaid
flowchart TD
    A["🔔 Signal Arrives<br/>POST /api/signals"] --> B{"Rate Limit<br/>< 5000/sec?"}
    B -->|No| C["429 Too Many Requests"]
    B -->|Yes| D{"Ring Buffer<br/>has space?"}
    D -->|No| E["429 Buffer Full<br/>Backpressure Applied"]
    D -->|Yes| F["Push to Ring Buffer<br/>O(1) operation"]
    F --> G["Return 202 Accepted"]

    F --> H["Drain Loop picks up<br/>every 100ms, batch of 100"]
    H --> I{"Debounce entry<br/>exists for component?"}
    I -->|No| J["Create Work Item in DB<br/>Start 10s debounce timer"]
    J --> K["Fire Alert Strategy<br/>P0/P1/P2"]
    I -->|Yes| L["Append signal to batch<br/>Increment counter"]
    L --> M{"Batch ≥ 50<br/>signals?"}
    M -->|Yes| N["Flush signals to DB"]
    M -->|No| O["Wait for more signals"]

    J --> P["Timer fires after 10s"]
    P --> Q["Flush remaining signals<br/>Close debounce window"]

    Q --> R["Work Item ready<br/>Status: OPEN"]
    R --> S["Operator investigates"]
    S --> T["OPEN → INVESTIGATING"]
    T --> U["INVESTIGATING → RESOLVED<br/>MTTR calculated"]
    U --> V["Submit RCA<br/>root cause + fix + prevention"]
    V --> W["RESOLVED → CLOSED<br/>RCA guard passes ✅"]

    style C fill:#ffcdd2,stroke:#b71c1c
    style E fill:#ffcdd2,stroke:#b71c1c
    style G fill:#c8e6c9,stroke:#2e7d32
    style W fill:#c8e6c9,stroke:#2e7d32
    style K fill:#fff9c4,stroke:#f57f17
```

---

## Signal Ingestion Pipeline

The ingestion pipeline is designed for **maximum throughput** with complete decoupling between the fast HTTP path and the slower database persistence path.

```mermaid
sequenceDiagram
    participant Client
    participant Fastify as Fastify + Rate Limiter
    participant Buffer as Ring Buffer (50K)
    participant Drain as Drain Loop (100ms)
    participant Debounce as Debounce Engine
    participant DB as PostgreSQL

    Client->>Fastify: POST /api/signals
    Fastify->>Fastify: Rate limit check (5000/sec)
    Fastify->>Buffer: push(signal) — O(1)
    Buffer-->>Fastify: true/false
    Fastify-->>Client: 202 Accepted

    Note over Drain: Every 100ms
    Drain->>Buffer: popBatch(100)
    Buffer-->>Drain: Signal[]
    Drain->>Debounce: process(signal) for each

    alt New Component
        Debounce->>DB: INSERT work_item
        Debounce->>DB: INSERT signal
        Debounce->>Debounce: Start 10s timer
    else Existing Component
        Debounce->>Debounce: Append to pending batch
    end

    Note over Debounce: When batch ≥ 50 or timer fires
    Debounce->>DB: Batch INSERT signals
    Debounce->>DB: UPDATE work_item signal_count
```

### Key Design Decisions

| Decision | Rationale |
|----------|-----------|
| **202 Accepted** (not 200 OK) | Signal is buffered, not yet persisted — honest HTTP semantics |
| **Ring Buffer** over queue | O(1) push/pop, fixed memory, no GC pressure |
| **100ms drain interval** | Balances latency vs. throughput — 1000 signals/sec sustained |
| **Fire-and-forget processing** | Drain loop doesn't await DB writes — keeps the loop fast |

---

## Backpressure & Ring Buffer

The Ring Buffer is a **fixed-size circular buffer** (50,000 slots) that provides backpressure when the database can't keep up with ingestion.

```mermaid
flowchart LR
    subgraph RingBuffer["Ring Buffer (Capacity: 50,000)"]
        direction LR
        TAIL["🔴 tail<br/>(read position)"]
        SLOTS["... filled slots ..."]
        HEAD["🟢 head<br/>(write position)"]
    end

    PUSH["push(signal)"] --> CHECK{"count < capacity?"}
    CHECK -->|Yes| WRITE["Write at head<br/>head = (head+1) % cap<br/>count++"]
    CHECK -->|No| DROP["Return false<br/>Caller sends 429"]

    POP["pop()"] --> CHECKR{"count > 0?"}
    CHECKR -->|Yes| READ["Read at tail<br/>tail = (tail+1) % cap<br/>count--"]
    CHECKR -->|No| NULL["Return null"]

    style DROP fill:#ffcdd2,stroke:#b71c1c
    style WRITE fill:#c8e6c9,stroke:#2e7d32
```

**How it prevents crashes:**
- If signals arrive at 10,000/sec but DB can only write 1,000/sec, the buffer absorbs the burst
- When the buffer fills, new signals get a `429` response — the producer knows to back off
- The buffer never allocates more memory — zero risk of OOM

---

## Debounce Engine

The Debounce Engine **aggregates many signals into single Work Items** per component within a 10-second window.

```mermaid
flowchart TD
    SIG["Signal arrives for<br/>component X"] --> CHECK{"Entry exists<br/>for component X?"}

    CHECK -->|No — First signal| CREATE["Create new entry"]
    CREATE --> DB1["INSERT work_item<br/>(status: OPEN)"]
    DB1 --> DB2["INSERT first signal"]
    DB2 --> ALERT["Fire AlertStrategy<br/>based on severity"]
    ALERT --> TIMER["Start 10s timer"]
    TIMER --> MAP["Store in Map:<br/>componentId → entry"]

    CHECK -->|Yes — Subsequent signal| APPEND["Append to<br/>pendingSignals[]<br/>signalCount++"]
    APPEND --> BCHECK{"pendingSignals<br/>≥ 50?"}
    BCHECK -->|Yes| FLUSH["Batch INSERT signals<br/>UPDATE work_item count"]
    BCHECK -->|No| WAIT["Accumulate more"]

    MAP --> EXPIRE["Timer fires (10s)"]
    EXPIRE --> FFLUSH["Flush remaining signals"]
    FFLUSH --> CLEAR["Delete entry from Map<br/>Window closed"]

    style CREATE fill:#e3f2fd,stroke:#1565c0
    style FLUSH fill:#fff9c4,stroke:#f57f17
    style CLEAR fill:#f3e5f5,stroke:#7b1fa2
```

**Example:** 150 signals for `RDBMS_PRIMARY_01` in 8 seconds → **1 Work Item** with 150 linked signals.

The `(component_id, window_start)` unique constraint ensures **idempotency** — concurrent requests for the same component in the same window won't create duplicates.

---

## Alert Strategy Pattern

The system uses the **Strategy design pattern** to handle alerts differently based on severity. A factory selects the correct strategy from the component ID.

```mermaid
flowchart TD
    SIG["New Work Item Created"] --> FACTORY["AlertFactory.create(severity)"]

    FACTORY --> DET["determineSeverity(componentId)"]
    DET --> MAP{"Component prefix?"}

    MAP -->|"RDBMS_, MCP_, PRIMARY_DB_"| P0["P0 — Critical"]
    MAP -->|"API_, SERVICE_, GATEWAY_"| P1["P1 — High"]
    MAP -->|"CACHE_, CDN_, QUEUE_"| P2["P2 — Low"]
    MAP -->|"Unknown prefix"| P1D["P1 — Default"]

    P0 --> A0["🚨 P0CriticalAlert.notify()<br/>IMMEDIATE PAGE<br/>All hands on deck"]
    P1 --> A1["⚠️ P1HighAlert.notify()<br/>Team notification<br/>Slack #incidents"]
    P2 --> A2["ℹ️ P2LowAlert.notify()<br/>Logged for review<br/>Low priority"]
    P1D --> A1

    style A0 fill:#ffcdd2,stroke:#b71c1c
    style A1 fill:#fff9c4,stroke:#f57f17
    style A2 fill:#e3f2fd,stroke:#1565c0
```

### Extending Alerts

To add a new alert channel (e.g., PagerDuty, Opsgenie), implement the `AlertStrategy` interface:

```typescript
interface AlertStrategy {
  readonly priority: string;
  notify(workItem: WorkItem): Promise<void>;
}
```

---

## Incident State Machine

Every Work Item follows a **strict state machine** with validated transitions and an RCA guard on closure.

```mermaid
stateDiagram-v2
    [*] --> OPEN : Work Item created
    OPEN --> INVESTIGATING : Operator begins triage
    INVESTIGATING --> RESOLVED : Fix applied, MTTR calculated
    RESOLVED --> CLOSED : RCA submitted ✅

    RESOLVED --> CLOSED : ❌ Rejected if no RCA

    note right of OPEN
        Created by Debounce Engine
        when first signal arrives
    end note

    note right of INVESTIGATING
        Operator has acknowledged
        and is working on the issue
    end note

    note right of RESOLVED
        Fix deployed, endTime set
        MTTR = endTime - startTime
    end note

    note right of CLOSED
        Requires complete RCA:
        • Root cause category
        • Fix applied
        • Prevention steps
    end note
```

### Transition Validation

```mermaid
flowchart TD
    REQ["POST /incidents/:id/transition<br/>{next: 'RESOLVED'}"] --> LOAD["Load work item from DB"]
    LOAD --> VAL{"Is transition<br/>current → next<br/>in allowed table?"}
    VAL -->|No| ERR1["400 InvalidTransitionError<br/>Returns allowed transitions"]
    VAL -->|Yes| GUARD{"next === CLOSED?"}
    GUARD -->|No| APPLY["Apply transition<br/>Update status in DB"]
    GUARD -->|Yes| RCA{"Complete RCA<br/>record exists?"}
    RCA -->|No| ERR2["400 MissingRCAError<br/>Cannot close without RCA"]
    RCA -->|Yes| APPLY

    APPLY --> MTTR{"next === RESOLVED?"}
    MTTR -->|Yes| CALC["Set endTime = now()<br/>mttrSeconds = end - start"]
    MTTR -->|No| SKIP["No MTTR calculation"]

    CALC --> EMIT["Socket.IO emit<br/>incident:updated"]
    SKIP --> EMIT
    EMIT --> RESP["200 OK + updated incident"]

    style ERR1 fill:#ffcdd2,stroke:#b71c1c
    style ERR2 fill:#ffcdd2,stroke:#b71c1c
    style RESP fill:#c8e6c9,stroke:#2e7d32
```

---

## RCA Enforcement

The system **mandates Root Cause Analysis** before any incident can be closed. This ensures organizational learning from every incident.

```mermaid
flowchart TD
    INC["Incident in RESOLVED state"] --> SUB["POST /incidents/:id/rca"]
    SUB --> VALID{"All fields present?<br/>• root_cause_category<br/>• fix_applied<br/>• prevention_steps"}
    VALID -->|No| R1["400 — All fields required"]
    VALID -->|Yes| CAT{"Category valid?<br/>Network / Database /<br/>Memory / Config /<br/>ExternalDependency"}
    CAT -->|No| R2["400 — Invalid category"]
    CAT -->|Yes| SAVE["Upsert RCA record"]
    SAVE --> EMIT["Socket.IO emit<br/>incident:rca"]
    EMIT --> CLOSE["Now RESOLVED → CLOSED<br/>transition will succeed ✅"]

    style R1 fill:#ffcdd2
    style R2 fill:#ffcdd2
    style CLOSE fill:#c8e6c9,stroke:#2e7d32
```

---

## Real-Time Dashboard

The frontend combines **HTTP polling + Socket.IO** for a responsive real-time experience.

```mermaid
flowchart LR
    subgraph Backend
        HEALTH["/health endpoint"]
        DASH["/api/dashboard"]
        METRICS["/api/metrics"]
        SOCKET["Socket.IO Server"]
    end

    subgraph Frontend
        HOOK1["useDashboard()<br/>polls every 5s"]
        HOOK2["useHealth()<br/>polls every 10s"]
        HOOK3["useMetrics()<br/>seed + poll 3s + socket"]
        SOCK["useSocket()<br/>WebSocket connection"]
    end

    HOOK1 -->|GET| DASH
    HOOK2 -->|GET| HEALTH
    HOOK3 -->|GET seed| METRICS
    HOOK3 -->|GET fallback| HEALTH
    SOCK <-->|WebSocket| SOCKET
    SOCKET -->|"metrics event"| HOOK3
    SOCKET -->|"incident:updated"| HOOK1
    SOCKET -->|"incident:rca"| HOOK1
```

### Frontend Views

| View | Description |
|------|-------------|
| **Dashboard** | Live stats, signal ingestion chart, active incidents table, on-call roster, event log |
| **Incidents** | Paginated, sortable incident list with severity badges and status indicators |
| **Metrics** | System metrics cards + throughput-over-time area chart |
| **Signals** | Raw signal feed table grouped by component |
| **Teams** | Team roster with real-time chat (simulated auto-replies) |
| **Incident Detail** | Signal timeline, state transition buttons, RCA form, MTTR display |

---

## Metrics Collection

The Metrics Collector runs a **5-second interval loop** that captures system throughput and pushes it to the frontend via Socket.IO and stores snapshots in PostgreSQL.

```mermaid
flowchart TD
    TICK["MetricsCollector.tick()<br/>Every 5 seconds"] --> CALC["Calculate signals/sec<br/>= signalsSinceLastTick / 5"]
    CALC --> RESET["Reset signalsSinceLastTick = 0"]
    RESET --> COUNT["Query DB: count active<br/>OPEN + INVESTIGATING incidents"]
    COUNT --> BUILD["Build MetricsData snapshot"]
    BUILD --> LOG["Console log:<br/>Signals/sec | Buffer | Active"]
    BUILD --> PUSH["Socket.IO emit('metrics', data)"]
    BUILD --> STORE["INSERT into metrics_snapshots<br/>(fire and forget)"]

    PUSH --> CHART["Frontend chart updates<br/>in real-time"]
    STORE --> HISTORY["Historical data available<br/>via GET /api/metrics"]
```

---

## Database Schema

Four tables in **Neon PostgreSQL** managed by **Drizzle ORM**:

```mermaid
erDiagram
    WORK_ITEMS {
        uuid id PK
        varchar component_id
        enum status "OPEN|INVESTIGATING|RESOLVED|CLOSED"
        enum severity "P0|P1|P2"
        timestamp start_time
        timestamp end_time
        int mttr_seconds
        timestamp window_start
        int signal_count
        timestamp created_at
        timestamp updated_at
    }

    SIGNALS {
        uuid id PK
        uuid work_item_id FK
        varchar component_id
        varchar error_type
        varchar severity
        jsonb raw_payload
        timestamp timestamp
    }

    RCA_RECORDS {
        uuid id PK
        uuid work_item_id FK "UNIQUE"
        enum root_cause_category "Network|Database|Memory|Config|ExternalDependency"
        text fix_applied
        text prevention_steps
        timestamp submitted_at
    }

    METRICS_SNAPSHOTS {
        uuid id PK
        int signals_per_second
        int buffer_usage
        int buffer_capacity
        int active_incidents
        int total_signals_processed
        timestamp timestamp
    }

    WORK_ITEMS ||--o{ SIGNALS : "has many"
    WORK_ITEMS ||--o| RCA_RECORDS : "has one"
```

### Indexes

| Index | Table | Purpose |
|-------|-------|---------|
| `uq_component_window` | work_items | Unique constraint for debounce idempotency |
| `idx_work_items_status` | work_items | Fast status filtering |
| `idx_work_items_severity` | work_items | Fast severity filtering |
| `idx_signals_work_item_ts` | signals | Fast signal timeline queries |
| `idx_metrics_ts` | metrics_snapshots | Fast time-series queries |

---

## Tech Stack

| Layer | Technology | Justification |
|-------|-----------|---------------|
| Runtime | Node.js 20+ | Async-first, high throughput |
| Backend | Fastify 5 (TypeScript) | 2-3x faster than Express, built-in validation |
| ORM | Drizzle ORM | Type-safe, lightweight, great Neon support |
| Database | Neon PostgreSQL | Cloud-hosted serverless Postgres |
| Real-time | Socket.IO | Reliable WebSocket abstraction |
| Rate Limiting | @fastify/rate-limit | Built for Fastify, zero config |
| Frontend | React 19 + Vite 8 | Fast dev server, optimized builds |
| UI Library | shadcn/ui + Radix | Beautiful, accessible, customizable |
| Styling | TailwindCSS v4 | Utility-first CSS with Vite plugin |
| Charts | Recharts | React-native charting for dashboards |
| Testing | Vitest | Fast, Vite-native, TypeScript-first |

---

## API Reference

| Method | Endpoint | Description | Response |
|--------|----------|-------------|----------|
| `POST` | `/api/signals` | Ingest single signal | `202` Accepted / `429` Buffer full |
| `POST` | `/api/signals/batch` | Batch ingest (up to 500) | `202` / `207` Partial |
| `GET` | `/api/dashboard` | Live feed summary with counts | Dashboard data |
| `GET` | `/api/incidents` | Paginated incident list | Incidents + pagination |
| `GET` | `/api/incidents/:id` | Incident detail + signals + RCA | Full incident data |
| `POST` | `/api/incidents/:id/transition` | State change | Updated incident |
| `POST` | `/api/incidents/:id/rca` | Submit RCA | RCA record |
| `GET` | `/api/metrics` | Throughput history snapshots | Metrics array |
| `GET` | `/api/buffer/status` | Ring buffer usage stats | Buffer data |
| `GET` | `/health` | System health + DB latency | Health data |

### Signal Payload

```json
{
  "component_id": "RDBMS_PRIMARY_01",
  "error_type": "ConnectionTimeout",
  "severity": "critical",
  "metadata": { "latency_ms": 5200 }
}
```

### RCA Payload

```json
{
  "root_cause_category": "Database",
  "fix_applied": "Increased connection pool size from 10 to 50",
  "prevention_steps": "Add pool monitoring alerts at 80% utilization"
}
```

---

## Project Structure

```
SentinelIMS/
├── backend/
│   ├── src/
│   │   ├── buffer/
│   │   │   └── RingBuffer.ts        # Fixed-size circular buffer (backpressure)
│   │   ├── debounce/
│   │   │   └── DebounceEngine.ts     # Signal → Work Item aggregation (10s window)
│   │   ├── ingestion/
│   │   │   └── drainLoop.ts          # Background loop: buffer → debounce (100ms)
│   │   ├── metrics/
│   │   │   └── MetricsCollector.ts   # Throughput tracking + Socket.IO push (5s)
│   │   ├── routes/
│   │   │   ├── ingestion.ts          # POST /api/signals, /api/signals/batch
│   │   │   ├── incidents.ts          # CRUD, transitions, RCA, dashboard, metrics
│   │   │   └── health.ts             # GET /health
│   │   ├── state/
│   │   │   └── StateMachine.ts       # Transition validation + MTTR + RCA guard
│   │   ├── strategies/
│   │   │   └── AlertStrategy.ts      # Strategy pattern: P0/P1/P2 + Factory
│   │   ├── workers/
│   │   │   └── WorkerPool.ts         # Concurrency control + exponential backoff
│   │   ├── db/
│   │   │   ├── schema.ts             # Drizzle ORM table definitions
│   │   │   └── index.ts              # Neon connection
│   │   └── server.ts                 # Main entry: wires everything together
│   ├── tests/
│   │   ├── ringBuffer.test.ts        # Buffer push/pop/overflow tests
│   │   └── stateMachine.test.ts      # Transition validation + RCA guard tests
│   ├── drizzle.config.ts
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── Dashboard.tsx         # Main dashboard with all sub-views
│   │   │   ├── IncidentDetail.tsx    # Detail view with signals + RCA form
│   │   │   └── ui/                   # shadcn/ui components
│   │   ├── hooks/
│   │   │   └── useSocket.ts          # Socket.IO + dashboard + health + metrics hooks
│   │   ├── lib/
│   │   │   ├── api.ts                # HTTP client for all endpoints
│   │   │   └── utils.ts              # Formatting helpers
│   │   ├── App.tsx                   # App shell with sidebar navigation
│   │   ├── main.tsx                  # React entry point
│   │   └── index.css                 # Design system tokens + neumorphic styles
│   ├── vite.config.ts                # Vite + proxy to backend
│   └── package.json
├── scripts/
│   └── simulate.ts                   # End-to-end demo simulation
└── README.md
```

---

## Quick Start

### Prerequisites

- **Node.js 20+** and **npm**
- A **Neon PostgreSQL** database (or any Postgres with connection string)

### Setup

```bash
# Clone the repository
git clone <repo-url>
cd SentinelIMS

# ─── Backend ───────────────────────────────
cd backend
npm install

# Create .env with your database URL
echo "DATABASE_URL=postgresql://..." > .env

# Push schema to database
npx drizzle-kit push

# Start backend (port 3001)
npm run dev

# ─── Frontend (new terminal) ──────────────
cd frontend
npm install

# Start frontend (port 5173)
npm run dev
```

Open **http://localhost:5173** in your browser.

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `DATABASE_URL` | — | Neon PostgreSQL connection string (required) |
| `PORT` | `3001` | Backend server port |
| `HOST` | `0.0.0.0` | Backend bind address |
| `BUFFER_CAPACITY` | `50000` | Ring buffer size |
| `DRAIN_INTERVAL_MS` | `100` | Drain loop tick interval |
| `DEBOUNCE_WINDOW_MS` | `10000` | Debounce aggregation window |
| `RATE_LIMIT_MAX` | `5000` | Max requests per second per IP |

---

## Running Tests

```bash
cd backend
npm test          # Run all tests once
npm run test:watch  # Watch mode
```

Tests cover:
- **RingBuffer:** push, pop, batch pop, overflow behavior, capacity tracking
- **StateMachine:** valid transitions, invalid transitions, RCA guard enforcement, MTTR calculation

---

## Simulation Script

The simulation script demonstrates the **full incident lifecycle** end-to-end:

```bash
# From project root (backend must be running)
npx tsx scripts/simulate.ts
```

```mermaid
flowchart TD
    S1["Step 1: Send 150 signals<br/>RDBMS_PRIMARY_01 (P0)<br/>over ~8 seconds"]
    S1 --> S2["Step 2: Wait 2s, send 80 signals<br/>CACHE_CLUSTER_01 (P2)"]
    S2 --> S3["Step 3: Wait 12s for<br/>debounce windows to flush"]
    S3 --> S4["Step 4: Check dashboard<br/>Verify incidents created"]
    S4 --> S5["Step 5: Transition RDBMS<br/>OPEN → INVESTIGATING → RESOLVED"]
    S5 --> S6["Step 6: Submit RCA<br/>Category: Database"]
    S6 --> S7["Step 7: Close RDBMS incident<br/>RESOLVED → CLOSED ✅"]
    S7 --> S8["Step 8: Try closing CACHE<br/>without RCA → 400 ❌"]
    S8 --> S9["✅ Simulation Complete"]

    style S7 fill:#c8e6c9,stroke:#2e7d32
    style S8 fill:#fff9c4,stroke:#f57f17
```

### Expected Output

```
📡 Step 1: Sending 150 signals for RDBMS_PRIMARY_01 (P0)...
  ✅ 150 signals sent

📡 Step 2: Sending 80 signals for CACHE_CLUSTER_01 (P2)...
  ✅ 80 signals sent

📊 Step 3: Dashboard shows 2 new incidents

🔄 Step 4: OPEN → INVESTIGATING ✅ → RESOLVED ✅

📝 Step 5: RCA submitted ✅

🔒 Step 6: RESOLVED → CLOSED ✅ (has RCA)

🧪 Step 7: Close without RCA → ✅ Correctly rejected (400)
```

---

## Worker Pool & Retry Logic

The Worker Pool wraps every database write with **exponential backoff retry** to handle transient failures:

```mermaid
flowchart TD
    TASK["DB Write Task"] --> A1["Attempt 1"]
    A1 -->|Success| DONE["✅ Task Complete"]
    A1 -->|Failure| W1["Wait 100ms"]
    W1 --> A2["Attempt 2"]
    A2 -->|Success| DONE
    A2 -->|Failure| W2["Wait 200ms"]
    W2 --> A3["Attempt 3"]
    A3 -->|Success| DONE
    A3 -->|Failure| FAIL["❌ Task Failed<br/>Error logged"]

    style DONE fill:#c8e6c9,stroke:#2e7d32
    style FAIL fill:#ffcdd2,stroke:#b71c1c
```

- **Max concurrency:** 10 simultaneous DB operations
- **Retry delays:** 100ms → 200ms → 400ms (exponential)
- **Queue:** Excess tasks wait until a slot opens

---

## License

MIT
