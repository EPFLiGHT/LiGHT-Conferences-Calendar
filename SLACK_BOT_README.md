# Slack bot

A Slack bot that tracks academic conference deadlines and sends reminders.

- Workspace: [light-laboratory.slack.com](https://light-laboratory.slack.com/)
- Production: [conferences.light-laboratory.org](https://conferences.light-laboratory.org/)

## What it does

- Slash commands to search conferences and view upcoming deadlines
- Per-user reminders (default: 30, 7, 3 days before each deadline)
- Subject filters (ML, CV, NLP, SEC, etc.)
- Reminders shown in the user's local timezone
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

```
chat:write
chat:write.public
commands
users:read
users:read.email   # optional
```

### 3. Install to the workspace

In **OAuth & Permissions**, click "Install to Workspace" and copy the bot token (`xoxb-...`).

### 4. Signing secret

Under **Basic Information → App Credentials**, copy the signing secret.

### 5. Slash command

Under **Slash Commands**, create `/conf`:

- Request URL: `https://your-project.vercel.app/api/slack/commands`
- Description: Track conference deadlines
- Usage hint: `upcoming | search <query> | subscribe`

### 6. Interactivity

Under **Interactivity & Shortcuts**, turn it on and set the request URL to `https://your-project.vercel.app/api/slack/interactions`.

### 7. Events (optional)

Under **Event Subscriptions**, enable events with request URL `https://your-project.vercel.app/api/slack/events` and subscribe to `app_mention` and `message.im`.

## Deploying

Import the repo into Vercel and set these environment variables:

```
SLACK_BOT_TOKEN=xoxb-...
SLACK_SIGNING_SECRET=...
CONFERENCES_DATA_URL=https://conferences.light-laboratory.org
APP_URL=https://your-project.vercel.app
CRON_SECRET=<random string>
```

Notes:

- `CONFERENCES_DATA_URL` is the base URL serving the YAML files. The bot appends `/data/conferences.yaml`, `/data/summits.yaml`, and `/data/workshops.yaml`.
- `APP_URL` is used to build the ICS download links sent in messages.
- `CRON_SECRET` authenticates the daily cron job.

Then create a Vercel KV (Redis) database, name it `conferences-slack-bot-kv`, and link it to the project. Credentials are injected automatically.

After the first deploy, update the request URLs in the Slack app config to point at your Vercel URL.

## Commands

- `/conf upcoming`: next 5 deadlines
- `/conf search <query>`: search by name (e.g. `/conf search CVPR`)
- `/conf subject <code>`: filter by subject (e.g. `/conf subject ML`)
- `/conf info <id>`: details for one conference
- `/conf subscribe`: turn reminders on
- `/conf unsubscribe`: turn them off
- `/conf settings`: change preferences
- `/conf help`: list commands

Subject codes include ML, CV, NLP, SEC, DM, HCI, RO, PRIV, and more. Run `/conf subject` with no argument to see all of them.

## Reminders

Subscribed users get a DM each morning (9 AM, configured in `vercel.json`). They get pinged on the days they selected (default 30 / 7 / 3 days out), filtered by their subscribed subjects if they set any, and in their Slack timezone.

Channel reminders are sent to any channel the bot is added to.

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
  -d "command=/conf&text=upcoming&user_id=U123456"
```

## Layout

```
app/api/slack/
├── commands/route.ts        # slash commands
├── interactions/route.ts    # buttons / menus
├── events/route.ts          # mentions, DMs
└── cron/daily-check/route.ts

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
