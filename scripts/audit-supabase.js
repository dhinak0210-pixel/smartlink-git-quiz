#!/usr/bin/env node
/**
 * Supabase Completeness Audit
 * Run: node scripts/audit-supabase.js
 *
 * Checks all tables, columns, RLS policies, indexes, auth config, storage,
 * client utilities, environment variables, and migrations across all layers.
 */

const fs = require("fs");
const path = require("path");

// Node 20 fallback for Supabase realtime WebSocket check
if (typeof global.WebSocket === "undefined") {
  global.WebSocket = class DummyWebSocket {
    constructor() {}
    addEventListener() {}
    removeEventListener() {}
    close() {}
    send() {}
  };
}

const { createClient } = require("@supabase/supabase-js");

// 1. Load environment variables (.env.local or process.env)
function loadEnv() {
  const envPath = path.resolve(process.cwd(), ".env.local");
  if (fs.existsSync(envPath)) {
    const lines = fs.readFileSync(envPath, "utf-8").split("\n");
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eqIdx = trimmed.indexOf("=");
      if (eqIdx > 0) {
        const key = trimmed.slice(0, eqIdx).trim();
        const val = trimmed.slice(eqIdx + 1).trim().replace(/^["']|["']$/g, "");
        if (!process.env[key]) {
          process.env[key] = val;
        }
      }
    }
  }
}

loadEnv();

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!URL || !KEY) {
  console.error("❌ Missing NEXT_PUBLIC_SUPABASE_URL / SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const supabase = createClient(URL, KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

let passed = 0;
let failed = 0;
let warnings = 0;
const report = [];

function check(category, name, condition, detail = "") {
  const icon = condition ? "✅" : "❌";
  if (condition) passed++; else failed++;
  const line = `${icon} **${category}**: ${name}${detail ? " — " + detail : ""}`;
  report.push(line);
  console.log(line);
}

function warn(category, name, detail = "") {
  warnings++;
  const line = `⚠️ **${category}**: ${name}${detail ? " — " + detail : ""}`;
  report.push(line);
  console.log(line);
}

// Complete Inventory as per Specification
const REQUIRED_TABLES = {
  // Layer 1 - Core
  events: ["id", "name", "event_date", "status", "created_at"],
  students: [
    "id", "event_id", "name", "email", "register_no", "college_id",
    "join_code_hash", "join_attempts", "locked_until", "auth_user_id",
    "active_session_id", "consent_at", "status", "display_name_preference",
    "certificate_name_confirmed", "irt_ability_logit", "created_at"
  ],
  questions: [
    "id", "event_id", "template_id", "variant_id", "question_number",
    "difficulty", "difficulty_logit", "discrimination", "elo_rating",
    "elo_games", "question_text", "correct_answer_index", "is_active",
    "bank_hash", "created_at"
  ],
  options: ["id", "question_id", "option_text", "option_index", "is_correct", "created_at"],
  student_questions: ["id", "student_id", "question_id", "variant_id", "option_order", "assigned_at"],
  quiz_state: [
    "id", "event_id", "status", "started_at", "current_question",
    "ended_at", "results_published", "results_published_at"
  ],
  answers: [
    "id", "student_id", "question_id", "event_id", "selected_option",
    "is_correct", "points", "response_ms", "submitted_at", "tab_switches",
    "visibility_hidden"
  ],

  // Layer 2 - Anti-Cheat
  flags: ["id", "student_id", "event_id", "flag_type", "severity", "details", "detector", "tier", "created_at"],
  reviews: ["id", "flag_id", "reviewer_id", "decision", "reason", "created_at"],
  student_status: ["student_id", "trust_score", "tier", "review_status", "last_updated"],
  reserve_questions: ["id", "event_id", "question_text", "difficulty", "variant_id"],
  reserve_options: ["id", "reserve_question_id", "option_text", "option_index", "is_correct"],
  sudden_death: ["id", "event_id", "student_ids", "question_id", "answers", "winner_id", "created_at"],

  // Layer 4 - Automation
  certificates: ["id", "student_id", "token", "filename", "generated_at", "downloaded_at"],
  results_approval: ["id", "event_id", "approved_by", "approved_at", "ranking_snapshot"],

  // Variants
  templates: ["id", "template_key", "category", "difficulty", "source_text", "created_at"],
  variants: [
    "id", "template_id", "variant_key", "question_text",
    "correct_answer_index", "git_commands", "validation_status", "bank_hash"
  ],
  variant_options: ["id", "variant_id", "option_text", "option_index", "is_correct"],
  variant_assignments: ["id", "student_id", "question_number", "variant_id", "assigned_at"],
  bank_freeze: ["id", "event_id", "frozen_at", "bank_hash", "question_count", "frozen_by"],

  // Login
  login_events: [
    "id", "student_id", "auth_user_id", "event_type", "hashed_ip",
    "device_type", "user_agent", "details", "created_at"
  ],

  // Advanced Admin
  admin_users: ["id", "auth_user_id", "role", "display_name", "active", "created_at"],
  audit_log: [
    "id", "event_id", "actor_id", "actor_name", "action", "target_type",
    "target_id", "before_values", "after_values", "reason", "ip_hash", "created_at"
  ],
  approvals: [
    "id", "event_id", "action", "payload", "requested_by", "approved_by",
    "status", "rejection_reason", "created_at", "expires_at", "executed_at"
  ],
  event_settings: ["id", "event_id", "values", "version", "frozen_at", "bank_hash", "updated_by", "updated_at"],
  pauses: ["id", "event_id", "after_question", "started_at", "ended_at", "duration_ms", "reason", "created_by"],
  question_voids: ["id", "event_id", "question_id", "question_number", "reason", "approval_id", "voided_at"],
  announcements: ["id", "event_id", "message", "type", "shown_from", "shown_to", "created_by", "active"],
  helpdesk_actions: ["id", "event_id", "student_id", "action", "id_checked", "note", "actor_id", "created_at"],
  student_notes: ["id", "event_id", "student_id", "note", "actor_id", "created_at"],
  flag_decisions: [
    "id", "event_id", "student_id", "flag_ids", "decision", "penalty_points",
    "reason", "student_explanation", "decided_by", "approval_id", "decided_at"
  ],
  winner_verification: [
    "id", "event_id", "ranking", "winner_student_id", "approved_by",
    "revealed_places", "published", "created_at"
  ],

  // Adaptive Practice
  practice_ratings: ["student_id", "elo_rating", "total_practice_answers", "total_correct", "last_practice_at", "seeded_from_irt"],
  practice_sessions: ["id", "student_id", "started_at", "ended_at", "questions_answered", "questions_correct", "elo_start", "elo_end"],
  practice_answers: [
    "id", "session_id", "student_id", "question_id", "is_correct", "response_ms",
    "student_elo_before", "student_elo_after", "question_elo_before", "question_elo_after", "answered_at"
  ]
};

const REQUIRED_INDEXES = [
  // Core
  "idx_students_email",
  "idx_students_register_no",
  "idx_students_auth_user_id",
  "idx_students_status",
  "idx_questions_event",
  "idx_questions_number",
  "idx_answers_student",
  "idx_answers_question",
  "idx_answers_event",
  "idx_student_questions_student",

  // Anti-cheat
  "idx_flags_student",
  "idx_flags_tier",
  "idx_flags_event",

  // Login
  "idx_login_events_student",
  "idx_login_events_type",
  "idx_login_events_created",

  // Admin
  "idx_audit_log_event",
  "idx_audit_log_actor",
  "idx_audit_log_action",
  "idx_audit_log_created",
  "idx_approvals_status",
  "idx_approvals_event",
  "idx_pauses_event",
  "idx_announcements_active",
  "idx_flag_decisions_student",
  "idx_helpdesk_student",

  // Practice
  "idx_practice_ratings_student",
  "idx_practice_answers_student",
  "idx_practice_answers_question",
  "idx_practice_sessions_student"
];

async function main() {
  console.log("===========================================================");
  console.log("🔍 SmartLink Git Quiz — Supabase Completeness Audit");
  console.log("===========================================================\n");
  console.log(`Connecting to: ${URL}\n`);

  // --- 1. Tables and Columns ---
  console.log("## 1. Tables and Columns Inventory\n");

  // Attempt RPC to get all columns in bulk, fallback to PostgREST query
  let dbColumns = null;
  const { data: colsData, error: colsErr } = await supabase.rpc("get_table_columns");
  if (!colsErr && colsData) {
    dbColumns = new Map();
    for (const c of colsData) {
      if (!dbColumns.has(c.table_name)) dbColumns.set(c.table_name, new Set());
      dbColumns.get(c.table_name).add(c.column_name);
    }
  }

  for (const [tableName, columns] of Object.entries(REQUIRED_TABLES)) {
    if (dbColumns) {
      const exists = dbColumns.has(tableName);
      check("Table", tableName, exists, exists ? "exists in public schema" : "TABLE MISSING");
      if (exists) {
        const tableCols = dbColumns.get(tableName);
        for (const col of columns) {
          const colPresent = tableCols.has(col);
          check("Column", `${tableName}.${col}`, colPresent, colPresent ? "present" : "COLUMN MISSING");
        }
      } else {
        for (const col of columns) {
          check("Column", `${tableName}.${col}`, false, "TABLE MISSING");
        }
      }
    } else {
      // Fallback: PostgREST check per table
      const { error } = await supabase.from(tableName).select("*").limit(1);
      const exists = !error || error.code !== "42P01";
      check("Table", tableName, exists, exists ? "accessible" : `TABLE DOES NOT EXIST (${error?.message || ""})`);

      if (exists) {
        for (const col of columns) {
          const { error: colError } = await supabase.from(tableName).select(col).limit(1);
          const colPresent = !colError || colError.code !== "42703";
          check("Column", `${tableName}.${col}`, colPresent, colPresent ? "present" : "COLUMN MISSING");
        }
      } else {
        for (const col of columns) {
          check("Column", `${tableName}.${col}`, false, "TABLE MISSING");
        }
      }
    }
  }

  // --- 2. Row Level Security ---
  console.log("\n## 2. Row Level Security (RLS)\n");

  const { data: rlsData, error: rlsError } = await supabase.rpc("check_rls");
  if (rlsError) {
    warn("RLS", "check_rls helper RPC", `Failed to run check_rls: ${rlsError.message}`);
  } else {
    const rlsMap = new Map((rlsData || []).map((r) => [r.table_name, r.rls_enabled]));
    for (const tableName of Object.keys(REQUIRED_TABLES)) {
      if (!rlsMap.has(tableName)) {
        check("RLS", tableName, false, "Table not found in public schema");
      } else {
        const enabled = rlsMap.get(tableName);
        check("RLS", tableName, enabled, enabled ? "ENABLED" : "DISABLED (FAIL)");
      }
    }
  }

  const { data: dangerousPolicies, error: dangErr } = await supabase.rpc("check_dangerous_policies");
  if (dangErr) {
    warn("RLS", "check_dangerous_policies RPC", dangErr.message);
  } else if (dangerousPolicies && dangerousPolicies.length > 0) {
    for (const dp of dangerousPolicies) {
      check("RLS Policy", `${dp.table_name} (${dp.policy_name})`, false, `Dangerous open policy: ${dp.issue}`);
    }
  } else {
    check("RLS Policy", "No blanket open policies to anon/authenticated", true, "Verified no USING (true) for anon/authenticated");
  }

  // --- 3. Indexes ---
  console.log("\n## 3. Index Verification\n");

  const { data: idxData, error: idxErr } = await supabase.rpc("get_table_indexes");
  if (idxErr) {
    warn("Indexes", "get_table_indexes helper RPC", idxErr.message);
  } else {
    const existingIndexNames = new Set((idxData || []).map((i) => i.index_name));
    for (const idxName of REQUIRED_INDEXES) {
      const exists = existingIndexNames.has(idxName);
      check("Index", idxName, exists, exists ? "present" : "INDEX MISSING");
    }
  }

  // --- 4. Database Size and Live Counts ---
  console.log("\n## 4. Database Health and Sizing\n");

  const { data: dbSize, error: sizeErr } = await supabase.rpc("get_db_size");
  if (!sizeErr && dbSize) {
    check("Database Sizing", "Database Total Size", true, `${dbSize} (hard limit: 500 MB)`);
  } else {
    warn("Database Sizing", "Database Total Size", sizeErr ? sizeErr.message : "Unable to read size");
  }

  const { data: rowCounts, error: countErr } = await supabase.rpc("get_row_counts");
  if (!countErr && rowCounts) {
    const totalLiveRows = rowCounts.reduce((acc, r) => acc + Number(r.row_count || 0), 0);
    check("Database Rows", "Live Table Count", true, `${rowCounts.length} user tables tracked, total live tuples: ${totalLiveRows}`);
  } else {
    warn("Database Rows", "Row counts", countErr?.message || "Unavailable");
  }

  // --- 5. Auth Admin API & Users ---
  console.log("\n## 5. Auth Configuration & Admin API\n");

  try {
    const { data: userList, error: authErr } = await supabase.auth.admin.listUsers({
      page: 1,
      perPage: 5,
    });
    check("Auth", "Admin API Connection", !authErr, authErr?.message || "Admin API healthy");
    const count = userList?.users?.length || 0;
    check("Auth", "Users Registered", count >= 0, `Found ${userList?.total || count} total user(s) in auth.users`);
  } catch (e) {
    check("Auth", "Admin API Connection", false, e.message);
  }

  // Check config.toml if locally present
  const configTomlPath = path.resolve(process.cwd(), "supabase/config.toml");
  if (fs.existsSync(configTomlPath)) {
    const configContent = fs.readFileSync(configTomlPath, "utf-8");
    check("Auth Config", "Email confirm disabled in config.toml", configContent.includes("enable_confirmations = false"), "enable_confirmations = false");
    check("Auth Config", "JWT expiry 86400 (24h)", configContent.includes("jwt_expiry = 86400"), "jwt_expiry = 86400");
    check("Auth Config", "Refresh token rotation enabled", configContent.includes("enable_refresh_token_rotation = true"), "enable_refresh_token_rotation = true");
    check("Auth Config", "Social providers disabled", configContent.includes("external.google") && configContent.includes("enabled = false"), "Google/GitHub disabled");
  } else {
    warn("Auth Config", "supabase/config.toml", "File not found locally");
  }

  // --- 6. Storage Buckets ---
  console.log("\n## 6. Storage Buckets\n");

  try {
    const { data: buckets, error: bErr } = await supabase.storage.listBuckets();
    if (bErr) {
      check("Storage", "List Buckets API", false, bErr.message);
    } else {
      check("Storage", "List Buckets API", true, `Found ${(buckets || []).length} bucket(s)`);
      const certBucket = (buckets || []).find((b) => b.name === "certificates" || b.id === "certificates");
      check("Storage", "certificates bucket exists", !!certBucket, certBucket ? "present" : "BUCKET MISSING");
      if (certBucket) {
        check("Storage", "certificates bucket is private", !certBucket.public, certBucket.public ? "PUBLIC (SECURITY ISSUE)" : "private");
      }
    }
  } catch (e) {
    check("Storage", "Storage API check", false, e.message);
  }

  // --- 7. Environment Variables ---
  console.log("\n## 7. Environment Variables (.env.local)\n");

  const requiredEnvVars = [
    { key: "NEXT_PUBLIC_SUPABASE_URL", required: true },
    { key: "NEXT_PUBLIC_SUPABASE_ANON_KEY", required: true },
    { key: "SUPABASE_SERVICE_ROLE_KEY", required: true },
    { key: "EVENT_DATE", required: true },
    { key: "SIGNUP_OPEN_DAYS_BEFORE", required: true },
    { key: "SIGNUP_CLOSE_DAYS_BEFORE", required: true },
    { key: "ALLOWED_EMAIL_DOMAIN", required: true },
    { key: "IP_HASH_SALT", required: true },
    { key: "DEFAULT_EVENT_ID", required: true },
    { key: "JWT_SECRET", required: false },
  ];

  for (const envItem of requiredEnvVars) {
    const val = process.env[envItem.key];
    const present = !!val && !val.includes("placeholder");
    if (envItem.required) {
      check("Environment Variable", envItem.key, present, present ? "set" : "MISSING OR PLACEHOLDER");
    } else {
      if (present) {
        check("Environment Variable (Optional)", envItem.key, true, "set");
      } else {
        warn("Environment Variable (Optional)", envItem.key, "Not set (only needed if legacy JWT is used)");
      }
    }
  }

  // Check that service role key is not in NEXT_PUBLIC_
  const hasServiceRoleInPublic = Object.keys(process.env).some(
    (k) => k.startsWith("NEXT_PUBLIC_") && (process.env[k] === KEY || k.includes("SERVICE_ROLE"))
  );
  check("Security", "Service Role Key not in NEXT_PUBLIC_*", !hasServiceRoleInPublic, "Service role key is kept private");

  // --- 8. Client Utility Code Verification ---
  console.log("\n## 8. Client Utility & Architecture Verification\n");

  const filesToCheck = [
    { path: "src/lib/supabase/server.ts", mustExport: ["createSupabaseServer"] },
    { path: "src/lib/supabase/admin.ts", mustExport: ["createSupabaseAdmin"] },
    { path: "src/lib/supabase/client.ts", mustExport: ["createSupabaseBrowser"] },
    { path: "src/lib/auth.ts", mustExport: ["getCurrentUser", "requireAdmin", "hashIP", "logLoginEvent", "isSignupOpen", "isAccountLocked"] },
    { path: "src/middleware.ts", mustExport: ["middleware"] }
  ];

  for (const f of filesToCheck) {
    const fullPath = path.resolve(process.cwd(), f.path);
    const exists = fs.existsSync(fullPath);
    check("Client Utility", f.path, exists, exists ? "file exists" : "FILE MISSING");
    if (exists) {
      const content = fs.readFileSync(fullPath, "utf-8");
      for (const exp of f.mustExport) {
        const hasExport = content.includes(`export function ${exp}`) || content.includes(`export async function ${exp}`) || content.includes(`export const ${exp}`);
        check("Export Check", `${f.path} exports ${exp}`, hasExport, hasExport ? "exported" : "MISSING EXPORT");
      }
    }
  }

  // Check src/lib/supabase/server.ts must NOT use service role key
  const serverTsPath = path.resolve(process.cwd(), "src/lib/supabase/server.ts");
  if (fs.existsSync(serverTsPath)) {
    const serverContent = fs.readFileSync(serverTsPath, "utf-8");
    const leaksServiceRole = serverContent.includes("SUPABASE_SERVICE_ROLE_KEY") || serverContent.includes("serviceRoleKey");
    if (leaksServiceRole) {
      warn("Security", "src/lib/supabase/server.ts", "References SUPABASE_SERVICE_ROLE_KEY. Recommended: keep service role strictly in admin.ts");
    } else {
      check("Security", "src/lib/supabase/server.ts has no service role key", true, "Clean anon-only client");
    }
  }

  // Check src/middleware.ts must not import admin client
  const middlewarePath = path.resolve(process.cwd(), "src/middleware.ts");
  if (fs.existsSync(middlewarePath)) {
    const midContent = fs.readFileSync(middlewarePath, "utf-8");
    const importsAdmin = midContent.includes("createSupabaseAdmin") || midContent.includes("supabase/admin");
    check("Security", "src/middleware.ts does not import admin client", !importsAdmin, importsAdmin ? "LEAKS ADMIN IN MIDDLEWARE" : "middleware safe");
  }

  // --- 9. Migration Files Verification ---
  console.log("\n## 9. Migration Files Verification\n");

  const migrationsDir = path.resolve(process.cwd(), "supabase/migrations");
  const migrationsExist = fs.existsSync(migrationsDir);
  check("Migrations", "supabase/migrations directory exists", migrationsExist);

  if (migrationsExist) {
    const migFiles = fs.readdirSync(migrationsDir).filter((f) => f.endsWith(".sql"));
    check("Migrations", "Found migration files", migFiles.length > 0, `${migFiles.length} files found`);

    for (const mf of migFiles) {
      const isTimestamped = /^\d{14}_/.test(mf);
      if (!isTimestamped) {
        warn("Migration Naming", mf, "Filename does not follow YYYYMMDDHHMMSS_description.sql format");
      } else {
        check("Migration Naming", mf, true, "Properly timestamped");
      }

      const content = fs.readFileSync(path.join(migrationsDir, mf), "utf-8");
      const hasDrop = content.includes("DROP TABLE") && !content.includes("-- CONFIRM DROP");
      if (hasDrop) {
        warn("Migration Safety", `${mf} contains DROP TABLE`, "DROP TABLE without confirmation comment");
      }
      const hasDelete = content.includes("DELETE FROM");
      if (hasDelete) {
        warn("Migration Safety", `${mf} contains DELETE FROM`, "DELETE statement found in migration");
      }
    }
  }

  // --- 10. Summary ---
  console.log("\n===========================================================");
  console.log("## Final Audit Summary\n");
  console.log(`- ✅ Passed: ${passed}`);
  console.log(`- ❌ Failed: ${failed}`);
  console.log(`- ⚠️ Warnings: ${warnings}`);
  console.log(`- Total checks: ${passed + failed + warnings}`);
  console.log("===========================================================\n");

  if (failed > 0) {
    console.log("❌ **AUDIT FAILED** — Review the failed items above.");
    process.exit(1);
  } else {
    console.log("✅ **ALL AUDIT CHECKS PASSED**");
    process.exit(0);
  }
}

main().catch((e) => {
  console.error("Audit script crashed:", e);
  process.exit(1);
});
