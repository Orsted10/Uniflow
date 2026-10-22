# Uniflow ∞ — acceptance checklist

These are measurable checks. They are written so a reviewer can say yes or no without interpreting the product’s intent.

## Auth and ownership

- [ ] An unauthenticated request to a project-scoped route returns 401 or redirects to sign-in and does not read/write project data.
- [ ] Given two test users A and B, a request by B to read, mutate, or delete A’s project returns 403/404 and leaves A’s rows unchanged.
- [ ] A project owner is derived from the verified authenticated session; a forged `owner_id` in the request body cannot change ownership.
- [ ] RLS is enabled on every user-owned table and the same cross-user denial is confirmed using the app’s database role.

## Import and parsing

- [ ] Valid OpenAPI 3.0.x and 3.1.x JSON can be imported; when `components.schemas` has multiple entries, the user can select one schema root and the selected name is persisted.
- [ ] Valid supported-subset JSON Schema JSON can be imported and normalized.
- [ ] Malformed JSON is rejected with a parse error and no partial project/spec row is persisted.
- [ ] A file larger than 1 MiB is rejected before JSON parsing; a file exactly at or below the documented limit reaches validation.
- [ ] More than 64 nested schema levels is rejected with a depth-limit diagnostic.
- [ ] More than 100 local-reference resolutions or a reference cycle is rejected with a bounded diagnostic.
- [ ] Remote/URL `$ref`s are rejected or clearly flagged, and a test spy confirms no outbound network request is made.
- [ ] Supported local `$ref`s resolve correctly; unsupported local targets are explicitly diagnosed.
- [ ] Sample-JSON-inferred schemas are labelled “inferred” in the UI and report, not presented as imported contracts.

## Diff and mapping review

- [ ] The structural diff returns byte-for-byte equivalent normalized findings for the same input pair across repeated runs.
- [ ] Candidate mappings can be accepted, rejected, or edited, and every persisted row uses exactly `proposed | accepted | rejected | edited`.
- [ ] A mapping keeps an ordered decision history with actor, timestamp, previous status, and new status.
- [ ] Descriptive confidence/uncertainty labels are shown but do not affect compiler acceptance or pass/fail.
- [ ] A malformed or schema-invalid AI response is rejected by runtime validation and creates no executable mapping or plan.
- [ ] Imported prompt-injection text remains data and cannot change the system instruction or cause a tool/action to run.

## Compiler, interpreter, validation, tests

- [ ] A mapping with an unknown source path, target path, operation, or conversion is rejected during compilation and the interpreter is not called.
- [ ] A plan in `invalid` state cannot be executed; only a successfully compiled plan can transition through `compiled` to `executed`.
- [ ] The interpreter executes only an approved, validated plan in trusted code.
- [ ] A source scan and runtime tests confirm the app never `eval`s model output or generated source.
- [ ] Output is validated against the target normalized schema, including required fields and supported type/enum/const constraints.
- [ ] A run with target-schema-invalid output fails even if the interpreter produced JSON output.
- [ ] Deterministic fixture tests fail the run when expected output or target constraints do not match.

## Adapter and report

- [ ] The TypeScript adapter is generated from the same validated IR used by the interpreter; generated code is never dynamically executed by the app.
- [ ] For each committed fixture, run the interpreter and the adapter in a test harness and compare parsed JSON outputs structurally; all fixture outputs match exactly.
- [ ] A compatibility report includes the spec hashes/root names, mapping decisions, plan version, fixture identifiers, validation findings, test results, and Azure persistence status—not just a verdict.

## Cloud — Azure Blob

- [ ] The configured container has public access disabled; unauthenticated access to an uploaded object is denied.
- [ ] With a small known fixture, the app uploads bytes, downloads them through an ownership-checked server route, and verifies byte-for-byte equality plus the expected content hash.
- [ ] A signed-in non-owner cannot obtain the artifact through the app route even when given its object reference.
- [ ] The app shows an explicit “Azure Blob not configured/unavailable” state when Azure Blob is disabled or a write/read fails.
- [ ] A failed Blob write is visible and is not recorded/reported as successful.

## Cloud — Azure SQL

- [ ] With Azure SQL enabled, one compatibility run, its inputs/results, and audit records are written in one transaction and queried back with a join across run/input/result/audit tables.
- [ ] A forced insert failure after the run row is created causes transaction rollback; querying by the attempted `run_id` returns zero partial rows.
- [ ] A failed Azure SQL transaction does not falsely mark the detailed evidence write as successful; Supabase may retain only the application-level run summary and an explicit persistence failure state.
- [ ] The app shows an explicit “Azure SQL not configured/unavailable” state when Azure SQL is disabled or a write fails.
- [ ] Supabase identifiers stored in Azure SQL are logical references, not cross-database foreign keys.

## Reload persistence and disabled Azure path

- [ ] After creating a project, importing both specs, saving mapping decisions, compiling a plan, and generating adapter/report metadata, a fresh authenticated request reloads those same values from Supabase and preserves ordering/status/hash values.
- [ ] With Azure Blob and SQL variables absent, the core normalize/diff/map/compile/execute/validate/test/adapter/report workflow completes locally; all Azure status fields say disabled/not configured and no Azure success is claimed.
- [ ] The product degrades gracefully rather than crashing; app-level test-run summary persists in Supabase, while detailed Azure evidence is explicitly marked not persisted.

## Repository and docs

- [ ] A teammate can read `docs/architecture.md`, `docs/implementation-plan.md`, and `docs/decisions.md` and explain the architecture and first vertical slice without guessing.
- [ ] The diagrams in `docs/architecture.md` are present and readable.
- [ ] The acceptance checklist itself is measurable and passes/fails on evidence.
