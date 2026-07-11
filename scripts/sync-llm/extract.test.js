import { describe, it, expect } from 'vitest';
import { DateTime } from 'luxon';
import { EDITIONS_SCHEMA, extractFromPage } from './extract.js';
import { createLlm } from './llm.js';

const TODAY = DateTime.fromISO('2026-07-09T00:00:00Z', { zone: 'utc' });

const RESULT = {
  page_has_dates: true,
  editions: [{
    year: 2026, full_name: null, location: 'Verona, Italy',
    start_date: '2026-06-22', end_date: '2026-06-25',
    deadlines: [{
      kind: 'paper', date: '2026-05-06', time: null, timezone_text: null,
      evidence: 'Paper submission deadline | May 6, 2026',
    }],
  }],
};

describe('EDITIONS_SCHEMA', () => {
  it('is strict: every object lists all properties as required', () => {
    const check = (node) => {
      if (node?.type === 'object' || (Array.isArray(node?.type) && node.type.includes('object'))) {
        expect(node.additionalProperties).toBe(false);
        expect(Object.keys(node.properties).sort()).toEqual([...node.required].sort());
      }
      for (const v of Object.values(node?.properties ?? {})) check(v);
      if (node?.items) check(node.items);
    };
    check(EDITIONS_SCHEMA.schema);
  });
});

describe('extractFromPage', () => {
  it('sends the page as delimited untrusted data and parses the reply', async () => {
    let req;
    const client = { responses: { create: async (r) => {
      req = r;
      return { output: [], output_text: JSON.stringify(RESULT), usage: {} };
    } } };
    const llm = createLlm({ client });
    const out = await extractFromPage(llm, {
      venueTitle: 'Fixture Conf', pageText: 'Paper submission deadline | May 6, 2026',
      url: 'https://fixture.example/dates', today: TODAY,
    });
    expect(out).toEqual(RESULT);
    expect(req.text.format.name).toBe('conference_editions');
    const user = req.input.find((m) => m.role === 'user').content;
    expect(user).toContain('<page>');
    expect(user).toContain('Fixture Conf');
    const system = req.input.find((m) => m.role === 'system').content;
    expect(system).toMatch(/never infer/i);
    expect(system).toMatch(/untrusted/i);
  });

  it('returns null instead of throwing when the response came back incomplete', async () => {
    const client = { responses: { create: async () => ({
      status: 'incomplete', output: [], output_text: '{"page_has_dates": tru', usage: {},
    }) } };
    const out = await extractFromPage(createLlm({ client }), {
      venueTitle: 'Fixture Conf', pageText: 'x', url: 'https://fixture.example/dates', today: TODAY,
    });
    expect(out).toBeNull();
  });

  it('returns null instead of throwing on empty or unparseable output text', async () => {
    const client = { responses: { create: async () => ({ output: [], output_text: '', usage: {} }) } };
    const out = await extractFromPage(createLlm({ client }), {
      venueTitle: 'Fixture Conf', pageText: 'x', url: 'https://fixture.example/dates', today: TODAY,
    });
    expect(out).toBeNull();
  });

  it('tells the model what today is and which edition years are in scope', async () => {
    let req;
    const client = { responses: { create: async (r) => {
      req = r;
      return { output: [], output_text: JSON.stringify(RESULT), usage: {} };
    } } };
    await extractFromPage(createLlm({ client }), {
      venueTitle: 'Fixture Conf', pageText: 'x', url: 'https://fixture.example/dates', today: TODAY,
    });
    const prompt = req.input.map((m) => m.content).join('\n');
    expect(prompt).toContain('2026-07-09');
    expect(prompt).toContain('2026');
    expect(prompt).toContain('2028');
  });
});
