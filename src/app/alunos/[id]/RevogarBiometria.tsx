"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase";

/**
 * Revogar é inserir um consentimento negativo. O gatilho no banco apaga o
 * template na mesma transação — não existe caminho em que o vetor sobrevive.
 */
export function RevogarBiometria({ alunoId, nome }: { alunoId: string; nome: string }) {
  const router = useRouter();
  const [sb] = useState(() => supabaseBrowser());
  const [confirmando, setConfirmando] = useState(false);
  const [indo, setIndo] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function revogar() {
    setIndo(true);
    setErro(null);
    try {
      const { data: escolaId } = await sb.rpc("minha_escola");
      const { error } = await sb.from("consentimento").insert({
        escola_id: escolaId,
        aluno_id: alunoId,
        tipo: "biometria",
        concedido: false,
        base_legal: "LGPD art. 18, IX - revogação do consentimento",
        concedido_por: "revogado pelo titular/responsável",
        user_agent: navigator.userAgent.slice(0, 300),
      });
      if (error) throw error;
      setConfirmando(false);
      router.refresh();
    } catch (e) {
      setErro((e as Error).message);
    } finally {
      setIndo(false);
    }
  }

  if (!confirmando) {
    return (
      <button onClick={() => setConfirmando(true)} className="btn-perigo mt-3.5 !py-2.5 !text-[13px]">
        Revogar biometria e apagar o rosto
      </button>
    );
  }

  return (
    <div className="mt-3.5 rounded-xl border border-sangue/40 bg-sangue/5 p-3.5">
      <p className="text-[12.5px] leading-relaxed">
        Apagar o rosto de <b>{nome}</b>? O vetor some na hora e {nome.split(" ")[0]} deixa de aparecer
        na chamada por foto. A presença já registrada continua valendo.
      </p>
      {erro && <p className="text-sangue text-[12px] mt-2">{erro}</p>}
      <div className="flex gap-2 mt-3">
        <button onClick={revogar} disabled={indo} className="btn-perigo !py-2.5 !text-[13px]">
          {indo ? "Apagando…" : "Sim, apagar"}
        </button>
        <button onClick={() => setConfirmando(false)} className="btn-sec !py-2.5 !text-[13px]">
          Cancelar
        </button>
      </div>
    </div>
  );
}
