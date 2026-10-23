-- Supabase schema: app system of record.
-- Apply after the Supabase project is created.
-- Enable RLS after tables are created.

create table if not exists projects (
  id            uuid primary key default gen_random_uuid(),
  owner_id      uuid not null,
  name          text not null,
  description   text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create table if not exists specs (
  id             uuid primary key default gen_random_uuid(),
  project_id     uuid not null references projects(id) on delete cascade,
  side           text not null check (side in ('source', 'target')),
  name           text not null,
  content_type   text not null check (
    content_type in (
      'openapi+json',
      'json-schema',
      'sample+json',
      'openapi+yaml'
    )
  ),
  content_hash   text not null default '',
  raw_content    text,
  normalized     jsonb not null,
  spec_version   text not null,
  artifact_ref   text,
  file_size_bytes integer not null default 0,
  created_at     timestamptz not null default now()
);

create table if not exists mapping_sets (
  id               uuid primary key default gen_random_uuid(),
  project_id       uuid not null references projects(id) on delete cascade,
  source_spec_id   uuid not null references specs(id) on delete cascade,
  target_spec_id   uuid not null references specs(id) on delete cascade,
  status           text not null default 'draft' check (
    status in ('draft', 'ready', 'compiled', 'executed')
  ),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  unique (project_id, source_spec_id, target_spec_id)
);

create table if not exists mappings (
  id                   uuid primary key default gen_random_uuid(),
  mapping_set_id       uuid not null references mapping_sets(id) on delete cascade,
  source_path          text not null,
  target_path          text not null,
  status               text not null default 'proposed' check (
    status in ('proposed', 'accepted', 'rejected', 'edited')
  ),
  transformation       jsonb not null,
  information_loss     jsonb not null default '[]'::jsonb,
  evidence             jsonb not null default '{}'::jsonb,
  ai_confidence        text,
  semantic_status      text check (
    semantic_status in (
      'verified',
      'ambiguous',
      'unverified',
      'rejected',
      'needs_confirmation'
    )
  ),
  decision_history     jsonb not null default '[]'::jsonb,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

create table if not exists transformation_plans (
  id                uuid primary key default gen_random_uuid(),
  mapping_set_id    uuid not null references mapping_sets(id) on delete cascade,
  plan              jsonb not null,
  status            text not null default 'compiled' check (
    status in ('compiled', 'executed', 'invalid')
  ),
  compiled_at       timestamptz not null default now(),
  executed_at       timestamptz
);

create table if not exists adapters (
  id                     uuid primary key default gen_random_uuid(),
  mapping_set_id         uuid not null references mapping_sets(id) on delete cascade,
  transformation_plan_id uuid not null references transformation_plans(id) on delete cascade,
  language               text not null check (language in ('ts')),
  code                   text not null,
  generated_at           timestamptz not null default now()
);

create table if not exists compatibility_reports (
  id                     uuid primary key default gen_random_uuid(),
  mapping_set_id         uuid not null references mapping_sets(id) on delete cascade,
  summary                jsonb not null,
  report_text_markdown   text,
  exported_at            timestamptz not null default now(),
  artifact_ref           text
);

create table if not exists report_artifacts (
  id             uuid primary key default gen_random_uuid(),
  report_id      uuid not null references compatibility_reports(id) on delete cascade,
  storage_type   text not null check (storage_type in ('azure_blob', 'supabase_storage')),
  storage_path   text not null,
  content_type   text not null,
  size_bytes     integer not null,
  created_at     timestamptz not null default now()
);

create index if not exists projects_owner_id on projects(owner_id);
create index if not exists specs_project_side on specs(project_id, side);
create index if not exists mapping_sets_project on mapping_sets(project_id);
create index if not exists mappings_set_status on mappings(mapping_set_id, status);
create index if not exists transformation_plans_set on transformation_plans(mapping_set_id);
create index if not exists adapters_set on adapters(mapping_set_id);
create index if not exists compatibility_reports_set on compatibility_reports(mapping_set_id);

alter table projects enable row level security;
alter table specs enable row level security;
alter table mapping_sets enable row level security;
alter table mappings enable row level security;
alter table transformation_plans enable row level security;
alter table adapters enable row level security;
alter table compatibility_reports enable row level security;
alter table report_artifacts enable row level security;

-- RLS policy stubs. Replace/inspect these in the Supabase dashboard.
-- At minimum: each table is accessible to the owner of the project it belongs to.

create policy "owner can manage own projects" on projects
  for all using ( auth.uid() = owner_id );

create policy "owner can manage own specs" on specs
  for all using (
    exists (
      select 1 from projects p
      where p.id = specs.project_id
        and p.owner_id = auth.uid()
    )
  );

create policy "owner can manage own mapping sets" on mapping_sets
  for all using (
    exists (
      select 1 from projects p
      where p.id = mapping_sets.project_id
        and p.owner_id = auth.uid()
    )
  );

create policy "owner can manage own mappings" on mappings
  for all using (
    exists (
      select 1 from mapping_sets ms
      join projects p on p.id = ms.project_id
      where ms.id = mappings.mapping_set_id
        and p.owner_id = auth.uid()
    )
  );

create policy "owner can manage own transformation plans" on transformation_plans
  for all using (
    exists (
      select 1 from mapping_sets ms
      join projects p on p.id = ms.project_id
      where ms.id = transformation_plans.mapping_set_id
        and p.owner_id = auth.uid()
    )
  );

create policy "owner can manage own adapters" on adapters
  for all using (
    exists (
      select 1 from mapping_sets ms
      join projects p on p.id = ms.project_id
      where ms.id = adapters.mapping_set_id
        and p.owner_id = auth.uid()
    )
  );

create policy "owner can manage own compatibility reports" on compatibility_reports
  for all using (
    exists (
      select 1 from mapping_sets ms
      join projects p on p.id = ms.project_id
      where ms.id = compatibility_reports.mapping_set_id
        and p.owner_id = auth.uid()
    )
  );

create policy "owner can manage own report artifacts" on report_artifacts
  for all using (
    exists (
      select 1 from compatibility_reports cr
      join mapping_sets ms on ms.id = cr.mapping_set_id
      join projects p on p.id = ms.project_id
      where cr.id = report_artifacts.report_id
        and p.owner_id = auth.uid()
    )
  );
