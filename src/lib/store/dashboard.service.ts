import { levelFromXp } from "@/lib/growth-engine/levels";
import type { Repository } from "./repository";
import type { DashboardSnapshot } from "./types";

export type { DashboardSnapshot };

/** Read model for the dashboard, composed from the Repository port. */
export async function buildDashboardSnapshot(repo: Repository): Promise<DashboardSnapshot> {
  const player = await repo.getPlayer();
  const level = levelFromXp(player.totalXp);

  const [activities, transactions, pendingAssessments, skills, verifications, quests] =
    await Promise.all([
      repo.listActivities(),
      repo.listTransactions(),
      repo.listPendingAssessments(),
      repo.listSkills(),
      repo.listMasteryVerifications(),
      repo.listQuests(),
    ]);

  const mainQuest = quests.find((q) => q.isMainQuest && q.status !== "archived") ?? null;
  const activeQuests = quests.filter((q) => q.status === "active");

  return {
    player,
    levelProgress: {
      xpIntoLevel: level.xpIntoLevel,
      xpNeededForNext: level.xpNeededForNext,
      progress: level.progress,
    },
    recentGrowth: transactions.slice(0, 10),
    pendingAssessments,
    activities: activities.slice(0, 20),
    skills: [...skills].sort((a, b) => b.xp - a.xp),
    pendingMasteryVerifications: verifications.filter((v) => v.status === "pending"),
    quests,
    mainQuest,
    activeQuests,
  };
}
