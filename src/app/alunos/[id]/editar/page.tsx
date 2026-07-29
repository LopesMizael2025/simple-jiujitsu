"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase";
import { Shell } from "@/components/Shell";
import { SeletorGraduacao, type Faixa } from "@/components/Graduacao";
import { carregarImagem, extrairDescritor, prepararMotor, redimensionar } from "@/lib/face";

type Turma = { id: string; nome: string };

export default function EditarAluno({ params }: { params: { id: string } }) {
  const router = useRouter();
  const [sb] = useState(() => supabaseBrowser());
  const fotoRef = useRef<HTMLInputElement>(null);

  const [carregando, setCarregando] = useState(true);
  const [faixas, setFaixas] = useState<Faixa[]>([]);
  const [turmas, setTurmas] = useState<Turma[]>([]);

  const [nome, setNome] = useState("");
  const [nascimento, setNascimento] = useState("");
  const [telefone, setTelefone] = useState("");
  const [faixaId, setFaixaId] = useState("");
  const [graus, setGraus] = useState(0);
  const [aulasCiclo, setAulasCiclo] = useState(0);
  const [status, setStatus] = useState("ativo");
  const [observacoes, setObservacoes] = useState("");

  const [respNome, setRespNome] = useState("");
  const [respTel, setRespTel] = useState("");
  const [respParentesco, setRespParentesco] = useState("");

  const [turmasSel, setTurmasSel] = useState<Set<string>>(new Set());

  // estado original, para saber o que mudou
  const [orig, setOrig] = useState({ faixaId: "", graus: 0, turmas: new Set<string>() });

  const [temBio, setTemBio] = useState(false);
  const [consBio, setConsBio] = useState(false);
  const [novoRosto, setNovoRosto] = useState<{ descritor: number[]; score: number; thumb: string } | null>(null);
  const [analisando, setAnalisando] = useState(false);
  const [statusRosto, setStatusRosto] = useState<string | null>(null);

  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const menor = ehMenor(nascimento);

  // ------------------------------------------------------------- carga ----
  useEffect(() => {
    (async () => {
      const [{ data: a }, { data: f }, { data: t }, { data: m }, { data: bio }, { data: cons }] =
        await Promise.all([
          sb
            .from("aluno")
            .select(
              "nome, nascimento, telefone, faixa_id, graus, aulas_no_ciclo, status, observacoes, responsavel_nome, responsavel_telefone, responsavel_parentesco"
            )
            .eq("id", params.id)
            .maybeSingle(),
          sb.from("faixa").select("id, nome, cor_hex, kids, ordem, graus_max").order("ordem"),
          sb.from("turma").select("id, nome").eq("ativo", true).order("nome"),
          sb.from("matricula").select("turma_id").eq("aluno_id", params.id).eq("ativo", true),
          sb.from("face_template").select("id").eq("aluno_id", params.id),
          sb
            .from("consentimento")
            .select("concedido")
            .eq("aluno_id", params.id)
            .eq("tipo", "biometria")
            .order("criado_em", { ascending: false })
            .limit(1),
        ]);

      if (!a) {
        setErro("Aluno não encontrado.");
        setCarregando(false);
        return;
      }

      setNome(a.nome ?? "");
      setNascimento(a.nascimento ?? "");
      setTelefone(a.telefone ?? "");
      setFaixaId(a.faixa_id ?? "");
      setGraus(a.graus ?? 0);
      setAulasCiclo(a.aulas_no_ciclo ?? 0);
      setStatus(a.status ?? "ativo");
      setObservacoes(a.observacoes ?? "");
      setRespNome(a.responsavel_nome ?? "");
      setRespTel(a.responsavel_telefone ?? "");
      setRespParentesco(a.responsavel_parentesco ?? "");

      setFaixas((f ?? []) as Faixa[]);
      setTurmas((t ?? []) as Turma[]);

      const sel = new Set(((m ?? []) as { turma_id: string }[]).map((x) => x.turma_id));
      setTurmasSel(sel);
      setOrig({ faixaId: a.faixa_id ?? "", graus: a.graus ?? 0, turmas: sel });

      setTemBio((bio ?? []).length > 0);
      setConsBio(((cons ?? []) as { concedido: boolean }[])[0]?.concedido ?? false);
      setCarregando(false);
    })();
    prepararMotor().catch(() => {});
  }, [sb, params.id]);

  // ------------------------------------------------------------- rosto ----
  async function lerRosto(file: File) {
    setAnalisando(true);
    setStatusRosto(null);
    try {
      await prepararMotor(setStatusRosto);
      const img = await redimensionar(await carregarImagem(file), 1200);
      const r = await extrairDescritor(img);
      if (!r) {
        setStatusRosto("Não achei um rosto nítido. De frente, boa luz, só o aluno.");
        setNovoRosto(null);
      } else {
        setNovoRosto(r);
        setStatusRosto(null);
      }
    } catch (e) {
      setStatusRosto((e as Error).message);
    } finally {
      setAnalisando(false);
    }
  }

  // ------------------------------------------------------------ salvar ----
  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);

    if (!nome.trim()) return setErro("O nome não pode ficar vazio.");
    if (menor && !respNome.trim()) return setErro("Aluno menor de idade precisa de responsável.");

    setSalvando(true);
    try {
      const { data: escolaId } = await sb.rpc("minha_escola");

      const { error: e1 } = await sb
        .from("aluno")
        .update({
          nome: nome.trim(),
          nascimento: nascimento || null,
          telefone: telefone.trim() || null,
          faixa_id: faixaId || null,
          graus,
          aulas_no_ciclo: aulasCiclo,
          status,
          observacoes: observacoes.trim() || null,
          responsavel_nome: respNome.trim() || null,
          responsavel_telefone: respTel.trim() || null,
          responsavel_parentesco: respParentesco.trim() || null,
        })
        .eq("id", params.id);
      if (e1) throw e1;

      // Subiu de faixa ou ganhou grau? Vira registro no histórico de graduação.
      const subiuFaixa = faixaId && faixaId !== orig.faixaId;
      const subiuGrau = faixaId === orig.faixaId && graus > orig.graus;
      if (faixaId && (subiuFaixa || subiuGrau)) {
        await sb.from("graduacao").insert({
          escola_id: escolaId,
          aluno_id: params.id,
          faixa_id: faixaId,
          graus,
          aulas_no_ciclo: aulasCiclo,
        });
      }

      // Turmas: aplica só a diferença
      const entrou = [...turmasSel].filter((t) => !orig.turmas.has(t));
      const saiu = [...orig.turmas].filter((t) => !turmasSel.has(t));

      if (entrou.length) {
        const { error } = await sb
          .from("matricula")
          .upsert(
            entrou.map((turma_id) => ({ turma_id, aluno_id: params.id, ativo: true })),
            { onConflict: "turma_id,aluno_id" }
          );
        if (error) throw error;
      }
      if (saiu.length) {
        const { error } = await sb
          .from("matricula")
          .delete()
          .eq("aluno_id", params.id)
          .in("turma_id", saiu);
        if (error) throw error;
      }

      // Rosto novo substitui o anterior (um template por aluno neste fluxo)
      if (novoRosto && consBio) {
        await sb.from("face_template").delete().eq("aluno_id", params.id);
        const { error } = await sb.from("face_template").insert({
          escola_id: escolaId,
          aluno_id: params.id,
          embedding: JSON.stringify(novoRosto.descritor),
          qualidade: novoRosto.score,
        });
        if (error) throw error;
      }

      router.push(`/alunos/${params.id}`);
      router.refresh();
    } catch (e) {
      setErro((e as Error).message || "Não consegui salvar.");
    } finally {
      setSalvando(false);
    }
  }

  if (carregando) {
    return (
      <Shell titulo="Editar aluno" subtitulo="Carregando…">
        <div className="cartao h-40 animate-pulse" />
      </Shell>
    );
  }

  return (
    <Shell titulo="Editar aluno" subtitulo={nome}>
      <form onSubmit={salvar} className="space-y-3">
        <section className="cartao space-y-3">
          <div className="rotulo">Dados do aluno</div>
          <input className="campo" placeholder="Nome completo" value={nome} onChange={(e) => setNome(e.target.value)} />
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] text-texto3 block mb-1.5">Nascimento</label>
              <input className="campo" type="date" value={nascimento} onChange={(e) => setNascimento(e.target.value)} />
            </div>
            <div>
              <label className="text-[11px] text-texto3 block mb-1.5">Telefone</label>
              <input className="campo" inputMode="tel" value={telefone} onChange={(e) => setTelefone(e.target.value)} />
            </div>
          </div>
        </section>

        <section className="cartao space-y-3">
          <div className="rotulo">Graduação</div>
          <SeletorGraduacao
            faixas={faixas}
            faixaId={faixaId}
            graus={graus}
            onFaixa={setFaixaId}
            onGraus={setGraus}
            mostrarKids
          />
          <div>
            <label className="text-[11px] text-texto3 block mb-1.5">Aulas no ciclo atual</label>
            <input
              className="campo"
              type="number"
              min={0}
              value={aulasCiclo}
              onChange={(e) => setAulasCiclo(Math.max(0, Number(e.target.value) || 0))}
            />
            <p className="text-[11px] text-texto3 mt-2 leading-relaxed">
              É o contador que alimenta o próximo grau. A chamada soma sozinha — zere aqui quando
              graduar o aluno.
            </p>
          </div>
        </section>

        {menor && (
          <section className="cartao space-y-3 border-[#2c4a63]">
            <div className="rotulo text-[#4d9fff]">Responsável legal</div>
            <input className="campo" placeholder="Nome do responsável" value={respNome} onChange={(e) => setRespNome(e.target.value)} />
            <div className="grid grid-cols-2 gap-3">
              <input className="campo" inputMode="tel" placeholder="Telefone" value={respTel} onChange={(e) => setRespTel(e.target.value)} />
              <input className="campo" placeholder="Mãe, pai, avó…" value={respParentesco} onChange={(e) => setRespParentesco(e.target.value)} />
            </div>
          </section>
        )}

        <section className="cartao">
          <div className="rotulo">Turmas</div>
          <div className="flex flex-wrap gap-2">
            {turmas.map((t) => {
              const on = turmasSel.has(t.id);
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() =>
                    setTurmasSel((s) => {
                      const n = new Set(s);
                      if (n.has(t.id)) n.delete(t.id);
                      else n.add(t.id);
                      return n;
                    })
                  }
                  className={`text-[12px] font-semibold px-3 py-2 rounded-lg border transition ${
                    on ? "bg-ok/12 border-ok text-ok" : "bg-painel border-borda text-texto2"
                  }`}
                >
                  {t.nome}
                </button>
              );
            })}
          </div>
        </section>

        <section className="cartao">
          <div className="rotulo">Situação</div>
          <div className="flex gap-2">
            {[
              ["ativo", "Ativo"],
              ["trancado", "Trancado"],
              ["evadido", "Evadido"],
            ].map(([v, r]) => (
              <button
                key={v}
                type="button"
                onClick={() => setStatus(v)}
                className={`flex-1 text-[12.5px] font-semibold px-3 py-2.5 rounded-lg border transition ${
                  status === v ? "bg-ok/12 border-ok text-ok" : "bg-painel border-borda text-texto2"
                }`}
              >
                {r}
              </button>
            ))}
          </div>
        </section>

        <section className="cartao">
          <div className="rotulo">Rosto para a chamada</div>
          <input
            ref={fotoRef}
            type="file"
            accept="image/*"
            capture="user"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) lerRosto(f);
              e.target.value = "";
            }}
          />
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={() => fotoRef.current?.click()}
              disabled={!consBio}
              className="w-[86px] h-[86px] rounded-2xl border-2 border-dashed border-borda2 grid place-items-center
                         overflow-hidden shrink-0 bg-painel disabled:opacity-40"
            >
              {novoRosto ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={novoRosto.thumb} alt="Novo rosto" className="w-full h-full object-cover" />
              ) : (
                <span className="text-texto3 text-[26px]">{temBio ? "↻" : "+"}</span>
              )}
            </button>
            <div className="min-w-0 flex-1 text-[12px] leading-relaxed">
              {!consBio ? (
                <p className="text-atencao">
                  Sem consentimento biométrico ativo. Este aluno só entra na chamada manual.
                </p>
              ) : analisando ? (
                <p className="text-texto2">{statusRosto || "Analisando…"}</p>
              ) : novoRosto ? (
                <p className="text-ok">
                  Rosto novo pronto ({Math.round(novoRosto.score * 100)}% de nitidez). Substitui o
                  anterior ao salvar.
                </p>
              ) : (
                <p className="text-texto2">
                  {temBio
                    ? "Já tem rosto cadastrado. Toque para substituir por uma foto melhor."
                    : "Ainda sem rosto. Toque para cadastrar."}
                </p>
              )}
              {statusRosto && !analisando && <p className="text-atencao mt-1.5">{statusRosto}</p>}
            </div>
          </div>
        </section>

        <section className="cartao">
          <div className="rotulo">Observações</div>
          <textarea
            className="campo min-h-[80px] resize-y"
            placeholder="Lesão, restrição, histórico…"
            value={observacoes}
            onChange={(e) => setObservacoes(e.target.value)}
          />
        </section>

        {erro && <p className="text-sangue text-[13px] leading-snug px-1">{erro}</p>}

        <button className="btn-pri" disabled={salvando}>
          {salvando ? "Salvando…" : "Salvar alterações"}
        </button>
        <button type="button" className="btn-sec" onClick={() => router.back()}>
          Cancelar
        </button>
      </form>
    </Shell>
  );
}

function ehMenor(nascimento: string) {
  if (!nascimento) return false;
  const d = new Date(nascimento);
  if (Number.isNaN(d.getTime())) return false;
  const limite = new Date();
  limite.setFullYear(limite.getFullYear() - 18);
  return d > limite;
}
