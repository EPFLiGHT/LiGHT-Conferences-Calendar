import { describe, it, expect } from 'vitest';
import { buildDraft } from './drafts.js';
import { validateEntry } from '../../src/utils/conferenceSchema.js';

const event = (over = {}) => ({
  title: 'St. Gallen Symposium', full_name: null, year: 2027,
  start: '2027-04-28', end: '2027-04-29', city: 'St. Gallen', country: 'Switzerland', timezone: 'Europe/Zurich',
  link: 'https://symposium.org/', type: 'summit', subjects: ['Global Affairs'],
  ...over,
});

describe('buildDraft', () => {
  it('drafts a schema-valid summit entry', () => {
    const { entry, file } = buildDraft(event(), { takenIds: new Set() });
    expect(file).toBe('summits.yaml');
    expect(entry).toEqual({
      title: 'St. Gallen Symposium',
      year: 2027,
      id: 'stgallensymposium27',
      deadline_status: 'attendance',
      link: 'https://symposium.org/',
      timezone: 'Europe/Zurich',
      place: 'St. Gallen, Switzerland',
      date: 'Apr 28-29, 2027',
      start: '2027-04-28',
      end: '2027-04-29',
      sub: 'Global Affairs',
      type: 'summit',
    });
    expect(validateEntry(entry, 0)).toEqual([]);
  });

  it('places an event abroad in its own country and time zone', () => {
    const { entry } = buildDraft(
      event({ title: 'CPHIA', city: 'Addis Ababa', country: 'Ethiopia', timezone: 'Africa/Addis_Ababa' }),
      { takenIds: new Set() },
    );
    expect(entry).toMatchObject({ place: 'Addis Ababa, Ethiopia', timezone: 'Africa/Addis_Ababa' });
    expect(validateEntry(entry, 0)).toEqual([]);
  });

  it('keeps a prior edition\'s title, full name, subject, type and id pattern', () => {
    const prior = {
      title: 'GESDA Summit', id: 'gesda26', full_name: 'Geneva Science Diplomacy Anticipation Summit',
      sub: 'Global Health', type: 'summit',
    };
    const { entry, notes } = buildDraft(event({ title: 'Anticipation Summit', type: 'conference' }), { prior, takenIds: new Set() });
    expect(entry).toMatchObject({
      title: 'GESDA Summit', id: 'gesda27', full_name: 'Geneva Science Diplomacy Anticipation Summit',
      sub: 'Global Health', type: 'summit',
    });
    expect(notes).toEqual(['full_name kept from gesda26; check its edition ordinal']);
  });

  it('prefers the page\'s full name, without its year', () => {
    const prior = { title: 'WHA', id: 'wha26', full_name: 'Seventy-ninth World Health Assembly', type: 'summit' };
    const { entry, notes } = buildDraft(
      event({ full_name: 'Eightieth World Health Assembly 2027' }),
      { prior, takenIds: new Set() },
    );
    expect(entry.full_name).toBe('Eightieth World Health Assembly');
    expect(notes).toEqual([]);
  });

  it('drafts the page\'s deadlines after the link, dropping attendance for a call', () => {
    const abstract = {
      type: 'abstract', date: '2027-01-15', time: null, timezone_text: null, before: false,
      evidence: 'Abstracts due 15 January 2027',
    };
    const { entry } = buildDraft(event({ deadlines: [abstract] }), { takenIds: new Set() });
    expect(entry.deadlines).toEqual([{ type: 'abstract', due: '2027-01-15 23:59' }]);
    expect(entry.deadline_status).toBeUndefined();
    const keys = Object.keys(entry);
    expect(keys[keys.indexOf('link') + 1]).toBe('deadlines');
    expect(validateEntry(entry, 0)).toEqual([]);
  });

  it('stays attendance-only when the page gives registration deadlines alone', () => {
    const early = {
      type: 'early_registration', date: '2027-03-01', time: '12:00', timezone_text: 'CET', before: false,
      evidence: 'Early-bird registration until 1 March 2027, 12:00 CET',
    };
    const { entry } = buildDraft(event({ deadlines: [early] }), { takenIds: new Set() });
    expect(entry.deadline_status).toBe('attendance');
    expect(entry.deadlines).toEqual([{ type: 'early_registration', due: '2027-03-01 12:00' }]);
    expect(validateEntry(entry, 0)).toEqual([]);
  });

  it('lists several subjects as an array', () => {
    const { entry } = buildDraft(event({ subjects: ['AI', 'Global Affairs'] }), { takenIds: new Set() });
    expect(entry.sub).toEqual(['AI', 'Global Affairs']);
  });

  it('refuses an id that is already taken', () => {
    expect(buildDraft(event(), { takenIds: new Set(['stgallensymposium27']) }).error).toMatch(/already taken/);
  });
});
