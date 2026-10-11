import OpenAI from "openai";
import { buildProposalEditMessages } from "./context";
import { ProposalEditError, PROPOSAL_EDIT_MODEL_BYTES, PROPOSAL_EDIT_MODEL_TIMEOUT_MS,
  PROPOSAL_EDIT_PROVENANCE_BYTES, PROPOSAL_FACT_PROMPT_VERSION } from "./types";
import { parseProposalEditModelResult, wellFormedProposalFactText } from "./validation";

/** Server configuration only; no Demo fallback, provider changes, logs or automatic retry. */
export async function evaluateProposalFacts(context: unknown) {
  const messages = buildProposalEditMessages(context);
  try {
    const model = process.env.AI_MODEL ?? process.env.OPENAI_MODEL ?? "deepseek-v4-flash";
    const baseURL = process.env.AI_BASE_URL ?? process.env.OPENAI_BASE_URL;
    const apiKey = process.env.AI_API_KEY ?? process.env.OPENAI_API_KEY;
    if ((!apiKey && !baseURL) || !model.trim() || !wellFormedProposalFactText(model) ||
      new TextEncoder().encode(model).byteLength > PROPOSAL_EDIT_PROVENANCE_BYTES) throw Error("unavailable");
    const client = new OpenAI({ apiKey: apiKey || "local-bridge", baseURL: baseURL || undefined,
      maxRetries: 0, timeout: PROPOSAL_EDIT_MODEL_TIMEOUT_MS });
    const completion = await client.chat.completions.create({ model, temperature: 0, messages,
      stream: false, response_format: { type: "json_object" } });
    const content = completion.choices[0]?.message?.content;
    if (typeof content !== "string" || !content.trim() || !wellFormedProposalFactText(content) ||
      new TextEncoder().encode(content).byteLength > PROPOSAL_EDIT_MODEL_BYTES) throw Error("invalid content");
    return parseProposalEditModelResult({ modelName: model, promptVersion: PROPOSAL_FACT_PROMPT_VERSION, proposal: JSON.parse(content) });
  } catch { throw new ProposalEditError("PROPOSAL_EDIT_AI_UNAVAILABLE"); }
}
