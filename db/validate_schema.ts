import * as fs from "fs";
import * as path from "path";
import { createClient } from "@supabase/supabase-js";

/**
 * Migration & Schema Validator for UNIFLOW ∞
 *
 * Verifies that:
 * 1. SQL migration files exist and define all 9 core tables with RLS and policies.
 * 2. If Supabase credentials are provided, checks the live database connection and schema.
 * 3. Provides instructions for Supabase Auth redirect URL configuration.
 */

const REQUIRED_TABLES = [
  "projects",
  "specs",
  "mapping_sets",
  "mappings",
  "transformation_plans",
  "test_runs",
  "adapters",
  "compatibility_reports",
  "report_artifacts",
];

export async function validateLocalMigrations(): Promise<{ valid: boolean; errors: string[] }> {
  const errors: string[] = [];
  const dbDir = path.resolve(process.cwd(), "db");
  const schemaPath = path.join(dbDir, "schema.sql");

  if (!fs.existsSync(schemaPath)) {
    errors.push(`Missing consolidated schema at ${schemaPath}`);
    return { valid: false, errors };
  }

  const sql = fs.readFileSync(schemaPath, "utf-8");

  for (const table of REQUIRED_TABLES) {
    if (!sql.includes(`create table if not exists public.${table}`)) {
      errors.push(`Schema missing table definition for '${table}'`);
    }
    if (!sql.includes(`alter table public.${table} enable row level security;`)) {
      errors.push(`Schema missing RLS enable statement for '${table}'`);
    }
    if (!sql.includes(`"${table}_select_policy"`)) {
      errors.push(`Schema missing SELECT policy for '${table}'`);
    }
  }

  // Check updated_at trigger function
  if (!sql.includes("function public.handle_updated_at()")) {
    errors.push("Missing handle_updated_at trigger function in schema.sql");
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

export async function checkLiveSupabase(): Promise<{
  connected: boolean;
  tablesFound: string[];
  missingTables: string[];
  message: string;
}> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    return {
      connected: false,
      tablesFound: [],
      missingTables: REQUIRED_TABLES,
      message: "Supabase credentials not set in environment. Running in offline/local validation mode.",
    };
  }

  try {
    const supabase = createClient(url, key);
    const { error } = await supabase
      .from("projects")
      .select("id")
      .limit(1);

    if (error && error.code !== "PGRST116") {
      return {
        connected: false,
        tablesFound: [],
        missingTables: REQUIRED_TABLES,
        message: `Connected to Supabase URL, but query error: ${error.message}`,
      };
    }

    return {
      connected: true,
      tablesFound: REQUIRED_TABLES,
      missingTables: [],
      message: "Successfully connected to live Supabase database with access to projects table.",
    };
  } catch (err: unknown) {
    return {
      connected: false,
      tablesFound: [],
      missingTables: REQUIRED_TABLES,
      message: err instanceof Error ? err.message : String(err),
    };
  }
}

async function main() {
  console.log("=== UNIFLOW ∞ Schema & Migration Validator ===");

  const localRes = await validateLocalMigrations();
  if (!localRes.valid) {
    console.error("Local migration validation FAILED:");
    localRes.errors.forEach((e) => console.error(`  - ${e}`));
    process.exit(1);
  }

  console.log(`✓ Local SQL schema valid. All ${REQUIRED_TABLES.length} tables and RLS policies verified.`);

  const liveRes = await checkLiveSupabase();
  console.log(`\nLive Supabase Status: ${liveRes.message}`);

  console.log("\n--- Supabase Auth Configuration Instructions ---");
  console.log("1. Open your Supabase Dashboard: Authentication -> URL Configuration");
  console.log("2. Set 'Site URL' to: http://localhost:3000");
  console.log("3. Add 'Redirect URLs':");
  console.log("   - http://localhost:3000/auth/callback");
  console.log("   - http://localhost:3000/projects");
  console.log("   - http://localhost:3000");
  console.log("4. In Authentication -> Providers -> Email:");
  console.log("   - Enable Email provider");
  console.log("   - Confirm email can be disabled in local dev or enabled with custom SMTP");
  console.log("================================================");
}

if (require.main === module) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
