// src/lib/store/supabase-artifact-repository.ts
// Stage 7B Supabase Artifact Repository with strict tenant isolation and full relational join support

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Tables, TablesUpdate, Json } from "@/lib/supabase/database.types";
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
  ManageArtifactLinksResult,
  ReferencedByProvenanceError,
  ArtifactTitleConflictError,
  TargetEntityNotFoundError,
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
      const { data: skillArtifacts, error: skErr } = await this.client
        .from("artifact_skills")
        .select("artifact_id")
        .eq("user_id", this.userId)
        .eq("skill_id", filter.skillId);
      if (skErr) throw skErr;
      const artifactIds = (skillArtifacts ?? []).map((r) => r.artifact_id);
      query = query.in("id", artifactIds.length > 0 ? artifactIds : ["00000000-0000-0000-0000-000000000000"]);
    }

    // Filter by questId via artifact_quests join if requested
    if (filter?.questId) {
      const { data: questArtifacts, error: qErr } = await this.client
        .from("artifact_quests")
        .select("artifact_id")
        .eq("user_id", this.userId)
        .eq("quest_id", filter.questId);
      if (qErr) throw qErr;
      const artifactIds = (questArtifacts ?? []).map((r) => r.artifact_id);
      query = query.in("id", artifactIds.length > 0 ? artifactIds : ["00000000-0000-0000-0000-000000000000"]);
    }

    // Stable total ordering: created_at DESC, id ASC
    query = query
      .order("created_at", { ascending: false })
      .order("id", { ascending: true })
      .range(offset, offset + limit - 1);

    const { data, count, error } = await query;
    if (error) throw error;

    const rows = data ?? [];
    const total = count ?? 0;
    if (rows.length === 0) {
      return { artifacts: [], total, limit, offset };
    }

    const artifactIds = rows.map((r) => r.id);

    // Fetch relationship counts in parallel (with explicit error checking)
    const [actRes, skRes, knRes, qRes, evRes] = await Promise.all([
      this.client.from("artifact_activities").select("artifact_id").eq("user_id", this.userId).in("artifact_id", artifactIds),
      this.client.from("artifact_skills").select("artifact_id").eq("user_id", this.userId).in("artifact_id", artifactIds),
      this.client.from("artifact_knowledge_nodes").select("artifact_id").eq("user_id", this.userId).in("artifact_id", artifactIds),
      this.client.from("artifact_quests").select("artifact_id").eq("user_id", this.userId).in("artifact_id", artifactIds),
      this.client.from("artifact_evidence").select("artifact_id").eq("user_id", this.userId).in("artifact_id", artifactIds),
    ]);

    if (actRes.error) throw actRes.error;
    if (skRes.error) throw skRes.error;
    if (knRes.error) throw knRes.error;
    if (qRes.error) throw qRes.error;
    if (evRes.error) throw evRes.error;

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

    if (skRes.error) throw skRes.error;
    if (knRes.error) throw knRes.error;
    if (qRes.error) throw qRes.error;
    if (actRes.error) throw actRes.error;
    if (evRes.error) throw evRes.error;

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

    // Contradictory lifecycle check
    if (input.lifecycleStatus !== undefined && input.isArchived !== undefined) {
      if (input.isArchived === true && input.lifecycleStatus !== "archived") {
        throw new Error("Contradictory lifecycle status: isArchived=true requires lifecycleStatus='archived'");
      }
      if (input.isArchived === false && input.lifecycleStatus === "archived") {
        throw new Error("Contradictory lifecycle status: isArchived=false cannot have lifecycleStatus='archived'");
      }
    }

    const { data, error } = await this.client.rpc("create_artifact_with_links", {
      p_user_id: this.userId,
      p_payload: {
        title,
        artifactType: input.artifactType,
        summary: input.summary ?? null,
        description: input.description ?? null,
        lifecycleStatus: input.lifecycleStatus ?? (input.isArchived ? "archived" : "active"),
        version: input.version ?? "1.0",
        storagePath: input.storagePath ?? null,
        externalUrl: input.externalUrl ?? null,
        reusabilityScore: input.reusabilityScore ?? 0.0,
        metadata: input.metadata ?? {},
        activityIds: input.activityIds ?? [],
        skillIds: input.skillIds ?? [],
        knowledgeNodeIds: input.knowledgeNodeIds ?? [],
        questIds: input.questIds ?? [],
        evidenceIds: input.evidenceIds ?? [],
      } as unknown as Json,
    });


    if (error) {
      if (error.code === "23505" || error.message.includes("artifact_title_conflict")) {
        throw new ArtifactTitleConflictError();
      }
      if (error.code === "P0002" || error.message.includes("not_found_or_not_owned")) {
        throw new TargetEntityNotFoundError();
      }
      throw error;
    }

    return this.mapArtifactRow(data as unknown as Tables<"artifacts">);
  }

  async updateArtifact(id: string, input: UpdateArtifactInput): Promise<Artifact> {
    const existing = await this.getArtifact(id);
    if (!existing) {
      throw new Error("Artifact not found");
    }

    // Fail-closed lifecycle contradiction validation
    if (input.lifecycleStatus !== undefined && input.isArchived !== undefined) {
      if (input.isArchived === true && input.lifecycleStatus !== "archived") {
        throw new Error("Contradictory lifecycle status: isArchived=true requires lifecycleStatus='archived'");
      }
      if (input.isArchived === false && input.lifecycleStatus === "archived") {
        throw new Error("Contradictory lifecycle status: isArchived=false cannot have lifecycleStatus='archived'");
      }
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
      if (error.code === "23505" || error.message.includes("artifact_title_conflict")) {
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
      if (error.code === "23503" || error.message.includes("referenced by")) {
        throw new ReferencedByProvenanceError();
      }
      throw error;
    }

    return true;
  }

  async manageArtifactLinks(id: string, input: ManageArtifactLinksInput): Promise<ManageArtifactLinksResult> {
    const existing = await this.getArtifact(id);
    if (!existing) {
      throw new TargetEntityNotFoundError("Artifact not found");
    }

    const { error } = await this.client.rpc("manage_artifact_links", {
      p_user_id: this.userId,
      p_artifact_id: id,
      p_payload: {
        activities: input.activities ?? [],
        skills: input.skills ?? [],
        knowledgeNodes: input.knowledgeNodes ?? [],
        quests: input.quests ?? [],
        evidence: input.evidence ?? [],
      } as unknown as Json,
    });


    if (error) {
      if (error.code === "P0002" || error.message.includes("not_found_or_not_owned")) {
        throw new TargetEntityNotFoundError();
      }
      throw error;
    }

    const links = await this.getArtifactLinks(id);
    const counts = {
      activities: links.activities.length,
      skills: links.skills.length,
      knowledgeNodes: links.knowledgeNodes.length,
      quests: links.quests.length,
      evidence: links.evidence.length,
    };

    return { counts, links };
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

