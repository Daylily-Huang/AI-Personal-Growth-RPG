import { fileLimit, isImagePath, isOfficePath, TEXT_LIMIT, supportedPath, type Source } from "./schema";

export type FileEntry = { path: string; size: number; modifiedAt: number; read: () => Promise<File> };
export type Directory = {
  name: string; kind: "directory";
  values(): AsyncIterable<Directory | { name: string; kind: "file"; getFile(): Promise<File> }>;
  queryPermission(options: { mode: "read" }): Promise<PermissionState>;
  requestPermission(options: { mode: "read" }): Promise<PermissionState>;
};
export async function scanDirectory(directory: Directory): Promise<{ files: FileEntry[]; skipped: number; limited: boolean }> {
  const files: FileEntry[] = []; let visited = 0, skipped = 0, limited = false;
  async function walk(dir: Directory, prefix: string, depth: number) {
    if (depth > 8) { limited = true; return; }
    for await (const entry of dir.values()) {
      if (++visited > 2000 || files.length >= 200) { limited = true; return; }
      const filePath = `${prefix}/${entry.name}`;
      if (entry.name.startsWith(".") || /^(node_modules|vendor|dist|build|__pycache__|coverage)$/i.test(entry.name)) { skipped++; continue; }
      if (entry.kind === "directory") await walk(entry, filePath, depth + 1);
      else if (supportedPath(filePath)) {
        try {
          const file = await entry.getFile();
          if (file.size > fileLimit(filePath) || !file.size) { skipped++; continue; }
          files.push({ path: filePath, size: file.size, modifiedAt: file.lastModified, read: () => entry.getFile() });
        } catch { skipped++; }
      } else skipped++;
      if (limited && (visited > 2000 || files.length >= 200)) return;
    }
  }
  await walk(directory, directory.name, 0);
  return { files: files.sort((a, b) => a.path.localeCompare(b.path)), skipped, limited };
}
export async function readSource(entry: FileEntry): Promise<Source> {
  if (!supportedPath(entry.path)) throw Error("文件类型或路径不支持");
  if (isImagePath(entry.path)) throw Error("请先在本机识别图片文字并核对，再交给AI整理");
  const file = await entry.read();
  if (!file.size || file.size > fileLimit(entry.path)) throw Error(isOfficePath(entry.path) ? "文档为空或超过20MB，请拆分后重试" : "文件为空或超过128KB，请选择较小的文本文件");
  const bytes = await file.arrayBuffer();
  const content = isOfficePath(entry.path)
    ? await (await import("./office")).extractOffice(new Uint8Array(bytes), entry.path)
    : new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  if (!content.trim() || content.includes("\0") || !content.isWellFormed()) throw Error("文件不是可读取的UTF-8文本");
  if (content.trim().length > TEXT_LIMIT) throw Error("文字超过64,000字符，请拆分文件后重试；不会自动截断");
  // Bind the source version to exactly the transmitted, trimmed UTF-8 text.
  const canonical = new TextEncoder().encode(content.trim());
  const digest = await crypto.subtle.digest("SHA-256", canonical);
  return { path: entry.path, sha256: [...new Uint8Array(digest)].map(b => b.toString(16).padStart(2, "0")).join(""), content: content.trim() };
}

/** Browser-only handle storage, scoped to the authenticated account. No file contents. */
export async function directoryMemory(userId: string, action: "get" | "put" | "delete", value?: Directory): Promise<Directory | null> {
  const db = await new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open("growth-local-folders", 1);
    request.onupgradeneeded = () => request.result.createObjectStore("handles");
    request.onsuccess = () => resolve(request.result); request.onerror = () => reject(Error("无法记住文件夹连接"));
  });
  try {
    return await new Promise((resolve, reject) => {
      const transaction = db.transaction("handles", action === "get" ? "readonly" : "readwrite");
      const store = transaction.objectStore("handles");
      const request = action === "get" ? store.get(userId) : action === "put" ? store.put(value, userId) : store.delete(userId);
      transaction.oncomplete = () => resolve(action === "get" ? request.result ?? null : null);
      transaction.onerror = () => reject(Error("无法保存文件夹连接"));
      transaction.onabort = () => reject(Error("文件夹连接保存中断"));
    });
  } finally { db.close(); }
}
