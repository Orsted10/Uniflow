# Local Development Guide — UNIFLOW ∞

This guide describes how to install dependencies, run the local development server, execute test suites, and verify code standards for **UNIFLOW ∞** (API Compatibility Compiler).

---

## 1. Prerequisites

- **Node.js**: `v18.18+` or higher (tested on Node.js `v20.x`, `v22.x`, and `v26.x`).
- **Package Manager**: `npm` (`v9+` or `v10+`).
- **Operating System**: Linux, macOS, or Windows (PowerShell / Command Prompt).

---

## 2. Setup & Environment

### Clone & Install Dependencies

```bash
git clone <repo-url> uniflow
cd uniflow
npm install
```

### Environment Configuration

Copy the placeholder template:

```bash
cp .env.example .env.local
```

> **Security Rule**: `.env.local` is listed in `.gitignore` and must never be committed. In Phase 1 local development, all core compiler features operate deterministically in isolated developer mode without requiring live external cloud credentials.

---

## 3. Available Commands

| Command | Description |
| :--- | :--- |
| `npm run dev` | Starts the Next.js development server with Turbopack at `http://localhost:3000` |
| `npm run build` | Builds the production Next.js bundle and prerenders static routes |
| `npm start` | Runs the built production server |
| `npm run lint` | Runs ESLint across all codebase files (`eslint .`) |
| `npm run format` | Runs ESLint auto-fix (`eslint . --fix`) |
| `npm run typecheck` | Runs TypeScript strict type-checker without emit (`tsc --noEmit`) |
| `npm test` | Runs the unit and equivalence test suite via Node test runner (`npx tsx --test tests/unit/*.test.ts`) |

---

## 4. Application Routes

- **`/`**: Main Dashboard — Communicates the 6-stage compiler pipeline, quick access to projects, and architectural trust boundaries.
- **`/login`**: Sign-in page displaying authentic authentication status (isolated tenant developer mode).
- **`/projects`**: Project catalog with search and real empty states.
- **`/projects/new`**: Project creation flow with optional canonical e-commerce contract preloading.
- **`/projects/[projectId]`**: Full compiler workspace with 5 interactive sections:
  1. **Overview**: Project metadata, contract diff summary, and execution status.
  2. **Specs & Diff**: Raw OpenAPI 3.x / JSON Schema input viewers and structural difference matrix.
  3. **Mapping Review**: Candidate mappings table with confidence indicators, human approval/rejection controls, and transform parameter editor.
  4. **Test & Adapter**: Deterministic runtime evaluation results, target schema validation diagnostics, and pure TypeScript adapter generator.
  5. **Report**: Evidence-backed compatibility report with Markdown and JSON export capabilities.

---

## 5. Core Engine & Safety Limits

All contract transformations conform to strict safety boundaries:
- **Spec Size Limit**: 1 MiB payload ceiling.
- **Recursion Depth Limit**: Max depth of 64 levels.
- **Cycle Protection**: Guarded against self-referential schemas.
- **Code Execution**: Zero dynamic `eval()` or stringified function compilation. Only allowlisted Transformation IR primitives are evaluated by the deterministic interpreter.
- **Equivalence Verification**: Automated test suites verify that the deterministic runtime interpreter and the generated standalone TypeScript adapter produce identical outputs for all input fixtures.
