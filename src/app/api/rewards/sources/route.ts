import { pagination, RewardHttpError, rewardJson, rewardRoute } from "@/lib/reward/http";

export async function GET(request: Request) {
  return rewardRoute(async service => {
    const p = pagination(request, ["sourceType"]);
    const type = new URL(request.url).searchParams.get("sourceType");
    if (type !== "SEASON" && type !== "QUEST" && type !== "MASTERY") throw new RewardHttpError("INVALID_SOURCE_TYPE");
    const page = await service.sources(type, p);
    return rewardJson({ sources: page.items, nextOffset: page.nextOffset, authoritative: false, policyVersion: "reward-v1" });
  });
}
