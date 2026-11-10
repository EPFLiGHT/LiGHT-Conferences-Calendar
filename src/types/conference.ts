import { DateTime } from 'luxon';
import type { DeadlineGroup, DeadlineType } from '@/constants/deadlineTypes';

export interface ConferenceDeadline {
  type: DeadlineType;
  due: string;
  label?: string;
  pin?: boolean;
}

export interface Conference {
  id: string;
  title: string;
  year: number;
  full_name: string;
  link?: string;
  deadlines?: ConferenceDeadline[];
  // 'attendance' = registration event, no submission; 'tba' = deadline not yet announced.
  deadline_status?: 'attendance' | 'tba';
  timezone: string;
  date?: string;
  start?: string;
  end?: string;
  place?: string;
  sub: string[];
  type: string;
  note?: string;
  paperslink?: string;
}

export interface DeadlineInfo {
  /** Stable within the entry; ICS UIDs and calendar tile ids are built from it. */
  key: string;
  type: DeadlineType;
  group: DeadlineGroup;
  label: string;
  shortLabel: string;
  datetime: DateTime;
  localDatetime: DateTime;
}
