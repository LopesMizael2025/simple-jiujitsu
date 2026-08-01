import Image from "next/image";
import Link from "next/link";

export const metadata = {
  title: "Simple · chamada por foto para academias de artes marciais",
  description:
    "Uma foto do tatame marca a presença da turma inteira. Frequência, graduação e alerta de evasão para escolas de jiu-jitsu e muay thai.",
};

export default function Vitrine() {
  return (
    <main className="min-h-dvh">
      {/* ------------------------------------------------------- topo --- */}
      <header className="sticky top-0 z-20 vidro !border-x-0 !border-t-0 !shadow-none">
        <div className="max-w-4xl mx-auto px-5 py-3 flex items-center gap-3">
          <Image src="/simbolo-claro.png" alt="" width={30} height={30} />
          <span className="font-extrabold text-[17px] tracking-tight flex-1">Simple</span>
          <Link href="/entrar" className="text-[13px] font-semibold text-texto2 px-3 py-2">
            Entrar
          </Link>
          <Link
            href="/cadastro"
            className="text-[13px] font-bold text-okEscuro bg-ok rounded-[12px] px-4 py-2.5 border border-white/50"
          >
            Criar conta
          </Link>
        </div>
      </header>

      {/* ------------------------------------------------------ herói --- */}
      <section className="max-w-4xl mx-auto px-5 pt-14 pb-12 text-center">
        <Image src="/simbolo-claro.png" alt="Simple" width={72} height={72} className="mx-auto" priority />
        <h1 className="mt-7 text-[34px] sm:text-[44px] font-extrabold tracking-tight leading-[1.08]">
          Uma foto do tatame
          <br />
          <span className="text-sangue">marca a turma inteira</span>
        </h1>
        <p className="mt-5 text-texto2 text-[15px] leading-relaxed max-w-lg mx-auto">
          O professor tira uma foto no fim da aula. O Simple reconhece os alunos, marca a presença e
          conta as aulas para a próxima graduação. Sem lista, sem caderno, sem catraca.
        </p>
        <div className="mt-8 flex flex-col sm:flex-row gap-3 justify-center">
          <Link
            href="/cadastro"
            className="font-bold text-[15px] text-[#17151A] bg-ok rounded-xl px-7 py-3.5 shadow-[0_8px_28px_rgba(240,233,223,.16)]"
          >
            Criar minha academia
          </Link>
          <Link
            href="/entrar"
            className="font-bold text-[15px] text-texto border border-borda rounded-xl px-7 py-3.5"
          >
            Já tenho conta
          </Link>
        </div>
        <p className="mt-4 text-texto3 text-[12px]">
          Grátis enquanto estamos em testes. Leva dois minutos para começar.
        </p>
      </section>

      {/* ---------------------------------------------------- o que faz --- */}
      <section className="max-w-4xl mx-auto px-5 pb-14">
        <div className="grid sm:grid-cols-2 gap-3">
          <Cartao
            titulo="Chamada por foto"
            texto="Uma foto da turma no fim da aula. Quem o app não reconhecer com certeza, ele pergunta — e você corrige com um toque."
            d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3zM12 17a4 4 0 1 0 0-8 4 4 0 0 0 0 8z"
          />
          <Cartao
            titulo="Graduação sem planilha"
            texto="Cada presença conta para o próximo grau. O app mostra quem está perto da faixa antes de o aluno perguntar."
            d="M12 2l2.9 6.2 6.6.9-4.8 4.8 1.2 6.8L12 17.5 6.1 20.7l1.2-6.8L2.5 9.1l6.6-.9L12 2z"
          />
          <Cartao
            titulo="Aviso antes de sumir"
            texto="Queda de frequência acende o alerta enquanto ainda dá para trazer de volta — com o WhatsApp a um toque."
            d="M12 9v4M12 17h.01M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"
          />
          <Cartao
            titulo="Começa com seus alunos"
            texto="Importe a lista de uma planilha e comece com a escola inteira cadastrada, não com uma tela vazia."
            d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"
          />
        </div>
      </section>

      {/* -------------------------------------------------------- LGPD --- */}
      <section className="max-w-4xl mx-auto px-5 pb-16">
        <div className="cartao">
          <div className="rotulo text-sangue">Biometria feita com cuidado</div>
          <div className="space-y-3.5 text-[13.5px] text-texto2 leading-relaxed">
            <p>
              <b className="text-texto">Guardamos um vetor, não o rosto.</b> O reconhecimento roda no
              navegador do professor, e o que fica salvo é uma lista de 128 números. Não dá para
              reconstruir a foto a partir dela.
            </p>
            <p>
              <b className="text-texto">Consentimento é registrado e reversível.</b> Biometria é dado
              sensível pela LGPD. O aluno autoriza, e se revogar, o dado é apagado na hora — menor de
              idade exige o responsável.
            </p>
            <p>
              <b className="text-texto">Cada academia é uma ilha.</b> O banco impede, por regra, que
              alguém veja aluno de outra escola. Não é uma promessa da tela: é uma trava do banco.
            </p>
          </div>
          <p className="text-[11.5px] text-texto3 mt-4 leading-relaxed">
            Sem biometria o aluno treina normalmente — a presença é marcada na mão. Recusar nunca
            impede ninguém de treinar.
          </p>
        </div>
      </section>

      {/* ----------------------------------------------------- chamada --- */}
      <section className="max-w-4xl mx-auto px-5 pb-20 text-center">
        <h2 className="text-[24px] font-extrabold tracking-tight">Comece com a sua academia</h2>
        <p className="mt-2.5 text-texto2 text-[14px] leading-relaxed max-w-md mx-auto">
          Você cria a escola, ela nasce vazia e só sua. Depois convida os seus professores por
          e-mail.
        </p>
        <Link
          href="/cadastro"
          className="inline-block mt-6 font-bold text-[15px] text-[#17151A] bg-ok rounded-xl px-7 py-3.5"
        >
          Criar conta grátis
        </Link>
      </section>

      <footer className="border-t border-borda">
        <div className="max-w-4xl mx-auto px-5 py-8 text-center space-y-3">
          <div className="flex justify-center gap-5 text-[12.5px] text-texto2">
            <Link href="/termos">Termos</Link>
            <Link href="/privacidade">Privacidade</Link>
            <Link href="/entrar">Entrar</Link>
          </div>
          <p className="text-texto3 text-[11.5px]">
            Simple · gestão para escolas de artes marciais.
          </p>
        </div>
      </footer>
    </main>
  );
}

function Cartao({ titulo, texto, d }: { titulo: string; texto: string; d: string }) {
  return (
    <div className="cartao">
      <div className="w-10 h-10 rounded-[13px] bg-sangue/12 border border-sangue/25 grid place-items-center mb-3">
        <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="#ED1F25" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
          <path d={d} />
        </svg>
      </div>
      <div className="font-bold text-[15px]">{titulo}</div>
      <p className="text-texto2 text-[13px] mt-1.5 leading-relaxed">{texto}</p>
    </div>
  );
}
