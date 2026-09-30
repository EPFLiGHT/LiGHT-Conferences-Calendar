// URL normalization and the SSRF guard: agent tiers fetch URLs chosen by a model reading untrusted pages.
// One list of private ranges screens both IP-literal hostnames and DNS results.
import net from 'net';

const PRIVATE_RANGES = new net.BlockList();
PRIVATE_RANGES.addSubnet('0.0.0.0', 8);
PRIVATE_RANGES.addSubnet('10.0.0.0', 8);
PRIVATE_RANGES.addSubnet('100.64.0.0', 10);
PRIVATE_RANGES.addSubnet('127.0.0.0', 8);
PRIVATE_RANGES.addSubnet('169.254.0.0', 16);
PRIVATE_RANGES.addSubnet('172.16.0.0', 12);
PRIVATE_RANGES.addSubnet('192.168.0.0', 16);
PRIVATE_RANGES.addSubnet('224.0.0.0', 4);
PRIVATE_RANGES.addSubnet('240.0.0.0', 4);
// Includes :: and ::1; the IPv4-compatible, NAT64 and 6to4 prefixes can embed a private IPv4 address.
PRIVATE_RANGES.addSubnet('::', 96, 'ipv6');
PRIVATE_RANGES.addSubnet('64:ff9b::', 96, 'ipv6');
PRIVATE_RANGES.addSubnet('2002::', 16, 'ipv6');
PRIVATE_RANGES.addSubnet('fc00::', 7, 'ipv6');
PRIVATE_RANGES.addSubnet('fe80::', 10, 'ipv6');
PRIVATE_RANGES.addSubnet('fec0::', 10, 'ipv6');

const LOCALHOST_RE = /(^|\.)localhost\.?$/;

/**
 * Whether an address is private, loopback or link-local. IPv4-mapped IPv6
 * addresses (::ffff:127.0.0.1) match the IPv4 ranges; BlockList handles that.
 * @param {string} addr IP address, IPv6 optionally in brackets.
 * @returns {boolean} true for anything that is not an IP address.
 */
export function isPrivateAddress(addr) {
  const ip = addr.replace(/^\[|\]$/g, '');
  const family = net.isIP(ip);
  if (family === 0) return true;
  return PRIVATE_RANGES.check(ip, family === 6 ? 'ipv6' : 'ipv4');
}

/**
 * Canonical form used for caching and duplicate detection.
 * @param {string} raw Any absolute URL.
 * @returns {string} Lowercased host, no fragment, no trailing slash (root keeps its slash).
 */
export function normalizeUrl(raw) {
  const u = new URL(raw);
  u.hash = '';
  u.host = u.host.toLowerCase();
  let s = u.toString();
  if (u.pathname !== '/' && s.endsWith('/')) s = s.slice(0, -1);
  return s;
}

/**
 * String half of the SSRF guard: only public http(s) targets may be fetched,
 * including any URL the model asks for and any redirect destination.
 * @param {string} raw URL to check.
 * @returns {{ok: boolean, reason?: string}}
 */
export function isAllowedUrl(raw) {
  let u;
  try {
    u = new URL(raw);
  } catch {
    return { ok: false, reason: 'malformed URL' };
  }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') {
    return { ok: false, reason: 'only http(s) URLs are allowed' };
  }
  // WHATWG URL parsing already rewrites IPv4 shorthands like 2130706433 to dotted form.
  const host = u.hostname.replace(/^\[|\]$/g, '');
  if (LOCALHOST_RE.test(host) || (net.isIP(host) && isPrivateAddress(host))) {
    return { ok: false, reason: 'private or loopback host' };
  }
  return { ok: true };
}

/**
 * DNS half of the SSRF guard. Lookup failures pass so the fetch reports the
 * real DNS error instead of a misleading "private". Best effort: the fetch
 * resolves again on its own, so a rebinding attacker can race the lookups.
 * @param {string} url URL about to be requested.
 * @param {(host: string, opts: {all: true}) => Promise<Array<{address: string}>>} lookup
 * @throws When the host is, or resolves to, a private address.
 */
export async function assertResolvesPublic(url, lookup) {
  const hostname = new URL(url).hostname.replace(/^\[|\]$/g, '');
  if (net.isIP(hostname)) {
    if (isPrivateAddress(hostname)) throw new Error(`private address ${hostname}`);
    return;
  }
  let addrs;
  try {
    addrs = await lookup(hostname, { all: true });
  } catch {
    return;
  }
  const bad = addrs.find((a) => isPrivateAddress(a.address));
  if (bad) throw new Error(`host ${hostname} resolves to private address ${bad.address}`);
}
