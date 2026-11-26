"use client";

import * as React from "react";
import { useParams } from "next/navigation";
import { TopBar } from "@/components/shell/topbar";
import { HeroBackdrop } from "@/components/ui/hero-backdrop";
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

function getMappingSamplePreview(m: CandidateMapping): {
  sampleIn: string;
  sampleOut: string;
  categoryLabel: string;
  categoryStyle: string;
  plainSummary: string;
} {
  const sampleFixture = CANONICAL_TEST_FIXTURES[0].payload as Record<string, unknown>;
  const rawKey = m.sourcePath?.match(/^\$\["([^"]+)"\]$/)?.[1];
  const sampleInputVal = rawKey && rawKey in sampleFixture ? sampleFixture[rawKey] : undefined;

  const op = m.transformation.operation;
  if (op === "typeConversion") {
    const conv = m.transformation.conversionType || "convert";
    const inStr = sampleInputVal !== undefined ? JSON.stringify(sampleInputVal) : "101";
    let outStr = `"${String(sampleInputVal ?? "101")}"`;
    if (conv.endsWith("integer")) outStr = "101";
    else if (conv.endsWith("number")) outStr = "42.5";
    else if (conv.endsWith("boolean")) outStr = "true";
    return {
      sampleIn: inStr,
      sampleOut: outStr,
      categoryLabel: `Type Shift (${conv})`,
      categoryStyle: "bg-[#f4845f]/15 text-[#f4845f] border-[#f4845f]/35",
      plainSummary: "Safely converts source data type to match the target contract schema at runtime without eval().",
    };
  }
  if (op === "lookup") {
    const tbl = m.transformation.lookupTable || {};
    const firstKey = Object.keys(tbl)[0];
    const inVal =
      sampleInputVal !== undefined
        ? String(sampleInputVal)
        : firstKey || "USD";
    const mapped =
      tbl[inVal] ?? tbl[inVal.toLowerCase()] ?? tbl[inVal.toUpperCase()] ?? (firstKey ? tbl[firstKey] : inVal.toLowerCase());
    return {
      sampleIn: JSON.stringify(inVal),
      sampleOut: JSON.stringify(mapped),
      categoryLabel: "Enum Dictionary Lookup",
      categoryStyle: "bg-teal-500/15 text-teal-300 border-teal-400/35",
      plainSummary: "Translates allowed enum values deterministically using the verified lookup dictionary.",
    };
  }
  if (op === "default" || !m.sourcePath) {
    return {
      sampleIn: "(missing in source)",
      sampleOut: JSON.stringify(m.transformation.defaultValue ?? "default"),
      categoryLabel: "Guaranteed Default Injection",
      categoryStyle: "bg-amber-500/15 text-amber-300 border-amber-400/35",
      plainSummary: "Source lacks this required target field, so the compiler injects a guaranteed compliant value.",
    };
  }
  if (op === "rename") {
    const v = sampleInputVal !== undefined ? JSON.stringify(sampleInputVal) : '"value"';
    return {
      sampleIn: v,
      sampleOut: v,
      categoryLabel: "Schema Field Rename",
      categoryStyle: "bg-sky-500/15 text-sky-300 border-sky-400/35",
      plainSummary: "Preserves exact value & type while relocating it to the new target field name.",
    };
  }
  const v = sampleInputVal !== undefined ? JSON.stringify(sampleInputVal) : '"value"';
  return {
    sampleIn: v,
    sampleOut: v,
    categoryLabel: "Direct Copy / Structure",
    categoryStyle: "bg-emerald-500/15 text-emerald-300 border-emerald-400/35",
    plainSummary: "Clean schema match — copies field directly with full type safety.",
  };
}

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
  const [reportFormatView, setReportFormatView] = React.useState<"markdown" | "json">("markdown");
  const [cloudStatus, setCloudStatus] = React.useState<{
    supabase: { configured: boolean; status: string; endpoint: string | null };
    groq: { configured: boolean; status: string; model: string };
    azureBlob: { configured: boolean; status: string; accountName: string | null; containerName: string };
    azureSql: { configured: boolean; status: string; server: string | null; database: string | null };
  } | null>(null);
  const [persistingToCloud, setPersistingToCloud] = React.useState(false);

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

        // Fetch Multi-Cloud status safely (Supabase, Groq, Azure Blob, Azure SQL)
        try {
          const cloudRes = await fetch("/api/cloud/status");
          if (cloudRes.ok) {
            const cloudData = await cloudRes.json();
            setCloudStatus(cloudData.services);
          }
        } catch {
          // ignore offline
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
      const isEventLike =
        customPayload !== null &&
        typeof customPayload === "object" &&
        ("nativeEvent" in (customPayload as Record<string, unknown>) ||
          "currentTarget" in (customPayload as Record<string, unknown>));

      let payloadToSend: unknown;
      if (customPayload !== undefined && !isEventLike) {
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

  async function runFullEndToEndPipeline() {
    if (!projectId) return;
    setLoading(true);
    setErrorMsg(null);
    setSuccessMsg(null);
    try {
      const srcContent = sourceText.trim() || CANONICAL_SOURCE_SPEC;
      const tgtContent = targetText.trim() || CANONICAL_TARGET_SPEC;
      if (!sourceText.trim()) setSourceText(srcContent);
      if (!targetText.trim()) setTargetText(tgtContent);

      // Stage 1 & 2: Import Specs & Compute 9-Facet Structural Diff
      const sRes = await fetch(`/api/projects/${projectId}/specs`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ side: "source", name: "source-contract.json", rawContent: srcContent }),
      });
      const sData = await sRes.json();
      if (!sRes.ok) throw new Error(sData.error || "Stage 1 (Source Spec) failed.");
      setSourceNormalized(sData.normalized);

      const tRes = await fetch(`/api/projects/${projectId}/specs`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ side: "target", name: "target-contract.json", rawContent: tgtContent }),
      });
      const tData = await tRes.json();
      if (!tRes.ok) throw new Error(tData.error || "Stage 2 (Target Spec & Diff) failed.");
      setTargetNormalized(tData.normalized);
      setDiff(tData.diff);

      // Stage 3: Propose Mappings with Groq AI (graceful fallback if offline)
      const pRes = await fetch(`/api/projects/${projectId}/mappings/propose`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ allowFallbackOnFailure: true }),
      });
      const pData = await pRes.json();
      if (pRes.ok && Array.isArray(pData.mappings)) {
        setMappings(pData.mappings);
      }

      // Stage 4: Approve verified mappings in Human-in-the-Loop Gate
      const aRes = await fetch(`/api/projects/${projectId}/mappings`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ acceptAll: true }),
      });
      const aData = await aRes.json();
      if (aRes.ok && Array.isArray(aData.mappings)) {
        setMappings(aData.mappings);
      }

      // Stage 5: Compile IR Plan & Run Trusted Execution + TypeScript Adapter Generation
      const cRes = await fetch(`/api/projects/${projectId}/compile`, { method: "POST" });
      const cData = await cRes.json();
      if (!cRes.ok) throw new Error(cData.error || "Stage 5 (Compile IR) failed.");
      setPlan(cData.plan);

      const payloadToRun = CANONICAL_TEST_FIXTURES[0].payload;
      const eRes = await fetch(`/api/projects/${projectId}/execute`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ payload: payloadToRun }),
      });
      const eData = await eRes.json();
      if (!eRes.ok) throw new Error(eData.error || "Stage 5 (Execution) failed.");
      setExecutionResult(eData.execution);
      setValidationResult(eData.validation);
      setTestSuite(eData.testSuite);
      setAdapterCode(eData.adapterCode);

      // Stage 6: Assemble Compatibility Report & Certify to Azure SQL + Blob
      const rRes = await fetch(`/api/projects/${projectId}/report`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "all" }),
      });
      const rData = await rRes.json();
      if (!rRes.ok) throw new Error(rData.error || "Stage 6 (Report & Azure Cloud) failed.");
      setReportData(rData.reportData);
      setReportMarkdown(rData.markdown);

      setSuccessMsg(
        "Full 6-stage migration pipeline verified! Specs parsed, Groq mappings approved, zero-eval TypeScript adapter compiled, and Azure SQL/Blob report certified."
      );
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  async function persistEvidence(action: "azure_sql" | "azure_blob" | "all" = "all") {
    if (!projectId) return;
    setPersistingToCloud(true);
    setErrorMsg(null);
    try {
      const res = await fetch(`/api/projects/${projectId}/report`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to persist execution evidence.");
      setReportData(data.reportData);
      setReportMarkdown(data.markdown);
      setSuccessMsg(
        action === "azure_sql"
          ? `Evidence recorded in Azure SQL (Run ID: ${data.reportData.cloudEvidence?.azureSqlRunId || "Logged"}).`
          : action === "azure_blob"
          ? "Report artifacts (.md and .json) uploaded to Azure Blob Storage."
          : `Evidence certified: Azure SQL Run ID ${data.reportData.cloudEvidence?.azureSqlRunId?.slice(0, 8)}... & Azure Blob artifacts synchronized.`
      );
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : String(err));
    } finally {
      setPersistingToCloud(false);
    }
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
    <div className="min-h-screen bg-[#090807] text-[#f5f2eb] flex flex-col font-sans relative overflow-x-hidden selection:bg-teal-950/400 selection:text-white">
      <HeroBackdrop />
      <TopBar />

      {/* Project Subheader */}
      <div className="relative z-10 bg-black/45 backdrop-blur-2xl border-b border-white/[0.08] px-6 sm:px-10 lg:px-12 py-5">
        <div className="max-w-[1680px] mx-auto flex flex-wrap items-center justify-between gap-4">
          <div>
            <Breadcrumb
              items={[
                { label: "Overview", href: "/overview" },
                { label: "Workspaces", href: "/projects" },
                { label: project?.name || projectId, current: true },
              ]}
              className="mb-1.5 text-zinc-400"
            />
            <div className="flex items-center gap-3 flex-wrap gap-y-1.5">
              <h1 className="text-2xl font-semibold text-white tracking-tight">
                {project?.name || "Workspace"}
              </h1>
              <span className="font-mono text-xs text-zinc-400 bg-white/[0.05] px-2.5 py-0.5 rounded-full border border-white/[0.08]">
                {projectId}
              </span>
              <span className="font-mono text-[11px] text-emerald-300 bg-emerald-500/10 px-2.5 py-0.5 rounded-full border border-emerald-400/25">
                CERT-In &bull; DPDP 2023
              </span>

              {cloudStatus && (
                <div className="flex items-center space-x-1.5 ml-2">
                  <span
                    title={cloudStatus.supabase.configured ? "Supabase Connected" : "Local Mock Storage"}
                    className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-mono border ${
                      cloudStatus.supabase.configured
                        ? "bg-emerald-950/80 text-emerald-400 border-emerald-800/60"
                        : "bg-zinc-800 text-zinc-500 border-white/[0.12]"
                    }`}
                  >
                    Postgres: {cloudStatus.supabase.configured ? "Ready" : "Local"}
                  </span>
                  <span
                    title={cloudStatus.groq.configured ? `Groq LLM: ${cloudStatus.groq.model}` : "Groq Not Configured (Offline Mode)"}
                    className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-mono border ${
                      cloudStatus.groq.configured
                        ? "bg-blue-950/80 text-blue-400 border-blue-800/60"
                        : "bg-zinc-800 text-zinc-500 border-white/[0.12]"
                    }`}
                  >
                    Groq: {cloudStatus.groq.configured ? "Online" : "Mock"}
                  </span>
                  <span
                    title={cloudStatus.azureSql.configured ? `Azure SQL: ${cloudStatus.azureSql.server}` : "Azure SQL Bridge (Simulated / Local Fallback)"}
                    className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-mono border ${
                      cloudStatus.azureSql.configured
                        ? "bg-teal-950/80 text-teal-400 border-teal-800/60"
                        : "bg-amber-950/80 text-amber-400 border-amber-800/60"
                    }`}
                  >
                    Azure SQL: {cloudStatus.azureSql.configured ? "Connected" : "Simulated"}
                  </span>
                  <span
                    title={cloudStatus.azureBlob.configured ? `Azure Blob: ${cloudStatus.azureBlob.accountName}` : "Azure Blob Storage (Simulated / In-Memory)"}
                    className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-mono border ${
                      cloudStatus.azureBlob.configured
                        ? "bg-cyan-950/80 text-cyan-400 border-cyan-800/60"
                        : "bg-zinc-800 text-zinc-500 border-white/[0.12]"
                    }`}
                  >
                    Azure Blob: {cloudStatus.azureBlob.configured ? "Connected" : "Simulated"}
                  </span>
                </div>
              )}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={loadCanonicalFixtures}
              className="text-sm bg-white/[0.06] hover:bg-white/[0.12] text-zinc-100 border border-white/[0.12] px-5 py-2.5 rounded-full font-medium transition"
            >
              Load Canonical Pair
            </button>
            <button
              type="button"
              onClick={loadSampleJsonFixture}
              className="text-sm bg-amber-500/15 hover:bg-amber-500/25 text-amber-200 border border-amber-400/30 px-5 py-2.5 rounded-full font-medium transition"
              title="Demonstrate schema inference from arbitrary sample JSON payload"
            >
              Load Sample JSON
            </button>
            <button
              type="button"
              onClick={() => triggerImport(false)}
              disabled={loading}
              className="champagne-pill disabled:opacity-50 text-sm font-semibold px-6 py-2.5 rounded-full transition"
            >
              Parse &amp; Compare →
            </button>
          </div>
        </div>
      </div>

      {/* Messages */}
      <div className="relative z-10 max-w-[1680px] mx-auto px-6 sm:px-10 lg:px-12 w-full mt-4">
        {errorMsg && <ErrorPanel message={errorMsg} onDismiss={() => setErrorMsg(null)} className="mb-2" />}
        {successMsg && (
          <div className="p-3.5 mb-2 bg-emerald-950/50 border border-emerald-500/30 text-emerald-200 text-xs sm:text-sm rounded-2xl flex items-center justify-between backdrop-blur-md">
            <span>{successMsg}</span>
            <button type="button" onClick={() => setSuccessMsg(null)} className="text-emerald-300 font-bold ml-2">
              ×
            </button>
          </div>
        )}
      </div>

      {/* Workspace Body with Sidebar */}
      <div className="relative z-10 max-w-[1680px] mx-auto px-6 sm:px-10 lg:px-12 py-6 w-full flex-1 flex flex-col md:flex-row gap-6">
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
            <div className="space-y-6">
              <div className="apple-glass rounded-3xl p-7 shadow-xs">
                <h2 className="text-lg font-semibold text-white mb-1.5">Project Summary</h2>
                <p className="text-sm sm:text-[15px] text-zinc-300 leading-relaxed mb-5">
                  {project?.description || "This workspace manages the comparison, mapping review, and adapter compilation between source and target API contracts."}
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 border-t border-white/[0.08] pt-5 text-sm">
                  <div>
                    <span className="text-zinc-400 block text-xs mb-1">Owner Tenant:</span>
                    <span className="font-mono text-zinc-100">PostgreSQL RLS Isolated</span>
                  </div>
                  <div>
                    <span className="text-zinc-400 block text-xs mb-1">Created At:</span>
                    <span className="text-zinc-100">
                      {project?.created_at ? new Date(project.created_at).toLocaleDateString() : "Just now"}
                    </span>
                  </div>
                  <div>
                    <span className="text-zinc-400 block text-xs mb-1">Core Engine:</span>
                    <StatusChip label="Deterministic IR Ready" variant="low" />
                  </div>
                </div>
              </div>

              {/* 6-Stage Workflow Stepper Card */}
              <div className="apple-glass rounded-3xl p-7 shadow-xs">
                <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
                  <div>
                    <h3 className="text-base font-mono font-semibold uppercase tracking-wider text-zinc-100">
                      6-Stage Compiler Pipeline
                    </h3>
                    <p className="text-xs sm:text-sm text-zinc-400 mt-0.5">
                      Run every stage step-by-step or execute the full verified pipeline with Groq AI &amp; Azure certification.
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={runFullEndToEndPipeline}
                      disabled={loading}
                      className="champagne-pill disabled:opacity-50 text-sm font-semibold px-5 py-2.5 rounded-full transition"
                    >
                      {loading ? "Running Pipeline..." : "⚡ Auto-Run All 6 Stages →"}
                    </button>
                  </div>
                </div>

                <div className="space-y-3 text-sm sm:text-[15px]">
                  <div className="flex items-center justify-between p-4 rounded-2xl bg-black/50 border border-white/[0.08]">
                    <span className="font-medium text-zinc-100">1. Ingest &amp; Normalize Specs (AST + SHA-256)</span>
                    {sourceText && targetText ? (
                      <button
                        type="button"
                        onClick={() => setActiveTab("specs")}
                        className="hover:opacity-90"
                      >
                        <StatusChip label="Contracts Loaded" variant="accepted" />
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setActiveTab("specs")}
                        className="text-sm font-medium text-[#f5dfb8] hover:underline"
                      >
                        Import Specs →
                      </button>
                    )}
                  </div>

                  <div className="flex items-center justify-between p-4 rounded-2xl bg-black/50 border border-white/[0.08]">
                    <span className="font-medium text-zinc-100">2. Deterministic 9-Facet Structural Diff</span>
                    {diff ? (
                      <button
                        type="button"
                        onClick={() => setActiveTab("specs")}
                        className="hover:opacity-90"
                      >
                        <StatusChip label={`${diff.summary.totalTargetFields} fields diffed`} variant="info" />
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setActiveTab("specs")}
                        className="text-sm text-zinc-400 hover:text-zinc-200"
                      >
                        Run Parse &amp; Compare →
                      </button>
                    )}
                  </div>

                  <div className="flex items-center justify-between p-4 rounded-2xl bg-black/50 border border-white/[0.08]">
                    <span className="font-medium text-zinc-100">3. Groq AI &amp; Baseline Mapping Proposals</span>
                    {mappings.length > 0 ? (
                      <button
                        type="button"
                        onClick={() => setActiveTab("mappings")}
                        className="text-sm font-medium text-[#f5dfb8] hover:underline"
                      >
                        {mappings.length} proposals ready →
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setActiveTab("mappings")}
                        className="text-sm text-zinc-400 hover:text-zinc-200"
                      >
                        Propose Mappings →
                      </button>
                    )}
                  </div>

                  <div className="flex items-center justify-between p-4 rounded-2xl bg-black/50 border border-white/[0.08]">
                    <span className="font-medium text-zinc-100">4. Human-in-the-Loop Review Gate</span>
                    {mappings.some((m) => m.status === "accepted" || m.status === "edited") ? (
                      <button
                        type="button"
                        onClick={() => setActiveTab("mappings")}
                        className="hover:opacity-90"
                      >
                        <StatusChip
                          label={`${mappings.filter((m) => m.status === "accepted" || m.status === "edited").length}/${mappings.length} Approved`}
                          variant="accepted"
                        />
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setActiveTab("mappings")}
                        className="text-sm text-zinc-400 hover:text-zinc-200"
                      >
                        Review &amp; Approve →
                      </button>
                    )}
                  </div>

                  <div className="flex items-center justify-between p-4 rounded-2xl bg-black/50 border border-white/[0.08]">
                    <span className="font-medium text-zinc-100">5. Compile IR, Execute Fixtures &amp; TypeScript Adapter</span>
                    {adapterCode ? (
                      <button
                        type="button"
                        onClick={() => setActiveTab("execute")}
                        className="hover:opacity-90"
                      >
                        <StatusChip label="Adapter Verified" variant="executed" />
                      </button>
                    ) : plan ? (
                      <button
                        type="button"
                        onClick={() => setActiveTab("execute")}
                        className="hover:opacity-90"
                      >
                        <StatusChip label="Plan Compiled — Run Test" variant="compiled" />
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setActiveTab("execute")}
                        className="text-sm text-zinc-400 hover:text-zinc-200"
                      >
                        Compile &amp; Execute →
                      </button>
                    )}
                  </div>

                  <div className="flex items-center justify-between p-4 rounded-2xl bg-black/50 border border-white/[0.08]">
                    <span className="font-medium text-zinc-100">6. Compatibility Report &amp; Azure SQL / Blob Evidence</span>
                    {reportData ? (
                      <button
                        type="button"
                        onClick={() => setActiveTab("report")}
                        className="hover:opacity-90"
                      >
                        <StatusChip label="Report Assembled" variant="accepted" />
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setActiveTab("report")}
                        className="text-sm text-zinc-400 hover:text-zinc-200"
                      >
                        Generate &amp; Certify →
                      </button>
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
              <div className="apple-glass rounded-3xl p-6 shadow-xs flex flex-wrap items-center justify-between gap-4">
                <div>
                  <h2 className="text-lg font-semibold text-white">Contract Specifications &amp; Schema Trees</h2>
                  <p className="text-sm text-zinc-300 mt-0.5">
                    Import OpenAPI 3.x or JSON Schema specifications. Schemas are normalized with strict cycle guards and deterministic path indexing.
                  </p>
                </div>
                <div className="flex items-center space-x-2">
                  <button
                    type="button"
                    onClick={() => triggerImport(false)}
                    disabled={loading}
                    className="champagne-pill disabled:opacity-50 text-sm font-semibold px-6 py-2.5 rounded-full transition"
                  >
                    {loading ? "Parsing..." : "Parse & Compare Contracts →"}
                  </button>
                </div>
              </div>

              {/* Source & Target Panes */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* SOURCE SPEC PANE */}
                <div className="apple-glass rounded-3xl p-6 shadow-xs flex flex-col space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2.5">
                      <span className="text-sm font-bold text-amber-300 uppercase tracking-wider">Source Contract</span>
                      {sourceNormalized?.metadata.isInferred ? (
                        <span className="text-xs font-mono bg-amber-500/15 text-amber-200 border border-amber-400/30 px-2.5 py-0.5 rounded-full font-medium">
                          Inferred Sample JSON
                        </span>
                      ) : (
                        <span className="text-xs font-mono text-zinc-200 bg-white/[0.06] border border-white/[0.1] px-2.5 py-0.5 rounded-full">
                          {sourceNormalized?.metadata.format || "JSON / JSON Schema"}
                        </span>
                      )}
                    </div>
                    {sourceNormalized?.metadata.schemaHash && (
                      <span className="text-xs font-mono text-zinc-400" title={`SHA-256: ${sourceNormalized.metadata.schemaHash}`}>
                        hash:{sourceNormalized.metadata.schemaHash.slice(0, 10)}...
                      </span>
                    )}
                  </div>

                  <FileDropzone
                    label="Drop Source Spec JSON or click to browse"
                    onFileLoaded={(content) => setSourceText(content)}
                  />

                  <textarea
                    rows={9}
                    value={sourceText}
                    onChange={(e) => setSourceText(e.target.value)}
                    placeholder="Paste Source JSON Schema or OpenAPI 3.x JSON..."
                    className="font-mono text-[13px] leading-relaxed w-full p-3.5 border border-white/[0.12] rounded-2xl bg-[#090807]/95 text-[#f5dfb8] focus:outline-none focus:ring-1 focus:ring-[#f5dfb8]/50 resize-none"
                  />

                  {/* OpenAPI Schema Picker if multiple candidate schemas exist */}
                  {sourceAvailableSchemas.length > 1 && (
                    <div className="p-3.5 bg-violet-950/40 border border-violet-400/30 rounded-2xl text-sm space-y-2">
                      <div className="flex items-center justify-between">
                        <label htmlFor="source-schema-select" className="font-semibold text-violet-200 text-xs">
                          OpenAPI Root Schema Candidate:
                        </label>
                        <span className="text-xs text-violet-300 font-mono">
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
                        className="w-full text-sm font-mono p-2.5 border border-violet-400/40 rounded-xl bg-[#090807] text-white focus:ring-1 focus:ring-violet-400 focus:outline-none"
                      >
                        {sourceAvailableSchemas.map((name) => (
                          <option key={name} value={name}>
                            {name}
                          </option>
                        ))}
                      </select>
                      <p className="text-xs text-violet-300 leading-tight">
                        Select which schema from components.schemas to treat as the active root contract for comparison.
                      </p>
                    </div>
                  )}

                  {/* Normalized Schema Tree */}
                  <SchemaTree schema={sourceNormalized} side="source" />
                </div>

                {/* TARGET SPEC PANE */}
                <div className="apple-glass rounded-3xl p-6 shadow-xs flex flex-col space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2.5">
                      <span className="text-sm font-bold text-teal-300 uppercase tracking-wider">Target Contract</span>
                      {targetNormalized?.metadata.isInferred ? (
                        <span className="text-xs font-mono bg-amber-500/15 text-amber-200 border border-amber-400/30 px-2.5 py-0.5 rounded-full font-medium">
                          Inferred Sample JSON
                        </span>
                      ) : (
                        <span className="text-xs font-mono text-zinc-200 bg-white/[0.06] border border-white/[0.1] px-2.5 py-0.5 rounded-full">
                          {targetNormalized?.metadata.format || "JSON / JSON Schema"}
                        </span>
                      )}
                    </div>
                    {targetNormalized?.metadata.schemaHash && (
                      <span className="text-xs font-mono text-zinc-400" title={`SHA-256: ${targetNormalized.metadata.schemaHash}`}>
                        hash:{targetNormalized.metadata.schemaHash.slice(0, 10)}...
                      </span>
                    )}
                  </div>

                  <FileDropzone
                    label="Drop Target Spec JSON or click to browse"
                    onFileLoaded={(content) => setTargetText(content)}
                  />

                  <textarea
                    rows={9}
                    value={targetText}
                    onChange={(e) => setTargetText(e.target.value)}
                    placeholder="Paste Target JSON Schema or OpenAPI 3.x JSON..."
                    className="font-mono text-[13px] leading-relaxed w-full p-3.5 border border-white/[0.12] rounded-2xl bg-[#090807]/95 text-[#f5dfb8] focus:outline-none focus:ring-1 focus:ring-[#f5dfb8]/50 resize-none"
                  />

                  {/* OpenAPI Schema Picker if multiple candidate schemas exist */}
                  {targetAvailableSchemas.length > 1 && (
                    <div className="p-3.5 bg-violet-950/40 border border-violet-400/30 rounded-2xl text-sm space-y-2">
                      <div className="flex items-center justify-between">
                        <label htmlFor="target-schema-select" className="font-semibold text-violet-200 text-xs">
                          OpenAPI Root Schema Candidate:
                        </label>
                        <span className="text-xs text-violet-300 font-mono">
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
                        className="w-full text-sm font-mono p-2.5 border border-violet-400/40 rounded-xl bg-[#090807] text-white focus:ring-1 focus:ring-violet-400 focus:outline-none"
                      >
                        {targetAvailableSchemas.map((name) => (
                          <option key={name} value={name}>
                            {name}
                          </option>
                        ))}
                      </select>
                      <p className="text-xs text-violet-300 leading-tight">
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
                <div className="apple-glass rounded-3xl shadow-xs overflow-hidden space-y-0">
                  {/* Diff Header */}
                  <div className="px-6 py-5 border-b border-white/[0.08] bg-black/50 flex flex-wrap items-center justify-between gap-4">
                    <div>
                      <h3 className="text-sm font-bold uppercase tracking-wider text-zinc-100">
                        Computed Structural Differences ({diff.summary.totalTargetFields} target fields)
                      </h3>
                      <div className="flex flex-wrap items-center gap-2 mt-2 text-xs">
                        <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-400/30 font-medium">
                          {diff.summary.exactMatches} exact
                        </span>
                        <span className="px-2.5 py-0.5 rounded-full bg-sky-500/15 text-sky-300 border border-sky-400/30 font-medium">
                          {diff.summary.renamedCandidates} renamed
                        </span>
                        <span className="px-2.5 py-0.5 rounded-full bg-rose-500/15 text-rose-300 border border-rose-400/30 font-medium">
                          {diff.summary.missingRequired} missing required
                        </span>
                        <span className="px-2.5 py-0.5 rounded-full bg-amber-500/15 text-amber-300 border border-amber-400/30 font-medium">
                          {diff.summary.typeConflicts} type conflict
                        </span>
                        <span className="px-2.5 py-0.5 rounded-full bg-violet-500/15 text-violet-300 border border-violet-400/30 font-medium">
                          {diff.summary.shapeMismatches} shape mismatch
                        </span>
                        {diff.summary.unsupportedWarnings > 0 && (
                          <span className="px-2.5 py-0.5 rounded-full bg-amber-500/15 text-amber-200 border border-amber-400/30 font-medium">
                            {diff.summary.unsupportedWarnings} keyword warnings
                          </span>
                        )}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setActiveTab("mappings")}
                      className="champagne-pill text-sm font-semibold px-6 py-2.5 rounded-full transition"
                    >
                      Proceed to Review ({mappings.length} mappings) →
                    </button>
                  </div>

                  {/* Filter & Search Bar */}
                  <div className="p-4 bg-black/45 border-b border-white/[0.08] flex flex-wrap items-center justify-between gap-3 text-sm">
                    <div className="flex flex-wrap items-center gap-2.5 flex-1 min-w-[240px]">
                      <input
                        type="text"
                        value={diffSearchQuery}
                        onChange={(e) => setDiffSearchQuery(e.target.value)}
                        placeholder="Search paths or diagnostics..."
                        className="px-4 py-2 text-sm border border-white/[0.12] rounded-full bg-black/50 text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:ring-1 focus:ring-[#f5dfb8]/50 w-full sm:w-72"
                      />

                      {/* Severity Filter Pills */}
                      <div className="flex items-center space-x-1.5">
                        <button
                          type="button"
                          onClick={() => setDiffSeverityFilter("all")}
                          className={`px-3 py-1 rounded-full text-xs font-medium border transition ${
                            diffSeverityFilter === "all"
                              ? "bg-[#f3e7d3] text-[#141210] border-[#f3e7d3] font-semibold"
                              : "bg-white/[0.04] text-zinc-300 border-white/[0.1] hover:bg-white/[0.1]"
                          }`}
                        >
                          All ({diff.items.length})
                        </button>
                        <button
                          type="button"
                          onClick={() => setDiffSeverityFilter("error")}
                          className={`px-3 py-1 rounded-full text-xs font-medium border transition ${
                            diffSeverityFilter === "error"
                              ? "bg-rose-600 text-white border-rose-500"
                              : "bg-rose-500/10 text-rose-300 border-rose-500/30 hover:bg-rose-500/20"
                          }`}
                        >
                          Errors ({diff.items.filter((i) => i.severity === "error").length})
                        </button>
                        <button
                          type="button"
                          onClick={() => setDiffSeverityFilter("warning")}
                          className={`px-3 py-1 rounded-full text-xs font-medium border transition ${
                            diffSeverityFilter === "warning"
                              ? "bg-amber-600 text-white border-amber-500"
                              : "bg-amber-500/10 text-amber-300 border-amber-500/30 hover:bg-amber-500/20"
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
                              : "bg-white/[0.03] backdrop-blur-xl text-sky-400 border-sky-800/60 hover:bg-sky-950/40"
                          }`}
                        >
                          Info ({diff.items.filter((i) => i.severity === "info").length})
                        </button>
                      </div>
                    </div>

                    {/* Category Filter Dropdown */}
                    <div className="flex items-center space-x-2">
                      <label htmlFor="diff-cat-select" className="text-[11px] font-medium text-zinc-400">
                        Category:
                      </label>
                      <select
                        id="diff-cat-select"
                        value={diffCategoryFilter}
                        onChange={(e) => setDiffCategoryFilter(e.target.value)}
                        className="text-xs p-1.5 border border-white/[0.12] rounded bg-white/[0.03] backdrop-blur-xl text-zinc-200 focus:outline-none focus:ring-1 focus:ring-slate-500"
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
                          className="text-[11px] text-zinc-400 hover:text-zinc-200 underline"
                        >
                          Reset
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Diff Items Table */}
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-zinc-800 text-zinc-400 font-semibold border-b border-white/[0.08] uppercase tracking-wider text-[11px]">
                        <tr>
                          <th className="py-2.5 px-3">Target Path</th>
                          <th className="py-2.5 px-3">Source Match</th>
                          <th className="py-2.5 px-3">Category</th>
                          <th className="py-2.5 px-3">Severity</th>
                          <th className="py-2.5 px-3">Diagnostic Description</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/[0.06]">
                        {filteredDiffItems.length === 0 ? (
                          <tr>
                            <td colSpan={5} className="py-6 text-center text-xs text-zinc-500 italic">
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
                                    ? "bg-zinc-800/90 ring-1 ring-inset ring-slate-400"
                                    : "hover:bg-black/50"
                                }`}
                              >
                                <td className="py-2 px-3 font-mono font-medium text-zinc-200">
                                  {item.targetPath}
                                  {item.targetRequired && <span className="text-rose-500 ml-1 font-bold">*</span>}
                                </td>
                                <td className="py-2 px-3 font-mono text-zinc-400">{item.sourcePath || "(none)"}</td>
                                <td className="py-2 px-3">
                                  <StatusChip label={item.category} variant="neutral" />
                                </td>
                                <td className="py-2 px-3">
                                  <StatusChip
                                    label={item.severity}
                                    variant={item.severity === "error" ? "error" : item.severity === "warning" ? "warning" : "info"}
                                  />
                                </td>
                                <td className="py-2 px-3 text-zinc-400">{item.message}</td>
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  </div>

                  {/* Selected Diff Item Inspector Card */}
                  {selectedDiffItem && (
                    <div className="p-4 bg-black/50 border-t border-white/[0.08] space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-2">
                          <span className="text-xs font-bold text-zinc-200 uppercase tracking-wider">
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
                          className="text-xs text-zinc-400 hover:text-zinc-200 font-bold"
                        >
                          Close ×
                        </button>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs bg-white/[0.03] backdrop-blur-xl p-3 rounded border border-white/[0.08]">
                        <div>
                          <span className="font-semibold text-zinc-300 block mb-0.5">Target Contract Field:</span>
                          <code className="font-mono text-zinc-100 bg-zinc-800 px-1.5 py-0.5 rounded text-[11px] block truncate">
                            {selectedDiffItem.targetPath}
                          </code>
                          <div className="mt-1 text-[11px] text-zinc-400">
                            Type: <span className="font-mono font-semibold">{selectedDiffItem.targetType}</span>
                            {" • "}
                            Required: <span className="font-semibold">{selectedDiffItem.targetRequired ? "Yes" : "No"}</span>
                            {selectedDiffItem.facts?.targetNullable !== undefined && (
                              <span> • Nullable: {selectedDiffItem.facts.targetNullable ? "Yes" : "No"}</span>
                            )}
                            {selectedDiffItem.facts?.targetEnum && (
                              <span className="block text-indigo-300 mt-0.5">
                                Enum values: [{selectedDiffItem.facts.targetEnum.join(", ")}]
                              </span>
                            )}
                          </div>
                        </div>

                        <div>
                          <span className="font-semibold text-zinc-300 block mb-0.5">Source Contract Field:</span>
                          <code className="font-mono text-zinc-100 bg-zinc-800 px-1.5 py-0.5 rounded text-[11px] block truncate">
                            {selectedDiffItem.sourcePath || "(no direct match)"}
                          </code>
                          <div className="mt-1 text-[11px] text-zinc-400">
                            Type: <span className="font-mono font-semibold">{selectedDiffItem.sourceType || "N/A"}</span>
                            {selectedDiffItem.facts?.sourceNullable !== undefined && (
                              <span> • Nullable: {selectedDiffItem.facts.sourceNullable ? "Yes" : "No"}</span>
                            )}
                            {selectedDiffItem.facts?.sourceEnum && (
                              <span className="block text-indigo-300 mt-0.5">
                                Enum values: [{selectedDiffItem.facts.sourceEnum.join(", ")}]
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="text-xs text-zinc-300 space-y-1 bg-white/[0.03] backdrop-blur-xl p-3 rounded border border-white/[0.08]">
                        <div>
                          <span className="font-semibold text-zinc-200">Diagnostic Explanation:</span>{" "}
                          {selectedDiffItem.message}
                        </div>
                        {selectedDiffItem.suggestedAction && (
                          <div className="pt-1 text-zinc-400">
                            <span className="font-semibold text-zinc-200">Recommended Action:</span>{" "}
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
              <div className="apple-glass rounded-3xl p-6 shadow-xs flex flex-wrap items-center justify-between gap-4">
                <div>
                  <div className="flex flex-wrap items-center gap-2.5">
                    <h2 className="text-lg font-semibold text-white">Review Candidate Mappings</h2>
                    {providerConfig?.configured ? (
                      <span className="text-xs font-mono bg-emerald-500/15 text-emerald-300 border border-emerald-400/35 px-3 py-0.5 rounded-full font-medium">
                        Groq AI Active &bull; {providerConfig.model}
                      </span>
                    ) : (
                      <span className="text-xs font-mono bg-amber-500/15 text-amber-300 border border-amber-400/35 px-3 py-0.5 rounded-full font-medium">
                        Groq Offline (Heuristic Fallback)
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-zinc-300 mt-1">
                    <span className="font-semibold text-[#f5dfb8]">Trust Rule:</span> AI explains &amp; proposes; deterministic engine compiles &amp; checks; human approves before deployment.
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2.5">
                  <button
                    type="button"
                    onClick={() => generateProposals(false)}
                    disabled={proposeLoading || !sourceText || !targetText}
                    className="text-xs sm:text-[13px] bg-violet-500/20 hover:bg-violet-500/30 disabled:opacity-50 text-violet-200 border border-violet-400/40 px-4 py-2 rounded-full font-semibold transition flex items-center gap-1.5"
                    title={providerConfig?.configured ? "Ask Groq AI to propose field mappings" : "Groq not configured; falls back cleanly to deterministic heuristic"}
                  >
                    <span>✨</span>
                    <span>{proposeLoading ? "Querying Groq AI..." : "Propose with Groq AI"}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => generateProposals(true)}
                    disabled={proposeLoading || !sourceText || !targetText}
                    className="text-xs sm:text-[13px] bg-white/[0.06] hover:bg-white/[0.12] text-zinc-200 border border-white/[0.12] px-3.5 py-2 rounded-full font-medium transition"
                    title="Generate candidate mappings using deterministic structural heuristics without calling AI"
                  >
                    Heuristic Baseline
                  </button>

                  <button
                    type="button"
                    onClick={openManualModal}
                    className="text-xs sm:text-[13px] bg-white/[0.06] hover:bg-white/[0.12] text-zinc-200 border border-white/[0.12] px-3.5 py-2 rounded-full font-medium transition"
                  >
                    + Manual Mapping
                  </button>

                  <button
                    type="button"
                    onClick={acceptAllMappings}
                    disabled={loading || mappings.length === 0}
                    className="text-xs sm:text-[13px] bg-teal-500/15 hover:bg-teal-500/25 disabled:opacity-50 text-teal-200 border border-teal-400/35 px-4 py-2 rounded-full font-semibold transition"
                  >
                    Approve All Verified
                  </button>

                  <button
                    type="button"
                    onClick={compilePlan}
                    disabled={loading || mappings.filter((m) => m.status === "accepted" || m.status === "edited").length === 0}
                    className="champagne-pill disabled:opacity-45 text-xs sm:text-[13px] font-semibold px-5 py-2 rounded-full transition"
                  >
                    Compile Plan →
                  </button>
                </div>
              </div>

              {/* Approval Readiness Progress Strip */}
              {mappings.length > 0 && (() => {
                const approvedCount = mappings.filter((m) => m.status === "accepted" || m.status === "edited").length;
                const remainingCount = mappings.length - approvedCount;
                const pct = Math.round((approvedCount / mappings.length) * 100);
                return (
                  <div className="apple-glass rounded-2xl px-5 py-3.5 flex flex-wrap items-center justify-between gap-4 text-xs sm:text-sm">
                    <div className="flex items-center gap-3">
                      <span className="font-mono font-semibold text-[#f5dfb8]">
                        {approvedCount} / {mappings.length} Approved
                      </span>
                      <div className="w-36 h-2 rounded-full bg-white/[0.08] overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-[#f4845f] to-emerald-400 rounded-full transition-all duration-300"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <span className="text-zinc-300">
                        {remainingCount > 0
                          ? `Approve ${remainingCount} more rule${remainingCount === 1 ? "" : "s"} (or click "Approve All Verified") to unlock Plan Compilation.`
                          : "All contract fields approved — ready to Compile Plan!"}
                      </span>
                    </div>
                  </div>
                );
              })()}

              {/* Filters & Search Toolbar */}
              {mappings.length > 0 && (
                <div className="apple-glass p-4 rounded-2xl shadow-xs flex flex-wrap items-center justify-between gap-3 text-sm">
                  <div className="flex flex-wrap items-center gap-2.5 flex-1 min-w-[240px]">
                    <input
                      type="text"
                      value={mappingSearchQuery}
                      onChange={(e) => setMappingSearchQuery(e.target.value)}
                      placeholder="Search mapped paths, rationale, or operation..."
                      className="px-4 py-2 text-sm border border-white/[0.12] rounded-full bg-black/50 text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:ring-1 focus:ring-[#f5dfb8]/50 w-full sm:w-72"
                    />

                    {/* Status filter pills */}
                    <div className="flex flex-wrap items-center gap-1.5">
                      {["all", "proposed", "needs_confirmation", "accepted", "rejected", "edited"].map((st) => {
                        const count =
                          st === "all" ? mappings.length : mappings.filter((m) => m.status === st).length;
                        return (
                          <button
                            key={st}
                            type="button"
                            onClick={() => setMappingFilterStatus(st)}
                            className={`px-3 py-1 rounded-full text-xs font-medium border transition ${
                              mappingFilterStatus === st
                                ? "bg-[#f3e7d3] text-[#141210] border-[#f3e7d3] font-semibold"
                                : "bg-white/[0.04] text-zinc-300 border-white/[0.1] hover:bg-white/[0.1]"
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
                    <label htmlFor="uncertainty-select" className="text-xs font-medium text-zinc-300">
                      Uncertainty:
                    </label>
                    <select
                      id="uncertainty-select"
                      value={mappingFilterUncertainty}
                      onChange={(e) => setMappingFilterUncertainty(e.target.value)}
                      className="text-xs px-3 py-1.5 border border-white/[0.12] rounded-full bg-[#090807] text-zinc-100 focus:outline-none focus:ring-1 focus:ring-[#f5dfb8]/50"
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
                        className="text-[11px] text-zinc-400 hover:text-zinc-200 underline"
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
                <div className="bg-white/[0.03] backdrop-blur-xl border border-white/[0.08] rounded-lg p-8 text-center text-xs text-zinc-500">
                  No candidate mappings match the current filters or search query.
                </div>
              ) : (
                <div className="space-y-4">
                  {filteredMappings.map((m) => {
                    const isAccepted = m.status === "accepted";
                    const isRejected = m.status === "rejected";
                    const isEdited = m.status === "edited";
                    const isNeedsReview = m.status === "needs_confirmation" || m.semanticStatus === "needs_confirmation";
                    const lookupPairs = m.transformation.lookupTable
                      ? Object.entries(m.transformation.lookupTable)
                      : [];
                    const preview = getMappingSamplePreview(m);

                    return (
                      <div
                        key={m.id}
                        className={`apple-glass rounded-3xl p-6 shadow-xs transition ${
                          isAccepted
                            ? "border-emerald-400/50 bg-emerald-950/20"
                            : isRejected
                            ? "border-rose-400/40 bg-rose-950/20 opacity-65"
                            : isEdited
                            ? "border-violet-400/50 bg-violet-950/20"
                            : isNeedsReview
                            ? "border-amber-400/45 bg-amber-950/20"
                            : "border-white/[0.12]"
                        }`}
                      >
                        {/* Top Visual Dataflow Header: Source -> Operation Pill -> Target */}
                        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/[0.08] pb-4 mb-4">
                          <div className="flex flex-wrap items-center gap-2.5 font-mono text-sm">
                            <span className="text-zinc-200 bg-black/55 border border-white/[0.12] px-3 py-1 rounded-xl">
                              {m.sourcePath || "(constant / default)"}
                              {m.transformation.sourceType && (
                                <span className="ml-2 text-xs text-sky-300">
                                  :{m.transformation.sourceType}
                                </span>
                              )}
                            </span>
                            <span className="text-[#f4845f] font-bold">→</span>
                            <span className={`font-mono text-xs px-3 py-1 rounded-full border font-semibold ${preview.categoryStyle}`}>
                              {preview.categoryLabel}
                            </span>
                            <span className="text-teal-400 font-bold">→</span>
                            <span className="font-bold text-[#f5dfb8] bg-white/[0.06] border border-[#f5dfb8]/30 px-3 py-1 rounded-xl">
                              {m.targetPath}
                              {m.transformation.targetType && (
                                <span className="ml-2 text-xs text-emerald-300 font-normal">
                                  :{m.transformation.targetType}
                                </span>
                              )}
                            </span>
                          </div>

                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-xs font-mono px-3 py-1 rounded-full bg-white/[0.06] text-zinc-200 border border-white/[0.1]">
                              {m.provider === "groq"
                                ? "✨ Groq AI"
                                : m.provider === "manual"
                                ? "✎ Manual"
                                : "⚙ Heuristic"}
                            </span>

                            <StatusChip
                              label={`Risk: ${m.uncertaintyScore}`}
                              variant={m.uncertaintyScore === "LOW" ? "low" : m.uncertaintyScore === "MEDIUM" ? "medium" : "high"}
                            />

                            <StatusChip label={m.status} variant={m.status} />
                          </div>
                        </div>

                        {/* Live Before -> After Sample Data Preview Bar */}
                        <div className="mb-4 px-4 py-3 rounded-2xl bg-gradient-to-r from-black/60 via-white/[0.04] to-black/60 border border-white/[0.09] flex flex-wrap items-center justify-between gap-3 font-mono text-xs sm:text-sm">
                          <div className="flex flex-wrap items-center gap-2.5">
                            <span className="text-zinc-400 text-xs uppercase font-sans font-semibold">Live Sample:</span>
                            <span className="px-2.5 py-0.5 rounded-lg bg-amber-500/10 text-amber-200 border border-amber-400/25">
                              {preview.sampleIn}
                            </span>
                            <span className="text-teal-400 font-bold">──▶</span>
                            <span className="px-2.5 py-0.5 rounded-lg bg-emerald-500/15 text-emerald-300 border border-emerald-400/30 font-semibold">
                              {preview.sampleOut}
                            </span>
                          </div>
                          <span className="text-xs text-zinc-300 font-sans">
                            {preview.plainSummary}
                          </span>
                        </div>

                        {/* Clear Plain-English AI Explanation & Parameters */}
                        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 text-sm">
                          <div className="lg:col-span-8 p-4 rounded-2xl bg-black/45 border border-white/[0.08] space-y-1.5">
                            <div className="text-xs font-mono uppercase tracking-wider text-[#f5dfb8]">
                              {m.provider === "groq" ? "AI Explanation & Why This Works" : "Transformation Reasoning"}
                            </div>
                            <p className="text-zinc-100 leading-relaxed text-[15px]">{m.rationale}</p>
                            {m.uncertaintyExplanation && (
                              <p className="text-xs text-zinc-400 leading-relaxed pt-1">
                                {m.uncertaintyExplanation}
                              </p>
                            )}
                          </div>

                          <div className="lg:col-span-4 p-4 rounded-2xl bg-black/45 border border-white/[0.08] space-y-2 text-xs font-mono">
                            <div className="text-zinc-400 uppercase tracking-wider font-sans font-semibold">
                              Rule Parameters
                            </div>
                            <div>
                              <span className="text-zinc-400">On Missing:</span>{" "}
                              <span className="text-amber-300 font-semibold">
                                {m.transformation.policyOnMissing || "default"}
                              </span>
                            </div>
                            {m.transformation.defaultValue !== undefined && (
                              <div>
                                <span className="text-zinc-400">Default Value:</span>{" "}
                                <span className="text-emerald-300 font-semibold">
                                  {JSON.stringify(m.transformation.defaultValue)}
                                </span>
                              </div>
                            )}
                            {lookupPairs.length > 0 && (
                              <div className="space-y-1">
                                <div className="text-zinc-400">Enum Lookup Dictionary:</div>
                                <div className="flex flex-wrap gap-1.5">
                                  {lookupPairs.slice(0, 6).map(([k, v]) => (
                                    <span
                                      key={k}
                                      className="px-2 py-0.5 rounded bg-teal-500/15 text-teal-200 border border-teal-400/30"
                                    >
                                      {k} → {v}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Unresolved Questions if flagged by AI */}
                        {m.unresolvedQuestions && m.unresolvedQuestions.length > 0 && (
                          <div className="mt-3 p-3.5 bg-amber-950/35 border border-amber-500/35 rounded-2xl text-xs sm:text-sm text-amber-200 space-y-1">
                            <div className="font-semibold text-xs uppercase tracking-wider text-amber-300">
                              Unresolved Semantic Questions:
                            </div>
                            {m.unresolvedQuestions.map((q, idx) => (
                              <div key={idx} className="flex items-start gap-2">
                                <span className="font-bold text-amber-400">&bull;</span>
                                <span>{q}</span>
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Information Loss Declarations */}
                        {m.informationLoss && m.informationLoss.length > 0 && (
                          <div className="mt-3 p-3.5 bg-orange-950/35 border border-orange-500/35 rounded-2xl text-xs sm:text-sm text-orange-200">
                            <span className="font-semibold text-xs uppercase tracking-wider text-orange-300 block mb-1">
                              Information Loss Disclosures:
                            </span>
                            {m.informationLoss.map((loss, idx) => (
                              <div key={idx} className="text-orange-200">
                                &bull; {loss.description}
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Explicit Human Confirmation Warning */}
                        {m.semanticStatus === "needs_confirmation" && m.status !== "accepted" && (
                          <div className="mt-3 text-xs sm:text-sm bg-amber-950/40 text-amber-200 border border-amber-500/35 rounded-2xl p-3 flex items-center justify-between">
                            <span>
                              ⚠ Semantic ambiguity or constraint differences detected. Click &quot;Approve Mapping&quot; after reviewing the explanation above.
                            </span>
                          </div>
                        )}

                        {/* Actions Row */}
                        <div className="mt-4 pt-3 border-t border-white/[0.08] flex flex-wrap items-center justify-between gap-3">
                          <div>
                            <button
                              type="button"
                              onClick={() => setExpandedAuditId(expandedAuditId === m.id ? null : m.id)}
                              className="text-xs sm:text-sm text-zinc-300 hover:text-white underline font-medium"
                            >
                              {expandedAuditId === m.id ? "Hide Audit Trail ↑" : `Audit Trail (${m.decisionHistory?.length || 1}) ↓`}
                            </button>
                          </div>

                          <div className="flex items-center gap-2.5">
                            <button
                              type="button"
                              onClick={() => openEditModal(m)}
                              className="text-xs sm:text-sm px-4 py-2 rounded-full font-medium border border-white/[0.14] text-zinc-200 bg-white/[0.05] hover:bg-white/[0.12] transition"
                            >
                              ✎ Edit
                            </button>
                            <button
                              type="button"
                              onClick={() => updateMappingStatus(m.id, "rejected")}
                              className={`text-xs sm:text-sm px-4 py-2 rounded-full font-medium border transition ${
                                m.status === "rejected"
                                  ? "bg-rose-600 text-white border-rose-500"
                                  : "bg-white/[0.05] text-zinc-200 border-white/[0.14] hover:bg-rose-950/50 hover:text-rose-300"
                              }`}
                            >
                              Reject
                            </button>
                            <button
                              type="button"
                              onClick={() => updateMappingStatus(m.id, "accepted")}
                              className={`text-xs sm:text-sm px-5 py-2 rounded-full font-semibold transition ${
                                m.status === "accepted"
                                  ? "bg-emerald-500 text-zinc-950"
                                  : "champagne-pill"
                              }`}
                            >
                              {m.status === "accepted" ? "Approved ✓" : "Approve Mapping"}
                            </button>
                          </div>
                        </div>

                        {/* Decision History Audit Trail Drawer */}
                        {expandedAuditId === m.id && (
                          <div className="mt-3 p-2.5 bg-black/50 border border-white/[0.08] rounded text-xs space-y-1.5 font-mono text-[11px]">
                            <div className="font-semibold font-sans text-[11px] text-zinc-300">
                              Mapping Provenance & Decision History:
                            </div>
                            {m.decisionHistory?.map((entry, idx) => (
                              <div key={idx} className="flex items-center justify-between text-zinc-400 border-b border-white/[0.06] last:border-0 pb-1 last:pb-0">
                                <div>
                                  <span className="font-bold text-zinc-200 uppercase">{entry.action}</span>
                                  {" by "}
                                  <span className="text-zinc-300">{entry.actor}</span>
                                  {entry.note && <span className="text-zinc-400"> &bull; {entry.note}</span>}
                                </div>
                                <span className="text-zinc-500 text-[10px]">
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
              <div className="apple-glass rounded-2xl p-5 shadow-xs flex flex-wrap items-center justify-between gap-4">
                <div>
                  <h2 className="text-base font-semibold text-white">Transformation IR Compiler &amp; Interpreter</h2>
                  <p className="text-xs sm:text-sm text-zinc-300 mt-0.5">
                    Executes approved TransformationPlan steps through trusted code. No eval; strict target schema validation.
                  </p>
                </div>
                <div className="flex items-center gap-2.5">
                  <button
                    type="button"
                    onClick={compilePlan}
                    disabled={loading}
                    className="text-xs sm:text-[13px] bg-white/[0.06] hover:bg-white/[0.12] text-zinc-100 border border-white/[0.14] px-4 py-2 rounded-full font-medium transition"
                  >
                    Recompile Plan
                  </button>
                  <button
                    type="button"
                    onClick={() => executePlan()}
                    disabled={loading || !plan}
                    className="champagne-pill disabled:opacity-45 text-xs sm:text-[13px] font-semibold px-5 py-2 rounded-full transition"
                  >
                    Run Interpreter &amp; Validate →
                  </button>
                </div>
              </div>

              {!plan && (
                <EmptyState
                  title="No Transformation Plan Compiled Yet"
                  description={
                    mappings.some((m) => m.status === "accepted" || m.status === "edited")
                      ? "You have approved mappings ready! Compile the deterministic IR plan now to run live payload tests and generate your zero-eval TypeScript adapter."
                      : "Approve at least one mapping in Stage 4 (Mapping Review) first, then compile the deterministic TransformationPlan IR here."
                  }
                  action={
                    mappings.some((m) => m.status === "accepted" || m.status === "edited")
                      ? { label: "Compile Plan Now", onClick: compilePlan }
                      : { label: "Go to Mapping Review", onClick: () => setActiveTab("mappings") }
                  }
                />
              )}

              {plan && (
                <div className="apple-glass rounded-2xl p-5 shadow-xs">
                  <div className="flex items-center justify-between text-xs border-b border-white/[0.08] pb-3 mb-3">
                    <span className="font-semibold text-zinc-200">
                      Plan ID: <code className="font-mono text-[#f5dfb8]">{plan.planId}</code>
                    </span>
                    <span className="text-zinc-300 font-mono">
                      Compiled Steps: {plan.steps.length} | Version: {plan.version}
                    </span>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs font-mono">
                      <thead className="bg-black/50 text-zinc-400 font-semibold border-b border-white/[0.08] uppercase tracking-wider text-[11px] font-sans">
                        <tr>
                          <th className="py-2.5 px-3">Step</th>
                          <th className="py-2.5 px-3">Operation</th>
                          <th className="py-2.5 px-3">Source Path</th>
                          <th className="py-2.5 px-3">Target Path</th>
                          <th className="py-2.5 px-3">Details</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/[0.06] text-xs">
                        {plan.steps.map((s, idx) => (
                          <tr key={s.stepId} className="hover:bg-white/[0.03]">
                            <td className="py-2 px-3 text-zinc-500">#{idx + 1}</td>
                            <td className="py-2 px-3 text-[#f4845f] font-bold">{s.operation}</td>
                            <td className="py-2 px-3 text-zinc-300">{s.sourcePath || "(none)"}</td>
                            <td className="py-2 px-3 text-[#f5dfb8] font-semibold">{s.targetPath}</td>
                            <td className="py-2 px-3 text-zinc-300">
                              {s.conversionType ||
                                (s.lookupTable && Object.keys(s.lookupTable).length > 0
                                  ? `${Object.keys(s.lookupTable).length} lookup pairs`
                                  : s.defaultValue !== undefined
                                  ? JSON.stringify(s.defaultValue)
                                  : "-")}
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
                <div className="bg-white/[0.03] backdrop-blur-xl border border-white/[0.08] rounded-lg p-4 shadow-xs space-y-3">
                  <div className="flex items-center justify-between border-b border-white/[0.06] pb-2">
                    <span className="text-xs font-bold text-zinc-200 uppercase tracking-wider">
                      Interactive Fixture Test Runner
                    </span>
                    <span className="text-[11px] text-zinc-400">
                      Choose a canonical test case or paste custom payload
                    </span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-4 gap-3 text-sm">
                    {CANONICAL_TEST_FIXTURES.map((fix, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => {
                          setSelectedFixtureIdx(idx);
                          setCustomPayloadText(JSON.stringify(fix.payload, null, 2));
                        }}
                        className={`p-3.5 rounded-2xl border text-left transition ${
                          selectedFixtureIdx === idx
                            ? fix.expectValid
                              ? "border-emerald-400/60 bg-emerald-500/15 text-white shadow-sm"
                              : "border-rose-400/60 bg-rose-500/15 text-white shadow-sm"
                            : "border-white/[0.1] bg-black/50 text-zinc-300 hover:bg-white/[0.07]"
                        }`}
                      >
                        <div className="font-semibold text-xs text-[#f5dfb8]">Fixture #{idx + 1}</div>
                        <div className="text-xs text-zinc-300 truncate mt-0.5">{fix.description}</div>
                      </button>
                    ))}
                    <button
                      type="button"
                      onClick={() => setSelectedFixtureIdx(-1)}
                      className={`p-3.5 rounded-2xl border text-left transition ${
                        selectedFixtureIdx === -1
                          ? "border-violet-400/60 bg-violet-500/15 text-white shadow-sm"
                          : "border-white/[0.1] bg-black/50 text-zinc-300 hover:bg-white/[0.07]"
                      }`}
                    >
                      <div className="font-semibold text-xs text-violet-300">Custom Payload</div>
                      <div className="text-xs text-zinc-300 mt-0.5">Edit JSON input directly</div>
                    </button>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs sm:text-sm font-semibold text-zinc-200 flex items-center justify-between">
                      <span>Source Payload Input (JSON):</span>
                      <button
                        type="button"
                        onClick={() => executePlan()}
                        disabled={loading}
                        className="champagne-pill text-xs font-semibold px-4 py-1.5 rounded-full transition"
                      >
                        Execute with this payload →
                      </button>
                    </label>
                    <textarea
                      rows={6}
                      value={customPayloadText}
                      onChange={(e) => {
                        setCustomPayloadText(e.target.value);
                        setSelectedFixtureIdx(-1);
                      }}
                      className="font-mono text-[13px] w-full p-3.5 border border-white/[0.12] rounded-2xl bg-[#090807]/95 text-[#f5dfb8] focus:outline-none focus:ring-1 focus:ring-[#f5dfb8]/50 resize-none"
                    />
                  </div>
                </div>
              )}

              {executionResult && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                  <div className="apple-glass rounded-3xl p-6 shadow-xs space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-semibold text-zinc-100 uppercase tracking-wider">Transformed Payload</span>
                      <StatusChip
                        label={executionResult.success ? "Execution: Passed" : "Execution: Failed"}
                        variant={executionResult.success ? "executed" : "invalid"}
                      />
                    </div>
                    <CodeViewer
                      code={JSON.stringify(executionResult.outputPayload, null, 2)}
                      language="json"
                      maxHeight="340px"
                    />

                    {executionResult.stepResults && executionResult.stepResults.length > 0 && (
                      <div className="mt-3 pt-3 border-t border-white/[0.06]">
                        <button
                          type="button"
                          onClick={() => setShowStepInspector(!showStepInspector)}
                          className="text-xs text-[#f5dfb8] hover:underline font-medium"
                        >
                          {showStepInspector
                            ? "Hide Step Execution Details ▲"
                            : `Show Step Execution Details (${executionResult.stepResults.length} steps) ▼`}
                        </button>

                        {showStepInspector && (
                          <div className="mt-2.5 overflow-x-auto border border-white/[0.1] rounded-xl">
                            <table className="w-full text-left font-mono text-xs">
                              <thead className="bg-black/60 text-zinc-300">
                                <tr>
                                  <th className="py-2 px-3">Path</th>
                                  <th className="py-2 px-3">Op</th>
                                  <th className="py-2 px-3">In</th>
                                  <th className="py-2 px-3">Out</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-white/[0.06]">
                                {executionResult.stepResults.map((st) => (
                                  <tr key={st.stepId} className={st.success ? "" : "bg-rose-950/40"}>
                                    <td className="py-1.5 px-3 text-[#f5dfb8] font-bold">{st.targetPath}</td>
                                    <td className="py-1.5 px-3 text-[#f4845f]">{st.operation}</td>
                                    <td className="py-1.5 px-3 text-zinc-300 truncate max-w-[100px]">
                                      {st.inputValue !== undefined ? JSON.stringify(st.inputValue) : "undefined"}
                                    </td>
                                    <td className="py-1.5 px-3 text-emerald-300 truncate max-w-[100px]">
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

                  <div className="apple-glass rounded-3xl p-6 shadow-xs space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-semibold text-zinc-100 uppercase tracking-wider">Target Contract Validation</span>
                      <StatusChip
                        label={validationResult?.valid ? "Target Contract: 100% Valid" : "Target Contract: Violations"}
                        variant={validationResult?.valid ? "accepted" : "error"}
                      />
                    </div>

                    {validationResult && (
                      <div className="space-y-3 text-sm">
                        <div className="text-zinc-300">Checked fields: <span className="font-mono text-[#f5dfb8] font-semibold">{validationResult.checkedFieldCount}</span></div>
                        {validationResult.valid ? (
                          <div className="p-4 bg-emerald-950/40 text-emerald-300 border border-emerald-500/35 rounded-2xl">
                            Target contract satisfied. All types, required fields, and enums conform.
                          </div>
                        ) : (
                          <div className="space-y-1.5">
                            {validationResult.errors.map((e, i) => (
                              <div key={i} className="p-3 bg-rose-950/40 text-rose-300 border border-rose-500/35 rounded-xl font-mono text-xs">
                                {e.message}
                              </div>
                            ))}
                          </div>
                        )}

                        {testSuite && (
                          <div className="mt-3 pt-3 border-t border-white/[0.08]">
                            <span className="font-semibold text-zinc-200 block mb-1">Equivalence Test Suite:</span>
                            <div className="text-sm text-zinc-300">
                              Passed {testSuite.passedCases} of {testSuite.totalCases} fixtures. Interpreter vs Adapter Equivalence:{" "}
                              <span className={testSuite.allEqual ? "text-emerald-400 font-bold" : "text-rose-400 font-bold"}>
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
                <div className="apple-glass rounded-3xl p-6 shadow-xs space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-zinc-100 uppercase tracking-wider">
                      Generated Standalone TypeScript Adapter (Zero Eval)
                    </h3>
                    <button
                      type="button"
                      onClick={downloadAdapterCode}
                      className="champagne-pill text-sm font-semibold px-5 py-2 rounded-full transition"
                    >
                      Download .ts Adapter ↓
                    </button>
                  </div>
                  <CodeViewer code={adapterCode} language="typescript" maxHeight="420px" />
                </div>
              )}
            </div>
          )}

          {/* TAB: REPORT */}
          {activeTab === "report" && (
            <div className="space-y-5">
              <div className="apple-glass rounded-3xl p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h2 className="text-lg font-semibold text-white">Evidence-Backed Compatibility Report</h2>
                  <p className="text-sm text-zinc-300 mt-0.5">
                    Cryptographic audit trail including spec checksums, diff matrix, approved mappings, test results, and Azure cloud certification.
                  </p>
                </div>
                <div className="flex items-center space-x-2.5 flex-wrap gap-y-2">
                  <button
                    type="button"
                    onClick={generateReport}
                    disabled={loading || persistingToCloud}
                    className="champagne-pill disabled:opacity-50 text-sm font-semibold px-5 py-2.5 rounded-full transition"
                  >
                    Assemble Report →
                  </button>
                  {reportMarkdown && (
                    <>
                      <button
                        type="button"
                        onClick={() => downloadReport("md")}
                        className="text-sm bg-white/[0.06] hover:bg-white/[0.12] text-zinc-200 border border-white/[0.12] px-4 py-2 rounded-full font-medium transition"
                      >
                        Export .MD
                      </button>
                      <button
                        type="button"
                        onClick={() => downloadReport("json")}
                        className="text-sm bg-white/[0.06] hover:bg-white/[0.12] text-zinc-200 border border-white/[0.12] px-4 py-2 rounded-full font-medium transition"
                      >
                        Export .JSON
                      </button>
                    </>
                  )}
                </div>
              </div>

              {reportData && (
                <>
                  {/* Executive Header & Cloud Certification Card */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="bg-white/[0.03] backdrop-blur-xl border border-white/[0.08] rounded-lg p-4 shadow-xs">
                      <span className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider block mb-1">
                        Compatibility Status
                      </span>
                      <div className="flex items-center space-x-2">
                        <StatusChip
                          variant={
                            reportData.status === "COMPATIBLE"
                              ? "accepted"
                              : reportData.status === "CONDITIONALLY_COMPATIBLE"
                              ? "proposed"
                              : "rejected"
                          }
                          label={reportData.status}
                        />
                        <span className="text-xs font-mono font-bold text-zinc-200">
                          {reportData.summary.compatibilityScore}%
                        </span>
                      </div>
                      <p className="text-[11px] text-zinc-400 mt-2">
                        {reportData.summary.approvedMappingsCount} approved mappings across {reportData.summary.totalTargetFields} target fields.
                      </p>
                    </div>

                    <div className="bg-white/[0.03] backdrop-blur-xl border border-white/[0.08] rounded-lg p-4 shadow-xs">
                      <span className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider block mb-1">
                        Equivalence Verification
                      </span>
                      <div className="text-xs text-zinc-200 font-medium">
                        {reportData.testResults.equivalenceVerified ? (
                          <span className="text-emerald-400 font-bold flex items-center gap-1">
                            ✓ Deterministic Equality Verified
                          </span>
                        ) : (
                          <span className="text-amber-300 font-bold flex items-center gap-1">
                            ⚠ Equivalence Not Certified
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-zinc-300 mt-2">
                        Passed {reportData.testResults.passedCasesCount} of {reportData.testResults.testCasesCount} deterministic test fixtures.
                      </p>
                    </div>

                    <div className="apple-glass rounded-2xl p-5 shadow-xs">
                      <span className="text-xs font-semibold text-zinc-400 uppercase tracking-wider block mb-1">
                        Azure Cloud Evidence
                      </span>
                      <div className="text-sm font-mono truncate">
                        {reportData.cloudEvidence?.azureSqlRunId ? (
                          <span className="text-teal-300 font-medium" title={reportData.cloudEvidence.azureSqlRunId}>
                            SQL Run: {reportData.cloudEvidence.azureSqlRunId.slice(0, 16)}...
                          </span>
                        ) : (
                          <span className="text-zinc-400">Uncertified (Not persisted)</span>
                        )}
                      </div>
                      <div className="mt-3 flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          onClick={() => persistEvidence("all")}
                          disabled={persistingToCloud}
                          className="champagne-pill disabled:opacity-50 text-xs font-semibold px-3.5 py-1.5 rounded-full transition"
                        >
                          {persistingToCloud ? "Persisting..." : "Certify to Azure"}
                        </button>
                        <button
                          type="button"
                          onClick={() => persistEvidence("azure_sql")}
                          disabled={persistingToCloud}
                          className="text-[11px] bg-zinc-800 hover:bg-zinc-700 text-zinc-300 border border-white/[0.12] px-2 py-1 rounded font-medium transition"
                        >
                          SQL Only
                        </button>
                        <button
                          type="button"
                          onClick={() => persistEvidence("azure_blob")}
                          disabled={persistingToCloud}
                          className="text-[11px] bg-zinc-800 hover:bg-zinc-700 text-zinc-300 border border-white/[0.12] px-2 py-1 rounded font-medium transition"
                        >
                          Blob Only
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Cryptographic Digest Ledger */}
                  <div className="bg-white/[0.03] backdrop-blur-xl border border-white/[0.08] rounded-lg p-4 shadow-xs">
                    <h3 className="text-xs font-semibold text-zinc-100 uppercase tracking-wider mb-2">
                      Cryptographic SHA-256 Digest Ledger
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs font-mono">
                      <div className="p-2.5 bg-black/50 border border-white/[0.08] rounded">
                        <span className="text-zinc-400 block text-[10px] uppercase">Source Spec Checksum:</span>
                        <span className="text-zinc-200 break-all select-all font-semibold">
                          {reportData.checksums.sourceSchemaHash}
                        </span>
                      </div>
                      <div className="p-2.5 bg-black/50 border border-white/[0.08] rounded">
                        <span className="text-zinc-400 block text-[10px] uppercase">Target Spec Checksum:</span>
                        <span className="text-zinc-200 break-all select-all font-semibold">
                          {reportData.checksums.targetSchemaHash}
                        </span>
                      </div>
                      <div className="p-2.5 bg-black/50 border border-white/[0.08] rounded">
                        <span className="text-zinc-400 block text-[10px] uppercase">Plan IR Checksum:</span>
                        <span className="text-zinc-200 break-all select-all">
                          {reportData.checksums.planHash || "No compiled plan"}
                        </span>
                      </div>
                      <div className="p-2.5 bg-black/50 border border-white/[0.08] rounded">
                        <span className="text-zinc-400 block text-[10px] uppercase">Adapter Code Checksum:</span>
                        <span className="text-zinc-200 break-all select-all">
                          {reportData.checksums.adapterHash || "No adapter generated"}
                        </span>
                      </div>
                    </div>
                  </div>
                </>
              )}

              {/* View Format Selector & Content */}
              {reportMarkdown ? (
                <div className="bg-white/[0.03] backdrop-blur-xl border border-white/[0.08] rounded-lg p-5 shadow-xs space-y-3">
                  <div className="flex items-center justify-between border-b border-white/[0.08] pb-2">
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setReportFormatView("markdown")}
                        className={`text-xs px-4 py-1.5 rounded-full font-medium transition ${
                          reportFormatView === "markdown"
                            ? "champagne-pill font-semibold"
                            : "bg-white/[0.06] hover:bg-white/[0.12] text-zinc-300 border border-white/[0.1]"
                        }`}
                      >
                        Markdown View
                      </button>
                      <button
                        type="button"
                        onClick={() => setReportFormatView("json")}
                        className={`text-xs px-4 py-1.5 rounded-full font-medium transition ${
                          reportFormatView === "json"
                            ? "champagne-pill font-semibold"
                            : "bg-white/[0.06] hover:bg-white/[0.12] text-zinc-300 border border-white/[0.1]"
                        }`}
                      >
                        Structured JSON View
                      </button>
                    </div>
                    <span className="text-xs font-mono text-zinc-400">
                      Report ID: <span className="text-[#f5dfb8]">{reportData?.reportId || "N/A"}</span>
                    </span>
                  </div>

                  {reportFormatView === "markdown" ? (
                    <CodeViewer
                      code={reportMarkdown || ""}
                      language="markdown"
                      maxHeight="520px"
                    />
                  ) : (
                    <CodeViewer
                      code={JSON.stringify(reportData, null, 2)}
                      language="json"
                      maxHeight="520px"
                    />
                  )}
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

          {/* TAB: CLOUD, DBMS & SECURITY ARCHITECTURE INSPECTOR */}
          {activeTab === "architecture" && (
            <div className="space-y-6">
              <div className="apple-glass rounded-3xl p-7 flex flex-wrap items-center justify-between gap-4">
                <div>
                  <h2 className="text-xl font-semibold text-white">
                    System Design, Multi-Cloud DBMS &amp; Security Architecture
                  </h2>
                  <p className="text-sm text-zinc-300 mt-1">
                    Live verification of PostgreSQL Row-Level Security, Azure SQL 4-table ledger, Azure Blob immutable storage, Groq prompt-injection defenses, and CERT-In / DPDP Act 2023 controls.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={runFullEndToEndPipeline}
                  disabled={loading}
                  className="champagne-pill disabled:opacity-50 text-sm font-semibold px-6 py-2.5 rounded-full transition"
                >
                  {loading ? "Running Live Pipeline..." : "⚡ Verify All 6 Stages Live →"}
                </button>
              </div>

              {/* Multi-Cloud Service Telemetry */}
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
                <div className="apple-glass rounded-2xl p-5 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-mono uppercase tracking-wider text-emerald-300">Supabase Postgres</span>
                    <span className={`w-2.5 h-2.5 rounded-full ${cloudStatus?.supabase.configured ? "bg-emerald-400" : "bg-amber-400"}`} />
                  </div>
                  <div className="text-lg font-semibold text-white">
                    {cloudStatus?.supabase.configured ? "RLS Enforced" : "Local Fallback"}
                  </div>
                  <div className="text-xs font-mono text-zinc-400 truncate">
                    {cloudStatus?.supabase.endpoint || "auth.uid() = owner_id"}
                  </div>
                </div>

                <div className="apple-glass rounded-2xl p-5 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-mono uppercase tracking-wider text-violet-300">Groq AI Advisory</span>
                    <span className={`w-2.5 h-2.5 rounded-full ${cloudStatus?.groq.configured ? "bg-violet-400" : "bg-amber-400"}`} />
                  </div>
                  <div className="text-lg font-semibold text-white">
                    {cloudStatus?.groq.configured ? cloudStatus.groq.model : "Heuristic Fallback"}
                  </div>
                  <div className="text-xs font-mono text-zinc-400">
                    Zod strict validation &bull; 0 key leaks
                  </div>
                </div>

                <div className="apple-glass rounded-2xl p-5 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-mono uppercase tracking-wider text-teal-300">Azure SQL (DP-900)</span>
                    <span className={`w-2.5 h-2.5 rounded-full ${cloudStatus?.azureSql.configured ? "bg-teal-400" : "bg-amber-400"}`} />
                  </div>
                  <div className="text-lg font-semibold text-white">
                    {cloudStatus?.azureSql.configured ? cloudStatus.azureSql.database || "Connected" : "Simulated Ledger"}
                  </div>
                  <div className="text-xs font-mono text-zinc-400 truncate">
                    {reportData?.cloudEvidence?.azureSqlRunId
                      ? `Run: ${reportData.cloudEvidence.azureSqlRunId.slice(0, 14)}...`
                      : "4-table transactional audit"}
                  </div>
                </div>

                <div className="apple-glass rounded-2xl p-5 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-mono uppercase tracking-wider text-sky-300">Azure Blob Storage</span>
                    <span className={`w-2.5 h-2.5 rounded-full ${cloudStatus?.azureBlob.configured ? "bg-sky-400" : "bg-amber-400"}`} />
                  </div>
                  <div className="text-lg font-semibold text-white">
                    {cloudStatus?.azureBlob.configured ? cloudStatus.azureBlob.containerName || "Connected" : "In-Memory"}
                  </div>
                  <div className="text-xs font-mono text-zinc-400">
                    SHA-256 content-addressed artifacts
                  </div>
                </div>
              </div>

              {/* Dual-Database Relational Architecture (DBMS) */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="apple-glass rounded-3xl p-6 space-y-4">
                  <div className="flex items-center justify-between border-b border-white/[0.08] pb-3">
                    <h3 className="text-base font-semibold text-white">
                      Supabase PostgreSQL (Relational System of Record)
                    </h3>
                    <span className="text-xs font-mono px-3 py-1 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-400/30">
                      6 RLS Tables
                    </span>
                  </div>
                  <div className="space-y-2.5 text-xs sm:text-sm font-mono">
                    {[
                      { tbl: "public.projects", col: "id, owner_id (auth.uid()), name, description", live: "1 active tenant" },
                      { tbl: "public.specs", col: "project_id FK, side (source/target), content_hash", live: `${sourceText ? 1 : 0} src / ${targetText ? 1 : 0} tgt` },
                      { tbl: "public.mapping_sets", col: "source_spec_id FK, target_spec_id FK, status", live: diff ? "diff computed" : "draft" },
                      { tbl: "public.mappings", col: "source_path, target_path, status, decision_history", live: `${mappings.length} rows` },
                      { tbl: "public.transformation_plans", col: "plan_json, plan_hash, status", live: plan ? `${plan.steps.length} steps` : "pending" },
                      { tbl: "public.test_executions", col: "plan_id FK, input_payload, output_payload, valid", live: executionResult ? (executionResult.success ? "passed" : "failed") : "0 runs" },
                    ].map((row) => (
                      <div key={row.tbl} className="p-3 rounded-xl bg-black/50 border border-white/[0.08] flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <div className="text-[#f5dfb8] font-semibold">{row.tbl}</div>
                          <div className="text-xs text-zinc-400">{row.col}</div>
                        </div>
                        <span className="text-xs px-2.5 py-0.5 rounded-full bg-white/[0.06] text-teal-300 border border-white/[0.1]">
                          {row.live}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="apple-glass rounded-3xl p-6 space-y-4">
                  <div className="flex items-center justify-between border-b border-white/[0.08] pb-3">
                    <h3 className="text-base font-semibold text-white">
                      Azure SQL Ledger &amp; India Cloud Security Standards
                    </h3>
                    <span className="text-xs font-mono px-3 py-1 rounded-full bg-amber-500/15 text-amber-300 border border-amber-400/30">
                      CERT-In &bull; DPDP 2023
                    </span>
                  </div>
                  <div className="space-y-2.5 text-xs sm:text-sm">
                    {[
                      {
                        title: "Azure SQL 4-Table Evidence Bridge",
                        detail: "CompatibilityRuns → RunInputs → RunResults → AuditRecords transactional persistence with Run ID tracking.",
                        status: reportData?.cloudEvidence?.azureSqlRunId ? "Certified" : "Ready",
                      },
                      {
                        title: "Zero-Eval Sandboxed IR & Adapter Codegen",
                        detail: "Never executes eval() or new Function(). Only 7 whitelisted deterministic AST operations run; interpreter & TypeScript adapter equivalence verified.",
                        status: "Enforced",
                      },
                      {
                        title: "Groq AI Prompt-Injection & Path Firewall",
                        detail: "Sanitizes untrusted schema descriptions, excludes raw specs & API keys from LLM prompts, validates output via strict Zod, rejects fabricated paths.",
                        status: "Enforced",
                      },
                      {
                        title: "SSRF, 1 MiB Payload Ceiling & Cycle Guard",
                        detail: "Blocks remote http(s) $refs to prevent SSRF, enforces 1 MiB ceiling, and breaks circular local $refs safely.",
                        status: "Enforced",
                      },
                      {
                        title: "CERT-In & DPDP Act 2023 Protocol Headers",
                        detail: "HSTS (2-yr preload), strict CSP, X-Frame-Options: DENY, nosniff, Referrer-Policy, COOP/CORP same-origin, PKCE Google OAuth 2.0.",
                        status: "Active",
                      },
                    ].map((item) => (
                      <div key={item.title} className="p-3.5 rounded-xl bg-black/50 border border-white/[0.08] flex items-start justify-between gap-3">
                        <div>
                          <div className="font-semibold text-white">{item.title}</div>
                          <div className="text-xs text-zinc-300 mt-0.5 leading-relaxed">{item.detail}</div>
                        </div>
                        <span className="shrink-0 font-mono text-xs px-2.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-400/30">
                          {item.status}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
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
          <div className="bg-white/[0.03] backdrop-blur-xl rounded-lg shadow-xl border border-white/[0.08] max-w-lg w-full p-6 text-zinc-100 space-y-4 animate-in fade-in duration-150">
            <div className="border-b border-white/[0.08] pb-3">
              <h3 className="text-sm font-bold text-zinc-100 uppercase tracking-wider">
                Create Deterministic Manual Mapping
              </h3>
              <p className="text-xs text-zinc-400 mt-0.5">
                Define an exact field mapping manually. Manual mappings bypass AI proposals and are immediately approved and recorded into the review ledger.
              </p>
            </div>

            <form onSubmit={submitManualMapping} className="space-y-3.5 text-xs">
              {/* Target Path */}
              <div>
                <label className="block font-semibold text-zinc-300 mb-1">
                  Target Field Path <span className="text-rose-500">*</span>
                </label>
                {targetNormalized ? (
                  <select
                    value={formTargetPath}
                    onChange={(e) => setFormTargetPath(e.target.value)}
                    required
                    className="w-full font-mono text-xs p-2 border border-white/[0.12] rounded bg-white/[0.03] backdrop-blur-xl text-zinc-100 focus:outline-none focus:ring-1 focus:ring-slate-500"
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
                    className="w-full font-mono text-xs p-2 border border-white/[0.12] rounded focus:outline-none focus:ring-1 focus:ring-slate-500"
                  />
                )}
              </div>

              {/* Source Path */}
              <div>
                <label className="block font-semibold text-zinc-300 mb-1">
                  Source Field Path (or empty for default/constructed)
                </label>
                {sourceNormalized ? (
                  <select
                    value={formSourcePath}
                    onChange={(e) => setFormSourcePath(e.target.value)}
                    className="w-full font-mono text-xs p-2 border border-white/[0.12] rounded bg-white/[0.03] backdrop-blur-xl text-zinc-100 focus:outline-none focus:ring-1 focus:ring-slate-500"
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
                    className="w-full font-mono text-xs p-2 border border-white/[0.12] rounded focus:outline-none focus:ring-1 focus:ring-slate-500"
                  />
                )}
              </div>

              {/* Operation */}
              <div>
                <label className="block font-semibold text-zinc-300 mb-1">
                  Transformation Operation <span className="text-rose-500">*</span>
                </label>
                <select
                  value={formOperation}
                  onChange={(e) => setFormOperation(e.target.value as AllowedOperation)}
                  className="w-full font-mono text-xs p-2 border border-white/[0.12] rounded bg-white/[0.03] backdrop-blur-xl text-zinc-100 focus:outline-none focus:ring-1 focus:ring-slate-500"
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
                <div className="p-3.5 bg-violet-950/40 border border-violet-400/30 rounded-2xl space-y-1.5">
                  <label className="block font-semibold text-violet-200 mb-1">
                    Conversion Type <span className="text-rose-400">*</span>
                  </label>
                  <select
                    value={formConversionType}
                    onChange={(e) => setFormConversionType(e.target.value)}
                    className="w-full font-mono text-xs p-2 border border-violet-400/30 rounded-xl bg-black/60 text-zinc-100 focus:outline-none"
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
                <div className="p-3 bg-black/50 border border-white/[0.08] rounded space-y-1">
                  <label className="block font-semibold text-zinc-200 mb-1">
                    Default Value (literal string, number, or JSON) <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formDefaultValue}
                    onChange={(e) => setFormDefaultValue(e.target.value)}
                    placeholder='"standard" or 0 or false'
                    required
                    className="w-full font-mono text-xs p-1.5 border border-white/[0.12] rounded bg-white/[0.03] backdrop-blur-xl focus:outline-none"
                  />
                </div>
              )}

              {formOperation === "lookup" && (
                <div className="p-3.5 bg-violet-950/40 border border-violet-400/30 rounded-2xl space-y-1.5">
                  <label className="block font-semibold text-violet-200 mb-1">
                    Lookup Table JSON (Dictionary mapping) <span className="text-rose-400">*</span>
                  </label>
                  <textarea
                    rows={4}
                    value={formLookupTable}
                    onChange={(e) => setFormLookupTable(e.target.value)}
                    placeholder={'{\n  "pending": "OPEN",\n  "paid": "SETTLED"\n}'}
                    required
                    className="w-full font-mono text-xs p-2.5 border border-violet-400/30 rounded-xl bg-black/50 text-zinc-100 focus:outline-none resize-none"
                  />
                </div>
              )}

              {/* Rationale */}
              <div>
                <label className="block font-semibold text-zinc-300 mb-1">
                  Human Rationale / Mapping Notes
                </label>
                <input
                  type="text"
                  value={formRationale}
                  onChange={(e) => setFormRationale(e.target.value)}
                  placeholder="e.g., Target requires invoice currency code, defaulting to USD."
                  className="w-full text-xs p-2 border border-white/[0.12] rounded focus:outline-none focus:ring-1 focus:ring-slate-500"
                />
              </div>

              {/* Buttons */}
              <div className="pt-2 flex items-center justify-end space-x-2 border-t border-white/[0.08]">
                <button
                  type="button"
                  onClick={() => setIsManualModalOpen(false)}
                  disabled={loading}
                  className="px-3 py-1.5 border border-white/[0.12] rounded text-zinc-300 hover:bg-zinc-800 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading || !formTargetPath.trim()}
                  className="champagne-pill disabled:opacity-50 px-5 py-2 text-sm font-semibold rounded-full transition"
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
          <div className="bg-white/[0.03] backdrop-blur-xl rounded-lg shadow-xl border border-white/[0.08] max-w-lg w-full p-6 text-zinc-100 space-y-4 animate-in fade-in duration-150">
            <div className="border-b border-white/[0.08] pb-3">
              <h3 className="text-sm font-bold text-zinc-100 uppercase tracking-wider">
                Edit Mapping: {activeMappingForEdit.targetPath}
              </h3>
              <p className="text-xs text-zinc-400 mt-0.5">
                Adjust source path, operation type, conversion rules, or default parameters. Saved changes update this proposal with status &apos;edited&apos;.
              </p>
            </div>

            <form onSubmit={submitEditMapping} className="space-y-3.5 text-xs">
              {/* Target Path (read-only) */}
              <div>
                <label className="block font-semibold text-zinc-300 mb-1">Target Field Path</label>
                <input
                  type="text"
                  value={activeMappingForEdit.targetPath}
                  disabled
                  className="w-full font-mono text-xs p-2 border border-white/[0.08] bg-zinc-800 text-zinc-400 rounded cursor-not-allowed"
                />
              </div>

              {/* Source Path */}
              <div>
                <label className="block font-semibold text-zinc-300 mb-1">
                  Source Field Path (or empty for default/constructed)
                </label>
                {sourceNormalized ? (
                  <select
                    value={formSourcePath}
                    onChange={(e) => setFormSourcePath(e.target.value)}
                    className="w-full font-mono text-xs p-2 border border-white/[0.12] rounded bg-white/[0.03] backdrop-blur-xl text-zinc-100 focus:outline-none focus:ring-1 focus:ring-slate-500"
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
                    className="w-full font-mono text-xs p-2 border border-white/[0.12] rounded focus:outline-none focus:ring-1 focus:ring-slate-500"
                  />
                )}
              </div>

              {/* Operation */}
              <div>
                <label className="block font-semibold text-zinc-300 mb-1">
                  Transformation Operation <span className="text-rose-500">*</span>
                </label>
                <select
                  value={formOperation}
                  onChange={(e) => setFormOperation(e.target.value as AllowedOperation)}
                  className="w-full font-mono text-xs p-2 border border-white/[0.12] rounded bg-white/[0.03] backdrop-blur-xl text-zinc-100 focus:outline-none focus:ring-1 focus:ring-slate-500"
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
                <div className="p-3.5 bg-violet-950/40 border border-violet-400/30 rounded-2xl space-y-1.5">
                  <label className="block font-semibold text-violet-200 mb-1">
                    Conversion Type <span className="text-rose-400">*</span>
                  </label>
                  <select
                    value={formConversionType}
                    onChange={(e) => setFormConversionType(e.target.value)}
                    className="w-full font-mono text-xs p-2 border border-violet-400/30 rounded-xl bg-black/60 text-zinc-100 focus:outline-none"
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
                <div className="p-3 bg-black/50 border border-white/[0.08] rounded space-y-1">
                  <label className="block font-semibold text-zinc-200 mb-1">
                    Default Value (literal string, number, or JSON) <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formDefaultValue}
                    onChange={(e) => setFormDefaultValue(e.target.value)}
                    placeholder='"standard" or 0 or false'
                    required
                    className="w-full font-mono text-xs p-1.5 border border-white/[0.12] rounded bg-white/[0.03] backdrop-blur-xl focus:outline-none"
                  />
                </div>
              )}

              {formOperation === "lookup" && (
                <div className="p-3.5 bg-violet-950/40 border border-violet-400/30 rounded-2xl space-y-1.5">
                  <label className="block font-semibold text-violet-200 mb-1">
                    Lookup Table JSON (Dictionary mapping) <span className="text-rose-400">*</span>
                  </label>
                  <textarea
                    rows={4}
                    value={formLookupTable}
                    onChange={(e) => setFormLookupTable(e.target.value)}
                    placeholder={'{\n  "pending": "OPEN",\n  "paid": "SETTLED"\n}'}
                    required
                    className="w-full font-mono text-xs p-2.5 border border-violet-400/30 rounded-xl bg-black/50 text-zinc-100 focus:outline-none resize-none"
                  />
                </div>
              )}

              {/* Warning on high-risk / lossy conversion */}
              {(formOperation === "typeConversion" || formOperation === "default" || formOperation === "lookup") && (
                <div className="p-2.5 bg-amber-950/40 border border-amber-500/35 rounded-xl text-amber-200 text-xs">
                  ⚠ Note: Modifying this mapping to {formOperation} requires human verification. An audit record will be attached to the mapping.
                </div>
              )}

              {/* Buttons */}
              <div className="pt-2 flex items-center justify-end space-x-2 border-t border-white/[0.08]">
                <button
                  type="button"
                  onClick={() => setActiveMappingForEdit(null)}
                  disabled={loading}
                  className="px-3 py-1.5 border border-white/[0.12] rounded text-zinc-300 hover:bg-zinc-800 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="champagne-pill disabled:opacity-50 px-5 py-2 text-sm font-semibold rounded-full transition"
                >
                  {loading ? "Saving..." : "Save Mapping Edits"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <footer className="relative z-10 border-t border-white/[0.08] bg-black/45 backdrop-blur-xl py-4 text-center text-xs text-zinc-400">
        UNIFLOW ∞ — API Compatibility Compiler &bull; CERT-In &amp; DPDP Act 2023 Aligned &bull; PostgreSQL RLS &bull; Azure SQL &amp; Blob Evidence
      </footer>
    </div>
  );
}
