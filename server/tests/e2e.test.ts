import assert from 'assert';

const API_BASE = 'http://localhost:4000/api/v1';
const API_KEY = 'org_live_sk_faultflow_test_key_2026';

async function runTests() {
  console.log('--- Starting FaultFlow Automated Integration Tests ---');

  // Test 1: Health Readiness
  console.log('Test 1: Health Readiness Probe');
  const healthRes = await fetch('http://localhost:4000/health/readiness');
  const healthData = await healthRes.json();
  assert.strictEqual(healthRes.status, 200);
  assert.strictEqual(healthData.status, 'READY');
  console.log('✓ Health Readiness passed.');

  // Test 2: Ingress & Atomic Idempotency
  console.log('Test 2: Ingress & Atomic Idempotency Dedup');
  const testIdempKey = `test_idemp_${Date.now()}`;
  const payload = {
    target_url: 'http://localhost:4000/api/v1/chaos/sink',
    event_type: 'order.created',
    payload: { order_id: 'ord_test_1', total: 9900 },
    max_retries: 3,
    timeout_ms: 4000,
  };

  // First dispatch: 202 Accepted
  const res1 = await fetch(`${API_BASE}/events`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-API-Key': API_KEY,
      'Idempotency-Key': testIdempKey,
    },
    body: JSON.stringify(payload),
  });
  const data1 = await res1.json();
  assert.strictEqual(res1.status, 202);
  assert.strictEqual(data1.data.status, 'QUEUED');
  assert.ok(data1.data.event_id);

  // Second dispatch with same idempotency key: 200 OK Deduplicated
  const res2 = await fetch(`${API_BASE}/events`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-API-Key': API_KEY,
      'Idempotency-Key': testIdempKey,
    },
    body: JSON.stringify(payload),
  });
  const data2 = await res2.json();
  assert.strictEqual(res2.status, 200);
  assert.ok(data2.message.includes('Deduplicated'));
  console.log('✓ Ingress & Idempotency passed.');

  // Test 3: Chaos Failure & DLQ Transition
  console.log('Test 3: Chaos Injection & DLQ Route');
  // Configure chaos to 100% 500
  await fetch(`${API_BASE}/chaos/config`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-API-Key': API_KEY },
    body: JSON.stringify({
      simulated_status: 500,
      artificial_delay_ms: 50,
      failure_rate_percent: 100,
    }),
  });

  const chaosIdempKey = `test_fail_${Date.now()}`;
  const failRes = await fetch(`${API_BASE}/events`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-API-Key': API_KEY,
      'Idempotency-Key': chaosIdempKey,
    },
    body: JSON.stringify({
      target_url: 'http://localhost:4000/api/v1/chaos/sink',
      event_type: 'payment.critical',
      payload: { tx: 'failed_tx' },
      max_retries: 1, // Only 1 attempt before DLQ
      timeout_ms: 2000,
    }),
  });
  const failData = await failRes.json();
  assert.strictEqual(failRes.status, 202);

  // Wait for worker attempt to fail and route to DLQ
  await new Promise((resolve) => setTimeout(resolve, 3000));

  const checkRes = await fetch(`${API_BASE}/events/${failData.data.event_id}`, {
    headers: { 'X-API-Key': API_KEY },
  });
  const checkData = await checkRes.json();
  assert.strictEqual(checkData.data.status, 'DEAD_LETTERED');
  console.log('✓ Chaos failure & DLQ transition passed.');

  // Test 4: DLQ Replay
  console.log('Test 4: DLQ Replay Recovery');
  // Reset chaos to 200
  await fetch(`${API_BASE}/chaos/config`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-API-Key': API_KEY },
    body: JSON.stringify({
      simulated_status: 200,
      artificial_delay_ms: 0,
      failure_rate_percent: 0,
    }),
  });

  const replayRes = await fetch(`${API_BASE}/dlq/replay`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-API-Key': API_KEY,
    },
    body: JSON.stringify({
      mode: 'SELECTIVE',
      event_ids: [failData.data.event_id],
    }),
  });
  const replayData = await replayRes.json();
  assert.strictEqual(replayRes.status, 200);
  assert.strictEqual(replayData.data.replayed_count, 1);

  // Wait for delivery
  await new Promise((resolve) => setTimeout(resolve, 2000));
  const recoveredRes = await fetch(`${API_BASE}/events/${failData.data.event_id}`, {
    headers: { 'X-API-Key': API_KEY },
  });
  const recoveredData = await recoveredRes.json();
  assert.strictEqual(recoveredData.data.status, 'DELIVERED');
  console.log('✓ DLQ replay and delivery recovery passed.');

  console.log('\nAll FaultFlow Integration Tests PASSED successfully!');
}

runTests().catch((err) => {
  console.error('Integration tests failed:', err);
  process.exit(1);
});
