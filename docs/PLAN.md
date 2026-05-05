# SentinelIMS — Implementation Plan

## Phase 1: Core Backend Engine

### 1.1 Ring Buffer (backpressure)
- [x] Fixed-size circular buffer with O(1) push/pop
- [x] `popBatch(n)` for drain loop
- [x] Overflow tracking (totalDropped counter)
- [x] Usage percentage calculation
- [x] Unit tests for push, pop, overflow, batch operations

### 1.2 Drain Loop
- [x] Background interval (100ms) that pops batches from buffer
- [x] Feeds signals into Debounce Engine
- [x] Records signal count in MetricsCollector
- [x] Start/stop lifecycle management

### 1.3 Debounce Engine
- [x] 10-second window per component_id
- [x] First signal creates work item + starts timer
- [x] Subsequent signals append to pending batch
- [x] Flush on batch threshold (50) or timer expiry
- [x] Unique constraint (component_id, window_start) for idempotency

### 1.4 State Machine
- [x] OPEN → INVESTIGATING → RESOLVED → CLOSED transitions
- [x] InvalidTransitionError with allowed transitions
- [x] MTTR calculation on RESOLVED
- [x] RCA guard on CLOSED (MissingRCAError)
- [x] Unit tests for all valid/invalid paths

### 1.5 Alert Strategy Pattern
- [x] AlertStrategy interface (priority, notify)
- [x] P0CriticalAlert, P1HighAlert, P2LowAlert implementations
- [x] AlertFactory with component prefix → severity mapping
- [x] determineSeverity utility function

### 1.6 Worker Pool
- [x] Concurrency-limited task queue (max 10)
- [x] Exponential backoff retry (100ms → 200ms → 400ms)
- [x] Error logging for exhausted retries

## Phase 2: REST API & Real-time

### 2.1 Signal Ingestion Routes
- [x] POST /api/signals — single signal ingestion
- [x] POST /api/signals/batch — batch ingestion (up to 500)
- [x] Rate limiting via @fastify/rate-limit

### 2.2 Incident Management Routes
- [x] GET /api/incidents — paginated list with sorting
- [x] GET /api/incidents/:id — detail with signals + RCA
- [x] POST /api/incidents/:id/transition — state changes
- [x] POST /api/incidents/:id/rca — submit root cause analysis
- [x] GET /api/dashboard — aggregated summary
- [x] GET /api/metrics — historical metrics snapshots

### 2.3 Health & Monitoring
- [x] GET /health — system health, DB latency, buffer stats
- [x] MetricsCollector — 5s interval, Socket.IO push, DB snapshots

### 2.4 Socket.IO
- [x] Attach to Fastify's HTTP server
- [x] Emit: metrics, incident:updated, incident:rca
- [x] CORS configured for frontend origins

## Phase 3: Frontend Dashboard

### 3.1 Design System
- [x] Material Design 3 color tokens
- [x] Neumorphic card styles
- [x] Typography system (DM Sans, DM Mono)
- [x] Animation utilities (fade-in, slide-up)
- [x] Marquee bar for system capabilities

### 3.2 Dashboard View
- [x] Stats cards (Open, Investigating, Resolved, MTTR)
- [x] Signal Ingestion Rate chart (Recharts area chart)
- [x] Active Incidents table with severity/status badges
- [x] On-Call Roster with chat
- [x] System Event Log timeline

### 3.3 Incident Detail View
- [x] Signal timeline with raw payloads
- [x] State transition buttons (validated against allowed transitions)
- [x] RCA submission form with category selector
- [x] MTTR display

### 3.4 Additional Views
- [x] Metrics view with throughput chart
- [x] Signals feed table
- [x] Teams view with roster + chat
- [x] System Logs view
- [x] Interactive Terminal

### 3.5 Real-time Data Hooks
- [x] useSocket — Socket.IO connection management
- [x] useDashboard — polling + socket updates
- [x] useHealth — health polling
- [x] useMetrics — seed + socket + fallback polling

## Phase 4: DevOps & Documentation

### 4.1 Docker
- [x] Backend Dockerfile (multi-stage build)
- [x] Frontend Dockerfile (multi-stage build + nginx)
- [x] docker-compose.yml with health checks

### 4.2 Documentation
- [x] README.md with architecture diagrams
- [x] Backpressure handling section
- [x] Docker Compose setup instructions
- [x] API reference
- [x] Project structure

### 4.3 Simulation & Sample Data
- [x] simulate.ts — basic lifecycle demo
- [x] cascade-failure.ts — RDBMS → MCP → Cache stampede
- [x] sample-failure-data.json — structured failure scenarios

### 4.4 Specs & Plans
- [x] SPEC.md — project specification
- [x] PROMPTS.md — design prompts and decisions
- [x] PLAN.md — implementation plan (this file)

## Bonus Creative Additions

- [x] **Interactive Terminal** — In-browser terminal with real API commands (health, incidents, buffer, metrics, flood)
- [x] **Team Chat** — Simulated on-call messaging with auto-replies per team member
- [x] **Flood Command** — Stress test the graph by blasting hundreds of signals
- [x] **Cascading Failure Simulation** — Multi-phase failure scenario demonstrating RDBMS → MCP → Cache cascade
- [x] **Seed Metrics** — Graph always visible from first render, never blank
- [x] **RCA Guard** — Cannot close incidents without mandatory root cause analysis
- [x] **Marquee Bar** — Animated capability showcase in the dashboard header
