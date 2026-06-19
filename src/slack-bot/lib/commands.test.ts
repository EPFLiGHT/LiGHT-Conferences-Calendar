import { describe, it, expect } from 'vitest';
import { execSync } from 'node:child_process';

describe('command-string consistency', () => {
  it('has no space-style slash-conf commands (hyphen required) in src/', () => {
    // Pattern built at runtime to avoid self-match in grep output
    const pattern = ['/conf', ' '].join('');
    const out = execSync(`grep -rn "${pattern}" src/ || true`).toString().trim();
    expect(out).toBe('');
  });
});
