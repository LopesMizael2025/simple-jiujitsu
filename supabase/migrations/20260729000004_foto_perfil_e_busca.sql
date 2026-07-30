-- ============================================================================
-- Simple Jiu-Jitsu · Foto de perfil, busca e importacao em lote
-- ============================================================================

-- ---------------------------------------------------------- foto de perfil --
-- IMPORTANTE, e diferente da biometria:
--   face_template.embedding = vetor de 128 numeros, serve para RECONHECER.
--                             Nao permite reconstruir o rosto.
--   aluno.foto_thumb        = miniatura real do rosto, serve para o PROFESSOR
--                             reconhecer o aluno na lista. E uma imagem.
-- Por isso a foto so pode ser gravada com consentimento de USO DE IMAGEM.
-- Revogar esse consentimento apaga a miniatura (gatilho abaixo).
alter table public.aluno
  add column if not exists foto_thumb text;

comment on column public.aluno.foto_thumb is
  'Miniatura do rosto em data URL. So preencher com consentimento tipo=imagem.';

-- Revogou uso de imagem? A miniatura some junto.
create or replace function public.trg_revoga_imagem()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.tipo = 'imagem' and new.concedido = false then
    update public.aluno set foto_thumb = null where id = new.aluno_id;
  end if;
  return new;
end $$;

drop trigger if exists consentimento_revoga_imagem on public.consentimento;
create trigger consentimento_revoga_imagem
  after insert on public.consentimento
  for each row execute function public.trg_revoga_imagem();

-- ------------------------------------------------------------------ busca ---
-- unaccent() e STABLE, nao IMMUTABLE: nao pode entrar em indice. Sem indice
-- mesmo. A busca da tela roda no proprio navegador sobre a lista ja carregada,
-- e uma escola tem centenas de alunos, nao milhoes. Aqui unaccent serve so
-- para casar nomes na importacao ("Joao" = "Joao").
create schema if not exists extensions;
create extension if not exists unaccent with schema extensions;

-- ------------------------------------------------------ view com a foto -----
-- Recria a view de frequencia incluindo foto e telefones, que as telas usam.
drop view if exists public.v_elegivel_graduacao;
drop view if exists public.v_risco_evasao;
drop view if exists public.v_aluno_frequencia;

create view public.v_aluno_frequencia
with (security_invoker = true) as
select
  a.id                                as aluno_id,
  a.escola_id,
  a.nome,
  a.status,
  a.foto_thumb,
  a.telefone,
  a.responsavel_nome,
  a.responsavel_telefone,
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

create view public.v_risco_evasao
with (security_invoker = true) as
select * from public.v_aluno_frequencia
where status = 'ativo'
  and (ultimo_treino is null or dias_sem_treinar >= 14)
order by dias_sem_treinar desc nulls last;

create view public.v_elegivel_graduacao
with (security_invoker = true) as
select *,
  case when aulas_por_grau > 0
       then least(100, round(aulas_no_ciclo::numeric / aulas_por_grau * 100))
       else 0 end as progresso_pct
from public.v_aluno_frequencia
where status = 'ativo' and aulas_por_grau > 0
order by (aulas_no_ciclo::numeric / nullif(aulas_por_grau,0)) desc;

-- ============================================================================
-- IMPORTACAO EM LOTE
-- Cria varios alunos de uma vez a partir das respostas do formulario.
-- Recebe um jsonb com a lista e devolve o resumo do que aconteceu.
--
-- Cada item aceita:
--   nome, nascimento, telefone, email, responsavel_nome, responsavel_telefone,
--   responsavel_parentesco, faixa_nome, graus, observacoes,
--   turmas (array de nomes), cons_biometria, cons_imagem, cons_comunicacao
--
-- Duplicidade: se ja existir aluno ativo com o mesmo nome na escola, atualiza
-- em vez de criar outro. Evita o classico "Joao Silva" tres vezes na lista.
-- ============================================================================
create or replace function public.importar_alunos(p_alunos jsonb)
returns table (criados int, atualizados int, erros jsonb)
language plpgsql security invoker set search_path = public, extensions as $$
declare
  v_escola   uuid := public.minha_escola();
  item       jsonb;
  v_aluno    uuid;
  v_faixa    uuid;
  v_turma    uuid;
  v_nome     text;
  v_nasc     date;
  v_novo     boolean;
  t          text;
  v_criados  int := 0;
  v_atual    int := 0;
  v_erros    jsonb := '[]'::jsonb;
begin
  if v_escola is null then
    raise exception 'Usuario sem escola vinculada';
  end if;

  for item in select * from jsonb_array_elements(p_alunos) loop
    begin
      v_nome := btrim(coalesce(item->>'nome',''));
      if v_nome = '' then
        v_erros := v_erros || jsonb_build_array(jsonb_build_object('nome','(vazio)','erro','sem nome'));
        continue;
      end if;

      begin
        v_nasc := nullif(item->>'nascimento','')::date;
      exception when others then
        v_nasc := null;
      end;

      -- faixa pelo nome, quando informada
      v_faixa := null;
      if coalesce(item->>'faixa_nome','') <> '' then
        select f.id into v_faixa
          from public.faixa f
          join public.modalidade m on m.id = f.modalidade_id
         where m.escola_id = v_escola
           and lower(unaccent(f.nome)) = lower(unaccent(item->>'faixa_nome'))
         limit 1;
      end if;

      -- ja existe alguem com esse nome?
      select a.id into v_aluno
        from public.aluno a
       where a.escola_id = v_escola
         and lower(unaccent(a.nome)) = lower(unaccent(v_nome))
       limit 1;

      v_novo := v_aluno is null;

      if v_novo then
        insert into public.aluno (
          escola_id, nome, nascimento, telefone, email,
          responsavel_nome, responsavel_telefone, responsavel_parentesco,
          faixa_id, graus, observacoes
        ) values (
          v_escola, v_nome, v_nasc,
          nullif(item->>'telefone',''), nullif(item->>'email',''),
          nullif(item->>'responsavel_nome',''), nullif(item->>'responsavel_telefone',''),
          nullif(item->>'responsavel_parentesco',''),
          v_faixa, coalesce(nullif(item->>'graus','')::int, 0),
          nullif(item->>'observacoes','')
        ) returning id into v_aluno;
        v_criados := v_criados + 1;
      else
        update public.aluno a set
          nascimento             = coalesce(v_nasc, a.nascimento),
          telefone               = coalesce(nullif(item->>'telefone',''), a.telefone),
          email                  = coalesce(nullif(item->>'email',''), a.email),
          responsavel_nome       = coalesce(nullif(item->>'responsavel_nome',''), a.responsavel_nome),
          responsavel_telefone   = coalesce(nullif(item->>'responsavel_telefone',''), a.responsavel_telefone),
          responsavel_parentesco = coalesce(nullif(item->>'responsavel_parentesco',''), a.responsavel_parentesco),
          faixa_id               = coalesce(v_faixa, a.faixa_id),
          graus                  = coalesce(nullif(item->>'graus','')::int, a.graus),
          observacoes            = coalesce(nullif(item->>'observacoes',''), a.observacoes)
        where a.id = v_aluno;
        v_atual := v_atual + 1;
      end if;

      -- consentimentos: append-only, so grava se veio no item
      if item ? 'cons_biometria' then
        insert into public.consentimento (escola_id, aluno_id, tipo, concedido, concedido_por, base_legal, texto_versao)
        values (v_escola, v_aluno, 'biometria', (item->>'cons_biometria')::boolean,
                coalesce(nullif(item->>'responsavel_nome',''), 'o proprio titular'),
                'LGPD art. 11, I - consentimento coletado em formulario', 'importacao-v1');
      end if;
      if item ? 'cons_imagem' then
        insert into public.consentimento (escola_id, aluno_id, tipo, concedido, concedido_por, base_legal, texto_versao)
        values (v_escola, v_aluno, 'imagem', (item->>'cons_imagem')::boolean,
                coalesce(nullif(item->>'responsavel_nome',''), 'o proprio titular'),
                'LGPD art. 7, I - consentimento coletado em formulario', 'importacao-v1');
      end if;
      if item ? 'cons_comunicacao' then
        insert into public.consentimento (escola_id, aluno_id, tipo, concedido, concedido_por, base_legal, texto_versao)
        values (v_escola, v_aluno, 'comunicacao', (item->>'cons_comunicacao')::boolean,
                coalesce(nullif(item->>'responsavel_nome',''), 'o proprio titular'),
                'LGPD art. 7, I - consentimento coletado em formulario', 'importacao-v1');
      end if;

      -- turmas pelo nome
      if item ? 'turmas' then
        for t in select jsonb_array_elements_text(item->'turmas') loop
          select tu.id into v_turma from public.turma tu
           where tu.escola_id = v_escola and tu.ativo
             and lower(unaccent(tu.nome)) = lower(unaccent(btrim(t)))
           limit 1;
          if v_turma is not null then
            insert into public.matricula (turma_id, aluno_id, ativo)
            values (v_turma, v_aluno, true)
            on conflict (turma_id, aluno_id) do update set ativo = true;
          end if;
        end loop;
      end if;

    exception when others then
      v_erros := v_erros || jsonb_build_array(
        jsonb_build_object('nome', coalesce(v_nome,'?'), 'erro', sqlerrm));
    end;
  end loop;

  return query select v_criados, v_atual, v_erros;
end $$;

grant execute on function public.importar_alunos(jsonb) to authenticated;
