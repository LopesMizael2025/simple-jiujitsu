-- ============================================================================
-- Simple Jiu-Jitsu · Grade real de horarios (Sala 01 - artes marciais)
--
-- Substitui as turmas de exemplo do seed pela grade que a escola usa de fato.
-- Fonte: quadro "HORARIOS - AULAS COLETIVAS", Sala 01.
-- A Sala 02 (abdominal, funcional, fitdance) fica de fora de proposito:
-- nao e arte marcial e nao entra no controle de graduacao.
--
-- SEGURANCA: so apaga turma que nao tem matricula nem aula registrada.
-- Se ja houver aluno matriculado, a turma antiga e apenas desativada.
-- dia_semana: 0=dom 1=seg 2=ter 3=qua 4=qui 5=sex 6=sab
-- Duracao: 1h por aula (o quadro nao informa o termino; ajuste se precisar).
-- ============================================================================

do $$
declare
  v_escola uuid;
  v_jj     uuid;
  v_mt     uuid;
  v_id     uuid;
begin
  select id into v_escola from public.escola where slug = 'simple';
  select id into v_jj from public.modalidade where escola_id = v_escola and nome = 'Jiu-Jitsu';
  select id into v_mt from public.modalidade where escola_id = v_escola and nome = 'Muay Thai';

  -- ------------------------------------------------- limpa o seed antigo ---
  delete from public.turma_horario
   where turma_id in (select id from public.turma where escola_id = v_escola);

  -- desativa turmas antigas que ja tenham historico
  update public.turma t set ativo = false
   where t.escola_id = v_escola
     and (exists (select 1 from public.matricula m where m.turma_id = t.id)
       or exists (select 1 from public.aula a where a.turma_id = t.id));

  -- apaga as que nunca foram usadas
  delete from public.turma t
   where t.escola_id = v_escola
     and not exists (select 1 from public.matricula m where m.turma_id = t.id)
     and not exists (select 1 from public.aula a where a.turma_id = t.id);

  -- ===================================================== JIU-JITSU ADULTO ==
  insert into public.turma (escola_id, modalidade_id, nome, faixa_etaria, nivel)
  values (v_escola, v_jj, 'Jiu-Jitsu Adulto', 'adulto', 'Com kimono')
  returning id into v_id;
  insert into public.turma_horario (turma_id, dia_semana, hora_inicio, hora_fim) values
    (v_id, 1, '12:00', '13:00'),   -- segunda 12h
    (v_id, 5, '12:00', '13:00'),   -- sexta 12h
    (v_id, 1, '20:00', '21:00'),   -- segunda 20h
    (v_id, 2, '20:00', '21:00'),   -- terca 20h
    (v_id, 3, '20:00', '21:00'),   -- quarta 20h
    (v_id, 5, '19:00', '20:00');   -- sexta 19h

  -- ================================================ JIU-JITSU ADULTO NO GI ==
  insert into public.turma (escola_id, modalidade_id, nome, faixa_etaria, nivel)
  values (v_escola, v_jj, 'Jiu-Jitsu Adulto No Gi', 'adulto', 'Sem kimono')
  returning id into v_id;
  insert into public.turma_horario (turma_id, dia_semana, hora_inicio, hora_fim) values
    (v_id, 3, '12:00', '13:00'),   -- quarta 12h
    (v_id, 4, '20:00', '21:00');   -- quinta 20h

  -- ================================================== JIU-JITSU KIDS 4 a 7 ==
  insert into public.turma (escola_id, modalidade_id, nome, faixa_etaria, nivel)
  values (v_escola, v_jj, 'Jiu-Jitsu Kids 4 a 7', 'kids', 'Com kimono')
  returning id into v_id;
  insert into public.turma_horario (turma_id, dia_semana, hora_inicio, hora_fim) values
    (v_id, 1, '18:00', '19:00'),   -- segunda 18h
    (v_id, 3, '18:00', '19:00');   -- quarta 18h

  -- ================================================= JIU-JITSU KIDS 7 a 11 ==
  insert into public.turma (escola_id, modalidade_id, nome, faixa_etaria, nivel)
  values (v_escola, v_jj, 'Jiu-Jitsu Kids 7 a 11', 'kids', 'Com kimono')
  returning id into v_id;
  insert into public.turma_horario (turma_id, dia_semana, hora_inicio, hora_fim) values
    (v_id, 2, '09:00', '10:00'),   -- terca 9h
    (v_id, 4, '09:00', '10:00'),   -- quinta 9h
    (v_id, 1, '18:00', '19:00'),   -- segunda 18h
    (v_id, 3, '18:00', '19:00');   -- quarta 18h

  -- =========================================== JIU-JITSU KIDS NO GI 7 a 11 ==
  insert into public.turma (escola_id, modalidade_id, nome, faixa_etaria, nivel)
  values (v_escola, v_jj, 'Jiu-Jitsu Kids No Gi 7 a 11', 'kids', 'Sem kimono')
  returning id into v_id;
  insert into public.turma_horario (turma_id, dia_semana, hora_inicio, hora_fim) values
    (v_id, 2, '18:00', '19:00'),   -- terca 18h
    (v_id, 4, '18:00', '19:00');   -- quinta 18h

  -- =============================================================== MUAY THAI ==
  insert into public.turma (escola_id, modalidade_id, nome, faixa_etaria, nivel)
  values (v_escola, v_mt, 'Muay Thai', 'adulto', null)
  returning id into v_id;
  insert into public.turma_horario (turma_id, dia_semana, hora_inicio, hora_fim) values
    (v_id, 2, '07:00', '08:00'),   -- terca 7h
    (v_id, 4, '07:00', '08:00'),   -- quinta 7h
    (v_id, 1, '19:00', '20:00'),   -- segunda 19h
    (v_id, 2, '19:00', '20:00'),   -- terca 19h
    (v_id, 3, '19:00', '20:00'),   -- quarta 19h
    (v_id, 4, '19:00', '20:00'),   -- quinta 19h
    (v_id, 5, '18:00', '19:00');   -- sexta 18h
end $$;

-- ---------------------------------------------------------- conferencia ----
select
  t.nome as turma,
  case h.dia_semana
    when 1 then 'seg' when 2 then 'ter' when 3 then 'qua'
    when 4 then 'qui' when 5 then 'sex' when 6 then 'sab' else 'dom' end as dia,
  to_char(h.hora_inicio, 'HH24:MI') as inicio
from public.turma t
join public.turma_horario h on h.turma_id = t.id
where t.ativo
order by h.dia_semana, h.hora_inicio, t.nome;
