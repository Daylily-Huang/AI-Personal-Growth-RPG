import { describe, expect, test, beforeAll, afterAll } from "vitest";
import { Client } from "pg";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import { SupabaseRepository } from "@/lib/store/supabase-repository";
import { buildDashboardSnapshot } from "@/lib/store/dashboard.service";
import type { AssessmentProposal } from "@/lib/ai/schemas";
import type { SettlementToApply } from "@/lib/store/types";

const DATABASE_URL = process.env.XP_RPG_TEST_DB_URL;

const DEFAULT_LOCAL_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0";
const DEFAULT_LOCAL_SERVICE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU";

// Local Supabase test configuration
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "http://127.0.0.1:54321";
const SUPABASE_PUBLISHABLE_KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || DEFAULT_LOCAL_ANON_KEY;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SECRET_KEY || DEFAULT_LOCAL_SERVICE_KEY;

process.env.NEXT_PUBLIC_SUPABASE_URL = SUPABASE_URL;
process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = SUPABASE_PUBLISHABLE_KEY;
process.env.SUPABASE_SECRET_KEY = SUPABASE_SERVICE_ROLE_KEY;

const USER_READ_A = "12345678-aaaa-4aaa-aaaa-aaaaaaaaaaaa";
const USER_READ_B = "87654321-bbbb-4bbb-bbbb-bbbbbbbbbbbb";
const TEST_PASSWORD = "Password123!Safe";

async function schemaExists(client: Client): Promise<boolean> {
  const r = await client.query<{ n: number }>(
    `select count(*)::int as n from pg_class
      where relname = 'activities' and relnamespace = 'public'::regnamespace`,
  );
  return r.rows[0].n > 0;
}

function makeProposal(skillName: string, xpAmount: number): AssessmentProposal {
  return {
    activity: {
      type: "learning",
      completion: 0.8,
    },
    difficulty: {
      complexity: 0.5,
      uncertainty: 0.4,
      expertise_gap: 0.5,
      resistance: 0.3,
    },
    growth: {
      effort: 0.6,
      learning: 0.7,
      performance: 0.4,
      outcome: 0.5,
      artifact_value: 0.2,
      character_evidence: 0.1,
    },
    evidence: {
      level: 1,
      explanation: "Self-report",
    },
    affected_skills: [
      {
        name: skillName,
        reason: "TypeScript mastery",
      },
    ],
    knowledge_updates: {
      proposed_nodes: [],
      proposed_edges: [],
    },
    mastery_changes: [],
    xp_semantics: {
      base_value: xpAmount,
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
  };
}

describe.skipIf(!DATABASE_URL)("Stage 3 — Full Supabase Read Path & E2E Integration (live DB)", () => {
  let pgClient: Client;
  let adminClient: ReturnType<typeof createClient<Database>>;
  let repoA: SupabaseRepository;
  let repoB: SupabaseRepository;

  beforeAll(async () => {
    if (!DATABASE_URL) throw new Error("XP_RPG_TEST_DB_URL not set");
    pgClient = new Client({ connectionString: DATABASE_URL });
    await pgClient.connect();

    if (!(await schemaExists(pgClient))) {
      throw new Error("Database schema does not exist; run supabase db reset first");
    }

    adminClient = createClient<Database>(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false },
    });

    // Cleanup previous test state cleanly
    await pgClient.query(`delete from public.xp_transactions where user_id in ($1, $2)`, [USER_READ_A, USER_READ_B]);
    await pgClient.query(`delete from public.ai_assessments where user_id in ($1, $2)`, [USER_READ_A, USER_READ_B]);
    await pgClient.query(`delete from public.activities where user_id in ($1, $2)`, [USER_READ_A, USER_READ_B]);
    await pgClient.query(`delete from public.skills where user_id in ($1, $2)`, [USER_READ_A, USER_READ_B]);
    await pgClient.query(`delete from public.player_states where user_id in ($1, $2)`, [USER_READ_A, USER_READ_B]);
    await pgClient.query(`delete from public.profiles where user_id in ($1, $2)`, [USER_READ_A, USER_READ_B]);
    await pgClient.query(`delete from auth.users where id in ($1, $2)`, [USER_READ_A, USER_READ_B]);

    // Create User A and User B via admin auth API
    const { error: errA } = await adminClient.auth.admin.createUser({
      id: USER_READ_A,
      email: "read_a@test.local",
      password: TEST_PASSWORD,
      email_confirm: true,
    });
    if (errA) throw errA;

    const { error: errB } = await adminClient.auth.admin.createUser({
      id: USER_READ_B,
      email: "read_b@test.local",
      password: TEST_PASSWORD,
      email_confirm: true,
    });
    if (errB) throw errB;

    // Sign in User A and User B to obtain real JWT access tokens
    const anonClient = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
      auth: { persistSession: false },
    });

    const { data: authA, error: signAError } = await anonClient.auth.signInWithPassword({
      email: "read_a@test.local",
      password: TEST_PASSWORD,
    });
    if (signAError || !authA.session) throw signAError ?? new Error("Auth A session failed");

    const { data: authB, error: signBError } = await anonClient.auth.signInWithPassword({
      email: "read_b@test.local",
      password: TEST_PASSWORD,
    });
    if (signBError || !authB.session) throw signBError ?? new Error("Auth B session failed");

    // Construct authenticated client instances
    const clientA = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
      global: { headers: { Authorization: `Bearer ${authA.session.access_token}` } },
      auth: { persistSession: false },
    });

    const clientB = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
      global: { headers: { Authorization: `Bearer ${authB.session.access_token}` } },
      auth: { persistSession: false },
    });

    repoA = new SupabaseRepository(clientA, USER_READ_A);
    repoB = new SupabaseRepository(clientB, USER_READ_B);
  });

  afterAll(async () => {
    if (pgClient) {
      await pgClient.query(`delete from public.xp_transactions where user_id in ($1, $2)`, [USER_READ_A, USER_READ_B]);
      await pgClient.query(`delete from public.ai_assessments where user_id in ($1, $2)`, [USER_READ_A, USER_READ_B]);
      await pgClient.query(`delete from public.activities where user_id in ($1, $2)`, [USER_READ_A, USER_READ_B]);
      await pgClient.query(`delete from public.skills where user_id in ($1, $2)`, [USER_READ_A, USER_READ_B]);
      await pgClient.query(`delete from public.player_states where user_id in ($1, $2)`, [USER_READ_A, USER_READ_B]);
      await pgClient.query(`delete from public.profiles where user_id in ($1, $2)`, [USER_READ_A, USER_READ_B]);
      await pgClient.query(`delete from auth.users where id in ($1, $2)`, [USER_READ_A, USER_READ_B]);
      await pgClient.end();
    }
  });

  test("1. Initial user state via SupabaseRepository & Dashboard snapshot", async () => {
    const player = await repoA.getPlayer();
    expect(player).toEqual({
      playerLevel: 1,
      totalXp: 0,
      energy: 70,
      focus: 70,
      momentum: 30,
    });

    const activities = await repoA.listActivities();
    expect(activities).toEqual([]);

    const skills = await repoA.listSkills();
    expect(skills).toEqual([]);

    const txs = await repoA.listTransactions();
    expect(txs).toEqual([]);

    const verifications = await repoA.listMasteryVerifications();
    expect(verifications).toEqual([]);

    const dashboard = await buildDashboardSnapshot(repoA);
    expect(dashboard.player.totalXp).toBe(0);
    expect(dashboard.player.playerLevel).toBe(1);
    expect(dashboard.levelProgress.progress).toBe(0);
    expect(dashboard.activities).toEqual([]);
    expect(dashboard.recentGrowth).toEqual([]);
    expect(dashboard.skills).toEqual([]);
  });

  test("2. Full E2E user growth journey: create activity -> assess -> settle -> verify read path", async () => {
    // Step A: Create Activity via RPC
    const activity = await repoA.addActivity({
      rawInput: "阅读 TypeScript 官方类型系统与条件类型文档",
      totalMinutes: 60,
      effectiveMinutes: 50,
    });

    expect(activity.id).toBeDefined();
    expect(activity.status).toBe("pending_assessment");
    expect(activity.rulesVersion).toBe("growth-engine-v0.1");

    // Step B: Record AI Assessment (service_role via AssessmentPersistenceService)
    const proposal = makeProposal("TypeScript", 60);
    const assessment = await repoA.addAssessment({
      activityId: activity.id,
      proposal,
      modelName: "test-model",
      promptVersion: "v1.0",
    });

    expect(assessment.id).toBeDefined();
    expect(assessment.status).toBe("pending");

    // Check activity state updated to assessed
    const reloadedAct = await repoA.getActivity(activity.id);
    expect(reloadedAct?.status).toBe("assessed");

    // Dashboard shows pending assessment
    let dash = await buildDashboardSnapshot(repoA);
    expect(dash.pendingAssessments.length).toBe(1);
    expect(dash.pendingAssessments[0].id).toBe(assessment.id);

    // Step C: Confirm & Settle Activity (RPC)
    const settlement: SettlementToApply = {
      assessmentId: assessment.id,
      xpDelta: 60,
      player: { xpDelta: 60 },
      primarySkill: {
        skill: { resolution: "create", proposedName: "TypeScript" },
        name: "TypeScript",
        xpDelta: 60,
        masteryAction: { action: "none" },
      },
      transaction: {
        id: crypto.randomUUID(),
        activityId: activity.id,
        assessmentId: assessment.id,
        xpType: "activity",
        skillId: "",
        skillName: "TypeScript",
        activityType: "learning",
        repetitionCount: 0,
        repetitionPenalty: 1,
        amount: 60,
        baseAmount: 60,
        modifierJson: {},
        reason: "Completed TypeScript deep dive",
        rulesVersion: "growth-engine-v0.1",
        createdAt: new Date().toISOString(),
      },
    };

    const settleRes = await repoA.applySettlement(settlement);
    expect(settleRes.ok).toBe(true);

    // Step D: Re-query Dashboard & verify full read path reflects new permanent growth state
    dash = await buildDashboardSnapshot(repoA);
    expect(dash.player.totalXp).toBe(60);
    expect(dash.player.playerLevel).toBe(1);
    expect(dash.levelProgress.xpIntoLevel).toBe(60);

    // Skills list contains TypeScript
    expect(dash.skills.length).toBe(1);
    expect(dash.skills[0].name).toBe("TypeScript");
    expect(dash.skills[0].xp).toBe(60);
    expect(dash.skills[0].masteryLevel).toBe(1);

    // Recent growth contains the transaction with skill_name_snapshot
    expect(dash.recentGrowth.length).toBe(1);
    expect(dash.recentGrowth[0].amount).toBe(60);
    expect(dash.recentGrowth[0].skillName).toBe("TypeScript");

    // Activity is confirmed and pending assessments are cleared
    expect(dash.activities.length).toBe(1);
    expect(dash.activities[0].status).toBe("confirmed");
    expect(dash.pendingAssessments.length).toBe(0);
  });

  test("3. Dual-user isolation: User B cannot see User A's data", async () => {
    const playerB = await repoB.getPlayer();
    expect(playerB.totalXp).toBe(0);

    const activitiesB = await repoB.listActivities();
    expect(activitiesB).toEqual([]);

    const skillsB = await repoB.listSkills();
    expect(skillsB).toEqual([]);

    const txsB = await repoB.listTransactions();
    expect(txsB).toEqual([]);

    const dashB = await buildDashboardSnapshot(repoB);
    expect(dashB.player.totalXp).toBe(0);
    expect(dashB.activities).toEqual([]);
    expect(dashB.skills).toEqual([]);
    expect(dashB.recentGrowth).toEqual([]);
  });

  test("4. Stage 4 Live DB: Quest CRUD, tree building, and RLS isolation", async () => {
    // User A creates a main quest
    const mainQuest = await repoA.addQuest({
      title: "Complete Stage 4 Milestone",
      description: "Implement quest system end-to-end",
      questType: "production",
      questSize: "main",
      isMainQuest: true,
      status: "active",
      difficulty: 0.8,
      goalAlignment: 1.0,
    });
    expect(mainQuest.id).toBeDefined();
    expect(mainQuest.title).toBe("Complete Stage 4 Milestone");
    expect(mainQuest.isMainQuest).toBe(true);

    // User A creates a sub quest
    const subQuest = await repoA.addQuest({
      title: "Write Quest Unit Tests",
      parentQuestId: mainQuest.id,
      questType: "skill",
      questSize: "standard",
      status: "active",
      progress: 50,
    });
    expect(subQuest.parentQuestId).toBe(mainQuest.id);

    // User A lists quests and checks dashboard integration
    const userAQuests = await repoA.listQuests();
    expect(userAQuests.length).toBe(2);

    const dashA = await buildDashboardSnapshot(repoA);
    expect(dashA.mainQuest?.id).toBe(mainQuest.id);
    expect(dashA.activeQuests?.length).toBe(2);

    // User B tries to read quests -> should see 0 due to RLS
    const userBQuests = await repoB.listQuests();
    expect(userBQuests).toEqual([]);

    const userBQuest = await repoB.getQuest(mainQuest.id);
    expect(userBQuest).toBeNull();

    // User A updates subquest to completed
    const updatedSub = await repoA.updateQuest(subQuest.id, {
      status: "completed",
      progress: 100,
    });
    expect(updatedSub.status).toBe("completed");
    expect(updatedSub.completedAt).not.toBeNull();

    // User A deletes subquest
    await repoA.deleteQuest(subQuest.id);
    const afterDelete = await repoA.getQuest(subQuest.id);
    expect(afterDelete).toBeNull();
  });

  test("5. Stage 4.1 Live DB: Constraints, Anti-cycle Triggers, Cross-tenant FK rejection, and Settle rollup", async () => {
    // 1. Cross-tenant FK rejection: User B cannot reference User A's quest as parent
    const questA = await repoA.addQuest({
      title: "User A Parent Quest",
      questType: "production",
    });

    await expect(
      repoB.addQuest({
        title: "User B Illegally refering User A",
        parentQuestId: questA.id,
        questType: "skill",
      }),
    ).rejects.toThrow();

    // 2. Numeric Range Constraints
    await expect(
      repoA.addQuest({
        title: "Invalid Difficulty",
        questType: "skill",
        difficulty: 1.5,
      }),
    ).rejects.toThrow();

    // 3. PostgreSQL Anti-cycle Trigger (Self-parenting)
    await expect(
      repoA.updateQuest(questA.id, { parentQuestId: questA.id }),
    ).rejects.toThrow();

    // 4. PostgreSQL Anti-cycle Trigger (A -> B -> A)
    const questB = await repoA.addQuest({
      title: "Quest B under A",
      parentQuestId: questA.id,
      questType: "skill",
    });

    await expect(
      repoA.updateQuest(questA.id, { parentQuestId: questB.id }),
    ).rejects.toThrow();

    // 5. Live DB Settle Activity -> Advances Quest & Rolls up to Parent in PostgreSQL
    const activity = await repoA.addActivity({
      rawInput: "Live DB test activity for quest advancement",
      questId: questB.id,
      totalMinutes: 60,
      effectiveMinutes: 40,
    });

    const assessRes = await adminClient
      .from("ai_assessments")
      .insert({
        user_id: USER_READ_A,
        activity_id: activity.id,
        model_name: "test-model",
        prompt_version: "v1",
        rules_version: "v1",
        confidence: 0.9,
        assessment_json: makeProposal("LiveQuestSkill", 50),
      })
      .select()
      .single();
    expect(assessRes.error).toBeNull();

    const settlement = {
      assessmentId: assessRes.data!.id,
      xpDelta: 50,
      transaction: {
        id: crypto.randomUUID(),
        activityId: activity.id,
        assessmentId: assessRes.data!.id,
        xpType: "activity" as const,
        skillId: "",
        skillName: "LiveQuestSkill",
        activityType: "coding",
        repetitionCount: 0,
        repetitionPenalty: 1.0,
        amount: 50,
        baseAmount: 50,
        modifierJson: {},
        reason: "Test live quest settlement",
        rulesVersion: "v1",
        createdAt: new Date().toISOString(),
      },
      primarySkill: {
        skill: { resolution: "create" as const, proposedName: "LiveQuestSkill" },
        name: "LiveQuestSkill",
        xpDelta: 50,
        masteryAction: { action: "none" as const },
      },
      player: { xpDelta: 50 },
    };

    const settleResult = await repoA.applySettlement(settlement);
    expect(settleResult.ok).toBe(true);

    // Verify Child and Parent progress in Live DB
    const updatedQuestB = await repoA.getQuest(questB.id);
    expect(updatedQuestB?.progress).toBeGreaterThan(0);

    const updatedQuestA = await repoA.getQuest(questA.id);
    expect(updatedQuestA?.progress).toBe(updatedQuestB?.progress);
  });
});

