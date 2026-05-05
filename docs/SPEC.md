# SentinelIMS — Project Specification

## Problem Statement

Modern distributed systems generate thousands of alerts and signals per second during outages. Existing incident management tools fail under high load, create duplicate incidents for the same root cause, and lack structured post-mortem enforcement. **SentinelIMS** addresses these gaps.

## Goals

1. **High-throughput signal ingestion** — Handle 10,000+ signals/sec without data loss
2. **Intelligent deduplication** — Group signals by component into single work items
3. **Structured lifecycle** — Every incident follows OPEN → INVESTIGATING → RESOLVED → CLOSED
4. **Mandatory RCA** — No incident can be closed without root cause analysis
5. **Real-time visibility** — Live dashboards with WebSocket-powered updates
6. **Backpressure safety** — System never crashes under overload

## Core Requirements

### Signal Ingestion
- POST endpoint accepting signal payloads with component_id, error_type, severity, metadata
- Rate limiting at configurable req/sec per IP
- Ring buffer for backpressure (fixed memory, O(1) push/pop)
- 202 Accepted semantics (signal buffered, not yet persisted)

### Debounce Engine
- Aggregate signals per component within configurable time windows (default 10s)
- Batch insert signals to DB when count threshold or timer fires
- Unique constraint on (component_id, window_start) for idempotency

### Alert Strategy Pattern
- Strategy interface: `notify(workItem) → void`
- Factory maps component_id prefix → severity → strategy
- P0: Immediate page, P1: Team notification, P2: Logged for review
- Extensible for PagerDuty, Opsgenie, Slack integrations

### Incident State Machine
- States: OPEN, INVESTIGATING, RESOLVED, CLOSED
- Validated transitions (no skipping states)
- MTTR calculated automatically on RESOLVED
- RCA guard on CLOSED (requires complete root cause record)

### Real-Time Dashboard
- Live signal ingestion rate chart
- Incident table with severity badges and status indicators
- On-call roster with team chat
- System health metrics (DB latency, buffer usage, uptime)

### Database
- PostgreSQL (Neon serverless)
- Drizzle ORM for type-safe queries
- Tables: work_items, signals, rca_records, metrics_snapshots
- Proper indexes for performance

## Non-Functional Requirements

| Requirement | Target |
|-------------|--------|
| Signal ingestion throughput | 10,000 signals/sec |
| API response time (p99) | < 10ms for signal ingestion |
| Buffer capacity | 50,000 signals |
| Dashboard refresh rate | 2-5 seconds |
| Zero data loss | Backpressure before OOM |
| State consistency | Validated transitions only |
| Post-mortem compliance | 100% RCA before closure |

## Out of Scope (v1)

- Multi-tenant support
- Role-based access control
- Email/SMS notification delivery
- Kubernetes operator
- Horizontal scaling (single-instance v1)
