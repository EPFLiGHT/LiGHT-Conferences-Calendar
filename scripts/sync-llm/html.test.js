import fs from 'fs';
import { describe, it, expect } from 'vitest';
import { htmlToText, extractLinks } from './html.js';

const HTML = fs.readFileSync(new URL('./fixtures/dates-page.html', import.meta.url), 'utf8');

describe('htmlToText', () => {
  const text = htmlToText(HTML);
  it('strips scripts, styles, nav and footer', () => {
    expect(text).not.toContain('tracking');
    expect(text).not.toContain('color:red');
    expect(text).not.toContain('Imprint');
  });
  it('keeps table cells separated', () => {
    expect(text).toMatch(/Abstract submission deadline \| January 15, 2026 \(23:59 AoE\)/);
  });
  it('keeps a date and the label under it in one cell on one line', () => {
    const html = '<table>\r\n<tr><th>Full Contributed Papers</th></tr><tr><td><strong>24 January 2027</strong><br />\nSubmission Deadline</td></tr>' +
      '<tr><td><p>16 April 2027</p><p>Accept/Reject Notification</p></td></tr></table>';
    expect(htmlToText(html)).toBe(
      'Full Contributed Papers |\n24 January 2027 Submission Deadline |\n16 April 2027 Accept/Reject Notification |',
    );
  });
  it('decodes entities and collapses whitespace', () => {
    expect(text).toContain('& enjoy the venue');
    expect(text).not.toMatch(/ {2,}/);
  });

  it('survives numeric character references beyond the Unicode range', () => {
    expect(htmlToText('<p>bad &#1114112; ref, good &#65; ref</p>')).toContain('good A ref');
  });
});

describe('extractLinks', () => {
  const links = extractLinks(HTML, 'https://fixture.example/2026/dates');
  it('resolves relative hrefs against the base', () => {
    expect(links).toContainEqual({
      text: 'Call for Papers',
      href: 'https://fixture.example/2026/call-for-papers',
    });
  });
  it('drops javascript: links', () => {
    expect(links.some((l) => l.href.startsWith('javascript:'))).toBe(false);
  });
  it('keeps absolute external links without fragments', () => {
    expect(links.some((l) => l.href === 'https://example.org/register')).toBe(true);
  });
  it('caps the number of links at 200', () => {
    const many = `<html><body>${Array.from({ length: 250 }, (_, i) =>
      `<a href="https://fixture.example/link-${i}">Link ${i}</a>`,
    ).join('')}</body></html>`;
    const capped = extractLinks(many, 'https://fixture.example/');
    expect(capped.length).toBe(200);
  });
});
