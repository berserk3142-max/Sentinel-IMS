/**
 * Simulation Script — Demonstrates the full SentinelIMS workflow.
 *
 * 1. Fires 150 signals for RDBMS_PRIMARY_01 over 8 seconds → 1 P0 Work Item
 * 2. Waits 2s, fires 80 signals for CACHE_CLUSTER_01 → 1 P2 Work Item
 * 3. Transitions the RDBMS incident through all states
 * 4. Submits RCA and closes it
 * 5. Tries to close cache incident without RCA → expects 400
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

async function main() {
  console.log('\n╔══════════════════════════════════════════════════════════╗');
  console.log('║           🧪 SentinelIMS Simulation Script              ║');
  console.log('╚══════════════════════════════════════════════════════════╝\n');

  // Step 1: Fire 150 signals for RDBMS_PRIMARY_01
  console.log('📡 Step 1: Sending 150 signals for RDBMS_PRIMARY_01 (P0)...');
  for (let i = 0; i < 150; i++) {
    await post('/api/signals', {
      component_id: 'RDBMS_PRIMARY_01',
      error_type: 'ConnectionTimeout',
      severity: 'critical',
      metadata: { attempt: i + 1, latency_ms: 5000 + Math.random() * 2000 },
    });
    if (i % 30 === 0) process.stdout.write(`  ${i}/150 signals sent\n`);
    await sleep(50); // ~8 seconds total
  }
  console.log('  ✅ 150 signals sent for RDBMS_PRIMARY_01\n');

  // Step 2: Wait then fire 80 signals for CACHE_CLUSTER_01
  console.log('⏳ Waiting 2 seconds...\n');
  await sleep(2000);

  console.log('📡 Step 2: Sending 80 signals for CACHE_CLUSTER_01 (P2)...');
  for (let i = 0; i < 80; i++) {
    await post('/api/signals', {
      component_id: 'CACHE_CLUSTER_01',
      error_type: 'CacheMiss',
      severity: 'low',
      metadata: { key: `session:user:${i}`, hit_rate: 0.3 },
    });
    if (i % 20 === 0) process.stdout.write(`  ${i}/80 signals sent\n`);
    await sleep(30);
  }
  console.log('  ✅ 80 signals sent for CACHE_CLUSTER_01\n');

  // Wait for debounce to flush
  console.log('⏳ Waiting 12s for debounce windows to flush...\n');
  await sleep(12000);

  // Step 3: Check dashboard
  console.log('📊 Step 3: Checking dashboard...');
  const dashboard = await get('/api/dashboard');
  console.log(`  Total incidents: ${dashboard.counts.total}`);
  console.log(`  Open: ${dashboard.counts.open} | Investigating: ${dashboard.counts.investigating}`);
  console.log(`  P0: ${dashboard.counts.p0} | P1: ${dashboard.counts.p1} | P2: ${dashboard.counts.p2}\n`);

  // Find the RDBMS incident
  const rdbmsIncident = dashboard.incidents.find((i: any) => i.componentId === 'RDBMS_PRIMARY_01');
  const cacheIncident = dashboard.incidents.find((i: any) => i.componentId === 'CACHE_CLUSTER_01');

  if (!rdbmsIncident) {
    console.log('❌ RDBMS incident not found! Aborting.');
    return;
  }

  // Step 4: Transition RDBMS through states
  console.log(`🔄 Step 4: Transitioning RDBMS incident (${rdbmsIncident.id})...`);

  const t1 = await post(`/api/incidents/${rdbmsIncident.id}/transition`, { next: 'INVESTIGATING' });
  console.log(`  OPEN → INVESTIGATING: ${t1.status === 200 ? '✅' : '❌'} (${t1.status})`);

  const t2 = await post(`/api/incidents/${rdbmsIncident.id}/transition`, { next: 'RESOLVED' });
  console.log(`  INVESTIGATING → RESOLVED: ${t2.status === 200 ? '✅' : '❌'} (${t2.status})`);

  // Step 5: Submit RCA for RDBMS
  console.log('\n📝 Step 5: Submitting RCA for RDBMS incident...');
  const rcaResult = await post(`/api/incidents/${rdbmsIncident.id}/rca`, {
    root_cause_category: 'Database',
    fix_applied: 'Increased connection pool size from 10 to 50 and added connection timeout retry logic',
    prevention_steps: 'Add connection pool monitoring alerts at 80% utilization, implement circuit breaker pattern',
  });
  console.log(`  RCA submitted: ${rcaResult.status === 200 ? '✅' : '❌'} (${rcaResult.status})\n`);

  // Step 6: Close RDBMS (should succeed — has RCA)
  console.log('🔒 Step 6: Closing RDBMS incident (with RCA)...');
  const t3 = await post(`/api/incidents/${rdbmsIncident.id}/transition`, { next: 'CLOSED' });
  console.log(`  RESOLVED → CLOSED: ${t3.status === 200 ? '✅' : '❌'} (${t3.status})`);

  // Step 7: Try to close CACHE without RCA (should fail)
  if (cacheIncident) {
    console.log(`\n🧪 Step 7: Trying to close CACHE incident without RCA...`);

    // First transition to INVESTIGATING → RESOLVED
    await post(`/api/incidents/${cacheIncident.id}/transition`, { next: 'INVESTIGATING' });
    await post(`/api/incidents/${cacheIncident.id}/transition`, { next: 'RESOLVED' });

    const t4 = await post(`/api/incidents/${cacheIncident.id}/transition`, { next: 'CLOSED' });
    console.log(`  RESOLVED → CLOSED (no RCA): ${t4.status === 400 ? '✅ Correctly rejected' : '❌ Should have been rejected'} (${t4.status})`);
    if (t4.status === 400) {
      console.log(`  Error: ${t4.data.error}`);
    }
  }

  // Final health check
  console.log('\n💓 Health check...');
  const health = await get('/health');
  console.log(`  Status: ${health.status}`);
  console.log(`  Uptime: ${health.uptime}s`);
  console.log(`  Buffer: ${health.buffer.size}/${health.buffer.capacity}`);
  console.log(`  DB: ${health.database.status} (${health.database.latencyMs}ms)`);

  console.log('\n╔══════════════════════════════════════════════════════════╗');
  console.log('║           ✅ Simulation Complete!                        ║');
  console.log('╚══════════════════════════════════════════════════════════╝\n');
}

main().catch(console.error);
