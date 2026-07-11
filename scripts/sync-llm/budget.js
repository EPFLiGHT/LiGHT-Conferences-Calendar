/**
 * The meters that keep an agent from running up a bill. A budget counts tool
 * turns, tokens and elapsed time, and exceeded() names whichever ceiling was
 * hit first so the report can say why a venue was abandoned. Callers check it
 * before every model call and again after every tool call, since a single
 * fetch can push the token count over on its own.
 */

/**
 * @param {{maxTurns?: number, maxTokens?: number, maxMs?: number, now?: () => number}} [opts]
 * @returns {{turn: () => void, addUsage: (u?: {input_tokens?: number, output_tokens?: number}) => void,
 *   exceeded: () => string|null, snapshot: () => {turns: number, inputTokens: number, outputTokens: number},
 *   limits: () => {maxTurns: number, maxTokens: number, maxMs: number}}}
 *   limits() lets a caller tell the model its real budget instead of restating it.
 */
export function createBudget({ maxTurns = 6, maxTokens = 80_000, maxMs = 120_000, now = Date.now } = {}) {
  let turns = 0;
  let inputTokens = 0;
  let outputTokens = 0;
  const started = now();
  return {
    turn() { turns += 1; },
    addUsage(u = {}) {
      inputTokens += u.input_tokens ?? 0;
      outputTokens += u.output_tokens ?? 0;
    },
    exceeded() {
      if (turns > maxTurns) return 'turns';
      if (inputTokens + outputTokens > maxTokens) return 'tokens';
      if (now() - started > maxMs) return 'time';
      return null;
    },
    snapshot() { return { turns, inputTokens, outputTokens }; },
    limits() { return { maxTurns, maxTokens, maxMs }; },
  };
}

/**
 * Whole-run token ceiling; turn and time limits disabled.
 * @param {{maxTokens?: number}} [opts]
 */
export function createRunBudget({ maxTokens = 500_000 } = {}) {
  return createBudget({ maxTokens, maxTurns: Infinity, maxMs: Infinity });
}
