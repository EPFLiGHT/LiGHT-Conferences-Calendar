import { describe, it, expect } from 'vitest';
import { findLeads, SEARCHES_PER_TOPIC } from './search.js';
import { TODAY, fakeLlm, jsonReply } from '../sync-llm/test-helpers.js';

const searchCall = { type: 'web_search_call', action: { type: 'search', query: 'q' } };

describe('findLeads', () => {
  it('asks for a capped, Swiss-located web search and counts the searches made', async () => {
    const llm = fakeLlm({
      ...jsonReply({ leads: [{ name: 'Alpine Forum', url: 'https://alpine.example/' }] }),
      output: [searchCall, searchCall],
    });
    const out = await findLeads(llm, { topic: 'foresight', today: TODAY, known: ['GESDA Summit 2026'] });
    expect(out).toEqual({ leads: [{ name: 'Alpine Forum', url: 'https://alpine.example/' }], searches: 2 });
    const [req] = llm.requests;
    expect(req.max_tool_calls).toBe(SEARCHES_PER_TOPIC);
    expect(req.tools[0]).toMatchObject({ type: 'web_search', user_location: { country: 'CH' } });
    expect(req.input[0].content).toContain('Strategic foresight');
    expect(req.input[0].content).toContain('GESDA Summit 2026');
  });

  it('drops leads it must never fetch', async () => {
    const llm = fakeLlm(jsonReply({ leads: [
      { name: 'Local', url: 'http://127.0.0.1/admin' },
      { name: 'Odd', url: 'ftp://files.example/' },
      { name: 'Fine', url: 'https://fine.example/' },
    ] }));
    expect((await findLeads(llm, { topic: 'ai_digital', today: TODAY, known: [] })).leads.map((l) => l.name)).toEqual(['Fine']);
  });

  it('strips tracking parameters from lead URLs', async () => {
    const llm = fakeLlm(jsonReply({ leads: [{ name: 'Fine', url: 'https://fine.example/event?id=3&utm_source=openai' }] }));
    expect((await findLeads(llm, { topic: 'ai_digital', today: TODAY, known: [] })).leads[0].url)
      .toBe('https://fine.example/event?id=3');
  });

  it('returns null leads, still counting searches, when the answer is unusable', async () => {
    const llm = fakeLlm({ output: [searchCall], output_text: '{not json' });
    expect(await findLeads(llm, { topic: 'governance', today: TODAY, known: [] })).toEqual({ leads: null, searches: 1 });
  });
});
