// The command-line run both syncs share: flags, YAML and venues.json write-back, and the report
// (also written to $SYNC_REPORT_PATH for the PR body). --venue <title> syncs one venue; --dry-run writes nothing.
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { DateTime } from 'luxon';
import { parseEntries, serializeEntries } from './yamlio.js';
import { renderReport, emptyOutcome, addOutcome } from './report.js';

const DATA_PATH = fileURLToPath(new URL('../../public/data/conferences.yaml', import.meta.url));

const serializeConfig = (config) => `${JSON.stringify(config, null, 2)}\n`;

/**
 * @param {string[]} argv Command-line arguments after the script path.
 * @returns {{dryRun: boolean, venue: string|null}}
 * @throws On an unknown argument, so a typo cannot turn a dry run into a real one.
 */
export function parseArgs(argv) {
  const opts = { dryRun: false, venue: null };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--dry-run') {
      opts.dryRun = true;
    } else if (arg === '--venue') {
      const venue = argv[++i];
      if (!venue || venue.startsWith('--')) throw new Error('--venue requires a venue title');
      opts.venue = venue;
    } else if (arg !== '--') {
      throw new Error(`unknown argument ${arg} (expected --dry-run or --venue <title>)`);
    }
  }
  return opts;
}

/**
 * Run a sync over every venue in its venues.json.
 * @param {object} opts
 * @param {string} opts.title Report heading.
 * @param {string} opts.configPath The sync's venues.json.
 * @param {(title: string, cfg: object, ctx: {entries: Array<object>, today: DateTime}) =>
 *   Promise<object>} opts.perVenue Syncs one venue into ctx.entries (mutated) and
 *   returns its outcome ({updates, drafts, flags, skipped}, each optional). It may
 *   edit cfg; venues.json is then rewritten.
 * @param {() => string} [opts.extraReport] Markdown appended to the report.
 * @param {string[]} [opts.argv] Defaults to the process arguments.
 * @param {string} [opts.dataPath] Defaults to public/data/conferences.yaml.
 * @param {DateTime} [opts.today]
 * @param {object} [opts.env] Where SYNC_REPORT_PATH is read from.
 * @param {(text: string) => void} [opts.log]
 * @returns {Promise<string>} The report.
 */
export async function runSync({
  title,
  configPath,
  perVenue,
  extraReport = () => '',
  argv = process.argv.slice(2),
  dataPath = DATA_PATH,
  today = DateTime.utc(),
  env = process.env,
  log = console.log,
}) {
  const { dryRun, venue } = parseArgs(argv);
  const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  if (venue && !Object.hasOwn(config, venue)) {
    throw new Error(`venue "${venue}" is not in ${path.basename(configPath)}`);
  }
  const configBefore = serializeConfig(config);
  const raw = fs.readFileSync(dataPath, 'utf8');
  const entries = parseEntries(raw);

  const run = emptyOutcome();
  for (const [venueTitle, cfg] of Object.entries(config)) {
    if (venue && venueTitle !== venue) continue;
    addOutcome(run, await perVenue(venueTitle, cfg, { entries, today }));
  }

  if (!dryRun) {
    const after = serializeEntries(entries);
    if (after !== raw) fs.writeFileSync(dataPath, after);
    const configAfter = serializeConfig(config);
    if (configAfter !== configBefore) fs.writeFileSync(configPath, configAfter);
  }

  const extra = extraReport();
  const report = renderReport({ ...run, title }) + (extra ? `\n${extra}` : '');
  log(dryRun ? `[dry run, nothing written]\n${report}` : report);
  if (env.SYNC_REPORT_PATH) fs.writeFileSync(env.SYNC_REPORT_PATH, report);
  return report;
}

/**
 * Call main when the module is the script node was started with, not a test import.
 * @param {string} moduleUrl The caller's import.meta.url.
 * @param {() => Promise<void>} main
 */
export function runIfMain(moduleUrl, main) {
  if (!process.argv[1] || path.resolve(process.argv[1]) !== fileURLToPath(moduleUrl)) return;
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
