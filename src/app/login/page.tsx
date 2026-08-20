"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Sparkles, KeyRound, Mail, ArrowRight, Loader2, UserCheck, ShieldCheck } from "lucide-react";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";
import { isSupabaseConfigured } from "@/lib/supabase/env";

export default function LoginPage() {
  const router = useRouter();
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const isConfigured = isSupabaseConfigured();

  async function handleAuth(e: React.FormEvent) {
    e.preventDefault();
    if (!email || !password || loading) return;

    setLoading(true);
    setError(null);
    setMessage(null);

    try {
      if (!isConfigured) {
        // Fallback for unconfigured demo environment
        router.push("/dashboard");
        return;
      }

      const client = getSupabaseBrowserClient();
      if (isSignUp) {
        const { data, error: signUpError } = await client.auth.signUp({
          email,
          password,
        });
        if (signUpError) throw signUpError;
        if (data.session) {
          router.push("/dashboard");
          router.refresh();
        } else {
          setMessage("注册成功！如果需要邮箱确认，请查收邮件；或者尝试直接登录。");
          setIsSignUp(false);
        }
      } else {
        const { error: signInError } = await client.auth.signInWithPassword({
          email,
          password,
        });
        if (signInError) throw signInError;
        router.push("/dashboard");
        router.refresh();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "认证失败，请重试");
    } finally {
      setLoading(false);
    }
  }

  async function handleQuickDemoLogin() {
    setLoading(true);
    setError(null);
    setMessage(null);

    const demoEmail = "demo_player@growth.rpg";
    const demoPassword = "Password123!";

    try {
      if (!isConfigured) {
        router.push("/dashboard");
        return;
      }

      const client = getSupabaseBrowserClient();
      // Try to sign in first
      const { error: signInErr } = await client.auth.signInWithPassword({
        email: demoEmail,
        password: demoPassword,
      });

      if (signInErr) {
        // If user not found, sign up then sign in
        const { error: signUpErr } = await client.auth.signUp({
          email: demoEmail,
          password: demoPassword,
        });
        if (signUpErr && !signUpErr.message.includes("already registered")) {
          throw signUpErr;
        }
        const { error: retrySignInErr } = await client.auth.signInWithPassword({
          email: demoEmail,
          password: demoPassword,
        });
        if (retrySignInErr) throw retrySignInErr;
      }

      router.push("/dashboard");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "快速登录失败");
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#0b0f17] text-zinc-100 flex flex-col justify-center items-center px-4 py-12">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center p-3 rounded-2xl bg-amber-400/10 border border-amber-400/20 text-amber-300 mb-2">
            <Sparkles className="h-8 w-8" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-100">
            AI Personal Growth RPG
          </h1>
          <p className="text-sm text-zinc-400">
            把现实生活中的真实积累，转化为可验证的 RPG 永久角色成长
          </p>
        </div>

        <div className="rounded-2xl border border-white/10 bg-[#0d1320] p-6 sm:p-8 shadow-2xl space-y-6">
          <div className="flex border-b border-white/10 pb-4">
            <button
              type="button"
              onClick={() => {
                setIsSignUp(false);
                setError(null);
                setMessage(null);
              }}
              className={`flex-1 text-center py-2 text-sm font-medium transition-colors border-b-2 -mb-4 ${
                !isSignUp
                  ? "border-amber-400 text-amber-300"
                  : "border-transparent text-zinc-400 hover:text-zinc-200"
              }`}
            >
              登录已有账号
            </button>
            <button
              type="button"
              onClick={() => {
                setIsSignUp(true);
                setError(null);
                setMessage(null);
              }}
              className={`flex-1 text-center py-2 text-sm font-medium transition-colors border-b-2 -mb-4 ${
                isSignUp
                  ? "border-amber-400 text-amber-300"
                  : "border-transparent text-zinc-400 hover:text-zinc-200"
              }`}
            >
              注册新玩家
            </button>
          </div>

          {error ? (
            <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-300">
              {error}
            </div>
          ) : null}

          {message ? (
            <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3 text-xs text-emerald-300">
              {message}
            </div>
          ) : null}

          <form onSubmit={handleAuth} className="space-y-4">
            <div className="space-y-1">
              <label className="block text-xs font-medium text-zinc-400">电子邮箱</label>
              <div className="relative">
                <Mail className="absolute left-3 top-2.5 h-4 w-4 text-zinc-500" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="player@example.com"
                  className="w-full rounded-lg border border-white/10 bg-black/40 pl-9 pr-3 py-2 text-sm text-zinc-200 placeholder-zinc-600 focus:border-amber-400 focus:outline-none"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="block text-xs font-medium text-zinc-400">密码</label>
              <div className="relative">
                <KeyRound className="absolute left-3 top-2.5 h-4 w-4 text-zinc-500" />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full rounded-lg border border-white/10 bg-black/40 pl-9 pr-3 py-2 text-sm text-zinc-200 placeholder-zinc-600 focus:border-amber-400 focus:outline-none"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-amber-500 to-amber-600 px-4 py-2.5 text-sm font-semibold text-black shadow-lg shadow-amber-500/20 hover:from-amber-400 hover:to-amber-500 disabled:opacity-50 cursor-pointer"
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  {isSignUp ? "创建角色并开始" : "进入 RPG 世界"}
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </button>
          </form>

          <div className="relative flex items-center justify-center py-2">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-white/10" />
            </div>
            <span className="relative bg-[#0d1320] px-3 text-[11px] uppercase tracking-wider text-zinc-500">
              或者快速开始
            </span>
          </div>

          <button
            type="button"
            onClick={handleQuickDemoLogin}
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 rounded-lg border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-medium text-zinc-200 hover:bg-white/10 hover:text-white disabled:opacity-50 cursor-pointer transition-colors"
          >
            <UserCheck className="h-4 w-4 text-emerald-400" />
            一键体验测试玩家账号
          </button>
        </div>

        <div className="flex items-center justify-center gap-2 text-xs text-zinc-500 text-center">
          <ShieldCheck className="h-3.5 w-3.5 text-zinc-400" />
          <span>PostgreSQL RLS 隔离保护 · 权威服务端结算 · 杜绝虚假打卡</span>
        </div>
      </div>
    </div>
  );
}
