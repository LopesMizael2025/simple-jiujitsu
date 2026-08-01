"use client";

import { useCallback, useEffect, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase";
import { Shell, Selo, Iniciais } from "@/components/Shell";

type Pessoa = { id: string; nome: string | null; papel: string | null };
type Convite = {
  id: string;
  email: string;
  papel: string;
  token: string;
  criado_em: string;
  expira_em: string;
  usado_em: string | null;
  revogado_em: string | null;
};

export default function Equipe() {
  const [sb] = useState(() => supabaseBrowser());

  const [carregando, setCarregando] = useState(true);
  const [souDono, setSouDono] = useState(false);
  const [equipe, setEquipe] = useState<Pessoa[]>([]);
  const [convites, setConvites] = useState<Convite[]>([]);

  const [email, setEmail] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [linkNovo, setLinkNovo] = useState<{ email: string; link: string } | null>(null);
  const [copiado, setCopiado] = useState(false);

  const carregar = useCallback(async () => {
    const eu = (await sb.auth.getUser()).data.user?.id ?? "";
    const [{ data: pessoas }, { data: cs }, { data: meu }] = await Promise.all([
      sb.from("perfil").select("id, nome, papel").order("papel"),
      sb
        .from("convite")
        .select("id, email, papel, token, criado_em, expira_em, usado_em, revogado_em")
        .order("criado_em", { ascending: false }),
      sb.from("perfil").select("papel").eq("id", eu).maybeSingle(),
    ]);
    setEquipe((pessoas ?? []) as Pessoa[]);
    setConvites((cs ?? []) as Convite[]);
    setSouDono(meu?.papel === "dono");
    setCarregando(false);
  }, [sb]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  async function convidar(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    setLinkNovo(null);
    setEnviando(true);
    try {
      const { data, error } = await sb.rpc("criar_convite", {
        p_email: email.trim(),
        p_papel: "professor",
      });
      if (error) throw new Error(traduzir(error.message));

      const linha = (Array.isArray(data) ? data[0] : data) as
        | { out_token?: string; out_email?: string }
        | null;
      if (!linha?.out_token) throw new Error("Não consegui gerar o convite. Tente de novo.");

      setLinkNovo({
        email: linha.out_email ?? email.trim(),
        link: `${location.origin}/vincular?c=${linha.out_token}`,
      });
      setEmail("");
      setCopiado(false);
      carregar();
    } catch (e) {
      setErro((e as Error).message);
    } finally {
      setEnviando(false);
    }
  }

  async function revogar(id: string) {
    await sb.from("convite").update({ revogado_em: new Date().toISOString() }).eq("id", id);
    carregar();
  }

  async function copiar(texto: string) {
    try {
      await navigator.clipboard.writeText(texto);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2500);
    } catch {
      /* alguns navegadores bloqueiam sem gesto do usuário; o link fica à vista para copiar na mão */
    }
  }

  const agora = Date.now();
  const abertos = convites.filter(
    (c) => !c.usado_em && !c.revogado_em && new Date(c.expira_em).getTime() > agora
  );
  const encerrados = convites.filter((c) => !abertos.includes(c));

  return (
    <Shell titulo="Equipe" subtitulo="Quem tem acesso aos dados da escola">
      {carregando ? (
        <div className="cartao py-10 text-center text-texto2 text-[13px]">Carregando…</div>
      ) : (
        <>
          {souDono ? (
            <section className="cartao">
              <div className="rotulo">Convidar professor</div>
              <form onSubmit={convidar} className="space-y-3">
                <input
                  className="campo"
                  type="email"
                  inputMode="email"
                  autoCapitalize="none"
                  placeholder="email@doprofessor.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
                {erro && <p className="text-sangue text-[13px] leading-snug">{erro}</p>}
                <button className="btn-pri" disabled={enviando || !email.trim()}>
                  {enviando ? "Gerando…" : "Gerar convite"}
                </button>
              </form>

              <p className="text-[11px] text-texto3 mt-3 leading-relaxed">
                O link vale 7 dias, serve uma vez só e só funciona para esse e-mail. Se ele vazar
                num grupo, não serve para mais ninguém.
              </p>

              {linkNovo && (
                <div className="mt-4 rounded-xl border border-ok/30 bg-ok/[0.06] p-3.5">
                  <div className="text-[12px] font-bold text-ok">
                    Convite pronto para {linkNovo.email}
                  </div>
                  <p className="text-[11.5px] text-texto2 mt-1.5 leading-relaxed">
                    Mande este link para essa pessoa. Ela entra com o e-mail acima.
                  </p>
                  <div className="mt-2.5 rounded-lg bg-[#141317] border border-borda p-2.5 text-[11px] text-texto2 break-all leading-relaxed">
                    {linkNovo.link}
                  </div>
                  <button type="button" className="btn-sec mt-2.5" onClick={() => copiar(linkNovo.link)}>
                    {copiado ? "Copiado" : "Copiar link"}
                  </button>
                </div>
              )}
            </section>
          ) : (
            <section className="cartao">
              <p className="text-texto2 text-[13px] leading-relaxed">
                Só o dono da escola convida novas pessoas. Fale com ele se precisar liberar acesso
                para alguém.
              </p>
            </section>
          )}

          <section className="cartao">
            <div className="rotulo">Com acesso hoje · {equipe.length}</div>
            <div className="divide-y divide-borda -my-2">
              {equipe.map((p) => (
                <div key={p.id} className="flex items-center gap-3 py-2.5">
                  <Iniciais nome={p.nome?.trim() || "?"} tamanho={36} />
                  <div className="min-w-0 flex-1">
                    <div className="text-[13px] font-semibold truncate">
                      {p.nome?.trim() || "Sem nome"}
                    </div>
                  </div>
                  <Selo tom={p.papel === "dono" ? "ok" : "neutro"}>{p.papel ?? "—"}</Selo>
                </div>
              ))}
            </div>
          </section>

          {abertos.length > 0 && (
            <section className="cartao">
              <div className="rotulo">Convites em aberto · {abertos.length}</div>
              <div className="divide-y divide-borda -my-2">
                {abertos.map((c) => (
                  <div key={c.id} className="flex items-center gap-2 py-2.5">
                    <div className="min-w-0 flex-1">
                      <div className="text-[13px] font-semibold truncate">{c.email}</div>
                      <div className="text-[11px] text-texto2 mt-0.5">
                        Vence {new Date(c.expira_em).toLocaleDateString("pt-BR")}
                      </div>
                    </div>
                    {souDono && (
                      <>
                        <button
                          className="text-[11.5px] font-semibold text-texto2 px-3 min-h-11"
                          onClick={() => copiar(`${location.origin}/vincular?c=${c.token}`)}
                        >
                          Copiar
                        </button>
                        <button
                          className="text-[11.5px] font-semibold text-sangue px-3 min-h-11"
                          onClick={() => revogar(c.id)}
                        >
                          Cancelar
                        </button>
                      </>
                    )}
                  </div>
                ))}
              </div>
            </section>
          )}

          {encerrados.length > 0 && (
            <section className="cartao">
              <div className="rotulo">Histórico</div>
              <div className="divide-y divide-borda -my-2">
                {encerrados.slice(0, 12).map((c) => (
                  <div key={c.id} className="flex items-center gap-3 py-2.5">
                    <div className="min-w-0 flex-1">
                      <div className="text-[12.5px] truncate text-texto2">{c.email}</div>
                      <div className="text-[10.5px] text-texto3 mt-0.5">
                        {new Date(c.criado_em).toLocaleDateString("pt-BR")}
                      </div>
                    </div>
                    <Selo tom={c.usado_em ? "ok" : "neutro"}>
                      {c.usado_em ? "Aceito" : c.revogado_em ? "Cancelado" : "Expirado"}
                    </Selo>
                  </div>
                ))}
              </div>
              <p className="text-[11px] text-texto3 mt-3 leading-relaxed">
                O histórico não é apagado de propósito: se um dia houver dúvida sobre quem teve
                acesso aos dados dos alunos, é aqui que está a resposta.
              </p>
            </section>
          )}
        </>
      )}
    </Shell>
  );
}

function traduzir(msg: string) {
  const m = msg.toLowerCase();
  if (m.includes("e-mail invalido")) return "Esse e-mail não parece válido. Confira e tente de novo.";
  if (m.includes("row-level security") || m.includes("42501"))
    return "Só o dono da escola pode convidar.";
  if (m.includes("nenhuma escola")) return "Sua conta ainda não está vinculada a uma escola.";
  return msg;
}
