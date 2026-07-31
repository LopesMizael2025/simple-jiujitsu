-- ============================================================================
-- Simple · Cadastro aberto: a academia se inscreve sozinha
-- ============================================================================
-- Duas portas, de proposito diferentes:
--
--   PORTA DA FRENTE (esta migration) - qualquer pessoa cria uma conta e uma
--   academia NOVA e VAZIA. Risco zero: nao existe dado de ninguem la dentro.
--
--   PORTA DE DENTRO (convite nominal, migration anterior) - entrar numa escola
--   que JA EXISTE. Continua so por convite: quem entra passa a ver alunos,
--   telefones de menores e biometria.
--
-- Confundir as duas e o erro classico. Slack, Notion e Linear fazem assim.
-- ============================================================================

-- Campos de cadastro da escola. Plano fica registrado desde ja para nao
-- precisar de migration dolorosa quando a cobranca entrar.
alter table public.escola
  add column if not exists cidade      text,
  add column if not exists uf          text,
  add column if not exists plano       text not null default 'livre',
  add column if not exists criada_por  uuid references public.perfil(id) on delete set null;

comment on column public.escola.plano is
  'livre = tudo liberado. Campo existe desde o inicio para ligar cobranca depois.';

-- ------------------------------------------------------------------ slug ----
-- 'Academia Gracie Barra' -> 'academia-gracie-barra'. Se ja existir, vira
-- 'academia-gracie-barra-2', e assim por diante.
create or replace function public.slug_livre(p_nome text)
returns text language plpgsql stable set search_path = public, extensions as $$
declare
  v_base text;
  v_tenta text;
  i int := 1;
begin
  v_base := lower(unaccent(btrim(p_nome)));
  v_base := regexp_replace(v_base, '[^a-z0-9]+', '-', 'g');
  v_base := btrim(v_base, '-');
  v_base := left(nullif(v_base, ''), 40);
  if v_base is null then v_base := 'academia'; end if;

  v_tenta := v_base;
  while exists (select 1 from public.escola e where e.slug = v_tenta) loop
    i := i + 1;
    v_tenta := v_base || '-' || i;
  end loop;
  return v_tenta;
end $$;

-- ---------------------------------------------------------- criar escola ----
-- security definer porque nao ha (e nao deve haver) policy de INSERT em
-- escola: criar escola nao e uma operacao de linha, e o nascimento de um
-- inquilino novo. A trava e a checagem de que quem chama ainda nao tem escola.
create or replace function public.criar_escola(
  p_nome   text,
  p_cidade text default null,
  p_uf     text default null
)
returns table (out_escola_id uuid, out_escola_nome text, out_slug text)
language plpgsql security definer set search_path = public, extensions as $$
declare
  v_uid    uuid := auth.uid();
  v_nome   text := btrim(p_nome);
  v_escola uuid;
  v_slug   text;
  v_jj     uuid;
  v_mt     uuid;
  v_atual  uuid;
begin
  if v_uid is null then
    raise exception 'Faca login primeiro' using errcode = '28000';
  end if;

  if length(v_nome) < 2 then
    raise exception 'Diga o nome da academia' using errcode = '22023';
  end if;

  insert into public.perfil (id, nome) values (v_uid, '')
    on conflict (id) do nothing;

  -- Uma pessoa, uma escola. Sem isso, alguem cria mil escolas vazias.
  select escola_id into v_atual from public.perfil where id = v_uid;
  if v_atual is not null then
    raise exception 'Voce ja faz parte de uma escola' using errcode = '42501';
  end if;

  v_slug := public.slug_livre(v_nome);

  insert into public.escola (nome, slug, cidade, uf, plano, criada_por)
  values (v_nome, v_slug, nullif(btrim(coalesce(p_cidade,'')),''),
          nullif(upper(btrim(coalesce(p_uf,''))),''), 'livre', v_uid)
  returning id into v_escola;

  update public.perfil set escola_id = v_escola, papel = 'dono' where id = v_uid;

  -- ------------------------------------------------- graduacoes prontas ----
  -- A academia entra e ja consegue cadastrar aluno. Pedir para o dono digitar
  -- 21 faixas antes de ver qualquer valor seria perde-lo na primeira tela.
  insert into public.modalidade (escola_id, nome, ordem)
  values (v_escola, 'Jiu-Jitsu', 1) returning id into v_jj;

  insert into public.modalidade (escola_id, nome, ordem)
  values (v_escola, 'Muay Thai', 2) returning id into v_mt;

  insert into public.faixa (modalidade_id, nome, cor_hex, ordem, graus_max, aulas_por_grau, kids) values
    (v_jj, 'Branca',  '#F2F4F7', 1, 4, 40,  false),
    (v_jj, 'Azul',    '#2D7FF9', 2, 4, 60,  false),
    (v_jj, 'Roxa',    '#8B5CF6', 3, 4, 80,  false),
    (v_jj, 'Marrom',  '#92603C', 4, 4, 100, false),
    (v_jj, 'Preta',   '#1A1A1A', 5, 6, 150, false);

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

  insert into public.faixa (modalidade_id, nome, cor_hex, ordem, graus_max, aulas_por_grau, kids) values
    (v_mt, 'Branco',   '#F2F4F7', 1, 0, 30, false),
    (v_mt, 'Vermelho', '#ED1F25', 2, 0, 40, false),
    (v_mt, 'Azul',     '#2D7FF9', 3, 0, 50, false),
    (v_mt, 'Preto',    '#1A1A1A', 4, 0, 60, false);

  -- Sem turmas: os horarios sao de cada academia. Turma inventada e turma
  -- que o dono precisa apagar antes de comecar.

  return query select v_escola, v_nome, v_slug;
end $$;

grant execute on function public.criar_escola(text, text, text) to authenticated;
grant execute on function public.slug_livre(text) to authenticated;

-- ---------------------------------------- nome do perfil no cadastro --------
-- O gatilho de novo usuario ja copia 'nome' do metadata. Reforcado aqui para
-- aceitar tambem o formato que a tela de cadastro envia.
create or replace function public.trg_novo_usuario()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.perfil (id, nome, telefone)
  values (
    new.id,
    btrim(coalesce(new.raw_user_meta_data->>'nome',
                   new.raw_user_meta_data->>'full_name', '')),
    coalesce(new.phone, new.raw_user_meta_data->>'telefone')
  )
  on conflict (id) do nothing;
  return new;
end $$;
