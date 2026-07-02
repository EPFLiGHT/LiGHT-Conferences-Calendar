import { describe, it, expect } from 'vitest';
import { resolveSubjectCode } from './subjects';

describe('resolveSubjectCode', () => {
  it('resolves uppercase short codes regardless of input case', () => {
    expect(resolveSubjectCode('ML')).toBe('ML');
    expect(resolveSubjectCode('ml')).toBe('ML');
    expect(resolveSubjectCode('sec')).toBe('SEC');
  });

  it('resolves multi-word mixed-case codes regardless of input case', () => {
    expect(resolveSubjectCode('Global Health')).toBe('Global Health');
    expect(resolveSubjectCode('GLOBAL HEALTH')).toBe('Global Health');
    expect(resolveSubjectCode('global health')).toBe('Global Health');
    expect(resolveSubjectCode('health ai')).toBe('Health AI');
  });

  it('ignores surrounding whitespace', () => {
    expect(resolveSubjectCode('  nlp  ')).toBe('NLP');
  });

  it('returns null for unknown codes', () => {
    expect(resolveSubjectCode('BIO')).toBeNull();
    expect(resolveSubjectCode('')).toBeNull();
  });
});
