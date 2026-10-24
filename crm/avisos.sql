-- =====================================================================
--  Agenda Corretor (CRM) — agendador dos avisos no celular
--  Rode no SQL Editor DEPOIS de rodar o schema.sql e de criar a função
--  "avisos" (veja crm/README.md). Chama a função a cada minuto.
--  Pode ser executado mais de uma vez.
-- =====================================================================
create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net with schema extensions;

select cron.unschedule(jobid) from cron.job where jobname = 'crm-avisos';

select cron.schedule(
  'crm-avisos',
  '* * * * *',
  $$
  select net.http_post(
    url := 'https://ahklfealqulmbahzvlpt.supabase.co/functions/v1/avisos',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-segredo', (select valor->>'segredo' from public.crm_config where chave = 'cron')
    ),
    body := '{}'::jsonb
  );
  $$
);
