"use client";

import { useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase";

export default function Vincular() {
  const router = useRouter();
  const [sb] = useState(() => supabaseBrowser());
  const [nome, setNome] = useState("");
  const [codigo, setCodigo] = useState("");
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function entrar(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    setCarregando(true);
    try {
      const { data: sessao } = await sb.auth.getUser();
      if (!sessao.user) throw new Error("Sessão expirada. Entre de novo.");

      const { error: erroRpc } = await sb.rpc("vincular_escola", { p_codigo: codigo });
      if (erroRpc) throw new Error("Código não encontrado. Confira com o professor responsável.");

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

  return (
    <main className="min-h-dvh flex flex-col items-center justify-center px-6 py-10">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center mb-8">
          <Image src="/simbolo-claro.png" alt="Simple" width={72} height={72} />
          <h1 className="mt-4 text-xl font-extrabold">Quase lá</h1>
          <p className="text-texto2 text-[13px] mt-1 text-center">
            Digite o código da sua escola para liberar o acesso.
          </p>
        </div>

        <form onSubmit={entrar} className="cartao space-y-4">
          <div>
            <div className="rotulo">Seu nome</div>
            <input
              className="campo"
              placeholder="Como os alunos te chamam"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
            />
          </div>
          <div>
            <div className="rotulo">Código da escola</div>
            <input
              className="campo uppercase tracking-widest font-bold"
              placeholder="SIMPLE2026"
              value={codigo}
              onChange={(e) => setCodigo(e.target.value.toUpperCase())}
            />
          </div>

          {erro && <p className="text-sangue text-[13px] leading-snug">{erro}</p>}

          <button className="btn-pri" disabled={carregando || !codigo.trim()}>
            {carregando ? "Entrando…" : "Entrar na escola"}
          </button>
        </form>
      </div>
    </main>
  );
}
