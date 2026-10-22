# Azure SQL schema (execution evidence only)

This database stores a focused execution-evidence domain only:

- compatibility runs
- test-case inputs
- test-case results
- audit events

It does **not** duplicate Supabase's app data. Where a row needs to be traceable back to the
app, it stores the relevant Supabase identifiers as plain logical references.

## Tables
- `compatibility_runs`
- `run_inputs`
- `run_results`
- `audit_records`

See `azure-sql/schema.sql` for the exact DDL.

## Bridge pattern
During execution:
1. The app executes the transformation plan in trusted code.
2. The app writes the run, inputs, and results into Azure SQL in one transaction.
3. The app writes or updates the corresponding Supabase record and records the Azure run
   reference for traceability.

If the Azure SQL write fails, the Supabase-side app-level run metadata records that evidence persistence did not succeed. The detailed run inputs/results/audit records are not copied into Supabase, and the app does not pretend both sides succeeded.

## Important
- `supabase_project_id` and `supabase_mapping_set_id` are logical references, not
  cross-database foreign keys.
- The application enforces the link when it writes both sides.
