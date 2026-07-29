import Link from "next/link";
import { supabaseServer } from "@/lib/supabase-server";
import { Shell, Selo, Iniciais, Vazio } from "@/components/Shell";

export const dynamic = "force-dynamic";

export default async function Alunos() {
  const sb = supabaseServer();

  const [{ data: alunos }, { data: bio }] = await Promise.all([
    sb
      .from("v_aluno_frequencia")
      .select("aluno_id, nome, status, faixa, cor_hex, graus, aulas_30d, dias_sem_treinar")
      .eq("status", "ativo")
      .order("nome"),
    sb.from("face_template").select("aluno_id"),
  ]);

  const comBiometria = new Set(((bio ?? []) as any[]).map((b) => b.aluno_id));
  const semBiometria = (alunos ?? []).filter((a: any) => !comBiometria.has(a.aluno_id)).length;

  return (
    <Shell
      titulo="Alunos"
      subtitulo={`${alunos?.length ?? 0} ativos`}
      acao={
        <Link
          href="/alunos/novo"
          className="bg-ok text-[#04231b] rounded-lg w-8 h-8 grid place-items-center font-black text-lg shrink-0"
          aria-label="Novo aluno"
        >
          +
        </Link>
      }
    >
      {semBiometria > 0 && (alunos?.length ?? 0) > 0 && (
        <div className="cartao !p-3.5 border-atencao/30">
          <p className="text-[12.5px] text-texto2 leading-relaxed">
            <b className="text-atencao">{semBiometria}</b>{" "}
            {semBiometria === 1 ? "aluno ainda não tem" : "alunos ainda não têm"} rosto cadastrado —
            {semBiometria === 1 ? " ele" : " eles"} não {semBiometria === 1 ? "aparece" : "aparecem"} na
            chamada por foto.
          </p>
        </div>
      )}

      {!alunos || alunos.length === 0 ? (
        <Vazio
          titulo="Nenhum aluno cadastrado"
          texto="Comece cadastrando os alunos com foto e consentimento. Depois a chamada por foto passa a funcionar."
          acao={
            <Link href="/alunos/novo" className="btn-pri">
              Cadastrar aluno
            </Link>
          }
        />
      ) : (
        alunos.map((a: any) => (
          <Link key={a.aluno_id} href={`/alunos/${a.aluno_id}`} className="cartao !p-3.5 flex items-center gap-3 hover:border-borda2 transition">
            <Iniciais nome={a.nome} cor={a.cor_hex} />
            <div className="min-w-0 flex-1">
              <div className="font-semibold text-[13.5px] truncate">{a.nome}</div>
              <div className="flex items-center gap-1.5 mt-1">
                <span className="w-2 h-2 rounded-sm shrink-0" style={{ background: a.cor_hex ?? "#5D738C" }} />
                <span className="text-[11px] text-texto2 truncate">
                  {a.faixa ?? "Sem faixa"} · {a.graus} {a.graus === 1 ? "grau" : "graus"} ·{" "}
                  {a.aulas_30d} aulas/30d
                </span>
              </div>
            </div>
            {!comBiometria.has(a.aluno_id) ? (
              <Selo tom="neutro">Sem rosto</Selo>
            ) : a.dias_sem_treinar != null && a.dias_sem_treinar >= 14 ? (
              <Selo tom="perigo">{a.dias_sem_treinar}d</Selo>
            ) : (
              <Selo tom="ok">Ativo</Selo>
            )}
          </Link>
        ))
      )}
    </Shell>
  );
}
