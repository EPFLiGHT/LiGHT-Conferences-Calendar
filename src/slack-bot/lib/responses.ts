/** HTTP responses for the Slack and cron routes. */

import { NextResponse } from 'next/server';
import type { BlockKitMessage } from '@/types/slack';

/** A reply only the user who ran the command or clicked the button sees. */
export type EphemeralReply = (BlockKitMessage | { text: string }) & {
  response_type: 'ephemeral';
  replace_original?: boolean;
};

export function ephemeralReply(message: BlockKitMessage | { text: string }, replaceOriginal?: boolean): EphemeralReply {
  return { ...message, response_type: 'ephemeral', ...(replaceOriginal !== undefined && { replace_original: replaceOriginal }) };
}

export function ephemeralResponse(message: BlockKitMessage | { text: string }): NextResponse {
  return NextResponse.json(ephemeralReply(message));
}

export function textResponse(text: string): NextResponse {
  return ephemeralResponse({ text });
}

export function successResponse(data: object): NextResponse {
  return NextResponse.json(data);
}

export function errorResponse(message: string, status = 500): NextResponse {
  return NextResponse.json({ error: message }, { status });
}

export function badRequestResponse(message = 'Bad request'): NextResponse {
  return errorResponse(message, 400);
}

/** Acknowledges a Slack request that needs no reply. */
export function acknowledgeResponse(): NextResponse {
  return NextResponse.json({ ok: true });
}
