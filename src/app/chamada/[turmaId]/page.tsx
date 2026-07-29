"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase";
import { Shell, Selo, Iniciais, Vazio } from "@/components/Shell";
import {
  LIMIAR,
  carregarImagem,
  detectarRostos,
  prepararMotor,
  redimensionar,
  type Deteccao,
} from "@/lib/face";

type Aluno = {
  id: string;
  nome: string;
  graus: number;
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

type Etapa = "camera" | "processando" | "confirmar" | "pronto";

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
  /** aluno_id → true (presente). Fonte única da verdade na hora de gravar. */
  const [presentes, setPresentes] = useState<Record<string, { origem: string; distancia?: number }>>({});
  const [tecnicas, setTecnicas] = useState("");
  const [salvando, setSalvando] = useState(false);

  const data = useMemo(() => new Date().toISOString().slice(0, 10), []);

  // ------------------------------------------------------------- carga ----
  useEffect(() => {
    (async () => {
      const [{ data: t }, { data: m }, { data: bio }] = await Promise.all([
        sb.from("turma").select("nome").eq("id", params.turmaId).maybeSingle(),
        sb
          .from("matricula")
          .select("aluno:aluno(id, nome, graus, faixa:faixa(nome, cor_hex))")
          .eq("turma_id", params.turmaId)
          .eq("ativo", true),
        sb.from("face_template").select("aluno_id"),
      ]);

      setTurma(t);
      setMatriculados(
        ((m ?? []) as any[])
          .map((r) => r.aluno)
          .filter(Boolean)
          .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"))
      );
      setComBiometria(new Set(((bio ?? []) as any[]).map((b) => b.aluno_id)));
      setCarregandoDados(false);
    })();
    // aquece os modelos enquanto o professor lê a tela
    prepararMotor().catch(() => {});
  }, [sb, params.turmaId]);

  // ---------------------------------------------------------- processar ---
  const processarFoto = useCallback(
    async (file: File) => {
      setErro(null);
      setEtapa("processando");
      try {
        setStatus("Preparando o reconhecimento…");
        await prepararMotor(setStatus);

        setStatus("Abrindo a foto…");
        const bruta = await carregarImagem(file);
        const img = await redimensionar(bruta);

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

        // Só marca sozinho quem passou com folga. O resto o professor confirma.
        const inicial: Record<string, { origem: string; distancia?: number }> = {};
        for (const m of lista) {
          if (m.distancia <= LIMIAR.AUTO) {
            inicial[m.aluno_id] = { origem: "facial", distancia: m.distancia };
          }
        }
        setPresentes(inicial);
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

      setEtapa("pronto");
    } catch (e) {
      setErro((e as Error).message || "Não consegui gravar a chamada.");
    } finally {
      setSalvando(false);
    }
  }

  // ------------------------------------------------------------- helpers --
  const alternar = (id: string, origem = "manual") =>
    setPresentes((p) => {
      const n = { ...p };
      if (n[id]) delete n[id];
      else n[id] = { origem };
      return n;
    });

  const total = Object.keys(presentes).length;
  const autos = matches.filter((m) => m.distancia <= LIMIAR.AUTO);
  const duvidas = matches.filter((m) => m.distancia > LIMIAR.AUTO);
  const idsAchados = new Set(matches.map((m) => m.aluno_id));
  const naoAchados = matriculados.filter((a) => !idsAchados.has(a.id));
  const semRosto = deteccoes.length - matches.length;

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
                <b>A foto não foi enviada para lugar nenhum.</b> O reconhecimento rodou aqui no
                aparelho e só o registro de presença foi salvo.
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
          <p className="text-texto3 text-[11.5px] mt-2 max-w-[260px] mx-auto leading-relaxed">
            Na primeira vez os modelos são baixados (~13 MB). Depois fica instantâneo.
          </p>
        </div>
      </Shell>
    );
  }

  if (etapa === "camera") {
    return (
      <Shell titulo="Chamada por foto" subtitulo={turma?.nome}>
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
                     bg-gradient-to-br from-[#1d3a4d] via-[#16304a] to-[#1c2a3d] disabled:opacity-40"
        >
          <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-ok/12 to-transparent border-t border-ok/20" />
          <div className="w-16 h-16 rounded-full border-[3px] border-white/85 grid place-items-center bg-black/25 z-10">
            <div className="w-11 h-11 rounded-full bg-white" />
          </div>
        </button>

        {erro && <p className="text-sangue text-[13px] leading-snug px-1">{erro}</p>}

        <div className="cartao !p-3.5">
          <p className="text-[12.5px] text-texto2 leading-relaxed">
            Tire <b className="text-texto">uma foto do grupo</b> no fim do treino. Peça para todo mundo
            olhar para a câmera — rosto de perfil ou escondido não é reconhecido.
          </p>
        </div>

        <button className="btn-sec" onClick={() => setEtapa("confirmar")} disabled={matriculados.length === 0}>
          Pular foto — marcar na mão
        </button>

        <p className="text-[11px] text-texto3 text-center leading-relaxed px-4">
          {comBiometria.size} de {matriculados.length} alunos desta turma têm biometria cadastrada.
          Quem não tem só entra pela chamada manual.
        </p>
      </Shell>
    );
  }

  // ------------------------------------------------------- confirmação ----
  return (
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
          <div className="rotulo text-ok">Reconhecidos — toque para desmarcar</div>
          <div className="grid grid-cols-3 gap-2.5">
            {autos.map((m) => (
              <CartaoRosto
                key={m.aluno_id}
                nome={m.nome}
                cor={m.cor_hex}
                thumb={deteccoes[m.face_idx]?.thumb}
                dist={m.distancia}
                ativo={!!presentes[m.aluno_id]}
                onClick={() => alternar(m.aluno_id, "facial")}
              />
            ))}
          </div>
        </section>
      )}

      {duvidas.length > 0 && (
        <section className="cartao">
          <div className="rotulo text-atencao">Confirme — semelhança abaixo do limiar</div>
          <div className="grid grid-cols-3 gap-2.5">
            {duvidas.map((m) => (
              <CartaoRosto
                key={m.aluno_id}
                nome={m.nome}
                cor={m.cor_hex}
                thumb={deteccoes[m.face_idx]?.thumb}
                dist={m.distancia}
                ativo={!!presentes[m.aluno_id]}
                duvida
                onClick={() => alternar(m.aluno_id, "facial_confirmado")}
              />
            ))}
          </div>
          {semRosto > 0 && (
            <p className="text-[11px] text-texto3 mt-3 leading-relaxed">
              {semRosto} {semRosto === 1 ? "rosto não bateu" : "rostos não bateram"} com ninguém —
              pode ser visitante, ou aluno ainda sem biometria cadastrada.
            </p>
          )}
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
                className="w-full flex items-center gap-3 py-2.5 text-left"
              >
                <Iniciais nome={a.nome} cor={a.faixa?.cor_hex} tamanho={32} />
                <div className="min-w-0 flex-1">
                  <div className="text-[13px] font-semibold truncate">{a.nome}</div>
                  <div className="text-[10.5px] text-texto2">
                    {a.faixa?.nome ?? "Sem faixa"} · {a.graus} {a.graus === 1 ? "grau" : "graus"}
                    {!comBiometria.has(a.id) && " · sem biometria"}
                  </div>
                </div>
                <Interruptor ligado={!!presentes[a.id]} />
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
  );
}

/* ------------------------------------------------------------ átomos ----- */

function CartaoRosto({
  nome,
  cor,
  thumb,
  dist,
  ativo,
  duvida,
  onClick,
}: {
  nome: string;
  cor: string;
  thumb?: string;
  dist: number;
  ativo: boolean;
  duvida?: boolean;
  onClick: () => void;
}) {
  const semelhanca = Math.max(0, Math.round((1 - dist / 0.8) * 100));
  const borda = !ativo ? "border-borda opacity-45" : duvida ? "border-atencao" : "border-ok";

  return (
    <button onClick={onClick} className={`rounded-xl overflow-hidden border-2 ${borda} bg-painel transition text-left`}>
      <div className="relative h-[68px] bg-cartao">
        {thumb ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={thumb} alt={nome} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full grid place-items-center" style={{ background: cor }} />
        )}
        <span
          className={`absolute top-1 right-1 text-[8px] font-extrabold px-1.5 py-0.5 rounded backdrop-blur-sm bg-black/60 ${
            duvida ? "text-atencao" : "text-ok"
          }`}
        >
          {semelhanca}%
        </span>
        {ativo && (
          <span className="absolute bottom-1 left-1 w-4 h-4 rounded-full bg-ok grid place-items-center text-[#04231b] text-[10px] font-black">
            ✓
          </span>
        )}
      </div>
      <div className="text-[9.5px] font-semibold px-1.5 py-1.5 truncate bg-cartao">{nome.split(" ")[0]}</div>
    </button>
  );
}

function Interruptor({ ligado }: { ligado: boolean }) {
  return (
    <span
      className={`w-[42px] h-6 rounded-full border relative shrink-0 transition ${
        ligado ? "bg-ok/15 border-ok" : "bg-[#233043] border-borda2"
      }`}
    >
      <span
        className={`absolute top-[2px] w-[18px] h-[18px] rounded-full transition-all ${
          ligado ? "left-[21px] bg-ok" : "left-[2px] bg-[#6b8199]"
        }`}
      />
    </span>
  );
}
