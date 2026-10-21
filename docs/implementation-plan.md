# Uniflow ∞ — implementation plan

This plan is written so a teammate can read it and explain the first vertical slice without guessing. It is intentionally limited to what Phase 1 must actually build.

## Repository inspection (Phase 0)

- Package manager: npm, indicated by `package-lock.json`; no `packageManager` field is pinned.
- Framework: Next.js 15.5 App Router, React 19, TypeScript strict, Tailwind CSS 3.
- Scripts: `dev` (Next dev + Turbopack), `build`, `start`, `lint` (`next lint`), `typecheck` (`tsc --noEmit`).
- Routes: `/` landing page and `/api/projects` placeholder GET/POST returning 503; no auth, import, mapping, run, report, or health routes.
- UI: minimal landing page only; there is no workbench yet.
- Environment handling: `.env.example` lists Supabase, Groq, Azure placeholders; `.env.local` exists locally but its values were intentionally not read. `.gitignore` excludes `.env` and `.env.local`.
- Existing test coverage: no project tests found (only IDE metadata matched test/spec filename search); no test script or test framework is configured.
- Supabase: `supabase/schema.sql` defines projects/specs/mapping sets/mappings/plans/adapters/reports/artifact metadata and RLS policies. Current `specs.raw_content` duplicates file bytes/text in Postgres; `adapters.language` still permits `py`; policies are initial scaffolding and require review for safe insert/update checks and reliable migrations.
- Azure SQL: `azure-sql/schema.sql` defines execution-run/input/result/audit tables with run foreign keys and indexes. It is a schema draft only; no connection or transaction code exists.
- Supabase clients: `lib/supabase/client.ts` uses the anon key; `lib/supabase/server.ts` uses the service-role key without a session-aware cookie client or ownership checks. These are stubs, not secure application routes.
- Git: this workspace has no `.git` directory, so branch, tracked/untracked status, and diff could not be verified. Preserve the checkout as provided; do not infer that files are clean or committed.
- Config caveat: both `next.config.js` and `next.config.mjs` exist with overlapping settings. Package scripts currently use `next lint`, which is deprecated on Next 15 and lint config reports that the Next plugin is not detected. `eslint-config-next` and `@next/eslint-plugin-next` versions are 16.x while Next is 15.x; align and simplify in implementation setup before relying on CI.

Nothing AI-related is wired yet. Nothing Azure-related is wired yet. Nothing auth-related is wired yet. No integration test can pass yet because there are no implementations, credentials, or configured test harness.

## Phase 0 — freeze the design

Phase 0 is complete for implementation purposes when these documents exist and are coherent:

- `docs/architecture.md`
- `docs/implementation-plan.md`
- `docs/decisions.md`
- A concrete acceptance checklist

The Phase 1 vertical slice ends by exporting an evidence-backed report and reloading the saved project in a fresh authenticated request to confirm persisted project, spec, mapping, plan, run-summary, adapter, and report metadata.

Phase 0 does not provision Azure resources, does not add secrets, and does not start implementing future phases.

## Phase 1 — one trusted vertical slice, backend first

Phase 1 builds the smallest end-to-end slice that proves the product’s core idea. It deliberately builds server-side logic before the polished UI. Do not start this phase until the user authorizes it.

### Phase 1 entry gate

- Reconcile the duplicate Next config files and Next/ESLint major-version mismatch; ensure lint/build use a single documented config.
- Replace the service-role-only Supabase server stub with session-aware server authentication under RLS, or document and enforce the exact ownership checks before any service-role access.
- Reconcile `supabase/schema.sql` with the approved source-of-truth boundary: keep raw files in Blob, store only file metadata/hash/reference and normalized schema in Supabase; remove Python adapter allowance from the MVP schema.
- Review RLS policies for both `USING` and `WITH CHECK` behavior and idempotent/repeatable migration application before enabling auth-backed routes.
- Add a test harness before implementing behavior so each core function is covered by deterministic fixtures.

### 1.1 Trusted core types and normalized schema representation

Create the internal schema model and path notation that every later stage will share. Use one discriminated node representation for object, array, and scalar schemas; preserve supported constraints and attach source/diagnostic metadata. Initial safe limits: 1 MiB per import, maximum recursion depth 64, maximum 100 local reference resolutions per document; reject rather than truncate or fetch remote references. Keep these limits centralized and configurable for later review.

- a normalized internal schema representation
- a path notation used by diff, mapping, compiler, interpreter, tests, adapter generation, and report
- typed mapping statuses: `proposed`, `accepted`, `rejected`, `edited`
- typed plan states: `invalid`, `compiled`, `executed`
- descriptive confidence/uncertainty labels that are explicitly not proof of correctness

### 1.2 Deterministic normalization and diff

Use the frozen path format `$` for the root, bracketed JSON-string property segments (for example `$[\"customer\"][\"display.name\"]`), and numeric array-index segments (for example `$[\"items\"][0]`). Do not support wildcards, filters, or dynamic expressions. Parse paths into property/index tokens and validate each token against the selected normalized schema before compilation.

Implement safe parsing and normalization for the MVP input formats:

- OpenAPI 3.x JSON
- JSON Schema JSON

Keep size limits and safe parsing explicit. Resolve local `$ref`s carefully. Reject or clearly flag remote refs instead of fetching arbitrary URLs.

The diff stage must be deterministic and testable. It should produce a structural comparison a human can review.

### 1.3 Mapping model and review session

Implement the mapping session as a typed workflow:

- candidate mappings are suggestions, not decisions
- mappings can be accepted, rejected, or edited
- the system tracks decision history and descriptive uncertainty labels
- no mapping becomes executable until the plan compiler accepts it

### 1.4 Transformation IR, compiler, and interpreter

Define a constrained transformation IR. The compiler:

- validates paths and operations
- allows only a typed conversion allowlist
- rejects invalid or unsafe plans without executing them

The interpreter:

- executes only approved plans in trusted code
- produces output and collected evidence
- never eval or dynamically execute generated source

### 1.5 Validation and deterministic tests

After execution:

- validate output against the target schema representation
- run deterministic tests from approved mappings and fixtures
- decide pass/fail from evidence, not from AI confidence

### 1.6 TypeScript adapter generation

Generate a TypeScript adapter from the same validated IR used by the interpreter. The adapter generator must be testable against fixtures and must not invent its own logic outside the approved plan.

### 1.7 Supabase wiring for the slice

Wire the slice to Supabase so a project can be created, spec metadata and normalized schemas stored, and mapping/plan/test-run/adapter/report metadata persisted. The raw imported file bytes belong in private Blob when enabled, not in a duplicate Supabase raw-content field. Keep a content hash, size, name, type, root selection, and artifact reference in Supabase.

The slice must respect authenticated ownership and RLS. Derive the owner from the verified session, never request JSON. Prefer a session-aware client; any service-role use requires explicit session validation and ownership checks on every route.

### 1.8 Minimal workbench UI

Add a small dashboard/workbench that lets a teammate complete the slice without using curl:

- sign in
- create/open a project
- import source and target specs
- review mappings
- run the transformation
- see validation and test results
- view generated adapter and export a report

The UI should be calm, readable, and credible. It does not need every future feature. It does need loading, empty, and error states where relevant.

## Phase 2 — external suggestion and cloud integrations

Do not provision or connect external Azure resources until the user verifies eligibility, region, configuration, billing behavior, and under-$1 plausibility in the portal. The docs describe the guard; they do not establish that the user’s account is eligible or that actual charges will remain below a dollar.

Phase 2 adds the optional external pieces behind clear gating.

### 2.1 Groq mapping suggestions

Add server-side Groq suggestions:

- parse model output with Zod
- constrain output to an allowlist
- never allow the model to validate itself or execute anything

### 2.2 Azure Blob, gated

Add Azure Blob support only after the cost-control gate is verified:

- private container only
- real upload/download for spec files and report artifacts
- explicit success/failure state
- graceful degradation when Azure Blob is not configured

### 2.3 Azure SQL, gated

Add Azure SQL execution evidence only after the free offer/network/config gate is verified:

- compatibility runs, inputs, results, audit records
- a real transactional write path
- rollback behavior when the write fails
- honest status when Azure SQL is unavailable

## Phase 3 — evidence, docs, and demo readiness

Phase 3 hardens the slice into a demo and submission-ready product:

- acceptance tests
- security-conscious checks
- documentation upgrades
- demo fixtures and evidence capture guidance

## Guiding rule

Build the smallest version that completes the vertical slice. Cut decorative features before cutting correctness. Ship the slice, then extend.
