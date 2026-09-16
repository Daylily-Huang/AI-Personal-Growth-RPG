import ReviewsClient from "@/components/journey/ReviewsClient";

interface ReviewsPageProps {
  searchParams: Promise<{ seasonId?: string | string[] }>;
}

export default async function ReviewsPage({ searchParams }: ReviewsPageProps) {
  const params = await searchParams;
  const seasonId = Array.isArray(params.seasonId) ? params.seasonId[0] : params.seasonId;
  return <ReviewsClient initialSeasonId={seasonId ?? null} />;
}
