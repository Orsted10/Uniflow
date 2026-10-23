-- =====================================================================
-- Migration 001: Create Core Tables
-- UNIFLOW ∞ — API Compatibility Compiler
-- PostgreSQL Schema for Supabase
-- =====================================================================

-- Enable pgcrypto / uuid-ossp if gen_random_uuid is not built-in
create extension if not exists "pgcrypto";

-- 1. projects: Top-level workspace owned by a Supabase authenticated user
create table if not exists public.projects (
  id            uuid primary key default gen_random_uuid(),
  owner_id      uuid not null references auth.users(id) on delete cascade,
  name          text not null check (char_length(trim(name)) > 0),
  description   text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- 2. specs: API contract specifications (OpenAPI 3.x, JSON Schema, sample JSON)
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

-- 3. mapping_sets: Paired source and target specifications
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

-- 4. mappings: Individual field-to-field semantic mappings
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

-- 5. transformation_plans: Compiled Transformation IR plans
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

-- 6. test_runs: Deterministic execution and validation runs
create table if not exists public.test_runs (
  id             uuid primary key default gen_random_uuid(),
  project_id     uuid not null references public.projects(id) on delete cascade,
  plan_id        uuid references public.transformation_plans(id) on delete set null,
  overall_status text not null check (overall_status in ('passed', 'failed', 'partial')),
  summary        jsonb not null default '{}'::jsonb,
  executed_at    timestamptz not null default now(),
  created_at     timestamptz not null default now()
);

-- 7. adapters: Generated pure TypeScript transformation adapters
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

-- 8. compatibility_reports: Structured compatibility reports
create table if not exists public.compatibility_reports (
  id                   uuid primary key default gen_random_uuid(),
  project_id           uuid not null references public.projects(id) on delete cascade,
  report_json          jsonb not null,
  markdown_text        text,
  created_at           timestamptz not null default now()
);

-- 9. report_artifacts: Immutable artifact pointers (Azure Blob or Supabase Storage)
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
