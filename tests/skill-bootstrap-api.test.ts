import { randomUUID } from "node:crypto";
import { beforeEach, describe, expect, test, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { POST } from "@/app/api/skills/route";
import { parseZeroXpSkillInput, isZeroXpSkillReceipt, SkillBootstrapError } from "@/lib/skills/bootstrap";
import { SkillBootstrapRepository, getSkillBootstrapRepository } from "@/lib/skills/bootstrap-request";
import { evaluateScopedPolicy, skillBootstrapPolicy, SKILL_BOOTSTRAP_CONTROL, SKILL_BOOTSTRAP_MIGRATION } from "./helpers/governance-delta";

const mocked = vi.hoisted(() => ({ server: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ getSupabaseServerClient: mocked.server }));
const uid = randomUUID();
const row = () => ({ id: randomUUID(), user_id: uid, name: "Molecular Ecology", xp: 0, level: 1,
  mastery_level: 0, mastery_confidence: 0, domain_id: null, description: null, last_used_at: null,
  aliases: [], status: "active", created_at: "2026-10-08T00:00:00Z", updated_at: "2026-10-08T00:00:00Z" });
let db: { auth: { getUser: ReturnType<typeof vi.fn> }; rpc: ReturnType<typeof vi.fn> };
beforeEach(() => {
  db = { auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: uid } }, error: null }) },
    rpc: vi.fn().mockResolvedValue({ data: row(), error: null }) };
  mocked.server.mockReset().mockResolvedValue(db);
});
function request(body: unknown, raw = false) {
  return new Request("http://localhost/api/skills", { method: "POST", body: raw ? String(body) : JSON.stringify(body) });
}
async function response(body: unknown, status: number, raw = false) {
  const r = await POST(request(body, raw));
  expect(r.status).toBe(status); expect(r.headers.get("Cache-Control")).toBe("private, no-store");
  return r.json();
}

describe("manual skill input and strict zero receipt", () => {
  test.each([null, [], "name", {}, { name: null }, { name: 7 }, { name: "" }, { name: " \t\n\u000b " },
    { name: "a".repeat(201) }, { name: "a\0b" }, { name: "\ud800" }, { name: "\udc00" },
    { name: "ok", xp: 0 }, { name: "ok", userId: uid }, { name: "ok", masteryLevel: 0 },
    JSON.parse('{"name":"ok","__proto__":{}}')])("rejects invalid/extra fields %j", value => {
    expect(() => parseZeroXpSkillInput(value)).toThrow("INVALID_SKILL_INPUT");
  });
  test("Unicode codepoints, not UTF16 units; trim canonical payload", () => {
    expect(parseZeroXpSkillInput({ name: " \u00a0Molecular Ecology\u3000 " })).toEqual({ name: "Molecular Ecology" });
    expect(parseZeroXpSkillInput({ name: "🌱".repeat(200) }).name).toHaveLength(400);
    expect(() => parseZeroXpSkillInput({ name: "🌱".repeat(201) })).toThrow();
  });
  test.each(["id", "name", "xp", "level", "masteryLevel", "masteryConfidence", "status", "domainId", "description", "lastUsedAt", "aliases", "createdAt", "updatedAt"])("incomplete receipt missing %s fails closed", async field => {
    const s = await new SkillBootstrapRepository(db as unknown as SupabaseClient, uid).create({ name: "Molecular Ecology" });
    expect(isZeroXpSkillReceipt(s, s.name)).toBe(true);
    const broken: Record<string, unknown> = { ...s }; delete broken[field];
    expect(isZeroXpSkillReceipt(broken, s.name)).toBe(false);
  });
});

describe("request-scoped adapter and actual POST", () => {
  test("single RPC tuple; stable zero response; no extra owner fields", async () => {
    const result = await response({ name: " Molecular Ecology " }, 201);
    expect(result.skill).toMatchObject({ name: "Molecular Ecology", xp: 0, level: 1, masteryLevel: 0, masteryConfidence: 0 });
    expect(result.skill).not.toHaveProperty("user_id");
    expect(db.rpc).toHaveBeenCalledExactlyOnceWith("rpc_create_skill_zero_xp", { p_input: { name: "Molecular Ecology" } });
  });
  test("auth before malformed JSON; no parse/write", async () => {
    db.auth.getUser.mockResolvedValue({ data: { user: null }, error: null });
    expect(await response("{", 401, true)).toEqual({ error: "UNAUTHORIZED" }); expect(db.rpc).not.toHaveBeenCalled();
  });
  test("malformed JSON or forged fields produce400 without RPC", async () => {
    await response("{", 400, true); await response({ name: "ok", user_id: uid }, 400);
    expect(db.rpc).not.toHaveBeenCalled();
  });
  test.each([["SKILL_ALREADY_EXISTS", "23505", 409], ["INVALID_SKILL_INPUT", "22023", 400], ["UNAUTHORIZED", "42501", 401]])("maps only known exact SQL error %s/%s", async (message, code, status) => {
    db.rpc.mockResolvedValue({ data: null, error: { message, code } }); await response({ name: "Molecular Ecology" }, status as number);
  });
  test.each(["constructor", "toString", "__proto__", "private SQL connection secret", "SKILL_ALREADY_EXISTS"])("unknown/prototype error %s is safe500", async message => {
    db.rpc.mockResolvedValue({ data: null, error: { message, code: "42501" } });
    expect(await response({ name: "Molecular Ecology" }, 500)).toEqual({ error: "SKILL_CREATE_FAILED" });
  });
  test.each([{ user_id: randomUUID() }, { xp: 50 }, { xp: "0" }, { mastery_level: 1 }, { mastery_confidence: "" },
    { domain_id: undefined }, { description: undefined }, { last_used_at: undefined }, { aliases: undefined },
    { name: "Foreign" }, { status: "archived" }, { status: undefined }, { status: null }, { created_at: null }])("rejects forged/incomplete RPC row %j", async delta => {
    db.rpc.mockResolvedValue({ data: { ...row(), ...delta }, error: null });
    expect(await response({ name: "Molecular Ecology" }, 500)).toEqual({ error: "SKILL_CREATE_FAILED" });
  });
  test("missing row and transport failure never succeed or leak", async () => {
    db.rpc.mockResolvedValueOnce({ data: null, error: null }).mockRejectedValueOnce(new Error("PRIVATE"));
    await response({ name: "Molecular Ecology" }, 500); await response({ name: "Molecular Ecology" }, 500);
  });
  test("fresh client per request; auth infrastructure failure is500", async () => {
    await getSkillBootstrapRepository(); await getSkillBootstrapRepository(); expect(mocked.server).toHaveBeenCalledTimes(2);
    db.auth.getUser.mockResolvedValue({ data: { user: null }, error: { status: 503, message: "private" } });
    await response({ name: "Molecular Ecology" }, 500); expect(db.rpc).not.toHaveBeenCalled();
  });
  test("repository revalidates callers and invalid direct create does not hit DB", async () => {
    await expect(new SkillBootstrapRepository(db as unknown as SupabaseClient, uid).create({ name: "" })).rejects.toBeInstanceOf(SkillBootstrapError);
    expect(db.rpc).not.toHaveBeenCalled();
  });
});

describe("bootstrap exact governance exceptions without weakening historical policy", () => {
  const markers = [SKILL_BOOTSTRAP_CONTROL, SKILL_BOOTSTRAP_MIGRATION, "src/app/skills/components/SkillCreateForm.tsx", "src/app/skills/page.tsx"];
  const candidate = [...markers, "src/app/api/skills/route.ts"];
  test("complete approved delta permits exactly the two backend paths", () => {
    expect(skillBootstrapPolicy(candidate).authorizedExceptions).toEqual(["src/app/api/skills/route.ts", SKILL_BOOTSTRAP_MIGRATION]);
    expect(evaluateScopedPolicy(candidate, skillBootstrapPolicy(candidate)).violations).toEqual([]);
  });
  test.each(markers)("missing admission marker %s does not authorize backend", marker => {
    const files = candidate.filter(f => f !== marker);
    if (marker === "src/app/skills/page.tsx") files.push("src/app/skills/legacy.tsx");
    expect(evaluateScopedPolicy(files, skillBootstrapPolicy(files)).violations.length).toBeGreaterThan(0);
  });
  test.each(["supabase/migrations/0052_phase8f_milestones_rpc_authority.sql", "src/app/api/activities/route.ts",
    "src/lib/growth-engine/engine.ts", "src/lib/store/repository.ts", "src/lib/supabase/database.types.ts", "package.json", "pnpm-lock.yaml"])("extra forbidden path %s remains rejected", extra => {
    const files = [...candidate, extra]; expect(evaluateScopedPolicy(files, skillBootstrapPolicy(files)).violations).toContainEqual(expect.stringContaining(extra));
  });
});
