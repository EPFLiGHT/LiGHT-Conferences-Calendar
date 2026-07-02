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
