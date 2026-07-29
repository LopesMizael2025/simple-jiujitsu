"use client";

import { Suspense, useState } from "react";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase";

const MODO = process.env.NEXT_PUBLIC_AUTH_MODE ?? "whatsapp";

/** (34) 99999-9999 → +5534999999999 */
function paraE164(bruto: string) {
  const d = bruto.replace(/\D/g, "");
  if (!d) return "";
  if (bruto.trim().startsWith("+")) return "+" + d;
  if (d.startsWith("55") && d.length >= 12) return "+" + d;
  return "+55" + d;
}

function mascara(v: string) {
  const d = v.replace(/\D/g, "").slice(0, 11);
  if (d.length <= 2) return d;
  if (d.length <= 7) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

function traduzir(msg?: string) {
  if (!msg) return "Algo deu errado. Tente de novo.";
  const m = msg.toLowerCase();
  if (m.includes("invalid") && m.includes("token")) return "Código incorreto ou expirado.";
  if (m.includes("expired")) return "Código expirado. Peça um novo.";
  if (m.includes("rate") || m.includes("too many")) return "Muitas tentativas. Espere um minuto.";
  if (m.includes("phone") && m.includes("provider")) return "Login por WhatsApp ainda não configurado no Supabase.";
  if (m.includes("signups not allowed")) return "Este número não está autorizado a entrar.";
  return msg;
}

function Formulario() {
  const router = useRouter();
  const proximo = useSearchParams().get("proximo") || "/inicio";
  const [sb] = useState(() => supabaseBrowser());

  const [etapa, setEtapa] = useState<"identificar" | "codigo">("identificar");
  const [telefone, setTelefone] = useState("");
  const [email, setEmail] = useState("");
  const [codigo, setCodigo] = useState("");
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);

  const porWhats = MODO === "whatsapp";

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    setCarregando(true);
    try {
      if (porWhats) {
        const phone = paraE164(telefone);
        if (phone.length < 13) throw new Error("Digite o DDD e o número completo.");
        const { error } = await sb.auth.signInWithOtp({
          phone,
          options: { channel: "whatsapp" },
        });
        if (error) throw error;
        setEtapa("codigo");
      } else {
        const { error } = await sb.auth.signInWithOtp({
          email: email.trim(),
          options: {
            emailRedirectTo: `${location.origin}/auth/callback?proximo=${encodeURIComponent(proximo)}`,
          },
        });
        if (error) throw error;
        setAviso("Link enviado. Abra o e-mail neste mesmo aparelho.");
      }
    } catch (e) {
      setErro(traduzir((e as Error).message));
    } finally {
      setCarregando(false);
    }
  }

  async function conferir(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    setCarregando(true);
    try {
      const { error } = await sb.auth.verifyOtp({
        phone: paraE164(telefone),
        token: codigo.trim(),
        type: "sms", // vale para SMS e WhatsApp no Supabase
      });
      if (error) throw error;
      router.replace(proximo);
      router.refresh();
    } catch (e) {
      setErro(traduzir((e as Error).message));
    } finally {
      setCarregando(false);
    }
  }

  if (etapa === "codigo") {
    return (
      <form onSubmit={conferir} className="cartao space-y-4">
        <div>
          <div className="rotulo">Código recebido</div>
          <input
            className="campo text-center text-2xl tracking-[.5em] font-bold"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            placeholder="000000"
            value={codigo}
            onChange={(e) => setCodigo(e.target.value.replace(/\D/g, ""))}
          />
          <p className="text-texto3 text-[12px] mt-2">Enviado para o WhatsApp {telefone}</p>
        </div>

        {erro && <p className="text-sangue text-[13px] leading-snug">{erro}</p>}

        <button className="btn-pri" disabled={carregando || codigo.length < 6}>
          {carregando ? "Conferindo…" : "Entrar"}
        </button>
        <button
          type="button"
          className="btn-sec"
          onClick={() => {
            setEtapa("identificar");
            setCodigo("");
            setErro(null);
          }}
        >
          Trocar número
        </button>
      </form>
    );
  }

  return (
    <form onSubmit={enviar} className="cartao space-y-4">
      <div>
        <div className="rotulo">{porWhats ? "Seu WhatsApp" : "Seu e-mail"}</div>
        {porWhats ? (
          <input
            className="campo"
            inputMode="tel"
            autoComplete="tel"
            placeholder="(34) 99999-9999"
            value={telefone}
            onChange={(e) => setTelefone(mascara(e.target.value))}
          />
        ) : (
          <input
            className="campo"
            type="email"
            autoComplete="email"
            placeholder="professor@simple.com.br"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        )}
      </div>

      {erro && <p className="text-sangue text-[13px] leading-snug">{erro}</p>}
      {aviso && <p className="text-ok text-[13px] leading-snug">{aviso}</p>}

      <button className="btn-pri" disabled={carregando}>
        {carregando
          ? "Enviando…"
          : porWhats
            ? "Receber código no WhatsApp"
            : "Receber link por e-mail"}
      </button>

      <p className="text-texto3 text-[11.5px] leading-relaxed text-center">
        Acesso só para a equipe da escola. Se o seu número não estiver cadastrado,
        fale com o professor responsável.
      </p>
    </form>
  );
}

export default function Entrar() {
  return (
    <main className="min-h-dvh flex flex-col items-center justify-center px-6 py-10">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center mb-9">
          <Image src="/simbolo-claro.png" alt="Simple" width={92} height={92} priority />
          <h1 className="mt-5 text-2xl font-extrabold tracking-tight">Simple</h1>
          <p className="text-texto2 text-sm mt-1">Jiu-Jitsu · área do professor</p>
        </div>
        <Suspense fallback={<div className="cartao h-52 animate-pulse" />}>
          <Formulario />
        </Suspense>
      </div>
    </main>
  );
}
