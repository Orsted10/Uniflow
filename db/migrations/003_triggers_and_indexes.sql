-- =====================================================================
-- Migration 003: Indexes and Auto-Updating Timestamps
-- UNIFLOW ∞ — API Compatibility Compiler
-- =====================================================================

-- ---------------------------------------------------------------------
-- Trigger Function for updated_at handling
-- ---------------------------------------------------------------------
create or replace function public.handle_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

-- Trigger: projects.updated_at
drop trigger if exists set_projects_updated_at on public.projects;
create trigger set_projects_updated_at
  before update on public.projects
  for each row
  execute function public.handle_updated_at();

-- Trigger: mapping_sets.updated_at
drop trigger if exists set_mapping_sets_updated_at on public.mapping_sets;
create trigger set_mapping_sets_updated_at
  before update on public.mapping_sets
  for each row
  execute function public.handle_updated_at();

-- Trigger: mappings.updated_at
drop trigger if exists set_mappings_updated_at on public.mappings;
create trigger set_mappings_updated_at
  before update on public.mappings
  for each row
  execute function public.handle_updated_at();

-- Trigger: transformation_plans.updated_at
drop trigger if exists set_transformation_plans_updated_at on public.transformation_plans;
create trigger set_transformation_plans_updated_at
  before update on public.transformation_plans
  for each row
  execute function public.handle_updated_at();

-- ---------------------------------------------------------------------
-- Performance & Relational Ownership Indexes
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
