# Uniflow ∞ — decisions

## Stack and observed repository

- Existing project: npm (`package-lock.json`), Next.js 15.5 App Router, React 19, TypeScript strict, Tailwind CSS 3.
- Preserve this compatible stack; no framework rewrite.
- Supabase Auth + PostgreSQL is the app system of record.
- Groq is server-side only for candidate mapping proposals.
- Azure Blob stores actual source-spec and report-artifact bytes in a private container.
- Azure SQL stores detailed execution evidence only.
- Vercel is the intended hosting target but is not configured or verified.
- Current scripts: `dev`, `build`, `start`, `lint`, `typecheck`. No test script, test framework, or project tests exist.
- The workspace has npm lockfile but no `packageManager` field.
- No `.git` directory is present in the checkout, so branch/status/diff cannot be verified. Do not assume existing content is committed or clean.

## Service ownership

- Supabase owns Auth/identity and ownership, projects, spec metadata and normalized schema metadata, mapping sets/mappings, validated transformation plans, app-level test-run metadata, generated adapter/report metadata, and artifact references.
- Do not duplicate original spec file bytes in Supabase. Store metadata (name, media type, content hash, selected root, normalized representation, size, Blob reference) there; actual source/report bytes belong in Azure Blob when enabled.
- Azure Blob is private object storage for actual imported spec files and generated report artifacts only.
- Azure SQL owns `compatibility_runs`, `run_inputs`, `run_results`, and `audit_records` only. It is not a second source of truth for product state.
- Supabase identifiers in Azure SQL are logical references, not cross-database foreign keys.
- Groq produces candidate mappings only. After schema validation and persistence, they remain `proposed` until a human approves/edits/rejects them.
- If Azure SQL is disabled/unavailable, detailed execution evidence is not persisted; Supabase may retain only app-level run metadata/summary and an explicit evidence-persistence status.
- If Azure Blob is disabled/unavailable, the core local workflow may continue, but original-file durability is unavailable; do not imply the files were durably stored.

## AI and execution rules

- AI may suggest mappings; it never approves correctness, validates a run, or executes code.
- Parse model output with Zod and constrain it to a typed allowlist.
- Never evaluate arbitrary model output or generated adapter source. No `eval` or dynamic execution.
- Trusted compiler validates paths, operations, and conversions. Trusted interpreter executes approved plans. Target-schema validation and deterministic tests decide pass/fail.

## Normalized representation and paths

- Use one normalized internal schema representation for supported object, array, and scalar schema nodes, supported constraints, source locations, and explicit unsupported-keyword diagnostics.
- Use one path notation everywhere: `$` root; property segments as bracketed JSON strings (for example `$["customer"]["display.name"]`); array indices as numeric segments (for example `$["items"][0]`).
- No wildcard, filter, script, or dynamic path expressions. Parse paths into literal property/index tokens and validate each token against the source/target schema before compilation.
- The exact representation and path parser are implemented and tested in Phase 1; this document freezes the contract, not claims that code already exists.

## Supported input formats and limits

- MVP: OpenAPI 3.0.x/3.1.x JSON and JSON Schema JSON.
- Limit each input to 1 MiB before parsing; reject larger input rather than truncating.
- Limit normalized schema recursion to 64 levels and local reference resolution to 100 dereferences per document. Reject cycles/limits with bounded diagnostics.
- Parse JSON without evaluation; validate document shape/version and the supported keyword subset.
- OpenAPI selection is limited to a schema root under `components.schemas`; no claim of complete operation, parameter, or response coverage.
- Resolve supported local JSON Pointers only. Reject or clearly flag remote/URL `$ref`s; never fetch arbitrary URLs.
- YAML is deferred until JSON support works.
- Sample-JSON schema inference is a demo fallback, visibly labelled “inferred”.

## Typed states

- Mapping status: `proposed | accepted | rejected | edited`.
- Plan state: `invalid | compiled | executed`.
- Confidence/uncertainty labels describe the proposal only; they are not proof or an execution gate.

## Security and cost guards

- Every project-scoped request derives the actor from a verified Supabase session and scopes reads/writes by that actor. Never trust a browser-supplied owner ID.
- Prefer session-aware server clients under RLS. Any service-role use requires explicit session validation and ownership checks on every route.
- Imported descriptions/spec content are untrusted, including possible prompt injection; treat them as data, never instructions.
- Supabase service-role, Groq, and Azure credentials stay server-side, are never `NEXT_PUBLIC_*`, and are never logged or included in reports/artifacts.
- Do not provision Azure resources automatically. Verify actual subscription/region/offer/settings and billing behavior before any potentially billable operation. A student account alone does not establish Azure SQL free-tier eligibility or guarantee a sub-$1 bill.
- Azure reads/writes report their own success/failure; unavailable Azure must not block useful local/core execution or generate false success claims.

## Non-goals

- Arbitrary AI code execution.
- Python adapter generation for MVP.
- Currency/unit business rules or automatic timezone removal.
- Microservices or Kubernetes.
- Guaranteed production-scale availability.
- Claims of universal equivalence beyond the fixtures actually tested.

## UI stance

- Build a calm, credible developer workbench, not a generic AI landing page.
- Prefer useful status labels, readable tables, and clear evidence over decoration.
- No fabricated customers, metrics, cloud status, or success claims.
