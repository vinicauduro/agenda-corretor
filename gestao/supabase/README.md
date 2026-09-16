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

## Inadimplência e régua de cobrança

Na aba **Recebíveis**, o chip **🔔 Cobrança** abre o painel de inadimplência. Ele agrupa o
atraso por contrato, não por parcela, e mostra quanto está em atraso, o percentual da carteira,
o que foi recuperado no mês e quantos clientes ainda não foram cobrados. As faixas de 1-15,
16-30, 31-60, 61-90 e mais de 90 dias filtram a lista.

Cada contrato traz o valor já atualizado com multa e juros, a parcela mais antiga, a última
cobrança feita e botões para cobrar, abrir o contrato ou propor um acordo pela tela de
antecipação.

A **régua** fica em **Cadastros › 🔔 Cobrança**: cada etapa tem os dias de atraso e o texto da
mensagem, com campos como `{{primeiroNome}}`, `{{lote}}`, `{{valor}}`, `{{dias}}` e `{{pix}}`.
Na hora de cobrar, o sistema escolhe a etapa pelos dias de atraso, monta a mensagem, abre o
WhatsApp e registra o contato. Todo contato fica no histórico do contrato, com canal,
observação e quem cobrou.

## Antecipação e quitação

Na tela da venda, o botão **💸 Antecipar / quitar** calcula quanto o cliente paga para
antecipar parcelas ou quitar o contrato. As parcelas futuras são trazidas a valor presente
pela mesma taxa de juros do contrato, o que devolve exatamente o **saldo devedor** da tabela
de amortização: sai apenas o juro dos meses que o cliente não vai usar, nunca mais do que
isso. A tela traz a tabela de amortização aberta, com juro do mês, amortização e saldo, para
conferência.

O cálculo é por **mês fechado**, igual à cobrança de juros e à correção por índice: antecipar
no dia 1 ou no dia 28 do mesmo mês dá o mesmo valor. Parcelas já vencidas entram pelo valor
cheio, com multa e juros de mora.

A tela mostra quanto custa quitar em cada um dos próximos doze meses, e permite três
operações: quitar o contrato inteiro, antecipar as últimas parcelas (que é onde o desconto é
maior) ou amortizar um valor livre, reduzindo o prazo ou o valor das parcelas. Há também um
demonstrativo para imprimir e um resumo pronto para mandar por WhatsApp.

Contrato sem juros não gera desconto: nesse caso o cliente paga o valor das parcelas.

## Índices de correção

Em **Cadastros › 📈 Índices** ficam o IGP-M, INPC, IPCA, CUB e qualquer outro que você use.
Você lança a variação de cada mês (ou o valor em pontos, no caso do CUB) e o sistema avisa
quando falta lançar o mês corrente.

A correção é **mensal e defasada em um mês**, do jeito que o mercado trabalha: o índice de um
mês só é divulgado no mês seguinte, então a parcela de setembro é corrigida pelo índice de
agosto, a de outubro pelo de setembro e assim por diante. Dentro do mês vale para todas as
parcelas, qualquer que seja o dia do vencimento. Cada contrato escolhe o índice e o mês base
na tela da venda: o índice do mês base é o primeiro a ser aplicado, já na parcela do mês
seguinte.

Regras do cálculo:

- **Deflação não reduz parcela.** Mês negativo fica registrado no índice, mas entra como 0%
  nos contratos, para preservar o equilíbrio do negócio.
- **Parcela vencida congela.** A correção vai até o índice do mês anterior ao vencimento.
  Depois disso a parcela responde só por multa e juros de mora, calculados sobre o valor já
  corrigido.
- **Parcela paga congela** o valor pago, mesmo que o índice daquele mês mude depois.
- **A entrada nunca é corrigida.**
- Mês sem lançamento não corrige, e o sistema mostra quantos meses faltam lançar.

O valor base e a correção aparecem lado a lado nos recebíveis, na tela da venda, no extrato e
no CSV. Os juros de mora e a multa por atraso continuam sendo calculados à parte, sobre o
valor já corrigido.

## Documentos (proposta e contrato)

O texto é da empresa, não do sistema. Em **Cadastros › 📄 Documentos** você cola a proposta
e o contrato que já usa e marca as partes que mudam a cada negócio com os campos do sistema
(`{{cliente.nome}}`, `{{lote.identificacao}}`, `{{pagamento.resumo}}` e assim por diante).
Qualquer campo inventado, por exemplo `{{foro}}`, vira um preenchimento na hora de gerar.

- O corretor gera a **proposta** pelo lote, com simulação de entrada, parcelas, juros e
  reforço anual, e envia por WhatsApp ou PDF.
- O administrador gera o **contrato** pela venda, com os valores e as parcelas já preenchidos.
- A prévia é editável antes de imprimir ou salvar em PDF.
- Os dados da empresa usados nos documentos ficam em **Cadastros › Configurações**.

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

## Permissões por função

O **papel** define o que o banco libera: dono e administrador veem tudo da empresa, financeiro
tem acesso administrativo, corretor só enxerga o que é dele. Isso é aplicado pelo próprio
banco, então vale mesmo para quem tentar acessar por fora do aplicativo.

Dentro do papel, em **Cadastros › 🔐 Permissões**, o dono afina o que cada função vê e pode
fazer no aplicativo: editar lotes e planta, aprovar reservas, registrar vendas, dar distrato,
baixar pagamentos, antecipar contratos, lançar custos, cobrar, editar modelos e índices,
publicar a vitrine, gerenciar a equipe, alterar configurações e usar o backup.

As abas sem permissão somem do topo, as telas bloqueadas mostram um aviso e as ações são
recusadas mesmo se alguém tentar forçar. O dono sempre pode tudo, e o padrão de cada papel
volta com um clique.

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
