# Supabase schema (app system of record)

This database owns the application's primary data: users, projects, specs, mapping sets,
mappings, transformation plans, adapters, and compatibility reports.

Azure SQL, if configured, is a separate execution-evidence store only.
It does not replace this database and does not receive a copy of all of these tables.

## Tables
- `projects`
- `specs`
- `mapping_sets`
- `mappings`
- `transformation_plans`
- `adapters`
- `compatibility_reports`
- `report_artifacts` (optional)

See `supabase/schema.sql` for the exact DDL and indexes.

## Row Level Security
All user-owned tables have RLS enabled.

Policies are scoped so an authenticated user can only access rows reachable through
`projects.owner_id = auth.uid()`.

If a service-role client is used server-side, application code still validates the
authenticated session and project ownership before access. RLS is the safety net, not the
only enforcement.

## Cross-database references
Where Azure SQL is configured, it stores Supabase identifiers as plain logical references.
There is no cross-database foreign key.
