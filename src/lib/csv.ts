/**
 * Leitura do CSV que o Google Forms exporta.
 *
 * Escrevi à mão em vez de trazer uma biblioteca porque o caso é estreito e
 * previsível: vírgula ou ponto e vírgula, aspas duplas escapadas dobrando,
 * quebra de linha dentro de campo entre aspas. Isso cobre o Forms e o Excel.
 */

export type Linha = Record<string, string>;

/** Detecta o separador olhando a primeira linha fora de aspas. */
function detectarSeparador(texto: string): string {
  const primeira = texto.split(/\r?\n/)[0] ?? "";
  let virgulas = 0;
  let pontos = 0;
  let dentro = false;
  for (const c of primeira) {
    if (c === '"') dentro = !dentro;
    else if (!dentro && c === ",") virgulas++;
    else if (!dentro && c === ";") pontos++;
  }
  return pontos > virgulas ? ";" : ",";
}

export function lerCsv(texto: string): { colunas: string[]; linhas: Linha[] } {
  // remove BOM do Excel
  const limpo = texto.replace(/^﻿/, "");
  const sep = detectarSeparador(limpo);

  const celulas: string[][] = [];
  let linha: string[] = [];
  let campo = "";
  let dentro = false;

  for (let i = 0; i < limpo.length; i++) {
    const c = limpo[i];

    if (dentro) {
      if (c === '"') {
        if (limpo[i + 1] === '"') {
          campo += '"';
          i++;
        } else {
          dentro = false;
        }
      } else {
        campo += c;
      }
      continue;
    }

    if (c === '"') {
      dentro = true;
    } else if (c === sep) {
      linha.push(campo);
      campo = "";
    } else if (c === "\n") {
      linha.push(campo);
      celulas.push(linha);
      linha = [];
      campo = "";
    } else if (c === "\r") {
      // ignora; o \n seguinte fecha a linha
    } else {
      campo += c;
    }
  }
  if (campo !== "" || linha.length) {
    linha.push(campo);
    celulas.push(linha);
  }

  const cabecalho = (celulas.shift() ?? []).map((c) => c.trim());
  const linhas: Linha[] = celulas
    .filter((l) => l.some((c) => c.trim() !== ""))
    .map((l) => {
      const o: Linha = {};
      cabecalho.forEach((col, i) => (o[col] = (l[i] ?? "").trim()));
      return o;
    });

  return { colunas: cabecalho, linhas };
}

/** Compara textos ignorando acento, caixa e pontuação. */
export function normalizar(s: string) {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/**
 * Adivinha qual coluna do CSV corresponde a cada campo nosso.
 * Erra às vezes — por isso a tela deixa o professor corrigir antes de importar.
 */
export function adivinharColuna(colunas: string[], pistas: string[]): string {
  const alvos = pistas.map(normalizar);
  // primeiro tenta quem começa com a pista (mais específico)
  for (const alvo of alvos) {
    const c = colunas.find((col) => normalizar(col).startsWith(alvo));
    if (c) return c;
  }
  for (const alvo of alvos) {
    const c = colunas.find((col) => normalizar(col).includes(alvo));
    if (c) return c;
  }
  return "";
}

/** "01/02/2010" ou "2010-02-01" → "2010-02-01" */
export function paraDataIso(valor: string): string | null {
  const v = valor.trim();
  if (!v) return null;
  const br = v.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (br) return `${br[3]}-${br[2].padStart(2, "0")}-${br[1].padStart(2, "0")}`;
  const iso = v.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (iso) return `${iso[1]}-${iso[2].padStart(2, "0")}-${iso[3].padStart(2, "0")}`;
  return null;
}

/** "Concordo", "Sim", "true" → true */
export function paraBooleano(valor: string): boolean | undefined {
  const v = normalizar(valor);
  if (!v) return undefined;
  if (["concordo", "sim", "true", "1", "autorizo", "aceito"].some((x) => v.startsWith(x))) return true;
  if (["nao concordo", "nao", "false", "0"].some((x) => v.startsWith(x))) return false;
  return undefined;
}

/**
 * Extrai o nome da faixa a partir do rótulo do formulário.
 * "Jiu-Jitsu adulto - Roxa" → "Roxa" · "Kids - Cinza-Preta" → "Cinza-Preta"
 */
export function extrairFaixa(valor: string): string {
  const v = valor.trim();
  if (!v || normalizar(v).startsWith("ainda nao")) return "";
  const partes = v.split(" - ");
  return (partes.length > 1 ? partes[partes.length - 1] : v).trim();
}

/**
 * O Forms devolve múltipla escolha como "A, B, C" numa célula só, e os rótulos
 * das turmas têm vírgula dentro ("seg/sex 12h, seg/ter 20h") — separar por
 * vírgula quebraria tudo. Então procuramos o nome de cada turma dentro do texto.
 *
 * A pegadinha: "Jiu-Jitsu Adulto" é prefixo de "Jiu-Jitsu Adulto No Gi". Quem
 * marcou só o No Gi seria matriculado nas duas. Por isso testamos do nome mais
 * longo para o mais curto e removemos o trecho já reconhecido.
 */
export function extrairTurmas(valor: string, turmasDaEscola: string[]): string[] {
  let restante = normalizar(valor);
  if (!restante) return [];

  const porTamanho = [...turmasDaEscola].sort(
    (a, b) => normalizar(b).length - normalizar(a).length
  );

  const achadas: string[] = [];
  for (const turma of porTamanho) {
    const alvo = normalizar(turma);
    if (alvo && restante.includes(alvo)) {
      achadas.push(turma);
      restante = restante.split(alvo).join(" "); // consome para não casar de novo
    }
  }
  // devolve na ordem original da escola, não na ordem de tamanho
  return turmasDaEscola.filter((t) => achadas.includes(t));
}
