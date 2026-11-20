import { describe, it, expect } from 'vitest';
import { followConfig } from './follow.js';

const OWN = 'https://conf.example/';
const abstract = { type: 'abstract', due: '2027-01-15 23:59' };

const proposal = ({ event = {}, entry = {}, file = 'conferences.yaml' } = {}) => ({
  event: { sourceUrl: OWN, curated: false, ownLink: true, callsLink: null, ...event },
  entry: { title: 'Fixture Conf', link: OWN, ...entry },
  file,
});

describe('followConfig', () => {
  it('follows the page a call was found on, starting the agent at the event\'s link', () => {
    const p = proposal({ event: { sourceUrl: 'https://conf.example/call' }, entry: { deadlines: [abstract] } });
    expect(followConfig(p, new Set())).toEqual({ cfg: { url: 'https://conf.example/call', home: OWN } });
  });

  it('follows an event without a call for its dates, at its calls page when it links one', () => {
    expect(followConfig(proposal(), new Set())).toEqual({ cfg: { url: OWN, attendance: true } });
    const linked = proposal({ event: { callsLink: 'https://conf.example/apply' } });
    expect(followConfig(linked, new Set())).toEqual({ cfg: { url: 'https://conf.example/apply', attendance: true } });
  });

  it('never follows a curated listing, which announces other events too', () => {
    const listing = 'https://org.example/events';
    const call = proposal({ event: { sourceUrl: listing, curated: true }, entry: { deadlines: [abstract] } });
    expect(followConfig(call, new Set())).toEqual({ cfg: { url: OWN } });
    const unlinked = proposal({ event: { sourceUrl: listing, curated: true, ownLink: false }, entry: { link: listing } });
    expect(followConfig(unlinked, new Set())).toEqual({ note: 'not followed: its only page lists other events too' });
  });

  it('leaves a venue a sync already follows alone', () => {
    expect(followConfig(proposal(), new Set(['Fixture Conf']))).toEqual({ note: 'already followed' });
  });

  it('does not follow a workshop, whose file no sync reads', () => {
    expect(followConfig(proposal({ file: 'workshops.yaml' }), new Set()))
      .toEqual({ note: 'not followed: the syncs do not read workshops.yaml' });
  });
});
