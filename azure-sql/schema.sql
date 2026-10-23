-- Azure SQL: execution evidence only.
-- This is not the app system of record and does not replace Supabase.
-- Supabase identifiers stored here are logical references, not cross-database foreign keys.

create table dbo.compatibility_runs (
  run_id               uniqueidentifier primary key default newid(),
  supabase_project_id  uniqueidentifier not null,
  supabase_mapping_set_id uniqueidentifier not null,
  transformation_plan_id uniqueidentifier not null,
  plan_version          nvarchar(64) not null,
  adapter_version       nvarchar(64) not null,
  started_at            datetime2 not null default sysdatetime(),
  finished_at           datetime2 null,
  status               nvarchar(32) not null default 'running' check (
    status in ('running', 'passed', 'failed', 'invalid')
  )
);

create table dbo.run_inputs (
  run_id        uniqueidentifier not null
    references dbo.compatibility_runs(run_id),
  case_index    int not null,
  description   nvarchar(256) not null,
  input_payload nvarchar(max) not null,
  constraint pk_run_inputs primary key (run_id, case_index)
);

create table dbo.run_results (
  run_id              uniqueidentifier not null
    references dbo.compatibility_runs(run_id),
  case_index          int not null,
  target_valid        bit not null,
  interpreter_output  nvarchar(max) null,
  adapter_output      nvarchar(max) null,
  outputs_equal       bit null,
  failure_reason      nvarchar(max) null,
  result_detail       nvarchar(max) null,
  constraint pk_run_results primary key (run_id, case_index)
);

create table dbo.audit_records (
  audit_id    uniqueidentifier primary key default newid(),
  run_id      uniqueidentifier not null
    references dbo.compatibility_runs(run_id),
  event_type  nvarchar(64) not null,
  occurred_at datetime2 not null default sysdatetime(),
  actor       nvarchar(128) null,
  detail      nvarchar(max) null
);

create index ix_run_inputs_run on dbo.run_inputs(run_id);
create index ix_run_results_run on dbo.run_results(run_id);
create index ix_audit_run on dbo.audit_records(run_id);
