import { createBrowserClient } from "@supabase/ssr";

/**
 * Creates a browser-side Supabase client for Client Components.
 * Automatically handles cookie management via document.cookie.
 */
export function createSupabaseBrowserClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    return null;
  }

  return createBrowserClient(url, anonKey);
}

// Backward compatibility alias
export const createSupabaseClient = createSupabaseBrowserClient;
