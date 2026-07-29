import { NextResponse, type NextRequest } from "next/server";
import { supabaseServer } from "@/lib/supabase-server";

/** Troca o código do link mágico por uma sessão. */
export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const proximo = url.searchParams.get("proximo") || "/inicio";

  if (code) {
    const supabase = supabaseServer();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(new URL(proximo, url.origin));
  }

  return NextResponse.redirect(new URL("/entrar?erro=link", url.origin));
}
