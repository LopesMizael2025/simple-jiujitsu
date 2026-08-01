"use client";

export type Faixa = {
  id: string;
  nome: string;
  cor_hex: string;
  kids: boolean;
  ordem: number;
  graus_max: number;
};

/**
 * Faixa + graus juntos, porque um não faz sentido sem o outro:
 * o teto de graus vem da faixa escolhida (preta vai até 6, as outras até 4).
 */
export function SeletorGraduacao({
  faixas,
  faixaId,
  graus,
  onFaixa,
  onGraus,
  mostrarKids,
}: {
  faixas: Faixa[];
  faixaId: string;
  graus: number;
  onFaixa: (id: string) => void;
  onGraus: (g: number) => void;
  mostrarKids: boolean;
}) {
  const visiveis = faixas.filter((f) => (mostrarKids ? true : !f.kids));
  const atual = faixas.find((f) => f.id === faixaId);
  const teto = atual?.graus_max ?? 4;

  return (
    <>
      <div>
        <label className="text-[11px] text-texto3 block mb-1.5">Faixa</label>
        <select
          className="campo"
          value={faixaId}
          onChange={(e) => {
            onFaixa(e.target.value);
            const nova = faixas.find((f) => f.id === e.target.value);
            // trocou de faixa: os graus não acompanham, e nunca passam do teto novo
            if (nova && graus > nova.graus_max) onGraus(nova.graus_max);
          }}
        >
          <option value="">Sem faixa ainda</option>
          {visiveis.map((f) => (
            <option key={f.id} value={f.id}>
              {f.nome} {f.kids ? "(kids)" : ""}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="text-[11px] text-texto3 block mb-1.5">
          Graus {atual ? `· máximo ${teto} na ${atual.nome.toLowerCase()}` : ""}
        </label>
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={() => onGraus(Math.max(0, graus - 1))}
            disabled={!atual || graus <= 0}
            className="w-11 h-11 rounded-xl bg-painel border border-borda2 text-xl font-bold
                       disabled:opacity-30 active:scale-95 transition shrink-0"
            aria-label="Menos um grau"
          >
            −
          </button>

          <div className="flex-1 flex items-center justify-center gap-1.5 h-11 rounded-xl bg-painel border border-borda">
            {teto > 0 ? (
              Array.from({ length: teto }).map((_, i) => (
                <span
                  key={i}
                  className="w-4 h-6 rounded-sm transition"
                  style={{
                    background: i < graus ? atual?.cor_hex ?? "#F0E9DF" : "#2A272E",
                    boxShadow: i < graus ? "0 0 0 1px rgba(255,255,255,.18) inset" : "none",
                  }}
                />
              ))
            ) : (
              <span className="text-[12px] text-texto3">Esta faixa não usa graus</span>
            )}
            {teto > 0 && (
              <span className="ml-2 text-[13px] font-bold tabular-nums w-4 text-center">{graus}</span>
            )}
          </div>

          <button
            type="button"
            onClick={() => onGraus(Math.min(teto, graus + 1))}
            disabled={!atual || graus >= teto}
            className="w-11 h-11 rounded-xl bg-painel border border-borda2 text-xl font-bold
                       disabled:opacity-30 active:scale-95 transition shrink-0"
            aria-label="Mais um grau"
          >
            +
          </button>
        </div>
        {!atual && (
          <p className="text-[11px] text-texto3 mt-2">Escolha a faixa para liberar os graus.</p>
        )}
      </div>
    </>
  );
}
