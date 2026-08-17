import { z } from "zod";

export const XpCaseSchema = z.object({
  id: z.string(),
  golden: z.boolean().default(false),
  category: z.literal("xp"),
  description: z.string(),
  input: z.object({
    baseValue: z.number(),
    difficulty: z.number(),
    masteryGain: z.number(),
    evidence: z.number(),
    novelty: z.number(),
    goalAlignment: z.number(),
    repetitionCount: z.number().int().nonnegative(),
  }),
  expected: z.object({
    xp: z.object({
      min: z.number(),
      max: z.number(),
    }),
  }),
});

export type XpCase = z.infer<typeof XpCaseSchema>;
