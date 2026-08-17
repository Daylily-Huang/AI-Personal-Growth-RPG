import { z } from "zod";

export const ACTIVITY_TYPES = [
  "learning",
  "skill",
  "production",
  "physical",
  "maintenance",
  "reflection",
] as const;

export const ActivityTypeSchema = z.enum(ACTIVITY_TYPES);

export const AssessmentProposalSchema = z.object({
  activity: z.object({
    type: ActivityTypeSchema,
    completion: z.number().min(0).max(1),
  }),
  difficulty: z.object({
    complexity: z.number().min(0).max(1),
    uncertainty: z.number().min(0).max(1),
    expertise_gap: z.number().min(0).max(1),
    resistance: z.number().min(0).max(1),
  }),
  growth: z.object({
    effort: z.number().min(0).max(1),
    learning: z.number().min(0).max(1),
    performance: z.number().min(0).max(1),
    outcome: z.number().min(0).max(1),
    artifact_value: z.number().min(0).max(1),
    character_evidence: z.number().min(0).max(1),
  }),
  evidence: z.object({
    level: z.number().int().min(0).max(6),
    explanation: z.string(),
  }),
  affected_skills: z.array(
    z.object({
      name: z.string(),
      reason: z.string(),
    }),
  ),
  knowledge_updates: z.object({
    proposed_nodes: z.array(
      z.object({
        title: z.string(),
        domain: z.string().optional(),
      }),
    ),
    proposed_edges: z.array(
      z.object({
        source: z.string(),
        target: z.string(),
        relation: z.string(),
      }),
    ),
  }),
  mastery_changes: z.array(
    z.object({
      target_type: z.enum(["skill", "knowledge"]),
      target_name: z.string(),
      from_level: z.number().int().min(0).max(10),
      proposed_level: z.number().int().min(0).max(10),
      confidence: z.number().min(0).max(1),
      verification_required: z.boolean(),
      reason: z.string(),
    }),
  ),
  xp_semantics: z.object({
    base_value: z.number().min(1).max(100),
    difficulty: z.number().min(0).max(1),
    mastery_gain: z.number().min(0).max(1),
    novelty: z.number().min(0).max(1),
    goal_alignment: z.number().min(0).max(1),
    repetition_risk: z.enum(["low", "medium", "high"]),
  }),
  artifacts: z.array(
    z.object({
      title: z.string(),
      type: z.string(),
      confirmed_existing: z.boolean(),
    }),
  ),
  next_quest: z
    .object({
      title: z.string(),
      reason: z.string(),
    })
    .nullable(),
  confidence: z.number().min(0).max(1),
  uncertainty_notes: z.array(z.string()),
});

export type AssessmentProposal = z.infer<typeof AssessmentProposalSchema>;

export const PromptVersion = "activity-evaluator-v0.1";
