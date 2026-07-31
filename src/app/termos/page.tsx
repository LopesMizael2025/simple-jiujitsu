import Link from "next/link";
import { Legal, Secao } from "@/components/Legal";

export const metadata = { title: "Termos de uso · Simple" };

export default function Termos() {
  return (
    <Legal titulo="Termos de uso" atualizado="30 de julho de 2026">
      <Secao titulo="O que é o Simple">
        <p>
          O Simple é um sistema de gestão para escolas de artes marciais: cadastro de alunos,
          chamada por reconhecimento facial, controle de frequência e de graduação. Você usa pelo
          navegador, e não instala nada.
        </p>
      </Secao>

      <Secao titulo="Sua conta e sua escola">
        <p>
          Ao criar uma conta você cria também uma escola, e passa a ser o dono dela. Só você pode
          convidar outras pessoas para essa escola, e cada convite vale para um e-mail específico.
          Você é responsável por quem convida: um professor convidado enxerga todos os alunos da
          escola, inclusive dados de menores.
        </p>
        <p>
          Guarde sua senha. Se desconfiar que alguém teve acesso à sua conta, troque a senha e
          cancele os convites em aberto na tela de Equipe.
        </p>
      </Secao>

      <Secao titulo="Quem responde pelos dados dos alunos">
        <p>
          Pela LGPD, <b>a sua escola é a controladora</b> dos dados dos alunos e o Simple é o
          operador: nós tratamos os dados por sua conta e ordem. Na prática isso significa que cabe
          a você coletar o consentimento dos alunos, responder aos pedidos deles e usar os dados só
          para o que a escola precisa.
        </p>
        <p>
          O app ajuda: registra cada consentimento com data e quem autorizou, exige o responsável
          legal quando o aluno é menor, e apaga a biometria na hora em que alguém revoga. Mas a
          decisão de cadastrar cada aluno é sua.
        </p>
      </Secao>

      <Secao titulo="Biometria facial">
        <p>
          O reconhecimento acontece no navegador do professor. O que é guardado é um vetor de 128
          números derivado do rosto — não a fotografia — e ele não permite reconstruir a imagem.
        </p>
        <p>
          Biometria é dado pessoal sensível (art. 5º, II da LGPD) e exige consentimento específico e
          destacado. Nunca cadastre a biometria de um aluno sem que ele (ou o responsável, se for
          menor) tenha autorizado. Recusar não pode impedir ninguém de treinar — a presença
          continua podendo ser marcada na mão.
        </p>
      </Secao>

      <Secao titulo="Uso aceitável">
        <p>
          Não use o Simple para cadastrar pessoas sem o conhecimento delas, para vigiar frequentadores
          que não são seus alunos, ou para qualquer finalidade que você não tenha explicado a quem
          teve o rosto cadastrado. Podemos encerrar contas que façam isso.
        </p>
      </Secao>

      <Secao titulo="Enquanto estamos em testes">
        <p>
          O Simple está em fase de testes e o uso é gratuito. Nesse período o serviço é oferecido
          como está, sem garantia de disponibilidade contínua. Avisaremos com antecedência antes de
          qualquer cobrança começar, e você poderá exportar seus dados se decidir não seguir.
        </p>
      </Secao>

      <Secao titulo="Encerrar">
        <p>
          Você pode parar de usar quando quiser e pedir a eliminação dos dados da sua escola pelo
          e-mail de contato. Também podemos encerrar contas que violem estes termos ou a lei.
        </p>
      </Secao>

      <p className="text-texto3 text-[12px] leading-relaxed pt-2">
        Dúvidas sobre estes termos ou sobre os dados da sua escola? Fale com a gente antes de
        aceitar. Veja também a{" "}
        <Link href="/privacidade" className="text-ok underline">
          Política de privacidade
        </Link>
        .
      </p>
    </Legal>
  );
}
