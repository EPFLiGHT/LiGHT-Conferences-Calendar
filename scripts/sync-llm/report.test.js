import { describe, it, expect } from 'vitest';
import { renderExtraSections } from './report.js';

describe('renderExtraSections', () => {
  it('distinguishes venues that found nothing from ones that synced', () => {
    const text = renderExtraSections({
      evidence: [],
      usageByVenue: {
        Good: { tier: 0, outcome: 'submitted', inputTokens: 10, outputTokens: 2 },
        Empty: { tier: 2, outcome: 'not_found', inputTokens: 20, outputTokens: 3 },
        Broken: { tier: null, outcome: null, inputTokens: 1, outputTokens: 0 },
      },
      totals: { inputTokens: 31, outputTokens: 5 },
    });
    expect(text).toContain('- Good: tier 0, 12 tokens');
    expect(text).toContain('- Empty: tier 2, found nothing, 23 tokens');
    expect(text).toContain('- Broken: failed, 1 tokens');
  });
});
