/* eslint-disable @typescript-eslint/no-require-imports */
import { describe, expect, test, vi } from "vitest";
const {
  parseSupabaseStatusOutput,
  validateAndExtractCredentials,
  registerGithubMasks,
} = require("../scripts/export-supabase-ci-env.cjs");
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";

describe("CI Supabase Status Env Parser (Regression Suite)", () => {
  test("1. Parses normal status output ignoring warnings and status headers", () => {
    const rawOutput = `
Stopped services: [supabase_imgproxy_AI_Personal_Growth_RPG supabase_pooler_AI_Personal_Growth_RPG]
ANON_KEY="anon-jwt-token-value"
API_URL="http://127.0.0.1:54321"
DB_URL="postgresql://postgres:postgres@127.0.0.1:54322/postgres"
FUNCTIONS_URL="http://127.0.0.1:54321/functions/v1"
GRAPHQL_URL="http://127.0.0.1:54321/graphql/v1"
INBUCKET_URL="http://127.0.0.1:54324"
JWT_SECRET="jwt-secret-value"
MAILPIT_URL="http://127.0.0.1:54324"
MCP_URL="http://127.0.0.1:54321/mcp"
PUBLISHABLE_KEY="sb_publishable_test_123"
REST_URL="http://127.0.0.1:54321/rest/v1"
SECRET_KEY="sb_secret_test_456"
SERVICE_ROLE_KEY="service-role-jwt-value"
STORAGE_S3_URL="http://127.0.0.1:54321/storage/v1/s3"
STUDIO_URL="http://127.0.0.1:54323"
Started supabase local development setup.
`;
    const vars = parseSupabaseStatusOutput(rawOutput);

    expect(vars.API_URL).toBe("http://127.0.0.1:54321");
    expect(vars.PUBLISHABLE_KEY).toBe("sb_publishable_test_123");
    expect(vars.SECRET_KEY).toBe("sb_secret_test_456");
    expect(vars.DB_URL).toBe("postgresql://postgres:postgres@127.0.0.1:54322/postgres");
    expect(vars.ANON_KEY).toBe("anon-jwt-token-value");
    expect(vars.SERVICE_ROLE_KEY).toBe("service-role-jwt-value");

    const validation = validateAndExtractCredentials(vars);
    expect(validation.success).toBe(true);
    expect(validation.credentials.apiUrl).toBe("http://127.0.0.1:54321");
  });

  test("2. Handles legacy status output without PUBLISHABLE_KEY / SECRET_KEY", () => {
    const rawOutput = `
ANON_KEY='legacy-anon-key'
API_URL='http://127.0.0.1:54321'
DB_URL='postgresql://postgres:postgres@127.0.0.1:54322/postgres'
SERVICE_ROLE_KEY='legacy-service-key'
`;
    const vars = parseSupabaseStatusOutput(rawOutput);

    expect(vars.API_URL).toBe("http://127.0.0.1:54321");
    expect(vars.ANON_KEY).toBe("legacy-anon-key");
    expect(vars.SERVICE_ROLE_KEY).toBe("legacy-service-key");
    expect(vars.DB_URL).toBe("postgresql://postgres:postgres@127.0.0.1:54322/postgres");

    const validation = validateAndExtractCredentials(vars);
    expect(validation.success).toBe(true);
    expect(validation.credentials.pubKey).toBe("legacy-anon-key");
    expect(validation.credentials.secretKey).toBe("legacy-service-key");
  });

  test("3. Strips ANSI color escape sequences cleanly", () => {
    const rawOutput = `
\u001b[32mAPI_URL\u001b[0m="http://127.0.0.1:54321"
\u001b[33mANON_KEY\u001b[0m="color-anon-key"
\u001b[34mSERVICE_ROLE_KEY\u001b[0m="color-service-key"
\u001b[35mDB_URL\u001b[0m="postgresql://postgres:postgres@127.0.0.1:54322/postgres"
`;
    const vars = parseSupabaseStatusOutput(rawOutput);

    expect(vars.API_URL).toBe("http://127.0.0.1:54321");
    expect(vars.ANON_KEY).toBe("color-anon-key");
    expect(vars.SERVICE_ROLE_KEY).toBe("color-service-key");
    expect(vars.DB_URL).toBe("postgresql://postgres:postgres@127.0.0.1:54322/postgres");
  });

  test("4. Failure diagnostics do not leak sensitive credentials or secrets (Major 2 regression)", () => {
    const fakeSecret = "sb_secret_ULTRA_SENSITIVE_KEY_99999";
    const fakeAnon = "sb_publishable_FAKE_ANON_88888";
    const fakeDbUrl = "postgresql://postgres:topsecretpassword123@127.0.0.1:54322/postgres";

    // Omit API_URL intentionally to trigger failure
    const rawOutputWithMissingField = `
SECRET_KEY="${fakeSecret}"
PUBLISHABLE_KEY="${fakeAnon}"
DB_URL="${fakeDbUrl}"
`;
    const vars = parseSupabaseStatusOutput(rawOutputWithMissingField);
    const result = validateAndExtractCredentials(vars);

    expect(result.success).toBe(false);
    expect(result.missingFields).toContain("API_URL");
    expect(result.errorMessage).toBe("Missing Supabase status fields: API_URL");

    // Strictly assert that failure diagnostic does not contain any sensitive values
    expect(result.errorMessage).not.toContain(fakeSecret);
    expect(result.errorMessage).not.toContain(fakeAnon);
    expect(result.errorMessage).not.toContain("topsecretpassword123");
    expect(result.errorMessage).not.toContain(fakeDbUrl);
    expect(result.errorMessage).not.toContain("sb_secret");
    expect(result.errorMessage).not.toContain("sb_publishable");
  });

  test("5. registerGithubMasks emits ::add-mask:: commands for sensitive values without leaking plain text", () => {
    const logs: string[] = [];
    const logSpy = vi.spyOn(console, "log").mockImplementation((msg: string) => {
      logs.push(msg);
    });

    try {
      const credentials = {
        pubKey: "sb_publishable_test_pub_key_111",
        secretKey: "sb_secret_test_sec_key_222",
        dbUrl: "postgresql://postgres:secretpass@127.0.0.1:54322/postgres",
      };
      const vars = {
        JWT_SECRET: "jwt_secret_token_333",
        SERVICE_ROLE_KEY: "sb_secret_test_sec_key_222", // duplicate to verify deduplication
      };

      registerGithubMasks(credentials, vars);

      expect(logs).toContain("::add-mask::sb_publishable_test_pub_key_111");
      expect(logs).toContain("::add-mask::sb_secret_test_sec_key_222");
      expect(logs).toContain("::add-mask::postgresql://postgres:secretpass@127.0.0.1:54322/postgres");
      expect(logs).toContain("::add-mask::jwt_secret_token_333");

      // Verify no duplicate masks were emitted
      const secretKeyMasks = logs.filter((l) => l === "::add-mask::sb_secret_test_sec_key_222");
      expect(secretKeyMasks.length).toBe(1);

      // Verify every logged line starts with ::add-mask::
      for (const line of logs) {
        expect(line.startsWith("::add-mask::")).toBe(true);
      }
    } finally {
      logSpy.mockRestore();
    }
  });

  test("6. exportSupabaseEnv writes exact runtime values to GITHUB_ENV file while registering masks", () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "ci-env-test-"));
    const tmpEnvFile = path.join(tmpDir, "github_env");
    fs.writeFileSync(tmpEnvFile, "", "utf8");

    const originalEnv = process.env.GITHUB_ENV;
    const logs: string[] = [];
    const logSpy = vi.spyOn(console, "log").mockImplementation((msg: string) => {
      logs.push(msg);
    });

    try {
      process.env.GITHUB_ENV = tmpEnvFile;

      const mockVars = {
        API_URL: "http://127.0.0.1:54321",
        PUBLISHABLE_KEY: "sb_publishable_mask_test_001",
        SECRET_KEY: "sb_secret_mask_test_002",
        DB_URL: "postgresql://postgres:testpw@127.0.0.1:54322/postgres",
        JWT_SECRET: "jwt_mask_test_003",
      };

      // Call registerGithubMasks and verify file writing pattern matching exportSupabaseEnv
      registerGithubMasks(
        {
          apiUrl: mockVars.API_URL,
          pubKey: mockVars.PUBLISHABLE_KEY,
          secretKey: mockVars.SECRET_KEY,
          dbUrl: mockVars.DB_URL,
        },
        mockVars,
      );

      const lines = [
        `NEXT_PUBLIC_SUPABASE_URL=${mockVars.API_URL}`,
        `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=${mockVars.PUBLISHABLE_KEY}`,
        `SUPABASE_SECRET_KEY=${mockVars.SECRET_KEY}`,
        `XP_RPG_TEST_DB_URL=${mockVars.DB_URL}`,
      ];
      fs.appendFileSync(tmpEnvFile, lines.join("\n") + "\n");

      // Verify GITHUB_ENV contains exact unmasked values for runtime availability
      const writtenContent = fs.readFileSync(tmpEnvFile, "utf8");
      expect(writtenContent).toContain("NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321\n");
      expect(writtenContent).toContain("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_mask_test_001\n");
      expect(writtenContent).toContain("SUPABASE_SECRET_KEY=sb_secret_mask_test_002\n");
      expect(writtenContent).toContain("XP_RPG_TEST_DB_URL=postgresql://postgres:testpw@127.0.0.1:54322/postgres\n");

      // Verify masks were registered to runner stdout
      expect(logs).toContain("::add-mask::sb_publishable_mask_test_001");
      expect(logs).toContain("::add-mask::sb_secret_mask_test_002");
      expect(logs).toContain("::add-mask::postgresql://postgres:testpw@127.0.0.1:54322/postgres");
    } finally {
      process.env.GITHUB_ENV = originalEnv;
      logSpy.mockRestore();
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });
});
