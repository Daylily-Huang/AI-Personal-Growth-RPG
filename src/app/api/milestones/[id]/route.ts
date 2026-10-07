import { milestoneJson, milestoneRoute, noQuery, uuid } from "@/lib/milestone/http";

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  return milestoneRoute(async repo => {
    noQuery(request);
    return milestoneJson({ milestone: await repo.detail(uuid((await context.params).id)) });
  });
}
