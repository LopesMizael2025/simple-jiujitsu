import { Legal, Secao } from "@/components/Legal";

export const metadata = { title: "Política de privacidade · Simple" };

export default function Privacidade() {
  return (
    <Legal titulo="Política de privacidade" atualizado="30 de julho de 2026">
      <Secao titulo="Quem trata o quê">
        <p>
          Sua escola é a <b>controladora</b> dos dados dos alunos: é ela quem decide cadastrar cada
          pessoa e para quê. O Simple é o <b>operador</b>: guarda e processa esses dados por conta e
          ordem da escola. Os dados da sua própria conta de professor (nome, e-mail, senha) somos
          nós que controlamos.
        </p>
      </Secao>

      <Secao titulo="O que guardamos dos alunos">
        <p>
          Nome, data de nascimento, telefone, e-mail, faixa e graus, turmas, presenças e
          observações que a escola registrar. Quando o aluno é menor, também nome, telefone e
          parentesco do responsável.
        </p>
        <p>
          Se houver consentimento de biometria, guardamos um <b>vetor de 128 números</b> derivado do
          rosto. Ele serve para reconhecer, não para reconstruir a imagem. Se houver também
          consentimento de uso de imagem, guardamos uma miniatura do rosto — só para o professor
          reconhecer o aluno na lista.
        </p>
      </Secao>

      <Secao titulo="Por que guardamos">
        <p>
          Para marcar presença, acompanhar frequência, calcular a graduação e avisar a escola quando
          um aluno está sumindo. A base legal para os dados comuns é a execução do contrato entre
          aluno e academia; para a biometria é o <b>consentimento específico</b> (art. 11, I), e para
          menores, o consentimento do responsável legal (art. 14, §1º).
        </p>
      </Secao>

      <Secao titulo="Quem vê">
        <p>
          Só quem faz parte da sua escola. O banco de dados aplica uma regra por linha que impede,
          tecnicamente, que alguém de outra escola veja seus alunos — não é uma checagem da tela,
          que poderia ser contornada. Cada pessoa entra por convite nominal do dono, e o histórico
          de convites fica registrado.
        </p>
        <p>
          Não vendemos dados, não usamos os dados dos seus alunos para treinar modelos e não
          compartilhamos com terceiros para publicidade.
        </p>
      </Secao>

      <Secao titulo="Onde ficam">
        <p>
          Em servidores no Brasil (região de São Paulo), na infraestrutura do Supabase. A aplicação
          é servida pela Vercel. Os modelos de reconhecimento facial são baixados de uma CDN pública
          e rodam <b>no aparelho do professor</b> — a foto da turma não é enviada para servidor
          nenhum.
        </p>
      </Secao>

      <Secao titulo="Revogar e apagar">
        <p>
          O aluno pode revogar o consentimento de biometria a qualquer momento. Ao revogar, o vetor
          é apagado imediatamente por um gatilho do banco; revogar o uso de imagem apaga a miniatura
          do mesmo jeito. O registro de <i>que houve</i> uma revogação é mantido — é ele que prova
          que o pedido foi atendido.
        </p>
        <p>
          Para pedir a eliminação de todo o cadastro de um aluno, ou uma cópia dos dados dele, fale
          com a escola. A escola pode nos acionar pelo e-mail de contato.
        </p>
      </Secao>

      <Secao titulo="Por quanto tempo">
        <p>
          Enquanto o aluno estiver matriculado e a escola usar o Simple. Se a escola encerrar a
          conta, os dados são eliminados. Recomendamos apagar a biometria de quem deixa a academia —
          o dado só deve existir enquanto a finalidade existir.
        </p>
      </Secao>

      <Secao titulo="Seus direitos">
        <p>
          A LGPD garante confirmação de tratamento, acesso, correção, anonimização, portabilidade,
          eliminação e revogação de consentimento (art. 18). Para exercê-los, o aluno fala com a
          academia; a academia fala com a gente.
        </p>
      </Secao>
    </Legal>
  );
}
