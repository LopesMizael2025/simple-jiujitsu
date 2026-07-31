"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase";

const UFS = "AC AL AP AM BA CE DF ES GO MA MT MS MG PA PB PR PE PI RJ RN RS RO RR SC SP SE TO".split(" ");

/**
 * Porta da frente: a academia se inscreve sozinha e ganha uma escola VAZIA.
 * Nao ha risco de vazamento porque nao existe dado de ninguem la dentro --
 * diferente de entrar numa escola que ja existe, que continua so por convite.
 */
export default function Cadastro() {
  const router = useRouter();
  const [sb] = useState(() => supabaseBrowser());

  const [nome, setNome] = useState("");
  const [academia, setAcademia] = useState("");
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [senha2, setSenha2] = useState("");
  const [cidade, setCidade] = useState("");
  const [uf, setUf] = useState("");
  const [aceite, setAceite] = useState(false);

  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [confirmar, setConfirmar] = useState(false);

  const pronto =
    nome.trim().length > 1 &&
    academia.trim().length > 1 &&
    email.includes("@") &&
    senha.length >= 8 &&
    senha === senha2 &&
    aceite;

  async function criar(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);

    if (senha.length < 8) return setErro("A senha precisa de pelo menos 8 caracteres.");
    if (senha !== senha2) return setErro("As duas senhas não são iguais.");
    if (!aceite) return setErro("Você precisa aceitar os termos para continuar.");

    setCarregando(true);
    try {
      const { data, error } = await sb.auth.signUp({
        email: email.trim().toLowerCase(),
        password: senha,
        options: {
          data: { nome: nome.trim(), escola_nome: academia.trim(), cidade: cidade.trim(), uf },
          emailRedirectTo: `${location.origin}/auth/callback?proximo=${encodeURIComponent("/vincular")}`,
        },
      });
      if (error) throw new Error(traduzir(error.message));

      // Com confirmacao de e-mail ligada nao vem sessao: a escola nasce depois,
      // quando a pessoa confirma e volta. Sem confirmacao, ja cria aqui.
      if (!data.session) {
        setConfirmar(true);
        return;
      }

      const { error: e2 } = await sb.rpc("criar_escola", {
        p_nome: academia.trim(),
        p_cidade: cidade.trim() || null,
        p_uf: uf || null,
      });
      if (e2) throw new Error(traduzir(e2.message));

      router.replace("/inicio");
      router.refresh();
    } catch (e) {
      setErro((e as Error).message);
    } finally {
      setCarregando(false);
    }
  }

  if (confirmar) {
    return (
      <Moldura titulo="Confirme seu e-mail">
        <div className="cartao text-center space-y-4">
          <div className="w-12 h-12 mx-auto rounded-full bg-ok/12 grid place-items-center">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#2EE6A8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="2" y="4" width="20" height="16" rx="2" />
              <path d="m22 6-10 7L2 6" />
            </svg>
          </div>
          <p className="text-texto2 text-[13px] leading-relaxed">
            Mandamos um e-mail para <b className="text-texto">{email}</b>. Toque no link para
            confirmar e a academia <b className="text-texto">{academia}</b> é criada na hora.
          </p>
          <p className="text-texto3 text-[11.5px] leading-relaxed">Não chegou? Confira o spam.</p>
          <Link href="/entrar" className="btn-sec">
            Já confirmei — entrar
          </Link>
        </div>
      </Moldura>
    );
  }

  return (
    <Moldura titulo="Criar sua academia" sub="Leva menos de dois minutos.">
      <form onSubmit={criar} className="cartao space-y-4">
        <Campo rotulo="Seu nome" valor={nome} onChange={setNome} placeholder="Como os alunos te chamam" />
        <Campo
          rotulo="Nome da academia"
          valor={academia}
          onChange={setAcademia}
          placeholder="Ex.: Gracie Barra Uberlândia"
          ajuda="É esta escola que você vai gerenciar. Começa vazia e só sua."
        />
        <Campo rotulo="E-mail" valor={email} onChange={setEmail} tipo="email" placeholder="voce@academia.com" />
        <Campo
          rotulo="Senha"
          valor={senha}
          onChange={setSenha}
          tipo="password"
          placeholder="Mínimo 8 caracteres"
          ajuda={senha.length > 0 && senha.length < 8 ? "Faltam " + (8 - senha.length) + " caracteres." : undefined}
        />
        <Campo
          rotulo="Confirmar senha"
          valor={senha2}
          onChange={setSenha2}
          tipo="password"
          placeholder="Digite de novo"
          ajuda={senha2.length > 0 && senha !== senha2 ? "As duas senhas não batem." : undefined}
        />

        <div className="grid grid-cols-[1fr_88px] gap-3">
          <Campo rotulo="Cidade (opcional)" valor={cidade} onChange={setCidade} placeholder="Uberlândia" />
          <div>
            <div className="rotulo">UF</div>
            <select className="campo" value={uf} onChange={(e) => setUf(e.target.value)}>
              <option value="">—</option>
              {UFS.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
        </div>

        <label className="flex items-start gap-3 cursor-pointer pt-1">
          <input
            type="checkbox"
            checked={aceite}
            onChange={(e) => setAceite(e.target.checked)}
            className="mt-0.5 w-5 h-5 shrink-0 accent-[#2EE6A8]"
          />
          <span className="text-[12px] text-texto2 leading-relaxed">
            Li e aceito os <Link href="/termos" className="text-ok underline">Termos de uso</Link> e a{" "}
            <Link href="/privacidade" className="text-ok underline">Política de privacidade</Link>. Entendo
            que sou o responsável pelos dados dos meus alunos, inclusive a biometria facial.
          </span>
        </label>

        {erro && <p className="text-sangue text-[13px] leading-snug">{erro}</p>}

        <button className="btn-pri" disabled={carregando || !pronto}>
          {carregando ? "Criando…" : "Criar academia"}
        </button>

        <p className="text-center text-[12.5px] text-texto2">
          Já tem conta?{" "}
          <Link href="/entrar" className="text-ok font-semibold">
            Entrar
          </Link>
        </p>
      </form>
    </Moldura>
  );
}

function Moldura({ titulo, sub, children }: { titulo: string; sub?: string; children: React.ReactNode }) {
  return (
    <main className="min-h-dvh flex flex-col items-center justify-center px-6 py-10">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center mb-7">
          <Link href="/">
            <Image src="/simbolo-claro.png" alt="Simple" width={64} height={64} />
          </Link>
          <h1 className="mt-4 text-xl font-extrabold text-center">{titulo}</h1>
          {sub && <p className="text-texto2 text-[13px] mt-1">{sub}</p>}
        </div>
        {children}
      </div>
    </main>
  );
}

function Campo({
  rotulo,
  valor,
  onChange,
  tipo = "text",
  placeholder,
  ajuda,
}: {
  rotulo: string;
  valor: string;
  onChange: (v: string) => void;
  tipo?: string;
  placeholder?: string;
  ajuda?: string;
}) {
  return (
    <div>
      <div className="rotulo">{rotulo}</div>
      <input
        className="campo"
        type={tipo}
        value={valor}
        placeholder={placeholder}
        autoCapitalize={tipo === "email" ? "none" : undefined}
        autoComplete={tipo === "password" ? "new-password" : undefined}
        onChange={(e) => onChange(e.target.value)}
      />
      {ajuda && <p className="text-[11px] text-texto3 mt-1.5 leading-relaxed">{ajuda}</p>}
    </div>
  );
}

function traduzir(msg: string) {
  const m = msg.toLowerCase();
  if (m.includes("already registered") || m.includes("already been registered"))
    return "Já existe uma conta com esse e-mail. Tente entrar, ou recupere a senha.";
  if (m.includes("password") && m.includes("least"))
    return "A senha precisa de pelo menos 8 caracteres.";
  if (m.includes("invalid email")) return "Esse e-mail não parece válido.";
  if (m.includes("rate") || m.includes("too many"))
    return "Muitas tentativas seguidas. Espere um minuto.";
  if (m.includes("ja faz parte")) return "Esta conta já faz parte de uma escola.";
  return msg;
}
