"use client";

import { destinatario, linkWhatsapp, mensagemAusencia } from "@/lib/whatsapp";

type AlunoContato = {
  nome: string;
  telefone?: string | null;
  responsavel_nome?: string | null;
  responsavel_telefone?: string | null;
};

/**
 * Abre o WhatsApp com a mensagem pronta. Não envia nada sozinho: o professor
 * lê, ajusta se quiser e decide mandar. Automatizar o envio seria falar em
 * nome dele com o aluno — não é o nosso papel.
 */
export function BotaoWhatsapp({
  aluno,
  dias,
  compacto,
}: {
  aluno: AlunoContato;
  dias: number | null;
  compacto?: boolean;
}) {
  const alvo = destinatario(aluno);

  if (!alvo) {
    return compacto ? null : (
      <span className="text-[11px] text-texto3">Sem telefone cadastrado</span>
    );
  }

  const href = linkWhatsapp(alvo.numero, mensagemAusencia(aluno, dias));

  if (compacto) {
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        onClick={(e) => e.stopPropagation()}
        className="w-11 h-11 grid place-items-center rounded-xl bg-ok/12 text-ok shrink-0"
        aria-label={`Chamar ${alvo.nome} no WhatsApp`}
        title={`Chamar ${alvo.nome} no WhatsApp`}
      >
        <svg width="19" height="19" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.45 1.32 4.95L2 22l5.25-1.38a9.9 9.9 0 0 0 4.79 1.22h.01c5.46 0 9.9-4.45 9.9-9.91C21.95 6.45 17.5 2 12.04 2zm5.8 14.17c-.24.68-1.42 1.31-1.96 1.36-.5.05-.98.24-3.3-.69-2.78-1.1-4.55-3.94-4.69-4.12-.14-.19-1.12-1.49-1.12-2.85 0-1.35.71-2.02.96-2.29a1 1 0 0 1 .73-.34h.52c.17 0 .4-.06.62.48.24.57.8 1.98.87 2.12.07.15.12.32.02.51-.1.19-.15.31-.29.48-.15.17-.31.38-.44.51-.15.14-.3.3-.13.59.17.29.76 1.25 1.63 2.03 1.12 1 2.06 1.31 2.35 1.46.29.14.46.12.63-.07.17-.2.73-.85.92-1.14.19-.29.39-.24.65-.14.26.09 1.67.79 1.96.93.29.15.48.22.55.34.07.12.07.7-.17 1.38z" />
        </svg>
      </a>
    );
  }

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="btn-pri !bg-[#25D366] !text-[#04231b] !shadow-[0_6px_20px_rgba(37,211,102,.22)]"
    >
      <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
        <path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.45 1.32 4.95L2 22l5.25-1.38a9.9 9.9 0 0 0 4.79 1.22h.01c5.46 0 9.9-4.45 9.9-9.91C21.95 6.45 17.5 2 12.04 2zm5.8 14.17c-.24.68-1.42 1.31-1.96 1.36-.5.05-.98.24-3.3-.69-2.78-1.1-4.55-3.94-4.69-4.12-.14-.19-1.12-1.49-1.12-2.85 0-1.35.71-2.02.96-2.29a1 1 0 0 1 .73-.34h.52c.17 0 .4-.06.62.48.24.57.8 1.98.87 2.12.07.15.12.32.02.51-.1.19-.15.31-.29.48-.15.17-.31.38-.44.51-.15.14-.3.3-.13.59.17.29.76 1.25 1.63 2.03 1.12 1 2.06 1.31 2.35 1.46.29.14.46.12.63-.07.17-.2.73-.85.92-1.14.19-.29.39-.24.65-.14.26.09 1.67.79 1.96.93.29.15.48.22.55.34.07.12.07.7-.17 1.38z" />
      </svg>
      Falar com {alvo.ehResponsavel ? alvo.nome.split(" ")[0] : "o aluno"} no WhatsApp
    </a>
  );
}
