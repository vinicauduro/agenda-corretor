-- =====================================================================
--  Agenda Corretor (CRM) — esquema do banco (Supabase / Postgres)
--  Projeto Supabase próprio do CRM, separado da Gestão de Loteamento.
--  Cole este arquivo inteiro no SQL Editor do projeto e execute.
--  Pode ser executado mais de uma vez (idempotente).
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Equipes, membros e convites
--    Cada usuário participa de uma equipe só. Papéis: admin (vê e
--    distribui todos os leads, convida e gerencia a equipe) e corretor
--    (vê só os leads dele).
-- ---------------------------------------------------------------------
create table if not exists public.equipes (
  id          uuid primary key default gen_random_uuid(),
  nome        text not null,
  criado_em   timestamptz not null default now()
);

create table if not exists public.membros (
  id          uuid primary key default gen_random_uuid(),
  equipe_id   uuid not null references public.equipes(id) on delete cascade,
  user_id     uuid not null unique references auth.users(id) on delete cascade,
  papel       text not null default 'corretor' check (papel in ('admin','corretor')),
  nome        text not null default '',
  telefone    text not null default '',
  email       text not null default '',
  ativo       boolean not null default true,
  criado_em   timestamptz not null default now()
);
create index if not exists membros_equipe_idx on public.membros (equipe_id);

-- Convite vale para uma pessoa só e expira em 7 dias.
create table if not exists public.convites (
  codigo      text primary key,
  equipe_id   uuid not null references public.equipes(id) on delete cascade,
  papel       text not null default 'corretor' check (papel in ('admin','corretor')),
  usado_por   uuid references auth.users(id) on delete set null,
  usado_em    timestamptz,
  expira_em   timestamptz not null default now() + interval '7 days',
  criado_por  uuid,
  criado_em   timestamptz not null default now()
);

create or replace function public.eh_membro(p_equipe uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.membros where equipe_id = p_equipe and user_id = auth.uid() and ativo)
$$;

create or replace function public.eh_admin(p_equipe uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.membros where equipe_id = p_equipe and user_id = auth.uid() and ativo and papel = 'admin')
$$;

-- O membro edita o próprio nome e telefone; papel e situação só o admin muda,
-- e a equipe nunca fica sem um administrador ativo.
create or replace function public.membros_protege()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.equipe_id <> old.equipe_id or new.user_id <> old.user_id then
    raise exception 'Não é possível mudar a equipe ou o usuário de um membro';
  end if;
  if (new.papel is distinct from old.papel or new.ativo is distinct from old.ativo)
     and not public.eh_admin(old.equipe_id) then
    raise exception 'Só o administrador muda o papel ou a situação de um membro';
  end if;
  if old.papel = 'admin' and old.ativo and (new.papel <> 'admin' or not new.ativo)
     and not exists (select 1 from public.membros
                     where equipe_id = old.equipe_id and papel = 'admin' and ativo and id <> old.id) then
    raise exception 'A equipe precisa ter pelo menos um administrador ativo';
  end if;
  return new;
end $$;
drop trigger if exists membros_protege on public.membros;
create trigger membros_protege before update on public.membros
  for each row execute function public.membros_protege();

alter table public.equipes  enable row level security;
alter table public.membros  enable row level security;
alter table public.convites enable row level security;

drop policy if exists equipes_select on public.equipes;
drop policy if exists equipes_update on public.equipes;
create policy equipes_select on public.equipes for select to authenticated using (public.eh_membro(id));
create policy equipes_update on public.equipes for update to authenticated using (public.eh_admin(id)) with check (public.eh_admin(id));

-- O próprio usuário sempre enxerga a sua linha (mesmo desativado, para saber disso).
drop policy if exists membros_select on public.membros;
drop policy if exists membros_update on public.membros;
create policy membros_select on public.membros for select to authenticated
  using (user_id = auth.uid() or public.eh_membro(equipe_id));
create policy membros_update on public.membros for update to authenticated
  using (user_id = auth.uid() or public.eh_admin(equipe_id))
  with check (user_id = auth.uid() or public.eh_admin(equipe_id));

drop policy if exists convites_select on public.convites;
drop policy if exists convites_delete on public.convites;
create policy convites_select on public.convites for select to authenticated using (public.eh_admin(equipe_id));
create policy convites_delete on public.convites for delete to authenticated using (public.eh_admin(equipe_id));

-- Quem cria a equipe vira o administrador.
create or replace function public.crm_criar_equipe(p_nome text, p_usuario_nome text default '', p_telefone text default '')
returns uuid language plpgsql security definer set search_path = public as $$
declare v_equipe uuid; v_email text;
begin
  if auth.uid() is null then raise exception 'Faça login primeiro'; end if;
  if coalesce(trim(p_nome), '') = '' then raise exception 'Informe o nome da equipe'; end if;
  if exists (select 1 from public.membros where user_id = auth.uid()) then
    raise exception 'Você já faz parte de uma equipe';
  end if;
  select email into v_email from auth.users where id = auth.uid();
  insert into public.equipes (nome) values (trim(p_nome)) returning id into v_equipe;
  insert into public.membros (equipe_id, user_id, papel, nome, telefone, email)
    values (v_equipe, auth.uid(), 'admin', coalesce(trim(p_usuario_nome), ''), coalesce(trim(p_telefone), ''), coalesce(v_email, ''));
  return v_equipe;
end $$;

create or replace function public.crm_criar_convite(p_papel text default 'corretor')
returns text language plpgsql security definer set search_path = public as $$
declare v_equipe uuid; v_codigo text;
begin
  select equipe_id into v_equipe from public.membros where user_id = auth.uid() and ativo and papel = 'admin';
  if v_equipe is null then raise exception 'Só o administrador pode convidar'; end if;
  if p_papel not in ('admin','corretor') then raise exception 'Papel inválido'; end if;
  v_codigo := substr(md5(gen_random_uuid()::text || clock_timestamp()::text), 1, 12);
  insert into public.convites (codigo, equipe_id, papel, criado_por) values (v_codigo, v_equipe, p_papel, auth.uid());
  return v_codigo;
end $$;

create or replace function public.crm_aceitar_convite(p_codigo text, p_nome text default '', p_telefone text default '')
returns uuid language plpgsql security definer set search_path = public as $$
declare c public.convites; v_email text;
begin
  if auth.uid() is null then raise exception 'Faça login primeiro'; end if;
  select * into c from public.convites where codigo = trim(p_codigo) for update;
  if not found then raise exception 'Convite não encontrado'; end if;
  if exists (select 1 from public.membros where user_id = auth.uid()) then
    if exists (select 1 from public.membros where user_id = auth.uid() and equipe_id = c.equipe_id) then
      return c.equipe_id;
    end if;
    raise exception 'Você já faz parte de outra equipe';
  end if;
  if c.usado_por is not null then raise exception 'Este convite já foi usado. Peça um novo ao administrador'; end if;
  if c.expira_em < now() then raise exception 'Este convite expirou. Peça um novo ao administrador'; end if;
  select email into v_email from auth.users where id = auth.uid();
  insert into public.membros (equipe_id, user_id, papel, nome, telefone, email)
    values (c.equipe_id, auth.uid(), c.papel, coalesce(trim(p_nome), ''), coalesce(trim(p_telefone), ''), coalesce(v_email, ''));
  update public.convites set usado_por = auth.uid(), usado_em = now() where codigo = c.codigo;
  return c.equipe_id;
end $$;

-- ---------------------------------------------------------------------
-- 2. Leads (da equipe). O id é gerado pelo aplicativo.
--    Funil: novo → visita → negociando → fechado / perdido.
--    Corretor: vê, cadastra e edita só os leads dele; exclui só os que ele
--    mesmo cadastrou. Admin: vê e edita todos e distribui (corretor_id).
-- ---------------------------------------------------------------------
create table if not exists public.leads (
  equipe_id      uuid not null references public.equipes(id) on delete cascade,
  id             text not null,
  corretor_id    uuid references auth.users(id) on delete set null,
  nome           text not null,
  telefone       text not null default '',
  email          text not null default '',
  etapa          text not null default 'novo',
  motivo_perda   text not null default '',
  finalidade     text not null default 'compra' check (finalidade in ('compra','locacao')),
  tipo_imovel    text not null default '',
  regiao         text not null default '',
  valor_min      numeric(14,2),
  valor_max      numeric(14,2),
  pagamento      text[] not null default '{}',
  obs            text not null default '',
  criado_por     uuid,
  criado_em      timestamptz not null default now(),
  atualizado_em  timestamptz not null default now(),
  primary key (equipe_id, id)
);
create index if not exists leads_corretor_idx on public.leads (equipe_id, corretor_id);

-- Etapas do funil. Fica fora do create table para valer também em bancos já
-- criados (a etapa Visita entrou depois).
alter table public.leads drop constraint if exists leads_etapa_check;
alter table public.leads add constraint leads_etapa_check
  check (etapa in ('novo','visita','negociando','fechado','perdido'));

-- Quem cadastrou e quando não mudam depois; a data de atualização é do banco.
create or replace function public.leads_carimbo()
returns trigger language plpgsql set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    new.criado_por := auth.uid();
  else
    new.criado_por := old.criado_por;
    new.criado_em  := old.criado_em;
  end if;
  new.atualizado_em := now();
  return new;
end $$;
drop trigger if exists leads_carimbo on public.leads;
create trigger leads_carimbo before insert or update on public.leads
  for each row execute function public.leads_carimbo();

alter table public.leads enable row level security;
drop policy if exists leads_select on public.leads;
drop policy if exists leads_insert on public.leads;
drop policy if exists leads_update on public.leads;
drop policy if exists leads_delete on public.leads;
create policy leads_select on public.leads for select to authenticated
  using (public.eh_admin(equipe_id) or (public.eh_membro(equipe_id) and corretor_id = auth.uid()));
create policy leads_insert on public.leads for insert to authenticated
  with check (public.eh_admin(equipe_id) or (public.eh_membro(equipe_id) and corretor_id = auth.uid()));
create policy leads_update on public.leads for update to authenticated
  using (public.eh_admin(equipe_id) or (public.eh_membro(equipe_id) and corretor_id = auth.uid()))
  with check (public.eh_admin(equipe_id) or (public.eh_membro(equipe_id) and corretor_id = auth.uid()));
create policy leads_delete on public.leads for delete to authenticated
  using (public.eh_admin(equipe_id)
         or (public.eh_membro(equipe_id) and corretor_id = auth.uid() and criado_por = auth.uid()));

-- Tempo real: o corretor vê na hora o lead que o admin passou para ele.
do $$ begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (select 1 from pg_publication_tables
                     where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'leads') then
    alter publication supabase_realtime add table public.leads;
  end if;
end $$;

-- ---------------------------------------------------------------------
-- 3. Agenda, lembretes e mensagens: pessoais, cada usuário só os seus.
-- ---------------------------------------------------------------------
create table if not exists public.eventos (
  user_id      uuid not null default auth.uid() references auth.users(id) on delete cascade,
  id           text not null,
  titulo       text not null default '',
  data         text not null default '',
  hora         text not null default '',
  tipo         text not null default 'outro',
  descricao    text not null default '',
  lembrar_min  text not null default '',
  lead_id      text,
  criado_em    timestamptz not null default now(),
  primary key (user_id, id)
);

create table if not exists public.lembretes (
  user_id      uuid not null default auth.uid() references auth.users(id) on delete cascade,
  id           text not null,
  titulo       text not null default '',
  data         text not null default '',
  hora         text not null default '',
  feito        boolean not null default false,
  notificado   boolean not null default false,
  lead_id      text,
  criado_em    timestamptz not null default now(),
  primary key (user_id, id)
);

create table if not exists public.mensagens (
  user_id      uuid not null default auth.uid() references auth.users(id) on delete cascade,
  id           text not null,
  papel        text not null default 'user',
  tipo         text not null default 'texto',
  conteudo     text not null default '',
  transcricao  text not null default '',
  duracao      integer,
  hora         text not null default '',
  criado_em    timestamptz not null default now(),
  primary key (user_id, id)
);
create index if not exists mensagens_ordem_idx on public.mensagens (user_id, criado_em);

alter table public.eventos   enable row level security;
alter table public.lembretes enable row level security;
alter table public.mensagens enable row level security;
drop policy if exists eventos_dono on public.eventos;
drop policy if exists lembretes_dono on public.lembretes;
drop policy if exists mensagens_dono on public.mensagens;
create policy eventos_dono   on public.eventos   for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy lembretes_dono on public.lembretes for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy mensagens_dono on public.mensagens for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ---------------------------------------------------------------------
-- 4. Permissões: nada para visitante sem login; usuário logado passa
--    pelas políticas acima.
-- ---------------------------------------------------------------------
revoke all on public.equipes, public.membros, public.convites, public.leads,
              public.eventos, public.lembretes, public.mensagens from anon;
grant select, update                 on public.equipes  to authenticated;
grant select, update                 on public.membros  to authenticated;
grant select, delete                 on public.convites to authenticated;
grant select, insert, update, delete on public.leads, public.eventos, public.lembretes, public.mensagens to authenticated;

revoke execute on function public.eh_membro(uuid), public.eh_admin(uuid),
  public.crm_criar_equipe(text, text, text), public.crm_criar_convite(text),
  public.crm_aceitar_convite(text, text, text) from public, anon;
grant execute on function public.eh_membro(uuid), public.eh_admin(uuid),
  public.crm_criar_equipe(text, text, text), public.crm_criar_convite(text),
  public.crm_aceitar_convite(text, text, text) to authenticated;

-- ---------------------------------------------------------------------
-- 5. Avisos no celular (push), mesmo com o app fechado.
--    O aparelho se inscreve (crm_salvar_inscricao); a função "avisos" do
--    Supabase roda a cada minuto (crm/avisos.sql), pede aqui o que venceu
--    (crm_avisos_a_enviar) e manda o push. Horário do lembrete sem hora:
--    9h do dia. Cada aviso sai uma vez só (avisos_enviados).
-- ---------------------------------------------------------------------
create table if not exists public.push_inscricoes (
  endpoint    text primary key,
  user_id     uuid not null references auth.users(id) on delete cascade,
  p256dh      text not null,
  auth        text not null,
  fuso        text not null default 'America/Sao_Paulo',
  criado_em   timestamptz not null default now()
);
create index if not exists push_inscricoes_user_idx on public.push_inscricoes (user_id);

create table if not exists public.avisos_enviados (
  user_id     uuid not null,
  tipo        text not null,
  item_id     text not null,
  quando      timestamptz not null,
  enviado_em  timestamptz not null default now(),
  primary key (user_id, tipo, item_id, quando)
);

-- Chaves do push (geradas pela função "avisos" no primeiro uso) e o segredo
-- que o agendador usa para chamar a função. Só o servidor lê.
create table if not exists public.crm_config (
  chave  text primary key,
  valor  jsonb not null
);
insert into public.crm_config (chave, valor)
  values ('cron', jsonb_build_object('segredo', md5(gen_random_uuid()::text) || md5(gen_random_uuid()::text)))
  on conflict (chave) do nothing;

alter table public.push_inscricoes enable row level security;
alter table public.avisos_enviados enable row level security;
alter table public.crm_config      enable row level security;
revoke all on public.push_inscricoes, public.avisos_enviados, public.crm_config from anon, authenticated;
-- a função "avisos" usa a chave de serviço: lê/cria as chaves e limpa inscrições vencidas
grant select, insert on public.crm_config to service_role;
grant select, delete on public.push_inscricoes to service_role;

create or replace function public.crm_salvar_inscricao(p_endpoint text, p_p256dh text, p_auth text, p_fuso text default 'America/Sao_Paulo')
returns void language plpgsql security definer set search_path = public as $$
declare v_fuso text;
begin
  if auth.uid() is null then raise exception 'Faça login primeiro'; end if;
  v_fuso := case when exists (select 1 from pg_timezone_names where name = p_fuso) then p_fuso else 'America/Sao_Paulo' end;
  insert into public.push_inscricoes (endpoint, user_id, p256dh, auth, fuso)
    values (p_endpoint, auth.uid(), p_p256dh, p_auth, v_fuso)
    on conflict (endpoint) do update
      set user_id = excluded.user_id, p256dh = excluded.p256dh, auth = excluded.auth, fuso = excluded.fuso, criado_em = now();
end $$;

create or replace function public.crm_remover_inscricao(p_endpoint text)
returns void language sql security definer set search_path = public as $$
  delete from public.push_inscricoes where endpoint = p_endpoint and user_id = auth.uid()
$$;

create or replace function public.crm_vapid_publica()
returns text language sql stable security definer set search_path = public as $$
  select valor->>'publica' from public.crm_config where chave = 'vapid'
$$;

-- data 'AAAA-MM-DD' + hora 'HH:MM' no fuso do usuário; null se a data for inválida
create or replace function public.crm_momento(p_data text, p_hora text, p_fuso text)
returns timestamptz language plpgsql stable set search_path = public as $$
begin
  if p_data !~ '^\d{4}-\d{2}-\d{2}$' or coalesce(p_hora, '') !~ '^(\d{2}:\d{2})?$' then return null; end if;
  return (p_data || ' ' || coalesce(nullif(p_hora, ''), '09:00'))::timestamp at time zone p_fuso;
exception when others then
  return null;
end $$;

create or replace function public.crm_avisos_a_enviar()
returns table (endpoint text, p256dh text, auth text, titulo text, corpo text, tag text)
language sql volatile security definer set search_path = public as $$
  with fusos as (
    select distinct on (i.user_id) i.user_id, i.fuso
    from public.push_inscricoes i order by i.user_id, i.criado_em desc
  ),
  itens as (
    select l.user_id, 'lembrete'::text as tipo, l.id as item_id,
           public.crm_momento(l.data, l.hora, f.fuso) as quando,
           '🔔 ' || l.titulo as titulo,
           case when l.hora <> '' then 'Lembrete das ' || l.hora else 'Lembrete de hoje' end as corpo
    from public.lembretes l join fusos f on f.user_id = l.user_id
    where not l.feito
    union all
    select e.user_id, 'evento', e.id,
           public.crm_momento(e.data, e.hora, f.fuso) - make_interval(mins => e.lembrar_min::int),
           '📅 ' || e.titulo,
           case when e.hora <> '' then 'Às ' || e.hora || ' de ' || to_char(e.data::date, 'DD/MM')
                else 'Dia ' || to_char(e.data::date, 'DD/MM') end
    from public.eventos e join fusos f on f.user_id = e.user_id
    where e.lembrar_min ~ '^\d{1,5}$' and public.crm_momento(e.data, e.hora, f.fuso) is not null
  ),
  devidos as (
    select it.* from itens it
    where it.quando <= now() and it.quando > now() - interval '15 minutes'
      and not exists (select 1 from public.avisos_enviados a
                      where a.user_id = it.user_id and a.tipo = it.tipo and a.item_id = it.item_id and a.quando = it.quando)
  ),
  marcados as (
    insert into public.avisos_enviados (user_id, tipo, item_id, quando)
      select d.user_id, d.tipo, d.item_id, d.quando from devidos d
      on conflict do nothing
      returning avisos_enviados.user_id, avisos_enviados.tipo, avisos_enviados.item_id, avisos_enviados.quando
  )
  select i.endpoint, i.p256dh, i.auth, d.titulo, d.corpo, d.tipo || ':' || d.item_id
  from marcados m
  join devidos d on d.user_id = m.user_id and d.tipo = m.tipo and d.item_id = m.item_id and d.quando = m.quando
  join public.push_inscricoes i on i.user_id = m.user_id
$$;

revoke execute on function public.crm_salvar_inscricao(text, text, text, text), public.crm_remover_inscricao(text),
  public.crm_vapid_publica(), public.crm_avisos_a_enviar() from public, anon;
grant execute on function public.crm_salvar_inscricao(text, text, text, text), public.crm_remover_inscricao(text),
  public.crm_vapid_publica() to authenticated;
revoke execute on function public.crm_avisos_a_enviar() from authenticated;
grant execute on function public.crm_avisos_a_enviar() to service_role;
