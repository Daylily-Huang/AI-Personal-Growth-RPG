/**
 * Store facade / composition root.
 *
 * Milestone 2.6: NO global singleton wiring. Every call goes through a
 * request-scoped factory (`getRepository` / `getSettlementService`) so a
 * future authenticated, request-scoped Supabase client can replace the demo
 * repository without touching call sites.
 *
 * The compat functions below exist for the API routes and tests; they all
 * resolve a fresh repository/service from the factory.
 */

import { DemoRepository } from "./demo-repository";
import { SettlementService } from "./settlement.service";
import { buildDashboardSnapshot } from "./dashboard.service";
import type { Repository } from "./repository";
import type {
  NewActivityInput,
  NewAssessmentInput,
  Db,
  ConfirmResult,
  DashboardSnapshot,
  Activity,
  Assessment,
  MasteryVerification,
  SkillEdge,
} from "./types";

// ---- factory (request-scoped) ----
export function getRepository(): Repository {
  // Demo: stateless + file-backed, so a fresh instance per request is cheap.
  // Supabase later: resolve a request-scoped client here (auth context → repo).
  return new DemoRepository();
}

export function getSettlementService(): SettlementService {
  return new SettlementService(getRepository());
}

// ---- types (compat) ----
export type {
  Activity,
  Assessment,
  XpTransaction,
  SkillState,
  SkillEdge,
  MasteryVerification,
  PlayerState,
  Db,
  ConfirmResult,
  DashboardSnapshot,
  SettlementToApply,
  NewActivityInput,
  NewAssessmentInput,
} from "./types";
export type { Repository, SettlementResult } from "./repository";
export { DemoRepository };

// ---- compat functions (routes + tests) ----
export function readDb(): Db {
  return (getRepository() as DemoRepository).readDb();
}

export function createActivity(input: NewActivityInput): Promise<Activity> {
  return getRepository().addActivity(input);
}

export function getActivity(id: string): Promise<Activity | null> {
  return getRepository().getActivity(id);
}

export function listActivities(): Promise<Activity[]> {
  return getRepository().listActivities();
}

export function createAssessment(input: NewAssessmentInput): Promise<Assessment> {
  return getRepository().addAssessment(input);
}

export function listPendingAssessments(): Promise<Assessment[]> {
  return getRepository().listPendingAssessments();
}

export function getAssessment(id: string): Promise<Assessment | null> {
  return getRepository().getAssessment(id);
}

export function confirmAssessment(assessmentId: string): Promise<ConfirmResult> {
  return getSettlementService().confirmAssessment(assessmentId);
}

export function getDashboard(): Promise<DashboardSnapshot> {
  return buildDashboardSnapshot(getRepository());
}

export function listSkillEdges(): Promise<SkillEdge[]> {
  return getRepository().listSkillEdges();
}

export function resetDemoDb(): Promise<void> {
  return getRepository().reset();
}

export function listPendingMasteryVerifications(): Promise<MasteryVerification[]> {
  return getRepository().listMasteryVerifications();
}
