# Gestão de Loteamento — configuração da nuvem (Supabase)

Com a nuvem ativa o app passa a ter login por usuário, empresas (uma por incorporadora),
papéis (dono, administrador, financeiro, corretor), convites por link, dados compartilhados
em tempo real e a imagem da planta guardada no Storage.

Sem a nuvem (chave vazia em `gestao/config.js`) o app continua funcionando no modo local,
com PIN do administrador e dados só no navegador.

## Passo a passo (uma vez só)

1. **Criar o projeto** em https://supabase.com (região *South America (São Paulo)*).
   Guarde a senha do banco.

2. **Criar as tabelas.** No painel do projeto abra **SQL Editor › New query**, cole o
   conteúdo inteiro de `gestao/supabase/schema.sql` e clique em **Run**. Pode rodar de novo
   sempre que o arquivo for atualizado (ele é idempotente).

3. **Autenticação.** Em **Authentication › Providers › Email** deixe *Email* ativado.
   - Para começar sem confirmação de e-mail (mais simples), desative *Confirm email*.
     Com a confirmação ativada, o usuário recebe um link antes de conseguir entrar.
   - Em **Authentication › URL Configuration** defina:
     - *Site URL*: `https://vinicauduro.github.io/agenda-corretor/gestao/`
     - *Redirect URLs*: a mesma URL acima (e `http://localhost:8765/gestao/` se for testar local).

4. **Chaves.** Em **Project Settings › API** copie a *Project URL* e a chave **anon public**
   e preencha `gestao/config.js`:

   ```js
   window.GL_CONFIG = {
     supabaseUrl: 'https://SEU-PROJETO.supabase.co',
     supabaseAnonKey: 'eyJ...'
   };
   ```

   A chave *anon* é pública por natureza (fica no navegador de todo usuário); o que protege
   os dados são as políticas de acesso (RLS) criadas pelo `schema.sql`.
   **Nunca** coloque a chave `service_role` no app.

5. **Publicar.** Faça commit e push; o GitHub Pages atualiza o site.

## Primeiro uso

1. Abra o app, clique em **Criar conta**, informe nome, e-mail e senha.
2. Em seguida, **Criar minha empresa**. Você vira o *dono*.
3. Cadastre o loteamento e os lotes normalmente.
4. Em **Cadastros › Equipe › ＋ Convite** gere um link e envie aos corretores. Quem abrir o
   link cria a conta (ou entra) e já fica vinculado à sua empresa como corretor.

## Vitrine pública (link do loteamento para o cliente final)

A vitrine é uma página aberta, **sem login**, com a planta e os lotes à venda, para mandar
por WhatsApp, colocar no Instagram ou no anúncio. Quem se interessa preenche um formulário
curto e aparece na aba **Leads** da administração, em tempo real.

1. Em **Cadastros › 🌐 Vitrine**, escolha o endereço do link, a chamada de vendas, o
   WhatsApp de atendimento e se os preços aparecem.
2. Clique em **Publicar vitrine** e copie o link (algo como
   `https://vinicauduro.github.io/agenda-corretor/gestao/vitrine.html?l=residencial-hessen`).
3. Os interessados caem na aba **🎯 Leads**, com botão de WhatsApp já com a mensagem pronta
   e a opção **Criar reserva**, que abre a reserva com os dados do cliente preenchidos.

O visitante vê apenas quadra, número, área, medidas, situação e (se você quiser) o preço.
Matrícula, observações internas, reservas, vendas, custos e dados da equipe **nunca** saem
pela vitrine: o banco devolve só esses campos, por uma função específica.
Desmarcar **Vitrine no ar** derruba o link na hora.

## O que cada papel vê

| Papel        | Planta e lotes | Reservas                | Vendas            | Recebíveis e custos | Equipe/config |
|--------------|----------------|-------------------------|-------------------|---------------------|---------------|
| Dono / Admin | tudo           | todas                   | todas             | sim                 | sim           |
| Financeiro   | tudo           | todas                   | todas             | sim                 | sim           |
| Corretor     | vê e reserva   | só as próprias          | só as próprias    | não                 | não           |

Os leads da vitrine são visíveis para toda a equipe (o corretor precisa atender), mas só
administradores alteram ou excluem.

As regras valem no banco (RLS), não só na tela: mesmo alguém usando a API direto só
enxerga o que o papel permite. O pedido de reserva do corretor passa por uma função do banco
que trava o lote, impedindo dois corretores de reservar o mesmo lote ao mesmo tempo.

## Claude Code + MCP do Supabase (opcional)

O arquivo `.mcp.json` na raiz do repositório já aponta para o servidor MCP do projeto.
No seu computador, dentro da pasta do repositório, rode `claude` e depois `/mcp` para
autenticar no Supabase. A partir daí o Claude consegue consultar e alterar o banco por você.

## Manutenção

- **Backup**: além do backup em JSON do app, o Supabase mantém backups diários no plano pago.
- **Atualizar o esquema**: edite `schema.sql` e rode de novo no SQL Editor. Sempre que o app
  ganhar recursos novos (como a vitrine pública), rode o arquivo inteiro outra vez — ele é
  idempotente e não apaga nada.
- **Limites do plano gratuito**: 500 MB de banco, 1 GB de Storage, 50 mil usuários ativos por
  mês. Mais que suficiente para dezenas de loteamentos.
