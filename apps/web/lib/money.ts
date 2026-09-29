/**
 * MONEY FORMATTING — the boundary where integers become strings.
 *
 * The database stores `priceCents` as an integer. It must never store, sum or
 * compare a float: `0.1 + 0.2 === 0.30000000000000004` in IEEE-754, and a
 * pharmacy that miscalculates by fractions of a penny still fails an audit.
 *
 * Formatting is the LAST possible step, in exactly one function, so there is
 * one place to be wrong instead of forty.
 */

/**
 * `Intl.NumberFormat` is constructed ONCE per currency, not per render.
 *
 * Constructing a formatter is measurably more expensive than using one —
 * it resolves locale data — and a product grid calling this per cell per
 * render is the textbook place that cost shows up. The cache makes repeat
 * calls a Map lookup.
 */
const formatterCache = new Map<string, Intl.NumberFormat>();

function getFormatter(currency: string, locale: string) {
  const key = `${locale}:${currency}`;

  let formatter = formatterCache.get(key);

  if (!formatter) {
    formatter = new Intl.NumberFormat(locale, {
      style: "currency",
      currency,
      // Never show fractional cents. A price of 12.00 is 12.00; a catalog
      // showing "$12.0033" because of float drift is a bug report.
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    });

    formatterCache.set(key, formatter);
  }

  return formatter;
}

/**
 * `cents / 100` and NOT `(cents / 100).toFixed(2)` in a template string.
 *
 * The division is the only float step, and it happens at the very end where a
 * rounding error is invisible. The integer is never round-tripped back.
 */
export function formatPrice(
  cents: number,
  currency = "USD",
  locale = "en-US",
): string {
  return getFormatter(currency, locale).format(cents / 100);
}

/**
 * Derives the implied decimal places for an input, so the admin price field
 * shows "49.00" for 4900 and "12.5" for 1250.
 *
 * The inverse of formatting, and the only place cents become a decimal
 * string. Doing it in the browser means the server receives an INTEGER, so
 * the float never crosses the wire.
 */
export function centsToInput(cents: number): string {
  return (cents / 100).toFixed(2);
}

/**
 * Parses a user-typed price into integer cents.
 *
 * ROUND rather than parse, because "19.999" is a legitimate thing for a human
 * to type and silently truncating it to 1999 would be worse than rounding to
 * 2000. Returns `null` for anything that is not a usable number, so the
 * caller can reject it in Zod rather than writing NaN to the database.
 */
export function inputToCents(value: string): number | null {
  const normalized = value.trim().replace(/[,\s]/g, "");

  if (normalized === "") return null;

  const parsed = Number(normalized);

  if (!Number.isFinite(parsed) || parsed < 0) return null;

  return Math.round(parsed * 100);
}
