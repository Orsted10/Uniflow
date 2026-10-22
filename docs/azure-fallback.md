# Azure fallback (used when the Azure SQL free tier or your account cannot safely support live Azure SQL)

If the cost-control gate finds that Azure SQL cannot be safely enabled for your subscription, this app still works and remains genuinely useful. The Azure SQL piece becomes a documented design + cross-check rather than a live dependency.

## What still works without Azure SQL
- Supabase is the app system of record for projects, specs, mapping sets, mappings, transformation plans, adapters, and reports.
- Groq mapping suggestions work server-side, behind Zod validation.
- The transformation compiler, interpreter, deterministic tests, and TypeScript adapter generator work in trusted application code.
- Compatibility reports can be generated and exported.
- Azure Blob can optionally store uploaded specs and generated artifacts if the storage account is safe/cheap for your account.

## What changes when Azure SQL is unavailable
- Detailed execution evidence (`compatibility_runs`, `run_inputs`, `run_results`, `audit_records`) is not persisted. Supabase may store only app-level test-run metadata/summary and an explicit evidence-persistence status; this is not Azure SQL evidence.
- The app surfaces a clear "Azure SQL not configured" status where relevant.
- The submission evidence shifts to:
  - the Supabase relational schema and RLS,
  - the planned Azure SQL schema and bridge pattern in `docs/azure-schema-bridge.md`,
  - the actual queries that would run,
  - the cost-control checklist in `docs/azure-cost-control.md`.

## Fallback options
1. Keep Supabase as the sole relational system of record and document the Azure SQL design as the next step once the portal is configured.
2. If Azure Blob is safe for the account, use it for real files; Supabase remains the app system of record and Azure SQL evidence remains explicitly unavailable.
3. If Azure is not viable at all for the current account, remove it from the live build and keep it as a documented architecture option with the exact schema and queries.

## What not to do
- Do not pretend Azure SQL is integrated when it is not.
- Do not add paid resources just to make the architecture diagram look complete.
- Do not fabricate SQL query screenshots or query results.

See `docs/azure-cost-control.md` for the verification checklist.
