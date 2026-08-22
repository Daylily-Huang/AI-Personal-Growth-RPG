import { describe, expect, test, beforeAll, afterAll } from "vitest";
import { Client } from "pg";

const DATABASE_URL = process.env.XP_RPG_TEST_DB_URL ?? "postgresql://postgres:postgres@127.0.0.1:54322/postgres";

const USER_A = "11111111-aaaa-4aaa-aaaa-aaaaaaaaaaaa";
const USER_B = "22222222-bbbb-4bbb-bbbb-bbbbbbbbbbbb";

describe("Stage 5A — Skill Graph, Tenant Integrity & Evidence Authority (Live PostgreSQL)", () => {
  let client: Client;

  beforeAll(async () => {
    client = new Client({ connectionString: DATABASE_URL });
    await client.connect();

    // Seed test users in auth.users and profiles
    await client.query(`
      insert into auth.users (id, email) values
        ('${USER_A}', 'stage5a_user_a@growth.rpg'),
        ('${USER_B}', 'stage5a_user_b@growth.rpg')
      on conflict (id) do nothing;
      insert into public.profiles (user_id, display_name) values
        ('${USER_A}', 'Stage5AUserA'),
        ('${USER_B}', 'Stage5AUserB')
      on conflict (user_id) do nothing;
      insert into public.player_states (user_id, total_xp, player_level) values
        ('${USER_A}', 0, 1),
        ('${USER_B}', 0, 1)
      on conflict (user_id) do nothing;
    `);
  });

  afterAll(async () => {
    if (client) {
      await client.query("reset role;");
      await client.query(`
        delete from public.skill_edges where user_id in ('${USER_A}', '${USER_B}');
        delete from public.mastery_events where user_id in ('${USER_A}', '${USER_B}');
        delete from public.mastery_verifications where user_id in ('${USER_A}', '${USER_B}');
        delete from public.evidence_records where user_id in ('${USER_A}', '${USER_B}');
        delete from public.xp_transactions where user_id in ('${USER_A}', '${USER_B}');
        delete from public.ai_assessments where user_id in ('${USER_A}', '${USER_B}');
        delete from public.activities where user_id in ('${USER_A}', '${USER_B}');
        delete from public.skills where user_id in ('${USER_A}', '${USER_B}');
        delete from public.domains where user_id in ('${USER_A}', '${USER_B}');
      `);
      await client.end();
    }
  });

  test("1. Composite FK: Cross-tenant edge source is rejected by database engine", async () => {
    const skillARes = await client.query<{ id: string }>(`
      insert into public.skills (user_id, name) values ('${USER_A}', 'User A Skill 1') returning id;
    `);
    const skillBRes = await client.query<{ id: string }>(`
      insert into public.skills (user_id, name) values ('${USER_B}', 'User B Skill 1') returning id;
    `);
    const skillAId = skillARes.rows[0].id;
    const skillBId = skillBRes.rows[0].id;

    // User A tries to create an edge using User B's skill as source
    await expect(
      client.query(`
        insert into public.skill_edges (user_id, source_skill_id, target_skill_id, relation_type)
        values ('${USER_A}', '${skillBId}', '${skillAId}', 'prerequisite');
      `),
    ).rejects.toThrow();
  });

  test("2. Composite FK: Cross-tenant edge target is rejected by database engine", async () => {
    const skillARes = await client.query<{ id: string }>(`
      insert into public.skills (user_id, name) values ('${USER_A}', 'User A Skill 2') returning id;
    `);
    const skillBRes = await client.query<{ id: string }>(`
      insert into public.skills (user_id, name) values ('${USER_B}', 'User B Skill 2') returning id;
    `);
    const skillAId = skillARes.rows[0].id;
    const skillBId = skillBRes.rows[0].id;

    // User A tries to create an edge pointing to User B's skill as target
    await expect(
      client.query(`
        insert into public.skill_edges (user_id, source_skill_id, target_skill_id, relation_type)
        values ('${USER_A}', '${skillAId}', '${skillBId}', 'prerequisite');
      `),
    ).rejects.toThrow();
  });

  test("3. Composite FK: Cross-tenant domain binding is rejected by database engine", async () => {
    const domainBRes = await client.query<{ id: string }>(`
      insert into public.domains (user_id, name, slug) values ('${USER_B}', 'User B Domain', 'user-b-domain') returning id;
    `);
    const domainBId = domainBRes.rows[0].id;

    // User A tries to bind User B's domain
    await expect(
      client.query(`
        insert into public.skills (user_id, name, domain_id) values ('${USER_A}', 'User A Rogue Skill', '${domainBId}');
      `),
    ).rejects.toThrow();
  });

  test("4. Column-Specific SET NULL: Deleting parent domain sets child.parent_id = NULL without altering child.user_id", async () => {
    const parentRes = await client.query<{ id: string }>(`
      insert into public.domains (user_id, name, slug) values ('${USER_A}', 'Parent Domain', 'parent-domain-1') returning id;
    `);
    const parentId = parentRes.rows[0].id;

    const childRes = await client.query<{ id: string }>(`
      insert into public.domains (user_id, name, slug, parent_id)
      values ('${USER_A}', 'Child Domain', 'child-domain-1', '${parentId}')
      returning id;
    `);
    const childId = childRes.rows[0].id;

    await client.query(`delete from public.domains where id = '${parentId}';`);

    const checkRes = await client.query<{ parent_id: string | null; user_id: string }>(`
      select parent_id, user_id from public.domains where id = '${childId}';
    `);
    expect(checkRes.rows.length).toBe(1);
    expect(checkRes.rows[0].parent_id).toBeNull();
    expect(checkRes.rows[0].user_id).toBe(USER_A);
  });

  test("5. Column-Specific SET NULL: Deleting domain sets skill.domain_id = NULL without altering skill.user_id", async () => {
    const domainRes = await client.query<{ id: string }>(`
      insert into public.domains (user_id, name, slug) values ('${USER_A}', 'Skill Domain Test', 'skill-domain-test') returning id;
    `);
    const domainId = domainRes.rows[0].id;

    const skillRes = await client.query<{ id: string }>(`
      insert into public.skills (user_id, name, domain_id)
      values ('${USER_A}', 'Skill Bound to Domain', '${domainId}')
      returning id;
    `);
    const skillId = skillRes.rows[0].id;

    await client.query(`delete from public.domains where id = '${domainId}';`);

    const checkRes = await client.query<{ domain_id: string | null; user_id: string }>(`
      select domain_id, user_id from public.skills where id = '${skillId}';
    `);
    expect(checkRes.rows.length).toBe(1);
    expect(checkRes.rows[0].domain_id).toBeNull();
    expect(checkRes.rows[0].user_id).toBe(USER_A);
  });

  test("6. Column-Specific SET NULL: Deleting skill sets evidence.skill_id = NULL without altering evidence.user_id", async () => {
    const skillRes = await client.query<{ id: string }>(`
      insert into public.skills (user_id, name) values ('${USER_A}', 'Skill to Delete For Evidence') returning id;
    `);
    const skillId = skillRes.rows[0].id;

    const evRes = await client.query<{ id: string }>(`
      insert into public.evidence_records (user_id, skill_id, evidence_level, description)
      values ('${USER_A}', '${skillId}', 3, 'Sample evidence')
      returning id;
    `);
    const evId = evRes.rows[0].id;

    await client.query(`delete from public.skills where id = '${skillId}';`);

    const checkRes = await client.query<{ skill_id: string | null; user_id: string }>(`
      select skill_id, user_id from public.evidence_records where id = '${evId}';
    `);
    expect(checkRes.rows.length).toBe(1);
    expect(checkRes.rows[0].skill_id).toBeNull();
    expect(checkRes.rows[0].user_id).toBe(USER_A);
  });

  test("7. Single-Parent Contains Invariant: Rejects second contains edge for target", async () => {
    const p1Res = await client.query<{ id: string }>(`insert into public.skills (user_id, name) values ('${USER_A}', 'P1') returning id;`);
    const p2Res = await client.query<{ id: string }>(`insert into public.skills (user_id, name) values ('${USER_A}', 'P2') returning id;`);
    const cRes = await client.query<{ id: string }>(`insert into public.skills (user_id, name) values ('${USER_A}', 'ChildSkill') returning id;`);

    // P1 contains Child -> OK
    await client.query(`
      insert into public.skill_edges (user_id, source_skill_id, target_skill_id, relation_type)
      values ('${USER_A}', '${p1Res.rows[0].id}', '${cRes.rows[0].id}', 'contains');
    `);

    // P2 contains Child -> MUST FAIL (partial unique index)
    await expect(
      client.query(`
        insert into public.skill_edges (user_id, source_skill_id, target_skill_id, relation_type)
        values ('${USER_A}', '${p2Res.rows[0].id}', '${cRes.rows[0].id}', 'contains');
      `),
    ).rejects.toThrow();
  });

  test("8. Anti-Cycle DAG: Prerequisite cycle is rejected by trigger", async () => {
    const s1Res = await client.query<{ id: string }>(`insert into public.skills (user_id, name) values ('${USER_A}', 'DAG1') returning id;`);
    const s2Res = await client.query<{ id: string }>(`insert into public.skills (user_id, name) values ('${USER_A}', 'DAG2') returning id;`);
    const s3Res = await client.query<{ id: string }>(`insert into public.skills (user_id, name) values ('${USER_A}', 'DAG3') returning id;`);
    const s1 = s1Res.rows[0].id;
    const s2 = s2Res.rows[0].id;
    const s3 = s3Res.rows[0].id;

    // DAG1 -> DAG2
    await client.query(`insert into public.skill_edges (user_id, source_skill_id, target_skill_id, relation_type) values ('${USER_A}', '${s1}', '${s2}', 'prerequisite');`);
    // DAG2 -> DAG3
    await client.query(`insert into public.skill_edges (user_id, source_skill_id, target_skill_id, relation_type) values ('${USER_A}', '${s2}', '${s3}', 'prerequisite');`);

    // DAG3 -> DAG1 (Cycle!)
    await expect(
      client.query(`insert into public.skill_edges (user_id, source_skill_id, target_skill_id, relation_type) values ('${USER_A}', '${s3}', '${s1}', 'prerequisite');`),
    ).rejects.toThrow(/Cycle detected/i);
  });

  test("9. Anti-Cycle DAG: Contains cycle is rejected by trigger", async () => {
    const c1Res = await client.query<{ id: string }>(`insert into public.skills (user_id, name) values ('${USER_A}', 'TreeFolderA') returning id;`);
    const c2Res = await client.query<{ id: string }>(`insert into public.skills (user_id, name) values ('${USER_A}', 'TreeFolderB') returning id;`);
    const c1 = c1Res.rows[0].id;
    const c2 = c2Res.rows[0].id;

    // A contains B
    await client.query(`insert into public.skill_edges (user_id, source_skill_id, target_skill_id, relation_type) values ('${USER_A}', '${c1}', '${c2}', 'contains');`);

    // B contains A (Cycle!)
    await expect(
      client.query(`insert into public.skill_edges (user_id, source_skill_id, target_skill_id, relation_type) values ('${USER_A}', '${c2}', '${c1}', 'contains');`),
    ).rejects.toThrow(/Cycle detected/i);
  });

  test("10. Concurrent DAG Race: Two parallel transactions inserting A->B and B->A cannot form a cycle", async () => {
    const nodeARes = await client.query<{ id: string }>(`insert into public.skills (user_id, name) values ('${USER_A}', 'RaceNodeA') returning id;`);
    const nodeBRes = await client.query<{ id: string }>(`insert into public.skills (user_id, name) values ('${USER_A}', 'RaceNodeB') returning id;`);
    const a = nodeARes.rows[0].id;
    const b = nodeBRes.rows[0].id;

    const client1 = new Client({ connectionString: DATABASE_URL });
    const client2 = new Client({ connectionString: DATABASE_URL });
    await client1.connect();
    await client2.connect();

    try {
      const results = await Promise.allSettled([
        (async () => {
          await client1.query("BEGIN;");
          await client1.query(`
            insert into public.skill_edges (user_id, source_skill_id, target_skill_id, relation_type)
            values ('${USER_A}', '${a}', '${b}', 'prerequisite');
          `);
          await new Promise((r) => setTimeout(r, 50));
          await client1.query("COMMIT;");
        })(),
        (async () => {
          await client2.query("BEGIN;");
          await client2.query(`
            insert into public.skill_edges (user_id, source_skill_id, target_skill_id, relation_type)
            values ('${USER_A}', '${b}', '${a}', 'prerequisite');
          `);
          await new Promise((r) => setTimeout(r, 50));
          await client2.query("COMMIT;");
        })(),
      ]);

      const fulfilled = results.filter((r) => r.status === "fulfilled").length;
      const rejected = results.filter((r) => r.status === "rejected").length;

      // Exactly one must succeed and one must fail (due to cycle detection under advisory lock)
      expect(fulfilled).toBe(1);
      expect(rejected).toBe(1);

      // Verify DB contains exactly 1 edge and NO cycles
      const edgeCount = await client.query<{ count: string }>(`
        select count(*) from public.skill_edges
        where user_id = '${USER_A}' and relation_type = 'prerequisite'
          and ((source_skill_id = '${a}' and target_skill_id = '${b}') or (source_skill_id = '${b}' and target_skill_id = '${a}'));
      `);
      expect(Number(edgeCount.rows[0].count)).toBe(1);
    } finally {
      await client1.end();
      await client2.end();
    }
  });

  test("11. Supports relation allows mutual synergy edges (A -> B and B -> A)", async () => {
    const syn1Res = await client.query<{ id: string }>(`insert into public.skills (user_id, name) values ('${USER_A}', 'Syn1') returning id;`);
    const syn2Res = await client.query<{ id: string }>(`insert into public.skills (user_id, name) values ('${USER_A}', 'Syn2') returning id;`);
    const syn1 = syn1Res.rows[0].id;
    const syn2 = syn2Res.rows[0].id;

    await client.query(`insert into public.skill_edges (user_id, source_skill_id, target_skill_id, relation_type) values ('${USER_A}', '${syn1}', '${syn2}', 'supports');`);
    const res = await client.query(`insert into public.skill_edges (user_id, source_skill_id, target_skill_id, relation_type) values ('${USER_A}', '${syn2}', '${syn1}', 'supports') returning id;`);
    expect(res.rows.length).toBe(1);
  });

  test("12. Self-edge and Duplicate edge are rejected", async () => {
    const sRes = await client.query<{ id: string }>(`insert into public.skills (user_id, name) values ('${USER_A}', 'SelfEdgeTest') returning id;`);
    const sId = sRes.rows[0].id;

    await expect(
      client.query(`insert into public.skill_edges (user_id, source_skill_id, target_skill_id, relation_type) values ('${USER_A}', '${sId}', '${sId}', 'supports');`),
    ).rejects.toThrow();

    const otherRes = await client.query<{ id: string }>(`insert into public.skills (user_id, name) values ('${USER_A}', 'OtherEdgeTest') returning id;`);
    const otherId = otherRes.rows[0].id;

    await client.query(`insert into public.skill_edges (user_id, source_skill_id, target_skill_id, relation_type) values ('${USER_A}', '${sId}', '${otherId}', 'supports');`);
    await expect(
      client.query(`insert into public.skill_edges (user_id, source_skill_id, target_skill_id, relation_type) values ('${USER_A}', '${sId}', '${otherId}', 'supports');`),
    ).rejects.toThrow();
  });

  test("13. settle_activity: Primary existing stable-ID resolution binds directly to specified UUID without creating new skill", async () => {
    // 1. Create a skill named "TypeScript"
    const skillRes = await client.query<{ id: string }>(`
      insert into public.skills (user_id, name) values ('${USER_A}', 'TypeScript') returning id;
    `);
    const skillId = skillRes.rows[0].id;

    // 2. Create activity & assessment
    const actRes = await client.query<{ id: string }>(`
      insert into public.activities (user_id, title, raw_input, rules_version, status)
      values ('${USER_A}', 'TS Practice', 'TS Practice', 'v1', 'pending_assessment') returning id;
    `);
    const actId = actRes.rows[0].id;

    const assessRes = await client.query<{ id: string }>(`
      insert into public.ai_assessments (user_id, activity_id, rules_version, status, assessment_json)
      values ('${USER_A}', '${actId}', 'v1', 'pending', '{"confidence": 0.9}'::jsonb) returning id;
    `);
    const assessId = assessRes.rows[0].id;

    // 3. Settle using display label "TS Advanced" but with resolution: "existing" and skillId: skillId
    const settlePayload = {
      assessmentId: assessId,
      xpDelta: 40,
      transaction: {
        amount: 40,
        baseAmount: 40,
        skillName: "TS Advanced",
        activityType: "learning",
        xpType: "activity",
        repetitionCount: 0,
        repetitionPenalty: 1,
        modifierJson: {},
        reason: "TS Practice",
      },
      primarySkill: {
        skill: { resolution: "existing", skillId },
        name: "TS Advanced",
        xpDelta: 40,
        masteryAction: { action: "none" },
      },
      player: { xpDelta: 40 },
    };

    const res = await client.query<{ settle_activity: { ok: boolean; skillId: string } }>(`
      select public.settle_activity('${USER_A}'::uuid, $1::jsonb) as settle_activity;
    `, [JSON.stringify(settlePayload)]);

    expect(res.rows[0].settle_activity.ok).toBe(true);
    expect(res.rows[0].settle_activity.skillId).toBe(skillId);

    // Verify skill XP increased on the existing skill
    const skillCheck = await client.query<{ xp: number }>(`
      select xp from public.skills where id = '${skillId}';
    `);
    expect(Number(skillCheck.rows[0].xp)).toBe(40);
  });

  test("14. settle_activity: Missing or invalid SkillResolutionInput is rejected", async () => {
    const actRes = await client.query<{ id: string }>(`
      insert into public.activities (user_id, title, raw_input, rules_version, status)
      values ('${USER_A}', 'Bypass Test', 'Bypass Test', 'v1', 'pending_assessment') returning id;
    `);
    const actId = actRes.rows[0].id;

    const assessRes = await client.query<{ id: string }>(`
      insert into public.ai_assessments (user_id, activity_id, rules_version, status, assessment_json)
      values ('${USER_A}', '${actId}', 'v1', 'pending', '{"confidence": 0.9}'::jsonb) returning id;
    `);
    const assessId = assessRes.rows[0].id;

    // Missing skill resolution object
    const settlePayload = {
      assessmentId: assessId,
      xpDelta: 20,
      transaction: {
        amount: 20,
        baseAmount: 20,
        skillName: "Untracked Skill",
        activityType: "learning",
        xpType: "activity",
        repetitionCount: 0,
        repetitionPenalty: 1,
        modifierJson: {},
        reason: "Bypass Test",
      },
      primarySkill: {
        name: "Untracked Skill",
        xpDelta: 20,
        masteryAction: { action: "none" },
      },
      player: { xpDelta: 20 },
    };

    const res = await client.query<{ settle_activity: { ok: boolean; reason: string } }>(`
      select public.settle_activity('${USER_A}'::uuid, $1::jsonb) as settle_activity;
    `, [JSON.stringify(settlePayload)]);

    expect(res.rows[0].settle_activity.ok).toBe(false);
    expect(res.rows[0].settle_activity.reason).toBe("missing_or_invalid_skill_resolution");
  });

  test("15. settle_activity: Secondary existing resolution validates ownership", async () => {
    // User B's skill
    const skillBRes = await client.query<{ id: string }>(`
      insert into public.skills (user_id, name) values ('${USER_B}', 'Secret B Skill') returning id;
    `);
    const foreignSkillId = skillBRes.rows[0].id;

    const actRes = await client.query<{ id: string }>(`
      insert into public.activities (user_id, title, raw_input, rules_version, status)
      values ('${USER_A}', 'Cross Sec Test', 'Cross Sec Test', 'v1', 'pending_assessment') returning id;
    `);
    const actId = actRes.rows[0].id;

    const assessRes = await client.query<{ id: string }>(`
      insert into public.ai_assessments (user_id, activity_id, rules_version, status, assessment_json)
      values ('${USER_A}', '${actId}', 'v1', 'pending', '{"confidence": 0.9}'::jsonb) returning id;
    `);
    const assessId = assessRes.rows[0].id;

    // User A attempts settlement referencing User B's skill as secondary
    const settlePayload = {
      assessmentId: assessId,
      xpDelta: 25,
      transaction: {
        amount: 25,
        baseAmount: 25,
        skillName: "Valid Primary",
        activityType: "learning",
        xpType: "activity",
        repetitionCount: 0,
        repetitionPenalty: 1,
        modifierJson: {},
        reason: "Cross Sec Test",
      },
      primarySkill: {
        skill: { resolution: "create", proposedName: "Valid Primary" },
        name: "Valid Primary",
        xpDelta: 25,
        masteryAction: { action: "none" },
      },
      relatedSkillResolutions: [
        { resolution: "existing", skillId: foreignSkillId },
      ],
      player: { xpDelta: 25 },
    };

    const res = await client.query<{ settle_activity: { ok: boolean; reason: string } }>(`
      select public.settle_activity('${USER_A}'::uuid, $1::jsonb) as settle_activity;
    `, [JSON.stringify(settlePayload)]);

    expect(res.rows[0].settle_activity.ok).toBe(false);
    expect(res.rows[0].settle_activity.reason).toBe("related_skill_not_found_or_not_owned");
  });

  test("16. settle_activity: Evidence persistence and mastery_events.evidence_id linkage", async () => {
    const actRes = await client.query<{ id: string }>(`
      insert into public.activities (user_id, title, raw_input, rules_version, status)
      values ('${USER_A}', 'Evidence Settle', 'Evidence Settle', 'v1', 'pending_assessment') returning id;
    `);
    const actId = actRes.rows[0].id;

    const assessRes = await client.query<{ id: string }>(`
      insert into public.ai_assessments (user_id, activity_id, rules_version, status, assessment_json)
      values ('${USER_A}', '${actId}', 'v1', 'pending', '{"confidence": 0.95}'::jsonb) returning id;
    `);
    const assessId = assessRes.rows[0].id;

    const settlePayload = {
      assessmentId: assessId,
      xpDelta: 50,
      transaction: {
        amount: 50,
        baseAmount: 50,
        skillName: "EvidenceSkill",
        activityType: "production",
        xpType: "activity",
        repetitionCount: 0,
        repetitionPenalty: 1,
        modifierJson: {},
        reason: "Evidence Settle",
      },
      primarySkill: {
        skill: { resolution: "create", proposedName: "EvidenceSkill" },
        name: "EvidenceSkill",
        xpDelta: 50,
        masteryAction: { action: "upgrade", proposedLevel: 3, confidence: 0.95 },
      },
      evidence: {
        level: 3,
        type: "production",
        explanation: "Verified high-quality artifact",
      },
      player: { xpDelta: 50 },
    };

    const res = await client.query<{ settle_activity: { ok: boolean; skillId: string } }>(`
      select public.settle_activity('${USER_A}'::uuid, $1::jsonb) as settle_activity;
    `, [JSON.stringify(settlePayload)]);

    expect(res.rows[0].settle_activity.ok).toBe(true);
    const skillId = res.rows[0].settle_activity.skillId;

    // Verify Evidence Record persisted
    const evRows = await client.query<{ id: string; evidence_level: number; verified: boolean }>(`
      select id, evidence_level, verified from public.evidence_records
      where user_id = '${USER_A}' and activity_id = '${actId}';
    `);
    expect(evRows.rows.length).toBe(1);
    expect(evRows.rows[0].evidence_level).toBe(3);
    expect(evRows.rows[0].verified).toBe(true);

    // Verify mastery_events.evidence_id links to evidence record
    const eventRows = await client.query<{ evidence_id: string; to_level: number }>(`
      select evidence_id, to_level from public.mastery_events
      where user_id = '${USER_A}' and skill_id = '${skillId}';
    `);
    expect(eventRows.rows.length).toBe(1);
    expect(eventRows.rows[0].evidence_id).toBe(evRows.rows[0].id);
    expect(eventRows.rows[0].to_level).toBe(3);
  });

  test("17. update_skill_metadata RPC: Alias conservation, normalized conflict, cross-domain check & PATCH null semantics", async () => {
    // 1. Create skill & domain
    const dRes = await client.query<{ id: string }>(`
      insert into public.domains (user_id, name, slug) values ('${USER_A}', 'Engineering', 'engineering') returning id;
    `);
    const domainId = dRes.rows[0].id;

    const sRes = await client.query<{ id: string }>(`
      insert into public.skills (user_id, name, description, domain_id)
      values ('${USER_A}', 'Python Basics', 'Initial desc', '${domainId}') returning id;
    `);
    const skillId = sRes.rows[0].id;

    // 2. Rename skill to 'Python Advanced' -> old name 'Python Basics' must be added to aliases
    const renameRes = await client.query<{ update_skill_metadata: { name: string; aliases: string[]; description: string; domain_id: string } }>(`
      select to_jsonb(public.update_skill_metadata(
        '${skillId}'::uuid,
        jsonb_build_object('name', 'Python Advanced', 'user_id', '${USER_A}')
      )) as update_skill_metadata;
    `);
    expect(renameRes.rows[0].update_skill_metadata.name).toBe("Python Advanced");
    expect(renameRes.rows[0].update_skill_metadata.aliases).toContain("Python Basics");
    expect(renameRes.rows[0].update_skill_metadata.description).toBe("Initial desc"); // Omitted description untouched!
    expect(renameRes.rows[0].update_skill_metadata.domain_id).toBe(domainId); // Omitted domain_id untouched!

    // 3. Explicit null for domain_id -> domain_id becomes NULL
    const clearDomainRes = await client.query<{ update_skill_metadata: { domain_id: string | null; name: string } }>(`
      select to_jsonb(public.update_skill_metadata(
        '${skillId}'::uuid,
        jsonb_build_object('domain_id', null, 'user_id', '${USER_A}')
      )) as update_skill_metadata;
    `);
    expect(clearDomainRes.rows[0].update_skill_metadata.domain_id).toBeNull();
    expect(clearDomainRes.rows[0].update_skill_metadata.name).toBe("Python Advanced"); // Name untouched

    // 4. Cross-tenant domain -> MUST FAIL
    const domainBRes = await client.query<{ id: string }>(`
      insert into public.domains (user_id, name, slug) values ('${USER_B}', 'Foreign Domain', 'foreign-domain') returning id;
    `);
    await expect(
      client.query(`
        select public.update_skill_metadata(
          '${skillId}'::uuid,
          jsonb_build_object('domain_id', '${domainBRes.rows[0].id}', 'user_id', '${USER_A}')
        );
      `),
    ).rejects.toThrow(/cross-tenant domain access denied/i);
  });

  test("18. Direct UPDATE on public.skills by authenticated user is DENIED", async () => {
    const sRes = await client.query<{ id: string }>(`
      insert into public.skills (user_id, name) values ('${USER_A}', 'DirectUpdateTarget') returning id;
    `);
    const skillId = sRes.rows[0].id;

    // Simulate authenticated role
    await client.query(`set role authenticated; set local "request.jwt.claim.sub" = '${USER_A}';`);

    try {
      await expect(
        client.query(`update public.skills set xp = 9999 where id = '${skillId}';`),
      ).rejects.toThrow(/permission denied for table skills/i);
    } finally {
      await client.query("reset role;");
    }
  });
});
