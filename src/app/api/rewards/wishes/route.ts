import { pagination, rewardBody, rewardJson, rewardRoute, wishMetadata } from "@/lib/reward/http";

export async function GET(request: Request) {
  return rewardRoute(async service => {
    const page = await service.wishes(pagination(request));
    return rewardJson({ wishes: page.items, nextOffset: page.nextOffset });
  });
}
export async function POST(request: Request) {
  return rewardRoute(async service => {
    const input = wishMetadata(await rewardBody(request), true);
    return rewardJson({ wish: await service.createWish({ ...input, title: input.title! }) }, 201);
  });
}
