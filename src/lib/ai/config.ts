export const AI_MODEL_NAME =
  process.env.AI_MODEL ?? process.env.OPENAI_MODEL ?? "local-demo-fallback";

export const AI_BASE_URL = process.env.AI_BASE_URL ?? process.env.OPENAI_BASE_URL ?? null;

export const AI_API_KEY_ENV =
  process.env.AI_API_KEY ?? process.env.OPENAI_API_KEY ?? null;
