/**
 * HTML to text with regexes rather than a parser: deadline pages are simple,
 * and table cells only need to stay separated so date rows survive. Links come
 * out of the page too, as the map the agent navigates by.
 */
import { normalizeUrl, isAllowedUrl } from './urls.js';

const MAX_LINKS = 200;

const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', ndash: '-', mdash: '-' };

function decodeEntities(s) {
  return s
    // String.fromCodePoint throws past 0x10FFFF; substitute like a browser would.
    .replace(/&#(\d+);/g, (_, n) => (Number(n) <= 0x10ffff ? String.fromCodePoint(Number(n)) : '�'))
    .replace(/&(amp|lt|gt|quot|apos|nbsp|ndash|mdash);/g, (_, name) => ENTITIES[name]);
}

/**
 * Reduce HTML to readable text. Each table cell stays on one line ending in
 * " | ", so a date and its label read as one unit; other block closers become
 * newlines.
 * @param {string} html Raw HTML.
 * @returns {string} Cleaned text with single spaces and single newlines.
 */
export function htmlToText(html) {
  let s = html
    .replace(/<(script|style|noscript|svg|head|nav|footer)\b[\s\S]*?<\/\1\s*>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<(td|th)\b[^>]*>([\s\S]*?)<\/\1\s*>/gi, (_, _tag, inner) =>
      ` ${inner.replace(/<(br|hr)\b[^>]*>|<\/(p|div|li|h[1-6])>/gi, ' ').replace(/\s+/g, ' ')} | `)
    .replace(/<\/(td|th)>/gi, ' | ')
    .replace(/<(br|hr)\b[^>]*>/gi, '\n')
    .replace(/<\/(p|div|li|tr|table|h[1-6]|section|article)>/gi, '\n')
    .replace(/<[^>]+>/g, ' ');
  s = decodeEntities(s);
  return s
    .replace(/\r/g, '')
    .replace(/[ \t]+/g, ' ')
    .replace(/ ?\n[ \n]*/g, '\n')
    .trim();
}

/**
 * Extract the page's links for the agent to choose from.
 * @param {string} html Raw HTML.
 * @param {string} baseUrl URL the page was fetched from (resolves relative hrefs).
 * @returns {Array<{text: string, href: string}>} Absolute, allowed, deduped by href, max 200.
 */
export function extractLinks(html, baseUrl) {
  const links = [];
  const seen = new Set();
  const re = /<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a\s*>/gi;
  for (const m of html.matchAll(re)) {
    let href;
    try {
      href = normalizeUrl(new URL(m[1], baseUrl).toString());
    } catch {
      continue;
    }
    if (!isAllowedUrl(href).ok || seen.has(href)) continue;
    const text = htmlToText(m[2]).replace(/\s+/g, ' ').trim();
    if (!text) continue;
    seen.add(href);
    links.push({ text, href });
    if (links.length >= MAX_LINKS) break;
  }
  return links;
}
