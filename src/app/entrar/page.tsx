"use client";

import { Suspense, useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase";

const LEMBRAR = "simple:ultimo-acesso";

function traduzir(msg?: string) {
  if (!msg) return "Algo deu errado. Tente de novo.";
  const m = msg.toLowerCase();
  if (m.includes("invalid login credentials"))
    return "E-mail ou senha não conferem. Se esqueceu a senha, use o link abaixo.";
  if (m.includes("email not confirmed"))
    return "Falta confirmar seu e-mail. Abra o link que mandamos na hora do cadastro.";
  if (m.includes("rate") || m.includes("too many"))
    return "Muitas tentativas seguidas. Espere um minuto e tente de novo.";
  if (m.includes("signups not allowed")) return "Este acesso não está autorizado.";
  return msg;
}

function Formulario() {
  const router = useRouter();
  const proximo = useSearchParams().get("proximo") || "/inicio";
  const [sb] = useState(() => supabaseBrowser());

  const [etapa, setEtapa] = useState<"conferindo" | "formulario">("conferindo");
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [verSenha, setVerSenha] = useState(false);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  // Sessao viva entra direto. Senao, o e-mail do ultimo acesso ja vem digitado.
  useEffect(() => {
    (async () => {
      const { data } = await sb.auth.getSession();
      if (data.session) {
        router.replace(proximo);
        return;
      }
      try {
        const salvo = localStorage.getItem(LEMBRAR);
        if (salvo && salvo.includes("@")) setEmail(salvo);
      } catch {
        /* modo privado bloqueia localStorage */
      }
      setEtapa("formulario");
    })();
  }, [sb, router, proximo]);

  async function entrar(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    setCarregando(true);
    try {
      const alvo = email.trim().toLowerCase();
      const { error } = await sb.auth.signInWithPassword({ email: alvo, password: senha });
      if (error) throw new Error(traduzir(error.message));

      try {
        localStorage.setItem(LEMBRAR, alvo);
      } catch {
        /* sem problema */
      }
      router.replace(proximo);
      router.refresh();
    } catch (e) {
      setErro((e as Error).message);
    } finally {
      setCarregando(false);
    }
  }

  if (etapa === "conferindo") {
    return (
      <div className="cartao py-10 text-center">
        <div className="w-8 h-8 mx-auto rounded-full border-[3px] border-borda border-t-ok animate-spin" />
        <p className="text-texto2 text-[13px] mt-4">Verificando seu acesso…</p>
      </div>
    );
  }

  return (
    <form onSubmit={entrar} className="cartao space-y-4">
      <div>
        <div className="rotulo">E-mail</div>
        <input
          className="campo"
          type="email"
          autoComplete="email"
          autoCapitalize="none"
          placeholder="voce@academia.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
      </div>

      <div>
        <div className="flex items-center justify-between">
          <div className="rotulo">Senha</div>
          <button
            type="button"
            className="text-[11px] text-texto3 font-semibold mb-1.5"
            onClick={() => setVerSenha((v) => !v)}
          >
            {verSenha ? "Ocultar" : "Mostrar"}
          </button>
        </div>
        <input
          className="campo"
          type={verSenha ? "text" : "password"}
          autoComplete="current-password"
          placeholder="Sua senha"
          value={senha}
          onChange={(e) => setSenha(e.target.value)}
        />
      </div>

      {erro && <p className="text-sangue text-[13px] leading-snug">{erro}</p>}

      <button className="btn-pri" disabled={carregando || !email.trim() || !senha}>
        {carregando ? "Entrando…" : "Entrar"}
      </button>

      <Link href="/recuperar" className="block text-center text-[12.5px] text-texto2 py-1">
        Esqueci minha senha
      </Link>

      <div className="border-t border-borda pt-4">
        <p className="text-center text-[12.5px] text-texto2">
          Sua academia ainda não usa o Simple?{" "}
          <Link href="/cadastro" className="text-ok font-semibold">
            Criar conta
          </Link>
        </p>
      </div>
    </form>
  );
}

export default function Entrar() {
  return (
    <main className="min-h-dvh flex flex-col items-center justify-center px-6 py-10">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center mb-8">
          <Link href="/">
            <Image src="/simbolo-claro.png" alt="Simple" width={80} height={80} priority />
          </Link>
          <h1 className="mt-4 text-2xl font-extrabold tracking-tight">Simple</h1>
          <p className="text-texto2 text-sm mt-1">Área do professor</p>
        </div>
        <Suspense fallback={<div className="cartao h-52 animate-pulse" />}>
          <Formulario />
        </Suspense>
      </div>
    </main>
  );
}
