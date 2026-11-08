// Every number on screen goes through formatNumber: Arabic-Indic digits and the Arabic thousands separator.
// Written by hand rather than with Intl, so the output is the same in every browser.

const DIGITS = '٠١٢٣٤٥٦٧٨٩';
const THOUSANDS = '٬'; // ٬ ARABIC THOUSANDS SEPARATOR
const PLUS = '+';
const MINUS = '−'; // − MINUS SIGN

export type NumberOptions = {
  /** Show "+" before positive numbers, for changes such as +٣٠٠. Negative numbers always show "−". */
  sign?: boolean;
};

/**
 * Formats a number for display: 3100 → "٣٬١٠٠", -400 → "−٤٠٠", and with { sign: true }, 300 → "+٣٠٠".
 * Numbers are rounded to whole numbers. A value that isn't a number shows as "—" instead of breaking the screen.
 */
export function formatNumber(value: number, options: NumberOptions = {}): string {
  if (!Number.isFinite(value)) return '—';
  const whole = Math.round(value);
  const digits = String(Math.abs(whole)).replace(/\B(?=(\d{3})+$)/g, THOUSANDS);
  const body = toArabicDigits(digits);
  if (whole < 0) return MINUS + body;
  if (whole > 0 && options.sign) return PLUS + body;
  return body;
}

/** Replaces Western digits in a text with Arabic-Indic digits: "اليوم 6 من 12" → "اليوم ٦ من ١٢". */
export function toArabicDigits(text: string): string {
  return text.replace(/[0-9]/g, (d) => DIGITS[Number(d)] ?? d);
}
