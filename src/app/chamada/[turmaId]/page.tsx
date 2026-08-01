"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase";
import { Shell, Vazio, Foto } from "@/components/Shell";
import { TrocarAluno, type AlunoSimples } from "@/components/TrocarAluno";
import {
  LIMIAR,
  carregarImagem,
  detectarRostos,
  motorPronto,
  prepararMotor,
  redimensionar,
  type Deteccao,
} from "@/lib/face";

type Aluno = {
  id: string;
  nome: string;
  graus: number;
  foto_thumb: string | null;
  faixa: { nome: string; cor_hex: string } | null;
};

type Match = {
  face_idx: number;
  aluno_id: string;
  nome: string;
  faixa: string;
  cor_hex: string;
  distancia: number;
};

/** Origem de cada presença: é o que torna o dado auditável depois. */
type Marca = { origem: string; distancia?: number };
type Etapa = "camera" | "processando" | "confirmar" | "pronto";

const RASCUNHO = "simple:chamada";

/** Vibração curta — confirma a ação sem o professor precisar olhar a tela. */
function vibrar(padrao: number | number[]) {
  try {
    if (typeof navigator !== "undefined" && "vibrate" in navigator) navigator.vibrate(padrao);
  } catch {
    /* navegador sem suporte */
  }
}

export default function Chamada({ params }: { params: { turmaId: string } }) {
  const router = useRouter();
  const [sb] = useState(() => supabaseBrowser());
  const arquivoRef = useRef<HTMLInputElement>(null);

  const [turma, setTurma] = useState<{ nome: string } | null>(null);
  const [matriculados, setMatriculados] = useState<Aluno[]>([]);
  const [comBiometria, setComBiometria] = useState<Set<string>>(new Set());
  const [carregandoDados, setCarregandoDados] = useState(true);

  const [etapa, setEtapa] = useState<Etapa>("camera");
  const [status, setStatus] = useState("");
  const [erro, setErro] = useState<string | null>(null);

  const [deteccoes, setDeteccoes] = useState<Deteccao[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);
  const [presentes, setPresentes] = useState<Record<string, Marca>>({});
  const [tecnicas, setTecnicas] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [temRascunho, setTemRascunho] = useState(false);

  /** Índice do rosto aberto na folha de troca. null = fechada. */
  const [rostoAberto, setRostoAberto] = useState<number | null>(null);

  const data = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const chaveRascunho = `${RASCUNHO}:${params.turmaId}:${data}`;

  // ------------------------------------------------------------- carga ----
  useEffect(() => {
    (async () => {
      const [{ data: t }, { data: m }, { data: bio }] = await Promise.all([
        sb.from("turma").select("nome").eq("id", params.turmaId).maybeSingle(),
        sb
          .from("matricula")
          .select("aluno:aluno(id, nome, graus, foto_thumb, faixa:faixa(nome, cor_hex))")
          .eq("turma_id", params.turmaId)
          .eq("ativo", true),
        sb.from("face_template").select("aluno_id"),
      ]);

      setTurma(t);
      setMatriculados(
        ((m ?? []) as any[])
          .map((r) => r.aluno)
          .filter(Boolean)
          .sort((a: Aluno, b: Aluno) => a.nome.localeCompare(b.nome, "pt-BR"))
      );
      setComBiometria(new Set(((bio ?? []) as any[]).map((b) => b.aluno_id as string)));
      setCarregandoDados(false);

      try {
        if (localStorage.getItem(chaveRascunho)) setTemRascunho(true);
      } catch {
        /* modo privado bloqueia localStorage */
      }
    })();

    if (!motorPronto()) prepararMotor().catch(() => {});
  }, [sb, params.turmaId, chaveRascunho]);

  // Salva o rascunho a cada mudança na conferência. Se a tela fechar, a
  // internet cair ou entrar uma ligação, o trabalho do professor sobrevive.
  useEffect(() => {
    if (etapa !== "confirmar") return;
    try {
      localStorage.setItem(chaveRascunho, JSON.stringify({ presentes, tecnicas, em: Date.now() }));
    } catch {
      /* sem espaço ou modo privado */
    }
  }, [presentes, tecnicas, etapa, chaveRascunho]);

  function limparRascunho() {
    try {
      localStorage.removeItem(chaveRascunho);
    } catch {
      /* ignora */
    }
    setTemRascunho(false);
  }

  function recuperarRascunho() {
    try {
      const cru = localStorage.getItem(chaveRascunho);
      if (!cru) return;
      const r = JSON.parse(cru);
      setPresentes(r.presentes ?? {});
      setTecnicas(r.tecnicas ?? "");
      setTemRascunho(false);
      setEtapa("confirmar");
    } catch {
      setErro("Não consegui recuperar o rascunho.");
    }
  }

  // ---------------------------------------------------------- processar ---
  const processarFoto = useCallback(
    async (file: File) => {
      setErro(null);
      setEtapa("processando");
      try {
        setStatus("Preparando o reconhecimento…");
        await prepararMotor(setStatus);

        setStatus("Abrindo a foto…");
        const img = await redimensionar(await carregarImagem(file));

        setStatus("Procurando rostos…");
        const rostos = await detectarRostos(img);
        setDeteccoes(rostos);

        if (rostos.length === 0) {
          setErro("Não encontrei nenhum rosto nessa foto. Tente com mais luz ou mais perto.");
          setEtapa("camera");
          return;
        }

        setStatus(`${rostos.length} rostos encontrados. Comparando com a turma…`);
        const { data: encontrados, error } = await sb.rpc("buscar_rostos", {
          p_embeddings: rostos.map((r) => r.descritor),
          p_dist_max: LIMIAR.CONFIRMAR,
        });
        if (error) throw error;

        const lista = (encontrados ?? []) as Match[];
        setMatches(lista);

        const inicial: Record<string, Marca> = {};
        for (const m of lista) {
          if (m.distancia <= LIMIAR.AUTO) {
            inicial[m.aluno_id] = { origem: "facial", distancia: m.distancia };
          }
        }
        setPresentes(inicial);
        vibrar(30);
        setEtapa("confirmar");
      } catch (e) {
        setErro((e as Error).message || "Falhou ao processar a foto.");
        setEtapa("camera");
      }
    },
    [sb]
  );

  // ------------------------------------------------------------ gravar ----
  async function gravar() {
    setSalvando(true);
    setErro(null);
    try {
      const payload = Object.entries(presentes).map(([aluno_id, v]) => ({
        aluno_id,
        origem: v.origem,
        distancia: v.distancia ?? null,
      }));

      const { error } = await sb.rpc("registrar_chamada", {
        p_turma_id: params.turmaId,
        p_data: data,
        p_presencas: payload,
        p_tecnicas: tecnicas.trim() || null,
        p_usou_foto: deteccoes.length > 0,
        p_faces: deteccoes.length || null,
      });
      if (error) throw error;

      limparRascunho();
      vibrar([40, 60, 40]);
      setEtapa("pronto");
    } catch (e) {
      setErro(
        (e as Error).message ||
          "Não consegui gravar. Suas marcações estão salvas neste aparelho — tente de novo."
      );
    } finally {
      setSalvando(false);
    }
  }

  // ------------------------------------------------------------ helpers ---
  const alternar = (id: string, origem = "manual") =>
    setPresentes((p) => {
      const n = { ...p };
      if (n[id]) delete n[id];
      else n[id] = { origem };
      return n;
    });

  /** Troca quem está atribuído a um rosto detectado. */
  function trocarRosto(faceIdx: number, novoAlunoId: string) {
    const anterior = matches.find((m) => m.face_idx === faceIdx);
    const aluno = matriculados.find((a) => a.id === novoAlunoId);
    if (!aluno) return;

    setMatches((ms) =>
      [
        ...ms.filter((m) => m.face_idx !== faceIdx),
        {
          face_idx: faceIdx,
          aluno_id: aluno.id,
          nome: aluno.nome,
          faixa: aluno.faixa?.nome ?? "—",
          cor_hex: aluno.faixa?.cor_hex ?? "#F2F0EE",
          distancia: 0, // corrigido à mão: não veio de medida
        },
      ].sort((a, b) => a.face_idx - b.face_idx)
    );

    setPresentes((p) => {
      const n = { ...p };
      if (anterior) delete n[anterior.aluno_id];
      n[aluno.id] = { origem: "corrigido" };
      return n;
    });

    setRostoAberto(null);
    vibrar(20);
  }

  function removerRosto(faceIdx: number) {
    const alvo = matches.find((m) => m.face_idx === faceIdx);
    if (alvo) {
      setPresentes((p) => {
        const n = { ...p };
        delete n[alvo.aluno_id];
        return n;
      });
      setMatches((ms) => ms.filter((m) => m.face_idx !== faceIdx));
    }
    setRostoAberto(null);
  }

  const total = Object.keys(presentes).length;
  const autos = matches.filter((m) => m.distancia > 0 && m.distancia <= LIMIAR.AUTO);
  const duvidas = matches.filter((m) => m.distancia > LIMIAR.AUTO);
  const corrigidos = matches.filter((m) => m.distancia === 0);
  const idsAchados = new Set(matches.map((m) => m.aluno_id));
  const naoAchados = matriculados.filter((a) => !idsAchados.has(a.id));
  const semRosto = deteccoes.length - matches.length;

  const paraFolha: AlunoSimples[] = matriculados.map((a) => ({
    id: a.id,
    nome: a.nome,
    foto_thumb: a.foto_thumb,
    faixa: a.faixa,
  }));

  // ================================================================ UI ====
  if (carregandoDados) {
    return (
      <Shell titulo="Chamada" subtitulo="Carregando…">
        <div className="cartao h-32 animate-pulse" />
      </Shell>
    );
  }

  if (etapa === "pronto") {
    return (
      <Shell titulo="Aula registrada" subtitulo={turma?.nome}>
        <div className="cartao border-ok/40 bg-gradient-to-br from-ok/10 to-transparent text-center py-8">
          <div className="text-[44px] font-extrabold text-ok tracking-tighter leading-none">{total}</div>
          <p className="text-texto2 text-[13px] mt-2">presenças gravadas</p>
        </div>
        <div className="cartao">
          <div className="rotulo">O que foi feito em seguida</div>
          <ul className="space-y-2.5 text-[12.5px] leading-relaxed">
            <li className="flex gap-2.5">
              <span className="text-ok font-bold">✓</span> Contador de aulas para graduação atualizado
            </li>
            <li className="flex gap-2.5">
              <span className="text-ok font-bold">✓</span> Frequência de cada aluno recalculada
            </li>
            <li className="flex gap-2.5">
              <span className="text-ok font-bold">✓</span>
              <span>
                <b>A foto da turma não foi enviada para lugar nenhum.</b> O reconhecimento rodou
                aqui no aparelho e só o registro de presença foi salvo.
              </span>
            </li>
          </ul>
        </div>
        <button className="btn-pri" onClick={() => router.push("/inicio")}>
          Voltar ao início
        </button>
        <button
          className="btn-sec"
          onClick={() => {
            setEtapa("camera");
            setDeteccoes([]);
            setMatches([]);
            setPresentes({});
          }}
        >
          Refazer esta chamada
        </button>
      </Shell>
    );
  }

  if (etapa === "processando") {
    return (
      <Shell titulo="Identificando…" subtitulo={turma?.nome}>
        <div className="cartao py-12 text-center">
          <div className="w-12 h-12 mx-auto rounded-full border-[3px] border-borda border-t-ok animate-spin" />
          <p className="text-texto2 text-[13px] mt-5">{status}</p>
        </div>
      </Shell>
    );
  }

  if (etapa === "camera") {
    return (
      <Shell titulo="Chamada por foto" subtitulo={turma?.nome}>
        {temRascunho && (
          <div className="cartao border-atencao/40">
            <div className="rotulo text-atencao">Chamada não finalizada</div>
            <p className="text-[12.5px] text-texto2 leading-relaxed">
              Você começou a conferir esta turma hoje e não gravou. As marcações estão salvas neste
              aparelho.
            </p>
            <div className="mt-3 space-y-2">
              <button className="btn-pri !py-2.5 !text-[13px]" onClick={recuperarRascunho}>
                Retomar de onde parei
              </button>
              <button className="btn-sec !py-2.5 !text-[13px]" onClick={limparRascunho}>
                Descartar e começar de novo
              </button>
            </div>
          </div>
        )}

        {matriculados.length === 0 && (
          <Vazio
            titulo="Turma sem alunos"
            texto="Matricule alunos nesta turma antes de fazer a chamada."
            acao={
              <button className="btn-sec" onClick={() => router.push("/alunos")}>
                Ver alunos
              </button>
            }
          />
        )}

        <input
          ref={arquivoRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) processarFoto(f);
            e.target.value = "";
          }}
        />

        <button
          onClick={() => arquivoRef.current?.click()}
          disabled={matriculados.length === 0}
          className="w-full h-52 rounded-2xl border border-borda2 grid place-items-center relative overflow-hidden
                     bg-gradient-to-br from-[#241f26] via-[#1c181f] to-[#161318] disabled:opacity-40"
        >
          <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-ok/12 to-transparent border-t border-ok/20" />
          <div className="w-16 h-16 rounded-full border-[3px] border-white/85 grid place-items-center bg-black/25 z-10">
            <div className="w-11 h-11 rounded-full bg-white" />
          </div>
        </button>

        {erro && <p className="text-sangue text-[13px] leading-snug px-1">{erro}</p>}

        <div className="cartao !p-3.5">
          <p className="text-[12.5px] text-texto2 leading-relaxed">
            Tire <b className="text-texto">uma foto do grupo</b> no fim do treino. Peça para todo
            mundo olhar para a câmera — rosto de perfil ou escondido não é reconhecido.
          </p>
        </div>

        <button
          className="btn-sec"
          onClick={() => setEtapa("confirmar")}
          disabled={matriculados.length === 0}
        >
          Pular foto — marcar na mão
        </button>

        <p className="text-[11.5px] text-texto3 text-center leading-relaxed px-4">
          {comBiometria.size} de {matriculados.length} alunos desta turma têm rosto cadastrado.
        </p>
      </Shell>
    );
  }

  // ------------------------------------------------------- confirmação ----
  const cartaoRosto = (m: Match, tom: "ok" | "duvida" | "corrigido") => {
    const det = deteccoes[m.face_idx];
    const marcado = !!presentes[m.aluno_id];
    const semelhanca = Math.max(0, Math.round((1 - m.distancia / 0.8) * 100));
    const borda = !marcado
      ? "border-borda opacity-45"
      : tom === "duvida"
        ? "border-atencao"
        : tom === "corrigido"
          ? "border-[#C7C2CB]"
          : "border-ok";

    return (
      <div
        key={`${m.face_idx}-${m.aluno_id}`}
        className={`rounded-xl overflow-hidden border-2 ${borda} bg-painel`}
      >
        <button
          onClick={() => alternar(m.aluno_id, tom === "duvida" ? "facial_confirmado" : "facial")}
          className="w-full relative h-[86px] bg-cartao block"
        >
          {det?.thumb ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={det.thumb} alt={m.nome} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full grid place-items-center" style={{ background: m.cor_hex }} />
          )}
          <span
            className={`absolute top-1 right-1 text-[8.5px] font-extrabold px-1.5 py-0.5 rounded backdrop-blur-sm bg-black/65 ${
              tom === "duvida" ? "text-atencao" : tom === "corrigido" ? "text-[#C7C2CB]" : "text-ok"
            }`}
          >
            {tom === "corrigido" ? "manual" : `${semelhanca}%`}
          </span>
          {marcado && (
            <span className="absolute bottom-1 left-1 w-5 h-5 rounded-full bg-ok grid place-items-center text-[#17151A] text-[11px] font-black">
              ✓
            </span>
          )}
        </button>

        <div className="bg-cartao px-2 pb-1.5">
          <div className="text-[11.5px] font-semibold truncate pt-1.5">{m.nome}</div>
          <button
            onClick={() => setRostoAberto(m.face_idx)}
            className="text-[10.5px] text-[#C7C2CB] font-semibold min-h-[30px] w-full text-left"
          >
            Não é ele? Trocar
          </button>
        </div>
      </div>
    );
  };

  return (
    <>
      <Shell
        titulo="Confirme a chamada"
        subtitulo={
          deteccoes.length > 0
            ? `Identifiquei ${matches.length} de ${deteccoes.length} rostos`
            : "Chamada manual"
        }
      >
        {autos.length > 0 && (
          <section className="cartao">
            <div className="rotulo text-ok">Reconhecidos</div>
            <div className="grid grid-cols-2 gap-2.5">{autos.map((m) => cartaoRosto(m, "ok"))}</div>
          </section>
        )}

        {duvidas.length > 0 && (
          <section className="cartao">
            <div className="rotulo text-atencao">Confira — semelhança abaixo do limiar</div>
            <div className="grid grid-cols-2 gap-2.5">
              {duvidas.map((m) => cartaoRosto(m, "duvida"))}
            </div>
            {semRosto > 0 && (
              <p className="text-[11.5px] text-texto3 mt-3 leading-relaxed">
                {semRosto} {semRosto === 1 ? "rosto não bateu" : "rostos não bateram"} com ninguém —
                pode ser visitante, ou aluno ainda sem rosto cadastrado.
              </p>
            )}
          </section>
        )}

        {corrigidos.length > 0 && (
          <section className="cartao">
            <div className="rotulo text-[#C7C2CB]">Corrigidos por você</div>
            <div className="grid grid-cols-2 gap-2.5">
              {corrigidos.map((m) => cartaoRosto(m, "corrigido"))}
            </div>
          </section>
        )}

        <section className="cartao">
          <div className="rotulo">
            {deteccoes.length > 0 ? "Não apareceram na foto" : "Marque quem treinou"}
          </div>
          {naoAchados.length === 0 ? (
            <p className="text-texto2 text-[13px]">Todo mundo da turma foi identificado.</p>
          ) : (
            <div className="divide-y divide-borda -my-1">
              {naoAchados.map((a) => (
                <button
                  key={a.id}
                  onClick={() => alternar(a.id)}
                  className="w-full flex items-center gap-3 py-2.5 text-left min-h-[56px]"
                >
                  <Foto src={a.foto_thumb} nome={a.nome} cor={a.faixa?.cor_hex} tamanho={38} />
                  <div className="min-w-0 flex-1">
                    <div className="text-[13.5px] font-semibold truncate">{a.nome}</div>
                    <div className="text-[11px] text-texto2">
                      {a.faixa?.nome ?? "Sem faixa"} · {a.graus} {a.graus === 1 ? "grau" : "graus"}
                      {!comBiometria.has(a.id) && " · sem rosto"}
                    </div>
                  </div>
                  <span
                    className={`w-[46px] h-[28px] rounded-full border relative shrink-0 transition ${
                      presentes[a.id] ? "bg-ok/15 border-ok" : "bg-[#242128] border-borda2"
                    }`}
                  >
                    <span
                      className={`absolute top-[2px] w-[22px] h-[22px] rounded-full transition-all ${
                        presentes[a.id] ? "left-[21px] bg-ok" : "left-[2px] bg-[#827E88]"
                      }`}
                    />
                  </span>
                </button>
              ))}
            </div>
          )}
        </section>

        <section className="cartao">
          <div className="rotulo">Diário da aula (opcional)</div>
          <input
            className="campo"
            placeholder="Técnicas do dia: passagem knee slice, berimbolo…"
            value={tecnicas}
            onChange={(e) => setTecnicas(e.target.value)}
          />
        </section>

        {erro && <p className="text-sangue text-[13px] leading-snug px-1">{erro}</p>}

        <button className="btn-pri" onClick={gravar} disabled={salvando || total === 0}>
          {salvando ? "Gravando…" : `Gravar presença de ${total} ${total === 1 ? "aluno" : "alunos"}`}
        </button>
        <button
          className="btn-sec"
          onClick={() => {
            setEtapa("camera");
            setErro(null);
          }}
        >
          {deteccoes.length > 0 ? "Refazer a foto" : "Voltar"}
        </button>
      </Shell>

      {rostoAberto !== null && (
        <TrocarAluno
          rosto={deteccoes[rostoAberto]?.thumb}
          atual={(() => {
            const m = matches.find((x) => x.face_idx === rostoAberto);
            if (!m) return null;
            const a = matriculados.find((x) => x.id === m.aluno_id);
            return a
              ? { id: a.id, nome: a.nome, foto_thumb: a.foto_thumb, faixa: a.faixa }
              : { id: m.aluno_id, nome: m.nome, faixa: { nome: m.faixa, cor_hex: m.cor_hex } };
          })()}
          alunos={paraFolha}
          jaMarcados={new Set(Object.keys(presentes))}
          aoTrocar={(id) => trocarRosto(rostoAberto, id)}
          aoRemover={() => removerRosto(rostoAberto)}
          aoFechar={() => setRostoAberto(null)}
        />
      )}
    </>
  );
}
