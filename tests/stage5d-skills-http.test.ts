import http from "node:http";
import crypto from "node:crypto";
import next from "next";
import { describe, expect, test, beforeAll, afterAll } from "vitest";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";

const DATABASE_URL = process.env.XP_RPG_TEST_DB_URL;
const TEST_PORT = 3096;
const BASE_URL = `http://127.0.0.1:${TEST_PORT}`;

const DEFAULT_LOCAL_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0";
const DEFAULT_LOCAL_SERVICE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU";
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "http://127.0.0.1:54321";
const SUPABASE_PUBLISHABLE_KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || DEFAULT_LOCAL_ANON_KEY;

// Same pattern as e2e-http-browser.test.ts: the in-process Next server needs the
// local stack credentials even when the outer vitest process was started bare.
process.env.NEXT_PUBLIC_SUPABASE_URL = SUPABASE_URL;
process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = SUPABASE_PUBLISHABLE_KEY;
process.env.SUPABASE_SECRET_KEY = process.env.SUPABASE_SECRET_KEY || DEFAULT_LOCAL_SERVICE_KEY;

// Trusted test setup only (seeding cross-tenant domain fixtures); never used for
// the assertions themselves, which go through the real HTTP API.
const adminClient = createClient<Database>(SUPABASE_URL, process.env.SUPABASE_SECRET_KEY!);

function createCookieJar() {
  const store = new Map<string, string>();
  const client = createServerClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    cookies: {
      getAll() {
        return Array.from(store.entries()).map(([name, value]) => ({ name, value }));
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => {
          if (!value) store.delete(name);
          else store.set(name, value);
        });
      },
    },
  });
  return {
    client,
    getCookieHeader() {
      return Array.from(store.entries()).map(([k, v]) => `${k}=${v}`).join("; ");
    },
    mergeFromResponse(res: Response) {
      const setCookies = res.headers.getSetCookie ? res.headers.getSetCookie() : [];
      setCookies.forEach((cookieStr) => {
        const [part] = cookieStr.split(";");
        const [name, ...val] = part.split("=");
        if (name) {
          const v = val.join("=");
          if (cookieStr.includes("Max-Age=0") || !v) store.delete(name.trim());
          else store.set(name.trim(), v);
        }
      });
    },
  };
}

type Jar = ReturnType<typeof createCookieJar>;

async function api(jar: Jar, path: string, init: RequestInit = {}): Promise<Response> {
  const res = await fetch(`${BASE_URL}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      Cookie: jar.getCookieHeader(),
      ...(init.headers || {}),
    },
  });
  jar.mergeFromResponse(res);
  return res;
}

async function settleSkill(jar: Jar, rawInput: string): Promise<{ id: string; name: string }> {
  const r1 = await api(jar, "/api/activities", {
    method: "POST",
    body: JSON.stringify({ rawInput, totalMinutes: 60, effectiveMinutes: 50 }),
  });
  expect(r1.status).toBe(201);
  const { activity } = await r1.json();
  const r2 = await api(jar, `/api/activities/${activity.id}/assess`, { method: "POST" });
  expect(r2.status).toBe(200);
  const { assessment } = await r2.json();
  const r3 = await api(jar, `/api/assessments/${assessment.id}/confirm`, { method: "POST" });
  expect(r3.status).toBe(200);
  const { transaction } = await r3.json();
  return { id: transaction.skillId, name: transaction.skillName ?? transaction.reason };
}

describe.skipIf(!DATABASE_URL)("Stage 5D — Skills HTTP Integration, Tenant Isolation & 5C Production Path (Live)", () => {
  let app: ReturnType<typeof next>;
  let server: http.Server;
  let userA: Jar;
  let userB: Jar;
  const emailA = `stage5d_a_${Date.now()}@growth.rpg`;
  const emailB = `stage5d_b_${Date.now()}@growth.rpg`;
  const password = "Password123!Safe";

  let skillA1: { id: string; name: string };
  let skillA2: { id: string; name: string };
  let skillA3: { id: string; name: string };
  let skillB1: { id: string; name: string };
  let edgeAId: string;

  beforeAll(async () => {
    app = next({ dev: false, hostname: "127.0.0.1", port: TEST_PORT, dir: process.cwd() });
    await app.prepare();
    const handle = app.getRequestHandler();
    server = http.createServer((req, res) => handle(req, res));
    await new Promise<void>((resolve) => server.listen(TEST_PORT, "127.0.0.1", () => resolve()));

    userA = createCookieJar();
    userB = createCookieJar();
    for (const [jar, email] of [
      [userA, emailA],
      [userB, emailB],
    ] as const) {
      const { error } = await jar.client.auth.signUp({ email, password });
      expect(error).toBeNull();
    }

    // Deterministic fallback assessor keywords: python/代码→Programming, 统计→Statistics, 论文/写作→Academic Writing
    skillA1 = await settleSkill(userA, "Python 代码工程训练，独立完成数据处理工具");
    skillA2 = await settleSkill(userA, "统计回归分析实际应用，独立完成建模报告");
    skillA3 = await settleSkill(userA, "论文写作专项：方法论实际应用进毕业论文初稿");
    skillB1 = await settleSkill(userB, "Python 代码练习：B 用户自己的编程活动");
  }, 60000);

  afterAll(async () => {
    if (server) await new Promise<void>((resolve) => server.close(() => resolve()));
    if (app) await app.close();
  });

  test("unauthenticated requests hit 401 on every skills endpoint before any parsing", async () => {
    const uuid = crypto.randomUUID();
    expect((await fetch(`${BASE_URL}/api/skills`)).status).toBe(401);
    expect((await fetch(`${BASE_URL}/api/skills/${uuid}`)).status).toBe(401);
    expect(
      (await fetch(`${BASE_URL}/api/skills/${uuid}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "X" }),
      })).status,
    ).toBe(401);
    expect(
      (await fetch(`${BASE_URL}/api/skills/edges`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sourceSkillId: uuid, targetSkillId: uuid, relationType: "supports" }),
      })).status,
    ).toBe(401);
    expect((await fetch(`${BASE_URL}/api/skills/edges/${uuid}`, { method: "DELETE" })).status).toBe(401);
  });

  test("malformed UUID / query / body -> 400 (authenticated)", async () => {
    expect((await api(userA, "/api/skills/not-a-uuid")).status).toBe(400);
    expect((await api(userA, "/api/skills?domainId=not-a-uuid")).status).toBe(400);
    expect((await api(userA, "/api/skills?status=banana")).status).toBe(400);
    expect(
      (await api(userA, `/api/skills/${crypto.randomUUID()}`, {
        method: "PATCH",
        body: "{broken",
      })).status,
    ).toBe(400);
    expect(
      (await api(userA, "/api/skills/edges", {
        method: "POST",
        body: JSON.stringify({ sourceSkillId: "nope", targetSkillId: skillA1.id, relationType: "supports" }),
      })).status,
    ).toBe(400);
    expect((await api(userA, `/api/skills/edges/not-a-uuid`, { method: "DELETE" })).status).toBe(400);
  });

  test("graph isolation: each user's /api/skills contains only their own skills", async () => {
    const resA = await api(userA, "/api/skills?status=all");
    expect(resA.status).toBe(200);
    const graphA = await resA.json();
    const idsA = graphA.nodes.map((n: { id: string }) => n.id);
    expect(idsA).toContain(skillA1.id);
    expect(idsA).not.toContain(skillB1.id);

    const resB = await api(userB, "/api/skills?status=all");
    expect(resB.status).toBe(200);
    const graphB = await resB.json();
    const idsB = graphB.nodes.map((n: { id: string }) => n.id);
    expect(idsB).toContain(skillB1.id);
    expect(idsB).not.toContain(skillA1.id);
    expect(idsB).not.toContain(skillA2.id);
    expect(idsB).not.toContain(skillA3.id);
    expect(graphB.nodes).toHaveLength(1);
  });

  test("valid but nonexistent domainId filter -> 200 empty graph (not 404/500)", async () => {
    const res = await api(userA, `/api/skills?domainId=${crypto.randomUUID()}`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.nodes).toHaveLength(0);
    expect(body.edges).toHaveLength(0);
  });

  test("User B cannot read / mutate / reference User A's skills over HTTP", async () => {
    // read -> 404
    expect((await api(userB, `/api/skills/${skillA1.id}`)).status).toBe(404);
    // mutate -> 404
    expect(
      (await api(userB, `/api/skills/${skillA1.id}`, {
        method: "PATCH",
        body: JSON.stringify({ name: "Hijacked" }),
      })).status,
    ).toBe(404);
    // reference as edge source or target -> 400
    expect(
      (await api(userB, "/api/skills/edges", {
        method: "POST",
        body: JSON.stringify({ sourceSkillId: skillA1.id, targetSkillId: skillB1.id, relationType: "prerequisite" }),
      })).status,
    ).toBe(400);
    expect(
      (await api(userB, "/api/skills/edges", {
        method: "POST",
        body: JSON.stringify({ sourceSkillId: skillB1.id, targetSkillId: skillA1.id, relationType: "supports" }),
      })).status,
    ).toBe(400);
  });

  test("User B cannot infer User A data through detail read models", async () => {
    const detailRes = await api(userB, `/api/skills/${skillB1.id}`);
    expect(detailRes.status).toBe(200);
    const detail = await detailRes.json();
    const allAIds = [skillA1.id, skillA2.id, skillA3.id];
    for (const prereq of detail.prerequisites) expect(allAIds).not.toContain(prereq.id);
    for (const unlock of detail.nextUnlocks) expect(allAIds).not.toContain(unlock.id);
    for (const ev of detail.evidenceTimeline) expect(ev.activityId).toBeTruthy();
  });

  test("edge lifecycle: 201 create, 409 cycle / duplicate / single-parent, 204 owned delete, 404 foreign+repeat delete", async () => {
    // A: Programming -> Statistics prerequisite
    const createRes = await api(userA, "/api/skills/edges", {
      method: "POST",
      body: JSON.stringify({ sourceSkillId: skillA1.id, targetSkillId: skillA2.id, relationType: "prerequisite" }),
    });
    expect(createRes.status).toBe(201);
    const edge = await createRes.json();
    edgeAId = edge.id;

    // cycle -> 409
    expect(
      (await api(userA, "/api/skills/edges", {
        method: "POST",
        body: JSON.stringify({ sourceSkillId: skillA2.id, targetSkillId: skillA1.id, relationType: "prerequisite" }),
      })).status,
    ).toBe(409);

    // duplicate -> 409
    expect(
      (await api(userA, "/api/skills/edges", {
        method: "POST",
        body: JSON.stringify({ sourceSkillId: skillA1.id, targetSkillId: skillA2.id, relationType: "prerequisite" }),
      })).status,
    ).toBe(409);

    // contains single-parent: AW -> Statistics when Programming already contains it -> 409
    expect(
      (await api(userA, "/api/skills/edges", {
        method: "POST",
        body: JSON.stringify({ sourceSkillId: skillA1.id, targetSkillId: skillA2.id, relationType: "contains" }),
      })).status,
    ).toBe(201);
    expect(
      (await api(userA, "/api/skills/edges", {
        method: "POST",
        body: JSON.stringify({ sourceSkillId: skillA3.id, targetSkillId: skillA2.id, relationType: "contains" }),
      })).status,
    ).toBe(409);

    // B deletes A's edge -> 404
    expect((await api(userB, `/api/skills/edges/${edgeAId}`, { method: "DELETE" })).status).toBe(404);
    // A deletes own edge -> 204; repeat -> 404
    expect((await api(userA, `/api/skills/edges/${edgeAId}`, { method: "DELETE" })).status).toBe(204);
    expect((await api(userA, `/api/skills/edges/${edgeAId}`, { method: "DELETE" })).status).toBe(404);
  });

  test("P2-1: User B PATCHing own skill with User A's domainId -> 400, domain unchanged", async () => {
    const domainId = crypto.randomUUID();
    const ins = await adminClient.from("domains").insert({
      id: domainId,
      user_id: (await userA.client.auth.getUser()).data.user!.id,
      name: "5D Foreign Domain A",
      slug: `stage5d-foreign-${Date.now()}`,
    });
    expect(ins.error).toBeNull();

    const before = await (await api(userB, `/api/skills/${skillB1.id}`)).json();

    const res = await api(userB, `/api/skills/${skillB1.id}`, {
      method: "PATCH",
      body: JSON.stringify({ domainId }),
    });
    expect(res.status).toBe(400);

    const after = await (await api(userB, `/api/skills/${skillB1.id}`)).json();
    expect(after.skill.domainId).toBe(before.skill.domainId);
  });

  test("5C production path: PATCH metadata -> refreshed detail; 409 normalized-name conflict; archive/unarchive keeps graph coherent", async () => {
    // metadata edit
    const patchRes = await api(userA, `/api/skills/${skillA1.id}`, {
      method: "PATCH",
      body: JSON.stringify({
        description: "5D 集成验证描述",
        aliases: ["py5d"],
      }),
    });
    expect(patchRes.status).toBe(200);
    const detailAfter = await (await api(userA, `/api/skills/${skillA1.id}`)).json();
    expect(detailAfter.skill.description).toBe("5D 集成验证描述");
    expect(detailAfter.skill.aliases).toContain("py5d");

    // graph reflects the alias (search contract used by the 5C UI)
    const graphAfterPatch = await (await api(userA, "/api/skills?status=all")).json();
    const nodeA1 = graphAfterPatch.nodes.find((n: { id: string }) => n.id === skillA1.id);
    expect(nodeA1.data.aliases).toContain("py5d");

    // normalized metadata conflict -> 409 (rename A1 to A2's normalized name)
    expect(
      (await api(userA, `/api/skills/${skillA1.id}`, {
        method: "PATCH",
        body: JSON.stringify({ name: skillA2.name.toUpperCase() }),
      })).status,
    ).toBe(409);

    // archive -> excluded from active scope, present in archived scope, detail archived
    expect(
      (await api(userA, `/api/skills/${skillA1.id}`, {
        method: "PATCH",
        body: JSON.stringify({ status: "archived" }),
      })).status,
    ).toBe(200);

    const activeGraph = await (await api(userA, "/api/skills")).json();
    expect(activeGraph.nodes.find((n: { id: string }) => n.id === skillA1.id)).toBeUndefined();

    const archivedGraph = await (await api(userA, "/api/skills?status=archived")).json();
    expect(archivedGraph.nodes.find((n: { id: string }) => n.id === skillA1.id)).toBeDefined();

    const archivedDetail = await (await api(userA, `/api/skills/${skillA1.id}`)).json();
    expect(archivedDetail.skill.derivedState).toBe("archived");

    // unarchive -> back in active scope (graph coherent)
    expect(
      (await api(userA, `/api/skills/${skillA1.id}`, {
        method: "PATCH",
        body: JSON.stringify({ status: "active" }),
      })).status,
    ).toBe(200);
    const finalGraph = await (await api(userA, "/api/skills?status=all")).json();
    expect(finalGraph.nodes.find((n: { id: string }) => n.id === skillA1.id)).toBeDefined();
  });
});
