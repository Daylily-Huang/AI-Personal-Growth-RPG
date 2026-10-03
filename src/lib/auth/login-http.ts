import { NextResponse } from "next/server";

export function authResponse(body: Record<string, unknown>, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "no-store, private", Pragma: "no-cache" },
  });
}

/** Login sets cookies, so JSON alone is not a substitute for origin validation. */
export function rejectUnsafeAuthRequest(request: Request) {
  const url = new URL(request.url);
  // Next may use its bind address in request.url. Host is the browser's target;
  // forwarded host/proto headers are deliberately not trusted here.
  const target = `${url.protocol}//${request.headers.get("host") ?? url.host}`;
  if (request.headers.get("origin") !== target ||
      request.headers.get("sec-fetch-site") === "cross-site") {
    return authResponse({ error: "请从本站登录页面重试" }, 403);
  }
  if (request.headers.get("content-type")?.split(";", 1)[0].trim().toLowerCase() !== "application/json") {
    return authResponse({ error: "登录请求必须使用 JSON" }, 415);
  }
  return null;
}

// Application-specific resource limit, not a password/email standard.
export const MAX_LOGIN_BODY_BYTES = 16 * 1024;

export async function readLoginBody(request: Request, allowEmpty = false): Promise<unknown> {
  const reader = request.body?.getReader();
  if (!reader) {
    if (allowEmpty) return undefined;
    throw new SyntaxError("Missing JSON");
  }
  let bytes = 0;
  let text = "";
  const decoder = new TextDecoder("utf-8", { fatal: true });
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > MAX_LOGIN_BODY_BYTES) {
        void reader.cancel().catch(() => undefined);
        throw new RangeError("Login body too large");
      }
      text += decoder.decode(value, { stream: true });
    }
    if (bytes === 0 && allowEmpty) return undefined;
    const parsed: unknown = JSON.parse(text + decoder.decode());
    // Zod skips this own key while checking unknown object fields. Reject it
    // before schema validation, including its JSON unicode-escaped spelling.
    if (parsed !== null && typeof parsed === "object" &&
        Object.prototype.hasOwnProperty.call(parsed, "__proto__")) {
      throw new SyntaxError("Unsupported JSON field");
    }
    return parsed;
  } finally {
    reader.releaseLock();
  }
}

/** Never return or log provider messages, which may contain internal details. */
export function authFailure(error: unknown) {
  const code = error && typeof error === "object" && "code" in error ? error.code : undefined;
  if (code === "invalid_credentials") return authResponse({ error: "邮箱或密码不正确" }, 401);
  if (code === "email_not_confirmed") return authResponse({ error: "请先完成邮箱确认" }, 403);
  if (code === "over_request_rate_limit" || code === "over_email_send_rate_limit") {
    return authResponse({ error: "尝试过于频繁，请稍后重试" }, 429);
  }
  if (code === "weak_password" || code === "validation_failed" || code === "user_already_exists") {
    return authResponse({ error: "无法完成注册，请检查邮箱和密码或尝试登录" }, 400);
  }
  return authResponse({ error: "认证服务暂不可用，请稍后重试" }, 502);
}
