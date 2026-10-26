# Assistente virtual do WhatsApp — Cocal Imóveis

O assistente faz o primeiro atendimento no WhatsApp da Cocal, 24 horas por dia: entende o que
o cliente procura, envia 2 ou 3 imóveis do catálogo (foto, valor e link), responde dúvidas com
a base de respostas aprovada, grava o lead no CRM e passa para a equipe (Nani ou um corretor) quando preciso.

## Como funciona

```
Cliente no WhatsApp
   │
   ▼
Meta (API oficial, coexistência: o app WhatsApp Business continua funcionando)
   │  via parceiro oficial (Dualhook)
   ▼
Supabase do CRM ─ função whatsapp-webhook
   │  ├─ catálogo de imóveis (tabela imoveis, copiada do XML do site a cada hora)
   │  ├─ base de respostas aprovada (tabela base_respostas)
   │  └─ Claude (API da Anthropic) decide a resposta e usa as ferramentas:
   │       buscar_imoveis · resumo_catalogo · enviar_imoveis · registrar_lead · transferir_para_humano
   ▼
Resposta no WhatsApp + lead na aba 🎯 Leads do CRM
```

Nada roda no computador do escritório: tudo fica na nuvem do Supabase e só "acorda" quando
chega mensagem.

**Quando um corretor assume:** se o assistente transferir a conversa, ou se qualquer pessoa da
equipe responder pelo app WhatsApp Business (celular ou WhatsApp Web), o assistente fica calado
naquela conversa por 12 horas, contadas a partir da última mensagem da equipe. O lead aparece no
CRM com **🔔 PEDIU CORRETOR** nas observações.
⚠️ Mensagens enviadas pelo **WhatsApp para Windows/Mac** ou pelo relógio não avisam o sistema.
Responda pelo celular ou pelo WhatsApp Web.

---

## Configuração (uma vez só)

> **Nunca cole senhas ou chaves no chat.** Todas elas vão nos lugares indicados abaixo.

Os "segredos" do assistente ficam em **Supabase › projeto do CRM › Edge Functions › Secrets**
(*Add new secret*: nome à esquerda, valor à direita).

### 1. Banco de dados (5 minutos)
1. Supabase › projeto do CRM › **SQL Editor › New query**.
2. Cole o conteúdo inteiro de `crm/whatsapp.sql` e clique em **Run**.
   Isso cria o catálogo, as conversas e a base de respostas (em rascunho). Não altera os leads
   nem nada do app.

### 2. Conta na Anthropic (o Claude)
1. Crie a conta em https://console.anthropic.com e cadastre o cartão em **Billing**.
2. Em **Limits**, defina um **limite de gasto mensal** (ex.: US$ 50 no piloto).
3. Em **API Keys › Create Key**, crie uma chave chamada "Assistente WhatsApp Cocal".
4. Copie a chave e salve no Supabase como segredo **`ANTHROPIC_API_KEY`**. Não guarde a chave
   em nenhum outro lugar.

### 3. Chave do assistente
Invente uma senha longa (use um gerador de senhas, 30 caracteres ou mais, só letras e números)
e salve no Supabase como segredo **`WA_WEBHOOK_SEGREDO`**. Guarde-a no seu gerenciador de
senhas: ela é usada na página de teste e no endereço do webhook (passo 7).

### 4. Publicar as funções (automático pelo GitHub)
1. Em https://supabase.com/dashboard/account/tokens, clique em **Generate new token**
   (nome: "GitHub Agenda Corretor") e copie.
2. No GitHub: repositório `agenda-corretor` › **Settings › Secrets and variables › Actions ›
   New repository secret**. Nome: **`SUPABASE_ACCESS_TOKEN`**. Valor: o token copiado.
3. Pronto: toda vez que o código do assistente mudar na branch `main`, o GitHub testa e publica
   sozinho. Para publicar na hora: aba **Actions › Assistente WhatsApp › Run workflow**.

### 5. Catálogo de imóveis
1. No painel da ImobiBrasil: **Imóveis › Integrações Portais**, crie um **portal
   personalizado** ("Assistente WhatsApp") e copie o endereço do XML. Confira se os imóveis
   estão marcados para exportação.
2. Salve no Supabase como segredo **`IMOVEIS_XML_URL`**.
3. Supabase › **Edge Functions › importar-imoveis › Test** (ou *Invoke*): deve responder algo
   como `{"importados": 85, "desativados": 0}`.
4. Atualização automática: Supabase › **Integrations › Cron › Create job**. Nome
   "importar-imoveis", agenda `17 * * * *` (de hora em hora), tipo **Supabase Edge Function**,
   função `importar-imoveis`, método POST.

### 6. Testar sem WhatsApp
Abra **https://vinicauduro.github.io/agenda-corretor/whatsapp/testar.html**, informe a chave do
passo 3 em *Configuração* e converse como se fosse um cliente. Cada "telefone de teste" é uma
conversa nova. Os leads de teste aparecem no CRM (apague depois).

### 7. Ligar o WhatsApp (Dualhook, coexistência)
1. **Antes de conectar, ligue o modo piloto:** salve no Supabase o segredo
   **`WA_SOMENTE_TELEFONES`** com os números que podem conversar com o assistente, separados por
   vírgula (ex.: `(48) 99999-8888, (48) 98888-7777`). Os demais clientes continuam sendo atendidos
   só pela equipe, como hoje. Para liberar para todos, apague esse segredo.
2. Crie a conta em https://dualhook.com (plano Developer, 1 número; tem teste grátis) e inicie a
   conexão de um número **existente do WhatsApp Business app (Coexistence)**.
3. Antes de abrir a janela da Meta, a Dualhook pede:
   - **Webhook URL:**
     `https://ahklfealqulmbahzvlpt.supabase.co/functions/v1/whatsapp-webhook?chave=SUA_CHAVE_DO_PASSO_3`
     (troque o final pela chave do passo 3; digite direto na Dualhook)
   - **Verify token:** a mesma chave do passo 3.
4. Na janela da Meta, entre com o Facebook, escolha a empresa e o número do escritório, e confirme
   no celular (app WhatsApp Business › aparece um pedido de conexão).
5. No painel da Dualhook, copie o **Phone Number ID** e a chave **`dh_live_...`** e salve no
   Supabase:

   | Segredo | Valor |
   |---|---|
   | `WA_API_URL` | `https://api.dualhook.com/v25.0/PHONE_NUMBER_ID/messages` (troque PHONE_NUMBER_ID pelo número do painel) |
   | `WA_TOKEN` | a chave `dh_live_...` |

6. Do seu celular (liberado no passo 1), mande uma mensagem para o WhatsApp da Cocal e veja o
   assistente responder.

**Mantenha o app aberto:** a Meta desliga a coexistência se o app WhatsApp Business do celular
principal ficar uns 14 dias sem ser aberto.

### 8. Base de respostas
O texto aprovado pela Cocal está em `whatsapp/base-de-respostas.sql`. Para carregar (ou
recarregar depois de mudanças), cole o arquivo inteiro no **SQL Editor** e clique em **Run**:
ele substitui a base toda. Ajustes pequenos: Supabase › **Table Editor › base_respostas**,
corrija `conteudo` (o assistente só usa as linhas com `aprovado` marcado). As mudanças valem na
hora, sem publicar nada.

---

## Ajustes opcionais (segredos)

| Segredo | Padrão | Para quê |
|---|---|---|
| `CLAUDE_MODEL` | `claude-opus-5-5` | Modelo do Claude. Mais barato: `claude-sonnet-5-5` (~metade) ou `claude-haiku-5-5` (bem mais barato, menos caprichado). Decida no piloto. |
| `CLAUDE_ESFORCO` | `low` | Quanto o Claude "pensa" antes de responder: `low`, `medium` ou `high` (mais lento e mais caro). |
| `WA_PAUSA_HORAS` | `12` | Quantas horas o assistente fica calado depois que um corretor assume. |
| `WA_ESPERA_MS` | `4000` | Espera antes de responder, para juntar mensagens seguidas do cliente. |
| `CRM_EQUIPE_ID` | a única equipe | ID da equipe no CRM, se houver mais de uma. |
| `WA_SOMENTE_TELEFONES` | — (todos) | Modo piloto: o assistente só responde a estes números. |
| `WA_NUNCA_RESPONDER` | — | Telefones da equipe (separados por vírgula): o assistente nunca responde a eles. |
| `WA_APP_SECRET` | — | Segredo do app da Meta, para conferir a assinatura (só se usar app próprio na Meta). |

## Onde ver o que aconteceu
- **Conversas:** Supabase › Table Editor › `wa_mensagens` (e `wa_conversas` para ver quem está com
  corretor).
- **Erros:** Supabase › Edge Functions › whatsapp-webhook › **Logs**.
- **Catálogo importado:** Table Editor › `imoveis`.

## Arquivos
| Arquivo | Conteúdo |
|---|---|
| `crm/whatsapp.sql` | Tabelas do assistente |
| `whatsapp/base-de-respostas.sql` | Base de respostas aprovada |
| `supabase/functions/whatsapp-webhook/` | Recebe as mensagens e responde |
| `supabase/functions/importar-imoveis/` | Copia o XML do site para o catálogo |
| `supabase/functions/_shared/agente.ts` | Instruções do assistente e as ferramentas |
| `supabase/functions/_shared/imoveis_xml.ts` | Leitura do XML da ImobiBrasil |
| `whatsapp/testar.html` | Página de teste |
| `.github/workflows/assistente-whatsapp.yml` | Testes e publicação automática |
