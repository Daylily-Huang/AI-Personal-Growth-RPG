import { z } from "zod";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { authFailure, authResponse, readLoginBody, rejectUnsafeAuthRequest } from "@/lib/auth/login-http";

const credentials = z.object({
  email: z.string().trim().email(),
  password: z.string().min(1),
  isSignUp: z.boolean().default(false),
}).strict();

export async function POST(request: Request) {
  const rejected = rejectUnsafeAuthRequest(request);
  if (rejected) return rejected;
  if (!isSupabaseConfigured()) return authResponse({ error: "登录服务尚未配置" }, 503);

  let body: unknown;
  try {
    body = await readLoginBody(request);
  } catch (error) {
    return authResponse({ error: "登录请求无效" }, error instanceof RangeError ? 413 : 400);
  }
  const parsed = credentials.safeParse(body);
  if (!parsed.success) return authResponse({ error: "请填写有效的邮箱和密码" }, 400);
  const { email, password, isSignUp } = parsed.data;

  try {
    const client = await getSupabaseServerClient();
    if (isSignUp) {
      const { data, error: signUpError } = await client.auth.signUp({
        email,
        password,
      });
      if (signUpError) throw signUpError;
      if (!data.user?.id) return authFailure(null);
      return authResponse({ success: true, hasSession: Boolean(data.session) });
    } else {
      const { data, error: signInError } = await client.auth.signInWithPassword({
        email,
        password,
      });
      if (signInError) throw signInError;
      if (!data.user?.id || !data.session) return authFailure(null);
      return authResponse({ success: true, hasSession: true });
    }
  } catch (error) {
    return authFailure(error);
  }
}
