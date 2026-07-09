import { NextResponse, type NextRequest } from "next/server";
import { updateAuthSession } from "@/lib/auth/supabase-middleware";
import { applySecurityHeaders } from "@/lib/http/security-headers";

export async function proxy(request: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    const response = NextResponse.next();
    applySecurityHeaders(response.headers);
    return response;
  }

  const response = await updateAuthSession(request, supabaseUrl, supabaseAnonKey);
  applySecurityHeaders(response.headers);
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|\\.well-known/|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
