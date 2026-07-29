/**
 * Motor de reconhecimento facial — roda 100% no navegador do professor.
 *
 * Por que no navegador:
 *  · custo zero, sem chave de API, sem cota
 *  · a foto do grupo NUNCA sai do aparelho — só o vetor de 128 números sai,
 *    e vetor não reconstrói rosto. É o melhor argumento de LGPD que existe.
 *
 * Trocar de motor (AWS Rekognition, InsightFace) depois é mexer só neste arquivo:
 * a aplicação só conhece `detectarRostos` e `extrairDescritor`.
 */

let faceapi: typeof import("@vladmandic/face-api") | null = null;
let carregado = false;
let carregando: Promise<void> | null = null;

const MODELS_URL =
  process.env.NEXT_PUBLIC_FACE_MODELS_URL ||
  "https://cdn.jsdelivr.net/npm/@vladmandic/face-api@1.7.15/model";

/** Limiares de distância euclidiana (menor = mais parecido). */
export const LIMIAR = {
  /** Abaixo disso, marcamos presença sozinho. */
  AUTO: 0.45,
  /** Entre AUTO e CONFIRMAR, pedimos confirmação do professor. */
  CONFIRMAR: 0.6,
} as const;

export type Deteccao = {
  /** Vetor de 128 dimensões — é isso que vai para o banco. */
  descritor: number[];
  /** Caixa do rosto na foto, em pixels. */
  box: { x: number; y: number; width: number; height: number };
  /** Confiança da detecção (0–1). */
  score: number;
  /** Recorte do rosto em dataURL, só para mostrar na tela de confirmação. */
  thumb: string;
};

/** Baixa os modelos uma vez e mantém em memória. ~13 MB, fica em cache. */
export async function prepararMotor(aoProgredir?: (msg: string) => void) {
  if (carregado) return;
  if (carregando) return carregando;

  carregando = (async () => {
    aoProgredir?.("Carregando o reconhecimento facial…");
    faceapi = await import("@vladmandic/face-api");

    // O face-api escolhe WebGL sozinho e cai para CPU se não houver GPU.
    aoProgredir?.("Baixando modelos (só na primeira vez)…");
    await Promise.all([
      faceapi.nets.ssdMobilenetv1.loadFromUri(MODELS_URL),
      faceapi.nets.faceLandmark68Net.loadFromUri(MODELS_URL),
      faceapi.nets.faceRecognitionNet.loadFromUri(MODELS_URL),
    ]);

    carregado = true;
    aoProgredir?.("Pronto.");
  })();

  return carregando;
}

export function motorPronto() {
  return carregado;
}

function recortar(
  origem: HTMLImageElement | HTMLCanvasElement,
  box: { x: number; y: number; width: number; height: number },
  lado = 128
): string {
  const folga = box.width * 0.22;
  const x = Math.max(0, box.x - folga);
  const y = Math.max(0, box.y - folga);
  const w = box.width + folga * 2;
  const h = box.height + folga * 2;

  const c = document.createElement("canvas");
  c.width = lado;
  c.height = lado;
  const ctx = c.getContext("2d")!;
  ctx.drawImage(origem, x, y, w, h, 0, 0, lado, lado);
  return c.toDataURL("image/jpeg", 0.72);
}

/**
 * Foto de grupo → todos os rostos com seus descritores.
 * `minConfidence` baixo acha mais rostos pequenos (fundo da turma) ao custo
 * de algum falso positivo — que a tela de confirmação filtra.
 */
export async function detectarRostos(
  img: HTMLImageElement,
  minConfidence = 0.35
): Promise<Deteccao[]> {
  await prepararMotor();
  if (!faceapi) throw new Error("Motor facial não carregou");

  const resultados = await faceapi
    .detectAllFaces(img, new faceapi.SsdMobilenetv1Options({ minConfidence, maxResults: 60 }))
    .withFaceLandmarks()
    .withFaceDescriptors();

  return resultados.map((r) => {
    const b = r.detection.box;
    const box = { x: b.x, y: b.y, width: b.width, height: b.height };
    return {
      descritor: Array.from(r.descriptor),
      box,
      score: r.detection.score,
      thumb: recortar(img, box),
    };
  });
}

/**
 * Foto de cadastro (um rosto só) → um descritor.
 * Devolve null se não achar rosto ou se achar mais de um.
 */
export async function extrairDescritor(
  img: HTMLImageElement
): Promise<{ descritor: number[]; score: number; thumb: string } | null> {
  await prepararMotor();
  if (!faceapi) throw new Error("Motor facial não carregou");

  const r = await faceapi
    .detectSingleFace(img, new faceapi.SsdMobilenetv1Options({ minConfidence: 0.5 }))
    .withFaceLandmarks()
    .withFaceDescriptor();

  if (!r) return null;

  const b = r.detection.box;
  return {
    descritor: Array.from(r.descriptor),
    score: r.detection.score,
    thumb: recortar(img, { x: b.x, y: b.y, width: b.width, height: b.height }, 256),
  };
}

/** Carrega um File/Blob como <img> já decodificada. */
export function carregarImagem(fonte: File | Blob | string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Não consegui abrir a imagem"));
    img.src = typeof fonte === "string" ? fonte : URL.createObjectURL(fonte);
  });
}

/**
 * Reduz a foto antes de processar. Celular tira 4000px; 1600px é suficiente
 * para achar rosto e deixa a detecção ~6x mais rápida.
 */
export async function redimensionar(img: HTMLImageElement, maxLado = 1600): Promise<HTMLImageElement> {
  const maior = Math.max(img.width, img.height);
  if (maior <= maxLado) return img;

  const escala = maxLado / maior;
  const c = document.createElement("canvas");
  c.width = Math.round(img.width * escala);
  c.height = Math.round(img.height * escala);
  c.getContext("2d")!.drawImage(img, 0, 0, c.width, c.height);

  return carregarImagem(c.toDataURL("image/jpeg", 0.9));
}
