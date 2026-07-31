"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase";

/** Chegada do link de recuperacao: a sessao ja vem aberta, so falta a senha nova. */
export default function NovaSenha() {
  const router = useRouter();
  const [sb] = useState(() => supabaseBrowser());

  const [temSessao, setTemSessao] = useState<boolean | null>(null);
  const [senha, setSenha] = useState("");
  const [senha2, setSenha2] = useState("");
  const [ver, setVer] = useState(false);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    sb.auth.getSession().then(({ data }) => setTemSessao(!!data.session));
  }, [sb]);

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    if (senha.length < 8) return setErro("A senha precisa de pelo menos 8 caracteres.");
    if (senha !== senha2) return setErro("As duas senhas não são iguais.");

    setCarregando(true);
    try {
      const { error } = await sb.auth.updateUser({ password: senha });
      if (error) throw new Error(error.message);
      router.replace("/inicio");
      router.refresh();
    } catch (e) {
      setErro((e as Error).message);
    } finally {
      setCarregando(false);
    }
  }

  return (
    <main className="min-h-dvh flex flex-col items-center justify-center px-6 py-10">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center mb-7">
          <Image src="/simbolo-claro.png" alt="Simple" width={64} height={64} />
          <h1 className="mt-4 text-xl font-extrabold">Nova senha</h1>
        </div>

        {temSessao === false ? (
          <div className="cartao space-y-4">
            <p className="text-texto2 text-[13px] leading-relaxed">
              Este link não vale mais. Links de recuperação expiram rápido e só funcionam uma vez —
              peça um novo.
            </p>
            <Link href="/recuperar" className="btn-pri">
              Pedir novo link
            </Link>
          </div>
        ) : temSessao === null ? (
          <div className="cartao py-10 text-center">
            <div className="w-8 h-8 mx-auto rounded-full border-[3px] border-borda border-t-ok animate-spin" />
          </div>
        ) : (
          <form onSubmit={salvar} className="cartao space-y-4">
            <div>
              <div className="flex items-center justify-between">
                <div className="rotulo">Senha nova</div>
                <button
                  type="button"
                  className="text-[11px] text-texto3 font-semibold mb-1.5"
                  onClick={() => setVer((v) => !v)}
                >
                  {ver ? "Ocultar" : "Mostrar"}
                </button>
              </div>
              <input
                className="campo"
                type={ver ? "text" : "password"}
                autoComplete="new-password"
                placeholder="Mínimo 8 caracteres"
                value={senha}
                onChange={(e) => setSenha(e.target.value)}
              />
            </div>
            <div>
              <div className="rotulo">Confirmar</div>
              <input
                className="campo"
                type={ver ? "text" : "password"}
                autoComplete="new-password"
                placeholder="Digite de novo"
                value={senha2}
                onChange={(e) => setSenha2(e.target.value)}
              />
            </div>
            {erro && <p className="text-sangue text-[13px] leading-snug">{erro}</p>}
            <button className="btn-pri" disabled={carregando || senha.length < 8 || senha !== senha2}>
              {carregando ? "Salvando…" : "Salvar e entrar"}
            </button>
          </form>
        )}
      </div>
    </main>
  );
}
