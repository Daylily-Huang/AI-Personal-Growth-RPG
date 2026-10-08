import type { SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/database.types";
import { AuthRequiredError } from "@/lib/store/request-repository";
import { mapSkill } from "@/lib/store/supabase-mapping";
import { isZeroXpSkillReceipt, parseZeroXpSkillInput, SkillBootstrapError, type ZeroXpSkillInput } from "./bootstrap";

export class SkillBootstrapRepository {
  constructor(private readonly db: SupabaseClient, private readonly userId: string) {}

  async create(input: ZeroXpSkillInput) {
    const payload = parseZeroXpSkillInput(input);
    const { data, error } = await this.db.rpc("rpc_create_skill_zero_xp", { p_input: payload });
    if (error) throw new SkillBootstrapError(error.message, error.code);
    if (!data || Array.isArray(data) || data.user_id !== this.userId) throw new SkillBootstrapError("INVALID_SKILL_RECEIPT");
    if (data.status !== "active" || data.xp !== 0 || data.level !== 1 || data.mastery_level !== 0 || data.mastery_confidence !== 0
      || data.domain_id !== null || data.description !== null || data.last_used_at !== null
      || !Array.isArray(data.aliases) || data.aliases.length !== 0) throw new SkillBootstrapError("INVALID_SKILL_RECEIPT");
    const skill = mapSkill(data as Database["public"]["Tables"]["skills"]["Row"]);
    if (!isZeroXpSkillReceipt(skill, payload.name)) throw new SkillBootstrapError("INVALID_SKILL_RECEIPT");
    return skill;
  }
}

/** No shared client, admin writes, or demo fallback: every creation has a real session. */
export async function getSkillBootstrapRepository() {
  const db = await getSupabaseServerClient();
  const { data, error } = await db.auth.getUser();
  if (error && error.status && error.status >= 500) throw new SkillBootstrapError("AUTH_UNAVAILABLE");
  if (error || !data.user) throw new AuthRequiredError();
  return new SkillBootstrapRepository(db, data.user.id);
}
