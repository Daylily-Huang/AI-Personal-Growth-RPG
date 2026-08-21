import { describe, expect, test } from "vitest";
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { parseSupabaseStatusOutput } = require("../scripts/export-supabase-ci-env.cjs");

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
  });
});
