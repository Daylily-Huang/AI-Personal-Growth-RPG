import { describe, expect, test } from "vitest";
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { sanitizeSupabaseLog } = require("../scripts/lib/sanitize-supabase-log.cjs");

/**
 * Gate 5D — CI diagnostics must remain 100% sanitized (P1-1).
 * `supabase start` prints local publishable/secret keys, storage keys and the
 * JWT secret; the CI wrapper must redact all of them while keeping failure
 * context (URLs, step names) debuggable.
 */
const SAMPLE_START_OUTPUT = `
API URL: http://127.0.0.1:54321
GraphQL URL: http://127.0.0.1:54321/graphql/v1
DB URL: postgresql://postgres:postgres@127.0.0.1:54322/postgres
Studio URL: http://127.0.0.1:54323
Inbucket URL: http://127.0.0.1:54324
JWT secret: super-secret-jwt-token-with-at-least-32-characters-long
anon key: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0
service_role key: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU
Storage URL: http://127.0.0.1:54321/storage/v1/s3
Storage Access Key: 6a7c8d9e0f1a2b3c4d5e6f7a
Storage Secret Key: 9f8e7d6c5b4a3f2e1d0c9b8a7f6e5d4c
S3 Access Key: 6a7c8d9e0f1a2b3c4d5e6f7a
S3 Secret Key: 9f8e7d6c5b4a3f2e1d0c9b8a7f6e5d4c
publishable key: sb_publishable_abc123def456ghi789jkl
secret key: sb_secret_xyz987wvu654tsr321
`;

const FORBIDDEN = [
  "sb_secret_xyz987wvu654tsr321",
  "sb_publishable_abc123def456ghi789jkl",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9",
  "super-secret-jwt-token-with-at-least-32-characters-long",
  "9f8e7d6c5b4a3f2e1d0c9b8a7f6e5d4c",
  "6a7c8d9e0f1a2b3c4d5e6f7a",
  "postgres:postgres@",
];

describe("Stage 5D — CI supabase-start log sanitization (P1-1)", () => {
  const sanitized = sanitizeSupabaseLog(SAMPLE_START_OUTPUT);

  for (const secret of FORBIDDEN) {
    test(`redacts ${secret.slice(0, 24)}...`, () => {
      expect(sanitized).not.toContain(secret);
    });
  }

  test("keeps debugging context: URLs and step names survive", () => {
    expect(sanitized).toContain("API URL: http://127.0.0.1:54321");
    expect(sanitized).toContain("service_role key: [REDACTED]");
    expect(sanitized).toContain("DB URL: postgresql://[REDACTED]@127.0.0.1:54322/postgres");
  });

  test("idempotent: sanitizing twice changes nothing", () => {
    expect(sanitizeSupabaseLog(sanitized)).toBe(sanitized);
  });

  test("empty and non-secret input pass through unchanged", () => {
    expect(sanitizeSupabaseLog("")).toBe("");
    expect(sanitizeSupabaseLog("migrations applied\nschema loaded")).toBe(
      "migrations applied\nschema loaded",
    );
  });
});

const SAMPLE_BOX_TABLE_OUTPUT = `
┌──────────────────────┬────────────────────────────────────────────────────────┐
│ Service              │ URL                                                    │
├──────────────────────┼────────────────────────────────────────────────────────┤
│ API URL              │ http://127.0.0.1:54321                                 │
│ GraphQL URL          │ http://127.0.0.1:54321/graphql/v1                      │
│ Inbucket URL         │ http://127.0.0.1:54324                                 │
│ Studio URL           │ http://127.0.0.1:54323                                 │
│ DB URL               │ postgresql://postgres:postgres@127.0.0.1:54322/postgres │
│ Storage URL          │ http://127.0.0.1:54321/storage/v1/s3                   │
├──────────────────────┼────────────────────────────────────────────────────────┤
│ Key / Secret         │ Value                                                  │
├──────────────────────┼────────────────────────────────────────────────────────┤
│ anon key             │ eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0 │
│ service_role key     │ eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU │
│ Storage Access Key   │ 6a7c8d9e0f1a2b3c4d5e6f7a                               │
│ Storage Secret Key   │ 9f8e7d6c5b4a3f2e1d0c9b8a7f6e5d4c                       │
│ S3 Access Key        │ 6a7c8d9e0f1a2b3c4d5e6f7a                               │
│ S3 Secret Key        │ 9f8e7d6c5b4a3f2e1d0c9b8a7f6e5d4c                       │
│ Secret Key           │ 4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e                       │
│ JWT Secret           │ super-secret-jwt-token-with-at-least-32-characters-long │
│ DB Password          │ top-secret-local-pg-password                           │
└──────────────────────┴────────────────────────────────────────────────────────┘
`;

const BOX_TABLE_FORBIDDEN = [
  "6a7c8d9e0f1a2b3c4d5e6f7a",
  "9f8e7d6c5b4a3f2e1d0c9b8a7f6e5d4c",
  "4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e",
  "super-secret-jwt-token-with-at-least-32-characters-long",
  "top-secret-local-pg-password",
  "postgres:postgres@",
];

const SAMPLE_ASCII_TABLE_OUTPUT = `
| Service            | Value                                   |
| API URL            | http://127.0.0.1:54321                  |
| Storage Access Key | a1b2c3d4e5f67890                        |
| Storage Secret Key | f9e8d7c6b5a43210                        |
| Secret Key         | 1122334455667788                        |
| Postgres Password  | myverysecretpassword                    |
`;

const ASCII_TABLE_FORBIDDEN = [
  "a1b2c3d4e5f67890",
  "f9e8d7c6b5a43210",
  "1122334455667788",
  "myverysecretpassword",
];

describe("Stage 5D — Supabase box/table formatted output sanitization", () => {
  const sanitizedBox = sanitizeSupabaseLog(SAMPLE_BOX_TABLE_OUTPUT);

  for (const secret of BOX_TABLE_FORBIDDEN) {
    test(`redacts box table secret ${secret.slice(0, 20)}...`, () => {
      expect(sanitizedBox).not.toContain(secret);
    });
  }

  test("keeps non-secret box table service URLs and header rows intact", () => {
    expect(sanitizedBox).toContain("│ API URL              │ http://127.0.0.1:54321");
    expect(sanitizedBox).toContain("│ Studio URL           │ http://127.0.0.1:54323");
    expect(sanitizedBox).toContain("│ Inbucket URL         │ http://127.0.0.1:54324");
    expect(sanitizedBox).toContain("│ Storage URL          │ http://127.0.0.1:54321/storage/v1/s3");
    expect(sanitizedBox).toContain("│ DB URL               │ postgresql://[REDACTED]@127.0.0.1:54322/postgres");
    expect(sanitizedBox).toContain("│ Storage Access Key   │ [REDACTED]");
    expect(sanitizedBox).toContain("│ Storage Secret Key   │ [REDACTED]");
    expect(sanitizedBox).toContain("│ Secret Key           │ [REDACTED]");
    expect(sanitizedBox).toContain("│ DB Password          │ [REDACTED]");
  });

  test("idempotent on box table format", () => {
    expect(sanitizeSupabaseLog(sanitizedBox)).toBe(sanitizedBox);
  });

  const sanitizedAscii = sanitizeSupabaseLog(SAMPLE_ASCII_TABLE_OUTPUT);

  for (const secret of ASCII_TABLE_FORBIDDEN) {
    test(`redacts ascii table secret ${secret}...`, () => {
      expect(sanitizedAscii).not.toContain(secret);
    });
  }

  test("keeps non-secret ascii table service URLs intact", () => {
    expect(sanitizedAscii).toContain("| API URL            | http://127.0.0.1:54321");
    expect(sanitizedAscii).toContain("| Storage Access Key | [REDACTED]");
    expect(sanitizedAscii).toContain("| Storage Secret Key | [REDACTED]");
    expect(sanitizedAscii).toContain("| Secret Key         | [REDACTED]");
    expect(sanitizedAscii).toContain("| Postgres Password  | [REDACTED]");
  });

  test("idempotent on ascii table format", () => {
    expect(sanitizeSupabaseLog(sanitizedAscii)).toBe(sanitizedAscii);
  });
});
