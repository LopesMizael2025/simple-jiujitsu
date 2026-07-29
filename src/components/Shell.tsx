"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase";

const ITENS = [
  { href: "/inicio", nome: "Início", d: "M3 10.5 12 3l9 7.5V21H3z M9 21v-7h6v7" },
  { href: "/turmas", nome: "Turmas", d: "M3 4.5h18v16H3z M8 2.5v4 M16 2.5v4 M3 10h18" },
  { href: "/alunos", nome: "Alunos", d: "M9 4.6a3.4 3.4 0 1 0 0 6.8 3.4 3.4 0 0 0 0-6.8 M3.2 20a6 6 0 0 1 11.6 0 M16.5 5.6a3.4 3.4 0 0 1 0 6.6 M18 14.4A6 6 0 0 1 21 20" },
];

export function Shell({
  titulo,
  subtitulo,
  acao,
  children,
}: {
  titulo: string;
  subtitulo?: string;
  acao?: React.ReactNode;
  children: React.ReactNode;
}) {
  const path = usePathname();
  const router = useRouter();

  async function sair() {
    await supabaseBrowser().auth.signOut();
    router.replace("/entrar");
  }

  return (
    <div className="min-h-dvh pb-24">
      <header className="sticky top-0 z-20 bg-fundo/92 backdrop-blur border-b border-borda">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center gap-3">
          <Link href="/inicio" className="shrink-0">
            <Image src="/simbolo-claro.png" alt="Simple" width={30} height={30} />
          </Link>
          <div className="min-w-0 flex-1">
            <h1 className="text-[19px] font-extrabold tracking-tight truncate">{titulo}</h1>
            {subtitulo && <p className="text-[12px] text-texto2 truncate">{subtitulo}</p>}
          </div>
          {acao}
          <button
            onClick={sair}
            className="text-texto3 hover:text-texto p-2 -mr-2"
            title="Sair"
            aria-label="Sair"
          >
            <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" />
            </svg>
          </button>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-4 space-y-3">{children}</main>

      <nav className="fixed bottom-0 inset-x-0 z-20 bg-[#0b1219]/96 backdrop-blur border-t border-borda">
        <div className="max-w-2xl mx-auto flex">
          {ITENS.map((i) => {
            const ativo = path.startsWith(i.href);
            return (
              <Link
                key={i.href}
                href={i.href}
                className={`flex-1 flex flex-col items-center gap-1 py-2.5 pb-[calc(0.75rem+env(safe-area-inset-bottom))] text-[10px] font-semibold transition ${
                  ativo ? "text-ok" : "text-texto3 hover:text-texto"
                }`}
              >
                <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
                  <path d={i.d} />
                </svg>
                {i.nome}
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}

export function Selo({ tom, children }: { tom: "ok" | "atencao" | "perigo" | "neutro"; children: React.ReactNode }) {
  const cores = {
    ok: "bg-ok/12 text-ok",
    atencao: "bg-atencao/12 text-atencao",
    perigo: "bg-sangue/15 text-sangue",
    neutro: "bg-[#1e2a38] text-texto2",
  }[tom];
  return <span className={`selo ${cores}`}>{children}</span>;
}

export function Iniciais({ nome, cor, tamanho = 38 }: { nome: string; cor?: string | null; tamanho?: number }) {
  const ini = nome.split(" ").filter(Boolean).map((p) => p[0]).slice(0, 2).join("").toUpperCase();
  const fundo = cor || "#2EE6A8";
  return (
    <div
      className="rounded-xl grid place-items-center font-bold shrink-0"
      style={{
        width: tamanho,
        height: tamanho,
        background: fundo,
        color: contraste(fundo),
        fontSize: tamanho * 0.34,
      }}
    >
      {ini}
    </div>
  );
}

function contraste(hex: string) {
  const h = hex.replace("#", "");
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return (r * 299 + g * 587 + b * 114) / 1000 > 140 ? "#0A0E13" : "#FFFFFF";
}

export function Vazio({ titulo, texto, acao }: { titulo: string; texto: string; acao?: React.ReactNode }) {
  return (
    <div className="cartao text-center py-10">
      <p className="font-bold text-[15px]">{titulo}</p>
      <p className="text-texto2 text-[13px] mt-1.5 leading-relaxed max-w-xs mx-auto">{texto}</p>
      {acao && <div className="mt-5 max-w-[220px] mx-auto">{acao}</div>}
    </div>
  );
}
