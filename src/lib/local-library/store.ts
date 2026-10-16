import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { evidenceText } from "@/lib/evidence-submission/validation";
import type { Confirmation, LibraryDraft, LibraryItem, LibraryReceipt } from "./schema";

// Route bundles share one process; avoid separate module-local maps after bundling.
const shared = globalThis as typeof globalThis & { __rpgLibraryDrafts?: Map<string, { owner: string; draft: LibraryDraft }> };
const drafts = shared.__rpgLibraryDrafts ??= new Map<string, { owner: string; draft: LibraryDraft }>();
export class LibraryError extends Error {
  constructor(message: string, readonly status = 400, readonly activityId?: string) { super(message); }
}
export function rememberDraft(owner: string, draft: LibraryDraft) {
  for (const [id, value] of drafts) if (Date.parse(value.draft.expiresAt) <= Date.now()) drafts.delete(id);
  if (drafts.size >= 100 || [...drafts.values()].filter(v => v.owner === owner).length >= 12) throw new LibraryError("待处理建议过多，请稍后再试", 429);
  drafts.set(draft.id, { owner, draft });
}
type Approved = { fingerprint: string; item: LibraryItem; input: Confirmation };
type Stored = Approved & { activityId?: string; evidenceId?: string; state: "creating" | "evidence" | "complete" };
export type LibraryWriter = {
  create(rawInput: string): Promise<string>;
  evidence(activityId: string, requestId: string, description: string): Promise<string>;
};
const hash = (s: string) => createHash("sha256").update(s).digest("hex");
function description(approved: Approved) {
  const value = `${approved.input.evidenceText}\n\n来源：${approved.item.source.path}\n正文SHA-256: ${approved.item.source.sha256}\n原文摘录：${approved.item.quote}\n局限：${approved.item.uncertainty}\n用户确认提交的材料，尚未独立验证。`;
  try { return evidenceText(value); } catch { throw new LibraryError("证据与来源引用合计过长，请缩短证据文字后重新确认", 400); }
}
const isUuid = (s: string) => /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(s);
async function load<T>(file: string): Promise<T | null> {
  try { return JSON.parse(await fs.readFile(file, "utf8")) as T; }
  catch (e) { if ((e as NodeJS.ErrnoException).code === "ENOENT") return null; throw e; }
}
async function replace(file: string, value: unknown) {
  const temporary = `${file}.tmp`;
  await fs.writeFile(temporary, JSON.stringify(value), { mode: 0o600 });
  await fs.rename(temporary, file);
}

/** Local receipt is written only after explicit confirmation. Never auto-retry an unknown create. */
export async function confirmLibrary(owner: string, input: Confirmation, writer: LibraryWriter, root = process.env.RPG_LOCAL_LIBRARY_DIR ?? path.join(process.cwd(), ".data", "local-library")): Promise<LibraryReceipt> {
  if (!isUuid(owner) || !isUuid(input.requestId)) throw new LibraryError("登录或请求编号无效");
  const directory = path.join(root, owner.toLowerCase());
  await fs.mkdir(directory, { recursive: true, mode: 0o700 });
  const fingerprint = hash(JSON.stringify(input));
  const requestFile = path.join(directory, `request-${input.requestId.toLowerCase()}.json`);
  let approved = await load<Approved>(requestFile);
  if (approved && approved.fingerprint !== fingerprint) throw new LibraryError("该确认编号已用于另一份内容，请保持原请求重试", 409);
  if (!approved) {
    const record = drafts.get(input.draftId);
    const item = record?.draft.items.find(item => item.id === input.itemId);
    if (!record || record.owner !== owner || Date.parse(record.draft.expiresAt) <= Date.now() || !item) throw new LibraryError("建议已过期或不可用，请重新分析所选文件", 410);
    approved = { fingerprint, item, input };
    description(approved);
    try { await fs.writeFile(requestFile, JSON.stringify(approved), { flag: "wx", mode: 0o600 }); }
    catch (e) {
      if ((e as NodeJS.ErrnoException).code !== "EEXIST") throw e;
      approved = await load<Approved>(requestFile);
      if (!approved || approved.fingerprint !== fingerprint) throw new LibraryError("确认内容冲突，请保持原请求重试", 409);
    }
  }
  const sourceKey = hash(`${approved.item.source.path}\0${approved.item.source.sha256}`);
  const receiptFile = path.join(directory, `source-${sourceKey}.json`), lockFile = `${receiptFile}.lock`;
  const current = await load<Stored>(receiptFile);
  if (current?.state === "complete" && current.activityId && current.evidenceId) return { activityId: current.activityId, evidenceId: current.evidenceId, replayed: true };
  let lock;
  try { lock = await fs.open(lockFile, "wx", 0o600); }
  catch (e) {
    if ((e as NodeJS.ErrnoException).code !== "EEXIST") throw e;
    throw new LibraryError("该资料正在记录或上次记录中断，请稍后重试；不要重新创建活动", 409, current?.activityId);
  }
  try {
    let stored = await load<Stored>(receiptFile);
    if (stored?.state === "complete" && stored.activityId && stored.evidenceId) return { activityId: stored.activityId, evidenceId: stored.evidenceId, replayed: true };
    if (stored?.state === "creating") throw new LibraryError("上次活动创建结果不明，请先检查活动历史；已停止自动重建以防重复", 409);
    if (!stored) {
      stored = { ...approved, state: "creating" };
      await replace(receiptFile, stored);
      const rawInput = `${approved.item.title}\n${approved.input.activityText}\n\n[本地资料来源]\n${approved.item.source.path}\n正文SHA-256: ${approved.item.source.sha256}\n原文摘录：${approved.item.quote}\n待核实：${approved.item.uncertainty}`;
      let activityId: string;
      try { activityId = await writer.create(rawInput); }
      catch { throw new LibraryError("活动创建结果不明，请先检查活动历史；不会自动重复创建", 409); }
      if (!isUuid(activityId)) throw new LibraryError("活动回执无效，已停止自动重建，请检查活动历史", 409);
      stored.activityId = activityId; stored.state = "evidence";
      await replace(receiptFile, stored);
    }
    if (!stored.activityId) throw new LibraryError("本机回执不完整，请检查活动历史", 409);
    try { stored.evidenceId = await writer.evidence(stored.activityId, stored.input.requestId, description(stored)); }
    catch { throw new LibraryError("活动已保存，证据暂未保存；请使用原请求重试，只补交证据", 503, stored.activityId); }
    if (!isUuid(stored.evidenceId)) throw new LibraryError("活动已保存，证据回执未确认，请使用原请求重试", 503, stored.activityId);
    stored.state = "complete"; await replace(receiptFile, stored);
    return { activityId: stored.activityId, evidenceId: stored.evidenceId, replayed: false };
  } finally { await lock.close(); await fs.unlink(lockFile); }
}
