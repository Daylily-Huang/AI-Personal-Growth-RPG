import { REVIEW_SAMPLE_LIMIT, REVIEW_SOURCES, REVIEW_VERSION, MONTHLY_REVIEW_VERSION, ReviewError, type ReviewData, type ReviewPeriod, type ReviewRow, type ReviewSource, type ReviewSummary } from "./types";
import { compareReviewTimestamps, parseReviewPeriod, parseReviewRow, parseReviewSummary } from "./validation";

export function reviewLabel(value: unknown): string { return Array.from(String(value)).slice(0, 160).join(""); }
export function buildReviewSummary(period: ReviewPeriod, data: ReviewData): ReviewSummary {
  parseReviewPeriod(period, new Date(data.asOf));
  if (data.coverage.length !== 9 || new Set(data.coverage.map(c => c.source)).size !== 9) throw new ReviewError("REVIEW_MALFORMED_DATA");
  const rows = {} as ReviewData["rows"];
  for (const source of REVIEW_SOURCES) {
    rows[source] = data.rows[source].map(row => parseReviewRow(source, row, data.ownerId));
    if (data.coverage.find(c => c.source === source)?.scanned !== rows[source].length) throw new ReviewError("REVIEW_MALFORMED_DATA");
  }
  const inPeriod = (row: ReviewRow) => compareReviewTimestamps(row.created_at, period.start) >= 0 && compareReviewTimestamps(row.created_at, period.end) < 0;
  const recent = (items: ReviewRow[]) => [...items].sort((a, b) => compareReviewTimestamps(b.created_at, a.created_at) || a.id.localeCompare(b.id));
  const take = (items: ReviewRow[]) => recent(items).slice(0, REVIEW_SAMPLE_LIMIT);
  const newSkills = rows.skills.filter(inPeriod), xp = rows.xp_transactions;
  const sum = (items: ReviewRow[]) => { const n = items.reduce((n, row) => n + Number(row.amount), 0); if (!Number.isSafeInteger(n)) throw new ReviewError("REVIEW_MALFORMED_DATA"); return n; };
  const groups = (key: "skill_id" | "domain_id", lookup: ReviewRow[]) => {
    const map = new Map<string | null, ReviewRow[]>(), names = new Map(lookup.map(r => [r.id, reviewLabel(r.name)]));
    for (const row of xp) { const id = row[key] as string | null; const items = map.get(id) ?? []; items.push(row); map.set(id, items); }
    const grouped = [...map].map(([id, items]) => ({ id, name: id === null ? null : names.get(id) ?? null, amount: sum(items), entries: items.length }))
      .sort((a, b) => Math.abs(b.amount) - Math.abs(a.amount) || (a.id ?? "").localeCompare(b.id ?? ""));
    return { values: grouped.slice(0, REVIEW_SAMPLE_LIMIT), omitted: Math.max(0, grouped.length - REVIEW_SAMPLE_LIMIT) };
  };
  const bySkill = groups("skill_id", rows.skills), byDomain = groups("domain_id", rows.domains);
  const activitySample = take(rows.activities), skillSample = take(newSkills), masterySample = take(rows.mastery_events), knowledgeSample = take(rows.knowledge_nodes), artifactSample = take(rows.artifacts), questSample = take(rows.quests);
  const stateRows = rows.journal_entries.filter(r => [r.energy, r.focus, r.stress, r.resistance, r.recovery, r.mood_valence, r.self_confidence].some(v => v !== null))
    .sort((a, b) => compareReviewTimestamps(String(b.logged_at), String(a.logged_at)) || a.id.localeCompare(b.id));
  const state = stateRows[0];
  const refs = new Map<string, ReviewSummary["sourceRefs"][number]>();
  function add(source: ReviewSource, items: ReviewRow[]) {
    for (const r of items) { const ref = `${source}:${r.id}`; refs.set(ref, { ref, source, id: r.id, label: reviewLabel(r.title ?? r.name ?? (source === "xp_transactions" ? `账本XP ${r.amount}` : source === "mastery_events" ? `Mastery ${r.from_level}→${r.to_level}` : "本期用户自评")) }); }
  }
  for (const [source, items] of [["activities", activitySample], ["skills", skillSample], ["mastery_events", masterySample], ["knowledge_nodes", knowledgeSample], ["artifacts", artifactSample], ["quests", questSample], ["xp_transactions", take(xp)], ["journal_entries", state ? [state] : []]] as [ReviewSource, ReviewRow[]][]) add(source, items);
  return parseReviewSummary({
    version: period.mode === "MONTHLY" ? MONTHLY_REVIEW_VERSION : REVIEW_VERSION, period, asOf: data.asOf, coverage: data.coverage, complete: data.coverage.every(c => c.complete),
    counts: { activities: rows.activities.length, confirmedActivities: rows.activities.filter(r => r.status === "confirmed").length, xpEntries: xp.length, masteryEvents: rows.mastery_events.length, newSkills: newSkills.length, newKnowledgeNodes: rows.knowledge_nodes.length, newArtifacts: rows.artifacts.length },
    xp: { net: sum(xp), activity: sum(xp.filter(r => r.xp_type === "activity")), adjustment: sum(xp.filter(r => r.xp_type === "adjustment")), correction: sum(xp.filter(r => r.xp_type === "correction")), repeatedSettlements: xp.filter(r => r.xp_type === "activity" && Number(r.repetition_count) > 0).length, penalizedSettlements: xp.filter(r => r.xp_type === "activity" && Number(r.repetition_penalty) < 1).length, bySkill: bySkill.values, byDomain: byDomain.values, omittedSkillGroups: bySkill.omitted, omittedDomainGroups: byDomain.omitted },
    activities: activitySample.map(r => ({ id: r.id, title: reviewLabel(r.title), createdAt: r.created_at, status: r.status, totalMinutes: r.total_minutes, effectiveMinutes: r.effective_minutes })),
    newSkills: skillSample.map(r => ({ id: r.id, name: reviewLabel(r.name), status: r.status })),
    masteryChanges: masterySample.map(r => ({ id: r.id, skillId: r.skill_id, from: r.from_level, to: r.to_level, kind: r.event_type, evidenceId: r.evidence_id })),
    knowledge: knowledgeSample.map(r => ({ id: r.id, title: reviewLabel(r.title), status: r.verification_status, archived: r.is_archived })),
    artifacts: artifactSample.map(r => ({ id: r.id, title: reviewLabel(r.title), status: r.lifecycle_status })),
    mainQuests: questSample.map(r => ({ id: r.id, title: reviewLabel(r.title), status: r.status, currentProgress: r.progress, periodChange: null })),
    state: state ? { id: state.id, loggedAt: state.logged_at, energy: state.energy, focus: state.focus, stress: state.stress, resistance: state.resistance, recovery: state.recovery, moodValence: state.mood_valence, selfConfidence: state.self_confidence } : null,
    sampling: { limit: 20, titleLimit: 160, omitted: ([ ["activities", rows.activities.length], ["newSkills", newSkills.length], ["masteryChanges", rows.mastery_events.length], ["knowledge", rows.knowledge_nodes.length], ["artifacts", rows.artifacts.length], ["mainQuests", rows.quests.length] ] as const).map(([category, count]) => ({ category, count: Math.max(0, count - REVIEW_SAMPLE_LIMIT) })) },
    sourceRefs: [...refs.values()],
    snapshotWarning: "多次只读查询，非原子快照；当前技能/领域/主线不是历史快照，主线期间增量未知。状态为用户本期自评；时间不等于XP，作品创建不等于独立验证。",
  });
}
