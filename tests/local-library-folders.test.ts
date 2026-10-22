import { afterEach, describe, expect, it, vi } from "vitest";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { existingFolder, fallbackFolders, folderMemory, linkFiles, restoreFolders, type FolderConnection } from "@/lib/local-library/folders";
import { assertMultiFolderScope, assertMultiFolderFiles, MULTI_FOLDER_BASE, restoreMultiFolderMonthly, restoreMultiFolderTaskFirst } from "./helpers/multi-folder-scope";
import type { Directory, FileEntry } from "@/lib/local-library/files";
const handle = (name = "notes") => ({ kind: "directory" as const, name, async *values() { /* metadata fixture */ }, queryPermission: vi.fn(async () => "granted"), requestPermission: vi.fn(async () => "granted") }) as unknown as Directory;
const id = "11111111-1111-4111-8111-111111111111";
const entry = { path: "notes/a.md", size: 12, modifiedAt: 1, read: vi.fn() } as FileEntry;
const connection = (name = "notes"): FolderConnection => ({ id, name, handle: handle(name), files: [], status: "ready", skipped: 0, limited: false });
afterEach(() => vi.unstubAllGlobals());
function memory(initial = new Map<string, unknown>(), failPut = false) {
  const data = initial, writes: string[] = [], close = vi.fn(); let exists = true;
  const db = { close, objectStoreNames: { contains: () => exists }, createObjectStore() { exists = true; }, transaction: (_name: string, mode: string) => {
    const tx = { oncomplete: undefined as undefined | (() => void), onerror: undefined, onabort: undefined, objectStore: () => store };
    let pending = 0;
    const finish = () => { pending++; queueMicrotask(() => { if (!--pending) tx.oncomplete?.(); }); };
    const store = { get(key: string) { const request = { result: data.get(key) }; finish(); return request; }, put(value: unknown, key: string) { if (failPut) throw Error("clone failed"); expect(mode).toBe("readwrite"); data.set(key, value); writes.push(key); finish(); }, delete(key: string) { expect(mode).toBe("readwrite"); data.delete(key); writes.push(key); finish(); } };
    return tx;
  } };
  vi.stubGlobal("indexedDB", { open: vi.fn(() => { const request = { result: db, onupgradeneeded: undefined, onsuccess: undefined as undefined | (() => void), onerror: undefined, onblocked: undefined }; queueMicrotask(() => request.onsuccess?.()); return request; }) });
  return { data, writes, close };
}
describe("multi-folder local identities and browser memory", () => {
  it("isolates equal folder and file names without reading contents", () => {
    const other = "22222222-2222-4222-8222-222222222222";
    const a = linkFiles({ id }, [entry]).files[0], b = linkFiles({ id: other }, [entry]).files[0];
    expect(a.key).not.toBe(b.key); expect(a.sourcePath).not.toBe(b.sourcePath); expect(a.path).toBe(b.path); expect(entry.read).not.toHaveBeenCalled();
  });
  it("keeps a legacy source path and refuses protected or oversized qualified paths", () => {
    expect(linkFiles({ id, legacy: true }, [entry]).files[0].sourcePath).toBe(entry.path);
    expect(linkFiles({ id }, [{ ...entry, path: "notes/secret.txt" }, { ...entry, path: "notes/" + "a".repeat(490) + ".md" }])).toEqual({ files: [], skipped: 2 });
  });
  it("uses actual directory identity rather than name for duplicate connections", async () => {
    const old = connection(), same = { ...handle(), isSameEntry: vi.fn(async () => true) };
    expect(await existingFolder([old], same)).toBe(old); expect(same.isSameEntry).toHaveBeenCalledWith(old.handle);
    expect(await existingFolder([old], { ...handle(), isSameEntry: async () => false })).toBeUndefined();
  });
  it("does not silently add another connection when identity verification fails", async () => {
    await expect(existingFolder([connection()], { ...handle(), isSameEntry: async () => { throw Error("identity unavailable"); } })).rejects.toThrow("identity unavailable");
  });
  it("accepts old handles without automatically reading them or requesting permission", () => {
    const old = handle(); const restored = restoreFolders(old); expect(restored).toHaveLength(1); expect(restored[0].legacy).toBe(true); expect(restored[0].handle).toBe(old); expect(old.requestPermission).not.toHaveBeenCalled();
  });
  it("rejects malformed or duplicate persisted identities", () => {
    for (const value of [{ version: 2, folders: [{ id: "../outside", handle: handle() }] }, { version: 3, folders: [] }, { version: 2, folders: [{ id, handle: handle() }, { id, handle: handle() }] }]) expect(() => restoreFolders(value)).toThrow();
  });
  it("reads legacy account metadata, then migrates only that account on save", async () => {
    const legacy = handle(), other = handle("other"); const m = memory(new Map([["owner-a", legacy], ["owner-b", other]]));
    const restored = await folderMemory("owner-a", "get"); expect(restored[0].handle).toBe(legacy); expect(m.writes).toEqual([]);
    await folderMemory("owner-a", "put", restored); expect(m.data.has("owner-a")).toBe(false); expect(m.data.get("owner-b")).toBe(other);
    expect((await folderMemory("owner-a", "get"))[0].id).toBe(restored[0].id); expect(m.close).toHaveBeenCalledTimes(3);
  });
  it("persists multiple handles and IDs, never contents, File objects or previews", async () => {
    const m = memory(); const one = { id, handle: handle(), files: ["private text"], preview: "secret preview" };
    await folderMemory("owner", "put", [one, { id: "22222222-2222-4222-8222-222222222222", handle: handle("work") }]);
    const stored = m.data.get("owner:folders-v2") as { version: number; folders: unknown[] };
    expect(stored.version).toBe(2); expect(stored.folders).toHaveLength(2); expect(JSON.stringify(stored)).not.toMatch(/private text|secret preview|files|preview/);
    expect((await folderMemory("owner", "get")).map(v => v.id)).toEqual([id, "22222222-2222-4222-8222-222222222222"]);
  });
  it("disconnect memory deletes only the named account's legacy and multi-folder records", async () => {
    const m = memory(new Map<string, unknown>([["owner", handle()], ["owner:folders-v2", { version: 2, folders: [] }], ["other", handle("other")]]));
    await folderMemory("owner", "delete"); expect([...m.data.keys()]).toEqual(["other"]); expect(m.close).toHaveBeenCalled();
  });
  it("closes the database and preserves legacy metadata when persistence fails", async () => {
    const old = handle(); const m = memory(new Map([["owner", old]]), true);
    await expect(folderMemory("owner", "put", [{ id, handle: old }])).rejects.toThrow("clone failed"); expect(m.data.get("owner")).toBe(old); expect(m.close).toHaveBeenCalled();
  });
  it("fallback groups roots, enforces per-folder limits and never reads file bodies", () => {
    const f = (path: string, size = 12) => ({ webkitRelativePath: path, size, lastModified: 1, arrayBuffer: vi.fn() }) as unknown as File;
    const files = [f("notes/a.md"), f("work/a.md"), f("work/secret.txt"), f("notes/large.txt", 999999)];
    const result = fallbackFolders(files); expect(result.map(v => v.name)).toEqual(["notes", "work"]); expect(result.map(v => v.files.length)).toEqual([1, 1]); expect(result.map(v => v.skipped)).toEqual([1, 1]); expect(files[0].arrayBuffer).not.toHaveBeenCalled();
    expect(fallbackFolders(Array.from({ length: 201 }, (_, i) => f(`notes/${i}.md`)))[0]).toMatchObject({ limited: true, skipped: 1 });
  });
});
describe("multi-folder exact scope and retained authority", () => {
  it("changes only the thirteen disclosed paths", () => expect(assertMultiFolderScope()).toHaveLength(13));
  it("rejects every incomplete scope, duplicate path and adjacent backend addition", () => {
    const actual = assertMultiFolderScope();
    for (let i = 0; i < actual.length; i++) expect(() => assertMultiFolderFiles(actual.filter((_, index) => index !== i))).toThrow("FAIL-CLOSED");
    for (const extra of [actual[0], "src/app/api/local-library/confirm/route.ts", "src/lib/growth-engine/index.ts", ".env.local", "docs/unrelated.md"]) expect(() => assertMultiFolderFiles([...actual, extra])).toThrow("FAIL-CLOSED");
  });
  it("restores the complete prior monthly and task-first guards after exact wiring removal", () => {
    for (const [file, restore] of [["tests/helpers/monthly-scope.ts", restoreMultiFolderMonthly], ["tests/helpers/task-first-scope.ts", restoreMultiFolderTaskFirst]] as const) {
      expect(restore(readFileSync(file, "utf8").replace(/\r\n/g, "\n"))).toBe(execFileSync("git", ["show", `${MULTI_FOLDER_BASE}:${file}`], { encoding: "utf8" }).replace(/\r\n/g, "\n"));
    }
  });
  it("retains every confirmation, retry and edit handler and backend source byte-for-byte", () => {
    const original = (file: string) => execFileSync("git", ["show", `${MULTI_FOLDER_BASE}:${file}`], { encoding: "utf8" }).replace(/\r\n/g, "\n");
    const file = "src/app/local-library/page.tsx", slice = (s: string) => s.slice(s.indexOf("  async function save("), s.indexOf("  const buttonClass ="));
    expect(slice(readFileSync(file, "utf8").replace(/\r\n/g, "\n"))).toBe(slice(original(file)));
    for (const file of ["src/lib/local-library/store.ts", "src/lib/local-library/files.ts", "src/lib/local-library/schema.ts", "src/lib/local-library/ai.ts", "src/lib/local-library/http.ts", "src/app/api/local-library/confirm/route.ts", "package.json", "pnpm-lock.yaml"]) expect(readFileSync(file, "utf8").replace(/\r\n/g, "\n")).toBe(original(file));
  });
});