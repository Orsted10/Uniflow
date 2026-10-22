# UNIFLOW ∞ — Security & Tenant Isolation Model

This document specifies the security boundaries, session authentication, PostgreSQL Row-Level Security (RLS) enforcement, and server-side ownership verification for UNIFLOW ∞.

---

## 1. Core Security Principles

1. **Client Identity is Never Trusted**: The application server never trusts `owner_id`, `user_id`, or tenant identifiers provided in request bodies, query parameters, or client headers.
2. **Session Authentication via Supabase Auth**: Authenticated user identity is resolved exclusively through cryptographically verified JWT cookies using `@supabase/ssr` (`supabase.auth.getUser()`).
3. **Defense in Depth**:
   - **Layer 1 (Next.js Middleware & SSR)**: Session validation and route protection.
   - **Layer 2 (Server Handlers & Actions)**: Explicit ownership verification before database operations.
   - **Layer 3 (PostgreSQL Row-Level Security)**: Database-level tenant isolation scoping child tables through `projects.owner_id = auth.uid()`.
4. **Service-Role Key Isolation**: The `SUPABASE_SERVICE_ROLE_KEY` is strictly server-only. It is never exposed via `NEXT_PUBLIC_*` and is never invoked without prior user session and project ownership verification.

---

## 2. Supabase Client & Session Architecture

We employ official `@supabase/ssr` patterns across three execution contexts:

### Browser Client (`lib/supabase/client.ts`)
- Initialized with `createBrowserClient(NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY)`.
- Automatically synchronizes tokens to secure browser cookies.
- Used in client components (`"use client"`) for sign-in, sign-out, and auth state listeners.

### Server Client (`lib/supabase/server.ts`)
- Initialized with `createServerClient` and Next.js 15 `cookies()` store.
- Used in App Router Server Components, Server Actions, and Route Handlers.
- Validates the active session via `supabase.auth.getUser()`.

### Middleware (`middleware.ts`)
- Intercepts requests to protected routes (`/projects/*`).
- Refreshes auth tokens on incoming requests.
- Redirects unauthenticated requests to `/login` when live Supabase credentials are configured.

---

## 3. Database Row-Level Security (RLS) Policies

All 9 user-owned tables in PostgreSQL have Row-Level Security enabled (`alter table ... enable row level security`).

### Ownership Resolution Matrix

| Table | Ownership Resolution Strategy | Policy Check (`auth.uid()`) |
| :--- | :--- | :--- |
| **`projects`** | Direct column check | `auth.uid() = owner_id` |
| **`specs`** | Join to parent project | `EXISTS (SELECT 1 FROM projects p WHERE p.id = specs.project_id AND p.owner_id = auth.uid())` |
| **`mapping_sets`** | Join to parent project | `EXISTS (SELECT 1 FROM projects p WHERE p.id = mapping_sets.project_id AND p.owner_id = auth.uid())` |
| **`mappings`** | Join via `mapping_sets` to `projects` | `EXISTS (SELECT 1 FROM mapping_sets ms JOIN projects p ON p.id = ms.project_id WHERE ms.id = mappings.mapping_set_id AND p.owner_id = auth.uid())` |
| **`transformation_plans`** | Join to parent project | `EXISTS (SELECT 1 FROM projects p WHERE p.id = transformation_plans.project_id AND p.owner_id = auth.uid())` |
| **`test_runs`** | Join to parent project | `EXISTS (SELECT 1 FROM projects p WHERE p.id = test_runs.project_id AND p.owner_id = auth.uid())` |
| **`adapters`** | Join to parent project | `EXISTS (SELECT 1 FROM projects p WHERE p.id = adapters.project_id AND p.owner_id = auth.uid())` |
| **`compatibility_reports`**| Join to parent project | `EXISTS (SELECT 1 FROM projects p WHERE p.id = compatibility_reports.project_id AND p.owner_id = auth.uid())` |
| **`report_artifacts`** | Join to parent project | `EXISTS (SELECT 1 FROM projects p WHERE p.id = report_artifacts.project_id AND p.owner_id = auth.uid())` |

---

## 4. Server Route Ownership Verification

Every API handler (`/api/projects/*`) performs mandatory ownership verification:

```ts
// 1. Resolve verified user from session
const user = await getAuthenticatedUser(request);

// 2. Fetch project verifying ownership
const project = await getProject(projectId, user.id);
if (!project) {
  return NextResponse.json({ error: "Project not found or access denied" }, { status: 404 });
}

// 3. Reject any client-supplied spoofed owner_id
if (body.owner_id && body.owner_id !== user.id) {
  // Ignored or rejected: owner_id is strictly overridden by user.id
}
```

---

## 5. Safe Project Deletion

When a project is deleted:
1. **Foreign Key Cascade**: All child database rows (`specs`, `mapping_sets`, `mappings`, `transformation_plans`, `test_runs`, `adapters`, `compatibility_reports`, `report_artifacts`) have `ON DELETE CASCADE` constraints referencing `projects(id)`.
2. **Atomic Cleanup**: Deleting a project in PostgreSQL atomically purges all dependent metadata without leaving orphaned child rows.
3. **Blob Reference Check**: In Phase 2, specs default to `storage_provider: 'inline'`. When remote Azure Blob storage is configured in later phases, the deletion handler inspects `specs.blob_reference` and `report_artifacts.object_key` before database deletion, ensuring cloud storage objects are deleted prior to committing row removal.

---

## 6. Two-User Cross-Tenant Verification Procedure

To verify tenant isolation between two distinct users:

### Step 1: Create Test Accounts
1. User A: `alice@example.com`
2. User B: `bob@example.com`

### Step 2: User A Creates Resources
1. User A logs in and creates a project: `Project Alpha` (`id: proj-alice-123`).
2. User A uploads specs and creates mapping sets.

### Step 3: User B Attempts Access
1. User B logs in and requests `GET /api/projects/proj-alice-123`.
   - **Expected Result**: HTTP `404 Not Found` or `403 Forbidden` (`User does not own this project`).
2. User B attempts `POST /api/projects/proj-alice-123/specs`.
   - **Expected Result**: HTTP `403 Forbidden`. No spec rows created.
3. User B queries PostgreSQL directly with their JWT token:
   ```sql
   SELECT * FROM public.projects;
   ```
   - **Expected Result**: Only projects where `owner_id = bob.uid` are returned. `Project Alpha` is completely hidden by RLS.
4. User B attempts a malicious SQL insert:
   ```sql
   INSERT INTO public.projects (owner_id, name) VALUES ('alice-uid', 'Hacked Project');
   ```
   - **Expected Result**: Database error: `new row violates row-level security policy for table "projects"`.
