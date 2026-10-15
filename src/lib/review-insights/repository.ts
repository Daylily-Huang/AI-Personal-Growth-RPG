import { REVIEW_PAGE_SIZE, REVIEW_SOURCE_LIMIT, REVIEW_SOURCES, ReviewError, type ReviewData, type ReviewPeriod, type ReviewRow, type ReviewSource, type SourceCoverage } from "./types";
import { compareReviewTimestamps, parseReviewPeriod, parseReviewRow, REVIEW_ROW_SCHEMAS } from "./validation";
import { buildReviewSummary } from "./summary";
import { previousReviewMonth, withMonthlyComparison } from "./monthly";

export interface ReviewQuery extends PromiseLike<{ data: unknown; error: unknown }> {
  eq(column: string, value: unknown): ReviewQuery;
  gte(column: string, value: string): ReviewQuery;
  lt(column: string, value: string): ReviewQuery;
  gt(column: string, value: string): ReviewQuery;
  order(column: string, options: { ascending: boolean }): ReviewQuery;
  limit(value: number): ReviewQuery;
}
export interface ReviewReadClient { from(source: ReviewSource): { select(fields: string): ReviewQuery } }
const CURRENT = new Set<ReviewSource>(["skills", "domains", "quests"]);
export class ReviewInsightsRepository {
  constructor(private readonly client: ReviewReadClient, private readonly ownerId: string) {}
  async summarize(period: ReviewPeriod) {
    if (period.mode === "MONTHLY") {
      const previousPeriod = previousReviewMonth(period);
      const current = await this.summarizePeriod(period);
      const previous = await this.summarizePeriod(previousPeriod);
      return withMonthlyComparison(current, previous);
    }
    return this.summarizePeriod(period);
  }
  private async summarizePeriod(period: ReviewPeriod) {
    const asOf = new Date().toISOString(), p = parseReviewPeriod(period, new Date(asOf));
    const rows = {} as ReviewData["rows"], coverage: SourceCoverage[] = [];
    for (const source of REVIEW_SOURCES) {
      const collected: ReviewRow[] = []; let cursor: string | null = null, complete = false;
      for (;;) {
        let query = this.client.from(source).select(Object.keys(REVIEW_ROW_SCHEMAS[source].shape).join(","))
          .eq("user_id", this.ownerId).lt("created_at", asOf).order("id", { ascending: true }).limit(REVIEW_PAGE_SIZE + 1);
        if (!CURRENT.has(source)) {
          const column = source === "journal_entries" ? "logged_at" : "created_at";
          query = query.gte(column, p.start).lt(column, p.end);
        }
        if (source === "quests") query = query.eq("is_main_quest", true);
        if (source === "journal_entries") query = query.eq("is_archived", false);
        if (cursor !== null) query = query.gt("id", cursor);
        let result: { data: unknown; error: unknown };
        try { result = await query; } catch { throw new ReviewError("REVIEW_UNAVAILABLE"); }
        if (result.error) throw new ReviewError("REVIEW_UNAVAILABLE");
        if (!Array.isArray(result.data) || result.data.length > REVIEW_PAGE_SIZE + 1) throw new ReviewError("REVIEW_MALFORMED_DATA");
        const page = result.data.map(value => parseReviewRow(source, value, this.ownerId));
        let previous = cursor;
        for (const row of page) {
          const occurredAt = String(source === "journal_entries" ? row.logged_at : row.created_at);
          if (previous !== null && row.id <= previous || compareReviewTimestamps(row.created_at, asOf) >= 0 || !CURRENT.has(source) && (compareReviewTimestamps(occurredAt, p.start) < 0 || compareReviewTimestamps(occurredAt, p.end) >= 0) || source === "quests" && row.is_main_quest !== true || source === "journal_entries" && row.is_archived !== false) throw new ReviewError("REVIEW_MALFORMED_DATA");
          previous = row.id;
        }
        const remaining = REVIEW_SOURCE_LIMIT - collected.length;
        collected.push(...page.slice(0, Math.min(REVIEW_PAGE_SIZE, remaining)));
        if (page.length <= REVIEW_PAGE_SIZE) { complete = true; break; }
        if (collected.length === REVIEW_SOURCE_LIMIT) break;
        cursor = collected.at(-1)!.id;
      }
      rows[source] = collected; coverage.push({ source, scanned: collected.length, complete });
    }
    return buildReviewSummary(p, { ownerId: this.ownerId, rows, coverage, asOf });
  }
}
