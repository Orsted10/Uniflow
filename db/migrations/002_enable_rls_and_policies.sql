-- =====================================================================
-- Migration 002: Row Level Security (RLS) & Tenant Isolation Policies
-- UNIFLOW ∞ — API Compatibility Compiler
-- =====================================================================

-- ---------------------------------------------------------------------
-- Ownership Resolution Architecture
-- ---------------------------------------------------------------------
-- Every resource in Uniflow strictly belongs to a single project.
-- Each project has an immutable owner_id tied to Supabase auth.users.
--
-- Ownership Chain:
-- 1. projects: owner_id = auth.uid()
-- 2. specs: specs.project_id -> projects.id (where projects.owner_id = auth.uid())
-- 3. mapping_sets: mapping_sets.project_id -> projects.id (where projects.owner_id = auth.uid())
-- 4. mappings: mappings.mapping_set_id -> mapping_sets.id -> projects.id (where projects.owner_id = auth.uid())
-- 5. transformation_plans: transformation_plans.project_id -> projects.id (where projects.owner_id = auth.uid())
-- 6. test_runs: test_runs.project_id -> projects.id (where projects.owner_id = auth.uid())
-- 7. adapters: adapters.project_id -> projects.id (where projects.owner_id = auth.uid())
-- 8. compatibility_reports: compatibility_reports.project_id -> projects.id (where projects.owner_id = auth.uid())
-- 9. report_artifacts: report_artifacts.project_id -> projects.id (where projects.owner_id = auth.uid())
--
-- Invariants:
-- - No row can be created with an owner_id different from auth.uid().
-- - No user can query, insert, update, or delete rows belonging to other users.
-- - No client-provided user_id in headers or bodies is trusted.
-- ---------------------------------------------------------------------

-- Enable RLS across all tables
alter table public.projects enable row level security;
alter table public.specs enable row level security;
alter table public.mapping_sets enable row level security;
alter table public.mappings enable row level security;
alter table public.transformation_plans enable row level security;
alter table public.test_runs enable row level security;
alter table public.adapters enable row level security;
alter table public.compatibility_reports enable row level security;
alter table public.report_artifacts enable row level security;

-- 1. projects policies
create policy "projects_select_policy" on public.projects
  for select using (auth.uid() = owner_id);

create policy "projects_insert_policy" on public.projects
  for insert with check (auth.uid() = owner_id);

create policy "projects_update_policy" on public.projects
  for update using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

create policy "projects_delete_policy" on public.projects
  for delete using (auth.uid() = owner_id);

-- 2. specs policies
create policy "specs_select_policy" on public.specs
  for select using (
    exists (
      select 1 from public.projects p
      where p.id = specs.project_id and p.owner_id = auth.uid()
    )
  );

create policy "specs_insert_policy" on public.specs
  for insert with check (
    exists (
      select 1 from public.projects p
      where p.id = specs.project_id and p.owner_id = auth.uid()
    )
  );

create policy "specs_update_policy" on public.specs
  for update using (
    exists (
      select 1 from public.projects p
      where p.id = specs.project_id and p.owner_id = auth.uid()
    )
  ) with check (
    exists (
      select 1 from public.projects p
      where p.id = specs.project_id and p.owner_id = auth.uid()
    )
  );

create policy "specs_delete_policy" on public.specs
  for delete using (
    exists (
      select 1 from public.projects p
      where p.id = specs.project_id and p.owner_id = auth.uid()
    )
  );

-- 3. mapping_sets policies
create policy "mapping_sets_select_policy" on public.mapping_sets
  for select using (
    exists (
      select 1 from public.projects p
      where p.id = mapping_sets.project_id and p.owner_id = auth.uid()
    )
  );

create policy "mapping_sets_insert_policy" on public.mapping_sets
  for insert with check (
    exists (
      select 1 from public.projects p
      where p.id = mapping_sets.project_id and p.owner_id = auth.uid()
    )
  );

create policy "mapping_sets_update_policy" on public.mapping_sets
  for update using (
    exists (
      select 1 from public.projects p
      where p.id = mapping_sets.project_id and p.owner_id = auth.uid()
    )
  ) with check (
    exists (
      select 1 from public.projects p
      where p.id = mapping_sets.project_id and p.owner_id = auth.uid()
    )
  );

create policy "mapping_sets_delete_policy" on public.mapping_sets
  for delete using (
    exists (
      select 1 from public.projects p
      where p.id = mapping_sets.project_id and p.owner_id = auth.uid()
    )
  );

-- 4. mappings policies (scoping through mapping_sets -> projects)
create policy "mappings_select_policy" on public.mappings
  for select using (
    exists (
      select 1 from public.mapping_sets ms
      join public.projects p on p.id = ms.project_id
      where ms.id = mappings.mapping_set_id and p.owner_id = auth.uid()
    )
  );

create policy "mappings_insert_policy" on public.mappings
  for insert with check (
    exists (
      select 1 from public.mapping_sets ms
      join public.projects p on p.id = ms.project_id
      where ms.id = mappings.mapping_set_id and p.owner_id = auth.uid()
    )
  );

create policy "mappings_update_policy" on public.mappings
  for update using (
    exists (
      select 1 from public.mapping_sets ms
      join public.projects p on p.id = ms.project_id
      where ms.id = mappings.mapping_set_id and p.owner_id = auth.uid()
    )
  ) with check (
    exists (
      select 1 from public.mapping_sets ms
      join public.projects p on p.id = ms.project_id
      where ms.id = mappings.mapping_set_id and p.owner_id = auth.uid()
    )
  );

create policy "mappings_delete_policy" on public.mappings
  for delete using (
    exists (
      select 1 from public.mapping_sets ms
      join public.projects p on p.id = ms.project_id
      where ms.id = mappings.mapping_set_id and p.owner_id = auth.uid()
    )
  );

-- 5. transformation_plans policies
create policy "transformation_plans_select_policy" on public.transformation_plans
  for select using (
    exists (
      select 1 from public.projects p
      where p.id = transformation_plans.project_id and p.owner_id = auth.uid()
    )
  );

create policy "transformation_plans_insert_policy" on public.transformation_plans
  for insert with check (
    exists (
      select 1 from public.projects p
      where p.id = transformation_plans.project_id and p.owner_id = auth.uid()
    )
  );

create policy "transformation_plans_update_policy" on public.transformation_plans
  for update using (
    exists (
      select 1 from public.projects p
      where p.id = transformation_plans.project_id and p.owner_id = auth.uid()
    )
  ) with check (
    exists (
      select 1 from public.projects p
      where p.id = transformation_plans.project_id and p.owner_id = auth.uid()
    )
  );

create policy "transformation_plans_delete_policy" on public.transformation_plans
  for delete using (
    exists (
      select 1 from public.projects p
      where p.id = transformation_plans.project_id and p.owner_id = auth.uid()
    )
  );

-- 6. test_runs policies
create policy "test_runs_select_policy" on public.test_runs
  for select using (
    exists (
      select 1 from public.projects p
      where p.id = test_runs.project_id and p.owner_id = auth.uid()
    )
  );

create policy "test_runs_insert_policy" on public.test_runs
  for insert with check (
    exists (
      select 1 from public.projects p
      where p.id = test_runs.project_id and p.owner_id = auth.uid()
    )
  );

create policy "test_runs_delete_policy" on public.test_runs
  for delete using (
    exists (
      select 1 from public.projects p
      where p.id = test_runs.project_id and p.owner_id = auth.uid()
    )
  );

-- 7. adapters policies
create policy "adapters_select_policy" on public.adapters
  for select using (
    exists (
      select 1 from public.projects p
      where p.id = adapters.project_id and p.owner_id = auth.uid()
    )
  );

create policy "adapters_insert_policy" on public.adapters
  for insert with check (
    exists (
      select 1 from public.projects p
      where p.id = adapters.project_id and p.owner_id = auth.uid()
    )
  );

create policy "adapters_delete_policy" on public.adapters
  for delete using (
    exists (
      select 1 from public.projects p
      where p.id = adapters.project_id and p.owner_id = auth.uid()
    )
  );

-- 8. compatibility_reports policies
create policy "compatibility_reports_select_policy" on public.compatibility_reports
  for select using (
    exists (
      select 1 from public.projects p
      where p.id = compatibility_reports.project_id and p.owner_id = auth.uid()
    )
  );

create policy "compatibility_reports_insert_policy" on public.compatibility_reports
  for insert with check (
    exists (
      select 1 from public.projects p
      where p.id = compatibility_reports.project_id and p.owner_id = auth.uid()
    )
  );

create policy "compatibility_reports_delete_policy" on public.compatibility_reports
  for delete using (
    exists (
      select 1 from public.projects p
      where p.id = compatibility_reports.project_id and p.owner_id = auth.uid()
    )
  );

-- 9. report_artifacts policies
create policy "report_artifacts_select_policy" on public.report_artifacts
  for select using (
    exists (
      select 1 from public.projects p
      where p.id = report_artifacts.project_id and p.owner_id = auth.uid()
    )
  );

create policy "report_artifacts_insert_policy" on public.report_artifacts
  for insert with check (
    exists (
      select 1 from public.projects p
      where p.id = report_artifacts.project_id and p.owner_id = auth.uid()
    )
  );

create policy "report_artifacts_delete_policy" on public.report_artifacts
  for delete using (
    exists (
      select 1 from public.projects p
      where p.id = report_artifacts.project_id and p.owner_id = auth.uid()
    )
  );
