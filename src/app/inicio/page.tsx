import Link from "next/link";
import { supabaseServer } from "@/lib/supabase-server";
import { Shell, Selo, Foto } from "@/components/Shell";
import { BotaoWhatsapp } from "@/components/BotaoWhatsapp";

export const dynamic = "force-dynamic";

const DIAS = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];

export default async function Inicio() {
  const sb = supabaseServer();
  const hoje = new Date();
  const diaSemana = hoje.getDay();
  const dataISO = hoje.toISOString().slice(0, 10);

  const usuarioId = (await sb.auth.getUser()).data.user?.id ?? "";
  const trintaDias = new Date(Date.now() - 30 * 864e5).toISOString();

  const [
    { data: perfil },
    { data: horarios },
    { data: risco },
    { count: totalAlunos },
    { count: totalPresencas },
  ] = await Promise.all([
    sb.from("perfil").select("nome, papel").eq("id", usuarioId).maybeSingle(),
    sb
      .from("turma_horario")
      .select("id, hora_inicio, hora_fim, turma:turma(id, nome, faixa_etaria, ativo)")
      .eq("dia_semana", diaSemana)
      .order("hora_inicio"),
    sb.from("v_risco_evasao").select("aluno_id, nome, cor_hex, foto_thumb, telefone, responsavel_nome, responsavel_telefone, dias_sem_treinar, aulas_30d").limit(6),
    sb.from("aluno").select("*", { count: "exact", head: true }).eq("status", "ativo"),
    sb.from("presenca").select("*", { count: "exact", head: true }).gte("criado_em", trintaDias),
  ]);

  const aulasHoje = (horarios ?? []).filter((h: any) => h.turma?.ativo);
  const saudacao = hoje.getHours() < 12 ? "Bom dia" : hoje.getHours() < 18 ? "Boa tarde" : "Boa noite";

  return (
    <Shell
      titulo={`${saudacao}${perfil?.nome ? `, ${perfil.nome.split(" ")[0]}` : ""}`}
      subtitulo={`${DIAS[diaSemana]}, ${hoje.toLocaleDateString("pt-BR")}`}
      acao={
        <Link
          href="/equipe"
          className="flex items-center gap-1.5 text-[12.5px] font-bold text-texto2 border border-borda rounded-lg px-3 py-1.5 shrink-0"
          title="Equipe"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 4.6a3.4 3.4 0 1 0 0 6.8 3.4 3.4 0 0 0 0-6.8 M3.2 20a6 6 0 0 1 11.6 0 M16.5 5.6a3.4 3.4 0 0 1 0 6.6 M18 14.4A6 6 0 0 1 21 20" />
          </svg>
          Equipe
        </Link>
      }
    >
      <div className="grid grid-cols-2 gap-3">
        <Metrica valor={String(totalAlunos ?? 0)} texto="Alunos ativos" />
        <Metrica valor={String(totalPresencas ?? 0)} texto="Presenças em 30 dias" cor="#F0E9DF" />
        <Metrica valor={String(aulasHoje.length)} texto="Aulas hoje" />
        <Metrica valor={String(risco?.length ?? 0)} texto="Alunos sumidos" cor={risco?.length ? "#FFB547" : undefined} />
      </div>

      <section className="cartao">
        <div className="rotulo">Aulas de hoje</div>
        {aulasHoje.length === 0 ? (
          <p className="text-texto2 text-[13px]">
            Nenhuma turma marcada para {DIAS[diaSemana].toLowerCase()}. Você pode fazer a chamada
            de qualquer turma em <Link href="/turmas" className="text-ok">Turmas</Link>.
          </p>
        ) : (
          <div className="divide-y divide-borda -my-2">
            {aulasHoje.map((h: any) => (
              <Link key={h.id} href={`/chamada/${h.turma.id}?data=${dataISO}`} className="flex items-center gap-3 py-3 group">
                <div className="text-center w-11 shrink-0">
                  <div className="text-[15px] font-extrabold leading-none tracking-tight">
                    {h.hora_inicio.slice(0, 2)}
                  </div>
                  <div className="text-[10px] text-texto3">:{h.hora_inicio.slice(3, 5)}</div>
                </div>
                <div className="w-px h-9 bg-borda" />
                <div className="min-w-0 flex-1">
                  <div className="text-[13.5px] font-semibold leading-tight truncate group-hover:text-ok transition">
                    {h.turma.nome}
                  </div>
                  <div className="text-[11px] text-texto2 mt-0.5">
                    {h.hora_inicio.slice(0, 5)} – {h.hora_fim.slice(0, 5)}
                  </div>
                </div>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" className="text-texto3 shrink-0">
                  <path d="m9 6 6 6-6 6" />
                </svg>
              </Link>
            ))}
          </div>
        )}
      </section>

      {risco && risco.length > 0 && (
        <section className="cartao">
          <div className="rotulo text-atencao">Precisa da sua atenção</div>
          <div className="divide-y divide-borda -my-2">
            {risco.map((r: any) => (
              <div key={r.aluno_id} className="flex items-center gap-3 py-2">
                <Link href={`/alunos/${r.aluno_id}`} className="flex items-center gap-3 min-w-0 flex-1">
                  <Foto src={r.foto_thumb} nome={r.nome} cor={r.cor_hex} tamanho={38} />
                  <div className="min-w-0 flex-1">
                    <div className="text-[13px] font-semibold truncate">{r.nome}</div>
                    <div className="text-[11px] text-texto2">
                      {r.dias_sem_treinar == null
                        ? "Nunca registrou presença"
                        : `Sem treinar há ${r.dias_sem_treinar} dias`}
                    </div>
                  </div>
                  <Selo tom={(r.dias_sem_treinar ?? 99) >= 21 ? "perigo" : "atencao"}>
                    {(r.dias_sem_treinar ?? 99) >= 21 ? "Risco" : "Aviso"}
                  </Selo>
                </Link>
                <BotaoWhatsapp aluno={r} dias={r.dias_sem_treinar} compacto />
              </div>
            ))}
          </div>
          <p className="text-[11px] text-texto3 mt-3 leading-relaxed">
            O alerta vem da queda de frequência, antes de o aluno sumir de vez. O botão ao lado abre o WhatsApp com a mensagem pronta.
          </p>
        </section>
      )}
    </Shell>
  );
}

function Metrica({ valor, texto, cor }: { valor: string; texto: string; cor?: string }) {
  return (
    <div className="cartao !p-3.5">
      <div className="text-[26px] font-extrabold tracking-tighter leading-none" style={cor ? { color: cor } : undefined}>
        {valor}
      </div>
      <div className="text-[10.5px] text-texto2 mt-1.5 leading-tight">{texto}</div>
    </div>
  );
}
