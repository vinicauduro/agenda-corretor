# Pendências para testar no computador

Lista do que foi construído e ainda não foi testado por você, mais as decisões que dependem da
sua conferência. Atualizada em 17/09/2026, depois da revisão de segurança e da separação do perfil financeiro.

---

## 0. Antes de tudo

- [ ] **Rodar o `schema.sql` mais uma vez** (17/09, fim do dia): entrou só uma correção na
      limpeza de dados, que antes deixava categorias de despesa e modelos de documento para
      trás ao importar um backup. Não é urgente, mas rode quando puder.
- [x] ~~Rodar o `schema.sql` de novo~~ — feito por você em 17/09.
- [ ] **Rodar o `schema.sql` de novo** no SQL Editor do Supabase. Cole o arquivo inteiro de
      `gestao/supabase/schema.sql` e clique em Run. Ele é idempotente e não apaga nada.
      Desde a última vez entraram: vitrine, leads, modelos de documento, índices, cobranças,
      conta bancária e a separação do perfil financeiro. **Este passo é obrigatório agora**,
      porque as regras de permissão do banco mudaram.
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
- [ ] Convidar alguém como financeiro e conferir que ele vê recebíveis, despesas, cobrança e
      vendas, mas não vê reservas nem consegue editar lote.
- [ ] Com o financeiro logado, tentar mudar o preço de um lote pela tela de lotes: tem que dar
      recusa vinda do banco, não só sumir o botão.
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
