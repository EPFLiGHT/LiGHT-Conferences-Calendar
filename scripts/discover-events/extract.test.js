import { describe, it, expect } from 'vitest';
import { extractEvents, EVENTS_SCHEMA } from './extract.js';
import { TODAY, fakeLlm, jsonReply } from '../sync-llm/test-helpers.js';

describe('extractEvents', () => {
  it('asks for each event\'s deadlines and calls page under the deadline sync\'s rules', async () => {
    const llm = fakeLlm(jsonReply({ events: [] }));
    await extractEvents(llm, { url: 'https://x.example/', text: 'x', today: TODAY });
    const system = llm.requests[0].input.find((m) => m.role === 'system').content;
    expect(system).toContain('"early_registration": the last day of early-bird');
    expect(system).toMatch(/"calls_link"/);
    const item = EVENTS_SCHEMA.schema.properties.events.items;
    expect(item.required).toEqual(expect.arrayContaining(['deadlines', 'calls_link']));
    expect(item.required).toEqual(Object.keys(item.properties));
  });
});
