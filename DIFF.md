# Phase 4 — AI-Assisted Mapping Proposal Workflow & Safety Controls Diff Summary

## Purpose
Execute Phase 4 of UNIFLOW ∞: Implement the AI-assisted mapping proposal workflow as an **advisory suggestion engine, not an auto-approval engine**.

1. **Server-Side Provider Only**:
   - Groq API is called exclusively from server routes and modules (`app/api/projects/[id]/mappings/propose/route.ts` and `lib/ai/groq.ts`).
   - Configured via server-side environment variables: `GROQ_API_KEY`, `GROQ_MODEL`, `GROQ_FAST_MODEL`, and `GROQ_TIMEOUT_MS`.
   - Client and browser bundles never receive or log the API key.
   - Provider health/config status endpoint (`GET /api/projects/[id]/mappings/propose`) safely reports `configured: boolean`, `model: string`, and `timeoutMs: number` without disclosing secrets.
   - Graceful offline / unconfigured state: If `GROQ_API_KEY` is absent or provider fails, reports retryable state (503) and enables human engineers to map fields manually and use the deterministic baseline without claiming live AI.

2. **Bounded Schema Representation & Prompt Injection Defenses**:
   - Never sends raw uploaded files, user credentials, or unconstrained source text to the model.
   - Sends only bounded, normalized schema projections (`buildBoundedSchemaPayload`) with strictly bounded string lengths.
   - Treats all schema titles, field names, descriptions, and examples strictly as untrusted content.
   - System prompt explicitly commands the model to ignore embedded override commands, roleplay, or instructions, and produce strictly structured JSON candidate mappings.

3. **Strict Proposal Contract & Zod Validation**:
   - Strict Zod schema (`GroqMappingResponseSchema`) parses model responses.
   - Enforces allowlisted operations: `["copy", "rename", "readNested", "constructObject", "typeConversion", "default", "lookup"]`.
   - Rejects executable JavaScript, TypeScript, SQL, shell code, or arbitrary function names.
   - Validates every candidate against normalized source and target schemas. Fabricated target paths are strictly dropped; fabricated source paths are nullified to default fallbacks.
   - Bounded single repair request if model response fails initial JSON/Zod parsing.
   - Enforces `needs_confirmation` human approval gate for high uncertainty, unresolved questions, missing required source fields, differing enums, or type conversions.

4. **Human Review Workbench UI**:
   - Side-by-side source and target field inspection with types, uncertainty badge, status, and rationale.
   - Displays AI-generated unresolved questions and information loss disclosures.
   - Interactive actions: Accept, Reject, Edit, and Audit Trail history.
   - "Add Manual Mapping" modal: Allows human engineers to create deterministic mappings independently of AI proposals.
   - "Edit Candidate Mapping" modal: Allows modifying source path, operation, conversion rules, default values, or dictionary lookup tables.
   - Rejection isolation: Rejected or unconfirmed mappings are strictly excluded from compiled transformation plans.

---

## Added Files

### Server-Side AI Provider
- `lib/ai/groq.ts`: Server-side Groq advisory provider module featuring:
  - `getGroqProviderConfig()`: Safe health check never disclosing the key.
  - `GroqCandidateSchema` & `GroqMappingResponseSchema`: Strict Zod validation.
  - `buildBoundedSchemaPayload()`: Bounded schema extraction excluding raw files.
  - `requestGroqMappingProposals()`: Prompt injection defenses, bounded retry with exponential backoff on 429/5xx, AbortSignal timeout, single repair attempt, and normalized schema path validation.

### API Routes
- `app/api/projects/[id]/mappings/propose/route.ts`:
  - `GET`: Safe health check returning provider configuration status.
  - `POST`: Advisory mapping proposal generation with tenant authorization and retryable error handling.

### Unit Tests
- `tests/unit/phase4_ai_mapping.test.ts`: Comprehensive test suite verifying all Phase 4 safety contracts:
  1. Provider config non-disclosure (never leaks API key).
  2. Bounded schema payload generation (excludes raw documents and credentials).
  3. Prompt injection defense in untrusted descriptions.
  4. Strict Zod schema validation (rejects invalid JSON, unknown operations, arbitrary code, SQL).
  5. Rejection of fabricated target paths and handling of fabricated source paths.
  6. Human confirmation enforcement for ambiguous and high-risk mappings.
  7. Missing Groq API key handling (reports 503 without claiming live AI).
  8. Deterministic manual-mapping workflow and reviewer audit trail.
  9. Compiler rejection of unapproved or rejected candidate mappings.

---

## Updated Files

- `lib/mapping/types.ts`:
  - Enriched `CandidateMapping` with `unresolvedQuestions: string[]`, `provider: "groq" | "deterministic" | "manual"`, `modelUsed?: string`, and `uncertaintyScore: "LOW" | "MEDIUM" | "HIGH" | "UNKNOWN"`.
  - Exported `ALLOWED_OPERATIONS` and `SUPPORTED_CONVERSIONS` constants.
- `lib/store/project-store.ts`:
  - Added `addMapping(projectId, ownerId, mapping)` to store and deduplicate manual mappings with tenant ownership validation.
- `app/api/projects/[id]/mappings/route.ts`:
  - Extended `POST` endpoint to handle manual mapping creation with strict target/source path verification.
  - Extended `PATCH` endpoint to support editing mapping fields, operations, conversion types, defaults, and audit history.
- `app/projects/[projectId]/page.tsx`:
  - Added live AI provider status badge in header.
  - Added "Propose with Groq AI" and "Heuristic Baseline" generation triggers.
  - Added "Add Manual Mapping" button and accessible modal dialog.
  - Added "Edit Mapping" modal dialog with validation for conversion arguments and dictionary tables.
  - Rendered uncertainty badges, unresolved semantic questions, and audit trail toggle for each proposal.

---

## Verification Run & Results

| Gate | Command | Result | Details |
| :--- | :--- | :--- | :--- |
| **Lint** | `npm run lint` | **PASSED** | 0 errors, 0 warnings across all files (`eslint .`) |
| **Typecheck** | `npm run typecheck` | **PASSED** | 0 TypeScript errors (`tsc --noEmit`) |
| **Unit Tests** | `npm test` | **PASSED** | 45 passed, 0 failed across core, security, Phase 3, Phase 4, and Phase 5 suites |
| **Production Build** | `npm run build` | **PASSED** | Next.js 15.5.28 compiled all 9 static and dynamic routes cleanly |

---

# Phase 5 — Transformation Plan Compiler, Trusted Interpreter & TypeScript Adapter Generation

## Purpose
Execute Phase 5 of UNIFLOW ∞: Complete the deterministic compilation, trusted interpreter execution, target schema conformance validation, standalone TypeScript adapter emission, and automated fixture equivalence verification.

1. **Constrained Transformation Compiler (`lib/transformation/compiler.ts`)**:
   - Enforces human approval gate: only mappings in `accepted` or `edited` status are compiled.
   - Strictly excludes `rejected` or `needs_confirmation` proposals.
   - Enforces 100% required target field coverage (rejects compilation if any required target leaf lacks an approved step).
   - Validates all 7 allowlisted operations: `["copy", "rename", "readNested", "constructObject", "typeConversion", "default", "lookup"]`.
   - Validates all supported type conversions against `ALLOWED_CONVERSIONS`.

2. **Zero-Eval Trusted Interpreter (`lib/transformation/interpreter.ts`)**:
   - Executes approved `TransformationPlan` steps on input payloads strictly without `eval()` or dynamic code execution.
   - High-fidelity path parsing for bracketed strings (`$["order"]["items"][0]["price"]`) and escaped quotes.
   - Evaluates missing value policies: `fail` (aborts execution with structured error), `useDefault` (falls back to approved default), or `omit`.
   - Supports ISO-8601 string to millisecond epoch timestamp conversion (`isoDate-to-timestamp`).
   - Collects step-by-step execution metrics (`StepExecutionResult[]`).

3. **Target Contract Conformance Validator (`lib/transformation/validate.ts`)**:
   - Validates transformed output against target schema rules:
     - `rule: "required"`: Catches missing required fields.
     - `rule: "nullable"`: Catches null values on non-nullable fields.
     - `rule: "type"`: Catches scalar and container type mismatches.
     - `rule: "enum"`: Catches values not in the allowed target enum list.
     - Format validation: Verifies date-time formatting for ISO-8601 compliance.

4. **Standalone TypeScript Adapter Generator (`lib/transformation/generator.ts`)**:
   - Emits self-contained, zero-dependency TypeScript adapter code (`adapt` and `transform` functions).
   - Inlines path traversal helpers and static lookup tables.
   - Zero dynamic eval or unsafe string interpolation.

5. **Equivalence Verification Suite (`lib/transformation/equivalence.ts`)**:
   - Runs canonical test fixtures across both interpreter and adapter execution.
   - Asserts 100% output equality (`allEqual: true`) and valid target conformance.

6. **Interactive Workspace UI Updates (`app/projects/[projectId]/page.tsx`)**:
   - Added interactive Fixture Selector (Fixture 1: Standard, Fixture 2: EUR, Fixture 3: Negative Case).
   - Added Custom JSON Payload input editor for arbitrary payload testing.
   - Added Step-by-Step Transformation Inspector table.
   - Added one-click **Download .ts Adapter** button.

---

## Added & Updated Files

- `tests/unit/phase5_compiler_and_adapter.test.ts`: 7 comprehensive test suites covering plan compilation guardrails, interpreter execution (all 7 operations), missing value policies, target validation negative cases, adapter code generation, and equivalence verification.
- `lib/transformation/ir.ts`: Added `isoDate-to-timestamp` to `ALLOWED_CONVERSIONS`.
- `lib/transformation/interpreter.ts`: Added `constructObject` support, `isoDate-to-timestamp` conversion handler.
- `lib/transformation/generator.ts`: Added `constructObject`, `isoDate-to-timestamp`, and `transform` export alias.
- `lib/transformation/validate.ts`: Enforced strict nullability checks and date-time format validations.
- `app/projects/[projectId]/page.tsx`: Added interactive test runner, custom payload editor, step inspector, and adapter download.

---

## Verification Run & Results (Phase 5)

| Gate | Command | Result | Details |
| :--- | :--- | :--- | :--- |
| **Lint** | `npm run lint` | **PASSED** | 0 errors, 0 warnings across all files (`eslint .`) |
| **Typecheck** | `npm run typecheck` | **PASSED** | 0 TypeScript errors (`tsc --noEmit`) |
| **Unit Tests** | `npm test` | **PASSED** | 45 passed, 0 failed across all 5 test suites |
| **Production Build** | `npm run build` | **PASSED** | All 9 routes compiled cleanly in Next.js 15.5 |

---

## Live Environment Setup for Groq

To test live Groq LLM proposals in development:
1. Obtain an API key from [Groq Console](https://console.groq.com/keys).
2. Add the following to `.env.local`:
   ```bash
   GROQ_API_KEY=gsk_your_actual_groq_api_key_here
   GROQ_MODEL=llama-3.3-70b-versatile
   GROQ_FAST_MODEL=llama-3.1-8b-instant
   GROQ_TIMEOUT_MS=15000
   ```
3. If no key is configured, UNIFLOW ∞ automatically runs in safe offline mode with the deterministic heuristic baseline and human manual mapping available.
