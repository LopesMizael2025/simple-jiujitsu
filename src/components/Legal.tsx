import Image from "next/image";
import Link from "next/link";

export function Legal({
  titulo,
  atualizado,
  children,
}: {
  titulo: string;
  atualizado: string;
  children: React.ReactNode;
}) {
  return (
    <main className="min-h-dvh">
      <header className="sticky top-0 z-20 bg-fundo/92 backdrop-blur border-b border-borda">
        <div className="max-w-2xl mx-auto px-5 py-3 flex items-center gap-3">
          <Link href="/" className="flex items-center gap-2.5">
            <Image src="/simbolo-claro.png" alt="" width={26} height={26} />
            <span className="font-extrabold text-[16px] tracking-tight">Simple</span>
          </Link>
          <div className="flex-1" />
          <Link href="/entrar" className="text-[13px] font-semibold text-texto2 px-3 py-2">
            Entrar
          </Link>
        </div>
      </header>

      <div className="max-w-2xl mx-auto px-5 py-10">
        <h1 className="text-[28px] font-extrabold tracking-tight">{titulo}</h1>
        <p className="text-texto3 text-[12px] mt-2">Atualizado em {atualizado}</p>
        <div className="mt-8 space-y-7">{children}</div>

        <div className="mt-12 pt-6 border-t border-borda flex gap-5 text-[12.5px] text-texto2">
          <Link href="/termos">Termos</Link>
          <Link href="/privacidade">Privacidade</Link>
          <Link href="/">Início</Link>
        </div>
      </div>
    </main>
  );
}

export function Secao({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="text-[16px] font-bold mb-2.5">{titulo}</h2>
      <div className="space-y-3 text-[13.5px] text-texto2 leading-relaxed">{children}</div>
    </section>
  );
}
