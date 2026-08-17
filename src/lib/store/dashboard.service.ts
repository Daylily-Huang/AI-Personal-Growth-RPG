import { levelFromXp } from "@/lib/growth-engine/levels";
import type { Repository } from "./repository";
import type { DashboardSnapshot } from "./types";

/** Read model for the dashboard, composed from the Repository port. */
export function buildDashboardSnapshot(repo: Repository): DashboardSnapshot {
  const player = repo.getPlayer();
  const level = levelFromXp(player.totalXp);
  const skills = repo.listSkills().sort((a, b) => b.xp - a.xp);

  return {
    player,
    levelProgress: {
      xpIntoLevel: level.xpIntoLevel,
      xpNeededForNext: level.xpNeededForNext,
      progress: level.progress,
    },
    recentGrowth: repo.listTransactions().slice(0, 10),
    pendingAssessments: repo.listPendingAssessments(),
    activities: repo.listActivities().slice(0, 20),
    skills,
  };
}
