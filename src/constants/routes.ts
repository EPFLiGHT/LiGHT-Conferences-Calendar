/**
 * App routes and external URLs. Single source so a path change happens once.
 */
export const ROUTES = {
  slackInstall: '/slack-install',
  slackPrivacy: '/slack-install/privacy',
  slackSuccess: '/slack-install/success',
} as const;

export const EXTERNAL_URLS = {
  slackOauthInstall: 'https://conferences-calendar.vercel.app/api/slack/install',
} as const;
