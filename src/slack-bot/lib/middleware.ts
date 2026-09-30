import type { NextResponse } from 'next/server';
import { verifySlackRequest } from './slackVerify';
import { badRequestResponse, errorResponse } from './responses';
import { logger } from './logger';

/** Slash commands and interactions are form posts; the Events API sends JSON. */
type BodyFormat = 'form' | 'json';

type SlackHandler<T> = (payload: T, teamId: string | undefined) => Promise<NextResponse>;

function parseBody(body: string, format: BodyFormat): unknown {
  if (format === 'json') return JSON.parse(body);
  const params = new URLSearchParams(body);
  // Interactions wrap their JSON in a `payload` field; slash commands are plain fields.
  const payload = params.get('payload');
  return payload ? JSON.parse(payload) : Object.fromEntries(params);
}

/** Commands and events carry `team_id`; interactions carry `team.id`. */
function extractTeamId(payload: unknown): string | undefined {
  if (typeof payload !== 'object' || payload === null) return undefined;
  const { team_id, team } = payload as { team_id?: string; team?: { id?: string } };
  return team_id ?? team?.id;
}

/** Verifies the Slack signature, parses the body and extracts the team; a thrown handler becomes a 500. */
export function withSlackMiddleware<T>(
  format: BodyFormat,
  handler: SlackHandler<T>
): (request: Request) => Promise<NextResponse> {
  return async (request) => {
    try {
      const body = await request.text();
      if (!(await verifySlackRequest(request.headers, body))) {
        return errorResponse('Invalid signature', 401);
      }
      const payload = parseBody(body, format);
      return await handler(payload as T, extractTeamId(payload));
    } catch (error) {
      if (error instanceof SyntaxError) return badRequestResponse('Invalid request format');
      logger.error('Slack request failed', { path: new URL(request.url).pathname, error });
      return errorResponse('Internal server error');
    }
  };
}
