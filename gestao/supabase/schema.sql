-- =====================================================================
--  Gestão de Loteamento — esquema do banco (Supabase / Postgres)
--  Cole este arquivo inteiro no SQL Editor do Supabase e execute.
--  Pode ser executado mais de uma vez (idempotente).
-- =====================================================================

-- id curto gerado no banco (para registros criados pelas funções)
create or replace function public.gl_novo_id() returns text language sql volatile as $$ select substr(md5(random()::text || clock_timestamp()::text), 1, 16) $$;

-- ---------------------------------------------------------------------
-- 1. Empresas (organizações), membros e convites
-- ---------------------------------------------------------------------
create table if not exists public.organizacoes (
  id          uuid primary key default gen_random_uuid(),
  nome        text not null,
  config      jsonb not null default '{}'::jsonb,
  plano       text not null default 'gratuito',
  criado_em   timestamptz not null default now()
);

create table if not exists public.membros (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references public.organizacoes(id) on delete cascade,
  user_id     uuid not null references auth.users(id) on delete cascade,
  papel       text not null check (papel in ('dono','admin','financeiro','corretor')),
  nome        text not null default '',
  telefone    text not null default '',
  creci       text not null default '',
  email       text not null default '',
  imobiliaria text not null default '',
  ativo       boolean not null default true,
  criado_em   timestamptz not null default now(),
  unique (org_id, user_id)
);
create index if not exists membros_user_idx on public.membros(user_id);

create table if not exists public.convites (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references public.organizacoes(id) on delete cascade,
  codigo      text not null unique,
  papel       text not null default 'corretor' check (papel in ('admin','financeiro','corretor')),
  descricao   text not null default '',
  usos        integer not null default 0,
  max_usos    integer not null default 100,
  expira_em   timestamptz,
  criado_por  uuid,
  criado_em   timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- 2. Dados do loteamento (todas as tabelas têm chave (org_id, id);
--    o id é gerado pelo aplicativo)
-- ---------------------------------------------------------------------
create table if not exists public.loteamentos (
  org_id      uuid not null references public.organizacoes(id) on delete cascade,
  id          text not null,
  nome        text not null,
  cidade      text not null default '',
  endereco    text not null default '',
  descricao   text not null default '',
  cond        jsonb not null default '{}'::jsonb,
  orcamento   jsonb not null default '{}'::jsonb,
  planta      jsonb,
  criado_em   timestamptz not null default now(),
  primary key (org_id, id)
);

create table if not exists public.categorias (
  org_id      uuid not null references public.organizacoes(id) on delete cascade,
  id          text not null,
  nome        text not null,
  cor         text not null default '#64748b',
  primary key (org_id, id)
);

create table if not exists public.lotes (
  org_id        uuid not null references public.organizacoes(id) on delete cascade,
  id            text not null,
  loteamento_id text not null,
  quadra        text not null,
  numero        text not null,
  area          double precision not null default 0,
  frente        double precision,
  fundos        double precision,
  preco         double precision not null default 0,
  tipo          text not null default 'residencial',
  status        text not null default 'disponivel' check (status in ('disponivel','reservado','vendido','bloqueado')),
  obs           text not null default '',
  matricula     text not null default '',
  pts           jsonb,
  reserva_id    text,
  venda_id      text,
  criado_em     timestamptz not null default now(),
  primary key (org_id, id)
);
create index if not exists lotes_loteamento_idx on public.lotes(org_id, loteamento_id);

create table if not exists public.reservas (
  org_id           uuid not null references public.organizacoes(id) on delete cascade,
  id               text not null,
  loteamento_id    text not null,
  lote_id          text not null,
  corretor         jsonb not null default '{}'::jsonb,
  corretor_user_id uuid,
  cliente          jsonb not null default '{}'::jsonb,
  data_reserva     date not null default current_date,
  validade         date,
  status           text not null default 'pendente' check (status in ('pendente','aprovada','recusada','cancelada','expirada','convertida')),
  proposta         jsonb,
  obs              text not null default '',
  motivo           text not null default '',
  aprovada_em      date,
  encerrada_em     timestamptz,
  criado_em        timestamptz not null default now(),
  primary key (org_id, id)
);
create index if not exists reservas_lote_idx on public.reservas(org_id, lote_id);
create index if not exists reservas_corretor_idx on public.reservas(corretor_user_id);

create table if not exists public.vendas (
  org_id              uuid not null references public.organizacoes(id) on delete cascade,
  id                  text not null,
  loteamento_id       text not null,
  lote_id             text not null,
  reserva_id          text,
  cliente             jsonb not null default '{}'::jsonb,
  corretor            jsonb not null default '{}'::jsonb,
  corretor_user_id    uuid,
  data_venda          date not null default current_date,
  valor_total         double precision not null default 0,
  entrada             double precision not null default 0,
  data_entrada        date,
  n_parcelas          integer not null default 0,
  juros_mes           double precision not null default 0,
  valor_parcela       double precision not null default 0,
  primeiro_vencimento date,
  baloes              jsonb not null default '[]'::jsonb,
  comissao_pct        double precision not null default 0,
  comissao_valor      double precision not null default 0,
  comissao_paga       boolean not null default false,
  comissao_data       date,
  status              text not null default 'ativa' check (status in ('ativa','quitada','distrato')),
  obs                 text not null default '',
  motivo              text not null default '',
  distrato_em         date,
  criado_em           timestamptz not null default now(),
  primary key (org_id, id)
);
create index if not exists vendas_corretor_idx on public.vendas(corretor_user_id);

create table if not exists public.recebiveis (
  org_id         uuid not null references public.organizacoes(id) on delete cascade,
  id             text not null,
  loteamento_id  text not null,
  venda_id       text not null,
  tipo           text not null default 'parcela',
  numero         integer not null default 0,
  descricao      text not null default '',
  vencimento     date not null,
  valor          double precision not null default 0,
  valor_pago     double precision not null default 0,
  data_pagamento date,
  forma          text,
  obs_pagamento  text not null default '',
  primary key (org_id, id)
);
create index if not exists recebiveis_venda_idx on public.recebiveis(org_id, venda_id);

create table if not exists public.custos (
  org_id           uuid not null references public.organizacoes(id) on delete cascade,
  id               text not null,
  loteamento_id    text not null,
  lote_id          text,
  descricao        text not null,
  categoria_id     text,
  fornecedor       text not null default '',
  valor            double precision not null default 0,
  forma_pagamento  text not null default '',
  data_competencia date not null,
  vencimento       date,
  status           text not null default 'pendente' check (status in ('pendente','pago')),
  data_pagamento   date,
  obs              text not null default '',
  criado_em        timestamptz not null default now(),
  primary key (org_id, id)
);

create table if not exists public.log (
  org_id      uuid not null references public.organizacoes(id) on delete cascade,
  id          text not null,
  ts          timestamptz not null default now(),
  who         text not null default '',
  msg         text not null,
  primary key (org_id, id)
);
create index if not exists log_ts_idx on public.log(org_id, ts);

-- ---------------------------------------------------------------------
-- 3. Funções de apoio (usadas nas políticas de acesso)
-- ---------------------------------------------------------------------
create or replace function public.papel_na_org(p_org uuid)
returns text language sql stable security definer set search_path = public as $$
  select papel from public.membros where org_id = p_org and user_id = auth.uid() and ativo limit 1
$$;

create or replace function public.eh_membro(p_org uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.membros where org_id = p_org and user_id = auth.uid() and ativo)
$$;

create or replace function public.eh_admin(p_org uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.membros where org_id = p_org and user_id = auth.uid() and ativo and papel in ('dono','admin','financeiro'))
$$;

-- membro comum pode editar os próprios dados, mas não o próprio papel/ativo
create or replace function public.membros_protege_papel()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if (new.papel is distinct from old.papel or new.ativo is distinct from old.ativo or new.org_id <> old.org_id or new.user_id <> old.user_id)
     and not public.eh_admin(old.org_id) then
    raise exception 'Sem permissão para alterar papel ou situação do membro';
  end if;
  if old.papel = 'dono' and new.papel <> 'dono'
     and not exists (select 1 from public.membros where org_id = old.org_id and papel = 'dono' and id <> old.id) then
    raise exception 'A empresa precisa ter pelo menos um dono';
  end if;
  return new;
end $$;
drop trigger if exists membros_protege_papel on public.membros;
create trigger membros_protege_papel before update on public.membros
  for each row execute function public.membros_protege_papel();

-- ---------------------------------------------------------------------
-- 4. Políticas de acesso (RLS)
-- ---------------------------------------------------------------------
alter table public.organizacoes enable row level security;
alter table public.membros      enable row level security;
alter table public.convites     enable row level security;
alter table public.loteamentos  enable row level security;
alter table public.categorias   enable row level security;
alter table public.lotes        enable row level security;
alter table public.reservas     enable row level security;
alter table public.vendas       enable row level security;
alter table public.recebiveis   enable row level security;
alter table public.custos       enable row level security;
alter table public.log          enable row level security;

drop policy if exists org_select on public.organizacoes;
drop policy if exists org_update on public.organizacoes;
create policy org_select on public.organizacoes for select to authenticated using (public.eh_membro(id));
create policy org_update on public.organizacoes for update to authenticated using (public.eh_admin(id)) with check (public.eh_admin(id));

drop policy if exists membros_select on public.membros;
drop policy if exists membros_update on public.membros;
drop policy if exists membros_delete on public.membros;
create policy membros_select on public.membros for select to authenticated using (public.eh_membro(org_id));
create policy membros_update on public.membros for update to authenticated
  using (public.eh_admin(org_id) or user_id = auth.uid()) with check (public.eh_admin(org_id) or user_id = auth.uid());
create policy membros_delete on public.membros for delete to authenticated using (public.eh_admin(org_id) or user_id = auth.uid());

drop policy if exists convites_all on public.convites;
create policy convites_all on public.convites for all to authenticated using (public.eh_admin(org_id)) with check (public.eh_admin(org_id));

-- tabelas que todo membro lê e só admin escreve
do $$
declare t text;
begin
  foreach t in array array['loteamentos','categorias','lotes'] loop
    execute format('drop policy if exists %I_select on public.%I', t, t);
    execute format('drop policy if exists %I_write on public.%I', t, t);
    execute format('create policy %I_select on public.%I for select to authenticated using (public.eh_membro(org_id))', t, t);
    execute format('create policy %I_write on public.%I for all to authenticated using (public.eh_admin(org_id)) with check (public.eh_admin(org_id))', t, t);
  end loop;
  -- tabelas só do admin/financeiro
  foreach t in array array['recebiveis','custos'] loop
    execute format('drop policy if exists %I_all on public.%I', t, t);
    execute format('create policy %I_all on public.%I for all to authenticated using (public.eh_admin(org_id)) with check (public.eh_admin(org_id))', t, t);
  end loop;
end $$;

-- reservas e vendas: admin vê tudo; corretor vê só as suas
drop policy if exists reservas_select on public.reservas;
drop policy if exists reservas_write on public.reservas;
create policy reservas_select on public.reservas for select to authenticated using (public.eh_admin(org_id) or corretor_user_id = auth.uid());
create policy reservas_write on public.reservas for all to authenticated using (public.eh_admin(org_id)) with check (public.eh_admin(org_id));

drop policy if exists vendas_select on public.vendas;
drop policy if exists vendas_write on public.vendas;
create policy vendas_select on public.vendas for select to authenticated using (public.eh_admin(org_id) or corretor_user_id = auth.uid());
create policy vendas_write on public.vendas for all to authenticated using (public.eh_admin(org_id)) with check (public.eh_admin(org_id));

drop policy if exists log_select on public.log;
drop policy if exists log_insert on public.log;
create policy log_select on public.log for select to authenticated using (public.eh_admin(org_id));
create policy log_insert on public.log for insert to authenticated with check (public.eh_membro(org_id));

-- ---------------------------------------------------------------------
-- 5. Funções chamadas pelo aplicativo (RPC)
-- ---------------------------------------------------------------------

-- Cria a empresa do usuário logado e o torna dono.
create or replace function public.criar_organizacao(p_nome text, p_usuario_nome text default '', p_telefone text default '')
returns uuid language plpgsql security definer set search_path = public as $$
declare v_org uuid; v_email text;
begin
  if auth.uid() is null then raise exception 'Não autenticado'; end if;
  if coalesce(trim(p_nome), '') = '' then raise exception 'Informe o nome da empresa'; end if;
  select email into v_email from auth.users where id = auth.uid();
  insert into public.organizacoes (nome, config)
    values (trim(p_nome), jsonb_build_object('empresa', trim(p_nome), 'reservaDias', 7, 'multaPct', 2, 'jurosMesPct', 1, 'comissaoPct', 5, 'mostrarPrecoVendido', true))
    returning id into v_org;
  insert into public.membros (org_id, user_id, papel, nome, telefone, email)
    values (v_org, auth.uid(), 'dono', coalesce(p_usuario_nome, ''), coalesce(p_telefone, ''), coalesce(v_email, ''));
  insert into public.categorias (org_id, id, nome, cor) values
    (v_org, 'terraplanagem', 'Terraplanagem', '#92400e'),
    (v_org, 'pavimentacao', 'Pavimentação e Drenagem', '#0ea5e9'),
    (v_org, 'rede-eletrica', 'Rede Elétrica / Iluminação', '#eab308'),
    (v_org, 'agua-esgoto', 'Água e Esgoto', '#06b6d4'),
    (v_org, 'documentacao', 'Documentação e Cartório', '#ef4444'),
    (v_org, 'projetos', 'Projetos e Licenças', '#14b8a6'),
    (v_org, 'mao-de-obra', 'Mão de Obra', '#8b5cf6'),
    (v_org, 'materiais', 'Materiais', '#f97316'),
    (v_org, 'impostos', 'Impostos e Taxas', '#64748b'),
    (v_org, 'marketing', 'Marketing e Vendas', '#22c55e'),
    (v_org, 'terreno', 'Aquisição do Terreno', '#a16207'),
    (v_org, 'administrativo', 'Administrativo', '#6366f1'),
    (v_org, 'outros', 'Outros', '#94a3b8');
  insert into public.log (org_id, id, who, msg) values (v_org, public.gl_novo_id(), coalesce(p_usuario_nome, 'Dono'), 'Empresa criada: ' || trim(p_nome));
  return v_org;
end $$;

-- Entra numa empresa usando um código de convite (corretores e outros papéis).
create or replace function public.entrar_com_convite(p_codigo text, p_nome text default '', p_telefone text default '', p_creci text default '', p_imobiliaria text default '')
returns uuid language plpgsql security definer set search_path = public as $$
declare v_conv public.convites%rowtype; v_email text; v_membro_id uuid;
begin
  if auth.uid() is null then raise exception 'Não autenticado'; end if;
  select * into v_conv from public.convites where upper(codigo) = upper(trim(p_codigo)) for update;
  if not found then raise exception 'Código de convite inválido'; end if;
  if v_conv.expira_em is not null and v_conv.expira_em < now() then raise exception 'Este convite expirou'; end if;
  if v_conv.usos >= v_conv.max_usos then raise exception 'Este convite já atingiu o limite de usos'; end if;
  select email into v_email from auth.users where id = auth.uid();
  select id into v_membro_id from public.membros where org_id = v_conv.org_id and user_id = auth.uid();
  if v_membro_id is not null then
    update public.membros set ativo = true,
      nome = coalesce(nullif(trim(p_nome), ''), nome), telefone = coalesce(nullif(trim(p_telefone), ''), telefone),
      creci = coalesce(nullif(trim(p_creci), ''), creci), imobiliaria = coalesce(nullif(trim(p_imobiliaria), ''), imobiliaria)
      where id = v_membro_id;
  else
    insert into public.membros (org_id, user_id, papel, nome, telefone, creci, imobiliaria, email)
      values (v_conv.org_id, auth.uid(), v_conv.papel, coalesce(p_nome, ''), coalesce(p_telefone, ''), coalesce(p_creci, ''), coalesce(p_imobiliaria, ''), coalesce(v_email, ''));
    update public.convites set usos = usos + 1 where id = v_conv.id;
    insert into public.log (org_id, id, who, msg) values (v_conv.org_id, public.gl_novo_id(), coalesce(p_nome, ''), 'Novo membro (' || v_conv.papel || '): ' || coalesce(p_nome, v_email, ''));
  end if;
  return v_conv.org_id;
end $$;

-- Pedido de reserva feito por um corretor: cria a reserva e marca o lote
-- de forma atômica (dois corretores não conseguem reservar o mesmo lote).
create or replace function public.solicitar_reserva(p_org uuid, p_reserva jsonb)
returns text language plpgsql security definer set search_path = public as $$
declare v_lote public.lotes%rowtype; v_id text; v_membro public.membros%rowtype; v_dias integer;
begin
  select * into v_membro from public.membros where org_id = p_org and user_id = auth.uid() and ativo;
  if not found then raise exception 'Você não faz parte desta empresa'; end if;
  select * into v_lote from public.lotes where org_id = p_org and id = (p_reserva->>'lote_id') for update;
  if not found then raise exception 'Lote não encontrado'; end if;
  if v_lote.status <> 'disponivel' then raise exception 'Este lote não está mais disponível'; end if;
  v_id := coalesce(nullif(p_reserva->>'id', ''), public.gl_novo_id());
  select coalesce((config->>'reservaDias')::integer, 7) into v_dias from public.organizacoes where id = p_org;
  insert into public.reservas (org_id, id, loteamento_id, lote_id, corretor, corretor_user_id, cliente, data_reserva, validade, status, proposta, obs)
  values (p_org, v_id, v_lote.loteamento_id, v_lote.id,
          coalesce(p_reserva->'corretor', '{}'::jsonb) || jsonb_build_object('userId', auth.uid()),
          auth.uid(), coalesce(p_reserva->'cliente', '{}'::jsonb),
          current_date, current_date + v_dias, 'pendente', p_reserva->'proposta', coalesce(p_reserva->>'obs', ''));
  update public.lotes set status = 'reservado', reserva_id = v_id where org_id = p_org and id = v_lote.id;
  insert into public.log (org_id, id, who, msg) values (p_org, public.gl_novo_id(), coalesce(p_reserva->'corretor'->>'nome', v_membro.nome),
    'Reserva solicitada: Quadra ' || v_lote.quadra || ' · Lote ' || v_lote.numero || ' — cliente ' || coalesce(p_reserva->'cliente'->>'nome', ''));
  return v_id;
end $$;

-- Corretor cancela o próprio pedido enquanto ainda está pendente.
create or replace function public.cancelar_minha_reserva(p_org uuid, p_id text, p_motivo text default '')
returns void language plpgsql security definer set search_path = public as $$
declare v_res public.reservas%rowtype;
begin
  select * into v_res from public.reservas where org_id = p_org and id = p_id and corretor_user_id = auth.uid() for update;
  if not found then raise exception 'Reserva não encontrada'; end if;
  if v_res.status <> 'pendente' then raise exception 'Só é possível cancelar pedidos ainda pendentes'; end if;
  update public.reservas set status = 'cancelada', encerrada_em = now(), motivo = coalesce(p_motivo, '') where org_id = p_org and id = p_id;
  update public.lotes set status = 'disponivel', reserva_id = null where org_id = p_org and id = v_res.lote_id and reserva_id = p_id;
  insert into public.log (org_id, id, who, msg) values (p_org, public.gl_novo_id(), coalesce(v_res.corretor->>'nome', ''), 'Reserva cancelada pelo corretor — ' || coalesce(v_res.cliente->>'nome', ''));
end $$;

-- Corretor atualiza os próprios dados de perfil (nome, telefone, CRECI, imobiliária).
create or replace function public.atualizar_meu_perfil(p_org uuid, p_nome text, p_telefone text, p_creci text, p_imobiliaria text)
returns void language plpgsql security definer set search_path = public as $$
begin
  update public.membros set nome = coalesce(p_nome, nome), telefone = coalesce(p_telefone, telefone), creci = coalesce(p_creci, creci), imobiliaria = coalesce(p_imobiliaria, imobiliaria)
  where org_id = p_org and user_id = auth.uid();
end $$;

-- Apaga todos os dados operacionais da empresa (backup/importação e "apagar tudo"). Só dono/admin.
create or replace function public.limpar_dados_org(p_org uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.eh_admin(p_org) then raise exception 'Sem permissão'; end if;
  delete from public.recebiveis where org_id = p_org;
  delete from public.vendas where org_id = p_org;
  delete from public.reservas where org_id = p_org;
  delete from public.custos where org_id = p_org;
  delete from public.lotes where org_id = p_org;
  delete from public.leads where org_id = p_org;
  delete from public.indices where org_id = p_org;
  delete from public.cobrancas where org_id = p_org;
  delete from public.contas_banco where org_id = p_org;
  delete from public.vitrines where org_id = p_org;
  delete from public.loteamentos where org_id = p_org;
  delete from public.log where org_id = p_org;
end $$;

-- ---------------------------------------------------------------------
-- 4b. Índices de correção (IGP-M, INPC, IPCA, CUB…) e campos de correção
-- ---------------------------------------------------------------------
create table if not exists public.indices (
  org_id    uuid not null references public.organizacoes(id) on delete cascade,
  id        text not null,
  codigo    text not null,
  nome      text not null,
  tipo      text not null default 'percentual' check (tipo in ('percentual','pontos')),
  valores   jsonb not null default '{}'::jsonb,
  criado_em timestamptz not null default now(),
  primary key (org_id, id)
);
alter table public.indices enable row level security;
drop policy if exists indices_select on public.indices;
drop policy if exists indices_write on public.indices;
create policy indices_select on public.indices for select to authenticated using (public.eh_membro(org_id));
create policy indices_write on public.indices for all to authenticated using (public.eh_admin(org_id)) with check (public.eh_admin(org_id));

alter table public.vendas add column if not exists indice_id text;
alter table public.vendas add column if not exists indice_base text;
alter table public.recebiveis add column if not exists valor_corrigido double precision;

-- ---------------------------------------------------------------------
-- 4d. Conta de cobrança (convênio bancário da empresa)
-- ---------------------------------------------------------------------
create table if not exists public.contas_banco (
  org_id            uuid not null references public.organizacoes(id) on delete cascade,
  id                text not null,
  loteamento_id     text not null default '',
  banco             text not null default '001',
  carteira          text not null default '',
  variacao          text not null default '',
  agencia           text not null default '',
  agencia_dv        text not null default '',
  conta             text not null default '',
  conta_dv          text not null default '',
  convenio          text not null default '',
  nosso_numero_atual bigint not null default 1,
  remessa_seq       integer not null default 1,
  multa_pct         double precision not null default 0,
  juros_dia         double precision not null default 0,
  desconto_pct      double precision not null default 0,
  protesto_dias     integer not null default 0,
  baixa_dias        integer not null default 0,
  especie           text not null default 'DM',
  aceite            text not null default 'N',
  mensagem1         text not null default '',
  mensagem2         text not null default '',
  criado_em         timestamptz not null default now(),
  primary key (org_id, id)
);
alter table public.contas_banco enable row level security;
drop policy if exists contas_banco_select on public.contas_banco;
drop policy if exists contas_banco_write on public.contas_banco;
create policy contas_banco_select on public.contas_banco for select to authenticated using (public.eh_admin(org_id));
create policy contas_banco_write on public.contas_banco for all to authenticated using (public.eh_admin(org_id)) with check (public.eh_admin(org_id));

alter table public.recebiveis add column if not exists nosso_numero text;
alter table public.recebiveis add column if not exists remessa_em date;

-- ---------------------------------------------------------------------
-- 4c. Cobranças registradas (régua de inadimplência)
-- ---------------------------------------------------------------------
create table if not exists public.cobrancas (
  org_id        uuid not null references public.organizacoes(id) on delete cascade,
  id            text not null,
  venda_id      text not null,
  loteamento_id text not null default '',
  data          date not null default current_date,
  canal         text not null default 'whatsapp',
  faixa         text not null default '',
  dias          integer not null default 0,
  valor         double precision not null default 0,
  obs           text not null default '',
  quem          text not null default '',
  criado_em     timestamptz not null default now(),
  primary key (org_id, id)
);
create index if not exists cobrancas_venda_idx on public.cobrancas (org_id, venda_id);
alter table public.cobrancas enable row level security;
drop policy if exists cobrancas_select on public.cobrancas;
drop policy if exists cobrancas_write on public.cobrancas;
create policy cobrancas_select on public.cobrancas for select to authenticated using (public.eh_admin(org_id));
create policy cobrancas_write on public.cobrancas for all to authenticated using (public.eh_admin(org_id)) with check (public.eh_admin(org_id));

-- ---------------------------------------------------------------------
-- 5a. Modelos de documento (proposta e contrato da própria empresa)
-- ---------------------------------------------------------------------
create table if not exists public.modelos (
  org_id    uuid not null references public.organizacoes(id) on delete cascade,
  id        text not null,
  nome      text not null,
  tipo      text not null default 'contrato' check (tipo in ('proposta','contrato')),
  corpo     text not null default '',
  criado_em timestamptz not null default now(),
  primary key (org_id, id)
);
alter table public.modelos enable row level security;
drop policy if exists modelos_select on public.modelos;
drop policy if exists modelos_write on public.modelos;
create policy modelos_select on public.modelos for select to authenticated using (public.eh_membro(org_id));
create policy modelos_write on public.modelos for all to authenticated using (public.eh_admin(org_id)) with check (public.eh_admin(org_id));

-- ---------------------------------------------------------------------
-- 5b. Vitrine pública (link do loteamento para o cliente final) e leads
-- ---------------------------------------------------------------------
create table if not exists public.vitrines (
  org_id        uuid not null references public.organizacoes(id) on delete cascade,
  loteamento_id text not null,
  slug          text not null,
  ativa         boolean not null default true,
  mostrar_preco boolean not null default true,
  titulo        text not null default '',
  chamada       text not null default '',
  whatsapp      text not null default '',
  criado_em     timestamptz not null default now(),
  primary key (org_id, loteamento_id)
);
create unique index if not exists vitrines_slug_idx on public.vitrines (lower(slug));

create table if not exists public.leads (
  org_id        uuid not null references public.organizacoes(id) on delete cascade,
  id            text not null,
  loteamento_id text not null default '',
  lote_id       text,
  nome          text not null,
  telefone      text not null default '',
  email         text not null default '',
  msg           text not null default '',
  origem        text not null default 'vitrine',
  status        text not null default 'novo' check (status in ('novo','contatado','convertido','descartado')),
  obs           text not null default '',
  criado_em     timestamptz not null default now(),
  primary key (org_id, id)
);
create index if not exists leads_org_idx on public.leads (org_id, criado_em desc);

alter table public.vitrines enable row level security;
alter table public.leads    enable row level security;

drop policy if exists vitrines_select on public.vitrines;
drop policy if exists vitrines_write on public.vitrines;
create policy vitrines_select on public.vitrines for select to authenticated using (public.eh_membro(org_id));
create policy vitrines_write on public.vitrines for all to authenticated using (public.eh_admin(org_id)) with check (public.eh_admin(org_id));

-- leads: toda a equipe vê (corretor precisa atender), só admin altera
drop policy if exists leads_select on public.leads;
drop policy if exists leads_write on public.leads;
create policy leads_select on public.leads for select to authenticated using (public.eh_membro(org_id));
create policy leads_write on public.leads for all to authenticated using (public.eh_admin(org_id)) with check (public.eh_admin(org_id));

-- Dados públicos da vitrine (sem login). Devolve só o que o cliente final pode ver:
-- nunca matrícula, observações internas, reservas, vendas ou dados da equipe.
create or replace function public.vitrine_dados(p_slug text)
returns jsonb language plpgsql security definer stable set search_path = public as $$
declare v public.vitrines%rowtype; v_lot public.loteamentos%rowtype; v_org public.organizacoes%rowtype; v_lotes jsonb;
begin
  select * into v from public.vitrines where lower(slug) = lower(trim(coalesce(p_slug, ''))) and ativa;
  if not found then return null; end if;
  select * into v_lot from public.loteamentos where org_id = v.org_id and id = v.loteamento_id;
  if not found then return null; end if;
  select * into v_org from public.organizacoes where id = v.org_id;
  select coalesce(jsonb_agg(x order by x->>'quadra', lpad(regexp_replace(x->>'numero', '\D', '', 'g'), 6, '0'), x->>'numero'), '[]'::jsonb)
    into v_lotes
    from (
      select jsonb_build_object(
        'id', l.id, 'quadra', l.quadra, 'numero', l.numero, 'area', l.area,
        'frente', l.frente, 'fundos', l.fundos, 'tipo', l.tipo, 'pts', l.pts,
        'status', case when l.status = 'bloqueado' then 'indisponivel' else l.status end,
        'preco', case when v.mostrar_preco and l.status in ('disponivel', 'reservado') then l.preco else null end
      ) as x
      from public.lotes l where l.org_id = v.org_id and l.loteamento_id = v.loteamento_id
    ) t;
  return jsonb_build_object(
    'empresa', v_org.nome,
    'titulo', coalesce(nullif(v.titulo, ''), v_lot.nome),
    'chamada', v.chamada,
    'whatsapp', v.whatsapp,
    'mostrarPreco', v.mostrar_preco,
    'loteamento', jsonb_build_object('nome', v_lot.nome, 'cidade', v_lot.cidade, 'endereco', v_lot.endereco, 'descricao', v_lot.descricao, 'planta', v_lot.planta),
    'lotes', v_lotes);
end $$;

-- Interesse enviado pelo cliente final na vitrine (sem login).
create or replace function public.registrar_lead(p_slug text, p_dados jsonb)
returns text language plpgsql security definer set search_path = public as $$
declare v public.vitrines%rowtype; v_id text; v_n int; v_nome text; v_fone text;
begin
  select * into v from public.vitrines where lower(slug) = lower(trim(coalesce(p_slug, ''))) and ativa;
  if not found then raise exception 'Vitrine indisponível'; end if;
  v_nome := left(trim(coalesce(p_dados->>'nome', '')), 120);
  v_fone := left(trim(coalesce(p_dados->>'telefone', '')), 40);
  if v_nome = '' or v_fone = '' then raise exception 'Informe nome e telefone'; end if;
  select count(*)::int into v_n from public.leads where org_id = v.org_id and criado_em > now() - interval '1 hour';
  if v_n >= 120 then raise exception 'Muitas solicitações no momento. Tente novamente mais tarde.'; end if;
  if exists (select 1 from public.leads where org_id = v.org_id and telefone = v_fone and criado_em > now() - interval '2 minutes') then
    return 'duplicado';
  end if;
  v_id := public.gl_novo_id();
  insert into public.leads (org_id, id, loteamento_id, lote_id, nome, telefone, email, msg, origem)
    values (v.org_id, v_id, v.loteamento_id, nullif(trim(coalesce(p_dados->>'loteId', '')), ''), v_nome, v_fone,
            left(trim(coalesce(p_dados->>'email', '')), 160), left(trim(coalesce(p_dados->>'msg', '')), 600), 'vitrine');
  insert into public.log (org_id, id, who, msg)
    values (v.org_id, public.gl_novo_id(), 'Vitrine', 'Novo interesse de ' || v_nome);
  return v_id;
end $$;

-- ---------------------------------------------------------------------
-- 6. Permissões de execução
-- ---------------------------------------------------------------------
grant usage on schema public to authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant execute on all functions in schema public to authenticated;
revoke all on all tables in schema public from anon;

-- o visitante anônimo (vitrine pública) só pode chamar estas duas funções
grant usage on schema public to anon;
grant execute on function public.vitrine_dados(text) to anon;
grant execute on function public.registrar_lead(text, jsonb) to anon;

-- ---------------------------------------------------------------------
-- 7. Tempo real (Supabase Realtime) e Storage (imagem da planta)
-- ---------------------------------------------------------------------
do $$
declare t text;
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    foreach t in array array['organizacoes','membros','loteamentos','categorias','lotes','reservas','vendas','recebiveis','custos','log','vitrines','leads','modelos','indices','cobrancas','contas_banco'] loop
      if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t) then
        execute format('alter publication supabase_realtime add table public.%I', t);
      end if;
    end loop;
  end if;
end $$;

-- linhas completas nos eventos de tempo real (necessário para DELETE trazer org_id)
alter table public.lotes replica identity full;
alter table public.reservas replica identity full;
alter table public.vendas replica identity full;
alter table public.recebiveis replica identity full;
alter table public.leads replica identity full;
alter table public.custos replica identity full;
alter table public.loteamentos replica identity full;
alter table public.categorias replica identity full;
alter table public.log replica identity full;
alter table public.membros replica identity full;

do $$
begin
  if to_regclass('storage.buckets') is not null then
    insert into storage.buckets (id, name, public) values ('plantas', 'plantas', true) on conflict (id) do nothing;
    execute 'drop policy if exists plantas_leitura on storage.objects';
    execute 'drop policy if exists plantas_escrita on storage.objects';
    execute 'drop policy if exists plantas_update on storage.objects';
    execute 'drop policy if exists plantas_delete on storage.objects';
    execute $p$create policy plantas_leitura on storage.objects for select using (bucket_id = 'plantas')$p$;
    execute $p$create policy plantas_escrita on storage.objects for insert to authenticated with check (bucket_id = 'plantas' and public.eh_admin(((storage.foldername(name))[1])::uuid))$p$;
    execute $p$create policy plantas_update on storage.objects for update to authenticated using (bucket_id = 'plantas' and public.eh_admin(((storage.foldername(name))[1])::uuid))$p$;
    execute $p$create policy plantas_delete on storage.objects for delete to authenticated using (bucket_id = 'plantas' and public.eh_admin(((storage.foldername(name))[1])::uuid))$p$;
  end if;
end $$;
