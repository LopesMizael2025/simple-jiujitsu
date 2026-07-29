/**
 * Baixa os modelos de reconhecimento facial para public/models,
 * para o app não depender de CDN externo em produção.
 *
 *   npm run models:download
 *
 * Depois troque no .env:  NEXT_PUBLIC_FACE_MODELS_URL=/models
 */
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

const BASE = "https://cdn.jsdelivr.net/npm/@vladmandic/face-api@1.7.15/model";
const DESTINO = join(process.cwd(), "public", "models");

const ARQUIVOS = [
  "ssd_mobilenetv1.bin",
  "ssd_mobilenetv1.json",
  "face_landmark_68.bin",
  "face_landmark_68.json",
  "face_recognition.bin",
  "face_recognition.json",
];

await mkdir(DESTINO, { recursive: true });

let total = 0;
for (const nome of ARQUIVOS) {
  process.stdout.write(`  ${nome} … `);
  const r = await fetch(`${BASE}/${nome}`);
  if (!r.ok) {
    console.log(`FALHOU (${r.status})`);
    process.exitCode = 1;
    continue;
  }
  const buf = Buffer.from(await r.arrayBuffer());
  await writeFile(join(DESTINO, nome), buf);
  total += buf.length;
  console.log(`${(buf.length / 1048576).toFixed(1)} MB`);
}

console.log(`\nPronto — ${(total / 1048576).toFixed(1)} MB em public/models`);
console.log("Agora ajuste NEXT_PUBLIC_FACE_MODELS_URL=/models");
