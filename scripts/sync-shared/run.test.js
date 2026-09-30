import fs from 'fs';
import os from 'os';
import path from 'path';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { DateTime } from 'luxon';
import { parseArgs, runSync } from './run.js';
import { serializeEntries } from './yamlio.js';

const TODAY = DateTime.fromISO('2026-07-08T12:00:00Z', { zone: 'utc' });
const ENTRIES = [
  { title: 'Conf', year: 2026, id: 'conf26', timezone: 'UTC', type: 'conference' },
  { title: 'Other', year: 2026, id: 'other26', timezone: 'UTC', type: 'conference' },
];

describe('parseArgs', () => {
  it('reads --dry-run and --venue', () => {
    expect(parseArgs([])).toEqual({ dryRun: false, venue: null });
    expect(parseArgs(['--dry-run', '--venue', 'IEEE EMBC'])).toEqual({ dryRun: true, venue: 'IEEE EMBC' });
  });

  it('rejects --venue without a title', () => {
    expect(() => parseArgs(['--venue'])).toThrow(/--venue requires a venue title/);
    expect(() => parseArgs(['--venue', '--dry-run'])).toThrow(/--venue requires a venue title/);
  });

  it('rejects an unknown flag instead of running for real', () => {
    expect(() => parseArgs(['--dryrun'])).toThrow(/unknown argument --dryrun/);
  });
});

describe('runSync', () => {
  let dir;
  let dataPath;
  let configPath;
  let reportPath;
  const logs = [];

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sync-run-'));
    dataPath = path.join(dir, 'conferences.yaml');
    configPath = path.join(dir, 'venues.json');
    reportPath = path.join(dir, 'report.md');
    fs.writeFileSync(dataPath, serializeEntries(ENTRIES));
    fs.writeFileSync(configPath, '{"Conf":{"url":"https://conf.example/"},"Other":{"url":"https://other.example/"}}');
    logs.length = 0;
  });
  afterEach(() => fs.rmSync(dir, { recursive: true, force: true }));

  const run = (over = {}) => runSync({
    title: 'Test sync report',
    configPath,
    dataPath,
    today: TODAY,
    argv: [],
    env: { SYNC_REPORT_PATH: reportPath },
    log: (s) => logs.push(s),
    perVenue: async () => ({}),
    ...over,
  });

  const setDeadline = async (title, cfg, { entries }) => {
    const entry = entries.find((e) => e.title === title);
    entry.deadline = '2026-09-01 23:59';
    return { updates: [{ id: entry.id, field: 'deadline', old: null, new: entry.deadline }], flags: [`${title}: checked`] };
  };

  it('hands each venue its config, the entries and today, then writes the file and the report', async () => {
    const seen = [];
    const report = await run({
      perVenue: async (title, cfg, ctx) => {
        seen.push([title, cfg.url, ctx.today.toISODate(), ctx.entries.length]);
        return setDeadline(title, cfg, ctx);
      },
    });
    expect(seen).toEqual([
      ['Conf', 'https://conf.example/', '2026-07-08', 2],
      ['Other', 'https://other.example/', '2026-07-08', 2],
    ]);
    expect(fs.readFileSync(dataPath, 'utf8')).toContain('deadline: 2026-09-01 23:59');
    expect(report).toContain('## Test sync report');
    expect(report).toContain('| conf26 | deadline |  | 2026-09-01 23:59 |');
    expect(report).toContain('- Other: checked');
    expect(fs.readFileSync(reportPath, 'utf8')).toBe(report);
    expect(logs).toEqual([report]);
  });

  it('syncs only the venue --venue names', async () => {
    const seen = [];
    await run({ argv: ['--venue', 'Other'], perVenue: async (title) => { seen.push(title); return {}; } });
    expect(seen).toEqual(['Other']);
  });

  it('refuses a --venue that venues.json does not list', async () => {
    await expect(run({ argv: ['--venue', 'Nope'] })).rejects.toThrow(/Nope/);
    await expect(run({ argv: ['--venue', 'constructor'] })).rejects.toThrow(/constructor/);
  });

  it('writes neither the data file nor venues.json on a dry run', async () => {
    const data = fs.readFileSync(dataPath, 'utf8');
    const config = fs.readFileSync(configPath, 'utf8');
    await run({
      argv: ['--dry-run'],
      perVenue: async (title, cfg, ctx) => {
        cfg.url = 'https://moved.example/';
        return setDeadline(title, cfg, ctx);
      },
    });
    expect(fs.readFileSync(dataPath, 'utf8')).toBe(data);
    expect(fs.readFileSync(configPath, 'utf8')).toBe(config);
    expect(logs[0].startsWith('[dry run, nothing written]\n')).toBe(true);
  });

  it('writes venues.json back only when a venue changed its config', async () => {
    const config = fs.readFileSync(configPath, 'utf8');
    await run();
    expect(fs.readFileSync(configPath, 'utf8')).toBe(config);

    await run({ perVenue: async (title, cfg) => { if (title === 'Other') cfg.url = 'https://moved.example/'; return {}; } });
    const written = fs.readFileSync(configPath, 'utf8');
    expect(JSON.parse(written).Other.url).toBe('https://moved.example/');
    expect(written.endsWith('}\n')).toBe(true);
  });

  it('leaves the data file alone when nothing changed', async () => {
    const before = fs.statSync(dataPath).mtimeMs;
    await run();
    expect(fs.statSync(dataPath).mtimeMs).toBe(before);
  });

  it('appends the extra report sections', async () => {
    const report = await run({ extraReport: () => '### Usage\n' });
    expect(report.endsWith('\n### Usage\n')).toBe(true);
  });
});
