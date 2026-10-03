"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Sparkles, KeyRound, Mail, ArrowRight, Loader2, UserCheck, ShieldCheck } from "lucide-react";
import { isDevDemoEnabled } from "@/lib/auth/dev-demo";

export default function LoginPage() {
  const router = useRouter();
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const demoEnabled = isDevDemoEnabled();

  async function handleAuth(e: React.FormEvent) {
    e.preventDefault();
    if (!email || !password || loading) return;

    setLoading(true);
    setError(null);
    setMessage(null);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, isSignUp }),
      });

      const data = await res.json();
      if (!res.ok || data.error || data.success !== true || typeof data.hasSession !== "boolean") {
        throw new Error(data.error || "认证失败，请重试");
      }

      if (isSignUp && !data.hasSession) {
        setMessage("注册成功！如果需要邮箱确认，请查收邮件；或者尝试直接登录。");
        setIsSignUp(false);
      } else if (data.hasSession) {
        router.push("/dashboard");
        router.refresh();
      } else {
        throw new Error("未建立登录会话，请重试");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "认证失败，请重试");
    } finally {
      setLoading(false);
    }
  }

  async function handleQuickDemoLogin() {
    if (loading || !demoEnabled) return;
    setLoading(true);
    setError(null);
    setMessage(null);

    try {
      const res = await fetch("/api/auth/demo-login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      const data = await res.json();
      if (!res.ok || data.error || data.success !== true || data.hasSession !== true) {
        throw new Error(data.error || "快速登录失败");
      }

      router.push("/dashboard");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "快速登录失败");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main
      className="min-h-screen bg-[#0b0f17] text-zinc-100 flex flex-col justify-center items-center px-4 py-12"
      aria-labelledby="login-title"
    >
      <div className="w-full max-w-md space-y-8">
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center p-3 rounded-2xl bg-amber-400/10 border border-amber-400/20 text-amber-300 mb-2">
            <Sparkles className="h-8 w-8" aria-hidden="true" />
          </div>
          <h1 id="login-title" className="text-2xl font-bold tracking-tight text-zinc-100">
            AI Personal Growth RPG
          </h1>
          <p className="text-sm text-zinc-400">
            把现实生活中的真实积累，转化为可验证的 RPG 永久角色成长
          </p>
        </div>

        <div className="rounded-2xl border border-white/10 bg-[#0d1320] p-6 sm:p-8 shadow-2xl space-y-6">
          {demoEnabled ? (
            <div className="space-y-4">
              <button
                type="button"
                onClick={handleQuickDemoLogin}
                disabled={loading}
                className="min-h-[var(--touch-target-min)] w-full flex items-center justify-center gap-2 rounded-xl border border-emerald-500/40 bg-emerald-500/15 px-4 py-3 text-sm font-semibold text-emerald-300 hover:bg-emerald-500/25 hover:text-emerald-100 disabled:opacity-50 cursor-pointer transition-all shadow-lg shadow-emerald-950/30"
              >
                <UserCheck className="h-5 w-5 text-emerald-400" aria-hidden="true" />
                一键体验测试玩家账号（免输账号密码）
              </button>

              <div className="relative flex items-center justify-center py-1">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-white/10" />
                </div>
                <span className="relative bg-[#0d1320] px-3 text-[11px] uppercase tracking-wider text-zinc-500">
                  或者使用已有账号登录
                </span>
              </div>
            </div>
          ) : null}

          <div className="flex border-b border-white/10 pb-4">
            <button
              type="button"
              disabled={loading}
              onClick={() => {
                setIsSignUp(false);
                setError(null);
                setMessage(null);
              }}
              className={`min-h-[var(--touch-target-min)] flex-1 text-center py-2 text-sm font-medium transition-colors border-b-2 -mb-4 ${
                !isSignUp
                  ? "border-amber-400 text-amber-300"
                  : "border-transparent text-zinc-400 hover:text-zinc-200"
              }`}
            >
              登录已有账号
            </button>
            <button
              type="button"
              disabled={loading}
              onClick={() => {
                setIsSignUp(true);
                setError(null);
                setMessage(null);
              }}
              className={`min-h-[var(--touch-target-min)] flex-1 text-center py-2 text-sm font-medium transition-colors border-b-2 -mb-4 ${
                isSignUp
                  ? "border-amber-400 text-amber-300"
                  : "border-transparent text-zinc-400 hover:text-zinc-200"
              }`}
            >
              注册新玩家
            </button>
          </div>

          {error ? (
              <div role="alert" className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-300">
              {error}
            </div>
          ) : null}

          {message ? (
              <div role="status" className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3 text-xs text-emerald-300">
              {message}
            </div>
          ) : null}

          <form onSubmit={handleAuth} className="space-y-4">
            <div className="space-y-1">
               <label htmlFor="login-email" className="block text-xs font-medium text-zinc-400">电子邮箱</label>
              <div className="relative">
                 <Mail className="absolute left-3 top-2.5 h-4 w-4 text-zinc-500" aria-hidden="true" />
                 <input
                   id="login-email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="player@example.com"
                  className="min-h-[var(--touch-target-min)] w-full rounded-lg border border-white/10 bg-black/40 pl-9 pr-3 py-2 text-sm text-zinc-200 placeholder-zinc-600 focus:border-amber-400 focus:outline-none"
                />
              </div>
            </div>

            <div className="space-y-1">
               <label htmlFor="login-password" className="block text-xs font-medium text-zinc-400">密码</label>
              <div className="relative">
                 <KeyRound className="absolute left-3 top-2.5 h-4 w-4 text-zinc-500" aria-hidden="true" />
                 <input
                   id="login-password"
                  type="password"
                  autoComplete={isSignUp ? "new-password" : "current-password"}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="min-h-[var(--touch-target-min)] w-full rounded-lg border border-white/10 bg-black/40 pl-9 pr-3 py-2 text-sm text-zinc-200 placeholder-zinc-600 focus:border-amber-400 focus:outline-none"
                />
              </div>
            </div>

            <button
               type="submit"
               disabled={loading}
               aria-label={loading ? (isSignUp ? "正在创建角色" : "正在登录") : undefined}
              className="min-h-[var(--touch-target-min)] w-full flex items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-amber-500 to-amber-600 px-4 py-2.5 text-sm font-semibold text-black shadow-lg shadow-amber-500/20 hover:from-amber-400 hover:to-amber-500 disabled:opacity-50 cursor-pointer"
            >
              {loading ? (
                 <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />
              ) : (
                <>
                  {isSignUp ? "创建角色并开始" : "进入 RPG 世界"}
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </>
              )}
            </button>
          </form>
        </div>

        <div className="flex items-center justify-center gap-2 text-xs text-zinc-500 text-center">
           <ShieldCheck className="h-3.5 w-3.5 text-zinc-400" aria-hidden="true" />
          <span>PostgreSQL RLS 隔离保护 · 权威服务端结算 · 杜绝虚假打卡</span>
        </div>
      </div>
    </main>
  );
}
