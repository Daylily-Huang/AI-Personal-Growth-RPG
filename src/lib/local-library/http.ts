import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { getProjectConfig } from "@/lib/supabase/env";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { BODY_LIMIT } from "./schema";
import { LibraryError } from "./store";

export function libraryResponse(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: { "Cache-Control": "private, no-store", Pragma: "no-cache", Vary: "Cookie" } });
}
export function localHost(host: string) { return ["127.0.0.1", "localhost", "[::1]"].includes(host); }
export function requireLocalRequest(request: Request) {
  const url = new URL(request.url), host = request.headers.get("host");
  let actual: URL;
  try { actual = new URL(`${url.protocol}//${host}`); } catch { throw new LibraryError("本地资料只能从本机网站访问", 403); }
  // Next may use localhost internally while the browser uses 127.0.0.1.
  if (!host || actual.host !== host || actual.port !== url.port || !localHost(actual.hostname) || !localHost(url.hostname) || !["http:", "https:"].includes(url.protocol) || url.search ||
      request.headers.get("sec-fetch-site") === "cross-site" || (request.headers.has("x-forwarded-host") && request.headers.get("x-forwarded-host") !== host)) throw new LibraryError("本地资料只能从本机网站访问", 403);
  if (request.method === "POST" && request.headers.get("origin") !== actual.origin) throw new LibraryError("请从本站本地资料页面操作", 403);
  if (request.method === "POST" && !/^application\/json(?:\s*;\s*charset=utf-8)?$/i.test(request.headers.get("content-type") ?? "")) throw new LibraryError("请求必须使用UTF-8 JSON", 415);
}
export async function libraryUser(request: Request) {
  requireLocalRequest(request);
  const config = getProjectConfig();
  if (!localHost(new URL(config.url).hostname)) throw new LibraryError("本地资料要求本机数据库，已停止操作", 403);
  const client = await getSupabaseServerClient();
  const { data, error } = await client.auth.getUser();
  if (error || !data.user) throw new LibraryError("请先登录后连接本地资料", error && error.status && error.status >= 500 ? 503 : 401);
  return { client, userId: data.user.id };
}
export async function libraryBody(request: Request): Promise<unknown> {
  const reader = request.body?.getReader();
  if (!reader) throw new LibraryError("请求为空");
  const decoder = new TextDecoder("utf-8", { fatal: true }); let size = 0, body = "";
  try {
    for (;;) {
      const { done, value } = await reader.read(); if (done) break;
      size += value.byteLength; if (size > BODY_LIMIT) throw new LibraryError("所选资料超过本次读取上限，请减少文件", 413);
      body += decoder.decode(value, { stream: true });
    }
    return JSON.parse(body + decoder.decode());
  } catch (e) {
    void reader.cancel().catch(() => undefined);
    if (e instanceof LibraryError) throw e;
    throw new LibraryError("请求内容无效");
  } finally { reader.releaseLock(); }
}
export function libraryFailure(error: unknown) {
  if (error instanceof LibraryError) return libraryResponse({ error: error.message, ...(error.activityId ? { activityId: error.activityId } : {}) }, error.status);
  if (error instanceof ZodError) return libraryResponse({ error: "资料或建议格式不符合要求，请检查后重试" }, 400);
  return libraryResponse({ error: "本地资料服务暂不可用；没有自动重试或调用替代模型" }, 503);
}
