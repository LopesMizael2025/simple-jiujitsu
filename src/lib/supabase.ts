import { createBrowserClient } from "@supabase/ssr";

/**
 * Cliente para componentes 'use client'.
 *
 * O cliente de servidor mora em `supabase-server.ts` — precisa ficar separado
 * porque importa `next/headers`, que não pode ser puxado por Client Component.
 */

export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
export const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  // Erro legível em vez de "Invalid URL" lá no fundo da stack.
  console.error(
    "[Simple] Faltam NEXT_PUBLIC_SUPABASE_URL e/ou NEXT_PUBLIC_SUPABASE_ANON_KEY. " +
      "Configure em .env.local (local) ou nas Environment Variables da Vercel."
  );
}

export function supabaseBrowser() {
  return createBrowserClient(SUPABASE_URL, SUPABASE_ANON_KEY);
}
