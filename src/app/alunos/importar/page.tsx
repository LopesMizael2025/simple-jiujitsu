"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase";
import { Shell } from "@/components/Shell";
import {
  adivinharColuna,
  extrairFaixa,
  extrairTurmas,
  lerCsv,
  paraBooleano,
  paraDataIso,
  type Linha,
} from "@/lib/csv";

type Campo = {
  chave: string;
  rotulo: string;
  pistas: string[];
  obrigatorio?: boolean;
};

/** Cada campo nosso e as pistas para achar a coluna correspondente no CSV. */
const CAMPOS: Campo[] = [
  { chave: "nome", rotulo: "Nome", pistas: ["nome completo", "nome"], obrigatorio: true },
  { chave: "nascimento", rotulo: "Nascimento", pistas: ["data de nascimento", "nascimento"] },
  { chave: "telefone", rotulo: "Telefone", pistas: ["telefone whatsapp", "whatsapp", "telefone", "celular"] },
  { chave: "email", rotulo: "E-mail", pistas: ["email", "e mail"] },
  { chave: "responsavel_nome", rotulo: "Responsável", pistas: ["nome do responsavel", "responsavel"] },
  { chave: "responsavel_telefone", rotulo: "Tel. responsável", pistas: ["telefone do responsavel"] },
  { chave: "responsavel_parentesco", rotulo: "Parentesco", pistas: ["parentesco"] },
  { chave: "faixa", rotulo: "Faixa", pistas: ["qual sua faixa", "faixa atual", "faixa"] },
  { chave: "graus", rotulo: "Graus", pistas: ["quantidade de graus", "graus"] },
  { chave: "turmas", rotulo: "Turmas", pistas: ["quais turmas", "turmas", "turma"] },
  { chave: "observacoes", rotulo: "Observações", pistas: ["lesao", "restricao medica", "observ"] },
  { chave: "cons_biometria", rotulo: "Consent. biometria", pistas: ["biometria"] },
  { chave: "cons_imagem", rotulo: "Consent. imagem", pistas: ["uso de imagem", "imagem"] },
  { chave: "cons_comunicacao", rotulo: "Consent. WhatsApp", pistas: ["comunicados", "comunicacao"] },
];

type Mapa = Record<string, string>;
type Preparado = {
  nome: string;
  nascimento: string | null;
  telefone: string;
  email: string;
  responsavel_nome: string;
  responsavel_telefone: string;
  responsavel_parentesco: string;
  faixa_nome: string;
  graus: number;
  observacoes: string;
  turmas: string[];
  cons_biometria?: boolean;
  cons_imagem?: boolean;
  cons_comunicacao?: boolean;
};

export default function ImportarAlunos() {
  const router = useRouter();
  const [sb] = useState(() => supabaseBrowser());
  const arquivoRef = useRef<HTMLInputElement>(null);

  const [turmasEscola, setTurmasEscola] = useState<string[]>([]);
  const [faixasEscola, setFaixasEscola] = useState<string[]>([]);

  const [colunas, setColunas] = useState<string[]>([]);
  const [linhas, setLinhas] = useState<Linha[]>([]);
  const [mapa, setMapa] = useState<Mapa>({});
  const [nomeArquivo, setNomeArquivo] = useState("");

  const [importando, setImportando] = useState(false);
  const [progresso, setProgresso] = useState(0);
  const [resultado, setResultado] = useState<{ criados: number; atualizados: number; erros: any[] } | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const [{ data: t }, { data: f }] = await Promise.all([
        sb.from("turma").select("nome").eq("ativo", true).order("nome"),
        sb.from("faixa").select("nome").order("ordem"),
      ]);
      setTurmasEscola(((t ?? []) as { nome: string }[]).map((x) => x.nome));
      setFaixasEscola([...new Set(((f ?? []) as { nome: string }[]).map((x) => x.nome))]);
    })();
  }, [sb]);

  function abrirArquivo(file: File) {
    setErro(null);
    setResultado(null);
    const leitor = new FileReader();
    leitor.onload = () => {
      try {
        const { colunas: cols, linhas: lins } = lerCsv(String(leitor.result));
        if (!cols.length || !lins.length) {
          setErro("Não encontrei dados nesse arquivo. Ele tem cabeçalho e pelo menos uma linha?");
          return;
        }
        setColunas(cols);
        setLinhas(lins);
        setNomeArquivo(file.name);
        const auto: Mapa = {};
        for (const c of CAMPOS) auto[c.chave] = adivinharColuna(cols, c.pistas);
        setMapa(auto);
      } catch (e) {
        setErro("Não consegui ler o arquivo: " + (e as Error).message);
      }
    };
    leitor.readAsText(file, "utf-8");
  }

  /** Converte as linhas cruas no formato que a função do banco espera. */
  function preparar(): Preparado[] {
    const v = (l: Linha, campo: string) => (mapa[campo] ? (l[mapa[campo]] ?? "").trim() : "");
    return linhas
      .map((l) => ({
        nome: v(l, "nome"),
        nascimento: paraDataIso(v(l, "nascimento")),
        telefone: v(l, "telefone"),
        email: v(l, "email"),
        responsavel_nome: v(l, "responsavel_nome"),
        responsavel_telefone: v(l, "responsavel_telefone"),
        responsavel_parentesco: v(l, "responsavel_parentesco"),
        faixa_nome: extrairFaixa(v(l, "faixa")),
        graus: Math.max(0, parseInt(v(l, "graus"), 10) || 0),
        observacoes: v(l, "observacoes"),
        turmas: extrairTurmas(v(l, "turmas"), turmasEscola),
        cons_biometria: paraBooleano(v(l, "cons_biometria")),
        cons_imagem: paraBooleano(v(l, "cons_imagem")),
        cons_comunicacao: paraBooleano(v(l, "cons_comunicacao")),
      }))
      .filter((a) => a.nome !== "");
  }

  async function importar() {
    setImportando(true);
    setErro(null);
    setProgresso(0);
    try {
      const todos = preparar();
      if (!todos.length) throw new Error("Nenhuma linha com nome preenchido.");

      // lotes de 50 para não estourar o tempo da requisição
      const lote = 50;
      let criados = 0;
      let atualizados = 0;
      const erros: any[] = [];

      for (let i = 0; i < todos.length; i += lote) {
        const pedaco = todos.slice(i, i + lote).map((a) => {
          const o: Record<string, unknown> = { ...a };
          // não mandar consentimento indefinido: o banco só grava o que veio
          for (const k of ["cons_biometria", "cons_imagem", "cons_comunicacao"]) {
            if (o[k] === undefined) delete o[k];
          }
          return o;
        });

        const { data, error } = await sb.rpc("importar_alunos", { p_alunos: pedaco });
        if (error) throw error;

        const r = Array.isArray(data) ? data[0] : data;
        criados += r?.criados ?? 0;
        atualizados += r?.atualizados ?? 0;
        if (r?.erros?.length) erros.push(...r.erros);

        setProgresso(Math.round(((i + pedaco.length) / todos.length) * 100));
      }

      setResultado({ criados, atualizados, erros });
      router.refresh();
    } catch (e) {
      setErro((e as Error).message || "Falhou ao importar.");
    } finally {
      setImportando(false);
    }
  }

  // ---------------------------------------------------------------- telas ---
  if (resultado) {
    const prontos = preparar();
    const semFaixa = prontos.filter((a) => a.faixa_nome && !faixasEscola.some((f) => f.toLowerCase() === a.faixa_nome.toLowerCase()));
    const semTurma = prontos.filter((a) => a.turmas.length === 0);

    return (
      <Shell titulo="Importação concluída" subtitulo={nomeArquivo}>
        <div className="cartao text-center py-8 border-ok/40 bg-gradient-to-br from-ok/10 to-transparent">
          <div className="text-[42px] font-extrabold text-ok tracking-tighter leading-none">
            {resultado.criados}
          </div>
          <p className="text-texto2 text-[13px] mt-2">
            {resultado.criados === 1 ? "aluno criado" : "alunos criados"}
            {resultado.atualizados > 0 && ` · ${resultado.atualizados} atualizados`}
          </p>
        </div>

        {(semTurma.length > 0 || semFaixa.length > 0 || resultado.erros.length > 0) && (
          <section className="cartao">
            <div className="rotulo text-atencao">Confira depois</div>
            <ul className="space-y-2.5 text-[12.5px] leading-relaxed">
              {semTurma.length > 0 && (
                <li>
                  <b className="text-atencao">{semTurma.length}</b> sem turma reconhecida — não vão
                  aparecer em nenhuma chamada até você matricular.
                </li>
              )}
              {semFaixa.length > 0 && (
                <li>
                  <b className="text-atencao">{semFaixa.length}</b> com faixa que não existe no
                  cadastro da escola. Ficaram sem faixa.
                </li>
              )}
              {resultado.erros.length > 0 && (
                <li>
                  <b className="text-sangue">{resultado.erros.length}</b> com erro:{" "}
                  {resultado.erros.slice(0, 3).map((e) => e.nome).join(", ")}
                  {resultado.erros.length > 3 && "…"}
                </li>
              )}
            </ul>
          </section>
        )}

        <div className="cartao !p-3.5">
          <p className="text-[12.5px] text-texto2 leading-relaxed">
            Ninguém veio com foto — o CSV não carrega imagem. O rosto de cada aluno você captura
            no tatame, pelo botão de editar na ficha, ou eles mandam pelo formulário.
          </p>
        </div>

        <button className="btn-pri" onClick={() => router.push("/alunos")}>
          Ver os alunos
        </button>
      </Shell>
    );
  }

  if (!colunas.length) {
    return (
      <Shell titulo="Importar alunos" subtitulo="A partir das respostas do formulário">
        <input
          ref={arquivoRef}
          type="file"
          accept=".csv,text/csv"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) abrirArquivo(f);
            e.target.value = "";
          }}
        />

        <section className="cartao">
          <div className="rotulo">Como fazer</div>
          <ol className="space-y-2.5 text-[13px] leading-relaxed list-decimal pl-4 text-texto2">
            <li>Abra o formulário no Google e vá em <b className="text-texto">Respostas</b>.</li>
            <li>Clique nos três pontinhos e escolha <b className="text-texto">Fazer download das respostas (.csv)</b>.</li>
            <li>Volte aqui e escolha o arquivo baixado.</li>
          </ol>
        </section>

        <button className="btn-pri" onClick={() => arquivoRef.current?.click()}>
          Escolher arquivo CSV
        </button>

        {erro && <p className="text-sangue text-[13px] leading-snug px-1">{erro}</p>}

        <div className="cartao !p-3.5">
          <p className="text-[12.5px] text-texto2 leading-relaxed">
            Quem já estiver cadastrado com o mesmo nome é <b className="text-texto">atualizado</b>,
            não duplicado. Dá para importar o mesmo arquivo de novo sem bagunçar nada.
          </p>
        </div>
      </Shell>
    );
  }

  // ------------------------------------------------------------ conferência --
  const prontos = preparar();
  const semNome = linhas.length - prontos.length;
  const semTurma = prontos.filter((a) => a.turmas.length === 0).length;

  return (
    <Shell titulo="Conferir antes de importar" subtitulo={`${nomeArquivo} · ${prontos.length} alunos`}>
      <section className="cartao">
        <div className="rotulo">De onde vem cada informação</div>
        <p className="text-[11.5px] text-texto2 leading-relaxed mb-3">
          Adivinhei pelo nome da coluna. Confira e corrija o que estiver errado.
        </p>
        <div className="space-y-2.5">
          {CAMPOS.map((c) => (
            <div key={c.chave} className="flex items-center gap-2.5">
              <span className="text-[12px] w-[124px] shrink-0 text-texto2">
                {c.rotulo}
                {c.obrigatorio && <span className="text-sangue"> *</span>}
              </span>
              <select
                className="campo !py-2 !text-[12.5px] flex-1 min-w-0"
                value={mapa[c.chave] ?? ""}
                onChange={(e) => setMapa((m) => ({ ...m, [c.chave]: e.target.value }))}
              >
                <option value="">— não importar —</option>
                {colunas.map((col) => (
                  <option key={col} value={col}>
                    {col.length > 44 ? col.slice(0, 44) + "…" : col}
                  </option>
                ))}
              </select>
            </div>
          ))}
        </div>
      </section>

      {(semNome > 0 || semTurma > 0) && (
        <section className="cartao border-atencao/30">
          <div className="rotulo text-atencao">Atenção</div>
          <ul className="space-y-1.5 text-[12.5px] leading-relaxed">
            {semNome > 0 && <li>{semNome} linha(s) sem nome serão ignoradas.</li>}
            {semTurma > 0 && (
              <li>
                {semTurma} sem turma reconhecida. Vão ser criados, mas não aparecem em chamada até
                serem matriculados.
              </li>
            )}
          </ul>
        </section>
      )}

      <section className="cartao">
        <div className="rotulo">Prévia · primeiros 5</div>
        <div className="space-y-3">
          {prontos.slice(0, 5).map((a, i) => (
            <div key={i} className="border-b border-borda pb-3 last:border-0 last:pb-0">
              <div className="font-semibold text-[13.5px]">{a.nome}</div>
              <div className="text-[11.5px] text-texto2 mt-1 leading-relaxed">
                {a.nascimento ? new Date(a.nascimento + "T12:00").toLocaleDateString("pt-BR") : "sem data"}
                {a.telefone && ` · ${a.telefone}`}
                {a.faixa_nome && ` · ${a.faixa_nome} ${a.graus}º`}
              </div>
              <div className="text-[11px] mt-1.5">
                {a.turmas.length ? (
                  <span className="text-ok">{a.turmas.join(" · ")}</span>
                ) : (
                  <span className="text-atencao">sem turma</span>
                )}
                {a.cons_biometria === false && <span className="text-texto3"> · sem biometria</span>}
              </div>
            </div>
          ))}
        </div>
      </section>

      {erro && <p className="text-sangue text-[13px] leading-snug px-1">{erro}</p>}

      {importando && (
        <div className="cartao !p-3.5">
          <div className="h-1.5 bg-[#1c2836] rounded-full overflow-hidden">
            <div className="h-full rounded-full bg-ok transition-all" style={{ width: `${progresso}%` }} />
          </div>
          <p className="text-[12px] text-texto2 mt-2.5">Importando… {progresso}%</p>
        </div>
      )}

      <button className="btn-pri" onClick={importar} disabled={importando || !mapa.nome}>
        {importando ? "Importando…" : `Importar ${prontos.length} alunos`}
      </button>
      <button
        type="button"
        className="btn-sec"
        onClick={() => {
          setColunas([]);
          setLinhas([]);
          setErro(null);
        }}
      >
        Escolher outro arquivo
      </button>
    </Shell>
  );
}
