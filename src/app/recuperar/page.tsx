"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { supabaseBrowser } from "@/lib/supabase";

export default function Recuperar() {
  const [sb] = useState(() => supabaseBrowser());
  const [email, setEmail] = useState("");
  const [carregando, setCarregando] = useState(false);
  const [enviado, setEnviado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    setCarregando(true);
    try {
      const { error } = await sb.auth.resetPasswordForEmail(email.trim().toLowerCase(), {
        redirectTo: `${location.origin}/auth/callback?proximo=${encodeURIComponent("/nova-senha")}`,
      });
      if (error) throw error;
      // Sempre dizemos que enviamos, mesmo se o e-mail nao existir: confirmar
      // quais e-mails tem conta e entregar meia lista para quem esta fuçando.
      setEnviado(true);
    } catch {
      setEnviado(true);
    } finally {
      setCarregando(false);
    }
  }

  return (
    <main className="min-h-dvh flex flex-col items-center justify-center px-6 py-10">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center mb-7">
          <Link href="/">
            <Image src="/simbolo-claro.png" alt="Simple" width={64} height={64} />
          </Link>
          <h1 className="mt-4 text-xl font-extrabold">Recuperar senha</h1>
        </div>

        {enviado ? (
          <div className="cartao text-center space-y-4">
            <div className="w-12 h-12 mx-auto rounded-full bg-ok/12 grid place-items-center">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#2EE6A8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="2" y="4" width="20" height="16" rx="2" />
                <path d="m22 6-10 7L2 6" />
              </svg>
            </div>
            <p className="text-texto2 text-[13px] leading-relaxed">
              Se existe uma conta com <b className="text-texto">{email}</b>, o link para criar uma
              senha nova já está a caminho.
            </p>
            <p className="text-texto3 text-[11.5px] leading-relaxed">
              Abra <b className="text-texto2">neste mesmo aparelho</b>. Não chegou? Confira o spam.
            </p>
            <Link href="/entrar" className="btn-sec">
              Voltar para o login
            </Link>
          </div>
        ) : (
          <form onSubmit={enviar} className="cartao space-y-4">
            <div>
              <div className="rotulo">Seu e-mail</div>
              <input
                className="campo"
                type="email"
                autoComplete="email"
                autoCapitalize="none"
                placeholder="voce@academia.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
              <p className="text-[11px] text-texto3 mt-1.5 leading-relaxed">
                Mandamos um link para você criar uma senha nova.
              </p>
            </div>
            {erro && <p className="text-sangue text-[13px]">{erro}</p>}
            <button className="btn-pri" disabled={carregando || !email.includes("@")}>
              {carregando ? "Enviando…" : "Enviar link"}
            </button>
            <Link href="/entrar" className="block text-center text-[12.5px] text-texto2 py-1">
              Lembrei a senha
            </Link>
          </form>
        )}
      </div>
    </main>
  );
}
