-- ============================================================
-- Simple Jiu-Jitsu - schema completo (as 3 migrations juntas)
-- Cole tudo no SQL Editor do Supabase e rode UMA vez.
-- ============================================================


-- >>>>>>>>>> 20260728000001_init.sql <<<<<<<<<<

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

-- >>>>>>>>>> 20260728000002_rls.sql <<<<<<<<<<

-- ============================================================================
-- Simple Jiu-Jitsu · RLS + funções de busca facial
-- Regra de ouro: ninguém enxerga dado de outra escola. Nunca.
-- ============================================================================

-- Escola do usuário logado. STABLE + security definer para não recursionar na RLS.
create or replace function public.minha_escola()
returns uuid language sql stable security definer set search_path = public as $$
  select escola_id from public.perfil where id = auth.uid();
$$;

create or replace function public.meu_papel()
returns text language sql stable security definer set search_path = public as $$
  select papel from public.perfil where id = auth.uid();
$$;

-- Cria o perfil automaticamente quando alguém se cadastra.
-- A escola fica NULL até o dono vincular a pessoa (evita cadastro selvagem).
create or replace function public.trg_novo_usuario()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.perfil (id, nome, telefone)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'nome', ''),
    coalesce(new.phone, new.raw_user_meta_data->>'telefone')
  )
  on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.trg_novo_usuario();

-- ------------------------------------------------------------- habilitar ----
alter table public.escola         enable row level security;
alter table public.perfil         enable row level security;
alter table public.modalidade     enable row level security;
alter table public.faixa          enable row level security;
alter table public.aluno          enable row level security;
alter table public.consentimento  enable row level security;
alter table public.face_template  enable row level security;
alter table public.turma          enable row level security;
alter table public.turma_horario  enable row level security;
alter table public.matricula      enable row level security;
alter table public.aula           enable row level security;
alter table public.presenca       enable row level security;
alter table public.graduacao      enable row level security;

-- ---------------------------------------------------------------- escola ----
create policy "vê a própria escola" on public.escola
  for select using (id = public.minha_escola());
create policy "dono edita a escola" on public.escola
  for update using (id = public.minha_escola() and public.meu_papel() = 'dono');

-- ---------------------------------------------------------------- perfil ----
create policy "vê colegas da escola" on public.perfil
  for select using (id = auth.uid() or escola_id = public.minha_escola());
create policy "edita o próprio perfil" on public.perfil
  for update using (id = auth.uid());
create policy "dono gerencia a equipe" on public.perfil
  for all using (escola_id = public.minha_escola() and public.meu_papel() = 'dono')
  with check (escola_id = public.minha_escola());

-- ------------------------------------------- tabelas escopadas por escola ---
-- Mesma política para todas: só quem é da escola, e só dentro da escola.
do $$
declare t text;
begin
  foreach t in array array[
    'modalidade','aluno','consentimento','face_template',
    'turma','aula','presenca','graduacao'
  ] loop
    execute format($f$
      create policy "escola lê %1$s"    on public.%1$I for select
        using (escola_id = public.minha_escola());
      create policy "escola cria %1$s"  on public.%1$I for insert
        with check (escola_id = public.minha_escola());
      create policy "escola edita %1$s" on public.%1$I for update
        using (escola_id = public.minha_escola())
        with check (escola_id = public.minha_escola());
      create policy "escola apaga %1$s" on public.%1$I for delete
        using (escola_id = public.minha_escola());
    $f$, t);
  end loop;
end $$;

-- consentimento é append-only: revoga inserindo, nunca editando
drop policy "escola edita consentimento" on public.consentimento;
drop policy "escola apaga consentimento" on public.consentimento;

-- ----------------------------------------- tabelas filhas (sem escola_id) ---
create policy "faixa segue a modalidade" on public.faixa for all
  using (exists (select 1 from public.modalidade m
                 where m.id = modalidade_id and m.escola_id = public.minha_escola()))
  with check (exists (select 1 from public.modalidade m
                 where m.id = modalidade_id and m.escola_id = public.minha_escola()));

create policy "horário segue a turma" on public.turma_horario for all
  using (exists (select 1 from public.turma t
                 where t.id = turma_id and t.escola_id = public.minha_escola()))
  with check (exists (select 1 from public.turma t
                 where t.id = turma_id and t.escola_id = public.minha_escola()));

create policy "matrícula segue a turma" on public.matricula for all
  using (exists (select 1 from public.turma t
                 where t.id = turma_id and t.escola_id = public.minha_escola()))
  with check (exists (select 1 from public.turma t
                 where t.id = turma_id and t.escola_id = public.minha_escola()));

-- ============================================================================
-- BUSCA FACIAL
-- ============================================================================

-- Recebe UM descritor e devolve o aluno mais parecido dentro da escola.
-- face-api usa distância euclidiana; o limiar clássico é 0.6.
-- Abaixo de 0.45  -> match automático (verde)
-- 0.45 a 0.60     -> sugestão para o professor confirmar (amarelo)
-- Acima de 0.60   -> desconhecido (cinza)
create or replace function public.buscar_rosto(
  p_embedding vector(128),
  p_dist_max  real default 0.60
)
returns table (
  aluno_id  uuid,
  nome      text,
  faixa     text,
  cor_hex   text,
  graus     int,
  distancia real
)
language sql stable security invoker set search_path = public as $$
  select distinct on (a.id)
    a.id,
    a.nome,
    coalesce(f.nome, '—'),
    coalesce(f.cor_hex, '#e8eef5'),
    a.graus,
    (ft.embedding <-> p_embedding)::real
  from public.face_template ft
  join public.aluno a on a.id = ft.aluno_id and a.status = 'ativo'
  left join public.faixa f on f.id = a.faixa_id
  where ft.escola_id = public.minha_escola()
    and (ft.embedding <-> p_embedding) <= p_dist_max
  order by a.id, (ft.embedding <-> p_embedding)
$$;

-- Versão em lote: recebe todos os rostos da foto de uma vez.
-- Evita N chamadas de rede quando a turma tem 25 alunos.
create or replace function public.buscar_rostos(
  p_embeddings jsonb,                 -- [[128 floats], [128 floats], ...]
  p_dist_max   real default 0.60
)
returns table (
  face_idx  int,
  aluno_id  uuid,
  nome      text,
  faixa     text,
  cor_hex   text,
  graus     int,
  distancia real
)
language plpgsql stable security invoker set search_path = public as $$
declare
  i int;
  v vector(128);
begin
  for i in 0 .. jsonb_array_length(p_embeddings) - 1 loop
    v := (p_embeddings -> i)::text::vector(128);
    return query
      select i, b.aluno_id, b.nome, b.faixa, b.cor_hex, b.graus, b.distancia
      from public.buscar_rosto(v, p_dist_max) b
      order by b.distancia
      limit 1;
  end loop;
end $$;

-- Grava a chamada inteira numa transação só.
-- p_presencas: [{"aluno_id":"...","origem":"facial","distancia":0.31}, ...]
create or replace function public.registrar_chamada(
  p_turma_id  uuid,
  p_data      date,
  p_presencas jsonb,
  p_tecnicas  text default null,
  p_usou_foto boolean default true,
  p_faces     int default null
)
returns uuid
language plpgsql security invoker set search_path = public as $$
declare
  v_escola uuid := public.minha_escola();
  v_aula   uuid;
  item     jsonb;
begin
  if v_escola is null then
    raise exception 'Usuário sem escola vinculada';
  end if;

  insert into public.aula (escola_id, turma_id, data, instrutor_id, tecnicas, usou_foto, faces_detectadas, status)
  values (v_escola, p_turma_id, p_data, auth.uid(), p_tecnicas, p_usou_foto, p_faces, 'fechada')
  on conflict (turma_id, data) do update
    set tecnicas = coalesce(excluded.tecnicas, public.aula.tecnicas),
        usou_foto = excluded.usou_foto,
        faces_detectadas = excluded.faces_detectadas,
        status = 'fechada'
  returning id into v_aula;

  -- regrava a chamada do zero (professor pode corrigir e reenviar)
  delete from public.presenca where aula_id = v_aula;

  for item in select * from jsonb_array_elements(p_presencas) loop
    insert into public.presenca (escola_id, aula_id, aluno_id, origem, distancia, confirmado_por)
    values (
      v_escola,
      v_aula,
      (item->>'aluno_id')::uuid,
      coalesce(item->>'origem', 'manual'),
      nullif(item->>'distancia','')::real,
      auth.uid()
    )
    on conflict (aula_id, aluno_id) do nothing;
  end loop;

  return v_aula;
end $$;

-- ============================================================================
-- VIEWS DE APOIO
-- ============================================================================

-- Frequência dos últimos 30 dias + dias desde o último treino
create or replace view public.v_aluno_frequencia
with (security_invoker = true) as
select
  a.id                                as aluno_id,
  a.escola_id,
  a.nome,
  a.status,
  f.nome                              as faixa,
  f.cor_hex,
  a.graus,
  a.aulas_no_ciclo,
  f.aulas_por_grau,
  count(p.id) filter (where p.criado_em > now() - interval '30 days') as aulas_30d,
  max(p.criado_em)                    as ultimo_treino,
  extract(day from now() - max(p.criado_em))::int as dias_sem_treinar
from public.aluno a
left join public.faixa f on f.id = a.faixa_id
left join public.presenca p on p.aluno_id = a.id
group by a.id, f.nome, f.cor_hex, f.aulas_por_grau;

-- Alunos em risco: sumidos há mais de 14 dias
create or replace view public.v_risco_evasao
with (security_invoker = true) as
select * from public.v_aluno_frequencia
where status = 'ativo'
  and (ultimo_treino is null or dias_sem_treinar >= 14)
order by dias_sem_treinar desc nulls last;

-- Elegíveis para grau/faixa
create or replace view public.v_elegivel_graduacao
with (security_invoker = true) as
select *,
  case when aulas_por_grau > 0
       then least(100, round(aulas_no_ciclo::numeric / aulas_por_grau * 100))
       else 0 end as progresso_pct
from public.v_aluno_frequencia
where status = 'ativo' and aulas_por_grau > 0
order by (aulas_no_ciclo::numeric / nullif(aulas_por_grau,0)) desc;

-- >>>>>>>>>> 20260728000003_onboarding_storage_seed.sql <<<<<<<<<<

-- ============================================================================
-- Simple Jiu-Jitsu · Onboarding por código, Storage e seed da escola
-- ============================================================================

-- ------------------------------------------------- código de convite -------
alter table public.escola
  add column if not exists codigo_convite text unique;

-- Os nomes das colunas de retorno NAO podem repetir nomes de colunas das tabelas
-- usadas no corpo: o PostgreSQL nao sabe a qual delas voce se refere e aborta com
-- 42702 (column reference is ambiguous). Por isso o prefixo out_.
drop function if exists public.vincular_escola(text);

create function public.vincular_escola(p_codigo text)
returns table (out_escola_id uuid, out_escola_nome text, out_papel text)
language plpgsql security definer set search_path = public as $$
declare
  v_escola   public.escola%rowtype;
  v_primeiro boolean;
  v_papel    text;
begin
  select * into v_escola from public.escola
   where upper(codigo_convite) = upper(trim(p_codigo));

  if not found then
    raise exception 'Codigo invalido' using errcode = 'P0002';
  end if;

  -- rede de seguranca: se o gatilho de novo usuario nao rodou, cria o perfil aqui
  insert into public.perfil (id, nome) values (auth.uid(), '')
    on conflict (id) do nothing;

  -- o primeiro a entrar vira dono; os seguintes entram como professor
  select not exists (select 1 from public.perfil p where p.escola_id = v_escola.id)
    into v_primeiro;

  update public.perfil p
     set escola_id = v_escola.id,
         papel = case when v_primeiro then 'dono' else coalesce(p.papel, 'professor') end
   where p.id = auth.uid()
  returning p.papel into v_papel;

  if v_papel is null then
    raise exception 'Perfil nao encontrado' using errcode = 'P0002';
  end if;

  return query select v_escola.id, v_escola.nome, v_papel;
end $$;


grant execute on function public.vincular_escola(text) to authenticated;

-- ------------------------------------------------------------- storage -----
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('alunos', 'alunos', false, 5242880, array['image/jpeg','image/png','image/webp'])
on conflict (id) do nothing;

-- Caminho dos arquivos: {escola_id}/{aluno_id}.jpg
-- Só quem é da escola acessa a pasta da escola.
create policy "escola lê fotos de alunos" on storage.objects for select
  to authenticated
  using (bucket_id = 'alunos'
         and (storage.foldername(name))[1] = public.minha_escola()::text);

create policy "escola envia fotos de alunos" on storage.objects for insert
  to authenticated
  with check (bucket_id = 'alunos'
              and (storage.foldername(name))[1] = public.minha_escola()::text);

create policy "escola atualiza fotos de alunos" on storage.objects for update
  to authenticated
  using (bucket_id = 'alunos'
         and (storage.foldername(name))[1] = public.minha_escola()::text);

create policy "escola apaga fotos de alunos" on storage.objects for delete
  to authenticated
  using (bucket_id = 'alunos'
         and (storage.foldername(name))[1] = public.minha_escola()::text);

-- ============================================================================
-- SEED · Escola Simple
-- Troque o código de convite antes de colocar em produção.
-- ============================================================================
do $$
declare
  v_escola uuid;
  v_jj     uuid;
  v_mt     uuid;
begin
  insert into public.escola (nome, slug, codigo_convite)
  values ('Simple Jiu-Jitsu', 'simple', 'SIMPLE2026')
  on conflict (slug) do update set nome = excluded.nome
  returning id into v_escola;

  -- ---------------------------------------------------------- modalidades --
  insert into public.modalidade (escola_id, nome, ordem)
  values (v_escola, 'Jiu-Jitsu', 1) returning id into v_jj;

  insert into public.modalidade (escola_id, nome, ordem)
  values (v_escola, 'Muay Thai', 2) returning id into v_mt;

  -- --------------------------------------------------- faixas · adulto ----
  insert into public.faixa (modalidade_id, nome, cor_hex, ordem, graus_max, aulas_por_grau, kids) values
    (v_jj, 'Branca',  '#F2F4F7', 1, 4, 40,  false),
    (v_jj, 'Azul',    '#2D7FF9', 2, 4, 60,  false),
    (v_jj, 'Roxa',    '#8B5CF6', 3, 4, 80,  false),
    (v_jj, 'Marrom',  '#92603C', 4, 4, 100, false),
    (v_jj, 'Preta',   '#1A1A1A', 5, 6, 150, false);

  -- ------------------------------------------------------ faixas · kids ----
  insert into public.faixa (modalidade_id, nome, cor_hex, ordem, graus_max, aulas_por_grau, kids) values
    (v_jj, 'Cinza-Branca',   '#C7CDD4', 11, 4, 24, true),
    (v_jj, 'Cinza',          '#9AA5B1', 12, 4, 24, true),
    (v_jj, 'Cinza-Preta',    '#6B7480', 13, 4, 24, true),
    (v_jj, 'Amarela-Branca', '#FFE066', 14, 4, 28, true),
    (v_jj, 'Amarela',        '#FFD43B', 15, 4, 28, true),
    (v_jj, 'Amarela-Preta',  '#E0B10A', 16, 4, 28, true),
    (v_jj, 'Laranja-Branca', '#FFC078', 17, 4, 32, true),
    (v_jj, 'Laranja',        '#FF922B', 18, 4, 32, true),
    (v_jj, 'Laranja-Preta',  '#D9730D', 19, 4, 32, true),
    (v_jj, 'Verde-Branca',   '#8CE99A', 20, 4, 36, true),
    (v_jj, 'Verde',          '#40C057', 21, 4, 36, true),
    (v_jj, 'Verde-Preta',    '#2B8A3E', 22, 4, 36, true);

  -- ----------------------------------------------------- Muay Thai (prajioud)
  insert into public.faixa (modalidade_id, nome, cor_hex, ordem, graus_max, aulas_por_grau, kids) values
    (v_mt, 'Branco',   '#F2F4F7', 1, 0, 30, false),
    (v_mt, 'Vermelho', '#ED1F25', 2, 0, 40, false),
    (v_mt, 'Azul',     '#2D7FF9', 3, 0, 50, false),
    (v_mt, 'Preto',    '#1A1A1A', 4, 0, 60, false);

  -- ------------------------------------------------------------- turmas ----
  insert into public.turma (escola_id, modalidade_id, nome, faixa_etaria, nivel) values
    (v_escola, v_jj, 'Jiu-Jitsu Adulto · Fundamentos', 'adulto', 'Iniciante'),
    (v_escola, v_jj, 'Jiu-Jitsu Adulto · Avançado',    'adulto', 'Avançado'),
    (v_escola, v_jj, 'Jiu-Jitsu Kids 6-9',             'kids',   'Iniciante'),
    (v_escola, v_jj, 'Jiu-Jitsu Kids 10-13',           'kids',   'Intermediário'),
    (v_escola, v_mt, 'Muay Thai',                      'adulto', null);
end $$;

-- Horários de exemplo (seg/qua/sex) para as turmas criadas acima
insert into public.turma_horario (turma_id, dia_semana, hora_inicio, hora_fim)
select t.id, d.dia, h.ini, h.fim
from public.turma t
cross join lateral (values (1),(3),(5)) as d(dia)
cross join lateral (
  select case
    when t.nome like '%Fundamentos%'  then time '06:30'
    when t.nome like '%Kids 6-9%'     then time '16:00'
    when t.nome like '%Kids 10-13%'   then time '17:30'
    when t.nome like '%Avançado%'     then time '20:00'
    else time '21:30' end as ini,
  case
    when t.nome like '%Fundamentos%'  then time '07:45'
    when t.nome like '%Kids 6-9%'     then time '17:00'
    when t.nome like '%Kids 10-13%'   then time '18:30'
    when t.nome like '%Avançado%'     then time '21:30'
    else time '22:30' end as fim
) h
where t.escola_id = (select id from public.escola where slug = 'simple');
