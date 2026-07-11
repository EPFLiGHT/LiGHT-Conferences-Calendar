import fs from 'fs';
import os from 'os';
import path from 'path';
import { describe, it, expect } from 'vitest';
import { loadApiKey, createLlm, functionCalls } from './llm.js';

describe('loadApiKey', () => {
  it('prefers the environment variable', () => {
    const original = process.env.OPENAI_API_KEY;
    process.env.OPENAI_API_KEY = 'sk-env';
    try {
      expect(loadApiKey('/nonexistent')).toBe('sk-env');
    } finally {
      if (original === undefined) delete process.env.OPENAI_API_KEY;
      else process.env.OPENAI_API_KEY = original;
    }
  });

  it('falls back to .env.local', () => {
    const original = process.env.OPENAI_API_KEY;
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'llm-'));
    try {
      delete process.env.OPENAI_API_KEY;
      fs.writeFileSync(path.join(dir, '.env.local'), 'FOO=1\nOPENAI_API_KEY="sk-file"\n');
      expect(loadApiKey(dir)).toBe('sk-file');
    } finally {
      if (original === undefined) delete process.env.OPENAI_API_KEY;
      else process.env.OPENAI_API_KEY = original;
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it('returns null when nothing is set', () => {
    const original = process.env.OPENAI_API_KEY;
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'llm-'));
    try {
      delete process.env.OPENAI_API_KEY;
      expect(loadApiKey(dir)).toBeNull();
    } finally {
      if (original === undefined) delete process.env.OPENAI_API_KEY;
      else process.env.OPENAI_API_KEY = original;
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe('createLlm', () => {
  it('sends model, input, tools and strict schema, and reports usage', async () => {
    let seen;
    const usages = [];
    const client = {
      responses: {
        create: async (req) => {
          seen = req;
          return { output: [], output_text: '{}', usage: { input_tokens: 10, output_tokens: 2 } };
        },
      },
    };
    const llm = createLlm({ client, onUsage: (u) => usages.push(u) });
    await llm.respond({
      input: [{ role: 'user', content: 'hi' }],
      tools: [{ type: 'function', name: 't' }],
      schema: { name: 'thing', schema: { type: 'object' } },
    });
    expect(seen.model).toBe('gpt-5.4-mini');
    expect(seen.tools).toHaveLength(1);
    expect(seen.text.format).toEqual({
      type: 'json_schema', name: 'thing', schema: { type: 'object' }, strict: true,
    });
    expect(usages).toEqual([{ input_tokens: 10, output_tokens: 2 }]);
  });
});

describe('functionCalls', () => {
  it('parses call items and tolerates bad JSON args', () => {
    const res = { output: [
      { type: 'message', content: [] },
      { type: 'function_call', name: 'fetch_page', arguments: '{"url":"https://x.example"}', call_id: 'c1' },
      { type: 'function_call', name: 'submit', arguments: '{broken', call_id: 'c2' },
    ] };
    expect(functionCalls(res)).toEqual([
      { name: 'fetch_page', args: { url: 'https://x.example' }, call_id: 'c1' },
      { name: 'submit', args: null, call_id: 'c2' },
    ]);
  });
});
