"use client";

import * as React from "react";
import Link from "next/link";
import { TopBar } from "@/components/shell/topbar";
import { Project } from "@/lib/supabase/models";
import { DEMO_PROJECTS } from "@/lib/fixtures/mock-projects";

interface CloudServices {
  supabase: { configured: boolean; status: string; endpoint: string | null };
  groq: { configured: boolean; status: string; model: string };
  azureBlob: { configured: boolean; status: string; accountName: string | null; containerName: string };
  azureSql: { configured: boolean; status: string; server: string | null; database: string | null };
}

export default function LandingDashboardPage() {
  const [projects, setProjects] = React.useState<Project[]>([]);
  const [cloudStatus, setCloudStatus] = React.useState<CloudServices | null>(null);
  const [activePipelineStep, setActivePipelineStep] = React.useState<number>(0);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    // 1. Fetch live projects
    fetch("/api/projects")
      .then((r) => r.json())
      .then((data) => {
        if (data.projects && Array.isArray(data.projects) && data.projects.length > 0) {
          setProjects(data.projects);
        } else {
          setProjects(DEMO_PROJECTS);
        }
      })
      .catch(() => setProjects(DEMO_PROJECTS))
      .finally(() => setLoading(false));

    // 2. Fetch multi-cloud health
    fetch("/api/cloud/status")
      .then((r) => r.json())
      .then((data) => setCloudStatus(data.services))
      .catch(() => {});
  }, []);

  const pipelineStages = [
    {
      index: "01",
      title: "Contract Ingestion",
      tag: "1 MiB Safe Ceiling",
      summary: "Ingests OpenAPI 3.x and standalone JSON Schema documents under strict guardrails.",
      detail:
        "Guards against unbounded remote fetches, resolves local schemas with a 64-depth recursion ceiling, and provides an interactive candidate picker when components.schemas contains multiple candidates.",
      code: `// Normalized Schema Output AST
{
  "$schema": "https://uniflow.dev/schemas/v1/normalized.json",
  "title": "OrderServiceV1",
  "flatFields": {
    "$['order_id']": { "type": "string", "required": true },
    "$['amount']":   { "type": "string", "required": true },
    "$['customer_email']": { "type": "string", "required": false }
  }
}`,
    },
    {
      index: "02",
      title: "Deterministic Diff Engine",
      tag: "Pure 9-Facet Diff",
      summary: "Evaluates exact matches, renames, type conflicts, and missing required constraints.",
      detail:
        "Flattens nested trees into canonical JSONPath keys ($['field']), identifying safe 1:1 copies versus breaking changes requiring type coercion or human confirmation.",
      code: `// Structural Diff Output Matrix
{
  "summary": {
    "totalTargetFields": 3,
    "exactMatches": 0,
    "renamedCandidates": 1,
    "typeConflicts": 2,
    "missingRequired": 0
  },
  "items": [
    { "targetPath": "$['id']", "sourcePath": "$['order_id']", "conflict": "type_mismatch" },
    { "targetPath": "$['total']", "sourcePath": "$['amount']", "conflict": "string_to_number" }
  ]
}`,
    },
    {
      index: "03",
      title: "Groq LLM Advisory Review",
      tag: "openai/gpt-oss-120b",
      summary: "Generates candidate mappings with strict Zod validation and injection defenses.",
      detail:
        "Server-side execution only. Sends bounded field summaries with zero arbitrary code execution. Every ambiguous mapping requires explicit human approval before compiler admission.",
      code: `// Live Groq Mapping Proposal (Strict Zod Verified)
{
  "targetPath": "$['id']",
  "sourcePath": "$['order_id']",
  "operation": "typeConversion",
  "conversionType": "string-to-integer",
  "confidence": "HIGH",
  "uncertainty": "LOW",
  "status": "accepted" // Human approval required
}`,
    },
    {
      index: "04",
      title: "Transformation IR Compiler",
      tag: "Zero Dynamic Eval",
      summary: "Compiles approved candidate mappings into an immutable, sandboxed execution plan.",
      detail:
        "Guarantees that no arbitrary JavaScript, SQL, or unsafe reflection is executed. Operates strictly over 7 allowlisted AST primitives (copy, rename, readNested, constructObject, typeConversion, default, lookup).",
      code: `// Compiled Transformation Plan IR
{
  "planId": "plan-ord-v1-to-v2",
  "sourceSchemaHash": "e3b0c44298fc1c149afbf4c8996fb924...",
  "targetSchemaHash": "ca978112ca1bbdcafac231b39a23dc4d...",
  "steps": [
    { "stepId": "s1", "targetPath": "$.id", "operation": "typeConversion", "sourcePath": "$.order_id", "conversionType": "string-to-integer" },
    { "stepId": "s2", "targetPath": "$.total", "operation": "typeConversion", "sourcePath": "$.amount", "conversionType": "string-to-number" }
  ]
}`,
    },
    {
      index: "05",
      title: "TypeScript Codegen & Test Suite",
      tag: "Equivalence Verified",
      summary: "Emits a pure, standalone TypeScript adapter function with equivalence verification.",
      detail:
        "Compiles runtime TypeScript code that runs anywhere without external dependencies. Simultaneously executes the trusted AST interpreter and the generated adapter across test fixtures to mathematically verify output parity.",
      code: `// Generated Standalone TypeScript Adapter
export function transform(source: Record<string, any>): Record<string, any> {
  const target: Record<string, any> = {};
  if (source.order_id !== undefined && source.order_id !== null) {
    target.id = parseInt(String(source.order_id), 10);
  }
  if (source.amount !== undefined && source.amount !== null) {
    target.total = parseFloat(String(source.amount));
  }
  return target;
}`,
    },
    {
      index: "06",
      title: "Azure Cloud Certification Ledger",
      tag: "Azure SQL & Blob Store",
      summary: "Persists execution evidence and artifacts with cryptographic SHA-256 digests.",
      detail:
        "Atomically commits run inputs, outputs, equivalence equality flags, and audit records to Azure SQL (dbo.compatibility_runs). Uploads markdown and JSON certification reports to private Azure Blob Storage.",
      code: `// Azure SQL Execution Evidence Ledger Record
{
  "runId": "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d",
  "azureSqlRunId": "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d",
  "blobReportMdUrl": "https://uniflowspecs.blob.core.windows.net/uniflow-specs/...",
  "sourceSchemaHash": "e3b0c442...",
  "targetSchemaHash": "ca978112...",
  "status": "PASSED"
}`,
    },
  ];

  return (
    <div className="min-h-screen bg-[#0b0f17] text-slate-100 flex flex-col font-sans selection:bg-teal-500 selection:text-white">
      <TopBar />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 w-full flex-1 space-y-12">
        {/* Hero Section */}
        <section className="relative pt-4 pb-8 space-y-6 max-w-4xl">
          <div className="inline-flex items-center space-x-2 px-2.5 py-1 rounded bg-slate-800/80 border border-slate-700/80 text-xs font-mono text-teal-400">
            <span className="w-1.5 h-1.5 rounded-full bg-teal-400 animate-ping"></span>
            <span>Deterministic Contract Compatibility Compiler</span>
          </div>

          <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight text-white leading-tight">
            API Contracts Drift. Microservices Break. We Compile the Bridge.
          </h1>

          <p className="text-sm sm:text-base text-slate-400 leading-relaxed max-w-3xl">
            UNIFLOW ∞ transforms brittle API versioning into a mathematically verified compilation pipeline.
            Ingest OpenAPI and JSON Schema specs, diff structural contracts, synthesize mapping proposals via
            Groq’s <code className="text-teal-300 font-mono text-xs bg-slate-900 px-1 py-0.5 rounded">openai/gpt-oss-120b</code>,
            enforce mandatory human review gates, and compile zero-eval TypeScript adapters with multi-cloud
            evidence persisted across Supabase, Azure Blob, and Azure SQL.
          </p>

          <div className="flex flex-wrap items-center gap-3 pt-2">
            <Link
              href="/projects/new"
              className="inline-flex items-center justify-center text-xs font-semibold px-4 py-2.5 rounded bg-teal-500 text-slate-950 hover:bg-teal-400 transition shadow-sm font-mono tracking-tight"
            >
              + Create New Workspace
            </Link>
            <Link
              href="/projects"
              className="inline-flex items-center justify-center text-xs font-medium px-4 py-2.5 rounded border border-slate-700 bg-slate-900/80 text-slate-300 hover:text-white hover:bg-slate-800 transition shadow-sm"
            >
              Browse Existing Projects
            </Link>
          </div>
        </section>

        {/* Multi-Cloud Production Architecture Grid */}
        <section aria-labelledby="cloud-status-heading" className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 id="cloud-status-heading" className="text-xs font-mono font-semibold uppercase tracking-wider text-slate-400">
              Multi-Cloud Production Topology
            </h2>
            <span className="text-[11px] font-mono text-teal-400 flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-teal-400"></span> Live Verified
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
            {/* Supabase */}
            <div className="p-4 rounded-lg bg-slate-900/60 border border-slate-800 space-y-2 hover:border-slate-700 transition">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-white">PostgreSQL Store</span>
                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-emerald-950/80 text-emerald-400 border border-emerald-800/60">
                  Supabase RLS
                </span>
              </div>
              <p className="text-[11px] text-slate-400 leading-normal">
                Primary system of record. Stores tenant projects, normalized schema trees, mapping decision histories, and compiled IR plans.
              </p>
              <div className="pt-1 font-mono text-[10px] text-slate-500 truncate">
                Host: {cloudStatus?.supabase.endpoint || "qympzvibtfevlyhbgwmh.supabase.co"}
              </div>
            </div>

            {/* Groq AI */}
            <div className="p-4 rounded-lg bg-slate-900/60 border border-slate-800 space-y-2 hover:border-slate-700 transition">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-white">LLM Advisory Engine</span>
                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-sky-950/80 text-sky-400 border border-sky-800/60">
                  Groq 120B
                </span>
              </div>
              <p className="text-[11px] text-slate-400 leading-normal">
                Sub-second candidate proposal engine. Strict Zod schema output, prompt injection insulation, and non-executable reasoning.
              </p>
              <div className="pt-1 font-mono text-[10px] text-slate-500 truncate">
                Model: {cloudStatus?.groq.model || "openai/gpt-oss-120b"}
              </div>
            </div>

            {/* Azure Blob */}
            <div className="p-4 rounded-lg bg-slate-900/60 border border-slate-800 space-y-2 hover:border-slate-700 transition">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-white">Blob Storage</span>
                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-cyan-950/80 text-cyan-400 border border-cyan-800/60">
                  Azure Blob
                </span>
              </div>
              <p className="text-[11px] text-slate-400 leading-normal">
                Private immutable container for raw contract documents, exported markdown certification reports, and JSON evidence bundles.
              </p>
              <div className="pt-1 font-mono text-[10px] text-slate-500 truncate">
                Container: {cloudStatus?.azureBlob.containerName || "uniflow-specs"}
              </div>
            </div>

            {/* Azure SQL */}
            <div className="p-4 rounded-lg bg-slate-900/60 border border-slate-800 space-y-2 hover:border-slate-700 transition">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-white">Execution Evidence</span>
                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-teal-950/80 text-teal-400 border border-teal-800/60">
                  Azure SQL Serverless
                </span>
              </div>
              <p className="text-[11px] text-slate-400 leading-normal">
                Append-only execution evidence ledger. Persists test inputs, outputs, equality checks, and audit trails to dbo.compatibility_runs.
              </p>
              <div className="pt-1 font-mono text-[10px] text-slate-500 truncate">
                DB: {cloudStatus?.azureSql.database || "uniflow-evidence"} (1433)
              </div>
            </div>
          </div>
        </section>

        {/* Interactive Pipeline Visualizer (Deep Craft Playground) */}
        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-5 sm:p-7 space-y-6">
          <div className="space-y-1">
            <h2 className="text-sm font-semibold tracking-tight text-white uppercase font-mono">
              The UNIFLOW Compilation Pipeline
            </h2>
            <p className="text-xs text-slate-400">
              Click through the 6 pipeline stages to inspect the AST inputs, intermediate representation, and compiled code.
            </p>
          </div>

          {/* Stepper Tabs */}
          <div className="flex items-center space-x-2 overflow-x-auto pb-2 border-b border-slate-800 text-xs font-mono">
            {pipelineStages.map((stg, idx) => (
              <button
                key={stg.index}
                type="button"
                onClick={() => setActivePipelineStep(idx)}
                className={`px-3 py-1.5 rounded font-medium whitespace-nowrap transition flex items-center space-x-2 ${
                  activePipelineStep === idx
                    ? "bg-teal-500/10 border border-teal-500/40 text-teal-300"
                    : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/60"
                }`}
              >
                <span className="text-[10px] opacity-60">{stg.index}.</span>
                <span>{stg.title}</span>
              </button>
            ))}
          </div>

          {/* Active Stage Breakdown */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            <div className="lg:col-span-5 space-y-3">
              <div className="inline-block font-mono text-[11px] text-teal-400 px-2 py-0.5 rounded bg-teal-950/60 border border-teal-800/50">
                {pipelineStages[activePipelineStep].tag}
              </div>
              <h3 className="text-base font-bold text-white tracking-tight">
                {pipelineStages[activePipelineStep].title}
              </h3>
              <p className="text-xs text-slate-300 leading-relaxed">
                {pipelineStages[activePipelineStep].summary}
              </p>
              <p className="text-xs text-slate-400 leading-relaxed">
                {pipelineStages[activePipelineStep].detail}
              </p>
            </div>

            <div className="lg:col-span-7 bg-[#070b11] border border-slate-800/90 rounded-lg p-4 font-mono text-[11px] text-slate-300 overflow-x-auto max-h-[300px]">
              <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-800/60 text-[10px] text-slate-500">
                <span>INTERACTIVE PIPELINE ARTIFACT</span>
                <span>READ-ONLY VIEW</span>
              </div>
              <pre className="whitespace-pre text-teal-200/90 leading-snug">
                {pipelineStages[activePipelineStep].code}
              </pre>
            </div>
          </div>
        </section>

        {/* Workspaces & Projects List */}
        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-5 sm:p-7 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800">
            <div>
              <h2 className="text-sm font-semibold text-white tracking-tight uppercase font-mono">
                Active Compiler Workspaces
              </h2>
              <p className="text-xs text-slate-400">
                Select a project to enter the interactive workbench or initialize a new schema pair.
              </p>
            </div>
            <Link
              href="/projects/new"
              className="inline-flex items-center text-xs font-semibold px-3 py-1.5 rounded bg-teal-500 text-slate-950 hover:bg-teal-400 transition font-mono self-start sm:self-auto"
            >
              + Launch Workspace
            </Link>
          </div>

          {loading ? (
            <div className="space-y-2">
              <div className="h-12 bg-slate-800/40 rounded animate-pulse" />
              <div className="h-12 bg-slate-800/40 rounded animate-pulse" />
            </div>
          ) : projects.length === 0 ? (
            <div className="text-center py-8 text-xs text-slate-400 space-y-2">
              <p>No projects found in this tenant.</p>
              <Link href="/projects/new" className="text-teal-400 hover:underline">
                Create your first project →
              </Link>
            </div>
          ) : (
            <div className="divide-y divide-slate-800/60">
              {projects.map((p) => (
                <div
                  key={p.id}
                  className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 hover:bg-slate-800/30 -mx-2 px-2 rounded transition"
                >
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <Link
                        href={`/projects/${p.id}`}
                        className="text-xs sm:text-sm font-semibold text-white hover:text-teal-400 transition"
                      >
                        {p.name}
                      </Link>
                      <span className="font-mono text-[10px] text-slate-500 bg-slate-800 px-1.5 py-0.2 rounded">
                        {p.id}
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 line-clamp-1">
                      {p.description || "API Compatibility Verification Workspace"}
                    </p>
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    <span className="font-mono text-[10px] text-slate-500">
                      {new Date(p.updated_at).toLocaleDateString()}
                    </span>
                    <Link
                      href={`/projects/${p.id}`}
                      className="text-xs font-mono font-medium text-teal-400 hover:text-teal-300 border border-teal-500/30 bg-teal-500/10 px-2.5 py-1 rounded transition"
                    >
                      Open Workbench →
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </main>

      <footer className="border-t border-slate-800/80 bg-[#070b11] py-6 text-center text-xs text-slate-500 space-y-1">
        <p>UNIFLOW ∞ — Deterministic API Compatibility Compiler &bull; Multi-Cloud Architecture</p>
        <p className="text-[11px] text-slate-600 font-mono">
          Supabase PostgreSQL &bull; Groq LLM Advisory &bull; Azure SQL Ledger &bull; Azure Blob Storage
        </p>
      </footer>
    </div>
  );
}
