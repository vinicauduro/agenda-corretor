# Agenda Corretor (CRM): configuração da nuvem (Supabase)

Com a nuvem ativa, a Agenda Corretor passa a ter:

- login por e-mail e senha;
- uma **equipe** com dois papéis: **Administrador**, que vê todos os leads, distribui leads entre
  os corretores e convida e gerencia a equipe, e **Corretor**, que vê só os leads dele;
- agenda, lembretes e mensagens sincronizados entre celular e computador, cada pessoa com os seus;
- funcionamento sem internet: o que você altera fica guardado no aparelho e é enviado sozinho
  quando a conexão volta (o ⏳ ao lado do 👤 mostra quantas alterações faltam enviar).

O CRM usa um **projeto Supabase próprio**, separado da Gestão de Loteamento. As contas e a equipe
de um não têm relação com as do outro.

Sem a nuvem (chave vazia em `crm/config.js`), o app continua funcionando só no aparelho,
como antes.

## Passo a passo (uma vez só)

1. **Criar o projeto** em https://supabase.com › *New project* (região *South America (São Paulo)*).
   Guarde a senha do banco.

2. **Criar as tabelas.** No painel do projeto, abra **SQL Editor › New query**, cole o conteúdo
   inteiro de `crm/schema.sql` e clique em **Run**. Pode rodar de novo sempre que o arquivo for
   atualizado (ele não apaga nada).

3. **Autenticação.** Em **Authentication › Sign In / Providers › Email**, deixe *Email* ativado.
   - Para começar sem confirmação de e-mail (mais simples), desative *Confirm email*.
     Com a confirmação ativada, a pessoa precisa abrir o link recebido por e-mail antes de entrar.
   - Em **Authentication › URL Configuration** defina:
     - *Site URL*: `https://vinicauduro.github.io/agenda-corretor/`
     - *Redirect URLs*: a mesma URL acima. Ela é usada no link de "Esqueci a senha" e na
       confirmação de e-mail.

4. **Chaves.** Em **Project Settings › API** (ou *API Keys*), copie a *Project URL* e a chave
   **anon public** (ou *publishable*) e preencha `crm/config.js`:

   ```js
   window.CRM_CONFIG = {
     supabaseUrl: 'https://SEU-PROJETO.supabase.co',
     supabaseAnonKey: 'eyJ...'
   };
   ```

   A chave *anon* é pública por natureza (fica no navegador de todo usuário). O que protege os
   dados são as regras de acesso (RLS) criadas pelo `schema.sql`.
   **Nunca** coloque a chave `service_role` (ou *secret*) no app.

5. **Publicar.** Faça commit e push; o GitHub Pages atualiza o site.

## Primeiro uso

1. Abra o app, toque em **Criar conta** e informe nome, e-mail e senha.
   A agenda, os lembretes e as mensagens que já estavam neste aparelho sobem sozinhos para a sua conta.
2. Na aba **🎯 Leads**, informe o nome da equipe e toque em **Criar minha equipe**. Você vira o
   administrador. Os leads que já estavam neste aparelho entram na equipe como seus.
3. Em **👤 › Convidar corretor**, gere um link e envie pelo WhatsApp. Cada link vale para
   **uma pessoa** e expira em **7 dias**. Quem abrir o link cria a conta (ou entra) e já fica
   na sua equipe como corretor.

## Como a equipe funciona

| | Administrador | Corretor |
|---|---|---|
| Ver leads | todos | só os dele |
| Cadastrar lead | para qualquer corretor ou "sem corretor" | só para ele mesmo |
| Mudar o corretor de um lead | sim | não |
| Excluir lead | qualquer um | só os que ele mesmo cadastrou |
| Convidar, trocar papel, desativar membro | sim | não |
| Agenda, lembretes e mensagens | só os dele | só os dele |

- **Desativar** um corretor (👤 › ⛔) corta o acesso dele na hora. Os leads continuam na equipe:
  filtre por esse corretor na aba Leads e passe cada lead para outra pessoa.
- A equipe sempre precisa ter pelo menos um administrador ativo.
- O lead que o administrador passa para um corretor aparece na tela dele em tempo real.

## Avisos no celular (mesmo com o app fechado)

Lembretes e compromissos com "Lembrar antes" chegam como notificação no celular, mesmo com o
app fechado. Um lembrete sem hora avisa às 9h do dia marcado. Quem manda o aviso é uma função
do Supabase que roda a cada minuto.

### Ligar no Supabase (uma vez só)

1. **Banco.** Rode de novo o `crm/schema.sql` inteiro no **SQL Editor**. Ele cria as tabelas dos
   avisos e não apaga nada.
2. **Função.** Em **Edge Functions › Deploy a new function › Via Editor**:
   - Nome da função: `avisos` (exatamente assim).
   - Apague o código de exemplo, cole o conteúdo de `crm/funcoes/avisos/index.ts` e clique em
     **Deploy function**.
   - Na página da função, em **Details** (ou **Settings**), **desligue** *Verify JWT* / *Enforce JWT
     verification* e salve. Quem protege a função é um segredo que só o agendador conhece.
3. **Agendador.** Rode o `crm/avisos.sql` no **SQL Editor**. Ele liga as extensões `pg_cron` e
   `pg_net` e chama a função a cada minuto. Na primeira chamada, a função cria as chaves do push.

Para conferir, abra **Edge Functions › avisos › Logs** (ou *Invocations*): a cada minuto deve
aparecer uma chamada com status 200.

### Ativar em cada celular

- **iPhone** (iOS 16.4 ou mais novo): abra o app no Safari, toque em **Compartilhar › Adicionar à
  Tela de Início** e abra pelo ícone novo. Depois, na aba **🔔 Lembretes** (ou em **👤 › Avisos no
  celular**), toque em **Ativar** e permita as notificações.
- **Android e computador:** no Chrome, basta tocar em **Ativar** e permitir.

Cada pessoa ativa no próprio aparelho, e cada um recebe só os próprios lembretes e compromissos.
