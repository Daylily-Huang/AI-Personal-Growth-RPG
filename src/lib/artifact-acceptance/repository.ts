import type { SupabaseClient } from "@supabase/supabase-js";
import { ArtifactAcceptanceError, type AcceptArtifactInput, type RevokeArtifactInput } from "./types";
import {
  ARTIFACT_ACCEPTANCE_SOURCE_COLUMNS, ARTIFACT_ACCEPTANCE_COLUMNS, ARTIFACT_CREDIT_COLUMNS,
  artifactSourceFromRaw, artifactAcceptanceFromRaw, artifactCreditFromRaw,
  parseArtifactAcceptanceView, parseArtifactAcceptanceRecord, parseArtifactAcceptanceReceipt,
} from "./validation";

export class ArtifactAcceptanceRepository {
  constructor(private readonly client: SupabaseClient, readonly userId: string) {}
  private async result(query: PromiseLike<{ data: unknown; error: { message: string; code?: string } | null }>) {
    const { data, error } = await query;
    if (error) throw new ArtifactAcceptanceError(error.message, error.code);
    return data;
  }
  async get(artifactId: string) {
    const source = await this.result(this.client.from("artifacts").select(ARTIFACT_ACCEPTANCE_SOURCE_COLUMNS)
      .eq("id", artifactId).eq("user_id", this.userId).maybeSingle());
    if (source === null) throw new ArtifactAcceptanceError("ARTIFACT_ACCEPTANCE_NOT_FOUND");
    const empty = parseArtifactAcceptanceView({ artifact: artifactSourceFromRaw(source), acceptance: null, earn: null, correction: null }, artifactId, this.userId);
    const row = await this.result(this.client.from("artifact_acceptances").select(ARTIFACT_ACCEPTANCE_COLUMNS)
      .eq("artifact_id", artifactId).eq("user_id", this.userId).maybeSingle());
    if (row === null) return empty;
    const acceptance = parseArtifactAcceptanceRecord(artifactAcceptanceFromRaw(row), artifactId, this.userId);
    const earnRow = await this.result(this.client.from("reward_transactions").select(ARTIFACT_CREDIT_COLUMNS)
      .eq("id", acceptance.earnTransactionId).eq("user_id", this.userId).maybeSingle());
    const correctionRow = await this.result(this.client.from("reward_transactions").select(ARTIFACT_CREDIT_COLUMNS)
      .eq("correction_for_id", acceptance.earnTransactionId).eq("event_kind", "CORRECTION").eq("user_id", this.userId).maybeSingle());
    const view = parseArtifactAcceptanceView({ artifact: empty.artifact, acceptance, earn: artifactCreditFromRaw(earnRow),
      correction: correctionRow === null ? null : artifactCreditFromRaw(correctionRow) }, artifactId, this.userId);
    const account = await this.result(this.client.from("reward_accounts").select("id,user_id")
      .eq("id", view.earn!.accountId).eq("user_id", this.userId).maybeSingle());
    if (!account || typeof account !== "object" || !("id" in account) || !("user_id" in account) ||
        account.id !== view.earn!.accountId || account.user_id !== this.userId) throw new ArtifactAcceptanceError("ARTIFACT_ACCEPTANCE_INVALID_RECEIPT");
    return view;
  }
  /** No mutable-target prefetch: SQL must resolve the shared request key first. */
  async accept(artifactId: string, input: AcceptArtifactInput) {
    const data = await this.result(this.client.rpc("rpc_accept_artifact_manual", {
      p_artifact_id: artifactId, p_expected_updated_at: input.expectedUpdatedAt,
      p_acceptance_note: input.acceptanceNote, p_request_key: input.requestKey,
    }));
    return parseArtifactAcceptanceReceipt(data, artifactId, this.userId);
  }
  async revoke(artifactId: string, input: RevokeArtifactInput) {
    const data = await this.result(this.client.rpc("rpc_revoke_artifact_manual", {
      p_artifact_id: artifactId, p_reason: input.reason, p_request_key: input.requestKey,
    }));
    return parseArtifactAcceptanceReceipt(data, artifactId, this.userId);
  }
}
