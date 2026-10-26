// Teste do ciclo completo do agente com um banco em memória e respostas do
// Claude roteirizadas (nada sai para a internet).
import { assert, assertEquals, assertMatch } from "jsr:@std/assert@1.0.13";
import { type Contexto, responder } from "./agente.ts";

type Linha = Record<string, any>;

// Banco falso: só o que o agente usa do supabase-js.
function bancoFalso(tabelas: Record<string, Linha[]>) {
  const from = (nome: string) => {
    const linhas = (tabelas[nome] ??= []);
    const filtros: ((l: Linha) => boolean)[] = [];
    let acao: "select" | "update" | "insert" = "select";
    let dados: Linha = {};
    let ordem: [string, boolean] | null = null;
    let limite = Infinity;
    let contar = false;
    const sel = () => {
      let r = linhas.filter((l) => filtros.every((f) => f(l)));
      if (ordem) {
        const [c, asc] = ordem;
        r = [...r].sort((a, b) => ((a[c] ?? Infinity) - (b[c] ?? Infinity)) * (asc ? 1 : -1));
      }
      return r;
    };
    const executar = () => {
      if (acao === "insert") { linhas.push({ id: linhas.length + 1, ...dados }); return { data: null, error: null }; }
      if (acao === "update") { sel().forEach((l) => Object.assign(l, dados)); return { data: null, error: null }; }
      const todos = sel();
      return { data: todos.slice(0, limite), count: contar ? todos.length : null, error: null };
    };
    const q: any = {
      select: (_c?: string, o?: { count?: string }) => { contar = !!o?.count; return q; },
      insert: (d: Linha) => { acao = "insert"; dados = d; return q; },
      update: (d: Linha) => { acao = "update"; dados = d; return q; },
      eq: (c: string, v: unknown) => { filtros.push((l) => l[c] === v); return q; },
      in: (c: string, v: unknown[]) => { filtros.push((l) => v.includes(l[c])); return q; },
      ilike: (c: string, p: string) => {
        const re = new RegExp("^" + p.replace(/%/g, ".*") + "$", "i");
        filtros.push((l) => re.test(l[c] ?? ""));
        return q;
      },
      gte: (c: string, v: number) => { filtros.push((l) => l[c] != null && l[c] >= v); return q; },
      lte: (c: string, v: number) => { filtros.push((l) => l[c] != null && l[c] <= v); return q; },
      order: (c: string, o?: { ascending?: boolean }) => { ordem = [c, o?.ascending !== false]; return q; },
      limit: (n: number) => { limite = n; return q; },
      single: () => Promise.resolve({ data: executar().data?.[0] ?? null, error: null }),
      maybeSingle: () => Promise.resolve({ data: executar().data?.[0] ?? null, error: null }),
      then: (ok: (v: unknown) => unknown, erro?: (e: unknown) => unknown) => Promise.resolve(executar()).then(ok, erro),
    };
    return q;
  };
  return { from } as any;
}

// Respostas roteirizadas do Claude, na ordem; guarda os pedidos feitos.
// O cliente da Anthropic guarda o fetch na criação, por isso o falso é um só.
let roteiro: Linha[] = [];
let pedidos: Linha[] = [];
globalThis.fetch = async (input: any, init?: any) => {
  const url = String(input instanceof Request ? input.url : input);
  if (!url.includes("api.anthropic.com")) throw new Error("rede bloqueada no teste: " + url);
  const corpo = JSON.parse(init.body);
  pedidos.push({ corpo, beta: new Headers(init.headers).get("anthropic-beta") });
  const r = roteiro.shift();
  if (!r) throw new Error("o agente chamou o Claude mais vezes que o roteiro");
  return Response.json({ id: "msg_" + pedidos.length, type: "message", role: "assistant", model: corpo.model,
    stop_details: null, usage: { input_tokens: 1, output_tokens: 1 }, stop_sequence: null, ...r });
};
function claudeFalso(r: Linha[]) {
  roteiro = r;
  pedidos = [];
  return { pedidos, restaurar: () => assertEquals(roteiro.length, 0, "sobraram respostas no roteiro") };
}

const usar = (id: string, name: string, input: Linha) => ({ type: "tool_use", id, name, input });

Deno.test("fluxo completo: busca, envia opções, registra lead e passa para corretor", async () => {
  Deno.env.set("ANTHROPIC_API_KEY", "teste");
  Deno.env.set("CRM_EQUIPE_ID", "eq1");
  const tabelas: Record<string, Linha[]> = {
    imoveis: [
      { codigo: "1", tipo: "Casa", tipo_busca: "casa", finalidade: "venda", cidade: "Cocal do Sul", cidade_busca: "cocal do sul",
        bairro: "Centro", bairro_busca: "centro", valor_venda: 450000, dormitorios: 3, vagas: 2, area_util: 120, ativo: true,
        url: "https://www.cocalimoveis.com.br/imovel/1/casa", fotos: ["https://img/1.jpg"], titulo: "Casa no Centro" },
      { codigo: "2", tipo: "Casa", tipo_busca: "casa", finalidade: "venda", cidade: "Cocal do Sul", cidade_busca: "cocal do sul",
        bairro: "Centro", bairro_busca: "centro", valor_venda: 900000, ativo: true, url: "u2", fotos: [] },
      { codigo: "3", tipo: "Apartamento", tipo_busca: "apartamento", finalidade: "locacao", cidade: "Cocal do Sul",
        cidade_busca: "cocal do sul", bairro: "Centro", bairro_busca: "centro", valor_locacao: 1500, ativo: true, url: "u3", fotos: [] },
    ],
    wa_conversas: [{ telefone: "5548999998888", nome: "Maria", lead_id: null, modo: "agente" }],
    wa_mensagens: [{ id: 1, telefone: "5548999998888", autor: "cliente", texto: "Quero comprar casa no Centro até 500 mil" }],
    base_respostas: [{ tema: "Horário", conteudo: "Seg a sex 8h-18h", aprovado: true, ordem: 1 }],
    leads: [],
  };
  const claude = claudeFalso([
    { stop_reason: "tool_use", content: [usar("t1", "buscar_imoveis", { finalidade: "venda", tipo: "Casa", bairro: "centro", valor_max: 500000 })] },
    { stop_reason: "tool_use", content: [
      usar("t2", "enviar_imoveis", { codigos: ["1"] }),
      usar("t3", "registrar_lead", { nome: "Maria", finalidade: "compra", tipo_imovel: "Casa", regiao: "Centro", valor_max: 500000, pagamento: ["financiamento", "x"], resumo: "Casa no Centro até 500 mil" }),
    ] },
    { stop_reason: "end_turn", content: [{ type: "text", text: "Essa casa chamou sua atenção?" }] },
  ]);
  try {
    const ctx: Contexto = { db: bancoFalso(tabelas), telefone: "5548999998888", nome: "Maria", simular: true, saidas: [] };
    const saidas = await responder(ctx);

    // Pedido ao Claude: modelo, fallback e base aprovada nas instruções.
    const p = claude.pedidos[0];
    assertEquals(p.corpo.model, "claude-opus-5-5");
    assertEquals(p.corpo.fallbacks, "default");
    assertMatch(p.beta ?? "", /server-side-fallback-2026-07-01/);
    assertMatch(p.corpo.system[0].text, /Seg a sex 8h-18h/);

    // A busca devolveu só a casa dentro do valor.
    const resultadoBusca = JSON.parse(claude.pedidos[1].corpo.messages.at(-1).content[0].content);
    assertEquals(resultadoBusca.total_encontrado, 1);
    assertEquals(resultadoBusca.imoveis[0].codigo, "1");

    // O cliente recebe o cartão (com foto) e depois o texto.
    assertEquals(saidas.length, 2);
    assertMatch(saidas[0], /\[foto: https:\/\/img\/1.jpg\]/);
    assertMatch(saidas[0], /R\$\s?450\.000/);
    assertMatch(saidas[0], /cocalimoveis\.com\.br\/imovel\/1/);
    assertEquals(saidas[1], "Essa casa chamou sua atenção?");

    // Lead criado no CRM com o telefone e só pagamentos válidos.
    assertEquals(tabelas.leads.length, 1);
    const lead = tabelas.leads[0];
    assertEquals([lead.equipe_id, lead.nome, lead.telefone, lead.finalidade, lead.valor_max], ["eq1", "Maria", "(48) 99999-8888", "compra", 500000]);
    assertEquals(lead.pagamento, ["financiamento"]);
    assertEquals(tabelas.wa_conversas[0].lead_id, lead.id);
  } finally {
    claude.restaurar();
  }

  // Segunda rodada: cliente quer visitar → transfere e o agente fica pausado.
  tabelas.wa_mensagens.push({ id: 99, telefone: "5548999998888", autor: "cliente", texto: "Quero visitar amanhã" });
  const claude2 = claudeFalso([
    { stop_reason: "tool_use", content: [usar("t4", "transferir_para_humano", { motivo: "agendar_visita", detalhe: "Quer visitar a casa 1 amanhã" })] },
    { stop_reason: "end_turn", content: [{ type: "text", text: "Um corretor vai continuar por aqui!" }] },
  ]);
  try {
    const ctx: Contexto = { db: bancoFalso(tabelas), telefone: "5548999998888", nome: "Maria", simular: true, saidas: [] };
    assertEquals(await responder(ctx), ["Um corretor vai continuar por aqui!"]);
    assertEquals(tabelas.leads.length, 1);
    assertMatch(tabelas.leads[0].obs, /PEDIU CORRETOR \(agendar visita\)/);
    assertEquals(tabelas.wa_conversas[0].modo, "humano");
    assert(new Date(tabelas.wa_conversas[0].humano_ate) > new Date());
  } finally {
    claude2.restaurar();
  }
});

Deno.test("se o Claude recusar, avisa o cliente e passa para um corretor", async () => {
  Deno.env.set("ANTHROPIC_API_KEY", "teste");
  Deno.env.set("CRM_EQUIPE_ID", "eq1");
  const tabelas: Record<string, Linha[]> = {
    wa_conversas: [{ telefone: "5548911112222", nome: "", lead_id: null, modo: "agente" }],
    wa_mensagens: [{ id: 1, telefone: "5548911112222", autor: "cliente", texto: "oi" }],
    leads: [],
  };
  const claude = claudeFalso([{ stop_reason: "refusal", content: [] }]);
  try {
    const saidas = await responder({ db: bancoFalso(tabelas), telefone: "5548911112222", nome: "", simular: true, saidas: [] });
    assertEquals(saidas.length, 1);
    assertMatch(saidas[0], /equipe/);
    assertEquals(tabelas.wa_conversas[0].modo, "humano");
    assertEquals(tabelas.leads[0].nome, "Cliente WhatsApp");
  } finally {
    claude.restaurar();
  }
});
