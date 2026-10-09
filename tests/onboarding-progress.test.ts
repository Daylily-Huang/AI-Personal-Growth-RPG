import { describe, expect, test } from "vitest";
import { readOnboardingProgress } from "@/lib/onboarding/progress";

const id = (n: number) => `12345678-1234-4000-8000-${String(n).padStart(12, "0")}`;
const quest = () => ({ id: id(1), title: "真实主线", status: "active", isMainQuest: true });
const skill = () => ({ id: id(2), name: "真实技能", status: "active", xp: 500, masteryLevel: 8 });
const activity = () => ({ id: id(3), title: "真实记录", rawInput: "实际完成了一次复查", status: "pending_assessment" });
const receipt = () => ({ dashboard: { quests: [quest()], skills: [skill()], activities: [activity()] } });

describe("onboarding preparation is a strict immutable read model", () => {
  test.each(Array.from({ length: 8 }, (_, mask) => mask))("preparation combination %i is not a growth calculation", mask => {
    const data = receipt();
    if (!(mask & 1)) data.dashboard.quests = [];
    if (!(mask & 2)) data.dashboard.skills = [];
    if (!(mask & 4)) data.dashboard.activities = [];
    const before = JSON.stringify(data), result = readOnboardingProgress(data);
    expect(Boolean(result.mainQuest)).toBe(Boolean(mask & 1));
    expect(Boolean(result.skill)).toBe(Boolean(mask & 2));
    expect(Boolean(result.activity)).toBe(Boolean(mask & 4));
    expect(JSON.stringify(data)).toBe(before);
    expect(Object.keys(result).sort()).toEqual(["activity", "mainQuest", "skill"]);
  });
  test.each(["locked", "available", "paused", "completed", "failed", "archived"])("%s main is not an active main", status => {
    const data = receipt(); data.dashboard.quests[0].status = status;
    expect(readOnboardingProgress(data).mainQuest).toBeNull();
  });
  test("normal quests and the old mainQuest shortcut cannot substitute for an active main", () => {
    const data = receipt(); data.dashboard.quests[0].isMainQuest = false;
    Object.assign(data.dashboard, { mainQuest: quest() });
    expect(readOnboardingProgress(data).mainQuest).toBeNull();
  });
  test("all quests are inspected, without changing their order", () => {
    const data = receipt(); data.dashboard.quests.unshift({ ...quest(), id: id(4), isMainQuest: false });
    const before = JSON.stringify(data);
    expect(readOnboardingProgress(data).mainQuest?.id).toBe(id(1)); expect(JSON.stringify(data)).toBe(before);
  });
  test("existing grown skills qualify without reading, resetting or deriving their growth values", () => {
    const data = receipt(); Object.freeze(data.dashboard.skills[0]); Object.freeze(data.dashboard.skills);
    expect(readOnboardingProgress(data).skill).toEqual({ id: id(2), label: "真实技能" });
    expect(data.dashboard.skills[0]).toMatchObject({ xp: 500, masteryLevel: 8 });
  });
  test("archived skill is not a current catalog entry", () => {
    const data = receipt(); data.dashboard.skills[0].status = "archived";
    expect(readOnboardingProgress(data).skill).toBeNull();
  });
  test.each(["pending_assessment", "assessed", "confirmed"])("saved activity status %s only proves a saved record", status => {
    const data = receipt(); data.dashboard.activities[0].status = status;
    expect(readOnboardingProgress(data).activity).toEqual({ id: id(3), label: "真实记录" });
  });
  test.each([null, undefined, false, 0, "true", [], {}])("rejects malformed root %j", value => {
    expect(() => readOnboardingProgress(value)).toThrow("INVALID_ONBOARDING_RECEIPT");
  });
  test.each(["quests", "skills", "activities"])("requires own array %s", field => {
    for (const value of [undefined, null, {}, "[]", true]) {
      const data = receipt(); Object.assign(data.dashboard, { [field]: value });
      expect(() => readOnboardingProgress(data)).toThrow();
    }
    const data = receipt(); Reflect.deleteProperty(data.dashboard, field);
    expect(() => readOnboardingProgress(data)).toThrow();
  });
  test.each([
    ["quests", "id"], ["quests", "title"], ["quests", "status"], ["quests", "isMainQuest"],
    ["skills", "id"], ["skills", "name"], ["skills", "status"],
    ["activities", "id"], ["activities", "title"], ["activities", "rawInput"], ["activities", "status"],
  ] as const)("missing/null own %s.%s is never defaulted", (collection, field) => {
    for (const replacement of ["missing", "null", "inherited", "getter"] as const) {
      const data = receipt(), row = data.dashboard[collection][0];
      const original = Object.getOwnPropertyDescriptor(row, field)?.value;
      Reflect.deleteProperty(row, field);
      let getterCalls = 0;
      if (replacement === "null") Object.defineProperty(row, field, { value: null });
      if (replacement === "inherited") Object.setPrototypeOf(row, { [field]: original });
      if (replacement === "getter") Object.defineProperty(row, field, { get: () => { getterCalls++; return original; } });
      expect(() => readOnboardingProgress(data), `${collection}.${field}/${replacement}`).toThrow();
      expect(getterCalls).toBe(0);
    }
  });
  test.each(["quests", "skills", "activities"] as const)("UUID aliases, duplicates and invalid ids fail closed in %s", collection => {
    for (const invalid of ["demo-id", "", null, {}, 123, " 12345678-1234-4000-8000-000000000001 "]) {
      const data = receipt(); Object.assign(data.dashboard[collection][0], { id: invalid });
      expect(() => readOnboardingProgress(data)).toThrow();
    }
    const data = receipt(), rows = data.dashboard[collection] as object[];
    rows.push({ ...rows[0] }); expect(() => readOnboardingProgress(data)).toThrow();
    const alias = receipt(), aliasRows = alias.dashboard[collection] as Record<string, unknown>[];
    aliasRows[0].id = "abcdefab-abcd-4000-8000-abcdefabcdef";
    aliasRows.push({ ...aliasRows[0], id: String(aliasRows[0].id).toUpperCase() });
    expect(() => readOnboardingProgress(alias)).toThrow();
  });
  test.each(["quests", "skills", "activities"] as const)("unknown status fails closed in %s", collection => {
    const data = receipt(); data.dashboard[collection][0].status = "constructor";
    expect(() => readOnboardingProgress(data)).toThrow();
  });
  test.each(["true", "false", 1, 0, {}, []])("isMainQuest %j is not coerced", value => {
    const data = receipt(); Object.assign(data.dashboard.quests[0], { isMainQuest: value });
    expect(() => readOnboardingProgress(data)).toThrow();
  });
  test.each(["", " \t\n\u000b\ufeff", null, 5, {}])("blank/non-text raw input %j does not prove saved work", value => {
    const data = receipt(); Object.assign(data.dashboard.activities[0], { rawInput: value });
    expect(() => readOnboardingProgress(data)).toThrow();
  });
  test("rejects prototype dashboard, sparse arrays, malformed irrelevant rows and inherited success flags", () => {
    expect(() => readOnboardingProgress(Object.create(receipt()))).toThrow();
    const sparse = receipt(); sparse.dashboard.skills = new Array(1); expect(() => readOnboardingProgress(sparse)).toThrow();
    const invalid = receipt(); invalid.dashboard.skills.push({ ...skill(), id: id(5), status: "invalid" });
    expect(() => readOnboardingProgress(invalid)).toThrow();
    expect(readOnboardingProgress({ dashboard: { quests: [], skills: [], activities: [], onboarding_completed: true } }))
      .toEqual({ mainQuest: null, skill: null, activity: null });
  });
  test("data labels remain text; prototype-named valid strings are not authority keys", () => {
    const data = receipt(); data.dashboard.skills[0].name = "__proto__";
    data.dashboard.quests[0].title = "<script>not HTML</script>";
    expect(readOnboardingProgress(data).skill?.label).toBe("__proto__");
    expect(readOnboardingProgress(data).mainQuest?.label).toBe("<script>not HTML</script>");
  });
});
