import { describe, it, expect } from 'vitest';
import { validateEvents } from './gates.js';
import { TODAY } from '../sync-llm/test-helpers.js';

const PAGE_URL = 'https://summit.example/';
const PAGE = 'Alpine Futures Summit. 28 - 29 April 2027, Geneva, Switzerland. Register now.';

/** An event as EVENTS_SCHEMA reports it, consistent with PAGE. */
const raw = (over = {}) => ({
  title: 'Alpine Futures Summit',
  full_name: null,
  start_date: '2027-04-28',
  end_date: '2027-04-29',
  dates_evidence: '28 - 29 April 2027',
  city: 'Geneva',
  link: PAGE_URL,
  kind: 'summit_or_forum',
  type: 'summit',
  topics: ['foresight'],
  subjects: ['Global Affairs'],
  fit: 'strong',
  why: 'Leaders discuss the long-term future.',
  ...over,
});

const check = (events, over = {}) =>
  validateEvents(events, { pageText: PAGE, pageUrl: PAGE_URL, links: [], today: TODAY, ...over });

describe('validateEvents', () => {
  it('keeps an event whose facts are all on the page', () => {
    const { events, dropped } = check([raw()]);
    expect(dropped).toEqual([]);
    expect(events).toEqual([expect.objectContaining({
      title: 'Alpine Futures Summit', year: 2027, start: '2027-04-28', end: '2027-04-29',
      city: 'Geneva', link: PAGE_URL, sourceUrl: PAGE_URL,
    })]);
  });

  it('drops dates the quote does not show', () => {
    const { events, dropped } = check([raw({ start_date: '2027-05-28', end_date: '2027-05-29' })]);
    expect(events).toEqual([]);
    expect(dropped[0]).toMatch(/not shown in a quote/);
  });

  it('drops a quote that is not on the page', () => {
    const { events } = check([raw({ dates_evidence: '28 - 29 April 2027, Palexpo' })]);
    expect(events).toEqual([]);
  });

  it('drops an end date the quote does not confirm instead of guessing it', () => {
    const { events, dropped } = check([raw({ end_date: '2027-04-30' })]);
    expect(events).toEqual([]);
    expect(dropped[0]).toMatch(/end date 2027-04-30 is not shown/);
  });

  it('reads a one-day event as ending the day it starts', () => {
    const page = 'Alpine Futures Summit on 28 April 2027 in Geneva.';
    const { events } = check(
      [raw({ end_date: null, dates_evidence: '28 April 2027' })],
      { pageText: page },
    );
    expect(events[0]).toMatchObject({ start: '2027-04-28', end: '2027-04-28' });
  });

  it('drops events that started already or start beyond the horizon', () => {
    const past = 'Alpine Futures Summit. 1 - 2 June 2026, Geneva.';
    expect(check([raw({ start_date: '2026-06-01', end_date: '2026-06-02', dates_evidence: '1 - 2 June 2026' })], { pageText: past }).events).toEqual([]);
    const far = 'Alpine Futures Summit. 1 - 2 June 2029, Geneva.';
    expect(check([raw({ start_date: '2029-06-01', end_date: '2029-06-02', dates_evidence: '1 - 2 June 2029' })], { pageText: far }).events).toEqual([]);
  });

  it('drops an event whose name is not on the page', () => {
    expect(check([raw({ title: 'Lakeside Dialogue' })]).events).toEqual([]);
  });

  it('drops an event outside Switzerland', () => {
    const page = 'Alpine Futures Summit. 28 - 29 April 2027, Vienna, Austria.';
    const { events, dropped } = check([raw({ city: 'Vienna' })], { pageText: page });
    expect(events).toEqual([]);
    expect(dropped[0]).toMatch(/not in Switzerland/);
  });

  it('names a Swiss city in English when the page writes it in French', () => {
    const page = 'Alpine Futures Summit. 28 - 29 April 2027, Genève.';
    expect(check([raw({ city: 'Geneva' })], { pageText: page }).events[0].city).toBe('Geneva');
  });

  it('needs the city as a whole word, not inside another one', () => {
    const page = 'Alpine Futures Summit session. 28 - 29 April 2027, Switzerland.';
    expect(check([raw({ city: 'Sion' })], { pageText: page }).events).toEqual([]);
  });

  it('accepts a town off the list only where the page places it in Switzerland', () => {
    const swiss = 'Alpine Futures Summit. 28 - 29 April 2027, Engelberg, Switzerland.';
    expect(check([raw({ city: 'Engelberg' })], { pageText: swiss }).events).toHaveLength(1);
    const unsaid = 'Alpine Futures Summit. 28 - 29 April 2027, Engelberg.';
    expect(check([raw({ city: 'Engelberg' })], { pageText: unsaid }).events).toEqual([]);
    const abroad = 'Swiss embassy events. Alpine Futures Summit. 28 - 29 April 2027, 75008 Paris. Bern, Switzerland.';
    expect(check([raw({ city: 'Paris' })], { pageText: abroad }).events).toEqual([]);
  });

  it('accepts a town off the list by its Swiss postcode on a page about Switzerland', () => {
    const page = 'Alpine Futures Summit. 28 - 29 April 2027, Rte des Flumeaux 42, 1008 Prilly.';
    expect(check([raw({ city: 'Prilly' })], { pageText: `${page} Switzerland's digital future.` }).events[0].city).toBe('Prilly');
    expect(check([raw({ city: 'Prilly' })], { pageText: page }).events).toEqual([]);
  });

  it('reads a city reported with its country', () => {
    expect(check([raw({ city: 'Geneva, Switzerland' })]).events[0].city).toBe('Geneva');
  });

  it('needs a short name as a whole word and rejects an empty one', () => {
    const page = 'We fund the Alpine Futures Summit. 28 - 29 April 2027, Geneva, Switzerland.';
    expect(check([raw({ title: 'WEF' })], { pageText: page }).events).toEqual([]);
    expect(check([raw({ title: '...' })], { pageText: page }).events).toEqual([]);
    expect(check([raw({ title: 'AFS' })], { pageText: `AFS: ${page}` }).events).toHaveLength(1);
  });

  it('falls back to the page when the link is not one the page carries', () => {
    const links = [{ text: 'Programme', href: 'https://summit.example/programme' }];
    expect(check([raw({ link: 'https://summit.example/programme' })], { links }).events[0].link)
      .toBe('https://summit.example/programme');
    expect(check([raw({ link: 'https://invented.example/' })], { links }).events[0].link).toBe(PAGE_URL);
  });

  it.each([
    ['27 Oct 2026 | 14:00 – 15:30', false],
    ['27 Oct 2026, 12h30-14h00', false],
    ['27 Oct 2026, 3:30 - 4:30 pm', false],
    ['27 Oct 2026, 09:00-16:00', true],
    ['27 Oct 2026, 9:00 am to 5:00 pm', true],
    ['27 Oct 2026. Registration 08:30 - 09:00, programme 09:00 - 17:00', true],
  ])('tells a short session from a day-long event in "%s"', (quote, kept) => {
    const page = `Alpine Futures Summit, Geneva. ${quote}.`;
    const ev = raw({ start_date: '2026-10-27', end_date: null, dates_evidence: quote });
    const { events } = check([ev], { pageText: page });
    expect(events.length === 1).toBe(kept);
  });

  it('drops the kinds of event the criteria skip', () => {
    const { events, dropped } = check([raw({ kind: 'networking_or_career' })]);
    expect(events).toEqual([]);
    expect(dropped[0]).toMatch(/classed as networking or career, which the criteria skip/);
  });

  it('drops an event with no topic and defaults an empty subject list', () => {
    expect(check([raw({ topics: [] })]).events).toEqual([]);
    expect(check([raw({ subjects: [] })]).events[0].subjects).toEqual(['Global Affairs']);
  });
});
