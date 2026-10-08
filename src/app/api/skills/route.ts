import { NextResponse } from "next/server";
import { getRequestRepository, AuthRequiredError } from "@/lib/store/request-repository";
import { computeSkillGraph } from "@/lib/skills/layout";
import { isValidUuid, isValidSkillStatusFilter, type SkillStatusFilter } from "@/lib/http/validation";
import { getSkillBootstrapRepository } from "@/lib/skills/bootstrap-request";
import { parseZeroXpSkillInput, SkillBootstrapError } from "@/lib/skills/bootstrap";

export async function POST(request: Request) {
  const json = (body: unknown, status: number) => NextResponse.json(body, {
    status, headers: { "Cache-Control": "private, no-store" },
  });
  try {
    const repo = await getSkillBootstrapRepository(); // Authentication before parsing.
    let body: unknown;
    try { body = await request.json(); }
    catch { return json({ error: "INVALID_SKILL_INPUT" }, 400); }
    const skill = await repo.create(parseZeroXpSkillInput(body));
    return json({ skill }, 201);
  } catch (error) {
    if (error instanceof AuthRequiredError) return json({ error: "UNAUTHORIZED" }, 401);
    if (error instanceof SkillBootstrapError) {
      if (error.message === "UNAUTHORIZED" && error.code === "42501") return json({ error: "UNAUTHORIZED" }, 401);
      if (error.message === "INVALID_SKILL_INPUT" && error.code === "22023") return json({ error: "INVALID_SKILL_INPUT" }, 400);
      if (error.message === "SKILL_ALREADY_EXISTS" && error.code === "23505") return json({ error: "SKILL_ALREADY_EXISTS" }, 409);
    }
    return json({ error: "SKILL_CREATE_FAILED" }, 500);
  }
}

export async function GET(request?: Request) {
  try {
    // 1. Authenticate first (P1-3)
    const repo = await getRequestRepository();

    // 2. Parse query filters
    let domainId: string | null = null;
    let statusParam: string | null = null;

    if (request?.url) {
      const { searchParams } = new URL(request.url);
      domainId = searchParams.get("domainId");
      statusParam = searchParams.get("status");
    }

    // 3. Validate query (Round 3/4 P1): malformed filters must be rejected outright
    //    instead of silently degrading to defaults indistinguishable from valid input.
    if (domainId !== null && !isValidUuid(domainId)) {
      return NextResponse.json({ error: "domainId must be a valid UUID" }, { status: 400 });
    }

    if (statusParam !== null && !isValidSkillStatusFilter(statusParam)) {
      return NextResponse.json(
        { error: "status must be one of: active, archived, all" },
        { status: 400 },
      );
    }

    // 4. Repository read + derive graph
    const [domains, skills, edges] = await Promise.all([
      repo.listDomains(),
      repo.listSkills(),
      repo.listSkillEdges(),
    ]);

    const graph = computeSkillGraph(domains, skills, edges, {
      domainId: domainId || undefined,
      status: (statusParam ?? "active") as SkillStatusFilter,
    });

    return NextResponse.json(graph, { status: 200 });
  } catch (error) {
    if (error instanceof AuthRequiredError) {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }
    console.error("Failed to load skill tree", error);
    return NextResponse.json({ error: "Failed to load skill tree" }, { status: 500 });
  }
}
