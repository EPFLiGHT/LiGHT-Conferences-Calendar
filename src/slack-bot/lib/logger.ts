/** JSON-line logger for Vercel logs. An `error` in meta is expanded to name, message and stack. */

import { slackErrorCode } from './slackErrors';

type LogMeta = Record<string, unknown>;

type SerializedError = { name?: string; message: string; stack?: string; slackError?: string };

function serializeError(error: unknown): SerializedError {
  if (!(error instanceof Error)) {
    return { message: typeof error === 'string' ? error : JSON.stringify(error) ?? String(error) };
  }
  const slackError = slackErrorCode(error);
  return { name: error.name, message: error.message, stack: error.stack, ...(slackError && { slackError }) };
}

function write(level: string, print: (line: string) => void, message: string, meta?: LogMeta): void {
  const entry: LogMeta = { level, message, timestamp: new Date().toISOString(), ...meta };
  if (meta && 'error' in meta) entry.error = serializeError(meta.error);
  print(JSON.stringify(entry));
}

export const logger = {
  info: (message: string, meta?: LogMeta) => write('INFO', console.log, message, meta),
  warn: (message: string, meta?: LogMeta) => write('WARN', console.warn, message, meta),
  error: (message: string, meta?: LogMeta) => write('ERROR', console.error, message, meta),
  debug: (message: string, meta?: LogMeta) => {
    if (process.env.NODE_ENV === 'development') write('DEBUG', console.debug, message, meta);
  },
};
