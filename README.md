<div align="center">
  <img src="public/simbolo.png" width="110" alt="Simple">
  <h1>Simple Jiu-Jitsu</h1>
  <p><b>Chamada por foto, frequência e graduação — sem tirar o professor do tatame.</b></p>
</div>

---

## O que é

Sistema de gestão para escolas de artes marciais. O professor tira **uma foto do grupo** no fim do
treino e o app identifica quem estava, mostra o resultado para ele conferir, e grava a presença.

**A diferença para o que existe no mercado:**

1. **O reconhecimento roda no navegador do professor.** A foto do grupo nunca sai do aparelho — só
   um vetor de 128 números vai para o banco, e vetor não reconstrói rosto. Custo de IA: zero.
2. **A IA propõe, o humano confirma.** A tela mostra *"identifiquei 10 de 14"* e o professor
   resolve o resto em cinco segundos. Nenhum concorrente admite que o reconhecimento erra.
3. **LGPD é arquitetura, não checkbox.** Consentimento append-only, revogação que apaga o vetor por
   gatilho no banco, alternativa manual sempre disponível, fluxo próprio para menores.

## Stack

| Camada | Escolha |
|---|---|
| App | Next.js 14 (App Router) + TypeScript + Tailwind · PWA instalável |
| Banco | Supabase Postgres + **pgvector** (HNSW) |
| Auth | Supabase — OTP por WhatsApp (Twilio Verify) ou link mágico por e-mail |
| Reconhecimento facial | `@vladmandic/face-api` no navegador (128-d, distância euclidiana) |
| Hospedagem | Vercel |

---

# Deploy passo a passo

Do zero ao professor usando: **~30 minutos.**

## 1. Supabase

1. Crie um projeto em [supabase.com](https://supabase.com) — região **South America (São Paulo)**.
2. Guarde a senha do banco.
3. Vá em **SQL Editor** e rode os três arquivos de `supabase/migrations/`, **nesta ordem**:

   ```
   20260728000001_init.sql
   20260728000002_rls.sql
   20260728000003_onboarding_storage_seed.sql
   ```

   Cole o conteúdo de cada um, clique em *Run*, confira que deu sucesso, e só então passe para o
   próximo. O terceiro cria a escola **Simple** com o código de convite `SIMPLE2026`.

4. Em **Project Settings → API**, copie:
   - `Project URL` → vai virar `NEXT_PUBLIC_SUPABASE_URL`
   - `anon public` → vai virar `NEXT_PUBLIC_SUPABASE_ANON_KEY`

> A chave `anon` pode ficar exposta no navegador — é para isso que ela existe. Quem protege os dados
> é a RLS, que já está toda configurada. **Nunca** coloque a `service_role` no app.

### Troque o código de convite

Antes de soltar para a equipe, rode no SQL Editor:

```sql
update escola set codigo_convite = 'SEU-CODIGO-AQUI' where slug = 'simple';
```

## 2. Login por WhatsApp

O Supabase manda o código via **Twilio Verify**, que tem canal WhatsApp nativo.

1. Crie conta na [Twilio](https://www.twilio.com/) e ative um **Verify Service**
   (*Verify → Services → Create*). Anote o **Service SID**.
2. Em *Verify → Service → Channels*, habilite **WhatsApp** (a Twilio faz a aprovação do template;
   costuma levar de algumas horas a 2 dias úteis).
3. No Supabase: **Authentication → Sign In / Providers → Phone**
   - Ligue **Enable Phone provider**
   - SMS provider: **Twilio Verify**
   - Preencha Account SID, Auth Token e Message Service SID (= o Verify Service SID)
4. Ainda em Authentication → deixe **Enable phone signup** ligado enquanto testa. Depois de todos os
   professores entrarem, **desligue** — aí só quem já tem conta consegue acessar.

### Enquanto o WhatsApp não é aprovado

Suba com login por e-mail, que funciona na hora e não depende de ninguém:

```
NEXT_PUBLIC_AUTH_MODE=email
```

Trocar depois é mudar essa variável na Vercel e redeployar. O código já suporta os dois.

## 3. Vercel

1. Suba este projeto para um repositório no GitHub.
2. Em [vercel.com](https://vercel.com) → **Add New → Project** → importe o repositório.
   O Next.js é detectado sozinho; não mexa em build settings.
3. Em **Environment Variables**, adicione:

   | Nome | Valor |
   |---|---|
   | `NEXT_PUBLIC_SUPABASE_URL` | a Project URL do Supabase |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | a chave `anon public` |
   | `NEXT_PUBLIC_AUTH_MODE` | `whatsapp` (ou `email` para começar) |
   | `NEXT_PUBLIC_FACE_MODELS_URL` | `https://cdn.jsdelivr.net/npm/@vladmandic/face-api@1.7.15/model` |

4. **Deploy.**
5. Volte ao Supabase → **Authentication → URL Configuration** e coloque a URL da Vercel em
   *Site URL* e em *Redirect URLs* (`https://seu-app.vercel.app/**`).

## 4. Primeiro acesso

1. Abra a URL da Vercel **no celular**.
2. Entre com seu WhatsApp (ou e-mail).
3. O app pede o **código da escola** — digite o que você configurou.
   **O primeiro a entrar vira `dono`**; os seguintes entram como `professor`.
4. Adicione à tela de início: no iPhone, *Compartilhar → Adicionar à Tela de Início*. No Android o
   Chrome oferece sozinho. Vira app de verdade, sem passar por loja.

## 5. Rodar local (opcional)

```bash
npm install
cp .env.example .env.local     # preencha com os dados do seu Supabase
npm run dev
```

A câmera só funciona em **HTTPS ou localhost** — é regra do navegador, não do app.

---

# Como usar no dia a dia

### Cadastrar um aluno (uma vez por aluno)

**Alunos → +**. Preencha nome e faixa, tire a foto do rosto (de frente, boa luz, só o aluno),
marque os consentimentos e escolha as turmas.

Se a data de nascimento indicar menor de 18, o formulário passa a exigir responsável legal e o
consentimento biométrico é registrado em nome dele — como manda o art. 14, §1º da LGPD.

### Fazer a chamada

**Início → toque na aula de hoje** (ou **Turmas → a turma**). Tire a foto do grupo. O app mostra:

| Cor | O que significa | O que fazer |
|---|---|---|
| 🟢 Verde | distância ≤ 0,45 — reconhecido com folga | já vem marcado |
| 🟡 Amarelo | 0,45 a 0,60 — parecido, mas não garantido | você confirma |
| ⚪ Cinza | não bateu com ninguém | visitante, ou aluno sem biometria |

Embaixo vem a lista de quem **não apareceu na foto** — toque para marcar quem treinou.
Confirme e pronto.

### Se der ruim

O botão **"Pular foto — marcar na mão"** está sempre lá. O sistema nunca prende o professor.

---

# Ajustar a precisão

Se o reconhecimento estiver marcando gente errada, aumente o rigor em `src/lib/face.ts`:

```ts
export const LIMIAR = {
  AUTO: 0.45,       // menor = mais rigoroso, marca sozinho menos gente
  CONFIRMAR: 0.60,  // menor = mostra menos sugestões duvidosas
};
```

Se estiver deixando gente de fora, o caminho é outro: **cadastre mais de uma foto por aluno**
(a tabela `face_template` aceita vários vetores por pessoa e a busca já pega o mais próximo).
Duas ou três fotos com ângulos diferentes melhoram bem mais que mexer no limiar.

**Dicas de foto que valem mais que qualquer ajuste:** turma em duas fileiras em vez de três, todo
mundo olhando para a câmera, luz de frente e não contra a janela, e o professor um passo mais perto.

---

# Hospedar os modelos junto com o app

Por padrão os modelos (~13 MB) vêm de CDN. Para não depender de terceiro:

```bash
npm run models:download
```

Depois troque a variável na Vercel para `NEXT_PUBLIC_FACE_MODELS_URL=/models` e redeploy.

---

# Estrutura

```
src/
├── app/
│   ├── entrar/            login OTP (WhatsApp ou e-mail)
│   ├── vincular/          entrada na escola pelo código de convite
│   ├── inicio/            aulas do dia, métricas, risco de evasão
│   ├── turmas/            lista de turmas com atalho para a chamada
│   ├── chamada/[turmaId]/ ⭐ o núcleo: foto → detecção → confirmação → gravação
│   └── alunos/            lista, cadastro com biometria, ficha do aluno
├── components/Shell.tsx   layout, navegação, átomos de UI
├── lib/face.ts            motor facial — trocar de provedor mexe só aqui
├── lib/supabase.ts        clientes de browser e servidor
└── middleware.ts          sessão, rotas protegidas, redirect para /vincular

supabase/migrations/       schema, RLS, funções de busca, seed
```

---

# Modelo de dados (resumo)

| Tabela | Papel |
|---|---|
| `escola`, `perfil` | multi-tenant + equipe. Toda RLS passa por `minha_escola()` |
| `aluno`, `faixa`, `modalidade` | cadastro e trilha de graduação |
| `consentimento` | **append-only**. Revogar é inserir, nunca editar |
| `face_template` | `vector(128)` com índice HNSW. Gatilho apaga na revogação |
| `turma`, `turma_horario`, `matricula` | grade e vínculo aluno↔turma |
| `aula`, `presenca` | a presença guarda `origem`, `distancia` e `confirmado_por` |

Funções principais:

- `buscar_rostos(jsonb, real)` — recebe todos os rostos da foto de uma vez e devolve os matches
- `registrar_chamada(...)` — grava a aula e as presenças numa transação só
- `vincular_escola(codigo)` — onboarding do professor
- Views `v_aluno_frequencia`, `v_risco_evasao`, `v_elegivel_graduacao`

---

# O que ainda não tem

Deliberadamente fora do primeiro deploy:

- **Financeiro** — mensalidade, Pix, inadimplência
- **Área do aluno/responsável** — hoje só a equipe entra
- **Bot de WhatsApp** — avisos automáticos, 2ª via
- **Certificados de graduação**
- **Totem de entrada** — reconhecimento individual na porta, precisão bem maior

---

# Antes de vender para outras academias

O schema já é multi-tenant, mas falta:

- [ ] Rodar o **teste de fogo da RLS**: criar duas escolas e confirmar que uma não enxerga a outra
- [ ] Fluxo de criação de escola pelo próprio cliente (hoje é `insert` manual no SQL)
- [ ] Backup automático e política de retenção documentada
- [ ] **Encarregado de dados (DPO)** nomeado e política de privacidade publicada — obrigatório
      quando você passa a tratar biometria de terceiros
- [ ] Contrato de operador de dados com cada academia cliente
- [ ] Medir a precisão real do reconhecimento em campo antes de prometer número em página de vendas

---

<div align="center">
  <sub>Simple Jiu-Jitsu · <code>SIMPLE2026</code></sub>
</div>
