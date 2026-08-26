// src/lib/knowledge/authority-service.ts
// Stage 6B Sanctioned Epistemic Authority Service

import type { KnowledgeRepository } from "@/lib/store/knowledge-repository";
import type { KnowledgeNode, KnowledgeEdge } from "./types";

export class InvalidAuthorityTransitionError extends Error {
  readonly code = "invalid_authority_transition";
  constructor(message = "Invalid knowledge authority transition") {
    super(message);
    this.name = "InvalidAuthorityTransitionError";
  }
}

export class NotFoundError extends Error {
  readonly code = "not_found";
  constructor(message = "Entity not found") {
    super(message);
    this.name = "NotFoundError";
  }
}

/**
 * Sanctioned service layer enforcing state-machine authority transitions.
 *
 * Generic/raw authenticated client mutation MUST NOT bypass Knowledge authority transitions.
 * Transitions:
 *   - inferred -> verified (sets confidence=1.00, verified_at=now(), verified_by=userId)
 *   - inferred -> rejected (retains record for audit history)
 *
 * Foreign tenant -> 404 semantics
 * Non-inferred state -> 409 invalid_authority_transition
 */
export class KnowledgeAuthorityService {
  static async verifyKnowledgeNode(
    userId: string,
    nodeId: string,
    repo: KnowledgeRepository,
  ): Promise<KnowledgeNode> {
    const node = await repo.getNode(nodeId);
    if (!node || node.userId !== userId) {
      throw new NotFoundError(`Knowledge node ${nodeId} not found`);
    }

    if (node.verificationStatus !== "inferred") {
      throw new InvalidAuthorityTransitionError(
        `Cannot verify node with status '${node.verificationStatus}': only 'inferred' nodes may be verified`,
      );
    }

    return repo.applyNodeAuthorityTransition(nodeId, "verify");
  }

  static async rejectKnowledgeNode(
    userId: string,
    nodeId: string,
    repo: KnowledgeRepository,
  ): Promise<KnowledgeNode> {
    const node = await repo.getNode(nodeId);
    if (!node || node.userId !== userId) {
      throw new NotFoundError(`Knowledge node ${nodeId} not found`);
    }

    if (node.verificationStatus !== "inferred") {
      throw new InvalidAuthorityTransitionError(
        `Cannot reject node with status '${node.verificationStatus}': only 'inferred' nodes may be rejected`,
      );
    }

    return repo.applyNodeAuthorityTransition(nodeId, "reject");
  }

  static async verifyKnowledgeEdge(
    userId: string,
    edgeId: string,
    repo: KnowledgeRepository,
  ): Promise<KnowledgeEdge> {
    const edge = await repo.getEdge(edgeId);
    if (!edge || edge.userId !== userId) {
      throw new NotFoundError(`Knowledge edge ${edgeId} not found`);
    }

    if (edge.verificationStatus !== "inferred") {
      throw new InvalidAuthorityTransitionError(
        `Cannot verify edge with status '${edge.verificationStatus}': only 'inferred' edges may be verified`,
      );
    }

    return repo.applyEdgeAuthorityTransition(edgeId, "verify");
  }

  static async rejectKnowledgeEdge(
    userId: string,
    edgeId: string,
    repo: KnowledgeRepository,
  ): Promise<KnowledgeEdge> {
    const edge = await repo.getEdge(edgeId);
    if (!edge || edge.userId !== userId) {
      throw new NotFoundError(`Knowledge edge ${edgeId} not found`);
    }

    if (edge.verificationStatus !== "inferred") {
      throw new InvalidAuthorityTransitionError(
        `Cannot reject edge with status '${edge.verificationStatus}': only 'inferred' edges may be rejected`,
      );
    }

    return repo.applyEdgeAuthorityTransition(edgeId, "reject");
  }
}
