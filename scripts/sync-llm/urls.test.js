import { describe, it, expect } from 'vitest';
import { normalizeUrl, isAllowedUrl, isPrivateAddress } from './urls.js';

describe('normalizeUrl', () => {
  it('lowercases host, drops hash and trailing slash', () => {
    expect(normalizeUrl('https://Example.ORG/Dates/#section')).toBe('https://example.org/Dates');
  });
  it('keeps the root slash', () => {
    expect(normalizeUrl('https://example.org/')).toBe('https://example.org/');
  });
});

describe('isAllowedUrl', () => {
  it('accepts public http(s)', () => {
    expect(isAllowedUrl('https://example.org/x').ok).toBe(true);
  });
  it.each([
    'ftp://example.org/x',
    'file:///etc/passwd',
    'http://localhost/admin',
    'http://127.0.0.1/x',
    'http://10.1.2.3/x',
    'http://172.16.0.1/x',
    'http://192.168.1.1/x',
    'http://169.254.1.1/x',
    'http://[::1]/x',
    'http://0.0.0.0/x',
    'http://100.64.0.1/x',
    'http://100.127.255.1/x',
    'http://[fe80::1]/x',
    'http://[fe9f::1]/x',
    'http://[febf::1]/x',
    'http://[fd00::1]/x',
    'http://[::ffff:127.0.0.1]/x',
    'http://[::ffff:169.254.169.254]/x',
    'http://[::ffff:10.0.0.1]/x',
    'http://[::ffff:7f00:1]/x',
    'http://[::]/x',
    'http://2130706433/x',
    'http://localhost./x',
    'http://app.localhost/x',
    'not a url',
  ])('rejects %s', (url) => {
    expect(isAllowedUrl(url).ok).toBe(false);
  });
  it('still allows a host just outside the CGNAT range', () => {
    expect(isAllowedUrl('http://100.128.0.1/x').ok).toBe(true);
  });
});

describe('isPrivateAddress', () => {
  it.each(['::7f00:1', '64:ff9b::7f00:1', '2002:7f00:1::', 'fec0::1', '224.0.0.1', '255.255.255.255'])(
    'treats %s (embedded IPv4, site-local, multicast or reserved) as private',
    (addr) => {
      expect(isPrivateAddress(addr)).toBe(true);
    },
  );

  it.each(['127.0.0.1', '10.1.2.3', '169.254.169.254', '::', '::1', '[::1]', 'fe80::1', 'fd00::1',
    '::ffff:127.0.0.1', '::ffff:7f00:1', 'not an address'])('treats %s as private', (addr) => {
    expect(isPrivateAddress(addr)).toBe(true);
  });
  it.each(['203.0.113.7', '100.128.0.1', '2001:db8::1', '::ffff:203.0.113.7'])('treats %s as public', (addr) => {
    expect(isPrivateAddress(addr)).toBe(false);
  });
});
