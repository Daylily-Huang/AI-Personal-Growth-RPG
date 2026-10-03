import { z } from "zod";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { performQuickDemoLogin } from "@/lib/auth/demo-login";
import { isDevDemoEnabled } from "@/lib/auth/dev-demo";
import { authFailure, authResponse, readLoginBody, rejectUnsafeAuthRequest } from "@/lib/auth/login-http";

const demoInput = z.object({}).strict().optional();

export async function POST(request: Request) {
  if (!isDevDemoEnabled()) return authResponse({ error: "体验账号入口未启用" }, 404);
  const rejected = rejectUnsafeAuthRequest(request);
  if (rejected) return rejected;
  try {
    if (!isSupabaseConfigured()) {
      return authResponse({ error: "登录服务尚未配置" }, 503);
    }

    let body: unknown;
    try {
      // This command has no arguments; the existing UI sends no body.
      body = await readLoginBody(request, true);
    } catch (error) {
      return authResponse({ error: "体验登录请求格式不正确" }, error instanceof RangeError ? 413 : 400);
    }
    if (!demoInput.safeParse(body).success) {
      return authResponse({ error: "体验登录请求不接受参数" }, 400);
    }

    const client = await getSupabaseServerClient();
    const result = await performQuickDemoLogin(client);
    const { data, error } = await client.auth.getUser();
    if (error) throw error;
    if (!data.user?.id || !result.sessionCreated) return authFailure(null);
    return authResponse({ success: true, hasSession: true });
  } catch (error) {
    return authFailure(error);
  }
}
