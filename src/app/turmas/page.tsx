import Link from "next/link";
import { supabaseServer } from "@/lib/supabase-server";
import { Shell, Selo, Vazio } from "@/components/Shell";

export const dynamic = "force-dynamic";

const DIAS_CURTO = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

export default async function Turmas() {
  const sb = supabaseServer();
  const hojeISO = new Date().toISOString().slice(0, 10);

  const { data: turmas } = await sb
    .from("turma")
    .select(
      "id, nome, faixa_etaria, nivel, ativo, modalidade:modalidade(nome), turma_horario(dia_semana, hora_inicio, hora_fim), matricula(count)"
    )
    .eq("ativo", true)
    .order("nome");

  const { data: aulasHoje } = await sb
    .from("aula")
    .select("turma_id, status, presenca(count)")
    .eq("data", hojeISO);

  const feitas = new Map(
    (aulasHoje ?? []).map((a: any) => [a.turma_id, a.presenca?.[0]?.count ?? 0])
  );

  return (
    <Shell titulo="Turmas" subtitulo={`${turmas?.length ?? 0} turmas ativas`}>
      {!turmas || turmas.length === 0 ? (
        <Vazio
          titulo="Nenhuma turma ainda"
          texto="As turmas vêm do seed do banco. Se a lista está vazia, confira se as migrations rodaram."
        />
      ) : (
        turmas.map((t: any) => {
          const dias = (t.turma_horario ?? [])
            .map((h: any) => DIAS_CURTO[h.dia_semana])
            .filter((v: string, i: number, a: string[]) => a.indexOf(v) === i);
          const hora = t.turma_horario?.[0]?.hora_inicio?.slice(0, 5);
          const matriculados = t.matricula?.[0]?.count ?? 0;
          const presentes = feitas.get(t.id);

          return (
            <Link key={t.id} href={`/chamada/${t.id}`} className="cartao block hover:border-borda2 transition">
              <div className="flex items-start gap-3">
                <div className="min-w-0 flex-1">
                  <div className="font-bold text-[14.5px] leading-tight">{t.nome}</div>
                  <div className="text-[11.5px] text-texto2 mt-1">
                    {t.modalidade?.nome}
                    {t.nivel ? ` · ${t.nivel}` : ""} · {matriculados} matriculados
                  </div>
                  {dias.length > 0 && (
                    <div className="text-[11px] text-texto3 mt-1">
                      {dias.join(" · ")} {hora ? `às ${hora}` : ""}
                    </div>
                  )}
                </div>
                {presentes !== undefined ? (
                  <Selo tom="ok">{presentes} hoje</Selo>
                ) : (
                  <Selo tom="neutro">Sem chamada</Selo>
                )}
              </div>
              <div className="mt-3 pt-3 border-t border-borda flex items-center gap-2 text-ok text-[12.5px] font-semibold">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <rect x="3" y="6" width="18" height="14" rx="2.5" />
                  <circle cx="12" cy="13" r="3.6" />
                </svg>
                Fazer chamada por foto
              </div>
            </Link>
          );
        })
      )}
    </Shell>
  );
}
