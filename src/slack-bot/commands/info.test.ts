import { describe, it, expect } from 'vitest';
import { findConference } from './info';
import { conference } from '@/slack-bot/testing/fixtures';

const CONFERENCES = [
  conference({ id: 'icmlw26', title: 'ICML Workshop', full_name: 'ICML Workshop on Health' }),
  conference({ id: 'icml26', title: 'ICML', full_name: 'International Conference on Machine Learning' }),
  conference({ id: 'neurips26', title: 'NeurIPS', full_name: 'Neural Information Processing Systems' }),
];

describe('findConference', () => {
  it('matches an ID exactly, ignoring case', () => {
    expect(findConference(CONFERENCES, 'NEURIPS26')?.id).toBe('neurips26');
  });

  it('prefers an exact title over other search hits', () => {
    expect(findConference(CONFERENCES, 'icml')?.id).toBe('icml26');
  });

  it('falls back to the first search hit', () => {
    expect(findConference(CONFERENCES, 'machine learning')?.id).toBe('icml26');
  });

  it('returns undefined when nothing matches', () => {
    expect(findConference(CONFERENCES, 'cvpr')).toBeUndefined();
  });
});
