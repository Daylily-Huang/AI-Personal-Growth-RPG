// src/lib/store/artifact-repository.ts
// Stage 7B Artifact Repository Interface & Request Factory

import type {
  Artifact,
  ArtifactWithCounts,
  ArtifactDetail,
  ArtifactLinks,
  CreateArtifactInput,
  UpdateArtifactInput,
  ManageArtifactLinksInput,
} from "@/types/artifact";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { AuthRequiredError } from "./request-repository";
import { SupabaseArtifactRepository } from "./supabase-artifact-repository";

export interface ListArtifactsFilter {
  type?: string;
  status?: string; // 'active' | 'archived' | 'draft' | 'superseded' | 'all'
  skillId?: string;
  questId?: string;
  search?: string;
  limit?: number;
  offset?: number;
}

export interface ListArtifactsResult {
  artifacts: ArtifactWithCounts[];
  total: number;
  limit: number;
  offset: number;
}

export interface ArtifactRepository {
  readonly userId: string;

  listArtifacts(filter?: ListArtifactsFilter): Promise<ListArtifactsResult>;
  getArtifact(id: string): Promise<Artifact | null>;
  getArtifactDetail(id: string): Promise<ArtifactDetail | null>;
  createArtifact(input: CreateArtifactInput): Promise<Artifact>;
  updateArtifact(id: string, input: UpdateArtifactInput): Promise<Artifact>;
  deleteArtifact(id: string): Promise<boolean>;
  manageArtifactLinks(id: string, input: ManageArtifactLinksInput): Promise<ArtifactLinks>;
}

export class ReferencedByProvenanceError extends Error {
  readonly code = "referenced_by_provenance";
  constructor(message = "Cannot delete artifact: referenced by knowledge provenance or evidence records. Please archive instead.") {
    super(message);
    this.name = "ReferencedByProvenanceError";
  }
}

export class ArtifactTitleConflictError extends Error {
  readonly code = "artifact_title_conflict";
  constructor(message = "An artifact with this title already exists.") {
    super(message);
    this.name = "ArtifactTitleConflictError";
  }
}

export async function getRequestArtifactRepository(): Promise<ArtifactRepository> {
  const client = await getSupabaseServerClient();
  const { data, error } = await client.auth.getUser();
  if (error || !data.user) throw new AuthRequiredError();
  return new SupabaseArtifactRepository(client, data.user.id);
}
