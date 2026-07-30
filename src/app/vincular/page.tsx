"use client";

import { Suspense, useEffect, useState } from "react";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase";

/**
 * Entrada na escola por convite nominal.
 *
 * O link chega por fora (WhatsApp, e-mail, papel) e traz ?c=<token>.
 * O token vale uma vez so, por 7 dias, e apenas para o e-mail convidado --
 * essa ultima parte e o que faz o link poder circular sem virar uma senha.
 */
function Aceitar() {
  const router = useRouter();
  const token = useSearchParams().get("c")?.trim() ?? "";
  const [sb] = useState(() => supabaseBrowser());

  const [nome, setNome] = useState("");
  const [email, setEmail] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    sb.auth.getUser().then(({ data }) => setEmail(data.user?.email ?? null));
  }, [sb]);

  async function aceitar(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    setCarregando(true);
    try {
      const { data: sessao } = await sb.auth.getUser();
      if (!sessao.user) throw new Error("Sua sessão expirou. Entre de novo e reabra o convite.");

      const { error } = await sb.rpc("aceitar_convite", { p_token: token });
      if (error) throw new Error(traduzir(error.message));

      if (nome.trim()) {
        await sb.from("perfil").update({ nome: nome.trim() }).eq("id", sessao.user.id);
      }

      router.replace("/inicio");
      router.refresh();
    } catch (e) {
      setErro((e as Error).message);
    } finally {
      setCarregando(false);
    }
  }

  async function sair() {
    await sb.auth.signOut();
    router.replace("/entrar");
  }

  // ------------------------------------------------------- sem convite ----
  if (!token) {
    return (
      <div className="cartao space-y-4">
        <div>
          <p className="font-bold text-[15px]">Você precisa de um convite</p>
          <p className="text-texto2 text-[13px] mt-2 leading-relaxed">
            O acesso é liberado pelo dono da escola, que envia um link direto para o seu e-mail.
            Não existe mais código único: cada convite serve a uma pessoa só.
          </p>
        </div>
        {email && (
          <p className="text-texto3 text-[12px] leading-relaxed">
            Você está conectado como <b className="text-texto2">{email}</b>. Peça o convite para
            este mesmo endereço — o link não funciona em outro.
          </p>
        )}
        <button className="btn-sec" onClick={sair}>
          Sair
        </button>
      </div>
    );
  }

  // ------------------------------------------------------- com convite ----
  return (
    <form onSubmit={aceitar} className="cartao space-y-4">
      <div>
        <p className="font-bold text-[15px]">Você foi convidado</p>
        <p className="text-texto2 text-[13px] mt-1.5 leading-relaxed">
          {email ? (
            <>
              Este convite vale para <b className="text-texto">{email}</b>. Se não for o seu
              e-mail, saia e entre com o endereço que recebeu o convite.
            </>
          ) : (
            "Confirmando seu acesso…"
          )}
        </p>
      </div>

      <div>
        <div className="rotulo">Seu nome</div>
        <input
          className="campo"
          placeholder="Como os alunos te chamam"
          value={nome}
          onChange={(e) => setNome(e.target.value)}
        />
      </div>

      {erro && <p className="text-sangue text-[13px] leading-snug">{erro}</p>}

      <button className="btn-pri" disabled={carregando}>
        {carregando ? "Entrando…" : "Entrar na escola"}
      </button>

      <button type="button" className="text-texto3 text-[12px] underline w-full" onClick={sair}>
        Não sou eu — entrar com outro e-mail
      </button>
    </form>
  );
}

function traduzir(msg: string) {
  const m = msg.toLowerCase();
  if (m.includes("outro e-mail"))
    return "Este convite foi feito para outro e-mail. Saia e entre com o endereço que recebeu o link.";
  if (m.includes("expirado")) return "Convite expirado. Peça um novo ao dono da escola.";
  if (m.includes("ja usado")) return "Este convite já foi usado. Peça um novo ao dono da escola.";
  if (m.includes("cancelado")) return "Este convite foi cancelado pela escola.";
  if (m.includes("nao encontrado"))
    return "Convite não encontrado. Confira se copiou o link inteiro.";
  return msg;
}

export default function Vincular() {
  return (
    <main className="min-h-dvh flex flex-col items-center justify-center px-6 py-10">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center mb-8">
          <Image src="/simbolo-claro.png" alt="Simple" width={72} height={72} />
          <h1 className="mt-4 text-xl font-extrabold">Quase lá</h1>
        </div>
        <Suspense
          fallback={
            <div className="cartao py-10 text-center text-texto2 text-[13px]">Carregando…</div>
          }
        >
          <Aceitar />
        </Suspense>
      </div>
    </main>
  );
}
