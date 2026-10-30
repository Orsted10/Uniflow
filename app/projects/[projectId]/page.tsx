"use client";

import * as React from "react";
import { useParams } from "next/navigation";
import { TopBar } from "@/components/shell/topbar";
import { ProjectSidebar, WorkspaceTab } from "@/components/shell/sidebar";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import { StatusChip } from "@/components/ui/status-chip";
import { ErrorPanel } from "@/components/ui/error-panel";
import { FileDropzone } from "@/components/ui/dropzone";
import { CodeViewer } from "@/components/ui/code-viewer";
import { EmptyState } from "@/components/ui/empty-state";
import { Project } from "@/lib/supabase/models";
import { StructuralDiff, NormalizedSchema, DiffItem } from "@/lib/specs/types";
import {
  CandidateMapping,
  AllowedOperation,
  ALLOWED_OPERATIONS,
  SUPPORTED_CONVERSIONS,
} from "@/lib/mapping/types";
import { TransformationPlan } from "@/lib/transformation/ir";
import { ExecutionResult } from "@/lib/transformation/interpreter";
import { TargetValidationResult } from "@/lib/transformation/validate";
import { EquivalenceTestSuiteResult } from "@/lib/transformation/equivalence";
import { CompatibilityReportData } from "@/lib/reports/assemble";
import { CANONICAL_SOURCE_SPEC, CANONICAL_TARGET_SPEC, CANONICAL_TEST_FIXTURES } from "@/lib/specs/fixtures";
import { SchemaTree } from "@/components/ui/schema-tree";
import { ConfirmationDialog } from "@/components/ui/confirmation-dialog";

export default function ProjectWorkspacePage() {
  const params = useParams();
  const projectId = (params?.projectId as string) || "";

  const [activeTab, setActiveTab] = React.useState<WorkspaceTab>("overview");
  const [project, setProject] = React.useState<Project | null>(null);

  // Contract specs
  const [sourceText, setSourceText] = React.useState("");
  const [targetText, setTargetText] = React.useState("");

  // Normalized schema representations & available OpenAPI schemas
  const [sourceNormalized, setSourceNormalized] = React.useState<NormalizedSchema | null>(null);
  const [targetNormalized, setTargetNormalized] = React.useState<NormalizedSchema | null>(null);
  const [sourceAvailableSchemas, setSourceAvailableSchemas] = React.useState<string[]>([]);
  const [targetAvailableSchemas, setTargetAvailableSchemas] = React.useState<string[]>([]);
  const [selectedSourceSchema, setSelectedSourceSchema] = React.useState<string>("");
  const [selectedTargetSchema, setSelectedTargetSchema] = React.useState<string>("");

  // Spec replacement confirmation modal
  const [showReplaceConfirm, setShowReplaceConfirm] = React.useState(false);

  // Analysis & execution states
  const [diff, setDiff] = React.useState<StructuralDiff | null>(null);
  const [diffSearchQuery, setDiffSearchQuery] = React.useState("");
  const [diffSeverityFilter, setDiffSeverityFilter] = React.useState<"all" | "error" | "warning" | "info">("all");
  const [diffCategoryFilter, setDiffCategoryFilter] = React.useState<string>("all");
  const [selectedDiffItem, setSelectedDiffItem] = React.useState<DiffItem | null>(null);

  // Mapping review & AI proposal states (Phase 4)
  const [mappings, setMappings] = React.useState<CandidateMapping[]>([]);
  const [providerConfig, setProviderConfig] = React.useState<{
    configured: boolean;
    model: string;
    fastModel?: string;
    timeoutMs: number;
  } | null>(null);
  const [proposeLoading, setProposeLoading] = React.useState(false);
  const [mappingFilterStatus, setMappingFilterStatus] = React.useState<string>("all");
  const [mappingFilterUncertainty, setMappingFilterUncertainty] = React.useState<string>("all");
  const [mappingSearchQuery, setMappingSearchQuery] = React.useState("");

  // Manual & Edit mapping modal states
  const [isManualModalOpen, setIsManualModalOpen] = React.useState(false);
  const [activeMappingForEdit, setActiveMappingForEdit] = React.useState<CandidateMapping | null>(null);
  const [formTargetPath, setFormTargetPath] = React.useState("");
  const [formSourcePath, setFormSourcePath] = React.useState("");
  const [formOperation, setFormOperation] = React.useState<AllowedOperation>("copy");
  const [formConversionType, setFormConversionType] = React.useState("string-to-integer");
  const [formDefaultValue, setFormDefaultValue] = React.useState("");
  const [formLookupTable, setFormLookupTable] = React.useState("");
  const [formRationale, setFormRationale] = React.useState("");
  const [expandedAuditId, setExpandedAuditId] = React.useState<string | null>(null);

  const [plan, setPlan] = React.useState<TransformationPlan | null>(null);
  const [executionResult, setExecutionResult] = React.useState<ExecutionResult | null>(null);
  const [validationResult, setValidationResult] = React.useState<TargetValidationResult | null>(null);
  const [testSuite, setTestSuite] = React.useState<EquivalenceTestSuiteResult | null>(null);
  const [adapterCode, setAdapterCode] = React.useState<string | null>(null);
  const [reportData, setReportData] = React.useState<CompatibilityReportData | null>(null);
  const [reportMarkdown, setReportMarkdown] = React.useState<string | null>(null);

  // Phase 5: Test runner & adapter states
  const [selectedFixtureIdx, setSelectedFixtureIdx] = React.useState<number>(0);
  const [customPayloadText, setCustomPayloadText] = React.useState<string>(
    JSON.stringify(CANONICAL_TEST_FIXTURES[0].payload, null, 2)
  );
  const [showStepInspector, setShowStepInspector] = React.useState(false);

  // Feedback states
  const [loading, setLoading] = React.useState(true);
  const [errorMsg, setErrorMsg] = React.useState<string | null>(null);
  const [successMsg, setSuccessMsg] = React.useState<string | null>(null);

  React.useEffect(() => {
    async function loadProject() {
      if (!projectId) return;
      try {
        const res = await fetch(`/api/projects/${projectId}`);
        const data = await res.json();
        if (data.state) {
          setProject(data.state.project);
          setDiff(data.state.diff || null);
          setMappings(data.state.mappings || []);
          setPlan(data.state.plan || null);
          setAdapterCode(data.state.adapter?.code || null);
          setTestSuite(data.state.testSuiteResult || null);
          if (data.state.report) {
            setReportData(data.state.report.data);
            setReportMarkdown(data.state.report.markdown);
          }
          if (data.state.specs?.source?.spec?.raw_content) {
            setSourceText(data.state.specs.source.spec.raw_content);
          }
          if (data.state.specs?.target?.spec?.raw_content) {
            setTargetText(data.state.specs.target.spec.raw_content);
          }
          if (data.state.specs?.source?.normalized) {
            setSourceNormalized(data.state.specs.source.normalized);
            setSourceAvailableSchemas(data.state.specs.source.normalized.availableSchemas || []);
            if (data.state.specs.source.normalized.selectedSchema) {
              setSelectedSourceSchema(data.state.specs.source.normalized.selectedSchema);
            }
          }
          if (data.state.specs?.target?.normalized) {
            setTargetNormalized(data.state.specs.target.normalized);
            setTargetAvailableSchemas(data.state.specs.target.normalized.availableSchemas || []);
            if (data.state.specs.target.normalized.selectedSchema) {
              setSelectedTargetSchema(data.state.specs.target.normalized.selectedSchema);
            }
          }
        }

        // Fetch AI provider config status safely (never reveals API key)
        const healthRes = await fetch(`/api/projects/${projectId}/mappings/propose`);
        if (healthRes.ok) {
          const healthData = await healthRes.json();
          setProviderConfig(healthData);
        }
      } catch (err: unknown) {
        setErrorMsg(err instanceof Error ? err.message : String(err));
      } finally {
        setLoading(false);
      }
    }
    loadProject();
  }, [projectId]);

  function loadCanonicalFixtures() {
    setSourceText(CANONICAL_SOURCE_SPEC);
    setTargetText(CANONICAL_TARGET_SPEC);
    setSuccessMsg("Loaded canonical e-commerce Billing -> Invoice contracts.");
  }

  function loadSampleJsonFixture() {
    const sample = {
      orderId: "ord_99812",
      customer: {
        id: "cust_123",
        email: "alice@example.com",
        isActive: true,
      },
      items: [
        {
          sku: "SKU-99",
          unitPrice: 29.99,
          quantity: 2,
        },
      ],
      status: "pending",
      notes: null,
    };
    setSourceText(JSON.stringify(sample, null, 2));
    setSuccessMsg("Loaded sample JSON into Source. Parser will infer schema structure.");
  }

  async function triggerImport(force = false, srcSchema?: string, tgtSchema?: string) {
    if (!projectId) return;
    if (!sourceText.trim() || !targetText.trim()) {
      setErrorMsg("Please provide both source and target contract JSON.");
      return;
    }

    // Check if replacing existing specs when downstream work exists
    const hasDownstream = mappings.length > 0 || Boolean(plan) || Boolean(adapterCode);
    if (hasDownstream && !force) {
      setShowReplaceConfirm(true);
      return;
    }

    setLoading(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      // 1. Upload source spec
      const srcRes = await fetch(`/api/projects/${projectId}/specs`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          side: "source",
          name: "source-billing-api.json",
          rawContent: sourceText,
          selectedSchema: srcSchema !== undefined ? srcSchema : (selectedSourceSchema || undefined),
        }),
      });
      const srcData = await srcRes.json();
      if (!srcRes.ok) throw new Error(srcData.error || "Failed to import source spec.");

      setSourceNormalized(srcData.normalized);
      setSourceAvailableSchemas(srcData.availableSchemas || []);
      if (srcData.selectedSchema) setSelectedSourceSchema(srcData.selectedSchema);

      // 2. Upload target spec
      const tgtRes = await fetch(`/api/projects/${projectId}/specs`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          side: "target",
          name: "target-invoice-api.json",
          rawContent: targetText,
          selectedSchema: tgtSchema !== undefined ? tgtSchema : (selectedTargetSchema || undefined),
        }),
      });
      const tgtData = await tgtRes.json();
      if (!tgtRes.ok) throw new Error(tgtData.error || "Failed to import target spec.");

      setTargetNormalized(tgtData.normalized);
      setTargetAvailableSchemas(tgtData.availableSchemas || []);
      if (tgtData.selectedSchema) setSelectedTargetSchema(tgtData.selectedSchema);

      setDiff(tgtData.diff);
      setMappings(tgtData.mappings || []);
      setSelectedDiffItem(null);

      if (srcData.replaced || tgtData.replaced || srcData.invalidatedDownstream || tgtData.invalidatedDownstream) {
        setPlan(null);
        setExecutionResult(null);
        setValidationResult(null);
        setAdapterCode(null);
        setTestSuite(null);
        setReportData(null);
        setReportMarkdown(null);
        setSuccessMsg(
          "Specifications replaced. Downstream plans and adapters were safely invalidated; existing mappings reset to 'needs_confirmation' for re-review."
        );
      } else {
        setSuccessMsg("Specifications imported successfully. Structural difference calculated.");
      }
      setActiveTab("specs");
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
      setShowReplaceConfirm(false);
    }
  }

  async function updateMappingStatus(mappingId: string, status: "accepted" | "rejected") {
    if (!projectId) return;
    try {
      const res = await fetch(`/api/projects/${projectId}/mappings`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mappingId, status }),
      });
      const data = await res.json();
      if (data.mapping) {
        setMappings((prev) =>
          prev.map((m) => (m.id === mappingId ? data.mapping : m))
        );
      }
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : String(err));
    }
  }

  async function acceptAllMappings() {
    if (!projectId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/mappings`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ acceptAll: true }),
      });
      const data = await res.json();
      if (data.mappings) {
        setMappings(data.mappings);
        setSuccessMsg("Approved all candidate mappings.");
      }
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  async function generateProposals(fallbackToDeterministic = false) {
    if (!projectId) return;
    setProposeLoading(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const res = await fetch(`/api/projects/${projectId}/mappings/propose`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fallbackToDeterministic,
          allowFallbackOnFailure: true,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to generate mapping proposals.");
      }

      setMappings(data.mappings || []);
      if (data.provider === "groq") {
        setSuccessMsg(
          `Generated ${data.count} mapping proposals via Groq (${data.model}). Human review required before plan compilation.`
        );
      } else {
        setSuccessMsg(
          data.notice || `Generated ${data.count} deterministic heuristic baseline proposals.`
        );
      }
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : String(err));
    } finally {
      setProposeLoading(false);
    }
  }

  async function submitManualMapping(e: React.FormEvent) {
    e.preventDefault();
    if (!projectId || !formTargetPath) return;
    setLoading(true);
    setErrorMsg(null);

    try {
      let parsedLookup = undefined;
      if (formOperation === "lookup" && formLookupTable.trim()) {
        try {
          parsedLookup = JSON.parse(formLookupTable);
        } catch {
          throw new Error("Invalid JSON in lookup dictionary. Must be key-value pairs (e.g. {\"A\": \"B\"}).");
        }
      }

      let parsedDefault = undefined;
      if (formOperation === "default" && formDefaultValue !== "") {
        try {
          parsedDefault = JSON.parse(formDefaultValue);
        } catch {
          parsedDefault = formDefaultValue;
        }
      }

      const res = await fetch(`/api/projects/${projectId}/mappings`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          targetPath: formTargetPath,
          sourcePath: formSourcePath.trim() ? formSourcePath : null,
          operation: formOperation,
          conversionType: formOperation === "typeConversion" ? formConversionType : undefined,
          defaultValue: parsedDefault,
          lookupTable: parsedLookup,
          rationale: formRationale.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save manual mapping.");

      setMappings((prev) => {
        const idx = prev.findIndex((m) => m.targetPath === data.mapping.targetPath);
        if (idx !== -1) {
          const next = [...prev];
          next[idx] = data.mapping;
          return next;
        }
        return [...prev, data.mapping];
      });

      setIsManualModalOpen(false);
      setSuccessMsg(`Manual mapping for '${formTargetPath}' created and approved.`);
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  async function submitEditMapping(e: React.FormEvent) {
    e.preventDefault();
    if (!projectId || !activeMappingForEdit) return;
    setLoading(true);
    setErrorMsg(null);

    try {
      let parsedLookup = undefined;
      if (formOperation === "lookup" && formLookupTable.trim()) {
        try {
          parsedLookup = JSON.parse(formLookupTable);
        } catch {
          throw new Error("Invalid JSON in lookup dictionary.");
        }
      }

      let parsedDefault = undefined;
      if (formOperation === "default" && formDefaultValue !== "") {
        try {
          parsedDefault = JSON.parse(formDefaultValue);
        } catch {
          parsedDefault = formDefaultValue;
        }
      }

      const res = await fetch(`/api/projects/${projectId}/mappings`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mappingId: activeMappingForEdit.id,
          sourcePath: formSourcePath.trim() ? formSourcePath : null,
          transformation: {
            operation: formOperation,
            sourceType: activeMappingForEdit.transformation.sourceType,
            targetType: activeMappingForEdit.transformation.targetType,
            conversionType: formOperation === "typeConversion" ? formConversionType : undefined,
            defaultValue: parsedDefault,
            lookupTable: parsedLookup,
            policyOnMissing: activeMappingForEdit.transformation.policyOnMissing || "omit",
          },
          note: `Manual edit by human engineer: ${formOperation}`,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to update mapping.");

      setMappings((prev) =>
        prev.map((m) => (m.id === data.mapping.id ? data.mapping : m))
      );
      setActiveMappingForEdit(null);
      setSuccessMsg(`Mapping for '${data.mapping.targetPath}' updated.`);
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  function openEditModal(m: CandidateMapping) {
    setActiveMappingForEdit(m);
    setFormTargetPath(m.targetPath);
    setFormSourcePath(m.sourcePath || "");
    setFormOperation(m.transformation.operation as AllowedOperation);
    setFormConversionType(m.transformation.conversionType || "string-to-integer");
    setFormDefaultValue(
      m.transformation.defaultValue !== undefined
        ? JSON.stringify(m.transformation.defaultValue)
        : ""
    );
    setFormLookupTable(
      m.transformation.lookupTable
        ? JSON.stringify(m.transformation.lookupTable, null, 2)
        : ""
    );
    setFormRationale(m.rationale || "");
  }

  function openManualModal() {
    setIsManualModalOpen(true);
    const targetFields = targetNormalized ? Object.keys(targetNormalized.flatFields).filter((p) => p !== "$") : [];
    const sourceFields = sourceNormalized ? Object.keys(sourceNormalized.flatFields).filter((p) => p !== "$") : [];
    setFormTargetPath(targetFields[0] || "");
    setFormSourcePath(sourceFields[0] || "");
    setFormOperation("copy");
    setFormConversionType("string-to-integer");
    setFormDefaultValue("");
    setFormLookupTable("");
    setFormRationale("");
  }

  async function compilePlan() {
    if (!projectId) return;
    setLoading(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const res = await fetch(`/api/projects/${projectId}/compile`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) {
        const errorList = data.errors ? data.errors.join(" | ") : data.error;
        throw new Error(errorList || "Compilation failed.");
      }
      setPlan(data.plan);
      setActiveTab("execute");
      setSuccessMsg(`Compiled transformation plan '${data.plan.planId}' with ${data.plan.steps.length} approved steps.`);
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  async function executePlan(customPayload?: unknown) {
    if (!projectId || !plan) return;
    setLoading(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      let payloadToSend: unknown;
      if (customPayload !== undefined) {
        payloadToSend = customPayload;
      } else if (selectedFixtureIdx >= 0 && selectedFixtureIdx < CANONICAL_TEST_FIXTURES.length) {
        payloadToSend = CANONICAL_TEST_FIXTURES[selectedFixtureIdx].payload;
      } else {
        try {
          payloadToSend = JSON.parse(customPayloadText);
        } catch {
          throw new Error("Invalid JSON in custom test payload.");
        }
      }

      const res = await fetch(`/api/projects/${projectId}/execute`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ payload: payloadToSend }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Execution failed.");

      setExecutionResult(data.execution);
      setValidationResult(data.validation);
      setTestSuite(data.testSuite);
      setAdapterCode(data.adapterCode);
      if (data.execution?.success) {
        setSuccessMsg("Transformation executed in trusted interpreter. Target contract validated.");
      } else {
        setErrorMsg(data.execution?.error || "Transformation execution failed in interpreter.");
      }
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  function downloadAdapterCode() {
    if (!adapterCode || !plan) return;
    const blob = new Blob([adapterCode], { type: "text/typescript" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `uniflow-adapter-${plan.planId}.ts`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function generateReport() {
    if (!projectId) return;
    setLoading(true);
    setErrorMsg(null);

    try {
      const res = await fetch(`/api/projects/${projectId}/report`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Report generation failed.");

      setReportData(data.reportData);
      setReportMarkdown(data.markdown);
      setActiveTab("report");
      setSuccessMsg("Compatibility report assembled.");
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  function downloadReport(format: "md" | "json") {
    if (!reportData || !reportMarkdown) return;
    const content = format === "json" ? JSON.stringify(reportData, null, 2) : reportMarkdown;
    const blob = new Blob([content], { type: format === "json" ? "application/json" : "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `compatibility-report-${reportData.reportId}.${format}`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const filteredDiffItems = React.useMemo(() => {
    if (!diff) return [];
    return diff.items.filter((item) => {
      if (diffSeverityFilter !== "all" && item.severity !== diffSeverityFilter) {
        return false;
      }
      if (diffCategoryFilter !== "all" && item.category !== diffCategoryFilter) {
        return false;
      }
      if (diffSearchQuery.trim()) {
        const q = diffSearchQuery.toLowerCase();
        const matchesTarget = item.targetPath.toLowerCase().includes(q);
        const matchesSource = item.sourcePath ? item.sourcePath.toLowerCase().includes(q) : false;
        const matchesMessage = item.message.toLowerCase().includes(q);
        const matchesCat = item.category.toLowerCase().includes(q);
        return matchesTarget || matchesSource || matchesMessage || matchesCat;
      }
      return true;
    });
  }, [diff, diffSeverityFilter, diffCategoryFilter, diffSearchQuery]);

  const filteredMappings = React.useMemo(() => {
    return mappings.filter((m) => {
      if (mappingFilterStatus !== "all" && m.status !== mappingFilterStatus) {
        return false;
      }
      if (mappingFilterUncertainty !== "all" && m.uncertaintyScore !== mappingFilterUncertainty) {
        return false;
      }
      if (mappingSearchQuery.trim()) {
        const q = mappingSearchQuery.toLowerCase();
        const matchesTarget = m.targetPath.toLowerCase().includes(q);
        const matchesSource = m.sourcePath ? m.sourcePath.toLowerCase().includes(q) : false;
        const matchesRationale = m.rationale.toLowerCase().includes(q);
        const matchesOp = m.transformation.operation.toLowerCase().includes(q);
        return matchesTarget || matchesSource || matchesRationale || matchesOp;
      }
      return true;
    });
  }, [mappings, mappingFilterStatus, mappingFilterUncertainty, mappingSearchQuery]);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col font-sans">
      <TopBar />

      {/* Project Subheader */}
      <div className="bg-white border-b border-slate-200 px-4 sm:px-6 lg:px-8 py-3">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-3">
          <div>
            <Breadcrumb
              items={[
                { label: "Home", href: "/" },
                { label: "Projects", href: "/projects" },
                { label: project?.name || projectId, current: true },
              ]}
              className="mb-1"
            />
            <div className="flex items-center space-x-2">
              <h1 className="text-base font-bold text-slate-900 tracking-tight">
                {project?.name || "Workspace"}
              </h1>
              <span className="font-mono text-[11px] text-slate-400">({projectId})</span>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <button
              type="button"
              onClick={loadCanonicalFixtures}
              className="text-xs bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 px-2.5 py-1 rounded font-medium transition"
            >
              Load Canonical Pair
            </button>
            <button
              type="button"
              onClick={loadSampleJsonFixture}
              className="text-xs bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-300 px-2.5 py-1 rounded font-medium transition"
              title="Demonstrate schema inference from arbitrary sample JSON payload"
            >
              Load Sample JSON
            </button>
            <button
              type="button"
              onClick={() => triggerImport(false)}
              disabled={loading}
              className="text-xs bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white px-3 py-1 rounded font-medium transition shadow-xs"
            >
              Parse & Compare
            </button>
          </div>
        </div>
      </div>

      {/* Messages */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full mt-3">
        {errorMsg && <ErrorPanel message={errorMsg} onDismiss={() => setErrorMsg(null)} className="mb-2" />}
        {successMsg && (
          <div className="p-3 mb-2 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded flex items-center justify-between">
            <span>{successMsg}</span>
            <button type="button" onClick={() => setSuccessMsg(null)} className="text-emerald-700 font-bold ml-2">
              ×
            </button>
          </div>
        )}
      </div>

      {/* Workspace Body with Sidebar */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 w-full flex-1 flex flex-col md:flex-row gap-5">
        <ProjectSidebar
          activeTab={activeTab}
          onTabChange={setActiveTab}
          specCount={sourceText && targetText ? 2 : sourceText || targetText ? 1 : 0}
          mappingCount={mappings.length}
          hasPlan={Boolean(plan)}
        />

        <div className="flex-1 min-w-0">
          {/* TAB: OVERVIEW */}
          {activeTab === "overview" && (
            <div className="space-y-4">
              <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-xs">
                <h2 className="text-sm font-semibold text-slate-900 mb-1">Project Summary</h2>
                <p className="text-xs text-slate-600 leading-relaxed mb-4">
                  {project?.description || "This workspace manages the comparison, mapping review, and adapter compilation between source and target API contracts."}
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 border-t border-slate-100 pt-4 text-xs">
                  <div>
                    <span className="text-slate-500 block text-[11px]">Owner Tenant:</span>
                    <span className="font-mono text-slate-800">developer@uniflow.internal</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block text-[11px]">Created At:</span>
                    <span className="text-slate-800">
                      {project?.created_at ? new Date(project.created_at).toLocaleDateString() : "Just now"}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500 block text-[11px]">Core Engine:</span>
                    <StatusChip label="Deterministic IR Ready" variant="low" />
                  </div>
                </div>
              </div>

              {/* Workflow Stepper Card */}
              <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-xs">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-3">
                  Compiler Pipeline Stages
                </h3>

                <div className="space-y-2.5 text-xs">
                  <div className="flex items-center justify-between p-2 rounded bg-slate-50 border border-slate-200">
                    <span className="font-medium text-slate-800">1. Ingest Contracts & Schema Trees</span>
                    {sourceText && targetText ? (
                      <StatusChip label="Contracts Loaded" variant="accepted" />
                    ) : (
                      <button
                        type="button"
                        onClick={() => setActiveTab("specs")}
                        className="text-[11px] underline text-slate-700 hover:text-slate-900"
                      >
                        Import Specs →
                      </button>
                    )}
                  </div>

                  <div className="flex items-center justify-between p-2 rounded bg-slate-50 border border-slate-200">
                    <span className="font-medium text-slate-800">2. Deterministic Structural Diff</span>
                    {diff ? (
                      <StatusChip label={`${diff.summary.totalTargetFields} fields diffed`} variant="info" />
                    ) : (
                      <span className="text-[11px] text-slate-400">Pending import</span>
                    )}
                  </div>

                  <div className="flex items-center justify-between p-2 rounded bg-slate-50 border border-slate-200">
                    <span className="font-medium text-slate-800">3. Human Review Gate</span>
                    {mappings.length > 0 ? (
                      <button
                        type="button"
                        onClick={() => setActiveTab("mappings")}
                        className="text-[11px] underline text-slate-700 hover:text-slate-900"
                      >
                        Review {mappings.length} mappings →
                      </button>
                    ) : (
                      <span className="text-[11px] text-slate-400">Pending diff</span>
                    )}
                  </div>

                  <div className="flex items-center justify-between p-2 rounded bg-slate-50 border border-slate-200">
                    <span className="font-medium text-slate-800">4. Compile Plan & Execute Test Fixtures</span>
                    {plan ? (
                      <StatusChip label="Plan Compiled" variant="compiled" />
                    ) : (
                      <span className="text-[11px] text-slate-400">Requires approved mappings</span>
                    )}
                  </div>

                  <div className="flex items-center justify-between p-2 rounded bg-slate-50 border border-slate-200">
                    <span className="font-medium text-slate-800">5. Generated Adapter & Compatibility Report</span>
                    {adapterCode ? (
                      <StatusChip label="Adapter Ready" variant="executed" />
                    ) : (
                      <span className="text-[11px] text-slate-400">Pending execution</span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB: SPECS & DIFF */}
          {activeTab === "specs" && (
            <div className="space-y-5">
              {/* Top Summary Banner */}
              <div className="bg-white border border-slate-200 rounded-lg p-4 shadow-xs flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-sm font-semibold text-slate-900">Contract Specifications & Schema Trees</h2>
                  <p className="text-xs text-slate-500">
                    Import OpenAPI 3.x or JSON Schema specifications. Schemas are normalized with strict cycle guards and deterministic path indexing.
                  </p>
                </div>
                <div className="flex items-center space-x-2">
                  <button
                    type="button"
                    onClick={() => triggerImport(false)}
                    disabled={loading}
                    className="text-xs bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white px-3 py-1.5 rounded font-medium transition shadow-xs"
                  >
                    {loading ? "Parsing..." : "Parse & Compare Contracts"}
                  </button>
                </div>
              </div>

              {/* Source & Target Panes */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                {/* SOURCE SPEC PANE */}
                <div className="bg-white border border-slate-200 rounded-lg p-4 shadow-xs flex flex-col space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <span className="text-xs font-bold text-slate-800 uppercase tracking-wider">Source Contract</span>
                      {sourceNormalized?.metadata.isInferred ? (
                        <span className="text-[10px] font-mono bg-amber-100 text-amber-800 border border-amber-300 px-1.5 py-0.5 rounded font-medium">
                          Inferred Sample JSON
                        </span>
                      ) : (
                        <span className="text-[10px] font-mono text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">
                          {sourceNormalized?.metadata.format || "JSON / JSON Schema"}
                        </span>
                      )}
                    </div>
                    {sourceNormalized?.metadata.schemaHash && (
                      <span className="text-[10px] font-mono text-slate-400" title={`SHA-256: ${sourceNormalized.metadata.schemaHash}`}>
                        hash:{sourceNormalized.metadata.schemaHash.slice(0, 8)}...
                      </span>
                    )}
                  </div>

                  <FileDropzone
                    label="Drop Source Spec JSON or click to browse"
                    onFileLoaded={(content) => setSourceText(content)}
                  />

                  <textarea
                    rows={8}
                    value={sourceText}
                    onChange={(e) => setSourceText(e.target.value)}
                    placeholder="Paste Source JSON Schema or OpenAPI 3.x JSON..."
                    className="font-mono text-xs w-full p-2.5 border border-slate-300 rounded bg-slate-50 text-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-500 resize-none"
                  />

                  {/* OpenAPI Schema Picker if multiple candidate schemas exist */}
                  {sourceAvailableSchemas.length > 1 && (
                    <div className="p-2.5 bg-indigo-50/60 border border-indigo-200 rounded text-xs space-y-1.5">
                      <div className="flex items-center justify-between">
                        <label htmlFor="source-schema-select" className="font-semibold text-indigo-900 text-[11px]">
                          OpenAPI Root Schema Candidate:
                        </label>
                        <span className="text-[10px] text-indigo-700 font-mono">
                          {sourceAvailableSchemas.length} components.schemas
                        </span>
                      </div>
                      <select
                        id="source-schema-select"
                        value={selectedSourceSchema}
                        onChange={(e) => {
                          setSelectedSourceSchema(e.target.value);
                          triggerImport(true, e.target.value, selectedTargetSchema);
                        }}
                        className="w-full text-xs font-mono p-1.5 border border-indigo-300 rounded bg-white text-indigo-950 focus:ring-1 focus:ring-indigo-500 focus:outline-none"
                      >
                        {sourceAvailableSchemas.map((name) => (
                          <option key={name} value={name}>
                            {name}
                          </option>
                        ))}
                      </select>
                      <p className="text-[10px] text-indigo-700 leading-tight">
                        Select which schema from components.schemas to treat as the active root contract for comparison.
                      </p>
                    </div>
                  )}

                  {/* Normalized Schema Tree */}
                  <SchemaTree schema={sourceNormalized} side="source" />
                </div>

                {/* TARGET SPEC PANE */}
                <div className="bg-white border border-slate-200 rounded-lg p-4 shadow-xs flex flex-col space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <span className="text-xs font-bold text-slate-800 uppercase tracking-wider">Target Contract</span>
                      {targetNormalized?.metadata.isInferred ? (
                        <span className="text-[10px] font-mono bg-amber-100 text-amber-800 border border-amber-300 px-1.5 py-0.5 rounded font-medium">
                          Inferred Sample JSON
                        </span>
                      ) : (
                        <span className="text-[10px] font-mono text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">
                          {targetNormalized?.metadata.format || "JSON / JSON Schema"}
                        </span>
                      )}
                    </div>
                    {targetNormalized?.metadata.schemaHash && (
                      <span className="text-[10px] font-mono text-slate-400" title={`SHA-256: ${targetNormalized.metadata.schemaHash}`}>
                        hash:{targetNormalized.metadata.schemaHash.slice(0, 8)}...
                      </span>
                    )}
                  </div>

                  <FileDropzone
                    label="Drop Target Spec JSON or click to browse"
                    onFileLoaded={(content) => setTargetText(content)}
                  />

                  <textarea
                    rows={8}
                    value={targetText}
                    onChange={(e) => setTargetText(e.target.value)}
                    placeholder="Paste Target JSON Schema or OpenAPI 3.x JSON..."
                    className="font-mono text-xs w-full p-2.5 border border-slate-300 rounded bg-slate-50 text-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-500 resize-none"
                  />

                  {/* OpenAPI Schema Picker if multiple candidate schemas exist */}
                  {targetAvailableSchemas.length > 1 && (
                    <div className="p-2.5 bg-indigo-50/60 border border-indigo-200 rounded text-xs space-y-1.5">
                      <div className="flex items-center justify-between">
                        <label htmlFor="target-schema-select" className="font-semibold text-indigo-900 text-[11px]">
                          OpenAPI Root Schema Candidate:
                        </label>
                        <span className="text-[10px] text-indigo-700 font-mono">
                          {targetAvailableSchemas.length} components.schemas
                        </span>
                      </div>
                      <select
                        id="target-schema-select"
                        value={selectedTargetSchema}
                        onChange={(e) => {
                          setSelectedTargetSchema(e.target.value);
                          triggerImport(true, selectedSourceSchema, e.target.value);
                        }}
                        className="w-full text-xs font-mono p-1.5 border border-indigo-300 rounded bg-white text-indigo-950 focus:ring-1 focus:ring-indigo-500 focus:outline-none"
                      >
                        {targetAvailableSchemas.map((name) => (
                          <option key={name} value={name}>
                            {name}
                          </option>
                        ))}
                      </select>
                      <p className="text-[10px] text-indigo-700 leading-tight">
                        Select which schema from components.schemas to treat as the active root contract for comparison.
                      </p>
                    </div>
                  )}

                  {/* Normalized Schema Tree */}
                  <SchemaTree schema={targetNormalized} side="target" />
                </div>
              </div>

              {/* STRUCTURAL DIFF SECTION */}
              {diff && (
                <div className="bg-white border border-slate-200 rounded-lg shadow-xs overflow-hidden space-y-0">
                  {/* Diff Header */}
                  <div className="px-4 py-3 border-b border-slate-200 bg-slate-50 flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                        Computed Structural Differences ({diff.summary.totalTargetFields} target fields)
                      </h3>
                      <div className="flex flex-wrap items-center gap-1.5 mt-1 text-[10px]">
                        <span className="px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 font-medium">
                          {diff.summary.exactMatches} exact
                        </span>
                        <span className="px-1.5 py-0.5 rounded bg-blue-100 text-blue-800 font-medium">
                          {diff.summary.renamedCandidates} renamed
                        </span>
                        <span className="px-1.5 py-0.5 rounded bg-rose-100 text-rose-800 font-medium">
                          {diff.summary.missingRequired} missing required
                        </span>
                        <span className="px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 font-medium">
                          {diff.summary.typeConflicts} type conflict
                        </span>
                        <span className="px-1.5 py-0.5 rounded bg-purple-100 text-purple-800 font-medium">
                          {diff.summary.shapeMismatches} shape mismatch
                        </span>
                        {diff.summary.unsupportedWarnings > 0 && (
                          <span className="px-1.5 py-0.5 rounded bg-amber-100 text-amber-900 border border-amber-300 font-medium">
                            {diff.summary.unsupportedWarnings} keyword warnings
                          </span>
                        )}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setActiveTab("mappings")}
                      className="text-xs bg-slate-900 hover:bg-slate-800 text-white px-3 py-1.5 rounded font-medium transition shadow-xs"
                    >
                      Proceed to Review ({mappings.length} mappings) →
                    </button>
                  </div>

                  {/* Filter & Search Bar */}
                  <div className="p-3 bg-slate-50/70 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2 text-xs">
                    <div className="flex flex-wrap items-center gap-2 flex-1 min-w-[240px]">
                      <input
                        type="text"
                        value={diffSearchQuery}
                        onChange={(e) => setDiffSearchQuery(e.target.value)}
                        placeholder="Search paths or diagnostics..."
                        className="p-1.5 text-xs border border-slate-300 rounded bg-white text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-slate-500 w-full sm:w-64"
                      />

                      {/* Severity Filter Pills */}
                      <div className="flex items-center space-x-1">
                        <button
                          type="button"
                          onClick={() => setDiffSeverityFilter("all")}
                          className={`px-2 py-1 rounded text-[11px] font-medium border transition ${
                            diffSeverityFilter === "all"
                              ? "bg-slate-800 text-white border-slate-900"
                              : "bg-white text-slate-600 border-slate-200 hover:bg-slate-100"
                          }`}
                        >
                          All ({diff.items.length})
                        </button>
                        <button
                          type="button"
                          onClick={() => setDiffSeverityFilter("error")}
                          className={`px-2 py-1 rounded text-[11px] font-medium border transition ${
                            diffSeverityFilter === "error"
                              ? "bg-rose-600 text-white border-rose-700"
                              : "bg-white text-rose-700 border-rose-200 hover:bg-rose-50"
                          }`}
                        >
                          Errors ({diff.items.filter((i) => i.severity === "error").length})
                        </button>
                        <button
                          type="button"
                          onClick={() => setDiffSeverityFilter("warning")}
                          className={`px-2 py-1 rounded text-[11px] font-medium border transition ${
                            diffSeverityFilter === "warning"
                              ? "bg-amber-600 text-white border-amber-700"
                              : "bg-white text-amber-700 border-amber-200 hover:bg-amber-50"
                          }`}
                        >
                          Warnings ({diff.items.filter((i) => i.severity === "warning").length})
                        </button>
                        <button
                          type="button"
                          onClick={() => setDiffSeverityFilter("info")}
                          className={`px-2 py-1 rounded text-[11px] font-medium border transition ${
                            diffSeverityFilter === "info"
                              ? "bg-sky-600 text-white border-sky-700"
                              : "bg-white text-sky-700 border-sky-200 hover:bg-sky-50"
                          }`}
                        >
                          Info ({diff.items.filter((i) => i.severity === "info").length})
                        </button>
                      </div>
                    </div>

                    {/* Category Filter Dropdown */}
                    <div className="flex items-center space-x-2">
                      <label htmlFor="diff-cat-select" className="text-[11px] font-medium text-slate-600">
                        Category:
                      </label>
                      <select
                        id="diff-cat-select"
                        value={diffCategoryFilter}
                        onChange={(e) => setDiffCategoryFilter(e.target.value)}
                        className="text-xs p-1.5 border border-slate-300 rounded bg-white text-slate-800 focus:outline-none focus:ring-1 focus:ring-slate-500"
                      >
                        <option value="all">All Categories</option>
                        <option value="exact_match">Exact Match</option>
                        <option value="renamed">Renamed Candidate</option>
                        <option value="type_conflict">Type Conflict</option>
                        <option value="missing_required">Missing Required</option>
                        <option value="optional_to_required">Optional to Required</option>
                        <option value="nullability_conflict">Nullability Conflict</option>
                        <option value="enum_mismatch">Enum Mismatch</option>
                        <option value="shape_mismatch">Shape Mismatch</option>
                        <option value="unsupported_keyword">Unsupported Keyword</option>
                      </select>
                      {(diffSearchQuery || diffSeverityFilter !== "all" || diffCategoryFilter !== "all") && (
                        <button
                          type="button"
                          onClick={() => {
                            setDiffSearchQuery("");
                            setDiffSeverityFilter("all");
                            setDiffCategoryFilter("all");
                          }}
                          className="text-[11px] text-slate-500 hover:text-slate-800 underline"
                        >
                          Reset
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Diff Items Table */}
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-100 text-slate-600 font-semibold border-b border-slate-200 uppercase tracking-wider text-[11px]">
                        <tr>
                          <th className="py-2.5 px-3">Target Path</th>
                          <th className="py-2.5 px-3">Source Match</th>
                          <th className="py-2.5 px-3">Category</th>
                          <th className="py-2.5 px-3">Severity</th>
                          <th className="py-2.5 px-3">Diagnostic Description</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {filteredDiffItems.length === 0 ? (
                          <tr>
                            <td colSpan={5} className="py-6 text-center text-xs text-slate-400 italic">
                              No diff items match the current search or filters.
                            </td>
                          </tr>
                        ) : (
                          filteredDiffItems.map((item) => {
                            const isSelected = selectedDiffItem?.id === item.id;
                            return (
                              <tr
                                key={item.id}
                                onClick={() => setSelectedDiffItem(isSelected ? null : item)}
                                className={`cursor-pointer transition-colors ${
                                  isSelected
                                    ? "bg-slate-100/90 ring-1 ring-inset ring-slate-400"
                                    : "hover:bg-slate-50"
                                }`}
                              >
                                <td className="py-2 px-3 font-mono font-medium text-slate-800">
                                  {item.targetPath}
                                  {item.targetRequired && <span className="text-rose-500 ml-1 font-bold">*</span>}
                                </td>
                                <td className="py-2 px-3 font-mono text-slate-600">{item.sourcePath || "(none)"}</td>
                                <td className="py-2 px-3">
                                  <StatusChip label={item.category} variant="neutral" />
                                </td>
                                <td className="py-2 px-3">
                                  <StatusChip
                                    label={item.severity}
                                    variant={item.severity === "error" ? "error" : item.severity === "warning" ? "warning" : "info"}
                                  />
                                </td>
                                <td className="py-2 px-3 text-slate-600">{item.message}</td>
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  </div>

                  {/* Selected Diff Item Inspector Card */}
                  {selectedDiffItem && (
                    <div className="p-4 bg-slate-50 border-t border-slate-200 space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-2">
                          <span className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                            Diff Detail Inspector
                          </span>
                          <StatusChip label={selectedDiffItem.category} variant="neutral" />
                          <StatusChip
                            label={selectedDiffItem.severity}
                            variant={
                              selectedDiffItem.severity === "error"
                                ? "error"
                                : selectedDiffItem.severity === "warning"
                                ? "warning"
                                : "info"
                            }
                          />
                        </div>
                        <button
                          type="button"
                          onClick={() => setSelectedDiffItem(null)}
                          className="text-xs text-slate-500 hover:text-slate-800 font-bold"
                        >
                          Close ×
                        </button>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs bg-white p-3 rounded border border-slate-200">
                        <div>
                          <span className="font-semibold text-slate-700 block mb-0.5">Target Contract Field:</span>
                          <code className="font-mono text-slate-900 bg-slate-100 px-1.5 py-0.5 rounded text-[11px] block truncate">
                            {selectedDiffItem.targetPath}
                          </code>
                          <div className="mt-1 text-[11px] text-slate-600">
                            Type: <span className="font-mono font-semibold">{selectedDiffItem.targetType}</span>
                            {" • "}
                            Required: <span className="font-semibold">{selectedDiffItem.targetRequired ? "Yes" : "No"}</span>
                            {selectedDiffItem.facts?.targetNullable !== undefined && (
                              <span> • Nullable: {selectedDiffItem.facts.targetNullable ? "Yes" : "No"}</span>
                            )}
                            {selectedDiffItem.facts?.targetEnum && (
                              <span className="block text-indigo-700 mt-0.5">
                                Enum values: [{selectedDiffItem.facts.targetEnum.join(", ")}]
                              </span>
                            )}
                          </div>
                        </div>

                        <div>
                          <span className="font-semibold text-slate-700 block mb-0.5">Source Contract Field:</span>
                          <code className="font-mono text-slate-900 bg-slate-100 px-1.5 py-0.5 rounded text-[11px] block truncate">
                            {selectedDiffItem.sourcePath || "(no direct match)"}
                          </code>
                          <div className="mt-1 text-[11px] text-slate-600">
                            Type: <span className="font-mono font-semibold">{selectedDiffItem.sourceType || "N/A"}</span>
                            {selectedDiffItem.facts?.sourceNullable !== undefined && (
                              <span> • Nullable: {selectedDiffItem.facts.sourceNullable ? "Yes" : "No"}</span>
                            )}
                            {selectedDiffItem.facts?.sourceEnum && (
                              <span className="block text-indigo-700 mt-0.5">
                                Enum values: [{selectedDiffItem.facts.sourceEnum.join(", ")}]
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="text-xs text-slate-700 space-y-1 bg-white p-3 rounded border border-slate-200">
                        <div>
                          <span className="font-semibold text-slate-800">Diagnostic Explanation:</span>{" "}
                          {selectedDiffItem.message}
                        </div>
                        {selectedDiffItem.suggestedAction && (
                          <div className="pt-1 text-slate-600">
                            <span className="font-semibold text-slate-800">Recommended Action:</span>{" "}
                            {selectedDiffItem.suggestedAction}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* TAB: MAPPING REVIEW */}
          {activeTab === "mappings" && (
            <div className="space-y-4">
              {/* Header and Advisory Status */}
              <div className="bg-white border border-slate-200 rounded-lg p-4 shadow-xs flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="flex items-center space-x-2">
                    <h2 className="text-sm font-bold text-slate-900">Review Candidate Mappings</h2>
                    {providerConfig?.configured ? (
                      <span className="text-[10px] font-mono bg-emerald-50 text-emerald-800 border border-emerald-300 px-2 py-0.5 rounded font-medium">
                        Groq AI Active &bull; {providerConfig.model}
                      </span>
                    ) : (
                      <span className="text-[10px] font-mono bg-amber-50 text-amber-800 border border-amber-300 px-2 py-0.5 rounded font-medium">
                        Groq Offline (Heuristic Fallback)
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">
                    <span className="font-semibold text-slate-700">Trust Rule:</span> AI may propose; deterministic code validates; humans approve ambiguous semantics.
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => generateProposals(false)}
                    disabled={proposeLoading || !sourceText || !targetText}
                    className="text-xs bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white px-3 py-1.5 rounded font-medium transition shadow-xs flex items-center space-x-1"
                    title={providerConfig?.configured ? "Ask Groq AI to propose field mappings" : "Groq not configured; falls back cleanly to deterministic heuristic"}
                  >
                    <span>{proposeLoading ? "Querying Groq..." : "Propose with Groq AI"}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => generateProposals(true)}
                    disabled={proposeLoading || !sourceText || !targetText}
                    className="text-xs bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 px-2.5 py-1.5 rounded font-medium transition"
                    title="Generate candidate mappings using deterministic structural heuristics without calling AI"
                  >
                    Heuristic Baseline
                  </button>

                  <button
                    type="button"
                    onClick={openManualModal}
                    className="text-xs bg-white hover:bg-slate-50 text-slate-800 border border-slate-300 px-2.5 py-1.5 rounded font-medium transition"
                  >
                    + Manual Mapping
                  </button>

                  <button
                    type="button"
                    onClick={acceptAllMappings}
                    disabled={loading || mappings.length === 0}
                    className="text-xs bg-slate-100 hover:bg-slate-200 disabled:opacity-50 text-slate-700 border border-slate-300 px-3 py-1.5 rounded font-medium transition"
                  >
                    Approve All Verified
                  </button>

                  <button
                    type="button"
                    onClick={compilePlan}
                    disabled={loading || mappings.filter((m) => m.status === "accepted" || m.status === "edited").length === 0}
                    className="text-xs bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white px-3.5 py-1.5 rounded font-medium transition shadow-xs"
                  >
                    Compile Plan →
                  </button>
                </div>
              </div>

              {/* Filters & Search Toolbar */}
              {mappings.length > 0 && (
                <div className="p-3 bg-white border border-slate-200 rounded-lg shadow-xs flex flex-wrap items-center justify-between gap-2 text-xs">
                  <div className="flex flex-wrap items-center gap-2 flex-1 min-w-[240px]">
                    <input
                      type="text"
                      value={mappingSearchQuery}
                      onChange={(e) => setMappingSearchQuery(e.target.value)}
                      placeholder="Search mapped paths, rationale, or operation..."
                      className="p-1.5 text-xs border border-slate-300 rounded bg-white text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-slate-500 w-full sm:w-64"
                    />

                    {/* Status filter pills */}
                    <div className="flex flex-wrap items-center gap-1">
                      {["all", "proposed", "needs_confirmation", "accepted", "rejected", "edited"].map((st) => {
                        const count =
                          st === "all" ? mappings.length : mappings.filter((m) => m.status === st).length;
                        return (
                          <button
                            key={st}
                            type="button"
                            onClick={() => setMappingFilterStatus(st)}
                            className={`px-2 py-0.5 rounded text-[11px] font-medium border transition ${
                              mappingFilterStatus === st
                                ? "bg-slate-800 text-white border-slate-900"
                                : "bg-white text-slate-600 border-slate-200 hover:bg-slate-100"
                            }`}
                          >
                            {st === "needs_confirmation" ? "Needs Review" : st} ({count})
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Uncertainty filter */}
                  <div className="flex items-center space-x-2">
                    <label htmlFor="uncertainty-select" className="text-[11px] font-medium text-slate-600">
                      Uncertainty:
                    </label>
                    <select
                      id="uncertainty-select"
                      value={mappingFilterUncertainty}
                      onChange={(e) => setMappingFilterUncertainty(e.target.value)}
                      className="text-xs p-1.5 border border-slate-300 rounded bg-white text-slate-800 focus:outline-none focus:ring-1 focus:ring-slate-500"
                    >
                      <option value="all">All Levels</option>
                      <option value="LOW">Low</option>
                      <option value="MEDIUM">Medium</option>
                      <option value="HIGH">High</option>
                    </select>

                    {(mappingSearchQuery || mappingFilterStatus !== "all" || mappingFilterUncertainty !== "all") && (
                      <button
                        type="button"
                        onClick={() => {
                          setMappingSearchQuery("");
                          setMappingFilterStatus("all");
                          setMappingFilterUncertainty("all");
                        }}
                        className="text-[11px] text-slate-500 hover:text-slate-800 underline"
                      >
                        Reset
                      </button>
                    )}
                  </div>
                </div>
              )}

              {/* Mapping Cards List */}
              {mappings.length === 0 ? (
                <EmptyState
                  title="No candidate mappings generated yet"
                  description="Import contracts in the Specs & Diff tab, then click 'Propose with Groq AI' or 'Heuristic Baseline' to generate mapping proposals for human verification."
                  action={{
                    label: "Generate Heuristic Baseline",
                    onClick: () => generateProposals(true),
                  }}
                />
              ) : filteredMappings.length === 0 ? (
                <div className="bg-white border border-slate-200 rounded-lg p-8 text-center text-xs text-slate-400">
                  No candidate mappings match the current filters or search query.
                </div>
              ) : (
                <div className="space-y-3">
                  {filteredMappings.map((m) => {
                    const isAccepted = m.status === "accepted";
                    const isRejected = m.status === "rejected";
                    const isEdited = m.status === "edited";
                    const isNeedsReview = m.status === "needs_confirmation" || m.semanticStatus === "needs_confirmation";

                    return (
                      <div
                        key={m.id}
                        className={`bg-white border rounded-lg p-4 shadow-xs transition ${
                          isAccepted
                            ? "border-emerald-300 bg-emerald-50/15"
                            : isRejected
                            ? "border-rose-300 bg-rose-50/15 opacity-60"
                            : isEdited
                            ? "border-indigo-300 bg-indigo-50/15"
                            : isNeedsReview
                            ? "border-amber-300 bg-amber-50/15"
                            : "border-slate-300"
                        }`}
                      >
                        {/* Header: Paths & Status Badges */}
                        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-2 mb-2.5">
                          <div className="flex items-center space-x-2 font-mono text-xs">
                            <span className="font-bold text-slate-900 bg-slate-100 px-1.5 py-0.5 rounded">
                              {m.targetPath}
                            </span>
                            <span className="text-slate-400">&larr;</span>
                            <span className="text-slate-700 bg-slate-50 border border-slate-200 px-1.5 py-0.5 rounded">
                              {m.sourcePath || "(default value)"}
                            </span>
                          </div>

                          <div className="flex flex-wrap items-center gap-1.5">
                            {/* Provider chip */}
                            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 border border-slate-200">
                              {m.provider === "groq"
                                ? "Groq AI"
                                : m.provider === "manual"
                                ? "Manual"
                                : "Deterministic Heuristic"}
                            </span>

                            {/* Uncertainty Chip */}
                            <StatusChip
                              label={`Uncertainty: ${m.uncertaintyScore}`}
                              variant={m.uncertaintyScore === "LOW" ? "low" : m.uncertaintyScore === "MEDIUM" ? "medium" : "high"}
                            />

                            {/* Status Chip */}
                            <StatusChip label={m.status} variant={m.status} />
                          </div>
                        </div>

                        {/* Operation Details and Facts */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs text-slate-600">
                          <div>
                            <span className="font-semibold text-slate-700">Operation:</span>{" "}
                            <code className="font-mono bg-slate-100 px-1.5 py-0.5 rounded text-blue-800 font-medium">
                              {m.transformation.operation}
                            </code>
                            {m.transformation.conversionType && (
                              <span className="block mt-1 text-[11px] font-mono text-purple-700">
                                Convert: {m.transformation.conversionType}
                              </span>
                            )}
                            {m.transformation.defaultValue !== undefined && (
                              <span className="block mt-1 text-[11px] font-mono text-slate-600">
                                Default: {JSON.stringify(m.transformation.defaultValue)}
                              </span>
                            )}
                            {m.transformation.lookupTable && (
                              <span className="block mt-1 text-[11px] font-mono text-indigo-700">
                                Lookup: {Object.keys(m.transformation.lookupTable).length} dictionary pairs
                              </span>
                            )}
                          </div>

                          <div className="md:col-span-2">
                            <span className="font-semibold text-slate-700">Rationale:</span>{" "}
                            <span className="text-slate-800">{m.rationale}</span>
                          </div>
                        </div>

                        {/* Unresolved Questions if flagged by AI */}
                        {m.unresolvedQuestions && m.unresolvedQuestions.length > 0 && (
                          <div className="mt-2.5 p-2 bg-amber-50/80 border border-amber-200 rounded text-xs text-amber-900 space-y-1">
                            <div className="font-semibold text-[11px] uppercase tracking-wider text-amber-800">
                              Unresolved Semantic Questions:
                            </div>
                            {m.unresolvedQuestions.map((q, idx) => (
                              <div key={idx} className="flex items-start gap-1 text-[11px]">
                                <span className="font-bold text-amber-700">&bull;</span>
                                <span>{q}</span>
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Information Loss Declarations */}
                        {m.informationLoss && m.informationLoss.length > 0 && (
                          <div className="mt-2 p-2 bg-orange-50 border border-orange-200 rounded text-xs text-orange-900">
                            <span className="font-semibold text-[11px] block">Information Loss Disclosures:</span>
                            {m.informationLoss.map((loss, idx) => (
                              <div key={idx} className="text-[11px] text-orange-800">
                                &bull; {loss.description}
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Explicit Human Confirmation Warning */}
                        {m.semanticStatus === "needs_confirmation" && m.status !== "accepted" && (
                          <div className="mt-2.5 text-xs bg-amber-50 text-amber-900 border border-amber-200 rounded p-2 flex items-center justify-between">
                            <span>
                              &warning; Semantic ambiguity or constraint differences detected. Explicit human review and approval is required before compilation.
                            </span>
                          </div>
                        )}

                        {/* Actions Row */}
                        <div className="mt-3 pt-2.5 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2">
                          <div>
                            <button
                              type="button"
                              onClick={() => setExpandedAuditId(expandedAuditId === m.id ? null : m.id)}
                              className="text-[11px] text-slate-500 hover:text-slate-800 underline font-medium"
                            >
                              {expandedAuditId === m.id ? "Hide Audit Trail &uarr;" : `Audit Trail (${m.decisionHistory?.length || 1}) &darr;`}
                            </button>
                          </div>

                          <div className="flex items-center space-x-2">
                            <button
                              type="button"
                              onClick={() => openEditModal(m)}
                              className="text-xs px-2.5 py-1 rounded font-medium border border-slate-300 text-slate-700 bg-white hover:bg-slate-50 transition"
                            >
                              Edit
                            </button>
                            <button
                              type="button"
                              onClick={() => updateMappingStatus(m.id, "rejected")}
                              className={`text-xs px-2.5 py-1 rounded font-medium border transition ${
                                m.status === "rejected"
                                  ? "bg-rose-600 text-white border-rose-700"
                                  : "bg-white text-slate-700 border-slate-300 hover:bg-rose-50 hover:text-rose-700"
                              }`}
                            >
                              Reject
                            </button>
                            <button
                              type="button"
                              onClick={() => updateMappingStatus(m.id, "accepted")}
                              className={`text-xs px-3 py-1 rounded font-medium transition ${
                                m.status === "accepted"
                                  ? "bg-emerald-600 text-white"
                                  : "bg-slate-900 text-white hover:bg-emerald-600"
                              }`}
                            >
                              {m.status === "accepted" ? "Approved &check;" : "Approve Mapping"}
                            </button>
                          </div>
                        </div>

                        {/* Decision History Audit Trail Drawer */}
                        {expandedAuditId === m.id && (
                          <div className="mt-3 p-2.5 bg-slate-50 border border-slate-200 rounded text-xs space-y-1.5 font-mono text-[11px]">
                            <div className="font-semibold font-sans text-[11px] text-slate-700">
                              Mapping Provenance & Decision History:
                            </div>
                            {m.decisionHistory?.map((entry, idx) => (
                              <div key={idx} className="flex items-center justify-between text-slate-600 border-b border-slate-100 last:border-0 pb-1 last:pb-0">
                                <div>
                                  <span className="font-bold text-slate-800 uppercase">{entry.action}</span>
                                  {" by "}
                                  <span className="text-slate-700">{entry.actor}</span>
                                  {entry.note && <span className="text-slate-500"> &bull; {entry.note}</span>}
                                </div>
                                <span className="text-slate-400 text-[10px]">
                                  {new Date(entry.timestamp).toLocaleTimeString()}
                                </span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* TAB: TEST & ADAPTER */}
          {activeTab === "execute" && (
            <div className="space-y-4">
              <div className="bg-white border border-slate-200 rounded-lg p-4 shadow-xs flex items-center justify-between">
                <div>
                  <h2 className="text-sm font-semibold text-slate-900">Transformation IR Compiler & Interpreter</h2>
                  <p className="text-xs text-slate-500">
                    Executes approved TransformationPlan steps through trusted code. No eval; strict target schema validation.
                  </p>
                </div>
                <div className="flex items-center space-x-2">
                  <button
                    type="button"
                    onClick={compilePlan}
                    disabled={loading}
                    className="text-xs bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-300 px-3 py-1.5 rounded font-medium transition"
                  >
                    Recompile Plan
                  </button>
                  <button
                    type="button"
                    onClick={executePlan}
                    disabled={loading || !plan}
                    className="text-xs bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white px-3.5 py-1.5 rounded font-medium shadow-xs transition"
                  >
                    Run Interpreter & Validate
                  </button>
                </div>
              </div>

              {plan && (
                <div className="bg-white border border-slate-200 rounded-lg p-4 shadow-xs">
                  <div className="flex items-center justify-between text-xs border-b border-slate-200 pb-2 mb-3">
                    <span className="font-semibold text-slate-800">
                      Plan ID: <code className="font-mono">{plan.planId}</code>
                    </span>
                    <span className="text-slate-500">
                      Compiled Steps: {plan.steps.length} | Version: {plan.version}
                    </span>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs font-mono">
                      <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200 uppercase tracking-wider text-[11px] font-sans">
                        <tr>
                          <th className="py-2 px-2.5">Step</th>
                          <th className="py-2 px-2.5">Operation</th>
                          <th className="py-2 px-2.5">Source Path</th>
                          <th className="py-2 px-2.5">Target Path</th>
                          <th className="py-2 px-2.5">Details</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 text-[11px]">
                        {plan.steps.map((s, idx) => (
                          <tr key={s.stepId} className="hover:bg-slate-50">
                            <td className="py-1.5 px-2.5 text-slate-400">#{idx + 1}</td>
                            <td className="py-1.5 px-2.5 text-blue-700 font-bold">{s.operation}</td>
                            <td className="py-1.5 px-2.5 text-slate-600">{s.sourcePath || "(none)"}</td>
                            <td className="py-1.5 px-2.5 text-slate-900 font-semibold">{s.targetPath}</td>
                            <td className="py-1.5 px-2.5 text-slate-500">
                              {s.conversionType || (s.defaultValue !== undefined ? JSON.stringify(s.defaultValue) : "-")}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Phase 5: Interactive Test Runner & Fixture Selector */}
              {plan && (
                <div className="bg-white border border-slate-200 rounded-lg p-4 shadow-xs space-y-3">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                    <span className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                      Interactive Fixture Test Runner
                    </span>
                    <span className="text-[11px] text-slate-500">
                      Choose a canonical test case or paste custom payload
                    </span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-4 gap-2 text-xs">
                    {CANONICAL_TEST_FIXTURES.map((fix, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => {
                          setSelectedFixtureIdx(idx);
                          setCustomPayloadText(JSON.stringify(fix.payload, null, 2));
                        }}
                        className={`p-2 rounded border text-left transition ${
                          selectedFixtureIdx === idx
                            ? "border-blue-500 bg-blue-50/50 text-blue-900 font-medium"
                            : "border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100"
                        }`}
                      >
                        <div className="font-semibold text-[11px]">Fixture #{idx + 1}</div>
                        <div className="text-[10px] text-slate-500 truncate">{fix.description}</div>
                      </button>
                    ))}
                    <button
                      type="button"
                      onClick={() => setSelectedFixtureIdx(-1)}
                      className={`p-2 rounded border text-left transition ${
                        selectedFixtureIdx === -1
                          ? "border-purple-500 bg-purple-50/50 text-purple-900 font-medium"
                          : "border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100"
                      }`}
                    >
                      <div className="font-semibold text-[11px]">Custom Payload</div>
                      <div className="text-[10px] text-slate-500">Edit JSON input directly</div>
                    </button>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[11px] font-semibold text-slate-700 flex items-center justify-between">
                      <span>Source Payload Input (JSON):</span>
                      <button
                        type="button"
                        onClick={() => executePlan()}
                        disabled={loading}
                        className="text-[11px] text-blue-600 hover:text-blue-800 underline font-medium"
                      >
                        Execute with this payload →
                      </button>
                    </label>
                    <textarea
                      rows={5}
                      value={customPayloadText}
                      onChange={(e) => {
                        setCustomPayloadText(e.target.value);
                        setSelectedFixtureIdx(-1);
                      }}
                      className="font-mono text-xs w-full p-2.5 border border-slate-300 rounded bg-slate-50 text-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-500 resize-none"
                    />
                  </div>
                </div>
              )}

              {executionResult && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  <div className="bg-white border border-slate-200 rounded-lg p-4 shadow-xs">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-semibold text-slate-700 uppercase tracking-wider">Transformed Payload</span>
                      <StatusChip
                        label={executionResult.success ? "Execution: Passed" : "Execution: Failed"}
                        variant={executionResult.success ? "executed" : "invalid"}
                      />
                    </div>
                    <pre className="font-mono text-xs bg-slate-50 p-3 rounded border border-slate-200 overflow-auto max-h-72">
                      {JSON.stringify(executionResult.outputPayload, null, 2)}
                    </pre>

                    {executionResult.stepResults && executionResult.stepResults.length > 0 && (
                      <div className="mt-3 pt-2 border-t border-slate-100">
                        <button
                          type="button"
                          onClick={() => setShowStepInspector(!showStepInspector)}
                          className="text-[11px] text-slate-500 hover:text-slate-800 underline font-medium"
                        >
                          {showStepInspector
                            ? "Hide Step Execution Details ▲"
                            : `Show Step Execution Details (${executionResult.stepResults.length} steps) ▼`}
                        </button>

                        {showStepInspector && (
                          <div className="mt-2 overflow-x-auto border border-slate-200 rounded">
                            <table className="w-full text-left font-mono text-[10px]">
                              <thead className="bg-slate-100 text-slate-700">
                                <tr>
                                  <th className="py-1 px-2">Path</th>
                                  <th className="py-1 px-2">Op</th>
                                  <th className="py-1 px-2">In</th>
                                  <th className="py-1 px-2">Out</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-100">
                                {executionResult.stepResults.map((st) => (
                                  <tr key={st.stepId} className={st.success ? "" : "bg-rose-50"}>
                                    <td className="py-1 px-2 text-slate-900 font-bold">{st.targetPath}</td>
                                    <td className="py-1 px-2 text-blue-700">{st.operation}</td>
                                    <td className="py-1 px-2 text-slate-500 truncate max-w-[80px]">
                                      {st.inputValue !== undefined ? JSON.stringify(st.inputValue) : "undefined"}
                                    </td>
                                    <td className="py-1 px-2 text-slate-900 truncate max-w-[80px]">
                                      {st.outputValue !== undefined ? JSON.stringify(st.outputValue) : "-"}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="bg-white border border-slate-200 rounded-lg p-4 shadow-xs">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-semibold text-slate-700 uppercase tracking-wider">Target Contract Validation</span>
                      <StatusChip
                        label={validationResult?.valid ? "Target Contract: 100% Valid" : "Target Contract: Violations"}
                        variant={validationResult?.valid ? "accepted" : "error"}
                      />
                    </div>

                    {validationResult && (
                      <div className="space-y-2 text-xs">
                        <div className="text-slate-600">Checked fields: {validationResult.checkedFieldCount}</div>
                        {validationResult.valid ? (
                          <div className="p-3 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded">
                            Target contract satisfied. All types, required fields, and enums conform.
                          </div>
                        ) : (
                          <div className="space-y-1">
                            {validationResult.errors.map((e, i) => (
                              <div key={i} className="p-2 bg-rose-50 text-rose-800 border border-rose-200 rounded font-mono text-[11px]">
                                {e.message}
                              </div>
                            ))}
                          </div>
                        )}

                        {testSuite && (
                          <div className="mt-3 pt-3 border-t border-slate-200">
                            <span className="font-semibold text-slate-700 block mb-1">Equivalence Test Suite:</span>
                            <div className="text-xs text-slate-600">
                              Passed {testSuite.passedCases} of {testSuite.totalCases} fixtures. Interpreter vs Adapter Equivalence:{" "}
                              <span className={testSuite.allEqual ? "text-emerald-700 font-bold" : "text-rose-600 font-bold"}>
                                {testSuite.allEqual ? "VERIFIED" : "MISMATCH"}
                              </span>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {adapterCode && (
                <div className="bg-white border border-slate-200 rounded-lg p-4 shadow-xs">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-xs font-semibold text-slate-900 uppercase tracking-wider">
                      Generated Standalone TypeScript Adapter
                    </h3>
                    <button
                      type="button"
                      onClick={downloadAdapterCode}
                      className="text-xs bg-slate-900 hover:bg-slate-800 text-white px-3 py-1 rounded font-medium shadow-xs transition"
                    >
                      Download .ts Adapter
                    </button>
                  </div>
                  <CodeViewer code={adapterCode} language="typescript" maxHeight="350px" />
                </div>
              )}
            </div>
          )}

          {/* TAB: REPORT */}
          {activeTab === "report" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-sm font-semibold text-slate-900">Evidence-Backed Compatibility Report</h2>
                  <p className="text-xs text-slate-500">
                    Comprehensive audit trail including specs metadata, diff metrics, approved mappings, test results, and disclosures.
                  </p>
                </div>
                <div className="flex items-center space-x-2">
                  <button
                    type="button"
                    onClick={generateReport}
                    disabled={loading}
                    className="text-xs bg-slate-900 hover:bg-slate-800 text-white px-3 py-1.5 rounded font-medium shadow-xs transition"
                  >
                    Assemble Report
                  </button>
                  {reportMarkdown && (
                    <>
                      <button
                        type="button"
                        onClick={() => downloadReport("md")}
                        className="text-xs bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 px-3 py-1.5 rounded font-medium transition"
                      >
                        Export .MD
                      </button>
                      <button
                        type="button"
                        onClick={() => downloadReport("json")}
                        className="text-xs bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 px-3 py-1.5 rounded font-medium transition"
                      >
                        Export .JSON
                      </button>
                    </>
                  )}
                </div>
              </div>

              {reportMarkdown ? (
                <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-xs">
                  <pre className="whitespace-pre-wrap font-mono text-xs bg-slate-50 p-4 rounded border border-slate-200 text-slate-800 overflow-auto max-h-[500px]">
                    {reportMarkdown}
                  </pre>
                </div>
              ) : (
                <EmptyState
                  title="No report assembled"
                  description="Run the transformation plan and click Assemble Report to generate the evidence-backed compatibility summary."
                  action={{
                    label: "Assemble Report",
                    onClick: generateReport,
                  }}
                />
              )}
            </div>
          )}
        </div>
      </div>

      {/* Spec Replacement Confirmation Modal */}
      <ConfirmationDialog
        isOpen={showReplaceConfirm}
        title="Replace Contract Specifications?"
        description="Replacing either contract specification will invalidate any compiled transformation plans, generated adapters, and equivalence test results. All existing candidate mappings will be reset to 'needs_confirmation' to prevent them from pointing to obsolete schema hashes."
        confirmLabel="Replace & Invalidate Downstream"
        cancelLabel="Cancel"
        isDestructive
        onConfirm={() => triggerImport(true)}
        onCancel={() => setShowReplaceConfirm(false)}
      />

      {/* Manual Mapping Modal Dialog */}
      {isManualModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-lg shadow-xl border border-slate-200 max-w-lg w-full p-6 text-slate-900 space-y-4 animate-in fade-in duration-150">
            <div className="border-b border-slate-200 pb-3">
              <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
                Create Deterministic Manual Mapping
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Define an exact field mapping manually. Manual mappings bypass AI proposals and are immediately approved and recorded into the review ledger.
              </p>
            </div>

            <form onSubmit={submitManualMapping} className="space-y-3.5 text-xs">
              {/* Target Path */}
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Target Field Path <span className="text-rose-500">*</span>
                </label>
                {targetNormalized ? (
                  <select
                    value={formTargetPath}
                    onChange={(e) => setFormTargetPath(e.target.value)}
                    required
                    className="w-full font-mono text-xs p-2 border border-slate-300 rounded bg-white text-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-500"
                  >
                    {Object.keys(targetNormalized.flatFields)
                      .filter((p) => p !== "$")
                      .map((p) => (
                        <option key={p} value={p}>
                          {p} ({targetNormalized.flatFields[p]?.type}
                          {targetNormalized.flatFields[p]?.required ? ", required" : ""})
                        </option>
                      ))}
                  </select>
                ) : (
                  <input
                    type="text"
                    value={formTargetPath}
                    onChange={(e) => setFormTargetPath(e.target.value)}
                    placeholder="$.invoice.id"
                    required
                    className="w-full font-mono text-xs p-2 border border-slate-300 rounded focus:outline-none focus:ring-1 focus:ring-slate-500"
                  />
                )}
              </div>

              {/* Source Path */}
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Source Field Path (or empty for default/constructed)
                </label>
                {sourceNormalized ? (
                  <select
                    value={formSourcePath}
                    onChange={(e) => setFormSourcePath(e.target.value)}
                    className="w-full font-mono text-xs p-2 border border-slate-300 rounded bg-white text-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-500"
                  >
                    <option value="">(None - use default value or object constructor)</option>
                    {Object.keys(sourceNormalized.flatFields)
                      .filter((p) => p !== "$")
                      .map((p) => (
                        <option key={p} value={p}>
                          {p} ({sourceNormalized.flatFields[p]?.type})
                        </option>
                      ))}
                  </select>
                ) : (
                  <input
                    type="text"
                    value={formSourcePath}
                    onChange={(e) => setFormSourcePath(e.target.value)}
                    placeholder="$.billing.order_id"
                    className="w-full font-mono text-xs p-2 border border-slate-300 rounded focus:outline-none focus:ring-1 focus:ring-slate-500"
                  />
                )}
              </div>

              {/* Operation */}
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Transformation Operation <span className="text-rose-500">*</span>
                </label>
                <select
                  value={formOperation}
                  onChange={(e) => setFormOperation(e.target.value as AllowedOperation)}
                  className="w-full font-mono text-xs p-2 border border-slate-300 rounded bg-white text-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-500"
                >
                  {ALLOWED_OPERATIONS.map((op) => (
                    <option key={op} value={op}>
                      {op}
                    </option>
                  ))}
                </select>
              </div>

              {/* Conditional Operation Arguments */}
              {formOperation === "typeConversion" && (
                <div className="p-3 bg-purple-50/70 border border-purple-200 rounded space-y-1">
                  <label className="block font-semibold text-purple-900 mb-1">
                    Conversion Type <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={formConversionType}
                    onChange={(e) => setFormConversionType(e.target.value)}
                    className="w-full font-mono text-xs p-1.5 border border-purple-300 rounded bg-white text-purple-950 focus:outline-none"
                  >
                    {SUPPORTED_CONVERSIONS.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {formOperation === "default" && (
                <div className="p-3 bg-slate-50 border border-slate-200 rounded space-y-1">
                  <label className="block font-semibold text-slate-800 mb-1">
                    Default Value (literal string, number, or JSON) <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formDefaultValue}
                    onChange={(e) => setFormDefaultValue(e.target.value)}
                    placeholder='"standard" or 0 or false'
                    required
                    className="w-full font-mono text-xs p-1.5 border border-slate-300 rounded bg-white focus:outline-none"
                  />
                </div>
              )}

              {formOperation === "lookup" && (
                <div className="p-3 bg-indigo-50/70 border border-indigo-200 rounded space-y-1">
                  <label className="block font-semibold text-indigo-900 mb-1">
                    Lookup Table JSON (Dictionary mapping) <span className="text-rose-500">*</span>
                  </label>
                  <textarea
                    rows={4}
                    value={formLookupTable}
                    onChange={(e) => setFormLookupTable(e.target.value)}
                    placeholder={'{\n  "pending": "OPEN",\n  "paid": "SETTLED"\n}'}
                    required
                    className="w-full font-mono text-xs p-1.5 border border-indigo-300 rounded bg-white focus:outline-none resize-none"
                  />
                </div>
              )}

              {/* Rationale */}
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Human Rationale / Mapping Notes
                </label>
                <input
                  type="text"
                  value={formRationale}
                  onChange={(e) => setFormRationale(e.target.value)}
                  placeholder="e.g., Target requires invoice currency code, defaulting to USD."
                  className="w-full text-xs p-2 border border-slate-300 rounded focus:outline-none focus:ring-1 focus:ring-slate-500"
                />
              </div>

              {/* Buttons */}
              <div className="pt-2 flex items-center justify-end space-x-2 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setIsManualModalOpen(false)}
                  disabled={loading}
                  className="px-3 py-1.5 border border-slate-300 rounded text-slate-700 hover:bg-slate-100 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading || !formTargetPath.trim()}
                  className="px-4 py-1.5 bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white rounded font-medium shadow-xs transition"
                >
                  {loading ? "Saving..." : "Save & Approve Manual Mapping"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Candidate Mapping Modal Dialog */}
      {activeMappingForEdit && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-lg shadow-xl border border-slate-200 max-w-lg w-full p-6 text-slate-900 space-y-4 animate-in fade-in duration-150">
            <div className="border-b border-slate-200 pb-3">
              <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
                Edit Mapping: {activeMappingForEdit.targetPath}
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Adjust source path, operation type, conversion rules, or default parameters. Saved changes update this proposal with status &apos;edited&apos;.
              </p>
            </div>

            <form onSubmit={submitEditMapping} className="space-y-3.5 text-xs">
              {/* Target Path (read-only) */}
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Target Field Path</label>
                <input
                  type="text"
                  value={activeMappingForEdit.targetPath}
                  disabled
                  className="w-full font-mono text-xs p-2 border border-slate-200 bg-slate-100 text-slate-600 rounded cursor-not-allowed"
                />
              </div>

              {/* Source Path */}
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Source Field Path (or empty for default/constructed)
                </label>
                {sourceNormalized ? (
                  <select
                    value={formSourcePath}
                    onChange={(e) => setFormSourcePath(e.target.value)}
                    className="w-full font-mono text-xs p-2 border border-slate-300 rounded bg-white text-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-500"
                  >
                    <option value="">(None - use default value or object constructor)</option>
                    {Object.keys(sourceNormalized.flatFields)
                      .filter((p) => p !== "$")
                      .map((p) => (
                        <option key={p} value={p}>
                          {p} ({sourceNormalized.flatFields[p]?.type})
                        </option>
                      ))}
                  </select>
                ) : (
                  <input
                    type="text"
                    value={formSourcePath}
                    onChange={(e) => setFormSourcePath(e.target.value)}
                    placeholder="$.billing.order_id"
                    className="w-full font-mono text-xs p-2 border border-slate-300 rounded focus:outline-none focus:ring-1 focus:ring-slate-500"
                  />
                )}
              </div>

              {/* Operation */}
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Transformation Operation <span className="text-rose-500">*</span>
                </label>
                <select
                  value={formOperation}
                  onChange={(e) => setFormOperation(e.target.value as AllowedOperation)}
                  className="w-full font-mono text-xs p-2 border border-slate-300 rounded bg-white text-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-500"
                >
                  {ALLOWED_OPERATIONS.map((op) => (
                    <option key={op} value={op}>
                      {op}
                    </option>
                  ))}
                </select>
              </div>

              {/* Conditional Operation Arguments */}
              {formOperation === "typeConversion" && (
                <div className="p-3 bg-purple-50/70 border border-purple-200 rounded space-y-1">
                  <label className="block font-semibold text-purple-900 mb-1">
                    Conversion Type <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={formConversionType}
                    onChange={(e) => setFormConversionType(e.target.value)}
                    className="w-full font-mono text-xs p-1.5 border border-purple-300 rounded bg-white text-purple-950 focus:outline-none"
                  >
                    {SUPPORTED_CONVERSIONS.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {formOperation === "default" && (
                <div className="p-3 bg-slate-50 border border-slate-200 rounded space-y-1">
                  <label className="block font-semibold text-slate-800 mb-1">
                    Default Value (literal string, number, or JSON) <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formDefaultValue}
                    onChange={(e) => setFormDefaultValue(e.target.value)}
                    placeholder='"standard" or 0 or false'
                    required
                    className="w-full font-mono text-xs p-1.5 border border-slate-300 rounded bg-white focus:outline-none"
                  />
                </div>
              )}

              {formOperation === "lookup" && (
                <div className="p-3 bg-indigo-50/70 border border-indigo-200 rounded space-y-1">
                  <label className="block font-semibold text-indigo-900 mb-1">
                    Lookup Table JSON (Dictionary mapping) <span className="text-rose-500">*</span>
                  </label>
                  <textarea
                    rows={4}
                    value={formLookupTable}
                    onChange={(e) => setFormLookupTable(e.target.value)}
                    placeholder={'{\n  "pending": "OPEN",\n  "paid": "SETTLED"\n}'}
                    required
                    className="w-full font-mono text-xs p-1.5 border border-indigo-300 rounded bg-white focus:outline-none resize-none"
                  />
                </div>
              )}

              {/* Warning on high-risk / lossy conversion */}
              {(formOperation === "typeConversion" || formOperation === "default" || formOperation === "lookup") && (
                <div className="p-2 bg-amber-50 border border-amber-200 rounded text-amber-900 text-[11px]">
                  &warning; Note: Modifying this mapping to {formOperation} requires human verification. An audit record will be attached to the mapping.
                </div>
              )}

              {/* Buttons */}
              <div className="pt-2 flex items-center justify-end space-x-2 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setActiveMappingForEdit(null)}
                  disabled={loading}
                  className="px-3 py-1.5 border border-slate-300 rounded text-slate-700 hover:bg-slate-100 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-4 py-1.5 bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white rounded font-medium shadow-xs transition"
                >
                  {loading ? "Saving..." : "Save Mapping Edits"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <footer className="border-t border-slate-200 bg-white py-3 text-center text-xs text-slate-400">
        UNIFLOW ∞ — API Compatibility Compiler • Cloud Security • System Design • DBMS • PBL / DP-900 Azure
      </footer>
    </div>
  );
}
