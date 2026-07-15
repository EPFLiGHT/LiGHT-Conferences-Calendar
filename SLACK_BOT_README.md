# Slack bot

The Slack side of [Conference Deadlines](README.md): slash commands to look up deadlines, plus daily
reminders in DMs and channels.

## What it does

- Slash commands to search conferences and view upcoming deadlines
- Opt-in DM reminders 30, 7 and 3 days before each deadline
- Deadline posts in any channel the bot is added to
- Subject filters (ML, CV, NLP, SEC, etc.)
- Multi-workspace install via OAuth

## Installing

Two options:

- **OAuth** (recommended): lets anyone install the bot to their workspace via an "Add to Slack" button. See [OAUTH_SETUP.md](./OAUTH_SETUP.md).
- **Manual single-workspace install**: quicker, no OAuth setup. Steps below.

## Manual setup

### 1. Create the Slack app

At [api.slack.com/apps](https://api.slack.com/apps), create a new app from scratch. Name it `LiGHT Conferences` and pick your workspace.

### 2. Bot scopes

Under **OAuth & Permissions → Bot Token Scopes**, add:

```text
chat:write         # post to channels the bot is in
chat:write.public  # post to channels the bot is not in
commands           # slash commands
channels:read      # detect when the bot joins/leaves public channels
groups:read        # same, for private channels
mpim:read          # same, for group DMs
users:read
users:read.email
```

### 3. Install to the workspace

In **OAuth & Permissions**, click "Install to Workspace" and copy the bot token (`xoxb-...`).

### 4. Signing secret

Under **Basic Information → App Credentials**, copy the signing secret.

### 5. Slash commands

Under **Slash Commands**, create one command per entry below. They all share the same request URL: `https://your-project.vercel.app/api/slack/commands`.

```text
/conf-upcoming      Next deadlines
/conf-search        Search by name
/conf-subject       Filter by subject
/conf-info          Details for one conference
/conf-subscribe     Turn reminders on
/conf-unsubscribe   Turn reminders off
/conf-settings      View your settings
/conf-help          List commands
```

### 6. Interactivity

Under **Interactivity & Shortcuts**, turn it on and set the request URL to `https://your-project.vercel.app/api/slack/interactions`.

### 7. Events

Under **Event Subscriptions**, enable events with request URL `https://your-project.vercel.app/api/slack/events` and subscribe to these bot events:

- `member_joined_channel` and `member_left_channel`: the bot uses these to track which channels should get channel reminders
- `app_uninstalled` and `tokens_revoked`: cleanup when a workspace removes the app

Skipping this step means channel reminders won't work (personal DM reminders still will).

## Deploying

Import the repo into Vercel and set these environment variables:

```text
SLACK_BOT_TOKEN=xoxb-...
SLACK_SIGNING_SECRET=...
CONFERENCES_DATA_URL=https://conferences.light-laboratory.org
APP_URL=https://your-project.vercel.app
CRON_SECRET=<random string>
CHANNEL_REMINDER_DAYS=30,7,3   # optional
```

Notes:

- `CONFERENCES_DATA_URL` is the base URL serving the YAML files. The bot appends `/data/conferences.yaml`, `/data/summits.yaml`, and `/data/workshops.yaml`.
- `APP_URL` is used to build the ICS download links sent in messages.
- `CRON_SECRET` authenticates the cron jobs.
- `CHANNEL_REMINDER_DAYS` sets which days before a deadline channel reminders fire (defaults to `30,7,3`).

Then create a Vercel KV (Redis) database, name it `conferences-slack-bot-kv`, and link it to the project. Credentials are injected automatically.

After the first deploy, update the request URLs in the Slack app config to point at your Vercel URL.

## Commands

- `/conf-upcoming`: next 5 deadlines
- `/conf-search <query>`: search by name (e.g. `/conf-search CVPR`)
- `/conf-subject <code>`: filter by subject (e.g. `/conf-subject ML`)
- `/conf-info <id>`: details for one conference
- `/conf-subscribe`: turn reminders on
- `/conf-unsubscribe`: turn them off
- `/conf-settings`: view your settings and toggle reminders
- `/conf-help`: list commands

Subject codes are ML, CV, NLP, DM, HCI, SEC, SE, AI, Global Health, and Health AI. Run `/conf-subject` with no argument to see the list.

## Reminders

Two cron jobs run each morning at 9:00 UTC (configured in `vercel.json`):

- **Personal reminders** (`cron/daily-check`): subscribed users get a DM when a deadline or event start is exactly 30, 7 or 3 days away.
- **Channel reminders** (`cron/channel-reminders`): any channel the bot is a member of gets a post when a deadline or event start is exactly `CHANNEL_REMINDER_DAYS` days away (default 30 / 7 / 3).

## Local development

```bash
pnpm install
cp .env.example .env.local   # fill in credentials
pnpm dev
```

For `.env.local` you'll need the same variables as production. For `CONFERENCES_DATA_URL` and `APP_URL`, use `http://localhost:3000`. You'll also need Vercel KV credentials (pull them from the Vercel dashboard or Upstash).

To let Slack reach your local server:

```bash
ngrok http 3000
```

Then point the Slack app URLs at the ngrok URL.

To hit a command directly:

```bash
curl -X POST http://localhost:3000/api/slack/commands \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "command=/conf-upcoming&user_id=U123456"
```

## Layout

```text
src/app/api/slack/
├── commands/route.ts             # slash commands
├── interactions/route.ts         # buttons / menus
├── events/route.ts               # channel joins/leaves, uninstalls
├── install/route.ts              # OAuth "Add to Slack" entry point
├── oauth/callback/route.ts       # OAuth token exchange
├── cron/daily-check/route.ts     # personal DM reminders
└── cron/channel-reminders/route.ts

src/slack-bot/
├── commands/user/           # one file per command
├── lib/                     # middleware, responses, message builder, KV wrapper, signature check
├── utils/                   # logger, conference cache
└── config/constants.ts

src/utils/                   # shared with the frontend (YAML parsing, queries, subject labels)
src/types/                   # conference + Slack types
```

## Troubleshooting

**"Invalid signature"**: `SLACK_SIGNING_SECRET` is wrong or missing in Vercel.

**Commands don't respond**: check `vercel logs`, confirm the Slack request URLs match the deployment, and curl the endpoint to make sure it's reachable.

**Reminders not sending**: check the cron job ran (Vercel logs), make sure the bot token has `chat:write`, and confirm the user is subscribed.

**"Failed to fetch conferences"**: `CONFERENCES_DATA_URL` is wrong, or the YAML files aren't accessible. Curl all three to confirm.

**Calendar links broken**: `APP_URL` should be the public Vercel URL with no trailing slash, not localhost.

Vercel logs: `vercel logs --follow`. Slack event logs are under your app at api.slack.com/apps.

## Cost

Fits in the free tiers for Vercel, Vercel KV, and Slack. Fine for small to medium teams.

## License

See the main project's LICENSE.
