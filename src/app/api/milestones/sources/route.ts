import { MilestoneHttpError } from "@/lib/milestone/errors";
import { milestoneJson, milestoneRoute, optionalEnum, pagination } from "@/lib/milestone/http";

export async function GET(request: Request) {
  return milestoneRoute(async repo => {
    const p = pagination(request, ["sourceType", "threshold"]);
    const query = new URL(request.url).searchParams;
    const type = optionalEnum(query.get("sourceType"), ["QUEST", "SEASON", "MASTERY"] as const);
    if (!type) throw new MilestoneHttpError("INVALID_SOURCE_TYPE");
    const threshold = query.get("threshold");
    if (type === "MASTERY" ? !["6", "8", "10"].includes(threshold ?? "") : threshold !== null) throw new MilestoneHttpError("INVALID_THRESHOLD");
    const result = await repo.sources(type, p, type === "MASTERY" ? Number(threshold) as 6 | 8 | 10 : undefined);
    return milestoneJson({ sources: result.items, nextOffset: result.nextOffset, authoritative: false });
  });
}
