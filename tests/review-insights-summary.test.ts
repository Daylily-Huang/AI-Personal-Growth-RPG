import { describe, expect, it } from "vitest";
import { buildReviewSummary } from "@/lib/review-insights/summary";
import { REVIEW_SOURCES, type ReviewData, type ReviewSource, type ReviewRow } from "@/lib/review-insights/types";
import { parseReviewSummary } from "@/lib/review-insights/validation";

const owner = "11111111-1111-4111-8111-111111111111", id = (n: number) => `22222222-2222-4222-8222-${String(n).padStart(12, "0")}`;
const period = { mode: "DAILY" as const, start: "2026-10-11T00:00:00.000Z", end: "2026-10-12T00:00:00.000Z", timezone: "UTC" };
const base = (n: number) => ({ id: id(n), user_id: owner, created_at: "2026-10-11T12:00:00.000001Z" });
function data(): ReviewData { return { ownerId: owner, asOf: "2026-10-12T00:00:01.000Z", rows: Object.fromEntries(REVIEW_SOURCES.map(s => [s, []])) as unknown as ReviewData["rows"], coverage: REVIEW_SOURCES.map(source => ({ source, scanned: 0, complete: true })) }; }
function set(d: ReviewData, source: ReviewSource, rows: ReviewRow[]) { d.rows[source] = rows; d.coverage.find(c => c.source === source)!.scanned = rows.length; }
describe("Daily/Weekly objective facts", () => {
  it("latest state and recent samples retain micro/nanoseconds across equivalent UTC offsets and permutations", () => {
    const values = { is_archived: false, energy: null, focus: null, stress: null, resistance: null, recovery: null, mood_valence: null, self_confidence: null };
    for (const reverse of [false, true]) {
      const d = data(), states = [{ ...base(1), ...values, logged_at: "2026-10-11T12:00:00.000001Z", energy: 1 }, { ...base(2), ...values, logged_at: "2026-10-11T20:00:00.000999+08:00", energy: 5 }];
      const activities = [{ ...base(1), title: "earlier", status: "assessed", total_minutes: null, effective_minutes: null, created_at: "2026-10-11T12:00:00.000000001Z" }, { ...base(2), title: "later", status: "assessed", total_minutes: null, effective_minutes: null, created_at: "2026-10-11T12:00:00.000000999Z" }];
      set(d, "journal_entries", reverse ? states.toReversed() : states); set(d, "activities", reverse ? activities.toReversed() : activities);
      const result = buildReviewSummary(period, d); expect(result.state).toMatchObject({ id: id(2), energy: 5 }); expect(result.activities.map(a => a.id)).toEqual([id(2), id(1)]);
    }
  });
  it("empty is explicit zero with unknown state and main progress, not invented growth", () => {
    const result = buildReviewSummary(period, data()); expect(result.xp.net).toBe(0); expect(Object.values(result.counts)).toEqual([0, 0, 0, 0, 0, 0, 0]); expect(result.state).toBeNull(); expect(result.mainQuests).toEqual([]);
  });
  it("sums signed immutable ledger by type and current skill/domain name, never minutes or rewards", () => {
    const d = data();
    set(d, "skills", [{ ...base(1), name: "技能", domain_id: id(2), mastery_level: 8, status: "active" }]);
    set(d, "domains", [{ ...base(2), name: "领域" }]);
    set(d, "activities", [{ ...base(3), title: "有记录", status: "confirmed", total_minutes: 9000, effective_minutes: null }]);
    set(d, "xp_transactions", [100, -30, 15].map((amount, i) => ({ ...base(10 + i), activity_id: id(3), skill_id: id(1), domain_id: id(2), amount, xp_type: ["activity", "correction", "adjustment"][i], repetition_count: i === 0 ? 2 : 0, repetition_penalty: i === 0 ? 0.5 : 1 })));
    const result = buildReviewSummary(period, d); expect(result.xp).toMatchObject({ net: 85, activity: 100, correction: -30, adjustment: 15, repeatedSettlements: 1, penalizedSettlements: 1 }); expect(result.xp.bySkill[0]).toEqual({ id: id(1), name: "技能", amount: 85, entries: 3 }); expect(result.masteryChanges).toEqual([]); expect(result.counts.masteryEvents).toBe(0);
  });
  it("Mastery only reports source events; new inferred/archived/Artifact statuses remain distinct", () => {
    const d = data();
    set(d, "mastery_events", [{ ...base(1), skill_id: null, from_level: 6, to_level: 5, event_type: "correction", evidence_id: null }]);
    set(d, "knowledge_nodes", [{ ...base(2), title: "推断", verification_status: "inferred", is_archived: true }]);
    set(d, "artifacts", [{ ...base(3), title: "草稿", lifecycle_status: "draft" }]);
    set(d, "quests", [{ ...base(4), title: "主线", is_main_quest: true, progress: 42, status: "active" }]);
    const s = buildReviewSummary(period, d); expect(s.masteryChanges[0]).toMatchObject({ from: 6, to: 5, kind: "correction" }); expect(s.knowledge[0]).toMatchObject({ status: "inferred", archived: true }); expect(s.artifacts[0].status).toBe("draft"); expect(s.mainQuests[0]).toMatchObject({ currentProgress: 42, periodChange: null }); expect(s.xp.net).toBe(0);
  });
  it("new skill is half-open created_at, not a cached mastery upgrade", () => {
    const d = data(); set(d, "skills", [period.start, period.end, "2026-10-10T00:00:00Z"].map((created_at, i) => ({ ...base(i + 1), created_at, name: "技能", domain_id: null, mastery_level: 10, status: "active" })));
    expect(buildReviewSummary(period, d).counts.newSkills).toBe(1);
  });
  it("only latest explicit state self-report is shown, null does not meanzero", () => {
    const d = data(), values = { is_archived: false, energy: null, focus: null, stress: null, resistance: null, recovery: null, mood_valence: null, self_confidence: null };
    set(d, "journal_entries", [{ ...base(1), ...values, logged_at: "2026-10-11T11:00:00Z", energy: 2 }, { ...base(2), ...values, logged_at: "2026-10-11T12:00:00Z", energy: 4 }, { ...base(3), ...values, logged_at: "2026-10-11T13:00:00Z" }]);
    expect(buildReviewSummary(period, d).state).toMatchObject({ id: id(2), energy: 4, focus: null });
  });
  it("keeps exact1001 totals while bounded samples/Unicode labels and omissions are explicit", () => {
    const d = data(); set(d, "activities", Array.from({ length: 1001 }, (_, i) => ({ ...base(i + 1), title: "😀".repeat(170), status: "assessed", total_minutes: null, effective_minutes: null })));
    const s = buildReviewSummary(period, d); expect(s.counts.activities).toBe(1001); expect(s.activities).toHaveLength(20); expect(Array.from(s.activities[0].title)).toHaveLength(160); expect(s.activities[0].title.isWellFormed()).toBe(true); expect(s.sampling.omitted[0].count).toBe(981);
  });
  it("incomplete source never becomes full truth and absent relationship name staysunknown", () => {
    const d = data(); d.coverage[0].complete = false;
    set(d, "xp_transactions", [{ ...base(1), activity_id: id(3), skill_id: id(999), domain_id: null, amount: 8, xp_type: "activity", repetition_count: 0, repetition_penalty: 1 }]);
    const s = buildReviewSummary(period, d); expect(s.complete).toBe(false); expect(s.xp.bySkill[0].name).toBeNull(); expect(s.snapshotWarning).toContain("非原子快照");
  });
  it("coverage duplicates/missing/forged totals fail closed", () => {
    const d = data(); d.coverage[0].scanned = 1; expect(() => buildReviewSummary(period, d)).toThrow();
    const s = buildReviewSummary(period, data()); expect(() => parseReviewSummary({ ...s, coverage: [...s.coverage.slice(1), s.coverage[1]] })).toThrow(); expect(() => parseReviewSummary({ ...s, complete: false })).toThrow();
  });
});
