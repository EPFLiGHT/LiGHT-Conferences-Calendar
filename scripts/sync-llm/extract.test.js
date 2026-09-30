import { describe, it, expect } from 'vitest';
import { EDITIONS_SCHEMA, extractFromPage } from './extract.js';
import { TODAY, edition, deadline, fakeLlm, jsonReply } from './test-helpers.js';

const RESULT = {
  page_has_dates: true,
  editions: [edition({
    location: 'Verona, Italy', start_date: '2026-06-22', end_date: '2026-06-25',
    deadlines: [deadline({ date: '2026-05-06', evidence: 'Paper submission deadline | May 6, 2026' })],
  })],
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
    const llm = fakeLlm(jsonReply(RESULT));
    const out = await extractFromPage(llm, {
      venueTitle: 'Fixture Conf', pageText: 'Paper submission deadline | May 6, 2026',
      url: 'https://fixture.example/dates', today: TODAY,
    });
    expect(out).toEqual(RESULT);
    const [req] = llm.requests;
    expect(req.text.format.name).toBe('conference_editions');
    const user = req.input.find((m) => m.role === 'user').content;
    expect(user).toContain('<page>');
    expect(user).toContain('Fixture Conf');
    const system = req.input.find((m) => m.role === 'system').content;
    expect(system).toMatch(/never infer/i);
    expect(system).toMatch(/untrusted/i);
  });

  it('returns null instead of throwing when the response came back incomplete', async () => {
    const llm = fakeLlm({ status: 'incomplete', output_text: '{"page_has_dates": tru' });
    const out = await extractFromPage(llm, {
      venueTitle: 'Fixture Conf', pageText: 'x', url: 'https://fixture.example/dates', today: TODAY,
    });
    expect(out).toBeNull();
  });

  it('returns null instead of throwing on empty or unparseable output text', async () => {
    const out = await extractFromPage(fakeLlm(), {
      venueTitle: 'Fixture Conf', pageText: 'x', url: 'https://fixture.example/dates', today: TODAY,
    });
    expect(out).toBeNull();
  });

  it('tells the model what today is and which edition years are in scope', async () => {
    const llm = fakeLlm(jsonReply(RESULT));
    await extractFromPage(llm, {
      venueTitle: 'Fixture Conf', pageText: 'x', url: 'https://fixture.example/dates', today: TODAY,
    });
    const prompt = llm.requests[0].input.map((m) => m.content).join('\n');
    expect(prompt).toContain('2026-07-08');
    expect(prompt).toContain('2026');
    expect(prompt).toContain('2028');
  });
});
