import autocannon from 'autocannon';

async function runBenchmark() {
  console.log('=== Running FaultFlow Ingress Throughput Benchmark ===');
  console.log('Target: POST http://localhost:4000/api/v1/events');
  console.log('Concurrency: 100, Duration: 10s, Pipelining: 10\n');

  const instance = autocannon(
    {
      url: 'http://localhost:4000/api/v1/events',
      connections: 100,
      duration: 10,
      pipelining: 10,
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': 'org_live_sk_faultflow_test_key_2026',
      },
      setupClient(client) {
        client.setHeaders({
          'content-type': 'application/json',
          'x-api-key': 'org_live_sk_faultflow_test_key_2026',
          'idempotency-key': `bench_${Math.random()}_${Date.now()}`,
        });
        client.setBody(
          JSON.stringify({
            target_url: 'http://localhost:4000/api/v1/chaos/sink',
            event_type: 'benchmark.event',
            payload: { metric: 'speed', time: Date.now() },
            max_retries: 3,
            timeout_ms: 3000,
          })
        );
      },
    },
    (err, result) => {
      if (err) {
        console.error('Benchmark failed:', err);
        process.exit(1);
      }
      console.log(autocannon.printResult(result));
      console.log('\n--- Quantitative Summary ---');
      console.log(`Requests/sec: ${result.requests.average}`);
      console.log(`p50 Latency:  ${result.latency.p50} ms`);
      console.log(`p95 Latency:  ${result.latency.p95 || result.latency.p97_5} ms`);
      console.log(`p99 Latency:  ${result.latency.p99} ms`);
    }
  );

  autocannon.track(instance, { renderProgressBar: true });
}

runBenchmark();
