import crypto from 'crypto';

/**
 * Generates standard versioned HMAC-SHA256 webhook signature following Stripe/Svix conventions.
 * Format: v1,<hex_hmac>
 */
export function generateWebhookSignature(
  payloadString: string,
  timestamp: string | number,
  signingSecret: string
): { signature: string; headerValue: string } {
  const tsStr = String(timestamp);
  const signaturePayload = `${tsStr}.${payloadString}`;
  const signature = crypto
    .createHmac('sha256', signingSecret)
    .update(signaturePayload)
    .digest('hex');

  return {
    signature,
    headerValue: `v1,${signature}`,
  };
}

/**
 * Constant-time webhook signature verification with replay attack timestamp window enforcement.
 */
export function verifyWebhookSignature(options: {
  payloadString: string;
  signatureHeader: string;
  timestampHeader: string | number;
  signingSecret: string;
  toleranceSeconds?: number;
}): { valid: boolean; reason?: string } {
  const {
    payloadString,
    signatureHeader,
    timestampHeader,
    signingSecret,
    toleranceSeconds = 300,
  } = options;

  const timestampNum = Number(timestampHeader);
  if (isNaN(timestampNum) || timestampNum <= 0) {
    return { valid: false, reason: 'INVALID_TIMESTAMP' };
  }

  // Check replay window
  const nowSeconds = Math.floor(Date.now() / 1000);
  if (Math.abs(nowSeconds - timestampNum) > toleranceSeconds) {
    return { valid: false, reason: 'TIMESTAMP_OUT_OF_TOLERANCE' };
  }

  // Extract signature from header (support v1,<sig> and v1=<sig>)
  let receivedHex = '';
  const parts = signatureHeader.split(',');
  for (const part of parts) {
    const trimmed = part.trim();
    if (trimmed.startsWith('v1=') || trimmed.startsWith('v1,')) {
      receivedHex = trimmed.slice(3).trim();
      break;
    } else if (parts.length === 2 && parts[0].trim() === 'v1') {
      receivedHex = parts[1].trim();
      break;
    } else if (trimmed.startsWith('sha256=')) {
      receivedHex = trimmed.slice(7).trim();
      break;
    }
  }

  if (!receivedHex) {
    // Fallback: entire header if single hex string
    receivedHex = signatureHeader.trim();
  }

  const { signature: expectedHex } = generateWebhookSignature(payloadString, timestampNum, signingSecret);

  try {
    const receivedBuf = Buffer.from(receivedHex, 'hex');
    const expectedBuf = Buffer.from(expectedHex, 'hex');

    if (receivedBuf.length !== expectedBuf.length) {
      return { valid: false, reason: 'SIGNATURE_LENGTH_MISMATCH' };
    }

    const match = crypto.timingSafeEqual(receivedBuf, expectedBuf);
    return match ? { valid: true } : { valid: false, reason: 'SIGNATURE_MISMATCH' };
  } catch {
    return { valid: false, reason: 'VERIFICATION_ERROR' };
  }
}
