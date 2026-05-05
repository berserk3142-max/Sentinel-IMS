/**
 * Cascading Failure Simulation — RDBMS Outage → MCP Failure → Cache Stampede
 *
 * Simulates a realistic cascading production failure:
 * 
 * Phase 1: RDBMS primary goes down (connection timeouts)
 * Phase 2: Services depending on RDBMS start failing (MCP / API Gateway)
 * Phase 3: Cache layer overwhelmed by retries (cache stampede)
 * Phase 4: Full system recovery — resolve and close all incidents with RCA
 *
 * Usage:
 *   npx tsx scripts/cascade-failure.ts
 *
 * Prerequisites:
 *   Backend must be running on http://localhost:3001
 */

const API = 'http://localhost:3001';

async function post(path: string, body: any) {
  const res = await fetch(`${API}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  return { status: res.status, data };
}

async function get(path: string) {
  const res = await fetch(`${API}${path}`);
  return res.json();
}

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function timestamp() {
  return new Date().toLocaleTimeString('en-US', { hour12: false });
}

function header(text: string) {
  console.log(`\n${'═'.repeat(60)}`);
  console.log(`  ${text}`);
  console.log(`${'═'.repeat(60)}\n`);
}

async function sendBurst(component: string, errorType: string, severity: string, count: number, delayMs: number, metadata: Record<string, any> = {}) {
  let sent = 0;
  for (let i = 0; i < count; i++) {
    const result = await post('/api/signals', {
      component_id: component,
      error_type: errorType,
      severity,
      metadata: { ...metadata, attempt: i + 1, timestamp: new Date().toISOString() },
    });
    if (result.status === 202) sent++;
    if (i > 0 && i % 25 === 0) {
      process.stdout.write(`    [${timestamp()}] ${sent}/${count} signals sent for ${component}\n`);
    }
    await sleep(delayMs);
  }
  console.log(`    [${timestamp()}] ✅ ${sent}/${count} signals sent for ${component}`);
  return sent;
}

async function main() {
  console.log('\n╔══════════════════════════════════════════════════════════╗');
  console.log('║    🌊 SentinelIMS — Cascading Failure Simulation       ║');
  console.log('║    RDBMS Outage → MCP Failure → Cache Stampede         ║');
  console.log('╚══════════════════════════════════════════════════════════╝');

  // ─── Phase 1: RDBMS Primary Goes Down ──────────────────────────────────────
  header('⚡ PHASE 1: RDBMS Primary Outage');
  console.log('  Scenario: Primary database starts rejecting connections.');
  console.log('  Impact: Connection pool exhaustion, queries timing out.\n');

  await sendBurst('RDBMS_PRIMARY_01', 'ConnectionPoolExhausted', 'critical', 100, 40, {
    pool_size: 50,
    active_connections: 50,
    waiting_queries: 200,
    latency_ms: 30000,
  });

  await sleep(1000);

  // Replica also starts failing
  console.log('\n  📡 RDBMS replica also showing errors...');
  await sendBurst('RDBMS_REPLICA_02', 'ReplicationLag', 'critical', 50, 30, {
    replication_lag_seconds: 120,
    bytes_behind: 50_000_000,
  });

  // ─── Phase 2: MCP / Services Start Cascading ──────────────────────────────
  header('💥 PHASE 2: Dependent Service Cascade');
  console.log('  Scenario: Services depending on RDBMS begin failing.');
  console.log('  MCP, API Gateway, Auth Service all start throwing errors.\n');

  // MCP failure
  const mcpPromise = sendBurst('MCP_ORCHESTRATOR_01', 'UpstreamDatabaseUnavailable', 'critical', 80, 50, {
    failed_queries: ['GetUserProfile', 'UpdateSessionState', 'FetchPermissions'],
    circuit_breaker: 'OPEN',
    retry_exhausted: true,
  });

  // API Gateway failures (simultaneous)
  const apiPromise = sendBurst('API_GATEWAY_01', 'BadGateway', 'high', 60, 60, {
    http_status: 502,
    upstream: 'MCP_ORCHESTRATOR_01',
    error_rate_percent: 87.5,
  });

  // Auth service failures
  const authPromise = sendBurst('AUTH_SERVICE_01', 'TokenValidationTimeout', 'high', 40, 70, {
    validation_timeout_ms: 15000,
    fallback: 'cached_token_used',
  });

  await Promise.all([mcpPromise, apiPromise, authPromise]);

  // ─── Phase 3: Cache Stampede ──────────────────────────────────────────────
  header('🔥 PHASE 3: Cache Stampede');
  console.log('  Scenario: Failed DB queries bypass cache, causing thundering herd.');
  console.log('  Cache eviction rate spikes, memory pressure increases.\n');

  await sendBurst('CACHE_CLUSTER_01', 'CacheStampede', 'high', 70, 40, {
    cache_hit_rate: 0.12,
    eviction_rate: 15000,
    memory_usage_percent: 94,
  });

  await sendBurst('CDN_EDGE_01', 'OriginUnreachable', 'low', 30, 50, {
    origin_error: '503 Service Unavailable',
    fallback: 'stale_cache_served',
    stale_age_seconds: 3600,
  });

  // Wait for debounce
  console.log('\n  ⏳ Waiting 12s for debounce engine to flush all windows...');
  await sleep(12000);

  // ─── Phase 4: Assessment ──────────────────────────────────────────────────
  header('📊 PHASE 4: Incident Assessment');

  const dashboard = await get('/api/dashboard');
  console.log(`  Total incidents:    ${dashboard.counts.total}`);
  console.log(`  Open:               ${dashboard.counts.open}`);
  console.log(`  Investigating:      ${dashboard.counts.investigating}`);
  console.log(`  P0 (Critical):      ${dashboard.counts.p0}`);
  console.log(`  P1 (High):          ${dashboard.counts.p1}`);
  console.log(`  P2 (Low):           ${dashboard.counts.p2}`);
  console.log('');

  // List cascade incidents
  const cascadeComponents = [
    'RDBMS_PRIMARY_01', 'RDBMS_REPLICA_02', 'MCP_ORCHESTRATOR_01',
    'API_GATEWAY_01', 'AUTH_SERVICE_01', 'CACHE_CLUSTER_01', 'CDN_EDGE_01',
  ];

  const cascadeIncidents: any[] = [];
  for (const comp of cascadeComponents) {
    const inc = dashboard.incidents.find((i: any) => i.componentId === comp);
    if (inc) {
      cascadeIncidents.push(inc);
      console.log(`  [${inc.severity}] ${inc.componentId.padEnd(22)} → ${inc.status.padEnd(14)} (${inc.signalCount} signals)`);
    }
  }

  // ─── Phase 5: Incident Response & Recovery ────────────────────────────────
  header('🔧 PHASE 5: Incident Response & Recovery');

  // Root cause: RDBMS_PRIMARY_01
  const rdbms = cascadeIncidents.find(i => i.componentId === 'RDBMS_PRIMARY_01');
  if (rdbms) {
    console.log(`  Resolving root cause: ${rdbms.componentId}...`);

    // Transition through states
    await post(`/api/incidents/${rdbms.id}/transition`, { next: 'INVESTIGATING' });
    console.log(`    OPEN → INVESTIGATING ✅`);
    await sleep(500);

    await post(`/api/incidents/${rdbms.id}/transition`, { next: 'RESOLVED' });
    console.log(`    INVESTIGATING → RESOLVED ✅ (MTTR calculated)`);

    // Submit RCA
    await post(`/api/incidents/${rdbms.id}/rca`, {
      root_cause_category: 'Database',
      fix_applied: 'Restarted primary RDBMS instance, increased connection pool from 50 to 200, enabled connection queuing with 5s timeout',
      prevention_steps: 'Implement connection pool monitoring with alerts at 70% utilization, add circuit breaker on DB connections, deploy read replicas for query offloading',
    });
    console.log(`    RCA submitted ✅`);

    // Close
    const closeResult = await post(`/api/incidents/${rdbms.id}/transition`, { next: 'CLOSED' });
    console.log(`    RESOLVED → CLOSED ${closeResult.status === 200 ? '✅' : '❌'}`);
  }

  // Close MCP (depends on RDBMS fix)
  const mcp = cascadeIncidents.find(i => i.componentId === 'MCP_ORCHESTRATOR_01');
  if (mcp) {
    console.log(`\n  Resolving cascade: ${mcp.componentId}...`);
    await post(`/api/incidents/${mcp.id}/transition`, { next: 'INVESTIGATING' });
    await post(`/api/incidents/${mcp.id}/transition`, { next: 'RESOLVED' });
    await post(`/api/incidents/${mcp.id}/rca`, {
      root_cause_category: 'ExternalDependency',
      fix_applied: 'Upstream RDBMS restored. Reset circuit breaker, cleared connection backlog, restarted MCP pods.',
      prevention_steps: 'Implement graceful degradation mode with cached responses when DB is unavailable, add dependency health checks to readiness probe.',
    });
    await post(`/api/incidents/${mcp.id}/transition`, { next: 'CLOSED' });
    console.log(`    Full lifecycle completed ✅`);
  }

  // Try closing CDN without RCA — should fail
  const cdn = cascadeIncidents.find(i => i.componentId === 'CDN_EDGE_01');
  if (cdn) {
    console.log(`\n  🧪 Testing RCA guard on ${cdn.componentId}...`);
    await post(`/api/incidents/${cdn.id}/transition`, { next: 'INVESTIGATING' });
    await post(`/api/incidents/${cdn.id}/transition`, { next: 'RESOLVED' });
    const noRca = await post(`/api/incidents/${cdn.id}/transition`, { next: 'CLOSED' });
    console.log(`    RESOLVED → CLOSED (no RCA): ${noRca.status === 400 ? '✅ Correctly blocked' : '❌ Should have been blocked'} (${noRca.status})`);
    if (noRca.status === 400) {
      console.log(`    Guard message: "${noRca.data.error}"`);
    }
  }

  // ─── Final Health Check ───────────────────────────────────────────────────
  header('💓 Final System Health');

  const health = await get('/health');
  console.log(`  Status:        ${health.status}`);
  console.log(`  Uptime:        ${Math.floor(health.uptime / 60)}m ${health.uptime % 60}s`);
  console.log(`  DB Latency:    ${health.database.latencyMs}ms`);
  console.log(`  Buffer:        ${health.buffer.size}/${health.buffer.capacity} (${health.buffer.usagePercent}%)`);
  console.log(`  Total Pushed:  ${health.buffer.totalPushed.toLocaleString()}`);

  if (health.metrics) {
    console.log(`  Signals/sec:   ${health.metrics.signalsPerSecond}`);
    console.log(`  Active:        ${health.metrics.activeIncidents}`);
    console.log(`  Processed:     ${health.metrics.totalSignalsProcessed.toLocaleString()}`);
  }

  console.log('\n╔══════════════════════════════════════════════════════════╗');
  console.log('║    ✅ Cascading Failure Simulation Complete!             ║');
  console.log('╚══════════════════════════════════════════════════════════╝\n');
}

main().catch(console.error);
