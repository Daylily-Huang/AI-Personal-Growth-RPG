import { analyzeReview } from "@/lib/review-insights/ai";
import { reviewBody, reviewJson, reviewRoute } from "@/lib/review-insights/http";
import { parseReviewPeriod } from "@/lib/review-insights/validation";

export async function POST(request: Request) {
  return reviewRoute(async repository => {
    const period = parseReviewPeriod(await reviewBody(request));
    const summary = await repository.summarize(period);
    return reviewJson(await analyzeReview(summary, request.signal));
  });
}
