import { describe, expect, test } from "vitest";
import { mapActivity, mapAssessment, mapPlayer, mapSkill, mapTransaction } from "@/lib/store/supabase-mapping";

describe("Supabase row mappings", () => {
  test("maps snake_case activity facts to the domain shape", () => {
    expect(mapActivity({
      id: "a1", user_id: "u1", quest_id: null, quest_size_snapshot: null, title: "Read", raw_input: " read ",
      activity_type: "study", status: "pending_assessment", total_minutes: 20,
      effective_minutes: 15, started_at: null, ended_at: null, completion: null,
      rules_version: "v1", created_at: "2026-01-01T00:00:00Z", updated_at: "2026-01-01T00:00:00Z",
    })).toMatchObject({ id: "a1", rawInput: " read ", totalMinutes: 20, rulesVersion: "v1" });
  });

  test("preserves proposal JSON and assessment audit fields", () => {
    const proposal = { confidence: 0.9 } as never;
    expect(mapAssessment({
      id: "as1", user_id: "u1", activity_id: "a1", rules_version: "v1", prompt_version: "p1",
      model_name: "model", assessment_json: proposal, confidence: 0.9, status: "pending",
      confirmed_at: null, created_at: "2026-01-01T00:00:00Z", updated_at: "2026-01-01T00:00:00Z",
    })).toMatchObject({ id: "as1", activityId: "a1", proposal, confidence: 0.9 });
  });

  test("maps numeric database values and rejects ledger rows without stable skill ids", () => {
    expect(mapSkill({ id: "s1", user_id: "u1", domain_id: null, description: null, name: "Statistics", aliases: [], level: 2, xp: 12.5, mastery_level: 1, mastery_confidence: 0.8, last_used_at: null, normalized_name: "statistics", status: "active", created_at: "", updated_at: "" })).toMatchObject({ id: "s1", xp: 12.5, masteryConfidence: 0.8 });
    expect(() => mapTransaction({ id: "t1", user_id: "u1", activity_id: "a1", assessment_id: "as1", skill_id: null, quest_id: null, domain_id: null, activity_type: "study", repetition_count: 0, repetition_penalty: 1, xp_type: "activity", amount: 10, base_amount: 10, modifier_json: {}, reason: "", rules_version: "v1", skill_name_snapshot: "Statistics", created_at: "" })).toThrow(/skill_id/);
    expect(() => mapTransaction({ id: "t2", user_id: "u1", activity_id: "a1", assessment_id: "as2", skill_id: "s1", quest_id: null, domain_id: null, activity_type: "study", repetition_count: 0, repetition_penalty: 1, xp_type: "activity", amount: 10, base_amount: 10, modifier_json: {}, reason: "", rules_version: "v1", skill_name_snapshot: "Statistics", created_at: "" })).toThrow(/skill name/);
    expect(mapTransaction({ id: "t3", user_id: "u1", activity_id: "a1", assessment_id: "as3", skill_id: "s1", quest_id: null, domain_id: null, activity_type: "study", repetition_count: 0, repetition_penalty: 1, xp_type: "activity", amount: 10, base_amount: 10, modifier_json: {}, reason: "", rules_version: "v1", skill_name_snapshot: "Statistics", created_at: "" }, "Statistics")).toMatchObject({ skillName: "Statistics" });
    expect(() => mapPlayer(null)).toThrow(/player_states invariant/);
  });
});
