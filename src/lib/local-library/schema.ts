import { z } from "zod";

export const LIBRARY_VERSION = "local-library-v1";
export const BODY_LIMIT = 300_000;
export const FILE_LIMIT = 128_000;
export const OFFICE_LIMIT = 20 * 1024 * 1024;
export const TEXT_LIMIT = 64_000;
export const MAX_FILES = 8;
const text = (max: number) => z.string().trim().min(1).max(max).refine(s => !s.includes("\0") && s.isWellFormed());
export const sourcePath = text(500).refine(s => !s.startsWith("/") && !s.includes("\\") && !s.includes(":") && !s.split("/").some(p => !p || p === "." || p === ".." || p.startsWith(".")));
export const SourceSchema = z.object({ path: sourcePath, sha256: z.string().regex(/^[a-f0-9]{64}$/), content: text(TEXT_LIMIT) }).strict();
export const AnalyzeSchema = z.object({ consent: z.literal(true), files: z.array(SourceSchema).min(1).max(MAX_FILES) }).strict().refine(v => v.files.reduce((n, f) => n + f.content.length, 0) <= TEXT_LIMIT && new Set(v.files.map(f => f.path)).size === v.files.length);
export const SuggestionSchema = z.object({ sourceIndex: z.number().int().min(0).max(MAX_FILES - 1), title: text(120), activityText: text(2400), evidenceText: text(1600), quote: text(800), uncertainty: text(500) }).strict();
export const AIOutputSchema = z.object({ suggestions: z.array(SuggestionSchema).min(1).max(MAX_FILES) }).strict();
export const ConfirmSchema = z.object({ draftId: z.string().uuid(), itemId: z.string().uuid(), requestId: z.string().uuid(), activityText: text(2400), evidenceText: text(1600) }).strict();
export type Source = z.infer<typeof SourceSchema>;
export type Suggestion = z.infer<typeof SuggestionSchema>;
export type LibraryItem = Omit<Suggestion, "sourceIndex"> & { id: string; source: { path: string; sha256: string } };
export type LibraryDraft = { id: string; expiresAt: string; model: string; items: LibraryItem[] };
export type Confirmation = z.infer<typeof ConfirmSchema>;
export type LibraryReceipt = { activityId: string; evidenceId: string; replayed: boolean };

const EXTENSIONS = new Set(["md", "mdx", "txt", "r", "py", "js", "jsx", "ts", "tsx", "json", "csv", "html", "css", "tex", "ipynb", "pptx", "docx"]);
export const isOfficePath = (name: string) => /\.(pptx|docx)$/i.test(name);
export const fileLimit = (name: string) => isOfficePath(name) ? OFFICE_LIMIT : FILE_LIMIT;
export function supportedPath(name: string): boolean {
  return sourcePath.safeParse(name).success && EXTENSIONS.has(name.split(".").at(-1)?.toLowerCase() ?? "") &&
    !name.split("/").some(p => /^(node_modules|vendor|dist|build|__pycache__|coverage|credentials|secrets?)$/i.test(p)) &&
    !/(?:secret|credential|password|token|密钥|密码|私钥)/i.test(name);
}
