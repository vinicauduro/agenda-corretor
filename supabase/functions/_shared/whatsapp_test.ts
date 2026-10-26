import { assertEquals } from "jsr:@std/assert@1.0.13";
import { assinaturaValida, lerWebhook, telefoneLegivel } from "./whatsapp.ts";
import { montarHistorico } from "./agente.ts";

const aviso = {
  object: "whatsapp_business_account",
  entry: [{
    id: "1",
    changes: [
      {
        field: "messages",
        value: {
          messaging_product: "whatsapp",
          metadata: { phone_number_id: "123" },
          contacts: [{ wa_id: "5548999998888", profile: { name: "Maria" } }],
          messages: [
            { from: "5548999998888", id: "wamid.A", type: "text", text: { body: "Oi, procuro casa no Centro" } },
            { from: "5548999998888", id: "wamid.B", type: "audio", audio: { id: "x" } },
            { from: "5548999998888", id: "wamid.C", type: "reaction", reaction: { emoji: "👍" } },
          ],
        },
      },
      { field: "messages", value: { statuses: [{ id: "wamid.Z", status: "read" }] } },
      {
        field: "smb_message_echoes",
        value: { message_echoes: [
          { from: "554834476251", to: "5548999998888", id: "wamid.E", type: "text", text: { body: "Oi Maria, aqui é o Vini" } },
          { from: "554834476251", to: "5548999998888", id: "wamid.F", type: "reaction", reaction: { emoji: "👍" } },
          { from: "554834476251", to: "5548999998888", id: "wamid.G", type: "unsupported" },
        ] },
      },
    ],
  }],
};

Deno.test("lê mensagens de clientes e da equipe (coexistência), ignora status e reações", () => {
  assertEquals(lerWebhook(aviso), [
    { tipo: "cliente", telefone: "5548999998888", nome: "Maria", waId: "wamid.A", texto: "Oi, procuro casa no Centro" },
    { tipo: "cliente", telefone: "5548999998888", nome: "Maria", waId: "wamid.B", texto: "[O cliente enviou um áudio, que você não consegue ouvir]" },
    { tipo: "equipe", telefone: "5548999998888", waId: "wamid.E", texto: "Oi Maria, aqui é o Vini" },
  ]);
  assertEquals(lerWebhook({}), []);
});

Deno.test("telefone no formato do CRM", () => {
  assertEquals(telefoneLegivel("5548999998888"), "(48) 99999-8888");
  assertEquals(telefoneLegivel("554834476251"), "(48) 3447-6251");
  assertEquals(telefoneLegivel("14155550100"), "+14155550100");
});

Deno.test("assinatura da Meta", async () => {
  const corpo = '{"a":1}';
  // HMAC-SHA256 de '{"a":1}' com a chave "segredo"
  const chave = await crypto.subtle.importKey("raw", new TextEncoder().encode("segredo"), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const mac = new Uint8Array(await crypto.subtle.sign("HMAC", chave, new TextEncoder().encode(corpo)));
  const assinatura = "sha256=" + [...mac].map((b) => b.toString(16).padStart(2, "0")).join("");
  assertEquals(await assinaturaValida(corpo, assinatura, "segredo"), true);
  assertEquals(await assinaturaValida(corpo, assinatura, "outro"), false);
  assertEquals(await assinaturaValida(corpo, null, "segredo"), false);
});

Deno.test("histórico: junta mensagens seguidas e começa pelo cliente", () => {
  assertEquals(montarHistorico([
    { autor: "agente", texto: "mensagem solta" },
    { autor: "cliente", texto: "Oi" },
    { autor: "cliente", texto: "quero alugar" },
    { autor: "agente", texto: "Olá! Sou o assistente virtual." },
    { autor: "equipe", texto: "Posso te ligar?" },
    { autor: "cliente", texto: "Pode" },
  ]), [
    { role: "user", content: "Oi\n\nquero alugar" },
    { role: "assistant", content: "Olá! Sou o assistente virtual.\n\n[Mensagem de um corretor da Cocal] Posso te ligar?" },
    { role: "user", content: "Pode" },
  ]);
});

Deno.test("modo piloto: só responde aos números liberados", async () => {
  const { agenteLiberado } = await import("./whatsapp.ts");
  const lista = "(48) 99999-8888, 48 98888-7777";
  assertEquals(agenteLiberado("5548999998888", lista), true);
  assertEquals(agenteLiberado("554899998888", lista), true); // sem o 9 extra
  assertEquals(agenteLiberado("5548988887777", lista), true);
  assertEquals(agenteLiberado("5548911112222", lista), false);
  assertEquals(agenteLiberado("5548911112222", ""), true); // sem lista: responde a todos
});

Deno.test("números da equipe: o agente nunca responde", async () => {
  const { agenteLiberado } = await import("./whatsapp.ts");
  const equipe = "(48) 3447-6251, (48) 98888-7777";
  assertEquals(agenteLiberado("5548988887777", "", equipe), false);
  assertEquals(agenteLiberado("554888887777", "", equipe), false); // sem o 9 extra
  assertEquals(agenteLiberado("5548999998888", "", equipe), true);
  assertEquals(agenteLiberado("5548988887777", "(48) 98888-7777", equipe), false); // equipe vence o piloto
});
