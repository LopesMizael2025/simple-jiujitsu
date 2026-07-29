"use client";

import { Suspense, useEffect, useState } from "react";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase";

const MODO = process.env.NEXT_PUBLIC_AUTH_MODE ?? "whatsapp";
const LEMBRAR = "simple:ultimo-acesso";

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
  if (m.includes("rate") || m.includes("too many"))
    return "Muitos pedidos seguidos. Espere um minuto e tente de novo.";
  if (m.includes("phone") && m.includes("provider")) return "Login por WhatsApp ainda não configurado.";
  if (m.includes("signups not allowed")) return "Este acesso não está autorizado.";
  return msg;
}

function Formulario() {
  const router = useRouter();
  const proximo = useSearchParams().get("proximo") || "/inicio";
  const [sb] = useState(() => supabaseBrowser());

  const porWhats = MODO === "whatsapp";

  const [etapa, setEtapa] = useState<"conferindo" | "identificar" | "codigo" | "enviado">("conferindo");
  const [telefone, setTelefone] = useState("");
  const [email, setEmail] = useState("");
  const [codigo, setCodigo] = useState("");
  const [lembrado, setLembrado] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  // 1) Já tem sessão viva? Entra direto, sem pedir nada.
  // 2) Senão, recupera o último acesso para deixar a um toque.
  useEffect(() => {
    (async () => {
      const { data } = await sb.auth.getSession();
      if (data.session) {
        router.replace(proximo);
        return;
      }
      const salvo = localStorage.getItem(LEMBRAR);
      if (salvo) {
        setLembrado(salvo);
        if (porWhats) setTelefone(salvo);
        else setEmail(salvo);
      }
      setEtapa("identificar");
    })();
  }, [sb, router, proximo, porWhats]);

  async function enviar(e?: React.FormEvent) {
    e?.preventDefault();
    setErro(null);
    setCarregando(true);
    try {
      if (porWhats) {
        const phone = paraE164(telefone);
        if (phone.length < 13) throw new Error("Digite o DDD e o número completo.");
        const { error } = await sb.auth.signInWithOtp({ phone, options: { channel: "whatsapp" } });
        if (error) throw error;
        localStorage.setItem(LEMBRAR, telefone);
        setEtapa("codigo");
      } else {
        const alvo = email.trim();
        if (!alvo.includes("@")) throw new Error("Digite um e-mail válido.");
        const { error } = await sb.auth.signInWithOtp({
          email: alvo,
          options: {
            emailRedirectTo: `${location.origin}/auth/callback?proximo=${encodeURIComponent(proximo)}`,
          },
        });
        if (error) throw error;
        localStorage.setItem(LEMBRAR, alvo);
        setEtapa("enviado");
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

  function trocar() {
    localStorage.removeItem(LEMBRAR);
    setLembrado(null);
    setEmail("");
    setTelefone("");
    setCodigo("");
    setErro(null);
    setEtapa("identificar");
  }

  // ------------------------------------------------------ conferindo ----
  if (etapa === "conferindo") {
    return (
      <div className="cartao py-10 text-center">
        <div className="w-8 h-8 mx-auto rounded-full border-[3px] border-borda border-t-ok animate-spin" />
        <p className="text-texto2 text-[13px] mt-4">Verificando seu acesso…</p>
      </div>
    );
  }

  // --------------------------------------------------------- enviado ----
  if (etapa === "enviado") {
    return (
      <div className="cartao text-center space-y-4">
        <div className="w-12 h-12 mx-auto rounded-full bg-ok/12 grid place-items-center">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#2EE6A8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="2" y="4" width="20" height="16" rx="2" />
            <path d="m22 6-10 7L2 6" />
          </svg>
        </div>
        <div>
          <p className="font-bold text-[15px]">Link enviado</p>
          <p className="text-texto2 text-[13px] mt-1.5 leading-relaxed">
            Abra o e-mail que chegou em <b className="text-texto">{email}</b> e toque no link.
          </p>
        </div>
        <p className="text-texto3 text-[11.5px] leading-relaxed">
          Abra <b className="text-texto2">neste mesmo aparelho</b> — se abrir em outro, o acesso não
          vale. Não chegou? Confira o spam.
        </p>
        <button className="btn-sec" onClick={() => enviar()} disabled={carregando}>
          {carregando ? "Reenviando…" : "Reenviar link"}
        </button>
        <button className="text-texto3 text-[12px] underline w-full" onClick={trocar}>
          Usar outro e-mail
        </button>
      </div>
    );
  }

  // ---------------------------------------------------------- código ----
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
        <button type="button" className="btn-sec" onClick={trocar}>
          Trocar número
        </button>
      </form>
    );
  }

  // ----------------------------------------------------- identificar ----
  return (
    <form onSubmit={enviar} className="cartao space-y-4">
      {lembrado ? (
        <>
          <div className="text-center">
            <div className="rotulo mb-3">Continuar como</div>
            <div className="bg-painel border border-borda rounded-xl px-4 py-3 font-semibold text-[14px] break-all">
              {lembrado}
            </div>
          </div>
          {erro && <p className="text-sangue text-[13px] leading-snug">{erro}</p>}
          <button className="btn-pri" disabled={carregando}>
            {carregando ? "Enviando…" : porWhats ? "Receber código" : "Receber link de acesso"}
          </button>
          <button type="button" className="btn-sec" onClick={trocar}>
            Não sou eu
          </button>
        </>
      ) : (
        <>
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
          <button className="btn-pri" disabled={carregando}>
            {carregando ? "Enviando…" : porWhats ? "Receber código no WhatsApp" : "Receber link por e-mail"}
          </button>
        </>
      )}

      <p className="text-texto3 text-[11.5px] leading-relaxed text-center">
        Você só faz isso uma vez por aparelho — depois o app abre direto.
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
