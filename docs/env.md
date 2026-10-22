# Environment variables

Copy `.env.example` to `.env.local` and fill in the real values.

`.env.local` is gitignored. `.env.example` is committed with placeholders only.

## Secrets (server-side only)
These must not be exposed to the browser and must not be prefixed with `NEXT_PUBLIC_`.

```
# Supabase service role key (server-side only; use the session-aware client when possible)
SUPABASE_SERVICE_ROLE_KEY=

# Groq (server-side only)
GROQ_API_KEY=
GROQ_MODEL=
GROQ_TIMEOUT_MS=
GROQ_MAX_INPUT_TOKENS=

# Azure (server-side only)
AZURE_STORAGE_ACCOUNT=
AZURE_STORAGE_CONTAINER=
AZURE_STORAGE_SAS_TOKEN=
AZURE_SQL_SERVER=
AZURE_SQL_DATABASE=
AZURE_SQL_USERNAME=
AZURE_SQL_PASSWORD=
```

## Public variables (browser-safe)
These are safe to expose to the browser because they are not secrets by themselves.

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
NEXT_PUBLIC_APP_URL=
```

## Setup order
1. Create the Supabase project.
2. Apply `supabase/schema.sql` and enable RLS.
3. Add Supabase credentials to `.env.local`.
4. Only after the cost-control gate is complete and confirmed in the Azure portal:
   - add Azure credentials if Azure is configured,
   - mark which Azure services are actually live.
