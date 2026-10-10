// Server-only trusted review path. next/headers below prevents client imports.
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { AuthRequiredError } from "./request-repository";
import { isValidUuid } from "@/lib/http/validation";

export class AssessmentRejectionError extends Error {
  constructor(readonly code: "not_found" | "assessment_conflict" | "invalid_receipt") {
    super(code);
  }
}

interface ReviewRow { id: string; user_id: string; activity_id: string; status: string }
const fields = "id,user_id,activity_id,status";
const states = new Set(["pending", "confirmed", "edited", "rejected", "superseded"]);
const sameUuid = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();

function reviewRow(value: unknown, id: string, userId: string, activityId?: string): ReviewRow {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new AssessmentRejectionError("invalid_receipt");
  const row = value as Record<string, unknown>;
  for (const field of ["id", "user_id", "activity_id", "status"]) {
    if (!Object.hasOwn(row, field)) throw new AssessmentRejectionError("invalid_receipt");
  }
  if (!isValidUuid(row.id) || !sameUuid(row.id, id) || !isValidUuid(row.user_id) || !sameUuid(row.user_id, userId)
      || !isValidUuid(row.activity_id) || (activityId && !sameUuid(row.activity_id, activityId))
      || typeof row.status !== "string" || !states.has(row.status)) throw new AssessmentRejectionError("invalid_receipt");
  return row as unknown as ReviewRow;
}

function rejectedReceipt(row: ReviewRow) {
  if (row.status !== "rejected") throw new AssessmentRejectionError("invalid_receipt");
  return { assessment: { id: row.id, activityId: row.activity_id, status: "rejected" as const } };
}

/** Authenticate once per request; the returned closure never accepts a caller-supplied owner. */
export async function getAssessmentRejectionSession() {
  const client = await getSupabaseServerClient();
  const { data, error } = await client.auth.getUser();
  if (error && ![400, 401, 403].includes(error.status ?? 0)) throw error;
  if (error || !data.user) throw new AuthRequiredError();
  const userId = data.user.id;
  if (!isValidUuid(userId)) throw new AssessmentRejectionError("invalid_receipt");

  async function read(id: string, activityId?: string) {
    const { data: row, error: readError } = await client.from("ai_assessments").select(fields)
      .eq("id", id).eq("user_id", userId).maybeSingle();
    if (readError) throw readError;
    if (!row) throw new AssessmentRejectionError("not_found");
    return reviewRow(row, id, userId, activityId);
  }

  return {
    async reject(id: string) {
      if (!isValidUuid(id)) throw new AssessmentRejectionError("invalid_receipt");
      const original = await read(id);
      if (original.status === "rejected") return rejectedReceipt(original);
      if (original.status !== "pending") throw new AssessmentRejectionError("assessment_conflict");

      // The only write: all authority predicates travel with the atomic UPDATE.
      // No Activity lock, growth mutation, raw proposal rewrite, or client UPDATE grant.
      const { data: updated, error: writeError } = await getSupabaseAdminClient().from("ai_assessments")
        .update({ status: "rejected" }).eq("id", original.id).eq("user_id", userId)
        .eq("activity_id", original.activity_id).eq("status", "pending").select(fields).maybeSingle();
      if (writeError) throw writeError;
      if (updated) return rejectedReceipt(reviewRow(updated, id, userId, original.activity_id));

      // A concurrent Confirm/reject may have won. Never infer success from the earlier read.
      const current = await read(id, original.activity_id);
      if (current.status === "rejected") return rejectedReceipt(current);
      throw new AssessmentRejectionError("assessment_conflict");
    },
  };
}
