/* eslint-disable @typescript-eslint/no-require-imports */
const { execSync } = require("node:child_process");
const fs = require("node:fs");

function stripAnsi(str) {
  return str.replace(/[\u001b\x1b]\[[0-9;]*[a-zA-Z]/g, "");
}

function parseSupabaseStatusOutput(raw) {
  const clean = stripAnsi(raw || "");
  const vars = {};
  for (const line of clean.split(/\r?\n/)) {
    const trimmed = line.trim();
    const match = trimmed.match(/^([A-Za-z0-9_]+)\s*=\s*(.*)$/);
    if (match) {
      const key = match[1].trim();
      let val = match[2].trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      vars[key] = val;
    }
  }
  return vars;
}

function validateAndExtractCredentials(vars) {
  let apiUrl = vars.API_URL;
  if (!apiUrl && vars.REST_URL) {
    try {
      const parsed = new URL(vars.REST_URL);
      apiUrl = parsed.origin;
    } catch {
      // ignore
    }
  }

  const pubKey = vars.PUBLISHABLE_KEY || vars.ANON_KEY;
  const secretKey = vars.SECRET_KEY || vars.SERVICE_ROLE_KEY;
  const dbUrl = vars.DB_URL;

  const missingFields = [];
  if (!apiUrl) missingFields.push("API_URL");
  if (!pubKey) missingFields.push("PUBLISHABLE_KEY/ANON_KEY");
  if (!secretKey) missingFields.push("SECRET_KEY/SERVICE_ROLE_KEY");
  if (!dbUrl) missingFields.push("DB_URL");

  if (missingFields.length > 0) {
    return {
      success: false,
      missingFields,
      errorMessage: `Missing Supabase status fields: ${missingFields.join(", ")}`,
    };
  }

  return {
    success: true,
    missingFields: [],
    credentials: {
      apiUrl,
      pubKey,
      secretKey,
      dbUrl,
    },
  };
}

function readStatusRaw() {
  // Check if piped from stdin
  try {
    const stdinContent = fs.readFileSync(0, "utf-8");
    if (stdinContent && stdinContent.trim().length > 0) {
      return stdinContent;
    }
  } catch {
    // stdin not available or not piped, proceed to exec
  }

  return execSync("supabase status -o env", {
    encoding: "utf8",
    env: process.env,
    stdio: ["pipe", "pipe", "inherit"],
  });
}

function registerGithubMasks(credentials, vars = {}) {
  const sensitiveValues = [
    credentials?.pubKey,
    credentials?.secretKey,
    credentials?.dbUrl,
    vars?.JWT_SECRET,
    vars?.SERVICE_ROLE_KEY,
    vars?.ANON_KEY,
    vars?.PUBLISHABLE_KEY,
    vars?.SECRET_KEY,
  ];

  const seen = new Set();
  for (const val of sensitiveValues) {
    if (val && typeof val === "string" && val.trim().length > 0 && !seen.has(val.trim())) {
      seen.add(val.trim());
      console.log(`::add-mask::${val.trim()}`);
    }
  }
}

function exportSupabaseEnv() {
  const raw = readStatusRaw();
  const vars = parseSupabaseStatusOutput(raw);
  const result = validateAndExtractCredentials(vars);

  if (!result.success) {
    // Strict leak-free diagnostic: only report missing field names
    console.error(result.errorMessage);
    process.exit(1);
  }

  const { apiUrl, pubKey, secretKey, dbUrl } = result.credentials;
  const envFile = process.env.GITHUB_ENV;
  if (envFile) {
    // Register sensitive values with GitHub Actions runner so subsequent step logs mask them as ***
    registerGithubMasks(result.credentials, vars);

    const lines = [
      `NEXT_PUBLIC_SUPABASE_URL=${apiUrl}`,
      `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=${pubKey}`,
      `SUPABASE_SECRET_KEY=${secretKey}`,
      `XP_RPG_TEST_DB_URL=${dbUrl}`,
    ];
    fs.appendFileSync(envFile, lines.join("\n") + "\n");
    console.log("Successfully exported Supabase credentials to GITHUB_ENV.");
  } else {
    console.log("Supabase credentials resolved successfully (all required fields present).");
  }
}

if (require.main === module) {
  exportSupabaseEnv();
}

module.exports = {
  stripAnsi,
  parseSupabaseStatusOutput,
  validateAndExtractCredentials,
  registerGithubMasks,
  exportSupabaseEnv,
};
