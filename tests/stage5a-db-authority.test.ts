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
    // User A skill & User B skill
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
    ).rejects.toThrow(); // foreign key constraint violation
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
    // User B domain
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

    // Delete parent domain
    await client.query(`delete from public.domains where id = '${parentId}';`);

    // Verify child domain
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

    // Delete domain
    await client.query(`delete from public.domains where id = '${domainId}';`);

    // Verify skill
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

    // Delete skill
    await client.query(`delete from public.skills where id = '${skillId}';`);

    // Verify evidence record
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

  test("9. Supports relation allows mutual synergy edges (A -> B and B -> A)", async () => {
    const syn1Res = await client.query<{ id: string }>(`insert into public.skills (user_id, name) values ('${USER_A}', 'Syn1') returning id;`);
    const syn2Res = await client.query<{ id: string }>(`insert into public.skills (user_id, name) values ('${USER_A}', 'Syn2') returning id;`);
    const syn1 = syn1Res.rows[0].id;
    const syn2 = syn2Res.rows[0].id;

    // Syn1 supports Syn2
    await client.query(`insert into public.skill_edges (user_id, source_skill_id, target_skill_id, relation_type) values ('${USER_A}', '${syn1}', '${syn2}', 'supports');`);
    // Syn2 supports Syn1 (Mutual allowed!)
    const res = await client.query(`insert into public.skill_edges (user_id, source_skill_id, target_skill_id, relation_type) values ('${USER_A}', '${syn2}', '${syn1}', 'supports') returning id;`);
    expect(res.rows.length).toBe(1);
  });

  test("10. Self-edge and Duplicate edge are rejected", async () => {
    const sRes = await client.query<{ id: string }>(`insert into public.skills (user_id, name) values ('${USER_A}', 'SelfEdgeTest') returning id;`);
    const sId = sRes.rows[0].id;

    // Self-edge -> check constraint violation
    await expect(
      client.query(`insert into public.skill_edges (user_id, source_skill_id, target_skill_id, relation_type) values ('${USER_A}', '${sId}', '${sId}', 'supports');`),
    ).rejects.toThrow();

    const otherRes = await client.query<{ id: string }>(`insert into public.skills (user_id, name) values ('${USER_A}', 'OtherEdgeTest') returning id;`);
    const otherId = otherRes.rows[0].id;

    await client.query(`insert into public.skill_edges (user_id, source_skill_id, target_skill_id, relation_type) values ('${USER_A}', '${sId}', '${otherId}', 'supports');`);
    // Duplicate -> unique constraint violation
    await expect(
      client.query(`insert into public.skill_edges (user_id, source_skill_id, target_skill_id, relation_type) values ('${USER_A}', '${sId}', '${otherId}', 'supports');`),
    ).rejects.toThrow();
  });
});
