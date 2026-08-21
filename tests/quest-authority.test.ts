import { describe, expect, test, beforeAll, afterAll } from "vitest";
import { Client } from "pg";

const DATABASE_URL = process.env.XP_RPG_TEST_DB_URL;

const USER_A = "aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa";
const USER_B = "bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbbbb";

describe.skipIf(!DATABASE_URL)("Stage 4.2 — Quest Authority, Derived State & Auditing (Live PostgreSQL)", () => {
  let client: Client;

  beforeAll(async () => {
    if (!DATABASE_URL) throw new Error("XP_RPG_TEST_DB_URL not set");
    client = new Client({ connectionString: DATABASE_URL });
    await client.connect();

    // Ensure test users exist in auth.users & profiles
    await client.query(`
      insert into auth.users (id, email) values
        ('${USER_A}', 'quest_user_a@growth.rpg'),
        ('${USER_B}', 'quest_user_b@growth.rpg')
      on conflict (id) do nothing;
      insert into public.profiles (user_id, display_name) values
        ('${USER_A}', 'QuestUserA'),
        ('${USER_B}', 'QuestUserB')
      on conflict (user_id) do nothing;
    `);
  });

  afterAll(async () => {
    if (client) {
      await client.query("reset role;");
      await client.query(`
        alter table public.activities disable trigger trg_activity_immutability;
        delete from public.xp_transactions where user_id in ('${USER_A}', '${USER_B}');
        delete from public.ai_assessments where user_id in ('${USER_A}', '${USER_B}');
        delete from public.activities where user_id in ('${USER_A}', '${USER_B}');
        delete from public.quests where user_id in ('${USER_A}', '${USER_B}');
        alter table public.activities enable trigger trg_activity_immutability;
      `);
      await client.end();
    }
  });

  test("P1-2: Deleting parent quest cascades ON DELETE SET NULL (parent_quest_id) and preserves child user_id", async () => {
    // 1. Create Parent Quest
    const parentRes = await client.query<{ id: string }>(`
      insert into public.quests (user_id, title, quest_type, quest_size, status)
      values ('${USER_A}', 'Parent to be deleted', 'production', 'major', 'active')
      returning id;
    `);
    const parentId = parentRes.rows[0].id;

    // 2. Create Child Quest
    const childRes = await client.query<{ id: string }>(`
      insert into public.quests (user_id, parent_quest_id, title, quest_type, quest_size, status)
      values ('${USER_A}', '${parentId}', 'Orphan child candidate', 'skill', 'standard', 'active')
      returning id;
    `);
    const childId = childRes.rows[0].id;

    // 3. Delete Parent Quest
    await client.query(`delete from public.quests where id = '${parentId}' and user_id = '${USER_A}';`);

    // 4. Verify Child Quest still exists, user_id is intact, parent_quest_id is NULL
    const checkRes = await client.query<{ id: string; user_id: string; parent_quest_id: string | null }>(`
      select id, user_id, parent_quest_id from public.quests where id = '${childId}';
    `);
    expect(checkRes.rows.length).toBe(1);
    expect(checkRes.rows[0].user_id).toBe(USER_A);
    expect(checkRes.rows[0].parent_quest_id).toBeNull();
  });

  test("P1-1: Derived progress anti-spoofing overrides direct client writes on quests with children", async () => {
    // 1. Create Parent Quest
    const parentRes = await client.query<{ id: string }>(`
      insert into public.quests (user_id, title, quest_type, quest_size, status, progress)
      values ('${USER_A}', 'Real Parent Quest', 'production', 'main', 'active', 0)
      returning id;
    `);
    const parentId = parentRes.rows[0].id;

    // 2. Create Two Children with 20% and 40% progress
    await client.query(`
      insert into public.quests (user_id, parent_quest_id, title, quest_type, quest_size, status, progress)
      values
        ('${USER_A}', '${parentId}', 'Subquest 1', 'skill', 'standard', 'active', 20),
        ('${USER_A}', '${parentId}', 'Subquest 2', 'skill', 'standard', 'active', 40);
    `);

    // Parent should automatically be (20 + 40) / 2 = 30%
    const parentCheck1 = await client.query<{ progress: number; status: string }>(`
      select progress, status from public.quests where id = '${parentId}';
    `);
    expect(Number(parentCheck1.rows[0].progress)).toBe(30);

    // 3. Authenticated client attempts to directly spoof progress = 100 and status = 'completed' on the parent
    await client.query(`
      update public.quests
      set progress = 100, status = 'completed'
      where id = '${parentId}' and user_id = '${USER_A}';
    `);

    // 4. Verify the BEFORE UPDATE trigger authoritatively forced progress back to 30% and status to 'active'
    const parentCheck2 = await client.query<{ progress: number; status: string; completed_at: string | null }>(`
      select progress, status, completed_at from public.quests where id = '${parentId}';
    `);
    expect(Number(parentCheck2.rows[0].progress)).toBe(30);
    expect(parentCheck2.rows[0].status).toBe("active");
    expect(parentCheck2.rows[0].completed_at).toBeNull();
  });

  test("P1-3: Reparenting recomputes progress for both OLD parent and NEW parent", async () => {
    // 1. Create Parent A and Parent B
    const pARes = await client.query<{ id: string }>(`
      insert into public.quests (user_id, title, quest_type, quest_size, status)
      values ('${USER_A}', 'Parent Alpha', 'production', 'major', 'active')
      returning id;
    `);
    const parentA = pARes.rows[0].id;

    const pBRes = await client.query<{ id: string }>(`
      insert into public.quests (user_id, title, quest_type, quest_size, status)
      values ('${USER_A}', 'Parent Beta', 'production', 'major', 'active')
      returning id;
    `);
    const parentB = pBRes.rows[0].id;

    // 2. Add Child A1 (50%) and Child X (100%) under Parent A
    const childXRes = await client.query<{ id: string }>(`
      insert into public.quests (user_id, parent_quest_id, title, quest_type, quest_size, status, progress)
      values
        ('${USER_A}', '${parentA}', 'Child A1', 'skill', 'standard', 'active', 50),
        ('${USER_A}', '${parentA}', 'Child X', 'skill', 'standard', 'completed', 100)
      returning id;
    `);
    const childX = childXRes.rows[1].id; // second insert is Child X

    // Parent A should be (50 + 100) / 2 = 75%
    const pACheck1 = await client.query<{ progress: number }>(`
      select progress from public.quests where id = '${parentA}';
    `);
    expect(Number(pACheck1.rows[0].progress)).toBe(75);

    // 3. Move Child X from Parent A to Parent B
    await client.query(`
      update public.quests
      set parent_quest_id = '${parentB}'
      where id = '${childX}' and user_id = '${USER_A}';
    `);

    // 4. Verify Parent A recomputed to 50% (only Child A1 remains)
    const pACheck2 = await client.query<{ progress: number }>(`
      select progress from public.quests where id = '${parentA}';
    `);
    expect(Number(pACheck2.rows[0].progress)).toBe(50);

    // 5. Verify Parent B recomputed to 100% (Child X has 100%)
    const pBCheck2 = await client.query<{ progress: number; status: string }>(`
      select progress, status from public.quests where id = '${parentB}';
    `);
    expect(Number(pBCheck2.rows[0].progress)).toBe(100);
    expect(pBCheck2.rows[0].status).toBe("completed");
  });

  test("P1-5: create_activity freezes quest_size_snapshot and settle_activity audits quest modifiers", async () => {
    // 1. Create Epic Quest
    const qRes = await client.query<{ id: string }>(`
      insert into public.quests (user_id, title, quest_type, quest_size, status)
      values ('${USER_A}', 'Epic Architectural Overhaul', 'production', 'epic', 'active')
      returning id;
    `);
    const questId = qRes.rows[0].id;

    // 2. Call create_activity as USER_A
    await client.query("set role authenticated");
    await client.query("select set_config('request.jwt.claim.sub', $1, false)", [USER_A]);

    const actRes = await client.query<{ id: string; quest_size_snapshot: string; quest_id_snapshot: string; quest_title_snapshot: string }>(`
      select * from public.create_activity(
        'Refactored DB Constraints',
        'Rewrote composite foreign keys and triggers',
        'production',
        '${questId}'
      );
    `);
    expect(actRes.rows[0].quest_size_snapshot).toBe("epic");
    expect(actRes.rows[0].quest_id_snapshot).toBe(questId);
    expect(actRes.rows[0].quest_title_snapshot).toBe("Epic Architectural Overhaul");
    const activityId = actRes.rows[0].id;
    await client.query("reset role");

    // 3. User later modifies the quest size to 'micro' and renames the quest
    await client.query(`
      update public.quests 
      set quest_size = 'micro', title = 'Renamed Small Task' 
      where id = '${questId}';
    `);

    // 4. Settle activity with assessment
    const assessRes = await client.query<{ id: string }>(`
      insert into public.ai_assessments (
        user_id, activity_id, status, confidence, rules_version, assessment_json
      ) values (
        '${USER_A}', '${activityId}', 'pending', 0.9, 'growth-engine-v0.1',
        '{"activity": {"type": "production", "completion": 0.8}, "affected_skills": [{"name": "Database Architecture"}], "xp_semantics": {"base_value": 40, "difficulty": 0.7, "mastery_gain": 0.6, "novelty": 0.8, "goal_alignment": 0.9}, "evidence": {"level": 2}, "mastery_changes": []}'::jsonb
      ) returning id;
    `);
    const assessmentId = assessRes.rows[0].id;

    // Execute settlement RPC
    const settlePayload = {
      assessmentId,
      xpDelta: 85,
      transaction: {
        amount: 85,
        baseAmount: 40,
        skillName: "Database Architecture",
        activityType: "production",
        xpType: "activity",
        repetitionCount: 0,
        repetitionPenalty: 1,
        modifierJson: {
          difficulty: 1.275,
          masteryGain: 1.1,
          evidence: 0.85,
          novelty: 1.0,
          goalAlignment: 1.16,
          questSize: "epic",
          questCap: 800,
          questIdSnapshot: questId,
          questTitleSnapshot: "Epic Architectural Overhaul",
        },
        reason: "Refactored DB Constraints",
      },
      primarySkill: {
        name: "Database Architecture",
        xpDelta: 85,
        masteryAction: { action: "none" },
      },
      player: { xpDelta: 85 },
      questProgressDelta: 40,
      relatedSkillLabels: [],
    };

    const settleRes = await client.query<{ settle_activity: { ok: boolean; transaction: { modifierJson: Record<string, unknown> } } }>(`
      select public.settle_activity('${USER_A}'::uuid, $1::jsonb) as settle_activity;
    `, [JSON.stringify(settlePayload)]);

    expect(settleRes.rows[0].settle_activity).toMatchObject({ ok: true });
    const tx = settleRes.rows[0].settle_activity.transaction;
    expect(tx.modifierJson.questSize).toBe("epic");
    expect(tx.modifierJson.questCap).toBe(800);
    expect(tx.modifierJson.questIdSnapshot).toBe(questId);
    expect(tx.modifierJson.questTitleSnapshot).toBe("Epic Architectural Overhaul");

    // Verify quest progress advanced by exact deterministic delta (0 -> 40)
    const questCheck = await client.query<{ progress: number }>(`
      select progress from public.quests where id = '${questId}';
    `);
    expect(Number(questCheck.rows[0].progress)).toBe(40);
  });

  test("P2-2: Archived / Failed Quest does NOT advance progress during settlement", async () => {
    // 1. Create Failed Quest
    const qRes = await client.query<{ id: string }>(`
      insert into public.quests (user_id, title, quest_type, quest_size, status, progress)
      values ('${USER_A}', 'Abandoned Quest', 'learning', 'standard', 'failed', 20)
      returning id;
    `);
    const questId = qRes.rows[0].id;

    // 2. Create and settle linked activity
    await client.query("set role authenticated");
    await client.query("select set_config('request.jwt.claim.sub', $1, false)", [USER_A]);
    const actRes = await client.query<{ id: string }>(`
      select * from public.create_activity('Post-mortem analysis', 'Studied why it failed', 'learning', '${questId}');
    `);
    const activityId = actRes.rows[0].id;
    await client.query("reset role");

    const assessRes = await client.query<{ id: string }>(`
      insert into public.ai_assessments (
        user_id, activity_id, status, confidence, rules_version, assessment_json
      ) values (
        '${USER_A}', '${activityId}', 'pending', 0.9, 'growth-engine-v0.1',
        '{"activity": {"type": "learning", "completion": 0.5}, "affected_skills": [{"name": "Post Mortem Analysis"}], "xp_semantics": {"base_value": 20, "difficulty": 0.5, "mastery_gain": 0.5, "novelty": 0.5, "goal_alignment": 0.5}, "evidence": {"level": 1}, "mastery_changes": []}'::jsonb
      ) returning id;
    `);
    const assessmentId = assessRes.rows[0].id;

    const settlePayload = {
      assessmentId,
      xpDelta: 20,
      transaction: {
        amount: 20,
        baseAmount: 20,
        skillName: "Post Mortem Analysis",
        activityType: "learning",
        xpType: "activity",
        repetitionCount: 0,
        repetitionPenalty: 1,
        modifierJson: {},
        reason: "Post-mortem analysis",
      },
      primarySkill: {
        name: "Post Mortem Analysis",
        xpDelta: 20,
        masteryAction: { action: "none" },
      },
      player: { xpDelta: 20 },
      questProgressDelta: 50,
      relatedSkillLabels: [],
    };

    const settleRes = await client.query<{ settle_activity: { ok: boolean } }>(`
      select public.settle_activity('${USER_A}'::uuid, $1::jsonb) as settle_activity;
    `, [JSON.stringify(settlePayload)]);

    expect(settleRes.rows[0].settle_activity.ok).toBe(true);

    // Verify Quest remains 'failed' with progress unchanged at 20%
    const questCheck = await client.query<{ progress: number; status: string }>(`
      select progress, status from public.quests where id = '${questId}';
    `);
    expect(questCheck.rows[0].status).toBe("failed");
    expect(Number(questCheck.rows[0].progress)).toBe(20);
  });

  test("P1-3: Multi-level hierarchy (Grandparent -> Parent -> Sibling Children) and concurrent sibling updates roll up authoritatively", async () => {
    // 1. Create Grandparent (Main Quest)
    const gpRes = await client.query<{ id: string }>(`
      insert into public.quests (user_id, title, quest_type, quest_size, is_main_quest, status)
      values ('${USER_A}', 'Grandparent Epic Main Quest', 'production', 'main', true, 'active')
      returning id;
    `);
    const grandparent = gpRes.rows[0].id;

    // 2. Create Parent Quest
    const pRes = await client.query<{ id: string }>(`
      insert into public.quests (user_id, parent_quest_id, title, quest_type, quest_size, status)
      values ('${USER_A}', '${grandparent}', 'Parent Phase 1', 'production', 'major', 'active')
      returning id;
    `);
    const parent = pRes.rows[0].id;

    // 3. Create 4 Children
    const c1Res = await client.query<{ id: string }>(`
      insert into public.quests (user_id, parent_quest_id, title, quest_type, quest_size, status, progress)
      values ('${USER_A}', '${parent}', 'Subtask 1', 'skill', 'standard', 'active', 0)
      returning id;
    `);
    const c2Res = await client.query<{ id: string }>(`
      insert into public.quests (user_id, parent_quest_id, title, quest_type, quest_size, status, progress)
      values ('${USER_A}', '${parent}', 'Subtask 2', 'skill', 'standard', 'active', 0)
      returning id;
    `);
    const c3Res = await client.query<{ id: string }>(`
      insert into public.quests (user_id, parent_quest_id, title, quest_type, quest_size, status, progress)
      values ('${USER_A}', '${parent}', 'Subtask 3', 'skill', 'standard', 'active', 0)
      returning id;
    `);
    const c4Res = await client.query<{ id: string }>(`
      insert into public.quests (user_id, parent_quest_id, title, quest_type, quest_size, status, progress)
      values ('${USER_A}', '${parent}', 'Subtask 4', 'skill', 'standard', 'active', 0)
      returning id;
    `);

    const c1 = c1Res.rows[0].id;
    const c2 = c2Res.rows[0].id;
    const c3 = c3Res.rows[0].id;
    const c4 = c4Res.rows[0].id;

    // 4. Concurrently update all 4 siblings using a pg.Pool to simulate true parallel connections
    const { Pool } = await import("pg");
    const pool = new Pool({ connectionString: DATABASE_URL, max: 4 });
    
    const p1 = pool.query(`update public.quests set progress = 25 where id = '${c1}';`);
    const p2 = pool.query(`update public.quests set progress = 50 where id = '${c2}';`);
    const p3 = pool.query(`update public.quests set progress = 75 where id = '${c3}';`);
    const p4 = pool.query(`update public.quests set progress = 100, status = 'completed' where id = '${c4}';`);
    
    await Promise.all([p1, p2, p3, p4]);

    // Parent avg should be (25 + 50 + 75 + 100) / 4 = 63% (round(62.5))
    const pCheck = await client.query<{ progress: number; status: string }>(`
      select progress, status from public.quests where id = '${parent}';
    `);
    expect(Number(pCheck.rows[0].progress)).toBe(63);
    expect(pCheck.rows[0].status).toBe("active");

    // Grandparent should also roll up to 63%
    const gpCheck = await client.query<{ progress: number; status: string }>(`
      select progress, status from public.quests where id = '${grandparent}';
    `);
    expect(Number(gpCheck.rows[0].progress)).toBe(63);
    expect(gpCheck.rows[0].status).toBe("active");

    // 5. Complete all remaining children
    const p5 = pool.query(`update public.quests set progress = 100, status = 'completed' where id = '${c1}';`);
    const p6 = pool.query(`update public.quests set progress = 100, status = 'completed' where id = '${c2}';`);
    const p7 = pool.query(`update public.quests set progress = 100, status = 'completed' where id = '${c3}';`);
    await Promise.all([p5, p6, p7]);

    await pool.end();

    const pFinal = await client.query<{ progress: number; status: string; completed_at: string | null }>(`
      select progress, status, completed_at from public.quests where id = '${parent}';
    `);
    expect(Number(pFinal.rows[0].progress)).toBe(100);
    expect(pFinal.rows[0].status).toBe("completed");
    expect(pFinal.rows[0].completed_at).not.toBeNull();

    const gpFinal = await client.query<{ progress: number; status: string; completed_at: string | null }>(`
      select progress, status, completed_at from public.quests where id = '${grandparent}';
    `);
    expect(Number(gpFinal.rows[0].progress)).toBe(100);
    expect(gpFinal.rows[0].status).toBe("completed");
    expect(gpFinal.rows[0].completed_at).not.toBeNull();
  });

  test("P1: Cross-tenant SECURITY DEFINER RPC denial (Stage 4.3 Security Closure)", async () => {
    // 1. Create a Quest for User B
    const bRes = await client.query<{ id: string }>(`
      insert into public.quests (user_id, title, quest_type, quest_size, status)
      values ('${USER_B}', 'User B Target', 'learning', 'standard', 'active')
      returning id;
    `);
    const targetQuest = bRes.rows[0].id;

    // 2. User A attempts to call recompute_quest_chain for User B's quest
    await client.query("set role authenticated");
    await client.query("select set_config('request.jwt.claim.sub', $1, false)", [USER_A]);

    // Should receive a permission denied error
    await expect(
      client.query(`select public.recompute_quest_chain('${USER_B}', '${targetQuest}')`)
    ).rejects.toThrow(/permission denied/i);

    await client.query("reset role");
  });
});
