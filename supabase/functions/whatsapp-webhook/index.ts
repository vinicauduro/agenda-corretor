// Endereço que recebe os avisos do WhatsApp (via parceiro oficial da Meta).
//  GET  — verificação do webhook pela Meta (hub.verify_token = WA_WEBHOOK_SEGREDO).
//  POST — mensagens de clientes e da equipe. Precisa de ?chave=WA_WEBHOOK_SEGREDO no
//         endereço ou da assinatura da Meta (se WA_APP_SECRET estiver configurado).
//  POST {"simular": {"telefone", "texto", "nome"?, "reiniciar"?}} — testa o agente sem
//         WhatsApp: devolve as respostas em vez de enviá-las (também exige a chave).
import { createClient } from "npm:@supabase/supabase-js@2.118.0";
import { type Contexto, enviarResposta, PAUSA_HORAS, responder } from "../_shared/agente.ts";
import { assinaturaValida, type Evento, lerWebhook } from "../_shared/whatsapp.ts";

declare const EdgeRuntime: { waitUntil(p: Promise<unknown>): void };

const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
const SEGREDO = Deno.env.get("WA_WEBHOOK_SEGREDO") ?? "";
const SEGREDO_APP = Deno.env.get("WA_APP_SECRET") ?? "";
// Espera um pouco antes de responder: quem manda três mensagens seguidas recebe uma resposta só.
const ESPERA_MS = Number(Deno.env.get("WA_ESPERA_MS") || "4000");

const dormir = (ms: number) => new Promise((r) => setTimeout(r, ms));

// Grava a mensagem; devolve o id dela, ou null se já tinha chegado antes (a Meta reenvia avisos).
async function gravar(ev: Evento): Promise<number | null> {
  const conversa: Record<string, unknown> = { telefone: ev.telefone, atualizado_em: new Date().toISOString() };
  if (ev.tipo === "cliente" && ev.nome) conversa.nome = ev.nome;
  const c = await db.from("wa_conversas").upsert(conversa, { onConflict: "telefone" });
  if (c.error) throw new Error(c.error.message);
  const { data, error } = await db.from("wa_mensagens")
    .upsert({ telefone: ev.telefone, autor: ev.tipo, texto: ev.texto, wa_id: ev.waId }, { onConflict: "wa_id", ignoreDuplicates: true })
    .select("id");
  if (error) throw new Error(error.message);
  return data?.[0]?.id ?? null;
}

// Corretor respondeu pelo app: o agente fica calado nesta conversa por WA_PAUSA_HORAS.
async function pausarAgente(telefone: string) {
  const ate = new Date(Date.now() + PAUSA_HORAS * 3600_000).toISOString();
  await db.from("wa_conversas").update({ modo: "humano", humano_ate: ate }).eq("telefone", telefone);
}

// O agente só responde se a conversa não estiver com um corretor
// e se esta ainda for a última mensagem do cliente.
async function deveResponder(telefone: string, msgId: number): Promise<{ ok: boolean; nome: string }> {
  const { data: conv } = await db.from("wa_conversas").select("modo, humano_ate, nome").eq("telefone", telefone).single();
  if (!conv) return { ok: false, nome: "" };
  if (conv.modo === "humano") {
    if (conv.humano_ate && new Date(conv.humano_ate) > new Date()) return { ok: false, nome: conv.nome };
    await db.from("wa_conversas").update({ modo: "agente", humano_ate: null, motivo_humano: "" }).eq("telefone", telefone);
  }
  const { data: ultima } = await db.from("wa_mensagens").select("id").eq("telefone", telefone).eq("autor", "cliente")
    .order("id", { ascending: false }).limit(1).single();
  return { ok: ultima?.id === msgId, nome: conv.nome };
}

async function atender(telefone: string, msgId: number) {
  await dormir(ESPERA_MS);
  const { ok, nome } = await deveResponder(telefone, msgId);
  if (!ok) return;
  const ctx: Contexto = { db, telefone, nome, simular: false, saidas: [] };
  try {
    await responder(ctx);
  } catch (err) {
    console.error("erro ao responder", telefone, err);
    await pausarAgente(telefone);
    await enviarResposta(ctx, "Desculpe, tive um problema técnico agora. A equipe da Cocal vai continuar o seu atendimento por aqui. 🙂")
      .catch((e) => console.error("erro ao avisar o cliente", e));
  }
}

async function processar(eventos: Evento[]) {
  const aResponder = new Map<string, number>();
  for (const ev of eventos) {
    try {
      const id = await gravar(ev);
      if (id === null) continue;
      if (ev.tipo === "equipe") await pausarAgente(ev.telefone);
      else aResponder.set(ev.telefone, id);
    } catch (err) {
      console.error("erro ao gravar mensagem", err);
    }
  }
  await Promise.all([...aResponder].map(([tel, id]) => atender(tel, id)));
}

async function simular(s: { telefone?: string; texto?: string; nome?: string; reiniciar?: boolean }) {
  const telefone = String(s.telefone || "teste").replace(/[^\w-]/g, "");
  if (s.reiniciar) {
    await db.from("wa_conversas").delete().eq("telefone", telefone);
    if (!s.texto) return { reiniciado: true };
  }
  const id = await gravar({ tipo: "cliente", telefone, nome: s.nome ?? "", waId: `sim-${crypto.randomUUID()}`, texto: String(s.texto ?? "") });
  const { ok, nome } = await deveResponder(telefone, id!);
  if (!ok) return { respostas: [], aviso: "Conversa com um corretor: o agente está pausado" };
  return { respostas: await responder({ db, telefone, nome, simular: true, saidas: [] }) };
}

// A página de teste (whatsapp/testar.html) chama a simulação direto do navegador.
const CORS = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "content-type" };

Deno.serve(async (req) => {
  const url = new URL(req.url);

  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  if (req.method === "GET") {
    const ok = SEGREDO && url.searchParams.get("hub.mode") === "subscribe" && url.searchParams.get("hub.verify_token") === SEGREDO;
    return ok ? new Response(url.searchParams.get("hub.challenge") ?? "") : new Response("proibido", { status: 403 });
  }
  if (req.method !== "POST") return new Response("método não permitido", { status: 405 });

  const bruto = await req.text();
  const temChave = SEGREDO !== "" && url.searchParams.get("chave") === SEGREDO;
  const assinado = SEGREDO_APP !== "" && await assinaturaValida(bruto, req.headers.get("x-hub-signature-256"), SEGREDO_APP);
  if (!temChave && !assinado) return new Response("não autorizado", { status: 401, headers: CORS });

  let corpo: any;
  try { corpo = JSON.parse(bruto); } catch { return new Response("JSON inválido", { status: 400 }); }

  if (corpo?.simular) {
    if (!temChave) return new Response("não autorizado", { status: 401, headers: CORS });
    try {
      return Response.json(await simular(corpo.simular), { headers: CORS });
    } catch (err) {
      return Response.json({ erro: (err as Error).message }, { status: 500, headers: CORS });
    }
  }

  // Responde logo à Meta (senão ela reenvia) e atende em segundo plano.
  EdgeRuntime.waitUntil(processar(lerWebhook(corpo)));
  return new Response("ok");
});
