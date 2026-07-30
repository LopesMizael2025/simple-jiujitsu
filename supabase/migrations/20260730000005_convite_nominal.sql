-- ============================================================================
-- Simple Jiu-Jitsu · Convite nominal, de uso unico, amarrado ao e-mail
-- ============================================================================
-- O QUE MUDA E POR QUE
--
-- Antes: uma senha unica por escola (SIMPLE2026). Quem acertasse o codigo
-- entrava sozinho e passava a ler tudo -- inclusive biometria e dados de
-- menores. E quem redimisse primeiro numa escola vazia virava DONO dela.
-- O codigo nao expirava e nao morria quando um professor saia.
--
-- Agora: o dono convida pelo e-mail. O sistema gera um token aleatorio de 48
-- caracteres, valido por 7 dias, de uso unico, e que so funciona para AQUELE
-- e-mail. Se o link vazar num grupo de WhatsApp, nao serve para mais ninguem.
-- ============================================================================

create extension if not exists pgcrypto with schema extensions;

create table if not exists public.convite (
  id          uuid primary key default gen_random_uuid(),
  escola_id   uuid not null references public.escola(id) on delete cascade,
  email       text not null,
  papel       text not null default 'professor' check (papel in ('dono','professor')),
  token       text not null unique,
  criado_por  uuid references public.perfil(id) on delete set null,
  criado_em   timestamptz not null default now(),
  expira_em   timestamptz not null default now() + interval '7 days',
  usado_em    timestamptz,
  usado_por   uuid references public.perfil(id) on delete set null,
  revogado_em timestamptz
);

create index if not exists convite_escola_idx on public.convite (escola_id, criado_em desc);
create index if not exists convite_email_idx  on public.convite (lower(email));

comment on table public.convite is
  'Convite nominal de uso unico. O token so vale para o e-mail da linha.';

alter table public.convite enable row level security;

-- Quem e da escola ve os convites da escola (o dono precisa acompanhar,
-- o professor precisa saber quem mais foi chamado).
drop policy if exists "escola le convite" on public.convite;
create policy "escola le convite" on public.convite for select
  using (escola_id = public.minha_escola());

-- Criar e revogar e so do dono.
drop policy if exists "dono cria convite" on public.convite;
create policy "dono cria convite" on public.convite for insert
  with check (escola_id = public.minha_escola() and public.meu_papel() = 'dono');

drop policy if exists "dono revoga convite" on public.convite;
create policy "dono revoga convite" on public.convite for update
  using (escola_id = public.minha_escola() and public.meu_papel() = 'dono')
  with check (escola_id = public.minha_escola());

-- Ninguem apaga convite: o historico de quem foi convidado, por quem e quando
-- e justamente o que responde a uma pergunta da ANPD depois de um incidente.

-- --------------------------------------------------------- criar convite ---
create or replace function public.criar_convite(
  p_email text,
  p_papel text default 'professor'
)
returns table (out_token text, out_expira timestamptz, out_email text)
language plpgsql security invoker set search_path = public, extensions as $$
declare
  v_escola uuid := public.minha_escola();
  v_email  text := lower(btrim(p_email));
  v_token  text := encode(gen_random_bytes(24), 'hex');
  v_expira timestamptz := now() + interval '7 days';
begin
  if v_escola is null then
    raise exception 'Voce nao esta vinculado a nenhuma escola' using errcode = '42501';
  end if;

  if v_email !~ '^[^@[:space:]]+@[^@[:space:]]+[.][^@[:space:]]+$' then
    raise exception 'E-mail invalido' using errcode = '22023';
  end if;

  if p_papel not in ('dono', 'professor') then
    raise exception 'Papel invalido' using errcode = '22023';
  end if;

  -- Convidar de novo cancela o convite anterior em aberto. Evita varios
  -- tokens vivos para a mesma pessoa -- cada um deles e uma porta.
  update public.convite
     set revogado_em = now()
   where escola_id = v_escola
     and lower(email) = v_email
     and usado_em is null
     and revogado_em is null;

  -- O insert passa pela policy: so o dono chega aqui.
  insert into public.convite (escola_id, email, papel, token, criado_por, expira_em)
  values (v_escola, v_email, p_papel, v_token, auth.uid(), v_expira);

  return query select v_token, v_expira, v_email;
end $$;

-- ------------------------------------------------------- aceitar convite ---
-- security definer porque quem aceita ainda NAO tem escola: a RLS de convite
-- esconderia a linha dele. A checagem de e-mail abaixo e o que segura a porta.
create or replace function public.aceitar_convite(p_token text)
returns table (out_escola_id uuid, out_escola_nome text, out_papel text)
language plpgsql security definer set search_path = public as $$
declare
  v_c     public.convite%rowtype;
  v_email text := lower(coalesce(auth.jwt() ->> 'email', ''));
  v_nome  text;
begin
  if auth.uid() is null then
    raise exception 'Faca login primeiro' using errcode = '28000';
  end if;

  -- for update: dois cliques simultaneos no mesmo link nao viram dois usos
  select * into v_c from public.convite
   where token = btrim(p_token)
   for update;

  if not found then
    raise exception 'Convite nao encontrado' using errcode = 'P0002';
  end if;
  if v_c.revogado_em is not null then
    raise exception 'Convite cancelado pela escola' using errcode = 'P0002';
  end if;
  if v_c.usado_em is not null then
    raise exception 'Convite ja usado' using errcode = 'P0002';
  end if;
  if v_c.expira_em < now() then
    raise exception 'Convite expirado' using errcode = 'P0002';
  end if;

  -- A trava de verdade: o token so vale para o e-mail convidado.
  if v_email = '' or v_email <> lower(v_c.email) then
    raise exception 'Este convite foi feito para outro e-mail' using errcode = '42501';
  end if;

  insert into public.perfil (id, nome) values (auth.uid(), '')
    on conflict (id) do nothing;

  update public.perfil p
     set escola_id = v_c.escola_id,
         papel     = v_c.papel
   where p.id = auth.uid();

  update public.convite
     set usado_em = now(), usado_por = auth.uid()
   where id = v_c.id;

  select e.nome into v_nome from public.escola e where e.id = v_c.escola_id;
  return query select v_c.escola_id, v_nome, v_c.papel;
end $$;

grant execute on function public.criar_convite(text, text) to authenticated;
grant execute on function public.aceitar_convite(text)     to authenticated;

-- ------------------------------------------- desliga a senha compartilhada --
drop function if exists public.vincular_escola(text);
update public.escola set codigo_convite = null where codigo_convite is not null;

comment on column public.escola.codigo_convite is
  'Aposentado em 30/07/2026. Entrada agora e so por convite nominal (tabela convite).';

-- ============================================================================
-- COMO ABRIR UMA ESCOLA NOVA (a primeira pessoa nao tem quem a convide)
--
-- Rode isto aqui no editor SQL, como postgres, e entregue o link ao dono:
--
--   insert into public.convite (escola_id, email, papel, token, expira_em)
--   select e.id, 'dono@academia.com.br', 'dono',
--          encode(extensions.gen_random_bytes(24), 'hex'),
--          now() + interval '14 days'
--     from public.escola e where e.slug = 'slug-da-academia'
--   returning 'https://simple-jiujitsu.vercel.app/vincular?c=' || token as link;
--
-- Nunca crie um convite de papel 'dono' pelo app: por design, so quem tem
-- acesso ao banco pode nomear o dono de uma escola.
-- ============================================================================
