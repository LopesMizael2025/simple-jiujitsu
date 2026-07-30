import Link from "next/link";
import { notFound } from "next/navigation";
import { supabaseServer } from "@/lib/supabase-server";
import { Shell, Selo, Foto } from "@/components/Shell";
import { BotaoWhatsapp } from "@/components/BotaoWhatsapp";
import { RevogarBiometria } from "./RevogarBiometria";

export const dynamic = "force-dynamic";

export default async function AlunoDetalhe({ params }: { params: { id: string } }) {
  const sb = supabaseServer();

  const [{ data: aluno }, { data: freq }, { data: bio }, { data: consentimentos }, { data: presencas }] =
    await Promise.all([
      sb
        .from("aluno")
        .select("id, nome, nascimento, telefone, foto_thumb, responsavel_nome, responsavel_telefone, responsavel_parentesco, status, graus, aulas_no_ciclo, faixa:faixa(nome, cor_hex, aulas_por_grau, graus_max)")
        .eq("id", params.id)
        .maybeSingle(),
      sb.from("v_aluno_frequencia").select("aulas_30d, dias_sem_treinar, ultimo_treino").eq("aluno_id", params.id).maybeSingle(),
      sb.from("face_template").select("id, criado_em, qualidade").eq("aluno_id", params.id),
      sb.from("consentimento").select("tipo, concedido, concedido_por, criado_em").eq("aluno_id", params.id).order("criado_em", { ascending: false }),
      sb
        .from("presenca")
        .select("id, criado_em, origem, aula:aula(data, tecnicas, turma:turma(nome))")
        .eq("aluno_id", params.id)
        .order("criado_em", { ascending: false })
        .limit(10),
    ]);

  if (!aluno) notFound();

  const a = aluno as any;
  const faixa = a.faixa;
  const meta = faixa?.aulas_por_grau ?? 0;
  const pct = meta > 0 ? Math.min(100, Math.round((a.aulas_no_ciclo / meta) * 100)) : 0;

  // consentimento vigente = o mais recente de cada tipo
  const vigente = new Map<string, any>();
  for (const c of (consentimentos ?? []) as any[]) if (!vigente.has(c.tipo)) vigente.set(c.tipo, c);
  const temBio = (bio ?? []).length > 0;

  return (
    <Shell
      titulo={a.nome}
      subtitulo={`${faixa?.nome ?? "Sem faixa"} · ${a.graus} ${a.graus === 1 ? "grau" : "graus"}`}
      acao={
        <Link
          href={`/alunos/${a.id}/editar`}
          className="flex items-center gap-1.5 text-[12.5px] font-bold text-ok bg-ok/10
                     border border-ok/30 rounded-lg px-3 py-1.5 shrink-0"
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z" />
          </svg>
          Editar
        </Link>
      }
    >
      <section className="cartao flex items-center gap-4">
        <Foto src={a.foto_thumb} nome={a.nome} cor={faixa?.cor_hex} tamanho={58} />
        <div className="min-w-0 flex-1">
          <div className="font-bold text-[15px] truncate">{a.nome}</div>
          <div className="text-[12px] text-texto2 mt-1">
            {a.nascimento ? `${idade(a.nascimento)} anos` : "Idade não informada"}
            {a.responsavel_nome && ` · resp. ${a.responsavel_nome}`}
          </div>
        </div>
        <Selo tom={a.status === "ativo" ? "ok" : "neutro"}>{a.status}</Selo>
      </section>

      {meta > 0 && (
        <section className="cartao">
          <div className="rotulo">Próximo grau</div>
          <div className="h-1.5 bg-[#1c2836] rounded-full overflow-hidden">
            <div className="h-full rounded-full bg-gradient-to-r from-[#12b98a] to-ok" style={{ width: `${pct}%` }} />
          </div>
          <div className="flex justify-between mt-2.5 text-[11.5px]">
            <span className="text-texto2">
              {a.aulas_no_ciclo} de {meta} aulas
            </span>
            <span className="text-ok font-bold">{pct}%</span>
          </div>
        </section>
      )}

      <div className="grid grid-cols-2 gap-3">
        <div className="cartao !p-3.5">
          <div className="text-[26px] font-extrabold tracking-tighter leading-none text-ok">{freq?.aulas_30d ?? 0}</div>
          <div className="text-[10.5px] text-texto2 mt-1.5">Aulas em 30 dias</div>
        </div>
        <div className="cartao !p-3.5">
          <div
            className="text-[26px] font-extrabold tracking-tighter leading-none"
            style={{ color: (freq?.dias_sem_treinar ?? 0) >= 14 ? "#ED1F25" : undefined }}
          >
            {freq?.dias_sem_treinar ?? "—"}
          </div>
          <div className="text-[10.5px] text-texto2 mt-1.5">Dias sem treinar</div>
        </div>
      </div>

      {(freq?.dias_sem_treinar ?? 0) >= 14 && (
        <section className="cartao border-atencao/30">
          <div className="rotulo text-atencao">Este aluno sumiu</div>
          <p className="text-[12.5px] text-texto2 leading-relaxed mb-3">
            Sem treinar há {freq?.dias_sem_treinar} dias. Um contato agora costuma resolver — depois
            de um mês parado, fica bem mais difícil trazer de volta.
          </p>
          <BotaoWhatsapp aluno={a} dias={freq?.dias_sem_treinar ?? null} />
        </section>
      )}

      <section className="cartao">
        <div className="rotulo">Biometria e consentimentos</div>
        <div className="flex items-center justify-between py-2.5 border-b border-borda">
          <div className="text-[12.5px]">Rosto cadastrado</div>
          <Selo tom={temBio ? "ok" : "neutro"}>{temBio ? "Sim" : "Não"}</Selo>
        </div>
        {(["biometria", "imagem", "comunicacao"] as const).map((t) => {
          const c = vigente.get(t);
          return (
            <div key={t} className="flex items-center justify-between py-2.5 border-b border-borda last:border-0">
              <div className="min-w-0">
                <div className="text-[12.5px] capitalize">{rotuloConsent(t)}</div>
                {c && (
                  <div className="text-[10.5px] text-texto3 mt-0.5 truncate">
                    por {c.concedido_por} · {new Date(c.criado_em).toLocaleDateString("pt-BR")}
                  </div>
                )}
              </div>
              <Selo tom={c?.concedido ? "ok" : c ? "perigo" : "neutro"}>
                {c ? (c.concedido ? "Concedido" : "Revogado") : "Sem registro"}
              </Selo>
            </div>
          );
        })}
        {temBio && <RevogarBiometria alunoId={a.id} nome={a.nome} />}
      </section>

      <section className="cartao">
        <div className="rotulo">Últimos treinos</div>
        {!presencas || presencas.length === 0 ? (
          <p className="text-texto2 text-[13px]">Nenhuma presença registrada ainda.</p>
        ) : (
          <div className="divide-y divide-borda -my-1">
            {(presencas as any[]).map((p) => (
              <div key={p.id} className="flex items-center gap-3 py-2.5">
                <span className="selo bg-[#1e2a38] text-texto2 shrink-0">
                  {new Date(p.aula?.data ?? p.criado_em).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="text-[12px] font-semibold truncate">{p.aula?.turma?.nome ?? "Turma"}</div>
                  {p.aula?.tecnicas && (
                    <div className="text-[10.5px] text-texto2 truncate mt-0.5">{p.aula.tecnicas}</div>
                  )}
                </div>
                <span className="text-[10px] text-texto3 shrink-0">{rotuloOrigem(p.origem)}</span>
              </div>
            ))}
          </div>
        )}
      </section>
    </Shell>
  );
}

function idade(nascimento: string) {
  const n = new Date(nascimento);
  const hoje = new Date();
  let i = hoje.getFullYear() - n.getFullYear();
  const m = hoje.getMonth() - n.getMonth();
  if (m < 0 || (m === 0 && hoje.getDate() < n.getDate())) i--;
  return i;
}

function rotuloConsent(t: string) {
  return { biometria: "Biometria facial", imagem: "Uso de imagem", comunicacao: "Avisos por WhatsApp" }[t] ?? t;
}

function rotuloOrigem(o: string) {
  return { facial: "auto", facial_confirmado: "confirmado", manual: "manual", corrigido: "corrigido" }[o] ?? o;
}
