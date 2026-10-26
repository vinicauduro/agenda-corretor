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

-- Rascunho inicial (só entra se o tema ainda não existir; não sobrescreve
-- o que já foi revisado). Texto completo para revisão em whatsapp/base-de-respostas.md.
insert into public.base_respostas (tema, ordem, conteudo) values
('Sobre a Cocal', 1,
'A Cocal Imóveis LTDA atua desde 1994 [CONFIRMAR] em Cocal do Sul e região (Sul de Santa Catarina), com compra, venda, locação e troca de imóveis. Também temos incorporadora, com empreendimentos próprios. CRECI 1629.'),
('Endereço e contato', 2,
'Matriz: Av. Polidoro Santiago, 419, Centro, Cocal do Sul/SC. Filial: Jaguaruna/SC [CONFIRMAR endereço]. Telefone: (48) 3447-6251. E-mail: atendimento@cocalimoveis.com.br. Site com todos os imóveis: www.cocalimoveis.com.br'),
('Horário de atendimento', 3,
'Segunda a sexta, das 8h às 12h e das 13h30 às 18h; sábado, das 8h às 12h [CONFIRMAR]. Fora desse horário o assistente virtual registra o pedido e um corretor retorna no próximo horário de atendimento.'),
('Como funciona a locação', 4,
'1) O cliente escolhe o imóvel e agenda a visita com um corretor. 2) Preenche a ficha cadastral e envia os documentos. 3) A Cocal faz a análise cadastral, que leva em média [CONFIRMAR] dias úteis. 4) Aprovado o cadastro, é escolhida a garantia e o contrato é assinado. 5) Entrega das chaves após a vistoria de entrada. O contrato residencial costuma ser de 30 meses [CONFIRMAR]. O aluguel é reajustado uma vez por ano pelo índice previsto no contrato.'),
('Garantias aceitas na locação', 5,
'Aceitamos [CONFIRMAR quais]: fiador com imóvel quitado na região; seguro-fiança; título de capitalização; caução (depósito de até 3 aluguéis, conforme a lei). A garantia é definida na análise cadastral.'),
('Documentos para alugar', 6,
'Inquilino (pessoa física): RG e CPF (ou CNH), comprovante de estado civil, comprovante de residência atual e comprovantes de renda dos últimos 3 meses (contracheque, extrato ou declaração de imposto de renda). A renda costuma precisar ser de cerca de 3 vezes o valor do aluguel [CONFIRMAR]. Pessoa jurídica: contrato social e alterações, cartão CNPJ e documentos dos sócios. Fiador: os mesmos documentos do inquilino, mais a matrícula atualizada do imóvel quitado [CONFIRMAR].'),
('Documentos para comprar', 7,
'Para dar início à compra: RG e CPF (ou CNH), comprovante de estado civil (certidão de casamento, se for o caso) e comprovante de residência. Em financiamento, o banco pede também comprovantes de renda e extrato do FGTS, se for usar. O corretor orienta cada caso.'),
('Formas de pagamento na compra', 8,
'Trabalhamos com pagamento à vista, financiamento bancário, uso do FGTS, consórcio e, em alguns imóveis, parcelamento direto ou permuta. As condições de cada imóvel são confirmadas pelo corretor.'),
('Quero vender ou alugar meu imóvel', 9,
'Para anunciar um imóvel com a Cocal, um corretor faz a avaliação e explica as condições de intermediação ou administração. O assistente registra os dados (tipo, endereço/bairro e se é venda ou locação) e passa para um corretor.')
on conflict (tema) do nothing;

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
