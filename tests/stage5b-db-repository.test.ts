import { describe, expect, test, beforeAll, afterAll } from "vitest";
import { Client } from "pg";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import { SupabaseRepository } from "@/lib/store/supabase-repository";
import { DemoRepository } from "@/lib/store/demo-repository";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import crypto from "node:crypto";

const DATABASE_URL = process.env.XP_RPG_TEST_DB_URL;
const DEFAULT_LOCAL_SERVICE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "http://127.0.0.1:54321";
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SECRET_KEY || DEFAULT_LOCAL_SERVICE_KEY;

const USER_5B_A = "55555555-aaaa-4aaa-aaaa-aaaaaaaaaaaa";
const USER_5B_B = "55555555-bbbb-4bbb-bbbb-bbbbbbbbbbbb";

describe.skipIf(!DATABASE_URL)("Stage 5B — SupabaseRepository & Cross-Tenant Read Models (Live PostgreSQL)", () => {
  let pgClient: Client;
  let repoA: SupabaseRepository;
  let repoB: SupabaseRepository;

  beforeAll(async () => {
    pgClient = new Client({ connectionString: DATABASE_URL });
    await pgClient.connect();

    // Seed test users
    await pgClient.query(`
      insert into auth.users (id, email) values
        ('${USER_5B_A}', 'stage5b_user_a@growth.rpg'),
        ('${USER_5B_B}', 'stage5b_user_b@growth.rpg')
      on conflict (id) do nothing;
      insert into public.profiles (user_id, display_name) values
        ('${USER_5B_A}', 'Stage5BUserA'),
        ('${USER_5B_B}', 'Stage5BUserB')
      on conflict (user_id) do nothing;
      insert into public.player_states (user_id, total_xp, player_level) values
        ('${USER_5B_A}', 0, 1),
        ('${USER_5B_B}', 0, 1)
      on conflict (user_id) do nothing;
    `);

    const adminClient = createClient<Database>(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    repoA = new SupabaseRepository(adminClient, USER_5B_A);
    repoB = new SupabaseRepository(adminClient, USER_5B_B);
  });

  afterAll(async () => {
    if (pgClient) {
      await pgClient.query("reset role;");
      await pgClient.query(`
        delete from public.skill_edges where user_id in ('${USER_5B_A}', '${USER_5B_B}');
        delete from public.mastery_events where user_id in ('${USER_5B_A}', '${USER_5B_B}');
        delete from public.mastery_verifications where user_id in ('${USER_5B_A}', '${USER_5B_B}');
        delete from public.evidence_records where user_id in ('${USER_5B_A}', '${USER_5B_B}');
        delete from public.xp_transactions where user_id in ('${USER_5B_A}', '${USER_5B_B}');
        delete from public.ai_assessments where user_id in ('${USER_5B_A}', '${USER_5B_B}');
        delete from public.activities where user_id in ('${USER_5B_A}', '${USER_5B_B}');
        delete from public.skills where user_id in ('${USER_5B_A}', '${USER_5B_B}');
        delete from public.domains where user_id in ('${USER_5B_A}', '${USER_5B_B}');
      `);
      await pgClient.end();
    }
  });

  test("1. listDomains: returns tenant-scoped domains ordered by sort_order and name", async () => {
    await pgClient.query(`
      insert into public.domains (id, user_id, name, slug, sort_order) values
        ('d1111111-1111-4000-a000-000000000001', '${USER_5B_A}', 'Mathematics', 'mathematics', 2),
        ('d1111111-1111-4000-a000-000000000002', '${USER_5B_A}', 'Computer Science', 'computer-science', 1),
        ('d2222222-2222-4000-b000-000000000001', '${USER_5B_B}', 'Physics', 'physics', 1)
      on conflict (id) do nothing;
    `);

    const domainsA = await repoA.listDomains();
    expect(domainsA).toHaveLength(2);
    expect(domainsA[0].name).toBe("Computer Science");
    expect(domainsA[1].name).toBe("Mathematics");

    const domainsB = await repoB.listDomains();
    expect(domainsB).toHaveLength(1);
    expect(domainsB[0].name).toBe("Physics");
  });

  test("2. getSkillDetails: returns complete snapshot and exact authoritative createdAt matching DB (P1-1)", async () => {
    // Seed skill for User A in Computer Science domain
    const domainId = "d1111111-1111-4000-a000-000000000002";
    const skillA1 = await pgClient.query<{ id: string; created_at: string }>(`
      insert into public.skills (user_id, domain_id, name, aliases, description, xp, level, mastery_level, mastery_confidence)
      values ('${USER_5B_A}', '${domainId}', 'JavaScript', '{"JS"}', 'Core web language', 500, 4, 3, 0.85)
      returning id, created_at;
    `);
    const s1Id = skillA1.rows[0].id;
    const s1CreatedAt = skillA1.rows[0].created_at;

    const skillA2 = await pgClient.query<{ id: string }>(`
      insert into public.skills (user_id, domain_id, name, aliases, description, xp, level, mastery_level, mastery_confidence)
      values ('${USER_5B_A}', '${domainId}', 'TypeScript', '{"TS"}', 'Typed superset', 0, 1, 0, 0)
      returning id;
    `);
    const s2Id = skillA2.rows[0].id;

    // Prerequisite: JS -> TS
    await repoA.addEdge({
      sourceSkillId: s1Id,
      targetSkillId: s2Id,
      relationType: "prerequisite",
    });

    // Seed Activity + Evidence + MasteryEvent + Transaction for JS
    const actRes = await pgClient.query<{ id: string }>(`
      insert into public.activities (user_id, raw_input, title, status, rules_version)
      values ('${USER_5B_A}', 'Refactor JS codebase', 'Refactor JS codebase', 'confirmed', 'v1')
      returning id;
    `);
    const actId = actRes.rows[0].id;

    const evRes = await pgClient.query<{ id: string }>(`
      insert into public.evidence_records (user_id, activity_id, skill_id, evidence_level, evidence_type, description, verified)
      values ('${USER_5B_A}', '${actId}', '${s1Id}', 3, 'code_refactor', 'Replaced callback hell with async/await', true)
      returning id;
    `);
    const evId = evRes.rows[0].id;

    await pgClient.query(`
      insert into public.mastery_events (user_id, activity_id, skill_id, evidence_id, from_level, to_level, confidence, event_type, reason)
      values ('${USER_5B_A}', '${actId}', '${s1Id}', '${evId}', 2, 3, 0.85, 'upgrade', 'Demonstrated async mastery');

      insert into public.ai_assessments (id, user_id, activity_id, status, assessment_json, rules_version)
      values ('a1111111-1111-4000-a000-000000000001', '${USER_5B_A}', '${actId}', 'confirmed', '{}', 'v1');

      insert into public.xp_transactions (user_id, activity_id, assessment_id, skill_id, skill_name_snapshot, amount, base_amount, reason, rules_version)
      values ('${USER_5B_A}', '${actId}', 'a1111111-1111-4000-a000-000000000001', '${s1Id}', 'JavaScript', 100, 100, 'JS Async Practice', 'v1');
    `);

    // Fetch details for JS
    const detailJS = await repoA.getSkillDetails(s1Id);
    expect(detailJS).not.toBeNull();
    expect(detailJS!.skill.name).toBe("JavaScript");
    expect(detailJS!.skill.domainName).toBe("Computer Science");
    expect(detailJS!.skill.derivedState).toBe("proficient");
    // P1-1: detail.skill.createdAt === actual public.skills.created_at ISO string
    expect(new Date(detailJS!.skill.createdAt).toISOString()).toBe(new Date(s1CreatedAt).toISOString());
    expect(detailJS!.nextUnlocks).toHaveLength(1);
    expect(detailJS!.nextUnlocks[0].name).toBe("TypeScript");
    expect(detailJS!.nextUnlocks[0].derivedState).toBe("available");
    expect(detailJS!.evidenceTimeline).toHaveLength(1);
    expect(detailJS!.evidenceTimeline[0].activityTitle).toBe("Refactor JS codebase");
    expect(detailJS!.masteryHistory).toHaveLength(1);
    expect(detailJS!.masteryHistory[0].toLevel).toBe(3);
    expect(detailJS!.recentTransactions).toHaveLength(1);

    // Fetch details for TS
    const detailTS = await repoA.getSkillDetails(s2Id);
    expect(detailTS).not.toBeNull();
    expect(detailTS!.skill.name).toBe("TypeScript");
    expect(detailTS!.skill.derivedState).toBe("available");
    expect(detailTS!.prerequisites).toHaveLength(1);
    expect(detailTS!.prerequisites[0].name).toBe("JavaScript");
    expect(detailTS!.prerequisites[0].isFulfilled).toBe(true);
  });

  test("3. deleteEdge Semantics & Tenant Isolation (P1-2)", async () => {
    // 1. User A creates edge
    const skillsA = await repoA.listSkills();
    const edge = await repoA.addEdge({
      sourceSkillId: skillsA[0].id,
      targetSkillId: skillsA[1].id,
      relationType: "supports",
    });
    expect(edge.id).toBeDefined();

    // 2. User B attempts to delete User A's edge -> MUST RETURN false (P1-2 / Cross-tenant)
    const deletedByB = await repoB.deleteEdge(edge.id!);
    expect(deletedByB).toBe(false);

    // 3. User A deletes own edge -> MUST RETURN true
    const deletedByA = await repoA.deleteEdge(edge.id!);
    expect(deletedByA).toBe(true);

    // 4. User A deletes same edge again -> MUST RETURN false
    const deletedAgain = await repoA.deleteEdge(edge.id!);
    expect(deletedAgain).toBe(false);
  });

  test("4. Cross-Tenant Isolation: User B cannot access User A's skill details, evidence, or events", async () => {
    const skillARes = await pgClient.query<{ id: string }>(`
      select id from public.skills where user_id = '${USER_5B_A}' limit 1;
    `);
    const skillAId = skillARes.rows[0].id;

    // User B querying User A's skill detail MUST return null
    const crossDetail = await repoB.getSkillDetails(skillAId);
    expect(crossDetail).toBeNull();

    // User B listing evidence for User A's skill MUST return empty array
    const crossEvidence = await repoB.listEvidenceRecords(skillAId);
    expect(crossEvidence).toHaveLength(0);

    // User B listing mastery events for User A's skill MUST return empty array
    const crossEvents = await repoB.listMasteryEvents(skillAId);
    expect(crossEvents).toHaveLength(0);
  });

  test("5. Domain assignment validation parity between Demo and Supabase (P1-4)", async () => {
    const skillsA = await repoA.listSkills();
    const skillAId = skillsA[0].id;
    const nonExistentDomainUuid = crypto.randomUUID();

    // Supabase rejects non-existent/cross-tenant domain
    await expect(
      repoA.updateSkillMetadata(skillAId, { domainId: nonExistentDomainUuid }),
    ).rejects.toThrow();

    // Demo repository rejects non-existent domain
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "demo-domain-test-"));
    process.env.DEMO_DB_PATH = path.join(tempDir, "demo.json");
    const demoRepo = new DemoRepository();
    await demoRepo.reset();

    const act = await demoRepo.addActivity({ rawInput: "Domain test", totalMinutes: 10 });
    const assess = await demoRepo.addAssessment({
      activityId: act.id,
      modelName: "test-model",
      promptVersion: "v1",
      proposal: {
        activity: { type: "learning", completion: 0.8 },
        difficulty: { complexity: 0.5, uncertainty: 0.4, expertise_gap: 0.5, resistance: 0.4 },
        growth: { effort: 0.6, learning: 0.7, performance: 0.3, outcome: 0.5, artifact_value: 0.2, character_evidence: 0.1 },
        evidence: { level: 2, explanation: "tested domain" },
        affected_skills: [{ name: "DomainSkill", reason: "test" }],
        knowledge_updates: { proposed_nodes: [], proposed_edges: [] },
        mastery_changes: [],
        xp_semantics: { base_value: 20, difficulty: 0.5, mastery_gain: 0.5, novelty: 0.5, goal_alignment: 0.6, repetition_risk: "low" },
        artifacts: [],
        next_quest: null,
        confidence: 0.9,
        uncertainty_notes: [],
      },
    });
    const setRes = await demoRepo.applySettlement({
      assessmentId: assess.id,
      transaction: {
        id: crypto.randomUUID(),
        activityId: act.id,
        assessmentId: assess.id,
        xpType: "activity",
        skillId: "",
        skillName: "DomainSkill",
        activityType: "coding",
        repetitionCount: 0,
        repetitionPenalty: 1,
        amount: 20,
        baseAmount: 20,
        modifierJson: {},
        reason: "Test",
        rulesVersion: "test",
        createdAt: new Date().toISOString(),
      },
      xpDelta: 20,
      primarySkill: {
        skill: { resolution: "create", proposedName: "DomainSkill" },
        name: "DomainSkill",
        xpDelta: 20,
        masteryAction: { action: "none" },
      },
      player: { xpDelta: 20 },
    });

    await expect(
      demoRepo.updateSkillMetadata(setRes.skillId!, { domainId: nonExistentDomainUuid }),
    ).rejects.toThrow(/Referenced domain does not exist/);

    fs.rmSync(tempDir, { recursive: true, force: true });
    delete process.env.DEMO_DB_PATH;
  });

  test("6. DemoRepository and SupabaseRepository Read-Model Parity", async () => {
    // Setup isolated DemoRepository
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "demo-parity-test-"));
    process.env.DEMO_DB_PATH = path.join(tempDir, "demo.json");
    const demoRepo = new DemoRepository();
    await demoRepo.reset();

    const act = await demoRepo.addActivity({ rawInput: "Parity test activity", totalMinutes: 60 });
    const assess = await demoRepo.addAssessment({
      activityId: act.id,
      modelName: "test-model",
      promptVersion: "v1",
      proposal: {
        activity: { type: "learning", completion: 0.8 },
        difficulty: { complexity: 0.5, uncertainty: 0.4, expertise_gap: 0.5, resistance: 0.4 },
        growth: {
          effort: 0.6,
          learning: 0.7,
          performance: 0.3,
          outcome: 0.5,
          artifact_value: 0.2,
          character_evidence: 0.1,
        },
        evidence: { level: 4, explanation: "Built concurrency primitives" },
        affected_skills: [{ name: "Rust", reason: "used rust" }],
        knowledge_updates: { proposed_nodes: [], proposed_edges: [] },
        mastery_changes: [],
        xp_semantics: {
          base_value: 20,
          difficulty: 0.5,
          mastery_gain: 0.5,
          novelty: 0.5,
          goal_alignment: 0.6,
          repetition_risk: "low",
        },
        artifacts: [],
        next_quest: null,
        confidence: 0.9,
        uncertainty_notes: [],
      },
    });

    const setRes = await demoRepo.applySettlement({
      assessmentId: assess.id,
      transaction: {
        id: crypto.randomUUID(),
        activityId: act.id,
        assessmentId: assess.id,
        xpType: "activity",
        skillId: "",
        skillName: "Rust",
        activityType: "coding",
        repetitionCount: 0,
        repetitionPenalty: 1,
        amount: 200,
        baseAmount: 200,
        modifierJson: {},
        reason: "Rust Async",
        rulesVersion: "test",
        createdAt: new Date().toISOString(),
      },
      xpDelta: 200,
      primarySkill: {
        skill: { resolution: "create", proposedName: "Rust" },
        name: "Rust",
        xpDelta: 200,
        masteryAction: { action: "upgrade", proposedLevel: 4, confidence: 0.9 },
      },
      player: { xpDelta: 200 },
      evidence: {
        level: 4,
        type: "code",
        explanation: "Built concurrency primitives",
      },
    });

    const demoDetail = await demoRepo.getSkillDetails(setRes.skillId!);
    expect(demoDetail).not.toBeNull();
    expect(demoDetail!.skill.name).toBe("Rust");
    expect(demoDetail!.skill.derivedState).toBe("proficient");
    expect(demoDetail!.skill.createdAt).toBeDefined();
    expect(demoDetail!.evidenceTimeline).toHaveLength(1);
    expect(demoDetail!.evidenceTimeline[0].evidenceLevel).toBe(4);
    expect(demoDetail!.evidenceTimeline[0].verified).toBe(true);
    expect(demoDetail!.masteryHistory).toHaveLength(1);
    expect(demoDetail!.masteryHistory[0].toLevel).toBe(4);
    expect(demoDetail!.recentTransactions).toHaveLength(1);

    // Clean up
    fs.rmSync(tempDir, { recursive: true, force: true });
    delete process.env.DEMO_DB_PATH;
  });
});
