import { describe, it, expect } from 'vitest';
import { cleanFullName, sameConferenceName } from './names.js';

const embc = { title: 'IEEE EMBC', year: 2027 };

describe('cleanFullName', () => {
  it('leaves a proper name unchanged', () => {
    const name = 'The Fifteenth International Conference on Learning Representations';
    expect(cleanFullName(name, { title: 'ICLR', year: 2027 })).toBe(name);
  });

  it('strips a trailing edition year', () => {
    expect(cleanFullName('Machine Learning for Healthcare 2026', { title: 'MLHC', year: 2026 }))
      .toBe('Machine Learning for Healthcare');
  });

  it('keeps a trailing year that is not the edition year', () => {
    expect(cleanFullName('Machine Learning for Healthcare 2026', { title: 'MLHC', year: 2027 }))
      .toBe('Machine Learning for Healthcare 2026');
  });

  it('strips a trailing bracket holding only the acronym and year', () => {
    expect(cleanFullName(
      '49th Annual International Conference of the IEEE Engineering in Medicine and Biology Society (EMBC 2027)',
      embc,
    )).toBe('49th Annual International Conference of the IEEE Engineering in Medicine and Biology Society');
  });

  it('strips an acronym bracket that sits before the year', () => {
    expect(cleanFullName(
      '19th IEEE International Conference on Software Testing, Verification and Validation (ICST) 2026',
      { title: 'IEEE ICST', year: 2026 },
    )).toBe('19th IEEE International Conference on Software Testing, Verification and Validation');
  });

  it('keeps a bracket that carries information', () => {
    const name = 'AMIA Annual Symposium (American Medical Informatics Association)';
    expect(cleanFullName(name, { title: 'AMIA', year: 2026 })).toBe(name);
  });

  it('joins a split ordinal suffix', () => {
    expect(cleanFullName('29 th International Conference on Medical Image Computing', { title: 'MICCAI', year: 2026 }))
      .toBe('29th International Conference on Medical Image Computing');
  });

  it('rejects a name that is only the title and year', () => {
    expect(cleanFullName('IEEE EMBC 2027', embc)).toBeNull();
    expect(cleanFullName('EMBC 2027', embc)).toBeNull();
    expect(cleanFullName('PSB 2027', { title: 'PSB', year: 2027 })).toBeNull();
  });

  it('rejects a mostly uppercase name', () => {
    expect(cleanFullName(
      '29 th INTERNATIONAL CONFERENCE ON MEDICAL IMAGE COMPUTING AND COMPUTER ASSISTED INTERVENTION',
      { title: 'MICCAI', year: 2026 },
    )).toBeNull();
  });

  it('tolerates acronyms inside a mixed-case name', () => {
    const name = 'ACM SIGKDD Conference on Knowledge Discovery and Data Mining';
    expect(cleanFullName(name, { title: 'KDD', year: 2026 })).toBe(name);
  });

  it('returns null for a missing name', () => {
    expect(cleanFullName(null, embc)).toBeNull();
    expect(cleanFullName('   ', embc)).toBeNull();
  });
});

describe('sameConferenceName', () => {
  it('ignores a numeric ordinal and "Annual"', () => {
    expect(sameConferenceName(
      '7th Annual Conference on Health, Inference, and Learning',
      'Conference on Health, Inference, and Learning',
    )).toBe(true);
  });

  it('ignores spelled-out ordinals and a leading article', () => {
    expect(sameConferenceName(
      'Forty-Second Annual Conference on Uncertainty in Artificial Intelligence',
      'The 41st Conference on Uncertainty in Artificial Intelligence',
    )).toBe(true);
  });

  it('ignores a trailing year', () => {
    expect(sameConferenceName(
      'Conference on Computer Vision and Pattern Recognition 2026',
      'Conference on Computer Vision and Pattern Recognition',
    )).toBe(true);
  });

  it('sees a different core name', () => {
    expect(sameConferenceName(
      'IEEE/CVF Winter Conference on Applications of Computer Vision',
      'Winter Conference on Applications of Computer Vision',
    )).toBe(false);
  });

  it('does not take a word ending in "th" for an ordinal', () => {
    expect(sameConferenceName(
      'Health & Humanitarian Logistics Conference',
      'Humanitarian Logistics Conference',
    )).toBe(false);
  });
});
