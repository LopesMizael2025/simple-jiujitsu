import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const PUBLICAS = ["/entrar", "/auth", "/_next", "/favicon", "/icon", "/apple-icon", "/manifest", "/logo", "/simbolo", "/wordmark", "/models"];

export async function middleware(req: NextRequest) {
  let res = NextResponse.next({ request: { headers: req.headers } });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get: (name: string) => req.cookies.get(name)?.value,
        set: (name: string, value: string, options: CookieOptions) => {
          res.cookies.set({ name, value, ...options });
        },
        remove: (name: string, options: CookieOptions) => {
          res.cookies.set({ name, value: "", ...options });
        },
      },
    }
  );

  // Renova a sessão a cada request (obrigatório com App Router)
  const { data: { user } } = await supabase.auth.getUser();

  const path = req.nextUrl.pathname;
  const publica = PUBLICAS.some((p) => path.startsWith(p));

  if (!user && !publica) {
    const url = req.nextUrl.clone();
    url.pathname = "/entrar";
    // O destino precisa levar a query junto: um convite chega como
    // /vincular?c=<token> e sem isso o token se perderia no login.
    url.search = "";
    url.searchParams.set("proximo", path + req.nextUrl.search);
    return NextResponse.redirect(url);
  }

  // Já logado não vê tela de login. É isso que faz o app abrir direto
  // quando o professor toca no ícone da tela de início.
  if (user && path.startsWith("/entrar")) {
    const url = req.nextUrl.clone();
    url.pathname = "/inicio";
    url.search = "";
    return NextResponse.redirect(url);
  }

  // Logado mas ainda sem escola vinculada → manda digitar o código
  if (user && !publica && path !== "/vincular") {
    const { data: perfil } = await supabase
      .from("perfil")
      .select("escola_id")
      .eq("id", user.id)
      .maybeSingle();

    if (!perfil?.escola_id) {
      const url = req.nextUrl.clone();
      url.pathname = "/vincular";
      return NextResponse.redirect(url);
    }
  }

  return res;
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|.*\\.(?:png|jpg|jpeg|svg|ico|webp|json|bin)$).*)"],
};
