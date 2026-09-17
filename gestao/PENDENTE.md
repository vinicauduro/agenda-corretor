# Pendências para testar no computador

Lista do que foi construído e ainda não foi testado por você, mais as decisões que dependem da
sua conferência. Atualizada em 16/09/2026, depois da entrega das permissões por função.

---

## 0. Antes de tudo

- [ ] **Rodar o `schema.sql` de novo** no SQL Editor do Supabase. Cole o arquivo inteiro de
      `gestao/supabase/schema.sql` e clique em Run. Ele é idempotente e não apaga nada.
      Desde a última vez entraram: vitrine, leads, modelos de documento, índices e cobranças.
- [ ] Abrir o app e forçar a atualização (Ctrl+Shift+R no computador) para pegar a versão nova.
      Endereço: https://vinicauduro.github.io/agenda-corretor/gestao/
- [ ] Conferir se aparecem as abas novas: **Leads** no topo, e em Cadastros as abas
      **Documentos**, **Índices**, **Cobrança** e **Vitrine**.

---

## 1. Planta em DXF e lotes manuais

- [ ] Importar o DXF do Hessen e conferir se a planta ficou bonita e alinhada.
- [ ] Testar o botão **＋ Lote** para criar um lote que a detecção não pegou, desenhando o
      retângulo sobre a planta.
- [ ] Testar o filtro **Só lotes sem posição** no seletor de lotes.
- [ ] Em "Rotação e camadas do desenho (avançado)", testar ligar e desligar camadas.

**Decisão pendente:** o DXF é uma revisão diferente do PDF. No DXF a quadra G tem 5 lotes,
H tem 25, P tem 32, Q tem 7, R tem 18 e não existe quadra S. No PDF era G:12, H:17, P:20,
Q:16 e existia S. Confirmar qual revisão vale.

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

**Decisão pendente:** se você lançar o índice de setembro só em outubro, a parcela de outubro
recebe essa correção normalmente. Hoje isso vale mesmo com atraso no lançamento. Confirmar se
é assim que quer, ou se prefere travar pela data em que o índice foi lançado.

---

## 5. Antecipação e quitação

- [ ] Abrir uma venda e clicar em **💸 Antecipar / quitar**.
- [ ] Conferir a tabela **Saldo devedor mês a mês** contra a sua planilha.
- [ ] Abrir a **tabela de amortização** e conferir juro do mês, amortização e saldo.
- [ ] Testar as três operações: quitar tudo, antecipar as últimas parcelas e amortizar um valor
      livre, nos dois modos, reduzindo prazo e reduzindo parcela.
- [ ] Imprimir o demonstrativo e conferir se está apresentável para o cliente.

**Decisão pendente:** hoje o desconto é o juro integral dos meses não usados, que é o cálculo
financeiro puro. Se você quiser uma política comercial diferente, como cobrar taxa de
antecipação ou limitar o desconto, é só dizer.

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
- [ ] Decidir se os preços aparecem ou ficam como "valor sob consulta".

**Combinado:** a aba Leads fica em segundo plano. Existe e funciona, mas não é prioridade.

---

## 7b. Permissões por função

- [ ] Em **Cadastros › 🔐 Permissões**, revisar o que cada papel pode.
- [ ] Convidar alguém como financeiro e conferir que ele não vê vendas nem reservas.
- [ ] Testar desmarcar uma permissão e ver a aba sumir para quem tem aquele papel.

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

## 7d. Cobrança bancária: o que preciso de você

Decidido: vamos de **arquivo CNAB**, com remessa e retorno, do jeito que o financeiro já
trabalha. Bancos usados: BB, Caixa, Bradesco, Sicoob e C6.

**Já pronto:** cadastro da conta de cobrança em Cadastros › Banco, e o boleto com código de
barras e linha digitável do Banco do Brasil, calculados no padrão Febraban. Falta conferir o
campo livre do BB contra o manual, e fazer remessa e retorno.

**Amanhã você me manda:** o arquivo CNAB do Banco do Brasil. Quanto mais material, melhor:

- [ ] Um **arquivo de retorno** de verdade, mesmo antigo.
- [ ] Um **arquivo de remessa** gerado pelo outro sistema, se conseguir. Esse é o mais valioso,
      porque mostra exatamente como o BB espera receber, já com o convênio da empresa.
- [ ] Um **boleto** do BB em PDF ou foto, para eu conferir meu cálculo de código de barras e
      nosso número contra um caso real.

Sobre o nosso número: cada boleto tem o seu, é um sequencial que o sistema controla, não o
banco. Não existe faixa a pedir. Só preciso saber em que número começar, para não repetir
nenhum já usado no outro sistema.

Para cada banco que formos implementar, preciso de:

- [ ] **Manual do layout** de remessa e retorno em PDF, o que o banco chama de "layout de
      cobrança CNAB 240" ou "CNAB 400". Tem no internet banking de cada um.
- [ ] **Dados do convênio** da empresa: agência, conta, código do cedente ou convênio,
      carteira, variação da carteira, posto (no caso do Sicoob) e a faixa de nosso número
      liberada.
- [ ] Um **arquivo de retorno real**, mesmo antigo, para eu conferir a leitura contra dado de
      verdade.
- [ ] Definir as instruções padrão do boleto: dias para protesto ou baixa, multa, juros ao dia,
      desconto e as mensagens que saem no corpo.

Combinado: começamos por um banco só, validamos com um arquivo de verdade, e depois eu
replico para os outros. Cada empresa cliente do sistema preenche o próprio convênio; o layout
é meu, feito uma vez por banco.

Para enviar por e-mail preciso ligar um serviço de envio, e o boleto em PDF vai para o Storage
para poder ser mandado por WhatsApp.

---

## 8. O que ainda não foi construído

Em ordem de prioridade acordada:

1. **Cobrança bancária** — remessa e retorno em CNAB, com baixa automática. Precisa saber com
   qual banco você trabalha e pegar o manual de layout dele.
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

- [ ] Escolher o **nome do produto** e o domínio.
- [ ] Registrar o domínio (registro.br para .com.br).
- [ ] Definir se o e-mail profissional será Zoho gratuito ou Google Workspace.

Depois disso eu faço a página de vendas e movo o aplicativo para o domínio novo. O Supabase
continua o mesmo, só mudam os endereços autorizados no painel dele e os links de vitrine já
divulgados, que dá para manter funcionando em paralelo.

---

## 9. Ideia registrada para depois

Transformar o sistema em SaaS, com site próprio, assinatura e cadastro de novas incorporadoras.
A base já é multiempresa, cada cliente com seus dados isolados. Falta domínio, site de
apresentação, cobrança recorrente, teste grátis, termos de uso e suporte. Melhor atacar depois
que o Hessen estiver rodando de verdade por algumas semanas.
