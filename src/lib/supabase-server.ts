import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";
import { SUPABASE_ANON_KEY, SUPABASE_URL } from "./supabase";

/** Cliente para Server Components, Route Handlers e Server Actions. */
export function supabaseServer() {
  const store = cookies();
  return createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      get: (name: string) => store.get(name)?.value,
      set: (name: string, value: string, options: CookieOptions) => {
        try {
          store.set({ name, value, ...options });
        } catch {
          /* Server Component só de leitura — o middleware já cuida do refresh */
        }
      },
      remove: (name: string, options: CookieOptions) => {
        try {
          store.set({ name, value: "", ...options });
        } catch {
          /* idem */
        }
      },
    },
  });
}
