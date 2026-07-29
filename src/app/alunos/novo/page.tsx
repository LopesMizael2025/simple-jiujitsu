"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase";
import { Shell } from "@/components/Shell";
import { SeletorGraduacao, type Faixa } from "@/components/Graduacao";
import { carregarImagem, extrairDescritor, prepararMotor, redimensionar } from "@/lib/face";

type Turma = { id: string; nome: string; faixa_etaria: string };

const TEXTO_VERSAO = "v1-2026-07";

export default function NovoAluno() {
  const router = useRouter();
  const [sb] = useState(() => supabaseBrowser());
  const fotoRef = useRef<HTMLInputElement>(null);

  const [faixas, setFaixas] = useState<Faixa[]>([]);
  const [turmas, setTurmas] = useState<Turma[]>([]);

  const [nome, setNome] = useState("");
  const [nascimento, setNascimento] = useState("");
  const [telefone, setTelefone] = useState("");
  const [faixaId, setFaixaId] = useState("");
  const [graus, setGraus] = useState(0);
  const [turmasSel, setTurmasSel] = useState<Set<string>>(new Set());

  const [respNome, setRespNome] = useState("");
  const [respTel, setRespTel] = useState("");
  const [respParentesco, setRespParentesco] = useState("");

  const [rosto, setRosto] = useState<{ descritor: number[]; score: number; thumb: string } | null>(null);
  const [analisando, setAnalisando] = useState(false);
  const [statusRosto, setStatusRosto] = useState<string | null>(null);

  const [consBio, setConsBio] = useState(false);
  const [consImagem, setConsImagem] = useState(false);
  const [consComunicacao, setConsComunicacao] = useState(true);

  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const menor = ehMenor(nascimento);

  useEffect(() => {
    (async () => {
      const [{ data: f }, { data: t }] = await Promise.all([
        sb.from("faixa").select("id, nome, cor_hex, kids, ordem, graus_max").order("ordem"),
        sb.from("turma").select("id, nome, faixa_etaria").eq("ativo", true).order("nome"),
      ]);
      setFaixas((f ?? []) as Faixa[]);
      setTurmas((t ?? []) as Turma[]);
    })();
    prepararMotor().catch(() => {});
  }, [sb]);

  async function lerRosto(file: File) {
    setAnalisando(true);
    setStatusRosto(null);
    setErro(null);
    try {
      await prepararMotor(setStatusRosto);
      const bruta = await carregarImagem(file);
      const img = await redimensionar(bruta, 1200);
      const r = await extrairDescritor(img);
      if (!r) {
        setStatusRosto("Não achei um rosto nítido. Tire de frente, com boa luz, só o aluno na foto.");
        setRosto(null);
      } else {
        setRosto(r);
        setStatusRosto(null);
      }
    } catch (e) {
      setStatusRosto((e as Error).message);
    } finally {
      setAnalisando(false);
    }
  }

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);

    if (!nome.trim()) return setErro("Digite o nome do aluno.");
    if (menor && !respNome.trim()) return setErro("Aluno menor de idade precisa de responsável.");
    if (rosto && !consBio)
      return setErro("Para guardar a biometria é preciso marcar o consentimento — é exigência da LGPD.");

    setSalvando(true);
    try {
      const { data: escolaId, error: erroEscola } = await sb.rpc("minha_escola");
      if (erroEscola || !escolaId) throw new Error("Não consegui identificar sua escola.");

      // 1) aluno
      const { data: aluno, error: e1 } = await sb
        .from("aluno")
        .insert({
          escola_id: escolaId,
          nome: nome.trim(),
          nascimento: nascimento || null,
          telefone: telefone.trim() || null,
          faixa_id: faixaId || null,
          graus,
          responsavel_nome: respNome.trim() || null,
          responsavel_telefone: respTel.trim() || null,
          responsavel_parentesco: respParentesco.trim() || null,
        })
        .select("id")
        .single();
      if (e1) throw e1;

      const quemConsentiu = menor
        ? `${respNome.trim()}${respParentesco ? ` (${respParentesco})` : ""}`
        : "o próprio titular";

      // 2) consentimentos (append-only, sempre grava os três)
      const consentimentos = [
        { tipo: "biometria", concedido: consBio, base_legal: menor
            ? "LGPD art. 11, I + art. 14, §1º - consentimento do responsável legal"
            : "LGPD art. 11, I - consentimento específico e destacado" },
        { tipo: "imagem", concedido: consImagem, base_legal: "LGPD art. 7, I - consentimento" },
        { tipo: "comunicacao", concedido: consComunicacao, base_legal: "LGPD art. 7, I - consentimento" },
      ].map((c) => ({
        ...c,
        escola_id: escolaId,
        aluno_id: aluno.id,
        concedido_por: quemConsentiu,
        texto_versao: TEXTO_VERSAO,
        user_agent: navigator.userAgent.slice(0, 300),
      }));

      const { error: e2 } = await sb.from("consentimento").insert(consentimentos);
      if (e2) throw e2;

      // 3) biometria — só o vetor. A foto fica no aparelho e é descartada.
      if (rosto && consBio) {
        const { error: e3 } = await sb.from("face_template").insert({
          escola_id: escolaId,
          aluno_id: aluno.id,
          embedding: JSON.stringify(rosto.descritor),
          qualidade: rosto.score,
        });
        if (e3) throw e3;
      }

      // 4) matrículas nas turmas
      if (turmasSel.size > 0) {
        const { error: e4 } = await sb.from("matricula").insert(
          [...turmasSel].map((turma_id) => ({ turma_id, aluno_id: aluno.id }))
        );
        if (e4) throw e4;
      }

      router.push("/alunos");
      router.refresh();
    } catch (e) {
      setErro((e as Error).message || "Não consegui salvar.");
    } finally {
      setSalvando(false);
    }
  }

  return (
    <Shell titulo="Novo aluno" subtitulo="Cadastro, biometria e consentimentos">
      <form onSubmit={salvar} className="space-y-3">
        {/* -------------------------------------------------------- dados -- */}
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
              <input className="campo" inputMode="tel" placeholder="(34) 9…" value={telefone} onChange={(e) => setTelefone(e.target.value)} />
            </div>
          </div>
          <SeletorGraduacao
            faixas={faixas}
            faixaId={faixaId}
            graus={graus}
            onFaixa={setFaixaId}
            onGraus={setGraus}
            mostrarKids={menor}
          />
        </section>

        {/* -------------------------------------------------- responsável -- */}
        {menor && (
          <section className="cartao space-y-3 border-[#2c4a63]">
            <div className="rotulo text-[#4d9fff]">Responsável legal · obrigatório para menores</div>
            <input className="campo" placeholder="Nome do responsável" value={respNome} onChange={(e) => setRespNome(e.target.value)} />
            <div className="grid grid-cols-2 gap-3">
              <input className="campo" inputMode="tel" placeholder="Telefone" value={respTel} onChange={(e) => setRespTel(e.target.value)} />
              <input className="campo" placeholder="Mãe, pai, avó…" value={respParentesco} onChange={(e) => setRespParentesco(e.target.value)} />
            </div>
          </section>
        )}

        {/* ------------------------------------------------------ turmas --- */}
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
                      n.has(t.id) ? n.delete(t.id) : n.add(t.id);
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

        {/* ---------------------------------------------------- biometria -- */}
        <section className="cartao">
          <div className="rotulo">Rosto para a chamada por foto</div>
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
              className="w-[86px] h-[86px] rounded-2xl border-2 border-dashed border-borda2 grid place-items-center overflow-hidden shrink-0 bg-painel"
            >
              {rosto ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={rosto.thumb} alt="Rosto do aluno" className="w-full h-full object-cover" />
              ) : (
                <span className="text-texto3 text-[26px]">+</span>
              )}
            </button>
            <div className="min-w-0 flex-1 text-[12px] leading-relaxed">
              {analisando ? (
                <p className="text-texto2">{statusRosto || "Analisando…"}</p>
              ) : rosto ? (
                <p className="text-ok">
                  Rosto reconhecido ({Math.round(rosto.score * 100)}% de nitidez). Toque para trocar.
                </p>
              ) : (
                <p className="text-texto2">
                  Foto de frente, boa luz, só o aluno. O reconhecimento roda aqui no aparelho.
                </p>
              )}
              {statusRosto && !analisando && <p className="text-atencao mt-1.5">{statusRosto}</p>}
            </div>
          </div>
          <p className="text-[11px] text-texto3 mt-3.5 leading-relaxed">
            Guardamos apenas um <b className="text-texto2">vetor de 128 números</b> derivado do rosto —
            nunca a foto. O vetor não permite reconstruir a imagem.
          </p>
        </section>

        {/* ------------------------------------------------- consentimento -- */}
        <section className="cartao border-[#2c4a63]">
          <div className="rotulo text-[#4d9fff]">Consentimentos · LGPD</div>
          <Consentimento
            titulo="Biometria facial para registro de presença"
            texto={
              menor
                ? "Dado sensível (art. 11). Para menores exige consentimento do responsável legal (art. 14, §1º)."
                : "Dado pessoal sensível (art. 5º, II). Exige consentimento específico e destacado."
            }
            ligado={consBio}
            onChange={setConsBio}
          />
          <Consentimento
            titulo="Uso de imagem em redes sociais"
            texto="Consentimento separado do biométrico. Recusar não afeta a matrícula."
            ligado={consImagem}
            onChange={setConsImagem}
          />
          <Consentimento
            titulo="Avisos por WhatsApp"
            texto="Presença, graduação e comunicados da escola."
            ligado={consComunicacao}
            onChange={setConsComunicacao}
          />
          <p className="text-[11px] text-[#4d9fff] mt-3 leading-relaxed">
            Sem biometria o aluno treina normalmente — a presença é marcada na mão. Recusar nunca
            bloqueia a matrícula, e a revogação apaga o vetor na hora.
          </p>
        </section>

        {erro && <p className="text-sangue text-[13px] leading-snug px-1">{erro}</p>}

        <button className="btn-pri" disabled={salvando}>
          {salvando ? "Salvando…" : "Concluir matrícula"}
        </button>
        <button type="button" className="btn-sec" onClick={() => router.back()}>
          Cancelar
        </button>
      </form>
    </Shell>
  );
}

function Consentimento({
  titulo,
  texto,
  ligado,
  onChange,
}: {
  titulo: string;
  texto: string;
  ligado: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!ligado)}
      className="w-full flex items-start gap-3 py-3 border-b border-borda last:border-0 text-left"
    >
      <div className="min-w-0 flex-1">
        <div className="text-[12.5px] font-semibold leading-snug">{titulo}</div>
        <div className="text-[10.5px] text-texto2 mt-1 leading-relaxed">{texto}</div>
      </div>
      <span
        className={`w-[42px] h-6 rounded-full border relative shrink-0 mt-0.5 transition ${
          ligado ? "bg-ok/15 border-ok" : "bg-[#233043] border-borda2"
        }`}
      >
        <span
          className={`absolute top-[2px] w-[18px] h-[18px] rounded-full transition-all ${
            ligado ? "left-[21px] bg-ok" : "left-[2px] bg-[#6b8199]"
          }`}
        />
      </span>
    </button>
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
