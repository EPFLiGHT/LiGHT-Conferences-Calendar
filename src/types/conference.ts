import { DateTime } from 'luxon';

export interface Conference {
  id: string;
  title: string;
  year: number;
  full_name: string;
  link?: string;
  deadline?: string;
  abstract_deadline?: string;
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
  kind: 'abstract' | 'paper';
  label: string;
  datetime: DateTime;
  localDatetime: DateTime;
}
