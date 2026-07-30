/**
 * Links de WhatsApp para o professor agir a partir dos alertas.
 *
 * O painel dizia "6 alunos sumidos" e parava por aí — diagnóstico sem remédio.
 * O valor de perceber a evasão cedo só existe se dá para falar com a pessoa
 * no mesmo toque.
 */

/** (34) 99999-9999 → 5534999999999 (formato que o wa.me espera) */
export function paraWhatsapp(bruto?: string | null): string | null {
  if (!bruto) return null;
  const d = bruto.replace(/\D/g, "");
  if (d.length < 10) return null;
  if (d.startsWith("55") && d.length >= 12) return d;
  return "55" + d;
}

/**
 * Escolhe para quem falar: se tem responsável cadastrado, é com ele.
 * Falar com uma criança de 8 anos sobre falta não faz sentido.
 */
export function destinatario(aluno: {
  nome: string;
  telefone?: string | null;
  responsavel_nome?: string | null;
  responsavel_telefone?: string | null;
}): { numero: string; nome: string; ehResponsavel: boolean } | null {
  const doResp = paraWhatsapp(aluno.responsavel_telefone);
  if (doResp && aluno.responsavel_nome) {
    return { numero: doResp, nome: aluno.responsavel_nome, ehResponsavel: true };
  }
  const doAluno = paraWhatsapp(aluno.telefone);
  if (doAluno) return { numero: doAluno, nome: aluno.nome, ehResponsavel: false };
  return null;
}

/**
 * Mensagem de quem sumiu. Tom de quem sentiu falta, não de cobrança —
 * o objetivo é trazer de volta, não constranger.
 */
export function mensagemAusencia(
  aluno: { nome: string; responsavel_nome?: string | null },
  dias: number | null,
  escola = "Simple"
): string {
  const primeiro = aluno.nome.split(" ")[0];
  const paraResp = !!aluno.responsavel_nome;

  const quanto =
    dias == null
      ? "faz um tempo"
      : dias >= 30
        ? `faz mais de um mês`
        : `faz ${dias} dias`;

  return paraResp
    ? `Oi! Aqui é da ${escola}. Notamos que o ${primeiro} não aparece no treino ${quanto}. Está tudo bem? Se precisar remarcar ou trocar de horário, é só falar com a gente.`
    : `Opa ${primeiro}, tudo certo? Aqui é da ${escola}. Senti sua falta no tatame, ${quanto} que você não aparece. Bora voltar? Se precisar mudar de horário, me avisa.`;
}

export function linkWhatsapp(numero: string, texto: string): string {
  return `https://wa.me/${numero}?text=${encodeURIComponent(texto)}`;
}
