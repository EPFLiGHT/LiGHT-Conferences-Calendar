import { NextResponse } from 'next/server';

/**
 * Standard response builders for consistent API responses
 */

export interface SlackResponse {
  ok?: boolean;
  text?: string;
  error?: string;
  [key: string]: unknown;
}

/**
 * Create a success response
 */
export function successResponse(
  data: SlackResponse = {},
  status = 200
): NextResponse {
  return NextResponse.json(data, { status });
}

/**
 * Create an error response
 */
export function errorResponse(
  message: string,
  status = 500
): NextResponse {
  return NextResponse.json(
    { error: message },
    { status }
  );
}

/**
 * Create a Slack-formatted text response
 */
export function textResponse(
  text: string,
  responseType: 'ephemeral' | 'in_channel' = 'in_channel'
): NextResponse {
  return NextResponse.json({
    text,
    response_type: responseType,
  });
}

/**
 * Create a bad request response
 */
export function badRequestResponse(
  message = 'Bad request'
): NextResponse {
  return errorResponse(message, 400);
}

/**
 * Acknowledge Slack request immediately (for async processing)
 */
export function acknowledgeResponse(): NextResponse {
  return NextResponse.json({ ok: true });
}
