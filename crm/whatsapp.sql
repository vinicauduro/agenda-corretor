-- =====================================================================
--  Assistente virtual do WhatsApp (Cocal Imóveis) — tabelas do agente
--  Rode DEPOIS do crm/schema.sql, no mesmo projeto Supabase do CRM.
--  Cole este arquivo inteiro no SQL Editor e execute.
--  Pode ser executado mais de uma vez (idempotente; não apaga nada).
--
--  Nenhuma destas tabelas é acessada pelo app: só as funções do agente
--  (supabase/functions), que usam a chave de serviço, leem e gravam aqui.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Catálogo de imóveis, copiado do XML do site (ImobiBrasil).
--    A função importar-imoveis atualiza esta tabela; imóvel que sai do
--    XML fica com ativo = false (o agente só oferece os ativos).
--    Os campos *_busca guardam o texto sem acento e em minúsculas.
-- ---------------------------------------------------------------------
create table if not exists public.imoveis (
  codigo         text primary key,
  referencia     text not null default '',
  titulo         text not null default '',
  tipo           text not null default '',
  finalidade     text not null default 'venda' check (finalidade in ('venda','locacao','ambos')),
  cidade         text not null default '',
  bairro         text not null default '',
  valor_venda    numeric(14,2),
  valor_locacao  numeric(14,2),
  condominio     numeric(14,2),
  iptu           numeric(14,2),
  dormitorios    integer,
  suites         integer,
  banheiros      integer,
  vagas          integer,
  area_util      numeric(12,2),
  area_total     numeric(12,2),
  descricao      text not null default '',
  url            text not null default '',
  fotos          text[] not null default '{}',
  tipo_busca     text not null default '',
  cidade_busca   text not null default '',
  bairro_busca   text not null default '',
  ativo          boolean not null default true,
  atualizado_em  timestamptz not null default now()
);
create index if not exists imoveis_ativo_idx on public.imoveis (ativo, finalidade);

-- ---------------------------------------------------------------------
-- 2. Conversas do WhatsApp (uma por telefone) e histórico de mensagens.
--    modo 'humano': um corretor está atendendo e o agente fica calado
--    até humano_ate (cada mensagem do corretor estende o prazo).
-- ---------------------------------------------------------------------
create table if not exists public.wa_conversas (
  telefone       text primary key,
  nome           text not null default '',
  lead_id        text,
  modo           text not null default 'agente' check (modo in ('agente','humano')),
  humano_ate     timestamptz,
  motivo_humano  text not null default '',
  criado_em      timestamptz not null default now(),
  atualizado_em  timestamptz not null default now()
);

create table if not exists public.wa_mensagens (
  id             bigint generated always as identity primary key,
  telefone       text not null references public.wa_conversas(telefone) on delete cascade,
  autor          text not null check (autor in ('cliente','agente','equipe')),
  texto          text not null default '',
  wa_id          text unique,
  criado_em      timestamptz not null default now()
);
create index if not exists wa_mensagens_conversa_idx on public.wa_mensagens (telefone, id);

-- ---------------------------------------------------------------------
-- 3. Base de respostas aprovadas. O agente só usa as linhas com
--    aprovado = true. Para aprovar ou corrigir: Table Editor › base_respostas.
-- ---------------------------------------------------------------------
create table if not exists public.base_respostas (
  tema           text primary key,
  conteudo       text not null default '',
  aprovado       boolean not null default false,
  ordem          integer not null default 0,
  atualizado_em  timestamptz not null default now()
);

-- O conteúdo (aprovado pela Cocal) está em whatsapp/base-de-respostas.sql.

-- ---------------------------------------------------------------------
-- 4. Segurança: nada disso é visível para o app ou para visitantes.
--    As funções do agente usam a chave de serviço, que ignora o RLS.
-- ---------------------------------------------------------------------
alter table public.imoveis        enable row level security;
alter table public.wa_conversas   enable row level security;
alter table public.wa_mensagens   enable row level security;
alter table public.base_respostas enable row level security;
revoke all on public.imoveis, public.wa_conversas, public.wa_mensagens, public.base_respostas
  from anon, authenticated;
