"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Archive,
  BarChart3,
  BookOpenText,
  Pencil,
  Plus,
  RefreshCw,
  RotateCcw,
  SlidersHorizontal,
} from "lucide-react";
import { PrimaryButton, SecondaryButton, SectionCard } from "@/components/ui";
import { journeyInputClass, journeyLabelClass } from "@/components/journey/formStyles";
import type { SeasonSummary } from "@/lib/outer-loop/types";
import type { Quest } from "@/lib/store/types";
import {
  JOURNAL_ENTRY_TYPES,
  type JournalEntry,
  type JournalEntryType,
  type JournalUpdateInput,
} from "@/lib/journal/types";

type ArchiveFilter = "active" | "archived" | "all";
type StateKey = "energy" | "focus" | "stress" | "resistance" | "recovery" | "moodValence" | "selfConfidence";

interface ApiErrorPayload {
  error?: string;
}

interface EditorState {
  id: string | null;
  entryType: JournalEntryType;
  title: string;
  contentMarkdown: string;
  seasonId: string;
  questId: string;
  energy: string;
  focus: string;
  stress: string;
  resistance: string;
  recovery: string;
  moodValence: string;
  selfConfidence: string;
}

const ENTRY_TYPE_LABELS: Record<JournalEntryType, string> = {
  FREE_REFLECTION: "自由反思",
  QUEST_REFLECTION: "任务反思",
  DAILY_SUMMARY: "每日总结",
  WEEKLY_REFLECTION: "每周反思",
  SEASON_REFLECTION: "赛季反思",
  STATE_LOG: "状态记录",
  DECISION_NOTE: "决策笔记",
  FAILURE_POSTMORTEM: "失败复盘",
  INSIGHT: "洞见",
};

const STATE_FIELDS: ReadonlyArray<{ key: StateKey; label: string; min: number; max: number }> = [
  { key: "energy", label: "精力", min: 1, max: 5 },
  { key: "focus", label: "专注", min: 1, max: 5 },
  { key: "stress", label: "压力", min: 1, max: 5 },
  { key: "resistance", label: "阻力", min: 1, max: 5 },
  { key: "recovery", label: "恢复", min: 1, max: 5 },
  { key: "moodValence", label: "情绪", min: -2, max: 2 },
  { key: "selfConfidence", label: "自信", min: 1, max: 5 },
];

function blankEditor(): EditorState {
  return {
    id: null,
    entryType: "FREE_REFLECTION",
    title: "",
    contentMarkdown: "",
    seasonId: "",
    questId: "",
    energy: "",
    focus: "",
    stress: "",
    resistance: "",
    recovery: "",
    moodValence: "",
    selfConfidence: "",
  };
}

function editorFromEntry(entry: JournalEntry): EditorState {
  return {
    id: entry.id,
    entryType: entry.entryType,
    title: entry.title,
    contentMarkdown: entry.contentMarkdown,
    seasonId: entry.seasonId ?? "",
    questId: entry.questId ?? "",
    energy: entry.energy?.toString() ?? "",
    focus: entry.focus?.toString() ?? "",
    stress: entry.stress?.toString() ?? "",
    resistance: entry.resistance?.toString() ?? "",
    recovery: entry.recovery?.toString() ?? "",
    moodValence: entry.moodValence?.toString() ?? "",
    selfConfidence: entry.selfConfidence?.toString() ?? "",
  };
}

async function readApiError(response: Response, fallback: string): Promise<string> {
  const payload = await response.json().catch(() => ({})) as ApiErrorPayload;
  return payload.error || fallback;
}

function formatDateTime(value: string): string {
  return new Intl.DateTimeFormat("zh-CN", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function stateValue(value: string): number | null {
  return value === "" ? null : Number(value);
}

function average(entries: JournalEntry[], key: StateKey): number | null {
  const values = entries.map((entry) => entry[key]).filter((value): value is number => value !== null);
  if (values.length === 0) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

export default function JournalPage() {
  const router = useRouter();
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [seasons, setSeasons] = useState<SeasonSummary[]>([]);
  const [quests, setQuests] = useState<Quest[]>([]);
  const [entryTypeFilter, setEntryTypeFilter] = useState<JournalEntryType | "all">("all");
  const [seasonContextFilter, setSeasonContextFilter] = useState<string | "all">("all");
  const [questContextFilter, setQuestContextFilter] = useState<string | "all">("all");
  const [archiveFilter, setArchiveFilter] = useState<ArchiveFilter>("active");
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editor, setEditor] = useState<EditorState | null>(null);

  const loadEntries = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (entryTypeFilter !== "all") params.set("entryType", entryTypeFilter);
      if (seasonContextFilter !== "all") params.set("seasonId", seasonContextFilter);
      if (questContextFilter !== "all") params.set("questId", questContextFilter);
      if (archiveFilter !== "all") params.set("archived", archiveFilter === "archived" ? "true" : "false");
      const response = await fetch(`/api/journal?${params.toString()}`);
      if (response.status === 401) {
        router.push("/login");
        return;
      }
      if (!response.ok) throw new Error(await readApiError(response, "加载日志失败"));
      const payload = await response.json() as { entries: JournalEntry[] };
      setEntries(payload.entries ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "加载日志失败");
    } finally {
      setLoading(false);
    }
  }, [archiveFilter, entryTypeFilter, questContextFilter, router, seasonContextFilter]);

  const loadContexts = useCallback(async () => {
    try {
      const [seasonResponse, questResponse] = await Promise.all([
        fetch("/api/seasons"),
        fetch("/api/quests"),
      ]);
      if (seasonResponse.status === 401 || questResponse.status === 401) {
        router.push("/login");
        return;
      }
      if (!seasonResponse.ok || !questResponse.ok) throw new Error("加载日志上下文失败");
      const seasonPayload = await seasonResponse.json() as { seasons: SeasonSummary[] };
      const questPayload = await questResponse.json() as { quests: Quest[] };
      setSeasons(seasonPayload.seasons ?? []);
      setQuests(questPayload.quests ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "加载日志上下文失败");
    }
  }, [router]);

  useEffect(() => {
    const timer = window.setTimeout(() => void loadEntries(), 0);
    return () => window.clearTimeout(timer);
  }, [loadEntries]);

  useEffect(() => {
    const timer = window.setTimeout(() => void loadContexts(), 0);
    return () => window.clearTimeout(timer);
  }, [loadContexts]);

  const chartRows = useMemo(() => STATE_FIELDS.map((field) => ({
    ...field,
    value: average(entries, field.key),
  })), [entries]);

  async function submitEditor(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editor || !editor.title.trim() || !editor.contentMarkdown.trim()) return;

    setSaving(true);
    setError(null);
    try {
      const statePayload = Object.fromEntries(
        STATE_FIELDS.map((field) => [field.key, stateValue(editor[field.key])]),
      );
      const current = editor.id ? entries.find((entry) => entry.id === editor.id) ?? null : null;
      const payload: Record<string, unknown> = {
        title: editor.title.trim(),
        contentMarkdown: editor.contentMarkdown,
        ...statePayload,
      };

      if (!current) {
        payload.entryType = editor.entryType;
        if (editor.seasonId) payload.seasonId = editor.seasonId;
        if (editor.questId) payload.questId = editor.questId;
      } else {
        if (editor.entryType !== current.entryType) payload.entryType = editor.entryType;
        if (editor.seasonId !== (current.seasonId ?? "")) payload.seasonId = editor.seasonId || null;
        if (editor.questId !== (current.questId ?? "")) payload.questId = editor.questId || null;
      }

      const response = await fetch(current ? `/api/journal/${current.id}` : "/api/journal", {
        method: current ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (response.status === 401) {
        router.push("/login");
        return;
      }
      if (!response.ok) throw new Error(await readApiError(response, "保存日志失败"));
      setEditor(null);
      await loadEntries();
    } catch (err) {
      setError(err instanceof Error ? err.message : "保存日志失败");
    } finally {
      setSaving(false);
    }
  }

  async function toggleArchive(entry: JournalEntry) {
    setBusyId(entry.id);
    setError(null);
    try {
      const response = await fetch(`/api/journal/${entry.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isArchived: !entry.isArchived } satisfies JournalUpdateInput),
      });
      if (response.status === 401) {
        router.push("/login");
        return;
      }
      if (!response.ok) throw new Error(await readApiError(response, entry.isArchived ? "恢复日志失败" : "归档日志失败"));
      await loadEntries();
    } catch (err) {
      setError(err instanceof Error ? err.message : "更新日志失败");
    } finally {
      setBusyId(null);
    }
  }

  const needsQuest = editor?.entryType === "QUEST_REFLECTION";
  const needsSeason = editor?.entryType === "SEASON_REFLECTION";
  const needsFailureContext = editor?.entryType === "FAILURE_POSTMORTEM";
  const currentEditorEntry = editor?.id ? entries.find((entry) => entry.id === editor.id) ?? null : null;
  const shouldRevalidateContext = Boolean(editor && (
    !editor.id
    || !currentEditorEntry
    || editor.entryType !== currentEditorEntry.entryType
    || (needsQuest && editor.questId !== (currentEditorEntry.questId ?? ""))
    || (needsSeason && editor.seasonId !== (currentEditorEntry.seasonId ?? ""))
    || (needsFailureContext && (
      editor.questId !== (currentEditorEntry.questId ?? "")
      || editor.seasonId !== (currentEditorEntry.seasonId ?? "")
    ))
  ));

  return (
    <div className="flex w-full flex-col gap-6" data-testid="journey-journal-page">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 font-serif text-2xl font-[var(--font-weight-bold)] text-[var(--text-primary)]">
            <BookOpenText className="h-6 w-6 text-[var(--text-secondary)]" aria-hidden="true" />
            成长日志
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-[var(--text-muted)]">
            记录反思与主观状态。这里的状态只用于上下文和描述性回顾，不会改变 XP、Mastery、Evidence 或永久角色能力。
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <SecondaryButton onClick={() => void loadEntries()} icon={<RefreshCw className="h-4 w-4" />} disabled={loading || saving}>
            刷新
          </SecondaryButton>
          <PrimaryButton onClick={() => setEditor(blankEditor())} icon={<Plus className="h-4 w-4" />}>
            写一条反思
          </PrimaryButton>
        </div>
      </header>

      {error ? (
        <div role="alert" className="rounded-[var(--radius-md)] border border-[var(--state-danger-border)] bg-[var(--state-danger-bg)] px-4 py-3 text-sm text-[var(--state-danger-text)]">
          {error}
        </div>
      ) : null}

      {editor ? (
        <SectionCard
          title={editor.id ? "编辑日志" : "反思编辑器"}
          subtitle="正文按私密文本保存；Ctrl/⌘ + Enter 可提交。"
          icon={<Pencil className="h-4 w-4" aria-hidden="true" />}
        >
          <form className="space-y-5" onSubmit={submitEditor}>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <label className={journeyLabelClass}>
                类型
                <select
                  className={journeyInputClass}
                  value={editor.entryType}
                  onChange={(event) => setEditor({ ...editor, entryType: event.target.value as JournalEntryType })}
                >
                  {JOURNAL_ENTRY_TYPES.map((type) => <option key={type} value={type}>{ENTRY_TYPE_LABELS[type]}</option>)}
                </select>
              </label>
              <label className={journeyLabelClass}>
                标题
                <input
                  className={journeyInputClass}
                  value={editor.title}
                  onChange={(event) => setEditor({ ...editor, title: event.target.value })}
                  maxLength={160}
                  required
                />
              </label>
            </div>

            {(needsQuest || needsSeason || needsFailureContext) ? (
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                {(needsSeason || needsFailureContext) ? (
                  <label className={journeyLabelClass}>
                    赛季上下文{shouldRevalidateContext
                      ? (needsSeason ? "（必填）" : "（任务或赛季至少一个）")
                      : "（可保留历史未关联）"}
                    <select
                      className={journeyInputClass}
                      value={editor.seasonId}
                      onChange={(event) => setEditor({ ...editor, seasonId: event.target.value })}
                      required={needsSeason && shouldRevalidateContext}
                    >
                      <option value="">{editor.id && !editor.seasonId ? "未关联或原赛季已删除" : "选择赛季"}</option>
                      {seasons.map((season) => <option key={season.id} value={season.id}>{season.name}</option>)}
                    </select>
                  </label>
                ) : null}
                {(needsQuest || needsFailureContext) ? (
                  <label className={journeyLabelClass}>
                    任务上下文{shouldRevalidateContext
                      ? (needsQuest ? "（必填）" : "（任务或赛季至少一个）")
                      : "（可保留历史未关联）"}
                    <select
                      className={journeyInputClass}
                      value={editor.questId}
                      onChange={(event) => setEditor({ ...editor, questId: event.target.value })}
                      required={needsQuest && shouldRevalidateContext}
                    >
                      <option value="">{editor.id && !editor.questId ? "未关联或原任务已删除" : "选择任务"}</option>
                      {quests.map((quest) => <option key={quest.id} value={quest.id}>{quest.title}</option>)}
                    </select>
                  </label>
                ) : null}
              </div>
            ) : null}

            <label className={journeyLabelClass}>
              反思正文
              <textarea
                className={`${journeyInputClass} min-h-44 resize-y whitespace-pre-wrap [overflow-wrap:anywhere]`}
                value={editor.contentMarkdown}
                onChange={(event) => setEditor({ ...editor, contentMarkdown: event.target.value })}
                onKeyDown={(event) => {
                  if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
                    event.preventDefault();
                    event.currentTarget.form?.requestSubmit();
                  }
                }}
                required
              />
            </label>

            <fieldset>
              <legend className="mb-3 text-sm font-[var(--font-weight-semibold)] text-[var(--text-primary)]">主观状态（可选）</legend>
              <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-7">
                {STATE_FIELDS.map((field) => (
                  <label key={field.key} className={journeyLabelClass}>
                    {field.label}
                    <select
                      className={journeyInputClass}
                      value={editor[field.key]}
                      onChange={(event) => setEditor({ ...editor, [field.key]: event.target.value })}
                    >
                      <option value="">未记录</option>
                      {Array.from({ length: field.max - field.min + 1 }, (_, index) => field.min + index).map((value) => (
                        <option key={value} value={value}>{value}</option>
                      ))}
                    </select>
                  </label>
                ))}
              </div>
            </fieldset>

            {shouldRevalidateContext && needsFailureContext && !editor.questId && !editor.seasonId ? (
              <p role="status" className="text-xs text-[var(--state-warning-text)]">失败复盘需要至少选择一个任务或赛季上下文。</p>
            ) : null}

            <div className="flex flex-wrap justify-end gap-2">
              <SecondaryButton type="button" onClick={() => setEditor(null)} disabled={saving}>取消</SecondaryButton>
              <PrimaryButton
                type="submit"
                loading={saving}
                disabled={shouldRevalidateContext && needsFailureContext && !editor.questId && !editor.seasonId}
              >
                {editor.id ? "保存修改" : "保存反思"}
              </PrimaryButton>
            </div>
          </form>
        </SectionCard>
      ) : null}

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1.35fr)_minmax(18rem,0.65fr)]">
        <SectionCard
          title="日志时间线"
          subtitle={loading ? "正在读取私密日志…" : `${entries.length} 条记录`}
          icon={<BookOpenText className="h-4 w-4" aria-hidden="true" />}
          className="min-w-0"
        >
          <div className="mb-5 grid grid-cols-1 gap-3 rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--surface-ground)] p-3 md:grid-cols-2 xl:grid-cols-4">
            <label className={journeyLabelClass}>
              <span className="inline-flex items-center gap-1"><SlidersHorizontal className="h-3.5 w-3.5" aria-hidden="true" />类型筛选</span>
              <select className={journeyInputClass} value={entryTypeFilter} onChange={(event) => setEntryTypeFilter(event.target.value as JournalEntryType | "all")}>
                <option value="all">全部类型</option>
                {JOURNAL_ENTRY_TYPES.map((type) => <option key={type} value={type}>{ENTRY_TYPE_LABELS[type]}</option>)}
              </select>
            </label>
            <label className={journeyLabelClass}>
              赛季筛选
              <select className={journeyInputClass} value={seasonContextFilter} onChange={(event) => setSeasonContextFilter(event.target.value)}>
                <option value="all">全部赛季</option>
                {seasons.map((season) => <option key={season.id} value={season.id}>{season.name}</option>)}
              </select>
            </label>
            <label className={journeyLabelClass}>
              任务筛选
              <select className={journeyInputClass} value={questContextFilter} onChange={(event) => setQuestContextFilter(event.target.value)}>
                <option value="all">全部任务</option>
                {quests.map((quest) => <option key={quest.id} value={quest.id}>{quest.title}</option>)}
              </select>
            </label>
            <label className={journeyLabelClass}>
              归档筛选
              <select className={journeyInputClass} value={archiveFilter} onChange={(event) => setArchiveFilter(event.target.value as ArchiveFilter)}>
                <option value="active">仅未归档</option>
                <option value="archived">仅已归档</option>
                <option value="all">全部</option>
              </select>
            </label>
          </div>

          {loading ? (
            <div role="status" aria-live="polite" className="py-10 text-center text-sm text-[var(--text-muted)]">加载日志中…</div>
          ) : entries.length === 0 ? (
            <div className="rounded-[var(--radius-md)] border border-dashed border-[var(--border-default)] px-5 py-10 text-center">
              <p className="text-sm font-[var(--font-weight-medium)] text-[var(--text-primary)]">当前筛选范围还没有日志。</p>
              <p className="mt-1 text-xs text-[var(--text-muted)]">可以新建一条反思，或调整上方筛选条件。</p>
            </div>
          ) : (
            <div className="space-y-4" aria-label="日志时间线">
              {entries.map((entry) => (
                <article key={entry.id} className="min-w-0 rounded-[var(--radius-lg)] border border-[var(--border-subtle)] bg-[var(--surface-ground)] p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2 text-xs text-[var(--text-muted)]">
                        <span className="rounded-full bg-[var(--selection-neutral-bg)] px-2 py-1 text-[var(--selection-neutral-text)]">{ENTRY_TYPE_LABELS[entry.entryType]}</span>
                        <time dateTime={entry.loggedAt}>{formatDateTime(entry.loggedAt)}</time>
                        {entry.isArchived ? <span>已归档</span> : null}
                      </div>
                      <h2 className="mt-2 break-words font-serif text-lg font-[var(--font-weight-semibold)] text-[var(--text-primary)] [overflow-wrap:anywhere]">{entry.title}</h2>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <SecondaryButton size="sm" onClick={() => setEditor(editorFromEntry(entry))} icon={<Pencil className="h-3.5 w-3.5" />}>
                        编辑
                      </SecondaryButton>
                      <SecondaryButton
                        size="sm"
                        loading={busyId === entry.id}
                        onClick={() => void toggleArchive(entry)}
                        icon={entry.isArchived ? <RotateCcw className="h-3.5 w-3.5" /> : <Archive className="h-3.5 w-3.5" />}
                      >
                        {entry.isArchived ? "恢复" : "归档"}
                      </SecondaryButton>
                    </div>
                  </div>

                  <div className="mt-3 max-h-48 overflow-y-auto whitespace-pre-wrap break-words rounded-[var(--radius-md)] bg-[var(--surface-base)] p-3 text-sm leading-6 text-[var(--text-secondary)] [overflow-wrap:anywhere]">
                    {entry.contentMarkdown}
                  </div>

                  <div className="mt-3 flex flex-wrap gap-2 text-xs text-[var(--text-muted)]" aria-label="主观状态">
                    {STATE_FIELDS.map((field) => entry[field.key] === null ? null : (
                      <span key={field.key} className="rounded-full border border-[var(--border-subtle)] bg-[var(--surface-base)] px-2 py-1">
                        {field.label} {entry[field.key]}
                      </span>
                    ))}
                  </div>
                </article>
              ))}
            </div>
          )}
        </SectionCard>

        <SectionCard
          title="状态概览"
          subtitle="当前筛选记录的描述性均值"
          icon={<BarChart3 className="h-4 w-4" aria-hidden="true" />}
          className="min-w-0"
        >
          <p className="mb-4 text-xs leading-5 text-[var(--text-muted)]">
            仅展示你主动记录的主观状态，不推断能力，也不参与 XP、Mastery 或 Evidence 结算。
          </p>
          <div className="space-y-4" aria-label="状态描述性图表">
            {chartRows.map((row) => {
              const normalized = row.value === null ? 0 : (row.value - row.min) / (row.max - row.min || 1);
              return (
                <div key={row.key}>
                  <div className="mb-1 flex items-center justify-between gap-2 text-xs">
                    <span className="text-[var(--text-secondary)]">{row.label}</span>
                    <span className="tabular-nums text-[var(--text-muted)]">{row.value === null ? "—" : row.value.toFixed(1)}</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-[var(--surface-hover-neutral)]" role="img" aria-label={`${row.label}均值 ${row.value === null ? "无数据" : row.value.toFixed(1)}`}>
                    <div className="h-full rounded-full bg-[var(--gold-400)]" style={{ width: `${Math.max(0, Math.min(100, normalized * 100))}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </SectionCard>
      </div>
    </div>
  );
}
