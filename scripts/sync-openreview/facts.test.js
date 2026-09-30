import { describe, it, expect } from 'vitest';
import fs from 'fs';
import { buildFacts } from './facts.js';

const group = JSON.parse(
  fs.readFileSync(new URL('./fixtures/neurips26-group.json', import.meta.url), 'utf8'),
).groups[0].content;

describe('buildFacts', () => {
  it('extracts facts from a real venue group', () => {
    const facts = buildFacts(group);
    expect(facts.fullName).toBe('The Fortieth Annual Conference on Neural Information Processing Systems');
    expect(facts.location).toBe('Sydney, Australia');
    expect(facts.startIso).toBe('2026-12-06');
    expect(facts.submissionId).toBe('NeurIPS.cc/2026/Conference/-/Submission');
    expect(facts.deadline.toISO()).toBe('2026-05-07T11:59:00.000Z');
    expect(facts.abstractDeadline.toISO()).toBe('2026-05-05T11:59:00.000Z');
    expect(facts.link).toBe('https://neurips.cc/');
    expect(facts.endIso).toBeNull();
  });

  it('nulls out placeholder locations', () => {
    const facts = buildFacts({ location: { value: 'TBD' } });
    expect(facts.location).toBeNull();
  });

  it('ignores fields served as numbers instead of strings', () => {
    const facts = buildFacts({
      title: { value: 7 },
      location: { value: 12345 },
      start_date: { value: 1808769600000 },
      date: { value: 0 },
      submission_id: { value: 99 },
    });
    expect(facts).toMatchObject({
      fullName: null, location: null, startIso: null, submissionId: null, deadline: null,
    });
  });
});
