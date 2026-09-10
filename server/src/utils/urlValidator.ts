import dns from 'dns/promises';
import { URL } from 'url';
import net from 'net';

export interface UrlValidationOptions {
  allowLocal?: boolean;
  allowHttp?: boolean;
}

export class SsrViolationError extends Error {
  code: string;
  constructor(message: string, code = 'SSRF_BLOCKED') {
    super(message);
    this.name = 'SsrViolationError';
    this.code = code;
  }
}

/**
 * Checks if an IPv4 address belongs to a private, reserved, or cloud metadata CIDR.
 */
export function isPrivateOrReservedIPv4(ip: string, allowLoopback = false): boolean {
  const parts = ip.split('.').map(Number);
  if (parts.length !== 4 || parts.some((p) => isNaN(p) || p < 0 || p > 255)) {
    return true; // Invalid format treated as unsafe
  }

  const [a, b, c, d] = parts;

  // Cloud metadata endpoint (AWS, GCP, Azure, OpenStack, DigitalOcean)
  if (a === 169 && b === 254 && c === 169 && d === 254) {
    return true;
  }

  // Link-local / APIPA (169.254.0.0/16)
  if (a === 169 && b === 254) {
    return true;
  }

  // Loopback (127.0.0.0/8)
  if (a === 127) {
    return !allowLoopback;
  }

  // 0.0.0.0/8 (Current network / "this" host)
  if (a === 0) {
    return !allowLoopback;
  }

  // RFC 1918 Private ranges
  // 10.0.0.0/8
  if (a === 10) return !allowLoopback;
  // 172.16.0.0/12 (172.16.0.0 - 172.31.255.255)
  if (a === 172 && b >= 16 && b <= 31) return !allowLoopback;
  // 192.168.0.0/16
  if (a === 192 && b === 168) return !allowLoopback;

  // Carrier-Grade NAT (100.64.0.0/10)
  if (a === 100 && b >= 64 && b <= 127) return true;

  // Documentation / Benchmark / Reserved
  if (a === 192 && b === 0 && (c === 0 || c === 2)) return true; // 192.0.0.0/24, 192.0.2.0/24
  if (a === 198 && (b === 18 || b === 19)) return true; // 198.18.0.0/15
  if (a === 198 && b === 51 && c === 100) return true; // 198.51.100.0/24
  if (a === 203 && b === 0 && c === 113) return true; // 203.0.113.0/24

  // Multicast & Reserved (224.0.0.0/4 and 240.0.0.0/4)
  if (a >= 224) return true;

  // Broadcast
  if (a === 255 && b === 255 && c === 255 && d === 255) return true;

  return false;
}

/**
 * Checks if an IPv6 address belongs to a private, loopback, or reserved range.
 */
export function isPrivateOrReservedIPv6(ip: string, allowLoopback = false): boolean {
  const normalized = ip.toLowerCase().trim();

  // IPv4-mapped IPv6 address (::ffff:192.0.2.1)
  if (normalized.startsWith('::ffff:')) {
    const ipv4Part = normalized.replace('::ffff:', '');
    if (net.isIPv4(ipv4Part)) {
      return isPrivateOrReservedIPv4(ipv4Part, allowLoopback);
    }
  }

  // Loopback (::1)
  if (normalized === '::1' || normalized === '0:0:0:0:0:0:0:1') {
    return !allowLoopback;
  }

  // Unspecified (::)
  if (normalized === '::' || normalized === '0:0:0:0:0:0:0:0') {
    return !allowLoopback;
  }

  // Unique local addresses (fc00::/7 -> fc.. and fd..)
  if (normalized.startsWith('fc') || normalized.startsWith('fd')) {
    return !allowLoopback;
  }

  // Link-local unicast (fe80::/10)
  if (normalized.startsWith('fe8') || normalized.startsWith('fe9') || normalized.startsWith('fea') || normalized.startsWith('feb')) {
    return true;
  }

  // Multicast (ff00::/8)
  if (normalized.startsWith('ff')) {
    return true;
  }

  return false;
}

const BLOCKED_HOSTNAMES = new Set([
  'metadata.google.internal',
  'metadata.internal',
  'instance-data',
  'metadata',
]);

/**
 * Validates a webhook destination URL against SSRF, internal network traversal,
 * and cloud metadata endpoint access.
 */
export async function validateWebhookUrl(
  urlString: string,
  options: UrlValidationOptions = {}
): Promise<{ valid: boolean; resolvedUrl: URL; resolvedIps: string[] }> {
  const { allowLocal = false, allowHttp = true } = options;

  let parsed: URL;
  try {
    parsed = new URL(urlString);
  } catch {
    throw new SsrViolationError(`Invalid target URL format: '${urlString}'`);
  }

  // Protocol check
  const protocol = parsed.protocol.toLowerCase();
  if (protocol !== 'http:' && protocol !== 'https:') {
    throw new SsrViolationError(`Disallowed protocol '${protocol}'. Only HTTP(S) supported.`);
  }

  if (!allowHttp && protocol === 'http:') {
    throw new SsrViolationError(`Insecure HTTP protocol is not permitted in production.`);
  }

  const hostname = parsed.hostname.toLowerCase();

  // Explicit cloud metadata and special internal hostnames
  if (BLOCKED_HOSTNAMES.has(hostname) || hostname.endsWith('.internal') || hostname.endsWith('.local')) {
    if (!(allowLocal && (hostname === 'localhost' || hostname.endsWith('.local')))) {
      throw new SsrViolationError(`Access to cloud metadata or internal host '${hostname}' is strictly forbidden.`);
    }
  }

  // Loopback name check
  if ((hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1') && !allowLocal) {
    throw new SsrViolationError(`Loopback host '${hostname}' is not permitted.`);
  }

  // Resolve DNS to verify all resolved IPs
  let addresses: { address: string; family: number }[] = [];

  if (net.isIP(hostname)) {
    addresses = [{ address: hostname, family: net.isIPv4(hostname) ? 4 : 6 }];
  } else {
    try {
      addresses = await dns.lookup(hostname, { all: true });
    } catch (err: unknown) {
      throw new SsrViolationError(`Failed to resolve DNS for hostname '${hostname}': ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  if (!addresses || addresses.length === 0) {
    throw new SsrViolationError(`No DNS records found for '${hostname}'.`);
  }

  const resolvedIps: string[] = [];
  for (const { address, family } of addresses) {
    resolvedIps.push(address);
    if (family === 4) {
      if (isPrivateOrReservedIPv4(address, allowLocal)) {
        throw new SsrViolationError(
          `SSRF protection triggered: '${hostname}' resolved to private/reserved IP ${address}`
        );
      }
    } else if (family === 6) {
      if (isPrivateOrReservedIPv6(address, allowLocal)) {
        throw new SsrViolationError(
          `SSRF protection triggered: '${hostname}' resolved to private/reserved IPv6 ${address}`
        );
      }
    }
  }

  return { valid: true, resolvedUrl: parsed, resolvedIps };
}
