-- ============================================================================
-- Simple Jiu-Jitsu · Schema inicial
-- Multi-tenant desde o dia 1 (a Simple é a escola #1; outras academias depois)
-- ============================================================================

create extension if not exists "pgcrypto";
create extension if not exists "vector";

-- ---------------------------------------------------------------- tenant ----
create table public.escola (
  id           uuid primary key default gen_random_uuid(),
  nome         text not null,
  slug         text not null unique,
  timezone     text not null default 'America/Sao_Paulo',
  criado_em    timestamptz not null default now()
);

-- Perfil espelha auth.users. O papel define o que a pessoa pode fazer.
create table public.perfil (
  id           uuid primary key references auth.users(id) on delete cascade,
  escola_id    uuid references public.escola(id) on delete set null,
  nome         text not null default '',
  telefone     text,
  papel        text not null default 'professor'
               check (papel in ('dono','professor','secretaria')),
  ativo        boolean not null default true,
  criado_em    timestamptz not null default now()
);
create index on public.perfil (escola_id);

-- ---------------------------------------------------- modalidade e faixa ----
create table public.modalidade (
  id           uuid primary key default gen_random_uuid(),
  escola_id    uuid not null references public.escola(id) on delete cascade,
  nome         text not null,
  ordem        int  not null default 0
);
create index on public.modalidade (escola_id);

create table public.faixa (
  id             uuid primary key default gen_random_uuid(),
  modalidade_id  uuid not null references public.modalidade(id) on delete cascade,
  nome           text not null,
  cor_hex        text not null default '#e8eef5',
  ordem          int  not null,
  graus_max      int  not null default 4,
  aulas_por_grau int  not null default 40,   -- requisito configurável
  kids           boolean not null default false
);
create index on public.faixa (modalidade_id);

-- ---------------------------------------------------------------- aluno ----
create table public.aluno (
  id                    uuid primary key default gen_random_uuid(),
  escola_id             uuid not null references public.escola(id) on delete cascade,
  nome                  text not null,
  nascimento            date,
  telefone              text,
  email                 text,
  -- responsável (obrigatório na prática para menores; validado na aplicação)
  responsavel_nome      text,
  responsavel_telefone  text,
  responsavel_parentesco text,
  -- graduação
  faixa_id              uuid references public.faixa(id) on delete set null,
  graus                 int not null default 0,
  aulas_no_ciclo        int not null default 0,
  -- operacional
  status                text not null default 'ativo'
                        check (status in ('ativo','trancado','evadido')),
  foto_path             text,                -- caminho no Storage (bucket privado)
  observacoes           text,
  criado_em             timestamptz not null default now(),
  criado_por            uuid references public.perfil(id) on delete set null
);
create index on public.aluno (escola_id, status);
create index on public.aluno (escola_id, nome);

-- É menor de idade? usado pela aplicação para exigir consentimento do responsável
create or replace function public.aluno_e_menor(p_nascimento date)
returns boolean language sql immutable as $$
  select p_nascimento is not null and p_nascimento > (current_date - interval '18 years');
$$;

-- --------------------------------------------------------- consentimento ----
-- Append-only. Nunca dar UPDATE/DELETE: uma revogação é um novo registro.
create table public.consentimento (
  id             uuid primary key default gen_random_uuid(),
  escola_id      uuid not null references public.escola(id) on delete cascade,
  aluno_id       uuid not null references public.aluno(id) on delete cascade,
  tipo           text not null check (tipo in ('biometria','imagem','comunicacao')),
  concedido      boolean not null,
  base_legal     text not null default 'LGPD art. 11, I - consentimento específico e destacado',
  concedido_por  text not null,               -- "o próprio titular" ou "Fulana (mãe)"
  texto_versao   text not null default 'v1',
  registrado_por uuid references public.perfil(id) on delete set null,
  user_agent     text,
  criado_em      timestamptz not null default now()
);
create index on public.consentimento (aluno_id, tipo, criado_em desc);

-- Consentimento vigente = o registro mais recente daquele tipo
create or replace function public.tem_consentimento(p_aluno uuid, p_tipo text)
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce(
    (select concedido from public.consentimento
      where aluno_id = p_aluno and tipo = p_tipo
      order by criado_em desc limit 1),
    false);
$$;

-- ------------------------------------------------------- cofre biométrico ---
-- Guardamos o DESCRITOR (vetor de 128 dimensões), nunca a foto.
-- O vetor não permite reconstruir o rosto.
create table public.face_template (
  id           uuid primary key default gen_random_uuid(),
  escola_id    uuid not null references public.escola(id) on delete cascade,
  aluno_id     uuid not null references public.aluno(id) on delete cascade,
  embedding    vector(128) not null,
  qualidade    real,                          -- score de detecção no cadastro
  modelo       text not null default 'faceapi/face_recognition_model@128',
  criado_em    timestamptz not null default now()
);
create index on public.face_template (escola_id);
create index face_template_embedding_idx on public.face_template
  using hnsw (embedding vector_l2_ops);

-- Revogar consentimento apaga o template na hora.
create or replace function public.trg_revoga_biometria()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.tipo = 'biometria' and new.concedido = false then
    delete from public.face_template where aluno_id = new.aluno_id;
  end if;
  return new;
end $$;

create trigger consentimento_revoga_biometria
  after insert on public.consentimento
  for each row execute function public.trg_revoga_biometria();

-- ------------------------------------------------------- turmas e aulas ----
create table public.turma (
  id            uuid primary key default gen_random_uuid(),
  escola_id     uuid not null references public.escola(id) on delete cascade,
  modalidade_id uuid references public.modalidade(id) on delete set null,
  nome          text not null,
  faixa_etaria  text not null default 'adulto' check (faixa_etaria in ('kids','teen','adulto','misto')),
  nivel         text,
  ativo         boolean not null default true,
  criado_em     timestamptz not null default now()
);
create index on public.turma (escola_id, ativo);

create table public.turma_horario (
  id           uuid primary key default gen_random_uuid(),
  turma_id     uuid not null references public.turma(id) on delete cascade,
  dia_semana   int  not null check (dia_semana between 0 and 6),  -- 0 = domingo
  hora_inicio  time not null,
  hora_fim     time not null,
  instrutor_id uuid references public.perfil(id) on delete set null
);
create index on public.turma_horario (turma_id);

create table public.matricula (
  id         uuid primary key default gen_random_uuid(),
  turma_id   uuid not null references public.turma(id) on delete cascade,
  aluno_id   uuid not null references public.aluno(id) on delete cascade,
  ativo      boolean not null default true,
  criado_em  timestamptz not null default now(),
  unique (turma_id, aluno_id)
);
create index on public.matricula (aluno_id);

create table public.aula (
  id           uuid primary key default gen_random_uuid(),
  escola_id    uuid not null references public.escola(id) on delete cascade,
  turma_id     uuid not null references public.turma(id) on delete cascade,
  data         date not null default current_date,
  instrutor_id uuid references public.perfil(id) on delete set null,
  tecnicas     text,
  observacoes  text,
  status       text not null default 'aberta' check (status in ('aberta','fechada')),
  usou_foto    boolean not null default false,
  faces_detectadas int,
  criado_em    timestamptz not null default now(),
  unique (turma_id, data)
);
create index on public.aula (escola_id, data desc);

-- A presença guarda de onde veio e com que confiança. É isso que torna o dado
-- auditável o suficiente para embasar uma graduação.
create table public.presenca (
  id            uuid primary key default gen_random_uuid(),
  escola_id     uuid not null references public.escola(id) on delete cascade,
  aula_id       uuid not null references public.aula(id) on delete cascade,
  aluno_id      uuid not null references public.aluno(id) on delete cascade,
  origem        text not null default 'manual'
                check (origem in ('facial','facial_confirmado','manual','corrigido')),
  distancia     real,                       -- distância L2 do match (menor = melhor)
  confirmado_por uuid references public.perfil(id) on delete set null,
  criado_em     timestamptz not null default now(),
  unique (aula_id, aluno_id)
);
create index on public.presenca (aluno_id, criado_em desc);
create index on public.presenca (escola_id, criado_em desc);

-- Cada presença gravada avança o contador de graduação do aluno.
create or replace function public.trg_presenca_conta_aula()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if (tg_op = 'INSERT') then
    update public.aluno set aulas_no_ciclo = aulas_no_ciclo + 1 where id = new.aluno_id;
  elsif (tg_op = 'DELETE') then
    update public.aluno set aulas_no_ciclo = greatest(0, aulas_no_ciclo - 1) where id = old.aluno_id;
  end if;
  return null;
end $$;

create trigger presenca_conta_aula
  after insert or delete on public.presenca
  for each row execute function public.trg_presenca_conta_aula();

-- ---------------------------------------------------------- graduação -------
create table public.graduacao (
  id             uuid primary key default gen_random_uuid(),
  escola_id      uuid not null references public.escola(id) on delete cascade,
  aluno_id       uuid not null references public.aluno(id) on delete cascade,
  faixa_id       uuid not null references public.faixa(id),
  graus          int not null default 0,
  data           date not null default current_date,
  instrutor_id   uuid references public.perfil(id) on delete set null,
  aulas_no_ciclo int,
  criado_em      timestamptz not null default now()
);
create index on public.graduacao (aluno_id, data desc);
