// Recebimento (webhook) e envio de mensagens pela API oficial do WhatsApp (Cloud API).
// O parceiro (Dualhook ou outro) repassa os avisos da Meta no formato original;
// para enviar, o endereço e o tipo de chave vêm dos segredos, para servir a
// qualquer parceiro: WA_API_URL, WA_TOKEN e, se o parceiro pedir, WA_AUTH_HEADER.

export type Evento =
  | { tipo: "cliente"; telefone: string; nome: string; waId: string; texto: string }
  | { tipo: "equipe"; telefone: string; waId: string; texto: string };

type Msg = Record<string, any>;

// Resume em texto o que chegou (o agente lê só texto).
export function textoDaMensagem(m: Msg): string {
  switch (m.type) {
    case "text": return m.text?.body ?? "";
    case "button": return m.button?.text ?? "";
    case "interactive":
      return m.interactive?.button_reply?.title ?? m.interactive?.list_reply?.title ?? "";
    case "image": return `[O cliente enviou uma foto${m.image?.caption ? ` com a legenda: ${m.image.caption}` : ""}]`;
    case "audio": return "[O cliente enviou um áudio, que você não consegue ouvir]";
    case "video": return "[O cliente enviou um vídeo, que você não consegue ver]";
    case "document": return `[O cliente enviou um documento${m.document?.filename ? `: ${m.document.filename}` : ""}]`;
    case "location":
      return `[O cliente enviou uma localização${m.location?.name ? `: ${m.location.name}` : ""}${m.location?.address ? `, ${m.location.address}` : ""}]`;
    case "sticker": return "[figurinha]";
    case "reaction": return "";
    default: return `[mensagem do tipo ${m.type}]`;
  }
}

const TIPOS_ECO_DA_EQUIPE = new Set(["text", "image", "video", "audio", "document", "location", "contacts", "sticker", "interactive", "button", "template"]);

// Grupos ficam só com a equipe: o agente ignora qualquer mensagem de grupo.
const deGrupo = (m: Msg) => Boolean(m.group_id || m.group || m.context?.group_id);

// Extrai do aviso da Meta as mensagens de clientes e as enviadas pela equipe
// no app WhatsApp Business (coexistência: campo smb_message_echoes).
export function lerWebhook(corpo: Msg): Evento[] {
  const eventos: Evento[] = [];
  for (const entry of corpo?.entry ?? []) {
    for (const change of entry?.changes ?? []) {
      const v = change?.value ?? {};
      if (change.field === "messages") {
        const nomes = new Map<string, string>();
        for (const c of v.contacts ?? []) nomes.set(c.wa_id, c.profile?.name ?? "");
        for (const m of v.messages ?? []) {
          if (deGrupo(m)) continue;
          const texto = textoDaMensagem(m);
          if (!texto) continue;
          eventos.push({ tipo: "cliente", telefone: m.from, nome: nomes.get(m.from) ?? "", waId: m.id, texto });
        }
      } else if (change.field === "smb_message_echoes") {
        for (const m of v.message_echoes ?? []) {
          // Só conta como corretor assumindo uma mensagem de verdade (não reação, edição, apagada, aviso do sistema).
          if (!TIPOS_ECO_DA_EQUIPE.has(m.type) || deGrupo(m)) continue;
          eventos.push({ tipo: "equipe", telefone: m.to, waId: m.id, texto: textoDaMensagem(m) || "[mensagem]" });
        }
      }
      // Registro para diagnóstico: só o tipo do aviso, sem o conteúdo das mensagens.
      const tipos = [...(v.messages ?? []), ...(v.message_echoes ?? [])].map((m: Msg) => m.type);
      console.log("webhook", change.field, tipos.join(",") || (v.statuses ? "status" : "-"));
    }
  }
  return eventos;
}

// Confere a assinatura X-Hub-Signature-256 quando o segredo do app é conhecido.
export async function assinaturaValida(corpoBruto: string, assinatura: string | null, segredoApp: string): Promise<boolean> {
  if (!assinatura?.startsWith("sha256=")) return false;
  const chave = await crypto.subtle.importKey("raw", new TextEncoder().encode(segredoApp),
    { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const mac = new Uint8Array(await crypto.subtle.sign("HMAC", chave, new TextEncoder().encode(corpoBruto)));
  const esperado = "sha256=" + [...mac].map((b) => b.toString(16).padStart(2, "0")).join("");
  if (esperado.length !== assinatura.length) return false;
  let dif = 0;
  for (let i = 0; i < esperado.length; i++) dif |= esperado.charCodeAt(i) ^ assinatura.charCodeAt(i);
  return dif === 0;
}

// Forma única de um telefone brasileiro para comparar: com 55, sem o 9 extra
// do celular (o WhatsApp às vezes manda "554899998888" para "(48) 99999-8888").
function telefoneCanonico(t: string): string {
  let d = t.replace(/\D/g, "");
  if (d.length === 10 || d.length === 11) d = "55" + d;
  if (/^55\d{2}9\d{8}$/.test(d)) d = d.slice(0, 4) + d.slice(5);
  return d;
}

const listaTelefones = (lista: string) => lista.split(",").map((t) => t.trim()).filter(Boolean).map(telefoneCanonico);

// Números separados por vírgula. WA_NUNCA_RESPONDER: telefones da equipe, que o
// agente nunca atende. WA_SOMENTE_TELEFONES (modo piloto): se preenchido, o agente
// só responde a esses números; os demais ficam para a equipe, como antes.
export function agenteLiberado(
  telefone: string,
  somente = Deno.env.get("WA_SOMENTE_TELEFONES") ?? "",
  nunca = Deno.env.get("WA_NUNCA_RESPONDER") ?? "",
): boolean {
  const t = telefoneCanonico(telefone);
  if (listaTelefones(nunca).includes(t)) return false;
  const liberados = listaTelefones(somente);
  return liberados.length === 0 || liberados.includes(t);
}

// "5548999998888" → "(48) 99999-8888", como o CRM mostra os telefones.
export function telefoneLegivel(waId: string): string {
  const tudo = waId.replace(/\D/g, "");
  if (!/^55\d{10,11}$/.test(tudo)) return "+" + tudo;
  const d = tudo.slice(2);
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return "+" + waId;
}

async function enviar(para: string, conteudo: Msg): Promise<string | null> {
  const url = Deno.env.get("WA_API_URL") ||
    `https://graph.facebook.com/v21.0/${Deno.env.get("WA_PHONE_NUMBER_ID")}/messages`;
  const cabecalho = Deno.env.get("WA_AUTH_HEADER") || "Authorization";
  const token = Deno.env.get("WA_TOKEN") ?? "";
  const resp = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      [cabecalho]: cabecalho.toLowerCase() === "authorization" ? `Bearer ${token}` : token,
    },
    body: JSON.stringify({ messaging_product: "whatsapp", recipient_type: "individual", to: para, ...conteudo }),
  });
  const json = await resp.json().catch(() => ({}));
  if (!resp.ok) throw new Error(`WhatsApp recusou o envio (${resp.status}): ${JSON.stringify(json)}`);
  return json?.messages?.[0]?.id ?? null;
}

export function enviarTexto(para: string, texto: string) {
  return enviar(para, { type: "text", text: { body: texto, preview_url: true } });
}

export function enviarImagem(para: string, link: string, legenda: string) {
  return enviar(para, { type: "image", image: { link, caption: legenda } });
}
