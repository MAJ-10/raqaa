import { describe, expect, it } from 'vitest';
import { formatNumber, toArabicDigits } from '../src/ui/number.ts';

describe('formatNumber', () => {
  it('uses Arabic-Indic digits', () => {
    expect(formatNumber(0)).toBe('٠');
    expect(formatNumber(7)).toBe('٧');
    expect(formatNumber(100)).toBe('١٠٠');
    expect(formatNumber(999)).toBe('٩٩٩');
  });

  it('groups thousands with the Arabic thousands separator', () => {
    expect(formatNumber(1000)).toBe('١٬٠٠٠');
    expect(formatNumber(3100)).toBe('٣٬١٠٠');
    expect(formatNumber(12500)).toBe('١٢٬٥٠٠');
    expect(formatNumber(1234567)).toBe('١٬٢٣٤٬٥٦٧');
    expect(formatNumber(1000)).toContain('٬');
  });

  it('shows negative numbers with a minus sign', () => {
    expect(formatNumber(-400)).toBe('−٤٠٠');
    expect(formatNumber(-1200)).toBe('−١٬٢٠٠');
    expect(formatNumber(-400)[0]).toBe('−');
  });

  it('adds a plus sign to positive numbers only when asked', () => {
    expect(formatNumber(300, { sign: true })).toBe('+٣٠٠');
    expect(formatNumber(-400, { sign: true })).toBe('−٤٠٠');
    expect(formatNumber(0, { sign: true })).toBe('٠');
    expect(formatNumber(300)).toBe('٣٠٠');
  });

  it('rounds to whole numbers', () => {
    expect(formatNumber(2.6)).toBe('٣');
    expect(formatNumber(2.4)).toBe('٢');
    expect(formatNumber(-0.2)).toBe('٠');
  });

  it('never breaks the screen on a value that is not a number', () => {
    expect(formatNumber(Number.NaN)).toBe('—');
    expect(formatNumber(Number.POSITIVE_INFINITY)).toBe('—');
  });
});

describe('toArabicDigits', () => {
  it('replaces every Western digit in a text', () => {
    expect(toArabicDigits('اليوم 6 من 12')).toBe('اليوم ٦ من ١٢');
    expect(toArabicDigits('0123456789')).toBe('٠١٢٣٤٥٦٧٨٩');
    expect(toArabicDigits('بدون أرقام')).toBe('بدون أرقام');
  });
});
