-- =====================================================================
-- UNIFLOW ∞ — API Compatibility Compiler
-- Consolidated PostgreSQL Schema for Supabase (Application Source of Truth)
--
-- Instructions:
-- Paste this entire file into your Supabase Dashboard SQL Editor and run.
-- It is idempotent (uses IF NOT EXISTS / OR REPLACE) and sets up all tables,
-- foreign keys, RLS security policies, triggers, and indexes.
-- =====================================================================

create extension if not exists "pgcrypto";

-- 1. projects
create table if not exists public.projects (
  id            uuid primary key default gen_random_uuid(),
  owner_id      uuid not null references auth.users(id) on delete cascade,
  name          text not null check (char_length(trim(name)) > 0),
  description   text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- 2. specs
create table if not exists public.specs (
  id                uuid primary key default gen_random_uuid(),
  project_id        uuid not null references public.projects(id) on delete cascade,
  side              text not null check (side in ('source', 'target')),
  original_filename text not null,
  format            text not null check (
    format in ('openapi+json', 'json-schema', 'sample+json', 'openapi+yaml')
  ),
  normalized_schema jsonb not null,
  schema_hash       text not null,
  storage_provider  text not null default 'inline' check (
    storage_provider in ('inline', 'azure_blob', 'supabase_storage')
  ),
  blob_reference    text,
  import_status     text not null default 'completed' check (
    import_status in ('pending', 'processing', 'completed', 'failed')
  ),
  created_at        timestamptz not null default now()
);

-- 3. mapping_sets
create table if not exists public.mapping_sets (
  id               uuid primary key default gen_random_uuid(),
  project_id       uuid not null references public.projects(id) on delete cascade,
  source_spec_id   uuid not null references public.specs(id) on delete cascade,
  target_spec_id   uuid not null references public.specs(id) on delete cascade,
  status           text not null default 'draft' check (
    status in ('draft', 'ready', 'compiled', 'executed')
  ),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  constraint uq_mapping_set_pair unique (project_id, source_spec_id, target_spec_id)
);

-- 4. mappings
create table if not exists public.mappings (
  id                 uuid primary key default gen_random_uuid(),
  mapping_set_id     uuid not null references public.mapping_sets(id) on delete cascade,
  source_path        text,
  target_path        text,
  proposed_operation jsonb not null,
  status             text not null default 'proposed' check (
    status in ('proposed', 'accepted', 'rejected', 'edited')
  ),
  rationale          text,
  uncertainty        text not null default 'low' check (
    uncertainty in ('low', 'medium', 'high', 'unknown')
  ),
  reviewed_by        uuid references auth.users(id) on delete set null,
  reviewed_at        timestamptz,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

-- 5. transformation_plans
create table if not exists public.transformation_plans (
  id                uuid primary key default gen_random_uuid(),
  project_id        uuid not null references public.projects(id) on delete cascade,
  mapping_set_id    uuid not null references public.mapping_sets(id) on delete cascade,
  plan_json         jsonb not null,
  plan_hash         text not null,
  status            text not null default 'compiled' check (
    status in ('invalid', 'compiled', 'executed')
  ),
  validation_errors jsonb not null default '[]'::jsonb,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

-- 6. test_runs
create table if not exists public.test_runs (
  id             uuid primary key default gen_random_uuid(),
  project_id     uuid not null references public.projects(id) on delete cascade,
  plan_id        uuid references public.transformation_plans(id) on delete set null,
  overall_status text not null check (overall_status in ('passed', 'failed', 'partial')),
  summary        jsonb not null default '{}'::jsonb,
  executed_at    timestamptz not null default now(),
  created_at     timestamptz not null default now()
);

-- 7. adapters
create table if not exists public.adapters (
  id                          uuid primary key default gen_random_uuid(),
  project_id                  uuid not null references public.projects(id) on delete cascade,
  plan_id                     uuid not null references public.transformation_plans(id) on delete cascade,
  language                    text not null default 'typescript' check (language in ('typescript')),
  source_text                 text not null,
  generator_version           text not null default '1.0.0',
  fixture_equivalence_status  text not null default 'verified' check (
    fixture_equivalence_status in ('verified', 'failed', 'unverified')
  ),
  created_at                  timestamptz not null default now()
);

-- 8. compatibility_reports
create table if not exists public.compatibility_reports (
  id                   uuid primary key default gen_random_uuid(),
  project_id           uuid not null references public.projects(id) on delete cascade,
  report_json          jsonb not null,
  markdown_text        text,
  created_at           timestamptz not null default now()
);

-- 9. report_artifacts
create table if not exists public.report_artifacts (
  id           uuid primary key default gen_random_uuid(),
  project_id   uuid not null references public.projects(id) on delete cascade,
  report_id    uuid references public.compatibility_reports(id) on delete cascade,
  provider     text not null check (provider in ('azure_blob', 'supabase_storage')),
  object_key   text not null,
  content_type text not null,
  size_bytes   bigint not null,
  checksum     text not null,
  created_at   timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- Row Level Security (RLS)
-- ---------------------------------------------------------------------
alter table public.projects enable row level security;
alter table public.specs enable row level security;
alter table public.mapping_sets enable row level security;
alter table public.mappings enable row level security;
alter table public.transformation_plans enable row level security;
alter table public.test_runs enable row level security;
alter table public.adapters enable row level security;
alter table public.compatibility_reports enable row level security;
alter table public.report_artifacts enable row level security;

-- Drop existing policies if re-running
drop policy if exists "projects_select_policy" on public.projects;
drop policy if exists "projects_insert_policy" on public.projects;
drop policy if exists "projects_update_policy" on public.projects;
drop policy if exists "projects_delete_policy" on public.projects;

drop policy if exists "specs_select_policy" on public.specs;
drop policy if exists "specs_insert_policy" on public.specs;
drop policy if exists "specs_update_policy" on public.specs;
drop policy if exists "specs_delete_policy" on public.specs;

drop policy if exists "mapping_sets_select_policy" on public.mapping_sets;
drop policy if exists "mapping_sets_insert_policy" on public.mapping_sets;
drop policy if exists "mapping_sets_update_policy" on public.mapping_sets;
drop policy if exists "mapping_sets_delete_policy" on public.mapping_sets;

drop policy if exists "mappings_select_policy" on public.mappings;
drop policy if exists "mappings_insert_policy" on public.mappings;
drop policy if exists "mappings_update_policy" on public.mappings;
drop policy if exists "mappings_delete_policy" on public.mappings;

drop policy if exists "transformation_plans_select_policy" on public.transformation_plans;
drop policy if exists "transformation_plans_insert_policy" on public.transformation_plans;
drop policy if exists "transformation_plans_update_policy" on public.transformation_plans;
drop policy if exists "transformation_plans_delete_policy" on public.transformation_plans;

drop policy if exists "test_runs_select_policy" on public.test_runs;
drop policy if exists "test_runs_insert_policy" on public.test_runs;
drop policy if exists "test_runs_delete_policy" on public.test_runs;

drop policy if exists "adapters_select_policy" on public.adapters;
drop policy if exists "adapters_insert_policy" on public.adapters;
drop policy if exists "adapters_delete_policy" on public.adapters;

drop policy if exists "compatibility_reports_select_policy" on public.compatibility_reports;
drop policy if exists "compatibility_reports_insert_policy" on public.compatibility_reports;
drop policy if exists "compatibility_reports_delete_policy" on public.compatibility_reports;

drop policy if exists "report_artifacts_select_policy" on public.report_artifacts;
drop policy if exists "report_artifacts_insert_policy" on public.report_artifacts;
drop policy if exists "report_artifacts_delete_policy" on public.report_artifacts;

-- Create Tenant Isolation Policies
create policy "projects_select_policy" on public.projects
  for select using (auth.uid() = owner_id);

create policy "projects_insert_policy" on public.projects
  for insert with check (auth.uid() = owner_id);

create policy "projects_update_policy" on public.projects
  for update using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

create policy "projects_delete_policy" on public.projects
  for delete using (auth.uid() = owner_id);

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

-- ---------------------------------------------------------------------
-- Trigger Function for updated_at
-- ---------------------------------------------------------------------
create or replace function public.handle_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists set_projects_updated_at on public.projects;
create trigger set_projects_updated_at
  before update on public.projects
  for each row
  execute function public.handle_updated_at();

drop trigger if exists set_mapping_sets_updated_at on public.mapping_sets;
create trigger set_mapping_sets_updated_at
  before update on public.mapping_sets
  for each row
  execute function public.handle_updated_at();

drop trigger if exists set_mappings_updated_at on public.mappings;
create trigger set_mappings_updated_at
  before update on public.mappings
  for each row
  execute function public.handle_updated_at();

drop trigger if exists set_transformation_plans_updated_at on public.transformation_plans;
create trigger set_transformation_plans_updated_at
  before update on public.transformation_plans
  for each row
  execute function public.handle_updated_at();

-- ---------------------------------------------------------------------
-- Performance & Relational Indexes
-- ---------------------------------------------------------------------
create index if not exists idx_projects_owner_id on public.projects(owner_id);
create index if not exists idx_specs_project_side on public.specs(project_id, side);
create index if not exists idx_mapping_sets_project on public.mapping_sets(project_id);
create index if not exists idx_mappings_set_status on public.mappings(mapping_set_id, status);
create index if not exists idx_transformation_plans_project on public.transformation_plans(project_id);
create index if not exists idx_test_runs_project on public.test_runs(project_id);
create index if not exists idx_adapters_project_plan on public.adapters(project_id, plan_id);
create index if not exists idx_reports_project on public.compatibility_reports(project_id);
create index if not exists idx_artifacts_project on public.report_artifacts(project_id);
