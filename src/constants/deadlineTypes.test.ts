import { describe, it, expect } from 'vitest';
import { deadlineGroup, deadlineLabel, deadlineShortLabel } from '@/constants/deadlineTypes';

describe('deadline labels', () => {
  it('labels by custom label first, short labels by type first', () => {
    expect(deadlineLabel({ type: 'poster' })).toBe('Poster abstract');
    expect(deadlineLabel({ type: 'presenter_registration', label: 'Poster presenter registration' })).toBe('Poster presenter registration');
    expect(deadlineShortLabel({ type: 'presenter_registration', label: 'Poster presenter registration' })).toBe('Presenter reg.');
    expect(deadlineShortLabel({ type: 'other', label: 'Science Speed Talks video' })).toBe('Science Speed Talks video');
    expect(deadlineGroup('grant')).toBe('funding');
  });
});
