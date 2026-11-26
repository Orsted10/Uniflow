import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse, type NextRequest } from "next/server";

export async function GET(request: NextRequest) {
  const urlObj = new URL(request.url);
  const { searchParams } = urlObj;
  const code = searchParams.get("code");

  const forwardedHost = request.headers.get("x-forwarded-host");
  const forwardedProto = request.headers.get("x-forwarded-proto") || "https";
  const origin = forwardedHost
    ? `${forwardedProto}://${forwardedHost}`
    : urlObj.origin;

  const cookieStore = await cookies();
  const rawNext =
    searchParams.get("next") ||
    cookieStore.get("uniflow_auth_next")?.value ||
    "/overview";
  const safeNext =
    rawNext.startsWith("/") && !rawNext.startsWith("//")
      ? rawNext
      : "/overview";

  if (code) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (url && anonKey) {
      const supabase = createServerClient(url, anonKey, {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
          setAll(cookiesToSet) {
            try {
              cookiesToSet.forEach(({ name, value, options }) =>
                cookieStore.set(name, value, options)
              );
            } catch {
              // Handled by Next.js server cookie store
            }
          },
        },
      });

      const { error } = await supabase.auth.exchangeCodeForSession(code);
      if (!error) {
        const res = NextResponse.redirect(`${origin}${safeNext}`);
        res.cookies.delete("uniflow_auth_next");
        return res;
      }
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth_exchange_failed`);
}
