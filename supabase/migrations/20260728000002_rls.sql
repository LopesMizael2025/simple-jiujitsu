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
