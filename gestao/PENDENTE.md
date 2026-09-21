# Pendências para testar no computador

Lista do que foi construído e ainda não foi testado por você, mais as decisões que dependem da
sua conferência. Atualizada em 17/09/2026, depois da revisão de segurança e da separação do perfil financeiro.

---

## 0. Antes de tudo

- [x] ~~Rodar o `schema.sql`~~ — feito por você em 17/09, já com a separação do perfil
      financeiro e os convites novos.
- [ ] **Rodar o `schema.sql` de novo.** Acumulou o seguinte desde aquela execução: a limpeza
      de dados passou a apagar também categorias e modelos (antes sobrava resto ao importar
      backup), a semente de categorias já vem dividida, os juros da conta bancária ganharam
      coluna em % ao mês, e agora entrou a **tabela de vendedores** e as colunas de
      qualificação do imóvel (descrição da matrícula, endereço do lote, cartório, código
      IBGE). Esta última é necessária: sem rodar, o cadastro de vendedores não sincroniza.
- [ ] Abrir o app e forçar a atualização (Ctrl+Shift+R no computador) para pegar a versão nova.
      Endereço: https://vinicauduro.github.io/agenda-corretor/gestao/
- [ ] Conferir a barra nova: **Painel · 🏗️ Empreendimentos · Vendas · Recebíveis ·
      Relatórios · Cadastros**. Planta, lotes, reservas, obra e leads agora ficam dentro do
      empreendimento; em Cadastros estão Equipe, Permissões, Categorias, Documentos, Índices,
      Cobrança, Banco, Vitrine, Configurações, Nuvem e Backup — mais **Vendedores**, novo.

---

## 1. Planta em DXF e lotes manuais

- [ ] Importar o DXF do Hessen e conferir se a planta ficou bonita e alinhada.
- [ ] Testar o botão **＋ Lote** para criar um lote que a detecção não pegou, desenhando o
      retângulo sobre a planta.
- [ ] Testar o filtro **Só lotes sem posição** no seletor de lotes.
      (Tudo isso agora fica em **Empreendimentos › abra o loteamento › Planta / Lotes**.)
- [ ] Em "Rotação e camadas do desenho (avançado)", testar ligar e desligar camadas.

**Decidido em 17/09: vale o PDF.** O DXF era outra revisão. Você vai mandar a planta nova
nos próximos dias, com as alterações do loteamento — quando chegar, eu reimporto.

---

## 2. Nuvem, equipe e corretores

- [ ] Criar conta, criar a empresa e entrar como dono.
- [ ] Gerar um convite em Cadastros › Equipe e testar em outro celular ou janela anônima.
- [ ] Conferir que o corretor vê a planta e os preços, mas não vê recebíveis, custos nem as
      reservas dos outros.
- [ ] Testar a reserva pelo corretor e a aprovação por você.

---

## 3. Documentos: proposta e contrato

- [ ] Preencher **Cadastros › Configurações › Dados da empresa para documentos**: CNPJ,
      endereço, cidade do foro, quem assina e CPF de quem assina.
- [ ] Em **Cadastros › Documentos**, colar o **seu** contrato de promessa de compra e venda no
      lugar do modelo de exemplo, marcando as partes variáveis com os campos da paleta.
- [ ] Fazer o mesmo com a **sua** proposta.
- [ ] Usar o botão **Ver exemplo** para conferir o texto preenchido antes de salvar.
- [ ] Como corretor, abrir um lote e gerar uma **proposta**, testando entrada, parcelas, juros
      e reforço anual. Conferir o PDF e o envio por WhatsApp.
- [ ] Em uma venda, gerar o **contrato** e conferir os valores, as parcelas e o texto por extenso.
- [ ] Testar a edição da prévia antes de imprimir.

**Observação:** campos que você inventar no modelo, como `{{foro}}`, viram preenchimento na
hora de gerar e ficam guardados para a próxima.

---

## 4. Índices de correção

- [ ] Em **Cadastros › Índices**, criar IGP-M, INPC, IPCA e CUB.
- [ ] Lançar alguns meses de histórico, de preferência colando a lista de uma planilha.
- [ ] Escolher o índice e o mês base em uma venda.
- [ ] Conferir nos recebíveis se o valor corrigido bate com a sua planilha.

**Regras aplicadas, confirmar se estão certas:**

- A parcela de setembro corrige pelo índice de agosto, porque o índice sai no mês seguinte.
- Mês negativo entra como 0%, a correção não reduz parcela.
- Parcela vencida congela e passa a responder só por multa e juros.
- Parcela paga congela o valor pago.
- A entrada nunca é corrigida.

**Decidido em 17/09: o índice atrasado vale, mas com aviso.** Se a loteadora esqueceu de
lançar, ela pode lançar depois e o valor da parcela em aberto muda. O que o índice alcança não
mudou: cada parcela é corrigida pelos índices até o mês anterior ao vencimento dela, e só isso.

- A parcela de novembro usa o índice de **outubro**. Lançar o índice de novembro depois não
  mexe nela, nem que esteja vencida — vencida só toma multa e juros.
- Parcela paga fica quitada, sem diferença a cobrar.
- O saldo em aberto segue corrigido mês a mês, porque cada parcela futura carrega o índice
  acumulado até o vencimento dela.

**O que foi construído:** ao lançar, editar ou apagar o índice de um mês que já passou, o
sistema mostra antes de salvar **o que muda, de quanto para quanto**, contrato por contrato,
com o total da diferença. Quem já pagou aparece numa lista à parte, com o aviso de que não
muda e quanto deixou de ser cobrado. Se o lançamento não mexe em parcela nenhuma, salva direto.

- [ ] Testar: lance um mês antigo de propósito e confira a tela de diferença.
- [ ] Lembrar que, se a parcela já virou boleto, o boleto precisa ser refeito.

---

## 5. Antecipação e quitação

- [ ] Abrir uma venda e clicar em **💸 Antecipar / quitar**.
- [ ] Conferir a tabela **Saldo devedor mês a mês** contra a sua planilha.
- [ ] Abrir a **tabela de amortização** e conferir juro do mês, amortização e saldo.
- [ ] Testar as três operações: quitar tudo, antecipar as últimas parcelas e amortizar um valor
      livre, nos dois modos, reduzindo prazo e reduzindo parcela.
- [ ] Imprimir o demonstrativo e conferir se está apresentável para o cliente.

**Decidido em 17/09:** o desconto é exatamente o juro cobrado no contrato, sobre os meses que
o cliente não usou. É o que já está implementado. Sem taxa de antecipação e sem teto.

---

## 6. Inadimplência e cobrança

- [ ] Preencher a **chave PIX** em Cadastros › Cobrança.
- [ ] Revisar os cinco textos da régua e ajustar ao seu tom.
- [ ] Abrir o painel pelo chip **🔔 Cobrança** na aba Recebíveis.
- [ ] Testar uma cobrança de verdade: escolher etapa, editar a mensagem, abrir o WhatsApp e ver
      o registro aparecer no histórico.
- [ ] Conferir o CSV da inadimplência.

---

## 7. Vitrine pública e leads

- [ ] Publicar a vitrine do Hessen em Cadastros › Vitrine e abrir o link no celular.
- [ ] Mandar um interesse de teste e ver chegar na aba Leads.
- [x] ~~Decidir se os preços aparecem~~ — **decidido em 17/09: "valor sob consulta"**. A
      vitrine já nasce assim, e o preço nem sai do banco para quem não tem login. Se um dia
      quiser mostrar, é um seletor em Cadastros › Vitrine.

**Combinado:** a aba Leads fica em segundo plano. Existe e funciona, mas não é prioridade.

---

## 7b. Permissões por função

- [ ] Em **Cadastros › 🔐 Permissões**, revisar o que cada papel pode.
- [ ] Convidar alguém como financeiro e conferir que ele vê recebíveis, despesas, cobrança e
      vendas, mas não vê reservas nem consegue editar lote.
- [ ] Com o financeiro logado, tentar mudar o preço de um lote (Empreendimentos › o
      loteamento › Lotes): tem que dar recusa vinda do banco, não só sumir o botão.
- [ ] Testar desmarcar uma permissão e ver a aba sumir para quem tem aquele papel.
- [ ] Gerar um convite e conferir as novas opções de validade e de quantas pessoas podem usar.

---

## 7b2. Categorias de custo divididas

As categorias padrão que juntavam dois assuntos foram separadas. Ao abrir o app, quem já tinha
as antigas recebe a divisão sozinho, e fica registrado no histórico.

| Antes | Agora |
|---|---|
| Água e Esgoto | Água · Esgoto |
| Pavimentação e Drenagem | Pavimentação · Drenagem |
| Documentação e Cartório | Documentação · Cartório |
| Projetos e Licenças | Projetos · Licenças |
| Impostos e Taxas | Impostos · Taxas |
| Marketing e Vendas | Marketing · Vendas |
| Rede Elétrica / Iluminação | continua junta, como você pediu |

- [ ] **Redistribuir o orçamento.** O valor orçado ficou inteiro na primeira das duas: os
      R$ 1.065.418,00 de Água e Esgoto estão todos em **Água**, e Esgoto está zerado. O sistema
      não chuta rateio. Abra Custos › ✏️ e divida do seu jeito. Vale o mesmo para as outras.
- [ ] Conferir se algum lançamento antigo precisa trocar de categoria (o que estava em Água e
      Esgoto foi todo para Água).
- [ ] Categoria que você mesmo criou ou renomeou não foi tocada.

---

## 7c. Relatórios

- [ ] Abrir a aba **📊 Relatórios** e passar pelos sete: resumo gerencial, espelho de vendas,
      vendas, contas a receber, inadimplência, comissões e despesas.
- [ ] No de despesas, testar os filtros de categoria, fornecedor, situação e data considerada,
      além dos agrupamentos por categoria, fornecedor, mês e lote.
- [ ] Conferir o comparativo de orçado contra realizado.
- [ ] Imprimir um relatório em PDF e conferir se está apresentável.
- [ ] Exportar um CSV e abrir na planilha.

---

## 7d. Cobrança bancária: fluxo mensal, remessa e retorno do Banco do Brasil

**Pronto e conferido contra os seus arquivos** (17/09). Layout CNAB 400, carteira 17, variação
035, convênio de 7 dígitos, conferido posição a posição contra a remessa real; código de barras
e linha digitável idênticos ao boleto impresso.

### Como funciona, no formato do seu ERP

- **Recebíveis › 🧾 Gerar cobranças** — escolhe o mês. Três cartões: **contratos sem índice do
  mês** (o nosso substituto do "contratos a reajustar": lista quem está esperando índice e
  fica de fora até você lançar), **já geradas no mês** e **prontas para gerar**. Botão
  **Simular** imprime o resumo agrupado por cliente sem gerar nada; **Gerar agora** registra as
  parcelas, numera o nosso número e baixa o arquivo de remessa.
- **Aviso no topo da lista** — qualquer cobrança alterada depois de registrada no banco
  (vencimento, valor, índice lançado depois, paga por fora, distrato) aparece como "marcada
  para remessa" até você gerar. A remessa de alteração baixa o título antigo e registra um
  novo; a de pagamento por fora só baixa.
- **📥 Retorno** — lê o arquivo, mostra o que entendeu e só dá baixa depois da confirmação.
- **Cadastros › 🏦 Banco** — convênio, carteira, instruções padrão (multa, juros ao dia,
  desconto, protesto, baixa, mensagens) e histórico de remessas. Multa é por conta e pode ser
  zero: com zero, o registro de multa nem sai no arquivo.

### As posições 23-25 do registro de multa — resolvido

Você tinha razão em não aceitar cópia sem entender. Investiguei em fonte independente: o
gerador de remessa BB de uma biblioteca de código aberto usada em produção (laravel-boleto)
monta o registro de multa como `5` + `99` + código + data + percentual em 011-022, e **brancos
de 023 a 394**. O `090` do seu arquivo é preenchimento do ERP antigo, não campo do banco.
O sistema agora manda brancos, como o layout define.

Pela mesma fonte confirmei as posições do **retorno** (valor recebido 254-266, crédito
176-181, tarifa 182-188, mora 267-279, multa 280-292, motivo da recusa 383-392), que eu tinha
escrito de memória com erro de uma posição em alguns campos.

- [ ] Rodar o `schema.sql` (entraram `remessas` e as colunas `banco_valor`/`banco_venc`).
- [ ] Ajustar a **multa** em Cadastros › Banco (o arquivo atual é de aluguel, 10%).
- [ ] **Escolher a faixa do nosso número — corrigido em 17/09.** Eu tinha dito "comece em
      2637". **Estava errado**: 2636 era só o maior número da única remessa que você mandou, de
      02/09. O boleto que você enviou tem nosso número **1819** e foi processado em 17/09, ou
      seja, *depois* — a numeração do seu ERP não segue ordem de emissão. E a remessa de 02/09
      tem 23 títulos espalhados de 2450 a 2636, com 164 buracos: o Superlógica reserva o número
      quando a cobrança é criada (é o "id interno" que aparece na tela), não quando vai ao banco.

      Conclusão: **não dá para saber onde o sistema antigo está**, e ele continua consumindo
      números enquanto os dois rodarem. Em vez de continuar a contagem, **comece numa faixa
      separada e bem alta — 1000000**. São 10 dígitos disponíveis, quase 10 bilhões: os dois
      nunca se encontram. Se quiser conferir o que já existe no banco, o Gerenciador Financeiro
      tem a relação de títulos em ser, mas ela não mostra os já baixados, então não serve como
      garantia — a faixa separada serve.
- [ ] Gerar uma remessa de teste com poucos títulos e mandar pelo Gerenciador Financeiro.
- [x] ~~Me mandar um retorno com movimento~~ — **feito em 17/09**, três arquivos (08, 09 e
      10/09) com 14 liquidações e uma entrada confirmada. A leitura foi conferida campo a campo
      contra eles: ocorrência, datas, vencimento, valor do título, valor recebido, juros, multa,
      tarifa e data do crédito. Um teste roda em cima dos arquivos de verdade a cada mudança.

      O que os arquivos ensinaram, além de confirmar o layout:

      - O banco cobra **R$ 2,18 de tarifa por título liquidado**. Sai do seu bolso, não da
        parcela. A tela do retorno mostra o total por arquivo, para você lançar como despesa
        bancária se quiser acompanhar.
      - O rodapé traz a **posição da carteira** (títulos em ser e valor). Em 16/09 eram 15
        títulos somando R$ 64.828,35. A tela mostra isso como conferência.
      - O crédito cai **no dia seguinte** ao pagamento.
      - Um título pode ser **registrado e pago no mesmo arquivo** (aconteceu com o 2640 em
        09/09). O sistema trata e não baixa duas vezes.

### O que ainda NÃO foi exercitado contra arquivo real

Tudo que aparece nos seus arquivos está conferido. O que nunca apareceu neles segue sem
conferência, e o sistema agora se recusa a chutar:

- **Códigos de instrução (protestar, baixar automaticamente).** Sua remessa vem com `00 00`,
  ou seja, sem instrução. Eu estava emitindo códigos que deduzi — e um código errado pode
  fazer o banco **protestar um comprador por engano**. Agora só sai o código que você digitar
  em Cadastros › Banco, copiado do manual do seu banco. Em branco, o banco não age sozinho.
  Os campos "protestar após N dias" continuam valendo para o texto impresso no boleto.
- **Desconto e abatimento**: os seus arquivos vêm zerados nesses campos.
- **Ocorrência 03 (recusa)**: nenhum dos quatro retornos tinha recusa. A leitura segue a
  indicação do BB (motivo em 087/088) e está testada com arquivo sintético.

### Outros bancos

Caixa, Bradesco, Sicoob e C6 seguem sem layout: o sistema recusa gerar em vez de gerar errado.
Para cada um preciso de remessa gerada pelo sistema atual, retorno real e um boleto.

Para mandar boleto por e-mail preciso ligar um serviço de envio; por WhatsApp o PDF vai para o
Storage e o link segue na mensagem.

---

## 7e. Empreendimentos e navegação nova

Reorganizado em 17/09, conforme você propôs. O sistema deixa de girar em torno de um
loteamento por vez e passa a gerir **a empresa inteira**.

**Barra de cima, seis abas:** Painel · 🏗️ Empreendimentos · Vendas · Recebíveis · Relatórios ·
Cadastros.

**Aba Empreendimentos** — lista tudo que a empresa toca, com lotes, vendidos, disponíveis,
reservas a aprovar e total vendido. Clicando em um, abre o espaço dele, com sub-abas:

| Resumo | Planta | Lotes | Reservas | Obra e custos | Leads |
|---|---|---|---|---|---|

Ao cadastrar, escolhe-se o tipo:

- **Loteamento** — planta, lotes numerados, reservas pelo corretor.
- **Carteira** — sem planta e sem lotes; cada venda descreve o imóvel (descrição, endereço,
  matrícula). Apartamento, sala, casa, terreno de terceiros. Nela as sub-abas de planta, lotes
  e reservas nem aparecem.

**Vendas, Recebíveis, Relatórios e Painel** passaram a ser da empresa inteira, com um seletor
"Todos os empreendimentos" para restringir quando quiser. A inadimplência, a régua de cobrança
e os relatórios somam tudo.

**A cobrança bancária é por conta bancária, não por empreendimento.** O que o banco exige é
um arquivo de remessa por convênio — isso nunca teve a ver com empreendimento.

- **Uma conta só:** a tela mostra tudo junto, todos os empreendimentos, sem filtro nenhum.
  A coluna "Empreendimento" aparece na lista quando há mais de um.
- **Mais de uma conta:** aparece um seletor de **conta de cobrança** no topo da tela. Cada
  conta gera o seu arquivo, com o seu convênio e a sua numeração de nosso número.
- **O retorno descobre a conta sozinho**, pela agência, conta e convênio do cabeçalho do
  arquivo. Você não escolhe nada.

Em **Cadastros › 🏦 Banco** agora existe uma lista de contas. Cada conta diz o que cobra:
*todos os empreendimentos* (o normal) ou *só o empreendimento X*. Uma venda é cobrada pela
conta do empreendimento dela; se o empreendimento não tiver conta própria, cai na conta geral.

O corretor não muda: continua vendo planta e reservando lote, e carteiras não aparecem para ele.

- [ ] Passear pelas seis abas e conferir que nada sumiu do caminho.
- [ ] Abrir um empreendimento e usar planta, lotes, reservas e obra por dentro dele.
- [ ] Criar uma carteira e registrar uma venda de imóvel avulso.
- [ ] Ver os recebíveis e os relatórios com todos os empreendimentos juntos, e depois filtrados.
- [ ] Gerar cobranças e conferir que, com uma conta bancária só, sai tudo junto sem perguntar nada.
- [ ] Decidir se a carteira precisa de orçamento de custos (hoje a tela existe igual).

---

## 7g. Qualificação das partes e do imóvel (novo)

Sem isto não sai contrato, e é também a base da declaração fiscal mais adiante. O motor de
contrato já citava `{{cliente.rg}}`, `{{cliente.nacionalidade}}` e `{{cliente.estadoCivil}}`,
mas o formulário nunca coletou esses campos — saía tudo em branco e ninguém percebia.

**O que testar:**

- [ ] Abra uma venda. O bloco do comprador agora tem, além de nome, CPF, telefone e e-mail,
      um **📋 Qualificação completa** que abre: nacionalidade, profissão, estado civil,
      regime de bens, RG com órgão expedidor e endereço em campos separados (CEP,
      logradouro, número, complemento, bairro, cidade, UF).
- [ ] O resumo desse bloco diz o que ainda falta — "falta profissão, RG, cidade". É a mesma
      conferência que a declaração fiscal vai exigir depois, então vale preencher já.
- [ ] Escolha **estado civil casado** ou **união estável**: aparece sozinho o bloco do
      **cônjuge**, com os mesmos campos e a opção "mora no mesmo endereço" já marcada.
- [ ] **Confira a concordância.** Cada pessoa tem um seletor masculino/feminino que controla
      só o texto do contrato: brasileiro/brasileira, casado/casada, portador/portadora.
      Ao trocar a do comprador, a do cônjuge vira sozinha para a oposta — se o casal for do
      mesmo sexo, troque à mão e o sistema não mexe mais nela.
- [ ] Em **Cadastros › Vendedores**, cadastre outro CNPJ do grupo. A empresa das
      Configurações continua sendo o vendedor padrão; a venda pergunta qual deles assina.
      Era o seu caso de incorporadora com vários CNPJs.
- [ ] No lote, abra **📋 Qualificação do imóvel**: descrição conforme a matrícula (copie do
      registro, com as confrontações), e o endereço próprio do lote. Em branco, o contrato
      usa o endereço do empreendimento.
- [ ] No empreendimento, **📋 Endereço e registro**: CEP, logradouro, bairro, UF, cartório de
      registro, matrícula mãe e código do município no IBGE (este só a declaração fiscal usa;
      pode ficar para depois).
- [ ] Gere um contrato de uma venda já qualificada e leia o parágrafo das partes. Ele sai
      assim: *"FULANO, brasileiro, casado sob o regime da comunhão parcial de bens, corretor
      de imóveis, portador da cédula de identidade RG nº X SSP/SC, inscrito no CPF sob o nº
      Y, residente e domiciliado na Rua Z, nº 10, Centro, CEP 88800-000, Criciúma/SC, e sua
      esposa BELTRANA, brasileira, professora, …, residente e domiciliada no mesmo endereço"*.
- [ ] O contrato agora tem linha de assinatura do cônjuge quando existe cônjuge.

**Atenção, uma coisa que eu não faço sozinho:** o modelo padrão de contrato mudou para usar
`{{vendedor.qualificacao}}`, `{{comprador.qualificacao}}` e `{{imovel.descricao}}`. **Se você
já editou o seu modelo em Cadastros › Documentos, o seu texto não é tocado** — ele continua
com os campos antigos, que seguem funcionando. Para aproveitar os novos, entre no modelo e
troque os parágrafos das partes por esses três campos; a lista de campos à direita já os
mostra.

**Mais de uma parte de cada lado** (feito depois que você confirmou que acontece):

- [ ] No comprador há um botão **＋ Adicionar comprador**: dois irmãos, dois sócios, pai e
      filho. Cada um ganha o bloco inteiro de qualificação, com o seu próprio cônjuge, e
      pode ser removido no 🗑. Marido e mulher **não** precisam de dois blocos — para isso é
      o estado civil e o cônjuge.
- [ ] No vendedor há **＋ Adicionar vendedor**, quando duas empresas do grupo assinam a mesma
      venda. Escolher o mesmo vendedor duas vezes não duplica.
- [ ] O **primeiro** comprador continua sendo quem aparece nas telas de venda, recebível,
      cobrança e boleto — só ele tem telefone obrigatório. Os demais existem para o contrato.
      Na tela da venda aparece "e mais 1" e a lista dos demais.
- [ ] No contrato as partes saem separadas por ponto e vírgula, com "e" antes da última, e
      **cada uma ganha a sua linha de assinatura**, mais uma linha para cada cônjuge.

Para isso o bloco de assinaturas do modelo padrão passou a usar `{{assinaturas.vendedores}}`
e `{{assinaturas.compradores}}`, que montam as linhas sozinhos para quantas partes existirem.
Se o seu modelo já estava editado, ele continua com as linhas fixas de antes — funcionam,
mas só imprimem a primeira parte de cada lado.

---

## 7h. Primeira rodada de testes seus (18/09) — o que mudou

Vinte apontamentos seus. Todos atendidos; três eu resolvi diferente do pedido literal e
explico por quê.

**Venda**

- [ ] A qualificação **abria recolhida** e você não viu que os campos existiam — parecia que
      o sistema presumia brasileiro e casado. Agora abre visível. Nacionalidade sempre foi
      campo digitável (vem sugerido "brasileiro") e estado civil sempre foi lista com
      solteiro, casado, união estável, divorciado, separado e viúvo.
- [ ] **Nome, CPF, RG, profissão, estado civil, nacionalidade, endereço e cidade viraram
      obrigatórios.** Salvar sem eles é recusado, dizendo qual falta e levando a tela até o
      comprador certo. Vale para cada comprador da lista.
- [ ] **Corretor**: o sistema pergunta *"O negócio foi intermediado por corretor de
      imóveis?"*. Só no "Sim" aparecem os campos, agora com a qualificação inteira mais
      CRECI, que é obrigatório. No "Não" a comissão vai a zero.
- [ ] **Pagamento à vista**: nova opção. Escolhendo, somem entrada, parcelas, juros, índice e
      reforços, e o valor inteiro entra como uma parcela só.
- [ ] **Número de parcelas**: virou campo de texto com teclado numérico, sem as setinhas.
      Aqui eu não consegui reproduzir o travamento que você viu — digitando no meu teste o
      campo aceitava normalmente. Mudei o tipo do campo, que é de onde esse tipo de
      comportamento costuma vir. **Confirme se resolveu.**
- [ ] **Salva a venda, o sistema pergunta se emite o contrato** e abre a tela para conferir.
- [ ] **Sem índice cadastrado**, a venda avisa e leva ao cadastro, em vez de mostrar um
      seletor vazio.

**Cadastros**

- [ ] A aba **Vendedores virou 🏢 Dados da empresa** e reúne três coisas: a empresa (razão
      social, CNPJ, inscrição estadual, telefone, e-mail e endereço em campos separados),
      **quem assina** e os outros CNPJs do grupo. O cartão que ficava em Configurações saiu
      de lá.
- [ ] **Quem assina virou lista**, porque contrato social costuma exigir duas assinaturas.
      Cada signatário tem qualificação completa, com RG, endereço e cargo.
- [ ] **O editor de modelo abre em tela cheia**, com a paleta de campos numa coluna ao lado.

**Banco — dois pedidos que eu resolvi diferente, e o porquê**

- [ ] **Nosso número saiu do cadastro**: o sistema numera sozinho, começando em
      **10.000.000**. Você pediu número *aleatório* e perguntou a chance de repetir; a conta
      está na seção 7i. Resumo: sequencial não tem probabilidade de colisão nenhuma, e a
      faixa alta serve para ficar longe do sistema antigo, que estava na casa dos milhares.
      Conta que já vinha numerando continua de onde estava; conta cadastrada mas que ainda
      não emitiu boleto acompanha o piso novo.
- [ ] **Códigos de instrução saíram da tela.** Você perguntou o que fazem: são o comando para
      o banco **agir sozinho** depois do vencimento — protestar em cartório, baixar o título,
      negativar. Cada banco tem os seus códigos. **Zerados, o banco não faz nada por conta
      própria**: o boleto fica registrado, o cliente pode pagar depois do vencimento com
      multa e juros, e ninguém é protestado. É exatamente como a remessa que a sua empresa
      manda hoje já vem (`00 00`), e é o comportamento seguro — código errado protesta um
      comprador por engano. Os dias de protesto continuam saindo **impressos no boleto**,
      como aviso. Se um dia você quiser protesto automático de verdade, isso se liga junto
      com o seu gerente, com o manual na mão.

**Índices**

- [ ] **Tela nova, no formato que você mandou**: navegação por ano (‹ 2025 · 2026 · 2027 ›) e
      os doze meses numa tabela só, com o valor ao lado. Aceita vírgula. Enter desce para o
      mês seguinte. Trocar de ano não perde o que você digitou — tudo salva junto.
- [ ] **No topo da tela de índices** entrou o painel de **acumulado dos últimos 12 meses** por
      índice, como no sistema que você usa hoje, com aviso de qual mês falta lançar.

**Painel e recebíveis**

- [ ] Saíram do painel os **próximos vencimentos** e a **atividade recente**.
- [ ] **Recebíveis abre no mês corrente.** Para ver tudo, o seletor de mês tem "Todos os
      meses"; o extrato completo de um contrato fica na tela da venda. **Atenção:** no filtro
      **Atrasados** o mês é ignorado de propósito — parcela vencida em julho continua
      atrasada em setembro, e esconder isso seria pior.

**Antecipação e quitação**

- [ ] "Juros não usados" virou **Desconto**.
- [ ] Saiu a projeção de quitação dos próximos meses: fica só **o valor do mês vigente**,
      válido até o último dia do mês, que é como o cálculo é feito.
- [ ] A mensagem de WhatsApp diz **"para quitar até o último dia do mês"**.
- [ ] **Amortização parcial**: no modo "reduzir prazo" o cliente pode pagar qualquer valor —
      10, 100, 1000. O sistema quita as parcelas inteiras que o dinheiro fecha e **amortiza em
      parte a parcela seguinte, que continua em aberto com o saldo**. O pedaço pago adiantado
      ganha o mesmo desconto que a parcela inteira ganharia. No extrato aparecem duas linhas:
      a amortização, quitada na data do pagamento, e a parcela original com o saldo — que
      continua sujeita à correção do índice, como qualquer saldo devedor. **Confira esse
      cálculo contra a sua planilha**, é o ponto mais delicado desta rodada.

**Distrato**

- [ ] Como combinado, o distrato saiu e virou **🗑️ Excluir contrato**, em duas etapas: a
      primeira tela mostra quantas parcelas somem, quanto já foi recebido e que o lote volta a
      ficar disponível; a segunda pede que você escreva **EXCLUIR**. Se o contrato tiver
      pagamento registrado, o aviso é explícito: esse dinheiro some dos relatórios. Tire um
      backup antes, em Cadastros › Backup.

---

## 7i. Nosso número: a conta que você pediu (18/09)

Você perguntou qual a chance de sortear e repetir. A conta, com os 10 dígitos livres que o
BB dá no convênio de 7 dígitos (10 bilhões de números):

| Boletos emitidos | Chance de ao menos uma repetição |
|---|---|
| 1.000 | 0,005% |
| 10.000 | 0,5% |
| 36.000 | 6,3% |
| 100.000 | 39% |
| 118.000 | 50% |

Trinta e seis mil boletos é um loteamento de 300 lotes em 120 parcelas — não é cenário
distante. **Mas isso vale para sorteio cego.** Conferindo na própria base antes de usar, a
repetição comigo mesmo vira zero. O "recusa certa" que eu disse antes estava mal colocado.

O motivo de verdade para o sequencial é outro: rastreabilidade. Buraco na sequência significa
alguma coisa, dá para conferir contra a relação de títulos em ser do banco, e reconciliar
retorno com remessa fica legível. Além disso eu sei que o banco recusa número repetido que
ainda está **em aberto**; o que ele faz com um já **baixado** anos atrás eu não sei, e
pagamento indo para o título errado é pior que recusa.

**Decidido por você: faixa alta.** O piso subiu de 1.000.000 para **10.000.000**. O seu ERP
antigo estava na casa dos milhares nos arquivos que você mandou; nesse ritmo ele levaria
décadas para chegar aqui, e ainda sobram 9,99 bilhões de números.

**Duas correções que saíram desta conversa** (as duas eram defeitos de verdade):

- A marca d'água somava os números de **todas** as contas bancárias. A unicidade é por
  convênio: uma conta não pode empurrar a numeração da outra. Agora cada conta tem a sua.
- O recebível passou a **gravar qual conta o numerou**. Antes, trocar a conta de um
  empreendimento fazia um número emitido por um convênio contar para outro. Isso pede uma
  coluna nova no banco (`recebiveis.conta_id`) — **rode o `schema.sql` de novo.**
- [ ] Título **recusado** pelo banco agora queima o número na marca d'água da conta antes de
      soltar a parcela: ele nunca volta a ser usado, mesmo que o histórico de remessas seja
      limpo. A parcela volta a "não registrada" e entra na próxima remessa com número novo.
      Continua sem teste contra arquivo real — falta um retorno seu com ocorrência 03.

---

## 7j. Defeito do vídeo de 21/09 — corrigido

**O que você viu:** do painel, clicando no alerta de parcelas em atraso, a tela vai para a
cobrança; lá, os botões **Em aberto · Atrasados · Pagos · Todos** não respondiam a nada.

**O que era:** o filtro dos recebíveis só era criado quando a *lista* era desenhada. Entrando
direto na cobrança — que é o que o alerta do painel faz — a lista nunca foi desenhada, então o
filtro não existia, e o clique tentava mexer num objeto inexistente. O erro acontecia em
silêncio, dentro do `onclick`, e nada na tela mudava: por isso parecia travado.

**Corrigido:** o filtro passa a nascer numa função só, chamada por todos os caminhos — pela
lista, pela cobrança e pelo alerta do painel. Os botões dos dois lugares agora usam a mesma
rota de volta para a lista.

- [ ] Refazer o caminho do vídeo e confirmar: painel › alerta de atraso › cobrança › clicar em
      cada um dos quatro filtros.
- [ ] Testar também o contrário: da lista, chip 🔔 Cobrança, e voltar.

O `test24` cobre esses caminhos. Conferi que ele **falha** no código antigo e passa no novo —
teste que passa nos dois não prova nada.

---

## 7f. Decisões que só dependem de você

Nenhuma me trava hoje, mas todas mudam o produto:

- [x] ~~Carteira precisa de orçamento de custos?~~ — **não.** Imóvel de terceiros não tem obra:
      a carteira perdeu a aba de obra e o orçamento no resumo. Se uma carteira já tiver custo
      lançado, a aba reaparece, para não esconder dado que alguém registrou.
- [x] ~~Multa e juros padrão~~ — **multa 2% e juros 1% ao mês**, já pré-preenchidos em toda
      conta nova. O cliente muda como quiser em Cadastros › Banco. O campo de juros agora é em
      **% ao mês**, do jeito que o contrato fala; o sistema converte para o valor por dia que o
      banco pede.
- [ ] **Divisão dos planos do SaaS** — ainda não definida.
- [x] ~~Nome do produto~~ — **Lotifly**, provável. Falta confirmar e registrar o domínio.

---

## 8. O que ainda não foi construído

Em ordem de prioridade acordada:

1. ~~Cobrança bancária~~ — **feito para o Banco do Brasil.** Faltam Caixa, Bradesco, Sicoob e
   C6, esperando os arquivos de cada um.
2. **DIMOB** — a qualificação das partes e do imóvel já está pronta (seção 7g), que era a
   parte difícil. Falta o leiaute oficial do arquivo de importação e um `.txt` de um ano que
   você já entregou, para eu conferir campo por campo em vez de adivinhar. O sistema gera o
   arquivo; quem transmite é o programa da Receita, com o certificado digital. Perguntas
   pendentes para o seu contador: o valor declarado no ano inclui juros, multa e correção?
   Venda distratada no meio do ano, como entra? Venda parcelada declara a alienação inteira
   no ano do contrato? Você é obrigado pela loteadora, pela imobiliária, ou pelas duas?
   Decidido: locação fica fora, não é o que você busca.
3. **Portal do comprador** — segunda via e extrato para o cliente final.
4. **Distrato e transferência de lote.**
5. **Planos do SaaS** — definir o que entra em cada plano e travar por plano no sistema.

Descartado por decisão sua: assinatura digital, que é serviço contratado à parte. Sem
necessidade: anexar documentos do cliente no sistema e comissão fixa por corretor, já que a
comissão é definida em cada venda.

---

## 8b. Site próprio e SaaS

Decidido em conversa: sair do endereço do GitHub e ir para domínio próprio, com página de
vendas e área de login.

- [ ] Confirmar o nome: **Lotifly**. Primeira consulta daqui (só DNS, o acesso à web está
      bloqueado neste ambiente): `lotifly.com` **já tem dono** — o domínio resolve e aponta
      para hospedagem de alguém. `lotifly.com.br` e `lotifly.net` não resolvem, o que quase
      sempre quer dizer livres, mas isso precisa ser confirmado no registro.br e num
      registrador internacional antes de contar como certo. Falta também a busca de marca no
      INPI em classe parecida (software e serviços imobiliários). Se estiver livre, registrar
      antes de falar do nome por aí.
- [ ] Registrar o domínio (registro.br para .com.br).
- [ ] Definir se o e-mail profissional será Zoho gratuito ou Google Workspace.

Depois disso eu faço a página de vendas e movo o aplicativo para o domínio novo. O Supabase
continua o mesmo, só mudam os endereços autorizados no painel dele e os links de vitrine já
divulgados, que dá para manter funcionando em paralelo.

---

## 8c. Segurança: revisão feita e o que falta fechar

Revisei o código e o banco em 17/09. Resumo honesto.

**O que está certo (conferido agora):**

- Todas as 17 tabelas do banco estão com RLS ligado, inclusive as novas (índices, cobranças,
  contas_banco, modelos, vitrines e leads). A proteção está no banco, não na tela: mesmo que
  alguém chame o Supabase por fora do app, só enxerga a própria empresa.
- O visitante sem login não tem acesso a tabela nenhuma, só a duas funções: a da vitrine e a
  de registrar interesse. A da vitrine devolve quadra, número, área, medidas, situação e preço
  (se você mandar mostrar). Nunca CPF, matrícula, observação interna, reserva, venda ou
  recebível.
- O envio de interesse tem freio: no máximo 120 por hora por empresa e bloqueio de telefone
  repetido em 2 minutos.
- Não existe `eval` nem execução de texto no código, e tudo que vai para a tela passa pelo
  escape. Um nome de cliente ou um lead não consegue injetar script.
- Nenhuma senha ou chave secreta no repositório. A chave que está no `config.js` é a pública,
  feita para ficar exposta.

**Três coisas que eu quero arrumar antes de cliente pagante:**

- [x] **Código de convite** — feito. Agora são 10 caracteres sorteados pelo gerador
      criptográfico, num alfabeto sem 0/O e 1/I/L. Ao criar você escolhe quantas pessoas podem
      usar (padrão: uma só) e por quantos dias vale (padrão: 7 dias). Vencido ou esgotado, o
      banco recusa e a lista mostra marcado.
- [x] **Financeiro separado do administrador no banco** — feito, conforme você decidiu.
      O financeiro mexe em recebíveis, despesas, contratos, vendas, índices, conta bancária e
      cobrança. Não mexe na planta: um gatilho no banco compara a linha antiga com a nova e só
      deixa passar a mudança de **situação** do lote (que é o que acontece ao registrar venda
      ou distrato). Desenho, quadra, número, área, medidas, preço, tipo, matrícula e observação
      ficam travados, e criar ou excluir lote é só do administrador. Ele também deixou de
      convidar gente, publicar vitrine, trocar o modelo de contrato, mexer na configuração da
      empresa e apagar dados — o que fecha o caminho de virar administrador sozinho.
- [ ] **Bucket das plantas é de leitura pública.** É de propósito, a vitrine precisa. O endereço
      tem o identificador da empresa e é impossível de adivinhar, mas quem tiver o link abre o
      arquivo. Regra: ali só planta. Quando formos anexar documento de cliente, vai em pasta
      privada com link que expira.

**Riscos que não são de código e dependem de nós:**

- [ ] Ligar **verificação em dois passos** para o dono e os administradores.
- [ ] Assinar o **Supabase Pro** antes do primeiro cliente pagante: o plano gratuito não tem
      backup diário. Perder dado é o risco mais real, bem mais que roubo.
- [ ] Exportar o **backup em JSON** de vez em quando por Cadastros, enquanto estivermos no free.
- [ ] Senha forte e não repetida de outro site, para você e para cada pessoa da equipe. A porta
      mais fácil de arrombar é sempre a senha de alguém, não o sistema.
- [ ] Quando sairmos do GitHub: travar no painel do Supabase os endereços autorizados só para o
      nosso domínio.
- [ ] **Termos de uso e política de privacidade** (LGPD). Guardamos CPF e telefone de comprador,
      que é dado pessoal, e como SaaS você passa a ser operador dos dados dos seus clientes.

Sobre "sequestro de informação": não existe servidor nosso para alguém criptografar. O
aplicativo é arquivo estático e o banco é gerenciado pelo Supabase, com backup deles. O cenário
realista não é ransomware, é alguém entrar com a senha de um usuário seu.

---

## 9. Ideia registrada para depois

Transformar o sistema em SaaS, com site próprio, assinatura e cadastro de novas incorporadoras.
A base já é multiempresa, cada cliente com seus dados isolados. Falta domínio, site de
apresentação, cobrança recorrente, teste grátis, termos de uso e suporte. Melhor atacar depois
que o Hessen estiver rodando de verdade por algumas semanas.
