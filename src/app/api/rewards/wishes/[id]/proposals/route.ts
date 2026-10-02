import { pagination, rewardJson, rewardRoute, uuid } from "@/lib/reward/http";

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  return rewardRoute(async service => {
    const page = await service.proposals(uuid((await context.params).id), pagination(request));
    return rewardJson({ proposals: page.items, nextOffset: page.nextOffset });
  });
}
