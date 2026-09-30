import { APP_ORIGIN } from '@/constants/routes';

/**
 * Origin serving the API routes, for OAuth redirects and download links.
 * The OAuth redirect_uri built from it must match the one registered with Slack.
 */
export function appUrl(): string {
  return (process.env.APP_URL || APP_ORIGIN).replace(/\/+$/, '');
}
