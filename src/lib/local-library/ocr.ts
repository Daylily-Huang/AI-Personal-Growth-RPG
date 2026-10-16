import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { z } from "zod";
import { IMAGE_DIMENSION, OCR_BODY_LIMIT, RASTER_LIMIT, TEXT_LIMIT, type OCRResult } from "./schema";
import { LibraryError } from "./store";

export async function ocrBody(request: Request): Promise<unknown> {
  const reader = request.body?.getReader(); if (!reader) throw new LibraryError("图片请求为空");
  const decoder = new TextDecoder("utf-8", { fatal: true }); let size = 0, text = "";
  try { for (;;) { const { done, value } = await reader.read(); if (done) break; size += value.byteLength; if (size > OCR_BODY_LIMIT) throw new LibraryError("图片请求过大，请裁剪后重试", 413); text += decoder.decode(value, { stream: true }); } return JSON.parse(text + decoder.decode()); }
  catch (error) { void reader.cancel().catch(() => undefined); if (error instanceof LibraryError) throw error; throw new LibraryError("图片请求无效"); }
  finally { reader.releaseLock(); }
}
export function validateRaster(base64: string): Buffer {
  const bytes = Buffer.from(base64, "base64");
  if (!bytes.length || bytes.length > RASTER_LIMIT || bytes.toString("base64") !== base64 || bytes.length < 33 ||
      !bytes.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10])) || bytes.readUInt32BE(8) !== 13 || bytes.toString("ascii", 12, 16) !== "IHDR") throw new LibraryError("图片格式无效，请重新读取", 400);
  const width = bytes.readUInt32BE(16), height = bytes.readUInt32BE(20);
  if (!width || !height || width > IMAGE_DIMENSION || height > IMAGE_DIMENSION) throw new LibraryError("图片尺寸超过本次识别范围，请裁剪后重试", 413);
  return bytes;
}
export function ocrCommand() {
  const script = path.join(process.cwd(), "scripts", "local-image-ocr.ps1");
  if (process.platform === "win32" && existsSync(script)) return { command: "C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe", script };
  const match = script.match(/^\/mnt\/([a-z])\/(.+)$/), command = "/mnt/c/Windows/System32/WindowsPowerShell/v1.0/powershell.exe";
  if (match && existsSync(command) && existsSync(script)) return { command, script: `${match[1].toUpperCase()}:\\${match[2].replaceAll("/", "\\")}` };
  throw new LibraryError("本机Windows文字识别不可用；图片未发给云端，请在Windows本机环境使用", 503);
}
const errors: Record<string, string> = {
  OCR_UNAVAILABLE: "本机未启用可用的Windows文字识别语言，图片未发给云端",
  OCR_EMPTY: "图片中未识别出文字，请换用清晰文字图片或裁剪后重试",
  OCR_IMAGE_INVALID: "图片已损坏或尺寸不支持，请重新读取或裁剪",
  OCR_TEXT_LIMIT: "图片识别文字超过64,000字符，请分区域识别",
};
const outputSchema = z.object({ text: z.string().trim().min(1).max(TEXT_LIMIT).refine(s => !s.includes("\0") && s.isWellFormed()), engine: z.literal("Windows OCR"), language: z.string().min(1).max(80) }).strict();
export function parseOCR(output: string, raster: Buffer): OCRResult {
  let raw: unknown; try { raw = JSON.parse(output); } catch { throw new LibraryError("本机文字识别返回异常，未调用云端替代服务", 503); }
  if (raw && typeof raw === "object" && "error" in raw) { const code = String(raw.error); throw new LibraryError(errors[code] ?? "本机文字识别失败，请重试或换用清晰图片", code === "OCR_UNAVAILABLE" ? 503 : 422); }
  const parsed = outputSchema.safeParse(raw); if (!parsed.success) throw new LibraryError("本机文字识别结果无效，未生成建议", 503);
  // Windows separates Chinese word tokens with spaces; retain Latin and numeric spacing.
  const text = parsed.data.text.replace(/([\p{Script=Han}\u3000-\u303f\uff00-\uffef]) +(?=[\p{Script=Han}\u3000-\u303f\uff00-\uffef])/gu, "$1");
  return { ...parsed.data, text, rasterSha256: createHash("sha256").update(raster).digest("hex") };
}
const shared = globalThis as typeof globalThis & { __rpgLocalOCR?: { busy: boolean } };
const state = shared.__rpgLocalOCR ??= { busy: false };
export async function recognizeImage(base64: string, signal?: AbortSignal): Promise<OCRResult> {
  const raster = validateRaster(base64); if (signal?.aborted) throw new LibraryError("识别已取消", 499);
  if (state.busy) throw new LibraryError("本机正在识别另一张图片，请稍后重试", 429);
  const executable = ocrCommand(); state.busy = true;
  try {
    const output = await new Promise<string>((resolve, reject) => {
      const child = spawn(/* turbopackIgnore: true */ executable.command, ["-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-File", executable.script], {
        windowsHide: true, shell: false, stdio: ["pipe", "pipe", "pipe"],
        env: { NODE_ENV: "production", SystemRoot: "C:\\Windows", WINDIR: "C:\\Windows", PATH: "C:\\Windows\\System32", TEMP: process.env.TEMP ?? process.env.TMPDIR ?? "", TMP: process.env.TMP ?? process.env.TMPDIR ?? "" },
      });
      let stdout = "", bytes = 0, failure: LibraryError | null = null, killTimer: ReturnType<typeof setTimeout> | null = null;
      const stop = (error: LibraryError) => { failure ??= error; if (killTimer) return; child.kill(); killTimer = setTimeout(() => child.kill("SIGKILL"), 2000); killTimer.unref(); };
      const timer = setTimeout(() => stop(new LibraryError("本机识别超时，请裁剪图片后重试", 504)), 30_000);
      const abort = () => stop(new LibraryError("识别已取消", 499)); signal?.addEventListener("abort", abort, { once: true });
      if (signal?.aborted) abort();
      child.stdout.setEncoding("utf8");
      child.stdout.on("data", (chunk: string) => { bytes += Buffer.byteLength(chunk); if (bytes > 1_000_000) stop(new LibraryError("识别输出过大，请分区域识别", 413)); else stdout += chunk; });
      child.stderr.resume(); child.stdin.on("error", () => stop(new LibraryError("本机识别输入失败，请重试", 503)));
      child.on("error", () => { failure ??= new LibraryError("无法启动本机文字识别，图片未发给云端", 503); });
      child.on("close", code => { clearTimeout(timer); if (killTimer) clearTimeout(killTimer); signal?.removeEventListener("abort", abort); if (failure) reject(failure); else if (code !== 0 && !stdout.trim()) reject(new LibraryError("本机文字识别失败，请重试", 503)); else resolve(stdout); });
      child.stdin.end(JSON.stringify({ base64 }));
    });
    return parseOCR(output, raster);
  } finally { state.busy = false; }
}
