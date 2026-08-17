/**
 * Store facade (was the "god object" growth store).
 *
 * Milestone 2.5 refactor: all settlement/business logic moved out into
 * `settlement.service.ts` (the single copy of the rules). This file only WIRES
 * the demo JSON repository + services and re-exports the compatibility surface
 * the app and tests use today.
 *
 * Later, a SupabaseRepository will implement the same `Repository` port and the
 * exact same SettlementService will run against it — no logic duplication.
 */

import { DemoRepository } from "./demo-repository";
import { SettlementService } from "./settlement.service";
import { buildDashboardSnapshot } from "./dashboard.service";
import type { NewActivityInput, NewAssessmentInput, Db } from "./types";

// ---- wiring (demo backend) ----
export const demoRepository = new DemoRepository();
export const settlementService = new SettlementService(demoRepository);

// ---- types (compat) ----
export type {
  Activity,
  Assessment,
  XpTransaction,
  SkillState,
  SkillEdge,
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
  return demoRepository.readDb();
}

export function createActivity(input: NewActivityInput) {
  return demoRepository.addActivity(input);
}

export function getActivity(id: string) {
  return demoRepository.getActivity(id);
}

export function listActivities() {
  return demoRepository.listActivities();
}

export function createAssessment(input: NewAssessmentInput) {
  return demoRepository.addAssessment(input);
}

export function listPendingAssessments() {
  return demoRepository.listPendingAssessments();
}

export function getAssessment(id: string) {
  return demoRepository.getAssessment(id);
}

export function confirmAssessment(assessmentId: string) {
  return settlementService.confirmAssessment(assessmentId);
}

export function getDashboard() {
  return buildDashboardSnapshot(demoRepository);
}

export function listSkillEdges() {
  return demoRepository.listSkillEdges();
}

export function resetDemoDb() {
  demoRepository.reset();
}
