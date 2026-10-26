// Copia os imóveis do XML do site (ImobiBrasil) para a tabela public.imoveis.
// Roda de hora em hora pelo agendador do Supabase (Integrations › Cron) e pode
// ser chamada à mão para testar. Imóvel que saiu do XML fica com ativo = false.
import { createClient } from "npm:@supabase/supabase-js@2.118.0";
import { lerXmlImoveis } from "../_shared/imoveis_xml.ts";

const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

Deno.serve(async () => {
  const url = Deno.env.get("IMOVEIS_XML_URL");
  if (!url) return Response.json({ erro: "Configure o segredo IMOVEIS_XML_URL" }, { status: 500 });

  const resp = await fetch(url, { headers: { "User-Agent": "CocalAssistente/1.0" } });
  if (!resp.ok) return Response.json({ erro: `XML respondeu ${resp.status}` }, { status: 502 });
  const imoveis = lerXmlImoveis(await resp.text());

  // XML vazio ou ilegível: não desativa o catálogo inteiro por engano.
  if (imoveis.length === 0) return Response.json({ erro: "Nenhum imóvel encontrado no XML" }, { status: 422 });

  const agora = new Date().toISOString();
  for (let i = 0; i < imoveis.length; i += 200) {
    const lote = imoveis.slice(i, i + 200).map((im) => ({ ...im, ativo: true, atualizado_em: agora }));
    const { error } = await db.from("imoveis").upsert(lote, { onConflict: "codigo" });
    if (error) return Response.json({ erro: error.message }, { status: 500 });
  }
  const { error, count } = await db.from("imoveis").update({ ativo: false }, { count: "exact" })
    .eq("ativo", true).lt("atualizado_em", agora);
  if (error) return Response.json({ erro: error.message }, { status: 500 });

  return Response.json({ importados: imoveis.length, desativados: count ?? 0 });
});
