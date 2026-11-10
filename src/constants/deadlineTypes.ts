import { DEADLINE_TYPES as TYPES_DATA, DEADLINE_GROUPS as GROUPS_DATA } from './deadlineTypes.data';

export type DeadlineGroup = 'submission' | 'registration' | 'funding';
export type DeadlineType = keyof typeof TYPES_DATA;

interface TypeConfig {
  label: string | null;
  short: string | null;
  group: DeadlineGroup;
}

const TYPES: Record<DeadlineType, TypeConfig> = TYPES_DATA as Record<DeadlineType, TypeConfig>;
const GROUPS: Record<DeadlineGroup, { label: string; emoji: string }> = GROUPS_DATA;

export const DEADLINE_GROUP_LABELS = Object.fromEntries(
  Object.entries(GROUPS).map(([group, g]) => [group, g.label]),
) as Record<DeadlineGroup, string>;
export const DEADLINE_GROUP_EMOJIS = Object.fromEntries(
  Object.entries(GROUPS).map(([group, g]) => [group, g.emoji]),
) as Record<DeadlineGroup, string>;

interface LabeledItem {
  type: DeadlineType;
  label?: string;
}

export function isDeadlineType(type: unknown): type is DeadlineType {
  return typeof type === 'string' && Object.hasOwn(TYPES, type);
}

export function deadlineGroup(type: DeadlineType): DeadlineGroup {
  return TYPES[type].group;
}

/** The item's own label, else its type's. */
export function deadlineLabel(item: LabeledItem): string {
  return item.label || TYPES[item.type].label || '';
}

/** The type's short label; an `other` item falls back to its own label. */
export function deadlineShortLabel(item: LabeledItem): string {
  return TYPES[item.type].short || item.label || '';
}
