import { describe, it, expect } from 'vitest';
import { createBudget, createRunBudget } from './budget.js';

describe('createBudget', () => {
  it('reports nothing exceeded when fresh', () => {
    expect(createBudget().exceeded()).toBeNull();
  });

  it('trips on turns past the cap', () => {
    const b = createBudget({ maxTurns: 2 });
    b.turn(); b.turn();
    expect(b.exceeded()).toBeNull();
    b.turn();
    expect(b.exceeded()).toBe('turns');
  });

  it('trips on tokens and tracks input/output separately', () => {
    const b = createBudget({ maxTokens: 100 });
    b.addUsage({ input_tokens: 60, output_tokens: 30 });
    expect(b.exceeded()).toBeNull();
    b.addUsage({ input_tokens: 20 });
    expect(b.exceeded()).toBe('tokens');
    expect(b.snapshot()).toEqual({ turns: 0, inputTokens: 80, outputTokens: 30 });
  });

  it('trips on wall clock via an injectable clock', () => {
    let t = 0;
    const b = createBudget({ maxMs: 1000, now: () => t });
    expect(b.exceeded()).toBeNull();
    t = 1001;
    expect(b.exceeded()).toBe('time');
  });

  it('ignores missing usage fields', () => {
    const b = createBudget();
    b.addUsage({});
    b.addUsage();
    expect(b.snapshot().inputTokens).toBe(0);
  });

  it('reports its limits so callers can state them without hardcoding', () => {
    expect(createBudget().limits()).toEqual({ maxTurns: 6, maxTokens: 80_000, maxMs: 120_000 });
    expect(createBudget({ maxTurns: 3 }).limits().maxTurns).toBe(3);
  });
});

describe('createRunBudget', () => {
  it('only trips on tokens', () => {
    const b = createRunBudget({ maxTokens: 10 });
    for (let i = 0; i < 100; i++) b.turn();
    expect(b.exceeded()).toBeNull();
    b.addUsage({ input_tokens: 11 });
    expect(b.exceeded()).toBe('tokens');
  });
});
