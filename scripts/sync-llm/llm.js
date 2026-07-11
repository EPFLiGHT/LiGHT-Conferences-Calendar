/**
 * Thin wrapper around the OpenAI Responses API. It finds the key (environment
 * first, then .env.local when you run the sync by hand) and reports token
 * usage back to whoever is metering it. Retries on rate limits and 5xx belong
 * to the SDK, configured where the client is built in main.js. The client is a
 * constructor argument, so tests hand it a fake and never touch the network.
 */
import fs from 'fs';
import path from 'path';

/**
 * @param {string} repoRoot Directory containing .env.local.
 * @returns {string|null} The API key, or null when not configured.
 */
export function loadApiKey(repoRoot) {
  if (process.env.OPENAI_API_KEY) return process.env.OPENAI_API_KEY;
  const envPath = path.join(repoRoot, '.env.local');
  if (fs.existsSync(envPath)) {
    const m = fs.readFileSync(envPath, 'utf8').match(/^OPENAI_API_KEY\s*=\s*"?([^"\r\n]+)"?\s*$/m);
    if (m) return m[1].trim();
  }
  return null;
}

/**
 * @param {{client: object, model?: string, onUsage?: (u: object) => void}} opts
 *   client is an openai SDK instance or a test fake with responses.create.
 */
// Sampling params stay unset: the Responses API pins them for reasoning models.
export function createLlm({ client, model = 'gpt-5.4-mini', onUsage = () => {} }) {
  return {
    model,
    async respond({ input, tools, schema }) {
      const req = { model, input };
      if (tools) req.tools = tools;
      if (schema) {
        req.text = { format: { type: 'json_schema', name: schema.name, schema: schema.schema, strict: true } };
      }
      const res = await client.responses.create(req);
      onUsage(res.usage ?? {});
      return res;
    },
  };
}

/**
 * Extract function tool calls from a Responses API result.
 * @param {{output?: Array<object>}} response
 * @returns {Array<{name: string, args: object|null, call_id: string}>}
 *   args is null when the model produced unparseable JSON.
 */
export function functionCalls(response) {
  return (response.output ?? [])
    .filter((item) => item.type === 'function_call')
    .map((item) => {
      let args = null;
      try {
        args = JSON.parse(item.arguments);
      } catch { /* leave null; the agent returns an error to the model */ }
      return { name: item.name, args, call_id: item.call_id };
    });
}
