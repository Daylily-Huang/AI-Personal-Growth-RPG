import { ReviewError, type ReviewPeriod, type ReviewSummary } from "./types";

function calendarDate(instant: number, timezone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: timezone, calendar: "gregory", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(instant);
  const part = (type: string) => parts.find(p => p.type === type)!.value;
  return `${part("year")}-${part("month")}-${part("day")}`;
}

/** First real instant of a local calendar month, including a midnight DST gap/fold. */
export function reviewMonthStart(year: number, month: number, timezone: string): string {
  const normalized = new Date(Date.UTC(year, month, 1));
  const target = normalized.toISOString().slice(0, 10), center = normalized.getTime();
  let low = center - 36 * 3600000, high = center + 36 * 3600000;
  while (low < high) {
    const middle = Math.floor((low + high) / 2);
    if (calendarDate(middle, timezone) < target) low = middle + 1;
    else high = middle;
  }
  if (calendarDate(low, timezone) !== target) throw new ReviewError("REVIEW_INVALID_INPUT");
  return new Date(low).toISOString();
}

export function previousReviewMonth(period: ReviewPeriod): ReviewPeriod {
  if (period.mode !== "MONTHLY") throw new ReviewError("REVIEW_INVALID_INPUT");
  const local = calendarDate(Date.parse(period.start), period.timezone);
  const [year, month] = local.split("-").map(Number);
  if (period.start !== reviewMonthStart(year, month - 1, period.timezone)
    || Date.parse(period.end) > Date.parse(reviewMonthStart(year, month, period.timezone))) throw new ReviewError("REVIEW_INVALID_INPUT");
  return { ...period, start: reviewMonthStart(year, month - 2, period.timezone), end: period.start };
}

export function withMonthlyComparison(current: ReviewSummary, previous: ReviewSummary): ReviewSummary {
  const expected = previousReviewMonth(current.period);
  if ((Object.keys(expected) as (keyof ReviewPeriod)[]).some(key => expected[key] !== previous.period[key])) throw new ReviewError("REVIEW_MALFORMED_DATA");
  const local = calendarDate(Date.parse(current.period.start), current.period.timezone).split("-").map(Number);
  return { ...current, comparison: { previous, partialCurrent: current.period.end !== reviewMonthStart(local[0], local[1], current.period.timezone) } };
}
