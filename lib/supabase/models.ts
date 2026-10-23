export type Project = {
  id: string;
  owner_id: string;
  name: string;
  description: string | null;
  created_at: string;
  updated_at: string;
};

export type Spec = {
  id: string;
  project_id: string;
  side: "source" | "target";
  name: string;
  content_type: "openapi+json" | "json-schema" | "sample+json" | "openapi+yaml";
  content_hash: string;
  raw_content: string | null;
  normalized: unknown;
  spec_version: string;
  artifact_ref: string | null;
  blob_reference?: string | null;
  storage_provider?: "inline" | "azure_blob" | "supabase_storage";
  import_status?: "pending" | "processing" | "completed" | "failed";
  file_size_bytes: number;
  created_at: string;
};

export type MappingSet = {
  id: string;
  project_id: string;
  source_spec_id: string;
  target_spec_id: string;
  status: "draft" | "ready" | "compiled" | "executed";
  created_at: string;
  updated_at: string;
};

export type Mapping = {
  id: string;
  mapping_set_id: string;
  source_path: string;
  target_path: string;
  status: "proposed" | "accepted" | "rejected" | "edited";
  transformation: unknown;
  information_loss: unknown[];
  evidence: unknown;
  ai_confidence: string | null;
  semantic_status: "verified" | "ambiguous" | "unverified" | "rejected" | "needs_confirmation" | null;
  decision_history: unknown[];
  created_at: string;
  updated_at: string;
};

export type TransformationPlan = {
  id: string;
  project_id?: string;
  mapping_set_id: string;
  plan: unknown;
  plan_hash?: string;
  status: "compiled" | "executed" | "invalid";
  validation_errors?: unknown[];
  compiled_at: string;
  executed_at: string | null;
};

export type TestRun = {
  id: string;
  project_id: string;
  plan_id: string | null;
  overall_status: "passed" | "failed" | "partial";
  summary: unknown;
  executed_at: string;
  created_at: string;
};

export type Adapter = {
  id: string;
  project_id?: string;
  mapping_set_id: string;
  transformation_plan_id: string;
  language: "typescript" | "ts";
  code: string;
  generator_version?: string;
  fixture_equivalence_status?: "verified" | "failed" | "unverified";
  generated_at: string;
};

export type CompatibilityReport = {
  id: string;
  project_id?: string;
  mapping_set_id: string;
  summary: unknown;
  report_text_markdown: string | null;
  exported_at: string;
  artifact_ref: string | null;
};

export type ReportArtifact = {
  id: string;
  project_id: string;
  report_id: string | null;
  provider: "azure_blob" | "supabase_storage";
  object_key: string;
  content_type: string;
  size_bytes: number;
  checksum: string;
  created_at: string;
};
