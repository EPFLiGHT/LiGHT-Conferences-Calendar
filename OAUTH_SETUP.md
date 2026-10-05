# OAuth setup

How to configure the Slack bot for multi-workspace installs.

With OAuth, anyone can add the bot to their workspace through an "Add to Slack" button, and the bot keeps track of each workspace's token.

You'll need a deployed app (Vercel), access to the Slack app config at [api.slack.com/apps](https://api.slack.com/apps), and an Upstash Redis database (from the Vercel Marketplace) for token storage.

## 1. Configure OAuth in the Slack app

Under **OAuth & Permissions**, add this redirect URL (replace the host with your deployment):

```text
https://your-app-domain.vercel.app/api/slack/oauth/callback
```

Make sure these bot scopes are enabled (the install endpoint requests exactly this list, see `src/app/api/slack/install/route.ts`):

- `chat:write`
- `chat:write.public`
- `commands`
- `channels:read`
- `groups:read`
- `mpim:read`
- `users:read`
- `users:read.email`

## 2. Get the OAuth credentials

Under **Basic Information → App Credentials**, copy the **Client ID** and **Client Secret**.

## 3. Environment variables

Add the OAuth credentials alongside the existing variables in Vercel:

```bash
SLACK_CLIENT_ID=1234567890.1234567890
SLACK_CLIENT_SECRET=...

# Existing
SLACK_SIGNING_SECRET=...
CRON_SECRET=...
APP_URL=https://your-app-domain.vercel.app
CONFERENCES_DATA_URL=https://your-app-domain.vercel.app

# Channel reminders: bot tracks channels automatically when added
CHANNEL_REMINDER_DAYS=30,7,3

# Upstash Redis (or UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN)
KV_REST_API_URL=https://...
KV_REST_API_TOKEN=...
```

The redirect URI is always `APP_URL` + `/api/slack/oauth/callback`, so `APP_URL` must match the redirect URL you registered in step 1. Without `APP_URL` it is `https://conferences-calendar.vercel.app`.

If you want to keep an existing single-workspace install working at the same time, leave `SLACK_BOT_TOKEN` in place. The bot falls back to it when no OAuth token is found.

## 4. Enable distribution

Under **Manage Distribution**, make sure the checklist is complete (redirect URLs, bot user, scopes, description, icon) and click **Activate Public Distribution**.

## 5. Installation page (optional)

A simple landing page with the standard "Add to Slack" button:

```html
<!DOCTYPE html>
<html>
<head><title>Install LiGHT Events Radar</title></head>
<body>
  <h1>LiGHT Events Radar</h1>
  <p>Never miss a conference deadline.</p>
  <a href="https://your-app-domain.vercel.app/api/slack/install">
    <img alt="Add to Slack" height="40" width="139"
         src="https://platform.slack-edge.com/img/add_to_slack.png"
         srcSet="https://platform.slack-edge.com/img/add_to_slack.png 1x,
                 https://platform.slack-edge.com/img/add_to_slack@2x.png 2x" />
  </a>
</body>
</html>
```

## 6. Test it

Visit `https://your-app-domain.vercel.app/api/slack/install` and authorize. You should land on the success page at `conferences.light-laboratory.org/slack-install/success`, and the Vercel logs should show a line like:

```text
{"level":"INFO","message":"Bot installed","teamId":"T01234567","teamName":"<name>",...}
```

Then try `/conf-help`, `/conf-subscribe`, `/conf-upcoming` in Slack. To install to other workspaces, share the same `/api/slack/install` link.

## How it works

When someone installs the bot:

1. They click "Add to Slack"
2. Slack hits `/api/slack/install`, then redirects them to authorize
3. Slack redirects back to `/api/slack/oauth/callback` with a code
4. The app exchanges the code for a bot token
5. The token is stored in Upstash Redis under `slackbot:team:{teamId}:token`

For each incoming request, middleware reads `team_id` from the payload and `slackClient.ts` looks up that workspace's token. If there's no stored token, it falls back to `SLACK_BOT_TOKEN`.

When a workspace uninstalls the app, Slack sends an `app_uninstalled` (or `tokens_revoked`) event and the bot purges that workspace: its stored token, metadata and channel subscriptions are deleted and its users' DM reminders are switched off (their records are kept). The reminder crons purge a workspace the same way when Slack answers a post with `token_revoked` or `account_inactive`.

## Troubleshooting

**"Invalid redirect_uri"**: the URL in Slack settings must match exactly, including `/api/slack/oauth/callback`.

**"No stored token for team, using SLACK_BOT_TOKEN"**: check the Upstash Redis integration is connected, confirm the team finished the OAuth flow, and check logs for storage errors. A workspace that uninstalled the app also has no token.

**Commands not working after OAuth**: make sure the slash command URLs point at the deployment (not localhost) and that signature verification is still passing.

**Multiple installs misbehaving**: check that `teamId` is being extracted correctly and that Redis is storing tokens under the expected key.

## Migrating from a single-workspace install

1. Keep the existing `SLACK_BOT_TOKEN`.
2. Add `SLACK_CLIENT_ID` and `SLACK_CLIENT_SECRET`.
3. Deploy.
4. The original workspace keeps working via the token fallback.
5. Optionally, re-install the original workspace via OAuth so its token lives in Redis too.
