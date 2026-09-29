/**
 * App routes and external URLs. Single source so a path change happens once.
 */

/** Public static site (GitHub Pages). */
export const SITE_URL = 'https://conferences.light-laboratory.org';

/** Production Vercel deployment serving the API routes; APP_URL overrides it server-side. */
export const APP_ORIGIN = 'https://conferences-calendar.vercel.app';

export const ROUTES = {
  slackInstall: '/slack-install',
  slackPrivacy: '/slack-install/privacy',
  slackSuccess: '/slack-install/success',
} as const;

export const EXTERNAL_URLS = {
  slackOauthInstall: `${APP_ORIGIN}/api/slack/install`,
  lightLab: 'https://www.light-laboratory.org/',
  githubOrg: 'https://github.com/EPFLiGHT',
  repo: 'https://github.com/EPFLiGHT/Conferences-Calendar',
} as const;
