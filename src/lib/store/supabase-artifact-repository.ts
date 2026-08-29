// src/lib/store/supabase-artifact-repository.ts
// Stage 7B Supabase Artifact Repository with strict tenant isolation and full relational join support

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Tables, TablesInsert, TablesUpdate } from "@/lib/supabase/database.types";
import type {
  Artifact,
  ArtifactType,
  ArtifactLifecycleStatus,
  ArtifactWithCounts,
  ArtifactDetail,
  ArtifactLinks,
  CreateArtifactInput,
  UpdateArtifactInput,
  ManageArtifactLinksInput,
} from "@/types/artifact";
import {
  ArtifactRepository,
  ListArtifactsFilter,
  ListArtifactsResult,
  ReferencedByProvenanceError,
  ArtifactTitleConflictError,
} from "./artifact-repository";

interface SkillJoinedRow {
  demonstration_level: number;
  skills: { id: string; name: string; level: number } | null;
}

interface KnowledgeNodeJoinedRow {
  relation_type: "cites" | "implements" | "synthesizes" | "evaluates";
  knowledge_nodes: { id: string; title: string; node_type: string; verification_status: string } | null;
}

interface QuestJoinedRow {
  is_primary_deliverable: boolean;
  quests: { id: string; title: string; status: string } | null;
}

interface ActivityJoinedRow {
  activity_role: "produced" | "referenced" | "modified";
  activities: { id: string; title: string; created_at: string } | null;
}

interface EvidenceJoinedRow {
  evidence_records: { id: string; evidence_level: number; description: string; verified: boolean } | null;
}

export class SupabaseArtifactRepository implements ArtifactRepository {

  constructor(
    private readonly client: SupabaseClient<Database>,
    readonly userId: string,
  ) {}

  private mapArtifactRow(row: Tables<"artifacts">): Artifact {
    return {
      id: row.id,
      userId: row.user_id,
      title: row.title,
      normalizedTitle: row.normalized_title ?? "",
      artifactType: row.artifact_type as ArtifactType,

      summary: row.summary,
      description: row.description,
      lifecycleStatus: row.lifecycle_status as ArtifactLifecycleStatus,
      version: row.version,
      storagePath: row.storage_path,
      externalUrl: row.external_url,
      reusabilityScore: Number(row.reusability_score),
      metadata: (row.metadata as Record<string, unknown>) ?? {},
      isArchived: row.is_archived,
      archivedAt: row.archived_at,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  async listArtifacts(filter?: ListArtifactsFilter): Promise<ListArtifactsResult> {
    const limit = Math.min(Math.max(filter?.limit ?? 50, 1), 100);
    const offset = Math.max(filter?.offset ?? 0, 0);

    let query = this.client
      .from("artifacts")
      .select("*", { count: "exact" })
      .eq("user_id", this.userId);

    // Status filter (Default: active)
    const status = filter?.status ?? "active";
    if (status !== "all") {
      query = query.eq("lifecycle_status", status);
    }

    if (filter?.type) {
      query = query.eq("artifact_type", filter.type);
    }

    if (filter?.search && filter.search.trim()) {
      const term = filter.search.trim();
      query = query.or(`title.ilike.%${term}%,summary.ilike.%${term}%`);
    }

    // Filter by skillId via artifact_skills join if requested
    if (filter?.skillId) {
      const { data: skillArtifacts } = await this.client
        .from("artifact_skills")
        .select("artifact_id")
        .eq("user_id", this.userId)
        .eq("skill_id", filter.skillId);
      const artifactIds = (skillArtifacts ?? []).map((r) => r.artifact_id);
      query = query.in("id", artifactIds.length > 0 ? artifactIds : ["00000000-0000-0000-0000-000000000000"]);
    }

    // Filter by questId via artifact_quests join if requested
    if (filter?.questId) {
      const { data: questArtifacts } = await this.client
        .from("artifact_quests")
        .select("artifact_id")
        .eq("user_id", this.userId)
        .eq("quest_id", filter.questId);
      const artifactIds = (questArtifacts ?? []).map((r) => r.artifact_id);
      query = query.in("id", artifactIds.length > 0 ? artifactIds : ["00000000-0000-0000-0000-000000000000"]);
    }

    query = query
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    const { data, count, error } = await query;
    if (error) throw error;

    const rows = data ?? [];
    const total = count ?? 0;
    if (rows.length === 0) {
      return { artifacts: [], total, limit, offset };
    }

    const artifactIds = rows.map((r) => r.id);

    // Fetch relationship counts in parallel
    const [actRes, skRes, knRes, qRes, evRes] = await Promise.all([
      this.client.from("artifact_activities").select("artifact_id").eq("user_id", this.userId).in("artifact_id", artifactIds),
      this.client.from("artifact_skills").select("artifact_id").eq("user_id", this.userId).in("artifact_id", artifactIds),
      this.client.from("artifact_knowledge_nodes").select("artifact_id").eq("user_id", this.userId).in("artifact_id", artifactIds),
      this.client.from("artifact_quests").select("artifact_id").eq("user_id", this.userId).in("artifact_id", artifactIds),
      this.client.from("artifact_evidence").select("artifact_id").eq("user_id", this.userId).in("artifact_id", artifactIds),
    ]);

    const actCounts = countBy(actRes.data ?? [], "artifact_id");
    const skCounts = countBy(skRes.data ?? [], "artifact_id");
    const knCounts = countBy(knRes.data ?? [], "artifact_id");
    const qCounts = countBy(qRes.data ?? [], "artifact_id");
    const evCounts = countBy(evRes.data ?? [], "artifact_id");

    const artifactsWithCounts: ArtifactWithCounts[] = rows.map((row) => {
      const art = this.mapArtifactRow(row);
      return {
        ...art,
        counts: {
          activities: actCounts[art.id] ?? 0,
          skills: skCounts[art.id] ?? 0,
          knowledgeNodes: knCounts[art.id] ?? 0,
          quests: qCounts[art.id] ?? 0,
          evidence: evCounts[art.id] ?? 0,
        },
      };
    });

    return {
      artifacts: artifactsWithCounts,
      total,
      limit,
      offset,
    };
  }

  async getArtifact(id: string): Promise<Artifact | null> {
    const { data, error } = await this.client
      .from("artifacts")
      .select("*")
      .eq("id", id)
      .eq("user_id", this.userId)
      .maybeSingle();

    if (error) throw error;
    if (!data) return null;
    return this.mapArtifactRow(data);
  }

  async getArtifactDetail(id: string): Promise<ArtifactDetail | null> {
    const artifact = await this.getArtifact(id);
    if (!artifact) return null;

    const links = await this.getArtifactLinks(id);
    return { artifact, links };
  }

  private async getArtifactLinks(artifactId: string): Promise<ArtifactLinks> {
    const [skRes, knRes, qRes, actRes, evRes] = await Promise.all([
      this.client
        .from("artifact_skills")
        .select("demonstration_level, skills(id, name, level)")
        .eq("user_id", this.userId)
        .eq("artifact_id", artifactId),
      this.client
        .from("artifact_knowledge_nodes")
        .select("relation_type, knowledge_nodes(id, title, node_type, verification_status)")
        .eq("user_id", this.userId)
        .eq("artifact_id", artifactId),
      this.client
        .from("artifact_quests")
        .select("is_primary_deliverable, quests(id, title, status)")
        .eq("user_id", this.userId)
        .eq("artifact_id", artifactId),
      this.client
        .from("artifact_activities")
        .select("activity_role, created_at, activities(id, title, created_at)")
        .eq("user_id", this.userId)
        .eq("artifact_id", artifactId),
      this.client
        .from("artifact_evidence")
        .select("evidence_records(id, evidence_level, description, verified)")
        .eq("user_id", this.userId)
        .eq("artifact_id", artifactId),
    ]);

    const skills = ((skRes.data ?? []) as unknown as SkillJoinedRow[])
      .map((r) => {
        if (!r.skills) return null;
        return {
          id: r.skills.id,
          name: r.skills.name,
          level: Number(r.skills.level),
          demonstrationLevel: Number(r.demonstration_level),
        };
      })
      .filter((s): s is NonNullable<typeof s> => s !== null);

    const knowledgeNodes = ((knRes.data ?? []) as unknown as KnowledgeNodeJoinedRow[])
      .map((r) => {
        if (!r.knowledge_nodes) return null;
        return {
          id: r.knowledge_nodes.id,
          title: r.knowledge_nodes.title,
          nodeType: r.knowledge_nodes.node_type,
          verificationStatus: r.knowledge_nodes.verification_status,
          relationType: r.relation_type,
        };
      })
      .filter((k): k is NonNullable<typeof k> => k !== null);

    const quests = ((qRes.data ?? []) as unknown as QuestJoinedRow[])
      .map((r) => {
        if (!r.quests) return null;
        return {
          id: r.quests.id,
          title: r.quests.title,
          status: r.quests.status,
          isPrimaryDeliverable: Boolean(r.is_primary_deliverable),
        };
      })
      .filter((q): q is NonNullable<typeof q> => q !== null);

    const activities = ((actRes.data ?? []) as unknown as ActivityJoinedRow[])
      .map((r) => {
        if (!r.activities) return null;
        return {
          id: r.activities.id,
          title: r.activities.title,
          activityRole: r.activity_role,
          completedAt: r.activities.created_at,
        };
      })
      .filter((a): a is NonNullable<typeof a> => a !== null);

    const evidence = ((evRes.data ?? []) as unknown as EvidenceJoinedRow[])
      .map((r) => {
        if (!r.evidence_records) return null;
        return {
          id: r.evidence_records.id,
          evidenceLevel: Number(r.evidence_records.evidence_level),
          description: r.evidence_records.description,
          verified: Boolean(r.evidence_records.verified),
        };
      })
      .filter((e): e is NonNullable<typeof e> => e !== null);


    return {
      skills,
      knowledgeNodes,
      quests,
      activities,
      evidence,
    };
  }

  async createArtifact(input: CreateArtifactInput): Promise<Artifact> {
    const title = input.title.trim();
    if (!title) {
      throw new Error("Artifact title cannot be empty");
    }

    const payload: TablesInsert<"artifacts"> = {
      user_id: this.userId,
      title,
      artifact_type: input.artifactType,
      summary: input.summary ?? null,
      description: input.description ?? null,
      lifecycle_status: input.lifecycleStatus ?? "active",
      version: input.version ?? "1.0",
      storage_path: input.storagePath ?? null,
      external_url: input.externalUrl ?? null,
      reusability_score: input.reusabilityScore ?? 0.0,
      metadata: (input.metadata as unknown as TablesInsert<"artifacts">["metadata"]) ?? {},
      is_archived: input.lifecycleStatus === "archived",

      archived_at: input.lifecycleStatus === "archived" ? new Date().toISOString() : null,
    };

    const { data, error } = await this.client
      .from("artifacts")
      .insert(payload)
      .select()
      .single();

    if (error) {
      if (error.code === "23505") {
        throw new ArtifactTitleConflictError();
      }
      throw error;
    }

    const artifact = this.mapArtifactRow(data);

    // Attach initial relations if provided
    if (input.skillIds && input.skillIds.length > 0) {
      const inserts = input.skillIds.map((skillId) => ({
        user_id: this.userId,
        artifact_id: artifact.id,
        skill_id: skillId,
        demonstration_level: 1,
      }));
      await this.client.from("artifact_skills").insert(inserts);
    }

    if (input.knowledgeNodeIds && input.knowledgeNodeIds.length > 0) {
      const inserts = input.knowledgeNodeIds.map((nodeId) => ({
        user_id: this.userId,
        artifact_id: artifact.id,
        node_id: nodeId,
        relation_type: "synthesizes" as const,
      }));
      await this.client.from("artifact_knowledge_nodes").insert(inserts);
    }

    if (input.questIds && input.questIds.length > 0) {
      const inserts = input.questIds.map((questId) => ({
        user_id: this.userId,
        artifact_id: artifact.id,
        quest_id: questId,
        is_primary_deliverable: false,
      }));
      await this.client.from("artifact_quests").insert(inserts);
    }

    if (input.activityIds && input.activityIds.length > 0) {
      const inserts = input.activityIds.map((activityId) => ({
        user_id: this.userId,
        artifact_id: artifact.id,
        activity_id: activityId,
        activity_role: "produced" as const,
      }));
      await this.client.from("artifact_activities").insert(inserts);
    }

    if (input.evidenceIds && input.evidenceIds.length > 0) {
      const inserts = input.evidenceIds.map((evidenceId) => ({
        user_id: this.userId,
        artifact_id: artifact.id,
        evidence_id: evidenceId,
      }));
      await this.client.from("artifact_evidence").insert(inserts);
    }

    return artifact;
  }

  async updateArtifact(id: string, input: UpdateArtifactInput): Promise<Artifact> {
    const existing = await this.getArtifact(id);
    if (!existing) {
      throw new Error("Artifact not found");
    }

    const updates: TablesUpdate<"artifacts"> = {};
    if (input.title !== undefined) updates.title = input.title.trim();
    if (input.artifactType !== undefined) updates.artifact_type = input.artifactType;
    if (input.summary !== undefined) updates.summary = input.summary;
    if (input.description !== undefined) updates.description = input.description;
    if (input.version !== undefined) updates.version = input.version;
    if (input.storagePath !== undefined) updates.storage_path = input.storagePath;
    if (input.externalUrl !== undefined) updates.external_url = input.externalUrl;
    if (input.reusabilityScore !== undefined) updates.reusability_score = input.reusabilityScore;
    if (input.metadata !== undefined) updates.metadata = input.metadata as unknown as TablesUpdate<"artifacts">["metadata"];

    if (input.lifecycleStatus !== undefined || input.isArchived !== undefined) {
      const isArchiving = input.lifecycleStatus === "archived" || input.isArchived === true;
      if (isArchiving) {
        updates.lifecycle_status = "archived";
        updates.is_archived = true;
      } else {
        updates.lifecycle_status = input.lifecycleStatus ?? (existing.lifecycleStatus === "archived" ? "active" : existing.lifecycleStatus);
        updates.is_archived = false;
      }
    }

    const { data, error } = await this.client
      .from("artifacts")
      .update(updates)
      .eq("id", id)
      .eq("user_id", this.userId)
      .select()
      .single();

    if (error) {
      if (error.code === "23505") {
        throw new ArtifactTitleConflictError();
      }
      throw error;
    }

    return this.mapArtifactRow(data);
  }

  async deleteArtifact(id: string): Promise<boolean> {
    const { error } = await this.client
      .from("artifacts")
      .delete()
      .eq("id", id)
      .eq("user_id", this.userId);

    if (error) {
      if (error.code === "23503") {
        throw new ReferencedByProvenanceError();
      }
      throw error;
    }

    return true;
  }

  async manageArtifactLinks(id: string, input: ManageArtifactLinksInput): Promise<ArtifactLinks> {
    const existing = await this.getArtifact(id);
    if (!existing) {
      throw new Error("Artifact not found");
    }

    // Process activities
    if (input.activities && input.activities.length > 0) {
      for (const act of input.activities) {
        if (act.action === "attach") {
          const role = act.activityRole ?? "produced";
          const { error: insErr } = await this.client
            .from("artifact_activities")
            .insert({
              user_id: this.userId,
              artifact_id: id,
              activity_id: act.activityId,
              activity_role: role,
            });
          if (insErr) {
            if (insErr.code === "23505") {
              const { error: updErr } = await this.client
                .from("artifact_activities")
                .update({ activity_role: role })
                .eq("user_id", this.userId)
                .eq("artifact_id", id)
                .eq("activity_id", act.activityId);
              if (updErr) throw updErr;
            } else {
              throw insErr;
            }
          }
        } else if (act.action === "detach") {
          const { error } = await this.client
            .from("artifact_activities")
            .delete()
            .eq("user_id", this.userId)
            .eq("artifact_id", id)
            .eq("activity_id", act.activityId);
          if (error) throw error;
        }
      }
    }

    // Process skills
    if (input.skills && input.skills.length > 0) {
      for (const sk of input.skills) {
        if (sk.action === "attach") {
          const level = sk.demonstrationLevel ?? 1;
          const { error: insErr } = await this.client
            .from("artifact_skills")
            .insert({
              user_id: this.userId,
              artifact_id: id,
              skill_id: sk.skillId,
              demonstration_level: level,
            });
          if (insErr) {
            if (insErr.code === "23505") {
              const { error: updErr } = await this.client
                .from("artifact_skills")
                .update({ demonstration_level: level })
                .eq("user_id", this.userId)
                .eq("artifact_id", id)
                .eq("skill_id", sk.skillId);
              if (updErr) throw updErr;
            } else {
              throw insErr;
            }
          }
        } else if (sk.action === "detach") {
          const { error } = await this.client
            .from("artifact_skills")
            .delete()
            .eq("user_id", this.userId)
            .eq("artifact_id", id)
            .eq("skill_id", sk.skillId);
          if (error) throw error;
        }
      }
    }

    // Process knowledgeNodes
    if (input.knowledgeNodes && input.knowledgeNodes.length > 0) {
      for (const kn of input.knowledgeNodes) {
        if (kn.action === "attach") {
          const rel = kn.relationType ?? "synthesizes";
          const { error: insErr } = await this.client
            .from("artifact_knowledge_nodes")
            .insert({
              user_id: this.userId,
              artifact_id: id,
              node_id: kn.nodeId,
              relation_type: rel,
            });
          if (insErr) {
            if (insErr.code === "23505") {
              const { error: updErr } = await this.client
                .from("artifact_knowledge_nodes")
                .update({ relation_type: rel })
                .eq("user_id", this.userId)
                .eq("artifact_id", id)
                .eq("node_id", kn.nodeId);
              if (updErr) throw updErr;
            } else {
              throw insErr;
            }
          }
        } else if (kn.action === "detach") {
          const { error } = await this.client
            .from("artifact_knowledge_nodes")
            .delete()
            .eq("user_id", this.userId)
            .eq("artifact_id", id)
            .eq("node_id", kn.nodeId);
          if (error) throw error;
        }
      }
    }

    // Process quests
    if (input.quests && input.quests.length > 0) {
      for (const q of input.quests) {
        if (q.action === "attach") {
          const primary = q.isPrimaryDeliverable ?? false;
          const { error: insErr } = await this.client
            .from("artifact_quests")
            .insert({
              user_id: this.userId,
              artifact_id: id,
              quest_id: q.questId,
              is_primary_deliverable: primary,
            });
          if (insErr) {
            if (insErr.code === "23505") {
              const { error: updErr } = await this.client
                .from("artifact_quests")
                .update({ is_primary_deliverable: primary })
                .eq("user_id", this.userId)
                .eq("artifact_id", id)
                .eq("quest_id", q.questId);
              if (updErr) throw updErr;
            } else {
              throw insErr;
            }
          }
        } else if (q.action === "detach") {
          const { error } = await this.client
            .from("artifact_quests")
            .delete()
            .eq("user_id", this.userId)
            .eq("artifact_id", id)
            .eq("quest_id", q.questId);
          if (error) throw error;
        }
      }
    }

    // Process evidence
    if (input.evidence && input.evidence.length > 0) {
      for (const ev of input.evidence) {
        if (ev.action === "attach") {
          const { error: insErr } = await this.client
            .from("artifact_evidence")
            .insert({
              user_id: this.userId,
              artifact_id: id,
              evidence_id: ev.evidenceId,
            });
          if (insErr && insErr.code !== "23505") {
            throw insErr;
          }
        } else if (ev.action === "detach") {
          const { error } = await this.client
            .from("artifact_evidence")
            .delete()
            .eq("user_id", this.userId)
            .eq("artifact_id", id)
            .eq("evidence_id", ev.evidenceId);
          if (error) throw error;
        }
      }
    }

    return this.getArtifactLinks(id);
  }
}


function countBy<T>(arr: T[], key: keyof T): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const item of arr) {
    const val = String(item[key]);
    counts[val] = (counts[val] ?? 0) + 1;
  }
  return counts;
}
