import { describe, expect, test, beforeEach } from "vitest";
import {
  KnowledgeAuthorityService,
  InvalidAuthorityTransitionError,
  NotFoundError,
} from "@/lib/knowledge/authority-service";
import { DemoKnowledgeRepository } from "@/lib/store/knowledge-repository";

describe("Stage 6B — KnowledgeAuthorityService (Unit Tests)", () => {
  let repo: DemoKnowledgeRepository;
  const USER_ID = "00000000-0000-4000-a000-000000000001";
  const FOREIGN_USER_ID = "00000000-0000-4000-b000-000000000002";

  beforeEach(() => {
    repo = new DemoKnowledgeRepository();
  });

  test("1. verifyKnowledgeNode: Inferred node is atomically verified with confidence=1.00 and audit trail", async () => {
    const node = await repo.createNode({
      title: "Inferred Concept",
      sourceType: "ai_proposal",
      confidence: 0.85,
    });
    expect(node.verificationStatus).toBe("inferred");
    expect(node.confidence).toBe(0.85);

    const verified = await KnowledgeAuthorityService.verifyKnowledgeNode(
      USER_ID,
      node.id,
      repo,
    );

    expect(verified.verificationStatus).toBe("verified");
    expect(verified.confidence).toBe(1.0);
    expect(verified.verifiedAt).toBeDefined();
    expect(verified.verifiedBy).toBe(USER_ID);
  });

  test("2. rejectKnowledgeNode: Inferred node is rejected while retaining audit record", async () => {
    const node = await repo.createNode({
      title: "Bad Proposal Concept",
      sourceType: "ai_proposal",
      confidence: 0.75,
    });

    const rejected = await KnowledgeAuthorityService.rejectKnowledgeNode(
      USER_ID,
      node.id,
      repo,
    );

    expect(rejected.verificationStatus).toBe("rejected");
    // Record is preserved in repo
    const fetched = await repo.getNode(node.id);
    expect(fetched).not.toBeNull();
    expect(fetched?.verificationStatus).toBe("rejected");
  });

  test("3. Non-inferred node transitions are rejected with InvalidAuthorityTransitionError (409)", async () => {
    // Verified node -> cannot verify again or reject
    const verifiedNode = await repo.createNode({
      title: "Already Verified Concept",
      sourceType: "user_created",
    });
    expect(verifiedNode.verificationStatus).toBe("verified");

    await expect(
      KnowledgeAuthorityService.verifyKnowledgeNode(USER_ID, verifiedNode.id, repo),
    ).rejects.toThrow(InvalidAuthorityTransitionError);

    await expect(
      KnowledgeAuthorityService.rejectKnowledgeNode(USER_ID, verifiedNode.id, repo),
    ).rejects.toThrow(InvalidAuthorityTransitionError);
  });

  test("4. Foreign-tenant node transitions are rejected with NotFoundError (404)", async () => {
    const node = await repo.createNode({
      title: "User A Node",
      sourceType: "ai_proposal",
      confidence: 0.8,
    });

    await expect(
      KnowledgeAuthorityService.verifyKnowledgeNode(FOREIGN_USER_ID, node.id, repo),
    ).rejects.toThrow(NotFoundError);

    await expect(
      KnowledgeAuthorityService.rejectKnowledgeNode(FOREIGN_USER_ID, node.id, repo),
    ).rejects.toThrow(NotFoundError);
  });

  test("5. verifyKnowledgeEdge and rejectKnowledgeEdge: Edge authority transitions", async () => {
    const n1 = await repo.createNode({ title: "Node 1" });
    const n2 = await repo.createNode({ title: "Node 2" });

    const edge = await repo.createEdge({
      sourceNodeId: n1.id,
      targetNodeId: n2.id,
      relationType: "supports",
      sourceType: "ai_proposal",
      confidence: 0.88,
    });
    expect(edge.verificationStatus).toBe("inferred");

    // Verify edge
    const verified = await KnowledgeAuthorityService.verifyKnowledgeEdge(
      USER_ID,
      edge.id,
      repo,
    );
    expect(verified.verificationStatus).toBe("verified");
    expect(verified.confidence).toBe(1.0);
    expect(verified.verifiedAt).toBeDefined();
    expect(verified.verifiedBy).toBe(USER_ID);

    // Create another inferred edge to test rejection
    const edge2 = await repo.createEdge({
      sourceNodeId: n1.id,
      targetNodeId: n2.id,
      relationType: "prerequisite",
      sourceType: "ai_proposal",
      confidence: 0.78,
    });

    const rejected = await KnowledgeAuthorityService.rejectKnowledgeEdge(
      USER_ID,
      edge2.id,
      repo,
    );
    expect(rejected.verificationStatus).toBe("rejected");

    // Rejecting already rejected edge -> 409
    await expect(
      KnowledgeAuthorityService.rejectKnowledgeEdge(USER_ID, edge2.id, repo),
    ).rejects.toThrow(InvalidAuthorityTransitionError);
  });
});
