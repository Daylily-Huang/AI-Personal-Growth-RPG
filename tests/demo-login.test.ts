import { describe, expect, test, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import {
  performQuickDemoLogin,
  isInvalidCredentialsError,
  DEMO_USER_EMAIL,
  DEMO_USER_PASSWORD,
} from "@/lib/auth/demo-login";

describe("Demo Quick Login & Error Discrimination (Regression Suite)", () => {
  test("1. isInvalidCredentialsError strictly identifies invalid_credentials error code and excludes others", () => {
    // True cases (strictly error.code === "invalid_credentials")
    expect(isInvalidCredentialsError({ code: "invalid_credentials", message: "Invalid login credentials", status: 400 })).toBe(true);
    expect(isInvalidCredentialsError({ code: "invalid_credentials" })).toBe(true);

    // False cases (message alone, network, 429, 500, null, undefined)
    expect(isInvalidCredentialsError({ message: "Invalid login credentials" })).toBe(false);
    expect(isInvalidCredentialsError(null)).toBe(false);
    expect(isInvalidCredentialsError(undefined)).toBe(false);
    expect(isInvalidCredentialsError(new Error("Failed to fetch"))).toBe(false);
    expect(isInvalidCredentialsError({ code: "over_request_rate_limit", status: 429, message: "Too many requests" })).toBe(false);
    expect(isInvalidCredentialsError({ code: "unexpected_failure", status: 500, message: "Internal server error" })).toBe(false);
    expect(isInvalidCredentialsError({ code: "bad_jwt", status: 401, message: "Invalid token" })).toBe(false);
  });

  test("2. demo signIn success on first attempt — never calls signUp", async () => {
    const signInWithPassword = vi.fn().mockResolvedValue({
      data: { user: { id: "u-demo" }, session: { access_token: "tok-123" } },
      error: null,
    });
    const signUp = vi.fn();

    const mockClient = {
      auth: {
        signInWithPassword,
        signUp,
      },
    } as unknown as SupabaseClient<Database>;

    const result = await performQuickDemoLogin(mockClient);

    expect(signInWithPassword).toHaveBeenCalledTimes(1);
    expect(signInWithPassword).toHaveBeenCalledWith({
      email: DEMO_USER_EMAIL,
      password: DEMO_USER_PASSWORD,
    });
    expect(signUp).not.toHaveBeenCalled();
    expect(result).toEqual({ sessionCreated: true, userCreated: false });
  });

  test("3. invalid_credentials → signUp returns session → completes without duplicate signIn", async () => {
    const signInWithPassword = vi.fn().mockResolvedValueOnce({
      data: { user: null, session: null },
      error: { code: "invalid_credentials", message: "Invalid login credentials", status: 400 },
    });
    const signUp = vi.fn().mockResolvedValueOnce({
      data: { user: { id: "u-new" }, session: { access_token: "tok-signup" } },
      error: null,
    });

    const mockClient = {
      auth: {
        signInWithPassword,
        signUp,
      },
    } as unknown as SupabaseClient<Database>;

    const result = await performQuickDemoLogin(mockClient);

    expect(signInWithPassword).toHaveBeenCalledTimes(1);
    expect(signUp).toHaveBeenCalledTimes(1);
    expect(signUp).toHaveBeenCalledWith({
      email: DEMO_USER_EMAIL,
      password: DEMO_USER_PASSWORD,
    });
    expect(result).toEqual({ sessionCreated: true, userCreated: true });
  });

  test("4. invalid_credentials → signUp has no session → retries signIn successfully", async () => {
    const signInWithPassword = vi
      .fn()
      .mockResolvedValueOnce({
        data: { user: null, session: null },
        error: { code: "invalid_credentials", message: "Invalid login credentials", status: 400 },
      })
      .mockResolvedValueOnce({
        data: { user: { id: "u-new" }, session: { access_token: "tok-retry" } },
        error: null,
      });

    const signUp = vi.fn().mockResolvedValueOnce({
      data: { user: { id: "u-new" }, session: null },
      error: null,
    });

    const mockClient = {
      auth: {
        signInWithPassword,
        signUp,
      },
    } as unknown as SupabaseClient<Database>;

    const result = await performQuickDemoLogin(mockClient);

    expect(signInWithPassword).toHaveBeenCalledTimes(2);
    expect(signUp).toHaveBeenCalledTimes(1);
    expect(result).toEqual({ sessionCreated: true, userCreated: true });
  });

  test("5. network error (Failed to fetch) must NOT trigger signUp and must throw immediately", async () => {
    const networkError = new Error("Failed to fetch");
    const signInWithPassword = vi.fn().mockResolvedValueOnce({
      data: { user: null, session: null },
      error: networkError,
    });
    const signUp = vi.fn();

    const mockClient = {
      auth: {
        signInWithPassword,
        signUp,
      },
    } as unknown as SupabaseClient<Database>;

    await expect(performQuickDemoLogin(mockClient)).rejects.toThrow("Failed to fetch");
    expect(signInWithPassword).toHaveBeenCalledTimes(1);
    expect(signUp).not.toHaveBeenCalled();
  });

  test("6. rate-limit error (429) must NOT trigger signUp and must throw immediately", async () => {
    const rateLimitError = {
      code: "over_request_rate_limit",
      message: "Too many requests. Try again later.",
      status: 429,
    };
    const signInWithPassword = vi.fn().mockResolvedValueOnce({
      data: { user: null, session: null },
      error: rateLimitError,
    });
    const signUp = vi.fn();

    const mockClient = {
      auth: {
        signInWithPassword,
        signUp,
      },
    } as unknown as SupabaseClient<Database>;

    await expect(performQuickDemoLogin(mockClient)).rejects.toEqual(rateLimitError);
    expect(signInWithPassword).toHaveBeenCalledTimes(1);
    expect(signUp).not.toHaveBeenCalled();
  });

  test("7. server 500 error must NOT trigger signUp and must throw immediately", async () => {
    const serverError = {
      code: "unexpected_failure",
      message: "Database connection failed",
      status: 500,
    };
    const signInWithPassword = vi.fn().mockResolvedValueOnce({
      data: { user: null, session: null },
      error: serverError,
    });
    const signUp = vi.fn();

    const mockClient = {
      auth: {
        signInWithPassword,
        signUp,
      },
    } as unknown as SupabaseClient<Database>;

    await expect(performQuickDemoLogin(mockClient)).rejects.toEqual(serverError);
    expect(signInWithPassword).toHaveBeenCalledTimes(1);
    expect(signUp).not.toHaveBeenCalled();
  });
});
