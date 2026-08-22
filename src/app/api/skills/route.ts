import { NextResponse } from "next/server";
import { getRequestRepository, AuthRequiredError } from "@/lib/store/request-repository";
import { computeSkillGraph } from "@/lib/skills/layout";

export async function GET(request?: Request) {
  try {
    // 1. Authenticate first (P1-3)
    const repo = await getRequestRepository();

    // 2. Parse query filters
    let domainId: string | null = null;
    let status: "active" | "archived" | "all" = "active";

    if (request?.url) {
      const { searchParams } = new URL(request.url);
      domainId = searchParams.get("domainId");
      const statusParam = searchParams.get("status") as "active" | "archived" | "all" | null;
      if (statusParam === "archived" || statusParam === "all") {
        status = statusParam;
      }
    }

    const [domains, skills, edges] = await Promise.all([
      repo.listDomains(),
      repo.listSkills(),
      repo.listSkillEdges(),
    ]);

    const graph = computeSkillGraph(domains, skills, edges, {
      domainId: domainId || undefined,
      status,
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
