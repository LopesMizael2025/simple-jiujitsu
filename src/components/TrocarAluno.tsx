"use client";

import { useMemo, useState } from "react";
import { Foto } from "@/components/Shell";
import { normalizar } from "@/lib/csv";

export type AlunoSimples = {
  id: string;
  nome: string;
  foto_thumb?: string | null;
  faixa?: { nome: string; cor_hex: string } | null;
};

/**
 * Folha que abre quando o professor toca num rosto identificado.
 *
 * Existe porque desmarcar não bastava: se o sistema disser "Rafael" e for o
 * Bruno, o professor precisava desmarcar um e caçar o outro na lista de baixo.
 * Pior, presença creditada para a pessoa errada corrompe a contagem de
 * graduação dos dois. Aqui ele troca direto.
 */
export function TrocarAluno({
  rosto,
  atual,
  alunos,
  jaMarcados,
  aoTrocar,
  aoRemover,
  aoFechar,
}: {
  rosto?: string;
  atual: AlunoSimples | null;
  alunos: AlunoSimples[];
  jaMarcados: Set<string>;
  aoTrocar: (alunoId: string) => void;
  aoRemover: () => void;
  aoFechar: () => void;
}) {
  const [busca, setBusca] = useState("");

  const lista = useMemo(() => {
    const termo = normalizar(busca);
    return alunos
      .filter((a) => !termo || normalizar(a.nome).includes(termo))
      .slice(0, 60);
  }, [alunos, busca]);

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end bg-black/70 backdrop-blur-sm">
      <button className="flex-1" onClick={aoFechar} aria-label="Fechar" />

      <div className="bg-painel border-t border-borda2 rounded-t-3xl max-h-[82dvh] flex flex-col">
        <div className="p-4 pb-3 border-b border-borda">
          <div className="w-10 h-1 bg-borda2 rounded-full mx-auto mb-4" />

          <div className="flex items-center gap-3">
            {rosto ? (
              <div className="w-14 h-14 rounded-xl overflow-hidden shrink-0 border-2 border-atencao">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={rosto} alt="Rosto detectado" className="w-full h-full object-cover" />
              </div>
            ) : null}
            <div className="min-w-0 flex-1">
              <div className="text-[11px] font-bold tracking-widest uppercase text-texto3">
                Quem é este?
              </div>
              <div className="font-bold text-[15px] truncate mt-0.5">
                {atual ? atual.nome : "Não identificado"}
              </div>
            </div>
          </div>

          <input
            className="campo mt-3"
            inputMode="search"
            autoFocus
            placeholder="Buscar aluno da turma…"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
          />
        </div>

        <div className="overflow-y-auto flex-1 p-2">
          {lista.length === 0 ? (
            <p className="text-texto2 text-[13px] text-center py-8">
              Nenhum aluno com &ldquo;{busca}&rdquo;.
            </p>
          ) : (
            lista.map((a) => {
              const marcado = jaMarcados.has(a.id);
              const eOAtual = atual?.id === a.id;
              return (
                <button
                  key={a.id}
                  onClick={() => aoTrocar(a.id)}
                  className={`w-full flex items-center gap-3 p-2.5 rounded-xl text-left transition min-h-[60px] ${
                    eOAtual ? "bg-ok/10" : "hover:bg-cartao"
                  }`}
                >
                  <Foto src={a.foto_thumb} nome={a.nome} cor={a.faixa?.cor_hex} tamanho={40} />
                  <div className="min-w-0 flex-1">
                    <div className="text-[13.5px] font-semibold truncate">{a.nome}</div>
                    <div className="text-[11px] text-texto2">{a.faixa?.nome ?? "Sem faixa"}</div>
                  </div>
                  {eOAtual ? (
                    <span className="selo bg-ok/12 text-ok">Atual</span>
                  ) : marcado ? (
                    <span className="selo bg-atencao/12 text-atencao">Já marcado</span>
                  ) : null}
                </button>
              );
            })
          )}
        </div>

        <div className="p-4 pt-3 border-t border-borda space-y-2 pb-[calc(1rem+env(safe-area-inset-bottom))]">
          {atual && (
            <button className="btn-perigo" onClick={aoRemover}>
              Não é ninguém da turma — desmarcar
            </button>
          )}
          <button className="btn-sec" onClick={aoFechar}>
            Cancelar
          </button>
        </div>
      </div>
    </div>
  );
}
