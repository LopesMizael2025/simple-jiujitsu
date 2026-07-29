-- ============================================================================
-- Simple Jiu-Jitsu · Onboarding por código, Storage e seed da escola
-- ============================================================================

-- ------------------------------------------------- código de convite -------
alter table public.escola
  add column if not exists codigo_convite text unique;

-- Professor entra digitando o código da escola. Sem isso o perfil fica órfão
-- e não enxerga nada (a RLS barra tudo).
create or replace function public.vincular_escola(p_codigo text)
returns table (escola_id uuid, escola_nome text, papel text)
language plpgsql security definer set search_path = public as $$
declare
  v_escola public.escola%rowtype;
  v_primeiro boolean;
begin
  select * into v_escola from public.escola
   where upper(codigo_convite) = upper(trim(p_codigo));

  if not found then
    raise exception 'Código inválido' using errcode = 'P0002';
  end if;

  -- o primeiro a entrar vira dono; os seguintes entram como professor
  select not exists (select 1 from public.perfil p where p.escola_id = v_escola.id)
    into v_primeiro;

  update public.perfil
     set escola_id = v_escola.id,
         papel = case when v_primeiro then 'dono' else coalesce(papel,'professor') end
   where id = auth.uid();

  return query
    select v_escola.id, v_escola.nome,
           (select p.papel from public.perfil p where p.id = auth.uid());
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
