import { beforeEach, describe, expect, test, vi } from "vitest";
const m = vi.hoisted(() => ({ server: vi.fn(), admin: vi.fn(), auth: vi.fn(), reads: [] as unknown[], writes: [] as unknown[], queries: [] as { kind: string; table: string; select?: string; update?: unknown; eq: unknown[][] }[] }));
vi.mock("@/lib/supabase/server", () => ({ getSupabaseServerClient: m.server }));
vi.mock("@/lib/supabase/admin", () => ({ getSupabaseAdminClient: m.admin }));
vi.mock("@/lib/store/request-repository", () => ({ AuthRequiredError: class extends Error {} }));
import { getAssessmentRejectionSession } from "@/lib/store/assessment-rejection.service";
const userId = "00000000-0000-4000-8000-000000000001", id = "00000000-0000-4000-8000-000000000002", activityId = "00000000-0000-4000-8000-000000000003";
const row = (status = "pending") => ({ id, user_id: userId, activity_id: activityId, status });
const result = (data: unknown) => ({ data, error: null });
function from(kind: "read" | "write", table: string) {
  const query: (typeof m.queries)[number] = { kind, table, eq: [] }; m.queries.push(query);
  const chain = {
    select(fields: string) { query.select = fields; return chain; },
    update(value: unknown) { query.update = value; return chain; },
    eq(...args: unknown[]) { query.eq.push(args); return chain; },
    async maybeSingle() { return (kind === "read" ? m.reads : m.writes).shift() ?? result(null); },
  }; return chain;
}
beforeEach(() => {
  vi.clearAllMocks(); m.reads = [result(row())]; m.writes = [result(row("rejected"))]; m.queries = [];
  m.auth.mockResolvedValue({ data: { user: { id: userId } }, error: null });
  m.server.mockResolvedValue({ auth: { getUser: m.auth }, from: (table: string) => from("read", table) });
  m.admin.mockReturnValue({ from: (table: string) => from("write", table) });
});
const reject = async () => (await getAssessmentRejectionSession()).reject(id);
describe("Trusted rejection service exact SDK predicates", () => {
  test("session-derived owner and atomic single-state CAS are the only write", async () => {
    expect(await reject()).toEqual({ assessment: { id, activityId, status: "rejected" } });
    expect(m.queries).toEqual([
      { kind: "read", table: "ai_assessments", select: "id,user_id,activity_id,status", eq: [["id", id], ["user_id", userId]] },
      { kind: "write", table: "ai_assessments", select: "id,user_id,activity_id,status", update: { status: "rejected" }, eq: [["id", id], ["user_id", userId], ["activity_id", activityId], ["status", "pending"]] },
    ]);
  });
  test("already rejected is read-only replay", async () => { m.reads = [result(row("rejected"))]; expect((await reject()).assessment.status).toBe("rejected"); expect(m.admin).not.toHaveBeenCalled(); });
  test.each(["confirmed", "edited", "superseded"])("terminal %s cannot be downgraded", async state => { m.reads = [result(row(state))]; await expect(reject()).rejects.toMatchObject({ code: "assessment_conflict" }); expect(m.admin).not.toHaveBeenCalled(); });
  test("missing or RLS-invisible foreign record never opens admin client", async () => { m.reads = [result(null)]; await expect(reject()).rejects.toMatchObject({ code: "not_found" }); expect(m.admin).not.toHaveBeenCalled(); });
  test.each([undefined, null, "", "constructor", "__proto__"])("raw status %s fails closed", async status => { m.reads = [result({ ...row(), status })]; await expect(reject()).rejects.toMatchObject({ code: "invalid_receipt" }); expect(m.admin).not.toHaveBeenCalled(); });
  test("missing own status is not defaulted", async () => { const value: Record<string, unknown> = row(); delete value.status; m.reads = [result(value)]; await expect(reject()).rejects.toMatchObject({ code: "invalid_receipt" }); expect(m.admin).not.toHaveBeenCalled(); });
  test.each(["id", "user_id", "activity_id"])("raw or returned identity mismatch %s fails closed", async field => { m.reads = [result({ ...row(), [field]: "00000000-0000-4000-8000-000000000099" })];
    if (field === "activity_id") { m.writes = [result(row("rejected"))]; await expect(reject()).rejects.toMatchObject({ code: "invalid_receipt" }); }
    else { await expect(reject()).rejects.toMatchObject({ code: "invalid_receipt" }); expect(m.admin).not.toHaveBeenCalled(); }
  });
  test("CAS loses to another rejection: re-read proves success, no second write", async () => { m.reads.push(result(row("rejected"))); m.writes = [result(null)]; expect((await reject()).assessment.status).toBe("rejected"); expect(m.queries.filter(q => q.kind === "write")).toHaveLength(1); });
  test.each(["confirmed", "superseded", "edited", "pending"])("CAS loss and re-read %s are conflict, not guessed success", async state => {
    m.reads.push(result(row(state))); m.writes = [result(null)]; await expect(reject()).rejects.toMatchObject({ code: "assessment_conflict" }); expect(m.queries.filter(q => q.kind === "write")).toHaveLength(1);
  });
  test("CAS loss followed by disappearance is 404", async () => { m.reads.push(result(null)); m.writes = [result(null)]; await expect(reject()).rejects.toMatchObject({ code: "not_found" }); });
  test.each(["pending", "confirmed", undefined, null])("malformed CAS success status %s cannot become a rejected receipt", async status => {
    m.writes = [result({ ...row(), status })]; await expect(reject()).rejects.toMatchObject({ code: "invalid_receipt" });
  });
  test("transport or SQL failure is not replayed as success", async () => { const error = Error("PRIVATE_DB_ERROR"); m.writes = [{ data: null, error }]; await expect(reject()).rejects.toBe(error); expect(m.queries).toHaveLength(2); });
  test("RLS read failure never falls back to admin lookup", async () => { const error = Error("RLS_INFRA"); m.reads = [{ data: null, error }]; await expect(reject()).rejects.toBe(error); expect(m.admin).not.toHaveBeenCalled(); });
  test("missing session and auth infrastructure errors never read or write assessments", async () => {
    m.auth.mockResolvedValueOnce({ data: { user: null }, error: null }); await expect(getAssessmentRejectionSession()).rejects.toBeInstanceOf(Error); expect(m.queries).toHaveLength(0);
    const error = { status: 503 }; m.auth.mockResolvedValueOnce({ data: { user: null }, error }); await expect(getAssessmentRejectionSession()).rejects.toBe(error); expect(m.queries).toHaveLength(0);
  });
});
