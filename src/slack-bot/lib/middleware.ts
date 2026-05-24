import { NextRequest, NextResponse } from 'next/server';
import { verifySlackRequest } from './slackVerify';

/**
 * Types for Slack request handlers
 */
export type SlackRequestHandler<T = unknown> = (
  parsedBody: T,
  request: NextRequest,
  teamId?: string
) => Promise<NextResponse> | NextResponse;

export type SlackAuthConfig = {
  requireAuth?: boolean;
  authSecret?: string;
};

/**
 * Configuration for different Slack request types
 */
export enum SlackRequestType {
  FORM_URLENCODED = 'form', // Slash commands, interactions
  JSON = 'json',             // Events API
  CRON = 'cron',            // Cron jobs (no Slack verification)
}

/**
 * Middleware options
 */
export interface MiddlewareOptions<T> {
  requestType: SlackRequestType;
  handler: SlackRequestHandler<T>;
  authConfig?: SlackAuthConfig;
}

/**
 * Parse request body based on content type
 */
async function parseRequestBody(
  body: string,
  requestType: SlackRequestType
): Promise<unknown> {
  switch (requestType) {
    case SlackRequestType.FORM_URLENCODED: {
      const params = new URLSearchParams(body);
      const payload = params.get('payload');

      // interactions come as JSON in payload field
      if (payload) {
        return JSON.parse(payload);
      }

      // slash commands are form fields
      return Object.fromEntries(params.entries());
    }

    case SlackRequestType.JSON:
      return JSON.parse(body);

    case SlackRequestType.CRON:
      return {}; // cron jobs don't have a body

    default:
      throw new Error(`Unsupported request type: ${requestType}`);
  }
}

/**
 * Extract team_id from Slack request
 * Different request types have team_id in different locations
 */
function extractTeamId(parsedBody: any): string | undefined {
  // Slash commands and interactions
  if (parsedBody.team_id) {
    return parsedBody.team_id;
  }

  // Interactions and Events API requests use nested team object
  if (parsedBody.team?.id) {
    return parsedBody.team.id;
  }

  return undefined;
}

/**
 * Verify cron request authentication
 */
function verifyCronAuth(
  headers: Headers,
  authConfig?: SlackAuthConfig
): boolean {
  if (!authConfig?.requireAuth) {
    return true;
  }

  const authHeader = headers.get('authorization');
  const cronSecret = authConfig.authSecret || process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return false;
  }

  return true;
}

/**
 * Main middleware wrapper for Slack API routes
 * Handles verification, parsing, error handling, and response formatting
 */
export function withSlackMiddleware<T>(
  options: MiddlewareOptions<T>
): (request: NextRequest) => Promise<NextResponse> {
  return async (request: NextRequest): Promise<NextResponse> => {
    try {
      const body = await request.text();

      // cron jobs need auth check
      if (options.requestType === SlackRequestType.CRON) {
        const isAuthorized = verifyCronAuth(request.headers, options.authConfig);
        if (!isAuthorized) {
          return NextResponse.json(
            { error: 'Unauthorized' },
            { status: 401 }
          );
        }

        return await options.handler({} as T, request);
      }

      // verify slack signature
      const isValid = await verifySlackRequest(request.headers, body);
      if (!isValid) {
        return NextResponse.json(
          { error: 'Invalid signature' },
          { status: 401 }
        );
      }

      const parsedBody = await parseRequestBody(body, options.requestType);

      // Extract team_id for multi-workspace support
      const teamId = extractTeamId(parsedBody);

      return await options.handler(parsedBody as T, request, teamId);
    } catch (error) {
      console.error('Error in Slack middleware:', error);

      if (error instanceof SyntaxError) {
        return NextResponse.json(
          { error: 'Invalid request format' },
          { status: 400 }
        );
      }

      return NextResponse.json(
        { error: 'Internal server error' },
        { status: 500 }
      );
    }
  };
}
