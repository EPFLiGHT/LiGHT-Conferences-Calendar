# Conference Deadlines

A site for tracking research conference deadlines, across AI/ML and global health. Built with Next.js.

Live at [conferences.light-laboratory.org](https://conferences.light-laboratory.org/).

Made by [Omar Ziyad Azgaoui](https://github.com/AZOGOAT) at [LiGHT Lab](https://github.com/EPFLiGHT).

## What it does

- Calendar with multiple views
- Countdown timers (timezone-aware)
- Search and filter by year, subject, type
- ICS export
- Speakers page showcasing lab members' talks
- Slack bot for deadline reminders

## Running it

The project uses pnpm.

```bash
pnpm install
pnpm dev        # dev server
pnpm validate   # check the YAML data
pnpm test       # run tests
pnpm build      # production build
pnpm sync:openreview  # pull deadline updates from OpenReview (see below)
pnpm sync:llm         # pull health-venue deadlines from their websites (see below)
```

## Conference data

All events live in three YAML files under `public/data/`:

- `conferences.yaml`: academic conferences
- `summits.yaml`: industry summits
- `workshops.yaml`: workshops and smaller events

A fourth file, `speakers.yaml`, powers the Speakers page (lab members and their
presentations). It has its own format and is not checked by `pnpm validate`.

### Schema

```yaml
- title: ShortName              # e.g. NeurIPS, CVPR
  year: 2025
  id: shortname25               # lowercase title + 2-digit year
  full_name: Full Conference Name
  link: https://conference-website.com
  deadline: 2025-05-21 20:00    # YYYY-MM-DD HH:MM
  abstract_deadline: 2025-05-14 20:00  # optional
  timezone: America/Los_Angeles # IANA timezone
  place: City, Country
  date: May 21-25, 2025
  start: 2025-05-21
  end: 2025-05-25
  paperslink: https://...
  hindex: 150.0                 # Google Scholar h5-index
  sub: ML                       # subject tag
  note: Additional information  # optional
  type: conference              # conference | summit | workshop
```

Only `title`, `year`, `id`, `type`, and `timezone` are required. Missing fields show as "TBA".

See the [list of IANA timezones](https://en.wikipedia.org/wiki/List_of_tz_database_time_zones).

### Automated updates from OpenReview

Deadlines for venues hosted on OpenReview (NeurIPS, ICML, ICLR, COLM, AAAI,
CVPR, WACV, ECCV, LoG, UAI, MIDL, MLHC, CHIL) are kept fresh automatically. A
GitHub Action runs `pnpm sync:openreview` weekly: it reads each venue's deadlines, dates
and location from the [OpenReview API](https://docs.openreview.net/) and opens
a pull request with the changes for review, so nothing lands on the site
unreviewed. The sync only writes factual fields (`deadline`,
`abstract_deadline`, `full_name`, `place`, `start`, `end`, `date`); curated
fields like `sub`, `note`, and `link` are never touched.

Two things to know:

- Hand edits to the synced fields of these venues will be overwritten by the
  next weekly PR. For everything not covered by either sync (summits,
  workshops, venues in neither config), the YAML files remain the source of
  truth.
- To put another OpenReview venue under sync, add one line to
  `scripts/sync-openreview/venues.json` (the format is documented at the top of
  `scripts/sync-openreview/main.js`).

### Automated updates from venue websites

Most health conferences aren't on OpenReview, so there's no API to sync
from. For those, a second weekly Action (`pnpm sync:llm`) goes straight to
the source: it fetches each venue's important-dates page, asks a small
OpenAI model to pull out the deadlines, and opens a PR with whatever
changed. The covered venues live in `scripts/sync-llm/venues.json`.

The model isn't trusted blindly. Every deadline it reports must come with
the exact sentence it found it in; that quote is checked against the page
and shown in the PR body, so you can eyeball each change in seconds. And
when a venue moves its dates page (they love doing this every year), a small
fallback agent clicks around from the homepage, searches the web if it has
to, finds the new page, and fixes `venues.json` in the same PR.

To run it locally, drop an OpenAI key into `.env.local`
(`OPENAI_API_KEY=...`). `--venue "<title>"` syncs a single venue,
`--dry-run` shows what would change without writing anything. In CI the key
comes from the repo secret of the same name.

If a synced value keeps coming out wrong (say the website's own name for the
conference is "uglier" haha than the curated one), pin it: add
`sync_pin: [full_name]` to the entry and both syncs will leave that field
alone, flagging any disagreement in the PR instead of overwriting it.

## Stack

Next.js 16, React 19, Chakra UI v3, FullCalendar, Luxon, js-yaml. Deployed to GitHub Pages (static site) with API routes on Vercel. Vercel KV (Redis) backs the Slack bot.

## Slack bot

See [SLACK_BOT_README.md](SLACK_BOT_README.md).

## Contributing

To add a conference, either [open an issue](https://github.com/EPFLiGHT/Conferences-Calendar/issues/new/choose) with the details, or send a PR:

1. Edit the right YAML file in `public/data/`
2. Run `pnpm validate`
3. Open a PR

Keep IDs lowercase (title + 2-digit year, e.g. `neurips25`) and use a valid IANA timezone.

## License

MIT: see [LICENSE](LICENSE).

## Contact

[omar.azgaoui@epfl.ch](mailto:omar.azgaoui@epfl.ch)
