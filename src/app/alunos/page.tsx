"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabaseBrowser } from "@/lib/supabase";
import { Shell, Selo, Vazio, Foto } from "@/components/Shell";
import { normalizar } from "@/lib/csv";

type Aluno = {
  aluno_id: string;
  nome: string;
  status: string;
  faixa: string | null;
  cor_hex: string | null;
  graus: number;
  aulas_30d: number;
  dias_sem_treinar: number | null;
  foto_thumb: string | null;
};

type Filtro = "todos" | "sem_rosto" | "sumidos" | "kids";

export default function Alunos() {
  const [sb] = useState(() => supabaseBrowser());
  const [alunos, setAlunos] = useState<Aluno[]>([]);
  const [comBio, setComBio] = useState<Set<string>>(new Set());
  const [kids, setKids] = useState<Set<string>>(new Set());
  const [carregando, setCarregando] = useState(true);
  const [busca, setBusca] = useState("");
  const [filtro, setFiltro] = useState<Filtro>("todos");

  useEffect(() => {
    (async () => {
      const [{ data: a }, { data: bio }, { data: mat }] = await Promise.all([
        sb
          .from("v_aluno_frequencia")
          .select("aluno_id, nome, status, faixa, cor_hex, graus, aulas_30d, dias_sem_treinar, foto_thumb")
          .eq("status", "ativo")
          .order("nome"),
        sb.from("face_template").select("aluno_id"),
        sb.from("matricula").select("aluno_id, turma:turma(faixa_etaria)").eq("ativo", true),
      ]);

      setAlunos((a ?? []) as Aluno[]);
      setComBio(new Set(((bio ?? []) as { aluno_id: string }[]).map((b) => b.aluno_id)));
      setKids(
        new Set(
          ((mat ?? []) as any[])
            .filter((m) => m.turma?.faixa_etaria === "kids")
            .map((m) => m.aluno_id as string)
        )
      );
      setCarregando(false);
    })();
  }, [sb]);

  const visiveis = useMemo(() => {
    const termo = normalizar(busca);
    return alunos.filter((a) => {
      if (termo && !normalizar(a.nome).includes(termo)) return false;
      if (filtro === "sem_rosto" && comBio.has(a.aluno_id)) return false;
      if (filtro === "sumidos" && !(a.dias_sem_treinar != null && a.dias_sem_treinar >= 14)) return false;
      if (filtro === "kids" && !kids.has(a.aluno_id)) return false;
      return true;
    });
  }, [alunos, busca, filtro, comBio, kids]);

  const semRosto = alunos.filter((a) => !comBio.has(a.aluno_id)).length;
  const sumidos = alunos.filter((a) => a.dias_sem_treinar != null && a.dias_sem_treinar >= 14).length;

  const FILTROS: { id: Filtro; rotulo: string; contagem: number }[] = [
    { id: "todos", rotulo: "Todos", contagem: alunos.length },
    { id: "sem_rosto", rotulo: "Sem rosto", contagem: semRosto },
    { id: "sumidos", rotulo: "Sumidos", contagem: sumidos },
    { id: "kids", rotulo: "Kids", contagem: kids.size },
  ];

  return (
    <Shell
      titulo="Alunos"
      subtitulo={carregando ? "Carregando…" : `${alunos.length} ativos`}
      acao={
        <div className="flex items-center gap-1 shrink-0">
          <Link
            href="/alunos/importar"
            className="w-11 h-11 grid place-items-center text-texto2 hover:text-texto"
            aria-label="Importar alunos de um arquivo"
            title="Importar de CSV"
          >
            <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" />
            </svg>
          </Link>
          <Link
            href="/alunos/novo"
            className="w-11 h-11 grid place-items-center bg-ok text-[#04231b] rounded-xl font-black text-xl"
            aria-label="Novo aluno"
          >
            +
          </Link>
        </div>
      }
    >
      <div className="relative">
        <svg
          width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"
          className="absolute left-3.5 top-1/2 -translate-y-1/2 text-texto3 pointer-events-none"
        >
          <circle cx="11" cy="11" r="7" />
          <path d="m20 20-3.5-3.5" strokeLinecap="round" />
        </svg>
        <input
          className="campo !pl-11 !pr-12"
          inputMode="search"
          placeholder="Buscar por nome…"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
        />
        {busca && (
          <button
            onClick={() => setBusca("")}
            className="absolute right-0 top-1/2 -translate-y-1/2 w-11 h-11 grid place-items-center text-texto3"
            aria-label="Limpar busca"
          >
            ✕
          </button>
        )}
      </div>

      <div className="flex gap-2 overflow-x-auto -mx-4 px-4 pb-1">
        {FILTROS.map((f) => (
          <button
            key={f.id}
            onClick={() => setFiltro(f.id)}
            className={`shrink-0 text-[12px] font-bold px-3.5 rounded-lg border transition min-h-[40px] ${
              filtro === f.id ? "bg-ok/12 border-ok text-ok" : "bg-painel border-borda text-texto2"
            }`}
          >
            {f.rotulo} {f.contagem > 0 && <span className="opacity-70">{f.contagem}</span>}
          </button>
        ))}
      </div>

      {carregando ? (
        <>
          <div className="cartao h-[70px] animate-pulse" />
          <div className="cartao h-[70px] animate-pulse" />
          <div className="cartao h-[70px] animate-pulse" />
        </>
      ) : alunos.length === 0 ? (
        <Vazio
          titulo="Nenhum aluno ainda"
          texto="O caminho rápido é importar as respostas do formulário. Cadastrar um por um leva horas."
          acao={
            <div className="space-y-2">
              <Link href="/alunos/importar" className="btn-pri">
                Importar de um arquivo
              </Link>
              <Link href="/alunos/novo" className="btn-sec">
                Cadastrar um aluno
              </Link>
            </div>
          }
        />
      ) : visiveis.length === 0 ? (
        <Vazio
          titulo="Nada encontrado"
          texto={busca ? `Nenhum aluno com "${busca}".` : "Nenhum aluno nesse filtro."}
          acao={
            <button
              className="btn-sec"
              onClick={() => {
                setBusca("");
                setFiltro("todos");
              }}
            >
              Limpar filtros
            </button>
          }
        />
      ) : (
        <>
          {filtro === "sem_rosto" && semRosto > 0 && (
            <div className="cartao !p-3.5 border-atencao/30">
              <p className="text-[12.5px] text-texto2 leading-relaxed">
                Estes não aparecem na chamada por foto. Abra a ficha, toque em Editar e capture o
                rosto — dá para fazer no início da aula, em segundos por aluno.
              </p>
            </div>
          )}

          {visiveis.map((a) => (
            <Link
              key={a.aluno_id}
              href={`/alunos/${a.aluno_id}`}
              className="cartao !p-3 flex items-center gap-3 hover:border-borda2 transition"
            >
              <Foto src={a.foto_thumb} nome={a.nome} cor={a.cor_hex} tamanho={46} />
              <div className="min-w-0 flex-1">
                <div className="font-semibold text-[14px] truncate">{a.nome}</div>
                <div className="flex items-center gap-1.5 mt-1">
                  <span
                    className="w-2.5 h-2.5 rounded-sm shrink-0"
                    style={{ background: a.cor_hex ?? "#5D738C" }}
                  />
                  <span className="text-[11.5px] text-texto2 truncate">
                    {a.faixa ?? "Sem faixa"} · {a.graus} {a.graus === 1 ? "grau" : "graus"} ·{" "}
                    {a.aulas_30d} aulas/30d
                  </span>
                </div>
              </div>
              {!comBio.has(a.aluno_id) ? (
                <Selo tom="neutro">Sem rosto</Selo>
              ) : a.dias_sem_treinar != null && a.dias_sem_treinar >= 14 ? (
                <Selo tom="perigo">{a.dias_sem_treinar}d</Selo>
              ) : (
                <Selo tom="ok">Ativo</Selo>
              )}
            </Link>
          ))}

          <p className="text-[11.5px] text-texto3 text-center py-2">
            {visiveis.length} de {alunos.length}
          </p>
        </>
      )}
    </Shell>
  );
}
