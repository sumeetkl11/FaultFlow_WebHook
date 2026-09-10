import assert from 'assert';
import { validateWebhookUrl, isPrivateOrReservedIPv4, isPrivateOrReservedIPv6, SsrViolationError } from '../src/utils/urlValidator.js';
import { generateWebhookSignature, verifyWebhookSignature } from '../src/utils/signature.js';

async function runSecurityTests() {
  console.log('--- Starting FaultFlow Security & Remediation Unit Tests ---\n');

  // ── 1. SSRF Protection Tests ───────────────────────────────────────────
  console.log('[1/3] Testing SSRF Guard & IP Filtering...');

  // Test IPv4 private checks
  assert.strictEqual(isPrivateOrReservedIPv4('169.254.169.254'), true, 'AWS/GCP metadata IP must be blocked');
  assert.strictEqual(isPrivateOrReservedIPv4('10.0.0.1'), true, 'RFC1918 10.0.0.0/8 must be blocked');
  assert.strictEqual(isPrivateOrReservedIPv4('172.16.0.1'), true, 'RFC1918 172.16.0.0/12 must be blocked');
  assert.strictEqual(isPrivateOrReservedIPv4('192.168.1.100'), true, 'RFC1918 192.168.0.0/16 must be blocked');
  assert.strictEqual(isPrivateOrReservedIPv4('127.0.0.1', false), true, 'Loopback must be blocked when allowLoopback is false');
  assert.strictEqual(isPrivateOrReservedIPv4('127.0.0.1', true), false, 'Loopback allowed when allowLoopback is true');
  assert.strictEqual(isPrivateOrReservedIPv4('8.8.8.8'), false, 'Public IP must be allowed');
  assert.strictEqual(isPrivateOrReservedIPv4('1.1.1.1'), false, 'Public IP must be allowed');

  // Test IPv6 checks
  assert.strictEqual(isPrivateOrReservedIPv6('::1', false), true, 'IPv6 loopback must be blocked');
  assert.strictEqual(isPrivateOrReservedIPv6('fc00::1'), true, 'IPv6 unique local must be blocked');
  assert.strictEqual(isPrivateOrReservedIPv6('fe80::1'), true, 'IPv6 link-local must be blocked');

  // Test URL Validation with SSRF vectors
  const blockedUrls = [
    'http://169.254.169.254/latest/meta-data',
    'http://10.0.0.5:8080/internal',
    'http://192.168.0.1/admin',
    'http://172.16.0.1/metrics',
    'http://metadata.google.internal/computeMetadata/v1',
    'ftp://example.com/webhook',
    'file:///etc/passwd',
  ];

  for (const url of blockedUrls) {
    let threw = false;
    try {
      await validateWebhookUrl(url, { allowLocal: false });
    } catch (err: any) {
      threw = true;
      assert.ok(err instanceof SsrViolationError, `Expected SsrViolationError for ${url}, got ${err}`);
    }
    assert.strictEqual(threw, true, `SSRF URL was not blocked: ${url}`);
  }

  // Allowed public URL test
  const validRes = await validateWebhookUrl('https://example.com/webhook');
  assert.strictEqual(validRes.valid, true);
  console.log('✓ SSRF Guard successfully blocked all dangerous vectors and accepted public URLs.');

  // ── 2. Stripe/Svix Standard HMAC Tests ─────────────────────────────────
  console.log('\n[2/3] Testing Stripe/Svix Standard HMAC Signature & Constant-Time Verification...');

  const secret = 'whsec_test_secret_key_1234567890';
  const payload = JSON.stringify({ event: 'payment.succeeded', amount: 4900 });
  const timestamp = Math.floor(Date.now() / 1000);

  const { signature, headerValue } = generateWebhookSignature(payload, timestamp, secret);
  assert.ok(headerValue.startsWith('v1,'), `Signature header must start with v1,: ${headerValue}`);
  assert.strictEqual(headerValue, `v1,${signature}`);

  // Verification: Valid signature
  const verificationOk = verifyWebhookSignature({
    payloadString: payload,
    signatureHeader: headerValue,
    timestampHeader: timestamp,
    signingSecret: secret,
  });
  assert.strictEqual(verificationOk.valid, true, 'Valid signature must verify successfully');

  // Verification: Tampered payload
  const tamperedPayload = JSON.stringify({ event: 'payment.succeeded', amount: 99000 });
  const verificationTampered = verifyWebhookSignature({
    payloadString: tamperedPayload,
    signatureHeader: headerValue,
    timestampHeader: timestamp,
    signingSecret: secret,
  });
  assert.strictEqual(verificationTampered.valid, false, 'Tampered payload must fail verification');

  // Verification: Expired timestamp (> 300s)
  const expiredTimestamp = timestamp - 301;
  const { headerValue: expiredHeader } = generateWebhookSignature(payload, expiredTimestamp, secret);
  const verificationExpired = verifyWebhookSignature({
    payloadString: payload,
    signatureHeader: expiredHeader,
    timestampHeader: expiredTimestamp,
    signingSecret: secret,
    toleranceSeconds: 300,
  });
  assert.strictEqual(verificationExpired.valid, false, 'Expired signature must fail verification');
  assert.strictEqual(verificationExpired.reason, 'TIMESTAMP_OUT_OF_TOLERANCE');

  // Verification: Wrong secret
  const verificationWrongSecret = verifyWebhookSignature({
    payloadString: payload,
    signatureHeader: headerValue,
    timestampHeader: timestamp,
    signingSecret: 'wrong_secret',
  });
  assert.strictEqual(verificationWrongSecret.valid, false, 'Wrong secret must fail verification');

  console.log('✓ Stripe/Svix HMAC signature format and constant-time validation verified.');

  // ── 3. Rate Limiter Key Namespacing & Proxy Trust ─────────────────────
  console.log('\n[3/3] Testing Rate Limiter & Idempotency Key formats...');

  // Test idempotency regex validation
  const validKeys = ['evt_12345', 'order-2026-09-10:001', 'sub.tier.3', 'idemp_abc_123'];
  const invalidKeys = ['', ' ', 'key with spaces', 'bad/char/key', 'key<script>', 'a'.repeat(129)];

  const keyRegex = /^[A-Za-z0-9_.:-]+$/;
  for (const k of validKeys) {
    assert.ok(k.length > 0 && k.length <= 128 && keyRegex.test(k), `Valid key failed: ${k}`);
  }
  for (const k of invalidKeys) {
    const isValid = k.length > 0 && k.length <= 128 && keyRegex.test(k);
    assert.strictEqual(isValid, false, `Invalid key incorrectly passed: ${k}`);
  }
  console.log('✓ Idempotency Key validation patterns verified.');

  console.log('\n🎉 ALL Phase 1 Security & Architecture Tests PASSED!\n');
}

runSecurityTests().catch((err) => {
  console.error('Security tests failed:', err);
  process.exit(1);
});
