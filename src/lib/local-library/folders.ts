import type { Directory, FileEntry } from "./files";
import { fileLimit, supportedPath } from "./schema";

export type RememberedFolder = { id: string; handle: Directory; legacy?: boolean };
export type LinkedFile = FileEntry & { key: string; folderId: string; sourcePath: string };
export type FolderConnection = { id: string; name: string; handle?: Directory; legacy?: boolean; files: LinkedFile[]; status: "remembered" | "ready" | "unavailable"; skipped: number; limited: boolean };
type IdentityDirectory = Directory & { isSameEntry?: (other: Directory) => Promise<boolean> };
const validId = (id: unknown): id is string => typeof id === "string" && /^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i.test(id);
const isDirectory = (value: unknown): value is Directory => !!value && typeof value === "object" && (value as Directory).kind === "directory" && typeof (value as Directory).name === "string" && typeof (value as Directory).values === "function";

/** A legacy single handle keeps its original relative source paths. No scan or permission prompt. */
export function restoreFolders(value: unknown): RememberedFolder[] {
  if (value == null) return [];
  if (isDirectory(value)) return [{ id: crypto.randomUUID(), handle: value, legacy: true }];
  const record = value as { version?: unknown; folders?: unknown };
  if (record.version !== 2 || !Array.isArray(record.folders)) throw Error("已记住的文件夹格式无法读取，请重新连接");
  const folders: RememberedFolder[] = record.folders.map(item => {
    if (!item || typeof item !== "object" || !validId(item.id) || !isDirectory(item.handle) || (item.legacy !== undefined && item.legacy !== true)) throw Error("已记住的文件夹连接不完整，请重新连接");
    return { id: item.id, handle: item.handle, ...(item.legacy ? { legacy: true } : {}) };
  });
  if (new Set(folders.map(folder => folder.id)).size !== folders.length || folders.filter(folder => folder.legacy).length > 1) throw Error("已记住的文件夹连接有重复，请重新连接");
  return folders;
}

/** Account-scoped browser handles only. File objects, contents and previews are never persisted. */
export async function folderMemory(userId: string, action: "get" | "put" | "delete", folders: RememberedFolder[] = []): Promise<RememberedFolder[]> {
  const db = await new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open("growth-local-folders", 1);
    request.onupgradeneeded = () => { if (!request.result.objectStoreNames.contains("handles")) request.result.createObjectStore("handles"); };
    let settled = false;
    request.onsuccess = () => { if (settled) request.result.close(); else { settled = true; resolve(request.result); } };
    request.onerror = () => { settled = true; reject(Error("无法打开文件夹连接记忆")); };
    request.onblocked = () => { settled = true; reject(Error("另一个标签页占用文件夹记忆，请稍后重试")); };
  });
  try {
    return await new Promise((resolve, reject) => {
      const tx = db.transaction("handles", action === "get" ? "readonly" : "readwrite"), store = tx.objectStore("handles");
      const key = `${userId}:folders-v2`;
      let current: IDBRequest | undefined, legacy: IDBRequest | undefined;
      if (action === "get") { current = store.get(key); legacy = store.get(userId); }
      else {
        if (action === "put") {
          const metadata = folders.map(folder => ({ id: folder.id, handle: folder.handle, ...(folder.legacy ? { legacy: true as const } : {}) }));
          restoreFolders({ version: 2, folders: metadata });
          store.put({ version: 2, folders: metadata }, key);
        } else store.delete(key);
        store.delete(userId);
      }
      tx.oncomplete = () => { try { resolve(action === "get" ? restoreFolders(current?.result ?? legacy?.result) : []); } catch (error) { reject(error); } };
      tx.onerror = () => reject(Error("无法保存文件夹连接"));
      tx.onabort = () => reject(Error("文件夹连接保存中断"));
    });
  } finally { db.close(); }
}

export async function existingFolder(folders: FolderConnection[], handle: IdentityDirectory): Promise<FolderConnection | undefined> {
  for (const folder of folders) {
    if (!folder.handle) continue;
    if (folder.handle === handle) return folder;
    const candidate = handle as IdentityDirectory, previous = folder.handle as IdentityDirectory;
    if (candidate.isSameEntry ? await candidate.isSameEntry(previous) : previous.isSameEntry ? await previous.isSameEntry(candidate) : false) return folder;
  }
}

export function linkFiles(folder: Pick<FolderConnection, "id" | "legacy">, entries: FileEntry[]): { files: LinkedFile[]; skipped: number } {
  const files: LinkedFile[] = []; let skipped = 0;
  for (const entry of entries) {
    const sourcePath = folder.legacy ? entry.path : `${folder.id}/${entry.path}`;
    if (!supportedPath(sourcePath)) { skipped++; continue; }
    files.push({ ...entry, key: `${folder.id}:${entry.path}`, folderId: folder.id, sourcePath });
  }
  return { files, skipped };
}

/** Fallback selection adds roots instead of replacing other connected folders. Metadata only. */
export function fallbackFolders(list: readonly File[]): FolderConnection[] {
  const roots = new Map<string, File[]>();
  for (const file of list) {
    const name = file.webkitRelativePath.split("/")[0];
    if (!name || !file.webkitRelativePath.includes("/")) continue;
    const entries = roots.get(name); if (entries) entries.push(file); else roots.set(name, [file]);
  }
  return [...roots].map(([name, all]) => {
    const id = crypto.randomUUID();
    const eligible = all.filter(file => supportedPath(file.webkitRelativePath) && file.size > 0 && file.size <= fileLimit(file.webkitRelativePath));
    const entries = eligible.slice(0, 200).map(file => ({ path: file.webkitRelativePath, size: file.size, modifiedAt: file.lastModified, read: async () => file }));
    const linked = linkFiles({ id }, entries);
    return { id, name, ...linked, status: "ready" as const, skipped: all.length - entries.length + linked.skipped, limited: eligible.length > 200 };
  });
}