"use client";

import React, { useEffect, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { FolderOpen, RefreshCw, Unplug, FileText, Sparkles } from "lucide-react";
import { PrimaryButton } from "@/components/ui/PrimaryButton";
import { SecondaryButton } from "@/components/ui/SecondaryButton";
import { GlassPanel } from "@/components/ui/GlassPanel";
import { journeyInputClass, journeyLabelClass } from "@/components/journey/formStyles";
import { directoryMemory, readSource, scanDirectory, type Directory, type FileEntry } from "@/lib/local-library/files";
import { AnalyzeSchema, fileLimit, isImagePath, MAX_FILES, OCROutputSchema, TEXT_LIMIT, supportedPath, type Confirmation, type LibraryDraft, type LibraryReceipt } from "@/lib/local-library/schema";
import { imageSource, prepareImage, type ImageText } from "@/lib/local-library/image";

type PickerWindow = Window & { showDirectoryPicker?: (options: { mode: "read"; id: string }) => Promise<Directory> };
class LibraryClientError extends Error { constructor(message: string, readonly status: number) { super(message); } }
async function api<T>(route: string, body?: unknown): Promise<T> {
  const response = await fetch(`/api/local-library${route}`, { credentials: "same-origin", cache: "no-store", ...(body ? { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) } : {}) });
  const data = await response.json();
  if (!response.ok) throw new LibraryClientError(`${data.error ?? "请求失败"}${data.activityId ? `（活动编号：${data.activityId}）` : ""}`, response.status);
  return data as T;
}
const pendingKey = (owner: string) => `growth-library-pending:${owner}`;

export default function LocalLibraryPage() {
  const [owner, setOwner] = useState<string | null>(null), [aiReady, setAiReady] = useState(false);
  const [directory, setDirectory] = useState<Directory | null>(null), [folderName, setFolderName] = useState("");
  const [files, setFiles] = useState<FileEntry[]>([]), [selected, setSelected] = useState<string[]>([]);
  const [notice, setNotice] = useState(""), [error, setError] = useState(""), [busy, setBusy] = useState(false), [consent, setConsent] = useState(false);
  const [draft, setDraft] = useState<LibraryDraft | null>(null), [saved, setSaved] = useState<Record<string, LibraryReceipt>>({});
  const [pending, setPending] = useState<Confirmation | null>(null);
  const [imageTexts, setImageTexts] = useState<Record<string, ImageText>>({});
  const picker = useRef<HTMLInputElement>(null), sequence = useRef(0), working = useRef(false);

  useEffect(() => {
    let active = true;
    void api<{ userId: string; aiConfigured: boolean }>("").then(async data => {
      if (!active) return;
      setOwner(data.userId); setAiReady(data.aiConfigured);
      try {
        const raw = sessionStorage.getItem(pendingKey(data.userId));
        if (raw) setPending(JSON.parse(raw));
        const remembered = await directoryMemory(data.userId, "get");
        if (active && remembered) { setDirectory(remembered); setFolderName(remembered.name); setNotice("已记住文件夹。点击刷新，按浏览器提示重新授权读取。"); }
      } catch { if (active) setNotice("此浏览器无法记住连接，仍可在本次使用中选择文件夹。"); }
    }).catch(e => { if (active) setError(e.message); });
    return () => { active = false; };
  }, []);

  async function verifyOwner() {
    const current = await api<{ userId: string }>("");
    if (current.userId !== owner) { setFiles([]); setDirectory(null); setDraft(null); setPending(null); setImageTexts({}); throw Error("登录账号已改变，请刷新页面后重新连接"); }
  }
  async function run(action: () => Promise<void>) {
    if (working.current) return;
    working.current = true; setBusy(true); setError("");
    try { await verifyOwner(); await action(); }
    catch (e) { if (e instanceof DOMException && e.name === "AbortError") return; setError(e instanceof Error ? e.message : "操作失败，请重试"); }
    finally { working.current = false; setBusy(false); }
  }
  function resetSuggestions() { sequence.current++; setDraft(null); setSelected([]); setConsent(false); setSaved({}); setImageTexts({}); }
  async function scan(handle: Directory) {
    const permission = await handle.queryPermission({ mode: "read" });
    if (permission !== "granted" && await handle.requestPermission({ mode: "read" }) !== "granted") throw Error("未取得文件夹读取权限；可重新授权或断开连接");
    const result = await scanDirectory(handle);
    resetSuggestions(); setFiles(result.files);
    setNotice(`找到 ${result.files.length} 个可读取文件，跳过 ${result.skipped} 项（不支持、隐藏、过大或不可访问）。${result.limited ? "已达到扫描上限，请连接更小的子文件夹。" : "尚未发送给AI。"}`);
  }
  function connect() {
    const showPicker = (window as PickerWindow).showDirectoryPicker;
    if (!showPicker) { picker.current?.click(); return; }
    // Invoke on the click, before any awaited network request consumes user activation.
    const chosen = showPicker.call(window, { mode: "read", id: "growth-learning-library" });
    void run(async () => {
      const handle = await chosen; setDirectory(handle); setFolderName(handle.name);
      await scan(handle);
      try { await directoryMemory(owner!, "put", handle); } catch { setNotice("文件夹已连接，但此浏览器未能记住连接；下次需重新选择。"); }
    });
    void chosen.catch(() => undefined);
  }
  function fallback(list: FileList | null) {
    if (!list) return;
    // Snapshot before the input is cleared or an awaited auth check runs.
    const all = Array.from(list);
    void run(async () => {
      const entries = all.filter(file => supportedPath(file.webkitRelativePath) && file.size > 0 && file.size <= fileLimit(file.webkitRelativePath)).slice(0, 200)
        .map(file => ({ path: file.webkitRelativePath, size: file.size, modifiedAt: file.lastModified, read: async () => file }));
      resetSuggestions(); setDirectory(null); setFolderName(all[0]?.webkitRelativePath.split("/")[0] ?? "已选择文件夹"); setFiles(entries);
      setNotice(`找到 ${entries.length} 个可读取文件，跳过 ${all.length - entries.length} 项；本浏览器需每次重新选择目录，不能记住读取权限。尚未发送给AI。`);
    });
  }
  function disconnect() {
    void run(async () => {
      resetSuggestions(); setFiles([]); setDirectory(null); setFolderName("");
      try { await directoryMemory(owner!, "delete"); } catch { throw Error("本页已断开连接，但记住的目录未清除；请在浏览器站点设置中清除存储与目录权限"); }
      setNotice("已断开连接，原文件未修改。浏览器站点设置中可进一步撤销目录权限。");
    });
  }
  function refresh() {
    if (!directory) return;
    const permission = directory.requestPermission({ mode: "read" });
    void run(async () => { if (await permission !== "granted") throw Error("未取得文件夹读取权限"); await scan(directory); });
    void permission.catch(() => undefined);
  }
  function analyze() {
    void run(async () => {
      if (!consent) throw Error("请先确认允许所选内容交给AI整理");
      const generation = ++sequence.current;
      const sources = []; let total = 0;
      for (const file of files.filter(f => selected.includes(f.path))) {
        try { const source = isImagePath(file.path) ? await imageSource(file, imageTexts[file.path]) : await readSource(file); total += source.content.length; if (total > TEXT_LIMIT) throw Error("所选文字合计超过64,000字符，请减少文件数量或拆分文档；本次未发送给AI"); sources.push(source); }
        catch (error) { throw Error(`${file.path}：${error instanceof Error ? error.message : "文字提取失败"}`); }
      }
      const input = AnalyzeSchema.parse({ consent: true, files: sources });
      const data = await api<{ draft: LibraryDraft }>("/analyze", input);
      if (generation === sequence.current) { setDraft(data.draft); setSaved({}); setNotice("AI建议尚未记录。请核对事实、修改文字，或拒绝不合适的建议。"); }
    });
  }
  function recognizeSelectedImages() {
    void run(async () => {
      const next: Record<string, ImageText> = {};
      setConsent(false); setDraft(null);
      for (const file of files.filter(file => selected.includes(file.path) && isImagePath(file.path))) {
        try {
          setNotice(`正在本机识别：${file.path}。图片不会发送给云端AI。`);
          const prepared = await prepareImage(file), result = OCROutputSchema.parse(await api("/ocr", { localOnly: true, path: file.path, base64: prepared.base64 }));
          if (result.rasterSha256 !== prepared.rasterSha256) throw Error("图片识别来源校验不一致，请重新识别");
          next[file.path] = { originalSha256: prepared.originalSha256, preview: prepared.preview, width: prepared.width, height: prepared.height, ...result };
        } catch (error) { setNotice("本机图片识别未完成，未发送给AI或记录活动。"); throw Error(`${file.path}：${error instanceof Error ? error.message : "图片识别失败"}`); }
      }
      setImageTexts(previous => ({ ...previous, ...next })); setNotice("图片文字已在本机识别。请对照图片核对、修改文字；勾选同意后才会发给AI整理。尚未记录活动。");
    });
  }
  async function save(input: Confirmation) {
    let result: LibraryReceipt;
    try { result = await api<LibraryReceipt>("/confirm", input); }
    catch (error) {
      // These statuses are emitted before activity creation; allow edits/regeneration.
      if (error instanceof LibraryClientError && (error.status === 400 || error.status === 410)) { sessionStorage.removeItem(pendingKey(owner!)); setPending(null); }
      throw error;
    }
    setSaved(previous => ({ ...previous, [input.itemId]: result }));
    sessionStorage.removeItem(pendingKey(owner!)); setPending(null);
    setNotice(result.replayed ? "该版本资料已经记录，已找到原活动，没有重复创建。" : "活动和待核实证据已记录；尚未评估或结算XP。");
  }
  function confirm(itemId: string) {
    void run(async () => {
      if (pending) throw Error("请先处理上一份未确认保存结果的请求");
      const item = draft?.items.find(item => item.id === itemId); if (!draft || !item) return;
      const input = { draftId: draft.id, itemId, requestId: crypto.randomUUID(), activityText: item.activityText, evidenceText: item.evidenceText };
      sessionStorage.setItem(pendingKey(owner!), JSON.stringify(input)); setPending(input);
      await save(input);
    });
  }
  function edit(itemId: string, field: "activityText" | "evidenceText", value: string) {
    setDraft(previous => previous ? { ...previous, items: previous.items.map(item => item.id === itemId ? { ...item, [field]: value } : item) } : null);
  }
  const buttonClass = "min-h-11";
  const selectedImages = files.filter(file => selected.includes(file.path) && isImagePath(file.path));
  const missingImageText = selectedImages.some(file => !imageTexts[file.path]?.text.trim());
  return (
    <div className="mx-auto w-full max-w-5xl space-y-6 p-4 md:p-8 text-[var(--text-primary)]">
      <header className="space-y-2">
        <Link href="/artifacts" className="inline-flex min-h-11 items-center text-sm text-[var(--text-secondary)]">← 返回产出台</Link>
        <h1 className="font-serif text-2xl md:text-3xl">本地资料</h1>
        <p className="text-sm text-[var(--text-secondary)]">把学习笔记和作品整理为活动与证据建议，核对后再记录。</p>
      </header>
      <GlassPanel className="space-y-4 p-5">
        <div className="flex items-start gap-3"><FolderOpen className="mt-1 h-5 w-5 shrink-0" aria-hidden /><div className="min-w-0"><h2 className="font-medium">{folderName || "连接学习资料文件夹"}</h2><p className="mt-1 text-sm text-[var(--text-secondary)]">只读你选择的目录。原文件留在电脑，扫描不会调用AI；仅发送你勾选的正文。</p></div></div>
        <div className="flex flex-wrap gap-2">
          <PrimaryButton className={buttonClass} disabled={!owner || busy} onClick={connect}><FolderOpen className="h-4 w-4" aria-hidden />{folderName ? "更换文件夹" : "选择文件夹"}</PrimaryButton>
          {directory && <SecondaryButton className={buttonClass} disabled={busy} onClick={refresh}><RefreshCw className="h-4 w-4" aria-hidden />刷新文件</SecondaryButton>}
          {folderName && <SecondaryButton className={buttonClass} disabled={busy} onClick={disconnect}><Unplug className="h-4 w-4" aria-hidden />断开连接</SecondaryButton>}
          <input ref={picker} type="file" multiple {...{ webkitdirectory: "" }} hidden aria-label="选择资料文件夹" onChange={e => { fallback(e.target.files); e.target.value = ""; }} />
        </div>
        <p className="text-xs leading-relaxed text-[var(--text-muted)]">支持PNG/JPG/WebP/BMP图片（最高10MB）：先用本机Windows文字识别，核对后只把文字交给AI，图片不发送给云端。支持PPTX文字与备注、DOCX正文与表格（最高20MB），以及UTF-8笔记与代码（最高128KB）。每次最多8份、合计64,000字符，超限不自动截断。PDF、旧版PPT/DOC、文档内嵌图片暂不读取；隐藏目录、依赖及明显的密钥文件会跳过。</p>
      </GlassPanel>
      {error && <div role="alert" className="break-words rounded-lg border border-[var(--danger)] p-4 text-sm text-[var(--danger)]">{error}</div>}
      {notice && <p role="status" className="text-sm text-[var(--text-secondary)]">{notice}</p>}
      {pending && <GlassPanel className="space-y-3 p-5"><h2 className="font-medium">等待确认保存结果</h2><p className="whitespace-pre-wrap break-words text-sm">{pending.activityText}</p><p className="text-sm text-[var(--text-secondary)]">网络中断时，请沿用原请求查询或补交证据；不会自动重复创建活动。</p><SecondaryButton disabled={busy} className={buttonClass} onClick={() => void run(() => save(pending))}>查询结果 / 安全重试</SecondaryButton></GlassPanel>}
      {!!files.length && <GlassPanel className="space-y-4 p-5">
        <div className="flex items-center justify-between"><h2 className="font-medium">选择本次整理的文件</h2><span className="text-sm">{selected.length} / {MAX_FILES}</span></div>
        <div className="max-h-80 overflow-y-auto space-y-1">
          {files.map(file => <label key={file.path} className="flex min-h-11 cursor-pointer items-center gap-3 rounded-lg p-2 hover:bg-[var(--surface-ground)]"><input type="checkbox" disabled={busy || (!selected.includes(file.path) && selected.length >= MAX_FILES)} checked={selected.includes(file.path)} onChange={e => { setSelected(previous => e.target.checked ? [...previous, file.path] : previous.filter(p => p !== file.path)); setConsent(false); setDraft(null); }} /><FileText aria-hidden className="h-4 w-4 shrink-0" /><span className="min-w-0 flex-1 break-words text-sm">{file.path}</span><span className="shrink-0 text-xs text-[var(--text-muted)]">{(file.size / 1024).toFixed(1)}KB</span></label>)}
        </div>
        {!!selectedImages.length && <div className="space-y-4 border-t border-[var(--border-default)] pt-4">
          <div className="space-y-2"><h3 className="font-medium">先识别并核对图片文字</h3><p className="text-sm text-[var(--text-secondary)]">仅在本机处理图片。较大图片会缩小至最长边2,600像素；识别可能漏字、看错数字或单位，请对照图片修改。此步骤不会调用云端AI或记录活动。</p><SecondaryButton className={buttonClass} disabled={busy || !!pending} onClick={recognizeSelectedImages}>本机识别所选图片</SecondaryButton></div>
          {selectedImages.map(file => { const result = imageTexts[file.path]; return result ? <div key={file.path} className="space-y-3 rounded-lg border border-[var(--border-default)] p-3"><p className="break-words text-sm font-medium">{file.path}</p><Image src={result.preview} width={result.width} height={result.height} unoptimized alt={`待核对图片：${file.path}`} className="max-h-64 w-auto max-w-full rounded object-contain" /><label className={journeyLabelClass}>识别文字：{file.path}<textarea className={`${journeyInputClass} min-h-32`} maxLength={TEXT_LIMIT} disabled={busy || !!pending} value={result.text} onChange={event => { setImageTexts(previous => ({ ...previous, [file.path]: { ...previous[file.path], text: event.target.value } })); setConsent(false); setDraft(null); }} /></label><p className="text-xs text-[var(--text-muted)]">本机Windows文字识别 · {result.language} · 可修改，尚未发送给AI</p></div> : <p key={file.path} className="break-words text-sm text-[var(--text-muted)]">{file.path}：等待本机识别。</p>; })}
        </div>}
        <label className="flex min-h-11 items-center gap-3 text-sm"><input type="checkbox" checked={consent} disabled={busy} onChange={e => setConsent(e.target.checked)} />允许将以上所选文本发送给已配置的AI服务整理（可能为云端AI）。原文件不上传到公开网站或GitHub。</label>
        {!aiReady && <p className="text-sm text-[var(--text-secondary)]">AI尚未配置，文件可以查看；配置后才能整理建议。</p>}
        <PrimaryButton className={buttonClass} disabled={!selected.length || !consent || busy || !aiReady || !!pending || missingImageText} onClick={analyze}><Sparkles aria-hidden className="h-4 w-4" />{busy ? "处理中…" : "交给AI整理建议"}</PrimaryButton>
      </GlassPanel>}
      {draft && <section className="space-y-4" aria-label="活动和证据建议">
        <p className="text-xs text-[var(--text-muted)]">模型：{draft.model} · 建议有效1小时，服务重启后需要重新分析。保存材料固定为E0、未验证，不直接改变经验或掌握度。</p>
        {draft.items.map(item => <GlassPanel key={item.id} className="space-y-4 p-5">
          <h2 className="font-serif text-xl">{item.title}</h2><p className="break-words text-xs text-[var(--text-muted)]">{item.source.path}</p>
          <label className={journeyLabelClass}>活动记录<textarea className={`${journeyInputClass} min-h-28`} maxLength={2400} value={item.activityText} disabled={busy || !!saved[item.id] || pending?.itemId === item.id} onChange={e => edit(item.id, "activityText", e.target.value)} /></label>
          <label className={journeyLabelClass}>证据材料（待核实）<textarea className={`${journeyInputClass} min-h-24`} maxLength={1600} value={item.evidenceText} disabled={busy || !!saved[item.id] || pending?.itemId === item.id} onChange={e => edit(item.id, "evidenceText", e.target.value)} /></label>
          <blockquote className="whitespace-pre-wrap break-words border-l-2 border-[var(--border-default)] pl-4 text-sm">{item.quote}</blockquote>
          <p className="text-sm text-[var(--text-secondary)]">待核实：{item.uncertainty}</p>
          <div className="flex flex-wrap gap-2">{saved[item.id] ? <Link className="inline-flex min-h-11 items-center text-sm underline" href={`/activities/${saved[item.id].activityId}`}>查看已记录活动</Link> : <><PrimaryButton className={buttonClass} disabled={busy || !!pending || !item.activityText.trim() || !item.evidenceText.trim()} onClick={() => confirm(item.id)}>确认记录活动与证据</PrimaryButton><SecondaryButton className={buttonClass} disabled={busy || !!pending} onClick={() => setDraft(previous => previous ? { ...previous, items: previous.items.filter(value => value.id !== item.id) } : null)}>拒绝此建议</SecondaryButton></>}</div>
        </GlassPanel>)}
      </section>}
    </div>
  );
}
