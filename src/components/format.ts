import type { DateTime } from 'luxon';

/** "HH:mm Zone", both read from the same DateTime so time and zone always match. */
export function formatTimeWithZone(dt: DateTime): string {
  return `${dt.toFormat('HH:mm')} ${dt.zoneName}`;
}

export function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

/** Two-digit count plus noun, pluralized with a trailing "s": "03 members". */
export function countLabel(n: number, noun: string): string {
  return `${pad2(n)} ${noun}${n === 1 ? '' : 's'}`;
}
